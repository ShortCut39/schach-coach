import { Chess, DEFAULT_POSITION } from 'chess.js';
import { parsePgnGame, pliesFromHistory } from '../chess/pgn';
import { buildPgn, pgnDate } from './pgn';
import type { GameViewState } from './session/types';

function viewOf(moves: string[], patch: Partial<GameViewState> = {}, startFen = DEFAULT_POSITION) {
  const chess = new Chess(startFen);
  for (const move of moves) chess.move(move);
  const view: GameViewState = {
    mode: 'local',
    status: 'ended',
    myColor: 'b',
    startFen,
    fen: chess.fen(),
    turn: chess.turn(),
    plies: pliesFromHistory(chess.history({ verbose: true })),
    players: { w: { name: 'Stockfish (Stufe Mittel)' }, b: { name: 'Du' } },
    timeControl: { initialMs: 600_000, incrementMs: 0 },
    clock: null,
    outcome: { result: '0-1', winner: 'b', reason: 'checkmate' },
    drawOffer: null,
    waiting: false,
    notice: null,
    hintsUsed: 2,
    takebacks: 0,
    startedAt: new Date(2026, 9, 11, 14, 30),
    ...patch,
  };
  return view;
}

const info = {
  event: 'Partie gegen Stockfish',
  site: 'Schach-Coach',
  names: { w: 'Stockfish (Stufe Mittel)', b: 'Du' },
};

describe('PGN der gespielten Partie', () => {
  it('füllt die Kopfzeilen und lässt sich wieder einlesen', () => {
    const pgn = buildPgn(viewOf(['f4', 'e5', 'g4', 'Qh4#']), info);
    expect(pgn).toContain('[Event "Partie gegen Stockfish"]');
    expect(pgn).toContain('[Site "Schach-Coach"]');
    expect(pgn).toContain('[Date "2026.10.11"]');
    expect(pgn).toContain('[White "Stockfish (Stufe Mittel)"]');
    expect(pgn).toContain('[Black "Du"]');
    expect(pgn).toContain('[Result "0-1"]');
    expect(pgn).toContain('[TimeControl "600+0"]');
    expect(pgn).toContain('[Termination "Normal"]');
    expect(pgn).toContain('1. f4 e5 2. g4 Qh4# 0-1');
    expect(pgn).not.toContain('SetUp');

    const game = parsePgnGame(pgn);
    expect(game.ok).toBe(true);
    if (game.ok) {
      expect(game.value.plies).toHaveLength(4);
      expect(game.value.result).toBe('0-1');
    }
  });

  it('nennt Lichess-Seite, Wertungen und Zeitüberschreitung', () => {
    const pgn = buildPgn(
      viewOf(['e4', 'e5'], {
        mode: 'lichess',
        outcome: { result: '1-0', winner: 'w', reason: 'timeout' },
        timeControl: { initialMs: 600_000, incrementMs: 5_000 },
      }),
      {
        event: 'Rated Rapid game',
        site: 'https://lichess.org/abcd1234',
        names: { w: 'Gegner', b: 'Ich' },
        ratings: { w: 1510, b: 1488 },
      },
    );
    expect(pgn).toContain('[Site "https://lichess.org/abcd1234"]');
    expect(pgn).toContain('[WhiteElo "1510"]');
    expect(pgn).toContain('[BlackElo "1488"]');
    expect(pgn).toContain('[TimeControl "600+5"]');
    expect(pgn).toContain('[Termination "Time forfeit"]');
  });

  it('schreibt ohne Uhr „-“ und eine eigene Startstellung als FEN', () => {
    const start = 'r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1';
    const pgn = buildPgn(viewOf(['O-O'], { timeControl: null, outcome: null }, start), info);
    expect(pgn).toContain('[TimeControl "-"]');
    expect(pgn).toContain('[SetUp "1"]');
    expect(pgn).toContain(`[FEN "${start}"]`);
    expect(pgn).toContain('1... O-O *');
    expect(parsePgnGame(pgn).ok).toBe(true);
  });

  it('maskiert Anführungszeichen und bricht lange Partien um', () => {
    const moves = Array.from({ length: 20 }, () => ['Nf3', 'Nf6', 'Ng1', 'Ng8']).flat();
    const pgn = buildPgn(viewOf(moves, { outcome: null }), {
      ...info,
      names: { w: 'A "B"', b: 'C' },
    });
    expect(pgn).toContain('[White "A \\"B\\""]');
    const body = pgn.split('\n\n')[1]!;
    expect(body.split('\n').every((line) => line.length <= 80)).toBe(true);
  });

  it('formatiert das Datum', () => {
    expect(pgnDate(new Date(2026, 0, 5))).toBe('2026.01.05');
  });
});
