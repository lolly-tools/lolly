// SPDX-License-Identifier: MPL-2.0
/**
 * Opening a tool: what moves and what holds still, read from the real stylesheets in
 * Chromium (plan 371, M2b).
 *
 * The held snapshot of the view that was left (`.view-fade--hold`, view-fade.ts) ends
 * every animation and transition in it at once, at its last frame, except inside the
 * render canvas and the export stages, which this change must never touch. Moving nodes
 * into the snapshot restarts their CSS animations, so an entrance (a card fading in)
 * must show its end, not its first frame, or the snapshot goes blank. The loading card is the one thing that
 * moves, and only the mark shading the theme shows spins: the hidden twin used to spin
 * as well, on the main thread, because a display:none ring cannot run on the compositor.
 * Under either reduced-motion switch the mark is still. The pressed card keeps its dim
 * while the gallery's entrance cascade still holds its opacity.
 *
 * Self-skipping by name where Playwright's Chromium is not installed
 * (`pnpm exec playwright install chromium`).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { LOLLY_MARK_SVG } from './lib/lolly-mark.ts';

async function chromiumOrSkip(): Promise<{ chromium: any } | string> {
  let chromium: any;
  try { ({ chromium } = await import('playwright')); }
  catch { return 'playwright not installed'; }
  try {
    const p = chromium.executablePath();
    if (!p || !existsSync(p)) return 'no Chromium (pnpm exec playwright install chromium)';
  } catch { return 'no Chromium (pnpm exec playwright install chromium)'; }
  return { chromium };
}

const browser = await chromiumOrSkip();
const SKIP = typeof browser === 'string' ? browser : false;
const sheet = (name: string): string => readFileSync(new URL(`./styles/parts/${name}`, import.meta.url), 'utf8');

const PAGE = `<!doctype html><html><head>
<style>${sheet('base.css')}</style>
<style>${sheet('components.css')}</style>
<style>${sheet('dialogs.css')}</style>
<style>${sheet('gallery.css')}</style>
<style>
  :root { --enter-dur: .32s; --enter-ease: ease; --dur-1: .12s; --ease-out: cubic-bezier(.32, .72, 0, 1); }
  @keyframes probe-pulse { to { opacity: .2; } }
  @keyframes probe-enter { from { opacity: 0; } }
  .probe, .probe::before { content: ''; animation: probe-pulse 1s infinite; transition: color 1s; }
  .enter { animation: probe-enter 1s .3s both; }
</style></head><body>
  <main id="view" class="app-view tool-view"></main>
  <div class="view-fade view-fade--hold app-view gallery-view" id="held">
    <span class="probe" id="chrome"></span>
    <span class="enter" id="held-enter"></span>
    <div class="tool-masonry reveal-armed">
      <article class="gtile is-in" id="revealed"></article>
      <article class="gtile is-in is-navigating" id="pressed"></article>
    </div>
    <div class="tool-canvas"><span class="probe" id="in-canvas"></span></div>
    <div id="tool-content"><span class="probe" id="in-content"></span></div>
    <div class="me-canvas"><span class="probe" id="in-stage"></span></div>
  </div>
  <div class="view-fade app-view" id="plain"><span class="probe" id="in-plain"></span></div>
  <span class="probe" id="live"></span>
  <span class="enter" id="live-enter"></span>
  <div class="tool-masonry reveal-armed" id="live-masonry"><article class="gtile is-in is-navigating" id="live-pressed"></article></div>
  <dialog class="modal view-loading" id="card"><span class="view-loading-mark">${LOLLY_MARK_SVG}</span></dialog>
  <script>document.getElementById('card').showModal();</script>
</body></html>`;

interface Reading {
  running: Record<string, boolean>;
  pseudoRunning: Record<string, boolean>;
  transition: Record<string, string>;
  enter: { held: string; live: string };
  holdVars: { dur: string; ease: string };
  rings: { variant: string; name: string; running: boolean }[];
  card: string;
  pressed: { filter: string; opacity: string };
}

async function read(page: any): Promise<Reading> {
  return page.evaluate(() => {
    const ids = ['chrome', 'in-canvas', 'in-content', 'in-stage', 'in-plain', 'live'];
    const cs = (id: string, pseudo: string | null = null) => getComputedStyle(document.getElementById(id)!, pseudo);
    const held = getComputedStyle(document.getElementById('held')!);
    const live = document.getAnimations().filter(a => a.playState === 'running').map(a => a.effect as KeyframeEffect);
    const running = new Set(live.filter(e => !e.pseudoElement).map(e => e.target));
    const pseudo = new Set(live.filter(e => e.pseudoElement === '::before').map(e => e.target));
    return {
      running: Object.fromEntries(ids.map(id => [id, running.has(document.getElementById(id))])),
      pseudoRunning: Object.fromEntries(ids.map(id => [id, pseudo.has(document.getElementById(id))])),
      transition: Object.fromEntries(ids.map(id => [id, cs(id).transitionProperty])),
      enter: { held: cs('held-enter').opacity, live: cs('live-enter').opacity },
      holdVars: { dur: held.getPropertyValue('--view-fade-dur').trim(), ease: held.getPropertyValue('--view-fade-ease').trim() },
      rings: [...document.querySelectorAll('.view-loading-mark [class*="lolly-mark__spin-"]')].map(el => ({
        variant: el.closest('.lolly-mark__primary') ? 'primary' : 'reverse',
        name: getComputedStyle(el).animationName,
        running: running.has(el),
      })),
      card: getComputedStyle(document.getElementById('card')!).animationName,
      pressed: { filter: cs('pressed').filter, opacity: cs('pressed').opacity },
    };
  });
}

test('opening a tool: the held snapshot holds still, the canvas and export stages do not', { skip: SKIP }, async () => {
  const b = await (browser as { chromium: any }).chromium.launch({ headless: true });
  try {
    const page = await b.newPage({ reducedMotion: 'no-preference' });
    await page.setContent(PAGE);
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    const r = await read(page);
    assert.equal(r.running.chrome, false, 'an endless pulse in the held snapshot has ended');
    assert.equal(r.pseudoRunning.chrome, false, 'and on its pseudo-elements');
    assert.equal(r.transition.chrome, 'none', 'and its transitions');
    assert.equal(r.enter.held, '1', 'a restarted entrance shows its last frame at once, so the snapshot never goes blank');
    assert.equal(r.enter.live, '0', 'outside the snapshot the same entrance still waits on its delay');
    for (const id of ['in-canvas', 'in-content', 'in-stage']) {
      assert.equal(r.running[id], true, `${id}: a render inside the snapshot keeps its own motion`);
      assert.equal(r.pseudoRunning[id], true, `${id}::before keeps its own motion`);
      assert.equal(r.transition[id], 'color', `${id} keeps its own transition`);
    }
    assert.equal(r.running['in-plain'], true, 'a snapshot that is not held is unchanged');
    assert.equal(r.running.live, true, 'nothing outside the snapshot is touched');
    assert.deepEqual(r.holdVars, { dur: '.12s', ease: 'cubic-bezier(.32, .72, 0, 1)' }, 'the held snapshot fades out in --dur-1 (120 ms) on the --ease-out curve');
  } finally { await b.close(); }
});

test('opening a tool: the loading card spins only the mark the theme shows', { skip: SKIP }, async () => {
  const b = await (browser as { chromium: any }).chromium.launch({ headless: true });
  try {
    const page = await b.newPage({ reducedMotion: 'no-preference' });
    for (const theme of ['light', 'dark', 'brand'] as const) {
      await page.setContent(PAGE);
      await page.evaluate((t: string) => { document.documentElement.dataset.theme = t; }, theme);
      const { rings } = await read(page);
      const shown = theme === 'light' ? 'primary' : 'reverse';
      assert.equal(rings.length, 6, 'both shadings carry three rings');
      for (const ring of rings) {
        const spins = ring.variant === shown;
        assert.equal(ring.name, spins ? 'view-loading-spin' : 'none', `${theme}: the ${ring.variant} rings ${spins ? 'spin' : 'hold still'}`);
        assert.equal(ring.running, spins, `${theme}: ${ring.variant} ring animation ${spins ? 'runs' : 'does not exist'}`);
      }
    }
  } finally { await b.close(); }
});

test('reduced motion, the system setting or Lolly\'s own: the loading mark is a still mark', { skip: SKIP }, async () => {
  const b = await (browser as { chromium: any }).chromium.launch({ headless: true });
  try {
    for (const how of ['system', 'app'] as const) {
      const page = await b.newPage({ reducedMotion: how === 'system' ? 'reduce' : 'no-preference' });
      await page.setContent(PAGE);
      if (how === 'app') await page.evaluate(() => { document.documentElement.dataset.a11yMotion = 'reduce'; });
      const r = await read(page);
      assert.ok(r.rings.every(ring => ring.name === 'none' && !ring.running), `${how}: no ring turns`);
      assert.equal(r.card, 'none', `${how}: the card appears without its entrance`);
      await page.close();
    }
  } finally { await b.close(); }
});

test('the pressed card shows its dim while the entrance cascade still holds its opacity', { skip: SKIP }, async () => {
  const b = await (browser as { chromium: any }).chromium.launch({ headless: true });
  try {
    const page = await b.newPage({ reducedMotion: 'no-preference' });
    await page.setContent(PAGE);
    const r = await read(page);
    assert.equal(r.pressed.filter, 'opacity(0.6)', 'the dim rides filter');
    const live = await page.evaluate(() => getComputedStyle(document.getElementById('live-pressed')!).filter);
    assert.equal(live, 'opacity(0.6)', 'and shows in the live gallery, before the snapshot is taken');
  } finally { await b.close(); }
});

test('after the beat: the view leaves layout and paint, the top bar stays, the card stands on the plain ground', { skip: SKIP }, async () => {
  const b = await (browser as { chromium: any }).chromium.launch({ headless: true });
  try {
    const page = await b.newPage({ reducedMotion: 'no-preference' });
    await page.setContent(`<!doctype html><html><head>
      <style>${sheet('base.css')}</style><style>${sheet('components.css')}</style><style>${sheet('dialogs.css')}</style>
      </head><body>
      <div class="view-fade view-fade--hold app-view"><div class="gallery">
        <div class="gallery-topbar"><a class="profile-link" id="bar">me</a></div>
        <div class="tool-masonry view-fade-gone" id="cards"><article class="gtile">QR</article></div>
      </div></div>
      <dialog class="modal view-loading view-loading--plain" id="plain"></dialog>
      <dialog class="modal view-loading" id="dim"></dialog>
      </body></html>`);
    const r = await page.evaluate(() => {
      const plain = document.getElementById('plain') as HTMLDialogElement;
      plain.showModal();
      const plainBackdrop = getComputedStyle(plain, '::backdrop').backgroundColor;
      plain.close();
      const dim = document.getElementById('dim') as HTMLDialogElement;
      dim.showModal();
      const dimBackdrop = getComputedStyle(dim, '::backdrop').backgroundColor;
      return {
        cards: getComputedStyle(document.getElementById('cards')!).display,
        cardBox: (document.querySelector('.gtile') as HTMLElement).getClientRects().length,
        bar: getComputedStyle(document.getElementById('bar')!).display,
        plainBackdrop, dimBackdrop,
      };
    });
    assert.equal(r.cards, 'none', 'what leaves is out of layout');
    assert.equal(r.cardBox, 0, 'and has no box to paint');
    assert.notEqual(r.bar, 'none', 'the top bar stays');
    assert.equal(r.plainBackdrop, 'rgba(0, 0, 0, 0)', 'the plain card dims nothing');
    assert.notEqual(r.dimBackdrop, 'rgba(0, 0, 0, 0)', 'every other loading card keeps its backdrop');
  } finally { await b.close(); }
});

