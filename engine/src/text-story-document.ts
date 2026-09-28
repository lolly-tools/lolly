// SPDX-License-Identifier: MPL-2.0
/** Text document admission and exact source round trips. */
import { Ajv } from 'ajv';
import schema from '../../schemas/text-document-v1.schema.json' with { type: 'json' };
import type { TextCharacterV1, TextDocumentV1, TextNamedStyleV1, TextParagraphStyleV1, TextStoryV1 } from '@lolly-tools/core';
import { assertTextRange, paragraphRanges, sourceBreaks, textBoundaries, TextSourceError } from './text-source.ts';
import { parseColor } from './css-color.ts';

export const TEXT_DOCUMENT_MAX_BYTES = 8 * 1024 * 1024;
const validate = new Ajv({ allErrors: false, strict: true, ownProperties: true }).compile<TextDocumentV1>(schema);
const error = (code: string, message: string): never => { throw new TextSourceError(code, message); };
function unique<T>(items: readonly T[], id: (item: T) => string, label: string): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of items) { const key = id(item); if (map.has(key)) error('duplicate-id', `Duplicate ${label} id: ${key}`); map.set(key, item); }
  return map;
}
function reference(map: ReadonlyMap<string, unknown>, id: string | undefined, label: string): void {
  if (id !== undefined && !map.has(id)) error('missing-reference', `Missing ${label}: ${id}`);
}
function checkCharacter(value: TextCharacterV1 | undefined, fonts: ReadonlyMap<string, unknown>): void {
  if (value?.color !== undefined && !parseColor(value.color)) error('text-color', 'Text colour must be an explicit supported colour.');
  reference(fonts, value?.font, 'font');
  for (const font of value?.fallbackFonts ?? []) reference(fonts, font, 'fallback font');
}
function checkParagraph(value: TextParagraphStyleV1 | undefined, fonts: ReadonlyMap<string, unknown>): void {
  checkCharacter(value?.character, fonts);
  for (const rule of [value?.ruleBefore, value?.ruleAfter]) if (rule && !parseColor(rule.color)) error('text-color', 'A paragraph rule needs an explicit supported colour.');
  const spacing = value?.wordSpacing;
  if (spacing && !(spacing.min <= spacing.ideal && spacing.ideal <= spacing.max)) error('word-spacing', 'Word spacing must increase from minimum to ideal to maximum.');
  let previous = -1;
  for (const tab of value?.tabs ?? []) {
    if (tab.position <= previous) error('tab-order', 'Tab stops must have distinct increasing positions.');
    previous = tab.position;
  }
}
function checkStyleRef(styles: ReadonlyMap<string, TextNamedStyleV1>, id: string | undefined, kind: TextNamedStyleV1['kind']): void {
  reference(styles, id, 'text style');
  if (id && styles.get(id)?.kind !== kind) error('style-kind', `Expected a ${kind} style: ${id}`);
}
function checkStory(story: TextStoryV1, styles: ReadonlyMap<string, TextNamedStyleV1>, fonts: ReadonlyMap<string, unknown>, frames: Set<string>): void {
  const boundaries = textBoundaries(story.source);
  const expectedBreaks = sourceBreaks(story.source);
  if (expectedBreaks.length !== story.breaks.length || expectedBreaks.some((item, index) => item.start !== story.breaks[index]!.start || item.length !== story.breaks[index]!.length)) {
    error('break-source', 'Every source separator must have exactly one ordered break record.');
  }
  for (const item of story.breaks) {
    const separator = story.source.slice(item.start, item.start + item.length);
    if (separator === '\u2028' && item.kind !== 'soft' || separator === '\u2029' && item.kind !== 'paragraph') error('break-kind', 'Unicode line and paragraph separators must retain their meaning.');
  }
  const ranges = paragraphRanges(story.source, story.breaks);
  if (ranges.length !== story.paragraphs.length) error('paragraph-source', 'Paragraphs must cover the complete story.');
  unique(story.paragraphs, paragraph => paragraph.id, 'paragraph');
  checkStyleRef(styles, story.defaultStyle, 'paragraph');
  for (const [index, paragraph] of story.paragraphs.entries()) {
    const expected = ranges[index]!;
    if (paragraph.start !== expected.start || paragraph.end !== expected.end) error('paragraph-source', 'Paragraph boundaries must match the source breaks.');
    assertTextRange(story.source, paragraph, boundaries);
    checkStyleRef(styles, paragraph.style, 'paragraph');
    checkParagraph(paragraph.paragraph, fonts);
  }
  let spanEnd = 0;
  for (const span of story.spans) {
    assertTextRange(story.source, span, boundaries);
    if (span.start < spanEnd || span.start === span.end) error('span-order', 'Text spans must be nonempty, ordered and nonoverlapping.');
    spanEnd = span.end;
    checkStyleRef(styles, span.style, 'character');
    checkCharacter(span.character, fonts);
  }
  unique(story.inlines, inline => inline.id, 'inline object');
  const offsets = new Set<number>();
  for (const inline of story.inlines) {
    if (!boundaries.has(inline.offset) || story.source[inline.offset] !== '\ufffc' || offsets.has(inline.offset)) error('inline-source', 'Each inline object needs its own complete source placeholder.');
    offsets.add(inline.offset);
    textBoundaries(inline.originalText);
  }
  for (let i = 0; i < story.source.length; i++) if (story.source[i] === '\ufffc' && !offsets.has(i)) error('inline-source', 'An inline source placeholder is missing its object.');
  for (const frame of story.frameIds) {
    if (frames.has(frame)) error('frame-owner', `A text frame belongs to more than one story: ${frame}`);
    frames.add(frame);
  }
}
/** Validate before cloning. There is no normalization or fallback to an empty document. */
export function parseTextDocument(input: unknown): TextDocumentV1 {
  let json: string, value: unknown;
  try { json = typeof input === 'string' ? input : JSON.stringify(input); }
  catch { return error('document-json', 'The text document must be finite JSON.'); }
  // UTF-8 spends at most 3 bytes per UTF-16 unit, so a string under a third of the
  // budget is inside it without encoding: composition parses the whole document once
  // per story, and the encode alone was over a third of each parse.
  if (typeof json !== 'string' || json.length * 3 > TEXT_DOCUMENT_MAX_BYTES && new TextEncoder().encode(json).byteLength > TEXT_DOCUMENT_MAX_BYTES) return error('document-size', 'The text document exceeds the supported size.');
  try { value = typeof input === 'string' ? JSON.parse(json) : input; }
  catch { return error('document-json', 'The text document is not valid JSON.'); }
  if (!validate(value)) return error('document-schema', `Invalid text document at ${validate.errors?.[0]?.instancePath || '/'}: ${validate.errors?.[0]?.message ?? 'schema mismatch'}`);
  const doc = value;
  unique(doc.stories, story => story.id, 'story');
  const styles = unique(doc.styles, style => style.id, 'style');
  const fonts = unique(doc.fonts, font => font.id, 'font');
  for (const font of doc.fonts) if (font.source.kind === 'bundled') {
    let decoded: string;
    try { decoded = decodeURIComponent(font.source.path); } catch { return error('font-source', 'Invalid bundled font path.'); }
    if (decoded.includes('\\') || decoded.includes('?') || decoded.includes('#') || decoded.split('/').some(part => part === '.' || part === '..') || [...decoded].some(character => character.charCodeAt(0) < 32)) error('font-source', 'A bundled font must remain inside its published asset root.');
  }
  for (const style of doc.styles) {
    checkStyleRef(styles, style.basedOn, style.kind);
    checkStyleRef(styles, style.next, 'paragraph');
    if (style.kind === 'character' && (style.paragraph || style.next)) error('style-kind', 'Character styles cannot define paragraph behavior.');
    checkCharacter(style.character, fonts); checkParagraph(style.paragraph, fonts);
    const seen = new Set<string>(); let parent: TextNamedStyleV1 | undefined = style;
    while (parent) {
      if (seen.has(parent.id) || seen.size >= 32) error('style-cycle', 'Style inheritance must be acyclic and no deeper than 32 styles.');
      seen.add(parent.id); parent = parent.basedOn ? styles.get(parent.basedOn) : undefined;
    }
  }
  const frames = new Set<string>();
  for (const story of doc.stories) checkStory(story, styles, fonts, frames);
  return structuredClone(doc);
}
export function serializeTextDocument(doc: TextDocumentV1): string { return JSON.stringify(parseTextDocument(doc)); }
export function createTextStory(id: string, source: string, paragraphId: (index: number) => string, newline: 'paragraph' | 'soft' = 'paragraph'): TextStoryV1 {
  const breaks = sourceBreaks(source, newline);
  return { version: 1, id, revision: 0, source, breaks, spans: [], inlines: [], frameIds: [], paragraphs: paragraphRanges(source, breaks).map((range, i) => ({ ...range, id: paragraphId(i) })) };
}
