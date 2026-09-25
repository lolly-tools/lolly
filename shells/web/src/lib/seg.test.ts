// SPDX-License-Identifier: MPL-2.0
/**
 * lib/seg.ts - the segmented-control markup, in both looks.
 *
 * The app variant is pinned byte for byte: 116 call sites across the gallery, the
 * brand studio, the theme toggle and the text tools read that markup, and the panel
 * variant was added beside it, not over it. The panel variant is pinned by what it
 * must and must not carry (`.lp-seg`, never `.view-seg-btn`), and its tab form by the
 * ARIA tabs pattern, including a round trip through lib/tabs.ts `wireTabs`, which is
 * what a caller wires it with.
 *
 * The last test is a computed-style probe in a real Chromium over tokens.css and
 * panel.css: the chosen half must be LIGHTER than its track in every theme (in dark
 * it used to be darker, so it read as pressed in), the tab form must look exactly
 * like the pressed form, and a busy group must dim its halves. It skips by name
 * where Playwright's Chromium is not installed (`pnpm exec playwright install
 * chromium`); a green run without it means "not exercised".
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import type { BrowserType } from 'playwright';

import { segHtml } from './seg.ts';
import { wireTabs } from './tabs.ts';

const OPTS = [{ id: 'a', label: 'Original' }, { id: 'b', label: 'Proposed' }, { id: 'c', label: 'Both' }];

function parse(html: string): { doc: Document; group: HTMLElement; buttons: HTMLButtonElement[] } {
  const doc = new JSDOM(`<!doctype html><body>${html}</body>`).window.document;
  const group = doc.body.firstElementChild as HTMLElement;
  return { doc, group, buttons: [...group.querySelectorAll('button')] };
}

test('the app variant is unchanged, byte for byte', () => {
  const html = segHtml('scheme', [{ id: 'l', label: 'Light' }, { id: 'd', label: 'Dark' }], 'd', 'Colour scheme',
    { attr: 'data-kind', extraClass: 'x-seg', groupAttr: 'data-be-schemekind' });
  assert.equal(html, `
  <div class="view-seg be-seg x-seg" role="group" aria-label="Colour scheme" data-be-seg="scheme" data-be-schemekind>
    <button type="button" class="view-seg-btn" data-val="l" data-kind="l" aria-pressed="false">Light</button><button type="button" class="view-seg-btn" data-val="d" data-kind="d" aria-pressed="true">Dark</button>
  </div>`);
  // `variant: 'app'` spelled out is the same thing as leaving it out.
  assert.equal(segHtml('s', OPTS, 'a', 'Show', { variant: 'app' }), segHtml('s', OPTS, 'a', 'Show'));
});

test('the panel variant writes .lp-seg and nothing of the app look', () => {
  const html = segHtml('show', OPTS, 'b', 'Show', { variant: 'panel', extraClass: 'rb-cmp-toggle', attr: 'data-show' });
  const { group, buttons } = parse(html);
  assert.equal(group.className, 'lp-seg rb-cmp-toggle');
  assert.equal(group.getAttribute('role'), 'group');
  assert.equal(group.getAttribute('aria-label'), 'Show');
  assert.equal(group.dataset.beSeg, 'show', 'the name hook is kept, so a caller can switch looks without rewiring');
  assert.doesNotMatch(html, /view-seg|be-seg /u, 'no class of the app look');
  assert.deepEqual(buttons.map((b) => b.getAttribute('aria-pressed')), ['false', 'true', 'false']);
  assert.deepEqual(buttons.map((b) => b.dataset.val), ['a', 'b', 'c']);
  assert.deepEqual(buttons.map((b) => b.dataset.show), ['a', 'b', 'c']);
  for (const b of buttons) {
    assert.equal(b.getAttribute('type'), 'button');
    assert.equal(b.className, '', 'a half is styled as `.lp-seg > button`, so it carries no class');
    assert.equal(b.hasAttribute('role'), false);
    assert.equal(b.hasAttribute('aria-selected'), false);
  }
});

test('the tab form is the ARIA tabs pattern, with one tab stop', () => {
  const html = segHtml('queue', [
    { id: 'review', label: 'To review', count: 5, controls: 'rb-q-list' },
    { id: 'all', label: 'All slides', count: 12, controls: 'rb-q-list' },
    { id: 'removed', label: 'Removed', count: 2 },
  ], 'review', 'Queue', { variant: 'panel', tabs: true, attr: 'data-rb-tab' });
  const { group, buttons } = parse(html);
  assert.equal(group.getAttribute('role'), 'tablist');
  assert.deepEqual(buttons.map((b) => b.getAttribute('role')), ['tab', 'tab', 'tab']);
  assert.deepEqual(buttons.map((b) => b.getAttribute('aria-selected')), ['true', 'false', 'false']);
  assert.deepEqual(buttons.map((b) => b.getAttribute('tabindex')), ['0', '-1', '-1']);
  assert.deepEqual(buttons.map((b) => b.getAttribute('aria-controls')), ['rb-q-list', 'rb-q-list', null]);
  assert.ok(buttons.every((b) => !b.hasAttribute('aria-pressed')), 'a tab is selected, never pressed');
  // The count is part of the name (Label in Name) and drawn at its own weight.
  assert.deepEqual(buttons.map((b) => b.textContent), ['To review 5', 'All slides 12', 'Removed 2']);
  assert.deepEqual(buttons.map((b) => b.querySelector('b.lp-seg-count')?.textContent), ['5', '12', '2']);
});

test('the tab form is ignored by the app look, which cannot draw aria-selected', () => {
  const { group, buttons } = parse(segHtml('s', OPTS, 'a', 'Show', { tabs: true }));
  assert.equal(group.getAttribute('role'), 'group');
  assert.ok(buttons.every((b) => b.hasAttribute('aria-pressed') && !b.hasAttribute('role')));
});

test('wireTabs drives the tab form: click and arrow keys move the one tab stop', () => {
  const { doc, group, buttons } = parse(segHtml('queue', [
    { id: 'review', label: 'To review' }, { id: 'all', label: 'All slides' }, { id: 'removed', label: 'Removed' },
  ], 'review', 'Queue', { variant: 'panel', tabs: true, attr: 'data-rb-tab' }));
  const seen: string[] = [];
  wireTabs(group, { key: 'rbTab', onSelect: (value) => seen.push(value) });
  buttons[1]!.click();
  assert.deepEqual(buttons.map((b) => b.getAttribute('aria-selected')), ['false', 'true', 'false']);
  assert.deepEqual(buttons.map((b) => b.tabIndex), [-1, 0, -1]);
  const win = doc.defaultView!;
  buttons[1]!.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  assert.equal(doc.activeElement, buttons[2]);
  assert.deepEqual(buttons.map((b) => b.getAttribute('aria-selected')), ['false', 'false', 'true']);
  buttons[2]!.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
  assert.deepEqual(seen, ['all', 'removed', 'review']);
});

test('busy marks the group, and only when asked', () => {
  assert.equal(parse(segHtml('s', OPTS, 'a', 'Show', { variant: 'panel', busy: true })).group.getAttribute('aria-busy'), 'true');
  assert.equal(parse(segHtml('s', OPTS, 'a', 'Show', { variant: 'panel' })).group.hasAttribute('aria-busy'), false);
});

test('labels, values and counts are escaped', () => {
  const html = segHtml('n"x', [{ id: 'a"><i', label: '<b>Bold</b> & co' }], 'a"><i', 'Say "hi"', { variant: 'panel', labelledBy: 'h"1' });
  const { group, buttons } = parse(html);
  assert.equal(group.getAttribute('aria-labelledby'), 'h"1');
  assert.equal(group.hasAttribute('aria-label'), false, 'labelledBy replaces the label');
  assert.equal(buttons.length, 1);
  assert.equal(buttons[0]!.dataset.val, 'a"><i');
  assert.equal(buttons[0]!.textContent, '<b>Bold</b> & co');
  assert.equal(buttons[0]!.getAttribute('aria-pressed'), 'true');
});

// ─── computed style, in Chromium ─────────────────────────────────────────────

async function chromiumOrSkip(): Promise<{ chromium: BrowserType } | string> {
  let chromium: BrowserType;
  try { ({ chromium } = await import('playwright')); }
  catch { return 'playwright not installed'; }
  try {
    const p = chromium.executablePath();
    if (!p || !existsSync(p)) return 'no Chromium (pnpm exec playwright install chromium)';
  } catch { return 'no Chromium (pnpm exec playwright install chromium)'; }
  return { chromium };
}
const browserOrReason = await chromiumOrSkip();

interface SegProbe { track: number[]; on: number[]; tab: number[]; busyOpacity: string; busyCursor: string; groupOpacity: string }

test('the chosen half is lighter than its track in every theme, and the tab form matches it', {
  skip: typeof browserOrReason === 'string' ? browserOrReason : false,
}, async () => {
  if (typeof browserOrReason === 'string') return;
  const css = ['../styles/tokens.css', '../styles/parts/panel.css']
    .map((rel) => readFileSync(new URL(rel, import.meta.url), 'utf8')).join('\n');
  // multi-edit.css's unscoped busy rule is loaded too: the group must stay at full
  // opacity under it, with only its halves dimmed.
  const multi = readFileSync(new URL('../styles/parts/multi-edit.css', import.meta.url), 'utf8');
  const markup = segHtml('s', OPTS, 'b', 'Show', { variant: 'panel' })
    + segHtml('t', OPTS, 'b', 'Tabs', { variant: 'panel', tabs: true })
    + segHtml('u', OPTS, 'b', 'Busy', { variant: 'panel', busy: true });
  const browser = await browserOrReason.chromium.launch();
  try {
    const page = await browser.newPage();
    for (const [theme, contrast] of [['light', ''], ['dark', ''], ['brand', ''], ['dark', 'high'], ['light', 'high']] as const) {
      await page.setContent(`<!doctype html><html data-theme="${theme}"${contrast ? ` data-a11y-contrast="${contrast}"` : ''}>
        <head><style>:root { --a11y-fs: 1; }\n${css}\n${multi}</style></head>
        <body style="background: var(--ui-color-surface-raised)">${markup}</body></html>`);
      const probe = await page.evaluate((): SegProbe => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 1;
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
        const rgb = (el: Element): number[] => {
          ctx.clearRect(0, 0, 1, 1);
          ctx.fillStyle = getComputedStyle(el).backgroundColor;
          ctx.fillRect(0, 0, 1, 1);
          return [...ctx.getImageData(0, 0, 1, 1).data.slice(0, 3)];
        };
        const [seg, tabs, busy] = [...document.querySelectorAll('.lp-seg')];
        const busyBtn = busy!.querySelector('button')!;
        return {
          track: rgb(seg!),
          on: rgb(seg!.querySelector('[aria-pressed="true"]')!),
          tab: rgb(tabs!.querySelector('[aria-selected="true"]')!),
          busyOpacity: getComputedStyle(busyBtn).opacity,
          busyCursor: getComputedStyle(busyBtn).cursor,
          groupOpacity: getComputedStyle(busy!).opacity,
        };
      });
      const lum = (c: number[]): number => {
        const [r, g, b] = c.map((v) => { const s = v / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
        return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
      };
      const where = `${theme}${contrast ? ` + ${contrast} contrast` : ''}`;
      assert.ok(lum(probe.on) > lum(probe.track),
        `${where}: the chosen half (${probe.on}) is lighter than its track (${probe.track})`);
      assert.deepEqual(probe.tab, probe.on, `${where}: a selected tab looks exactly like a pressed half`);
      assert.equal(probe.busyOpacity, '0.6', `${where}: a busy group dims its halves`);
      assert.equal(probe.busyCursor, 'progress', `${where}: and shows the progress cursor`);
      assert.equal(probe.groupOpacity, '1', `${where}: once, not twice under multi-edit.css`);
    }
  } finally {
    await browser.close();
  }
});
