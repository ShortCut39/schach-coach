import { act, render } from '@testing-library/react';
import type { MouseEvent } from 'react';
import type { ChessboardOptions } from 'react-chessboard';
import { BoardView } from './analyse/BoardView';
import { SHAPE_COLORS, shapeColor } from './drawnShapes';
import { TrainingBoard } from './training/TrainingBoard';

/** Erfasst die Optionen jeder Darstellung (statt das echte Brett zu zeichnen) */
const renders: ChessboardOptions[] = [];
vi.mock('react-chessboard', () => ({
  Chessboard: ({ options }: { options: ChessboardOptions }) => {
    renders.push(options);
    return null;
  },
}));

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
const last = () => renders.at(-1) as ChessboardOptions;
const mouse = (button: number, keys: Partial<MouseEvent> = {}) =>
  ({
    button,
    shiftKey: false,
    ctrlKey: false,
    altKey: false,
    metaKey: false,
    ...keys,
  }) as MouseEvent;

function rightClick(square: string, keys: Partial<MouseEvent> = {}, endSquare = square) {
  act(() => last().onSquareMouseDown?.({ piece: null, square }, mouse(2, keys)));
  act(() => last().onSquareMouseUp?.({ piece: null, square: endSquare }, mouse(2, keys)));
}

describe('Eigene Pfeile und Kreise', () => {
  it('wählt die Farbe wie bei Lichess nach den gedrückten Tasten', () => {
    expect(shapeColor(mouse(2))).toBe(SHAPE_COLORS.default);
    expect(shapeColor(mouse(2, { shiftKey: true }))).toBe(SHAPE_COLORS.shift);
    expect(shapeColor(mouse(2, { ctrlKey: true }))).toBe(SHAPE_COLORS.ctrl);
    expect(shapeColor(mouse(2, { altKey: true }))).toBe(SHAPE_COLORS.alt);
  });

  it('erlaubt Pfeile auf dem Spielbrett und zeichnet Kreise per Rechtsklick', () => {
    const board = (fen: string) => (
      <TrainingBoard
        fen={fen}
        orientation="white"
        interactive
        onMove={() => {}}
        arrows={[]}
        label="Brett"
      />
    );
    const { rerender } = render(board(START));
    expect(last().allowDrawingArrows).toBe(true);
    expect(last().clearArrowsOnPositionChange).toBe(true);
    expect(last().arrowOptions?.colors.default).toBe(SHAPE_COLORS.default);

    rightClick('e4');
    rightClick('d5', { shiftKey: true });
    const styles = last().squareStyles ?? {};
    expect(String(styles.e4?.backgroundImage)).toContain(SHAPE_COLORS.default);
    expect(String(styles.d5?.backgroundImage)).toContain(SHAPE_COLORS.shift);

    // Rechts ziehen (Pfeil) macht keinen Kreis
    rightClick('g1', {}, 'f3');
    expect(last().squareStyles?.g1).toBeUndefined();
    expect(last().squareStyles?.f3).toBeUndefined();

    // Gleicher Kreis nochmal: weg
    rightClick('e4');
    expect(last().squareStyles?.e4).toBeUndefined();

    // Linksklick löscht alles
    act(() => last().onSquareMouseDown?.({ piece: null, square: 'a1' }, mouse(0)));
    expect(last().squareStyles?.d5).toBeUndefined();

    // Neuer Zug löscht die Kreise
    rightClick('c6');
    expect(last().squareStyles?.c6).toBeDefined();
    rerender(board(AFTER_E4));
    expect(last().squareStyles?.c6).toBeUndefined();
  });

  it('zeichnet auch auf dem Analysebrett, nicht in der Vorschau', () => {
    const { rerender } = render(<BoardView fen={START} orientation="white" label="Brett" />);
    expect(last().allowDrawingArrows).toBe(true);
    rightClick('f3', { ctrlKey: true });
    expect(String(last().squareStyles?.f3?.backgroundImage)).toContain(SHAPE_COLORS.ctrl);
    rerender(<BoardView fen={START} orientation="white" label="Brett" allowDrawing={false} />);
    expect(last().allowDrawingArrows).toBe(false);
    expect(last().onSquareMouseUp).toBeUndefined();
  });
});
