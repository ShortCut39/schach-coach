import { Chessboard } from 'react-chessboard';
import type { CSSProperties, ReactNode } from 'react';
import { prefersReducedMotion } from './boardStyle';
import type { Orientation } from '../../store/game';
import { useBoardAppearance } from '../boardAppearance';
import { withCheckHighlight } from '../boardSquares';

interface BoardViewProps {
  fen: string;
  orientation: Orientation;
  /** Felder des zuletzt gespielten Zugs, z. B. `{ from: 'b3', to: 'b8' }` */
  lastMove?: { from: string; to: string } | undefined;
  label: string;
  overlay?: ReactNode;
}

/** Nur-Anzeige-Brett (kein Ziehen). Figuren, Felder und Koordinaten aus der Darstellung. */
export function BoardView({ fen, orientation, lastMove, label, overlay }: BoardViewProps) {
  const appearance = useBoardAppearance();
  const highlight: CSSProperties = { boxShadow: 'inset 0 0 0 999px var(--sc-last-move)' };
  const squareStyles = withCheckHighlight(
    fen,
    lastMove ? { [lastMove.from]: highlight, [lastMove.to]: highlight } : {},
  );

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
          showAnimations: !prefersReducedMotion(),
          animationDurationInMs: 150,
          ...appearance,
          squareStyles,
        }}
      />
      {overlay}
    </div>
  );
}
