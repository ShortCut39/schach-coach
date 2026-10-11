/**
 * Prüfung hochgeladener Dateien, bevor sie gespeichert oder angezeigt werden. Entscheidend ist der
 * Inhalt (Magic Bytes bzw. SVG-Wurzelelement), nicht die Endung. SVGs werden ohnehin nur über
 * `<img>` angezeigt (dort laufen keine Skripte); zusätzlich lehnen wir alles Aktive oder Externe ab.
 */

export type ImageType = 'svg' | 'png' | 'webp' | 'jpg';
export type AudioType = 'ogg' | 'mp3' | 'wav' | 'flac';

export const IMAGE_MIME: Record<ImageType, string> = {
  svg: 'image/svg+xml',
  png: 'image/png',
  webp: 'image/webp',
  jpg: 'image/jpeg',
};

export const AUDIO_MIME: Record<AudioType, string> = {
  ogg: 'audio/ogg',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  flac: 'audio/flac',
};

export const MB = 1024 * 1024;
/** Grenzen je Datei */
export const LIMITS = { piece: 2 * MB, board: 5 * MB, sound: 2 * MB } as const;
/** Höchstlänge eines eigenen Tons in Sekunden */
export const MAX_SOUND_SECONDS = 5;
/** Höchstzahl eigener Sätze je Art */
export const MAX_CUSTOM_SETS = 20;

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  return signature.every((value, i) => bytes[offset + i] === value);
}

const ascii = (text: string) => Array.from(text, (c) => c.charCodeAt(0));

/** Bildtyp aus dem Dateianfang; SVG wird als Text erkannt (genauer prüft `checkSvg`) */
export function sniffImage(bytes: Uint8Array): ImageType | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'jpg';
  if (startsWith(bytes, ascii('RIFF')) && startsWith(bytes, ascii('WEBP'), 8)) return 'webp';
  const head = new TextDecoder('utf-8', { fatal: false })
    .decode(bytes.subarray(0, 4096))
    .replace(/^\uFEFF/, '')
    .trimStart();
  if (head.startsWith('<') && /<svg[\s>]/i.test(head)) return 'svg';
  return null;
}

export function sniffAudio(bytes: Uint8Array): AudioType | null {
  if (startsWith(bytes, ascii('OggS'))) return 'ogg';
  if (startsWith(bytes, ascii('fLaC'))) return 'flac';
  if (startsWith(bytes, ascii('RIFF')) && startsWith(bytes, ascii('WAVE'), 8)) return 'wav';
  if (startsWith(bytes, ascii('ID3'))) return 'mp3';
  if (bytes.length >= 2 && bytes[0] === 0xff && ((bytes[1] ?? 0) & 0xe0) === 0xe0) return 'mp3';
  return null;
}

export type SvgCheck = 'ok' | 'notSvg' | 'unsafe';

/** Elemente, die Skripte, fremde Inhalte oder Medien einbetten könnten */
const FORBIDDEN_ELEMENTS = new Set([
  'script',
  'foreignobject',
  'iframe',
  'embed',
  'object',
  'audio',
  'video',
  'handler',
  'listener',
]);

/** Eingebettete Rastergrafiken sind erlaubt, alles andere nur als Verweis innerhalb der Datei (`#id`) */
function safeReference(value: string): boolean {
  const v = value.trim();
  return v === '' || v.startsWith('#') || /^data:image\/(png|jpeg|webp|gif);base64,/i.test(v);
}

/** `url(…)` in Stilen: nur Verweise innerhalb der Datei */
function safeCss(css: string): boolean {
  if (/@import|expression\s*\(|javascript:/i.test(css)) return false;
  for (const match of css.matchAll(/url\(\s*(['"]?)([^'")]*)\1\s*\)/gi)) {
    if (!safeReference(match[2] ?? '')) return false;
  }
  return true;
}

/**
 * Prüft ein SVG: Wurzel `<svg>`, keine Skripte, kein `<foreignObject>`, keine Ereignis-Attribute
 * (`onload` …), keine externen Verweise (`href`, `url(…)`), keine Entitäten.
 */
export function checkSvg(text: string): SvgCheck {
  if (/<!ENTITY/i.test(text)) return 'unsafe';
  if (typeof DOMParser === 'undefined') return 'notSvg';
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const root = doc.documentElement;
  if (!root || root.localName !== 'svg' || doc.getElementsByTagName('parsererror').length > 0) {
    return 'notSvg';
  }
  for (const element of [root, ...Array.from(root.getElementsByTagName('*'))]) {
    const name = element.localName.toLowerCase();
    if (FORBIDDEN_ELEMENTS.has(name)) return 'unsafe';
    if (name === 'style' && !safeCss(element.textContent ?? '')) return 'unsafe';
    for (const attr of Array.from(element.attributes)) {
      const attrName = attr.localName.toLowerCase();
      if (attrName.startsWith('on')) return 'unsafe';
      if (attrName === 'href' || attrName === 'src') {
        if (!safeReference(attr.value)) return 'unsafe';
      } else if (/url\s*\(|javascript:/i.test(attr.value) && !safeCss(attr.value)) {
        return 'unsafe';
      }
    }
  }
  return 'ok';
}

export type ImageCheckError = 'empty' | 'tooLarge' | 'type' | 'svgUnsafe';

/** Prüft eine Bilddatei (Figur oder Brett); liefert den Typ oder einen Fehlercode. */
export function checkImage(
  bytes: Uint8Array,
  maxBytes: number,
  allowed: readonly ImageType[],
): { ok: true; type: ImageType } | { ok: false; error: ImageCheckError } {
  if (bytes.length === 0) return { ok: false, error: 'empty' };
  if (bytes.length > maxBytes) return { ok: false, error: 'tooLarge' };
  const type = sniffImage(bytes);
  if (!type || !allowed.includes(type)) return { ok: false, error: 'type' };
  if (type === 'svg') {
    const result = checkSvg(new TextDecoder().decode(bytes));
    if (result === 'unsafe') return { ok: false, error: 'svgUnsafe' };
    if (result === 'notSvg') return { ok: false, error: 'type' };
  }
  return { ok: true, type };
}

export type AudioCheckError = 'empty' | 'tooLarge' | 'type';

/** Erste Prüfung einer Ton-Datei; ob sie sich abspielen lässt, zeigt erst das Dekodieren. */
export function checkAudio(
  bytes: Uint8Array,
): { ok: true; type: AudioType } | { ok: false; error: AudioCheckError } {
  if (bytes.length === 0) return { ok: false, error: 'empty' };
  if (bytes.length > LIMITS.sound) return { ok: false, error: 'tooLarge' };
  const type = sniffAudio(bytes);
  return type ? { ok: true, type } : { ok: false, error: 'type' };
}
