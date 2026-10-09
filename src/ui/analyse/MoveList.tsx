import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatMoveNumber, formatSan } from '../../chess/notation';
import type { Game, PlyBase } from '../../chess/types';
import { ERROR_CATEGORIES, GOOD_CATEGORIES, type PlyAnalysis } from '../../classification/types';
import { formatPositionEval } from '../../engine/evalFormat';
import { useGame } from '../../store/game';
import { useSettings } from '../../store/settings';
import { CategoryIcon } from '../shared/CategoryIcon';
import { buildRows } from './moveRows';
import { useCurrentEvals } from './useAnalysisFor';

const filters = ['all', 'mine', 'errors', 'good'] as const;
type Filter = (typeof filters)[number];

function matches(
  filter: Filter,
  ply: PlyBase,
  analysis: PlyAnalysis | undefined,
  userColor: string,
) {
  switch (filter) {
    case 'all':
      return true;
    case 'mine':
      return ply.color === userColor;
    case 'errors':
      return analysis !== undefined && ERROR_CATEGORIES.has(analysis.category);
    case 'good':
      return analysis !== undefined && GOOD_CATEGORIES.has(analysis.category);
  }
}

interface MoveListProps {
  game: Game;
  analyses: (PlyAnalysis | undefined)[];
}

export function MoveList({ game, analyses }: MoveListProps) {
  const { t } = useTranslation();
  const current = useGame((s) => s.current);
  const goTo = useGame((s) => s.goTo);
  const userColor = useGame((s) => s.userColor);
  const notation = useSettings((s) => s.notation);
  const evals = useCurrentEvals();
  const [filter, setFilter] = useState<Filter>('all');
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [current]);

  const isMatch = (ply: PlyBase | undefined) =>
    ply !== undefined && matches(filter, ply, analyses[ply.index], userColor);
  const rows = buildRows(game.plies).filter((row) => isMatch(row.white) || isMatch(row.black));

  function cell(ply: PlyBase | undefined) {
    if (!ply) return <span className="min-h-8" />;
    const active = ply.index === current;
    const dimmed = !isMatch(ply);
    const san = formatSan(ply.san, notation);
    const analysis = analyses[ply.index];
    // Bewertung der Stellung nach dem Zug (Index Halbzug + 1), Weiß-Sicht
    const evalText = formatPositionEval(evals[ply.index + 1]);
    const isMate = evalText?.includes('M') || evalText === '#';
    const move = `${formatMoveNumber(ply.moveNumber, ply.color)} ${san}`;
    return (
      <button
        ref={active ? activeRef : undefined}
        type="button"
        onClick={() => goTo(ply.index)}
        aria-current={active ? 'step' : undefined}
        aria-label={
          analysis
            ? t('analyse.moves.cellLabel', { move, category: t(`categories.${analysis.category}`) })
            : move
        }
        className={`flex min-h-8 items-center gap-1.5 rounded-[7px] px-1.5 text-left text-[13px] font-semibold ${
          active
            ? 'bg-move-active-bg text-white ring-1 ring-move-active-ring ring-inset'
            : 'text-body hover:bg-accent-bg'
        } ${dimmed ? 'opacity-35' : ''}`}
      >
        <span>{san}</span>
        {analysis && <CategoryIcon category={analysis.category} decorative />}
        {evalText && (
          <span
            className={`ml-auto font-mono text-[11px] font-medium ${
              active || isMate ? 'text-accent-text' : 'text-muted'
            }`}
          >
            {evalText}
          </span>
        )}
      </button>
    );
  }

  return (
    <section className="rounded-panel border border-border bg-panel px-3.5 pt-3.5 pb-2.5">
      <div className="mb-2.5 flex items-baseline justify-between">
        <h2 className="text-sm font-bold">{t('analyse.moves.title')}</h2>
        <span className="font-mono text-[11.5px] font-medium text-muted">
          {t('analyse.moves.evalHint')}
        </span>
      </div>
      <div
        role="group"
        aria-label={t('analyse.moves.filterLabel')}
        className="mb-2.5 flex flex-wrap gap-1.5"
      >
        {filters.map((id) => {
          const active = id === filter;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(id)}
              className={`min-h-8 rounded-full border px-3 text-[12.5px] ${
                active
                  ? 'border-border-accent bg-accent-bg font-semibold text-accent-text'
                  : 'border-border-chip font-medium text-muted hover:text-text'
              }`}
            >
              {t(`analyse.moves.filters.${id}`)}
            </button>
          );
        })}
      </div>
      <div role="table" aria-label={t('analyse.moves.tableLabel')}>
        <div
          role="row"
          className="grid grid-cols-[26px_minmax(0,1fr)_minmax(0,1fr)] gap-1 pb-1 font-mono text-[11px] font-semibold tracking-[0.06em] text-faint uppercase"
        >
          <span role="columnheader">{t('analyse.moves.number')}</span>
          <span role="columnheader" className="pl-1.5">
            {t('analyse.moves.white')}
          </span>
          <span role="columnheader" className="pl-1.5">
            {t('analyse.moves.black')}
          </span>
        </div>
        <div className="max-h-[max(320px,calc(100vh-190px))] overflow-y-auto">
          {rows.map((row) => (
            <div
              role="row"
              key={`${row.moveNumber}-${row.white?.index ?? row.black?.index}`}
              className="grid grid-cols-[26px_minmax(0,1fr)_minmax(0,1fr)] items-center gap-1 py-px"
            >
              <span role="cell" className="font-mono text-xs font-medium text-faint">
                {row.moveNumber}
              </span>
              <span role="cell" className="flex flex-col">
                {cell(row.white)}
              </span>
              <span role="cell" className="flex flex-col">
                {cell(row.black)}
              </span>
            </div>
          ))}
          {rows.length === 0 && (
            <p className="py-3 text-center text-[13px] text-faint">
              {t('analyse.moves.filterEmpty')}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
