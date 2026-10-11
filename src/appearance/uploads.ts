import { invoke } from '@tauri-apps/api/core';
import { isZip, readZip, type UploadFile, type ZipError } from './zip';
import { MB } from './validate';

export type { UploadFile } from './zip';

/** Fehler beim Einlesen (vor der inhaltlichen Prüfung) */
export type ReadError = ZipError | 'unreadable' | 'type';

export interface ReadResult {
  files: UploadFile[];
  errors: { name: string; error: ReadError }[];
}

/** Größte Datei, die überhaupt eingelesen wird (ZIP-Archive; Einzeldateien prüft `validate.ts`) */
const MAX_READ_BYTES = 20 * MB;

function nameOf(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

/** Entpackt ZIP-Archive (mit Grenzen) und sammelt Fehler je Datei. */
export function expandArchives(input: UploadFile[], accept: (name: string) => boolean): ReadResult {
  const result: ReadResult = { files: [], errors: [] };
  for (const file of input) {
    if (isZip(file.bytes)) {
      const zip = readZip(file.bytes, accept);
      if (zip.ok) result.files.push(...zip.files);
      else result.errors.push({ name: file.name, error: zip.error });
    } else {
      result.files.push(file);
    }
  }
  return result;
}

/** Dateien aus dem Datei-Dialog oder einem HTML5-Drop (Browser-Modus) */
export async function readBrowserFiles(list: Iterable<File>): Promise<ReadResult> {
  const result: ReadResult = { files: [], errors: [] };
  for (const file of list) {
    if (file.size > MAX_READ_BYTES) {
      result.errors.push({ name: file.name, error: 'tooLarge' });
      continue;
    }
    try {
      result.files.push({
        name: nameOf(file.name),
        bytes: new Uint8Array(await file.arrayBuffer()),
      });
    } catch {
      result.errors.push({ name: file.name, error: 'unreadable' });
    }
  }
  return result;
}

/** Desktop-App: abgelegte Dateien über Rust lesen (Endung und Größe prüft `appearance_read_dropped`) */
export async function readDroppedPaths(paths: string[]): Promise<ReadResult> {
  const result: ReadResult = { files: [], errors: [] };
  for (const path of paths) {
    try {
      const bytes = await invoke<ArrayBuffer>('appearance_read_dropped', { path });
      result.files.push({ name: nameOf(path), bytes: new Uint8Array(bytes) });
    } catch (error) {
      result.errors.push({
        name: nameOf(path),
        error: error === 'type' ? 'type' : error === 'tooLarge' ? 'tooLarge' : 'unreadable',
      });
    }
  }
  return result;
}

export function mergeResults(a: ReadResult, b: ReadResult): ReadResult {
  return { files: [...a.files, ...b.files], errors: [...a.errors, ...b.errors] };
}
