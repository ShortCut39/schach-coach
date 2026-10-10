import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatMoveNumber, formatSan } from '../../chess/notation';
import { PHASES } from '../../classification/accuracy';
import {
  buildPatternReport,
  MIN_PATTERN_GAMES,
  TREND_WINDOW,
  type MotifSummary,
  type PatternReport,
} from '../../classification/patterns';
import { useApiKey } from '../../store/apiKey';
import { isLlmConfigured } from '../../store/explanations';
import { useGame } from '../../store/game';
import { useLibrary } from '../../store/library';
import { useNavigation } from '../../store/navigation';
import { toPatternGames, usePatterns } from '../../store/patterns';
import { useSettings } from '../../store/settings';
import { colorName } from '../chessText';
import { accuracyColor, formatPercent } from '../format';
import { Button } from '../shared/Button';
import { CategoryIcon } from '../shared/CategoryIcon';
import { Panel } from '../shared/Panel';

/** Öffnet eine Partie aus der Bibliothek an einem bestimmten Halbzug. */
function useOpenAt() {
  const open = useLibrary((s) => s.open);
  const setAnalyseView = useNavigation((s) => s.setAnalyseView);
  return async (gameId: string, ply?: number) => {
    if (!(await open(gameId))) return;
    if (ply !== undefined) useGame.getState().goTo(ply);
    setAnalyseView('board');
  };
}

function Card({
  title,
  subtitle,
  children,
  className = '',
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`flex flex-col gap-3 rounded-panel border border-border bg-panel px-[18px] py-4 ${className}`}
    >
      <div>
        <h2 className="text-sm font-bold">{title}</h2>
        {subtitle && <p className="text-[13px] text-muted">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function MotifRow({ summary }: { summary: MotifSummary }) {
  const { t } = useTranslation();
  const notation = useSettings((s) => s.notation);
  const openAt = useOpenAt();
  const [expanded, setExpanded] = useState(false);
  const share = new Intl.NumberFormat('de-DE', { style: 'percent' }).format(summary.share);
  return (
    <li className="flex flex-col gap-1.5 border-t border-divider pt-2.5 first:border-t-0 first:pt-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-semibold">{t(`motifs.${summary.motif}.name`)}</span>
        <span className="font-mono text-[12.5px] font-medium text-body">
          {t('patterns.timesShare', { count: summary.count, share })}
        </span>
      </div>
      <div aria-hidden="true" className="h-1.5 rounded-full bg-track">
        <div
          className="h-1.5 rounded-full bg-accent"
          style={{ width: `${summary.share * 100}%` }}
        />
      </div>
      <p className="text-[13px] text-muted">{t(`motifs.${summary.motif}.text`)}</p>
      {summary.examples.length > 0 && (
        <div>
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
            className="min-h-8 rounded-small px-1 text-[12.5px] font-semibold text-accent-text hover:underline"
          >
            {expanded ? t('patterns.hideExamples') : t('patterns.showExamples')}
          </button>
          {expanded && (
            <ul className="mt-1 flex flex-col gap-1">
              {summary.examples.slice(0, 6).map((example) => {
                const move = `${formatMoveNumber(example.moveNumber, example.color)} ${formatSan(example.san, notation)}`;
                return (
                  <li key={`${example.gameId}-${example.ply}`}>
                    <button
                      type="button"
                      aria-label={t('patterns.exampleLabel', { move, game: example.title })}
                      onClick={() => void openAt(example.gameId, example.ply)}
                      className="flex min-h-hit w-full items-center gap-2.5 rounded-control border border-border bg-panel-sub px-3 text-left hover:border-border-input"
                    >
                      <CategoryIcon category={example.category} decorative />
                      <span className="font-semibold">{move}</span>
                      <span className="min-w-0 truncate text-[13px] text-muted">
                        {example.title}
                      </span>
                      <span className="ml-auto font-mono text-[11.5px] text-faint">
                        {t(`phases.${example.phase}`)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

function AccuracyTimeline({ report }: { report: PatternReport }) {
  const { t } = useTranslation();
  const openAt = useOpenAt();
  const points = report.timeline.slice(-30);
  const x = (i: number) => (points.length > 1 ? (i / (points.length - 1)) * 100 : 50);
  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(2)} ${(100 - p.accuracy).toFixed(2)}`)
    .join(' ');
  return (
    <div className="flex flex-col gap-2">
      <div
        className="relative h-[130px] overflow-hidden rounded-small bg-bg"
        role="group"
        aria-label={t('patterns.accuracyChart', { count: points.length })}
      >
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
          className="absolute inset-0 size-full"
        >
          <line
            x1="0"
            y1="50"
            x2="100"
            y2="50"
            stroke="var(--sc-graph-midline)"
            strokeDasharray="4 4"
            vectorEffect="non-scaling-stroke"
          />
          {path && (
            <path
              d={path}
              fill="none"
              stroke="var(--sc-accent)"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
        {points.map((p, i) => (
          <button
            key={p.gameId}
            type="button"
            aria-label={`${p.title}: ${formatPercent(p.accuracy)}`}
            title={`${p.title}: ${formatPercent(p.accuracy)}`}
            onClick={() => void openAt(p.gameId)}
            className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-bg"
            style={{
              left: `${x(i)}%`,
              top: `${Math.min(Math.max(100 - p.accuracy, 6), 94)}%`,
              background: accuracyColor(p.accuracy),
            }}
          />
        ))}
      </div>
      <p className="font-mono text-[12px] text-muted">
        {report.trend.earlier === null
          ? t('patterns.trendRecentOnly', {
              recent: formatPercent(report.trend.recent ?? undefined),
            })
          : t('patterns.trend', {
              window: TREND_WINDOW,
              recent: formatPercent(report.trend.recent ?? undefined),
              earlier: formatPercent(report.trend.earlier),
            })}
      </p>
    </div>
  );
}

function PhaseRows({ report }: { report: PatternReport }) {
  const { t } = useTranslation();
  const number = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });
  return (
    <div className="flex flex-col gap-2.5">
      <div className="font-mono text-[11px] font-semibold tracking-[0.06em] text-faint uppercase">
        {t('patterns.phasesTitle')}
      </div>
      {PHASES.map((phase) => {
        const { accuracy, errorsPer10, moves } = report.phases[phase];
        return (
          <div key={phase}>
            <div className="mb-[3px] flex justify-between gap-2 text-[13px]">
              <span>{t(`phases.${phase}`)}</span>
              <span className="font-mono text-[12.5px] font-medium text-body">
                {moves === 0
                  ? t('patterns.noMoves')
                  : `${formatPercent(accuracy ?? undefined)} · ${t('patterns.errorsPer10', { value: number.format(errorsPer10 ?? 0) })}`}
              </span>
            </div>
            <div aria-hidden="true" className="h-1.5 rounded-full bg-track">
              <div
                className="h-1.5 rounded-full"
                style={{
                  width: `${accuracy ?? 0}%`,
                  background: accuracyColor(accuracy ?? undefined),
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function OpeningsTable({ report }: { report: PatternReport }) {
  const { t } = useTranslation();
  const head = 'pb-1.5 font-mono text-[11px] font-semibold tracking-[0.06em] text-faint uppercase';
  const number = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] border-collapse text-[13px]">
        <caption className="sr-only">{t('patterns.openingsCaption')}</caption>
        <thead>
          <tr>
            <th scope="col" className={`${head} text-left`}>
              {t('patterns.columns.opening')}
            </th>
            <th scope="col" className={`${head} text-left`}>
              {t('patterns.columns.color')}
            </th>
            <th scope="col" className={`${head} text-right`}>
              {t('patterns.columns.games')}
            </th>
            <th scope="col" className={`${head} text-right`}>
              {t('patterns.columns.record')}
            </th>
            <th scope="col" className={`${head} text-right`}>
              {t('patterns.columns.accuracy')}
            </th>
            <th scope="col" className={`${head} text-right`}>
              {t('patterns.columns.theory')}
            </th>
          </tr>
        </thead>
        <tbody>
          {report.openings.slice(0, 10).map((o) => (
            <tr key={o.key} className="border-t border-divider">
              <th scope="row" className="py-1.5 pr-2 text-left font-normal">
                <span className="font-semibold">{o.name}</span>{' '}
                <span className="font-mono text-[11.5px] text-muted">{o.eco}</span>
              </th>
              <td className="py-1.5">{colorName(t, o.color)}</td>
              <td className="py-1.5 text-right font-mono">{o.games}</td>
              <td className="py-1.5 text-right font-mono">
                {o.wins} · {o.draws} · {o.losses}
              </td>
              <td
                className="py-1.5 text-right font-mono"
                style={{ color: accuracyColor(o.accuracy ?? undefined) }}
              >
                {formatPercent(o.accuracy ?? undefined)}
              </td>
              <td className="py-1.5 text-right font-mono">
                {t('patterns.theoryMoves', { value: number.format(o.bookMoves) })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TrainingPlanCard({ report }: { report: PatternReport }) {
  const { t } = useTranslation();
  const plan = usePatterns((s) => s.plan);
  const createPlan = usePatterns((s) => s.createPlan);
  const entries = useLibrary((s) => s.entries);
  const setScreen = useNavigation((s) => s.setScreen);
  useApiKey((s) => s.key);
  useSettings((s) => s.llm);

  let body;
  if (!isLlmConfigured()) {
    body = (
      <div className="flex flex-col items-start gap-3">
        <p className="text-[13.5px] text-body">{t('coach.notConfigured')}</p>
        <Button variant="ghost" onClick={() => setScreen('einstellungen')}>
          {t('coach.setup')}
        </Button>
      </div>
    );
  } else if (plan.status === 'loading') {
    body = (
      <p role="status" className="text-[13.5px] text-muted">
        {t('patterns.planLoading')}
      </p>
    );
  } else if (plan.status === 'done' && plan.plan) {
    body = (
      <div className="flex flex-col gap-3">
        <p className="text-[13.5px] text-body">{plan.plan.einschaetzung}</p>
        <ol className="flex flex-col gap-3">
          {plan.plan.empfehlungen.map((rec, i) => (
            <li key={rec.titel} className="flex gap-3">
              <span
                aria-hidden="true"
                className="flex size-[26px] shrink-0 items-center justify-center rounded-small bg-accent-bg font-mono text-[13px] font-semibold text-accent-text"
              >
                {i + 1}
              </span>
              <div className="flex flex-col gap-1">
                <div className="font-semibold">{rec.titel}</div>
                <div className="text-[13.5px] text-body">{rec.text}</div>
                <div className="text-[13px] text-muted">
                  <span className="font-mono text-[11px] font-semibold tracking-[0.06em] text-faint uppercase">
                    {t('patterns.exercise')}:{' '}
                  </span>
                  {rec.uebung}
                </div>
              </div>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            className="min-h-hit text-sm"
            onClick={() => void createPlan(report, entries)}
          >
            {t('patterns.planRecreate')}
          </Button>
          {plan.gameCount !== undefined && plan.gameCount < report.games && (
            <span className="text-[12.5px] text-muted">{t('patterns.planOutdated')}</span>
          )}
        </div>
      </div>
    );
  } else {
    body = (
      <div className="flex flex-col items-start gap-3">
        <p className="text-[13.5px] text-body">{t('patterns.planIntro')}</p>
        {plan.status === 'failed' && (
          <p role="alert" className="text-[13.5px] text-danger">
            {t('patterns.planFailed')} {plan.error ? t(`llmErrors.${plan.error}`) : ''}
          </p>
        )}
        <Button
          variant="primary"
          className="min-h-hit px-4 text-sm"
          onClick={() => void createPlan(report, entries)}
        >
          {plan.status === 'failed' ? t('coach.retry') : t('patterns.planCreate')}
        </Button>
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-3 rounded-panel border border-border bg-panel px-[18px] py-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold">{t('patterns.planTitle')}</h2>
        {plan.status === 'done' && plan.model && (
          <span className="font-mono text-[11.5px] font-medium text-muted">
            {t('patterns.planSource', { model: plan.model, count: plan.gameCount ?? 0 })}
          </span>
        )}
      </div>
      {body}
    </section>
  );
}

/** Muster über viele Partien: typische Fehler, Genauigkeit über die Zeit, Eröffnungen, Trainingsplan. */
export function PatternsView() {
  const { t } = useTranslation();
  const entries = useLibrary((s) => s.entries);
  const ensureStats = useLibrary((s) => s.ensureStats);
  const loadPlan = usePatterns((s) => s.loadPlan);
  const [migrating, setMigrating] = useState(true);

  useEffect(() => {
    void loadPlan();
  }, [loadPlan]);
  useEffect(() => {
    let cancelled = false;
    void ensureStats().finally(() => {
      if (!cancelled) setMigrating(false);
    });
    return () => {
      cancelled = true;
    };
  }, [ensureStats, entries.length]);

  const games = useMemo(() => toPatternGames(entries), [entries]);
  const report = useMemo(() => buildPatternReport(games), [games]);

  if (games.length < MIN_PATTERN_GAMES) {
    return (
      <Panel className="flex flex-col items-center gap-1 py-10 text-center">
        <h2 className="font-semibold">{t('patterns.tooFewTitle')}</h2>
        <p className="text-muted">
          {migrating
            ? t('patterns.computing')
            : t('patterns.tooFew', { min: MIN_PATTERN_GAMES, count: games.length })}
        </p>
      </Panel>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-muted">{t('patterns.preliminary', { count: report.games })}</p>
      <div className="flex flex-wrap items-start gap-4">
        <Card
          title={t('patterns.motifsTitle')}
          subtitle={t('patterns.motifsSubtitle', { count: report.totalErrors })}
          className="min-w-0 flex-[1_1_480px]"
        >
          {report.motifs.length === 0 ? (
            <p className="text-[13.5px] text-body">{t('patterns.noErrors')}</p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {report.motifs.map((summary) => (
                <MotifRow key={summary.motif} summary={summary} />
              ))}
            </ul>
          )}
        </Card>
        <Card title={t('patterns.accuracyTitle')} className="min-w-0 flex-[1_1_420px]">
          <AccuracyTimeline report={report} />
          <PhaseRows report={report} />
        </Card>
      </div>
      <div className="flex flex-wrap items-start gap-4">
        <Card title={t('patterns.openingsTitle')} className="min-w-0 flex-[1_1_560px]">
          <OpeningsTable report={report} />
        </Card>
        <div className="min-w-0 flex-[1_1_400px]">
          <TrainingPlanCard report={report} />
        </div>
      </div>
    </div>
  );
}
