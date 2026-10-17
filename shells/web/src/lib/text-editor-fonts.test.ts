// SPDX-License-Identifier: MPL-2.0
/** Token typography pins the named face at its exact weight and reports anything else. */
import test from 'node:test';
import assert from 'node:assert/strict';
import type { TextFontResourceV1 } from '@lolly-tools/core';
import { pinTypographyFaces } from './text-editor-fonts.ts';
import { resolveVectorFont, type VectorFont, type VectorFontFace } from '../bridge/font-registry.ts';

const face = (family: string, weight: string, style = 'normal', file = `/fonts/${family}-${weight}-${style}.ttf`): VectorFontFace => ({ family, weight, style, source: 'platform', file });
const pin = async (item?: VectorFontFace): Promise<TextFontResourceV1> => ({ id: `font-${item!.file!.replace(/[^a-z0-9]/gi, '')}`, family: item!.family, sha256: '0'.repeat(64), faceIndex: 0, source: { kind: 'bundled', path: item!.file! } });
const typography = { fontFamily: 'Beacon Sans', fontWeight: 700 };

test('an exact variable face is pinned with its subset fallbacks for each slant', async () => {
  const requests: string[] = [];
  const resolve = async (style: { fontFamily?: string; fontStyle?: string }): Promise<VectorFont> => {
    requests.push(`${style.fontFamily} ${style.fontStyle}`);
    return { url: 'blob:a', face: face('Beacon Sans', '100 900', style.fontStyle), fallbacks: [{ fontUrl: 'blob:b', face: face('Beacon Sans', '100 900', style.fontStyle, `/fonts/ext-${style.fontStyle}.ttf`) }] };
  };
  const result = await pinTypographyFaces(typography, ['normal', 'italic'], 'Hello', { resolve, pin });
  assert.deepEqual(requests, ['"Beacon Sans" normal', '"Beacon Sans" italic']);
  assert.equal(result.fonts.length, 4);
  assert.deepEqual(Object.keys(result.faces), ['beacon sans|700']);
  assert.equal(result.faces['beacon sans|700']!.italic!.fallbackFonts!.length, 1);
});

test('a nearer weight, a substituted family or an unreadable slant is reported', async () => {
  const nearest = async (): Promise<VectorFont> => ({ url: 'blob:a', face: face('Beacon Sans', '400') });
  await assert.rejects(pinTypographyFaces(typography, ['normal'], 'Hello', { resolve: nearest, pin }), /Beacon Sans has no installed face at weight 700/);
  const brand = async (): Promise<VectorFont> => ({ url: 'blob:a', face: face('SUSE', '100 900') });
  await assert.rejects(pinTypographyFaces(typography, ['normal'], 'Hello', { resolve: brand, pin }), /No installed face for Beacon Sans/);
  const release = async (): Promise<VectorFont> => { throw new Error('The pinned release has no face for this text and slant.'); };
  await assert.rejects(pinTypographyFaces(typography, ['italic'], 'Hello', { resolve: release, pin }), /No installed face for Beacon Sans italic/);
  const none = async (): Promise<VectorFont | null> => null;
  await assert.rejects(pinTypographyFaces(typography, ['normal'], '', { resolve: none, pin }), /Install the font/);
});

test('a SUSE catalog file at a nearer weight is reported, not pinned', async () => {
  const real = globalThis.fetch;
  // The catalog probe asks only whether the static file is a font.
  globalThis.fetch = (async () => new Response(null, { headers: { 'content-type': 'font/ttf' } })) as typeof fetch;
  try {
    // SUSE 450 resolves to the Medium file and SUSE Mono 900 to ExtraBold, so neither is the requested weight.
    await assert.rejects(pinTypographyFaces({ fontFamily: 'SUSE', fontWeight: 450 }, ['normal'], 'Hello', { resolve: resolveVectorFont, pin }), /SUSE has no installed face at weight 450/);
    await assert.rejects(pinTypographyFaces({ fontFamily: 'SUSE Mono', fontWeight: 900 }, ['normal'], 'Hello', { resolve: resolveVectorFont, pin }), /SUSE Mono has no installed face at weight 900/);
    const exact = await pinTypographyFaces({ fontFamily: 'SUSE Mono', fontWeight: 800 }, ['normal'], 'Hello', { resolve: resolveVectorFont, pin });
    assert.deepEqual(Object.keys(exact.faces), ['suse mono|800']);
    assert.deepEqual(exact.fonts[0]!.source, { kind: 'bundled', path: '/catalog/fonts/ttf/SUSEMono-ExtraBold.ttf' });
  } finally { globalThis.fetch = real; }
});
