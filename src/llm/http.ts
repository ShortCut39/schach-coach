import { isTauri } from '@tauri-apps/api/core';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import type { FetchFn } from './types';

/**
 * In der Desktop-App laufen Anfragen über das Tauri-HTTP-Plugin (kein CORS-Problem bei lokalen
 * Servern). Im reinen Browser-Modus (`pnpm dev`) bleibt nur `fetch` des Browsers.
 */
export function getFetch(): FetchFn {
  return isTauri() ? (url, init) => tauriFetch(url, init) : (url, init) => fetch(url, init);
}
