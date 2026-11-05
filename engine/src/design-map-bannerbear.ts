// SPDX-License-Identifier: MPL-2.0
/**
 * A Bannerbear V5 image template mapped to Design rows.
 *
 * `GET /v5/image_templates/{uid}` returns the template's full layer design in
 * `config.objects`, so someone moving off Bannerbear can bring their templates as
 * editable documents. Pure: no fetching, no DOM, no storage. What Design cannot carry
 * is listed in the report, never dropped silently.
 *
 * Built from Bannerbear's public V5 API documentation and OpenAPI schema, read
 * 2026-11-05, and never run against a live account. Those docs give no unit syntax or
 * paint order, so this module reads numbers as CSS pixels and list order as back to
 * front, and the report states both. Only layer types whose properties were confirmed
 * are mapped: every other type is reported by name.
 *
 * Bannerbear V2 and Placid return field names and a preview, not a design, so there is
 * nothing here for them.
 */
import { isDesignToolInputId, type DesignInputV1, type DesignToolDraftV1 } from '@lolly-tools/core/design-tool-v1';
import { nodeToBox, safeColor, type DesignMapOptions, type DesignNode } from './design-map.ts';
import { escapeMarkup } from './design-text.ts';
import { RESERVED } from './url-mode.ts';

export type BannerbearNoteKind = 'dropped' | 'approximated' | 'picture' | 'font' | 'assumption';
export interface BannerbearNote { kind: BannerbearNoteKind; text: string; layer?: string }

/** One editable field, naming the vendor property and the input it becomes. */
export interface BannerbearField { layer: string; property: string; input: string; boxId: string }

export interface BannerbearFrame { name: string; width: number; height: number; background: string; boxes: ReturnType<typeof nodeToBox>[] }

/** The mapping entry `lw render-api` reads, so old requests reach the imported design. */
export interface BannerbearMappingEntry {
  source: 'bannerbear-v5';
  template: string;
  toolId: string;
  format: 'png';
  layers: Record<string, Record<string, string>>;
  ignore: string[];
  fixed: Record<string, unknown>;
}

export interface BannerbearMapResult {
  frames: BannerbearFrame[];
  report: BannerbearNote[];
  fields: BannerbearField[];
  /** A starting point for Share with rules, reviewed by a person before it becomes a tool. */
  designTool: DesignToolDraftV1;
  mapping: BannerbearMappingEntry;
}

export interface BannerbearMapOptions {
  map?: DesignMapOptions;
  /** Turns a picture's URL into an asset reference. Without one, pictures are only listed. */
  image?: (url: string, layer: string) => unknown;
}

/** Layer types whose properties were read in the vendor's schema or create-image docs. */
const MAPPED_TYPES = new Set(['text', 'rectangle', 'circle', 'rectangle_image_container', 'circle_image_container', 'svg_shape']);
const MAX_LAYERS = 5000;
const MAX_SIDE = 100_000;

/** Geometry and identity every mapped layer reads. */
const SHARED = new Set(['id', 'name', 'type', 'left', 'top', 'width', 'height', 'rotate', 'opacity', 'hidden']);
const READ_BY_TYPE: Record<string, ReadonlySet<string>> = {
  text: new Set(['text', 'color', 'font-family', 'font-size', 'font-weight', 'text-align', 'line-height', 'letter-spacing', 'background-color']),
  rectangle: new Set(['background-color', 'border-radius']),
  circle: new Set(['background-color']),
  rectangle_image_container: new Set(['background-image', 'background-size', 'background-color', 'border-radius']),
  circle_image_container: new Set(['background-image', 'background-size', 'background-color']),
  svg_shape: new Set(['fill', 'svg-url']),
};

const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

/** True when a parsed JSON value looks like a V5 image template. */
export function isBannerbearTemplate(value: unknown): boolean {
  return isObject(value) && typeof value.uid === 'string' && isObject(value.config) && Array.isArray(value.config.objects);
}

/** A number, or a string of one in pixels. A percentage or `auto` is not a position this can place. */
function pixels(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const match = /^\s*(-?\d+(?:\.\d+)?)(?:px)?\s*$/.exec(value);
  return match ? Number(match[1]) : null;
}

/** CSS reads opacity as 0 to 1. A value above 1, or with a percent sign, is read as a percentage. */
function opacityPercent(value: unknown): number | null {
  if (typeof value === 'string' && /%\s*$/.test(value)) return pixels(value.replace('%', ''));
  const number = pixels(value);
  if (number === null) return null;
  return number > 1 ? number : number * 100;
}

function lineHeightRatio(value: unknown, fontSize: number): number | null {
  if (typeof value === 'string' && /%\s*$/.test(value)) { const percent = pixels(value.replace('%', '')); return percent === null ? null : percent / 100; }
  if (typeof value === 'string' && /px\s*$/.test(value)) { const px = pixels(value); return px === null ? null : px / fontSize; }
  const number = pixels(value);
  if (number === null) return null;
  // A value this large can only be pixels, because no line sets ten times its own size.
  return number > 10 ? number / fontSize : number;
}

function letterSpacingPx(value: unknown, fontSize: number): number | null {
  if (typeof value === 'string' && /em\s*$/.test(value)) { const em = pixels(value.replace(/r?em\s*$/, '')); return em === null ? null : em * fontSize; }
  return pixels(value);
}

const stableId = (name: string, fallback: string): string => {
  const slug = name.replace(/[^A-Za-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
  return (/^[A-Za-z0-9_]/.test(slug) ? slug.slice(0, 100) : '') || fallback;
};
const toolId = (name: string, uid: string): string => {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90);
  return /^[a-z0-9][a-z0-9-]{2,}$/.test(slug) ? slug : `bannerbear-${uid.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60)}`;
};

/** Maps one image template. Throws when there is nothing that could be a template. */
export function mapBannerbearTemplate(template: unknown, options: BannerbearMapOptions = {}): BannerbearMapResult {
  if (!isBannerbearTemplate(template)) throw new Error('This is not a Bannerbear V5 image template: it has no `uid` and `config.objects`.');
  const raw = template as { uid: string; name?: unknown; width?: unknown; height?: unknown; config: { objects: unknown[] } };
  const objects = raw.config.objects;
  if (objects.length > MAX_LAYERS) throw new Error(`This template has more than ${MAX_LAYERS} layers.`);
  const width = pixels(raw.width);
  const height = pixels(raw.height);
  if (width === null || height === null || width < 1 || height < 1 || width > MAX_SIDE || height > MAX_SIDE) throw new Error('This template has no usable width and height.');
  const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 200) : raw.uid;
  const map: DesignMapOptions = options.map ?? { fonts: { preserveSource: true } };
  const report: BannerbearNote[] = [
    { kind: 'assumption', text: 'Built from public documentation, not run against a live account. Numbers are read as pixels, and layer order as back to front. Check the result against the preview.' },
  ];
  const fields: BannerbearField[] = [];
  const boxes: BannerbearFrame['boxes'] = [];
  const reserved = [...RESERVED];
  const taken = new Set<string>();
  const fonts = new Set<string>();
  const uniqueId = (label: string, index: number): string => {
    const slug = stableId(label, `layer_${index + 1}`).slice(0, 56);
    const base = /^[A-Za-z]/.test(slug) ? slug : `layer_${slug}`;
    // A tool input cannot take a reserved name, and a layer called `background` or `format` is common.
    const start = isDesignToolInputId(base, reserved) ? base : `${base}_layer`;
    let id = start;
    for (let n = 2; taken.has(id); n++) id = `${start}_${n}`;
    taken.add(id);
    return id;
  };

  objects.forEach((object, index) => {
    if (!isObject(object)) { report.push({ kind: 'dropped', text: `Layer ${index + 1} is not an object, so it was left out.` }); return; }
    const label = typeof object.name === 'string' && object.name ? object.name : typeof object.id === 'string' ? object.id : `layer ${index + 1}`;
    const type = typeof object.type === 'string' ? object.type : 'unknown';
    if (!MAPPED_TYPES.has(type)) {
      report.push({ kind: 'dropped', layer: label, text: `${label}: type ${type} was left out, because its properties could not be confirmed from public documentation.` });
      return;
    }
    if (object.hidden === true) { report.push({ kind: 'dropped', layer: label, text: `${label}: a hidden layer was left out.` }); return; }
    const x = pixels(object.left ?? 0);
    const y = pixels(object.top ?? 0);
    const w = pixels(object.width);
    const h = pixels(object.height);
    if (x === null || y === null || w === null || h === null) {
      report.push({ kind: 'dropped', layer: label, text: `${label}: left out, because its position or size is not in pixels (anchored or responsive layers have no fixed box).` });
      return;
    }
    const id = uniqueId(label, index);
    const node: DesignNode = { x, y, w, h };
    const rotate = object.rotate === undefined ? null : pixels(object.rotate);
    if (rotate !== null) node.rot = rotate;
    const opacity = object.opacity === undefined ? null : opacityPercent(object.opacity);
    if (opacity !== null) node.opacity = opacity;
    if (object.opacity !== undefined && opacity === null) report.push({ kind: 'dropped', layer: label, text: `${label}: opacity ${String(object.opacity)} was not understood.` });
    const fill = typeof object['background-color'] === 'string' ? safeColor(object['background-color'], '') : '';
    if (fill) node.fill = fill;

    if (type === 'text') {
      const fontSize = pixels(object['font-size']) ?? 48;
      node.kind = 'text';
      if (!fill) node.fill = '';
      node.text = typeof object.text === 'string' ? escapeMarkup(object.text, 'design') : '';
      if (typeof object.color === 'string') node.fg = object.color;
      node.fontSize = fontSize;
      if (typeof object['font-family'] === 'string' && object['font-family']) { node.fontFamily = object['font-family']; fonts.add(object['font-family']); }
      if (object['font-weight'] !== undefined) node.fontWeight = object['font-weight'] as number | string;
      if (typeof object['text-align'] === 'string') node.textAlign = object['text-align'];
      if (object['line-height'] !== undefined) {
        const ratio = lineHeightRatio(object['line-height'], fontSize);
        if (ratio !== null) node.lineHeight = ratio;
        else report.push({ kind: 'dropped', layer: label, text: `${label}: line-height ${String(object['line-height'])} was not understood.` });
      }
      if (object['letter-spacing'] !== undefined) {
        const tracking = letterSpacingPx(object['letter-spacing'], fontSize);
        if (tracking !== null) node.tracking = tracking;
        else report.push({ kind: 'dropped', layer: label, text: `${label}: letter-spacing ${String(object['letter-spacing'])} was not understood.` });
      }
      fields.push({ layer: label, property: 'text', input: id, boxId: id });
    } else if (type === 'rectangle' || type === 'circle') {
      node.kind = 'box';
      if (type === 'circle') node.shape = 'ellipse';
      const radius = object['border-radius'] === undefined ? null : pixels(object['border-radius']);
      if (radius !== null && radius > 0) { node.shape = 'rounded'; node.radius = radius; }
      if (object['border-radius'] !== undefined && radius === null) report.push({ kind: 'dropped', layer: label, text: `${label}: border-radius ${String(object['border-radius'])} was not understood.` });
      fields.push({ layer: label, property: 'background-color', input: id, boxId: id });
    } else if (type === 'svg_shape') {
      node.kind = 'box';
      const color = typeof object.fill === 'string' ? safeColor(object.fill, '') : '';
      if (color) node.fill = color;
      report.push({ kind: 'approximated', layer: label, text: `${label}: an SVG shape became a plain box at the same place. Replace it with the artwork.` });
      if (typeof object['svg-url'] === 'string') report.push({ kind: 'picture', layer: label, text: `${label}: artwork at ${object['svg-url']}` });
      fields.push({ layer: label, property: 'fill', input: id, boxId: id });
    } else {
      node.kind = 'image';
      if (type === 'circle_image_container') node.shape = 'ellipse';
      const radius = object['border-radius'] === undefined ? null : pixels(object['border-radius']);
      if (radius !== null && radius > 0) { node.shape = 'rounded'; node.radius = radius; }
      const size = object['background-size'];
      node.fit = size === 'contain' ? 'contain' : size === '100% 100%' ? 'fill' : 'cover';
      if (typeof size === 'string' && !['cover', 'contain', '100% 100%'].includes(size)) report.push({ kind: 'approximated', layer: label, text: `${label}: background-size ${size} became cover.` });
      const url = object['background-image'];
      if (typeof url === 'string' && url) {
        const asset = options.image?.(url, label);
        if (asset) node.image = asset;
        else report.push({ kind: 'picture', layer: label, text: `${label}: picture at ${url} was not stored. Add it to Assets if you hold the rights to it.` });
      }
      fields.push({ layer: label, property: 'background-image', input: id, boxId: id });
    }
    boxes.push(nodeToBox(node, { id, ...map }));

    // Everything else this layer set is named, so nothing is lost quietly.
    const read = READ_BY_TYPE[type]!;
    const left = Object.entries(object).filter(([key, value]) => !SHARED.has(key) && !read.has(key) && value !== null && value !== undefined && value !== '').map(([key]) => key);
    if (left.length) report.push({ kind: 'dropped', layer: label, text: `${label}: not carried over: ${left.sort().join(', ')}.` });
  });

  const seen = new Map<string, number>();
  for (const field of fields) seen.set(field.layer, (seen.get(field.layer) ?? 0) + 1);
  for (const [layer, count] of seen) if (count > 1) report.push({ kind: 'approximated', layer, text: `${layer}: ${count} layers share this name, so a request naming it reaches only the last one. Give them different names, or map them by id.` });
  for (const family of [...fonts].sort()) report.push({ kind: 'font', text: `${family}: add this face to the design system, or choose another. It is named here, not copied.` });

  const inputs: DesignInputV1[] = fields.map((field) => {
    const box = boxes.find((item) => item.id === field.boxId)!;
    const target = { variantId: 'default', layerId: field.boxId };
    if (field.property === 'text') return { input: { id: field.input, type: 'text', label: field.layer, default: box.text }, targets: [{ ...target, property: 'text' as const }] };
    if (field.property === 'background-image') return { input: { id: field.input, type: 'asset', assetType: 'image', label: field.layer }, targets: [{ ...target, property: 'image' as const }] };
    return { input: { id: field.input, type: 'color', label: field.layer, default: box.bg || '#000000' }, targets: [{ ...target, property: 'fill' as const }] };
  });
  const id = toolId(name, raw.uid);
  const layers: BannerbearMappingEntry['layers'] = {};
  for (const field of fields) layers[field.layer] = { ...layers[field.layer], [field.property]: field.input };
  const frame: BannerbearFrame = { name, width: Math.round(width), height: Math.round(height), background: '', boxes };
  return {
    frames: [frame], report, fields,
    designTool: {
      schemaVersion: 1, id, name, version: '1.0.0', presentation: 'sidebar', formats: ['png', 'svg', 'pdf'], inputs,
      variants: [{ id: 'default', label: name, width: frame.width, height: frame.height, background: frame.background, boxes: boxes as unknown as Array<Record<string, unknown>> }],
      defaultVariant: 'default', choices: [], recipes: [],
    },
    mapping: { source: 'bannerbear-v5', template: raw.uid, toolId: id, format: 'png', layers, ignore: [], fixed: {} },
  };
}
