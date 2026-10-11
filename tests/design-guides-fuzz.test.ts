// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_DESIGN_GUIDE_RECORDS,
  guideSnapTargets,
  parseGuideRecords,
  serializeGuideRecords,
} from '../shells/web/src/views/design-guides.ts';
import {
  assertDesignGuideOutput,
  designGuideSeeds,
  invokeDesignGuides,
} from './fuzz/design-guides-target.ts';
import { mutate } from './fuzz/mutate.ts';
import { mulberry32 } from './fuzz/prng.ts';
import { designGuidesTarget, TARGETS_BY_NAME } from './fuzz/targets.ts';

const bytes = (wire: string) => new TextEncoder().encode(wire);

test('guide fuzz output invariant violations are recorded findings', () => {
  const valid = { id: 'guide', x: 0, y: 0, rotation: 90, color: '', snap: true };
  for (const guides of [
    [{ ...valid, x: Infinity }],
    [{ ...valid, y: NaN }],
    [{ ...valid, rotation: Infinity }],
    [{ ...valid, id: 'x'.repeat(81) }],
    [valid, valid],
  ])
    assert.throws(
      () => assertDesignGuideOutput(guides, { x: [], y: [] }),
      WebAssembly.RuntimeError
    );
  assert.throws(
    () => assertDesignGuideOutput([valid], { x: [Infinity], y: [] }),
    WebAssembly.RuntimeError
  );
  assert.throws(
    () =>
      assertDesignGuideOutput([valid], { x: [], y: [], angled: [{ x: 0, y: NaN, rotation: 45 }] }),
    WebAssembly.RuntimeError
  );
});

test('writer-derived guide seeds preserve finite geometry and stable identities without DOM', async () => {
  assert.equal(typeof document, 'undefined');
  assert.equal(TARGETS_BY_NAME['design-guides'], designGuidesTarget);
  const seeds = await designGuideSeeds();
  assert.equal(seeds.length, 8);
  for (const seed of seeds) await designGuidesTarget.invoke(seed);
  const records = parseGuideRecords(new TextDecoder().decode(seeds[5]!));
  assert.equal(records[0]!.id.length, 80);
  assert.equal(records[0]!.x, 1e308);
  assert.equal(records[0]!.y, -1e308);
  assert.equal(records[1]!.x, -Number.MAX_VALUE);
  assert.equal(records[1]!.y, Number.MAX_VALUE);
  assert.ok(!serializeGuideRecords(records).includes('null'));
  assert.deepEqual(guideSnapTargets(records).x, [1e308]);
  const mixed = parseGuideRecords(new TextDecoder().decode(seeds[3]!));
  assert.equal(mixed[3]!.snap, false);
  assert.equal(guideSnapTargets(mixed).angled!.length, 1);
});

test('guide mutation target retains uncapped v1 and the v2 first-1000-row admission rule', async () => {
  assert.equal(MAX_DESIGN_GUIDE_RECORDS, 1000);
  const seeds = await designGuideSeeds();
  const legacy = parseGuideRecords(new TextDecoder().decode(seeds[6]!));
  assert.equal(legacy.length, 1005);
  assert.equal(legacy.at(-1)!.id, 'x1004');
  assert.equal(parseGuideRecords(serializeGuideRecords(legacy)).length, 1000);
  assert.equal(parseGuideRecords(new TextDecoder().decode(seeds[7]!)).length, 1000);
  const late =
    '2|' +
    JSON.stringify([
      ...Array.from({ length: 1000 }, () => null),
      ['beyond-prefix', 10, 20, 90, '', true],
    ]);
  assert.deepEqual(parseGuideRecords(late), []);
  invokeDesignGuides(bytes(late));
});

test('guide codec mutation target tolerates malformed wires and validates every returned projection', () => {
  for (const wire of [
    '2|[',
    '2|{}',
    '{"x":[null,"Infinity",{},1e309],"y":["3.25"]}',
    '1|x=NaN,Infinity,-Infinity,1e309,1e308;y=-1e308',
    '2|' +
      JSON.stringify([
        ['kept', 10, 20, 90, '#123', true],
        ['kept', 99, 20, 90, '#456', true],
        ['x'.repeat(81), 10, 20, 90, '', true],
        ['bad-number', '10', 20, 90, '', true],
        ['bad-finite', null, 20, 90, '', true],
      ]),
  ])
    invokeDesignGuides(bytes(wire));
  invokeDesignGuides(Uint8Array.of(0xff, 0xfe));
});

test('guide seeded mutations propagate every error instead of accepting invariant failures', async () => {
  const seeds = await designGuidesTarget.seeds();
  const rng = mulberry32(
    0x1abe11ed ^
      [...designGuidesTarget.name].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) | 0, 0)
  );
  for (let iteration = 0; iteration < 300; iteration++) {
    await designGuidesTarget.invoke(mutate(seeds[rng.int(seeds.length)]!, rng));
  }
});
