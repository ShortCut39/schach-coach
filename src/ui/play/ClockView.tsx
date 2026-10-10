import { useEffect, useState } from 'react';
import type { Color } from '../../chess/types';
import { formatClock, LOW_TIME_MS, remainingAt, type ClockSnapshot } from '../../play/clock/clock';
import { currentLocale } from '../../i18n';

/** Dezimaltrennzeichen der eingestellten Sprache (Komma im Deutschen) */
function decimalSeparator(): string {
  return (
    new Intl.NumberFormat(currentLocale()).formatToParts(1.5).find((p) => p.type === 'decimal')
      ?.value ?? '.'
  );
}

/** Aktuelle Zeit, solange `active`; sonst fest. Aktualisiert zehnmal pro Sekunde. */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(performance.now()), 100);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

interface ClockViewProps {
  clock: ClockSnapshot;
  color: Color;
  label: string;
}

/**
 * Restzeit einer Seite. Läuft ihre Uhr, ist sie hervorgehoben; unter 10 s in Warnfarbe.
 * Die laufende Anzeige ist für Screenreader stumm (sonst würde sie zehnmal pro Sekunde vorgelesen).
 */
export function ClockView({ clock, color, label }: ClockViewProps) {
  const running = clock.running === color;
  const now = useNow(running);
  const ms = remainingAt(clock, color, now);
  const low = ms < LOW_TIME_MS;
  const text = formatClock(ms, decimalSeparator());

  return (
    <div
      role="timer"
      aria-label={label}
      aria-live="off"
      className={`min-w-[112px] rounded-control border px-3 py-1.5 text-right font-mono text-[26px] leading-none font-semibold tabular-nums ${
        running
          ? low
            ? 'border-clock-low bg-clock-low-bg text-clock-low'
            : 'border-accent bg-accent-bg text-text'
          : low
            ? 'border-border-input bg-panel-sub text-clock-low'
            : 'border-border-input bg-panel-sub text-muted'
      }`}
    >
      {text}
    </div>
  );
}
