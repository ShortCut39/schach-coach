/** Zugkategorien (angelehnt an Chess.com, eigene Näherungen). */
export type Category =
  | 'brilliant'
  | 'great'
  | 'best'
  | 'excellent'
  | 'good'
  | 'book'
  | 'inaccuracy'
  | 'mistake'
  | 'blunder'
  | 'miss';

/** Reihenfolge für Statistik und Legenden */
export const CATEGORIES: readonly Category[] = [
  'brilliant',
  'great',
  'best',
  'excellent',
  'good',
  'book',
  'inaccuracy',
  'mistake',
  'blunder',
  'miss',
];

export const ERROR_CATEGORIES: ReadonlySet<Category> = new Set([
  'inaccuracy',
  'mistake',
  'blunder',
  'miss',
]);
export const GOOD_CATEGORIES: ReadonlySet<Category> = new Set([
  'brilliant',
  'great',
  'best',
  'excellent',
  'good',
]);

/**
 * Alle Schwellen der Klassifizierung. Werte in Prozentpunkten Gewinnchance (0..100),
 * Material in Bauerneinheiten. Die drei Fehlerschwellen sind in den Einstellungen änderbar.
 */
export interface ClassificationConfig {
  /** Ungenauigkeit ab diesem Verlust */
  inaccuracy: number;
  /** Fehler ab diesem Verlust */
  mistake: number;
  /** Patzer ab diesem Verlust */
  blunder: number;
  /** Ausgezeichnet bis einschließlich diesem Verlust */
  excellent: number;
  /** Großartig: Abstand zwischen bestem und zweitbestem Engine-Zug mindestens */
  greatGap: number;
  /** Stellung gilt als entschieden ab dieser Gewinnchance (bzw. bis 100 minus diesem Wert) */
  decided: number;
  /** Opfer: Materialverlust mindestens */
  sacrificeMaterial: number;
  /** Opfer: so viele Halbzüge der Hauptvariante werden betrachtet (inkl. gespieltem Zug) */
  sacrificeWindow: number;
  /** Brillant: Gewinnchance nach dem Zug mindestens */
  brilliantMinWin: number;
  /** Verpasst: Der Gegner hat vorher mindestens so viel verloren … */
  missOpponentLoss: number;
  /** … du verlierst gegenüber dem Bestzug mindestens so viel … */
  missOwnLoss: number;
  /** … obwohl der Bestzug mindestens diese Gewinnchance hatte */
  missBestWin: number;
}

export const DEFAULT_CLASSIFICATION: ClassificationConfig = {
  inaccuracy: 5,
  mistake: 10,
  blunder: 20,
  excellent: 2,
  greatGap: 10,
  decided: 90,
  sacrificeMaterial: 2,
  sacrificeWindow: 8,
  brilliantMinWin: 50,
  missOpponentLoss: 10,
  missOwnLoss: 10,
  missBestWin: 80,
};

/** Ergebnis für einen Halbzug */
export interface PlyAnalysis {
  category: Category;
  /** Gewinnchance des Ziehenden vor dem Zug (bester Engine-Zug), 0..100 */
  winBefore: number;
  /** Gewinnchance des Ziehenden nach dem gespielten Zug, 0..100 */
  winAfter: number;
  /** winBefore − winAfter, mindestens 0 */
  winLoss: number;
  /** Genauigkeit dieses Zugs, 0..100 */
  accuracy: number;
  /** Figurenopfer ohne Fehler (Material gegeben, aber Verlust an Gewinnchance unter der Ungenauigkeitsschwelle) */
  isSacrifice: boolean;
  /** Bester Engine-Zug in der Stellung davor (UCI) */
  bestMove: string | undefined;
}
