import { arrowGeometry, badgeCenter, squareCenter, squareOrigin } from './boardGeometry';

describe('Brettgeometrie', () => {
  it('liegt a1 bei Weiß unten links und bei Schwarz oben rechts', () => {
    expect(squareOrigin('a1', 'white')).toEqual({ x: 0, y: 700 });
    expect(squareOrigin('a1', 'black')).toEqual({ x: 700, y: 0 });
    expect(squareOrigin('h8', 'white')).toEqual({ x: 700, y: 0 });
    expect(squareCenter('b8', 'white')).toEqual({ x: 150, y: 50 });
  });

  it('lässt einen senkrechten Pfeil b3→b8 von unten nach oben laufen', () => {
    const arrow = arrowGeometry('b3', 'b8', 'white');
    expect(arrow.x1).toBe(150);
    expect(arrow.y1).toBe(550);
    expect(arrow.x2).toBeCloseTo(150);
    expect(arrow.y2).toBeGreaterThan(50);
    expect(arrow.head.startsWith('150.0,58.0')).toBe(true);
  });

  it('hält das Badge innerhalb des Bretts', () => {
    expect(badgeCenter('b8', 'white', 26)).toEqual({ x: 184, y: 28 });
    expect(badgeCenter('h1', 'white', 26).x).toBe(772);
  });
});
