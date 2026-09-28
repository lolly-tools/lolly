// SPDX-License-Identifier: MPL-2.0
/** Shared line selection. Settled lines are reshaped with their actual line context. */
import type { TextRangeV1, TextStoryV1 } from '@lolly-tools/core';
import { textBreakOpportunities } from './text-unicode.ts';
import { textSemanticSource } from './text-semantic.ts';
import { textBoundaries } from './text-source.ts';
import { textHyphenator } from './text-hyphenation.ts';
import { chooseParagraphBreaks, paragraphLineFit, type TextBreakCandidate } from './text-line-policy.ts';
import { textSpaceWidth } from './text-spacing.ts';
import type { prepareTextParagraph, ShapedTextLine } from './text-paragraph.ts';
type Prepared = Awaited<ReturnType<typeof prepareTextParagraph>>;
/** An accessor that can also read without copying (text-composition-cache.ts). */
type SharedRead<F> = F & { shared?: F };
export interface TextLineNotice extends TextRangeV1 { code: string; message: string }
/** Unicode word units for short-line preferences, independent of platform segmentation. */
function wordCount(source: string): number {
  return (source.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]|[\p{L}\p{N}][\p{L}\p{M}\p{N}'’]*/gu) ?? []).length;
}
/** Explicit source breaks partition the graph, so optimisation never removes a forced line. */
export async function composeParagraphLines(story: TextStoryV1, range: TextRangeV1, prepared: Prepared, width: (line: number) => number) {
  const result: ShapedTextLine[] = [], diagnostics: TextLineNotice[] = [], resources: Array<{ id: string; sha256: string }> = [];
  const inlineMeaning=new Map(story.inlines.map(inline=>[inline.offset,inline.originalText]));
  // Read shapes without copying where the workspace allows it: nothing below mutates a
  // shaped line, and the lines this function returns are copied on the way out, so a
  // caller still never holds the cache's own objects.
  const sharedShape = (prepared.shape as SharedRead<Prepared['shape']>).shared;
  const readShape = sharedShape ?? prepared.shape;
  const readHyphen = sharedShape && (prepared.hyphen as SharedRead<Prepared['hyphen']>).shared || prepared.hyphen;
  const keep = (line: ShapedTextLine): ShapedTextLine => sharedShape ? structuredClone(line) : line;
  const settings = prepared.settings, mode = settings.hyphenation?.mode ?? 'manual';
  const hyphenator = mode === 'auto' ? await textHyphenator(settings.language) : null;
  if (mode === 'auto' && !hyphenator) diagnostics.push({ ...range, code: 'hyphenation-language', message: 'Automatic hyphenation is unavailable for this language. Choose a supported language or use manual hyphens.' });
  if (hyphenator) resources.push({ id: hyphenator.id, sha256: hyphenator.sha256 });
  const thai = /[\u0e01-\u0e3a\u0e40-\u0e4e]/u.test(textSemanticSource(story,range).source) ? await import('./text-thai.ts') : null;
  if (thai) resources.push(thai.TEXT_THAI_RESOURCE);
  const forced = story.breaks.filter(item => item.kind === 'soft' && item.start >= range.start && item.start < range.end);
  const boundaries = textBoundaries(story.source);
  let segmentStart = range.start;
  for (const ending of [...forced.map(item => ({ end: item.start, next: item.start + item.length })), { end: range.end, next: range.end }]) {
    const probe = await readShape({ start: segmentStart, end: ending.end }, false, false);
    const advances = probe.pieces.flatMap(piece => piece.shape ? piece.shape.clusters.map(cluster => ({ start: cluster.start, end: cluster.end, advance: cluster.advance, carets: cluster.carets, x: cluster.x, rtl: piece.shape!.direction === 'rtl' }))
      : [{ start: piece.start, end: piece.end, advance: piece.advance, carets: [], x: 0, rtl: false }]).sort((a,b) => a.start-b.start);
    const prefix = new Map<number, number>([[segmentStart, 0]]), spacePrefix = new Map<number, number>([[segmentStart, 0]]); let sum = 0, spaceSum = 0;
    for (const cluster of advances) {
      prefix.set(cluster.start, sum);
      spacePrefix.set(cluster.start, spaceSum);
      for (const caret of cluster.carets) prefix.set(caret.offset, sum + (cluster.rtl ? cluster.advance - (caret.x - cluster.x) : caret.x - cluster.x));
      sum += cluster.advance; prefix.set(cluster.end, sum);
      if (/^[ \u00a0\u202f]+$/u.test((inlineMeaning.get(cluster.start)??story.source.slice(cluster.start, cluster.end)))) spaceSum += cluster.advance;
      spacePrefix.set(cluster.end, spaceSum);
    }
    const offsets = new Map<number, boolean>();
    const semantic=textSemanticSource(story,{start:segmentStart,end:ending.end});
    const opportunities = textBreakOpportunities(semantic.source);
    if (thai) for (const offset of thai.thaiTextBreaks(semantic.source)) opportunities.push({offset,required:false});
    for (const item of opportunities) {
      const at = semantic.backward.get(item.offset);if(at===undefined)continue;const shy = story.source[at-1] === '\u00ad';
      if (!shy || mode !== 'off') offsets.set(at, shy);
    }
    if (hyphenator) for (const word of semantic.source.matchAll(/[\p{L}\p{M}]+/gu)) {
      if (word[0].length < (settings.hyphenation?.minWord ?? 6)) continue;
      for (const at of hyphenator.points(word[0], settings.hyphenation?.minBefore ?? 2, settings.hyphenation?.minAfter ?? 3)) {const sourceAt=semantic.backward.get(word.index+at);if(sourceAt!==undefined)offsets.set(sourceAt,true);}
    }
    offsets.set(ending.end, false); offsets.delete(segmentStart);
    const candidates: TextBreakCandidate[] = [{ at: segmentStart, hyphen: false, hyphenWidth: 0 }];
    for (const [at, hyphen] of [...offsets].sort((a,b) => a[0]-b[0])) {
      if (!boundaries.has(at) || at !== ending.end && story.spans.some(span => span.noBreak && span.start < at && span.end > at)) continue;
      candidates.push({ at, hyphen, hyphenWidth: hyphen ? (await readHyphen(at)).shape.advance : 0 });
    }
    // A line's measured end drops its trailing spaces, never past the line's start.
    // Each candidate's trimmed end is found once, against the segment start, and the
    // line start is applied as a floor: the same answer the per-call scan gave, which
    // ran three times for every candidate pair the break search priced.
    const trimmedEnd = candidates.map(candidate => {
      let end = candidate.at;
      while (end > segmentStart && /^[ \t\u200b]+$/.test(inlineMeaning.get(end-1)??story.source[end-1]!)) end--;
      return end;
    });
    const measuredEnd = (a: number, b: number): number => Math.max(candidates[a]!.at, trimmedEnd[b]!);
    const measure = (a: number, b: number): number => (prefix.get(measuredEnd(a,b)) ?? Infinity) - (prefix.get(candidates[a]!.at) ?? 0) + candidates[b]!.hyphenWidth;
    const spaces = (a: number, b: number): number => (spacePrefix.get(measuredEnd(a,b)) ?? 0) - (spacePrefix.get(candidates[a]!.at) ?? 0);
    const segmentSettings = ending.next > ending.end ? { ...settings, shortLastLine: { enabled: false, words: 2, fraction: .2 } } : settings;
    const fitGraph = { candidates, settings: segmentSettings, measure, spaces };
    const fits = (a: number, b: number, available: number, line?: ShapedTextLine) => paragraphLineFit(line
      ? { ...fitGraph, measure: () => line.advance, spaces: () => textSpaceWidth(line, story.source) } : fitGraph, a, b, available).fits;
    const settledGreedy = new Map<string,ShapedTextLine>();
    const shape = async (a: number, b: number): Promise<ShapedTextLine> => {
      const held=settledGreedy.get(`${a}:${b}`);if(held)return held;
      const candidate = candidates[b]!, line = await readShape({ start: candidates[a]!.at, end: candidate.at });
      return candidate.hyphen ? { ...line, advance: line.advance + candidate.hyphenWidth, hyphen: await readHyphen(candidate.at) } : line;
    };
    const firstLine = result.length, greedy: number[] = []; let start = 0, consecutive = 0;
    while (start < candidates.length - 1) {
      const available = width(firstLine + greedy.length); let chosen = start + 1;
      for (let end = start + 1; end < candidates.length; end++) {
        if (!fits(start, end, available) && end > start + 1) break;
        if (!candidates[end]!.hyphen || consecutive < (settings.hyphenation?.consecutive ?? 2)) chosen = end;
      }
      let line = await shape(start, chosen);
      while (chosen > start + 1 && !fits(start, chosen, available, line)) line = await shape(start, --chosen);
      while (chosen + 1 < candidates.length) {
        const next = await shape(start, chosen + 1);
        if (!fits(start, chosen + 1, available, next)) break;
        chosen++; line = next;
      }
      if (candidates[chosen]!.hyphen && consecutive >= (settings.hyphenation?.consecutive ?? 2)) {
        const unbroken = candidates.findIndex((candidate, index) => index > start && !candidate.hyphen);
        if (unbroken > start) chosen = unbroken;
      }
      if(line.start!==candidates[start]!.at||line.end!==candidates[chosen]!.at)line=await shape(start,chosen);
      settledGreedy.set(`${start}:${chosen}`,line);
      consecutive = candidates[chosen]!.hyphen ? consecutive + 1 : 0; greedy.push(chosen); start = chosen;
    }
    const forbidden = new Set<string>(); let selected = greedy, limited = false;
    const graph = { ...fitGraph, width: (index: number) => width(firstLine + index), words: (a: number,b: number) => wordCount(story.source.slice(candidates[a]!.at,candidates[b]!.at)), forbidden };
    for (let attempt = 0; attempt < 3; attempt++) {
      const decision = chooseParagraphBreaks(graph, greedy); selected = decision.ends; limited ||= decision.limited;
      let previous = 0, invalid = false;
      for (const [index, end] of selected.entries()) {
        const line = await shape(previous, end);
        if (!fits(previous, end, width(firstLine + index), line) && end > previous + 1) { forbidden.add(`${previous}:${end}`); invalid = true; }
        previous = end;
      }
      if (!invalid) break;
      if (attempt === 2) { selected = greedy; limited = true; }
    }
    if (limited) diagnostics.push({ start: segmentStart, end: ending.end, code: 'composition-budget', message: 'This paragraph exceeded the composition budget. Standard breaks were used.' });
    let previous = 0;
    if (!selected.length) result.push(keep(await readShape({ start: segmentStart, end: ending.end })));
    for (const end of selected) { result.push(keep(await shape(previous, end))); previous = end; }
    const last = result.at(-1)!;
    if (ending.next === ending.end && settings.shortLastLine?.enabled && selected.length > 1 && !(selected.length === 2 && wordCount(story.source.slice(segmentStart, ending.end)) <= 2)
      && (wordCount(story.source.slice(last.start, ending.end)) < settings.shortLastLine.words || last.advance < width(result.length-1) * settings.shortLastLine.fraction))
      diagnostics.push({ start: last.start, end: ending.end, code: 'short-last-line', message: 'The last line is shorter than the selected preference. A wider frame or different size may help.' });
    if (ending.next > ending.end) result[result.length-1] = { ...last, end: ending.next };
    segmentStart = ending.next;
  }
  return { lines: result, diagnostics, resources };
}
export async function standardTextLines(story: TextStoryV1, range: TextRangeV1, prepared: Prepared, width: (line: number) => number): Promise<ShapedTextLine[]> {
  return (await composeParagraphLines(story, range, prepared, width)).lines;
}
