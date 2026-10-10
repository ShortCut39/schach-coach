import type { TimeControl } from '../clock/clock';

/** Tempo-Klassen wie auf Lichess */
export type Speed = 'ultraBullet' | 'bullet' | 'blitz' | 'rapid' | 'classical';

/**
 * Geschätzte Partiedauer in Sekunden nach Lichess: Grundzeit + 40 × Inkrement.
 * (40 Züge sind die angenommene durchschnittliche Partielänge.)
 */
export function estimatedSeconds(control: TimeControl): number {
  return control.initialMs / 1000 + (40 * control.incrementMs) / 1000;
}

/**
 * Einordnung nach den Grenzen von Lichess: unter 30 s UltraBullet, unter 3 min Bullet,
 * unter 8 min Blitz, unter 25 min Rapid, sonst Classical.
 */
export function speedOf(control: TimeControl): Speed {
  const seconds = estimatedSeconds(control);
  if (seconds < 30) return 'ultraBullet';
  if (seconds < 180) return 'bullet';
  if (seconds < 480) return 'blitz';
  if (seconds < 1500) return 'rapid';
  return 'classical';
}

/** Offene Suchen über die Board-API erlaubt Lichess nur für Rapid und Classical. */
export function allowedForLichessSeek(control: TimeControl): boolean {
  const speed = speedOf(control);
  return speed === 'rapid' || speed === 'classical';
}

/** Kopfzeile `TimeControl` im PGN: `600+0`; ohne Uhr `-`. */
export function pgnTimeControl(control: TimeControl | null): string {
  if (!control) return '-';
  return `${Math.round(control.initialMs / 1000)}+${Math.round(control.incrementMs / 1000)}`;
}

/** Aus Minuten und Sekunden (Eingabe im Dialog) */
export function timeControl(minutes: number, incrementSeconds: number): TimeControl {
  return {
    initialMs: Math.round(minutes * 60_000),
    incrementMs: Math.round(incrementSeconds * 1000),
  };
}

/** Voreinstellungen im Dialog „Neue Partie“ (Minuten + Inkrement in Sekunden) */
export const TIME_PRESETS = [
  { minutes: 10, increment: 0 },
  { minutes: 10, increment: 5 },
  { minutes: 15, increment: 10 },
] as const;
