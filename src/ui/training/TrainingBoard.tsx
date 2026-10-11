import { Chess, type Square } from 'chess.js';
import {
  memo,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Chessboard,
  type PieceDropHandlerArgs,
  type PieceHandlerArgs,
  type SquareHandlerArgs,
} from 'react-chessboard';
import { resolveBoardMove, targetSquares } from '../../training/boardMoves';
import type { Orientation } from '../../store/game';
import { BoardOverlay, type BoardArrow } from '../analyse/BoardOverlay';
import { squareRenderer, useBoardAppearance } from '../boardAppearance';
import { LAST_MOVE_STYLE, layerSquareStyle, withCheckHighlight } from '../boardSquares';
import { useDrawnShapes } from '../drawnShapes';

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
/**
 * Das Brett baut sich nur neu auf, wenn sich Stellung, Pfeile, Markierungen oder Zustand wirklich
 * ändern (WebKitGTK braucht dafür spürbar Zeit). Neue Routinen oder gleich aussehende Pfeil- und
 * Zug-Objekte der Seite lösen keinen Neuaufbau aus; die Routine für Züge kommt aus einer Ref.
 */
export function TrainingBoard(props: TrainingBoardProps) {
  const { onMove, arrows, lastMove } = props;
  const onMoveRef = useRef(onMove);
  useLayoutEffect(() => {
    onMoveRef.current = onMove;
  });
  const stableOnMove = useCallback((uci: string) => onMoveRef.current(uci), []);
  const arrowsKey = JSON.stringify(arrows);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Inhalt statt Identität
  const stableArrows = useMemo(() => arrows, [arrowsKey]);
  const from = lastMove?.from;
  const to = lastMove?.to;
  const stableLastMove = useMemo(() => (from && to ? { from, to } : undefined), [from, to]);
  return (
    <MemoBoard {...props} onMove={stableOnMove} arrows={stableArrows} lastMove={stableLastMove} />
  );
}

const MemoBoard = memo(function MemoBoard({
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
  const appearance = useBoardAppearance();
  const drawing = useDrawnShapes(fen);
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

  /**
   * Aktueller Stand für die Ereignis-Routinen. react-chessboard merkt sich die Routine für den
   * Ziehbeginn nur neu, wenn sich die Stellung ändert (`useCallback(…, [currentPosition])`). Ohne
   * diese Referenz sähe sie z. B. beim ersten Zug als Weiß noch „Ziehen nicht erlaubt“ aus der
   * Zeit vor dem Partiestart, und es erschienen keine Zielfelder.
   */
  const latest = useRef({ fen, interactive, pendingPromotion, selectedSquare, onMove });
  useLayoutEffect(() => {
    latest.current = { fen, interactive, pendingPromotion, selectedSquare, onMove };
  });

  /** Versucht den Zug; `false`, wenn er nicht legal ist. */
  function attempt(from: string, to: string): boolean {
    const { fen: current, onMove: move } = latest.current;
    const resolved = resolveBoardMove(current, from, to);
    if (!resolved) return false;
    setSelected(null);
    if (resolved.needsPromotion) {
      setPromotion({ fen: current, from: resolved.from, to: resolved.to });
      return false;
    }
    move(resolved.from + resolved.to);
    return true;
  }

  /** Gehört die Figur der Seite am Zug (in der aktuellen Stellung)? */
  function isOwn(pieceType: string | undefined): boolean {
    return !!pieceType?.startsWith(new Chess(latest.current.fen).turn());
  }

  function onSquareClick({ piece, square }: SquareHandlerArgs) {
    const {
      interactive: canMove,
      pendingPromotion: pending,
      selectedSquare: from,
      fen: current,
    } = latest.current;
    if (!canMove || pending) return;
    // Zielfeld oder (bei der Rochade) der eigene Turm
    if (from && from !== square && attempt(from, square)) return;
    // Eigene Figur anklicken wählt sie aus; alles andere hebt die Auswahl auf
    setSelected(isOwn(piece?.pieceType) ? { fen: current, square } : null);
  }

  /** Schon beim Anfassen die möglichen Felder zeigen (auch, wenn ein Klick als Ziehen beginnt). */
  function onPieceDrag({ piece, square }: PieceHandlerArgs) {
    const { interactive: canMove, fen: current } = latest.current;
    if (canMove && square && isOwn(piece.pieceType)) setSelected({ fen: current, square });
  }

  function onPieceDrop({ sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean {
    const { interactive: canMove, pendingPromotion: pending } = latest.current;
    if (!canMove || !targetSquare || pending) return false;
    // Auf dasselbe Feld zurückgelegt = angeklickt: Auswahl bleibt für den Klick aufs Zielfeld
    if (targetSquare === sourceSquare) return false;
    const moved = attempt(sourceSquare, targetSquare);
    if (!moved) setSelected(null);
    return moved;
  }

  const squareStyles: Record<string, CSSProperties> = {};
  if (lastMove) {
    squareStyles[lastMove.from] = LAST_MOVE_STYLE;
    squareStyles[lastMove.to] = LAST_MOVE_STYLE;
  }
  if (hintSquare) {
    squareStyles[hintSquare] = { boxShadow: 'inset 0 0 0 4px var(--sc-accent)' };
  }
  if (selectedSquare) {
    squareStyles[selectedSquare] = LAST_MOVE_STYLE;
  }
  for (const square of targets) {
    squareStyles[square] = {
      ...squareStyles[square],
      backgroundImage: chess.get(square as Square)
        ? 'radial-gradient(circle, transparent 56%, var(--sc-move-target) 58%)'
        : 'radial-gradient(circle, var(--sc-move-target) 23%, transparent 25%)',
    };
  }

  // Eigene Kreise (Rechtsklick) unter den übrigen Markierungen
  for (const [square, circle] of Object.entries(drawing.circles)) {
    squareStyles[square] = layerSquareStyle(squareStyles[square] ?? {}, circle);
  }
  const styles = withCheckHighlight(fen, squareStyles);

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
          ...drawing.options,
          canDragPiece: ({ piece }) => interactive && piece.pieceType.startsWith(turn),
          onPieceDrag,
          onPieceDrop,
          onSquareClick,
          animationDurationInMs: 150,
          ...appearance,
          squareStyles: styles,
          squareRenderer: squareRenderer(styles),
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
});
