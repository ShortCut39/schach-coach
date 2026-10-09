import type { Color } from '../../chess/types';

/** Kleines Farbquadrat für Weiß/Schwarz (rein dekorativ, Bedeutung steht daneben als Text). */
export function PieceColorChip({ color }: { color: Color }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block size-3 shrink-0 rounded-[3px] border border-piece-chip-border ${
        color === 'w' ? 'bg-piece-chip-white' : 'bg-piece-chip-black'
      }`}
    />
  );
}
