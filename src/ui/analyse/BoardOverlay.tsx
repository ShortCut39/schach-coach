import type { Category } from '../../classification/types';
import type { Orientation } from '../../store/game';
import { CATEGORY_SYMBOL, categoryColors } from '../categoryStyle';
import { arrowGeometry, badgeCenter, BOARD_SIZE } from './boardGeometry';

export type ArrowKind = 'played' | 'best' | 'reply' | 'continuation';

export interface BoardArrow {
  kind: ArrowKind;
  from: string;
  to: string;
}

const ARROW_COLOR: Record<ArrowKind, string> = {
  played: 'var(--sc-arrow-played)',
  best: 'var(--sc-arrow-best)',
  continuation: 'var(--sc-arrow-best)',
  reply: 'var(--sc-arrow-reply)',
};

interface BoardOverlayProps {
  orientation: Orientation;
  arrows: BoardArrow[];
  badge?: { square: string; category: Category } | undefined;
}

const BADGE_RADIUS = 26;

/**
 * SVG-Ebene über dem Brett (klickt nicht mit): gespielter Zug als durchgezogener Pfeil,
 * Bestzug/Fortsetzung und Gegner-Antwort gepunktet, Kategorie-Badge oben rechts im Zielfeld.
 * Rein dekorativ; die Bedeutung steht im Label des Bretts und in der Zugliste.
 */
export function BoardOverlay({ orientation, arrows, badge }: BoardOverlayProps) {
  const badgePos = badge && badgeCenter(badge.square, orientation, BADGE_RADIUS);
  return (
    <svg
      viewBox={`0 0 ${BOARD_SIZE} ${BOARD_SIZE}`}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-10 size-full"
    >
      {arrows.map((arrow) => {
        const g = arrowGeometry(arrow.from, arrow.to, orientation);
        const color = ARROW_COLOR[arrow.kind];
        const solid = arrow.kind === 'played';
        return (
          <g key={`${arrow.kind}-${arrow.from}-${arrow.to}`} opacity={0.92}>
            <line
              x1={g.x1}
              y1={g.y1}
              x2={g.x2}
              y2={g.y2}
              stroke={color}
              strokeWidth={solid ? 20 : 12}
              strokeLinecap="round"
              strokeDasharray={solid ? undefined : '2 20'}
            />
            <polygon points={g.head} fill={color} />
          </g>
        );
      })}
      {badge && badgePos && (
        <g>
          <circle
            cx={badgePos.x}
            cy={badgePos.y}
            r={BADGE_RADIUS}
            fill={categoryColors(badge.category).background}
            stroke="var(--sc-bg)"
            strokeWidth={4}
          />
          <text
            x={badgePos.x}
            y={badgePos.y + 10}
            textAnchor="middle"
            fontFamily="var(--sc-font-sans)"
            fontSize={CATEGORY_SYMBOL[badge.category].length > 1 ? 26 : 30}
            fontWeight={700}
            fill={categoryColors(badge.category).color}
          >
            {CATEGORY_SYMBOL[badge.category]}
          </text>
        </g>
      )}
    </svg>
  );
}
