// SPDX-License-Identifier: MPL-2.0
/**
 * scripts/lib/svgo-shots.ts - the docs-shot fidelity gate renders in a child process.
 *
 * A resvg panic on a malformed capture used to abort the whole shots run (exit 134,
 * 2026-09-26). The gate now renders in scripts/lib/svg-fidelity-child.ts, so a
 * renderer that dies comes back as a failed verdict with `renderError` set, which
 * the caller treats as "keep the unoptimised bytes", and the run carries on.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { svgFidelityGate } from '../scripts/lib/svgo-shots.ts';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);
const box = (fill: string): Uint8Array =>
  enc(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="30"><rect width="40" height="30" fill="${fill}"/></svg>`);

test('identical renders pass the gate', async () => {
  const v = await svgFidelityGate(box('#336699'), box('#336699'));
  assert.equal(v.ok, true);
  assert.equal(v.maxChannelDelta, 0);
  assert.equal(v.renderError, undefined);
});

test('a visible change fails the gate with its measured delta', async () => {
  const v = await svgFidelityGate(box('#336699'), box('#ff0000'));
  assert.equal(v.ok, false);
  assert.ok(v.maxChannelDelta > 32);
  assert.equal(v.renderError, undefined);
});

test('renders of different sizes fail the gate', async () => {
  const other = enc('<svg xmlns="http://www.w3.org/2000/svg" width="41" height="30"><rect width="41" height="30" fill="#336699"/></svg>');
  const v = await svgFidelityGate(box('#336699'), other);
  assert.equal(v.ok, false);
});

test('a renderer that dies is a failed verdict, not a crash of the caller', async () => {
  // Not SVG at all: resvg rejects it and the child exits non-zero, the same path a
  // native panic takes. The caller's process must survive and get a reason back.
  const v = await svgFidelityGate(enc('this is not an svg'), box('#336699'));
  assert.equal(v.ok, false);
  assert.ok(v.renderError, 'renderError explains why the check could not run');
});
