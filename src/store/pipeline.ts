import type { ExplainScope } from '../llm/selection';
import { useAnalysis } from './analysis';
import { isLlmConfigured, useExplanations } from './explanations';
import type { LoadedSource } from './game';
import { useSettings } from './settings';

/**
 * Ganze Analyse: Engine bewertet alle Stellungen; ist sie fertig und die KI eingerichtet,
 * werden die ausgewählten Züge in Paketen erklärt und danach die Zusammenfassung angefordert.
 */
export async function analyseAndExplain(
  source: LoadedSource,
  depth: number,
  scope: ExplainScope,
): Promise<void> {
  useExplanations.getState().reset();
  await useAnalysis.getState().start(source, { depth, multipv: useSettings.getState().multiPv });
  const analysis = useAnalysis.getState();
  if (analysis.status !== 'done' || analysis.source !== source) return;
  if (source.kind === 'game' && isLlmConfigured()) {
    await useExplanations.getState().explainGame(scope);
    // Zusammenfassung nur, wenn die Verbindung funktioniert hat
    if (useExplanations.getState().run.status !== 'error') {
      await useExplanations.getState().explainSummary();
    }
  }
}
