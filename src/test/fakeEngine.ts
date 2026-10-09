import { Chess } from 'chess.js';
import type { EngineTransport } from '../engine/engine';

/**
 * Simulierte Engine für Oberflächentests. Antwortet sofort mit einer festen Bewertung
 * (+0.25 aus Sicht der Seite am Zug) und den ersten legalen Zügen als Varianten.
 * Keine echten Schachbewertungen – nur für Tests.
 */
export function fakeEngineTransport(): EngineTransport {
  const listeners = new Set<(line: string) => void>();
  let fen = new Chess().fen();
  let multipv = 1;
  const emit = (line: string) => queueMicrotask(() => listeners.forEach((l) => l(line)));

  return {
    send(command) {
      if (command === 'uci') {
        emit('id name Test-Engine');
        emit('uciok');
      } else if (command === 'isready') emit('readyok');
      else if (command.startsWith('setoption name MultiPV value '))
        multipv = Number(command.split(' ').at(-1));
      else if (command.startsWith('position fen ')) fen = command.slice('position fen '.length);
      else if (command.startsWith('go depth ')) {
        const depth = command.split(' ').at(-1);
        const moves = new Chess(fen).moves({ verbose: true }).slice(0, multipv);
        moves.forEach((move, i) =>
          emit(
            `info depth ${depth} multipv ${i + 1} score cp ${25 - i * 10} nodes 1 pv ${move.lan}`,
          ),
        );
        emit(`bestmove ${moves[0]?.lan ?? '(none)'}`);
      }
    },
    onLine(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    onError: () => () => {},
    terminate() {},
  };
}
