import type { ReactNode } from 'react';

/** Karte in den Einstellungen (Titel, Untertitel, Inhalt); `id` dient als Sprungziel. */
export function SettingsCard({
  id,
  title,
  subtitle,
  children,
}: {
  id: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={`settings-${id}`}
      aria-labelledby={`settings-${id}-title`}
      className="flex scroll-mt-5 flex-col gap-4 rounded-panel border border-border bg-panel px-5 pt-[18px] pb-5"
    >
      <div>
        <h2 id={`settings-${id}-title`} className="text-base font-bold">
          {title}
        </h2>
        {subtitle && <p className="mt-0.5 text-[13.5px] text-muted">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}
