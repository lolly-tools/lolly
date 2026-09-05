// SPDX-License-Identifier: MPL-2.0
/**
 * ChartSpecV1 + the shipping Chart tool's brand/renderer contract.
 *
 * Run with: node --test tests/chart-spec.test.ts
 */

import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { test } from 'node:test';
import { gzipSync } from 'node:zlib';
import Ajv from 'ajv/dist/2020.js';
import {
  CHART_SPEC_VERSION,
  inspectChartSpec,
  resolveChartTheme,
  validateChartSpec,
} from '../engine/src/index.ts';

const CHART = new URL('../community/chart/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('tool.json', CHART), 'utf8'));
const hooksSource = readFileSync(new URL('hooks.js', CHART), 'utf8');
const template = readFileSync(new URL('template.html', CHART), 'utf8');
const threeBundle = readFileSync(new URL('lib/three-chart.min.js', CHART), 'utf8');
const threeAdapter = readFileSync(new URL('lib/chart-three.js', CHART), 'utf8');
const plotBundle = readFileSync(new URL('lib/observable-plot.min.js', CHART), 'utf8');
const plotAdapter = readFileSync(new URL('lib/chart-plot.js', CHART), 'utf8');
const communityNotice = readFileSync(
  new URL('NOTICE.md', new URL('../community/', import.meta.url)),
  'utf8'
);
const rootNotice = readFileSync(new URL('../THIRD-PARTY-NOTICES.md', import.meta.url), 'utf8');
const starterTemplates = readdirSync(new URL('templates/', CHART))
  .filter((name) => name.endsWith('.json'))
  .map((name) => JSON.parse(readFileSync(new URL(`templates/${name}`, CHART), 'utf8')));
const chartSchema = JSON.parse(
  readFileSync(new URL('../schemas/chart-v1.schema.json', import.meta.url), 'utf8')
);
const validateShape = new (Ajv as any)({ allErrors: true, strict: false }).compile(chartSchema);

function manifestModel(overrides: Record<string, unknown> = {}) {
  return manifest.inputs.map((input: { id: string; default?: unknown }) => ({
    id: input.id,
    value: Object.hasOwn(overrides, input.id) ? overrides[input.id] : input.default,
    isDirty: Object.hasOwn(overrides, input.id),
  }));
}

test('chart theme preserves authored brand order and deterministically extrapolates sparse brands', () => {
  const input = {
    id: 'acme',
    label: 'Acme',
    font: { brand: 'Acme Sans' },
    colours: { surface: '#fffaf2', ink: '#17120f', primary: '#a22116' },
  };
  const a = resolveChartTheme(input);
  const b = resolveChartTheme(input);
  assert.deepEqual(a, b);
  assert.equal(a.source, 'brand-derived');
  assert.equal(a.colours.categorical[0], '#a22116');
  assert.equal(a.colours.surface, '#fffaf2');
  assert.equal(a.font.brand, 'Acme Sans');
  assert.ok(
    a.colours.categorical.length >= 7,
    'a single brand hue should yield a useful categorical set'
  );
  assert.equal(a.colours.sequential.length, 7);
  assert.equal(a.colours.diverging.length, 7);
  assert.equal(a.provenance?.sequential, 'derived:oklab');

  const neutral = resolveChartTheme({ id: 'mono', colours: { primary: '#666666' } });
  assert.equal(
    neutral.marks.patterns,
    true,
    'a neutral brand must not invent hue-only category distinctions'
  );
});

test('ChartSpecV1 semantic validation requires real z for real 3-D marks', () => {
  const theme = resolveChartTheme({ id: 'acme', colours: { primary: '#0c7c59' } });
  const spec: any = {
    version: CHART_SPEC_VERSION,
    datasets: [
      {
        id: 'data',
        fields: [
          { id: 'category', label: 'Category', type: 'string' },
          { id: 'value', label: 'Value', type: 'number' },
          { id: 'series', label: 'Series', type: 'string' },
        ],
        rows: [{ category: 'A', value: 4, series: 'One' }],
      },
    ],
    series: [
      {
        id: 's1',
        name: 'One',
        dataset: 'data',
        mark: 'bar3d',
        channels: {
          x: { field: 'category', type: 'string' },
          y: { field: 'value', type: 'number' },
          z: { field: 'series', type: 'string' },
        },
      },
    ],
    scales: [],
    axes: [],
    legends: [],
    formatting: {},
    theme,
    presentation: {
      style: 'studio-3d',
      dimension: 3,
      rendererFamily: 'scene-3d',
      exportFidelity: 'hybrid',
      width: 1280,
      height: 800,
    },
    accessibility: {
      title: 'A chart',
      description: 'One value in three dimensions.',
      colourOnly: false,
      patterns: true,
    },
  };
  assert.deepEqual(validateChartSpec(spec), { ok: true, findings: [] });
  delete spec.series[0].channels.z;
  const bad = validateChartSpec(spec);
  assert.equal(bad.ok, false);
  assert.ok(bad.findings.some((f) => f.id === 'chart.channel.z'));
});

test('the shipping hook emits one brand-aware document for WebGL and vector fallback', async () => {
  const tokenValues: Record<string, string> = {
    '{color.semantic.primary}': '#123456',
    '{color.semantic.secondary}': '#c04428',
    '{color.semantic.surface}': '#fffaf2',
    '{color.semantic.text}': '#15120f',
    '{color.semantic.muted}': '#6f655f',
    '{color.semantic.edge}': '#d8cdc4',
    '{font.brand}': 'Acme Sans',
  };
  const host = {
    color: {},
    tokens: {
      colors: async () => [
        { name: 'Primary', path: 'color.semantic.primary', group: 'Brand', value: '#123456' },
        { name: 'Secondary', path: 'color.semantic.secondary', group: 'Brand', value: '#c04428' },
      ],
      resolve: async (path: string) => tokenValues[path] ?? null,
      active: async () => ({
        id: 'acme',
        label: 'Acme',
        locked: true,
        headId: 'user/ds/acme/tokens/brand',
      }),
    },
  };
  const hooks = new Function('host', `${hooksSource}\nreturn { onInit };`)(host);
  const patch = await hooks.onInit({
    model: manifestModel({
      chartType: 'surface3d',
      chartStyle: 'glass-3d',
      motionPreset: 'orbit',
      heading: 'Demand surface',
      background: '#fffaf2',
      data: 'Hour,Monday,Tuesday,Wednesday\n08:00,12,18,14\n10:00,23,31,28\n12:00,46,55,61',
    }),
  });
  const state = JSON.parse(patch._state);
  assert.equal(patch._useThree, true);
  assert.equal(state.spec.version, CHART_SPEC_VERSION);
  assert.equal(state.spec.presentation.rendererFamily, 'scene-3d');
  assert.equal(state.spec.presentation.exportFidelity, 'hybrid');
  assert.equal(state.spec.theme.sourceId, 'acme');
  assert.equal(state.spec.theme.sourceLabel, 'Acme');
  assert.equal(state.spec.theme.locked, true);
  assert.equal(state.spec.theme.font.brand, 'Acme Sans');
  assert.equal(state.spec.theme.colours.categorical[0], '#123456');
  assert.equal(state.spec.theme.scene.material, 'glass');
  assert.equal(state.spec.motion.preset, 'orbit');
  assert.match(patch._threeFallback, /<polygon/);
  assert.match(patch._threeFallback, /Vector 3-D view/);
  assert.match(patch._a11yTable, /<table>/);
  assert.match(patch._a11yTable, /Demand surface/);
  assert.equal(validateShape(state.spec), true, JSON.stringify(validateShape.errors));
  assert.equal(validateChartSpec(state.spec).ok, true);
  const report = inspectChartSpec(state.spec, 'three-webgl');
  assert.equal(report.rendererId, 'three-webgl');
  assert.equal(report.theme.sourceId, 'acme');

  const explicit = await hooks.onInit({
    model: manifestModel({
      chartType: 'bar3d',
      chartStyle: 'glass-3d',
      sceneMaterial: 'accurate',
    }),
  });
  assert.equal(
    JSON.parse(explicit._state).spec.theme.scene.material,
    'accurate',
    'an explicitly edited control wins over a style default'
  );

  const cinematic = await hooks.onInit({
    model: manifestModel({
      renderMode: 'cinematic',
      cinematicType: 'flythrough3d',
      heading: 'Demand flight',
      flightSeries: 'Demand',
      flightHeight: 0.7,
      flightLookAhead: 1.4,
      flightBank: 12,
      flightFov: 58,
      animDirection: 'bounce',
      data: 'Chapter,Demand,Capacity\nArrival,24,35\nPeak,68,51\nLanding,84,86',
    }),
  });
  const cinematicState = JSON.parse(cinematic._state);
  assert.equal(cinematic._renderMode, 'cinematic');
  assert.equal(cinematic._effectiveChartType, 'flythrough3d');
  assert.equal(cinematic._useThree, true);
  assert.equal(cinematicState.report.rendererId, 'three-data-flight');
  assert.equal(cinematicState.spec.series[0].mark, 'line3d');
  assert.equal(cinematicState.spec.series[0].channels.x.field, 'order');
  assert.equal(cinematicState.spec.series[0].channels.y.field, 'value');
  assert.equal(cinematicState.spec.series[0].channels.z.field, 'series');
  assert.equal(cinematicState.spec.motion.preset, 'data-flight');
  assert.equal(cinematicState.spec.motion.loop, 'bounce');
  assert.equal(cinematicState.spec.presentation.camera.projection, 'perspective');
  assert.equal(cinematicState.cfg.flightSeries, 'Demand');
  assert.match(cinematic._threeFallback, /<polyline/);
  assert.match(cinematic._threeFallback, /Cinematic vector poster/);
  assert.equal(validateShape(cinematicState.spec), true, JSON.stringify(validateShape.errors));
  assert.equal(validateChartSpec(cinematicState.spec).ok, true);
});

test('the chart delivery keeps its progressive renderer and accessibility contracts', () => {
  const vectorValues = new Map(
    manifest.inputs
      .find((i: any) => i.id === 'chartType')
      .options.map((o: any) => [o.value, o.label])
  );
  const sceneValues = new Map(
    manifest.inputs
      .find((i: any) => i.id === 'sceneType')
      .options.map((o: any) => [o.value, o.label])
  );
  const cinematicValues = new Map(
    manifest.inputs
      .find((i: any) => i.id === 'cinematicType')
      .options.map((o: any) => [o.value, o.label])
  );
  const plotValues = new Map(
    manifest.inputs
      .find((i: any) => i.id === 'plotType')
      .options.map((o: any) => [o.value, o.label])
  );
  assert.ok(vectorValues.has('bar'));
  for (const id of ['bar3d', 'scatter3d', 'surface3d']) assert.ok(sceneValues.has(id), id);
  for (const id of ['flythrough3d', 'ribbon3d', 'constellation3d']) assert.ok(cinematicValues.has(id), id);
  for (const id of [
    'dot-strip',
    'interval',
    'range-band',
    'difference-area',
    'indexed-change',
    'box-observations',
    'rug-histogram',
    'small-multiples',
    'distribution-facets',
    'density-ridges',
    'ecdf',
    'control-band',
    'hexbin',
    'density-contour',
    'regression',
    'candlestick',
  ]) {
    assert.ok(plotValues.has(id), id);
  }
  assert.equal(manifest.inputs[0].id, 'renderMode');
  assert.equal(manifest.inputs[0].display, 'segmented');
  assert.deepEqual(
    manifest.inputs[0].options.map((option: any) => option.value),
    ['vector', 'statistical', 'scene', 'cinematic']
  );
  assert.equal(manifest.examples.length, 8, 'the gallery keeps a bounded, curated style set');
  assert.match(template, /<title>\{\{_chartTitle\}\}<\/title>/);
  assert.match(template, /<desc>\{\{_chartDescription\}\}<\/desc>/);
  assert.match(template, /data-chart3d-fallback/);
  assert.match(template, /data-chart3d-canvas/);
  assert.match(template, /data-chart-plot-fallback/);
  assert.match(template, /data-chart-plot-root/);
  assert.match(template, /data-chart-plot-clock/);
  assert.match(template, /\/tools\/chart\/lib\/observable-plot\.min\.js/);
  assert.match(template, /__lollyFrameRender/);
  assert.doesNotMatch(
    hooksSource,
    /Plotly\.|echarts\.|THREE\./,
    'vendor APIs must not leak into the renderer-neutral hook'
  );
  assert.ok(
    statSync(new URL('lib/three-chart.min.js', CHART)).size < 600_000,
    'chart-only Three bundle must stay below the 600 KB raw budget'
  );
  assert.match(threeBundle, /^\/\*! three\.js r\d+ \([^)]+\) - MIT - https:\/\/threejs\.org/);
  assert.match(threeBundle, /CatmullRomCurve3/);
  assert.match(threeBundle, /TubeGeometry/);
  assert.match(threeAdapter, /cameraAlongData/);
  assert.match(threeAdapter, /flightCurve\.getPointAt/);
  assert.ok(
    statSync(new URL('lib/observable-plot.min.js', CHART)).size < 230_000,
    'the Plot grammar must remain below its 230 KB raw lazy-load budget'
  );
  assert.ok(
    gzipSync(plotBundle).length < 75_000,
    'the Plot grammar must remain below its 75 KB gzip lazy-load budget'
  );
  assert.match(plotBundle, /@observablehq\/plot v0\.6\.17/);
  assert.match(plotAdapter, /Plot\.plot\(options\)/);
  assert.match(plotAdapter, /requestAnimationFrame\(tick\)/);
  assert.match(plotAdapter, /__lollyFrameRender/);
  assert.doesNotMatch(plotAdapter, /eval\(|new Function|innerHTML/);
  assert.match(communityNotice, /chart\/lib\/three-chart\.min\.js/);
  assert.match(communityNotice, /chart\/lib\/observable-plot\.min\.js/);
  assert.match(rootNotice, /tools\/chart\/lib\/three-chart\.min\.js/);
  assert.match(rootNotice, /tools\/chart\/lib\/observable-plot\.min\.js/);
});

test('the beginner-facing chooser exposes branded styles, editorial statistics and real 3-D', () => {
  const byId = new Map(starterTemplates.map((template) => [template.id, template]));
  assert.equal(byId.get('branded-presentations')?.category, 'Styles');
  assert.equal(byId.get('scene-bars')?.values.sceneType, 'bar3d');
  assert.equal(byId.get('brand-terrain')?.values.sceneType, 'surface3d');
  assert.equal(byId.get('spatial-scatter')?.values.sceneType, 'scatter3d');
  for (const id of ['scene-bars', 'brand-terrain', 'spatial-scatter']) {
    assert.equal(byId.get(id)?.category, '3-D');
    assert.equal(byId.get(id)?.values.renderMode, 'scene');
    assert.ok(byId.get(id)?.values.chartStyle, `${id} must visibly exercise a chart style`);
  }
  for (const id of ['data-flight', 'ribbon-canyon', 'constellation-tour']) {
    assert.equal(byId.get(id)?.category, 'Cinematic');
    assert.equal(byId.get(id)?.values.renderMode, 'cinematic');
    assert.ok(byId.get(id)?.values.cinematicType, `${id} must select a cinematic form`);
    assert.ok(byId.get(id)?.values.flightSeries, `${id} must choose the camera-driving series`);
  }
  for (const id of [
    'editorial-dots',
    'small-multiple-trends',
    'regression-story',
    'hexbin-density',
    'candlestick-series',
    'uncertainty-band',
    'indexed-growth',
    'distribution-lab',
    'control-band',
  ]) {
    assert.equal(byId.get(id)?.values.renderMode, 'statistical');
    assert.ok(byId.get(id)?.values.plotType, `${id} must select a statistical articulation`);
    assert.ok(byId.get(id)?.values.heading, `${id} must start as a usable editorial story`);
  }
});

test('the statistical compiler emits portable layered meanings, never Plot configuration', async () => {
  const host = {
    color: {},
    tokens: {
      colors: async () => [
        { name: 'Primary', path: 'color.semantic.primary', group: 'Brand', value: '#166c52' },
        { name: 'Accent', path: 'color.semantic.secondary', group: 'Brand', value: '#ec6b3a' },
      ],
      resolve: async (path: string) =>
        ({
          '{color.semantic.primary}': '#166c52',
          '{color.semantic.secondary}': '#ec6b3a',
          '{color.semantic.surface}': '#fffdf8',
          '{color.semantic.text}': '#171914',
        })[path] ?? null,
      active: async () => ({ id: 'acme', label: 'Acme' }),
    },
  };
  const hooks = new Function('host', `${hooksSource}\nreturn { onInit };`)(host);
  const regression = await hooks.onInit({
    model: manifestModel({
      renderMode: 'statistical',
      plotType: 'regression',
      heading: 'Investment and demand',
      data: 'Investment,Demand\n12,19\n16,25\n19,23\n23,34\n27,38\n31,41',
    }),
  });
  const regressionState = JSON.parse(regression._state);
  assert.equal(regression._usePlot, true);
  assert.equal(regression._useThree, false);
  assert.equal(regressionState.cfg.chartType, 'regression');
  assert.equal(regressionState.spec.presentation.rendererFamily, 'scientific');
  assert.equal(regressionState.spec.presentation.exportFidelity, 'vector');
  assert.equal(regressionState.spec.series[0].mark, 'regression');
  assert.equal(regressionState.spec.series[0].channels.x.field, 'investment_1');
  assert.equal(regressionState.spec.series[0].channels.y.field, 'demand_2');
  assert.equal(regressionState.spec.motion.enabled, false);
  assert.equal(regressionState.spec.accessibility.colourOnly, false);
  assert.equal(validateShape(regressionState.spec), true, JSON.stringify(validateShape.errors));
  assert.equal(validateChartSpec(regressionState.spec).ok, true);
  assert.doesNotMatch(regression._state, /"Plot"|"marks"\s*:\s*\[/);

  const interval = JSON.parse(
    (
      await hooks.onInit({
        model: manifestModel({
          renderMode: 'statistical',
          plotType: 'interval',
          data: 'Team,Before,After\nDesign,42,61\nSales,33,57',
        }),
      })
    )._state
  ).spec;
  assert.equal(interval.series[0].mark, 'rule');
  assert.equal(interval.series[0].channels.low.field, 'low');
  assert.equal(interval.series[0].channels.high.field, 'high');

  const candles = JSON.parse(
    (
      await hooks.onInit({
        model: manifestModel({
          renderMode: 'statistical',
          plotType: 'candlestick',
          data: 'Day,Open,High,Low,Close\nMon,42,48,39,46\nTue,46,51,44,49',
        }),
      })
    )._state
  ).spec;
  assert.equal(candles.series[0].mark, 'candlestick');
  assert.deepEqual(Object.keys(candles.series[0].channels), ['x', 'open', 'high', 'low', 'close']);

  const range = JSON.parse(
    (
      await hooks.onInit({
        model: manifestModel({
          renderMode: 'statistical',
          plotType: 'range-band',
          data: 'Month,Low,Expected,High\nJan,32,41,52\nFeb,35,46,58',
        }),
      })
    )._state
  ).spec;
  assert.equal(range.series[0].mark, 'area');
  assert.equal(range.series[0].channels.low.field, 'low');
  assert.equal(range.series[0].channels.high.field, 'high');
  assert.equal(range.series[1].channels.y.field, 'expected');
  assert.equal(validateChartSpec(range).ok, true);

  const indexed = JSON.parse(
    (
      await hooks.onInit({
        model: manifestModel({
          renderMode: 'statistical',
          plotType: 'indexed-change',
          data: 'Quarter,Large,Small\nQ1,200,20\nQ2,220,25\nQ3,250,31',
        }),
      })
    )._state
  ).spec;
  assert.equal(indexed.series[0].channels.y.field, 'index');
  assert.deepEqual(indexed.datasets[0].rows.map((row: any) => Math.round(row.index)), [100, 110, 125, 100, 125, 155]);

  const cumulative = JSON.parse(
    (
      await hooks.onInit({
        model: manifestModel({
          renderMode: 'statistical',
          plotType: 'ecdf',
          data: 'Observation,New,Old\n1,10,20\n2,20,30\n3,30,40',
        }),
      })
    )._state
  ).spec;
  assert.equal(cumulative.series[0].channels.y.field, 'probability');
  assert.deepEqual(cumulative.datasets[0].rows.slice(0, 3).map((row: any) => row.probability), [1 / 3, 2 / 3, 1]);

  const animated = JSON.parse(
    (
      await hooks.onInit({
        model: manifestModel({
          renderMode: 'statistical',
          plotType: 'range-band',
          frameColumn: 'Wave',
          labelColumn: 'Team',
          plotMotionPreset: 'stagger',
          data: 'Wave,Team,Low,Expected,High\nFirst,A,20,30,40\nFirst,B,28,38,48\nSecond,A,31,43,55\nSecond,B,36,49,62',
        }),
      })
    )._state
  );
  assert.equal(animated.data.frames.length, 2);
  assert.equal(animated.spec.motion.preset, 'by-frame-field', 'data animation takes priority over entrance motion');
  assert.equal(animated.spec.series[0].channels.frame.field, 'frame');
  assert.deepEqual(new Set(animated.spec.datasets[0].rows.map((row: any) => row.frame)), new Set(['First', 'Second']));
  assert.equal(validateChartSpec(animated.spec).ok, true);

  const stagger = JSON.parse(
    (
      await hooks.onInit({
        model: manifestModel({ renderMode: 'statistical', plotType: 'dot-strip', plotMotionPreset: 'stagger' }),
      })
    )._state
  ).spec;
  assert.equal(stagger.motion.preset, 'stagger');
  assert.equal(stagger.motion.enabled, true);
  assert.equal(validateShape(stagger), true, JSON.stringify(validateShape.errors));
});

test('mode switching carries shared chart inputs and parks renderer-specific choices', async () => {
  const host = {
    color: {},
    tokens: {
      colors: async () => [
        { name: 'Primary', path: 'color.semantic.primary', group: 'Brand', value: '#126e52' },
        { name: 'Accent', path: 'color.semantic.secondary', group: 'Brand', value: '#ed6a3a' },
      ],
      resolve: async (path: string) =>
        ({
          '{color.semantic.primary}': '#126e52',
          '{color.semantic.secondary}': '#ed6a3a',
          '{color.semantic.surface}': '#fffdf8',
          '{color.semantic.text}': '#171914',
        })[path] ?? null,
      active: async () => ({ id: 'acme', label: 'Acme' }),
    },
  };
  const hooks = new Function('host', `${hooksSource}\nreturn { onInit, onInput };`)(host);
  const shared = {
    data: 'Quarter,North,South\nQ1,42,28\nQ2,49,35\nQ3,55,41',
    heading: 'Regional demand',
    subheading: 'Three-quarter view',
    chartStyle: 'editorial',
    palette: 'ordered',
    showValues: true,
    cameraAzimuth: 61,
    plotType: 'regression',
    cinematicType: 'ribbon3d',
    flightSeries: 'North',
    flightHeight: 1.1,
  };

  const vector = await hooks.onInit({
    model: manifestModel({
      ...shared,
      renderMode: 'vector',
      chartType: 'line',
      sceneType: 'surface3d',
    }),
  });
  const vectorState = JSON.parse(vector._state);
  assert.equal(vector._renderMode, 'vector');
  assert.equal(vector._effectiveChartType, 'line');
  assert.equal(vector._useThree, false);
  assert.equal(vectorState.spec.presentation.rendererFamily, 'svg');

  const statistical = await hooks.onInput({
    id: 'renderMode',
    value: 'statistical',
    model: manifestModel({
      ...shared,
      renderMode: 'statistical',
      chartType: 'line',
      sceneType: 'surface3d',
    }),
  });
  const statisticalState = JSON.parse(statistical._state);
  assert.equal(statistical._renderMode, 'statistical');
  assert.equal(statistical._effectiveChartType, 'regression');
  assert.equal(statistical._usePlot, true);
  assert.equal(statisticalState.spec.presentation.rendererFamily, 'scientific');
  assert.deepEqual(statisticalState.data.categories, vectorState.data.categories);
  assert.deepEqual(statisticalState.data.series, vectorState.data.series);

  const scene = await hooks.onInput({
    id: 'renderMode',
    value: 'scene',
    model: manifestModel({
      ...shared,
      renderMode: 'scene',
      chartType: 'line',
      sceneType: 'surface3d',
    }),
  });
  const sceneState = JSON.parse(scene._state);
  assert.equal(scene._renderMode, 'scene');
  assert.equal(scene._effectiveChartType, 'surface3d');
  assert.equal(scene._useThree, true);
  assert.equal(sceneState.spec.presentation.rendererFamily, 'scene-3d');
  assert.equal(sceneState.cfg.heading, shared.heading);
  assert.equal(sceneState.cfg.subheading, shared.subheading);
  assert.equal(sceneState.cfg.chartStyle, shared.chartStyle);
  assert.equal(sceneState.cfg.cameraAzimuth, shared.cameraAzimuth);
  assert.deepEqual(sceneState.data.categories, vectorState.data.categories);
  assert.deepEqual(sceneState.data.series, vectorState.data.series);

  const cinematic = await hooks.onInput({
    id: 'renderMode',
    value: 'cinematic',
    model: manifestModel({
      ...shared,
      renderMode: 'cinematic',
      chartType: 'line',
      sceneType: 'surface3d',
    }),
  });
  const cinematicState = JSON.parse(cinematic._state);
  assert.equal(cinematic._renderMode, 'cinematic');
  assert.equal(cinematic._effectiveChartType, 'ribbon3d');
  assert.equal(cinematic._useThree, true);
  assert.equal(cinematicState.spec.presentation.rendererFamily, 'scene-3d');
  assert.equal(cinematicState.spec.motion.preset, 'data-flight');
  assert.equal(cinematicState.cfg.flightSeries, 'North');
  assert.equal(cinematicState.cfg.flightHeight, 1.1);
  assert.deepEqual(cinematicState.data.categories, vectorState.data.categories);
  assert.deepEqual(cinematicState.data.series, vectorState.data.series);

  const vectorAgain = await hooks.onInput({
    id: 'renderMode',
    value: 'vector',
    model: manifestModel({
      ...shared,
      renderMode: 'vector',
      chartType: 'line',
      sceneType: 'surface3d',
    }),
  });
  assert.equal(vectorAgain._effectiveChartType, 'line', 'the parked 2-D choice returns');
  assert.equal(JSON.parse(vectorAgain._state).cfg.cameraAzimuth, 61, 'scene controls stay parked');

  const legacy = await hooks.onInit({
    model: manifestModel({ ...shared, chartType: 'scatter3d' }),
  });
  assert.equal(legacy.renderMode, 'scene');
  assert.equal(legacy.sceneType, 'scatter3d');
  assert.equal(legacy.chartType, 'scatter');
  assert.equal(legacy._effectiveChartType, 'scatter3d');
});
