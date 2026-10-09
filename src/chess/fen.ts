import { validateFen } from 'chess.js';
import type { Color, FenErrorReason, ParseResult, Position } from './types';

const FEN_DEFAULTS = ['w', '-', '-', '0', '1'] as const;

/**
 * Ergänzt fehlende hintere FEN-Felder mit Standardwerten
 * (Weiß am Zug, keine Rochaderechte, kein en passant, Zähler 0/1).
 * Viele Seiten kopieren nur die Figurenstellung oder Stellung + Zugrecht.
 */
export function normalizeFen(input: string): string {
  const fields = input.trim().split(/\s+/).filter(Boolean);
  if (fields.length === 0 || fields.length >= 6) return fields.join(' ');
  return [...fields, ...FEN_DEFAULTS.slice(fields.length - 1)].join(' ');
}

/** Ordnet die englische Fehlermeldung von chess.js einem stabilen Grund zu. */
function reasonFromMessage(message: string): FenErrorReason {
  const m = message.toLowerCase();
  if (m.includes('six space-delimited')) return 'fields';
  if (m.includes('king')) return 'kings';
  if (m.includes('pawns')) return 'pawns';
  if (m.includes('piece data') || m.includes('rows') || m.includes('rank')) return 'board';
  if (m.includes('side-to-move')) return 'turn';
  if (m.includes('castling')) return 'castling';
  if (m.includes('en-passant')) return 'enPassant';
  if (m.includes('move number') || m.includes('half move')) return 'counters';
  return 'other';
}

export function parseFen(input: string): ParseResult<Position> {
  if (input.trim() === '') return { ok: false, error: { code: 'empty' } };
  const fen = normalizeFen(input);
  const check = validateFen(fen);
  if (!check.ok) {
    return { ok: false, error: { code: 'fen', reason: reasonFromMessage(check.error ?? '') } };
  }
  const turn = fen.split(' ')[1] as Color;
  return { ok: true, value: { kind: 'position', fen, turn } };
}
