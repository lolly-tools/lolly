// SPDX-License-Identifier: MPL-2.0
/**
 * Desktop-only first-run "get the on-device AI models" sheet.
 *
 * The desktop shell ships a SMALL bundle: the ~1.7 GB of on-device ML models
 * (background removal, upscaling, OCR, TTS, …) are NOT embedded - they are
 * fetched on demand from the model host (VITE_MODELS_BASE = https://lolli.li,
 * see lib/models-base.ts). So the very first thing a fresh desktop install
 * should offer is: pull the heavy image models down once, up front, so
 * background removal and upscaling work instantly (and offline) rather than
 * stalling on a multi-hundred-MB download the first time they're opened.
 *
 * Built on mountModal (components/modal.ts - Escape/backdrop dismissal, focus
 * containment, teardown), mirroring components/welcome-dialog.ts. Gated exactly
 * like the instance sheet: Tauri shells only, first run only (a localStorage
 * flag, same tier as the theme/welcome flags), and a no-op once the models are
 * already on device. It NEVER shows in the web PWA or a headless CLI render.
 *
 * The download reuses the Profile "Available offline" plumbing:
 * beginOfflineRun (lib/offline-run.ts) drives the SAME candy-striped job toast
 * background removal uses, and the per-model downloaders (downloadMatte /
 * downloadUpscale / downloadOcr) cache into the IndexedDB stores the runtime
 * reads - so a completed run means the tools are genuinely ready offline. Only
 * these three (the cache-aligned image models) are pre-fetched here; voice, text
 * and the durable-credential encoder download on first use, and everything stays
 * reachable from Profile → "Available offline" (the durable model has its own part
 * there since plans/202 WP4.2 - it is an export option, not one of the three tools
 * this sheet is about, so it deliberately stays off this first-run list). The run
 * outlives this sheet, so closing it mid-download hands off to the global toast
 * cleanly.
 */
import '../styles/parts/models-welcome.css';
import { t } from '../i18n.ts';
import { escape } from '../utils.ts';
import { icon } from '../lib/icons.ts';
import { mountModal, type ModalHandle } from './modal.ts';
import { isTauriShell } from '../lib/instance-choice.ts';
import { beginOfflineRun } from '../lib/offline-run.ts';
import {
  downloadMatte, downloadUpscale, downloadOcr, fetchPrecacheManifest, type DownloadProgress,
} from '../lib/offline-manager.ts';
import { matteCacheBytes, upscaleCacheBytes, ocrCacheBytes } from '../lib/model-prefetch.ts';
import { fmtBytes } from '../lib/format.ts';

/** Persisted (localStorage, same tier as the theme/welcome flags) once the sheet
 *  has been shown once - first use only, per Andy. */
const SEEN_KEY = 'lolly-desktop-models-welcome-seen';

/** Rough size shown if the precache manifest can't be read (e.g. offline first
 *  boot): matte-lite + upscale + ocr. The label is a "~" estimate either way. */
const FALLBACK_MODEL_BYTES = 590 * 1024 * 1024;

function seen(): boolean {
  try { return localStorage.getItem(SEEN_KEY) === '1'; } catch { return true; }
}
function markSeen(): void {
  try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* storage off - just won't persist */ }
}

/** Are the pre-downloadable image models already on this device (a prior run, or
 *  fetched on demand)? Then there's nothing to offer - settle the flag and skip. */
async function modelsPresent(): Promise<boolean> {
  try {
    const [m, u, o] = await Promise.all([matteCacheBytes(), upscaleCacheBytes(), ocrCacheBytes()]);
    return m.bytes > 0 || u.bytes > 0 || o.bytes > 0;
  } catch { return false; }
}

/** Total download size for the image models, from the precache manifest's size
 *  metadata (groups.matte/upscale/ocr). Falls back to a constant when unread. */
async function estimateBytes(): Promise<number> {
  try {
    const man = await fetchPrecacheManifest();
    if (!man) return FALLBACK_MODEL_BYTES;
    const sum = (files?: readonly { size: number }[]): number => (files ?? []).reduce((n, f) => n + f.size, 0);
    const total = sum(man.groups.matte) + sum(man.groups.upscale) + sum(man.groups.ocr);
    return total > 0 ? total : FALLBACK_MODEL_BYTES;
  } catch { return FALLBACK_MODEL_BYTES; }
}

let shown = false;

/**
 * Show the desktop first-run models sheet, or do nothing. Call once from boot.
 * Awaitable, but a no-op (a couple of IndexedDB reads) everywhere it shouldn't
 * show, so awaiting it never blocks the web/CLI paths.
 */
export async function maybeShowModelsWelcome(): Promise<void> {
  if (!isTauriShell()) return;                                          // desktop shell only
  if ((window as { __LOLLY_CLI__?: unknown }).__LOLLY_CLI__) return;    // headless render - no human
  if (shown || seen()) return;
  if (await modelsPresent()) { markSeen(); return; }                   // already have them
  shown = true;
  await showModelsWelcome();
}

function renderContent(sizeLabel: string): string {
  return `
    <span class="mw-icon">${icon('download', { size: 30 })}</span>
    <p class="mw-eyebrow">${t('Lolly for desktop')}</p>
    <h2 class="mw-title">${t('Unlock the on-device AI tools')}</h2>
    <p class="mw-sub">${t('Background removal, AI upscaling and text recognition run entirely on your machine - no cloud, nothing leaves the device. Download the models once and they work offline.')}</p>
    <div class="mw-actions">
      <button type="button" class="btn btn--primary mw-download" data-act="download">
        ${icon('download', { size: 18 })} ${t('Download AI models')} <span class="mw-size">· ~${escape(sizeLabel)}</span>
      </button>
      <button type="button" class="mw-later" data-act="later">${t('Maybe later')}</button>
    </div>
    <div class="mw-progress" hidden>
      <div class="mw-progress-label"><span class="mw-progress-part"></span><span class="mw-progress-pct"></span></div>
      <span class="job-bar"><span class="job-bar-fill" style="width:0%"></span></span>
    </div>
    <div class="mw-done" data-done hidden>${icon('circleCheck', { size: 20 })} <span>${t('All set - the AI tools are ready.')}</span></div>
    <p class="mw-note">${t('You can manage these any time from your Profile, under “Available offline”. Voice and other models download automatically the first time you use them.')}</p>`;
}

async function showModelsWelcome(): Promise<void> {
  const sizeLabel = fmtBytes(await estimateBytes());
  const modal = mountModal<void>(renderContent(sizeLabel), {
    className: 'models-welcome',
    ariaLabel: t('Get the on-device AI tools'),
    initialFocus: (el) => el.querySelector<HTMLElement>('.mw-download'),
    // Any close counts as first-use handled - dismissing, downloading, or Escape.
    // If a download is in flight it continues in the global job toast (the run
    // outlives this sheet), so closing here never cancels it.
    onClose: () => { markSeen(); },
  });
  wire(modal);
}

function wire(modal: ModalHandle<void>): void {
  const el = modal.el;
  const actions = el.querySelector<HTMLElement>('.mw-actions')!;
  const progress = el.querySelector<HTMLElement>('.mw-progress')!;
  const fill = el.querySelector<HTMLElement>('.job-bar-fill')!;
  const partEl = el.querySelector<HTMLElement>('.mw-progress-part')!;
  const pctEl = el.querySelector<HTMLElement>('.mw-progress-pct')!;
  const doneEl = el.querySelector<HTMLElement>('[data-done]')!;

  el.addEventListener('click', (e) => {
    const target = e.target instanceof Element ? e.target : null;
    if (target?.closest('[data-act="later"]')) { modal.close(); return; }
    if (target?.closest('[data-act="download"]')) void startDownload();
  });

  async function startDownload(): Promise<void> {
    markSeen();
    actions.hidden = true;
    progress.hidden = false;

    const run = beginOfflineRun(t('Downloading AI models'));
    if (!run) { modal.close(); return; } // a run is already live (e.g. from Profile)

    const parts: { label: string; fn: (o: { signal: AbortSignal; onProgress: (p: DownloadProgress) => void }) => Promise<unknown> }[] = [
      { label: t('Background removal'), fn: (o) => downloadMatte(o) },
      { label: t('AI upscaling'), fn: (o) => downloadUpscale(o) },
      { label: t('Text recognition'), fn: (o) => downloadOcr(o) },
    ];

    try {
      for (const p of parts) {
        partEl.textContent = p.label;
        await p.fn({
          signal: run.signal,
          onProgress: (pr) => {
            const frac = pr.total ? Math.min(1, pr.loaded / pr.total) : 0;
            fill.style.width = `${Math.round(frac * 100)}%`;
            pctEl.textContent = pr.total ? `${Math.round(frac * 100)}%` : '…';
            run.report({ label: p.label, loaded: pr.loaded, total: pr.total, unit: 'bytes' });
          },
        });
      }
      run.end();
      fill.style.width = '100%';
      pctEl.textContent = '100%';
      progress.hidden = true;
      doneEl.hidden = false;
      setTimeout(() => modal.close(), 1800);
    } catch (err) {
      run.end(String(err));
      if (run.cancelled) { modal.close(); return; } // user cancelled via the toast
      // Let them retry: restore the button, surface the failure in the label.
      progress.hidden = true;
      actions.hidden = false;
      partEl.textContent = '';
    }
  }
}
