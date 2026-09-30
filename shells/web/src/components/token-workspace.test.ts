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
  s.find<HTMLButtonElement>('[data-tw-apply-choices]').click();
  const apply = s.find<HTMLButtonElement>('[data-tw-apply]');
  s.write({ ...s.read(), changed: { $value: 1 } });
  apply.click();
  assert.equal(s.commits(), 0);
  assert.equal(s.find<HTMLButtonElement>('[data-tw-apply]').disabled, true);
  s.workspace.teardown(); s.dom.window.close();
});

test('resource replacement invalidates a captured review even when token JSON stays unchanged', async () => {
  let version = '1';
  const host = { tokens: { activeRecord: async () => ({ id: 'local', headId: 'user/tokens', importedFonts: ['user/font/beacon'] }) }, assets: { get: async (id: string) => ({ id, version }), _getUserRecord: async () => ({ version }) } } as unknown as HostV1;
  const s = setup(host);
  s.find<HTMLButtonElement>('[data-tw-apply-choices]').click();
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(s.find<HTMLButtonElement>('[data-tw-apply]').disabled, false);
  version = '2';
  s.find<HTMLButtonElement>('[data-tw-apply]').click();
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(s.commits(), 0);
  assert.equal(s.find<HTMLButtonElement>('[data-tw-apply]').disabled, true);
  assert.match(s.find('[data-tw-status]').textContent!, /resources changed/);
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
