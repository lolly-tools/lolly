// SPDX-License-Identifier: MPL-2.0
/**
 * The tool-guide dialog (components/tool-guide.ts) - the shell half of the
 * manifest `guide` block. The manifest/i18n half is pinned in
 * tests/tool-guide.test.ts; this covers what the browser actually gets:
 * escaping, tab switching, and the once-per-device auto-open.
 *
 * Run directly:  node --test shells/web/src/components/tool-guide.test.ts
 *
 * jsdom with a real origin - localStorage is where the auto-open's "seen" set
 * lives, and it throws SecurityError on the default opaque about:blank origin.
 * jsdom implements <dialog> but not showModal()/close(), which mountModal calls,
 * so those two are stubbed on the prototype (the lifecycle they drive is
 * mountModal's contract, tested there; here they only need not to throw).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;

const dialogProto = dom.window.HTMLDialogElement.prototype as unknown as Record<string, unknown>;
dialogProto.showModal = function showModal(this: { open: boolean }): void { this.open = true; };
dialogProto.close = function close(this: { open: boolean }): void { this.open = false; };

const { hasGuide, guideButtonHtml, showToolGuide, autoOpenToolGuide } = await import('./tool-guide.ts');

const GUIDE = {
  title: 'Put it in Gmail',
  tracks: [
    { id: 'desktop', label: 'On a computer', steps: ['Open **Export**', 'Press **Copy**'], note: 'Same in Outlook.' },
    { id: 'mobile', label: 'On a phone', steps: ['Tap **Export**'] },
  ],
};
const manifest = { id: 'guide-fixture', guide: GUIDE };

const dialogEl = (): HTMLDialogElement | null => document.querySelector('dialog.tool-guide-dialog');
const reset = (): void => { document.querySelectorAll('dialog').forEach(d => d.remove()); localStorage.clear(); };

test('hasGuide only accepts a guide the dialog could actually render', () => {
  assert.equal(hasGuide(manifest), true);
  assert.equal(hasGuide({ id: 'x' }), false);
  assert.equal(hasGuide(null), false);
  assert.equal(hasGuide({ id: 'x', guide: { tracks: [] } }), false);
  // A track with no steps is the empty-dialog case the schema also rejects.
  assert.equal(hasGuide({ id: 'x', guide: { tracks: [{ id: 'a', label: 'A', steps: [] }] } }), false);
});

test('the trigger is an icon button labelled for screen readers', () => {
  const html = guideButtonHtml();
  assert.match(html, /id="tool-guide-btn"/);
  assert.match(html, /aria-label="[^"]+"/);
  assert.match(html, /aria-haspopup="dialog"/);
  assert.match(html, /<svg/);
});

test('the first track renders as a numbered list, with **bold** the only markup', () => {
  reset();
  const handle = showToolGuide(manifest);
  assert.ok(handle);
  const dlg = dialogEl()!;
  assert.equal(dlg.getAttribute('aria-label'), 'Put it in Gmail');

  const steps = [...dlg.querySelectorAll('.tool-guide-steps li')];
  assert.equal(steps.length, 2);
  assert.equal(steps[0]!.innerHTML, 'Open <strong>Export</strong>');
  assert.equal(dlg.querySelector('.tool-guide-note')?.textContent, 'Same in Outlook.');
  handle!.close();
});

test('a manifest string can never inject markup - it is escaped, then only ** re-admitted', () => {
  reset();
  const handle = showToolGuide({
    id: 'x',
    guide: { tracks: [{ id: 'a', label: '<img src=x>', steps: ['<script>alert(1)</script> **safe**'] }] },
  });
  const dlg = dialogEl()!;
  assert.equal(dlg.querySelectorAll('script, img').length, 0);
  assert.equal(
    dlg.querySelector('.tool-guide-steps li')!.innerHTML,
    '&lt;script&gt;alert(1)&lt;/script&gt; <strong>safe</strong>',
  );
  handle!.close();
});

test('two tracks become tabs; selecting one swaps the panel and moves the roving tabindex', () => {
  reset();
  const handle = showToolGuide(manifest);
  const dlg = dialogEl()!;
  const tabs = [...dlg.querySelectorAll<HTMLButtonElement>('.tool-guide-tab')];
  assert.deepEqual(tabs.map(t => t.textContent), ['On a computer', 'On a phone']);
  assert.deepEqual(tabs.map(t => t.getAttribute('aria-selected')), ['true', 'false']);
  assert.deepEqual(tabs.map(t => t.tabIndex), [0, -1]);

  tabs[1]!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  assert.equal(dlg.querySelectorAll('.tool-guide-steps li').length, 1);
  assert.equal(dlg.querySelector('.tool-guide-steps li')!.textContent, 'Tap Export');
  assert.deepEqual(tabs.map(t => t.getAttribute('aria-selected')), ['false', 'true']);
  assert.equal(dlg.querySelector('.tool-guide-panel')!.getAttribute('aria-labelledby'), 'tool-guide-tab-1');
  handle!.close();
});

test('a single-track guide renders no tablist', () => {
  reset();
  const handle = showToolGuide({ id: 'x', guide: { tracks: [{ id: 'a', label: 'A', steps: ['One'] }] } });
  const dlg = dialogEl()!;
  assert.equal(dlg.querySelectorAll('.tool-guide-tab').length, 0);
  assert.equal(dlg.querySelector('.tool-guide-panel')!.getAttribute('role'), 'group');
  handle!.close();
});

test('the guide auto-opens once per tool per device, and never again on its own', () => {
  reset();
  const first = autoOpenToolGuide(manifest);
  assert.ok(first, 'should open on a first visit');
  first!.close();
  document.querySelectorAll('dialog').forEach(d => d.remove());

  assert.equal(autoOpenToolGuide(manifest), null, 'should not open again');
  assert.equal(dialogEl(), null);

  // Another tool's guide is still owed its one opening.
  const other = autoOpenToolGuide({ id: 'other-tool', guide: GUIDE });
  assert.ok(other);
  other!.close();

  // …and the button path always works, seen or not.
  const manual = showToolGuide(manifest);
  assert.ok(manual);
  manual!.close();
});

test('a tool with no guide neither auto-opens nor mounts anything', () => {
  reset();
  assert.equal(autoOpenToolGuide({ id: 'plain' }), null);
  assert.equal(showToolGuide({ id: 'plain' }), null);
  assert.equal(dialogEl(), null);
});
