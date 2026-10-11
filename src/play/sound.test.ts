import type { MoveFlags } from '../chess/types';
import { resetAppearanceForTests, useAppearance } from '../appearance/store';
import { endSound, moveSound, playSound } from './sound';
import { encodeWav, renderSound, SAMPLE_RATE, SOUND_KINDS } from './soundSynth';

const flags = (patch: Partial<MoveFlags>): { flags: MoveFlags } => ({
  flags: {
    check: false,
    mate: false,
    capture: false,
    castle: false,
    promotion: false,
    enPassant: false,
    ...patch,
  },
});

describe('Ton zum Zug', () => {
  it('wählt den Ton aus den Zugdaten', () => {
    expect(moveSound(flags({}))).toBe('move');
    expect(moveSound(flags({ capture: true }))).toBe('capture');
    expect(moveSound(flags({ capture: true, enPassant: true }))).toBe('capture');
    expect(moveSound(flags({ castle: true }))).toBe('castle');
    expect(moveSound(flags({ promotion: true, capture: true }))).toBe('promotion');
    // Schach geht vor: Schlagen mit Schach klingt nach Schach
    expect(moveSound(flags({ capture: true, check: true }))).toBe('check');
    expect(moveSound(flags({ check: true, mate: true }))).toBe('check');
  });
});

describe('Ton zum Partieende', () => {
  it('unterscheidet Sieg, Niederlage, Remis und Abbruch aus meiner Sicht', () => {
    const win = { result: '1-0', winner: 'w', reason: 'checkmate' } as const;
    expect(endSound(win, 'w')).toBe('victory');
    expect(endSound(win, 'b')).toBe('defeat');
    expect(endSound({ result: '1/2-1/2', winner: null, reason: 'stalemate' }, 'w')).toBe('draw');
    expect(endSound({ result: '*', winner: null, reason: 'aborted' }, 'w')).toBe('gameEnd');
    expect(endSound(null, 'b')).toBe('gameEnd');
  });
});

describe('Selbst erzeugte Töne', () => {
  it.each(SOUND_KINDS)('„%s“ ist hörbar laut und übersteuert nicht', (kind) => {
    const samples = renderSound(kind);
    const peak = samples.reduce((max, v) => Math.max(max, Math.abs(v)), 0);
    expect(samples.length).toBeGreaterThan(SAMPLE_RATE * 0.1);
    expect(peak).toBeGreaterThan(0.25);
    expect(peak).toBeLessThanOrEqual(0.9);
  });

  it('klingen je Art verschieden', () => {
    expect(renderSound('move')).not.toEqual(renderSound('capture'));
    expect(renderSound('move')).toEqual(renderSound('move'));
  });

  it('schreibt eine gültige WAV-Datei', () => {
    const wav = encodeWav(new Float32Array([0, 1, -1, 0.5]));
    const text = (from: number, to: number) => String.fromCharCode(...wav.slice(from, to));
    const view = new DataView(wav.buffer);
    expect(text(0, 4)).toBe('RIFF');
    expect(text(8, 12)).toBe('WAVE');
    expect(view.getUint32(24, true)).toBe(SAMPLE_RATE);
    expect(view.getUint32(40, true)).toBe(8);
    expect(view.getInt16(46, true)).toBe(32767);
    expect(view.getInt16(48, true)).toBe(-32767);
  });
});

describe('Abspielen', () => {
  beforeEach(() => resetAppearanceForTests());
  afterEach(() => vi.unstubAllGlobals());

  it('spielt Dateien des Standard-Sets über ein Audio-Element', () => {
    const played: string[] = [];
    class FakeAudio {
      volume = 1;
      constructor(public src: string) {}
      play() {
        played.push(this.src);
        return Promise.resolve();
      }
    }
    vi.stubGlobal('Audio', FakeAudio);
    playSound('victory', 0.5);
    playSound('promotion', 0.5);
    expect(played[0]).toMatch(/sfx\/Victory\.ogg/);
    // Umwandlung fehlt im Set: Ersatzkette → Zug
    expect(played[1]).toMatch(/sfx\/Move\.ogg/);
  });

  it('spielt berechnete Töne über ein Audio-Element mit der gewünschten Lautstärke', async () => {
    await useAppearance.getState().select('sounds', 'builtin:synth');
    const played: { src: string; volume: number }[] = [];
    class FakeAudio {
      volume = 1;
      constructor(public src: string) {}
      play() {
        played.push({ src: this.src, volume: this.volume });
        return Promise.resolve();
      }
    }
    vi.stubGlobal('Audio', FakeAudio);
    vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:ton' });
    playSound('capture', 0.4);
    playSound('move', 0);
    expect(played).toEqual([{ src: 'blob:ton', volume: 0.4 }]);
  });

  it('wirft nicht, wenn Abspielen scheitert', () => {
    class BrokenAudio {
      volume = 1;
      play() {
        return Promise.reject(new Error('nicht erlaubt'));
      }
    }
    vi.stubGlobal('Audio', BrokenAudio);
    expect(() => playSound('check')).not.toThrow();
  });
});
