import { strToU8, zipSync, type Zippable } from 'fflate';
import { expandArchives } from './uploads';
import { isZip, readZip, safeEntryName, ZIP_LIMITS } from './zip';

const accept = (name: string) => /\.(svg|png)$/i.test(name);

describe('ZIP-Import', () => {
  it('entpackt Bilder und nimmt nur den Dateinamen', () => {
    const archive = zipSync({
      'set/wK.svg': strToU8('<svg/>'),
      'set/readme.txt': strToU8('hallo'),
      'bK.png': strToU8('png'),
    });
    expect(isZip(archive)).toBe(true);
    const result = readZip(archive, accept);
    expect(result.ok && result.files.map((f) => f.name).sort()).toEqual(['bK.png', 'wK.svg']);
  });

  it.each([
    ['../wK.svg', null],
    ['a/../../wK.svg', null],
    ['/etc/wK.svg', null],
    ['C:/x/wK.svg', null],
    ['a\\..\\wK.svg', null],
    ['__MACOSX/._wK.svg', null],
    ['.hidden.svg', null],
    ['ordner/', null],
    ['ordner/unter/wK.svg', 'wK.svg'],
  ])('Eintrag %s → %s', (path, expected) => {
    expect(safeEntryName(path)).toBe(expected);
  });

  it('verwirft Pfad-Tricks im Archiv', () => {
    const archive = zipSync({ '../wK.svg': strToU8('<svg/>'), 'ok/bK.svg': strToU8('<svg/>') });
    const result = readZip(archive, accept);
    expect(result.ok && result.files.map((f) => f.name)).toEqual(['bK.svg']);
  });

  it('lehnt Archive mit zu vielen Einträgen ab', () => {
    const entries: Zippable = {};
    for (let i = 0; i <= ZIP_LIMITS.entries; i++) entries[`f${i}.svg`] = strToU8('<svg/>');
    expect(readZip(zipSync(entries), accept)).toEqual({ ok: false, error: 'tooManyFiles' });
  });

  it('lehnt Archive ab, die entpackt zu groß werden (auch stark komprimiert)', () => {
    // 3 × 4 MB Nullen: komprimiert winzig, entpackt über der Gesamtgrenze
    const zeros = new Uint8Array(4 * 1024 * 1024);
    const archive = zipSync({ 'a.png': zeros, 'b.png': zeros, 'c.png': zeros }, { level: 9 });
    expect(archive.length).toBeLessThan(100_000);
    expect(readZip(archive, accept)).toEqual({ ok: false, error: 'tooLarge' });
  });

  it('meldet kaputte Archive', () => {
    const broken = zipSync({ 'wK.svg': strToU8('<svg/>'.repeat(100)) }).slice(0, 40);
    expect(readZip(broken, accept)).toEqual({ ok: false, error: 'broken' });
  });

  it('mischt ZIP-Inhalte und Einzeldateien, Fehler je Archiv', () => {
    const good = zipSync({ 'wK.svg': strToU8('<svg/>') });
    const result = expandArchives(
      [
        { name: 'satz.zip', bytes: good },
        { name: 'bK.svg', bytes: strToU8('<svg/>') },
        { name: 'kaputt.zip', bytes: good.slice(0, 30) },
      ],
      accept,
    );
    expect(result.files.map((f) => f.name)).toEqual(['wK.svg', 'bK.svg']);
    expect(result.errors).toEqual([{ name: 'kaputt.zip', error: 'broken' }]);
  });
});
