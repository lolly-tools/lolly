// SPDX-License-Identifier: MPL-2.0
/** Pinned Unicode 17.0 extended grapheme segmentation and mixed emoji/text spans. */
import data from './emoji-data/text-17.0.json' with { type: 'json' };
import { lookupEmojiSequence, usesTextPresentation } from './emoji-sequence.ts';

export const EMOJI_TEXT_MAX_UNITS = 65536;
export interface EmojiTextSpan { kind: 'text' | 'emoji' | 'unsupported'; text: string; start: number; end: number }
type Range = readonly (number | string)[];
function property(point: number, table: readonly Range[], fallback = ''): string {
  let low = 0, high = table.length - 1;
  while (low <= high) {
    const mid = (low + high) >>> 1, range = table[mid]!;
    if (point < (range[0] as number)) high = mid - 1;
    else if (point > (range[1] as number)) low = mid + 1;
    else return range[2] as string;
  }
  return fallback;
}
const control = (value: string): boolean => value === 'Control' || value === 'CR' || value === 'LF';
const keycapBase = (point: number): boolean => point === 0x23 || point === 0x2a || (point >= 0x30 && point <= 0x39);

/** UTF-16 offsets, with no normalization or ICU dependence. Unpaired surrogates are rejected. */
export function emojiGraphemes(text: string): { text: string; start: number; end: number }[] {
  if (text.length > EMOJI_TEXT_MAX_UNITS) throw new Error('Emoji text exceeds the supported length.');
  const result: { text: string; start: number; end: number }[] = [];
  let offset = 0, start = 0, previous = '', regionalCount = 0;
  let epExtend = false, previousZwjAfterEp = false, conjunct = 0;
  for (const char of text) {
    const point = char.codePointAt(0)!;
    if (point >= 0xd800 && point <= 0xdfff) throw new Error('Emoji text contains an unpaired surrogate.');
    const current = property(point, data.grapheme, 'Other');
    const incb = property(point, data.conjunct);
    const ep = property(point, data.pictographic) === 'EP';
    let joined = offset === 0;
    if (offset > 0) {
      if (previous === 'CR' && current === 'LF') joined = true;
      else if (control(previous) || control(current)) joined = false;
      else if (previous === 'L' && ['L', 'V', 'LV', 'LVT'].includes(current)) joined = true;
      else if (['LV', 'V'].includes(previous) && ['V', 'T'].includes(current)) joined = true;
      else if (['LVT', 'T'].includes(previous) && current === 'T') joined = true;
      else if (['Extend', 'ZWJ', 'SpacingMark'].includes(current) || previous === 'Prepend') joined = true;
      else if (incb === 'Consonant' && conjunct === 2) joined = true;
      else if (ep && previous === 'ZWJ' && previousZwjAfterEp) joined = true;
      else if (current === 'Regional_Indicator' && previous === 'Regional_Indicator' && regionalCount % 2 === 1) joined = true;
    }
    if (!joined) { result.push({ text: text.slice(start, offset), start, end: offset }); start = offset; }
    previousZwjAfterEp = current === 'ZWJ' && epExtend;
    epExtend = ep || (current === 'Extend' && epExtend);
    if (incb === 'Consonant') conjunct = 1;
    else if (incb === 'Linker' && conjunct > 0) conjunct = 2;
    else if (incb !== 'Extend') conjunct = 0;
    regionalCount = current === 'Regional_Indicator' ? regionalCount + 1 : 0;
    previous = current;
    offset += char.length;
  }
  if (offset > 0) result.push({ text: text.slice(start), start, end: offset });
  return result;
}

/** A conservative first-line guard. RTL and bidi controls require a later paragraph compiler. */
export function requiresEmojiBidiLayout(text: string): boolean {
  for (const char of text) if (property(char.codePointAt(0)!, data.bidi)) return true;
  return false;
}

/**
 * Whether the pass would draw anything for this text. A bare copyright sign, warning
 * sign or arrow stays text, so it asks for no set. Text the segmenter refuses says
 * yes, and the pass then decides node by node.
 */
export function textHoldsEmoji(text: string): boolean {
  try { return segmentEmojiText(text).some(span => span.kind !== 'text'); } catch { return true; }
}

export function segmentEmojiText(text: string): EmojiTextSpan[] {
  const result: EmojiTextSpan[] = [];
  for (const cluster of emojiGraphemes(text)) {
    const sequence = lookupEmojiSequence(cluster.text);
    let kind: EmojiTextSpan['kind'] = 'text';
    if (!usesTextPresentation(cluster.text)) {
      if (sequence) kind = 'emoji';
      else {
        const points = Array.from(cluster.text, char => char.codePointAt(0)!);
        // Bare digits/#/* are text. A broken keycap or selector request is still unresolved.
        if (points.some(point => property(point, data.pictographic) || (property(point, data.emoji) && !keycapBase(point)))
          || points.includes(0xfe0f) || points.includes(0x20e3)) kind = 'unsupported';
      }
    }
    const previous = result.at(-1);
    if (kind === 'text' && previous?.kind === 'text') { previous.text += cluster.text; previous.end = cluster.end; }
    else result.push({ ...cluster, kind });
  }
  return result;
}
