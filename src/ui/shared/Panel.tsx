import type { ReactNode } from 'react';

interface PanelProps {
  children: ReactNode;
  className?: string;
}

/** Grundbaustein für Karten: Panel-Fläche, Rahmen, Radius 12. */
export function Panel({ children, className = '' }: PanelProps) {
  return (
    <section className={`rounded-panel border border-border bg-panel p-4 ${className}`}>
      {children}
    </section>
  );
}
