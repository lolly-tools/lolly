// SPDX-License-Identifier: MPL-2.0
/** Style resolution is shared by composition, controls and typed text insertion. */
import type { TextCharacterV1, TextDocumentV1, TextNamedStyleV1, TextParagraphStyleV1, TextParagraphV1, TextStoryV1 } from '@lolly-tools/core';
import { readBlockTokenBindings } from './token-block-bindings.ts';
import { TextSourceError } from './text-source.ts';
export function mergeTextCharacter(base: TextCharacterV1, override: TextCharacterV1 = {}): TextCharacterV1 {
  return { ...base, ...override, ...(base.axes || override.axes ? { axes: { ...base.axes, ...override.axes } } : {}),
    ...(base.features || override.features ? { features: { ...base.features, ...override.features } } : {}) };
}
function mergeParagraph(base: TextParagraphStyleV1, override: TextParagraphStyleV1 = {}): TextParagraphStyleV1 {
  return { ...base, ...override, character: mergeTextCharacter(base.character ?? {}, override.character),
    ...(base.tokenLinks || override.tokenLinks ? { tokenLinks: JSON.stringify({ ...readBlockTokenBindings(base.tokenLinks), ...readBlockTokenBindings(override.tokenLinks) }) } : {}) };
}
export function textStyleResolver(doc: TextDocumentV1) {
  const styles = new Map(doc.styles.map(style => [style.id, style]));
  const resolved = new Map<string, { character: TextCharacterV1; paragraph: TextParagraphStyleV1 }>();
  const paragraphs = new WeakMap<TextParagraphV1, TextParagraphStyleV1>();
  function named(id: string | undefined, seen = new Set<string>()): { character: TextCharacterV1; paragraph: TextParagraphStyleV1 } {
    if (!id) return { character: {}, paragraph: {} };
    const cached = resolved.get(id); if (cached) return cached;
    const style: TextNamedStyleV1 | undefined = styles.get(id);
    if (!style || seen.has(id) || seen.size >= 32) throw new TextSourceError('style-reference', 'Text style inheritance is invalid.');
    seen.add(id);
    const base = named(style.basedOn, seen);
    const paragraph = mergeParagraph(base.paragraph, style.paragraph);
    const character = mergeTextCharacter(mergeTextCharacter(base.character, style.paragraph?.character), style.character);
    const value = { character, paragraph: { ...paragraph, character } }; resolved.set(id, value); return value;
  }
  function paragraph(story: TextStoryV1, item: TextParagraphV1): TextParagraphStyleV1 {
    let result = paragraphs.get(item);
    if (!result) { result = mergeParagraph(mergeParagraph(named(story.defaultStyle).paragraph, named(item.style).paragraph), item.paragraph); paragraphs.set(item, result); }
    return result;
  }
  function character(story: TextStoryV1, item: TextParagraphV1, offset: number): TextCharacterV1 {
    let result = paragraph(story, item).character ?? {};
    let low = 0, high = story.spans.length - 1;
    while (low <= high) { const middle = (low + high) >>> 1; if (story.spans[middle]!.end <= offset) low = middle + 1; else high = middle - 1; }
    const candidate = story.spans[low], span = candidate && candidate.start <= offset ? candidate : undefined;
    if (span) result = mergeTextCharacter(mergeTextCharacter(result, named(span.style).character), span.character);
    return { size: 16, color: '#000000', tracking: 0, baselineShift: 0, ...result };
  }
  return { named, paragraph, character };
}
