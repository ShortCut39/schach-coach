import { Chess, type Square } from 'chess.js';
import { useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Chessboard,
  type PieceDropHandlerArgs,
  type PieceHandlerArgs,
  type SquareHandlerArgs,
} from 'react-chessboard';
import { resolveBoardMove, targetSquares } from '../../training/boardMoves';
import type { Orientation } from '../../store/game';
import { useSettings } from '../../store/settings';
import { BoardOverlay, type BoardArrow } from '../analyse/BoardOverlay';
import { notationBase, prefersReducedMotion } from '../analyse/boardStyle';
import { boardColors } from '../boardThemes';

interface TrainingBoardProps {
  fen: string;
  orientation: Orientation;
  /** Darf gezogen werden? */
  interactive: boolean;
  onMove: (uci: string) => void;
  arrows: BoardArrow[];
  /** Hinweis: diese Figur zieht */
  hintSquare?: string | undefined;
  lastMove?: { from: string; to: string } | undefined;
  label: string;
  /** Kennung für react-chessboard (mehrere Bretter auf einer Seite brauchen verschiedene) */
  id?: string;
}

const PROMOTION_PIECES = ['q', 'r', 'b', 'n'] as const;

/**
 * Brett zum Lösen von Aufgaben und zum Spielen: Figuren ziehen oder anklicken (Figur, dann Zielfeld).
 * Erlaubt sind nur legale Züge (chess.js); bei einer Bauernumwandlung wird nach der Figur gefragt.
 */
export function TrainingBoard({
  fen,
  orientation,
  interactive,
  onMove,
  arrows,
  hintSquare,
  lastMove,
  label,
  id = 'training-board',
}: TrainingBoardProps) {
  const { t } = useTranslation();
  const colors = boardColors(useSettings((s) => s.boardTheme));
  const [selected, setSelected] = useState<{ fen: string; square: string } | null>(null);
  const [promotion, setPromotion] = useState<{ fen: string; from: string; to: string } | null>(
    null,
  );
  // Auswahl gilt nur für die Stellung, in der sie getroffen wurde
  const selectedSquare = selected?.fen === fen && interactive ? selected.square : null;
  const pendingPromotion = promotion?.fen === fen && interactive ? promotion : null;

  const chess = new Chess(fen);
  const turn = chess.turn();
  const targets = selectedSquare ? targetSquares(fen, selectedSquare) : [];
  const isOwn = (pieceType: string | undefined) => !!pieceType?.startsWith(turn);

  /** Versucht den Zug; `false`, wenn er nicht legal ist. */
  function attempt(from: string, to: string): boolean {
    const move = resolveBoardMove(fen, from, to);
    if (!move) return false;
    setSelected(null);
    if (move.needsPromotion) {
      setPromotion({ fen, from: move.from, to: move.to });
      return false;
    }
    onMove(move.from + move.to);
    return true;
  }

  function onSquareClick({ piece, square }: SquareHandlerArgs) {
    if (!interactive || pendingPromotion) return;
    // Zielfeld oder (bei der Rochade) der eigene Turm
    if (selectedSquare && selectedSquare !== square && attempt(selectedSquare, square)) return;
    // Eigene Figur anklicken wählt sie aus; alles andere hebt die Auswahl auf
    setSelected(isOwn(piece?.pieceType) ? { fen, square } : null);
  }

  /** Schon beim Anfassen die möglichen Felder zeigen (auch, wenn ein Klick als Ziehen beginnt). */
  function onPieceDrag({ piece, square }: PieceHandlerArgs) {
    if (interactive && square && isOwn(piece.pieceType)) setSelected({ fen, square });
  }

  function onPieceDrop({ sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean {
    if (!interactive || !targetSquare || pendingPromotion) return false;
    // Auf dasselbe Feld zurückgelegt = angeklickt: Auswahl bleibt für den Klick aufs Zielfeld
    if (targetSquare === sourceSquare) return false;
    const moved = attempt(sourceSquare, targetSquare);
    if (!moved) setSelected(null);
    return moved;
  }

  const squareStyles: Record<string, CSSProperties> = {};
  const lastMoveStyle: CSSProperties = { boxShadow: 'inset 0 0 0 999px var(--sc-last-move)' };
  if (lastMove) {
    squareStyles[lastMove.from] = lastMoveStyle;
    squareStyles[lastMove.to] = lastMoveStyle;
  }
  if (hintSquare) {
    squareStyles[hintSquare] = { boxShadow: 'inset 0 0 0 4px var(--sc-accent)' };
  }
  if (selectedSquare) {
    squareStyles[selectedSquare] = { boxShadow: 'inset 0 0 0 999px var(--sc-last-move)' };
  }
  for (const square of targets) {
    squareStyles[square] = {
      ...squareStyles[square],
      backgroundImage: chess.get(square as Square)
        ? 'radial-gradient(circle, transparent 56%, var(--sc-move-target) 58%)'
        : 'radial-gradient(circle, var(--sc-move-target) 23%, transparent 25%)',
    };
  }

  return (
    <div
      role="group"
      aria-label={label}
      className="@container relative overflow-hidden rounded-[6px] shadow-board"
    >
      <Chessboard
        options={{
          id,
          position: fen,
          boardOrientation: orientation,
          allowDragging: interactive && !pendingPromotion,
          allowDrawingArrows: false,
          canDragPiece: ({ piece }) => interactive && piece.pieceType.startsWith(turn),
          onPieceDrag,
          onPieceDrop,
          onSquareClick,
          showAnimations: !prefersReducedMotion(),
          animationDurationInMs: 150,
          lightSquareStyle: { backgroundColor: colors.light },
          darkSquareStyle: { backgroundColor: colors.dark },
          lightSquareNotationStyle: { color: colors.dark },
          darkSquareNotationStyle: { color: colors.light },
          alphaNotationStyle: { ...notationBase, position: 'absolute', bottom: '3%', right: '6%' },
          numericNotationStyle: { ...notationBase, position: 'absolute', top: '4%', left: '6%' },
          squareStyles,
        }}
      />
      <BoardOverlay orientation={orientation} arrows={arrows} />
      {pendingPromotion && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/45">
          <div
            role="dialog"
            aria-label={t('training.promotion')}
            className="flex flex-col items-center gap-2.5 rounded-panel border border-border bg-panel p-4 shadow-board"
          >
            <span className="text-sm font-semibold">{t('training.promotion')}</span>
            <div className="flex gap-2">
              {PROMOTION_PIECES.map((piece) => (
                <button
                  key={piece}
                  type="button"
                  autoFocus={piece === 'q'}
                  onClick={() => {
                    setPromotion(null);
                    onMove(pendingPromotion.from + pendingPromotion.to + piece);
                  }}
                  className="min-h-hit rounded-control border border-border-input bg-panel-sub px-3 text-[13.5px] font-semibold hover:border-accent"
                >
                  {t(`training.promotionPieces.${piece}`)}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setPromotion(null)}
              className="min-h-8 px-2 text-[12.5px] text-muted hover:text-text"
            >
              {t('training.cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
