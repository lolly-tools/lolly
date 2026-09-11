// SPDX-License-Identifier: MPL-2.0
/**
 * Pure logic of the URL-budget gauge (the content-volume visual + share-query reconstruction),
 * plus a jsdom-backed check of the reassurance-toast trigger (fires once when the bar first
 * fills, skipped on mount, re-arms after dropping).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { gaugeVisual, shareQueryOf, createUrlGauge } from './url-budget-gauge.ts';
import type { UrlCostModel } from './url-budget.ts';

const BROWSER = { warn: 16000, hard: 64000 };

// jsdom for the toast test (mirrors view-fade.test.ts). The gauge is position:absolute inside a
// stage, with the toast as its sibling - exactly the shape tool.ts mounts.
const dom = new JSDOM(
  '<!doctype html><body><div id="stage"><div id="g"></div><div data-gauge-toast hidden></div></div></body>',
  { pretendToBeVisual: true, url: 'http://localhost/' }, // a real origin so localStorage works (the gauge reads it)
);
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;

/** A minimal cost model the gauge's update() reads: readableLen/baseLen/fidelity/target. */
const model = (queryLen: number, faithful = true): UrlCostModel => ({
  readableLen: 40 + queryLen,
  baseLen: 40,
  fidelity: { faithful, droppedScalars: [], droppedBlocks: [], excludedAssets: [] },
  target: { name: 'browser', warn: 16000, hard: 64000 },
} as unknown as UrlCostModel);

test('gaugeVisual: the fill HEIGHT is log-curved - small content already reads as a clear fraction', () => {
  // The whole point of the rework: a few hundred chars must NOT sit near-empty (the "no feedback"
  // bug of a linear len/limit fill). Monotonic, and reaching the top only at warn.
  const f = (q: number): number => gaugeVisual(q, true, BROWSER).fillFraction;
  assert.equal(f(0), 0, 'empty is empty');
  assert.ok(f(500) > 0.15, `500 chars should read >15%, got ${(f(500) * 100).toFixed(0)}%`);
  assert.ok(f(500) < f(2000) && f(2000) < f(8000), 'monotonic across the range');
  assert.ok(f(2000) > 0.4 && f(2000) < 0.7, `~2k reads mid-bar, got ${(f(2000) * 100).toFixed(0)}%`);
  assert.equal(f(16000), 1, 'reaches the top exactly at warn');
  assert.equal(f(200000), 1, 'clamps at the top past warn');
});

test('gaugeVisual: colour stays calm - amber only at the top, red only for unshareable / huge', () => {
  assert.equal(gaugeVisual(500, true, BROWSER).band, 'ok', 'normal content is green');
  assert.equal(gaugeVisual(8000, true, BROWSER).band, 'ok', 'still green well up the bar');
  assert.equal(gaugeVisual(16000, true, BROWSER).band, 'warn', 'amber once full (at warn)');
  assert.equal(gaugeVisual(16000, true, BROWSER).full, true);
  assert.equal(gaugeVisual(64000, true, BROWSER).band, 'over', 'red past hard');
  // "Red when there's content that can't be embedded" (Andy) - fidelity loss reds it at ANY size.
  assert.equal(gaugeVisual(300, false, BROWSER).band, 'over', 'unfaithful (device-local image) → red even when tiny');
});

test('shareQueryOf: only KEPT rows, joined by & - matches the readable share query', () => {
  const model = {
    params: [
      { status: 'kept', emit: 'a=hello' },
      { status: 'default', emit: '' },
      { status: 'dropped-len', emit: '' },
      { status: 'kept', emit: 'b=world' },
      { status: 'kept', emit: 'format=png' },
    ],
  } as unknown as UrlCostModel;
  assert.equal(shareQueryOf(model), 'a=hello&b=world&format=png');
});

test('shareQueryOf: an all-default model yields an empty query', () => {
  const model = { params: [{ status: 'default', emit: '' }] } as unknown as UrlCostModel;
  assert.equal(shareQueryOf(model), '');
});

test('toast: fires once when the bar first FILLS, skipped on mount, re-arms after dropping below', () => {
  const g = document.querySelector('#g') as HTMLElement;
  const toast = document.querySelector('[data-gauge-toast]') as HTMLElement;
  const gauge = createUrlGauge(g, { used: () => 'x', reassure: 'keep going - .lolly' }, () => false);

  // First paint (mount) with an already-FULL link: primed is false → NO toast (no pop on load).
  gauge.update(model(20000), 'base');
  assert.equal(toast.hidden, true, 'no toast on the mount paint even when already full');

  gauge.update(model(500), 'base'); // drop well below full
  assert.equal(toast.hidden, true);

  gauge.update(model(20000), 'base'); // an EDIT crosses into full → toast
  assert.equal(toast.hidden, false, 'toast appears when an edit fills the bar');
  assert.equal(toast.textContent, 'keep going - .lolly');

  toast.hidden = true; // staying full must NOT re-fire
  gauge.update(model(20000), 'base');
  assert.equal(toast.hidden, true, 'no re-fire while it stays full');

  gauge.update(model(500), 'base');   // drop, then fill again → re-arms
  gauge.update(model(20000), 'base');
  assert.equal(toast.hidden, false, 're-arms after dropping below full');

  // Unshareable content (fidelity loss) reds the band but that is a separate signal from the toast.
  gauge.update(model(500, false), 'base');
  assert.equal(g.dataset.band, 'over');
  assert.equal(toast.hidden, true, 'dropping below full hides the toast again');
  gauge.dispose();
});
