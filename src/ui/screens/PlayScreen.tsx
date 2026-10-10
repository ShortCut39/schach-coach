import { DEFAULT_POSITION } from 'chess.js';
import { useEffect, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import type { Color } from '../../chess/types';
import { LocalSession } from '../../play/session/LocalSession';
import type { BoardMoveInput, GameViewState, SessionNotice } from '../../play/session/types';
import { usePlay } from '../../store/play';
import { useSettings } from '../../store/settings';
import type { BoardArrow } from '../analyse/BoardOverlay';
import { boardSizeFor } from '../analyse/boardStyle';
import { EvalBar } from '../analyse/EvalBar';
import { colorName } from '../chessText';
import { ActionBar } from '../play/ActionBar';
import { HelpersCard } from '../play/HelpersCard';
import { NewGamePanel } from '../play/NewGamePanel';
import { PlayerCard } from '../play/PlayerCard';
import { PlayMoveList } from '../play/PlayMoveList';
import { ResultCard } from '../play/ResultCard';
import { Button } from '../shared/Button';
import { TrainingBoard } from '../training/TrainingBoard';

/** Kopfzeile und Abstände; daneben steht nichts unter oder über dem Brett */
const BOARD_SIZE = boardSizeFor(130);

function toBoardMove(uci: string): BoardMoveInput {
  const promotion = uci[4];
  return {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    ...(promotion === 'q' || promotion === 'r' || promotion === 'b' || promotion === 'n'
      ? { promotion }
      : {}),
  };
}

/** Kurze Meldung der Partie (z. B. „Remis abgelehnt“), verschwindet nach ein paar Sekunden. */
function useNotice(view: GameViewState | null): SessionNotice | null {
  const [hidden, setHidden] = useState<number | null>(null);
  const notice = view?.notice ?? null;
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setHidden(notice.id), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  return notice && notice.id !== hidden ? notice.code : null;
}

export function PlayScreen() {
  const { t } = useTranslation();
  const view = usePlay((s) => s.view);
  const session = usePlay((s) => s.session);
  const orientation = usePlay((s) => s.orientation);
  const hint = usePlay((s) => s.hint);
  const evaluation = usePlay((s) => s.evaluation);
  const playMove = usePlay((s) => s.playMove);
  const finishedGame = usePlay((s) => s.finishedGame);
  const analyseFinished = usePlay((s) => s.analyseFinished);
  const evalBarOn = useSettings((s) => s.play.evalBar);
  const notice = useNotice(view);

  const fen = view?.fen ?? DEFAULT_POSITION;
  const last = view?.plies.at(-1);
  const interactive =
    !!view && view.status === 'playing' && view.turn === view.myColor && !view.waiting;
  const arrows: BoardArrow[] =
    hint && hint.fen === fen
      ? [{ kind: 'best', from: hint.uci.slice(0, 2), to: hint.uci.slice(2, 4) }]
      : [];
  const showEvalBar = !!session?.capabilities.evalBar && evalBarOn && !!view;

  const topColor: Color = orientation === 'white' ? 'b' : 'w';
  const bottomColor: Color = topColor === 'w' ? 'b' : 'w';
  const turnName = colorName(t, view?.turn ?? 'w');
  const boardLabel = view ? t('play.boardLabel', { color: turnName }) : t('play.boardLabelIdle');

  const local = session instanceof LocalSession ? session : null;

  return (
    <main
      id="main"
      className="flex flex-wrap items-start justify-center gap-5 p-5"
      style={{ '--board-size': BOARD_SIZE } as CSSProperties}
    >
      <h1 className="sr-only">{t('play.title')}</h1>

      <section
        aria-label={t('play.boardRegion')}
        className="flex max-w-[calc(var(--board-size)+32px)] min-w-0 flex-[1_1_520px] items-stretch gap-2.5"
      >
        <div className="min-w-0 flex-1">
          <TrainingBoard
            id="play-board"
            fen={fen}
            orientation={orientation}
            interactive={interactive}
            onMove={(uci) => playMove(toBoardMove(uci))}
            arrows={arrows}
            lastMove={last && { from: last.from, to: last.to }}
            label={boardLabel}
          />
        </div>
        {showEvalBar && <EvalBar evaluation={evaluation ?? undefined} orientation={orientation} />}
      </section>

      <aside className="flex min-w-[320px] flex-[0_1_400px] flex-col gap-3 4xl:flex-[0_1_460px]">
        {view ? (
          <>
            <PlayerCard
              color={topColor}
              player={view.players[topColor]}
              isMe={topColor === view.myColor}
              clock={view.clock}
              toMove={view.status === 'playing' && view.turn === topColor}
            />
            <PlayMoveList plies={view.plies} />
            <PlayerCard
              color={bottomColor}
              player={view.players[bottomColor]}
              isMe={bottomColor === view.myColor}
              clock={view.clock}
              toMove={view.status === 'playing' && view.turn === bottomColor}
            />
            <p role="status" className="min-h-5 px-1 text-[13px] text-muted">
              {notice
                ? t(`play.notices.${notice}`)
                : view.status === 'playing'
                  ? view.waiting
                    ? t('play.status.opponentThinking')
                    : view.turn === view.myColor
                      ? t('play.status.yourTurn')
                      : t('play.status.opponentTurn')
                  : ''}
            </p>
            {view.status === 'ended' ? (
              <ResultCard
                view={view}
                actions={
                  finishedGame && (
                    <Button
                      variant="primary"
                      className="flex-1 px-5 whitespace-nowrap"
                      onClick={analyseFinished}
                    >
                      {t('play.result.analyse')}
                    </Button>
                  )
                }
                saved={!!finishedGame}
              />
            ) : (
              <ActionBar
                view={view}
                canAbort={session?.canAbort() ?? false}
                canOfferDraw={local ? local.canOfferDraw() : view.status === 'playing'}
              />
            )}
            {local && local.capabilities.hints && view.status === 'playing' && (
              <HelpersCard view={view} canTakeback={local.canTakeback()} />
            )}
          </>
        ) : (
          <NewGamePanel />
        )}
      </aside>
    </main>
  );
}
