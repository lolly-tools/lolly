// SPDX-License-Identifier: MPL-2.0
/** Declarative catalog opening support, independent of routes and storage. */
import type { AssetRef } from './host-v1.ts';

export interface AssetOpenIntentV1 {
  id: string;
  types: AssetRef['type'][];
  formats?: string[];
  multiple?: boolean;
  animated?: boolean;
  order?: number;
  binding: { kind: 'input'; input: string } | { kind: 'canvas' | 'timeline' | 'text' };
}
export interface AssetOpenToolV1 {
  id: string;
  name?: string;
  openWith?: AssetOpenIntentV1[];
}
export interface AssetOpenChoiceV1 { tool: AssetOpenToolV1; intent: AssetOpenIntentV1 }

export function assetOpenChoices(tools: readonly AssetOpenToolV1[], refs: readonly AssetRef[]): AssetOpenChoiceV1[] {
  if (!refs.length) return [];
  return tools.flatMap(tool => (tool.openWith ?? []).filter(intent =>
    (refs.length === 1 || intent.multiple === true) && refs.every(ref =>
      (ref.meta?.animated !== true || intent.animated === true) && intent.types.includes(ref.type) && (!intent.formats?.length || intent.formats.includes(String(ref.format).toLowerCase())),
    ),
  ).map(intent => ({ tool, intent }))).sort((a, b) => (a.intent.order ?? 100) - (b.intent.order ?? 100));
}

/** Cross-field checks supplement the manifest schema in every validator. */
export function assetOpenErrors(manifest: { id?: string; openWith?: AssetOpenIntentV1[]; inputs?: readonly { id: string; type: string; multiple?: boolean; canvas?: unknown; assetType?: string }[] }): { path: string; message: string }[] {
  const errors: { path: string; message: string }[] = [];
  const seen = new Set<string>();
  for (const [index, intent] of (manifest.openWith ?? []).entries()) {
    const path = `/openWith/${index}`;
    if (seen.has(intent.id)) errors.push({ path, message: 'opening intent ids must be unique' });
    seen.add(intent.id);
    if (intent.binding.kind === 'text') {
      if (manifest.id !== 'text-helper' || intent.multiple) errors.push({ path, message: 'the text editor adapter requires Text and one source' });
      continue;
    }
    if (intent.binding.kind === 'canvas' || intent.binding.kind === 'timeline') {
      const input = manifest.inputs?.find(input => input.type === 'blocks' && input.canvas && typeof input.canvas === 'object');
      const canvas = input?.canvas as { imageField?: string; startField?: string; durField?: string; addKinds?: { id: string }[] } | undefined;
      if (!canvas?.imageField || (intent.binding.kind === 'timeline' && (!canvas.startField || !canvas.durField))) errors.push({ path, message: 'requires a declared image canvas with timing fields for timeline opening' });
      const kinds = new Set(canvas?.addKinds?.map(kind => kind.id));
      const allowed = intent.binding.kind === 'canvas' ? ['raster', 'vector'] : ['raster', 'vector', 'audio', 'video', 'lottie'];
      if (intent.types.some(type => !allowed.includes(type) || (intent.binding.kind === 'canvas' ? !kinds.has('image') : type === 'audio' ? !kinds.has('audio') : type === 'lottie' ? !kinds.has('lottie') : !kinds.has('clip') && !kinds.has(type === 'video' ? 'video' : 'image')))) errors.push({ path, message: 'opening types must have matching declared canvas add kinds' });
      continue;
    }
    if (intent.binding.kind !== 'input') continue;
    const inputId = intent.binding.input;
    const input = manifest.inputs?.find(input => input.id === inputId);
    if (!input || !['asset', 'file', 'text', 'longtext'].includes(input.type)) errors.push({ path: `${path}/binding/input`, message: 'must name a declared asset, file or text input' });
    else if (input.type === 'asset' && input.assetType && intent.types.some(type => input.assetType === 'image' ? !['raster', 'vector'].includes(type) : type !== input.assetType)) errors.push({ path, message: 'opening types must fit the destination asset input type' });
    else if (intent.multiple && (input.type !== 'file' || !input.multiple)) errors.push({ path, message: 'multiple opening requires a multiple file input' });
  }
  return errors;
}
