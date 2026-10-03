// SPDX-License-Identifier: MPL-2.0
/**
 * org/team-back - the one look for a "← Back" control inside the Team projects
 * dialog, shared by its sessions screen (org/team-projects.ts) and the People screen
 * (org/team-people.ts), so the two back steps of one dialog read as the same control.
 *
 * A text button in the muted colour, sized with the type scale (so Large text grows
 * it) and at least 44px tall, the same touch target as the dialog's rows.
 */

export const TEAM_BACK_STYLE = 'display:inline-flex;align-items:center;min-height:44px;padding:0 .4rem;margin:0 0 .1rem -.4rem;background:none;border:0;border-radius:var(--radius);color:hsl(var(--muted-foreground));cursor:pointer;font:inherit;font-size:var(--fs-md)';

/** Give a button the shared back look. Returns the same button. */
export function styleTeamBack<B extends HTMLButtonElement>(b: B): B {
  b.style.cssText = TEAM_BACK_STYLE;
  return b;
}
