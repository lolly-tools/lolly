// SPDX-License-Identifier: MPL-2.0
/**
 * The docs landing under the dark theme and the app's Reduce motion switch, in a real
 * Chromium: what the node suites can only read off the source.
 *
 *  1. EVERY RULE THAT STARTS FROM <html>. The in-app reader injects
 *     styles/parts/docs-landing.css inside `@scope (.docs-landing)`, where such a rule
 *     never matched (lib/docs-landing.ts, liftRootConditions). Each one in the file
 *     becomes a probe: the same selector setting a marker property, on an element
 *     built to match it, as a direct child of the scope root and deeper down. Under
 *     the reader's stylesheet every probe must fire when <html> carries its attributes
 *     and stay silent when it does not, exactly as on the unscoped /info page. The
 *     plain @scope wrap the reader used before is the control: it fires none, which
 *     shows the probes can see the fault they guard against.
 *  2. THE DECLARATIONS THEMSELVES on a few landing elements: a dark-theme colour, the
 *     hero entrance and the cycling word's transition, read from computed styles.
 *  3. THE COVER FLOW (lib/covers-flow.ts, the one module both surfaces run): it steps
 *     and plays its clips for a reader who asked for nothing, holds still for either
 *     signal, stops at the next beat when a signal arrives mid-play and picks up again
 *     when it goes. Time runs on Playwright's clock, so no test waits for real seconds.
 *
 * A green run without Chromium means "not exercised": the file skips by name where
 * Playwright's Chromium is not installed (`pnpm exec playwright install chromium`).
 *
 * Run directly: node --import ./tests/css-stub.mjs --test tests/docs-reader-scope.browser.test.ts
 */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSync } from 'esbuild';
import type { Browser, BrowserType, Page } from 'playwright';
import { landingStyleText } from '../shells/web/src/lib/docs-landing.ts';

const REPO = fileURLToPath(new URL('..', import.meta.url));
const SOURCE = readFileSync(join(REPO, 'shells/web/src/styles/parts/docs-landing.css'), 'utf-8');

async function chromiumOrSkip(): Promise<{ chromium: BrowserType } | string> {
  let chromium: BrowserType;
  try { ({ chromium } = await import('playwright')); } catch { return 'no Playwright (pnpm install)'; }
  try {
    const p = chromium.executablePath();
    if (!p || !existsSync(p)) return 'no Chromium (pnpm exec playwright install chromium)';
  } catch { return 'no Chromium (pnpm exec playwright install chromium)'; }
  return { chromium };
}
const browserOrReason = await chromiumOrSkip();
const skip = typeof browserOrReason === 'string' ? browserOrReason : false;

let browser: Browser | undefined;
before(async () => { if (typeof browserOrReason !== 'string') browser = await browserOrReason.chromium.launch({ headless: true }); });
after(async () => { await browser?.close(); });

async function page(): Promise<Page> {
  const p = await browser!.newPage({ viewport: { width: 1280, height: 900 } });
  p.on('pageerror', (e) => { throw e; });
  return p;
}

// ── 1. Every rule that starts from <html> ─────────────────────────────────────

/** One selector of the file, turned into something the browser can be asked about. */
interface Probe {
  n: number;
  selector: string;
  /** The attributes <html> must carry for the selector to match. */
  attrs: Array<[string, string]>;
  /** The element chain under the root compound: tag, classes and attributes, and how
   *  each joins the previous one. */
  chain: Array<{ tag: string; classes: string[]; attrs: Array<[string, string]>; join: string }>;
  pseudo: string;
}

const decomment = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

/** Every selector arm of every style rule at any depth, @keyframes left out. */
function selectorArms(css: string): string[] {
  const out: string[] = [];
  let prelude = '';
  for (let i = 0; i < css.length; i++) {
    const ch = css[i]!;
    if (ch === '{') {
      const head = prelude.trim();
      prelude = '';
      if (/^@(?:media|supports|container|layer)\b/i.test(head)) continue;
      let depth = 1;
      const open = i;
      while (++i < css.length && depth) { if (css[i] === '{') depth++; else if (css[i] === '}') depth--; }
      i--;
      if (head.startsWith('@')) continue;
      void open;
      let d = 0;
      let cur = '';
      for (const c of head) {
        if (c === '(' || c === '[') d++;
        else if (c === ')' || c === ']') d--;
        if (c === ',' && d === 0) { out.push(cur.replace(/\s+/g, ' ').trim()); cur = ''; continue; }
        cur += c;
      }
      out.push(cur.replace(/\s+/g, ' ').trim());
      continue;
    }
    if (ch === '}' || ch === ';') { prelude = ''; continue; }
    prelude += ch;
  }
  return out;
}

const ROOT_LED = /^(?:(?:html|:root)(?![\w-])\S*|(?:\[(?:data-theme|dir|lang|data-a11y-[a-z]+)(?![\w-])[^\]]*\])+)\s+/i;
const ATTR = /\[\s*([\w-]+)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\]\s]+)))?\s*\]/g;
/** The pseudo-classes a probe cannot hold the element in; they say nothing about <html>. */
const USER_ACTION = /:(?:hover|focus-visible|focus-within|focus|active)(?![\w-])/g;

function probes(): Probe[] {
  const out: Probe[] = [];
  for (const arm of selectorArms(decomment(SOURCE))) {
    const m = ROOT_LED.exec(arm);
    if (!m) continue;
    const root = m[0].trim();
    const rest = arm.slice(m[0].length).replace(USER_ACTION, '');
    const attrs = [...root.matchAll(ATTR)].map((a) => [a[1]!, a[2] ?? a[3] ?? a[4] ?? ''] as [string, string]);
    const chain: Probe['chain'] = [];
    let pseudo = '';
    let join = ' ';
    for (const token of rest.split(/\s*([>+~])\s*|\s+/).filter((t) => t !== undefined && t !== '')) {
      if (token === '>' || token === '+' || token === '~') { join = token; continue; }
      let compound = token;
      const pe = /::?(?:before|after|first-line|first-letter|placeholder|marker|backdrop)$/.exec(compound);
      if (pe) { pseudo = pe[0].startsWith('::') ? pe[0] : `:${pe[0]}`; compound = compound.slice(0, pe.index); }
      const bare = compound.replace(/:(?:not|is|where|has)\([^)]*\)/g, '').replace(/:[\w-]+(?:\([^)]*\))?/g, '');
      chain.push({
        tag: /^[a-z][\w-]*/i.exec(bare)?.[0] ?? 'div',
        classes: [...bare.matchAll(/\.([\w-]+)/g)].map((c) => c[1]!),
        attrs: [...bare.matchAll(ATTR)].map((a) => [a[1]!, a[2] ?? a[3] ?? a[4] ?? ''] as [string, string]),
        join,
      });
      join = ' ';
    }
    out.push({ n: out.length, selector: `${root} ${rest}`, attrs, chain, pseudo });
  }
  return out;
}

/** Build every probe's element twice under the scope root, once as a direct child and
 *  once a level down, and mark each subject with its probe number. */
async function mountProbes(p: Page, list: Probe[]): Promise<void> {
  const props = list.map((x) => `@property --probe-${x.n}{syntax:'*';inherits:false}`).join('\n');
  await p.setContent(`<!doctype html><html><head><style>${props}</style><style id="sheet"></style></head>`
    + '<body><div class="docs-reader docs-reader--landing"><article class="docs-landing page-index"></article></div></body></html>');
  await p.evaluate((all) => {
    const root = document.querySelector('.docs-landing')!;
    const deep = document.createElement('div');
    root.appendChild(deep);
    for (const parent of [root, deep]) {
      for (const probe of all) {
        let at: Element = parent;
        let last: Element | null = null;
        for (const step of probe.chain) {
          const el = document.createElement(step.tag);
          for (const c of step.classes) el.classList.add(c);
          for (const [k, v] of step.attrs) el.setAttribute(k, v);
          if ((step.join === '+' || step.join === '~') && last) last.after(el);
          else at.appendChild(el);
          last = el;
          at = el;
        }
        last?.setAttribute('data-probe', String(probe.n));
        last?.setAttribute('data-place', parent === root ? 'direct' : 'deep');
      }
    }
  }, list);
}

/** Which probes fire on each placement with their attributes on <html>, and which fire
 *  with none. */
async function readProbes(p: Page, css: string, list: Probe[]) {
  await p.evaluate((text) => { document.getElementById('sheet')!.textContent = text; }, css);
  return p.evaluate((all) => {
    const html = document.documentElement;
    const clear = (): void => { for (const name of [...html.getAttributeNames()]) html.removeAttribute(name); };
    const read = (probe: typeof all[number], place: string): boolean => {
      const el = document.querySelector(`[data-probe="${probe.n}"][data-place="${place}"]`);
      if (!el) return false;
      return getComputedStyle(el, probe.pseudo || null).getPropertyValue(`--probe-${probe.n}`).trim() === 'hit';
    };
    const out: Array<{ n: number; on: boolean[]; off: boolean[] }> = [];
    for (const probe of all) {
      clear();
      for (const [k, v] of probe.attrs) html.setAttribute(k, v);
      const on = [read(probe, 'direct'), read(probe, 'deep')];
      clear();
      const off = [read(probe, 'direct'), read(probe, 'deep')];
      out.push({ n: probe.n, on, off });
    }
    return out;
  }, list);
}

test('every rule that starts from <html> matches in the reader as it does on /info', { skip }, async () => {
  const list = probes();
  assert.ok(list.length >= 80, `only ${list.length} rules start from <html>, so the probe parser has stopped seeing the sheet`);
  const probeCss = list.map((x) => `${x.selector}{--probe-${x.n}:hit}`).join('\n');
  const p = await page();
  try {
    await mountProbes(p, list);
    const fails = (rows: Awaited<ReturnType<typeof readProbes>>, want: boolean) => rows
      .filter((r) => r.on.some((v) => v !== want) || r.off.some(Boolean))
      .map((r) => `  ${list[r.n]!.selector}  on=${r.on.join('/')} off=${r.off.join('/')}`);

    const page_ = await readProbes(p, probeCss, list);
    assert.deepEqual(fails(page_, true), [], 'the unscoped page (/info) misses these, so the probes are not built right');

    const reader = await readProbes(p, landingStyleText(probeCss), list);
    assert.deepEqual(fails(reader, true), [],
      "these rules start from <html> and do not match in the reader's scoped stylesheet the way they do on /info");

    const plain = await readProbes(p, `@scope (.docs-landing) {\n${probeCss}\n}`, list);
    const fired = plain.filter((r) => r.on.some(Boolean)).map((r) => `  ${list[r.n]!.selector}`);
    assert.deepEqual(fired, [],
      'a plain @scope wrap now matches these rules, so the probes no longer show the fault the rewrite exists for');
  } finally {
    await p.close();
  }
});

// ── 2. The declarations themselves ────────────────────────────────────────────

const FRAGMENT = `<div class="docs-reader docs-reader--landing"><article class="docs-landing page-index">
  <section class="hero"><div class="hero-heading">Lolly</div>
    <h1 class="hero-statement hero-statement--cycle"><a id="heroCycle" class="cycle-word" href="#"><span>is free</span></a></h1></section>
  <section class="formats-section"><span class="fmt-chip">PDF</span></section>
  <section class="faq-section"><div class="faq-item">Is it free?</div></section>
</article></div>`;

async function readFragment(p: Page, css: string, attrs: Record<string, string>) {
  return p.evaluate(({ text, set }) => {
    document.getElementById('sheet')!.textContent = text;
    const html = document.documentElement;
    for (const name of ['data-theme', 'data-a11y-motion', 'dir']) html.removeAttribute(name);
    for (const [k, v] of Object.entries(set)) html.setAttribute(k, v);
    // A new sheet or attribute starts the chip's own colour transition: read where it
    // ends, not its first frame.
    for (const a of document.getAnimations()) { try { a.finish(); } catch { /* an endless animation */ } }
    const cs = (sel: string) => getComputedStyle(document.querySelector(sel)!);
    return {
      chip: cs('.fmt-chip').color,
      faq: cs('.faq-item').backgroundColor,
      entrance: cs('.hero-heading').animationName,
      word: cs('.cycle-word span').transitionProperty,
    };
  }, { text: css, set: attrs });
}

test("the reader's landing takes the dark theme and Reduce motion from <html>", { skip }, async () => {
  const p = await page();
  try {
    await p.setContent(`<!doctype html><html><head><style>:root{--pale:hsl(210 10% 20%)}</style>`
      + `<style id="sheet"></style></head><body>${FRAGMENT}</body></html>`);
    const reader = landingStyleText(SOURCE);
    const light = await readFragment(p, reader, {});
    assert.equal(light.chip, 'rgb(18, 122, 69)', 'the light chip colour changed, so this test no longer reads the rule it means to');
    assert.equal(light.entrance, 'heroUp');
    assert.equal(light.word, 'transform, opacity');

    const dark = await readFragment(p, reader, { 'data-theme': 'dark' });
    assert.equal(dark.chip, 'rgb(127, 231, 180)', 'the dark-theme chip rule did not apply in the reader');
    assert.equal(dark.faq, 'rgb(46, 51, 56)', 'the dark-theme rule in its bare [data-theme] form did not apply in the reader');

    const calm = await readFragment(p, reader, { 'data-a11y-motion': 'reduce' });
    assert.equal(calm.entrance, 'none', "the hero entrance still runs under the app's Reduce motion switch");
    assert.equal(calm.word, 'none', "the cycling word still transitions under the app's Reduce motion switch");

    // The wrap the reader used before, for the record of what this fixes.
    const before = await readFragment(p, `@scope (.docs-landing) {\n${SOURCE}\n}`, { 'data-theme': 'dark', 'data-a11y-motion': 'reduce' });
    assert.equal(before.chip, 'rgb(18, 122, 69)');
    assert.equal(before.entrance, 'heroUp');
  } finally {
    await p.close();
  }
});

// ── 3. The cover flow ─────────────────────────────────────────────────────────

const COVERS_JS = buildSync({
  entryPoints: [join(REPO, 'shells/web/src/lib/covers-flow.ts')],
  bundle: true, write: false, format: 'iife', globalName: 'LollyCoverFlow', platform: 'browser', target: 'es2019', logLevel: 'silent',
}).outputFiles[0]!.text;

const COVERS = `<style>#coversStrip{display:flex;overflow-x:hidden;width:640px}.cover-card{flex:none;display:block;width:200px;height:120px}</style>
<section class="covers-section"><div id="coversRoot"><div id="coversStrip">${
  [0, 60, 120, 180, 240, 300].map((hue, i) => `<a class="cover-card" href="#c${i}" data-hue="${hue}"><video muted loop autoplay></video><span class="cover-cap"><b>Cover ${i}</b></span></a>`).join('')
}</div><div class="covers-nav" hidden><button data-covers="prev"></button><div class="covers-dots"></div><button data-covers="next"></button></div>
<a class="covers-open-btn" data-tpl="Open {name}"><span></span></a></div></section>`;

/** A page with the cover flow on Playwright's clock and the clips' playback recorded:
 *  a clip with no source cannot really play, so play() and pause() set a flag. */
async function covers(asked: { os?: boolean; app?: boolean }) {
  const p = await page();
  await p.clock.install({ time: 0 });
  await p.emulateMedia({ reducedMotion: asked.os ? 'reduce' : 'no-preference' });
  await p.addInitScript(() => {
    const playing = new WeakSet<HTMLMediaElement>();
    Object.defineProperty(HTMLMediaElement.prototype, 'paused', { configurable: true, get() { return !playing.has(this); } });
    HTMLMediaElement.prototype.play = function play() { playing.add(this); return Promise.resolve(); };
    HTMLMediaElement.prototype.pause = function pause() { playing.delete(this); };
  });
  await p.setContent(`<!doctype html><html${asked.app ? ' data-a11y-motion="reduce"' : ''}><head></head><body>${COVERS}</body></html>`);
  await p.addScriptTag({ content: `${COVERS_JS}\nLollyCoverFlow.mountCoverFlow(document);` });
  return {
    p,
    /** The real cover the fan has centred, by its dot. */
    current: () => p.evaluate(() => [...document.querySelectorAll('.covers-dot')].findIndex((d) => d.getAttribute('aria-current') === 'true')),
    playing: () => p.evaluate(() => [...document.querySelectorAll<HTMLVideoElement>('#coversStrip .cover-card:not(.is-clone) video')].filter((v) => !v.paused).length),
    setApp: (on: boolean) => p.evaluate((v) => { if (v) document.documentElement.dataset.a11yMotion = 'reduce'; else delete document.documentElement.dataset.a11yMotion; }, on),
  };
}

/** One autoplay beat (4.5 s) and the settle that follows. */
const BEAT = 4500 + 1500;

test('the cover flow steps and plays its clips for a reader who asked for nothing', { skip }, async () => {
  const c = await covers({});
  try {
    await c.p.clock.runFor(200);
    const start = await c.current();
    assert.ok(start >= 0, 'no cover is current, so the fan did not mount');
    assert.equal(await c.playing(), 6, 'the clips are not playing');
    await c.p.clock.runFor(BEAT);
    assert.equal(await c.current(), (start + 1) % 6, 'the autoplay did not step on');
  } finally {
    await c.p.close();
  }
});

test('the cover flow holds still for either signal', { skip }, async () => {
  for (const [signal, asked] of [['the OS setting', { os: true }], ["the app's switch", { app: true }]] as const) {
    const c = await covers(asked);
    try {
      await c.p.clock.runFor(200);
      const start = await c.current();
      assert.equal(await c.playing(), 0, `the clips play under ${signal}`);
      await c.p.clock.runFor(BEAT * 3);
      assert.equal(await c.current(), start, `the autoplay stepped under ${signal}`);
      assert.equal(await c.playing(), 0, `a clip started under ${signal}`);
    } finally {
      await c.p.close();
    }
  }
});

test("the app's switch stops the cover flow at the next beat, and lets it go again", { skip }, async () => {
  const c = await covers({});
  try {
    await c.p.clock.runFor(200);
    const start = await c.current();
    await c.p.clock.runFor(BEAT);
    const stepped = await c.current();
    assert.equal(stepped, (start + 1) % 6);

    await c.setApp(true);
    await c.p.clock.runFor(BEAT * 2);
    assert.equal(await c.current(), stepped, 'the autoplay kept stepping after Reduce motion was turned on');
    assert.equal(await c.playing(), 0, 'the clips kept playing after Reduce motion was turned on');

    await c.setApp(false);
    await c.p.clock.runFor(BEAT);
    assert.equal(await c.current(), (stepped + 1) % 6, 'the autoplay did not pick up again once Reduce motion was off');
    assert.equal(await c.playing(), 6, 'the clips did not play again once Reduce motion was off');
  } finally {
    await c.p.close();
  }
});
