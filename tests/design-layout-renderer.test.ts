// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { createNodeLayout } from '../packages/node-shell/src/layout-host-node.ts';
import { buildLollyFile, readLollyFile } from '../shells/web/src/lib/lolly-pack.ts';
import { readLollyFile as readNodeLolly } from '../packages/node-shell/src/lolly-file.ts';
import { buildInputModel } from '../engine/src/inputs.ts';
import { parseUrlState, serializeUrlState } from '../engine/src/url-mode.ts';
import { compileDesignTool } from '../engine/src/design-tool/compiler.ts';
import { createMockHost } from '@lolly-tools/core';
import { loadTool, type ToolManifest } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { createNodeHookExecutor } from '../packages/node-shell/src/hook-worker.ts';
import type { DesignToolDefinitionV1 } from '@lolly-tools/core/design-tool-v1';
const layout = await createNodeLayout();
const source = await readFile('community/design/hooks.js', 'utf8');
const renderer = (host: object) =>
  new Function(
    'host',
    source +
      ';return {compute:compute,beforeExport:typeof beforeExport!=="undefined"?beforeExport:null};'
  )(host);
const rows = () => [
  {
    id: 'root',
    kind: 'box',
    x: 0,
    y: 0,
    w: 300,
    h: 20,
    layout: 'flex',
    layoutDirection: 'column',
    layoutH: 'hug',
  },
  {
    id: 'copy',
    kind: 'text',
    layoutOwner: 'root',
    x: 100,
    y: 50,
    w: 40,
    h: 20,
    layoutW: 'fill',
    layoutH: 'hug',
    font: 'sans',
    fontSize: 24,
    text: 'A sentence that wraps when this card becomes narrower.',
  },
  { id: 'footer', kind: 'box', layoutOwner: 'root', x: 100, y: 50, w: 60, h: 30 },
];
const model = (boxes: object[], tracks: object[] = [], extra: object[] = []) => [
  { id: 'boxes', value: boxes },
  { id: 'layoutTracks', value: tracks },
  ...extra,
];
test('shared renderer measures real font bytes, retains source and recomputes width-dependent content', async () => {
  const hooks = renderer({ layout }),
    boxes = rows(),
    before = structuredClone(boxes);
  const wide = await hooks.compute(model(boxes));
  const wideBoxes = JSON.parse(wide.layoutBoxesJson);
  const narrow = await hooks.compute(
    model(boxes.map((b) => (b.id === 'root' ? { ...b, w: 100 } : b)))
  );
  const narrowBoxes = JSON.parse(narrow.layoutBoxesJson);
  assert.deepEqual(boxes, before);
  assert.equal(wide.boxes, undefined);
  assert.equal(wideBoxes[1].w, 300);
  assert.equal(narrowBoxes[1].w, 100);
  assert.ok(narrowBoxes[1].h > wideBoxes[1].h);
  assert.equal(narrowBoxes[2].y, narrowBoxes[1].h);
  assert.notEqual(wide.layoutReceipt, narrow.layoutReceipt);
});
test('composed stories and layout settle using the allocation without persisting temporary geometry', async () => {
  const text = {
    layoutRuns: async (request: {
      frames: Array<{ id: string; width: number; height: number }>;
    }) => ({
      frames: request.frames.map((f) => ({
        ...f,
        height: f.width < 200 ? 80 : 40,
        svg: '<svg data-text-layout="abcdef"></svg>',
      })),
      diagnostics: [],
    }),
  };
  const hooks = renderer({ layout, text }),
    boxes = rows().map((b) =>
      b.id === 'copy'
        ? { ...b, text: '', textStory: 'story', textFrame: JSON.stringify({ mode: 'auto-height' }) }
        : b
    );
  const document = {
    styles: [],
    fonts: [],
    stories: [{ id: 'story', frameIds: ['copy'], source: 'Hello' }],
  };
  const wide = await hooks.compute(
    model(boxes, [], [{ id: 'textDocument', value: JSON.stringify(document) }])
  );
  const narrow = await hooks.compute(
    model(
      boxes.map((b) => (b.id === 'root' ? { ...b, w: 100 } : b)),
      [],
      [{ id: 'textDocument', value: JSON.stringify(document) }]
    )
  );
  assert.equal(JSON.parse(wide.layoutBoxesJson)[2].y, 40);
  assert.equal(JSON.parse(narrow.layoutBoxesJson)[2].y, 80);
  assert.equal(wide.boxes, undefined);
  assert.equal(JSON.parse(wide.layoutSourceJson)[1].h, 20);
});
test('dynamic sessions round-trip through URL and .lolly with a reader gate; static files keep their floor', async () => {
  const manifest = JSON.parse(await readFile('community/design/tool.json', 'utf8')) as ToolManifest;
  const boxes = rows(),
    tracks = [{ id: 't', container: 'grid', axis: 'column', order: 0, track: '1fr' }];
  const values = { boxes, layoutTracks: tracks };
  const decoded = parseUrlState(
    serializeUrlState(buildInputModel(manifest, { initial: values })),
    manifest
  ).values;
  assert.equal((decoded.boxes as typeof boxes)[0]!.layout, 'flex');
  assert.deepEqual(
    decoded.layoutTracks,
    tracks.map((t) => ({ ...t, order: String(t.order) }))
  );
  const session = { values };
  const packed = await buildLollyFile({ toolId: 'design', session, userAssets: [] });
  assert.equal(packed.manifest.minReader, 6);
  const bytes = new Uint8Array(await packed.blob.arrayBuffer());
  assert.deepEqual((await readLollyFile(bytes)).session, session);
  assert.deepEqual(readNodeLolly(bytes).session, session);
  const old = await buildLollyFile({
    toolId: 'design',
    session: { values: { boxes: [{ id: 'old', x: 0, y: 0, w: 10, h: 10 }] } },
    userAssets: [],
  });
  assert.equal(old.manifest.minReader, 1);
});
test('downloaded generated tools retain live layout rules through strict worker RPC', async () => {
  const definition: DesignToolDefinitionV1 = {
    schemaVersion: 1,
    compilerVersion: 1,
    rendererDigest: 'fixture',
    css: '',
    dependencies: [],
    id: 'live-layout-fixture',
    name: 'Live layout',
    version: '1.0.0',
    presentation: 'sidebar',
    formats: ['png'],
    defaultVariant: 'card',
    variants: [
      { id: 'card', label: 'Card', width: 300, height: 400, background: '#fff', boxes: rows() },
    ],
    inputs: [
      {
        input: {
          id: 'cardcopy',
          label: 'Copy',
          type: 'longtext',
          default: 'Hello',
          maxLength: 500,
        },
        targets: [{ variantId: 'card', layerId: 'copy', property: 'text' }],
      },
    ],
    choices: [],
    recipes: [],
  };
  const compiled = compileDesignTool(definition, {
    source: await readFile('community/design/assets/rules-renderer.js', 'utf8'),
    styles: '',
  });
  const pack = await buildLollyFile({
    kind: 'tool',
    session: null,
    toolId: definition.id,
    userAssets: [],
    tool: {
      id: definition.id,
      trust: 'custom',
      files: Object.fromEntries(
        Object.entries(compiled.files).map(([p, v]) => [
          p,
          typeof v === 'string' ? new TextEncoder().encode(v) : v,
        ])
      ),
    },
  });
  assert.equal(pack.manifest.minReader, 6);
  assert.equal(
    readNodeLolly(new Uint8Array(await pack.blob.arrayBuffer()), { allowTool: true }).manifest.kind,
    'tool'
  );
  const tool = await loadTool(
    definition.id,
    async (p) => String(compiled.files[p.slice(definition.id.length + 1)] || ''),
    { trustClass: 'sideloaded-consented' }
  );
  const host = createMockHost();
  host.layout = layout;
  const runtime = await createRuntime(tool, host, undefined, {
    hookExecutor: createNodeHookExecutor({ strict: true }),
  });
  try {
    assert.deepEqual(runtime.hookErrors, []);
    const initial = runtime.getHydrated();
    await runtime.setInput('cardcopy', 'A much longer paragraph. '.repeat(12));
    assert.deepEqual(runtime.hookErrors, []);
    assert.notEqual(runtime.getHydrated(), initial);
    assert.match(runtime.getHydrated(), /data-layout-receipt="[0-9a-f]+:[0-9a-f]+"/);
    assert.equal(definition.variants[0]!.boxes[1]!.x, 100);
  } finally {
    runtime.destroy();
  }
});

test('exports require the current painted layout, and invalid merged ownership is visible', async () => {
  const { JSDOM } = await import('jsdom');
  const tool = await loadTool('design', (p) => readFile(`community/${p}`, 'utf8'));
  const host = createMockHost();
  host.layout = layout;
  let exported = 0;
  host.export.render = async () => {
    exported++;
    return new Blob(['ok']);
  };
  const boxes = rows().map((b) =>
    b.id === 'copy' ? { ...b, text: '', kind: 'box', layoutH: 'fixed' } : b
  );
  const runtime = await createRuntime(tool, host, { boxes });
  try {
    const old = new JSDOM(runtime.getHydrated()).window.document.body;
    await runtime.export(old, 'png', { c2pa: false });
    assert.equal(exported, 1);
    await runtime.setInput(
      'boxes',
      boxes.map((b) => (b.id === 'root' ? { ...b, w: 150 } : b))
    );
    await assert.rejects(
      () => runtime.export(old, 'png', { c2pa: false }),
      /Layout is still changing/
    );
    assert.equal(exported, 1);
    const fresh = new JSDOM(runtime.getHydrated()).window.document.body;
    await runtime.export(fresh, 'svg', { c2pa: false });
    assert.equal(exported, 2);
    await runtime.setInput(
      'boxes',
      boxes.map((b) => (b.id === 'root' ? { ...b, layoutOwner: 'root' } : b))
    );
    assert.match(runtime.getHydrated(), /role="alert"/);
    assert.match(runtime.getHydrated(), /cycle/);
    await assert.rejects(() => runtime.export(fresh, 'png', { c2pa: false }), /cycle/);
    assert.equal(exported, 2);
    await runtime.setInput('boxes', boxes);
    assert.doesNotMatch(runtime.getHydrated(), /lolly-layout-error/);
  } finally {
    runtime.destroy();
  }
});

test('incremental content paint equals a full render and refuses omitted coupled geometry', async () => {
  const { JSDOM } = await import('jsdom');
  const { patchCanvasContent } = await import('../shells/web/src/views/canvas-content.ts');
  const { projectCanvasLayoutBoxes } = await import(
    '../shells/web/src/views/canvas-layout-projection.ts'
  );
  const { contentPatchPlan } = await import('../shells/web/src/views/canvas-content-plan.ts');
  const tool = await loadTool('design', (p) => readFile(`community/${p}`, 'utf8'));
  const host = createMockHost();
  host.layout = layout;
  const source = rows(),
    runtime = await createRuntime(tool, host, { boxes: source });
  try {
    const previous = runtime.getHydrated(),
      live = new JSDOM('<main></main>').window.document.querySelector('main')!;
    live.innerHTML = previous;
    const projected = projectCanvasLayoutBoxes(
      source,
      runtime.getHydratedText('{{{layoutBoxesJson}}}'),
      runtime.getHydratedText('{{{layoutSourceJson}}}')
    );
    assert.notEqual(projected, source);
    const changed = source.map((b) =>
      b.id === 'copy' ? { ...b, text: 'A long paragraph. '.repeat(40) } : b
    );
    await runtime.setInput('boxes', changed);
    const next = runtime.getHydrated();
    const evaluated = projectCanvasLayoutBoxes(
      changed,
      runtime.getHydratedText('{{{layoutBoxesJson}}}'),
      runtime.getHydratedText('{{{layoutSourceJson}}}')
    );
    assert.equal(patchCanvasContent(live, previous, next, ['copy']), false);
    const unchanged = new JSDOM('<main></main>').window.document.querySelector('main')!;
    unchanged.innerHTML = previous;
    assert.equal(live.innerHTML, unchanged.innerHTML);
    const plan = contentPatchPlan(projected, evaluated, {
      field: {
        idField: 'id',
        xField: 'x',
        yField: 'y',
        wField: 'w',
        hField: 'h',
        rotationField: 'rot',
      },
      kindField: 'kind',
      frameField: 'frame',
    } as Parameters<typeof contentPatchPlan>[2]);
    assert.ok(plan?.includes('footer'));
    assert.ok(plan?.includes('root'));
    assert.equal(patchCanvasContent(live, previous, next, plan!), true);
    const expected = new JSDOM('<main></main>').window.document.querySelector('main')!;
    expected.innerHTML = next;
    assert.equal(live.innerHTML, expected.innerHTML);
    assert.equal(
      projectCanvasLayoutBoxes(changed, runtime.getHydratedText('{{{layoutBoxesJson}}}'), 'stale'),
      changed
    );
  } finally {
    runtime.destroy();
  }
});
