// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { slideLayoutRecipe } from '../engine/src/slide-layout-components.ts';
import { readFileSync } from 'node:fs';
import { auditLayoutOption, compileLayoutOption, layoutOptionCatalog, layoutOptionOrder, layoutOptionQuery, recommendLayoutOptions } from '../engine/src/rebrand-layout-options.ts';
import { compileRenovated, compileSystemOpts } from '../engine/src/deck-compile.ts';
import { previewPlanOf } from '../shells/web/src/lib/rebrand/controller-preview.ts';
import { runRebrandPipeline, STARTER_DESIGN_SYSTEM } from './helpers/rebrand-pipeline.ts';

const run = await runRebrandPipeline('structures.pptx', new Uint8Array(readFileSync(new URL('./fixtures/rebrand/structures.pptx', import.meta.url))));
const one = (index = 0) => ({
  source: { ...run.deck, slides: [run.deck.slides[index]!] },
  plan: previewPlanOf({ ...run.plan, slides: [run.plan.slides[index]!] }),
  census: run.census,
  system: STARTER_DESIGN_SYSTEM,
});

test('recommendations compile only a single slide, never mutate the plan and only return supplied layouts', async () => {
  const input = one();
  const before = JSON.stringify(input);
  const progress: number[] = [];
  const result = await recommendLayoutOptions(input, done => { progress.push(done); });
  assert.ok(result.options.length > 0);
  assert.ok(result.options.length <= 3);
  assert.ok(result.checked <= 16);
  assert.ok(result.options.every(option => option.frameCount === result.options[0]!.frameCount));
  assert.equal(JSON.stringify(input), before);
  for (const option of result.options) {
    assert.deepEqual(option.issues, []);
    assert.ok(slideLayoutRecipe(option.id) || input.system.input.master.archetypes.some(a => a.id === option.id));
    assert.ok(option.frames.every(f => f.sourceSlideId === input.source.slides[0]!.id));
  }
  assert.equal(progress.at(-1), result.checked);
  assert.throws(() => layoutOptionOrder({ ...input, source: run.deck }), /one matching source slide/);
});

test('the audit rejects missing words even when the lineage still points at an existing layer', () => {
  const input = one();
  const deck = compileRenovated({ source: input.source, plan: input.plan, census: input.census,
    master: input.system.input.master, designSystem: input.system.compile,
    opts: { ...compileSystemOpts(input.system.input), applyUnreviewed: true, applyNeedsAttention: true } });
  for (const frame of deck.frames) for (const layer of frame.layers) if (layer.kind === 'text') layer.text = '';
  assert.ok(auditLayoutOption(deck, input.plan.slides[0]!, input.source.slides[0]).issues.includes('missing-content'));
});

test('corrected text is used for matching and compilation; removed text is never sent to the model', () => {
  const base = one();
  const input = { ...base, source: structuredClone(base.source), plan: structuredClone(base.plan) };
  const source = input.source.slides[0]!;
  const text = source.objects.find(o => o.kind === 'text')!;
  const row = input.plan.slides[0]!.objects.find(o => o.id === text.id)!;
  row.decision = 'keep'; row.textOverride = 'Corrected OCR 123 123';
  assert.ok(layoutOptionQuery(input.source, input.plan).includes(row.textOverride));
  const compiled = compileLayoutOption(input, input.plan.slides[0]!.layout);
  assert.ok(compiled.frames.some(f => f.layers.some(l => String(l.text ?? '').includes('Corrected OCR'))));
  row.decision = 'remove';
  assert.equal(layoutOptionQuery(input.source, input.plan).includes('Corrected OCR'), false);
});

test('scores cannot invent a layout or bypass fit checks', async () => {
  const input = one(1);
  const semantic = Object.fromEntries(layoutOptionCatalog(input.system.input.master).map(c => [c.id, c.id === 'title' ? 1 : 0]));
  semantic['invented-layout'] = 10;
  semantic.content = Number.NaN;
  const result = await recommendLayoutOptions({ ...input, semantic });
  assert.ok(result.options.every(o => o.id !== 'invented-layout' && o.issues.length === 0));
  assert.throws(() => compileLayoutOption(input, 'invented-layout'), /does not offer/);
  const only = await recommendLayoutOptions({ ...input, allowed: ['content'], semantic, adaptive: false });
  assert.ok(only.options.every(o => o.id === 'content'));
  assert.ok(only.checked <= 1);
});

test('a flattened picture needs a reading before offering editable layouts', async () => {
  const base = one();
  const input = { ...base, source: structuredClone(base.source), plan: structuredClone(base.plan) };
  input.source.slides[0]!.origin.flattened = true;
  delete input.source.slides[0]!.recovery;
  const result = await recommendLayoutOptions(input);
  assert.equal(result.checked, 0);
  assert.deepEqual(result.options, []);
  assert.deepEqual(result.rejected[0]?.issues, ['unread-picture']);
});

test('cancellation stops between candidates and never returns a partial success', async () => {
  const input = one();
  let checkpoints = 0;
  await assert.rejects(recommendLayoutOptions(input, () => { if (++checkpoints === 2) throw new Error('cancelled'); }), /cancelled/);
  assert.equal(checkpoints, 2);
});

test('unsafe compile reports remain disqualifying', () => {
  const input = one();
  const deck = compileRenovated({ source: input.source, plan: input.plan, census: input.census,
    master: input.system.input.master, designSystem: input.system.compile, opts: { applyUnreviewed: true, applyNeedsAttention: true } });
  for (const [code, issue] of [['text.overflow', 'overflow'], ['vector.items-omitted', 'omitted-vector'], ['object.unresolved', 'unresolved']] as const) {
    const changed = structuredClone(deck);
    changed.report.entries.push({ code, message: 'test', slideId: input.plan.slides[0]!.id });
    assert.ok(auditLayoutOption(changed, input.plan.slides[0]!).issues.includes(issue));
  }
});

test('a clear structural match precedes semantic taste among equally compact choices', async () => {
  const input = { ...one(), adaptive: false };
  const first = await recommendLayoutOptions(input);
  const held = first.options[0]!;
  const structure = input.system.input.master.archetypes.find(a => a.id === held.id)!.structure ?? held.id;
  const plan = structuredClone(input.plan);
  plan.slides[0]!.layoutMatch = { structure, band: 'clear', confidence: 1, coverage: 1, signature: 'test' };
  const semantic = Object.fromEntries(layoutOptionCatalog(input.system.input.master).map(c => [c.id, c.id === held.id ? 0 : 1]));
  const next = await recommendLayoutOptions({ ...input, plan, semantic });
  assert.equal(next.options[0]?.id, held.id);
});
