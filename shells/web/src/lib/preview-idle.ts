// SPDX-License-Identifier: MPL-2.0
/**
 * Preview work that waits for an idle moment (plan 373, decisions 4 and 6): the
 * move of old pictures into the preview store, and the redraw of a session tile
 * whose picture came from another build or another device.
 *
 * Nothing here runs when it would compete with the person or with a render:
 *
 *  - the tab is hidden, or the page is opening a tool (the tool route and the
 *    open sequence's held view, view-fade.ts);
 *  - an export or a batch render is running (lib/render-busy.ts);
 *  - Performance UI is on (by hand or switched on by the device's own signals,
 *    plan 335), the battery is low and not charging, or the browser asks to save
 *    data.
 *
 * A redraw also never replaces a picture made with another design system: a saved
 * piece records what was made, and drawing it in today's brand would make a
 * picture of something that was never saved. At most 20 tiles are redrawn for each
 * visit to a view. Under reduced motion a redrawn picture is stored for the next
 * visit and the tile on screen is left as it is, so nothing changes under the
 * person's eyes.
 */
import type { IDBPDatabase } from 'idb';
import { prefersReducedMotion } from './a11y-prefs.ts';
import { renderBusy } from './render-busy.ts';

/** Most tiles one visit to a view redraws. */
const REDRAWS_PER_VISIT = 20;

let lastRoute = '';
let redrawsThisVisit = 0;
const queued = new Map<string, { slot: string; toolId?: string; key?: string }>();
const done = new Set<string>();
let running = false;

function currentRoute(): string {
  return typeof location === 'undefined' ? '' : location.hash.split('?')[0] ?? '';
}

/** Whether idle preview work may run now. Exported for tests. */
export function previewWorkAllowed(): boolean {
  if (typeof document === 'undefined') return false;
  if (document.visibilityState !== 'visible') return false;
  if (currentRoute().startsWith('#/tool')) return false;
  if (document.querySelector('.view-fade--hold')) return false;
  if (renderBusy()) return false;
  if (constrained) return false;
  try {
    const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
    if (nav.connection?.saveData) return false;
  } catch { /* no connection info */ }
  if (perfUi()) return false;
  return true;
}

let perfUiRead: (() => boolean) | null = null;
function perfUi(): boolean {
  if (!perfUiRead) {
    perfUiRead = () => false;
    void import('../feature-flags.ts').then(m => { perfUiRead = m.perfUiOn; }).catch(() => {});
  }
  return perfUiRead();
}

let constrained = false;
let batteryWatched = false;
function watchBattery(): void {
  if (batteryWatched) return;
  batteryWatched = true;
  const nav = navigator as Navigator & { getBattery?: () => Promise<{ charging: boolean; level: number; addEventListener(type: string, fn: () => void): void }> };
  void nav.getBattery?.().then(async battery => {
    const { batteryConstrained } = await import('./perf-ui-auto-temporary.ts');
    const read = (): void => { constrained = batteryConstrained(battery.charging, battery.level); };
    read();
    battery.addEventListener('levelchange', read);
    battery.addEventListener('chargingchange', read);
  }).catch(() => {});
}

/** A timer that never keeps a test process alive. */
function later(fn: () => void, ms: number): ReturnType<typeof setTimeout> {
  const timer = setTimeout(fn, ms);
  (timer as { unref?: () => void }).unref?.();
  return timer;
}

/** Wait until the work might be allowed again: the tab comes back, the route
 *  changes, or (for a render or a power state, which send no event) a while passes. */
function wake(fn: () => void): void {
  let woken = false;
  const go = (): void => {
    if (woken) return;
    woken = true;
    window.removeEventListener('hashchange', go);
    document.removeEventListener('visibilitychange', go);
    clearTimeout(timer);
    fn();
  };
  window.addEventListener('hashchange', go);
  document.addEventListener('visibilitychange', go);
  const timer = later(go, 15_000);
}

/** Run `step` on idle slices until it reports done or work stops being allowed. */
function onIdle(step: (deadline: () => boolean) => Promise<boolean>): void {
  if (typeof window === 'undefined' || typeof document === 'undefined' || typeof window.addEventListener !== 'function') return;
  const idle = (window as Window & { requestIdleCallback?: (cb: (d: { timeRemaining(): number }) => void, o?: { timeout: number }) => number }).requestIdleCallback;
  const schedule = (fn: () => void): void => { if (idle) idle(() => fn(), { timeout: 5000 }); else later(fn, 400); };
  const run = (): void => {
    if (!previewWorkAllowed()) { wake(() => schedule(run)); return; }
    const started = performance.now();
    void step(() => performance.now() - started > 40 || !previewWorkAllowed()).then(finished => {
      if (!finished) schedule(run);
    }).catch(() => { /* the next load tries again */ });
  };
  schedule(run);
}

let migrationStarted = false;
/**
 * Move every picture written before plan 373 into the preview store, a few records
 * per idle slice: sessions (which also builds the lean list), History previews and
 * the export log, then pictures no record points at. Safe to stop at any point
 * (each step is one transaction) and resumes where it stopped on the next load.
 */
export function startPreviewMigration(db: IDBPDatabase): void {
  // A measurement hook (scripts/seed-preview-library.ts holds the move back to
  // measure a library as it was), like the preview build's __lollyForceVectorThumb.
  if ((globalThis as { __lollyPreviewMoveHold?: boolean }).__lollyPreviewMoveHold) return;
  if (migrationStarted || !db.objectStoreNames.contains('preview-index')) return;
  migrationStarted = true;
  watchBattery();
  let stage = 0;
  onIdle(async stop => {
    const list = await import('../bridge/state-list.ts');
    const opts = { stop, batch: 8 };
    if (stage === 0) { if (!await list.migrateSessions(db, opts)) return false; stage = 1; }
    if (stage === 1) { if (!await list.migrateRevisionPreviews(db, opts)) return false; stage = 2; }
    if (stage === 2) { if (!await list.migrateExportPictures(db, opts)) return false; stage = 3; }
    if (stage === 3) { await list.migrateStragglers(db, opts); if (stop()) return false; stage = 4; }
    if (stage === 4) {
      await list.sweepOrphanPictures(db, opts);
      if (stop()) return false;
      const { sweepPreviewCache } = await import('./preview-cache.ts');
      await sweepPreviewCache().catch(() => 0);
    }
    return true;
  });
}

/** A session tile whose picture is stale or missing, asking for a redraw. */
export function queueStaleTile(tile: { slot: string; toolId?: string; key?: string }): void {
  if (!tile.slot || done.has(tile.slot)) return;
  queued.set(tile.slot, tile);
  watchBattery();
  if (!running) { running = true; onIdle(drainOne); }
}

/** The host the redraw renders with (set by the bridge once it exists). */
let redrawHost: RedrawHost | null = null;
export interface RedrawHost {
  state: { load(slot: string): Promise<unknown>; save(slot: string, data: never, picture?: unknown): Promise<void>; list?: () => Promise<unknown> };
}
export function setRedrawHost(host: RedrawHost | null): void { redrawHost = host; }

async function drainOne(stop: () => boolean): Promise<boolean> {
  const route = currentRoute();
  if (route !== lastRoute) { lastRoute = route; redrawsThisVisit = 0; }
  while (queued.size) {
    if (stop()) return false;
    if (redrawsThisVisit >= REDRAWS_PER_VISIT) { queued.clear(); break; }
    const [slot, tile] = queued.entries().next().value as [string, { slot: string; toolId?: string; key?: string }];
    queued.delete(slot);
    done.add(slot);
    redrawsThisVisit++;
    await redrawSession(tile).catch(() => { /* the tile keeps the picture it has */ });
  }
  running = false;
  return true;
}

/**
 * Draw a saved session again through the tool's own render path (the same offscreen
 * export a Projects download uses) and store the picture with the session. Skipped
 * for a batch session, a session made with another design system, or one whose
 * record changed while it drew.
 */
async function redrawSession(tile: { slot: string; key?: string }): Promise<void> {
  const host = redrawHost ?? (await import('./host-ref.ts')).getHostRef() as unknown as RedrawHost | null;
  if (!host) return;
  const { isBatchSlot } = await import('./batch-slots.ts');
  if (isBatchSlot(tile.slot)) return;
  const { openDB } = await import('../bridge/db.ts');
  const db = await openDB();
  const before = await db.get('state', tile.slot) as { updatedAt?: string; designSystem?: { id: string }; data?: Record<string, unknown> } | undefined;
  if (!before?.data) return;
  const active = await db.get('profile', 'active-design-system').catch(() => undefined);
  if (before.designSystem?.id && typeof active === 'string' && active && active !== before.designSystem.id) return;
  const { renderSessionPicture } = await import('./preview-render.ts');
  const picture = await renderSessionPicture(host as never, before.data);
  if (!picture) return;
  const after = await db.get('state', tile.slot) as { updatedAt?: string; data?: unknown } | undefined;
  if (!after || after.updatedAt !== before.updatedAt) return;
  const { attachSessionPicture } = await import('./preview-cache.ts');
  const ref = await attachSessionPicture(db, tile.slot, before.updatedAt!, picture);
  if (!ref || prefersReducedMotion()) return;
  const { pictureSrcFor } = await import('../components/preview-image.ts');
  const src = await pictureSrcFor(ref);
  if (!src) return;
  for (const img of document.querySelectorAll<HTMLImageElement>('img[data-preview-slot]')) {
    if (img.dataset.previewSlot !== tile.slot) continue;
    img.dataset.previewKey = ref.key;
    img.dataset.previewType = ref.type;
    img.dataset.previewRoute = ref.route ?? '';
    img.src = src;
  }
}

/** For tests: forget what has been queued and redrawn. */
export function resetPreviewIdle(): void {
  queued.clear(); done.clear(); running = false; redrawsThisVisit = 0; lastRoute = ''; migrationStarted = false;
}
