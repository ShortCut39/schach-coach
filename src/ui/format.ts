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
