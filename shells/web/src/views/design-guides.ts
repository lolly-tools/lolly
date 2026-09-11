// SPDX-License-Identifier: MPL-2.0
/** Rulers and persistent authoring guides for the Design canvas. */

import { t } from '../i18n.ts';
import type { DesignGuide, DesignGuidePort } from './design-ports.ts';
import type { SnapLines } from './free-canvas-math.ts';

export interface DesignGuideSet {
  /** Vertical guides, in document/CSS pixels from the canvas origin. */
  x: number[];
  /** Horizontal guides, in document/CSS pixels from the canvas origin. */
  y: number[];
}

export interface DesignGuidesOptions {
  stageEl: HTMLElement;
  canvasEl: HTMLElement;
  read(): unknown;
  commit(value: string): void;
  initiallyVisible?: boolean;
  onSelect?(): void;
  onInspect?(): void;
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
  destroy(): void;
}

const NS = 'http://www.w3.org/2000/svg';
const RULER = 22;
const MIN_TICK_PX = 9;

function finiteSorted(values: unknown): number[] {
  if (!Array.isArray(values)) return [];
  return [
    ...new Set(
      values
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value))
        .map((value) => Math.round(value * 100) / 100)
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
  const n = (value: number): string => String(Math.round(value * 100) / 100);
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
      if (![x, y, rotation].every(v => typeof v === 'number' && Number.isFinite(v))) return [];
      ids.add(id);
      return [normaliseGuide({ id, x, y, rotation, color: typeof color === 'string' ? color : '', snap: snap !== false })];
    });
  } catch { return []; }
}

function normaliseGuide(guide: DesignGuide): DesignGuide {
  const round = (n: number): number => Math.round(n * 100) / 100;
  // A colour is data, never an arbitrary CSS declaration or a resource URL.
  const color = /^(?:#[\da-f]{3,8}|(?:rgb|rgba|hsl|hsla|oklch|oklab|color|var)\([^;{}]+\))$/i.test(guide.color)
    ? guide.color : '';
  return { ...guide, x: round(guide.x), y: round(guide.y), rotation: round(((guide.rotation % 360) + 360) % 360), color };
}

export function serializeGuideRecords(guides: readonly DesignGuide[]): string {
  return guides.length ? '2|' + JSON.stringify(guides.map(normaliseGuide).map(g =>
    [g.id, g.x, g.y, g.rotation, g.color, g.snap])) : '';
}

export function guideSnapTargets(guides: readonly DesignGuide[]): SnapLines {
  const x: number[] = [], y: number[] = [];
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

/** A 1/2/5 ruler interval whose minor ticks never become visual noise. */
export function rulerStep(scale: number, minScreenPx = MIN_TICK_PX): number {
  const wanted = minScreenPx / Math.max(0.0001, Math.abs(scale));
  const power = 10 ** Math.floor(Math.log10(wanted));
  for (const multiple of [1, 2, 5, 10]) {
    const step = multiple * power;
    if (step >= wanted) return step;
  }
  return 10 * power;
}

function svgEl<K extends keyof SVGElementTagNameMap>(name: K): SVGElementTagNameMap[K] {
  return document.createElementNS(NS, name);
}

export function mountDesignGuides(opts: DesignGuidesOptions): DesignGuidesHandle {
  const { stageEl, canvasEl } = opts;
  let guides = parseGuideRecords(opts.read());
  let selectedId: string | null = null;
  const listeners = new Set<() => void>();
  const lineNodes = new Map<string, HTMLButtonElement>();
  let visible = opts.initiallyVisible !== false;
  let destroyed = false;

  const root = document.createElement('div');
  root.className = 'fc-authoring-guides';
  root.setAttribute('data-export-hide', '');
  root.setAttribute('data-live-hide', '');
  root.setAttribute('aria-label', t('Rulers and guides'));
  root.setAttribute('data-canvas-keys', 'off');

  const corner = document.createElement('button');
  corner.type = 'button';
  corner.className = 'fc-ruler-corner';
  corner.setAttribute('aria-label', t('Remove all guides'));
  corner.title = t('Remove all guides');

  const top = document.createElement('div');
  top.className = 'fc-ruler fc-ruler-x';
  top.setAttribute('aria-label', t('Horizontal ruler. Drag down to add a guide.'));
  top.setAttribute('role', 'toolbar');
  const topSvg = svgEl('svg');
  top.appendChild(topSvg);

  const left = document.createElement('div');
  left.className = 'fc-ruler fc-ruler-y';
  left.setAttribute('aria-label', t('Vertical ruler. Drag right to add a guide.'));
  left.setAttribute('role', 'toolbar');
  const leftSvg = svgEl('svg');
  left.appendChild(leftSvg);

  const lines = document.createElement('div');
  lines.className = 'fc-author-guide-lines';
  root.append(corner, top, left, lines);
  stageEl.appendChild(root);

  const stagePoint = (axis: 'x' | 'y', client: number): number => {
    const canvas = canvasEl.getBoundingClientRect();
    const size =
      axis === 'x'
        ? parseFloat(canvasEl.style.width) || canvasEl.offsetWidth || 1
        : parseFloat(canvasEl.style.height) || canvasEl.offsetHeight || 1;
    const scale = (axis === 'x' ? canvas.width : canvas.height) / size || 1;
    return (client - (axis === 'x' ? canvas.left : canvas.top)) / scale;
  };

  const canvasSize = (axis: 'x' | 'y'): number =>
    axis === 'x'
      ? parseFloat(canvasEl.style.width) || canvasEl.offsetWidth || 1
      : parseFloat(canvasEl.style.height) || canvasEl.offsetHeight || 1;

  const selected = (): DesignGuide | null => {
    const guide = guides.find(g => g.id === selectedId);
    return guide ? { ...guide } : null;
  };
  const notify = (): void => { for (const listener of [...listeners]) listener(); };
  function select(id: string | null): void {
    const next = guides.some(g => g.id === id) ? id : null;
    if (next === selectedId) return;
    selectedId = next;
    if (next) opts.onSelect?.();
    paintLines();
    notify();
  }
  function commit(next: DesignGuide[]): void {
    guides = next.map(normaliseGuide);
    if (!guides.some(g => g.id === selectedId)) selectedId = null;
    opts.commit(serializeGuideRecords(guides));
    paint();
    notify();
  }
  function remove(id: string): void {
    if (guides.some(g => g.id === id)) commit(guides.filter(g => g.id !== id));
  }
  function update(id: string, patch: Partial<Omit<DesignGuide, 'id'>>): void {
    if (!guides.some(g => g.id === id)) return;
    const next = guides.map(g => {
      if (g.id !== id) return g;
      const merged = { ...g, ...patch, id: g.id };
      if (![merged.x, merged.y, merged.rotation].every(Number.isFinite)) return g;
      return normaliseGuide(merged);
    });
    if (serializeGuideRecords(next) !== serializeGuideRecords(guides)) commit(next);
  }
  function lineLabel(guide: DesignGuide): string {
    const rotation = guide.rotation % 180;
    return rotation === 90 ? t('Vertical guide at {n} px', { n: guide.x })
      : rotation === 0 ? t('Horizontal guide at {n} px', { n: guide.y })
        : t('Guide at {x}, {y} px, {angle}°', { x: guide.x, y: guide.y, angle: guide.rotation });
  }

  let drag: { guide: DesignGuide; original: DesignGuide; startX: number; startY: number;
    pointerId: number; isNew: boolean; target: Element; previousSelection: string | null } | null = null;

  function updateDrag(event: PointerEvent): void {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const x = stagePoint('x', event.clientX), y = stagePoint('y', event.clientY);
    const { original, isNew } = drag;
    const dx = isNew ? x - original.x : x - drag.startX;
    const dy = isNew ? y - original.y : y - drag.startY;
    // Move perpendicular to the line, preserving its anchor along the line. This
    // prevents a click on an angled guide from jumping its rotation pivot.
    const angle = original.rotation * Math.PI / 180;
    const nx = -Math.sin(angle), ny = Math.cos(angle);
    const distance = dx * nx + dy * ny;
    if (!isNew && Math.abs(distance) < 1e-8) {
      drag.guide = { ...original };
      paintLines();
      return;
    }
    const step = event.shiftKey ? 10 : 1;
    const round = (v: number): number => Math.round(v / step) * step;
    drag.guide = { ...original, x: round(original.x + distance * nx), y: round(original.y + distance * ny) };
    paintLines();
  }
  function releaseDrag(): void {
    if (!drag) return;
    const { target, pointerId } = drag;
    drag = null;
    root.classList.remove('is-guide-dragging');
    try { if (target.hasPointerCapture(pointerId)) target.releasePointerCapture(pointerId); }
    catch { /* already released */ }
  }
  function cancelDrag(event?: PointerEvent): void {
    if (!drag || event && event.pointerId !== drag.pointerId) return;
    const previous = drag.previousSelection;
    releaseDrag();
    selectedId = previous;
    paint();
    notify();
  }
  function finishDrag(event: PointerEvent): void {
    if (!drag || event.pointerId !== drag.pointerId) return;
    updateDrag(event);
    const { guide, isNew } = drag;
    releaseDrag();
    selectedId = guide.id;
    const next = isNew ? [...guides, guide] : guides.map(g => g.id === guide.id ? guide : g);
    if (serializeGuideRecords(next) !== serializeGuideRecords(guides)) commit(next);
    else { paintLines(); notify(); }
    opts.onInspect?.();
    // Opening the inspector can resize the stage. Repaint from its new geometry.
    paint();
    lineNodes.get(guide.id)?.focus({ preventScroll: true });
  }
  function startDrag(event: PointerEvent, guide: DesignGuide, isNew: boolean): void {
    if (event.button !== 0 || drag) return;
    const previousSelection = selectedId;
    selectedId = guide.id;
    opts.onSelect?.();
    const target = event.currentTarget as Element;
    drag = { guide, original: { ...guide }, startX: stagePoint('x', event.clientX),
      startY: stagePoint('y', event.clientY), pointerId: event.pointerId, isNew, target, previousSelection };
    root.classList.add('is-guide-dragging');
    try { target.setPointerCapture(event.pointerId); } catch { /* jsdom/stray id */ }
    event.preventDefault();
    event.stopPropagation();
    paintLines();
    notify();
  }
  function onRulerDown(event: PointerEvent): void {
    const vertical = event.currentTarget === left;
    let id = '';
    do { id = `g${Math.random().toString(36).slice(2, 12)}`; } while (guides.some(g => g.id === id));
    startDrag(event, { id, x: stagePoint('x', event.clientX), y: stagePoint('y', event.clientY),
      rotation: vertical ? 90 : 0, color: '', snap: true }, true);
  }
  function onLineDown(event: PointerEvent): void {
    const id = (event.target as Element | null)?.closest<HTMLElement>('.fc-author-guide')?.dataset.guideId;
    const guide = guides.find(g => g.id === id);
    if (guide) startDrag(event, guide, false);
  }
  function onLineKey(event: KeyboardEvent): void {
    if (event.metaKey || event.ctrlKey) return;
    const id = (event.target as Element | null)?.closest<HTMLElement>('.fc-author-guide')?.dataset.guideId;
    const guide = guides.find(g => g.id === id);
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopPropagation();
      if (drag) cancelDrag(); else select(null);
      return;
    }
    if (!guide) return;
    if (['Delete', 'Backspace', 'Enter', ' ', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault(); event.stopPropagation();
      select(guide.id);
      const step = event.shiftKey ? 10 : 1;
      if (event.key === 'Delete' || event.key === 'Backspace') remove(guide.id);
      else if (event.key === 'Enter' || event.key === ' ') opts.onInspect?.();
      else update(guide.id, { x: guide.x + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0),
        y: guide.y + (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0) });
    }
  }
  function onStageDown(event: PointerEvent): void {
    const target = event.target as Element | null;
    if (target && (target === stageEl || canvasEl.contains(target) || target.closest('.fc-overlay'))) select(null);
  }
  function onDragKey(event: KeyboardEvent): void {
    if (!drag || event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    cancelDrag();
  }

  function paintRuler(
    svg: SVGSVGElement,
    axis: 'x' | 'y',
    length: number,
    origin: number,
    scale: number
  ): void {
    svg.replaceChildren();
    svg.setAttribute('viewBox', axis === 'x' ? `0 0 ${length} ${RULER}` : `0 0 ${RULER} ${length}`);
    const step = rulerStep(scale);
    const nativeStart = (0 - origin) / scale;
    const nativeEnd = (length - origin) / scale;
    const first = Math.floor(nativeStart / step) * step;
    for (
      let value = first, guard = 0;
      value <= nativeEnd + step && guard < 2000;
      value += step, guard++
    ) {
      const at = origin + value * scale;
      const sequence = Math.round(value / step);
      const major = sequence % 5 === 0;
      const tick = svgEl('line');
      if (axis === 'x') {
        tick.setAttribute('x1', String(at));
        tick.setAttribute('x2', String(at));
        tick.setAttribute('y1', String(major ? 7 : 13));
        tick.setAttribute('y2', String(RULER));
      } else {
        tick.setAttribute('x1', String(major ? 7 : 13));
        tick.setAttribute('x2', String(RULER));
        tick.setAttribute('y1', String(at));
        tick.setAttribute('y2', String(at));
      }
      svg.appendChild(tick);
      if (!major) continue;
      const label = svgEl('text');
      label.textContent = String(Math.round(value * 100) / 100);
      if (axis === 'x') {
        label.setAttribute('x', String(at + 3));
        label.setAttribute('y', '9');
      } else {
        label.setAttribute('x', '9');
        label.setAttribute('y', String(at - 3));
        label.setAttribute('transform', `rotate(-90 9 ${at - 3})`);
      }
      svg.appendChild(label);
    }
  }

  function chromeTop(stageRect: DOMRect): number {
    const bar = stageEl.querySelector<HTMLElement>('.design-topbar');
    if (!bar) return 0;
    const rect = bar.getBoundingClientRect();
    return Math.max(0, Math.min(stageRect.height - RULER, rect.bottom - stageRect.top));
  }

  function chromeLeft(stageRect: DOMRect): number {
    // The stage reserve includes the navigator at its live width (including its
    // collapsed rail) and any docked tool column. Rulers belong outside that band.
    const reserve = parseFloat(stageEl.style.getPropertyValue('--stage-reserve-left')) || 0;
    return Math.max(0, Math.min(stageRect.width - RULER, reserve));
  }

  function paintLines(): void {
    const stage = stageEl.getBoundingClientRect();
    const canvas = canvasEl.getBoundingClientRect();
    const xScale = canvas.width / canvasSize('x') || 1;
    const yScale = canvas.height / canvasSize('y') || 1;
    const topInset = chromeTop(stage) + RULER;
    const leftInset = chromeLeft(stage) + RULER;
    lines.style.clipPath = `inset(${topInset}px 0 0 ${leftInset}px)`;
    const all = drag ? [...guides.filter(g => g.id !== drag!.guide.id), drag.guide] : guides;
    const seen = new Set<string>();
    for (const guide of all) {
      seen.add(guide.id);
      let line = lineNodes.get(guide.id);
      if (!line) {
        line = document.createElement('button');
        line.type = 'button';
        line.dataset.guideId = guide.id;
        lineNodes.set(guide.id, line);
        lines.appendChild(line);
      }
      const rotation = guide.rotation % 180;
      const axis = rotation === 90 ? 'x' : rotation === 0 ? 'y' : 'angled';
      line.className = `fc-author-guide fc-author-guide-${axis}`;
      line.classList.toggle('is-dragging', drag?.guide.id === guide.id);
      line.classList.toggle('is-selected', selectedId === guide.id);
      line.setAttribute('aria-pressed', String(selectedId === guide.id));
      line.style.color = guide.color;
      const cx = canvas.left - stage.left + guide.x * xScale;
      const cy = canvas.top - stage.top + guide.y * yScale;
      const angle = guide.rotation * Math.PI / 180;
      const dx = Math.cos(angle) * xScale, dy = Math.sin(angle) * yScale;
      const length = Math.hypot(stage.width, stage.height) + Math.hypot(cx, cy);
      const screenAngle = Math.atan2(dy, dx);
      line.style.left = `${cx - Math.cos(screenAngle) * length}px`;
      line.style.top = `${cy - Math.sin(screenAngle) * length}px`;
      line.style.width = `${length * 2}px`;
      line.style.transform = `rotate(${screenAngle}rad)`;
      line.setAttribute('aria-label', lineLabel(guide));
      line.title = `${lineLabel(guide)}. ${t('Select to edit in the inspector. Drag to move. Delete to remove.')}`;
    }
    for (const [id, line] of lineNodes) {
      if (seen.has(id)) continue;
      line.remove();
      lineNodes.delete(id);
    }
  }

  function paint(): void {
    if (destroyed) return;
    root.hidden = !visible;
    if (!visible) return;
    const stage = stageEl.getBoundingClientRect();
    const canvas = canvasEl.getBoundingClientRect();
    const topInset = chromeTop(stage);
    const leftInset = chromeLeft(stage);
    corner.style.top = `${topInset}px`;
    corner.style.left = `${leftInset}px`;
    top.style.top = `${topInset}px`;
    top.style.left = `${leftInset + RULER}px`;
    top.style.width = `${Math.max(0, stage.width - leftInset - RULER)}px`;
    left.style.left = `${leftInset}px`;
    left.style.top = `${topInset + RULER}px`;
    left.style.height = `${Math.max(0, stage.height - topInset - RULER)}px`;
    paintRuler(
      topSvg,
      'x',
      Math.max(1, stage.width - leftInset - RULER),
      canvas.left - stage.left - leftInset - RULER,
      canvas.width / canvasSize('x') || 1
    );
    paintRuler(
      leftSvg,
      'y',
      Math.max(1, stage.height - topInset - RULER),
      canvas.top - stage.top - topInset - RULER,
      canvas.height / canvasSize('y') || 1
    );
    paintLines();
  }

  top.addEventListener('pointerdown', onRulerDown);
  left.addEventListener('pointerdown', onRulerDown);
  top.addEventListener('pointermove', updateDrag);
  left.addEventListener('pointermove', updateDrag);
  top.addEventListener('pointerup', finishDrag);
  left.addEventListener('pointerup', finishDrag);
  top.addEventListener('pointercancel', cancelDrag);
  left.addEventListener('pointercancel', cancelDrag);
  lines.addEventListener('pointerdown', onLineDown);
  lines.addEventListener('pointermove', updateDrag);
  lines.addEventListener('pointerup', finishDrag);
  lines.addEventListener('pointercancel', cancelDrag);
  for (const target of [top, left, lines]) target.addEventListener('lostpointercapture', cancelDrag);
  root.addEventListener('keydown', onLineKey);
  lines.addEventListener('focusin', event => {
    const id = (event.target as HTMLElement).dataset.guideId;
    if (id) select(id);
  });
  stageEl.addEventListener('pointerdown', onStageDown);
  document.addEventListener('keydown', onDragKey, true);
  corner.addEventListener('click', () => commit([]));

  paint();

  return {
    el: root,
    selected, select, update, remove,
    onChange(cb): () => void { listeners.add(cb); return () => { listeners.delete(cb); }; },
    isVisible: () => visible,
    setVisible(next: boolean): void {
      visible = next;
      if (!visible) { cancelDrag(); select(null); }
      paint();
    },
    toggle(): void {
      visible = !visible;
      if (!visible) { cancelDrag(); select(null); }
      paint();
    },
    clear(): void {
      commit([]);
    },
    hasGuides: () => guides.length > 0,
    sync(): void {
      const next = parseGuideRecords(opts.read());
      const changed = serializeGuideRecords(next) !== serializeGuideRecords(guides);
      if (changed) {
        cancelDrag();
        guides = next;
        if (!guides.some(g => g.id === selectedId)) selectedId = null;
      }
      paint();
      if (changed) notify();
    },
    snapTargets: () => guideSnapTargets(guides),
    destroy(): void {
      if (destroyed) return;
      cancelDrag();
      destroyed = true;
      stageEl.removeEventListener('pointerdown', onStageDown);
      document.removeEventListener('keydown', onDragKey, true);
      listeners.clear();
      lineNodes.clear();
      root.remove();
    },
  };
}
