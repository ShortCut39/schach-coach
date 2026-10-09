import { useTranslation } from 'react-i18next';
import { formatMoveNumber, formatSan, type NotationStyle } from '../../chess/notation';
import type { Game } from '../../chess/types';
import type { OpeningInfo } from '../../classification/openingBook';

interface OpeningCardProps {
  game: Game;
  opening: OpeningInfo | undefined;
  notation: NotationStyle;
  /** Satz aus der KI-Zusammenfassung */
  text: string | undefined;
}

/** Eröffnung: Name, ECO, Züge bis zum Ende der Theorie, KI-Satz oder Ersatztext. */
export function OpeningCard({ game, opening, notation, text }: OpeningCardProps) {
  const { t } = useTranslation();
  const theory = opening
    ? game.plies
        .slice(0, opening.bookPlies)
        .map((p) =>
          p.color === 'w' || p.index === 0
            ? `${formatMoveNumber(p.moveNumber, p.color)} ${formatSan(p.san, notation)}`
            : formatSan(p.san, notation),
        )
        .join(' ')
    : '';
  return (
    <section className="flex min-w-[260px] flex-[0_1_360px] flex-col gap-2 rounded-panel border border-border bg-panel px-[18px] py-4">
      <h2 className="text-sm font-bold">{t('summary.opening')}</h2>
      {opening ? (
        <>
          <div className="text-lg font-bold">{opening.name}</div>
          <div className="font-mono text-[12.5px] font-medium text-muted">
            ECO {opening.eco} · {theory}
          </div>
          <p className="text-[13.5px] text-body">
            {text ?? t('summary.openingFallback', { count: opening.bookPlies })}
          </p>
        </>
      ) : (
        <p className="text-[13.5px] text-body">{text ?? t('summary.noOpening')}</p>
      )}
    </section>
  );
}
