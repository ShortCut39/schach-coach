import type { FetchFn } from '../../llm/types';
import { LichessClient, LichessError, RATE_LIMIT_PAUSE_MS, ratingOf } from './client';

const TOKEN = 'lip_GeheimerToken123';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('LichessClient', () => {
  it('sendet nur an https://lichess.org und mit Token nur, wenn gewünscht', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchFn: FetchFn = async (url, init) => {
      calls.push({ url, init });
      return json({ id: 'nils', username: 'Nils', perfs: { rapid: { rating: 1500, prov: true } } });
    };
    const client = new LichessClient(() => TOKEN, fetchFn);
    const account = await client.account();
    expect(account.username).toBe('Nils');
    expect(ratingOf(account, 'rapid')).toBe('1500?');
    expect(calls[0]?.url).toBe('https://lichess.org/api/account');
    expect((calls[0]?.init.headers as Record<string, string>).Authorization).toBe(
      `Bearer ${TOKEN}`,
    );

    await client.json('/api/token', { method: 'POST', auth: false, form: { a: 1 } });
    expect((calls[1]?.init.headers as Record<string, string>).Authorization).toBeUndefined();
    expect(calls[1]?.init.body).toBe('a=1');

    // Andere Adressen sind nicht möglich
    await expect(client.json('//evil.example/api/x')).rejects.toBeInstanceOf(LichessError);
    await expect(client.json('https://evil.example/api')).rejects.toBeInstanceOf(LichessError);
    expect(calls).toHaveLength(2);
  });

  it('schickt ohne Token nichts', async () => {
    const fetchFn = vi.fn<FetchFn>();
    const client = new LichessClient(() => '', fetchFn);
    await expect(client.account()).rejects.toMatchObject({ code: 'notLoggedIn' });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('stellt Anfragen nacheinander (immer nur eine gleichzeitig)', async () => {
    let open = 0;
    let maxOpen = 0;
    const fetchFn: FetchFn = async () => {
      open++;
      maxOpen = Math.max(maxOpen, open);
      await new Promise((r) => setTimeout(r, 5));
      open--;
      return json({ ok: true });
    };
    const client = new LichessClient(() => TOKEN, fetchFn);
    await Promise.all([client.json('/api/a'), client.json('/api/b'), client.json('/api/c')]);
    expect(maxOpen).toBe(1);
  });

  it('pausiert nach HTTP 429 eine Minute', async () => {
    let now = 1_000;
    const fetchFn = vi.fn<FetchFn>(async () => new Response('', { status: 429 }));
    const client = new LichessClient(
      () => TOKEN,
      fetchFn,
      () => now,
    );
    await expect(client.json('/api/account')).rejects.toMatchObject({ code: 'rateLimited' });
    now += RATE_LIMIT_PAUSE_MS - 1;
    await expect(client.json('/api/account')).rejects.toMatchObject({ code: 'rateLimited' });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    now += 1;
    fetchFn.mockResolvedValueOnce(json({ id: 'a', username: 'A' }));
    await expect(client.account()).resolves.toMatchObject({ username: 'A' });
  });

  it('nennt die Begründung des Servers, aber nie den Token', async () => {
    const fetchFn: FetchFn = async () =>
      json({ error: `Token ${TOKEN} has no board:play scope` }, 403);
    const client = new LichessClient(() => TOKEN, fetchFn);
    const error = (await client.account().catch((e: unknown) => e)) as LichessError;
    expect(error).toBeInstanceOf(LichessError);
    expect(error.code).toBe('unauthorized');
    expect(error.detail).toBe('Token ••• has no board:play scope');
    expect(`${error.message} ${error.detail}`).not.toContain(TOKEN);
  });

  it('meldet Netzfehler verständlich und widerruft Token mit DELETE', async () => {
    const offline = new LichessClient(
      () => TOKEN,
      async () => {
        throw new Error(`fetch failed for ${TOKEN}`);
      },
    );
    const error = (await offline.account().catch((e: unknown) => e)) as LichessError;
    expect(error.code).toBe('unreachable');
    expect(error.message).not.toContain(TOKEN);

    const calls: string[] = [];
    const client = new LichessClient(
      () => TOKEN,
      async (url, init) => {
        calls.push(`${init.method} ${url}`);
        return new Response(null, { status: 204 });
      },
    );
    await client.revokeToken();
    expect(calls).toEqual(['DELETE https://lichess.org/api/token']);
  });
});
