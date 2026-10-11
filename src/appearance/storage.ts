import { invoke, isTauri } from '@tauri-apps/api/core';
import type { AssetKind } from './types';

/** Ein gespeicherter eigener Satz, wie er aus der Ablage kommt (noch ungeprüft) */
export interface StoredSet {
  /** UUID (ohne Präfix) */
  uuid: string;
  /** Inhalt von `meta.json`, `undefined` wenn sie fehlt oder kaputt ist */
  meta: unknown;
  /** Dateinamen ohne `meta.json`, z. B. `wK.svg` */
  files: string[];
}

/**
 * Ablage eigener Figuren, Bretter und Töne. In der Desktop-App im App-Datenordner über die
 * Rust-Befehle aus `src-tauri/src/appearance.rs` (nur dieser Ordner, nur feste Dateinamen);
 * im Browser-Modus und in Tests nur im Arbeitsspeicher.
 */
export interface AppearanceStorage {
  list(kind: AssetKind): Promise<StoredSet[]>;
  read(kind: AssetKind, uuid: string, file: string): Promise<Uint8Array>;
  write(kind: AssetKind, uuid: string, file: string, bytes: Uint8Array): Promise<void>;
  removeFile(kind: AssetKind, uuid: string, file: string): Promise<void>;
  remove(kind: AssetKind, uuid: string): Promise<void>;
}

function parseMeta(text: string | null): unknown {
  if (text === null) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function rustStorage(): AppearanceStorage {
  return {
    list: async (kind) =>
      (
        await invoke<{ id: string; meta: string | null; files: string[] }[]>('appearance_list', {
          kind,
        })
      ).map((set) => ({ uuid: set.id, meta: parseMeta(set.meta), files: set.files })),
    read: async (kind, uuid, file) =>
      new Uint8Array(await invoke<ArrayBuffer>('appearance_read', { kind, id: uuid, file })),
    write: async (kind, uuid, file, bytes) => {
      await invoke('appearance_write', bytes, {
        headers: { 'x-kind': kind, 'x-id': uuid, 'x-file': file },
      });
    },
    removeFile: async (kind, uuid, file) => {
      await invoke('appearance_remove_file', { kind, id: uuid, file });
    },
    remove: async (kind, uuid) => {
      await invoke('appearance_delete', { kind, id: uuid });
    },
  };
}

export function memoryAppearanceStorage(): AppearanceStorage {
  const data = new Map<string, Map<string, Uint8Array>>();
  const setKey = (kind: AssetKind, uuid: string) => `${kind}/${uuid}`;
  const stem = (file: string) => file.split('.')[0];
  return {
    list: async (kind) =>
      [...data.entries()]
        .filter(([key]) => key.startsWith(`${kind}/`))
        .map(([key, files]) => {
          const meta = files.get('meta.json');
          return {
            uuid: key.slice(kind.length + 1),
            meta: meta ? parseMeta(new TextDecoder().decode(meta)) : undefined,
            files: [...files.keys()].filter((f) => f !== 'meta.json').sort(),
          };
        }),
    read: async (kind, uuid, file) => {
      const bytes = data.get(setKey(kind, uuid))?.get(file);
      if (!bytes) throw new Error('failed');
      return bytes;
    },
    write: async (kind, uuid, file, bytes) => {
      const files = data.get(setKey(kind, uuid)) ?? new Map<string, Uint8Array>();
      // Wie in Rust: derselbe Platz mit anderer Endung wird ersetzt
      for (const name of [...files.keys()]) {
        if (name !== file && stem(name) === stem(file)) files.delete(name);
      }
      files.set(file, bytes.slice());
      data.set(setKey(kind, uuid), files);
    },
    removeFile: async (kind, uuid, file) => {
      data.get(setKey(kind, uuid))?.delete(file);
    },
    remove: async (kind, uuid) => {
      data.delete(setKey(kind, uuid));
    },
  };
}

let storage: AppearanceStorage | null = null;

export function getAppearanceStorage(): AppearanceStorage {
  storage ??= isTauri() ? rustStorage() : memoryAppearanceStorage();
  return storage;
}

/** Nur für Tests */
export function setAppearanceStorage(next: AppearanceStorage): void {
  storage = next;
}
