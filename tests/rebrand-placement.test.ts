// SPDX-License-Identifier: MPL-2.0
/**
 * What a person sees on a renovated slide (plan 274 sections 3.3, 3.4 and 9,
 * "Content accounting" and "Layout"), over both slide masters a renovation meets
 * and the three committed pptx fixtures.
 *
 *   - Every text layer on every compiled frame reads against the ground it sits
 *     on: 4.5 to 1, or 3 to 1 for large text. The ground is worked out here from
 *     the frame's own rows, not from the compile's answer, so the two can be
 *     compared.
 *   - In the preview (every proposal applied, the flagged ones too), nothing
 *     waits in the tray, every title the source states is on its slide, and no
 *     title or body slot is left empty while its slide had text that went
 *     elsewhere.
 *
 * The SUSE master is exercised when brands/suse is on this machine; a public
 * clone checks the starter master alone and says so in a diagnostic.
 *
 * Run with: node --test "tests/rebrand-placement.test.ts"
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { contrastRatio } from '../engine/src/brand-derive.ts';
import { compileRenovated, FOOTER_GLYPH_EM } from '../engine/src/deck-compile.ts';
import type { CompiledDeckV1, DesignBoxRowV1 } from '../packages/core/src/index.ts';
import { readFixture } from './helpers/rebrand-fixtures.ts';
import { profileDesignSystem, runRebrandPipeline, STARTER_DESIGN_SYSTEM, type RebrandRunV1 } from './helpers/rebrand-pipeline.ts';

const FIXTURES = ['simple.pptx', 'adversarial.pptx', 'palette.pptx'] as const;

const SUSE = await profileDesignSystem('suse');
const SYSTEMS = [
  { name: 'lolly-start', system: STARTER_DESIGN_SYSTEM },
  ...(SUSE ? [{ name: 'suse', system: SUSE }] : []),
];

const MODES = [
  { name: 'preview', applyUnreviewed: true, applyNeedsAttention: true },
  { name: 'first pass', applyUnreviewed: false, applyNeedsAttention: false },
] as const;

const runs = new Map<string, Promise<RebrandRunV1>>();

function runOf(system: (typeof SYSTEMS)[number], fixture: (typeof FIXTURES)[number], mode: (typeof MODES)[number]): Promise<RebrandRunV1> {
  const key = `${system.name}:${fixture}:${mode.name}`;
  let run = runs.get(key);
  if (!run) {
    run = runRebrandPipeline(fixture, readFixture(fixture), {
      system: system.system,
      applyUnreviewed: mode.applyUnreviewed,
      applyNeedsAttention: mode.applyNeedsAttention,
    });
    runs.set(key, run);
  }
  return run;
}

// ─── the ground under one layer, read independently of the compile ──────────

const str = (row: DesignBoxRowV1, key: string): string => (typeof row[key] === 'string' ? String(row[key]) : '');
const num = (row: DesignBoxRowV1, key: string): number => {
  const value = Number(row[key]);
  return Number.isFinite(value) ? value : 0;
};

function over(top: string, under: string): string {
  const t = top.replace('#', '');
  if (t.length !== 8) return `#${t.slice(0, 6)}`;
  const alpha = Number.parseInt(t.slice(6, 8), 16) / 255;
  const u = under.replace('#', '');
  const channel = (at: number): string => Math.round(
    Number.parseInt(t.slice(at, at + 2), 16) * alpha + Number.parseInt(u.slice(at, at + 2), 16) * (1 - alpha),
  ).toString(16).padStart(2, '0');
  return `#${channel(0)}${channel(2)}${channel(4)}`;
}

/** Samples across a row, per axis, when the grounds under it are read. */
const SAMPLES_X = 40;
const SAMPLES_Y = 4;
/** A ground under fewer than this share of the samples is a rounding sliver. */
const SLIVER = 0.05;

/**
 * Every colour under a row, read by sampling points across its box: at each
 * point the frame fill, then each plain box painted before the row that covers
 * the point, in paint order. A row across a panel's edge has two. Null when a
 * picture lies under a share of the samples that counts.
 */
function groundsOf(layers: readonly DesignBoxRowV1[], index: number): string[] | null {
  const frame = layers[0];
  const row = layers[index];
  if (!frame || !row) return null;
  const base = str(frame, 'bg').slice(0, 7);
  if (!/^#[0-9a-fA-F]{6}$/.test(base)) return null;
  const counts = new Map<string, number>();
  for (let i = 0; i < SAMPLES_X; i += 1) {
    for (let j = 0; j < SAMPLES_Y; j += 1) {
      const px = num(row, 'x') + ((i + 0.5) / SAMPLES_X) * num(row, 'w');
      const py = num(row, 'y') + ((j + 0.5) / SAMPLES_Y) * num(row, 'h');
      let ground: string | null = base;
      for (let k = 1; k < index; k += 1) {
        const under = layers[k];
        if (!under) continue;
        if (px < num(under, 'x') || px > num(under, 'x') + num(under, 'w') || py < num(under, 'y') || py > num(under, 'y') + num(under, 'h')) continue;
        if (str(under, 'kind') === 'image' && str(under, 'image')) ground = null;
        else if (str(under, 'kind') === 'box' && /^#[0-9a-fA-F]{6}/.test(str(under, 'bg'))) ground = ground ? over(str(under, 'bg'), ground) : null;
      }
      const key = ground ?? '';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const total = SAMPLES_X * SAMPLES_Y;
  const counted = [...counts].filter(([, n]) => n / total >= SLIVER).map(([key]) => key);
  return counted.includes('') ? null : counted;
}

function isLarge(row: DesignBoxRowV1): boolean {
  const size = num(row, 'fontSize');
  return size >= 24 || (num(row, 'weight') >= 700 && size >= 18.66);
}

function textLayers(compiled: CompiledDeckV1): Array<{ frame: string; row: DesignBoxRowV1; grounds: string[] | null }> {
  const out: Array<{ frame: string; row: DesignBoxRowV1; grounds: string[] | null }> = [];
  for (const frame of compiled.frames) {
    frame.layers.forEach((row, index) => {
      if (str(row, 'kind') === 'text') out.push({ frame: frame.id, row, grounds: groundsOf(frame.layers, index) });
    });
  }
  return out;
}

// ─── contrast ────────────────────────────────────────────────────────────────

test('every text layer on every compiled frame reads against every ground under it, on both masters and all three fixtures', async (t) => {
  if (!SUSE) t.diagnostic('brands/suse is not on this machine, so only the starter master is checked');
  let checked = 0;
  let straddling = 0;
  for (const system of SYSTEMS) {
    for (const fixture of FIXTURES) {
      for (const mode of MODES) {
        const run = await runOf(system, fixture, mode);
        // A row the master lays across two grounds that no ink of the design
        // system reads on both keeps the master's ink, and the report names the
        // master slot once per layout: the compile does not pick a side, so the
        // master has to move the row.
        const slotOf = (layerId: string): string => {
          for (const frame of run.compiled.frames) {
            const row = frame.layers.find((layer) => layer.id === layerId);
            if (row) return `${frame.archetype}:${str(row, 'name')}`;
          }
          return '';
        };
        const named = new Set(run.compiled.report.entries
          .filter((e) => e.code === 'colour.contrast-below-minimum' && e.reason === 'no-ink-meets-every-ground')
          .map((e) => slotOf(String(e.layerId))));
        const archetypeOf = new Map(run.compiled.frames.map((frame) => [frame.id, frame.archetype]));
        for (const { frame, row, grounds } of textLayers(run.compiled)) {
          const fg = str(row, 'fg').slice(0, 7);
          if (!grounds || !/^#[0-9a-fA-F]{6}$/.test(fg)) continue;
          const floor = isLarge(row) ? 3 : 4.5;
          if (named.has(`${archetypeOf.get(frame) ?? ''}:${str(row, 'name')}`)) {
            assert.ok(grounds.length > 1, `${String(row.id)} is reported as crossing grounds and sits on one`);
            straddling += 1;
            continue;
          }
          for (const ground of grounds) {
            const ratio = contrastRatio(fg, ground);
            assert.ok(ratio >= floor,
              `${system.name} ${fixture} ${mode.name}: ${String(row.id)} on ${frame} is ${fg} on ${ground}, ${ratio.toFixed(2)} to 1, under ${floor}`);
          }
          checked += 1;
        }
      }
    }
  }
  if (straddling > 0) t.diagnostic(`${straddling} text layers cross two grounds the master should keep them off`);
  assert.ok(checked > 40, `only ${checked} text layers had a known ground, which is too few to say anything`);
});

// ─── nothing disappears ──────────────────────────────────────────────────────

test('in the preview nothing waits in the tray, and every source title is on its own slide', async () => {
  for (const system of SYSTEMS) {
    for (const fixture of FIXTURES) {
      const run = await runOf(system, fixture, MODES[0]);
      assert.deepEqual(run.compiled.tray.map((item) => item.sourceObjectId), [], `${system.name} ${fixture}: the tray is empty`);
      for (const slide of run.deck.slides) {
        const titles = run.plan.slides.find((one) => one.id === slide.id)?.objects.filter((row) => row.class === 'title') ?? [];
        const frame = run.compiled.frames.find((one) => one.sourceSlideId === slide.id && !one.continuation);
        assert.ok(frame, `${system.name} ${fixture}: ${slide.id} has a frame`);
        for (const row of titles) {
          const object = slide.objects.find((one) => one.id === row.id);
          const text = (object?.text?.paras ?? []).map((para) => para.runs.map((run) => run.text).join('')).join('\n').trim();
          assert.ok(frame.layers.some((layer) => str(layer, 'kind') === 'text' && str(layer, 'text').includes(text)),
            `${system.name} ${fixture}: the title "${text}" is not on ${frame.id}`);
        }
      }
    }
  }
});

test('no title or body slot is left empty while its slide had text that went elsewhere', async () => {
  for (const system of SYSTEMS) {
    for (const fixture of FIXTURES) {
      const run = await runOf(system, fixture, MODES[0]);
      const layerFrame = new Map<string, string>();
      for (const frame of run.compiled.frames) for (const row of frame.layers) layerFrame.set(String(row.id), frame.id);
      for (const frame of run.compiled.frames.filter((one) => !one.continuation)) {
        const slide = run.deck.slides.find((one) => one.id === frame.sourceSlideId);
        // Kept text of this slide that was placed on another frame than its own.
        const elsewhere = run.compiled.lineage.forward.filter((edge) => {
          const object = slide?.objects.find((one) => one.id === edge.sourceObjectId);
          if (object?.kind !== 'text') return false;
          return edge.layerIds.some((id) => layerFrame.get(id) !== frame.id);
        });
        if (elsewhere.length === 0) continue;
        for (const row of frame.layers) {
          const role = str(row, 'role');
          if ((role === 'title' || role === 'body') && str(row, 'kind') === 'text') {
            assert.notEqual(str(row, 'text'), '',
              `${system.name} ${fixture}: the ${role} slot of ${frame.id} is empty while ${elsewhere.map((e) => e.sourceObjectId).join(', ')} went elsewhere`);
          }
        }
      }
    }
  }
});

test('a continuation slide repeats the footer of the slide it continues, and the lineage says so', async () => {
  let seen = 0;
  for (const system of SYSTEMS) {
    for (const fixture of FIXTURES) {
      const run = await runOf(system, fixture, MODES[0]);
      for (const extra of run.compiled.frames.filter((one) => one.continuation)) {
        const own = run.compiled.frames.find((one) => one.sourceSlideId === extra.sourceSlideId && !one.continuation);
        const footerOf = (frame: typeof extra | undefined): DesignBoxRowV1 | undefined =>
          frame?.layers.find((row) => str(row, 'kind') === 'text' && frame.furnitureLayerIds.includes(String(row.id)) && str(row, 'furniture').includes('footer'));
        const ownFooter = footerOf(own);
        const repeat = footerOf(extra);
        if (!ownFooter || !str(ownFooter, 'text') || !repeat) continue;
        assert.equal(str(repeat, 'text'), str(ownFooter, 'text'), `${system.name} ${fixture}: ${extra.id} repeats the footer`);
        const from = (id: string): string[] => run.compiled.lineage.backward.find((edge) => edge.layerId === id)?.sourceObjectIds ?? [];
        assert.deepEqual(from(String(repeat.id)), from(String(ownFooter.id)), `${system.name} ${fixture}: the repeat names the same source lines`);
        seen += 1;
      }
    }
  }
  assert.ok(seen > 0, 'no fixture made a continuation under a footer, so this checked nothing');
});

test('a kept line joins the master footer only while the footer holds it on one line', async () => {
  for (const system of SYSTEMS) {
    for (const fixture of FIXTURES) {
      for (const mode of MODES) {
        const run = await runOf(system, fixture, mode);
        const footers = new Set<string>();
        for (const frame of run.compiled.frames) {
          for (const row of frame.layers) {
            if (frame.furnitureLayerIds.includes(String(row.id)) && str(row, 'furniture').includes('footer')) footers.add(String(row.id));
          }
        }
        const over = run.compiled.report.entries.filter((entry) => entry.code === 'text.overflow' && entry.layerId && footers.has(entry.layerId));
        assert.deepEqual(over.map((entry) => entry.layerId), [], `${system.name} ${fixture} ${mode.name}: a footer the compile filled overflows`);
        // One line, at the wide glyph reading: a wrap in a one-line box is a clip in Design.
        for (const frame of run.compiled.frames) {
          for (const row of frame.layers) {
            if (!footers.has(String(row.id)) || !str(row, 'text')) continue;
            assert.ok(str(row, 'text').length * num(row, 'fontSize') * FOOTER_GLYPH_EM <= num(row, 'w'),
              `${system.name} ${fixture} ${mode.name}: "${str(row, 'text')}" needs more than one line of ${String(row.id)}`);
          }
        }
      }
    }
  }
});

test('a renovated slide is named by its own title, never by a line the master repeats', async () => {
  const run = await runOf({ name: 'lolly-start', system: STARTER_DESIGN_SYSTEM }, 'adversarial.pptx', MODES[0]);
  const first = run.deck.slides[0]!;
  const inherited = first.objects.find((object) => object.origin === 'master' && object.kind === 'text');
  const titleRow = run.plan.slides.find((one) => one.id === first.id)?.objects.find((row) => row.class === 'title');
  assert.ok(inherited && titleRow, 'adversarial slide 1 has a master line and a title');
  // The master line first, and no title placeholder: the case where the first text would name the slide.
  const objects = [inherited, ...first.objects.filter((object) => object !== inherited)]
    .map((object) => (object.id === titleRow.id ? { ...object, placeholder: undefined } : object));
  const deck = { ...run.deck, slides: [{ ...first, objects }, ...run.deck.slides.slice(1)] };
  const compiled = compileRenovated({
    source: deck,
    census: run.census,
    plan: run.plan,
    master: STARTER_DESIGN_SYSTEM.input.master,
    designSystem: STARTER_DESIGN_SYSTEM.compile,
    opts: { applyUnreviewed: true, applyNeedsAttention: true },
  });
  const frame = compiled.frames.find((one) => one.sourceSlideId === first.id && !one.continuation);
  assert.equal(frame?.name, 'Quarterly review');
});

test('every compiled text row states no inset, so Design lays each line where the preview does', async () => {
  for (const system of SYSTEMS) {
    for (const fixture of FIXTURES) {
      const run = await runOf(system, fixture, MODES[0]);
      const rows = [...run.compiled.frames.flatMap((frame) => frame.layers), ...run.compiled.tray.map((item) => item.layer)];
      const inset = rows.filter((row) => str(row, 'kind') === 'text' && row.pad !== 0).map((row) => String(row.id));
      assert.deepEqual(inset, [], `${system.name} ${fixture}: text rows without pad 0`);
    }
  }
});
