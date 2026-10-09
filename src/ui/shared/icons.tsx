import type { SVGProps } from 'react';

/** Einfache Linien-Icons (24er Raster). Rein dekorativ: Beschriftung kommt vom Knopf. */
function Icon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    />
  );
}

export const IconFirst = () => (
  <Icon>
    <path d="M6 5v14" />
    <path d="M18 6 10 12l8 6V6Z" />
  </Icon>
);
export const IconPrev = () => (
  <Icon>
    <path d="m15 18-6-6 6-6" />
  </Icon>
);
export const IconNext = () => (
  <Icon>
    <path d="m9 18 6-6-6-6" />
  </Icon>
);
export const IconLast = () => (
  <Icon>
    <path d="M18 5v14" />
    <path d="M6 6l8 6-8 6V6Z" />
  </Icon>
);
export const IconFlip = () => (
  <Icon>
    <path d="M7 4 3 8l4 4" />
    <path d="M3 8h14" />
    <path d="m17 20 4-4-4-4" />
    <path d="M21 16H7" />
  </Icon>
);
export const IconUpload = (props: SVGProps<SVGSVGElement>) => (
  <Icon strokeWidth="1.8" {...props}>
    <path d="M12 16V4" />
    <path d="m7 9 5-5 5 5" />
    <path d="M5 20h14" />
  </Icon>
);
export const IconCheck = () => (
  <Icon width="16" height="16" strokeWidth="2.4">
    <path d="M20 6 9 17l-5-5" />
  </Icon>
);
export const IconAlert = () => (
  <Icon width="16" height="16" strokeWidth="2.2">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v5" />
    <path d="M12 16.5v.01" />
  </Icon>
);
export const IconFile = () => (
  <Icon width="14" height="14">
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
    <path d="M14 3v5h5" />
  </Icon>
);
