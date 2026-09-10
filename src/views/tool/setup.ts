// SPDX-License-Identifier: MPL-2.0
/**
 * tool view: mount-time setup blocks (session origin, seeding, templates, row ids, sidebar, chrome, canvas observers, live controls).
 *
 * Every function takes the shared `tview: ToolViewCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `tview.<module>.<fn>`. Extracted verbatim
 * from mountTool() by scripts/split-closure.ts.
 */
import { annotateTemplate, diffDocuments, expandQuery, hasEncryptedState, inspectDocument, measureDocument, parseUrlState } from '@lolly/engine';
import type { Profile } from '@lolly-tools/core/host-v1';
import type { InputValue } from '../../../../../engine/src/inputs.js';
import { createInteractiveToolRuntime as createRuntime } from '../../lib/mount-runtime.ts';
import { attachCollabPlumbing } from '../../lib/collab-plumbing.ts';
import { getCollabSessionSource } from '../../lib/collab-session-source.ts';
import { takeCarriedMountState, takeEphemeralState } from '../../lib/collab-live-mount.ts';
import { migrateBlockRowIds } from '../../lib/row-id.ts';
import { installDocumentSurface } from '../../lib/document-surface.ts';
import { prepareToolDesignSystemContext } from '../tool-design-system-context.ts';
import { fpsTick, startFrameFps, stopFrameFps } from '../../lib/frame-fps.ts';
import { takeAutomationExportPassword } from '../../lib/automation-export-secret.ts';
import { inferDesignIntent } from '../design-workspace.ts';
import { createHistory } from '../tool-history.ts';
import { mountBackPill } from '../../components/back-pill.ts';
import { autoOpenToolGuide, showToolGuide } from '../../components/tool-guide.ts';
import { collectBulkFiles } from '../../lib/bulk-files.ts';
import { t, tRaw } from '../../i18n.ts';
import { announce } from '../../a11y.ts';
import { setupRecordControl } from '../record-control.ts';
import { setSwatches } from '../../components/color-field.ts';
import { playSfx } from '../../lib/sfx.ts';
import { createNetAPI } from '../../bridge/net.ts';
import { defaultHiddenTemplateRefs } from '../../catalog/sync.ts';
import { loadTemplateStart, START_BLANK } from '../../lib/template-start.ts';
import { BROWSER_TARGET, costUrlState } from '../../lib/url-budget.ts';
import { createUrlGauge } from '../../lib/url-budget-gauge.ts';
import { prefersReducedMotion } from '../../lib/a11y-prefs.ts';
import { makeLollyVehicle } from '../tool-lolly-vehicle.ts';
import { historyParticipation, localHistorySlot, mountCollabActionHistory, trackRevisionInput, wireToolRevisionHistory } from '../tool-revision-history.ts';
import { asRow } from '../tool-types.ts';
import { openToolSession } from '../tool-session-open.ts';
import { _sliderDragging, fileToRef, fmtBytes, makeBlocksDropper, syncInputs } from '../tool-inputs.ts';
import { createLiveControls, mountSidebarLiveControls, registerLiveControls } from '../live-controls.ts';
import { mountCaptureSignin } from '../capture-signin.ts';
import { captureThumbnail, renderActions } from '../tool-actions.ts';
import { setupCanvasBlocksDrop, setupCanvasFileDrop } from '../tool-canvas-drop.ts';
import { collectExportParams, decryptEncryptedLink, showShareDialog } from './shared.ts';
import type { PanelEl, ToolRuntime } from './shared.ts';
import { bindOp, type ToolViewCtx } from './context.ts';

/** Network allowlist notice, initial values and the first render pass. */
export async function guardNetworkAndSeed(tview: ToolViewCtx): Promise<void> {
  const { toolId, viewEl } = tview;
  // A manifest `network.allowlist` gives THIS mount a host clone whose `net`
  // enforces exactly that list - the boot-time shared host keeps its fail-closed
  // empty allowlist and is never mutated (bridge methods are closures, not
  // `this`-bound, so a shallow spread is safe). Everything below - runtime,
  // hooks, actions - uses the clone; tools without the field see no change.
  if (tview.tool.manifest.network?.allowlist?.length) {
    tview.host = { ...tview.host, net: createNetAPI({ allowlist: tview.tool.manifest.network.allowlist }) };
  }

  // section 6.2a/section 11.17: an ACCEPTOR's working copy must never reach a slot on their device.
  // The ruling was one interception point rather than an audit of every save call site,
  // and this is it - a memory-backed `host.state`, armed by the mount before the route
  // was entered. The clone rides the SAME rule as the allowlist clone above (bridge
  // methods are closures, not `this`-bound), and it must land HERE: before the `slot`
  // load, before `createRuntime`, and before the actions bar is built, so every save
  // path in this view and in the tool's own actions is looking at one object. One-shot
  // and null for every mount that is not an ephemeral collab, which is all of them
  // until somebody accepts an invite.
  const ephemeralState = takeEphemeralState(toolId); tview.ephemeralState = ephemeralState;
  // The bridge as it was BEFORE the swap, kept because exactly one thing still needs the
  // real store on an acceptor's mount: a beam they were asked about and accepted. section 11.17
  // is about their borrowed copy of the inviter's document; a gift is not that, and section 6.4
  // promises it ends up in their library. The same object for every other mount, so this
  // costs a reference. History's explicit Save a copy is the other deliberate
  // persistence boundary; automatic saves still go through the temporary host.
  const libraryHost = tview.host; tview.libraryHost = libraryHost;
  if (ephemeralState) tview.host = { ...tview.host, state: ephemeralState };

  // Source the colour picker's swatches from design tokens (the canonical brand
  // colours), so choosing one keeps the value linked to the token. Falls back to
  // the built-in palette if tokens aren't available (offline first load, or a
  // shell without host.tokens). Best-effort - never blocks mounting the tool.
  try {
    const swatches = await tview.host.tokens?.colors?.();
    if (swatches?.length) {
      setSwatches(
        swatches.map((s) => ({ value: s.value, label: s.name, group: s.group, ref: s.ref }))
      );
    }
  } catch {
    /* keep the built-in palette */
  }

  // Annotate the template once so rendered nodes carry data-canvas-input attrs
  // for click-to-focus. This is purely a shell-side concern; the engine just
  // stores the modified source and hydrates it like any other template.
  const inputIds = (tview.tool.manifest.inputs ?? []).map((i) => i.id); tview.inputIds = inputIds;
  tview.tool.template = annotateTemplate(tview.tool.template, inputIds);
  document.title = tRaw('{name} - Lolly', { name: tview.tool.manifest.name });

  // A password-gated link (`?zx=…`) carries the whole state ENCRYPTED. Prompt for
  // the password client-side (no server), decrypt to the readable query, and carry
  // on. Cancel or give up → leave it (zx is reserved, so parseUrlState ignores it
  // and the tool loads at defaults). Runs before expandQuery so the rest is unchanged.
  // If it decrypts, remember the ORIGINAL encrypted query so the address bar keeps
  // showing a protected link (see syncUrl) until the user edits - otherwise the first
  // auto-sync would rewrite the bar to the cleartext state, silently downgrading the
  // shared link to an unprotected one.
  tview.encLinkQuery = null;
  if (hasEncryptedState(tview.urlParams)) {
    const original = tview.urlParams!;
    tview.urlParams = await decryptEncryptedLink(tview.urlParams!);
    if (!hasEncryptedState(tview.urlParams)) tview.encLinkQuery = original;
  }

  // A packed link (`?z=…`) carries the whole state compressed; expand it back into a
  // plain query BEFORE anything reads it (parse, flag detection, dirty-param seed).
  // A no-op for ordinary readable links. Done once so every consumer below agrees.
  tview.urlParams = await expandQuery(tview.urlParams ?? '');

  const carriedMount = takeCarriedMountState(toolId); tview.carriedMount = carriedMount as ToolViewCtx['carriedMount'];
  const openedSession = await openToolSession(tview.host.state, toolId, parseUrlState(tview.urlParams, tview.tool.manifest), carriedMount?.slot); tview.openedSession = openedSession;
  const {
    values,
    format: urlFormat,
    export: autoExport,
    copy: autoCopy,
    slot: routeSlot,
    filename: urlFilename,
    width: urlWidth,
    height: urlHeight,
    unit: urlUnit,
    dpi: urlDpi,
    profile: urlProfile,
    password: urlPassword,
    bleed: urlBleed,
    marks: urlMarks,
    c2pa: urlC2pa,
    imprint: urlImprint,
    metadata: urlMetadata,
    durable: urlDurable,
    hdr: urlHdr,
    depth: urlDepth,
    video: urlVideo,
    designSystem: urlDesignSystem,
  } = openedSession.url;
  tview.values = values;
  tview.urlFormat = urlFormat;
  tview.autoExport = autoExport;
  tview.autoCopy = autoCopy;
  tview.routeSlot = routeSlot;
  tview.urlFilename = urlFilename;
  tview.urlWidth = urlWidth;
  tview.urlHeight = urlHeight;
  tview.urlUnit = urlUnit;
  tview.urlDpi = urlDpi;
  tview.urlProfile = urlProfile;
  tview.urlPassword = urlPassword;
  tview.urlBleed = urlBleed;
  tview.urlMarks = urlMarks;
  tview.urlC2pa = urlC2pa;
  tview.urlImprint = urlImprint;
  tview.urlMetadata = urlMetadata;
  tview.urlDurable = urlDurable;
  tview.urlHdr = urlHdr;
  tview.urlDepth = urlDepth;
  tview.urlVideo = urlVideo;
  tview.urlDesignSystem = urlDesignSystem;
  const automationPassword = await takeAutomationExportPassword(Boolean(autoExport), urlPassword); tview.automationPassword = automationPassword;
  // Starting a collab force-remounts this tool, and the route it remounts through is a
  // LOSSY encoder twice over: `buildShareParams` skips `user/` asset ids and anything
  // past 150 chars, `syncUrl` writes only dirty params, skips `file` inputs, and never
  // re-adds `slot`. So the outgoing mount hands its live model and its slot over in
  // memory (see this file's _cleanup, and lib/collab-live-mount.ts's header) and the
  // remount spends them here - an uploaded logo, a picked file and a long paragraph
  // survive because nothing was serialised. Null for every mount that is not that
  // remount. The values are applied below, ON TOP of the route: they are the same
  // model the route was encoded from, only complete.
  // The bar drops `slot` on the first edit, so the route alone would open the collab as
  // a FRESH session and the inviter's first Save would mint a duplicate beside the one
  // they were collaborating on (section 6.2a pins a private collab to the session it started
  // from). The route still wins when it names one.
  const slot = routeSlot ?? carriedMount?.slot ?? localHistorySlot(tview.host.state, toolId); tview.slot = slot;
  const urlFlags = new URLSearchParams(tview.urlParams || ''); tview.urlFlags = urlFlags;
  const isFull = urlFlags.has('full'); tview.isFull = isFull;
  // `?template=<id>` launches straight into a template starting point, SKIPPING the "New
  // from template" chooser - the on-ramp for a retired tool id or a deep link. Reserved
  // (so it's never a tool input and never counts toward the blank check below); the heavy
  // `values` seed is FETCHED in-process from the external file (tools/<id>/templates/
  // <id>.json), never packed into the URL. An unknown id is a null fetch → falls through
  // to the normal fresh-open flow (chooser or blank).
  const templateParam = urlFlags.get('template'); tview.templateParam = templateParam;
  // `?preset=<pid>` (plans/142): a curated values overlay INSIDE the named template
  // (`?template=poster&preset=story`). Only meaningful alongside `template`.
  const presetParam = urlFlags.get('preset'); tview.presetParam = presetParam;
  // Reached via a link when the boot URL carried ANY tool configuration - a share,
  // a bookmark, an `?options`/`?full` deep link. The cost panel keys its degrade on
  // this (money-policy `selectionFromUrl`): a link always opens on counts, and money
  // is revealed only by an explicit per-device action (section 5). A card is NEVER a URL
  // param, so this can never let a link ORIGINATE a money view - it can only withhold.
  const reachedViaLink = isFull || urlFlags.size > 0; tview.reachedViaLink = reachedViaLink;
  // `?nostage` pre-checks the export panel's "Full page" toggle (HTML export only):
  // the saved page drops the fixed-size canvas frame and fills the whole window.
  const urlNostage = urlFlags.has('nostage'); tview.urlNostage = urlNostage;
  // `?options` arrives the recipient on the export-settings panel expanded (instead
  // of the collapsed Render button). `full` collapses ALL chrome to the bare
  // preview - the opposite intent - so it wins when both are present, matching the
  // CSS, which hides the export panel whenever its host sidebar is collapsed.
  const showExportPanel = !isFull && urlFlags.has('options'); tview.showExportPanel = showExportPanel;
  // Presentation mode (plan 112): `?present` opens a frame document as a fullscreen,
  // click-advanced deck; `?s=` deep-links a slide (1-based position, frame id, or `h.f`);
  // `?kiosk` makes it signage. All three are engine-reserved (url-mode.ts RESERVED) -
  // `kiosk` was the unreserved `loop` flag until plan 171's freeze-day rename, because
  // `loop` is a live input id in other tools and could never be reserved.
  const isPresent = urlFlags.has('present'); tview.isPresent = isPresent;
  const presentAddress = urlFlags.get('s'); tview.presentAddress = presentAddress;
  // `let`, not const: the Design top bar's Loop row flips it and rewrites the URL, so the
  // flag the next openPresenter() reads is the one the author just chose (plan 179 M1).
  tview.presentLoop = urlFlags.has('kiosk');

  tview.initialValues = openedSession.values;
  // The carried model wins outright, and only here. It is not a competing source of
  // truth - it is the SAME model the route and the slot were both encoded from, one
  // step later and with nothing dropped, so anything it disagrees with is a value one
  // of the encoders could not represent. Applied before `createRuntime` so the runtime
  // is BORN with it: a patch after mount would render twice and run `onInit` against
  // the wrong model.
  if (carriedMount)
    tview.initialValues = { ...tview.initialValues, ...(carriedMount.values as Record<string, InputValue>) };

  // Design is one canvas with several likely outcomes. This small UI-only intent
  // selects chrome and export defaults; it never changes the engine render path.
  // In particular, the Poster template intentionally remains `general`: modern
  // posters are often digital, so no print semantics are inferred from that name.
  tview.designIntent = toolId === 'design'
      ? inferDesignIntent({
          saved: tview.initialValues.__workspace_intent,
          templateId: templateParam,
          boxes: tview.initialValues.boxes,
        })
      : 'general';
  if (toolId === 'design') viewEl.dataset.designIntent = tview.designIntent;
}

/** Direct seeding of inputs from the URL and the session. */
export async function seedDirect(tview: ToolViewCtx): Promise<void> {
  const { toolId } = tview;
  // A one-shot seed armed by the drop router's layered-import route (psd-import
  // stores the layer assets, then stashes the block rows + canvas size here).
  // Consumed generically - tool.ts knows nothing about PSD. URL/saved values
  // still win per key: the seed route always arrives on a bare hash, so in
  // practice the seed applies whole; a crafted link's own params keep priority.
  tview.seededDirect = false;
  {
    const { takePendingToolFile, takePendingToolSeed } = await import('../../lib/drop-router.ts');
    const seed = takePendingToolSeed(toolId);
    if (seed) {
      tview.initialValues = { ...(seed as Record<string, InputValue>), ...tview.initialValues };
      tview.seededDirect = true;
    }
    // A native file-manager utility verb already chose both the tool and file.
    // Seed its declared file input before the runtime is born, exactly like the
    // layered-file seed above, so onInit sees the right source and no empty-state
    // frame flashes first. Explicit URL/session values retain precedence.
    const directFile = takePendingToolFile(toolId);
    const directInput = tview.tool.manifest.inputs?.find((i) => i.type === 'file');
    if (directFile && directInput) {
      const ref = await fileToRef(directFile);
      tview.initialValues = {
        [directInput.id]: directInput.multiple ? [ref] : ref,
        ...tview.initialValues,
      } as Record<string, InputValue>;
      tview.seededDirect = true;
    }
  }

  // ── "New from template" on-ramp (plans/94) ───────────────────────────────────
  // A tool offers template starting points as per-template files (tools/<id>/templates/
  // <tid>.json); the synced index carries their METADATA only. Two ways they seed a fresh
  // session - the heavy `values` is FETCHED on demand (a real frame template serialises to
  // many KB, so it is never packed into the URL):
  //   1. `?template=<id>` fetches that entry's values directly and skips the chooser.
  //   2. otherwise, a BLANK fresh open shows the chooser (live tile previews + on-select
  //      values fetch) and awaits a pick.
  // Emptiness is keyed off the parsed URL `values` (not `initialValues`, which the
  // profile-fill loop below mutates), so the check stays honest; a chosen/parameterised
  // seed still gets profile-filled on top because this runs BEFORE that loop. Skipped
  // entirely on a resume (`slot`), a URL-seeded open, or an in-process direct seed
  // (`seededDirect`) - those all carry their own intent.
  //
  // "URL-seeded" must include RESERVED params: `values` holds only tool inputs, so a
  // deep link carrying just reserved params (`?format=png&export=1`, `?full`, `?options`
  // …) has empty `values` yet clearly carries its own intent - `reachedViaLink` (any boot
  // param at all, or `?full`) is what captures that. Because the chooser is AWAITED before
  // createRuntime/autoExport, gating on it too is what keeps an auto-export or `?full`
  // embed link from hanging on a modal no human is there to dismiss. `?template=<id>`
  // still seeds directly (it also sets `reachedViaLink`, so it's handled here, not below).
  // Template METADATA (id/name/category/description/thumb - NO values) comes from the
  // synced index entry (build-catalog-index.ts scans tools/<id>/templates/*.json). The
  // heavy `values` seed lives in each external file and is FETCHED ON DEMAND below, so it
  // never rides the index or a URL. Fall back to an inline manifest `templates[]` if a
  // tool still authors one (the optional inline shape).
  const indexEntry = (
    window as Window & { __toolIndex?: { tools?: Array<{ id: string; templates?: unknown }> } }
  ).__toolIndex?.tools?.find((e) => e.id === toolId); tview.indexEntry = indexEntry as ToolViewCtx['indexEntry'];
  const templateMeta: unknown = Array.isArray(indexEntry?.templates)
    ? indexEntry!.templates
    : Array.isArray(tview.tool.manifest.templates)
      ? tview.tool.manifest.templates
      : undefined; tview.templateMeta = templateMeta;
  const hasTemplates = Array.isArray(templateMeta) && templateMeta.length > 0; tview.hasTemplates = hasTemplates;
  /** The chooser's pick, resolved off the mount path (see the else-branch below). */
  // A template is authored content. Keep its fields in subsequent share URLs,
  // even when the first edit is only an export dimension or camera move.
  const templateSeededIds = new Set<string>(); tview.templateSeededIds = templateSeededIds;
  tview.templatePick = null;
  tview.templatePose = {};
}

/** The "New from template" on-ramp. */
export async function templatePick(tview: ToolViewCtx): Promise<void> {
  const { hasTemplates, presetParam, reachedViaLink, slot, templateMeta, templateParam, templateSeededIds, toolId, urlDesignSystem, values } = tview;
  // Navigate-away guard for the un-awaited chooser above: latched true by _cleanup, so
  // the pick handler below can tell a resolution apart from a torn-down mount, and - the
  // chooser having started but not yet opened when the view is torn down - from a modal
  // that must never open at all. `templatePickClose` is armed once the modal actually
  // exists (`onOpen`, below); _cleanup calls it to take the modal down with the view
  // instead of leaving it floating over whatever loads next.
  tview.templatePickTornDown = false;
  tview.templatePickClose = null;
  // ONE way to apply a starting point before the runtime is born - the `?template=`
  // launcher and the "Start with" ladder below both go through it, so the two can never
  // drift apart on what a seed does (pose, precedence, the kept-in-share-URLs marks).
  const applyTemplateSeed = async (seed: Record<string, InputValue>): Promise<void> => {
    const { templateEditorPose } = await import('../../lib/template-source.ts');
    tview.templatePose = templateEditorPose(seed);
    tview.initialValues = { ...seed, ...tview.initialValues };
    for (const id of Object.keys(seed)) templateSeededIds.add(id);
  };
  // The profile record, read at most ONCE per mount: the "Start with" ladder below wants
  // it, and so does the profile-fill loop further down. Null until something asks.
  let mountProfile: Profile | null = null;
  // A NAMED `?template=` seeds on its own authority - the ref lookup decides
  // (unknown id → null → normal open). It must NOT gate on `hasTemplates`:
  // metadata rides `window.__toolIndex`, which only the gallery populates, so a
  // direct link, a share, or an OFFSCREEN export remount (the blank-PDF/MP4 bug:
  // scene and export renders re-parse the URL in a context with no index and no
  // inline manifest fallback) would silently drop the seed and render empty.
  if (templateParam && !slot && !tview.seededDirect && Object.keys(values).length === 0) {
    // `?template=` names a REF now (plans/226): a bare `<tid>` is this tool's shipped
    // template, exactly as every existing link has it, and `user:<id>` is one the person
    // saved - the Projects tiles and the Templates collection link that way.
    // resolveTemplateSeed is the single lookup (their own store, then the shipped file,
    // then the inline manifest metadata); anything unknown resolves null and falls
    // through to the ordinary open rather than throwing.
    const { resolveTemplateSeed } = await import('../../lib/template-ref.ts');
    const found = await resolveTemplateSeed(
      tview.host,
      templateParam,
      { toolId, templateMeta, presetId: presetParam },
    );
    if (found) await applyTemplateSeed(found.values);
  } else if (
    !slot &&
    !tview.seededDirect &&
    Object.keys(values).length === 0 &&
    (!reachedViaLink || templateParam === '')
  ) {
    // ── The blank fresh-open ladder (plans/226 section 3) ────────────────────────
    //
    // An EMPTY `?template=` (present, no id) is an explicit ask for the chooser - the
    // gallery card's "+ new" button navigates with it - so it overrides the
    // reachedViaLink skip that would otherwise read "?template=" as a deep link with
    // its own intent, AND it overrides the person's "Start with" below: asking is what
    // that button means. Auto-export/`?full` links never carry a bare `template`, so the
    // no-modal-over-headless-export guarantee holds.
    //
    // Otherwise the person's own setting for this tool decides: a template ref seeds the
    // document directly (the same path `?template=` takes, so a start-with and a link to
    // the same template open identically), 'blank' opens on the manifest defaults, and
    // nothing set falls through to today's rule - the chooser when there is anything to
    // choose from. A ref that no longer resolves clears itself rather than opening
    // something the person did not choose.
    let startSeeded = false;
    if (templateParam !== '') {
      mountProfile = await tview.host.profile.get();
      const start = loadTemplateStart(mountProfile, toolId);
      if (start && start !== START_BLANK) {
        const { resolveTemplateSeed } = await import('../../lib/template-ref.ts');
        const found = await resolveTemplateSeed(
          tview.host,
          start,
          { toolId, templateMeta },
        );
        if (found) {
          await applyTemplateSeed(found.values);
          startSeeded = true;
        } else {
          // Deleted, hidden by a brand update, or not synced to this device yet.
          const { setStartWith } = await import('../../lib/template-actions.ts');
          await setStartWith(tview.host, toolId, null);
        }
      } else if (start === START_BLANK) {
        // "Blank" on a frame-based tool is the DECLARED artboards with nothing on them,
        // not the composed cover the manifest default opens with (plan 179).
        const { blankTemplateSeed } = await import('../../lib/template-source.ts');
        await applyTemplateSeed(blankTemplateSeed(tview.tool.manifest.inputs));
        startSeeded = true;
      }
    }
    // The chooser opens on a blank fresh open (no resume, no seed, no link) when the tool
    // has built-in templates OR the current user has saved templates/variations for this
    // toolId - so a tool whose only starting points are user-saved is still reachable. The
    // store's list() is async and this gate is sync, so when there are NO built-in templates
    // we resolve the user's own here to decide whether to open at all. A tool WITH built-in
    // templates always opens, so we skip that await and let the chooser promise below fetch
    // the user templates off the mount path (as it already did), keeping the fast path fast.
    // A "Start with" that already seeded the document skips the question altogether.
    let hasUserTemplates = false;
    if (!startSeeded && !hasTemplates) {
      try {
        const { createUserTemplateStore } = await import('../../lib/user-templates.ts');
        const mine = await createUserTemplateStore(
          tview.host
        ).list(toolId);
        hasUserTemplates = mine.length > 0;
      } catch {
        /* user templates are best-effort - fall through to a blank open */
      }
    }
    // A design file dropped on the front door is the document: the drop route stashed
    // it and free-canvas imports it on mount, so the chooser must not open over it - a
    // template picked (or merely clicked through) under a running import replaces the
    // board and re-mounts the canvas, and the import finishes in a view that is gone.
    const { hasPendingDesignImport } = await import('../../lib/drop-router.ts');
    if (!startSeeded && (hasTemplates || hasUserTemplates) && !hasPendingDesignImport()) {
      // NOT AWAITED - and that is the whole point. This chooser used to sit between the
      // user and `createRuntime` below: the tool could not begin to mount until a human
      // clicked a tile, and the chooser's own live tile previews (a real off-screen tool
      // mount + walker export each, measured at ~1 s apiece, 4 s for Design's four
      // templates on a cache-cold device) burned the main thread in that same window. The
      // felt "Design takes forever to open" was almost entirely this.
      //
      // So the modal still opens at exactly this moment - it is started here, before any
      // of the mount work below - but the mount no longer waits on it. The tool paints and
      // becomes interactive underneath while the chooser sits on top, and the pick is
      // applied as a PATCH once it arrives (search "template chooser pick" below).
      //
      // The `?template=` branch ABOVE stays awaited on purpose: that seed is deterministic,
      // has no human in the loop, and off-screen export/scene remounts depend on the values
      // being in the model before the first hydrate.
      //
      // The chooser fetches each template's values file on demand - for the live tile
      // previews (host + formats) and for the final select - so the seed it resolves is
      // already the full input map, ready to merge.
      // A chooser failure (a bad template file, a stale chunk, a throw mid-render) must
      // never brick the mount - fall through to a blank open, which is what dismissing the
      // chooser means anyway. That is why the whole thing, the lazy import included, is
      // wrapped in one promise that resolves `{}` instead of rejecting.
      tview.templatePick = (async () => {
        const { openTemplateChooser, blankTemplateSeed } = await import('../template-chooser.ts');
        const { shippedVariants, userVariants } = await import('../../lib/template-ref.ts');
        // A navigate-away while the chunk above was loading - the modal never got to
        // open, so there is nothing for `onOpen` below to arm a close over. Resolve
        // blank without opening it, exactly like a torn-down mount that arrives later.
        if (tview.templatePickTornDown) return {};
        // Every tile carries its ref, which is what the chooser's own management menu
        // (hide, start with, rename, delete) acts on - see lib/template-ref.ts.
        const templates = shippedVariants(toolId, templateMeta);
        // Merge the user's own saved templates for this tool. Same TemplateVariant shape, but
        // their `values` ride INLINE (stored on the profile), so the chooser renders + applies
        // them with no fetch - a picked one seeds the doc exactly like a built-in. One chip.
        try {
          const { createUserTemplateStore } = await import('../../lib/user-templates.ts');
          const mine = await createUserTemplateStore(
            tview.host
          ).list(toolId);
          templates.push(...userVariants(mine, t('Yours')));
        } catch {
          /* user templates are best-effort */
        }
        if (!templates.length) return {};
        return openTemplateChooser({
          toolName: tview.tool.manifest.name,
          toolId,
          templates,
          host: tview.host,
          formats: tview.tool.manifest.render?.formats,
          // "Blank canvas" on a frame-based tool is the default document's artboards with
          // nothing on them, not the composed cover the default opens with (plan 179).
          blankSeed: () => blankTemplateSeed(tview.tool.manifest.inputs),
          // The brand's own hidden-by-default shipped templates. The chooser owns the
          // filtering and the tile menu (plans/226 WP-3); it only needs the seed set.
          hiddenDefaults: defaultHiddenTemplateRefs(),
          onPick: ({ templateId, category }) =>
            tview.history.setDesignIntent(inferDesignIntent({ templateId, templateCategory: category }), true),
          // Arms the navigate-away close. If teardown arrived in the same tick as the
          // modal's own construction (the race the check exists for), close immediately
          // instead of leaving a reference nobody will ever call.
          onOpen: (close) => { if (tview.templatePickTornDown) close(); else tview.templatePickClose = close; },
        });
      })().catch((e) => {
        tview.host.log?.('warn', 'template chooser failed - opening blank: ' + String(e));
        return {} as Record<string, InputValue>;
      });
    }
  }

  // "+ New tool" from the Projects view leaves a sessionStorage marker so the first
  // FRESH session saved here files into the folder it launched from. Read it ONLY on a
  // fresh open (no resume `slot`) - otherwise a diverted "open the gallery, resume an
  // unrelated old session, save it" flow would capture it and misfile that session.
  // We READ (not remove) the marker: a hash navigation can mount the tool twice (a
  // browser fires popstate AND hashchange, which the router debounce can't fully
  // collapse), and a consume-on-mount would let the first mount swallow the marker
  // while the SECOND mount owns the live Save button. The marker is cleared instead
  // when the user ends up on any non-tool view (main.js navigate). Used in performSave.
  tview.fileIntoFolder = null;
  if (!slot) {
    try {
      const into = sessionStorage.getItem('lolly:fileInto');
      if (into !== null) tview.fileIntoFolder = into || null;
    } catch (_e) {
      /* sessionStorage unavailable (private mode) */
    }
  }

  // Where the tool returns to when it leaves. The Projects view arms a marker (the
  // folder it launched from, e.g. `/#/p/<folderId>`) so a tool opened or resumed from a
  // folder saves and arrives BACK in that folder; opening straight from the gallery leaves
  // no marker, so we fall back to '/' (the gallery). Read (not removed) here for the same
  // double-mount reason as fileIntoFolder above; cleared on the next non-tool mount.
  tview.returnTo = '/';
  try {
    const back = sessionStorage.getItem('lolly:returnTo');
    if (back) tview.returnTo = back;
  } catch (_e) {
    /* sessionStorage unavailable (private mode) */
  }

  // The back pill follows that same marker: a tool launched from a folder is PINNED
  // to that folder - it must land back where the session was filed even if the user
  // wandered elsewhere in between - so the marker is handed to the shared pill as an
  // explicit target. Without a marker there's nothing to pin to and the pill does what
  // it does everywhere else: names and returns to the view you actually came from
  // (the gallery, the catalog, a search…), falling back to "Tools" only on a direct
  // visit. Either way the editing session stays a round-trip instead of dumping the
  // user in the gallery. "Leave without saving" follows this target; "Save & leave"
  // returns to the launch folder when present and otherwise opens Projects.
  const fromFolder = tview.returnTo !== '/'; tview.fromFolder = fromFolder;
  const backPillOpts = fromFolder ? { href: tview.returnTo } : {}; tview.backPillOpts = backPillOpts;

  // Populate inputs from user profile if they match profile field names. The ladder
  // above may already have read it - one record, one read.
  const profile = mountProfile ?? await tview.host.profile.get(); tview.profile = profile;
  const profileInputIds = (tview.tool.manifest.inputs ?? []).map((i) => i.id); tview.profileInputIds = profileInputIds;
  for (const inputId of profileInputIds) {
    if (inputId in profile && !(inputId in tview.initialValues)) {
      tview.initialValues[inputId] = (profile as Record<string, InputValue>)[inputId]!;
    }
  }

  // Which design system this tool mounts under, and which one a resumed session was
  // made with. Both feed the two notices below the sidebar: "Made with X" when they
  // differ and X is on the device, and "Switched to X - reload" if a switch happens
  // while this tool stays open (the switch never tears a tool down under someone).
  const {
    registry: dsRegistry,
    mountedSystemId,
    madeWith,
  } = await prepareToolDesignSystemContext(tview.host, urlDesignSystem, slot); tview.dsRegistry = dsRegistry; tview.mountedSystemId = mountedSystemId; tview.madeWith = madeWith;

  const runtime: ToolRuntime = await createRuntime(tview.tool, tview.host, tview.initialValues); tview.runtime = runtime;
}

export function documentSurface(tview: ToolViewCtx): void {
  const { mountLifecycle, slot } = tview;
  const documentSurface = {
    compile: tview.history.compileForSurface,
    inspect: async (document?: unknown) =>
      inspectDocument((document ?? (await tview.history.compileForSurface())) as never),
    measure: async (document?: unknown, opts?: Record<string, unknown>) =>
      measureDocument((document ?? (await tview.history.compileForSurface())) as never, opts),
    diff: async (a: unknown, b: unknown) => diffDocuments(a as never, b as never),
  }; tview.documentSurface = documentSurface;
  const removeDocumentSurface = installDocumentSurface(window, documentSurface); tview.removeDocumentSurface = removeDocumentSurface;
  mountLifecycle.add('document automation surface', removeDocumentSurface);
  // A NEW session appears - the soft "twinkle bloom". Only a fresh open (no resume
  // slot); resuming a saved session is not "making" one. Audible when opened via a
  // click (audio is gesture-gated); a cold direct-URL load stays silent until a gesture.
  if (!slot) playSfx('newSession');

  // ── Undo / redo (Cmd+Z / Cmd+Shift+Z / Cmd+Y) ──────────────────────────────
  // Lets an accidental slider nudge - or any control edit - be reverted. There's
  // no shell-level chokepoint for edits: every control calls runtime.setInput
  // directly, so we wrap it once here to record before/after values. A slider
  // drag fires 'input' on every pixel, so rapid same-input changes coalesce (by
  // id + time) into a single step - one gesture, one undo. Restoring just replays
  // setInput, so the existing subscriber refreshes the sidebar + canvas for free
  // and the onInput hook re-derives any computed inputs (we never store those).
  // The history RULES (coalescing, the byte-carrying filter, the cap, the redo
  // chain) live in ./tool-history.ts - pure and unit-tested. This view keeps the
  // wiring: the runtime, the toast and the button sync.
  const inputHistory = createHistory(); tview.inputHistory = inputHistory;
}

export function wrapSetInput(tview: ToolViewCtx): void {
  const { baseSetInput, inputHistory, runtime } = tview;
  runtime.setInput = (id: string, value: InputValue) => {
    if (!tview.applyingHistory) {
      const cur = runtime.getModel().find((i) => i.id === id);
      // `label` is what the toast shows on undo/redo - what CHANGED where we can name it.
      if (
        cur &&
        inputHistory.record(
          { id, label: tview.history.changeLabel(cur, cur.value, value), before: cur.value, after: value },
          Date.now()
        ) !== 'ignored'
      ) {
        tview.historyToastEl?.classList.remove('is-visible'); // dismiss a now-stale undo/redo toast
        tview.history.refreshHistoryUI();
      }
    }
    return trackRevisionInput(baseSetInput(id, value), () => tview.revisionChanged());
  };
}

/** Stable row ids. */
export function stableRowIds(tview: ToolViewCtx): void {
  const { runtime, templateSeededIds } = tview;
  // ── Stable row ids (plan 100 section 3) ───────────────────────────────────────────
  // A session saved before rows had ids gets them here, once, for this mount - the
  // ONE place that owns a mounted session's model, and before anything can edit it.
  // Fire-and-forget: it writes through the engine's applyPatch, so it records no undo
  // step (see lib/row-id.ts for why both of those matter) and the render it triggers
  // is the same one the first paint was going to do.
  void migrateBlockRowIds(runtime);

  // ── template chooser pick ──────────────────────────────────────────────────
  // The chooser was STARTED above without being awaited, so this mount has already
  // reached (or is about to reach) first paint. Its pick arrives here instead, through
  // exactly the write path the row-id migration above uses - `applyPatch`, the engine's
  // atomic multi-input apply:
  //   • no undo step. Choosing a starting point is not the user's first edit; ⌘Z must
  //     not wipe the template they just picked (mountTool's `setInput` is the history
  //     wrapper - `applyPatch` bypasses it, exactly as lib/row-id.ts documents).
  //   • no collab echo. lib/collab-plumbing.ts wraps `setInput` only.
  //   • one render for the whole seed, hooks included, not one per input.
  // Precedence is IDENTICAL to the pre-mount merge this replaced (`{...chosen,
  // ...initialValues}`): a key the URL or the profile fill already supplied wins, so it
  // is dropped from the patch rather than overwritten. `values` is empty on this branch
  // by construction, so what survives in `initialValues` is exactly the profile fill.
  // Row ids are re-stamped afterwards because these rows arrive AFTER the mount-time
  // migration ran (on the blank model), and `ensureRowIds` is idempotent for the rest.
  if (tview.templatePick) {
    void tview.templatePick
      .then(async (chosen) => {
        // Navigated away before the pick arrived (or before the chooser even opened,
        // per the guard at its `templatePickTornDown` check above) - this runtime is
        // already torn down by _cleanup; applying a patch to it now would re-run the
        // tool's onInput hook and emit() against disconnected DOM. `chosen` is `{}` on
        // this path anyway (the close armed by `onOpen` resolves blank), so the seed
        // below would end up empty regardless - this is the explicit, required check.
        if (tview.templatePickTornDown) return;
        const seed: Record<string, InputValue> = {};
        for (const [k, v] of Object.entries(chosen ?? {})) if (!(k in tview.initialValues)) seed[k] = v;
        if (!Object.keys(seed).length) return; // Blank canvas / Escape / close
        for (const id of Object.keys(seed)) templateSeededIds.add(id);
        tview.templatePose = (await import('../template-chooser.ts')).templateEditorPose(chosen);
        await runtime.applyPatch(seed);
        if (tview.templatePickTornDown) return; // torn down while applyPatch was in flight
        await migrateBlockRowIds(runtime);
        // applyPatch resolves no refs (it's the keystroke/collab path); a template's
        // {color.*} backdrop tokens and tool-URL image stubs arrive unresolved, so do
        // the one resolve pass the mount does - else a seeded template renders black
        // colours + a placeholder where its own preview showed the real render.
        if (tview.templatePickTornDown) return;
        await runtime.resolveRefs();
        tview.poseTemplate();
      })
      .catch((e) => tview.host.log?.('warn', 'template seed failed - staying blank: ' + String(e)));
  }

  // ── Live collab (plan 100 section 5) ──────────────────────────────────────────────
  // Wraps the undo wrapper above once more, so a local edit ALSO becomes ops for a
  // registered sync provider (and an undo replay syncs like any other local edit).
  // Returns null when no provider is registered - which is every build of this repo
  // (plans/99 section 1.1) - and in that state it has not touched the runtime at all, so
  // the mount is byte-identical to single-player.
  const collab = attachCollabPlumbing(runtime); tview.collab = collab;

  // The presence half of a collab is CHROME, so it cannot be composed here: it needs
  // the stage, the render surface and the sidebar root, and none of them exist yet
  // (the view's innerHTML is written a few hundred lines below). It is composed in
  // ONE guarded block once they do - search "Live collab: presence chrome" - and
  // these are the two handles that block hands back to the paint path, the stage
  // ResizeObserver and the teardown, each of which is declared BEFORE it.
  //
  // Both stay null for every mount of this repo, and that is what a single-player
  // mount pays for presence: two nullable reads on a resize and one per painted
  // frame. No timer, no listener, no node (section 11.14's solo-cost discipline).
  tview.collabReanchor = null;
  tview.collabTeardown = null;
}

export function wireActionsPanel(tview: ToolViewCtx): void {
  const { autoCopy, autoExport, isFull, showAside, viewEl } = tview;
  const actionsEl = viewEl.querySelector<PanelEl>('#tool-actions'); tview.actionsEl = actionsEl;
  const sidebarEl = viewEl.querySelector<HTMLElement>('#tool-sidebar'); tview.sidebarEl = sidebarEl;

  // The tool's own walkthrough (manifest `guide`, components/tool-guide.ts): the
  // help button beside the title, plus one automatic open per device on a tool
  // the user hasn't opened before. mountModal bodies its dialog, so the handle is
  // kept to close it on teardown - a guide must not outlive the tool it explains.
  tview.openGuide = null;
  viewEl.querySelector<HTMLButtonElement>('#tool-guide-btn')?.addEventListener('click', () => {
    tview.openGuide = showToolGuide(tview.tool.manifest);
  });
  // The automatic first-visit open is for someone who came to MAKE the thing.
  // Anyone arriving on a finished render - a fullscreen/auto-export share link,
  // or a chromeless editor embed - gets the button and nothing in their way.
  // Deferred a frame so the dialog opens over a painted canvas, not a blank one.
  if (showAside && !isFull && !autoExport && !autoCopy) {
    // A native guide and the template chooser's focus trap cannot overlap:
    // each makes the other's controls inert. Finish the chooser first.
    void Promise.resolve(tview.templatePick).then(() => requestAnimationFrame(() => {
      if (viewEl.isConnected) tview.openGuide = autoOpenToolGuide(tview.tool.manifest) ?? tview.openGuide;
    }));
  }

  // ── Sidebar ──────────────────────────────────────────────────────────────

  const fullscreenToggle = viewEl.querySelector<HTMLButtonElement>('#fullscreen-toggle'); tview.fullscreenToggle = fullscreenToggle;
  const fullscreenToggleFloat = viewEl.querySelector<HTMLButtonElement>('#fullscreen-toggle-float'); tview.fullscreenToggleFloat = fullscreenToggleFloat;
  const dragHandle = viewEl.querySelector<HTMLElement>('#sidebar-drag-handle'); tview.dragHandle = dragHandle;
  const sheetGrip = viewEl.querySelector<HTMLElement>('#sheet-grip'); tview.sheetGrip = sheetGrip as ToolViewCtx['sheetGrip'];
}

/** The actions bar and the revision history panel. */
export function mountActions(tview: ToolViewCtx): void {
  const { actionsEl, collabHandle, ephemeralState, exportDefaults, exportSourceNode, libraryHost, mountLifecycle, openedSession, reachedViaLink, runtime, slot, toolId, viewEl } = tview;
  const actionsApi = renderActions(
    actionsEl,
    tview.tool.manifest,
    runtime,
    exportSourceNode,
    tview.host,
    tview.stageLayout.resetView,
    tview.exporting.exportUnscaled,
    exportDefaults,
    tview.session.syncUrl,
    tview.designSystem.playShutter,
    tview.fileIntoFolder,
    tview.returnTo,
    slot,
    reachedViaLink,
    {
      portable: true, historyBase: openedSession.cursor,
      // A thunk: session wiring assigns tview.openSaveAs after this mount runs.
      openSaveAs: () => { void tview.openSaveAs?.(); },
      current: toolId === 'design' ? () => tview.session.currentDesignOutcome() : undefined,
      sessionMeta: toolId === 'design' ? () => ({ __workspace_intent: tview.designIntent }) : undefined,
      ...historyParticipation(tview.tool.manifest, !!collabHandle || !!ephemeralState || !!getCollabSessionSource()),
    }
  ); tview.actionsApi = actionsApi;
  // The retained export file (plans/236) lives only as long as this mount.
  mountLifecycle.add('export delivery result', () => actionsApi?.releaseDelivery?.());
  tview.revisionChanged = () => actionsApi?.history?.changed();
  const capture = mountCollabActionHistory({ handle: collabHandle, snapshot: actionsApi?.sessionState,
    toolId, slot: actionsApi?.getSlot?.(), open: () => revisionPanel.open() }); tview.capture = capture;
  if (capture) {
    const priorChanged = tview.revisionChanged;
    tview.revisionChanged = (): void => { priorChanged(); capture.changed(); };
    mountLifecycle.add('collab history capture', () => { capture.flush(); capture.dispose(); });
  }
  // "Load from peer" appears only when the transport negotiated the shared-history
  // capability (plan 221 section 9); the handle carries the request/fetch the mount wired.
  const peerHistory = collabHandle?.requestPeerHistory && collabHandle.requestPeerRevision
    ? { list: () => collabHandle.requestPeerHistory!(), fetch: (id: string) => collabHandle.requestPeerRevision!(id) }
    : undefined; tview.peerHistory = peerHistory as ToolViewCtx['peerHistory'];
  const revisionPanel = wireToolRevisionHistory({ state: tview.host.state as import('../../bridge/state.ts').WebStateAPI,
    copyState: libraryHost.state as import('../../bridge/state.ts').WebStateAPI,
    slot: () => actionsApi?.getSlot?.() ?? null, controller: actionsApi?.history, currentSnapshot: actionsApi?.sessionState,
    collab: collabHandle?.history, collaborating: !!collabHandle || !!ephemeralState, root: viewEl, connected: () => viewEl.isConnected,
    ...(peerHistory ? { peer: peerHistory } : {}) }); tview.revisionPanel = revisionPanel;
  const _openRevisions = () => revisionPanel.open();
  mountLifecycle.add('revision history panel', revisionPanel.dispose);
  if (toolId === 'design') {
    tview.refreshDesignExperience = (pickDefault = false): void => {
      const outcome = tview.session.currentDesignOutcome();
      viewEl.dataset.designIntent = tview.designIntent;
      actionsApi?.setExperience?.(outcome);
      // Choosing a new outcome is an explicit request for its natural deliverable.
      // A URL/session format remains authoritative on initial mount; a later template
      // or intent switch may deliberately move the picker.
      if (pickDefault && outcome.defaultFormat) actionsApi?.setFormat?.(outcome.defaultFormat);
      if (pickDefault) tview.applyDesignIntentLayout(outcome);
      tview.syncDesignIntentChrome();
    };
    const offOutcome = runtime.subscribe(() => tview.refreshDesignExperience(false));
    if (typeof offOutcome === 'function')
      mountLifecycle.add('Design outcome subscription', offOutcome);
  }
  // renderActions announces every completed download/copy/save - see
  // exportedSinceEdit above for why that quiets the unsaved-changes guards.
  actionsEl?.addEventListener('lolly:export-complete', () => {
    tview.exportedSinceEdit = true;
  });
}

export function wireBulkRows(tview: ToolViewCtx): void {
  const { TOOL_URL_BASE, actionsApi, actionsEl, bulkFilesId, contentEl, runtime, toolId, urlFlags, urlGaugeEl, viewEl } = tview;
  viewEl.querySelector<HTMLButtonElement>('#bulk-rows-btn')?.addEventListener('click', tview.session.openBulk);

  // "Bulk from files" (plans/147 M2): pick N files and run this transform tool over
  // each through its exportFile hook on the LIVE runtime, delivering one zip. It is
  // foreground by design (it drives the mounted runtime), so progress rides the icon
  // button - a background/navigate-away job would need a fresh runtime per file.
  if (bulkFilesId) {
    const fileSpec = tview.tool.manifest.inputs.find((i) => i.id === bulkFilesId) as
      | { accept?: string[] }
      | undefined;
    const picker = document.createElement('input');
    picker.type = 'file';
    picker.multiple = true;
    if (fileSpec?.accept?.length) picker.accept = fileSpec.accept.join(',');
    picker.style.display = 'none';
    viewEl.appendChild(picker);
    const bulkBtn = viewEl.querySelector<HTMLButtonElement>('#bulk-files-btn');
    const idleTip = bulkBtn?.getAttribute('data-tip') ?? '';
    const tip = (s: string): void => {
      if (bulkBtn) bulkBtn.dataset.tip = s;
    };
    bulkBtn?.addEventListener('click', () => {
      picker.value = '';
      picker.click();
    });
    picker.addEventListener('change', async () => {
      const picked = Array.from(picker.files ?? []);
      if (!picked.length || !bulkBtn || bulkBtn.dataset.busy) return;
      bulkBtn.dataset.busy = '1';
      bulkBtn.disabled = true;
      // The loop drives the live input; snapshot what the user had so the view
      // returns to it rather than sitting on the last file of the batch.
      const prevFile = runtime.getModel().find((i) => i.id === bulkFilesId)?.value ?? null;
      try {
        const { entries, failed } = await collectBulkFiles(
          picked.map((f) => ({ name: f.name })),
          async (i) => {
            await runtime.setInput(bulkFilesId, await fileToRef(picked[i]!));
            const res = await runtime.exportFile();
            return Array.isArray(res) ? res : [res];
          },
          (done, total) => tip(`${t('Converting')} ${done}/${total}…`)
        );
        if (!entries.length)
          throw new Error(t('Every file failed to convert - try different files.'));
        const { storeZip } = await import('@lolly/engine');
        const zip = storeZip(entries);
        await tview.host.export.file(new Blob([zip as BlobPart], { type: 'application/zip' }), {
          filename: `${toolId}-bulk.zip`,
        });
        tip(failed.length ? `${failed.length} ${t('skipped')}` : idleTip);
      } catch (err) {
        console.error('bulk-from-files failed:', err);
        bulkBtn.classList.add('is-error');
        tip((err as { message?: string })?.message || t('Bulk convert failed - try again'));
      } finally {
        await runtime.setInput(bulkFilesId, prevFile).catch(() => {});
        bulkBtn.disabled = false;
        delete bulkBtn.dataset.busy;
        window.setTimeout(() => {
          bulkBtn.classList.remove('is-error');
          tip(idleTip);
        }, 4000);
      }
    });
  }

  // Now that actionsApi exists, wire the gauge - a click (not a drag) opens the Share
  // dialog with the current state (same path as the Share button). syncUrl already drives
  // its live value via the holder above.
  if (urlGaugeEl) {
    tview.urlGauge = createUrlGauge(
      urlGaugeEl,
      {
        used: (pct) => `${t('URL budget')}: ${pct}%`,
        // Shown from the meter the first time a link fills the bar - reassurance, not a warning.
        reassure: t(
          "It's okay - keep going. You can always share the whole thing as a .lolly file."
        ),
      },
      prefersReducedMotion,
      () =>
        showShareDialog(
          runtime,
          actionsEl,
          tview.tool.manifest,
          makeLollyVehicle(tview.host, toolId, tview.tool.manifest, actionsApi?.sessionState, contentEl)
        )
    );
    // Render once now so the bar shows on mount - not only after the first syncUrl (a
    // free-canvas tool may not write the URL on load, which would leave it hidden).
    const gaugeBase = `${location.origin}${TOOL_URL_BASE}?`;
    tview.urlGauge.update(
      costUrlState(
        { model: runtime.getModel(), exportParts: collectExportParams(actionsEl) },
        { base: gaugeBase, target: BROWSER_TARGET }
      ),
      gaugeBase
    );
  }

  // Preview-generation hook - scripts/build-previews.ts calls this to grab a VECTOR
  // SCREENSHOT (SVG) of the mounted canvas for ANY tool, even an export:false utility
  // (colour browser, countdown timer) that has no Save button and would otherwise fall
  // back to a raster page screenshot. It's the app's own captureThumbnail - text outlined
  // to paths, blob-URLs inlined - so the SVG is self-contained and crisp at any tile size.
  // A benign single function ref no in-app UI calls; re-bound to the live canvas each mount.
  // Uses contentEl (the universal canvas node) rather than canvasEl - the latter is null for
  // hideSidebar/full-bleed tools (export:false utilities, editor layouts), which are exactly
  // the ones without a Save button that this hook exists to cover.
  (
    globalThis as { __lollyCaptureThumb?: (fmt?: string) => Promise<string | null> }
  ).__lollyCaptureThumb = (fmt = 'svg') =>
    captureThumbnail(tview.tool.manifest, contentEl, runtime, tview.exporting.exportUnscaled, fmt);

  // Canvas → input setter for THIS mounted tool. A template/canvas script can drive
  // any declared input by id - including custom controls (sliders, colour fields)
  // that the "set .value + dispatch input" pattern can't reach, since it rides the
  // real runtime.setInput (URL sync, undo, dirty, session-save all included). Used
  // by url-shot's visual composer to apply its crop/scroll/css back to the tool.
  // Re-bound to the live runtime each mount; last-mounted wins (a single tool at a
  // time on the tool route - /multi drives inputs its own way).
  (globalThis as { __lollySetInput?: (id: string, value: InputValue) => void }).__lollySetInput = (
    id,
    value
  ) => {
    try {
      runtime.setInput(id, value);
      tview.session.markUserDirty(id);
    } catch {
      /* unknown id - ignore */
    }
  };

  // Deep-link an overlay open on load, so a share link OR a screenshot recipe can
  // reproduce a state that otherwise lives only in a click. `?share` opens the Share
  // dialog. This is the pattern for making the app's click-only surfaces addressable
  // (see plans/43-deep-linking.md) - each new one reads its flag here or in its view.
  if (urlFlags.has('share')) {
    requestAnimationFrame(() => showShareDialog(runtime, actionsEl, tview.tool.manifest));
  }
}

export function wireBackPill(tview: ToolViewCtx): void {
  const { inputsEl, viewEl } = tview;
  mountBackPill(viewEl, { intercept: tview.session.backPillIntercept });

  // Mark model inputs dirty the first time the user touches them.
  // The listener lives on the container so it survives renderInputs re-renders.
  (['change', 'input'] as const).forEach((evt) =>
    { inputsEl?.addEventListener(evt, (e) => {
      const id = (e.target as HTMLElement).closest<HTMLElement>('[data-input-id]')?.dataset.inputId;
      if (id) tview.session.markUserDirty(id);
    }); }
  );

  // ↑/↓ select scrubbing is handled ONCE, app-wide, by select-preview.ts (installed
  // at boot). Do NOT add a per-view arrow handler here: a second stepper made every
  // press advance TWO options - this one stepped + re-rendered, then the document
  // handler stepped the detached select again, and its input listener still updated
  // the runtime - so options between were unreachable by keyboard.

  // Click-to-edit-in-place: a clicked canvas element whose input has a direct
  // in-place editor (colour swatch, asset thumbnail, select) opens THAT right
  // where the user clicked, instead of jumping to the sidebar - one shared
  // popover per input type, reusing the exact same components/commit path the
  // sidebar uses (colorFieldHtml/wireColorField, host.assets.pick), so the two
  // stay in lockstep and there is nothing new to keep in sync. Every other
  // control (text, sliders, vectors, blocks rows) has no in-place equivalent
  // yet and keeps the sidebar-focus behaviour below.
  const INLINE_EDIT_CONTROLS = new Set(['color-picker', 'select', 'asset-picker']); tview.INLINE_EDIT_CONTROLS = INLINE_EDIT_CONTROLS;
}

export async function mountLiveControls(tview: ToolViewCtx): Promise<void> {
  const { actionsApi, canvasDropInput, canvasEl, canvasFileInput, canvasLayout, contentEl, dirtyParams, inputsEl, mountLifecycle, pagesMode, runtime, stageEl, templateSeededIds, urlHeight, urlWidth, viewEl, visitorPage } = tview;
  // Live frame sources (engine v1.4 camera / v1.113 animated asset): ONE
  // controller (live-controls.ts) owns "Go live" + "Play" and every button
  // placement. SIDEBAR placement is primary - the buttons ride the source asset
  // input's slot-actions row, re-injected by renderInputs on every panel rebuild
  // (mountSidebarLiveControls) - and the floating canvas toggles remain only when
  // there is no sidebar row to ride (canvas layout / no asset input). Picking an
  // animated asset (CSS/SMIL SVG, GIF/APNG via ImageDecoder, video) auto-plays it
  // through the tool's onFrame - the same frame path and drop-overlap throttle as
  // the camera - with `source:'asset'` so provenance never claims a camera
  // capture; pausing freezes the current frame so stills/exports keep working.
  // The sample animation (render.liveDefault) stays manual-start only.
  // Created BEFORE runtime.subscribe so the callback below can never hit the
  // binding in its temporal dead zone.
  const liveControls = createLiveControls({
    runtime,
    host: tview.host,
    t,
    announce,
    onStart: () => startFrameFps(runtime.manifest.id), // dev-only fps meter (gated)
    onStop: stopFrameFps,
  }); tview.liveControls = liveControls;
  if (liveControls.enabled) registerLiveControls(runtime, liveControls);

  runtime.subscribe(({ model, hydrated }) => {
    fpsTick(); // dev-only onFrame fps meter (no-op unless lolly.frameFps='1' + live)
    // Sidebar sync is cheap and must stay responsive, so it runs synchronously on
    // every emit; only the expensive canvas rebuild is deferred to the next frame.
    if (inputsEl && !_sliderDragging) {
      tview.prevInputsModel = syncInputs(inputsEl, model, tview.prevInputsModel, runtime, tview.host, tview.session.markUserDirty);
    }
    // Reflect a source swap in the live controls (auto-play a fresh animated pick,
    // stop playback whose source was swapped away). Cheap: no-op unless the source
    // asset input's value identity changed.
    if (liveControls.enabled) liveControls.syncFromModel(model);
    tview.pendingFrame = { model, hydrated };
    if (!tview.rafId) tview.rafId = requestAnimationFrame(tview.render.paint);
    // Carousel: a change to the page count / page size reshapes the editing strip.
    // syncStrip no-ops unless the strip dimensions actually changed, so ordinary box
    // edits don't reset the view.
    if (pagesMode) tview.stageLayout.syncStrip();
  });

  if (liveControls.enabled) {
    // Classify the initial source (shows Play for a restored animated pick or the
    // sample; never auto-plays on open).
    liveControls.syncFromModel(runtime.getModel());
    // Put the camera control in the INPUTS BAR wherever there is one (with an
    // asset input it rides that slot's row; without one - a reader like scan-code -
    // it pins a standalone row at the top). This keeps "Use camera" reachable on
    // mobile, where the floating canvas toggle is not. The canvas-stage fallback is
    // only for a genuine canvas layout that hides the inputs panel entirely.
    if (inputsEl && !canvasLayout) mountSidebarLiveControls(inputsEl, runtime);
    else if (stageEl) liveControls.mountStage(stageEl);
  }

  // Authenticated capture (desktop only): a tool declaring the `capture` capability
  // gets a "Sign in to a site" panel so a login/session set up once is ridden by every
  // later screenshot. Self-gating - no-op on the web PWA and for non-capture tools -
  // and mounted as a sidebar sibling so input rebuilds never drop it.
  if (inputsEl && !canvasLayout) mountCaptureSignin({ inputsEl, runtime, t, announce });

  // Device recording (engine v1.17): a tool declaring render.capture gets a Record
  // affordance where this shell exposes host.recorder. Audio tools also surface a live
  // level meter + coaching through their onLevel hook (the runtime drives it); video
  // tools get a host.media framing viewfinder, then the clip feeds the top-&-tail
  // compositor. The runtime owns startMeter/startRecording/stopRecording; here we only
  // drive the UI and route the finished blob.
  const captureMode = (
    runtime.manifest.render as { capture?: 'audio' | 'video' | 'av' | 'screen' } | undefined
  )?.capture; tview.captureMode = captureMode as ToolViewCtx['captureMode'];
  if (stageEl && captureMode === 'screen') {
    // Display capture (v1.54) has its own control: the browser's picker replaces the
    // viewfinder + framing + level coaching a camera take needs, so none of that applies.
    // isAvailable('screen') feature-detects getDisplayMedia - where it's absent (an
    // insecure context, an older browser) the tool still mounts and keeps its upload
    // path, rather than showing a Screenshot button that can only fail.
    if (tview.host.recorder?.isAvailable?.('screen')) {
      const { setupScreenCaptureControl } = await import('../screen-capture-control.ts');
      setupScreenCaptureControl({
        stageEl,
        runtime,
        host: tview.host,
        markSessionDirty: tview.session.markSessionDirty,
        canvasEl,
        actionsApi,
        sizeExplicit: Boolean(urlWidth || urlHeight),
      });
    }
  } else if (
    stageEl &&
    captureMode &&
    captureMode !== 'screen' &&
    tview.host.recorder?.isAvailable?.(captureMode === 'audio' ? 'audio' : 'video')
  ) {
    setupRecordControl({ stageEl, runtime, host: tview.host, mode: captureMode, markSessionDirty: tview.session.markSessionDirty });
  }

  // Image framing (plans/148): wherever a tool declares a framing control
  // (`framingFor` on a vector input, or on a blocks asset sub-field), the shell
  // mounts ONE generic on-canvas overlay - pan, zoom, roll, and the perspective
  // pair - plus "Use as a new image", which bakes the framing into a new library
  // asset through the same signed path the catalog crop uses. Declaration-driven:
  // no tool is named here, and a tool with no framing input mounts nothing.
  if (stageEl && canvasEl && !visitorPage) {
    const { hasFramingInputs, setupFramingOverlay } = await import('../framing-overlay.ts');
    if (hasFramingInputs(runtime.getModel())) {
      tview.framingTeardown = setupFramingOverlay({
        stageEl,
        canvasEl,
        runtime,
        onDirty: tview.session.markUserDirty,
        onBake: (key) => tview.session.bakeFraming(key),
      });
    }
  }

  // Animation transport (play/pause/scrub): any tool declaring render.video gets a
  // reusable transport bar driven entirely by the tool's window.__lollyAnim clock - it
  // shows itself only while an animation is actually active. Lazy-loaded to stay off the
  // boot critical path; torn down via stageEl._animCleanup in _cleanup above.
  if (stageEl && (runtime.manifest.render as { video?: unknown } | undefined)?.video) {
    const { setupAnimTransport } = await import('../anim-transport.ts');
    (stageEl as HTMLElement & { _animCleanup?: () => void })._animCleanup = setupAnimTransport({
      stageEl,
    });
  }

  // File-input tools: the whole canvas accepts a dropped file - drag-and-drop, or
  // click-to-pick via an explicit [data-file-pick] affordance. In canvas layout the
  // canvas IS the file control; in sidebar layout it complements the sidebar
  // file-picker. The picked file still flows through the normal input model +
  // exportFile hook, so CLI/URL mode are unaffected.
  if (canvasFileInput && contentEl) {
    mountLifecycle.add(
      'canvas file drop',
      setupCanvasFileDrop({
        viewEl,
        contentEl,
        runtime,
        input: canvasFileInput,
        onDirty: tview.session.markUserDirty,
        fileToRef,
        formatBytes: fmtBytes,
      })
    );
  }
  if (canvasDropInput && contentEl) {
    mountLifecycle.add(
      'canvas blocks drop',
      setupCanvasBlocksDrop({
        viewEl,
        contentEl,
        runtime,
        host: tview.host,
        input: canvasDropInput,
        onDirty: tview.session.markUserDirty,
        makeDropper: makeBlocksDropper,
      })
    );
  }

  // Canvas tools can also expose interactive SETTINGS in the template (e.g. a
  // compression level) as ordinary declared inputs. The sidebar - which normally
  // binds inputs to the model - is hidden in canvas layout, so wire any in-canvas
  // control carrying [data-input-id] straight back to runtime.setInput. The values
  // are declared inputs, so URL/CLI parity is automatic (syncUrl writes the dirty
  // param). Bind 'change' (not 'input') so the per-render innerHTML rebuild doesn't
  // fight focus mid-interaction; the template reflects each value so a repaint keeps it.
  if (canvasLayout && contentEl) {
    // Canvas-layout tools have no sidebar, so an asset input must be reachable
    // from the rendered tool itself. A template opts in with
    // data-input-action="pick" + data-input-id="…". Optional declarative
    // follow-ups let a picker switch modes or clear stale hand-drawn data after
    // a successful choice without hard-coding any particular tool here.
    contentEl.addEventListener('click', (e) => {
      const ctl = (e.target as HTMLElement).closest<HTMLElement>(
        '[data-input-action="pick"][data-input-id]'
      );
      if (!ctl) return;
      const id = ctl.dataset.inputId;
      const input = id ? runtime.getModel().find((item) => item.id === id) : undefined;
      if (input?.control !== 'asset-picker') return;
      e.preventDefault();
      void (async () => {
        const before = input.value;
        await tview.popovers.openAssetPickerInline(input);
        const picked = runtime.getModel().find((item) => item.id === id)?.value;
        if (!picked || picked === before) return;
        const clearId = ctl.dataset.clearInput;
        if (clearId) {
          runtime.setInput(clearId, '');
          tview.session.markUserDirty(clearId);
        }
        const activateId = ctl.dataset.activateInput;
        if (activateId) {
          runtime.setInput(activateId, ctl.dataset.activateValue ?? true);
          tview.session.markUserDirty(activateId);
        }
      })();
    });

    contentEl.addEventListener('change', (e) => {
      const ctl = (e.target as HTMLElement).closest<HTMLInputElement>('[data-input-id]');
      if (!ctl) return;
      const id = ctl.dataset.inputId;
      if (!id) return;
      const value =
        ctl.type === 'checkbox'
          ? ctl.checked
          : ctl.type === 'number'
            ? Number(ctl.value)
            : ctl.value;
      runtime.setInput(id, value);
      tview.session.markUserDirty(id);
    });
  }

  const clearBtn = viewEl.querySelector<HTMLButtonElement>('#clear-inputs-btn'); tview.clearBtn = clearBtn as ToolViewCtx['clearBtn'];
  const utils = viewEl.querySelector<HTMLElement>('#sidebar-utils'); tview.utils = utils;
  if (clearBtn && utils) {
    const resetToDefaults = async () => {
      dirtyParams.clear();
      templateSeededIds.clear();
      tview.session.markSessionDirty(); // clearing is an edit - flag unsaved + flash the Save pill
      for (const input of runtime.getModel()) {
        // Revoke a picked file's preview URL before clearing it (avoid a leak).
        const prevUrl = asRow(input.value).url;
        if (input.type === 'file' && prevUrl) URL.revokeObjectURL(prevUrl as string);
        // Reset to the tool's DECLARED default - a real "reset to defaults", so a
        // boolean default:true, default `blocks` rows, a default select/colour/asset
        // all come back. Only fall back to a type-appropriate empty when there is no
        // declared default (files never have one). Previously every non-scalar was
        // forced blank regardless of its default.
        const dflt = input.default as InputValue | undefined;
        const value: InputValue =
          dflt !== undefined && dflt !== null
            ? dflt
            : input.type === 'boolean'
              ? false
              : input.type === 'asset'
                ? null
                : input.type === 'file'
                  ? null
                  : input.type === 'blocks'
                    ? []
                    : '';
        await runtime.setInput(input.id, value);
      }
    };
    // Two-step confirm INLINE + full-width in the sidebar (no centred modal). The
    // #sidebar-utils grid is one column, so the confirm/cancel buttons each span the
    // full width; swapping the button's own container in place moves nothing else.
    // The armed confirm is destructive AND persists (its #sidebar-utils host isn't
    // re-rendered by edits), so it must be dismissible passively - Escape, an outside
    // click, or a timeout - mirroring the block-remove two-step confirm's disarm.
    let disarmTimer: ReturnType<typeof setTimeout> | undefined;
    const restore = (): void => {
      utils.classList.remove('is-confirming');
      document.removeEventListener('pointerdown', onOutside, true);
      document.removeEventListener('keydown', onKey, true);
      if (disarmTimer) clearTimeout(disarmTimer);
      utils.replaceChildren(clearBtn);
    };
    const onOutside = (e: PointerEvent) => {
      if (!utils.contains(e.target as Node | null)) restore();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        restore();
      }
    };
    clearBtn.addEventListener('click', () => {
      utils.classList.add('is-confirming');
      utils.innerHTML =
        `<button type="button" class="clear-inputs-confirm">${t('Reset to defaults')}</button>` +
        `<button type="button" class="clear-inputs-cancel">${t('Cancel')}</button>`;
      utils.querySelector('.clear-inputs-confirm')!.addEventListener('click', async () => {
        restore();
        await resetToDefaults();
      });
      utils.querySelector('.clear-inputs-cancel')!.addEventListener('click', restore);
      (utils.querySelector('.clear-inputs-cancel') as HTMLElement | null)?.focus();
      setTimeout(() => document.addEventListener('pointerdown', onOutside, true), 0); // skip the arming click
      document.addEventListener('keydown', onKey, true);
      disarmTimer = setTimeout(restore, 6000);
    });
  }
}

export function setupOps(tview: ToolViewCtx) {
  return {
    guardNetworkAndSeed: bindOp(tview, guardNetworkAndSeed),
    seedDirect: bindOp(tview, seedDirect),
    templatePick: bindOp(tview, templatePick),
    documentSurface: bindOp(tview, documentSurface),
    wrapSetInput: bindOp(tview, wrapSetInput),
    stableRowIds: bindOp(tview, stableRowIds),
    wireActionsPanel: bindOp(tview, wireActionsPanel),
    mountActions: bindOp(tview, mountActions),
    wireBulkRows: bindOp(tview, wireBulkRows),
    wireBackPill: bindOp(tview, wireBackPill),
    mountLiveControls: bindOp(tview, mountLiveControls),
  };
}
