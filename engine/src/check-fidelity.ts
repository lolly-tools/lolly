// SPDX-License-Identifier: MPL-2.0
/**
 * Fidelity of a Design document to the deck it recreates (plan 291, W1).
 *
 * Given a content inventory of the source (`ContentInventoryV1`, from `lolly read`)
 * and the result's `boxes`, this lists every source string the result does not
 * carry, every one it carries in edited form (a deliberate edit is listed, never
 * hidden), every one it carries on a different artboard, every speaker note that
 * did not reach an artboard's `notes`, and how the source slides map onto the
 * result's artboards.
 *
 * Text is compared after normalising both sides the same way: Design markup taken
 * out (list numbers kept, as they draw), typographic quotes and dashes made plain,
 * white space collapsed. A string found as written is carried, including one an
 * export split into lines with another column's lines between its pieces (rows read
 * from an export keep the reader's `readingIndex`). One found only when case and
 * punctuation are ignored (with `&` read as `and`, and -ise and -ize spellings taken
 * as one), whose words all appear in order with others between them, or whose words
 * mostly agree with a result line, is an edit; anything else is missing. Speaker
 * notes are compared unless the caller says the result cannot carry them (a PDF or
 * a picture). Decoration, logos, page numbers, dates, footers and repeated template
 * text in the source are not content and are skipped.
 *
 * Each source slide is matched against the artboard it maps to first. Every
 * occurrence a slide's string takes on its own artboard is used up, so a title
 * repeated on two slides must appear on both artboards: a copy on another artboard
 * counts only when no slide of that artboard already took it, and is then reported
 * as moved (`info`). A string with no copy left anywhere is missing.
 *
 * Declared deliberate edits (`opts.edits`) never hide a finding: the finding stays,
 * as `info` with `evidence.excepted`, and the string is listed in
 * `fidelity.excepted` rather than in `missingStrings`. A speaker note is covered the
 * same way when an edit's `source` is the whole note, or when every paragraph of it
 * the result lost is declared; it is then listed in `fidelity.excepted` and not
 * counted in `notes.missing`.
 *
 * The work is bounded: at most `FIDELITY_MAX_SOURCE_STRINGS` source strings are
 * compared with at most `FIDELITY_MAX_RESULT_LINES` result lines (and 2 million
 * characters), every form of the result text is worked out once per artboard, a
 * phrase is looked for only at the places its rarest word appears, and all the searches share
 * one budget of steps. Past any of these limits the family says it is partial
 * with a `warn`, so a large input is never read as clean.
 *
 * Pure: no DOM, no clock, no network.
 */
import type {
  CheckFidelityEditV1,
  CheckFidelityExceptedV1,
  CheckFidelityV1,
  CheckFindingV1,
} from '@lolly-tools/core/check-v1';
import type { ContentInventoryV1 } from '@lolly-tools/core/content-inventory-v1';
import { plainOfDesignText, parseDesignText } from './design-text.ts';

type Row = Record<string, unknown>;

/** Census classes that are not content: never reported missing. */
export const FIDELITY_IGNORED_CLASSES: readonly string[] = [
  'template-furniture',
  'decoration',
  'logo-candidate',
  'known-logo',
  'recurring-text',
  'page-number',
  'footer',
  'date',
];
/** Text roles that are not content. `other` is text set only in an icon font (a glyph name such as `east`) or decoration. */
export const FIDELITY_IGNORED_ROLES: readonly string[] = ['page-number', 'footer', 'other'];
/** Share of word overlap at which a result line counts as an edit of a source string. */
export const FIDELITY_EDIT_SIMILARITY = 0.6;
/** Most source strings one comparison reads; past this the family is partial. */
export const FIDELITY_MAX_SOURCE_STRINGS = 4000;
/** Most result lines one comparison reads; past this the family is partial. */
export const FIDELITY_MAX_RESULT_LINES = 8000;
/** Most characters of result text one comparison reads; past this the family is partial. */
const MAX_RESULT_CHARS = 2_000_000;
/** Steps the matchers may take in one comparison (word positions tried, words compared); past this the family is partial. */
const MAX_MATCH_WORK = 20_000_000;
/** Most declared edits one comparison takes. */
export const FIDELITY_MAX_EDITS = 2000;
/** Longest text one declared edit may hold in any field. */
const MAX_EDIT_TEXT = 4000;

const record = (v: unknown): v is Row => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const truthy = (v: unknown): boolean => v === true || v === 'true' || v === 1 || v === '1';
const finite = (v: unknown, fallback = 0): number => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback;
};

/** One line of text in a comparable form: plain quotes and dashes, white space collapsed. */
export function normaliseFidelityText(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[‐-―−]/g, '-')
    .replace(/…/g, '...')
    .replace(/[\u00a0\u2000-\u200b\u202f\u205f\u3000]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Case and punctuation dropped: what is left when only the words count. `&` reads
 * as `and`, and the -ise and -yse spellings fold into -ize and -yze, so a house-style
 * edit of either kind is an edit, not a loss. Both sides fold the same way.
 */
function loose(text: string): string {
  return normaliseFidelityText(text)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/(\p{L})([iy])s(e|ed|es|ing|ation|ations|er|ers)(?= |$)/gu, '$1$2z$3')
    .trim();
}

const wordsIn = (looseText: string): string[] => looseText.split(' ').filter(Boolean);
const wordsOf = (text: string): string[] => wordsIn(loose(text));

function countsOf(words: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);
  return counts;
}

/** Dice similarity of two word multisets, 0 to 1. */
function similarity(a: readonly string[], b: readonly string[]): number {
  if (!a.length || !b.length) return 0;
  const counts = countsOf(a);
  let shared = 0;
  for (const w of b) {
    const n = counts.get(w) ?? 0;
    if (n > 0) {
      shared += 1;
      counts.set(w, n - 1);
    }
  }
  return (2 * shared) / (a.length + b.length);
}

/** Dice similarity of two word multisets already counted. */
function similarityOfCounts(a: Map<string, number>, aLength: number, b: Map<string, number>, bLength: number): number {
  if (!aLength || !bLength) return 0;
  let shared = 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const [w, n] of small) shared += Math.min(n, large.get(w) ?? 0);
  return (2 * shared) / (aLength + bLength);
}

/** A source string worth checking: it says something in letters, or is a figure of two digits or more. */
const meaningful = (text: string): boolean => /\p{L}/u.test(text) || /\p{N}{2,}/u.test(text);

interface ResultArtboard {
  id: string;
  name: string;
  /** Normalised lines the artboard draws. */
  lines: string[];
  notes: string;
  /** Each line split on spaces as written, for a string an export split into pieces. */
  exactWords: string[][];
  /** Which lines hold each word as written, so a pieced string is looked for only where its first word is. */
  exactWordLines: Map<string, number[]>;
  /** Each line in its loose form, and its words. */
  looseLines: string[];
  lineWords: string[][];
  /** The loose lines joined, and where each non-empty line starts in it (-1 for an empty one). */
  looseJoined: string;
  lineStarts: number[];
  /** Where each loose word starts in `looseJoined`, in order, so a phrase is looked for only where its rarest word is. */
  wordAt: Map<string, number[]>;
  /** The non-empty lines in order, by their start in `looseJoined`, for finding the line at a position. */
  starts: number[];
  startLines: number[];
  /** Which lines hold each word, for the similarity search. */
  wordLines: Map<string, number[]>;
  /** The artboard's words counted, for mapping slides onto artboards. */
  wordCounts: Map<string, number>;
  wordTotal: number;
  /** One flag per character of `looseJoined`: set where a source string has used that occurrence up. */
  taken: Uint8Array;
  /** Scratch tallies for the similarity search, one per line, reset after each string. */
  tally: Int32Array;
}

/** Index lines by the words they hold, each line once per word. */
function indexWords(lineWords: readonly (readonly string[])[]): Map<string, number[]> {
  const index = new Map<string, number[]>();
  lineWords.forEach((words, i) => {
    for (const w of new Set(words)) {
      const list = index.get(w);
      if (list) list.push(i);
      else index.set(w, [i]);
    }
  });
  return index;
}

/** The text a Design row draws, one entry per line, list numbers kept. */
function drawnText(row: Row, stories: Map<string, string>): string[] {
  const text = str(row.textStory) ? (stories.get(str(row.id)) ?? '') : str(row.text);
  if (!text.trim()) return [];
  if (truthy(row.plainText) || str(row.textStory)) return text.split(/\r\n?|\n/);
  return parseDesignText(text).map((line) => {
    const words = line.runs.map((run) => run.text).join('');
    return line.list === 'number' ? `${line.number}. ${words}` : words;
  });
}

function storiesOf(input: unknown): Map<string, string> {
  const out = new Map<string, string>();
  let doc = input;
  if (typeof input === 'string') {
    try {
      doc = JSON.parse(input);
    } catch {
      return out;
    }
  }
  if (!record(doc) || !Array.isArray(doc.stories)) return out;
  for (const story of doc.stories)
    if (record(story) && typeof story.source === 'string' && Array.isArray(story.frameIds)) {
      const first = story.frameIds.find((id): id is string => typeof id === 'string');
      if (first) out.set(first, story.source.replace(/￼/g, ''));
    }
  return out;
}

/** One artboard with every form of its text the comparison reads, worked out once. */
function makeArtboard(id: string, name: string, lines: string[], notes: string): ResultArtboard {
  const looseLines = lines.map(loose);
  const lineWords = looseLines.map(wordsIn);
  const lineStarts: number[] = [];
  let looseJoined = '';
  for (const l of looseLines) {
    if (!l) {
      lineStarts.push(-1);
      continue;
    }
    if (looseJoined) looseJoined += ' ';
    lineStarts.push(looseJoined.length);
    looseJoined += l;
  }
  const exactWords = lines.map((l) => l.split(' '));
  const all = lineWords.flat();
  const wordAt = new Map<string, number[]>();
  const starts: number[] = [];
  const startLines: number[] = [];
  lineWords.forEach((words, i) => {
    let at = lineStarts[i]!;
    if (at < 0) return;
    starts.push(at);
    startLines.push(i);
    for (const w of words) {
      const list = wordAt.get(w);
      if (list) list.push(at);
      else wordAt.set(w, [at]);
      at += w.length + 1;
    }
  });
  return {
    id,
    name,
    lines,
    notes: normaliseFidelityText(notes),
    exactWords,
    exactWordLines: indexWords(exactWords),
    looseLines,
    lineWords,
    looseJoined,
    lineStarts,
    wordAt,
    starts,
    startLines,
    wordLines: indexWords(lineWords),
    wordCounts: countsOf(all),
    wordTotal: all.length,
    taken: new Uint8Array(looseJoined.length),
    tally: new Int32Array(lines.length),
  };
}

/** The result's artboards in deck order (order, then x, then id), each with its text and notes, within the line budget. */
function resultArtboards(boxes: unknown, textDocument: unknown): { boards: ResultArtboard[]; lines: number; read: number } {
  const rows = Array.isArray(boxes) ? boxes.filter(record) : [];
  const stories = storiesOf(textDocument);
  const indexed = rows.map((row, index) => ({ row, index }));
  const frames = indexed
    .filter((r) => r.row.kind === 'frame' && str(r.row.id))
    .sort(
      (a, b) =>
        finite(a.row.order, a.index) - finite(b.row.order, b.index) ||
        finite(a.row.x) - finite(b.row.x) ||
        str(a.row.id).localeCompare(str(b.row.id))
    );
  // A row read from an export carries the reader's `readingIndex`: a PDF line split
  // from a multi-column page reads in that order, not by its height on the page.
  const reading = (row: Row): number => finite(row.readingIndex, Number.MAX_SAFE_INTEGER);
  let total = 0;
  let budget = FIDELITY_MAX_RESULT_LINES;
  let chars = MAX_RESULT_CHARS;
  const textOf = (members: typeof indexed): string[] => {
    const lines = members
      .filter((m) => !truthy(m.row.hidden))
      .sort(
        (a, b) =>
          reading(a.row) - reading(b.row) ||
          finite(a.row.y) - finite(b.row.y) ||
          finite(a.row.x) - finite(b.row.x) ||
          a.index - b.index
      )
      .flatMap((m) => drawnText(m.row, stories))
      .map(normaliseFidelityText)
      .filter(Boolean);
    total += lines.length;
    const kept: string[] = [];
    for (const line of lines) {
      if (budget <= 0 || line.length > chars) break;
      kept.push(line);
      budget -= 1;
      chars -= line.length;
    }
    return kept;
  };
  if (!frames.length) {
    const lines = textOf(indexed.filter((r) => r.row.kind !== 'frame'));
    return { boards: lines.length ? [makeArtboard('', '', lines, '')] : [], lines: total, read: FIDELITY_MAX_RESULT_LINES - budget };
  }
  const members = new Map<string, typeof indexed>();
  for (const r of indexed) {
    if (r.row.kind === 'frame') continue;
    const frame = str(r.row.frame);
    const list = members.get(frame);
    if (list) list.push(r);
    else members.set(frame, [r]);
  }
  const boards = frames.map((frame) =>
    makeArtboard(
      str(frame.row.id),
      str(frame.row.name),
      textOf(members.get(str(frame.row.id)) ?? []),
      plainOfDesignText(str(frame.row.notes))
    )
  );
  return { boards, lines: total, read: FIDELITY_MAX_RESULT_LINES - budget };
}

interface SourceString {
  slide: number;
  text: string;
  /** The loose form, and its words. */
  key: string;
  words: string[];
}

/** The content strings of one source slide, line by line, decoration skipped. */
function sourceStrings(slide: ContentInventoryV1['slides'][number]): SourceString[] {
  const out: SourceString[] = [];
  const push = (line: string): void => {
    const text = normaliseFidelityText(line);
    if (!text || !meaningful(text)) return;
    const key = loose(text);
    out.push({ slide: slide.number, text, key, words: wordsIn(key) });
  };
  const ordered = [...slide.text].sort(
    (a, b) => (a.readingIndex ?? Number.MAX_SAFE_INTEGER) - (b.readingIndex ?? Number.MAX_SAFE_INTEGER)
  );
  for (const frame of ordered) {
    if (FIDELITY_IGNORED_CLASSES.includes(frame.class) || FIDELITY_IGNORED_ROLES.includes(frame.role)) continue;
    for (const line of frame.plain.split('\n')) push(line);
  }
  for (const table of slide.tables)
    for (const row of table.rows)
      for (const cell of row)
        for (const line of cell.split('\n')) push(line);
  return out;
}

/** Where `hay` holds `needle` as whole words (no letter or digit glued to either end), or -1. */
function phraseAt(hay: string, needle: string, from = 0): number {
  if (!needle) return -1;
  const word = /[\p{L}\p{N}]/u;
  const startsWord = word.test(needle[0]!);
  const endsWord = word.test(needle[needle.length - 1]!);
  for (let at = hay.indexOf(needle, from); at >= 0; at = hay.indexOf(needle, at + 1)) {
    const before = hay[at - 1];
    const after = hay[at + needle.length];
    if ((!startsWord || !before || !word.test(before)) && (!endsWord || !after || !word.test(after))) return at;
  }
  return -1;
}

/** Does `hay` hold `needle` as whole words? */
const containsPhrase = (hay: string, needle: string): boolean => phraseAt(hay, needle) >= 0;

/**
 * Every place the board's loose text holds the string's loose form as whole words, in
 * order. Only the positions of the string's rarest word are tried, so a long artboard
 * is never scanned end to end for each string.
 */
function looseOccurrences(board: ResultArtboard, s: SourceString, work: Work): number[] {
  if (!s.words.length || work.left <= 0) return [];
  let rarest = 0;
  let fewest = Infinity;
  for (let i = 0; i < s.words.length; i += 1) {
    const n = board.wordAt.get(s.words[i]!)?.length ?? 0;
    if (n === 0) return [];
    if (n < fewest) {
      fewest = n;
      rarest = i;
    }
  }
  let offset = 0;
  for (let i = 0; i < rarest; i += 1) offset += s.words[i]!.length + 1;
  const hay = board.looseJoined;
  const out: number[] = [];
  const positions = board.wordAt.get(s.words[rarest]!)!;
  work.left -= positions.length;
  for (const pos of positions) {
    const at = pos - offset;
    const end = at + s.key.length;
    if (at < 0 || end > hay.length) continue;
    if ((at === 0 || hay[at - 1] === ' ') && (end === hay.length || hay[end] === ' ') && hay.startsWith(s.key, at)) out.push(at);
  }
  return out;
}

/** The first of `occurrences` no source string has used yet, or -1. */
function freeOf(board: ResultArtboard, occurrences: readonly number[], length: number): number {
  for (const at of occurrences) if (board.taken.subarray(at, at + length).every((flag) => flag === 0)) return at;
  return -1;
}

/** The index of the line whose loose text holds position `at`, by binary search. */
function lineAt(board: ResultArtboard, at: number): number {
  let lo = 0;
  let hi = board.starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (board.starts[mid]! <= at) lo = mid;
    else hi = mid - 1;
  }
  return board.startLines[lo] ?? -1;
}

/** The first and last line the loose text from `at` for `length` characters spans. */
function spanAt(board: ResultArtboard, at: number, length: number): [number, number] {
  return [lineAt(board, at), lineAt(board, Math.max(at, at + length - 1))];
}

/** Does the board carry `s.text` exactly at one of its loose occurrences? Each is checked on its own lines, and one line either side. */
function exactAt(board: ResultArtboard, s: SourceString, occurrences: readonly number[], work: Work): boolean {
  for (const at of occurrences) {
    const [first, last] = spanAt(board, at, s.key.length);
    if (first < 0) continue;
    const local = board.lines.slice(Math.max(0, first - 1), last + 2).join(' ');
    work.left -= 1 + (local.length >> 6);
    if (containsPhrase(local, s.text)) return true;
  }
  return false;
}

/** What the result reads where the string's loose form is: one whole line when one holds it, else the lines it spans. */
function readsAt(board: ResultArtboard, s: SourceString, occurrences: readonly number[]): string {
  for (const at of occurrences) {
    const [first, last] = spanAt(board, at, s.key.length);
    if (first >= 0 && first === last) return board.lines[first]!;
  }
  const [first, last] = spanAt(board, occurrences[0]!, s.key.length);
  return first < 0 ? '' : board.lines.slice(first, Math.max(first, last) + 1).join(' ');
}

/** Use one occurrence up, so no other slide can count it again. */
function consume(board: ResultArtboard, at: number, length: number): void {
  board.taken.fill(1, at, at + length);
}

/** Could the board hold the string's words at all? Every phrase match needs each of them. */
const wordsPresent = (s: SourceString, board: ResultArtboard): boolean => s.words.every((w) => board.wordCounts.has(w));

/** What the matchers may still spend on this comparison. */
interface Work {
  left: number;
}


type Match =
  | { state: 'carried' }
  | { state: 'edited'; result: string }
  | { state: 'moved'; board: ResultArtboard; result?: string }
  | { state: 'missing' };

/** Lines skipped between the pieces of one source string before it no longer counts as one string. */
const SEQUENCE_GAP_LINES = 12;

const sameWords = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((w, i) => w === b[i]);

/**
 * Does the board carry `source` as whole lines, in order, with other lines between
 * them? An export splits a text frame into one line per row and interleaves the
 * columns of a page, so "Are we / building / our next bridge" can arrive with a
 * neighbouring column's lines between its pieces. The first piece may be the end of
 * a line and the last the start of one; every piece between is a whole line.
 */
function piecedFromLines(
  source: readonly string[],
  lines: ReadonlyArray<readonly string[]>,
  from?: readonly number[],
  work: Work = { left: Infinity }
): boolean {
  if (source.length < 2) return false;
  for (const i of from ?? lines.keys()) {
    if (work.left <= 0) return false;
    const first = lines[i]!;
    // A head longer than the source can never match, so only the line's last words start one.
    for (let s = Math.max(0, first.length - source.length); s < first.length; s += 1) {
      work.left -= source.length;
      const head = first.slice(s);
      if (head.length > source.length || !sameWords(head, source.slice(0, head.length))) continue;
      let k = head.length;
      let skipped = 0;
      for (let j = i + 1; k < source.length && j < lines.length && skipped <= SEQUENCE_GAP_LINES; j += 1) {
        const line = lines[j]!;
        work.left -= line.length + 1;
        if (!line.length) continue;
        if (k + line.length <= source.length && sameWords(line, source.slice(k, k + line.length))) k += line.length;
        else if (k + line.length > source.length && sameWords(line.slice(0, source.length - k), source.slice(k))) k = source.length;
        else skipped += 1;
      }
      if (k === source.length) return true;
    }
  }
  return false;
}

/**
 * Every word of `source`, in order, on the board, with other words allowed between
 * them: the run of lines from the first word to the last, or null. Bounded, so a
 * short string is not assembled from words scattered over a whole page.
 */
function inOrderOnBoard(
  source: readonly string[],
  lines: ReadonlyArray<readonly string[]>,
  raw: readonly string[],
  from?: readonly number[],
  work: Work = { left: Infinity }
): string | null {
  if (source.length < 2) return null;
  for (const start of from ?? lines.keys()) {
    if (work.left <= 0) return null;
    if (!lines[start]!.includes(source[0]!)) continue;
    let k = 0;
    let end = start;
    // Words walked from the first match to the last, the source's own included.
    let walked = 0;
    for (let j = start; j < lines.length && j - start <= SEQUENCE_GAP_LINES && k < source.length; j += 1) {
      work.left -= lines[j]!.length + 1;
      for (const word of lines[j]!) {
        if (k === 0 && word !== source[0]) continue;
        if (k < source.length) walked += 1;
        if (k < source.length && word === source[k]) {
          k += 1;
          end = j;
        }
      }
    }
    if (k === source.length && walked <= source.length * 3 + 4) return raw.slice(start, end + 1).join(' ');
  }
  return null;
}

/**
 * The line whose words most agree with `words`, at or above `FIDELITY_EDIT_SIMILARITY`,
 * or null. Each line is first tallied through the word index (an upper bound on the
 * words it shares), and only a line whose bound can reach the threshold is scored, so
 * a long artboard costs one pass over the lines that share a word, not a comparison each.
 */
function mostSimilarLine(words: readonly string[], board: ResultArtboard, work: Work): { score: number; line: number } | null {
  if (!words.length || work.left <= 0) return null;
  const touched: number[] = [];
  for (const [w, n] of countsOf(words)) {
    const postings = board.wordLines.get(w) ?? [];
    work.left -= postings.length;
    for (const i of postings) {
      const before = board.tally[i]!;
      if (before === 0) touched.push(i);
      board.tally[i] = before + n;
    }
  }
  touched.sort((a, b) => a - b);
  let best: { score: number; line: number } | null = null;
  for (const i of touched) {
    const bound = (2 * board.tally[i]!) / (words.length + board.lineWords[i]!.length);
    board.tally[i] = 0;
    if (bound < FIDELITY_EDIT_SIMILARITY || bound <= (best?.score ?? 0)) continue;
    work.left -= words.length + board.lineWords[i]!.length;
    const score = similarity(words, board.lineWords[i]!);
    if (score >= FIDELITY_EDIT_SIMILARITY && score > (best?.score ?? 0)) best = { score, line: i };
  }
  return best;
}

/** A string against the artboard its slide maps to: carried, edited, or null when not there. Uses up what it finds. */
function matchOwn(s: SourceString, board: ResultArtboard, work: Work): Match | null {
  const occurrences = wordsPresent(s, board) ? looseOccurrences(board, s, work) : [];
  const exact = occurrences.length > 0 && exactAt(board, s, occurrences, work);
  if (occurrences.length) {
    const left = freeOf(board, occurrences, s.key.length);
    if (left >= 0) consume(board, left, s.key.length);
    if (exact) return { state: 'carried' };
  }
  const exact0 = s.text.split(' ');
  if (piecedFromLines(exact0, board.exactWords, board.exactWordLines.get(exact0[0]!) ?? [], work)) return { state: 'carried' };
  if (occurrences.length) return { state: 'edited', result: readsAt(board, s, occurrences) };
  // Every word, in order, with other words between them (another column's lines, a
  // word added): an edit, shown with the lines it spans, never a missing string.
  const span = s.words.length ? inOrderOnBoard(s.words, board.lineWords, board.lines, board.wordLines.get(s.words[0]!) ?? [], work) : null;
  if (span) return { state: 'edited', result: span };
  const best = mostSimilarLine(s.words, board, work);
  if (!best) return null;
  const start = board.lineStarts[best.line]!;
  const own = board.looseLines[best.line]!;
  if (start >= 0 && board.taken.subarray(start, start + own.length).every((flag) => flag === 0)) consume(board, start, own.length);
  return { state: 'edited', result: board.lines[best.line]! };
}

/** A string its own artboard does not carry, against the copies other slides left unused on the other artboards. */
function matchElsewhere(s: SourceString, boards: readonly ResultArtboard[], own: ResultArtboard | undefined, work: Work): Match {
  for (const board of boards) {
    if (board === own || !wordsPresent(s, board)) continue;
    const occurrences = looseOccurrences(board, s, work);
    const at = freeOf(board, occurrences, s.key.length);
    if (at < 0) continue;
    consume(board, at, s.key.length);
    if (exactAt(board, s, [at], work)) return { state: 'moved', board };
    return { state: 'moved', board, result: readsAt(board, s, [at]) };
  }
  return { state: 'missing' };
}

// ─── declared edits ──────────────────────────────────────────────────────────

/**
 * Read declared deliberate edits: a JSON array of `{ source, result?, reason }`, or
 * an object with that array under `edits`. Every problem is listed, so a caller can
 * refuse the whole input rather than use part of the list.
 */
export function parseFidelityEdits(value: unknown): { edits: CheckFidelityEditV1[]; problems: string[] } {
  const list: unknown[] | null = Array.isArray(value) ? value : record(value) && Array.isArray(value.edits) ? value.edits : null;
  if (!list)
    return { edits: [], problems: ['Edits are a JSON array of { "source", "result", "reason" }, or an object with that array under "edits".'] };
  const problems: string[] = [];
  if (list.length > FIDELITY_MAX_EDITS) problems.push(`There are ${list.length} edits; one check takes up to ${FIDELITY_MAX_EDITS}.`);
  const edits: CheckFidelityEditV1[] = [];
  list.slice(0, FIDELITY_MAX_EDITS).forEach((item, i) => {
    const where = `Edit ${i + 1}`;
    if (!record(item)) {
      problems.push(`${where} is not an object.`);
      return;
    }
    const extra = Object.keys(item).find((k) => k !== 'source' && k !== 'result' && k !== 'reason');
    if (extra) problems.push(`${where} has an unknown field "${extra}".`);
    let long = false;
    for (const key of ['source', 'result', 'reason'] as const) {
      const value = item[key];
      if (typeof value === 'string' && value.length > MAX_EDIT_TEXT) {
        problems.push(`${where} has a "${key}" longer than ${MAX_EDIT_TEXT} characters.`);
        long = true;
      }
    }
    if (long) return;
    const source = typeof item.source === 'string' ? normaliseFidelityText(item.source) : '';
    const reason = typeof item.reason === 'string' ? item.reason.trim() : '';
    if (!source) problems.push(`${where} needs "source", the source text as the deck has it.`);
    if (!reason) problems.push(`${where} needs "reason", why the change was made on purpose.`);
    if (item.result !== undefined && typeof item.result !== 'string') problems.push(`${where} has a "result" that is not text.`);
    if (!source || !reason) return;
    const result = typeof item.result === 'string' ? normaliseFidelityText(item.result) : '';
    edits.push({ source, ...(result ? { result } : {}), reason });
  });
  return { edits, problems };
}

interface EditKey {
  edit: CheckFidelityEditV1;
  source: string;
  result?: string;
  used: boolean;
}

// ─── the comparison ──────────────────────────────────────────────────────────

export interface CheckFidelityOptions {
  /** The Design `textDocument` input, for boxes whose words live in a composed story. */
  textDocument?: unknown;
  /**
   * Compare speaker notes. Default true. False for a result that cannot carry notes
   * (a PDF or a picture), so their absence there is not reported as missing.
   */
  notes?: boolean;
  /** Changes made on purpose: their findings are kept, marked excepted, never passed. */
  edits?: readonly CheckFidelityEditV1[];
}

export interface CheckFidelityResult {
  fidelity: CheckFidelityV1;
  findings: CheckFindingV1[];
  /** For each source slide, in order, the artboard id it maps to, or null when none does. */
  mapping: Array<string | null>;
  /** False when a cap stopped the comparison short; a `fidelity.coverage.partial` finding says where. */
  complete: boolean;
}

const slideRef = (n: number): string => `slide ${n}`;
const boardRef = (b: ResultArtboard): string => `artboard “${b.name || b.id || 'untitled'}”`;

/**
 * Compare a recreation with its source inventory. Missing strings, missing notes,
 * a changed slide count or order and a partial comparison are `warn`; an edited
 * or moved string is `info`, listed so a person can confirm it was meant.
 */
export function checkFidelity(
  inventory: ContentInventoryV1,
  boxes: unknown,
  opts: CheckFidelityOptions = {}
): CheckFidelityResult {
  const result = resultArtboards(boxes, opts.textDocument);
  const boards = result.boards;
  const findings: CheckFindingV1[] = [];
  const missingStrings: string[] = [];
  const editedStrings: Array<{ source: string; result: string }> = [];
  const mapping: Array<string | null> = [];
  let carriedNotes = 0;
  let missingNotes = 0;
  const used = new Set<number>();

  // Every slide's strings, within the source budget.
  let sourceTotal = 0;
  let sourceBudget = FIDELITY_MAX_SOURCE_STRINGS;
  const slideStrings = inventory.slides.map((slide) => {
    const all = sourceStrings(slide);
    sourceTotal += all.length;
    const kept = all.slice(0, Math.max(0, sourceBudget));
    sourceBudget -= kept.length;
    return kept;
  });

  const work: Work = { left: MAX_MATCH_WORK };
  // Map each slide to the artboard that carries most of its words; with no words
  // to go on, to the artboard in the same position.
  const targets = inventory.slides.map((_slide, slideIndex) => {
    const words = slideStrings[slideIndex]!.flatMap((s) => s.words);
    const counts = countsOf(words);
    let target = -1;
    let bestScore = 0;
    boards.forEach((board, i) => {
      if (work.left <= 0) return;
      work.left -= 1 + Math.min(counts.size, board.wordCounts.size);
      const score = similarityOfCounts(counts, words.length, board.wordCounts, board.wordTotal) - (used.has(i) ? 0.01 : 0);
      if (score > bestScore) {
        bestScore = score;
        target = i;
      }
    });
    if (target < 0 && slideIndex < boards.length && !used.has(slideIndex)) target = slideIndex;
    if (target >= 0) used.add(target);
    const board = target >= 0 ? boards[target]! : undefined;
    mapping.push(board ? board.id || null : null);
    return board;
  });

  // First every slide against its own artboard, so each takes its own copies; then
  // what is left against the copies no slide took.
  const outcomes: Array<Array<Match | null>> = slideStrings.map((strings, slideIndex) => {
    const board = targets[slideIndex];
    return strings.map((s) => (board ? matchOwn(s, board, work) : null));
  });
  slideStrings.forEach((strings, slideIndex) => {
    const row = outcomes[slideIndex]!;
    strings.forEach((s, i) => {
      row[i] ??= matchElsewhere(s, boards, targets[slideIndex], work);
    });
  });

  const editKeys: EditKey[] = (opts.edits ?? []).slice(0, FIDELITY_MAX_EDITS).map((edit) => {
    const resultKey = edit.result !== undefined ? loose(edit.result) : '';
    return { edit, source: loose(edit.source), ...(resultKey ? { result: resultKey } : {}), used: false };
  });
  const excepted: CheckFidelityExceptedV1[] = [];
  /** The declared edit a text finding falls under, if any. */
  const editFor = (s: SourceString, found: Match, board: ResultArtboard | undefined, reads: string | undefined): EditKey | undefined =>
    editKeys.find((k) => {
      if (k.source !== s.key) return false;
      if (k.result === undefined) return true;
      // A replacement the author declared must be there: on the slide's artboard (or anywhere, when it maps to none).
      if (found.state === 'missing') return (board ? [board] : boards).some((b) => containsPhrase(b.looseJoined, k.result!));
      return containsPhrase(loose(reads ?? s.text), k.result);
    });
  /**
   * The declared edits a speaker note that did not arrive falls under: one whose source
   * is the whole note, and one for each of its paragraphs the result's notes do not
   * hold. A note is covered when its whole text is declared, or when every paragraph it
   * lost is; otherwise null and the note stays missing. A declared replacement must be
   * in the notes of the slide's artboard (or of any artboard, when it maps to none).
   */
  const noteEditsFor = (
    paragraphs: ReadonlyArray<{ lines: readonly string[] }>,
    whole: string,
    board: ResultArtboard | undefined
  ): Array<{ key: EditKey; source: string }> | null => {
    if (!editKeys.length) return null;
    const heldNotes = board?.notes ?? '';
    const heldLoose = loose(heldNotes);
    const replaced = (result: string): boolean =>
      (board ? [board] : boards).some((b) => !!b.notes && containsPhrase(b === board ? heldLoose : loose(b.notes), result));
    const keyFor = (text: string): EditKey | undefined => {
      const source = loose(text);
      return editKeys.find((k) => k.source === source && (k.result === undefined || replaced(k.result)));
    };
    const lost = paragraphs
      .map((p) => normaliseFidelityText(p.lines.join(' ')))
      .filter((text) => text && !(heldNotes && (containsPhrase(heldNotes, text) || containsPhrase(heldLoose, loose(text)))));
    const perParagraph = lost.map((source) => ({ source, key: keyFor(source) }));
    const covered = perParagraph.filter((p): p is { source: string; key: EditKey } => !!p.key);
    const wholeKey = keyFor(whole);
    if (wholeKey) return [{ key: wholeKey, source: whole }, ...covered.filter((p) => p.key !== wholeKey)];
    return lost.length && covered.length === lost.length ? covered : null;
  };

  inventory.slides.forEach((slide, slideIndex) => {
    const board = targets[slideIndex];
    slideStrings[slideIndex]!.forEach((s, i) => {
      const found = outcomes[slideIndex]![i]!;
      if (found.state === 'carried') return;
      let finding: CheckFindingV1;
      let reads: string | undefined;
      if (found.state === 'missing') {
        finding = {
          code: 'fidelity.text.missing',
          family: 'fidelity',
          severity: 'warn',
          message: `“${s.text}” from ${slideRef(s.slide)} is not in the result.`,
          needs: 'review',
          ...(board?.id ? { artboardId: board.id } : {}),
          evidence: { slide: s.slide, source: s.text },
          origin: { checker: 'fidelity', id: 'text.missing' },
        };
      } else if (found.state === 'edited') {
        reads = found.result;
        if (!editedStrings.some((e) => e.source === s.text)) editedStrings.push({ source: s.text, result: found.result });
        finding = {
          code: 'fidelity.text.edited',
          family: 'fidelity',
          severity: 'info',
          message: `“${s.text}” from ${slideRef(s.slide)} reads “${found.result}” in the result.`,
          needs: 'review',
          ...(board?.id ? { artboardId: board.id } : {}),
          evidence: { slide: s.slide, source: s.text, result: found.result },
          origin: { checker: 'fidelity', id: 'text.edited' },
        };
      } else {
        reads = found.result ?? s.text;
        if (found.result !== undefined && !editedStrings.some((e) => e.source === s.text))
          editedStrings.push({ source: s.text, result: found.result });
        const wording = found.result !== undefined ? `, reading “${found.result}”` : '';
        finding = {
          code: 'fidelity.text.moved',
          family: 'fidelity',
          severity: 'info',
          message: board
            ? `“${s.text}” from ${slideRef(s.slide)} is on ${boardRef(found.board)}${wording}, not on ${boardRef(board)} with the rest of ${slideRef(s.slide)}.`
            : `“${s.text}” from ${slideRef(s.slide)} is on ${boardRef(found.board)}${wording}.`,
          needs: 'review',
          ...(found.board.id ? { artboardId: found.board.id } : {}),
          evidence: {
            slide: s.slide,
            source: s.text,
            ...(found.result !== undefined ? { result: found.result } : {}),
            artboard: found.board.id,
            ...(board?.id ? { expectedArtboard: board.id } : {}),
          },
          origin: { checker: 'fidelity', id: 'text.moved' },
        };
      }
      const edit = editFor(s, found, board, reads);
      if (edit) {
        edit.used = true;
        excepted.push({ slide: s.slide, source: s.text, ...(reads !== undefined ? { result: reads } : {}), reason: edit.edit.reason });
        const { needs: _needs, ...rest } = finding;
        finding = {
          ...rest,
          severity: 'info',
          message: `${finding.message} Recorded as a deliberate edit: ${edit.edit.reason.replace(/[.\s]+$/, '')}.`,
          evidence: { ...finding.evidence, excepted: true, reason: edit.edit.reason },
        };
      } else if (found.state === 'missing' && !missingStrings.includes(s.text)) missingStrings.push(s.text);
      findings.push(finding);
    });

    const notes = slide.notes && opts.notes !== false ? normaliseFidelityText(slide.notes.paragraphs.flatMap((p) => p.lines).join(' ')) : '';
    if (notes) {
      const carried =
        !!board &&
        !!board.notes &&
        (containsPhrase(board.notes, notes) ||
          containsPhrase(loose(board.notes), loose(notes)) ||
          similarity(wordsOf(notes), wordsOf(board.notes)) >= FIDELITY_EDIT_SIMILARITY);
      if (carried) carriedNotes += 1;
      else {
        let finding: CheckFindingV1 = {
          code: 'fidelity.notes.missing',
          family: 'fidelity',
          severity: 'warn',
          message: board
            ? `The speaker notes of ${slideRef(slide.number)} are not in the notes of ${boardRef(board)}.`
            : `The speaker notes of ${slideRef(slide.number)} have no artboard to go to.`,
          needs: 'review',
          ...(board?.id ? { artboardId: board.id, path: `/boxes/${boardIndex(boxes, board.id)}/notes` } : {}),
          evidence: { slide: slide.number, notes: notes.length > 200 ? `${notes.slice(0, 199)}…` : notes },
          origin: { checker: 'fidelity', id: 'notes.missing' },
        };
        const declared = noteEditsFor(slide.notes!.paragraphs, notes, board);
        if (declared) {
          const reasons: string[] = [];
          for (const { key, source } of declared) {
            key.used = true;
            excepted.push({ slide: slide.number, source, ...(key.edit.result !== undefined ? { result: key.edit.result } : {}), reason: key.edit.reason });
            const reason = key.edit.reason.replace(/[.\s]+$/, '');
            if (!reasons.includes(reason)) reasons.push(reason);
          }
          const { needs: _needs, ...rest } = finding;
          finding = {
            ...rest,
            severity: 'info',
            message: `${finding.message} Recorded as a deliberate edit: ${reasons.join('; ')}.`,
            evidence: { ...finding.evidence, excepted: true, reason: declared.map((d) => d.key.edit.reason).join(' ') },
          };
        } else missingNotes += 1;
        findings.push(finding);
      }
    }
  });

  // An edit whose result has the same words as its source changes only their form (case,
  // colour, spacing, quotes). It excepts a finding when one is there, and is never
  // reported unused: `lolly compose` declares its sentence case and accent emphasis
  // this way, line by line, where no single source string may hold the line.
  // Text the comparison never asks about (an icon-font glyph name such as `east`, a page
  // number, a footer) is decoration: an edit declared for it is allowed and never unused.
  const unused = editKeys.filter((k) => !k.used && k.result !== k.source);
  const decoration = new Set<string>();
  if (unused.length)
    for (const slide of inventory.slides)
      for (const frame of slide.text)
        if (FIDELITY_IGNORED_CLASSES.includes(frame.class) || FIDELITY_IGNORED_ROLES.includes(frame.role))
          for (const line of frame.plain.split('\n')) decoration.add(loose(normaliseFidelityText(line)));
  for (const k of unused)
    if (!decoration.has(k.source))
      findings.push({
        code: 'fidelity.edit.unmatched',
        family: 'fidelity',
        severity: 'info',
        message: `The deliberate edit for “${k.edit.source}” matches no fidelity finding, so it was not used.`,
        evidence: { source: k.edit.source, ...(k.edit.result !== undefined ? { result: k.edit.result } : {}), reason: k.edit.reason },
        origin: { checker: 'fidelity', id: 'edit.unmatched' },
      });

  const sourceCount = inventory.slides.length;
  if (sourceCount !== boards.length)
    findings.push({
      code: 'fidelity.slides.count',
      family: 'fidelity',
      severity: 'warn',
      message: `The source has ${sourceCount} ${sourceCount === 1 ? 'slide' : 'slides'} and the result has ${boards.length} ${boards.length === 1 ? 'artboard' : 'artboards'}.`,
      needs: 'review',
      evidence: { source: sourceCount, result: boards.length },
      origin: { checker: 'fidelity', id: 'slides.count' },
    });
  const positions = mapping.map((id) => (id === null ? -1 : boards.findIndex((b) => b.id === id))).filter((i) => i >= 0);
  const outOfOrder = positions.findIndex((p, i) => i > 0 && p < positions[i - 1]!);
  if (outOfOrder > 0)
    findings.push({
      code: 'fidelity.slides.order',
      family: 'fidelity',
      severity: 'warn',
      message: 'The result shows the source slides in a different order.',
      needs: 'review',
      evidence: { order: mapping.map((id) => id ?? '-').join(',') },
      origin: { checker: 'fidelity', id: 'slides.order' },
    });

  const sourceRead = FIDELITY_MAX_SOURCE_STRINGS - sourceBudget;
  const cut = sourceRead < sourceTotal || result.read < result.lines;
  const stopped = work.left <= 0;
  const complete = !cut && !stopped;
  if (!complete)
    findings.push({
      code: 'fidelity.coverage.partial',
      family: 'fidelity',
      severity: 'warn',
      message:
        (cut
          ? `Fidelity compared ${sourceRead} of ${sourceTotal} source strings with ${result.read} of ${result.lines} result lines; the rest were not compared.`
          : `Fidelity compared all ${sourceTotal} source strings with all ${result.lines} result lines.`) +
        (stopped ? ' The search reached its work limit before the end, so some strings reported missing may be there.' : ''),
      needs: 'unknown',
      evidence: {
        sourceStrings: sourceTotal,
        sourceCompared: sourceRead,
        resultLines: result.lines,
        resultCompared: result.read,
        stopped,
      },
      origin: { checker: 'fidelity', id: 'coverage.partial' },
    });

  return {
    fidelity: {
      slides: { source: sourceCount, result: boards.length },
      missingStrings,
      editedStrings,
      notes: { carried: carriedNotes, missing: missingNotes },
      ...(opts.edits ? { excepted } : {}),
    },
    findings,
    mapping,
    complete,
  };
}

function boardIndex(boxes: unknown, id: string): number {
  return Array.isArray(boxes) ? boxes.findIndex((row) => record(row) && row.kind === 'frame' && row.id === id) : -1;
}
