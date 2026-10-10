/**
 * Fair-Play-Sperre für Live-Partien auf Lichess.
 *
 * Lichess verbietet während einer Partie jede Hilfe (Engine, Eröffnungsbuch, fremde Tipps).
 * Solange eine Live-Partie läuft, ist diese Sperre aktiv. Durchgesetzt wird sie an wenigen
 * zentralen Stellen, nicht in einzelnen Komponenten:
 * - `UciEngine` (jede Engine-Instanz, auch die Gegner-Engine) verweigert Start und Suche,
 * - `getEngines()` startet keine Engine und beendet beim Einschalten den Analyse-Pool,
 * - `chatCompletion()` verweigert jeden KI-Aufruf und bricht laufende ab.
 *
 * Das Modul hat bewusst keine Abhängigkeiten, damit Engine- und KI-Schicht es nutzen können.
 */

export type GuardedAction = 'engine' | 'llm';

export class LiveGuardError extends Error {
  constructor(public readonly action: GuardedAction) {
    super(`Live-Partie läuft: ${action} gesperrt`);
    this.name = 'LiveGuardError';
  }
}

export interface LiveGuardState {
  active: boolean;
  /** Lichess-Partie, für die die Sperre gilt */
  gameId: string | null;
}

let state: LiveGuardState = { active: false, gameId: null };
const listeners = new Set<(state: LiveGuardState) => void>();

export function liveGuardState(): LiveGuardState {
  return state;
}

export function isLiveGuardActive(): boolean {
  return state.active;
}

/** Wirft `LiveGuardError`, solange eine Live-Partie läuft. */
export function assertNotLive(action: GuardedAction): void {
  if (state.active) throw new LiveGuardError(action);
}

/**
 * Schaltet die Sperre ein (Partiestart auf Lichess). Die Empfänger beenden dabei Engines und
 * KI-Anfragen; sie laufen synchron, damit nach diesem Aufruf nichts mehr rechnet.
 */
export function activateLiveGuard(gameId: string): void {
  if (state.active && state.gameId === gameId) return;
  state = { active: true, gameId };
  notify();
}

/** Hebt die Sperre auf (Partieende). Mit `gameId` nur, wenn sie für diese Partie gilt. */
export function releaseLiveGuard(gameId?: string): void {
  if (!state.active) return;
  if (gameId !== undefined && state.gameId !== gameId) return;
  state = { active: false, gameId: null };
  notify();
}

/** Meldet jede Änderung; gibt eine Abmeldefunktion zurück. */
export function onLiveGuardChange(listener: (state: LiveGuardState) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(): void {
  for (const listener of [...listeners]) {
    try {
      listener(state);
    } catch {
      // Ein fehlerhafter Empfänger darf die Sperre nicht aufhalten
    }
  }
}
