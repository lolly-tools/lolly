// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { baseHost } from './helpers/host.ts';
import { applyKit, createKitRows, parseKitDefinition } from '../shells/web/src/pro/kit-model.ts';

const source = (path: string) => readFile(new URL(`../community/${path}`, import.meta.url), 'utf8');
test('event recipes preserve literal copy through the real Design render path', async () => {
  const design = await loadTool('design', source);
  const qr = await loadTool('qr-code', source);
  const definition = parseKitDefinition(JSON.parse(await source('design/templates/event-kit.json')).kit);
  const { kit, rows } = createKitRows(definition, new Map([['design', design.manifest], ['qr-code', qr.manifest]]));
  kit.brief.title = '**交流会** <friends> _together_ {w600|hello}';
  kit.brief.venue = '';
  applyKit(kit, rows);
  for (const row of rows.filter(row => row.toolId === 'design')) {
    const runtime = await createRuntime(design, baseHost(), row.values);
    const dom = new JSDOM(runtime.getHydrated() as string);
    const title = dom.window.document.querySelector(`[data-box-id="${row.kitOutputId}-title"] .lolly-box-text`)!;
    assert.equal(title.textContent, kit.brief.title);
    assert.equal(title.children.length, 0, 'brief text cannot turn into markup');
    assert.equal(dom.window.document.querySelector(`[data-box-id="${row.kitOutputId}-venue"] .lolly-box-text`)?.textContent ?? '', '');
    assert.deepEqual(runtime.hookErrors, []);
    dom.window.close();
  }
  const legacy = await createRuntime(design, baseHost(), { boxes: [{ id: 'old', kind: 'text', text: '**bold**', w: 100, h: 50 }] });
  assert.match(legacy.getHydrated() as string, /<strong>bold<\/strong>/, 'existing Design formatting stays enabled');
});
