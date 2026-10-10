import i18n from '../../i18n';
import { parsePgnGame } from '../../chess/pgn';
import { computeGameAnalysis } from '../../classification/gameAnalysis';
import { loadOpeningBook } from '../../classification/openingBook';
import { DEFAULT_CLASSIFICATION } from '../../classification/types';
import type { PositionEval } from '../../engine/types';
import evalFixture from '../../test/fixtures/opera-game-evals-d20.json';
import { operaGame } from '../../test/fixtures';
import { buildMarkdown, exportFileName } from './markdown';

describe('Markdown-Export', () => {
  it('enthält Partie, Genauigkeit, Kategorien, Wendepunkte, Tipps und Züge', async () => {
    const parsed = parsePgnGame(operaGame);
    if (!parsed.ok) throw new Error('ungültig');
    const game = parsed.value;
    const evals = evalFixture.evals as PositionEval[];
    const analysis = computeGameAnalysis(
      game,
      evals,
      await loadOpeningBook(),
      DEFAULT_CLASSIFICATION,
    );
    const markdown = buildMarkdown(
      {
        game,
        analysis,
        evals,
        userColor: 'w',
        notation: 'de',
        engine: { name: 'Stockfish 19 Lite WASM', depth: 20 },
        explanations: {
          30: {
            short: {
              status: 'done',
              explanation: { ply: 30, was: 'Damenopfer | mit Strich.', warum: 'b', aufbauen: 'c' },
            },
          },
        },
        summary: {
          eroeffnung: 'Philidor-Verteidigung.',
          wendepunkte: [{ ply: 30, text: 'Das Damenopfer entscheidet.' }],
          tipps: [{ titel: 'Linien öffnen', text: 'Nutze offene Linien.' }],
        },
      },
      i18n.t.bind(i18n),
    );
    expect(markdown).toContain('# Schach-Coach: Analyse');
    expect(markdown).toContain('**Partie:** Morphy, Paul – Herzog von Braunschweig & Graf Isouard');
    expect(markdown).toContain('Philidor Defense (C41)');
    expect(markdown).toContain('**Datum:** 1858');
    expect(markdown).toMatch(/\| Du \(Weiß\) \| \d+,\d\s%/);
    expect(markdown).toContain('| !! Brillant | 1 | 0 |');
    expect(markdown).toContain('- **16. Db8+** – !! Brillant: Das Damenopfer entscheidet.');
    expect(markdown).toContain('1. **Linien öffnen** – Nutze offene Linien.');
    expect(markdown).toContain('| 16. Db8+ | !! Brillant | M1 | Damenopfer \\| mit Strich. b c |');
    expect(markdown).toContain('Stockfish 19 Lite WASM, Tiefe 20');
  });

  it('baut einen sicheren Dateinamen', () => {
    const parsed = parsePgnGame(operaGame);
    if (!parsed.ok) throw new Error('ungültig');
    expect(exportFileName(parsed.value, i18n.t.bind(i18n))).toBe(
      'schach-coach-Morphy_Paul-Herzog_von_Braunschweig_Graf_Isouard.md',
    );
  });
});
