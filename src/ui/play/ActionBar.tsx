import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameViewState } from '../../play/session/types';
import { usePlay } from '../../store/play';
import { Button } from '../shared/Button';
import { IconFlip } from '../shared/icons';

interface ActionBarProps {
  view: GameViewState;
  canAbort: boolean;
  canOfferDraw: boolean;
  /** Lichess: Rücknahme beim Gegner anfragen (keine eigene Hilfe, Lichess fragt den Gegner) */
  canProposeTakeback?: boolean;
}

/** Textknöpfe der Leiste: schmaler Innenabstand, damit drei nebeneinander passen */
const TEXT_BUTTON = 'px-2 text-[13.5px] leading-tight';

/** Aufgeben (mit Rückfrage), Remis anbieten, Abbrechen (nur ganz am Anfang), Brett drehen. */
export function ActionBar({
  view,
  canAbort,
  canOfferDraw,
  canProposeTakeback = false,
}: ActionBarProps) {
  const { t } = useTranslation();
  const { resign, offerDraw, abort, flip, proposeTakeback } = usePlay.getState();
  const [confirmResign, setConfirmResign] = useState(false);
  const playing = view.status === 'playing';

  if (confirmResign && playing) {
    return (
      <div
        role="group"
        aria-label={t('play.actions.resignConfirm')}
        className="flex flex-wrap items-center gap-2.5 rounded-panel border border-loss-text/50 bg-loss-bg px-4 py-3"
      >
        <span className="flex-1 text-[14px] font-semibold text-loss-text">
          {t('play.actions.resignConfirm')}
        </span>
        <Button
          variant="ghost"
          autoFocus
          onClick={() => {
            setConfirmResign(false);
            void resign();
          }}
        >
          {t('play.actions.resignYes')}
        </Button>
        <Button variant="ghost" onClick={() => setConfirmResign(false)}>
          {t('play.actions.keepPlaying')}
        </Button>
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-label={t('play.actions.label')}
      // Feste Spalten: Textknöpfe teilen sich die Breite, „Brett drehen“ bleibt rechts daneben
      className={`grid gap-2 ${view.live ? 'grid-cols-[1fr_1fr_1fr_auto]' : 'grid-cols-[1fr_1fr_auto]'}`}
    >
      {canAbort ? (
        <Button variant="ghost" className={TEXT_BUTTON} onClick={() => void abort()}>
          {t('play.actions.abort')}
        </Button>
      ) : (
        <Button
          variant="ghost"
          className={TEXT_BUTTON}
          disabled={!playing}
          onClick={() => setConfirmResign(true)}
        >
          {t('play.actions.resign')}
        </Button>
      )}
      <Button
        variant="ghost"
        className={TEXT_BUTTON}
        disabled={!canOfferDraw}
        onClick={() => void offerDraw()}
      >
        {t('play.actions.offerDraw')}
      </Button>
      {view.live && (
        <Button
          variant="ghost"
          className={TEXT_BUTTON}
          disabled={!canProposeTakeback}
          onClick={() => void proposeTakeback()}
        >
          {view.live.takebackOffer === view.myColor
            ? t('play.actions.takebackRequested')
            : t('play.actions.proposeTakeback')}
        </Button>
      )}
      <Button
        variant="ghost"
        onClick={flip}
        aria-label={t('play.actions.flip')}
        title={t('play.actions.flip')}
        className="flex items-center justify-center px-3"
      >
        <IconFlip />
      </Button>
    </div>
  );
}
