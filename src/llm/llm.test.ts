import { parsePgnGame } from '../chess/pgn';
import { classifyGame } from '../classification/classify';
import { DEFAULT_CLASSIFICATION, type Category } from '../classification/types';
import type { PositionEval } from '../engine/types';
import evalFixture from '../test/fixtures/opera-game-evals-d20.json';
import { operaGame } from '../test/fixtures';
import { requestExplanations, withJsonFallback } from './explain';
import { buildMoveFacts, type FactLabels } from './facts';
import { batchMessages, detailMessages, systemPrompt } from './prompts';
import { parseExplanations } from './schema';
import { chunk, selectPlies } from './selection';
import { LlmError } from './types';

const labels: FactLabels = {
  category: Object.fromEntries(
    [
      'brilliant',
      'great',
      'best',
      'excellent',
      'good',
      'book',
      'inaccuracy',
      'mistake',
      'blunder',
      'miss',
    ].map((c) => [c, c.toUpperCase()]),
  ) as Record<Category, string>,
  color: { w: 'Weiß', b: 'Schwarz' },
  unnoticed: 'UNBEMERKT',
  language: 'de',
};

function opera() {
  const parsed = parsePgnGame(operaGame);
  if (!parsed.ok) throw new Error('Fixture ungültig');
  const evals = evalFixture.evals as PositionEval[];
  const analyses = classifyGame(parsed.value, evals, 5, DEFAULT_CLASSIFICATION);
  return { game: parsed.value, evals, analyses };
}

describe('parseExplanations', () => {
  const valid = { explanations: [{ ply: 30, was: 'a', warum: 'b', aufbauen: 'c' }] };
  it('liest gültiges JSON, auch mit Code-Zaun und Text drumherum', () => {
    expect(parseExplanations(JSON.stringify(valid))).toEqual(valid.explanations);
    expect(parseExplanations('Hier:\n```json\n' + JSON.stringify(valid) + '\n```')).toEqual(
      valid.explanations,
    );
    expect(parseExplanations(JSON.stringify(valid.explanations))).toEqual(valid.explanations);
  });
  it('lässt leere Merksätze weg', () => {
    const withEmpty = { explanations: [{ ...valid.explanations[0], merksatz: '' }] };
    expect(parseExplanations(JSON.stringify(withEmpty))[0]).not.toHaveProperty('merksatz');
  });
  it('lehnt kaputte oder unvollständige Antworten ab', () => {
    expect(() => parseExplanations('kein json')).toThrow(LlmError);
    expect(() => parseExplanations('{"explanations":[{"ply":1,"was":"a"}]}')).toThrow(LlmError);
    expect(() =>
      parseExplanations('{"explanations":[{"ply":"x","was":"a","warum":"b","aufbauen":"c"}]}'),
    ).toThrow(LlmError);
  });
});

describe('buildMoveFacts (echte Engine-Daten)', () => {
  it('enthält für 16. Db8+ nur Daten aus Engine und chess.js', () => {
    const { game, evals, analyses } = opera();
    const ply = game.plies[30]!;
    const facts = buildMoveFacts(
      ply,
      analyses[30]!,
      evals[30]!,
      evals[31]!,
      'de',
      labels,
      'w',
      true,
    );
    expect(facts).toMatchObject({
      ply: 30,
      zugnummer: '16.',
      farbe: 'Weiß',
      zug: 'Db8+',
      kategorie: 'BRILLIANT',
      bester_zug: 'Db8+',
      gewinnchance_davor: 100,
      gewinnchance_danach: 100,
      bewertung_danach: 'M1',
      hauptvariante_nach_zug: ['Sxb8', 'Td8#'],
      variante_mit_bestzug: null,
      material: { durch_zug: 0, nach_hauptvariante: -9 },
      flags: { schach: true, matt: false, schlag: false, opfer: true },
      hinweis: 'UNBEMERKT',
    });
  });

  it('nennt bei einem Fehler die Variante mit dem Bestzug (höchstens 6 Halbzüge)', () => {
    const { game, evals, analyses } = opera();
    const facts = buildMoveFacts(
      game.plies[17]!,
      analyses[17]!,
      evals[17]!,
      evals[18]!,
      'de',
      labels,
      'w',
    );
    expect(facts.zug).toBe('b5');
    expect(facts.kategorie).toBe('MISTAKE');
    expect(facts.variante_mit_bestzug?.length).toBeLessThanOrEqual(6);
    expect(facts.variante_mit_bestzug?.[0]).toBe(facts.bester_zug);
    expect(facts.hauptvariante_nach_zug.length).toBeLessThanOrEqual(6);
  });
});

describe('Prompts', () => {
  it('verbieten erfundene Varianten und verlangen JSON', () => {
    const prompt = systemPrompt('beginner', 'de');
    expect(prompt).toContain('Erfinde keine Züge, Varianten oder Bewertungen');
    expect(prompt).toContain('Wenn die Daten für eine Aussage nicht reichen');
    expect(prompt).toContain('Anfänger');
    expect(prompt).toContain('deutsche Notation');
    expect(prompt).toContain('nur mit gültigem JSON');
  });

  it('schicken die Fakten als Daten mit', () => {
    const { game, evals, analyses } = opera();
    const facts = buildMoveFacts(
      game.plies[30]!,
      analyses[30]!,
      evals[30]!,
      evals[31]!,
      'de',
      labels,
      'w',
    );
    const [, user] = batchMessages([facts], 'club', 'de');
    expect(user?.content).toContain('"zug": "Db8+"');
    expect(user?.content).toContain('"explanations"');
    expect(detailMessages(facts, 'opponent', 'club', 'de')[1]?.content).toContain(
      'aus Sicht des Gegners',
    );
  });
});

describe('selectPlies und chunk', () => {
  it('wählt Fehler beider Seiten und eigene gute Züge, nie Theorie', () => {
    const { game, analyses } = opera();
    const mine = selectPlies(game, analyses, 'w', 'errorsAndMyGood');
    expect(mine).toContain(30); // 16. Db8+ (Brillant)
    expect(mine).toContain(17); // 9… b5 (Fehler des Gegners)
    expect(mine).not.toContain(0); // 1. e4 (Theorie)
    expect(selectPlies(game, analyses, 'w', 'errorsOnly').every((i) => i % 2 === 1)).toBe(true);
    expect(selectPlies(game, analyses, 'w', 'all')).toHaveLength(33 - 5);
  });
  it('teilt in Pakete zu 7', () => {
    expect(chunk([1, 2, 3, 4, 5, 6, 7, 8, 9]).map((c) => c.length)).toEqual([7, 2]);
  });
});

describe('requestExplanations', () => {
  const answer = (plies: number[]) =>
    JSON.stringify({
      explanations: plies.map((ply) => ({ ply, was: 'a', warum: 'b', aufbauen: 'c' })),
    });

  it('wiederholt einmal für fehlende Züge und meldet den Rest als fehlgeschlagen', async () => {
    const replies = [answer([1]), 'Unsinn'];
    const ask = vi.fn(async () => replies.shift() ?? '');
    const result = await requestExplanations(
      ask,
      (plies) => [{ role: 'user', content: plies.join() }],
      [1, 2],
    );
    expect(ask).toHaveBeenCalledTimes(2);
    expect([...result.explanations.keys()]).toEqual([1]);
    expect(result.failed).toEqual([2]);
  });

  it('reicht Netzwerk- und Auth-Fehler durch', async () => {
    const ask = async () => {
      throw new LlmError('unauthorized', 401);
    };
    await expect(requestExplanations(ask, () => [], [1])).rejects.toMatchObject({
      code: 'unauthorized',
    });
  });

  it('fällt ohne JSON-Modus zurück und merkt sich das', async () => {
    const calls: boolean[] = [];
    const chat = async (_m: unknown, jsonMode: boolean) => {
      calls.push(jsonMode);
      if (jsonMode) throw new LlmError('jsonModeUnsupported', 400);
      return 'ok';
    };
    const ask = withJsonFallback(chat, 'test-endpunkt');
    expect(await ask([])).toBe('ok');
    expect(await ask([])).toBe('ok');
    expect(calls).toEqual([true, false, false]);
  });
});
