// SPDX-License-Identifier: MPL-2.0
import type { HostV1 } from '@lolly-tools/core/host-v1';
import fontkit from '@pdf-lib/fontkit';
import { readFontEmbedding, parseFontMetadata } from '../lib/font-utils.ts';
import type { AssetViewerSource } from '../lib/asset-viewer-source.ts';
import { viewerButton, viewerField, viewerSelect } from './asset-viewer-controls.ts';
import { t } from '../i18n.ts';
import type { UserFontsHost } from '../user-fonts.ts';
function canInstallFonts(host: HostV1): host is HostV1 & UserFontsHost {
  return ['_uploadUserAsset', '_deleteUserAsset', '_exportUserAssets', '_getBlob'].every(key => typeof Reflect.get(host.assets, key) === 'function');
}
interface Axis { name: string; min: number; default: number; max: number }

export async function mountFontAssetViewer(root: HTMLElement, bytes: Uint8Array, source: AssetViewerSource, signal: AbortSignal, host?: HostV1): Promise<() => void> {
  if (new TextDecoder().decode(bytes.subarray(0, 4)) === 'ttcf') throw new Error('Font collections need a face selection before they can be previewed.');
  let sfnt = bytes;
  const signature = new TextDecoder().decode(bytes.subarray(0, 4));
  if (signature === 'wOFF' || signature === 'wOF2') { if (bytes.length < 20 || new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(16) > 32 * 1024 * 1024) throw new Error('The expanded font is too large for an inline preview.'); }
  if (signature === 'wOFF') sfnt = (await import('@lolly/engine')).woffToSfnt(bytes);
  if (signature === 'wOF2') sfnt = await (await import('woff2-encoder/decompress')).default(bytes);
  signal.throwIfAborted();
  const font = fontkit.create(sfnt);
  const variable = font as typeof font & { variationAxes?: Record<string, Axis>; namedVariations?: Record<string, Record<string, number>> };
  const axes = variable.variationAxes ?? {}, values: Record<string, number> = {};
  const metadata = parseFontMetadata(sfnt.buffer.slice(sfnt.byteOffset, sfnt.byteOffset + sfnt.byteLength) as ArrayBuffer);
  const family = `lolly-preview-${crypto.randomUUID()}`;
  const face = new FontFace(family, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
    { style: font.italicAngle ? 'italic' : 'normal', weight: axes.wght ? `${axes.wght.min} ${axes.wght.max}` : String(metadata?.weight ?? 400) });
  await face.load(); signal.throwIfAborted(); document.fonts.add(face);
  const dispose = () => { document.fonts.delete(face); };
  signal.addEventListener('abort', dispose, { once: true });
  try {
    root.replaceChildren(); const toolbar = document.createElement('div'); toolbar.className = 'asset-viewer-toolbar';
    const content = document.createElement('div'); content.className = 'asset-font-content';
    const sample = document.createElement('textarea'); sample.className = 'field-input asset-font-sample'; sample.setAttribute('aria-label', t('Sample text'));
    sample.value = 'The quick brown fox jumps over the lazy dog\n0123456789'; sample.style.fontFamily = `"${family}"`; sample.style.fontStyle = face.style; sample.style.fontWeight = String(metadata?.weight ?? axes.wght?.default ?? 400); sample.style.fontSize = '48px';
    const size = document.createElement('input'); size.className = 'field-input'; size.type = 'number'; size.min = '8'; size.max = '160'; size.value = '48';
    viewerField('Size', size, toolbar); size.addEventListener('input', () => { const n = Number(size.value); if (n >= 8 && n <= 160) sample.style.fontSize = `${n}px`; });
    const tab = viewerSelect([['sample', 'Specimen'], ['characters', 'Characters']], toolbar, 'View');
    const axisRows = document.createElement('div'); axisRows.className = 'asset-font-axes';
    const controls = new Map<string, HTMLInputElement>();
    const repaintAxes = () => { sample.style.fontVariationSettings = Object.entries(values).map(([name, value]) => `"${name}" ${value}`).join(','); };
    for (const [name, axis] of Object.entries(axes).slice(0, 32)) {
      if (!/^[\x20-\x7e]{4}$/.test(name) || ![axis.min, axis.default, axis.max].every(Number.isFinite)) continue;
      values[name] = axis.default;
      const slider = document.createElement('input'); slider.type = 'range'; slider.className = 'field-range'; slider.min = String(axis.min); slider.max = String(axis.max); slider.step = 'any'; slider.value = String(axis.default);
      const output = document.createElement('output'); output.textContent = slider.value; slider.setAttribute('aria-label', axis.name || name);
      const label = viewerField(axis.name || name, slider, axisRows); label.append(output); controls.set(name, slider);
      slider.addEventListener('input', () => { values[name] = Number(slider.value); output.textContent = slider.value; repaintAxes(); });
    }
    const instances = Object.entries(variable.namedVariations ?? {}).slice(0, 100);
    const instance = viewerSelect([['', 'Default'], ...instances.map(([name]) => [name, name] as [string, string])], toolbar, 'Instance'); instance.parentElement!.hidden = !instances.length;
    const reset = (coordinates?: Record<string, number>) => {
      for (const [name, control] of controls) { values[name] = coordinates?.[name] ?? axes[name]!.default; control.value = String(values[name]); control.dispatchEvent(new Event('input')); }
      repaintAxes();
    };
    instance.addEventListener('change', () => reset(variable.namedVariations?.[instance.value])); viewerButton('Reset', () => { size.value = '48'; sample.style.fontSize = '48px'; instance.value = ''; reset(); }, toolbar); reset();
    const details = document.createElement('dl'); details.className = 'asset-font-details';
    const embedding = readFontEmbedding(sfnt.buffer.slice(sfnt.byteOffset, sfnt.byteOffset + sfnt.byteLength) as ArrayBuffer);
    for (const [label, value] of [['Family', font.familyName ?? source.name], ['Style', font.subfamilyName ?? ''], ['PostScript name', font.postscriptName ?? ''], ['Format', source.format.toUpperCase()], ['Characters', String(font.characterSet.length)], ['Licence', source.licence ?? 'Not supplied'], ['Embedding flags', [embedding.permission, embedding.noSubsetting ? 'No subsetting' : '', embedding.bitmapOnly ? 'Bitmap embedding only' : ''].filter(Boolean).join(', ')]] as [string, string][]) {
      const term = document.createElement('dt'), definition = document.createElement('dd'); term.textContent = t(label); definition.textContent = value; details.append(term, definition);
    }
    const glyphPanel = document.createElement('section'); glyphPanel.hidden = true;
    const glyphTools = document.createElement('div'); glyphTools.className = 'asset-viewer-toolbar'; const glyphs = document.createElement('div'); glyphs.className = 'asset-font-glyphs';
    const glyphCount = document.createElement('output'); let offset = 0;
    const codes = font.characterSet.filter(cp => cp >= 32 && cp <= 0x10ffff);
    const paint = () => {
      glyphs.replaceChildren(); glyphCount.textContent = codes.length ? `${offset + 1}-${Math.min(offset + 96, codes.length)} / ${codes.length}` : '0 / 0';
      for (const cp of codes.slice(offset, offset + 96)) {
        const b = viewerButton(`U+${cp.toString(16).toUpperCase().padStart(4, '0')}`, () => { sample.value += String.fromCodePoint(cp); tab.value = 'sample'; tab.dispatchEvent(new Event('change')); }, glyphs);
        const glyph = document.createElement('span'); glyph.className = 'asset-font-glyph'; glyph.style.fontFamily = `"${family}"`; glyph.style.fontStyle = face.style; glyph.style.fontWeight = sample.style.fontWeight; glyph.style.fontVariationSettings = sample.style.fontVariationSettings; glyph.textContent = String.fromCodePoint(cp);
        const code = document.createElement('span'); code.className = 'asset-font-glyph-code'; code.textContent = b.textContent; b.replaceChildren(glyph, code);
      }
    };
    viewerButton('Previous characters', () => { offset = Math.max(0, offset - 96); paint(); }, glyphTools); glyphTools.append(glyphCount);
    viewerButton('Next characters', () => { if (offset + 96 < codes.length) offset += 96; paint(); }, glyphTools); glyphPanel.append(glyphTools, glyphs);
    tab.addEventListener('change', () => { const chars = tab.value === 'characters'; sample.hidden = axisRows.hidden = chars; glyphPanel.hidden = !chars; if (chars) paint(); });
    if (host?.state) {
      const install = viewerButton('Add to my fonts', () => { void (async () => {
        install.disabled = true;
        try { signal.throwIfAborted(); const result = canInstallFonts(host)
          ? await (await import('../user-fonts.ts')).installFontFromBytes(host, bytes, { filename: source.name })
          : await (await import('../lib/font-asset-handler.ts')).installFontAsset(host, new File([sfnt as Uint8Array<ArrayBuffer>], source.name, { type: 'application/octet-stream' })); if (!signal.aborted) install.textContent = t(result ? 'Font added' : 'Font could not be added'); }
        catch { if (!signal.aborted) { install.textContent = t('Try again'); install.disabled = false; } }
      })(); }, toolbar);
    }
    content.append(sample, axisRows, glyphPanel, details); root.append(toolbar, content);
    return () => { signal.removeEventListener('abort', dispose); dispose(); };
  } catch (error) { signal.removeEventListener('abort', dispose); dispose(); throw error; }
}
