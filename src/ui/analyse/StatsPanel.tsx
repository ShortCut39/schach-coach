import { useTranslation } from 'react-i18next';
import type { Color, Game } from '../../chess/types';
import { PHASES, playerAccuracy } from '../../classification/accuracy';
import { countCategories } from '../../classification/stats';
import { CATEGORIES, type PlyAnalysis } from '../../classification/types';
import { CategoryIcon } from '../shared/CategoryIcon';
import { formatPercent } from '../format';

interface StatsPanelProps {
  game: Game;
  analyses: (PlyAnalysis | undefined)[];
  userColor: Color;
}

/** Kategorie × (Du / Gegner) und Genauigkeit gesamt und je Phase. */
export function StatsPanel({ game, analyses, userColor }: StatsPanelProps) {
  const { t } = useTranslation();
  const opponent: Color = userColor === 'w' ? 'b' : 'w';
  const hasData = analyses.some(Boolean);

  const mine = countCategories(game, analyses, userColor);
  const theirs = countCategories(game, analyses, opponent);
  const myAccuracy = playerAccuracy(game, analyses, userColor);
  const theirAccuracy = playerAccuracy(game, analyses, opponent);

  const headClass =
    'pb-1.5 pt-0.5 font-mono text-[11px] font-semibold tracking-[0.06em] text-faint uppercase';
  const count = (value: number) => (
    <span className={value > 0 ? 'font-semibold text-text' : 'text-faint'}>{value}</span>
  );

  return (
    <section className="rounded-panel border border-border bg-panel p-3.5">
      <h2 className="mb-2 text-sm font-bold">{t('analyse.stats.title')}</h2>
      {!hasData ? (
        <p className="text-[13px] text-muted">{t('analyse.stats.pending')}</p>
      ) : (
        <>
          <table className="w-full border-collapse text-[13px]">
            <caption className="sr-only">{t('analyse.stats.caption')}</caption>
            <thead>
              <tr>
                <th scope="col" className={`${headClass} text-left`}>
                  {t('analyse.stats.category')}
                </th>
                <th scope="col" className={`${headClass} text-right`}>
                  {t('analyse.stats.you')}
                </th>
                <th scope="col" className={`${headClass} pl-3 text-right`}>
                  {t('analyse.stats.opponent')}
                </th>
              </tr>
            </thead>
            <tbody>
              {CATEGORIES.map((category) => (
                <tr key={category} className="border-t border-divider">
                  <th scope="row" className="py-[5px] text-left font-normal">
                    <span className="flex items-center gap-2">
                      <CategoryIcon category={category} decorative />
                      {t(`categories.${category}`)}
                    </span>
                  </th>
                  <td className="py-[5px] text-right font-mono">{count(mine[category])}</td>
                  <td className="py-[5px] pl-3 text-right font-mono">{count(theirs[category])}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <table className="mt-2.5 w-full border-collapse border-t border-border font-mono text-[12.5px] font-medium text-muted">
            <tbody>
              <tr>
                <th scope="row" className="pt-2.5 text-left font-medium">
                  {t('analyse.stats.accuracy')}
                </th>
                <td className="pt-2.5 text-right font-semibold text-success">
                  {formatPercent(myAccuracy.overall)}
                </td>
                <td className="pt-2.5 pl-3 text-right">{formatPercent(theirAccuracy.overall)}</td>
              </tr>
              {PHASES.map((phase) => (
                <tr key={phase}>
                  <th scope="row" className="pt-1 pl-3 text-left font-normal text-faint">
                    {t(`phases.${phase}`)}
                  </th>
                  <td className="pt-1 text-right">{formatPercent(myAccuracy.byPhase[phase])}</td>
                  <td className="pt-1 pl-3 text-right">
                    {formatPercent(theirAccuracy.byPhase[phase])}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
