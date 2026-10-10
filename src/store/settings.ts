import { z } from 'zod';
import { create } from 'zustand';
import { DEFAULT_CLASSIFICATION } from '../classification/types';
import { DEFAULT_SEARCH } from '../engine/types';
import { applyLanguage } from '../i18n';
import { LLM_PRESETS } from '../llm/presets';
import { LEVELS } from '../play/opponent/levels';
import { getSettingsStorage } from './persistence';

const presetIds = LLM_PRESETS.map((p) => p.id) as [string, ...string[]];

const DEFAULT_THRESHOLDS = {
  inaccuracy: DEFAULT_CLASSIFICATION.inaccuracy,
  mistake: DEFAULT_CLASSIFICATION.mistake,
  blunder: DEFAULT_CLASSIFICATION.blunder,
};

const threshold = z.number().min(1).max(60);

const DEFAULT_PLAY = {
  autoAnalyse: false,
  sounds: true,
  volume: 70,
  minutes: 10,
  increment: 0,
  noClock: false,
  level: 'medium' as const,
  color: 'random' as const,
  evalBar: false,
  rated: false,
  mode: 'local' as const,
  lichessNoticeSeen: false,
};

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
  /** Sprache der Oberfläche und der KI-Erklärungen */
  language: z.enum(['de', 'en']).catch('de'),
  notation: z.enum(['de', 'en']).catch('de'),
  boardTheme: z.enum(['standard', 'wood', 'sage']).catch('standard'),
  showArrows: z.boolean().catch(true),
  /** Aus welchen eigenen Fehlern Trainingsaufgaben entstehen */
  training: z
    .object({
      blunders: z.boolean().catch(true),
      missed: z.boolean().catch(true),
      inaccuracies: z.boolean().catch(false),
    })
    .catch({ blunders: true, missed: true, inaccuracies: false }),
  /** Spielen: Einstellungen und zuletzt gewählte Partie-Optionen */
  play: z
    .object({
      /** Nach der Partie automatisch analysieren */
      autoAnalyse: z.boolean().catch(DEFAULT_PLAY.autoAnalyse),
      sounds: z.boolean().catch(DEFAULT_PLAY.sounds),
      /** Lautstärke der Töne in Prozent */
      volume: z.number().int().min(0).max(100).catch(DEFAULT_PLAY.volume),
      /** Grundzeit in Minuten (wie bei Lichess höchstens 180) */
      minutes: z.number().min(1).max(180).catch(DEFAULT_PLAY.minutes),
      /** Inkrement in Sekunden */
      increment: z.number().int().min(0).max(180).catch(DEFAULT_PLAY.increment),
      /** Lokal ohne Uhr spielen */
      noClock: z.boolean().catch(DEFAULT_PLAY.noClock),
      level: z.enum(LEVELS).catch(DEFAULT_PLAY.level),
      color: z.enum(['w', 'b', 'random']).catch(DEFAULT_PLAY.color),
      /** Bewertungsbalken in lokalen Partien */
      evalBar: z.boolean().catch(DEFAULT_PLAY.evalBar),
      /** Lichess: gewertet suchen */
      rated: z.boolean().catch(DEFAULT_PLAY.rated),
      /** Zuletzt gewählter Gegner: lokal gegen Stockfish oder Lichess */
      mode: z.enum(['local', 'lichess']).catch(DEFAULT_PLAY.mode),
      /** Fair-Play-Hinweis vor der ersten Lichess-Partie bestätigt */
      lichessNoticeSeen: z.boolean().catch(DEFAULT_PLAY.lichessNoticeSeen),
    })
    .catch(DEFAULT_PLAY),
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
    language: state.language,
    notation: state.notation,
    boardTheme: state.boardTheme,
    showArrows: state.showArrows,
    online: state.online,
    training: state.training,
    play: state.play,
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
      applyLanguage(loaded.language);
      set({ ...loaded, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },
  save: async (next) => {
    const valid = settingsSchema.parse(next);
    applyColorScheme(valid.colorScheme);
    applyLanguage(valid.language);
    set(valid);
    await getSettingsStorage().set(STORAGE_KEY, valid);
  },
}));
