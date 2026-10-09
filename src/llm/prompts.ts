import type { NotationStyle } from '../chess/notation';
import type { MoveFacts, PositionFacts } from './facts';
import type { ChatMessage } from './types';

export type Level = 'beginner' | 'intermediate' | 'club';
/** Sprache der Erklärungen. Vorerst nur Deutsch; weitere Sprachen am Ende der Entwicklung. */
export type ExplanationLanguage = 'de';
export type DetailMode = 'detailed' | 'opponent';

const LEVEL_TEXT: Record<Level, string> = {
  beginner:
    'Anfänger: einfache Worte, ein Gedanke pro Satz, Fachbegriffe nur mit kurzer Erklärung in Klammern',
  intermediate:
    'Fortgeschrittene: Begriffe wie Fesselung, Gabel, offene Linie oder Entwicklung sind bekannt',
  club: 'Vereinsspieler: knapp und präzise, Fachsprache erlaubt',
};

const NOTATION_TEXT: Record<NotationStyle, string> = {
  de: 'deutsche Notation (K König, D Dame, T Turm, L Läufer, S Springer, Bauern ohne Buchstabe)',
  en: 'englische Notation (K King, Q Queen, R Rook, B Bishop, N Knight, Bauern ohne Buchstabe)',
};

const OUTPUT_FORMAT =
  '{"explanations":[{"ply":<ply aus den Daten>,"was":"…","warum":"…","aufbauen":"…","merksatz":"… (optional)"}]}';

/**
 * System-Prompt: geduldiger Trainer, nur gelieferte Daten, nichts erfinden – und konkret erklären.
 * Die Fakten enthalten Züge und Gefahren bereits in Worten (chess.js), damit auch kleine Modelle
 * auf das Geschehen eingehen können, ohne selbst zu rechnen. Sprache und Niveau sind Parameter.
 */
export function systemPrompt(
  level: Level,
  notation: NotationStyle,
  language: ExplanationLanguage = 'de',
): string {
  void language; // vorerst nur Deutsch
  return [
    'Du bist ein geduldiger Schachtrainer und erklärst einem Spieler Züge aus seiner eigenen Partie auf Deutsch.',
    '',
    'Grundregeln:',
    '1. Erkläre ausschließlich anhand der gelieferten Daten. Sie stammen von der Engine Stockfish und einem Regelprogramm und sind korrekt.',
    '2. Erfinde keine Züge, Varianten oder Bewertungen und rechne nicht selbst Schach. Nenne nur Züge, Figuren und Felder, die in den Daten stehen.',
    '3. Wenn die Daten für eine Aussage nicht reichen, sag das ehrlich oder lass die Aussage weg.',
    '',
    'Die wichtigsten Felder der Daten:',
    '- zug_in_worten: was gezogen wurde.',
    '- hauptvariante_in_worten: die beste Antwort des Gegners und wie es danach weitergeht. Das ist die Folge des Zugs.',
    '- bester_zug_in_worten und variante_mit_bestzug_in_worten: was besser gewesen wäre (nur bei schwächeren Zügen).',
    '- vor_dem_zug und nach_dem_zug: Figuren in Gefahr, also angegriffen und ungedeckt oder von einer billigeren Figur angegriffen. Vergleiche vorher und nachher: Welche Gefahr hat der Zug übersehen, beseitigt oder neu geschaffen?',
    '- material: Materialänderung für die ziehende Seite in Bauerneinheiten (Bauer 1, Springer und Läufer 3, Turm 5, Dame 9), direkt durch den Zug und nach der Hauptvariante.',
    '- flags: Schach, Matt, Schlag, Opfer.',
    '- wer: „du“ ist der Spieler selbst, „gegner“ sein Gegner. Sprich den Spieler mit „du“ an.',
    '',
    'So schreibst du:',
    '- Konkret: Nenne Figuren und Felder (z. B. „Läufer c5“, „Springer f3“) und sag, was auf dem Brett passiert.',
    '- „was“: was der Zug tut und was der Gegner laut hauptvariante_in_worten darauf antwortet.',
    '- „warum“: der schachliche Grund, zum Beispiel eine ungedeckte Figur, ein Schlag, ein Schach, ein Angriff oder Materialgewinn. Wiederhole nicht nur die Kategorie und nenne höchstens eine Zahl.',
    '- „aufbauen“: bei guten Zügen der nächste konkrete Schritt laut Variante; bei Fehlern eine konkrete Prüffrage für das nächste Mal, die genau zu dieser Stellung passt.',
    '- „merksatz“: eine kurze allgemeine Schachregel, die zu diesem Zug passt.',
    '- Keine leeren Floskeln wie „außerhalb des Plans“, „prüfe konkret“ oder „laut den Daten“. Erwähne weder die Daten noch die Engine.',
    `- Schreibe für ${LEVEL_TEXT[level]}.`,
    `- Verwende ${NOTATION_TEXT[notation]}, genau wie in den Daten.`,
    '',
    'Stilbeispiel (gehört nicht zu dieser Partie, zeigt nur den Ton):',
    'Schlecht: „Das ist ein Patzer, die Gewinnchance fällt stark.“',
    'Gut: „Dein Turm d4 wird vom Bauern e5 angegriffen und nur vom Bauern c3 gedeckt. Nach exd4 hast du die Qualität verloren.“',
    '',
    'Bei guten Zügen (Brillant, Großartig, Beste, Ausgezeichnet, Gut, Theorie): erkläre, was der Zug bewirkt, warum er gut ist und wie man darauf aufbaut.',
    'Bei Fehlern (Ungenauigkeit, Fehler, Patzer, Verpasst): erkläre, was passiert ist, was besser gewesen wäre und woran man das erkennt.',
    'Gewinnchancen sind Prozent für die ziehende Seite. Bewertungen sind aus Sicht von Weiß in Bauerneinheiten, „M2“ heißt Matt in 2, „#“ heißt Matt auf dem Brett.',
    '',
    'Antworte nur mit gültigem JSON, ohne Text davor oder danach.',
  ].join('\n');
}

function json(data: unknown): string {
  return JSON.stringify(data, null, 1);
}

/** Mehrere Züge in einer Anfrage (Batching). */
export function batchMessages(
  facts: MoveFacts[],
  level: Level,
  notation: NotationStyle,
): ChatMessage[] {
  return [
    { role: 'system', content: systemPrompt(level, notation) },
    {
      role: 'user',
      content: [
        `Erkläre die folgenden ${facts.length} Züge. Für jeden Zug genau ein Eintrag, jedes Feld 1–3 kurze Sätze.`,
        'Gehe bei jedem Zug auf hauptvariante_in_worten und die Figuren in Gefahr ein.',
        `Antwortformat: ${OUTPUT_FORMAT}`,
        'Daten:',
        json(facts),
      ].join('\n'),
    },
  ];
}

/** Einzelner Zug: „Ausführlicher erklären“ oder „Gegner-Sicht“. */
export function detailMessages(
  facts: MoveFacts,
  mode: DetailMode,
  level: Level,
  notation: NotationStyle,
): ChatMessage[] {
  const task =
    mode === 'detailed'
      ? 'Erkläre diesen Zug ausführlicher, jedes Feld 2–5 Sätze. Gehe Schritt für Schritt durch hauptvariante_in_worten und, falls vorhanden, variante_mit_bestzug_in_worten, und erkläre jeweils, warum der Zug dort gespielt wird.'
      : 'Erkläre die Stellung nach diesem Zug aus Sicht des Gegners, jedes Feld 1–3 Sätze: „was“ = was der Gegner jetzt vorhat (erster Zug in hauptvariante_in_worten), „warum“ = welche Figur oder welches Feld er damit angreift (siehe nach_dem_zug), „aufbauen“ = worauf der Spieler jetzt achten muss.';
  return [
    { role: 'system', content: systemPrompt(level, notation) },
    {
      role: 'user',
      content: [task, `Antwortformat: ${OUTPUT_FORMAT}`, 'Daten:', json(facts)].join('\n'),
    },
  ];
}

/** Einzelne Stellung (FEN-Import). */
export function positionMessages(
  facts: PositionFacts,
  level: Level,
  notation: NotationStyle,
): ChatMessage[] {
  return [
    { role: 'system', content: systemPrompt(level, notation) },
    {
      role: 'user',
      content: [
        'Erkläre diese Stellung anhand der Engine-Linien (Feld in_worten) und der Figuren in Gefahr, jedes Feld 1–3 Sätze: „was“ = worum es in der Stellung geht, „warum“ = warum die beste Linie gut ist, „aufbauen“ = wie die Seite am Zug weiterspielen sollte. Verwende "ply": 0.',
        `Antwortformat: ${OUTPUT_FORMAT}`,
        'Daten:',
        json(facts),
      ].join('\n'),
    },
  ];
}
