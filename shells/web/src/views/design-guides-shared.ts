// SPDX-License-Identifier: MPL-2.0
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
// Copyright (c) KALEIDOS SUBSIDIARY SL
/** Shared state for the Design adapter of Penpot's guide and ruler feedback. */
import type { DesignGuide } from './design-ports.ts';

export const GUIDE_RULER_SIZE = 22;
export interface GuideSelectionBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}
export interface DesignGuidesOptions {
  stageEl: HTMLElement;
  canvasEl: HTMLElement;
  read(): unknown;
  commit(value: string): void;
  initiallyVisible?: boolean;
  canEdit?(): boolean;
  onSelect?(): void;
  onInspect?(): void;
}
export interface GuideLayout {
  stage: DOMRect;
  canvas: DOMRect;
  xScale: number;
  yScale: number;
  topInset: number;
  leftInset: number;
}
export interface GuidePointer {
  clientX: number;
  clientY: number;
  shiftKey: boolean;
}
export interface GuideDrag {
  guide: DesignGuide;
  original: DesignGuide;
  pointerId: number;
  isNew: boolean;
  target: Element;
  previousSelection: string | null;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
  moved: boolean;
  removing: boolean;
  latest: GuidePointer;
}
export interface GuideView {
  root: HTMLDivElement;
  corner: HTMLButtonElement;
  top: HTMLDivElement;
  left: HTMLDivElement;
  lines: HTMLDivElement;
  pills: HTMLDivElement;
  lineNodes: Map<string, HTMLButtonElement>;
  pillNodes: Map<string, HTMLDivElement>;
  lastLayout: GuideLayout | null;
  paint(): void;
  preview(layout: GuideLayout): void;
  feedback(id: string): void;
  measure(): GuideLayout;
  setSelectionBounds(bounds: GuideSelectionBounds | null): void;
  destroy(): void;
}
export interface GuideInteractions {
  cancel(event?: PointerEvent): void;
  closeEditor(): void;
  edit(id: string): void;
  destroy(): void;
}
export interface GuideContext {
  opts: DesignGuidesOptions;
  guides: DesignGuide[];
  source: unknown;
  selectedId: string | null;
  hoveredId: string | null;
  visible: boolean;
  destroyed: boolean;
  drag: GuideDrag | null;
  listeners: Set<() => void>;
  view: GuideView;
  interaction: GuideInteractions;
  model: {
    select(id: string | null): void;
    update(id: string, patch: Partial<Omit<DesignGuide, 'id'>>): void;
    remove(id: string): void;
    commit(next: DesignGuide[]): void;
    notify(): void;
  };
}
/** Keep finite coordinates finite when two-decimal scaling exceeds the numeric range. */
export function roundGuideValue(value: number): number {
  const scaled = value * 100;
  return Number.isFinite(scaled) ? Math.round(scaled) / 100 : value;
}
/** Adapted from modern rulers.rs format_label: two decimals, no trailing zeroes or negative zero. */
export function guideNumber(value: number): string {
  const rounded = Math.sign(value) * roundGuideValue(Math.abs(value));
  return String(rounded === 0 ? 0 : rounded);
}
export function guideAxis(guide: DesignGuide): 'x' | 'y' | 'angled' {
  const rotation = ((guide.rotation % 180) + 180) % 180;
  return rotation === 90 ? 'x' : rotation === 0 ? 'y' : 'angled';
}
export function guidePosition(guide: DesignGuide): number {
  const axis = guideAxis(guide);
  if (axis === 'x') return guide.x;
  if (axis === 'y') return guide.y;
  const angle = (guide.rotation * Math.PI) / 180;
  return -Math.sin(angle) * guide.x + Math.cos(angle) * guide.y;
}
export function guidePoint(layout: GuideLayout, point: GuidePointer): { x: number; y: number } {
  return {
    x: (point.clientX - layout.canvas.left) / layout.xScale,
    y: (point.clientY - layout.canvas.top) / layout.yScale,
  };
}
export function guideCanEdit(g: GuideContext): boolean {
  return !g.destroyed && (g.opts.canEdit?.() ?? true);
}
export function guideOverRuler(layout: GuideLayout, point: GuidePointer): boolean {
  const x = point.clientX - layout.stage.left,
    y = point.clientY - layout.stage.top;
  const { topInset: top, leftInset: left } = layout;
  return (
    (x >= left && x <= layout.stage.width && y >= top && y <= top + GUIDE_RULER_SIZE) ||
    (y >= top && y <= layout.stage.height && x >= left && x <= left + GUIDE_RULER_SIZE)
  );
}
