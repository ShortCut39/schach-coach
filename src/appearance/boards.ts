import { BUILTIN } from './types';

/** So sieht ein Brett aus: zwei Feldfarben oder ein Bild, das über alle 64 Felder gelegt wird */
export type BoardLook =
  { kind: 'colors'; light: string; dark: string } | { kind: 'image'; url: string };

/** Schlüssel des Namens unter `appearance.boards.*` in den Sprachdateien */
export type BoardNameKey = 'app' | 'wood' | 'sage' | 'brown' | 'blue' | 'green' | 'grey' | 'purple';

export interface BuiltinBoardTheme {
  id: string;
  nameKey: BoardNameKey;
  look: BoardLook & { kind: 'colors' };
}

const colors = (light: string, dark: string) => ({ kind: 'colors' as const, light, dark });

/** „App-Standard“ und die beiden bisherigen Bretter nutzen die Design-Tokens (tokens.css). */
export const DEFAULT_BOARD_THEME = `${BUILTIN}app`;

export const BUILTIN_BOARD_THEMES: readonly BuiltinBoardTheme[] = [
  {
    id: DEFAULT_BOARD_THEME,
    nameKey: 'app',
    look: colors('var(--sc-board-light)', 'var(--sc-board-dark)'),
  },
  {
    id: `${BUILTIN}wood`,
    nameKey: 'wood',
    look: colors('var(--sc-board-wood-light)', 'var(--sc-board-wood-dark)'),
  },
  {
    id: `${BUILTIN}sage`,
    nameKey: 'sage',
    look: colors('var(--sc-board-sage-light)', 'var(--sc-board-sage-dark)'),
  },
  // Farbpaare im Stil von Lichess (nur Farben, keine Bilddateien)
  { id: `${BUILTIN}brown`, nameKey: 'brown', look: colors('#f0d9b5', '#b58863') },
  { id: `${BUILTIN}blue`, nameKey: 'blue', look: colors('#dee3e6', '#8ca2ad') },
  { id: `${BUILTIN}green`, nameKey: 'green', look: colors('#ffffdd', '#86a666') },
  { id: `${BUILTIN}grey`, nameKey: 'grey', look: colors('#dcdcdc', '#a3a3a3') },
  { id: `${BUILTIN}purple`, nameKey: 'purple', look: colors('#e4dcef', '#9a7fb4') },
];

export function builtinBoardTheme(id: string): BuiltinBoardTheme | undefined {
  return BUILTIN_BOARD_THEMES.find((theme) => theme.id === id);
}

/** Bisherige Einstellung `boardTheme` (vor der Darstellung) → neue Kennung */
export function migrateBoardTheme(old: unknown): string {
  return old === 'wood' || old === 'sage' ? `${BUILTIN}${old}` : DEFAULT_BOARD_THEME;
}

const HEX = /^#([0-9a-f]{6})$/i;

export function isHexColor(value: string): boolean {
  return HEX.test(value);
}

/** Relative Leuchtdichte nach WCAG 2 */
function luminance(hex: string): number {
  const value = parseInt(hex.slice(1), 16);
  const channel = (shift: number) => {
    const c = ((value >> shift) & 0xff) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0);
}

/** Kontrastverhältnis zweier Hex-Farben (1 = gleich, 21 = schwarz auf weiß) */
export function contrastRatio(a: string, b: string): number {
  if (!isHexColor(a) || !isHexColor(b)) return 1;
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Helle und dunkle Felder sind kaum zu unterscheiden */
export function lowContrast(light: string, dark: string): boolean {
  return contrastRatio(light, dark) < 1.3;
}
