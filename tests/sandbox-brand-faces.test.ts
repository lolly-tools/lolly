// SPDX-License-Identifier: MPL-2.0
// The Sandbox's preview runs in an opaque frame, so the design system's faces are handed
// to it as bytes. The template finds the faces a stylesheet declares; a font uploaded to
// the brand is registered by script, with no stylesheet rule, so its files come from the
// hook (onInit → rwcFaces), through host.text.fontUrl, the lookup the export uses.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const HOOKS = new URL('../community/sandbox/hooks.js', import.meta.url);

type Face = { url: string; variations?: string[] } | null;
async function hooksWith(brand: string, fontUrl?: (family: string, opts: { weight: number; italic: boolean }) => Face) {
  const src = await readFile(HOOKS, 'utf8');
  const host = {
    tokens: { resolve: async (ref: string) => (ref === '{font.brand}' ? brand : 'SUSE Mono') },
    ...(fontUrl ? { text: { fontUrl: async (family: string, opts: { weight: number; italic: boolean }) => fontUrl(family, opts) } } : {}),
  };
  return new Function('host', `${src}\nreturn { onInit };`)(host) as { onInit: () => Promise<{ rwcFaces: string }> };
}
const faces = async (h: { onInit: () => Promise<{ rwcFaces: string }> }) => JSON.parse((await h.onInit()).rwcFaces);

test('each face file is handed over once, for the weights the app answers with it', async () => {
  const asked: string[] = [];
  const h = await hooksWith("'Probe Upload', SUSE, sans-serif", (family, { weight, italic }) => {
    asked.push(`${family} ${weight}${italic ? ' italic' : ''}`);
    if (family === 'SUSE') return italic ? null : { url: '/fonts/SUSE.woff2', variations: [`wght=${weight}`] };
    // A static family with a regular and a bold file and no italic: the lookup answers an
    // italic request with the nearest upright file.
    return { url: weight <= 500 ? 'blob:http://localhost/regular' : 'blob:http://localhost/bold' };
  });
  assert.deepEqual(await faces(h), [
    { family: 'Probe Upload', url: 'blob:http://localhost/regular', weight: '100 500', style: 'normal' },
    { family: 'Probe Upload', url: 'blob:http://localhost/bold', weight: '600 900', style: 'normal' },
    { family: 'SUSE', url: '/fonts/SUSE.woff2', weight: '100 900', style: 'normal' },
  ]);
  assert.ok(!asked.some((a) => a.startsWith('sans-serif')), 'a generic family is never looked up');
});

test('a family with its own italic files hands those over as italic', async () => {
  const h = await hooksWith('Probe Upload', (_family, { weight, italic }) => ({ url: `blob:http://localhost/${weight < 600 ? 'r' : 'b'}${italic ? 'i' : ''}` }));
  assert.deepEqual((await faces(h)).map((f: { weight: string; style: string; url: string }) => `${f.url.slice(-2)} ${f.weight} ${f.style}`),
    ['/r 100 500 normal', '/b 600 900 normal', 'ri 100 500 italic', 'bi 600 900 italic']);
});

test('a host with no font lookup hands over nothing', async () => {
  assert.deepEqual(await faces(await hooksWith('Probe Upload')), []);
  assert.deepEqual(await faces(await hooksWith('Probe Upload', () => null)), []);
});
