import {
  formatPgnDate,
  fullMoveCount,
  headerValue,
  movetextTokens,
  parsePgnGame,
  splitPgn,
  summarizePgn,
} from './pgn';
import { FEN_AFTER_QB8, operaGame } from '../test/fixtures';

function parseOk(pgn: string) {
  const result = parsePgnGame(pgn);
  if (!result.ok) throw new Error(`Unerwarteter Fehler: ${JSON.stringify(result.error)}`);
  return result.value;
}

describe('parsePgnGame – Beispielpartie', () => {
  const game = parseOk(operaGame);

  it('liest Header, Ergebnis und alle 33 Halbzüge', () => {
    expect(game.headers.White).toBe('Morphy, Paul');
    expect(game.headers.Black).toBe('Herzog von Braunschweig & Graf Isouard');
    expect(game.result).toBe('1-0');
    expect(game.plies).toHaveLength(33);
    expect(fullMoveCount(game)).toBe(17);
  });

  it('nummeriert Züge und Farben richtig', () => {
    const qb8 = game.plies[30]!;
    expect(qb8).toMatchObject({ index: 30, moveNumber: 16, color: 'w', san: 'Qb8+', uci: 'b3b8' });
    expect(game.plies[17]).toMatchObject({ moveNumber: 9, color: 'b', san: 'b5' });
  });

  it('liefert die Stellung nach 16. Db8+ aus dem Projektdokument', () => {
    expect(game.plies[30]!.fenAfter).toBe(FEN_AFTER_QB8);
    expect(game.plies[31]!.fenBefore).toBe(FEN_AFTER_QB8);
  });

  it('setzt die Flags für Schach, Matt, Schlag und Rochade', () => {
    expect(game.plies[30]!.flags).toMatchObject({ check: true, mate: false, capture: false });
    expect(game.plies[31]!.flags).toMatchObject({ capture: true }); // Nxb8
    expect(game.plies[32]!.flags).toMatchObject({ check: true, mate: true }); // Rd8#
    expect(game.plies[22]!.flags).toMatchObject({ castle: true }); // O-O-O
  });
});

describe('parsePgnGame – Sonderfälle', () => {
  it('zählt en passant als Schlagzug', () => {
    const game = parseOk('1. e4 a6 2. e5 d5 3. exd6 *');
    const enPassant = game.plies[4];
    expect(enPassant?.flags).toMatchObject({ capture: true, enPassant: true });
    expect(game.plies.slice(0, 4).every((p) => !p.flags.capture)).toBe(true);
  });

  it('ignoriert Kommentare, Varianten, NAGs und Bewertungszeichen', () => {
    const game = parseOk(
      '1. e4 {Königsbauer} (1. d4 d5 (1... Nf6)) e5 $1 2. Nf3!? ; Zeilenkommentar\nNc6 *',
    );
    expect(game.plies.map((p) => p.san)).toEqual(['e4', 'e5', 'Nf3', 'Nc6']);
    expect(game.result).toBe('*');
  });

  it('akzeptiert Windows-Zeilenenden und BOM', () => {
    const game = parseOk('﻿' + operaGame.replace(/\n/g, '\r\n'));
    expect(game.plies).toHaveLength(33);
  });

  it('startet aus einer FEN im Header, auch mit Schwarz am Zug', () => {
    const game = parseOk(
      '[SetUp "1"]\n[FEN "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"]\n\n1... e5 2. Nf3 *',
    );
    expect(game.plies[0]).toMatchObject({ moveNumber: 1, color: 'b', san: 'e5' });
    expect(fullMoveCount(game)).toBe(2);
  });

  it('meldet einen unmöglichen Zug mit Zugnummer und Farbe', () => {
    expect(parsePgnGame('1. e4 e5 2. Nf3 Nc6 3. Ke3')).toEqual({
      ok: false,
      error: { code: 'illegalMove', moveNumber: 3, color: 'w', san: 'Ke3' },
    });
    expect(parsePgnGame('1. e4 e5 2. Nf3 Nf9')).toEqual({
      ok: false,
      error: { code: 'illegalMove', moveNumber: 2, color: 'b', san: 'Nf9' },
    });
  });

  it('meldet leere Eingaben und Partien ohne Züge', () => {
    expect(parsePgnGame('  ')).toEqual({ ok: false, error: { code: 'empty' } });
    expect(parsePgnGame('[Event "Leer"]\n\n*')).toEqual({ ok: false, error: { code: 'noMoves' } });
  });

  it('meldet Unsinn als Fehler statt abzustürzen', () => {
    const result = parsePgnGame('hallo welt');
    expect(result.ok).toBe(false);
  });
});

describe('splitPgn und summarizePgn', () => {
  const second =
    '[Event "Zweite"]\n[White "A"]\n[Black "B"]\n[Result "0-1"]\n\n1. f3 e5 2. g4 Qh4# 0-1';
  const third = '[Event "Dritte"]\n[Result "1/2-1/2"]\n\n1. e4 {[%clk 0:05:00]} e5 1/2-1/2';
  const file = `${operaGame}\n\n${second}\n\n\n${third}\n`;

  it('trennt mehrere Partien', () => {
    const chunks = splitPgn(file);
    expect(chunks).toHaveLength(3);
    expect(parseOk(chunks[1]!).plies).toHaveLength(4);
  });

  it('trennt nicht an Klammern in Kommentaren', () => {
    const tricky = '[Event "X"]\n\n1. e4 {Kommentar\n[Event "kein Header"]\n} e5 *';
    expect(splitPgn(tricky)).toHaveLength(1);
  });

  it('liefert eine Übersicht mit Titel-Daten, Halbzügen und Ergebnis', () => {
    const list = summarizePgn(file);
    expect(list.map((g) => [g.headers.Event, g.plyCount, g.result])).toEqual([
      ['Beispielpartie', 33, '1-0'],
      ['Zweite', 4, '0-1'],
      ['Dritte', 2, '1/2-1/2'],
    ]);
  });

  it('behandelt eine Partie ohne Header als eine Partie', () => {
    expect(splitPgn('1. e4 e5 2. Nf3 *')).toHaveLength(1);
  });
});

describe('Hilfsfunktionen', () => {
  it('headerValue blendet unbekannte Werte aus', () => {
    const headers = { Date: '????.??.??', Round: '?', Site: 'Paris', Empty: '' };
    expect(headerValue(headers, 'Date')).toBeUndefined();
    expect(headerValue(headers, 'Round')).toBeUndefined();
    expect(headerValue(headers, 'Empty')).toBeUndefined();
    expect(headerValue(headers, 'Site')).toBe('Paris');
  });

  it('movetextTokens trennt auch Zugnummern ohne Leerzeichen', () => {
    expect(movetextTokens('1.e4 e5 2.Nf3 2...Nc6 3.Bb5 a6 1-0')).toEqual([
      'e4',
      'e5',
      'Nf3',
      'Nc6',
      'Bb5',
      'a6',
    ]);
  });
});

describe('formatPgnDate', () => {
  it('formatiert bekannte und teilweise bekannte Daten', () => {
    expect(formatPgnDate('2026.10.09')).toBe('09.10.2026');
    expect(formatPgnDate('1858.??.??')).toBe('1858');
    expect(formatPgnDate('????.??.??')).toBeUndefined();
    expect(formatPgnDate(undefined)).toBeUndefined();
    expect(formatPgnDate('gestern')).toBeUndefined();
  });
});
