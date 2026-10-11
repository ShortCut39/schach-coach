import { Chessboard } from 'react-chessboard';
import type { CSSProperties, ReactNode } from 'react';
import { prefersReducedMotion } from './boardStyle';
import type { Orientation } from '../../store/game';
import { useBoardAppearance, type BoardAppearanceOptions } from '../boardAppearance';
import { layerSquareStyle, withCheckHighlight } from '../boardSquares';
import { useDrawnShapes } from '../drawnShapes';

interface BoardViewProps {
  fen: string;
  orientation: Orientation;
  /** Felder des zuletzt gespielten Zugs, z. B. `{ from: 'b3', to: 'b8' }` */
  lastMove?: { from: string; to: string } | undefined;
  label: string;
  overlay?: ReactNode;
  /** Kennung für react-chessboard (mehrere Bretter brauchen verschiedene) */
  id?: string;
  /** Andere Darstellung als die gespeicherte (Vorschau in den Einstellungen) */
  appearance?: BoardAppearanceOptions;
  /** Eigene Pfeile und Kreise per Rechtsklick (aus bei der Vorschau) */
  allowDrawing?: boolean;
}

/**
 * Nur-Anzeige-Brett (kein Ziehen). Figuren, Felder und Koordinaten aus der Darstellung; eigene
 * Pfeile und Kreise per Rechtsklick zum Planen.
 */
export function BoardView({
  fen,
  orientation,
  lastMove,
  label,
  overlay,
  id = 'analyse-board',
  appearance: override,
  allowDrawing = true,
}: BoardViewProps) {
  const saved = useBoardAppearance();
  const appearance = override ?? saved;
  const highlight: CSSProperties = { boxShadow: 'inset 0 0 0 999px var(--sc-last-move)' };
  const drawing = useDrawnShapes(fen, allowDrawing);
  const marks: Record<string, CSSProperties> = { ...drawing.circles };
  if (lastMove) {
    for (const square of [lastMove.from, lastMove.to]) {
      marks[square] = layerSquareStyle(highlight, marks[square]);
    }
  }
  const squareStyles = withCheckHighlight(fen, marks);

  return (
    <div
      role="img"
      aria-label={label}
      className="@container relative overflow-hidden rounded-[6px] shadow-board"
    >
      <Chessboard
        options={{
          id,
          position: fen,
          boardOrientation: orientation,
          allowDragging: false,
          ...drawing.options,
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
