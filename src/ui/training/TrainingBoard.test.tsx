import { fireEvent, render } from '@testing-library/react';
import { TrainingBoard } from './TrainingBoard';

const CASTLING = 'r3k2r/pppq1ppp/2npbn2/2b1p3/2B1P3/2NPBN2/PPPQ1PPP/R3K2R w KQkq - 0 1';

function square(id: string): HTMLElement {
  const element = document.getElementById(`training-board-square-${id}`);
  if (!element) throw new Error(`Feld ${id} fehlt`);
  return element;
}
/** Die Hervorhebung legt react-chessboard auf das innere Element des Felds */
const marked = (id: string) =>
  (square(id).lastElementChild as HTMLElement | null)?.style.backgroundImage ?? '';

function renderBoard(onMove = vi.fn()) {
  render(
    <TrainingBoard
      fen={CASTLING}
      orientation="white"
      interactive
      onMove={onMove}
      arrows={[]}
      label="Trainingsbrett"
    />,
  );
  return onMove;
}

describe('Trainingsbrett', () => {
  it('zeigt nach dem Anklicken die möglichen Felder', () => {
    renderBoard();
    fireEvent.click(square('e1'));
    expect(marked('g1')).toContain('radial-gradient');
    expect(marked('c1')).toContain('radial-gradient');
    expect(marked('e3')).toBe('');
    // Andere eigene Figur anklicken wechselt die Auswahl
    fireEvent.click(square('f3'));
    expect(marked('c1')).toBe('');
    expect(marked('g5')).toContain('radial-gradient');
  });

  it('rochiert per Zielfeld oder per Klick auf den eigenen Turm', () => {
    const onMove = renderBoard();
    fireEvent.click(square('e1'));
    fireEvent.click(square('h1'));
    expect(onMove).toHaveBeenLastCalledWith('e1g1');
    fireEvent.click(square('e1'));
    fireEvent.click(square('c1'));
    expect(onMove).toHaveBeenLastCalledWith('e1c1');
  });
});
