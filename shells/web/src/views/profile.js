/**
 * Profile view — personal details + appearance preferences.
 *
 * Theme selection auto-saves on click (it's a preference, not a form field).
 * The other personal details save on form submit.
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

// Friendly labels for the raw profile field keys.
const FIELD_LABELS = {
  firstname: 'First name', lastname: 'Last name', email: 'Email',
  phone: 'Phone', city: 'City', country: 'Country',
};

// The headshot lives in the user-assets store under one fixed id (so a new one
// overwrites the old and it only ever occupies a single slot), and is kept out
// of the "My images" library list.
const HEADSHOT_ID = 'user/headshot';

// A small "i" badge with a hover/focus tooltip — used beside storage headings.
// A real <button> (not a tabbable span) so its role + keyboard focus are native.
const infoDot = (text) =>
  `<button type="button" class="info-dot" aria-label="${escape(text)}">i<span class="info-tip" aria-hidden="true">${escape(text)}</span></button>`;

export async function mountProfile(viewEl, host, params = '') {
  document.title = 'Profile — Lolly';
  const [profile, storageEst, sessions, sessionSizes, cacheSize, allUserImages, userImagesSize] = await Promise.all([
    host.profile.get(),
    navigator.storage?.estimate().catch(() => null),
    host.state.list(),
    host.state.sizes(),
    host.assets._blobCacheSize().catch(() => 0),
    host.assets._listUserAssets().catch(() => []),
    host.assets._userAssetsSize().catch(() => 0),
  ]);
  const fields = ['firstname', 'lastname', 'email', 'phone', 'city', 'country'];
  const currentTheme = profile.theme ?? localStorage.getItem('theme') ?? 'light';
  const sortedSessions = [...sessions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const metrics = getMetrics();
  const toolIndex = window.__toolIndex?.tools ?? [];
  // The headshot is a user asset; keep it out of the "My images" grid and
  // re-resolve it (the stored object URL goes stale across reloads).
  const userImages = allUserImages.filter(a => a.id !== HEADSHOT_ID);
  const headshotRef = profile.headshot?.id ? await host.assets.get(profile.headshot.id).catch(() => null) : null;
  let headshotUrl = headshotRef?.url || '';

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
    <a href="#/platform" class="profile-platform-link" aria-label="Platform — brand colours, fonts &amp; global settings">Platform</a>
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
                  <input type="text" name="${f}" value="${escape(profile[f] ?? '')}" autocomplete="off" placeholder=" ">
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
              </div>
              <div class="profile-field">
                <span class="profile-field-label">Theme</span>
                <div class="segmented-control" id="theme-picker">
                  ${THEMES.map(t => `<button type="button" class="segmented-btn" data-theme-value="${t}" aria-pressed="${t === currentTheme}">${escape(t.charAt(0).toUpperCase() + t.slice(1))}</button>`).join('')}
                </div>
              </div>
            </aside>
          </div>
        </form>
      </section>

      ${renderActivity(metrics, toolIndex)}

      <section class="profile-card">
        <h2>Storage</h2>
        <div class="storage-row">
          <span class="storage-indicator-profile" id="storage-usage">${storageEst ? storageBar(storageEst) : 'Unavailable'}</span>
        </div>

        <div class="storage-subsection">
          <div class="storage-subsection-header">
            <span>Saved sessions ${infoDot('Delete individual sessions from the gallery.')} <span id="session-count" class="storage-count">${sortedSessions.length}</span> <span id="session-total-size" class="storage-hint">${fmtBytes(Object.values(sessionSizes).reduce((s, n) => s + n, 0))}</span></span>
          </div>
        </div>

        <div class="storage-subsection">
          <div class="storage-subsection-header">
            <span>My images ${infoDot(`Images saved here are ready to reuse across tools — up to ${MAX_USER_ASSETS}. Add them here or from inside any tool.`)} <span id="userimg-count" class="storage-count">${userImages.length}/${MAX_USER_ASSETS}</span> <span id="userimg-size" class="storage-hint">${fmtBytes(userImagesSize)}</span></span>
          </div>
          <div class="userimg-grid" id="userimg-grid">
            ${userImages.map(userImageThumb).join('')}
            <button type="button" class="userimg-add" id="userimg-add" aria-label="Add images"${userImages.length >= MAX_USER_ASSETS ? ' hidden' : ''}>
              <span class="userimg-add-icon" aria-hidden="true">+</span>
              <span class="userimg-add-text">Add</span>
            </button>
          </div>
          <input type="file" id="userimg-file" accept="image/svg+xml,image/png,image/jpeg,image/webp" multiple hidden>
        </div>

        <div class="storage-subsection">
          <div class="storage-subsection-header">
            <span>Asset cache ${infoDot('Downloaded catalog content. On-demand assets not referenced by a saved session are automatically removed on next load.')} <span class="storage-count" id="cache-size-label">${fmtBytes(cacheSize)}</span></span>
          </div>
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
          <button type="button" id="clear-cache-btn" class="btn-link-danger">Clear cache</button>
          <button type="button" id="clear-storage-btn" class="btn btn-danger">Clear all my data</button>
        </div>
      </section>

      <section class="profile-card" id="feature-flags-section">
        <h2>Feature flags</h2>
        <p class="storage-hint-text feature-hint-text">Self-governance, autonomy, choice. Enable or disable parts of the app here</p>
        <ul class="feature-flags" id="feature-flags">
          ${CATEGORY_FLAGS.map(flagRow).join('')}
          <li class="feature-flag-divider" role="separator"></li>
          ${flagRow(PRO_FLAG)}
        </ul>
      </section>

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
  // to nudge re-enabling categories — scroll the section into view on arrival.
  if (new URLSearchParams(params).get('focus') === 'feature-flags') {
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
    try {
      const ref = await saveHeadshot(host, cropped.blob);
      paintHeadshot(ref.url);
      await refreshCounter();
    } catch (err) {
      host.log?.('error', 'Headshot save failed', { error: String(err) });
      alert(String(err?.message ?? err)); // e.g. the storage-cap message
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

  // Live storage counter helper
  async function refreshCounter() {
    const est = await navigator.storage?.estimate().catch(() => null);
    const el = viewEl.querySelector('#storage-usage');
    if (el && est) el.innerHTML = storageBar(est);
  }

  // Re-query the user image count + size and reflect them in the header and the
  // "Add" tile (hidden once the cap is reached). Shared by the add and delete
  // paths so they never drift.
  const userimgAddBtn = viewEl.querySelector('#userimg-add');
  async function syncUserImgMeta() {
    const [list, size] = await Promise.all([
      host.assets._listUserAssets().catch(() => []),
      host.assets._userAssetsSize().catch(() => 0),
    ]);
    const count = list.filter(a => a.id !== HEADSHOT_ID).length; // exclude the headshot
    const countEl = viewEl.querySelector('#userimg-count');
    const sizeEl  = viewEl.querySelector('#userimg-size');
    if (countEl) countEl.textContent = `${count}/${MAX_USER_ASSETS}`;
    if (sizeEl)  sizeEl.textContent  = fmtBytes(size);
    if (userimgAddBtn) userimgAddBtn.hidden = count >= MAX_USER_ASSETS;
    await refreshCounter();
  }

  // Add images directly from the profile — same upload path as the in-tool
  // picker, so files are downscaled/re-encoded and capped identically. New
  // thumbs prepend (newest-first) ahead of the persistent "Add" tile.
  const userimgFile = viewEl.querySelector('#userimg-file');
  userimgAddBtn?.addEventListener('click', () => userimgFile?.click());
  userimgFile?.addEventListener('change', async () => {
    const files = [...(userimgFile.files ?? [])];
    userimgFile.value = '';
    if (!files.length) return;
    if (userimgAddBtn) userimgAddBtn.disabled = true;
    for (const file of files) {
      try {
        const ref = await storeUserUpload(host, file);
        userImages.unshift(ref); // keep the lightbox lookup in sync, newest-first
        viewEl.querySelector('#userimg-grid')
          ?.insertAdjacentHTML('afterbegin', userImageThumb(ref));
      } catch (err) {
        host.log?.('error', 'Image upload failed', { name: file.name, error: String(err) });
        alert(String(err?.message ?? err)); // e.g. the cap / storage-full message
        break; // stop the batch on a cap/quota error
      }
    }
    if (userimgAddBtn) userimgAddBtn.disabled = false;
    await syncUserImgMeta();
  });

  // My images — view on thumbnail click, delete on the ✕ (one delegated handler).
  // Images are a standalone library, independent of sessions, so only delete and
  // "Clear all my data" remove them.
  viewEl.querySelector('#userimg-grid')?.addEventListener('click', async e => {
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
    try {
      await host.assets._deleteUserAsset(id);
    } catch (err) {
      host.log('error', 'Failed to delete image', { id, error: String(err) });
      btn.disabled = false;
      return;
    }
    btn.closest('[data-userimg]')?.remove();
    const i = userImages.findIndex(a => a.id === id);
    if (i !== -1) userImages.splice(i, 1);
    // The grid keeps the "Add" tile even when empty, so there's no blank state to
    // render — just refresh counts and the cap state.
    await syncUserImgMeta();
  });

  // Clear asset cache only — update the cache size label after clearing
  viewEl.querySelector('#clear-cache-btn')?.addEventListener('click', async e => {
    const btn = e.target;
    btn.disabled = true;
    btn.textContent = 'Clearing…';
    await clearIdbStores(['asset-blob', 'asset-meta']);
    const sizeEl = viewEl.querySelector('#cache-size-label');
    if (sizeEl) sizeEl.textContent = fmtBytes(0);
    btn.textContent = 'Cleared';
    setTimeout(() => { btn.textContent = 'Clear cache'; btn.disabled = false; }, 1500);
    await refreshCounter();
  });

  // Clear all — confirmation dialog
  viewEl.querySelector('#clear-storage-btn')?.addEventListener('click', () => {
    const overlay = document.createElement('div');
    overlay.className = 'clear-dialog-overlay';
    overlay.innerHTML = `
      <div class="clear-dialog" role="dialog" aria-modal="true" aria-labelledby="clear-dialog-title">
        <h3 id="clear-dialog-title">Clear all my data?</h3>
        <p>This removes your profile, all saved sessions, your uploaded images, and the asset cache. Cannot be undone.</p>
        <div class="clear-dialog-actions">
          <button class="btn btn-danger" data-scope="all">Clear everything</button>
          <button class="btn" data-scope="cancel">Cancel</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', async e => {
      const scope = e.target.closest('[data-scope]')?.dataset.scope;
      if (!scope || scope === 'cancel') { overlay.remove(); return; }

      const btns = overlay.querySelectorAll('button');
      btns.forEach(b => (b.disabled = true));
      e.target.textContent = 'Clearing…';

      localStorage.clear();
      sessionStorage.clear();
      await clearIdbStores(['state', 'profile', 'user-assets', 'asset-blob', 'asset-meta']);
      host.profile.bust();
      applyTheme('light');
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
      host.log('error', 'Data export failed', { error: String(err) });
      btn.textContent = 'Export failed';
    }
    setTimeout(() => { btn.textContent = prev; btn.disabled = false; }, 1800);
  });

  // Import a bundle from another install (merge-overwrite), then re-mount to reflect it.
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

  // Personal details form
  viewEl.querySelector('#profile-form').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;
    const data = Object.fromEntries(new FormData(e.target).entries());
    // Checkboxes aren't reliably in FormData (omitted when unchecked), so read it explicitly.
    const useDetails = e.target.querySelector('[name="useDetails"]')?.checked ?? false;
    delete data.useDetails;
    const current = await host.profile.get();
    await host.profile.set({ ...current, ...data, useDetails });
    if (btn) btn.textContent = 'Saved';
    announce('Profile saved');
    setTimeout(() => { window.location.hash = ''; }, 800);
  });
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
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
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

  overlay.addEventListener('click', async e => {
    const scope = e.target.closest('[data-scope]')?.dataset.scope;
    if (!scope) return;
    if (scope === 'cancel') { overlay.remove(); return; }

    const btns = overlay.querySelectorAll('button');
    const errEl = overlay.querySelector('.import-error');
    btns.forEach(b => (b.disabled = true));
    e.target.textContent = 'Importing…';
    try {
      await onConfirm();
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
// nothing here is recorded remotely — hence the "0 uploaded" line.
function renderActivity(m, tools) {
  const hasAny = m.filesRendered || m.toolOpens || m.linksCopied || m.imagesCopied || m.batchRuns;
  if (!hasAny) {
    return `<section class="profile-card profile-activity">
      <h2>Your activity</h2>
      <p class="storage-hint-text">Nothing here yet — open a tool and make something. It all gets counted right here on your device.</p>
    </section>`;
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

  return `<section class="profile-card profile-activity">
    <h2>Your activity</h2>
    ${body}
    <p class="activity-meta">${meta}</p>
  </section>`;
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

function storageBar({ usage = 0, quota = 0 }) {
  const mb   = usage / 1024 / 1024;
  const used = mb < 1 ? `${Math.round(usage / 1024)} KB` : `${mb.toFixed(1)} MB`;
  if (!quota) return used;
  const pct = Math.min(100, Math.round((usage / quota) * 100));
  const quotaMb = quota / 1024 / 1024;
  const cap = quotaMb >= 1024
    ? `${(quotaMb / 1024).toFixed(0)} GB`
    : `${Math.round(quotaMb)} MB`;
  return `<span class="storage-bar-wrap"><span class="storage-bar-fill" style="width:${pct}%"></span></span>${used} of ${cap}`;
}
