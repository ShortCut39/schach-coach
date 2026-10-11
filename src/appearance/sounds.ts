import { SOUND_KINDS, type SoundKind as SynthKind } from '../play/soundSynth';
import { LICHESS_SOUND_FILES, SOUND_EVENTS, type SoundEvent } from './soundMapping';
import { THIRD_PARTY_ASSETS } from './thirdParty';
import { BUILTIN } from './types';

/**
 * Ein abspielbarer Ton. `key` ist eindeutig je Inhalt (Rust legt den dekodierten Ton unter diesem
 * Schlüssel ab). Dateien kommen als URL (Browser-Modus) und als Bytes (Desktop-App, dekodiert in Rust).
 */
export type SoundSource =
  | { type: 'synth'; key: string; synth: SynthKind }
  | { type: 'file'; key: string; url: string; bytes?: () => Promise<Uint8Array> };

export type SoundSources = Partial<Record<SoundEvent, SoundSource>>;

export interface BuiltinSoundSet {
  id: string;
  /** Anzeigename; bei `nameKey` aus den Sprachdateien (`appearance.sounds.*`) */
  name?: string;
  nameKey?: 'synth';
  sources: SoundSources;
}

const files = import.meta.glob<string>('../assets/sounds/*/*.ogg', {
  eager: true,
  query: '?url',
  import: 'default',
});

function lichessSources(set: string): SoundSources {
  const sources: SoundSources = {};
  for (const event of SOUND_EVENTS) {
    const name = LICHESS_SOUND_FILES[event];
    const url = name ? files[`../assets/sounds/${set}/${name}.ogg`] : undefined;
    if (name && url) sources[event] = { type: 'file', key: `${set}:${name}`, url };
  }
  return sources;
}

function synthSources(): SoundSources {
  const sources: SoundSources = {};
  for (const kind of SOUND_KINDS)
    sources[kind] = { type: 'synth', key: `synth:${kind}`, synth: kind };
  return sources;
}

export const SYNTH_SOUND_SET = `${BUILTIN}synth`;
/** Standard: `sfx` (frei lizenziert). Die Lichess-Standardtöne sind nicht frei, siehe THIRD_PARTY_ASSETS.md. */
export const DEFAULT_SOUND_SET = `${BUILTIN}sfx`;

export const BUILTIN_SOUND_SETS: readonly BuiltinSoundSet[] = [
  ...THIRD_PARTY_ASSETS.filter((asset) => asset.kind === 'sounds').map((asset) => ({
    id: `${BUILTIN}${asset.id}`,
    name: asset.name,
    sources: lichessSources(asset.id),
  })),
  { id: SYNTH_SOUND_SET, nameKey: 'synth', sources: synthSources() },
];

export function builtinSoundSet(id: string): BuiltinSoundSet | undefined {
  return BUILTIN_SOUND_SETS.find((set) => set.id === id);
}
