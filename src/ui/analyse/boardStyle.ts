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
