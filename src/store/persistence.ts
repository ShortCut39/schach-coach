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
