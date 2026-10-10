/**
 * Einfache Töne, erzeugt per WebAudio (keine Audiodateien, also keine Lizenzfragen).
 * Ohne WebAudio (Tests, alte Systeme) bleibt es still.
 */
export type SoundKind = 'move' | 'capture' | 'check' | 'end' | 'lowTime';

interface Tone {
  frequency: number;
  duration: number;
  type: OscillatorType;
  volume: number;
  /** Zweiter Ton kurz danach (Schach, Partieende) */
  then?: number;
}

const TONES: Record<SoundKind, Tone> = {
  move: { frequency: 520, duration: 0.07, type: 'triangle', volume: 0.18 },
  capture: { frequency: 330, duration: 0.11, type: 'triangle', volume: 0.22 },
  check: { frequency: 660, duration: 0.09, type: 'square', volume: 0.08, then: 880 },
  end: { frequency: 440, duration: 0.18, type: 'sine', volume: 0.2, then: 660 },
  lowTime: { frequency: 990, duration: 0.06, type: 'sine', volume: 0.12 },
};

let context: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === 'undefined' || typeof window.AudioContext !== 'function') return null;
  context ??= new window.AudioContext();
  if (context.state === 'suspended') void context.resume().catch(() => undefined);
  return context;
}

function beep(ctx: AudioContext, tone: Tone, frequency: number, start: number): void {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = tone.type;
  oscillator.frequency.value = frequency;
  // Kurzes Ein- und Ausblenden verhindert Knacken
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(tone.volume, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + tone.duration);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + tone.duration + 0.02);
}

export function playSound(kind: SoundKind): void {
  try {
    const ctx = audio();
    if (!ctx) return;
    const tone = TONES[kind];
    const now = ctx.currentTime;
    beep(ctx, tone, tone.frequency, now);
    if (tone.then) beep(ctx, tone, tone.then, now + tone.duration * 0.9);
  } catch {
    // Kein Ton ist kein Fehler
  }
}
