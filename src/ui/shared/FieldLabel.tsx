import type { ReactNode } from 'react';

interface FieldLabelProps {
  children: ReactNode;
  htmlFor?: string;
  id?: string;
}

/** Kleines Feld-Label in Mono-Großbuchstaben, wie in den Mockups. */
export function FieldLabel({ children, htmlFor, id }: FieldLabelProps) {
  const className =
    'mb-1.5 block font-mono text-[11px] font-semibold tracking-[0.06em] text-faint uppercase';
  return htmlFor ? (
    <label htmlFor={htmlFor} id={id} className={className}>
      {children}
    </label>
  ) : (
    <div id={id} className={className}>
      {children}
    </div>
  );
}
