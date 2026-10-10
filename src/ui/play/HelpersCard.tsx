import { useTranslation } from 'react-i18next';
import type { GameViewState } from '../../play/session/types';
import { setEvalBar, usePlay } from '../../store/play';
import { useSettings } from '../../store/settings';
import { Button } from '../shared/Button';
import { Toggle } from '../shared/form';

interface HelpersCardProps {
  view: GameViewState;
  canTakeback: boolean;
}

/** Lern-Hilfen der lokalen Partie: Tipp (bester Zug als Pfeil), Zurücknehmen, Bewertungsbalken. */
export function HelpersCard({ view, canTakeback }: HelpersCardProps) {
  const { t } = useTranslation();
  const hintLoading = usePlay((s) => s.hintLoading);
  const hint = usePlay((s) => s.hint);
  const { requestHint, takeback } = usePlay.getState();
  const evalBar = useSettings((s) => s.play.evalBar);
  const myTurn = view.status === 'playing' && view.turn === view.myColor && !view.waiting;

  return (
    <section
      aria-labelledby="helpers-title"
      className="flex flex-col gap-3 rounded-panel border border-border bg-panel px-4 py-3.5"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="helpers-title" className="text-[14px] font-semibold">
          {t('play.helpers.title')}
        </h2>
        <span className="text-[12.5px] text-muted">
          {t('play.helpers.hintsUsed', { count: view.hintsUsed })}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="ghost"
          className="flex-1"
          disabled={!myTurn || hintLoading || hint?.fen === view.fen}
          onClick={() => void requestHint()}
        >
          {hintLoading ? t('play.helpers.hintLoading') : t('play.helpers.hint')}
        </Button>
        <Button
          variant="ghost"
          className="flex-1"
          disabled={!canTakeback}
          onClick={() => void takeback()}
        >
          {t('play.helpers.takeback')}
        </Button>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13.5px]">{t('play.helpers.evalBar')}</span>
        <Toggle
          checked={evalBar}
          onChange={(on) => void setEvalBar(on)}
          label={t('play.helpers.evalBar')}
        />
      </div>
    </section>
  );
}
