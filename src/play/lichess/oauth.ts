import { z } from 'zod';
import { LICHESS_ORIGIN, LichessClient, LichessError } from './client';
import { codeChallenge, randomToken } from './pkce';

/**
 * Anmeldung bei Lichess: OAuth 2 Authorization Code mit PKCE, ohne Client-Secret. Lichess
 * verlangt keine Registrierung; die `client_id` ist frei gewählt. Rückleitung über eine
 * Loopback-Adresse auf 127.0.0.1 (Rust: `src-tauri/src/lichess.rs`).
 */
export const CLIENT_ID = 'schach-coach-desktop';
/** Minimaler Scope für Partien über die Board-API */
export const SCOPES = ['board:play'] as const;

/** Seite zum Erzeugen eines persönlichen Tokens, mit vorausgewähltem Scope */
export const PERSONAL_TOKEN_URL = `${LICHESS_ORIGIN}/account/oauth/token/create?scopes[]=board:play&description=Schach-Coach`;

export function redirectUriFor(port: number): string {
  return `http://127.0.0.1:${port}/callback`;
}

export function authorizeUrl(params: {
  redirectUri: string;
  challenge: string;
  state: string;
  scopes?: readonly string[];
}): string {
  const query = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: params.redirectUri,
    code_challenge_method: 'S256',
    code_challenge: params.challenge,
    scope: (params.scopes ?? SCOPES).join(' '),
    state: params.state,
  });
  return `${LICHESS_ORIGIN}/oauth?${query.toString()}`;
}

const tokenSchema = z.object({ access_token: z.string().min(1) });

/** Tauscht den Code gegen den Token (POST /api/token, ohne Anmeldung). */
export async function exchangeCode(
  client: LichessClient,
  params: { code: string; verifier: string; redirectUri: string },
): Promise<string> {
  const parsed = tokenSchema.safeParse(
    await client.json('/api/token', {
      method: 'POST',
      auth: false,
      form: {
        grant_type: 'authorization_code',
        code: params.code,
        code_verifier: params.verifier,
        redirect_uri: params.redirectUri,
        client_id: CLIENT_ID,
      },
    }),
  );
  if (!parsed.success) throw new LichessError('badResponse');
  return parsed.data.access_token;
}

export interface OAuthCallback {
  code?: string | null;
  state?: string | null;
  error?: string | null;
}

/** Was die Anmeldung von der Desktop-App braucht (im Test eine Attrappe) */
export interface OAuthBridge {
  /** Port auf 127.0.0.1 öffnen; danach kommt genau ein Ergebnis über `waitForCallback` */
  listen(): Promise<number>;
  waitForCallback(): Promise<OAuthCallback>;
  /** Lichess-Seite im Browser öffnen */
  open(url: string): Promise<void>;
  cancel(): void;
}

export type LoginErrorCode = 'denied' | 'stateMismatch' | 'timeout' | 'cancelled' | 'failed';

export class LoginError extends Error {
  constructor(public readonly code: LoginErrorCode) {
    super(`Lichess-Anmeldung: ${code}`);
    this.name = 'LoginError';
  }
}

/**
 * Ganze Anmeldung: Verifier und `state` zufällig erzeugen, Anmeldeseite öffnen, auf die
 * Rückleitung warten, `state` prüfen, Code gegen Token tauschen. Gibt den Token zurück.
 */
export async function loginWithBrowser(
  bridge: OAuthBridge,
  client: LichessClient,
): Promise<string> {
  const verifier = randomToken(32);
  const state = randomToken(16);
  const challenge = await codeChallenge(verifier);
  const port = await bridge.listen();
  const redirectUri = redirectUriFor(port);
  const callback = bridge.waitForCallback();
  await bridge.open(authorizeUrl({ redirectUri, challenge, state }));
  const result = await callback;
  if (result.error === 'timeout') throw new LoginError('timeout');
  if (result.error === 'cancelled') throw new LoginError('cancelled');
  if (result.error) throw new LoginError(result.error === 'access_denied' ? 'denied' : 'failed');
  if (result.state !== state) throw new LoginError('stateMismatch');
  if (!result.code) throw new LoginError('failed');
  return exchangeCode(client, { code: result.code, verifier, redirectUri });
}
