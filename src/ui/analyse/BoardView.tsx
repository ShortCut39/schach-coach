import { Chessboard } from 'react-chessboard';
import type { CSSProperties, ReactNode } from 'react';
import type { Orientation } from '../../store/game';

interface BoardViewProps {
  fen: string;
  orientation: Orientation;
  /** Felder des zuletzt gespielten Zugs, z. B. `{ from: 'b3', to: 'b8' }` */
  lastMove?: { from: string; to: string } | undefined;
  label: string;
  overlay?: ReactNode;
}

const notationBase: CSSProperties = {
  fontFamily: 'var(--sc-font-mono)',
  fontWeight: 600,
  fontSize: 'clamp(9px, 1.9cqw, 13px)',
  userSelect: 'none',
};

/** Nur-Anzeige-Brett (kein Ziehen). Figuren: SVG-Satz von react-chessboard. */
export function BoardView({ fen, orientation, lastMove, label, overlay }: BoardViewProps) {
  const highlight: CSSProperties = { boxShadow: 'inset 0 0 0 999px var(--sc-last-move)' };
  const squareStyles: Record<string, CSSProperties> = lastMove
    ? { [lastMove.from]: highlight, [lastMove.to]: highlight }
    : {};

  return (
    <div
      role="img"
      aria-label={label}
      className="@container relative overflow-hidden rounded-[6px] shadow-board"
    >
      <Chessboard
        options={{
          id: 'analyse-board',
          position: fen,
          boardOrientation: orientation,
          allowDragging: false,
          allowDrawingArrows: false,
          showAnimations: true,
          animationDurationInMs: 150,
          lightSquareStyle: { backgroundColor: 'var(--sc-board-light)' },
          darkSquareStyle: { backgroundColor: 'var(--sc-board-dark)' },
          lightSquareNotationStyle: { color: 'var(--sc-board-coord-on-light)' },
          darkSquareNotationStyle: { color: 'var(--sc-board-coord-on-dark)' },
          alphaNotationStyle: { ...notationBase, position: 'absolute', bottom: '3%', right: '6%' },
          numericNotationStyle: { ...notationBase, position: 'absolute', top: '4%', left: '6%' },
          squareStyles,
        }}
      />
      {overlay}
    </div>
  );
}
