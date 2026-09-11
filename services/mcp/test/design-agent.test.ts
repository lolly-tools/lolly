// SPDX-License-Identifier: MPL-2.0

import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { JsonRpcResponse } from '../src/protocol.ts';
import { dispatch } from '../src/server.ts';

let nextId = 19_700;
async function call(
  name: string,
  args: Record<string, unknown>
): Promise<{ content: Array<{ text?: string }>; isError?: boolean }> {
  const response = (await dispatch({
    jsonrpc: '2.0',
    id: nextId++,
    method: 'tools/call',
    params: { name, arguments: args },
  })) as JsonRpcResponse;
  assert.ok(response && !response.error, JSON.stringify(response?.error));
  return response.result as never;
}

test('Design describe exposes templates and a strict blocks schema', async () => {
  const result = await call('lolly_describe_tool', { toolId: 'design' });
  assert.equal(result.isError, undefined);
  const doc = JSON.parse(result.content[0]!.text!) as any;
  assert.ok(doc.templates.length >= 12);
  assert.ok(doc.templates.some((item: any) => item.id === 'slide-deck'));
  assert.equal(doc.inputSchema.properties.boxes.items.additionalProperties, false);
  assert.ok(
    Array.isArray(doc.inputSchema.properties.boxes.items.properties.start.anyOf),
    'optional numeric sentinel is explicit'
  );
});

test('every advertised Design template and preset passes the strict boundary', async () => {
  const described = await call('lolly_describe_tool', { toolId: 'design' });
  const doc = JSON.parse(described.content[0]!.text!) as any;
  for (const template of doc.templates as any[]) {
    const variants = [undefined, ...(template.presets ?? []).map((preset: any) => preset.id)];
    for (const presetId of variants) {
      const result = await call('lolly_validate', {
        toolId: 'design',
        templateId: template.id,
        ...(presetId ? { presetId } : {}),
      });
      assert.equal(result.isError, undefined, `${template.id}/${presetId ?? 'default'}`);
      const report = JSON.parse(result.content[0]!.text!) as any;
      assert.equal(
        report.ok,
        true,
        `${template.id}/${presetId ?? 'default'}: ${JSON.stringify(report.errors)}`
      );
    }
  }
});

test('lolly_validate reports unknown top-level and block fields with paths', async () => {
  const result = await call('lolly_validate', {
    toolId: 'design',
    inputs: {
      typo: true,
      boxes: [{ id: 'box-1', kind: 'box', x: 0, y: 0, w: 100, h: 100, widht: 80 }],
    },
  });
  const report = JSON.parse(result.content[0]!.text!) as any;
  assert.equal(report.ok, false);
  assert.ok(report.errors.some((item: any) => item.path === '/typo'));
  assert.ok(report.errors.some((item: any) => item.path === '/boxes/0/widht'));
});

test('strict MCP verbs reject malformed inputs instead of falling back', async () => {
  const result = await call('lolly_build_url', {
    toolId: 'design',
    inputs: { boxes: [{ id: 'box-1', kind: 'box', x: 0, y: 0, w: 100, h: 100, widht: 80 }] },
  });
  assert.equal(result.isError, true);
  assert.match(result.content[0]!.text!, /\/boxes\/0\/widht: unknown field/);
});

test('Design optional empty numeric and boolean sentinels remain compatible', async () => {
  const result = await call('lolly_validate', {
    toolId: 'design',
    inputs: {
      boxes: [
        {
          id: 'caption',
          kind: 'text',
          x: 0,
          y: 0,
          w: 400,
          h: 80,
          text: 'Hello',
          start: '',
          dur: '',
          varispeed: '',
        },
      ],
    },
  });
  const report = JSON.parse(result.content[0]!.text!) as any;
  assert.equal(report.ok, true, JSON.stringify(report.errors));
});

test('agents can inspect a template preset without supplying box coordinates', async () => {
  const result = await call('lolly_validate', {
    toolId: 'design',
    templateId: 'poster',
    presetId: 'square',
  });
  const report = JSON.parse(result.content[0]!.text!) as any;
  assert.equal(report.ok, true, JSON.stringify(report.errors));
  assert.deepEqual(report.template, { id: 'poster', name: 'Poster', preset: 'square' });
  assert.equal(report.design.summary.artboards, 1);
  assert.deepEqual(report.design.artboards[0].bounds, {
    x: 0,
    y: 0,
    width: 1080,
    height: 1080,
    rotation: 0,
  });
});

test('agents can customize and inspect a three-slide template by stable layer id', async () => {
  const result = await call('lolly_inspect', {
    toolId: 'design',
    templateId: 'slide-deck',
    layerPatches: [{ id: 's1title', set: { text: 'Agent-authored launch' } }],
  });
  assert.equal(result.isError, undefined);
  const report = JSON.parse(result.content[0]!.text!) as any;
  assert.equal(report.design.summary.artboards, 3);
  assert.equal(
    report.design.layers.find((layer: any) => layer.id === 's1title')?.text,
    'Agent-authored launch'
  );
});

test('agents can add, patch and reorder a layer by stable ids in one request', async () => {
  const result = await call('lolly_inspect', {
    toolId: 'design',
    templateId: 'slide-deck',
    layerOperations: [
      {
        op: 'add',
        layer: { id: 's1kicker', kind: 'text', frame: 'slide1', text: 'Draft', h: 64 },
        afterId: 's1title',
      },
    ],
    layerPatches: [{ id: 's1kicker', set: { text: 'Agent-added context' } }],
  });
  assert.equal(result.isError, undefined);
  const report = JSON.parse(result.content[0]!.text!) as any;
  const firstSlide = report.design.artboards.find((frame: any) => frame.id === 'slide1');
  assert.deepEqual(firstSlide.childLayerIds, ['s1accent', 's1title', 's1kicker', 's1body']);
  const added = report.design.layers.find((layer: any) => layer.id === 's1kicker');
  assert.equal(added.text, 'Agent-added context');
  assert.equal(added.zIndex, 2);
  assert.deepEqual(added.bounds, { x: 120, y: 120, width: 320, height: 64, rotation: 0 });
});

test('agents can duplicate and patch a layer with an explicit stable id', async () => {
  const result = await call('lolly_inspect', {
    toolId: 'design',
    templateId: 'slide-deck',
    layerOperations: [
      { op: 'duplicate', id: 's1title', newId: 's1title-copy', afterId: 's1title' },
    ],
    layerPatches: [{ id: 's1title-copy', set: { text: 'A second stable headline' } }],
  });
  assert.equal(result.isError, undefined);
  const report = JSON.parse(result.content[0]!.text!) as any;
  const firstSlide = report.design.artboards.find((frame: any) => frame.id === 'slide1');
  assert.deepEqual(firstSlide.childLayerIds, ['s1accent', 's1title', 's1title-copy', 's1body']);
  const clone = report.design.layers.find((layer: any) => layer.id === 's1title-copy');
  assert.equal(clone.text, 'A second stable headline');
  assert.equal(clone.artboardId, 'slide1');
});

test('agents can duplicate an artboard only with a complete stable child-id map', async () => {
  const result = await call('lolly_inspect', {
    toolId: 'design',
    templateId: 'slide-deck',
    layerOperations: [
      {
        op: 'duplicate',
        id: 'slide1',
        newId: 'slide1-copy',
        childIds: {
          s1accent: 's1accent-copy',
          s1title: 's1title-copy',
          s1body: 's1body-copy',
        },
        afterId: 'slide1',
      },
    ],
  });
  assert.equal(result.isError, undefined);
  const report = JSON.parse(result.content[0]!.text!) as any;
  assert.equal(report.design.summary.artboards, 4);
  const clone = report.design.artboards.find((frame: any) => frame.id === 'slide1-copy');
  assert.deepEqual(clone.childLayerIds, ['s1accent-copy', 's1title-copy', 's1body-copy']);
  assert.ok(
    clone.childLayerIds.every(
      (id: string) =>
        report.design.layers.find((layer: any) => layer.id === id)?.artboardId === 'slide1-copy'
    )
  );

  const missing = await call('lolly_validate', {
    toolId: 'design',
    templateId: 'slide-deck',
    layerOperations: [
      { op: 'duplicate', id: 'slide1', newId: 'slide1-copy', childIds: { s1title: 'new-title' } },
    ],
  });
  assert.equal(missing.isError, true);
  assert.match(missing.content[0]!.text!, /childIds\/s1accent: a new stable layer id is required/);

  const collision = await call('lolly_validate', {
    toolId: 'design',
    templateId: 'slide-deck',
    layerOperations: [
      {
        op: 'duplicate',
        id: 'slide1',
        newId: 'slide1-copy',
        childIds: { s1accent: 's2title', s1title: 'new-title', s1body: 'new-body' },
      },
    ],
  });
  assert.equal(collision.isError, true);
  assert.match(collision.content[0]!.text!, /layer "s2title" already exists/);
});

test('agents can reparent a layer with deterministic destination ordering', async () => {
  const result = await call('lolly_inspect', {
    toolId: 'design',
    templateId: 'slide-deck',
    layerOperations: [{ op: 'reparent', id: 's1body', artboardId: 'slide2', afterId: 's2title' }],
    layerPatches: [{ id: 's1body', set: { x: 2300 } }],
  });
  assert.equal(result.isError, undefined);
  const report = JSON.parse(result.content[0]!.text!) as any;
  assert.deepEqual(
    report.design.artboards.find((frame: any) => frame.id === 'slide1').childLayerIds,
    ['s1accent', 's1title']
  );
  assert.deepEqual(
    report.design.artboards.find((frame: any) => frame.id === 'slide2').childLayerIds,
    ['s2accent', 's2title', 's1body', 's2body']
  );
  const moved = report.design.layers.find((layer: any) => layer.id === 's1body');
  assert.equal(moved.artboardId, 'slide2');
  assert.equal(moved.bounds.x, 2300);

  const pasteboard = await call('lolly_inspect', {
    toolId: 'design',
    templateId: 'slide-deck',
    layerOperations: [{ op: 'reparent', id: 's1body', artboardId: null }],
  });
  assert.equal(pasteboard.isError, undefined);
  const pasteboardReport = JSON.parse(pasteboard.content[0]!.text!) as any;
  assert.ok(pasteboardReport.design.looseLayerIds.includes('s1body'));
});

test('reparent rejects artboards and non-artboard destinations', async () => {
  const artboard = await call('lolly_validate', {
    toolId: 'design',
    templateId: 'slide-deck',
    layerOperations: [{ op: 'reparent', id: 'slide1', artboardId: 'slide2' }],
  });
  assert.equal(artboard.isError, true);
  assert.match(artboard.content[0]!.text!, /artboards cannot be reparented/);

  const destination = await call('lolly_validate', {
    toolId: 'design',
    templateId: 'slide-deck',
    layerOperations: [{ op: 'reparent', id: 's1body', artboardId: 's2title' }],
  });
  assert.equal(destination.isError, true);
  assert.match(destination.content[0]!.text!, /is not an artboard/);
});

test('removing a non-empty artboard requires cascade and cascade removes its children', async () => {
  const unsafe = await call('lolly_validate', {
    toolId: 'design',
    templateId: 'slide-deck',
    layerOperations: [{ op: 'remove', id: 'slide1' }],
  });
  assert.equal(unsafe.isError, true);
  assert.match(unsafe.content[0]!.text!, /cascade.*3 child layers/);

  const cascaded = await call('lolly_inspect', {
    toolId: 'design',
    templateId: 'slide-deck',
    layerOperations: [{ op: 'remove', id: 'slide1', cascade: true }],
  });
  assert.equal(cascaded.isError, undefined);
  const report = JSON.parse(cascaded.content[0]!.text!) as any;
  assert.equal(report.design.summary.artboards, 2);
  assert.ok(
    !report.design.layers.some(
      (layer: any) => layer.id === 'slide1' || layer.artboardId === 'slide1'
    )
  );
});

test('layer operations reject ambiguous anchors, cross-artboard reorder and unknown fields', async () => {
  const anchors = await call('lolly_validate', {
    toolId: 'design',
    templateId: 'slide-deck',
    layerOperations: [{ op: 'reorder', id: 's1title', beforeId: 's1body', afterId: 's1accent' }],
  });
  assert.equal(anchors.isError, true);
  assert.match(anchors.content[0]!.text!, /provide exactly one/);

  const crossBoard = await call('lolly_validate', {
    toolId: 'design',
    templateId: 'slide-deck',
    layerOperations: [{ op: 'reorder', id: 's1title', beforeId: 's2title' }],
  });
  assert.equal(crossBoard.isError, true);
  assert.match(crossBoard.content[0]!.text!, /must be sibling layers/);

  const unknown = await call('lolly_validate', {
    toolId: 'design',
    templateId: 'poster',
    layerOperations: [{ op: 'remove', id: 'title', force: true }],
  });
  assert.equal(unknown.isError, true);
  assert.match(unknown.content[0]!.text!, /\/layerOperations\/0\/force: unknown remove field/);
});

test('layer patches reject missing ids, id changes and unknown Design fields', async () => {
  const missing = await call('lolly_validate', {
    toolId: 'design',
    templateId: 'poster',
    layerPatches: [{ id: 'not-there', set: { text: 'Nope' } }],
  });
  assert.equal(missing.isError, true);
  assert.match(missing.content[0]!.text!, /layer "not-there" does not exist/);

  const renamed = await call('lolly_validate', {
    toolId: 'design',
    templateId: 'poster',
    layerPatches: [{ id: 'title', set: { id: 'new-title' } }],
  });
  assert.equal(renamed.isError, true);
  assert.match(renamed.content[0]!.text!, /stable layer id cannot be changed/);

  const unknown = await call('lolly_validate', {
    toolId: 'design',
    templateId: 'poster',
    layerPatches: [{ id: 'title', set: { tehxt: 'Nope' } }],
  });
  const validation = JSON.parse(unknown.content[0]!.text!) as any;
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.some((item: any) => item.path.endsWith('/tehxt')));
});

test('unknown templates and presets fail loudly', async () => {
  const missingTemplate = await call('lolly_validate', {
    toolId: 'design',
    templateId: 'not-a-template',
  });
  assert.equal(missingTemplate.isError, true);
  assert.match(missingTemplate.content[0]!.text!, /Template not found/);

  const missingPreset = await call('lolly_validate', {
    toolId: 'design',
    templateId: 'poster',
    presetId: 'not-a-preset',
  });
  assert.equal(missingPreset.isError, true);
  assert.match(missingPreset.content[0]!.text!, /Preset not found/);
});
