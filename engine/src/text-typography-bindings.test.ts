// SPDX-License-Identifier: MPL-2.0
/** Whole typography on composed text uses pinned faces and keeps one undo step per action. */
import test from 'node:test';
import assert from 'node:assert/strict';
import type { TextDocumentV1, TextFontResourceV1, TextStoryV1 } from '@lolly-tools/core';
import { createTokenSet } from './tokens.ts';
import { readBlockTokenBindings, withBlockTokenBinding } from './token-block-bindings.ts';
import { createTextStory, parseTextDocument, serializeTextDocument } from './text-story-document.ts';
import { formatStoryParagraphs, formatStoryRange } from './text-edits.ts';
import { bindParagraphTypography, paragraphTypographyState, resolveTextDocumentTokenBindings, resolveTextTypography, textTypographyFaceKey, textTypographySlants, type TextTypographyChange } from './text-token-bindings.ts';
import { faceCoversWeight, pinnedFaceMismatch } from './token-font-pins.ts';

const font = (id: string, family: string, digit: string): TextFontResourceV1 => ({ id, family, sha256: digit.repeat(64), faceIndex: 0, source: { kind: 'bundled', path: `/fonts/${id}.ttf` } });
const old = font('font-old', 'Old Sans', 'a'), oldItalic = font('font-old-italic', 'Old Sans', 'b');
const beacon = font('font-beacon', 'Beacon Sans', 'c'), beaconItalic = font('font-beacon-italic', 'Beacon Sans', 'd'), other = font('font-other', 'Other Sans', 'e'), otherItalic = font('font-other-italic', 'Other Sans', 'f');
const heading = { fontFamily: 'Beacon Sans', fontSize: { value: 24, unit: 'pt' }, fontWeight: 700, letterSpacing: { value: 2, unit: 'px' }, lineHeight: 1.4 };
const tokens = (value: Record<string, unknown> = heading) => createTokenSet({ heading: { $type: 'typography', $value: value } });

function fixture(): { document: TextDocumentV1; story: TextStoryV1 } {
  const story = createTextStory('s1', 'Hello world\nSecond', index => `p${index}`);
  story.spans = [{ start: 0, end: 6, character: { font: 'font-old', size: 12, weight: 400, axes: { wght: 400, wdth: 90 } } }, { start: 6, end: 11, character: { font: 'font-old-italic', italic: true, size: 12 } }, { start: 12, end: 18, character: { size: 12, underline: true } }];
  story.paragraphs[0]!.paragraph = withBlockTokenBinding({ lineHeight: 1.2 }, 'tokenLinks', 'lineHeight', { ref: '{ratio}', value: 1.2 }, 'ratio') as never;
  const document = parseTextDocument({ version: 1, fonts: [old, oldItalic], styles: [], stories: [story] });
  return { document, story: document.stories[0]! };
}
function change(typography = resolved(), faces = { [textTypographyFaceKey('Beacon Sans', 700)]: { normal: { font: beacon.id }, italic: { font: beaconItalic.id } } }, fonts = [beacon, beaconItalic]): TextTypographyChange {
  return { ref: '{heading}', typography, faces, fonts };
}
function resolved(value: Record<string, unknown> = heading) {
  const result = resolveTextTypography(tokens(value).get('heading'));
  assert.equal(result.status, 'linked');
  return (result as { value: ReturnType<typeof resolveTextTypography> extends infer R ? R extends { value: infer V } ? V : never : never }).value;
}
const link = (story: TextStoryV1, index = 0) => readBlockTokenBindings(story.paragraphs[index]!.paragraph?.tokenLinks).typography;
function linked(): TextDocumentV1 {
  const { document, story } = fixture();
  const result = bindParagraphTypography(document, story, ['p0', 'p1'], change());
  return parseTextDocument({ ...document, fonts: result.fonts, stories: [result.story] });
}

test('typography tokens resolve to composed-text units or refuse with a reason', () => {
  assert.deepEqual(resolved(), { fontFamily: 'Beacon Sans', fontSize: 32, fontWeight: 700, letterSpacing: 2, lineHeight: 1.4 });
  // Zero and negative tracking are ordinary absolute dimensions; the range still applies.
  assert.equal(resolved({ ...heading, letterSpacing: { value: 0, unit: 'px' } }).letterSpacing, 0);
  assert.equal(resolved({ ...heading, letterSpacing: '-0.5px' }).letterSpacing, -.5);
  assert.equal(resolveTextTypography(tokens({ ...heading, fontSize: { value: -4, unit: 'px' } }).get('heading')).status, 'incompatible');
  assert.equal(resolveTextTypography(tokens({ ...heading, letterSpacing: { value: .02, unit: 'em' } }).get('heading')).status, 'incompatible');
  assert.equal(resolveTextTypography(tokens({ ...heading, fontWeight: 'bold' }).get('heading')).status, 'incompatible');
  assert.equal(resolveTextTypography(undefined).status, 'unresolved');
});

test('linking applies the whole composite in one story revision and pins each slant face', () => {
  const { document, story } = fixture();
  assert.deepEqual(textTypographySlants(document, story, ['p0', 'p1']), ['normal', 'italic']);
  const result = bindParagraphTypography(document, story, ['p0', 'p1'], change());
  assert.equal(result.story.revision, story.revision + 1);
  assert.deepEqual(result.fonts.map(item => item.id), ['font-old', 'font-old-italic', 'font-beacon', 'font-beacon-italic']);
  for (const paragraph of result.story.paragraphs) {
    assert.deepEqual(paragraph.paragraph?.character, { font: 'font-beacon', size: 32, weight: 700, tracking: 2 });
    assert.equal(paragraph.paragraph?.lineHeight, 1.4);
  }
  // The composite owns line height, so the separate scalar link goes with the same step.
  assert.equal(readBlockTokenBindings(result.story.paragraphs[0]!.paragraph?.tokenLinks).lineHeight, undefined);
  assert.equal(link(result.story)?.ref, '{heading}');
  assert.equal(link(result.story)?.adapter, 'typography');
  // Span overrides of linked properties are cleared; the italic run takes the italic face.
  assert.deepEqual(result.story.spans, [{ start: 0, end: 6, character: { axes: { wdth: 90 } } }, { start: 6, end: 11, character: { italic: true, font: 'font-beacon-italic' } }, { start: 12, end: 18, character: { underline: true } }]);
  const saved = parseTextDocument(serializeTextDocument({ ...document, fonts: result.fonts, stories: [result.story] }));
  assert.equal(saved.stories[0]!.revision, story.revision + 1);
});

test('a face missing from the pinned set is reported and nothing changes', () => {
  const { document, story } = fixture();
  const key = textTypographyFaceKey('Beacon Sans', 700);
  assert.throws(() => bindParagraphTypography(document, story, ['p0'], change(resolved(), { [key]: { normal: { font: beacon.id } } }, [beacon])), /No pinned face for Beacon Sans at weight 700 italic/);
  assert.throws(() => bindParagraphTypography(document, story, ['p1'], change(resolved(), { [key]: { normal: { font: 'font-absent' } } }, [])), /No pinned face for Beacon Sans at weight 700 is in this text/);
  assert.equal(story.paragraphs[0]!.paragraph?.character, undefined);
});

test('make custom keeps the rendered values and Restore links again in one step each', () => {
  const document = linked(), story = document.stories[0]!;
  const custom = bindParagraphTypography(document, story, ['p0']);
  assert.equal(custom.story.revision, story.revision + 1);
  assert.equal(link(custom.story)?.custom, true);
  assert.equal(link(custom.story, 1)?.custom, undefined);
  assert.deepEqual(custom.story.paragraphs[0]!.paragraph?.character, story.paragraphs[0]!.paragraph?.character);
  assert.deepEqual(custom.story.spans, story.spans);
  const state = paragraphTypographyState({ ...document, stories: [custom.story] }, [custom.story], { start: 0, end: 0 });
  assert.equal(state.restoreRef, '{heading}');
  assert.equal(state.active, undefined);
  assert.equal(paragraphTypographyState({ ...document, stories: [custom.story] }, [custom.story]).mixed, true);
  const restored = bindParagraphTypography({ ...document, stories: [custom.story] }, custom.story, ['p0'], change());
  assert.equal(link(restored.story)?.custom, undefined);
  assert.equal(paragraphTypographyState({ ...document, stories: [restored.story] }, [restored.story]).active?.ref, '{heading}');
});

test('theme refresh resolves through pinned faces and reports a face that is not pinned', () => {
  const document = linked(), raw = serializeTextDocument(document);
  assert.equal(resolveTextDocumentTokenBindings(raw, tokens()), raw);
  const larger = parseTextDocument(resolveTextDocumentTokenBindings(raw, tokens({ ...heading, fontSize: { value: 30, unit: 'px' } })));
  assert.equal(larger.stories[0]!.paragraphs[1]!.paragraph?.character?.size, 30);
  assert.equal(larger.stories[0]!.paragraphs[1]!.paragraph?.character?.font, 'font-beacon');
  assert.equal(larger.stories[0]!.revision, document.stories[0]!.revision + 1);
  // Another family has no pinned face in this text: the whole composite holds its cache.
  const moved = parseTextDocument(resolveTextDocumentTokenBindings(raw, tokens({ ...heading, fontFamily: 'Other Sans', fontSize: { value: 30, unit: 'px' } })));
  const held = moved.stories[0]!.paragraphs[0]!;
  assert.equal(held.paragraph?.character?.size, 32);
  assert.equal(held.paragraph?.character?.font, 'font-beacon');
  assert.equal(link(moved.stories[0]!)?.status, 'unresolved');
  assert.match(link(moved.stories[0]!)?.reason ?? '', /No pinned face for Other Sans at weight 700/);
  // Unresolved tokens keep the cached values with a reason.
  assert.equal(link(parseTextDocument(resolveTextDocumentTokenBindings(raw, createTokenSet({}))).stories[0]!)?.status, 'unresolved');
});

test('faces pinned under another theme are reused, including the italic run', () => {
  const document = linked(), story = document.stories[0]!;
  const dark = resolved({ ...heading, fontFamily: 'Other Sans' });
  const both = bindParagraphTypography(document, story, ['p0', 'p1'], change(dark, { [textTypographyFaceKey('Other Sans', 700)]: { normal: { font: other.id }, italic: { font: otherItalic.id } } }, [other, otherItalic]));
  assert.equal(both.story.spans[1]!.character?.font, 'font-other-italic');
  const raw = serializeTextDocument({ ...document, fonts: both.fonts, stories: [both.story] });
  const light = parseTextDocument(resolveTextDocumentTokenBindings(raw, tokens()));
  assert.equal(light.stories[0]!.paragraphs[0]!.paragraph?.character?.font, 'font-beacon');
  assert.equal(light.stories[0]!.spans[1]!.character?.font, 'font-beacon-italic');
  assert.equal(link(light.stories[0]!)?.status, 'linked');
  const again = parseTextDocument(resolveTextDocumentTokenBindings(serializeTextDocument(light), tokens({ ...heading, fontFamily: 'Other Sans' })));
  assert.equal(again.stories[0]!.paragraphs[0]!.paragraph?.character?.font, 'font-other');
  assert.equal(again.stories[0]!.spans[1]!.character?.font, 'font-other-italic');
  assert.equal(again.stories[0]!.spans[0]!.character?.font, undefined);
});

test('a whole-paragraph override makes the link custom while word emphasis keeps it', () => {
  const document = linked(), story = document.stories[0]!;
  const word = formatStoryRange(story, { start: 0, end: 5 }, { character: { weight: 900 } });
  const wordRaw = serializeTextDocument({ ...document, stories: [word] });
  assert.equal(link(parseTextDocument(resolveTextDocumentTokenBindings(wordRaw, tokens({ ...heading, fontSize: { value: 30, unit: 'px' } }))).stories[0]!)?.custom, undefined);
  const whole = formatStoryRange(story, { start: 0, end: 11 }, { character: { size: 50 } });
  const wholeDoc = { ...document, stories: [whole] };
  assert.equal(paragraphTypographyState(wholeDoc, [whole], { start: 2, end: 2 }).restoreRef, '{heading}');
  const refreshed = parseTextDocument(resolveTextDocumentTokenBindings(serializeTextDocument(wholeDoc), tokens({ ...heading, fontSize: { value: 30, unit: 'px' } })));
  assert.equal(link(refreshed.stories[0]!)?.custom, true);
  assert.equal(refreshed.stories[0]!.spans[0]!.character?.size, 50);
  assert.equal(link(refreshed.stories[0]!, 1)?.custom, undefined);
  assert.equal(refreshed.stories[0]!.paragraphs[1]!.paragraph?.character?.size, 30);
});

test('a paragraph wholly under a named style with its own weight or font keeps an active link', () => {
  const story = createTextStory('s1', 'Strong words\ncode', index => `p${index}`);
  story.spans = [{ start: 0, end: 12, style: 'strong' }, { start: 13, end: 17, style: 'code' }];
  const mono = font('font-mono', 'Mono', '9');
  const document = parseTextDocument({ version: 1, fonts: [old, mono], styles: [{ id: 'strong', name: 'Strong', kind: 'character', character: { weight: 900, tracking: 1 } }, { id: 'code', name: 'Code', kind: 'character', character: { font: 'font-mono', size: 10 } }], stories: [story] });
  const result = bindParagraphTypography(document, document.stories[0]!, ['p0', 'p1'], change());
  const doc = parseTextDocument({ ...document, fonts: result.fonts, stories: [result.story] });
  const state = paragraphTypographyState(doc, doc.stories);
  assert.equal(state.active?.ref, '{heading}');
  assert.equal(state.restoreRef, undefined);
  const refreshed = parseTextDocument(resolveTextDocumentTokenBindings(serializeTextDocument(doc), tokens({ ...heading, fontSize: { value: 30, unit: 'px' } })));
  assert.equal(link(refreshed.stories[0]!)?.custom, undefined);
  assert.equal(link(refreshed.stories[0]!, 1)?.custom, undefined);
  assert.equal(refreshed.stories[0]!.paragraphs[0]!.paragraph?.character?.size, 30);
  // A local override that hides the link across the paragraph still makes it custom.
  const whole = formatStoryRange(doc.stories[0]!, { start: 0, end: 12 }, { character: { size: 50 } });
  assert.equal(paragraphTypographyState({ ...doc, stories: [whole] }, [whole], { start: 2, end: 2 }).restoreRef, '{heading}');
});

test('other paragraph edits keep the typography link', () => {
  const document = linked(), story = document.stories[0]!;
  const aligned = formatStoryParagraphs(story, ['p0'], { align: 'center' });
  assert.equal(link(aligned)?.custom, undefined);
  assert.equal(link(aligned)?.value, link(story)?.value);
});

test('face matching refuses a nearer weight, another slant or a fallback family', () => {
  assert.equal(faceCoversWeight('100 900', 700), true);
  assert.equal(faceCoversWeight('400', 700), false);
  assert.equal(pinnedFaceMismatch({ family: 'Beacon Sans', weight: 700, italic: false }, { family: 'beacon sans', weight: '100 900', style: 'normal' }), null);
  assert.match(pinnedFaceMismatch({ family: 'Beacon Sans', weight: 700, italic: false }, { family: 'Beacon Sans', weight: '400', style: 'normal' })!, /no installed face at weight 700/);
  assert.match(pinnedFaceMismatch({ family: 'Beacon Sans', weight: 400, italic: true }, { family: 'Beacon Sans', weight: '400', style: 'normal' })!, /weight 400 italic/);
  assert.match(pinnedFaceMismatch({ family: 'Beacon Sans', weight: 400, italic: false }, { family: 'SUSE', weight: '100 900', style: 'normal' })!, /No installed face for Beacon Sans/);
  assert.match(pinnedFaceMismatch({ family: 'Beacon Sans', weight: 400, italic: false }, null)!, /Install the font/);
});

test('a run made italic by a named style takes the italic face; a style with its own font keeps it', () => {
  const story = createTextStory('s1', 'Plain words code', index => `p${index}`);
  story.spans = [{ start: 6, end: 11, style: 'emphasis' }, { start: 12, end: 16, style: 'code' }];
  const mono = font('font-mono', 'Mono', '9');
  const document = parseTextDocument({ version: 1, fonts: [old, mono], styles: [{ id: 'emphasis', name: 'Emphasis', kind: 'character', character: { italic: true } }, { id: 'code', name: 'Code', kind: 'character', character: { font: 'font-mono', italic: true } }], stories: [story] });
  const result = bindParagraphTypography(document, document.stories[0]!, ['p0'], change());
  assert.deepEqual(result.story.spans, [{ start: 6, end: 11, style: 'emphasis', character: { font: 'font-beacon-italic' } }, { start: 12, end: 16, style: 'code' }]);
  parseTextDocument({ ...document, fonts: result.fonts, stories: [result.story] });
});
