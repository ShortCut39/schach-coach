import i18n from '../i18n';

/** Prozentwert mit einer Nachkommastelle im Format der eingestellten Sprache, z. B. „96,1 %“. */
export function formatPercent(value: number | undefined): string {
  if (value === undefined) return '–';
  const number = new Intl.NumberFormat(i18n.language, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
  return `${number} %`;
}

/** Farbe nach Genauigkeit (Zahl steht immer dabei, die Farbe ist nur zusätzlich). */
export function accuracyColor(value: number | undefined): string {
  if (value === undefined) return 'var(--sc-text-muted)';
  if (value >= 85) return 'var(--sc-success)';
  if (value >= 70) return 'var(--sc-cat-inaccuracy)';
  if (value >= 50) return 'var(--sc-cat-mistake)';
  return 'var(--sc-cat-blunder)';
}
