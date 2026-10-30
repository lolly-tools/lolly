// SPDX-License-Identifier: MPL-2.0
/**
 * lib/steady-dom.ts: a per-frame write that changes nothing leaves the DOM alone, and a
 * text change keeps the text node. A MutationObserver stands in for the browser's own
 * style invalidation: what it reports is what Chromium's `:has()` check reacts to.
 *
 * Run directly:  node --test shells/web/src/lib/steady-dom.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { setHidden, setText } from './steady-dom.ts';

const dom = new JSDOM('<!doctype html><html><body><div id="a">12%</div><div id="b"></div><div id="c"><b>x</b>y</div></body></html>');
const { document, MutationObserver } = dom.window;

async function records(work: () => void): Promise<MutationRecord[]> {
  const seen: MutationRecord[] = [];
  const mo = new MutationObserver((list) => { seen.push(...list); });
  mo.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
  work();
  seen.push(...mo.takeRecords());
  mo.disconnect();
  return seen;
}

test('setHidden writes only a change', async () => {
  const el = document.getElementById('b') as HTMLElement;
  assert.equal((await records(() => setHidden(el, false))).length, 0, 'already shown: no write');
  const hide = await records(() => setHidden(el, true));
  assert.deepEqual(hide.map(r => [r.type, r.attributeName]), [['attributes', 'hidden']]);
  assert.equal(el.hidden, true);
  assert.equal((await records(() => setHidden(el, true))).length, 0, 'already hidden: no write');
});

test('setText leaves equal text alone and keeps the text node when it changes', async () => {
  const el = document.getElementById('a')!;
  const node = el.firstChild;
  assert.equal((await records(() => setText(el, '12%'))).length, 0);
  const moved = await records(() => setText(el, '13%'));
  assert.deepEqual(moved.map(r => r.type), ['characterData'], 'the node data changed, no child list change');
  assert.equal(el.firstChild, node, 'the same text node');
  assert.equal(el.textContent, '13%');
});

test('setText falls back to textContent for an empty or mixed element', async () => {
  const empty = document.getElementById('b')!;
  setText(empty, 'first');
  assert.equal(empty.textContent, 'first');
  assert.equal(empty.childNodes.length, 1);
  const mixed = document.getElementById('c')!;
  assert.equal((await records(() => setText(mixed, 'xy'))).length, 0, 'same text: no write even with mixed children');
  setText(mixed, 'z');
  assert.equal(mixed.innerHTML, 'z');
});

test('no stylesheet keys a :has() on the style attribute', async () => {
  // An attribute selector on `style` inside any :has() turns every inline style write on
  // the page (the canvas chrome makes dozens a frame) into a :has() check up to <html>.
  const { readFileSync, readdirSync } = await import('node:fs');
  const { join } = await import('node:path');
  const root = new URL('..', import.meta.url).pathname;
  const offenders: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith('.css')) {
        const css = readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
        for (const m of css.matchAll(/:has\(([^{]*)/g)) if (/\[\s*style\b/.test(m[1]!)) offenders.push(`${path}: ${m[0]!.slice(0, 80)}`);
      }
    }
  };
  walk(root);
  assert.ok(root.endsWith('/src/'), root);
  assert.deepEqual(offenders, []);
});
