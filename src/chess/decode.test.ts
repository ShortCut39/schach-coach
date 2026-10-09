import { decodeText } from './decode';

describe('decodeText', () => {
  it('liest UTF-8', () => {
    expect(decodeText(new TextEncoder().encode('[White "Müller"]'))).toBe('[White "Müller"]');
  });

  it('fällt bei Latin-1 auf Windows-1252 zurück', () => {
    const latin1 = new Uint8Array([0x4d, 0xfc, 0x6c, 0x6c, 0x65, 0x72]); // "Müller"
    expect(decodeText(latin1)).toBe('Müller');
  });
});
