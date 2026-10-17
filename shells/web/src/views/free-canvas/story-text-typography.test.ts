// SPDX-License-Identifier: MPL-2.0
/** Whole typography on a selected composed frame writes one history step or reports why not. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { TextDocumentV1, TextFrameV1 } from '@lolly-tools/core';
import { createTextStory, parseTextDocument } from '../../../../../engine/src/text-story-document.ts';
import { readBlockTokenBindings, withBlockTokenBinding } from '../../../../../engine/src/token-block-bindings.ts';
import type { FcCtx } from './context.ts';
import type { TextEditorSnapshot } from '../../lib/text-editor-session.ts';

const dom = new JSDOM('<body></body>');
for (const key of ['window', 'document', 'HTMLElement', 'Event', 'CustomEvent', 'navigator']) Object.defineProperty(globalThis, key, { configurable: true, value: Reflect.get(dom.window, key) });
const { linkTypography, read } = await import('./story-text-properties.ts');

const typography = { fontFamily: 'Beacon Sans', fontSize: 32, fontWeight: 700, letterSpacing: 0, lineHeight: 1.4 };
function context(): { fc: FcCtx; writes: Array<[TextEditorSnapshot, string]> } {
  const story = createTextStory('s1', 'Heading', index => `p${index}`);
  story.frameIds = ['f1'];
  const cached = JSON.stringify({ faces: { 'beacon sans|700': { normal: { font: 'font-beacon' } } }, typography });
  story.paragraphs[0]!.paragraph = { character: { font: 'font-beacon', size: 32, weight: 700, tracking: 0 }, lineHeight: 1.4, tokenLinks: String(withBlockTokenBinding({}, 'tokenLinks', 'typography', { ref: '{heading}', value: cached }, 'typography').tokenLinks) };
  const document: TextDocumentV1 = parseTextDocument({ version: 1, styles: [], stories: [story], fonts: [{ id: 'font-beacon', family: 'Beacon Sans', sha256: 'c'.repeat(64), faceIndex: 0, source: { kind: 'bundled', path: '/fonts/beacon.ttf' } }] });
  const frame = { id: 'f1', storyId: 's1', width: 200, height: 40, mode: 'fixed', inset: { top: 0, right: 0, bottom: 0, left: 0 }, columns: { count: 1, gutter: 0, balance: false }, verticalAlign: 'top' } as TextFrameV1;
  let snapshot: TextEditorSnapshot = { document, frames: [frame] };
  const writes: Array<[TextEditorSnapshot, string]> = [];
  const fc = { editing: undefined, storyText: { available: () => true, read: () => structuredClone(snapshot), write: async (value: TextEditorSnapshot, label: string) => { writes.push([value, label]); snapshot = value; }, peek: () => undefined } } as unknown as FcCtx;
  return { fc, writes };
}

test('the inspector state shows the shared typography link of the selected frame', () => {
  const { fc } = context();
  assert.equal(read(fc, ['f1'])?.paragraphTypography?.active?.ref, '{heading}');
});

test('Make custom writes one labelled history step and keeps the reference for Restore', async () => {
  const { fc, writes } = context();
  await linkTypography(fc, ['f1']);
  assert.equal(writes.length, 1);
  assert.equal(writes[0]![1], 'Make typography custom');
  const link = readBlockTokenBindings(writes[0]![0].document.stories[0]!.paragraphs[0]!.paragraph?.tokenLinks).typography;
  assert.equal(link?.custom, true);
  assert.equal(read(fc, ['f1'])?.paragraphTypography?.restoreRef, '{heading}');
});

test('a family with no installed face is reported and nothing is written', async () => {
  const { fc, writes } = context();
  await assert.rejects(linkTypography(fc, ['f1'], { ref: '{heading}', typography: { ...typography, fontFamily: 'Absent Sans' } }), /No installed face for Absent Sans/);
  assert.equal(writes.length, 0);
});
