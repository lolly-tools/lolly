// SPDX-License-Identifier: MPL-2.0
/**
 * Plan 275 decision 30 in Design: Apply layout and Reset slide move whatever a frame
 * holds into the new layout's boxes, pictures included. `applyArchetype` matches a
 * role-bound layer to its own role's slot first; a layer that holds words or a
 * picture and has no slot of its role left takes the next free box in reading order
 * (a picture the largest free content box first, words the best-ranked box and
 * never a full-bleed picture box); content still without a box shares the largest
 * box that holds content, so nothing overlaps. Words in a box drawn for something
 * else take an ink that reads on the ground under it, on both design systems.
 *
 * Run with: node --test tests/slide-master-any-content.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { contrastRatio } from '../engine/src/brand-derive.ts';
import { applyArchetype, archetypeSlots, masterBoxToPx, resetFrame, seedFrame } from '../engine/src/slide-master.ts';
import { resolveProfileDesignSystem } from '../packages/node-shell/src/rebrand/index.ts';
import type { DesignBoxRowV1 } from '../packages/core/src/rebrand-v1.ts';
import type { ArchetypeV1, SlideMasterFileV1, SlideMasterV1 } from '../packages/core/src/slide-master-v1.ts';

const master = (JSON.parse(readFileSync(new URL('../brands/lolly-start/catalog/assets/lolly/slides/masters.json', import.meta.url), 'utf8')) as SlideMasterFileV1)
  .masters[0] as SlideMasterV1;

const tokens = (path: string): string | undefined => (path === 'color.semantic.text' ? '#11141f' : path === 'color.semantic.surface' ? '#ffffff' : undefined);

/** A seeded frame of one archetype with its role slots filled. */
function filled(archetype: string, fill: Record<string, string>): DesignBoxRowV1[] {
  const seeded = seedFrame(master, archetype, { frameId: 'f', x: 0, y: 0, resolveToken: tokens });
  assert.ok(seeded, `the master carries ${archetype}`);
  return seeded.layers.map((row) => {
    const value = fill[String(row.id)];
    if (value === undefined) return row;
    return row.kind === 'image' ? { ...row, image: value } : { ...row, text: value };
  });
}

/** Where the target archetype's placeholder of this role and ordinal sits, in px. */
function boxOf(archetype: string, role: string, ordinal = 0): { x: number; y: number; w: number; h: number } {
  const ph = master.archetypes.find((a) => a.id === archetype)?.placeholders.filter((p) => p.role === role)[ordinal];
  assert.ok(ph, `${archetype} has a ${role} slot`);
  return masterBoxToPx(master, ph.box);
}

const geometry = (row: DesignBoxRowV1 | undefined): { x: unknown; y: unknown; w: unknown; h: unknown } =>
  ({ x: row?.x, y: row?.y, w: row?.w, h: row?.h });

test('a picture moves into a free text box of the new layout, fitted whole', () => {
  const layers = filled('split', { 'f.visual': 'user/media/photo', 'f.title': 'Heading', 'f.body': 'Some words' });
  const out = applyArchetype(master, 'split', 'two-column', layers, { resolveToken: tokens });
  const picture = out.find((row) => row.id === 'f.visual');
  assert.equal(picture?.kind, 'image', 'a picture stays a picture');
  assert.equal(picture?.role, 'visual', 'and keeps its own role');
  assert.deepEqual(geometry(picture), boxOf('two-column', 'body', 1), 'in the second body box, the one the words left free');
  assert.equal(picture?.fit, 'contain');
  assert.deepEqual(geometry(out.find((row) => row.id === 'f.body')), boxOf('two-column', 'body', 0));

  // Reset slide on the new layout keeps it there: the same rule, the same answer.
  const reset = resetFrame(master, 'two-column', out, { resolveToken: tokens });
  assert.deepEqual(geometry(reset.find((row) => row.id === 'f.visual')), boxOf('two-column', 'body', 1));
});

test('words move into a free picture box, shaped to it in the body type', () => {
  const layers = filled('two-column', { 'f.title': 'Heading', 'f.body': 'Left words', 'f.body-2': 'Right words' });
  const out = applyArchetype(master, 'two-column', 'split', layers, { resolveToken: tokens });
  const moved = out.find((row) => row.id === 'f.body-2');
  assert.equal(moved?.kind, 'text');
  assert.equal(moved?.text, 'Right words');
  assert.deepEqual(geometry(moved), boxOf('split', 'visual'), 'the second column takes the picture box');
  assert.equal(moved?.fontSize, master.archetypes.find((a) => a.id === 'split')?.placeholders.find((p) => p.role === 'body')?.style?.fontSize ?? master.typeScale.body);
});

test('content with no box of its own shares the largest content box, with nothing overlapping', () => {
  const layers = filled('split', { 'f.visual': 'user/media/photo', 'f.title': 'Heading', 'f.body': 'Some words' });
  const out = applyArchetype(master, 'split', 'content', layers, { resolveToken: tokens });
  const body = boxOf('content', 'body');
  const words = out.find((row) => row.id === 'f.body');
  const picture = out.find((row) => row.id === 'f.visual');
  assert.equal(picture?.image, 'user/media/photo', 'the picture is kept');
  assert.equal(picture?.fit, 'contain');
  for (const row of [words, picture]) assert.ok(inside(row, body), `${String(row?.id)} sits inside the body box`);
  assert.equal(overlap(words, picture), 0, 'the words and the picture share the box without overlapping');
  const slots = archetypeSlots(master, 'split', 'content', layers, { resolveToken: tokens });
  assert.deepEqual(slots?.shared.map((i) => layers[i]?.id), ['f.visual']);
  assert.deepEqual(slots?.unplaced, []);
  assert.equal(slots?.slotKeys[layers.findIndex((row) => row.id === 'f.body')], 'body#1');

  // Reset slide gives the same answer.
  const reset = resetFrame(master, 'content', out, { resolveToken: tokens });
  assert.deepEqual(geometry(reset.find((row) => row.id === 'f.visual')), geometry(picture));

  // An empty picture slot on the source slide does not claim a box a text needs.
  const empty = filled('two-column', { 'f.title': 'Heading', 'f.body': 'Left words', 'f.body-2': 'Right words' });
  const intoVisual = applyArchetype(master, 'two-column', 'visual', empty, { resolveToken: tokens });
  assert.ok(inside(intoVisual.find((row) => row.id === 'f.body'), boxOf('visual', 'visual')), 'the first column takes the only content box');
});

test('a title never takes a full-bleed picture box while a caption box is there, and words never sit over the whole slide', () => {
  const layers = filled('two-column', { 'f.title': 'Heading', 'f.body': 'Left words', 'f.body-2': 'Right words' });
  const out = applyArchetype(master, 'two-column', 'full-image', layers, { resolveToken: tokens });
  const caption = boxOf('full-image', 'caption');
  const texts = ['f.title', 'f.body', 'f.body-2'].map((id) => out.find((row) => row.id === id));
  for (const row of texts) assert.ok(inside(row, caption), `${String(row?.id)} sits in the caption box, not over the picture box`);
  for (let i = 0; i < texts.length; i += 1) for (let j = i + 1; j < texts.length; j += 1) assert.equal(overlap(texts[i], texts[j]), 0);
  const slots = archetypeSlots(master, 'two-column', 'full-image', layers, { resolveToken: tokens });
  assert.equal(slots?.slotKeys[layers.findIndex((row) => row.id === 'f.title')], 'caption#1');
  assert.equal(slots?.slotKeys[layers.findIndex((row) => row.id === 'f.visual')] ?? null, null);
});

test('a caller rebuilding the frame reads which slot each moved layer fills', () => {
  const layers = filled('two-column', { 'f.title': 'Heading', 'f.body': 'Left words', 'f.body-2': 'Right words' });
  const slots = archetypeSlots(master, 'two-column', 'split', layers, { resolveToken: tokens });
  assert.equal(slots?.slotKeys[layers.findIndex((row) => row.id === 'f.body-2')], 'visual#1', 'the second column fills the picture box');
  assert.deepEqual(slots?.shared, []);
  assert.deepEqual(slots?.unplaced, []);
  const back = archetypeSlots(master, 'split', 'two-column', filled('split', { 'f.visual': 'user/media/photo', 'f.title': 'Heading', 'f.body': 'Words' }), { resolveToken: tokens });
  assert.ok(back?.slotKeys.includes('body#2'), 'the picture fills the second column');
});

/** Is the row's box inside `box`? */
function inside(row: DesignBoxRowV1 | undefined, box: { x: number; y: number; w: number; h: number }): boolean {
  const g = geometry(row) as { x: number; y: number; w: number; h: number };
  return g.x >= box.x && g.y >= box.y && g.x + g.w <= box.x + box.w && g.y + g.h <= box.y + box.h;
}

/** The area two rows share, in px squared. */
function overlap(a: DesignBoxRowV1 | undefined, b: DesignBoxRowV1 | undefined): number {
  const p = geometry(a) as { x: number; y: number; w: number; h: number };
  const q = geometry(b) as { x: number; y: number; w: number; h: number };
  const w = Math.min(p.x + p.w, q.x + q.w) - Math.max(p.x, q.x);
  const h = Math.min(p.y + p.h, q.y + q.h) - Math.max(p.y, q.y);
  return w > 0 && h > 0 ? w * h : 0;
}

const PACKS = [
  { pack: 'lolly-start', path: '../brands/lolly-start/catalog/assets/lolly/slides/masters.json' },
  { pack: 'suse', path: '../brands/suse/catalog/assets/suse/slides/masters.json' },
].filter((p) => existsSync(fileURLToPath(new URL(p.path, import.meta.url))));

for (const { pack } of PACKS) {
  test(`${pack}: words moved into a box of another role or a picture box read on the ground under it`, async () => {
    const resolved = await resolveProfileDesignSystem({ profile: pack, root: fileURLToPath(new URL('..', import.meta.url)) });
    assert.ok(resolved && resolved.profile === pack, `the ${pack} profile resolves in this checkout`);
    const { master: m, colors } = resolved.system.input;
    const resolve = (path: string): string | undefined => colors[path];
    const failures: string[] = [];
    let checked = 0;
    for (const from of m.archetypes) {
      const seeded = seedFrame(m, from.id, { frameId: 'f', x: 0, y: 0, resolveToken: resolve });
      if (!seeded) continue;
      const layers = seeded.layers.map((row) => (row.furniture ? row : row.kind === 'image' ? { ...row, image: 'user/media/photo' } : { ...row, text: 'Words' }));
      for (const to of m.archetypes) {
        if (to.id === from.id) continue;
        const out = applyArchetype(m, from.id, to.id, layers, { x: 0, y: 0, resolveToken: resolve });
        const slots = archetypeSlots(m, from.id, to.id, layers, { x: 0, y: 0, resolveToken: resolve });
        out.forEach((row, i) => {
          if (row.kind !== 'text' || !row.role || row.furniture) return;
          const key = slots?.slotKeys[i];
          const moved = (key && !key.startsWith(`${String(row.role)}#`)) || slots?.shared.includes(i);
          if (!moved) return;
          const fg = String(row.fg ?? '');
          const box = { x: Number(row.x) / m.size.width, y: Number(row.y) / m.size.height, w: Number(row.w) / m.size.width, h: Number(row.h) / m.size.height };
          const ground = groundOf(m, to, box, resolve);
          const px = Number(row.fontSize ?? 0);
          const minimum = px >= 24 || (String(row.weight) === '700' && px >= 18.66) ? 3 : 4.5;
          checked += 1;
          const ratio = contrastRatio(fg, ground);
          if (!(ratio >= minimum)) failures.push(`${from.id} to ${to.id}: ${String(row.id)} ${fg} on ${ground} is ${ratio.toFixed(2)}:1`);
        });
      }
    }
    assert.ok(checked > 20, `${checked} moved texts were checked`);
    assert.deepEqual(failures, []);
  });
}

/** The ground under a box: the archetype ground with each shown rectangle that covers half of it painted over, in order. */
function groundOf(m: SlideMasterV1, a: ArchetypeV1, box: { x: number; y: number; w: number; h: number }, resolve: (p: string) => string | undefined): string {
  const colour = (hex?: string, path?: string): string | undefined => hex ?? (path ? resolve(path) : undefined);
  let ground = mix(colour(a.background?.hex, a.background?.tokenPath) ?? '#ffffff', '#ffffff');
  const shown = (a.furniture ?? []).map((id) => m.furniture.find((f) => f.id === id)).filter((f) => f !== undefined);
  for (const f of [...shown.filter((f) => f.kind === 'rect'), ...shown.filter((f) => f.kind !== 'rect')]) {
    if (f.kind !== 'rect' && f.kind !== 'bar') continue;
    const fill = colour(f.hex, f.tokenPath);
    const w = Math.min(box.x + box.w, f.box.x + f.box.w) - Math.max(box.x, f.box.x);
    const h = Math.min(box.y + box.h, f.box.y + f.box.h) - Math.max(box.y, f.box.y);
    if (fill && w > 0 && h > 0 && (w * h) / (box.w * box.h) >= 0.5) ground = mix(fill, ground);
  }
  return ground;
}

/** `#rrggbbaa` over an opaque colour. */
function mix(top: string, under: string): string {
  const t = top.replace('#', '');
  const u = under.replace('#', '');
  if (t.length !== 8) return `#${t.slice(0, 6).toLowerCase()}`;
  const alpha = Number.parseInt(t.slice(6, 8), 16) / 255;
  const ch = (i: number): string => Math.round(Number.parseInt(t.slice(i, i + 2), 16) * alpha + Number.parseInt(u.slice(i, i + 2), 16) * (1 - alpha)).toString(16).padStart(2, '0');
  return `#${ch(0)}${ch(2)}${ch(4)}`;
}

test('Design accepts every layout id a master may carry on a frame, and only ids of that form', async () => {
  const { validateDocument, documentSchema } = await import('../engine/src/document-api.ts');
  const manifest = JSON.parse(readFileSync(new URL('../community/design/tool.json', import.meta.url), 'utf8'));
  const errors = (archetype: string): unknown[] =>
    validateDocument({ kind: 'inputs', manifest, value: { boxes: [{ kind: 'frame', archetype }] } } as never).errors;
  for (const id of ['', 'content', 'columns-3', 'numbered-rows', ...master.archetypes.map((a) => a.id)]) assert.deepEqual(errors(id), [], `${id || 'empty'} is accepted`);
  for (const id of ['Columns-3', 'a', '3-columns', 'columns 3']) assert.equal(errors(id).length, 1, `${id} is refused`);
  const schema = JSON.stringify(documentSchema(manifest as never));
  assert.doesNotMatch(schema, /"archetype":\{[^}]*"enum"/, 'the published schema lists no closed set of archetypes');
});
