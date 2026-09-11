// SPDX-License-Identifier: MPL-2.0
/**
 * Static previews for `singleInstance` tools inside multi-edit.
 *
 * A tool flagged `singleInstance` (the WebGL / window-global family - spatial-photo,
 * synth, the 3D viewers, live viz) assumes it is the ONLY instance on the page: it
 * parks a mutable handle on `window` and disposes the PREVIOUS instance when a new one
 * mounts, and WebGL contexts are capped (~16/tab), so N live copies can't coexist.
 * Multi-edit renders N cells into ONE document, which broke that contract - the last
 * cell to mount disposed all the earlier ones (the reported "only one of four copies
 * paints").
 *
 * So these cells are never live-painted. Each renders through the SAME path Download-all
 * uses (`renderRowToBlob`, which waits for the tool's `tool:ready` before capturing, so
 * an async photo/depth load arrives) and shows the resulting still as an <img>. Every
 * render is SERIALIZED behind one shared chain: they share the same window globals, so
 * two overlapping renders would dispose each other. The cell's runtime still exists in
 * the view (for the shared-input model, save and export) - only its canvas is a still.
 */
import { renderRowToBlob } from '../pro/render-export.ts';
import type { InputValue } from '../../../../engine/src/inputs.js';

type Host = Parameters<typeof renderRowToBlob>[1];

export interface SinglePreviewer {
  /** Debounced + globally-serialized render of one cell to a still <img>. `key` is the
   *  cell's stable id (its slot) - repeat schedules for the same key coalesce and reuse
   *  its object URL. `onReady` fires once the still is on screen (used to retire the
   *  cell's stored thumbnail, which a transparent-background tool would otherwise show
   *  through). */
  schedule(key: string, toolId: string, values: Record<string, InputValue>, cellEl: HTMLElement, onReady?: () => void): void;
  /** The object URL of this cell's current still, or null - so a caller freezing a live
   *  cell to a still (no canvas to snapshot) can fall back to the last one we rendered. */
  lastUrl(key: string): string | null;
  dispose(): void;
}

const DEBOUNCE_MS = 200;

/** The default renderer: a still PNG through the same export path Download-all uses. */
const defaultRender = (host: Host) =>
  (toolId: string, values: Record<string, InputValue>): Promise<Blob> =>
    renderRowToBlob({ toolId, values }, host, { format: 'png', thumbnail: true, thumbAssets: true }).then(r => r.blob);

export function createSinglePreviewer(
  host: Host,
  // `render` / `debounceMs` are injectable so the debounce+serialize+URL lifecycle is
  // unit-testable without the whole engine (lib/multi-edit-single.test.ts).
  opts: { render?: (toolId: string, values: Record<string, InputValue>) => Promise<Blob>; debounceMs?: number } = {},
): SinglePreviewer {
  const doRender = opts.render ?? defaultRender(host);
  const debounceMs = opts.debounceMs ?? DEBOUNCE_MS;
  // One chain for the WHOLE grid: distinct singleInstance tools still share the tab's
  // WebGL budget and (per tool) their window globals, so nothing renders concurrently.
  let chain: Promise<unknown> = Promise.resolve();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const urls = new Map<string, string>();
  let disposed = false;

  const render = (key: string, toolId: string, values: Record<string, InputValue>, cellEl: HTMLElement, onReady?: () => void): void => {
    chain = chain.then(async () => {
      if (disposed || !cellEl.isConnected) return;
      let blob: Blob;
      try {
        blob = await doRender(toolId, values);
      } catch (err) {
        // Leave whatever the cell already shows (a prior preview or its stored thumbnail).
        console.warn('[multi-edit] single-instance preview failed:', toolId, err);
        return;
      }
      if (disposed || !cellEl.isConnected) return;
      const url = URL.createObjectURL(blob);
      const prev = urls.get(key);
      urls.set(key, url);
      if (prev) URL.revokeObjectURL(prev);
      let img = cellEl.querySelector<HTMLImageElement>('img.me-preview');
      if (!img) {
        cellEl.textContent = '';
        img = document.createElement('img');
        img.className = 'me-preview';
        img.alt = '';
        cellEl.appendChild(img);
      }
      // Retire the stored thumbnail only once the real still has PAINTED - a transparent
      // tool (3D on a scene background) would otherwise show the old thumbnail through it.
      if (onReady) img.onload = () => onReady();
      img.src = url;
    }).catch(() => { /* one cell's failure must not stall the chain */ });
  };

  return {
    schedule(key, toolId, values, cellEl, onReady) {
      if (disposed) return;
      const t = timers.get(key);
      if (t) clearTimeout(t);
      timers.set(key, setTimeout(() => { timers.delete(key); render(key, toolId, values, cellEl, onReady); }, debounceMs));
    },
    lastUrl(key) { return urls.get(key) ?? null; },
    dispose() {
      disposed = true;
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
      for (const u of urls.values()) URL.revokeObjectURL(u);
      urls.clear();
    },
  };
}
