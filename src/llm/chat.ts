import type { NotationStyle } from '../chess/notation';
import type { MoveFacts, PositionFacts } from './facts';
import { systemPrompt, type Level } from './prompts';
import type { ChatMessage } from './types';

/** Engine-Daten der gerade angezeigten Stellung, die jede Frage mitbekommt. */
export interface ChatFacts {
  du_spielst: string;
  stellung: PositionFacts;
  /** Der Zug, der zu dieser Stellung geführt hat (falls vorhanden) */
  letzter_zug: MoveFacts | null;
}

/** Bisheriger Verlauf, der mitgeschickt wird (Paare aus Frage und Antwort) */
export const CHAT_HISTORY_MESSAGES = 6;
export const MAX_CHAT_ANSWER = 2000;

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Chat zur Stellung: System-Prompt (Textantwort), bisheriger Verlauf und die neue Frage samt
 * aktueller Engine-Daten. Das LLM soll nur damit antworten – keine eigenen Varianten.
 */
export function chatMessages(
  history: readonly ChatTurn[],
  question: string,
  facts: ChatFacts,
  level: Level,
  notation: NotationStyle,
): ChatMessage[] {
  const system = [
    systemPrompt(level, notation, 'de', 'text'),
    '',
    'Du beantwortest Fragen des Spielers zur gerade angezeigten Stellung. Jede Frage enthält die aktuellen Daten.',
    'Bezieh dich auf engine_linien (in_worten), figuren_in_gefahr und letzter_zug. Wenn die Frage einen Zug betrifft, der nicht in den Daten steht, sag ehrlich, dass dazu keine Engine-Bewertung vorliegt.',
  ].join('\n');
  return [
    { role: 'system', content: system },
    ...history
      .slice(-CHAT_HISTORY_MESSAGES)
      .map((turn) => ({ role: turn.role, content: turn.content })),
    {
      role: 'user',
      content: `${question.trim()}\n\nDaten zur aktuellen Stellung:\n${JSON.stringify(facts, null, 1)}`,
    },
  ];
}

/** Antwort aufräumen: Code-Zäune entfernen, Länge begrenzen. */
export function cleanChatAnswer(content: string): string {
  const text = content.replace(/```[a-z]*\n?/gi, '').trim();
  return text.length > MAX_CHAT_ANSWER ? `${text.slice(0, MAX_CHAT_ANSWER)} …` : text;
}
