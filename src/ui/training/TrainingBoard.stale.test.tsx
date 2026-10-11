import { act, render } from '@testing-library/react';
import type { ChessboardOptions } from 'react-chessboard';
import { TrainingBoard } from './TrainingBoard';

/** Erfasst die Optionen jeder Darstellung (statt das echte Brett zu zeichnen) */
const renders: ChessboardOptions[] = [];
vi.mock('react-chessboard', () => ({
  Chessboard: ({ options }: { options: ChessboardOptions }) => {
    renders.push(options);
    return null;
  },
}));

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('Spielbrett mit veralteten Routinen von react-chessboard', () => {
  it('zeigt beim ersten Zug als Weiß die Zielfelder, auch wenn die alte Ziehen-Routine kommt', () => {
    const board = (interactive: boolean) => (
      <TrainingBoard
        fen={START}
        orientation="white"
        interactive={interactive}
        onMove={() => {}}
        arrows={[]}
        label="Brett"
      />
    );
    // Vor der Partie: Grundstellung, Ziehen nicht erlaubt
    const { rerender } = render(board(false));
    const stale = renders.at(-1)!;
    // Partie startet: Stellung gleich, jetzt darf gezogen werden
    rerender(board(true));
    // react-chessboard ruft beim Anfassen noch die alte Routine auf (Stellung hat sich nie geändert)
    act(() =>
      stale.onPieceDrag?.({ isSparePiece: false, piece: { pieceType: 'wP' }, square: 'e2' }),
    );
    const styles = renders.at(-1)!.squareStyles ?? {};
    expect(String(styles.e3?.backgroundImage)).toContain('radial-gradient');
    expect(String(styles.e4?.backgroundImage)).toContain('radial-gradient');
  });
});
