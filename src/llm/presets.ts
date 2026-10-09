/** Voreinstellungen für bekannte OpenAI-kompatible Endpunkte. */
export const LLM_PRESETS = [
  { id: 'openai', baseUrl: 'https://api.openai.com/v1', needsKey: true },
  { id: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1', needsKey: true },
  { id: 'ollama', baseUrl: 'http://localhost:11434/v1', needsKey: false },
  { id: 'lmstudio', baseUrl: 'http://localhost:1234/v1', needsKey: false },
  { id: 'custom', baseUrl: '', needsKey: false },
] as const;

export type LlmPresetId = (typeof LLM_PRESETS)[number]['id'];
