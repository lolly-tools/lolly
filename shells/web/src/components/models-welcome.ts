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
 * background removal uses, and lib/model-parts.ts supplies the sizes, what the
 * model host serves, and the per-part downloader, which caches into the IndexedDB
 * stores the runtime reads - so a completed run means the tools are genuinely
 * ready offline. Only
 * these three (the cache-aligned image models) are pre-fetched here, and only the
 * ones the model host serves; the others are offered in place when a feature first
 * needs them (lib/model-offer.ts), and everything stays
 * reachable from Profile → "Available offline" (the durable model has its own part
 * there since plans/202 WP4.2 - it is an export option, not one of the three tools
 * this sheet is about, so it deliberately stays off this first-run list). The run
 * outlives this sheet, so closing it mid-download hands off to the global toast
 * cleanly.
 */
import '../styles/parts/models-welcome.css';
import { currentLang, t, tRaw } from '../i18n.ts';
import { escape } from '../utils.ts';
import { icon } from '../lib/icons.ts';
import { mountModal, type ModalHandle } from './modal.ts';
import { isTauriShell } from '../lib/instance-choice.ts';
import { beginOfflineRun } from '../lib/offline-run.ts';
import type { DownloadProgress } from '../lib/offline-manager.ts';
import { downloadModelPart, modelPartsInfo, modelPrecache, type ModelPartInfo } from '../lib/model-parts.ts';
import { fmtBytes } from '../lib/format.ts';

/** Persisted (localStorage, same tier as the theme/welcome flags) once the sheet
 *  has been shown once - first use only, per Andy. */
const SEEN_KEY = 'lolly-desktop-models-welcome-seen';

/** The three image models this sheet offers, in download order. */
const WELCOME_PARTS = ['matte', 'upscale', 'ocr'] as const;

function seen(): boolean {
  try { return localStorage.getItem(SEEN_KEY) === '1'; } catch { return true; }
}
function markSeen(): void {
  try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* storage off - just won't persist */ }
}

/** The image models as lib/model-parts.ts sees them: served by the model host,
 *  allowed by the AI policy, and whether each is on this device already. The same
 *  facts and sizes Profile's Available offline rows show. */
async function welcomeParts(): Promise<ModelPartInfo[]> {
  try { return await modelPartsInfo(WELCOME_PARTS); } catch { return []; }
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
  const parts = await welcomeParts();
  if (parts.some(p => p.ready === true)) { markSeen(); return; }       // already have them
  const offered = parts.filter(p => p.available && p.allowed);
  if (!offered.length) return;                                         // nothing this host can serve: ask again next launch
  shown = true;
  await showModelsWelcome(offered);
}

/** The offered parts' names as one list in the interface language. */
function listNames(offered: readonly ModelPartInfo[]): string {
  const names = offered.map(p => p.label);
  try {
    return new Intl.ListFormat(currentLang(), { style: 'long', type: 'conjunction' }).format(names);
  } catch {
    return names.join(', ');
  }
}

/** The body line, naming only what this host offers. */
export function welcomeSentence(offered: readonly ModelPartInfo[]): string {
  const names = listNames(offered);
  return offered.length === 1
    ? tRaw('{names} runs on this device. Download it once and it works offline.', { names })
    : tRaw('{names} run on this device. Download them once and they work offline.', { names });
}

function renderContent(sizeLabel: string | null, offered: readonly ModelPartInfo[]): string {
  return `
    <span class="mw-icon">${icon('download', { size: 30 })}</span>
    <p class="mw-eyebrow">${t('Lolly for desktop')}</p>
    <h2 class="mw-title">${t('Unlock the on-device AI tools')}</h2>
    <p class="mw-sub">${escape(welcomeSentence(offered))}</p>
    <div class="mw-actions">
      <button type="button" class="btn btn--primary mw-download" data-act="download">
        ${icon('download', { size: 18 })} ${t('Download AI models')}${sizeLabel ? ` <span class="mw-size">· ${escape(sizeLabel)}</span>` : ''}
      </button>
      <button type="button" class="mw-later" data-act="later">${t('Not now')}</button>
    </div>
    <div class="mw-progress" hidden>
      <div class="mw-progress-label"><span class="mw-progress-part"></span><span class="mw-progress-pct"></span></div>
      <span class="job-bar"><span class="job-bar-fill" style="width:0%"></span></span>
    </div>
    <div class="mw-done" data-done hidden>${icon('circleCheck', { size: 20 })} <span>${t('All set. The AI tools are ready.')}</span></div>
    <p class="mw-note">${t('You can manage these in Profile under Available offline. Other models are offered when a feature first needs them.')}</p>`;
}

async function showModelsWelcome(offered: ModelPartInfo[]): Promise<void> {
  // A size prints only when every offered part's size is known.
  const total = offered.reduce((n, p) => n + (p.bytes ?? 0), 0);
  const sizeLabel = total > 0 && offered.every(p => p.bytes) ? fmtBytes(total) : null;
  const modal = mountModal<void>(renderContent(sizeLabel, offered), {
    className: 'models-welcome',
    ariaLabel: t('Get the on-device AI tools'),
    initialFocus: (el) => el.querySelector<HTMLElement>('.mw-download'),
    // Any close counts as first-use handled - dismissing, downloading, or Escape.
    // If a download is in flight it continues in the global job toast (the run
    // outlives this sheet), so closing here never cancels it.
    onClose: () => { markSeen(); },
  });
  wire(modal, offered);
}

function wire(modal: ModalHandle<void>, offered: readonly ModelPartInfo[]): void {
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

    const precache = await modelPrecache().catch(() => null);
    const parts: { label: string; fn: (o: { signal: AbortSignal; onProgress: (p: DownloadProgress) => void }) => Promise<unknown> }[] =
      offered.map(p => ({ label: p.label, fn: (o) => downloadModelPart(p.id, precache, o) }));

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
