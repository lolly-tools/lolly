// SPDX-License-Identifier: MPL-2.0
/**
 * A flattened DXF drawing as Design boxes.
 *
 * Each layer becomes a group. Inside it, every colour is one or more native path boxes (a path
 * box paints one stroke colour, and the authored-path codec holds a bounded number of nodes, so a
 * large layer is split) followed by one text box per DXF text item. The text box carries the font
 * the file names and nothing else: no substitute is chosen here.
 *
 * Pure and DOM-free so the web shell, the CLI and the tests build the same boxes.
 */
import type { DxfImport, DxfText } from './dxf-import.ts';
import { dxfReportLines } from './dxf-import.ts';
import { designPathPlacement } from './design-path-author.ts';
import { nodeToBox, type DesignMapOptions, type DesignNode } from './design-map.ts';
import type { SubPath } from './svg-path.ts';

/** Most Design boxes one import makes, groups included. */
export const DXF_MAX_BOXES = 2000;
/** Path segments in one path box. */
const SEGMENTS_PER_BOX = 4000;
/** A DXF text height is the height of a capital letter; the em box is about 1.4 times that. */
const EM_PER_CAP = 1.4;
const AVG_ADVANCE_EM = 0.6;
const LINE_HEIGHT = 1.2;

export interface DxfDesignBox extends Record<string, unknown> { id: string; kind: string }
export interface DxfDesignResult {
  boxes: DxfDesignBox[];
  width: number;
  height: number;
  background: string;
  /** Plain sentences for the import report, including what was left out. */
  notes: string[];
  /** Font families the drawing names, as the file wrote them. */
  fontsNamed: string[];
}

function fmt(n: number): string {
  const r = Math.round(n * 1000) / 1000;
  return String(Object.is(r, -0) ? 0 : r);
}

/** SVG path data for subpaths. */
export function subPathsToD(subs: readonly SubPath[]): string {
  const parts: string[] = [];
  for (const sp of subs) {
    for (const s of sp.segments) {
      if (s.op === 'C') parts.push(`C${fmt(s.x1)} ${fmt(s.y1)} ${fmt(s.x2)} ${fmt(s.y2)} ${fmt(s.x)} ${fmt(s.y)}`);
      else parts.push(`${s.op}${fmt(s.x)} ${fmt(s.y)}`);
    }
    if (sp.closed) parts.push('Z');
  }
  return parts.join('');
}

function chunk(subs: readonly SubPath[]): SubPath[][] {
  const out: SubPath[][] = [];
  let cur: SubPath[] = [], n = 0;
  for (const sp of subs) {
    if (n > 0 && n + sp.segments.length > SEGMENTS_PER_BOX) { out.push(cur); cur = []; n = 0; }
    cur.push(sp);
    n += sp.segments.length;
  }
  if (cur.length) out.push(cur);
  return out;
}

function textBox(t: DxfText): { node: DesignNode; w: number; h: number } {
  const fs = Math.max(1, t.height * EM_PER_CAP);
  const lines = t.text.split('\n');
  const longest = Math.max(1, ...lines.map((l) => [...l].length));
  const w = Math.max(fs, t.width ?? longest * fs * AVG_ADVANCE_EM * t.widthFactor);
  const h = Math.max(fs * LINE_HEIGHT, lines.length * fs * LINE_HEIGHT);
  const fx = t.hAnchor / 2;
  const dyTop = t.vAnchor === 0 ? 0.9 * fs : t.vAnchor === 1 ? h : t.vAnchor === 2 ? h / 2 : 0;
  const c0x = w / 2 - fx * w, c0y = h / 2 - dyTop;
  const a = (t.rotation * Math.PI) / 180, cos = Math.cos(a), sin = Math.sin(a);
  const cx = t.x + c0x * cos - c0y * sin, cy = t.y + c0x * sin + c0y * cos;
  const node: DesignNode = {
    kind: 'text', x: cx - w / 2, y: cy - h / 2, w, h, rot: t.rotation,
    text: t.text, fontSize: fs, fg: t.color, lineHeight: LINE_HEIGHT, pad: 0,
    textAlign: t.hAnchor === 0 ? 'left' : t.hAnchor === 1 ? 'center' : 'right',
    fill: '', fontWeight: 400,
    ...(t.font ? { fontFamily: t.font } : {}),
  };
  return { node, w, h };
}

/** Build the Design boxes for a flattened drawing. */
export function dxfToDesign(imp: DxfImport, map?: DesignMapOptions): DxfDesignResult {
  const notes = dxfReportLines(imp.report);
  const fonts = { ...(map?.fonts ?? {}), preserveSource: true };
  const opts: DesignMapOptions = { ...(map ?? {}), fonts };
  const boxes: DxfDesignBox[] = [];
  const named = new Set<string>();
  let nid = 0;
  let droppedPaths = 0, droppedTexts = 0;

  for (let li = 0; li < imp.layers.length; li++) {
    const layer = imp.layers[li]!;
    const members: DxfDesignBox[] = [];
    for (const st of imp.strokes.filter((s) => s.layer === li)) {
      for (const part of chunk(st.subpaths)) {
        if (boxes.length + members.length + 1 >= DXF_MAX_BOXES) { droppedPaths++; continue; }
        let placed: ReturnType<typeof designPathPlacement>;
        try { placed = designPathPlacement({ d: subPathsToD(part) }, { stroke: st.color, strokeW: 1 }); } catch { continue; }
        const node: DesignNode = { kind: 'box', x: placed.x, y: placed.y, w: placed.w, h: placed.h, fill: '', stroke: st.color, strokeW: 1 };
        const box = nodeToBox(node, { id: `dxf${nid++}`, ...opts }) as unknown as DxfDesignBox;
        Object.assign(box, { kind: 'path', shape: 'rect', path: placed.path, fillRule: 'nonzero', strokeCap: 'round', strokeJoin: 'round', name: layer.name.slice(0, 80) });
        members.push(box);
      }
    }
    for (const t of imp.texts.filter((x) => x.layer === li)) {
      if (boxes.length + members.length + 1 >= DXF_MAX_BOXES) { droppedTexts++; continue; }
      const { node } = textBox(t);
      const box = nodeToBox(node, { id: `dxf${nid++}`, ...opts }) as unknown as DxfDesignBox;
      box.name = `${t.text.split('\n')[0]!.slice(0, 40)}`;
      if (t.font) named.add(t.font);
      members.push(box);
    }
    if (!members.length) continue;
    if (members.length > 1 && boxes.length + members.length + 1 <= DXF_MAX_BOXES) {
      const id = `dxf${nid++}`;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const b of members) {
        const bx = Number(b.x), by = Number(b.y), bw = Number(b.w), bh = Number(b.h);
        x0 = Math.min(x0, bx); y0 = Math.min(y0, by); x1 = Math.max(x1, bx + bw); y1 = Math.max(y1, by + bh);
        b.group = id;
      }
      boxes.push(...members, { id, kind: 'group', name: layer.name.slice(0, 80), x: x0, y: y0, w: x1 - x0, h: y1 - y0, rot: 0, group: '', frame: '' });
    } else {
      boxes.push(...members);
    }
  }
  if (droppedPaths) notes.push(`${droppedPaths} path pieces did not fit within the ${DXF_MAX_BOXES} Design layers one import makes and were left out. Use the layer filter to import part of the drawing.`);
  if (droppedTexts) notes.push(`${droppedTexts} text items did not fit within the ${DXF_MAX_BOXES} Design layers one import makes and were left out.`);
  if (named.size) notes.push(`Text keeps the font names the drawing states (${[...named].slice(0, 6).join(', ')}${named.size > 6 ? ' and more' : ''}). A font that is not installed falls back to the browser's default for that name.`);
  return { boxes, width: imp.width, height: imp.height, background: '#ffffff', notes, fontsNamed: [...named] };
}

const xmlEsc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * A plain SVG preview of a flattened drawing: one group per layer, strokes as paths, text as
 * `<text>` elements that carry the font name the file states (and no font-family when it states
 * none). For the CLI and for looking at a drawing without opening Design.
 */
export function dxfToSvg(imp: DxfImport): string {
  const out: string[] = [`<svg xmlns="http://www.w3.org/2000/svg" width="${imp.width}" height="${imp.height}" viewBox="0 0 ${imp.width} ${imp.height}">`, `<rect width="${imp.width}" height="${imp.height}" fill="#ffffff"/>`];
  imp.layers.forEach((layer, li) => {
    const strokes = imp.strokes.filter((s) => s.layer === li), texts = imp.texts.filter((t) => t.layer === li);
    if (!strokes.length && !texts.length) return;
    out.push(`<g id="layer-${li}" data-layer="${xmlEsc(layer.name)}">`);
    for (const st of strokes) out.push(`<path d="${subPathsToD(st.subpaths)}" fill="none" stroke="${st.color}" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>`);
    for (const t of texts) {
      const fs = Math.max(1, t.height * EM_PER_CAP);
      const anchor = t.hAnchor === 0 ? 'start' : t.hAnchor === 1 ? 'middle' : 'end';
      const baseline = t.vAnchor === 3 ? 'text-before-edge' : t.vAnchor === 2 ? 'central' : t.vAnchor === 1 ? 'text-after-edge' : 'alphabetic';
      const lines = t.text.split('\n');
      const spans = lines.map((l, i) => `<tspan x="${fmt(t.x)}" dy="${i === 0 ? 0 : fmt(fs * LINE_HEIGHT)}">${xmlEsc(l)}</tspan>`).join('');
      out.push(`<text x="${fmt(t.x)}" y="${fmt(t.y)}" font-size="${fmt(fs)}" fill="${t.color}" text-anchor="${anchor}" dominant-baseline="${baseline}"${t.font ? ` font-family="${xmlEsc(t.font)}"` : ''}${t.rotation ? ` transform="rotate(${fmt(t.rotation)} ${fmt(t.x)} ${fmt(t.y)})"` : ''}>${spans}</text>`);
    }
    out.push('</g>');
  });
  out.push('</svg>');
  return out.join('\n') + '\n';
}
