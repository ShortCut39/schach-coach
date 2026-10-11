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
