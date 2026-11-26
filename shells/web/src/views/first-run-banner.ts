// SPDX-License-Identifier: MPL-2.0
/**
 * The gallery's one non-modal first-run slot (plans/137 A1): the privacy notice,
 * else the personalise nudge, else the offline nudge. Each candidate keeps its own
 * flags and copy; this only decides which one gets the slot.
 *
 * While an admin is viewing the app as a partner (org/view-as.ts) there is no slot.
 * The banners belong to this browser's own person: answering one would record a
 * dismissal on the partner's behalf, and setting up offline would cache the
 * partner's catalog in this browser.
 */
import type { Profile } from '@lolly-tools/core/host-v1';
import { viewingAs } from '../org/view-as.ts';
import { offlineNudgeMarkup } from './offline-nudge.ts';
import { personalizeNudgeMarkup } from './personalize-nudge.ts';
import { privacyNoticeMarkup } from './privacy-notice.ts';

/** The banner markup for this visit, or '' when nothing takes the slot. */
export function firstRunBannerMarkup(profile: Profile | null | undefined, programmeMember: boolean): string {
  if (viewingAs()) return '';
  return privacyNoticeMarkup() || (programmeMember ? '' : personalizeNudgeMarkup(profile)) || offlineNudgeMarkup(profile);
}
