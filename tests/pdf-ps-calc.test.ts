// SPDX-License-Identifier: MPL-2.0
/**
 * Unit tests for the PDF FunctionType 4 (PostScript calculator) evaluator
 * (shells/web/src/lib/pdf-ps-calc.ts), against the REAL module — no mocks.
 *
 * Why this is worth being pedantic about: Chromium encodes an out-of-sRGB CSS
 * colour, a conic-gradient and every wide-gamut interpolated gradient as a
 * function-based shading driven by one of these programs. A unit slip in `atan`
 * (degrees, not radians, and [0,360) not signed) or a sign slip in `mod` doesn't
 * throw — it silently paints the wrong colour, or paints nothing.
 *
 * Run with: node --test tests/pdf-ps-calc.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { compilePostScriptCalculator } from '../shells/web/src/lib/pdf-ps-calc.ts';

const WIDE = [-1e9, 1e9];

/** Compile+run a program body. Inputs land on the stack in order; the result is
 *  the top `nOut` values, clipped to `range`. */
function ev(body: string, args: number[] = [0], nOut = 1, range?: number[]): number[] | null {
  const r = range ?? Array.from({ length: nOut }, () => WIDE).flat();
  const fn = compilePostScriptCalculator(`{${body}}`, Math.max(1, args.length), r);
  return fn ? fn(args.length ? args : [0]) : null;
}
const one = (body: string, args: number[] = [0]): number | null => {
  const r = ev(body, args);
  return r ? r[0]! : null;
};
const near = (a: number | null, b: number, eps = 1e-9): boolean => a !== null && Math.abs(a - b) <= eps;

// ── arithmetic (PDF 32000-1 §7.10.5.1) ───────────────────────────────────────
test('arithmetic operators evaluate to hand-computed values', () => {
  assert.equal(one('3 4 add'), 7);
  assert.equal(one('10 4 sub'), 6);
  assert.equal(one('6 7 mul'), 42);
  assert.equal(one('7 2 div'), 3.5);
  assert.equal(one('-5 abs'), 5);
  assert.equal(one('5 neg'), -5);
  assert.equal(one('9 sqrt'), 3);
  assert.equal(one('2 10 exp'), 1024);
  assert.ok(near(one('1 ln'), 0));
  assert.ok(near(one('1000 log'), 3));
  assert.equal(one('3.7 cvi'), 3);
  assert.equal(one('-3.7 cvi'), -3, 'cvi truncates toward zero');
  assert.equal(one('4 cvr'), 4);
});

test('idiv and mod follow the spec sign rules', () => {
  // idiv discards the fractional part — i.e. truncates TOWARD ZERO, not floors.
  assert.equal(one('7 2 idiv'), 3);
  assert.equal(one('-7 2 idiv'), -3);
  assert.equal(one('7 -2 idiv'), -3);
  // mod's sign follows the DIVIDEND.
  assert.equal(one('-7 3 mod'), -1);
  assert.equal(one('7 -3 mod'), 1);
  // Non-integer operands are a type error for both.
  assert.equal(one('7.5 2 idiv'), null);
  assert.equal(one('7.5 2 mod'), null);
  assert.equal(one('7 0 idiv'), null);
});

test('rounding operators split correctly on negatives', () => {
  assert.equal(one('2.5 round'), 3);
  assert.equal(one('-2.5 round'), -3, 'round is half AWAY from zero, not half-up');
  assert.equal(one('-2.5 truncate'), -2);
  assert.equal(one('-2.5 ceiling'), -2);
  assert.equal(one('-2.5 floor'), -3);
});

test('sin and cos take DEGREES', () => {
  assert.ok(near(one('90 sin'), 1, 1e-12));
  assert.ok(near(one('30 sin'), 0.5, 1e-12));
  assert.ok(near(one('180 cos'), -1, 1e-12));
  assert.ok(near(one('0 cos'), 1, 1e-12));
  // A radians implementation would give sin(90 rad) ≈ 0.894 — assert we don't.
  assert.ok(Math.abs(one('90 sin')! - Math.sin(90)) > 0.1);
});

test('atan returns DEGREES in [0,360) across all four quadrants', () => {
  // `num den atan` — the quadrant comes from the signs of BOTH operands.
  assert.ok(near(one('0 1 atan'), 0));
  assert.ok(near(one('1 1 atan'), 45));
  assert.ok(near(one('1 0 atan'), 90));
  assert.ok(near(one('1 -1 atan'), 135));
  assert.ok(near(one('0 -1 atan'), 180));
  assert.ok(near(one('-1 -1 atan'), 225));
  assert.ok(near(one('-1 0 atan'), 270), 'never negative');
  assert.ok(near(one('-1 1 atan'), 315));
});

// ── relational / boolean / bitwise (§7.10.5.2) ───────────────────────────────
test('comparisons and booleans drive ifelse', () => {
  assert.equal(one('1 2 lt {10} {20} ifelse'), 10);
  assert.equal(one('1 2 gt {10} {20} ifelse'), 20);
  assert.equal(one('2 2 ge {10} {20} ifelse'), 10);
  assert.equal(one('2 2 le {10} {20} ifelse'), 10);
  assert.equal(one('2 2 eq {10} {20} ifelse'), 10);
  assert.equal(one('2 3 ne {10} {20} ifelse'), 10);
  assert.equal(one('true false and {10} {20} ifelse'), 20);
  assert.equal(one('true false or {10} {20} ifelse'), 10);
  assert.equal(one('true true xor {10} {20} ifelse'), 20);
  assert.equal(one('false not {10} {20} ifelse'), 10);
  assert.equal(one('true {7} if'), 7);
  assert.equal(one('false {7} if 5'), 5, 'a false `if` leaves the stack alone');
});

test('and/or/xor/not are bitwise on integers and logical on booleans', () => {
  assert.equal(one('12 10 and'), 8);
  assert.equal(one('12 10 or'), 14);
  assert.equal(one('12 10 xor'), 6);
  assert.equal(one('0 not'), -1, 'bitwise complement of 0');
  assert.equal(one('1 4 bitshift'), 16);
  assert.equal(one('16 -4 bitshift'), 1);
});

test('mixing booleans into arithmetic is a type error, not a silent 0/1', () => {
  assert.equal(one('true 1 add'), null);
  assert.equal(one('1 true mul'), null);
  assert.equal(one('true 1 lt {1} {2} ifelse'), null);
  // A procedure left where a number is expected must not be coerced either.
  assert.equal(one('{1} 2 add'), null);
});

// ── stack operators (§7.10.5.4) ──────────────────────────────────────────────
test('dup / exch / pop / index / copy', () => {
  assert.equal(one('5 dup add'), 10);
  assert.deepEqual(ev('pop 1 2 exch', [0], 2), [2, 1]);
  assert.equal(one('1 2 pop'), 1);
  assert.equal(one('pop 7 8 9 2 index'), 7, 'index is 0-based FROM THE TOP');
  assert.equal(one('pop 7 8 9 0 index'), 9);
  assert.deepEqual(ev('pop 1 2 2 copy', [0], 4), [1, 2, 1, 2]);
  assert.equal(one('9 0 copy'), 9, '`0 copy` is legal and a no-op');
  // Out-of-range operands fault rather than reading garbage.
  assert.equal(one('1 5 index'), null);
  assert.equal(one('1 -1 index'), null);
  assert.equal(one('1 5 copy'), null);
});

test('roll shifts circularly, including for negative j', () => {
  assert.deepEqual(ev('pop 1 2 3 3 1 roll', [0], 3), [3, 1, 2]);
  assert.deepEqual(ev('pop 1 2 3 3 -1 roll', [0], 3), [2, 3, 1]);
  assert.deepEqual(ev('pop 1 2 3 3 0 roll', [0], 3), [1, 2, 3]);
  assert.deepEqual(ev('pop 1 2 3 3 4 roll', [0], 3), [3, 1, 2], 'j wraps past n');
  assert.equal(one('1 2 9 1 roll'), null, 'n larger than the stack faults');
});

// ── structure ────────────────────────────────────────────────────────────────
test('nested ifelse picks the right branch at depth', () => {
  const body = '2 copy lt { pop pop 1 } { 2 copy eq { pop pop 2 } { pop pop 3 } ifelse } ifelse';
  assert.equal(one(body, [1, 2]), 1);
  assert.equal(one(body, [2, 2]), 2);
  assert.equal(one(body, [3, 2]), 3);
});

test('inputs arrive on the stack in order and are used by the program', () => {
  assert.equal(one('sub', [10, 4]), 6);
  assert.deepEqual(ev('exch', [1, 2], 2), [2, 1]);
});

test('comments are stripped', () => {
  assert.equal(one('% a comment\n 3 4 add % trailing\n'), 7);
});

// ── /Range is mandatory and clips ────────────────────────────────────────────
test('outputs are clipped to /Range, and a missing Range refuses the compile', () => {
  assert.deepEqual(ev('pop 5', [0], 1, [0, 1]), [1]);
  assert.deepEqual(ev('pop -5', [0], 1, [0, 1]), [0]);
  assert.equal(compilePostScriptCalculator('{1}', 1, []), null);
  assert.equal(compilePostScriptCalculator('{1}', 1, [0]), null, 'odd-length Range');
  assert.equal(compilePostScriptCalculator('{1}', 1, [0, NaN]), null);
});

test('three outputs come back in order (the RGB case)', () => {
  const fn = compilePostScriptCalculator('{ pop 0.1 0.2 0.3 }', 1, [0, 1, 0, 1, 0, 1]);
  assert.ok(fn);
  assert.deepEqual(fn!([0]), [0.1, 0.2, 0.3]);
});

test('a two-input program (the function-based shading case) reads both', () => {
  // f(u,v) = (u, v, u*v) — the shape a hue/chroma field takes.
  const fn = compilePostScriptCalculator('{ 2 copy mul 3 1 roll 2 copy pop exch pop exch 3 -1 roll }', 2, [0, 1, 0, 1, 0, 1]);
  assert.ok(fn, 'compiles');
  const out = fn!([0.5, 0.25]);
  assert.ok(out && out.length === 3, JSON.stringify(out));
});

// ── faults degrade to null, never to a wrong colour ──────────────────────────
test('undefined results fault instead of yielding Infinity/NaN', () => {
  assert.equal(one('1 0 div'), null);
  assert.equal(one('-1 sqrt'), null);
  assert.equal(one('0 ln'), null);
  assert.equal(one('-1 log'), null);
  assert.equal(one('0 0 atan'), null);
  assert.equal(one('1e300 1e300 mul'), null, 'overflow to Infinity is a fault');
});

test('a program that leaves too few values on the stack faults', () => {
  assert.equal(one('pop'), null);
  assert.deepEqual(ev('pop 1', [0], 2), null);
});

// ── compile-time refusals ────────────────────────────────────────────────────
test('malformed programs are refused at compile time', () => {
  assert.equal(compilePostScriptCalculator('', 1, WIDE), null);
  assert.equal(compilePostScriptCalculator('3 4 add', 1, WIDE), null, 'no outer braces');
  assert.equal(compilePostScriptCalculator('{3 4 add', 1, WIDE), null, 'unbalanced open');
  assert.equal(compilePostScriptCalculator('{3 4 add}}', 1, WIDE), null, 'trailing brace');
  assert.equal(compilePostScriptCalculator('{} {}', 1, WIDE), null, 'trailing tokens');
  assert.equal(compilePostScriptCalculator('{3 4 frobnicate}', 1, WIDE), null, 'unknown operator');
  assert.equal(compilePostScriptCalculator('{16#FF}', 1, WIDE), null, 'radix numbers are not Type 4');
  assert.equal(compilePostScriptCalculator('{1}', 0, WIDE), null, 'zero inputs');
});

test('nesting deeper than the cap is refused rather than blowing the stack', () => {
  const deep = '{'.repeat(10_000) + '1' + '}'.repeat(10_000);
  assert.doesNotThrow(() => compilePostScriptCalculator(deep, 1, WIDE));
  assert.equal(compilePostScriptCalculator(deep, 1, WIDE), null);
});

test('a megabyte of garbage is refused without throwing', () => {
  const junk = 'x9$ '.repeat(250_000);          // ~1 MB
  assert.doesNotThrow(() => compilePostScriptCalculator(junk, 1, WIDE));
  assert.equal(compilePostScriptCalculator(junk, 1, WIDE), null);
  const bracedJunk = '{' + junk + '}';
  assert.equal(compilePostScriptCalculator(bracedJunk, 1, WIDE), null);
});

test('a huge but well-formed token stream is bounded by the token budget', () => {
  const many = '{' + '1 pop '.repeat(200_000) + '2}';
  assert.doesNotThrow(() => compilePostScriptCalculator(many, 1, WIDE));
  assert.equal(compilePostScriptCalculator(many, 1, WIDE), null, 'over MAX_TOKENS');
});

test('the per-evaluation step budget bounds a legal but enormous program', () => {
  // Well under the token cap, well over the 10k step budget.
  const fn = compilePostScriptCalculator('{' + '1 pop '.repeat(20_000) + '2}', 1, WIDE);
  assert.ok(fn, 'compiles');
  assert.equal(fn!([0]), null, 'evaluation is abandoned, not run to completion');
});

// ── fuzz: nothing throws, nothing hangs, output is finite or null ────────────
test('fuzz: random token soup never throws and never returns a non-finite value', () => {
  const vocab = [
    '{', '}', 'add', 'sub', 'mul', 'div', 'idiv', 'mod', 'neg', 'abs', 'sqrt', 'exp',
    'ln', 'log', 'sin', 'cos', 'atan', 'ceiling', 'floor', 'round', 'truncate', 'cvi', 'cvr',
    'and', 'or', 'xor', 'not', 'bitshift', 'eq', 'ne', 'ge', 'gt', 'le', 'lt', 'true', 'false',
    'if', 'ifelse', 'copy', 'dup', 'exch', 'index', 'pop', 'roll',
    '0', '1', '2', '-1', '0.5', '1e6', '1000000', '%c', '(', ')', '[', ']', 'zzz',
  ];
  // Deterministic PRNG so a failure is reproducible.
  let seed = 0x2f6e2b1;
  const rnd = (): number => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

  for (let i = 0; i < 10_000; i++) {
    const n = 1 + Math.floor(rnd() * 24);
    let src = '';
    for (let k = 0; k < n; k++) src += vocab[Math.floor(rnd() * vocab.length)] + ' ';
    let out: number[] | null = null;
    assert.doesNotThrow(() => {
      const fn = compilePostScriptCalculator(src, 2, [0, 1, 0, 1, 0, 1]);
      out = fn ? fn([rnd(), rnd()]) : null;
    }, `threw on: ${src}`);
    if (out) {
      const vals = out as number[];
      assert.equal(vals.length, 3, `wrong arity for: ${src}`);
      for (const v of vals) {
        assert.ok(isFinite(v), `non-finite output for: ${src}`);
        assert.ok(v >= 0 && v <= 1, `unclipped output ${v} for: ${src}`);
      }
    }
  }
});

test('fuzz: adversarial well-formed programs stay bounded', () => {
  const nasty = [
    '{1 0 div}', '{-1 sqrt}', '{0 ln}', '{1e308 1e308 mul}',
    '{100 100 roll}', '{-5 index}', '{2147483647 31 bitshift}',
    '{ { { { 1 } if } if } if }', '{true {1} {2} ifelse}',
    '{' + 'dup '.repeat(500) + '}',                 // stack overflow attempt
    '{' + '1 '.repeat(500) + '}',                   // stack overflow attempt
    '{' + '{1}'.repeat(200) + '}',                  // many procedures on the stack
  ];
  for (const src of nasty) {
    assert.doesNotThrow(() => {
      const fn = compilePostScriptCalculator(src, 1, [0, 1]);
      const out = fn ? fn([0.5]) : null;
      if (out) for (const v of out) assert.ok(isFinite(v), src);
    }, src);
  }
});
