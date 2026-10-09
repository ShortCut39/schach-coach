import { useTranslation } from 'react-i18next';
import type { Category } from '../../classification/types';
import { CATEGORY_SYMBOL, categoryColors } from '../categoryStyle';

interface CategoryIconProps {
  category: Category;
  /** Durchmesser in px */
  size?: number;
  /** Ohne Beschriftung für Screenreader, wenn der Name daneben steht */
  decorative?: boolean;
}

/** Rundes Kategorie-Icon mit Symbol (z. B. „!!“) in der Kategoriefarbe. */
export function CategoryIcon({ category, size = 16, decorative = false }: CategoryIconProps) {
  const { t } = useTranslation();
  const name = t(`categories.${category}`);
  return (
    <span
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : name}
      aria-hidden={decorative ? true : undefined}
      title={name}
      className="inline-flex shrink-0 items-center justify-center rounded-full leading-none font-bold"
      style={{
        ...categoryColors(category),
        width: size,
        height: size,
        fontSize: Math.round(size * 0.56),
        letterSpacing: '-0.04em',
      }}
    >
      {CATEGORY_SYMBOL[category]}
    </span>
  );
}
