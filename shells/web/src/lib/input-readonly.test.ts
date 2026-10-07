// SPDX-License-Identifier: MPL-2.0
/**
 * lib/input-readonly.ts: how a locked sidebar control is drawn (plan 75 J5 step 5, G19).
 *
 * A governed lock keeps its old markup to the byte (inert, dimmed). The document layer
 * (a viewer) keeps every value in the accessibility tree instead: text-like fields are
 * `readonly` with `aria-readonly="true"` and stay focusable, native choice controls
 * are `disabled` (value and state still exposed), other focusable parts leave the tab
 * order, and nothing is `inert`. A release hands the controls back in place.
 *
 * The sidebar half is a source scan, as views/input-policy-attribution.test.ts does it:
 * tool-inputs.ts cannot be imported outside Vite, so this file pins the sidebar's locked
 * branch to lockedControlHtml with the input's own policy.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/lib/input-readonly.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/t/poster' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;

const { lockedControlHtml, readableControlHtml, releaseReadableLocks } = await import('./input-readonly.ts');
const { getInputPolicy, setDocumentReadOnly, setToolInputPolicies, _clearInputPoliciesForTests } = await import('./input-policy.ts');

const CONTROLS = [
  '<input type="text" data-input-id="headline" value="Spring sale">',
  '<textarea data-input-id="body">Every word</textarea>',
  '<input type="number" data-input-id="size" value="12">',
  '<select data-input-id="layout"><option value="a">Wide</option><option value="b" selected>Tall</option></select>',
  '<input type="checkbox" data-input-id="badge" checked>',
  '<input type="range" data-input-id="zoom" value="3">',
  '<input type="hidden" data-input-id="secret" value="kept">',
  '<button type="button" class="blocks-add">Add</button>',
  '<div class="swatch" tabindex="0" role="button">#30ba78</div>',
  '<div contenteditable="true" class="rich">Hi</div>',
].join('');

function render(html: string): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = html;
  return host;
}

test('a governed lock is drawn exactly as before: inert and dimmed', () => {
  const control = '<input type="text" value="Acme">';
  assert.equal(
    lockedControlHtml(control, { mode: 'locked', note: 'Managed by Acme' }),
    '<span class="input-locked" inert aria-disabled="true"><input type="text" value="Acme"></span>',
  );
  assert.equal(lockedControlHtml(control, undefined), '<span class="input-locked" inert aria-disabled="true"><input type="text" value="Acme"></span>');
});

test('a viewer lock keeps every value readable, and nothing is inert', () => {
  const host = render(lockedControlHtml(CONTROLS, { mode: 'locked', note: 'View only', readable: true }));
  assert.equal(host.querySelector('[inert]'), null, 'no part of a readable lock is inert');
  const wrap = host.querySelector('.input-locked.input-locked--readable');
  assert.ok(wrap, 'still wrapped, so the pointer guard applies');
  assert.equal(wrap!.getAttribute('aria-disabled'), null);
  for (const id of ['headline', 'body', 'size']) {
    const field = host.querySelector(`[data-input-id="${id}"]`)!;
    assert.ok(field.hasAttribute('readonly'), `${id} is readonly`);
    assert.equal(field.getAttribute('aria-readonly'), 'true', `${id} says so to assistive tech`);
    assert.ok(!field.hasAttribute('disabled'), `${id} stays focusable, so its value can be read and copied`);
  }
  assert.equal((host.querySelector('[data-input-id="headline"]') as HTMLInputElement).value, 'Spring sale', 'the value is the value');
  for (const id of ['layout', 'badge', 'zoom']) {
    assert.ok(host.querySelector(`[data-input-id="${id}"]`)!.hasAttribute('disabled'), `${id} is disabled, its state still exposed`);
  }
  assert.equal((host.querySelector('[data-input-id="layout"]') as HTMLSelectElement).selectedOptions[0]?.textContent, 'Tall');
  assert.equal((host.querySelector('[data-input-id="badge"]') as HTMLInputElement).checked, true);
  const hidden = host.querySelector('[data-input-id="secret"]')!;
  assert.ok(!hidden.hasAttribute('readonly') && !hidden.hasAttribute('disabled'), 'a hidden field is left alone');
  assert.ok(host.querySelector('.blocks-add')!.hasAttribute('disabled'));
  const swatch = host.querySelector('.swatch')!;
  assert.equal(swatch.getAttribute('tabindex'), '-1', 'a custom control leaves the tab order');
  assert.equal(swatch.getAttribute('aria-disabled'), 'true');
  const rich = host.querySelector('.rich')!;
  assert.equal(rich.getAttribute('contenteditable'), 'false');
  assert.equal(rich.getAttribute('aria-readonly'), 'true');
});

test('a release hands the controls back exactly as they were drawn', () => {
  const host = render(`<div>${lockedControlHtml(CONTROLS, { mode: 'locked', note: 'View only', readable: true })}</div>`);
  releaseReadableLocks(host);
  assert.equal(host.querySelector('.input-locked'), null, 'the lock wrapper is gone');
  assert.equal(host.querySelector('[data-readonly-added]'), null, 'nothing is left marked');
  assert.equal(host.querySelector('[readonly]'), null);
  assert.equal(host.querySelector('[disabled]'), null);
  assert.equal(host.querySelector('[aria-readonly]'), null);
  assert.equal(host.querySelector('.swatch')!.getAttribute('tabindex'), '0', 'a changed attribute gets its old value back');
  assert.equal(host.querySelector('.rich')!.getAttribute('contenteditable'), 'true');
  const governed = render(lockedControlHtml('<input type="text">', { mode: 'locked' }));
  releaseReadableLocks(governed);
  assert.ok(governed.querySelector('.input-locked[inert]'), 'a governed lock is not released');
});

test('a control that was already read-only is left as its author drew it', () => {
  const html = readableControlHtml('<input type="text" readonly aria-readonly="true" value="x">');
  const host = render(html);
  assert.equal(host.querySelector('[data-readonly-added]'), null, 'nothing was added, so nothing to give back');
  releaseReadableLocks(host);
  assert.ok(host.querySelector('input')!.hasAttribute('readonly'), 'and a release does not take its own readonly away');
});

test('the sidebar draws every lock through lockedControlHtml with the input\'s own policy', () => {
  const src = readFileSync(resolve(import.meta.dirname, '../views/tool-inputs.ts'), 'utf8');
  assert.match(src, /import \{ lockedControlHtml \} from '\.\.\/lib\/input-readonly\.ts';/);
  assert.match(src, /const control = locks\s*\?\s*lockedControlHtml\(rawControl, pol\)\s*:\s*rawControl;/);
  assert.doesNotMatch(src, /class="input-locked" inert/, 'the inert wrapper is drawn in one place only');
});

test('end to end: a viewer document locks a text input readably; a governed lock beside it stays inert', () => {
  _clearInputPoliciesForTests();
  setDocumentReadOnly('poster', 'View only');
  setToolInputPolicies('poster', { logo: { mode: 'locked', note: 'Managed by Acme' } });
  const viewer = render(lockedControlHtml('<input type="text" data-input-id="headline" value="Hi">', getInputPolicy('poster', 'headline')));
  const governed = render(lockedControlHtml('<input type="text" data-input-id="logo">', getInputPolicy('poster', 'logo')));
  assert.equal(viewer.querySelector('input')!.getAttribute('aria-readonly'), 'true');
  assert.equal(viewer.querySelector('[inert]'), null);
  assert.ok(governed.querySelector('.input-locked[inert]'));
  _clearInputPoliciesForTests();
});
