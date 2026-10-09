import { handleTabKeys } from './tabKeys';

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedProps<T extends string> {
  label: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** `tabs`: Reiter (role=tab), `toggle`: Auswahl (aria-pressed), `light`: Auswahl mit hellem Aktivzustand */
  variant?: 'tabs' | 'toggle' | 'light';
  idPrefix?: string;
}

/** Gruppe aus Schaltflächen im Stil der Mockups (dunkle Schiene, aktiver Eintrag hervorgehoben). */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  variant = 'toggle',
  idPrefix,
}: SegmentedProps<T>) {
  const isTabs = variant === 'tabs';
  return (
    <div
      role={isTabs ? 'tablist' : 'group'}
      aria-label={label}
      onKeyDown={
        isTabs
          ? (event) =>
              handleTabKeys(
                event,
                options.map((o) => o.value),
                value,
                onChange,
              )
          : undefined
      }
      className="inline-flex self-start rounded-control border border-border-chip bg-bg p-[3px]"
    >
      {options.map((option) => {
        const active = option.value === value;
        const activeClass =
          variant === 'light'
            ? 'bg-toggle-on text-on-accent font-semibold'
            : 'bg-accent-bg text-accent-text font-semibold';
        return (
          <button
            key={option.value}
            type="button"
            id={idPrefix ? `${idPrefix}-${option.value}` : undefined}
            role={isTabs ? 'tab' : undefined}
            aria-selected={isTabs ? active : undefined}
            tabIndex={isTabs && !active ? -1 : undefined}
            aria-pressed={isTabs ? undefined : active}
            onClick={() => onChange(option.value)}
            className={`min-h-10 rounded-small px-5 text-sm transition-colors ${
              active ? activeClass : 'font-medium text-muted hover:text-text'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
