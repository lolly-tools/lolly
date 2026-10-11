// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DesignHierarchyRefusal, designHierarchySeeds, invokeDesignHierarchy, hierarchyInvariant } from './fuzz/design-hierarchy-target.ts';
import { designHierarchyTarget, TARGETS_BY_NAME } from './fuzz/targets.ts';
import { mutate } from './fuzz/mutate.ts';
import { mulberry32 } from './fuzz/prng.ts';
test('hierarchy output failures propagate as fuzz findings', () => {
  assert.throws(()=>hierarchyInvariant(false,'broken'),WebAssembly.RuntimeError);
  assert.throws(()=>invokeDesignHierarchy(new TextEncoder().encode('{')),DesignHierarchyRefusal);
});
test('writer-derived hierarchy seeds admit without a DOM and preserve stable identities', async () => {
  assert.equal(typeof document,'undefined'); assert.equal(TARGETS_BY_NAME['design-hierarchy'],designHierarchyTarget);
  for(const seed of await designHierarchySeeds()) await designHierarchyTarget.invoke(seed);
});
test('seeded graph mutations only accept declared validation refusals', async () => {
  const seeds=await designHierarchySeeds(), rng=mulberry32(0x305);
  for(let n=0;n<300;n++) try { invokeDesignHierarchy(mutate(seeds[rng.int(seeds.length)]!,rng)); }
  catch(error) { if (!(error instanceof DesignHierarchyRefusal)) throw error; }
});
