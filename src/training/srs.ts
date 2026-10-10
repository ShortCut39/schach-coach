/**
 * Wiederholung nach dem Lernkarten-Prinzip (Leitner-System).
 *
 * Jede Aufgabe liegt in einem Fach 0–5. Richtig gelöst → ein Fach weiter, fällig nach
 * 1, 3, 7, 14 bzw. 30 Tagen. Falsch gelöst oder Lösung angesehen → zurück in Fach 0, gleich
 * wieder fällig (kommt in derselben Sitzung noch einmal dran). Mit dem zweiten Hinweis
 * (Figur gezeigt) gelöst → Fach bleibt, fällig nach dem Abstand des aktuellen Fachs.
 */
export const INTERVAL_DAYS = [0, 1, 3, 7, 14, 30] as const;
const MAX_BOX = INTERVAL_DAYS.length - 1;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface CardState {
  box: number;
  /** Fällig ab (ISO) */
  due: string;
  attempts: number;
  correct: number;
}

export type AttemptResult = 'correct' | 'correctWithHelp' | 'wrong';

export function nextState(
  state: CardState | undefined,
  result: AttemptResult,
  now: Date,
): CardState {
  const current = state ?? { box: 0, due: now.toISOString(), attempts: 0, correct: 0 };
  const box =
    result === 'correct'
      ? Math.min(current.box + 1, MAX_BOX)
      : result === 'wrong'
        ? 0
        : Math.max(current.box, 1);
  const days = INTERVAL_DAYS[box] ?? 0;
  return {
    box,
    due: new Date(now.getTime() + days * DAY_MS).toISOString(),
    attempts: current.attempts + 1,
    correct: current.correct + (result === 'wrong' ? 0 : 1),
  };
}

/** Neue Aufgaben (ohne Zustand) sind immer fällig. */
export function isDue(state: CardState | undefined, now: Date): boolean {
  return !state || new Date(state.due).getTime() <= now.getTime();
}
