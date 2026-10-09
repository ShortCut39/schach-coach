import type { KeyboardEvent } from 'react';

/**
 * Tastatur für Reiterleisten (ARIA „tabs“): ←/→ wechseln, Pos1/Ende springen an den Rand.
 * Der neue Reiter wird ausgewählt und fokussiert. In Kombination mit `tabIndex` (nur der aktive
 * Reiter ist per Tab erreichbar) entspricht das dem üblichen Verhalten.
 */
export function handleTabKeys<T>(
  event: KeyboardEvent<HTMLElement>,
  values: readonly T[],
  current: T,
  select: (value: T) => void,
): void {
  const index = values.indexOf(current);
  const last = values.length - 1;
  const next =
    event.key === 'ArrowRight'
      ? index >= last
        ? 0
        : index + 1
      : event.key === 'ArrowLeft'
        ? index <= 0
          ? last
          : index - 1
        : event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? last
            : -1;
  if (next < 0) return;
  event.preventDefault();
  const value = values[next];
  if (value === undefined) return;
  select(value);
  const tabs = event.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]');
  tabs[next]?.focus();
}
