// SPDX-License-Identifier: MPL-2.0
/**
 * The browse-layout stylesheet's house rules (styles/parts/browse-layout.css, plan 302),
 * read from the real sheets. Each rule below is a defect an earlier build shipped:
 * a Card rule that out-ranked the search filter, off-screen cards that reserved three
 * times their height, a selection dot placed against the viewport, a slider that
 * widened the column and left the art the same size, physical insets that put the
 * kebab on the dot in a right-to-left page.
 *
 * Run directly:  node --test shells/web/src/styles/browse-layout-contract.test.ts
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), 'utf8');
const SHEET = read('./parts/browse-layout.css');

interface Rule { selector: string; body: string; at: string }
/** Every style rule with the at-rule it sits in, comments removed. */
function rules(css: string): Rule[] {
  const out: Rule[] = [];
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const walk = (src: string, at: string): void => {
    let i = 0;
    while (i < src.length) {
      const open = src.indexOf('{', i);
      if (open < 0) break;
      const prelude = src.slice(i, open).trim();
      let depth = 1, j = open + 1;
      while (j < src.length && depth) { if (src[j] === '{') depth++; else if (src[j] === '}') depth--; j++; }
      const inner = src.slice(open + 1, j - 1);
      if (prelude.startsWith('@')) walk(inner, prelude);
      else out.push({ selector: prelude, body: inner, at });
      i = j;
    }
  };
  walk(text, '');
  return out;
}
const decls = (body: string): Array<[string, string]> => body.split(';').map(d => d.trim()).filter(Boolean)
  .map(d => [d.slice(0, d.indexOf(':')).trim(), d.slice(d.indexOf(':') + 1).trim()]);
const arms = (selector: string): string[] => selector.split(/,(?![^(]*\))/).map(s => s.trim());
const ALL = rules(SHEET);

test('sanity: the sheet parsed into rules', () => {
  assert.ok(ALL.length > 40, `only ${ALL.length} rules found`);
});

test('off-screen tiles keep the skip: content-visibility auto with an estimate, never visible', () => {
  assert.doesNotMatch(SHEET, /content-visibility:\s*visible/);
  const skipping = ALL.filter(r => /content-visibility:\s*auto/.test(r.body));
  assert.ok(skipping.length > 0);
  for (const r of skipping) assert.match(r.body, /contain-intrinsic-size:\s*auto var\(--browse-[a-z]+-est\)/, r.selector);
});

test('filtering wins: every rule that sets display on a gallery tile skips .is-filtered', () => {
  for (const r of ALL) {
    if (!decls(r.body).some(([p]) => p === 'display')) continue;
    for (const arm of arms(r.selector)) {
      const last = arm.split(/\s+|>/).filter(Boolean).pop() ?? '';
      if (/^\.gtile(?![\w-])/.test(last)) assert.match(last, /:not\(\.is-filtered\b/, `${arm} sets display on .gtile without :not(.is-filtered)`);
    }
  }
});

test('no bare attribute descendants: only the container custom properties sit on the bare attribute', () => {
  for (const r of ALL) {
    for (const arm of arms(r.selector)) {
      if (!arm.startsWith('[data-browse-')) continue;
      assert.doesNotMatch(arm, /\]\s+\S/, `${arm} reaches into every surface`);
      for (const [prop] of decls(r.body)) assert.ok(prop.startsWith('--'), `${arm} sets ${prop}; only custom properties belong on the container`);
    }
  }
});

test('logical insets only, in the browse sheet and in the base dot and kebab rules', () => {
  for (const r of ALL) {
    for (const [prop] of decls(r.body)) assert.ok(!['left', 'right', 'margin-left', 'margin-right', 'padding-left', 'padding-right'].includes(prop), `${r.selector}: ${prop}`);
  }
  const base = (sheet: string, selector: RegExp): Rule => {
    const found = rules(read(`./parts/${sheet}`)).find(r => selector.test(r.selector));
    assert.ok(found, `${sheet}: ${selector}`);
    return found!;
  };
  const dot = base('object-tiles.css', /^\.tile-check,\s*\.cat-check$/);
  assert.match(dot.body, /inset-inline-start:\s*6px/);
  const kebab = base('folders.css', /^\.tile-menu-btn$/);
  assert.match(kebab.body, /inset-inline-end:\s*6px/);
  const utility = base('gallery.css', /^\.gtile--utility \.tile-check$/);
  for (const r of [dot, kebab, utility]) {
    for (const [prop] of decls(r.body)) assert.ok(prop !== 'left' && prop !== 'right', `${r.selector}: ${prop}`);
  }
});

test('no column hiding by position and no visual reordering', () => {
  assert.doesNotMatch(SHEET.replace(/\/\*[\s\S]*?\*\//g, ''), /:nth-child|:nth-of-type/);
  for (const r of ALL) assert.ok(!decls(r.body).some(([p]) => p === 'order'), r.selector);
});

test('specificity, not order: every Card track rule has a [data-card-size] twin, and the track fills by auto-fill', () => {
  // A track rule lays out the container itself: every arm ends at the container.
  const tracks = ALL.filter(r => /grid-template-columns|(?:^|;)\s*gap:/.test(r.body) && /\[data-browse-layout="card"\]/.test(r.selector)
    && arms(r.selector).every(a => !/\s/.test(a)));
  assert.ok(tracks.length >= 2);
  for (const r of tracks) {
    const list = arms(r.selector);
    for (const arm of list.filter(a => !a.includes('[data-card-size]'))) {
      assert.ok(list.includes(`${arm}[data-card-size]`), `${arm} has no [data-card-size] twin`);
    }
    if (/grid-template-columns/.test(r.body)) assert.match(r.body, /repeat\(auto-fill, minmax\(min\(100%, var\(--browse-card-min\)\), 1fr\)\)/);
  }
});

test('the Card ladder moves the column AND the thumbnail at every step', () => {
  const at = (step: number): { min: number; w: number; h: number } => {
    const r = ALL.find(x => x.selector === `[data-browse-layout="card"][data-card-size="${step}"]`);
    const base = ALL.find(x => arms(x.selector).includes('[data-browse-layout]'))!;
    const body = step === 2 ? base.body : r?.body ?? '';
    const value = (prop: string): number => {
      const m = new RegExp(`${prop}:\\s*calc\\(([\\d.]+)(rem|px) \\* var\\(--a11y-fs\\)\\)`).exec(body);
      assert.ok(m, `step ${step} declares ${prop}`);
      return Number(m![1]) * (m![2] === 'rem' ? 16 : 1);
    };
    return { min: value('--browse-card-min'), w: value('--browse-thumb-w'), h: value('--browse-thumb-h') };
  };
  const steps = [0, 1, 2, 3, 4].map(at);
  for (let i = 1; i < steps.length; i++) {
    for (const key of ['min', 'w', 'h'] as const) assert.ok(steps[i]![key] > steps[i - 1]![key], `step ${i} grows ${key}: ${steps[i - 1]![key]} -> ${steps[i]![key]}`);
  }
  assert.ok(steps[0]!.min >= 240, 'a card never drops below 15rem, so text always has room');
  for (const s of steps) assert.equal(Math.round((s.w / s.h) * 3), 4, 'the thumbnail is 4:3');
  // Nothing may outrank the thumbnail size with a fixed width of its own.
  const thumbs = ALL.filter(r => /(?:\.gtile > \.gcar|> \.tool-card-icon)$/.test(r.selector) && /\[data-browse-layout="card"\]/.test(r.selector) && /width/.test(r.body));
  assert.ok(thumbs.length >= 2);
  for (const r of thumbs) {
    assert.match(r.body, /width:\s*var\(--browse-thumb-w\)/, r.selector);
    assert.match(r.body, /height:\s*var\(--browse-thumb-h\)/, r.selector);
  }
});

test('the type multiplier reaches only custom properties and glyph sizes', () => {
  const allowed = new Set(['width', 'height', 'min-width', 'min-height', 'font-size']);
  for (const r of ALL) {
    for (const [prop, value] of decls(r.body)) {
      if (/var\(--a11y-fs\)/.test(value)) assert.ok(prop.startsWith('--') || allowed.has(prop), `${r.selector}: ${prop}`);
    }
  }
});

test('the Card selection dot sits on the thumbnail, not against the container width', () => {
  const dot = ALL.find(r => r.selector === '.tool-masonry:is([data-browse-layout="card"],[data-browse-layout="list"]) .gtile .tile-check');
  assert.ok(dot, 'the Tools and Utilities Card dot has its own placement');
  assert.match(dot!.body, /top:\s*calc\(50% \+ var\(--browse-thumb-h\) \/ 2 - var\(--object-check-size\) - 3px\)/);
  assert.match(dot!.body, /inset-inline-start:\s*calc\(var\(--browse-pad-inline\) \+ 3px\)/);
  assert.doesNotMatch(dot!.body, /cqw/, 'container-width units resolve against the viewport once a card is a row');
});

test('on a touch screen the Card dot is the List variant: smaller, a neutral ring, filled only when pressed', () => {
  const coarse = ALL.filter(r => r.at === '@media (pointer: coarse)');
  const size = coarse.find(r => r.selector === '.tool-masonry:is([data-browse-layout="card"],[data-browse-layout="list"])');
  assert.match(size?.body ?? '', /--browse-check-size:\s*var\(--browse-check-size-touch\)/);
  const base = ALL.find(r => arms(r.selector).includes('[data-browse-layout]'))!;
  const px = (prop: string): number => Number(new RegExp(`${prop}:\\s*calc\\(([\\d.]+)px \\* var\\(--a11y-fs\\)\\)`).exec(base.body)?.[1]);
  assert.ok(px('--browse-check-size-touch') < px('--browse-check-size'), 'smaller than the pointer dot');
  const ring = coarse.find(r => r.selector === '.tool-masonry:is([data-browse-layout="card"],[data-browse-layout="list"]) .gtile .tile-check');
  assert.match(ring?.body ?? '', /background:\s*transparent/);
  // The muted text colour, not the hairline border colour: the ring must reach 3:1 on a thumbnail in both themes.
  assert.match(ring?.body ?? '', /border-color:\s*var\(--ui-color-text-muted\)/);
  const pressed = coarse.find(r => r.selector === '.tool-masonry:is([data-browse-layout="card"],[data-browse-layout="list"]) .gtile .tile-check[aria-pressed="true"]');
  assert.match(pressed?.body ?? '', /background:\s*var\(--ui-color-action-primary\)/);
  // The 28px hit extension stays with the base rule (object-tiles.css), so nothing here may remove the ::after.
  assert.ok(!ALL.some(r => /tile-check::after/.test(r.selector)), 'the touch hit extension is left alone');
});

test('outside Grid the cards follow the "Yours" shelf, and the shelf clearance stays inside the view', () => {
  const gap = ALL.find(r => r.selector === '.gallery:not(.has-featured) .yours-shelf ~ .tool-masonry[data-browse-layout]');
  assert.ok(gap, 'the masonry drops its top-bar clearance under the shelf');
  assert.match(gap!.body, /padding-block-start:\s*var\(--sp-\d\)/);
  const root = ALL.find(r => r.selector === '.gallery:not(.has-featured):has(> .tool-masonry[data-browse-layout])');
  assert.match(root?.body ?? '', /display:\s*flow-root/);
  // Grid (no attribute) never matches either rule, so its captures do not move.
  for (const r of [gap!, root!]) assert.match(r.selector, /\.tool-masonry\[data-browse-layout\]/);
});

test('the quiet "+ New" is muted at rest and full on hover, focus and touch', () => {
  const quiet = ALL.find(r => r.selector === '.tool-masonry:is([data-browse-layout="card"],[data-browse-layout="list"]) .gtile-new-icon')!;
  assert.match(quiet.body, /opacity:\s*\.\d+/);
  assert.match(quiet.body, /color:\s*var\(--ui-color-text-muted\)/);
  assert.doesNotMatch(quiet.body, /background:|border:/, 'a ghost button: no fill and no border at rest');
  const loud = ALL.find(r => arms(r.selector).includes('.tool-masonry:is([data-browse-layout="card"],[data-browse-layout="list"]) .gtile:is(:hover, :focus-within) .gtile-new-icon'));
  assert.ok(loud && arms(loud.selector).includes('.tool-masonry:is([data-browse-layout="card"],[data-browse-layout="list"]) .gtile-new-icon:focus-visible'));
  assert.match(loud!.body, /opacity:\s*1/);
  const touch = ALL.find(r => r.at === '@media (hover: none)' && r.selector.includes('.gtile-new-icon'));
  assert.ok(touch, 'always full on a touch screen');
  assert.match(touch!.body, /opacity:\s*1/);
  assert.ok(ALL.some(r => r.selector.endsWith('.gtile-new') && /display:\s*none/.test(r.body) && r.selector.includes('[data-browse-layout="card"]')), 'Card drops the Grid pill');
});

test('gallery.css: phone scroll-snap is Grid only, and hidden previews give Card the icon', () => {
  const gallery = rules(read('./parts/gallery.css'));
  const snap = gallery.filter(r => /scroll-snap-(?:type|align)/.test(r.body));
  assert.ok(snap.length >= 2);
  for (const r of snap.filter(x => x.selector.includes('gallery-view'))) assert.match(r.selector, /\.tool-masonry:not\(\[data-browse-layout\]\)/, r.selector);
  const icon = gallery.find(r => r.selector === 'html[data-a11y-previews="hidden"] .tool-masonry:is([data-browse-layout="card"],[data-browse-layout="list"]) .gtile--has-preview .gtile-cap > .tool-card-icon');
  assert.ok(icon, 'the documented hidePreviews sheet carries the Card rule');
  assert.match(icon!.body, /display:\s*grid/);
});

test('the sheet loads eagerly in the chrome layer, after the sheets whose tiles it lays out', () => {
  const app = read('./app.css');
  const at = (name: string): number => app.indexOf(`@import './parts/${name}'`);
  assert.match(app, /@import '\.\/parts\/browse-layout\.css' layer\(chrome\);/);
  for (const before of ['object-tiles.css', 'gallery.css', 'folders.css', 'projects.css']) assert.ok(at(before) >= 0 && at(before) < at('browse-layout.css'), before);
});
