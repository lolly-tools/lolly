// SPDX-License-Identifier: MPL-2.0
/**
 * Tool view - mounts one tool.
 *
 * Lifecycle:
 *   1. loadTool() fetches manifest + template + hooks from the catalog
 *   2. createRuntime() spins up the engine with the host bridge
 *   3. We render input controls from runtime.getModel() and the template
 *      output from runtime.getHydrated()
 *   4. Input changes → runtime.setInput() → subscribed callback re-renders
 *   5. Action buttons call runtime.export() / host.clipboard / host.state
 */

// View-scoped stylesheets - Vite emits these as async CSS chunks loaded WITH this
// lazy view, instead of render-blocking the gallery/catalog landing (see app.css).
import '../styles/parts/tool.css';
import '../styles/parts/editor.css';
import '../styles/parts/design-topbar.css';
import '../styles/parts/design-navigator.css';
import '../styles/parts/design-inspector.css';
import '../styles/parts/design-guides.css';
import '../styles/parts/document.css';
import '../styles/parts/deck-editor.css';
import '../styles/parts/tool-chrome.css';
import '../styles/vendor-flatpickr.css';
import { presentApis } from '@lolly-tools/core/host-v1';
import { loadTool } from '@lolly/engine';
import { consumeTeamSessionOrigin, releaseTeamSessionOrigin } from '../org/team-session-origin.ts';
import { MountLifecycle } from '../lib/mount-lifecycle.ts';
import { getToolIntegrity } from '../catalog/integrity.ts';
import { installedFetchFile, isToolInstalled } from '../lib/installed-tools.ts';
import { makeFetchFile } from '../bridge/tool-loader.ts';
import type { designOutcome } from './design-workspace.ts';
import { escape } from '../utils.ts';
import { capabilityLabel, toolSupport } from '../capabilities.ts';
import { currentLang, docsAppHref, t, tRaw } from '../i18n.ts';
import { loadExportPrefs } from '../lib/export-prefs.ts';
import { createShutter } from '../lib/shutter.ts';
import { exportSizeDriver } from './export-size.ts';
import { exportFormatDriver } from './export-format.ts';
import type { historyParticipation } from './tool-revision-history.ts';
import type { ToolManifest } from '../../../../engine/src/loader.js';
import type { BarSeq, ExportExperience, ViewEl, WebToolHost } from './tool/shared.ts';
import type { ToolViewCtx } from './tool/context.ts';
import { historyOps } from './tool/history.ts';
import { designSystemOps } from './tool/design-system.ts';
import { stageLayoutOps } from './tool/stage-layout.ts';
import { exportingOps } from './tool/exporting.ts';
import { sessionOps } from './tool/session.ts';
import { popoversOps } from './tool/popovers.ts';
import { renderOps } from './tool/render.ts';
import { setupOps } from './tool/setup.ts';
export type { IdentityStatus, EmbedDescribe, WebToolHost, ToolRuntime, PanelEl, PrintMarks, ExportDefaults, ActionsApi, ExportExperience, RunExportOpts } from './tool/shared.ts';


// The Design editor's three chrome columns (plan 179 M1-M3). Their modules import no CSS
// of their own - so they stay mountable in a node test - and ride this lazy tool chunk.


// The one declaration of the export bar's audio selection shape (mix-in bed
// incl.) - see bridge/audio-envelope.ts; ExportOpts references it too.


// The acquisition seam only (plan 100 section 5) - a registry with no runtime imports of
// its own. The presence stack it gates (session, pill, rings, cursors) is reached
// through one `import()` inside the guarded block below, so a build that ships no
// transport never fetches that chunk: a collab is lazy chrome that must cost a
// single-player build nothing (collab-pill.ts's own rule; the neuro-dock/
// music-player pattern).

// The three one-shot hand-offs a live collab arms BEFORE this view is entered
// (lib/collab-live-mount.ts, plan 100 section 6.2a/section 11.17). Statically imported, and that
// costs a single-player build NOTHING extra: `main.ts` already imports this module on
// the boot path for `installLiveCollabMount()`, so it is in the entry chunk either way
// - unlike the presence composition, which stays behind the guard's `import()`. All
// three are inert (a comparison and a null) for every mount that is not a collab.

// The fourth such hand-off, and the smallest: which TEAM session this mount was opened
// from, when it was opened from one (org/team-session-origin.ts, plans/100 section 7). A leaf
// with no imports of its own - module state, no network, no DOM - so a build with no
// control plane pays two function calls and nothing else.


// Above AUTO_PACK_MIN the address bar and Share dialog switch to the packed `z=` form
// (when shorter); the cost model owns that threshold so nothing drifts from syncUrl.


 // flatpickr base CSS in the `vendor` cascade layer (see that file)

// Type-only imports (erased at build). The `@lolly/engine` barrel re-exports
// values but not these type-only names, so they come straight from the engine
// internals - resolved by the bundler through the `.js` specifier convention.


// The input + actions subsystems live in sibling modules (verbatim split of this
// file). They only `import type` back from here, so these value imports don't cycle.


export type { ExportUnscaled } from './tool-action-helpers.ts';
/** A flatpickr-enhanced input carries its instance for teardown. */
export interface FlatpickrHost extends HTMLInputElement {
  _flatpickr?: { destroy(): void; altInput?: HTMLInputElement };
}

/** Session-only metadata that belongs beside `__export_*`, never in tool inputs. */
export interface ActionsExperience extends Partial<ReturnType<typeof historyParticipation>> {
  current?: () => ExportExperience;
  sessionMeta?: () => Record<string, unknown>;
  /** This mount provides the portable .lolly vehicle and inline Share controls. */
  portable?: boolean;
  historyBase?: import('../bridge/revision-records.ts').RevisionCursor;
}

export async function mountTool(
  viewEl: ViewEl,
  host: WebToolHost,
  toolId: string,
  urlParams: string | null | undefined
): Promise<void> {
  const tview = {} as ToolViewCtx;
  tview.history = historyOps(tview);
  tview.designSystem = designSystemOps(tview);
  tview.stageLayout = stageLayoutOps(tview);
  tview.exporting = exportingOps(tview);
  tview.session = sessionOps(tview);
  tview.popovers = popoversOps(tview);
  tview.render = renderOps(tview);
  tview.setup = setupOps(tview);
  tview.viewEl = viewEl;
  tview.host = host;
  tview.toolId = toolId;
  tview.urlParams = urlParams;

  // FIRST, and before any early return: the Team-projects open stashed the instance's id
  // for the session it is navigating into, and that stash is bounded by "the next mount
  // spends it" - so a mount that 404s or fails to load must spend it too, or an unrelated
  // later mount of the same tool would inherit it. Returns the origin, but the module
  // holds it for this mount (released in _cleanup), so nothing is threaded through the
  // view. Null for every mount that is not a team-session open, which is nearly all.
  //
  // SPENDING IS NOT THE WHOLE JOB, and this is the half that is easy to lose: a matching
  // consume also PROMOTES the origin to the module's live slot, and the only release is
  // in `_cleanup` - which is not assigned until ~1500 lines below, once the mount is
  // fully built. Every abandoned mount between here and there (a 404, an offline load, a
  // validation failure, a capability this shell cannot fulfil) therefore used to leave an
  // origin live with nothing to release it: `navigate()` calls `view._cleanup?.()` and
  // this view had given it none, so the id survived until some later mount of a DIFFERENT
  // tool cleared it - and in the meantime the Share dialog over an unrelated LOCAL session
  // of the SAME tool read it and keyed a work collab on a stranger's session. That is
  // exactly the "present and wrong" id `org/team-session-origin.ts` exists to prevent
  // (its rule 3), so each of those paths releases before it returns, and
  // `views/tool-team-origin.test.ts` fails if a new one forgets to.
  consumeTeamSessionOrigin(toolId);
  const mountLifecycle = new MountLifecycle({
    onDisposeError: (name, error) => console.error(`[tool] ${name} teardown:`, error),
  }); tview.mountLifecycle = mountLifecycle;

  // A sideloaded tool (installed from a .lolly) lives in a device-local bucket, not the
  // catalog. When one is installed it loads from that bucket with NO signed-catalog
  // integrity check - the recipient's catalog has no authority over it, and its bytes
  // were verified at import (lib/installed-tools.ts). Resolved before the existence check
  // so a deep link to an installed tool is never 404'd for being absent from the catalog.
  const installed = await isToolInstalled(toolId).catch(() => false); tview.installed = installed;

  // If the catalog is loaded, do a fast existence check before fetching anything.
  const catalog = (window as Window & { __toolIndex?: { tools?: { id: string }[] } }).__toolIndex; tview.catalog = catalog as ToolViewCtx['catalog'];
  if (!installed && catalog?.tools && !catalog.tools.some((t) => t.id === toolId)) {
    mount404(viewEl, toolId);
    releaseTeamSessionOrigin();
    return;
  }

  const fetchFile = installed ? installedFetchFile(toolId) : makeFetchFile(toolId); tview.fetchFile = fetchFile;

  // Defer the loading screen so prefetched tools don't flash the gallery out.
  // The gallery stays visible until the tool is ready (or 400ms passes).
  const loadingTimer = setTimeout(() => {
    viewEl.innerHTML = `<p class="loading">${t('Loading…')}</p>`;
  }, 400); tview.loadingTimer = loadingTimer;

  // tview.tool: assigned later
  try {
    // The loader takes a plain fetchFile with no abort handle, so a hung request
    // would leave an infinite "Loading…". Guard the whole load with a timeout that
    // rejects with a network-shaped error, so it flows through the SAME offline /
    // recoverable branch below (the Retry + "Browse all tools" card) as any other
    // fetch failure - no separate error path.
    const LOAD_TIMEOUT_MS = 15000;
    let loadTimer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      loadTimer = setTimeout(
        () => reject(new Error('Failed to fetch tool - network timeout')),
        LOAD_TIMEOUT_MS
      );
    });
    try {
      tview.tool = await Promise.race([
        loadTool(toolId, fetchFile, {
          lang: currentLang(),
          integrity: installed ? undefined : ((await getToolIntegrity()) ?? undefined),
          trustClass: installed ? 'sideloaded-consented' : undefined,
        }),
        timeout,
      ]);
    } finally {
      clearTimeout(loadTimer);
    }
    clearTimeout(loadingTimer);
  } catch (e) {
    clearTimeout(loadingTimer);
    const err = e as { message?: string; validationErrors?: { path: string; message: string }[] };
    if (err.message === 'tool-not-found') {
      mount404(viewEl, toolId);
      releaseTeamSessionOrigin();
      return;
    }
    const errs = err.validationErrors?.length
      ? `<ul class="error-list">${err.validationErrors
          .map((ve) => `<li><code>${escape(ve.path)}</code> - ${escape(ve.message)}</li>`)
          .join('')}</ul>`
      : '';
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    if (
      !err.validationErrors?.length &&
      (offline || /fetch|network|load|failed to fetch/i.test(String(err.message || '')))
    ) {
      // Offline-first PWA: a network load failure should be recoverable, not a raw dead-end.
      viewEl.innerHTML =
        `<div class="error"><strong>${offline ? t('You’re offline') : t('Couldn’t load this tool')}</strong>` +
        `<p>${offline ? t('Reconnect, then try again.') : t('Check your connection, then retry.')}</p>` +
        `<div class="error-actions" style="margin-top:12px;display:flex;gap:8px;justify-content:center">` +
        `<button class="btn" data-retry>${t('Retry')}</button><a class="btn" href="/#/">${t('Browse all tools')}</a></div></div>`;
      viewEl.querySelector('[data-retry]')?.addEventListener('click', () => location.reload());
      releaseTeamSessionOrigin();
      return;
    }
    viewEl.innerHTML = `<div class="error"><strong>${escape(err.message)}</strong>${errs}</div>`;
    releaseTeamSessionOrigin();
    return;
  }

  // Guard direct links: if the tool needs a capability this shell can't fulfil,
  // show the right panel instead of mounting it into a broken state - on a
  // Chromium browser a capture tool offers the extension ('install'); otherwise
  // "desktop only" ('unavailable').
  const sup = toolSupport(tview.tool.manifest, tview.host.capabilities, presentApis(tview.host)); tview.sup = sup;
  // A capture tool on a Chromium browser without the extension: MOUNT it anyway.
  // url-shot's visual composer + recipe output need no capture - only EXPORT does -
  // so a full-screen gate would hide a core authoring surface. Mount the tool and
  // steer to the extension/desktop for the actual capture with a dismissible banner
  // (below). A genuinely unavailable capability (non-Chromium, or a non-capture
  // need) still can't run here at all.
  const captureHint = sup.status === 'install'; tview.captureHint = captureHint;
  // `mountUnavailable` renders a card and installs no `_cleanup`, so the origin is let go
  // here rather than at a teardown that will never run (see the consume above). This is
  // the reachable case, not a theoretical one: a team session of a `capture` tool opened
  // on Safari or Firefox lands exactly here, and `openTeamSession` arms the stash without
  // consulting capabilities.
  if (sup.status === 'unavailable') {
    mountUnavailable(viewEl, tview.tool.manifest, sup.unmet);
    releaseTeamSessionOrigin();
    return;
  }

  await tview.setup.guardNetworkAndSeed();
  tview.refreshDesignExperience = (_pickDefault = false): void => {
    /* armed after the export panel mounts */
  };
  tview.syncDesignIntentChrome = (): void => {
    /* armed with the Design top bar */
  };
  tview.applyDesignIntentLayout = (_outcome: ReturnType<typeof designOutcome>): void => {
    /* armed with editor chrome */
  };

  await tview.setup.seedDirect();
  tview.poseTemplate = (): void => {};

  await tview.setup.templatePick();

  tview.setup.documentSurface();
  tview.revisionChanged = (): void => {};
  tview.applyingHistory = false;
  tview.historyControls = null; // ↶/↷ buttons - header pair, or the editor's toolbar pair (set on mount)
  tview.historyToastEl = null;
  // tview.historyToastTimer: assigned later
  const baseSetInput = tview.runtime.setInput.bind(tview.runtime); tview.baseSetInput = baseSetInput;
  // Expose the UNWRAPPED setter on the runtime so other scopes (notably renderActions'
  // programmatic width/height px-sync) can set inputs without the change landing in the
  // undo history. baseSetInput itself is local to mountTool; this is the shared handle.
  tview.runtime.setInputNoHistory = baseSetInput;

  tview.setup.wrapSetInput();

  tview.setup.stableRowIds();

  tview.history.wireHistory();

  await tview.stageLayout.wireSidebar();

  tview.stageLayout.wireFilmstrip();
  window.addEventListener('lolly:design-system-changed', tview.designSystem.onDesignSystemChanged);

  // Export shutter: a canvas camera-iris that closes over the whole stage so the
  // brief full-res resize during export (the "shake") is never seen, then opens.
  // The mechanism, tuning and frame budget live in lib/shutter.ts.
  const shutter = createShutter(tview.stageEl); tview.shutter = shutter;

  tview.setup.wireActionsPanel();

  // Canonical address-bar URL for this open tool: the path form /t/<id> (so a copied
  // link carries the per-tool OG preview - see scripts/build-tool-og.ts). All in-tool
  // URL writers (syncUrl, updateFullParam) build on this; the bar is rewritten from
  // the boot-time #/tool/<id> hash to this on the first syncUrl.
  // The Design tool owns the bare vanity path `/design` (main.ts parseRoute returns it as
  // a first-class route); keep the bar there instead of rewriting it to /t/design.
  const TOOL_URL_BASE = toolId === 'design' ? '/design' : `/t/${toolId}`; tview.TOOL_URL_BASE = TOOL_URL_BASE;

  tview.stageLayout.wireStageZoom();
  // (Re)size #tool-canvas to the current page strip and re-fit. Only fires when the
  // strip dimensions actually change (page count / size), so an ordinary box edit
  // never resets the view.
  tview.prevStripKey = '';
  if (tview.pagesMode) tview.stageLayout.syncStrip();

  await tview.stageLayout.wireCanvas();

  // ── Wire up ───────────────────────────────────────────────────────────────

  // A size-style select (its options carry width/height) sets the export size, so
  // the chosen badge/page size actually prints at that size. Seed the export-bar
  // defaults from the initially-selected option (URL / saved state still win).
  const sizeDriver = exportSizeDriver(tview.tool.manifest); tview.sizeDriver = sizeDriver;
  const sizeDims = sizeDriver
    ? sizeDriver.dims[String(tview.runtime.getModel().find((i) => i.id === sizeDriver.id)?.value)]
    : null; tview.sizeDims = sizeDims;
  // A mode-style select (its options carry `formats`) narrows the export format bar
  // to the selected option's formats - a vector effect offers svg/pdf/emf, a raster
  // one only png/jpg - while render.formats stays the union. Applied on mount and on
  // every change of the driving input, below (mirrors sizeDriver).
  const formatDriver = exportFormatDriver(tview.tool.manifest); tview.formatDriver = formatDriver;
  // tview.lastFmtDriveVal: assigned later

  // L3 (plans/163) - the format and size of the last successful download of THIS tool,
  // if there was one. Read here, at the same point in the mount as the saved session, so
  // the panel is built once with the final values. It fills only what nothing else
  // supplied: everything explicit is already in the literal below, and mergeExportPrefs
  // never overwrites it (see lib/export-prefs.ts for the precedence rule).
  const rememberedExport = await loadExportPrefs(tview.host, toolId).catch(() => null); tview.rememberedExport = rememberedExport;

  tview.exporting.resolveExportFormat();
  // Seed from the params this mount was routed with (form-agnostic - works whether the
  // bar arrived as /t/<id>?… or #/tool/<id>?…) so shared/bookmarked links survive the
  // first subscribe callback.
  const dirtyParams = new Set(new URLSearchParams(tview.urlParams || '').keys()); tview.dirtyParams = dirtyParams;
  // Monotonic guard shared by every address-bar writer (syncUrl AND shrinkUrl). It's
  // bumped on EVERY bar write, so any later write invalidates an in-flight async pack
  // - a stale pack from an earlier (larger) state can never clobber a newer bar. A
  // holder object (not a bare `let`) so the module-level shrinkUrl can share it.
  const barSeq: BarSeq = { v: 0 }; tview.barSeq = barSeq;

  tview.setup.mountActions();

  tview.setup.wireBulkRows();

  await tview.session.wireLiveEditing();

  tview.setup.wireBackPill();

  tview.stageLayout.wireCanvasEditor();

  tview.render.wirePreview();

  tview.render.wireRenderLoop();

  await tview.setup.mountLiveControls();
}

// makeFetchFile is imported from bridge/tool-loader.ts - the one shared implementation
// (embed, off-screen render and this view). A local copy used to live here and drifted:
// it kept the Content-Type-header SPA-shell check after the shared one moved to content
// classification, so chart/timezone still would not open in the iOS app (2026-09-09).

function mount404(viewEl: HTMLElement, toolId: string): void {
  document.title = t('Not Found - Lolly');
  viewEl.innerHTML = `
    <div class="not-found">
      <div class="not-found-inner">
        <p class="not-found-code">404</p>
        <h1 class="not-found-title">${t('Tool not found')}</h1>
        <p class="not-found-desc">${t("There's no tool at <code>{id}</code>.", { id: toolId })}</p>
        <a href="/" class="not-found-home">${t('Browse all tools')}</a>
      </div>
    </div>
  `;
}

// Shown when a tool is opened in a shell that can't fulfil its capabilities
// (e.g. a 'capture' tool in the web PWA). Mirrors the 404 layout.
function mountUnavailable(
  viewEl: HTMLElement,
  manifest: ToolManifest,
  unmet: readonly string[]
): void {
  document.title = tRaw('{name} - Desktop only', { name: manifest.name });
  const why = unmet.map(capabilityLabel).join(', ');
  viewEl.innerHTML = `
    <div class="not-found">
      <div class="not-found-inner">
        <p class="not-found-code">${t('Desktop')}</p>
        <h1 class="not-found-title">${t('{name} needs the desktop app', { name: manifest.name })}</h1>
        <p class="not-found-desc">${t('This tool uses <strong>{why}</strong>, which the web app can’t provide - a browser can’t screenshot cross-origin pages. Open it in the Lolly desktop app.', { why })}</p>
        <a href="/" class="not-found-home">${t('Browse all tools')}</a>
      </div>
    </div>
  `;
}

// Shown on a Chromium browser for a capture tool when the extension isn't
// installed - the tool CAN run here once the free extension is added.
function _mountInstallPrompt(viewEl: HTMLElement, manifest: ToolManifest): void {
  document.title = tRaw('{name} - Add the extension', { name: manifest.name });
  viewEl.innerHTML = `
    <div class="not-found">
      <div class="not-found-inner">
        <p class="not-found-code">${t('Add&#8209;on')}</p>
        <h1 class="not-found-title">${t('Enable {name} in your browser', { name: manifest.name })}</h1>
        <p class="not-found-desc">${t('Add the free Lolly screenshot extension and this tool captures pages right here - no desktop app needed. Install it, then reload this page.')}</p>
        ${/* nosemgrep: lolly-href-escape-is-not-scheme-validation - docsAppHref() over a build-time slug constant, always '#/docs/…' */ ''}
        <a href="${escape(docsAppHref('create/extension'))}" class="not-found-home" target="_blank" rel="noopener">${t('Get the extension')}</a>
        <a href="/#/" class="not-found-back">${t('Back to all tools')}</a>
      </div>
    </div>
  `;
}
