import { expandArchives, linkTarget } from './uploads';

const text = (value: string) => new TextEncoder().encode(value);
const OGG = new Uint8Array([0x4f, 0x67, 0x67, 0x53, 1, 2, 3]);

describe('Git-Verweise beim Hochladen', () => {
  it('erkennt Verweis-Dateien, aber keine echten Dateien', () => {
    expect(linkTarget(text('GenericNotify.ogg'))).toBe('GenericNotify.ogg');
    expect(linkTarget(text('../Silence.ogg\n'))).toBe('../Silence.ogg');
    expect(linkTarget(OGG)).toBeNull();
    expect(linkTarget(text('hallo'))).toBeNull();
    expect(linkTarget(new Uint8Array([0xff, 0xfb, 0x90]))).toBeNull();
  });

  it('übernimmt die Zieldatei unter dem Namen des Verweises (Lichess-Standardtöne)', () => {
    const result = expandArchives(
      [
        { name: 'Move.ogg', bytes: OGG },
        { name: 'GenericNotify.ogg', bytes: OGG },
        { name: 'Victory.ogg', bytes: text('GenericNotify.ogg') },
        { name: 'Check.ogg', bytes: text('../Silence.ogg') },
      ],
      () => true,
    );
    expect(result.files.map((f) => f.name)).toEqual([
      'Move.ogg',
      'GenericNotify.ogg',
      'Victory.ogg',
    ]);
    expect(result.files[2]?.bytes).toEqual(OGG);
    expect(result.errors).toEqual([{ name: 'Check.ogg', error: 'link', target: 'Silence.ogg' }]);
  });
});
