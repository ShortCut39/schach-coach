import { fakeEngineTransport } from '../test/fakeEngine';
import {
  getEngines,
  poolSize,
  restartEngines,
  setEngineTransportFactory,
  useEngine,
} from './engine';
import { DEFAULT_SETTINGS, useSettings } from './settings';

describe('Engine-Auswahl und Pool', () => {
  afterEach(async () => {
    await useSettings.getState().save(DEFAULT_SETTINGS);
    setEngineTransportFactory(fakeEngineTransport);
  });

  it('nutzt die native Engine, wenn sie startet', async () => {
    const kinds: string[] = [];
    setEngineTransportFactory((kind) => {
      kinds.push(kind);
      return fakeEngineTransport();
    });
    await getEngines(1);
    expect(kinds).toEqual(['native']);
    expect(useEngine.getState()).toMatchObject({
      status: 'ready',
      kind: 'native',
      nativeUnavailable: false,
    });
  });

  it('fällt auf WASM zurück, wenn die native Engine fehlt', async () => {
    setEngineTransportFactory((kind) => {
      if (kind === 'native') throw new Error('Binary fehlt');
      return fakeEngineTransport();
    });
    const engines = await getEngines(1);
    expect(engines).toHaveLength(1);
    expect(useEngine.getState()).toMatchObject({ kind: 'wasm', nativeUnavailable: true });
  });

  it('startet so viele Engines wie eingestellt und nach Änderungen neu', async () => {
    let started = 0;
    setEngineTransportFactory(() => {
      started++;
      return fakeEngineTransport();
    });
    await useSettings.getState().save({ ...DEFAULT_SETTINGS, threads: 3 });
    expect(poolSize()).toBe(3);
    expect(await getEngines(poolSize())).toHaveLength(3);
    expect(started).toBe(3);

    await useSettings.getState().save({ ...DEFAULT_SETTINGS, engine: 'wasm', threads: 2 });
    await restartEngines();
    expect(useEngine.getState().kind).toBe('wasm');
    expect(await getEngines(poolSize())).toHaveLength(2);
  });

  it('wählt automatisch höchstens 4 Engines', async () => {
    await useSettings.getState().save({ ...DEFAULT_SETTINGS, threads: 0 });
    expect(poolSize()).toBeGreaterThanOrEqual(1);
    expect(poolSize()).toBeLessThanOrEqual(4);
  });
});
