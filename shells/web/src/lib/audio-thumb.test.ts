// SPDX-License-Identifier: MPL-2.0
/**
 * Tests for audio-thumb.ts - the audio waveform thumbnail renderer.
 *
 * WHAT IS COVERED HERE (real module, real catalog ids, no mocks):
 *   • audioThumbShape - determinism + the measured distribution over the ACTUAL
 *                             audio asset ids in brands/lolly-start + brands/suse
 *   • audioThumbSvg - all five shapes emit well-formed SVG for peak arrays of
 *                             length 1, 2, 64, all-zero and all-one
 *   • corrupt caches - NaN / Infinity / negatives never reach a path, so no
 *                             `d="M NaN NaN"` (a half-written peaks cache must degrade,
 *                             not render a blank tile)
 *   • escaping - className/id/label are attribute-escaped
 *   • audioThumbPlaceholder - the honest glyph: no waveform path, no data attribution
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  type AudioThumbShape,
  audioThumbPlaceholder,
  audioThumbShape,
  audioThumbSvg,
} from './audio-thumb.ts';

const SHAPES: AudioThumbShape[] = ['bars', 'mirror', 'wave', 'ring', 'blob'];
const REPO = fileURLToPath(new URL('../../../../', import.meta.url));

/**
 * Audio asset ids from a mounted brand pack. brands/suse is a PRIVATE submodule with
 * `update = none`, so a public clone (and CI) simply has no such directory - return
 * nothing rather than fail a test about hashing.
 */
function catalogAudioIds(brand: string): string[] {
  const path = `${REPO}brands/${brand}/catalog/assets/index.json`;
  if (!existsSync(path)) return [];
  const raw = readFileSync(path, 'utf8');
  const parsed = JSON.parse(raw) as unknown;
  const list = (
    Array.isArray(parsed) ? parsed : ((parsed as { assets?: unknown[] }).assets ?? [])
  ) as { id: string; type?: string }[];
  return list.filter((a) => a.type === 'audio').map((a) => a.id);
}

/** Every number that appears in a coordinate position of the markup. */
function coordTokens(svg: string): string[] {
  const out: string[] = [];
  for (const m of svg.matchAll(/(?:d|x|y|x1|y1|x2|y2|cx|cy|r|rx|width|height)="([^"]*)"/g)) {
    // `-` doubles as a separator in path data ("l24-4"), so split it off first.
    const val = m[1] ?? '';
    for (const tok of val.replace(/(\d)-/g, '$1 -').split(/[\sA-Za-z,]+/)) if (tok) out.push(tok);
  }
  return out;
}

function assertWellFormed(svg: string): void {
  assert.match(svg, /^<svg /, 'starts with an <svg> root');
  assert.match(svg, /<\/svg>$/, 'closes the root');
  assert.match(svg, /viewBox="0 0 64 64"/);
  // Balanced-enough check: every opened element name has a close or self-closes.
  const opens = (svg.match(/<(?!\/)/g) ?? []).length;
  const closes = (svg.match(/\/>|<\//g) ?? []).length;
  assert.equal(opens, closes, 'every element is closed or self-closing');
  for (const tok of coordTokens(svg)) {
    assert.ok(
      Number.isFinite(Number(tok)),
      `coordinate "${tok}" is not a finite number in: ${svg.slice(0, 200)}`
    );
  }
  assert.ok(!/NaN|Infinity|undefined|null/.test(svg), 'no NaN/Infinity/undefined in markup');
}

test('audioThumbShape is deterministic and returns a known shape', () => {
  for (const id of ['suse/music/a-beautiful-dream', 'lolly/loops/fireplace-loop', '', 'x']) {
    const first = audioThumbShape(id);
    assert.ok(SHAPES.includes(first), `${id} → ${first}`);
    assert.equal(audioThumbShape(id), first, 'same id, same shape, every call');
  }
});

test('audioThumbShape spreads the REAL catalog ids across all five shapes', () => {
  const ids = [...catalogAudioIds('lolly-start'), ...catalogAudioIds('suse')];
  assert.ok(ids.length >= 20, `expected real audio ids, got ${ids.length}`);
  const counts = new Map<AudioThumbShape, number>(SHAPES.map((s) => [s, 0]));
  for (const id of ids) counts.set(audioThumbShape(id), (counts.get(audioThumbShape(id)) ?? 0) + 1);
  // Catalog ids share long prefixes (suse/music/…, lolly/loops/…). The point of the
  // feature is a varied grid, so assert every shape is actually used and no single one
  // swallows the catalog - a char-sum hash would pile most ids onto one bucket.
  for (const s of SHAPES) {
    const n = counts.get(s) ?? 0;
    assert.ok(n > 0, `shape ${s} unused across ${ids.length} real ids`);
    assert.ok(n < ids.length * 0.5, `shape ${s} took ${n}/${ids.length} - badly distributed`);
  }
});

test('every shape emits well-formed SVG for degenerate and normal peak arrays', () => {
  const cases: Record<string, number[]> = {
    one: [0.5],
    two: [0, 1],
    sixtyFour: Array.from({ length: 64 }, (_, i) => Math.abs(Math.sin(i / 3))),
    allZero: new Array(32).fill(0),
    allOne: new Array(32).fill(1),
  };
  for (const shape of SHAPES) {
    for (const [name, peaks] of Object.entries(cases)) {
      const svg = audioThumbSvg(peaks, { shape });
      assertWellFormed(svg);
      assert.match(svg, new RegExp(`data-audio-shape="${shape}"`), `${shape}/${name}`);
    }
  }
});

test('Float32Array peaks work the same as a plain array', () => {
  const arr = [0.1, 0.9, 0.4, 0.7];
  for (const shape of SHAPES) {
    assert.equal(audioThumbSvg(new Float32Array(arr), { shape }), audioThumbSvg(arr, { shape }));
  }
});

test('a corrupt peaks cache never produces NaN coordinates', () => {
  const corrupt = [
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    -0.5,
    4,
    0.3,
    Number.NaN,
  ];
  for (const shape of SHAPES) {
    const svg = audioThumbSvg(corrupt, { shape });
    assertWellFormed(svg);
  }
  // Every value being garbage still yields a drawable (flat) tile, not `M NaN NaN`.
  for (const shape of SHAPES) {
    assertWellFormed(audioThumbSvg([Number.NaN, Number.NaN, Number.NaN], { shape }));
  }
});

test('the shape follows the id when none is passed explicitly', () => {
  const id = 'suse/music/business-casual';
  const svg = audioThumbSvg([0.2, 0.8, 0.5], { id });
  assert.match(svg, new RegExp(`data-audio-shape="${audioThumbShape(id)}"`));
  assert.match(svg, /data-audio-id="suse\/music\/business-casual"/);
});

test('attributes are escaped', () => {
  const svg = audioThumbSvg([0.5, 0.5], {
    shape: 'bars',
    className: 'a" onload="x',
    id: '<id>',
    label: 'Tom & "Jerry"',
  });
  // The payload survives as inert TEXT inside the class value - it must never close
  // the attribute and become a real handler.
  assert.ok(!/onload="/.test(svg), 'quote-break in className is neutralised');
  assert.match(svg, /class="a&quot; onload=&quot;x"/);
  assert.match(svg, /data-audio-id="&lt;id&gt;"/);
  assert.match(svg, /aria-label="Tom &amp; &quot;Jerry&quot;"/);
});

test('decorative by default, labelled on request', () => {
  const bare = audioThumbSvg([0.4, 0.6], { shape: 'wave' });
  assert.match(bare, /aria-hidden="true"/);
  assert.ok(!bare.includes('<title>'));
  const labelled = audioThumbSvg([0.4, 0.6], { shape: 'wave', label: 'Fireplace loop' });
  assert.match(labelled, /role="img"/);
  assert.match(labelled, /<title>Fireplace loop<\/title>/);
  assert.ok(!labelled.includes('aria-hidden'));
});

test('paint is theme-inheriting, with no hard-coded brand colour', () => {
  for (const shape of SHAPES) {
    const svg = audioThumbSvg([0.3, 0.9, 0.1], { shape });
    assert.match(svg, /color:var\(--audio-thumb-ink, currentColor\)/);
    assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(svg), `${shape} hard-codes a colour`);
    assert.ok(!/rgb|hsl|oklch/.test(svg), `${shape} hard-codes a colour`);
  }
});

test('audioThumbPlaceholder is an honest glyph, not a fabricated waveform', () => {
  const svg = audioThumbPlaceholder({ className: 'cat-thumb' });
  assertWellFormed(svg);
  assert.match(svg, /data-audio-shape="none"/);
  assert.match(svg, /class="cat-thumb"/);
  // The glyph is a note (one path + two circles). A waveform path would have far more
  // vertices - this is the guard against ever swapping in a synthesised shape.
  const d = [...svg.matchAll(/ d="([^"]*)"/g)].map((m) => m[1]);
  assert.equal(d.length, 1, 'exactly one path in the glyph');
  assert.ok(((d[0] ?? '').match(/L/g) ?? []).length <= 2, 'not a polyline waveform');
});

test('empty peaks fall back to the placeholder rather than a flat line', () => {
  // A flat line would assert silence nothing ever measured.
  const empty = audioThumbSvg([], { shape: 'wave', className: 'k' });
  assert.equal(empty, audioThumbPlaceholder({ className: 'k' }));
  assert.equal(audioThumbSvg(new Float32Array(0), { shape: 'ring' }), audioThumbPlaceholder({}));
});
