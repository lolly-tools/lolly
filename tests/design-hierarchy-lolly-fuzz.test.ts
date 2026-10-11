// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { LollyHierarchyRefusal, lollyHierarchySeeds, invokeLollyHierarchy, lollyInvariant } from './fuzz/lolly-hierarchy-target.ts';
import { lollyHierarchyTarget, TARGETS_BY_NAME } from './fuzz/targets.ts';
import { mutate } from './fuzz/mutate.ts';
import { mulberry32 } from './fuzz/prng.ts';

test('.lolly hierarchy output failures remain discovery findings', async () => {
  assert.throws(() => lollyInvariant(false, 'broken'), WebAssembly.RuntimeError);
  await assert.rejects(invokeLollyHierarchy(new TextEncoder().encode('{')), LollyHierarchyRefusal);
});
test('real .lolly writer seeds preserve hierarchy and reject forged reader gates without a DOM', async () => {
  assert.equal(typeof document, 'undefined');
  assert.equal(TARGETS_BY_NAME['lolly-hierarchy'], lollyHierarchyTarget);
  for (const seed of await lollyHierarchySeeds()) await lollyHierarchyTarget.invoke(seed);
});
test('seeded .lolly mutations only accept declared transport and payload refusals', async () => {
  const seeds = await lollyHierarchySeeds(), rng = mulberry32(0x3057);
  for (let n = 0; n < 300; n++) {
    try { await invokeLollyHierarchy(mutate(seeds[rng.int(seeds.length)]!, rng)); }
    catch (error) { if (!(error instanceof LollyHierarchyRefusal)) throw error; }
  }
});
