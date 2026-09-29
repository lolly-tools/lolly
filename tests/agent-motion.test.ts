// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { validateDocument } from '../engine/src/document-api.ts';
import { buildInputModel } from '../engine/src/inputs.ts';
import { parseUrlState, serializeUrlState } from '../engine/src/url-mode.ts';
import { parseKf, evaluateKf } from '../engine/src/keyframes.ts';
import { inspectDesignV1 } from '../packages/core/src/design-v1.ts';
import { parseSequenceStage, sequenceDrawPlan } from '../shells/web/src/bridge/sequence-plan.ts';
import { baseHost } from './helpers/host.ts';

interface MotionRecipe {
  toolId: string;
  seconds: number;
  fps: number;
  inputs: { boxes: Array<Record<string, unknown>>; [key: string]: unknown };
}

const root = new URL('../skills/lolly/examples/motion/', import.meta.url);
const tool = await loadTool('design', path => readFile(new URL(`../community/${path}`, import.meta.url), 'utf8'));
const recipes: Record<string, MotionRecipe> = {};
for (const file of (await readdir(root)).filter(name => name.endsWith('.json')).sort()) {
  recipes[file] = JSON.parse(await readFile(new URL(file, root), 'utf8')) as MotionRecipe;
}

for (const [name, recipe] of Object.entries(recipes)) {
  test(`${name}: real Design inputs, keyframes and editable links remain valid`, () => {
    assert.equal(recipe.toolId, 'design');
    const checked = validateDocument({ kind: 'inputs', manifest: tool.manifest, value: recipe.inputs });
    assert.deepEqual(checked.errors, []);
    const inspected = inspectDesignV1(recipe.inputs.boxes);
    assert.deepEqual(inspected.findings, []);
    assert.equal(inspected.summary.duration, recipe.seconds);
    for (const box of recipe.inputs.boxes) {
      if (!box.kf) continue;
      const warnings: string[] = [];
      const track = parseKf(box.kf, { onWarn: message => warnings.push(message) });
      assert.deepEqual(warnings, [], String(box.id));
      assert.ok(track.length >= 2, `${String(box.id)} has real motion keys`);
    }
    const query = serializeUrlState(buildInputModel(tool.manifest, { initial: recipe.inputs as never }));
    const reopened = parseUrlState(query, tool.manifest).values.boxes as Array<Record<string, unknown>>;
    assert.deepEqual(reopened.map(box => box.id), recipe.inputs.boxes.map(box => box.id));
    for (const box of recipe.inputs.boxes) {
      const next = reopened.find(item => item.id === box.id)!;
      for (const key of ['start', 'dur', 'kf', 'text', 'frame']) {
        if (box[key] !== undefined) assert.equal(String(next[key]), String(box[key]), `${String(box.id)}.${key}`);
      }
    }
  });

  test(`${name}: mounted sequence has visible copy through every output frame`, async () => {
    const runtime = await createRuntime(tool, baseHost(), recipe.inputs as never);
    try {
      assert.deepEqual(runtime.hookErrors, []);
      const dom = new JSDOM(runtime.getHydrated());
      try {
        const stage = parseSequenceStage(dom.window.document.body);
        assert.ok(stage);
        assert.equal(stage.totalMs, recipe.seconds * 1000);
        const textIds = new Set(recipe.inputs.boxes.filter(box => box.kind === 'text').map(box => box.id));
        for (let frame = 0; frame < recipe.seconds * recipe.fps; frame++) {
          const at = frame * 1000 / recipe.fps;
          const plan = sequenceDrawPlan(stage.layers, at, stage.totalMs);
          assert.ok(plan.some(item => item.alpha > 0 && textIds.has(item.layer.el.dataset.boxId)), `no copy at ${at}ms`);
        }
      } finally {
        dom.window.close();
      }
    } finally {
      runtime.destroy();
    }
  });
}

test('product demonstration selection reaches the second row with its matching copy', () => {
  const box = recipes['product-demo.json']!.inputs.boxes.find(row => row.id === 'selection')!;
  const track = parseKf(box.kf);
  assert.equal(evaluateKf(track, 1000).y, 0);
  assert.equal(evaluateKf(track, 6000).y, 210);
});

test('quiet explainer keeps both five-second reading holds free of animation and audio', () => {
  const boxes = recipes['quiet-explainer.json']!.inputs.boxes;
  assert.ok(boxes.every(box => box.kind !== 'audio' && !box.kf && !box.hold && !box.split));
  const text = boxes.filter(box => box.kind === 'text');
  assert.deepEqual(text.map(box => [box.start, box.dur, box.enter, box.exit]), [
    [0, 5, 'none', 'none'], [5, 5, 'none', 'none'],
  ]);
});
