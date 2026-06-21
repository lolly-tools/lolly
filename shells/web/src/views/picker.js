/**
 * Asset Picker — a host-owned modal UI.
 *
 * Why this is a host concern, not a tool concern: tools have no business
 * rendering picker chrome. They declare what they want; the host owns the
 * UX. This means picker UX improves across every tool simultaneously.
 *
 * Mounted lazily on first use. The picker calls back into:
 *   - host.assets.query(filter)  → list candidate library assets
 *   - host.assets.get(id)        → resolve the chosen one to an AssetRef
 *   - user-asset upload          → stores blob in IDB, returns user/* AssetRef
 *
 * Exported function: openPicker(host, opts) → Promise<AssetRef | null>
 */

import DOMPurify from 'dompurify';
import { downscaleRaster } from '../bridge/image-resize.js';
import { MAX_USER_ASSETS } from '../bridge/assets.js';

let modalEl = null;

export function openPicker(host, opts = {}) {
  return new Promise(resolve => {
    if (!modalEl) {
      modalEl = document.createElement('div');
      modalEl.className = 'asset-picker-modal';
      document.body.appendChild(modalEl);
    }
    render(modalEl, host, opts, resolve);
  });
}

async function render(root, host, opts, resolve) {
  // The personal-image library is offered only when this input accepts uploads.
  const showUserAssets = opts.allowUpload === true;
  let userAssets = [];

  root.innerHTML = `
    <div class="asset-picker-backdrop" aria-hidden="true"></div>
    <div class="asset-picker-panel" role="dialog" aria-modal="true" aria-labelledby="asset-picker-title">
      <header class="asset-picker-header">
        <h2 id="asset-picker-title">${escape(opts.title ?? 'Choose an asset')}</h2>
        <input type="search" class="asset-picker-search" placeholder="Search…" autocomplete="off" spellcheck="false" aria-label="Search assets">
        <button type="button" class="asset-picker-close" aria-label="Close">×</button>
      </header>
      <div class="asset-picker-body">
        ${showUserAssets ? `<section class="asset-picker-userassets" hidden></section>` : ''}
        <section class="asset-picker-library">
          <div class="asset-picker-loading">Loading…</div>
        </section>
      </div>
      ${opts.allowUpload ? `
        <footer class="asset-picker-footer">
          <label class="asset-picker-upload">
            <input type="file" accept="image/svg+xml,image/png,image/jpeg,image/webp" hidden />
            <span class="asset-picker-upload-label">Upload your own…</span>
          </label>
        </footer>
      ` : ''}
    </div>
  `;

  // Return focus to whatever opened the picker (the asset-picker trigger button)
  // when the dialog closes.
  const opener = document.activeElement;
  const close = (value) => {
    root.innerHTML = '';
    if (opener instanceof HTMLElement) opener.focus();
    resolve(value);
  };

  root.querySelector('.asset-picker-close').addEventListener('click', () => close(null));
  root.querySelector('.asset-picker-backdrop').addEventListener('click', () => close(null));

  const body        = root.querySelector('.asset-picker-body');
  const libraryEl   = root.querySelector('.asset-picker-library');
  const userEl      = root.querySelector('.asset-picker-userassets');
  const searchInput = root.querySelector('.asset-picker-search');

  // ── Keyboard navigation over the (responsive) asset grid ───────────────────
  // Cards flow left-to-right then wrap, so DOM order == visual reading order:
  // Left/Right step through that order. The column count is unknown (responsive),
  // so Up/Down can't index by row — instead they pick the geometrically nearest
  // card in the row above/below by comparing on-screen centres.
  const navCards = () => [...body.querySelectorAll('[data-asset-id]')];
  function focusCard(el) { if (el) { el.focus({ preventScroll: true }); el.scrollIntoView({ block: 'nearest' }); } }
  function moveSelection(cur, key) {
    const cards = navCards();
    const i = cards.indexOf(cur);
    if (key === 'ArrowRight') return focusCard(cards[i + 1]);
    if (key === 'ArrowLeft')  return focusCard(cards[i - 1]);
    const r = cur.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const down = key === 'ArrowDown';
    let best = null, bestScore = Infinity;
    for (const c of cards) {
      if (c === cur) continue;
      const cr = c.getBoundingClientRect();
      const vy = (cr.top + cr.height / 2) - cy;
      if (down ? vy <= r.height * 0.4 : vy >= -r.height * 0.4) continue; // must be a further row
      const dx = Math.abs((cr.left + cr.width / 2) - cx);
      const score = dx + Math.abs(vy) * 1.5; // nearest column first, then nearest row
      if (score < bestScore) { bestScore = score; best = c; }
    }
    focusCard(best);
  }

  root.querySelector('.asset-picker-panel').addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(null); return; }
    if (e.target === searchInput) {
      // Down out of the search field drops into the grid.
      if (e.key === 'ArrowDown') { e.preventDefault(); focusCard(navCards()[0]); }
      return;
    }
    const cur = e.target.closest?.('[data-asset-id]');
    if (cur && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      e.preventDefault();
      moveSelection(cur, e.key);
    }
    // Enter / Space activate the focused card button natively → selects.
  });

  // One delegated handler serves both regions: pick on a card, delete on its ✕.
  body.addEventListener('click', async (e) => {
    const del = e.target.closest('[data-delete-id]');
    if (del) {
      const id = del.dataset.deleteId;
      try {
        await host.assets._deleteUserAsset(id);
        userAssets = userAssets.filter(a => a.id !== id);
        renderUserAssets();
        updateUploadAffordance();
      } catch (err) {
        host.log('error', 'Failed to delete user image', { id, error: String(err) });
      }
      return;
    }
    const pick = e.target.closest('[data-asset-id]');
    if (pick) {
      try {
        const resolved = await host.assets.get(pick.dataset.assetId);
        close(resolved);
      } catch (err) {
        host.log('error', 'Failed to resolve asset', { id: pick.dataset.assetId, error: String(err) });
        alert(`Could not resolve asset: ${err.message}`);
      }
    }
  });

  function renderUserAssets() {
    if (!userEl) return;
    if (userAssets.length === 0) { userEl.hidden = true; userEl.innerHTML = ''; return; }
    userEl.hidden = false;
    userEl.innerHTML = `
      <div class="asset-picker-section-head">Your images <span class="asset-picker-count">${userAssets.length}/${MAX_USER_ASSETS}</span></div>
      <div class="asset-picker-grid">${userAssets.map(userCard).join('')}</div>
    `;
  }

  function updateUploadAffordance() {
    const labelEl   = root.querySelector('.asset-picker-upload-label');
    const fileInput = root.querySelector('.asset-picker-upload input[type="file"]');
    if (!labelEl || !fileInput) return;
    const full = userAssets.length >= MAX_USER_ASSETS;
    fileInput.disabled = full;
    root.querySelector('.asset-picker-upload')?.classList.toggle('is-disabled', full);
    labelEl.textContent = full
      ? `Limit reached (${MAX_USER_ASSETS}) — remove one to add more`
      : 'Upload your own…';
  }

  if (opts.allowUpload) {
    const fileInput = root.querySelector('input[type="file"]');
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      try {
        const ref = await storeUserUpload(host, file);
        close(ref);
      } catch (e) {
        host.log('error', 'Upload failed', { error: String(e) });
        // Cap/quota errors carry a user-ready message; prefix only the rest.
        alert(e.code ? e.message : `Upload failed: ${e.message}`);
      } finally {
        fileInput.value = ''; // allow re-selecting the same file after an error
      }
    });
  }

  function renderLibrary(candidates) {
    if (candidates.length === 0) {
      libraryEl.innerHTML = `<p class="asset-picker-empty" role="status">No assets match.${opts.allowUpload ? ' Upload one below.' : ''}</p>`;
      return;
    }
    libraryEl.innerHTML = `<div class="asset-picker-grid">${candidates.map(card).join('')}</div>`;
  }

  // Load the user's saved images (filtered to the requested type) in parallel
  // with the library — they don't depend on each other.
  if (showUserAssets) {
    host.assets._listUserAssets()
      .then(list => {
        userAssets = list.filter(a => !opts.type || a.type === opts.type);
        renderUserAssets();
        updateUploadAffordance();
      })
      .catch(e => host.log('warn', 'Failed to list user images', { error: String(e) }));
  }

  try {
    const candidates = await host.assets.query(opts);
    renderLibrary(candidates);

    // Land focus on an asset (the current one if provided) so the keyboard can
    // drive the picker straight away.
    const libCards = [...libraryEl.querySelectorAll('[data-asset-id]')];
    (libCards.find(c => c.dataset.assetId === opts.current) || libCards[0])?.focus({ preventScroll: true });

    searchInput?.addEventListener('input', () => {
      const q = searchInput.value.trim().toLowerCase();
      if (!q) { renderLibrary(candidates); return; }
      renderLibrary(candidates.filter(c =>
        (c.meta?.name ?? c.id).toLowerCase().includes(q) || c.id.toLowerCase().includes(q)
      ));
    });
  } catch (e) {
    libraryEl.innerHTML = `<p class="asset-picker-error">Failed to load: ${escape(e.message)}</p>`;
  }
}

function card(ref) {
  const isPlaceholder = ref.meta?._placeholder;
  const name = ref.meta?.name ?? ref.id;
  return `
    <button type="button" class="asset-picker-card" data-asset-id="${escape(ref.id)}">
      ${isPlaceholder
        ? `<div class="asset-picker-thumb asset-picker-thumb-stub">${escape(ref.type)}</div>`
        : `<img class="asset-picker-thumb" src="${escape(ref.url)}" alt="">`}
      <span class="asset-picker-name" title="${escape(name)}">${escape(name)}</span>
      <span class="asset-picker-id">${escape(ref.id)}</span>
      ${formatBadge(ref)}
    </button>
  `;
}

function formatBadge(ref) {
  return ref.format ? `<span class="asset-picker-fmt">${escape(String(ref.format).toUpperCase())}</span>` : '';
}

// A user image: a pick button plus a delete affordance (siblings, not nested —
// nested buttons are invalid HTML and break the delegated click handler).
function userCard(ref) {
  const name = ref.meta?.name ?? 'Image';
  return `
    <div class="asset-picker-card asset-picker-card-user">
      <button type="button" class="asset-picker-card-pick" data-asset-id="${escape(ref.id)}">
        <img class="asset-picker-thumb" src="${escape(ref.url)}" alt="">
        <span class="asset-picker-name" title="${escape(name)}">${escape(name)}</span>
      </button>
      <button type="button" class="asset-picker-card-delete" data-delete-id="${escape(ref.id)}" title="Delete" aria-label="Delete ${escape(name)}">×</button>
      ${formatBadge(ref)}
    </div>
  `;
}

// Strip anything executable or external from an uploaded SVG before we persist
// it. DOMPurify's SVG profile removes <script>, on*= handlers, <foreignObject>
// scripts and external entity/resource refs while keeping the drawable markup.
// The result (even if empty for a non-SVG masquerading as one) is what we store,
// so script bytes never reach disk; we only keep the original as a last resort
// if DOMPurify itself is unavailable (it isn't in a browser).
async function sanitizeSvgFile(file) {
  try {
    const clean = DOMPurify.sanitize(await file.text(), {
      USE_PROFILES: { svg: true, svgFilters: true },
    });
    return new Blob([clean], { type: 'image/svg+xml' });
  } catch {
    return file;
  }
}

export async function storeUserUpload(host, file) {
  // Read the file as a blob, stash it in the user-assets IDB store, return
  // a `user/...` AssetRef. The bridge's assets.get() resolves these via the
  // same lookup path as library assets — uniform from the tool's POV.
  const id = `user/upload/${Date.now()}-${file.name.replace(/[^a-z0-9.-]/gi, '_')}`;
  const isVector = file.type.includes('svg');

  let blob = file;
  let format = extFromMime(file.type);
  let width, height;

  if (isVector) {
    // Vectors are resolution-independent — no raster resize. But an uploaded SVG
    // can carry <script>, on*= handlers or external refs, so sanitize on ingest
    // (belt-and-suspenders — assets render via <img>/object-URL, where scripts
    // are already inert). Dims are best-effort, read from the cleaned blob.
    blob = await sanitizeSvgFile(file);
    ({ width, height } = await readDimensions(blob).catch(() => ({})));
  } else {
    // Raster: downscale to the longest-edge cap and re-encode. This also bakes
    // in EXIF orientation and strips metadata (incl. GPS) as a side effect.
    const resized = await downscaleRaster(file);
    ({ blob, format, width, height } = resized);
  }

  const record = {
    id,
    type: isVector ? 'vector' : 'raster',
    format,
    blob,
    width,
    height,
    version: '1.0.0',
    // Rasters get re-encoded (usually to WebP), so the original extension can
    // lie — a "photo.jpg" now holds WebP bytes. Show a name whose extension
    // matches what we actually stored so the filename and format badge agree.
    meta: { name: renameExt(file.name, format) },
  };

  // Reach into the underlying IDB the bridge owns. The bridge exposes a
  // narrow upload helper rather than full DB access — keeps surface tight.
  await host.assets._uploadUserAsset(record);

  // Re-resolve via the public API so we get a proper AssetRef with object URL.
  return host.assets.get(id);
}

function readDimensions(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return resolve({});
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

function extFromMime(mime) {
  if (mime.includes('svg')) return 'svg';
  if (mime.includes('png')) return 'png';
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  if (mime.includes('webp')) return 'webp';
  return 'bin';
}

// Swap a filename's extension for `ext` (e.g. "photo.jpg" -> "photo.webp").
// Appends if there was no extension; collapses an already-matching one.
function renameExt(name, ext) {
  return String(name ?? '').replace(/\.[^./\\]+$/, '') + '.' + ext;
}

function escape(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}
