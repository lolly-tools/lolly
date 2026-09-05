// SPDX-License-Identifier: MPL-2.0

import assert from 'node:assert/strict';
import { test } from 'node:test';
import Ajv from 'ajv/dist/2020.js';
import chartSchema from '../schema/chart-v1.schema.json' with { type: 'json' };
import { CHART_SPEC_VERSION } from '../src/chart-v1.ts';

const validate = new (Ajv as any)({ allErrors: true, strict: false }).compile(chartSchema);

const document = {
  version: CHART_SPEC_VERSION,
  datasets: [
    {
      id: 'data',
      fields: [
        { id: 'category', label: 'Category', type: 'string', role: 'dimension', format: 'plain', nullable: false },
        { id: 'value', label: 'Value', type: 'number', role: 'measure', format: 'currency', nullable: false },
        { id: 'series', label: 'Series', type: 'string', role: 'series', format: 'plain', nullable: false },
      ],
      rows: [{ category: 'A', value: 42, series: 'One' }],
    },
  ],
  series: [
    {
      id: 'series_1',
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
  theme: {
    id: 'acme:studio-3d',
    source: 'brand-derived',
    sourceId: 'acme',
    locked: true,
    font: { brand: 'Acme Sans' },
    colours: {
      surface: '#ffffff',
      ink: '#111111',
      muted: '#555555',
      edge: '#dddddd',
      primary: '#008657',
      secondary: '#2453ff',
      categorical: ['#008657', '#2453ff'],
      sequential: ['#ffffff', '#008657'],
      diverging: ['#2453ff', '#ffffff', '#008657'],
    },
    marks: { lineWidth: 3, cornerRadius: 3, pointShape: 'circle', patterns: false },
    scene: { material: 'matte', roughness: 0.58, metalness: 0.04, shadows: true },
    motion: { easing: 'smooth', durationMs: 1200, staggerMs: 45 },
  },
  presentation: {
    style: 'studio-3d',
    dimension: 3,
    rendererFamily: 'scene-3d',
    exportFidelity: 'hybrid',
    width: 1280,
    height: 800,
    transparent: false,
    camera: { projection: 'orthographic', azimuth: 38, elevation: 24 },
  },
  accessibility: {
    title: 'Values',
    description: 'One branded value.',
    readingOrder: ['One'],
    table: { columns: ['Category', 'Value', 'Series'], rows: [['A', 42, 'One']] },
    colourOnly: false,
    patterns: true,
  },
};

test('the published ChartSpecV1 schema accepts a portable real-z document', () => {
  assert.equal(validate(document), true, JSON.stringify(validate.errors));
});

test('the schema closes vendor escape hatches and requires accessibility metadata', () => {
  const vendor = structuredClone(document) as any;
  vendor.plotly = { config: { responsive: true } };
  assert.equal(validate(vendor), false);
  assert.ok(validate.errors?.some((e: any) => e.keyword === 'additionalProperties'));

  const inaccessible = structuredClone(document) as any;
  delete inaccessible.accessibility.description;
  assert.equal(validate(inaccessible), false);
  assert.ok(validate.errors?.some((e: any) => e.keyword === 'required'));

  const invalidSemantics = structuredClone(document) as any;
  invalidSemantics.datasets[0].fields[1].role = 'plotly-colour';
  assert.equal(validate(invalidSemantics), false);
  assert.ok(validate.errors?.some((e: any) => e.keyword === 'enum'));
});
