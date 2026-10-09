import { useTranslation } from 'react-i18next';
import { formatMoveNumber, formatSan, type NotationStyle } from '../../chess/notation';
import type { Game } from '../../chess/types';
import type { PlyAnalysis } from '../../classification/types';
import { formatPositionEval } from '../../engine/evalFormat';
import type { PositionEval } from '../../engine/types';
import type { GameSummary } from '../../llm/summary';
import type { PlyExplanations } from '../../store/explanations';
import { CategoryIcon } from '../shared/CategoryIcon';

interface TurningPointsProps {
  game: Game;
  points: number[];
  analyses: (PlyAnalysis | undefined)[];
  evals: readonly (PositionEval | undefined)[];
  notation: NotationStyle;
  summary: GameSummary | undefined;
  explanations: Record<number, PlyExplanations>;
  onSelect: (plyIndex: number) => void;
}

/** Klickbare Wendepunkte; der Text kommt aus der KI-Zusammenfassung oder der Zug-Erklärung. */
export function TurningPoints(props: TurningPointsProps) {
  const { t } = useTranslation();
  return (
    <section className="min-w-0 flex-[1_1_520px] rounded-panel border border-border bg-panel px-[18px] py-4">
      <h2 className="mb-2.5 text-sm font-bold">{t('summary.turningPoints')}</h2>
      {props.points.length === 0 ? (
        <p className="text-[13.5px] text-muted">{t('summary.noTurningPoints')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {props.points.map((index) => {
            const ply = props.game.plies[index];
            const analysis = props.analyses[index];
            if (!ply || !analysis) return null;
            const move = `${formatMoveNumber(ply.moveNumber, ply.color)} ${formatSan(ply.san, props.notation)}`;
            const text =
              props.summary?.wendepunkte.find((w) => w.ply === index)?.text ??
              props.explanations[index]?.short?.explanation?.was;
            return (
              <li key={index}>
                <button
                  type="button"
                  onClick={() => props.onSelect(index)}
                  className="flex w-full items-start gap-3 rounded-control border border-border bg-panel-sub px-3 py-2.5 text-left hover:border-border-input"
                >
                  <CategoryIcon category={analysis.category} size={28} decorative />
                  <span className="min-w-0 flex-1">
                    <span className="font-bold">
                      {move} · {t(`categories.${analysis.category}`)}
                    </span>{' '}
                    <span className="font-mono text-xs font-medium text-muted">
                      {formatPositionEval(props.evals[index + 1])}
                    </span>
                    {text && <span className="block text-[13.5px] text-body">{text}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
