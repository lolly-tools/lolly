// SPDX-License-Identifier: MPL-2.0
/**
 * Storage — the "Storage" collapsible section: the on-device usage meter,
 * saved-session management, "My images" management, cache/preview clearing,
 * the "clear all my data" wipe, and (via transfer.ts) the export/import
 * buttons that also live in this section's markup.
 *
 * LAZY: expensive work (storage estimate, asset listing/sizes, the
 * image-thumbnail grid) is deferred until the section is first expanded, so
 * first paint only awaits profile + headshot.
 */

import { escape } from '../../utils.ts';
import { announce } from '../../a11y.ts';
import { applyTheme } from '../../theme.ts';
import { MAX_USER_ASSETS } from '../../bridge/assets.ts';
import { storeUserUpload } from '../picker.ts';
import { confirmDialog } from '../../components/confirm-dialog.ts';
import { relativeTime } from '../../folder-tiles.ts';
import { isBatchSlot } from '../../batch-slots.ts';
import { openImageLightbox } from './lightbox.ts';
import { wireDataTransfer } from './transfer.ts';
import { HEADSHOT_ID } from './edit.ts';
import type { WebHost } from '../../bridge/index.ts';
import type { AssetRef } from '@lolly/engine';
import type { StateEntry } from '@lolly/engine';

/** A catalog-index tool entry as this view reads it (window.__toolIndex). */
interface IndexedTool {
  id: string;
  name: string;
}

// Randomised word the user must type to confirm the irreversible "clear all my
// data" action — deliberate speed-bump against an accidental wipe.
const CLEAR_CONFIRM_WORDS = ['lolly', 'open', 'free', 'privacy', 'choice', 'thank you', 'security', 'goodbye'];

// Chevron for a collapsible section's summary (rotates 90° when open via CSS).
export const COLLAPSE_CHEV = `<svg class="profile-collapse-chev" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>`;

// A small "i" badge with a hover/focus tooltip — used beside storage headings.
// A real <button> (not a tabbable span) so its role + keyboard focus are native.
export const infoDot = (text: string): string =>
  `<button type="button" class="info-dot" aria-label="${escape(text)}">i<span class="info-tip" aria-hidden="true">${escape(text)}</span></button>`;

function clearIdbStores(storeNames: readonly string[]): Promise<void> {
  return new Promise((res, rej) => {
    const req = indexedDB.open('lolly');
    req.onerror = rej;
    req.onsuccess = e => {
      const db = (e.target as IDBOpenDBRequest).result;
      const tx = db.transaction(storeNames.filter(n => [...db.objectStoreNames].includes(n)), 'readwrite');
      tx.oncomplete = () => { db.close(); res(); };
      tx.onerror    = rej;
      storeNames.forEach(n => {
        if ([...db.objectStoreNames].includes(n)) tx.objectStore(n).clear();
      });
    };
  });
}

function fmtBytes(bytes: number): string {
  if (!bytes) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function userImageThumb(ref: AssetRef): string {
  const name = ref.meta?.name ?? 'Image';
  // SVGs (logos/icons) shouldn't be cropped to fill — show the whole mark.
  const isVector = ref.type === 'vector' || ref.format === 'svg';
  return `
    <div class="userimg-item" data-userimg="${escape(ref.id)}">
      <button type="button" class="userimg-view" data-view-userimg="${escape(ref.id)}" title="${escape(name)}" aria-label="View ${escape(name)}">
        <img class="userimg-thumb${isVector ? ' is-vector' : ''}" src="${escape(ref.url)}" alt="${escape(name)}" loading="lazy">
      </button>
      <button type="button" class="userimg-delete" data-delete-userimg="${escape(ref.id)}" title="Delete" aria-label="Delete ${escape(name)}">&#x2715;</button>
    </div>
  `;
}

export interface MountStorageSectionOptions {
  /** Re-mount the whole profile view (after a full wipe or a successful import). */
  remount: () => Promise<void>;
}

export interface StorageSectionHandle {
  /** Re-measure and refresh the meter — a no-op while the section is still collapsed. */
  refresh(): Promise<void>;
}

// Mount the Storage section: wires the lazy-load-on-expand behaviour and
// returns a handle other sections (the headshot / "My images" editors) can
// use to keep the meter honest after they change user-asset bytes.
export function mountStorageSection(viewEl: HTMLElement, host: WebHost, opts: MountStorageSectionOptions): StorageSectionHandle {
  const storageDetails = viewEl.querySelector<HTMLDetailsElement>('#storage-section');
  let storageLoaded = false;
  // Set once loadStorage() has run, so refresh() can reach its refreshMeter.
  let refreshMeterFn: (() => Promise<void>) | null = null;

  // Tool display names for glyph sessions saved without a thumbnail.
  const toolNameById = new Map<string, string>(
    (((window as Window & { __toolIndex?: { tools?: IndexedTool[] } }).__toolIndex?.tools) ?? []).map(t => [t.id, t.name]),
  );
  const toolNameOf = (id: string): string => toolNameById.get(id) || id || 'Saved session';
  const SESS_PLACEHOLDER = `<span class="store-sess-thumb is-placeholder" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="1.5"/><path d="m21 15-4.5-4.5L7 21"/></svg></span>`;
  const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Approximate, theme-agnostic byte-percentage formatting shared by the meter.
  const fmtPct = (usage: number, quota: number): string => {
    if (!quota) return '0%';
    const p = (usage / quota) * 100;
    if (p < 0.1) return '<0.1%';
    return p < 10 ? `${p.toFixed(1)}%` : `${Math.round(p)}%`;
  };

  interface PreviewsMeasure { bytes: number; count: number; available: boolean }

  // Tool-previews cache: measurable (size()/list()) + clearable. Feature-detected so
  // an older/rebuilt bridge without host.previews just folds its bytes into "Other".
  async function measurePreviews(): Promise<PreviewsMeasure> {
    if (!host.previews?.list) return { bytes: 0, count: 0, available: false };
    try {
      const list = await host.previews.list();
      const bytes = typeof host.previews.size === 'function'
        ? await host.previews.size()
        : list.reduce((n, r) => n + (r?.thumb ? r.thumb.length : 0), 0);
      return { bytes, count: list.length, available: true };
    } catch { return { bytes: 0, count: 0, available: false }; }
  }

  interface StorageModel {
    sessions: { bytes: number; count: number; sizes: Record<string, number>; list: readonly StateEntry[] };
    images: { bytes: number; count: number; list: AssetRef[] };
    cache: { bytes: number };
    previews: PreviewsMeasure;
    measured: number;
    hasEstimate: boolean;
    usage: number;
    quota: number;
    overshoot: boolean;
    other: number;
    total: number;
  }

  // Read every measurer + the browser's ground-truth estimate into one model. The
  // four measured slices never sum to estimate().usage — the honest remainder is
  // "Other" = max(0, usage − measured), so measured + Other == usage by construction.
  async function measure(): Promise<StorageModel> {
    const estP = navigator.storage?.estimate
      ? navigator.storage.estimate().catch(() => null)
      : Promise.resolve(null);
    const [estimate, sessions, sessionSizes, cacheBytes, allImages, imagesBytes, previews] = await Promise.all([
      estP,
      host.state.list().catch(() => []),
      host.state.sizes().catch(() => ({})),
      host.assets._blobCacheSize().catch(() => 0),
      host.assets._listUserAssets().catch(() => []),
      host.assets._userAssetsSize().catch(() => 0),
      measurePreviews(),
    ]);
    const sessBytes = Object.values(sessionSizes).reduce((s, n) => s + n, 0);
    const imageList = allImages.filter(a => a.id !== HEADSHOT_ID); // headshot hidden from the grid (its bytes stay in the slice)
    const measured = sessBytes + imagesBytes + cacheBytes + previews.bytes;
    const hasEstimate = !!(estimate && estimate.usage != null);
    const usage = hasEstimate && estimate?.usage != null ? estimate.usage : 0;
    const quota = (estimate && estimate.quota) || 0;
    const overshoot = hasEstimate && measured > usage; // estimates are bucketed/approximate
    const other = (hasEstimate && !overshoot) ? Math.max(0, usage - measured) : 0;
    const total = hasEstimate ? Math.max(usage, measured) : measured; // the hero number
    return {
      sessions: { bytes: sessBytes, count: sessions.length, sizes: sessionSizes, list: sessions },
      images: { bytes: imagesBytes, count: imageList.length, list: imageList },
      cache: { bytes: cacheBytes },
      previews,
      measured, hasEstimate, usage, quota, overshoot, other, total,
    };
  }

  // The one-read screen-reader overview (the bar itself stays interactive, not role=img).
  function reconciliationSentence(m: StorageModel): string {
    const parts = [
      `Saved sessions ${fmtBytes(m.sessions.bytes)}`,
      `My images ${fmtBytes(m.images.bytes)}`,
      `Asset cache ${fmtBytes(m.cache.bytes)}`,
    ];
    if (m.previews.available) parts.push(`Tool previews ${fmtBytes(m.previews.bytes)}`);
    let s = m.hasEstimate
      ? `Using ${fmtBytes(m.total)}: ${parts.join(', ')}`
      : `Measured ${fmtBytes(m.measured)}: ${parts.join(', ')}`;
    if (m.hasEstimate && m.other > 0) s += `, and about ${fmtBytes(m.other)} of other app data and overhead`;
    s += (m.hasEstimate && m.quota) ? ` — ${fmtPct(m.usage, m.quota)} of your ${fmtBytes(m.quota)} device budget.` : '.';
    return s;
  }

  // One selectable, deletable session row. Largest-first by default.
  function renderSessRow(s: StateEntry, bytes: number): string {
    const isBatch = isBatchSlot(s.slot);
    const label = s.label || toolNameOf(s.toolId);
    const thumb = SESS_PLACEHOLDER;
    return `<li class="store-sess" data-slot="${escape(s.slot)}">
      <input type="checkbox" class="store-sess-check" data-slot="${escape(s.slot)}" aria-label="Select ${escape(label)}">
      ${thumb}
      <span class="store-sess-meta">
        <span class="store-sess-label">${escape(label)}${isBatch ? '<span class="store-sess-tag">batch</span>' : ''}</span>
        <span class="store-sess-sub">${escape(toolNameOf(s.toolId))}${s.updatedAt ? ` · ${escape(relativeTime(s.updatedAt))}` : ''}</span>
      </span>
      <span class="session-size">${fmtBytes(bytes)}</span>
      <button type="button" class="store-sess-del" data-del-session="${escape(s.slot)}" aria-label="Delete ${escape(label)}">&#x2715;</button>
    </li>`;
  }
  function sessionRowsHtml(m: StorageModel, sort: string): string {
    const sizes = m.sessions.sizes;
    const rows = [...m.sessions.list];
    if (sort === 'recent') rows.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    else rows.sort((a, b) => (sizes[b.slot] || 0) - (sizes[a.slot] || 0));
    if (!rows.length) return `<li class="storage-empty">No saved sessions yet.</li>`;
    return rows.map(s => renderSessRow(s, sizes[s.slot] || 0)).join('');
  }

  // The whole section, rendered ONCE. applyMeter() then refreshes only the viz so an
  // open managed list (multi-select state) is never rebuilt out from under the user.
  function renderSection(m: StorageModel, sort: string): string {
    const hasPrev = m.previews.available;
    return `
      <section class="store-meter" aria-label="Storage on this device">
        <header class="store-hero">
          <p class="store-hero-num" id="store-hero-num" data-bytes="0">0 KB</p>
          <p class="store-hero-cap">On this device ${infoDot('The real total this origin uses on this device, measured by your browser. Everything below is on THIS device only — nothing is uploaded.')}</p>
          <p class="store-headroom" id="store-headroom" hidden></p>
        </header>

        <div class="store-bar" id="store-bar">
          <button type="button" class="seg" data-cat="sessions" style="flex-grow:0"></button>
          <button type="button" class="seg" data-cat="images" style="flex-grow:0"></button>
          <button type="button" class="seg" data-cat="cache" style="flex-grow:0"></button>
          <button type="button" class="seg" data-cat="previews" style="flex-grow:0"${hasPrev ? '' : ' hidden'}></button>
          <span class="seg seg--other" data-cat="other" style="flex-grow:0" aria-hidden="true" hidden></span>
        </div>
        <p class="visually-hidden" id="store-aria-sentence"></p>

        <ul class="store-legend" role="list">
          <li><button type="button" class="store-chip" data-cat="sessions"><span class="store-chip-sw" data-cat="sessions"></span><span class="store-chip-name">Saved sessions</span><span class="store-chip-val" data-size="sessions">—</span></button></li>
          <li><button type="button" class="store-chip" data-cat="images"><span class="store-chip-sw" data-cat="images"></span><span class="store-chip-name">My images</span><span class="store-chip-val" data-size="images">—</span></button></li>
          <li><button type="button" class="store-chip" data-cat="cache"><span class="store-chip-sw" data-cat="cache"></span><span class="store-chip-name">Asset cache</span><span class="store-chip-val" data-size="cache">—</span></button></li>
          ${hasPrev ? `<li><button type="button" class="store-chip" data-cat="previews"><span class="store-chip-sw" data-cat="previews"></span><span class="store-chip-name">Tool previews</span><span class="store-chip-val" data-size="previews">—</span></button></li>` : ''}
          ${m.hasEstimate ? `<li><span class="store-chip store-chip--other"><span class="store-chip-sw is-hatch"></span><span class="store-chip-name">Other</span><span class="store-chip-val" data-size="other">—</span>${infoDot('Your profile, internal indexes, the offline app cache and storage overhead — everything not itemised above. Calculated as total used minus the measured items. Clear it with "Clear all my data" below.')}</span></li>` : ''}
        </ul>

        <p class="store-quota" id="store-quota" hidden><span class="storage-bar-wrap"><span class="storage-bar-fill" id="store-quota-fill" style="width:0%"></span></span><span class="store-quota-text" id="store-quota-text"></span></p>
        <p class="store-reclaim" id="store-reclaim"></p>
        <p class="store-footnote" id="store-footnote" hidden></p>

        <div class="store-manages">
          <details class="store-manage" data-cat="sessions">
            <summary class="store-manage-sum">${COLLAPSE_CHEV}<span>Saved sessions</span> <span class="storage-count" data-count="sessions">0</span> <span class="storage-hint" data-size-hint="sessions">0 KB</span></summary>
            <div class="store-manage-body">
              <div class="store-sess-tools">
                <label class="store-selall"><input type="checkbox" id="sess-selall"> Select all</label>
                <button type="button" class="store-sort" data-sort="${sort}">${sort === 'recent' ? 'Recent ▾' : 'Largest first ▾'}</button>
              </div>
              <ul class="store-sess-list" id="store-sess-list">${sessionRowsHtml(m, sort)}</ul>
              <a class="store-manage-link" href="#/p">Organise in Projects →</a>
            </div>
          </details>

          <details class="store-manage" data-cat="images">
            <summary class="store-manage-sum">${COLLAPSE_CHEV}<span>My images</span> <span class="storage-count" id="userimg-count">0/${MAX_USER_ASSETS}</span> <span class="storage-hint" id="userimg-size">0 KB</span> ${infoDot('Images you save to reuse across tools. This size includes your profile photo.')}</summary>
            <div class="store-manage-body">
              <div class="userimg-grid" id="userimg-grid">
                ${m.images.list.map(userImageThumb).join('')}
                <button type="button" class="userimg-add" id="userimg-add" aria-label="Add images"${m.images.count >= MAX_USER_ASSETS ? ' hidden' : ''}>
                  <span class="userimg-add-icon" aria-hidden="true">+</span>
                  <span class="userimg-add-text">Add</span>
                </button>
              </div>
              <input type="file" id="userimg-file" accept="image/svg+xml,image/png,image/jpeg,image/webp" multiple hidden>
              <p class="profile-inline-error" id="userimg-error" style="color:hsl(var(--destructive));font-size:13px;margin:.4rem 0 0" hidden></p>
            </div>
          </details>

          <div class="store-manage store-manage--row" data-cat="cache">
            <span class="store-manage-name">Asset cache ${infoDot('Downloaded catalog content; it re-downloads on demand. Safe to clear.')} <span class="storage-count" data-size-label="cache">0 KB</span></span>
            <button type="button" id="clear-cache-btn" class="btn-link-danger">Clear cache</button>
          </div>

          ${hasPrev ? `<div class="store-manage store-manage--row" data-cat="previews">
            <span class="store-manage-name">Tool previews ${infoDot('Snapshots Lolly draws of personalised tool cards — they redraw when needed. Safe to clear.')} <span class="storage-count" data-size-label="previews">0 KB</span></span>
            <button type="button" id="clear-previews-btn" class="btn-link-danger">Clear previews</button>
          </div>` : ''}
        </div>

        <div class="storage-subsection">
          <div class="storage-subsection-header">
            <span>Move to another device ${infoDot('Export everything — profile, saved sessions, uploaded images and preferences — as one file, then import it on another offline install to pick up exactly where you left off. Stays entirely on your devices.')}</span>
          </div>
          <div class="storage-actions">
            <button type="button" id="export-data-btn" class="btn">Export my data</button>
            <button type="button" id="import-data-btn" class="btn">Import data…</button>
            <input type="file" id="import-data-input" accept=".zip,application/zip" hidden>
          </div>
        </div>

        <div class="storage-actions">
          <button type="button" id="clear-storage-btn" class="btn btn-danger">Clear all my data</button>
        </div>

        <div class="store-selbar" id="store-selbar" role="region" aria-live="polite" hidden>
          <span class="store-selbar-count">0 selected</span>
          <button type="button" class="btn store-selbar-clear">Clear selection</button>
          <button type="button" class="btn btn-danger store-selbar-del">Delete</button>
        </div>
      </section>`;
  }

  async function loadStorage(): Promise<void> {
    if (storageLoaded) return;
    storageLoaded = true;

    let model = await measure();
    let sessSort = 'size';
    const userImages = [...model.images.list]; // mutable mirror for the grid + lightbox

    const bodyEl = viewEl.querySelector<HTMLElement>('#storage-body');
    if (!bodyEl) return;
    // Re-bound to a non-null type: nested function declarations below don't retain
    // the narrowing from the guard above (control-flow analysis resets at function
    // boundaries), so give them a variable whose declared type is already non-null.
    const body: HTMLElement = bodyEl;
    body.innerHTML = renderSection(model, sessSort);

    const bar = body.querySelector<HTMLElement>('#store-bar');
    const heroNum = body.querySelector<HTMLElement>('#store-hero-num');
    const selbar = body.querySelector<HTMLElement>('#store-selbar');
    const setText = (sel: string, text: string) => body.querySelectorAll<HTMLElement>(sel).forEach(e => { e.textContent = text; });

    // Hero count-up — cosmetic; set instantly under reduced-motion OR a hidden tab
    // (rAF is paused when document.hidden, so the final value must land immediately).
    function countUp(el: HTMLElement | null, to: number) {
      if (!el) return;
      const from = Number(el.dataset.bytes || 0);
      el.dataset.bytes = String(to);
      if (reduceMotion() || document.hidden || from === to) { el.textContent = fmtBytes(to); return; }
      const dur = 600; let t0: number | null = null;
      const tick = (now: number) => {
        if (t0 == null) t0 = now;
        const p = Math.min(1, (now - t0) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = fmtBytes(Math.round(from + (to - from) * eased));
        if (p < 1) requestAnimationFrame(tick); else el.textContent = fmtBytes(to);
      };
      requestAnimationFrame(tick);
    }

    const selectedSessionBytes = () => {
      let n = 0;
      body.querySelectorAll<HTMLInputElement>('.store-sess-check:checked').forEach(c => { n += model.sessions.sizes[c.dataset.slot ?? ''] || 0; });
      return n;
    };
    function updateReclaim(m: StorageModel) {
      const el = body.querySelector<HTMLElement>('#store-reclaim');
      if (el) el.innerHTML = `Up to <strong>${fmtBytes(m.cache.bytes + m.previews.bytes + selectedSessionBytes())}</strong> can be freed here`;
    }

    // Refresh ONLY the visualization (hero, segments, legend, quota, reclaim, aria,
    // manage-summary badges) from a fresh model. Never rebuilds the session list/grid.
    function applyMeter(m: StorageModel) {
      countUp(heroNum, m.hasEstimate ? m.total : m.measured);
      const headroom = body.querySelector<HTMLElement>('#store-headroom');
      if (headroom) {
        if (m.hasEstimate && m.quota) {
          const used = m.usage / m.quota;
          const phrase = used < 0.5 ? 'lots of room left' : used < 0.8 ? 'plenty of room left' : used < 0.95 ? 'getting full' : 'almost full';
          headroom.textContent = `Using ${fmtPct(m.usage, m.quota)} of your ${fmtBytes(m.quota)} device budget · ${phrase}`;
          headroom.hidden = false;
        } else headroom.hidden = true;
      }
      const segs: [string, number, string, boolean][] = [
        ['sessions', m.sessions.bytes, 'Saved sessions', true],
        ['images', m.images.bytes, 'My images', true],
        ['cache', m.cache.bytes, 'Asset cache', true],
        ['previews', m.previews.bytes, 'Tool previews', m.previews.available],
      ];
      for (const [cat, bytes, label, avail] of segs) {
        const seg = bar?.querySelector<HTMLElement>(`.seg[data-cat="${cat}"]`);
        if (!seg) continue;
        seg.style.flexGrow = String(Math.max(0, bytes));
        seg.hidden = !avail || bytes <= 0;
        seg.setAttribute('aria-label', `${label}, ${fmtBytes(bytes)} — manage`);
        seg.title = `${label} — ${fmtBytes(bytes)}`;
      }
      const otherSeg = bar?.querySelector<HTMLElement>('.seg--other');
      if (otherSeg) { otherSeg.style.flexGrow = String(m.other); otherSeg.hidden = !(m.hasEstimate && !m.overshoot && m.other > 0); }

      setText('[data-size="sessions"]', fmtBytes(m.sessions.bytes));
      setText('[data-size="images"]', fmtBytes(m.images.bytes));
      setText('[data-size="cache"]', fmtBytes(m.cache.bytes));
      setText('[data-size="previews"]', fmtBytes(m.previews.bytes));
      setText('[data-size="other"]', `~${fmtBytes(m.other)}`);
      setText('[data-count="sessions"]', String(m.sessions.count));
      setText('[data-size-hint="sessions"]', fmtBytes(m.sessions.bytes));
      setText('[data-size-label="cache"]', fmtBytes(m.cache.bytes));
      setText('[data-size-label="previews"]', fmtBytes(m.previews.bytes));
      const imgCount = body.querySelector<HTMLElement>('#userimg-count');
      const imgSize = body.querySelector<HTMLElement>('#userimg-size');
      if (imgCount) imgCount.textContent = `${m.images.count}/${MAX_USER_ASSETS}`;
      if (imgSize) imgSize.textContent = fmtBytes(m.images.bytes);

      const quotaRow = body.querySelector<HTMLElement>('#store-quota');
      const fill = body.querySelector<HTMLElement>('#store-quota-fill');
      const quotaText = body.querySelector<HTMLElement>('#store-quota-text');
      if (m.hasEstimate && m.quota) {
        if (fill) fill.style.width = `${Math.min(100, (m.usage / m.quota) * 100)}%`;
        if (quotaText) quotaText.innerHTML = `${fmtBytes(m.usage)} of ${fmtBytes(m.quota)} device budget · <strong>${fmtPct(m.usage, m.quota)}</strong> used`;
        if (quotaRow) quotaRow.hidden = false;
      } else if (quotaRow) quotaRow.hidden = true;

      const note = body.querySelector<HTMLElement>('#store-footnote');
      if (note) {
        if (!m.hasEstimate) { note.textContent = 'Device total unavailable — showing measured items only.'; note.hidden = false; }
        else if (m.overshoot) { note.textContent = "Measured items meet or exceed the browser's estimate (estimates are approximate)."; note.hidden = false; }
        else note.hidden = true;
      }
      const aria = body.querySelector<HTMLElement>('#store-aria-sentence');
      if (aria) aria.textContent = reconciliationSentence(m);
      updateReclaim(m);
    }

    // Explore: a legend chip / bar segment isolates its slice and opens + scrolls to
    // that category's manage panel. Re-clicking the active one clears the highlight.
    function exploreCategory(cat: string) {
      const next = bar?.getAttribute('data-active') === cat ? '' : cat;
      if (bar) {
        if (next) bar.setAttribute('data-active', next); else bar.removeAttribute('data-active');
        bar.querySelectorAll<HTMLElement>('.seg').forEach(s => s.classList.toggle('is-active', !!next && s.dataset.cat === next));
      }
      body.querySelectorAll<HTMLElement>('.store-chip').forEach(c => c.classList.toggle('is-active', !!next && c.dataset.cat === next));
      if (!next) return;
      const panel = body.querySelector<HTMLElement>(`.store-manage[data-cat="${cat}"]`);
      if (panel) {
        if (panel.tagName === 'DETAILS') (panel as HTMLDetailsElement).open = true;
        panel.scrollIntoView({ block: 'start', behavior: reduceMotion() ? 'auto' : 'smooth' });
      }
    }

    const ensureSessEmptyState = () => {
      const list = body.querySelector<HTMLElement>('#store-sess-list');
      if (list && !list.querySelector('.store-sess')) list.innerHTML = `<li class="storage-empty">No saved sessions yet.</li>`;
    };
    function syncSelbar() {
      const checked = [...body.querySelectorAll<HTMLInputElement>('.store-sess-check:checked')];
      if (selbar) {
        selbar.hidden = checked.length === 0;
        let bytes = 0; checked.forEach(c => bytes += model.sessions.sizes[c.dataset.slot ?? ''] || 0);
        const cnt = selbar.querySelector<HTMLElement>('.store-selbar-count');
        if (cnt) cnt.textContent = `${checked.length} selected · ${fmtBytes(bytes)}`;
      }
      // Reserve space so the fixed bar never covers the section's bottom controls (mobile).
      body.querySelector('.store-meter')?.classList.toggle('has-selbar', checked.length > 0);
      const all = body.querySelector<HTMLInputElement>('#sess-selall');
      const boxes = [...body.querySelectorAll<HTMLInputElement>('.store-sess-check')];
      if (all) all.checked = boxes.length > 0 && checked.length === boxes.length;
      updateReclaim(model);
    }

    async function refreshMeter() { model = await measure(); applyMeter(model); }

    // The confirm modal restores focus to the (now-removed) delete control on close, so
    // after a deletion move focus to a surviving control — else keyboard/SR users drop to
    // <body> and have to re-traverse the page.
    function focusSurvivingSession(preferred?: HTMLElement | null) {
      const t = (preferred && document.contains(preferred) && preferred)
        || body.querySelector<HTMLElement>('.store-sess-del')
        || body.querySelector<HTMLElement>('.store-sort')
        || body.querySelector<HTMLElement>('.store-manage[data-cat="sessions"] > summary');
      t?.focus?.();
    }

    async function deleteOneSession(slot: string, btn: HTMLButtonElement) {
      const bytes = model.sessions.sizes[slot] || 0;
      const row = [...body.querySelectorAll<HTMLElement>('.store-sess')].find(r => r.dataset.slot === slot);
      const label = row?.querySelector<HTMLElement>('.store-sess-label')?.textContent || 'this session';
      const ok = await confirmDialog({
        title: 'Delete this session?',
        message: `"${label}" will be permanently removed from this device${bytes ? `, freeing about ${fmtBytes(bytes)}` : ''}. This cannot be undone.`,
        confirmLabel: 'Delete',
      });
      if (!ok) return;
      // The next/previous row's delete button is the natural landing spot post-removal.
      const nextFocus = (row?.nextElementSibling || row?.previousElementSibling)?.querySelector<HTMLElement>('.store-sess-del');
      btn.disabled = true;
      try { await host.state.delete(slot); }
      catch (err) { host.log?.('error', 'Session delete failed', { slot, error: String(err) }); btn.disabled = false; return; }
      row?.remove();
      ensureSessEmptyState();
      syncSelbar();
      focusSurvivingSession(nextFocus);
      await refreshMeter();
      announce(`Freed ${fmtBytes(bytes)} — ${fmtBytes(model.hasEstimate ? model.total : model.measured)} used`);
    }

    async function deleteSelectedSessions(btn: HTMLButtonElement) {
      const checked = [...body.querySelectorAll<HTMLInputElement>('.store-sess-check:checked')];
      if (!checked.length) return;
      const slots = checked.map(c => c.dataset.slot ?? '');
      let bytes = 0; slots.forEach(s => bytes += model.sessions.sizes[s] || 0);
      const ok = await confirmDialog({
        title: `Delete ${slots.length} saved session${slots.length === 1 ? '' : 's'}?`,
        message: `This permanently removes ${slots.length === 1 ? 'it' : 'them'} from this device, freeing about ${fmtBytes(bytes)}. This cannot be undone.`,
        confirmLabel: `Delete ${slots.length}`,
      });
      if (!ok) return;
      const prev = btn.textContent; btn.disabled = true; btn.textContent = 'Deleting…';
      // Only splice a row once its delete actually resolves — otherwise a rejected
      // delete leaves a ghost (row gone, but the session still counted by refreshMeter
      // and resurrected on the next sort). Freed bytes are summed from real successes.
      let freed = 0, done = 0;
      for (const slot of slots) {
        try { await host.state.delete(slot); }
        catch (err) { host.log?.('error', 'Session delete failed', { slot, error: String(err) }); continue; }
        freed += model.sessions.sizes[slot] || 0; done++;
        [...body.querySelectorAll<HTMLElement>('.store-sess')].find(r => r.dataset.slot === slot)?.remove();
      }
      btn.textContent = prev; btn.disabled = false;
      ensureSessEmptyState();
      syncSelbar();
      focusSurvivingSession();
      await refreshMeter();
      announce(done === slots.length
        ? `Deleted ${done} session${done === 1 ? '' : 's'} — freed ${fmtBytes(freed)}`
        : `Deleted ${done} of ${slots.length} — freed ${fmtBytes(freed)}; some could not be removed`);
    }

    function toggleSort(btn: HTMLButtonElement) {
      sessSort = sessSort === 'size' ? 'recent' : 'size';
      btn.dataset.sort = sessSort;
      btn.textContent = sessSort === 'recent' ? 'Recent ▾' : 'Largest first ▾';
      const checked = new Set([...body.querySelectorAll<HTMLInputElement>('.store-sess-check:checked')].map(c => c.dataset.slot));
      const list = body.querySelector<HTMLElement>('#store-sess-list');
      if (list) list.innerHTML = sessionRowsHtml(model, sessSort);
      checked.forEach(slot => {
        const box = [...body.querySelectorAll<HTMLInputElement>('.store-sess-check')].find(c => c.dataset.slot === slot);
        if (box) box.checked = true;
      });
      syncSelbar();
    }

    async function clearRegenerable(btn: HTMLButtonElement, fn: () => Promise<void> | undefined, doneMsg: string) {
      const prev = btn.textContent; btn.disabled = true; btn.textContent = 'Clearing…';
      try { await fn(); } catch (err) { host.log?.('error', doneMsg, { error: String(err) }); }
      btn.textContent = 'Cleared';
      setTimeout(() => { btn.textContent = prev; btn.disabled = false; }, 1500);
      await refreshMeter();
      announce(doneMsg);
    }

    // ── one delegated click listener (explore / clear / sort / multi-select bar) ──
    body.addEventListener('click', async (e) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      const explore = target.closest<HTMLElement>('.store-chip[data-cat], .seg[data-cat]');
      if (explore && explore.dataset.cat !== 'other' && explore.dataset.cat) { exploreCategory(explore.dataset.cat); return; }

      const del = target.closest<HTMLButtonElement>('[data-del-session]');
      if (del?.dataset.delSession) { await deleteOneSession(del.dataset.delSession, del); return; }

      const sortBtn = target.closest<HTMLButtonElement>('.store-sort');
      if (sortBtn) { toggleSort(sortBtn); return; }

      const cacheBtn = target.closest('#clear-cache-btn');
      if (cacheBtn instanceof HTMLButtonElement) { await clearRegenerable(cacheBtn, () => clearIdbStores(['asset-blob', 'asset-meta']), 'Cleared asset cache'); return; }

      const prevBtn = target.closest('#clear-previews-btn');
      if (prevBtn instanceof HTMLButtonElement) { await clearRegenerable(prevBtn, () => host.previews?.clear(), 'Cleared tool previews'); return; }

      if (target.closest('.store-selbar-clear')) { body.querySelectorAll<HTMLInputElement>('.store-sess-check').forEach(c => { c.checked = false; }); syncSelbar(); return; }
      const selDel = target.closest<HTMLButtonElement>('.store-selbar-del');
      if (selDel) { await deleteSelectedSessions(selDel); return; }
    });

    // selection checkboxes (incl. select-all) update the floating action bar.
    body.addEventListener('change', (e) => {
      const target = e.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (target.matches('.store-sess-check')) { syncSelbar(); }
      else if (target.matches('#sess-selall')) {
        const on = target.checked;
        body.querySelectorAll<HTMLInputElement>('.store-sess-check').forEach(c => { c.checked = on; });
        syncSelbar();
      }
    });

    // ── My images — same add/delete/lightbox handlers as before (grid reused). ──
    const userimgAddBtn = body.querySelector<HTMLButtonElement>('#userimg-add');
    async function syncUserImgMeta() {
      const list = await host.assets._listUserAssets().catch(() => []);
      const count = list.filter(a => a.id !== HEADSHOT_ID).length;
      if (userimgAddBtn) userimgAddBtn.hidden = count >= MAX_USER_ASSETS;
      await refreshMeter(); // re-measures → applyMeter refreshes the count/size badges + legend + bar
    }
    const userimgFile = body.querySelector<HTMLInputElement>('#userimg-file');
    userimgAddBtn?.addEventListener('click', () => userimgFile?.click());
    userimgFile?.addEventListener('change', async () => {
      const files = [...(userimgFile.files ?? [])];
      userimgFile.value = '';
      if (!files.length) return;
      if (userimgAddBtn) userimgAddBtn.disabled = true;
      const imgErr = body.querySelector<HTMLElement>('#userimg-error');
      if (imgErr) imgErr.hidden = true;
      for (const file of files) {
        try {
          const ref = await storeUserUpload(host, file);
          userImages.unshift(ref);
          body.querySelector('#userimg-grid')?.insertAdjacentHTML('afterbegin', userImageThumb(ref));
        } catch (err) {
          host.log?.('error', 'Image upload failed', { name: file.name, error: String(err) });
          const msg = String(err instanceof Error ? err.message : err);
          if (imgErr) { imgErr.textContent = msg; imgErr.hidden = false; }
          announce(msg, { assertive: true });
          break;
        }
      }
      if (userimgAddBtn) userimgAddBtn.disabled = false;
      await syncUserImgMeta();
    });
    body.querySelector('#userimg-grid')?.addEventListener('click', async e => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      const view = target.closest<HTMLElement>('[data-view-userimg]');
      if (view) {
        const ref = userImages.find(a => a.id === view.dataset.viewUserimg);
        if (ref) openImageLightbox(ref);
        return;
      }
      const btn = target.closest<HTMLButtonElement>('[data-delete-userimg]');
      if (!btn?.dataset.deleteUserimg) return;
      const id = btn.dataset.deleteUserimg;
      btn.disabled = true;
      try { await host.assets._deleteUserAsset(id); }
      catch (err) { host.log?.('error', 'Failed to delete image', { id, error: String(err) }); btn.disabled = false; return; }
      btn.closest('[data-userimg]')?.remove();
      const i = userImages.findIndex(a => a.id === id);
      if (i !== -1) userImages.splice(i, 1);
      await syncUserImgMeta();
    });

    applyMeter(model);
    refreshMeterFn = refreshMeter;

    // Clear all — confirmation dialog gated on typing a randomised word, so an
    // irreversible wipe can't be fired by reflex (or a stray double-click).
    viewEl.querySelector('#clear-storage-btn')?.addEventListener('click', () => {
      const word = CLEAR_CONFIRM_WORDS[Math.floor(Math.random() * CLEAR_CONFIRM_WORDS.length)] ?? CLEAR_CONFIRM_WORDS[0];
      const overlay = document.createElement('div');
      overlay.className = 'clear-dialog-overlay';
      overlay.innerHTML = `
        <div class="clear-dialog" role="dialog" aria-modal="true" aria-labelledby="clear-dialog-title">
          <h3 id="clear-dialog-title">Clear all my data?</h3>
          <p>This removes your profile, all saved sessions, your uploaded images, and the asset cache. Cannot be undone.</p>
          <label class="clear-confirm">
            <span class="clear-confirm-prompt">Type <strong>${word}</strong> to confirm</span>
            <input type="text" class="clear-confirm-input" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Type ${word} to confirm">
          </label>
          <div class="clear-dialog-actions">
            <button class="btn btn-danger" data-scope="all" disabled>Clear everything</button>
            <button class="btn" data-scope="cancel">Cancel</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      // Escape-to-dismiss + focus-restore, mirroring openImageLightbox. (A full
      // Tab focus-trap is deferred — see followups.)
      const opener = document.activeElement;
      const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); dismiss(); } };
      const dismiss = () => {
        document.removeEventListener('keydown', onKey);
        overlay.remove();
        if (opener instanceof HTMLElement) opener.focus();
      };
      document.addEventListener('keydown', onKey);

      const confirmInput = overlay.querySelector<HTMLInputElement>('.clear-confirm-input');
      const clearBtn = overlay.querySelector<HTMLButtonElement>('[data-scope="all"]');
      const matches = () => confirmInput?.value.trim().toLowerCase() === word;
      confirmInput?.addEventListener('input', () => { if (clearBtn) clearBtn.disabled = !matches(); });
      confirmInput?.addEventListener('keydown', e => { if (e.key === 'Enter' && matches()) { e.preventDefault(); clearBtn?.click(); } });
      confirmInput?.focus();

      overlay.addEventListener('click', async e => {
        const target = e.target;
        if (!(target instanceof Element)) return;
        const scope = target.closest<HTMLElement>('[data-scope]')?.dataset.scope;
        if (!scope || scope === 'cancel') { dismiss(); return; }
        if (scope === 'all' && !matches()) return; // guard: the word must match

        const btns = overlay.querySelectorAll<HTMLButtonElement>('button');
        btns.forEach(b => (b.disabled = true));
        if (clearBtn) clearBtn.textContent = 'Clearing…';

        localStorage.clear();
        sessionStorage.clear();
        await clearIdbStores(['state', 'profile', 'user-assets', 'asset-blob', 'asset-meta']);
        host.profile.bust();
        applyTheme('light');
        document.removeEventListener('keydown', onKey);
        overlay.remove();
        await opts.remount();
      });
    });

    wireDataTransfer(viewEl, host, { remount: opts.remount });
  }
  storageDetails?.addEventListener('toggle', () => { if (storageDetails.open) loadStorage(); });
  // A persisted-open section renders open from the HTML `open` attribute, which does
  // NOT fire `toggle`, so kick the lazy load here (runs after first paint).
  if (storageDetails?.open) loadStorage();

  return { refresh: async () => { if (refreshMeterFn) await refreshMeterFn(); } };
}
