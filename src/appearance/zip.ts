import { unzipSync } from 'fflate';
import { MB } from './validate';

/** Eine hochgeladene Datei (Name ohne Pfad, Inhalt) */
export interface UploadFile {
  name: string;
  bytes: Uint8Array;
}

/** Grenzen für ZIP-Archive */
export const ZIP_LIMITS = {
  /** Größe des Archivs selbst */
  archiveBytes: 20 * MB,
  /** Summe aller entpackten Dateien */
  totalBytes: 10 * MB,
  /** Einzelne entpackte Datei */
  fileBytes: 5 * MB,
  /** Höchstzahl Einträge im Archiv (sonst wird es ganz abgelehnt) */
  entries: 64,
} as const;

export type ZipError = 'tooLarge' | 'tooManyFiles' | 'broken';

export function isZip(bytes: Uint8Array): boolean {
  return bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

/**
 * Nur der Dateiname zählt; Einträge mit Pfad-Tricks (`..`, absolute Pfade, Laufwerke, `\`),
 * versteckte Dateien und macOS-Beiwerk werden verworfen. Liefert `null` zum Überspringen.
 */
export function safeEntryName(path: string): string | null {
  if (path.endsWith('/')) return null;
  if (path.includes('\\') || path.startsWith('/') || /^[a-z]:/i.test(path)) return null;
  const parts = path.split('/');
  if (parts.some((part) => part === '..' || part === '.')) return null;
  if (parts[0] === '__MACOSX') return null;
  const name = parts.at(-1) ?? '';
  if (!name || name.startsWith('.')) return null;
  // Steuerzeichen im Namen: lieber weglassen
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f]/.test(name)) return null;
  return name;
}

/**
 * Entpackt ein ZIP-Archiv mit festen Grenzen. Die Größen werden vor dem Entpacken aus dem
 * Verzeichnis geprüft; fflate entpackt jede Datei in einen Puffer genau dieser Größe, eine
 * gefälschte Größenangabe kann also nicht mehr Speicher belegen.
 */
export function readZip(
  bytes: Uint8Array,
  accept: (name: string) => boolean,
): { ok: true; files: UploadFile[] } | { ok: false; error: ZipError } {
  if (bytes.length > ZIP_LIMITS.archiveBytes) return { ok: false, error: 'tooLarge' };
  let entries = 0;
  let total = 0;
  let limit: ZipError | null = null;
  const names = new Map<string, string>();
  let unzipped: Record<string, Uint8Array>;
  try {
    unzipped = unzipSync(bytes, {
      filter: (file) => {
        entries++;
        if (entries > ZIP_LIMITS.entries) limit = 'tooManyFiles';
        const name = safeEntryName(file.name);
        if (limit || !name || !accept(name) || names.has(name)) return false;
        if (file.originalSize > ZIP_LIMITS.fileBytes) return false;
        total += file.originalSize;
        if (total > ZIP_LIMITS.totalBytes) {
          limit = 'tooLarge';
          return false;
        }
        names.set(name, file.name);
        return true;
      },
    });
  } catch {
    return { ok: false, error: 'broken' };
  }
  if (limit) return { ok: false, error: limit };
  const files: UploadFile[] = [];
  for (const [name, path] of names) {
    const data = unzipped[path];
    if (data) files.push({ name, bytes: data });
  }
  return { ok: true, files };
}
