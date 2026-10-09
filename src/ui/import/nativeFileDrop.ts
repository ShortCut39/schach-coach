import { useEffect, useEffectEvent, useState } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { getCurrentWebview } from '@tauri-apps/api/webview';

export type FileReadError = 'unsupported' | 'tooLarge' | 'unreadable';

export type FileReadResult =
  { ok: true; name: string; bytes: ArrayBuffer } | { ok: false; error: FileReadError };

const KNOWN_ERRORS: readonly string[] = ['unsupported', 'tooLarge', 'unreadable'];

export function fileNameOf(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

/** Lässt den Rust-Befehl `read_import_file` eine abgelegte Datei lesen (Endung und Größe werden dort geprüft). */
export async function readImportFile(path: string): Promise<FileReadResult> {
  try {
    const bytes = await invoke<ArrayBuffer>('read_import_file', { path });
    return { ok: true, name: fileNameOf(path), bytes };
  } catch (error) {
    const code = typeof error === 'string' && KNOWN_ERRORS.includes(error) ? error : 'unreadable';
    return { ok: false, error: code as FileReadError };
  }
}

/**
 * Drag & Drop von Dateien in der Desktop-App.
 * WebKitGTK liefert beim HTML5-Drop unter Linux keine Dateiinhalte, deshalb nutzen wir
 * Tauris eigenes Ereignis: Es meldet die Pfade, die Datei liest dann der Rust-Teil.
 * Im Browser (ohne Tauri) passiert hier nichts, dort greift der HTML5-Weg der DropZone.
 *
 * @returns `true`, solange eine Datei über dem Fenster schwebt
 */
export function useNativeFileDrop(onResult: (result: FileReadResult) => void): boolean {
  const [hovering, setHovering] = useState(false);
  const deliver = useEffectEvent(onResult);

  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;

    void getCurrentWebview()
      .onDragDropEvent(async (event) => {
        const payload = event.payload;
        if (payload.type === 'enter' || payload.type === 'over') setHovering(true);
        else if (payload.type === 'leave') setHovering(false);
        else {
          setHovering(false);
          const path = payload.paths[0];
          if (path) deliver(await readImportFile(path));
        }
      })
      .then((fn) => {
        if (disposed) fn();
        else unlisten = fn;
      });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  return hovering;
}
