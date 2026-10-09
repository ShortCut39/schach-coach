import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  aside?: ReactNode;
}

export function PageHeader({ title, subtitle, aside }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="m-0 text-[26px] font-bold tracking-[-0.01em]">{title}</h1>
        {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
      </div>
      {aside}
    </div>
  );
}
