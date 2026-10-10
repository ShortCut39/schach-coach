import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { formatMoveNumber, formatSan } from '../../chess/notation';
import type { PlyBase } from '../../chess/types';
import { useSettings } from '../../store/settings';
import { buildRows } from '../analyse/moveRows';

interface PlayMoveListProps {
  plies: PlyBase[];
}

/**
 * Zugliste der laufenden Partie (nur Anzeige, keine Bewertungen). Scrollt zum letzten Zug und
 * sagt ihn für Screenreader an.
 */
export function PlayMoveList({ plies }: PlayMoveListProps) {
  const { t } = useTranslation();
  const notation = useSettings((s) => s.notation);
  const endRef = useRef<HTMLDivElement>(null);
  const rows = buildRows(plies);
  const last = plies.at(-1);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [plies.length]);

  const cell = (ply: PlyBase | undefined) =>
    ply ? (
      <span
        className={`rounded-[7px] px-1.5 py-1 text-[13px] font-semibold ${
          ply === last
            ? 'bg-move-active-bg text-move-active-text ring-1 ring-move-active-ring ring-inset'
            : 'text-text-body'
        }`}
      >
        {formatSan(ply.san, notation)}
      </span>
    ) : (
      <span />
    );

  return (
    <section
      aria-label={t('play.moves.title')}
      className="flex min-h-[140px] flex-col rounded-panel border border-border bg-panel"
    >
      <h2 className="border-b border-divider px-4 py-2.5 text-[13px] font-semibold text-muted">
        {t('play.moves.title')}
      </h2>
      <div className="max-h-[min(40dvh,360px)] min-h-[96px] overflow-y-auto px-2 py-1.5">
        {rows.length === 0 ? (
          <p className="px-2 py-2 text-[13px] text-faint">{t('play.moves.empty')}</p>
        ) : (
          <ol className="grid grid-cols-[36px_1fr_1fr] items-center gap-x-1 gap-y-0.5">
            {rows.map((row) => (
              <li
                key={`${row.moveNumber}-${row.white?.index ?? row.black?.index}`}
                className="contents"
              >
                <span className="text-right font-mono text-[12px] text-faint">
                  {row.moveNumber}.
                </span>
                {cell(row.white)}
                {cell(row.black)}
              </li>
            ))}
          </ol>
        )}
        <div ref={endRef} />
      </div>
      <p className="sr-only" aria-live="polite">
        {last &&
          t('play.moves.last', {
            move: `${formatMoveNumber(last.moveNumber, last.color)} ${formatSan(last.san, notation)}`,
          })}
      </p>
    </section>
  );
}
