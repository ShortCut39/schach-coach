import { BUILTIN, PIECE_CODES, type PieceCode } from './types';
import { THIRD_PARTY_ASSETS } from './thirdParty';

export type PieceUrls = Record<PieceCode, string>;

/** Mitgelieferte Figuren als URLs (Vite legt die SVGs als eigene Dateien ab bzw. bettet kleine ein). */
const files = import.meta.glob<string>('../assets/pieces/*/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
});

function urlsFor(set: string): PieceUrls | null {
  const urls: Partial<PieceUrls> = {};
  for (const code of PIECE_CODES) {
    const url = files[`../assets/pieces/${set}/${code}.svg`];
    if (!url) return null;
    urls[code] = url;
  }
  return urls as PieceUrls;
}

export interface BuiltinPieceSet {
  id: string;
  name: string;
  urls: PieceUrls;
}

export const DEFAULT_PIECE_SET = `${BUILTIN}cburnett`;

/** Reihenfolge wie in `thirdParty.ts`; Standard zuerst */
export const BUILTIN_PIECE_SETS: readonly BuiltinPieceSet[] = THIRD_PARTY_ASSETS.filter(
  (asset) => asset.kind === 'pieces',
).flatMap((asset) => {
  const urls = urlsFor(asset.id);
  return urls ? [{ id: `${BUILTIN}${asset.id}`, name: asset.name, urls }] : [];
});

export function builtinPieceSet(id: string): BuiltinPieceSet | undefined {
  return BUILTIN_PIECE_SETS.find((set) => set.id === id);
}
