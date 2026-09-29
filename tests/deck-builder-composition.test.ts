// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { baseHost } from './helpers/host.ts';
import { composeSlideMarkdown } from '../engine/src/slide-composition.ts';
import { execFileSync } from 'node:child_process';
import { JSDOM } from 'jsdom';

test('the tool planner bundle matches its engine source', () => {
  execFileSync(process.execPath, ['scripts/build-slide-composition.ts', '--check']);
});
const root = 'brands/suse/tools/';
const mounted = existsSync(root);
test('generated tool output preserves nine groups, uses the master scale, and remains safe HTML', { skip: !mounted && 'SUSE brand pack not mounted' }, async () => {
  const tool = await loadTool('deck-builder', async path => readFileSync(root + path, 'utf8'));
  const master = readFileSync('brands/suse/catalog/assets/suse/slides/masters.json');
  const host = baseHost({ assets: { get: async (id: string) => ({ id, url: 'asset:' + id }), query: async (q: { type?: string }) => q.type === 'data' ? [{ id: 'master' }] : [], bytes: async () => new Uint8Array(master) } });
  const content = '# Nine priorities\n\n' + Array.from({ length: 9 }, (_, i) => `## Group ${i + 1}\n- First point\n- Second point`).join('\n\n');
  const runtime = await createRuntime(tool, host, { deck: [{ layout: 'auto', content }] });
  const html = runtime.getHydrated() as string;
  assert.equal((html.match(/class="sl-flow-cell"/g) ?? []).length, 9);
  assert.match(html, /flow-cards-9-3/); assert.match(html, /--flow-body:2\.833/);
  assert.match(html, /Group 9/); assert.match(html, /Second point/);
  assert.equal((html.match(/class="sl-flow-marker"/g) ?? []).length, 18);
  await runtime.setInput('deck', [{ layout: 'auto', content: '# Safe\n- <script>alert(1)</script>\n- **Label**: <img src=x onerror=alert(1)>\n- Third', arrangement: 'flow-columns-3-2' }]);
  const safe = runtime.getHydrated() as string; assert.match(safe, /data-recipe="flow-columns-3-2"/); assert.ok(!safe.includes('<img src=x')); assert.ok(!safe.includes('<script>alert'));
  assert.equal(composeSlideMarkdown(content).plan.cells.length, 9);
  runtime.destroy();
});

test('export measures all slides in the node realm and refuses overflowing generated text', { skip: !mounted && 'SUSE brand pack not mounted' }, async () => {
  const tool = await loadTool('deck-builder', async path => readFileSync(root + path, 'utf8'));
  const runtime = await createRuntime(tool, baseHost({ export: { render: async () => new Blob(['ok']) } }), { deck: [{ layout: 'auto', content: '# Title\n- One\n- Two\n- Three' }] });
  const dom = new JSDOM('<div id="canvas"><div class="slides"><section class="sl-l-auto"><div data-overflow="true"></div></section></div></div>');
  let all = false;
  dom.window.document.querySelector('.slides')!.addEventListener('lolly:deck-fit', event => { all = (event as CustomEvent).detail.all; });
  await assert.rejects(runtime.export(dom.window.document.querySelector('#canvas') as unknown as Element, 'pptx'), /Some slide text does not fit/);
  assert.equal(all, true);
  runtime.destroy(); dom.window.close();
});
