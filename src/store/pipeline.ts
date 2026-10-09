import type { ExplainScope } from '../llm/selection';
import { useAnalysis } from './analysis';
import { isLlmConfigured, useExplanations } from './explanations';
import { useGame, type LoadedSource } from './game';
import { findRecord } from './library';
import { applySnapshot, sessionSchema } from './session';
import { useSettings } from './settings';

/**
 * Liegt die Partie schon mit gleicher Tiefe und Multi-PV in der Bibliothek, werden deren
 * Bewertungen übernommen (nichts wird doppelt berechnet). Erklärungen und Zusammenfassung nur,
 * wenn auch die gewählte Farbe übereinstimmt – sonst sprächen sie die falsche Seite an.
 */
async function reuseFromLibrary(
  source: LoadedSource,
  depth: number,
  multipv: number,
): Promise<boolean> {
  if (source.kind !== 'game') return false;
  const parsed = sessionSchema.safeParse(await findRecord(source));
  if (!parsed.success) return false;
  const record = parsed.data;
  if (record.analysis?.depth !== depth || record.analysis.multipv !== multipv) return false;
  const { userColor } = useGame.getState();
  const sameColor = record.userColor === userColor;
  applySnapshot({
    ...record,
    userColor,
    orientation: userColor === 'w' ? 'white' : 'black',
    current: -1,
    explanations: sameColor ? record.explanations : {},
    summary: sameColor ? record.summary : null,
  });
  return useAnalysis.getState().status === 'done';
}

/**
 * Ganze Analyse: Engine bewertet alle Stellungen (oder übernimmt sie aus der Bibliothek);
 * ist die KI eingerichtet, werden die noch fehlenden Erklärungen in Paketen angefordert und
 * danach – falls noch nicht vorhanden – die Zusammenfassung.
 */
export async function analyseAndExplain(
  source: LoadedSource,
  depth: number,
  scope: ExplainScope,
): Promise<void> {
  useExplanations.getState().reset();
  const multipv = useSettings.getState().multiPv;
  let current = source;
  if (await reuseFromLibrary(source, depth, multipv)) {
    current = useGame.getState().source ?? source;
  } else {
    await useAnalysis.getState().start(source, { depth, multipv });
  }
  const analysis = useAnalysis.getState();
  if (analysis.status !== 'done' || analysis.source !== current) return;
  if (current.kind === 'game' && isLlmConfigured()) {
    await useExplanations.getState().explainGame(scope);
    const { run, summary } = useExplanations.getState();
    // Zusammenfassung nur, wenn die Verbindung funktioniert hat und es noch keine gibt
    if (run.status !== 'error' && summary?.status !== 'done') {
      await useExplanations.getState().explainSummary();
    }
  }
}
