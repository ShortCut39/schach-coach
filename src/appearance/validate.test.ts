import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { checkAudio, checkImage, checkSvg, LIMITS, MB, sniffAudio, sniffImage } from './validate';

const text = (value: string) => new TextEncoder().encode(value);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
const WEBP = text('RIFF\u0010\u0000\u0000\u0000WEBPVP8 ');
const svg = (body: string, attrs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 45 45"${attrs}>${body}</svg>`;

describe('Dateityp aus dem Inhalt', () => {
  it('erkennt Bilder an den Magic Bytes, nicht an der Endung', () => {
    expect(sniffImage(PNG)).toBe('png');
    expect(sniffImage(JPG)).toBe('jpg');
    expect(sniffImage(WEBP)).toBe('webp');
    expect(
      sniffImage(text('<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg"/>')),
    ).toBe('svg');
    expect(sniffImage(text('﻿<svg></svg>'))).toBe('svg');
    expect(sniffImage(text('GIF89a'))).toBeNull();
    expect(sniffImage(text('MZ ausführbare Datei'))).toBeNull();
    expect(sniffImage(text('<html><svg></svg></html>'))).toBe('svg'); // checkSvg lehnt es ab
  });

  it('erkennt Töne an den Magic Bytes', () => {
    expect(sniffAudio(text('OggS\u0000'))).toBe('ogg');
    expect(sniffAudio(text('fLaC'))).toBe('flac');
    expect(sniffAudio(text('RIFF\u0000\u0000\u0000\u0000WAVEfmt '))).toBe('wav');
    expect(sniffAudio(text('ID3\u0004'))).toBe('mp3');
    expect(sniffAudio(new Uint8Array([0xff, 0xfb, 0x90]))).toBe('mp3');
    expect(sniffAudio(text('RIFF\u0000\u0000\u0000\u0000WEBP'))).toBeNull();
    expect(sniffAudio(PNG)).toBeNull();
  });

  it('lässt die mitgelieferten Figuren durch', () => {
    const file = resolve(__dirname, '../assets/pieces/cburnett/wK.svg');
    expect(checkImage(new Uint8Array(readFileSync(file)), LIMITS.piece, ['svg'])).toEqual({
      ok: true,
      type: 'svg',
    });
  });
});

describe('SVG-Prüfung', () => {
  it('erlaubt einfache Grafiken mit internen Verweisen', () => {
    expect(
      checkSvg(svg('<circle r="9" fill="url(#g)"/><defs><linearGradient id="g"/></defs>')),
    ).toBe('ok');
    expect(checkSvg(svg('<use href="#a"/><use xlink:href="#b"/>'))).toBe('ok');
    expect(checkSvg(svg('<image href="data:image/png;base64,iVBORw0KGgo="/>'))).toBe('ok');
    expect(checkSvg(svg('<style>.a{fill:url(#g)}</style>'))).toBe('ok');
  });

  it.each([
    ['Skript', svg('<script>alert(1)</script>')],
    [
      'Skript mit Namensraum-Präfix',
      svg('<svg:script xmlns:svg="http://www.w3.org/2000/svg">x</svg:script>'),
    ],
    [
      'foreignObject',
      svg('<foreignObject><div xmlns="http://www.w3.org/1999/xhtml">x</div></foreignObject>'),
    ],
    ['onload', svg('<circle r="1"/>', ' onload="alert(1)"')],
    ['onclick an Kind', svg('<rect onclick="x()"/>')],
    ['externes Bild', svg('<image href="https://example.org/a.png"/>')],
    ['externer xlink-Verweis', svg('<use xlink:href="other.svg#a"/>')],
    ['javascript-Link', svg('<a href="javascript:alert(1)"><circle r="1"/></a>')],
    ['externe Schrift im Stil', svg('<style>@import url(https://example.org/x.css);</style>')],
    ['externes url() im Attribut', svg('<rect fill="url(https://example.org/p.svg#x)"/>')],
    ['externes url() im style-Attribut', svg('<rect style="fill:url(http://x/y#z)"/>')],
    ['Entitäten', `<!DOCTYPE svg [<!ENTITY a "aaaa">]>${svg('<text>&a;</text>')}`],
    ['eingebettetes iframe', svg('<iframe src="x"/>')],
  ])('lehnt ab: %s', (_name, source) => {
    expect(checkSvg(source)).toBe('unsafe');
  });

  it('erkennt Nicht-SVGs', () => {
    expect(checkSvg('<html><body/></html>')).toBe('notSvg');
    expect(checkSvg('<svg><unclosed></svg>')).toBe('notSvg');
    expect(checkSvg('kein XML')).toBe('notSvg');
  });
});

describe('Bild- und Ton-Prüfung', () => {
  it('lehnt zu große, leere und falsche Dateien ab', () => {
    const big = new Uint8Array(LIMITS.piece + 1);
    big.set(PNG);
    expect(checkImage(big, LIMITS.piece, ['png'])).toEqual({ ok: false, error: 'tooLarge' });
    expect(checkImage(new Uint8Array(), LIMITS.piece, ['png'])).toEqual({
      ok: false,
      error: 'empty',
    });
    expect(checkImage(JPG, LIMITS.piece, ['svg', 'png', 'webp'])).toEqual({
      ok: false,
      error: 'type',
    });
    expect(checkImage(text(svg('<script/>')), LIMITS.piece, ['svg'])).toEqual({
      ok: false,
      error: 'svgUnsafe',
    });
    expect(checkImage(PNG, LIMITS.piece, ['png'])).toEqual({ ok: true, type: 'png' });
    expect(checkImage(JPG, LIMITS.board, ['jpg'])).toEqual({ ok: true, type: 'jpg' });
  });

  it('prüft Töne auf Größe und Typ', () => {
    expect(checkAudio(text('OggS....'))).toEqual({ ok: true, type: 'ogg' });
    expect(checkAudio(PNG)).toEqual({ ok: false, error: 'type' });
    const big = new Uint8Array(2 * MB + 1);
    big.set(text('OggS'));
    expect(checkAudio(big)).toEqual({ ok: false, error: 'tooLarge' });
  });
});
