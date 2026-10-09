import { useTranslation } from 'react-i18next';
import { fullMoveCount } from '../../chess/pgn';
import { chessErrorMessage, colorName, resultText } from '../chessText';
import { IconAlert, IconCheck } from '../shared/icons';
import type { ImportEvaluation, InputTab } from './evaluate';

interface ValidationMessageProps {
  id: string;
  evaluation: ImportEvaluation;
  onSwitchTab: (tab: InputTab) => void;
}

/** Live-Rückmeldung unter dem Eingabefeld. Bedeutung steht immer im Text, nicht nur in der Farbe. */
export function ValidationMessage({ id, evaluation, onSwitchTab }: ValidationMessageProps) {
  const { t } = useTranslation();

  let tone: 'neutral' | 'ok' | 'error' = 'neutral';
  let text: string;
  let action: { label: string; tab: InputTab } | undefined;

  switch (evaluation.kind) {
    case 'empty':
      text = t('import.status.empty');
      break;
    case 'wrongTab':
      tone = 'error';
      text =
        evaluation.detected === 'fen'
          ? t('import.status.looksLikeFen')
          : t('import.status.looksLikePgn');
      action =
        evaluation.detected === 'fen'
          ? { label: t('import.status.switchToFen'), tab: 'fen' }
          : { label: t('import.status.switchToPgn'), tab: 'pgn' };
      break;
    case 'fen':
      if (evaluation.result.ok) {
        tone = 'ok';
        text = t('import.status.fenOk', { side: colorName(t, evaluation.result.value.turn) });
      } else {
        tone = 'error';
        text = chessErrorMessage(t, evaluation.result.error);
      }
      break;
    case 'pgn':
      if (evaluation.result.ok) {
        const game = evaluation.result.value;
        tone = 'ok';
        text = t('import.status.pgnOk', {
          moves: t('common.moves', { count: fullMoveCount(game) }),
          plies: t('common.plies', { count: game.plies.length }),
          result: resultText(t, game.result),
        });
        if (evaluation.games.length > 1) {
          text = `${t('import.status.multi', { count: evaluation.games.length })} ${text}`;
        }
      } else {
        tone = 'error';
        text = chessErrorMessage(t, evaluation.result.error);
      }
      break;
  }

  const toneClass = { neutral: 'text-muted', ok: 'text-success', error: 'text-danger' }[tone];

  return (
    <div
      id={id}
      role="status"
      className={`mt-2 flex flex-wrap items-center gap-2 text-[13px] font-medium ${toneClass}`}
    >
      {tone === 'ok' && <IconCheck />}
      {tone === 'error' && <IconAlert />}
      <span>{text}</span>
      {action && (
        <button
          type="button"
          onClick={() => onSwitchTab(action.tab)}
          className="min-h-8 rounded-small px-2 font-semibold text-accent-text underline underline-offset-2 hover:bg-accent-bg"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
