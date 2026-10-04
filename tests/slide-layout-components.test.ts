// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { ObjectPlanV1, SourceObjectV1 } from '@lolly-tools/core';
import { slideContentGroups, slideLayoutChoices, slideLayoutRecipe, withSlideLayoutComponents } from '../engine/src/slide-layout-components.ts';
import { auditLayoutOption, recommendLayoutOptions } from '../engine/src/rebrand-layout-options.ts';
import { compileFaithful, compileRenovated, compileSystemOpts } from '../engine/src/deck-compile.ts';
import { seedFrame, resetFrame } from '../engine/src/slide-master.ts';
import { profileDesignSystem, runRebrandPipeline, STARTER_DESIGN_SYSTEM } from './helpers/rebrand-pipeline.ts';

const base = await runRebrandPipeline('structures.pptx', new Uint8Array(readFileSync(new URL('./fixtures/rebrand/structures.pptx', import.meta.url))));
function nineCards() {
  const source = structuredClone({ ...base.deck, slides: [base.deck.slides[0]!] });
  const plan = structuredClone({ ...base.plan, slides: [base.plan.slides[0]!] });
  const slide = source.slides[0]!;
  const text: SourceObjectV1 = { id: `${slide.id}.title`, fingerprint: 'heading', kind: 'text', origin: 'slide', fidelity: { state: 'editable' }, box: { rot: 0, x: 40, y: 20, w: 1100, h: 55 }, text: { paras: [{ runs: [{ text: 'Nine priorities for the next quarter', sizePt: 30 }] }] } };
  slide.width = 1280; slide.height = 720;
  slide.objects = [text];
  const titles = ['Understand needs', 'Define the offer', 'Build the team', 'Improve access', 'Support partners', 'Share the story', 'Measure progress', 'Reduce friction', 'Keep learning'];
  titles.forEach((title, i) => {
    const x = 45 + i % 3 * 405; const y = 130 + Math.floor(i / 3) * 170;
    slide.objects.push({ ...text, id: `${slide.id}.h${i}`, fingerprint: `h${i}`, box: { rot: 0, x, y, w: 370, h: 28 }, text: { paras: [{ runs: [{ text: title, sizePt: 19, bold: true }] }] } });
    slide.objects.push({ ...text, id: `${slide.id}.b${i}`, fingerprint: `b${i}`, box: { rot: 0, x, y: y + 34, w: 370, h: 100 }, text: { paras: ['Agree the next practical step', 'Review outcomes with the team'].map(line => ({ bullet: 'bullet' as const, runs: [{ text: line, sizePt: 15 }] })) } });
  });
  slide.readingOrder = slide.objects.map(o => o.id);
  plan.slides[0]!.objects = slide.objects.map((o, i): ObjectPlanV1 => ({ id: o.id, class: i ? 'body' : 'title', role: i ? 'body' : 'title', proposal: 'keep', decision: 'keep', review: 'accepted', evidence: [] }));
  delete plan.slides[0]!.arrangement;
  return { source, plan };
}

test('nine headings and their separate bullets stay together in content-sized layouts across brands', async () => {
  const { source, plan } = nineCards();
  assert.equal(slideContentGroups(source.slides[0]!.objects.slice(1)).length, 9);
  assert.ok(slideLayoutChoices(source.slides[0]!, plan.slides[0]!).includes('flow-cards-9-3'));
  const suse = await profileDesignSystem('suse');
  for (const system of [STARTER_DESIGN_SYSTEM, ...(suse ? [suse] : [])]) {
    const own = structuredClone(plan); own.designSystem = system.compile.snapshot;
    own.slides[0]!.layout = 'flow-cards-9-3';
    const compile = () => compileRenovated({ source, plan: own, master: system.input.master, designSystem: system.compile, opts: { ...compileSystemOpts(system.input), applyUnreviewed: true } });
    const deck = compile();
    assert.deepEqual(auditLayoutOption(deck, own.slides[0]!, source.slides[0]!).issues, [], system.input.id);
    assert.equal(deck.frames.length, 1);
    const frame = deck.frames[0]!;
    const forward = new Map(deck.lineage.forward.map(p => [p.sourceObjectId, p.layerIds]));
    for (let i = 0; i < 9; i++) {
      const head = frame.layers.find(l => forward.get(`${source.slides[0]!.id}.h${i}`)?.includes(String(l.id)))!;
      const body = frame.layers.find(l => forward.get(`${source.slides[0]!.id}.b${i}`)?.includes(String(l.id)))!;
      assert.equal(head.x, body.x);
      assert.ok(Number(head.y) < Number(body.y));
      assert.ok(Number(head.fontSize) > Number(body.fontSize));
    }
    assert.deepEqual(compile(), deck, 'saved recipe replays deterministically');
    const result = await recommendLayoutOptions({ source, plan: own, system });
    assert.ok(result.options.some(o => o.id === 'flow-cards-9-3' && o.frameCount === 1));
  }
});

test('recipes reject unbounded geometry and do not mutate the brand master', () => {
  for (const id of ['flow-cards-999-3', 'flow-cards-9-0', 'flow-cards-9-9', 'flow-cards-9-1', 'flow-cards-02-2']) {
    assert.equal(slideLayoutRecipe(id), undefined);
  }
  const master = STARTER_DESIGN_SYSTEM.input.master;
  const before = JSON.stringify(master);
  const expanded = withSlideLayoutComponents(master, ['flow-cards-9-3']);
  assert.ok(expanded.archetypes.some(a => a.id === 'flow-cards-9-3'));
  assert.equal(JSON.stringify(master), before);
  assert.equal(withSlideLayoutComponents(expanded, ['flow-cards-9-3']), expanded);
});

test('a component label takes the master\'s own label weight, so a Medium 500 master gets Medium labels', () => {
  const master = STARTER_DESIGN_SYSTEM.input.master;
  const labelsOf = (m: typeof master): Array<string | undefined> =>
    withSlideLayoutComponents(m, ['flow-cards-6-3']).archetypes.find(a => a.id === 'flow-cards-6-3')!.placeholders
      .filter(p => p.role === 'label').map(p => p.style?.weight);
  assert.deepEqual([...new Set(labelsOf(master))], ['700'], 'the starter master sets labels in 700');
  const medium = structuredClone(master);
  for (const a of medium.archetypes) for (const p of a.placeholders) if (p.role === 'label' && p.style) p.style.weight = '500';
  assert.deepEqual([...new Set(labelsOf(medium))], ['500']);
  const unweighted = structuredClone(master);
  for (const a of unweighted.archetypes) for (const p of a.placeholders) if (p.role === 'label' && p.style) delete p.style.weight;
  assert.deepEqual([...new Set(labelsOf(unweighted))], ['700'], 'a master with no weighted label falls back to 700');
});

test('a -dark id gives a content-sized layout its dark twin from content-dark; light ids expand as before', () => {
  const master = STARTER_DESIGN_SYSTEM.input.master;
  const lightOnly = withSlideLayoutComponents(master, ['flow-cards-4-2']);
  const plain = lightOnly.archetypes.find(a => a.id === 'flow-cards-4-2')!;
  assert.equal(plain.variants, undefined, 'a light id alone gets no twin');
  assert.equal(lightOnly.archetypes.some(a => a.id.endsWith('-dark') && a.id.startsWith('flow-')), false);

  const both = withSlideLayoutComponents(master, ['flow-cards-4-2', 'flow-cards-4-2-dark']);
  const light = both.archetypes.find(a => a.id === 'flow-cards-4-2')!;
  const dark = both.archetypes.find(a => a.id === 'flow-cards-4-2-dark')!;
  const { variants, ...rest } = light;
  assert.deepEqual(variants, { dark: 'flow-cards-4-2-dark' });
  assert.deepEqual(rest, plain, 'the light layout is the same with or without its twin');
  assert.equal(dark.variantOf, 'flow-cards-4-2');
  const contentDark = master.archetypes.find(a => a.id === 'content-dark')!;
  assert.deepEqual(dark.background, contentDark.background);
  assert.deepEqual(dark.furniture!.filter(id => !id.startsWith('flow-')), contentDark.furniture);
  assert.deepEqual(dark.placeholders.map(p => p.box), light.placeholders.map(p => p.box), 'the same geometry');
  const darkInk = contentDark.placeholders.find(p => p.role === 'body')!.style!.fgTokenPath;
  assert.deepEqual([...new Set(dark.placeholders.filter(p => p.role !== 'title').map(p => p.style?.fgTokenPath))], [darkInk]);
  assert.equal(dark.placeholders[0]!.style?.fgTokenPath, contentDark.placeholders.find(p => p.role === 'title')!.style!.fgTokenPath);
  // The twin's card rules are its own, in the dark body ink.
  const rules = both.furniture.filter(f => f.id.startsWith('flow-cards-4-2-dark-rule-'));
  assert.equal(rules.length, 4);
  for (const rule of rules) assert.equal(rule.tokenPath, darkInk);
  // A -dark id alone expands both; a master with no dark content slide has no twin to give.
  assert.ok(withSlideLayoutComponents(master, ['flow-cards-4-2-dark']).archetypes.some(a => a.id === 'flow-cards-4-2-dark'));
  const noDark = { ...master, archetypes: master.archetypes.filter(a => a.id !== 'content-dark').map(a => (a.id === 'content' ? { ...a, variants: undefined } : a)) };
  const lone = withSlideLayoutComponents(noDark, ['flow-cards-4-2', 'flow-cards-4-2-dark']);
  assert.equal(lone.archetypes.some(a => a.id === 'flow-cards-4-2-dark'), false);
  assert.equal(lone.archetypes.find(a => a.id === 'flow-cards-4-2')!.variants, undefined);
  // Seeding the twin by id works, which is what a composed frame and Tier A PowerPoint do.
  const seeded = seedFrame(master, 'flow-cards-4-2-dark', { frameId: 'f', x: 0, y: 0 });
  assert.equal(seeded?.frame.archetype, 'flow-cards-4-2-dark');
  assert.equal(seeded?.cells?.length, 4);
});

test('Design can seed and reset a generated layout while preserving authored content', () => {
  const master = STARTER_DESIGN_SYSTEM.input.master;
  const seeded = seedFrame(master, 'flow-cards-9-3', { frameId: 'f', x: 0, y: 0 });
  assert.equal(seeded?.cells?.length, 9);
  const body = seeded!.layers.find(l => l.role === 'body')!;
  const edited = seeded!.layers.map(l => l === body ? { ...l, x: Number(l.x) + 100, text: 'A person edited this' } : l);
  const reset = resetFrame(master, 'flow-cards-9-3', edited).find(l => l.id === body.id)!;
  assert.equal(reset.x, body.x);
  assert.equal(reset.text, 'A person edited this');
});

test('the Original keeps stored chart artwork even after labels have been recognised', () => {
  const { source } = nineCards();
  const object = source.slides[0]!.objects[0]!;
  source.slides[0]!.objects = [{ ...object, kind: 'vector', media: 'user/media/original-chart', text: undefined,
    vectorItems: { version: 1, viewBox: { x: 0, y: 0, w: 100, h: 100 }, items: [{ kind: 'text', text: 'OCR changed this', x: 5, y: 20, size: 12 }] } }];
  const original = compileFaithful(source, { originalArtwork: true });
  assert.ok(original.frames[0]!.layers.some(l => l.image === 'user/media/original-chart'));
  assert.equal(original.frames[0]!.layers.some(l => String(l.text).includes('OCR changed')), false);
  assert.ok(compileFaithful(source).frames[0]!.layers.some(l => String(l.text).includes('OCR changed')));
});
