import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { formatMoveNumber, formatSan } from '../../chess/notation';
import { useApiKey } from '../../store/apiKey';
import { isLlmConfigured } from '../../store/explanations';
import { useLibrary } from '../../store/library';
import { useNavigation } from '../../store/navigation';
import { useSettings } from '../../store/settings';
import { puzzlesFor, useTraining, type PuzzleData } from '../../store/training';
import { formatLine, parseMoveInput } from '../../training/moveText';
import { buildSession, overview } from '../../training/puzzles';
import { INTERVAL_DAYS } from '../../training/srs';
import { colorName } from '../chessText';
import { Button } from '../shared/Button';
import { CategoryIcon } from '../shared/CategoryIcon';
import { inputClass } from '../shared/form';
import { Panel } from '../shared/Panel';
import type { BoardArrow } from '../analyse/BoardOverlay';
import { TrainingBoard } from '../training/TrainingBoard';
import { useOpenAt } from './useOpenAt';

const arrow = (uci: string | undefined, kind: BoardArrow['kind']): BoardArrow[] =>
  uci && uci.length >= 4 ? [{ kind, from: uci.slice(0, 2), to: uci.slice(2, 4) }] : [];

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col rounded-control border border-border bg-panel-sub px-3.5 py-2.5">
      <span className="font-mono text-xl font-semibold">{value}</span>
      <span className="text-[12.5px] text-muted">{label}</span>
    </div>
  );
}

/** Übersicht: was heute fällig ist, Fehlerarten laut Einstellungen, Start. */
function TrainingOverview() {
  const { t } = useTranslation();
  const entries = useLibrary((s) => s.entries);
  const loaded = useLibrary((s) => s.loaded);
  const sources = useSettings((s) => s.training);
  const setScreen = useNavigation((s) => s.setScreen);
  const { cards, motif, setMotif, start } = useTraining();
  const [now] = useState(() => new Date());

  const puzzles = useMemo(() => puzzlesFor(entries, motif, sources), [entries, motif, sources]);
  const stats = overview(puzzles, cards, now);
  const sessionCount = buildSession(puzzles, cards, now).length;
  const nextDue = puzzles
    .flatMap((p) => cards[p.id]?.due ?? [])
    .sort()
    .at(0);
  const sourceList = (['blunders', 'missed', 'inaccuracies'] as const)
    .filter((key) => sources[key])
    .map((key) => t(`training.sourceNames.${key}`))
    .join(', ');

  let status: string | null = null;
  if (loaded && entries.length === 0) status = t('training.emptyLibrary');
  else if (stats.total === 0)
    status = motif ? t('training.noPuzzlesMotif') : t('training.noPuzzles');
  else if (sessionCount === 0) status = t('training.allDone');

  return (
    <Panel className="flex flex-col gap-4 px-5 py-[18px]">
      <div>
        <h2 className="text-base font-bold">{t('training.overviewTitle')}</h2>
        <p className="mt-0.5 max-w-[720px] text-[13.5px] text-muted">
          {t('training.overviewText')}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
        <span>{t('training.sources', { list: sourceList })}</span>
        <button
          type="button"
          onClick={() => setScreen('einstellungen')}
          className="min-h-8 rounded-small px-1 font-semibold text-accent-text hover:underline"
        >
          {t('training.changeSources')}
        </button>
      </div>

      {motif && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex min-h-8 items-center rounded-full border border-border-accent bg-accent-bg px-3 text-[13px] font-semibold text-accent-text">
            {t('training.motifFilter', { motif: t(`motifs.${motif}.name`) })}
          </span>
          <button
            type="button"
            onClick={() => setMotif(null)}
            className="min-h-8 rounded-small px-1 text-[13px] font-semibold text-accent-text hover:underline"
          >
            {t('training.clearMotif')}
          </button>
        </div>
      )}

      {stats.total > 0 && (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <Stat value={stats.dueReviews} label={t('training.dueReviews')} />
          <Stat value={stats.fresh} label={t('training.fresh')} />
          <Stat value={stats.learned} label={t('training.learned')} />
          <Stat value={stats.total} label={t('training.total')} />
        </div>
      )}

      {status && (
        <p role="status" className="text-[13.5px] text-body">
          {status}
          {sessionCount === 0 && stats.total > 0 && nextDue && (
            <>
              {' '}
              {t('training.nextDue', {
                date: new Date(nextDue).toLocaleDateString('de-DE', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                }),
              })}
            </>
          )}
        </p>
      )}

      {sessionCount > 0 && (
        <div>
          <Button variant="primary" onClick={() => void start(entries)}>
            {t('training.start', { count: sessionCount })}
          </Button>
        </div>
      )}
      <p className="text-[12.5px] text-faint">{t('training.schedule')}</p>
    </Panel>
  );
}

function MoveInput({ fen, onMove }: { fen: string; onMove: (uci: string) => void }) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [invalid, setInvalid] = useState(false);
  function submit(event: FormEvent) {
    event.preventDefault();
    const uci = parseMoveInput(fen, text);
    setInvalid(!uci);
    if (uci) {
      setText('');
      onMove(uci);
    }
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-1">
      <label htmlFor="training-move" className="text-[13px] font-semibold">
        {t('training.moveInput')}
      </label>
      <div className="flex gap-2">
        <input
          id="training-move"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setInvalid(false);
          }}
          placeholder={t('training.moveInputPlaceholder')}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={invalid}
          aria-describedby={invalid ? 'training-move-error' : undefined}
          className={`${inputClass} font-mono`}
        />
        <Button variant="ghost" type="submit" disabled={!text.trim()}>
          {t('training.moveInputSubmit')}
        </Button>
      </div>
      {invalid && (
        <p id="training-move-error" role="alert" className="text-[12.5px] text-danger">
          {t('training.moveInputInvalid')}
        </p>
      )}
    </form>
  );
}

/**
 * KI-Erklärung nach dem Lösen: warum der bessere Zug besser ist. Ohne KI-Anbindung wird die
 * gespeicherte Erklärung aus der Analyse gezeigt (falls vorhanden) und auf die Einrichtung verwiesen.
 */
function AiExplanationBox({ data }: { data: PuzzleData }) {
  const { t } = useTranslation();
  const ai = useTraining((s) => s.ai);
  const explain = useTraining((s) => s.explain);
  const setScreen = useNavigation((s) => s.setScreen);
  useApiKey((s) => s.key);
  useSettings((s) => s.llm);
  const frame = 'rounded-control border border-border bg-panel-sub px-3.5 py-2.5';
  const heading = (text: string) => (
    <div className="font-mono text-[11px] font-semibold tracking-[0.06em] text-faint uppercase">
      {text}
    </div>
  );

  if (!isLlmConfigured()) {
    return (
      <div className={`${frame} flex flex-col gap-1.5`}>
        {data.explanation && (
          <>
            {heading(t('training.explanationTitle'))}
            <p className="text-[13.5px] text-body">{data.explanation.warum}</p>
            {data.explanation.merksatz && (
              <p className="text-[13.5px] font-semibold">{data.explanation.merksatz}</p>
            )}
          </>
        )}
        <p className="text-[13px] text-muted">{t('training.aiNotConfigured')}</p>
        <div>
          <Button variant="ghost" onClick={() => setScreen('einstellungen')}>
            {t('coach.setup')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${frame} flex flex-col gap-1.5`} aria-live="polite">
      {heading(t('training.aiTitle'))}
      {ai.status === 'idle' && (
        <div>
          <Button variant="ghost" onClick={() => void explain()}>
            {t('coach.request')}
          </Button>
        </div>
      )}
      {ai.status === 'loading' && (
        <p role="status" className="text-[13.5px] text-muted">
          {t('training.aiLoading')}
        </p>
      )}
      {ai.status === 'failed' && (
        <div className="flex flex-col items-start gap-2">
          <p role="alert" className="text-[13.5px] text-danger">
            {t(`llmErrors.${ai.error ?? 'badResponse'}`)}
          </p>
          <Button variant="ghost" onClick={() => void explain()}>
            {t('coach.retry')}
          </Button>
        </div>
      )}
      {ai.status === 'done' && ai.explanation && (
        <>
          <p className="text-[13.5px] text-body">{ai.explanation.was}</p>
          <p className="text-[13.5px] text-body">{ai.explanation.warum}</p>
          {ai.explanation.merksatz && (
            <p className="text-[13.5px] font-semibold">{ai.explanation.merksatz}</p>
          )}
          {ai.model && (
            <p className="font-mono text-[11.5px] text-faint">
              {t('training.aiSource', { model: ai.model })}
            </p>
          )}
        </>
      )}
    </div>
  );
}

/** Rückmeldung nach dem Zug – alle Zahlen und Züge stammen von Stockfish bzw. chess.js. */
function Feedback({ data }: { data: PuzzleData }) {
  const { t } = useTranslation();
  const notation = useSettings((s) => s.notation);
  const attempt = useTraining((s) => s.attempt);
  const card = useTraining((s) => s.cards[data.puzzle.id]);
  const loss = (value: number) =>
    new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 }).format(value);
  const best = data.before.lines[0]?.pv ?? [];
  const userMove = attempt.move ? formatLine(data.fen, [attempt.move], notation, 1) : '';
  const check = attempt.check;
  const finished = attempt.status === 'correct' || attempt.status === 'solution';

  return (
    <div className="flex flex-col gap-3">
      <div role="status" aria-live="polite" className="flex flex-col gap-1">
        {attempt.status === 'loading' && (
          <p className="text-[13.5px] text-muted">{t('training.loading')}</p>
        )}
        {attempt.status === 'checking' && (
          <p className="text-[13.5px] text-muted">{t('training.checking')}</p>
        )}
        {attempt.status === 'error' && (
          <p className="text-[13.5px] text-danger">{t('training.error')}</p>
        )}
        {attempt.status === 'correct' && check && (
          <>
            <p className="text-base font-bold text-success">{t('training.correct')}</p>
            <p className="text-[13.5px] text-body">
              {check.isBest
                ? t('training.correctBest', { move: userMove })
                : t('training.correctGood', {
                    move: userMove,
                    loss: loss(check.winLoss),
                    best: formatLine(data.fen, best, notation, 1),
                  })}
            </p>
          </>
        )}
        {attempt.status === 'wrong' && check && (
          <>
            <p className="text-base font-bold text-danger">{t('training.wrong')}</p>
            <p className="text-[13.5px] text-body">
              {attempt.move === data.played.uci && `${t('training.sameAsGame')} `}
              {t('training.wrongLoss', { move: userMove, loss: loss(check.winLoss) })}
            </p>
            {check.continuation.length > 0 && attempt.fenAfter && (
              <p className="text-[13.5px] text-body">
                {t('training.reply', {
                  line: formatLine(attempt.fenAfter, check.continuation, notation, 3),
                })}
              </p>
            )}
          </>
        )}
        {attempt.status === 'solution' && (
          <>
            <p className="text-base font-bold">{t('training.solutionTitle')}</p>
            <p className="text-[13.5px] text-body">
              {t('training.solution', { line: formatLine(data.fen, best, notation, 4) })}
            </p>
          </>
        )}
      </div>

      {finished && (
        <div className="flex flex-col gap-2 border-t border-divider pt-3">
          {attempt.status === 'correct' && check?.continuation.length && attempt.fenAfter ? (
            <p className="text-[13px] text-muted">
              {t('training.reply', {
                line: formatLine(attempt.fenAfter, check.continuation, notation, 3),
              })}
            </p>
          ) : null}
          {data.played.after?.lines[0] && (
            <p className="text-[13px] text-muted">
              {t('training.gameLine', {
                move: formatLine(data.fen, [data.played.uci], notation, 1),
                line: formatLine(data.played.fenAfter, data.played.after.lines[0].pv, notation, 3),
              })}
            </p>
          )}
          <AiExplanationBox data={data} />
          {card && attempt.recorded && (
            <p className="text-[12.5px] text-faint">
              {t('training.nextIn', { count: INTERVAL_DAYS[card.box] ?? 0 })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function TrainingSession() {
  const { t } = useTranslation();
  const notation = useSettings((s) => s.notation);
  const { run, current, attempt, tryMove, hint, showSolution, retry, next, stop } = useTraining();
  const openAt = useOpenAt();
  if (!run) return null;

  if (run.index >= run.queue.length) {
    return (
      <Panel className="flex flex-col items-start gap-3 px-5 py-[18px]">
        <h2 className="text-base font-bold">{t('training.doneTitle')}</h2>
        <p role="status" className="text-[13.5px] text-body">
          {t('training.doneText', { correct: run.firstTry.correct, total: run.firstTry.total })}
        </p>
        <Button variant="ghost" onClick={stop}>
          {t('training.back')}
        </Button>
      </Panel>
    );
  }

  const puzzle = current?.puzzle ?? run.queue[run.index];
  const color = puzzle ? colorName(t, puzzle.color) : '';
  const showAfter =
    attempt.fenAfter &&
    (attempt.status === 'checking' || attempt.status === 'correct' || attempt.status === 'wrong');
  const fen = showAfter ? attempt.fenAfter : current?.fen;
  const bestMove = current?.before.lines[0]?.pv[0];
  const arrows: BoardArrow[] =
    attempt.status === 'solution'
      ? arrow(bestMove, 'best')
      : attempt.status === 'correct' || attempt.status === 'wrong'
        ? [...arrow(attempt.move, 'played'), ...arrow(attempt.check?.continuation[0], 'reply')]
        : [];
  const canMove = attempt.status === 'ready' && !!current;
  const canHint = attempt.status === 'ready' || attempt.status === 'wrong';

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)]">
      {current && fen ? (
        <TrainingBoard
          fen={fen}
          orientation={puzzle?.color === 'b' ? 'black' : 'white'}
          interactive={canMove}
          onMove={(uci) => void tryMove(uci)}
          arrows={arrows}
          hintSquare={canMove && attempt.hints >= 2 ? bestMove?.slice(0, 2) : undefined}
          lastMove={
            showAfter && attempt.move
              ? { from: attempt.move.slice(0, 2), to: attempt.move.slice(2, 4) }
              : undefined
          }
          label={t('training.boardLabel', { color })}
        />
      ) : (
        <div aria-hidden="true" className="aspect-square rounded-[6px] bg-panel-sub" />
      )}

      <Panel className="flex flex-col gap-4 px-5 py-[18px]">
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-[12.5px] font-semibold text-muted">
            {t('training.progress', { current: run.index + 1, total: run.queue.length })}
          </span>
          <Button variant="secondary" className="min-h-9 px-3 text-[12.5px]" onClick={stop}>
            {t('training.finish')}
          </Button>
        </div>

        {puzzle && (
          <div className="flex flex-col gap-1.5">
            <h2 className="text-base font-bold">{t('training.task', { color })}</h2>
            <p className="text-[13px] text-muted">
              {t('training.from', {
                game: puzzle.gameTitle,
                move: formatMoveNumber(puzzle.moveNumber, puzzle.color).replace(/[.…]+$/, ''),
              })}
            </p>
            <p className="flex items-center gap-2 text-[13.5px]">
              <span className="text-muted">{t('training.playedWas')}</span>
              <CategoryIcon category={puzzle.category} size={16} decorative />
              <span className="font-semibold">
                {formatMoveNumber(puzzle.moveNumber, puzzle.color)}{' '}
                {formatSan(puzzle.playedSan, notation)}
              </span>
              <span className="text-muted">({t(`categories.${puzzle.category}`)})</span>
            </p>
          </div>
        )}

        {puzzle && attempt.hints >= 1 && (
          <div className="rounded-control border border-border-accent bg-accent-bg px-3.5 py-2.5 text-[13.5px] text-accent-text">
            <p>{t(`motifs.${puzzle.motif}.hint`)}</p>
            {attempt.hints >= 2 && <p className="mt-1">{t('training.hintPieceText')}</p>}
          </div>
        )}

        {current && <Feedback data={current} />}

        {canMove && current && (
          <MoveInput
            key={current.puzzle.id}
            fen={current.fen}
            onMove={(uci) => void tryMove(uci)}
          />
        )}

        <div className="flex flex-wrap gap-2">
          {canHint && attempt.hints < 2 && (
            <Button variant="ghost" onClick={hint}>
              {attempt.hints === 0 ? t('training.hint') : t('training.hintPiece')}
            </Button>
          )}
          {(attempt.status === 'wrong' || attempt.status === 'error') && (
            <Button variant="ghost" onClick={retry}>
              {t('training.retry')}
            </Button>
          )}
          {canHint && (
            <Button variant="ghost" onClick={() => void showSolution()}>
              {t('training.showSolution')}
            </Button>
          )}
          {(attempt.status === 'correct' || attempt.status === 'solution') && (
            <>
              <Button
                variant="primary"
                className="min-h-hit px-5 text-sm"
                onClick={() => void next()}
              >
                {t('training.next')}
              </Button>
              {puzzle && (
                <Button variant="ghost" onClick={() => void openAt(puzzle.gameId, puzzle.ply)}>
                  {t('training.openGame')}
                </Button>
              )}
            </>
          )}
        </div>
      </Panel>
    </div>
  );
}

/** Bibliothek → Training: Aufgaben aus eigenen Fehlern mit Wiederholung. */
export function TrainingView() {
  const entries = useLibrary((s) => s.entries);
  const ensureStats = useLibrary((s) => s.ensureStats);
  const loadCards = useTraining((s) => s.loadCards);
  const running = useTraining((s) => s.run !== null);

  useEffect(() => {
    void loadCards();
  }, [loadCards]);
  useEffect(() => {
    void ensureStats();
  }, [ensureStats, entries.length]);

  return running ? <TrainingSession /> : <TrainingOverview />;
}
