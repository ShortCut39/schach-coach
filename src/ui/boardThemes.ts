export type BoardTheme = 'standard' | 'wood' | 'sage';

export const BOARD_THEMES: readonly BoardTheme[] = ['standard', 'wood', 'sage'];

/** Farben je Brett-Thema (CSS-Variablen aus tokens.css). Koordinaten in der jeweils anderen Feldfarbe. */
export function boardColors(theme: BoardTheme): { light: string; dark: string } {
  return theme === 'standard'
    ? { light: 'var(--sc-board-light)', dark: 'var(--sc-board-dark)' }
    : { light: `var(--sc-board-${theme}-light)`, dark: `var(--sc-board-${theme}-dark)` };
}
