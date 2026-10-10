import { base64Url, codeChallenge, randomToken } from './pkce';

describe('PKCE', () => {
  it('erfüllt den Testvektor aus RFC 7636 (Anhang B)', async () => {
    expect(await codeChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    );
  });

  it('kodiert base64url ohne Auffüllzeichen', () => {
    expect(base64Url(new Uint8Array([251, 255, 191]))).toBe('-_-_');
    expect(base64Url(new Uint8Array([1]))).toBe('AQ');
  });

  it('erzeugt zufällige, gültige Verifier (43–128 Zeichen, nur erlaubte Zeichen)', () => {
    const a = randomToken();
    const b = randomToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9\-_]{43}$/);
  });
});
