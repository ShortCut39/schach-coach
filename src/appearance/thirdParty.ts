/**
 * Mitgelieferte fremde Dateien: Name, Autor, Lizenz, Quelle. Dieselbe Liste steht in
 * `THIRD_PARTY_ASSETS.md` (ein Test prüft das); die Lizenztexte liegen in `assets/licenses/`.
 * Nur Dateien mit eindeutig freier Lizenz (Stand von Lichess `COPYING.md`, 11.10.2026).
 */
export interface ThirdPartyAsset {
  /** Kennung des Satzes ohne Präfix, z. B. `cburnett` */
  id: string;
  name: string;
  kind: 'pieces' | 'sounds';
  author: string;
  license: string;
  /** Datei in `assets/licenses/` */
  licenseFile: string;
  source: string;
}

const LILA = 'https://github.com/lichess-org/lila/tree/master/public';

export const THIRD_PARTY_ASSETS: readonly ThirdPartyAsset[] = [
  {
    id: 'cburnett',
    name: 'cburnett',
    kind: 'pieces',
    author: 'Colin M.L. Burnett',
    license: 'GPLv2+',
    licenseFile: 'GPL-2.0.txt',
    source: `${LILA}/piece/cburnett`,
  },
  {
    id: 'merida',
    name: 'Merida',
    kind: 'pieces',
    author: 'Armando Hernandez Marroquin',
    license: 'GPLv2+',
    licenseFile: 'GPL-2.0.txt',
    source: `${LILA}/piece/merida`,
  },
  {
    id: 'chessnut',
    name: 'Chessnut',
    kind: 'pieces',
    author: 'Alexis Luengas',
    license: 'Apache 2.0',
    licenseFile: 'Apache-2.0.txt',
    source: `${LILA}/piece/chessnut`,
  },
  {
    id: 'rhosgfx',
    name: 'RhosGFX',
    kind: 'pieces',
    author: 'RhosGFX',
    license: 'CC0 1.0',
    licenseFile: 'CC0-1.0.txt',
    source: `${LILA}/piece/rhosgfx`,
  },
  {
    id: 'fantasy',
    name: 'Fantasy',
    kind: 'pieces',
    author: 'Maurizio Monge',
    license: 'MIT',
    licenseFile: 'MIT-fantasy.txt',
    source: `${LILA}/piece/fantasy`,
  },
  {
    id: 'pixel',
    name: 'Pixel',
    kind: 'pieces',
    author: 'therealqtpi',
    license: 'AGPLv3+',
    licenseFile: 'AGPL-3.0.txt',
    source: `${LILA}/piece/pixel`,
  },
  {
    id: 'sfx',
    name: 'SFX',
    kind: 'sounds',
    author: 'Enigmahack',
    license: 'AGPLv3+',
    licenseFile: 'AGPL-3.0.txt',
    source: `${LILA}/sound/sfx`,
  },
  {
    id: 'piano',
    name: 'Piano',
    kind: 'sounds',
    author: 'Enigmahack',
    license: 'AGPLv3+',
    licenseFile: 'AGPL-3.0.txt',
    source: `${LILA}/sound/piano`,
  },
  {
    id: 'nes',
    name: 'NES',
    kind: 'sounds',
    author: 'Enigmahack',
    license: 'AGPLv3+',
    licenseFile: 'AGPL-3.0.txt',
    source: `${LILA}/sound/nes`,
  },
  {
    id: 'futuristic',
    name: 'Futuristic',
    kind: 'sounds',
    author: 'Enigmahack',
    license: 'AGPLv3+',
    licenseFile: 'AGPL-3.0.txt',
    source: `${LILA}/sound/futuristic`,
  },
];

export function thirdPartyAsset(id: string): ThirdPartyAsset | undefined {
  return THIRD_PARTY_ASSETS.find((asset) => asset.id === id);
}
