import type { NotationStyle } from '../chess/notation';
import type { MoveFacts, PositionFacts } from './facts';
import type { ChatMessage, ExplanationLanguage } from './types';

export type Level = 'beginner' | 'intermediate' | 'club';
export type DetailMode = 'detailed' | 'opponent';
export type { ExplanationLanguage };

const LEVEL_TEXT: Record<ExplanationLanguage, Record<Level, string>> = {
  de: {
    beginner:
      'Anfänger: einfache Worte, ein Gedanke pro Satz, Fachbegriffe nur mit kurzer Erklärung in Klammern',
    intermediate:
      'Fortgeschrittene: Begriffe wie Fesselung, Gabel, offene Linie oder Entwicklung sind bekannt',
    club: 'Vereinsspieler: knapp und präzise, Fachsprache erlaubt',
  },
  en: {
    beginner:
      'beginners: simple words, one idea per sentence, technical terms only with a short explanation in brackets',
    intermediate: 'intermediate players: terms like pin, fork, open file or development are known',
    club: 'club players: short and precise, technical language allowed',
  },
};

const NOTATION_TEXT: Record<ExplanationLanguage, Record<NotationStyle, string>> = {
  de: {
    de: 'deutsche Notation (K König, D Dame, T Turm, L Läufer, S Springer, Bauern ohne Buchstabe)',
    en: 'englische Notation (K King, Q Queen, R Rook, B Bishop, N Knight, Bauern ohne Buchstabe)',
  },
  en: {
    de: 'German notation (K König/king, D Dame/queen, T Turm/rook, L Läufer/bishop, S Springer/knight, pawns without a letter)',
    en: 'English notation (K king, Q queen, R rook, B bishop, N knight, pawns without a letter)',
  },
};

const OUTPUT_FORMAT: Record<ExplanationLanguage, string> = {
  de: '{"explanations":[{"ply":<ply aus den Daten>,"was":"…","warum":"…","aufbauen":"…","merksatz":"… (optional)"}]}',
  en: '{"explanations":[{"ply":<ply from the data>,"was":"…","warum":"…","aufbauen":"…","merksatz":"… (optional)"}]}',
};

/** Marker vor den Daten in der Nutzer-Nachricht */
export const DATA_LABEL: Record<ExplanationLanguage, string> = { de: 'Daten:', en: 'Data:' };
const FORMAT_LABEL: Record<ExplanationLanguage, string> = {
  de: 'Antwortformat:',
  en: 'Answer format:',
};

/** „Antwortformat: … / Daten: …“ in der passenden Sprache */
export function formatAndData(
  format: string,
  data: unknown,
  language: ExplanationLanguage,
): string[] {
  return [
    `${FORMAT_LABEL[language]} ${format}`,
    DATA_LABEL[language],
    JSON.stringify(data, null, 1),
  ];
}

function systemPromptDe(level: Level, notation: NotationStyle, format: 'json' | 'text'): string {
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
    `- Schreibe für ${LEVEL_TEXT.de[level]}.`,
    `- Verwende ${NOTATION_TEXT.de[notation]}, genau wie in den Daten.`,
    '',
    'Stilbeispiel (gehört nicht zu dieser Partie, zeigt nur den Ton):',
    'Schlecht: „Das ist ein Patzer, die Gewinnchance fällt stark.“',
    'Gut: „Dein Turm d4 wird vom Bauern e5 angegriffen und nur vom Bauern c3 gedeckt. Nach exd4 hast du die Qualität verloren.“',
    '',
    'Bei guten Zügen (Brillant, Großartig, Beste, Ausgezeichnet, Gut, Theorie): erkläre, was der Zug bewirkt, warum er gut ist und wie man darauf aufbaut.',
    'Bei Fehlern (Ungenauigkeit, Fehler, Patzer, Verpasst): erkläre, was passiert ist, was besser gewesen wäre und woran man das erkennt.',
    'Gewinnchancen sind Prozent für die ziehende Seite. Bewertungen sind aus Sicht von Weiß in Bauerneinheiten, „M2“ heißt Matt in 2, „#“ heißt Matt auf dem Brett.',
    '',
    format === 'json'
      ? 'Antworte nur mit gültigem JSON, ohne Text davor oder danach.'
      : 'Antworte als normaler Text in 2–5 kurzen Sätzen, ohne JSON und ohne Überschriften.',
  ].join('\n');
}

function systemPromptEn(level: Level, notation: NotationStyle, format: 'json' | 'text'): string {
  return [
    "You are a patient chess coach explaining moves from a player's own game to them in English.",
    '',
    'Ground rules:',
    '1. Explain only on the basis of the data provided. It comes from the Stockfish engine and a rules program and is correct.',
    '2. Do not invent moves, variations or evaluations, and do not calculate chess yourself. Only mention moves, pieces and squares that appear in the data.',
    '3. If the data is not enough for a statement, say so honestly or leave the statement out.',
    '',
    'The data uses German field names. The most important fields:',
    '- zug_in_worten: the move that was played, in words.',
    "- hauptvariante_in_worten: the opponent's best reply and how play continues. This is the consequence of the move.",
    '- bester_zug_in_worten and variante_mit_bestzug_in_worten: what would have been better (only for weaker moves).',
    '- vor_dem_zug and nach_dem_zug (before/after the move): pieces in danger, i.e. attacked and undefended, or attacked by a cheaper piece. Compare before and after: which danger did the move overlook, remove or create?',
    '- material: material change for the side that moved, in pawn units (pawn 1, knight and bishop 3, rook 5, queen 9), directly from the move (durch_zug) and after the main line (nach_hauptvariante).',
    '- flags: schach = check, matt = mate, schlag = capture, opfer = sacrifice.',
    '- wer: "du" is the player themselves, "gegner" is their opponent. Address the player as "you".',
    '',
    'How to write:',
    '- Be concrete: name pieces and squares (e.g. "bishop c5", "knight f3") and say what happens on the board.',
    '- "was" (what): what the move does and how the opponent replies according to hauptvariante_in_worten.',
    '- "warum" (why): the chess reason, for example an undefended piece, a capture, a check, an attack or winning material. Do not just repeat the category, and mention at most one number.',
    '- "aufbauen" (next): for good moves the next concrete step according to the line; for errors a concrete question to ask yourself next time that fits exactly this position.',
    '- "merksatz" (rule of thumb): a short general chess rule that fits this move.',
    '- No empty phrases like "outside the plan", "check concretely" or "according to the data". Mention neither the data nor the engine.',
    `- Write for ${LEVEL_TEXT.en[level]}.`,
    `- Use ${NOTATION_TEXT.en[notation]}, exactly as in the data.`,
    '',
    'Style example (not from this game, it only shows the tone):',
    'Bad: "This is a blunder, the winning chance drops sharply."',
    'Good: "Your rook on d4 is attacked by the pawn on e5 and only defended by the pawn on c3. After exd4 you have lost the exchange."',
    '',
    'For good moves (Brilliant, Great, Best, Excellent, Good, Book): explain what the move achieves, why it is good and how to build on it.',
    'For errors (Inaccuracy, Mistake, Blunder, Miss): explain what happened, what would have been better and how to recognise it.',
    'Winning chances are percentages for the side to move. Evaluations are from White\'s point of view in pawn units, "M2" means mate in 2, "#" means checkmate on the board.',
    '',
    format === 'json'
      ? 'Answer only with valid JSON, with no text before or after it.'
      : 'Answer as plain text in 2–5 short sentences, without JSON and without headings.',
  ].join('\n');
}

/**
 * System-Prompt: geduldiger Trainer, nur gelieferte Daten, nichts erfinden – und konkret erklären.
 * Die Fakten enthalten Züge und Gefahren bereits in Worten (chess.js), damit auch kleine Modelle
 * auf das Geschehen eingehen können, ohne selbst zu rechnen. Sprache und Niveau sind Parameter.
 */
export function systemPrompt(
  level: Level,
  notation: NotationStyle,
  language: ExplanationLanguage = 'de',
  format: 'json' | 'text' = 'json',
): string {
  return language === 'en'
    ? systemPromptEn(level, notation, format)
    : systemPromptDe(level, notation, format);
}

/** Mehrere Züge in einer Anfrage (Batching). */
export function batchMessages(
  facts: MoveFacts[],
  level: Level,
  notation: NotationStyle,
  language: ExplanationLanguage = 'de',
): ChatMessage[] {
  const task =
    language === 'en'
      ? [
          `Explain the following ${facts.length} moves. Exactly one entry per move, each field 1–3 short sentences.`,
          'For every move, refer to hauptvariante_in_worten and the pieces in danger.',
        ]
      : [
          `Erkläre die folgenden ${facts.length} Züge. Für jeden Zug genau ein Eintrag, jedes Feld 1–3 kurze Sätze.`,
          'Gehe bei jedem Zug auf hauptvariante_in_worten und die Figuren in Gefahr ein.',
        ];
  return [
    { role: 'system', content: systemPrompt(level, notation, language) },
    {
      role: 'user',
      content: [...task, ...formatAndData(OUTPUT_FORMAT[language], facts, language)].join('\n'),
    },
  ];
}

/** Einzelner Zug: „Ausführlicher erklären“ oder „Gegner-Sicht“. */
const DETAIL_TASK_EN: Record<DetailMode, string> = {
  detailed:
    'Explain this move in more detail, each field 2–5 sentences. Go step by step through hauptvariante_in_worten and, if present, variante_mit_bestzug_in_worten, and explain why each move is played there.',
  opponent:
    'Explain the position after this move from the opponent\'s point of view, each field 1–3 sentences: "was" = what the opponent is planning now (first move in hauptvariante_in_worten), "warum" = which piece or square they attack with it (see nach_dem_zug), "aufbauen" = what the player must watch out for now.',
};

export function detailMessages(
  facts: MoveFacts,
  mode: DetailMode,
  level: Level,
  notation: NotationStyle,
  language: ExplanationLanguage = 'de',
): ChatMessage[] {
  const task =
    language === 'en'
      ? DETAIL_TASK_EN[mode]
      : mode === 'detailed'
        ? 'Erkläre diesen Zug ausführlicher, jedes Feld 2–5 Sätze. Gehe Schritt für Schritt durch hauptvariante_in_worten und, falls vorhanden, variante_mit_bestzug_in_worten, und erkläre jeweils, warum der Zug dort gespielt wird.'
        : 'Erkläre die Stellung nach diesem Zug aus Sicht des Gegners, jedes Feld 1–3 Sätze: „was“ = was der Gegner jetzt vorhat (erster Zug in hauptvariante_in_worten), „warum“ = welche Figur oder welches Feld er damit angreift (siehe nach_dem_zug), „aufbauen“ = worauf der Spieler jetzt achten muss.';
  return [
    { role: 'system', content: systemPrompt(level, notation, language) },
    {
      role: 'user',
      content: [task, ...formatAndData(OUTPUT_FORMAT[language], facts, language)].join('\n'),
    },
  ];
}

/** Einzelne Stellung (FEN-Import). */
export function positionMessages(
  facts: PositionFacts,
  level: Level,
  notation: NotationStyle,
  language: ExplanationLanguage = 'de',
): ChatMessage[] {
  const task =
    language === 'en'
      ? 'Explain this position using the engine lines (field in_worten) and the pieces in danger, each field 1–3 sentences: "was" = what the position is about, "warum" = why the best line is good, "aufbauen" = how the side to move should continue. Use "ply": 0.'
      : 'Erkläre diese Stellung anhand der Engine-Linien (Feld in_worten) und der Figuren in Gefahr, jedes Feld 1–3 Sätze: „was“ = worum es in der Stellung geht, „warum“ = warum die beste Linie gut ist, „aufbauen“ = wie die Seite am Zug weiterspielen sollte. Verwende "ply": 0.';
  return [
    { role: 'system', content: systemPrompt(level, notation, language) },
    {
      role: 'user',
      content: [task, ...formatAndData(OUTPUT_FORMAT[language], facts, language)].join('\n'),
    },
  ];
}
