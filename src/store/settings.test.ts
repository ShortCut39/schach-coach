import { getSettingsStorage } from './persistence';
import { DEFAULT_SETTINGS, settingsSchema, useSettings } from './settings';

describe('Einstellungen', () => {
  it('ersetzen ungültige gespeicherte Werte durch Standardwerte', () => {
    const parsed = settingsSchema.parse({
      engineDepth: 99,
      multiPv: 3,
      notation: 'fr',
      thresholds: { inaccuracy: 10, mistake: 5, blunder: 20 },
      llm: { preset: 'ollama', baseUrl: 'http://localhost:11434/v1', model: 'llama3.1' },
    });
    expect(parsed.engineDepth).toBe(20);
    expect(parsed.notation).toBe('de');
    expect(parsed.thresholds).toEqual({ inaccuracy: 5, mistake: 10, blunder: 20 });
    expect(parsed.llm.model).toBe('llama3.1');
  });

  it('speichern ohne API-Key und laden wieder', async () => {
    await useSettings.getState().save({ ...DEFAULT_SETTINGS, notation: 'en', engineDepth: 16 });
    const stored = (await getSettingsStorage().get('settings')) as Record<string, unknown>;
    expect(stored).toMatchObject({ notation: 'en', engineDepth: 16 });
    expect(JSON.stringify(stored)).not.toMatch(/key/i);

    useSettings.setState({ ...DEFAULT_SETTINGS });
    await useSettings.getState().load();
    expect(useSettings.getState().notation).toBe('en');
    expect(useSettings.getState().engineDepth).toBe(16);
    await useSettings.getState().save(DEFAULT_SETTINGS);
  });
});
