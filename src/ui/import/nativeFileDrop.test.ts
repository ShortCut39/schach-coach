import { invoke } from '@tauri-apps/api/core';
import { fileNameOf, readImportFile } from './nativeFileDrop';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(), isTauri: () => true }));
vi.mock('@tauri-apps/api/webview', () => ({ getCurrentWebview: vi.fn() }));

describe('readImportFile', () => {
  it('liefert Name und Inhalt', async () => {
    const bytes = new TextEncoder().encode('1. e4 *').buffer;
    vi.mocked(invoke).mockResolvedValueOnce(bytes);
    expect(await readImportFile('/home/nils/Partien/opera.pgn')).toEqual({
      ok: true,
      name: 'opera.pgn',
      bytes,
    });
    expect(invoke).toHaveBeenCalledWith('read_import_file', {
      path: '/home/nils/Partien/opera.pgn',
    });
  });

  it('übernimmt bekannte Fehlercodes aus Rust', async () => {
    vi.mocked(invoke).mockRejectedValueOnce('tooLarge');
    expect(await readImportFile('/a/b.pgn')).toEqual({ ok: false, error: 'tooLarge' });
    vi.mocked(invoke).mockRejectedValueOnce('unsupported');
    expect(await readImportFile('/a/b.png')).toEqual({ ok: false, error: 'unsupported' });
  });

  it('macht aus unbekannten Fehlern „nicht lesbar“', async () => {
    vi.mocked(invoke).mockRejectedValueOnce(new Error('IPC kaputt'));
    expect(await readImportFile('/a/b.pgn')).toEqual({ ok: false, error: 'unreadable' });
  });
});

describe('fileNameOf', () => {
  it('nimmt den letzten Pfadteil, auch mit Backslashes', () => {
    expect(fileNameOf('/home/nils/x.pgn')).toBe('x.pgn');
    expect(fileNameOf('C:\\Partien\\y.pgn')).toBe('y.pgn');
  });
});
