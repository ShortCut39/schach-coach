import { invoke } from '@tauri-apps/api/core';
import { isZip, readZip, type UploadFile, type ZipError } from './zip';
import { MB } from './validate';

export type { UploadFile } from './zip';

/** Fehler beim Einlesen (vor der inhaltlichen Prüfung) */
export type ReadError = ZipError | 'unreadable' | 'type' | 'link';

export interface ReadResult {
  files: UploadFile[];
  /** `target`: bei `link` die Datei, auf die verwiesen wird */
  errors: { name: string; error: ReadError; target?: string }[];
}

/**
 * Git-Verweis (Symlink), der beim Herunterladen als winzige Textdatei angekommen ist, z. B.
 * `Victory.ogg` mit dem Inhalt `GenericNotify.ogg` (so im Lichess-Quellcode). Liefert das Ziel.
 */
export function linkTarget(bytes: Uint8Array): string | null {
  if (bytes.length === 0 || bytes.length > 200) return null;
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes).trim();
  } catch {
    return null;
  }
  return /^[\w.\-/]+\.(ogg|oga|mp3|wav|flac|svg|png|webp|jpe?g)$/i.test(text) ? text : null;
}

/**
 * Ersetzt Verweis-Dateien durch die Datei, auf die sie zeigen, wenn diese mit hochgeladen wurde
 * (der Name bleibt, damit `Victory.ogg` den Platz „Sieg“ belegt). Sonst ein verständlicher Fehler.
 */
export function resolveLinks(result: ReadResult): ReadResult {
  const byName = new Map(result.files.map((file) => [file.name, file]));
  const resolved: ReadResult = { files: [], errors: [...result.errors] };
  for (const file of result.files) {
    const target = linkTarget(file.bytes);
    if (!target) {
      resolved.files.push(file);
      continue;
    }
    const found = byName.get(nameOf(target));
    if (found && !linkTarget(found.bytes))
      resolved.files.push({ name: file.name, bytes: found.bytes });
    else resolved.errors.push({ name: file.name, error: 'link', target: nameOf(target) });
  }
  return resolved;
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
  return resolveLinks(result);
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
