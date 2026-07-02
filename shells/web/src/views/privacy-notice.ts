// SPDX-License-Identifier: MPL-2.0
/**
 * One-time privacy transparency notice (web/PWA shell only).
 *
 * Lolly stores only strictly-necessary, first-party data on the device — the
 * theme preference, a few UI prefs, an offline catalog cache, local-only vanity
 * counters (metrics.js — never transmitted), and the user's own tool documents
 * (IndexedDB via host.state). No cookies, no tracking, no third parties, nothing
 * sent anywhere. Under the ePrivacy Directive (Art. 5(3)) storage that is
 * strictly necessary for the service the user asked for needs no consent — only
 * transparency. So this is a dismissible *notice*, not an accept/reject gate:
 * there is nothing non-essential to refuse.
 *
 * The dismissal flag itself is the textbook example of strictly-necessary
 * storage (it remembers that you closed the notice), so it persists in
 * localStorage without any consent of its own.
 *
 * The /info docs site is intentionally NOT covered by this — it sets no cookies
 * and writes only `theme` to localStorage for its dark-mode toggle, which is the
 * same strictly-necessary preference storage. See docs/privacy.md.
 */

const ACK_KEY = 'lolly-privacy-ack';

/** True once the user has dismissed the notice (or if storage is unavailable —
 *  nothing is being persisted in that case, so there's nothing to disclose). */
export function privacyNoticeAcknowledged(): boolean {
  try { return localStorage.getItem(ACK_KEY) === '1'; }
  catch { return true; }
}

/** Markup for the notice, or '' when already acknowledged. Render this directly
 *  before the gallery footer; it positions itself just above the footer bar. */
export function privacyNoticeMarkup(): string {
  if (privacyNoticeAcknowledged()) return '';
  return `
    <aside class="privacy-notice" role="note" aria-label="Privacy">
      <p class="privacy-notice-text">
        Everything stays on your device — no tracking, no accounts.
        <a href="/info/privacy.html" class="privacy-notice-link">What we store</a>
      </p>
      <button type="button" class="privacy-notice-dismiss btn">Got it</button>
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

  // Sit exactly on top of the footer — measure it rather than hard-code a height
  // that the safe-area inset and wrapped controls would make wrong on mobile.
  const footer = viewEl.querySelector<HTMLElement>('.gallery-footer');
  let ro: ResizeObserver | undefined;
  if (footer && typeof ResizeObserver !== 'undefined') {
    const syncOffset = () => notice.style.setProperty('--footer-h', `${footer.offsetHeight}px`);
    syncOffset();
    ro = new ResizeObserver(syncOffset);
    ro.observe(footer);
  }

  notice.querySelector<HTMLButtonElement>('.privacy-notice-dismiss')?.addEventListener('click', () => {
    try { localStorage.setItem(ACK_KEY, '1'); } catch { /* storage blocked — just won't persist */ }
    ro?.disconnect();
    notice.remove();
    viewEl.classList.remove('has-privacy-notice');
  });
}
