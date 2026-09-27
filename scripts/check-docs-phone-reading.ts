#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Phone reading check for both docs readers: the static /info site and the in-app
 * reader at #/docs (plan 277, step 2).
 *
 * Usage:
 *   node scripts/check-docs-phone-reading.ts [--base=<url>] [--only=<slug,...>]
 *     [--app-sample=<door/slug,...>] [--rtl=<lang>] [--skip-rtl] [--skip-app]
 *     [--json=<path>] [--report-only] [--fail-on-nav] [--timeout=<ms>]
 *     [--info-dir=<built info dir>] [--reduced-motion] [--verbose]
 *
 * It measures a RUNNING dev server (default http://localhost:5173) and never builds
 * anything: the /info pages it visits are the ones already on disk under
 * shells/web/public/info, which is also where the page list comes from (every
 * English door page plus the landing, or the --only subset).
 *
 * --info-dir=<dir> measures a different build on disk (for example
 * shells/web/dist/info from the last build:web) without starting a server: the
 * browser answers every /info/ request, from both readers, with the file from that
 * directory, and a file that is not there is a 404. The app itself still comes from
 * the dev server. Use it to take a baseline from a known build while public/info is
 * being rebuilt.
 *
 * WHAT IT MEASURES
 * - /info at 320 and 390 CSS px: document scrollWidth against innerWidth twice, once
 *   on arrival (lazy images not yet loaded) and once after scrolling the whole page so
 *   every lazy image has loaded. Both readings matter: a figure wrapper that is 0 px
 *   wide before its image arrives and a credential box that only overflows once the
 *   image gives it a width are different bugs, and each shows in only one reading.
 *   For each overflowing reading it lists the elements that cross the scrollable edge
 *   (right in LTR, left in RTL) whose parent does not, which points at the cause
 *   rather than at every ancestor.
 * - /info navigation on the same pages: every top-bar control fully inside the
 *   viewport, the menu button's Tab position and size, the menu opening on Enter, and
 *   whether Escape closes it and gives focus back. Those are recorded, not assumed.
 * - The same pages in one RTL locale (ar by default): the --only list, or a sample of
 *   five pages when no list is given.
 * - #/docs for a sample of pages: the same overflow readings at 320 and 390, and at
 *   390 and 1024 whether topic navigation (the rail) and the on-page contents can be
 *   reached in the first screen, with their document y offsets.
 *
 * Emulation is a plain Chromium window at the given width (not mobile emulation), so
 * an overflowing page cannot make the browser zoom out and hide its own overflow.
 * Colour scheme light, locale en-US, device scale 1.
 *
 * UNAVAILABLE IS NOT OVERFLOW. Another process may be rebuilding /info while this
 * runs. A navigation error, an HTTP error, the app shell answering a docs URL (what
 * the dev server does for a file that is not there), a truncated response or a
 * timeout is retried once after a short wait, then reported as "unavailable" with the
 * reason. It never counts as overflow.
 *
 * EXIT CODES
 *   0  no phone overflow, or --report-only, or Chromium is not installed (skipped)
 *   1  at least one page overflows at 320 or 390 (and, with --fail-on-nav, a nav check
 *      failed)
 *   2  misuse, the server is not reachable, or nothing could be measured
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Browser, BrowserContext, Page, Response, Route } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_INFO_DIR = path.join(ROOT, 'shells/web/public/info');
const DOORS = ['start', 'create', 'build', 'operate', 'trust'] as const;

// Viewport heights paired with each width: iPhone SE (1st gen), iPhone 14, iPad landscape.
const VIEWPORT_HEIGHT: Record<number, number> = { 320: 568, 390: 844, 1024: 768 };
const INFO_WIDTHS = [320, 390];
const APP_WIDTHS = [320, 390, 1024];
const PHONE_MAX = 390;

const DEFAULT_APP_SAMPLE = [
  'create/using',
  'create/sequence-editor',
  'build/reproducibility',
  'build/host-api',
  'start/make-something',
];
const DEFAULT_RTL_SAMPLE = [
  'index',
  'create/using',
  'create/sequence-editor',
  'build/reproducibility',
  'trust/privacy',
];

const OVERFLOW_TOLERANCE_PX = 1;
const TOP_OFFENDERS = 5;
const SCROLL_PAUSE_MS = 60;
const MAX_SCROLL_STEPS = 400;
const IMAGE_WAIT_MS = 5000;
const RETRY_WAIT_MS = 2500;
const APP_SETTLE_MS = 700;
const MAX_TABS = 40;

const MIME: Record<string, string> = {
  html: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8', js: 'text/javascript; charset=utf-8',
  json: 'application/json', svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  webp: 'image/webp', gif: 'image/gif', woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf', otf: 'font/otf',
  md: 'text/markdown; charset=utf-8', txt: 'text/plain; charset=utf-8', xml: 'application/xml', vtt: 'text/vtt',
  opus: 'audio/ogg', ogg: 'audio/ogg', mp3: 'audio/mpeg', wav: 'audio/wav', mp4: 'video/mp4', webm: 'video/webm',
  pdf: 'application/pdf',
};

const USAGE = `Usage: node scripts/check-docs-phone-reading.ts [options]

  --base=<url>            dev server to measure (default http://localhost:5173)
  --only=<slug,...>       /info pages to measure, as door/slug (create/using), a bare
                          slug (using) or index; default every English door page + index
  --app-sample=<list>     #/docs pages (door/slug), default ${DEFAULT_APP_SAMPLE.join(',')}
  --rtl=<lang>            RTL locale for the RTL sample (default ar)
  --skip-rtl, --skip-app  leave out the RTL sample or the #/docs sample
  --json=<path>           write the full report here
  --report-only           always exit 0 after reporting (a baseline run)
  --fail-on-nav           also exit 1 when a menu or top-bar check fails
  --timeout=<ms>          per-page budget, retried once (default 60000)
  --info-dir=<dir>        answer /info/ requests from this built directory instead of
                          the server (for example shells/web/dist/info)
  --reduced-motion        emulate prefers-reduced-motion: reduce
  --verbose               one progress line per page on stderr`;

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------

function usageError(msg: string): never {
  console.error(`check-docs-phone-reading: ${msg}\n\n${USAGE}`);
  process.exit(2);
}

const argv = process.argv.slice(2);
if (argv.includes('--help') || argv.includes('-h')) {
  console.log(USAGE);
  process.exit(0);
}
const KNOWN = new Set(['base', 'only', 'app-sample', 'rtl', 'skip-rtl', 'skip-app', 'json', 'report-only',
  'fail-on-nav', 'timeout', 'info-dir', 'reduced-motion', 'verbose']);
const flags = new Map<string, string>();
for (const a of argv) {
  const m = /^--([a-z-]+)(?:=(.*))?$/.exec(a);
  const name = m?.[1];
  if (!name || !KNOWN.has(name)) usageError(`unknown argument ${a}`);
  flags.set(name, m?.[2] ?? '');
}
const listFlag = (name: string): string[] | null => {
  if (!flags.has(name)) return null;
  return (flags.get(name) ?? '').split(',').map((s) => s.trim().replace(/\.html$/, '')).filter(Boolean);
};

const opts = {
  base: (flags.get('base') || 'http://localhost:5173').replace(/\/+$/, ''),
  only: listFlag('only'),
  appSample: listFlag('app-sample') ?? DEFAULT_APP_SAMPLE,
  rtl: flags.get('rtl') || 'ar',
  skipRtl: flags.has('skip-rtl'),
  skipApp: flags.has('skip-app'),
  json: flags.get('json') ? path.resolve(flags.get('json') as string) : null,
  reportOnly: flags.has('report-only'),
  failOnNav: flags.has('fail-on-nav'),
  timeout: Number(flags.get('timeout') || 60000),
  infoDir: flags.get('info-dir') ? path.resolve(flags.get('info-dir') as string) : null,
  reducedMotion: flags.has('reduced-motion'),
  verbose: flags.has('verbose'),
};
if (!Number.isFinite(opts.timeout) || opts.timeout < 5000) usageError('--timeout must be a number of milliseconds, at least 5000');
if (flags.has('json') && !opts.json) usageError('--json needs a path');
if (flags.has('info-dir') && !opts.infoDir) usageError('--info-dir needs a path');
if (opts.infoDir && !existsSync(path.join(opts.infoDir, 'index.html'))) usageError(`--info-dir: no index.html in ${opts.infoDir}`);

// ---------------------------------------------------------------------------
// Page list, read from the built site on disk
// ---------------------------------------------------------------------------

const INFO_DIR = opts.infoDir ?? PUBLIC_INFO_DIR;

type InfoPage = { slug: string; file: string };

function enumerateInfoPages(): InfoPage[] {
  const pages: InfoPage[] = [];
  const index = path.join(INFO_DIR, 'index.html');
  if (existsSync(index)) pages.push({ slug: 'index', file: index });
  for (const door of DOORS) {
    const dir = path.join(INFO_DIR, door);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter((n) => n.endsWith('.html')).sort()) {
      pages.push({ slug: `${door}/${f.slice(0, -5)}`, file: path.join(dir, f) });
    }
  }
  return pages;
}

function resolveSlugs(wanted: string[], all: InfoPage[], what: string): string[] {
  const out: string[] = [];
  const unknown: string[] = [];
  for (const w of wanted) {
    const exact = all.find((p) => p.slug === w);
    const bare = exact ? null : all.filter((p) => p.slug.split('/').pop() === w);
    if (exact) out.push(exact.slug);
    else if (bare && bare.length === 1 && bare[0]) out.push(bare[0].slug);
    else unknown.push(bare && bare.length > 1 ? `${w} (ambiguous: ${bare.map((b) => b.slug).join(', ')})` : w);
  }
  if (unknown.length) usageError(`${what}: no built /info page for ${unknown.join(', ')}`);
  return [...new Set(out)];
}

const infoUrl = (slug: string, lang = 'en'): string =>
  `${opts.base}/info/${lang === 'en' ? '' : `${lang}/`}${slug === 'index' ? 'index' : slug}.html`;
const infoFile = (slug: string, lang = 'en'): string =>
  path.join(INFO_DIR, lang === 'en' ? '' : lang, `${slug}.html`);
const appUrl = (slug: string): string => `${opts.base}/#/docs/${slug}`;

// ---------------------------------------------------------------------------
// Result shapes
// ---------------------------------------------------------------------------

type Offender = {
  tag: string; id: string; sel: string; path: string; kind: 'box' | 'content';
  left: number; right: number; overshoot: number; invisible: boolean; text: string;
};
type OverflowReading = {
  innerWidth: number; clientWidth: number; scrollWidth: number; overflow: number;
  rtl: boolean; offenderCount: number; offenders: Offender[];
};
type LazyReading = { steps: number; docHeight: number; images: number; pending: number };
type Control = { label: string; left: number; right: number; top: number; bottom: number; inside: boolean };
type TopbarReading = {
  barFound: boolean; barScrollWidth: number | null; barClientWidth: number | null;
  controls: Control[]; outside: string[];
  button: {
    present: boolean; displayed: boolean; inside: boolean; left: number; right: number;
    width: number; height: number; ariaControls: string | null;
  };
};
type MenuReading = {
  present: boolean; open: boolean; expanded: string | null; fitsWidth: boolean; height: number;
  links: number; railLinks: number; lastLinkReachable: boolean | null; focusOnButton: boolean; focus: string;
};
type NavReading = TopbarReading & {
  tabStop: number | null;
  enterOpens: boolean | null;
  escapeCloses: boolean | null;
  focusReturned: boolean | null;
  openMenu: MenuReading | null;
  notes: string[];
};
type SlotReading = {
  selector: string; present: boolean; hiddenAttr: boolean; display: string; displayed: boolean;
  links: number; visibleLinks: number; top: number | null; bottom: number | null;
  entry: 'slot' | 'summary' | null; entryTop: number | null; inFirstScreen: boolean;
  viewportHeight: number; docHeight: number;
};
type DockReading = { present: boolean; visible: boolean; top: number | null; height: number | null; coverage: number };
type PageResult = {
  reader: 'info' | 'app'; lang: string; slug: string; url: string; width: number; height: number;
  status: 'ok' | 'unavailable'; reason?: string; attempts: number; ms: number;
  before?: OverflowReading; after?: OverflowReading; lazy?: LazyReading; nav?: NavReading;
  rail?: SlotReading; toc?: SlotReading; dock?: DockReading;
};

// ---------------------------------------------------------------------------
// In-page functions. Playwright serialises each one, so each must be self-contained.
// ---------------------------------------------------------------------------

function pageKind(): { info: boolean; app: boolean; title: string; emptySheets: string[] } {
  const app = !!document.getElementById('view');
  const info = !app && !!(document.querySelector('.site-bar') || document.querySelector('.docs-content, .docs-landing'));
  // A same-origin stylesheet that failed to load still leaves a sheet object, with no rules.
  const emptySheets: string[] = [];
  for (const link of Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel~="stylesheet"]'))) {
    if (new URL(link.href, location.href).origin !== location.origin) continue;
    let rules = 0;
    try { rules = link.sheet ? link.sheet.cssRules.length : 0; } catch { rules = 1; }
    if (!rules) emptySheets.push(link.getAttribute('href') ?? link.href);
  }
  return { info, app, title: document.title, emptySheets };
}

async function settleInPage(): Promise<void> {
  await document.fonts.ready;
  await new Promise<void>((res) => requestAnimationFrame(() => requestAnimationFrame(() => res())));
}

function readOverflow(top: number): OverflowReading {
  const de = document.documentElement;
  const body = document.body;
  const iw = window.innerWidth;
  const rtl = getComputedStyle(de).direction === 'rtl';
  const round = (n: number): number => Math.round(n * 10) / 10;
  const past = (r: DOMRect): number => (rtl ? -r.left : r.right - iw);
  const sig = (el: Element): string => {
    const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).filter(Boolean).slice(0, 2) : [];
    return el.tagName.toLowerCase() + (cls.length ? `.${cls.join('.')}` : '');
  };
  const ancestry = (el: Element): string => {
    const parts: string[] = [];
    for (let a = el.parentElement; a && a !== body && parts.length < 3; a = a.parentElement) parts.unshift(sig(a));
    return parts.join(' > ');
  };
  // A box that is fixed, or sits inside an ancestor that clips horizontal overflow,
  // cannot widen the page, so it is left out. Opacity 0 or visibility hidden still
  // takes layout space, so such a box counts and is marked invisible.
  const inspect = (el: Element): { skip: boolean; invisible: boolean } => {
    let invisible = false;
    for (let a: Element | null = el; a && a !== body; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.position === 'fixed') return { skip: true, invisible };
      if (a !== el && cs.overflowX !== 'visible') return { skip: true, invisible };
      if (cs.opacity === '0' || (a === el && cs.visibility === 'hidden')) invisible = true;
    }
    return { skip: false, invisible };
  };
  type Hit = { el: Element; r: DOMRect; over: number; invisible: boolean; kind: 'box' | 'content' };
  const hits: Hit[] = [];
  const all = Array.from(body.querySelectorAll('*'));
  for (const el of all) {
    if (el instanceof SVGElement && !(el instanceof SVGSVGElement)) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    const over = past(r);
    if (over <= 1) continue;
    const parent = el.parentElement;
    if (parent && parent !== body) {
      const pr = parent.getBoundingClientRect();
      if ((pr.width > 0 || pr.height > 0) && past(pr) > 1) continue;
    }
    const { skip, invisible } = inspect(el);
    if (!skip) hits.push({ el, r, over, invisible, kind: 'box' });
  }
  // Nothing crosses the edge as a box but the page still overflows: look for text or
  // pseudo-element content spilling out of a box, and keep the innermost such box.
  if (!hits.length && de.scrollWidth - iw > 1) {
    const spill: Hit[] = [];
    for (const el of all) {
      if (!(el instanceof HTMLElement) || el.clientWidth === 0) continue;
      if (el.scrollWidth - el.clientWidth <= 1) continue;
      if (getComputedStyle(el).overflowX !== 'visible') continue;
      const r = el.getBoundingClientRect();
      const over = rtl ? -(r.right - el.scrollWidth) : r.left + el.scrollWidth - iw;
      if (over <= 1) continue;
      const { skip, invisible } = inspect(el);
      if (!skip) spill.push({ el, r, over, invisible, kind: 'content' });
    }
    for (const h of spill) if (!spill.some((o) => o !== h && h.el.contains(o.el))) hits.push(h);
  }
  hits.sort((a, b) => b.over - a.over);
  const seen = new Set<string>();
  const offenders: Offender[] = [];
  for (const h of hits) {
    const sel = sig(h.el);
    const anc = ancestry(h.el);
    const key = `${sel}|${anc}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (offenders.length >= top) break;
    offenders.push({
      tag: h.el.tagName.toLowerCase(), id: h.el.id, sel, path: anc, kind: h.kind,
      left: round(h.r.left), right: round(h.r.right), overshoot: round(h.over), invisible: h.invisible,
      text: (h.el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 48),
    });
  }
  return {
    innerWidth: iw, clientWidth: de.clientWidth, scrollWidth: de.scrollWidth,
    overflow: de.scrollWidth - iw, rtl, offenderCount: hits.length, offenders,
  };
}

function scrollToAndMeasure(y: number): number {
  window.scrollTo({ top: y, left: 0, behavior: 'instant' });
  return document.documentElement.scrollHeight;
}

function waitForImages(budgetMs: number): Promise<{ images: number; pending: number }> {
  return new Promise((resolve) => {
    const deadline = Date.now() + budgetMs;
    const tick = (): void => {
      const shown = Array.from(document.images).filter((i) => i.getClientRects().length > 0);
      const pending = shown.filter((i) => !i.complete).length;
      if (!pending || Date.now() > deadline) resolve({ images: shown.length, pending });
      else setTimeout(tick, 100);
    };
    tick();
  });
}

function readTopbar(): TopbarReading {
  const iw = window.innerWidth;
  const ih = window.innerHeight;
  const round = (n: number): number => Math.round(n * 10) / 10;
  // The phone menu is a native <details> in the site bar (plan 277 step 3c): its
  // <summary> is the button, and the disclosure needs no aria-controls.
  const ham = document.querySelector<HTMLElement>('.site-menu > summary');
  const bar = document.querySelector('.site-bar');
  const labelOf = (el: Element): string => {
    const t = el.getAttribute('aria-label') || (el instanceof HTMLElement ? el.innerText : '') ||
      el.getAttribute('title') || el.getAttribute('placeholder') || el.tagName.toLowerCase();
    return t.replace(/\s+/g, ' ').trim().slice(0, 40);
  };
  const controls: Control[] = [];
  // A control inside a closed <details> (the phone menu's sheet) is not on screen, but
  // Chrome lays the closed content out when asked for its rect, so it would read as a
  // control past the edge. Skip it unless it sits in that disclosure's own <summary>.
  const inClosedDetails = (el: Element): boolean => {
    for (let d = el.closest('details'); d; d = d.parentElement?.closest('details') ?? null) {
      const summary = d.querySelector(':scope > summary');
      if (!(d as HTMLDetailsElement).open && !summary?.contains(el)) return true;
    }
    return false;
  };
  if (bar) {
    for (const el of Array.from(bar.querySelectorAll('a[href], button, input, select, textarea, [tabindex]'))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || getComputedStyle(el).visibility === 'hidden' || inClosedDetails(el)) continue;
      controls.push({
        label: labelOf(el), left: round(r.left), right: round(r.right), top: round(r.top), bottom: round(r.bottom),
        inside: r.left >= -0.5 && r.right <= iw + 0.5 && r.top >= -0.5 && r.bottom <= ih + 0.5,
      });
    }
  }
  const br = ham?.getBoundingClientRect();
  const displayed = !!br && br.width > 0 && br.height > 0;
  return {
    barFound: !!bar,
    barScrollWidth: bar ? bar.scrollWidth : null,
    barClientWidth: bar ? bar.clientWidth : null,
    controls,
    outside: controls.filter((c) => !c.inside).map((c) => c.label),
    button: {
      present: !!ham, displayed,
      inside: displayed && !!br && br.left >= -0.5 && br.right <= iw + 0.5,
      left: br ? round(br.left) : 0, right: br ? round(br.right) : 0,
      width: br ? round(br.width) : 0, height: br ? round(br.height) : 0,
      ariaControls: ham ? (ham.getAttribute('aria-controls') ?? 'native details') : null,
    },
  };
}

function readMenu(): MenuReading {
  const ham = document.querySelector<HTMLElement>('.site-menu > summary');
  const menu = document.querySelector<HTMLElement>('.site-sheet');
  const details = ham?.parentElement as HTMLDetailsElement | undefined;
  const active = document.activeElement;
  const focus = active ? active.tagName.toLowerCase() + (active.id ? `#${active.id}` : '') : 'none';
  if (!menu) {
    return { present: false, open: false, expanded: details ? String(details.open) : null, fitsWidth: false,
      height: 0, links: 0, railLinks: 0, lastLinkReachable: null, focusOnButton: !!ham && active === ham, focus };
  }
  const cs = getComputedStyle(menu);
  const r = menu.getBoundingClientRect();
  // The disclosure's own state first: Chrome still reports a rect for the content of a
  // closed <details>, so the size alone would read a closed menu as open.
  const open = (details ? details.open : true) && r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden';
  const links = Array.from(menu.querySelectorAll('a[href]'));
  // The section's pages: the rail's links in the menu's first disclosure.
  const railLinks = menu.querySelectorAll('div.docs-compact-list a[href]').length;
  let lastLinkReachable: boolean | null = null;
  const last = links[links.length - 1];
  if (open && last) {
    last.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
    const lr = last.getBoundingClientRect();
    lastLinkReachable = lr.height > 0 && lr.top >= -0.5 && lr.bottom <= window.innerHeight + 0.5 &&
      lr.left >= -0.5 && lr.right <= window.innerWidth + 0.5;
  }
  return {
    present: true, open, expanded: details ? String(details.open) : null,
    fitsWidth: r.left >= -1 && r.right <= window.innerWidth + 1, height: Math.round(r.height),
    links: links.length, railLinks, lastLinkReachable, focusOnButton: !!ham && active === ham, focus,
  };
}

function readSlot(selector: string): SlotReading {
  const vh = window.innerHeight;
  const docHeight = document.documentElement.scrollHeight;
  const el = document.querySelector(selector);
  if (!el) {
    return { selector, present: false, hiddenAttr: false, display: 'absent', displayed: false, links: 0, visibleLinks: 0,
      top: null, bottom: null, entry: null, entryTop: null, inFirstScreen: false, viewportHeight: vh, docHeight };
  }
  const shown = (e: Element): DOMRect | null => {
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden' ? r : null;
  };
  const r = shown(el);
  const links = Array.from(el.querySelectorAll('a[href]'));
  const visibleLinks = links.filter((a) => shown(a)).length;
  // The way in is the slot itself when it shows, or the summary of a closed
  // details element that wraps it (a likely shape for a phone disclosure).
  const details = el.closest('details');
  const summary = details && !details.open ? details.querySelector(':scope > summary') : null;
  const entryEl = summary ?? (r ? el : null);
  const er = entryEl ? shown(entryEl) : null;
  const inFirstScreen = !!er && er.top < vh && er.bottom > 0 && er.left >= -1 && er.right <= window.innerWidth + 1;
  return {
    selector, present: true, hiddenAttr: el instanceof HTMLElement && el.hidden, display: getComputedStyle(el).display,
    displayed: !!r, links: links.length, visibleLinks,
    top: r ? Math.round(r.top + window.scrollY) : null, bottom: r ? Math.round(r.bottom + window.scrollY) : null,
    entry: er ? (summary ? 'summary' : 'slot') : null, entryTop: er ? Math.round(er.top + window.scrollY) : null,
    inFirstScreen, viewportHeight: vh, docHeight,
  };
}

function readDock(): DockReading {
  const el = document.querySelector('#neuro-dock, .audio-dock');
  if (!el) return { present: false, visible: false, top: null, height: null, coverage: 0 };
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  const visible = r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0';
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const h = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
  const w = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0));
  return { present: true, visible, top: Math.round(r.top), height: Math.round(r.height),
    coverage: visible ? Math.round((h * w * 1000) / (vh * vw)) / 1000 : 0 };
}

// ---------------------------------------------------------------------------
// Node-side steps
// ---------------------------------------------------------------------------

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// With --info-dir, answer /info/ from that directory. The path is resolved and kept
// inside the directory; anything else is a 404, as a static host would answer.
async function serveInfoDir(route: Route, dir: string): Promise<void> {
  const u = new URL(route.request().url());
  let rel = decodeURIComponent(u.pathname.slice('/info/'.length));
  if (rel === '' || rel.endsWith('/')) rel += 'index.html';
  const file = path.resolve(dir, rel);
  if ((file !== dir && !file.startsWith(dir + path.sep)) || !existsSync(file) || !statSync(file).isFile()) {
    await route.fulfill({ status: 404, contentType: 'text/plain', body: 'not found' });
    return;
  }
  const ext = path.extname(file).slice(1).toLowerCase();
  await route.fulfill({ status: 200, contentType: MIME[ext] ?? 'application/octet-stream', body: readFileSync(file) });
}

async function settle(page: Page): Promise<void> {
  await page.evaluate(settleInPage);
  await sleep(120);
}

async function scrollThrough(page: Page): Promise<LazyReading> {
  const vh = page.viewportSize()?.height ?? 800;
  // Chromium starts lazy images well before they enter the viewport, so a step of
  // one and a half screens still passes every image.
  const step = Math.round(vh * 1.5);
  let y = 0;
  let steps = 0;
  let docHeight = 0;
  for (;;) {
    docHeight = await page.evaluate(scrollToAndMeasure, y);
    steps += 1;
    await sleep(SCROLL_PAUSE_MS);
    if (y >= docHeight || steps >= MAX_SCROLL_STEPS) break;
    y += step;
  }
  const img = await page.evaluate(waitForImages, IMAGE_WAIT_MS);
  await page.evaluate(scrollToAndMeasure, 0);
  await settle(page);
  return { steps, docHeight, ...img };
}

async function checkInfoNav(page: Page): Promise<NavReading> {
  const bar = await page.evaluate(readTopbar);
  const nav: NavReading = { ...bar, tabStop: null, enterOpens: null, escapeCloses: null, focusReturned: null, openMenu: null, notes: [] };
  if (!bar.button.present) {
    nav.notes.push('no menu button (.site-menu summary) on this page');
    return nav;
  }
  if (!bar.button.displayed) nav.notes.push('menu button is not displayed at this width');
  // Walk Tab from the start of the document, the way a keyboard reader arrives.
  await page.evaluate(() => {
    const start = document.createElement('span');
    start.tabIndex = -1;
    start.id = '__phone_check_start';
    document.body.prepend(start);
    start.focus();
  });
  for (let i = 1; i <= MAX_TABS; i++) {
    await page.keyboard.press('Tab');
    if (await page.evaluate(() => !!document.activeElement?.matches('.site-menu > summary'))) {
      nav.tabStop = i;
      break;
    }
  }
  await page.evaluate(() => document.getElementById('__phone_check_start')?.remove());
  if (nav.tabStop === null) {
    nav.notes.push(`menu button not reached within ${MAX_TABS} Tab presses; focused directly`);
    await page.focus('.site-menu > summary');
  }
  await page.keyboard.press('Enter');
  await sleep(200);
  const opened = await page.evaluate(readMenu);
  nav.openMenu = opened;
  nav.enterOpens = opened.open;
  if (!opened.open) {
    nav.notes.push('Enter on the menu button did not open the menu');
    return nav;
  }
  if (!opened.fitsWidth) nav.notes.push('the open menu is wider than the viewport');
  if (opened.lastLinkReachable === false) nav.notes.push('the last menu link cannot be scrolled into view');
  // readMenu may have scrolled the last link into view; keep focus where it was.
  if (!opened.focusOnButton) await page.focus('.site-menu > summary');
  await page.keyboard.press('Escape');
  await sleep(200);
  const afterEsc = await page.evaluate(readMenu);
  nav.escapeCloses = !afterEsc.open;
  nav.focusReturned = nav.escapeCloses ? afterEsc.focusOnButton : null;
  if (!nav.escapeCloses) {
    nav.notes.push('Escape did not close the menu');
    await page.evaluate(() => document.querySelector<HTMLElement>('.site-menu > summary')?.click());
    await sleep(150);
  } else if (!nav.focusReturned) {
    nav.notes.push(`Escape closed the menu but focus went to ${afterEsc.focus}`);
  }
  await page.evaluate(scrollToAndMeasure, 0);
  return nav;
}

type InfoMeasure = Pick<PageResult, 'before' | 'after' | 'lazy' | 'nav'>;
type AppMeasure = Pick<PageResult, 'before' | 'after' | 'lazy' | 'rail' | 'toc' | 'dock'>;

async function measureInfo(page: Page, url: string, file: string): Promise<InfoMeasure> {
  if (!existsSync(file)) throw new Error('missing on disk');
  // A page whose stylesheet or script is missing renders unstyled and would read as a
  // huge overflow. That happens when a rebuild replaces the hashed assets before it
  // rewrites every page, so it is reported as unavailable, never measured.
  const origin = new URL(opts.base).origin;
  const badAssets: string[] = [];
  const onResponse = (res: Response): void => {
    const type = res.request().resourceType();
    if (type !== 'stylesheet' && type !== 'script') return;
    const u = new URL(res.url());
    if (u.origin !== origin) return;
    const ct = (res.headers()['content-type'] ?? '').split(';')[0] ?? '';
    const want = type === 'stylesheet' ? /css/ : /javascript|ecmascript/;
    if (res.status() >= 400 || !want.test(ct)) badAssets.push(`${u.pathname} (${res.status()} ${ct || 'no type'})`);
  };
  page.on('response', onResponse);
  let resp: Response | null;
  try {
    resp = await page.goto(url, { waitUntil: 'load' });
  } finally {
    page.off('response', onResponse);
  }
  if (!resp) throw new Error('no response');
  if (resp.status() >= 400) throw new Error(`HTTP ${resp.status()}`);
  const body = await resp.text();
  if (!/<\/html>\s*$/i.test(body)) throw new Error('truncated response (page may be mid-rebuild)');
  const kind = await page.evaluate(pageKind);
  if (!kind.info) throw new Error(kind.app ? 'the server answered with the app shell (file missing or mid-rebuild)' : `not a docs page (${kind.title})`);
  if (badAssets.length) throw new Error(`page asset missing: ${badAssets.slice(0, 2).join(', ')} (the build on disk is inconsistent)`);
  if (kind.emptySheets.length) throw new Error(`stylesheet did not load: ${kind.emptySheets.slice(0, 2).join(', ')}`);
  await settle(page);
  const before = await page.evaluate(readOverflow, TOP_OFFENDERS);
  const lazy = await scrollThrough(page);
  const after = await page.evaluate(readOverflow, TOP_OFFENDERS);
  const nav = await checkInfoNav(page);
  return { before, after, lazy, nav };
}

async function measureApp(page: Page, url: string, width: number): Promise<AppMeasure> {
  await page.goto('about:blank');
  const resp = await page.goto(url, { waitUntil: 'load' });
  if (resp && resp.status() >= 400) throw new Error(`HTTP ${resp.status()}`);
  try {
    await page.waitForSelector('[data-content] :is(.docs-content, .docs-landing)', { timeout: Math.round(opts.timeout * 0.75) });
  } catch {
    const said = await page.evaluate(() => document.querySelector('[data-content] .docs-status')?.textContent?.trim() ?? null);
    throw new Error(said ? `the reader said: ${said}` : 'the reader did not render a page');
  }
  await settle(page);
  await sleep(APP_SETTLE_MS);
  await page.evaluate(scrollToAndMeasure, 0);
  const rail = await page.evaluate(readSlot, '.docs-sidebar-slot');
  const toc = await page.evaluate(readSlot, '.docs-toc-slot');
  const dock = await page.evaluate(readDock);
  const before = await page.evaluate(readOverflow, TOP_OFFENDERS);
  if (width > PHONE_MAX) return { before, rail, toc, dock };
  const lazy = await scrollThrough(page);
  const after = await page.evaluate(readOverflow, TOP_OFFENDERS);
  return { before, after, lazy, rail, toc, dock };
}

function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  p.catch(() => {});
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limit = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms} ms (${what})`)), ms);
  });
  return Promise.race([p, limit]).finally(() => clearTimeout(timer));
}

type Slot = { page: Page };

async function runPage<T extends object>(
  ctx: BrowserContext, slot: Slot, base: Omit<PageResult, 'status' | 'attempts' | 'ms'>,
  fn: (page: Page) => Promise<T>,
): Promise<PageResult> {
  const t0 = Date.now();
  let reason = '';
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      if (slot.page.isClosed()) slot.page = await ctx.newPage();
      const value = await withTimeout(fn(slot.page), opts.timeout, `${base.lang}/${base.slug} at ${base.width}px`);
      return { ...base, ...value, status: 'ok', attempts: attempt, ms: Date.now() - t0 };
    } catch (e) {
      reason = e instanceof Error ? e.message.split('\n')[0] ?? String(e) : String(e);
      if (attempt === 1) {
        // A timed-out page may still be busy; start the retry from a fresh tab.
        await slot.page.close().catch(() => {});
        await sleep(RETRY_WAIT_MS);
      }
    }
  }
  return { ...base, status: 'unavailable', reason, attempts: 2, ms: Date.now() - t0 };
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

const isPhone = (r: PageResult): boolean => r.width <= PHONE_MAX;
const overflows = (o: OverflowReading | undefined): boolean => !!o && o.overflow > OVERFLOW_TOLERANCE_PX;
const pageOverflows = (r: PageResult): boolean => r.status === 'ok' && isPhone(r) && (overflows(r.before) || overflows(r.after));
const navFailed = (r: PageResult): boolean => {
  const n = r.nav;
  if (!n || r.status !== 'ok') return false;
  return !n.button.inside || n.outside.length > 0 || n.enterOpens !== true || n.escapeCloses !== true ||
    n.focusReturned !== true || n.button.ariaControls === null;
};

type GroupSummary = {
  width: number; measured: number; unavailable: number;
  overflowBefore: number; overflowAfter: number; overflowEither: number;
  maxBefore: { px: number; slug: string } | null; maxAfter: { px: number; slug: string } | null;
};

function groupSummary(results: PageResult[], width: number): GroupSummary {
  const rs = results.filter((r) => r.width === width);
  const ok = rs.filter((r) => r.status === 'ok');
  const maxOf = (pick: (r: PageResult) => OverflowReading | undefined): { px: number; slug: string } | null => {
    let best: { px: number; slug: string } | null = null;
    for (const r of ok) {
      const o = pick(r);
      if (o && o.overflow > OVERFLOW_TOLERANCE_PX && (!best || o.overflow > best.px)) best = { px: o.overflow, slug: r.slug };
    }
    return best;
  };
  return {
    width,
    measured: ok.length,
    unavailable: rs.length - ok.length,
    overflowBefore: ok.filter((r) => overflows(r.before)).length,
    overflowAfter: ok.filter((r) => overflows(r.after)).length,
    overflowEither: ok.filter((r) => overflows(r.before) || overflows(r.after)).length,
    maxBefore: maxOf((r) => r.before),
    maxAfter: maxOf((r) => r.after),
  };
}

type SelectorTally = {
  sel: string; edge: 'right' | 'left'; readings: number; invisibleReadings: number; pages: number; maxOvershoot: number;
  example: string; byWidthPhase: Record<string, number>;
};

function tallySelectors(results: PageResult[]): SelectorTally[] {
  const map = new Map<string, SelectorTally & { pageSet: Set<string> }>();
  for (const r of results) {
    if (r.status !== 'ok' || !isPhone(r)) continue;
    for (const phase of ['before', 'after'] as const) {
      const o = r[phase];
      if (!overflows(o) || !o) continue;
      const counted = new Set<string>();
      for (const off of o.offenders) {
        const edge = o.rtl ? 'left' : 'right';
        const key = `${off.sel}|${edge}`;
        if (counted.has(key)) continue;
        counted.add(key);
        let t = map.get(key);
        if (!t) {
          t = { sel: off.sel, edge, readings: 0, invisibleReadings: 0, pages: 0, maxOvershoot: 0,
            example: `${r.reader}:${r.lang}/${r.slug}@${r.width}`, byWidthPhase: {}, pageSet: new Set() };
          map.set(key, t);
        }
        t.readings += 1;
        if (off.invisible) t.invisibleReadings += 1;
        t.pageSet.add(`${r.reader}:${r.lang}/${r.slug}`);
        const wp = `${r.reader}-${r.lang}-${r.width}-${phase}`;
        t.byWidthPhase[wp] = (t.byWidthPhase[wp] ?? 0) + 1;
        if (off.overshoot > t.maxOvershoot) {
          t.maxOvershoot = off.overshoot;
          t.example = `${r.reader}:${r.lang}/${r.slug}@${r.width}`;
        }
      }
    }
  }
  return [...map.values()]
    .map(({ pageSet, ...t }) => ({ ...t, pages: pageSet.size }))
    .sort((a, b) => b.pages - a.pages || b.readings - a.readings || b.maxOvershoot - a.maxOvershoot);
}

type NavSummary = {
  width: number; pages: number; buttonInside: number; allControlsInside: number;
  controlsOutside: Record<string, number>; enterOpens: number; escapeCloses: number; focusReturned: number;
  ariaControls: number; menuFitsWidth: number; lastLinkReachable: number;
  tabStop: { min: number | null; max: number | null }; buttonSize: string[];
};

function navSummary(results: PageResult[], width: number): NavSummary {
  const rs = results.filter((r) => r.width === width && r.status === 'ok' && r.nav);
  const s: NavSummary = { width, pages: rs.length, buttonInside: 0, allControlsInside: 0, controlsOutside: {}, enterOpens: 0,
    escapeCloses: 0, focusReturned: 0, ariaControls: 0, menuFitsWidth: 0, lastLinkReachable: 0,
    tabStop: { min: null, max: null }, buttonSize: [] };
  const sizes = new Set<string>();
  for (const r of rs) {
    const n = r.nav as NavReading;
    if (n.button.inside) s.buttonInside += 1;
    if (!n.outside.length) s.allControlsInside += 1;
    for (const label of n.outside) s.controlsOutside[label] = (s.controlsOutside[label] ?? 0) + 1;
    if (n.enterOpens) s.enterOpens += 1;
    if (n.escapeCloses) s.escapeCloses += 1;
    if (n.focusReturned) s.focusReturned += 1;
    if (n.button.ariaControls) s.ariaControls += 1;
    if (n.openMenu?.fitsWidth) s.menuFitsWidth += 1;
    if (n.openMenu?.lastLinkReachable) s.lastLinkReachable += 1;
    if (n.tabStop !== null) {
      s.tabStop.min = s.tabStop.min === null ? n.tabStop : Math.min(s.tabStop.min, n.tabStop);
      s.tabStop.max = s.tabStop.max === null ? n.tabStop : Math.max(s.tabStop.max, n.tabStop);
    }
    if (n.button.displayed) sizes.add(`${n.button.width}x${n.button.height} at x ${n.button.left}-${n.button.right}`);
  }
  s.buttonSize = [...sizes].sort();
  return s;
}

function gitInfo(): { head: string | null; dirtyDocsFiles: number | null } {
  try {
    const head = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
    const dirty = execFileSync('git', ['status', '--porcelain', '--', 'docs', 'packages/docs-render', 'shells/web/src/styles/parts/docs.css',
      'shells/web/src/views/docs.ts', 'shells/web/src/lib'], { cwd: ROOT, encoding: 'utf8' });
    return { head, dirtyDocsFiles: dirty.split('\n').filter(Boolean).length };
  } catch {
    return { head: null, dirtyDocsFiles: null };
  }
}

// The in-app reader is styled by live app source, so a change to these during a run
// means the #/docs readings may mix two states.
const APP_SOURCES = [
  'shells/web/src/styles/parts/docs.css',
  'shells/web/src/views/docs.ts',
  'shells/web/src/lib/docs-nav.ts',
  'shells/web/src/lib/docs-rehost.ts',
  'shells/web/src/lib/audio-dock-singleton.ts',
].map((f) => path.join(ROOT, f));

function newestMtime(files: string[]): number {
  let t = 0;
  for (const f of files) {
    try { t = Math.max(t, statSync(f).mtimeMs); } catch { /* a missing file is reported per page */ }
  }
  return t;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function loadChromium(): Promise<typeof import('playwright').chromium | string> {
  let chromium: typeof import('playwright').chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    return 'playwright is not installed (pnpm install)';
  }
  try {
    const exe = chromium.executablePath();
    if (!exe || !existsSync(exe)) return 'no Chromium (pnpm exec playwright install chromium)';
  } catch {
    return 'no Chromium (pnpm exec playwright install chromium)';
  }
  return chromium;
}

async function main(): Promise<void> {
  if (!existsSync(INFO_DIR)) usageError(`no built /info site at ${path.relative(ROOT, INFO_DIR)} (run pnpm run build:info first)`);
  if (opts.infoDir) console.error(`check-docs-phone-reading: /info/ is answered from ${path.relative(ROOT, INFO_DIR) || INFO_DIR}, not the server.`);
  const allPages = enumerateInfoPages();
  if (!allPages.length) usageError('the built /info site has no door pages');
  const infoSlugs = opts.only ? resolveSlugs(opts.only, allPages, '--only') : allPages.map((p) => p.slug);
  const rtlSlugs = opts.skipRtl ? [] : (opts.only ? infoSlugs : DEFAULT_RTL_SAMPLE.filter((s) => allPages.some((p) => p.slug === s)));
  const appSlugs = opts.skipApp ? [] : opts.appSample;
  for (const s of appSlugs) if (!/^[a-z-]+(\/[a-z0-9-]+)?$/.test(s)) usageError(`--app-sample: ${s} is not a door/slug`);
  if (!opts.skipRtl && !existsSync(path.join(INFO_DIR, opts.rtl))) usageError(`--rtl: no built locale ${opts.rtl}`);

  const chromium = await loadChromium();
  if (typeof chromium === 'string') {
    console.log(`check-docs-phone-reading: skipped, ${chromium}.`);
    return;
  }
  try {
    const res = await fetch(`${opts.base}/info/index.html`, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (e) {
    console.error(`check-docs-phone-reading: ${opts.base} is not answering (${e instanceof Error ? e.message : String(e)}). Start the dev server (pnpm run dev:web) or pass --base.`);
    process.exit(2);
  }

  const watched = [...infoSlugs.map((s) => infoFile(s)), ...rtlSlugs.map((s) => infoFile(s, opts.rtl))];
  const buildBefore = newestMtime(watched);
  const appBefore = newestMtime(APP_SOURCES);
  const git = gitInfo();
  const started = new Date();
  const results: PageResult[] = [];
  const total = INFO_WIDTHS.length * (infoSlugs.length + rtlSlugs.length) + APP_WIDTHS.length * appSlugs.length;
  let done = 0;
  const progress = (r: PageResult): void => {
    done += 1;
    if (opts.verbose) {
      const o = r.after ?? r.before;
      const tag = r.status !== 'ok' ? `unavailable: ${r.reason}` : o ? `overflow ${o.overflow}` : 'ok';
      console.error(`[${done}/${total}] ${r.reader} ${r.lang}/${r.slug} @${r.width}  ${tag}  ${r.ms} ms`);
    } else if (done % 20 === 0 || done === total) {
      console.error(`  ${done}/${total} pages measured`);
    }
  };

  const browser: Browser = await chromium.launch();
  const infoDir = opts.infoDir;
  const context = async (width: number): Promise<BrowserContext> => {
    const ctx = await browser.newContext({
      viewport: { width, height: VIEWPORT_HEIGHT[width] ?? 800 },
      deviceScaleFactor: 1,
      colorScheme: 'light',
      locale: 'en-US',
      reducedMotion: opts.reducedMotion ? 'reduce' : 'no-preference',
      // No service worker: every request goes to the server (or to --info-dir), never a cache.
      serviceWorkers: 'block',
    });
    if (infoDir) {
      const origin = new URL(opts.base).origin;
      await ctx.route((u) => u.origin === origin && u.pathname.startsWith('/info/'), (route) => serveInfoDir(route, infoDir));
    }
    return ctx;
  };
  try {
    // The #/docs sample goes first: it is short, and it reads live app source that
    // other work may be changing, so it is best taken close to the start time.
    for (const width of appSlugs.length ? APP_WIDTHS : []) {
      const ctx = await context(width);
      const slot: Slot = { page: await ctx.newPage() };
      const height = VIEWPORT_HEIGHT[width] ?? 800;
      for (const slug of appSlugs) {
        const url = appUrl(slug);
        const r = await runPage(ctx, slot, { reader: 'app', lang: 'en', slug, url, width, height },
          (page) => measureApp(page, url, width));
        results.push(r);
        progress(r);
      }
      await ctx.close();
    }
    for (const width of INFO_WIDTHS) {
      const ctx = await context(width);
      const slot: Slot = { page: await ctx.newPage() };
      const height = VIEWPORT_HEIGHT[width] ?? 800;
      const runs: Array<{ lang: string; slug: string }> = [
        ...infoSlugs.map((slug) => ({ lang: 'en', slug })),
        ...rtlSlugs.map((slug) => ({ lang: opts.rtl, slug })),
      ];
      for (const { lang, slug } of runs) {
        const url = infoUrl(slug, lang);
        const r = await runPage(ctx, slot, { reader: 'info', lang, slug, url, width, height },
          (page) => measureInfo(page, url, infoFile(slug, lang)));
        results.push(r);
        progress(r);
      }
      await ctx.close();
    }
  } finally {
    await browser.close();
  }

  const buildAfter = newestMtime(watched);
  const appAfter = newestMtime(APP_SOURCES);
  const info = results.filter((r) => r.reader === 'info' && r.lang === 'en');
  const rtl = results.filter((r) => r.reader === 'info' && r.lang !== 'en');
  const app = results.filter((r) => r.reader === 'app');
  const summary = {
    info: INFO_WIDTHS.map((w) => groupSummary(info, w)),
    rtl: rtlSlugs.length ? INFO_WIDTHS.map((w) => groupSummary(rtl, w)) : [],
    app: appSlugs.length ? INFO_WIDTHS.map((w) => groupSummary(app, w)) : [],
    topSelectors: tallySelectors(results).slice(0, 15),
    nav: INFO_WIDTHS.map((w) => navSummary(info, w)),
    navRtl: rtlSlugs.length ? INFO_WIDTHS.map((w) => navSummary(rtl, w)) : [],
    appNavigation: app.filter((r) => r.status === 'ok').map((r) => ({
      slug: r.slug, width: r.width,
      rail: r.rail ? { displayed: r.rail.displayed, links: r.rail.links, top: r.rail.top, entryTop: r.rail.entryTop, inFirstScreen: r.rail.inFirstScreen } : null,
      toc: r.toc ? { displayed: r.toc.displayed, links: r.toc.links, top: r.toc.top, entryTop: r.toc.entryTop, inFirstScreen: r.toc.inFirstScreen } : null,
      docHeight: r.rail?.docHeight ?? r.toc?.docHeight ?? null,
      dock: r.dock?.visible ? { top: r.dock.top, height: r.dock.height, coverage: r.dock.coverage } : null,
    })),
    unavailable: results.filter((r) => r.status !== 'ok').map((r) => ({ reader: r.reader, lang: r.lang, slug: r.slug, width: r.width, reason: r.reason })),
    overflowingPages: results.filter(pageOverflows).length,
    navFailures: results.filter(navFailed).length,
  };
  const report = {
    tool: 'scripts/check-docs-phone-reading.ts',
    version: 1,
    generatedAt: started.toISOString(),
    durationMs: Date.now() - started.getTime(),
    base: opts.base,
    git,
    infoBuild: {
      dir: path.relative(ROOT, INFO_DIR),
      source: opts.infoDir ? 'served from this directory by the browser (--info-dir)' : 'served by the dev server',
      newestPageMtime: buildBefore ? new Date(buildBefore).toISOString() : null,
      changedDuringRun: buildAfter > buildBefore,
    },
    appSource: {
      files: APP_SOURCES.map((f) => path.relative(ROOT, f)),
      newestMtime: appBefore ? new Date(appBefore).toISOString() : null,
      changedDuringRun: appAfter > appBefore,
    },
    emulation: {
      viewports: Object.fromEntries([...new Set([...INFO_WIDTHS, ...APP_WIDTHS])].map((w) => [w, VIEWPORT_HEIGHT[w]])),
      mobileEmulation: false, deviceScaleFactor: 1, colorScheme: 'light', locale: 'en-US',
      reducedMotion: opts.reducedMotion, overflowTolerancePx: OVERFLOW_TOLERANCE_PX,
    },
    pages: { info: infoSlugs, rtl: { lang: opts.rtl, slugs: rtlSlugs }, app: appSlugs },
    summary,
    results,
  };
  if (opts.json) {
    mkdirSync(path.dirname(opts.json), { recursive: true });
    writeFileSync(opts.json, `${JSON.stringify(report, null, 2)}\n`);
  }

  printSummary(report.summary, report, results);
  const nothing = results.length > 0 && results.every((r) => r.status !== 'ok');
  if (nothing) {
    console.error('check-docs-phone-reading: no page could be measured.');
    process.exit(2);
  }
  if (opts.reportOnly) return;
  if (summary.overflowingPages > 0 || (opts.failOnNav && summary.navFailures > 0)) process.exit(1);
}

function printSummary(summary: {
  info: GroupSummary[]; rtl: GroupSummary[]; app: GroupSummary[]; topSelectors: SelectorTally[];
  nav: NavSummary[]; navRtl: NavSummary[];
  appNavigation: Array<{ slug: string; width: number; rail: { displayed: boolean; top: number | null; entryTop: number | null; inFirstScreen: boolean } | null;
    toc: { displayed: boolean; top: number | null; entryTop: number | null; inFirstScreen: boolean } | null; docHeight: number | null;
    dock: { top: number | null; height: number | null; coverage: number } | null }>;
  unavailable: Array<{ reader: string; lang: string; slug: string; width: number; reason?: string }>;
  overflowingPages: number; navFailures: number;
}, report: { base: string; git: { head: string | null }; infoBuild: { dir: string; newestPageMtime: string | null; changedDuringRun: boolean };
  appSource: { changedDuringRun: boolean }; durationMs: number }, results: PageResult[]): void {
  const line = (label: string, g: GroupSummary): string => {
    const mx = (m: { px: number; slug: string } | null): string => (m ? ` (max +${m.px} ${m.slug})` : '');
    return `  ${label.padEnd(10)} ${String(g.width).padStart(4)}px  measured ${g.measured}, unavailable ${g.unavailable};` +
      ` overflow before lazy ${g.overflowBefore}${mx(g.maxBefore)}, after ${g.overflowAfter}${mx(g.maxAfter)}`;
  };
  console.log(`\ndocs phone reading  base ${report.base}  HEAD ${report.git.head ?? '?'}  /info from ${report.infoBuild.dir} built ${report.infoBuild.newestPageMtime ?? '?'}  ${Math.round(report.durationMs / 1000)} s`);
  if (report.infoBuild.changedDuringRun) console.log('  NOTE: /info pages were rebuilt during this run; readings may mix two builds.');
  if (report.appSource.changedDuringRun) console.log('  NOTE: the in-app reader source changed during this run; #/docs readings may mix two states.');
  for (const g of summary.info) console.log(line('/info en', g));
  for (const g of summary.rtl) console.log(line(`/info ${results.find((r) => r.reader === 'info' && r.lang !== 'en')?.lang ?? 'rtl'}`, g));
  for (const g of summary.app) console.log(line('#/docs', g));

  if (summary.topSelectors.length) {
    console.log('\nTop offending elements (distinct pages, across every phone reading):');
    for (const t of summary.topSelectors.slice(0, 10)) {
      const hidden = t.invisibleReadings === t.readings ? '  (invisible)' : t.invisibleReadings ? `  (invisible in ${t.invisibleReadings}/${t.readings})` : '';
      console.log(`  ${t.sel.padEnd(34)} ${t.edge.padEnd(5)} pages ${String(t.pages).padStart(3)}  max +${t.maxOvershoot}${hidden}  e.g. ${t.example}`);
    }
  }

  const printNav = (label: string, n: NavSummary): void => {
    const outside = Object.entries(n.controlsOutside).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} (${v})`).join(', ');
    console.log(`  ${label} ${n.width}px: menu button inside ${n.buttonInside}/${n.pages} [${n.buttonSize.join('; ')}]; all top-bar controls inside ${n.allControlsInside}/${n.pages}` +
      `${outside ? `; outside: ${outside}` : ''}`);
    console.log(`  ${' '.repeat(label.length)} ${' '.repeat(String(n.width).length)}    Tab stop ${n.tabStop.min ?? '-'}..${n.tabStop.max ?? '-'}; Enter opens ${n.enterOpens}/${n.pages}; Escape closes ${n.escapeCloses}/${n.pages};` +
      ` focus returns ${n.focusReturned}/${n.pages}; aria-controls ${n.ariaControls}/${n.pages}; open menu fits width ${n.menuFitsWidth}/${n.pages}; last link reachable ${n.lastLinkReachable}/${n.pages}`);
  };
  console.log('\nNavigation on /info:');
  for (const n of summary.nav) printNav('en', n);
  for (const n of summary.navRtl) printNav('rtl', n);

  if (summary.appNavigation.length) {
    console.log('\n#/docs topic navigation (rail) and contents, first screen:');
    for (const a of summary.appNavigation.filter((x) => x.width !== 320)) {
      const slotText = (s: typeof a.rail): string => (!s ? 'absent' : !s.displayed && s.entryTop === null ? 'not shown'
        : `${s.inFirstScreen ? 'first screen' : 'below'} y ${s.entryTop ?? s.top}`);
      const dock = a.dock ? `; audio dock covers ${Math.round(a.dock.coverage * 100)}%` : '';
      console.log(`  ${a.slug.padEnd(26)} ${String(a.width).padStart(4)}px  rail ${slotText(a.rail)}; contents ${slotText(a.toc)}; doc ${a.docHeight ?? '?'} px${dock}`);
    }
  }

  const over = results.filter(pageOverflows);
  if (over.length) {
    console.log(`\nOverflowing pages (${over.length}; before/after lazy load, top element):`);
    for (const r of over.slice(0, 60)) {
      const o = overflows(r.after) ? r.after : r.before;
      const top = o?.offenders[0];
      console.log(`  ${r.reader.padEnd(4)} ${`${r.lang}/${r.slug}`.padEnd(40)} ${String(r.width).padStart(4)}px  ` +
        `${r.before ? `+${r.before.overflow}` : '-'} / ${r.after ? `+${r.after.overflow}` : '-'}  ${top ? `${top.sel} (+${top.overshoot})` : ''}`);
    }
    if (over.length > 60) console.log(`  ... ${over.length - 60} more in the JSON report`);
  }
  if (summary.unavailable.length) {
    console.log(`\nUnavailable (${summary.unavailable.length}, not counted as overflow):`);
    for (const u of summary.unavailable) console.log(`  ${u.reader} ${u.lang}/${u.slug} @${u.width}: ${u.reason}`);
  }
  console.log(`\n${summary.overflowingPages} phone readings overflow; ${summary.navFailures} pages with a failed nav check.`);
}

await main();
