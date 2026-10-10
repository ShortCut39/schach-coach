import type { FetchFn } from '../llm/types';
import type { OAuthBridge } from '../play/lichess/oauth';
import { lichessClient, setLichessTestDoubles, useLichessAuth } from './lichessAuth';
import { memoryTokenStorage, setTokenStorage, type TokenStorage } from './persistence';

const TOKEN = 'lip_SuperGeheim987';

function lichessServer(validToken: string) {
  const calls: string[] = [];
  const fetchFn: FetchFn = async (url, init) => {
    const auth = (init.headers as Record<string, string>).Authorization;
    calls.push(`${init.method} ${url}`);
    if (url.endsWith('/api/token') && init.method === 'POST') {
      return new Response(JSON.stringify({ access_token: validToken, token_type: 'Bearer' }));
    }
    if (auth !== `Bearer ${validToken}`) {
      return new Response(JSON.stringify({ error: 'No such token' }), { status: 401 });
    }
    if (url.endsWith('/api/token') && init.method === 'DELETE')
      return new Response(null, { status: 204 });
    return new Response(
      JSON.stringify({ id: 'nils', username: 'Nils', perfs: { rapid: { rating: 1432 } } }),
    );
  };
  return { fetchFn, calls };
}

describe('Lichess-Anmeldung im Store', () => {
  let storage: TokenStorage;
  const logged: string[] = [];

  beforeEach(() => {
    storage = memoryTokenStorage();
    setTokenStorage(storage);
    useLichessAuth.setState({ status: 'unknown', account: null, error: null, revokeFailed: false });
    logged.length = 0;
    for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) {
      vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
        logged.push(args.map(String).join(' '));
      });
    }
  });
  afterEach(() => vi.restoreAllMocks());

  it('prüft und speichert ein persönliches Token, meldet sich ab und widerruft es', async () => {
    const server = lichessServer(TOKEN);
    setLichessTestDoubles({ fetch: server.fetchFn });
    expect(await useLichessAuth.getState().loginWithToken(`  ${TOKEN}  `)).toBe(true);
    expect(useLichessAuth.getState()).toMatchObject({
      status: 'loggedIn',
      account: { username: 'Nils' },
    });
    expect(await storage.get()).toBe(TOKEN);
    // Der Token steht nirgends im Zustand der Oberfläche
    expect(JSON.stringify(useLichessAuth.getState())).not.toContain(TOKEN);

    await useLichessAuth.getState().logout();
    expect(server.calls).toContain('DELETE https://lichess.org/api/token');
    expect(await storage.get()).toBeNull();
    expect(useLichessAuth.getState()).toMatchObject({ status: 'loggedOut', revokeFailed: false });
    await expect(lichessClient().account()).rejects.toMatchObject({ code: 'notLoggedIn' });
  });

  it('lehnt ein falsches Token ab und speichert es nicht', async () => {
    setLichessTestDoubles({ fetch: lichessServer(TOKEN).fetchFn });
    expect(await useLichessAuth.getState().loginWithToken('lip_falsch')).toBe(false);
    expect(useLichessAuth.getState()).toMatchObject({ status: 'loggedOut', error: 'unauthorized' });
    expect(await storage.get()).toBeNull();
  });

  it('lädt ein gespeichertes Token beim Start', async () => {
    setLichessTestDoubles({ fetch: lichessServer(TOKEN).fetchFn });
    await storage.set(TOKEN);
    await useLichessAuth.getState().load();
    expect(useLichessAuth.getState().status).toBe('loggedIn');
  });

  it('meldet sich per Browser an', async () => {
    setLichessTestDoubles({
      fetch: lichessServer(TOKEN).fetchFn,
      bridge: (): OAuthBridge => {
        let resolve: (v: { code?: string; state?: string | null }) => void = () => {};
        return {
          listen: async () => 40000,
          waitForCallback: () => new Promise((r) => (resolve = r)),
          open: async (url) =>
            resolve({ code: 'abc', state: new URL(url).searchParams.get('state') }),
          cancel: () => {},
        };
      },
    });
    await useLichessAuth.getState().loginWithBrowser();
    expect(useLichessAuth.getState().status).toBe('loggedIn');
    expect(await storage.get()).toBe(TOKEN);
  });

  it('schreibt den Token nie in die Konsole', async () => {
    setLichessTestDoubles({ fetch: lichessServer(TOKEN).fetchFn });
    await useLichessAuth.getState().loginWithToken(TOKEN);
    await useLichessAuth.getState().load();
    await useLichessAuth.getState().loginWithToken(`${TOKEN}x`);
    await useLichessAuth.getState().logout();
    expect(logged.join('\n')).not.toContain(TOKEN);
  });
});
