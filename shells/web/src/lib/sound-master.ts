// SPDX-License-Identifier: MPL-2.0
/**
 * Sound on or off for the whole app: the master switch behind the Sound control
 * (components/sound-toggle.ts) and the one other place that may flip it, the music dock's
 * play button on a tune someone shared (lib/neurospicy-dock-host.ts). Kept in lib so the
 * dock can reach it without importing a component.
 *
 * Muting silences interface sounds, the Neurospicy music and the Atmosphere beds together,
 * keeping each one's own preference so un-muting brings back exactly what was playing.
 * Turning sound back on plays a short confirming chirp; turning it off stays silent. The
 * profile is the canonical store (an undeclared `sfxMuted` field), with lib/sfx.ts's
 * localStorage mirror for the next page load.
 */
import { setSfxMuted, playSfx } from './sfx.ts';
import { applyNeurospicy, type NeurospicyHost } from './neurospicy.ts';
import { applyAtmosphere } from './atmosphere.ts';

/** Apply and persist a new mute state everywhere sound comes from. */
export async function applySoundMaster(host: NeurospicyHost, muted: boolean): Promise<void> {
  setSfxMuted(muted);
  if (!muted) playSfx('toggle');
  void applyNeurospicy(host);
  applyAtmosphere(host);
  try {
    const profile = await host.profile.get();
    await host.profile.set({ ...profile, sfxMuted: muted });
  } catch { /* preference save is best-effort */ }
}
