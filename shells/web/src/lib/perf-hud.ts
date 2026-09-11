// SPDX-License-Identifier: MPL-2.0
/**
 * Performance HUD (perf-hud flag) - an opt-in, draggable diagnostic overlay.
 *
 * A body-level fixed singleton mounted in the SAME floating cluster as the job
 * toast (lib/job-toast.ts), OUTSIDE main#view so a router view teardown never
 * reaches it. It shows live stats for debugging + power users:
 *   - FPS, measured from the requestAnimationFrame delta (a diagnostic loop, so
 *     it runs while the HUD is shown regardless of reduced-motion);
 *   - this device's memory (navigator.deviceMemory) and CPU threads
 *     (navigator.hardwareConcurrency), read once at mount.
 *
 * DRAGGABLE: a pointer-drag on the header repositions it, switching from the CSS
 * default corner to inline top/left, clamped fully on-screen. Position is
 * in-memory only (resets on reload) - a diagnostic overlay, not a saved layout.
 *
 * OFF by default. mountPerfHud() no-ops unless perfHudOn() is true, so with the
 * flag off no element mounts and no rAF loop runs - the app is byte-identical
 * (the opt-in rule). The job-toast boot hook mounts it for a returning power
 * user; the profile toggle mounts/unmounts it live. CSS lives in the shared
 * parts/job-toast.css (the same body-level floating cluster's sheet).
 */
import { perfHudOn } from '../feature-flags.ts';
import { tRaw } from '../i18n.ts';
import { icon } from './icons.ts';
import { attachWobble } from './wobble.ts';

const DASH = '-';

let root: HTMLElement | null = null;
let fpsEl: HTMLElement | null = null;
let wobble: ReturnType<typeof attachWobble> | null = null;
let rafId = 0;
// FPS sampling: count frames over a short window, then divide by the elapsed ms.
let frames = 0;
let windowStart = 0;

/** navigator.deviceMemory (GB) rendered like device-info.ts's System card, or a dash. */
function memoryText(): string {
  const mem = (typeof navigator !== 'undefined' ? (navigator as Navigator & { deviceMemory?: number }).deviceMemory : undefined);
  return mem ? `${mem} GB` : DASH;
}

/** navigator.hardwareConcurrency, or a dash when the browser withholds it. */
function threadsText(): string {
  const n = (typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : undefined);
  return Number.isFinite(n) ? String(n) : DASH;
}

// Static scaffold: a drag header + three readout rows. Only trusted content -
// icon() registry glyphs and tRaw() app strings, no interpolated user values -
// so this single innerHTML sink carries nothing to escape. The live FPS value
// is written via textContent every frame (fpsEl), never through this markup.
function scaffold(): string {
  const row = (glyph: string, label: string, key: string, initial: string) => `
    <div class="perf-hud-row">
      <span class="perf-hud-label">${icon(glyph as Parameters<typeof icon>[0])}${tRaw(label)}</span>
      <span class="perf-hud-value" data-hud="${key}">${initial}</span>
    </div>`;
  return `
    <div class="perf-hud-head" data-hud-drag>
      <span class="perf-hud-grip" aria-hidden="true">${icon('move')}</span>
      <span class="perf-hud-title">${tRaw('Performance')}</span>
    </div>
    <div class="perf-hud-body">
      ${row('zap', 'FPS', 'fps', DASH)}
      ${row('layers', 'Memory', 'mem', memoryText())}
      ${row('cpu', 'Threads', 'cpu', threadsText())}
    </div>`;
}

/** Keep the HUD fully inside the viewport, given a proposed top-left. */
function clamp(el: HTMLElement, left: number, top: number): { left: number; top: number } {
  const r = el.getBoundingClientRect();
  const maxLeft = Math.max(0, window.innerWidth - r.width);
  const maxTop = Math.max(0, window.innerHeight - r.height);
  return { left: Math.min(Math.max(0, left), maxLeft), top: Math.min(Math.max(0, top), maxTop) };
}

// Pointer-drag on the header. First drag switches from the CSS bottom/left corner
// to explicit top/left so the clamp math has one coordinate space to reason about.
function wireDrag(el: HTMLElement): void {
  const handle = el.querySelector<HTMLElement>('[data-hud-drag]');
  if (!handle) return;
  wobble = attachWobble(el);
  let dragging = false;
  let dx = 0;
  let dy = 0;
  // Previous pointer pos, so pointermove can feed wobble.drag() per-move DELTAS.
  let prevX = 0;
  let prevY = 0;
  handle.addEventListener('pointerdown', (e: PointerEvent) => {
    dragging = true;
    const r = el.getBoundingClientRect();
    dx = e.clientX - r.left;
    dy = e.clientY - r.top;
    prevX = e.clientX;
    prevY = e.clientY;
    // Pin the CURRENT position as top/left BEFORE releasing the corner, so a bare click (no
    // pointermove) can't leave the box with both top+bottom auto and drop it to static.
    el.style.left = `${r.left}px`;
    el.style.top = `${r.top}px`;
    el.style.right = 'auto';
    el.style.bottom = 'auto';
    el.classList.add('is-dragging');
    try { handle.setPointerCapture(e.pointerId); } catch { /* capture is best-effort */ }
    wobble?.grab(e.clientX, e.clientY);
    e.preventDefault();
  });
  handle.addEventListener('pointermove', (e: PointerEvent) => {
    if (!dragging) return;
    const { left, top } = clamp(el, e.clientX - dx, e.clientY - dy);
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    wobble?.drag(e.clientX - prevX, e.clientY - prevY);
    prevX = e.clientX;
    prevY = e.clientY;
  });
  const end = (e: PointerEvent): void => {
    if (!dragging) return;
    dragging = false;
    el.classList.remove('is-dragging');
    try { handle.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    wobble?.release();
  };
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
}

// The FPS loop. Diagnostic, so it runs while the HUD is shown even under reduced
// motion - it paints a number, it doesn't animate anything decorative.
function tick(now: number): void {
  if (!root) return;
  if (!windowStart) windowStart = now;
  frames += 1;
  const elapsed = now - windowStart;
  if (elapsed >= 500) {
    const fps = Math.round((frames / elapsed) * 1000);
    if (fpsEl) fpsEl.textContent = String(fps);
    frames = 0;
    windowStart = now;
  }
  rafId = requestAnimationFrame(tick);
}

/**
 * Mount the HUD once. No-ops unless the perf-hud flag is on (byte-identical when
 * off) and idempotent - a second call while mounted does nothing.
 */
export function mountPerfHud(): void {
  if (!perfHudOn()) return;
  if (typeof document === 'undefined' || !document.body) return;
  if (root && document.body.contains(root)) return;
  root = document.createElement('div');
  root.className = 'perf-hud';
  root.setAttribute('role', 'status');
  // The FPS value changes every ~half-second; announcing it would flood a screen
  // reader, so this is a silent live region (the numbers are a visual diagnostic).
  root.setAttribute('aria-live', 'off');
  root.setAttribute('aria-label', tRaw('Performance HUD'));
  root.innerHTML = scaffold();
  document.body.appendChild(root);
  fpsEl = root.querySelector<HTMLElement>('[data-hud="fps"]');
  wireDrag(root);
  frames = 0;
  windowStart = 0;
  rafId = requestAnimationFrame(tick);
}

/** Tear the HUD down and stop its loop. Safe to call when nothing is mounted. */
export function unmountPerfHud(): void {
  if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
  if (wobble) { wobble.dispose(); wobble = null; }
  if (root) { root.remove(); root = null; }
  fpsEl = null;
}

/** Whether the HUD is currently mounted (for tests + re-entrancy checks). */
export function isPerfHudMounted(): boolean {
  return !!root && typeof document !== 'undefined' && document.body.contains(root);
}
