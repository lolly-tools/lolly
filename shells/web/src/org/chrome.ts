// SPDX-License-Identifier: MPL-2.0
/**
 * org/chrome - render a deployment's declarative UI chrome (banners today; nav /
 * panel forward-declared) as DATA, never code.
 *
 * The generalization of org/banner.ts along two axes: from one inbox message to a
 * LIST of descriptors, and from one region to several named slots. Loaded lazily by
 * src/org/index.ts, and only when a member's org-config actually carries a chrome
 * descriptor, so a plain (control-plane-free) deployment never touches this file.
 *
 * A chrome descriptor is inert data - `{ slot, tone?, text, link? }` - rendered
 * through `escape()` into the DOM exactly as the inbox banner renders a message.
 * Nothing from the control plane is ever executed. Slots the shell does not yet
 * render (`nav`, `panel`) fail closed to nothing, so a descriptor for them is
 * forward-compatible and still dormant-safe today.
 */

import { t } from '../i18n.ts';
import { escape, safeHref } from '../utils.ts';
import { getInstanceBase } from '../lib/instance.ts';
import type { ChromeInjectable } from './index.ts';

/** Slots the shell renders TODAY. An unwired slot renders nothing (fail-closed),
 *  which is what keeps `nav`/`panel` descriptors dormant until those regions exist. */
const WIRED: ReadonlySet<ChromeInjectable['slot']> = new Set(['banner']);

let mounted = false;

/**
 * Render every wired, non-dismissed chrome descriptor. Idempotent per session (a
 * second call is a no-op while chrome is already showing), mirroring the banner.
 */
export function mountOrgChrome(injectables: readonly ChromeInjectable[]): void {
  if (mounted) return;
  const chrome = Array.isArray(injectables)
    ? injectables.filter((d): d is ChromeInjectable => d?.kind === 'chrome' && WIRED.has(d.slot))
    : [];
  if (!chrome.length) return; // dormancy - the common path
  const seen = new Set<string>();
  let rendered = 0;
  for (const d of chrome) {
    if (!d.id || seen.has(d.id) || isDismissed(d.id)) continue; // a list, so dedupe by id
    seen.add(d.id);
    if (d.slot === 'banner' && renderBanner(d)) rendered++;
  }
  // Only latch when something actually mounted - if #app wasn't ready, a later call
  // can still render (mirrors banner.ts's not-latching-on-missing-#app discipline).
  if (rendered > 0) mounted = true;
}

/** A single dismissible chrome bar above the app - banner.ts's `showBar`, driven by
 *  `tone` instead of severity, dismissed locally (a descriptor has no ack endpoint).
 *  Returns whether a bar was actually inserted (false when #app isn't ready yet). */
function renderBanner(d: ChromeInjectable): boolean {
  const app = document.getElementById('app');
  const view = document.getElementById('view');
  if (!app) return false;

  const bar = document.createElement('div');
  bar.id = `org-chrome-${escape(d.id)}`;
  bar.className = 'org-chrome org-chrome--banner';
  bar.setAttribute('role', 'note');
  // Theme-aware, self-contained styling - no stylesheet touch for this additive
  // seam. `warn`/`accent` lean on the brand accent; `info` (default) on muted chrome.
  const accent = d.tone === 'warn' || d.tone === 'accent' ? 'var(--primary)' : 'var(--muted-foreground)';
  bar.style.cssText = `display:flex;align-items:center;gap:.75rem;padding:.6rem 1rem;font-size:.9rem;line-height:1.4;border-bottom:1px solid hsl(var(--border));background:hsl(${accent} / .08);color:hsl(var(--foreground))`;

  // A link is rendered only when its href is a safe scheme - a javascript:/data:
  // href is dropped (the text still shows), never turned into a clickable anchor.
  const link = d.link?.label && d.link?.href && safeHref(d.link.href)
    // nosemgrep: lolly-href-escape-is-not-scheme-validation - safeHref()-gated in the condition above
    ? `<a class="btn btn--sm org-chrome-cta" href="${escape(d.link.href)}">${escape(d.link.label)}</a>`
    : '';
  bar.innerHTML = `
    <span style="flex:0 0 auto;width:.5rem;height:.5rem;border-radius:50%;background:hsl(${accent})" aria-hidden="true"></span>
    <span style="flex:1 1 auto;min-width:0">${escape(d.text)}</span>
    ${link}
    <button type="button" class="org-chrome-dismiss" aria-label="${escape(t('Dismiss'))}" style="flex:0 0 auto;border:0;background:transparent;color:inherit;cursor:pointer;font-size:1.2rem;line-height:1;padding:.1rem .3rem;opacity:.7">&times;</button>`;

  app.insertBefore(bar, view ?? null);
  bar.querySelector('.org-chrome-dismiss')?.addEventListener('click', () => {
    bar.remove();
    rememberDismissed(d.id);
  });
  return true;
}

// Dismissals are local + per-instance, mirroring index.ts's own negative-cache keying.
// Best-effort: a storage failure just means the bar can reappear next boot.
const dismissKey = (): string => `lolly:org-chrome-dismissed:${getInstanceBase() || 'same-origin'}`;
function readDismissed(): string[] {
  try {
    const raw = localStorage.getItem(dismissKey());
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : [];
  } catch { return []; }
}
function isDismissed(id: string): boolean {
  return readDismissed().includes(id);
}
function rememberDismissed(id: string): void {
  try {
    const ids = readDismissed();
    if (!ids.includes(id)) localStorage.setItem(dismissKey(), JSON.stringify([...ids, id]));
  } catch { /* best-effort */ }
}

/** TEST-ONLY: reset the once-per-session guard. */
export function _resetChromeForTests(): void {
  mounted = false;
}
