// SPDX-License-Identifier: MPL-2.0
/**
 * Jump Page (community/jump) - link-list contract.
 *
 * The tool is a landing page whose whole state rides in the share link, so what
 * matters is that typed addresses become working anchors: bare domains get a
 * scheme, labels fall back to the bare host, blank rows vanish, and the list
 * caps at ten. One case drives the compact hand-typed URL form end to end
 * (`?l=Label,suse.com~...`) through the real parser, since "type a link list
 * straight into the address bar" is part of the point.
 *
 * Run with: node --import ./tests/css-stub.mjs --test tests/jump-page.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { parseUrlState } from '../engine/src/url-mode.ts';
import { baseHost } from './helpers/host.ts';

const COMMUNITY = join(dirname(fileURLToPath(import.meta.url)), '..', 'community');
const SKIP = !existsSync(COMMUNITY) && 'community pack not mounted (clone without submodules)';
const tool: any = SKIP ? null : await loadTool('jump',
  (path: string) => readFile(join(COMMUNITY, path), 'utf8'));

async function mount(values: Record<string, any>) {
  const rt = await createRuntime(tool, baseHost(), values);
  return { rt, svg: rt.getHydrated() as string, error: rt.getHydratedText('{{error}}') };
}

test('bare domains get a scheme, labels fall back to the host, blanks vanish', { skip: SKIP }, async () => {
  const { svg, error } = await mount({
    links: [
      { label: 'SUSE', url: 'suse.com' },
      { label: '', url: 'https://www.lolly.tools/gallery' },
      { label: 'Ignored', url: '' },
      { label: 'Mail', url: 'mailto:hello@example.com' },
    ],
  });
  assert.equal(error, '');
  assert.ok(svg.includes('href="https://suse.com"'), 'bare domain gained https://');
  assert.ok(svg.includes('>lolly.tools</span>'), 'empty label falls back to the bare host (no www.)');
  assert.ok(svg.includes('href="mailto:hello@example.com"'), 'mailto keeps its own scheme');
  assert.ok(!svg.includes('Ignored'), 'a row with no address leaves no trace');
});

test('the list caps at ten links', { skip: SKIP }, async () => {
  const links = Array.from({ length: 14 }, (_, i) => ({ label: `L${i}`, url: `https://example.com/${i}` }));
  const { svg } = await mount({ links });
  assert.ok(svg.includes('>L9<'), 'the tenth link renders');
  assert.ok(!svg.includes('>L10<'), 'the eleventh does not');
});

test('no usable links renders the hint, not an empty page', { skip: SKIP }, async () => {
  const { svg, error } = await mount({ links: [] });
  assert.match(error, /add a link/i);
  assert.ok(svg.includes('Add a link to build the page.'));
});

test('the compact hand-typed URL form drives the page through the real parser', { skip: SKIP }, async () => {
  const state = parseUrlState('l=SUSE,suse.com~,docs.suse.com&style=cards', tool.manifest);
  const { svg, error } = await mount(state.values);
  assert.equal(error, '');
  assert.ok(svg.includes('jp-cards'));
  assert.ok(svg.includes('href="https://suse.com"'));
  assert.ok(svg.includes('>docs.suse.com</span>'), 'second row: label omitted, host stands in');
});

test('every example hydrates into a real page', { skip: SKIP }, async () => {
  for (const ex of tool.manifest.examples ?? []) {
    const got = await mount(ex.values);
    assert.deepEqual(got.rt.hookErrors, [], `${ex.label}: hooks errored`);
    assert.equal(got.error, '', `${ex.label}: ${got.error}`);
    // A landing page renders the link list; a forwarder renders the redirect panel.
    assert.ok(got.svg.includes('jp-link') || got.svg.includes('jp-forward'),
      `${ex.label}: neither a link list nor a forward panel rendered`);
  }
});

test('forward mode redirects to the first link and drops the list', { skip: SKIP }, async () => {
  const { svg } = await mount({
    onVisit: 'forward',
    links: [
      { label: 'One', url: 'suse.com' },
      { label: 'Two', url: 'https://example.com/two' },
    ],
  });
  assert.ok(svg.includes('jp-is-forward'), 'a forward panel is rendered');
  assert.ok(svg.includes('data-jp-href="https://suse.com"'), 'forwards to the first link, scheme added');
  assert.ok(!svg.includes('data-jp-challenge="1"'), 'plain forward has no human check');
  assert.ok(!svg.includes('>Two<'), 'the second link is not shown - the visitor is forwarded');
});

test('gate mode arms the press-and-hold human check', { skip: SKIP }, async () => {
  const { svg } = await mount({ onVisit: 'gate', links: [{ label: 'Go', url: 'https://example.com/x' }] });
  assert.ok(svg.includes('data-jp-challenge="1"'), 'the human check is armed');
  assert.ok(svg.includes('data-jp-hold'), 'the hold button is rendered');
});

test('a javascript: first link never becomes a redirect target', { skip: SKIP }, async () => {
  const { svg } = await mount({ onVisit: 'forward', links: [{ label: 'X', url: 'javascript:alert(1)' }] });
  assert.ok(!svg.includes('jp-is-forward'), 'no auto-forward to an unsafe scheme');
  assert.ok(svg.includes('jp-list'), 'falls back to showing the link list');
});

test('default (page) mode keeps the link list, no redirect', { skip: SKIP }, async () => {
  const { svg } = await mount({ links: [{ label: 'Home', url: 'https://example.com' }] });
  assert.ok(svg.includes('jp-list'), 'the link list is shown');
  assert.ok(!svg.includes('jp-is-forward'), 'nothing forwards by default');
});

// ── Scroll cinema (plans/158) ───────────────────────────────────────────────

test('the two-field row survives the third block field', { skip: SKIP }, async () => {
  // `icon` was APPENDED to label,url - block field order is the wire format, so
  // every link already shared as `label,url` (or `,url`) has to parse unchanged.
  const state = parseUrlState('l=SUSE,suse.com~,docs.suse.com', tool.manifest);
  assert.deepEqual(state.values.links, [
    { label: 'SUSE', url: 'suse.com', icon: '' },
    { label: '', url: 'docs.suse.com', icon: '' },
  ]);
  const { svg, error } = await mount(state.values);
  assert.equal(error, '');
  assert.ok(svg.includes('href="https://suse.com"'));
  assert.ok(svg.includes('>docs.suse.com</span>'), 'second row still falls back to the host');
  // An emoji glyph is never invented - the scene's parallax layer for an
  // icon-less link is the ghost letterform, the label's own first grapheme.
  assert.ok(!svg.includes('jp-icon'), 'no emoji glyph is invented for a two-field row');
  assert.ok(svg.includes('class="jp-ghost" aria-hidden="true">S</span>'), 'the label seeds the ghost letterform');
  assert.ok(svg.includes('class="jp-ghost" aria-hidden="true">D</span>'), 'a host-fallback label seeds it too');
});

test('a chosen glyph replaces the ghost letterform, never joins it', { skip: SKIP }, async () => {
  const withIcon = await mount({ links: [{ label: 'Films', url: 'https://example.com', icon: '🎬' }] });
  assert.ok(withIcon.svg.includes('jp-icon'), 'the chosen glyph renders');
  assert.ok(!withIcon.svg.includes('jp-ghost'), 'no ghost letterform beside a chosen glyph');
  const without = await mount({ links: [{ label: 'films', url: 'https://example.com' }] });
  assert.ok(without.svg.includes('class="jp-ghost" aria-hidden="true">F</span>'),
    'no glyph chosen: the first grapheme stands in, uppercased so it reads as a mark');
});

test('a glyph is trimmed and capped, never a caption', { skip: SKIP }, async () => {
  const family = '\u{1F469}‍\u{1F469}‍\u{1F467}‍\u{1F466}';
  const { svg } = await mount({
    links: [
      { label: 'Trim', url: 'https://example.com/a', icon: '  ab  ' },
      { label: 'Cap', url: 'https://example.com/b', icon: 'abcdefgh' },
      { label: 'Emoji', url: 'https://example.com/c', icon: '🎬' },
      { label: 'Family', url: 'https://example.com/d', icon: family },
    ],
  });
  assert.ok(svg.includes('>ab</span>'), 'surrounding whitespace goes');
  assert.ok(svg.includes('>abcd</span>'), 'capped at four');
  assert.ok(!svg.includes('abcde'), 'nothing past the cap survives');
  assert.ok(svg.includes('>🎬</span>'), 'an astral emoji is not split in half');
  // The cap counts graphemes: cutting a ZWJ sequence would render a DIFFERENT
  // emoji plus a dangling joiner, not a shortened one.
  assert.ok(svg.includes(`>${family}</span>`), 'a ZWJ sequence stays the emoji it was');
});

test('a hand-typed mood outside the options never reaches the motion dial', { skip: SKIP }, async () => {
  // Initial/URL values bypass the select's option whitelist, so a prototype key
  // would otherwise put a function into --jp-motion and void every calc() on it.
  for (const mood of ['constructor', '__proto__', 'toString', 'nonsense']) {
    const { svg } = await mount({ mood, links: [{ url: 'https://example.com' }] });
    assert.ok(svg.includes('--jp-motion:0.6'), `mood=${mood} falls back to calm`);
  }
  const bold = await mount({ mood: 'bold', links: [{ url: 'https://example.com' }] });
  assert.ok(bold.svg.includes('--jp-motion:1'), 'a real option still gets through');
});

test('the word stagger is bounded, however long the heading', { skip: SKIP }, async () => {
  // maxLength constrains edits, not initial values, so a share link can carry a
  // heading of any length - an uncapped index would hold its tail invisible.
  const heading = Array.from({ length: 40 }, (_, i) => `w${i}`).join(' ');
  const { svg } = await mount({ heading, links: [{ url: 'https://example.com' }] });
  assert.equal(svg.match(/class="jp-word"/g)?.length, 40, 'every word still renders');
  const steps = [...svg.matchAll(/--jp-w:(\d+)/g)].map(m => Number(m[1]));
  assert.ok(Math.max(...steps) <= 12, `stagger index capped, saw ${Math.max(...steps)}`);
});

test('the Lolly line is the cinema close, not a footer on every style', { skip: SKIP }, async () => {
  const links = [{ label: 'Home', url: 'https://example.com' }];
  const cinema = await mount({ links });
  assert.ok(cinema.svg.includes('Made with Lolly'), 'cinema closes on the attribution line');
  assert.ok(!(await mount({ style: 'buttons', links })).svg.includes('jp-foot'),
    'an explicit buttons link renders as it did before the cinema style existed');
  assert.ok(!(await mount({ style: 'minimal', links })).svg.includes('jp-foot'));
  assert.ok(!(await mount({ style: 'cards', links })).svg.includes('jp-foot'));
  assert.ok(!(await mount({ footer: false, links })).svg.includes('jp-foot'), 'and it opts out');
});

test('the heading arrives as words the opening can stagger', { skip: SKIP }, async () => {
  const { svg } = await mount({ heading: 'One  Two Three', links: [{ url: 'https://example.com' }] });
  assert.match(svg, /<span class="jp-word"[^>]*--jp-w:0[^>]*>One<\/span>/);
  assert.match(svg, /<span class="jp-word"[^>]*--jp-w:1[^>]*>Two<\/span>/);
  assert.match(svg, /<span class="jp-word"[^>]*--jp-w:2[^>]*>Three<\/span>/);
  assert.equal(svg.match(/class="jp-word"/g)?.length, 3, 'runs of whitespace make one break, not empty words');
});

test('cinema is the default style and the plain lists stay', { skip: SKIP }, () => {
  const style = tool.manifest.inputs.find((i: any) => i.id === 'style');
  assert.equal(style.default, 'cinema');
  assert.deepEqual(style.options.map((o: any) => o.value), ['cinema', 'buttons', 'cards', 'minimal']);
});

/** End index of the brace-delimited block whose opening `{` is at `open`. */
function blockEnd(css: string, open: number): number {
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}' && --depth === 0) return i;
  }
  return -1;
}

test('every scroll-driven rule sits behind all three gates', { skip: SKIP }, () => {
  const css = readFileSync(join(COMMUNITY, 'jump', 'styles.css'), 'utf8');
  assert.ok(!css.includes('scroll-snap-type'), 'no scroll hijack - the visitor owns the scroll');

  const SUPPORTS = '@supports (animation-timeline: view())';
  const sup = css.indexOf(SUPPORTS);
  assert.ok(sup >= 0, 'the support gate exists');
  assert.equal(css.indexOf(SUPPORTS, sup + 1), -1, 'exactly one support gate, so there is one region to read');
  const supEnd = blockEnd(css, css.indexOf('{', sup + SUPPORTS.length - 1));

  const MEDIA = '@media (prefers-reduced-motion: no-preference)';
  const med = css.indexOf(MEDIA);
  assert.ok(med > sup && med < supEnd, 'the reduced-motion gate sits inside the support gate');
  const medEnd = blockEnd(css, css.indexOf('{', med + MEDIA.length - 1));

  // The only mention outside the region is the support query's own condition.
  const condition = sup + SUPPORTS.indexOf('animation-timeline');
  let timelines = 0;
  for (let i = css.indexOf('animation-timeline'); i >= 0; i = css.indexOf('animation-timeline', i + 1)) {
    if (i === condition) continue;
    timelines++;
    assert.ok(i > med && i < medEnd, `a scroll timeline at offset ${i} escapes the gates`);
    const open = css.lastIndexOf('{', i);
    const prev = Math.max(css.lastIndexOf('{', open - 1), css.lastIndexOf('}', open - 1));
    const selector = css.slice(prev + 1, open).trim();
    assert.ok(selector.includes('.jp-live'), `"${selector}" would attach a timeline off the visitor page`);
  }
  assert.ok(timelines >= 5, `expected the cinema motion set, found ${timelines} timelines`);
});

test('the cinema page survives the places it is not the visitor page', { skip: SKIP }, () => {
  const css = readFileSync(join(COMMUNITY, 'jump', 'styles.css'), 'utf8');

  // `svh` measures the browser viewport even inside the fixed artboard, so the
  // scenes must fall back to content height wherever `jp-live` is absent -
  // otherwise the editor preview is the hero and nothing else.
  for (const part of ['jp-head', 'jp-link', 'jp-foot']) {
    assert.match(css, new RegExp(`\\.jp-cinema:not\\(\\.jp-live\\) \\.${part}\\s*\\{[^}]*min-height:\\s*0`),
      `.${part} keeps its viewport height off the visitor page`);
  }

  assert.match(css, /\.jp-link:focus-visible\s*\{[^}]*outline:/, 'a full-bleed scene draws its own focus ring');

  // A range ending in `cover` cannot complete for a subject at the foot of the
  // document; `both` fill would strand it mid-reveal for good.
  for (const sel of ['.jp-host', '.jp-foot-echo']) {
    const at = css.indexOf(`.jp-live.jp-cinema ${sel} {`);
    assert.ok(at > 0, `${sel} has a gated rule`);
    const range = /animation-range:\s*([^;]+);/.exec(css.slice(at, blockEnd(css, css.indexOf('{', at))));
    assert.ok(range && !/cover/.test(range[1] ?? ''), `${sel}'s range "${range?.[1]}" never reaches its end state`);
  }

  // A declaration holding var() parses as valid and beats the plain colour above
  // it, so the derived washes only fall back from behind a feature query.
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const fn of bare.matchAll(/oklch\(from|color-mix\(/g)) {
    const sup = bare.lastIndexOf('@supports', fn.index);
    assert.ok(sup >= 0 && blockEnd(bare, bare.indexOf('{', sup)) > fn.index,
      `a derived colour at offset ${fn.index} has no feature query over it`);
  }
});
