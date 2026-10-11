import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CustomSetError, deleteSet, renameSet } from '../../appearance/customSets';
import type { CustomSet } from '../../appearance/store';

const smallButton =
  'min-h-8 rounded-small px-2 text-[12.5px] font-semibold text-muted hover:bg-panel-sub hover:text-text';

/** Umbenennen und Löschen (mit Rückfrage) eines eigenen Satzes, direkt unter der Kachel. */
export function CustomSetActions({ set, displayName }: { set: CustomSet; displayName: string }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'idle' | 'rename' | 'delete'>('idle');
  const [name, setName] = useState(set.name);
  const [error, setError] = useState(false);
  const inputId = useId();

  async function run(action: () => Promise<void>) {
    setError(false);
    try {
      await action();
      setMode('idle');
    } catch (e) {
      if (e instanceof CustomSetError) setError(true);
      else throw e;
    }
  }

  if (mode === 'rename') {
    return (
      <form
        className="flex flex-col gap-1.5"
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim()) void run(() => renameSet(set.kind, set.id, name.trim()));
        }}
      >
        <label htmlFor={inputId} className="sr-only">
          {t('appearance.name')}
        </label>
        <input
          id={inputId}
          autoFocus
          maxLength={60}
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation();
              setMode('idle');
            }
          }}
          className="min-h-8 rounded-control border border-border-input bg-panel px-2 text-[13px]"
        />
        <div className="flex gap-1">
          <button type="submit" className={smallButton} disabled={!name.trim()}>
            {t('appearance.save')}
          </button>
          <button type="button" className={smallButton} onClick={() => setMode('idle')}>
            {t('appearance.cancel')}
          </button>
        </div>
        {error && (
          <span className="text-[12px] text-danger">{t('appearance.saveErrors.failed')}</span>
        )}
      </form>
    );
  }

  if (mode === 'delete') {
    return (
      <div
        role="group"
        aria-label={t('appearance.confirmDelete', { name: displayName })}
        className="flex flex-col gap-1"
      >
        <span className="text-[12.5px]">
          {t('appearance.confirmDelete', { name: displayName })}
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            autoFocus
            className={`${smallButton} text-danger hover:text-danger`}
            onClick={() => void run(() => deleteSet(set.kind, set.id))}
          >
            {t('appearance.deleteYes')}
          </button>
          <button type="button" className={smallButton} onClick={() => setMode('idle')}>
            {t('appearance.cancel')}
          </button>
        </div>
        {error && (
          <span className="text-[12px] text-danger">{t('appearance.saveErrors.failed')}</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      <button
        type="button"
        className={smallButton}
        aria-label={t('appearance.renameNamed', { name: displayName })}
        onClick={() => {
          setName(set.name || displayName);
          setMode('rename');
        }}
      >
        {t('appearance.rename')}
      </button>
      <button
        type="button"
        className={smallButton}
        aria-label={t('appearance.deleteNamed', { name: displayName })}
        onClick={() => setMode('delete')}
      >
        {t('appearance.delete')}
      </button>
    </div>
  );
}
