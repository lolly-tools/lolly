// SPDX-License-Identifier: MPL-2.0
/**
 * lolly_render draws an `add.layer` written with authoring keys (`$in`, `$points`,
 * plan 291 W5) at the place its artboard gives the path. Design draws through the browser tier, so
 * this runs where a browser is named (LOLLY_BROWSER_CHANNEL=chrome or LOLLY_BROWSER_PATH).
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { callTool } from '../src/tools.ts';
import { closeBrowser, closeWebShell } from '../src/render.ts';

const skip = process.env.LOLLY_BROWSER_CHANNEL || process.env.LOLLY_BROWSER_PATH ? false : 'set LOLLY_BROWSER_CHANNEL=chrome or LOLLY_BROWSER_PATH to render through the browser tier';
after(async () => {
  await closeBrowser();
  await closeWebShell();
});

test('lolly_render draws an add.layer carrying $in and $points', { skip, timeout: 180_000 }, async () => {
  const result = await callTool('lolly_render', {
    toolId: 'design',
    format: 'svg',
    link: false,
    inputs: { boxes: [{ id: 'a', kind: 'frame', x: 2080, y: 0, w: 1920, h: 1080, bg: '#ffffff' }] },
    layerOperations: [{ op: 'add', layer: { id: 'tick', kind: 'path', $in: 'a', $points: [[100, 100], [300, 200], [500, 100]], stroke: '#112233', strokeW: 6 } }],
  });
  assert.ok(!result.isError, JSON.stringify(result.content[0]));
  const resource = result.content.find((item) => item.type === 'resource');
  assert.ok(resource?.type === 'resource' && typeof resource.resource.text === 'string');
  const svg = resource.resource.text;
  // The polyline, in its own whole-pixel box: 400 x 100 from (100, 100) on the artboard.
  assert.match(svg, /<path d="M0 0L200 100L400 0"[^>]*stroke="#112233"/);
});
