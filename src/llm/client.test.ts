import { chatCompletion, endpointUrl, testConnection } from './client';
import { LlmError, type FetchFn } from './types';

const config = {
  baseUrl: 'https://openrouter.ai/api/v1/',
  apiKey: 'sk-geheim-123',
  model: 'test/model',
};

function respond(status: number, body: unknown): FetchFn {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }));
}
const ok = (content: string) => respond(200, { choices: [{ message: { content } }] });

describe('endpointUrl', () => {
  it('hängt den Pfad sauber an', () => {
    expect(endpointUrl('https://openrouter.ai/api/v1/', '/chat/completions')).toBe(
      'https://openrouter.ai/api/v1/chat/completions',
    );
    expect(endpointUrl('http://localhost:11434/v1', '/chat/completions')).toBe(
      'http://localhost:11434/v1/chat/completions',
    );
  });
  it('lehnt ungültige oder fremde Schemata ab', () => {
    expect(() => endpointUrl('kein url', '/x')).toThrow(new LlmError('invalidUrl'));
    expect(() => endpointUrl('file:///etc', '/x')).toThrow(new LlmError('invalidUrl'));
  });
});

describe('chatCompletion', () => {
  it('sendet Modell, Nachrichten, JSON-Modus und den Key nur an den Endpunkt', async () => {
    const fetchFn = ok('{"a":1}');
    const result = await chatCompletion(
      config,
      [{ role: 'user', content: 'Hallo' }],
      { jsonMode: true },
      fetchFn,
    );
    expect(result.content).toBe('{"a":1}');
    const [url, init] = vi.mocked(fetchFn).mock.calls[0]!;
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-geheim-123');
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ model: 'test/model', response_format: { type: 'json_object' } });
    expect(String(url)).not.toContain('sk-geheim');
  });

  it('lässt den Authorization-Header ohne Key weg (lokale Server)', async () => {
    const fetchFn = ok('x');
    await chatCompletion({ ...config, apiKey: '' }, [], { jsonMode: false }, fetchFn);
    const init = vi.mocked(fetchFn).mock.calls[0]![1];
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
    expect(JSON.parse(init.body as string).response_format).toBeUndefined();
  });

  it.each([
    [401, { error: { message: 'Invalid API key' } }, 'unauthorized'],
    [404, { error: { message: 'The model `x` does not exist' } }, 'modelNotFound'],
    [400, { error: { message: 'model not found: x' } }, 'modelNotFound'],
    [404, { error: 'Not Found' }, 'notFound'],
    [429, {}, 'rateLimited'],
    [503, {}, 'server'],
    [400, { error: { message: "'response_format' is not supported" } }, 'jsonModeUnsupported'],
  ])('ordnet HTTP %i einem Fehlercode zu', async (status, body, code) => {
    await expect(
      chatCompletion(config, [], { jsonMode: true }, respond(status, body)),
    ).rejects.toMatchObject({
      code,
    });
  });

  it('meldet nicht erreichbare Server, Zeitüberschreitung und ungültige Antworten', async () => {
    const unreachable: FetchFn = async () => {
      throw new TypeError('connection refused');
    };
    await expect(
      chatCompletion(config, [], { jsonMode: false }, unreachable),
    ).rejects.toMatchObject({
      code: 'unreachable',
    });

    const hanging: FetchFn = (_url, init) =>
      new Promise((_, reject) =>
        init.signal?.addEventListener('abort', () => reject(new Error('abort'))),
      );
    await expect(
      chatCompletion(config, [], { jsonMode: false, timeoutMs: 10 }, hanging),
    ).rejects.toMatchObject({ code: 'timeout' });

    await expect(
      chatCompletion(config, [], { jsonMode: false }, respond(200, { foo: 1 })),
    ).rejects.toMatchObject({
      code: 'badResponse',
    });
  });

  it('verrät den Key nicht, auch wenn der Server ihn in der Fehlermeldung zurückgibt', async () => {
    const error = await chatCompletion(
      config,
      [],
      { jsonMode: false },
      respond(500, { error: { message: 'bad key sk-geheim-123' } }),
    ).catch((e: unknown) => e);
    expect(String(error)).not.toContain('sk-geheim');
  });
});

describe('testConnection', () => {
  it('liefert die Antwortzeit', async () => {
    expect(await testConnection(config, ok('OK'))).toBeGreaterThanOrEqual(0);
  });
});
