// SPDX-License-Identifier: MPL-2.0
/**
 * Gallery view — preview-forward masonry of available tools.
 *
 * Each tool is a card. When the tool has a saved session, the card leads with a
 * preview of the most-recent one at its natural aspect (portrait previews show
 * in full — no crop, no letterbox); the masonry packs the varying heights.
 * Tools with no session show a compact "open to start" tile instead.
 *
 * Feature flags hide whole categories; the remaining categories surface as
 * single-select filter pills, so any mix of flags just reflows the grid.
 *
 * Two per-card actions open modals: (i) tool info (formats + details) and
 * (h) history — the full list of that tool's saved sessions (resume / delete).
 */

import { escape } from '../utils.js';
import { toolSupport, capabilityLabel } from '../capabilities.js';
import { hiddenCategories, flagEnabled, PRO_FLAG } from '../feature-flags.js';
import { syncCatalog } from '../catalog/sync.js';
import { privacyNoticeMarkup, mountPrivacyNotice } from './privacy-notice.js';
import { profileSignature, canPersonalize, regeneratePreviews } from '../personalize-previews.js';

// Section order for the filter pills. 'utility' is intentionally absent: the
// on-device Offline Utilities pill always sorts last (see categoryRank()).
const CATEGORY_ORDER = ['everyone', 'designer', 'event', 'product'];

function categoryRank(cat) {
  if (cat === 'utility') return Infinity;
  const i = CATEGORY_ORDER.indexOf(cat);
  return i === -1 ? CATEGORY_ORDER.length : i;
}

// Short category names for the filter pills / card sub-lines — distinct from the
// longer feature-flag labels (e.g. "Tools for Everyone") shown in profile settings.
const CAT_LABEL = { everyone: 'Everyone', designer: 'Designer', event: 'Event', utility: 'Utilities' };
const catLabel = (c) => CAT_LABEL[c] || (c ? c[0].toUpperCase() + c.slice(1) : 'Other');
const statusLabel = (s) => ({ official: 'Official', community: 'Community', experimental: 'Experimental' }[s] || s);

// Export-format display labels (mirrors the subset used by the tool view).
const FMT_LABEL = {
  'pdf-cmyk': 'Print PDF', 'cmyk-tiff': 'Print TIFF', jpeg: 'JPG', jpg: 'JPG',
  webm: 'WebM', mp4: 'MP4', emf: 'EMF', eps: 'EPS', 'eps-cmyk': 'EPS (CMYK)', ics: 'Calendar', vcf: 'vCard', ico: 'Icon',
  zip: 'ZIP', csv: 'CSV', json: 'JSON', svg: 'SVG', pdf: 'PDF', png: 'PNG',
  webp: 'WebP', avif: 'AVIF', html: 'HTML', md: 'Markdown', txt: 'Text', gif: 'GIF',
};
const fmtLabel = (f) => FMT_LABEL[f] ?? String(f).toUpperCase();

// Mirrors pro/sessions.js BATCH_SLOT_PREFIX — duplicated as a literal so the
// gallery keeps zero dependency on the removable /pro folder.
const BATCH_SLOT_PREFIX = '__batch__:';
const isBatchSlot = (slot) => String(slot).startsWith(BATCH_SLOT_PREFIX);

// Lucide "info" and "history" — per-card action icons (own stroke-width, so the
// thin .tool-card-icon rule doesn't apply to them).
const INFO_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>';
const HISTORY_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>';

// lucide "package" — placeholder thumbnail for batch sessions, which have no
// single render to show (they resume into #/pro).
const PACKAGE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>';

export async function mountGallery(viewEl, host) {
  document.title = 'Lolly';
  const index = window.__toolIndex ?? { tools: [] };
  const [savedEntries, profile, sessionSizes, cachedPreviews] = await Promise.all([
    host.state.list(),
    host.profile.get(),
    host.state.sizes().catch(() => ({})),
    host.previews?.list().catch(() => []) ?? [],
  ]);

  // Profile-personalized previews (see ../personalize-previews.js). `sig` is empty
  // unless the user opted in ("use my details"); only cache entries matching the
  // current sig are fresh — a stale one is ignored and re-rendered below. Held in a
  // Map so re-renders (search/filter) keep the personalized image, not just the
  // committed placeholder.
  const previewSig = profileSignature(profile);
  const personalizedByTool = new Map();
  if (previewSig) {
    for (const rec of cachedPreviews) {
      if (rec?.sig === previewSig && rec.thumb) personalizedByTool.set(rec.toolId, rec.thumb);
    }
  }

  // Re-resolve the headshot for the profile pill avatar (the stored object URL
  // goes stale across reloads; fetch a fresh one by id).
  const headshotUrl = profile.headshot?.id
    ? (await host.assets.get(profile.headshot.id).catch(() => null))?.url || ''
    : '';

  // Per-tool saved sessions (newest first), batch sessions excluded — they have
  // no toolId and resume into #/pro, so they're not a tool's history.
  const entriesByTool = new Map();
  for (const entry of savedEntries) {
    if (isBatchSlot(entry.slot)) continue;
    if (!entriesByTool.has(entry.toolId)) entriesByTool.set(entry.toolId, []);
    entriesByTool.get(entry.toolId).push(entry);
  }
  for (const arr of entriesByTool.values()) {
    arr.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  }
  const latestByTool = (id) => entriesByTool.get(id)?.[0];
  const countByTool = (id) => entriesByTool.get(id)?.length ?? 0;

  const toolById = new Map(index.tools.map(t => [t.id, t]));

  // All saved sessions (tool + batch) newest first — the global drawer's list.
  const sortedSaved = [...savedEntries].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  const nameById = new Map(index.tools.map(t => [t.id, t.name]));

  // Group by category; feature flags hide whole categories.
  const grouped = {};
  for (const t of index.tools) (grouped[t.category ?? 'other'] ??= []).push(t);
  const hidden = hiddenCategories(profile);
  const proEnabled = flagEnabled(profile, PRO_FLAG.id);

  const visibleCats = Object.keys(grouped)
    .filter(cat => !hidden.has(cat))
    .sort((a, b) => categoryRank(a) - categoryRank(b));

  // Render shell. The pill bar + masonry are filled by render(); the footer
  // (Pro link, search, info link) is left exactly as before.
  viewEl.classList.add('has-masonry');
  viewEl.innerHTML = `
    <div class="gallery">
      <h1 class="visually-hidden">Lolly — tools gallery</h1>
      <div class="gallery-topright">
        ${sortedSaved.length ? `<button type="button" class="history-fab" title="Saved sessions" aria-label="Saved sessions (${sortedSaved.length})">${HISTORY_ICON}<span class="history-fab-count" aria-hidden="true">${sortedSaved.length}</span></button>` : ''}
        <a href="#/profile" class="profile-link${headshotUrl ? ' has-avatar' : ''}" aria-label="Open your profile">${headshotUrl ? `<img class="profile-link-avatar" src="${escape(headshotUrl)}" alt="">` : ''}<span class="profile-link-name">${escape(profile.firstname || 'Profile')}</span></a>
      </div>

      ${visibleCats.length === 0 ? (index.tools.length === 0 ? `
        <div class="gallery-empty" role="status">
          <p class="gallery-empty-title">Couldn't load the tools.</p>
          <p class="gallery-empty-hint">Check your connection, then <button type="button" class="gallery-retry">retry</button>.</p>
        </div>
      ` : `
        <div class="gallery-empty" role="status">
          <p class="gallery-empty-title">It looks like there are no tools available.</p>
          <p class="gallery-empty-hint">Try turning on categories in <a href="#/profile?focus=feature-flags">your feature flags</a>.</p>
        </div>
      `) : `
        <nav class="gallery-pillbar" aria-label="Filter tools by category"></nav>
        <p class="gallery-search-status visually-hidden" role="status" aria-live="polite"></p>
        <div class="tool-masonry"></div>
      `}

      <footer class="gallery-footer">
        ${proEnabled ? `<a href="#/pro" class="gallery-batch-link btn" aria-label="Open Batch mode — for power users">Pro</a>` : ''}
        <div class="gallery-search-wrap">
          <input class="gallery-search" type="search" placeholder="Search tools…" autocomplete="off" spellcheck="false" aria-label="Search tools">
        </div>
        <a href="/info/" class="gallery-info-link btn" aria-label="What is Lolly? — about &amp; help">What?</a>
      </footer>
      ${privacyNoticeMarkup()}
    </div>
  `;

  mountPrivacyNotice(viewEl);

  // Empty catalog: offer a re-sync without a full reload.
  viewEl.querySelector('.gallery-retry')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = 'Retrying…';
    await syncCatalog(host);
    await mountGallery(viewEl, host);
  });

  const pillbar    = viewEl.querySelector('.gallery-pillbar');
  const masonry    = viewEl.querySelector('.tool-masonry');
  const searchInput = viewEl.querySelector('.gallery-search');
  const searchStatus = viewEl.querySelector('.gallery-search-status');

  let activeCat = 'all';   // active category pill
  let query = '';          // current search text (lowercased)

  function matchingTools() {
    const q = query.trim();
    return index.tools.filter(t => {
      if (hidden.has(t.category)) return false;
      if (q) return t.name.toLowerCase().includes(q) || (t.description ?? '').toLowerCase().includes(q);
      return activeCat === 'all' || t.category === activeCat;
    });
  }

  function renderPills() {
    if (!pillbar) return;
    const total = index.tools.filter(t => !hidden.has(t.category)).length;
    const allActive = activeCat === 'all' && !query;
    let html = `<button class="gallery-pill${allActive ? ' active' : ''}" data-cat="all" type="button" aria-pressed="${allActive}">All<span class="ct">${total}</span></button>`;
    for (const cat of visibleCats) {
      const n = grouped[cat].length;
      const active = activeCat === cat && !query;
      html += `<button class="gallery-pill${active ? ' active' : ''}" data-cat="${escape(cat)}" type="button" aria-pressed="${active}">${escape(catLabel(cat))}<span class="ct">${n}</span></button>`;
    }
    pillbar.innerHTML = html;
  }

  function render() {
    if (!masonry) return;
    renderPills();
    const tools = matchingTools();
    masonry.style.setProperty('--items', Math.max(tools.length, 1));
    masonry.innerHTML = tools.length
      ? tools.map(t => cardMarkup(t, latestByTool(t.id), countByTool(t.id), host.capabilities, personalizedByTool.get(t.id))).join('')
      : `<p class="gallery-no-results">${query ? `No tools match "<strong>${escape(query.trim())}</strong>"` : 'No tools to show.'}</p>`;
    wireCards(masonry);
    if (searchStatus) {
      searchStatus.textContent = query
        ? (tools.length === 1 ? '1 result' : `${tools.length} results`)
        : '';
    }
  }

  function wireCards(container) {
    // Prefetch a tool's files on first hover of its open affordance.
    container.querySelectorAll('[data-new-tool]').forEach(el => {
      el.addEventListener('pointerenter', () => prefetchTool(el.dataset.newTool), { once: true });
      el.addEventListener('click', () => el.closest('.gtile')?.classList.add('is-navigating'));
    });
    // Resume the latest session (the hero preview).
    container.querySelectorAll('[data-resume]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        el.closest('.gtile')?.classList.add('is-navigating');
        window.location.hash = `#/tool/${el.dataset.resume}?slot=${encodeURIComponent(el.dataset.slot)}`;
      });
    });
    // Info + history modals.
    container.querySelectorAll('[data-info]').forEach(el => {
      el.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); showInfoDialog(toolById.get(el.dataset.info)); });
    });
    container.querySelectorAll('[data-history]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation(); e.preventDefault();
        const tool = toolById.get(el.dataset.history);
        showHistoryDialog(tool, entriesByTool.get(tool.id) ?? [], sessionSizes, host, {
          // Update in-memory state (per-tool list + global list + FAB count) as rows
          // are deleted; the heavy masonry re-render is deferred to onClose.
          onDelete: (slot) => {
            const arr = entriesByTool.get(tool.id) ?? [];
            const ai = arr.findIndex(x => x.slot === slot);
            if (ai >= 0) arr.splice(ai, 1);
            const si = sortedSaved.findIndex(x => x.slot === slot);
            if (si >= 0) sortedSaved.splice(si, 1);
            const count = historyFab?.querySelector('.history-fab-count');
            if (count) count.textContent = String(sortedSaved.length);
            if (historyFab && sortedSaved.length === 0) historyFab.hidden = true;
          },
          // Re-render once the dialog is gone, then put focus on the card's info
          // button (stable) so keyboard focus isn't dropped to <body>.
          onClose: () => {
            render();
            masonry.querySelector(`[data-info="${CSS.escape(tool.id)}"]`)?.focus();
          },
        });
      });
    });
  }

  if (pillbar) {
    pillbar.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-cat]');
      if (!btn) return;
      activeCat = btn.dataset.cat;
      if (query) { query = ''; searchInput.value = ''; }
      render();
      // render() rebuilds the pills, dropping focus — restore it to the active one
      // so keyboard users aren't bounced to the top of the tab order.
      pillbar.querySelector('.gallery-pill.active')?.focus();
    });
  }

  let searchDebounce;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => { query = searchInput.value.toLowerCase(); render(); }, 120);
  });

  // Global saved-sessions drawer (all tools + batch sessions), opened from the
  // history button beside the profile pill.
  const historyFab = viewEl.querySelector('.history-fab');
  historyFab?.addEventListener('click', () => {
    showSessionsDrawer(sortedSaved, sessionSizes, nameById, host, {
      onDelete: (slot) => {
        const i = sortedSaved.findIndex(s => s.slot === slot);
        if (i >= 0) sortedSaved.splice(i, 1);
        for (const arr of entriesByTool.values()) {
          const j = arr.findIndex(s => s.slot === slot);
          if (j >= 0) { arr.splice(j, 1); break; }
        }
        const count = historyFab.querySelector('.history-fab-count');
        if (count) count.textContent = String(sortedSaved.length);
        if (sortedSaved.length === 0) historyFab.hidden = true;
        render();
      },
    });
  });

  // Focus the search box on fine-pointer devices for type-to-find (skip touch so
  // the keyboard doesn't pop over the gallery).
  if (window.matchMedia?.('(pointer: fine)').matches) searchInput.focus({ preventScroll: true });

  render();

  // Profile-personalized previews: once the user has opted in to "use my details",
  // re-render the few profile-bound tools that have no saved session — off the
  // critical path (idle, serial) — and lazily swap the personalized image into its
  // card. Feature-detected (host.previews) and scoped via canPersonalize(), so it's
  // a no-op for shells without the cache and for the ~24 tools whose output doesn't
  // change with the profile. The committed preview shows until the swap lands; cache
  // hits were already applied at mount above. See ../personalize-previews.js.
  if (previewSig && host.previews) {
    const cssEscape = (s) => (window.CSS && CSS.escape ? CSS.escape(s) : s);
    const toRegenerate = index.tools.filter(t =>
      canPersonalize(t) &&
      !latestByTool(t.id) &&                  // no saved session — only placeholders
      !personalizedByTool.has(t.id) &&        // not already fresh in cache
      toolSupport(t, host.capabilities).status !== 'unavailable',
    );
    if (toRegenerate.length) {
      regeneratePreviews({
        host,
        toolIds: toRegenerate.map(t => t.id),
        sig: previewSig,
        onThumb: (toolId, dataUrl) => {
          personalizedByTool.set(toolId, dataUrl);   // so later re-renders keep it
          if (!masonry?.isConnected) return;         // navigated away mid-render
          const img = masonry.querySelector(
            `.gtile-hero--preview[data-new-tool="${cssEscape(toolId)}"] .gtile-hero-img`,
          );
          if (img) img.src = dataUrl;
        },
      });
    }
  }
}

// ── Card markup ───────────────────────────────────────────────────────────

function cardMarkup(tool, latest, sessionCount, shellCaps, personalizedThumb) {
  const sup = toolSupport(tool, shellCaps);
  const unavailable = sup.status === 'unavailable';

  const statusBadge = unavailable
    ? '<span class="badge badge-desktop">Desktop</span>'
    : sup.status === 'install'
      ? '<span class="badge badge-install">Add&#8209;on</span>'
      : (tool.status !== 'official' ? `<span class="badge badge-${tool.status}">${escape(tool.status)}</span>` : '');

  const iconSvg = tool.icon ? `<span class="tool-card-icon" aria-hidden="true">${tool.icon}</span>` : '';
  const openHref = `#/tool/${escape(tool.id)}`;
  const hasSession = !!latest && !unavailable;          // resumable, with or without a preview
  const hasThumbHero = hasSession && !!latest.thumb;    // resumable AND has a preview image
  const hasPreview = !unavailable && !hasSession && !!tool.preview; // committed demo preview, no session yet

  // Visual: hero preview to resume the latest session; a compact resume tile when
  // the session has no captured preview; a committed demo preview (starts a NEW
  // session) when there's no session at all; else an "open to start" tile.
  let visual;
  if (unavailable) {
    visual = `<span class="gtile-tile gtile-tile--static"><span class="gtile-tile-txt">Desktop&nbsp;app only</span></span>`;
  } else if (hasThumbHero) {
    visual = `
      <button class="gtile-hero" data-resume="${escape(latest.toolId)}" data-slot="${escape(latest.slot)}"
              aria-label="Continue ${escape(latest.filename || tool.name)}">
        <img class="gtile-hero-img" src="${escape(latest.thumb)}" alt="" aria-hidden="true">
        <span class="gtile-stamp">${escape(relativeTime(latest.updatedAt))}</span>
        <span class="gtile-continue">Continue</span>
      </button>`;
  } else if (hasSession) {
    // Session exists but its preview failed to capture — still resumable from the card.
    visual = `<button class="gtile-tile gtile-tile--resume" data-resume="${escape(latest.toolId)}" data-slot="${escape(latest.slot)}"
              aria-label="Continue ${escape(latest.filename || tool.name)}"><span class="gtile-tile-txt">Continue · ${escape(relativeTime(latest.updatedAt))}</span></button>`;
  } else if (hasPreview) {
    // No saved session, but a committed demo preview exists (npm run thumbs) — show
    // it as a hero that starts a NEW session. Decorative duplicate of the name link
    // (tabindex/aria-hidden so AT hears one link), matching the empty-tile pattern.
    // When the user has opted in to their profile, a personalized re-render replaces
    // the committed placeholder (in cache at mount, or lazily swapped in when ready).
    visual = `
      <a class="gtile-hero gtile-hero--preview" href="${openHref}" data-new-tool="${escape(tool.id)}" tabindex="-1" aria-hidden="true">
        <img class="gtile-hero-img" src="${escape(personalizedThumb || tool.preview)}" alt="" aria-hidden="true" loading="lazy">
        <span class="gtile-continue">Open</span>
      </a>`;
  } else {
    // Decorative duplicate of the name link (tabindex/aria-hidden so AT hears one link).
    visual = `<a class="gtile-tile" href="${openHref}" data-new-tool="${escape(tool.id)}" tabindex="-1" aria-hidden="true"><span class="gtile-tile-txt">No saved sessions yet.  Open to start</span></a>`;
  }

  // Caption sub-line: only the last-opened time, and only on resumable cards.
  // The category is deliberately omitted here — it's discoverable via the filter
  // pills and shown in the info dialog — so the card stays about this tool itself.
  const sub = hasSession
    ? `Last opened · ${escape(relativeTime(latest.updatedAt))}`
    : '';

  // The title is the "start a new session" link. A stretched ::after (see CSS)
  // makes the whole text body — caption + description — its click target, so a
  // fresh session is as easy to hit as the hero's Continue. On a tool that
  // already has a saved session the link carries an explicit aria-label so it
  // reads as "new" against the hero's "Continue".
  const name = unavailable
    ? `<span class="gtile-name" aria-disabled="true">${escape(tool.name)}</span>`
    : `<a class="gtile-name" href="${openHref}" data-new-tool="${escape(tool.id)}"${hasSession ? ` aria-label="Start a new ${escape(tool.name)} session"` : ''}>${escape(tool.name)}</a>`;

  const historyBtn = (!unavailable && sessionCount > 0)
    ? `<button type="button" class="gtile-iconbtn" data-history="${escape(tool.id)}" title="Saved sessions" aria-label="${sessionCount} saved session${sessionCount === 1 ? '' : 's'} for ${escape(tool.name)}">${HISTORY_ICON}</button>`
    : '';

  return `
    <article class="gtile${unavailable ? ' gtile--unavailable' : ''}">
      ${visual}
      <div class="gtile-body${unavailable ? '' : ' gtile-body--link'}">
        <div class="gtile-cap">
          ${iconSvg}
          <span class="gtile-meta">
            ${name}
            ${sub ? `<span class="gtile-sub">${sub}</span>` : ''}
            <p class="gtile-desc">${escape(tool.description ?? '')}</p>
          </span>
          ${hasSession ? '<span class="gtile-new" aria-hidden="true">+ New</span>' : ''}
          ${statusBadge}
        </div>
      </div>
      <div class="gtile-actions">
        <button type="button" class="gtile-iconbtn" data-info="${escape(tool.id)}" title="About this tool" aria-label="About ${escape(tool.name)}">${INFO_ICON}</button>
        ${historyBtn}
      </div>
    </article>
  `;
}

// ── Info modal ──────────────────────────────────────────────────────────────

function showInfoDialog(tool) {
  if (!tool) return;
  const caps = Array.isArray(tool.capabilities) ? tool.capabilities : [];
  // Formats + privacy come straight from the catalog index entry — no fetch.
  // Transform-vs-export is decided by the `exportable` flag alone (NOT by whether
  // formats happen to be present), so a tool that declares formats always lists
  // them; only genuinely non-exporting utilities show the transform note.
  const formats = (Array.isArray(tool.formats) ? tool.formats : []).map(fmtLabel);
  const formatsText = tool.exportable === false
    ? 'On-device transform (no file export)'
    : (formats.length ? formats.join(', ') : '—');

  const dialog = document.createElement('dialog');
  dialog.className = 'tool-meta-dialog';
  dialog.setAttribute('aria-labelledby', 'tool-info-title');
  dialog.innerHTML = `
    <div class="meta-dialog-body">
      <header class="meta-dialog-head">
        ${tool.icon ? `<span class="tool-card-icon meta-dialog-icon" aria-hidden="true">${tool.icon}</span>` : ''}
        <div>
          <h2 id="tool-info-title">${escape(tool.name)}</h2>
          <p class="meta-dialog-sub">${escape(catLabel(tool.category))} · ${escape(statusLabel(tool.status))}</p>
        </div>
      </header>
      <p class="meta-dialog-desc">${escape(tool.description ?? '')}</p>
      <dl class="meta-dialog-facts">
        <div><dt>Exports</dt><dd>${escape(formatsText || '—')}</dd></div>
        ${caps.length ? `<div><dt>Uses</dt><dd>${caps.map(c => escape(capabilityLabel(c))).join(', ')}</dd></div>` : ''}
        ${tool.privacy === 'on-device' ? `<div><dt>Privacy</dt><dd>Runs entirely on your device</dd></div>` : ''}
        ${tool.version ? `<div><dt>Version</dt><dd>${escape(tool.version)}</dd></div>` : ''}
      </dl>
      <div class="meta-dialog-actions">
        <a class="btn meta-dialog-open" href="#/tool/${escape(tool.id)}">Open tool</a>
        <button type="button" class="btn meta-dialog-close">Close</button>
      </div>
    </div>`;
  openDialog(dialog);
  dialog.querySelector('.meta-dialog-open')?.addEventListener('click', () => closeDialog(dialog));
}

// ── History modal ───────────────────────────────────────────────────────────

function showHistoryDialog(tool, entries, sizes, host, { onDelete, onClose } = {}) {
  if (!tool) return;
  const dialog = document.createElement('dialog');
  dialog.className = 'tool-meta-dialog tool-history-dialog';
  dialog.setAttribute('aria-labelledby', 'tool-history-title');

  const countText = (n) => `${n} saved session${n === 1 ? '' : 's'}`;
  // Defer the gallery re-render until the dialog closes: rebuilding the masonry
  // (and the (h) trigger button) mid-dialog would break the UA's focus restore.
  let changed = false;
  dialog.innerHTML = `
    <div class="meta-dialog-body">
      <header class="meta-dialog-head">
        ${tool.icon ? `<span class="tool-card-icon meta-dialog-icon" aria-hidden="true">${tool.icon}</span>` : ''}
        <div>
          <h2 id="tool-history-title">${escape(tool.name)}</h2>
          <p class="meta-dialog-sub history-count">${countText(entries.length)}</p>
        </div>
      </header>
      <ul class="saved-list history-list">
        ${entries.map(e => savedItem(e, sizes[e.slot], '')).join('')}
      </ul>
      <div class="meta-dialog-actions">
        <button type="button" class="btn meta-dialog-close">Close</button>
      </div>
    </div>`;
  openDialog(dialog);
  dialog.addEventListener('close', () => { if (changed) onClose?.(); });

  dialog.querySelectorAll('[data-resume]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      closeDialog(dialog);
      window.location.hash = `#/tool/${el.dataset.resume}?slot=${encodeURIComponent(el.dataset.slot)}`;
    });
  });
  dialog.querySelectorAll('[data-delete]').forEach(el => {
    el.addEventListener('click', async (e) => {
      e.stopPropagation();
      const slot = el.dataset.delete;
      await host.state.delete(slot);
      el.closest('.saved-row')?.remove();
      onDelete?.(slot);            // update in-memory state only — render happens on close
      changed = true;
      const left = dialog.querySelectorAll('.saved-row').length;
      const countEl = dialog.querySelector('.history-count');
      if (countEl) countEl.textContent = countText(left);
      if (left === 0) closeDialog(dialog);
    });
  });
}

// ── Global saved-sessions drawer (all tools + batch) ────────────────────────

function showSessionsDrawer(entries, sizes, nameById, host, { onDelete } = {}) {
  const dialog = document.createElement('dialog');
  dialog.className = 'tool-meta-dialog tool-drawer';
  dialog.setAttribute('aria-labelledby', 'drawer-title');
  dialog.innerHTML = `
    <div class="drawer-body">
      <header class="drawer-head">
        <h2 id="drawer-title">Saved sessions</h2>
        <button type="button" class="gtile-iconbtn meta-dialog-close" aria-label="Close">&#x2715;</button>
      </header>
      <ul class="saved-list drawer-list">
        ${entries.map(e => savedItem(e, sizes[e.slot], nameById.get(e.toolId) ?? '')).join('')}
      </ul>
      ${entries.length ? '' : '<p class="drawer-empty">No saved sessions yet.</p>'}
    </div>`;
  openDialog(dialog);

  dialog.querySelectorAll('[data-resume], [data-batch]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      closeDialog(dialog);
      window.location.hash = el.hasAttribute('data-batch')
        ? `#/pro?session=${encodeURIComponent(el.dataset.slot)}`
        : `#/tool/${el.dataset.resume}?slot=${encodeURIComponent(el.dataset.slot)}`;
    });
  });
  dialog.querySelectorAll('[data-delete]').forEach(el => {
    el.addEventListener('click', async (e) => {
      e.stopPropagation();
      await host.state.delete(el.dataset.delete);
      el.closest('.saved-row')?.remove();
      onDelete?.(el.dataset.delete);
      if (!dialog.querySelector('.saved-row') && !dialog.querySelector('.drawer-empty')) {
        dialog.querySelector('.drawer-list')?.insertAdjacentHTML('afterend', '<p class="drawer-empty">No saved sessions yet.</p>');
      }
    });
  });
}

// ── Native <dialog> helpers (Esc + backdrop click come free) ────────────────

function openDialog(dialog) {
  document.body.appendChild(dialog);
  dialog.showModal();
  // Esc → close() (not bare remove()) so the UA restores focus to the opener.
  dialog.addEventListener('cancel', (e) => { e.preventDefault(); closeDialog(dialog); }); // Esc
  dialog.addEventListener('click', (e) => { if (e.target === dialog) closeDialog(dialog); }); // backdrop
  dialog.querySelectorAll('.meta-dialog-close').forEach(b => b.addEventListener('click', () => closeDialog(dialog)));
}
function closeDialog(dialog) {
  dialog.close();
  dialog.remove();
}

// ── Saved-session row (shared by the history modal) ─────────────────────────

function savedItem(entry, bytes, toolName = '') {
  const batch = isBatchSlot(entry.slot);
  const thumb = batch
    ? `<span class="saved-thumb saved-thumb--batch" aria-hidden="true">${PACKAGE_ICON}</span>`
    : entry.thumb
      ? `<img class="saved-thumb" src="${escape(entry.thumb)}" alt="" aria-hidden="true">`
      : `<span class="saved-thumb saved-thumb--empty"></span>`;
  const when = entry.updatedAt ? fmtDateTime(new Date(entry.updatedAt)) : '';
  const size = bytes ? `<small class="session-size">${fmtBytes(bytes)}</small>` : '';
  const title = batch ? (entry.label || 'Batch session') : (entry.filename || toolName || entry.toolId);
  // The tool name is the row's title (h4) just above, so the sub-line only needs
  // the timestamp — no need to repeat the name.
  const subtitle = batch ? `Batch · ${when}` : when;
  const searchText = [title, entry.toolId, toolName, batch ? 'batch' : ''].filter(Boolean).join(' ').toLowerCase();
  // Tool sessions resume into #/tool; batch sessions resume into #/pro.
  const resumeAttrs = batch
    ? `data-batch data-slot="${escape(entry.slot)}"`
    : `data-resume="${escape(entry.toolId)}" data-slot="${escape(entry.slot)}"`;
  return `
    <li class="saved-row${batch ? ' saved-row--batch' : ''}" data-search="${escape(searchText)}">
      <button class="saved-resume" ${resumeAttrs} aria-label="${batch ? 'Open batch' : 'Resume'} ${escape(entry.label ?? entry.slot)}"></button>
      ${thumb}
      <span class="saved-label"><h4>${escape(title)}</h4><small>${escape(subtitle)}</small>
      ${size}
      <button class="saved-delete" data-delete="${escape(entry.slot)}" title="Delete" aria-label="Delete">&#x2715;</button>
    </span></li>
  `;
}

// ── Misc helpers ────────────────────────────────────────────────────────────

function prefetchTool(toolId) {
  if (!toolId) return;
  const base = `/tools/${toolId}`;
  for (const file of ['tool.json', 'template.html', 'hooks.js']) {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.as = 'fetch';
    link.href = `${base}/${file}`;
    document.head.appendChild(link);
  }
}

function relativeTime(iso) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  const s = Math.max(0, (Date.now() - then) / 1000);
  if (s < 60) return 'just now';
  const m = s / 60; if (m < 60) return `${Math.round(m)}m ago`;
  const h = m / 60; if (h < 24) return `${Math.round(h)}h ago`;
  const d = h / 24; if (d < 7) return `${Math.round(d)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function fmtDateTime(d) {
  const date = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return `${date} ${time}`;
}

function fmtBytes(bytes) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
