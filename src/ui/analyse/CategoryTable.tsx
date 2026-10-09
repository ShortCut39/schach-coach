import { useTranslation } from 'react-i18next';
import type { CategoryCounts } from '../../classification/stats';
import { CATEGORIES } from '../../classification/types';
import { CategoryIcon } from '../shared/CategoryIcon';

interface CategoryTableProps {
  mine: CategoryCounts;
  theirs: CategoryCounts;
}

/** Tabelle Kategorie × (Du / Gegner). */
export function CategoryTable({ mine, theirs }: CategoryTableProps) {
  const { t } = useTranslation();
  const headClass =
    'pb-1.5 pt-0.5 font-mono text-[11px] font-semibold tracking-[0.06em] text-faint uppercase';
  const count = (value: number) => (
    <span className={value > 0 ? 'font-semibold text-text' : 'text-faint'}>{value}</span>
  );
  return (
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
  );
}
