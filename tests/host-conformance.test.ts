// SPDX-License-Identifier: MPL-2.0
/**
 * The host conformance kit (packages/core/src/host-conformance.ts): its method
 * tables agree with the HostV1 interfaces, the mock host passes it, a broken
 * host fails it with the member named, and the CLI bridge - a real shell -
 * conforms.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runHostConformance, formatConformance, HOST_V1_METHODS, HOST_V1_REQUIRED_APIS } from '../packages/core/src/host-conformance.ts';
import { HOST_V1_OPTIONAL_APIS, presentApis, missingRequires } from '../packages/core/src/host-v1/apis.ts';
import { createMockHost, withOptionalStubs } from '../packages/core/src/mock-host.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const API_FILE: Record<string, string> = {
  profile: 'profile', assets: 'assets', state: 'state', clipboard: 'clipboard', export: 'export',
  net: 'net', tokens: 'tokens', text: 'text', pdf: 'pdf', pptx: 'pptx', capture: 'capture', compose: 'compose',
  media: 'media', scan: 'scan', lift: 'lift', keyframes: 'keyframes', recorder: 'recorder', audio: 'audio',
  codec: 'codec', layers: 'layers', upscale: 'upscale', matte: 'matte', ocr: 'ocr', speech: 'speech', viz: 'viz',
  color: 'color', images: 'images', raster: 'raster', geom: 'geom', connectors: 'connectors', c2pa: 'c2pa',
};
const API_INTERFACE: Record<string, string> = {
  profile: 'ProfileAPI', assets: 'AssetsAPI', state: 'StateAPI', clipboard: 'ClipboardAPI', export: 'ExportAPI',
  net: 'NetAPI', tokens: 'TokensAPI', text: 'TextAPI', pdf: 'PdfAPI', pptx: 'PptxAPI', capture: 'CaptureAPI',
  compose: 'ComposeAPI', media: 'MediaAPI', scan: 'ScanAPI', lift: 'LiftAPI', keyframes: 'KeyframesAPI',
  recorder: 'RecorderAPI', audio: 'AudioAPI', codec: 'CodecAPI', layers: 'LayersAPI', upscale: 'UpscaleAPI',
  matte: 'MatteAPI', ocr: 'OcrAPI', speech: 'SpeechAPI', viz: 'VizAPI', color: 'ColorAPI', images: 'ImagesAPI',
  raster: 'RasterAPI', geom: 'GeomAPI', connectors: 'ConnectorsAPI', c2pa: 'C2paAPI',
};

/** Method names of one interface body, split by optionality, read off the source. */
function interfaceMethods(file: string, name: string): { required: string[]; optional: string[] } {
  const src = readFileSync(join(ROOT, 'packages/core/src/host-v1', `${file}.ts`), 'utf8');
  const m = new RegExp(`export interface ${name}\\s*\\{([\\s\\S]*?)\\n\\}`).exec(src);
  assert.ok(m, `${name} interface found in ${file}.ts`);
  const required: string[] = [];
  const optional: string[] = [];
  for (const line of m[1]!.split('\n')) {
    const mm = /^\s{2}(?:readonly\s+)?(\w+)(\??)\s*(?:[(<]|:\s*\()/.exec(line);
    if (!mm) continue;
    (mm[2] ? optional : required).push(mm[1]!);
  }
  return { required, optional };
}

test('the method tables match the HostV1 interfaces member for member', () => {
  const apis = [...HOST_V1_REQUIRED_APIS, ...HOST_V1_OPTIONAL_APIS];
  for (const api of apis) {
    const fromSource = interfaceMethods(API_FILE[api]!, API_INTERFACE[api]!);
    const table = HOST_V1_METHODS[api];
    assert.deepEqual([...table.required].sort(), [...fromSource.required].sort(), `${api}: required members`);
    assert.deepEqual([...table.optional].sort(), [...fromSource.optional].sort(), `${api}: optional members`);
  }
  // Every host-v1 API file is accounted for (a new file means a new table row).
  const files = readdirSync(join(ROOT, 'packages/core/src/host-v1')).filter((f) => f.endsWith('.ts'));
  const covered = new Set(Object.values(API_FILE).map((f) => `${f}.ts`));
  const unlisted = files.filter((f) => !covered.has(f) && !['host.ts', 'apis.ts', 'asset-ref.ts'].includes(f));
  assert.deepEqual(unlisted, [], 'every API module has a conformance table');
});

test('the mock host conforms; with optional stubs every optional API is present and conforms', async () => {
  const bare = await runHostConformance(createMockHost());
  assert.ok(bare.ok, formatConformance(bare));
  assert.deepEqual(bare.present, []);
  const full = withOptionalStubs(createMockHost());
  const report = await runHostConformance(full, { behaviour: false });
  assert.ok(report.ok, formatConformance(report));
  assert.deepEqual([...report.present].sort(), [...HOST_V1_OPTIONAL_APIS].sort());
  assert.deepEqual(presentApis(full as never).length, HOST_V1_OPTIONAL_APIS.length);
  assert.deepEqual(missingRequires(['text', 'pdf'], full as never), []);
  assert.equal(await (full as unknown as { pdf: { analyze: () => unknown } }).pdf.analyze === undefined, false);
  assert.equal(await (full as unknown as { audio: { isAvailable: () => Promise<boolean> } }).audio.isAvailable(), false, 'probes answer false');
  assert.throws(() => (full as unknown as { text: { toPath: () => unknown } }).text.toPath(), /is a stub/);
});

test('a broken host fails with the member named, and an optional API present but incomplete is an error', async () => {
  const host = createMockHost() as unknown as Record<string, unknown>;
  delete (host.state as Record<string, unknown>).list;
  host.tokens = { get: async () => ({ size: 0, resolve: () => undefined }) }; // missing colors/resolve/themes
  host.net = { fetch: 42 };
  const report = await runHostConformance(host);
  assert.equal(report.ok, false);
  const keys = report.issues.map((i) => `${i.api}.${i.member ?? ''}`);
  assert.ok(keys.includes('state.list'), keys.join(', '));
  assert.ok(keys.includes('tokens.colors') && keys.includes('tokens.themes'), keys.join(', '));
  assert.ok(keys.includes('net.fetch'), keys.join(', '));
});

test('behavioural smokes: a state store that forgets, or a net that allows everything, is caught', async () => {
  const forgetful = createMockHost() as unknown as Record<string, unknown>;
  (forgetful.state as Record<string, unknown>).load = async () => null;
  const r1 = await runHostConformance(forgetful);
  assert.ok(r1.issues.some((i) => i.api === 'state' && /load\(\) must return/.test(i.message)), formatConformance(r1));

  const promiscuous = createMockHost() as unknown as Record<string, unknown>;
  promiscuous.net = { fetch: async () => new Response('ok') };
  const r2 = await runHostConformance(promiscuous);
  assert.ok(r2.issues.some((i) => i.api === 'net' && /must reject/.test(i.message)), formatConformance(r2));
});
