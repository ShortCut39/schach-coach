export type InputKind = 'empty' | 'fen' | 'pgn';

/** Figurenstellung einer FEN: 8 Reihen, getrennt durch `/`. */
const FEN_BOARD = /^([1-8pnbrqkPNBRQK]+\/){7}[1-8pnbrqkPNBRQK]+$/;

/** Rät, ob ein eingefügter Text eine FEN oder eine PGN ist. */
export function detectInput(text: string): InputKind {
  const trimmed = text.trim();
  if (trimmed === '') return 'empty';
  const firstField = trimmed.split(/\s+/)[0] ?? '';
  if (!trimmed.includes('\n') && FEN_BOARD.test(firstField)) return 'fen';
  return 'pgn';
}
