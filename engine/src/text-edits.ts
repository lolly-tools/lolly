// SPDX-License-Identifier: MPL-2.0
/** Immutable story commands. All logical offsets are UTF-16 grapheme boundaries. */
import { emojiGraphemes } from './emoji-segment.ts';
import { reconcileBlockTokenBindings } from './token-block-bindings.ts';
import type { InputValue } from './inputs.ts';
import type { TextBreakV1, TextCharacterV1, TextInlineV1, TextParagraphStyleV1, TextParagraphV1, TextRangeV1, TextSpanV1, TextStoryV1 } from '@lolly-tools/core';
import { assertTextRange, paragraphRanges, snapTextRange, sourceBreaks, TextSourceError } from './text-source.ts';

type SpanStyle = Omit<TextSpanV1, 'start' | 'end'>;
const spanStyle = ({ start: _start, end: _end, ...style }: TextSpanV1): SpanStyle => style;
const sameStyle = (a: SpanStyle, b: SpanStyle): boolean => JSON.stringify(a) === JSON.stringify(b);
/** First source character owns the style when an edit joins two graphemes. */
export function normalizeTextSpans(source: string, candidates: readonly TextSpanV1[]): TextSpanV1[] {
  const result: TextSpanV1[] = []; let index = 0;
  for (const cluster of emojiGraphemes(source)) {
    while (index < candidates.length && candidates[index]!.end <= cluster.start) index++;
    const candidate = candidates[index];
    if (!candidate || candidate.start > cluster.start) continue;
    const style = spanStyle(candidate);
    if (!Object.keys(style).length) continue;
    const previous = result.at(-1);
    if (previous && previous.end === cluster.start && sameStyle(spanStyle(previous), style)) previous.end = cluster.end;
    else result.push({ start: cluster.start, end: cluster.end, ...structuredClone(style) });
  }
  return result;
}
export interface TextInsertion {
  source: string;
  breaks?: TextBreakV1[];
  spans?: TextSpanV1[];
  inlines?: TextInlineV1[];
  /** Resolved settings at relative paragraph starts; imported ids never replace local ids. */
  paragraphs?: Array<{ start: number; paragraph: TextParagraphStyleV1 }>;
}
export interface StoryEditOptions {
  paragraphId(): string;
  newline?: 'paragraph' | 'soft';
  typing?: SpanStyle;
}
export interface StoryEditResult { story: TextStoryV1; selection: TextRangeV1 }
/** Replace a complete logical range. Imported paragraph/character style ids are resolved by the caller. */
export function replaceStoryRange(story: TextStoryV1, range: TextRangeV1, insertion: TextInsertion, options: StoryEditOptions): StoryEditResult {
  assertTextRange(story.source, range);
  assertTextRange(insertion.source, { start: 0, end: insertion.source.length });
  const { start, end } = range, delta = insertion.source.length - (end - start);
  const source = story.source.slice(0, start) + insertion.source + story.source.slice(end);
  assertTextRange(source, { start: 0, end: source.length });
  const insertedBreaks = insertion.breaks ?? sourceBreaks(insertion.source, options.newline);
  const expectedBreaks = sourceBreaks(insertion.source);
  if (insertedBreaks.length !== expectedBreaks.length || expectedBreaks.some((b, i) => b.start !== insertedBreaks[i]!.start || b.length !== insertedBreaks[i]!.length)) {
    throw new TextSourceError('break-source', 'Inserted breaks must match their source separators.');
  }
  const kinds = new Map<number, TextBreakV1['kind']>();
  for (const item of story.breaks) if (item.start < start || item.start >= end) kinds.set(item.start >= end ? item.start + delta : item.start, item.kind);
  for (const item of insertedBreaks) kinds.set(item.start + start, item.kind);
  const breaks = sourceBreaks(source).map(item => ({ ...item, kind: kinds.get(item.start) ?? item.kind }));
  const current = story.paragraphs.find(p => p.start <= start && p.end >= start) ?? story.paragraphs.at(-1)!;
  const surviving = story.paragraphs.flatMap(paragraph => {
    if (paragraph === current) return [{ at: Math.min(paragraph.start, start), paragraph }];
    if (paragraph.start > start && paragraph.start < end) return [];
    return [{ at: paragraph.start >= end ? paragraph.start + delta : paragraph.start, paragraph }];
  }).sort((a, b) => a.at - b.at);
  const used = new Set<string>();
  const paragraphs: TextParagraphV1[] = paragraphRanges(source, breaks).map(bounds => {
    const existing = surviving.find(item => item.at >= bounds.start && item.at <= bounds.end && !used.has(item.paragraph.id))?.paragraph;
    const id = existing?.id ?? options.paragraphId();
    if (used.has(id)) throw new TextSourceError('duplicate-id', 'A paragraph id was reused during the edit.');
    used.add(id);
    const inherited = existing ?? current;
    const imported = insertion.paragraphs?.find(item => item.start + start === bounds.start);
    return { ...structuredClone(inherited), ...bounds, id, ...(imported ? { style: undefined, paragraph: structuredClone(imported.paragraph) } : {}) };
  });
  const candidates: TextSpanV1[] = [];
  for (const span of story.spans) if (span.start < start) candidates.push({ ...span, end: Math.min(start, span.end) });
  const inherited = options.typing ?? (() => {
    const at = start === end ? Math.max(current.start, start - 1) : start;
    const span = story.spans.find(item => item.start <= at && item.end > at);
    return span ? spanStyle(span) : {};
  })();
  const insertedSpans = insertion.spans ?? (insertion.source ? [{ start: 0, end: insertion.source.length, ...inherited }] : []);
  let previousEnd = 0;
  for (const span of insertedSpans) {
    assertTextRange(insertion.source, span);
    if (span.start < previousEnd || span.start === span.end) throw new TextSourceError('span-order', 'Inserted text spans must be ordered and nonoverlapping.');
    previousEnd = span.end;
    candidates.push({ ...span, start: span.start + start, end: span.end + start });
  }
  for (const span of story.spans) if (span.end > end) candidates.push({ ...span, start: Math.max(end, span.start) + delta, end: span.end + delta });
  const inlines = story.inlines.filter(item => item.offset < start || item.offset >= end).map(item => ({ ...item, offset: item.offset >= end ? item.offset + delta : item.offset }));
  inlines.push(...(insertion.inlines ?? []).map(item => ({ ...structuredClone(item), offset: item.offset + start })));
  inlines.sort((a, b) => a.offset - b.offset);
  const next: TextStoryV1 = { ...story, revision: story.revision + 1, source, breaks, paragraphs, spans: normalizeTextSpans(source, candidates), inlines };
  return { story: next, selection: snapTextRange(source, { start: start + insertion.source.length, end: start + insertion.source.length }) };
}
export interface TextSpanPatch { character?: Partial<Record<keyof TextCharacterV1, unknown>> | null; style?: string | null; noBreak?: boolean | null; literal?: boolean | null }
function patchStyle(style: SpanStyle, patch: TextSpanPatch): SpanStyle {
  const next = structuredClone(style);
  if (patch.style === null) delete next.style; else if (patch.style !== undefined) next.style = patch.style;
  if (patch.noBreak === null) delete next.noBreak; else if (patch.noBreak !== undefined) next.noBreak = patch.noBreak;
  if (patch.literal === null) delete next.literal; else if (patch.literal !== undefined) next.literal = patch.literal;
  if (patch.character === null) delete next.character;
  else if (patch.character) {
    const character = { ...next.character } as Record<string, unknown>;
    for (const [key, value] of Object.entries(patch.character)) {
      if (value === null) delete character[key];
      else if (value !== undefined) character[key] = structuredClone(value);
    }
    if (Object.keys(character).length) next.character = character;
    else delete next.character;
  }
  return next;
}
/** Format a selected range; a collapsed typing style belongs to the edit session. */
export function formatStoryRange(story: TextStoryV1, range: TextRangeV1, patch: TextSpanPatch): TextStoryV1 {
  assertTextRange(story.source, range);
  if (range.start === range.end) return story;
  const boundaries = new Set([0, story.source.length, range.start, range.end, ...story.spans.flatMap(span => [span.start, span.end])]);
  const points = [...boundaries].sort((a, b) => a - b), spans: TextSpanV1[] = []; let index = 0;
  for (let i = 1; i < points.length; i++) {
    const start = points[i - 1]!, end = points[i]!;
    while (index < story.spans.length && story.spans[index]!.end <= start) index++;
    const base = story.spans[index];
    let style: SpanStyle = base && base.start <= start ? spanStyle(base) : {};
    if (start >= range.start && end <= range.end) style = patchStyle(style, patch);
    if (Object.keys(style).length) spans.push({ start, end, ...style });
  }
  return { ...story, revision: story.revision + 1, spans: normalizeTextSpans(story.source, spans) };
}
export function storyParagraphIds(story: TextStoryV1, range: TextRangeV1): string[] {
  assertTextRange(story.source, range);
  if (range.start === range.end) return [(story.paragraphs.find(p => p.start <= range.start && p.end >= range.start) ?? story.paragraphs.at(-1)!).id];
  return story.paragraphs.filter(p => p.start < range.end && p.end >= range.start).map(p => p.id);
}
export function formatStoryParagraphs(story: TextStoryV1, ids: readonly string[], patch: Partial<Record<keyof TextParagraphStyleV1, unknown>>): TextStoryV1 {
  const selected = new Set(ids);
  for (const id of selected) if (!story.paragraphs.some(p => p.id === id)) throw new TextSourceError('missing-paragraph', `Missing paragraph: ${id}`);
  return { ...story, revision: story.revision + 1, paragraphs: story.paragraphs.map(paragraph => {
    if (!selected.has(paragraph.id)) return paragraph;
    const settings: Record<string, unknown> = { ...paragraph.paragraph };
    for (const [key, value] of Object.entries(patch)) { if (value === null) delete settings[key]; else if (value !== undefined) settings[key] = structuredClone(value); }
    return { ...paragraph, paragraph: reconcileBlockTokenBindings([settings as InputValue], 'tokenLinks')[0] as TextParagraphStyleV1 };
  }) };
}
