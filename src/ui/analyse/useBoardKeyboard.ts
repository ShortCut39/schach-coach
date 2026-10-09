import { useEffect } from 'react';
import { useGame } from '../../store/game';

/** Felder und Bedienelemente, die Pfeiltasten selbst brauchen (Reiter, Radiogruppen, Regler) */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
    target.closest('[role="tablist"], [role="radiogroup"], [role="slider"]') !== null
  );
}

/** Tastatur: ←/→ Zug, Pos1/Ende, F Brett drehen. Nicht aktiv, während in ein Feld getippt wird. */
export function useBoardKeyboard(): void {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey || event.altKey || event.metaKey || isTyping(event.target)) return;
      const game = useGame.getState();
      const actions: Record<string, () => void> = {
        ArrowLeft: game.prev,
        ArrowRight: game.next,
        Home: game.first,
        End: game.last,
        f: game.flip,
        F: game.flip,
      };
      const action = actions[event.key];
      if (!action) return;
      event.preventDefault();
      action();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
