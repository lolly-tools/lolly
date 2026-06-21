/**
 * Gallery view — lists available tools.
 *
 * Sorted by status (official → community → experimental). Experimental tools
 * get a visible badge. Clicking a card starts a new session; the Continue
 * button (shown when a saved session exists) resumes the latest one.
 */

import { escape } from '../utils.js';
import { toolSupport, capabilityLabel } from '../capabilities.js';
import { hiddenCategories, flagEnabled, PRO_FLAG } from '../feature-flags.js';

const CATEGORY_ORDER = ['everyone', 'designer', 'product', 'utility'];

// Mirrors pro/sessions.js BATCH_SLOT_PREFIX. Duplicated as a literal (not
// imported) so the gallery keeps zero dependency on the removable /pro folder.
const BATCH_SLOT_PREFIX = '__batch__:';
const isBatchSlot = (slot) => String(slot).startsWith(BATCH_SLOT_PREFIX);

// Saved sessions shown before the list collapses the rest behind a "Show all
// saved" button. Keeps the home page short when there are many sessions.
const INITIAL_SAVED = 12;

// lucide "package" — placeholder thumbnail for batch sessions, which have no
// single render to show. Inlined so it ships with the gallery, not /pro.
const PACKAGE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>';

export async function mountGallery(viewEl, host) {
  document.title = 'Lolly';
  const index = window.__toolIndex ?? { tools: [] };
  const [savedEntries, profile, storageEst, sessionSizes] = await Promise.all([
    host.state.list(),
    host.profile.get(),
    navigator.storage?.estimate().catch(() => null),
    host.state.sizes().catch(() => ({})),
  ]);

  // Re-resolve the headshot for the profile pill avatar. The object URL stored on
  // the profile ref goes stale across reloads, so fetch a fresh one by id.
  const headshotUrl = profile.headshot?.id
    ? (await host.assets.get(profile.headshot.id).catch(() => null))?.url || ''
    : '';

  // Most recent saved entry per tool. Batch sessions (no toolId; they resume to
  // #/pro) are skipped here so they don't become a tool's "Continue" target —
  // but they still appear in the Saved-sessions list below, with a package icon.
  const latestByTool = {};
  for (const entry of savedEntries) {
    if (isBatchSlot(entry.slot)) continue;
    const existing = latestByTool[entry.toolId];
    if (!existing || entry.updatedAt > existing.updatedAt) {
      latestByTool[entry.toolId] = entry;
    }
  }

  const grouped = {};
  for (const t of index.tools) {
    const key = t.category ?? 'other';
    (grouped[key] ??= []).push(t);
  }

  // Feature flags: hide categories the user has switched off, and (separately)
  // the Batch link. Default ON when unset.
  const hidden = hiddenCategories(profile);
  const proEnabled = flagEnabled(profile, PRO_FLAG.id);

  const sortedCategories = Object.entries(grouped)
    .filter(([cat]) => !hidden.has(cat))
    .sort(([a], [b]) => {
      const ai = CATEGORY_ORDER.indexOf(a);
      const bi = CATEGORY_ORDER.indexOf(b);
      if (ai === -1 && bi === -1) return 0;
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });

  const sortedSaved = [...savedEntries].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  // Render shell: category sections have empty grids; cards are filled by observer.
  viewEl.innerHTML = `
    <div class="gallery-header">
      <h1 class="visually-hidden">Lolly — tools gallery</h1>



     ${sortedSaved.length > 0 ? `
      <section class="saved-section">
        <h2 class="section-title">Saved sessions</h2>
        <ul class="saved-list">
          ${sortedSaved.map((s, i) => {
            const toolName = index.tools.find(t => t.id === s.toolId)?.name ?? '';
            return savedItem(s, sessionSizes[s.slot], toolName, i >= INITIAL_SAVED);
          }).join('')}
          ${sortedSaved.length > INITIAL_SAVED ? `
          <li class="saved-show-all-row">
            <button class="saved-show-all" type="button">Show all saved (${sortedSaved.length})</button>
          </li>` : ''}
        </ul>
      </section>
    ` : ''}
    <br></div>

    <div class="gallery"><a href="#/profile" class="profile-link${headshotUrl ? ' has-avatar' : ''}" aria-label="Open your profile">${headshotUrl ? `<img class="profile-link-avatar" src="${escape(headshotUrl)}" alt="">` : ''}<span class="profile-link-name">${escape(profile.firstname || 'Profile')}</span></a>
      <div class="gallery-search-results" hidden role="region" aria-label="Search results" aria-live="polite">
        <div class="tool-grid"></div>
      </div>
      ${sortedCategories.length === 0 ? `
        <div class="gallery-empty" role="status">
          <p class="gallery-empty-title">It looks like there are no tools available.</p>
          <p class="gallery-empty-hint">Try turning on categories in <a href="#/profile?focus=feature-flags">your feature flags</a>.</p>
        </div>
      ` : sortedCategories.map(([cat]) => `
        <section class="gallery-category category-${escape(cat.toLowerCase().replace(/\s+/g, '-'))}" data-cat="${escape(cat)}">
          <h2 class="category-title">${escape(cat)}</h2>
          <div class="tool-grid"></div>
        </section>
      `).join('')}
      <footer class="gallery-footer">
        ${proEnabled ? `<a href="#/pro" class="gallery-batch-link btn" aria-label="Open Batch mode — for power users">Pro</a>` : ''}
        <div class="gallery-search-wrap">
          <input class="gallery-search" type="search" placeholder="Search tools…" autocomplete="off" spellcheck="false" aria-label="Search tools">
        </div>
        <a href="/info/" class="gallery-info-link btn" aria-label="What is Lolly? — about &amp; help">What?</a>
      </footer>
    </div>
  `;

  // Lazily fill each category grid as it approaches the viewport.
  const categoryObserver = new IntersectionObserver((entries, obs) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const section = entry.target;
      obs.unobserve(section);
      const cat = section.dataset.cat;
      // Curated order — as listed in catalog/tools/index.json (not status-sorted),
      // so the catalog can hand-place tools regardless of official/experimental.
      const tools = grouped[cat] ?? [];
      section.querySelector('.tool-grid').innerHTML = tools
        .map(t => toolCard(t, latestByTool[t.id], host.capabilities)).join('');
      wireCardEvents(section, host, viewEl);
    }
  }, { rootMargin: '300px 0px' });

  viewEl.classList.toggle('no-saves', sortedSaved.length === 0);

  viewEl.querySelectorAll('.gallery-category').forEach(s => categoryObserver.observe(s));

  const searchInput   = viewEl.querySelector('.gallery-search');
  const searchResults = viewEl.querySelector('.gallery-search-results');
  const searchGrid    = searchResults.querySelector('.tool-grid');
  const categories    = viewEl.querySelectorAll('.gallery-category');
  const emptyState    = viewEl.querySelector('.gallery-empty');
  const savedSection  = viewEl.querySelector('.saved-section');
  const showAllRow    = viewEl.querySelector('.saved-show-all-row');

  // Collapse the saved list to the most-recent INITIAL_SAVED rows behind the
  // "Show all saved" button. Pressing it, or typing a search, reveals the rest —
  // while a query is active the collapse is bypassed so every match can surface.
  // Rows are read live each call so deletes stay in sync.
  let savedExpanded = false;
  function syncSaved(q) {
    if (!savedSection) return;
    const rows = [...savedSection.querySelectorAll('.saved-row')];
    const collapsed = !savedExpanded && !q;
    let anyMatch = false;
    rows.forEach((r, i) => {
      const matches = !q || r.dataset.search.includes(q);
      if (matches) anyMatch = true;
      r.hidden = !matches || (collapsed && i >= INITIAL_SAVED);
    });
    if (showAllRow) showAllRow.hidden = !collapsed || rows.length <= INITIAL_SAVED;
    savedSection.hidden = !!q && !anyMatch;
  }
  showAllRow?.querySelector('.saved-show-all')?.addEventListener('click', () => {
    savedExpanded = true;
    syncSaved(searchInput.value.trim().toLowerCase());
  });
  syncSaved('');

  // On gallery load, focus the search box so users can type-to-find immediately.
  // navigate() (main.js) sees focus is already placed on a meaningful element and
  // won't pull it back to the view container. Gated to fine-pointer devices so we
  // don't pop the on-screen keyboard over the gallery on every mobile visit.
  if (window.matchMedia?.('(pointer: fine)').matches) {
    searchInput.focus({ preventScroll: true });
  }

  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim().toLowerCase();
    syncSaved(q);
    if (emptyState) emptyState.hidden = !!q; // hide the no-tools notice while searching
    if (!q) {
      searchResults.hidden = true;
      categories.forEach(s => { s.hidden = false; });
    } else {
      // Filter tool cards
      const matched = index.tools.filter(t => t.name.toLowerCase().includes(q));
      searchGrid.innerHTML = matched.length
        ? matched.sort(byStatus).map(t => toolCard(t, latestByTool[t.id], host.capabilities)).join('')
        : `<p class="gallery-no-results">No tools match "<strong>${escape(q)}</strong>"</p>`;
      wireCardEvents(searchResults, host, viewEl);
      activateLazyThumbs(searchResults);
      searchResults.hidden = false;
      categories.forEach(s => { s.hidden = true; });
    }
  });

  // Lazy-load saved session and continue-button thumbs.
  activateLazyThumbs(viewEl);

  // Saved-session controls (delete) are in static HTML, wire immediately.
  viewEl.querySelectorAll('[data-delete]').forEach(el => {
    el.addEventListener('click', async () => {
      const row = el.closest('.saved-row');
      row?.classList.add('is-navigating');
      await host.state.delete(el.dataset.delete);
      row?.remove();
      const section = viewEl.querySelector('.saved-section');
      if (section && !section.querySelector('.saved-row')) {
        section.remove();
        viewEl.classList.add('no-saves');
      } else {
        syncSaved(searchInput.value.trim().toLowerCase());
      }
    });
  });

  viewEl.querySelectorAll('[data-resume], [data-batch]').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      el.closest('.saved-row, .tool-card')?.classList.add('is-navigating');
      window.location.hash = el.hasAttribute('data-batch')
        ? `#/pro?session=${encodeURIComponent(el.dataset.slot)}`
        : `#/tool/${el.dataset.resume}?slot=${encodeURIComponent(el.dataset.slot)}`;
    });
  });
}

function wireCardEvents(container, host, viewEl) {
  container.querySelectorAll('.tool-card[data-new-tool]').forEach(el => {
    // Prefetch tool files on first hover so navigation feels instant.
    // Navigation itself is handled by the <a class="tool-card-link"> inside each card.
    el.addEventListener('pointerenter', () => prefetchTool(el.dataset.newTool), { once: true });
  });

  // Mark the card as navigating when the user clicks its link or continue button.
  container.querySelectorAll('.tool-card-link').forEach(link => {
    link.addEventListener('click', () => {
      link.closest('.tool-card')?.classList.add('is-navigating');
    });
  });

  container.querySelectorAll('[data-resume], [data-batch]').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      el.closest('.tool-card, .saved-row')?.classList.add('is-navigating');
      window.location.hash = el.hasAttribute('data-batch')
        ? `#/pro?session=${encodeURIComponent(el.dataset.slot)}`
        : `#/tool/${el.dataset.resume}?slot=${encodeURIComponent(el.dataset.slot)}`;
    });
  });

  // Lazy-load any thumbs that were just injected.
  activateLazyThumbs(container);
}

function prefetchTool(toolId) {
  const base = `/tools/${toolId}`;
  for (const file of ['tool.json', 'template.html', 'hooks.js']) {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.as = 'fetch';
    link.href = `${base}/${file}`;
    document.head.appendChild(link);
  }
}

function activateLazyThumbs(container) {
  const imgs = container.querySelectorAll('img[data-src]');
  if (!imgs.length) return;
  const io = new IntersectionObserver((entries, obs) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const img = entry.target;
      img.src = img.dataset.src;
      obs.unobserve(img);
    }
  }, { rootMargin: '200px 0px' });
  imgs.forEach(img => io.observe(img));
}

function byStatus(a, b) {
  const order = { official: 0, community: 1, experimental: 2 };
  return (order[a.status] ?? 3) - (order[b.status] ?? 3);
}

function toolCard(tool, latest, shellCaps) {
  const sup = toolSupport(tool, shellCaps);
  // Can't run here and can't be enabled (e.g. capture on Firefox/Safari): a
  // non-navigable "desktop only" card. 'install' (capture on Chromium) falls
  // through to a normal clickable card — the tool view offers the extension.
  if (sup.status === 'unavailable') return unavailableCard(tool, sup.unmet);

  const statusBadge = sup.status === 'install'
    ? '<span class="badge badge-install">Add&#8209;on</span>'
    : (tool.status !== 'official'
        ? `<span class="badge badge-${tool.status}">${escape(tool.status)}</span>`
        : '');
  const continueBtn = latest
    ? `<button class="tool-card-action tool-card-action--continue"
               data-resume="${escape(latest.toolId)}"
               data-slot="${escape(latest.slot)}"
               aria-label="Continue: ${escape(latest.filename || tool.name)}">
        ${latest.thumb ? `<img class="tool-card-thumb" data-src="${escape(latest.thumb)}" alt="" aria-hidden="true">` : ''}
        <span aria-hidden="true"></span>
      </button>`
    : '';
  return `
    <div class="tool-card" data-new-tool="${escape(tool.id)}">
      ${statusBadge}
      <div class="tool-card-body">
        <a class="tool-card-link tool-name" href="#/tool/${escape(tool.id)}">${escape(tool.name)}</a>
        <span class="tool-desc">${escape(tool.description ?? '')}</span>
      </div>
      ${continueBtn ? `<div class="tool-card-actions">${continueBtn}</div>` : ''}
    </div>
  `;
}

// A tool this shell can't run: rendered greyed-out and non-navigable, with a
// "Desktop" badge and a tooltip naming the missing capability. No data-new-tool
// and no .tool-card-link, so wireCardEvents leaves it inert.
function unavailableCard(tool, unmet) {
  const why = unmet.map(capabilityLabel).join(', ');
  return `
    <div class="tool-card tool-card--unavailable" title="Desktop only — the web app can’t provide ${escape(why)}">
      <span class="badge badge-desktop">Desktop</span>
      <div class="tool-card-body">
        <span class="tool-name" aria-disabled="true">${escape(tool.name)}</span>
        <span class="tool-desc">${escape(tool.description ?? '')}</span>
      </div>
    </div>
  `;
}

function storageBar({ usage = 0, quota = 0 }) {
  const mb  = usage / 1024 / 1024;
  const used = mb < 1 ? `${Math.round(usage / 1024)} KB` : `${mb.toFixed(1)} MB`;
  if (!quota) return used;
  const pct  = Math.min(100, Math.round((usage / quota) * 100));
  const quotaMb = quota / 1024 / 1024;
  const cap = quotaMb >= 1024 ? `${(quotaMb / 1024).toFixed(0)} GB` : `${Math.round(quotaMb)} MB`;
  return `<span class="storage-bar-wrap"><span class="storage-bar-fill" style="width:${pct}%"></span></span>${used} of ${cap}`;
}

function savedItem(entry, bytes, toolName = '', hidden = false) {
  const batch = isBatchSlot(entry.slot);
  const thumb = batch
    ? `<span class="saved-thumb saved-thumb--batch" aria-hidden="true">${PACKAGE_ICON}</span>`
    : entry.thumb
      ? `<img class="saved-thumb" data-src="${escape(entry.thumb)}" alt="" aria-hidden="true">`
      : `<span class="saved-thumb saved-thumb--empty"></span>`;
  const when = entry.updatedAt ? fmtDateTime(new Date(entry.updatedAt)) : '';
  const size = bytes ? `<small class="session-size">${fmtBytes(bytes)}</small>` : '';
  const title = batch ? (entry.label || 'Batch session') : (entry.filename || entry.toolId);
  const subtitle = batch ? `Batch · ${when}` : when;
  const searchText = [title, entry.toolId, toolName, batch ? 'batch' : ''].filter(Boolean).join(' ').toLowerCase();
  // Batch sessions resume into #/pro (the [data-batch] branch in the resume
  // wiring); tool sessions resume into #/tool via data-resume.
  const resumeAttrs = batch
    ? `data-batch data-slot="${escape(entry.slot)}"`
    : `data-resume="${escape(entry.toolId)}" data-slot="${escape(entry.slot)}"`;
  return `
    <li class="saved-row tool-card${batch ? ' saved-row--batch' : ''}"${hidden ? ' hidden' : ''} data-search="${escape(searchText)}">
      <button class="saved-resume" ${resumeAttrs} aria-label="${batch ? 'Open batch' : 'Resume'} ${escape(entry.label ?? entry.slot)}"></button>
      ${thumb}
      <span class="saved-label"><h4>${escape(title)}</h4><small>${escape(subtitle)}</small>
      ${size}
      <button class="saved-delete" data-delete="${escape(entry.slot)}" title="Delete" aria-label="Delete">&#x2715;</button>
    </span></li>
  `;
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
