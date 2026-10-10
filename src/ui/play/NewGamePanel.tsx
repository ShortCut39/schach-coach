import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { LEVELS, type Level } from '../../play/opponent/levels';
import { ratingOf } from '../../play/lichess/client';
import {
  allowedForLichessSeek,
  speedOf,
  TIME_PRESETS,
  timeControl,
} from '../../play/rules/timeControl';
import { useLichessAuth } from '../../store/lichessAuth';
import { useNavigation } from '../../store/navigation';
import { usePlay } from '../../store/play';
import { pickSettings, useSettings, type Settings } from '../../store/settings';
import { Button } from '../shared/Button';
import { FieldLabel } from '../shared/FieldLabel';
import { Segmented } from '../shared/Segmented';
import { inputClass, Toggle } from '../shared/form';

type PlaySettings = Settings['play'];

/** Zeit-Chip: Voreinstellung, eigene Zeit oder ohne Uhr */
function TimeChip({
  active,
  label,
  sub,
  onClick,
}: {
  active: boolean;
  label: string;
  sub?: string | undefined;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex min-h-[54px] min-w-[84px] flex-col items-center justify-center rounded-control border px-3 transition-colors ${
        active
          ? 'border-accent bg-accent-bg text-accent-text'
          : 'border-border-input text-text hover:border-border-accent'
      }`}
    >
      <span className="font-mono text-[15px] font-semibold">{label}</span>
      {sub && <span className="text-[11.5px] text-muted">{sub}</span>}
    </button>
  );
}

/** Rechte Spalte vor der Partie: Gegner, Bedenkzeit, Farbe, Stärke bzw. Wertung, Start/Suche. */
export function NewGamePanel() {
  const { t } = useTranslation();
  const play = useSettings((s) => s.play);
  const startLocal = usePlay((s) => s.startLocal);
  const lichessMode = play.mode === 'lichess';
  const noClock = play.noClock && !lichessMode;
  const minutesId = useId();
  const incrementId = useId();
  const levelId = useId();

  const update = updatePlay;

  const isPreset = (minutes: number, increment: number) =>
    !noClock && play.minutes === minutes && play.increment === increment;
  const custom = !noClock && !TIME_PRESETS.some((p) => isPreset(p.minutes, p.increment));
  const speed = speedOf(timeControl(play.minutes, play.increment));

  function start() {
    startLocal({
      color: play.color,
      level: play.level,
      minutes: noClock ? null : play.minutes,
      increment: play.increment,
      playerName: t('play.players.you'),
      opponentName: t('play.players.stockfish', { level: t(`play.levels.${play.level}`) }),
      event: t('play.pgn.localEvent'),
      site: t('play.pgn.localSite'),
    });
  }

  const modeOptions = [
    { value: 'local', label: t('play.newGame.modes.local') },
    { value: 'lichess', label: t('play.newGame.modes.lichess') },
  ] as const;
  const colorOptions = [
    { value: 'w', label: t('common.white') },
    { value: 'random', label: t('play.newGame.randomColor') },
    { value: 'b', label: t('common.black') },
  ] as const;

  return (
    <section
      aria-labelledby="new-game-title"
      className="flex flex-col gap-5 rounded-panel border border-border bg-panel px-5 pt-[18px] pb-5"
    >
      <div>
        <h2 id="new-game-title" className="text-[17px] font-semibold">
          {t('play.newGame.title')}
        </h2>
        <p className="mt-1 text-[13px] text-muted">
          {lichessMode ? t('play.newGame.subtitleLichess') : t('play.newGame.subtitle')}
        </p>
      </div>

      <Segmented
        label={t('play.newGame.opponent')}
        options={modeOptions}
        value={play.mode}
        onChange={(mode) => update({ mode })}
      />

      <OngoingGames />

      <div className="flex flex-col gap-2.5">
        <FieldLabel>{t('play.newGame.time')}</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {TIME_PRESETS.map((preset) => (
            <TimeChip
              key={`${preset.minutes}+${preset.increment}`}
              active={isPreset(preset.minutes, preset.increment)}
              label={`${preset.minutes}+${preset.increment}`}
              sub={t(`play.speed.${speedOf(timeControl(preset.minutes, preset.increment))}`)}
              onClick={() =>
                update({ minutes: preset.minutes, increment: preset.increment, noClock: false })
              }
            />
          ))}
          <TimeChip
            active={custom}
            label={t('play.newGame.custom')}
            sub={custom ? `${play.minutes}+${play.increment}` : undefined}
            onClick={() => update({ noClock: false, increment: custom ? play.increment : 3 })}
          />
          {!lichessMode && (
            <TimeChip
              active={play.noClock}
              label={t('play.newGame.noClock')}
              onClick={() => update({ noClock: true })}
            />
          )}
        </div>
        {custom && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel htmlFor={minutesId}>{t('play.newGame.minutes')}</FieldLabel>
              <input
                id={minutesId}
                type="number"
                min={1}
                max={180}
                value={play.minutes}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  if (value >= 1 && value <= 180) update({ minutes: value });
                }}
                className={`${inputClass} font-mono`}
              />
            </div>
            <div>
              <FieldLabel htmlFor={incrementId}>{t('play.newGame.increment')}</FieldLabel>
              <input
                id={incrementId}
                type="number"
                min={0}
                max={180}
                value={play.increment}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  if (Number.isInteger(value) && value >= 0 && value <= 180)
                    update({ increment: value });
                }}
                className={`${inputClass} font-mono`}
              />
            </div>
          </div>
        )}
        {!noClock && (
          <p className="text-[12.5px] text-muted">
            {t('play.newGame.speedInfo', {
              time: `${play.minutes}+${play.increment}`,
              speed: t(`play.speed.${speed}`),
            })}
          </p>
        )}
      </div>

      <div className="flex flex-col">
        <FieldLabel>{t('play.newGame.color')}</FieldLabel>
        <Segmented
          label={t('play.newGame.color')}
          options={colorOptions}
          value={play.color}
          onChange={(color) => update({ color })}
        />
      </div>

      {lichessMode ? (
        <LichessSeek />
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <FieldLabel htmlFor={levelId}>{t('play.newGame.level')}</FieldLabel>
            <select
              id={levelId}
              value={play.level}
              onChange={(e) => update({ level: e.target.value as Level })}
              className={`${inputClass} px-3 font-medium`}
            >
              {LEVELS.map((level) => (
                <option key={level} value={level}>
                  {t(`play.levels.${level}`)} – {t(`play.levelHints.${level}`)}
                </option>
              ))}
            </select>
            <p className="text-[12.5px] text-muted">{t('play.newGame.levelNote')}</p>
          </div>

          <p className="rounded-control border border-info-border bg-info-bg px-3.5 py-2.5 text-[13px] text-info-text">
            {t('play.newGame.helpersInfo')}
          </p>

          <Button variant="primary" onClick={start}>
            {t('play.newGame.start')}
          </Button>
        </>
      )}
    </section>
  );
}

function updatePlay(patch: Partial<PlaySettings>) {
  const settings = pickSettings(useSettings.getState());
  void useSettings.getState().save({ ...settings, play: { ...settings.play, ...patch } });
}

/** Laufende Lichess-Partien (z. B. nach einem Neustart der App) zum Fortsetzen */
function OngoingGames() {
  const { t } = useTranslation();
  const ongoing = usePlay((s) => s.lichess.ongoing);
  const resume = usePlay((s) => s.resumeLichess);
  if (ongoing.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 rounded-control border border-live-border bg-live-bg px-4 py-3">
      <span className="text-[13.5px] font-semibold text-live-text">
        {t('play.lichess.ongoing')}
      </span>
      {ongoing.map((game) => (
        <div key={game.gameId} className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[13.5px]">
            {t('play.lichess.ongoingGame', {
              opponent: game.opponent.username,
              speed: t(`play.speed.${speedKey(game.speed)}`),
            })}
          </span>
          <Button variant="ghost" onClick={() => resume(game.gameId)}>
            {t('play.lichess.resume')}
          </Button>
        </div>
      ))}
    </div>
  );
}

const SPEEDS = ['ultraBullet', 'bullet', 'blitz', 'rapid', 'classical'] as const;
function speedKey(speed: string): (typeof SPEEDS)[number] {
  return (SPEEDS as readonly string[]).includes(speed)
    ? (speed as (typeof SPEEDS)[number])
    : 'rapid';
}

/** Lichess-Teil: Anmeldung, Fair-Play-Hinweis, gewertet, Suche starten bzw. abbrechen */
function LichessSeek() {
  const { t } = useTranslation();
  const play = useSettings((s) => s.play);
  const auth = useLichessAuth((s) => s.status);
  const account = useLichessAuth((s) => s.account);
  const { seeking, error } = usePlay((s) => s.lichess);
  const { startSeek, cancelSeek } = usePlay.getState();
  const setScreen = useNavigation((s) => s.setScreen);
  const control = timeControl(play.minutes, play.increment);
  const allowed = allowedForLichessSeek(control);

  if (auth !== 'loggedIn' || !account) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-[13.5px] text-muted">{t('play.lichess.loginFirst')}</p>
        <Button variant="primary" onClick={() => setScreen('einstellungen')}>
          {t('play.lichess.toSettings')}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-muted">
        {t('play.lichess.account', {
          name: account.username,
          rating: ratingOf(account, 'rapid') ?? '–',
        })}
      </p>
      {!allowed && (
        <p role="alert" className="text-[13px] text-danger">
          {t('play.lichess.tooFast')}
        </p>
      )}
      <div className="flex min-h-hit items-center gap-3">
        <div className="flex-1">
          <div className="font-semibold">{t('play.lichess.rated')}</div>
          <div className="text-[13px] text-muted">{t('play.lichess.ratedHint')}</div>
        </div>
        <Toggle
          checked={play.rated}
          onChange={(rated) => updatePlay({ rated })}
          label={t('play.lichess.rated')}
        />
      </div>

      <div className="rounded-control border border-live-border bg-live-bg px-3.5 py-3 text-[13px] text-text-body">
        <strong className="text-live-text">{t('play.lichess.fairPlayTitle')}</strong>{' '}
        {t('play.lichess.fairPlay')}
        {!play.lichessNoticeSeen && (
          <div className="mt-2">
            <Button variant="ghost" onClick={() => updatePlay({ lichessNoticeSeen: true })}>
              {t('play.lichess.understood')}
            </Button>
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="text-[13px] text-danger">
          {t(`lichess.errors.${error.code}`)}
          {error.detail ? ` (${error.detail})` : ''}
        </p>
      )}

      {seeking ? (
        <div className="flex flex-col gap-2" role="status">
          <p className="text-[13.5px]">
            {t('play.lichess.seeking', {
              time: `${seeking.minutes}+${seeking.increment}`,
              kind: seeking.rated ? t('play.lichess.ratedShort') : t('play.lichess.casualShort'),
            })}
          </p>
          <Button variant="secondary" onClick={cancelSeek}>
            {t('play.lichess.cancelSeek')}
          </Button>
        </div>
      ) : (
        <Button
          variant="primary"
          disabled={!allowed || !play.lichessNoticeSeen}
          onClick={() =>
            void startSeek({
              minutes: play.minutes,
              increment: play.increment,
              rated: play.rated,
              color: play.color,
            })
          }
        >
          {t('play.lichess.seek')}
        </Button>
      )}
    </div>
  );
}
