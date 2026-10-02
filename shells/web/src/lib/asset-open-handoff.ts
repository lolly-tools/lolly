// SPDX-License-Identifier: MPL-2.0
/** Catalog sources are handed to one fresh destination session. */
import type { AssetRef, HostV1, InputFile } from '@lolly-tools/core/host-v1';
import { assetOpenChoices, type AssetOpenChoiceV1 } from '@lolly-tools/core/asset-open-v1';
import type { ToolManifest } from '@lolly/engine';
import { DEFAULT_FILE_MAX_BYTES, matchesShowIf, buildInputModel, type InputValue } from '../../../../engine/src/inputs.ts';
import { navigateTo } from '../nav.ts';

export interface AssetOpening { toolId: string; slot: string; values: Record<string, InputValue>; refs: AssetRef[]; kind: 'input' | 'canvas' | 'timeline'; at: number }
let pending: AssetOpening | null = null;
let generation = 0;
export function setAssetOpening(value: AssetOpening): void { pending = value; }
export function takeAssetOpening(toolId: string, slot: string, canvas = false): AssetOpening | null {
  if (!pending) return null;
  if (Date.now() - pending.at > 60_000 || pending.toolId !== toolId || pending.slot !== slot) { pending = null; return null; }
  if (canvas !== (pending.kind !== 'input')) return null;
  const value = pending; pending = null; return value;
}

export function takeAssetOpeningSeed(toolId: string, slot: string): AssetOpening | null {
  if (!pending || pending.kind === 'input') return takeAssetOpening(toolId, slot);
  if (pending.toolId !== toolId || pending.slot !== slot || Date.now() - pending.at > 60_000) { pending = null; return null; }
  return pending;
}

export async function readAssetFile(host: HostV1, ref: AssetRef): Promise<File> {
  if (!host.assets.bytes) throw new Error('This shell cannot read original asset files.');
  const bytes = await host.assets.bytes(ref);
  if (bytes.byteLength > 128 * 1024 * 1024) throw new Error('Choose a source smaller than 128 MB.');
  const format = ref.original?.format ?? ref.format;
  const raw = String(ref.meta?.name ?? ref.id.split('/').pop() ?? 'asset');
  const extension = raw.split('.').pop()?.toLowerCase();
  const name = extension === format || (format === 'jpeg' && extension === 'jpg') || (format === 'jpg' && extension === 'jpeg') ? raw : `${raw.replace(/\.[a-z0-9]{1,10}$/i, '')}.${format}`;
  const mime = ({ svg: 'image/svg+xml', svgz: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', avif: 'image/avif', gif: 'image/gif', bmp: 'image/bmp', tiff: 'image/tiff', tif: 'image/tiff', pdf: 'application/pdf', wav: 'audio/wav', mp3: 'audio/mpeg', ogg: 'audio/ogg', opus: 'audio/ogg', flac: 'audio/flac', m4a: 'audio/mp4', aac: 'audio/aac', mp4: 'video/mp4', webm: 'video/webm', txt: 'text/plain', md: 'text/markdown', html: 'text/html', csv: 'text/csv', tsv: 'text/tab-separated-values', json: 'application/json', ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff' } as Record<string, string>)[format] ?? '';
  return new File([bytes as BlobPart], name, { type: mime });
}

async function measuredMedia(host: HostV1, ref: AssetRef): Promise<AssetRef> {
  if (typeof ref.meta?.durationMs === 'number' && Number.isFinite(ref.meta.durationMs) && ref.meta.durationMs > 0) return ref;
  const file = await readAssetFile(host, ref);
  const url = URL.createObjectURL(file);
  const media = document.createElement(ref.type === 'video' ? 'video' : 'audio');
  try {
    media.preload = 'metadata';
    const duration = await new Promise<number>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Could not determine this media file’s duration.')), 10_000);
      media.onloadedmetadata = () => { clearTimeout(timer); resolve(media.duration); };
      media.onerror = () => { clearTimeout(timer); reject(new Error('This browser could not read the media file.')); };
      media.src = url;
    });
    if (!Number.isFinite(duration) || duration <= 0) throw new Error('This media file has no finite duration.');
    return { ...ref, meta: { ...ref.meta, durationMs: duration * 1000 } };
  } finally { media.onloadedmetadata = null; media.onerror = null; media.removeAttribute('src'); media.load(); URL.revokeObjectURL(url); }
}

export async function openingInputValues(host: HostV1, manifest: ToolManifest, choice: AssetOpenChoiceV1, refs: AssetRef[]): Promise<Record<string, InputValue>> {
  const binding = choice.intent.binding;
  if (binding.kind !== 'input') {
    const blocks = manifest.inputs.find(input => input.type === 'blocks' && input.canvas);
    if (!blocks) throw new Error('This tool has no canvas import surface.');
    return { [blocks.id]: [] };
  }
  const input = manifest.inputs.find(input => input.id === binding.input);
  if (!input) throw new Error('The destination input is no longer available.');
  const defaults = Object.fromEntries(buildInputModel(manifest).map(input => [input.id, input.value]));
  if (!matchesShowIf(input.showIf, defaults)) throw new Error('This input is unavailable with the tool’s initial settings.');
  let value: InputValue;
  if (input.type === 'asset') {
    if (input.assetType && (input.assetType === 'image' ? !['raster', 'vector'].includes(refs[0]!.type) : input.assetType !== refs[0]!.type)) throw new Error('This source type does not fit the destination input.');
    if (input.filter) {
      const eligible = await host.assets.query({ ...input.filter, type: refs[0]!.type });
      if (!eligible.some(ref => ref.id === refs[0]!.id)) throw new Error('This source does not match the destination input’s asset filter.');
    }
    value = refs[0]!;
  }
  else if (input.type === 'text' || input.type === 'longtext') {
    const { readTextAsset } = await import('./text-handoff.ts');
    value = (await readTextAsset(host, refs[0]!)).text;
  }
  else if (input.type === 'file') {
    const files: InputFile[] = [];
    for (const ref of refs) {
      const file = await readAssetFile(host, ref);
      if (file.size > (input.maxSize ?? DEFAULT_FILE_MAX_BYTES)) throw new Error('This source exceeds the destination input’s file limit.');
      if (input.accept?.length && !input.accept.some(accept => accept.startsWith('.') ? file.name.toLowerCase().endsWith(accept.toLowerCase()) : accept.endsWith('/*') ? file.type.startsWith(accept.slice(0, -1)) : file.type === accept)) throw new Error('This file type is not accepted by the destination input.');
      files.push({ __file: true, name: file.name, mime: file.type, size: file.size, bytes: new Uint8Array(await file.arrayBuffer()), url: null });
    }
    value = input.multiple ? files : files[0]!;
  } else throw new Error('This input cannot receive a catalog asset.');
  return { [input.id]: value };
}

/** Picks one animation out of a Lottie source, or null when the person cancels. The view
 *  supplies it (views/lottie-import.ts), because lib/ may not import from views/. */
export type LottieChooser = (ref: AssetRef) => Promise<AssetRef | null>;

export async function openAssetsWith(host: HostV1, choice: AssetOpenChoiceV1, refs: AssetRef[], chooseLottie: LottieChooser, isCurrent: () => boolean = () => true): Promise<void> {
  const request = ++generation;
  pending = null;
  const { getTool } = await import('../bridge/tool-loader.ts');
  const tool = await getTool(choice.tool.id);
  const actual = assetOpenChoices([tool.manifest], refs).find(entry => entry.intent.id === choice.intent.id);
  if (!actual) throw new Error('This tool no longer accepts the selected assets.');
  if (actual.intent.binding.kind === 'text') {
    const { openTextHandoff, readTextAsset } = await import('./text-handoff.ts');
    const source = await readTextAsset(host, refs[0]!);
    if (request === generation && isCurrent()) openTextHandoff(source);
    return;
  }
  const values = await openingInputValues(host, tool.manifest, actual, refs);
  const prepared: AssetRef[] = [];
  for (const ref of refs) {
    if (actual.intent.binding.kind === 'timeline' && ['audio', 'video'].includes(ref.type)) prepared.push(await measuredMedia(host, ref));
    else if (ref.type === 'lottie') {
      const selected = await chooseLottie(ref);
      if (!selected) return;
      prepared.push(selected);
    } else if (actual.intent.binding.kind === 'canvas' && (!(Number.isFinite(ref.width) && Number.isFinite(ref.height)) || !ref.width || !ref.height || ref.width < 0 || ref.height < 0)) {
      const image = new Image(); image.src = ref.url;
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([image.decode(), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Could not read the image dimensions.')), 10_000); })]);
        if (image.naturalWidth < 1 || image.naturalHeight < 1 || image.naturalWidth * image.naturalHeight > 40_000_000) throw new Error('Choose an image of up to 40 megapixels.');
        prepared.push({ ...ref, width: image.naturalWidth, height: image.naturalHeight });
      } finally { clearTimeout(timer); image.removeAttribute('src'); }
    } else prepared.push(ref);
  }
  if (request !== generation || !isCurrent()) return;
  const slot = `asset-${crypto.randomUUID()}`;
  setAssetOpening({ toolId: tool.manifest.id, slot, values, refs: prepared, kind: actual.intent.binding.kind, at: Date.now() });
  const params = new URLSearchParams({ slot });
  if (actual.intent.binding.kind === 'canvas' && prepared.length === 1) {
    params.set('w', String(prepared[0]!.width)); params.set('h', String(prepared[0]!.height));
  }
  navigateTo(`#/tool/${tool.manifest.id}?${params}`);
}
