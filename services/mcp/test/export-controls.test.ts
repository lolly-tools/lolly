// SPDX-License-Identifier: MPL-2.0
/**
 * The reserved-param export controls on lolly_render / lolly_build_url.
 *
 * These exist in the URL surface (and so on the CLI and in any share link) long
 * before they existed here: bleed, printer's marks, contact sheets, bit depth,
 * HDR, and the two provenance marks. An agent could not ask for a press-ready
 * PDF or a float-depth render through MCP at all, which is the gap these close.
 *
 * The property under test is agreement, not plumbing: a link built from a set of
 * arguments has to describe the same file a render from those arguments
 * produces. If the two drift, an agent hands a person a link that opens
 * something other than what the agent saw.
 *
 * Browser-free throughout. Nothing here needs Chromium.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dispatch } from '../src/server.ts';
import type { JsonRpcResponse } from '../src/protocol.ts';

let nextId = 1;
async function callTool(name: string, args: Record<string, unknown>): Promise<string> {
  const res = (await dispatch({
    jsonrpc: '2.0', id: nextId++, method: 'tools/call', params: { name, arguments: args },
  })) as JsonRpcResponse;
  assert.ok(!res.error, `${name} errored: ${JSON.stringify(res.error)}`);
  const r = res.result as { content: { type: string; text?: string }[]; isError?: boolean };
  assert.ok(!r.isError, `${name} isError: ${JSON.stringify(r.content)}`);
  return r.content.filter(c => c.type === 'text').map(c => c.text ?? '').join('\n');
}

/** The query of the editable link, which is what a person opens. */
function linkQuery(text: string): URLSearchParams {
  const m = /https?:\/\/\S+/.exec(text);
  assert.ok(m, `no link in:\n${text}`);
  const hash = new URL(m[0]).hash;
  return new URLSearchParams(hash.slice(hash.indexOf('?') + 1));
}

test('lolly_render declares the export controls agents could not reach before', async () => {
  const res = (await dispatch({ jsonrpc: '2.0', id: nextId++, method: 'tools/list' })) as JsonRpcResponse;
  const tools = (res.result as { tools: { name: string; inputSchema: { properties: Record<string, unknown> } }[] }).tools;
  const render = tools.find(t => t.name === 'lolly_render');
  assert.ok(render, 'lolly_render is registered');
  for (const k of ['depth', 'hdr', 'bleed', 'marks', 'cuts', 'imprint', 'durable']) {
    assert.ok(k in render!.inputSchema.properties, `lolly_render must accept ${k}`);
  }
  // The same controls belong on the link builder: a link that drops the press
  // setup opens a different document than the one the agent rendered.
  const url = tools.find(t => t.name === 'lolly_build_url');
  for (const k of ['depth', 'bleed', 'marks', 'imprint', 'durable']) {
    assert.ok(k in url!.inputSchema.properties, `lolly_build_url must accept ${k}`);
  }
});

test('the press setup rides the link it hands back', async () => {
  const text = await callTool('lolly_build_url', {
    toolId: 'qr-code',
    inputs: { url: 'https://lolly.tools' },
    format: 'pdf',
    bleed: '3mm',
    marks: 'crop,registration',
    depth: '16',
    durable: true,
  });
  const q = linkQuery(text);
  assert.equal(q.get('bleed'), '3mm');
  assert.equal(q.get('marks'), 'crop,registration');
  assert.equal(q.get('depth'), '16');
  assert.equal(q.get('durable'), '1');
});

test('the two default-on marks only ever write an opt-OUT', async () => {
  // imprint is on by default, so a link that says nothing means "on". Writing
  // imprint=1 on every link would be noise, and worse, would make the absence
  // of the param look like a choice.
  const plain = linkQuery(await callTool('lolly_build_url', {
    toolId: 'qr-code', inputs: { url: 'https://lolly.tools' },
  }));
  assert.equal(plain.get('imprint'), null, 'the default writes nothing');
  assert.equal(plain.get('durable'), null, 'opt-in, so absent means off');

  const off = linkQuery(await callTool('lolly_build_url', {
    toolId: 'qr-code', inputs: { url: 'https://lolly.tools' }, imprint: false,
  }));
  assert.equal(off.get('imprint'), '0', 'an explicit opt-out is recorded');
});

test('hdr rides the link as a presence flag, and junk dials fall back to the defaults', async () => {
  const q = linkQuery(await callTool('lolly_build_url', {
    toolId: 'qr-code', inputs: { url: 'https://lolly.tools' }, format: 'png',
    // Deliberately partial and partly unusable: an agent that sends one dial, or
    // a string where a number belongs, gets the engine's defaults for the rest
    // rather than four zeroes (which would be a real, very dark, HDR request).
    hdr: { peakNits: 4000, reach: 'bright' as unknown as number },
  }));
  assert.equal(q.get('hdr'), '1');
});

test('a depth of auto is not a request, and never dirties the link', async () => {
  const q = linkQuery(await callTool('lolly_build_url', {
    toolId: 'qr-code', inputs: { url: 'https://lolly.tools' }, depth: 'auto',
  }));
  assert.equal(q.get('depth'), null, "'auto' is the default - nothing to override");
});

test('a contact sheet of one frame is the ordinary render, so it writes nothing', async () => {
  const one = linkQuery(await callTool('lolly_build_url', {
    toolId: 'qr-code', inputs: { url: 'https://lolly.tools' }, cuts: 1,
  }));
  assert.equal(one.get('cuts'), null);
  const many = linkQuery(await callTool('lolly_build_url', {
    toolId: 'qr-code', inputs: { url: 'https://lolly.tools' }, cuts: 6,
  }));
  assert.equal(many.get('cuts'), '6');
});

test('a rendered file and the link returned beside it carry the same setup', async () => {
  // The whole point of threading these through ONE reader: the header a render
  // hands back includes the editable link, and that link has to describe the
  // file the agent just received.
  const text = await callTool('lolly_render', {
    toolId: 'qr-code',
    inputs: { url: 'https://lolly.tools' },
    format: 'svg',
    bleed: '5mm',
    marks: 'crop',
    imprint: false,
  });
  const q = linkQuery(text);
  assert.equal(q.get('bleed'), '5mm');
  assert.equal(q.get('marks'), 'crop');
  assert.equal(q.get('imprint'), '0');
});
