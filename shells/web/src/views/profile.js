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

import { applyTheme, THEMES } from '../theme.js';
import { escape } from '../utils.js';
import { announce } from '../a11y.js';
import { MAX_USER_ASSETS } from '../bridge/assets.js';
import { getMetrics } from '../metrics.js';
import { openHeadshotCropper } from '../components/headshot-cropper.js';
import { storeUserUpload } from './picker.js';
import { CATEGORY_FLAGS, PRO_FLAG, flagEnabled } from '../feature-flags.js';
import { saveBlob } from '../pro/zip.js';
import { exportBackup, importBackup } from '../data-transfer.js';
import { confirmDialog, closeConfirmDialogs } from '../components/confirm-dialog.js';
import { relativeTime } from '../folder-tiles.js';

// Friendly labels for the raw profile field keys.
const FIELD_LABELS = {
  firstname: 'First name', lastname: 'Last name', email: 'Email',
  phone: 'Phone', city: 'City', country: 'Country',
};

// Per-field input semantics — the right keyboard on mobile, native validation
// and autofill where it helps. Anything not listed falls back to a plain text
// input (autocomplete off, as before).
const FIELD_ATTRS = {
  firstname: { type: 'text', autocomplete: 'given-name' },
  lastname:  { type: 'text', autocomplete: 'family-name' },
  email:     { type: 'email', inputmode: 'email', autocomplete: 'email' },
  phone:     { type: 'tel', autocomplete: 'tel' },
};
const fieldAttrs = (f) => {
  const a = FIELD_ATTRS[f] ?? { type: 'text', autocomplete: 'off' };
  return Object.entries(a).map(([k, v]) => `${k}="${escape(v)}"`).join(' ');
};

// The headshot lives in the user-assets store under one fixed id (so a new one
// overwrites the old and it only ever occupies a single slot), and is kept out
// of the "My images" library list.
const HEADSHOT_ID = 'user/headshot';

// Randomised word the user must type to confirm the irreversible "clear all my
// data" action — a deliberate speed-bump against an accidental wipe.
const CLEAR_CONFIRM_WORDS = ['lolly', 'open', 'free', 'privacy', 'choice', 'thank you', 'security', 'goodbye'];

// Chevron for a collapsible section's summary (rotates 90° when open via CSS).
const COLLAPSE_CHEV = `<svg class="profile-collapse-chev" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>`;

// A small "i" badge with a hover/focus tooltip — used beside storage headings.
// A real <button> (not a tabbable span) so its role + keyboard focus are native.
const infoDot = (text) =>
  `<button type="button" class="info-dot" aria-label="${escape(text)}">i<span class="info-tip" aria-hidden="true">${escape(text)}</span></button>`;

export async function mountProfile(viewEl, host, params = '') {
  document.title = 'Profile — Lolly';
  // Only the first-paint-critical reads run upfront. The Storage section's heavy
  // work is deferred to loadStorage() (run when the section is first expanded).
  const profile = await host.profile.get();
  const fields = ['firstname', 'lastname', 'email', 'phone', 'city', 'country'];
  const currentTheme = profile.theme ?? localStorage.getItem('theme') ?? 'light';
  // The headshot is a user asset; re-resolve it (the stored object URL goes stale
  // across reloads).
  const headshotRef = profile.headshot?.id ? await host.assets.get(profile.headshot.id).catch(() => null) : null;
  let headshotUrl = headshotRef?.url || '';
  const focusFlags = new URLSearchParams(params).get('focus') === 'feature-flags';
  // Remember which sections were left open, across visits (a UI preference, so it
  // lives in localStorage like the theme — read synchronously before render).
  const OPEN_KEY = 'lolly-profile-open';
  let openState = {};
  try { openState = JSON.parse(localStorage.getItem(OPEN_KEY) || '{}') || {}; } catch { /* storage blocked */ }
  const startOpen = (id) => (openState[id] ? ' open' : '');

  // One toggle row for a feature flag (closes over `profile` for its checked state).
  const flagRow = (f) => `
    <li>
      <label class="feature-flag">
        <span class="feature-flag-label">${escape(f.label)}${f.pill ? `<span class="feature-flag-pill">${escape(f.pill)}</span>` : ''}</span>
        <input type="checkbox" class="feature-flag-input" data-flag="${escape(f.id)}" ${flagEnabled(profile, f.id) ? 'checked' : ''}>
        <span class="feature-flag-switch" aria-hidden="true"></span>
      </label>
    </li>`;

  viewEl.innerHTML = `
    <a href="#/" class="tools-home home-full">Tools</a>
    <div class="profile-layout">
      <h1 class="visually-hidden">Your profile</h1>

      <section class="profile-card">
        <h2>Your details</h2>
        <form class="profile-form" id="profile-form">
          <div class="profile-details-grid">
            <div class="profile-details-main">
              <div class="profile-fields">
                ${fields.map(f => `<label class="profile-field">
                  <span class="profile-field-label">${escape(FIELD_LABELS[f] ?? f)}</span>
                  <input ${fieldAttrs(f)} name="${f}" value="${escape(profile[f] ?? '')}" placeholder=" ">
                </label>`).join('')}
              </div>

              <div class="profile-actions">
                <button type="submit" class="profile-btn-primary">Save Profile</button>
                <label class="profile-check">
                  <span class="profile-check-tag">${profile.useDetails ? 'Opted-in' : 'opt-in'}</span>
                  <input type="checkbox" name="useDetails" ${profile.useDetails ? 'checked' : ''}>
                  <span class="profile-check-text">${profile.useDetails ? 'Using my details' : 'Use my details to create'}</span>
                </label>
              </div>
            </div>

            <aside class="profile-side">
              <div class="profile-field">
                <span class="profile-field-label headshot-heading">Headshot</span>
                <div class="headshot">
                  <div class="headshot-preview${headshotUrl ? '' : ' is-empty'}" id="headshot-preview"${headshotUrl ? ` style="background-image:url('${escape(headshotUrl)}')"` : ''}>
                    <button type="button" class="headshot-edit" id="headshot-upload">${headshotUrl ? 'Edit' : 'Upload'}</button>
                  </div>
                  <button type="button" class="headshot-remove" id="headshot-remove" aria-label="Remove headshot" title="Remove"${headshotUrl ? '' : ' hidden'}>&times;</button>
                  <input type="file" id="headshot-file" accept="image/png,image/jpeg,image/webp" hidden>
                </div>
                <p class="profile-inline-error" id="headshot-error" style="color:hsl(var(--destructive));font-size:13px;margin:.4rem 0 0" hidden></p>
              </div>
              <div class="profile-field">
                <span class="profile-field-label">Theme</span>
                <div class="segmented-control" id="theme-picker" role="group" aria-label="Theme">
                  ${THEMES.map(t => `<button type="button" class="segmented-btn" data-theme-value="${t}" aria-pressed="${t === currentTheme}">${escape(t.charAt(0).toUpperCase() + t.slice(1))}</button>`).join('')}
                </div>
              </div>
            </aside>
          </div>
        </form>
      </section>

      <details class="profile-card profile-collapse profile-activity" id="activity-section"${startOpen('activity-section')}>
        <summary class="profile-collapse-summary"><h2>Your activity</h2>${COLLAPSE_CHEV}</summary>
        <div class="profile-collapse-body">${renderActivity(getMetrics(), window.__toolIndex?.tools ?? [])}</div>
      </details>

      <details class="profile-card profile-collapse" id="storage-section"${startOpen('storage-section')}>
        <summary class="profile-collapse-summary"><h2>Storage</h2>${COLLAPSE_CHEV}</summary>
        <div class="profile-collapse-body" id="storage-body"><p class="storage-hint-text">Loading…</p></div>
      </details>

      <details class="profile-card profile-collapse" id="feature-flags-section"${(openState['feature-flags-section'] || focusFlags) ? ' open' : ''}>
        <summary class="profile-collapse-summary"><h2>Feature flags</h2>${COLLAPSE_CHEV}</summary>
        <div class="profile-collapse-body">
          <p class="storage-hint-text feature-hint-text">Self-governance, autonomy, choice. Enable or disable parts of the app here</p>
          <ul class="feature-flags" id="feature-flags">
            ${CATEGORY_FLAGS.map(f =>
              // Set the on-device Offline Utilities drawer apart from the creative
              // tool categories above it with its own separator.
              (f.category === 'utility' ? '<li class="feature-flag-divider" aria-hidden="true"></li>' : '') + flagRow(f)
            ).join('')}
            <li class="feature-flag-divider" aria-hidden="true"></li>
            ${flagRow(PRO_FLAG)}
          </ul>
        </div>
      </details>

      <nav class="profile-bottom-links" aria-label="More">
        <a href="#/capabilities" class="profile-platform-link" aria-label="Capabilities — the full feature set">Capabilities</a>
        <a href="#/platform" class="profile-platform-link" aria-label="Platform — brand colours, fonts &amp; global settings">Platform</a>
      </nav>

    </div>
  `;

  // Feature flags — auto-save each toggle (a preference, like the theme picker).
  viewEl.querySelector('#feature-flags')?.addEventListener('change', async e => {
    const input = e.target.closest('[data-flag]');
    if (!input) return;
    const current = await host.profile.get();
    const featureFlags = { ...(current.featureFlags ?? {}), [input.dataset.flag]: input.checked };
    await host.profile.set({ ...current, featureFlags });
    announce(`${input.checked ? 'Enabled' : 'Disabled'}`);
  });

  // Deep-link target: the gallery's empty state links here (#/profile?focus=feature-flags)
  // to nudge re-enabling categories. The section is opened above; scroll it into view.
  if (focusFlags) {
    requestAnimationFrame(() =>
      viewEl.querySelector('#feature-flags-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    );
  }

  // Theme picker
  viewEl.querySelector('#theme-picker').addEventListener('click', async e => {
    const btn = e.target.closest('[data-theme-value]');
    if (!btn) return;
    const theme = btn.dataset.themeValue;
    viewEl.querySelectorAll('[data-theme-value]').forEach(b => {
      b.setAttribute('aria-pressed', String(b.dataset.themeValue === theme));
    });
    applyTheme(theme);
    const updated = { ...(await host.profile.get()), theme };
    await host.profile.set(updated);
  });

  // Opt-in pill reflects the checkbox state (saved on form submit).
  const useDetailsInput = viewEl.querySelector('[name="useDetails"]');
  const optInTag = viewEl.querySelector('.profile-check-tag');
  const optInText = viewEl.querySelector('.profile-check-text');
  useDetailsInput?.addEventListener('change', () => {
    const on = useDetailsInput.checked;
    if (optInTag) optInTag.textContent = on ? 'Opted-in' : 'opt-in';
    if (optInText) optInText.textContent = on ? 'Using my details' : 'Use my details to create';
  });

  // Headshot — upload → circular crop → save as a user asset → store the ref.
  const headshotFileInput = viewEl.querySelector('#headshot-file');
  const paintHeadshot = (url) => {
    headshotUrl = url || '';
    const preview = viewEl.querySelector('#headshot-preview');
    if (preview) {
      // Set the image as a background so the overlaid Edit button (and its click
      // listener) is never re-created.
      preview.classList.toggle('is-empty', !headshotUrl);
      preview.style.backgroundImage = headshotUrl ? `url('${headshotUrl}')` : '';
    }
    const uploadBtn = viewEl.querySelector('#headshot-upload');
    if (uploadBtn) uploadBtn.textContent = headshotUrl ? 'Edit' : 'Upload';
    const removeBtn = viewEl.querySelector('#headshot-remove');
    if (removeBtn) removeBtn.hidden = !headshotUrl;
  };
  viewEl.querySelector('#headshot-upload')?.addEventListener('click', () => headshotFileInput?.click());
  headshotFileInput?.addEventListener('change', async () => {
    const file = headshotFileInput.files?.[0];
    headshotFileInput.value = '';
    if (!file) return;
    const cropped = await openHeadshotCropper(file);
    if (!cropped) return; // cancelled or undecodable
    const errEl = viewEl.querySelector('#headshot-error');
    if (errEl) errEl.hidden = true;
    try {
      const ref = await saveHeadshot(host, cropped.blob);
      paintHeadshot(ref.url);
      await refreshCounter();
    } catch (err) {
      host.log?.('error', 'Headshot save failed', { error: String(err) });
      // Inline + announced, matching the import-dialog error pattern — not a
      // blocking alert(). e.g. the storage-cap message.
      const msg = String(err?.message ?? err);
      if (errEl) { errEl.textContent = msg; errEl.hidden = false; }
      announce(msg, { assertive: true });
    }
  });
  viewEl.querySelector('#headshot-remove')?.addEventListener('click', async () => {
    await host.assets._deleteUserAsset(HEADSHOT_ID).catch(() => {});
    const current = await host.profile.get();
    delete current.headshot;
    await host.profile.set(current);
    paintHeadshot('');
    await refreshCounter();
  });

  // Live storage refresh — re-render the Storage meter IF it's loaded. The headshot
  // upload/remove paths change user-asset bytes and call this; it no-ops while the
  // Storage section is still collapsed (loadStorage sets refreshStorageMeter).
  let refreshStorageMeter = null;
  async function refreshCounter() { if (refreshStorageMeter) await refreshStorageMeter(); }

  // Personal details form
  viewEl.querySelector('#profile-form').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const label = btn?.textContent ?? 'Save';
    if (btn) btn.disabled = true;
    const data = Object.fromEntries(new FormData(e.target).entries());
    // Checkboxes aren't reliably in FormData (omitted when unchecked), so read it explicitly.
    const useDetails = e.target.querySelector('[name="useDetails"]')?.checked ?? false;
    delete data.useDetails;
    try {
      const current = await host.profile.get();
      await host.profile.set({ ...current, ...data, useDetails });
      if (btn) btn.textContent = 'Saved';
      announce('Profile saved');
      // Stay on the page; restore the button shortly after so users can keep editing.
      setTimeout(() => { if (btn) { btn.textContent = label; btn.disabled = false; } }, 1600);
    } catch {
      if (btn) { btn.textContent = label; btn.disabled = false; }
      announce("Couldn't save — try again", { assertive: true });
    }
  });

  // Persist each section's open/closed state across visits.
  for (const id of ['activity-section', 'storage-section', 'feature-flags-section']) {
    const d = viewEl.querySelector('#' + id);
    d?.addEventListener('toggle', () => {
      openState[id] = d.open;
      try { localStorage.setItem(OPEN_KEY, JSON.stringify(openState)); } catch { /* storage blocked */ }
    });
  }

  // ── Storage: lazy. Fetch the data + render the (heavy) image grid only when the
  // section is first expanded, then wire its handlers. ──────────────────────────
  const storageDetails = viewEl.querySelector('#storage-section');
  let storageLoaded = false;
  // Tool display names + a glyph for sessions saved without a thumbnail.
  const toolNameById = new Map((window.__toolIndex?.tools ?? []).map(t => [t.id, t.name]));
  const toolNameOf = (id) => toolNameById.get(id) || id || 'Saved session';
  const BATCH_SLOT_PREFIX = '__batch__:';
  const SESS_PLACEHOLDER = `<span class="store-sess-thumb is-placeholder" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="1.5"/><path d="m21 15-4.5-4.5L7 21"/></svg></span>`;
  const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Approximate, theme-agnostic byte formatting (KB/MB/GB) shared by the meter.
  const fmtPct = (usage, quota) => {
    if (!quota) return '0%';
    const p = (usage / quota) * 100;
    if (p < 0.1) return '<0.1%';
    return p < 10 ? `${p.toFixed(1)}%` : `${Math.round(p)}%`;
  };

  // Tool-previews cache: measurable (size()/list()) + clearable. Feature-detected so
  // an older/rebuilt bridge without host.previews just folds its bytes into "Other".
  async function measurePreviews() {
    if (!host.previews?.list) return { bytes: 0, count: 0, available: false };
    try {
      const list = await host.previews.list();
      const bytes = typeof host.previews.size === 'function'
        ? await host.previews.size()
        : list.reduce((n, r) => n + (r?.thumb ? r.thumb.length : 0), 0);
      return { bytes, count: list.length, available: true };
    } catch { return { bytes: 0, count: 0, available: false }; }
  }

  // Read every measurer + the browser's ground-truth estimate into one model. The
  // four measured slices never sum to estimate().usage — the honest remainder is
  // "Other" = max(0, usage − measured), so measured + Other == usage by construction.
  async function measure() {
    const estP = navigator.storage?.estimate
      ? navigator.storage.estimate().catch(() => null)
      : Promise.resolve(null);
    const [estimate, sessions, sessionSizes, cacheBytes, allImages, imagesBytes, previews] = await Promise.all([
      estP,
      host.state.list().catch(() => []),
      host.state.sizes().catch(() => ({})),
      host.assets._blobCacheSize().catch(() => 0),
      host.assets._listUserAssets().catch(() => []),
      host.assets._userAssetsSize().catch(() => 0),
      measurePreviews(),
    ]);
    const sessBytes = Object.values(sessionSizes).reduce((s, n) => s + n, 0);
    const imageList = allImages.filter(a => a.id !== HEADSHOT_ID); // headshot hidden from the grid (its bytes stay in the slice)
    const measured = sessBytes + imagesBytes + cacheBytes + previews.bytes;
    const hasEstimate = !!(estimate && estimate.usage != null);
    const usage = hasEstimate ? estimate.usage : null;
    const quota = (estimate && estimate.quota) || null;
    const overshoot = hasEstimate && measured > usage; // estimates are bucketed/approximate
    const other = (hasEstimate && !overshoot) ? Math.max(0, usage - measured) : 0;
    const total = hasEstimate ? Math.max(usage, measured) : measured; // the hero number
    return {
      sessions: { bytes: sessBytes, count: sessions.length, sizes: sessionSizes, list: sessions },
      images: { bytes: imagesBytes, count: imageList.length, list: imageList },
      cache: { bytes: cacheBytes },
      previews,
      measured, hasEstimate, usage, quota, overshoot, other, total,
    };
  }

  // The one-read screen-reader overview (the bar itself stays interactive, not role=img).
  function reconciliationSentence(m) {
    const parts = [
      `Saved sessions ${fmtBytes(m.sessions.bytes)}`,
      `My images ${fmtBytes(m.images.bytes)}`,
      `Asset cache ${fmtBytes(m.cache.bytes)}`,
    ];
    if (m.previews.available) parts.push(`Tool previews ${fmtBytes(m.previews.bytes)}`);
    let s = m.hasEstimate
      ? `Using ${fmtBytes(m.total)}: ${parts.join(', ')}`
      : `Measured ${fmtBytes(m.measured)}: ${parts.join(', ')}`;
    if (m.hasEstimate && m.other > 0) s += `, and about ${fmtBytes(m.other)} of other app data and overhead`;
    s += (m.hasEstimate && m.quota) ? ` — ${fmtPct(m.usage, m.quota)} of your ${fmtBytes(m.quota)} device budget.` : '.';
    return s;
  }

  // One selectable, deletable session row. Largest-first by default.
  function renderSessRow(s, bytes) {
    const isBatch = String(s.slot).startsWith(BATCH_SLOT_PREFIX);
    const label = s.label || s.filename || toolNameOf(s.toolId);
    const thumb = s.thumb
      ? `<img class="store-sess-thumb" src="${escape(s.thumb)}" alt="" loading="lazy">`
      : SESS_PLACEHOLDER;
    return `<li class="store-sess" data-slot="${escape(s.slot)}">
      <input type="checkbox" class="store-sess-check" data-slot="${escape(s.slot)}" aria-label="Select ${escape(label)}">
      ${thumb}
      <span class="store-sess-meta">
        <span class="store-sess-label">${escape(label)}${isBatch ? '<span class="store-sess-tag">batch</span>' : ''}</span>
        <span class="store-sess-sub">${escape(toolNameOf(s.toolId))}${s.updatedAt ? ` · ${escape(relativeTime(s.updatedAt))}` : ''}</span>
      </span>
      <span class="session-size">${fmtBytes(bytes)}</span>
      <button type="button" class="store-sess-del" data-del-session="${escape(s.slot)}" aria-label="Delete ${escape(label)}">&#x2715;</button>
    </li>`;
  }
  function sessionRowsHtml(m, sort) {
    const sizes = m.sessions.sizes;
    const rows = [...m.sessions.list];
    if (sort === 'recent') rows.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    else rows.sort((a, b) => (sizes[b.slot] || 0) - (sizes[a.slot] || 0));
    if (!rows.length) return `<li class="storage-empty">No saved sessions yet.</li>`;
    return rows.map(s => renderSessRow(s, sizes[s.slot] || 0)).join('');
  }

  // The whole section, rendered ONCE. applyMeter() then refreshes only the viz so an
  // open managed list (multi-select state) is never rebuilt out from under the user.
  function renderSection(m, sort) {
    const hasPrev = m.previews.available;
    return `
      <section class="store-meter" aria-label="Storage on this device">
        <header class="store-hero">
          <p class="store-hero-num" id="store-hero-num" data-bytes="0">0 KB</p>
          <p class="store-hero-cap">On this device ${infoDot('The real total this origin uses on this device, measured by your browser. Everything below is on THIS device only — nothing is uploaded.')}</p>
          <p class="store-headroom" id="store-headroom" hidden></p>
        </header>

        <div class="store-bar" id="store-bar">
          <button type="button" class="seg" data-cat="sessions" style="flex-grow:0"></button>
          <button type="button" class="seg" data-cat="images" style="flex-grow:0"></button>
          <button type="button" class="seg" data-cat="cache" style="flex-grow:0"></button>
          <button type="button" class="seg" data-cat="previews" style="flex-grow:0"${hasPrev ? '' : ' hidden'}></button>
          <span class="seg seg--other" data-cat="other" style="flex-grow:0" aria-hidden="true" hidden></span>
        </div>
        <p class="visually-hidden" id="store-aria-sentence"></p>

        <ul class="store-legend" role="list">
          <li><button type="button" class="store-chip" data-cat="sessions"><span class="store-chip-sw" data-cat="sessions"></span><span class="store-chip-name">Saved sessions</span><span class="store-chip-val" data-size="sessions">—</span></button></li>
          <li><button type="button" class="store-chip" data-cat="images"><span class="store-chip-sw" data-cat="images"></span><span class="store-chip-name">My images</span><span class="store-chip-val" data-size="images">—</span></button></li>
          <li><button type="button" class="store-chip" data-cat="cache"><span class="store-chip-sw" data-cat="cache"></span><span class="store-chip-name">Asset cache</span><span class="store-chip-val" data-size="cache">—</span></button></li>
          ${hasPrev ? `<li><button type="button" class="store-chip" data-cat="previews"><span class="store-chip-sw" data-cat="previews"></span><span class="store-chip-name">Tool previews</span><span class="store-chip-val" data-size="previews">—</span></button></li>` : ''}
          ${m.hasEstimate ? `<li><span class="store-chip store-chip--other"><span class="store-chip-sw is-hatch"></span><span class="store-chip-name">Other</span><span class="store-chip-val" data-size="other">—</span>${infoDot('Your profile, internal indexes, the offline app cache and storage overhead — everything not itemised above. Calculated as total used minus the measured items. Clear it with "Clear all my data" below.')}</span></li>` : ''}
        </ul>

        <p class="store-quota" id="store-quota" hidden><span class="storage-bar-wrap"><span class="storage-bar-fill" id="store-quota-fill" style="width:0%"></span></span><span class="store-quota-text" id="store-quota-text"></span></p>
        <p class="store-reclaim" id="store-reclaim"></p>
        <p class="store-footnote" id="store-footnote" hidden></p>

        <div class="store-manages">
          <details class="store-manage" data-cat="sessions">
            <summary class="store-manage-sum">${COLLAPSE_CHEV}<span>Saved sessions</span> <span class="storage-count" data-count="sessions">0</span> <span class="storage-hint" data-size-hint="sessions">0 KB</span></summary>
            <div class="store-manage-body">
              <div class="store-sess-tools">
                <label class="store-selall"><input type="checkbox" id="sess-selall"> Select all</label>
                <button type="button" class="store-sort" data-sort="${sort}">${sort === 'recent' ? 'Recent ▾' : 'Largest first ▾'}</button>
              </div>
              <ul class="store-sess-list" id="store-sess-list">${sessionRowsHtml(m, sort)}</ul>
              <a class="store-manage-link" href="#/p">Organise in Projects →</a>
            </div>
          </details>

          <details class="store-manage" data-cat="images">
            <summary class="store-manage-sum">${COLLAPSE_CHEV}<span>My images</span> <span class="storage-count" id="userimg-count">0/${MAX_USER_ASSETS}</span> <span class="storage-hint" id="userimg-size">0 KB</span> ${infoDot('Images you save to reuse across tools. This size includes your profile photo.')}</summary>
            <div class="store-manage-body">
              <div class="userimg-grid" id="userimg-grid">
                ${m.images.list.map(userImageThumb).join('')}
                <button type="button" class="userimg-add" id="userimg-add" aria-label="Add images"${m.images.count >= MAX_USER_ASSETS ? ' hidden' : ''}>
                  <span class="userimg-add-icon" aria-hidden="true">+</span>
                  <span class="userimg-add-text">Add</span>
                </button>
              </div>
              <input type="file" id="userimg-file" accept="image/svg+xml,image/png,image/jpeg,image/webp" multiple hidden>
              <p class="profile-inline-error" id="userimg-error" style="color:hsl(var(--destructive));font-size:13px;margin:.4rem 0 0" hidden></p>
            </div>
          </details>

          <div class="store-manage store-manage--row" data-cat="cache">
            <span class="store-manage-name">Asset cache ${infoDot('Downloaded catalog content; it re-downloads on demand. Safe to clear.')} <span class="storage-count" data-size-label="cache">0 KB</span></span>
            <button type="button" id="clear-cache-btn" class="btn-link-danger">Clear cache</button>
          </div>

          ${hasPrev ? `<div class="store-manage store-manage--row" data-cat="previews">
            <span class="store-manage-name">Tool previews ${infoDot('Snapshots Lolly draws of personalised tool cards — they redraw when needed. Safe to clear.')} <span class="storage-count" data-size-label="previews">0 KB</span></span>
            <button type="button" id="clear-previews-btn" class="btn-link-danger">Clear previews</button>
          </div>` : ''}
        </div>

        <div class="storage-subsection">
          <div class="storage-subsection-header">
            <span>Move to another device ${infoDot('Export everything — profile, saved sessions, uploaded images and preferences — as one file, then import it on another offline install to pick up exactly where you left off. Stays entirely on your devices.')}</span>
          </div>
          <div class="storage-actions">
            <button type="button" id="export-data-btn" class="btn">Export my data</button>
            <button type="button" id="import-data-btn" class="btn">Import data…</button>
            <input type="file" id="import-data-input" accept=".zip,application/zip" hidden>
          </div>
        </div>

        <div class="storage-actions">
          <button type="button" id="clear-storage-btn" class="btn btn-danger">Clear all my data</button>
        </div>

        <div class="store-selbar" id="store-selbar" role="region" aria-live="polite" hidden>
          <span class="store-selbar-count">0 selected</span>
          <button type="button" class="btn store-selbar-clear">Clear selection</button>
          <button type="button" class="btn btn-danger store-selbar-del">Delete</button>
        </div>
      </section>`;
  }

  async function loadStorage() {
    if (storageLoaded) return;
    storageLoaded = true;

    let model = await measure();
    let sessSort = 'size';
    const userImages = [...model.images.list]; // mutable mirror for the grid + lightbox

    const body = viewEl.querySelector('#storage-body');
    body.innerHTML = renderSection(model, sessSort);

    const bar = body.querySelector('#store-bar');
    const heroNum = body.querySelector('#store-hero-num');
    const selbar = body.querySelector('#store-selbar');
    const setText = (sel, text) => body.querySelectorAll(sel).forEach(e => { e.textContent = text; });

    // Hero count-up — cosmetic; set instantly under reduced-motion OR a hidden tab
    // (rAF is paused when document.hidden, so the final value must land immediately).
    function countUp(el, to) {
      if (!el) return;
      const from = Number(el.dataset.bytes || 0);
      el.dataset.bytes = String(to);
      if (reduceMotion() || document.hidden || from === to) { el.textContent = fmtBytes(to); return; }
      const dur = 600; let t0 = null;
      const tick = (now) => {
        if (t0 == null) t0 = now;
        const p = Math.min(1, (now - t0) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = fmtBytes(Math.round(from + (to - from) * eased));
        if (p < 1) requestAnimationFrame(tick); else el.textContent = fmtBytes(to);
      };
      requestAnimationFrame(tick);
    }

    const selectedSessionBytes = () => {
      let n = 0;
      body.querySelectorAll('.store-sess-check:checked').forEach(c => { n += model.sessions.sizes[c.dataset.slot] || 0; });
      return n;
    };
    function updateReclaim(m) {
      const el = body.querySelector('#store-reclaim');
      if (el) el.innerHTML = `Up to <strong>${fmtBytes(m.cache.bytes + m.previews.bytes + selectedSessionBytes())}</strong> can be freed here`;
    }

    // Refresh ONLY the visualization (hero, segments, legend, quota, reclaim, aria,
    // manage-summary badges) from a fresh model. Never rebuilds the session list/grid.
    function applyMeter(m) {
      countUp(heroNum, m.hasEstimate ? m.total : m.measured);
      const headroom = body.querySelector('#store-headroom');
      if (headroom) {
        if (m.hasEstimate && m.quota) {
          const used = m.usage / m.quota;
          const phrase = used < 0.5 ? 'lots of room left' : used < 0.8 ? 'plenty of room left' : used < 0.95 ? 'getting full' : 'almost full';
          headroom.textContent = `Using ${fmtPct(m.usage, m.quota)} of your ${fmtBytes(m.quota)} device budget · ${phrase}`;
          headroom.hidden = false;
        } else headroom.hidden = true;
      }
      const segs = [
        ['sessions', m.sessions.bytes, 'Saved sessions', true],
        ['images', m.images.bytes, 'My images', true],
        ['cache', m.cache.bytes, 'Asset cache', true],
        ['previews', m.previews.bytes, 'Tool previews', m.previews.available],
      ];
      for (const [cat, bytes, label, avail] of segs) {
        const seg = bar?.querySelector(`.seg[data-cat="${cat}"]`);
        if (!seg) continue;
        seg.style.flexGrow = String(Math.max(0, bytes));
        seg.hidden = !avail || bytes <= 0;
        seg.setAttribute('aria-label', `${label}, ${fmtBytes(bytes)} — manage`);
        seg.title = `${label} — ${fmtBytes(bytes)}`;
      }
      const otherSeg = bar?.querySelector('.seg--other');
      if (otherSeg) { otherSeg.style.flexGrow = String(m.other); otherSeg.hidden = !(m.hasEstimate && !m.overshoot && m.other > 0); }

      setText('[data-size="sessions"]', fmtBytes(m.sessions.bytes));
      setText('[data-size="images"]', fmtBytes(m.images.bytes));
      setText('[data-size="cache"]', fmtBytes(m.cache.bytes));
      setText('[data-size="previews"]', fmtBytes(m.previews.bytes));
      setText('[data-size="other"]', `~${fmtBytes(m.other)}`);
      setText('[data-count="sessions"]', String(m.sessions.count));
      setText('[data-size-hint="sessions"]', fmtBytes(m.sessions.bytes));
      setText('[data-size-label="cache"]', fmtBytes(m.cache.bytes));
      setText('[data-size-label="previews"]', fmtBytes(m.previews.bytes));
      const imgCount = body.querySelector('#userimg-count');
      const imgSize = body.querySelector('#userimg-size');
      if (imgCount) imgCount.textContent = `${m.images.count}/${MAX_USER_ASSETS}`;
      if (imgSize) imgSize.textContent = fmtBytes(m.images.bytes);

      const quotaRow = body.querySelector('#store-quota');
      const fill = body.querySelector('#store-quota-fill');
      const quotaText = body.querySelector('#store-quota-text');
      if (m.hasEstimate && m.quota) {
        if (fill) fill.style.width = `${Math.min(100, (m.usage / m.quota) * 100)}%`;
        if (quotaText) quotaText.innerHTML = `${fmtBytes(m.usage)} of ${fmtBytes(m.quota)} device budget · <strong>${fmtPct(m.usage, m.quota)}</strong> used`;
        if (quotaRow) quotaRow.hidden = false;
      } else if (quotaRow) quotaRow.hidden = true;

      const note = body.querySelector('#store-footnote');
      if (note) {
        if (!m.hasEstimate) { note.textContent = 'Device total unavailable — showing measured items only.'; note.hidden = false; }
        else if (m.overshoot) { note.textContent = "Measured items meet or exceed the browser's estimate (estimates are approximate)."; note.hidden = false; }
        else note.hidden = true;
      }
      const aria = body.querySelector('#store-aria-sentence');
      if (aria) aria.textContent = reconciliationSentence(m);
      updateReclaim(m);
    }

    // Explore: a legend chip / bar segment isolates its slice and opens + scrolls to
    // that category's manage panel. Re-clicking the active one clears the highlight.
    function exploreCategory(cat) {
      const next = bar?.getAttribute('data-active') === cat ? '' : cat;
      if (bar) {
        if (next) bar.setAttribute('data-active', next); else bar.removeAttribute('data-active');
        bar.querySelectorAll('.seg').forEach(s => s.classList.toggle('is-active', !!next && s.dataset.cat === next));
      }
      body.querySelectorAll('.store-chip').forEach(c => c.classList.toggle('is-active', !!next && c.dataset.cat === next));
      if (!next) return;
      const panel = body.querySelector(`.store-manage[data-cat="${cat}"]`);
      if (panel) {
        if (panel.tagName === 'DETAILS') panel.open = true;
        panel.scrollIntoView({ block: 'start', behavior: reduceMotion() ? 'auto' : 'smooth' });
      }
    }

    const ensureSessEmptyState = () => {
      const list = body.querySelector('#store-sess-list');
      if (list && !list.querySelector('.store-sess')) list.innerHTML = `<li class="storage-empty">No saved sessions yet.</li>`;
    };
    function syncSelbar() {
      const checked = [...body.querySelectorAll('.store-sess-check:checked')];
      if (selbar) {
        selbar.hidden = checked.length === 0;
        let bytes = 0; checked.forEach(c => bytes += model.sessions.sizes[c.dataset.slot] || 0);
        const cnt = selbar.querySelector('.store-selbar-count');
        if (cnt) cnt.textContent = `${checked.length} selected · ${fmtBytes(bytes)}`;
      }
      // Reserve space so the fixed bar never covers the section's bottom controls (mobile).
      body.querySelector('.store-meter')?.classList.toggle('has-selbar', checked.length > 0);
      const all = body.querySelector('#sess-selall');
      const boxes = [...body.querySelectorAll('.store-sess-check')];
      if (all) all.checked = boxes.length > 0 && checked.length === boxes.length;
      updateReclaim(model);
    }

    async function refreshMeter() { model = await measure(); applyMeter(model); }

    // The confirm modal restores focus to the (now-removed) delete control on close, so
    // after a deletion move focus to a surviving control — else keyboard/SR users drop to
    // <body> and have to re-traverse the page.
    function focusSurvivingSession(preferred) {
      const t = (preferred && document.contains(preferred) && preferred)
        || body.querySelector('.store-sess-del')
        || body.querySelector('.store-sort')
        || body.querySelector('.store-manage[data-cat="sessions"] > summary');
      t?.focus?.();
    }

    async function deleteOneSession(slot, btn) {
      const bytes = model.sessions.sizes[slot] || 0;
      const row = [...body.querySelectorAll('.store-sess')].find(r => r.dataset.slot === slot);
      const label = row?.querySelector('.store-sess-label')?.textContent || 'this session';
      const ok = await confirmDialog({
        title: 'Delete this session?',
        message: `"${label}" will be permanently removed from this device${bytes ? `, freeing about ${fmtBytes(bytes)}` : ''}. This cannot be undone.`,
        confirmLabel: 'Delete',
      });
      if (!ok) return;
      // The next/previous row's delete button is the natural landing spot post-removal.
      const nextFocus = (row?.nextElementSibling || row?.previousElementSibling)?.querySelector?.('.store-sess-del');
      btn.disabled = true;
      try { await host.state.delete(slot); }
      catch (err) { host.log?.('error', 'Session delete failed', { slot, error: String(err) }); btn.disabled = false; return; }
      row?.remove();
      ensureSessEmptyState();
      syncSelbar();
      focusSurvivingSession(nextFocus);
      await refreshMeter();
      announce(`Freed ${fmtBytes(bytes)} — ${fmtBytes(model.hasEstimate ? model.total : model.measured)} used`);
    }

    async function deleteSelectedSessions(btn) {
      const checked = [...body.querySelectorAll('.store-sess-check:checked')];
      if (!checked.length) return;
      const slots = checked.map(c => c.dataset.slot);
      let bytes = 0; slots.forEach(s => bytes += model.sessions.sizes[s] || 0);
      const ok = await confirmDialog({
        title: `Delete ${slots.length} saved session${slots.length === 1 ? '' : 's'}?`,
        message: `This permanently removes ${slots.length === 1 ? 'it' : 'them'} from this device, freeing about ${fmtBytes(bytes)}. This cannot be undone.`,
        confirmLabel: `Delete ${slots.length}`,
      });
      if (!ok) return;
      const prev = btn.textContent; btn.disabled = true; btn.textContent = 'Deleting…';
      // Only splice a row once its delete actually resolves — otherwise a rejected
      // delete leaves a ghost (row gone, but the session still counted by refreshMeter
      // and resurrected on the next sort). Freed bytes are summed from real successes.
      let freed = 0, done = 0;
      for (const slot of slots) {
        try { await host.state.delete(slot); }
        catch (err) { host.log?.('error', 'Session delete failed', { slot, error: String(err) }); continue; }
        freed += model.sessions.sizes[slot] || 0; done++;
        [...body.querySelectorAll('.store-sess')].find(r => r.dataset.slot === slot)?.remove();
      }
      btn.textContent = prev; btn.disabled = false;
      ensureSessEmptyState();
      syncSelbar();
      focusSurvivingSession();
      await refreshMeter();
      announce(done === slots.length
        ? `Deleted ${done} session${done === 1 ? '' : 's'} — freed ${fmtBytes(freed)}`
        : `Deleted ${done} of ${slots.length} — freed ${fmtBytes(freed)}; some could not be removed`);
    }

    function toggleSort(btn) {
      sessSort = sessSort === 'size' ? 'recent' : 'size';
      btn.dataset.sort = sessSort;
      btn.textContent = sessSort === 'recent' ? 'Recent ▾' : 'Largest first ▾';
      const checked = new Set([...body.querySelectorAll('.store-sess-check:checked')].map(c => c.dataset.slot));
      const list = body.querySelector('#store-sess-list');
      if (list) list.innerHTML = sessionRowsHtml(model, sessSort);
      checked.forEach(slot => {
        const box = [...body.querySelectorAll('.store-sess-check')].find(c => c.dataset.slot === slot);
        if (box) box.checked = true;
      });
      syncSelbar();
    }

    async function clearRegenerable(btn, fn, doneMsg) {
      const prev = btn.textContent; btn.disabled = true; btn.textContent = 'Clearing…';
      try { await fn(); } catch (err) { host.log?.('error', doneMsg, { error: String(err) }); }
      btn.textContent = 'Cleared';
      setTimeout(() => { btn.textContent = prev; btn.disabled = false; }, 1500);
      await refreshMeter();
      announce(doneMsg);
    }

    // ── one delegated click listener (explore / clear / sort / multi-select bar) ──
    body.addEventListener('click', async (e) => {
      const explore = e.target.closest('.store-chip[data-cat], .seg[data-cat]');
      if (explore && explore.dataset.cat !== 'other') { exploreCategory(explore.dataset.cat); return; }

      const del = e.target.closest('[data-del-session]');
      if (del) { await deleteOneSession(del.dataset.delSession, del); return; }

      const sortBtn = e.target.closest('.store-sort');
      if (sortBtn) { toggleSort(sortBtn); return; }

      const cacheBtn = e.target.closest('#clear-cache-btn');
      if (cacheBtn) { await clearRegenerable(cacheBtn, () => clearIdbStores(['asset-blob', 'asset-meta']), 'Cleared asset cache'); return; }

      const prevBtn = e.target.closest('#clear-previews-btn');
      if (prevBtn) { await clearRegenerable(prevBtn, () => host.previews?.clear(), 'Cleared tool previews'); return; }

      if (e.target.closest('.store-selbar-clear')) { body.querySelectorAll('.store-sess-check').forEach(c => { c.checked = false; }); syncSelbar(); return; }
      const selDel = e.target.closest('.store-selbar-del');
      if (selDel) { await deleteSelectedSessions(selDel); return; }
    });

    // selection checkboxes (incl. select-all) update the floating action bar.
    body.addEventListener('change', (e) => {
      if (e.target.matches('.store-sess-check')) { syncSelbar(); }
      else if (e.target.matches('#sess-selall')) {
        const on = e.target.checked;
        body.querySelectorAll('.store-sess-check').forEach(c => { c.checked = on; });
        syncSelbar();
      }
    });

    // ── My images — same add/delete/lightbox handlers as before (grid reused). ──
    const userimgAddBtn = body.querySelector('#userimg-add');
    async function syncUserImgMeta() {
      const list = await host.assets._listUserAssets().catch(() => []);
      const count = list.filter(a => a.id !== HEADSHOT_ID).length;
      if (userimgAddBtn) userimgAddBtn.hidden = count >= MAX_USER_ASSETS;
      await refreshCounter(); // re-measures → applyMeter refreshes the count/size badges + legend + bar
    }
    const userimgFile = body.querySelector('#userimg-file');
    userimgAddBtn?.addEventListener('click', () => userimgFile?.click());
    userimgFile?.addEventListener('change', async () => {
      const files = [...(userimgFile.files ?? [])];
      userimgFile.value = '';
      if (!files.length) return;
      if (userimgAddBtn) userimgAddBtn.disabled = true;
      const imgErr = body.querySelector('#userimg-error');
      if (imgErr) imgErr.hidden = true;
      for (const file of files) {
        try {
          const ref = await storeUserUpload(host, file);
          userImages.unshift(ref);
          body.querySelector('#userimg-grid')?.insertAdjacentHTML('afterbegin', userImageThumb(ref));
        } catch (err) {
          host.log?.('error', 'Image upload failed', { name: file.name, error: String(err) });
          const msg = String(err?.message ?? err);
          if (imgErr) { imgErr.textContent = msg; imgErr.hidden = false; }
          announce(msg, { assertive: true });
          break;
        }
      }
      if (userimgAddBtn) userimgAddBtn.disabled = false;
      await syncUserImgMeta();
    });
    body.querySelector('#userimg-grid')?.addEventListener('click', async e => {
      const view = e.target.closest('[data-view-userimg]');
      if (view) {
        const ref = userImages.find(a => a.id === view.dataset.viewUserimg);
        if (ref) openImageLightbox(ref);
        return;
      }
      const btn = e.target.closest('[data-delete-userimg]');
      if (!btn) return;
      const id = btn.dataset.deleteUserimg;
      btn.disabled = true;
      try { await host.assets._deleteUserAsset(id); }
      catch (err) { host.log?.('error', 'Failed to delete image', { id, error: String(err) }); btn.disabled = false; return; }
      btn.closest('[data-userimg]')?.remove();
      const i = userImages.findIndex(a => a.id === id);
      if (i !== -1) userImages.splice(i, 1);
      await syncUserImgMeta();
    });

    applyMeter(model);
    refreshStorageMeter = refreshMeter;

    // Clear all — confirmation dialog gated on typing a randomised word, so an
    // irreversible wipe can't be fired by reflex (or a stray double-click).
    viewEl.querySelector('#clear-storage-btn')?.addEventListener('click', () => {
      const word = CLEAR_CONFIRM_WORDS[Math.floor(Math.random() * CLEAR_CONFIRM_WORDS.length)];
      const overlay = document.createElement('div');
      overlay.className = 'clear-dialog-overlay';
      overlay.innerHTML = `
        <div class="clear-dialog" role="dialog" aria-modal="true" aria-labelledby="clear-dialog-title">
          <h3 id="clear-dialog-title">Clear all my data?</h3>
          <p>This removes your profile, all saved sessions, your uploaded images, and the asset cache. Cannot be undone.</p>
          <label class="clear-confirm">
            <span class="clear-confirm-prompt">Type <strong>${word}</strong> to confirm</span>
            <input type="text" class="clear-confirm-input" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Type ${word} to confirm">
          </label>
          <div class="clear-dialog-actions">
            <button class="btn btn-danger" data-scope="all" disabled>Clear everything</button>
            <button class="btn" data-scope="cancel">Cancel</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      // Escape-to-dismiss + focus-restore, mirroring openImageLightbox. (A full
      // Tab focus-trap is deferred — see followups.)
      const opener = document.activeElement;
      const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); dismiss(); } };
      const dismiss = () => {
        document.removeEventListener('keydown', onKey);
        overlay.remove();
        if (opener instanceof HTMLElement) opener.focus();
      };
      document.addEventListener('keydown', onKey);

      const confirmInput = overlay.querySelector('.clear-confirm-input');
      const clearBtn = overlay.querySelector('[data-scope="all"]');
      const matches = () => confirmInput.value.trim().toLowerCase() === word;
      confirmInput.addEventListener('input', () => { clearBtn.disabled = !matches(); });
      confirmInput.addEventListener('keydown', e => { if (e.key === 'Enter' && matches()) { e.preventDefault(); clearBtn.click(); } });
      confirmInput.focus();

      overlay.addEventListener('click', async e => {
        const scope = e.target.closest('[data-scope]')?.dataset.scope;
        if (!scope || scope === 'cancel') { dismiss(); return; }
        if (scope === 'all' && !matches()) return; // guard: the word must match

        const btns = overlay.querySelectorAll('button');
        btns.forEach(b => (b.disabled = true));
        clearBtn.textContent = 'Clearing…';

        localStorage.clear();
        sessionStorage.clear();
        await clearIdbStores(['state', 'profile', 'user-assets', 'asset-blob', 'asset-meta']);
        host.profile.bust();
        applyTheme('light');
        document.removeEventListener('keydown', onKey);
        overlay.remove();
        await mountProfile(viewEl, host);
      });
    });

    // Export everything to a portable .zip for carrying to another offline install.
    viewEl.querySelector('#export-data-btn')?.addEventListener('click', async e => {
      const btn = e.currentTarget;
      const prev = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Exporting…';
      try {
        const { blob, filename, summary } = await exportBackup({ host, storage: localStorage });
        saveBlob(blob, filename);
        announce(`Exported ${summary.sessions} session${summary.sessions === 1 ? '' : 's'} and ${summary.userAssets} image${summary.userAssets === 1 ? '' : 's'}`);
        btn.textContent = 'Exported';
      } catch (err) {
        host.log?.('error', 'Data export failed', { error: String(err) });
        btn.textContent = 'Export failed';
      }
      setTimeout(() => { btn.textContent = prev; btn.disabled = false; }, 1800);
    });

    // Import a bundle from another install (merge-overwrite), then re-mount.
    const importInput = viewEl.querySelector('#import-data-input');
    viewEl.querySelector('#import-data-btn')?.addEventListener('click', () => importInput?.click());
    importInput?.addEventListener('change', () => {
      const file = importInput.files?.[0];
      importInput.value = ''; // let the same file be re-picked later
      if (!file) return;
      showImportDialog(async () => {
        const bytes = await file.arrayBuffer();
        const summary = await importBackup({ host, storage: localStorage }, bytes);
        host.profile.bust();
        applyTheme(localStorage.getItem('theme') || 'light');
        // `skipped` > 0 means the bundle came from a newer app and carried parts this
        // build doesn't understand yet — surface it rather than pretend a full restore.
        const skipNote = summary.skipped ? ` · ${summary.skipped} newer item${summary.skipped === 1 ? '' : 's'} skipped` : '';
        announce(`Imported ${summary.sessions} session${summary.sessions === 1 ? '' : 's'} and ${summary.userAssets} image${summary.userAssets === 1 ? '' : 's'}${skipNote}`);
        await mountProfile(viewEl, host);
      });
    });
  }
  storageDetails?.addEventListener('toggle', () => { if (storageDetails.open) loadStorage(); });
  // A persisted-open section renders open from the HTML `open` attribute, which does
  // NOT fire `toggle`, so kick the lazy load here (runs after first paint).
  if (storageDetails?.open) loadStorage();

  // The Storage manager opens body-level modals (the shared confirmDialog); tear any
  // down when the router swaps this view out (main.js calls _cleanup) so an orphaned
  // top-layer <dialog> can't block the next view.
  viewEl._cleanup = () => closeConfirmDialogs();
}


function userImageThumb(ref) {
  const name = ref.meta?.name ?? 'Image';
  // SVGs (logos/icons) shouldn't be cropped to fill — show the whole mark.
  const isVector = ref.type === 'vector' || ref.format === 'svg';
  return `
    <div class="userimg-item" data-userimg="${escape(ref.id)}">
      <button type="button" class="userimg-view" data-view-userimg="${escape(ref.id)}" title="${escape(name)}" aria-label="View ${escape(name)}">
        <img class="userimg-thumb${isVector ? ' is-vector' : ''}" src="${escape(ref.url)}" alt="${escape(name)}" loading="lazy">
      </button>
      <button type="button" class="userimg-delete" data-delete-userimg="${escape(ref.id)}" title="Delete" aria-label="Delete ${escape(name)}">&#x2715;</button>
    </div>
  `;
}

// Full-size preview overlay for a user image. Closes on backdrop click, the ✕,
// or Escape. Mirrors the simple overlay pattern used by the clear-data dialog.
function openImageLightbox(ref) {
  const name = ref.meta?.name ?? 'Image';
  const isVector = ref.type === 'vector' || ref.format === 'svg';
  // viewBox-only SVGs report no intrinsic size, so label them "SVG" rather than
  // leaving the dimensions blank.
  const dims = ref.width && ref.height ? `${ref.width} × ${ref.height}` : (isVector ? 'SVG' : '');

  const overlay = document.createElement('div');
  overlay.className = 'userimg-lightbox-overlay';
  overlay.innerHTML = `
    <div class="userimg-lightbox" role="dialog" aria-modal="true" aria-label="${escape(name)}">
      <button type="button" class="userimg-lightbox-close" aria-label="Close">&#x2715;</button>
      <img class="userimg-lightbox-img${isVector ? ' is-vector' : ''}" src="${escape(ref.url)}" alt="${escape(name)}">
      <div class="userimg-lightbox-caption">
        <span class="userimg-lightbox-name">${escape(name)}</span>
        ${dims ? `<span class="userimg-lightbox-dims">${escape(dims)}</span>` : ''}
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // Return focus to whatever opened the lightbox when it closes.
  const opener = document.activeElement;
  const close = () => {
    document.removeEventListener('keydown', onKey);
    overlay.remove();
    if (opener instanceof HTMLElement) opener.focus();
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };

  overlay.addEventListener('click', (e) => {
    // Close when clicking the backdrop or the ✕; ignore clicks on the image itself.
    if (e.target === overlay || e.target.closest('.userimg-lightbox-close')) close();
  });
  document.addEventListener('keydown', onKey);
  overlay.querySelector('.userimg-lightbox-close')?.focus();
}

function clearIdbStores(storeNames) {
  return new Promise((res, rej) => {
    const req = indexedDB.open('lolly');
    req.onerror = rej;
    req.onsuccess = e => {
      const db = e.target.result;
      const tx = db.transaction(storeNames.filter(n => [...db.objectStoreNames].includes(n)), 'readwrite');
      tx.oncomplete = () => { db.close(); res(); };
      tx.onerror    = rej;
      storeNames.forEach(n => {
        if ([...db.objectStoreNames].includes(n)) tx.objectStore(n).clear();
      });
    };
  });
}

function fmtBytes(bytes) {
  if (!bytes) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

// Confirm + run a data import. The action may throw (not a backup, wrong format,
// quota); surface the reason in place and keep the dialog open rather than
// leaving the user guessing.
function showImportDialog(onConfirm) {
  const overlay = document.createElement('div');
  overlay.className = 'clear-dialog-overlay';
  overlay.innerHTML = `
    <div class="clear-dialog" role="dialog" aria-modal="true" aria-labelledby="import-dialog-title">
      <h3 id="import-dialog-title">Import data?</h3>
      <p>This loads the profile, saved sessions, images and preferences from the file. Anything with the same name on this device is overwritten; everything else is kept.</p>
      <p class="import-error" style="color:hsl(var(--destructive));font-size:13px;margin:0" hidden></p>
      <div class="clear-dialog-actions">
        <button class="btn" data-scope="import">Import</button>
        <button class="btn" data-scope="cancel">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // Escape-to-dismiss + focus-restore, mirroring openImageLightbox. (A full
  // Tab focus-trap is deferred — see followups.)
  const opener = document.activeElement;
  const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); dismiss(); } };
  const dismiss = () => {
    document.removeEventListener('keydown', onKey);
    overlay.remove();
    if (opener instanceof HTMLElement) opener.focus();
  };
  document.addEventListener('keydown', onKey);
  overlay.querySelector('[data-scope="import"]')?.focus();

  overlay.addEventListener('click', async e => {
    const scope = e.target.closest('[data-scope]')?.dataset.scope;
    if (!scope) return;
    if (scope === 'cancel') { dismiss(); return; }

    const btns = overlay.querySelectorAll('button');
    const errEl = overlay.querySelector('.import-error');
    btns.forEach(b => (b.disabled = true));
    e.target.textContent = 'Importing…';
    try {
      await onConfirm();
      document.removeEventListener('keydown', onKey);
      overlay.remove(); // success re-mounts the page; drop the (body-level) overlay
    } catch (err) {
      errEl.textContent = err?.message || 'Import failed.';
      errEl.hidden = false;
      btns.forEach(b => (b.disabled = false));
      e.target.textContent = 'Import';
    }
  });
}

// Local-only usage stats. All derived from a tiny localStorage blob (metrics.js);
// nothing here is recorded remotely — hence the "0 uploaded" line. Returns the
// section's inner content (the heading lives in the collapsible summary).
function renderActivity(m, tools) {
  const hasAny = m.filesRendered || m.toolOpens || m.linksCopied || m.imagesCopied || m.batchRuns;
  if (!hasAny) {
    return `<p class="storage-hint-text">Nothing here yet — open a tool and make something. It all gets counted right here on your device.</p>`;
  }

  const num = (n) => Number(n).toLocaleString();
  const stat = (n, label) => `<div class="activity-stat"><span class="activity-num">${num(n)}</span><span class="activity-label">${label}</span></div>`;
  const tiles = [
    stat(m.filesRendered, 'files rendered'),
    stat(m.toolOpens, 'tools opened'),
    stat(m.linksCopied, 'links copied'),
    stat(m.imagesCopied, 'images copied'),
  ];
  if (m.batchRuns) tiles.push(stat(m.batchFiles, 'files batched'));

  // Format leaderboard as proportional bars (most-used first; top one accented).
  const formats = Object.entries(m.formats).sort((a, b) => b[1] - a[1]);
  const max = formats.length ? formats[0][1] : 1;
  const bars = formats.length ? `
    <div class="activity-block">
      <h3 class="activity-h3">Your Favourite Formats</h3>
      <ul class="fmt-bars">
        ${formats.map(([f, n], i) => `<li class="fmt-row${i === 0 ? ' is-top' : ''}">
          <span class="fmt-name">${escape(f.toUpperCase())}</span>
          <span class="fmt-track"><span class="fmt-fill" style="width:${Math.max(6, Math.round((n / max) * 100))}%"></span></span>
          <span class="fmt-count">${num(n)}</span>
        </li>`).join('')}
      </ul>
    </div>` : '';

  // Resolve against the current catalog. A favourite tool that's since been
  // removed (new deploy without it) is dropped rather than linked, so the pill
  // never navigates to a tool route that can't mount.
  const favTool = m.favTool ? tools.find(t => t.id === m.favTool) : null;
  const since = new Date(m.since).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  const meta = [
    `Creating since <strong>${escape(since)}</strong>`,
    favTool ? `Favourite tool <a class="activity-fav" href="#/tool/${encodeURIComponent(favTool.id)}" aria-label="Open ${escape(favTool.name)}">${escape(favTool.name)}</a>` : '',
    m.batchRuns ? `<strong>${m.batchRuns}</strong> batch run${m.batchRuns === 1 ? '' : 's'}${m.biggestBatch > 1 ? ` (biggest ${num(m.biggestBatch)})` : ''}` : '',
    `<strong>0</strong> uploaded — all on your device`,
  ].filter(Boolean).join(' <span class="dot" aria-hidden="true">·</span> ');

  // Stat tiles sit beside the format leaderboard on desktop (split), and stack
  // on mobile. With no formats the grid keeps the full card width on its own.
  const stats = `<div class="activity-grid">${tiles.join('')}</div>`;
  const body = bars ? `<div class="activity-split">${stats}${bars}</div>` : stats;

  return `${body}<p class="activity-meta">${meta}</p>`;
}

// Store the cropped square WebP in the user-assets store (one fixed id, so it
// overwrites) and record the resulting AssetRef on the profile (sans the volatile
// object URL — consumers re-resolve by id). A fresh version each time avoids the
// bridge's id:format:version object-URL cache masking the new image.
async function saveHeadshot(host, blob) {
  const record = {
    id: HEADSHOT_ID, type: 'raster', format: 'webp', blob,
    width: 512, height: 512, version: String(Date.now()),
    meta: { name: 'headshot.webp', tags: ['headshot'] },
  };
  await host.assets._uploadUserAsset(record);
  const ref = await host.assets.get(HEADSHOT_ID);
  const { source, id, type, format, version, width, height, meta } = ref;
  const current = await host.profile.get();
  await host.profile.set({ ...current, headshot: { source, id, type, format, version, width, height, meta } });
  return ref;
}

