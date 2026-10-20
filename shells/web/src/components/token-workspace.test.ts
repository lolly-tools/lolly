// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { mountTokenWorkspace, type TokenWorkspaceOptions } from './token-workspace.ts';
import type { HostV1 } from '@lolly-tools/core/host-v1';

function setup(host?: HostV1, options: Partial<TokenWorkspaceOptions> = {}) {
  const dom = new JSDOM('<main></main>', { url: 'https://lolly.test/#/start' });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Event: dom.window.Event, FormData: dom.window.FormData, AbortController: dom.window.AbortController });
  let source: Record<string, unknown> = { base: { Ink: { $type: 'color', $value: '#111111' } }, alias: { Surface: { $type: 'color', $value: '{Ink}' } }, night: { Ink: { $type: 'color', $value: '#eeeeee' } }, $themes: [{ id: 'day', name: 'Day', group: 'appearance', selectedTokenSets: { base: 'source', alias: 'enabled' } }, { id: 'night', name: 'Night', group: 'appearance', selectedTokenSets: { night: 'enabled', alias: 'enabled' } }], $metadata: { tokenSetOrder: ['base', 'night', 'alias'] } };
  let commits = 0;
  const root = dom.window.document.querySelector<HTMLElement>('main')!;
  const workspace = mountTokenWorkspace(root, { read: () => source, host, commit: candidate => { source = candidate; commits++; }, ...options });
  const find = <T extends HTMLElement>(selector: string): T => root.querySelector<T>(selector)!;
  return { dom, root, workspace, find, read: () => source, write: (value: Record<string, unknown>) => { source = value; }, commits: () => commits };
}

test('render inspection starts with captured choices and labels alternate choices as a reversible preview', () => {
  const s = setup(undefined, { context: 'Render version', initialSelection: { appearance: 'night' }, commit: undefined });
  try {
    s.workspace.select('Ink');
    assert.match(s.find('[data-tw-detail]').textContent!, /#eeeeee/);
    assert.equal(s.find('[data-tw-context]').textContent, 'Render version');
    let choice = s.find<HTMLSelectElement>('[data-tw-group]');
    assert.equal(choice.value, 'night');
    choice.value = 'day'; choice.dispatchEvent(new Event('change', { bubbles: true }));
    assert.equal(s.find('[data-tw-context]').textContent, 'Preview');
    assert.equal(s.find('[data-tw-return-choices]').hidden, false);
    s.find<HTMLButtonElement>('[data-tw-return-choices]').click();
    choice = s.find<HTMLSelectElement>('[data-tw-group]');
    assert.equal(choice.value, 'night');
    assert.equal(document.activeElement, choice);
    assert.equal(s.find('[data-tw-context]').textContent, 'Render version');
    assert.equal(s.commits(), 0);
  } finally { s.workspace.teardown(); s.dom.window.close(); }
});

test('theme preview and filtering write nothing; Apply commits the captured choices', async () => {
  const s = setup();
  const theme = s.find<HTMLSelectElement>('[data-tw-group]'); theme.value = 'night'; theme.dispatchEvent(new Event('change', { bubbles: true }));
  assert.equal(s.commits(), 0);
  const search = s.find<HTMLInputElement>('[data-tw-search]'); search.value = 'Surface'; search.dispatchEvent(new Event('input'));
  assert.equal(s.root.querySelectorAll('[data-tw-token]').length, 1);
  s.find<HTMLButtonElement>('[data-tw-apply-choices]').click();
  assert.equal(s.commits(), 0);
  s.find<HTMLButtonElement>('[data-tw-apply]').click();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(s.commits(), 1);
  assert.deepEqual((s.read().$metadata as Record<string, unknown>).activeThemeSelection, { appearance: 'night' });
  s.workspace.teardown(); s.dom.window.close();
});

test('source edits invalidate reviewed candidates and prevent an outdated commit', () => {
  const s = setup();
  const theme = s.find<HTMLSelectElement>('[data-tw-group]'); theme.value = 'night'; theme.dispatchEvent(new Event('change', { bubbles: true }));
  s.find<HTMLButtonElement>('[data-tw-apply-choices]').click();
  assert.equal(s.find<HTMLButtonElement>('[data-tw-apply]').disabled, false, 'a fresh review with a change can apply');
  const apply = s.find<HTMLButtonElement>('[data-tw-apply]');
  s.write({ ...s.read(), changed: { $value: 1 } });
  apply.click();
  assert.equal(s.commits(), 0);
  assert.equal(s.find<HTMLButtonElement>('[data-tw-apply]').disabled, true);
  s.workspace.teardown(); s.dom.window.close();
});

test('resource replacement invalidates a captured review even when token JSON stays unchanged', async t => {
  let version = '1';
  const host = { tokens: { activeRecord: async () => ({ id: 'local', headId: 'user/tokens', importedFonts: ['user/font/beacon'] }) }, assets: { get: async (id: string) => ({ id, version }), _getUserRecord: async () => ({ version }) } } as unknown as HostV1;
  const s = setup(host);
  // A real change: choices that already match the system have nothing to apply.
  const theme = s.find<HTMLSelectElement>('[data-tw-group]'); theme.value = 'night'; theme.dispatchEvent(new Event('change', { bubbles: true }));
  s.find<HTMLButtonElement>('[data-tw-apply-choices]').click();
  await t.waitFor(() => assert.equal(s.find<HTMLButtonElement>('[data-tw-apply]').disabled, false), { timeout: 5000 });

  version = '2';
  s.find<HTMLButtonElement>('[data-tw-apply]').click();
  await t.waitFor(() => assert.match(s.find('[data-tw-status]').textContent!, /resources changed/), { timeout: 5000 });
  assert.equal(s.commits(), 0);
  assert.equal(s.find<HTMLButtonElement>('[data-tw-apply]').disabled, true);

  s.workspace.teardown(); s.dom.window.close();
});

test('reference navigation offers a keyboard-focusable route back to the origin', () => {
  const s = setup(); s.workspace.select('Surface');
  s.find<HTMLButtonElement>('[data-tw-ref="Ink"]').click();
  assert.equal(s.find('[data-tw-detail] h4').textContent, 'Ink');
  s.find<HTMLButtonElement>('[data-tw-back]').click();
  assert.equal(s.find('[data-tw-detail] h4').textContent, 'Surface');
  assert.equal(s.dom.window.document.activeElement, s.find('[data-tw-detail]'));
  s.workspace.teardown(); s.dom.window.close();
});

test('retained source text is escaped and a large list renders a bounded page', () => {
  const s = setup(); const tokens: Record<string, unknown> = {};
  for (let i = 0; i < 250; i++) tokens[`token-${i}`] = { $type: 'string', $value: '<img src=x onerror=alert(1)>' };
  s.write(tokens); s.workspace.refresh();
  assert.equal(s.root.querySelectorAll('[data-tw-token]').length, 100);
  assert.equal(s.root.querySelectorAll('img').length, 0);
  s.find<HTMLButtonElement>('[data-tw-next]').click();
  assert.equal(s.root.querySelectorAll('[data-tw-token]').length, 100);
  s.workspace.teardown(); s.dom.window.close();
});

test('wide dependency details retain counts while rendering a bounded reference list', () => {
  const s = setup();
  const tokens: Record<string, unknown> = { base: { $type: 'number', $value: 8 } };
  for (let i = 0; i < 250; i++) tokens[`alias-${i}`] = { $type: 'number', $value: '{base}' };
  s.write(tokens); s.workspace.refresh(); s.workspace.select('base');
  assert.equal(s.find('[data-tw-detail]').querySelectorAll('[data-tw-ref]').length, 100);
  assert.match(s.find('[data-tw-detail]').textContent!, /100 of 250 references/);
  s.workspace.teardown(); s.dom.window.close();
});

test('saved work and tools are checked only on request, inside the detail, with a stated scope', async () => {
  let loads = 0;
  const consumers = {
    listSessions: async () => [{ slot: 'poster:1', toolId: 'poster', label: 'Night poster' }],
    loadSession: async () => { loads++; return { accent: { ref: '{Ink}', value: '#111111' } }; },
  };
  const s = setup(undefined, { consumers });
  try {
    s.workspace.select('Ink');
    assert.equal(loads, 0);
    assert.match(s.find('[data-tw-consumers]').textContent!, /are not counted\./);
    s.find<HTMLButtonElement>('[data-tw-consumers-check]').click();
    for (let i = 0; i < 20 && !s.root.querySelector('[data-tw-consumers] li'); i++) await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(loads, 1);
    const section = s.find('[data-tw-consumers]').textContent!;
    assert.match(section, /link this token directly: 1 of 1 checked\./);
    assert.match(section, /has not loaded on this device, so no tools are counted/);
    assert.match(section, /Night poster/);
    assert.equal(s.find('[data-tw-status]').textContent, 'Saved work check finished.');
    s.workspace.select('Surface');
    assert.match(s.find('[data-tw-consumers]').textContent!, /link this token directly: 0 of 1 checked\./);
    assert.equal(loads, 1);
  } finally { s.workspace.teardown(); s.dom.window.close(); }
  const plain = setup();
  plain.workspace.select('Ink');
  assert.equal(plain.root.querySelector('[data-tw-consumers]'), null);
  plain.workspace.teardown(); plain.dom.window.close();
});

test('zero matches say why and Clear filters brings every token back', () => {
  const s = setup();
  try {
    const search = s.find<HTMLInputElement>('[data-tw-search]'); search.value = 'zzzz'; search.dispatchEvent(new Event('input'));
    assert.equal(s.root.querySelectorAll('[data-tw-token]').length, 0);
    assert.match(s.find('.tw-empty').textContent!, /No tokens match “zzzz”\./);
    assert.equal(s.find('[data-tw-count]').textContent, '0 tokens');
    s.find<HTMLButtonElement>('.tw-empty [data-tw-clear]').click();
    assert.equal(search.value, '');
    assert.equal(s.root.querySelectorAll('[data-tw-token]').length, 2);
    const issues = s.find<HTMLInputElement>('[data-tw-issues]'); issues.checked = true; issues.dispatchEvent(new Event('change', { bubbles: true }));
    assert.match(s.find('.tw-empty').textContent!, /No reference issues found\./);
  } finally { s.workspace.teardown(); s.dom.window.close(); }
});

test('a selected token the filters hide says so in the detail', () => {
  const s = setup();
  try {
    s.workspace.select('Ink');
    const search = s.find<HTMLInputElement>('[data-tw-search]'); search.value = 'Surface'; search.dispatchEvent(new Event('input'));
    assert.match(s.find('[data-tw-detail]').textContent!, /Ink is hidden by the current filters\./);
    s.find<HTMLButtonElement>('[data-tw-detail] [data-tw-clear]').click();
    assert.match(s.find('[data-tw-detail] h4').textContent!, /Ink/);
  } finally { s.workspace.teardown(); s.dom.window.close(); }
});

test('the pager shows only past one page, and the count says which page', () => {
  const s = setup();
  try {
    assert.equal(s.find('.tw-pages').hidden, true, 'two tokens need no pager');
    assert.equal(s.find('[data-tw-count]').textContent, '2 tokens');
    const tokens: Record<string, unknown> = {};
    for (let i = 0; i < 100; i++) tokens[`t${i}`] = { $type: 'number', $value: i };
    s.write(tokens); s.workspace.refresh();
    assert.equal(s.find('.tw-pages').hidden, true, '100 fit on one page');
    tokens.t100 = { $type: 'number', $value: 100 };
    s.write({ ...tokens }); s.workspace.refresh();
    assert.equal(s.find('.tw-pages').hidden, false);
    assert.equal(s.find('[data-tw-count]').textContent, '101 tokens · Page 1 of 2');
    s.write({ one: { $type: 'number', $value: 1 } }); s.workspace.refresh();
    assert.equal(s.find('[data-tw-count]').textContent, '1 token');
  } finally { s.workspace.teardown(); s.dom.window.close(); }
});

test('Use these choices hides when the system has no theme choices', () => {
  const s = setup();
  try {
    assert.equal(s.find('[data-tw-apply-choices]').hidden, false);
    s.write({ a: { $type: 'color', $value: '#111111' } }); s.workspace.refresh();
    assert.equal(s.find('[data-tw-apply-choices]').hidden, true);
  } finally { s.workspace.teardown(); s.dom.window.close(); }
  const readonly = setup(undefined, { commit: undefined });
  try { assert.equal(readonly.find('[data-tw-apply-choices]').hidden, true); }
  finally { readonly.workspace.teardown(); readonly.dom.window.close(); }
});

test('a review with nothing to change cannot apply and says so', () => {
  const s = setup();
  try {
    s.find<HTMLButtonElement>('[data-tw-apply-choices]').click();
    assert.equal(s.find<HTMLButtonElement>('[data-tw-apply]').disabled, true);
    assert.match(s.find('[data-tw-review]').textContent!, /Nothing to change\. The choices already match this system\./);
    assert.match(s.find('[data-tw-review]').textContent!, /0 values change/);
  } finally { s.workspace.teardown(); s.dom.window.close(); }
});

test('a bare value edit becomes a candidate, and an unreadable one is refused inline', () => {
  const s = setup();
  try {
    s.workspace.select('Surface');
    s.find<HTMLTextAreaElement>('[data-tw-source-value]').value = '{"not":"a colour"}';
    s.find<HTMLButtonElement>('[data-tw-edit-source]').click();
    assert.equal(s.find('[data-tw-review]').hidden, true, 'nothing to review');
    assert.equal(s.find('[data-tw-source-err]').hidden, false);
    assert.match(s.find('[data-tw-source-err]').textContent!, /That isn’t a value Lolly can read\. Try #ff0000 or 16px\./);
    assert.equal(s.find('[data-tw-source-value]').getAttribute('aria-invalid'), 'true');

    s.find<HTMLTextAreaElement>('[data-tw-source-value]').value = '#ff0000';
    s.find<HTMLButtonElement>('[data-tw-edit-source]').click();
    const review = s.find('[data-tw-review]');
    assert.equal(review.hidden, false);
    assert.match(review.textContent!, /1 value changes/);
    assert.match(review.textContent!, /#ff0000/);
    assert.equal(s.find('[data-tw-source-err]').hidden, true);
    assert.equal(s.find<HTMLButtonElement>('[data-tw-apply]').disabled, false);
  } finally { s.workspace.teardown(); s.dom.window.close(); }
});

test('two changes read in the plural', () => {
  const s = setup();
  try {
    const theme = s.find<HTMLSelectElement>('[data-tw-group]'); theme.value = 'night'; theme.dispatchEvent(new Event('change', { bubbles: true }));
    s.find<HTMLButtonElement>('[data-tw-apply-choices]').click();
    assert.match(s.find('[data-tw-review]').textContent!, /2 values change/);
    assert.match(s.find('[data-tw-review]').textContent!, /0 decisions needed/);
  } finally { s.workspace.teardown(); s.dom.window.close(); }
});

test('an editable head reads as the current draft; without a commit it is read-only', () => {
  const s = setup();
  try {
    assert.equal(s.find('[data-tw-context]').textContent, 'Current draft');
    assert.equal(s.root.querySelectorAll('.tw-context .chip').length, 1, 'one chip');
    assert.equal(s.root.querySelector('a[href*="beacon.tokens.json"]'), null, 'the example link lives in the Tokens room');
  } finally { s.workspace.teardown(); s.dom.window.close(); }
  const readonly = setup(undefined, { commit: undefined, context: 'Editable head' });
  try { assert.equal(readonly.find('[data-tw-context]').textContent, 'Read-only'); }
  finally { readonly.workspace.teardown(); readonly.dom.window.close(); }
});

test('the type filter names types in words and keeps the raw type as the value', () => {
  const s = setup();
  try {
    const opt = s.find<HTMLSelectElement>('[data-tw-type]').querySelector<HTMLOptionElement>('option[value="color"]')!;
    assert.equal(opt.textContent, 'Colour');
    assert.equal(s.find<HTMLSelectElement>('[data-tw-set]').options[0]!.textContent, 'Any set');
    assert.match(s.find('[data-tw-themes]').textContent!, /Appearance/);
  } finally { s.workspace.teardown(); s.dom.window.close(); }
});
