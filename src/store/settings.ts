import { z } from 'zod';
import { create } from 'zustand';
import { DEFAULT_CLASSIFICATION } from '../classification/types';
import { DEFAULT_SEARCH } from '../engine/types';
import { LLM_PRESETS } from '../llm/presets';
import { getSettingsStorage } from './persistence';

const presetIds = LLM_PRESETS.map((p) => p.id) as [string, ...string[]];

const DEFAULT_THRESHOLDS = {
  inaccuracy: DEFAULT_CLASSIFICATION.inaccuracy,
  mistake: DEFAULT_CLASSIFICATION.mistake,
  blunder: DEFAULT_CLASSIFICATION.blunder,
};

const threshold = z.number().min(1).max(60);

/**
 * Alle Einstellungen außer dem API-Key (der liegt im Schlüsselbund).
 * Ungültige oder fehlende Werte fallen beim Laden auf den Standard zurück.
 */
export const settingsSchema = z.object({
  llm: z
    .object({
      preset: z.enum(presetIds).catch('openrouter'),
      baseUrl: z.string().catch(LLM_PRESETS[1].baseUrl),
      model: z.string().catch(''),
    })
    .catch({ preset: 'openrouter', baseUrl: LLM_PRESETS[1].baseUrl, model: '' }),
  engineDepth: z.number().int().min(10).max(30).catch(DEFAULT_SEARCH.depth),
  multiPv: z.number().int().min(1).max(5).catch(DEFAULT_SEARCH.multipv),
  /** Native Engine (Sidecar) oder eingebaute WASM-Version */
  engine: z.enum(['native', 'wasm']).catch('native'),
  /** Parallel gerechnete Stellungen; 0 = automatisch */
  threads: z.number().int().min(0).max(16).catch(0),
  level: z.enum(['beginner', 'intermediate', 'club']).catch('beginner'),
  explainScope: z.enum(['errorsAndMyGood', 'errorsOnly', 'all']).catch('errorsAndMyGood'),
  thresholds: z
    .object({ inaccuracy: threshold, mistake: threshold, blunder: threshold })
    .refine((t) => t.inaccuracy < t.mistake && t.mistake < t.blunder)
    .catch(DEFAULT_THRESHOLDS),
  colorScheme: z.enum(['dark', 'light']).catch('dark'),
  notation: z.enum(['de', 'en']).catch('de'),
  boardTheme: z.enum(['standard', 'wood', 'sage']).catch('standard'),
  showArrows: z.boolean().catch(true),
  /** Zuletzt genutztes Konto für den Online-Import */
  online: z
    .object({
      platform: z.enum(['lichess', 'chesscom']).catch('lichess'),
      username: z.string().catch(''),
    })
    .catch({ platform: 'lichess', username: '' }),
});

export type Settings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: Settings = settingsSchema.parse({});
export { DEFAULT_THRESHOLDS };

const STORAGE_KEY = 'settings';

interface SettingsState extends Settings {
  loaded: boolean;
  /** Lädt gespeicherte Einstellungen (einmal beim Start). */
  load: () => Promise<void>;
  /** Übernimmt und speichert neue Einstellungen. */
  save: (next: Settings) => Promise<void>;
}

export function pickSettings(state: Settings): Settings {
  return settingsSchema.parse({
    llm: state.llm,
    engineDepth: state.engineDepth,
    multiPv: state.multiPv,
    engine: state.engine,
    threads: state.threads,
    level: state.level,
    explainScope: state.explainScope,
    thresholds: state.thresholds,
    colorScheme: state.colorScheme,
    notation: state.notation,
    boardTheme: state.boardTheme,
    showArrows: state.showArrows,
    online: state.online,
  });
}

/** Setzt das Farbschema auf dem Dokument (`data-theme`), damit tokens.css umschaltet. */
export function applyColorScheme(scheme: Settings['colorScheme']): void {
  document.documentElement.dataset.theme = scheme;
}

export const useSettings = create<SettingsState>()((set) => ({
  ...DEFAULT_SETTINGS,
  loaded: false,
  load: async () => {
    try {
      const raw = await getSettingsStorage().get(STORAGE_KEY);
      const loaded = settingsSchema.parse(raw ?? {});
      applyColorScheme(loaded.colorScheme);
      set({ ...loaded, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },
  save: async (next) => {
    const valid = settingsSchema.parse(next);
    applyColorScheme(valid.colorScheme);
    set(valid);
    await getSettingsStorage().set(STORAGE_KEY, valid);
  },
}));
