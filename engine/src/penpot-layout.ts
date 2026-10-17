// SPDX-License-Identifier: MPL-2.0
/** Current binfile-v3 layout properties. Geometry comes from the newer Rust kernel. */
import { designLayoutRequest, hasDesignLayout, validateDesignLayout, type LayoutFinding } from './design-layout.ts';
import { cos, sin } from './geom/portable-math.ts';

type Row = Record<string, unknown>;
const ROOT = '00000000-0000-0000-0000-000000000000';
const SIDES = ['Top', 'Right', 'Bottom', 'Left'] as const;
const sizing = (value: unknown): string => value === 'auto' ? 'hug' : value === 'fill' ? 'fill' : 'fixed';
const ppSizing = (value: unknown): string => value === 'hug' ? 'auto' : value === 'fill' ? 'fill' : 'fix';
const num = (value: unknown, fallback = 0): number => value == null || value === '' ? fallback : Number(value);
const record = (value: unknown): Row => value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};

export function penpotHasLayout(shapes: Record<string, Row>): boolean {
  return Object.values(shapes).some(shape => shape.layout === 'flex' || shape.layout === 'grid');
}

/** One `penpot:layout` declaration read from a legacy Penpot SVG page. */
export interface PenpotSvgLayout { id?: string; name?: string; layout?: string }

/**
 * A legacy SVG page declares layouts beside artwork Penpot has already positioned. Its
 * drawn elements carry no parent and children records, so there is no membership to
 * map. Each declared container becomes a finding and the page keeps its exported
 * positions. Records without a declaration produce nothing: no layout is inferred.
 */
export function penpotSvgLayoutFindings(layouts: readonly PenpotSvgLayout[]): LayoutFinding[] {
  const findings: LayoutFinding[] = [], seen = new Set<string>();
  for (const entry of layouts) {
    const layout = String(entry.layout ?? '').trim().toLowerCase(), id = String(entry.id ?? '').trim();
    if (!layout || (id && seen.has(id))) continue;
    if (id) seen.add(id);
    const name = String(entry.name ?? '').trim().slice(0, 80);
    const kind = layout === 'flex' || layout === 'grid' ? `a ${layout} layout` : 'a layout';
    findings.push({ id, code: 'penpot.layout.svg-static',
      message: `${name ? `The Penpot layer “${name}”` : 'A Penpot layer'} uses ${kind}. This SVG import keeps its layers at their exported positions without the layout rules. Import the .penpot export to keep the layout editable.` });
  }
  return findings;
}

/** Mirrors children_paint_order in the pinned newer renderer, including flex direction. */
export function penpotChildrenPaintOrder(shape: Row, shapes: Record<string, Row>): string[] {
  const ids = Array.isArray(shape.shapes) ? shape.shapes.map(String) : [];
  if (shape.layout !== 'flex' && shape.layout !== 'grid') return ids;
  const topFirst = [...ids].reverse();
  if (shape.layout === 'flex' && !String(shape.layoutFlexDir || 'row').endsWith('-reverse')) topFirst.reverse();
  topFirst.sort((a, b) => num(shapes[b]?.layoutItemZIndex) - num(shapes[a]?.layoutItemZIndex));
  return topFirst.reverse();
}

function topLeft(row: Row): [number, number] {
  const w = num(row.w), h = num(row.h), angle = num(row.rot) * Math.PI / 180;
  return [num(row.x) + w / 2 - w / 2 * cos(angle) + h / 2 * sin(angle),
    num(row.y) + h / 2 - w / 2 * sin(angle) - h / 2 * cos(angle)];
}

/** Source IDs must be aligned with the finalized boxes, including skipped degenerate nodes. */
export function importPenpotLayouts(boxes: Row[], sourceIds: readonly string[], shapes: Record<string, Row>, options: { preserveHierarchy?: boolean } = {}) {
  const findings: LayoutFinding[] = [], tracks: Row[] = [];
  if (!penpotHasLayout(shapes) && !options.preserveHierarchy && !boxes.some(box => box.kind === 'group')) return { boxes, tracks, findings };
  const add = (id: unknown, code: string, message: string) => findings.push({ id: String(id || ''), code, message });
  if (sourceIds.length !== boxes.length || new Set(sourceIds).size !== sourceIds.length) {
    add('', 'penpot.layout.identity', 'Penpot source identities are not aligned with imported layers.');
    return { boxes, tracks, findings };
  }
  const mapped = new Map(sourceIds.map((sourceId, n) => [sourceId, boxes[n]!]));
  for (const sourceId of sourceIds) {
    const shape = shapes[sourceId];
    if (shape?.layout !== 'flex' && shape?.layout !== 'grid') continue;
    for (const child of Array.isArray(shape.shapes) ? shape.shapes : []) {
      if (!mapped.has(String(child))) add(sourceId, 'penpot.layout.child', 'A layout layer could not be retained during import.');
    }
  }
  const result = boxes.map((box, n) => {
    const sourceId = sourceIds[n]!, shape = shapes[sourceId] || {}, row = { ...box };
    const parent = shapes[String(shape.parentId)] || {};
    if (typeof shape.name === 'string') row.name = shape.name;
    if (shape.type === 'frame') row.kind = String(shape.parentId) === ROOT ? 'frame' : 'box';
    if (shape.hidden === true) row.hidden = true;
    if (parent.type === 'group' && mapped.get(String(shape.parentId))?.kind === 'group') {
      const parentBox = mapped.get(String(shape.parentId));
      if (!parentBox) add(box.id, 'penpot.hierarchy.owner', 'An owning group was not retained during import.');
      else {
        row.group = parentBox.id; row.frame = ''; row.layoutOwner = '';
        if (!Array.isArray(parent.shapes) || !parent.shapes.includes(sourceId)) add(box.id, 'penpot.hierarchy.membership', 'The group parent and children records disagree.');
      }
    } else if (parent.layout === 'flex' || parent.layout === 'grid') {
      const parentBox = mapped.get(String(shape.parentId));
      if (!parentBox) add(box.id, 'penpot.layout.owner', 'A layout container was not retained during import.');
      else {
        row.layoutOwner = parentBox.id;
        row.frame = '';
        row.layoutAngle = num(box.rot) - num(parentBox.rot);
        if (shape.layoutItemAbsolute === true) {
          const [px, py] = topLeft(parentBox), [cx, cy] = topLeft(box);
          const angle = num(parentBox.rot) * Math.PI / 180;
          row.layoutX = (cx - px) * cos(angle) + (cy - py) * sin(angle);
          row.layoutY = -(cx - px) * sin(angle) + (cy - py) * cos(angle);
        }
      }
      const at = Array.isArray(parent.shapes) ? parent.shapes.indexOf(sourceId) : -1;
      row.layoutOrder = parent.layout === 'flex' && at >= 0 ? (parent.shapes as unknown[]).length - at - 1 : at;
      if (at === -1) add(box.id, 'penpot.layout.membership', 'The layout parent and children records disagree.');
      if (shape.type === 'group' && box.kind !== 'group' && Array.isArray(shape.shapes) && shape.shapes.some(child => mapped.has(String(child))))
        add(box.id, 'penpot.layout.group', 'A group in a dynamic layout must be retained as a group or one vector asset.');

    } else if (mapped.has(String(shape.frameId))) {
      const frame = mapped.get(String(shape.frameId))!, frameShape = shapes[String(shape.frameId)];
      if (frameShape?.type === 'frame' && String(frameShape.parentId) === ROOT) row.frame = frame.id;
    }
    if (row.layoutOwner || row.kind === 'group' || shape.layout === 'flex' || shape.layout === 'grid') {
      row.layoutW = sizing(shape.layoutItemHSizing);
      row.layoutH = sizing(shape.layoutItemVSizing);
      for (const [source, target] of [['layoutItemMinW', 'layoutMinW'], ['layoutItemMaxW', 'layoutMaxW'], ['layoutItemMinH', 'layoutMinH'], ['layoutItemMaxH', 'layoutMaxH']] as const) {
        if (shape[source] != null) row[target] = shape[source];
      }
      if (shape.layoutItemAbsolute === true) row.layoutAbsolute = true;
      if (shape.layoutItemAlignSelf) row.layoutSelf = shape.layoutItemAlignSelf;
      const margin = record(shape.layoutItemMargin);
      SIDES.forEach((side, i) => { row[`layoutMargin${side}`] = num(margin[`m${shape.layoutItemMarginType === 'multiple' ? i + 1 : i % 2 + 1}`]); });
    }
    if (shape.layout === 'flex' || shape.layout === 'grid') {
      row.layout = shape.layout;
      row.layoutDirection = shape.layout === 'grid' ? shape.layoutGridDir || 'row' : shape.layoutFlexDir || 'row';
      row.layoutWrap = shape.layoutWrapType === 'wrap';
      const padding = record(shape.layoutPadding), gap = record(shape.layoutGap);
      SIDES.forEach((side, i) => { row[`layoutPad${side}`] = num(padding[`p${shape.layoutPaddingType === 'simple' ? i % 2 + 1 : i + 1}`]); });
      row.layoutGapX = num(gap.columnGap); row.layoutGapY = num(gap.rowGap);
      row.layoutAlign = shape.layoutAlignItems || 'start'; row.layoutAlignContent = shape.layoutAlignContent || 'stretch';
      row.layoutJustify = shape.layoutJustifyContent || 'start'; row.layoutJustifyItems = shape.layoutJustifyItems || 'start';
      if (shape.layout === 'grid') {
        for (const [axis, key] of [['column', 'layoutGridColumns'], ['row', 'layoutGridRows']] as const) {
          const list = Array.isArray(shape[key]) ? shape[key] as Row[] : [];
          list.forEach((track, order) => {
            const type = String(track.type), value = num(track.value);
            if (!['auto', 'flex', 'percent', 'fixed'].includes(type)) add(box.id, 'penpot.layout.track', `Unsupported Penpot track type: ${type}.`);
            tracks.push({ id: `${box.id}:${axis}:${order}`, container: box.id, axis, order,
              track: type === 'auto' ? 'auto' : `${value}${type === 'flex' ? 'fr' : type === 'percent' ? '%' : 'px'}` });
          });
        }
      }
    }
    return row;
  });
  const resultMap = new Map(result.map(row => [row.id, row]));
  for (const sourceId of sourceIds) {
    const shape = shapes[sourceId]!;
    if (shape?.layout !== 'grid') continue;
    const cells = Object.values(record(shape.layoutGridCells));
    const assigned = new Set<string>();
    for (const raw of cells) {
      const cell = record(raw), children = Array.isArray(cell.shapes) ? cell.shapes : [];
      if (!children.length) {
        if (cell.areaName || cell.position === 'manual' || cell.position === 'area') add(sourceId, 'penpot.layout.empty-cell', 'Empty named or manually placed grid cells cannot be represented in this document.');
        continue;
      }
      if (children.length > 1) add(sourceId, 'penpot.layout.cell-count', 'A grid cell with more than one layer cannot be represented in this document.');
      for (const childId of children) {
        const box = mapped.get(String(childId)), row = box && resultMap.get(box.id);
        if (!row) { add(sourceId, 'penpot.layout.cell', 'A grid cell references a shape that could not be imported.'); continue; }
        if (row.layoutOwner !== mapped.get(sourceId)?.id) { add(row.id, 'penpot.layout.cell-owner', 'A grid cell and the shape parent disagree.'); continue; }
        if (assigned.has(String(childId))) add(row.id, 'penpot.layout.cell-duplicate', 'A layer is assigned to more than one grid cell.');
        assigned.add(String(childId));
        // Auto cells retain flow intent. Their resolved row/column are disposable geometry.
        Object.assign(row, { layoutRow: cell.position === 'manual' || cell.position === 'area' ? cell.row : 0,
          layoutColumn: cell.position === 'manual' || cell.position === 'area' ? cell.column : 0,
          layoutRowSpan: cell.rowSpan ?? 1, layoutColumnSpan: cell.columnSpan ?? 1,
          layoutSelf: cell.alignSelf || 'auto', layoutJustifySelf: cell.justifySelf || 'auto', layoutArea: cell.areaName || '' });
      }
    }
  }
  return { boxes: result, tracks, findings: [...findings, ...validateDesignLayout(result, tracks)] };
}

/** Native editable attributes. The archive writer replaces source layer IDs with UUIDs. */
export function exportPenpotLayout(row: Row, children: readonly Row[], tracks: readonly Row[]): Row {
  const props: Row = {};
  if (row.layoutOwner || row.kind === 'group' || hasDesignLayout([row])) {
    props.layoutItemHSizing = ppSizing(row.layoutW); props.layoutItemVSizing = ppSizing(row.layoutH);
    props.layoutItemMarginType = 'multiple';
    props.layoutItemMargin = Object.fromEntries(SIDES.map((side, n) => [`m${n + 1}`, num(row[`layoutMargin${side}`])]));
    if (row.layoutAbsolute === true) props.layoutItemAbsolute = true;
    if (row.layoutSelf && row.layoutSelf !== 'auto') props.layoutItemAlignSelf = row.layoutSelf;
    for (const [target, source] of [['layoutItemMinW', 'layoutMinW'], ['layoutItemMaxW', 'layoutMaxW'], ['layoutItemMinH', 'layoutMinH'], ['layoutItemMaxH', 'layoutMaxH']] as const) {
      if (row[source] !== '' && row[source] != null) props[target] = Number(row[source]);
    }
  }
  if (!hasDesignLayout([row])) return props;
  Object.assign(props, { layout: row.layout, layoutGapType: 'multiple',
    layoutGap: { rowGap: num(row.layoutGapY), columnGap: num(row.layoutGapX) }, layoutPaddingType: 'multiple',
    layoutPadding: Object.fromEntries(SIDES.map((side, n) => [`p${n + 1}`, num(row[`layoutPad${side}`])])),
    layoutAlignItems: row.layoutAlign || 'start', layoutAlignContent: row.layoutAlignContent || 'stretch',
    layoutJustifyItems: row.layoutJustifyItems || 'start', layoutJustifyContent: row.layoutJustify || 'start' });
  if (row.layout === 'flex') {
    Object.assign(props, { layoutFlexDir: row.layoutDirection || 'row', layoutWrapType: row.layoutWrap === true ? 'wrap' : 'nowrap' });
    return props;
  }
  props.layoutGridDir = row.layoutDirection || 'row';
  const request = designLayoutRequest(row, [...children], tracks);
  const cells = children.flatMap((child, n) => {
    if (child.layoutAbsolute === true || child.hidden === true) return [];
    const cell = request.items[n]!.cell;
    return [{ row: cell[0], column: cell[1], rowSpan: cell[2], columnSpan: cell[3],
      position: child.layoutArea ? 'area' : child.layoutRow && child.layoutColumn ? 'manual' : 'auto',
      areaName: child.layoutArea || '', alignSelf: child.layoutSelf || 'auto', justifySelf: child.layoutJustifySelf || 'auto', shapes: [String(child.id)] }];
  });
  props.layoutGridColumns = request.columns.map(track => ({ type: track.kind === 'fr' ? 'flex' : track.kind, value: track.value }));
  props.layoutGridRows = request.rows.map(track => ({ type: track.kind === 'fr' ? 'flex' : track.kind, value: track.value }));
  props.layoutGridCells = cells;
  return props;
}
