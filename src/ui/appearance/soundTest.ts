import type { SoundEvent } from '../../appearance/soundMapping';
import { resolveSelection, type ActiveSounds } from '../../appearance/store';
import { playSound } from '../../play/sound';

/** „Ton testen“: Zug, Schlagzug, Schach, Partieende (Sieg) nacheinander */
export const TEST_SEQUENCE: readonly { event: SoundEvent; at: number }[] = [
  { event: 'move', at: 0 },
  { event: 'capture', at: 550 },
  { event: 'check', at: 1100 },
  { event: 'victory', at: 1800 },
];

let timers: ReturnType<typeof setTimeout>[] = [];
let pendingRelease: (() => void) | undefined;

function stop(): void {
  for (const timer of timers) clearTimeout(timer);
  timers = [];
  pendingRelease?.();
  pendingRelease = undefined;
}

/** Spielt die Testfolge aus einem Set; ein neuer Aufruf bricht die laufende Folge ab. */
export function playTestSequence(active: ActiveSounds, volume: number, release?: () => void): void {
  stop();
  pendingRelease = release;
  for (const { event, at } of TEST_SEQUENCE) {
    timers.push(setTimeout(() => playSound(event, volume, active), at));
  }
  // Objekt-URLs eines nur zum Anhören geladenen Sets erst nach dem letzten Ton freigeben
  timers.push(
    setTimeout(() => {
      pendingRelease?.();
      pendingRelease = undefined;
    }, 8000),
  );
}

/** Spielt die Testfolge eines (gespeicherten oder eigenen) Sets, auch wenn es nicht gewählt ist. */
export async function playSetById(id: string, volume: number): Promise<void> {
  const resolved = await resolveSelection('sounds', id);
  if (resolved?.selection.kind !== 'sounds') return;
  playTestSequence(resolved.selection.value, volume, resolved.release);
}
