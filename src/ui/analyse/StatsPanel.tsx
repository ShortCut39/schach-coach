import { useTranslation } from 'react-i18next';
import type { Color, Game } from '../../chess/types';
import { PHASES, playerAccuracy } from '../../classification/accuracy';
import { countCategories } from '../../classification/stats';
import type { PlyAnalysis } from '../../classification/types';
import { CategoryTable } from './CategoryTable';
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

  return (
    <section className="rounded-panel border border-border bg-panel p-3.5">
      <h2 className="mb-2 text-sm font-bold">{t('analyse.stats.title')}</h2>
      {!hasData ? (
        <p className="text-[13px] text-muted">{t('analyse.stats.pending')}</p>
      ) : (
        <>
          <CategoryTable mine={mine} theirs={theirs} />

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
