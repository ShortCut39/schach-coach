import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { headerValue, type GameSummary } from '../../chess/pgn';
import { resultText } from '../chessText';

interface GameListProps {
  games: GameSummary[];
  selected: number;
  onSelect: (index: number) => void;
}

/** Auswahlliste, wenn ein Text oder eine Datei mehrere Partien enthält. */
export function GameList({ games, selected, onSelect }: GameListProps) {
  const { t } = useTranslation();
  const name = useId();
  const titleId = useId();

  return (
    <section
      aria-labelledby={titleId}
      className="rounded-panel border border-border bg-panel px-4 py-3.5"
    >
      <div className="mb-2 flex items-baseline justify-between">
        <h2 id={titleId} className="text-sm font-bold">
          {t('import.games.title')}
        </h2>
        <span className="font-mono text-[11.5px] font-medium text-muted">
          {t('import.games.count', { count: games.length })}
        </span>
      </div>
      <div
        role="radiogroup"
        aria-label={t('import.games.select')}
        className="flex max-h-[360px] flex-col gap-1.5 overflow-y-auto"
      >
        {games.map((game) => {
          const active = game.index === selected;
          const white = headerValue(game.headers, 'White');
          const black = headerValue(game.headers, 'Black');
          const title =
            white && black
              ? `${white} – ${black}`
              : (headerValue(game.headers, 'Event') ??
                t('import.games.untitled', { number: game.index + 1 }));
          const site = headerValue(game.headers, 'Site');
          const year = headerValue(game.headers, 'Date')?.slice(0, 4).replace(/\?/g, '');
          const place = [site, year].filter(Boolean).join(' ') || t('import.games.noSite');
          return (
            <label
              key={game.index}
              className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-control border px-3 py-1.5 ${
                active ? 'border-border-accent bg-accent-bg' : 'border-border bg-panel-sub'
              }`}
            >
              <input
                type="radio"
                name={name}
                checked={active}
                onChange={() => onSelect(game.index)}
                className="size-[18px] shrink-0 accent-accent"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{title}</span>
                <span className="block text-[12.5px] text-muted">
                  {t('import.games.meta', {
                    place,
                    moves: t('common.moves', { count: Math.ceil(game.plyCount / 2) }),
                    result: resultText(t, game.result),
                  })}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </section>
  );
}
