import { objectUrl } from '../../appearance/store';

export interface ImageSize {
  width: number;
  height: number;
}

/** Abmessungen eines (schon geprüften) Bildes; `null`, wenn der Browser es nicht lesen kann. */
export function imageSize(bytes: Uint8Array, mime: string): Promise<ImageSize | null> {
  if (typeof window === 'undefined' || typeof window.Image !== 'function') {
    return Promise.resolve(null);
  }
  const url = objectUrl(bytes, mime);
  return new Promise((resolve) => {
    const image = new window.Image();
    const done = (size: ImageSize | null) => {
      if (url.startsWith('blob:')) URL.revokeObjectURL(url);
      resolve(size);
    };
    const timer = setTimeout(() => done(null), 4000);
    image.onload = () => {
      clearTimeout(timer);
      done(
        image.naturalWidth > 0 ? { width: image.naturalWidth, height: image.naturalHeight } : null,
      );
    };
    image.onerror = () => {
      clearTimeout(timer);
      done(null);
    };
    image.src = url;
  });
}

/** Hinweise zu Rastergrafiken: quadratisch und mindestens 128 × 128 px empfohlen */
export function sizeWarnings(size: ImageSize | null, minSide = 128): ('notSquare' | 'small')[] {
  if (!size) return [];
  const warnings: ('notSquare' | 'small')[] = [];
  if (Math.abs(size.width - size.height) > Math.max(1, size.width * 0.02)) {
    warnings.push('notSquare');
  }
  if (Math.min(size.width, size.height) < minSide) warnings.push('small');
  return warnings;
}

/** Größte Kantenlänge eines zugeschnittenen Brettbilds */
const MAX_CROP_SIDE = 2048;

/**
 * Schneidet ein Bild mittig quadratisch zu (Canvas) und liefert PNG-Bytes; wird das PNG größer als
 * `maxBytes`, JPEG. `null`, wenn der Browser das Bild nicht zeichnen kann.
 */
export async function cropToSquare(
  bytes: Uint8Array,
  mime: string,
  maxBytes: number,
): Promise<{ bytes: Uint8Array; type: 'png' | 'jpg' } | null> {
  if (typeof document === 'undefined') return null;
  const url = objectUrl(bytes, mime);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('image'));
      img.src = url;
    });
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    if (!side) return null;
    const target = Math.min(side, MAX_CROP_SIDE);
    const canvas = document.createElement('canvas');
    canvas.width = target;
    canvas.height = target;
    const context = canvas.getContext('2d');
    if (!context) return null;
    const sx = (image.naturalWidth - side) / 2;
    const sy = (image.naturalHeight - side) / 2;
    context.drawImage(image, sx, sy, side, side, 0, 0, target, target);
    const encode = (type: string, quality?: number) =>
      new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
    let blob = await encode('image/png');
    let type: 'png' | 'jpg' = 'png';
    if (!blob || blob.size > maxBytes) {
      blob = await encode('image/jpeg', 0.9);
      type = 'jpg';
    }
    if (!blob || blob.size > maxBytes) return null;
    return { bytes: new Uint8Array(await blob.arrayBuffer()), type };
  } catch {
    return null;
  } finally {
    if (url.startsWith('blob:')) URL.revokeObjectURL(url);
  }
}
