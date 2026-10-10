import type { FetchFn } from '../../llm/types';
import { LichessClient } from './client';
import { authorizeUrl, CLIENT_ID, loginWithBrowser, type OAuthBridge } from './oauth';
import { codeChallenge } from './pkce';

function fakeBridge(
  answer: (url: URL) => { code?: string; state?: string | null; error?: string },
) {
  let opened: URL | null = null;
  let resolve: (value: ReturnType<typeof answer>) => void = () => {};
  const bridge: OAuthBridge & { opened: () => URL | null } = {
    opened: () => opened,
    listen: async () => 51234,
    waitForCallback: () => new Promise((r) => (resolve = r)),
    open: async (url) => {
      opened = new URL(url);
      resolve(answer(opened));
    },
    cancel: () => resolve({ error: 'cancelled' }),
  };
  return bridge;
}

describe('Lichess-Anmeldung (OAuth mit PKCE)', () => {
  it('baut die Anmeldeadresse mit allen Pflichtangaben', () => {
    const url = new URL(
      authorizeUrl({
        redirectUri: 'http://127.0.0.1:5000/callback',
        challenge: 'abc',
        state: 'xyz',
      }),
    );
    expect(url.origin + url.pathname).toBe('https://lichess.org/oauth');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: 'code',
      client_id: CLIENT_ID,
      redirect_uri: 'http://127.0.0.1:5000/callback',
      code_challenge_method: 'S256',
      code_challenge: 'abc',
      scope: 'board:play',
      state: 'xyz',
    });
  });

  it('tauscht den Code mit dem passenden Verifier gegen den Token', async () => {
    const posted: URLSearchParams[] = [];
    const fetchFn: FetchFn = async (url, init) => {
      expect(url).toBe('https://lichess.org/api/token');
      posted.push(new URLSearchParams(String(init.body)));
      return new Response(
        JSON.stringify({ token_type: 'Bearer', access_token: 'lio_neu', expires_in: 1 }),
      );
    };
    const bridge = fakeBridge((url) => ({ code: 'code123', state: url.searchParams.get('state') }));
    const token = await loginWithBrowser(bridge, new LichessClient(() => '', fetchFn));
    expect(token).toBe('lio_neu');
    const form = posted[0]!;
    expect(form.get('grant_type')).toBe('authorization_code');
    expect(form.get('code')).toBe('code123');
    expect(form.get('redirect_uri')).toBe('http://127.0.0.1:51234/callback');
    expect(form.get('client_id')).toBe(CLIENT_ID);
    // Der gesendete Verifier passt zur Challenge in der Anmeldeadresse
    expect(await codeChallenge(form.get('code_verifier')!)).toBe(
      bridge.opened()!.searchParams.get('code_challenge'),
    );
  });

  it('lehnt eine Rückleitung mit falschem state ab, ohne den Code einzulösen', async () => {
    const fetchFn = vi.fn<FetchFn>();
    const bridge = fakeBridge(() => ({ code: 'code123', state: 'gefälscht' }));
    await expect(
      loginWithBrowser(bridge, new LichessClient(() => '', fetchFn)),
    ).rejects.toMatchObject({
      code: 'stateMismatch',
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('meldet Ablehnung und Zeitüberschreitung', async () => {
    const client = new LichessClient(() => '', vi.fn<FetchFn>());
    await expect(
      loginWithBrowser(
        fakeBridge(() => ({ error: 'access_denied' })),
        client,
      ),
    ).rejects.toMatchObject({ code: 'denied' });
    await expect(
      loginWithBrowser(
        fakeBridge(() => ({ error: 'timeout' })),
        client,
      ),
    ).rejects.toMatchObject({
      code: 'timeout',
    });
  });
});
