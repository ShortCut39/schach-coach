import { useEffect, useMemo } from 'react';
import { create } from 'zustand';
import { computeGameAnalysis, type GameAnalysis } from '../../classification/gameAnalysis';
import { loadOpeningBook, type OpeningBook } from '../../classification/openingBook';
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

const NONE: GameAnalysis = { plies: [], opening: undefined, unnoticed: new Set() };

/** Kategorien, Gewinnchancen und Eröffnung der geladenen Partie (neu berechnet, wenn Bewertungen eintreffen). */
export function useGameAnalysis(): GameAnalysis {
  const source = useGame((s) => s.source);
  const evals = useCurrentEvals();
  const book = useOpeningBook();
  const thresholds = useSettings((s) => s.thresholds);

  return useMemo(
    () =>
      source?.kind === 'game' && book ? computeGameAnalysis(source, evals, book, thresholds) : NONE,
    [source, evals, book, thresholds],
  );
}
