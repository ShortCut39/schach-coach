import { useMemo, type CSSProperties } from 'react';
import type { ChessboardOptions, PieceRenderObject, SquareRenderer } from 'react-chessboard';
import type { BoardLook } from '../appearance/boards';
import type { PieceUrls } from '../appearance/pieces';
import { useAppearance } from '../appearance/store';
import { PIECE_CODES } from '../appearance/types';
import { notationBase, prefersReducedMotion } from './analyse/boardStyle';

/** Was ein Brett von der Darstellung übernimmt (Figuren, Felder bzw. Brettbild, Koordinaten) */
export type BoardAppearanceOptions = Pick<
  ChessboardOptions,
  | 'pieces'
  | 'boardStyle'
  | 'lightSquareStyle'
  | 'darkSquareStyle'
  | 'lightSquareNotationStyle'
  | 'darkSquareNotationStyle'
  | 'alphaNotationStyle'
  | 'numericNotationStyle'
  | 'showNotation'
  | 'showAnimations'
>;

const pieceStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  height: '100%',
  objectFit: 'contain',
  userSelect: 'none',
  pointerEvents: 'none',
};

/**
 * Figuren als `<img>` (nicht ziehbar: gezogen wird das Feld von react-chessboard). SVGs werden nie
 * ins DOM eingefügt, so laufen auch eigene SVG-Dateien nur als Bild.
 */
function pieceRenderers(urls: PieceUrls): PieceRenderObject {
  return Object.fromEntries(
    PIECE_CODES.map((code) => [
      code,
      () => <img src={urls[code]} alt="" draggable={false} style={pieceStyle} />,
    ]),
  );
}

/** Lesbare Koordinaten auf einem Brettbild (Farbe unbekannt): hell mit dunklem Rand */
const onImageNotation: CSSProperties = {
  color: '#f4f4f4',
  textShadow: '0 0 2px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.6)',
};

export function boardAppearanceOptions(
  pieces: PieceUrls,
  board: BoardLook,
  showCoordinates: boolean,
  animatePieces = true,
): BoardAppearanceOptions {
  const common = {
    pieces: pieceRenderers(pieces),
    showNotation: showCoordinates,
    // Ausgeschaltet oder bei „Bewegung reduzieren“ im System: Figuren springen sofort
    showAnimations: animatePieces && !prefersReducedMotion(),
    alphaNotationStyle: {
      ...notationBase,
      position: 'absolute',
      bottom: '3%',
      right: '6%',
      // Über dem Feldinhalt samt Markierungen (`squareRenderer`), nicht anklickbar
      zIndex: 1,
      pointerEvents: 'none',
    } as CSSProperties,
    numericNotationStyle: {
      ...notationBase,
      position: 'absolute',
      top: '4%',
      left: '6%',
      zIndex: 1,
      pointerEvents: 'none',
    } as CSSProperties,
  };
  if (board.kind === 'image') {
    // Das Bild liegt unter den Feldern; Markierungen (letzter Zug, Ziele, Schach) liegen auf den Feldern darüber
    return {
      ...common,
      boardStyle: {
        backgroundImage: `url("${board.url}")`,
        backgroundSize: '100% 100%',
        backgroundRepeat: 'no-repeat',
      },
      lightSquareStyle: { backgroundColor: 'transparent' },
      darkSquareStyle: { backgroundColor: 'transparent' },
      lightSquareNotationStyle: onImageNotation,
      darkSquareNotationStyle: onImageNotation,
    };
  }
  // Koordinaten in der jeweils anderen Feldfarbe
  return {
    ...common,
    lightSquareStyle: { backgroundColor: board.light },
    darkSquareStyle: { backgroundColor: board.dark },
    lightSquareNotationStyle: { color: board.dark },
    darkSquareNotationStyle: { color: board.light },
  };
}

/**
 * Inhalt eines Felds samt Markierungen. react-chessboard legt `squareStyles` auf ein inneres
 * Element mit `height: 100%` in einem Flex-Feld, dessen Höhe nur aus `aspect-ratio` kommt; WebKit
 * löst diese Prozentangabe nicht immer auf, dann fehlen Markierungen auf leeren Feldern. Hier
 * füllt das Element das Feld absolut aus (`inset: 0`), in jedem Browser.
 */
export function squareRenderer(styles: Record<string, CSSProperties>): SquareRenderer {
  return function MarkedSquare({ square, children }) {
    return (
      <div
        // Wie das Standard-Element der Bibliothek (Block, volle Größe), nur absolut verankert;
        // kein Flex, sonst schrumpfen die Figuren auf ihre Bildgröße
        style={{ position: 'absolute', inset: 0, ...styles[square] }}
      >
        {children}
      </div>
    );
  };
}

/** Gemeinsame Darstellung aller Bretter (Analyse, Training, Spielen, Vorschau). */
export function useBoardAppearance(): BoardAppearanceOptions {
  const pieces = useAppearance((s) => s.pieces);
  const board = useAppearance((s) => s.board);
  const showCoordinates = useAppearance((s) => s.showCoordinates);
  const animatePieces = useAppearance((s) => s.animatePieces);
  return useMemo(
    () => boardAppearanceOptions(pieces, board, showCoordinates, animatePieces),
    [pieces, board, showCoordinates, animatePieces],
  );
}

/** Lädt die Figurenbilder vorab, damit beim ersten Zug nach einem Wechsel nichts flackert. */
export function preloadPieces(urls: PieceUrls): void {
  if (typeof window === 'undefined' || typeof window.Image !== 'function') return;
  for (const code of PIECE_CODES) {
    const image = new window.Image();
    image.decoding = 'async';
    image.src = urls[code];
  }
}

preloadPieces(useAppearance.getState().pieces);
useAppearance.subscribe((state, previous) => {
  if (state.pieces !== previous.pieces) preloadPieces(state.pieces);
});
