// SPDX-License-Identifier: MPL-2.0
/**
 * profile: the Available-offline download manager - per-tool pins, the model parts and the sweep.
 *
 * Every function takes the shared `pv: ProfileViewCtx` first (see context.ts). Sibling
 * calls in this file are direct; a call into another module, and every use of a
 * function as a value (an event listener), goes through `pv.<module>.<fn>`. Extracted verbatim
 * from mountProfile() by scripts/split-closure.ts.
 */
import { aiOfflinePartAllowed, aiPolicy } from '../../lib/ai-policy.ts';
import { presentApis } from '@lolly-tools/core/host-v1';
import { currentLang, t, tRaw } from '../../i18n.ts';
import { playSfx } from '../../lib/sfx.ts';
import { staggerReveal } from '../../lib/reveal.ts';
import { escape as escapeText } from '../../utils.ts';
import { icon } from '../../lib/icons.ts';
import { announce } from '../../a11y.ts';
import { pinRecords, pinTool, unpinAll, unpinTool } from '../../lib/offline-pins.ts';
import type { PinRecord } from '../../lib/offline-pins.ts';
import { catalogDownloadSummary, catalogScopeSize, downloadCatalogScope, prefetchAssetsById } from '../../catalog/sync.ts';
import { docsFileList, downloadAiDetect, downloadApp, downloadAsk, downloadDocs, downloadDurable, downloadMatte, downloadOcr, downloadReword, downloadSpeech, downloadUpscale, downloadVerify, fetchInfoManifest, fetchPrecacheManifest, partRecords, persistenceState, recordCatalogDownload, removePart, storageHeadroom, trustmarkGroupSplit } from '../../lib/offline-manager.ts';
import type { DownloadProgress, OfflinePartId, PartState } from '../../lib/offline-manager.ts';
import { beginOfflineRun, cancelOfflineRun, offlineRunActive, offlineRunLine, subscribeOfflineRun } from '../../lib/offline-run.ts';
import type { OfflineRunHandle, OfflineRunLine } from '../../lib/offline-run.ts';
import { toolSupport } from '../../capabilities.ts';
import { confirmDialog } from '../../components/confirm-dialog.ts';
import { fmtBytes } from '../../folder-tiles.ts';
import { bindOp, type ProfileViewCtx } from './context.ts';

export async function loadOffline(pv: ProfileViewCtx) {
  const { host, viewEl } = pv;
  if (pv.offlineLoaded) return;
  pv.offlineLoaded = true;
  const body = viewEl.querySelector<HTMLElement>('#offline-body')!;
  interface OfflineTool { id: string; name?: string; icon?: string; listed?: boolean; capabilities?: readonly string[] }
  const tools = ((window.__toolIndex?.tools ?? []) as OfflineTool[])
    // Unlisted tools (context-invoked, e.g. asset-export) and tools this shell
    // can't run are not offered - a download the device can't use is dead weight.
    .filter(tl => tl.listed !== false && toolSupport(tl, host.capabilities, presentApis(host)).status !== 'unavailable')
    .sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));
  let pins: Record<string, PinRecord> = {};
  try { pins = await pinRecords(); } catch { /* IDB unavailable - render all as not downloaded */ }

  const rowHtml = (tl: OfflineTool): string => {
    const rec = pins[tl.id];
    const name = tl.name || tl.id;
    return `
        <li class="odl-row" data-tool="${escapeText(tl.id)}" data-name="${escapeText(name.toLowerCase())}">
          <span class="odl-row-icon" aria-hidden="true">${tl.icon ?? ''}</span>
          <span class="odl-row-name">${escapeText(name)}</span>
          <span class="odl-row-size">${rec ? fmtBytes(rec.bytes) : ''}</span>
          <button type="button" class="odl-pin${rec ? ' is-pinned' : ''}" data-odl="${escapeText(tl.id)}" aria-pressed="${rec ? 'true' : 'false'}" title="${escapeText(rec ? t('Available offline') : t('Keep available offline'))}" aria-label="${escapeText(rec ? tRaw('Remove {name} from offline', { name }) : tRaw('Keep {name} available offline', { name }))}">
            <span class="pin-layer pin-dl" aria-hidden="true">${icon('download')}</span>
            <span class="pin-layer pin-ring" aria-hidden="true">${icon('ring')}</span>
            <span class="pin-layer pin-done" aria-hidden="true">${icon('circleCheck')}</span>
          </button>
        </li>`;
  };

  // Everything the parts rows need up front - all cheap (two small manifest
  // fetches + the already-synced asset index + IDB reads), all best-effort.
  const [precache, infoManifest, catSummary, parts, persist] = await Promise.all([
    fetchPrecacheManifest(),
    fetchInfoManifest(),
    catalogDownloadSummary(),
    partRecords().catch(() => ({} as PartState)),
    persistenceState(),
  ]);
  // The folded summary: what this device is actually holding offline, tools plus
  // parts. Measured once, when the card opens - a download made later in the same
  // visit shows in the card's own rows, and this line catches up on the next mount.
  const heldBytes = Object.values(pins).reduce((n, r) => n + (r?.bytes || 0), 0)
    + Object.values(parts).reduce((n, r) => n + (r?.bytes || 0), 0);
  pv.summaries.setSummary('offline-section', heldBytes ? fmtBytes(heldBytes) : tRaw('Not downloaded'));

  const sum = (files: readonly { size: number }[]) => files.reduce((n, f) => n + f.size, 0);
  const plannedBytes: Record<OfflinePartId, number> = {
    app: precache ? sum(precache.groups.app) : 0,
    docs: infoManifest ? sum(docsFileList(infoManifest, currentLang())) : 0,
    // The trustmark models group carries BOTH parts' files, so each row prices its
    // own half (offline-manager's trustmarkGroupSplit is the one rule).
    verify: precache ? sum(precache.groups.ort) + sum(trustmarkGroupSplit(precache.groups.models).verify) : 0,
    catalog: catSummary?.totalBytes ?? 0,
    speech: precache ? sum(precache.groups.speech ?? []) + sum(precache.groups.ortHf ?? []) : 0,
    upscale: precache?.groups.upscale ? sum(precache.groups.upscale) : 0,
    matte: precache?.groups.matte ? sum(precache.groups.matte) : 0,
    ocr: precache?.groups.ocr ? sum(precache.groups.ocr) : 0,
    // Like speech, the reword part owns the shared /ort-hf/ runtime too, so
    // its stated size is honest when it is the only transformers part taken.
    reword: precache?.groups.reword?.length ? sum(precache.groups.reword) + sum(precache.groups.ortHf ?? []) : 0,
    // The Ask embed model (plans/103 M1) - same shared-runtime accounting.
    ask: precache?.groups.embed?.length ? sum(precache.groups.embed) + sum(precache.groups.ortHf ?? []) : 0,
    // The AI-text detector (plans/126 WP-A) - same shared-runtime accounting.
    'ai-detect': precache?.groups.aiDetect?.length ? sum(precache.groups.aiDetect) + sum(precache.groups.ortHf ?? []) : 0,
    // The durable-credential encoder. Manifest-driven like every other model part:
    // a build whose model host does not list the encoder offers no row, rather than
    // a Download button that fails.
    durable: precache ? sum(trustmarkGroupSplit(precache.groups.models).durable) : 0,
  };
  // Model parts are release-versioned in IndexedDB (invalidated by their own
  // cache-version, not a manifest watermark), so they have no live manifest
  // version to go stale against - resyncOfflineParts never touches them.
  const liveVersion = (id: OfflinePartId): string | null =>
    id === 'docs' ? (infoManifest?.version ?? null)
    : (id === 'upscale' || id === 'matte' || id === 'ocr' || id === 'durable') ? null
    : (precache?.version ?? null);

  interface PartDef { id: OfflinePartId; name: string; desc: string; heavy?: boolean }
  const partDefs: PartDef[] = [
    { id: 'app', name: t('The app'), desc: t('Every view, editor and font - so the whole app opens and renders with no connection, not just the pages you have already visited.') },
    { id: 'catalog', name: t('Catalogue'), desc: t('Brand assets beyond the essentials - logos, art and music your tools can pull in. Narrow it by tag if you only need some of it.') },
    { id: 'docs', name: t('Guides & docs'), desc: t('The full documentation site in your language, screenshots included.') },
    { id: 'speech', name: t('Speech voices'), desc: t('Voice models for Script audio and narration. Downloads once (~{size}), runs on-device.', { size: fmtBytes(plannedBytes.speech) }), heavy: true },
    { id: 'upscale', name: t('Upscaling models'), desc: t('The AI image upscalers - photo, illustration/anime and face. Pull them down now (~{size}) and Upscale runs offline, with no wait when you need it.', { size: fmtBytes(plannedBytes.upscale) }), heavy: true },
    { id: 'matte', name: t('Background removal'), desc: t('The on-device cut-out models for Remove background. Pull them down now (~{size}) and it runs offline, with no wait when you need it.', { size: fmtBytes(plannedBytes.matte) }), heavy: true },
    { id: 'ocr', name: t('Text recognition'), desc: t('The on-device OCR models for reading text out of images. Pull them down now (~{size}) and Copy text runs offline, with no wait when you need it.', { size: fmtBytes(plannedBytes.ocr) }), heavy: true },
    { id: 'verify', name: t('Verify deep scan'), desc: t('The on-device watermark scanner for the Verify page. Big - only worth it if you check content credentials away from a connection.'), heavy: true },
    { id: 'durable', name: t('Durable credential'), desc: t('The on-device model that hides an invisible credential in exported pixels. Pull it down now (~{size}) and the first durable export starts straight away, with no wait.', { size: fmtBytes(plannedBytes.durable) }), heavy: true },
    // Only on builds carrying the staged model (plans/127) - the group is
    // empty on public/CI builds and the row would be a dead control.
    ...(precache?.groups.reword?.length ? [{
      id: 'reword' as const,
      name: t('Rewriter model'),
      desc: t('The on-device rewriter behind Humanize. Pull it down now (~{size}) and rewording runs fully offline, with no wait when you need it.', { size: fmtBytes(plannedBytes.reword) }),
      heavy: true,
    }] : []),
    // Only on builds carrying the staged embed model (plans/103 M1) - the
    // group is empty on builds where the model is not staged.
    ...(precache?.groups.embed?.length ? [{
      id: 'ask' as const,
      name: t('Ask matching model'),
      desc: t('The small on-device model that helps Ask Lolly match questions to the right docs section. Pull it down now (~{size}) and better matching works offline from the first question.', { size: fmtBytes(plannedBytes.ask) }),
    }] : []),
    // Only on builds carrying a staged detector (plans/126 WP-A) - the group
    // is empty on builds where no model is staged.
    ...(precache?.groups.aiDetect?.length ? [{
      id: 'ai-detect' as const,
      name: t('AI text detector'),
      desc: t('The on-device model behind the deeper AI-text check on Verify and in the catalog. Pull it down now (~{size}) and the check runs offline, with no wait when you need it.', { size: fmtBytes(plannedBytes['ai-detect']) }),
    }] : []),
  ];

  const partRowHtml = (p: PartDef): string => `
      <li class="odl-part" data-part="${p.id}">
        <div class="odl-part-info">
          <span class="odl-part-name">${escapeText(p.name)}${p.heavy ? ` <span class="odl-part-heavy">${t('large download')}</span>` : ''}</span>
          <span class="odl-part-desc">${escapeText(p.desc)}</span>
          ${p.id === 'catalog' && catSummary?.tags.length ? `
          <details class="odl-tagscope">
            <summary>${t('Choose by tag')}</summary>
            <div class="odl-tagchips">${catSummary.tags.map(tg => `
              <label class="odl-tagchip"><input type="checkbox" value="${escapeText(tg.tag)}"><span>${escapeText(tg.tag)}</span><span class="odl-tagchip-size">${fmtBytes(tg.bytes)}</span></label>`).join('')}
            </div>
          </details>` : ''}
          <span class="odl-part-sub" data-part-sub="${p.id}" aria-live="polite"></span>
        </div>
        <span class="odl-part-actions">
          <button type="button" class="btn" data-part-dl="${p.id}">${t('Download')}</button>
          <button type="button" class="btn-link-danger" data-part-rm="${p.id}" hidden>${t('Remove')}</button>
        </span>
      </li>`;

  body.innerHTML = `
      <p class="storage-hint-text">${t('Heading somewhere with no connection? Download what you need and it all keeps working - the app, your tools, the catalogue and the docs. Downloads stay on this device and refresh themselves when you are back online.')}</p>
      <div class="odl-sweep">
        <button type="button" id="odl-everything" class="btn">${t('Download everything')}</button>
        <button type="button" id="odl-cancel" class="btn" hidden>${t('Cancel')}</button>
        <span class="odl-sweep-size" id="odl-sweep-size"></span>
      </div>
      <label class="odl-sweep-models" id="odl-models-row" hidden><input type="checkbox" id="odl-incl-models"><span>${t('Include all the AI models')} <span class="odl-part-heavy">${t('large download')}</span></span><span class="odl-sweep-models-size" id="odl-models-size"></span></label>
      <div class="odl-progress" id="odl-progress" hidden>
        <div class="odl-progress-track" role="progressbar" aria-label="${escapeText(t('Offline download progress'))}" aria-valuemin="0" aria-valuemax="100"><div class="odl-progress-fill"></div></div>
        <span class="odl-progress-text" aria-live="polite"></span>
      </div>
      <ul class="odl-parts">${partDefs.map(partRowHtml).join('')}</ul>
      <p class="odl-persist" id="odl-persist" hidden></p>
      <h3 class="odl-subhead">${t('Tools')}</h3>
      <p class="storage-hint-text">${t('Download a tool to keep it working with no connection - its template, hooks and fonts are stored on this device. The tick means ready offline.')}</p>
      <div class="odl-head">
        <span class="odl-total" id="odl-total" aria-live="polite"></span>
        <button type="button" id="odl-all" class="btn">${t('Download all')}</button>
        <button type="button" id="odl-none" class="btn-link-danger">${t('Remove all')}</button>
      </div>
      <input type="search" class="odl-search" placeholder="${escapeText(t('Search tools…'))}" aria-label="${escapeText(t('Search tools'))}">
      <ul class="odl-list">${tools.map(rowHtml).join('')}</ul>
      <p class="odl-empty" hidden>${t('No tools match.')}</p>`;
  staggerReveal([...body.children], { sound: false });

  const totalEl = body.querySelector<HTMLElement>('#odl-total')!;
  const allBtn = body.querySelector<HTMLButtonElement>('#odl-all')!;
  const noneBtn = body.querySelector<HTMLButtonElement>('#odl-none')!;
  const updateTotals = () => {
    const recs = Object.entries(pins).filter(([id]) => tools.some(tl => tl.id === id));
    const bytes = recs.reduce((n, [, r]) => n + (r.bytes || 0), 0);
    totalEl.textContent = t('{n} of {total} downloaded · {size} on disk', { n: recs.length, total: tools.length, size: fmtBytes(bytes) });
    allBtn.hidden = recs.length >= tools.length;
    noneBtn.hidden = recs.length === 0;
  };
  updateTotals();

  // One row's state, updated in place once a pin or unpin finishes.
  const syncRow = (id: string) => {
    const row = body.querySelector<HTMLElement>(`.odl-row[data-tool="${CSS.escape(id)}"]`);
    const rec = pins[id];
    if (!row) return;
    const sizeEl = row.querySelector<HTMLElement>('.odl-row-size');
    if (sizeEl) sizeEl.textContent = rec ? fmtBytes(rec.bytes) : '';
    const btn = row.querySelector<HTMLElement>('.odl-pin');
    const name = row.querySelector('.odl-row-name')?.textContent ?? id;
    if (btn) {
      btn.classList.toggle('is-pinned', !!rec);
      btn.setAttribute('aria-pressed', String(!!rec));
      btn.title = rec ? t('Available offline') : t('Keep available offline');
      btn.setAttribute('aria-label', rec ? tRaw('Remove {name} from offline', { name }) : tRaw('Keep {name} available offline', { name }));
    }
    updateTotals();
  };

  // Same erased cast as the gallery's pin handler - the concrete web host
  // satisfies sync's structural SyncHost slice at runtime.
  const prefetch = (ids: string[]) => prefetchAssetsById(host as unknown as Parameters<typeof prefetchAssetsById>[0], ids);
  const celebrate = (btn: HTMLElement) => {
    btn.classList.add('is-celebrating');
    const done = () => btn.classList.remove('is-celebrating');
    btn.addEventListener('animationend', done, { once: true });
    setTimeout(done, 900); // reduced-motion fires no animationend
  };
  // Downloads one tool and updates its row; returns false on failure. Shared by
  // the per-row button and the Download-all sweep (which silences the per-tool
  // chime so a 20-tool run isn't 20 fanfares).
  const download = async (id: string, btn: HTMLElement | null, { chime = true } = {}): Promise<boolean> => {
    btn?.classList.add('is-busy');
    try {
      await pinTool(id, prefetch);
      pins = await pinRecords();
      syncRow(id);
      if (btn) { celebrate(btn); }
      if (chime) playSfx('victory');
      return true;
    } catch (err) {
      host.log('warn', 'Offline download failed', { toolId: id, error: String(err) });
      return false;
    } finally {
      btn?.classList.remove('is-busy');
    }
  };

  body.querySelector('.odl-list')?.addEventListener('click', async e => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-odl]');
    if (!btn || btn.classList.contains('is-busy')) return;
    const id = btn.dataset.odl!;
    const name = tools.find(tl => tl.id === id)?.name ?? id;
    if (pins[id]) {
      btn.classList.add('is-busy');
      try {
        await unpinTool(id);
        pins = await pinRecords();
        syncRow(id);
        announce(tRaw('{name} removed from offline', { name }));
      } finally { btn.classList.remove('is-busy'); }
    } else {
      const ok = await download(id, btn);
      announce(ok
        ? tRaw('{name} is available offline', { name })
        : tRaw('Couldn’t save {name} for offline - check your connection', { name }), { assertive: !ok });
    }
    await pv.storage.refreshCounter(); // the Storage meter's pins slice moved
  });

  // Sequential sweep - one spinner walks the list (parallel fetch storms help
  // nobody on the connections this feature exists for). Failures are skipped
  // and reported as a count; the button doubles as the progress line. Shared
  // by the tools-row "Download all" and the section's "Download everything".
  // Re-entrancy is its OWN flag, not allBtn.disabled: the Everything sweep
  // now runs the tools phase while the run holds every control disabled, so
  // reading the button's state here would skip the phase entirely.
  let toolsSweeping = false;
  const sweepTools = async ({ fanfare = true, run = null as OfflineRunHandle | null } = {}): Promise<number> => {
    if (toolsSweeping) return 0;
    toolsSweeping = true;
    allBtn.disabled = true;
    const queue = tools.filter(tl => !pins[tl.id]);
    let failed = 0;
    let n = 0;
    try {
      for (const tl of queue) {
        // Cooperative cancel: the toast's ✕ (or the in-view Cancel) stops the
        // sweep between tools - a tool download is short, so there is nothing
        // finer to interrupt.
        if (run?.cancelled) break;
        allBtn.textContent = t('Downloading {n} of {total}…', { n: ++n, total: queue.length });
        run?.report({ label: t('Tools'), loaded: n, total: queue.length, unit: 'items' });
        const btn = body.querySelector<HTMLElement>(`.odl-pin[data-odl="${CSS.escape(tl.id)}"]`);
        if (!await download(tl.id, btn, { chime: false })) failed++;
      }
    } finally {
      toolsSweeping = false;
      allBtn.disabled = false;
      allBtn.textContent = t('Download all');
    }
    if (fanfare) {
      if (failed === 0) playSfx('victory');
      announce(failed
        ? t('{n} downloads failed - check your connection', { n: failed })
        : t('All tools are available offline'), { assertive: failed > 0 });
    }
    await pv.storage.refreshCounter();
    return failed;
  };
  // The tools-only sweep is a run too: dozens of small fetches still deserve
  // to survive leaving the view, and to be cancellable from the toast.
  allBtn.addEventListener('click', () => { void (async () => {
    if (offlineRunActive()) return;
    const run = beginOfflineRun(t('Downloading tools'));
    if (!run) return;
    try { await sweepTools({ run }); } finally { run.end(); }
  })(); });

  noneBtn.addEventListener('click', async () => {
    const sure = await confirmDialog({
      title: t('Remove all offline downloads?'),
      message: t('Every downloaded tool is removed from this device. Each re-downloads on demand when you next open it online.'),
      confirmLabel: t('Remove all'),
      danger: true,
    });
    if (!sure) return;
    await unpinAll();
    pins = {};
    body.querySelectorAll<HTMLElement>('.odl-row').forEach(r => syncRow(r.dataset.tool!));
    announce(t('Offline downloads removed'));
    await pv.storage.refreshCounter();
  });

  // Live search - plain substring over the display name.
  const search = body.querySelector<HTMLInputElement>('.odl-search')!;
  const emptyEl = body.querySelector<HTMLElement>('.odl-empty')!;
  search.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase();
    let shown = 0;
    body.querySelectorAll<HTMLElement>('.odl-row').forEach(row => {
      const hit = !q || (row.dataset.name ?? '').includes(q);
      row.hidden = !hit;
      if (hit) shown++;
    });
    emptyEl.hidden = shown > 0;
  });

  // ── The parts rows: app / catalogue / docs / verify ─────────────────────
  let partState: PartState = parts;
  // Re-entrancy WITHIN this view is decided on this flag, set SYNCHRONOUSLY at
  // runParts entry - the run is only registered after two awaits (headroom
  // estimate + confirm dialog), which is exactly the window a double-click
  // exploits. Across views (a remount mid-run) the module-level
  // offlineRunActive() is the guard, since this flag is fresh per mount.
  let running = false;
  // The catalogue row's recorded scope no longer matches the checked chips - 
  // display state only; the record itself is untouched until a download runs.
  let catalogScopeDirty = false;
  const everythingBtn = body.querySelector<HTMLButtonElement>('#odl-everything')!;
  const cancelBtn = body.querySelector<HTMLButtonElement>('#odl-cancel')!;
  const sweepSizeEl = body.querySelector<HTMLElement>('#odl-sweep-size')!;
  const progWrap = body.querySelector<HTMLElement>('#odl-progress')!;
  const progTrack = progWrap.querySelector<HTMLElement>('.odl-progress-track')!;
  const progFill = progWrap.querySelector<HTMLElement>('.odl-progress-fill')!;
  const progText = progWrap.querySelector<HTMLElement>('.odl-progress-text')!;

  // The current catalogue scope: the checked tag chips, or the whole catalogue.
  const catalogScope = (): 'all' | string[] => {
    const picked = [...body.querySelectorAll<HTMLInputElement>('.odl-tagchip input:checked')].map(c => c.value);
    return picked.length ? picked : 'all';
  };
  let catalogPlanned = plannedBytes.catalog;

  // A part is downloadable when its manifest (or index) was reachable. The
  // dev server ships no dist/precache.json - the rows say so instead of
  // pretending a download happened.
  const partAvailable: Record<OfflinePartId, boolean> = {
    app: !!precache, docs: !!infoManifest, verify: !!precache && plannedBytes.verify > 0, catalog: !!catSummary,
    speech: !!precache && plannedBytes.speech > 0,
    upscale: !!precache && plannedBytes.upscale > 0,
    matte: !!precache && plannedBytes.matte > 0,
    ocr: !!precache && plannedBytes.ocr > 0,
    reword: !!precache && plannedBytes.reword > 0,
    ask: !!precache && plannedBytes.ask > 0,
    'ai-detect': !!precache && plannedBytes['ai-detect'] > 0,
    durable: !!precache && plannedBytes.durable > 0,
  };
  const isStale = (id: OfflinePartId): boolean => {
    const rec = partState[id];
    if (!rec) return false;
    if (id === 'catalog') return catalogScopeDirty;
    const live = liveVersion(id);
    return (live !== null && rec.version !== live) || (id === 'docs' && rec.lang !== currentLang());
  };
  /** What this part would still download: full size when absent, a token
   *  slice when downloaded-but-stale (delta re-syncs skip current files), and
   *  zero when current - so preflights and the sweep price REMAINING work,
   *  not work already on disk. */
  const planned = (id: OfflinePartId): number => {
    const full = id === 'catalog' ? catalogPlanned : plannedBytes[id];
    if (!partState[id]) return full;
    return isStale(id) ? Math.round(full / 8) : 0;
  };

  const syncPartRow = (id: OfflinePartId): void => {
    const row = body.querySelector<HTMLElement>(`.odl-part[data-part="${id}"]`);
    if (!row) return;
    const sub = row.querySelector<HTMLElement>(`[data-part-sub="${id}"]`)!;
    const dl = row.querySelector<HTMLButtonElement>(`[data-part-dl="${id}"]`)!;
    const rm = row.querySelector<HTMLButtonElement>(`[data-part-rm="${id}"]`)!;
    const rec = partState[id];
    if (!aiOfflinePartAllowed(id)) {
      sub.textContent = t('AI downloads are disabled by your service policy.');
      dl.hidden = true;
      rm.hidden = !rec;
      return;
    }
    if (!partAvailable[id]) {
      sub.textContent = t('Not offered by this server');
      dl.hidden = true;
      rm.hidden = true;
      return;
    }
    if (rec) {
      const stale = isStale(id);
      sub.textContent = stale
        ? (id === 'catalog' ? t('Selection changed · download to update') : t('Downloaded · update available'))
        : t('Downloaded · {size} on disk', { size: fmtBytes(rec.bytes) });
      dl.textContent = stale ? t('Update') : t('Downloaded');
      dl.disabled = !stale;
      dl.hidden = false;
      rm.hidden = false;
    } else {
      sub.textContent = fmtBytes(planned(id));
      dl.textContent = t('Download');
      dl.disabled = false;
      dl.hidden = false;
      rm.hidden = true;
    }
  };

  // The heavyweight on-device AI models. Kept OUT of the plain "Download everything"
  // sweep (hiding a multi-GB download inside one button misleads) - but the opt-in
  // checkbox below folds them in, with their combined size stated up front so it stays
  // honest. availableModelParts() filters to what THIS server actually offers.
  const MODEL_PARTS = ['speech', 'upscale', 'matte', 'ocr', 'reword', 'ask', 'ai-detect', 'verify', 'durable'] as const;
  const inclModels = (): boolean => !!body.querySelector<HTMLInputElement>('#odl-incl-models')?.checked;
  const availableModelParts = (): OfflinePartId[] => MODEL_PARTS.filter(id => partAvailable[id] && aiOfflinePartAllowed(id));
  const modelsRow = body.querySelector<HTMLElement>('#odl-models-row');
  const modelsSizeEl = body.querySelector<HTMLElement>('#odl-models-size');
  const syncSweepSize = (): void => {
    // "Everything" = app + catalogue scope + docs + every tool; the models fold in only when
    // the "Include all the AI models" box is ticked. planned() prices only REMAINING work,
    // so downloaded-and-current parts cost 0.
    const base = ['app', 'catalog', 'docs'] as const;
    const ids: readonly OfflinePartId[] = inclModels() ? [...base, ...availableModelParts()] : base;
    const remaining = ids.filter(id => partAvailable[id]).reduce((n, id) => n + planned(id), 0);
    sweepSizeEl.textContent = remaining ? t('about {size}', { size: fmtBytes(remaining) }) : '';
    // The opt-in row: shown only when this server offers models, labelled with their combined
    // remaining size so ticking it is never a surprise.
    const modelIds = availableModelParts();
    if (modelsRow) modelsRow.hidden = modelIds.length === 0;
    if (modelsSizeEl) {
      const modelsRemaining = modelIds.reduce((n, id) => n + planned(id), 0);
      modelsSizeEl.textContent = modelsRemaining ? t('about {size}', { size: fmtBytes(modelsRemaining) })
        : modelIds.length ? t('all saved') : '';
    }
    for (const id of ['app', 'docs', 'speech', 'upscale', 'matte', 'ocr', 'reword', 'ask', 'ai-detect', 'verify', 'durable', 'catalog'] as const) syncPartRow(id);
    // A live run owns row enablement: syncPartRow reads storage state, so it
    // would re-enable rows the run just froze. This fires from async
    // re-pricing (tag chips, the recorded-scope restore) too, which is
    // exactly when a view mounted mid-run would flicker back to idle.
    if (offlineRunActive()) setBusy(true);
  };

  const setBusy = (busy: boolean): void => {
    everythingBtn.disabled = busy;
    allBtn.disabled = busy;
    cancelBtn.hidden = !busy;
    body.querySelectorAll<HTMLButtonElement>('[data-part-dl],[data-part-rm]').forEach(b => { b.disabled = busy; });
    // The scope a run downloads is captured at start - freezing the chips
    // keeps the UI from implying a mid-run change would apply to it.
    body.querySelectorAll<HTMLInputElement>('.odl-tagchip input').forEach(c => { c.disabled = busy; });
    progWrap.hidden = !busy;
    if (!busy) syncSweepSize(); // restore per-row enablement from state
  };

  // Paints ONE line of the run onto this view's bar. It is fed by the run's
  // fan-out (subscribeOfflineRun below), not by the download loop directly -
  // so the bar keeps painting in whichever /profile is currently mounted,
  // including one mounted after the run started somewhere else.
  const showProgress = (line: OfflineRunLine): void => {
    const label = line.label;
    const num = (n: number): string => line.unit === 'items' ? String(n) : fmtBytes(n);
    const pct = line.total ? Math.min(100, Math.round((line.loaded / line.total) * 100)) : null;
    progTrack.classList.toggle('is-indeterminate', pct === null);
    if (pct === null) {
      progTrack.removeAttribute('aria-valuenow');
      progFill.style.width = '100%';
      progText.textContent = tRaw('{label} - {loaded} so far…', { label, loaded: num(line.loaded) });
    } else {
      progTrack.setAttribute('aria-valuenow', String(pct));
      progFill.style.width = `${pct}%`;
      progText.textContent = tRaw('{label} - {loaded} of {total}', { label, loaded: num(line.loaded), total: num(line.total ?? 0) });
    }
  };

  // The erased cast sync's other callers use - the concrete web host
  // satisfies the structural SyncHost slice at runtime.
  const syncHost = host as unknown as Parameters<typeof downloadCatalogScope>[0];
  const partLabel = (id: OfflinePartId): string => partDefs.find(p => p.id === id)?.name ?? id;

  /** Run one part's download; true on success. The caller owns busy state
   *  and passes the catalogue scope it CAPTURED at run start - re-reading
   *  the live checkboxes here would let a mid-run change alter what a
   *  started download means. Progress goes to the RUN (job + every mounted
   *  view), never straight to this view's bar. */
  const runPart = async (id: OfflinePartId, run: OfflineRunHandle, scope: 'all' | string[]): Promise<boolean> => {
    const signal = run.signal;
    const onProgress = (p: DownloadProgress) => run.report({ label: partLabel(id), loaded: p.loaded, total: p.total, unit: 'bytes' });
    try {
      if (id === 'app' && precache) await downloadApp(precache, { signal, onProgress });
      else if (id === 'docs' && infoManifest) await downloadDocs(infoManifest, { signal, onProgress });
      else if (id === 'verify' && precache) await downloadVerify(precache, { signal, onProgress });
      else if (id === 'speech' && precache) await downloadSpeech(precache, { signal, onProgress });
      else if (id === 'reword' && precache) await downloadReword(precache, { signal, onProgress });
      else if (id === 'ask' && precache) await downloadAsk(precache, { signal, onProgress });
      else if (id === 'ai-detect' && precache) await downloadAiDetect(precache, { signal, onProgress });
      else if (id === 'upscale') await downloadUpscale({ signal, onProgress });
      else if (id === 'matte') await downloadMatte({ signal, onProgress });
      else if (id === 'ocr') await downloadOcr({ signal, onProgress });
      else if (id === 'durable') await downloadDurable({ signal, onProgress });
      else if (id === 'catalog') {
        const res = await downloadCatalogScope(syncHost, scope, { signal, onProgress });
        await recordCatalogDownload(scope, res.bytes, res.files);
        catalogScopeDirty = false;
      } else return false;
      partState = await partRecords();
      syncPartRow(id);
      await pv.storage.refreshCounter();
      return true;
    } catch (err) {
      if (signal.aborted) throw err;
      host.log('warn', 'Offline part download failed', { part: id, error: String(err) });
      return false;
    }
  };

  /** Preflight + sequential run of several parts behind one progress bar.
   *  Resolves true only when the run actually completed (with or without
   *  per-part failures) - false on re-entry, decline, or cancel, so a caller
   *  chaining more work (the Everything sweep) knows not to continue.
   *
   *  `outer` lets the Everything sweep run its parts phase and its tools
   *  phase inside ONE job: when it is passed, this function neither starts
   *  nor ends the run, and leaves the completion announcement to the caller. */
  const runParts = async (ids: OfflinePartId[], outer?: OfflineRunHandle): Promise<boolean> => {
    if (running || (!outer && offlineRunActive())) return false;
    running = true;   // synchronous - closes the double-click window the two awaits below open
    try {
      const want = ids.filter(id => partAvailable[id] && aiOfflinePartAllowed(id) && (!partState[id] || isStale(id)));
      if (!want.length) return true; // nothing to do IS a completed run
      const scope = catalogScope();
      const totalPlanned = want.reduce((n, id) => n + planned(id), 0);
      const room = await storageHeadroom(totalPlanned);
      if (!room.fits) {
        const sure = await confirmDialog({
          title: t('This might not fit'),
          message: room.free === null
            ? t('The browser could not say how much space is free. Download anyway?')
            : t('About {size} to download, but only around {free} of storage looks free. You can narrow the catalogue by tag, or try anyway.', { size: fmtBytes(totalPlanned), free: fmtBytes(room.free) }),
          confirmLabel: t('Download anyway'),
        });
        if (!sure) return false;
      }
      // One part gets that part's name in the toast; several share the section's.
      const run = outer ?? beginOfflineRun(want.length === 1
        ? tRaw('Downloading {name}', { name: partLabel(want[0]!) })
        : t('Downloading for offline'));
      if (!run) return false;   // another view's run is already in flight
      setBusy(true);
      let failed = 0;
      let cancelled = false;
      try {
        for (const id of want) {
          if (!await runPart(id, run, scope)) failed++;
        }
      } catch {
        cancelled = true;
      } finally {
        // The run ends here, not at view teardown. end() settles the job the
        // toast is showing and releases the module-level slot; a cancelled
        // job is already terminal, so this is a no-op for it.
        if (!outer) run.end(failed ? t('{n} downloads failed - check your connection', { n: failed }) : undefined);
        setBusy(false);
      }
      if (cancelled) {
        // Cancelled - everything already fetched stays cached, so the next
        // run resumes from here. Say so instead of reading as an error.
        announce(t('Download paused - already-saved files are kept'));
        return false;
      }
      if (failed === 0) playSfx('victory');
      if (!outer) {
        announce(failed
          ? t('{n} downloads failed - check your connection', { n: failed })
          : want.length === 1
            ? tRaw('{name} is available offline', { name: partLabel(want[0]!) })
            : t('Offline download complete'), { assertive: failed > 0 });
      }
      // Downloads may deserve eviction protection now that they hold real bytes.
      await syncPersistLine();
      return failed === 0;
    } finally {
      running = false;
    }
  };

  body.querySelector('.odl-parts')?.addEventListener('click', async e => {
    const dl = (e.target as HTMLElement).closest<HTMLElement>('[data-part-dl]');
    if (dl) { await runParts([dl.dataset.partDl as OfflinePartId]); return; }
    const rm = (e.target as HTMLElement).closest<HTMLElement>('[data-part-rm]');
    // offlineRunActive() covers a run started by an earlier mount of this view.
    if (!rm || running || offlineRunActive()) return;
    const id = rm.dataset.partRm as OfflinePartId;
    const sure = await confirmDialog({
      title: t('Remove this offline download?'),
      message: tRaw('{name} is removed from this device. You can download it again any time you are online.', { name: partLabel(id) }),
      confirmLabel: t('Remove'),
      danger: true,
    });
    if (!sure) return;
    await removePart(id);
    partState = await partRecords();
    syncPartRow(id);
    syncSweepSize();
    announce(t('Offline download removed'));
    await pv.storage.refreshCounter();
  });

  // Tag chips re-price the catalogue row live (asset-accurate, not tag sums).
  // Scope drift is tracked on a FLAG, never by deleting the record from the
  // display state - any partRecords() refresh would silently resurrect a
  // deleted entry and the row would lie about being current.
  const normScope = (s: 'all' | string[] | readonly string[] | undefined): string => JSON.stringify(s === undefined ? 'all' : Array.isArray(s) ? [...s].sort() : s);
  body.querySelector('.odl-tagscope')?.addEventListener('change', async () => {
    const scope = catalogScope();
    const size = await catalogScopeSize(scope);
    if (size) catalogPlanned = size.bytes;
    catalogScopeDirty = !!partState.catalog && normScope(partState.catalog.tags) !== normScope(scope);
    syncSweepSize();
  });

  // Re-price the sweep when the models opt-in flips (also toggles the button label so the
  // action reads honestly - "everything" only means the models when the box is ticked).
  body.querySelector<HTMLInputElement>('#odl-incl-models')?.addEventListener('change', () => {
    everythingBtn.textContent = inclModels() ? t('Download everything, models included') : t('Download everything');
    syncSweepSize();
  });

  everythingBtn.addEventListener('click', async () => {
    if (running || offlineRunActive()) return;
    // Held disabled across BOTH phases - parts and the tools sweep - so a
    // second click can't slip in during the sweep and re-announce success.
    everythingBtn.disabled = true;
    // ONE job covers both phases, so the toast tells a single story and the
    // whole thing stays cancellable from anywhere in the app.
    const run = beginOfflineRun(t('Downloading everything for offline'));
    if (!run) { everythingBtn.disabled = false; return; }
    try {
      // The models fold into the sweep only when the opt-in box is ticked (their size is
      // stated on that row). A declined headroom warning or a mid-run Cancel resolves false:
      // the tools sweep must NOT start after the user said stop.
      const sweepIds: OfflinePartId[] = ['app', 'catalog', 'docs', ...(inclModels() ? availableModelParts() : [])];
      if (!await runParts(sweepIds, run)) return;
      setBusy(true);   // the parts phase released it; the tools phase owns it now
      const failed = await sweepTools({ fanfare: false, run });
      announce(failed
        ? t('{n} downloads failed - check your connection', { n: failed })
        : run.cancelled
          ? t('Download paused - already-saved files are kept')
          : t('Everything you picked is saved for offline'), { assertive: failed > 0 });
    } finally {
      run.end();
      setBusy(false);
      everythingBtn.disabled = false;
      syncSweepSize();
    }
  });
  // Cancel routes through the job registry (not a bare controller.abort) so the
  // toast, the registry and the fetches all agree the run stopped.
  cancelBtn.addEventListener('click', () => cancelOfflineRun());

  // Eviction protection: say where downloads stand, and offer the fix - a
  // re-request from a click is exactly when browsers grant it.
  const persistEl = body.querySelector<HTMLElement>('#odl-persist')!;
  const syncPersistLine = async (state?: 'granted' | 'denied' | 'unsupported'): Promise<void> => {
    const s = state ?? await persistenceState();
    if (s === 'unsupported') { persistEl.hidden = true; return; }
    persistEl.hidden = false;
    persistEl.innerHTML = s === 'granted'
      ? escapeText(t('Protected: the browser won’t clear these downloads to free up space.'))
      : `${escapeText(t('The browser may clear downloads if the device runs low on space.'))} <button type="button" class="btn" id="odl-protect">${t('Protect downloads')}</button>`;
    persistEl.querySelector('#odl-protect')?.addEventListener('click', async () => {
      const granted = await persistenceState(true);
      await syncPersistLine(granted);
      announce(granted === 'granted' ? t('Downloads protected') : t('The browser declined - downloads stay best-effort'));
    });
  };
  void syncPersistLine(persist);
  // Restore the recorded catalogue scope into the chips, so the row reads
  // consistently on re-open (unchecked chips = 'all', which would otherwise
  // disagree with a tag-scoped record and misprice the sweep).
  const recordedTags = partState.catalog?.tags;
  if (Array.isArray(recordedTags) && recordedTags.length) {
    for (const c of body.querySelectorAll<HTMLInputElement>('.odl-tagchip input')) {
      c.checked = recordedTags.includes(c.value);
    }
    void catalogScopeSize(recordedTags).then(size => {
      if (size) { catalogPlanned = size.bytes; syncSweepSize(); }
    });
  }
  syncSweepSize();

  // ── The run outlives this view (lib/offline-run.ts) ─────────────────────
  // The bar is driven by the run's fan-out, so it keeps painting for as long
  // as THIS view lives and picks up a run that started in a previous mount.
  // Fires on change only (the lib/jobs.ts subscribe contract), so the current
  // line is read once below. _cleanup unsubscribes; it never aborts.
  pv.aiPolicyUnsub = aiPolicy.subscribe(syncSweepSize);
  pv.offlineRunUnsub = subscribeOfflineRun({
    onProgress: line => showProgress(line),
    onEnd: () => { void (async () => {
      // The run may have finished parts this view never watched start.
      partState = await partRecords().catch(() => partState);
      setBusy(false);
      await pv.storage.refreshCounter();
    })(); },
  });
  // Re-entering /profile mid-run: read as busy rather than offer a second
  // sweep over the same buckets. Must come after the syncSweepSize() above,
  // which restores per-row enablement from storage state.
  if (offlineRunActive()) {
    setBusy(true);
    const line = offlineRunLine();
    if (line) showProgress(line);
  }
}
/** Load the offline manager when its card is first expanded. */
export function wireOfflineToggle(pv: ProfileViewCtx): void {
  const { offlineDetails } = pv;
  offlineDetails?.addEventListener('toggle', () => { if (offlineDetails!.open) pv.offline.loadOffline(); });
  if (offlineDetails?.open) pv.offline.loadOffline();
}

export function offlineOps(pv: ProfileViewCtx) {
  return {
    loadOffline: bindOp(pv, loadOffline),
    wireOfflineToggle: bindOp(pv, wireOfflineToggle),
  };
}
