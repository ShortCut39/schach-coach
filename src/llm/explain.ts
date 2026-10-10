import { parseExplanations, type Explanation } from './schema';
import { LlmError, type ChatMessage } from './types';

/** Eine Chat-Anfrage; `jsonMode` = `response_format: json_object` mitsenden. */
export type ChatFn = (messages: ChatMessage[], jsonMode: boolean) => Promise<string>;

/** Merkt sich je Endpunkt+Modell, ob der JSON-Modus funktioniert. */
const jsonModeSupport = new Map<string, boolean>();

/**
 * Erst mit `response_format: json_object`. Lehnt der Endpunkt das ab, wird ohne wiederholt
 * (der Prompt verlangt ohnehin „nur JSON“) und das für dieses Modell gemerkt.
 */
export function withJsonFallback(
  chat: ChatFn,
  endpointKey: string,
): (messages: ChatMessage[]) => Promise<string> {
  return async (messages) => {
    if (jsonModeSupport.get(endpointKey) !== false) {
      try {
        return await chat(messages, true);
      } catch (error) {
        if (!(error instanceof LlmError)) throw error;
        if (error.code === 'rejected') {
          // Abgelehnt ohne erkennbaren Grund: einmal ohne JSON-Modus versuchen. Klappt das,
          // liegt es am JSON-Modus; sonst kommt der neue Fehler beim Nutzer an.
          const content = await chat(messages, false);
          jsonModeSupport.set(endpointKey, false);
          return content;
        }
        if (error.code !== 'jsonModeUnsupported') throw error;
        jsonModeSupport.set(endpointKey, false);
      }
    }
    return chat(messages, false);
  };
}

export interface ExplainResult {
  explanations: Map<number, Explanation>;
  /** Halbzüge ohne gültige Erklärung nach dem automatischen zweiten Versuch */
  failed: number[];
}

/**
 * Fragt Erklärungen für `plies` an, prüft sie mit zod und wiederholt einmal automatisch
 * (bei ungültiger Antwort oder fehlenden Zügen). Netzwerk- und Auth-Fehler werden
 * durchgereicht, damit die Oberfläche sie verständlich anzeigen kann.
 */
export async function requestExplanations(
  ask: (messages: ChatMessage[]) => Promise<string>,
  buildMessages: (plies: number[]) => ChatMessage[],
  plies: number[],
): Promise<ExplainResult> {
  const explanations = new Map<number, Explanation>();
  let missing = plies;

  for (let attempt = 0; attempt < 2 && missing.length > 0; attempt++) {
    try {
      const content = await ask(buildMessages(missing));
      for (const explanation of parseExplanations(content)) {
        if (missing.includes(explanation.ply)) explanations.set(explanation.ply, explanation);
      }
    } catch (error) {
      if (!(error instanceof LlmError) || error.code !== 'badResponse') throw error;
    }
    missing = plies.filter((ply) => !explanations.has(ply));
  }
  return { explanations, failed: missing };
}
