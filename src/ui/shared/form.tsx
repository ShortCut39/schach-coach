import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import { FieldLabel } from './FieldLabel';

export const inputClass =
  'min-h-[46px] w-full rounded-control border border-border-input bg-bg px-3.5 text-text placeholder:text-faint disabled:border-border-chip disabled:bg-panel-sub disabled:text-muted';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  hint?: ReactNode;
  mono?: boolean;
  aside?: ReactNode;
}

/** Eingabefeld mit Mono-Label wie in den Mockups. */
export function TextField({
  id,
  label,
  hint,
  mono = true,
  aside,
  className = '',
  ...rest
}: TextFieldProps) {
  return (
    <div>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="flex gap-2">
        <input
          id={id}
          className={`${inputClass} ${mono ? 'font-mono text-sm' : ''} min-w-0 flex-1 ${className}`}
          {...rest}
        />
        {aside}
      </div>
      {hint && <div className="mt-1.5 text-[12.5px] text-muted">{hint}</div>}
    </div>
  );
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  id: string;
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}

export function SelectField({
  id,
  label,
  hint,
  children,
  className = '',
  ...rest
}: SelectFieldProps) {
  return (
    <div className={className}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <select id={id} className={`${inputClass} px-3 font-medium`} {...rest}>
        {children}
      </select>
      {hint && <div className="mt-1.5 text-[12.5px] text-muted">{hint}</div>}
    </div>
  );
}

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}

/** Schalter (role=switch), 48 × 28 px wie im Mockup, Klickfläche 44 px hoch. */
export function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="flex min-h-hit shrink-0 items-center"
    >
      <span
        className={`relative block h-7 w-12 rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-track'}`}
      >
        <span
          className={`absolute top-[3px] size-[22px] rounded-full bg-bg transition-[left] ${checked ? 'left-[23px]' : 'left-[3px]'}`}
        />
      </span>
    </button>
  );
}
