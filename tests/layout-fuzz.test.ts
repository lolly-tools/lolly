// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  invokeLayoutAbi,
  layoutAbiSeeds,
  invokePenpotLayout,
  invokePenpotLayoutEvaluation,
  penpotLayoutSeeds,
  readLayoutAbiOutput,
} from './fuzz/layout-targets.ts';

test('ABI output invariant violations are findings while explicit refusals remain controlled errors', () => {
  const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
  for (const output of [
    null,
    [],
    { error: true },
    { bounds: [[0, 0]] },
    { bounds: [Array(8).fill(null)] },
    { bounds: [], columns: [[0]] },
  ])
    assert.throws(() => readLayoutAbiOutput(bytes(output)), WebAssembly.RuntimeError);
  assert.throws(() => readLayoutAbiOutput(Uint8Array.of(0xff)), WebAssembly.RuntimeError);
  assert.throws(
    () => readLayoutAbiOutput(bytes({ error: 'Invalid layout dimensions.' })),
    (error) =>
      error instanceof Error &&
      !(error instanceof WebAssembly.RuntimeError) &&
      error.message === 'Invalid layout dimensions.'
  );
});

test('raw ABI mutation seeds reach modern flex/grid geometry and recover after malformed byte refusals', async () => {
  const seeds = await layoutAbiSeeds();
  assert.equal(seeds.length, 8);
  const corpus = JSON.parse(
    await readFile(
      new URL(
        '../packages/node-shell/wasm/layout-kernel/fixtures/modern-layout.json',
        import.meta.url
      ),
      'utf8'
    )
  ) as {
    cases: Array<{ request: unknown; expected: unknown }>;
  };
  for (const seed of seeds) {
    const request = new TextDecoder().decode(seed);
    const expected = corpus.cases.find((row) => JSON.stringify(row.request) === request)!.expected;
    assert.deepEqual(await invokeLayoutAbi(seed), expected);
  }
  for (const input of [
    new Uint8Array(),
    Uint8Array.of(0xff),
    seeds[0]!.slice(0, -1),
    new TextEncoder().encode('{"unknown":true}'),
  ]) {
    await assert.rejects(
      () => invokeLayoutAbi(input),
      (error) => {
        assert.ok(error instanceof Error && !(error instanceof WebAssembly.RuntimeError));
        return true;
      }
    );
    assert.deepEqual(await invokeLayoutAbi(seeds[0]!), corpus.cases[0]!.expected);
  }
});

test('native Penpot mutation seeds retain owner, fill and grid span intent; malformed tracks refuse', async () => {
  const seeds = await penpotLayoutSeeds();
  assert.equal(seeds.length, 2);
  for (const seed of seeds) {
    await invokePenpotLayoutEvaluation(seed);
    const result = invokePenpotLayout(seed);
    const container = result.boxes.find((row) => row.layout === 'flex' || row.layout === 'grid')!;
    const flow = result.boxes.find(
      (row) => row.layoutOwner === container.id && !row.layoutAbsolute
    )!;
    assert.equal(flow.layoutW, 'fill');
    assert.ok(
      result.boxes.some((row) => row.layoutOwner === container.id && row.layoutAbsolute === true)
    );
    if (container.layout === 'grid') {
      assert.equal(flow.layoutColumnSpan, 2);
      assert.deepEqual(
        result.tracks.map((row) => row.track),
        ['1fr', '80px', 'auto']
      );
    }
  }
  const source = JSON.parse(new TextDecoder().decode(seeds[1]!)) as {
    shapes: Record<string, Record<string, unknown>>;
  };
  const grid = Object.values(source.shapes).find((row) => row.layout === 'grid')!;
  (grid.layoutGridColumns as Array<Record<string, unknown>>)[0]!.type = 'minmax';
  assert.throws(
    () => invokePenpotLayout(new TextEncoder().encode(JSON.stringify(source))),
    /Unsupported Penpot track type/
  );
  assert.throws(() => invokePenpotLayout(Uint8Array.of(0xff)));
});
