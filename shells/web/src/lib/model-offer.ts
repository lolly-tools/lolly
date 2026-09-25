// SPDX-License-Identifier: MPL-2.0
/**
 * The in-context model offer: a feature that needs an on-device model calls
 * `ensureModel(part, { reason })` from the click that asked for it, and the person
 * gets the download right there instead of being sent to Profile.
 *
 *   - ready already: resolves true, shows nothing;
 *   - forbidden by the AI policy, or not served by the model host: resolves false
 *     with a short notice in words, no sheet;
 *   - missing: one small sheet (mountModal) names the part, what needs it and the
 *     size, and offers Download or Not now. Download closes the sheet and runs the
 *     part's own downloader through lib/offline-run.ts, so the job toast is the one
 *     place that shows progress and cancel, Profile's live bar sees the same run,
 *     and the downloader records the part so Profile's row reads Downloaded
 *     afterwards. The promise resolves true when the model is ready, false when the
 *     download fails or is cancelled (the toast says which). Not now resolves false
 *     and the caller keeps its fallback.
 *
 * Rules the sheet keeps: it never opens before the person has interacted with the
 * page (the caller calls from a gesture; sticky activation is checked as a floor),
 * and at most one sheet per part: concurrent calls for the same part share one
 * promise. An import flow that must not be interrupted calls holdModelOffers() for
 * its duration; while a hold is live an offer resolves false with a notice instead
 * of opening a sheet over it.
 */
import '../styles/parts/model-offer.css';
import { t, tRaw } from '../i18n.ts';
import { announce } from '../a11y.ts';
import { escape as escapeHtml } from '../utils.ts';
import { mountModal, type ModalHandle } from '../components/modal.ts';
import { fmtBytes } from './format.ts';
import { beginOfflineRun } from './offline-run.ts';
import type { DownloadProgress, OnProgress } from './offline-manager.ts';
import { downloadModelPart, modelPartInfo, modelPrecache, type ModelPartId, type ModelPartInfo } from './model-parts.ts';
import { showUndoToast } from './undo-toast.ts';

export interface EnsureModelOpts {
  /** What needs the model, as a short noun phrase shown after "needed for:"
   *  ("Reading text in slide pictures"). Without one the sheet states the size. */
  reason?: string;
}

interface OfferDeps {
  info: (id: ModelPartId) => Promise<ModelPartInfo>;
  download: (id: ModelPartId, opts: { signal: AbortSignal; onProgress: OnProgress }) => Promise<unknown>;
  notify: (message: string) => void;
  /** Has the person interacted with the page yet? */
  activated: () => boolean;
}

const DEFAULT_DEPS: OfferDeps = {
  info: (id) => modelPartInfo(id),
  download: async (id, opts) => downloadModelPart(id, await modelPrecache(), opts),
  // The toast is role=status, so it speaks the notice itself.
  notify: (message) => { showUndoToast({ message, undo: () => {}, actionLabel: t('Dismiss') }); },
  activated: () => {
    const ua = (globalThis.navigator as { userActivation?: { hasBeenActive: boolean } } | undefined)?.userActivation;
    return ua ? ua.hasBeenActive : true;
  },
};
let deps: OfferDeps = DEFAULT_DEPS;

/** Test hook: replace one or more dependencies; call with no argument to restore them. */
export function __setModelOfferDepsForTest(next?: Partial<OfferDeps>): void {
  deps = next ? { ...DEFAULT_DEPS, ...next } : DEFAULT_DEPS;
  pending.clear();
  holds = 0;
}

const pending = new Map<ModelPartId, Promise<boolean>>();
let holds = 0;

/** Hold offers back while an import runs: an offer asked for meanwhile resolves
 *  false with a notice instead of opening a sheet over the import. Returns the
 *  release; calling it twice is harmless. */
export function holdModelOffers(): () => void {
  holds++;
  let released = false;
  return () => { if (!released) { released = true; holds = Math.max(0, holds - 1); } };
}

/** Make sure a model part is on this device, offering the download in place when
 *  it is not. Resolves true once the model is ready, false otherwise. */
export function ensureModel(part: ModelPartId, opts: EnsureModelOpts = {}): Promise<boolean> {
  const live = pending.get(part);
  if (live) return live;
  const p = decide(part, opts).finally(() => { pending.delete(part); });
  pending.set(part, p);
  return p;
}

async function decide(part: ModelPartId, opts: EnsureModelOpts): Promise<boolean> {
  const info = await deps.info(part);
  if (info.ready === true) return true;
  if (!info.allowed) {
    deps.notify(t('AI downloads are disabled by your service policy.'));
    return false;
  }
  if (!info.available) {
    deps.notify(tRaw('{name} can’t be downloaded here right now.', { name: info.label }));
    return false;
  }
  if (holds > 0) {
    deps.notify(t('Wait for the import to finish, then try again.'));
    return false;
  }
  if (!deps.activated()) {
    // No gesture yet, so no sheet opens on its own; the person is told how to get it.
    deps.notify(tRaw('Press again to download {name}.', { name: info.label }));
    return false;
  }
  return offer(part, info, opts);
}

/** The sheet's one sentence: the size and what needs it, when each is known. The
 *  reason stays its own clause after the colon, so it translates on its own. */
export function offerSentence(info: Pick<ModelPartInfo, 'bytes'>, reason?: string): string {
  const size = info.bytes ? fmtBytes(info.bytes) : '';
  if (reason) {
    return size
      ? tRaw('{size} download, needed for: {feature}.', { feature: reason, size })
      : tRaw('Needed for: {feature}.', { feature: reason });
  }
  return size ? tRaw('This is a {size} download.', { size }) : t('Download it once to use it.');
}

function offer(part: ModelPartId, info: ModelPartInfo, opts: EnsureModelOpts): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    let started = false;
    const content = `
      <h2 class="modal-title">${escapeHtml(info.label)}</h2>
      <p class="modal-msg">${escapeHtml(offerSentence(info, opts.reason))}</p>
      <p class="mo-note">${escapeHtml(t('The model stays on this device. What you give it never leaves.'))}</p>
      <p class="mo-error" data-error role="alert" hidden></p>
      <div class="modal-actions">
        <button type="button" class="btn modal-cancel" data-act="later">${escapeHtml(t('Not now'))}</button>
        <button type="button" class="btn modal-primary" data-act="download">${escapeHtml(t('Download'))}</button>
      </div>`;

    const modal: ModalHandle<void> = mountModal<void>(content, {
      className: 'modal model-offer',
      ariaLabel: info.label,
      initialFocus: (el) => el.querySelector<HTMLElement>('[data-act="download"]'),
      // Esc, the backdrop and Not now all mean no; Download settles through run().
      onClose: () => { if (!started) resolve(false); },
    });
    const el = modal.el;
    const error = el.querySelector<HTMLElement>('[data-error]')!;

    const start = (): void => {
      if (started) return;
      const run = beginOfflineRun(tRaw('Downloading: {name}', { name: info.label }));
      if (!run) {
        error.textContent = t('Another download is running. Try again when it finishes.');
        error.hidden = false;
        return;
      }
      started = true;
      // One progress display: the job toast carries the bar, the counts and the
      // cancel from here, so the sheet closes and focus returns to the caller.
      modal.close();
      void (async () => {
        try {
          await deps.download(part, {
            signal: run.signal,
            onProgress: (p: DownloadProgress) => run.report({ label: info.label, loaded: p.loaded, total: p.total, unit: 'bytes' }),
          });
        } catch {
          run.end(run.cancelled ? undefined : t('The download did not finish. Check your connection and try again.'));
          resolve(false);
          return;
        }
        run.end();
        announce(tRaw('{name} is on this device.', { name: info.label }));
        resolve(true);
      })();
    };

    el.addEventListener('click', (e) => {
      const act = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-act]')?.dataset.act : undefined;
      if (act === 'later') modal.close();
      else if (act === 'download') start();
    });
  });
}
