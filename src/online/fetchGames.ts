import { z } from 'zod';
import { readHeaders, splitPgn } from '../chess/pgn';
import type { FetchFn } from '../llm/types';

/**
 * Letzte Partien eines Spielers von Lichess oder Chess.com (öffentliche APIs, ohne Anmeldung).
 * Gesendet wird nur der Benutzername; das Ergebnis ist PGN-Text mit mehreren Partien.
 */
export type Platform = 'lichess' | 'chesscom';

export type OnlineErrorCode =
  'invalidUser' | 'notFound' | 'rateLimited' | 'unreachable' | 'noGames' | 'badResponse';

export class OnlineError extends Error {
  constructor(public readonly code: OnlineErrorCode) {
    super(`Online-Import: ${code}`);
  }
}

export const MAX_ONLINE_GAMES = 20;
/** Chess.com: so viele Monatsarchive (neueste zuerst) werden höchstens gelesen */
const MAX_ARCHIVES = 3;
const USERNAME = /^[A-Za-z0-9_-]{2,30}$/;

async function request(fetchFn: FetchFn, url: string, accept: string): Promise<Response> {
  let response: Response;
  try {
    response = await fetchFn(url, { method: 'GET', headers: { Accept: accept } });
  } catch {
    throw new OnlineError('unreachable');
  }
  if (response.status === 404) throw new OnlineError('notFound');
  if (response.status === 429) throw new OnlineError('rateLimited');
  if (!response.ok) throw new OnlineError('badResponse');
  return response;
}

async function fromLichess(username: string, fetchFn: FetchFn): Promise<string> {
  const url = `https://lichess.org/api/games/user/${encodeURIComponent(username)}?max=${MAX_ONLINE_GAMES}&opening=true&clocks=false&evals=false`;
  const response = await request(fetchFn, url, 'application/x-chess-pgn');
  // Nur normales Schach: Varianten (Chess960, Crazyhouse …) kann die Analyse nicht bewerten
  return splitPgn(await response.text())
    .filter((game) => {
      const variant = readHeaders(game).Variant;
      return !variant || variant === 'Standard' || variant === 'From Position';
    })
    .join('\n\n');
}

const archivesSchema = z.object({ archives: z.array(z.string().url()) });
const archiveSchema = z.object({
  games: z.array(
    z.object({
      pgn: z.string().optional(),
      end_time: z.number().optional(),
      rules: z.string().optional(),
    }),
  ),
});

async function fromChessCom(username: string, fetchFn: FetchFn): Promise<string> {
  const base = `https://api.chess.com/pub/player/${encodeURIComponent(username.toLowerCase())}`;
  const archives = archivesSchema.safeParse(
    await (await request(fetchFn, `${base}/games/archives`, 'application/json')).json(),
  );
  if (!archives.success) throw new OnlineError('badResponse');

  const games: { pgn: string; end: number }[] = [];
  for (const url of archives.data.archives.slice(-MAX_ARCHIVES).reverse()) {
    // Nur Archive dieses Spielers bei Chess.com abrufen
    if (!url.startsWith(`${base}/games/`)) continue;
    const archive = archiveSchema.safeParse(
      await (await request(fetchFn, url, 'application/json')).json(),
    );
    if (!archive.success) throw new OnlineError('badResponse');
    for (const game of archive.data.games) {
      // Nur normales Schach (keine Varianten wie Chess960)
      if (game.pgn && (game.rules ?? 'chess') === 'chess')
        games.push({ pgn: game.pgn, end: game.end_time ?? 0 });
    }
    if (games.length >= MAX_ONLINE_GAMES) break;
  }
  return games
    .sort((a, b) => b.end - a.end)
    .slice(0, MAX_ONLINE_GAMES)
    .map((g) => g.pgn.trim())
    .join('\n\n');
}

export async function fetchRecentGames(
  platform: Platform,
  username: string,
  fetchFn: FetchFn,
): Promise<string> {
  const name = username.trim();
  if (!USERNAME.test(name)) throw new OnlineError('invalidUser');
  const pgn =
    platform === 'lichess' ? await fromLichess(name, fetchFn) : await fromChessCom(name, fetchFn);
  if (!pgn) throw new OnlineError('noGames');
  return pgn;
}

/** Welche Farbe hatte der Spieler in dieser Partie? (Vergleich mit den PGN-Headern) */
export function colorOfUser(
  headers: Record<string, string>,
  username: string,
): 'w' | 'b' | undefined {
  const name = username.trim().toLowerCase();
  if (headers.White?.toLowerCase() === name) return 'w';
  if (headers.Black?.toLowerCase() === name) return 'b';
  return undefined;
}
