import { Chessboard } from 'react-chessboard';
import type { CSSProperties, ReactNode } from 'react';
import type { Orientation } from '../../store/game';
import { useSettings } from '../../store/settings';
import { boardColors } from '../boardThemes';

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

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Nur-Anzeige-Brett (kein Ziehen). Figuren: SVG-Satz von react-chessboard. */
export function BoardView({ fen, orientation, lastMove, label, overlay }: BoardViewProps) {
  const colors = boardColors(useSettings((s) => s.boardTheme));
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
      {overlay}
    </div>
  );
}
