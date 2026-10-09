import { useTranslation } from 'react-i18next';
import type { Position } from '../../chess/types';
import { colorName } from '../chessText';

/** Linke Spalte bei einer FEN: keine Zugliste, nur Infos zur Stellung. */
export function PositionInfo({ position }: { position: Position }) {
  const { t } = useTranslation();
  return (
    <section className="flex flex-col gap-2 rounded-panel border border-border bg-panel p-3.5">
      <h2 className="text-sm font-bold">{t('analyse.position.title')}</h2>
      <p className="font-semibold">
        {t('analyse.position.turn', { side: colorName(t, position.turn) })}
      </p>
      <p className="rounded-small bg-bg p-2.5 font-mono text-xs break-all text-body select-all">
        {position.fen}
      </p>
      <p className="text-[13px] text-muted">{t('analyse.position.text')}</p>
    </section>
  );
}
