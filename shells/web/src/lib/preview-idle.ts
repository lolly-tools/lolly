// SPDX-License-Identifier: MPL-2.0
/**
 * Preview work that waits for an idle moment (plan 373, decisions 4 and 6): the
 * move of old pictures into the preview store, and the redraw of a session tile
 * whose picture came from another build or another device.
 *
 * Nothing here runs when it would compete with the person or with a render
 * (lib/preview-work-gate.ts): a hidden tab, a tool opening or open, an export or a
 * batch render, Performance UI, a low battery or Save-Data.
 *
 * A redraw also never replaces a picture made with another design system: a saved
 * piece records what was made, and drawing it in today's brand would make a
 * picture of something that was never saved. At most 20 tiles are redrawn for each
 * visit to a view. Under reduced motion a redrawn picture is stored for the next
 * visit and the tile on screen is left as it is, so nothing changes under the
 * person's eyes.
 */
import type { IDBPDatabase } from 'idb';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { prefersReducedMotion } from './a11y-prefs.ts';
import { onStaleTile, type StaleTile } from './preview-events.ts';
import { currentRoute, later, previewWorkAllowed, watchPreviewBattery, whenPreviewWorkMayResume } from './preview-work-gate.ts';

/** Whether idle preview work may run now (lib/preview-work-gate.ts). Exported for tests. */
export { previewWorkAllowed };

/** Most tiles one visit to a view redraws. */
const REDRAWS_PER_VISIT = 20;

let lastRoute = '';
let redrawsThisVisit = 0;
const queued = new Map<string, { slot: string; toolId?: string; key?: string }>();
const done = new Set<string>();
let running = false;

/** Run `step` on idle slices until it reports done or work stops being allowed. */
function onIdle(step: (deadline: () => boolean) => Promise<boolean>): void {
  if (typeof window === 'undefined' || typeof document === 'undefined' || typeof window.addEventListener !== 'function') return;
  const idle = (window as Window & { requestIdleCallback?: (cb: (d: { timeRemaining(): number }) => void, o?: { timeout: number }) => number }).requestIdleCallback;
  const schedule = (fn: () => void): void => { if (idle) idle(() => fn(), { timeout: 5000 }); else later(fn, 400); };
  const run = (): void => {
    if (!previewWorkAllowed()) { whenPreviewWorkMayResume(() => schedule(run), 15_000); return; }
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
export function startPreviewMigration(given?: IDBPDatabase): void {
  // A measurement hook (scripts/seed-preview-library.ts holds the move back to
  // measure a library as it was), like the preview build's __lollyForceVectorThumb.
  if ((globalThis as { __lollyPreviewMoveHold?: boolean }).__lollyPreviewMoveHold) return;
  if (migrationStarted) return;
  migrationStarted = true;
  void (given ? Promise.resolve(given) : import('../bridge/db.ts').then(m => m.openDB())).then(db => {
    if (db.objectStoreNames.contains('preview-index')) migrateOnIdle(db);
  }).catch(() => { migrationStarted = false; });
}

function migrateOnIdle(db: IDBPDatabase): void {
  watchPreviewBattery();
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
export function queueStaleTile(tile: StaleTile): void {
  if (!tile.slot || done.has(tile.slot)) return;
  queued.set(tile.slot, tile);
  watchPreviewBattery();
  if (!running) { running = true; onIdle(drainOne); }
}

/** The host the redraw renders with: the live web host (lib/host-ref.ts), or one a
 *  test sets. */
let redrawHost: HostV1 | null = null;
export function setRedrawHost(host: HostV1 | null): void { redrawHost = host; }

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
  const host = redrawHost ?? (await import('./host-ref.ts')).getHostRef();
  if (!host) return;
  const { isBatchSlot } = await import('./batch-slots.ts');
  if (isBatchSlot(tile.slot)) return;
  const { openDB } = await import('../bridge/db.ts');
  const db = await openDB();
  const before = await db.get('state', tile.slot) as { updatedAt?: string; thumb?: string | null; preview?: unknown; designSystem?: { id: string }; data?: Record<string, unknown> } | undefined;
  if (!before?.data) return;
  const active = await db.get('profile', 'active-design-system').catch(() => undefined);
  if (before.designSystem?.id && typeof active === 'string' && active && active !== before.designSystem.id) return;
  const { renderSessionPicture } = await import('./preview-render.ts');
  const picture = await renderSessionPicture(host, before.data);
  if (!picture) return;
  const after = await db.get('state', tile.slot) as { updatedAt?: string; data?: unknown } | undefined;
  if (!after || after.updatedAt !== before.updatedAt) return;
  const { attachSessionPicture } = await import('./preview-cache.ts');
  const ref = await attachSessionPicture(db, tile.slot, { updatedAt: before.updatedAt!, thumb: before.thumb ?? null, preview: before.preview }, picture);
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

// Reports made before this module loaded (lib/preview-events.ts) arrive now.
onStaleTile(queueStaleTile);
