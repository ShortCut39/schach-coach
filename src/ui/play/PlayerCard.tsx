import { useTranslation } from 'react-i18next';
import type { Color } from '../../chess/types';
import { formatClock, remainingAt, type ClockSnapshot } from '../../play/clock/clock';
import type { PlayerInfo } from '../../play/session/types';
import { colorName } from '../chessText';
import { PieceColorChip } from '../shared/PieceColorChip';
import { CapturedPieces } from './CapturedPieces';
import { ClockView } from './ClockView';
import type { CapturedType } from '../../chess/captures';

interface PlayerCardProps {
  color: Color;
  player: PlayerInfo;
  isMe: boolean;
  clock: ClockSnapshot | null;
  /** Diese Seite ist am Zug */
  toMove: boolean;
  /** Von dieser Seite geschlagene Figuren des Gegners */
  captured?: readonly CapturedType[];
  /** Materialvorteil dieser Seite (Bauerneinheiten, negativ = Nachteil) */
  advantage?: number;
}

/** Spieler über bzw. unter der Zugliste: Farbe, Name, Titel, geschlagene Figuren, Wertung und Uhr. */
export function PlayerCard({
  color,
  player,
  isMe,
  clock,
  toMove,
  captured = [],
  advantage = 0,
}: PlayerCardProps) {
  const { t } = useTranslation();
  const name = isMe ? t('play.players.you') : player.name || t('play.players.opponent');
  const rating =
    player.rating !== undefined ? `${player.rating}${player.provisional ? '?' : ''}` : undefined;

  return (
    <div
      className={`flex min-h-[60px] items-center justify-between gap-3 rounded-panel border bg-panel px-4 py-2.5 ${
        toMove ? 'border-border-accent' : 'border-border'
      }`}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex min-w-0 items-center gap-2">
          <PieceColorChip color={color} />
          {player.title && (
            <span className="rounded-[5px] bg-accent-bg px-1.5 font-mono text-[11.5px] font-semibold text-accent-text">
              {player.title}
            </span>
          )}
          <span className="min-w-0 truncate font-semibold" title={name}>
            {name}
          </span>
          <CapturedPieces
            pieces={captured}
            pieceColor={color === 'w' ? 'b' : 'w'}
            advantage={advantage}
          />
        </div>
        <div className="flex items-center gap-2 text-[12.5px] text-muted">
          <span>{colorName(t, color)}</span>
          {rating && <span className="font-mono">· {rating}</span>}
          {isMe && player.name && player.name !== name && (
            <span className="min-w-0 truncate">· {player.name}</span>
          )}
        </div>
      </div>
      {clock && (
        <ClockView
          clock={clock}
          color={color}
          label={t('play.clock.label', {
            color: colorName(t, color),
            time: formatClock(remainingAt(clock, color, clock.at)),
          })}
        />
      )}
    </div>
  );
}
