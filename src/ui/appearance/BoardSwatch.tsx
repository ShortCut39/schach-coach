import type { BoardLook } from '../../appearance/boards';

/** Kleines Brett (4 × 2 Felder) als Vorschau einer Brett-Voreinstellung oder eines Brettbilds */
export function BoardSwatch({ look }: { look: BoardLook | null }) {
  if (!look) return <span className="h-full w-full bg-panel-sub" />;
  if (look.kind === 'image') {
    return (
      <span
        className="h-full w-full"
        style={{
          backgroundImage: `url("${look.url}")`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
    );
  }
  return (
    <span className="grid h-full w-full grid-cols-4 grid-rows-2">
      {Array.from({ length: 8 }, (_, i) => (
        <span
          key={i}
          style={{ background: (i + Math.floor(i / 4)) % 2 === 0 ? look.light : look.dark }}
        />
      ))}
    </span>
  );
}
