import type { Category } from '../classification/types';

/** Symbol je Kategorie (eigene Icons, nicht die von Chess.com). Farbe allein trägt nie die Bedeutung. */
export const CATEGORY_SYMBOL: Record<Category, string> = {
  brilliant: '!!',
  great: '!',
  best: '★',
  excellent: '✓',
  good: '+',
  book: 'T',
  inaccuracy: '?!',
  mistake: '?',
  blunder: '??',
  miss: '×',
};

/** CSS-Variablen aus tokens.css */
export function categoryColors(category: Category): { background: string; color: string } {
  return { background: `var(--sc-cat-${category})`, color: `var(--sc-cat-${category}-fg)` };
}
