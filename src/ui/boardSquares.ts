import type { CSSProperties } from 'react';
import { getCheckSquare } from '../chess/check';

/**
 * Legt zwei Feld-Stile übereinander, ohne dass einer den anderen löscht: Schatten und
 * Hintergrundbilder werden aneinandergehängt (der erste liegt oben), alles andere überschreibt `top`.
 */
export function layerSquareStyle(
  top: CSSProperties,
  bottom: CSSProperties | undefined,
): CSSProperties {
  if (!bottom) return top;
  const join = (a?: string, b?: string) => (a && b ? `${a}, ${b}` : (a ?? b));
  const boxShadow = join(top.boxShadow, bottom.boxShadow);
  const backgroundImage = join(top.backgroundImage, bottom.backgroundImage);
  return {
    ...bottom,
    ...top,
    ...(boxShadow ? { boxShadow } : {}),
    ...(backgroundImage ? { backgroundImage } : {}),
  };
}

/**
 * Letzter Zug bzw. ausgewähltes Feld: Farbfläche über dem ganzen Feld. Als Hintergrundfarbe statt als
 * riesiger Innenschatten: billiger zu zeichnen (wichtig ohne GPU) und verträgt sich mit den
 * Hintergrundbildern anderer Markierungen (Zielpunkte, Kreise, Schach).
 */
export const LAST_MOVE_STYLE: CSSProperties = { backgroundColor: 'var(--sc-last-move)' };

/**
 * König im Schach: weicher roter Verlauf im Feld und ein Leuchten am Rand (liegt über der
 * Markierung des letzten Zugs). Bei Matt kräftiger und mit festem Ring. Zeigt Lichess auch,
 * ist also keine Hilfe im Sinne der Fair-Play-Sperre.
 */
export function checkSquareStyles(fen: string): Record<string, CSSProperties> {
  const check = getCheckSquare(fen);
  if (!check) return {};
  const style: CSSProperties = check.mate
    ? {
        backgroundImage:
          'radial-gradient(circle, var(--sc-check-strong) 0%, var(--sc-check) 55%, transparent 85%)',
        boxShadow: 'inset 0 0 0 3px var(--sc-check-ring), inset 0 0 14px 4px var(--sc-check)',
      }
    : {
        backgroundImage: 'radial-gradient(circle, var(--sc-check) 0%, transparent 72%)',
        boxShadow: 'inset 0 0 12px 2px var(--sc-check)',
      };
  return { [check.square]: style };
}

/** Fügt die Schach-Hervorhebung zu vorhandenen Feld-Stilen hinzu (sie liegt jeweils oben). */
export function withCheckHighlight(
  fen: string,
  styles: Record<string, CSSProperties>,
): Record<string, CSSProperties> {
  const result = { ...styles };
  for (const [square, style] of Object.entries(checkSquareStyles(fen))) {
    result[square] = layerSquareStyle(style, result[square]);
  }
  return result;
}
