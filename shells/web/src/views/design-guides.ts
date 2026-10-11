// SPDX-License-Identifier: MPL-2.0
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
// Copyright (c) KALEIDOS SUBSIDIARY SL
/** Rulers and persistent authoring guides for the Design canvas. */

import { createGuideInteractions } from './design-guides-interactions.ts';
import { createGuideView } from './design-guides-view.ts';
import {
  guideCanEdit,
  roundGuideValue,
  type DesignGuidesOptions,
  type GuideContext,
  type GuideSelectionBounds,
} from './design-guides-shared.ts';
export type { DesignGuidesOptions, GuideSelectionBounds } from './design-guides-shared.ts';
export { rulerStep } from './design-guides-rulers.ts';
import type { DesignGuide, DesignGuidePort } from './design-ports.ts';
import type { SnapLines } from './free-canvas-math.ts';

export interface DesignGuideSet {
  /** Vertical guides, in document/CSS pixels from the canvas origin. */
  x: number[];
  /** Horizontal guides, in document/CSS pixels from the canvas origin. */
  y: number[];
}

export interface DesignGuidesHandle extends DesignGuidePort {
  el: HTMLElement;
  isVisible(): boolean;
  setVisible(visible: boolean): void;
  toggle(): void;
  clear(): void;
  hasGuides(): boolean;
  /** Re-read the model and repaint after undo, zoom, pan, resize or locale change. */
  sync(): void;
  /** Positions consumed by the canvas smart-snap path. */
  snapTargets(): SnapLines;
  setSelectionBounds(bounds: GuideSelectionBounds | null): void;
  destroy(): void;
}

function finiteSorted(values: unknown): number[] {
  if (!Array.isArray(values)) return [];
  return [
    ...new Set(
      values
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value))
        .map(roundGuideValue)
    ),
  ].sort((a, b) => a - b);
}

/** Parse both the compact v1 wire form and the old/debug JSON shape defensively. */
export function parseDesignGuides(value: unknown): DesignGuideSet {
  if (value && typeof value === 'object') {
    const row = value as Partial<DesignGuideSet>;
    return { x: finiteSorted(row.x), y: finiteSorted(row.y) };
  }
  const source = String(value ?? '').trim();
  if (!source) return { x: [], y: [] };
  if (source.startsWith('{')) {
    try {
      return parseDesignGuides(JSON.parse(source));
    } catch {
      return { x: [], y: [] };
    }
  }
  const result: DesignGuideSet = { x: [], y: [] };
  for (const part of source.replace(/^1\|/, '').split(';')) {
    const [axis, raw = ''] = part.split('=', 2);
    if (axis === 'x' || axis === 'y') result[axis] = finiteSorted(raw ? raw.split(',') : []);
  }
  return result;
}

/** Compact enough to remain friendly in Design's continuously-synchronised URL. */
export function serializeDesignGuides(guides: DesignGuideSet): string {
  const n = (value: number): string => String(roundGuideValue(value));
  const x = finiteSorted(guides.x).map(n).join(',');
  const y = finiteSorted(guides.y).map(n).join(',');
  return x || y ? `1|x=${x};y=${y}` : '';
}

/** v2 keeps identity and editable properties; v1 URLs remain readable. */
export function parseGuideRecords(value: unknown): DesignGuide[] {
  const source = String(value ?? '');
  if (!source.startsWith('2|')) {
    const old = parseDesignGuides(value);
    return [
      ...old.x.map((x, i) => ({ id: `x${i}`, x, y: 0, rotation: 90, color: '', snap: true })),
      ...old.y.map((y, i) => ({ id: `y${i}`, x: 0, y, rotation: 0, color: '', snap: true })),
    ];
  }
  try {
    const rows: unknown = JSON.parse(source.slice(2));
    if (!Array.isArray(rows)) return [];
    const ids = new Set<string>();
    return rows.slice(0, 1000).flatMap((row): DesignGuide[] => {
      if (!Array.isArray(row)) return [];
      const [id, x, y, rotation, color, snap] = row;
      if (typeof id !== 'string' || !/^[\w-]{1,80}$/.test(id) || ids.has(id)) return [];
      if (![x, y, rotation].every((v) => typeof v === 'number' && Number.isFinite(v))) return [];
      ids.add(id);
      return [
        normaliseGuide({
          id,
          x,
          y,
          rotation,
          color: typeof color === 'string' ? color : '',
          snap: snap !== false,
        }),
      ];
    });
  } catch {
    return [];
  }
}

function normaliseGuide(guide: DesignGuide): DesignGuide {
  // A colour is data, never an arbitrary CSS declaration or a resource URL.
  const color = /^(?:#[\da-f]{3,8}|(?:rgb|rgba|hsl|hsla|oklch|oklab|color|var)\([^;{}]+\))$/i.test(
    guide.color
  )
    ? guide.color
    : '';
  return {
    ...guide,
    x: roundGuideValue(guide.x),
    y: roundGuideValue(guide.y),
    rotation: roundGuideValue(((guide.rotation % 360) + 360) % 360),
    color,
  };
}

export function serializeGuideRecords(guides: readonly DesignGuide[]): string {
  return guides.length
    ? '2|' +
        JSON.stringify(
          guides.map(normaliseGuide).map((g) => [g.id, g.x, g.y, g.rotation, g.color, g.snap])
        )
    : '';
}

export function guideSnapTargets(guides: readonly DesignGuide[]): SnapLines {
  const x: number[] = [],
    y: number[] = [];
  const angled: NonNullable<SnapLines['angled']>[number][] = [];
  for (const guide of guides) {
    if (!guide.snap) continue;
    const rotation = ((guide.rotation % 180) + 180) % 180;
    if (rotation === 90) x.push(guide.x);
    else if (rotation === 0) y.push(guide.y);
    else angled.push({ x: guide.x, y: guide.y, rotation });
  }
  return { x: finiteSorted(x), y: finiteSorted(y), ...(angled.length ? { angled } : {}) };
}

function notify(g: GuideContext): void {
  for (const listener of [...g.listeners]) listener();
}
function select(g: GuideContext, id: string | null): void {
  const next = g.guides.some((guide) => guide.id === id) ? id : null;
  if (next === g.selectedId) return;
  const previous = g.selectedId;
  g.interaction.closeEditor();
  g.selectedId = next;
  if (next) g.opts.onSelect?.();
  if (previous) g.view.feedback(previous);
  if (next) g.view.feedback(next);
  notify(g);
}
function commit(g: GuideContext, next: DesignGuide[]): void {
  if (!guideCanEdit(g)) return;
  const normalised = next.map(normaliseGuide),
    value = serializeGuideRecords(normalised);
  if (value !== serializeGuideRecords(g.guides)) {
    if (g.drag) {
      const selection = g.selectedId;
      g.interaction.cancel();
      g.selectedId = selection;
    }
    g.interaction.closeEditor();
    g.guides = normalised;
    g.source = value;
    if (!g.guides.some((guide) => guide.id === g.selectedId)) g.selectedId = null;
    g.opts.commit(value);
  }
  g.view.paint();
  notify(g);
}
function remove(g: GuideContext, id: string): void {
  if (g.guides.some((guide) => guide.id === id))
    commit(
      g,
      g.guides.filter((guide) => guide.id !== id)
    );
}
function update(g: GuideContext, id: string, patch: Partial<Omit<DesignGuide, 'id'>>): void {
  if (!guideCanEdit(g) || !g.guides.some((guide) => guide.id === id)) return;
  const next = g.guides.map((guide) => {
    if (guide.id !== id) return guide;
    const merged = { ...guide, ...patch, id: guide.id };
    return [merged.x, merged.y, merged.rotation].every(Number.isFinite)
      ? normaliseGuide(merged)
      : guide;
  });
  if (serializeGuideRecords(next) !== serializeGuideRecords(g.guides)) commit(g, next);
}
function sync(g: GuideContext): void {
  const source = g.opts.read();
  if (typeof source === 'string' && source === g.source) {
    g.view.paint();
    return;
  }
  const next = parseGuideRecords(source);
  const changed = serializeGuideRecords(next) !== serializeGuideRecords(g.guides);
  if (changed) {
    g.interaction.cancel();
    g.interaction.closeEditor();
    g.guides = next;
    if (!g.guides.some((guide) => guide.id === g.selectedId)) g.selectedId = null;
  }
  g.source = source;
  g.view.paint();
  if (changed) notify(g);
}
function setVisible(g: GuideContext, next: boolean): void {
  g.visible = next;
  if (!next) {
    g.interaction.cancel();
    g.interaction.closeEditor();
    select(g, null);
  }
  g.view.paint();
}
export function mountDesignGuides(opts: DesignGuidesOptions): DesignGuidesHandle {
  const source = opts.read();
  const g = {
    opts,
    source,
    guides: parseGuideRecords(source),
    selectedId: null,
    hoveredId: null,
    visible: opts.initiallyVisible !== false,
    destroyed: false,
    drag: null,
    listeners: new Set(),
  } as GuideContext;
  g.model = {
    select: (id) => select(g, id),
    commit: (next) => commit(g, next),
    remove: (id) => remove(g, id),
    update: (id, patch) => update(g, id, patch),
    notify: () => notify(g),
  };
  g.view = createGuideView(g);
  g.interaction = createGuideInteractions(g);
  g.view.paint();
  let snapGuides = g.guides,
    targets = guideSnapTargets(g.guides);
  const snapTargets = (): SnapLines => {
    if (snapGuides !== g.guides) {
      snapGuides = g.guides;
      targets = guideSnapTargets(g.guides);
    }
    return targets;
  };
  return {
    el: g.view.root,
    selected(): DesignGuide | null {
      const guide = g.guides.find((item) => item.id === g.selectedId);
      return guide ? { ...guide } : null;
    },
    select: g.model.select,
    update: g.model.update,
    remove: g.model.remove,
    onChange(cb): () => void {
      g.listeners.add(cb);
      return () => {
        g.listeners.delete(cb);
      };
    },
    isVisible: () => g.visible,
    setVisible: (next) => setVisible(g, next),
    toggle: () => setVisible(g, !g.visible),
    clear(): void {
      g.interaction.cancel();
      g.interaction.closeEditor();
      commit(g, []);
    },
    hasGuides: () => g.guides.length > 0,
    sync: () => sync(g),
    snapTargets,
    setSelectionBounds: (bounds) => g.view.setSelectionBounds(bounds),
    destroy(): void {
      if (g.destroyed) return;
      g.interaction.destroy();
      g.destroyed = true;
      g.listeners.clear();
      g.view.destroy();
      opts.stageEl.style.removeProperty('--stage-rulers-bottom');
      opts.stageEl.style.removeProperty('--stage-rulers-right');
    },
  };
}
