// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildInputModel } from '../engine/src/inputs.ts';
import { parseUrlState, serializeUrlState } from '../engine/src/url-mode.ts';
import { analyseIsolation } from '../scripts/tool-isolation.ts';
import { snippetRender, snippetTool, snippetHooks } from './helpers/snippet.ts';

test('Snippet keeps still defaults and exports complete directed scenes', async () => {
  const originalIds = ['code', 'language', 'scale', 'lineHeight', 'lineNumbers', 'blinkCursor', 'fileName', 'titleScale', 'titleIcon', 'iconScale', 'windowStyle', 'showWindow', 'theme', 'shadow', 'calloutMode', 'calloutPrefix', 'calloutFont'];
  assert.deepEqual(snippetTool.manifest.inputs.filter(i => originalIds.includes(i.id)).map(i => i.id), originalIds);
  const still = await snippetRender({ code: '' });
  assert.equal(still.scene.animated, false);
  assert.equal(still.scene.docs[0]!.text, '');
  assert.deepEqual(still.scene.events, []);
  still.runtime.destroy();
  for (const scene of ['typing', 'demo', 'autocomplete', 'replace']) {
    const r = await snippetRender({ scene, code: 'Hello, World!', selectText: 'World', replacementText: 'Lolly' });
    assert.equal(r.scene.warnings.length, 0);
    assert.equal(r.scene.docs[r.scene.events.at(-1)!.after.doc]!.text, scene === 'replace' ? 'Hello, Lolly!' : 'Hello, World!');
    assert.ok(r.scene.poster > 0 && r.scene.poster <= r.scene.duration);
    assert.equal(r.scene.events.at(-1)!.after.open, scene === 'typing');
    assert.match(r.html, /data-clip-ms="\d+"/);
    r.runtime.destroy();
  }
  assert.ok(analyseIsolation(snippetHooks).clean);
  for (const format of ['png', 'svg', 'pdf', 'mp4', 'webm', 'gif']) assert.ok(snippetTool.manifest.render?.formats?.includes(format as never));
});

test('typing and completion preserve whole Unicode characters and deterministic timing', async () => {
  const text = 'A e\u0301 👩🏽‍💻 مرحبا\n終わり';
  const boundaries = new Set([0, ...Array.from(new Intl.Segmenter('und', { granularity: 'grapheme' }).segment(text), s => s.index + s.segment.length)]);
  const first = await snippetRender({ scene: 'demo', code: text });
  const second = await snippetRender({ scene: 'demo', code: text });
  assert.deepEqual(first.scene, second.scene);
  const typing = first.scene.events.find(e => e.action === 'type')!;
  assert.ok(typing.cuts.every(([, end]) => boundaries.has(end)));
  assert.equal(typing.cuts.at(-1)![0], 1);
  for (const completeAfter of [0, 35, 95]) {
    const r = await snippetRender({ scene: 'autocomplete', code: text, completeAfter });
    const complete = r.scene.events.find(e => e.action === 'complete')!;
    assert.ok(boundaries.has(complete.at));
    assert.equal(r.scene.docs[complete.after.doc]!.text, text);
    r.runtime.destroy();
  }
  first.runtime.destroy(); second.runtime.destroy();
});

test('custom actions edit exact text ranges, preserve tabs, and report unusable selections', async () => {
  const r = await snippetRender({ scene: 'custom', code: 'let\tx = 1;', startFilled: true, steps: [
    { action: 'select', text: 'x', seconds: .4 },
    { action: 'replace', text: 'result', seconds: .7 },
    { action: 'wait', seconds: 2 },
    { action: 'close', seconds: 1 },
  ] });
  assert.equal(r.scene.docs[r.scene.events[1]!.after.doc]!.text, 'let result = 1;');
  assert.equal(r.scene.poster, 3.1);
  r.runtime.destroy();
  for (const selectText of ['missing', '\u0301', '🏽']) {
    const invalid = await snippetRender({ scene: 'replace', code: 'e\u0301 👩🏽‍💻', selectText, replacementText: 'X' });
    assert.ok(invalid.scene.warnings.length > 0);
    assert.equal(invalid.scene.docs.at(-1)!.text, 'e\u0301 👩🏽‍💻');
    invalid.runtime.destroy();
  }
});

test('scene controls and custom steps round-trip through URL mode and escape embedded text', async () => {
  const text = '</script><img src=x onerror=alert(1)>';
  const r = await snippetRender({ scene: 'custom', code: text, windowTiltY: -12, wrapText: true, cursorSize: 175, steps: [
    { action: 'type', text, seconds: 3 }, { action: 'close', text: '', seconds: 1 },
  ] });
  assert.ok(!r.html.includes('<img src=x onerror='));
  const decoded = parseUrlState(serializeUrlState(r.runtime.getModel()), snippetTool.manifest);
  const restored = buildInputModel(snippetTool.manifest, { initial: decoded.values });
  for (const id of ['code', 'scene', 'windowTiltY', 'wrapText', 'cursorSize']) {
    assert.deepEqual(restored.find(i => i.id === id)!.value, r.runtime.getModel().find(i => i.id === id)!.value);
  }
  const replay = await snippetRender(Object.fromEntries(restored.map(i => [i.id, i.value])));
  assert.deepEqual(replay.scene, r.scene);
  replay.runtime.destroy();
  r.runtime.destroy();
});
