import { colorOfUser, fetchRecentGames, OnlineError } from './fetchGames';

const pgn = (white: string, black: string) =>
  `[White "${white}"]\n[Black "${black}"]\n[Result "1-0"]\n\n1. e4 e5 1-0`;

function fakeFetch(routes: Record<string, { status?: number; body: unknown }>) {
  const calls: string[] = [];
  const fn = async (url: string) => {
    calls.push(url);
    const route = Object.entries(routes).find(([prefix]) => url.startsWith(prefix))?.[1];
    if (!route) return new Response('nicht gefunden', { status: 404 });
    const body = typeof route.body === 'string' ? route.body : JSON.stringify(route.body);
    return new Response(body, { status: route.status ?? 200 });
  };
  return { fn, calls };
}

describe('fetchRecentGames', () => {
  it('lädt die letzten Partien von Lichess als PGN', async () => {
    const { fn, calls } = fakeFetch({
      'https://lichess.org/api/games/user/Nils_99': { body: pgn('Nils_99', 'x') },
    });
    expect(await fetchRecentGames('lichess', ' Nils_99 ', fn)).toContain('[White "Nils_99"]');
    expect(calls[0]).toBe(
      'https://lichess.org/api/games/user/Nils_99?max=20&opening=true&clocks=false&evals=false',
    );
  });

  it('lässt Lichess-Varianten wie Chess960 weg', async () => {
    const text = `${pgn('Nils_99', 'a')}\n\n[Variant "Chess960"]\n[White "x"]\n[Black "y"]\n\n1. e4 *`;
    const { fn } = fakeFetch({ 'https://lichess.org': { body: text } });
    const result = await fetchRecentGames('lichess', 'Nils_99', fn);
    expect(result).toContain('Nils_99');
    expect(result).not.toContain('Chess960');
  });

  it('lädt Chess.com-Archive, neueste zuerst, ohne Varianten', async () => {
    const base = 'https://api.chess.com/pub/player/short_cut39';
    const { fn } = fakeFetch({
      [`${base}/games/archives`]: {
        body: { archives: [`${base}/games/2026/09`, `${base}/games/2026/10`] },
      },
      [`${base}/games/2026/10`]: {
        body: {
          games: [
            { pgn: pgn('A', 'Short_Cut39'), end_time: 2, rules: 'chess' },
            { pgn: pgn('Var', 'iante'), end_time: 3, rules: 'chess960' },
          ],
        },
      },
      [`${base}/games/2026/09`]: {
        body: { games: [{ pgn: pgn('Short_Cut39', 'B'), end_time: 1, rules: 'chess' }] },
      },
    });
    const text = await fetchRecentGames('chesscom', 'Short_Cut39', fn);
    expect(text.indexOf('[White "A"]')).toBeLessThan(text.indexOf('[White "Short_Cut39"]'));
    expect(text).not.toContain('Var');
  });

  it('meldet verständliche Fehler', async () => {
    await expect(fetchRecentGames('lichess', 'a b', fakeFetch({}).fn)).rejects.toEqual(
      new OnlineError('invalidUser'),
    );
    await expect(fetchRecentGames('lichess', 'gibtsnicht', fakeFetch({}).fn)).rejects.toMatchObject(
      { code: 'notFound' },
    );
    await expect(
      fetchRecentGames('lichess', 'leer', fakeFetch({ 'https://lichess.org': { body: '' } }).fn),
    ).rejects.toMatchObject({ code: 'noGames' });
    await expect(
      fetchRecentGames(
        'lichess',
        'viel',
        fakeFetch({ 'https://lichess.org': { status: 429, body: '' } }).fn,
      ),
    ).rejects.toMatchObject({ code: 'rateLimited' });
    const offline = async () => {
      throw new TypeError('offline');
    };
    await expect(fetchRecentGames('chesscom', 'abc', offline)).rejects.toMatchObject({
      code: 'unreachable',
    });
  });
});

describe('colorOfUser', () => {
  it('erkennt die Farbe unabhängig von Groß-/Kleinschreibung', () => {
    expect(colorOfUser({ White: 'Short_Cut39', Black: 'x' }, 'short_cut39')).toBe('w');
    expect(colorOfUser({ White: 'x', Black: 'SHORT_CUT39' }, 'Short_Cut39')).toBe('b');
    expect(colorOfUser({ White: 'x', Black: 'y' }, 'z')).toBeUndefined();
  });
});
