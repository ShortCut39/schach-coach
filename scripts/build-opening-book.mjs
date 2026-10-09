// Erzeugt src/classification/data/openings.json aus den Lichess-TSV-Dateien.
// Aufruf: pnpm build:openings
// Schlüssel ist die EPD (FEN ohne Halbzug- und Zugzähler), Wert [ECO, Name].
import { readFileSync, writeFileSync } from 'node:fs';
import { Chess } from 'chess.js';

const files = ['a', 'b', 'c', 'd', 'e'].map((f) => `data/chess-openings/${f}.tsv`);
const book = {};
let lines = 0;

for (const file of files) {
  const rows = readFileSync(file, 'utf8').trim().split('\n').slice(1);
  for (const row of rows) {
    const [eco, name, pgn] = row.split('\t');
    const chess = new Chess();
    chess.loadPgn(pgn);
    const epd = chess.fen().split(' ').slice(0, 4).join(' ');
    // Bei doppelten Stellungen gewinnt der erste (kürzere ECO-Eintrag in Dateireihenfolge)
    book[epd] ??= [eco, name];
    lines++;
  }
}

writeFileSync('src/classification/data/openings.json', JSON.stringify(book) + '\n');
console.log(`${lines} Eröffnungen gelesen, ${Object.keys(book).length} Stellungen geschrieben.`);
