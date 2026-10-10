import type { Color } from '../../chess/types';

/** Zeitquelle in Millisekunden (monoton). In der App `performance.now()`, im Test steuerbar. */
export type TimeSource = () => number;

export const defaultTimeSource: TimeSource = () => performance.now();

export interface TimeControl {
  /** Grundzeit in ms */
  initialMs: number;
  /** Inkrement (Fischer) in ms, gutgeschrieben nach jedem eigenen Zug */
  incrementMs: number;
}

/**
 * Stand der Uhr zu einem Zeitpunkt: Restzeiten zum Zeitpunkt `at` und welche Uhr seitdem läuft.
 * Daraus kann die Anzeige jederzeit die aktuelle Restzeit berechnen (`remainingAt`).
 */
export interface ClockSnapshot {
  w: number;
  b: number;
  running: Color | null;
  at: number;
}

/** Restzeit einer Seite zum Zeitpunkt `now` (nie negativ). */
export function remainingAt(snapshot: ClockSnapshot, color: Color, now: number): number {
  const base = snapshot[color];
  const elapsed = snapshot.running === color ? Math.max(0, now - snapshot.at) : 0;
  return Math.max(0, base - elapsed);
}

/**
 * Schachuhr als reine Logik. Es läuft höchstens eine Seite. `press(color)` beendet den Zug von
 * `color`: Die verbrauchte Zeit wird abgezogen, das Inkrement gutgeschrieben, die andere Uhr startet.
 */
export class ChessClock {
  private times: Record<Color, number>;
  private running: Color | null = null;
  private since = 0;

  constructor(
    readonly control: TimeControl,
    private readonly now: TimeSource = defaultTimeSource,
  ) {
    this.times = { w: control.initialMs, b: control.initialMs };
  }

  /** Startet die Uhr von `color` (z. B. nach dem ersten Zug von Weiß die Uhr von Schwarz). */
  start(color: Color): void {
    this.fold();
    this.running = color;
    this.since = this.now();
  }

  /** Hält die Uhr an (Partieende, Pause). */
  stop(): void {
    this.fold();
    this.running = null;
  }

  /** `color` hat gezogen: Zeit abziehen, Inkrement gutschreiben, Gegneruhr starten. */
  press(color: Color): void {
    this.fold();
    this.times[color] += this.control.incrementMs;
    this.running = color === 'w' ? 'b' : 'w';
    this.since = this.now();
  }

  /**
   * Übernimmt Zeiten von außen (Lichess: Serverzeit gilt immer). `running` ist die Seite, deren
   * Uhr ab jetzt läuft, oder `null`.
   */
  set(times: Record<Color, number>, running: Color | null): void {
    this.times = { w: Math.max(0, times.w), b: Math.max(0, times.b) };
    this.running = running;
    this.since = this.now();
  }

  remaining(color: Color): number {
    return remainingAt(this.snapshot(), color, this.now());
  }

  runningColor(): Color | null {
    return this.running;
  }

  /** Seite, deren Zeit abgelaufen ist, sonst `null`. */
  flagged(): Color | null {
    if (this.running && this.remaining(this.running) <= 0) return this.running;
    if (this.times.w <= 0) return 'w';
    if (this.times.b <= 0) return 'b';
    return null;
  }

  /** Millisekunden, bis die laufende Uhr abläuft (`null`, wenn keine läuft). */
  msUntilFlag(): number | null {
    return this.running ? this.remaining(this.running) : null;
  }

  snapshot(): ClockSnapshot {
    return { w: this.times.w, b: this.times.b, running: this.running, at: this.since };
  }

  /** Verbrauchte Zeit der laufenden Seite in die Restzeit übernehmen. */
  private fold(): void {
    if (this.running) {
      const now = this.now();
      this.times[this.running] = Math.max(0, this.times[this.running] - (now - this.since));
      this.since = now;
    }
  }
}

/**
 * Anzeige der Restzeit: `m:ss` (ab einer Stunde `h:mm:ss`), unter 20 s mit Zehnteln (`0:19.4`).
 * Es wird abgerundet: Eine Sekunde (bzw. Zehntelsekunde) steht nur da, solange sie ganz übrig ist.
 */
export function formatClock(ms: number, decimalSeparator = '.'): string {
  const clamped = Math.max(0, ms);
  if (clamped < 20_000) {
    const tenths = Math.floor(clamped / 100);
    return `0:${String(Math.floor(tenths / 10)).padStart(2, '0')}${decimalSeparator}${tenths % 10}`;
  }
  const totalSeconds = Math.floor(clamped / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}`
    : `${minutes}:${seconds}`;
}

/** Unter dieser Restzeit wechselt die Uhr die Farbe. */
export const LOW_TIME_MS = 10_000;
