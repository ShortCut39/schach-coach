import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatPgnDate } from '../../chess/pgn';
import { currentLocale } from '../../i18n';
import { useLibrary, type LibraryMeta, type Outcome } from '../../store/library';
import { useNavigation } from '../../store/navigation';
import { colorName } from '../chessText';
import { accuracyColor, formatPercent } from '../format';
import { filterLibrary, type LibraryFilter, type LibrarySort } from '../library/filter';
import { Button } from '../shared/Button';
import { inputClass } from '../shared/form';
import { PageHeader } from '../shared/PageHeader';
import { PatternsView } from '../library/PatternsView';
import { TrainingView } from '../library/TrainingView';
import { Segmented } from '../shared/Segmented';
import { Panel } from '../shared/Panel';
import { PieceColorChip } from '../shared/PieceColorChip';

const OUTCOME_CLASS: Record<Outcome, string> = {
  win: 'bg-win-bg text-win-text',
  loss: 'bg-loss-bg text-loss-text',
  draw: 'bg-accent-bg text-info-text',
  open: 'bg-track text-muted',
};

function TrashIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 7h16" />
      <path d="M9 7V4h6v3" />
      <path d="M6 7l1 13h10l1-13" />
    </svg>
  );
}

export function BibliothekScreen() {
  const { t } = useTranslation();
  const { entries, loaded, refresh, open, remove } = useLibrary();
  const setAnalyseView = useNavigation((s) => s.setAnalyseView);
  const view = useNavigation((s) => s.bibliothekView);
  const setView = useNavigation((s) => s.setBibliothekView);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<LibraryFilter>('all');
  const [sort, setSort] = useState<LibrarySort>('newest');
  const [confirming, setConfirming] = useState<string | null>(null);
  const [openError, setOpenError] = useState(false);
  const searchId = useId();
  const sortId = useId();

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const shown = filterLibrary(entries, query, filter, sort);
  const accuracies = entries.flatMap((e) => (e.accuracy === null ? [] : [e.accuracy]));
  const average = accuracies.length
    ? accuracies.reduce((a, b) => a + b, 0) / accuracies.length
    : undefined;

  async function openEntry(entry: LibraryMeta) {
    const ok = await open(entry.id);
    setOpenError(!ok);
    if (ok) setAnalyseView('board');
  }

  const title = (e: LibraryMeta) =>
    e.white && e.black ? `${e.white} – ${e.black}` : (e.event ?? t('bibliothek.untitled'));

  return (
    <main
      id="main"
      className="mx-auto flex w-full max-w-[1240px] flex-col gap-[18px] px-5 pt-7 pb-10"
    >
      <PageHeader
        title={t('bibliothek.title')}
        subtitle={t('bibliothek.subtitle')}
        aside={
          entries.length > 0 && (
            <div className="flex gap-5 font-mono text-[13px] font-medium text-muted">
              <span>{t('bibliothek.count', { count: entries.length })}</span>
              <span>
                {t('bibliothek.averageAccuracy')}{' '}
                <span className="font-semibold text-text">{formatPercent(average)}</span>
              </span>
            </div>
          )
        }
      />

      <Segmented
        variant="tabs"
        label={t('patterns.tabsLabel')}
        value={view}
        onChange={setView}
        options={[
          { value: 'games', label: t('patterns.tabGames') },
          { value: 'patterns', label: t('patterns.tabPatterns') },
          { value: 'training', label: t('patterns.tabTraining') },
        ]}
      />

      {view === 'patterns' ? (
        <PatternsView />
      ) : view === 'training' ? (
        <TrainingView />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex-[1_1_280px]">
              <label htmlFor={searchId} className="sr-only">
                {t('bibliothek.searchLabel')}
              </label>
              <input
                id={searchId}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('bibliothek.searchPlaceholder')}
                className={`${inputClass} bg-panel`}
              />
            </div>
            <div
              role="group"
              aria-label={t('bibliothek.filterLabel')}
              className="flex flex-wrap gap-1.5"
            >
              {(['all', 'white', 'black', 'losses'] as const).map((id) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={filter === id}
                  onClick={() => setFilter(id)}
                  className={`min-h-hit rounded-full border px-4 text-[13.5px] ${
                    filter === id
                      ? 'border-border-accent bg-accent-bg font-semibold text-accent-text'
                      : 'border-border-chip font-medium text-muted hover:text-text'
                  }`}
                >
                  {t(`bibliothek.filters.${id}`)}
                </button>
              ))}
            </div>
            <div>
              <label htmlFor={sortId} className="sr-only">
                {t('bibliothek.sortLabel')}
              </label>
              <select
                id={sortId}
                value={sort}
                onChange={(e) => setSort(e.target.value as LibrarySort)}
                className={`${inputClass} w-auto bg-panel px-3 font-medium`}
              >
                {(['newest', 'accuracy', 'blunders'] as const).map((id) => (
                  <option key={id} value={id}>
                    {t(`bibliothek.sort.${id}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {openError && (
            <p role="alert" className="text-[13.5px] text-danger">
              {t('bibliothek.openFailed')}
            </p>
          )}

          {loaded && entries.length === 0 ? (
            <Panel className="flex flex-col items-center gap-1 py-10 text-center">
              <h2 className="font-semibold">{t('bibliothek.emptyTitle')}</h2>
              <p className="text-muted">{t('bibliothek.emptyText')}</p>
            </Panel>
          ) : (
            <div className="overflow-x-auto rounded-panel border border-border bg-panel">
              <table className="w-full min-w-[860px] border-collapse text-sm">
                <caption className="sr-only">{t('bibliothek.tableLabel')}</caption>
                <thead>
                  <tr className="border-b border-border font-mono text-[11px] tracking-[0.06em] text-faint uppercase">
                    {(['date', 'game', 'color', 'result'] as const).map((col, i) => (
                      <th
                        key={col}
                        scope="col"
                        className={`py-3 text-left font-semibold ${i === 0 ? 'px-4' : 'px-2'}`}
                      >
                        {t(`bibliothek.columns.${col}`)}
                      </th>
                    ))}
                    <th scope="col" className="w-[180px] px-2 py-3 text-left font-semibold">
                      {t('bibliothek.columns.accuracy')}
                    </th>
                    <th scope="col" className="px-2 py-3 text-left font-semibold">
                      {t('bibliothek.columns.errors')}
                    </th>
                    <th scope="col" className="px-4 py-3">
                      <span className="sr-only">{t('bibliothek.columns.actions')}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((entry) => (
                    <tr key={entry.id} className="border-t border-divider">
                      <td className="px-4 py-3 font-mono text-[13px] font-medium whitespace-nowrap text-muted">
                        {(entry.playedAt
                          ? formatPgnDate(entry.playedAt.replace(/-/g, '.'), currentLocale())
                          : entry.date) ??
                          new Date(entry.savedAt).toLocaleDateString(currentLocale())}
                      </td>
                      <td className="px-2 py-3">
                        <div className="font-semibold">{entry.opening?.name ?? title(entry)}</div>
                        {entry.opening && (
                          <div className="text-[12.5px] text-muted">{title(entry)}</div>
                        )}
                      </td>
                      <td className="px-2 py-3">
                        <span className="inline-flex items-center gap-2">
                          <PieceColorChip color={entry.userColor} />
                          {colorName(t, entry.userColor)}
                        </span>
                      </td>
                      <td className="px-2 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[13px] font-semibold ${OUTCOME_CLASS[entry.outcome]}`}
                        >
                          {t(`bibliothek.outcome.${entry.outcome}`)}
                        </span>
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex items-center gap-2.5">
                          <div aria-hidden="true" className="h-1.5 flex-1 rounded-full bg-track">
                            <div
                              className="h-1.5 rounded-full"
                              style={{
                                width: `${entry.accuracy ?? 0}%`,
                                background: accuracyColor(entry.accuracy ?? undefined),
                              }}
                            />
                          </div>
                          <span className="min-w-[52px] text-right font-mono text-[13px] font-semibold">
                            {formatPercent(entry.accuracy ?? undefined)}
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-3 font-mono text-[13px] font-medium text-body">
                        {entry.mistakes} · {entry.blunders}
                      </td>
                      <td className="px-4 py-2 text-right whitespace-nowrap">
                        {confirming === entry.id ? (
                          <span className="inline-flex items-center gap-2">
                            <span className="text-[13px] text-muted">
                              {t('bibliothek.confirmDelete')}
                            </span>
                            <Button
                              variant="secondary"
                              className="min-h-hit px-3 text-[13px] text-danger"
                              onClick={() => void remove(entry.id).then(() => setConfirming(null))}
                            >
                              {t('bibliothek.confirmYes')}
                            </Button>
                            <Button
                              variant="secondary"
                              className="min-h-hit px-3 text-[13px]"
                              onClick={() => setConfirming(null)}
                            >
                              {t('bibliothek.confirmNo')}
                            </Button>
                          </span>
                        ) : (
                          <>
                            <Button
                              variant="secondary"
                              className="min-h-hit px-4 text-[13.5px]"
                              onClick={() => void openEntry(entry)}
                            >
                              {t('bibliothek.open')}
                            </Button>
                            <button
                              type="button"
                              aria-label={t('bibliothek.delete')}
                              title={t('bibliothek.delete')}
                              onClick={() => setConfirming(entry.id)}
                              className="ml-1 inline-flex size-hit items-center justify-center rounded-control align-middle text-muted hover:text-danger"
                            >
                              <TrashIcon />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                  {shown.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-muted">
                        {t('bibliothek.noMatches')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </main>
  );
}
