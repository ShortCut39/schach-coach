import { useTranslation } from 'react-i18next';
import { uciLineToSan } from '../../chess/line';
import { formatSan } from '../../chess/notation';
import { formatLineEval } from '../../engine/evalFormat';
import type { PositionEval } from '../../engine/types';
import { useAnalysis } from '../../store/analysis';
import { useSettings } from '../../store/settings';

/** Halbzüge einer Variante, die angezeigt werden */
const MAX_LINE_PLIES = 8;

interface EngineLinesProps {
  fen: string;
  evaluation: PositionEval | undefined;
  /** z. B. „vor 16. Db8+“ */
  caption: string;
}

/** Bis zu drei Engine-Linien mit Bewertung (Weiß-Sicht) und Zügen in SAN. */
export function EngineLines({ fen, evaluation, caption }: EngineLinesProps) {
  const { t } = useTranslation();
  const notation = useSettings((s) => s.notation);
  const status = useAnalysis((s) => s.status);

  let body;
  if (evaluation?.terminal) {
    body = (
      <p className="text-[13px] text-muted">
        {evaluation.terminal.kind === 'checkmate'
          ? t('analyse.engine.checkmate')
          : t('analyse.engine.stalemate')}
      </p>
    );
  } else if (evaluation && evaluation.lines.length > 0) {
    body = (
      <ol className="flex flex-col gap-1.5 font-mono text-[13px] font-medium">
        {evaluation.lines.map((line, index) => {
          const san = uciLineToSan(fen, line.pv, MAX_LINE_PLIES).map((m) => formatSan(m, notation));
          const moves = san.join(' ') + (line.pv.length > MAX_LINE_PLIES ? ' …' : '');
          const evalText = formatLineEval(line);
          const best = index === 0;
          return (
            <li
              key={line.multipv}
              aria-label={t('analyse.engine.lineLabel', {
                number: line.multipv,
                eval: evalText,
                moves,
              })}
              className={`grid grid-cols-[52px_minmax(0,1fr)] items-center gap-2 rounded-small px-2.5 py-[7px] ${
                best ? 'bg-button-secondary' : 'bg-panel-sub'
              }`}
            >
              <span className={`font-semibold ${best ? 'text-success' : 'text-muted'}`}>
                {evalText}
              </span>
              <span className={`truncate ${best ? 'text-text' : 'text-line-text'}`}>{moves}</span>
            </li>
          );
        })}
      </ol>
    );
  } else {
    body = (
      <p className="text-[13px] text-muted">
        {status === 'running' ? t('analyse.engine.pending') : t('analyse.engine.notAnalysed')}
      </p>
    );
  }

  return (
    <section
      aria-labelledby="engine-lines-title"
      className="flex flex-col gap-2.5 rounded-panel border border-border bg-panel p-3.5"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="engine-lines-title" className="text-sm font-bold">
          {t('analyse.engine.title')}
        </h2>
        <span className="font-mono text-[11.5px] font-medium text-muted">{caption}</span>
      </div>
      {body}
      {evaluation && evaluation.lines.length > 0 && (
        <p className="font-mono text-[11px] text-faint">
          {t('analyse.engine.depth', { depth: evaluation.lines[0]?.depth ?? evaluation.depth })}
        </p>
      )}
    </section>
  );
}
