// SPDX-License-Identifier: MPL-2.0
/**
 * The generic image-framing overlay (plans/148 WP-C).
 *
 * ONE overlay for every framed image in every tool. It is declaration-driven:
 * a tool marks the rendered element with `data-framing="<inputId>"` (the
 * {{framing}} helper emits it), and nothing else about that tool is known here.
 * There is deliberately no per-tool branch in this file, and no manifest read
 * beyond the input model the runtime already publishes - which is the whole
 * point, because the alternative (a bespoke drag rect per tool, as screencap
 * still has) is what made eight different framing UXes in the first place.
 *
 * Two marker forms, because a `blocks` sub-field cannot be a vector:
 *   data-framing="imageFraming"     → a top-level vector { zoom, x, y, rotate }
 *   data-framing="boxes:2:bg"       → block row 2's bgZoom / bgX / bgY / bgRotate
 *
 * Gestures (arm-then-manipulate, so a tap never steals the page scroll on a
 * phone): tap to arm, drag to pan, wheel/pinch to zoom about the pointer, the
 * top handle to roll (Shift snaps to 15 degrees), Alt-drag to tilt the plane -
 * horizontal is yaw, vertical is pitch, the Geometry panel gesture - double-click
 * to reset, arrows to nudge, [ and ] to roll, Escape to release. Every write
 * goes through runtime.setInput, which the tool view already coalesces into one
 * undo step per drag - so none of that is re-implemented here either.
 *
 * A tilt pulls the image's corners inside the frame, so after every pitch/yaw
 * write a cover-fitted image is zoomed back to full coverage (minZoomForCover -
 * Lightroom's Constrain Crop). The zoom is written into the model like any other
 * value, so it is visible in the sidebar and undoes with the rest.
 */
import { announce } from '../a11y.ts';
import { t } from '../i18n.ts';
import { frameRect, minZoomForCover, type Framing } from '@lolly/engine';
import type { InputModelItem, InputValue } from '../../../../engine/src/inputs.ts';
import type { ToolRuntime } from './tool.ts';

/** Per-field bounds, so the overlay clamps exactly as the sidebar scrubber does. */
interface FieldSpec { min?: number; max?: number; step?: number; default?: number }

/** A resolved framing target: how to read the four numbers, and how to write them back. */
interface Target {
  /** The raw marker, e.g. "imageFraming" or "boxes:2:bg". */
  key: string;
  /** Current values, already defaulted. */
  value: Required<Framing>;
  specs: Record<keyof Framing, FieldSpec>;
  /** Whether the tool declares a `rotate` field at all - no field, no handle. */
  hasRotate: boolean;
  /** Whether the tool declares pitch/yaw - no fields, no tilt gesture. */
  hasTilt: boolean;
  /** cover / contain, read from the companion fit input where there is one. */
  fit: 'cover' | 'contain';
  /** The asset input this frames, when declared (framingFor) - used for natural size. */
  assetValue?: { width?: number; height?: number } | null;
  write(next: Partial<Framing>): Promise<void> | void;
}

const NEUTRAL: Required<Framing> = { zoom: 100, x: 50, y: 50, rotate: 0, pitch: 0, yaw: 0 };
const FIELDS = ['zoom', 'x', 'y', 'rotate', 'pitch', 'yaw'] as const;

const numOr = (v: unknown, dflt: number): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : dflt;
};

const clampTo = (v: number, s: FieldSpec | undefined): number => {
  if (!s) return v;
  if (s.min !== undefined && v < s.min) v = s.min;
  if (s.max !== undefined && v > s.max) v = s.max;
  return v;
};

/** Round to the field's step so a drag hits the same lattice the sidebar types on. */
const snapTo = (v: number, s: FieldSpec | undefined, round: (n: number) => number): number => {
  const step = s?.step;
  if (!step || step <= 0) return v;
  const snapped = round(v / step) * step;
  // Steps like 0.5 leave binary dust (0.30000000000000004); trim to the step's decimals.
  const dp = (String(step).split('.')[1] ?? '').length;
  return Number(snapped.toFixed(dp));
};
const quantise = (v: number, s: FieldSpec | undefined): number => snapTo(v, s, Math.round);
/** Snap UP - for a minimum (a coverage zoom rounded down stops covering). */
const quantiseUp = (v: number, s: FieldSpec | undefined): number => snapTo(v, s, Math.ceil);

const isCoverFit = (v: unknown): 'cover' | 'contain' => (String(v ?? '') === 'contain' ? 'contain' : 'cover');

export function setupFramingOverlay({
  stageEl, canvasEl, runtime, onDirty, onBake,
}: {
  stageEl: HTMLElement;
  canvasEl: HTMLElement;
  runtime: ToolRuntime;
  onDirty?: (id: string) => void;
  /** "Use as a new image" - supplied by the tool view when the shell can bake (WP-E). */
  onBake?: (key: string) => void | Promise<void>;
}): () => void {

  // ── Reading and writing a target ──────────────────────────────────────────
  const model = (): InputModelItem[] => runtime.getModel();
  const byId = (id: string): InputModelItem | undefined => model().find(i => i.id === id);

  /** The fit select paired with a framing input: an explicit `<base>Fit`, else cover. */
  function readFit(framingId: string, row?: Record<string, unknown>): 'cover' | 'contain' {
    const base = framingId.replace(/Framing$/, '');
    if (row && `${base}Fit` in row) return isCoverFit(row[`${base}Fit`]);
    return isCoverFit(byId(`${base}Fit`)?.value ?? byId('imageFit')?.value);
  }

  function resolve(key: string): Target | null {
    const blockRef = /^(.+):(\d+):(.+)$/.exec(key);

    if (!blockRef) {
      const input = byId(key);
      if (!input || input.control !== 'vector') return null;
      const specs = {} as Record<keyof Framing, FieldSpec>;
      for (const f of input.fields ?? []) if ((FIELDS as readonly string[]).includes(f.id)) specs[f.id as keyof Framing] = f as FieldSpec;
      const cur = (input.value && typeof input.value === 'object' ? input.value : {}) as Record<string, unknown>;
      const value = { ...NEUTRAL };
      for (const f of FIELDS) value[f] = numOr(cur[f], specs[f]?.default ?? NEUTRAL[f]);
      const assetId = (input as { framingFor?: string }).framingFor;
      return {
        key, value, specs,
        hasRotate: 'rotate' in specs,
        hasTilt: 'pitch' in specs || 'yaw' in specs,
        fit: readFit(key),
        assetValue: assetId ? (byId(assetId)?.value as Target['assetValue']) : null,
        write: (next) => {
          // Commit the WHOLE compound, read fresh from the live model - the same
          // staleness rule the sidebar's vector commit follows.
          const live = (byId(key)?.value && typeof byId(key)!.value === 'object' ? byId(key)!.value : {}) as Record<string, unknown>;
          const out: Record<string, InputValue> = {};
          for (const f of input.fields ?? []) out[f.id] = numOr(live[f.id], (f as FieldSpec).default ?? 0);
          for (const f of FIELDS) if (next[f] !== undefined && f in specs) out[f] = next[f]!;
          onDirty?.(key);
          return runtime.setInput(key, out);
        },
      };
    }

    // Blocks row: four sibling numbers named <base>Zoom / X / Y / Rotate.
    const [, blocksId, idxStr, base] = blockRef as unknown as [string, string, string, string];
    const input = byId(blocksId);
    if (!input || !Array.isArray(input.value)) return null;
    const index = Number(idxStr);
    const row = input.value[index] as Record<string, unknown> | undefined;
    if (!row || typeof row !== 'object') return null;
    const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
    const nameOf = (f: keyof Framing): string => `${base}${cap(f)}`;
    const fieldById = new Map<string, FieldSpec>(((input.fields ?? []) as Array<FieldSpec & { id: string }>).map(f => [f.id, f]));
    const specs = {} as Record<keyof Framing, FieldSpec>;
    for (const f of FIELDS) { const s = fieldById.get(nameOf(f)); if (s) specs[f] = s; }
    const value = { ...NEUTRAL };
    for (const f of FIELDS) value[f] = numOr(row[nameOf(f)], specs[f]?.default ?? NEUTRAL[f]);
    const assetField = ((input.fields ?? []) as Array<{ id: string; type?: string; framingFor?: string }>)
      .find(f => f.framingFor === base || (f.type === 'asset' && f.id === base));
    return {
      key, value, specs,
      hasRotate: 'rotate' in specs,
      hasTilt: 'pitch' in specs || 'yaw' in specs,
      fit: readFit(base, row),
      assetValue: assetField ? (row[assetField.id] as Target['assetValue']) : null,
      write: (next) => {
        const liveInput = byId(blocksId);
        const rows = Array.isArray(liveInput?.value) ? [...(liveInput!.value as unknown[])] : [];
        const liveRow = rows[index];
        if (!liveRow || typeof liveRow !== 'object') return;
        const merged: Record<string, unknown> = { ...(liveRow as Record<string, unknown>) };
        for (const f of FIELDS) if (next[f] !== undefined && f in specs) merged[nameOf(f)] = next[f]!;
        rows[index] = merged;
        onDirty?.(blocksId);
        return runtime.setInput(blocksId, rows as unknown as InputValue);
      },
    };
  }

  // ── Armed state + chrome ──────────────────────────────────────────────────
  const layer = document.createElement('div');
  layer.className = 'framing-layer';
  layer.setAttribute('data-export-hide', '');
  layer.hidden = true;
  const rotateHandle = document.createElement('button');
  rotateHandle.type = 'button';
  rotateHandle.className = 'framing-rotate';
  rotateHandle.title = t('Drag to rotate (hold Shift to snap)');
  rotateHandle.setAttribute('aria-label', t('Rotate image'));
  const bar = document.createElement('div');
  bar.className = 'framing-bar';
  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'framing-btn';
  resetBtn.textContent = t('Reset');
  resetBtn.title = t('Put the image back where it started');
  const bakeBtn = document.createElement('button');
  bakeBtn.type = 'button';
  bakeBtn.className = 'framing-btn';
  bakeBtn.textContent = t('Use as a new image');
  bakeBtn.title = t('Save this framing as a new image in your library');
  bar.append(resetBtn, bakeBtn);
  layer.append(rotateHandle, bar);
  stageEl.appendChild(layer);

  let armedKey: string | null = null;
  /** The framed element currently armed, re-resolved after every canvas rebuild. */
  const armedEl = (): HTMLElement | null =>
    armedKey ? canvasEl.querySelector<HTMLElement>(`[data-framing="${CSS.escape(armedKey)}"]`) : null;

  function position(): void {
    const el = armedEl();
    const target = armedKey ? resolve(armedKey) : null;
    if (!el || !target) { layer.hidden = true; return; }
    const r = el.getBoundingClientRect();
    const s = stageEl.getBoundingClientRect();
    layer.hidden = false;
    layer.style.left = `${r.left - s.left}px`;
    layer.style.top = `${r.top - s.top}px`;
    layer.style.width = `${r.width}px`;
    layer.style.height = `${r.height}px`;
    rotateHandle.hidden = !target.hasRotate;
    bakeBtn.hidden = !onBake;
  }

  function arm(key: string): void {
    if (armedKey === key) return;
    disarm(false);
    armedKey = key;
    const el = armedEl();
    if (el) {
      el.classList.add('is-framing-armed');
      // Only while armed: an un-armed image must scroll the page like any other.
      el.style.touchAction = 'none';
    }
    position();
    layer.focus();
    const target = resolve(key);
    announce(target?.hasTilt
      ? t('Framing this image. Drag to move, scroll to zoom, hold Alt and drag to correct perspective, Escape to finish.')
      : t('Framing this image. Drag to move, scroll to zoom, Escape to finish.'));
  }

  function disarm(announceIt = true): void {
    const el = armedEl();
    if (el) { el.classList.remove('is-framing-armed'); el.style.touchAction = ''; }
    armedKey = null;
    layer.hidden = true;
    if (announceIt) announce(t('Framing finished.'));
  }

  // ── Geometry ──────────────────────────────────────────────────────────────
  /** The canvas's fit scale, so a screen-pixel drag becomes a canvas-pixel one. */
  const canvasScale = (): number => {
    const w = canvasEl.offsetWidth;
    return w > 0 ? canvasEl.getBoundingClientRect().width / w : 1;
  };

  /** The framed element's LAYOUT box (unaffected by its own transform) and the image's natural size. */
  function boxOf(el: HTMLElement, target: Target): { W: number; H: number; iw: number; ih: number } {
    // offsetWidth is the untransformed layout box - exactly what is wanted, and
    // free of the canvas's fit scale. SVG elements (a canvas-drawing tool marks
    // its <image>, not an <img>) have no offsetWidth at all, so fall back to the
    // visual rect divided BACK out of that scale rather than double-counting it.
    const s = canvasScale() || 1;
    const rect = el.getBoundingClientRect();
    const W = el.offsetWidth || rect.width / s;
    const H = el.offsetHeight || rect.height / s;
    const img = el as HTMLImageElement;
    // Natural size from the decoded element where there is one (which already has
    // EXIF orientation applied), else the AssetRef's recorded dimensions, else the
    // frame itself - the last one only affects drag sensitivity, never correctness.
    const iw = img.naturalWidth || numOr(target.assetValue?.width, 0) || W;
    const ih = img.naturalHeight || numOr(target.assetValue?.height, 0) || H;
    return { W, H, iw, ih };
  }

  function commit(target: Target, next: Partial<Framing>, el?: HTMLElement | null): void {
    const out: Partial<Framing> = {};
    for (const f of FIELDS) {
      if (next[f] === undefined) continue;
      out[f] = quantise(clampTo(next[f]!, target.specs[f]), target.specs[f]);
    }
    // Constrain Crop: a tilt pulls the image's corners inside the frame, so a
    // cover-fitted slot would show transparent wedges. Raise the zoom to the
    // smallest value that still covers - Lightroom's default, and the reason its
    // perspective sliders are usable. Only ever RAISES, only on a tilt write, and
    // only where the tool declares a zoom field to raise.
    const tilting = out.pitch !== undefined || out.yaw !== undefined;
    if (tilting && el && target.fit === 'cover' && target.specs.zoom) {
      const { W, H, iw, ih } = boxOf(el, target);
      const merged = { ...target.value, ...out };
      const need = minZoomForCover(iw, ih, W, H, merged, 'cover', undefined, target.specs.zoom.max ?? 400);
      if (need > merged.zoom) out.zoom = quantiseUp(clampTo(need, target.specs.zoom), target.specs.zoom);
    }
    void target.write(out);
  }

  // ── Pan, and Alt-drag to tilt ─────────────────────────────────────────────
  // One drag state for both: whether it pans or tilts is decided at pointerdown
  // by the Alt key, so the gesture never changes meaning under the user's finger.
  let panning = false, panPointer = -1, panMode: 'pan' | 'tilt' = 'pan';
  let panStart = { cx: 0, cy: 0, x: 50, y: 50, pitch: 0, yaw: 0, W: 1, H: 1, dw: 1, dh: 1, scale: 1 };

  function beginPan(e: PointerEvent, target: Target, el: HTMLElement): void {
    const { W, H, iw, ih } = boxOf(el, target);
    const r = frameRect(iw, ih, W, H, target.value, target.fit);
    panning = true; panPointer = e.pointerId;
    panMode = (e.altKey && target.hasTilt) ? 'tilt' : 'pan';
    panStart = {
      cx: e.clientX, cy: e.clientY,
      x: target.value.x, y: target.value.y,
      pitch: target.value.pitch, yaw: target.value.yaw,
      W, H, dw: r.dw, dh: r.dh, scale: canvasScale() || 1,
    };
    try { layer.setPointerCapture(e.pointerId); } catch { /* best effort */ }
  }

  function movePan(e: PointerEvent): void {
    if (!panning || !armedKey) return;
    const target = resolve(armedKey);
    const el = armedEl();
    if (!target || !el) return;
    const dx = (e.clientX - panStart.cx) / panStart.scale;
    const dy = (e.clientY - panStart.cy) / panStart.scale;

    if (panMode === 'tilt') {
      // A full sweep across the frame is a full sweep of the tilt range, so the
      // gesture feels the same on a thumbnail and on a hero. Sideways swings the
      // plane (yaw), up/down tips it (pitch) - dragging DOWN tips the top away,
      // which is the direction that fixes a photo shot looking up at a building.
      const spanY = target.specs.pitch?.max ?? 45;
      const spanX = target.specs.yaw?.max ?? 45;
      const next: Partial<Framing> = {};
      if ('yaw' in target.specs) next.yaw = panStart.yaw + (dx / Math.max(1, panStart.W)) * spanX * 2;
      if ('pitch' in target.specs) next.pitch = panStart.pitch + (dy / Math.max(1, panStart.H)) * spanY * 2;
      commit(target, next, el);
      return;
    }

    // The image's left edge sits at (W - dw) * x/100, so a drag of `dx` canvas px
    // is a pan of dx / (W - dw) - negative for cover, where dw > W, which is why
    // dragging right reveals what is off the LEFT.
    const freeX = panStart.W - panStart.dw;
    const freeY = panStart.H - panStart.dh;
    const next: Partial<Framing> = {};
    // A zero overflow means there is nothing to pan on that axis (a perfectly
    // fitting image); fall back to a full sweep across the frame so the gesture
    // still feels alive rather than dead.
    next.x = panStart.x + (Math.abs(freeX) > 0.5 ? (dx / freeX) * 100 : (dx / Math.max(1, panStart.W)) * 100);
    next.y = panStart.y + (Math.abs(freeY) > 0.5 ? (dy / freeY) * 100 : (dy / Math.max(1, panStart.H)) * 100);
    commit(target, next);
  }

  // ── Zoom about the pointer ────────────────────────────────────────────────
  function zoomAt(target: Target, el: HTMLElement, deltaPct: number, clientX?: number, clientY?: number): void {
    const { W, H, iw, ih } = boxOf(el, target);
    const before = frameRect(iw, ih, W, H, target.value, target.fit);
    const zoom = quantise(clampTo(target.value.zoom + deltaPct, target.specs.zoom), target.specs.zoom);
    if (zoom === target.value.zoom) return;
    const after = frameRect(iw, ih, W, H, { ...target.value, zoom }, target.fit);
    const next: Partial<Framing> = { zoom };
    if (clientX !== undefined && clientY !== undefined) {
      const r = el.getBoundingClientRect();
      const s = canvasScale() || 1;
      const u = (clientX - r.left) / s, v = (clientY - r.top) / s;
      // Keep the source pixel under the cursor under the cursor.
      const sxu = (u - before.dx) / (before.dw / iw);
      const syv = (v - before.dy) / (before.dh / ih);
      const freeX = W - after.dw, freeY = H - after.dh;
      if (Math.abs(freeX) > 0.5) next.x = ((u - sxu * (after.dw / iw)) / freeX) * 100;
      if (Math.abs(freeY) > 0.5) next.y = ((v - syv * (after.dh / ih)) / freeY) * 100;
    }
    commit(target, next);
  }

  // ── Rotate ────────────────────────────────────────────────────────────────
  let rotating = false, rotPointer = -1, rotStart = { a: 0, r: 0, cx: 0, cy: 0 };
  const angleTo = (cx: number, cy: number, px: number, py: number): number =>
    Math.atan2(py - cy, px - cx) * 180 / Math.PI;

  rotateHandle.addEventListener('pointerdown', e => {
    const target = armedKey ? resolve(armedKey) : null;
    const el = armedEl();
    if (!target || !el || e.button !== 0) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    rotating = true; rotPointer = e.pointerId;
    rotStart = { a: angleTo(cx, cy, e.clientX, e.clientY), r: target.value.rotate, cx, cy };
    try { rotateHandle.setPointerCapture(e.pointerId); } catch { /* best effort */ }
    e.preventDefault(); e.stopPropagation();
  });

  function moveRotate(e: PointerEvent): void {
    if (!rotating || !armedKey) return;
    const target = resolve(armedKey);
    if (!target) return;
    let deg = rotStart.r + (angleTo(rotStart.cx, rotStart.cy, e.clientX, e.clientY) - rotStart.a);
    if (e.shiftKey) deg = Math.round(deg / 15) * 15;   // straighten in even steps
    commit(target, { rotate: deg });
  }

  const endGesture = (e: PointerEvent): void => {
    if (panning && e.pointerId === panPointer) {
      panning = false; panPointer = -1;
      try { layer.releasePointerCapture(e.pointerId); } catch { /* already gone */ }
    }
    if (rotating && e.pointerId === rotPointer) {
      rotating = false; rotPointer = -1;
      try { rotateHandle.releasePointerCapture(e.pointerId); } catch { /* already gone */ }
    }
  };

  // ── Wiring ────────────────────────────────────────────────────────────────
  // Delegated on the canvas, so the tool's per-paint innerHTML rebuild - which
  // replaces every framed element - never needs a re-bind or an observer.
  const onCanvasDown = (e: PointerEvent): void => {
    const el = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-framing]') ?? null;
    if (!el) { if (armedKey) disarm(); return; }
    const key = el.dataset.framing!;
    const target = resolve(key);
    if (!target) return;
    if (armedKey !== key) { arm(key); return; }   // first tap arms; it does not pan
    beginPan(e, target, el);
    e.preventDefault();
  };
  canvasEl.addEventListener('pointerdown', onCanvasDown);

  const onMove = (e: PointerEvent): void => { movePan(e); moveRotate(e); };
  layer.addEventListener('pointermove', onMove);
  rotateHandle.addEventListener('pointermove', onMove);
  layer.addEventListener('pointerup', endGesture);
  layer.addEventListener('pointercancel', endGesture);
  rotateHandle.addEventListener('pointerup', endGesture);
  rotateHandle.addEventListener('pointercancel', endGesture);

  // The layer sits over the image while armed, so panning starts there too.
  layer.addEventListener('pointerdown', e => {
    if (e.target === rotateHandle || bar.contains(e.target as Node)) return;
    const target = armedKey ? resolve(armedKey) : null;
    const el = armedEl();
    if (!target || !el || e.button !== 0) return;
    beginPan(e, target, el);
    e.preventDefault();
  });

  const onWheel = (e: WheelEvent): void => {
    const el = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-framing]') ?? null;
    if (!el || el.dataset.framing !== armedKey) return;   // only the armed image zooms
    const target = resolve(armedKey);
    if (!target) return;
    e.preventDefault();
    zoomAt(target, el, e.deltaY < 0 ? 5 : -5, e.clientX, e.clientY);
  };
  canvasEl.addEventListener('wheel', onWheel, { passive: false });
  layer.addEventListener('wheel', e => {
    const el = armedEl();
    const target = armedKey ? resolve(armedKey) : null;
    if (!el || !target) return;
    e.preventDefault();
    zoomAt(target, el, e.deltaY < 0 ? 5 : -5, e.clientX, e.clientY);
  }, { passive: false });

  const onDblClick = (e: MouseEvent): void => {
    const el = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-framing]') ?? null;
    if (!el) return;
    const target = resolve(el.dataset.framing!);
    if (!target) return;
    reset(target);
  };
  canvasEl.addEventListener('dblclick', onDblClick);
  layer.addEventListener('dblclick', () => { const tg = armedKey ? resolve(armedKey) : null; if (tg) reset(tg); });

  function reset(target: Target): void {
    const next: Partial<Framing> = {};
    for (const f of FIELDS) if (f in target.specs) next[f] = target.specs[f]?.default ?? NEUTRAL[f];
    commit(target, next);
    announce(t('Framing reset.'));
  }
  resetBtn.addEventListener('click', () => { const tg = armedKey ? resolve(armedKey) : null; if (tg) reset(tg); });
  bakeBtn.addEventListener('click', () => { if (armedKey && onBake) void onBake(armedKey); });

  // Keyboard: the layer is focusable while armed, so nudges never fight the page.
  layer.tabIndex = -1;
  const onKey = (e: KeyboardEvent): void => {
    if (!armedKey) return;
    const target = resolve(armedKey);
    const el = armedEl();
    if (!target || !el) return;
    const big = e.shiftKey ? 10 : 1;
    const stepOf = (f: keyof Framing): number => (target.specs[f]?.step ?? 1) * big;
    // Alt turns the arrows into the tilt pair, matching the Alt-drag gesture -
    // one modifier, one meaning, whichever input device is in hand.
    if (e.altKey && target.hasTilt) {
      switch (e.key) {
        case 'ArrowLeft':  commit(target, { yaw: target.value.yaw - stepOf('yaw') }, el); break;
        case 'ArrowRight': commit(target, { yaw: target.value.yaw + stepOf('yaw') }, el); break;
        case 'ArrowUp':    commit(target, { pitch: target.value.pitch - stepOf('pitch') }, el); break;
        case 'ArrowDown':  commit(target, { pitch: target.value.pitch + stepOf('pitch') }, el); break;
        default: return;
      }
      e.preventDefault();
      return;
    }
    switch (e.key) {
      case 'Escape':     disarm(); break;
      case 'ArrowLeft':  commit(target, { x: target.value.x - stepOf('x') }); break;
      case 'ArrowRight': commit(target, { x: target.value.x + stepOf('x') }); break;
      case 'ArrowUp':    commit(target, { y: target.value.y - stepOf('y') }); break;
      case 'ArrowDown':  commit(target, { y: target.value.y + stepOf('y') }); break;
      case '[':          if (target.hasRotate) commit(target, { rotate: target.value.rotate - stepOf('rotate') * 2 }); break;
      case ']':          if (target.hasRotate) commit(target, { rotate: target.value.rotate + stepOf('rotate') * 2 }); break;
      case '+': case '=': zoomAt(target, el, stepOf('zoom') * 5); break;
      case '-':           zoomAt(target, el, -stepOf('zoom') * 5); break;
      default: return;
    }
    e.preventDefault();
  };
  layer.addEventListener('keydown', onKey);

  // Sidebar parity (WP-D): focusing a framing control in the sidebar arms its
  // image on the canvas, so the overlay is reachable without a pointer and the
  // two halves of the same input are never separately "selected". Delegated on
  // the document because the sidebar rebuilds on every model change.
  const onFocusIn = (e: FocusEvent): void => {
    const row = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-input-id]');
    const id = row?.dataset.inputId;
    if (!id || id === armedKey) return;
    if (canvasEl.querySelector(`[data-framing="${CSS.escape(id)}"]`)) arm(id);
  };
  document.addEventListener('focusin', onFocusIn);

  // Re-place the chrome after each render, resize and stage nav - the framed
  // element is a fresh node every paint, and the fit scale moves under it.
  const unsub = runtime.subscribe(() => position());
  const onResize = (): void => position();
  window.addEventListener('resize', onResize);
  const ro = new ResizeObserver(() => position());
  ro.observe(stageEl);

  return () => {
    unsub();
    document.removeEventListener('focusin', onFocusIn);
    window.removeEventListener('resize', onResize);
    ro.disconnect();
    canvasEl.removeEventListener('pointerdown', onCanvasDown);
    canvasEl.removeEventListener('wheel', onWheel);
    canvasEl.removeEventListener('dblclick', onDblClick);
    layer.remove();
  };
}

/** True when a tool has at least one framing control worth mounting the overlay for. */
export function hasFramingInputs(model: InputModelItem[]): boolean {
  return model.some(i =>
    (i as { framingFor?: string }).framingFor
    || (Array.isArray(i.fields) && (i.fields as Array<{ framingFor?: string }>).some(f => f.framingFor)));
}
