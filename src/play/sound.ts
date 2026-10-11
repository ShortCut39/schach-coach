import { invoke, isTauri } from '@tauri-apps/api/core';
import type { Color, PlyBase } from '../chess/types';
import {
  pickCustomSound,
  pickSound,
  SOUND_EVENTS,
  type SoundEvent,
} from '../appearance/soundMapping';
import type { SoundSource } from '../appearance/sounds';
import { useAppearance, type ActiveSounds } from '../appearance/store';
import type { GameOutcome } from './rules/gameEnd';
import { encodeWav, renderSound, SAMPLE_RATE } from './soundSynth';

export type { SoundEvent } from '../appearance/soundMapping';

/**
 * Töne fürs Spielen aus dem gewählten Ton-Set (Einstellungen → Darstellung): Dateien (z. B. `sfx`)
 * oder selbst berechnete Töne (`soundSynth.ts`).
 *
 * Befunde unter Linux (Oktober 2026, WebKitGTK 2.54, PipeWire):
 * - WebAudio liefert in der WebView nur Stille (am Monitor des Ausgabegeräts gemessen).
 * - `<audio>` ist hörbar, kann die WebView aber einfrieren: GStreamer verhakt sich zwischen
 *   Haupt- und Streaming-Thread, WebKit beendet den Prozess dann (Absturzbericht des Nutzers).
 * Deshalb dekodiert und spielt in der Desktop-App der Rust-Teil die Töne (`src-tauri/src/sound.rs`,
 * rodio/symphonia, unabhängig von GStreamer). Nur im reinen Browser-Modus (`pnpm dev`) bleibt das
 * Audio-Element. Ohne beides: still.
 */

/** Ton zu einem Zug, nur aus den Zugdaten (SAN-Zeichen bzw. chess.js-Flags). */
export function moveSound(ply: Pick<PlyBase, 'flags'>): SoundEvent {
  const { flags } = ply;
  if (flags.check || flags.mate) return 'check';
  if (flags.promotion) return 'promotion';
  if (flags.castle) return 'castle';
  if (flags.capture) return 'capture';
  return 'move';
}

/** Ton zum Partieende aus meiner Sicht: Sieg, Niederlage, Remis oder allgemein (z. B. Abbruch). */
export function endSound(outcome: GameOutcome | null, myColor: Color): SoundEvent {
  if (!outcome || outcome.reason === 'aborted' || outcome.reason === 'noStart') return 'gameEnd';
  if (outcome.result === '1/2-1/2') return 'draw';
  if (!outcome.winner) return 'gameEnd';
  return outcome.winner === myColor ? 'victory' : 'defeat';
}

/** Quelle des Tons für ein Ereignis im aktiven Set (mit Ersatzkette bzw. Standard-Set) */
export function soundSourceFor(
  event: SoundEvent,
  active: ActiveSounds = useAppearance.getState().sounds,
): SoundSource | undefined {
  if (active.fallback) return pickCustomSound(event, active.own, active.fallback).sound;
  return pickSound(event, active.own);
}

async function sourceBytes(source: SoundSource & { type: 'file' }): Promise<Uint8Array> {
  if (source.bytes) return source.bytes();
  const response = await fetch(source.url);
  if (!response.ok) throw new Error('sound');
  return new Uint8Array(await response.arrayBuffer());
}

/** Desktop-App: jeden Ton einmal an Rust übergeben, danach nur noch abspielen lassen */
const registered = new Map<string, Promise<unknown>>();

function registerNative(source: SoundSource): Promise<unknown> {
  let pending = registered.get(source.key);
  if (!pending) {
    pending =
      source.type === 'synth'
        ? invoke<null>('sound_register', {
            kind: source.key,
            sampleRate: SAMPLE_RATE,
            samples: Array.from(renderSound(source.synth)),
          })
        : sourceBytes(source).then((bytes) =>
            invoke('sound_register_file', bytes, { headers: { 'x-sound-key': source.key } }),
          );
    // Fehlgeschlagen: beim nächsten Mal erneut versuchen
    pending.catch(() => registered.delete(source.key));
    registered.set(source.key, pending);
  }
  return pending;
}

/** Browser-Modus: berechnete Töne als WAV-Blob-URL für ein Audio-Element */
const synthUrls = new Map<string, string>();

function browserUrl(source: SoundSource): string | null {
  if (source.type === 'file') return source.url;
  const cached = synthUrls.get(source.key);
  if (cached) return cached;
  if (typeof URL.createObjectURL !== 'function') return null;
  const wav = encodeWav(renderSound(source.synth));
  const url = URL.createObjectURL(new Blob([wav.buffer as ArrayBuffer], { type: 'audio/wav' }));
  synthUrls.set(source.key, url);
  return url;
}

function playInBrowser(source: SoundSource, volume: number): void {
  if (typeof window === 'undefined' || typeof window.Audio !== 'function') return;
  const url = browserUrl(source);
  if (!url) return;
  const audio = new window.Audio(url);
  audio.volume = volume;
  const played = audio.play() as Promise<void> | undefined;
  void played?.catch(() => undefined);
}

/**
 * Spielt einen Ton aus dem aktiven Set (oder aus `active`, z. B. dem Entwurf in den Einstellungen);
 * `volume` von 0 bis 1. Wirft nie.
 */
export function playSound(event: SoundEvent, volume = 0.7, active?: ActiveSounds): void {
  if (volume <= 0) return;
  const level = Math.min(1, volume);
  try {
    const source = soundSourceFor(event, active);
    if (!source) return;
    if (isTauri()) {
      void registerNative(source)
        .then(() => invoke('sound_play', { kind: source.key, volume: level }))
        .catch(() => undefined);
    } else {
      playInBrowser(source, level);
    }
  } catch {
    // Kein Ton ist kein Fehler
  }
}

/** Desktop-App: alle Töne des aktiven Sets vorab dekodieren, damit der erste Zug sofort klingt. */
export function preloadSounds(active: ActiveSounds = useAppearance.getState().sounds): void {
  try {
    if (!isTauri()) return;
    const keys = new Set<string>();
    for (const event of SOUND_EVENTS) {
      const source = soundSourceFor(event, active);
      if (source && !keys.has(source.key)) {
        keys.add(source.key);
        void registerNative(source).catch(() => undefined);
      }
    }
  } catch {
    // Vorladen ist nur eine Beschleunigung
  }
}

useAppearance.subscribe((state, previous) => {
  if (state.sounds !== previous.sounds) preloadSounds(state.sounds);
});

/** Ergebnis der Probe einer Ton-Datei (Desktop-App: in Rust dekodiert) */
export type SoundProbe =
  | { ok: true; durationMs: number }
  | { ok: false; error: 'unsupported' | 'tooLong' | 'tooLarge' | 'empty' };

/**
 * Prüft, ob sich eine Datei dekodieren lässt und wie lang sie ist. In der Desktop-App dekodiert
 * Rust (dasselbe Verfahren wie beim Abspielen), im Browser-Modus das Audio-Element.
 */
export async function probeSound(bytes: Uint8Array, mime: string): Promise<SoundProbe> {
  const known = ['unsupported', 'tooLong', 'tooLarge', 'empty'] as const;
  if (isTauri()) {
    try {
      const info = await invoke<{ durationMs: number }>('sound_probe', bytes);
      return { ok: true, durationMs: info.durationMs };
    } catch (error) {
      const code = known.find((k) => k === error);
      return { ok: false, error: code ?? 'unsupported' };
    }
  }
  if (typeof window === 'undefined' || typeof window.Audio !== 'function') {
    return { ok: false, error: 'unsupported' };
  }
  if (typeof URL.createObjectURL !== 'function') return { ok: false, error: 'unsupported' };
  const url = URL.createObjectURL(new Blob([bytes.slice().buffer], { type: mime }));
  try {
    const duration = await new Promise<number>((resolve, reject) => {
      const audio = new window.Audio();
      const timer = setTimeout(() => reject(new Error('timeout')), 5000);
      audio.onloadedmetadata = () => {
        clearTimeout(timer);
        resolve(audio.duration);
      };
      audio.onerror = () => {
        clearTimeout(timer);
        reject(new Error('decode'));
      };
      audio.preload = 'metadata';
      audio.src = url;
    });
    if (!Number.isFinite(duration)) return { ok: false, error: 'unsupported' };
    if (duration > 5.1) return { ok: false, error: 'tooLong' };
    return { ok: true, durationMs: Math.round(duration * 1000) };
  } catch {
    return { ok: false, error: 'unsupported' };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Nur für Tests */
export function resetSoundsForTests(): void {
  registered.clear();
  synthUrls.clear();
}
