/**
 * Breakpoints mit Pixelwerten (z. B. `min-[1700px]:`) sortiert Tailwind vor seine eigenen
 * rem-Breakpoints (`lg:` …). Dann überschreibt `lg:` sie, und Raster zerfallen: Genau das ließ die
 * Muster-Seite mit einem langen Trainingsplan auseinanderbrechen. Große Breakpoints deshalb
 * nur über `3xl:` / `4xl:` aus tokens.css.
 */
const sources = import.meta.glob<string>('/src/**/*.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
});

describe('Breakpoints', () => {
  it('nutzt keine Pixel-Breakpoints (min-[…px]: / max-[…px]:)', () => {
    const offenders = Object.entries(sources).flatMap(([path, text]) =>
      [...text.matchAll(/\b(?:min|max)-\[\d+(?:\.\d+)?px\]:/g)].map((m) => `${path}: ${m[0]}`),
    );
    expect(offenders).toEqual([]);
  });
});
