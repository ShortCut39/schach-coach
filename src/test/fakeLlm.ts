/**
 * Simulierter OpenAI-kompatibler Endpunkt für Tests. Liest die Fakten aus der Anfrage und
 * antwortet mit gültigen Erklärungen im erwarteten JSON-Format. Keine echte KI.
 */
export interface FakeLlmOptions {
  /** HTTP-Status für alle Antworten (Standard 200) */
  status?: number;
  /** JSON-Modus ablehnen (wie manche lokale Server) */
  rejectJsonMode?: boolean;
  /** Erwarteter API-Key; ein anderer Key ergibt 401 */
  expectedKey?: string;
}

export interface FakeLlmCall {
  url: string;
  authorization: string | undefined;
  body: { model: string; messages: { role: string; content: string }[]; response_format?: unknown };
}

export function fakeLlmFetch(options: FakeLlmOptions = {}) {
  const calls: FakeLlmCall[] = [];
  const fetchFn = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const body = JSON.parse(String(init?.body)) as FakeLlmCall['body'];
    const headers = (init?.headers ?? {}) as Record<string, string>;
    calls.push({ url: String(input), authorization: headers.Authorization, body });

    const json = (status: number, data: unknown) => new Response(JSON.stringify(data), { status });
    if (options.status && options.status !== 200)
      return json(options.status, { error: { message: 'Fehler' } });
    if (options.expectedKey && headers.Authorization !== `Bearer ${options.expectedKey}`) {
      return json(401, { error: { message: 'Invalid API key' } });
    }
    if (options.rejectJsonMode && body.response_format) {
      return json(400, { error: { message: 'response_format is not supported' } });
    }

    const user = body.messages.at(-1)?.content ?? '';
    if (user.startsWith('Schreibe eine Zusammenfassung')) {
      const facts = JSON.parse(user.slice(user.indexOf('Daten:') + 6)) as {
        wendepunkte: { ply: number; zug: string }[];
      };
      const content = JSON.stringify({
        eroeffnung: 'Test-Eröffnung.',
        wendepunkte: facts.wendepunkte.map((w) => ({
          ply: w.ply,
          text: `Test-Wendepunkt ${w.zug}.`,
        })),
        tipps: [1, 2, 3].map((n) => ({ titel: `Test-Tipp ${n}`, text: 'Test-Text.' })),
      });
      return json(200, { choices: [{ message: { content } }] });
    }
    const data = user.includes('Daten:')
      ? (JSON.parse(user.slice(user.indexOf('Daten:') + 6)) as unknown)
      : null;
    const facts = Array.isArray(data) ? data : data ? [data] : [];
    const explanations = facts.map((f: { ply: number; zug?: string }) => ({
      ply: f.ply,
      was: `Test-Erklärung zu ${f.zug ?? 'der Stellung'}.`,
      warum: 'Weil die Daten es so zeigen.',
      aufbauen: 'Weiter so.',
    }));
    const content = facts.length ? JSON.stringify({ explanations }) : 'OK';
    return json(200, { choices: [{ message: { content } }] });
  };
  return { fetchFn, calls };
}
