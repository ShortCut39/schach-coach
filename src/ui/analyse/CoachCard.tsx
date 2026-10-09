import { useTranslation } from 'react-i18next';
import { formatMoveNumber, formatSan } from '../../chess/notation';
import { formatPositionEval } from '../../engine/evalFormat';
import type { Explanation } from '../../llm/schema';
import { useAnalysis } from '../../store/analysis';
import { useApiKey } from '../../store/apiKey';
import {
  isLlmConfigured,
  useExplanations,
  type ExplanationEntry,
  type PlyExplanations,
} from '../../store/explanations';
import { selectCurrentPly, useGame } from '../../store/game';
import { useNavigation } from '../../store/navigation';
import { useSettings } from '../../store/settings';
import { Button } from '../shared/Button';
import { CategoryIcon } from '../shared/CategoryIcon';
import { useCurrentEvals } from './useAnalysisFor';
import { useGameAnalysis } from './useGameAnalysis';

const NO_ENTRIES: Record<number, PlyExplanations> = {};

function ExplanationGrid({
  explanation,
  opponent = false,
}: {
  explanation: Explanation;
  opponent?: boolean;
}) {
  const { t } = useTranslation();
  const label = (key: 'was' | 'warum' | 'aufbauen') =>
    opponent ? t(`coach.opponentLabels.${key}`) : t(`coach.labels.${key}`);
  const rows: [string, string][] = [
    [label('was'), explanation.was],
    [label('warum'), explanation.warum],
    [label('aufbauen'), explanation.aufbauen],
  ];
  if (explanation.merksatz && !opponent)
    rows.push([t('coach.labels.merksatz'), explanation.merksatz]);
  return (
    <dl className="grid grid-cols-[78px_minmax(0,1fr)] gap-x-3 gap-y-2 text-[13.5px]">
      {rows.map(([term, text]) => (
        <div key={term} className="contents">
          <dt className="pt-[3px] font-mono text-[11px] font-semibold tracking-[0.06em] text-faint uppercase">
            {term}
          </dt>
          <dd className="text-body">{text}</dd>
        </div>
      ))}
    </dl>
  );
}

function EntryState({ entry, onRetry }: { entry: ExplanationEntry; onRetry: () => void }) {
  const { t } = useTranslation();
  if (entry.status === 'loading') {
    return (
      <p role="status" className="text-[13.5px] text-muted">
        {t('coach.loading')}
      </p>
    );
  }
  if (entry.status === 'failed') {
    return (
      <div role="alert" className="flex flex-col items-start gap-2 text-[13.5px]">
        <p className="text-danger">
          {t('coach.failed')} {entry.error ? t(`llmErrors.${entry.error}`) : ''}
        </p>
        <Button variant="ghost" onClick={onRetry}>
          {t('coach.retry')}
        </Button>
      </div>
    );
  }
  return null;
}

/** Coach-Tab: Erklärung des aktuellen Zugs (Was / Warum / Aufbauen) mit Vertiefungen. */
export function CoachCard() {
  const { t } = useTranslation();
  const source = useGame((s) => s.source);
  const ply = useGame(selectCurrentPly);
  const notation = useSettings((s) => s.notation);
  const setScreen = useNavigation((s) => s.setScreen);
  const evals = useCurrentEvals();
  const analysisStatus = useAnalysis((s) => s.status);
  const analysis = useGameAnalysis();
  const explanationSource = useExplanations((s) => s.source);
  const allEntries = useExplanations((s) => s.entries);
  const entries = explanationSource === source ? allEntries : NO_ENTRIES;
  const { explainPlies, explainDetail, explainPosition, discardDetail } =
    useExplanations.getState();
  // Neu rendern, wenn Key oder Einstellungen sich ändern (für „eingerichtet?“)
  useApiKey((s) => s.key);
  useSettings((s) => s.llm);
  const configured = isLlmConfigured();

  const setup = (
    <div className="flex flex-col items-start gap-3">
      <p className="text-[13.5px] text-body">{t('coach.notConfigured')}</p>
      <Button variant="ghost" onClick={() => setScreen('einstellungen')}>
        {t('coach.setup')}
      </Button>
    </div>
  );

  // Einzelstellung (FEN)
  if (source?.kind === 'position') {
    const entry = entries[0]?.short;
    return (
      <div className="flex flex-col gap-3">
        <h3 className="text-base font-bold">{t('coach.positionTitle')}</h3>
        {!configured ? (
          setup
        ) : entry?.status === 'done' && entry.explanation ? (
          <ExplanationGrid explanation={entry.explanation} />
        ) : entry ? (
          <EntryState entry={entry} onRetry={() => void explainPosition()} />
        ) : (
          <Button
            variant="primary"
            className="self-start text-sm"
            disabled={!evals[0]}
            onClick={() => void explainPosition()}
          >
            {t('coach.explainPosition')}
          </Button>
        )}
      </div>
    );
  }

  if (!ply) return <p className="text-[13.5px] text-muted">{t('coach.noMove')}</p>;

  const plyAnalysis = analysis.plies[ply.index];
  const move = `${formatMoveNumber(ply.moveNumber, ply.color)} ${formatSan(ply.san, notation)}`;
  const evalText = formatPositionEval(evals[ply.index + 1]);
  const own = entries[ply.index];
  const detailed = own?.detailed;
  const opponent = own?.opponent;
  const shown = detailed?.status === 'done' ? detailed : own?.short;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        {plyAnalysis && <CategoryIcon category={plyAnalysis.category} size={34} decorative />}
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold">{move}</h3>
          {plyAnalysis && (
            <div
              className="text-[12.5px] font-semibold"
              style={{ color: `var(--sc-cat-${plyAnalysis.category})` }}
            >
              {t(`categories.${plyAnalysis.category}`)}
              {plyAnalysis.isSacrifice ? ` · ${t('coach.sacrifice')}` : ''}
            </div>
          )}
        </div>
        {evalText && (
          <span className="rounded-[6px] bg-accent-bg px-2.5 py-[3px] font-mono text-[12.5px] font-semibold text-accent-text">
            {evalText}
          </span>
        )}
      </div>

      {analysis.unnoticed.has(ply.index) && (
        <p className="rounded-small border border-info-border bg-info-bg px-3 py-2 text-[13px] text-info-text">
          {t('coach.unnoticed')}
        </p>
      )}

      {!plyAnalysis ? (
        <p className="text-[13.5px] text-muted">
          {analysisStatus === 'running'
            ? t('coach.waitingForEngine')
            : t('analyse.engine.notAnalysed')}
        </p>
      ) : !configured ? (
        setup
      ) : shown?.status === 'done' && shown.explanation ? (
        <>
          {detailed?.status === 'done' && (
            <div className="font-mono text-[11px] font-semibold tracking-[0.06em] text-accent-text uppercase">
              {t('coach.detailedTitle')}
            </div>
          )}
          <ExplanationGrid explanation={shown.explanation} />
          {detailed && detailed.status !== 'done' && (
            <EntryState
              entry={detailed}
              onRetry={() => void explainDetail(ply.index, 'detailed')}
            />
          )}
          <div className="flex flex-wrap gap-2">
            {detailed?.status === 'done' ? (
              <Button
                variant="secondary"
                className="min-h-hit text-sm"
                onClick={() => discardDetail(ply.index)}
              >
                {t('coach.shortVersion')}
              </Button>
            ) : (
              <Button
                variant="primary"
                className="min-h-hit px-4 text-sm"
                disabled={detailed?.status === 'loading'}
                onClick={() => void explainDetail(ply.index, 'detailed')}
              >
                {t('coach.moreDetail')}
              </Button>
            )}
            <Button
              variant="secondary"
              className="min-h-hit text-sm"
              disabled={opponent?.status === 'loading'}
              onClick={() => void explainDetail(ply.index, 'opponent')}
            >
              {t('coach.opponentView')}
            </Button>
          </div>
          {opponent && (
            <div className="flex flex-col gap-2 border-t border-border pt-3">
              <div className="font-mono text-[11px] font-semibold tracking-[0.06em] text-faint uppercase">
                {t('coach.opponentTitle')}
              </div>
              {opponent.status === 'done' && opponent.explanation ? (
                <ExplanationGrid explanation={opponent.explanation} opponent />
              ) : (
                <EntryState
                  entry={opponent}
                  onRetry={() => void explainDetail(ply.index, 'opponent')}
                />
              )}
            </div>
          )}
          <p className="font-mono text-[11px] text-faint">{t('coach.aiNote')}</p>
        </>
      ) : shown ? (
        <EntryState entry={shown} onRetry={() => void explainPlies([ply.index])} />
      ) : (
        <div className="flex flex-col items-start gap-3">
          <p className="text-[13.5px] text-muted">{t('coach.requestHint')}</p>
          <Button
            variant="primary"
            className="min-h-hit px-4 text-sm"
            onClick={() => void explainPlies([ply.index])}
          >
            {t('coach.request')}
          </Button>
        </div>
      )}
    </div>
  );
}
