import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { pgnTimeControl } from '../../play/rules/timeControl';
import type { GameViewState } from '../../play/session/types';
import { usePlay } from '../../store/play';
import { Button } from '../shared/Button';

interface ResultCardProps {
  view: GameViewState;
  /** Zusätzliche Schaltflächen (z. B. „Partie analysieren“) */
  actions?: ReactNode;
  /** Die Partie liegt in der Bibliothek */
  saved?: boolean;
}

/** Nach der Partie: Ergebnis mit Grund, Zugzahl, Bedenkzeit, genutzte Hilfen, „Neue Partie“. */
export function ResultCard({ view, actions, saved = false }: ResultCardProps) {
  const { t } = useTranslation();
  const close = usePlay((s) => s.close);
  const outcome = view.outcome;
  if (!outcome) return null;

  const kind =
    outcome.reason === 'aborted'
      ? 'aborted'
      : outcome.winner === null
        ? 'draw'
        : outcome.winner === view.myColor
          ? 'win'
          : 'loss';
  const tone =
    kind === 'win'
      ? 'bg-win-bg text-win-text'
      : kind === 'loss'
        ? 'bg-loss-bg text-loss-text'
        : 'bg-accent-bg text-accent-text';
  const moves = Math.ceil(view.plies.length / 2);
  const facts: [string, string][] = [
    [t('play.result.moves'), String(moves)],
    [
      t('play.result.timeControl'),
      view.timeControl ? pgnTimeControl(view.timeControl) : t('play.newGame.noClock'),
    ],
  ];
  if (view.mode === 'local') {
    facts.push([t('play.result.hints'), String(view.hintsUsed)]);
    facts.push([t('play.result.takebacks'), String(view.takebacks)]);
  }

  return (
    <section
      aria-labelledby="result-title"
      role="status"
      className="flex flex-col gap-4 rounded-panel border border-border-accent bg-panel px-5 py-4"
    >
      <div className="flex items-center gap-3">
        <span className={`rounded-small px-2.5 py-1 font-mono text-[15px] font-semibold ${tone}`}>
          {outcome.result === '*' ? '–' : outcome.result.replaceAll('1/2', '½')}
        </span>
        <div className="min-w-0">
          <h2 id="result-title" className="text-[17px] font-semibold">
            {t(`play.result.${kind}`)}
          </h2>
          <p className="text-[13px] text-muted">{t(`play.reasons.${outcome.reason}`)}</p>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px]">
        {facts.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-2 border-b border-divider pb-1">
            <dt className="text-muted">{label}</dt>
            <dd className="font-mono font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      {saved && <p className="text-[12.5px] text-muted">{t('play.result.saved')}</p>}
      <div className="flex flex-wrap gap-2">
        {actions}
        <Button
          variant={actions ? 'secondary' : 'primary'}
          className="flex-1 px-5 whitespace-nowrap"
          onClick={close}
        >
          {t('play.result.newGame')}
        </Button>
      </div>
    </section>
  );
}
