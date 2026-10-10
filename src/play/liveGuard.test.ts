import { UciEngine } from '../engine/engine';
import { chatCompletion } from '../llm/client';
import { LlmError, type FetchFn } from '../llm/types';
import { useAnalysis } from '../store/analysis';
import { getEngine, getEngines, setEngineTransportFactory } from '../store/engine';
import { fakeEngineTransport } from '../test/fakeEngine';
import {
  activateLiveGuard,
  assertNotLive,
  isLiveGuardActive,
  LiveGuardError,
  releaseLiveGuard,
} from './liveGuard';
import { parsePgnGame } from '../chess/pgn';

const config = { baseUrl: 'https://example.test/v1', apiKey: '', model: 'test' };
const okFetch: FetchFn = async () =>
  new Response(JSON.stringify({ choices: [{ message: { content: 'OK' } }] }), { status: 200 });

const game = parsePgnGame('1. e4 e5 2. Nf3 Nc6 *');
if (!game.ok) throw new Error('Testpartie ungültig');

describe('Fair-Play-Sperre (Live-Partie)', () => {
  afterEach(() => {
    releaseLiveGuard();
    setEngineTransportFactory(fakeEngineTransport);
    useAnalysis.getState().reset();
  });

  it('ist ohne Live-Partie aus', () => {
    expect(isLiveGuardActive()).toBe(false);
    expect(() => assertNotLive('engine')).not.toThrow();
  });

  it('verhindert den Start einer Engine', async () => {
    activateLiveGuard('abc12345');
    await expect(getEngines(1)).rejects.toBeInstanceOf(LiveGuardError);
    await expect(getEngine()).rejects.toBeInstanceOf(LiveGuardError);
    // Auch eine neu erzeugte Engine (z. B. die Gegner-Engine) startet nicht
    const engine = new UciEngine(fakeEngineTransport());
    await expect(engine.init()).rejects.toBeInstanceOf(LiveGuardError);
  });

  it('lässt eine schon laufende Engine nicht mehr rechnen', async () => {
    const engine = new UciEngine(fakeEngineTransport());
    await engine.init();
    activateLiveGuard('abc12345');
    await expect(
      engine.search('8/8/8/8/8/8/k7/4K3 w - - 0 1', { depth: 5, multipv: 1 }),
    ).rejects.toBeInstanceOf(LiveGuardError);
  });

  it('beendet beim Partiestart die Analyse-Engines (nicht nur ausblenden)', async () => {
    let terminated = 0;
    setEngineTransportFactory(() => {
      const transport = fakeEngineTransport();
      return {
        ...transport,
        terminate: () => {
          terminated++;
          transport.terminate();
        },
      };
    });
    await getEngines(2);
    activateLiveGuard('abc12345');
    expect(terminated).toBe(2);
  });

  it('lässt keine Analyse laufen', async () => {
    activateLiveGuard('abc12345');
    await useAnalysis.getState().start(game.value, { depth: 8, multipv: 1 });
    const state = useAnalysis.getState();
    expect(state.status).not.toBe('done');
    expect(state.evals.every((e) => e === undefined)).toBe(true);
  });

  it('verweigert jeden KI-Aufruf, ohne etwas zu senden', async () => {
    activateLiveGuard('abc12345');
    const fetchFn = vi.fn(okFetch);
    const call = chatCompletion(
      config,
      [{ role: 'user', content: 'Hallo' }],
      { jsonMode: false },
      fetchFn,
    );
    await expect(call).rejects.toMatchObject({ code: 'liveGame' });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('bricht eine laufende KI-Anfrage beim Partiestart ab', async () => {
    const fetchFn: FetchFn = (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new Error('abgebrochen')));
      });
    const call = chatCompletion(
      config,
      [{ role: 'user', content: 'Hallo' }],
      { jsonMode: false },
      fetchFn,
    );
    activateLiveGuard('abc12345');
    await expect(call).rejects.toBeInstanceOf(LlmError);
    await expect(call).rejects.toMatchObject({ code: 'liveGame' });
  });

  it('gibt nach Partieende alles wieder frei', async () => {
    activateLiveGuard('abc12345');
    // Eine andere Partie hebt die Sperre nicht auf
    releaseLiveGuard('andere');
    expect(isLiveGuardActive()).toBe(true);
    releaseLiveGuard('abc12345');
    expect(isLiveGuardActive()).toBe(false);

    expect(await getEngines(1)).toHaveLength(1);
    await useAnalysis.getState().start(game.value, { depth: 8, multipv: 1 });
    expect(useAnalysis.getState().status).toBe('done');
    const result = await chatCompletion(
      config,
      [{ role: 'user', content: 'Hallo' }],
      { jsonMode: false },
      okFetch,
    );
    expect(result.content).toBe('OK');
  });
});
