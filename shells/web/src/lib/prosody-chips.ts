// SPDX-License-Identifier: MPL-2.0
/**
 * prosody-chips.ts - the chip bar and the Tips copy for expressive speech
 * (plans/181 sections 3 and 11), shared by the transcript panel's Edit script
 * mode and the Script audio studio so both surfaces teach one set.
 *
 * The set is what the Phase 0 listening matrix measured on 2026-09-03, not what
 * the plan guessed up front. ALL CAPS is out because it was a complete no-op
 * (identical phonemes, identical audio); the rising-intonation arrow is out
 * because eSpeak reads it aloud as "up right arrow"; and nothing here ever
 * inserts round brackets.
 *
 * Pure data plus t() copy - no DOM, so each surface builds its own buttons -
 * and one tokenizer for the bracket marks, which the panel's restyler uses to
 * wrap each mark in its own span. The tokenizer's grammar mirrors MARK_RE in
 * engine/src/speech-text.ts; prosody-chips.test.ts feeds every chip through the
 * engine's own parseScriptMarks so the two cannot drift apart unnoticed.
 */

import { t } from '../i18n.ts';

/** The em dash, written as an escape so a glyph sweep never reads it as prose. */
const EM_DASH = '\u2014';

/** One button on the chip bar. */
export interface ProsodyChip {
  /** Stable id - both surfaces key their buttons off it, never off the label. */
  id: string;
  /** The button face: the mark itself, or a short verb. */
  label: string;
  /** One line saying what it does, for the tooltip and the accessible name. */
  title: string;
  /** The text the chip puts into the script at the caret. */
  insert: string;
  /**
   * True when the chip attaches to a WORD (the selected one, or the one before
   * the caret) instead of inserting at the caret. Only "Say it as" does.
   */
  wrapsWord?: boolean;
  /**
   * Where the caret should end up afterwards, as a character offset into the
   * inserted text. Absent means the end of it.
   */
  caret?: number;
}

/**
 * The decided chip set (plan section 11): four terminal marks, three
 * mid-sentence beats, and the four bracket marks. Order is the bar's order.
 */
export function prosodyChips(): ProsodyChip[] {
  return [
    { id: 'bang', label: '!', title: t('End with energy'), insert: '!' },
    { id: 'bangbang', label: '!!', title: t('End with more energy'), insert: '!!' },
    { id: 'bangq', label: '!?', title: t('End in disbelief'), insert: '!?' },
    { id: 'question', label: '?', title: t('Ask it'), insert: '?' },
    { id: 'ellipsis', label: '…', title: t('Trail off softly'), insert: '…' },
    { id: 'emdash', label: EM_DASH, title: t('A beat mid-sentence'), insert: ` ${EM_DASH} ` },
    { id: 'comma', label: ',', title: t('A short breath'), insert: ', ' },
    { id: 'pause', label: t('Pause'), title: t('Silence before the next sentence'), insert: '[pause] ' },
    { id: 'slow', label: t('Slow'), title: t('Read this sentence slower'), insert: '[slow] ' },
    { id: 'fast', label: t('Fast'), title: t('Read this sentence faster'), insert: '[fast] ' },
    {
      id: 'say', label: t('Say it as…'), title: t('Spell one word out in phonemes'),
      insert: '', wrapsWord: true,
    },
  ];
}

/** Wrap one word in the pronunciation mark, `[word](/ipa/)`. */
export function sayItAs(word: string, ipa = ''): string {
  return `[${word}](/${ipa}/)`;
}

/** One line of the Tips popover: what the technique does, plus an example. */
export interface ProsodyTip {
  id: string;
  text: string;
  example: string;
}

/**
 * The Tips copy. Every line reports what the Phase 0 matrix actually measured:
 * the terminal marks change the read without promising a pitch rise the
 * measurement could not resolve; slow and fast are named as the big levers
 * because they were the only ones with a large monotone effect; ALL CAPS is
 * named as a no-op; and the split-here advice is about pacing, not loudness,
 * because level came out flat across every line and variant.
 */
export function prosodyTips(): ProsodyTip[] {
  return [
    {
      id: 'terminal',
      text: t('The mark at the end sets the mood: a full stop is neutral, ! is energy, ? is a question, … trails off, !? is disbelief.'),
      example: 'That worked!',
    },
    {
      id: 'split',
      text: t('Press Enter to end a breath group. Each sentence is read on its own, so a short one paces the read.'),
      example: 'No way.\nIt shipped.',
    },
    {
      id: 'beats',
      text: t('For a beat in the middle of a sentence, use an em dash, a semicolon or a colon. A comma is the short breath.'),
      example: `We shipped it ${EM_DASH} all of it.`,
    },
    {
      id: 'pause',
      text: t('[pause] puts silence before the next sentence. Add a number for the seconds, and a small one runs two sentences together.'),
      // Not the bare default's own number: a [pause] written with exactly that
      // many seconds is re-serialised as the shorthand, so the example would
      // not survive being saved and read back.
      example: 'Ready. [pause 2] Go.',
    },
    {
      id: 'speed',
      text: t('[slow] and [fast] change the pace of the sentence they sit in. These are the biggest levers you have.'),
      example: '[slow] Read this part carefully.',
    },
    {
      id: 'say',
      text: t('[word](/ipa/) says one word your way, and the word itself still shows in the transcript.'),
      example: '[Rancher](/ɹˈantʃɚ/) ships today.',
    },
    {
      id: 'caps',
      text: t('ALL CAPS does nothing at all. An acronym the voice cannot pronounce is spelled out letter by letter whatever its case, so write it as separate letters if that is what you want.'),
      example: 'X K C D',
    },
    {
      id: 'numbers',
      text: t('Numbers and money are read as words before anything is spoken, and the transcript shows what was said.'),
      example: '$45 is read as 45 dollars',
    },
  ];
}

/** One piece of a script line: ordinary text, or one of the bracket marks. */
export interface MarkToken {
  kind: 'text' | 'pause' | 'speed' | 'say';
  /** The exact source text of this piece. */
  text: string;
  /** Half-open character range in the line this piece came from. */
  start: number;
  end: number;
  /** For a `say` mark: the word that is spoken, and the phonemes for it. */
  word?: string;
  ipa?: string;
  /** For a `pause` mark: the seconds asked for, or undefined for the default. */
  seconds?: number;
  /** For a `speed` mark: 'slow', 'fast', or the number in `[speed N]`. */
  rate?: 'slow' | 'fast' | number;
}

/**
 * The bracket grammar, mirroring MARK_RE in engine/src/speech-text.ts: the
 * pronunciation form first, so `[pause](/pɔːz/)` reads as a pronunciation
 * rather than a pause mark.
 */
const MARK_RE =
  /\[([^\][\n]+)\]\(\s*\/([^/)\n]*)\/\s*\)|\[\s*pause(?:\s+([0-9]*\.?[0-9]+))?\s*\]|\[\s*(slow|fast)\s*\]|\[\s*speed\s+([0-9]*\.?[0-9]+)\s*\]/gi;

/**
 * Split one script line into text runs and marks, in order and covering every
 * character, so the caller can rebuild the line by concatenating `text`. This
 * is what the panel's restyler walks to wrap each mark in its own span, and
 * what a click on a mark reads to know which control to offer.
 */
export function tokenizeMarks(line: string): MarkToken[] {
  const out: MarkToken[] = [];
  let prev = 0;
  const pushText = (end: number): void => {
    if (end > prev) out.push({ kind: 'text', text: line.slice(prev, end), start: prev, end });
  };
  for (const m of line.matchAll(MARK_RE)) {
    const at = m.index;
    pushText(at);
    prev = at + m[0].length;
    const base = { text: m[0], start: at, end: prev };
    if (m[1] !== undefined) out.push({ ...base, kind: 'say', word: m[1], ipa: m[2] ?? '' });
    else if (m[4] !== undefined) out.push({ ...base, kind: 'speed', rate: m[4].toLowerCase() as 'slow' | 'fast' });
    else if (m[5] !== undefined) out.push({ ...base, kind: 'speed', rate: Number(m[5]) });
    else out.push({ ...base, kind: 'pause', seconds: m[3] === undefined ? undefined : Number(m[3]) });
  }
  pushText(line.length);
  return out;
}

/** True when this line holds at least one bracket mark. */
export function hasMarks(line: string): boolean {
  return tokenizeMarks(line).some((tok) => tok.kind !== 'text');
}
