// SPDX-License-Identifier: MPL-2.0
/**
 * Profile view — personal details + appearance preferences.
 *
 * Theme selection auto-saves on click (it's a preference, not a form field).
 * The other personal details save on form submit.
 *
 * Activity / Storage / Feature flags are collapsible sections, collapsed by
 * default. Storage is also LAZY: its expensive work (storage estimate, asset
 * listing/sizes, and the image-thumbnail grid) is deferred until the section is
 * expanded, so first paint only awaits the profile + headshot.
 */

import { getMetrics } from '../../metrics.ts';
import { closeConfirmDialogs } from '../../components/confirm-dialog.ts';
import { renderProfileCard, renderFeatureFlags, wireProfileEditing } from './edit.ts';
import { renderActivity } from './activity.ts';
import { COLLAPSE_CHEV, mountStorageSection } from './storage.ts';
import type { WebHost } from '../../bridge/index.ts';

/** A catalog-index tool entry as this view reads it (window.__toolIndex). */
interface IndexedTool {
  id: string;
  name: string;
}

export async function mountProfile(viewEl: HTMLElement, host: WebHost, params = ''): Promise<void> {
  document.title = 'Profile — Lolly';
  // Only the first-paint-critical reads run upfront. The Storage section's heavy
  // work is deferred to loadStorage() (run when the section is first expanded).
  const profile = await host.profile.get();
  const currentTheme = profile.theme ?? localStorage.getItem('theme') ?? 'light';
  // The headshot is a user asset; re-resolve it (the stored object URL goes stale
  // across reloads).
  const headshotRef = profile.headshot?.id ? await host.assets.get(profile.headshot.id).catch(() => null) : null;
  const headshotUrl = headshotRef?.url || '';
  const focusFlags = new URLSearchParams(params).get('focus') === 'feature-flags';
  // Remember which sections were left open, across visits (a UI preference, so it
  // lives in localStorage like the theme — read synchronously before render).
  const OPEN_KEY = 'lolly-profile-open';
  let openState: Record<string, boolean> = {};
  try { openState = JSON.parse(localStorage.getItem(OPEN_KEY) || '{}') || {}; } catch { /* storage blocked */ }
  const startOpen = (id: string): string => (openState[id] ? ' open' : '');

  const tools = (window as Window & { __toolIndex?: { tools?: IndexedTool[] } }).__toolIndex?.tools ?? [];

  viewEl.innerHTML = `
    <a href="#/" class="tools-home home-full">Tools</a>
    <div class="profile-layout">
      <h1 class="visually-hidden">Your profile</h1>

      ${renderProfileCard(profile, currentTheme, headshotUrl)}

      <details class="profile-card profile-collapse profile-activity" id="activity-section"${startOpen('activity-section')}>
        <summary class="profile-collapse-summary"><h2>Your activity</h2>${COLLAPSE_CHEV}</summary>
        <div class="profile-collapse-body">${renderActivity(getMetrics(), tools)}</div>
      </details>

      <details class="profile-card profile-collapse" id="storage-section"${startOpen('storage-section')}>
        <summary class="profile-collapse-summary"><h2>Storage</h2>${COLLAPSE_CHEV}</summary>
        <div class="profile-collapse-body" id="storage-body"><p class="storage-hint-text">Loading…</p></div>
      </details>

      <details class="profile-card profile-collapse" id="feature-flags-section"${(openState['feature-flags-section'] || focusFlags) ? ' open' : ''}>
        <summary class="profile-collapse-summary"><h2>Feature flags</h2>${COLLAPSE_CHEV}</summary>
        <div class="profile-collapse-body">
          ${renderFeatureFlags(profile)}
        </div>
      </details>

      <nav class="profile-bottom-links" aria-label="More">
        <a href="#/capabilities" class="profile-platform-link" aria-label="Capabilities — the full feature set">Capabilities</a>
        <a href="#/platform" class="profile-platform-link" aria-label="Platform — brand colours, fonts &amp; global settings">Platform</a>
      </nav>

    </div>
  `;

  const remount = () => mountProfile(viewEl, host);

  // Storage section — mounted first so wireProfileEditing's onAssetChange has a
  // refresh() to call (the headshot upload/remove paths change user-asset bytes).
  const storageHandle = mountStorageSection(viewEl, host, { remount });

  wireProfileEditing(viewEl, host, {
    focusFlags,
    onAssetChange: () => storageHandle.refresh(),
  });

  // Persist each section's open/closed state across visits.
  for (const id of ['activity-section', 'storage-section', 'feature-flags-section']) {
    const d = viewEl.querySelector<HTMLDetailsElement>('#' + id);
    d?.addEventListener('toggle', () => {
      openState[id] = d.open;
      try { localStorage.setItem(OPEN_KEY, JSON.stringify(openState)); } catch { /* storage blocked */ }
    });
  }

  // The Storage manager opens body-level modals (the shared confirmDialog); tear any
  // down when the router swaps this view out (main.js calls _cleanup) so an orphaned
  // top-layer <dialog> can't block the next view.
  (viewEl as HTMLElement & { _cleanup?: () => void })._cleanup = () => closeConfirmDialogs();
}
