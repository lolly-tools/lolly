// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import Ajv from 'ajv';
import { readFile } from 'node:fs/promises';
import { callTool, TOOL_DEFS } from '../src/tools.ts';
import { exportUrl } from '../src/render.ts';
import { motionExportSettings } from '../src/motion-export.ts';
import { parseVideoParams } from '../../../engine/src/url-mode.ts';

const motion = { fps: 24, seconds: 6.5, wait: 0, codec: 'vp9', vq: 'best' };
const ajv = new Ajv({ strict: false });

test('render and editable links accept every shipped motion recipe', async () => {
  for (const name of ['kinetic-title', 'product-demo', 'quiet-explainer']) {
    const recipe = JSON.parse(await readFile(new URL(`../../../skills/lolly/examples/motion/${name}.json`, import.meta.url), 'utf8'));
    for (const tool of ['lolly_render', 'lolly_build_url']) {
      const check = ajv.compile(TOOL_DEFS.find(def => def.name === tool)!.inputSchema);
      assert.ok(check(recipe), JSON.stringify(check.errors));
    }
  }
});

test('motion settings survive the editable link and the actual browser export URL', async () => {
  const result = await callTool('lolly_build_url', { toolId: 'design', format: 'webm', ...motion });
  assert.ok(!result.isError, JSON.stringify(result));
  const output = result.content.filter(item => item.type === 'text').map(item => item.text).join('\n');
  const url = output.match(/https?:\/\/\S+/)?.[0];
  assert.ok(url);
  const query = url.slice(url.indexOf('?') + 1);
  const expected = { fps: 24, seconds: 6.5, wait: 0, codec: 'vp9', quality: 'best' };
  assert.deepEqual(parseVideoParams(new URLSearchParams(query)), expected);
  const renderUrl = exportUrl('https://example.test', 'design', query, 'webm', {});
  assert.deepEqual(parseVideoParams(new URLSearchParams(renderUrl.slice(renderUrl.indexOf('?') + 1))), expected);
});

test('omitted settings retain defaults, including an explicit zero settle time', () => {
  assert.deepEqual(motionExportSettings({}), {});
  assert.deepEqual(motionExportSettings({ wait: 0 }), { wait: 0 });
});

test('invalid motion requests fail before rendering instead of silently defaulting', async () => {
  for (const [key, value] of [
    ['fps', 0], ['fps', 121], ['fps', 29.97], ['fps', '30'], ['fps', null],
    ['seconds', 0], ['seconds', 3601], ['seconds', Infinity],
    ['wait', -1], ['wait', 31], ['codec', 'invented'], ['vq', 'huge'],
  ] as const) {
    assert.throws(() => motionExportSettings({ [key]: value }), new RegExp(key));
    for (const tool of ['lolly_render', 'lolly_build_url']) {
      const result = await callTool(tool, { toolId: 'design', format: 'webm', [key]: value });
      assert.equal(result.isError, true, `${tool}: ${key}=${String(value)}`);
      assert.match(JSON.stringify(result.content), new RegExp(key));
    }
  }
});

test('explicit samples travel in editable links and reject invalid requests before render', async () => {
  const result = await callTool('lolly_build_url', { toolId: 'design', format: 'png', sampleTimes: [0, 1.25] });
  assert.ok(!result.isError);
  const text = result.content.filter(item => item.type === 'text').map(item => item.text).join('\n');
  const url = text.match(/https?:\/\/\S+/)![0];
  assert.equal(new URLSearchParams(url.slice(url.indexOf('?') + 1)).get('sampletimes'), '0,1.25');
  for (const args of [{ sampleTimes: [] }, { sampleTimes: [1, 0] }, { sampleTimes: [0, Infinity] }, { sampleTimes: [0], cuts: 3 }]) {
    const response = await callTool('lolly_render', { toolId: 'design', format: 'png', ...args });
    assert.equal(response.isError, true);
    assert.match(JSON.stringify(response.content), /sampleTimes/);
  }
});
