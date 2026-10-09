/**
 * Dekodiert den Inhalt einer PGN-Datei. Der PGN-Standard schreibt ISO-8859-1 vor,
 * viele Programme speichern aber UTF-8. Erst wird streng UTF-8 versucht,
 * danach Windows-1252 (Obermenge von ISO-8859-1).
 */
export function decodeText(bytes: ArrayBuffer | Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}
