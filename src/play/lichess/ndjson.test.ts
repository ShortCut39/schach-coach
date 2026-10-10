import { NdjsonParser, readNdjson, StreamIdleError } from './ndjson';

const encode = (text: string) => new TextEncoder().encode(text);

function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encode(chunk));
      controller.close();
    },
  });
}

describe('NdjsonParser', () => {
  it('setzt Zeilen über Chunk-Grenzen zusammen', () => {
    const parser = new NdjsonParser();
    expect(parser.push('{"type":"game')).toEqual([]);
    expect(parser.push('Start","id":"a"}\n{"type":')).toEqual([{ type: 'gameStart', id: 'a' }]);
    expect(parser.push('"x"}\n')).toEqual([{ type: 'x' }]);
  });

  it('meldet leere Zeilen als Keep-Alive und überspringt sie', () => {
    const parser = new NdjsonParser();
    const keepAlive = vi.fn();
    expect(parser.push('\n\n{"a":1}\n\n', keepAlive)).toEqual([{ a: 1 }]);
    expect(keepAlive).toHaveBeenCalledTimes(3);
  });

  it('übersteht ungültige Zeilen und Umlaute, die über Bytes geteilt sind', () => {
    const parser = new NdjsonParser();
    const bytes = encode('{"name":"Müller"}\nkaputt\n');
    // „ü“ besteht aus zwei Bytes – mitten darin teilen
    const cut = bytes.indexOf(0xc3) + 1;
    expect(parser.push(bytes.slice(0, cut))).toEqual([]);
    expect(parser.push(bytes.slice(cut))).toEqual([{ name: 'Müller' }]);
  });

  it('liefert die letzte Zeile ohne Zeilenumbruch beim Abschluss', () => {
    const parser = new NdjsonParser();
    parser.push('{"a":1}');
    expect(parser.flush()).toEqual([{ a: 1 }]);
  });
});

describe('readNdjson', () => {
  it('liest alle Nachrichten bis zum Ende', async () => {
    const messages: unknown[] = [];
    await readNdjson(
      streamOf(['{"a":1}\n{"b"', ':2}\n', '\n', '{"c":3}']),
      (m) => messages.push(m),
      {
        idleMs: 1000,
      },
    );
    expect(messages).toEqual([{ a: 1 }, { b: 2 }, { c: 3 }]);
  });

  it('bricht eine stille Verbindung nach der Wartezeit ab', async () => {
    let fire: (() => void) | undefined;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encode('{"a":1}\n'));
        // danach kommt nichts mehr
      },
    });
    const messages: unknown[] = [];
    const reading = readNdjson(body, (m) => messages.push(m), {
      idleMs: 20_000,
      setTimer: (callback) => {
        fire = callback;
        return () => {};
      },
    });
    await vi.waitFor(() => expect(messages).toEqual([{ a: 1 }]));
    fire?.();
    await expect(reading).rejects.toBeInstanceOf(StreamIdleError);
  });
});
