import { useTranslation } from 'react-i18next';
import { formatMoveNumber, formatSan } from '../../chess/notation';
import { headerValue } from '../../chess/pgn';
import type { Color } from '../../chess/types';
import { positionsOf } from '../../store/analysis';
import { selectCurrentFen, selectCurrentPly, useGame } from '../../store/game';
import { useNavigation } from '../../store/navigation';
import { useSettings } from '../../store/settings';
import { BoardControls } from '../analyse/BoardControls';
import { AnalysisProgress } from '../analyse/AnalysisProgress';
import { BoardView } from '../analyse/BoardView';
import { EngineLines } from '../analyse/EngineLines';
import { EvalBar } from '../analyse/EvalBar';
import { EvalGraph } from '../analyse/EvalGraph';
import { MoveList } from '../analyse/MoveList';
import { PlayerRow } from '../analyse/PlayerRow';
import { PositionInfo } from '../analyse/PositionInfo';
import { SidePanel } from '../analyse/SidePanel';
import { useBoardKeyboard } from '../analyse/useBoardKeyboard';
import { useCurrentEvals } from '../analyse/useAnalysisFor';
import { KnightIcon } from '../shared/KnightIcon';
import { Panel } from '../shared/Panel';

export function AnalyseScreen() {
  const source = useGame((s) => s.source);
  return source ? <AnalyseLayout /> : <EmptyState />;
}

function EmptyState() {
  const { t } = useTranslation();
  const setScreen = useNavigation((s) => s.setScreen);

  return (
    <main className="flex flex-1 items-start justify-center p-5">
      <h1 className="sr-only">{t('analyse.title')}</h1>
      <Panel className="mt-16 flex w-full max-w-[520px] flex-col items-center gap-3 px-8 py-10 text-center">
        <span className="flex size-12 items-center justify-center rounded-panel bg-accent-bg text-accent-text">
          <KnightIcon className="size-7" />
        </span>
        <h2 className="text-lg font-semibold">{t('analyse.emptyTitle')}</h2>
        <p className="text-muted">{t('analyse.emptyText')}</p>
        <button
          type="button"
          onClick={() => setScreen('import')}
          className="mt-2 min-h-hit rounded-control bg-accent px-5 font-semibold text-on-accent hover:brightness-110"
        >
          {t('analyse.emptyAction')}
        </button>
      </Panel>
    </main>
  );
}

function AnalyseLayout() {
  const { t } = useTranslation();
  useBoardKeyboard();

  const source = useGame((s) => s.source);
  const userColor = useGame((s) => s.userColor);
  const orientation = useGame((s) => s.orientation);
  const current = useGame((s) => s.current);
  const fen = useGame(selectCurrentFen);
  const ply = useGame(selectCurrentPly);
  const { first, prev, next, last, flip, goTo } = useGame.getState();
  const notation = useSettings((s) => s.notation);
  const evals = useCurrentEvals();

  if (!source || !fen) return null;

  const plyCount = source.kind === 'game' ? source.plies.length : 0;
  const headers = source.kind === 'game' ? source.headers : {};
  const topColor: Color = orientation === 'white' ? 'b' : 'w';
  const bottomColor: Color = topColor === 'w' ? 'b' : 'w';
  const playerName = (color: Color) => headerValue(headers, color === 'w' ? 'White' : 'Black');
  const opening = [headerValue(headers, 'Opening'), headerValue(headers, 'ECO')]
    .filter(Boolean)
    .join(' · ');

  const boardLabel = ply
    ? t('analyse.board.positionAfter', {
        move: `${formatMoveNumber(ply.moveNumber, ply.color)} ${formatSan(ply.san, notation)}`,
      })
    : t('analyse.board.positionStart');

  // Engine-Linien zeigen, was vor dem aktuellen Zug am besten war (wie im Mockup „vor 16. Zug“)
  const fens = positionsOf(source);
  const linesIndex = Math.max(current, 0);
  const linesCaption =
    source.kind === 'position'
      ? t('analyse.engine.position')
      : ply
        ? t('analyse.engine.before', {
            move: `${formatMoveNumber(ply.moveNumber, ply.color)} ${formatSan(ply.san, notation)}`,
          })
        : t('analyse.engine.start');

  return (
    <main className="flex flex-wrap items-start gap-5 p-5">
      <h1 className="sr-only">{t('analyse.title')}</h1>

      <aside className="flex min-w-[300px] flex-[0_1_360px] flex-col gap-4">
        {source.kind === 'game' ? <MoveList game={source} /> : <PositionInfo position={source} />}
      </aside>

      <section
        aria-label={t('analyse.board.label')}
        className="flex max-w-[660px] min-w-0 flex-[1_1_520px] flex-col gap-3"
      >
        <PlayerRow
          color={topColor}
          isUser={topColor === userColor}
          name={playerName(topColor)}
          aside={
            opening && (
              <span className="font-mono text-[12.5px] font-medium text-muted">{opening}</span>
            )
          }
        />
        <div className="flex items-stretch gap-2.5">
          <div className="min-w-0 flex-1">
            <BoardView
              fen={fen}
              orientation={orientation}
              lastMove={ply && { from: ply.from, to: ply.to }}
              label={boardLabel}
            />
          </div>
          <EvalBar evaluation={evals[current + 1]} orientation={orientation} />
        </div>
        <PlayerRow
          color={bottomColor}
          isUser={bottomColor === userColor}
          name={playerName(bottomColor)}
          aside={
            <BoardControls
              canBack={current > -1}
              canForward={current < plyCount - 1}
              onFirst={first}
              onPrev={prev}
              onNext={next}
              onLast={last}
              onFlip={flip}
            />
          }
        />
        {source.kind === 'game' && (
          <EvalGraph evals={evals} plyCount={plyCount} current={current} onSelect={goTo} />
        )}
      </section>

      <aside className="flex min-w-[320px] flex-[0_1_400px] flex-col gap-4">
        <SidePanel />
        <EngineLines
          fen={fens[linesIndex] ?? fen}
          evaluation={evals[linesIndex]}
          caption={linesCaption}
        />
        {source.kind === 'position' && <AnalysisProgress />}
      </aside>
    </main>
  );
}
