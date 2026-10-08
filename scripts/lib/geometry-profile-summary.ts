// SPDX-License-Identifier: MPL-2.0
/** Weighted CPU samples with disjoint stage scopes and recursion-deduplicated inclusive frames. */
import assert from 'node:assert/strict';
import type { Profiler } from 'node:inspector';

function geometry(url: string): boolean {
  return /\/engine\/src\/(geom\/|geom-api\.ts$)/.test(url);
}
export function summarizeGeometryProfile(profile: Profiler.Profile) {
  const nodes = new Map(profile.nodes.map((node) => [node.id, node]));
  const parents = new Map<number, number>();
  for (const node of profile.nodes)
    for (const child of node.children ?? []) {
      assert.ok(!parents.has(child), 'Each CPU profile node must have one parent.');
      parents.set(child, node.id);
    }
  const groups: Record<string, number> = {
    fitting: 0,
    offsetVerification: 0,
    pairIntersection: 0,
    winding: 0,
    otherGeometry: 0,
    garbageCollection: 0,
    other: 0,
  };
  const self = new Map<string, number>(),
    inclusive = new Map<string, number>();
  const samples = profile.samples ?? [],
    deltas = profile.timeDeltas ?? [];
  assert.ok(samples.length > 0, 'A CPU profile must contain samples.');
  assert.equal(samples.length, deltas.length);
  let totalUs = 0;
  for (let i = 0; i < samples.length; i++) {
    const us = deltas[i]!;
    assert.ok(Number.isFinite(us) && us >= 0);
    const stack: Profiler.ProfileNode[] = [];
    const visited = new Set<number>();
    let id: number | undefined = samples[i];
    while (id !== undefined) {
      assert.ok(!visited.has(id), 'A CPU stack must not contain a parent cycle.');
      visited.add(id);
      const node = nodes.get(id);
      assert.ok(node, `Unknown CPU sample node ${id}.`);
      stack.push(node);
      id = parents.get(id);
    }
    const has = (file: string, name: string) =>
      stack.some(
        ({ callFrame: f }) =>
          f.url.endsWith(`/engine/src/geom/${file}.ts`) && f.functionName === name
      );
    const matched = [
      has('fit', 'fitToCubics') ? 'fitting' : null,
      has('offset-error', 'offsetError') || has('offset', 'offsetError')
        ? 'offsetVerification'
        : null,
      has('intersect', 'intersectCubics') ? 'pairIntersection' : null,
      has('ray-cast', 'castRay') ? 'winding' : null,
    ].filter((name): name is string => name !== null);
    assert.ok(matched.length <= 1, 'Stage scopes overlap; update the sample partition.');
    const group =
      matched[0] ??
      (stack[0]!.callFrame.functionName === '(garbage collector)'
        ? 'garbageCollection'
        : stack.some((node) => geometry(node.callFrame.url))
          ? 'otherGeometry'
          : 'other');
    groups[group]! += us;
    totalUs += us;
    const key = ({ callFrame: f }: Profiler.ProfileNode) =>
      `${f.functionName || '<anonymous>'} (${f.url.split('/').pop() || '<runtime>'}:${f.lineNumber + 1})`;
    const leaf = key(stack[0]!);
    self.set(leaf, (self.get(leaf) ?? 0) + us);
    const seen = new Set<string>();
    for (const node of stack) {
      if (!geometry(node.callFrame.url)) continue;
      const frame = key(node);
      if (seen.has(frame)) continue;
      seen.add(frame);
      inclusive.set(frame, (inclusive.get(frame) ?? 0) + us);
    }
  }
  assert.equal(
    Object.values(groups).reduce((a, b) => a + b, 0),
    totalUs
  );
  const row = (name: string, us: number) => ({
    name,
    sampledMs: us / 1000,
    percent: (us / totalUs) * 100,
  });
  const top = (values: Map<string, number>) =>
    [...values.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 25)
      .map(([name, us]) => row(name, us));
  return {
    samples: samples.length,
    totalSampledMs: totalUs / 1000,
    scopes: Object.entries(groups).map(([name, us]) => row(name, us)),
    self: top(self),
    inclusiveGeometry: top(inclusive),
    note: 'Stage scopes partition weighted samples without overlap. Inclusive frames overlap; each frame is counted once per stack despite recursion. Percentages include runtime and the profiling loop. They are not unprofiled latency or potential speedup.',
  };
}
