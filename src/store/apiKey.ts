import { create } from 'zustand';
import { getSecretStorage } from './persistence';

interface ApiKeyState {
  /** Key für `baseUrl` (nur im Arbeitsspeicher, nie in Einstellungen oder Logs) */
  key: string;
  baseUrl: string | null;
  /** Gibt es einen Schlüsselbund? `null` = noch nicht geprüft */
  keyringAvailable: boolean | null;
  /** Lädt den Key, der zu dieser Base-URL gespeichert ist. */
  loadFor: (baseUrl: string) => Promise<string>;
  /** Speichert den Key zu dieser Base-URL (leer = löschen). */
  saveFor: (baseUrl: string, key: string) => Promise<void>;
}

export const useApiKey = create<ApiKeyState>()((set) => ({
  key: '',
  baseUrl: null,
  keyringAvailable: null,
  loadFor: async (baseUrl) => {
    const storage = getSecretStorage();
    const available = await storage.available().catch(() => false);
    const key = (await storage.get(baseUrl).catch(() => null)) ?? '';
    set({ key, baseUrl, keyringAvailable: available });
    return key;
  },
  saveFor: async (baseUrl, key) => {
    await getSecretStorage().set(baseUrl, key);
    set({ key: key.trim(), baseUrl });
  },
}));
