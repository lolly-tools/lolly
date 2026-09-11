// SPDX-License-Identifier: MPL-2.0
/**
 * First-visit offline nudge (web/PWA shell only) - the discoverability half of
 * the "Available offline" download manager (lib/offline-manager.ts).
 *
 * The feature exists for someone with a URL, an hour of airport wifi and a
 * flight - exactly the person who will never dig through the profile page to
 * find it. So the gallery surfaces it once, as a dismissible toast beside the
 * personalisation nudge (personalize-nudge.ts, whose placement and lifecycle
 * this mirrors), deep-linking to #/profile?focus=offline-section.
 *
 * Two copy variants, chosen by how the app is running:
 *   - a browser tab: "works offline once downloaded" - an invitation;
 *   - standalone (installed PWA, display-mode: standalone / iOS
 *     navigator.standalone): "finish installing" - a correction. Installing
 *     puts an icon on the device while precaching only the shell, so
 *     "installed" quietly means "online-only" until the app part is
 *     downloaded. The user must hear that HERE, not mid-flight.
 *
 * Lifecycle rules:
 *   - one at a time: the gallery renders this only when the personalisation
 *     nudge isn't showing (two toasts is nagging, not helping);
 *   - shown once - profile.offlineNudgeDismissed rides the PROFILE like the
 *     personalisation flag, and main.ts RE-CLEARS it on `appinstalled` so the
 *     standalone variant gets one fresh showing after an install;
 *   - self-suppressing: once any offline part or tool pin exists the user has
 *     found the feature, so the mount quietly removes the toast and records
 *     the flag (the markup renders before those async reads can answer).
 */

import type { Profile } from '@lolly-tools/core/host-v1';
import { t } from '../i18n.ts';
import { escape } from '../utils.ts';
import { icon } from '../lib/icons.ts';
// Dynamic for the same reason catalog/sync.ts is: this view is reached from the
// gallery's static graph, but its one read of the download manager happens in the
// async self-suppress check below, well after first paint.
import { pinnedToolBytes } from '../lib/offline-pins.ts';

/** The slice of the host this module writes through - the web shell's profile
 *  setter (host.profile.set, not on the tool-facing ProfileAPI). */
interface NudgeHost {
  profile: { get(): Promise<Profile>; set(profile: Profile): Promise<void> };
}


/** Is this session running as an installed app (not a browser tab)? */
export function runsStandalone(): boolean {
  try {
    return window.matchMedia('(display-mode: standalone)').matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  } catch {
    return false;
  }
}

/**
 * Markup for the nudge, or '' when it shouldn't show - already seen/dismissed.
 * The gallery renders this only when the personalisation nudge isn't showing.
 */
export function offlineNudgeMarkup(profile: Profile | null | undefined): string {
  if (profile?.offlineNudgeDismissed) return '';  // already seen it
  const standalone = runsStandalone();
  const title = standalone
    ? t('Installed - but not all of it yet')
    : t('Lolly works offline');
  const text = standalone
    ? t('The app icon is on your device, but Lolly still needs the internet until you download it. Grab everything now and it works anywhere.')
    : t('Download the app and your tools once, and everything here keeps working with no connection - handy before a flight.');
  return `
    <aside class="personalize-nudge offline-nudge" role="note" aria-label="${escape(t('Offline downloads'))}">
      <button type="button" class="personalize-nudge-close" aria-label="${escape(t('Dismiss'))}">&times;</button>
      <span class="personalize-nudge-icon" aria-hidden="true">${icon('plane')}</span>
      <div class="personalize-nudge-body">
        <p class="personalize-nudge-title">${escape(title)}</p>
        <p class="personalize-nudge-text">${escape(text)}</p>
        <div class="personalize-nudge-actions">
          <a href="#/profile?focus=offline-section" class="personalize-nudge-cta">${t('Set up offline')}</a>
          <button type="button" class="personalize-nudge-dismiss">${t('Not now')}</button>
        </div>
      </div>
    </aside>
  `;
}

/**
 * Wire the nudge once it's in the DOM: dismiss (× or "Not now") persists the
 * "seen" flag and removes the toast; the CTA marks it seen and lets the hash
 * navigation proceed. Additionally, an async self-check removes the toast
 * unprompted when offline downloads already exist - the user found the feature
 * without us. No-op when the nudge isn't present.
 */
export function mountOfflineNudge(viewEl: HTMLElement, host: NudgeHost): void {
  const nudge = viewEl.querySelector<HTMLElement>('.offline-nudge');
  if (!nudge) return;

  const persist = () => {
    void (async () => {
      try {
        const current = await host.profile.get();
        if (current.offlineNudgeDismissed) return;   // already recorded
        await host.profile.set({ ...current, offlineNudgeDismissed: true });
      } catch { /* best-effort - a failed write just means it may show once more */ }
    })();
  };
  const dismiss = () => { persist(); nudge.remove(); };

  nudge.querySelector<HTMLButtonElement>('.personalize-nudge-close')?.addEventListener('click', dismiss);
  nudge.querySelector<HTMLButtonElement>('.personalize-nudge-dismiss')?.addEventListener('click', dismiss);
  nudge.querySelector<HTMLAnchorElement>('.personalize-nudge-cta')?.addEventListener('click', persist);

  // Self-suppress: downloads already on device = nothing left to point at.
  void (async () => {
    try {
      const [parts, pins] = await Promise.all([
        import('../lib/offline-manager.ts').then(m => m.partRecords()),
        pinnedToolBytes(),
      ]);
      if (Object.keys(parts).length || pins.count) dismiss();
    } catch { /* unreadable state - leave the toast up */ }
  })();
}
