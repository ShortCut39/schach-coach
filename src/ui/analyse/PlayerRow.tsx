import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { Color } from '../../chess/types';
import { colorName } from '../chessText';
import { PieceColorChip } from '../shared/PieceColorChip';

interface PlayerRowProps {
  color: Color;
  isUser: boolean;
  name?: string | undefined;
  aside?: ReactNode;
}

/** Zeile über bzw. unter dem Brett: Du/Gegner, Farbe, Name aus der PGN. */
export function PlayerRow({ color, isUser, name, aside }: PlayerRowProps) {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-hit items-center justify-between gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <PieceColorChip color={color} />
        <span className="font-semibold">
          {isUser ? t('analyse.players.you') : t('analyse.players.opponent')}
        </span>
        <span className="text-muted">{colorName(t, color)}</span>
        {name && (
          <span className="min-w-0 truncate text-faint" title={name}>
            · {name}
          </span>
        )}
      </div>
      {aside && <div className="shrink-0">{aside}</div>}
    </div>
  );
}
