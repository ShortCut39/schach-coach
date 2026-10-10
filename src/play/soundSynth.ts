/**
 * Erzeugt die Spieltöne selbst als WAV (16 Bit, mono). Keine fremden Audiodateien, also keine
 * Lizenzfragen. Reine Rechnung ohne Browser-APIs, daher in Vitest testbar.
 */
export const SOUND_KINDS = [
  'move',
  'capture',
  'castle',
  'check',
  'promotion',
  'gameStart',
  'gameEnd',
  'lowTime',
] as const;
export type SoundKind = (typeof SOUND_KINDS)[number];

export const SAMPLE_RATE = 22_050;

/** Pseudozufall mit festem Startwert: jedes Klacken klingt gleich */
function noiseSource(seed = 7): () => number {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state / 2147483647) * 2 - 1;
  };
}

function add(out: Float32Array, index: number, value: number): void {
  out[index] = (out[index] ?? 0) + value;
}

/** Holz-Klacken: Rauschen durch einen Bandpass plus tiefer, schnell fallender Sinus („Körper“) */
function tock(out: Float32Array, at: number, { body = 200, click = 1700, level = 0.8 } = {}): void {
  const start = Math.round(at * SAMPLE_RATE);
  const length = Math.round(0.13 * SAMPLE_RATE);
  const noise = noiseSource();
  // Bandpass (Biquad, RBJ-Formeln), Güte 1,8
  const w0 = (2 * Math.PI * click) / SAMPLE_RATE;
  const alpha = Math.sin(w0) / (2 * 1.8);
  const a0 = 1 + alpha;
  const b0 = alpha / a0;
  const b2 = -alpha / a0;
  const a1 = (-2 * Math.cos(w0)) / a0;
  const a2 = (1 - alpha) / a0;
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  let phase = 0;
  for (let i = 0; i < length && start + i < out.length; i++) {
    const t = i / SAMPLE_RATE;
    const attack = Math.min(1, t / 0.003);
    const x = noise();
    const y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    const clickPart = y * 2.2 * Math.exp(-t / 0.014);
    const freq = body * (1 + 0.4 * Math.exp(-t / 0.02));
    phase += (2 * Math.PI * freq) / SAMPLE_RATE;
    const bodyPart = Math.sin(phase) * 0.7 * Math.exp(-t / 0.035);
    add(out, start + i, level * attack * (clickPart + bodyPart));
  }
}

/** Klarer Glockenton mit leichtem Oberton */
function chime(out: Float32Array, at: number, freq: number, level = 0.3, decay = 0.3): void {
  const start = Math.round(at * SAMPLE_RATE);
  const length = Math.round((decay * 3 + 0.02) * SAMPLE_RATE);
  for (let i = 0; i < length && start + i < out.length; i++) {
    const t = i / SAMPLE_RATE;
    const attack = Math.min(1, t / 0.005);
    const tone = Math.sin(2 * Math.PI * freq * t) + 0.25 * Math.sin(4 * Math.PI * freq * t);
    add(out, start + i, level * attack * Math.exp(-t / (decay / 2)) * tone);
  }
}

/** Länge des Tons in Sekunden (mit Ausklang) */
const DURATION: Record<SoundKind, number> = {
  move: 0.16,
  capture: 0.2,
  castle: 0.28,
  check: 0.5,
  promotion: 0.75,
  gameStart: 0.8,
  gameEnd: 1.4,
  lowTime: 0.25,
};

/** Die Samples eines Tons (Werte zwischen −1 und 1) */
export function renderSound(kind: SoundKind): Float32Array {
  const out = new Float32Array(Math.round(DURATION[kind] * SAMPLE_RATE));
  const t = 0.005;
  switch (kind) {
    case 'move':
      tock(out, t);
      break;
    case 'capture':
      tock(out, t, { body: 150, click: 1100, level: 1 });
      tock(out, t + 0.03, { body: 120, click: 2400, level: 0.5 });
      break;
    case 'castle':
      tock(out, t);
      tock(out, t + 0.11, { body: 180 });
      break;
    case 'check':
      tock(out, t);
      chime(out, t + 0.02, 880, 0.3, 0.16);
      break;
    case 'promotion':
      tock(out, t);
      chime(out, t + 0.05, 660, 0.26, 0.14);
      chime(out, t + 0.15, 990, 0.26, 0.18);
      break;
    case 'gameStart':
      chime(out, t, 523, 0.28, 0.16);
      chime(out, t + 0.14, 784, 0.28, 0.22);
      break;
    case 'gameEnd':
      chime(out, t, 784, 0.26, 0.16);
      chime(out, t + 0.16, 659, 0.26, 0.16);
      chime(out, t + 0.32, 523, 0.3, 0.3);
      break;
    case 'lowTime':
      chime(out, t, 990, 0.4, 0.06);
      break;
  }
  // Weich begrenzen, damit sich überlagernde Teile nicht übersteuern
  for (let i = 0; i < out.length; i++) out[i] = Math.tanh((out[i] ?? 0) * 1.1) * 0.9;
  return out;
}

/** WAV-Datei (RIFF, PCM 16 Bit, mono) aus Samples */
export function encodeWav(samples: Float32Array, sampleRate = SAMPLE_RATE): Uint8Array {
  const bytes = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const value = Math.max(-1, Math.min(1, samples[i] ?? 0));
    view.setInt16(44 + i * 2, Math.round(value * 32767), true);
  }
  return bytes;
}
