// SPDX-License-Identifier: MPL-2.0
/**
 * First-visit personalisation nudge (web/PWA shell only).
 *
 * A one-time, dismissible toast in the gallery's top-right corner inviting the
 * user to opt in to "use my details" - the profile.useDetails flag that lets the
 * profile-bound tools (bindToProfile) pre-fill and personalise their output (see
 * ../personalize-previews.ts). It *links* to the profile page, where the opt-in
 * control lives; it never flips the flag on the user's behalf.
 *
 * It is a gentle prompt, not a gate:
 *   - shown once - the "seen it" flag rides the PROFILE (profile.personalizeNudge-
 *     Dismissed), not device storage, so it's per-user and travels in the backup,
 *     the same way useDetails / favourites / theme do;
 *   - suppressed entirely once the user has already opted in (nothing to nudge);
 *   - one banner per visit: the gallery's first-run ladder gives the slot to the
 *     privacy notice first and to the offline nudge only when this one passed
 *     (plans/137 A1), so it never shares a paint with either.
 *
 * Placement is the stylesheet's (parts/gallery.css): a fixed top-right toast on
 * a desktop, an in-flow full-width card at the top of the gallery content at
 * <=640px, where a quarter of the viewport is too much to hold for a nudge
 * (plans/137 A4). Same markup and the same flags in both.
 */

import type { Profile } from '@lolly-tools/core/host-v1';
import { t } from '../i18n.ts';

/** The slice of the host this module writes through - the web shell's profile
 *  setter (host.profile.set, not on the tool-facing ProfileAPI). */
interface NudgeHost {
  profile: { get(): Promise<Profile>; set(profile: Profile): Promise<void> };
}

// Lucide "sparkles" - a light decorative cue that this is about personalisation.
const SPARKLE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .962 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.962 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/></svg>';

/**
 * Markup for the nudge, or '' when it shouldn't show - already seen/dismissed, or
 * the user has already opted in (there's nothing left to nudge). Render this
 * inside the gallery; it positions itself fixed in the top-right.
 */
export function personalizeNudgeMarkup(profile: Profile | null | undefined): string {
  if (profile?.useDetails) return '';                 // already opted in
  if (profile?.personalizeNudgeDismissed) return '';  // already seen it
  return `
    <aside class="personalize-nudge" role="note" aria-label="${t('Personalise your assets')}">
      <button type="button" class="personalize-nudge-close" aria-label="${t('Dismiss')}">&times;</button>
      <span class="personalize-nudge-icon" aria-hidden="true">${SPARKLE_ICON}</span>
      <div class="personalize-nudge-body">
        <p class="personalize-nudge-title">${t('Add your details to what you make?')}</p>
        <p class="personalize-nudge-text">${t('They stay on this device. Tools fill them in for you, and you choose what goes into every file.')}</p>
        <div class="personalize-nudge-actions">
          <a href="#/profile?focus=use-details" class="personalize-nudge-cta">${t('Set up my details')}</a>
          <button type="button" class="personalize-nudge-dismiss">${t('Not now')}</button>
        </div>
      </div>
    </aside>
  `;
}

/**
 * Wire the nudge once it's in the DOM: dismiss (× or "Not now") persists the
 * "seen" flag to the profile and removes the toast; following the CTA also marks
 * it seen - they've acted on it - but lets the hash navigation proceed. No-op when
 * the nudge isn't present (already seen / opted in). The write is best-effort and
 * fire-and-forget: the toast comes down instantly regardless.
 */
export function mountPersonalizeNudge(viewEl: HTMLElement, host: NudgeHost): void {
  const nudge = viewEl.querySelector<HTMLElement>('.personalize-nudge');
  if (!nudge) return;

  const persist = () => {
    void (async () => {
      try {
        const current = await host.profile.get();
        if (current.personalizeNudgeDismissed) return;   // already recorded
        await host.profile.set({ ...current, personalizeNudgeDismissed: true });
      } catch { /* best-effort - a failed write just means it may show once more */ }
    })();
  };
  const dismiss = () => { persist(); nudge.remove(); };

  nudge.querySelector<HTMLButtonElement>('.personalize-nudge-close')?.addEventListener('click', dismiss);
  nudge.querySelector<HTMLButtonElement>('.personalize-nudge-dismiss')?.addEventListener('click', dismiss);
  // The CTA is a hash link - don't preventDefault; just remember they acted so it
  // doesn't reappear when they return to the gallery.
  nudge.querySelector<HTMLAnchorElement>('.personalize-nudge-cta')?.addEventListener('click', persist);
}
