import { currentLocale } from '../i18n';

/** Prozentwert mit einer Nachkommastelle im Format der eingestellten Sprache, z. B. „96,1 %“ / „96.1%“. */
export function formatPercent(value: number | undefined): string {
  if (value === undefined) return '–';
  return new Intl.NumberFormat(currentLocale(), {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value / 100);
}

/** Zahl im Format der eingestellten Sprache (höchstens eine Nachkommastelle) */
export function formatNumber(value: number, options: Intl.NumberFormatOptions = {}): string {
  return new Intl.NumberFormat(currentLocale(), { maximumFractionDigits: 1, ...options }).format(
    value,
  );
}

/** Datum im Format der eingestellten Sprache */
export function formatDate(value: string | Date, options?: Intl.DateTimeFormatOptions): string {
  return new Date(value).toLocaleDateString(currentLocale(), options);
}

/** Farbe nach Genauigkeit (Zahl steht immer dabei, die Farbe ist nur zusätzlich). */
export function accuracyColor(value: number | undefined): string {
  if (value === undefined) return 'var(--sc-text-muted)';
  if (value >= 85) return 'var(--sc-success)';
  if (value >= 70) return 'var(--sc-cat-inaccuracy)';
  if (value >= 50) return 'var(--sc-cat-mistake)';
  return 'var(--sc-cat-blunder)';
}

/** Aufzählung im Format der eingestellten Sprache, z. B. „Figuren und Töne“ / „pieces and sounds“ */
export function formatList(items: string[]): string {
  return new Intl.ListFormat(currentLocale(), { type: 'conjunction' }).format(items);
}
