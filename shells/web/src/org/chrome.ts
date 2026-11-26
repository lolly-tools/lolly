// SPDX-License-Identifier: MPL-2.0
/** Render declarative workspace notices as data in the profile notification queue. */

import { t } from '../i18n.ts';
import { safeHref } from '../utils.ts';
import { getInstanceBase } from '../lib/instance.ts';
import { publishNotification } from '../lib/notifications.ts';
import { viewingAs } from './view-as.ts';
import type { ChromeInjectable } from './index.ts';

/** Slots the shell renders TODAY. An unwired slot renders nothing (fail-closed),
 *  which is what keeps `nav`/`panel` descriptors dormant until those regions exist. */
const WIRED: ReadonlySet<ChromeInjectable['slot']> = new Set(['banner']);

let mounted = false;
const cleanups: Array<() => void> = [];

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
  // The queue is independent of the current view.
  if (rendered > 0) mounted = true;
}

function renderBanner(d: ChromeInjectable): boolean {
  cleanups.push(publishNotification({ id: `chrome:${getInstanceBase()}:${d.id}`, title: d.title || t('Workspace notice'),
    body: d.text, tone: d.tone === 'warn' ? 'warning' : d.tone === 'accent' ? 'action' : 'info',
    ...(d.link?.label && safeHref(d.link.href) ? { action: { label: d.link.label, href: d.link.href } } : {}),
    onDismiss: () => rememberDismissed(d.id) }));
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
  // A view shows the partner's notices whatever this browser's own person closed.
  if (viewingAs()) return false;
  return readDismissed().includes(id);
}
function rememberDismissed(id: string): void {
  // Viewing as a partner: the bar closes for now, and no dismissal is recorded for them.
  if (viewingAs()) return;
  try {
    const ids = readDismissed();
    if (!ids.includes(id)) localStorage.setItem(dismissKey(), JSON.stringify([...ids, id]));
  } catch { /* best-effort */ }
}

/** TEST-ONLY: reset the once-per-session guard. */
export function _resetChromeForTests(): void {
  mounted = false;
  cleanups.splice(0).forEach(clear => { clear(); });
}
