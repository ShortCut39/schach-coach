import type { CSSProperties } from 'react';

/** Koordinaten am Brettrand (für Analyse- und Trainingsbrett) */
export const notationBase: CSSProperties = {
  fontFamily: 'var(--sc-font-mono)',
  fontWeight: 600,
  fontSize: 'clamp(9px, 1.9cqw, 13px)',
  userSelect: 'none',
};

export function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Kantenlänge für ein Brett, das mit der Fensterhöhe wächst (als CSS-Ausdruck).
 * `reserved`: Höhe in px, die neben dem Brett im Fenster bleiben muss (Kopfzeile, Abstände, …).
 */
export function boardSizeFor(reserved: number, min = 600, max = 1400): string {
  return `clamp(${min}px, calc(100dvh - ${reserved}px), ${max}px)`;
}
