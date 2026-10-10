/**
 * Zeilenweises JSON (NDJSON), wie es die Lichess-Streams liefern. Zeilen können über
 * Chunk-Grenzen geteilt sein; leere Zeilen sind Keep-Alive und werden nur gemeldet, nicht geparst.
 */
export class NdjsonParser {
  private buffer = '';
  private readonly decoder = new TextDecoder();

  /**
   * Nimmt ein Stück des Datenstroms entgegen und liefert alle damit vollständigen Objekte.
   * `onKeepAlive` wird für jede leere Zeile aufgerufen. Ungültige Zeilen werden übersprungen.
   */
  push(chunk: Uint8Array | string, onKeepAlive?: () => void): unknown[] {
    this.buffer += typeof chunk === 'string' ? chunk : this.decoder.decode(chunk, { stream: true });
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() ?? '';
    return lines.flatMap((line) => parseLine(line, onKeepAlive));
  }

  /** Rest am Ende des Stroms (letzte Zeile ohne Zeilenumbruch) */
  flush(): unknown[] {
    const rest = this.buffer + this.decoder.decode();
    this.buffer = '';
    return parseLine(rest);
  }
}

function parseLine(line: string, onKeepAlive?: () => void): unknown[] {
  const text = line.trim();
  if (!text) {
    onKeepAlive?.();
    return [];
  }
  try {
    return [JSON.parse(text) as unknown];
  } catch {
    return [];
  }
}

export class StreamIdleError extends Error {
  constructor() {
    super('Stream: keine Daten');
    this.name = 'StreamIdleError';
  }
}

export interface ReadOptions {
  /** So lange ohne jede Zeile (auch Keep-Alive) gilt die Verbindung als tot */
  idleMs: number;
  signal?: AbortSignal;
  /** Für Tests: eigene Uhr */
  setTimer?: (callback: () => void, ms: number) => () => void;
}

const defaultTimer = (callback: () => void, ms: number) => {
  const id = setTimeout(callback, ms);
  return () => clearTimeout(id);
};

/**
 * Liest einen NDJSON-Antwortkörper bis zum Ende und meldet jedes Objekt. Kommt `idleMs` lang
 * nichts (auch keine leere Keep-Alive-Zeile), wird der Strom abgebrochen und `StreamIdleError`
 * geworfen – der Aufrufer verbindet dann neu.
 */
export async function readNdjson(
  body: ReadableStream<Uint8Array>,
  onMessage: (message: unknown) => void,
  options: ReadOptions,
): Promise<void> {
  const reader = body.getReader();
  const parser = new NdjsonParser();
  const timer = options.setTimer ?? defaultTimer;
  let idle = false;
  let cancelTimer = () => {};
  const arm = () => {
    cancelTimer();
    cancelTimer = timer(() => {
      idle = true;
      void reader.cancel().catch(() => undefined);
    }, options.idleMs);
  };
  const onAbort = () => void reader.cancel().catch(() => undefined);
  options.signal?.addEventListener('abort', onAbort);
  arm();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      // Jedes Datenstück zählt als Lebenszeichen (Keep-Alive ist eine leere Zeile)
      arm();
      for (const message of parser.push(value)) onMessage(message);
    }
    if (idle) throw new StreamIdleError();
    for (const message of parser.flush()) onMessage(message);
  } catch (error) {
    if (idle) throw new StreamIdleError();
    throw error;
  } finally {
    cancelTimer();
    options.signal?.removeEventListener('abort', onAbort);
  }
}
