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
 * System-Prompt: geduldiger Trainer, nur gelieferte Daten, nichts erfinden.
 * Sprache und Niveau sind Parameter.
 */
export function systemPrompt(
  level: Level,
  notation: NotationStyle,
  language: ExplanationLanguage = 'de',
): string {
  void language; // vorerst nur Deutsch
  return [
    'Du bist ein geduldiger Schachtrainer und erklärst Züge einer Partie auf Deutsch.',
    'Regeln:',
    '1. Erkläre ausschließlich anhand der gelieferten Daten (Züge, FEN, Engine-Bewertungen, Varianten, Material, Flags).',
    '2. Erfinde keine Züge, Varianten oder Bewertungen und rechne nicht selbst Schach. Nenne nur Züge, die in den Daten stehen.',
    '3. Wenn die Daten für eine Aussage nicht reichen, sag das ehrlich.',
    `4. Schreibe für ${LEVEL_TEXT[level]}.`,
    '5. Bei guten Zügen (Brillant, Großartig, Beste, Ausgezeichnet, Gut, Theorie): erkläre, was der Zug bewirkt, warum er gut ist und wie man darauf aufbaut.',
    '6. Bei Fehlern (Ungenauigkeit, Fehler, Patzer, Verpasst): erkläre, was passiert ist, was besser gewesen wäre und woran man das erkennt.',
    '7. Gewinnchancen sind Prozent für die ziehende Seite. Bewertungen sind aus Sicht von Weiß in Bauerneinheiten, „M2“ heißt Matt in 2, „#“ heißt Matt auf dem Brett.',
    `8. Verwende ${NOTATION_TEXT[notation]}, genau wie in den Daten.`,
    '9. Antworte nur mit gültigem JSON, ohne Text davor oder danach.',
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
        '„was“ = was der Zug bewirkt, „warum“ = warum er gut oder schlecht ist, „aufbauen“ = wie man darauf aufbaut bzw. woran man es künftig erkennt, „merksatz“ = optional, eine kurze allgemeine Regel.',
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
      ? 'Erkläre diesen Zug ausführlicher, jedes Feld 2–5 Sätze. Gehe auf die Hauptvariante und, falls vorhanden, die Variante mit dem Bestzug ein.'
      : 'Erkläre die Stellung nach diesem Zug aus Sicht des Gegners, jedes Feld 1–3 Sätze: „was“ = was der Gegner jetzt vorhat oder droht, „warum“ = warum laut Engine-Hauptvariante, „aufbauen“ = worauf der Spieler achten muss.';
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
        'Erkläre diese Stellung anhand der Engine-Linien, jedes Feld 1–3 Sätze: „was“ = worum es in der Stellung geht, „warum“ = warum die beste Linie gut ist, „aufbauen“ = wie die Seite am Zug weiterspielen sollte. Verwende "ply": 0.',
        `Antwortformat: ${OUTPUT_FORMAT}`,
        'Daten:',
        json(facts),
      ].join('\n'),
    },
  ];
}
