import type { Color } from '../../chess/types';
import { LichessError, type LichessClient } from './client';
import { parseLichessEvent, type LichessChallenge, type LichessEventGame } from './mapper';
import { readNdjson } from './ndjson';

export interface SeekParams {
  /** Grundzeit in Minuten */
  minutes: number;
  /** Inkrement in Sekunden */
  increment: number;
  rated: boolean;
  color: Color | 'random';
}

export interface LobbyHandlers {
  onGameStart: (game: LichessEventGame) => void;
  onGameFinish: (game: LichessEventGame) => void;
  /** Neue Herausforderung (eingehend oder eigene) */
  onChallenge?: (challenge: LichessChallenge) => void;
  /** Herausforderung zurückgezogen oder abgelehnt */
  onChallengeGone?: (challenge: LichessChallenge) => void;
}

export interface ChallengeParams {
  /** Grundzeit in ganzen Minuten (Lichess: Vielfache von 60 s) */
  minutes: number;
  /** Inkrement in Sekunden (0–60) */
  increment: number;
  rated: boolean;
  color: Color | 'random';
}

/** Ausgang einer Herausforderung laut Lichess (`{"done":"accepted"}` …) */
export type ChallengeResult = 'accepted' | 'declined' | 'canceled' | 'closed';

const USERNAME = /^[A-Za-z0-9_-]{2,30}$/;

export function validUsername(name: string): boolean {
  return USERNAME.test(name.trim());
}

/** Lichess erlaubt bei Herausforderungen ganze Minuten bis 180 und 0–60 s Inkrement. */
export function validChallengeClock(minutes: number, increment: number): boolean {
  return (
    Number.isInteger(minutes) &&
    minutes >= 1 &&
    minutes <= 180 &&
    Number.isInteger(increment) &&
    increment >= 0 &&
    increment <= 60
  );
}

const EVENT_IDLE_MS = 20_000;
const RECONNECT_DELAYS = [1_000, 2_000, 4_000, 8_000, 15_000, 30_000];

/**
 * Ereignisstrom (`GET /api/stream/event`) und Partiesuche (`POST /api/board/seek`).
 * Lichess erlaubt pro Token nur einen Ereignisstrom; er wird vor der Suche geöffnet, damit kein
 * Partiestart verloren geht, und verbindet bei Abbrüchen selbst neu.
 */
export class LichessLobby {
  private controller: AbortController | null = null;
  private seekController: AbortController | null = null;
  private challengeController: AbortController | null = null;

  constructor(
    private readonly client: LichessClient,
    private readonly handlers: LobbyHandlers,
    private readonly wait: (ms: number, signal: AbortSignal) => Promise<void> = (ms, signal) =>
      new Promise((resolve) => {
        const timer = setTimeout(resolve, ms);
        signal.addEventListener('abort', () => {
          clearTimeout(timer);
          resolve();
        });
      }),
  ) {}

  get connected(): boolean {
    return this.controller !== null;
  }

  /**
   * Ereignisstrom öffnen (falls noch nicht offen). Das Promise ist erfüllt, sobald der Server
   * geantwortet hat; danach läuft der Strom im Hintergrund weiter.
   */
  connect(): Promise<void> {
    if (this.controller) return Promise.resolve();
    const controller = new AbortController();
    this.controller = controller;
    return new Promise<void>((resolveOpen, rejectOpen) => {
      let opened = false;
      void (async () => {
        let attempt = 0;
        while (!controller.signal.aborted) {
          try {
            const body = await this.client.stream('/api/stream/event', {
              signal: controller.signal,
            });
            if (!opened) {
              opened = true;
              resolveOpen();
            }
            await readNdjson(
              body,
              (raw) => {
                attempt = 0;
                const event = parseLichessEvent(raw);
                if (event?.type === 'gameStart') this.handlers.onGameStart(event.game);
                if (event?.type === 'gameFinish') this.handlers.onGameFinish(event.game);
                if (event?.type === 'challenge') this.handlers.onChallenge?.(event.challenge);
                if (event?.type === 'challengeCanceled' || event?.type === 'challengeDeclined') {
                  this.handlers.onChallengeGone?.(event.challenge);
                }
              },
              { idleMs: EVENT_IDLE_MS, signal: controller.signal },
            );
          } catch (error) {
            if (!opened) {
              this.controller = null;
              rejectOpen(error);
              return;
            }
          }
          if (controller.signal.aborted) return;
          await this.wait(
            RECONNECT_DELAYS[Math.min(attempt++, RECONNECT_DELAYS.length - 1)] ?? 30_000,
            controller.signal,
          );
        }
      })();
    });
  }

  /**
   * Gegner suchen. Läuft, bis Lichess paart (der Server schließt dann die Verbindung und meldet
   * `gameStart` im Ereignisstrom) oder bis `cancelSeek()`. Lehnt Lichess ab, wirft es
   * `LichessError` mit der Begründung des Servers.
   */
  async seek(params: SeekParams): Promise<void> {
    await this.connect();
    this.seekController?.abort();
    const controller = new AbortController();
    this.seekController = controller;
    try {
      const body = await this.client.stream('/api/board/seek', {
        method: 'POST',
        signal: controller.signal,
        form: {
          rated: params.rated,
          time: params.minutes,
          increment: params.increment,
          variant: 'standard',
          color: params.color === 'random' ? undefined : params.color === 'w' ? 'white' : 'black',
        },
      });
      // Die Suche sendet nur Keep-Alive-Zeilen; endet der Strom, ist gepaart oder abgelaufen
      await readNdjson(body, () => {}, { idleMs: EVENT_IDLE_MS, signal: controller.signal });
    } catch (error) {
      if (controller.signal.aborted) return;
      if (error instanceof LichessError) throw error;
      throw new LichessError('unreachable');
    } finally {
      if (this.seekController === controller) this.seekController = null;
    }
  }

  /**
   * Freund herausfordern (`POST /api/challenge/{username}` mit `keepAliveStream`): Die Verbindung
   * bleibt offen, bis der Freund annimmt oder ablehnt. Die Partie hat dieselbe Kennung wie die
   * Herausforderung (`onCreated`). Schließen der Verbindung zieht die Herausforderung zurück.
   */
  async challenge(
    username: string,
    params: ChallengeParams,
    onCreated: (challengeId: string) => void,
  ): Promise<ChallengeResult> {
    if (!validUsername(username)) throw new LichessError('rejected');
    await this.connect();
    this.challengeController?.abort();
    const controller = new AbortController();
    this.challengeController = controller;
    let result: ChallengeResult = 'closed';
    try {
      const body = await this.client.stream(
        `/api/challenge/${encodeURIComponent(username.trim())}`,
        {
          method: 'POST',
          signal: controller.signal,
          form: {
            rated: params.rated,
            'clock.limit': params.minutes * 60,
            'clock.increment': params.increment,
            color: params.color === 'random' ? 'random' : params.color === 'w' ? 'white' : 'black',
            variant: 'standard',
            keepAliveStream: true,
          },
        },
      );
      await readNdjson(
        body,
        (raw) => {
          const line = raw as { done?: unknown; id?: unknown; challenge?: { id?: unknown } };
          const id = typeof line.id === 'string' ? line.id : line.challenge?.id;
          if (typeof id === 'string') onCreated(id);
          if (line.done === 'accepted' || line.done === 'declined' || line.done === 'canceled') {
            result = line.done;
          }
        },
        { idleMs: EVENT_IDLE_MS, signal: controller.signal },
      );
    } catch (error) {
      if (controller.signal.aborted) return 'canceled';
      if (error instanceof LichessError) throw error;
      throw new LichessError('unreachable');
    } finally {
      if (this.challengeController === controller) this.challengeController = null;
    }
    return result;
  }

  cancelChallenge(): void {
    this.challengeController?.abort();
    this.challengeController = null;
  }

  async acceptChallenge(id: string): Promise<void> {
    await this.client.request(`/api/challenge/${encodeURIComponent(id)}/accept`, {
      method: 'POST',
    });
  }

  async declineChallenge(id: string): Promise<void> {
    await this.client.request(`/api/challenge/${encodeURIComponent(id)}/decline`, {
      method: 'POST',
      form: { reason: 'generic' },
    });
  }

  /** Suche abbrechen: Verbindung schließen (Lichess löscht die Suche dann). */
  cancelSeek(): void {
    this.seekController?.abort();
    this.seekController = null;
  }

  close(): void {
    this.cancelSeek();
    this.cancelChallenge();
    this.controller?.abort();
    this.controller = null;
  }
}
