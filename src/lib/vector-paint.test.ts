// SPDX-License-Identifier: MPL-2.0
/**
 * vector-paint - the shared vocabulary for canvas vector twins.
 *
 * Two kinds of assertion here, and the second is the one that matters most:
 *
 *  1. BEHAVIOUR - the markup builders, the tile cap, the id namespacing that stops two
 *     twins in one export from both minting `fcclip-1`, and the parse boundary that
 *     turns every malformed twin into a plain `null` (i.e. into today's raster).
 *  2. DRIFT - `waveformPathD` and `stillTilePx` are transcriptions of two loops in
 *     views/timeline-panel.ts. They are asserted NUMERICALLY against the panel's own
 *     arithmetic, recomputed here from the same terms, AND the panel's source is
 *     scanned for those terms. If the canvas paint moves and the twin does not, an
 *     export stops matching the screen silently - this is the pair of checks that
 *     makes that loud instead.
 *
 * jsdom only for `DOMParser` (parseSvgRoot/namespaceSvgRefs are the only DOM users in the
 * module); everything else is arithmetic and strings.
 *
 * Run directly:  node --test shells/web/src/lib/vector-paint.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { JSDOM } from 'jsdom';

import {
  MAX_TWIN_TILES,
  MAX_TWIN_BYTES,
  svgDoc,
  rectBody,
  waveformPathD,
  stillTilePx,
  tileBody,
  parseSvgRoot,
  namespaceSvgRefs,
} from './vector-paint.ts';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
(globalThis as { DOMParser?: unknown }).DOMParser = dom.window.DOMParser;

const here = dirname(fileURLToPath(import.meta.url));
// The panel is an orchestrator plus feature modules under views/timeline-panel/ (2026-09-09 split).
const panelDir = join(here, '..', 'views', 'timeline-panel');
const panelSrc = [readFileSync(join(here, '..', 'views', 'timeline-panel.ts'), 'utf8'), ...readdirSync(panelDir).filter((n) => n.endsWith('.ts')).sort().map((n) => readFileSync(join(panelDir, n), 'utf8'))].join('\n');

/** Pull the bars back out of a path `d` so they can be compared as numbers. */
function bars(d: string): Array<{ x: number; y: number; w: number; h: number }> {
  const out: Array<{ x: number; y: number; w: number; h: number }> = [];
  const re = /M(-?[\d.]+) (-?[\d.]+)h(-?[\d.]+)v(-?[\d.]+)h(-?[\d.]+)Z/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d))) {
    out.push({ x: +m[1]!, y: +m[2]!, w: +m[3]!, h: +m[4]! });
    // The closing horizontal must undo the opening one, or the bar is not a rectangle.
    assert.equal(+m[5]!, -+m[3]!);
  }
  return out;
}

const near = (a: number, b: number, msg: string): void => {
  assert.ok(Math.abs(a - b) <= 0.001, `${msg}: ${a} vs ${b}`);
};

// ── waveformPathD ────────────────────────────────────────────────────────────

test('waveformPathD reproduces the panel fillRect loop term for term', () => {
  const data = [0, 0.01, 0.02, 0.3, 0.75, 1, 1.4, 0.5];
  const w = 485;
  const h = 28;
  const got = bars(waveformPathD(data, w, h));
  assert.equal(got.length, data.length);

  // The panel's loop, recomputed independently.
  const bw = w / data.length;
  for (let i = 0; i < data.length; i++) {
    const amp = Math.max(0.02, Math.min(1, data[i]!));
    const bh = amp * (h - 4);
    near(got[i]!.x, i * bw, `bar ${i} x`);
    near(got[i]!.y, (h - bh) / 2, `bar ${i} y`);
    near(got[i]!.w, Math.max(1, bw - 0.5), `bar ${i} width`);
    near(got[i]!.h, bh, `bar ${i} height`);
  }
});

test('waveformPathD clamps: the 0.02 floor and the 1.0 ceiling', () => {
  const h = 28;
  const got = bars(waveformPathD([0, 0.02, 1, 5], 400, h));
  near(got[0]!.h, 0.02 * (h - 4), 'zero clamps UP to the floor');
  near(got[1]!.h, got[0]!.h, 'exactly the floor is unchanged');
  near(got[2]!.h, 1 * (h - 4), 'full scale');
  near(got[3]!.h, got[2]!.h, 'over-unity clamps DOWN to 1');
});

test('waveformPathD: silence is a hairline row of bars, never nothing', () => {
  // The floor is why a silent clip still reads as a waveform on screen - an export
  // that dropped it would be a different picture, not a cleaner one.
  const h = 28;
  const d = waveformPathD(new Float32Array(64), 485, h);
  const got = bars(d);
  assert.equal(got.length, 64);
  for (const b of got) {
    near(b.h, 0.02 * (h - 4), 'silent bar height');
    near(b.y, (h - 0.02 * (h - 4)) / 2, 'silent bar is centred');
  }
});

test('waveformPathD: narrow bars keep the 1px minimum width', () => {
  // 600 buckets in a 300px bar: bw = 0.5, so bw - 0.5 = 0 and the max() is required.
  const got = bars(waveformPathD(new Array(600).fill(0.5), 300, 28));
  for (const b of got) near(b.w, 1, 'min bar width');
});

test('waveformPathD: degenerate inputs produce an empty path, not markup', () => {
  assert.equal(waveformPathD([], 485, 28), '');
  assert.equal(waveformPathD([0.5], 0, 28), '');
});

test('the panel still paints the arithmetic waveformPathD transcribes', () => {
  // A source scan, because the numeric test above can only prove the helper is
  // self-consistent - this is what fails when the CANVAS side moves.
  assert.ok(panelSrc.includes('Math.max(0.02, Math.min(1, data[i]!))'), 'amp clamp');
  assert.ok(panelSrc.includes('const bh = amp * (h - 4);'), 'bar height');
  assert.ok(panelSrc.includes('ctx.fillRect(i * bw, (h - bh) / 2, Math.max(1, bw - 0.5), bh);'), 'fillRect');
  assert.ok(panelSrc.includes('const bw = w / data.length;'), 'bar pitch');
});

// ── stillTilePx ──────────────────────────────────────────────────────────────

test('stillTilePx matches drawTiled, including the no-aspect fallback', () => {
  assert.equal(stillTilePx(16 / 9, 38), Math.max(6, (16 / 9) * 38));
  assert.equal(stillTilePx(0.05, 38), 6, 'the 6px floor wins for a sliver');
  assert.equal(stillTilePx(0, 38), 38, 'aspect 0 (undecoded / zero-height) falls back to h');
  assert.equal(stillTilePx(-2, 38), 38, 'a nonsense aspect takes the same fallback');
});

test('the panel still tiles by the expression stillTilePx transcribes', () => {
  assert.ok(
    panelSrc.includes('bm.height > 0 ? Math.max(6, (bm.width / bm.height) * h) : h'),
    'drawTiled tile advance',
  );
});

// ── tileBody ─────────────────────────────────────────────────────────────────

const useCount = (s: string | null): number => (s?.match(/<use\b/g) ?? []).length;

test('tileBody repeats one definition across the bar', () => {
  const body = tileBody('<rect width="10" height="10"/>', 25, 100, 38)!;
  assert.ok(body, 'four tiles is well inside the cap');
  assert.equal(useCount(body), 4, 'x = 0, 25, 50, 75');
  assert.equal((body.match(/<g id="twin-tile">/g) ?? []).length, 1, 'defined exactly once');
  assert.ok(body.includes('x="25"') && body.includes('x="75"'), 'tiles advance by tileW');
  assert.ok(body.includes('clip-path="url(#twin-clip)"'), 'clipped to the bar, as the canvas edge does');
  assert.ok(body.includes('width="100"') && body.includes('height="38"'), 'clip is the bar box');
});

test('tileBody DECLINES past MAX_TWIN_TILES rather than emitting a short run', () => {
  // The canvas loop it mirrors has no cap, so a capped vector form would export a
  // bar whose right-hand end is blank while the screen shows it fully tiled. Null falls
  // through to the PNG the user is actually looking at. Reachable, not exotic: `tile`
  // floors at 6px, so a tall still needs more than 64 tiles from ~384px of bar.
  assert.equal(tileBody('<rect/>', 6, 6000, 38), null, 'a 1000-tile bar declines');
  assert.equal(tileBody('<rect/>', 6, 400, 34), null, 'and so does a 400px one at the 6px floor');
  // The boundary itself, both sides.
  assert.equal(useCount(tileBody('<rect/>', 10, 640, 38)), MAX_TWIN_TILES, 'exactly 64 is fine');
  assert.equal(tileBody('<rect/>', 10, 641, 38), null, 'one more declines');
});

test('tileBody survives a degenerate tile width', () => {
  const body = tileBody('<rect/>', 0, 100, 38);
  assert.equal(useCount(body), 1, 'a zero advance must not loop forever');
});

// ── svgDoc / rectBody ────────────────────────────────────────────────────────

test('svgDoc wraps a body in a viewBoxed root', () => {
  const s = svgDoc(485, 28, '<rect/>');
  assert.ok(s.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'));
  assert.ok(s.includes('viewBox="0 0 485 28"'));
  assert.ok(s.endsWith('<rect/></svg>'));
});

test('rectBody escapes its colour', () => {
  // A colour reaches this as a raw string resolved off the cascade; a token value that
  // is not a colour at all must not be able to close the attribute and inject markup.
  const body = rectBody('"/><script>x</script>', 10, 5);
  assert.ok(!body.includes('<script>'), 'no live element');
  assert.ok(body.includes('&quot;'), 'quote escaped');
  assert.ok(body.includes('&lt;script&gt;'), 'angle brackets escaped');
  assert.equal(rectBody('#ff0000', 10, 5), '<rect x="0" y="0" width="10" height="5" fill="#ff0000"/>');
});

// ── parseSvgRoot ─────────────────────────────────────────────────────────────

test('parseSvgRoot accepts a well-formed svg root', () => {
  const root = parseSvgRoot('<svg xmlns="http://www.w3.org/2000/svg"><rect id="a"/></svg>');
  assert.ok(root);
  assert.equal(root!.localName, 'svg');
});

test('parseSvgRoot declines malformed markup (parsererror)', () => {
  assert.equal(parseSvgRoot('<svg><rect></svg>'), null);
});

test('parseSvgRoot declines a non-svg root', () => {
  // A producer that returned a fragment, an HTML error page, or a bare <g> must not be
  // spliced into the export tree - the raster fallback is correct and bounded.
  assert.equal(parseSvgRoot('<g><rect/></g>'), null);
  assert.equal(parseSvgRoot('<html xmlns="http://www.w3.org/1999/xhtml"><body/></html>'), null);
});

test('parseSvgRoot declines markup over MAX_TWIN_BYTES before parsing it', () => {
  const fat = `<svg xmlns="http://www.w3.org/2000/svg">${'<rect/>'.repeat(MAX_TWIN_BYTES)}</svg>`;
  assert.ok(fat.length > MAX_TWIN_BYTES);
  assert.equal(parseSvgRoot(fat), null);
});

test('parseSvgRoot declines empty and non-string input', () => {
  assert.equal(parseSvgRoot(''), null);
  assert.equal(parseSvgRoot(null as unknown as string), null);
});

// ── namespaceSvgRefs (hazard 1: the walker's uid counter is a per-call local) ─────

test('namespaceSvgRefs rewrites ids and every reference to them', () => {
  const root = parseSvgRoot(
    '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">'
    + '<defs><clipPath id="fcclip-1"><rect/></clipPath>'
    + '<linearGradient id="g1"><stop/></linearGradient></defs>'
    + '<g clip-path="url(#fcclip-1)" style="fill:url(#g1)">'
    + '<rect fill="url( \'#g1\' )"/><use href="#g1"/><use xlink:href="#fcclip-1"/>'
    + '</g></svg>',
  )!;
  namespaceSvgRefs(root, 'tw3-');
  const out = root.outerHTML ?? new dom.window.XMLSerializer().serializeToString(root);

  assert.ok(out.includes('id="tw3-fcclip-1"'), 'id renamed');
  assert.ok(out.includes('id="tw3-g1"'), 'second id renamed');
  assert.ok(out.includes('url(#tw3-fcclip-1)'), 'url() in a presentation attribute');
  assert.ok(out.includes('url(#tw3-g1)'), 'url() inside the inline style attribute');
  assert.ok(out.includes("url('#tw3-g1')"), 'quoted url() form');
  assert.ok(out.includes('href="#tw3-g1"'), 'href fragment');
  assert.ok(out.includes('#tw3-fcclip-1"'), 'xlink:href fragment');
  assert.ok(!/[^-]#fcclip-1\b/.test(out) && !out.includes('"#fcclip-1"'), 'no original id survives');
  assert.ok(!out.includes('url(#g1)'), 'no original reference survives');
});

test('namespaceSvgRefs leaves references it did not define alone', () => {
  // A reference into the HOST document is already correct; rewriting it breaks it.
  // The '#' test also has to not maul colour values.
  const root = parseSvgRoot(
    '<svg xmlns="http://www.w3.org/2000/svg"><rect id="mine" fill="#ff0000" '
    + 'clip-path="url(#somebody-elses)"/><use href="#mine"/></svg>',
  )!;
  namespaceSvgRefs(root, 'p-');
  const out = root.outerHTML ?? new dom.window.XMLSerializer().serializeToString(root);
  assert.ok(out.includes('id="p-mine"'));
  assert.ok(out.includes('href="#p-mine"'));
  assert.ok(out.includes('url(#somebody-elses)'), 'foreign reference untouched');
  assert.ok(out.includes('fill="#ff0000"'), 'a colour is not a fragment reference');
});

test('namespaceSvgRefs rewrites url() inside a twin\'s own <style>', () => {
  const root = parseSvgRoot(
    '<svg xmlns="http://www.w3.org/2000/svg"><style>.a{fill:url(#g)}</style>'
    + '<linearGradient id="g"/><rect class="a"/></svg>',
  )!;
  namespaceSvgRefs(root, 'z-');
  const out = root.outerHTML ?? new dom.window.XMLSerializer().serializeToString(root);
  assert.ok(out.includes('url(#z-g)'), 'stylesheet reference follows the rename');
});

// The adversarial pass broke the first version of this in three ways; each one is a
// silent WRONG PICTURE, not a crash, so each gets its own case.

test('a hex colour is never mistaken for a fragment reference, even when an id matches it', () => {
  // `fill="#abc"` is the colour #abc. The tempting rule - "a # value whose target is a
  // defined id" - is ambiguous by construction, and a twin embedding arbitrary user SVG
  // (the still path resolves a data: URL) can easily define an id called `abc`. The
  // rewrite produced fill="#tw1-abc", which is not a colour, and the shape lost its paint.
  const root = parseSvgRoot(
    '<svg xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="abc"/></defs>'
    + '<rect fill="#abc" stroke="#abc" style="fill:#abc"/><use href="#abc"/></svg>',
  )!;
  namespaceSvgRefs(root, 'tw1-');
  const out = new dom.window.XMLSerializer().serializeToString(root);
  assert.ok(out.includes('fill="#abc"'), 'the colour is left alone');
  assert.ok(out.includes('stroke="#abc"'), 'on every attribute that takes a paint');
  assert.ok(out.includes('fill:#abc'), 'and inside an inline style');
  assert.ok(out.includes('href="#tw1-abc"'), 'while a real fragment reference still moves');
});

test('an ID SELECTOR in a twin\'s <style> follows the rename', () => {
  // Renaming the id without the selector leaves a rule matching nothing: the twin
  // silently loses that styling.
  const root = parseSvgRoot(
    '<svg xmlns="http://www.w3.org/2000/svg"><style>#twin-tile{fill:red}</style>'
    + '<g id="twin-tile"><rect/></g></svg>',
  )!;
  namespaceSvgRefs(root, 'tw2-');
  const out = new dom.window.XMLSerializer().serializeToString(root);
  assert.ok(out.includes('id="tw2-twin-tile"'));
  assert.ok(out.includes('#tw2-twin-tile{fill:red}'), 'the selector moved with the id');
});

test('CLASS selectors and class attributes are namespaced together', () => {
  // A twin's <style> reaches the export document UNSCOPED (export.ts runs
  // unscopeStyleEls first), so an Illustrator-style `.cls-1 { fill: … }` riding in on a
  // still would restyle unrelated elements anywhere in the exported file.
  const root = parseSvgRoot(
    '<svg xmlns="http://www.w3.org/2000/svg"><style>.cls-1{fill:red}.a .b{fill:blue}</style>'
    + '<rect class="cls-1"/><g class="a"><rect class="b"/></g></svg>',
  )!;
  namespaceSvgRefs(root, 'tw4-');
  const out = new dom.window.XMLSerializer().serializeToString(root);
  assert.ok(out.includes('.tw4-cls-1{fill:red}'), 'selector namespaced');
  assert.ok(out.includes('class="tw4-cls-1"'), 'and the attribute with it');
  assert.ok(out.includes('.tw4-a .tw4-b'), 'descendant selectors too');
  assert.ok(out.includes('class="tw4-b"'));
  assert.ok(!/[^-]\.cls-1/.test(out), 'no bare class rule survives to reach the host document');
});

test('a twin with classes but NO ids is still namespaced', () => {
  // The early return on an empty id set skipped class namespacing entirely - which is
  // exactly the structure of a plain Illustrator export.
  const root = parseSvgRoot(
    '<svg xmlns="http://www.w3.org/2000/svg"><style>.cls-1{fill:red}</style>'
    + '<rect class="cls-1"/></svg>',
  )!;
  namespaceSvgRefs(root, 'tw5-');
  const out = new dom.window.XMLSerializer().serializeToString(root);
  assert.ok(out.includes('.tw5-cls-1'), 'selector namespaced with no id in sight');
  assert.ok(out.includes('class="tw5-cls-1"'));
});

test('namespaceSvgRefs is a no-op on a twin with no ids or classes, and on an empty prefix', () => {
  const a = parseSvgRoot('<svg xmlns="http://www.w3.org/2000/svg"><rect fill="red"/></svg>')!;
  const before = new dom.window.XMLSerializer().serializeToString(a);
  namespaceSvgRefs(a, 'q-');
  assert.equal(new dom.window.XMLSerializer().serializeToString(a), before);

  const b = parseSvgRoot('<svg xmlns="http://www.w3.org/2000/svg"><rect id="k"/></svg>')!;
  const bBefore = new dom.window.XMLSerializer().serializeToString(b);
  namespaceSvgRefs(b, '');
  assert.equal(new dom.window.XMLSerializer().serializeToString(b), bBefore);
});
