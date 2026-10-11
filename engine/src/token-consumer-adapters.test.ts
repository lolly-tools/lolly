// SPDX-License-Identifier: MPL-2.0
/** Composite adapters preserve supported values and bound unsupported data. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createTokenSet } from './tokens.ts';
import { resolveTokenBinding } from './token-binding.ts';
import { readBlockTokenBindings, resolveBlockTokenBindings, withBlockTokenBinding } from './token-block-bindings.ts';
import { parseGradientSpec } from './gradient-spec.ts';
import { bindParagraphToken, paragraphTokenState, resolveTextDocumentTokenBindings } from './text-token-bindings.ts';
import { createTextStory, parseTextDocument, serializeTextDocument } from './text-story-document.ts';
import { formatStoryParagraphs } from './text-edits.ts';
const typography = { fontFamily: 'Beacon Sans', fontSize: { value: 24, unit: 'pt' }, fontWeight: 700, letterSpacing: { value: 2, unit: 'px' }, lineHeight: 1.4 };
const shadow = { color: '#123456', offsetX: { value: 2, unit: 'px' }, offsetY: { value: 4, unit: 'px' }, blur: { value: 8, unit: 'px' }, spread: { value: 0, unit: 'px' } };
const set = createTokenSet({ heading: { $type: 'typography', $value: typography }, shade: { $type: 'shadow', $value: shadow }, delay: { $type: 'duration', $value: { value: .25, unit: 's' } }, curve: { $type: 'cubicBezier', $value: [.2, -.5, .8, 1.5] }, ramp: { $type: 'gradient', $value: [{ color: '#ff000080', position: 0 }, { color: '#0000ff', position: 1 }] } });
test('composite projections and unit adapters retain exact existing consumer values', () => {
  assert.equal(resolveTokenBinding(set.get('heading'), { type: 'number', adapter: 'typography.fontSize' }).value, 32);
  assert.equal(resolveTokenBinding(set.get('heading'), { type: 'select', adapter: 'typography.fontWeight', options: [{ value: '700' }] }).value, '700');
  assert.equal(resolveTokenBinding(set.get('delay'), { type: 'number', adapter: 'duration-ms' }).value, 250);
  assert.equal(resolveTokenBinding(set.get('delay'), { type: 'number', adapter: 'duration-s' }).value, .25);
  assert.equal(resolveTokenBinding(set.get('curve'), { type: 'text', adapter: 'cubic-bezier' }).value, 'cubic-bezier(0.2,-0.5,0.8,1.5)');
  const result = resolveTokenBinding(set.get('ramp'), { type: 'text', adapter: 'gradient' });
  const ramp = parseGradientSpec(String(result.value)); assert.equal(ramp?.angle, 90); assert.equal(ramp?.space, 'srgb'); assert.equal(ramp?.stops[0]?.color, '#ff000080');
});
test('unrepresentable composites refuse instead of truncating or guessing', () => {
  for (const value of [[shadow, shadow], { ...shadow, spread: { value: 2, unit: 'px' } }, { ...shadow, inset: true }]) {
    const entry = { ...set.get('shade')!, value }; assert.equal(resolveTokenBinding(entry, { type: 'text', adapter: 'shadow' }).status, 'incompatible');
  }
  assert.equal(resolveTokenBinding({ ...set.get('heading')!, value: { ...typography, fontSize: { value: 2, unit: 'rem' } } }, { type: 'text', adapter: 'typography' }).status, 'incompatible');
  assert.equal(resolveTokenBinding({ ...set.get('curve')!, value: [2, 0, 1, 1] }, { type: 'text', adapter: 'cubic-bezier' }).status, 'incompatible');
  assert.equal(resolveTokenBinding(set.get('delay'), { type: 'number', adapter: 'duration-ms', max: 100 }).status, 'incompatible');
  assert.equal(resolveTokenBinding({ ...set.get('delay')!, type: 'dimension', value: { value: 2, unit: 'px' } }, { type: 'number', adapter: 'ratio' }).status, 'incompatible');
  assert.equal(resolveTokenBinding({ ...set.get('ramp')!, value: Array(13).fill({ color: '#ffffff', position: 0 }) }, { type: 'text', adapter: 'gradient' }).status, 'incompatible');
});
test('projected block links survive reopen and isolate local overrides during refresh', () => {
  let row = withBlockTokenBinding({ size: 32, line: 1.4 }, 'links', 'size', { ref: '{heading}', value: 32 }, 'typography.fontSize');
  row = withBlockTokenBinding(row, 'links', 'line', { ref: '{heading}', value: 1.4 }, 'typography.lineHeight');
  row = JSON.parse(JSON.stringify(row)); row.size = 45;
  const next = resolveBlockTokenBindings([row], 'links', [{ id: 'size', type: 'number' }, { id: 'line', type: 'number' }], createTokenSet({ heading: { $type: 'typography', $value: { ...typography, lineHeight: 1.8 } } }))[0]!;
  assert.equal(next.size, 45); assert.equal(next.line, 1.8); assert.equal(readBlockTokenBindings(next.links).size?.custom, true); assert.equal(readBlockTokenBindings(next.links).size?.adapter, 'typography.fontSize');
  const missing = resolveBlockTokenBindings([next], 'links', [{ id: 'line', type: 'number' }], undefined)[0]!;
  assert.equal(missing.line, 1.8); assert.equal(readBlockTokenBindings(missing.links).line?.status, 'unresolved');
});
test('paragraph links refresh serialized stories and preserve each paragraph other links', () => {
  let story = createTextStory('s', 'One\nTwo', i => `p${i}`);
  const first = withBlockTokenBinding({ spaceAfter: 8 }, 'tokenLinks', 'spaceAfter', { ref: '{gap}', value: 8 });
  story.paragraphs[0]!.paragraph = first;
  story = bindParagraphToken({ version: 1, fonts: [], styles: [], stories: [story] }, story, ['p0', 'p1'], 'lineHeight', { ref: '{ratio}', value: 1.4 });
  assert.equal(readBlockTokenBindings(story.paragraphs[0]!.paragraph?.tokenLinks).spaceAfter?.ref, '{gap}');
  assert.equal(readBlockTokenBindings(story.paragraphs[1]!.paragraph?.tokenLinks).spaceAfter, undefined);
  const raw = serializeTextDocument({ version: 1, fonts: [], styles: [], stories: [story] });
  const tokens = createTokenSet({ gap: { $type: 'dimension', $value: { value: 12, unit: 'px' } }, ratio: { $type: 'number', $value: 1.7 } });
  const resolved = resolveTextDocumentTokenBindings(raw, tokens), document = parseTextDocument(resolved);
  assert.equal(document.stories[0]!.paragraphs[0]!.paragraph?.spaceAfter, 12);
  assert.equal(document.stories[0]!.paragraphs[1]!.paragraph?.lineHeight, 1.7);
  assert.equal(resolveTextDocumentTokenBindings(resolved, tokens), resolved);
  document.stories[0]!.paragraphs[1]!.paragraph!.lineHeight = 2;
  const custom = parseTextDocument(resolveTextDocumentTokenBindings(serializeTextDocument(document), tokens));
  assert.equal(custom.stories[0]!.paragraphs[1]!.paragraph?.lineHeight, 2);
  assert.equal(readBlockTokenBindings(custom.stories[0]!.paragraphs[1]!.paragraph?.tokenLinks).lineHeight?.custom, true);
});

test('making several paragraph links custom preserves each literal and reference', () => {
  let story = createTextStory('s', 'One\nTwo', i => `p${i}`);
  story.paragraphs[0]!.paragraph = withBlockTokenBinding({ lineHeight: 1.4 }, 'tokenLinks', 'lineHeight', { ref: '{first}', value: 1.4 });
  story.paragraphs[1]!.paragraph = withBlockTokenBinding({ lineHeight: 1.8 }, 'tokenLinks', 'lineHeight', { ref: '{second}', value: 1.8 });
  story = bindParagraphToken({ version: 1, fonts: [], styles: [], stories: [story] }, story, ['p0', 'p1'], 'lineHeight');
  assert.deepEqual(story.paragraphs.map(p => p.paragraph?.lineHeight), [1.4, 1.8]);
  assert.deepEqual(story.paragraphs.map(p => readBlockTokenBindings(p.paragraph?.tokenLinks).lineHeight?.ref), ['{first}', '{second}']);
  assert.ok(story.paragraphs.every(p => readBlockTokenBindings(p.paragraph?.tokenLinks).lineHeight?.custom));
});

test('inherited paragraph bindings materialize per-style overrides and restore safely', () => {
  let story = createTextStory('s', 'One\nTwo', i => `p${i}`);
  const settings = (ref: string, lineHeight: number) => withBlockTokenBinding({ lineHeight }, 'tokenLinks', 'lineHeight', { ref, value: lineHeight });
  story.paragraphs[0]!.style = 'first'; story.paragraphs[1]!.style = 'second';
  const document = { version: 1 as const, fonts: [], stories: [story], styles: [{ id: 'first', name: 'First', kind: 'paragraph' as const, paragraph: settings('{first}', 1.4) }, { id: 'second', name: 'Second', kind: 'paragraph' as const, paragraph: settings('{second}', 1.8) }] };
  assert.ok(paragraphTokenState(document, [story]).mixed.includes('lineHeight'));
  story = bindParagraphToken(document, story, ['p0', 'p1'], 'lineHeight');
  assert.deepEqual(story.paragraphs.map(p => p.paragraph?.lineHeight), [1.4, 1.8]);
  assert.deepEqual(story.paragraphs.map(p => readBlockTokenBindings(p.paragraph?.tokenLinks).lineHeight?.ref), ['{first}', '{second}']);
  assert.equal(paragraphTokenState(document, [story]).restoreRefs.lineHeight, undefined);
  const typed = formatStoryParagraphs(document.stories[0]!, ['p0'], { lineHeight: 2 });
  const typedState = paragraphTokenState(document, [typed], { start: 0, end: 0 });
  assert.equal(readBlockTokenBindings(typedState.paragraph.tokenLinks).lineHeight?.custom, true);
  assert.equal(typedState.restoreRefs.lineHeight, '{first}');
  const restored = bindParagraphToken(document, story, ['p0'], 'lineHeight', { ref: '{first}', value: 1.5 });
  assert.equal(restored.paragraphs[0]!.paragraph?.lineHeight, 1.5);
  assert.equal(readBlockTokenBindings(restored.paragraphs[0]!.paragraph?.tokenLinks).lineHeight?.custom, undefined);
});
