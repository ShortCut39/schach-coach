import type { Orientation } from '../../store/game';

/** Koordinatensystem der Brett-Ebene: 800 × 800, ein Feld = 100. */
export const BOARD_SIZE = 800;
export const SQUARE = 100;

/** Linke obere Ecke eines Felds (z. B. `b8`) je nach Brettrichtung. */
export function squareOrigin(square: string, orientation: Orientation): { x: number; y: number } {
  const file = square.charCodeAt(0) - 97; // a = 0
  const rank = Number(square[1]); // 1..8
  return orientation === 'white'
    ? { x: file * SQUARE, y: (8 - rank) * SQUARE }
    : { x: (7 - file) * SQUARE, y: (rank - 1) * SQUARE };
}

export function squareCenter(square: string, orientation: Orientation): { x: number; y: number } {
  const { x, y } = squareOrigin(square, orientation);
  return { x: x + SQUARE / 2, y: y + SQUARE / 2 };
}

export interface ArrowGeometry {
  /** Linie vom Startfeld bis zum Fuß der Pfeilspitze */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Dreieck der Pfeilspitze */
  head: string;
}

/** Gerader Pfeil von Feldmitte zu Feldmitte; die Spitze endet kurz vor der Zielmitte. */
export function arrowGeometry(from: string, to: string, orientation: Orientation): ArrowGeometry {
  const a = squareCenter(from, orientation);
  const b = squareCenter(to, orientation);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  const tip = { x: b.x - ux * 8, y: b.y - uy * 8 };
  const headLength = 56;
  const halfWidth = 32;
  const base = { x: tip.x - ux * headLength, y: tip.y - uy * headLength };
  const left = { x: base.x - uy * halfWidth, y: base.y + ux * halfWidth };
  const right = { x: base.x + uy * halfWidth, y: base.y - ux * halfWidth };
  const fmt = (p: { x: number; y: number }) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  return {
    x1: a.x,
    y1: a.y,
    x2: base.x + ux * 4,
    y2: base.y + uy * 4,
    head: `${fmt(tip)} ${fmt(left)} ${fmt(right)}`,
  };
}

/** Mittelpunkt des Badges oben rechts im Zielfeld, so begrenzt, dass es nicht abgeschnitten wird. */
export function badgeCenter(square: string, orientation: Orientation, radius: number) {
  const { x, y } = squareOrigin(square, orientation);
  return {
    x: Math.min(x + 84, BOARD_SIZE - radius - 2),
    y: Math.max(y + 20, radius + 2),
  };
}
