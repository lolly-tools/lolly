// SPDX-License-Identifier: MPL-2.0
/**
 * The `lolly-render` crate (plan 371, M3b) against the engine: its input envelope
 * carries the engine's current drawing operations, and, where the crate is built, its
 * binary draws engine pages the same bytes twice and refuses what it does not draw by
 * name. A shell reaches the crate only through its Node binding, behind
 * LOLLY_DESIGN_RASTER=lolly-render (tests/lolly-render-addon.test.ts).
 *
 * A plain clone has no Rust toolchain, so the binary tests skip by name with the
 * command that builds the binary. The fixture check needs no Rust and always runs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DESIGN_DRAW_VERSION } from '../engine/src/design-draw.ts';
import { designPageDrawing } from '../engine/src/design-page-svg.ts';
import { repoRoot } from '../packages/node-shell/src/repo-root.ts';
import { createNodeTextAPI, nodeStrikeMetrics } from '../packages/node-shell/src/text.ts';
import { createNodeTextShaper } from '../packages/node-shell/src/text-measure.ts';
import { fidelityPages, fidelityPictures } from './helpers/design-fidelity.ts';

const ROOT = repoRoot();
const CRATE = join(ROOT, 'crates', 'lolly-render');
const BIN = [process.env.LOLLY_RENDER_BIN, join(CRATE, 'target', 'release', 'lolly-render'), join(CRATE, 'target', 'debug', 'lolly-render')]
  .find((path): path is string => !!path && existsSync(path));
const NOT_BUILT = 'lolly-render is not built here: run `cargo build --release` in crates/lolly-render (or set LOLLY_RENDER_BIN)';

test('the crate\'s fixtures are lolly-render inputs of the engine\'s drawing version', () => {
  const dir = join(CRATE, 'tests', 'fixtures');
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  assert.ok(files.length >= 5, 'the crate keeps its engine-made fixtures');
  for (const file of files) {
    const input = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    assert.equal(input.format, 'lolly-render-input', file);
    assert.equal(input.version, 1, file);
    assert.equal(input.drawVersion, DESIGN_DRAW_VERSION, `${file}: a new drawing version needs new fixtures and a new crate reading`);
    assert.equal(input.page.version, DESIGN_DRAW_VERSION, file);
  }
});

/** One fidelity page compiled by the engine, as the operations route compiles it, in the crate's envelope. */
async function input(name: string, keep: (row: Record<string, unknown>) => boolean = () => true): Promise<Buffer> {
  const page = fidelityPages().find((p) => p.name === name)!;
  const pictures = fidelityPictures();
  const rows = page.rows.filter(keep).map((row) => (typeof row.image === 'string' && pictures[row.image] ? { ...row, image: pictures[row.image]!.url } : row));
  const text = createNodeTextAPI({ repoRoot: ROOT });
  const drawing = await designPageDrawing({ boxes: rows }, page.name, {
    shaper: createNodeTextShaper({ repoRoot: ROOT }),
    toPath: (o) => text.toPath(o),
    strikeMetrics: (url, variations) => nodeStrikeMetrics(url, variations, ROOT),
    picture: async (ref) => (ref.startsWith('data:') ? { bytes: new Uint8Array(Buffer.from(ref.slice(ref.indexOf(',') + 1), 'base64')) } : null),
  }, { dpi: 96 });
  const resources = [...drawing.pictures].map(([ref, p]) => ({ ref, type: p.mime, data: Buffer.from(p.bytes).toString('base64') }));
  return Buffer.from(JSON.stringify({ format: 'lolly-render-input', version: 1, drawVersion: DESIGN_DRAW_VERSION, output: { width: drawing.frame.width, height: drawing.frame.height, dpi: 96 }, page: drawing.page, resources }));
}

const run = (bytes: Buffer) => spawnSync(BIN!, ['-', '-'], { input: bytes, maxBuffer: 64 << 20 });

test('lolly-render draws engine pages, the same bytes twice', { skip: BIN ? false : NOT_BUILT }, async () => {
  const pages: Array<[string, Buffer]> = [];
  for (const name of ['shapes', 'paths', 'dashes', 'text', 'strikes', 'underlines']) pages.push([name, await input(name)]);
  // The pictures page with its PNG pictures and without its vector one.
  pages.push(['pictures', await input('pictures', (row) => row.id !== 'vector')]);
  for (const [name, bytes] of pages) {
    const first = run(bytes), second = run(bytes);
    assert.equal(first.status, 0, `${name}: ${first.stdout?.toString()}`);
    assert.ok(Buffer.compare(first.stdout, second.stdout) === 0, `${name}: the same input gave different bytes`);
    assert.equal(first.stdout.subarray(1, 4).toString('latin1'), 'PNG', name);
  }
});

test('lolly-render refuses a page it does not draw, by name, and writes nothing', { skip: BIN ? false : NOT_BUILT }, async () => {
  // A vector picture is resvg's to draw, so the whole page is refused.
  const out = run(await input('pictures'));
  assert.equal(out.status, 3);
  const report = JSON.parse(out.stdout.toString());
  assert.equal(report.drawn, false);
  assert.ok(report.refusals.some((r: { code: string }) => r.code === 'picture-vector'), JSON.stringify(report.refusals));
});
