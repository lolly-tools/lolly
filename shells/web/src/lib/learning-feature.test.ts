// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { JSDOM } from 'jsdom';
import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import type { ActionsCtx } from '../views/tool-actions/context.ts';
import type { PickerHost } from '../views/picker.ts';

registerHooks({
  resolve(spec, context, next) {
    if (spec.endsWith('.js') && spec.startsWith('.') && context.parentURL) {
      const source = new URL(spec.replace(/\.js$/, '.ts'), context.parentURL);
      if (existsSync(fileURLToPath(source))) return next(source.href, context);
    }
    return next(spec, context);
  },
});

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/' });
globalThis.window = dom.window as unknown as Window & typeof globalThis;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;
dom.window.HTMLCanvasElement.prototype.getContext = (() => null) as typeof dom.window.HTMLCanvasElement.prototype.getContext;
const { LEARNING_FLAG, isFlagOn, hydrateFeatureFlags, setFlagMirror } = await import('../feature-flags.ts');
const { learningEnabled, requireLearningFeature, showLearningFeatureGate } = await import('./learning-feature.ts');
const { projectLearningActionsHtml } = await import('../views/projects-create.ts');
const { visibleCapabilitySections } = await import('./capabilities-data.ts');
const { readDeepExport } = await import('../views/tool-actions/format-rules.ts');
const { open } = await import('../views/tool-actions/learning.ts');
const { mountLearning } = await import('../views/learning.ts');
const { startLearningCourse } = await import('./learning-entry.ts');

beforeEach(() => localStorage.clear());

test('training is off for a fresh profile and mirror, and can be enabled or disabled explicitly', () => {
  assert.equal(LEARNING_FLAG.default, false);
  assert.equal(isFlagOn({}, LEARNING_FLAG), false);
  assert.equal(learningEnabled(), false);
  localStorage.setItem('lolly:featureFlags', 'unreadable mirror');
  assert.equal(learningEnabled(), false);
  hydrateFeatureFlags({});
  assert.equal(JSON.parse(localStorage.getItem('lolly:featureFlags')!)[LEARNING_FLAG.id], false);
  setFlagMirror(LEARNING_FLAG.id, true);
  assert.equal(learningEnabled(), true);
  requireLearningFeature();
  setFlagMirror(LEARNING_FLAG.id, false);
  assert.equal(learningEnabled(), false);
  assert.throws(requireLearningFeature, /Turn on Training and courses/);
});

test('Projects keeps Batch while hiding learning actions until opt-in', () => {
  const off = projectLearningActionsHtml('folder<&', 'folder<&');
  assert.doesNotMatch(off, /Create learning module|Export course|#\/learning/);
  assert.match(off, /#\/batch\?from=folder%3C%26/);
  setFlagMirror(LEARNING_FLAG.id, true);
  const on = projectLearningActionsHtml('folder<&', 'folder<&');
  assert.match(on, /Create learning module/);
  assert.match(on, /data-course-folder="folder&lt;&amp;"/);
  assert.match(on, /#\/learning\?from=folder%3C%26/);
});

test('disabled routes and handoffs read or write no saved data, while the gate links to Settings', async () => {
  const root = document.createElement('main');
  const host = new Proxy({} as PickerHost, { get() { throw new Error('Saved data must not be touched'); } });
  await mountLearning(root, host, 'slot=__learning__:existing');
  assert.match(root.textContent!, /Turn on Training and courses/);
  assert.equal(root.querySelector('a')?.getAttribute('href'), '#/settings?focus=feature-flags-section');
  await assert.rejects(startLearningCourse(host, {}), /Turn on Training and courses/);
  await assert.rejects(open({} as ActionsCtx), /Turn on Training and courses/);
  assert.equal(document.querySelector('dialog'), null);
  setFlagMirror(LEARNING_FLAG.id, true);
  root.innerHTML = 'Existing content';
  assert.equal(showLearningFeatureGate(root), false);
  assert.equal(root.textContent, 'Existing content');
});

test('SCORM is removed from the export format list until training is enabled', () => {
  const ctx = () => ({
    manifest: { id: 'test', render: { formats: ['png', 'scorm', 'pdf'] }, inputs: [] },
    host: {}, experience: {}, formatRules: { isAnimatedFmt: () => false },
  }) as unknown as ActionsCtx;
  const off = ctx(); readDeepExport(off);
  assert.deepEqual(off.capFormats, ['png', 'pdf']);
  assert.equal(off.formats.includes('scorm'), false);
  setFlagMirror(LEARNING_FLAG.id, true);
  const on = ctx(); readDeepExport(on);
  assert.deepEqual(on.capFormats, ['png', 'scorm', 'pdf']);
  assert.equal(on.formats.includes('scorm'), true);
});

test('capability descriptions follow the same opt-in without changing the registry', () => {
  const names = () => visibleCapabilitySections().flatMap(section => section.cards.flatMap(card => [card.title, ...card.features.map(feature => feature.name)]));
  assert.equal(names().includes('Training courses'), false);
  assert.equal(names().includes('SCORM course package'), false);
  setFlagMirror(LEARNING_FLAG.id, true);
  assert.equal(names().includes('Training courses'), true);
  assert.equal(names().includes('SCORM course package'), true);
  setFlagMirror(LEARNING_FLAG.id, false);
  assert.equal(names().includes('Training courses'), false);
});

test('Batch never offers SCORM, with training on or off: Export course builds the package', async () => {
  const { batchFormats } = await import('../pro/formats.ts');
  const { bodyRow } = await import('../pro/grid.ts');
  const formats = ['png', 'scorm', 'pdf'];
  const manifest = { id: 'design', name: 'Design', render: { formats } };
  const tool = { id: 'design', name: 'Design', status: 'stable' };
  const row = { uid: 'r1', toolId: 'design', manifest, values: {} };
  for (const on of [false, true]) {
    setFlagMirror(LEARNING_FLAG.id, on);
    const runMenu = batchFormats([{ id: 'design', formats }], { format: 'png', rows: [{ manifest }] } as unknown as Parameters<typeof batchFormats>[1], false);
    assert.deepEqual(runMenu, ['png', 'pdf']);
    const rowHtml = bodyRow(row as unknown as Parameters<typeof bodyRow>[0], [], { tools: [tool], toolById: new Map([['design', tool]]), assetPicker: false } as unknown as Parameters<typeof bodyRow>[2]);
    assert.match(rowHtml, /<option value="pdf"/);
    assert.doesNotMatch(rowHtml, /value="scorm"/);
  }
  setFlagMirror(LEARNING_FLAG.id, false);
});
