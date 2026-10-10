import { parseTrainingPlan, trainingPlanMessages, type TrainingFacts } from './trainingPlan';
import { LlmError } from './types';

describe('Trainingsplan', () => {
  it('liest gültige Antworten und nimmt höchstens drei Empfehlungen', () => {
    const plan = parseTrainingPlan(
      JSON.stringify({
        einschaetzung: 'Du stellst oft Figuren ein.',
        empfehlungen: [1, 2, 3, 4].map((n) => ({ titel: `T${n}`, text: 'x', uebung: 'y' })),
      }),
    );
    expect(plan.empfehlungen).toHaveLength(3);
    expect(() => parseTrainingPlan('{"einschaetzung":"x"}')).toThrow(LlmError);
  });

  it('schickt nur die Fakten und verlangt Bezug auf Beispiele', () => {
    const facts: TrainingFacts = {
      partien: 3,
      genauigkeit: { durchschnitt: 70, letzte_partien: 70, fruehere_partien: null, phasen: {} },
      fehler_motive: [
        {
          motiv: 'Figur eingestellt',
          erklaerung: 'x',
          anzahl: 2,
          anteil_prozent: 50,
          beispiele: [
            {
              partie: 'A – B',
              zug: '8… Dh4',
              zug_in_worten: 'Dame d8 zieht nach h4',
              folge: 'Weiß: Springer f3 schlägt Dame h4',
            },
          ],
        },
      ],
      eroeffnungen: [],
    };
    const [system, user] = trainingPlanMessages(facts, 'beginner', 'de');
    expect(system?.content).toContain('Erfinde keine Züge');
    expect(user?.content).toContain('genau 3 Empfehlungen');
    expect(user?.content).toContain('Springer f3 schlägt Dame h4');
  });
});
