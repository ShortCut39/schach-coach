import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { summarizePgn } from '../../chess/pgn';
import { getFetch } from '../../llm/http';
import { fetchRecentGames, OnlineError, type Platform } from '../../online/fetchGames';
import { useSettings } from '../../store/settings';
import { Button } from '../shared/Button';
import { inputClass } from '../shared/form';
import { Segmented } from '../shared/Segmented';
import { IconAlert } from '../shared/icons';

interface OnlineImportProps {
  /** Übergibt den geladenen PGN-Text samt Herkunft */
  onLoaded: (pgn: string, label: string, username: string) => void;
}

/** Letzte Partien per Benutzername von Lichess oder Chess.com. */
export function OnlineImport({ onLoaded }: OnlineImportProps) {
  const { t } = useTranslation();
  const saved = useSettings((s) => s.online);
  const [platform, setPlatform] = useState<Platform>(saved.platform);
  const [username, setUsername] = useState(saved.username);
  const [state, setState] = useState<
    { kind: 'idle' | 'loading' } | { kind: 'error'; message: string }
  >({ kind: 'idle' });
  const inputId = useId();

  async function load() {
    setState({ kind: 'loading' });
    try {
      const pgn = await fetchRecentGames(platform, username, getFetch());
      const count = summarizePgn(pgn).length;
      const settings = useSettings.getState();
      void settings.save({ ...settings, online: { platform, username: username.trim() } });
      setState({ kind: 'idle' });
      onLoaded(
        pgn,
        t('import.sources.loaded', {
          platform: t(`import.sources.${platform}`),
          username: username.trim(),
          count,
        }),
        username.trim(),
      );
    } catch (error) {
      const code = error instanceof OnlineError ? error.code : 'badResponse';
      setState({ kind: 'error', message: t(`import.sources.errors.${code}`) });
    }
  }

  return (
    <section
      aria-label={t('import.sources.label')}
      className="flex flex-col gap-3 rounded-panel border border-border bg-panel px-4 py-3.5"
    >
      <div>
        <h2 className="text-sm font-bold">{t('import.sources.title')}</h2>
        <p className="text-[13px] text-muted">{t('import.sources.text')}</p>
      </div>
      <Segmented
        label={t('import.sources.platformLabel')}
        value={platform}
        onChange={setPlatform}
        options={[
          { value: 'lichess', label: t('import.sources.lichess') },
          { value: 'chesscom', label: t('import.sources.chesscom') },
        ]}
      />
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void load();
        }}
      >
        <label htmlFor={inputId} className="sr-only">
          {t('import.sources.username')}
        </label>
        <input
          id={inputId}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder={t('import.sources.username')}
          autoComplete="off"
          spellCheck={false}
          className={`${inputClass} min-w-0 flex-1 font-mono text-sm`}
        />
        <Button
          type="submit"
          variant="ghost"
          className="min-h-[46px] shrink-0"
          disabled={state.kind === 'loading' || !username.trim()}
        >
          {state.kind === 'loading' ? t('import.sources.loading') : t('import.sources.load')}
        </Button>
      </form>
      {state.kind === 'error' && (
        <p role="alert" className="flex items-center gap-2 text-[13px] font-medium text-danger">
          <IconAlert />
          {state.message}
        </p>
      )}
    </section>
  );
}
