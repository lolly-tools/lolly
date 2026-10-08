// SPDX-License-Identifier: MPL-2.0
/**
 * The evidence gate for automatic recovery and version history in every tool
 * (plan 277 P4, phase 0; scripts/tool-history-audit.ts).
 *
 * - The census: the manifest rule's class counts per pack, so a manifest edit that
 *   moves a tool between classes is a visible decision, not drift. Community only
 *   in CI (a public clone); the private SUSE pack adds its line when mounted.
 * - The gate itself: synthetic tools prove it reports a value that changes on every
 *   mount and a temporary blob: URL, and passes a tool that round-trips.
 * - The ratchet: every community document and side-file tool round-trips through
 *   what history stores, or has an entry with a written reason in
 *   shells/web/src/views/tool-history-exceptions.json; an entry for a tool that
 *   passes fails too, so the map only shrinks (decision 7).
 *
 * Run: node --import ./tests/css-stub.mjs --test tests/history-round-trip.test.ts
 * Before a push that touches a SUSE tool: node scripts/tool-history-audit.ts --all
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import {
  PACKS, GATED_CLASSES, analyseDeterminism, assetSlot, auditTool, auditTools, blankRow, census,
  compareWithExceptions, firstDifference, historyClass, normaliseEmbeddedJson, packMounted, packTools,
  readExceptions, secondValue, setAsideTokenCaches, trackedExecutor, type ManifestLike, type PackTool,
} from '../scripts/tool-history-audit.ts';
import { createRuntime, HOOK_BUDGET_MS } from '../engine/src/runtime.ts';
import { loadTool } from '../engine/src/loader.ts';
import { createCliBridge } from '../shells/cli/src/bridge.ts';

const suse = PACKS.find(p => p.name === 'suse')!;

test('census: the community pack holds 50 document, 2 side-file, 13 file-utility and 3 recording tools', () => {
  const [community] = census();
  assert.equal(community?.pack, 'community');
  assert.deepEqual(community?.counts, { A: 50, B: 2, C: 13, D: 3 }, JSON.stringify(community?.ids));
  assert.deepEqual(community?.ids.B, ['3d', 'darkroom']);
  assert.deepEqual(community?.ids.C, ['annotate', 'claim', 'clean', 'compress-pdf', 'convert-image', 'font-convert', 'pages', 'rebrand-deck', 'redact', 'scan-code', 'sign', 'strip-data', 'trim']);
  assert.deepEqual(community?.ids.D, ['record', 'screencap', 'voice-recorder']);
  // Sandbox took Save away, and is still a document tool (Andy, 27 September 2026).
  for (const id of ['sandbox', 'rondocode', 'jump', 'text-helper', 'countdown-timer', 'icon', 'url-shot', 'calendar-ics', 'diagram-builder', 'meeting-planner']) {
    assert.ok(community?.ids.A.includes(id), `${id} is a document tool`);
  }
});

test('census: the SUSE pack adds 12 document tools and 1 recording tool', { skip: packMounted(suse) ? false : 'brands/suse is not checked out, so the SUSE pack cannot be counted here' }, () => {
  const line = census({ all: true }).find(p => p.pack === 'suse');
  assert.deepEqual(line?.counts, { A: 12, B: 0, C: 0, D: 1 }, JSON.stringify(line?.ids));
  assert.deepEqual(line?.overlays, ['3d', '3d-studio'], 'the two overlays of community tools are not counted again');
  assert.ok(line?.ids.A.includes('email-signature'), 'untyped blocks fields are text, so email-signature is a document tool');
  assert.ok(line?.ids.A.includes('susecon-background'), 'background scenes have document history');
});

test('the rule reads the discriminators the code already uses', () => {
  const base: ManifestLike = { id: 'x', inputs: [{ id: 'title', type: 'text' }], render: { formats: ['svg'], actions: ['copy', 'download', 'save'] } };
  assert.equal(historyClass(base), 'document');
  // compose, capture and wasm are not live device input.
  for (const cap of ['compose', 'capture', 'wasm']) assert.equal(historyClass({ ...base, capabilities: [cap] }), 'document', cap);
  for (const cap of ['camera', 'microphone', 'screen']) assert.equal(historyClass({ ...base, capabilities: [cap] }), 'recording', cap);
  // A blocks field with no type is text (the schema default), so it is durable.
  assert.equal(historyClass({ ...base, inputs: [{ id: 'rows', type: 'blocks', fields: [{ id: 'name' }] }] }), 'document');
  // A file at any depth: the on-device opt-out (actions: []) is class C, the default bar class B.
  const nested = { ...base, inputs: [{ id: 'rows', type: 'blocks', fields: [{ id: 'f', type: 'file' }] }] };
  assert.equal(historyClass(nested), 'side-file');
  assert.equal(historyClass({ ...nested, render: { ...nested.render, actions: [] } }), 'settings');
  // No Save in the actions list is still a document tool.
  assert.equal(historyClass({ ...base, render: { ...base.render, actions: ['copy', 'download'] } }), 'document');
  assert.deepEqual([...GATED_CLASSES].sort(), ['document', 'side-file']);
});

test('the static read lists clock, randomness and temporary bytes, and ignores comments and strings', () => {
  const a = analyseDeterminism(`
    // Date.now() in a comment is not a read
    const note = "Math.random()";
    function onInit({ model }) {
      const today = new Date();      // line 5
      const url = URL.createObjectURL(new Blob(['x']));
      return { stamp: Date.now(), seed: Math.random(), url };
    }
  `);
  assert.deepEqual(a.clock.map(c => c.name), ['Date.now', 'new Date()', 'Math.random']);
  assert.equal(a.clock.find(c => c.name === 'new Date()')?.line, 5);
  assert.deepEqual(a.transient.map(c => c.name), ['URL.createObjectURL', 'new Blob']);
  assert.deepEqual(analyseDeterminism('function onInit() { return { d: new Date("2026-01-01") }; }'), { clock: [], transient: [] });
});

test('comparisons: key order in embedded JSON, upload pins and token caches are stated, never hidden', () => {
  const doc = new JSDOM('<!DOCTYPE html><body></body>').window.document;
  const live = '<div data-state="{&quot;b&quot;:1,&quot;a&quot;:[3,2]}"><script type="application/json">{"y":1,"x":2}</script>text</div>';
  const sorted = '<div data-state="{&quot;a&quot;:[3,2],&quot;b&quot;:1}"><script type="application/json">{"x":2,"y":1}</script>text</div>';
  assert.equal(normaliseEmbeddedJson(live, doc), normaliseEmbeddedJson(sorted, doc));
  assert.notEqual(normaliseEmbeddedJson(live.replace('[3,2]', '[2,3]'), doc), normaliseEmbeddedJson(sorted, doc), 'arrays keep their order');
  assert.notEqual(normaliseEmbeddedJson(live.replace('text', 'txet'), doc), normaliseEmbeddedJson(sorted, doc), 'every other byte still counts');
  const pinned = '<script type="application/json">{"img":{"source":"user","id":"user/upload/a","pin":{"version":"v1","format":"png"}}}</script>';
  const unpinned = '<script type="application/json">{"img":{"source":"user","id":"user/upload/a"}}</script>';
  assert.notEqual(normaliseEmbeddedJson(pinned, doc), normaliseEmbeddedJson(unpinned, doc));
  assert.equal(normaliseEmbeddedJson(pinned, doc, true), normaliseEmbeddedJson(unpinned, doc, true));
  const colors = new Set(['bg']);
  const refreshed = setAsideTokenCaches({ bg: { ref: '{color.surface}', value: '#ffffff' } }, { bg: { ref: '{color.surface}', value: 'color(srgb 1 1 1)' } }, colors);
  assert.equal(firstDifference(refreshed.stored, refreshed.reopened), null);
  assert.equal(refreshed.refreshed.length, 1);
  const moved = setAsideTokenCaches({ bg: { ref: '{color.surface}', value: '#fff' } }, { bg: { ref: '{color.accent}', value: '#fff' } }, colors);
  assert.match(firstDifference(moved.stored, moved.reopened) ?? '', /^bg\.ref: /, 'a changed token reference is a difference');
  assert.equal(firstDifference({ a: [1, { b: 2 }] }, { a: [1, { b: 3 }] }), 'a.1.b: 2 became 3');
});

test('edits: each type gets a second value, and an empty blocks input gets a row first', () => {
  assert.equal(secondValue({ id: 'n', type: 'number', max: 10 }, 10), 9);
  assert.equal(secondValue({ id: 's', type: 'select', options: [{ value: 'a' }, { value: 'b' }] }, 'a'), 'b');
  assert.equal(secondValue({ id: 'b', type: 'boolean' }, true), false);
  assert.deepEqual(secondValue({ id: 't', type: 'table' }, { columns: [], rows: [] }), { columns: ['History audit'], rows: [['History audit']] });
  const fields = [{ id: 'img', type: 'asset' }, { id: 'size', type: 'number', default: 2 }];
  assert.deepEqual(blankRow(fields), { img: null, size: 2 });
  assert.deepEqual(secondValue({ id: 'rows', type: 'blocks', fields }, []), [{ img: null, size: 3 }], 'no text field: the first scalar field');
  assert.equal(secondValue({ id: 'rows', type: 'blocks', fields: [{ id: 'img', type: 'asset' }] }, []), undefined);
  assert.deepEqual(assetSlot({ id: 'x', inputs: [{ id: 'song', type: 'asset', assetType: 'audio' }, { id: 'rows', type: 'blocks', fields: [{ id: 'img', type: 'asset' }] }] })?.kind, 'image', 'an image field wins over audio');
});

/** A tool that exists only for this test, read from memory. */
function synthetic(id: string, hooks: string | null, template = '<p>{{title}}</p>'): { tool: PackTool; fetchFile: (path: string) => Promise<string> } {
  const manifest = {
    id, name: id, version: '1.0.0', engineVersion: '^1.0.0', status: 'experimental',
    render: { width: 400, height: 200, formats: ['html'], actions: ['copy', 'download', 'save'] },
    inputs: [{ id: 'title', type: 'text', label: 'Title', default: 'Hello' }],
    ...(hooks ? { hooks: { onInit: true } } : {}),
  };
  const files: Record<string, string> = { [`${id}/tool.json`]: JSON.stringify(manifest), [`${id}/template.html`]: template, ...(hooks ? { [`${id}/hooks.js`]: hooks } : {}) };
  return {
    tool: { id, pack: 'community', manifest, dir: '', hooks, historyClass: historyClass(manifest) },
    fetchFile: async path => {
      const text = files[path];
      if (text === undefined) throw Object.assign(new Error(`ENOENT: ${path}`), { code: 'ENOENT' });
      return text;
    },
  };
}

test('the gate reports a value that changes on every mount, a temporary blob: URL, and a render that follows the clock', { timeout: 60_000 }, async () => {
  const clean = synthetic('history-audit-clean', null);
  const passed = await auditTool(clean.tool, { fetchFile: clean.fetchFile });
  assert.equal(passed.ok, true, JSON.stringify(passed.cases));
  assert.equal(passed.adopt.outcome, 'identical', passed.adopt.detail ?? '');

  const drift = synthetic('history-audit-drift', "function onInit({ model }) { return { title: model.find(i => i.id === 'title').value + '!' }; }");
  const drifted = await auditTool(drift.tool, { fetchFile: drift.fetchFile });
  assert.equal(drifted.ok, false);
  const first = drifted.cases.find(c => c.name === 'defaults');
  assert.equal(first?.outcome, 'differs');
  assert.match(first?.detail ?? '', /title: "Hello!" became "Hello!!"/);

  const blob = synthetic('history-audit-blob', "function onInit() { return { title: 'blob:http://localhost/1' }; }");
  const refused = await auditTool(blob.tool, { fetchFile: blob.fetchFile });
  assert.equal(refused.ok, false);
  assert.equal(refused.cases[0]?.outcome, 'refused');
  assert.match(refused.cases[0]?.detail ?? '', /temporary file/);

  const clock = synthetic('history-audit-clock', 'function onInit() { return { today: new Date().toISOString().slice(0, 10) }; }', '<p>{{title}} {{today}}</p>');
  const dated = await auditTool(clock.tool, { fetchFile: clock.fetchFile });
  assert.equal(dated.ok, true, 'the same instant renders the same markup');
  assert.equal(dated.clock, 'render', 'a day later the render moves, which is reported and does not block');
  assert.deepEqual(dated.static.clock.map(c => c.name), ['new Date()']);
});

test('without runtime.whenSettled (engine 1.225), the gate still waits for a raced-out hook and its late patch', { timeout: 30_000 }, async () => {
  // The gate settles through runtime.whenSettled() where the engine has it and through
  // its own record of pending hook results otherwise; this proves the second path on
  // any engine, with a 10 ms onInit budget that a 120 ms hook overruns.
  const late = synthetic('history-audit-late', "async function onInit() { await new Promise(done => setTimeout(done, 120)); return { title: 'Late' }; }");
  const budget = HOOK_BUDGET_MS.onInit;
  HOOK_BUDGET_MS.onInit = 10;
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  try {
    const tool = await loadTool(late.tool.id, late.fetchFile);
    const host = { ...await createCliBridge({ dom: dom as never, profile: {} }), log: () => {} };
    const tracked = trackedExecutor();
    const runtime = await createRuntime(tool, host, {}, { hookExecutor: tracked.executor });
    const title = (): unknown => runtime.getModel().find(item => item.id === 'title')?.value;
    assert.equal(title(), 'Hello', 'createRuntime gave up waiting at the budget, before the patch');
    await tracked.idle();
    assert.equal(title(), 'Late', 'idle() waited for the late patch');
    assert.equal(runtime.getHydrated(), '<p>Late</p>');
    runtime.destroy();
  } finally {
    HOOK_BUDGET_MS.onInit = budget;
    dom.window.close();
  }
});

test('the exceptions map: every entry carries a reason and names a gated tool', () => {
  const exceptions = readExceptions();
  const known = new Map<string, PackTool>();
  for (const pack of PACKS) for (const tool of packTools(pack)) known.set(tool.id, tool);
  for (const [id, reason] of Object.entries(exceptions)) {
    assert.ok(reason.trim().length >= 40, `${id}: say why the tool is kept out of automatic history`);
    const tool = known.get(id);
    if (!tool && !packMounted(suse)) continue; // a SUSE entry, and the pack is not here to check
    assert.ok(tool, `${id} is not a tool in any mounted pack`);
    assert.ok(GATED_CLASSES.has(tool.historyClass), `${id} is class ${tool.historyClass}, which the gate does not cover`);
  }
});

test('every community document and side-file tool round-trips through history, or is excepted with a reason', { timeout: 300_000 }, async () => {
  const exceptions = readExceptions();
  const verdicts = await auditTools();
  assert.equal(verdicts.length, 52, 'the 50 document and 2 side-file tools');
  const { unlisted, stale } = compareWithExceptions(verdicts, exceptions);
  const why = (id: string): string => {
    const v = verdicts.find(x => x.id === id)!;
    const failure = [...v.cases, v.adopt].find(c => c.outcome !== 'identical' && c.outcome !== 'skipped');
    return `${id}: ${failure?.name} ${failure?.outcome}: ${failure?.detail ?? ''}`;
  };
  assert.deepEqual(unlisted, [], `fails with no entry in the exceptions map (add one with the reason, or fix the tool):\n${unlisted.map(why).join('\n')}`);
  assert.deepEqual(stale, [], `listed in the exceptions map but now round-trips; remove the entry:\n${stale.join('\n')}`);
});
