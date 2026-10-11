import { z } from 'zod';
import { create } from 'zustand';
import { getSettingsStorage } from '../store/persistence';
import {
  builtinBoardTheme,
  DEFAULT_BOARD_THEME,
  isHexColor,
  migrateBoardTheme,
  type BoardLook,
} from './boards';
import { builtinPieceSet, DEFAULT_PIECE_SET, type PieceUrls } from './pieces';
import { isSoundEvent, type SoundEvent } from './soundMapping';
import { builtinSoundSet, DEFAULT_SOUND_SET, type SoundSources } from './sounds';
import { getAppearanceStorage } from './storage';
import { customId, isCustomId, PIECE_CODES, uuidOf, type AssetKind, type PieceCode } from './types';
import { AUDIO_MIME, checkAudio, checkImage, IMAGE_MIME, LIMITS } from './validate';

/** Gespeicherte Auswahl (Schlüssel `appearance` in der Einstellungs-Ablage) */
export const appearanceSchema = z.object({
  pieceSetId: z.string().catch(DEFAULT_PIECE_SET),
  boardThemeId: z.string().catch(DEFAULT_BOARD_THEME),
  soundSetId: z.string().catch(DEFAULT_SOUND_SET),
  showCoordinates: z.boolean().catch(true),
  /** Figuren gleiten beim Zug (aus: springen sofort, schneller in WebKitGTK) */
  animatePieces: z.boolean().catch(true),
});
export type Appearance = z.infer<typeof appearanceSchema>;
export const DEFAULT_APPEARANCE: Appearance = appearanceSchema.parse({});

const STORAGE_KEY = 'appearance';
export const ASSET_KINDS: readonly AssetKind[] = ['pieces', 'boards', 'sounds'];

/** `meta.json` eines eigenen Satzes */
export const customMetaSchema = z.object({
  name: z.string().trim().min(1).max(60),
  created: z.string(),
  kind: z.enum(['pieces', 'boards', 'sounds']),
  /** Nur Bretter aus Farben */
  light: z.string().optional(),
  dark: z.string().optional(),
});
export type CustomMeta = z.infer<typeof customMetaSchema>;

export interface CustomSet {
  /** `custom:<uuid>` */
  id: string;
  kind: AssetKind;
  name: string;
  created: string;
  files: string[];
  /** Brett aus zwei Farben (statt Bild) */
  colors?: { light: string; dark: string };
  /** Nicht lesbar oder unvollständig: wird nicht benutzt */
  broken: boolean;
}

/** Aktive Töne: eigene Quellen und (bei eigenen Sets) das Standard-Set für freie Plätze */
export interface ActiveSounds {
  id: string;
  own: SoundSources;
  fallback: SoundSources | null;
}

const idField = { pieces: 'pieceSetId', boards: 'boardThemeId', sounds: 'soundSetId' } as const;
const defaults = {
  pieces: DEFAULT_PIECE_SET,
  boards: DEFAULT_BOARD_THEME,
  sounds: DEFAULT_SOUND_SET,
} as const;

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('Mitgelieferter Standard fehlt');
  return value;
}

const defaultPieces = required(builtinPieceSet(DEFAULT_PIECE_SET)).urls;
const defaultBoard = required(builtinBoardTheme(DEFAULT_BOARD_THEME)).look;
const defaultSounds = (): ActiveSounds => ({
  id: DEFAULT_SOUND_SET,
  own: builtinSoundSet(DEFAULT_SOUND_SET)?.sources ?? {},
  fallback: null,
});

interface AppearanceState extends Appearance {
  loaded: boolean;
  custom: Record<AssetKind, CustomSet[]>;
  /** Aufgelöste aktive Auswahl (immer gültig, notfalls der Standard) */
  pieces: PieceUrls;
  board: BoardLook;
  sounds: ActiveSounds;
  /** Bereiche, in denen eine gespeicherte Auswahl fehlte oder defekt war (einmaliger Hinweis) */
  fallbacks: AssetKind[];
  /** Lädt Auswahl und eigene Sätze (einmal beim Start). */
  load: () => Promise<void>;
  /** Wählt einen Satz; `false`, wenn er nicht nutzbar ist (dann gilt der Standard). */
  select: (kind: AssetKind, id: string) => Promise<boolean>;
  setShowCoordinates: (show: boolean) => Promise<void>;
  /** Übernimmt eine ganze Auswahl (Einstellungen → „Speichern“); liefert, was danach gilt. */
  saveAll: (next: Appearance) => Promise<Appearance>;
  reset: (kind: AssetKind) => Promise<void>;
  /** Liest die Liste eigener Sätze neu (nach Hochladen, Umbenennen, Löschen). */
  refreshCustom: (kind: AssetKind) => Promise<void>;
  dismissFallbacks: () => void;
}

/** Erzeugte Objekt-URLs je Bereich, damit sie beim Wechsel freigegeben werden */
const ownedUrls: Record<AssetKind, string[]> = { pieces: [], boards: [], sounds: [] };
/** Zähler je Bereich: Ergebnisse veralteter Auswahl-Vorgänge werden verworfen */
const requests: Record<AssetKind, number> = { pieces: 0, boards: 0, sounds: 0 };
/** Eigene Töne bekommen bei jedem Laden neue Schlüssel (Rust legt sie unter dem Schlüssel ab) */
let soundRevision = 0;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/** Objekt-URL für Bytes (ohne `URL.createObjectURL`, z. B. in jsdom: data-URL) */
export function objectUrl(bytes: Uint8Array, mime: string): string {
  if (typeof URL.createObjectURL === 'function') {
    return URL.createObjectURL(new Blob([bytes.slice().buffer], { type: mime }));
  }
  return `data:${mime};base64,${bytesToBase64(bytes)}`;
}

function releaseUrls(urls: string[]): void {
  for (const url of urls) {
    if (url.startsWith('blob:') && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(url);
    }
  }
}

function toCustomSet(kind: AssetKind, uuid: string, meta: unknown, files: string[]): CustomSet {
  const parsed = customMetaSchema.safeParse(meta);
  const base = {
    id: customId(uuid),
    kind,
    files,
    name: parsed.success ? parsed.data.name : '',
    created: parsed.success ? parsed.data.created : '',
  };
  if (!parsed.success || parsed.data.kind !== kind) return { ...base, broken: true };
  const { light, dark } = parsed.data;
  const colors = light && dark && isHexColor(light) && isHexColor(dark) ? { light, dark } : null;
  const complete =
    kind === 'pieces'
      ? PIECE_CODES.every((code) => files.some((f) => f.startsWith(`${code}.`)))
      : kind === 'boards'
        ? !!colors || files.some((f) => f.startsWith('board.'))
        : files.some((f) => isSoundEvent(f.split('.')[0] ?? ''));
  return { ...base, ...(colors ? { colors } : {}), broken: !complete };
}

async function listCustom(kind: AssetKind): Promise<CustomSet[]> {
  try {
    const stored = await getAppearanceStorage().list(kind);
    return stored
      .map((set) => toCustomSet(kind, set.uuid, set.meta, set.files))
      .sort((a, b) => a.created.localeCompare(b.created));
  } catch {
    return [];
  }
}

type Resolved<K extends AssetKind> = K extends 'pieces'
  ? PieceUrls
  : K extends 'boards'
    ? BoardLook
    : ActiveSounds;

async function readFile(kind: AssetKind, set: CustomSet, file: string): Promise<Uint8Array> {
  return getAppearanceStorage().read(kind, uuidOf(set.id), file);
}

/** Lädt und prüft einen eigenen Satz; `null` bei Fehlern. Erzeugte URLs landen in `urls`. */
async function resolveCustom(
  kind: AssetKind,
  set: CustomSet,
  urls: string[],
): Promise<Resolved<AssetKind> | null> {
  if (set.broken) return null;
  if (kind === 'pieces') {
    const result: Partial<PieceUrls> = {};
    for (const code of PIECE_CODES) {
      const file = set.files.find((f) => f.startsWith(`${code}.`));
      if (!file) return null;
      const bytes = await readFile(kind, set, file);
      const check = checkImage(bytes, LIMITS.piece, ['svg', 'png', 'webp']);
      if (!check.ok) return null;
      const url = objectUrl(bytes, IMAGE_MIME[check.type]);
      urls.push(url);
      result[code as PieceCode] = url;
    }
    return result as PieceUrls;
  }
  if (kind === 'boards') {
    if (set.colors) return { kind: 'colors', ...set.colors };
    const file = set.files.find((f) => f.startsWith('board.'));
    if (!file) return null;
    const bytes = await readFile(kind, set, file);
    const check = checkImage(bytes, LIMITS.board, ['svg', 'png', 'webp', 'jpg']);
    if (!check.ok) return null;
    const url = objectUrl(bytes, IMAGE_MIME[check.type]);
    urls.push(url);
    return { kind: 'image', url };
  }
  const own: SoundSources = {};
  const revision = ++soundRevision;
  for (const file of set.files) {
    const event = file.split('.')[0] ?? '';
    if (!isSoundEvent(event)) continue;
    const bytes = await readFile(kind, set, file);
    const check = checkAudio(bytes);
    if (!check.ok) return null;
    const url = objectUrl(bytes, AUDIO_MIME[check.type]);
    urls.push(url);
    own[event as SoundEvent] = {
      type: 'file',
      key: `custom:${uuidOf(set.id)}:${event}:${revision}`,
      url,
      bytes: async () => bytes,
    };
  }
  if (Object.keys(own).length === 0) return null;
  return { id: set.id, own, fallback: defaultSounds().own };
}

/** Löst eine Kennung auf; `null`, wenn es den Satz nicht gibt oder er defekt ist. */
async function resolve(
  kind: AssetKind,
  id: string,
  custom: CustomSet[],
  urls: string[],
): Promise<Resolved<AssetKind> | null> {
  if (isCustomId(id)) {
    const set = custom.find((s) => s.id === id);
    if (!set) return null;
    try {
      return await resolveCustom(kind, set, urls);
    } catch {
      return null;
    }
  }
  if (kind === 'pieces') return builtinPieceSet(id)?.urls ?? null;
  if (kind === 'boards') return builtinBoardTheme(id)?.look ?? null;
  const set = builtinSoundSet(id);
  return set ? { id, own: set.sources, fallback: null } : null;
}

function resolvedField(kind: AssetKind, value: Resolved<AssetKind>) {
  if (kind === 'pieces') return { pieces: value as PieceUrls };
  if (kind === 'boards') return { board: value as BoardLook };
  return { sounds: value as ActiveSounds };
}

function defaultResolved(kind: AssetKind): Resolved<AssetKind> {
  if (kind === 'pieces') return defaultPieces;
  if (kind === 'boards') return defaultBoard;
  return defaultSounds();
}

export function pickAppearance(state: Appearance): Appearance {
  return {
    pieceSetId: state.pieceSetId,
    boardThemeId: state.boardThemeId,
    soundSetId: state.soundSetId,
    showCoordinates: state.showCoordinates,
    animatePieces: state.animatePieces,
  };
}

async function persist(state: Appearance): Promise<void> {
  try {
    await getSettingsStorage().set(STORAGE_KEY, pickAppearance(state));
  } catch {
    // Speichern fehlgeschlagen: die Auswahl gilt trotzdem bis zum Neustart
  }
}

export const useAppearance = create<AppearanceState>()((set, get) => {
  /** Setzt die Auswahl eines Bereichs; bei Fehlern still der Standard (`fallback` = Hinweis zeigen). */
  async function apply(kind: AssetKind, id: string, fallback: boolean): Promise<boolean> {
    const request = ++requests[kind];
    const urls: string[] = [];
    const resolved = await resolve(kind, id, get().custom[kind], urls);
    if (request !== requests[kind]) {
      releaseUrls(urls);
      return resolved !== null;
    }
    releaseUrls(ownedUrls[kind]);
    ownedUrls[kind] = urls;
    if (resolved) {
      set({ [idField[kind]]: id, ...resolvedField(kind, resolved) } as Partial<AppearanceState>);
      return true;
    }
    const custom = get().custom[kind].map((s) => (s.id === id ? { ...s, broken: true } : s));
    set({
      [idField[kind]]: defaults[kind],
      ...resolvedField(kind, defaultResolved(kind)),
      custom: { ...get().custom, [kind]: custom },
      ...(fallback && !get().fallbacks.includes(kind)
        ? { fallbacks: [...get().fallbacks, kind] }
        : {}),
    } as Partial<AppearanceState>);
    return false;
  }

  return {
    ...DEFAULT_APPEARANCE,
    loaded: false,
    custom: { pieces: [], boards: [], sounds: [] },
    pieces: defaultPieces,
    board: defaultBoard,
    sounds: defaultSounds(),
    fallbacks: [],

    load: async () => {
      const storage = getSettingsStorage();
      let saved: Appearance = DEFAULT_APPEARANCE;
      try {
        const raw = await storage.get(STORAGE_KEY);
        if (raw === undefined || raw === null) {
          // Erster Start mit „Darstellung“: bisheriges Brett aus den Einstellungen übernehmen
          const settings = (await storage.get('settings')) as { boardTheme?: unknown } | undefined;
          saved = appearanceSchema.parse({ boardThemeId: migrateBoardTheme(settings?.boardTheme) });
        } else {
          saved = appearanceSchema.parse(raw);
        }
      } catch {
        // Kaputte Ablage: Standard
      }
      const lists = await Promise.all(ASSET_KINDS.map(listCustom));
      set({
        showCoordinates: saved.showCoordinates,
        animatePieces: saved.animatePieces,
        custom: { pieces: lists[0] ?? [], boards: lists[1] ?? [], sounds: lists[2] ?? [] },
      });
      const results = await Promise.all(
        ASSET_KINDS.map((kind) => apply(kind, saved[idField[kind]], true)),
      );
      set({ loaded: true });
      if (results.some((ok) => !ok)) await persist(get());
    },

    select: async (kind, id) => {
      const ok = await apply(kind, id, false);
      await persist(get());
      return ok;
    },

    setShowCoordinates: async (showCoordinates) => {
      set({ showCoordinates });
      await persist(get());
    },

    saveAll: async (next) => {
      for (const kind of ASSET_KINDS) {
        const id = next[idField[kind]];
        if (id !== get()[idField[kind]]) await apply(kind, id, false);
      }
      set({ showCoordinates: next.showCoordinates, animatePieces: next.animatePieces });
      await persist(get());
      return pickAppearance(get());
    },

    reset: async (kind) => {
      await get().select(kind, defaults[kind]);
    },

    refreshCustom: async (kind) => {
      const list = await listCustom(kind);
      set({ custom: { ...get().custom, [kind]: list } });
      const current = get()[idField[kind]];
      // Aktiver eigener Satz geändert oder gelöscht: neu laden bzw. auf den Standard zurück
      if (isCustomId(current)) {
        if (!(await apply(kind, current, false))) await persist(get());
      }
    },

    dismissFallbacks: () => set({ fallbacks: [] }),
  };
});

/** Aufgelöste Auswahl eines Bereichs, z. B. für die Vorschau eines noch nicht gespeicherten Entwurfs */
export type ResolvedSelection =
  | { kind: 'pieces'; value: PieceUrls }
  | { kind: 'boards'; value: BoardLook }
  | { kind: 'sounds'; value: ActiveSounds };

/**
 * Löst eine Kennung auf, ohne sie zu übernehmen. `release` gibt erzeugte Objekt-URLs wieder frei.
 * `null`, wenn es den Satz nicht gibt oder er defekt ist.
 */
export async function resolveSelection(
  kind: AssetKind,
  id: string,
): Promise<{ selection: ResolvedSelection; release: () => void } | null> {
  const urls: string[] = [];
  const value = await resolve(kind, id, useAppearance.getState().custom[kind], urls);
  if (!value) {
    releaseUrls(urls);
    return null;
  }
  return {
    selection: { kind, value } as ResolvedSelection,
    release: () => releaseUrls(urls),
  };
}

/** Entwurf ohne gelöschte eigene Sätze (die fallen auf den Standard zurück) */
export function effectiveDraft(
  draft: Appearance,
  custom: Record<AssetKind, CustomSet[]>,
): Appearance {
  const next = { ...draft };
  for (const kind of ASSET_KINDS) {
    const id = draft[idField[kind]];
    if (isCustomId(id) && !custom[kind].some((set) => set.id === id && !set.broken)) {
      next[idField[kind]] = defaults[kind];
    }
  }
  return next;
}

export const APPEARANCE_ID_FIELD = idField;
export const APPEARANCE_DEFAULTS = defaults;

/** Nur für Tests: zurück auf den Anfangszustand */
export function resetAppearanceForTests(): void {
  for (const kind of ASSET_KINDS) {
    releaseUrls(ownedUrls[kind]);
    ownedUrls[kind] = [];
    requests[kind] = 0;
  }
  useAppearance.setState({
    ...DEFAULT_APPEARANCE,
    loaded: false,
    custom: { pieces: [], boards: [], sounds: [] },
    pieces: defaultPieces,
    board: defaultBoard,
    sounds: defaultSounds(),
    fallbacks: [],
  });
}
