import type { ReactNode } from 'react';
import { IconCheck } from '../shared/icons';

interface PresetTileProps {
  label: string;
  active: boolean;
  onSelect: () => void;
  /** Kleine Vorschau (Figuren, Brettfarben, Ton-Symbol) */
  preview: ReactNode;
  /** Zusatz unter dem Namen, z. B. „Eigener“ oder „Defekt“ */
  badge?: ReactNode;
  disabled?: boolean;
  /** Knöpfe unter der Kachel (Umbenennen, Löschen) */
  children?: ReactNode;
}

/** Kachel einer Voreinstellung oder eines eigenen Satzes; die aktive ist markiert. */
export function PresetTile({
  label,
  active,
  onSelect,
  preview,
  badge,
  disabled = false,
  children,
}: PresetTileProps) {
  return (
    <li className="flex min-w-0 flex-col gap-1.5">
      <button
        type="button"
        aria-pressed={active}
        aria-label={label}
        disabled={disabled}
        onClick={onSelect}
        className={`relative flex h-[76px] items-center justify-center overflow-hidden rounded-control border-2 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          active ? 'border-accent' : 'border-border-chip enabled:hover:border-border-accent'
        }`}
      >
        {preview}
        {active && (
          <span className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-accent text-on-accent">
            <IconCheck />
          </span>
        )}
      </button>
      <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
        <span
          title={label}
          className={`truncate text-[13px] ${active ? 'font-semibold text-text' : 'font-medium text-body'}`}
        >
          {label}
        </span>
        {badge}
      </div>
      {children}
    </li>
  );
}

export function TileBadge({
  tone = 'muted',
  children,
}: {
  tone?: 'muted' | 'danger';
  children: ReactNode;
}) {
  return (
    <span
      className={`rounded-small px-1.5 py-px text-[11px] font-semibold ${
        tone === 'danger' ? 'bg-loss-bg text-loss-text' : 'bg-panel-sub text-muted'
      }`}
    >
      {children}
    </span>
  );
}

/** Raster für Kacheln */
export function TileGrid({ label, children }: { label: string; children: ReactNode }) {
  return (
    <ul aria-label={label} className="grid grid-cols-[repeat(auto-fill,minmax(124px,1fr))] gap-3">
      {children}
    </ul>
  );
}
