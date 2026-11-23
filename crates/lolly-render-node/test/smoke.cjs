// SPDX-License-Identifier: MPL-2.0
// The built binding on this machine, through the package's own loader (index.cjs):
// every fixture of the core crate draws to the PNG bytes pinned in
// crates/lolly-render/tests/render.rs, the thread-pool form gives the same bytes, and
// a refusal comes back as a value with its stable code. Run after copying the built
// library beside index.cjs as lolly-render.<platform>.node:
//
//   node crates/lolly-render-node/test/smoke.cjs
'use strict';

const assert = require('node:assert/strict');
const { readFileSync, readdirSync } = require('node:fs');
const { join } = require('node:path');

const here = join(__dirname, '..');
const core = join(here, '..', 'lolly-render');
const binding = require(join(here, 'index.cjs'));

/** FNV-1a over 64 bits, as tests/render.rs pins the bytes. */
function fnv1a(bytes) {
  let h = 0xcbf29ce484222325n;
  for (const b of bytes) h = BigInt.asUintN(64, (h ^ BigInt(b)) * 0x100000001b3n);
  return h;
}

const pinned = new Map([...readFileSync(join(core, 'tests', 'render.rs'), 'utf8').matchAll(/\("([a-z]+)", 0x([0-9a-f]{16})\)/g)].map((m) => [m[1], BigInt(`0x${m[2]}`)]));
const fixtures = readdirSync(join(core, 'tests', 'fixtures')).filter((f) => f.endsWith('.json'));
assert.ok(fixtures.length >= 8 && pinned.size === fixtures.length, `${fixtures.length} fixtures, ${pinned.size} pins`);

async function main() {
  assert.match(binding.renderer(), /^lolly-render-\d+\.\d+\.\d+\+tiny-skia-/);
  assert.ok(binding.refusalCodes().includes('internal'));
  for (const file of fixtures) {
    const name = file.replace(/\.json$/, '');
    const input = readFileSync(join(core, 'tests', 'fixtures', file));
    const drawn = binding.renderPng(input);
    assert.equal(drawn.ok, true, `${name}: ${drawn.code} ${drawn.detail}`);
    assert.equal(fnv1a(drawn.png), pinned.get(name), `${name}: not the pinned bytes`);
    const later = await binding.renderPngAsync(input.toString('utf8'));
    assert.equal(Buffer.compare(later.png, drawn.png), 0, `${name}: the thread pool drew other bytes`);
    const pixels = binding.renderRgba(input);
    assert.equal(pixels.rgba.length, pixels.width * pixels.height * 4, name);
    const encoded = binding.encodePng(pixels.rgba, pixels.width, pixels.height);
    assert.equal(encoded.ok, true, name);
    assert.ok(!encoded.png.includes('pHYs'), `${name}: the encoder writes no resolution`);
  }
  const refused = await binding.renderPngAsync('{"format":"lolly-render-input","version":2}');
  assert.equal(refused.ok, false);
  assert.equal(typeof refused.code, 'string');
  assert.ok(refused.refusals.length >= 1);
  const tooLarge = binding.renderPng(Buffer.alloc(64 * 1024 * 1024 + 1, 0x20));
  assert.equal(tooLarge.code, 'input-bytes');
  // Only an argument of the wrong type throws; every page, drawn or not, is a value.
  assert.throws(() => binding.renderPng(42), /none of these types/);
  console.log(`lolly-render binding: ${fixtures.length} fixtures drew their pinned bytes on ${process.platform}-${process.arch} (${binding.renderer()})`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
