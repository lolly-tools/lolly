// SPDX-License-Identifier: MPL-2.0
/**
 * Apply + persist a theme switch - the shared tail every theme UI runs once the
 * user picks a theme (component-audit rec 12; the theme control itself is
 * reimplemented ~4x: the stage HUD's cycle button, its `.view-seg` popover
 * variant, the mobile profile menu's segment group, and the profile view's
 * Appearance cards). Each copy did the same three things after picking a
 * theme id: flip the DOM/localStorage mirror (applyTheme), play the theme's
 * sting, then best-effort persist to the profile - the canonical store; a
 * failed write still leaves the theme applied (applyTheme already mirrored it
 * to localStorage). This unifies only that tail - every call site still owns
 * its own pressed/active-state repaint, since that markup differs per UI.
 */
import { applyTheme } from '../theme.ts';
import { playThemeSfx } from './sfx.ts';

export interface SetThemeHost {
  profile: {
    // The stored theme rides the profile record; treat it as opaque here (an
    // object we spread), so any host Profile type satisfies this weak slice.
    // `set` is optional: profile.ts's ProfileHost only asserts it present at
    // the web shell's runtime (it's a web-bridge extension, not on HostV1) - 
    // matching that keeps every call site's existing host type assignable.
    get(): Promise<object>;
    set?(profile: object): Promise<unknown>;
  };
}

export async function setTheme(host: SetThemeHost, theme: string): Promise<void> {
  applyTheme(theme);
  playThemeSfx(theme); // theme switch always sings - user-initiated, so never on boot
  try {
    const profile = await host.profile.get();
    await host.profile.set?.({ ...profile, theme });
  } catch { /* preference save is best-effort */ }
}
