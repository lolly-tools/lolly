// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import Handlebars from 'handlebars';
import Ajv from 'ajv/dist/2020.js';
import { validateChartSpec } from '../engine/src/chart-spec.ts';

const dir = new URL('../community/chart/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('tool.json', dir), 'utf8'));
const source = readFileSync(new URL('hooks.js', dir), 'utf8');
const template = Handlebars.compile(readFileSync(new URL('template.html', dir), 'utf8'));
const d3 = readFileSync(new URL('lib/d3.min.js', dir), 'utf8');
const schema = new (Ajv as any)({ strict: false }).compile(JSON.parse(readFileSync(new URL('../schemas/chart-v1.schema.json', import.meta.url), 'utf8')));

async function render(values: Record<string, unknown>) {
  const hooks = new Function('host', source + ';return {onInit};')({});
  const inputs = Object.fromEntries(manifest.inputs.map((i: any) => [i.id, i.default]));
  Object.assign(inputs, values);
  const model = manifest.inputs.map((i: any) => ({ ...i, value: inputs[i.id], isDirty: Object.hasOwn(values, i.id) }));
  const extras = await hooks.onInit({ model });
  const state = JSON.parse(extras._state);
  assert.equal(schema(state.spec), true, JSON.stringify(schema.errors));
  assert.equal(validateChartSpec(state.spec).ok, true);
  const dom = new JSDOM('<!doctype html><body>' + template({ ...inputs, ...extras }) + '</body>', { runScripts: 'outside-only', pretendToBeVisual: true } as any);
  // Text measuring is the only canvas dependency of the vector renderer.
  (dom.window.HTMLCanvasElement.prototype as any).getContext = () => ({ measureText: (s: string) => ({ width: String(s).length * 7 }) });
  dom.window.eval(d3);
  for (const script of dom.window.document.querySelectorAll('script:not([type="application/json"])')) dom.window.eval(script.textContent || '');
  await new Promise<void>((resolve) => setImmediate(resolve));
  return { dom, state, document: dom.window.document };
}

test('Pareto ranks actual rows and shares cumulative meaning with the SVG and accessible table', async () => {
  const { dom, document, state } = await render({ chartType: 'pareto', data: 'Cause,Count\nSmall,2\nLarge,6\nSmall,2\nMissing,', paretoThreshold: 70 });
  try {
    assert.deepEqual(state.spec.datasets[0].rows.map((r: any) => [r.category, r.value, r.cumulative]), [['Large', 6, 60], ['Small', 2, 80], ['Small', 2, 100]]);
    const bars = [...document.querySelectorAll('[data-comparison="pareto"] rect[data-value]')];
    assert.equal(bars.length, 3);
    assert.equal(new Set(bars.map((bar) => bar.getAttribute('x'))).size, 3, 'repeated category labels still occupy separate bars');
    assert.ok(document.querySelector('[data-cumulative]'));
    assert.equal(document.querySelector('[data-threshold]')?.getAttribute('data-threshold'), '70');
    assert.equal(state.spec.series[1].channels.y.scale, 'cumulative');
    assert.match(document.querySelector('[data-chart-a11y]')?.textContent || '', /Cumulative share/);
    assert.doesNotMatch(document.querySelector('#d3-plot')?.innerHTML || '', /NaN|Infinity/);
  } finally { dom.window.close(); }
});

test('Pareto controls hide the line and reject negative inputs with a named explanation', async () => {
  const hidden = await render({ chartType: 'pareto', data: 'Cause,Count\nA,3\nB,2', paretoCumulative: false });
  try { assert.equal(hidden.document.querySelector('[data-cumulative]'), null); assert.equal(hidden.state.spec.series.length, 1); }
  finally { hidden.dom.window.close(); }
  const bad = await render({ chartType: 'pareto', data: 'Cause,Count\nA,-3\nB,2' });
  try { assert.match(bad.document.querySelector('#d3-plot')?.textContent || '', /non-negative/); assert.equal(bad.document.querySelector('[data-comparison]'), null); }
  finally { bad.dom.window.close(); }
});

test('Bullet uses per-row targets, preserves missing targets, and fits all rows to one dark-theme scale', async () => {
  const { dom, document, state } = await render({ chartType: 'bullet', data: 'Team,Actual,Target\nA,120,100\nB,50,80\nC,40,', transparentBg: false, background: '#14252b', textColor: '#f8f8f8', bulletBands: false });
  try {
    assert.deepEqual(state.spec.datasets[0].rows.map((r: any) => r.target), [100, 80, null]);
    assert.equal(document.querySelectorAll('[data-target]').length, 2);
    const bars = [...document.querySelectorAll('[data-comparison="bullet"] rect[data-value]')];
    assert.equal(bars.length, 3);
    const widths = bars.map((r) => Number(r.getAttribute('width')));
    assert.ok(Math.abs(widths[0]! / widths[1]! - 120 / 50) < 0.001);
    assert.equal(document.querySelectorAll('[data-comparison="bullet"] rect').length, 3, 'band toggle affects rendered geometry');
    assert.equal(document.querySelector('#d3-bg')?.getAttribute('fill'), '#14252b');
  } finally { dom.window.close(); }
  const fallback = await render({ chartType: 'bullet', data: 'Team,Actual\nA,40', bulletTarget: 75 });
  try { assert.equal(fallback.document.querySelector('[data-target]')?.getAttribute('data-target'), '75'); }
  finally { fallback.dom.window.close(); }
});

test('Range bars handle reversed, negative and equal endpoints without inventing missing values', async () => {
  const { dom, document, state } = await render({ chartType: 'range-bar', data: 'Name,Low,High\nA,-5,10\nB,8,2\nC,4,4\nD,,7', rangeMidpoint: false });
  try {
    assert.deepEqual(state.spec.datasets[0].rows.map((r: any) => [r.low, r.high]), [[-5, 10], [2, 8], [4, 4]]);
    assert.equal(document.querySelectorAll('[data-comparison="range-bar"] rect[data-value]').length, 3);
    assert.equal(document.querySelector('[data-midpoint]'), null);
    assert.doesNotMatch(document.querySelector('#d3-plot')?.innerHTML || '', /NaN|Infinity/);
  } finally { dom.window.close(); }
});
