// SPDX-License-Identifier: MPL-2.0
/**
 * tool view: undo/redo history, design intent, toolbar slots.
 *
 * Every function takes the shared `tview: ToolViewCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `tview.<module>.<fn>`. Extracted verbatim
 * from mountTool() by scripts/split-closure.ts.
 */
import { compileDocument } from '@lolly/engine';
import { modelToValues } from '../../../../../engine/src/inputs.js';
import type { InputValue } from '../../../../../engine/src/inputs.js';
import type { DesignIntent } from '../design-workspace.ts';
import { escape as escapeText } from '../../utils.ts';
import { cloneValue, describeRowChange } from '../tool-history.ts';
import { canBatchTool, singleFileInputId } from '../../capabilities.ts';
import { t, tRaw } from '../../i18n.ts';
import { announce } from '../../a11y.ts';
import type { FilmstripSide } from '../../lib/page-filmstrip.ts';
import { resolveCanvasFastCfg } from '../canvas-scene.ts';
import type { FastPathCfg } from '../canvas-scene.ts';
import { ICON_REDO, ICON_UNDO, isTextEditing, resolveTranscribeSpec } from './shared.ts';
import { bindOp, type ToolViewCtx } from './context.ts';

export const setDesignIntent = (tview: ToolViewCtx, intent: DesignIntent, pickDefault = false): void => {
  const { toolId } = tview;
  if (toolId !== 'design') return;
  tview.designIntent = intent;
  tview.refreshDesignExperience(pickDefault);
};
export const compileForSurface = async (tview: ToolViewCtx, inputs: Record<string, unknown> = {}) =>
  { const { runtime } = tview; return (
    await compileDocument(tview.tool, { ...modelToValues(runtime.getModel()), ...inputs } as never, {
      host: tview.host,
    })
  ).document; };
// Gesture continuity for coalescing, tracked SEPARATELY from stack entries: an
// undo/redo leaves an old entry on top still carrying its original time, so if we
// keyed coalescing off the entry the next edit could wrongly merge into it (losing
// a state). applyHistory resets this, so a post-undo edit always starts fresh.
export const refreshHistoryUI = (tview: ToolViewCtx) =>
  { const { inputHistory } = tview; return tview.historyControls?.sync(inputHistory.canUndo(), inputHistory.canRedo()); };
/**
 * What the undo/redo toast calls this edit (plans/179 A16). The input's own name is
 * the LAST resort, not the first: "Undid Boxes" names the slot that was written, which
 * is never what the user just did. `describeRowChange` reads the two values of a
 * blocks/canvas array and names the gesture where it honestly can - Add, Delete, Move,
 * Resize, Rotate, or the one field's own label in the user's language - and answers
 * null for everything else, where the input label is the truthful answer it always was.
 */
export const changeLabel = (_tview: ToolViewCtx, 
  item: {
    id: string;
    label?: string;
    fields?: Array<{ id?: string; label?: string }>;
    canvas?: Record<string, unknown>;
  },
  before: InputValue,
  after: InputValue
): string => {
  const fallback = item.label || item.id;
  const cvs = (item.canvas || {}) as Record<string, unknown>;
  const str = (k: string): string | undefined =>
    typeof cvs[k] === 'string' ? (cvs[k] as string) : undefined;
  const ch = describeRowChange(before, after, {
    xField: str('xField'),
    yField: str('yField'),
    wField: str('wField'),
    hField: str('hField'),
    rotationField: str('rotationField'),
  });
  if (!ch) return fallback;
  switch (ch.kind) {
    case 'add':
      return t('Add');
    case 'delete':
      return t('Delete');
    case 'move':
      return t('Move');
    case 'resize':
      return t('Resize');
    case 'rotate':
      return t('Rotate');
    default:
      break;
  }
  const f = (item.fields || []).find((x) => x?.id === ch.field);
  return f?.label ? t(f.label) : fallback;
};
export const applyHistory = (tview: ToolViewCtx, id: string, value: InputValue) => {
  const { inputHistory, runtime } = tview;
  tview.applyingHistory = true;
  inputHistory.endGesture(); // an undo/redo ends any gesture - the next edit starts a new step
  try {
    runtime.setInput(id, cloneValue(value));
  } finally {
    tview.applyingHistory = false;
  }
};
export const undoHistory = (tview: ToolViewCtx) => {
  const { inputHistory } = tview;
  const entry = inputHistory.undo();
  if (!entry) {
    showHistoryToast(tview, { empty: 'undo' });
    return;
  }
  applyHistory(tview, entry.id, entry.before);
  showHistoryToast(tview, { kind: 'undo', label: entry.label });
  refreshHistoryUI(tview);
};
export const redoHistory = (tview: ToolViewCtx) => {
  const { inputHistory } = tview;
  const entry = inputHistory.redo();
  if (!entry) {
    showHistoryToast(tview, { empty: 'redo' });
    return;
  }
  applyHistory(tview, entry.id, entry.after);
  showHistoryToast(tview, { kind: 'redo', label: entry.label });
  refreshHistoryUI(tview);
};
// Transient bottom-centre toast confirming what was undone/redone, with a
// one-tap counter-action (Redo after an undo, and vice-versa) - that button
// doubles as the redo path on touch, where there's no keyboard. Reuses
// announce() for the screen-reader side (the toast itself is aria-hidden to
// avoid a double read). A single reused element; the timer resets on each call.
export const showHistoryToast = (tview: ToolViewCtx, {
  kind,
  label,
  empty,
}: {
  kind?: 'undo' | 'redo';
  label?: string;
  empty?: 'undo' | 'redo';
}) => {
  if (!tview.historyToastEl) {
    tview.historyToastEl = document.createElement('div');
    tview.historyToastEl.className = 'toast';
    tview.historyToastEl.setAttribute('aria-hidden', 'true');
    document.body.appendChild(tview.historyToastEl);
  }
  const el = tview.historyToastEl;
  const wasVisible = el.classList.contains('is-visible');
  clearTimeout(tview.historyToastTimer);
  if (empty) {
    el.classList.add('is-muted');
    const emptyMsg = empty === 'undo' ? t('Nothing to undo') : t('Nothing to redo');
    el.innerHTML = `<span class="toast-message">${emptyMsg}</span>`;
    announce(emptyMsg);
  } else {
    el.classList.remove('is-muted');
    const verb = kind === 'undo' ? t('Undid') : t('Redid');
    const counter = kind === 'undo' ? t('Redo') : t('Undo');
    el.innerHTML =
      `<span class="toast-icon" aria-hidden="true">${kind === 'undo' ? ICON_UNDO : ICON_REDO}</span>` +
      `<span class="toast-message">${verb}<span class="toast-label"> ${escapeText(String(label))}</span></span>` +
      // tabindex=-1: the toast is aria-hidden (announce() drives SR) so this button
      // must not become a phantom tab stop; it stays pointer-clickable for touch/mouse.
      `<button type="button" class="toast-action" tabindex="-1">${counter}</button>`;
    el.querySelector('.toast-action')!.addEventListener('click', () => {
      kind === 'undo' ? redoHistory(tview) : undoHistory(tview);
    });
    announce(tRaw('{verb} {label}', { verb, label: String(label) }));
  }
  // Animate the slide-in only when coming from hidden; if it's already showing
  // (rapid undo/redo), just swap the content and reset the timer - no flicker.
  if (!wasVisible) void el.offsetWidth; // flush the base state so the transition plays
  el.classList.add('is-visible');
  tview.historyToastTimer = setTimeout(() => el.classList.remove('is-visible'), empty ? 1400 : 2200);
};
export const onHistoryKey = (tview: ToolViewCtx, e: KeyboardEvent) => {
  if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
  const k = e.key.toLowerCase();
  const redo = k === 'y' || (k === 'z' && e.shiftKey);
  const undo = k === 'z' && !e.shiftKey;
  if (!undo && !redo) return;
  // Free-text fields keep their own per-character undo; sliders, selects,
  // colours and checkboxes have no useful native undo, so we own those.
  if (isTextEditing() || document.querySelector('dialog[open]')) return;
  e.preventDefault();
  redo ? redoHistory(tview) : undoHistory(tview);
};
// Authors can declare a live Handlebars summary (manifest.a11yLabel); otherwise
// it's "<name> preview". Kept current in the render subscriber below.
export const canvasLabel = (tview: ToolViewCtx): string => {
  const { runtime } = tview;
  if (!tview.tool.manifest.a11yLabel) return tRaw('{name} preview', { name: tview.tool.manifest.name });
  // Handlebars HTML-escapes {{values}}; an aria-label is plain text, so decode
  // the entities back (it's set via setAttribute, not innerHTML).
  const custom = runtime
    .getHydratedString(tview.tool.manifest.a11yLabel)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(?:39|x27);/g, "'")
    .trim();
  return custom || tRaw('{name} preview', { name: tview.tool.manifest.name });
};
export const fieldsWere = (_tview: ToolViewCtx, n: number): string => (n > 1 ? t('fields were') : t('field was'));
export const mountToolbarSlots = (tview: ToolViewCtx): void => {
  tview.placeRenderPill?.();
};
/** History keys, the collab session and its presence. */
export function wireHistory(tview: ToolViewCtx): void {
  const { runtime, urlNostage } = tview;
  window.addEventListener('keydown', tview.history.onHistoryKey);

  const nativeW = tview.tool.manifest.render.width; tview.nativeW = nativeW;
  const nativeH = tview.tool.manifest.render.height; tview.nativeH = nativeH;
  const hasInputs = (tview.tool.manifest.inputs?.length ?? 0) > 0; tview.hasInputs = hasInputs;
  const noExport = tview.tool.manifest.render.export === false; tview.noExport = noExport;
  // Whether /batch can run this template - the batch's own admission test, kept in
  // capabilities.ts so both halves of it live next to `toolSupport` rather than being
  // restated here (views/* must not pull in the pro/ folder, which owns its stylesheet).
  const canBulk = canBatchTool(tview.tool.manifest, tview.host.capabilities); tview.canBulk = canBulk;
  // plans/147 M2 "Bulk from files": a transform tool (exportFile) with one single
  // file input can loop that path over N picked files into one zip. runtime exists
  // by here (created above), so hasExportFile is a real answer, not a guess.
  const bulkFilesId = runtime.hasExportFile ? singleFileInputId(tview.tool.manifest) : null; tview.bulkFilesId = bulkFilesId;
  // Transcribe (engine 1.150, render.transcribe): the tool names an audio/video
  // input and a text input, and the shell owns everything between them - consent
  // for the one-time model download, the background job, and one undoable write.
  // Feature-detected, never capability-gated: audio never leaves the device, and a
  // shell without on-device speech (the CLI) simply mounts nothing. Both named
  // inputs must exist, or the declaration is a typo and the button would write
  // nowhere.
  const transcribeSpec = resolveTranscribeSpec(tview.tool, tview.host); tview.transcribeSpec = transcribeSpec as ToolViewCtx['transcribeSpec'];
  // Whether this tool persists a saved session - drives the Save half of the
  // render pill. Mirrors renderActions: the default action set includes 'save',
  // and an explicit empty actions list (opted-out file utilities) excludes it.
  const canSaveSession = (tview.tool.manifest.render.actions ?? ['copy', 'download', 'save']).includes(
    'save'
  ); tview.canSaveSession = canSaveSession;
  // An on-device transform tool (export:false with an explicit empty actions list,
  // or no inputs) gets an EMPTY popup body from renderActions - so don't emit the
  // Export pill or the overlay shell at all; a header that expands to nothing
  // reads as broken chrome.
  const exportUiEmpty =
    noExport &&
    ((Array.isArray(tview.tool.manifest.render.actions) && tview.tool.manifest.render.actions.length === 0) ||
      !hasInputs); tview.exportUiEmpty = exportUiEmpty;
  // Visitor page: `?nostage` on a NO-EXPORT tool. For these utilities the link
  // is the product (a jump page, a countdown), so a shared link opens as a plain
  // full-width webpage - normal document flow, no stage frame, no zoom HUD, no
  // sidebar, no pills - while the bare tool URL stays the editing preview. For
  // exportable tools `nostage` keeps its export-panel meaning (the html "Full
  // page" pre-check above) and none of this engages.
  const visitorPage = urlNostage && noExport; tview.visitorPage = visitorPage;
  const canvasLayout = tview.tool.manifest.render.layout === 'canvas'; tview.canvasLayout = canvasLayout;
  // The WYSIWYG "editor" layout: a chromeless full-canvas surface (no input
  // sidebar) that KEEPS the fixed render canvas + the full render/export
  // scaffolding, so it exports like a normal tool. The direct-manipulation overlay
  // (select / drag / resize / rotate / z-order / align) is mounted below.
  const editorLayout = tview.tool.manifest.render.layout === 'editor'; tview.editorLayout = editorLayout;
  // The blocks input the editor manipulates directly (carries the `canvas` flag).
  const canvasEditInput = editorLayout
    ? tview.tool.manifest.inputs?.find((i) => i.type === 'blocks' && i.canvas)
    : null; tview.canvasEditInput = canvasEditInput;
  // Geometry paint fast-skip (plans/98 section 9) - OFF by default, opt-in via ?canvasfastpath=1 so
  // the served-app harness proves exported-SVG byte-parity before it is enabled for everyone.
  const fastPathOn =
    editorLayout &&
    !!canvasEditInput &&
    typeof location !== 'undefined' &&
    /[?&]canvasfastpath=1\b/.test(location.href); tview.fastPathOn = fastPathOn;
  const fastCfgPaint: FastPathCfg | null =
    fastPathOn && canvasEditInput?.canvas
      ? resolveCanvasFastCfg(canvasEditInput.canvas as Record<string, unknown>)
      : null; tview.fastCfgPaint = fastCfgPaint;
  // Multi-page ("carousel") editor: an editor-layout tool whose canvas is a horizontal
  // strip of N same-size [data-pdf-page] frames (render.pages). The overlay places boxes
  // across all frames; export fans out to a multi-page PDF or one still image per page.
  const pagesCfg = editorLayout && canvasEditInput ? tview.tool.manifest.render.pages : undefined; tview.pagesCfg = pagesCfg;
  const pagesMode = !!pagesCfg; tview.pagesMode = pagesMode;
  // Frame-primitive editor (plan 93 F1b): an editor-layout tool whose canvas block
  // declares `frameField` (Design). kind:'frame' boxes render as free-placed
  // [data-pdf-page] pages and the overlay drives frame-local drag + containment-on-drop.
  // The fields live on the blocks input's `canvas`, not on render.*; null for every tool
  // without a frameField so the overlay's frame-aware paths stay dead.
  const frameCanvas = (
    canvasEditInput as {
      canvas?: {
        frameField?: string;
        frameKind?: string;
        orderField?: string;
        clipChildrenField?: string;
        frameTransitionField?: string;
        hiddenField?: string;
        lockedField?: string;
      };
    } | null
  )?.canvas; tview.frameCanvas = frameCanvas as ToolViewCtx['frameCanvas'];
  const frameCfg =
    editorLayout && frameCanvas?.frameField
      ? {
          frameField: frameCanvas.frameField,
          frameKind: frameCanvas.frameKind || 'frame',
          orderField: frameCanvas.orderField,
          clipChildrenField: frameCanvas.clipChildrenField,
          // The M4 declarations (plans/179): a slide's own transition to the next one, and the
          // two layer flags. Each is optional, so a canvas that declares none keeps every
          // frame-aware path exactly as it was.
          transitionField: frameCanvas.frameTransitionField,
          hiddenField: frameCanvas.hiddenField,
          lockedField: frameCanvas.lockedField,
        }
      : undefined; tview.frameCfg = frameCfg;
  // A fixed-size editor canvas (no resize control): the canvas input opts in via
  // canvas.fixedCanvas. Connector tools (Org Chart) set this so their rendered
  // connector <svg>'s viewBox stays 1:1 with box coordinates (a resized canvas would
  // scale the lines away from the boxes). Treated like carousel mode for sizing.
  const fixedCanvasMode = !!(
    canvasEditInput &&
    (canvasEditInput as { canvas?: { fixedCanvas?: boolean } }).canvas?.fixedCanvas
  ); tview.fixedCanvasMode = fixedCanvasMode;
  // Will the Design chrome (top bar + the two side columns, plan 179 M1-M3) mount? The
  // same predicate the overlay block below is gated on, minus the two DOM lookups that
  // cannot happen until the template has painted - so the render can already move the
  // Home pill into the bar, and a layout:'editor' tool that declares no canvas blocks
  // input keeps the free-floating corner pill it has always had.
  const designChrome = editorLayout && !!canvasEditInput; tview.designChrome = designChrome;
  // The multi-page rich-text document layout (render.layout:'document', e.g. Doc
  // Studio): chromeless like 'editor', but mounts a TipTap rich-document editor
  // (doc-editor.js) over the tool's `content` input, which stores the document as
  // portable ProseMirror JSON. The engine hook renders that JSON into paged
  // [data-pdf-page] boxes, so export / CLI / previews work without the editor.
  const documentLayout = tview.tool.manifest.render.layout === 'document'; tview.documentLayout = documentLayout;
  const docEditInput = documentLayout
    ? (tview.tool.manifest.inputs?.find((i) => i.id === 'content') ??
      tview.tool.manifest.inputs?.find((i) => i.type === 'blocks'))
    : null; tview.docEditInput = docEditInput;
  // The slide-deck editor layout (render.layout:'deck', e.g. Deck Builder). UNLIKE
  // editor/document it is deliberately NOT chromeless: the input sidebar stays as the home
  // for the long-tail fields (per-slide layout / media slots / notes, deck-level timing),
  // and the on-canvas overlay (deck-editor.ts) is mounted ON TOP of the live canvas for the
  // primary flow (edit text/colour/images in place, thumbnail-rail navigation). It edits a
  // `blocks` input whose rows are slides.
  const deckLayout = tview.tool.manifest.render.layout === 'deck'; tview.deckLayout = deckLayout;
  const deckEditInput = deckLayout ? tview.tool.manifest.inputs?.find((i) => i.type === 'blocks') : null; tview.deckEditInput = deckEditInput;
  // Both chromeless full-canvas layouts drop the input aside but keep the fixed render
  // canvas + export controls; the on-canvas overlay replaces the sidebar. The 'deck' layout
  // is intentionally excluded - it keeps the sidebar.
  const chromeless = editorLayout || documentLayout; tview.chromeless = chromeless;
  // A full-bleed utility whose template IS the whole interface and whose canvas is a
  // live preview (e.g. Run Web Code: a code editor + sandboxed preview that exports a
  // snapshot). It drops the input aside like a canvas utility, but unlike a plain
  // no-input+no-export tool it KEEPS the render/export pill. Two ways to qualify:
  //   • NO declared inputs (the original case - without this a no-input tool regressed
  //     into an empty sidebar squashing the editor the moment its manifest turned export on);
  //   • declared inputs with `render.sidebar:false` - the tool declares inputs so they
  //     ride the synced model (URL / collab / saved sessions / CLI) but owns their editing
  //     UI on the canvas itself, so the aside is suppressed. The declared inputs are a pure
  //     DATA channel: the template must NOT reference them (byte-constant hydrated output →
  //     paint() skips its innerHTML rebuild → the live editor DOM survives every commit),
  //     and the tool reads/writes them through the per-canvas channel (attachCanvasCommit).
  const sidebarOptOut = tview.tool.manifest.render.sidebar === false; tview.sidebarOptOut = sidebarOptOut;
  const bareExport = (!hasInputs || sidebarOptOut) && !noExport && !canvasLayout && !chromeless; tview.bareExport = bareExport;
  // Hide the sidebar for pure-canvas utilities: no inputs at all, an explicit canvas
  // layout - where the tool's single file input becomes a drag-and-drop / click-to-pick
  // zone on the canvas itself (setupCanvasFileDrop) - or a bareExport full-bleed tool.
  // NOTE: editorLayout is deliberately NOT hideSidebar - it needs the live canvas
  // node + export UI. It only removes the input aside (via showAside below).
  const hideSidebar = (noExport && !hasInputs) || canvasLayout || bareExport; tview.hideSidebar = hideSidebar;
  // A standard sidebar tool whose template stacks several [data-pdf-page] boxes
  // (render.paged - e.g. multi-page-pdf). Unlike the editorLayout carousel (pagesMode,
  // pages side-by-side) it renders through the ordinary render path; the difference is
  // purely how the STAGE presents it - the whole document laid out at full length in a
  // vertical scroll surface, rather than one page's worth clipped with an inner scroll.
  // The one-page sizing of each box is kept (that's what export reads); it just stops
  // bounding what the editor shows. Excludes the chromeless editor/document layouts,
  // which own their own canvas presentation.
  // A no-export web-page tool (render.webPreview - jump, countdown): the preview
  // is a real viewport, not a scaled artboard. It rides the paged plumbing (the
  // scrolling surface, no zoom HUD) but skips the zoom fit entirely: the canvas
  // fills the pane's width and REFLOWS as the pane resizes, so dragging the
  // sidebar edge is the browser-window test a visitor's device would give.
  const webDoc =
    (tview.tool.manifest.render as { webPreview?: boolean }).webPreview === true &&
    noExport &&
    !chromeless &&
    !hideSidebar; tview.webDoc = webDoc;
  const pagedDoc = (tview.tool.manifest.render.paged === true || webDoc) && !chromeless && !hideSidebar; tview.pagedDoc = pagedDoc;
  // Which edge the slide-sorter rail runs along. Left (a vertical rail) suits tall
  // documents; "bottom" is the deck-strip shape for tools whose pages are wide and few,
  // where a left rail would eat the width the page needs. Unknown values fall back to
  // the default rather than producing a rail nothing styles.
  const filmstripSide: FilmstripSide =
    tview.tool.manifest.render.filmstrip === 'bottom' ? 'bottom' : 'left'; tview.filmstripSide = filmstripSide;
  // Whether the input aside is present. Chromeless modes drop it but aren't hideSidebar.
  const showAside = !hideSidebar && !chromeless && !visitorPage; tview.showAside = showAside;
  const noAside = !showAside; tview.noAside = noAside; // no visible input aside (hidden-canvas OR editor)
  // The one declared file input presented as a full-canvas drop zone. Canvas-layout
  // utilities have always worked this way; a sidebar tool with a `file` input (e.g.
  // redact) gets the same canvas drop IN ADDITION to its sidebar file-picker, so a
  // file can land on the big surface without hunting for the sidebar control. Click
  // still only opens the picker via an explicit [data-file-pick] affordance.
  const canvasFileInput = tview.tool.manifest.inputs?.find((i) => i.type === 'file') ?? null; tview.canvasFileInput = canvasFileInput as ToolViewCtx['canvasFileInput'];
  // A sidebar tool with a `dropToAdd` blocks input (e.g. logo-wall) also turns its
  // canvas into a drop zone, so a pile of images can be dropped straight onto the
  // (usually empty) preview - not only onto the sidebar list. Canvas-layout file
  // utilities use canvasFileInput above instead, so they're excluded here.
  const canvasDropInput = !canvasFileInput
    ? tview.tool.manifest.inputs?.find(
        (i) =>
          i.type === 'blocks' &&
          i.dropToAdd?.field &&
          (i.fields ?? []).some((f) => f.id === i.dropToAdd!.field && f.type === 'asset')
      )
    : null; tview.canvasDropInput = canvasDropInput as ToolViewCtx['canvasDropInput'];

  // On-device utilities (privacy:'on-device') carry an honest, prominent badge -
  // the user's content is processed locally and never uploaded. It's the single
  // most reassuring thing on screen for someone used to handing files to strangers.
  const onDevice = tview.tool.manifest.privacy === 'on-device'; tview.onDevice = onDevice;
  const privacyBadge = onDevice
    ? `<div class="on-device-badge" title="${escapeText(t('This tool runs entirely in your browser. Your file is never uploaded.'))}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        <span>${t('Runs on your device - nothing is uploaded')}</span>
      </div>`
    : ''; tview.privacyBadge = privacyBadge;

  // Output previews are a single image; file utilities render their actual
  // interface here, so preserve their buttons and fields in the accessibility tree.
  const canvasRole = runtime.hasExportFile ? 'group' : 'img'; tview.canvasRole = canvasRole;
}

export function historyOps(tview: ToolViewCtx) {
  return {
    setDesignIntent: bindOp(tview, setDesignIntent),
    compileForSurface: bindOp(tview, compileForSurface),
    refreshHistoryUI: bindOp(tview, refreshHistoryUI),
    changeLabel: bindOp(tview, changeLabel),
    applyHistory: bindOp(tview, applyHistory),
    undoHistory: bindOp(tview, undoHistory),
    redoHistory: bindOp(tview, redoHistory),
    showHistoryToast: bindOp(tview, showHistoryToast),
    onHistoryKey: bindOp(tview, onHistoryKey),
    canvasLabel: bindOp(tview, canvasLabel),
    fieldsWere: bindOp(tview, fieldsWere),
    mountToolbarSlots: bindOp(tview, mountToolbarSlots),
    wireHistory: bindOp(tview, wireHistory),
  };
}
