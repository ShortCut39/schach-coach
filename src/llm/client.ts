import { LlmError, type ChatMessage, type FetchFn, type LlmConfig } from './types';

export interface ChatOptions {
  /** `response_format: { type: 'json_object' }` mitsenden */
  jsonMode: boolean;
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
  /** Standard: 120 s (lokale Modelle sind oft langsam) */
  timeoutMs?: number;
}

export interface ChatResult {
  content: string;
  elapsedMs: number;
}

const DEFAULT_TIMEOUT_MS = 120_000;

/** `https://x/v1/` + `/chat/completions` → `https://x/v1/chat/completions`; nur http(s). */
export function endpointUrl(baseUrl: string, path: string): string {
  let url: URL;
  try {
    url = new URL(baseUrl.trim());
  } catch {
    throw new LlmError('invalidUrl');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new LlmError('invalidUrl');
  return `${url.origin}${url.pathname.replace(/\/+$/, '')}${path}`;
}

/** Meldung aus der Fehlerantwort (OpenAI-Format `{ error: { message } }`), ohne den Key. */
async function errorMessage(response: Response, apiKey: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { message?: unknown } | string };
    const raw = typeof body.error === 'string' ? body.error : body.error?.message;
    const text = typeof raw === 'string' ? raw : '';
    return apiKey ? text.split(apiKey).join('•••') : text;
  } catch {
    return '';
  }
}

function classifyStatus(status: number, message: string, jsonMode: boolean): LlmError {
  const lower = message.toLowerCase();
  if (status === 401 || status === 403) return new LlmError('unauthorized', status);
  if (status === 429) return new LlmError('rateLimited', status);
  if (
    jsonMode &&
    status >= 400 &&
    status < 500 &&
    /response_format|json_object|json mode/.test(lower)
  ) {
    return new LlmError('jsonModeUnsupported', status);
  }
  if ((status === 404 || status === 400) && /model/.test(lower)) {
    return new LlmError('modelNotFound', status);
  }
  if (status === 404) return new LlmError('notFound', status);
  if (status >= 500) return new LlmError('server', status);
  return new LlmError('badResponse', status);
}

/**
 * `POST {baseUrl}/chat/completions`. Der API-Key geht nur an diesen Endpunkt und taucht
 * in keiner Fehlermeldung auf.
 */
export async function chatCompletion(
  config: LlmConfig,
  messages: ChatMessage[],
  options: ChatOptions,
  fetchFn: FetchFn,
): Promise<ChatResult> {
  const url = endpointUrl(config.baseUrl, '/chat/completions');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (config.apiKey.trim()) headers.Authorization = `Bearer ${config.apiKey.trim()}`;

  const body: Record<string, unknown> = {
    model: config.model.trim(),
    messages,
    temperature: options.temperature ?? 0.3,
  };
  if (options.maxTokens) body.max_tokens = options.maxTokens;
  if (options.jsonMode) body.response_format = { type: 'json_object' };

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  options.signal?.addEventListener('abort', onAbort);

  const started = performance.now();
  let response: Response;
  try {
    response = await fetchFn(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    if (timedOut) throw new LlmError('timeout');
    if (options.signal?.aborted) throw new LlmError('aborted');
    throw new LlmError('unreachable');
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', onAbort);
  }

  if (!response.ok) {
    throw classifyStatus(
      response.status,
      await errorMessage(response, config.apiKey),
      options.jsonMode,
    );
  }

  let data: { choices?: { message?: { content?: unknown } }[] };
  try {
    data = (await response.json()) as typeof data;
  } catch {
    throw new LlmError('badResponse', response.status);
  }
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new LlmError('badResponse', response.status);
  return { content, elapsedMs: Math.round(performance.now() - started) };
}

/** Minimale Anfrage für „Verbindung testen“. */
export async function testConnection(config: LlmConfig, fetchFn: FetchFn): Promise<number> {
  const result = await chatCompletion(
    config,
    [{ role: 'user', content: 'Antworte nur mit: OK' }],
    { jsonMode: false, maxTokens: 5, temperature: 0, timeoutMs: 30_000 },
    fetchFn,
  );
  return result.elapsedMs;
}
