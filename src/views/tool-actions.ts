// SPDX-License-Identifier: MPL-2.0
/**
 * Tool view - actions/export subsystem.
 *
 * renderActions builds the export bar (format/size/print/provenance controls) and
 * wires the copy / preview / save / download actions, plus captureThumbnail and the
 * number-scrub behaviour and the format/print helper predicates. Split out of tool.ts
 * (which keeps mountTool + the mount-only helpers).
 *
 * This module never value-imports from ./tool.ts (that would create a runtime
 * cycle) - it only `import type`s the shell-side aliases it needs from there.
 */

import type { ToolManifest } from '../../../../engine/src/loader.js';
import { onExtensionsChanged } from '../lib/extensions.ts';
import { marksToCsv } from '../lib/print-marks-csv.ts';
import { mountActionHistory } from './tool-revision-history.ts';
import type { ActionsApi, ActionsExperience, ExportDefaults, ExportUnscaled, PanelEl, ToolRuntime, WebToolHost } from './tool.ts';
import { c2paDefaultOn } from '../lib/c2pa-policy.ts';
import { extFor, isCmykFmt, isPrintFmt, printEnabled, readBleed, readMarks } from './tool-actions/shared.ts';
import type { ActionsCtx } from './tool-actions/context.ts';
import { savingOps } from './tool-actions/saving.ts';
import { formatRulesOps } from './tool-actions/format-rules.ts';
import { notesOps } from './tool-actions/notes.ts';
import { sequenceOps } from './tool-actions/sequence.ts';
import { audioOps } from './tool-actions/audio.ts';
import { refreshOps } from './tool-actions/refresh.ts';
import { dimsOps } from './tool-actions/dims.ts';
import { preflightOps } from './tool-actions/preflight.ts';
import { videoOps } from './tool-actions/video.ts';
import { copyingOps } from './tool-actions/copying.ts';
import { markupOps } from './tool-actions/markup.ts';
import { wiringOps } from './tool-actions/wiring.ts';


export { captureThumbnail, exportTargetNode, flatExportNode } from './tool-action-helpers.ts';

// Content Credentials default: the shared policy in lib/c2pa-policy.ts (also
// applied by the offscreen batch/zip renderer, so zips sign like this button).
// The C2PA card only renders for C2PA-capable formats, so it's a no-op for
// graphic-less tools. Re-exported below for tool.ts.


// fitCanvas and exportUnscaled are passed in so refreshCanvasPreview and the
// export actions can coordinate with the responsive-scaling logic in mountTool.
function renderActions(
  el: PanelEl | null,
  manifest: ToolManifest,
  runtime: ToolRuntime,
  canvasEl: HTMLElement | null,
  host: WebToolHost,
  fitCanvas: () => void,
  exportUnscaled: ExportUnscaled,
  exportDefaults: ExportDefaults = {},
  onUrlSync: ((key?: string) => void) | null = null,
  playShutter: () => void = () => {},
  fileIntoFolder: string | null = null,
  returnTo = '/',
  initialSlot: string | null = null,
  reachedViaLink = false,
  experience: ActionsExperience = {}
): ActionsApi | undefined {
  const ta = {} as ActionsCtx;
  ta.saving = savingOps(ta);
  ta.formatRules = formatRulesOps(ta);
  ta.notes = notesOps(ta);
  ta.sequence = sequenceOps(ta);
  ta.audio = audioOps(ta);
  ta.refresh = refreshOps(ta);
  ta.dims = dimsOps(ta);
  ta.preflight = preflightOps(ta);
  ta.video = videoOps(ta);
  ta.copying = copyingOps(ta);
  ta.markup = markupOps(ta);
  ta.wiring = wiringOps(ta);
  ta.el = el as ActionsCtx['el'];
  ta.manifest = manifest;
  ta.runtime = runtime;
  ta.canvasEl = canvasEl;
  ta.host = host;
  ta.fitCanvas = fitCanvas;
  ta.exportUnscaled = exportUnscaled;
  ta.exportDefaults = exportDefaults;
  ta.onUrlSync = onUrlSync;
  ta.playShutter = playShutter;
  ta.fileIntoFolder = fileIntoFolder;
  ta.returnTo = returnTo;
  ta.initialSlot = initialSlot;
  ta.reachedViaLink = reachedViaLink;
  ta.experience = experience;

  // The slot this editing session writes to. Seeded from a resumed `?slot=` session,
  // otherwise null until the first save mints one. Every subsequent save (the Save
  // button, the render-pill quick-Save, "Save & leave") reuses it so edits UPDATE the
  // same saved session in place instead of spawning a new one on each save. Without
  // this, re-saving after an edit orphaned a fresh copy in Uncategorised and left the
  // original folder card frozen at its first-save state.
  ta.activeSlot = initialSlot;
  // ta.automaticHistory: assigned later
  // Monotonic save counter - lets the background thumbnail patch in performSave
  // detect that a newer save superseded it (see the generation check there).
  ta.saveGen = 0;

  ta.formatRules.readCanvasBlocks();

  if (manifest.render.export === false) {
    if (!el) return;
    const hasInputs = (manifest.inputs?.length ?? 0) > 0;
    // An explicit empty actions list opts out of the default Save+Share bar - for
    // on-device file utilities that provide their own download button and must
    // NOT persist the user's file bytes to storage (Save would write them to
    // IndexedDB, contradicting the "nothing is stored/uploaded" promise).
    const optedOut = Array.isArray(manifest.render.actions) && manifest.render.actions.length === 0;
    if (!hasInputs || optedOut) {
      el.innerHTML = '';
      return {};
    }
    el.innerHTML = `<div class="export-action-buttons">${ta.saving.saveBtnHtml()}${ta.copyUrlBtn}</div>`;
    el.querySelector<HTMLButtonElement>('[data-action="save"]')!.addEventListener(
      'click',
      async function (this: HTMLButtonElement) {
        const qsFolder = await ta.saving.quickSaveFolder();
        if (await ta.saving.performSave(this, qsFolder ? { folderId: qsFolder } : undefined))
          ta.saving.settleSaveButton(this);
      }
    );
    return { save: ta.saving.performSave, getSlot: () => ta.activeSlot };
  }

  const actions = manifest.render.actions ?? ['copy', 'download', 'save']; ta.actions = actions;
  const exportOpts = runtime
    .getModel()
    .filter((i) => i.group === 'export' && i.control === 'checkbox'); ta.exportOpts = exportOpts;

  ta.formatRules.readDeepExport();
  // A ?format= link or a saved session (exportDefaults.format) is an explicit choice
  // and wins; otherwise follow the upload's format, falling back to the first format.
  const initialFmt =
    exportDefaults.format && ta.formats.includes(exportDefaults.format)
      ? exportDefaults.format
      : ta.formatRules.assetExportFormat() || ta.formats[0]; ta.initialFmt = initialFmt;
  const videoDefaults = (manifest.render.video ?? {}) as { wait?: number; duration?: number }; ta.videoDefaults = videoDefaults;
  // A link's ?wait= / ?seconds= (exportDefaults.video) seed the fields the way ?format= seeds the picker.
  const defaultWait = exportDefaults.video?.wait ?? videoDefaults.wait ?? 1; ta.defaultWait = defaultWait;

  ta.sequence.readSequenceDuration();

  ta.markup.buildFormatOptions();

  ta.markup.buildHdrRow();

  ta.markup.buildPrintAndRows();

  // The panel host (#tool-actions) is present for every export-capable tool that
  // reaches here; guard the type for strict null-safety (never null in practice).
  if (!el) return;

  // The return ticket, taught once (audit 167 F-A11): every export carries its
  // full recipe, and Verify can resurrect the live session from the file alone -
  // the product's deepest retention hook, which nothing in the first-use journey
  // mentioned. One quiet line in the same slot as the details ask, on the first
  // download where that ask didn't run (the ask keeps priority - never two
  // teaching lines on one download). Device-local show-once flag: this is
  // chrome education like the tips strip, not tool or profile state.
  const REOPEN_NOTE_KEY = 'lolly-reopen-note-seen'; ta.REOPEN_NOTE_KEY = REOPEN_NOTE_KEY;

  ta.markup.paintBar();

  ta.wiring.wireFormatAndName();

  ta.sequence.readStillFormats();

  // ── Sequence duration: follow the timeline, yield to the user ──────────────
  // ANDY'S RULE: the exported clip's duration matches the timeline's duration
  // always, UNLESS the user changes it here on export. This flag is the "unless":
  // it flips only on a real edit of the Duration field (a programmatic re-sync sets
  // .value directly and dispatches nothing, so it can never set it), and it rides
  // out to the export opts as `durationUserSet` - the tool hook keeps a deliberate
  // user value and overwrites everything else with the derived length.
  // A `seconds` carried by the link is the same deliberate instruction as a typed
  // value, so it starts the flag set and the derived-length re-sync never overrides it.
  ta.durationUserSet = exportDefaults.video?.seconds != null;
  ta.durationEl?.addEventListener('input', () => {
    ta.durationUserSet = true;
  });
  ta.durationEl?.addEventListener('change', () => {
    ta.durationUserSet = true;
  });

  ta.wiring.wireDuration();

  // "Generate music": a transient ZzFXM bed, seeded so the SAME tune deterministically
  // re-renders at any length (export re-renders at the clip's duration). Regenerate
  // rolls a new seed. The draw is the engine's `generatedSongSpec` - the same one a
  // `zzfxm:<seed>` asset id resolves through - so a seed rolled here names the same
  // tune in a share link and in the CLI.
  ta.genSeed = (Math.random() * 0x7fffffff) >>> 0;
  ta.genWavUrl = null; // cached preview WAV blob URL
  ta.genWavKey = '';

  // Audio preview - a play/pause toggle that auditions the selected track before
  // export. A single detached <audio> element (never in the DOM, so it must be
  // paused explicitly on every teardown path - a removed media element keeps
  // playing). The track bytes are resolved lazily on first play via host.assets.get
  // (same on-demand fetch+cache the export uses), and reset whenever the choice
  // changes. Preview plays once at natural length; export still loops to the clip.
  const audioPreviewBtn = el.querySelector<HTMLButtonElement>('[data-action="audio-preview"]'); ta.audioPreviewBtn = audioPreviewBtn as ActionsCtx['audioPreviewBtn'];
  ta.previewAudio = null; // lazily-created HTMLAudioElement
  ta.previewSrcId = null;
  // Regenerate ("new tune") shows only while Generate music is the chosen bed.
  const audioRegenBtn = el.querySelector<HTMLButtonElement>('[data-action="audio-regen"]'); ta.audioRegenBtn = audioRegenBtn as ActionsCtx['audioRegenBtn'];

  ta.audio.wireAudio();

  // The Print marks card auto-opens only for a PRINT-INTENT format (a separating
  // press format, or any print-capable format when the manifest declares
  // render.printMarks: true) and closes for the rest - including the RGB vector
  // formats pdf/svg/eps, which keep the card VISIBLE but off - re-applied on every
  // switch, until the user toggles the master or a link/save set marks explicitly,
  // after which their choice is left alone.
  ta.marksUserSet = Boolean(exportDefaults.bleed || exportDefaults.marks);

  // The embedded-caption box follows the CONTAINER until the user has an opinion
  // (plans/180 section 4): WebM carries a WebVTT track that every WebM player reads,
  // MP4 stores it as `wvtt`, which several Windows players ignore - so MP4 is opt-in
  // and WebM is on. One touch of the checkbox ends the following for this panel, the
  // way marksUserSet ends the print-marks default.
  ta.captionsEmbedUserSet = false;
  el.querySelector<HTMLInputElement>('[data-action="captions-embed"]')?.addEventListener(
    'change',
    () => {
      ta.captionsEmbedUserSet = true;
    }
  );

  ta.wiring.wireFormatChange();

  ta.wiring.readPassword();

  ta.wiring.wirePrint();

  ta.wiring.wireC2pa();
  // Whether the dimension fields still hold their manifest-derived defaults.
  // Seeded true only when a URL param or a restored session supplied the size;
  // flipped by an edit, a scrub, a size-select pick or a unit change. Preflight
  // reads it to tell "the user set this page size" from "this is the tool's own
  // canvas, pre-filled" - the CLI makes exactly the same distinction through
  // `declaredBy`, and without it the two surfaces disagreed on every ordinary tool.
  // `unit` counts as setting the size even on its own: `?unit=mm` with the fields
  // still at the manifest numbers is a REAL 1200 x 900 mm export (exportDims below
  // qualifies the field value with the active unit), so reading it as the tool's
  // pixel canvas would under-report by a factor of twelve.
  ta.sizeUserSet = exportDefaults.width != null ||
    exportDefaults.height != null ||
    (exportDefaults.unit != null && exportDefaults.unit !== 'px');

  // Export-fidelity guard: does the canvas paint anything the chosen format cannot
  // carry? Today that is `backdrop-filter` (frosted glass). Only SVG can express it -
  // the walker rebuilds the backdrop by cloning, clipping and blurring what is behind
  // the panel. Every raster format goes through a DOM serialiser that puts the node in
  // a <foreignObject>, where the backdrop is by definition outside the subtree and the
  // blur is dropped; PDF rasterises the panel through that same path; EMF, EPS and DXF
  // discard every filter that is not a drop shadow. HTML is the live DOM, so it keeps it.
  //
  // Read from the LIVE canvas (computed styles), so a tool that never uses the effect
  // never sees the row, and a box that turns Backdrop blur on gets it immediately.
  const FROST_OK_FORMATS = new Set(['svg', 'html']); ta.FROST_OK_FORMATS = FROST_OK_FORMATS;
  // The second fidelity guard, and the visible half of plans/104 section 12 Q2: a box under a
  // real 3-D pose (a tilted camera, or a per-box perspective tilt) cannot stay vector,
  // because neither SVG nor PDF has a perspective transform. The walkers keep every
  // untilted layer as geometry and embed a per-box raster for the tilted ones - house
  // style degrades visibly, nothing refuses - so this row is the "visibly" part. It says
  // what happened BEFORE the download rather than leaving the user to find a soft edge in
  // the file, which is the same contract the frosted-glass row above has.
  //
  // ⚑ RASTER FORMATS ARE NOT WARNED, and that is a measurement rather than an omission:
  // spike S2 put a per-element `matrix3d` through the same dom-to-image path 20 poses
  // deep and found no geometric error at all (flat-region diff 0.012–0.045/255, ink IoU
  // 0.985–0.993, text marginally sharper than the live compositor). A PNG of a tilted
  // scene is right, so there is nothing to say about it.
  const VECTOR_FORMATS = new Set(['svg', 'pdf', 'pdf-cmyk', 'emf', 'wmf', 'eps', 'dxf']); ta.VECTOR_FORMATS = VECTOR_FORMATS;
  // A sidebar edit can turn the effect on or off (Design's Backdrop blur field),
  // so re-check after every input change as well as on every format change. Cheap: one
  // computed-style pass over the canvas, and only while the export panel is mounted.
  // Registered HERE, below the definition - the format-change handler above is wired
  // earlier in the function and would hit the TDZ if it ran the check eagerly.
  runtime.subscribe(() => ta.dims.updateFidelityWarning());
  ta.dims.updateFidelityWarning();

  ta.preflight.seedPreflightFacts();

  ta.preflight.buildPreflightManifest();
  if (ta.isDesignTool) {
    el.addEventListener('lolly:export-open', ta.preflight.onDesignExportOpen);
    el.addEventListener('lolly:export-close', ta.preflight.onDesignExportClose);
    canvasEl?.addEventListener('lolly-canvas-painted', ta.preflight.onDesignCanvasPaint);
  }

  // ── Cost panel state. All device-local memory, never written to a URL by syncUrl.
  ta.lastCounts = [];
  // The explicit per-device reveal (section 5): a link opens on counts, and money is shown
  // only after the user asks for it here. Never persisted for a confidential card.
  ta.costRevealed = false;
  // Opt-in to expired rates this session (section 5). Never persisted.
  ta.costUseExpired = false;
  // The `cost-authoring` slot is mounted at most once, the first time an authoring
  // extension actually RESOLVES into it (not merely when the container exists).
  // DORMANT by default: with no authoring extension registered, mountSlot leaves
  // the slot container untouched (see lib/extensions.ts), so the panel stays
  // counts-only. Authoring is furniture a channel hydrates; the door is here
  // regardless.
  ta.costSlotMounted = false;
  // The aggregate disposer mountSlot returns - captured so the hydrated extension's
  // teardown (listeners/timers/subscriptions it installed in mount()) actually runs
  // when this panel is destroyed, via the `dispose` on the returned ActionsApi.
  // ta.costSlotDispose: assigned later
  // Re-attempt the mount whenever the registry changes (async bundle delivery).
  // Unsubscribed, and the hydrated extension torn down, in `disposeActions`.
  const costSlotUnsub = onExtensionsChanged(() => ta.preflight.tryMountCostSlot()); ta.costSlotUnsub = costSlotUnsub;

  ta.preflight.definePriceableKinds();

  // Same wiring as updateFidelityWarning, for the same reason: a sidebar edit can
  // change what preflight sees (a paginate source table gaining a row), so re-run
  // on every input change as well as on every format/size/print-setting change.
  // Cheap: one pure synchronous pass over a plain object.
  runtime.subscribe(() => ta.preflight.refreshPreflight());
  ta.preflight.refreshPreflight();

  // ── Artboards are the size truth; the bar mirrors the ACTIVE artboard ────────
  // (plans/142 WP-B). free-canvas fires `fc-artboard` (bubbling from the canvas)
  // whenever the answer changes, carrying the selected artboard (falling back to
  // the primary one) and the artboard under the sequence playhead. The bar shows
  // the one the chosen format will export - still formats follow the selection,
  // animated formats follow the playhead (the video's output frame) - and editing
  // the bar resizes that artboard alone: a w/h edit never moves an origin, so
  // members stay put. A no-frames doc keeps the single-artboard behaviour (the
  // canvas follows the dims).
  const canvasCfg = (ta.canvasBlocksInput as { canvas?: Record<string, unknown> } | undefined)?.canvas; ta.canvasCfg = canvasCfg as ActionsCtx['canvasCfg'];
  const canvasInputId = (ta.canvasBlocksInput as { id?: string } | undefined)?.id; ta.canvasInputId = canvasInputId;
  const artFrameField = typeof canvasCfg?.frameField === 'string' ? canvasCfg.frameField : ''; ta.artFrameField = artFrameField;
  ta.artActive = null;
  canvasEl?.addEventListener('fc-artboard', (e) => {
    ta.artActive = ((e as CustomEvent).detail as typeof ta.artActive) ?? null;
    ta.video.reflectArtboardDims();
  });
  ta.formatEl?.addEventListener('change', () => {
    if (ta.video.hasArtboards()) ta.video.reflectArtboardDims();
  });
  // Deferred-preview tools (manifest.render.preview): a painted preview is only
  // valid for the geometry it was captured at, so any change to the export size,
  // unit or DPI must drop back to the placeholder + its "click to preview"
  // button - exactly as changing a sidebar input does. Re-emitting
  // rebuilds the canvas from the model through the one render path (which clears
  // the painted [data-capture] image). No-op for ordinary tools, whose live
  // canvas is the preview. Format/filename don't change captured pixels, so they
  // leave the preview intact.
  const invalidatePreview = manifest.render.preview ? () => runtime.refresh() : () => {}; ta.invalidatePreview = invalidatePreview;

  // Brief, editor-only outline pulse on the canvas while the export size is being
  // changed (scrub / scroll / type), so a resize reads as deliberate. Applied to
  // the OUTER wrapper - never the exported #tool-canvas - so it can't bleed into
  // output, and removed shortly after the last change; the CSS handles the fade.
  // Re-armed on every change, so a continuous drag holds it on, then it lapses.
  const canvasOuterEl = canvasEl?.closest('.tool-canvas-outer') ?? canvasEl?.parentElement ?? null; ta.canvasOuterEl = canvasOuterEl;
  // ta.dimPulseTimer: assigned later

  ta.wiring.wireCostSlot();

  ta.wiring.wireCostRows();

  ta.dims.wireUnitSelect();

  ta.wiring.wireApprovalAndActions();

  ta.copying.wireSendTargets();

  // Expose actions the mount scope can trigger programmatically (e.g. `?copy`,
  // and the unsaved-changes dialog's "Save & leave"). stopAudioPreview lets the
  // popup-close + tool-teardown paths silence an in-progress audio audition.
  // `sessionState` is the SAME snapshot a save writes, read (never written) by the beam
  // for its `__export_*` markers - the one place they exist outside this panel's DOM.
  ta.automaticHistory = mountActionHistory({
    enabled: experience.localHistory, host, toolId: manifest.id, el, canvas: canvasEl,
    getSlot: () => ta.activeSlot, setSlot: slot => { ta.activeSlot = slot; },
    takeFolder: () => { const folder = ta.fileIntoFolder; ta.fileIntoFolder = null; return folder; },
    snapshot: ta.saving.sessionSnapshot, initial: experience.historyBase,
  });
  return {
    copy: ta.copying.performCopy,
    preview: ta.copying.preview,
    save: ta.saving.performSave,
    setDims: ta.video.setDims,
    setFormat: ta.video.setFormat,
    setFormats: ta.video.setFormats,
    setExperience: ta.video.setExperience,
    stopAudioPreview: ta.audio.stopAudioPreview,
    sessionState: ta.saving.sessionSnapshot,
    getSlot: () => ta.activeSlot,
    history: ta.automaticHistory,
    dispose: ta.preflight.disposeActions,
    // Release the last export's retained file (plans/236). The tool view registers
    // this on its mount lifecycle, so leaving the view frees the bytes.
    releaseDelivery: (): void => {
      ta.deliveryUnmount?.(); ta.deliveryUnmount = null;
      ta.deliveryResult?.dispose(); ta.deliveryResult = null;
    },
  };
}

export {
  c2paDefaultOn,
  extFor,
  isCmykFmt,
  isPrintFmt,
  marksToCsv,
  printEnabled,
  readBleed,
  readMarks,
  renderActions,
};
