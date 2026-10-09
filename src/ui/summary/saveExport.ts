import { invoke, isTauri } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';

export type SaveResult =
  { kind: 'saved'; name: string } | { kind: 'cancelled' } | { kind: 'failed' };

/**
 * Speichert Markdown: in der Desktop-App über den Speichern-Dialog (der Rust-Befehl schreibt nur
 * `.md`-Dateien), im Browser-Modus als Download.
 */
export async function saveMarkdown(fileName: string, content: string): Promise<SaveResult> {
  if (!isTauri()) {
    const url = URL.createObjectURL(new Blob([content], { type: 'text/markdown;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
    return { kind: 'saved', name: fileName };
  }
  try {
    const path = await save({
      defaultPath: fileName,
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    });
    if (!path) return { kind: 'cancelled' };
    const target = path.toLowerCase().endsWith('.md') ? path : `${path}.md`;
    await invoke('write_export_file', { path: target, content });
    return { kind: 'saved', name: target.split(/[\\/]/).pop() ?? target };
  } catch {
    return { kind: 'failed' };
  }
}
