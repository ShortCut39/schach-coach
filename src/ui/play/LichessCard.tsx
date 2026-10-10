import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { browserLoginAvailable, openLichessPage } from '../../play/lichess/bridge';
import { ratingOf } from '../../play/lichess/client';
import { PERSONAL_TOKEN_URL } from '../../play/lichess/oauth';
import { useLichessAuth } from '../../store/lichessAuth';
import { Button } from '../shared/Button';
import { inputClass } from '../shared/form';
import { FieldLabel } from '../shared/FieldLabel';

/**
 * Inhalt der Einstellungskarte „Lichess“: Status, Anmelden per Browser (OAuth), Rückfall mit
 * persönlichem Token, Abmelden. Änderungen gelten sofort (nicht erst mit „Speichern“).
 */
export function LichessCard() {
  const { t } = useTranslation();
  const { status, account, error, revokeFailed } = useLichessAuth();
  const { load, loginWithBrowser, cancelLogin, loginWithToken, logout } = useLichessAuth.getState();
  const [tokenDraft, setTokenDraft] = useState('');
  const tokenId = useId();
  const canBrowserLogin = browserLoginAvailable();
  const busy = status === 'checking' || status === 'waitingForBrowser';

  useEffect(() => {
    if (useLichessAuth.getState().status === 'unknown') void load();
  }, [load]);

  const rapid = account ? ratingOf(account, 'rapid') : undefined;

  return (
    <div className="flex flex-col gap-4">
      <div
        role="status"
        className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-control border border-border-chip bg-panel-sub px-4 py-3"
      >
        {status === 'loggedIn' && account ? (
          <>
            <span className="size-2 rounded-full bg-success" aria-hidden="true" />
            <span>
              {t('lichess.loggedInAs')}{' '}
              <strong>
                {account.title ? `${account.title} ` : ''}
                {account.username}
              </strong>
            </span>
            <span className="font-mono text-[13px] text-muted">
              {t('lichess.rapid', { rating: rapid ?? '–' })}
            </span>
          </>
        ) : (
          <>
            <span className="size-2 rounded-full bg-track" aria-hidden="true" />
            <span className="text-muted">
              {status === 'checking'
                ? t('lichess.checking')
                : status === 'waitingForBrowser'
                  ? t('lichess.waitingForBrowser')
                  : t('lichess.loggedOut')}
            </span>
          </>
        )}
      </div>

      {error && (
        <p role="alert" className="text-[13px] text-danger">
          {t(`lichess.errors.${error}`)}
        </p>
      )}
      {revokeFailed && <p className="text-[13px] text-muted">{t('lichess.revokeFailed')}</p>}

      {status === 'loggedIn' ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => void logout()}>
            {t('lichess.logout')}
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {status === 'waitingForBrowser' ? (
              <Button variant="ghost" onClick={cancelLogin}>
                {t('lichess.cancelLogin')}
              </Button>
            ) : (
              <Button
                variant="primary"
                disabled={!canBrowserLogin || busy}
                onClick={() => void loginWithBrowser()}
              >
                {t('lichess.login')}
              </Button>
            )}
            {!canBrowserLogin && (
              <span className="text-[13px] text-muted">{t('lichess.desktopOnly')}</span>
            )}
          </div>
          <p className="text-[13px] text-muted">{t('lichess.loginHint')}</p>

          <details className="rounded-control border border-border-chip px-4 py-3">
            <summary className="cursor-pointer font-semibold">{t('lichess.tokenTitle')}</summary>
            <div className="mt-3 flex flex-col gap-3">
              <ol className="list-decimal pl-5 text-[13.5px] text-text-body">
                <li>
                  {t('lichess.tokenStep1')}{' '}
                  <button
                    type="button"
                    className="font-semibold text-accent-text underline"
                    onClick={() => void openLichessPage(PERSONAL_TOKEN_URL).catch(() => undefined)}
                  >
                    {t('lichess.tokenOpen')}
                  </button>
                </li>
                <li>{t('lichess.tokenStep2')}</li>
                <li>{t('lichess.tokenStep3')}</li>
              </ol>
              <div>
                <FieldLabel htmlFor={tokenId}>{t('lichess.tokenLabel')}</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  <input
                    id={tokenId}
                    type="password"
                    autoComplete="off"
                    spellCheck={false}
                    value={tokenDraft}
                    onChange={(e) => setTokenDraft(e.target.value)}
                    className={`${inputClass} min-w-0 flex-1 font-mono text-sm`}
                  />
                  <Button
                    variant="ghost"
                    disabled={busy || tokenDraft.trim() === ''}
                    onClick={() =>
                      void loginWithToken(tokenDraft).then((ok) => ok && setTokenDraft(''))
                    }
                  >
                    {t('lichess.tokenSave')}
                  </Button>
                </div>
              </div>
            </div>
          </details>
        </>
      )}
      <p className="text-[12.5px] text-muted">{t('lichess.privacy')}</p>
    </div>
  );
}
