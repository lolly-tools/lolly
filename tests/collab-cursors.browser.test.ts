// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { getBrowser, closeBrowser } from '../packages/node-shell/src/browsers.ts';
import { shellSettled } from './helpers/shell-settled.ts';
const origin = process.env.LOLLY_COLLAB_TEST_URL;
const skip = origin ? false : 'set LOLLY_COLLAB_TEST_URL to a local Vite shell';
test('real-browser surface projection, pointer publication, focus merging, clear and export exclusion', {
  skip, timeout: 60_000,
}, async () => {
  const browser = await getBrowser();
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const page = await context.newPage();
  try {
    await page.route(`${origin}/collab-fixture`, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body></body></html>' }));
    await page.goto(`${origin}/collab-fixture`, { waitUntil: 'networkidle' }); await shellSettled(page);
    const result = await page.evaluate(async () => {
      const surfacePath = '/src/lib/collab-surface.ts', mountPath = '/src/views/tool-collab.ts';
      const { registerCollabSurface } = await import(surfacePath);
      const geometryPath = '/src/lib/collab-surface-geometry.ts';
      const { surfaceMapping } = await import(geometryPath);
      const { mountToolCollab } = await import(mountPath);
      document.body.innerHTML = '<main class="tool-stage" style="position:relative;width:1100px;height:700px"><div id="view" style="position:absolute;left:180px;top:140px;transform:scale(1.2);transform-origin:0 0"><div id="canvas" style="width:400px;height:300px;position:relative;transform-origin:200px 150px"><i id="probe" style="position:absolute;left:100px;top:180px;width:0;height:0"></i></div></div></main>';
      const canvas = document.querySelector<HTMLElement>('#canvas')!, view = document.querySelector<HTMLElement>('#view')!;
      let worstError = 0;
      for (const transform of ['none', 'rotate(31deg)', 'perspective(700px) rotateX(25deg) rotateY(-18deg)']) {
        canvas.style.transform = transform;
        const actual = document.querySelector('#probe')!.getBoundingClientRect();
        const mapping = surfaceMapping(canvas)!;
        const mapped = mapping.toClient({ x: .25, y: .6 });
        worstError = Math.max(worstError, Math.hypot(mapped.x - actual.left, mapped.y - actual.top));
        const logical = mapping.fromClient({ x: actual.left, y: actual.top });
        worstError = Math.max(worstError, Math.hypot(logical.x - .25, logical.y - .6));
      }
      canvas.style.transform = 'none';
      const before = canvas.outerHTML;
      let writes = 0, active = 'board-a'; const listeners = new Set<() => void>();
      const runtime = { getModel: () => [], setInput: async () => { writes++; }, applyPatch: async () => {} };
      const off = registerCollabSurface(runtime, { id: () => active, element: () => canvas, selection: () => ['shape'],
        subscribe: (fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn); } });
      const sent: { state: { cursor?: {x:number;y:number}; focus?: string; surface?: {id:string}; selection?: string[] } }[] = [];
      let receive: (frame: unknown) => void = () => {};
      const handle = { role: 'writer', self: { clientId: 'self', name: 'Ada' },
        adapter: { onLocalChange: () => [], apply: () => {}, applyRemotePatch: () => ({moved:[],restyled:[],added:[],removed:[],zChanged:[],frames:[]}), presence: () => {}, state: () => ({order:[], boxes:new Map(), params:new Map()}) },
        presenceIn: { subscribe: (fn: typeof receive) => { receive = fn; return () => {}; } }, sendPresence: (f: typeof sent[number]) => sent.push(f),
        events: { subscribe: () => () => {} }, close: () => {} };
      const mounted = await mountToolCollab({ handle, runtime, canvas, stage: document.querySelector('main'), colors: [] });
      receive({ v: 1, from: 'peer', epoch: 'peer', seq: 1, state: { userId: 'peer', name: 'Bob', color: '#336699', cursor: { x: .4, y: .5 }, surface: { id: active, space: 'unit' } } });
      const r = canvas.getBoundingClientRect();
      canvas.dispatchEvent(new PointerEvent('pointermove', { clientX: r.left+r.width*.25, clientY:r.top+r.height*.6 }));
      mounted.session.setFocus('title');
      await new Promise(r => setTimeout(r, 80));
      const moved = sent.at(-1)!.state;
      const cursor = document.querySelector<HTMLElement>('.collab-cursor')!;
      const cursorVisible = !!cursor && !cursor.hidden;
      canvas.dispatchEvent(new PointerEvent('pointerleave'));
      await new Promise(r => setTimeout(r, 80));
      const cleared = !sent.at(-1)!.state.cursor;
      active = 'board-b'; for (const fn of listeners) fn(); mounted.reanchor();
      await new Promise(r => setTimeout(r, 80));
      const otherBoardHidden = cursor.hidden;
      const unchanged = canvas.outerHTML === before;
      mounted.teardown(); off();
      return { worstError, moved, cursorVisible, cleared, otherBoardHidden, unchanged, writes, listeners: listeners.size,
        overlays: document.querySelectorAll('.collab-canvas-layer').length, viewStillPresent: view.isConnected };
    });
    assert.ok(result.worstError < .1, `projection error ${result.worstError}`);
    assert.ok(Math.abs(result.moved.cursor!.x - .25) < .001);
    assert.ok(Math.abs(result.moved.cursor!.y - .6) < .001);
    assert.equal(result.moved.focus, 'title'); assert.deepEqual(result.moved.selection, ['shape']);
    assert.equal(result.cursorVisible, true); assert.equal(result.cleared, true); assert.equal(result.otherBoardHidden, true);
    assert.equal(result.unchanged, true); assert.equal(result.writes, 0); assert.equal(result.listeners, 0); assert.equal(result.overlays, 0);
  } finally { await context.close(); await closeBrowser(); }
});

test('two tabs retain each other’s pending edits in the real IndexedDB outbox', { skip, timeout: 60_000 }, async () => {
  const browser = await getBrowser();
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto(origin!, { waitUntil: 'networkidle' }); await shellSettled(page);
    const result = await page.evaluate(async () => {
      const path = '/src/org/collab-provider.ts';
      const { defaultOutboxStore } = await import(path);
      const a = defaultOutboxStore(), b = defaultOutboxStore();
      const key = `collab-test:${crypto.randomUUID()}`;
      await Promise.all([a.load(key), b.load(key)]);
      const op = (id: string) => ({ k: 'param', key: 'title', value: id, origin: { client: id, clock: 1 }, deliveryId: id });
      await Promise.all([a.save(key, [op('a')]), b.save(key, [op('b')])]);
      const reader = defaultOutboxStore();
      const both = (await reader.load(key)).map((x: { deliveryId: string }) => x.deliveryId).sort();
      await a.clear(key);
      const afterA = (await reader.load(key)).map((x: { deliveryId: string }) => x.deliveryId);
      await b.clear(key);
      return { both, afterA, empty: await reader.load(key) };
    });
    assert.deepEqual(result, { both: ['a', 'b'], afterA: ['b'], empty: null });
  } finally { await context.close(); await closeBrowser(); }
});

test('the actual Design mount registers its active artboard for pointer presence', { skip, timeout: 90_000 }, async () => {
  const browser = await getBrowser();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors: string[] = []; page.on('console', msg => { if (msg.type() === 'warning' || msg.type() === 'error') errors.push(msg.text()); });
  try {
    await page.goto(origin!, { waitUntil: 'networkidle' }); await shellSettled(page);
    await page.evaluate(async (corePath) => {
      const sourcePath = '/src/lib/collab-session-source.ts';
      const { registerCollabSessionSource } = await import(sourcePath);
      const { ReferenceCanvasDoc } = await import(corePath);
      const state = { frames: [] as { state?: {cursor?: {x:number;y:number};surface?: {id:string};viewport?: {zoom:number}} }[], receive: (_f: unknown) => {} };
      Object.assign(window, { __collabDesignTest: state });
      registerCollabSessionSource(({ toolId }: { toolId: string }) => toolId === 'design' ? {
        role: 'writer', self: { clientId: 'browser-test', name: 'Ada' }, adapter: new ReferenceCanvasDoc('browser-test'),
        presenceIn: { subscribe: (fn: typeof state.receive) => { state.receive = fn; return () => {}; } },
        sendPresence: (frame: typeof state.frames[number]) => state.frames.push(frame),
        events: { subscribe: (fn: (s: string) => void) => { fn('live'); return () => {}; } }, close: () => {},
      } : null);
      window.location.hash = '#/tool/design?template=carousel';
    }, `/@fs${new URL('../packages/core/src/canvas-op-v1.ts', import.meta.url).pathname}`);
    await page.locator('#tool-canvas [data-frame-id]').first().waitFor({ timeout: 60_000 });
    await page.locator('.collab-pill').waitFor();
    await page.evaluate(() => {
      const s = (window as unknown as { __collabDesignTest: { receive: (f: unknown) => void } }).__collabDesignTest;
      s.receive({ v: 1, from: 'peer', epoch: 'peer', seq: 1, state: { userId: 'peer', name: 'Bob', color: '#336699' } });
    });
    const board = page.locator('#tool-canvas [data-frame-id]').first();
    await board.dispatchEvent('pointermove', await board.evaluate(el => {
      const r = el.getBoundingClientRect(); return { clientX: r.left + r.width*.4, clientY: r.top + r.height*.6, bubbles: true };
    }));
    await page.waitForFunction(() => {
      const s = (window as unknown as { __collabDesignTest: { frames: {state?: {cursor?: unknown;surface?: unknown}}[] } }).__collabDesignTest;
      return s.frames.some(f => f.state?.cursor && f.state?.surface);
    });
    const frame = await page.evaluate(() => {
      const s = (window as unknown as { __collabDesignTest: { frames: { state?: { cursor?: {x:number;y:number};surface?: {id:string};viewport?: {zoom:number} } }[] } }).__collabDesignTest;
      return s.frames.findLast(f => f.state?.cursor)!.state!;
    });
    assert.ok(frame.surface?.id); assert.ok(frame.viewport!.zoom > 0);
    assert.ok(Math.abs(frame.cursor!.x - .4) < .01); assert.ok(Math.abs(frame.cursor!.y - .6) < .01);
  } catch (error) {
    console.error('Design cursor diagnostics', errors, await page.evaluate(() => ({ frames: (window as unknown as {__collabDesignTest?: unknown}).__collabDesignTest, framesDom: [...document.querySelectorAll('[data-frame-id]')].map(el => ({ id: el.getAttribute('data-frame-id'), rect: el.getBoundingClientRect().toJSON() })), pill: document.querySelector('.collab-pill')?.textContent })));
    throw error;
  } finally { await context.close(); await closeBrowser(); }
});
