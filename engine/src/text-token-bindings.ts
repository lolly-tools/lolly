// SPDX-License-Identifier: MPL-2.0
/** Paragraph and whole typography links refresh in the shared runtime before composition or export. */
import type { TextCharacterV1, TextDocumentV1, TextFontResourceV1, TextParagraphStyleV1, TextParagraphV1, TextSpanV1, TextStoryV1, TextRangeV1 } from '@lolly-tools/core';
import type { TokenEntry, TokenSet } from './bridge/host-v1.ts';
import { parseTextDocument, serializeTextDocument } from './text-story-document.ts';
import type { BlockTokenBinding } from './token-block-bindings.ts';
import { encodeBindings, readBlockTokenBindings, withBlockTokenBinding, reconcileBlockTokenBindings, resolveBlockTokenBindings } from './token-block-bindings.ts';
import type { BlockFieldSpec, InputValue } from './inputs.ts';
import { aliasPath, isAlias, type TokenValue } from './tokens.ts';
import { textStyleResolver } from './text-styles.ts';
import { resolveTokenBinding, type TokenConsumer } from './token-binding.ts';
import { canonicalJson } from './canonical-json.ts';
import { normalizeTextSpans } from './text-edits.ts';
import { TextSourceError } from './text-source.ts';
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
  // Typography runs after the scalar links, so a separately linked line height detaches the composite.
  const typed = refreshTextTypography(next, set);
  return changed || typed !== next ? serializeTextDocument(typed) : raw;
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

/** Whole typography is one paragraph link whose cached value records the pinned faces. */
export const TEXT_TYPOGRAPHY_LINK = 'typography';
export interface TextTypography { fontFamily: string; fontSize: number; fontWeight: number; letterSpacing: number; lineHeight: number }
export type TextTypographySlant = 'normal' | 'italic';
export interface TextTypographyFace { font: string; fallbackFonts?: string[] }
/** Faces by `family|weight`. Each points at font resources whose bytes the document pins by digest. */
export type TextTypographyFaces = Record<string, Partial<Record<TextTypographySlant, TextTypographyFace>>>;
export interface TextTypographyLink { ref: string; typography: TextTypography }
export interface TextTypographyChange extends TextTypographyLink { faces: TextTypographyFaces; fonts: readonly TextFontResourceV1[] }
type Cached = { faces: TextTypographyFaces; typography: TextTypography };
const MAX_FACE_KEYS = 8;
const FONT_ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;
const PROJECTIONS: Array<[keyof TextTypography, TokenConsumer]> = [
  ['fontFamily', { type: 'text', maxLength: 256 }], ['fontSize', { type: 'number', min: .1, max: 10000 }], ['fontWeight', { type: 'number', min: 1, max: 1000 }],
  ['letterSpacing', { type: 'number', min: -1000, max: 1000 }], ['lineHeight', { type: 'number', min: .1, max: 20 }],
];
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

/** Every projection must fit composed text before any of them is applied. */
export function resolveTextTypography(entry: TokenEntry | undefined): { status: 'linked'; value: TextTypography } | { status: 'unresolved' | 'incompatible'; reason: string } {
  const whole = resolveTokenBinding(entry, { type: 'text', adapter: 'typography' });
  if (whole.status !== 'linked') return { status: whole.status, reason: whole.reason ?? 'The token has no resolved value.' };
  const value: Record<string, string | number> = {};
  for (const [key, consumer] of PROJECTIONS) {
    const result = resolveTokenBinding(entry, { ...consumer, adapter: `typography.${key}` });
    if (result.status !== 'linked' || result.value === undefined) return { status: result.status === 'unresolved' ? 'unresolved' : 'incompatible', reason: result.reason ?? 'The composite property has no resolved value.' };
    value[key] = result.value;
  }
  if (!String(value.fontFamily).trim()) return { status: 'incompatible', reason: 'Composed text needs a named font family.' };
  return { status: 'linked', value: value as unknown as TextTypography };
}
export const textTypographyFaceKey = (family: string, weight: number): string => `${family.trim().toLowerCase()}|${weight}`;
export function textTypographyMissingFace(typography: Pick<TextTypography, 'fontFamily' | 'fontWeight'>, slant: TextTypographySlant): string {
  return `No pinned face for ${typography.fontFamily} at weight ${typography.fontWeight}${slant === 'italic' ? ' italic' : ''} is in this text. Link the token again to pin that face.`;
}

function readFace(value: unknown): TextTypographyFace | undefined {
  if (!record(value) || typeof value.font !== 'string' || !FONT_ID.test(value.font)) return undefined;
  const fallbacks = Array.isArray(value.fallbackFonts) ? value.fallbackFonts : [];
  if (fallbacks.length > 16 || fallbacks.some(id => typeof id !== 'string' || !FONT_ID.test(id))) return undefined;
  return { font: value.font, ...(fallbacks.length ? { fallbackFonts: fallbacks as string[] } : {}) };
}
function readFaces(value: unknown): TextTypographyFaces | null {
  if (!record(value) || Object.keys(value).length > MAX_FACE_KEYS) return null;
  const faces: TextTypographyFaces = {};
  for (const [key, slants] of Object.entries(value)) {
    if (!record(slants) || key.length > 300 || key === '__proto__') return null;
    const entry: TextTypographyFaces[string] = {};
    for (const slant of ['normal', 'italic'] as const) if (slants[slant] !== undefined) { const face = readFace(slants[slant]); if (!face) return null; entry[slant] = face; }
    faces[key] = entry;
  }
  return faces;
}
function readCached(link: BlockTokenBinding | undefined): Cached | null {
  if (!link || typeof link.value !== 'string') return null;
  let value: unknown;
  try { value = JSON.parse(link.value); } catch { return null; }
  if (!record(value) || !record(value.typography)) return null;
  const t = value.typography, faces = readFaces(value.faces);
  if (!faces || typeof t.fontFamily !== 'string' || !PROJECTIONS.slice(1).every(([key]) => typeof t[key] === 'number' && Number.isFinite(t[key]))) return null;
  return { faces, typography: { fontFamily: t.fontFamily, fontSize: t.fontSize as number, fontWeight: t.fontWeight as number, letterSpacing: t.letterSpacing as number, lineHeight: t.lineHeight as number } };
}
const ownLink = (paragraph: TextParagraphV1): BlockTokenBinding | undefined => {
  const link = readBlockTokenBindings(paragraph.paragraph?.tokenLinks)[TEXT_TYPOGRAPHY_LINK];
  return link?.adapter === 'typography' ? link : undefined;
};
const facesOf = (entry: TextTypographyFaces[string] | undefined): string[] => [entry?.normal, entry?.italic].flatMap(face => face ? [face.font, ...face.fallbackFonts ?? []] : []);
const faceFields = (face: TextTypographyFace): TextCharacterV1 => ({ font: face.font, ...(face.fallbackFonts?.length ? { fallbackFonts: face.fallbackFonts } : {}) });
const slantOf = (character: TextCharacterV1 | undefined): TextTypographySlant => character?.italic ? 'italic' : 'normal';

/** One source offset for each run of distinct formatting inside a paragraph. */
function offsets(story: TextStoryV1, paragraph: TextParagraphV1): number[] {
  const points = new Set([paragraph.start]);
  for (const span of story.spans) for (const at of [span.start, span.end]) if (at > paragraph.start && at < paragraph.end) points.add(at);
  return [...points].sort((a, b) => a - b);
}
type Resolver = ReturnType<typeof textStyleResolver>;
function paragraphSlants(resolver: Resolver, story: TextStoryV1, paragraph: TextParagraphV1): Set<TextTypographySlant> {
  return new Set([slantOf(resolver.paragraph(story, paragraph).character), ...offsets(story, paragraph).map(at => slantOf(resolver.character(story, paragraph, at)))]);
}
/** The slants the selected paragraphs draw, so the shell pins only the faces they need. */
export function textTypographySlants(textDocument: TextDocumentV1, story: TextStoryV1, ids: readonly string[]): TextTypographySlant[] {
  const resolver = textStyleResolver(textDocument), selected = new Set(ids), found = new Set<TextTypographySlant>();
  for (const paragraph of story.paragraphs) if (selected.has(paragraph.id)) for (const slant of paragraphSlants(resolver, story, paragraph)) found.add(slant);
  return (['normal', 'italic'] as const).filter(slant => found.has(slant));
}

/**
 * A paragraph edited locally no longer shows the link anywhere, so it becomes custom. A run whose
 * named character style sets a property never showed the link for it, so it is left out.
 */
function editedLocally(resolver: Resolver, story: TextStoryV1, paragraph: TextParagraphV1, cached: Cached): boolean {
  const t = cached.typography, faces = new Set(facesOf(cached.faces[textTypographyFaceKey(t.fontFamily, t.fontWeight)]));
  if (resolver.paragraph(story, paragraph).lineHeight !== t.lineHeight) return true;
  const runs = offsets(story, paragraph).map(at => ({ value: resolver.character(story, paragraph, at), named: resolver.named(story.spans.find(span => span.start <= at && span.end > at)?.style).character }));
  const shown: Array<[keyof TextCharacterV1, (value: TextCharacterV1) => boolean]> = [['size', value => value.size === t.fontSize], ['weight', value => (value.weight ?? 400) === t.fontWeight], ['tracking', value => (value.tracking ?? 0) === t.letterSpacing], ['font', value => !!value.font && faces.has(value.font)]];
  return shown.some(([key, test]) => { const linked = runs.filter(run => run.named[key] === undefined); return linked.length > 0 && !linked.some(run => test(run.value)); });
}

/** Rewrites span formatting inside the given paragraph ranges, splitting spans at their edges. */
function mapSpans(story: TextStoryV1, ranges: ReadonlyArray<TextRangeV1 & { map: (character: TextCharacterV1, span: TextSpanV1) => TextCharacterV1 }>): TextSpanV1[] {
  const pieces: TextSpanV1[] = [];
  for (const span of story.spans) {
    const cuts = [...new Set([span.start, span.end, ...ranges.flatMap(range => [range.start, range.end]).filter(at => at > span.start && at < span.end)])].sort((a, b) => a - b);
    for (let i = 1; i < cuts.length; i++) {
      const piece: TextSpanV1 = { ...structuredClone(span), start: cuts[i - 1]!, end: cuts[i]! }, range = ranges.find(range => piece.start >= range.start && piece.end <= range.end);
      // A span styled only by a named style still needs its slant face.
      if (range) { const character = range.map(piece.character ?? {}, span); if (Object.keys(character).length) piece.character = character; else delete piece.character; }
      pieces.push(piece);
    }
  }
  return normalizeTextSpans(story.source, pieces);
}
function withoutTypography(character: TextCharacterV1): TextCharacterV1 {
  const { font: _font, fallbackFonts: _fallbacks, size: _size, weight: _weight, tracking: _tracking, ...rest } = character;
  if (rest.axes && 'wght' in rest.axes) { const { wght: _wght, ...axes } = rest.axes; if (Object.keys(axes).length) rest.axes = axes; else delete rest.axes; }
  return rest;
}
function linkedParagraph(paragraph: TextParagraphV1, base: TextTypographyFace, typography: TextTypography, link: BlockTokenBinding): TextParagraphV1 {
  const links = readBlockTokenBindings(paragraph.paragraph?.tokenLinks);
  delete links.lineHeight; links[TEXT_TYPOGRAPHY_LINK] = link;
  const character = { ...withoutTypography(paragraph.paragraph?.character ?? {}), ...faceFields(base), size: typography.fontSize, weight: typography.fontWeight, tracking: typography.letterSpacing };
  return { ...paragraph, paragraph: { ...paragraph.paragraph, character, lineHeight: typography.lineHeight, tokenLinks: encodeBindings(links) } };
}
function withLinkState(paragraph: TextParagraphV1, link: BlockTokenBinding): TextParagraphV1 {
  const links = readBlockTokenBindings(paragraph.paragraph?.tokenLinks); links[TEXT_TYPOGRAPHY_LINK] = link;
  return { ...paragraph, paragraph: { ...paragraph.paragraph, tokenLinks: encodeBindings(links) } };
}

/**
 * Link, Make custom or Restore whole typography on the selected paragraphs as one story change.
 * Linking clears span overrides of the linked properties so they cannot mask the link; spans in
 * another slant take the pinned face for that slant. Undo restores both in the same step.
 */
export function bindParagraphTypography(textDocument: TextDocumentV1, story: TextStoryV1, ids: readonly string[], change?: TextTypographyChange): { story: TextStoryV1; fonts: TextFontResourceV1[] } {
  const selected = new Set(ids);
  for (const id of selected) if (!story.paragraphs.some(paragraph => paragraph.id === id)) throw new TextSourceError('missing-paragraph', `Missing paragraph: ${id}`);
  if (!change) return { fonts: textDocument.fonts, story: { ...story, revision: story.revision + 1, paragraphs: story.paragraphs.map(paragraph => {
    const link = selected.has(paragraph.id) ? ownLink(paragraph) : undefined;
    return link ? withLinkState(paragraph, { ...link, custom: true }) : paragraph;
  }) } };
  const ref = `{${aliasPath(change.ref) ?? change.ref}}`, t = change.typography;
  if (!isAlias(ref) || ref.length > 1024) throw new Error('This token reference is invalid or too long.');
  for (const [key, consumer] of PROJECTIONS.slice(1)) { const value = t[key] as number; if (!Number.isFinite(value) || value < consumer.min! || value > consumer.max!) throw new Error('The resolved value is outside this field range.'); }
  const fonts = [...new Map([...textDocument.fonts, ...change.fonts].map(font => [font.id, font])).values()], known = new Set(fonts.map(font => font.id));
  const key = textTypographyFaceKey(t.fontFamily, t.fontWeight), entry = readFaces(change.faces)?.[key] ?? {};
  const resolver = textStyleResolver({ ...textDocument, fonts }), ranges: Parameters<typeof mapSpans>[1][number][] = [];
  const paragraphs = story.paragraphs.map(paragraph => {
    if (!selected.has(paragraph.id)) return paragraph;
    for (const slant of paragraphSlants(resolver, story, paragraph)) {
      const face = entry[slant];
      if (!face || ![face.font, ...face.fallbackFonts ?? []].every(id => known.has(id))) throw new Error(textTypographyMissingFace(t, slant));
    }
    // A Restore of the same reference keeps faces pinned under other theme selections.
    const previous = ownLink(paragraph), cached = previous?.ref === ref ? readCached(previous) : null;
    const faces = Object.fromEntries([...Object.entries(cached?.faces ?? {}).filter(([other]) => other !== key).slice(-(MAX_FACE_KEYS - 1)), [key, { ...cached?.faces[key], ...entry }]]);
    const baseSlant = slantOf(resolver.paragraph(story, paragraph).character);
    const link: BlockTokenBinding = { ref, adapter: 'typography', status: 'linked', value: canonicalJson({ faces, typography: t }) };
    if (paragraph.end > paragraph.start) ranges.push({ start: paragraph.start, end: paragraph.end, map: (character, span) => {
      const next = withoutTypography(character), slant = slantOf(resolver.character(story, paragraph, span.start >= paragraph.start ? span.start : paragraph.start));
      return slant !== baseSlant && !resolver.named(span.style).character.font ? { ...next, ...faceFields(entry[slant]!) } : next;
    } });
    return linkedParagraph(paragraph, entry[baseSlant]!, t, link);
  });
  const next = { ...story, paragraphs };
  return { fonts, story: { ...next, revision: story.revision + 1, spans: mapSpans(next, ranges) } };
}

/** Shared state for the selected paragraphs: the link they share, mixed values and Restore. */
export function paragraphTypographyState(textDocument: TextDocumentV1, stories: readonly TextStoryV1[], range?: TextRangeV1): { active?: BlockTokenBinding; mixed: boolean; restoreRef?: string } {
  const resolver = textStyleResolver(textDocument);
  const links = stories.flatMap(story => story.paragraphs.filter(p => !range || range.start === range.end ? !range || p.start <= range.start && p.end >= range.start : p.start < range.end && p.end >= range.start).map(paragraph => {
    const link = ownLink(paragraph), cached = readCached(link);
    return link && !link.custom && cached && editedLocally(resolver, story, paragraph, cached) ? { ...link, custom: true } : link;
  }));
  const mixed = new Set(links.map(link => JSON.stringify([link?.ref, !!link?.custom]))).size > 1;
  const active = !mixed ? links.find(link => link && !link.custom) : undefined;
  const restoreRef = links.length && links.every(link => link?.custom && link.ref === links[0]?.ref) ? links[0]!.ref : undefined;
  return { mixed, ...(active ? { active } : {}), ...(restoreRef ? { restoreRef } : {}) };
}

/** Theme refresh: apply a newly resolved composite only when every face it needs is pinned. */
function refreshTextTypography(doc: TextDocumentV1, set: TokenSet | undefined): TextDocumentV1 {
  if (!doc.stories.some(story => story.paragraphs.some(ownLink))) return doc;
  const resolver = textStyleResolver(doc), known = new Set(doc.fonts.map(font => font.id));
  let changed = false;
  const stories = doc.stories.map(story => {
    const ranges: Parameters<typeof mapSpans>[1][number][] = [];
    const paragraphs = story.paragraphs.map(paragraph => {
      const link = ownLink(paragraph);
      if (!link || link.custom) return paragraph;
      const hold = (status: 'unresolved' | 'incompatible', reason: string) => link.status === status && link.reason === reason ? paragraph : withLinkState(paragraph, { ...link, status, reason });
      const cached = readCached(link);
      if (!cached) return hold('incompatible', 'The saved typography link cannot be read. Link the token again.');
      if (editedLocally(resolver, story, paragraph, cached)) return withLinkState(paragraph, { ...link, custom: true });
      const result = resolveTextTypography(set?.get(aliasPath(link.ref) ?? ''));
      if (result.status !== 'linked') return hold(result.status, result.reason);
      const t = result.value, entry = cached.faces[textTypographyFaceKey(t.fontFamily, t.fontWeight)];
      const missing = [...paragraphSlants(resolver, story, paragraph)].find(slant => !entry?.[slant] || ![entry[slant]!.font, ...entry[slant]!.fallbackFonts ?? []].every(id => known.has(id)));
      if (missing) return hold('unresolved', textTypographyMissingFace(t, missing));
      const previous = cached.faces[textTypographyFaceKey(cached.typography.fontFamily, cached.typography.fontWeight)];
      const value = canonicalJson({ faces: cached.faces, typography: t }), baseSlant = slantOf(resolver.paragraph(story, paragraph).character);
      if (value === link.value && link.status === 'linked' && !link.reason) return paragraph;
      if (paragraph.end > paragraph.start) ranges.push({ start: paragraph.start, end: paragraph.end, map: character => {
        const slant = (['normal', 'italic'] as const).find(slant => previous?.[slant]?.font === character.font);
        if (!slant || !entry![slant]) return character;
        const { fallbackFonts: _fallbacks, ...rest } = character;
        return { ...rest, ...faceFields(entry![slant]!) };
      } });
      return linkedParagraph(paragraph, entry![baseSlant]!, t, { ref: link.ref, adapter: 'typography', status: 'linked', value });
    });
    if (paragraphs.every((paragraph, index) => paragraph === story.paragraphs[index])) return story;
    changed = true;
    const next = { ...story, paragraphs };
    return { ...next, revision: story.revision + 1, spans: ranges.length ? mapSpans(next, ranges) : story.spans };
  });
  return changed ? { ...doc, stories } : doc;
}
