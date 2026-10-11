import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { validChallengeClock, validUsername } from '../../play/lichess/lobby';
import { speedOf, timeControl } from '../../play/rules/timeControl';
import { usePlay } from '../../store/play';
import { useSettings } from '../../store/settings';
import { Button } from '../shared/Button';
import { FieldLabel } from '../shared/FieldLabel';
import { inputClass } from '../shared/form';

/** Freund per Benutzername herausfordern (hier ist auch Blitz erlaubt). */
export function ChallengeFriend() {
  const { t } = useTranslation();
  const play = useSettings((s) => s.play);
  const challenge = usePlay((s) => s.lichess.challenge);
  const { sendChallenge, cancelChallenge } = usePlay.getState();
  const [username, setUsername] = useState('');
  const inputId = useId();
  const clockOk = validChallengeClock(play.minutes, play.increment);
  const nameOk = validUsername(username);
  const speed = speedOf(timeControl(play.minutes, play.increment));

  return (
    <div className="flex flex-col gap-2.5 border-t border-divider pt-4">
      <h3 className="font-semibold">{t('play.challenge.title')}</h3>
      <p className="text-[13px] text-muted">{t('play.challenge.hint')}</p>
      {challenge?.status === 'waiting' ? (
        <div role="status" className="flex flex-col gap-2">
          <p className="text-[13.5px]">
            {t('play.challenge.waiting', { name: challenge.username })}
          </p>
          <Button variant="secondary" onClick={cancelChallenge}>
            {t('play.challenge.cancel')}
          </Button>
        </div>
      ) : (
        <>
          <div>
            <FieldLabel htmlFor={inputId}>{t('play.challenge.username')}</FieldLabel>
            <div className="flex flex-wrap gap-2">
              <input
                id={inputId}
                value={username}
                autoComplete="off"
                spellCheck={false}
                onChange={(e) => setUsername(e.target.value)}
                className={`${inputClass} min-w-0 flex-1 font-mono text-sm`}
              />
              <Button
                variant="ghost"
                disabled={!nameOk || !clockOk}
                onClick={() =>
                  void sendChallenge(username.trim(), {
                    minutes: play.minutes,
                    increment: play.increment,
                    rated: play.rated,
                    color: play.color,
                  })
                }
              >
                {t('play.challenge.send')}
              </Button>
            </div>
          </div>
          <p className="text-[12.5px] text-muted">
            {clockOk
              ? t('play.challenge.clock', {
                  time: `${play.minutes}+${play.increment}`,
                  speed: t(`play.speed.${speed}`),
                })
              : t('play.challenge.clockInvalid')}
          </p>
          {challenge && (
            <p role="status" className="text-[13px] text-muted">
              {t(`play.challenge.result.${challenge.status}`, { name: challenge.username })}
            </p>
          )}
        </>
      )}
    </div>
  );
}

/** Eingehende Herausforderungen mit „Annehmen“ und „Ablehnen“ */
export function IncomingChallenges() {
  const { t } = useTranslation();
  const incoming = usePlay((s) => s.lichess.incoming);
  const { acceptChallenge, declineChallenge } = usePlay.getState();
  if (incoming.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 rounded-control border border-border-accent bg-accent-bg px-4 py-3">
      <span className="text-[13.5px] font-semibold">{t('play.challenge.incomingTitle')}</span>
      {incoming.map((challenge) => {
        const limit = challenge.timeControl.limit ?? 0;
        const increment = challenge.timeControl.increment ?? 0;
        const minutes = Math.round((limit / 60) * 10) / 10;
        return (
          <div key={challenge.id} className="flex flex-col gap-2">
            <span className="text-[13.5px]">
              {t('play.challenge.incoming', {
                name: challenge.challenger?.name ?? '?',
                rating: challenge.challenger?.rating ?? '–',
                time: `${minutes}+${increment}`,
                kind: challenge.rated
                  ? t('play.lichess.ratedShort')
                  : t('play.lichess.casualShort'),
              })}
            </span>
            <div className="flex gap-2">
              <Button
                variant="primary"
                className="flex-1 px-4"
                onClick={() => void acceptChallenge(challenge.id)}
              >
                {t('play.live.accept')}
              </Button>
              <Button
                variant="secondary"
                className="flex-1 px-4"
                onClick={() => void declineChallenge(challenge.id)}
              >
                {t('play.live.decline')}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
