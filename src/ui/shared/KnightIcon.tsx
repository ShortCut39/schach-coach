interface KnightIconProps {
  className?: string;
}

/** Einfache Springer-Silhouette für Logo und App-Icon (eigene Zeichnung). */
export function KnightIcon({ className }: KnightIconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
      <path d="M7 21h11v-1.6c0-.5-.3-.9-.7-1.1-.9-1.6-1.2-3.6-1-5.6.2-2.2-.3-4.4-1.6-6.1C13.4 4.8 11.6 4 9.8 4l-.7-1.6-1.1 2c-1.4.7-2.5 1.9-3.1 3.4L3.6 11c-.3.7 0 1.4.6 1.7l.9.4c.5.2 1 .1 1.4-.3l1.3-1.3 1.6-.4c-.8 1.6-2 3-3.4 4.1-.6.5-.9 1.2-.9 1.9v2.3c0 .9.4 1.6 1.9 1.6Z" />
    </svg>
  );
}
