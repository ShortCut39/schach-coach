import { useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import type { ChessboardOptions } from 'react-chessboard';

/**
 * Eigene Markierungen wie bei Lichess, um Züge zu planen: Rechtsklick und Ziehen zeichnet einen
 * Pfeil (react-chessboard), ein Rechtsklick auf ein Feld einen Kreis. Farbe: grün, mit Umschalt rot,
 * mit Strg blau, mit Alt gelb (Alt+Ziehen nimmt unter KDE oft der Fenstermanager). Ein Linksklick
 * oder ein neuer Zug löscht alles. Reine Zeichnung ohne Engine, daher auch in Live-Partien erlaubt
 * (Lichess bietet dasselbe an).
 */
export const SHAPE_COLORS = {
  default: '#15781b',
  shift: '#882020',
  ctrl: '#003088',
  alt: '#e68f00',
  meta: '#e68f00',
} as const;

type Modifiers = Pick<MouseEvent, 'shiftKey' | 'ctrlKey' | 'altKey' | 'metaKey'>;

/** Farbe nach gedrückten Tasten (gleiche Reihenfolge wie react-chessboard bei Pfeilen) */
export function shapeColor(modifiers: Modifiers): string {
  if (modifiers.altKey) return SHAPE_COLORS.alt;
  if (modifiers.shiftKey) return SHAPE_COLORS.shift;
  if (modifiers.ctrlKey) return SHAPE_COLORS.ctrl;
  if (modifiers.metaKey) return SHAPE_COLORS.meta;
  return SHAPE_COLORS.default;
}

/** Kreis am Feldrand (als Hintergrund, damit er sich mit anderen Markierungen verträgt) */
export function circleStyle(color: string): CSSProperties {
  return {
    backgroundImage: `radial-gradient(circle, transparent 61%, ${color}d0 63%, ${color}d0 71%, transparent 73%)`,
  };
}

export type DrawingOptions = Pick<
  ChessboardOptions,
  | 'allowDrawingArrows'
  | 'arrowOptions'
  | 'clearArrowsOnClick'
  | 'clearArrowsOnPositionChange'
  | 'onSquareMouseDown'
  | 'onSquareMouseUp'
>;

/**
 * Zeichnen auf einem Brett. Liefert die Optionen für react-chessboard und die Kreise als
 * Feld-Stile (`circles`), die das Brett über seine übrigen Markierungen legt.
 */
export function useDrawnShapes(
  fen: string,
  enabled = true,
): { options: DrawingOptions; circles: Record<string, CSSProperties> } {
  const [state, setState] = useState<{ fen: string; circles: Record<string, string> }>({
    fen,
    circles: {},
  });
  /** Feld und Tasten beim Drücken der rechten Maustaste */
  const pressed = useRef<{ square: string; modifiers: Modifiers } | null>(null);
  // Aktuelle Stellung für die Routinen (react-chessboard kann ältere Routinen aufrufen)
  const currentFen = useRef(fen);
  useLayoutEffect(() => {
    currentFen.current = fen;
  });
  // Neue Stellung: Kreise weg (wie die Pfeile)
  const circles = state.fen === fen ? state.circles : {};

  if (!enabled) return { options: { allowDrawingArrows: false }, circles: {} };

  return {
    options: {
      allowDrawingArrows: true,
      clearArrowsOnClick: true,
      clearArrowsOnPositionChange: true,
      arrowOptions: {
        // Standardwerte von react-chessboard, nur die Farben wie bei Lichess
        colors: SHAPE_COLORS,
        color: SHAPE_COLORS.default,
        secondaryColor: SHAPE_COLORS.shift,
        tertiaryColor: SHAPE_COLORS.ctrl,
        arrowLengthReducerDenominator: 8,
        sameTargetArrowLengthReducerDenominator: 4,
        arrowWidthDenominator: 5,
        activeArrowWidthMultiplier: 0.9,
        opacity: 0.75,
        activeOpacity: 0.55,
        arrowStartOffset: 0,
      },
      // Kreis = rechte Taste auf demselben Feld gedrückt und losgelassen. Nicht über `contextmenu`:
      // das kommt unter Linux schon beim Drücken, also auch zu Beginn jedes Pfeils.
      onSquareMouseDown: ({ square }, event) => {
        if (event.button === 2) {
          pressed.current = {
            square,
            modifiers: {
              shiftKey: event.shiftKey,
              ctrlKey: event.ctrlKey,
              altKey: event.altKey,
              metaKey: event.metaKey,
            },
          };
        } else if (event.button === 0) {
          pressed.current = null;
          setState({ fen: currentFen.current, circles: {} });
        }
      },
      onSquareMouseUp: ({ square }, event) => {
        if (event.button !== 2) return;
        const start = pressed.current;
        pressed.current = null;
        if (start?.square !== square) return;
        const color = shapeColor(start.modifiers);
        const at = currentFen.current;
        setState((current) => {
          const before = current.fen === at ? current.circles : {};
          // Gleicher Kreis nochmal: weg; andere Farbe: umfärben
          const rest = Object.fromEntries(Object.entries(before).filter(([sq]) => sq !== square));
          return {
            fen: at,
            circles: before[square] === color ? rest : { ...rest, [square]: color },
          };
        });
      },
    },
    circles: Object.fromEntries(
      Object.entries(circles).map(([square, color]) => [square, circleStyle(color)]),
    ),
  };
}
