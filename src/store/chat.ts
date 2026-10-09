import { create } from 'zustand';
import { formatMoveNumber, formatSan } from '../chess/notation';
import { chatMessages, cleanChatAnswer, type ChatFacts } from '../llm/chat';
import { chatCompletion } from '../llm/client';
import { buildMoveFacts, buildPositionFacts } from '../llm/facts';
import { getFetch } from '../llm/http';
import { LlmError, type LlmErrorCode } from '../llm/types';
import { positionsOf, useAnalysis } from './analysis';
import { currentLlmConfig, gameContext, labels } from './explanations';
import { useGame, type LoadedSource } from './game';
import { useSettings } from './settings';

export interface ChatEntry {
  role: 'user' | 'assistant';
  content: string;
  /** Stellung, zu der die Frage gestellt wurde, z. B. „nach 16. Db8+“ */
  context?: string;
}

export type ChatError = LlmErrorCode | 'noEval';

interface ChatState {
  source: LoadedSource | null;
  messages: ChatEntry[];
  pending: boolean;
  error: ChatError | null;
  /** Frage zur aktuell angezeigten Stellung; die Engine-Daten gehen automatisch mit. */
  send: (question: string) => Promise<void>;
  reset: () => void;
}

export const useChat = create<ChatState>()((set, get) => ({
  source: null,
  messages: [],
  pending: false,
  error: null,

  send: async (question) => {
    const { source, current, userColor } = useGame.getState();
    const text = question.trim();
    if (!source || !text || get().pending) return;
    if (get().source !== source) set({ source, messages: [], error: null });

    const analysis = useAnalysis.getState();
    const index = source.kind === 'game' ? current + 1 : 0;
    const fen = positionsOf(source)[index];
    const evaluation = analysis.source === source ? analysis.evals[index] : undefined;
    if (!fen || !evaluation) {
      set({ error: 'noEval' });
      return;
    }

    const settings = useSettings.getState();
    const factLabels = labels();
    let lastMove = null;
    let contextLabel: string | undefined;
    if (source.kind === 'game' && current >= 0) {
      const ply = source.plies[current];
      const context = await gameContext();
      const plyAnalysis = context?.result.plies[current];
      const before = analysis.evals[current];
      if (ply) {
        contextLabel = `${formatMoveNumber(ply.moveNumber, ply.color)} ${formatSan(ply.san, settings.notation)}`;
        if (plyAnalysis && before) {
          lastMove = buildMoveFacts(
            ply,
            plyAnalysis,
            before,
            evaluation,
            settings.notation,
            factLabels,
            userColor,
          );
        }
      }
    }
    const facts: ChatFacts = {
      du_spielst: factLabels.color[userColor],
      stellung: buildPositionFacts(fen, evaluation, settings.notation, factLabels),
      letzter_zug: lastMove,
    };

    const history = get().messages.map(({ role, content }) => ({ role, content }));
    const userEntry: ChatEntry = contextLabel
      ? { role: 'user', content: text, context: contextLabel }
      : { role: 'user', content: text };
    set({ messages: [...get().messages, userEntry], pending: true, error: null });
    try {
      const { content } = await chatCompletion(
        currentLlmConfig(),
        chatMessages(history, text, facts, settings.level, settings.notation),
        { jsonMode: false, maxTokens: 600 },
        getFetch(),
      );
      if (get().source !== source) return;
      set({
        messages: [...get().messages, { role: 'assistant', content: cleanChatAnswer(content) }],
        pending: false,
      });
    } catch (error) {
      if (get().source !== source) return;
      set({ pending: false, error: error instanceof LlmError ? error.code : 'badResponse' });
    }
  },

  reset: () => set({ source: null, messages: [], pending: false, error: null }),
}));
