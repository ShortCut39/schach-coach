const calls: { command: string; args: Record<string, unknown> }[] = [];

vi.mock('@tauri-apps/api/core', () => ({
  isTauri: () => true,
  invoke: async (command: string, args: Record<string, unknown>) => {
    calls.push({ command, args });
  },
}));

const { playSound, resetSoundsForTests } = await import('./sound');
const { SAMPLE_RATE } = await import('./soundSynth');

describe('Töne in der Desktop-App (über Rust, nicht über die WebView)', () => {
  beforeEach(() => {
    calls.length = 0;
    resetSoundsForTests();
  });

  it('übergibt die Samples einmal je Tonart und spielt dann nur noch ab', async () => {
    const audio = vi.fn();
    vi.stubGlobal('Audio', audio);
    playSound('move', 0.5);
    playSound('move', 0.8);
    playSound('capture', 1.5);
    await vi.waitFor(() => expect(calls.filter((c) => c.command === 'sound_play')).toHaveLength(3));

    const registers = calls.filter((c) => c.command === 'sound_register');
    expect(registers.map((c) => c.args.kind)).toEqual(['move', 'capture']);
    expect(registers[0]?.args.sampleRate).toBe(SAMPLE_RATE);
    expect(Array.isArray(registers[0]?.args.samples)).toBe(true);
    expect(calls.filter((c) => c.command === 'sound_play').map((c) => c.args)).toEqual([
      { kind: 'move', volume: 0.5 },
      { kind: 'move', volume: 0.8 },
      { kind: 'capture', volume: 1 },
    ]);
    // Kein Audio-Element in der WebView
    expect(audio).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('spielt bei Lautstärke 0 nichts', async () => {
    playSound('check', 0);
    await new Promise((r) => setTimeout(r, 0));
    expect(calls).toEqual([]);
  });
});
