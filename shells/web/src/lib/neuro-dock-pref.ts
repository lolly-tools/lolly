// SPDX-License-Identifier: MPL-2.0
/**
 * The collapsed/expanded preference for the Neurospicy toast dock, split out of
 * components/neuro-dock.ts so a caller can READ it without importing the dock.
 *
 * WHY: sound-toggle.ts builds its popover markup synchronously and needs to know
 * whether to offer the mobile "Show player" button. That one synchronous read was
 * the entire reason sound-toggle statically imported neuro-dock.ts - which drags
 * components/music-player.ts (~7 KB gz) onto the boot path for every visitor,
 * including the overwhelming majority who have never switched Neurospicy on
 * (lib/neurospicy.ts's DEFAULTS are `{ enabled: false }`). With the read here,
 * every remaining neuro-dock use in sound-toggle sits inside a click handler and
 * can be a dynamic import.
 *
 * This is one of the few sanctioned localStorage keys - a pure UI chrome
 * preference, never tool state (house rule: tool state goes through host.state).
 * Same key and same semantics as before the split; it must stay defined once.
 */
const COLLAPSE_KEY = 'lolly:neuroDockCollapsed';

/** Is the dock collapsed? (On mobile, collapsed = hidden - see the "Show player" button.) */
export function isNeuroDockCollapsed(): boolean {
  try { return localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; }
}

export function setNeuroDockCollapsed(v: boolean): void {
  try { localStorage.setItem(COLLAPSE_KEY, v ? '1' : '0'); } catch { /* best-effort */ }
}
