import { useGame } from '../../store/game';
import { useLibrary } from '../../store/library';
import { useNavigation } from '../../store/navigation';

/** Öffnet eine Partie aus der Bibliothek an einem bestimmten Halbzug. */
export function useOpenAt() {
  const open = useLibrary((s) => s.open);
  const setAnalyseView = useNavigation((s) => s.setAnalyseView);
  return async (gameId: string, ply?: number) => {
    if (!(await open(gameId))) return;
    if (ply !== undefined) useGame.getState().goTo(ply);
    setAnalyseView('board');
  };
}
