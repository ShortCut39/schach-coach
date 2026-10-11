import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BUILTIN_PIECE_SETS } from './pieces';
import { BUILTIN_SOUND_SETS } from './sounds';
import { THIRD_PARTY_ASSETS } from './thirdParty';

const root = resolve(__dirname, '../..');
const markdown = readFileSync(resolve(root, 'THIRD_PARTY_ASSETS.md'), 'utf8');

describe('Mitgelieferte fremde Dateien', () => {
  it.each(THIRD_PARTY_ASSETS)(
    '$name steht mit Autor, Lizenz und Quelle in THIRD_PARTY_ASSETS.md',
    (asset) => {
      const row = markdown.split('\n').find((line) => line.startsWith(`| ${asset.name} `));
      expect(row).toBeDefined();
      expect(row).toContain(asset.author);
      expect(row).toContain(asset.license);
      expect(row).toContain(asset.licenseFile);
      expect(row).toContain(asset.source);
    },
  );

  it.each(THIRD_PARTY_ASSETS)('Lizenztext für $name liegt in assets/licenses', (asset) => {
    expect(existsSync(resolve(root, 'assets/licenses', asset.licenseFile))).toBe(true);
  });

  it('liefert nur aufgelistete Ordner aus', () => {
    const listed = (kind: string) =>
      THIRD_PARTY_ASSETS.filter((a) => a.kind === kind)
        .map((a) => a.id)
        .sort();
    expect(readdirSync(resolve(root, 'src/assets/pieces')).sort()).toEqual(listed('pieces'));
    expect(readdirSync(resolve(root, 'src/assets/sounds')).sort()).toEqual(listed('sounds'));
  });

  it('jeder Figurensatz hat alle zwölf Figuren, jedes Ton-Set seine Töne', () => {
    expect(BUILTIN_PIECE_SETS.map((s) => s.id)).toEqual(
      THIRD_PARTY_ASSETS.filter((a) => a.kind === 'pieces').map((a) => `builtin:${a.id}`),
    );
    for (const set of BUILTIN_SOUND_SETS.filter((s) => s.id !== 'builtin:synth')) {
      expect(Object.keys(set.sources).sort()).toEqual(
        [
          'check',
          'capture',
          'defeat',
          'draw',
          'gameEnd',
          'gameStart',
          'lowTime',
          'move',
          'victory',
        ].sort(),
      );
    }
  });

  it('enthält keine Lichess-Standardtöne', () => {
    expect(existsSync(resolve(root, 'src/assets/sounds/standard'))).toBe(false);
    expect(THIRD_PARTY_ASSETS.some((a) => a.id === 'standard')).toBe(false);
  });
});
