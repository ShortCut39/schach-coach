/**
 * Ereignisse, zu denen ein Ton spielt, und wie ein Ton-Set sie abdeckt.
 *
 * Hat ein Set für ein Ereignis keinen Ton, gilt die Ersatzkette (spezifisch → allgemein → Zug),
 * z. B. Sieg → Partieende → Zug. Bei eigenen Sets gilt zuerst die eigene Kette; Ereignisse, die
 * kein Zug sind (Start, Ende, Zeitnot), nehmen danach den Ton des Standard-Sets statt des eigenen
 * Zug-Tons. So kann ein eigenes Set auch nur aus wenigen Tönen bestehen.
 */
export const SOUND_EVENTS = [
  'move',
  'capture',
  'castle',
  'check',
  'promotion',
  'gameStart',
  'gameEnd',
  'victory',
  'defeat',
  'draw',
  'lowTime',
] as const;
export type SoundEvent = (typeof SOUND_EVENTS)[number];

export function isSoundEvent(value: string): value is SoundEvent {
  return (SOUND_EVENTS as readonly string[]).includes(value);
}

const CHAINS: Record<SoundEvent, readonly SoundEvent[]> = {
  move: ['move'],
  capture: ['capture', 'move'],
  castle: ['castle', 'move'],
  check: ['check', 'move'],
  promotion: ['promotion', 'move'],
  gameStart: ['gameStart', 'move'],
  gameEnd: ['gameEnd', 'move'],
  victory: ['victory', 'gameEnd', 'move'],
  defeat: ['defeat', 'gameEnd', 'move'],
  draw: ['draw', 'gameEnd', 'move'],
  lowTime: ['lowTime', 'move'],
};

/** Züge: Fehlt der eigene Ton, passt der eigene Zug-Ton besser als ein fremder */
const MOVE_LIKE: ReadonlySet<SoundEvent> = new Set([
  'move',
  'capture',
  'castle',
  'check',
  'promotion',
]);

export function fallbackChain(event: SoundEvent): readonly SoundEvent[] {
  return CHAINS[event];
}

/** Erster vorhandener Ton entlang der Ersatzkette (innerhalb eines Sets) */
export function pickSound<T>(
  event: SoundEvent,
  sounds: Partial<Record<SoundEvent, T>>,
): T | undefined {
  for (const step of CHAINS[event]) {
    const sound = sounds[step];
    if (sound !== undefined) return sound;
  }
  return undefined;
}

/**
 * Ton für ein eigenes Set: eigene Kette (bei Nicht-Zügen ohne den Zug-Ton), sonst das Standard-Set.
 * Liefert auch, ob der Ton aus dem eigenen Set stammt.
 */
export function pickCustomSound<T>(
  event: SoundEvent,
  own: Partial<Record<SoundEvent, T>>,
  fallback: Partial<Record<SoundEvent, T>>,
): { sound: T | undefined; own: boolean } {
  const chain = MOVE_LIKE.has(event) ? CHAINS[event] : CHAINS[event].filter((e) => e !== 'move');
  for (const step of chain) {
    const sound = own[step];
    if (sound !== undefined) return { sound, own: true };
  }
  return { sound: pickSound(event, fallback), own: false };
}

/** Dateinamen der Lichess-Sets (`public/sound/<set>/<Name>.ogg`) je Ereignis */
export const LICHESS_SOUND_FILES: Partial<Record<SoundEvent, string>> = {
  move: 'Move',
  capture: 'Capture',
  check: 'Check',
  gameStart: 'GenericNotify',
  gameEnd: 'GenericNotify',
  victory: 'Victory',
  defeat: 'Defeat',
  draw: 'Draw',
  lowTime: 'LowTime',
};
