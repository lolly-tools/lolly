// SPDX-License-Identifier: MPL-2.0
/**
 * host.color.solveApca is the engine's APCA inverse-solver, attached verbatim.
 *
 * The whole point of `makeColorApi()` is that every shell attaches THIS object
 * (`host.color = makeColorApi()`) rather than reimplementing anything, so a
 * method added here reaches web, Worker, Tauri and CLI with no shell edit - and
 * can never drift from the engine math it wraps. This suite pins that: the
 * bridge method must be byte-for-byte the same result as calling
 * `solveLightnessForApca` directly, including the `{ limit, samples }` options.
 *
 * The solver's own behaviour (polarity, reachability, gamut clamping) is covered
 * by tests/apca-solve.test.ts; here we only guard the wiring.
 *
 * Run with: node --test tests/color-host-api.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeColorApi, solveLightnessForApca } from '../engine/src/color-tools.ts';

test('solveApca on host.color equals solveLightnessForApca for a spread of inputs', () => {
  const api = makeColorApi();
  assert.equal(typeof api.solveApca, 'function', 'host.color.solveApca must be attached');

  const cases: Array<[number, number, number, string]> = [
    [30, 0.1, 60, '#ffffff'],   // dark text, light bg
    [200, 0.05, 45, '#101014'], // light text, dark bg
    [320, 0.15, 75, '#ffffff'],
    [145, 0.12, 90, '#f8fafc'],
    [0, 0, 60, '#000000'],      // grey on black
    [30, 0.1, 60, 'not-a-color'], // unparseable bg -> unreachable / NaN
  ];
  for (const [h, c, t, bg] of cases) {
    assert.deepEqual(
      api.solveApca!(h, c, t, bg),
      solveLightnessForApca(h, c, t, bg),
      `solveApca(${h}, ${c}, ${t}, ${JSON.stringify(bg)}) diverged from the engine function`,
    );
  }
});

test('solveApca passes { limit, samples } straight through to the engine', () => {
  const api = makeColorApi();

  // `limit` widens the reachable gamut (a P3 chroma the solver can clamp to).
  assert.deepEqual(
    api.solveApca!(30, 0.3, 60, '#ffffff', { limit: 'p3', samples: 256 }),
    solveLightnessForApca(30, 0.3, 60, '#ffffff', { limit: 'p3', samples: 256 }),
  );

  // `samples` changes the scan resolution used to locate the contrast maximum on
  // the UNREACHABLE path, so two sample counts can return different closest
  // colours - either must match the engine call made the same way.
  for (const samples of [16, 64, 512]) {
    assert.deepEqual(
      api.solveApca!(0, 0, 200, '#ffffff', { samples }),
      solveLightnessForApca(0, 0, 200, '#ffffff', { samples }),
      `samples=${samples} was not threaded through`,
    );
  }
});
