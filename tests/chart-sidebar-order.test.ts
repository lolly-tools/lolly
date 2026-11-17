// SPDX-License-Identifier: MPL-2.0
// Chart's sidebar order (Chart 1.31.0): the loose rows a person works through
// first, the type as a picker with every option in a group, and the section that
// belongs to the chosen type straight after the loose rows in every render mode.
// The order is computed the way the web sidebar computes it: the engine's input
// model and showIf, then the shell's band resolver over the visible sections.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildInputModel, matchesShowIf } from '../engine/src/inputs.ts';
import { BANDS, resolveBands } from '../shells/web/src/lib/section-bands.ts';

type Option = { value: string; label?: string; group?: string };
type Input = { id: string; type: string; section?: string; group?: string; display?: string; options?: Option[]; showIf?: never };
const manifest = JSON.parse(readFileSync(new URL('../community/chart/tool.json', import.meta.url), 'utf8')) as { inputs: Input[] };
const byId = new Map(manifest.inputs.map((i) => [i.id, i]));

/** The sidebar's rows for these values: visible inputs, runs sorted by band. */
function sidebar(values: Record<string, unknown> = {}): Array<{ id: string; section: string | null }> {
  const model = buildInputModel(manifest as never, { initial: values as never });
  const current = Object.fromEntries(model.map((i) => [i.id, i.value]));
  const rows = model.filter((i) => i.group !== 'export' && matchesShowIf(i.showIf, current));
  const order: string[] = [];
  for (const r of rows) if (r.section && !order.includes(r.section)) order.push(r.section);
  const bands = resolveBands(order);
  const bandOf = (s: string | null): number => BANDS.indexOf(s ? bands.get(s) ?? 'content' : 'content');
  const runs: Array<{ sec: string | null; ids: string[] }> = [];
  for (const r of rows) {
    const last = runs[runs.length - 1];
    if (last && last.sec === (r.section ?? null)) last.ids.push(r.id);
    else runs.push({ sec: r.section ?? null, ids: [r.id] });
  }
  runs.sort((a, b) => bandOf(a.sec) - bandOf(b.sec) || (a.sec === null ? 0 : 1) - (b.sec === null ? 0 : 1));
  return runs.flatMap((r) => r.ids.map((id) => ({ id, section: r.sec })));
}
const sectionsOf = (rows: Array<{ section: string | null }>): Array<string | null> =>
  rows.map((r) => r.section).filter((s, i, all) => s !== all[i - 1]);

test('the loose rows come first, in the order a person fills them in', () => {
  const loose = manifest.inputs.filter((i) => !i.section && i.group !== 'export').map((i) => i.id);
  assert.deepEqual(loose, ['data', 'renderMode', 'chartType', 'plotType', 'sceneType', 'cinematicType', 'chartStyle', 'chartIntent', 'heading', 'subheading']);
  assert.equal(manifest.inputs[0]!.id, 'data');
  const modes: Array<[Record<string, string>, string]> = [
    [{}, 'chartType'],
    [{ renderMode: 'statistical' }, 'plotType'],
    [{ renderMode: 'scene' }, 'sceneType'],
    [{ renderMode: 'cinematic' }, 'cinematicType'],
  ];
  for (const [values, type] of modes) {
    const rows = sidebar(values).filter((r) => r.section === null).map((r) => r.id);
    assert.deepEqual(rows, ['data', 'renderMode', type, 'chartStyle', 'chartIntent', 'heading', 'subheading'], JSON.stringify(values));
  }
});

test('the section that belongs to the chosen type follows the loose rows, never the bottom', () => {
  const cases: Array<[Record<string, string>, string]> = [
    [{ chartType: 'pareto' }, 'Pareto options'],
    [{ chartType: 'bullet' }, 'Bullet options'],
    [{ chartType: 'range-bar' }, 'Range bar options'],
    [{ renderMode: 'statistical', plotType: 'regression' }, 'Statistical options'],
    [{ renderMode: 'scene' }, '3-D scene'],
    [{ renderMode: 'cinematic', cinematicType: 'flythrough3d' }, 'Flight camera'],
  ];
  for (const [values, section] of cases) {
    assert.equal(sectionsOf(sidebar(values))[1], section, JSON.stringify(values));
  }
  // A flight also stands on the 3-D stage: the flight's own section leads.
  assert.deepEqual(sectionsOf(sidebar({ renderMode: 'cinematic' })).slice(0, 4), [null, 'Flight camera', '3-D scene', 'Data']);
});

test('then Data, the titles and legend, colour, marks and axes, and animation', () => {
  assert.deepEqual(sectionsOf(sidebar()), [null, 'Data', 'Titles & labels', 'Legend', 'Colour & style', 'Custom palette', 'Marks & spacing', 'Axes & scale', 'Animation']);
  const data = manifest.inputs.filter((i) => i.section === 'Data').map((i) => i.id);
  assert.deepEqual(data, ['hasHeader', 'delimiter', 'transpose', 'labelColumn', 'seriesColumns', 'pivotColumn', 'zColumn', 'sizeColumn']);
  const axes = manifest.inputs.filter((i) => i.section === 'Axes & scale').map((i) => i.id);
  assert.deepEqual(axes.slice(0, 3), ['labelLayout', 'labelReserve', 'labelLines']);
  assert.ok(axes.includes('errorColumn'));
  assert.equal(byId.get('barThickness')!.section, 'Marks & spacing');
  assert.equal(byId.get('frameColumn')!.section, 'Animation');
  const sections = new Set(manifest.inputs.map((i) => i.section));
  for (const gone of ['Change chart', 'Field mapping', 'Category labels']) assert.ok(!sections.has(gone), gone);
});

test('the type and style controls are pickers, and every type option has a group', () => {
  for (const id of ['chartType', 'plotType', 'sceneType', 'cinematicType', 'chartStyle']) {
    assert.equal(byId.get(id)!.display, 'picker', id);
  }
  const groups = (id: string): string[] => [...new Set(byId.get(id)!.options!.map((o) => String(o.group)))];
  for (const id of ['chartType', 'plotType', 'sceneType', 'cinematicType']) {
    for (const o of byId.get(id)!.options!) assert.ok(o.group, `${id}.${o.value} has a group`);
  }
  assert.deepEqual(groups('chartType'), ['Compare', 'Change over time', 'Parts of a whole', 'Distribution', 'Relationship']);
  assert.deepEqual(groups('plotType'), ['Compare', 'Change over time', 'Distribution', 'Relationship']);
  assert.deepEqual(groups('sceneType'), ['Compare', 'Change over time', 'Parts of a whole', 'Relationship']);
  assert.deepEqual(groups('cinematicType'), ['Directed', 'Flight']);
  assert.ok(byId.get('chartStyle')!.options!.every((o) => !o.group), 'the styles are one set');
  // Each group is one contiguous run, so the manifest order is the panel order.
  for (const id of ['chartType', 'plotType', 'sceneType', 'cinematicType']) {
    const runs = byId.get(id)!.options!.map((o) => o.group).filter((g, i, all) => g !== all[i - 1]);
    assert.equal(runs.length, new Set(runs).size, `${id} groups are contiguous`);
  }
  assert.equal(byId.get('chartType')!.options!.length, 35);
});

test('every type and style option has a picture of its own', () => {
  // The schema's bound on a glyph, which the web shell tests again before drawing.
  const pattern = /^[MmLlHhVvCcSsQqTtAaZz0-9 ,.-]+$/;
  const seen = new Map<string, string>();
  for (const id of ['chartType', 'plotType', 'sceneType', 'cinematicType', 'chartStyle']) {
    for (const o of byId.get(id)!.options as Array<Option & { glyph?: string }>) {
      const where = `${id}.${o.value}`;
      assert.equal(typeof o.glyph, 'string', `${where} has a glyph`);
      assert.ok(o.glyph!.length <= 900 && pattern.test(o.glyph!), `${where} is path data within the bound`);
      assert.match(o.glyph!, /^M/, `${where} starts with a move`);
      // Two options that share a picture cannot be told apart on their tiles.
      assert.equal(seen.get(o.glyph!), undefined, `${where} repeats the picture of ${seen.get(o.glyph!)}`);
      seen.set(o.glyph!, where);
    }
  }
  assert.equal(seen.size, 80);
});

test('a control the chosen type never reads is hidden, and a hidden value still arrives', () => {
  const visible = (values: Record<string, string>): Set<string> => new Set(sidebar(values).map((r) => r.id));
  assert.ok(!visible({ chartType: 'radar' }).has('showValues'), 'a radar draws no data labels');
  assert.ok(visible({ chartType: 'bar' }).has('showValues'));
  assert.ok(!visible({ chartType: 'pie' }).has('valueSize'), 'pie labels do not go through valueLabel');
  assert.ok(!visible({ chartType: 'radial-bar' }).has('sliceGap'));
  assert.ok(!visible({ chartType: 'bump' }).has('yScaleType'));
  assert.ok(!visible({ chartType: 'treemap' }).has('animSpeed'), 'only the tweenable types animate by frame');
  assert.ok(visible({ renderMode: 'scene' }).has('animSpeed'), 'a scene animates by itself');
  const stats = visible({ renderMode: 'statistical' });
  for (const id of ['yZero', 'yMax', 'tickCount', 'showAxes', 'labelLayout', 'labelReserve', 'labelLines', 'showValues', 'axisTitleSize', 'yScaleType', 'errorColumn']) {
    assert.ok(!stats.has(id), `${id} is not drawn by the statistical renderer`);
  }
  for (const id of ['showGrid', 'xTitle', 'yTitle', 'numberFormat']) assert.ok(stats.has(id), `${id} is drawn by the statistical renderer`);
  // Hiding is presentation only: the model still takes the value from a link.
  const model = buildInputModel(manifest as never, { initial: { chartType: 'radar', showValues: false, yScaleType: 'log' } as never });
  assert.equal(model.find((i) => i.id === 'showValues')!.value, false);
  assert.equal(model.find((i) => i.id === 'yScaleType')!.value, 'log');
});
