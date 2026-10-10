import { invoke, isTauri } from '@tauri-apps/api/core';
import type { PlyBase } from '../chess/types';
import { encodeWav, renderSound, SAMPLE_RATE, type SoundKind } from './soundSynth';

export type { SoundKind } from './soundSynth';

/**
 * Töne fürs Spielen, selbst berechnet (`soundSynth.ts`).
 *
 * Befunde unter Linux (Oktober 2026, WebKitGTK 2.54, PipeWire):
 * - WebAudio liefert in der WebView nur Stille (am Monitor des Ausgabegeräts gemessen).
 * - `<audio>` ist hörbar, kann die WebView aber einfrieren: GStreamer verhakt sich zwischen
 *   Haupt- und Streaming-Thread, WebKit beendet den Prozess dann (Absturzbericht des Nutzers).
 * Deshalb spielt in der Desktop-App der Rust-Teil die Töne ab (`src-tauri/src/sound.rs`, rodio).
 * Nur im reinen Browser-Modus (`pnpm dev`) bleibt das Audio-Element. Ohne beides: still.
 */

/** Ton zu einem Zug, nur aus den Zugdaten (SAN-Zeichen bzw. chess.js-Flags). */
export function moveSound(ply: Pick<PlyBase, 'flags'>): SoundKind {
  const { flags } = ply;
  if (flags.check || flags.mate) return 'check';
  if (flags.promotion) return 'promotion';
  if (flags.castle) return 'castle';
  if (flags.capture) return 'capture';
  return 'move';
}

/** Desktop-App: Samples einmal je Art an Rust übergeben, danach nur noch abspielen lassen */
const registered = new Map<SoundKind, Promise<unknown>>();

function registerNative(kind: SoundKind): Promise<unknown> {
  let pending = registered.get(kind);
  if (!pending) {
    pending = invoke<null>('sound_register', {
      kind,
      sampleRate: SAMPLE_RATE,
      samples: Array.from(renderSound(kind)),
    });
    // Fehlgeschlagen: beim nächsten Mal erneut versuchen
    pending.catch(() => registered.delete(kind));
    registered.set(kind, pending);
  }
  return pending;
}

/** Browser-Modus: WAV als Blob-URL für ein Audio-Element */
const urls = new Map<SoundKind, string>();

function urlFor(kind: SoundKind): string | null {
  const cached = urls.get(kind);
  if (cached) return cached;
  if (typeof URL.createObjectURL !== 'function') return null;
  const wav = encodeWav(renderSound(kind));
  const url = URL.createObjectURL(new Blob([wav.buffer as ArrayBuffer], { type: 'audio/wav' }));
  urls.set(kind, url);
  return url;
}

function playInBrowser(kind: SoundKind, volume: number): void {
  if (typeof window === 'undefined' || typeof window.Audio !== 'function') return;
  const url = urlFor(kind);
  if (!url) return;
  const audio = new window.Audio(url);
  audio.volume = volume;
  const played = audio.play() as Promise<void> | undefined;
  void played?.catch(() => undefined);
}

/** Spielt einen Ton; `volume` von 0 bis 1. Wirft nie. */
export function playSound(kind: SoundKind, volume = 0.7): void {
  if (volume <= 0) return;
  const level = Math.min(1, volume);
  try {
    if (isTauri()) {
      void registerNative(kind)
        .then(() => invoke('sound_play', { kind, volume: level }))
        .catch(() => undefined);
    } else {
      playInBrowser(kind, level);
    }
  } catch {
    // Kein Ton ist kein Fehler
  }
}

/** Nur für Tests */
export function resetSoundsForTests(): void {
  registered.clear();
  urls.clear();
}
