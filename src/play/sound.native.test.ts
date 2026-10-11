const calls: { command: string; args: unknown; options?: unknown }[] = [];

vi.mock('@tauri-apps/api/core', () => ({
  isTauri: () => true,
  invoke: async (command: string, args: unknown, options?: unknown) => {
    calls.push({ command, args, options });
    if (command === 'sound_probe') throw 'tooLong';
  },
}));

const { playSound, probeSound, resetSoundsForTests } = await import('./sound');
const { SAMPLE_RATE } = await import('./soundSynth');
const { resetAppearanceForTests, useAppearance } = await import('../appearance/store');

const plays = () => calls.filter((c) => c.command === 'sound_play').map((c) => c.args);

describe('Töne in der Desktop-App (über Rust, nicht über die WebView)', () => {
  beforeEach(() => {
    resetAppearanceForTests();
    resetSoundsForTests();
    calls.length = 0;
  });
  afterEach(() => vi.unstubAllGlobals());

  it('übergibt berechnete Samples einmal je Ton und spielt dann nur noch ab', async () => {
    await useAppearance.getState().select('sounds', 'builtin:synth');
    calls.length = 0;
    resetSoundsForTests();
    const audio = vi.fn();
    vi.stubGlobal('Audio', audio);
    playSound('move', 0.5);
    playSound('move', 0.8);
    playSound('capture', 1.5);
    await vi.waitFor(() => expect(plays()).toHaveLength(3));

    const registers = calls.filter((c) => c.command === 'sound_register');
    const args = registers.map((c) => c.args as Record<string, unknown>);
    expect(args.map((a) => a.kind)).toEqual(['synth:move', 'synth:capture']);
    expect(args[0]?.sampleRate).toBe(SAMPLE_RATE);
    expect(Array.isArray(args[0]?.samples)).toBe(true);
    expect(plays()).toEqual([
      { kind: 'synth:move', volume: 0.5 },
      { kind: 'synth:move', volume: 0.8 },
      { kind: 'synth:capture', volume: 1 },
    ]);
    // Kein Audio-Element in der WebView
    expect(audio).not.toHaveBeenCalled();
  });

  it('schickt Ton-Dateien als Bytes zum Dekodieren an Rust (Standard-Set sfx)', async () => {
    const fetched: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => {
      fetched.push(url);
      return new Response(new Uint8Array([79, 103, 103, 83]));
    });
    playSound('castle', 0.6);
    await vi.waitFor(() => expect(plays()).toHaveLength(1));
    const register = calls.find((c) => c.command === 'sound_register_file');
    // Rochade hat im Lichess-Set keinen eigenen Ton: Ersatzkette → Zug
    expect(fetched).toHaveLength(1);
    expect(fetched[0]).toMatch(/sfx\/Move\.ogg/);
    expect(register?.args).toBeInstanceOf(Uint8Array);
    expect(register?.options).toEqual({ headers: { 'x-sound-key': 'sfx:Move' } });
    expect(plays()).toEqual([{ kind: 'sfx:Move', volume: 0.6 }]);
  });

  it('dekodiert beim Wechsel des Sets alle Töne vorab', async () => {
    vi.stubGlobal('fetch', async () => new Response(new Uint8Array([79, 103, 103, 83])));
    await useAppearance.getState().select('sounds', 'builtin:nes');
    await vi.waitFor(() =>
      expect(calls.filter((c) => c.command === 'sound_register_file').length).toBeGreaterThan(5),
    );
    const keys = calls
      .filter((c) => c.command === 'sound_register_file')
      .map((c) => (c.options as { headers: Record<string, string> }).headers['x-sound-key']);
    expect(keys).toContain('nes:Victory');
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('spielt bei Lautstärke 0 nichts', async () => {
    playSound('check', 0);
    await new Promise((r) => setTimeout(r, 0));
    expect(calls).toEqual([]);
  });

  it('meldet bei der Probe den Fehlercode aus Rust', async () => {
    expect(await probeSound(new Uint8Array([1, 2, 3]), 'audio/ogg')).toEqual({
      ok: false,
      error: 'tooLong',
    });
  });
});
