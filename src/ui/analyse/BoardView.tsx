import { Chessboard } from 'react-chessboard';
import type { CSSProperties, ReactNode } from 'react';
import type { Orientation } from '../../store/game';
import {
  squareRenderer,
  useBoardAppearance,
  type BoardAppearanceOptions,
} from '../boardAppearance';
import { LAST_MOVE_STYLE, layerSquareStyle, withCheckHighlight } from '../boardSquares';
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
  const drawing = useDrawnShapes(fen, allowDrawing);
  const marks: Record<string, CSSProperties> = { ...drawing.circles };
  if (lastMove) {
    for (const square of [lastMove.from, lastMove.to]) {
      marks[square] = layerSquareStyle(LAST_MOVE_STYLE, marks[square]);
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
          animationDurationInMs: 150,
          ...appearance,
          squareStyles,
          squareRenderer: squareRenderer(squareStyles),
        }}
      />
      {overlay}
    </div>
  );
}
