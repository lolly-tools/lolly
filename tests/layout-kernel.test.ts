// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import type { LayoutRequest } from '../engine/src/design-layout.ts';
import { createLayoutKernel } from '../packages/node-shell/src/layout-kernel.ts';

const root = new URL('../packages/node-shell/wasm/layout-kernel/', import.meta.url);
const bytes = new Uint8Array(await readFile(new URL('layout-kernel.wasm', root)));
const solve = await createLayoutKernel(bytes);
const corpus = JSON.parse(await readFile(new URL('fixtures/modern-layout.json', root), 'utf8')) as {
  revision: string;
  cases: {
    name: string;
    request: LayoutRequest;
    expected: { bounds?: number[][]; columns?: number[][]; rows?: number[][]; error?: string };
  }[];
};
const request = () => structuredClone(corpus.cases[0]!.request);
const grid = () => structuredClone(corpus.cases.find((c) => c.name === 'grid-fixed')!.request);

test('modern native extraction goldens reproduce exactly in WASM with owned results', () => {
  for (const row of corpus.cases) {
    const original = structuredClone(row.request);
    if (row.expected.error) {
      assert.throws(() => solve(row.request), { message: row.expected.error }, row.name);
      assert.deepEqual(
        solve(request()),
        corpus.cases[0]!.expected,
        `${row.name}: refusal recovers`
      );
    } else {
      const result = solve(row.request);
      assert.deepEqual(result, row.expected, row.name);
      result.bounds[0]![0] = -123456;
      assert.deepEqual(
        solve(row.request),
        row.expected,
        `${row.name}: caller mutations do not change the kernel`
      );
    }
    assert.deepEqual(row.request, original, `${row.name}: authored geometry is immutable`);
  }
});

test('independent axis-aligned anchors and grid track extents follow source geometry', () => {
  const flex = solve(request());
  assert.deepEqual(flex.bounds[1], [20, 30, 40, 30, 40, 40, 20, 40]);
  assert.deepEqual(flex.bounds[2], [45, 30, 75, 30, 75, 50, 45, 50]);
  const result = solve(grid()) as { bounds: number[][]; columns: number[][]; rows: number[][] };
  assert.deepEqual(result.bounds[1], [20, 30, 40, 30, 40, 40, 20, 40]);
  assert.deepEqual(result.bounds[2], [95, 85, 115, 85, 115, 95, 95, 95]);
  assert.deepEqual(result.columns, [
    [20, 20, 90, 20, 70],
    [95, 20, 195, 20, 100],
  ]);
  assert.deepEqual(result.rows, [
    [10, 30, 10, 80, 50],
    [10, 85, 10, 115, 30],
  ]);
});

test('rotated grid fill occupies parent-axis cell extents including margins', () => {
  const row = corpus.cases.find((c) => c.name === 'grid-rotated-child-fill')!;
  const result = solve(row.request);
  const axis = (offset: number) => {
    const [x0, y0] = row.request.bounds;
    const x = row.request.bounds[offset]! - x0!;
    const y = row.request.bounds[offset + 1]! - y0!;
    const n = Math.hypot(x, y);
    return [x / n, y / n];
  };
  const width = (offset: number) => {
    const a = axis(offset);
    const corners = result.bounds[1]!;
    const projections = [0, 2, 4, 6].map((i) => corners[i]! * a[0]! + corners[i + 1]! * a[1]!);
    return Math.max(...projections) - Math.min(...projections);
  };
  assert.ok(Math.abs(width(2) - 58) < 0.0001, '70 px track minus 8 + 4 px horizontal margins');
  assert.ok(Math.abs(width(6) - 42) < 0.0001, '50 px track minus 2 + 6 px vertical margins');
});

test('malformed numbers, enums, object keys and aggregate work refuse then recover', () => {
  const invalid: LayoutRequest[] = [];
  for (const value of [NaN, Infinity, -Infinity, 1e8]) {
    const row = request();
    row.bounds[0] = value;
    invalid.push(row);
  }
  const negativeGap = request();
  negativeGap.gap[0] = -1;
  invalid.push(negativeGap);
  const mode = request();
  mode.mode = 'css';
  invalid.push(mode);
  const sizing = request();
  sizing.items[0]!.sizing[0] = 'min-content';
  invalid.push(sizing);
  const limits = request();
  limits.items[0]!.min[0] = 50;
  limits.items[0]!.max[0] = 20;
  invalid.push(limits);
  const cell = grid();
  cell.items[0]!.cell = [0, 1, 1, 1];
  invalid.push(cell);
  const tracks = grid();
  tracks.columns = Array(1025).fill({ kind: 'auto', value: 0 });
  invalid.push(tracks);
  const cells = grid();
  cells.columns = Array(1024).fill({ kind: 'auto', value: 0 });
  cells.rows = cells.columns;
  invalid.push(cells);
  const span = grid();
  span.columns = Array(256).fill({ kind: 'auto', value: 0 });
  span.rows = span.columns;
  span.items = Array(513).fill({ ...span.items[0], cell: [1, 1, 256, 256] });
  invalid.push(span);
  const layers = request();
  layers.items = Array(20001).fill(layers.items[0]);
  invalid.push(layers);
  invalid.push({ ...request(), extra: 'unknown key' } as LayoutRequest);
  for (const row of invalid) {
    assert.throws(() => solve(row));
    assert.deepEqual(
      solve(request()),
      corpus.cases[0]!.expected,
      'the same instance recovers after refusal'
    );
  }
});

test('raw WASM ABI checks exact allocation ownership and bounded linear memory', async () => {
  const module = await WebAssembly.compile(bytes);
  assert.deepEqual(WebAssembly.Module.imports(module), []);
  const api = new WebAssembly.Instance(module, {}).exports as unknown as {
    memory: WebAssembly.Memory;
    layout_alloc(length: number): number;
    layout_free(pointer: number, length: number): void;
    layout_solve(pointer: number, length: number): number;
    layout_output_len(): number;
  };
  assert.equal(api.layout_alloc(0), 0);
  assert.equal(api.layout_alloc(8 * 1024 * 1024 + 1), 0);
  const pointer = api.layout_alloc(2);
  assert.ok(pointer);
  assert.equal(api.layout_alloc(2), 0, 'only one operation input is admitted');
  api.layout_free(pointer, 1);
  assert.equal(api.layout_alloc(2), 0, 'wrong byte count cannot release the buffer');
  const output = api.layout_solve(pointer + 1, 1);
  const response = JSON.parse(
    new TextDecoder().decode(new Uint8Array(api.memory.buffer, output, api.layout_output_len()))
  );
  assert.match(response.error, /owned buffer/);
  api.layout_free(pointer, 2);
  api.layout_free(pointer, 2);
  const next = api.layout_alloc(2);
  assert.ok(next);
  api.layout_free(next, 2);
  assert.throws(
    () => api.memory.grow(512),
    RangeError,
    '32 MiB configured maximum includes existing pages'
  );
});

test('newer upstream algorithms retain their pinned source apart from documented safety guards', async () => {
  const manifest = JSON.parse(await readFile(new URL('upstream.json', root), 'utf8'));
  assert.equal(corpus.revision, manifest.revision);
  assert.equal(manifest.revision, '10955f17e27943429a10e90360d0404e3f56e27c');
  for (const file of manifest.files.filter((f: { source: string }) =>
    /(?:layouts|flex_layout|grid_layout|constraints)\.rs$/.test(f.source)
  )) {
    const source = await readFile(new URL(file.destination, root), 'utf8');
    const original = source
      .split('\n')
      .slice(3)
      .filter(
        (line) =>
          !line.includes('// Lolly admission:') &&
          !/let before_(space|count|dist|auto) =/.test(line) &&
          !line.includes('crate::work::checkpoint(')
      )
      .join('\n');
    const hash = createHash('sha256').update(original).digest('hex');
    assert.equal(hash, file.upstreamSha256, file.source);
  }
});
