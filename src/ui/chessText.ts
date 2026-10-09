import type { TFunction } from 'i18next';
import { formatMoveNumber } from '../chess/notation';
import type { ChessError, Color, GameResult } from '../chess/types';

/** Übersetzt einen Fehlercode aus `chess/` in einen verständlichen Satz. */
export function chessErrorMessage(t: TFunction, error: ChessError): string {
  switch (error.code) {
    case 'empty':
      return t('import.errors.empty');
    case 'noMoves':
      return t('import.errors.noMoves');
    case 'syntax':
      return t('import.errors.syntax');
    case 'illegalMove':
      return t('import.errors.illegalMove', {
        move: formatMoveNumber(error.moveNumber, error.color),
        color: colorName(t, error.color),
        san: error.san,
      });
    case 'fen':
      return t(`import.errors.fen.${error.reason}`);
  }
}

export function colorName(t: TFunction, color: Color): string {
  return color === 'w' ? t('common.white') : t('common.black');
}

export function resultText(t: TFunction, result: GameResult): string {
  return result === '*' ? t('common.resultOpen') : result;
}
