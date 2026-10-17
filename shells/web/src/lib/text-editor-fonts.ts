// SPDX-License-Identifier: MPL-2.0
/** Pin the font the canvas actually resolved, then use those bytes for native input. */
import type { AssetsAPI } from '@lolly-tools/core/host-v1';
import type { TextCharacterV1, TextFontResourceV1 } from '@lolly-tools/core';
import { base64ToBytes } from '../../../../engine/src/bytes.ts';
import { sha256Hex } from '@lolly/engine';
import { resolveVectorFont, faceSourceBytes, type VectorFontFace } from '../bridge/font-registry.ts';
import type { FontStyleSlice } from '../bridge/text-svg.ts';
import { textTypographyFaceKey, type TextTypography, type TextTypographyFaces, type TextTypographySlant } from '../../../../engine/src/text-token-bindings.ts';
import { pinnedFaceMismatch } from '../../../../engine/src/token-font-pins.ts';
async function pinFace(face: VectorFontFace | undefined): Promise<TextFontResourceV1> {
  if (!face) throw new Error('Install this font before using composed text.');
  const bytes = await faceSourceBytes(face);
  if (!bytes?.length) throw new Error(`The font could not be read: ${face.family}`);
  const sha256 = await sha256Hex(bytes);
  let source: TextFontResourceV1['source'];
  if (face.assetId) source = { kind: 'asset', id: face.assetId };
  else {
    const url = new URL(face.file!, location.href);
    if (url.origin !== location.origin || !/^\/(fonts|catalog|tools)\//.test(url.pathname)) throw new Error('Install this font locally before using composed text.');
    source = { kind: 'bundled', path: decodeURI(url.pathname) };
  }
  return { id: `font-${sha256}`, family: face.family, sha256, faceIndex: 0, source };
}
export async function pinEditorFont(style: FontStyleSlice, text: string): Promise<{ fonts: TextFontResourceV1[]; character: TextCharacterV1 }> {
  const resolved = await resolveVectorFont(style, text.trim() ? text : 'M');
  if (!resolved) throw new Error('Choose an installed font for this text.');
  const fonts = await Promise.all([pinFace(resolved.face), ...(resolved.fallbacks ?? []).map(item => pinFace(item.face))]);
  const axes = Object.fromEntries((resolved.variations ?? []).map(value => value.split('=')).map(([tag, value]) => [tag!, Number(value)]));
  return { fonts, character: { font: fonts[0]!.id, fallbackFonts: fonts.slice(1).map(font => font.id), weight: Number(style.fontWeight) || 400, italic: style.fontStyle === 'italic', axes } };
}
/** Token typography pins the named family at the exact weight for each slant the text draws. */
export async function pinTypographyFaces(typography: Pick<TextTypography, 'fontFamily' | 'fontWeight'>, slants: readonly TextTypographySlant[], text: string, deps = { resolve: resolveVectorFont, pin: pinFace }): Promise<{ fonts: TextFontResourceV1[]; faces: TextTypographyFaces }> {
  const family = typography.fontFamily.includes('"') ? `'${typography.fontFamily}'` : `"${typography.fontFamily}"`;
  const entry: TextTypographyFaces[string] = {}, fonts: TextFontResourceV1[] = [];
  for (const slant of slants) {
    // Only the token family is tried, so a generic fallback cannot stand in for that family.
    const resolved = await deps.resolve({ fontFamily: family, fontWeight: String(typography.fontWeight), fontStyle: slant }, text.trim() ? text : 'M').catch(() => null);
    const missing = pinnedFaceMismatch({ family: typography.fontFamily, weight: typography.fontWeight, italic: slant === 'italic' }, resolved?.face);
    if (missing || !resolved) throw new Error(missing ?? 'The font could not be read.');
    const pinned = await Promise.all([deps.pin(resolved.face), ...(resolved.fallbacks ?? []).map(item => deps.pin(item.face))]);
    fonts.push(...pinned);
    entry[slant] = { font: pinned[0]!.id, ...(pinned.length > 1 ? { fallbackFonts: pinned.slice(1).map(font => font.id) } : {}) };
  }
  return { fonts, faces: { [textTypographyFaceKey(typography.fontFamily, typography.fontWeight)]: entry } };
}
const nativeFaces = new Map<string, { face: FontFace; bytes: number }>();
let cacheBytes = 0;
const activeFaces = new Map<string, number>(), pendingFaces = new Map<string, Promise<void>>();
export function nativeFontFamily(font: Pick<TextFontResourceV1, 'sha256' | 'faceIndex'>): string { return `LollyText_${font.sha256}_${font.faceIndex}`; }
async function loadEditorFont(font: TextFontResourceV1, assets?: Pick<AssetsAPI, 'get' | 'bytes'>): Promise<void> {
  const family = nativeFontFamily(font);
  if (nativeFaces.has(family)) return;
  if (font.faceIndex !== 0) throw new Error('This font collection face cannot be used by the native editor. Choose a separate font file.');
  const bytes = font.source.kind === 'embedded' ? base64ToBytes(font.source.base64) : font.source.kind === 'asset'
    ? await assets?.bytes?.(await assets.get(font.source.id))
    : await fetch(font.source.path).then(async response => { if (!response.ok) throw new Error('The text font could not be loaded.'); return new Uint8Array(await response.arrayBuffer()); });
  if (!bytes || await sha256Hex(bytes) !== font.sha256) throw new Error('The text font no longer matches its saved content.');
  if (bytes.length > 32 * 1024 * 1024) throw new Error('This font exceeds the supported size.');
  while (nativeFaces.size >= 64 || cacheBytes + bytes.length > 64 * 1024 * 1024) {
    const id = [...nativeFaces.keys()].find(id => !activeFaces.get(id));
    if (!id) throw new Error('This text uses too many font resources to edit at once.');
    const old = nativeFaces.get(id)!;
    document.fonts.delete(old.face); nativeFaces.delete(id); cacheBytes -= old.bytes;
  }
  const face = new FontFace(family, new Uint8Array(bytes), { weight: '1 1000' });
  nativeFaces.set(family, { face, bytes: bytes.length }); cacheBytes += bytes.length;
  try { await face.load(); document.fonts.add(face); }
  catch (error) { nativeFaces.delete(family); cacheBytes -= bytes.length; throw error; }
}

/** Keep every font of a mounted layout available until its replacement settles. */
export async function acquireEditorFonts(fonts: TextFontResourceV1[], assets?: Pick<AssetsAPI, 'get' | 'bytes'>): Promise<() => void> {
  const unique = new Map(fonts.map(font => [nativeFontFamily(font), font]));
  let released = false;
  const release = () => { if (released) return; released = true; for (const family of unique.keys()) { const count = (activeFaces.get(family) ?? 1) - 1; if (count) activeFaces.set(family, count); else activeFaces.delete(family); } };
  for (const family of unique.keys()) activeFaces.set(family, (activeFaces.get(family) ?? 0) + 1);
  try {
    const outcomes = await Promise.allSettled([...unique].map(([family, font]) => {
      let pending = pendingFaces.get(family);
      if (!pending) { pending = loadEditorFont(font, assets).finally(() => pendingFaces.delete(family)); pendingFaces.set(family, pending); }
      return pending;
    }));
    const failed = outcomes.find(result => result.status === 'rejected');
    if (failed?.status === 'rejected') throw failed.reason;
    return release;
  } catch (error) { release(); throw error; }
}
