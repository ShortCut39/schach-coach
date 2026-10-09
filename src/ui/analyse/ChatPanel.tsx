import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAnalysis } from '../../store/analysis';
import { useApiKey } from '../../store/apiKey';
import { useChat, type ChatEntry } from '../../store/chat';
import { isLlmConfigured } from '../../store/explanations';
import { useGame } from '../../store/game';
import { useNavigation } from '../../store/navigation';
import { useSettings } from '../../store/settings';
import { Button } from '../shared/Button';
import { inputClass } from '../shared/form';

const NO_MESSAGES: ChatEntry[] = [];

function SendIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

/** Chat-Tab: Fragen zur angezeigten Stellung; jede Frage bekommt deren Engine-Daten. */
export function ChatPanel() {
  const { t } = useTranslation();
  const source = useGame((s) => s.source);
  const current = useGame((s) => s.current);
  const chatSource = useChat((s) => s.source);
  const allMessages = useChat((s) => s.messages);
  const pending = useChat((s) => s.pending);
  const error = useChat((s) => s.error);
  const send = useChat((s) => s.send);
  const analysisSource = useAnalysis((s) => s.source);
  const evals = useAnalysis((s) => s.evals);
  const setScreen = useNavigation((s) => s.setScreen);
  useApiKey((s) => s.key);
  useSettings((s) => s.llm);
  const [question, setQuestion] = useState('');
  const inputId = useId();
  const listRef = useRef<HTMLDivElement>(null);

  const messages = chatSource === source ? allMessages : NO_MESSAGES;
  const index = source?.kind === 'game' ? current + 1 : 0;
  const hasEval = analysisSource === source && evals[index] !== undefined;

  useEffect(() => {
    listRef.current?.lastElementChild?.scrollIntoView?.({ block: 'nearest' });
  }, [messages.length, pending]);

  if (!isLlmConfigured()) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-[13.5px] text-body">{t('coach.notConfigured')}</p>
        <Button variant="ghost" onClick={() => setScreen('einstellungen')}>
          {t('coach.setup')}
        </Button>
      </div>
    );
  }

  function submit() {
    if (!question.trim()) return;
    void send(question);
    setQuestion('');
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-bold">{t('chat.title')}</h3>
        <span className="font-mono text-[11.5px] font-medium text-muted">{t('chat.hint')}</span>
      </div>
      {messages.length === 0 && <p className="text-[13px] text-muted">{t('chat.intro')}</p>}
      <div
        ref={listRef}
        role="log"
        aria-live="polite"
        className="flex max-h-[420px] flex-col gap-2 overflow-y-auto"
      >
        {messages.map((message, i) =>
          message.role === 'user' ? (
            <div
              key={i}
              className="ml-auto max-w-[85%] rounded-control bg-accent-bg px-3 py-2 text-[13.5px] text-text"
            >
              <span className="sr-only">{t('chat.you')}: </span>
              {message.content}
              <div className="mt-0.5 font-mono text-[11px] text-muted">
                {message.context
                  ? t('chat.context', { move: message.context })
                  : t('chat.contextStart')}
              </div>
            </div>
          ) : (
            <div
              key={i}
              className="mr-auto max-w-[92%] rounded-control bg-panel-sub px-3 py-2 text-[13.5px] whitespace-pre-line text-body"
            >
              <span className="sr-only">{t('chat.coach')}: </span>
              {message.content}
            </div>
          ),
        )}
        {pending && (
          <p role="status" className="text-[13px] text-muted">
            {t('chat.pending')}
          </p>
        )}
      </div>
      {error && (
        <p role="alert" className="text-[13px] text-danger">
          {error === 'noEval' ? t('chat.errors.noEval') : t(`llmErrors.${error}`)}
        </p>
      )}
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <label htmlFor={inputId} className="sr-only">
          {t('chat.inputLabel')}
        </label>
        <input
          id={inputId}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={t('chat.placeholder')}
          autoComplete="off"
          className={`${inputClass} min-w-0 flex-1 text-sm`}
        />
        <button
          type="submit"
          aria-label={t('chat.send')}
          title={t('chat.send')}
          disabled={pending || !question.trim() || !hasEval}
          className="flex size-[46px] shrink-0 items-center justify-center rounded-control bg-accent text-on-accent enabled:hover:brightness-110 disabled:opacity-45"
        >
          <SendIcon />
        </button>
      </form>
      {!hasEval && <p className="text-[12.5px] text-muted">{t('chat.errors.noEval')}</p>}
    </div>
  );
}
