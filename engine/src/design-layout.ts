// SPDX-License-Identifier: MPL-2.0
/** Design's layout adapter. Authored rows stay flat; solver output is disposable. */
import { atan2, cos, hypot, sin } from './geom/portable-math.ts';
import { designHierarchyIndex } from './design-hierarchy.ts';

type Row = Record<string, unknown>;

// Admission, reflow work and retained cache ceilings.
const MAX_LAYOUT_LAYERS = 20000; // Layer records per document.
const MAX_LAYOUT_TRACKS = 4096; // Track records per document.
const MAX_LAYOUT_OWNER_RECORDS = 65; // Current layer plus 64 ancestor records.
const MAX_LAYOUT_SCALAR = 1e7; // Finite coordinate, spacing and track magnitude.
const MAX_LAYOUT_TEXT_LAYER_CHARS = 65536; // UTF-16 units per intrinsic plain-text layer.
const MAX_LAYOUT_TEXT_DOCUMENT_CHARS = 1000000; // Aggregate intrinsic plain-text UTF-16 units.
const MAX_LAYOUT_TRACKS_PER_AXIS = 1024; // Tracks and one-based grid cell indices per axis.
const MAX_LAYOUT_GRID_CELLS = 65536; // Grid cells and auto-placement candidates per container.
const MAX_LAYOUT_GRID_WORK = 262144; // Occupancy and candidate visits per request.
const MAX_LAYOUT_PASSES = 16; // Nested reflow passes per evaluation.
const MAX_LAYOUT_REFLOW_WORK = 320000; // Aggregate member and descendant visits per evaluation.
const MAX_LAYOUT_SOLVER_CACHE_ENTRIES = 8; // Request results per container.
const MAX_LAYOUT_SOLVER_CACHE_BYTES = 16 * 1024 * 1024; // Aggregate UTF-16 key bytes.
const MAX_LAYOUT_PROJECTION_KEY_CHARS = 2 * 1024 * 1024; // UTF-16 key units per projection.
const MAX_LAYOUT_PROJECTIONS = 2; // Retained whole-document geometry projections.
export interface LayoutFinding {
  id: string;
  code: string;
  message: string;
}
export interface LayoutTrack {
  kind: 'fixed' | 'auto' | 'fr' | 'percent';
  value: number;
}
export interface LayoutItem {
  bounds: number[];
  sizing: string[];
  margin: number[];
  min: (number | null)[];
  max: (number | null)[];
  absolute: boolean;
  hidden: boolean;
  align: string;
  justify: string;
  cell: number[];
}
export interface LayoutRequest {
  mode: string;
  direction: string;
  wrap: boolean;
  bounds: number[];
  padding: number[];
  gap: number[];
  align: string;
  align_content: string;
  justify: string;
  justify_items: string;
  sizing: string[];
  items: LayoutItem[];
  columns: LayoutTrack[];
  rows: LayoutTrack[];
}
export interface LayoutSolverOutput {
  bounds: number[][];
  columns?: number[][];
  rows?: number[][];
}
export interface LayoutGrid {
  id: string;
  columns: number[][];
  rows: number[][];
  cells?: Array<{ id: string; row: number; column: number; rowSpan: number; columnSpan: number }>;
}
export type LayoutSolver = (request: LayoutRequest) => LayoutSolverOutput;
export const hasDesignLayout = (rows: readonly Row[]): boolean =>
  Array.isArray(rows) && rows.some((r) => r && (r.layout === 'flex' || r.layout === 'grid'));
const on = (v: unknown): boolean => v === true || v === 'true' || v === 1 || v === '1';
const number = (v: unknown, fallback = 0): number => (v === '' || v == null ? fallback : Number(v));
const mode = (r: Row, axis: 'W' | 'H'): string => String(r[`layout${axis}`] || 'fixed');
const owner = (r: Row): string => String(r.layoutOwner || r.frame || '');
const hierarchyOwner = (r: Row, byId: ReadonlyMap<string, Row>): string =>
  byId.get(String(r.group || ''))?.kind === 'group' ? String(r.group) : owner(r);
const id = (r: Row): string => String(r.id || '');
const isText = (r: Row): boolean =>
  r.kind === 'text' || (typeof r.text === 'string' && r.text.length > 0);

/** Whole track choices are scalar values: one collaboration write cannot tear type from value. */
export function parseLayoutTrack(value: unknown): LayoutTrack {
  const s = String(value || 'auto').trim();
  if (s === 'auto') return { kind: 'auto', value: 0 };
  const match = /^(\d+(?:\.\d+)?)(px|fr|%)$/.exec(s);
  if (
    !match ||
    Number(match[1]) > MAX_LAYOUT_SCALAR ||
    (match[2] === 'fr' && Number(match[1]) === 0)
  )
    throw new Error(`Invalid grid track: ${s}. Use auto, 120px, 1fr or 25%.`);
  return {
    kind: match[2] === 'px' ? 'fixed' : match[2] === '%' ? 'percent' : 'fr',
    value: Number(match[1]),
  };
}

/** Diagnose ownership after merges as well as before local edits. Never repair an edge silently. */
export function validateDesignLayout(
  boxes: readonly Row[],
  tracks: readonly Row[] = []
): LayoutFinding[] {
  if (
    !Array.isArray(boxes) ||
    !Array.isArray(tracks) ||
    [...boxes, ...tracks].some((r) => !r || typeof r !== 'object' || Array.isArray(r))
  )
    return [
      {
        id: '',
        code: 'layout.input',
        message: 'Layout layers and tracks must be arrays of records.',
      },
    ];
  const findings: LayoutFinding[] = [];
  const add = (r: Row, code: string, message: string) =>
    findings.push({ id: id(r), code, message });
  const byId = new Map<string, Row>();
  if (boxes.length > MAX_LAYOUT_LAYERS || tracks.length > MAX_LAYOUT_TRACKS)
    return [
      {
        id: '',
        code: 'layout.limit',
        message: 'Layout exceeds the 20,000 layer or 4,096 track limit.',
      },
    ];
  for (const r of boxes) {
    if (!id(r) || byId.has(id(r)))
      add(r, 'layout.identity', 'Layout requires unique permanent layer IDs.');
    byId.set(id(r), r);
  }
  const parentOf = (r: Row) => hierarchyOwner(r, byId);
  for (const r of boxes) {
    if (r.group && byId.get(String(r.group))?.kind === 'group' && r.layoutOwner)
      add(r, 'layout.owner-conflict', 'A grouped layer cannot also have a layout owner.');
    if (r.kind === 'group' && (mode(r, 'W') !== 'fixed' || mode(r, 'H') !== 'fixed'))
      add(r, 'layout.group-sizing', 'Groups use fixed sizing. Resize the group or use a layout container for fill and content sizing.');
    if (r.kind === 'group' && hasDesignLayout([r]))
      add(r, 'layout.group-container', 'Use an artboard or box as a dynamic layout container.');
    if (r.layoutOwner && r.frame)
      add(
        r,
        'layout.owner-conflict',
        'A nested layer must have one owner. Clear its artboard pointer.'
      );
    if (r.layoutOwner && !hasDesignLayout([byId.get(String(r.layoutOwner)) || {}]))
      add(r, 'layout.owner-missing', 'The layout owner is missing or has no layout.');
    const seen = new Set<string>([id(r)]);
    let o = parentOf(r);
    while (o) {
      if (seen.has(o)) {
        add(r, 'layout.owner-cycle', 'Layout ownership contains a cycle.');
        break;
      }
      seen.add(o);
      if (seen.size > MAX_LAYOUT_OWNER_RECORDS) {
        add(r, 'layout.depth', 'Layout nesting exceeds 64 levels.');
        break;
      }
      o = parentOf(byId.get(o) || {});
    }
    if (r.layout && !['none', 'flex', 'grid'].includes(String(r.layout)))
      add(r, 'layout.mode', 'Unknown layout mode.');
    if (r.layoutOwner || hasDesignLayout([r]) || hasDesignLayout([byId.get(parentOf(r)) || {}])) {
      for (const [key, choices] of Object.entries({
        layoutDirection: ['row', 'row-reverse', 'column', 'column-reverse'],
        layoutAlign: ['start', 'center', 'end', 'stretch'],
        layoutAlignContent: [
          'start',
          'center',
          'end',
          'stretch',
          'space-between',
          'space-around',
          'space-evenly',
        ],
        layoutJustify: [
          'start',
          'center',
          'end',
          'stretch',
          'space-between',
          'space-around',
          'space-evenly',
        ],
        layoutJustifyItems: ['start', 'center', 'end', 'stretch'],
        layoutSelf: ['auto', 'start', 'center', 'end', 'stretch'],
        layoutJustifySelf: ['auto', 'start', 'center', 'end', 'stretch'],
      }))
        if (r[key] && !choices.includes(String(r[key]))) add(r, 'layout.enum', `Unknown ${key}.`);
      for (const k of [
        'w',
        'h',
        'layoutGapX',
        'layoutGapY',
        'layoutPadTop',
        'layoutPadRight',
        'layoutPadBottom',
        'layoutPadLeft',
      ])
        if (number(r[k]) < 0) add(r, 'layout.negative', `${k} must be nonnegative.`);
      for (const k of [
        'x',
        'y',
        'w',
        'h',
        'rot',
        'layoutGapX',
        'layoutGapY',
        'layoutPadTop',
        'layoutPadRight',
        'layoutPadBottom',
        'layoutPadLeft',
        'layoutMarginTop',
        'layoutMarginRight',
        'layoutMarginBottom',
        'layoutMarginLeft',
        'layoutOrder',
        'layoutMinW',
        'layoutMinH',
        'layoutMaxW',
        'layoutMaxH',
        'layoutRow',
        'layoutColumn',
        'layoutRowSpan',
        'layoutColumnSpan',
        'layoutX',
        'layoutY',
        'layoutAngle',
      ]) {
        if (
          r[k] !== '' &&
          r[k] != null &&
          (!Number.isFinite(Number(r[k])) || Math.abs(Number(r[k])) > MAX_LAYOUT_SCALAR)
        )
          add(r, 'layout.number', `Invalid ${k}.`);
      }
      for (const axis of ['W', 'H'] as const) {
        if (!['fixed', 'hug', 'fill'].includes(mode(r, axis)))
          add(r, 'layout.sizing', 'Unknown layout size rule.');
        const min = number(r[`layoutMin${axis}`]);
        const max = number(r[`layoutMax${axis}`], Infinity);
        if (min < 0 || max < min)
          add(
            r,
            'layout.limits',
            'A minimum size must be nonnegative and cannot exceed its maximum.'
          );
      }
    }
  }
  const text = boxes.filter(
    (r) => isText(r) && !r.textStory && (mode(r, 'W') === 'hug' || mode(r, 'H') === 'hug')
  );
  if (
    text.some((r) => String(r.text || '').length > MAX_LAYOUT_TEXT_LAYER_CHARS) ||
    text.reduce((sum, r) => sum + String(r.text || '').length, 0) > MAX_LAYOUT_TEXT_DOCUMENT_CHARS
  )
    findings.push({
      id: '',
      code: 'layout.text-limit',
      message:
        'Content sizing accepts up to 65,536 characters per plain-text layer and one million per document.',
    });
  const trackIds = new Set<string>();
  for (const t of tracks) {
    if (!id(t) || trackIds.has(id(t)))
      add(t, 'layout.track-id', 'Grid tracks require unique permanent IDs.');
    trackIds.add(id(t));
    if (byId.get(String(t.container))?.layout !== 'grid')
      add(t, 'layout.track-owner', 'A track must belong to an existing grid.');
    if (!['row', 'column'].includes(String(t.axis)))
      add(t, 'layout.track-axis', 'A track axis must be row or column.');
    if (!Number.isFinite(number(t.order))) add(t, 'layout.track-order', 'Invalid track order.');
    try {
      parseLayoutTrack(t.track);
    } catch (e) {
      add(t, 'layout.track', String((e as Error).message));
    }
  }
  return findings;
}

function corners(r: Row): number[] {
  const x = number(r.x),
    y = number(r.y),
    w = Math.max(0.01, number(r.w, 100)),
    h = Math.max(0.01, number(r.h, 100));
  const a = (number(r.rot) * Math.PI) / 180,
    c = cos(a),
    s = sin(a),
    cx = x + w / 2,
    cy = y + h / 2;
  return [-w / 2, -h / 2, w / 2, -h / 2, w / 2, h / 2, -w / 2, h / 2].map((_, i, arr) =>
    i % 2 ? cy + arr[i - 1]! * s + arr[i]! * c : cx + arr[i]! * c - arr[i + 1]! * s
  );
}
function fromCorners(r: Row, b: number[]): Row {
  const w = hypot(b[2]! - b[0]!, b[3]! - b[1]!),
    h = hypot(b[6]! - b[0]!, b[7]! - b[1]!);
  const x = (b[0]! + b[4]!) / 2 - w / 2,
    y = (b[1]! + b[5]!) / 2 - h / 2;
  const rot = (atan2(b[3]! - b[1]!, b[2]! - b[0]!) * 180) / Math.PI;
  const original = number(r.rot);
  const dot = (b[2]! - b[0]!) * (b[6]! - b[0]!) + (b[3]! - b[1]!) * (b[7]! - b[1]!);
  if (Math.abs(dot) > Math.max(0.01, w * h * 0.0001))
    throw new Error('This layout produced a skewed rectangle that Design cannot represent.');
  return {
    ...r,
    x,
    y,
    w,
    h,
    rot: Math.abs(rot - original) < 0.0001 ? original : Math.abs(rot) < 0.0001 ? 0 : rot,
  };
}
const sides = (r: Row, prefix: string) =>
  ['Top', 'Right', 'Bottom', 'Left'].map((k) => number(r[prefix + k]));
const limit = (r: Row, k: string): number | null =>
  r[k] === '' || r[k] == null ? null : Number(r[k]);

export function designLayoutRequest(
  container: Row,
  children: Row[],
  tracks: readonly Row[]
): LayoutRequest {
  const cols = tracks
    .filter((t) => t.container === container.id && t.axis === 'column')
    .sort(
      (a, b) => number(a.order) - number(b.order) || (id(a) < id(b) ? -1 : id(a) > id(b) ? 1 : 0)
    )
    .map((t) => parseLayoutTrack(t.track));
  const rows = tracks
    .filter((t) => t.container === container.id && t.axis === 'row')
    .sort(
      (a, b) => number(a.order) - number(b.order) || (id(a) < id(b) ? -1 : id(a) > id(b) ? 1 : 0)
    )
    .map((t) => parseLayoutTrack(t.track));
  if (!cols.length) cols.push({ kind: 'fr', value: 1 });
  if (!rows.length) rows.push({ kind: 'auto', value: 0 });
  if (
    cols.length > MAX_LAYOUT_TRACKS_PER_AXIS ||
    rows.length > MAX_LAYOUT_TRACKS_PER_AXIS ||
    cols.length * rows.length > MAX_LAYOUT_GRID_CELLS
  )
    throw new Error('Grid exceeds its track or cell budget.');
  let placementWork = 0;
  const occupied = new Set<string>();
  const areas = new Map<string, number[]>();
  const items = children.map((r) => ({
    bounds: corners(r),
    sizing: [mode(r, 'W'), mode(r, 'H')],
    margin: sides(r, 'layoutMargin'),
    min: [limit(r, 'layoutMinW'), limit(r, 'layoutMinH')],
    max: [limit(r, 'layoutMaxW'), limit(r, 'layoutMaxH')],
    absolute: on(r.layoutAbsolute),
    hidden: on(r.hidden),
    align: String(r.layoutSelf || 'auto'),
    justify: String(r.layoutJustifySelf || 'auto'),
    cell: [
      number(r.layoutRow),
      number(r.layoutColumn),
      Math.max(1, number(r.layoutRowSpan, 1)),
      Math.max(1, number(r.layoutColumnSpan, 1)),
    ],
  }));
  if (container.layout === 'grid') {
    const mark = (cell: number[]) => {
      placementWork += cell[2]! * cell[3]!;
      if (placementWork > MAX_LAYOUT_GRID_WORK)
        throw new Error('Grid placement exceeds its work budget.');
      for (let y = cell[0]!; y < cell[0]! + cell[2]!; y++)
        for (let x = cell[1]!; x < cell[1]! + cell[3]!; x++) occupied.add(`${y}:${x}`);
    };
    for (const [n, item] of items.entries()) {
      if (item.absolute || item.hidden) continue;
      if (item.cell.some((n) => !Number.isInteger(n) || n < 0 || n > MAX_LAYOUT_TRACKS_PER_AXIS))
        throw new Error('Grid placement must use whole numbers between 1 and 1024.');
      if (item.cell[0] && item.cell[1]) {
        mark(item.cell);
        if (children[n]!.layoutArea) areas.set(String(children[n]!.layoutArea), item.cell);
      }
    }
    for (const [n, item] of items.entries()) {
      if (item.absolute || item.hidden) continue;
      const area = areas.get(String(children[n]!.layoutArea || ''));
      if (area) item.cell = [...area];
      if (!item.cell[0] || !item.cell[1]) {
        let found = false;
        const columnFirst = container.layoutDirection === 'column';
        for (let k = 0; k < MAX_LAYOUT_GRID_CELLS; k++) {
          if (++placementWork > MAX_LAYOUT_GRID_WORK)
            throw new Error('Grid placement exceeds its work budget.');
          const y = columnFirst ? (k % rows.length) + 1 : Math.floor(k / cols.length) + 1;
          const x = columnFirst ? Math.floor(k / rows.length) + 1 : (k % cols.length) + 1;
          if ((item.cell[0] && item.cell[0] !== y) || (item.cell[1] && item.cell[1] !== x))
            continue;
          if (
            (!columnFirst && x + item.cell[3]! - 1 > cols.length) ||
            (columnFirst && y + item.cell[2]! - 1 > rows.length)
          )
            continue;
          placementWork += item.cell[2]! * item.cell[3]!;
          if (placementWork > MAX_LAYOUT_GRID_WORK)
            throw new Error('Grid placement exceeds its work budget.');
          let free = true;
          for (let yy = y; yy < y + item.cell[2]!; yy++)
            for (let xx = x; xx < x + item.cell[3]!; xx++)
              if (occupied.has(`${yy}:${xx}`)) free = false;
          if (free) {
            item.cell[0] = y;
            item.cell[1] = x;
            mark(item.cell);
            found = true;
            break;
          }
        }
        if (!found) throw new Error('Grid placement exceeds the available tracks.');
      }
      const lastRow = item.cell[0]! + item.cell[2]! - 1,
        lastCol = item.cell[1]! + item.cell[3]! - 1;
      if (lastRow > MAX_LAYOUT_TRACKS_PER_AXIS || lastCol > MAX_LAYOUT_TRACKS_PER_AXIS)
        throw new Error('Grid exceeds the 1,024 track limit per axis.');
      while (rows.length < lastRow) rows.push({ kind: 'auto', value: 0 });
      while (cols.length < lastCol) cols.push({ kind: 'auto', value: 0 });
    }
  }
  return {
    mode: String(container.layout),
    direction: String(container.layoutDirection || 'row'),
    wrap: on(container.layoutWrap),
    bounds: corners(container),
    padding: sides(container, 'layoutPad'),
    gap: [number(container.layoutGapY), number(container.layoutGapX)],
    align: String(container.layoutAlign || 'start'),
    align_content: String(container.layoutAlignContent || 'start'),
    justify: String(container.layoutJustify || 'start'),
    justify_items: String(container.layoutJustifyItems || 'start'),
    sizing: [
      mode(container, 'W') === 'fill' ? 'fixed' : mode(container, 'W'),
      mode(container, 'H') === 'fill' ? 'fixed' : mode(container, 'H'),
    ],
    items,
    columns: cols,
    rows,
  };
}

export interface LayoutEvaluation {
  boxes: Row[];
  findings: LayoutFinding[];
  passes: number;
  solved: number;
  grids: LayoutGrid[];
}
export type LayoutMeasure = (
  row: Row,
  availableWidth: number
) => Promise<{ width: number; height: number }>;

function inheritVisibility(boxes: Row[], byId: Map<string, number>): void {
  for (const row of boxes) {
    let o = String(row.group && boxes[byId.get(String(row.group))!]?.kind === 'group' ? row.group : owner(row));
    while (o) {
      const ancestor = boxes[byId.get(o)!];
      if (on(ancestor?.hidden)) {
        row.hidden = true;
        break;
      }
      o = String(ancestor?.group && boxes[byId.get(String(ancestor.group))!]?.kind === 'group' ? ancestor.group : owner(ancestor || {}));
    }
  }
}
function copyGrids(grids: LayoutGrid[]): LayoutGrid[] {
  return grids.map((g) => ({
    id: g.id,
    cells: g.cells?.map((c) => ({ ...c })),
    columns: g.columns.map((t) => [...t]),
    rows: g.rows.map((t) => [...t]),
  }));
}

/** Cache complete solver requests by container. Content-only edits outside layouts do no solver work. */
export function createDesignLayoutEvaluator(solve: LayoutSolver, measure?: LayoutMeasure) {
  const memo = new Map<string, Map<string, LayoutSolverOutput>>();
  let memoBytes = 0;
  const projections = new Map<string, { geometry: Map<string, Row>; grids: LayoutGrid[] }>();
  return async (
    source: readonly Row[],
    tracks: readonly Row[] = [],
    resourceRevision: unknown = 0
  ): Promise<LayoutEvaluation> => {
    if (!Array.isArray(source) || !Array.isArray(tracks))
      return {
        boxes: [],
        findings: [
          { id: '', code: 'layout.input', message: 'Layout layers and tracks must be arrays.' },
        ],
        passes: 0,
        solved: 0,
        grids: [],
      };
    if (!hasDesignLayout(source))
      return { boxes: source as Row[], findings: [], passes: 0, solved: 0, grids: [] };
    const findings = validateDesignLayout(source, tracks);
    if (findings.length)
      return { boxes: source as Row[], findings, passes: 0, solved: 0, grids: [] };
    const boxes = source.map((r) => ({ ...r }));
    const byId = new Map(boxes.map((r, n) => [id(r), n]));
    const owner = (r: Row): string => boxes[byId.get(String(r.group || ''))!]?.kind === 'group' ? String(r.group) : String(r.layoutOwner || r.frame || '');
    const children = new Map<string, number[]>();
    for (const [n, r] of boxes.entries()) {
      const o = owner(r);
      if (o) {
        const list = children.get(o) || [];
        list.push(n);
        children.set(o, list);
      }
    }
    for (const list of children.values())
      list.sort(
        (a, b) => number(boxes[a]!.layoutOrder, a) - number(boxes[b]!.layoutOrder, b) || a - b
      );
    const containers = boxes.filter((r) => hasDesignLayout([r]));
    const depth = (r: Row) => {
      let d = 0,
        o = owner(r);
      while (o) {
        d++;
        o = owner(boxes[byId.get(o)!] || {});
      }
      return d;
    };
    containers.sort((a, b) => depth(b) - depth(a));
    const participating = new Set(containers.map(id)),
      pending = [...participating];
    for (let n = 0; n < pending.length; n++)
      for (const index of children.get(pending[n]!) || []) {
        const child = id(boxes[index]!);
        if (!participating.has(child)) {
          participating.add(child);
          pending.push(child);
        }
      }
    const ancestors = new Set<string>();
    for (const container of containers) {
      let o = owner(container);
      while (o) {
        if (!participating.has(o)) ancestors.add(o);
        o = owner(boxes[byId.get(o)!] || {});
      }
    }
    const geometryKey = JSON.stringify([
      resourceRevision,
      source
        .filter((r) => participating.has(id(r)))
        .map((r) => {
          const fields = Object.keys(r)
            .filter(
              (k) =>
                k.startsWith('layout') ||
                ['id', 'x', 'y', 'w', 'h', 'rot', 'frame', 'group', 'hidden', 'kind', 'textStory'].includes(
                  k
                )
            )
            .sort();
          const shape = fields.map((k) => [k, r[k]]);
          // Only intrinsically sized plain text can make content affect geometry.
          if (
            isText(r) &&
            !r.textStory &&
            !on(r.hidden) &&
            !on(r.layoutAbsolute) &&
            (mode(r, 'W') === 'hug' || mode(r, 'H') === 'hug')
          )
            shape.push(['intrinsic', r]);
          if (r.kind === 'image' && (mode(r, 'W') === 'hug' || mode(r, 'H') === 'hug'))
            shape.push(['image', r.image]);
          return shape;
        }),
      source.filter((r) => ancestors.has(id(r))).map((r) => [id(r), owner(r), r.hidden, r.kind]),
      tracks,
    ]);
    const cached = projections.get(geometryKey);
    if (cached)
      return {
        boxes: source.map((r) => ({ ...r, ...cached.geometry.get(id(r)) })),
        findings: [],
        passes: 0,
        solved: 0,
        grids: copyGrids(cached.grids),
      };
    inheritVisibility(boxes, byId);
    let solved = 0,
      passes = 0,
      work = 0;
    const grids = new Map<string, LayoutGrid>();
    const active = new Set(containers.map(id));
    for (const k of memo.keys())
      if (!active.has(k)) {
        for (const key of memo.get(k)!.keys()) memoBytes -= key.length * 2;
        memo.delete(k);
      }
    try {
      for (; passes < MAX_LAYOUT_PASSES; passes++) {
        const before = boxes.map((r) => [r.x, r.y, r.w, r.h, r.rot].join(','));
        for (const c of containers) {
          const index = byId.get(id(c))!;
          const container = boxes[index]!;
          const members = children.get(id(c)) || [];
          work += members.length + 1;
          if (work > MAX_LAYOUT_REFLOW_WORK)
            throw new Error('Layout exceeds its aggregate reflow work budget.');
          for (const n of members) {
            const row = boxes[n]!;
            if (row.layoutAngle !== '' && row.layoutAngle != null)
              boxes[n] = { ...row, rot: number(container.rot) + number(row.layoutAngle) };
            if (
              on(row.layoutAbsolute) &&
              row.layoutX !== '' &&
              row.layoutX != null &&
              row.layoutY !== '' &&
              row.layoutY != null
            ) {
              const b = corners(container),
                a = (number(container.rot) * Math.PI) / 180,
                u = [cos(a), sin(a)],
                v = [-sin(a), cos(a)],
                r = boxes[n]!;
              const angle = (number(r.rot) * Math.PI) / 180,
                cc = cos(angle),
                ss = sin(angle),
                w = number(r.w, 100),
                h = number(r.h, 100);
              const nx = b[0]! + u[0]! * number(row.layoutX) + v[0]! * number(row.layoutY),
                ny = b[1]! + u[1]! * number(row.layoutX) + v[1]! * number(row.layoutY);
              boxes[n] = {
                ...r,
                x: nx + (cc * w) / 2 - (ss * h) / 2 - w / 2,
                y: ny + (ss * w) / 2 + (cc * h) / 2 - h / 2,
              };
            }
          }
          for (const n of members) {
            let r = boxes[n]!;
            if (
              r.kind === 'image' &&
              r.image &&
              !on(r.hidden) &&
              !on(r.layoutAbsolute) &&
              (mode(r, 'W') === 'hug' || mode(r, 'H') === 'hug')
            ) {
              const image = r.image as Row,
                iw = Number(image.width),
                ih = Number(image.height);
              if (![iw, ih].every((n) => Number.isFinite(n) && n > 0 && n <= MAX_LAYOUT_SCALAR))
                throw new Error(
                  'An image with content sizing needs its intrinsic width and height. Reopen or replace the asset.'
                );
              const width =
                mode(r, 'W') === 'hug'
                  ? mode(r, 'H') === 'hug'
                    ? iw
                    : (number(r.h) * iw) / ih
                  : number(r.w);
              const height = mode(r, 'H') === 'hug' ? (width * ih) / iw : number(r.h);
              boxes[n] = r = { ...r, w: width, h: height };
            }
            if (
              !measure &&
              isText(r) &&
              !r.textStory &&
              !on(r.hidden) &&
              !on(r.layoutAbsolute) &&
              (mode(r, 'W') === 'hug' || mode(r, 'H') === 'hug')
            )
              throw new Error('Text with content sizing needs a font measurement capability.');
            if (
              !measure ||
              !isText(r) ||
              r.textStory ||
              on(r.hidden) ||
              on(r.layoutAbsolute) ||
              (mode(r, 'W') !== 'hug' && mode(r, 'H') !== 'hug')
            )
              continue;
            const measured = await measure(
              r,
              mode(r, 'W') === 'hug' ? MAX_LAYOUT_SCALAR : number(r.w, 100)
            );
            boxes[n] = {
              ...r,
              ...(mode(r, 'W') === 'hug' ? { w: Math.max(0.01, measured.width) } : {}),
              ...(mode(r, 'H') === 'hug' ? { h: Math.max(0.01, measured.height) } : {}),
            };
          }
          const req = designLayoutRequest(
            container,
            members.map((n) => boxes[n]!),
            tracks
          );
          const key = JSON.stringify(req);
          let entries = memo.get(id(c));
          if (!entries) {
            entries = new Map();
            memo.set(id(c), entries);
          }
          let answer = entries.get(key);
          if (!answer) {
            answer = solve(req);
            solved++;
            if (entries.size >= MAX_LAYOUT_SOLVER_CACHE_ENTRIES) {
              const first = entries.keys().next().value!;
              memoBytes -= first.length * 2;
              entries.delete(first);
            }
            if (memoBytes + key.length * 2 > MAX_LAYOUT_SOLVER_CACHE_BYTES) {
              memo.clear();
              memoBytes = 0;
              entries = new Map();
              memo.set(id(c), entries);
            }
            entries.set(key, answer);
            memoBytes += key.length * 2;
          }
          const result = answer.bounds;
          if (container.layout === 'grid')
            grids.set(id(c), {
              id: id(c),
              columns: answer.columns || [],
              rows: answer.rows || [],
              cells: req.items.flatMap((item, n) =>
                item.hidden || item.absolute
                  ? []
                  : [
                      {
                        id: id(boxes[members[n]!]!),
                        row: item.cell[0]!,
                        column: item.cell[1]!,
                        rowSpan: item.cell[2]!,
                        columnSpan: item.cell[3]!,
                      },
                    ]
              ),
            });
          if (
            result.length !== members.length + 1 ||
            result.some((b) => b.length !== 8 || b.some((n) => !Number.isFinite(n)))
          )
            throw new Error('Layout solver returned invalid bounds.');
          const next = fromCorners(container, result[0]!);
          boxes[index] = next;
          for (const [i, n] of members.entries()) {
            const old = boxes[n]!;
            const nextChild = fromCorners(old, result[i + 1]!);
            boxes[n] = nextChild;
            // Moving a frame or layout container carries descendants without scaling them.
            if (
              (old.kind === 'frame' || old.kind === 'group' || hasDesignLayout([old])) &&
              (nextChild.x !== old.x || nextChild.y !== old.y)
            ) {
              const dx = number(nextChild.x) - number(old.x),
                dy = number(nextChild.y) - number(old.y);
              const pending = [...(children.get(id(old)) || [])];
              for (let q = 0; q < pending.length; q++) {
                if (++work > MAX_LAYOUT_REFLOW_WORK)
                  throw new Error('Layout exceeds its aggregate reflow work budget.');
                const child = pending[q]!,
                  r = boxes[child]!;
                boxes[child] = { ...r, x: number(r.x) + dx, y: number(r.y) + dy };
                pending.push(...(children.get(id(r)) || []));
              }
            }
          }
        }
        if (boxes.every((r, n) => before[n] === [r.x, r.y, r.w, r.h, r.rot].join(','))) break;
      }
      if (passes === 16)
        throw new Error(
          'Layout did not settle within 16 passes. Check content and fill sizing dependencies.'
        );
      // Existing renderers receive artboard membership as a derived projection.
      for (const r of boxes)
        if (r.layoutOwner || boxes[byId.get(String(r.group))!]?.kind === 'group') {
          let o = owner(r);
          while (o) {
            const p = boxes[byId.get(o)!];
            if (p?.kind === 'frame') {
              r.frame = o;
              break;
            }
            o = owner(p || {});
          }
        }
      inheritVisibility(boxes, byId);
      const gridResults = [...grids.values()];
      if (geometryKey.length < MAX_LAYOUT_PROJECTION_KEY_CHARS) {
        const geometry = new Map<string, Row>();
        for (const row of boxes)
          if (participating.has(id(row)))
            geometry.set(id(row), {
              x: row.x,
              y: row.y,
              w: row.w,
              h: row.h,
              rot: row.rot,
              ...((row.layoutOwner || row.group) && 'frame' in row ? { frame: row.frame } : {}),
              ...(row.hidden !== source[byId.get(id(row))!]!.hidden ? { hidden: row.hidden } : {}),
            });
        if (projections.size >= MAX_LAYOUT_PROJECTIONS)
          projections.delete(projections.keys().next().value!);
        projections.set(geometryKey, { geometry, grids: gridResults });
      }
      return { boxes, findings: [], passes: passes + 1, solved, grids: copyGrids(gridResults) };
    } catch (e) {
      return {
        boxes: source as Row[],
        findings: [{ id: '', code: 'layout.evaluation', message: (e as Error).message }],
        passes,
        solved,
        grids: [],
      };
    }
  };
}

/** Restore source fields after canvas reads evaluated geometry. Only intentional changes are written. */
export function designLayoutSourceEdit(
  source: readonly Row[],
  evaluated: readonly Row[],
  proposed: readonly Row[]
): Row[] {
  const src = new Map(source.map((r) => [id(r), r])),
    prev = new Map(evaluated.map((r) => [id(r), r]));
  return proposed.map((r) => {
    const old = src.get(id(r)),
      shown = prev.get(id(r));
    if (!old || !shown) return r;
    const next = { ...r };
    for (const k of ['x', 'y', 'w', 'h', 'rot', 'frame', 'hidden'])
      if (r[k] === shown[k]) {
        if (k in old) next[k] = old[k];
        else delete next[k];
      }
    if (
      old.layoutOwner ||
      old.layout === 'flex' ||
      old.layout === 'grid' ||
      src.get(owner(old))?.layout === 'flex' ||
      src.get(owner(old))?.layout === 'grid'
    ) {
      if (r.w !== shown.w) next.layoutW = 'fixed';
      if (r.h !== shown.h) next.layoutH = 'fixed';
    }
    return next;
  });
}

/** Copy/delete scope uses ownership, independently of the visible artboard projection. */
export function designLayoutDescendants(
  rows: readonly Row[],
  selected: ReadonlySet<string>
): Set<string> {
  const result = new Set(selected), pending = [...result];
  const index = designHierarchyIndex(rows);
  for (let n = 0; n < pending.length; n++)
    for (const child of index.children.get(pending[n]!) || [])
      if (!result.has(child)) { result.add(child); pending.push(child); }
  return result;
}
export function remapDesignLayout(
  rows: readonly Row[],
  tracks: readonly Row[],
  copies: ReadonlyMap<string, string>
) {
  const mapped = rows.map((r) => {
    const next: Row = { ...r, id: copies.get(id(r)) || id(r) };
    for (const key of ['layoutOwner', 'frame'])
      if (copies.has(String(r[key]))) next[key] = copies.get(String(r[key]));
    if (next.layoutOwner) next.frame = '';
    return next;
  });
  return {
    boxes: mapped,
    tracks: tracks
      .filter((t) => copies.has(String(t.container)))
      .map((t) => ({ ...t, container: copies.get(String(t.container)) })),
  };
}
