import { useEffect, useMemo } from 'react';
import { create } from 'zustand';
import { classifyGame } from '../../classification/classify';
import {
  loadOpeningBook,
  openingInfo,
  type OpeningBook,
  type OpeningInfo,
} from '../../classification/openingBook';
import { DEFAULT_CLASSIFICATION, type PlyAnalysis } from '../../classification/types';
import { useGame } from '../../store/game';
import { useSettings } from '../../store/settings';
import { useCurrentEvals } from './useAnalysisFor';

const useBook = create<{ book: OpeningBook | null }>()(() => ({ book: null }));

/** Lädt das Eröffnungsbuch beim ersten Bedarf. */
function useOpeningBook(): OpeningBook | null {
  const book = useBook((s) => s.book);
  useEffect(() => {
    if (!book) void loadOpeningBook().then((loaded) => useBook.setState({ book: loaded }));
  }, [book]);
  return book;
}

export interface GameAnalysis {
  /** Ergebnis je Halbzug (Index = Halbzug), `undefined` solange Bewertungen fehlen */
  plies: (PlyAnalysis | undefined)[];
  opening: OpeningInfo | undefined;
}

const NONE: GameAnalysis = { plies: [], opening: undefined };

/** Kategorien, Gewinnchancen und Eröffnung der geladenen Partie (neu berechnet, wenn Bewertungen eintreffen). */
export function useGameAnalysis(): GameAnalysis {
  const source = useGame((s) => s.source);
  const evals = useCurrentEvals();
  const book = useOpeningBook();
  const thresholds = useSettings((s) => s.thresholds);

  return useMemo(() => {
    if (source?.kind !== 'game' || !book) return NONE;
    const opening = openingInfo(source, book);
    const config = { ...DEFAULT_CLASSIFICATION, ...thresholds };
    return { plies: classifyGame(source, evals, opening?.bookPlies ?? 0, config), opening };
  }, [source, evals, book, thresholds]);
}
