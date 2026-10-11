import { useEffect, useState } from 'react';
import { getAppearanceStorage } from '../../appearance/storage';
import { objectUrl, type CustomSet } from '../../appearance/store';
import { uuidOf } from '../../appearance/types';
import { checkImage, IMAGE_MIME, LIMITS } from '../../appearance/validate';

/**
 * Vorschaubilder eines eigenen Satzes (z. B. `wK`, `bQ`, `wN` oder `board`): liest die Dateien,
 * prüft sie wie beim Laden und gibt Objekt-URLs zurück (beim Verlassen wieder freigegeben).
 */
export function useCustomPreview(set: CustomSet, stems: readonly string[]): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const key = `${set.id}|${set.files.join(',')}|${stems.join(',')}`;

  useEffect(() => {
    if (set.broken) return;
    let cancelled = false;
    const created: string[] = [];
    void (async () => {
      const result: Record<string, string> = {};
      for (const stem of stems) {
        const file = set.files.find((f) => f.startsWith(`${stem}.`));
        if (!file) continue;
        try {
          const bytes = await getAppearanceStorage().read(set.kind, uuidOf(set.id), file);
          const max = set.kind === 'boards' ? LIMITS.board : LIMITS.piece;
          const checked = checkImage(bytes, max, ['svg', 'png', 'webp', 'jpg']);
          if (!checked.ok) continue;
          const url = objectUrl(bytes, IMAGE_MIME[checked.type]);
          created.push(url);
          result[stem] = url;
        } catch {
          // Ohne Vorschau weiter
        }
      }
      if (cancelled) release();
      else setUrls(result);
    })();
    function release() {
      for (const url of created) if (url.startsWith('blob:')) URL.revokeObjectURL(url);
    }
    return () => {
      cancelled = true;
      release();
    };
    // `key` fasst Satz, Dateien und gewünschte Bilder zusammen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return urls;
}
