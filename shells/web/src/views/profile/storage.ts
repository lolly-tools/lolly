// SPDX-License-Identifier: MPL-2.0
/**
 * profile: the Storage card - measuring every slice, the session and image lists, export, import and clear.
 *
 * Every function takes the shared `pv: ProfileViewCtx` first (see context.ts). Sibling
 * calls in this file are direct; a call into another module, and every use of a
 * function as a value (an event listener), goes through `pv.<module>.<fn>`. Extracted verbatim
 * from mountProfile() by scripts/split-closure.ts.
 */
import type { AssetRef } from '@lolly-tools/core/host-v1';
import { applyTheme } from '../../theme.ts';
import { prefersReducedMotion } from '../../lib/a11y-prefs.ts';
import { t, tRaw } from '../../i18n.ts';
import { staggerReveal } from '../../lib/reveal.ts';
import { isHiddenSlot } from '../../lib/batch-slots.ts';
import { mountModal } from '../../components/modal.ts';
import { startBatchExport } from '../../lib/batch-job.ts';
import { escape as escapeText } from '../../utils.ts';
import { announce } from '../../a11y.ts';
import { storeUserUpload } from '../picker.ts';
import { saveBlob } from '../../pro/zip.ts';
import { exportBackup } from '../../data-transfer.ts';
import { backupHistoryNote } from '../../lib/backup-summary.ts';
import { measureFileHistory } from '../../lib/file-history-storage.ts';
import { pinnedToolBytes, unpinAll } from '../../lib/offline-pins.ts';
import { aiDetectCacheBytes, clearAiDetectCaches, removePart, rewordCacheBytes, speechCacheBytes } from '../../lib/offline-manager.ts';
import { durableCacheBytes, matteCacheBytes, ocrCacheBytes, upscaleCacheBytes } from '../../lib/model-prefetch.ts';
import { createTrash, trashHostOf } from '../../lib/trash.ts';
import { openTrashDialog, showTrashUndoToast } from '../../components/trash-dialog.ts';
import { clearAllLollyData, sealWebStorageUntilReload } from '../../lib/clear-all-data.ts';
import { isTauriShell } from '../../lib/instance-choice.ts';
import { fmtBytes } from '../../folder-tiles.ts';
import { openImageLightbox, userImageThumb } from '../profile-user-images.ts';
import { fmtPct, reconciliationSentence, sessionRowsHtml } from '../profile-storage-model.ts';
import type { PreviewsMeasure, SessionEntry, StorageModel } from '../profile-storage-model.ts';
import { CLEAR_CONFIRM_WORDS, COLLAPSE_CHEV, HEADSHOT_ID, HOARD_CONFIRM_WORDS, clearIdbStores, infoDot, openProfileModals } from './shared.ts';

/** The Trash over this view's host (lib/trash.ts): Storage deletes go there too. */
const trashFor = (pv: ProfileViewCtx) => createTrash(trashHostOf(pv.host));
import { bindOp, type ProfileViewCtx } from './context.ts';

export async function refreshCounter(pv: ProfileViewCtx) { if (pv.refreshStorageMeter) await pv.refreshStorageMeter(); }
export const toolNameOf = (pv: ProfileViewCtx, id: string) => { const { toolNameById } = pv; return toolNameById.get(id) || id || t('Saved session'); };
// Honours the in-app Reduce motion pref as well as the OS one (lib/a11y-prefs.ts),
// so the counter roll-up and the smooth panel scroll below calm down for a user
// whose device never advertised a motion preference.
export const reduceMotion = (_pv: ProfileViewCtx) => prefersReducedMotion();
// Tool-previews cache: measurable (size()/list()) + clearable. Feature-detected so
// an older/rebuilt bridge without host.previews just folds its bytes into "Other".
export async function measurePreviews(pv: ProfileViewCtx): Promise<PreviewsMeasure> {
  const { host } = pv;
  if (!host.previews?.list) return { bytes: 0, count: 0, available: false };
  try {
    const list = await host.previews.list();
    const bytes = typeof host.previews.size === 'function'
      ? await host.previews.size()
      : list.reduce((n, r) => n + (r?.thumb ? r.thumb.length : 0), 0);
    return { bytes, count: list.length, available: true };
  } catch { return { bytes: 0, count: 0, available: false }; }
}
// Read every measurer + the browser's ground-truth estimate into one model. The
// four measured slices never sum to estimate().usage - the remainder is labelled
// "Other" = max(0, usage − measured), so measured + Other == usage by construction.
export async function measure(pv: ProfileViewCtx): Promise<StorageModel> {
  const { host } = pv;
  const estP = navigator.storage?.estimate
    ? navigator.storage.estimate().catch(() => null)
    : Promise.resolve(null);
  const [estimate, sessions, sessionSizes, blobCacheBytes, allImages, imagesBytes, previews, pins, speech, upscale, matte, ocr, reword, aiDetect, durable, fileHistory] = await Promise.all([
    estP,
    host.state.list().catch((): SessionEntry[] => []),
    host.state.sizes!().catch((): Record<string, number> => ({})),
    host.assets._blobCacheSize!().catch(() => 0),
    host.assets._listUserAssets!().catch((): AssetRef[] => []),
    host.assets._userAssetsSize!().catch(() => 0),
    measurePreviews(pv),
    pinnedToolBytes().catch(() => ({ bytes: 0, count: 0 })),
    speechCacheBytes().catch(() => ({ bytes: 0, files: 0 })),
    upscaleCacheBytes().catch(() => ({ bytes: 0, files: 0 })),
    matteCacheBytes().catch(() => ({ bytes: 0, files: 0 })),
    ocrCacheBytes().catch(() => ({ bytes: 0, files: 0 })),
    rewordCacheBytes().catch(() => ({ bytes: 0, files: 0 })),
    aiDetectCacheBytes().catch(() => ({ bytes: 0, files: 0 })),
    durableCacheBytes().catch(() => ({ bytes: 0, files: 0 })),
    measureFileHistory().catch(() => ({ bytes: 0 })),
  ]);
  // What the Trash holds (plan 277 P3). Its bytes stay inside the Saved sessions
  // and My images slices below, so the meter still adds up; the Trash row names
  // them so the person knows Empty Trash is what frees them.
  const trash = await (async () => {
    const tr = trashFor(pv);
    const entries = await tr.list();
    return { count: entries.length, bytes: await tr.bytes(entries) };
  })().catch(() => ({ count: 0, bytes: 0 }));
  // The list and its count are the person's own sessions: the Trash, templates,
  // export shapes and design-system records are not rows to delete here. Their
  // bytes still count in the slice.
  const ownSessions = sessions.filter(s => !isHiddenSlot(s.slot));
  const sessBytes = Object.values(sessionSizes).reduce((s, n) => s + n, 0);
  const cacheBytes = blobCacheBytes;
  // The grid shows visual uploads only: the headshot is hidden, and the non-visual
  // user assets (brand tokens doc, font faces - managed in the Adjust your brand card)
  // would render as broken tiles. Their bytes stay in the slice either way.
  const VISUAL = new Set(['raster', 'vector', 'video', 'lottie']);
  const imageList = allImages.filter(a => a.id !== HEADSHOT_ID && VISUAL.has(a.type));
  const measured = sessBytes + imagesBytes + cacheBytes + previews.bytes + pins.bytes + speech.bytes + upscale.bytes + matte.bytes + ocr.bytes + reword.bytes + aiDetect.bytes + durable.bytes + fileHistory.bytes;
  const hasEstimate = !!(estimate && estimate.usage != null);
  const usage: number | null = hasEstimate ? estimate!.usage! : null;
  const quota: number | null = (estimate && estimate.quota) || null;
  const overshoot = hasEstimate && measured > usage!; // estimates are bucketed/approximate
  const other = (hasEstimate && !overshoot) ? Math.max(0, usage! - measured) : 0;
  const total = hasEstimate ? Math.max(usage!, measured) : measured; // the hero number
  return {
    sessions: { bytes: sessBytes, count: ownSessions.length, sizes: sessionSizes, list: ownSessions },
    trash,
    images: { bytes: imagesBytes, count: imageList.length, list: imageList },
    cache: { bytes: cacheBytes },
    previews,
    pins,
    speech,
    upscale,
    matte,
    ocr,
    reword,
    aiDetect,
    durable,
    fileHistory,
    measured, hasEstimate, usage, quota, overshoot, other, total,
  };
}
/** The Trash row's count and size, or "Empty" when the Trash holds nothing. */
function trashSummary(trash: StorageModel['trash']): string {
  const n = trash?.count ?? 0;
  if (!n) return t('Empty');
  return n === 1 ? t('1 item · {size}', { size: fmtBytes(trash!.bytes) }) : t('{n} items · {size}', { n, size: fmtBytes(trash!.bytes) });
}

/** My images' trailing Add tile (the grid is rebuilt after a restore). */
function userImgAddButton(): string {
  return `<button type="button" class="userimg-add" id="userimg-add" aria-label="${escapeText(t('Add images'))}">
                  <span class="userimg-add-icon" aria-hidden="true">+</span>
                  <span class="userimg-add-text">${t('Add')}</span>
                </button>`;
}

// The whole section, rendered ONCE. applyMeter() then refreshes only the viz so an
// open managed list (multi-select state) is never rebuilt out from under the user.
export function renderSection(pv: ProfileViewCtx, m: StorageModel, sort: string) {
  const { sessRowCtx } = pv;
  const hasPrev = m.previews.available;
  // Pinned-tools slice only renders once something is pinned - a permanent
  // "0 B" row would be noise for the (default) never-pinned user.
  const hasPins = m.pins.count > 0;
  // Same for the speech models: the slice appears only after a download.
  const hasSpeech = m.speech.bytes > 0;
  // The AI image models (host.upscale / host.matte) - each appears only once its
  // store holds bytes (pre-downloaded from Available offline, or fetched on demand
  // by the Upscale / Remove-background dialogs).
  const hasUpscale = m.upscale.bytes > 0;
  const hasMatte = m.matte.bytes > 0;
  const hasOcr = m.ocr.bytes > 0;
  const hasReword = m.reword.bytes > 0;
  const hasAiDetect = m.aiDetect.bytes > 0;
  // The durable-credential encoder - present once a durable export or the offline
  // part has fetched it. Scoped to its own key in the shared trustmark store.
  const hasDurable = m.durable.bytes > 0;
  return `
      <section class="store-meter" aria-label="${escapeText(isTauriShell() ? t('Storage on this device') : t('Storage in this browser'))}">
        <header class="store-hero">
          <p class="store-hero-num" id="store-hero-num" data-bytes="0">0 KB</p>
          <p class="store-hero-cap">${isTauriShell() ? t('On this device') : t('In this browser')} ${infoDot(isTauriShell() ? t('The real total this origin uses on this device, measured by your browser. Everything below is on THIS device only - nothing is uploaded.') : t('The real total Lolly uses in this browser, as measured by the browser. Everything below is in THIS browser only - nothing is uploaded.'))}</p>
          <p class="store-headroom" id="store-headroom" hidden></p>
        </header>

        <div class="store-bar" id="store-bar">
          <button type="button" class="seg" data-cat="sessions" style="flex-grow:0"></button>
          <button type="button" class="seg" data-cat="images" style="flex-grow:0"></button>
          <button type="button" class="seg" data-cat="file-history" style="flex-grow:0"></button>
          <button type="button" class="seg" data-cat="cache" style="flex-grow:0"></button>
          <button type="button" class="seg" data-cat="previews" style="flex-grow:0"${hasPrev ? '' : ' hidden'}></button>
          <button type="button" class="seg" data-cat="pins" style="flex-grow:0"${hasPins ? '' : ' hidden'}></button>
          <button type="button" class="seg" data-cat="speech" style="flex-grow:0"${hasSpeech ? '' : ' hidden'}></button>
          <button type="button" class="seg" data-cat="upscale" style="flex-grow:0"${hasUpscale ? '' : ' hidden'}></button>
          <button type="button" class="seg" data-cat="matte" style="flex-grow:0"${hasMatte ? '' : ' hidden'}></button>
          <button type="button" class="seg" data-cat="ocr" style="flex-grow:0"${hasOcr ? '' : ' hidden'}></button>
          <button type="button" class="seg" data-cat="reword" style="flex-grow:0"${hasReword ? '' : ' hidden'}></button>
          <button type="button" class="seg" data-cat="aidetect" style="flex-grow:0"${hasAiDetect ? '' : ' hidden'}></button>
          <button type="button" class="seg" data-cat="durable" style="flex-grow:0"${hasDurable ? '' : ' hidden'}></button>
          <span class="seg seg--other" data-cat="other" style="flex-grow:0" aria-hidden="true" hidden></span>
        </div>
        <p class="visually-hidden" id="store-aria-sentence"></p>

        <ul class="store-legend" role="list">
          <li><button type="button" class="store-chip" data-cat="sessions"><span class="store-chip-sw" data-cat="sessions"></span><span class="store-chip-name">${t('Saved sessions')}</span><span class="store-chip-val" data-size="sessions">-</span></button></li>
          <li><button type="button" class="store-chip" data-cat="images"><span class="store-chip-sw" data-cat="images"></span><span class="store-chip-name">${t('My images')}</span><span class="store-chip-val" data-size="images">-</span></button></li>
          <li><button type="button" class="store-chip" data-cat="file-history"><span class="store-chip-sw" data-cat="file-history"></span><span class="store-chip-name">${t('File results & versions')}</span><span class="store-chip-val" data-size="file-history">-</span></button></li>
          <li><button type="button" class="store-chip" data-cat="cache"><span class="store-chip-sw" data-cat="cache"></span><span class="store-chip-name">${t('Asset cache')}</span><span class="store-chip-val" data-size="cache">-</span></button></li>
          ${hasPrev ? `<li><button type="button" class="store-chip" data-cat="previews"><span class="store-chip-sw" data-cat="previews"></span><span class="store-chip-name">${t('Tool previews')}</span><span class="store-chip-val" data-size="previews">-</span></button></li>` : ''}
          ${hasPins ? `<li><button type="button" class="store-chip" data-cat="pins"><span class="store-chip-sw" data-cat="pins"></span><span class="store-chip-name">${t('Available offline')}</span><span class="store-chip-val" data-size="pins">-</span></button></li>` : ''}
          ${hasSpeech ? `<li><button type="button" class="store-chip" data-cat="speech"><span class="store-chip-sw" data-cat="speech"></span><span class="store-chip-name">${t('Voice models')}</span><span class="store-chip-val" data-size="speech">-</span></button></li>` : ''}
          ${hasUpscale ? `<li><button type="button" class="store-chip" data-cat="upscale"><span class="store-chip-sw" data-cat="upscale"></span><span class="store-chip-name">${t('Upscaling models')}</span><span class="store-chip-val" data-size="upscale">-</span></button></li>` : ''}
          ${hasMatte ? `<li><button type="button" class="store-chip" data-cat="matte"><span class="store-chip-sw" data-cat="matte"></span><span class="store-chip-name">${t('Background removal')}</span><span class="store-chip-val" data-size="matte">-</span></button></li>` : ''}
          ${hasOcr ? `<li><button type="button" class="store-chip" data-cat="ocr"><span class="store-chip-sw" data-cat="ocr"></span><span class="store-chip-name">${t('Text recognition')}</span><span class="store-chip-val" data-size="ocr">-</span></button></li>` : ''}
          ${hasReword ? `<li><button type="button" class="store-chip" data-cat="reword"><span class="store-chip-sw" data-cat="reword"></span><span class="store-chip-name">${t('Rewriter model')}</span><span class="store-chip-val" data-size="reword">-</span></button></li>` : ''}
          ${hasAiDetect ? `<li><button type="button" class="store-chip" data-cat="aidetect"><span class="store-chip-sw" data-cat="aidetect"></span><span class="store-chip-name">${t('AI text detector')}</span><span class="store-chip-val" data-size="aidetect">-</span></button></li>` : ''}
          ${hasDurable ? `<li><button type="button" class="store-chip" data-cat="durable"><span class="store-chip-sw" data-cat="durable"></span><span class="store-chip-name">${t('Durable credential')}</span><span class="store-chip-val" data-size="durable">-</span></button></li>` : ''}
          ${m.hasEstimate ? `<li><span class="store-chip store-chip--other"><span class="store-chip-sw is-hatch"></span><span class="store-chip-name">${t('Other')}</span><span class="store-chip-val" data-size="other">-</span>${infoDot(t('Your profile, internal indexes, the offline app cache and storage overhead - everything not itemised above. Calculated as total used minus the measured items. Clear it with "Clear all my data" below.'))}</span></li>` : ''}
        </ul>

        <p class="store-quota" id="store-quota" hidden><span class="storage-bar-wrap"><span class="storage-bar-fill" id="store-quota-fill" style="width:0%"></span></span><span class="store-quota-text" id="store-quota-text"></span></p>
        <p class="store-reclaim" id="store-reclaim"></p>
        <p class="store-footnote" id="store-footnote" hidden></p>

        <div class="store-manages">
          <div class="store-manage store-manage--row" data-cat="file-history">
            <span class="store-manage-name">${t('File results & versions')} <span class="storage-count" data-size-label="file-history">0 KB</span><br><small>${t('Saved copies and earlier asset bytes, including recoverable deleted assets. Included in data backups. Not a disposable cache.')}</small></span>
            <a class="btn" href="#/convert">${t('Review & manage…')}</a>
          </div>
          <details class="store-manage" data-cat="sessions">
            <summary class="store-manage-sum">${COLLAPSE_CHEV}<span>${t('Saved sessions')}</span> <span class="storage-count" data-count="sessions">0</span> <span class="storage-hint" data-size-hint="sessions">0 KB</span></summary>
            <div class="store-manage-body">
              <div class="store-sess-tools">
                <label class="store-selall"><input type="checkbox" id="sess-selall"> ${t('Select all')}</label>
                <button type="button" class="store-sort" data-sort="${sort}">${sort === 'recent' ? t('Recent ▾') : t('Largest first ▾')}</button>
              </div>
              <ul class="store-sess-list" id="store-sess-list">${sessionRowsHtml(m, sort, sessRowCtx)}</ul>
              <a class="store-manage-link" href="#/p">${t('Organise in Projects')} →</a>
            </div>
          </details>

          <details class="store-manage" data-cat="images">
            <summary class="store-manage-sum">${COLLAPSE_CHEV}<span>${t('My images')}</span> <span class="storage-count" id="userimg-count">0</span> <span class="storage-hint" id="userimg-size">0 KB</span> ${infoDot(t('Images you save to reuse across tools. This size includes your profile photo and any brand fonts.'))}</summary>
            <div class="store-manage-body">
              <div class="userimg-grid" id="userimg-grid">
                ${m.images.list.map(userImageThumb).join('')}
                ${userImgAddButton()}
              </div>
              <input type="file" id="userimg-file" accept="image/svg+xml,image/png,image/apng,image/jpeg,image/webp,image/gif,image/avif,image/heic,image/heif,video/mp4,video/webm,.mp4,.webm,.mov" multiple hidden>
              <p class="profile-inline-error" id="userimg-error" style="color:hsl(var(--destructive));font-size:13px;margin:.4rem 0 0" hidden></p>
            </div>
          </details>

          <div class="store-manage store-manage--row" data-cat="trash">
            <span class="store-manage-name">${t('Trash')} ${infoDot(t('Saved sessions, folders and uploads you deleted here, in Projects or in Assets. They stay for 30 days, then go for good. Their space is counted above until the Trash is emptied.'))} <span class="storage-count" data-trash-summary>${trashSummary(m.trash)}</span></span>
            <button type="button" id="open-trash-btn" class="btn">${t('Open Trash')}</button>
          </div>

          <div class="store-manage store-manage--row" data-cat="cache">
            <span class="store-manage-name">${t('Asset cache')} ${infoDot(t('Downloaded catalog content; it re-downloads on demand. Safe to clear.'))} <span class="storage-count" data-size-label="cache">0 KB</span></span>
            <button type="button" id="clear-cache-btn" class="btn-link-danger">${t('Clear cache')}</button>
          </div>

          ${hasPrev ? `<div class="store-manage store-manage--row" data-cat="previews">
            <span class="store-manage-name">${t('Tool previews')} ${infoDot(t('Snapshots Lolly draws of personalised tool cards - they redraw when needed. Safe to clear.'))} <span class="storage-count" data-size-label="previews">0 KB</span></span>
            <button type="button" id="clear-previews-btn" class="btn-link-danger">${t('Clear previews')}</button>
          </div>` : ''}

          ${hasPins ? `<div class="store-manage store-manage--row" data-cat="pins">
            <span class="store-manage-name">${t('Available offline')} ${infoDot(isTauriShell() ? t('Tools you pinned in the gallery to work offline - their files are kept on this device. Unpinning re-downloads them on demand.') : t('Tools you pinned in the gallery to work offline - their files are kept in this browser. Unpinning re-downloads them on demand.'))} <span class="storage-count" data-size-label="pins">0 KB</span></span>
            <button type="button" id="unpin-all-btn" class="btn-link-danger">${t('Unpin all')}</button>
          </div>` : ''}

          ${hasSpeech ? `<div class="store-manage store-manage--row" data-cat="speech">
            <span class="store-manage-name">${t('Voice models')} ${infoDot(t('On-device voices for Script audio and narration. Removing them frees the space; they download again with your consent when next used.'))} <span class="storage-count" data-size-label="speech">0 KB</span></span>
            <button type="button" id="clear-speech-btn" class="btn-link-danger">${t('Remove voices')}</button>
          </div>` : ''}

          ${hasUpscale ? `<div class="store-manage store-manage--row" data-cat="upscale">
            <span class="store-manage-name">${t('Upscaling models')} ${infoDot(t('On-device AI upscalers for the Upscale tool. Removing them frees the space; they download again with your consent when next used.'))} <span class="storage-count" data-size-label="upscale">0 KB</span></span>
            <button type="button" id="clear-upscale-btn" class="btn-link-danger">${t('Remove models')}</button>
          </div>` : ''}

          ${hasMatte ? `<div class="store-manage store-manage--row" data-cat="matte">
            <span class="store-manage-name">${t('Background removal')} ${infoDot(t('On-device cut-out models for Remove background. Removing them frees the space; they download again with your consent when next used.'))} <span class="storage-count" data-size-label="matte">0 KB</span></span>
            <button type="button" id="clear-matte-btn" class="btn-link-danger">${t('Remove models')}</button>
          </div>` : ''}

          ${hasOcr ? `<div class="store-manage store-manage--row" data-cat="ocr">
            <span class="store-manage-name">${t('Text recognition')} ${infoDot(t('On-device OCR models for reading text out of images. Removing them frees the space; they download again with your consent when next used.'))} <span class="storage-count" data-size-label="ocr">0 KB</span></span>
            <button type="button" id="clear-ocr-btn" class="btn-link-danger">${t('Remove models')}</button>
          </div>` : ''}

          ${hasReword ? `<div class="store-manage store-manage--row" data-cat="reword">
            <span class="store-manage-name">${t('Rewriter model')} ${infoDot(t('The on-device rewriter for Humanize. Removing it frees the space; it downloads again with your consent when next used.'))} <span class="storage-count" data-size-label="reword">0 KB</span></span>
            <button type="button" id="clear-reword-btn" class="btn-link-danger">${t('Remove model')}</button>
          </div>` : ''}
          ${hasAiDetect ? `<div class="store-manage store-manage--row" data-cat="aidetect">
            <span class="store-manage-name">${t('AI text detector')} ${infoDot(t('The on-device detector behind the deeper AI-text check. Removing it frees the space; it downloads again with your consent when next used.'))} <span class="storage-count" data-size-label="aidetect">0 KB</span></span>
            <button type="button" id="clear-aidetect-btn" class="btn-link-danger">${t('Remove model')}</button>
          </div>` : ''}
          ${hasDurable ? `<div class="store-manage store-manage--row" data-cat="durable">
            <span class="store-manage-name">${t('Durable credential')} ${infoDot(t('The on-device model that hides the durable credential in exported pixels. Removing it frees the space; it downloads again with your consent when next used.'))} <span class="storage-count" data-size-label="durable">0 KB</span></span>
            <button type="button" id="clear-durable-btn" class="btn-link-danger">${t('Remove model')}</button>
          </div>` : ''}
        </div>

        <div class="storage-subsection">
          <div class="storage-subsection-header">
            <span>${t('Move to another device')} ${infoDot(t('Export everything - profile, saved sessions, uploaded images and preferences - as one file, then import it on another offline install to pick up exactly where you left off. Stays entirely on your devices.'))}</span>
          </div>
          <div class="storage-actions">
            ${pv.jellyOn
              ? `<jelly-button variant="platinum" id="export-data-btn" data-sfx="whoosh">${t('Export my data')}</jelly-button>
            <jelly-button variant="platinum" id="import-data-btn">${t('Import data…')}</jelly-button>`
              : `<button type="button" id="export-data-btn" class="btn" data-sfx="whoosh">${t('Export my data')}</button>
            <button type="button" id="import-data-btn" class="btn">${t('Import data…')}</button>`}
            <input type="file" id="import-data-input" accept=".zip,application/zip,.lolly,application/vnd.lolly+zip" hidden>
          </div>
          <button type="button" id="export-render-btn" class="btn storage-hoard-btn">📦 ${t('Export my data &amp; render everything')}</button>
          <p class="storage-hoard-hint">${t('The backup above, plus a second zip that <strong>renders every saved session</strong> to its output file - organised into folders that mirror your Projects. A complete offline archive; can be large and slow with many sessions.')}</p>
        </div>

        <div class="storage-actions">
          ${pv.jellyOn
            ? `<jelly-button variant="rose" id="clear-storage-btn">${t('Clear all my data')}</jelly-button>`
            : `<button type="button" id="clear-storage-btn" class="btn btn-danger">${t('Clear all my data')}</button>`}
        </div>

        <div class="store-selbar" id="store-selbar" role="region" aria-live="polite" hidden>
          <span class="store-selbar-count">${t('0 selected')}</span>
          <button type="button" class="btn store-selbar-clear">${t('Clear selection')}</button>
          <button type="button" class="btn btn-danger store-selbar-del">${t('Delete')}</button>
        </div>
      </section>`;
}
export async function loadStorage(pv: ProfileViewCtx) {
  const { host, viewEl } = pv;
  if (pv.storageLoaded) return;
  const panel = viewEl.querySelector<HTMLElement>('#storage-body');
  if (!panel) return;
  const body: HTMLElement = panel;
  pv.storageLoaded = true;

  let model = await measure(pv);
  // Import remounts Profile, and navigation can reuse viewEl for another
  // route while storage estimates/IDB reads are outstanding. A late result
  // belongs only to the exact panel that requested it.
  if (!body.isConnected || viewEl.querySelector('#storage-body') !== body) return;
  let sessSort = 'size';
  const userImages = [...model.images.list]; // mutable mirror for the grid + lightbox

  body.innerHTML = renderSection(pv, model, sessSort);
  // Content loaded async after the card opened - cascade it in like the catalog does
  // (silent: the shuffle already played when the section toggled open).
  staggerReveal([...body.children], { sound: false });

  const bar = body.querySelector('#store-bar');
  const heroNum = body.querySelector<HTMLElement>('#store-hero-num');
  const selbar = body.querySelector<HTMLElement>('#store-selbar');
  const setText = (sel: string, text: string) => body.querySelectorAll(sel).forEach(e => { e.textContent = text; });

  // Hero count-up - cosmetic; set instantly under reduced-motion OR a hidden tab
  // (rAF is paused when document.hidden, so the final value must land immediately).
  function countUp(el: HTMLElement | null, to: number) {
    if (!el) return;
    const from = Number(el.dataset.bytes || 0);
    el.dataset.bytes = String(to);
    if (reduceMotion(pv) || document.hidden || from === to) { el.textContent = fmtBytes(to); return; }
    const dur = 600; let t0: number | null = null;
    const tick = (now: number) => {
      if (t0 == null) t0 = now;
      const p = Math.min(1, (now - t0) / dur);
      const eased = 1 - (1 - p) ** 3;
      el.textContent = fmtBytes(Math.round(from + (to - from) * eased));
      if (p < 1) requestAnimationFrame(tick); else el.textContent = fmtBytes(to);
    };
    requestAnimationFrame(tick);
  }

  // What the rows below can free: the re-downloadable caches, plus the Trash,
  // which Empty Trash frees. A deleted session goes to the Trash (plan 277 P3), so
  // selecting sessions no longer counts as space freed.
  function updateReclaim(m: StorageModel) {
    const el = body.querySelector('#store-reclaim');
    if (el) el.innerHTML = t('Up to <strong>{n}</strong> can be freed here', { n: fmtBytes(m.cache.bytes + m.previews.bytes + m.pins.bytes + m.speech.bytes + m.upscale.bytes + m.matte.bytes + m.ocr.bytes + m.durable.bytes + (m.trash?.bytes ?? 0)) });
  }

  // Refresh ONLY the visualization (hero, segments, legend, quota, reclaim, aria,
  // manage-summary badges) from a fresh model. Never rebuilds the session list/grid.
  function applyMeter(m: StorageModel) {
    countUp(heroNum, m.hasEstimate ? m.total : m.measured);
    // Same number as the hero, so the folded summary and the open card agree.
    pv.summaries.setSummary('storage-section', tRaw('{size} used', { size: fmtBytes(m.hasEstimate ? m.total : m.measured) }));
    const headroom = body.querySelector<HTMLElement>('#store-headroom');
    if (headroom) {
      if (m.hasEstimate && m.quota) {
        const used = m.usage! / m.quota;
        const phrase = used < 0.5 ? t('lots of room left') : used < 0.8 ? t('plenty of room left') : used < 0.95 ? t('getting full') : t('almost full');
        headroom.textContent = tRaw('Using {pct} of your {quota} device budget · {phrase}', { pct: fmtPct(m.usage!, m.quota), quota: fmtBytes(m.quota), phrase });
        headroom.hidden = false;
      } else headroom.hidden = true;
    }
    const segs: Array<[string, number, string, boolean]> = [
      ['sessions', m.sessions.bytes, t('Saved sessions'), true],
      ['images', m.images.bytes, t('My images'), true],
      ['file-history', m.fileHistory?.bytes ?? 0, t('File results & versions'), true],
      ['cache', m.cache.bytes, t('Asset cache'), true],
      ['previews', m.previews.bytes, t('Tool previews'), m.previews.available],
      ['pins', m.pins.bytes, t('Available offline'), m.pins.count > 0],
      ['speech', m.speech.bytes, t('Voice models'), m.speech.bytes > 0],
      ['upscale', m.upscale.bytes, t('Upscaling models'), m.upscale.bytes > 0],
      ['matte', m.matte.bytes, t('Background removal'), m.matte.bytes > 0],
      ['ocr', m.ocr.bytes, t('Text recognition'), m.ocr.bytes > 0],
      ['reword', m.reword.bytes, t('Rewriter model'), m.reword.bytes > 0],
      ['aidetect', m.aiDetect.bytes, t('AI text detector'), m.aiDetect.bytes > 0],
      ['durable', m.durable.bytes, t('Durable credential'), m.durable.bytes > 0],
    ];
    for (const [cat, bytes, label, avail] of segs) {
      const seg = bar?.querySelector<HTMLElement>(`.seg[data-cat="${cat}"]`);
      if (!seg) continue;
      seg.style.flexGrow = String(Math.max(0, bytes));
      seg.hidden = !avail || bytes <= 0;
      seg.setAttribute('aria-label', tRaw('{label}, {size} - manage', { label, size: fmtBytes(bytes) }));
      seg.title = `${label} - ${fmtBytes(bytes)}`;
    }
    const otherSeg = bar?.querySelector<HTMLElement>('.seg--other');
    if (otherSeg) { otherSeg.style.flexGrow = String(m.other); otherSeg.hidden = !(m.hasEstimate && !m.overshoot && m.other > 0); }

    setText('[data-size="sessions"]', fmtBytes(m.sessions.bytes));
    setText('[data-size="images"]', fmtBytes(m.images.bytes));
    setText('[data-size="file-history"]', fmtBytes(m.fileHistory?.bytes ?? 0));
    setText('[data-size-label="file-history"]', fmtBytes(m.fileHistory?.bytes ?? 0));
    setText('[data-size="cache"]', fmtBytes(m.cache.bytes));
    setText('[data-size="previews"]', fmtBytes(m.previews.bytes));
    setText('[data-size="pins"]', fmtBytes(m.pins.bytes));
    setText('[data-size="speech"]', fmtBytes(m.speech.bytes));
    setText('[data-size="upscale"]', fmtBytes(m.upscale.bytes));
    setText('[data-size="matte"]', fmtBytes(m.matte.bytes));
    setText('[data-size="ocr"]', fmtBytes(m.ocr.bytes));
    setText('[data-size="reword"]', fmtBytes(m.reword.bytes));
    setText('[data-size="aidetect"]', fmtBytes(m.aiDetect.bytes));
    setText('[data-size="durable"]', fmtBytes(m.durable.bytes));
    setText('[data-size="other"]', `~${fmtBytes(m.other)}`);
    setText('[data-count="sessions"]', String(m.sessions.count));
    setText('[data-trash-summary]', trashSummary(m.trash));
    setText('[data-size-hint="sessions"]', fmtBytes(m.sessions.bytes));
    setText('[data-size-label="cache"]', fmtBytes(m.cache.bytes));
    setText('[data-size-label="previews"]', fmtBytes(m.previews.bytes));
    setText('[data-size-label="pins"]', fmtBytes(m.pins.bytes));
    setText('[data-size-label="speech"]', fmtBytes(m.speech.bytes));
    setText('[data-size-label="upscale"]', fmtBytes(m.upscale.bytes));
    setText('[data-size-label="matte"]', fmtBytes(m.matte.bytes));
    setText('[data-size-label="ocr"]', fmtBytes(m.ocr.bytes));
    setText('[data-size-label="reword"]', fmtBytes(m.reword.bytes));
    setText('[data-size-label="aidetect"]', fmtBytes(m.aiDetect.bytes));
    setText('[data-size-label="durable"]', fmtBytes(m.durable.bytes));
    const imgCount = body.querySelector('#userimg-count');
    const imgSize = body.querySelector('#userimg-size');
    if (imgCount) imgCount.textContent = `${m.images.count}`;
    if (imgSize) imgSize.textContent = fmtBytes(m.images.bytes);

    const quotaRow = body.querySelector<HTMLElement>('#store-quota');
    const fill = body.querySelector<HTMLElement>('#store-quota-fill');
    const quotaText = body.querySelector('#store-quota-text');
    if (m.hasEstimate && m.quota) {
      if (fill) fill.style.width = `${Math.min(100, (m.usage! / m.quota) * 100)}%`;
      if (quotaText) quotaText.innerHTML = t('{used} of {quota} device budget · <strong>{pct}</strong> used', { used: fmtBytes(m.usage!), quota: fmtBytes(m.quota), pct: fmtPct(m.usage!, m.quota) });
      if (quotaRow) quotaRow.hidden = false;
    } else if (quotaRow) quotaRow.hidden = true;

    const note = body.querySelector<HTMLElement>('#store-footnote');
    if (note) {
      if (!m.hasEstimate) { note.textContent = t('Device total unavailable - showing measured items only.'); note.hidden = false; }
      else if (m.overshoot) { note.textContent = t("Measured items meet or exceed the browser's estimate (estimates are approximate)."); note.hidden = false; }
      else note.hidden = true;
    }
    const aria = body.querySelector('#store-aria-sentence');
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
      panel.scrollIntoView({ block: 'start', behavior: reduceMotion(pv) ? 'auto' : 'smooth' });
    }
  }

  const ensureSessEmptyState = () => {
    const list = body.querySelector('#store-sess-list');
    if (list && !list.querySelector('.store-sess')) list.innerHTML = `<li class="storage-empty">${t('No saved sessions yet.')}</li>`;
  };
  function syncSelbar() {
    const checked = [...body.querySelectorAll<HTMLElement>('.store-sess-check:checked')];
    if (selbar) {
      selbar.hidden = checked.length === 0;
      let bytes = 0; checked.forEach(c => bytes += model.sessions.sizes[c.dataset.slot!] || 0);
      const cnt = selbar.querySelector('.store-selbar-count');
      if (cnt) cnt.textContent = t('{n} selected · {size}', { n: checked.length, size: fmtBytes(bytes) });
    }
    // Reserve space so the fixed bar never covers the section's bottom controls (mobile).
    body.querySelector('.store-meter')?.classList.toggle('has-selbar', checked.length > 0);
    const all = body.querySelector<HTMLInputElement>('#sess-selall');
    const boxes = [...body.querySelectorAll('.store-sess-check')];
    if (all) all.checked = boxes.length > 0 && checked.length === boxes.length;
    updateReclaim(model);
  }

  async function refreshMeter() { model = await measure(pv); applyMeter(model); }

  // The confirm modal restores focus to the (now-removed) delete control on close, so
  // after a deletion move focus to a surviving control - else keyboard/SR users drop to
  // <body> and have to re-traverse the page.
  function focusSurvivingSession(preferred?: HTMLElement | null) {
    const t = (preferred && document.contains(preferred) && preferred)
      || body.querySelector<HTMLElement>('.store-sess-del')
      || body.querySelector<HTMLElement>('.store-sort')
      || body.querySelector<HTMLElement>('.store-manage[data-cat="sessions"] > summary');
    t?.focus?.();
  }

  const trash = trashFor(pv);
  const sessionLabel = (slot: string): string | undefined => {
    const row = [...body.querySelectorAll<HTMLElement>('.store-sess')].find(r => r.dataset.slot === slot);
    return row?.querySelector('.store-sess-label')?.textContent || undefined;
  };

  /** The session list's rows, in the current sort. One writer, shared by the
   *  sort toggle and the redraw below. Every row value is escaped by sessionRow. */
  function paintSessionRows() {
    const list = body.querySelector('#store-sess-list');
    if (list) list.innerHTML = sessionRowsHtml(model, sessSort, pv.sessRowCtx);
  }
  /** Prepend image tiles to My images, ahead of the Add tile. One writer, shared
   *  by an upload and the redraw below; userImageThumb escapes every value. */
  function prependImageTiles(html: string) {
    body.querySelector('#userimg-grid')?.insertAdjacentHTML('afterbegin', html);
  }

  /** Re-read the model and redraw the session list, My images and the meter:
   *  after an Undo, a restore from the Trash, or a Trash emptied from here. */
  async function redrawLists() {
    if (!body.isConnected) return;
    model = await measure(pv);
    paintSessionRows();
    userImages.splice(0, userImages.length, ...model.images.list);
    // Only the image tiles are rebuilt; the Add tile (and its listener) stays.
    body.querySelectorAll('#userimg-grid [data-userimg]').forEach(n => n.remove());
    prependImageTiles(model.images.list.map(userImageThumb).join(''));
    syncSelbar();
    applyMeter(model);
  }

  // A delete here goes to the Trash (plan 277 P3), the same as Projects: no
  // confirm, an Undo toast, and the item's version history kept until it is
  // deleted forever. The space is freed when the Trash is emptied.
  async function deleteOneSession(slot: string, btn: HTMLButtonElement) {
    const row = [...body.querySelectorAll<HTMLElement>('.store-sess')].find(r => r.dataset.slot === slot);
    // The next/previous row's delete button is the natural landing spot post-removal.
    const nextFocus = (row?.nextElementSibling || row?.previousElementSibling)?.querySelector?.('.store-sess-del') as HTMLElement | null | undefined;
    btn.disabled = true;
    const moved = await trash.trashSessions([slot], sessionLabel).catch((err) => { host.log?.('error', 'Session delete failed', { slot, error: String(err) }); return []; });
    if (!moved.length) { btn.disabled = false; return; }
    row?.remove();
    ensureSessEmptyState();
    syncSelbar();
    focusSurvivingSession(nextFocus);
    await refreshMeter();
    showTrashUndoToast(trash, moved, redrawLists);
  }

  async function deleteSelectedSessions(btn: HTMLButtonElement) {
    const checked = [...body.querySelectorAll<HTMLElement>('.store-sess-check:checked')];
    if (!checked.length) return;
    const slots = checked.map(c => c.dataset.slot!);
    const prev = btn.textContent; btn.disabled = true; btn.textContent = t('Deleting…');
    // Only a row whose move succeeded leaves the list, so a failure never leaves a
    // ghost (row gone, session still counted and back on the next sort).
    const moved = await trash.trashSessions(slots, sessionLabel).catch((err) => { host.log?.('error', 'Session delete failed', { error: String(err) }); return []; });
    const gone = new Set(moved.map(e => e.originalSlot));
    for (const r of [...body.querySelectorAll<HTMLElement>('.store-sess')]) if (gone.has(r.dataset.slot!)) r.remove();
    btn.textContent = prev; btn.disabled = false;
    ensureSessEmptyState();
    syncSelbar();
    focusSurvivingSession();
    await refreshMeter();
    if (moved.length < slots.length) announce(t('Moved {done} of {total} to Trash; some could not be moved', { done: moved.length, total: slots.length }), { assertive: true });
    showTrashUndoToast(trash, moved, redrawLists);
  }

  function toggleSort(btn: HTMLElement) {
    sessSort = sessSort === 'size' ? 'recent' : 'size';
    btn.dataset.sort = sessSort;
    btn.textContent = sessSort === 'recent' ? t('Recent ▾') : t('Largest first ▾');
    const checked = new Set([...body.querySelectorAll<HTMLElement>('.store-sess-check:checked')].map(c => c.dataset.slot!));
    paintSessionRows();
    checked.forEach(slot => {
      const box = [...body.querySelectorAll<HTMLInputElement>('.store-sess-check')].find(c => c.dataset.slot === slot);
      if (box) box.checked = true;
    });
    syncSelbar();
  }

  async function clearRegenerable(btn: HTMLButtonElement, fn: () => Promise<unknown>, doneMsg: string) {
    const prev = btn.textContent; btn.disabled = true; btn.textContent = t('Clearing…');
    try { await fn(); } catch (err) { host.log?.('error', doneMsg, { error: String(err) }); }
    btn.textContent = t('Cleared');
    setTimeout(() => { btn.textContent = prev; btn.disabled = false; }, 1500);
    await refreshMeter();
    announce(doneMsg);
  }

  // ── one delegated click listener (explore / clear / sort / multi-select bar) ──
  body.addEventListener('click', async (e) => {
    const explore = (e.target as Element).closest<HTMLElement>('.store-chip[data-cat], .seg[data-cat]');
    if (explore && explore.dataset.cat !== 'other') { exploreCategory(explore.dataset.cat!); return; }

    const del = (e.target as Element).closest<HTMLButtonElement>('[data-del-session]');
    if (del) { await deleteOneSession(del.dataset.delSession!, del); return; }

    const sortBtn = (e.target as Element).closest<HTMLElement>('.store-sort');
    if (sortBtn) { toggleSort(sortBtn); return; }

    const cacheBtn = (e.target as Element).closest<HTMLButtonElement>('#clear-cache-btn');
    // 'derived-media' rides with the asset cache: it is the same kind of thing
    // (downloaded/derived bytes that regenerate on demand), so it is counted in
    // the same slice - see measure() - and must be cleared by the same button.
    if (cacheBtn) { await clearRegenerable(cacheBtn, () => clearIdbStores(['asset-blob', 'asset-meta', 'derived-media', 'audio-peaks', 'audio-cover-bakes']), t('Cleared asset cache')); return; }

    const prevBtn = (e.target as Element).closest<HTMLButtonElement>('#clear-previews-btn');
    if (prevBtn) { await clearRegenerable(prevBtn, () => host.previews?.clear(), t('Cleared tool previews')); return; }

    const unpinBtn = (e.target as Element).closest<HTMLButtonElement>('#unpin-all-btn');
    if (unpinBtn) { await clearRegenerable(unpinBtn, () => unpinAll(), t('Removed offline copies')); return; }

    // removePart clears BOTH speech buckets and forgets the offline-part
    // record, so the offline section's Speech row reads not-downloaded again.
    const speechBtn = (e.target as Element).closest<HTMLButtonElement>('#clear-speech-btn');
    if (speechBtn) { await clearRegenerable(speechBtn, () => removePart('speech'), t('Removed voice models')); return; }

    // removePart clears the model's IndexedDB store and forgets the offline-part
    // record, so Available offline reads not-downloaded again; the dialog re-fetches
    // on next use behind its own consent line.
    const upscaleBtn = (e.target as Element).closest<HTMLButtonElement>('#clear-upscale-btn');
    if (upscaleBtn) { await clearRegenerable(upscaleBtn, () => removePart('upscale'), t('Removed upscaling models')); return; }
    const matteBtn = (e.target as Element).closest<HTMLButtonElement>('#clear-matte-btn');
    if (matteBtn) { await clearRegenerable(matteBtn, () => removePart('matte'), t('Removed background-removal models')); return; }
    const ocrBtn = (e.target as Element).closest<HTMLButtonElement>('#clear-ocr-btn');
    if (ocrBtn) { await clearRegenerable(ocrBtn, () => removePart('ocr'), t('Removed text-recognition models')); return; }
    const durableBtn = (e.target as Element).closest<HTMLButtonElement>('#clear-durable-btn');
    if (durableBtn) { await clearRegenerable(durableBtn, () => removePart('durable'), t('Removed the durable-credential model')); return; }
    const rewordBtn = (e.target as Element).closest<HTMLButtonElement>('#clear-reword-btn');
    if (rewordBtn) { await clearRegenerable(rewordBtn, () => removePart('reword'), t('Removed the rewriter model')); return; }
    const aiDetectBtn = (e.target as Element).closest<HTMLButtonElement>('#clear-aidetect-btn');
    if (aiDetectBtn) { await clearRegenerable(aiDetectBtn, () => clearAiDetectCaches(), t('Removed the AI text detector')); return; }

    if ((e.target as Element).closest('.store-selbar-clear')) { body.querySelectorAll<HTMLInputElement>('.store-sess-check').forEach(c => { c.checked = false; }); syncSelbar(); return; }
    const selDel = (e.target as Element).closest<HTMLButtonElement>('.store-selbar-del');
    if (selDel) { await deleteSelectedSessions(selDel); return; }
  });

  // selection checkboxes (incl. select-all) update the floating action bar.
  body.addEventListener('change', (e) => {
    if ((e.target as Element).matches('.store-sess-check')) { syncSelbar(); }
    else if ((e.target as Element).matches('#sess-selall')) {
      const on = (e.target as HTMLInputElement).checked;
      body.querySelectorAll<HTMLInputElement>('.store-sess-check').forEach(c => { c.checked = on; });
      syncSelbar();
    }
  });

  // ── My images - same add/delete/lightbox handlers as before (grid reused). ──
  const userimgAddBtn = body.querySelector<HTMLButtonElement>('#userimg-add');
  async function syncUserImgMeta() {
    await refreshCounter(pv); // re-measures → applyMeter refreshes the count/size badges + legend + bar
  }
  const userimgFile = body.querySelector<HTMLInputElement>('#userimg-file');
  userimgAddBtn?.addEventListener('click', () => userimgFile?.click());
  userimgFile?.addEventListener('change', async () => {
    const files = [...(userimgFile!.files ?? [])];
    userimgFile!.value = '';
    if (!files.length) return;
    if (userimgAddBtn) userimgAddBtn.disabled = true;
    const imgErr = body.querySelector<HTMLElement>('#userimg-error');
    if (imgErr) imgErr.hidden = true;
    for (const file of files) {
      try {
        // host carries the web-only bridge methods storeUserUpload needs; its
        // exact PickerHost type isn't exported from picker.
        const ref = await storeUserUpload(host as unknown as Parameters<typeof storeUserUpload>[0], file);
        userImages.unshift(ref);
        prependImageTiles(userImageThumb(ref));
      } catch (err) {
        host.log?.('error', 'Image upload failed', { name: file.name, error: String(err) });
        const msg = String((err as { message?: unknown })?.message ?? err);
        if (imgErr) { imgErr.textContent = msg; imgErr.hidden = false; }
        announce(msg, { assertive: true });
        break;
      }
    }
    if (userimgAddBtn) userimgAddBtn.disabled = false;
    await syncUserImgMeta();
  });
  body.querySelector('#userimg-grid')?.addEventListener('click', async e => {
    const view = (e.target as Element).closest<HTMLElement>('[data-view-userimg]');
    if (view) {
      const ref = userImages.find(a => a.id === view.dataset.viewUserimg);
      if (ref) openImageLightbox(ref, openProfileModals);
      return;
    }
    const btn = (e.target as Element).closest<HTMLButtonElement>('[data-delete-userimg]');
    if (!btn) return;
    const id = btn.dataset.deleteUserimg!;
    const ref = userImages.find(a => a.id === id);
    btn.disabled = true;
    // To the Trash, like every upload deleted in the web app (plan 277 P3).
    const moved = await trash.trashAssets([{ id, name: String(ref?.meta?.name ?? ''), type: ref?.type }])
      .catch((err) => { host.log?.('error', 'Failed to delete image', { id, error: String(err) }); return []; });
    if (!moved.length) { btn.disabled = false; return; }
    btn.closest('[data-userimg]')?.remove();
    const i = userImages.findIndex(a => a.id === id);
    if (i !== -1) userImages.splice(i, 1);
    await syncUserImgMeta();
    showTrashUndoToast(trash, moved, redrawLists);
  });

  // The Trash row: the shared Trash dialog. Restores and deletions redraw the
  // lists and the meter behind the dialog.
  body.querySelector('#open-trash-btn')?.addEventListener('click', () => {
    void openTrashDialog({ trash, onChange: redrawLists, returnFocus: () => body.querySelector<HTMLElement>('#open-trash-btn') });
  });

  applyMeter(model);
  pv.refreshStorageMeter = refreshMeter;

  // Clear all - confirmation dialog gated on typing a randomised word, so an
  // irreversible wipe can't be fired by reflex (or a stray double-click). It
  // clears everything Lolly keeps here (lib/clear-all-data.ts, plan 277 P2), and
  // the list below says so in a few words.
  viewEl.querySelector('#clear-storage-btn')?.addEventListener('click', () => {
    const word = CLEAR_CONFIRM_WORDS[Math.floor(Math.random() * CLEAR_CONFIRM_WORDS.length)]!;
    const content = `
        <h3 id="clear-dialog-title">${t('Clear all my data?')}</h3>
        <p class="clear-dialog-lead">${isTauriShell() ? t('This removes everything Lolly keeps on this device, then restarts the app:') : t('This removes everything Lolly keeps in this browser, then restarts the app:')}</p>
        <ul class="clear-dialog-list">
          <li>${t('your profile, settings and Content Credentials')}</li>
          <li>${t('saved sessions, their history and the Trash')}</li>
          <li>${t('uploads, fonts and design systems')}</li>
          <li>${t('the download log, file results, downloaded models and offline copies')}</li>
        </ul>
        <p>${t('Files you downloaded stay where you saved them. This cannot be undone.')}</p>
        <label class="clear-confirm">
          <span class="clear-confirm-prompt">${t('Type <strong>{word}</strong> to confirm', { word })}</span>
          <input type="text" class="clear-confirm-input" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="${escapeText(tRaw('Type {word} to confirm', { word }))}">
        </label>
        <div class="clear-dialog-actions">
          <button class="btn btn-danger" data-scope="all" data-sfx="byebye" disabled>${t('Clear everything')}</button>
          <button class="btn" data-scope="cancel">${t('Cancel')}</button>
        </div>`;
    const modal = mountModal<void>(content, {
      className: 'clear-dialog',
      initialFocus: (el) => el.querySelector<HTMLElement>('.clear-confirm-input'),
      onClose: () => openProfileModals.delete(modal),
    });
    modal.el.setAttribute('aria-labelledby', 'clear-dialog-title');
    openProfileModals.add(modal);

    const confirmInput = modal.el.querySelector<HTMLInputElement>('.clear-confirm-input')!;
    const clearBtn = modal.el.querySelector<HTMLButtonElement>('[data-scope="all"]')!;
    const matches = () => confirmInput.value.trim().toLowerCase() === word;
    confirmInput.addEventListener('input', () => { clearBtn.disabled = !matches(); });
    confirmInput.addEventListener('keydown', e => { if (e.key === 'Enter' && matches()) { e.preventDefault(); clearBtn.click(); } });

    modal.el.addEventListener('click', async e => {
      const scope = (e.target as Element).closest<HTMLElement>('[data-scope]')?.dataset.scope;
      if (!scope || scope === 'cancel') { modal.close(); return; }
      if (scope === 'all' && !matches()) return; // guard: the word must match

      const btns = modal.el.querySelectorAll('button');
      btns.forEach(b => (b.disabled = true));
      clearBtn.textContent = t('Clearing…');

      // Everything, by enumeration (see lib/clear-all-data.ts): every other tab of
      // the app stops writing first and reloads after, sync goes off, then the
      // app's files outside the browser (the Tauri saved-state files via the state
      // bridge), every IndexedDB store, every cache, the private file system and
      // web storage. 'audio-peaks' and the other derived caches go with the rest,
      // which matters for privacy as well as tidiness: their keys embed upload file
      // names.
      const report = await clearAllLollyData({ state: host.state as { _clearAll?(): Promise<void> } });
      if (report.errors.length) host.log?.('warn', 'Clear all my data: some parts did not clear', { errors: report.errors });
      sealWebStorageUntilReload();
      host.profile.bust!();
      applyTheme('light');
      modal.close();
      // The bye-bye song is already playing (data-sfx on the confirm button). Land
      // back on the gallery: with the dismissed flag just wiped, the first-run
      // "Welcome to Lolly" greets the clean slate there (unbranded installs only - 
      // a locked brand never shows it, see mountGallery). A hard reload (not just
      // a hash change) is required: in-memory singletons like the tokens bridge
      // cache (bridge/tokens.ts) only reset on bust(), so a soft nav would keep
      // painting a just-cleared user brand until the next manual refresh. The hash
      // is dropped without a hashchange: a view mounted now would reach for the
      // database the clear has just closed in this tab.
      try { history.replaceState(null, '', window.location.pathname + window.location.search); } catch { window.location.hash = ''; }
      window.location.reload();
    });
  });

  // Export everything to a portable .zip for carrying to another offline install.
  viewEl.querySelector('#export-data-btn')?.addEventListener('click', async e => {
    const btn = e.currentTarget as HTMLButtonElement;
    const prev = btn.textContent;
    btn.disabled = true;
    btn.textContent = t('Exporting…');
    try {
      // host carries the web-only bridge methods exportBackup needs; its exact
      // BackupHost type isn't exported from data-transfer.
      const { blob, filename, summary } = await exportBackup({ host: host as unknown as Parameters<typeof exportBackup>[0]['host'], storage: localStorage });
      await saveBlob(blob, filename);
      announce(tRaw('Exported {sessions} and {images}', {
        sessions: summary.sessions === 1 ? t('1 session') : t('{n} sessions', { n: summary.sessions }),
        images: summary.userAssets === 1 ? t('1 image') : t('{n} images', { n: summary.userAssets }),
      }) + backupHistoryNote(summary));
      btn.textContent = t('Exported');
    } catch (err) {
      host.log?.('error', 'Data export failed', { error: String(err) });
      btn.textContent = t('Export failed');
      announce(err instanceof Error ? err.message : t('Data export failed. Keep your local files and try again.'), { assertive: true });
    }
    setTimeout(() => { btn.textContent = prev; btn.disabled = false; }, 1800);
  });

  // Export EVERYTHING and render it all: the portable backup (as above) AND a second zip
  // that renders every saved session to its output file, in a folder tree mirroring the
  // Projects view. It's non-destructive but potentially big/slow, so it's gated behind a
  // celebratory type-a-word confirm (a distinct, upbeat word pool from the clear-data gate).
  viewEl.querySelector('#export-render-btn')?.addEventListener('click', () => {
    const word = HOARD_CONFIRM_WORDS[Math.floor(Math.random() * HOARD_CONFIRM_WORDS.length)]!;
    const content = `
        <h3 id="hoard-dialog-title">${t('Export everything - and render it all?')}</h3>
        <p>${t('Downloads a full <strong>backup</strong> of your data, then a <strong>rendered archive</strong> - every saved session output to its file, in folders that mirror your Projects. Nothing is deleted. A big library makes a big zip and can take a while.')}</p>
        <label class="clear-confirm">
          <span class="clear-confirm-prompt">${t('Type <strong>{word}</strong> to confirm', { word })}</span>
          <input type="text" class="clear-confirm-input" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="${escapeText(tRaw('Type {word} to confirm', { word }))}">
        </label>
        <div class="clear-dialog-actions">
          <button class="btn btn-go" data-scope="go" disabled>${t('Hoard it all 📦')}</button>
          <button class="btn" data-scope="cancel">${t('Cancel')}</button>
        </div>`;
    // Mirrors the clear-all dialog above; celebratory `--hoard` modifier only changes copy/colour.
    const modal = mountModal<void>(content, {
      className: 'clear-dialog clear-dialog--hoard',
      initialFocus: (el) => el.querySelector<HTMLElement>('.clear-confirm-input'),
      onClose: () => openProfileModals.delete(modal),
    });
    modal.el.setAttribute('aria-labelledby', 'hoard-dialog-title');
    openProfileModals.add(modal);

    const confirmInput = modal.el.querySelector<HTMLInputElement>('.clear-confirm-input')!;
    const goBtn = modal.el.querySelector<HTMLButtonElement>('[data-scope="go"]')!;
    const matches = () => confirmInput.value.trim().toLowerCase() === word;
    confirmInput.addEventListener('input', () => { goBtn.disabled = !matches(); });
    confirmInput.addEventListener('keydown', e => { if (e.key === 'Enter' && matches()) { e.preventDefault(); goBtn.click(); } });

    modal.el.addEventListener('click', async e => {
      const scope = (e.target as Element).closest<HTMLElement>('[data-scope]')?.dataset.scope;
      if (!scope || scope === 'cancel') { modal.close(); return; }
      if (scope === 'go' && !matches()) return; // guard: the word must match
      modal.close();
      await exportAndRenderEverything();
    });
  });

  // Secondary, on-demand gate for motion (video/animated) renders. They record in real
  // time and PAUSE the moment this tab is hidden, so including them is opt-in behind an
  // explicit "I'm willing to keep this tab active" affirmation. Resolves:
  //   'include' → render them (user committed to keeping the tab active)
  //   'skip'    → drop them, render everything else
  //   'cancel'  → abort the render (Escape / backdrop / Cancel)
  function askKeepTabActive(count: number): Promise<'include' | 'skip' | 'cancel'> {
    return new Promise(resolve => {
      const n = count === 1 ? t('1 creation is a video or animation') : t('{n} of your creations are videos or animations', { n: count });
      const content = `
          <h3 id="keepactive-title">${t('Keep this tab active?')}</h3>
          <p>${t('{n}. Those record in <strong>real time</strong>, so this browser tab must stay open and in front the whole time they render - switch away and they pause. Include them?', { n })}</p>
          <div class="clear-dialog-actions">
            <button class="btn btn-go" data-choice="include">${t("I'm willing to keep this tab active")}</button>
            <button class="btn" data-choice="skip">${t('Skip videos for now')}</button>
            <button class="btn" data-choice="cancel">${t('Cancel')}</button>
          </div>`;
      const modal = mountModal<'include' | 'skip' | 'cancel'>(content, {
        className: 'clear-dialog clear-dialog--hoard',
        cancelValue: 'cancel',
        initialFocus: (el) => el.querySelector<HTMLElement>('[data-choice="include"]'),
        onClose: (result) => { openProfileModals.delete(modal); resolve(result ?? 'cancel'); },
      });
      modal.el.setAttribute('aria-labelledby', 'keepactive-title');
      openProfileModals.add(modal);
      modal.el.addEventListener('click', e => {
        const choice = (e.target as Element).closest<HTMLElement>('[data-choice]')?.dataset.choice;
        if (choice === 'include' || choice === 'skip' || choice === 'cancel') modal.close(choice);
      });
    });
  }

  // The two-part export+render job, kicked off once the confirm word matches. It runs as
  // ONE WP-F background job (lib/batch-job.ts): the data backup and the render report
  // through the same handle, the global job toast owns the progress, and a throw
  // anywhere fails the job so the failure is visible even after the user has left this
  // view. It used to run in a view-owned progress toast that a view swap tore down mid
  // archive - the run kept going with nothing on screen to show for it.
  async function exportAndRenderEverything(): Promise<void> {
    // The victorious fanfare fires when the render QUEUE finishes (see runBatchWithProgress),
    // not here at kickoff - so it reads as a genuine "it's all done" reward.
    startBatchExport(t('Exporting everything'), async (job) => {
      const prof = await host.profile.get().catch(() => null);
      const author = prof && (prof as { useDetails?: boolean }).useDetails ? prof : null;

      // 1) Portable data backup (quick) - the same bundle the "Export my data" button makes.
      job.progress(0, 0, t('Saving your data backup…'));
      try {
        const { blob, filename, summary } = await exportBackup({ host: host as unknown as Parameters<typeof exportBackup>[0]['host'], storage: localStorage });
        await saveBlob(blob, filename);
        announce(tRaw('Data backup saved: {sessions}, {images}', {
          sessions: summary.sessions === 1 ? t('1 session') : t('{n} sessions', { n: summary.sessions }),
          images: summary.userAssets === 1 ? t('1 image') : t('{n} images', { n: summary.userAssets }),
        }) + backupHistoryNote(summary));
      } catch (err) {
        // The backup failing must not take the render down with it - it is a separate
        // deliverable, so it is reported and the job carries on.
        host.log?.('error', 'Data export failed', { error: String(err) });
        announce(tRaw('The data backup failed ({error}). Continuing to the render…', { error: String((err as { message?: unknown })?.message ?? err) }));
      }

      // 2) Render EVERYTHING into one nested zip mirroring the Projects tree: loose
      // (uncategorised) sessions at the top, each top-level folder recursed into subpaths.
      job.progress(0, 0, t('Rendering every creation…'));
      const [{ createFolderStore, childFolders }, { exportSelectionAsBatch }] = await Promise.all([
        import('../../folders.ts'),
        import('../../pro/folder-export.ts'),
      ]);
      const store = createFolderStore(host as unknown as Parameters<typeof createFolderStore>[0]);
      const folders = await store.list();
      const entries = await (host.state as unknown as { list(): Promise<Array<{ slot: string }>> }).list().catch(() => []);
      const claimed = new Set(folders.flatMap(f => f.items.filter(i => i.type === 'session').map(i => i.ref)));
      // Trashed and project-template copies sit in no folder by construction; a backup renders neither.
      const looseSlots = entries.filter(e => !isHiddenSlot(e.slot) && !claimed.has(e.slot)).map(e => e.slot);
      const topLevelIds = childFolders(folders, null).map(f => f.id);
      if (!looseSlots.length && !topLevelIds.length) {
        announce(t('Backup saved. You have no saved sessions to render yet.'));
        return undefined;
      }
      try {
        const result = await exportSelectionAsBatch(host as unknown as Parameters<typeof exportSelectionAsBatch>[0], {
          label: prof?.firstname ? `${prof.firstname}'s Lolly` : 'Lolly',
          sessionRefs: looseSlots,
          folderIds: topLevelIds,
          allFolders: folders as unknown as NonNullable<Parameters<typeof exportSelectionAsBatch>[1]>['allFolders'],
          job,
          author,
          announce,
          // Videos/animations encode in real time (they pause if the tab is hidden), so make
          // them opt-in behind an explicit "I'll keep this tab active" affirmation.
          onMotionFound: (count) => askKeepTabActive(count),
        });
        // A falsy result means the motion prompt was cancelled - the backup still went out,
        // but nothing was rendered, so report it rather than finishing silently.
        if (!result) announce(t('Backup saved. Render cancelled, so nothing else was downloaded.'));
        return result;
      } catch (err) {
        // Logged here (the view has the host), then rethrown so job.fail carries it to
        // the toast - a render failure must never be swallowed into a log line.
        host.log?.('error', 'Render-everything failed', { error: String(err) });
        throw err;
      }
    });
  }

  // Import a backup .zip from another install, or a copy Sync wrote to the person's
  // storage (a .lolly, plain or encrypted: plans/277 P13), then re-mount. Both merge
  // and delete nothing; lib/data-import.ts runs the dialog, the passphrase and the
  // repaint, shared with Open.
  const importInput = viewEl.querySelector<HTMLInputElement>('#import-data-input');
  viewEl.querySelector('#import-data-btn')?.addEventListener('click', () => importInput?.click());
  importInput?.addEventListener('change', () => {
    const file = importInput!.files?.[0];
    importInput!.value = ''; // let the same file be re-picked later
    if (!file) return;
    void Promise.all([import('../../lib/data-import.ts'), import('../../lib/lolly-intake.ts')]).then(([{ runDataImport, dataImportMessage }, intake]) => runDataImport(file, host, intake, {
      modals: openProfileModals,
      afterImport: async (summary) => {
        const { message, assertive } = dataImportMessage(summary);
        announce(message, assertive ? { assertive: true } : undefined);
        await pv.mountProfile(viewEl, host);
      },
    })).catch((err: unknown) => {
      announce(tRaw('Could not import {name}: {message}', { name: file.name, message: (err as Error)?.message ?? String(err) }), { assertive: true });
    });
  });
}
/** Load the Storage card when it is first expanded. */
export function wireStorageToggle(pv: ProfileViewCtx): void {
  const { storageDetails } = pv;
  storageDetails?.addEventListener('toggle', () => { if (storageDetails!.open) pv.storage.loadStorage(); });
  // A persisted-open section renders open from the HTML `open` attribute, which does
  // NOT fire `toggle`, so kick the lazy load here (runs after first paint).
  if (storageDetails?.open) pv.storage.loadStorage();
}

export function storageOps(pv: ProfileViewCtx) {
  return {
    refreshCounter: bindOp(pv, refreshCounter),
    toolNameOf: bindOp(pv, toolNameOf),
    reduceMotion: bindOp(pv, reduceMotion),
    measurePreviews: bindOp(pv, measurePreviews),
    measure: bindOp(pv, measure),
    renderSection: bindOp(pv, renderSection),
    loadStorage: bindOp(pv, loadStorage),
    wireStorageToggle: bindOp(pv, wireStorageToggle),
  };
}
