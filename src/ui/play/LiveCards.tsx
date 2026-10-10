import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameViewState } from '../../play/session/types';
import { usePlay } from '../../store/play';
import { Button } from '../shared/Button';

/** Deutlicher Hinweis während einer Lichess-Partie: Hilfen sind aus, dazu der Verbindungsstatus. */
export function LiveBand({ view }: { view: GameViewState }) {
  const { t } = useTranslation();
  const live = view.live;
  if (!live) return null;
  const connected = live.connection === 'connected';
  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-2 rounded-panel border border-live-border bg-live-bg px-4 py-2.5"
    >
      <span className="text-[13.5px] font-semibold text-live-text">
        {view.status === 'ended' ? t('play.live.ended') : t('play.live.band')}
      </span>
      {view.status !== 'ended' && (
        <span className="flex items-center gap-1.5 text-[12.5px] text-muted">
          <span
            aria-hidden="true"
            className={`size-2 rounded-full ${connected ? 'bg-success' : 'bg-clock-low'}`}
          />
          {t(`play.live.connection.${live.connection}`)}
        </span>
      )}
    </div>
  );
}

/** Remisangebot des Gegners bzw. eigenes offenes Angebot */
export function DrawOfferCard({ view }: { view: GameViewState }) {
  const { t } = useTranslation();
  const respondDraw = usePlay((s) => s.respondDraw);
  if (view.status !== 'playing' || !view.drawOffer) return null;
  if (view.drawOffer === view.myColor) {
    return <p className="px-1 text-[13px] text-muted">{t('play.live.drawOffered')}</p>;
  }
  return (
    <div
      role="alertdialog"
      aria-label={t('play.live.drawOfferTitle')}
      className="flex flex-col gap-3 rounded-panel border border-border-accent bg-accent-bg px-4 py-3"
    >
      <span className="font-semibold">{t('play.live.drawOfferTitle')}</span>
      <div className="flex gap-2">
        <Button variant="primary" className="flex-1 px-4" onClick={() => void respondDraw(true)}>
          {t('play.live.accept')}
        </Button>
        <Button variant="secondary" className="flex-1 px-4" onClick={() => void respondDraw(false)}>
          {t('play.live.decline')}
        </Button>
      </div>
    </div>
  );
}

/** Rücknahmewunsch des Gegners (bietet Lichess selbst an) */
export function TakebackOfferCard({ view }: { view: GameViewState }) {
  const { t } = useTranslation();
  const respondTakeback = usePlay((s) => s.respondTakeback);
  const offer = view.live?.takebackOffer;
  if (view.status !== 'playing' || !offer || offer === view.myColor) return null;
  return (
    <div
      role="alertdialog"
      aria-label={t('play.live.takebackTitle')}
      className="flex flex-col gap-3 rounded-panel border border-border-accent bg-accent-bg px-4 py-3"
    >
      <span className="font-semibold">{t('play.live.takebackTitle')}</span>
      <div className="flex gap-2">
        <Button
          variant="primary"
          className="flex-1 px-4"
          onClick={() => void respondTakeback(true)}
        >
          {t('play.live.accept')}
        </Button>
        <Button
          variant="secondary"
          className="flex-1 px-4"
          onClick={() => void respondTakeback(false)}
        >
          {t('play.live.decline')}
        </Button>
      </div>
    </div>
  );
}

/** Gegner hat die Partie verlassen: Countdown, danach Sieg oder Remis beanspruchen */
export function OpponentGoneCard({ view }: { view: GameViewState }) {
  const { t } = useTranslation();
  const { claimVictory, claimDraw } = usePlay.getState();
  const gone = view.live?.opponentGone;
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    if (!gone) return;
    const timer = setInterval(() => setNow(performance.now()), 500);
    return () => clearInterval(timer);
  }, [gone]);
  if (view.status !== 'playing' || !gone) return null;
  const seconds = gone.claimWinAt === null ? null : Math.ceil((gone.claimWinAt - now) / 1000);
  const canClaim = seconds !== null && seconds <= 0;
  return (
    <div
      role="status"
      className="flex flex-col gap-3 rounded-panel border border-border-accent bg-panel px-4 py-3"
    >
      <span className="font-semibold">{t('play.live.opponentGone')}</span>
      {seconds !== null && !canClaim && (
        <span className="text-[13px] text-muted">
          {t('play.live.claimIn', { seconds: Math.max(0, seconds) })}
        </span>
      )}
      {canClaim && (
        <div className="flex gap-2">
          <Button variant="primary" className="flex-1 px-4" onClick={() => void claimVictory()}>
            {t('play.live.claimVictory')}
          </Button>
          <Button variant="secondary" className="flex-1 px-4" onClick={() => void claimDraw()}>
            {t('play.live.claimDraw')}
          </Button>
        </div>
      )}
    </div>
  );
}
