import { useTranslation } from 'react-i18next';
import { positionWhiteWinChance } from '../../classification/winChance';
import { formatPositionEval } from '../../engine/evalFormat';
import type { PositionEval } from '../../engine/types';
import type { Orientation } from '../../store/game';

interface EvalBarProps {
  evaluation: PositionEval | undefined;
  orientation: Orientation;
}

/**
 * Vertikaler Bewertungsbalken neben dem Brett. Höhe des hellen Teils = Gewinnchance von Weiß.
 * Der helle Teil liegt auf der Seite, auf der Weiß auf dem Brett steht.
 */
export function EvalBar({ evaluation, orientation }: EvalBarProps) {
  const { t } = useTranslation();
  const win = positionWhiteWinChance(evaluation);
  const share = win ?? 50;
  const text = formatPositionEval(evaluation);
  const whiteAtBottom = orientation === 'white';
  const whiteAhead = share >= 50;
  // Beschriftung am Ende der Seite, die vorne liegt
  const labelAtBottom = whiteAhead === whiteAtBottom;

  return (
    <div
      role="img"
      aria-label={t('analyse.evalBar.label', { eval: text ?? t('analyse.evalBar.unknown') })}
      className="relative flex-[0_0_22px] overflow-hidden rounded-[6px] bg-eval-black"
    >
      <div
        className={`absolute inset-x-0 bg-eval-white transition-[height] duration-300 ${
          whiteAtBottom ? 'bottom-0' : 'top-0'
        } ${win === undefined ? 'opacity-30' : ''}`}
        style={{ height: `${share}%` }}
      />
      {text && (
        <div
          className={`absolute inset-x-0 text-center font-mono text-[10.5px] font-semibold ${
            labelAtBottom ? 'bottom-1.5' : 'top-1.5'
          } ${whiteAhead ? 'text-eval-on-white' : 'text-eval-on-black'}`}
        >
          {text.replace(/^\+/, '')}
        </div>
      )}
    </div>
  );
}
