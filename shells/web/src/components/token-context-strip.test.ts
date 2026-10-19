// SPDX-License-Identifier: MPL-2.0
/**
 * The design-system context strip (plan 286 section 5.1) and the comparison surface
 * that carries the strip. Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/components/token-context-strip.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { HostV1, TokensSnapshot } from '@lolly-tools/core/host-v1';
import { documentSnapshot, mountTokenContextStrip, tokenContextModel, tokenContextStripHtml } from './token-context-strip.ts';

const THEMED = {
  base: { surface: { $type: 'color', $value: '#ffffff' } },
  night: { surface: { $type: 'color', $value: '#111111' } },
  $themes: [
    { id: 'light', name: 'Light', group: 'appearance', selectedTokenSets: { base: 'enabled' } },
    { id: 'dark', name: 'Dark', group: 'appearance', selectedTokenSets: { base: 'enabled', night: 'enabled' } },
    { id: 'compact', name: 'Compact', group: 'density', selectedTokenSets: {} },
    { id: 'roomy', name: 'Roomy', group: 'density', selectedTokenSets: {} },
  ],
  $metadata: { tokenSetOrder: ['base', 'night'], activeThemeSelection: { appearance: 'light', density: 'compact' } },
};

const snapshot = (extra: Partial<TokensSnapshot> = {}): TokensSnapshot => ({
  document: THEMED,
  system: { id: 'beacon', label: 'Beacon', active: true, locked: false, source: 'local', headId: null },
  version: 'v2',
  selection: { choices: { appearance: 'light', density: 'compact' } },
  ...extra,
});

function dom() {
  const window = new JSDOM('<main></main>', { url: 'https://lolly.test/' }).window;
  Object.assign(globalThis, { window, document: window.document, HTMLElement: window.HTMLElement });
  return window;
}

test('a render version reads as the version it is, and the working head as Latest', () => {
  assert.equal(tokenContextModel(snapshot()).version, 'v2');
  for (const version of [null, 'latest', 'LATEST', 'head']) assert.equal(tokenContextModel(snapshot({ version })).version, 'Latest');
  const html = tokenContextStripHtml(tokenContextModel(snapshot()));
  assert.match(html, /Render version: v2/);
  assert.match(html, /Local copy/);
  assert.match(html, /<p>appearance: Light · density: Compact<\/p>/);
});

test('the head and a candidate say which context they are, and draw no version', () => {
  assert.match(tokenContextStripHtml(tokenContextModel(snapshot(), { context: 'head' })), /data-token-context-kind="head">Editable head</);
  const candidate = tokenContextStripHtml(tokenContextModel(snapshot(), { context: 'candidate' }));
  assert.match(candidate, /data-token-context-kind="candidate">Candidate</);
  assert.doesNotMatch(candidate, /Render version/);
});

test('a document scope lists only the choices the document made, and marks them in the details', () => {
  const model = tokenContextModel(snapshot(), { selection: { appearance: 'dark', density: 'compact' }, scope: 'document', choices: 'document' });
  assert.deepEqual(model.choices, [
    { group: 'appearance', option: 'Dark', chosen: true },
    { group: 'density', option: 'Compact', chosen: true },
  ]);
  const html = tokenContextStripHtml(model, { inspect: true, follow: true });
  assert.match(html, /data-token-context-scope="document">Chosen for this document</);
  assert.match(html, /<p>appearance: Dark · density: Compact<\/p>/);
  assert.match(html, /data-token-context-follow>Follow the design system</);
  assert.match(html, /\(chosen for this document\)/);
});

test('following the design system shows no choice line and offers no way to follow it again', () => {
  const model = tokenContextModel(snapshot(), { scope: 'system', choices: 'document' });
  assert.deepEqual(model.shown, []);
  const html = tokenContextStripHtml(model, { inspect: true, follow: true });
  assert.match(html, /Follows the design system/);
  assert.doesNotMatch(html, /<p>/);
  assert.doesNotMatch(html, /data-token-context-follow/);
  assert.match(html, /data-token-context-inspect/);
  assert.match(html, /<li>appearance: Light<\/li><li>density: Compact<\/li>/, 'the details still list every choice');
});

test('a choice the design system does not offer is a stated fallback, not a silent default', () => {
  const model = tokenContextModel(snapshot(), { selection: { appearance: 'sepia', mood: 'calm' }, scope: 'document' });
  assert.deepEqual(model.unavailable, ['appearance: sepia', 'mood: calm']);
  assert.equal(model.choices.find((choice) => choice.group === 'appearance')?.option, 'Light', 'the default is what renders');
  const html = tokenContextStripHtml(model);
  assert.match(html, /appearance: sepia is not offered by this design system, so its default is used\./);
});

test('a hosted source shows its host name only, and a locked system says how to edit', () => {
  const model = tokenContextModel(snapshot({ system: { id: 'acme', label: 'Acme', active: true, locked: true, source: 'hosted', headId: null, instance: 'https://user:secret@work.example.com/org/acme?token=x' } }));
  assert.equal(model.instance, 'work.example.com');
  const html = tokenContextStripHtml(model);
  assert.match(html, /Hosted source \(work\.example\.com\)/);
  assert.doesNotMatch(html, /secret|token=x|\/org\//);
  assert.match(html, /Read-only\. Start can make an editable copy\./);
});

test('every value from a document or a system record is escaped', () => {
  const hostile = '<img src=x onerror=alert(1)>';
  const doc = { ...THEMED, $themes: [{ id: 'a', name: hostile, group: hostile, selectedTokenSets: {} }, { id: 'b', name: 'B', group: hostile, selectedTokenSets: {} }] };
  const model = tokenContextModel(snapshot({ document: doc, system: { id: 'x', label: hostile, active: true, locked: false, source: 'local', headId: null }, version: hostile, selection: {} }), { selection: { [hostile]: 'a' }, scope: 'document' });
  const html = tokenContextStripHtml(model);
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
});

test('documentSnapshot reads a previewed selection in place of the document own, as a render does', () => {
  const dark = { ...THEMED, $metadata: { ...THEMED.$metadata, activeThemeSelection: { appearance: 'dark', density: 'compact' } } };
  assert.deepEqual(documentSnapshot(dark).selection.choices, { appearance: 'dark', density: 'compact' });
  assert.deepEqual(documentSnapshot(dark, { selection: { appearance: 'dark', density: 'roomy' } }).selection.choices, { appearance: 'dark', density: 'roomy' });
  // The engine reads an explicit selection instead of the stored one, so a group it
  // leaves out takes the group's first option. The strip says what renders.
  assert.deepEqual(documentSnapshot(dark, { selection: { density: 'roomy' } }).selection.choices, { appearance: 'light', density: 'roomy' });
  assert.deepEqual(documentSnapshot(null).selection, {});
});

test('the mounted strip draws Inspect only when asked, runs it, and clears on dispose', async () => {
  const window = dom();
  try {
    const root = document.querySelector<HTMLElement>('main')!;
    let opened = 0;
    const dispose = mountTokenContextStrip(root, snapshot(), () => { opened += 1; });
    assert.ok(root.classList.contains('token-context-strip'));
    assert.equal(root.getAttribute('role'), 'group');
    root.querySelector<HTMLButtonElement>('[data-token-context-inspect]')!.click();
    assert.equal(opened, 1);
    dispose();
    assert.equal(root.childElementCount, 0);
    const quiet = mountTokenContextStrip(root, snapshot(), null, { context: 'head' });
    assert.equal(root.querySelector('[data-token-context-inspect]'), null);
    quiet();
  } finally { window.close(); }
});

test('a token review comparison labels its two sides with the context and choices each renders', async () => {
  const window = dom();
  try {
    const { mountTokenReviewProof } = await import('./token-review-proof.ts');
    const root = document.querySelector<HTMLElement>('main')!;
    const candidate = structuredClone(THEMED);
    candidate.$metadata.activeThemeSelection = { appearance: 'dark', density: 'compact' };
    const dispose = mountTokenReviewProof(root, {} as HostV1, THEMED, candidate, {}, () => true, { selection: { appearance: 'dark', density: 'roomy' } });
    const strips = [...root.querySelectorAll<HTMLElement>('.token-proof-contexts > .token-context-strip')];
    assert.equal(strips.length, 2);
    assert.equal(strips[0]!.querySelector('[data-token-context-kind]')!.textContent, 'Editable head');
    assert.match(strips[0]!.querySelector('p')!.textContent!, /appearance: Light · density: Compact/);
    assert.equal(strips[1]!.querySelector('[data-token-context-kind]')!.textContent, 'Candidate');
    assert.match(strips[1]!.querySelector('p')!.textContent!, /appearance: Dark · density: Roomy/);
    dispose();
  } finally { window.close(); }
});

test('the Components specimen mounts the production strip as each surface draws it', async () => {
  const window = dom();
  try {
    const { wireTokenContextExample } = await import('../views/components-token-examples.ts');
    const stage = document.querySelector<HTMLElement>('main')!;
    stage.innerHTML = '<div data-token-context></div>';
    const dispose = wireTokenContextExample(stage.querySelector<HTMLElement>('[data-token-context]')!);
    const kinds = [...stage.querySelectorAll('[data-token-context-kind]')].map((chip) => chip.textContent);
    assert.deepEqual(kinds, ['Render version: v1', 'Render version: v1', 'Editable head', 'Candidate']);
    assert.match(stage.querySelector('[data-token-context-scope="document"]')!.textContent!, /Chosen for this document/);
    assert.equal(stage.querySelectorAll('[data-token-context-inspect]').length, 2, 'Inspect on the render contexts only');
    dispose();
    assert.equal(stage.querySelectorAll('[data-token-context-kind]').length, 0, 'every strip is cleared');
    assert.equal(stage.childElementCount, 1, 'and the extra specimens are removed');
  } finally { window.close(); }
});
