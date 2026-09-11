// SPDX-License-Identifier: MPL-2.0
/**
 * "Interface follows the design system" - the app's own use of the palette
 * (plan 182 section 5.6).
 *
 * `applyChromeBrandVars` (brand-vars.ts) re-tints the shell's accent from the
 * design system's semantic primary. That is the APP helping itself to the
 * palette, and it is secondary to what a palette is for: tools, pages and
 * exports. So it is a preference, and it lives where preferences live - the
 * Appearance card in /profile - rather than in the design system's tokens.
 *
 * Same shape as the theme and the a11y prefs (lib/a11y-prefs.ts): the profile is
 * canonical, this device's storage is the mirror the paint path reads
 * synchronously, and boot reconciles the two. The mirror is what brand-vars
 * consults, because the chrome accent is applied before the profile has resolved
 * and an async profile read per repaint would be a read per colour-wheel frame.
 *
 * DEFAULT ON, and stored only when OFF: an untouched profile and a cleared
 * device both mean "follow", which is the behaviour every install has had.
 *
 * What this never touches: the brand FONTS and the corner radius. A face and a
 * shape are what the design system says the app should look like at all, and
 * they carry no accent - this setting is about the app helping itself to a
 * COLOUR. And nothing inside a tool canvas or an export, ever: those follow the
 * design system whatever this says.
 */

/** localStorage mirror key. Present and '0' means off; absent means follow. */
export const FOLLOW_DS_KEY = 'lolly-follow-ds';

/** Is the app's chrome following the design system's primary right now? */
export function chromeFollowsDesignSystem(): boolean {
  try { return localStorage.getItem(FOLLOW_DS_KEY) !== '0'; }
  catch { return true; }   // storage blocked - the default stands
}

/** Write the mirror. Best-effort: a blocked store just means no restore. */
export function setChromeFollowMirror(on: boolean): void {
  try {
    if (on) localStorage.removeItem(FOLLOW_DS_KEY);
    else localStorage.setItem(FOLLOW_DS_KEY, '0');
  } catch { /* storage unavailable - the live paint already happened */ }
}

/**
 * Boot reconciliation, the profile being canonical. Returns true when the
 * mirror MOVED, which is the caller's cue to repaint the chrome: boot applies
 * the accent from the mirror before this runs (brand-vars is dynamic-imported
 * off the boot path), so a profile that disagrees needs one more pass.
 *
 * An absent value leaves the device's own choice standing - the same rule
 * `hydrateA11yPrefs` keeps, and for the same reason: a profile that has never
 * carried the field must not overwrite a choice made on this device.
 */
export function hydrateChromeFollow(value: boolean | undefined): boolean {
  if (value === undefined) return false;
  const was = chromeFollowsDesignSystem();
  setChromeFollowMirror(value);
  return was !== value;
}

/** The host slice this module persists through - the same weak shape
 *  set-theme.ts and a11y-prefs.ts use. */
export interface ChromeFollowHost {
  profile: {
    get(): Promise<Record<string, unknown>>;
    set?(profile: Record<string, unknown>): Promise<unknown>;
  };
}

/**
 * Flip the pref: mirror first (so the very next paint reads the new answer),
 * then persist to the profile, which is canonical and travels with the person.
 * The repaint is the caller's - views/profile.ts calls applyChromeBrandVars,
 * which is where the colour maths lives.
 */
export async function setChromeFollow(host: ChromeFollowHost, on: boolean): Promise<void> {
  setChromeFollowMirror(on);
  try {
    const profile = await host.profile.get();
    const appearance = { ...(profile.appearance as Record<string, unknown> | undefined), followDesignSystem: on };
    await host.profile.set?.({ ...profile, appearance });
  } catch { /* preference save is best-effort - the chrome is already right */ }
}
