import { create } from 'zustand';
import { getFetch } from '../llm/http';
import type { FetchFn } from '../llm/types';
import { tauriOAuthBridge } from '../play/lichess/bridge';
import {
  LichessClient,
  LichessError,
  type LichessAccount,
  type LichessErrorCode,
} from '../play/lichess/client';
import {
  loginWithBrowser,
  LoginError,
  type LoginErrorCode,
  type OAuthBridge,
} from '../play/lichess/oauth';
import { getTokenStorage } from './persistence';

export type LichessAuthStatus =
  'unknown' | 'loggedOut' | 'checking' | 'waitingForBrowser' | 'loggedIn';
export type LichessAuthError = LichessErrorCode | LoginErrorCode | 'keyring';

interface LichessAuthState {
  status: LichessAuthStatus;
  account: LichessAccount | null;
  error: LichessAuthError | null;
  /** Abmelden hat lokal gelöscht, der Widerruf bei Lichess hat aber nicht geklappt */
  revokeFailed: boolean;
  /** Gespeicherten Token laden und prüfen (beim Start bzw. beim Öffnen der Einstellungen) */
  load: () => Promise<void>;
  loginWithBrowser: () => Promise<void>;
  cancelLogin: () => void;
  /** Persönliches API-Token prüfen und speichern */
  loginWithToken: (token: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

/** Token nur hier im Arbeitsspeicher (nicht im Store-Zustand, nie in Logs oder Einstellungen) */
let token = '';
let fetchFn: FetchFn | null = null;
let bridgeFactory: () => OAuthBridge = tauriOAuthBridge;
let activeBridge: OAuthBridge | null = null;

const client = new LichessClient(
  () => token,
  (url, init) => (fetchFn ?? getFetch())(url, init),
);

/** Der gemeinsame Lichess-Client (für Partien in L5) */
export function lichessClient(): LichessClient {
  return client;
}

/** Nur für Tests: andere Netzwerkfunktion bzw. Anmelde-Brücke */
export function setLichessTestDoubles(doubles: { fetch?: FetchFn; bridge?: () => OAuthBridge }) {
  if (doubles.fetch) fetchFn = doubles.fetch;
  if (doubles.bridge) bridgeFactory = doubles.bridge;
}

function codeOf(error: unknown): LichessAuthError {
  if (error instanceof LichessError || error instanceof LoginError) return error.code;
  return 'unreachable';
}

export const useLichessAuth = create<LichessAuthState>()((set, get) => {
  /** Token prüfen (Konto abrufen); bei Erfolg angemeldet */
  async function verify(candidate: string): Promise<LichessAccount> {
    const previous = token;
    token = candidate.trim();
    try {
      return await client.account();
    } catch (error) {
      token = previous;
      throw error;
    }
  }

  async function store(newToken: string, account: LichessAccount): Promise<void> {
    try {
      await getTokenStorage().set(newToken);
    } catch {
      // Ohne Schlüsselbund gilt die Anmeldung nur bis zum Beenden der App
      set({ error: 'keyring' });
    }
    token = newToken.trim();
    set({ status: 'loggedIn', account, revokeFailed: false });
  }

  return {
    status: 'unknown',
    account: null,
    error: null,
    revokeFailed: false,

    load: async () => {
      if (get().status === 'checking' || get().status === 'waitingForBrowser') return;
      set({ status: 'checking', error: null });
      const saved = await getTokenStorage()
        .get()
        .catch(() => null);
      if (!saved) {
        token = '';
        set({ status: 'loggedOut', account: null });
        return;
      }
      try {
        const account = await verify(saved);
        set({ status: 'loggedIn', account });
      } catch (error) {
        const code = codeOf(error);
        // Abgelaufener oder widerrufener Token: abmelden; bei Netzproblemen Token behalten
        if (code === 'unauthorized') {
          token = '';
          await getTokenStorage()
            .set('')
            .catch(() => undefined);
        } else {
          token = saved;
        }
        set({ status: 'loggedOut', account: null, error: code });
      }
    },

    loginWithBrowser: async () => {
      set({ status: 'waitingForBrowser', error: null });
      const bridge = bridgeFactory();
      activeBridge = bridge;
      try {
        const newToken = await loginWithBrowser(bridge, client);
        const account = await verify(newToken);
        await store(newToken, account);
      } catch (error) {
        set({ status: token ? 'loggedIn' : 'loggedOut', error: codeOf(error) });
      } finally {
        activeBridge = null;
      }
    },

    cancelLogin: () => {
      activeBridge?.cancel();
    },

    loginWithToken: async (candidate) => {
      set({ status: 'checking', error: null });
      try {
        const account = await verify(candidate);
        await store(candidate, account);
        return true;
      } catch (error) {
        set({ status: token ? 'loggedIn' : 'loggedOut', error: codeOf(error) });
        return false;
      }
    },

    logout: async () => {
      let revokeFailed = false;
      if (token) {
        try {
          await client.revokeToken();
        } catch (error) {
          // Schon ungültig ist kein Problem; sonst Hinweis, den Token auf Lichess selbst zu löschen
          revokeFailed = !(error instanceof LichessError && error.code === 'unauthorized');
        }
      }
      token = '';
      await getTokenStorage()
        .set('')
        .catch(() => undefined);
      set({ status: 'loggedOut', account: null, error: null, revokeFailed });
    },
  };
});
