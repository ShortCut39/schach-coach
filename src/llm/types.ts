export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Verbindung zu einem OpenAI-kompatiblen Endpunkt. */
export interface LlmConfig {
  /** z. B. `https://openrouter.ai/api/v1` */
  baseUrl: string;
  /** Leer bei lokalen Servern ohne Key (Ollama, LM Studio) */
  apiKey: string;
  model: string;
}

export type LlmErrorCode =
  | 'invalidUrl'
  | 'unauthorized'
  | 'modelNotFound'
  | 'notFound'
  | 'rateLimited'
  | 'server'
  | 'unreachable'
  | 'timeout'
  | 'aborted'
  | 'jsonModeUnsupported'
  | 'badResponse';

export class LlmError extends Error {
  constructor(
    public readonly code: LlmErrorCode,
    public readonly status?: number,
  ) {
    super(`LLM: ${code}${status ? ` (${status})` : ''}`);
  }
}

export type FetchFn = (url: string, init: RequestInit) => Promise<Response>;

/** Sprache der Erklärungen (folgt der Oberfläche) */
export type ExplanationLanguage = 'de' | 'en';
