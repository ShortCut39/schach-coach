import { Chess } from 'chess.js';
import type { FetchFn } from '../llm/types';

/**
 * Simulierter Lichess-Server für Tests (nur Tests, keine echten Daten): Board-API-Partiestrom,
 * Ereignisstrom, Suche und die Board-Aktionen. Der Test steuert den Gegner und Störungen.
 */
interface FakeGame {
  id: string;
  white: string;
  black: string;
  moves: string[];
  wtime: number;
  btime: number;
  status: string;
  winner?: 'white' | 'black';
  wdraw?: boolean;
  bdraw?: boolean;
  wtakeback?: boolean;
  btakeback?: boolean;
}

interface OpenStream {
  push: (line: unknown) => void;
  close: () => void;
  fail: () => void;
}

const encoder = new TextEncoder();

function ndjsonResponse(register: (stream: OpenStream) => void, signal?: AbortSignal | null) {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  let closed = false;
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
    cancel() {
      closed = true;
    },
  });
  const stream: OpenStream = {
    push: (line) => {
      if (!closed)
        controller.enqueue(encoder.encode(`${line === '' ? '' : JSON.stringify(line)}\n`));
    },
    close: () => {
      if (!closed) {
        closed = true;
        controller.close();
      }
    },
    fail: () => {
      if (!closed) {
        closed = true;
        controller.error(new Error('Verbindung abgebrochen'));
      }
    },
  };
  signal?.addEventListener('abort', () => stream.fail());
  register(stream);
  return new Response(body, { status: 200, headers: { 'Content-Type': 'application/x-ndjson' } });
}

/** UCI → Zugobjekt für chess.js */
const toMove = (uci: string) => ({
  from: uci.slice(0, 2),
  to: uci.slice(2, 4),
  ...(uci[4] ? { promotion: uci[4] } : {}),
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export class FakeLichess {
  readonly me = { id: 'ich', username: 'Ich', perfs: { rapid: { rating: 1500 } } };
  games = new Map<string, FakeGame>();
  gameStreams = new Map<string, OpenStream[]>();
  eventStreams: OpenStream[] = [];
  seekStreams: OpenStream[] = [];
  requests: string[] = [];
  /** Nächster Zug wird abgelehnt (400) */
  rejectNextMove = false;
  /** Nächste Suche wird abgelehnt (400) mit dieser Begründung */
  rejectSeek: string | null = null;
  /** Partiestrom lässt sich gerade nicht öffnen */
  gameStreamDown = false;

  addGame(id: string, myColor: 'white' | 'black' = 'white', moves: string[] = []): FakeGame {
    const game: FakeGame = {
      id,
      white: myColor === 'white' ? 'ich' : 'gegner',
      black: myColor === 'white' ? 'gegner' : 'ich',
      moves,
      wtime: 600_000,
      btime: 600_000,
      status: 'started',
    };
    this.games.set(id, game);
    return game;
  }

  private stateOf(game: FakeGame) {
    return {
      type: 'gameState',
      moves: game.moves.join(' '),
      wtime: game.wtime,
      btime: game.btime,
      winc: 0,
      binc: 0,
      status: game.status,
      ...(game.winner ? { winner: game.winner } : {}),
      ...(game.wdraw ? { wdraw: true } : {}),
      ...(game.bdraw ? { bdraw: true } : {}),
      ...(game.wtakeback ? { wtakeback: true } : {}),
      ...(game.btakeback ? { btakeback: true } : {}),
    };
  }

  private fullOf(game: FakeGame) {
    const player = (id: string) =>
      id === 'ich'
        ? { id: 'ich', name: 'Ich', rating: 1500 }
        : { id: 'gegner', name: 'Gegner', rating: 1520, title: null };
    return {
      type: 'gameFull',
      id: game.id,
      variant: { key: 'standard', name: 'Standard' },
      clock: { initial: 600_000, increment: 0 },
      speed: 'rapid',
      perf: { name: 'Rapid' },
      rated: false,
      createdAt: Date.UTC(2026, 9, 11, 12),
      white: player(game.white),
      black: player(game.black),
      initialFen: 'startpos',
      state: this.stateOf(game),
    };
  }

  /** Neuen Stand an alle offenen Partieströme senden; beendete Partien schließen den Strom. */
  broadcast(id: string): void {
    const game = this.games.get(id);
    if (!game) return;
    for (const stream of this.gameStreams.get(id) ?? []) {
      stream.push(this.stateOf(game));
      if (game.status !== 'started') stream.close();
    }
    if (game.status !== 'started') {
      this.gameStreams.set(id, []);
      for (const events of this.eventStreams) {
        events.push({ type: 'gameFinish', game: { gameId: id, fullId: `${id}xxxx` } });
      }
    }
  }

  /** Zug des Gegners */
  opponentMove(id: string, uci: string): void {
    const game = this.games.get(id);
    if (!game) return;
    game.moves.push(uci);
    this.broadcast(id);
  }

  /** Verbindung zu allen Partieströmen dieser Partie trennen */
  dropGameStreams(id: string): void {
    for (const stream of this.gameStreams.get(id) ?? []) stream.fail();
    this.gameStreams.set(id, []);
  }

  chats: string[] = [];
  outgoing: { id: string; stream: OpenStream } | null = null;
  lastChallengeForm: URLSearchParams | null = null;

  /** Partie anlegen und `gameStart` im Ereignisstrom melden */
  startGame(id: string, myColor: 'white' | 'black'): void {
    this.addGame(id, myColor);
    for (const events of this.eventStreams) {
      events.push({
        type: 'gameStart',
        game: {
          gameId: id,
          color: myColor,
          variant: { key: 'standard' },
          speed: 'blitz',
          compat: { board: true },
        },
      });
    }
  }

  /** Der Freund nimmt die eigene Herausforderung an bzw. lehnt ab */
  answerOutgoing(answer: 'accepted' | 'declined'): void {
    const outgoing = this.outgoing;
    if (!outgoing) return;
    outgoing.stream.push({ done: answer });
    outgoing.stream.close();
    this.outgoing = null;
    if (answer === 'accepted') this.startGame(outgoing.id, 'white');
  }

  /** Jemand fordert mich heraus */
  incomingChallenge(id: string): void {
    for (const events of this.eventStreams) {
      events.push({
        type: 'challenge',
        challenge: {
          id,
          url: `https://lichess.org/${id}`,
          status: 'created',
          challenger: { id: 'freund', name: 'Freund', rating: 1600 },
          destUser: { id: 'ich', name: 'Ich', rating: 1500 },
          variant: { key: 'standard', name: 'Standard' },
          rated: false,
          speed: 'blitz',
          timeControl: { type: 'clock', limit: 300, increment: 3, show: '5+3' },
          color: 'random',
          perf: { icon: '', name: 'Blitz' },
          direction: 'in',
        },
      });
    }
  }

  /** Suche paaren: Partie anlegen, `gameStart` senden, Suche schließen */
  pairSeek(id: string, myColor: 'white' | 'black' = 'white'): void {
    this.addGame(id, myColor);
    for (const events of this.eventStreams) {
      events.push({
        type: 'gameStart',
        game: {
          gameId: id,
          fullId: `${id}xxxx`,
          color: myColor,
          variant: { key: 'standard', name: 'Standard' },
          speed: 'rapid',
          rated: false,
          compat: { board: true, bot: false },
          opponent: { id: 'gegner', username: 'Gegner', rating: 1520 },
        },
      });
    }
    for (const seek of this.seekStreams) seek.close();
    this.seekStreams = [];
  }

  readonly fetch: FetchFn = async (url, init) => {
    const path = url.replace('https://lichess.org', '').split('?')[0] ?? '';
    const method = init.method ?? 'GET';
    this.requests.push(`${method} ${path}`);
    const auth = (init.headers as Record<string, string> | undefined)?.Authorization;
    if (!url.startsWith('https://lichess.org/')) throw new Error('falscher Host');
    if (auth !== 'Bearer lip_test') return json({ error: 'No such token' }, 401);

    if (path === '/api/account') return json(this.me);
    if (path === '/api/account/playing') {
      return json({
        nowPlaying: [...this.games.values()]
          .filter((g) => g.status === 'started')
          .map((g) => ({
            gameId: g.id,
            fullId: `${g.id}xxxx`,
            color: g.white === 'ich' ? 'white' : 'black',
            variant: { key: 'standard', name: 'Standard' },
            speed: 'rapid',
            rated: false,
            isMyTurn: true,
            secondsLeft: 600,
            opponent: { id: 'gegner', username: 'Gegner', rating: 1520 },
          })),
      });
    }
    if (path === '/api/stream/event') {
      return ndjsonResponse((stream) => this.eventStreams.push(stream), init.signal);
    }
    if (path === '/api/board/seek') {
      if (this.rejectSeek) {
        const reason = this.rejectSeek;
        this.rejectSeek = null;
        return json({ error: reason }, 400);
      }
      return ndjsonResponse((stream) => this.seekStreams.push(stream), init.signal);
    }
    const streamMatch = /^\/api\/board\/game\/stream\/(\w+)$/.exec(path);
    if (streamMatch) {
      const game = this.games.get(streamMatch[1] ?? '');
      if (!game) return json({ error: 'Not found' }, 404);
      if (this.gameStreamDown) throw new Error('offline');
      return ndjsonResponse((stream) => {
        this.gameStreams.set(game.id, [...(this.gameStreams.get(game.id) ?? []), stream]);
        stream.push(this.fullOf(game));
        if (game.status !== 'started') stream.close();
      }, init.signal);
    }
    const action = /^\/api\/board\/game\/(\w+)\/(.+)$/.exec(path);
    if (action && method === 'POST') {
      const game = this.games.get(action[1] ?? '');
      if (!game || game.status !== 'started') return json({ error: 'Game is over' }, 400);
      const [verb, arg = ''] = (action[2] ?? '').split('/');
      const myColor = game.white === 'ich' ? 'white' : 'black';
      const other = myColor === 'white' ? 'black' : 'white';
      switch (verb) {
        case 'move': {
          const chess = new Chess();
          for (const m of game.moves) chess.move(toMove(m));
          const myTurn = (chess.turn() === 'w') === (myColor === 'white');
          let legal: boolean;
          try {
            chess.move(toMove(arg));
            legal = true;
          } catch {
            legal = false;
          }
          if (this.rejectNextMove || !myTurn || !legal) {
            this.rejectNextMove = false;
            return json({ error: 'Not your turn, or game already over' }, 400);
          }
          game.moves.push(arg);
          game.wdraw = game.bdraw = false;
          this.broadcast(game.id);
          return json({ ok: true });
        }
        case 'resign':
          game.status = 'resign';
          game.winner = other;
          this.broadcast(game.id);
          return json({ ok: true });
        case 'abort':
          if (game.moves.length >= 2) return json({ error: 'Cannot abort' }, 400);
          game.status = 'aborted';
          this.broadcast(game.id);
          return json({ ok: true });
        case 'draw': {
          const theirOffer = other === 'white' ? game.wdraw : game.bdraw;
          if (arg === 'yes' && theirOffer) {
            game.status = 'draw';
          } else if (arg === 'yes') {
            if (myColor === 'white') game.wdraw = true;
            else game.bdraw = true;
          } else {
            game.wdraw = game.bdraw = false;
          }
          this.broadcast(game.id);
          return json({ ok: true });
        }
        case 'takeback': {
          const theirRequest = other === 'white' ? game.wtakeback : game.btakeback;
          if (arg === 'yes' && !theirRequest) {
            // Eigene Anfrage: Lichess fragt den Gegner
            if (myColor === 'white') game.wtakeback = true;
            else game.btakeback = true;
          } else {
            if (arg === 'yes') game.moves.splice(-2, 2);
            game.wtakeback = game.btakeback = false;
          }
          this.broadcast(game.id);
          return json({ ok: true });
        }
        case 'chat': {
          const text = new URLSearchParams(String(init.body)).get('text') ?? '';
          this.chats.push(text);
          for (const stream of this.gameStreams.get(game.id) ?? []) {
            stream.push({ type: 'chatLine', room: 'player', username: 'Ich', text });
          }
          return json({ ok: true });
        }
        case 'claim-victory':
          game.status = 'timeout';
          game.winner = myColor;
          this.broadcast(game.id);
          return json({ ok: true });
        default:
          return json({ error: 'unbekannt' }, 400);
      }
    }
    const challengeAction = /^\/api\/challenge\/(\w+)\/(accept|decline)$/.exec(path);
    if (challengeAction && method === 'POST') {
      const id = challengeAction[1] ?? '';
      if (challengeAction[2] === 'accept') this.startGame(id, 'black');
      return json({ ok: true });
    }
    const challengeCreate = /^\/api\/challenge\/([\w-]+)$/.exec(path);
    if (challengeCreate && method === 'POST') {
      this.lastChallengeForm = new URLSearchParams(String(init.body));
      return ndjsonResponse((stream) => {
        this.outgoing = { id: 'chal0001', stream };
        stream.push({ id: 'chal0001', status: 'created', direction: 'out' });
      }, init.signal);
    }
    if (path === '/api/token' && method === 'DELETE') return new Response(null, { status: 204 });
    return json({ error: 'Not found' }, 404);
  };
}
