import { assignSoundFiles, pieceCodeFromName, soundEventFromName } from './fileNames';

describe('Figur aus dem Dateinamen', () => {
  it.each([
    ['wK.svg', 'wK'],
    ['bq.png', 'bQ'],
    ['WN.webp', 'wN'],
    ['wB.svg', 'wB'],
    ['white_king.svg', 'wK'],
    ['WhiteKing.png', 'wK'],
    ['black-knight.svg', 'bN'],
    ['king_black.png', 'bK'],
    ['Black Rook.svg', 'bR'],
    ['whitepawn.svg', 'wP'],
    ['blackbishop.png', 'bB'],
    ['weisser_koenig.svg', 'wK'],
    ['Weißer König.png', 'wK'],
    ['schwarze-dame.svg', 'bQ'],
    ['Schwarzer Springer.webp', 'bN'],
    ['weiss_laeufer.svg', 'wB'],
    ['schwarzer_turm.svg', 'bR'],
    ['weisser-bauer.png', 'wP'],
    ['Chess_klt45.svg', 'wK'],
    ['Chess_ndt45.svg', 'bN'],
    ['king_w.svg', 'wK'],
    ['b_knight.png', 'bN'],
    ['white_q.svg', 'wQ'],
    ['wking.svg', 'wK'],
    ['bpawn.png', 'bP'],
    ['pieces/set1/wR.svg', 'wR'],
  ])('%s → %s', (name, code) => {
    expect(pieceCodeFromName(name)).toBe(code);
  });

  it.each(['logo.svg', 'king.svg', 'white.png', 'readme.txt', 'xK.svg'])(
    '%s bleibt unzugeordnet',
    (name) => {
      expect(pieceCodeFromName(name)).toBeNull();
    },
  );
});

describe('Ton-Ereignis aus dem Dateinamen', () => {
  it.each([
    ['move.ogg', 'move'],
    ['Move.mp3', 'move'],
    ['Capture.ogg', 'capture'],
    ['Check.ogg', 'check'],
    ['GenericNotify.ogg', 'gameStart'],
    ['LowTime.ogg', 'lowTime'],
    ['Victory.ogg', 'victory'],
    ['Defeat.ogg', 'defeat'],
    ['Draw.ogg', 'draw'],
    ['castling.wav', 'castle'],
    ['promotion.wav', 'promotion'],
    ['game-end.ogg', 'gameEnd'],
    ['zug.wav', 'move'],
    ['Schlagzug.mp3', 'capture'],
    ['rochade.ogg', 'castle'],
    ['schach.ogg', 'check'],
    ['umwandlung.ogg', 'promotion'],
    ['partiebeginn.ogg', 'gameStart'],
    ['sieg.ogg', 'victory'],
    ['niederlage.ogg', 'defeat'],
    ['remis.ogg', 'draw'],
    ['zeitnot.ogg', 'lowTime'],
  ])('%s → %s', (name, event) => {
    expect(soundEventFromName(name)).toBe(event);
  });

  it('kennt Unbekanntes nicht', () => {
    expect(soundEventFromName('Berserk.ogg')).toBeNull();
    expect(soundEventFromName('Tournament1st.ogg')).toBeNull();
  });

  it('ordnet einen Lichess-Ordner auf einmal zu (GenericNotify auch für das Ende)', () => {
    const files = [
      'Move.ogg',
      'Capture.ogg',
      'GenericNotify.ogg',
      'Victory.ogg',
      'Berserk.ogg',
    ].map((name) => ({ name }));
    const slots = assignSoundFiles(files);
    expect(Object.fromEntries(Object.entries(slots).map(([k, v]) => [k, v.name]))).toEqual({
      move: 'Move.ogg',
      capture: 'Capture.ogg',
      gameStart: 'GenericNotify.ogg',
      gameEnd: 'GenericNotify.ogg',
      victory: 'Victory.ogg',
    });
  });
});
