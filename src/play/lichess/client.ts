import { z } from 'zod';
import type { FetchFn } from '../../llm/types';

/**
 * Zugriff auf die offizielle Lichess-API. Die Adresse ist fest: Anfragen (und damit der Token)
 * gehen nur an https://lichess.org. Normale Anfragen laufen nacheinander (immer nur eine), wie
 * Lichess es verlangt; nur langlebige Streams laufen daneben. Nach HTTP 429 wird eine Minute
 * nichts gesendet. Token und Antwortinhalte werden nie geloggt und erscheinen in keiner
 * Fehlermeldung.
 */
export const LICHESS_ORIGIN = 'https://lichess.org';
/** Pause nach „zu viele Anfragen“ (Lichess: mindestens eine Minute) */
export const RATE_LIMIT_PAUSE_MS = 60_000;

export type LichessErrorCode =
  | 'notLoggedIn'
  | 'unauthorized'
  | 'rateLimited'
  | 'unreachable'
  | 'notFound'
  | 'rejected'
  | 'server'
  | 'badResponse'
  | 'aborted';

export class LichessError extends Error {
  constructor(
    public readonly code: LichessErrorCode,
    public readonly status?: number,
    /** Begründung des Servers (z. B. bei abgelehnter Suche), ohne Token */
    public readonly detail?: string,
  ) {
    super(`Lichess: ${code}${status ? ` (${status})` : ''}`);
    this.name = 'LichessError';
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'DELETE';
  /** Formularfelder (application/x-www-form-urlencoded) */
  form?: Record<string, string | number | boolean | undefined>;
  /** Mit Token senden (Standard: ja) */
  auth?: boolean;
  accept?: string;
  signal?: AbortSignal;
}

const accountSchema = z.object({
  id: z.string(),
  username: z.string(),
  title: z.string().optional().catch(undefined),
  perfs: z
    .record(
      z.string(),
      z.object({ rating: z.number(), prov: z.boolean().optional().catch(undefined) }).catch({
        rating: 0,
      }),
    )
    .optional()
    .catch(undefined),
});
export type LichessAccount = z.infer<typeof accountSchema>;

function encodeForm(form: NonNullable<RequestOptions['form']>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(form)) {
    if (value !== undefined) params.set(key, String(value));
  }
  return params.toString();
}

/** Begründung aus einer Fehlerantwort (`{ error: … }`), ohne den Token */
async function serverDetail(response: Response, token: string): Promise<string | undefined> {
  try {
    const body = (await response.json()) as { error?: unknown };
    let text: string | undefined;
    if (typeof body.error === 'string') text = body.error;
    else if (body.error && typeof body.error === 'object') {
      text = Object.values(body.error as Record<string, unknown>)
        .flat()
        .filter((v): v is string => typeof v === 'string')
        .join(' ');
    }
    if (!text) return undefined;
    return token ? text.split(token).join('•••') : text;
  } catch {
    return undefined;
  }
}

function errorFor(status: number, detail?: string): LichessError {
  if (status === 401 || status === 403) return new LichessError('unauthorized', status, detail);
  if (status === 404) return new LichessError('notFound', status, detail);
  if (status === 429) return new LichessError('rateLimited', status, detail);
  if (status >= 500) return new LichessError('server', status, detail);
  return new LichessError('rejected', status, detail);
}

export class LichessClient {
  private queue: Promise<unknown> = Promise.resolve();
  /** Bis zu diesem Zeitpunkt (ms) wird nach einem 429 nichts gesendet */
  rateLimitedUntil = 0;

  constructor(
    private readonly getToken: () => string,
    private readonly fetchFn: FetchFn,
    private readonly now: () => number = Date.now,
  ) {}

  /** Pfad muss mit `/api/` beginnen; die Adresse ist immer https://lichess.org */
  private url(path: string): string {
    if (!/^\/api\/[\w\-/.]*(\?.*)?$/.test(path)) throw new LichessError('rejected');
    return `${LICHESS_ORIGIN}${path}`;
  }

  private async send(path: string, options: RequestOptions): Promise<Response> {
    if (this.now() < this.rateLimitedUntil) throw new LichessError('rateLimited', 429);
    const token = this.getToken().trim();
    const auth = options.auth ?? true;
    if (auth && !token) throw new LichessError('notLoggedIn');
    const headers: Record<string, string> = { Accept: options.accept ?? 'application/json' };
    if (auth) headers.Authorization = `Bearer ${token}`;
    const init: RequestInit = { method: options.method ?? 'GET', headers };
    if (options.form) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      init.body = encodeForm(options.form);
    }
    if (options.signal) init.signal = options.signal;
    let response: Response;
    try {
      response = await this.fetchFn(this.url(path), init);
    } catch (error) {
      if (error instanceof LichessError) throw error;
      if (options.signal?.aborted) throw new LichessError('aborted');
      throw new LichessError('unreachable');
    }
    if (response.status === 429) {
      this.rateLimitedUntil = this.now() + RATE_LIMIT_PAUSE_MS;
      throw new LichessError('rateLimited', 429);
    }
    if (!response.ok) throw errorFor(response.status, await serverDetail(response, token));
    return response;
  }

  /** Normale Anfrage: wartet, bis die vorige fertig ist (immer nur eine gleichzeitig). */
  request(path: string, options: RequestOptions = {}): Promise<Response> {
    const run = this.queue.then(async () => {
      const response = await this.send(path, options);
      // Körper vollständig lesen, bevor die nächste Anfrage startet
      const text = await response.text();
      const empty = [204, 205, 304].includes(response.status);
      return new Response(empty ? null : text, {
        status: response.status,
        headers: response.headers,
      });
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  async json(path: string, options: RequestOptions = {}): Promise<unknown> {
    const response = await this.request(path, options);
    try {
      return (await response.json()) as unknown;
    } catch {
      throw new LichessError('badResponse', response.status);
    }
  }

  /** Langlebiger Strom (NDJSON): läuft neben der Warteschlange; der Aufrufer liest den Körper. */
  async stream(path: string, options: RequestOptions = {}): Promise<ReadableStream<Uint8Array>> {
    const response = await this.send(path, { accept: 'application/x-ndjson', ...options });
    if (!response.body) throw new LichessError('badResponse', response.status);
    return response.body;
  }

  /** Konto: Name, Titel, Wertungen */
  async account(): Promise<LichessAccount> {
    const parsed = accountSchema.safeParse(await this.json('/api/account'));
    if (!parsed.success) throw new LichessError('badResponse');
    return parsed.data;
  }

  /** Widerruft den aktuellen Token bei Lichess (DELETE /api/token). */
  async revokeToken(): Promise<void> {
    await this.request('/api/token', { method: 'DELETE' });
  }
}

/** Wertung einer Spielart, z. B. Rapid: `1500` bzw. `1500?` (vorläufig) */
export function ratingOf(account: LichessAccount, perf: string): string | undefined {
  const entry = account.perfs?.[perf];
  if (!entry || !entry.rating) return undefined;
  return `${entry.rating}${entry.prov ? '?' : ''}`;
}
