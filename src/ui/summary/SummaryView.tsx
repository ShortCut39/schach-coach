import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { headerValue } from '../../chess/pgn';
import type { Color, Game } from '../../chess/types';
import { playerAccuracy } from '../../classification/accuracy';
import { countCategories } from '../../classification/stats';
import { turningPoints } from '../../classification/turningPoints';
import { useAnalysis } from '../../store/analysis';
import { useApiKey } from '../../store/apiKey';
import { useEngine } from '../../store/engine';
import { isLlmConfigured, useExplanations, type PlyExplanations } from '../../store/explanations';
import { useGame } from '../../store/game';
import { useLibrary } from '../../store/library';
import { toPatternGames } from '../../store/patterns';
import { buildPatternReport, MIN_PATTERN_GAMES } from '../../classification/patterns';
import { useNavigation } from '../../store/navigation';
import { useSettings } from '../../store/settings';
import i18n from '../../i18n';
import { CategoryTable } from '../analyse/CategoryTable';
import { EvalGraph } from '../analyse/EvalGraph';
import { useCurrentEvals } from '../analyse/useAnalysisFor';
import { useGameAnalysis } from '../analyse/useGameAnalysis';
import { colorName } from '../chessText';
import { Button } from '../shared/Button';
import { Panel } from '../shared/Panel';
import { AccuracyCard } from './AccuracyCard';
import { buildMarkdown, exportFileName } from './markdown';
import { OpeningCard } from './OpeningCard';
import { saveMarkdown } from './saveExport';
import { TipsCard } from './TipsCard';
import { TurningPoints } from './TurningPoints';

const NO_ENTRIES: Record<number, PlyExplanations> = {};

/** Karte „Muster über mehrere Partien“: häufigstes Muster oder wie viele Partien noch fehlen. */
function PatternTeaser() {
  const { t } = useTranslation();
  const entries = useLibrary((s) => s.entries);
  const refresh = useLibrary((s) => s.refresh);
  const setBibliothekView = useNavigation((s) => s.setBibliothekView);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const games = toPatternGames(entries);
  const top = buildPatternReport(games).motifs.find((m) => m.motif !== 'other');
  const enough = games.length >= MIN_PATTERN_GAMES;
  return (
    <section className="flex flex-wrap items-center gap-3 rounded-panel border border-border bg-panel px-[18px] py-3.5">
      <div className="min-w-0 flex-1">
        <div className="font-semibold">{t('summary.patterns')}</div>
        <div className="text-[13px] text-muted">
          {!enough
            ? t('patterns.summaryTooFew', { min: MIN_PATTERN_GAMES, count: games.length })
            : top
              ? t('patterns.summaryTop', { motif: t(`motifs.${top.motif}.name`), count: top.count })
              : t('patterns.noErrors')}
        </div>
      </div>
      {enough && (
        <Button variant="ghost" onClick={() => setBibliothekView('patterns')}>
          {t('patterns.summaryOpen')}
        </Button>
      )}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  const { t } = useTranslation();
  const setView = useNavigation((s) => s.setAnalyseView);
  return (
    <main id="main" className="mx-auto flex w-full max-w-[1800px] flex-col gap-5 px-5 pt-6 pb-10">
      <Panel className="flex max-w-[560px] flex-col items-start gap-2">
        <h1 className="text-lg font-semibold">{t('summary.emptyTitle')}</h1>
        <p className="text-muted">{text}</p>
        <Button
          variant="primary"
          className="mt-1 min-h-hit px-[18px] text-sm"
          onClick={() => setView('board')}
        >
          {t('summary.backToBoard')}
        </Button>
      </Panel>
    </main>
  );
}

export function SummaryView() {
  const { t } = useTranslation();
  const source = useGame((s) => s.source);
  const analysisStatus = useAnalysis((s) => s.status);
  if (!source) return <Empty text={t('summary.emptyGame')} />;
  if (source.kind === 'position') return <Empty text={t('summary.emptyPosition')} />;
  if (analysisStatus !== 'done') return <Empty text={t('summary.waitingEngine')} />;
  return <SummaryContent game={source} />;
}

function SummaryContent({ game }: { game: Game }) {
  const { t } = useTranslation();
  const userColor = useGame((s) => s.userColor);
  const goTo = useGame((s) => s.goTo);
  const setView = useNavigation((s) => s.setAnalyseView);
  const notation = useSettings((s) => s.notation);
  const llm = useSettings((s) => s.llm);
  useApiKey((s) => s.key);
  const engineName = useEngine((s) => s.name);
  const depth = useAnalysis((s) => s.settings.depth);
  const evals = useCurrentEvals();
  const analysis = useGameAnalysis();
  const explanationSource = useExplanations((s) => s.source);
  const allEntries = useExplanations((s) => s.entries);
  const summaryEntry = useExplanations((s) => (s.source === game ? s.summary : null));
  const entries = explanationSource === game ? allEntries : NO_ENTRIES;
  const [exportState, setExportState] = useState<string | null>(null);

  const opponent: Color = userColor === 'w' ? 'b' : 'w';
  const summary = summaryEntry?.status === 'done' ? summaryEntry.data : undefined;
  const points = turningPoints(game, analysis.plies);
  const players = [headerValue(game.headers, 'White'), headerValue(game.headers, 'Black')]
    .filter(Boolean)
    .join(' – ');
  const subtitle = [
    analysis.opening?.name,
    players,
    t('summary.subtitleYou', { color: colorName(t, userColor) }),
  ]
    .filter(Boolean)
    .join(' · ');

  function jump(plyIndex: number) {
    goTo(plyIndex);
    setView('board');
  }

  async function exportMarkdown() {
    const markdown = buildMarkdown(
      {
        game,
        analysis,
        evals,
        userColor,
        notation,
        engine: { name: engineName ?? 'Stockfish', depth },
        explanations: entries,
        summary,
      },
      i18n.t.bind(i18n),
    );
    const result = await saveMarkdown(exportFileName(game, i18n.t.bind(i18n)), markdown);
    if (result.kind === 'saved') setExportState(t('summary.exported', { name: result.name }));
    else if (result.kind === 'failed') setExportState(t('summary.exportFailed'));
  }

  return (
    <main id="main" className="mx-auto flex w-full max-w-[1800px] flex-col gap-5 px-5 pt-6 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-bold tracking-[-0.01em]">{t('summary.title')}</h1>
          <div className="mt-0.5 text-muted">{subtitle}</div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              className="min-h-hit px-[18px] text-sm"
              onClick={() => void exportMarkdown()}
            >
              {t('summary.export')}
            </Button>
            <Button
              variant="primary"
              className="min-h-hit px-[18px] text-sm"
              onClick={() => setView('board')}
            >
              {t('summary.backToBoard')}
            </Button>
          </div>
          {exportState && (
            <span role="status" className="text-[12.5px] text-muted">
              {exportState}
            </span>
          )}
        </div>
      </div>

      <section aria-label={t('summary.accuracyLabel')} className="flex flex-wrap gap-4">
        <AccuracyCard
          title={t('summary.you', { color: colorName(t, userColor) })}
          accuracy={playerAccuracy(game, analysis.plies, userColor)}
        />
        <AccuracyCard
          title={t('summary.opponent', { color: colorName(t, opponent) })}
          accuracy={playerAccuracy(game, analysis.plies, opponent)}
        />
        <section className="flex-[1_1_340px] rounded-panel border border-border bg-panel px-[18px] py-4">
          <h2 className="mb-2 text-sm font-bold">{t('summary.categories')}</h2>
          <CategoryTable
            mine={countCategories(game, analysis.plies, userColor)}
            theirs={countCategories(game, analysis.plies, opponent)}
          />
        </section>
      </section>

      <div className="flex flex-wrap items-start gap-4">
        <TurningPoints
          game={game}
          points={points}
          analyses={analysis.plies}
          evals={evals}
          notation={notation}
          summary={summary}
          explanations={entries}
          onSelect={jump}
        />
        <div className="flex min-w-0 flex-[1_1_520px] flex-col gap-4">
          <TipsCard
            summary={summaryEntry}
            configured={isLlmConfigured()}
            model={llm.model}
            onRequest={() => void useExplanations.getState().explainSummary()}
          />
          <PatternTeaser />
        </div>
      </div>

      <div className="flex flex-wrap items-stretch gap-4">
        <OpeningCard
          game={game}
          opening={analysis.opening}
          notation={notation}
          text={summary?.eroeffnung}
        />
        <div className="min-w-0 flex-[1_1_560px]">
          <EvalGraph
            evals={evals}
            analyses={analysis.plies}
            plyCount={game.plies.length}
            onSelect={jump}
            height={130}
          />
        </div>
      </div>
    </main>
  );
}
