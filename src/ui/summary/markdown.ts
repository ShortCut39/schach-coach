import type { TFunction } from 'i18next';
import { formatMoveNumber, formatSan, type NotationStyle } from '../../chess/notation';
import { formatPgnDate, headerValue } from '../../chess/pgn';
import { currentLocale } from '../../i18n';
import type { Color, Game } from '../../chess/types';
import { PHASES, playerAccuracy } from '../../classification/accuracy';
import type { GameAnalysis } from '../../classification/gameAnalysis';
import { countCategories } from '../../classification/stats';
import { turningPoints } from '../../classification/turningPoints';
import { CATEGORIES } from '../../classification/types';
import { formatPositionEval } from '../../engine/evalFormat';
import type { PositionEval } from '../../engine/types';
import type { GameSummary } from '../../llm/summary';
import type { PlyExplanations } from '../../store/explanations';
import { CATEGORY_SYMBOL } from '../categoryStyle';
import { colorName, resultText } from '../chessText';
import { formatPercent } from '../format';

export interface MarkdownInput {
  game: Game;
  analysis: GameAnalysis;
  evals: readonly (PositionEval | undefined)[];
  userColor: Color;
  notation: NotationStyle;
  engine: { name: string; depth: number };
  explanations: Record<number, PlyExplanations>;
  summary: GameSummary | undefined;
}

/** Senkrechte Striche würden Markdown-Tabellen zerbrechen. */
function cell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

/** Partie, Genauigkeit, Kategorien, Wendepunkte, Tipps und alle Züge als Markdown. */
export function buildMarkdown(input: MarkdownInput, t: TFunction): string {
  const { game, analysis, evals, userColor, notation, explanations, summary } = input;
  const opponent: Color = userColor === 'w' ? 'b' : 'w';
  const moveText = (index: number) => {
    const ply = game.plies[index];
    return ply
      ? `${formatMoveNumber(ply.moveNumber, ply.color)} ${formatSan(ply.san, notation)}`
      : '';
  };
  const categoryText = (index: number) => {
    const category = analysis.plies[index]?.category;
    return category ? `${CATEGORY_SYMBOL[category]} ${t(`categories.${category}`)}` : '';
  };
  const white = headerValue(game.headers, 'White') ?? t('common.white');
  const black = headerValue(game.headers, 'Black') ?? t('common.black');
  const lines: string[] = [];

  lines.push(`# ${t('markdown.title')}`, '');
  lines.push(`- **${t('markdown.players')}:** ${white} – ${black}`);
  const date = formatPgnDate(game.headers.Date, currentLocale());
  if (date) lines.push(`- **${t('markdown.date')}:** ${date}`);
  lines.push(`- **${t('markdown.result')}:** ${resultText(t, game.result)}`);
  lines.push(`- **${t('markdown.youPlay')}:** ${colorName(t, userColor)}`);
  if (analysis.opening) {
    lines.push(
      `- **${t('markdown.opening')}:** ${analysis.opening.name} (${analysis.opening.eco})`,
    );
  }
  lines.push('');
  if (summary?.eroeffnung) lines.push(summary.eroeffnung, '');

  const mine = playerAccuracy(game, analysis.plies, userColor);
  const theirs = playerAccuracy(game, analysis.plies, opponent);
  lines.push(`## ${t('markdown.accuracy')}`, '');
  lines.push(
    `| ${t('markdown.player')} | ${t('markdown.overall')} | ${PHASES.map((p) => t(`phases.${p}`)).join(' | ')} |`,
  );
  lines.push(`|---|---|${PHASES.map(() => '---').join('|')}|`);
  for (const [label, acc] of [
    [`${t('analyse.stats.you')} (${colorName(t, userColor)})`, mine],
    [`${t('analyse.stats.opponent')} (${colorName(t, opponent)})`, theirs],
  ] as const) {
    lines.push(
      `| ${label} | ${formatPercent(acc.overall)} | ${PHASES.map((p) => formatPercent(acc.byPhase[p])).join(' | ')} |`,
    );
  }
  lines.push('');

  const myCounts = countCategories(game, analysis.plies, userColor);
  const theirCounts = countCategories(game, analysis.plies, opponent);
  lines.push(`## ${t('markdown.categories')}`, '');
  lines.push(
    `| ${t('markdown.category')} | ${t('analyse.stats.you')} | ${t('analyse.stats.opponent')} |`,
    '|---|---|---|',
  );
  for (const category of CATEGORIES) {
    lines.push(
      `| ${CATEGORY_SYMBOL[category]} ${t(`categories.${category}`)} | ${myCounts[category]} | ${theirCounts[category]} |`,
    );
  }
  lines.push('');

  const points = turningPoints(game, analysis.plies);
  if (points.length) {
    lines.push(`## ${t('markdown.turningPoints')}`, '');
    for (const index of points) {
      const text = summary?.wendepunkte.find((w) => w.ply === index)?.text;
      lines.push(`- **${moveText(index)}** – ${categoryText(index)}${text ? `: ${text}` : ''}`);
    }
    lines.push('');
  }

  if (summary?.tipps.length) {
    lines.push(`## ${t('markdown.tips')}`, '');
    summary.tipps.forEach((tip, i) => lines.push(`${i + 1}. **${tip.titel}** – ${tip.text}`));
    lines.push('');
  }

  lines.push(`## ${t('markdown.moves')}`, '');
  lines.push(
    `| ${t('markdown.move')} | ${t('markdown.category')} | ${t('markdown.eval')} | ${t('markdown.explanation')} |`,
    '|---|---|---|---|',
  );
  for (const ply of game.plies) {
    const entry = explanations[ply.index];
    const explanation = (entry?.detailed?.status === 'done' ? entry.detailed : entry?.short)
      ?.explanation;
    const text = explanation
      ? [explanation.was, explanation.warum, explanation.aufbauen, explanation.merksatz]
          .filter(Boolean)
          .join(' ')
      : '';
    lines.push(
      `| ${moveText(ply.index)} | ${categoryText(ply.index)} | ${formatPositionEval(evals[ply.index + 1]) ?? ''} | ${cell(text)} |`,
    );
  }
  lines.push('');

  const anyAi = summary !== undefined || Object.keys(explanations).length > 0;
  lines.push(
    '---',
    '',
    `_${t('markdown.generated', { engine: input.engine.name, depth: input.engine.depth })}${anyAi ? '' : ` ${t('markdown.noAi')}`}_`,
    '',
  );
  return lines.join('\n');
}

/** Dateiname aus den Spielernamen, nur sichere Zeichen. */
export function exportFileName(game: Game, t: TFunction): string {
  const name = [headerValue(game.headers, 'White'), headerValue(game.headers, 'Black')]
    .filter(Boolean)
    .join('-')
    .replace(/[^\p{L}\p{N}_-]+/gu, '_')
    .slice(0, 60);
  return t('markdown.fileName', { name: name || 'partie' });
}
