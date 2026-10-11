import type { SoundEvent } from './soundMapping';
import { getAppearanceStorage } from './storage';
import { useAppearance, type CustomMeta } from './store';
import { customId, uuidOf, type AssetKind, type PieceCode } from './types';
import { MAX_CUSTOM_SETS, type AudioType, type ImageType } from './validate';

/**
 * Anlegen, Umbenennen und Löschen eigener Sätze. Die Dateien sind vorher geprüft (Dialoge mit
 * `validate.ts`); gespeichert wird unter festen Namen (`wK.svg`, `board.png`, `move.ogg`).
 */
export type SaveError = 'limit' | 'failed';

export class CustomSetError extends Error {
  constructor(public readonly code: SaveError) {
    super(code);
  }
}

export interface CheckedImage {
  bytes: Uint8Array;
  type: ImageType;
}

export interface CheckedAudio {
  bytes: Uint8Array;
  type: AudioType;
}

const encode = (meta: CustomMeta) => new TextEncoder().encode(JSON.stringify(meta));

function newUuid(): string {
  return crypto.randomUUID().toLowerCase();
}

function ensureRoom(kind: AssetKind): void {
  if (useAppearance.getState().custom[kind].length >= MAX_CUSTOM_SETS) {
    throw new CustomSetError('limit');
  }
}

/** Schreibt einen neuen Satz; bei Fehlern wird der halbe Satz wieder entfernt. */
async function create(
  kind: AssetKind,
  meta: Omit<CustomMeta, 'created' | 'kind'>,
  files: [string, Uint8Array][],
): Promise<string> {
  ensureRoom(kind);
  const storage = getAppearanceStorage();
  const uuid = newUuid();
  try {
    for (const [name, bytes] of files) await storage.write(kind, uuid, name, bytes);
    await storage.write(
      kind,
      uuid,
      'meta.json',
      encode({ ...meta, kind, created: new Date().toISOString() }),
    );
  } catch {
    await storage.remove(kind, uuid).catch(() => undefined);
    throw new CustomSetError('failed');
  }
  await useAppearance.getState().refreshCustom(kind);
  return customId(uuid);
}

export function createPieceSet(
  name: string,
  pieces: Record<PieceCode, CheckedImage>,
): Promise<string> {
  return create(
    'pieces',
    { name },
    Object.entries(pieces).map(([code, file]) => [`${code}.${file.type}`, file.bytes]),
  );
}

export function createColorBoard(name: string, light: string, dark: string): Promise<string> {
  return create('boards', { name, light, dark }, []);
}

export function createImageBoard(name: string, image: CheckedImage): Promise<string> {
  return create('boards', { name }, [[`board.${image.type}`, image.bytes]]);
}

export function createSoundSet(
  name: string,
  sounds: Partial<Record<SoundEvent, CheckedAudio>>,
): Promise<string> {
  return create(
    'sounds',
    { name },
    Object.entries(sounds).map(([event, file]) => [`${event}.${file.type}`, file.bytes]),
  );
}

/** Ersetzt oder entfernt (`null`) den Ton eines Platzes in einem vorhandenen eigenen Set. */
export async function updateSoundSlot(
  id: string,
  event: SoundEvent,
  file: CheckedAudio | null,
): Promise<void> {
  const storage = getAppearanceStorage();
  const set = useAppearance.getState().custom.sounds.find((s) => s.id === id);
  try {
    if (file) {
      await storage.write('sounds', uuidOf(id), `${event}.${file.type}`, file.bytes);
    } else {
      const existing = set?.files.find((f) => f.startsWith(`${event}.`));
      if (existing) await storage.removeFile('sounds', uuidOf(id), existing);
    }
  } catch {
    throw new CustomSetError('failed');
  }
  await useAppearance.getState().refreshCustom('sounds');
}

export async function renameSet(kind: AssetKind, id: string, name: string): Promise<void> {
  const set = useAppearance.getState().custom[kind].find((s) => s.id === id);
  if (!set) return;
  const meta: CustomMeta = {
    name,
    kind,
    created: set.created || new Date().toISOString(),
    ...(set.colors ?? {}),
  };
  try {
    await getAppearanceStorage().write(kind, uuidOf(id), 'meta.json', encode(meta));
  } catch {
    throw new CustomSetError('failed');
  }
  await useAppearance.getState().refreshCustom(kind);
}

export async function deleteSet(kind: AssetKind, id: string): Promise<void> {
  try {
    await getAppearanceStorage().remove(kind, uuidOf(id));
  } catch {
    throw new CustomSetError('failed');
  }
  await useAppearance.getState().refreshCustom(kind);
}
