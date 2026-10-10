import type { PlyBase } from '../chess/types';
import { encodeWav, renderSound, type SoundKind } from './soundSynth';

export type { SoundKind } from './soundSynth';

/**
 * Töne fürs Spielen.
 *
 * Befund (Oktober 2026, Linux, WebKitGTK 2.54, PipeWire): WebAudio erzeugt in der WebView zwar
 * einen Tonstrom, der aber nur Stille enthält – gemessen am Monitor-Ausgang des Kopfhörers. Ein
 * HTMLAudioElement mit einer WAV-Datei (auch als Blob-URL) kommt dagegen mit vollem Pegel an.
 * Deshalb werden die Töne einmal selbst berechnet (`soundSynth.ts`), als WAV-Blob abgelegt und
 * über `Audio` abgespielt. Ohne Audio-Unterstützung (Tests) bleibt es still.
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

function audioSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.Audio === 'function';
}

/** Spielt einen Ton; `volume` von 0 bis 1. Jeder Aufruf bekommt ein eigenes Element (Überlappen). */
export function playSound(kind: SoundKind, volume = 0.7): void {
  if (volume <= 0 || !audioSupported()) return;
  try {
    const url = urlFor(kind);
    if (!url) return;
    const audio = new window.Audio(url);
    audio.volume = Math.min(1, volume);
    const played = audio.play() as Promise<void> | undefined;
    void played?.catch(() => undefined);
  } catch {
    // Kein Ton ist kein Fehler
  }
}
