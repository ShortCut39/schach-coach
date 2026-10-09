import type { MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { positionWhiteWinChance } from '../../classification/winChance';
import type { PositionEval } from '../../engine/types';
import { useAnalysis } from '../../store/analysis';
import { AnalysisProgress } from './AnalysisProgress';

interface EvalGraphProps {
  evals: (PositionEval | undefined)[];
  /** Anzahl Halbzüge der Partie (Stellungen = Halbzüge + 1) */
  plyCount: number;
  /** Aktuell angezeigter Halbzug, -1 = Ausgangsstellung */
  current: number;
  onSelect: (plyIndex: number) => void;
}

/**
 * Bewertungsverlauf: helle Fläche = Weiß im Vorteil (Gewinnchance von Weiß),
 * gestrichelte Mittellinie = ausgeglichen, senkrechter Strich = aktuelle Stellung.
 */
export function EvalGraph({ evals, plyCount, current, onSelect }: EvalGraphProps) {
  const { t } = useTranslation();
  const status = useAnalysis((s) => s.status);
  const span = Math.max(plyCount, 1);
  const x = (index: number) => (index / span) * 100;

  const points = evals.flatMap((evaluation, index) => {
    const win = positionWhiteWinChance(evaluation);
    return win === undefined ? [] : [{ x: x(index), y: 100 - win }];
  });
  const first = points[0];
  const last = points.at(-1);
  const line = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' ');
  const area = first && last ? `M${first.x} 100 ${line.replace(/^M/, 'L')} L${last.x} 100 Z` : '';

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;
    const fraction = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
    onSelect(Math.round(fraction * span) - 1);
  }

  return (
    <section
      aria-labelledby="eval-graph-title"
      className="flex flex-col gap-2 rounded-panel border border-border bg-panel px-3.5 pt-3 pb-3.5"
    >
      <div className="flex min-h-8 flex-wrap items-center justify-between gap-2">
        <h2 id="eval-graph-title" className="text-sm font-bold">
          {t('analyse.graph.title')}
        </h2>
        <span className="font-mono text-[11.5px] font-medium text-muted">
          {status === 'running' || status === 'aborted' || status === 'error' ? (
            <AnalysisProgress />
          ) : (
            t('analyse.graph.plies', { count: plyCount })
          )}
        </span>
      </div>
      <div
        role="img"
        aria-label={t('analyse.graph.label', { count: plyCount })}
        onClick={handleClick}
        className="relative h-[110px] cursor-pointer overflow-hidden rounded-small bg-bg"
      >
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
          className="absolute inset-0 size-full"
        >
          {area && <path d={area} fill="var(--sc-graph-area)" opacity="0.9" />}
          <line
            x1="0"
            y1="50"
            x2="100"
            y2="50"
            stroke="var(--sc-graph-midline)"
            strokeWidth="1"
            strokeDasharray="4 4"
            vectorEffect="non-scaling-stroke"
          />
          {line && (
            <path
              d={line}
              fill="none"
              stroke="var(--sc-accent)"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
        <div
          aria-hidden="true"
          className="absolute inset-y-0 w-0.5 bg-graph-cursor"
          style={{ left: `calc(${x(current + 1)}% - 1px)` }}
        />
        {points.length === 0 && (
          <p className="absolute inset-0 flex items-center justify-center px-4 text-center text-[13px] text-faint">
            {t('analyse.graph.empty')}
          </p>
        )}
      </div>
    </section>
  );
}
