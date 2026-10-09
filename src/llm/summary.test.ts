import { LlmError } from './types';
import { parseSummary } from './summary';

describe('parseSummary', () => {
  const valid = {
    eroeffnung: 'Philidor.',
    wendepunkte: [{ ply: 30, text: 'Damenopfer.' }],
    tipps: [1, 2, 3, 4].map((n) => ({ titel: `Tipp ${n}`, text: 'Text.' })),
  };
  it('liest gültige Antworten und nimmt höchstens drei Tipps', () => {
    const result = parseSummary('```json\n' + JSON.stringify(valid) + '\n```');
    expect(result.tipps.map((t) => t.titel)).toEqual(['Tipp 1', 'Tipp 2', 'Tipp 3']);
    expect(result.wendepunkte[0]?.ply).toBe(30);
  });
  it('lehnt unvollständige Antworten ab', () => {
    expect(() => parseSummary('{"eroeffnung":"x"}')).toThrow(LlmError);
    expect(() => parseSummary('kein json')).toThrow(LlmError);
  });
});
