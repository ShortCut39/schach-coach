import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { OAuthBridge, OAuthCallback } from './oauth';

/** Anmeldung per Browser gibt es nur in der Desktop-App (Loopback-Server im Rust-Teil). */
export function browserLoginAvailable(): boolean {
  return isTauri();
}

/** Lichess-Seite öffnen: in der Desktop-App im Standardbrowser (nur https://lichess.org/…). */
export async function openLichessPage(url: string): Promise<void> {
  if (isTauri()) await invoke('lichess_open', { url });
  else window.open(url, '_blank', 'noopener,noreferrer');
}

export function tauriOAuthBridge(): OAuthBridge {
  let pending: Promise<OAuthCallback> | null = null;
  let finish: ((result: OAuthCallback) => void) | null = null;
  return {
    listen: async () => {
      // Erst auf das Ereignis hören, dann den Port öffnen: So geht keine Rückleitung verloren
      pending = new Promise<OAuthCallback>((resolve) => {
        finish = resolve;
      });
      const unlisten = await listen<OAuthCallback>('lichess-oauth', (event) =>
        finish?.(event.payload),
      );
      void pending.finally(unlisten);
      return invoke<number>('lichess_oauth_listen');
    },
    waitForCallback: () => pending ?? Promise.resolve({ error: 'failed' }),
    open: openLichessPage,
    cancel: () => {
      void invoke('lichess_oauth_cancel').catch(() => undefined);
      finish?.({ error: 'cancelled' });
    },
  };
}
