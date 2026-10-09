import { useState } from 'react';
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
import { handleTabKeys } from '../shared/tabKeys';
import { VersionBadge } from '../shared/VersionBadge';
import { AccuracyCard } from './AccuracyCard';
import { buildMarkdown, exportFileName } from './markdown';
import { OpeningCard } from './OpeningCard';
import { saveMarkdown } from './saveExport';
import { TipsCard } from './TipsCard';
import { TurningPoints } from './TurningPoints';

const NO_ENTRIES: Record<number, PlyExplanations> = {};

/** Umschalter „Brett | Zusammenfassung“ (wie im Mockup). */
export function ViewSwitch() {
  const { t } = useTranslation();
  const view = useNavigation((s) => s.analyseView);
  const setView = useNavigation((s) => s.setAnalyseView);
  return (
    <div
      role="tablist"
      aria-label={t('summary.viewLabel')}
      onKeyDown={(event) => handleTabKeys(event, ['board', 'summary'] as const, view, setView)}
      className="inline-flex rounded-control border border-border-chip bg-panel p-[3px]"
    >
      {(['board', 'summary'] as const).map((id) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={view === id}
          tabIndex={view === id ? undefined : -1}
          onClick={() => setView(id)}
          className={`min-h-[38px] rounded-small px-[18px] text-[13.5px] ${
            view === id
              ? 'bg-accent-bg font-semibold text-accent-text'
              : 'font-medium text-muted hover:text-text'
          }`}
        >
          {t(id === 'board' ? 'summary.board' : 'summary.summary')}
        </button>
      ))}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  const { t } = useTranslation();
  return (
    <main id="main" className="flex flex-col gap-5 px-5 pt-6 pb-10">
      <ViewSwitch />
      <Panel className="flex max-w-[560px] flex-col gap-2">
        <h1 className="text-lg font-semibold">{t('summary.emptyTitle')}</h1>
        <p className="text-muted">{text}</p>
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
    <main id="main" className="flex flex-col gap-5 px-5 pt-6 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-3">
            <ViewSwitch />
          </div>
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
          <section
            aria-disabled="true"
            className="flex items-center gap-3 rounded-panel border border-divider bg-panel-sub px-[18px] py-3.5 text-faint"
          >
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-muted">{t('summary.patterns')}</div>
              <div className="text-[13px]">{t('summary.patternsText')}</div>
            </div>
            <VersionBadge version={3} />
          </section>
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
