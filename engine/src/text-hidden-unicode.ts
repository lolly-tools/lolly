// SPDX-License-Identifier: MPL-2.0
/** Contextual hidden-character inspection shared by detection and text cleanup. */
import { lookupEmojiSequence } from './emoji-sequence.ts';

export interface UnicodeSpan { index: number; length: number }
export interface HiddenUnicode { invisible: UnicodeSpan[]; tags: UnicodeSpan[]; variations: UnicodeSpan[] }
const SHAPING = /[\p{Script=Arabic}\p{Script=Syriac}\p{Script=Devanagari}\p{Script=Bengali}\p{Script=Gurmukhi}\p{Script=Gujarati}\p{Script=Oriya}\p{Script=Tamil}\p{Script=Telugu}\p{Script=Kannada}\p{Script=Malayalam}\p{Script=Sinhala}\p{Script=Myanmar}\p{Script=Khmer}\p{Script=Mongolian}]/u;
const HAN = /\p{Script=Han}/u;
const PICTOGRAPHIC = /\p{Extended_Pictographic}/u;
const MARK = /\p{M}/u;
function previous(text: string, index: number): string {
  if (index <= 0) return '';
  const point = text.charCodeAt(index - 1);
  return text.slice(index - (point >= 0xdc00 && point <= 0xdfff && index > 1 ? 2 : 1), index);
}
function next(text: string, index: number): string {
  return index >= text.length ? '' : String.fromCodePoint(text.codePointAt(index)!);
}

export function inspectHiddenUnicode(text: string): HiddenUnicode {
  const result: HiddenUnicode = { invisible: [], tags: [], variations: [] };
  const flagRanges: UnicodeSpan[] = [];
  for (const match of text.matchAll(/\u{1f3f4}[\u{e0020}-\u{e007e}]{1,31}\u{e007f}/gu)) {
    if (lookupEmojiSequence(match[0])) flagRanges.push({ index: match.index, length: match[0].length });
  }
  let index = 0, flag = 0;
  for (const char of text) {
    const point = char.codePointAt(0)!, before = previous(text, index), after = next(text, index + char.length);
    const span = { index, length: char.length };
    while (flagRanges[flag] && flagRanges[flag]!.index + flagRanges[flag]!.length <= index) flag++;
    const inFlag = flagRanges[flag] && index >= flagRanges[flag]!.index;
    if (point >= 0xe0000 && point <= 0xe007f) {
      if (!inFlag) result.tags.push(span);
    } else if ((point >= 0xfe00 && point <= 0xfe0f) || (point >= 0xe0100 && point <= 0xe01ef)) {
      const emoji = point <= 0xfe0f && (lookupEmojiSequence(before + char) || lookupEmojiSequence(before + char + after));
      if (!HAN.test(before) && !emoji) result.variations.push(span);
    } else if (point === 0x200c || point === 0x200d) {
      let base = before, start = index - before.length;
      // Emoji presentation and skin tone modifiers can precede a joining ZWJ.
      while (/^[\ufe0e\ufe0f\u{1f3fb}-\u{1f3ff}]$/u.test(base)) { base = previous(text, start); start -= base.length; }
      const emoji = point === 0x200d && PICTOGRAPHIC.test(base) && PICTOGRAPHIC.test(after);
      if (!emoji && !(SHAPING.test(before) && SHAPING.test(after))) result.invisible.push(span);
    } else if (point === 0xad) {
      if (!/\p{L}/u.test(before) || !/\p{L}/u.test(after)) result.invisible.push(span);
    } else if (point === 0x34f) {
      if (!MARK.test(before) || !MARK.test(after)) result.invisible.push(span);
    } else if ((point >= 0x180b && point <= 0x180f)) {
      if (!/\p{Script=Mongolian}/u.test(before)) result.invisible.push(span);
    } else if (point === 0x115f || point === 0x1160 || point === 0x3164 || point === 0xffa0) {
      if (!/\p{Script=Hangul}/u.test(before) && !/\p{Script=Hangul}/u.test(after)) result.invisible.push(span);
    } else if (point === 0x200b || point === 0x2060 || (point === 0xfeff && index !== 0) || point === 0x2065
      || (point >= 0xfff0 && point <= 0xfff8) || (point >= 0xfdd0 && point <= 0xfdef)
      || (point & 0xffff) >= 0xfffe || (point >= 0xe0080 && point <= 0xe00ff)) result.invisible.push(span);
    index += char.length;
  }
  return result;
}
