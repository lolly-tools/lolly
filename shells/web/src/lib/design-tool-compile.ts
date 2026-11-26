// SPDX-License-Identifier: MPL-2.0
import type { TextDocumentV1, TextFontResourceV1 } from '@lolly-tools/core';
import type { HostV1, AssetRef } from '@lolly-tools/core/host-v1';
import type { DesignToolDraftV1, DesignToolDefinitionV1 } from '@lolly-tools/core/design-tool-v1';
import { compileDesignTool } from '../../../../engine/src/design-tool/compiler.ts';
import { resolveVectorFont } from '../bridge/font-registry.ts';
import { readFontEmbedding } from './font-utils.ts';
import { redistribution } from './redistribution.ts';
import { packageTextFonts } from './text-font-package.ts';
import { fetchMaybeInstance, instancePath } from './instance.ts';

export class DesignPreparationError extends Error {
  layerId?: string; inputId?: string;
  constructor(message: string, layerId?: string, inputId?: string) { super(message); this.name = 'DesignPreparationError'; this.layerId = layerId; this.inputId = inputId; }
}

export async function designDigest(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return [...new Uint8Array(digest)].map(v => v.toString(16).padStart(2, '0')).join('');
}
function dataUrl(bytes: Uint8Array, mime: string): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return `data:${mime};base64,${btoa(binary)}`;
}

/** Resolve artwork dependencies while the original canvas and fonts are present. */
export async function prepareDesignTool(draft: DesignToolDraftV1, canvas: HTMLElement, host: HostV1, options: { preview?: boolean; include?: ReadonlySet<string>; signal?: AbortSignal } = {}) {
  options.signal?.throwIfAborted();
  await document.fonts.ready;
  options.signal?.throwIfAborted();
  const d = structuredClone(draft);
  const assets: Record<string, Uint8Array> = {};
  const dependencies: DesignToolDefinitionV1['dependencies'] = [];
  const fonts = new Map<string, string>();
  const fontResources = new Map<string, TextFontResourceV1>();
  const fontInputs = new Map<string, Map<string, string>>();
  const images = new Map<string, AssetRef>();
  let css = '';
  const addBytes = async (bytes: Uint8Array, ext: string, credit?: string): Promise<string> => {
    const digest = await designDigest(bytes);
    const path = `assets/${digest}.${ext}`;
    if (!assets[path]) { assets[path] = bytes; dependencies.push({ path, digest, ...(credit ? { credit } : {}) }); }
    return digest;
  };
  const image = async (value: unknown): Promise<unknown> => {
    if (!value) return value;
    const ref = typeof value === 'string' ? await host.assets.get(value) : value as AssetRef;
    if (!ref?.url) throw new Error('An image is missing. Replace it before sharing.');
    if (images.has(ref.id)) return images.get(ref.id);
    if (!['image', 'raster', 'vector'].includes(ref.type)) throw new Error('Use a still image for this tool.');
    const rights = redistribution((ref.meta ?? {}) as Record<string, unknown>);
    if (!ref.id.startsWith('user/') && !rights.travels && !options.preview && !options.include?.has(ref.id)) throw new Error('Review the source image’s inclusion rights before sharing.');
    const response = await fetchMaybeInstance(ref.url, {signal:options.signal});
    if (!response.ok) throw new Error('An image could not be read. Replace it before sharing.');
    const blob = await response.blob();
    if (!/^image\/(png|jpeg|webp|avif|svg\+xml)$/.test(blob.type)) throw new Error('Use PNG, JPEG, WebP, AVIF or SVG images.');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (blob.type === 'image/svg+xml') {
      const svg = new DOMParser().parseFromString(new TextDecoder().decode(bytes), 'image/svg+xml');
      if (svg.querySelector('parsererror,script,foreignObject,animate,animateTransform,set,text')) throw new Error('Convert SVG text to paths and freeze animation before sharing this image.');
      for (const el of svg.querySelectorAll('*')) for (const attribute of el.attributes) {
        if (/^on/i.test(attribute.name) || /href$/i.test(attribute.name) && !/^(#|data:image\/)/.test(attribute.value) || /url\(\s*["']?(?!#)/i.test(attribute.value)) throw new Error('Embed linked content in this SVG before sharing.');
      }
    }
    const digest = await addBytes(bytes, blob.type === 'image/svg+xml' ? 'svg' : blob.type.split('/')[1]!, [String(ref.meta?.credit ?? ref.meta?.name ?? ref.id), rights.licence, ...rights.notices, !rights.travels && options.include?.has(ref.id) ? 'The author confirmed permission to include this source.' : ''].filter(Boolean).join('\n'));
    const resolved = { ...ref, id: `embedded-${digest}`, pin: undefined, url: dataUrl(bytes, blob.type), meta: {...ref.meta,baked:true,bakedAt:0} };
    delete (resolved.meta as Record<string,unknown>).toolUrl;
    images.set(ref.id, resolved);
    return resolved;
  };
  const font = async (node: HTMLElement, name?: string, weight?: string, composed?: TextDocumentV1): Promise<string> => {
    const pinned=composed?.fonts.find(resource=>resource.id===name||resource.family===name);
    if(pinned)return pinned.id;
    const attach=(key:string,family:string)=>{const resource=fontResources.get(key);if(composed&&resource&&!composed.fonts.some(font=>font.id===resource.id))composed.fonts.push(structuredClone(resource));return family;};
    const probe = node.cloneNode(false) as HTMLElement;
    if (name) probe.style.fontFamily = name === 'sans' ? 'var(--font-brand)' : name === 'mono' ? 'var(--font-mono)' : name;
    if (weight) probe.style.fontWeight = weight;
    node.parentElement!.append(probe);
    try {
      const style = getComputedStyle(probe);
      const key = `${style.fontFamily}/${style.fontWeight}/${style.fontStyle}`;
      const cached = fonts.get(key); if (cached) return attach(key,cached);
      const face = await resolveVectorFont(style, `${node.textContent}ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789`);
      if (face?.face && name && !['sans', 'mono', 'display'].includes(name) && face.face.family.toLowerCase() !== name.toLowerCase()) throw new Error('The original font is unavailable. Add it or choose an explicit replacement in Design.');
      if (!face || face.fallbacks?.length) throw new Error('Add a complete font file for this text before sharing.');
      const response = await fetchMaybeInstance(face.url, {signal:options.signal}); if (!response.ok) throw new Error('The font file could not be read.');
      const bytes = new Uint8Array(await response.arrayBuffer());
      const permission = readFontEmbedding(bytes.slice().buffer);
      if (!['installable', 'editable'].includes(permission.permission) || permission.bitmapOnly) throw new Error('This font cannot be embedded for editing. Choose an editable font.');
      await addBytes(bytes, 'ttf', `${face.face?.family || name || 'Design font'}: embedded font for editable artwork.`);
      const familyDigest = await designDigest(new TextEncoder().encode(`${d.id}/${d.version}/${face.face?.family || style.fontFamily}`));
      const family = `LollyFont${familyDigest.slice(0, 16)}`;
      fonts.set(key, family);
      fontResources.set(key,{id:family,family,sha256:await designDigest(bytes),faceIndex:0,source:{kind:'embedded',base64:dataUrl(bytes,'font/ttf').split(',')[1]!}});
      css += `@font-face{font-family:'${family}';src:url('${dataUrl(bytes, 'font/ttf')}');font-weight:${face.face?.weight || style.fontWeight};font-style:${style.fontStyle};}\n`;
      return attach(key,family);
    } finally { probe.remove(); }
  };
  const textSource = (layerId: string): HTMLElement => {
    const node = canvas.querySelector<HTMLElement>(`[data-box-id="${CSS.escape(layerId)}"] .lolly-box-text`);
    if (!node) throw new Error('The text source is unavailable. Return to Design and review this artboard.');
    return node;
  };
  for(const variant of d.variants)if(variant.textDocument)variant.textDocument=await packageTextFonts(variant.textDocument,host,addBytes,options.signal);
  for (const v of d.variants) for (const b of v.boxes) {
    options.signal?.throwIfAborted();
    try {
    if (['audio', 'camera', 'video'].includes(String(b.kind)) || b.tool || b.kf || b.anim || b.textAnim) throw new Error('Freeze motion and linked tools to still artwork before sharing.');
    if (!b.textStory && (b.kind === 'text' || b.text)) {
      const node = textSource(String(b.id));
      const families = new Set([String(b.font || 'sans')]);
      const weights = new Set([String(b.weight || getComputedStyle(node).fontWeight)]);
      for (const field of draft.inputs) for (const target of field.targets) if (target.variantId === v.id && target.layerId === b.id) {
        if (target.property === 'font') for (const option of field.input.options || []) families.add(option.value);
        if (target.property === 'weight') for (const option of field.input.options || []) weights.add(option.value);
      }
      for (const choice of draft.choices) for (const option of choice.options) for (const write of option.writes) if (write.variantId === v.id && write.layerId === b.id) {
        if (write.property === 'font') families.add(String(write.value));
        if (write.property === 'weight') weights.add(String(write.value));
      }
      for (const family of families) for (const weight of weights) await font(node,family,weight);
      b.font = await font(node, String(b.font || 'sans'));
      b.fg = getComputedStyle(node).color;
    }
    if (b.image) b.image = await image(b.image);
    } catch (error) { options.signal?.throwIfAborted(); throw new DesignPreparationError((error as Error).message, String(b.id), d.inputs.find(f => f.targets.some(t => t.layerId === b.id))?.input.id); }
  }
  const targetDocument=(variantId:string,layerId:string)=>{const variant=d.variants.find(variant=>variant.id===variantId);return variant?.boxes.some(box=>box.id===layerId&&box.textStory)?variant.textDocument:undefined;};
  for (const f of d.inputs) {
    options.signal?.throwIfAborted();
    if (f.input.type === 'asset' && f.input.default) f.input.default = await image(f.input.default);
    if (f.targets[0]?.property === 'font') {
      const node = textSource(f.targets[0].layerId);
      const mapped = new Map<string, string>();
      for (const option of f.input.options || []) {
        const name=option.value,values=await Promise.all(f.targets.map(target=>font(textSource(target.layerId),name,undefined,targetDocument(target.variantId,target.layerId))));
        if(new Set(values).size>1)throw new DesignPreparationError('Use the same pinned font for every target of this font field.',undefined,f.input.id);
        option.value=values[0]??await font(node,name);mapped.set(name,option.value);
      }
      f.input.default = mapped.get(String(f.input.default));
      f.approved = f.input.options?.map(o => o.value);
      fontInputs.set(f.input.id,mapped);
    }
    if (f.targets[0]?.property === 'weight' && !targetDocument(f.targets[0].variantId,f.targets[0].layerId)) {
      const node = textSource(f.targets[0].layerId);
      for (const option of f.input.options || []) await font(node, undefined, option.value);
    }
  }
  for (const choice of d.choices) for (const option of choice.options) {
    for (const write of option.writes) {
      if (write.property === 'image') write.value = await image(write.value);
      if (write.property === 'font') write.value = await font(textSource(write.layerId), String(write.value),undefined,targetDocument(write.variantId,write.layerId));
      if (write.property === 'weight' && !targetDocument(write.variantId,write.layerId)) await font(textSource(write.layerId), undefined, String(write.value));
    }
    for (const [id, value] of Object.entries(option.defaults || {})) {
      if (d.inputs.find(f => f.input.id === id)?.input.type === 'asset') option.defaults![id] = await image(value);
      if (fontInputs.has(id)) option.defaults![id] = fontInputs.get(id)!.get(String(value));
    }
  }
  const [source, styles] = await Promise.all([
    fetchMaybeInstance(instancePath('/tools/design/assets/rules-renderer.js'),{signal:options.signal}).then(r => { if (!r.ok) throw new Error('The tool compiler is unavailable.'); return r.text(); }),
    fetchMaybeInstance(instancePath('/tools/design/styles.css'),{signal:options.signal}).then(r => r.text()),
  ]);
  // Capture only the inherited variables the renderer uses; recipient branding cannot alter them.
  const inherited = getComputedStyle(canvas);
  const refs = new Set([...`${styles} ${JSON.stringify(d)}`.matchAll(/var\(\s*(--[\w-]+)/g)].map(m => m[1]!));
  const declarations: string[] = [];
  for (const ref of refs) {
    const value = inherited.getPropertyValue(ref).trim();
    if (!value) continue;
    if (/[{}<>]|url\(/i.test(value)) throw new Error('Resolve linked style assets in Design before sharing.');
    declarations.push(`${ref}:${value}`);
    for (const match of value.matchAll(/var\(\s*(--[\w-]+)/g)) refs.add(match[1]!);
  }
  css += `.lolly-locked-design{${declarations.join(';')}}`;
  const definition: DesignToolDefinitionV1 = { ...d, compilerVersion: 1, rendererDigest: await designDigest(new TextEncoder().encode(source)), css, dependencies };
  options.signal?.throwIfAborted();
  return compileDesignTool(definition, { source, styles }, assets);
}

/** Inclusion decisions list every selectable source before the author downloads a tool. */
export async function designToolRights(draft: DesignToolDraftV1, host: HostV1): Promise<Array<{id:string;name:string;reason:string}>> {
  const values: unknown[] = draft.variants.flatMap(v => v.boxes.map(b => b.image));
  for (const field of draft.inputs) if (field.input.type === 'asset') values.push(field.input.default);
  for (const choice of draft.choices) for (const option of choice.options) {
    values.push(...option.writes.filter(w => w.property === 'image').map(w => w.value));
    for (const [id,value] of Object.entries(option.defaults || {})) if (draft.inputs.find(f => f.input.id === id)?.input.type === 'asset') values.push(value);
  }
  const held = new Map<string,{id:string;name:string;reason:string}>();
  for (const value of values) {
    if (!value) continue;
    const ref = typeof value === 'string' ? await host.assets.get(value) : value as AssetRef;
    if (!ref?.id || ref.id.startsWith('user/')) continue;
    const rights = redistribution(ref.meta || {});
    if (!rights.travels) held.set(ref.id,{id:ref.id,name:String(ref.meta?.name || ref.id),reason:rights.reason});
  }
  return [...held.values()];
}
