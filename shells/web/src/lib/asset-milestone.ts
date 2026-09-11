// SPDX-License-Identifier: MPL-2.0
/**
 * Friendly, one-shot nudges as a user's device image library grows.
 *
 * There is no cap on uploads (see bridge/assets.ts) - the library is the user's
 * to fill. But device images are exactly that: on THIS device. They're never
 * uploaded and don't travel inside share links, so an image only reaches someone
 * else once it's rendered into a file - and images everyone should always have
 * belong in the catalog. As the library crosses each milestone we surface that
 * once, informationally, so nobody is surprised later.
 *
 * Called (fire-and-forget) after every successful upload - storeUserUpload() is
 * the single choke point for every add path (picker, profile, tool, imports,
 * webcam), so one call there covers them all.
 */
import { USER_ASSET_MILESTONES } from '../bridge/assets.ts';
import { noticeDialog } from '../components/confirm-dialog.ts';

// Which milestones we've already shown, so a nudge fires once per threshold and a
// bulk import that jumps past several never nags for each one on the way up.
const SEEN_KEY = 'lolly-asset-milestones-seen';

/** The bridge surface the nudge needs - a lightweight count of stored user assets. */
interface CountHost {
  assets: { _userAssetsCount(): Promise<number> };
}

function readSeen(): number[] {
  try {
    const raw = JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((n): n is number => typeof n === 'number') : [];
  } catch {
    return []; // storage off / private mode - treat as "nothing seen yet"
  }
}

export async function maybeNudgeAssetMilestone(host: CountHost): Promise<void> {
  let count: number;
  try {
    count = await host.assets._userAssetsCount();
  } catch {
    return; // count unavailable - never let a nudge break an upload
  }
  // _userAssetsCount() includes the reserved profile headshot; the ±1 is immaterial
  // at these milestones, so we don't special-case it.

  const seen = readSeen();
  const crossed = USER_ASSET_MILESTONES.filter(m => count >= m && !seen.includes(m));
  if (!crossed.length) return;

  // Mark every crossed milestone seen at once - a jump past several fires only the
  // highest, and none of them re-nags later.
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...new Set([...seen, ...crossed])]));
  } catch { /* storage off - worst case the nudge repeats next session */ }

  const top = Math.max(...crossed);
  await noticeDialog({
    title: `${top}+ images saved to this device`,
    message: [
      `Nice - you've now saved ${count} images to reuse across your tools.`,
      `A heads-up on how these work: they live only on this device. They're never uploaded, and they don't travel inside share links - send someone a link and your images won't come with it.`,
      `To hand an image to someone else, render it to a file (Export) and send that file.`,
      `Want some images to always be available to everyone? Ask your Lolly manager about adding them to the catalog.`,
    ],
    okLabel: 'Got it',
  });
}
