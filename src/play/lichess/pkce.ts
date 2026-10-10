/**
 * PKCE (RFC 7636) für die Lichess-Anmeldung: zufälliger `code_verifier`, daraus die
 * `code_challenge` per SHA-256 (Methode S256, die einzige, die Lichess annimmt).
 */

/** Base64url ohne Auffüllzeichen */
export function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Kryptografisch zufällige Zeichenkette aus `bytes` Zufallsbytes (32 Bytes → 43 Zeichen) */
export function randomToken(bytes = 32): string {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return base64Url(buffer);
}

/** `code_challenge` = BASE64URL(SHA256(ASCII(code_verifier))) */
export async function codeChallenge(verifier: string): Promise<string> {
  // Der Verifier besteht nur aus ASCII-Zeichen; direkt in Bytes umwandeln
  const bytes = Uint8Array.from(verifier, (char) => char.charCodeAt(0));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return base64Url(new Uint8Array(digest));
}
