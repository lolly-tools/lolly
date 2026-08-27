// SPDX-License-Identifier: MPL-2.0
/**
 * Jump Page (community/jump) - link-list contract.
 *
 * The tool is a landing page whose whole state rides in the share link, so what
 * matters is that typed addresses become working anchors: bare domains get a
 * scheme, names fall back to the bare host, blank rows vanish, and the list
 * caps at ten. Two cases drive the compact hand-typed URL form end to end
 * (`?l=URL,Name,Emoji~suse.com,SUSE~...`) through the real parser, since "type
 * a link list straight into the address bar" is part of the point.
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
import { encodeTableCompact, parseUrlState } from '../engine/src/url-mode.ts';
import { baseHost } from './helpers/host.ts';

const COMMUNITY = join(dirname(fileURLToPath(import.meta.url)), '..', 'community');
const SKIP = !existsSync(COMMUNITY) && 'community pack not mounted (clone without submodules)';
const tool: any = SKIP ? null : await loadTool('jump',
  (path: string) => readFile(join(COMMUNITY, path), 'utf8'));

async function mount(values: Record<string, any>) {
  const rt = await createRuntime(tool, baseHost(), values);
  return { rt, svg: rt.getHydrated() as string, error: rt.getHydratedText('{{error}}') };
}

/** The links table value: one row per link, cells in the manifest's column order. */
const COLUMNS = ['URL', 'Name', 'Emoji'];
const links = (...rows: string[][]) => ({ columns: COLUMNS, rows });

test('bare domains get a scheme, names fall back to the host, blanks vanish', { skip: SKIP }, async () => {
  const { svg, error } = await mount({
    links: links(
      ['suse.com', 'SUSE'],
      ['https://www.lolly.tools/gallery', ''],
      ['', 'Ignored'],
      ['mailto:hello@example.com', 'Mail'],
    ),
  });
  assert.equal(error, '');
  assert.ok(svg.includes('href="https://suse.com"'), 'bare domain gained https://');
  assert.ok(svg.includes('>lolly.tools</span>'), 'empty name falls back to the bare host (no www.)');
  assert.ok(svg.includes('href="mailto:hello@example.com"'), 'mailto keeps its own scheme');
  assert.ok(!svg.includes('Ignored'), 'a row with no address leaves no trace');
});

test('the list caps at ten links', { skip: SKIP }, async () => {
  const rows = Array.from({ length: 14 }, (_, i) => [`https://example.com/${i}`, `L${i}`]);
  const { svg } = await mount({ links: links(...rows) });
  assert.ok(svg.includes('>L9<'), 'the tenth link renders');
  assert.ok(!svg.includes('>L10<'), 'the eleventh does not');
});

test('no usable links renders the hint, not an empty page', { skip: SKIP }, async () => {
  const { svg, error } = await mount({ links: links() });
  assert.match(error, /add a link/i);
  assert.ok(svg.includes('Add a link to build the page.'));
});

test('the compact hand-typed URL form drives the page through the real parser', { skip: SKIP }, async () => {
  // v1.2 (pre-launch wire break, 2026-08-27): links are a TABLE, so the first
  // tilde segment is the header row and every segment after it is one link,
  // address first. A name may be omitted; the site's own host stands in.
  const state = parseUrlState('l=URL,Name,Emoji~suse.com,SUSE~docs.suse.com&style=cards', tool.manifest);
  const { svg, error } = await mount(state.values);
  assert.equal(error, '');
  assert.ok(svg.includes('jp-cards'));
  assert.ok(svg.includes('href="https://suse.com"'));
  assert.ok(svg.includes('>docs.suse.com</span>'), 'second row: name omitted, host stands in');
});

test('a built table round-trips through the compact link param', { skip: SKIP }, async () => {
  // The other half of the wire: what the Share button writes has to be what the
  // parser reads back. Cells carrying the separators themselves (a comma, a
  // tilde) are the case a hand-written test string would never cover.
  const built = links(
    ['suse.com', 'Docs, guides and more', '📘'],
    ['https://example.com/a~b', 'Tilde ~ path'],
  );
  const param = encodeTableCompact({ columns: built.columns, rows: built.rows.map(r =>
    [...r, ...Array(built.columns.length - r.length).fill('')]) });
  const state = parseUrlState(`l=${encodeURIComponent(param)}`, tool.manifest);
  assert.deepEqual(state.values.links, {
    columns: COLUMNS,
    rows: [
      ['suse.com', 'Docs, guides and more', '📘'],
      ['https://example.com/a~b', 'Tilde ~ path', ''],
    ],
  });
  const { svg, error } = await mount(state.values);
  assert.equal(error, '');
  assert.ok(svg.includes('href="https://suse.com"'), 'the parsed row renders as a real anchor');
  assert.ok(svg.includes('>Docs, guides and more<'), 'a comma inside a cell survives the round trip');
  assert.ok(svg.includes('href="https://example.com/a~b"'), 'so does a tilde');
  assert.ok(svg.includes('>📘</span>'), 'the emoji column reaches the glyph');
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
    links: links(['suse.com', 'One'], ['https://example.com/two', 'Two']),
  });
  assert.ok(svg.includes('jp-is-forward'), 'a forward panel is rendered');
  assert.ok(svg.includes('data-jp-href="https://suse.com"'), 'forwards to the first link, scheme added');
  assert.ok(!svg.includes('data-jp-challenge="1"'), 'plain forward has no human check');
  assert.ok(!svg.includes('>Two<'), 'the second link is not shown - the visitor is forwarded');
});

test('gate mode arms the press-and-hold human check', { skip: SKIP }, async () => {
  const { svg } = await mount({ onVisit: 'gate', links: links(['https://example.com/x', 'Go']) });
  assert.ok(svg.includes('data-jp-challenge="1"'), 'the human check is armed');
  assert.ok(svg.includes('data-jp-hold'), 'the hold button is rendered');
});

test('a javascript: first link never becomes a redirect target', { skip: SKIP }, async () => {
  const { svg } = await mount({ onVisit: 'forward', links: links(['javascript:alert(1)', 'X']) });
  assert.ok(!svg.includes('jp-is-forward'), 'no auto-forward to an unsafe scheme');
  assert.ok(svg.includes('jp-list'), 'falls back to showing the link list');
});

test('default (page) mode keeps the link list, no redirect', { skip: SKIP }, async () => {
  const { svg } = await mount({ links: links(['https://example.com', 'Home']) });
  assert.ok(svg.includes('jp-list'), 'the link list is shown');
  assert.ok(!svg.includes('jp-is-forward'), 'nothing forwards by default');
});

// ── Scroll cinema (plans/158) ───────────────────────────────────────────────

test('the short row survives the later table columns', { skip: SKIP }, async () => {
  // Column order is the wire format: URL leads (v1.2 pre-launch break,
  // 2026-08-27 - the one window this order could change), then Name, then
  // Emoji. A row shorter than the header parses with its tail cells empty, and
  // later columns APPEND from here on - never reorder again.
  const state = parseUrlState('l=URL,Name,Emoji~suse.com,SUSE~docs.suse.com', tool.manifest);
  assert.deepEqual(state.values.links, {
    columns: COLUMNS,
    rows: [['suse.com', 'SUSE', ''], ['docs.suse.com', '', '']],
  });
  const { svg, error } = await mount(state.values);
  assert.equal(error, '');
  assert.ok(svg.includes('href="https://suse.com"'));
  assert.ok(svg.includes('>docs.suse.com</span>'), 'second row still falls back to the host');
  // An emoji glyph is never invented - the scene's parallax layer for an
  // icon-less link is the ghost letterform, the label's own first grapheme.
  assert.ok(!svg.includes('jp-icon'), 'no emoji glyph is invented for a short row');
  assert.ok(svg.includes('class="jp-ghost" aria-hidden="true">S</span>'), 'the label seeds the ghost letterform');
  assert.ok(svg.includes('class="jp-ghost" aria-hidden="true">D</span>'), 'a host-fallback label seeds it too');
});

test('a chosen glyph replaces the ghost letterform, never joins it', { skip: SKIP }, async () => {
  const withIcon = await mount({ links: links(['https://example.com', 'Films', '🎬']) });
  assert.ok(withIcon.svg.includes('jp-icon'), 'the chosen glyph renders');
  assert.ok(!withIcon.svg.includes('jp-ghost'), 'no ghost letterform beside a chosen glyph');
  const without = await mount({ links: links(['https://example.com', 'films']) });
  assert.ok(without.svg.includes('class="jp-ghost" aria-hidden="true">F</span>'),
    'no glyph chosen: the first grapheme stands in, uppercased so it reads as a mark');
});

test('a glyph is trimmed and capped, never a caption', { skip: SKIP }, async () => {
  const family = '\u{1F469}‍\u{1F469}‍\u{1F467}‍\u{1F466}';
  const { svg } = await mount({
    links: links(
      ['https://example.com/a', 'Trim', '  ab  '],
      ['https://example.com/b', 'Cap', 'abcdefgh'],
      ['https://example.com/c', 'Emoji', '🎬'],
      ['https://example.com/d', 'Family', family],
    ),
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
    const { svg } = await mount({ mood, links: links(['https://example.com']) });
    assert.ok(svg.includes('--jp-motion:0.6'), `mood=${mood} falls back to calm`);
  }
  const bold = await mount({ mood: 'bold', links: links(['https://example.com']) });
  assert.ok(bold.svg.includes('--jp-motion:1'), 'a real option still gets through');
});

test('the word stagger is bounded, however long the heading', { skip: SKIP }, async () => {
  // maxLength constrains edits, not initial values, so a share link can carry a
  // heading of any length - an uncapped index would hold its tail invisible.
  const heading = Array.from({ length: 40 }, (_, i) => `w${i}`).join(' ');
  const { svg } = await mount({ heading, links: links(['https://example.com']) });
  assert.equal(svg.match(/class="jp-word"/g)?.length, 40, 'every word still renders');
  const steps = [...svg.matchAll(/--jp-w:(\d+)/g)].map(m => Number(m[1]));
  assert.ok(Math.max(...steps) <= 12, `stagger index capped, saw ${Math.max(...steps)}`);
});

test('the Lolly line is the cinema close, not a footer on every style', { skip: SKIP }, async () => {
  const one = links(['https://example.com', 'Home']);
  const cinema = await mount({ links: one });
  assert.ok(cinema.svg.includes('Made with Lolly'), 'cinema closes on the attribution line');
  assert.ok(!(await mount({ style: 'buttons', links: one })).svg.includes('jp-foot'),
    'an explicit buttons link renders as it did before the cinema style existed');
  assert.ok(!(await mount({ style: 'minimal', links: one })).svg.includes('jp-foot'));
  assert.ok(!(await mount({ style: 'cards', links: one })).svg.includes('jp-foot'));
  assert.ok(!(await mount({ footer: false, links: one })).svg.includes('jp-foot'), 'and it opts out');
});

test('the heading arrives as words the opening can stagger', { skip: SKIP }, async () => {
  const { svg } = await mount({ heading: 'One  Two Three', links: links(['https://example.com']) });
  assert.match(svg, /<span class="jp-word"[^>]*--jp-w:0[^>]*>One<\/span>/);
  assert.match(svg, /<span class="jp-word"[^>]*--jp-w:1[^>]*>Two<\/span>/);
  assert.match(svg, /<span class="jp-word"[^>]*--jp-w:2[^>]*>Three<\/span>/);
  assert.equal(svg.match(/class="jp-word"/g)?.length, 3, 'runs of whitespace make one break, not empty words');
});

test('cinema is the default style and the plain lists stay', { skip: SKIP }, () => {
  const style = tool.manifest.inputs.find((i: any) => i.id === 'style');
  assert.equal(style.default, 'cinema');
  assert.deepEqual(style.options.map((o: any) => o.value),
    ['cinema', 'aurora', 'editorial', 'mural', 'orbit', 'buttons', 'cards', 'minimal']);
});

test('the look sits in one collapsed card, the links right under it', { skip: SKIP }, () => {
  // The sidebar order IS the product decision (v1.2, 2026-08-27): everything
  // that decides how the page looks goes into one "Style" section the shell
  // collapses by default, so what greets the author is the links table.
  assert.deepEqual(tool.manifest.inputs.map((i: any) => i.id),
    ['style', 'mood', 'color', 'background', 'accent', 'footer',
     'links', 'heading', 'subheading', 'avatar', 'backdrop', 'onVisit']);
  for (const id of ['style', 'mood', 'color', 'background', 'accent', 'footer']) {
    assert.equal(tool.manifest.inputs.find((i: any) => i.id === id).section, 'Style', id);
  }
  for (const id of ['links', 'heading', 'subheading', 'avatar', 'backdrop', 'onVisit']) {
    assert.equal(tool.manifest.inputs.find((i: any) => i.id === id).section, undefined, id);
  }
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

test('cleared content defaults: nothing untyped ever travels', { skip: SKIP }, async () => {
  // v1.2 blank-state contract (2026-08-27): heading, subheading and links all
  // default EMPTY, so a CLI render or hand-typed link carries only what its
  // author actually set - the sample copy lives in placeholders and examples.
  for (const id of ['heading', 'subheading']) {
    assert.equal(tool.manifest.inputs.find((i: any) => i.id === id).default, '', id);
  }
  assert.deepEqual(tool.manifest.inputs.find((i: any) => i.id === 'links').default,
    { columns: COLUMNS, rows: [] });
  const { svg } = await mount({});
  assert.ok(!svg.includes('Find us everywhere'), 'no phantom heading');
  assert.ok(!svg.includes('example.com'), 'no phantom links');
  assert.ok(!svg.includes('<h1'), 'an empty heading prints no hollow tag');
  assert.ok(svg.includes('Add a link to build the page.'), 'the blank state explains itself');
  // One typed link renders alone, wearing nothing it did not ask for.
  const one = await mount({ links: links(['suse.com']) });
  assert.ok(one.svg.includes('href="https://suse.com"'));
  assert.ok(!one.svg.includes('Find us everywhere'));
});

// ── Front page / Cover story / Playroom ─────────────────────────────────────

test('each expressive style renders a complete page from the shared markup', { skip: SKIP }, async () => {
  const three = links(
    ['https://example.com/work', 'Work', '🎬'],
    ['https://example.com/words', 'Words'],
    ['https://example.com/say-hello'],
  );
  for (const style of ['editorial', 'mural', 'orbit']) {
    const { svg, error, rt } = await mount({ heading: 'Ana Kovac', style, links: three });
    assert.deepEqual(rt.hookErrors, [], `${style}: hooks errored`);
    assert.equal(error, '', `${style}: ${error}`);
    assert.ok(svg.includes(`jp-root jp-${style}`), `${style}: the root wears its own class`);
    assert.equal(svg.match(/class="jp-link/g)?.length, 3, `${style}: every link renders`);
    // v1.2 (2026-08-27): the Feature flag is gone with the blocks input - the
    // table's three columns are the whole per-link spec, so no link may still
    // be claiming a hero slot.
    assert.ok(!svg.includes('jp-big'), `${style}: no featured-link class survives`);
    assert.ok(svg.includes('Made with Lolly'), `${style}: the composed close renders`);
    // The three read with no picture chosen, so neither flag may be required.
    assert.ok(!svg.includes('jp-has-bg') && !svg.includes('jp-has-avatar'),
      `${style}: renders without a portrait or a backdrop`);
  }
});

test('each expressive style pins the one signature its composition rests on', { skip: SKIP }, () => {
  const css = readFileSync(join(COMMUNITY, 'jump', 'styles.css'), 'utf8');

  // Front page: the masthead is kinetic type. The scroll drives the variable
  // font axes, and the keyframe STARTS at the resting weight, so a page that
  // never scrolls is already the finished poster.
  assert.match(css, /\.jp-live\.jp-editorial \.jp-heading\s*\{[^}]*animation-timeline:\s*scroll\(\)/,
    'the masthead is driven by the page scroll');
  assert.match(css, /@keyframes jp-masthead-thin\s*\{\s*from\s*\{[^}]*"wght" 800/,
    'the masthead keyframe opens on the resting weight');
  assert.ok(!/position:\s*fixed/.test(css), 'nothing is fixed - a fixed box escapes the tool canvas');

  // The veil belongs to the aurora, which is being rebuilt around a canvas
  // inside it. None of the three styles may light it up.
  for (const style of ['editorial', 'mural', 'orbit']) {
    assert.ok(!new RegExp(`\\.jp-${style}[^{]*\\.jp-veil`).test(css),
      `${style} leaves the veil alone`);
  }

  // Cover story: the opening picture is what travels, and the two chapters
  // offer a snap point without any style ever claiming the scroller.
  assert.match(css, /\.jp-live\.jp-mural \.jp-backdrop-img\s*\{[^}]*animation-timeline:/,
    'the backdrop settles on a scroll timeline');
  assert.equal(css.match(/scroll-snap-align:\s*start/g)?.length, 2,
    'the opening and the sheet are the two chapters');

  // Playroom: the bubbles consume the pointer lean the template script writes,
  // on `translate`, so the bob keeps `transform` to itself.
  assert.match(css, /\.jp-orbit \.jp-link\s*\{[^}]*translate:\s*var\(--jp-mx/,
    'a bubble leans toward the pointer');
  assert.match(css, /@keyframes jp-bob\s*\{[^@]*transform:\s*translateY/,
    'the idle bob rides transform, not translate');
});

// ── Both colour schemes (v1.2, 2026-08-27) ──────────────────────────────────

test('the page carries a light AND a dark reading of whatever was authored', { skip: SKIP }, async () => {
  const dark = await mount({
    color: '#eef2ff', background: '#0b1020', accent: '#2563eb',
    links: links(['https://example.com', 'Home']),
  });
  const light = await mount({
    color: '#1c1917', background: '#faf7f2', accent: '#b91c1c',
    links: links(['https://example.com', 'Home']),
  });

  for (const got of [dark, light]) {
    // The bare names are the stylesheet's to set. A template that wrote one
    // would pin the page to a single scheme, which is exactly the bug.
    assert.ok(!/--jp-ink:/.test(got.svg), 'the template never writes a bare --jp-ink');
    assert.ok(!/--jp-paper:/.test(got.svg), 'nor a bare --jp-paper');
    for (const name of ['ink', 'paper', 'accent', 'shade', 'on-accent', 'muted', 'edge', 'card']) {
      assert.ok(got.svg.includes(`--jp-${name}-l:`), `the light set carries --jp-${name}-l`);
      assert.ok(got.svg.includes(`--jp-${name}-d:`), `the dark set carries --jp-${name}-d`);
    }
  }

  // Whichever way round it was authored, each set's paper sits on its own side
  // of the middle - otherwise one of the two readings is unreadable.
  const luma = (svg: string, suffix: string) => {
    const hex = RegExp(`--jp-paper-${suffix}:#([0-9a-f]{6})`).exec(svg)?.[1];
    assert.ok(hex, `--jp-paper-${suffix} is a plain hex colour`);
    const n = parseInt(hex!, 16);
    return (0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  };
  for (const got of [dark, light]) {
    assert.ok(luma(got.svg, 'l') > 0.5, 'the light set has light paper');
    assert.ok(luma(got.svg, 'd') < 0.5, 'the dark set has dark paper');
  }
  // The authored palette is one of the two, kept exactly as it was typed.
  assert.ok(dark.svg.includes('--jp-paper-d:#0b1020'), 'a dark authored page IS the dark set');
  assert.ok(light.svg.includes('--jp-paper-l:#faf7f2'), 'a light authored page IS the light set');

  // The aurora shader cannot read CSS, so it gets its own pair of attributes.
  const aurora = await mount({ style: 'aurora', links: links(['https://example.com', 'Home']) });
  for (const a of ['a', 'b', 'c', 'p']) {
    assert.ok(aurora.svg.includes(`data-mesh-${a}=`), `the mesh keeps its light ${a} colour`);
    assert.ok(aurora.svg.includes(`data-mesh-${a}-d=`), `and gains a dark ${a} colour`);
  }
});

test('one mapping block is the only place a scheme is chosen', { skip: SKIP }, () => {
  const css = readFileSync(join(COMMUNITY, 'jump', 'styles.css'), 'utf8');
  const DARK = '@media (prefers-color-scheme: dark)';
  assert.equal(css.indexOf(DARK), css.lastIndexOf(DARK),
    'exactly one dark-scheme query, so there is one region to read');
  const at = css.indexOf(DARK);
  const end = blockEnd(css, css.indexOf('{', at));

  for (const name of ['ink', 'paper', 'accent', 'shade', 'on-accent', 'muted', 'edge', 'card']) {
    assert.match(css.slice(0, at), RegExp(`--jp-${name}:\\s*var\\(--jp-${name}-l\\)`),
      `--jp-${name} maps to the light set by default`);
    assert.match(css.slice(at, end), RegExp(`--jp-${name}:\\s*var\\(--jp-${name}-d\\)`),
      `--jp-${name} maps to the dark set inside the query`);
  }
  // Every other rule stays scheme-blind: a -l or -d suffix anywhere else means
  // a style has hard-wired one reading of the page.
  for (const m of css.matchAll(/--jp-[a-z-]+-[ld]\b/g)) {
    assert.ok(m.index! < end, `a scheme-specific colour at offset ${m.index} escapes the mapping block`);
  }
});
