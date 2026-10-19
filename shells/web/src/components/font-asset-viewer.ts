// SPDX-License-Identifier: MPL-2.0
import type { HostV1 } from '@lolly-tools/core/host-v1';
import fontkit from '@pdf-lib/fontkit';
import { readFontEmbedding, parseFontMetadata } from '../lib/font-utils.ts';
import { collectionFaces, extractCollectionFace, isFontCollection } from '../lib/font-collection.ts';
import { readType1FontInfo, type Type1FontInfo } from '../lib/font-type1.ts';
import type { AssetViewerSource } from '../lib/asset-viewer-source.ts';
import { viewerButton, viewerField, viewerSelect } from './asset-viewer-controls.ts';
import { t, tRaw } from '../i18n.ts';
import type { UserFontsHost } from '../user-fonts.ts';
function canInstallFonts(host: HostV1): host is HostV1 & UserFontsHost {
  return ['_uploadUserAsset', '_deleteUserAsset', '_exportUserAssets', '_getBlob'].every(key => typeof Reflect.get(host.assets, key) === 'function');
}
interface Axis { name: string; min: number; default: number; max: number }
/** One face to show: the sfnt to read, the bytes FontFace and "Add to my fonts" take, and the collection context when there is one. */
interface FaceInput { sfnt: Uint8Array; original: Uint8Array; filename: string; collection?: { chooser: HTMLElement; index: number; count: number } }

function detailList(rows: Array<[string, string]>): HTMLDListElement {
  const details = document.createElement('dl'); details.className = 'asset-font-details';
  for (const [label, value] of rows) {
    const term = document.createElement('dt'), definition = document.createElement('dd'); term.textContent = t(label); definition.textContent = value; details.append(term, definition);
  }
  return details;
}

/** Type 1 is recognised and described from its cleartext header, never drawn. */
function mountType1Notice(root: HTMLElement, info: Type1FontInfo, source: AssetViewerSource): () => void {
  const note = document.createElement('p'); note.className = 'asset-viewer-status'; note.setAttribute('role', 'status');
  note.textContent = t('Type 1 fonts (PFA and PFB) cannot be previewed or added to your fonts. Convert this font to OpenType first.');
  const content = document.createElement('div'); content.className = 'asset-font-content';
  const rows: Array<[string, string]> = [['Family', info.familyName || info.fontName || source.name], ['Style', info.weight], ['Full name', info.fullName], ['PostScript name', info.fontName], ['Version', info.version], ['Notice', info.notice]];
  content.append(detailList([...rows.filter(([, value]) => value), ['Format', `Type 1 (${info.container.toUpperCase()})`], ['Licence', source.licence ?? 'Not supplied']]));
  if (source.thumbnail) { const image = document.createElement('img'); image.className = 'asset-viewer-fallback'; image.src = source.thumbnail; image.alt = t('Provider preview'); content.append(image); }
  root.replaceChildren(note, content);
  return () => {};
}

export async function mountFontAssetViewer(root: HTMLElement, bytes: Uint8Array, source: AssetViewerSource, signal: AbortSignal, host?: HostV1): Promise<() => void> {
  const type1 = readType1FontInfo(bytes);
  if (type1) return mountType1Notice(root, type1, source);
  let sfnt = bytes;
  const signature = new TextDecoder().decode(bytes.subarray(0, 4));
  if (signature === 'wOFF' || signature === 'wOF2') { if (bytes.length < 20 || new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(16) > 32 * 1024 * 1024) throw new Error('The expanded font is too large for an inline preview.'); }
  if (signature === 'wOFF') sfnt = (await import('@lolly/engine')).woffToSfnt(bytes);
  if (signature === 'wOF2') sfnt = await (await import('woff2-encoder/decompress')).default(bytes);
  signal.throwIfAborted();
  // A WOFF2 file can wrap a collection too, so the check runs on the decoded bytes.
  if (isFontCollection(sfnt)) return mountCollection(root, sfnt, source, signal, host);
  return mountFace(root, { sfnt, original: bytes, filename: source.name }, source, signal, host);
}

/** A face chooser over a TTC/OTC. Each choice is copied out as its own sfnt, and the previous face is released once the new one is showing. */
async function mountCollection(root: HTMLElement, collection: Uint8Array, source: AssetViewerSource, signal: AbortSignal, host?: HostV1): Promise<() => void> {
  const faces = collectionFaces(collection), readable = faces.filter(face => face.extension);
  const select = document.createElement('select'); select.className = 'field-select';
  for (const face of faces) {
    const option = document.createElement('option'); option.value = String(face.index); option.disabled = !face.extension;
    option.textContent = face.extension ? face.label || tRaw('Face {n}', { n: face.index + 1 }) : tRaw('Face {n} (damaged)', { n: face.index + 1 }); select.append(option);
  }
  const chooser = viewerField('Face', select, document.createElement('div'));
  const stem = (source.name.split('/').pop() ?? '').replace(/\.[^.]+$/, '') || 'font';
  let shown: (() => void) | undefined, loading: AbortController | undefined;
  const show = async (index: number) => {
    loading?.abort();
    const own = new AbortController(), stop = () => own.abort(), focused = chooser.contains(document.activeElement);
    loading = own; signal.addEventListener('abort', stop, { once: true });
    try {
      const face = extractCollectionFace(collection, index);
      const dispose = await mountFace(root, { sfnt: face, original: face, filename: `${stem}-${index + 1}.${faces[index]?.extension ?? 'ttf'}`, collection: { chooser, index, count: faces.length } }, source, own.signal, host);
      if (own.signal.aborted) { dispose(); return; }
      shown?.(); shown = dispose; loading = undefined;
      if (focused) select.focus();
    } catch (error) {
      if (own.signal.aborted) return;
      loading = undefined; shown?.(); shown = undefined;
      throw error;
    } finally { signal.removeEventListener('abort', stop); }
  };
  const failed = (error: unknown) => {
    if (signal.aborted) return;
    const toolbar = document.createElement('div'); toolbar.className = 'asset-viewer-toolbar'; toolbar.append(chooser);
    const status = document.createElement('p'); status.className = 'asset-viewer-status'; status.setAttribute('role', 'alert');
    status.textContent = t(error instanceof Error ? error.message : 'This face could not be previewed.');
    root.replaceChildren(toolbar, status);
  };
  select.addEventListener('change', () => { void show(Number(select.value)).catch(failed); });
  // The first readable face opens. When it cannot load, the chooser stays so another face can be tried.
  select.value = String(readable[0]!.index);
  await show(readable[0]!.index).catch(error => { if (readable.length > 1) failed(error); else throw error; });
  return () => { loading?.abort(); shown?.(); shown = undefined; };
}

async function mountFace(root: HTMLElement, input: FaceInput, source: AssetViewerSource, signal: AbortSignal, host?: HostV1): Promise<() => void> {
  const { sfnt, original: bytes } = input;
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
    if (input.collection) toolbar.append(input.collection.chooser);
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
    const embedding = readFontEmbedding(sfnt.buffer.slice(sfnt.byteOffset, sfnt.byteOffset + sfnt.byteLength) as ArrayBuffer);
    const details = detailList([['Family', font.familyName ?? source.name], ['Style', font.subfamilyName ?? ''], ['PostScript name', font.postscriptName ?? ''], ['Format', source.format.toUpperCase()],
      ...(input.collection ? [['Collection face', `${input.collection.index + 1} / ${input.collection.count}`] as [string, string]] : []),
      ['Characters', String(font.characterSet.length)], ['Licence', source.licence ?? 'Not supplied'], ['Embedding flags', [embedding.permission, embedding.noSubsetting ? 'No subsetting' : '', embedding.bitmapOnly ? 'Bitmap embedding only' : ''].filter(Boolean).join(', ')]]);
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
          ? await (await import('../user-fonts.ts')).installFontFromBytes(host, bytes, { filename: input.filename })
          : await (await import('../lib/font-asset-handler.ts')).installFontAsset(host, new File([sfnt as Uint8Array<ArrayBuffer>], input.filename, { type: 'application/octet-stream' })); if (!signal.aborted) install.textContent = t(result ? 'Font added' : 'Font could not be added'); }
        catch { if (!signal.aborted) { install.textContent = t('Try again'); install.disabled = false; } }
      })(); }, toolbar);
    }
    content.append(sample, axisRows, glyphPanel, details); root.append(toolbar, content);
    return () => { signal.removeEventListener('abort', dispose); dispose(); };
  } catch (error) { signal.removeEventListener('abort', dispose); dispose(); throw error; }
}
