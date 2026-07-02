// SPDX-License-Identifier: MPL-2.0
/**
 * Profile editing — personal details form, headshot, theme picker and the
 * "Use my details" opt-in, plus the Feature flags section (a preference
 * toggle much like the theme picker: it auto-saves on click).
 *
 * Theme selection auto-saves on click (it's a preference, not a form field).
 * The other personal details save on form submit.
 */

import { applyTheme, THEMES } from '../../theme.ts';
import { escape } from '../../utils.ts';
import { announce } from '../../a11y.ts';
import { openHeadshotCropper } from '../../components/headshot-cropper.ts';
import { CATEGORY_FLAGS, PRO_FLAG, flagEnabled } from '../../feature-flags.ts';
import type { WebHost } from '../../bridge/index.ts';
import type { Profile } from '@lolly/engine';
import type { FeatureFlag } from '../../feature-flags.ts';

// Friendly labels for the raw profile field keys.
const FIELD_LABELS: Record<string, string> = {
  firstname: 'First name', lastname: 'Last name', email: 'Email',
  phone: 'Phone', city: 'City', country: 'Country',
};

// Per-field input semantics — the right keyboard on mobile, native validation
// and autofill where it helps. Anything not listed falls back to a plain text
// input (autocomplete off, as before).
const FIELD_ATTRS: Record<string, Record<string, string>> = {
  firstname: { type: 'text', autocomplete: 'given-name' },
  lastname:  { type: 'text', autocomplete: 'family-name' },
  email:     { type: 'email', inputmode: 'email', autocomplete: 'email' },
  phone:     { type: 'tel', autocomplete: 'tel' },
};
const fieldAttrs = (f: string): string => {
  const a = FIELD_ATTRS[f] ?? { type: 'text', autocomplete: 'off' };
  return Object.entries(a).map(([k, v]) => `${k}="${escape(v)}"`).join(' ');
};

// The headshot lives in the user-assets store under one fixed id (so a new one
// overwrites the old and it only ever occupies a single slot), and is kept out
// of the "My images" library list.
export const HEADSHOT_ID = 'user/headshot';

// Randomised word the user must type to confirm the irreversible "clear all my
// data" action — deliberate speed-bump against an accidental wipe.
// (owned by storage.ts, which renders that dialog)

/** Fields rendered on the profile form, in display order. */
export const PROFILE_FIELDS = ['firstname', 'lastname', 'email', 'phone', 'city', 'country'] as const;

// Render the "Your details" card: personal-detail fields, headshot and theme picker.
export function renderProfileCard(profile: Profile, currentTheme: string, headshotUrl: string): string {
  const fields = PROFILE_FIELDS;
  return `
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
      </section>`;
}

// One toggle row for a feature flag (closes over `profile` for its checked state).
function flagRow(profile: Profile, f: FeatureFlag): string {
  return `
    <li>
      <label class="feature-flag">
        <span class="feature-flag-label">${escape(f.label)}${f.pill ? `<span class="feature-flag-pill">${escape(f.pill)}</span>` : ''}</span>
        <input type="checkbox" class="feature-flag-input" data-flag="${escape(f.id)}" ${flagEnabled(profile, f.id) ? 'checked' : ''}>
        <span class="feature-flag-switch" aria-hidden="true"></span>
      </label>
    </li>`;
}

// Render the Feature flags section body (the heading lives in the collapsible summary).
export function renderFeatureFlags(profile: Profile): string {
  return `
          <p class="storage-hint-text feature-hint-text">Self-governance, autonomy, choice. Enable or disable parts of the app here</p>
          <ul class="feature-flags" id="feature-flags">
            ${CATEGORY_FLAGS.map(f =>
              // Set the on-device Offline Utilities drawer apart from the creative
              // tool categories above it with its own separator.
              (f.category === 'utility' ? '<li class="feature-flag-divider" aria-hidden="true"></li>' : '') + flagRow(profile, f),
            ).join('')}
            <li class="feature-flag-divider" aria-hidden="true"></li>
            ${flagRow(profile, PRO_FLAG)}
          </ul>`;
}

// Store the cropped square WebP in the user-assets store (one fixed id, so it
// overwrites) and record the resulting AssetRef on the profile (sans the volatile
// object URL — consumers re-resolve by id). A fresh version each time avoids the
// bridge's id:format:version object-URL cache masking the new image.
async function saveHeadshot(host: WebHost, blob: Blob) {
  const record = {
    id: HEADSHOT_ID, type: 'raster' as const, format: 'webp', blob,
    width: 512, height: 512, version: String(Date.now()),
    meta: { name: 'headshot.webp', tags: ['headshot'] },
  };
  await host.assets._uploadUserAsset(record);
  const ref = await host.assets.get(HEADSHOT_ID);
  const current = await host.profile.get();
  // Store the full ref (Profile.headshot is a plain AssetRef). Its `url` goes
  // stale across reloads like any object URL, but that's harmless: the one
  // consumer (mountProfile) re-resolves by id via host.assets.get() rather
  // than reading this cached url.
  await host.profile.set({ ...current, headshot: ref });
  return ref;
}

export interface WireProfileEditingOptions {
  /** Whether the deep-link `?focus=feature-flags` requested this section be opened + scrolled into view. */
  focusFlags: boolean;
  /** Called after the headshot changes, so the (possibly-loaded) Storage meter can refresh its byte counts. */
  onAssetChange: () => Promise<void>;
}

// Wire up the "Your details" card (theme, opt-in, headshot, submit) and the
// Feature flags toggles. Mirrors the exact listener wiring that used to live
// inline in mountProfile.
export function wireProfileEditing(viewEl: HTMLElement, host: WebHost, opts: WireProfileEditingOptions): void {
  const { focusFlags, onAssetChange } = opts;

  // Feature flags — auto-save each toggle (a preference, like the theme picker).
  viewEl.querySelector('#feature-flags')?.addEventListener('change', async e => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    const input = target.closest<HTMLInputElement>('[data-flag]');
    if (!input) return;
    const current = await host.profile.get();
    const flag = input.dataset.flag;
    if (!flag) return;
    const featureFlags = { ...(current.featureFlags ?? {}), [flag]: input.checked };
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
  viewEl.querySelector('#theme-picker')?.addEventListener('click', async e => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    const btn = target.closest<HTMLButtonElement>('[data-theme-value]');
    if (!btn) return;
    const theme = btn.dataset.themeValue;
    if (!theme) return;
    viewEl.querySelectorAll<HTMLButtonElement>('[data-theme-value]').forEach(b => {
      b.setAttribute('aria-pressed', String(b.dataset.themeValue === theme));
    });
    applyTheme(theme);
    const updated = { ...(await host.profile.get()), theme };
    await host.profile.set(updated);
  });

  // Opt-in pill reflects the checkbox state (saved on form submit).
  const useDetailsInput = viewEl.querySelector<HTMLInputElement>('[name="useDetails"]');
  const optInTag = viewEl.querySelector<HTMLElement>('.profile-check-tag');
  const optInText = viewEl.querySelector<HTMLElement>('.profile-check-text');
  useDetailsInput?.addEventListener('change', () => {
    const on = useDetailsInput.checked;
    if (optInTag) optInTag.textContent = on ? 'Opted-in' : 'opt-in';
    if (optInText) optInText.textContent = on ? 'Using my details' : 'Use my details to create';
  });

  // Headshot — upload → circular crop → save as a user asset → store the ref.
  const headshotFileInput = viewEl.querySelector<HTMLInputElement>('#headshot-file');
  const paintHeadshot = (url: string) => {
    const preview = viewEl.querySelector<HTMLElement>('#headshot-preview');
    if (preview) {
      // Set the image as a background so the overlaid Edit button (and its click
      // listener) is never re-created.
      preview.classList.toggle('is-empty', !url);
      preview.style.backgroundImage = url ? `url('${url}')` : '';
    }
    const uploadBtn = viewEl.querySelector<HTMLElement>('#headshot-upload');
    if (uploadBtn) uploadBtn.textContent = url ? 'Edit' : 'Upload';
    const removeBtn = viewEl.querySelector<HTMLElement>('#headshot-remove');
    if (removeBtn) removeBtn.hidden = !url;
  };
  viewEl.querySelector('#headshot-upload')?.addEventListener('click', () => headshotFileInput?.click());
  headshotFileInput?.addEventListener('change', async () => {
    const file = headshotFileInput.files?.[0];
    headshotFileInput.value = '';
    if (!file) return;
    const cropped = await openHeadshotCropper(file);
    if (!cropped) return; // cancelled or undecodable
    const errEl = viewEl.querySelector<HTMLElement>('#headshot-error');
    if (errEl) errEl.hidden = true;
    try {
      const ref = await saveHeadshot(host, cropped.blob);
      paintHeadshot(ref.url);
      await onAssetChange();
    } catch (err) {
      host.log?.('error', 'Headshot save failed', { error: String(err) });
      // Inline + announced, matching the import-dialog error pattern — not a
      // blocking alert(). e.g. the storage-cap message.
      const msg = String(err instanceof Error ? err.message : err);
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
    await onAssetChange();
  });

  // Personal details form
  viewEl.querySelector('#profile-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const form = e.target;
    if (!(form instanceof HTMLFormElement)) return;
    const btn = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    const label = btn?.textContent ?? 'Save';
    if (btn) btn.disabled = true;
    // Text fields only — the form has no named file inputs, so every entry is a string.
    const data: Record<string, string> = {};
    for (const [k, v] of new FormData(form).entries()) {
      if (typeof v === 'string') data[k] = v;
    }
    // Checkboxes aren't reliably in FormData (omitted when unchecked), so read it explicitly.
    const useDetails = form.querySelector<HTMLInputElement>('[name="useDetails"]')?.checked ?? false;
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
}
