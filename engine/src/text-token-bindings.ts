// SPDX-License-Identifier: MPL-2.0
/** Paragraph links refresh in the shared runtime before composition or export. */
import type { TextDocumentV1, TextParagraphStyleV1, TextStoryV1, TextRangeV1 } from '@lolly-tools/core';
import type { TokenSet } from './bridge/host-v1.ts';
import { parseTextDocument, serializeTextDocument } from './text-story-document.ts';
import type { BlockTokenBinding } from './token-block-bindings.ts';
import { readBlockTokenBindings, withBlockTokenBinding, reconcileBlockTokenBindings, resolveBlockTokenBindings } from './token-block-bindings.ts';
import type { BlockFieldSpec, InputValue } from './inputs.ts';
import type { TokenValue } from './tokens.ts';
import { textStyleResolver } from './text-styles.ts';
export const PARAGRAPH_TOKEN_FIELDS: BlockFieldSpec[] = [
  { id: 'lineHeight', label: 'Line height', type: 'number', min: .1, max: 20, default: 1.2 },
  ...['spaceBefore', 'spaceAfter', 'indentStart', 'indentEnd', 'firstIndent'].map(id => ({ id, label: ({ spaceBefore: 'Space before', spaceAfter: 'Space after', indentStart: 'Start indent', indentEnd: 'End indent', firstIndent: 'First line indent' } as Record<string, string>)[id], type: 'number', min: id === 'firstIndent' ? -10000 : 0, max: 10000, default: 0 })),
];
export function resolveParagraphTokenBindings(value: TextParagraphStyleV1, set: TokenSet | undefined): TextParagraphStyleV1 {
  const next = resolveBlockTokenBindings([value as InputValue], 'tokenLinks', PARAGRAPH_TOKEN_FIELDS, set)[0];
  return next as TextParagraphStyleV1;
}
export function resolveTextDocumentTokenBindings(raw: string, set: TokenSet | undefined): string {
  // An ordinary document incurs no parse, clone or serialization work.
  if (!raw.includes('"tokenLinks"')) return raw;
  const doc = parseTextDocument(raw);
  let changed = false;
  const settings = (value: TextParagraphStyleV1 | undefined) => {
    if (!value?.tokenLinks) return value;
    const next = resolveParagraphTokenBindings(value, set); changed ||= next !== value; return next;
  };
  const styles = doc.styles.map(style => ({ ...style, ...(style.paragraph ? { paragraph: settings(style.paragraph) } : {}) }));
  const stylesChanged = changed;
  const next: TextDocumentV1 = { ...doc, styles,
    stories: doc.stories.map(story => { const paragraphs = story.paragraphs.map(paragraph => ({ ...paragraph, ...(paragraph.paragraph ? { paragraph: settings(paragraph.paragraph) } : {}) }));
      return { ...story, paragraphs, revision: story.revision + (stylesChanged || paragraphs.some((paragraph, index) => JSON.stringify(paragraph) !== JSON.stringify(story.paragraphs[index])) ? 1 : 0) }; }) };
  return changed ? serializeTextDocument(next) : raw;
}

export function bindParagraphToken(document: TextDocumentV1, story: TextStoryV1, ids: readonly string[], field: string, binding?: TokenValue): TextStoryV1 {
  const spec = PARAGRAPH_TOKEN_FIELDS.find(spec => spec.id === field);
  if (!spec || binding && (typeof binding.value !== 'number' || !Number.isFinite(binding.value) || binding.value < spec.min! || binding.value > spec.max!)) throw new Error('This paragraph token value is unsupported.');
  const resolver = textStyleResolver(document), selected = new Set(ids);
  return { ...story, revision: story.revision + 1, paragraphs: story.paragraphs.map(paragraph => {
    if (!selected.has(paragraph.id)) return paragraph;
    const effective = resolver.paragraph(story, paragraph), raw = effective[field as keyof TextParagraphStyleV1];
    const literal = typeof raw === 'number' ? raw : Number(spec.default ?? 0);
    const links = readBlockTokenBindings(paragraph.paragraph?.tokenLinks), inherited = readBlockTokenBindings(effective.tokenLinks)[field];
    if (!binding && !inherited) return paragraph;
    if (!links[field] && inherited) links[field] = inherited;
    const row = withBlockTokenBinding({ [field]: literal, tokenLinks: JSON.stringify(links) }, 'tokenLinks', field, binding ?? literal, field === 'lineHeight' ? 'ratio' : undefined);
    return { ...paragraph, paragraph: { ...paragraph.paragraph, [field]: row[field], tokenLinks: String(row.tokenLinks) } };
  }) };
}
export function paragraphTokenState(document: TextDocumentV1, stories: readonly TextStoryV1[], range?: TextRangeV1) {
  const resolver = textStyleResolver(document);
  const values = stories.flatMap(story => story.paragraphs.filter(p => !range || range.start === range.end ? !range || p.start <= range.start && p.end >= range.start : p.start < range.end && p.end >= range.start).map(p => {
    const effective = resolver.paragraph(story, p);
    return reconcileBlockTokenBindings([effective as InputValue], 'tokenLinks')[0] as TextParagraphStyleV1;
  }));
  const mixed: string[] = [], restoreRefs: Record<string, string> = {}, active: Record<string, BlockTokenBinding> = {};
  for (const field of PARAGRAPH_TOKEN_FIELDS) {
    const links = values.map(value => readBlockTokenBindings(value.tokenLinks)[field.id]);
    const linked = links.find(link => link && !link.custom); if (linked) active[field.id] = linked;
    if (new Set(values.map((value, i) => JSON.stringify([value[field.id as keyof TextParagraphStyleV1] ?? field.default, links[i]]))).size > 1) mixed.push(field.id);
    if (links.length && links.every(link => link?.custom && link.ref === links[0]?.ref)) restoreRefs[field.id] = links[0]!.ref;
  }
  return { paragraph: values[0] ?? {}, mixed, restoreRefs, active, selection: JSON.stringify([stories.map(story => [story.id, story.revision]), range ?? null]) };
}
