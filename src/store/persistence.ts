import { invoke, isTauri } from '@tauri-apps/api/core';
import { load } from '@tauri-apps/plugin-store';

/** Ablage für Einstellungen (JSON im App-Datenordner). */
export interface KeyValueStorage {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
}

/** Ablage für den API-Key (Schlüsselbund des Betriebssystems). */
export interface SecretStorage {
  available(): Promise<boolean>;
  get(baseUrl: string): Promise<string | null>;
  set(baseUrl: string, key: string): Promise<void>;
}

function tauriStorage(): KeyValueStorage {
  const store = load('settings.json', { autoSave: false, defaults: {} });
  return {
    get: async (key) => (await store).get(key),
    set: async (key, value) => {
      const s = await store;
      await s.set(key, value);
      await s.save();
    },
  };
}

/** Nur für den Browser-Modus (`pnpm dev` ohne Tauri). */
function browserStorage(): KeyValueStorage {
  return {
    get: async (key) => {
      const raw = localStorage.getItem(`schach-coach:${key}`);
      return raw === null ? undefined : (JSON.parse(raw) as unknown);
    },
    set: async (key, value) => localStorage.setItem(`schach-coach:${key}`, JSON.stringify(value)),
  };
}

export function memoryStorage(): KeyValueStorage {
  const data = new Map<string, unknown>();
  return {
    get: async (key) => data.get(key),
    set: async (key, value) => void data.set(key, value),
  };
}

function keyringSecrets(): SecretStorage {
  return {
    available: () => invoke<boolean>('api_key_available'),
    get: (baseUrl) => invoke<string | null>('api_key_get', { baseUrl }),
    set: async (baseUrl, key) => {
      await invoke('api_key_set', { baseUrl, key });
    },
  };
}

/**
 * Ohne Tauri (Browser-Modus, Tests) gibt es keinen Schlüsselbund: Der Key liegt dann nur im
 * Arbeitsspeicher und ist nach dem Neuladen weg. Zuordnung je Origin wie im Schlüsselbund.
 */
export function memorySecrets(): SecretStorage {
  const data = new Map<string, string>();
  const origin = (baseUrl: string) => {
    try {
      return new URL(baseUrl).origin;
    } catch {
      return baseUrl;
    }
  };
  return {
    available: async () => false,
    get: async (baseUrl) => data.get(origin(baseUrl)) ?? null,
    set: async (baseUrl, key) => {
      if (key.trim()) data.set(origin(baseUrl), key.trim());
      else data.delete(origin(baseUrl));
    },
  };
}

let settingsStorage: KeyValueStorage | null = null;
let secretStorage: SecretStorage | null = null;

export function getSettingsStorage(): KeyValueStorage {
  settingsStorage ??= isTauri() ? tauriStorage() : browserStorage();
  return settingsStorage;
}

export function getSecretStorage(): SecretStorage {
  secretStorage ??= isTauri() ? keyringSecrets() : memorySecrets();
  return secretStorage;
}

/** Nur für Tests */
export function setStorages(settings: KeyValueStorage, secrets: SecretStorage): void {
  settingsStorage = settings;
  secretStorage = secrets;
}

/** Ablage der Bibliothek: kleine Metadaten für die Liste, große Datensätze getrennt. */
export interface LibraryStorage {
  list(): Promise<unknown[]>;
  get(id: string): Promise<unknown>;
  save(id: string, meta: unknown, record: unknown): Promise<void>;
  remove(id: string): Promise<void>;
}

function rustLibrary(): LibraryStorage {
  const parse = (text: string | null) => (text === null ? null : (JSON.parse(text) as unknown));
  return {
    list: async () =>
      (await invoke<string[]>('library_list')).flatMap((text) => {
        try {
          return [JSON.parse(text) as unknown];
        } catch {
          return [];
        }
      }),
    get: async (id) => parse(await invoke<string | null>('library_get', { id })),
    save: async (id, meta, record) => {
      await invoke('library_save', {
        id,
        meta: JSON.stringify(meta),
        record: JSON.stringify(record),
      });
    },
    remove: async (id) => {
      await invoke('library_delete', { id });
    },
  };
}

/** Browser-Modus und Tests: alles in einer Key-Value-Ablage. */
export function keyValueLibrary(storage: KeyValueStorage): LibraryStorage {
  const ids = async () => ((await storage.get('library:ids')) as string[] | undefined) ?? [];
  return {
    list: async () => Promise.all((await ids()).map((id) => storage.get(`library:meta:${id}`))),
    get: (id) => storage.get(`library:record:${id}`),
    save: async (id, meta, record) => {
      await storage.set(`library:record:${id}`, record);
      await storage.set(`library:meta:${id}`, meta);
      const all = await ids();
      if (!all.includes(id)) await storage.set('library:ids', [...all, id]);
    },
    remove: async (id) => {
      await storage.set(
        'library:ids',
        (await ids()).filter((x) => x !== id),
      );
      await storage.set(`library:record:${id}`, null);
      await storage.set(`library:meta:${id}`, null);
    },
  };
}

let libraryStorage: LibraryStorage | null = null;

export function getLibraryStorage(): LibraryStorage {
  libraryStorage ??= isTauri() ? rustLibrary() : keyValueLibrary(getSettingsStorage());
  return libraryStorage;
}

/** Nur für Tests */
export function setLibraryStorage(storage: LibraryStorage): void {
  libraryStorage = storage;
}

/** Ablage des Lichess-Tokens (Schlüsselbund; ohne Tauri nur im Arbeitsspeicher). */
export interface TokenStorage {
  get(): Promise<string | null>;
  set(token: string): Promise<void>;
}

export function memoryTokenStorage(): TokenStorage {
  let value: string | null = null;
  return {
    get: async () => value,
    set: async (token) => {
      value = token.trim() || null;
    },
  };
}

function keyringToken(): TokenStorage {
  return {
    get: () => invoke<string | null>('lichess_token_get'),
    set: async (token) => {
      await invoke('lichess_token_set', { token });
    },
  };
}

let tokenStorage: TokenStorage | null = null;

export function getTokenStorage(): TokenStorage {
  tokenStorage ??= isTauri() ? keyringToken() : memoryTokenStorage();
  return tokenStorage;
}

/** Nur für Tests */
export function setTokenStorage(storage: TokenStorage): void {
  tokenStorage = storage;
}
