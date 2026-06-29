// SPDX-License-Identifier: MPL-2.0
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
 *   - host.state.list()/load()   → the user's saved tool sessions (Saved creations)
 *   - host.compose.renderUrl()   → render a Lolly tool/session as the image
 *   - user-asset upload          → stores blob in IDB, returns user/* AssetRef
 *
 * Three ways in beyond the library, all producing an ordinary image AssetRef:
 *   - "Saved creations" — a previous saved single-tool session, re-rendered to an image
 *   - "Tools"           — any local tool, configured first (opts.editTool) then inserted
 *   - paste a Lolly link in the search box (the original smart-paste flow)
 *
 * Exported function: openPicker(host, opts) → Promise<AssetRef | null>
 *   opts.editTool?(toolUrl) → Promise<AssetRef|null> — when present, choosing a tool
 *   opens the full input editor (the caller wires it to tool.js's openEmbedEditor) so
 *   the user can configure the tool before it's inserted. Absent (e.g. batch mode) →
 *   the picker falls back to its inline format/size render card.
 */

import DOMPurify from 'dompurify';
import { createRuntime, serializeUrlState, buildEmbedUrl } from '@lolly/engine';
import { getTool } from '../bridge/tool-loader.js';
import { downscaleRaster } from '../bridge/image-resize.js';
import { MAX_USER_ASSETS } from '../bridge/assets.js';

let modalEl = null;

// Lucide-style camera glyph for the "Take a photo" affordance (themes via currentColor).
const cameraGlyph = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>';

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

  // "Take a photo" is offered on the same terms as upload (the slot accepts the
  // user's own images) for raster-capable slots, when the browser exposes a camera.
  // It produces an ordinary raster AssetRef — no engine/bridge involvement, purely a
  // shell affordance like upload. Pixels are captured + stored on-device.
  const canWebcam = showUserAssets && opts.type !== 'vector'
    && typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);

  // Smart-paste / compose: any image slot can render a Lolly tool (or a previous
  // saved creation) AS the image — available whenever the shell can compose and the
  // slot isn't video-only. The toolId in any link/tool must resolve to a real local
  // tool, so this can only ever render a tool that ships in this build.
  const allowToolUrl = Boolean(host.compose?.renderUrl && host.compose?._describeUrl)
    && opts.type !== 'video';

  // A vector slot wants vector renders, so only tools that can emit SVG qualify.
  const needsSvg = opts.type === 'vector';

  // The runtime tool list is populated at boot by catalog/sync (window.__toolIndex);
  // every field we need (id, name, icon, formats, exportable) is already on it, so no
  // fetch. Restrict to tools that can produce an image (mirrors compose IMAGE_FORMATS)
  // and, for a vector slot, SVG specifically.
  const toolIndex = (typeof window !== 'undefined' && window.__toolIndex?.tools) || [];
  const toolById  = new Map(toolIndex.map(t => [t.id, t]));
  const embedTools = allowToolUrl
    ? toolIndex.filter(t => isEmbeddable(t, needsSvg)).sort((a, b) => a.name.localeCompare(b.name))
    : [];

  // Saved single-tool sessions (filled async below); null while loading.
  let sessions = null;

  // Which sources get a tab. Library is always present; the rest are conditional.
  const tabs = [{ id: 'library', label: 'Library' }];
  if (allowToolUrl) tabs.push({ id: 'sessions', label: 'Saved creations' });
  if (embedTools.length) tabs.push({ id: 'tools', label: 'Tools' });
  let activeTab = 'library';

  const placeholderFor = (id) =>
    id === 'tools'    ? 'Search tools…'
    : id === 'sessions' ? 'Search your saved creations…'
    : allowToolUrl    ? 'Search, or paste a Lolly link…'
    : 'Search…';

  root.innerHTML = `
    <div class="asset-picker-backdrop" aria-hidden="true"></div>
    <div class="asset-picker-panel" role="dialog" aria-modal="true" aria-labelledby="asset-picker-title">
      <header class="asset-picker-header">
        <h2 id="asset-picker-title">${escape(opts.title ?? 'Choose an asset')}</h2>
        <input type="search" class="asset-picker-search" placeholder="${escape(placeholderFor('library'))}" autocomplete="off" spellcheck="false" aria-label="Search assets">
        <button type="button" class="asset-picker-close" aria-label="Close">×</button>
      </header>
      ${tabs.length > 1 ? `<div class="asset-picker-tabs" role="tablist">${tabs.map(tabBtn).join('')}</div>` : ''}
      <div class="asset-picker-body">
        <section class="asset-picker-pane" data-pane="library">
          ${showUserAssets ? `<section class="asset-picker-userassets" hidden></section>` : ''}
          <section class="asset-picker-library">
            <div class="asset-picker-loading">Loading…</div>
          </section>
        </section>
        ${allowToolUrl ? `<section class="asset-picker-pane" data-pane="sessions" hidden></section>` : ''}
        ${embedTools.length ? `<section class="asset-picker-pane" data-pane="tools" hidden></section>` : ''}
        <div class="asset-picker-toolcard-host" hidden></div>
      </div>
      ${opts.allowUpload ? `
        <footer class="asset-picker-footer">
          <label class="asset-picker-upload">
            <input type="file" accept="image/svg+xml,image/png,image/jpeg,image/webp" hidden />
            <span class="asset-picker-upload-label">Upload your own…</span>
          </label>
          ${canWebcam ? `<button type="button" class="asset-picker-webcam">${cameraGlyph} Take a photo</button>` : ''}
        </footer>
      ` : ''}
    </div>
  `;

  function tabBtn(tab) {
    const on = tab.id === activeTab;
    return `<button type="button" class="asset-picker-tab${on ? ' is-active' : ''}" role="tab" data-tab="${tab.id}" aria-selected="${on}">${escape(tab.label)}</button>`;
  }

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

  const body         = root.querySelector('.asset-picker-body');
  const libraryEl    = root.querySelector('.asset-picker-library');
  const userEl       = root.querySelector('.asset-picker-userassets');
  const searchInput  = root.querySelector('.asset-picker-search');
  const toolcardHost = root.querySelector('.asset-picker-toolcard-host');
  const footerEl     = root.querySelector('.asset-picker-footer');
  const sessionsPane = root.querySelector('.asset-picker-pane[data-pane="sessions"]');
  const toolsPane    = root.querySelector('.asset-picker-pane[data-pane="tools"]');

  // ── Keyboard navigation over the (responsive) card grid ────────────────────
  // Cards flow left-to-right then wrap, so DOM order == visual reading order:
  // Left/Right step through that order. The column count is unknown (responsive),
  // so Up/Down can't index by row — instead they pick the geometrically nearest
  // card in the row above/below by comparing on-screen centres. Scoped to the
  // currently visible pane so arrows never jump into a hidden one.
  const visiblePane = () => root.querySelector('.asset-picker-pane:not([hidden])');
  const navCards = () => {
    const pane = visiblePane();
    return pane ? [...pane.querySelectorAll('[data-asset-id],[data-tool-id],[data-session-slot]')] : [];
  };
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
      // Enter commits a ready tool-render card (paste link → ↵ → use).
      if (e.key === 'Enter') {
        const use = root.querySelector('.asset-picker-toolcard .tc-use');
        if (use && !use.disabled) { e.preventDefault(); use.click(); }
        return;
      }
      // Down out of the search field drops into the grid.
      if (e.key === 'ArrowDown') { e.preventDefault(); focusCard(navCards()[0]); }
      return;
    }
    const cur = e.target.closest?.('[data-asset-id],[data-tool-id],[data-session-slot]');
    if (cur && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      e.preventDefault();
      moveSelection(cur, e.key);
    }
    // Enter / Space activate the focused card button natively → selects.
  });

  // Tab strip: switch which source pane is visible.
  root.querySelector('.asset-picker-tabs')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tab]');
    if (btn) setTab(btn.dataset.tab);
  });

  // One delegated handler serves every region: pick a library/user asset, delete a
  // user image, embed a saved session, or open a tool.
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
    const sess = e.target.closest('[data-session-slot]');
    if (sess) { embedSession(sess.dataset.sessionSlot); return; }
    const tool = e.target.closest('[data-tool-id]');
    if (tool) { embedTool(tool.dataset.toolId); return; }
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

  // A tool preview is a build artifact that can 404 (catalog/previews/ isn't committed
  // and build:web doesn't generate it) — when one fails, reveal the tool's inline icon
  // instead of a broken image. Error events don't bubble, so listen in the capture
  // phase, scoped to tool previews so library/session thumbs are untouched (mirrors
  // gallery.js).
  body.addEventListener('error', (e) => {
    const img = e.target;
    if (img instanceof HTMLImageElement && img.classList.contains('asset-picker-toolitem-preview')) {
      img.closest('.asset-picker-toolitem')?.classList.add('no-preview');
    }
  }, true);

  function setFooter(show) { footerEl?.toggleAttribute('hidden', !show); }

  // Show/hide panes for the chosen tab, dismiss any tool-render takeover, re-filter
  // the now-visible pane with the current query, and land focus on its first card.
  function setTab(id) {
    activeTab = id;
    root.querySelectorAll('.asset-picker-tab').forEach(b => {
      const on = b.dataset.tab === id;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-selected', String(on));
    });
    toolcardHost.hidden = true;
    toolcardHost.innerHTML = '';
    root.querySelectorAll('.asset-picker-pane').forEach(p => { p.hidden = p.dataset.pane !== id; });
    setFooter(id === 'library');
    searchInput.placeholder = placeholderFor(id);
    const raw = searchInput.value.trim();
    const q = raw.toLowerCase();
    // A URL in the box is a paste-to-render intent, handled by the search listener —
    // don't fight it by re-filtering a list underneath.
    if (!(allowToolUrl && /^https?:\/\//i.test(raw))) {
      if (id === 'library') restoreLibrary(q);
      else if (id === 'sessions') renderSessions(q);
      else if (id === 'tools') renderTools(q);
    }
    const first = navCards()[0];
    if (first) first.focus({ preventScroll: true });
  }

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

  // "Take a photo": open a live webcam preview, capture one frame, and store it as an
  // ordinary raster user asset (same path + AssetRef as an upload). Camera teardown is
  // handled inside openWebcamCapture so no track outlives the dialog.
  root.querySelector('.asset-picker-webcam')?.addEventListener('click', async () => {
    const ref = await openWebcamCapture(host);
    if (ref) close(ref);
  });

  function renderLibrary(candidates) {
    if (candidates.length === 0) {
      libraryEl.innerHTML = `<p class="asset-picker-empty" role="status">No assets match.${opts.allowUpload ? ' Upload one below.' : ''}</p>`;
      return;
    }
    libraryEl.innerHTML = `<div class="asset-picker-grid">${candidates.map(card).join('')}</div>`;
  }

  // Library candidates resolve async (host.assets.query); `restoreLibrary` filters
  // them and is safe to call before they land (shows the loading state until then).
  let libraryCandidates = [];
  let libraryLoaded = false;
  function restoreLibrary(q) {
    renderUserAssets();
    if (!libraryLoaded) { libraryEl.innerHTML = `<div class="asset-picker-loading">Loading…</div>`; return; }
    if (!q) { renderLibrary(libraryCandidates); return; }
    renderLibrary(libraryCandidates.filter(c =>
      (c.meta?.name ?? c.id).toLowerCase().includes(q) || c.id.toLowerCase().includes(q)
    ));
  }

  // ── Saved creations (previous single-tool sessions) ────────────────────────
  function renderSessions(q) {
    if (!sessionsPane) return;
    if (sessions === null) { sessionsPane.innerHTML = `<div class="asset-picker-loading">Loading…</div>`; return; }
    const list = q
      ? sessions.filter(s => (s.toolName ?? '').toLowerCase().includes(q)
          || (s.label ?? '').toLowerCase().includes(q) || s.toolId.includes(q))
      : sessions;
    if (list.length === 0) {
      sessionsPane.innerHTML = `<p class="asset-picker-empty">${sessions.length
        ? 'No saved creations match.'
        : 'No saved creations yet — save a tool you’ve made, then embed it here as an image.'}</p>`;
      return;
    }
    sessionsPane.innerHTML =
      `<div class="asset-picker-section-head">Your saved creations <span class="asset-picker-count">${sessions.length}</span></div>` +
      `<div class="asset-picker-grid">${list.map(sessionCard).join('')}</div>`;
  }

  // ── Tools (configure first, then insert) ───────────────────────────────────
  function renderTools(q) {
    if (!toolsPane) return;
    const list = q
      ? embedTools.filter(t => t.name.toLowerCase().includes(q)
          || (t.description ?? '').toLowerCase().includes(q) || t.id.includes(q))
      : embedTools;
    if (list.length === 0) { toolsPane.innerHTML = `<p class="asset-picker-empty">No tools match.</p>`; return; }
    toolsPane.innerHTML =
      `<div class="asset-picker-section-head">Make an image from a tool <span class="asset-picker-count">${embedTools.length}</span></div>` +
      `<div class="asset-picker-grid asset-picker-toolgrid">${list.map(toolCard).join('')}</div>`;
  }

  // Take over the body with the tool-render card / a status message (back returns
  // to the active pane). Used by the paste flow, saved-session embeds, and the
  // tools fallback when no input editor is available.
  function showTakeover(html) {
    root.querySelectorAll('.asset-picker-pane').forEach(p => { p.hidden = true; });
    setFooter(false);
    toolcardHost.hidden = false;
    toolcardHost.innerHTML = html;
  }
  function dismissTakeover() {
    searchInput.value = '';
    setTab(activeTab);
  }

  // Build the "render this Lolly tool/session as your image" card: detected-tool
  // header, format + size controls, a live preview, and a commit button. "Use this
  // render" resolves the picker with a tool-sourced AssetRef whose id is the
  // canonical embed URL, so it persists + re-renders exactly like a library asset.
  // `editUrl` (when the host provided opts.editTool) adds an "Edit inputs…" escape
  // hatch into the full input editor.
  function showToolCard(desc, url, { editUrl } = {}) {
    const allowed = formatsForType(desc.formats, opts.type);
    const fmtOptions = allowed.map(f =>
      `<option value="${escape(f)}"${f === desc.format ? ' selected' : ''}>${escape(f.toUpperCase())}</option>`
    ).join('');
    const canEdit = Boolean(editUrl && opts.editTool);
    showTakeover(`
      <div class="asset-picker-toolcard">
        <div class="asset-picker-toolcard-head">
          <button type="button" class="asset-picker-toolcard-back" aria-label="Back to list">←</button>
          <span class="asset-picker-toolcard-spark" aria-hidden="true">✦</span>
          <span>Render the <strong>${escape(desc.name)}</strong> tool as your image</span>
        </div>
        <div class="asset-picker-toolcard-controls">
          <label>Format <select class="tc-format" aria-label="Render format">${fmtOptions}</select></label>
          <label>Width <input type="number" class="tc-w" min="1" inputmode="numeric" placeholder="auto" value="${desc.width ?? ''}"></label>
          <label>Height <input type="number" class="tc-h" min="1" inputmode="numeric" placeholder="auto" value="${desc.height ?? ''}"></label>
        </div>
        <div class="asset-picker-toolcard-preview"><div class="asset-picker-loading">Rendering…</div></div>
        <div class="asset-picker-toolcard-actions">
          ${canEdit ? `<button type="button" class="tc-edit">Edit inputs…</button>` : ''}
          <button type="button" class="tc-use" disabled>Use this render</button>
        </div>
      </div>`);
    const cardEl    = toolcardHost.querySelector('.asset-picker-toolcard');
    const fmtSel    = cardEl.querySelector('.tc-format');
    const wEl       = cardEl.querySelector('.tc-w');
    const hEl       = cardEl.querySelector('.tc-h');
    const previewEl = cardEl.querySelector('.asset-picker-toolcard-preview');
    const useBtn    = cardEl.querySelector('.tc-use');

    cardEl.querySelector('.asset-picker-toolcard-back')?.addEventListener('click', dismissTakeover);
    if (canEdit) {
      cardEl.querySelector('.tc-edit')?.addEventListener('click', async () => {
        const ref = await opts.editTool(editUrl);
        if (ref) close(ref);
      });
    }

    let pending = null;     // the AssetRef the Use button will commit
    let renderSeq = 0;      // drop a stale render when controls change again
    const renderPreview = async () => {
      const seq = ++renderSeq;
      pending = null;
      useBtn.disabled = true;
      previewEl.innerHTML = `<div class="asset-picker-loading">Rendering…</div>`;
      const ref = await host.compose.renderUrl(url, {
        format: fmtSel.value,
        width:  parseInt(wEl.value, 10) || undefined,
        height: parseInt(hEl.value, 10) || undefined,
      }).catch(() => null);
      if (seq !== renderSeq) return; // a newer change supersedes this render
      if (!ref) { previewEl.innerHTML = `<p class="asset-picker-error">Couldn't render this link.</p>`; return; }
      pending = ref;
      previewEl.innerHTML = `<img class="asset-picker-toolcard-img" src="${escape(ref.url)}" alt="Preview of the ${escape(desc.name)} render">`;
      useBtn.disabled = false;
    };

    let debounce;
    const onSize = () => { clearTimeout(debounce); debounce = setTimeout(renderPreview, 350); };
    fmtSel.addEventListener('change', renderPreview);
    wEl.addEventListener('input', onSize);
    hEl.addEventListener('input', onSize);
    useBtn.addEventListener('click', () => { if (pending) close(pending); });
    renderPreview();
  }

  // Open a saved single-tool session as an image: reconstruct its canonical embed
  // URL from the stored values (the same createRuntime → serializeUrlState → buildEmbedUrl
  // recipe the in-place editor uses) and hand it to the render card. Pre-configured,
  // so it goes straight to preview/size — with an Edit-inputs escape hatch.
  async function embedSession(slot) {
    const entry = (sessions ?? []).find(s => s.slot === slot);
    if (!entry) return;
    showTakeover(`<div class="asset-picker-loading">Opening “${escape(entry.toolName)}”…</div>`);
    try {
      const data = await host.state.load(slot);
      if (!data) throw new Error('empty session');
      const tool = await getTool(entry.toolId);
      const runtime = await createRuntime(tool, host, data);
      const query = serializeUrlState(runtime.getModel());
      const url = buildEmbedUrl({ toolId: entry.toolId, format: imageFormatSeed(data.__export_format), query });
      const desc = url ? await host.compose._describeUrl(url) : null;
      if (!url || !desc) throw new Error('not renderable');
      showToolCard(desc, url, { editUrl: url });
    } catch (e) {
      host.log('warn', 'Embed saved session failed', { slot, error: String(e) });
      showTakeover(`<p class="asset-picker-error">Couldn't open this saved creation.</p><div class="asset-picker-toolcard-actions"><button type="button" class="tc-back">← Back</button></div>`);
      toolcardHost.querySelector('.tc-back')?.addEventListener('click', dismissTakeover);
    }
  }

  // Open a tool with default inputs. If the host gave us an input editor (top-level /
  // block asset slots do), configure it FIRST then insert; otherwise fall back to the
  // inline format/size render card on the tool's defaults.
  async function embedTool(toolId) {
    const t = toolById.get(toolId);
    const url = buildEmbedUrl({ toolId, format: 'svg', query: '' });
    if (!url) return;
    if (opts.editTool) {
      const ref = await opts.editTool(url);
      if (ref) close(ref);
      return; // cancelled → stay on the Tools tab
    }
    showTakeover(`<div class="asset-picker-loading">Opening ${escape(t?.name ?? toolId)}…</div>`);
    const desc = await host.compose._describeUrl(url).catch(() => null);
    if (desc) showToolCard(desc, url, { editUrl: url });
    else {
      showTakeover(`<p class="asset-picker-error">Couldn't open this tool.</p><div class="asset-picker-toolcard-actions"><button type="button" class="tc-back">← Back</button></div>`);
      toolcardHost.querySelector('.tc-back')?.addEventListener('click', dismissTakeover);
    }
  }

  // Load the user's saved images (filtered to the requested type) in parallel with
  // the library — they don't depend on each other.
  if (showUserAssets) {
    host.assets._listUserAssets()
      .then(list => {
        userAssets = list.filter(a => !opts.type || a.type === opts.type);
        renderUserAssets();
        updateUploadAffordance();
      })
      .catch(e => host.log('warn', 'Failed to list user images', { error: String(e) }));
  }

  // Load saved sessions in parallel too (only when composing is possible). Restrict
  // to single-tool sessions whose tool still ships AND can render an image.
  if (allowToolUrl) {
    host.state.list()
      .then(list => {
        sessions = (list ?? [])
          .filter(e => e.slot && !e.slot.startsWith('__batch__:')) // single-tool only (see pro/sessions.js)
          .filter(e => e.toolId && isEmbeddable(toolById.get(e.toolId), needsSvg))
          .map(e => {
            const t = toolById.get(e.toolId);
            return {
              slot: e.slot, toolId: e.toolId, label: e.label,
              toolName: t?.name ?? e.toolId, toolIcon: t?.icon ?? null,
              thumb: e.thumb ?? null, updatedAt: e.updatedAt,
            };
          })
          .sort((a, b) => String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? '')));
        if (activeTab === 'sessions') renderSessions(searchInput.value.trim().toLowerCase());
      })
      .catch(e => {
        host.log('warn', 'Failed to list saved sessions', { error: String(e) });
        sessions = [];
        if (activeTab === 'sessions') renderSessions('');
      });
  }

  try {
    const candidates = await host.assets.query(opts);
    libraryCandidates = candidates;
    libraryLoaded = true;
    renderLibrary(candidates);

    // Land focus on an asset (the current one if provided) so the keyboard can
    // drive the picker straight away.
    const libCards = [...libraryEl.querySelectorAll('[data-asset-id]')];
    (libCards.find(c => c.dataset.assetId === opts.current) || libCards[0])?.focus({ preventScroll: true });

    // A Lolly tool URL pasted into the search box flips the picker into a "render
    // this tool" card; anything else filters the active pane. The seq guard drops a
    // stale describeUrl (async tool load) when the user keeps typing.
    let detectSeq = 0;
    searchInput?.addEventListener('input', async () => {
      const raw = searchInput.value.trim();
      if (allowToolUrl && /^https?:\/\//i.test(raw)) {
        const seq = ++detectSeq;
        showTakeover(`<div class="asset-picker-loading">Checking link…</div>`);
        const desc = await host.compose._describeUrl(raw).catch(() => null);
        if (seq !== detectSeq) return; // superseded by a newer keystroke
        if (desc) showToolCard(desc, raw, { editUrl: raw });
        else showTakeover(`<p class="asset-picker-empty">That isn't a Lolly tool link this app can open.</p>`);
        return;
      }
      detectSeq++; // invalidate any in-flight detection now that it's not a URL
      const q = raw.toLowerCase();
      // Resuming typing after a paste/embed takeover returns to the active pane —
      // without stealing focus out of the search field (so don't go via setTab).
      if (!toolcardHost.hidden) {
        toolcardHost.hidden = true;
        toolcardHost.innerHTML = '';
        const pane = root.querySelector(`.asset-picker-pane[data-pane="${activeTab}"]`);
        if (pane) pane.hidden = false;
        setFooter(activeTab === 'library');
      }
      if (activeTab === 'library') restoreLibrary(q);
      else if (activeTab === 'sessions') renderSessions(q);
      else if (activeTab === 'tools') renderTools(q);
    });
  } catch (e) {
    libraryEl.innerHTML = `<p class="asset-picker-error">Failed to load: ${escape(e.message)}</p>`;
  }
}

// Constrain the offered child-render formats to the slot's asset type. A 'vector'
// slot semantically wants vector (e.g. an inline-recolourable logo) → restrict to
// SVG. Every OTHER slot — including 'raster' — accepts an SVG render fine: it shows
// as an <img>, stays crisp and inlines as true vector in SVG/PDF export, and
// rasterises cleanly for PNG. So offer all image formats and let SVG be the default
// (describeUrl prefers it). assetType constrains the LIBRARY picker, not what format
// a tool RENDER should take. Falls back to the full list if a constraint empties it.
function formatsForType(formats, type) {
  if (type === 'vector') {
    const svgOnly = formats.filter(f => f === 'svg');
    return svgOnly.length ? svgOnly : formats;
  }
  return formats;
}

// Image formats a composed tool render can take (mirrors compose.js IMAGE_FORMATS).
const IMG_FORMATS = new Set(['svg', 'png', 'jpg', 'jpeg', 'webp']);

// Can this catalog tool be rendered to an embeddable image? It must be exportable and
// emit at least one image format (and SVG specifically for a vector slot). Mirrors the
// gate compose uses — described tools that only export e.g. pdf/ics are dropped, as are
// non-exportable transform utilities (strip-data, compress-pdf).
function isEmbeddable(t, needsSvg) {
  if (!t || t.exportable !== true || !Array.isArray(t.formats)) return false;
  const fmts = t.formats.map(f => String(f).toLowerCase());
  return needsSvg ? fmts.includes('svg') : fmts.some(f => IMG_FORMATS.has(f));
}

// A saved session records its last export format; seed the render card with it only
// when it's an image format (else let describeUrl choose, defaulting to SVG).
function imageFormatSeed(fmt) {
  const f = String(fmt ?? '').toLowerCase();
  return IMG_FORMATS.has(f) ? (f === 'jpeg' ? 'jpg' : f) : undefined;
}

// Compact relative time for a saved session ("3d ago"). Browser-only (Date.now).
function relTime(iso) {
  const t = iso ? Date.parse(iso) : NaN;
  if (Number.isNaN(t)) return '';
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  const m = s / 60; if (m < 60) return `${Math.floor(m)}m ago`;
  const h = m / 60; if (h < 24) return `${Math.floor(h)}h ago`;
  const d = h / 24; if (d < 7)  return `${Math.floor(d)}d ago`;
  const w = d / 7;  if (w < 5)  return `${Math.floor(w)}w ago`;
  const mo = d / 30; if (mo < 12) return `${Math.floor(mo)}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}

function card(ref) {
  const isPlaceholder = ref.meta?._placeholder;
  const name = ref.meta?.name ?? ref.id;
  return `
    <button type="button" class="asset-picker-card" data-asset-id="${escape(ref.id)}">
      ${isPlaceholder
        ? `<div class="asset-picker-thumb asset-picker-thumb-stub">${escape(ref.type)}</div>`
        : `<img class="asset-picker-thumb" src="${escape(ref.url)}" alt="" loading="lazy" decoding="async">`}
      <span class="asset-picker-name" title="${escape(name)}">${escape(name)}</span>
      <span class="asset-picker-id">${escape(ref.id)}</span>
      ${formatBadge(ref)}
    </button>
  `;
}

// A tool the user can render to an image. Preview-forward like the gallery: show the
// tool's rendered preview thumbnail, falling back to its inline icon. The `preview` is
// a build artifact (catalog/previews/) that can 404 (not committed, not built by
// build:web) — so the icon is always rendered too, revealed by a capture-phase error
// handler (see render). The index ships the icon as trusted inline SVG (built from
// tools/<id>/icon.svg) — inlined so it themes via currentColor.
function toolCard(t) {
  const hasPreview = Boolean(t.preview);
  return `
    <button type="button" class="asset-picker-card asset-picker-toolitem${hasPreview ? '' : ' no-preview'}" data-tool-id="${escape(t.id)}" title="${escape(t.description ?? t.name)}">
      ${hasPreview ? `<img class="asset-picker-toolitem-preview" src="${escape(t.preview)}" alt="" loading="lazy" decoding="async">` : ''}
      <span class="asset-picker-toolitem-icon" aria-hidden="true">${t.icon ?? ''}</span>
      <span class="asset-picker-name">${escape(t.name)}</span>
    </button>
  `;
}

// A previous saved creation. Its thumbnail is a PNG data-URL (raster tools) or raw SVG
// markup (vector tools); SVG is rendered via a data-URL <img> so any embedded script in
// an imported session can't execute. No thumb → the tool's icon as a stub.
function sessionCard(s) {
  const name = s.toolName ?? s.toolId;
  return `
    <button type="button" class="asset-picker-card asset-picker-sessitem" data-session-slot="${escape(s.slot)}" title="${escape(name)}">
      ${sessionThumb(s.thumb, s.toolIcon)}
      <span class="asset-picker-name" title="${escape(name)}">${escape(name)}</span>
      <span class="asset-picker-sessitem-when">${escape(relTime(s.updatedAt))}</span>
    </button>
  `;
}

function sessionThumb(thumb, iconSvg) {
  if (typeof thumb === 'string' && thumb) {
    if (thumb.startsWith('data:')) {
      return `<img class="asset-picker-thumb" src="${escape(thumb)}" alt="" loading="lazy" decoding="async">`;
    }
    if (/^\s*<(\?xml|svg)/i.test(thumb)) {
      const src = 'data:image/svg+xml;utf8,' + encodeURIComponent(thumb);
      return `<img class="asset-picker-thumb" src="${escape(src)}" alt="" loading="lazy" decoding="async">`;
    }
  }
  return `<span class="asset-picker-thumb asset-picker-thumb-stub asset-picker-thumb-icon" aria-hidden="true">${iconSvg ?? ''}</span>`;
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
        <img class="asset-picker-thumb" src="${escape(ref.url)}" alt="" loading="lazy" decoding="async">
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

/**
 * Webcam capture → Promise<AssetRef | null>.
 *
 * A live <video> preview of the user's camera with a Capture button; the captured
 * frame becomes a raster user asset via the SAME storeUserUpload path as an upload
 * (downscale + on-device store), so the rest of the app treats it identically. This
 * is a pure shell affordance — no engine/bridge/runtime involvement — which is why
 * "webcam as a still image" needs no architectural change. The camera stream is torn
 * down on every exit path (capture, cancel, Escape, backdrop, error) so no track
 * outlives the dialog. Pixels never leave the device.
 */
function openWebcamCapture(host) {
  return new Promise((resolve) => {
    let stream = null;
    const overlay = document.createElement('div');
    overlay.className = 'webcam-capture-overlay';
    overlay.innerHTML = `
      <div class="webcam-capture-backdrop" aria-hidden="true"></div>
      <div class="webcam-capture-panel" role="dialog" aria-modal="true" aria-label="Take a photo">
        <header class="webcam-capture-head">
          <span>Take a photo</span>
          <button type="button" class="webcam-capture-close" aria-label="Close">&times;</button>
        </header>
        <div class="webcam-capture-stage">
          <video class="webcam-capture-video" autoplay playsinline muted></video>
          <div class="webcam-capture-status">Starting camera…</div>
        </div>
        <footer class="webcam-capture-actions">
          <button type="button" class="webcam-capture-cancel">Cancel</button>
          <button type="button" class="webcam-capture-shoot" disabled>Capture</button>
        </footer>
      </div>`;
    document.body.appendChild(overlay);

    const videoEl  = overlay.querySelector('.webcam-capture-video');
    const statusEl = overlay.querySelector('.webcam-capture-status');
    const shootBtn = overlay.querySelector('.webcam-capture-shoot');
    const opener   = document.activeElement;

    const cleanup = () => {
      if (stream) stream.getTracks().forEach(t => { try { t.stop(); } catch { /* already stopped */ } });
      stream = null;
      document.removeEventListener('keydown', onKey);
      overlay.remove();
      if (opener instanceof HTMLElement) opener.focus();
    };
    const done = (val) => { cleanup(); resolve(val); };
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); done(null); } };
    document.addEventListener('keydown', onKey);
    overlay.querySelector('.webcam-capture-backdrop').addEventListener('click', () => done(null));
    overlay.querySelector('.webcam-capture-close').addEventListener('click', () => done(null));
    overlay.querySelector('.webcam-capture-cancel').addEventListener('click', () => done(null));

    const showError = (msg) => {
      statusEl.hidden = false;
      statusEl.textContent = msg;
      statusEl.classList.add('webcam-capture-error');
    };

    shootBtn.addEventListener('click', async () => {
      const w = videoEl.videoWidth, h = videoEl.videoHeight;
      if (!w || !h) return;
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(videoEl, 0, 0, w, h);
      const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
      if (!blob) { showError('Couldn’t capture the frame.'); return; }
      const file = new File([blob], `webcam-${Date.now()}.png`, { type: 'image/png' });
      try {
        const ref = await storeUserUpload(host, file);
        done(ref);
      } catch (e) {
        host.log?.('error', 'Webcam capture store failed', { error: String(e) });
        showError('Couldn’t save the photo.');
      }
    });

    // Kick off the camera; leave the dialog open on failure showing why.
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        videoEl.srcObject = stream;
        await videoEl.play().catch(() => {});
        statusEl.hidden = true;
        shootBtn.disabled = false;
        shootBtn.focus();
      } catch (e) {
        host.log?.('warn', 'Webcam start failed', { error: String(e) });
        showError(e?.name === 'NotAllowedError'
          ? 'Camera permission was declined. Allow camera access, then try again.'
          : 'Couldn’t start the camera on this device.');
      }
    })();
  });
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
