// SPDX-License-Identifier: MPL-2.0
/** Local English writing suggestions with offsets into the unchanged source. */
export type WritingIssueKind = 'hard' | 'very-hard' | 'adverb' | 'passive' | 'simpler';
export interface WritingIssue {
  kind: WritingIssueKind;
  start: number;
  end: number;
  advice: string;
  replacement?: string;
}
export interface WritingAnalysis {
  words: number;
  sentences: number;
  paragraphs: number;
  readingSeconds: number;
  grade: number | null;
  issues: WritingIssue[];
  limited: boolean;
}
export const WRITING_SCAN_LIMIT = 50_000;
export const WRITING_ISSUE_LIMIT = 100;
const alternatives: Record<string, string> = {
  'in order to': 'to', 'due to the fact that': 'because', 'at this point in time': 'now',
  'a large number of': 'many', 'in the event that': 'if', 'prior to': 'before',
  'subsequent to': 'after', 'with regard to': 'about', 'in close proximity to': 'near',
  utilize: 'use', utilizes: 'uses', utilized: 'used', commence: 'start',
  approximately: 'about', assistance: 'help', demonstrate: 'show',
};
const notAdverbs = new Set(['family', 'friendly', 'lovely', 'lonely', 'ugly', 'holy', 'silly', 'early', 'only', 'reply', 'apply', 'supply', 'multiply', 'july', 'belly', 'fly']);
const irregularParticiples = 'built|bought|caught|chosen|done|drawn|driven|eaten|felt|found|given|grown|held|heard|kept|known|left|lost|made|paid|read|said|seen|sent|shown|sold|taken|taught|thought|told|understood|won|written';

/** Mask code and Markdown syntax with spaces. Source offsets stay exact. */
function proseSource(source: string, markdown: boolean): string {
  const blank = (s: string): string => s.replace(/[^\r\n]/g, ' ');
  if (!markdown) return source.replace(/https?:\/\/\S+/gi, blank);
  let fence = '';
  return source.replace(/[^\n]*(?:\n|$)/g, line => {
    const marker = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (fence) {
      if (marker && marker[0] === fence[0] && marker.length >= fence.length && new RegExp(`^ {0,3}${marker}\\s*$`).test(line)) fence = '';
      return blank(line);
    }
    if (marker) { fence = marker; return blank(line); }
    if (/^(?: {4}|\t)/.test(line)) return blank(line);
    return line;
  }).replace(/`+[^`\r\n]*`+/g, blank)
    .replace(/!?\[([^[\]\r\n]*)\]\([^\s()[\]]*(?:\s+"[^"\r\n]*")?\)/g, (all, label: string) => {
      const start = all.indexOf('[') + 1;
      return ' '.repeat(start) + label + ' '.repeat(all.length - start - label.length);
    })
    .replace(/^ {0,3}\[[^\]\r\n]+\]:[^\r\n]*/gm, blank)
    .replace(/https?:\/\/\S+/gi, blank)
    .replace(/<[^<>\r\n]*>/g, blank)
    .replace(/^ {0,3}(?:#{1,6}\s+|>\s*|[-+*]\s+|\d+[.)]\s+)/gm, blank)
    .replace(/[*_~|]/g, ' ');
}

function syllables(word: string): number {
  const lower = word.toLowerCase();
  if (lower.length <= 3) return 1;
  const core = lower.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  return Math.max(1, (core.match(/[aeiouy]+/g) ?? []).length);
}

export function analyseWriting(text: string, markdown = false): WritingAnalysis {
  const source = proseSource(text.slice(0, WRITING_SCAN_LIMIT), markdown);
  const words = [...source.matchAll(/\p{L}+(?:['’]\p{L}+)*/gu)];
  const sentences = [...source.matchAll(/[^.!?\r\n]+(?:[.!?]+|$)/g)]
    .filter(match => /\p{L}/u.test(match[0]));
  const issues: WritingIssue[] = [];
  let limited = text.length > WRITING_SCAN_LIMIT;
  const add = (issue: WritingIssue): void => {
    if (issues.length < WRITING_ISSUE_LIMIT) issues.push(issue);
    else limited = true;
  };
  for (const match of words) {
    if (/^[a-z]+ly$/i.test(match[0]) && !notAdverbs.has(match[0].toLowerCase())) {
      add({ kind: 'adverb', start: match.index, end: match.index + match[0].length,
        advice: 'Consider a stronger verb, or remove this adverb if the meaning stays clear.' });
    }
  }
  const passive = new RegExp(`\\b(?:am|is|are|was|were|be|been|being)\\s+(?:(?:\\w+ly|not)\\s+)?(?:[a-z]+ed|${irregularParticiples})\\b`, 'gi');
  for (const match of source.matchAll(passive)) {
    add({ kind: 'passive', start: match.index, end: match.index + match[0].length,
      advice: 'Possible passive voice. Would naming who performs the action make this clearer?' });
  }
  const simpler = new RegExp(`\\b(?:${Object.keys(alternatives).join('|')})\\b`, 'gi');
  for (const match of source.matchAll(simpler)) {
    let replacement = alternatives[match[0].toLowerCase()]!;
    if (match[0] === match[0].toUpperCase()) replacement = replacement.toUpperCase();
    else if (/^[A-Z]/.test(match[0])) replacement = replacement[0]!.toUpperCase() + replacement.slice(1);
    add({ kind: 'simpler', start: match.index, end: match.index + match[0].length,
      advice: `Consider “${replacement}” if it fits your meaning.`, replacement });
  }
  for (const sentence of sentences) {
    const count = (sentence[0].match(/\p{L}+(?:['’]\p{L}+)*/gu) ?? []).length;
    if (count < 25) continue;
    const leading = sentence[0].length - sentence[0].trimStart().length;
    add({ kind: count >= 40 ? 'very-hard' : 'hard', start: sentence.index + leading,
      end: sentence.index + sentence[0].trimEnd().length,
      advice: `${count} words in this sentence. Consider splitting it or removing detail that readers do not need.` });
  }
  const englishWords = words.filter(word => /^[a-z]+(?:['’][a-z]+)*$/i.test(word[0]));
  const grade = words.length >= 20 && englishWords.length / words.length >= 0.8
    ? Math.max(1, Math.min(30, Math.round(0.39 * words.length / Math.max(1, sentences.length)
      + 11.8 * englishWords.reduce((sum, word) => sum + syllables(word[0]), 0) / englishWords.length - 15.59)))
    : null;
  return {
    words: words.length, sentences: sentences.length,
    paragraphs: source.split(/\r?\n\s*\r?\n/).filter(part => /\p{L}/u.test(part)).length,
    readingSeconds: Math.ceil(words.length / 200 * 60), grade,
    issues: issues.sort((a, b) => a.start - b.start || a.end - b.end), limited,
  };
}
