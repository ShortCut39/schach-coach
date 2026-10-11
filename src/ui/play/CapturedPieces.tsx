import { useTranslation } from 'react-i18next';
import { useAppearance } from '../../appearance/store';
import type { PieceCode } from '../../appearance/types';
import type { CapturedType } from '../../chess/captures';
import type { Color } from '../../chess/types';
import { formatList } from '../format';

interface CapturedPiecesProps {
  /** Geschlagene Figuren (schon sortiert, Bauern zuerst) */
  pieces: readonly CapturedType[];
  /** Farbe der geschlagenen Figuren (die des Gegners) */
  pieceColor: Color;
  /** Materialvorteil dieser Seite in Bauerneinheiten; nur über 0 wird „+N“ gezeigt */
  advantage: number;
}

/**
 * Geschlagene Figuren neben dem Namen, gleiche Figuren überlappend, dazu „+N“ beim Materialvorteil
 * (wie bei Lichess). Nur aus den Zügen gezählt, keine Engine: erlaubt auch in Live-Partien.
 * Die Bilder kommen aus dem gewählten Figurensatz.
 */
export function CapturedPieces({ pieces, pieceColor, advantage }: CapturedPiecesProps) {
  const { t } = useTranslation();
  const urls = useAppearance((s) => s.pieces);
  if (pieces.length === 0 && advantage <= 0) return null;

  const groups: { type: CapturedType; count: number }[] = [];
  for (const type of pieces) {
    const last = groups.at(-1);
    if (last?.type === type) last.count++;
    else groups.push({ type, count: 1 });
  }
  const parts: string[] = [];
  if (groups.length > 0) {
    parts.push(
      t('play.material.captured', {
        pieces: formatList(
          groups.map((g) => t(`play.material.pieces.${g.type}`, { count: g.count })),
        ),
      }),
    );
  }
  if (advantage > 0) parts.push(t('play.material.advantage', { value: advantage }));
  const label = parts.join(', ');

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className="flex shrink-0 items-center gap-1.5"
    >
      {groups.length > 0 && (
        <span className="flex items-center gap-0.5 rounded-small bg-board-light px-1 py-px">
          {groups.map((group) => (
            <span key={group.type} className="flex">
              {Array.from({ length: group.count }, (_, i) => (
                <img
                  key={i}
                  src={urls[`${pieceColor}${group.type.toUpperCase()}` as PieceCode]}
                  alt=""
                  draggable={false}
                  className={`size-[18px] object-contain ${i > 0 ? '-ml-[11px]' : ''}`}
                />
              ))}
            </span>
          ))}
        </span>
      )}
      {advantage > 0 && (
        <span className="font-mono text-[12.5px] font-semibold text-muted">+{advantage}</span>
      )}
    </span>
  );
}
