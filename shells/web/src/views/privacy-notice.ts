// SPDX-License-Identifier: MPL-2.0
/**
 * One-time privacy transparency notice (web/PWA shell only).
 *
 * Lolly stores only strictly-necessary, first-party data on the device - the
 * theme preference, a few UI prefs, an offline catalog cache, local-only vanity
 * counters (metrics.js - never transmitted), and the user's own tool documents
 * (IndexedDB via host.state). No cookies, no tracking, no analytics. Nothing
 * leaves the device unless the user starts a feature that needs the internet:
 * adding a Google Font in the brand editor (one consented fetch to Google's
 * font servers, then kept on-device) or playing the opt-in net-radio (SomaFM).
 * Both are disclosed with specifics in docs/privacy.md - keep that list and
 * this comment in sync with the code (SUSE assessment 2026-08, P1: an absolute
 * "nothing sent anywhere" claim is broader than the code supports).
 * Under the ePrivacy Directive (Art. 5(3)) storage that is
 * strictly necessary for the service the user asked for needs no consent - only
 * transparency. So this is a dismissible *notice*, not an accept/reject gate:
 * there is nothing non-essential to refuse.
 *
 * The dismissal flag itself is the textbook example of strictly-necessary
 * storage (it remembers that you closed the notice), so it persists in
 * localStorage without any consent of its own.
 *
 * The /info docs site is intentionally NOT covered by this - it sets no cookies
 * and writes only `theme` to localStorage for its dark-mode toggle, which is the
 * same strictly-necessary preference storage. See docs/privacy.md.
 */

import { docsAppHref, t, tRaw } from '../i18n.ts';
import { getSessionSource } from '../lib/session-source.ts';
import { escapeHtml } from '../lib/util/escape.ts';
import { isTauriShell } from '../lib/instance-choice.ts';

const ACK_KEY = 'lolly-privacy-ack';

/** True once the user has dismissed the notice (or if storage is unavailable - 
 *  nothing is being persisted in that case, so there's nothing to disclose). */
export function privacyNoticeAcknowledged(): boolean {
  try { return localStorage.getItem(ACK_KEY) === '1'; }
  catch { return true; }
}

/** Record that the notice has been seen. Also called by the first-run welcome,
 *  which carries the same one-liner in its footer (plans/137 A2) - a user who
 *  dismissed that dialog has read the line, so the strip has nothing to add. */
export function ackPrivacyNotice(): void {
  try { localStorage.setItem(ACK_KEY, '1'); } catch { /* storage blocked - just won't persist */ }
}

/**
 * With a workspace connected, the notice says what that workspace keeps, because the
 * plain line ("stay on this device") is no longer the whole story: what the person
 * saves to its projects or shares through it (comments, uploads, links, approval
 * requests, collabs) goes there, and the workspace audits sign-ins and the actions
 * taken there. The app itself sends no usage events (no call to the workspace's
 * telemetry route), so "no tracking or analytics" still holds for Lolly itself. With no
 * workspace, every word of the notice is unchanged.
 */
export function workspacePrivacyLine(workspace: string): string {
  return isTauriShell()
    ? tRaw('{workspace} keeps what you save to its projects or share through it, and a log of your sign-ins and what you do there. Everything else stays on this device. Lolly itself has no tracking or analytics.', { workspace })
    : tRaw('{workspace} keeps what you save to its projects or share through it, and a log of your sign-ins and what you do there. Everything else stays in this browser. Lolly itself has no tracking or analytics.', { workspace });
}

/** Where "What we store" goes with a workspace connected: the privacy page's section on
 *  organisation services, which lists what such a workspace holds. */
export const WORKSPACE_PRIVACY_HREF = `${docsAppHref('trust/privacy')}?h=organisation-services-with-lolly-work`;

/** The connected workspace's name, or undefined when there is none. */
export function connectedWorkspace(): string | undefined {
  return getSessionSource()?.label || undefined;
}

/** The notice's sentence and link for the state the app is in now. */
function noticeCopy(): { text: string; href: string } {
  const workspace = connectedWorkspace();
  return workspace
    ? { text: workspacePrivacyLine(workspace), href: WORKSPACE_PRIVACY_HREF }
    : { text: t('Your designs and files stay on this device - no tracking, no analytics.'), href: docsAppHref('trust/privacy') };
}

/** Markup for the notice, or '' when already acknowledged. Anywhere in the
 *  gallery will do - it is fixed-positioned and pins itself above the footer
 *  bar (the gallery renders it in its one first-run banner slot). */
export function privacyNoticeMarkup(): string {
  if (privacyNoticeAcknowledged()) return '';
  const copy = noticeCopy();
  return `
    <aside class="privacy-notice" role="note" aria-label="${t('Privacy')}">
      <p class="privacy-notice-text">
        <span class="privacy-notice-line">${escapeHtml(copy.text)}</span>
        <a href="${copy.href}" class="privacy-notice-link">${t('What we store')}</a>
      </p>
      <button type="button" class="privacy-notice-dismiss btn">${t('Got it')}</button>
    </aside>
  `;
}

/**
 * Wire the notice once the gallery is in the DOM: pin it just above the (fixed)
 * footer by tracking the footer's live height, and dismiss on click. No-op when
 * the notice isn't present (already acknowledged).
 */
export function mountPrivacyNotice(viewEl: HTMLElement): void {
  const notice = viewEl.querySelector<HTMLElement>('.privacy-notice');
  if (!notice) return;

  viewEl.classList.add('has-privacy-notice');

  // Sit exactly on top of the footer - measure it rather than hard-code a height
  // that the safe-area inset and wrapped controls would make wrong on mobile. The
  // bar is a shell-level singleton OUTSIDE #view now (plans/99 M1), so query the
  // document, not the view - and re-query it on each sync rather than closing over
  // one node, because search-bar.ts REPLACES the footer on a claim/release.
  //   A zero height is never written: bottom would resolve to -1px and park the
  // notice behind the fixed bar (z-index 49 vs 50), which is exactly how the strip
  // stayed invisible on a 390px phone while still unacknowledged - it was measured
  // against a hidden or already-swapped-out bar. Dropping the property instead
  // falls back to the sheet's own 3.4rem, so the notice is always somewhere
  // visible (plans/137 A2). The gallery now also mounts this after it has claimed
  // the bar, so the first measurement sees the footer the user will actually see.
  const syncOffset = () => {
    const bar = document.querySelector<HTMLElement>('.gallery-footer');
    const h = bar && !bar.hidden ? bar.offsetHeight : 0;
    if (h) notice.style.setProperty('--footer-h', `${h}px`);
    else notice.style.removeProperty('--footer-h');
  };
  const footer = document.querySelector<HTMLElement>('.gallery-footer');
  let ro: ResizeObserver | undefined;
  syncOffset();
  if (footer && typeof ResizeObserver !== 'undefined') {
    // Observing a hidden bar is deliberate: going from hidden to shown is a size
    // change, so the callback corrects the fallback height on its own.
    ro = new ResizeObserver(syncOffset);
    ro.observe(footer);
  }

  notice.querySelector<HTMLButtonElement>('.privacy-notice-dismiss')?.addEventListener('click', () => {
    ackPrivacyNotice();
    ro?.disconnect();
    notice.remove();
    viewEl.classList.remove('has-privacy-notice');
  });

  // A workspace can connect after the gallery's first paint. Read again shortly and
  // swap the line once one is known; with none, the plain line stays as it is.
  if (!connectedWorkspace()) {
    for (const ms of NOTICE_RECHECK_MS) setTimeout(() => showWorkspaceLine(notice), ms);
  }
}

/** How long after mount the notice looks again for a workspace that connected late. */
const NOTICE_RECHECK_MS = [1500, 5000, 12000];

/** Swap a mounted notice to the connected wording, once. Exported for tests. */
export function showWorkspaceLine(notice: HTMLElement): void {
  const workspace = connectedWorkspace();
  if (!workspace || !notice.isConnected || notice.dataset.workspace) return;
  notice.dataset.workspace = workspace;
  const line = notice.querySelector<HTMLElement>('.privacy-notice-line');
  if (line) line.textContent = workspacePrivacyLine(workspace);
  notice.querySelector<HTMLAnchorElement>('.privacy-notice-link')?.setAttribute('href', WORKSPACE_PRIVACY_HREF);
}
