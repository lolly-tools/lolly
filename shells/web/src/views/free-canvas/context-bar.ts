// SPDX-License-Identifier: MPL-2.0
/**
 * free-canvas: the selection context bar - kinds, colour and keyframe rows, camera wheel, inspector, rebuild.
 *
 * Every function takes the shared `fc: FcCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `fc.<module>.<fn>`. Extracted verbatim
 * from initFreeCanvas() by scripts/split-closure.ts.
 */
import type { Box } from '../free-canvas-math.ts';
import { boxOutlineKind } from '../vector-ops.ts';
import { announce } from '../../a11y.ts';
import { escape as escapeText } from '../../utils.ts';
import { t } from '../../i18n.ts';
import { colorFieldHtml, colorVarLabel, resolveColorVar, wireColorField } from '../../components/color-field.ts';
import { icon as uiIcon } from '../../lib/icons.ts';
import { SVG, icon } from '../free-canvas-icons.ts';
import { createStylePreview, type StylePreview } from '../free-canvas-style-preview.ts';
import { bindOp, type FcCtx } from './context.ts';

// ── contextual bar ───────────────────────────────────────────────────────────

/** Is every selected box a vector path box? Stroke paint only means something there -
 *  every other kind is a styled div, whose "border" is a different mechanism entirely -
 *  so a mixed selection gets no stroke controls rather than controls that write a field
 *  half the selection ignores. */
export function selectionAllPaths(fc: FcCtx, boxes: Box[], idx: number[]): boolean {
  const { vectorCfg } = fc;
  if (!vectorCfg || !idx.length) return false;
  return idx.every((i) => boxOutlineKind(boxes[i], vectorCfg!) === 'path');
}
/** The kind a row declares, or '' for a tool whose boxes carry none. */
export const kindOf = (fc: FcCtx, b: Box | undefined): string => { const { cfg } = fc; return String(b?.[cfg.kindField] ?? ''); };
/** Does EVERY selected row's kind belong to `kinds`? (A mixed selection gets the
 *  control only when all of it can honour the write - the `selectionAllPaths` rule.) */
export function selectionAllKinds(fc: FcCtx, boxes: Box[], idx: number[], kinds: ReadonlySet<string>): boolean {
  if (!idx.length) return false;
  return idx.every((i) => {
    const k = kindOf(fc, boxes[i]);
    return !k || kinds.has(k);
  });
}
/** Does EVERY selected row's kind stay OUT of `kinds`? The deny-list twin of
 *  {@link selectionAllKinds}; the empty kind is never in a deny set, so it passes. */
export function selectionNoKinds(fc: FcCtx, boxes: Box[], idx: number[], kinds: ReadonlySet<string>): boolean {
  if (!idx.length) return false;
  return idx.every((i) => !kinds.has(kindOf(fc, boxes[i])));
}
/**
 * The element whose cascade resolves a `var()` colour: the tool's own canvas, where
 * the brand vars are installed. `#tool-canvas` is the shell's id for it; the overlay's
 * `canvasEl` IS that element in the app and a bare div in a test harness, so this reads
 * the id first and falls back to what the overlay was handed.
 */
export function colorScope(fc: FcCtx): Element | null {
  const { canvasEl } = fc;
  return (
    (typeof document !== 'undefined' ? document.getElementById('tool-canvas') : null) ?? canvasEl
  );
}
/**
 * One colour field's SEED (plan 179 A2). A stored `var(--brand-primary, #0b1220)` is
 * resolved through the canvas's computed style so the swatch, the sliders and the value
 * field all show the colour the artboard is actually painted, and the token's own name
 * ("Primary") rides along on the trigger.
 *
 * The MODEL is not touched. Nothing here writes; the `var()` survives in the box until
 * the user picks a different colour, at which point the picker stores whatever it
 * always stored.
 */
export function colorSeed(fc: FcCtx, raw: unknown): { value: string; name: string } {
  const s = raw == null ? '' : String(raw);
  return { value: resolveColorVar(s, colorScope(fc)), name: colorVarLabel(s) };
}
/** `colorFieldHtml` with the var() resolution applied - every seed in the editor.
 *  A function declaration, not a const: `buildToolbar` runs before this line does. */
export function seededColorField(fc: FcCtx, id: string, raw: unknown): string {
  const s = colorSeed(fc, raw);
  return colorFieldHtml(id, s.value, { float: true, name: s.name });
}
/**
 * The PAINT section of a contextual bar: fill, text colour, and - for any kind that
 * renders a stroke - stroke colour plus the button onto the rest of the stroke (width,
 * style, ends, corners, fill rule).
 *
 * Shared by the object bar and the pen's node-editing bar because the pen bar REPLACES
 * `ctxbar.innerHTML`: without sharing, every paint control vanished at exactly the moment
 * the user was shaping the thing they wanted to paint. Composed rather than appended so
 * each bar keeps deciding its own order.
 *
 * `allPaths` still gates the PATH-only half (a path has no text ink and no gradient
 * fill); `allStroked` - which every path also satisfies - gates the stroke pair, so an
 * artboard's baked 2px border is finally removable from the canvas that drew it.
 */
export function paintCtxHtml(fc: FcCtx, first: Box, allPaths: boolean, allStroked: boolean = allPaths): string {
  const { cfg } = fc;
  const fillVal = cfg.fillField ? first[cfg.fillField] || 'transparent' : '';
  const fgVal = cfg.textColorField ? first[cfg.textColorField] || '#0c322c' : '#0c322c';
  const strokeVal = cfg.strokeField ? first[cfg.strokeField] || 'transparent' : 'transparent';
  // While a gradient is being edited on the canvas, the SAME field edits the
  // selected stop's colour instead of the flat fill - so the brand swatch palette
  // (the whole reason to reuse this control) is one click from every stop.
  const gradOn = fc.gradEdit != null;
  const fillTitle = gradOn ? t('Gradient stop colour') : t('Fill');
  const fillShown = gradOn ? (fc.gradient.gradStopColor(first) ?? fillVal) : fillVal;
  return (
    (cfg.fillField
      ? `<span class="fc-cfield" data-tip="${escapeText(fillTitle)}">${seededColorField(fc, 'fc-fill', fillShown)}</span>`
      : '') +
    (cfg.gradField && !allPaths
      ? `<button type="button" class="fc-cbtn${gradOn ? ' is-on' : ''}" data-cx="grad" aria-pressed="${gradOn}" data-tip="${escapeText(t('Gradient - drag the stops on the canvas'))}" aria-label="${escapeText(t('Gradient fill'))}">${icon(SVG.gradIc)}</button>`
      : '') +
    (cfg.textColorField && !allPaths
      ? `<span class="fc-cfield" data-tip="${escapeText(t('Text colour'))}">${seededColorField(fc, 'fc-fg', fgVal)}</span>`
      : '') +
    (allStroked && cfg.strokeField
      ? `<span class="fc-cfield" data-tip="${escapeText(t('Stroke colour'))}">${seededColorField(fc, 'fc-stroke', strokeVal)}</span>`
      : '') +
    (allStroked
      ? `<button type="button" class="fc-cbtn" data-cx="stroke" data-tip="${escapeText(t('Stroke - width, style, ends, corners, fill rule'))}" aria-label="${escapeText(t('Stroke options'))}">${icon(SVG.strokeIc)}</button>`
      : '')
  );
}
/**
 * A colour DRAG in one bar's picker: a pointer pressed inside a popover, until it comes
 * up. While it lasts, a colour is shown on the selected elements (`preview`) and the
 * model hears about it once, on release (`commit`). Where an element cannot show the
 * colour on its own (a vector path, a gradient stop, a border not drawn yet), the drag
 * writes the model live instead, at most once a frame (`live`), and the held pointer
 * keeps those writes one undo step.
 */
interface PaintDrag {
  /** Where the colour shows during this drag, decided by its first change: a CSS
   *  property per element, or null to write the model live. */
  targets: Array<[HTMLElement, string]> | null | undefined;
  preview: StylePreview;
  /** The write the release makes, when the drag previews. */
  commit: (() => void) | null;
  /** A live write waiting for its frame, when the drag cannot preview. */
  live: (() => void) | null;
  /** Run `live` on the next frame. */
  schedule(): void;
  /** The pointer came up: take the preview off, then make the one write. */
  end(): void;
}
const paintDrags = new WeakMap<HTMLElement, PaintDrag>();
const dragScopes = new WeakSet<HTMLElement>();

/**
 * The elements that can show `field` without the model, and the CSS property that
 * does, for every selected row - or null when any of them cannot. Mirrors `boxCss` and
 * `textCss` in community/_shared/design-renderer.js for the kinds it names; every other
 * kind takes the live path rather than a guess.
 */
function paintPreviewTargets(fc: FcCtx, field: string): Array<[HTMLElement, string]> | null {
  const { cfg } = fc;
  const boxes = fc.select.getBoxes();
  const idx = fc.select.selIndices(boxes);
  if (!idx.length) return null;
  const out: Array<[HTMLElement, string]> = [];
  for (const i of idx) {
    const b = boxes[i]!;
    const kind = String(b[cfg.kindField] ?? '');
    const el = fc.stage.liveBoxEl(fc.select.idOf(b, i));
    if (!el) return null;
    if (field === cfg.fillField && ['box', 'text', 'image', 'frame'].includes(kind)) {
      out.push([el, 'background-color']);
    } else if (field === cfg.textColorField && (kind === 'box' || kind === 'text')) {
      const text = el.querySelector<HTMLElement>(':scope > .lolly-box-text');
      if (!text) return null;
      out.push([text, 'color']);
    } else if (field === cfg.strokeField && ['box', 'text', 'image'].includes(kind)
      && Number(b[cfg.strokeWField]) > 0 && String(b[field] ?? '').trim() !== '') {
      out.push([el, 'border-color']);
    } else return null;
  }
  return out;
}

function startPaintDrag(scope: HTMLElement): PaintDrag {
  let frame = 0;
  const drag: PaintDrag = {
    targets: undefined, preview: createStylePreview(), commit: null, live: null,
    schedule() {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const run = drag.live;
        drag.live = null;
        run?.();
      });
    },
    end() {
      if (paintDrags.get(scope) !== drag) return;
      paintDrags.delete(scope);
      document.removeEventListener('pointerup', drag.end, true);
      document.removeEventListener('pointercancel', drag.end, true);
      window.removeEventListener('blur', drag.end);
      // The preview comes off before the commit, so the paint that follows compares
      // the canvas with the template it was drawn from.
      drag.preview.restore();
      const last = drag.live ?? drag.commit;
      drag.live = drag.commit = null;
      last?.();
    },
  };
  return drag;
}

/** Start following colour drags in this bar. Once per bar element: the bar's markup is
 *  rebuilt in place, and the listener on the bar itself outlives each rebuild. */
function watchPaintDrags(scope: HTMLElement): void {
  if (dragScopes.has(scope)) return;
  dragScopes.add(scope);
  scope.addEventListener('pointerdown', (e) => {
    if (!(e.target as Element | null)?.closest?.('.color-popover') || paintDrags.has(scope)) return;
    const drag = startPaintDrag(scope);
    paintDrags.set(scope, drag);
    document.addEventListener('pointerup', drag.end, true);
    document.addEventListener('pointercancel', drag.end, true);
    window.addEventListener('blur', drag.end);
  }, true);
}

/** One `wireColorField` call per bar build - it wires the field elements inside the
 *  scope, so a second call on the same markup would fire every change twice. */
export function wirePaintCtx(fc: FcCtx, scope: HTMLElement): void {
  const { cfg } = fc;
  watchPaintDrags(scope);
  wireColorField(scope, {
    onChange: (id, val, detail) => {
      const value = fc.helpers.unwrapColor(val, detail);
      const gradStop = id === 'fc-fill' && fc.gradEdit != null;
      const field = id === 'fc-fill' ? cfg.fillField : id === 'fc-fg' ? cfg.textColorField : id === 'fc-stroke' ? cfg.strokeField : '';
      const apply = (): void => {
        if (gradStop) fc.gradient.setGradStopColor(value);
        else if (field) fc.fieldPanels.setField(field, value);
      };
      const drag = paintDrags.get(scope);
      if (!drag) { apply(); return; }
      if (drag.targets === undefined) drag.targets = gradStop || !field ? null : paintPreviewTargets(fc, field);
      if (drag.targets) {
        for (const [el, prop] of drag.targets) drag.preview.set(el, prop, value);
        drag.commit = apply;
        return;
      }
      drag.live = apply;
      drag.schedule();
    },
  });
}
/**
 * "+Keyframe" in its SECOND home (plans/104 section 8's M2.5 revision - "TWO homes, one
 * action"). The first is the timeline transport's left additive cluster; this is the
 * diamond beside Duplicate / Delete on the selected object itself, because the
 * selection is what the action acts on and the canvas is where the selection lives.
 *
 * Offered only for a tool whose manifest declares a `kf` sub-field (progressive
 * capability, exactly like the timeline rail button next to it), and DISABLED rather
 * than hidden when the selection has nothing to pose - a control that appears and
 * disappears as you click around teaches nothing, and the tooltip is where the reason
 * goes. Audio is the one exclusion: keyframed gain is plan 101's, not this feature's.
 *
 * WHICH boxes count is the PANEL's answer, not a local copy of it (`keyframableIds`
 * on the handle). "Two homes, one action" has to mean one ENABLEMENT rule too, or the
 * homes disagree about what the action can do: the panel's rule reads the live canvas
 * as well as the model - a box carrying an audio asset is a sound whatever its `kind`
 * says - and a model-only filter here rendered that box ENABLED, then wrote nothing
 * and said nothing when it was pressed.
 *
 * Before the lazy panel chunk has ever loaded there is no rule to ask, so the model
 * half stands in; `ensureTimeline` invalidates `ctxSelKey` the moment the panel does
 * exist, which rebuilds this bar against the real answer.
 */
export function kfCtxHtml(fc: FcCtx, boxes: Box[], idx: number[]): string {
  const { timeCfg } = fc;
  if (!timeCfg?.kfField) return '';
  const n = fc.timelinePanel
    ? fc.timelinePanel.keyframableIds(idx.map((i) => fc.select.idOf(boxes[i], i))).length
    : idx.filter((i) => String(boxes[i]?.kind ?? '') !== 'audio').length;
  const tip = n ? t('+Keyframe') : t('Sound has no pose to keyframe');
  return (
    `<button type="button" class="fc-cbtn" data-cx="kf" aria-disabled="${n ? 'false' : 'true'}"` +
    ` data-tip="${escapeText(tip)}" aria-label="${escapeText(tip)}">${icon(SVG.keyframe)}</button>`
  );
}
/**
 * The press. It opens the timeline first - `ensureTimeline(true)` loads the lazy
 * chunk and resolves only once the panel exists - then calls the panel's ONE writer,
 * which reads the shared selection itself. Same `withPanel` shape as the context
 * menu's timing items above, and for the same reason: a broken chunk means no write
 * rather than a half-written box.
 *
 * Opening the panel is not incidental. section 8's latch model says the playhead's position
 * IS the arm, so the surface that shows the playhead has to be up before a keyframe
 * can honestly be written at it.
 */
export function addKeyframeFromCanvas(fc: FcCtx): void {
  void fc.timeline.ensureTimeline(true).then(() => {
    fc.timelinePanel?.addKeyframe();
  });
}
// ── camera mode (plans/104 section 8) ───────────────────────────────────────────────
//
// "Camera mode is entered by SELECTION, never a global toggle": with a camera
// selected and the playhead inside its window, an empty-stage drag pans the shot and
// a plain wheel dollies it. There is nothing to switch on and nothing to switch off -
// clicking any box hands both gestures straight back.
//
// The PANEL owns the answer (it owns the clock, and "inside its window" is a question
// about the playhead), so this is one call and no local copy of the rule. Before the
// lazy panel chunk exists there is no camera and no clock, hence ''.

/** The camera a canvas gesture is aimed at right now, or ''. */
export function camModeId(fc: FcCtx): string {
  return fc.timelinePanel?.cameraModeId() ?? '';
}
/**
 * `deltaY` is only in PIXELS when `deltaMode` says so. Firefox reports LINES (mode 1,
 * ~3 per notch) and a page-scroll device reports PAGES (mode 2) - read raw, a notch
 * there would dolly two thirds of a pixel and the wheel would feel dead. The two
 * factors are the conventional line height and viewport page the browsers themselves
 * use when they normalise.
 */
export const wheelPx = (_fc: FcCtx, e: WheelEvent): number =>
  e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight || 800 : 1);
export function flushDolly(fc: FcCtx): void {
  fc.dollyTimer = null;
  const d = fc.dollyPending;
  fc.dollyPending = 0;
  if (!d || !fc.timelinePanel) return;
  const boxes = fc.select.getBoxes();
  const next = fc.timelinePanel.cameraWrite(boxes, { z: d });
  if (next !== boxes) fc.select.commit(next);
}
/**
 * Plain wheel = DOLLY; Cmd/Ctrl-wheel stays the VIEW's zoom and Space+drag stays the
 * view's pan (section 8: "move the shot" and "move my view" have to stay separable, which
 * the reference tool never had to solve).
 *
 * Bound on the canvas with `passive: false` so the notch can be claimed, and it stops
 * propagating only when it IS claimed - otherwise `tool-stage-nav`'s own listener on
 * the stage keeps the wheel it has always had.
 */
export function onCameraWheel(fc: FcCtx, e: WheelEvent): void {
  const { DOLLY_PAUSE_MS, DOLLY_PX_PER_DELTA } = fc;
  if (e.ctrlKey || e.metaKey) return; // the view's zoom, untouched
  if (!camModeId(fc)) return; // no camera armed: the view's pan
  e.preventDefault();
  e.stopPropagation();
  // AWAY FROM THE VIEWER ON A SCROLL DOWN. `eff = P/(P − (z − camZ))`, so a camera
  // whose z grows is a camera moving back - and a wheel pushed forward (deltaY < 0)
  // is the universal "closer", so the sign here is deltaY's own.
  fc.dollyPending += wheelPx(fc, e) * DOLLY_PX_PER_DELTA;
  if (fc.dollyTimer) clearTimeout(fc.dollyTimer);
  fc.dollyTimer = setTimeout(fc.contextBar.flushDolly, DOLLY_PAUSE_MS);
}
/**
 * A cheap signature of everything the object bar PAINTS from the model: the four colour
 * fields' values plus the kind that decides which controls exist. Compared per sync, so
 * an undo, a redo, a hook patch or another device's edit re-seeds the swatches.
 *
 * It is deliberately narrow. Opacity, radius, shadow and every other More-panel field
 * are absent because the bar does not show them - widening this would rebuild the bar
 * (and close the open panel) on every slider tick.
 *
 * While a floating surface is OPEN the signature is HELD at whatever the bar was built
 * with, because `rebuildCtxBar` begins with `closeMorePanel()` and re-writes
 * `ctxbar.innerHTML`: a rebuild under an open surface destroys the very thing the
 * pointer is inside. Two surfaces qualify, and BOTH are needed once the trigger widened
 * from "the selection set changed" to "any painted value changed":
 *
 *   · a colour popover ANYWHERE - the picker writes the model on every swatch click and
 *     slider tick, and the rail's artboard-fill swatch is not a child of `ctxbar`, so a
 *     bar-scoped test let each LCH tick re-`innerHTML` the bar under it;
 *   · an open More / Stroke / Text / dims panel - Cmd+Z, a collaborator's fill edit or a
 *     colour picked from the bar would otherwise close the panel being worked in.
 *
 * Each trigger keeps itself current on its own (`updateTrigger`), and the next sync
 * after the surface closes picks the real signature back up.
 */
export const ctxValueHeld = (fc: FcCtx): boolean =>
  !!document.querySelector('.color-trigger[aria-expanded="true"]') || !!fc.morePanel;
export function ctxValueSig(fc: FcCtx, boxes: Box[], idx: number[]): string {
  const { cfg } = fc;
  if (ctxValueHeld(fc)) {
    // Split at the FIRST '|' only: ids never contain one, but an authored colour could,
    // and a sig sliced in half would compare unequal and rebuild the very bar this
    // branch exists to keep standing.
    const cut = String(fc.ctxSelKey ?? '').indexOf('|');
    if (cut >= 0) return String(fc.ctxSelKey).slice(cut + 1);
  }
  const fields = [
    cfg.fillField,
    cfg.gradField,
    cfg.textColorField,
    cfg.strokeField,
    cfg.kindField,
    fc.cv.textStoryField,
  ];
  // Delimited, not concatenated: '#fff' + '' and '' + '#fff' are different states, and a
  // signature that cannot tell them apart is a rebuild that never happens. The two
  // separators are control characters, so no authored colour or kind can forge one.
  return idx
    .map((i) => {
      const b = boxes[i] || {};
      let textMode='';if(fc.cv.textFrameField&&b[fc.cv.textFrameField]){try{textMode=JSON.parse(String(b[fc.cv.textFrameField])).mode??'';}catch{/* legacy frame seed */}}
      return [...fields.map((f) => (f ? String(b[f] ?? '') : '')),textMode].join('\u0001');
    })
    .join('\u0002');
}
export function setInspector(fc: FcCtx, h: typeof fc.inspectorPort): void {
  const { ctxbar } = fc;
  fc.inspectorPort = h;
  // With the full Design chrome mounted the bar is the selection toolbar: it stays
  // while something is selected instead of fading whenever the pointer leaves the
  // stage for the inspector or the navigator (see .fc-ctxbar--pinned in editor.css).
  ctxbar.classList.toggle('fc-ctxbar--pinned', !!h);
  // And it is a different bar (verbs only, plans/184 R16), so the one on screen is
  // rebuilt for the current selection rather than waiting for the next change.
  fc.ctxSelKey = '';
  fc.chromeSync.renderChrome();
}
/** The stage's reserved bands, read from the inline custom properties the arbiter
 *  (left) and the Design top bar (top) write on the stage; inline reads cost nothing
 *  per sync frame, unlike a computed style. */
export function stageReserves(fc: FcCtx): { top: number; left: number; right: number } {
  const { stageEl } = fc;
  const px = (p: string): number => parseFloat(stageEl.style.getPropertyValue(p)) || 0;
  return {
    top: Math.max(px('--stage-reserve-top'), px('--stage-rulers-bottom')),
    left: Math.max(px('--stage-reserve-left'), px('--stage-rulers-right')),
    right: px('--stage-reserve-right'),
  };
}
export function rebuildCtxBar(fc: FcCtx, boxes: Box[], idx: number[]): void {
  const { NO_IMAGE_KINDS, NO_TEXT_KINDS, STROKE_KINDS, cfg, ctxbar, vectorCfg } = fc;
  // The gradient panel outlives a ctx-bar rebuild. Selecting a stop (and picking a
  // stop colour) deliberately rebuilds the bar so its Fill field shows that stop -
  // and `closeMorePanel()` below would take the panel with it every time, so the
  // panel vanished the moment you touched a handle. Re-request it instead; the sync
  // that follows reopens it against the freshly built button.
  if (fc.gradEdit != null && fc.morePanel?.classList.contains('fc-grad-panel')) fc.gradPanelPending = true;
  fc.document.closeMorePanel();
  const coarse = matchMedia('(pointer: coarse)').matches; // touch → offer add-to-selection
  const first: Box = boxes[idx[0]!] || {};
  const allPaths = selectionAllPaths(fc, boxes, idx);
  // Stroke goes to every kind that renders a border (A5); text and image controls to
  // the kinds that can hold them (C3). A control that appears and then does nothing is
  // worse than one that is not there: "Edit text" on an artboard, an image or a path
  // opened nothing and said nothing at all.
  // `vectorCfg` (i.e. the manifest declared `pathField`) is the tool-level gate. It is
  // not incidental: `cfg.strokeField` DEFAULTS to 'stroke' for every canvas tool, so
  // without it a Carousel Maker card - whose hooks paint no border at all - would grow
  // a stroke swatch writing a field nothing reads. Both tools that declare `pathField`
  // (Design, Org Chart) also declare stroke on box/image/frame, which is the model this
  // widening follows.
  const allStroked = allPaths || (!!vectorCfg && selectionAllKinds(fc, boxes, idx, STROKE_KINDS));
  const canText = !!cfg.textField && selectionNoKinds(fc, boxes, idx, NO_TEXT_KINDS);
  const composedText = idx.length===1 && !!fc.cv.textStoryField && !!first[fc.cv.textStoryField];
  const canImage = !!cfg.imageField && selectionNoKinds(fc, boxes, idx, NO_IMAGE_KINDS);
  // An audio box's "image" IS its track, so the one button says which it is picking.
  const audioPick = canImage && selectionAllKinds(fc, boxes, idx, new Set(['audio']));
  const imgTip = audioPick ? t('Choose a sound') : t('Set image');
  // VERBS ONLY when an inspector owns the properties (plans/184 R16): edit text, edit
  // points, set image, keyframe, duplicate, delete, select more - and the readout, which
  // jumps to the Object section, plus Aa to the Text section. The paint cluster and the
  // More opener duplicated the inspector beside it, on a bar that floats over the work.
  // Gradient mode is the one exception: its stops are handles on the canvas and the bar's
  // Fill field edits the SELECTED STOP, which nothing else offers. Without an inspector
  // (no dock host) the bar keeps every control and its own popovers, as before.
  const verbsOnly = !!fc.inspectorPort && fc.gradEdit == null;
  // With Scale on, or several objects selected, the readout opens the Scale popover:
  // the single-pointer route to a Scale drag (plan 311, WCAG 2.5.7).
  const scaleDoor = fc.scaleMode.panelWanted(boxes);
  const readTip = scaleDoor ? t('Scale the selection') : verbsOnly ? t('Edit in the inspector') : t('Edit position & size');
  const readLabel = scaleDoor ? t('Scale the selection') : verbsOnly ? t('Edit in the inspector') : t('Edit position and size');
  ctxbar.innerHTML = `
      ${verbsOnly ? '' : paintCtxHtml(fc, first, allPaths, allStroked)}
      ${
        vectorCfg && idx.length === 1 && boxOutlineKind(first, vectorCfg) === 'path'
          ? `<button type="button" class="fc-cbtn" data-cx="nodes" data-tip="${escapeText(t('Edit points (double-click)'))}" aria-label="${escapeText(t('Edit points'))}">${icon(SVG.nodes)}</button>`
          : ''
      }
      ${canText ? `<button type="button" class="fc-cbtn" data-cx="edit" data-tip="${escapeText(t('Edit text (double-click)'))}" aria-label="${escapeText(t('Edit text'))}">${icon(SVG.pencil)}</button>` : ''}
      ${canText ? `<button type="button" class="fc-cbtn fc-cbtn-text" data-cx="text" data-tip="${escapeText(t('Text - size, font, weight, line height, kerning, ligatures, alignment'))}" aria-label="${escapeText(t('Text options'))}">Aa</button>` : ''}
      ${composedText && fc.storyPath.frame(String(first[cfg.idField]))?.path ? `<button type="button" class="fc-cbtn" data-cx="text-path" data-tip="${escapeText(t('Path options'))}" aria-label="${escapeText(t('Path options'))}">${icon(SVG.pen)}</button><button type="button" class="fc-cbtn" data-cx="text-path-edit" data-tip="${escapeText(t('Edit path'))}" aria-label="${escapeText(t('Edit path'))}">${icon(SVG.nodes)}</button>` : composedText ? `<button type="button" class="fc-cbtn" data-cx="text-frame" data-tip="${escapeText(t('Frame options'))}" aria-label="${escapeText(t('Frame options'))}">${icon(SVG.size)}</button><button type="button" class="fc-cbtn" data-cx="text-flow" data-tip="${escapeText(t('Continue text'))}" aria-label="${escapeText(t('Continue text'))}">${uiIcon('link', { size: 18 })}</button>` : ''}
      ${composedText ? `<button type="button" class="fc-cbtn" data-cx="text-convert" data-tip="${escapeText(t('Convert to paths'))}" aria-label="${escapeText(t('Convert to paths'))}">${icon(SVG.outlineText)}</button>` : ''}
      ${canImage ? `<button type="button" class="fc-cbtn" data-cx="setimg"${audioPick ? ' data-cx-audio="1"' : ''} data-tip="${escapeText(imgTip)}" aria-label="${escapeText(imgTip)}">${icon(audioPick ? SVG.audioKind : SVG.image)}</button>` : ''}
      ${verbsOnly ? '' : `<button type="button" class="fc-cbtn" data-cx="more" data-tip="${escapeText(t('More - shape, radius, opacity, fit, blend, shadow'))}" aria-label="${escapeText(t('More options'))}">${icon(SVG.more)}</button>`}
      <span class="fc-sep fc-sep-v"></span>
      ${kfCtxHtml(fc, boxes, idx)}
      <button type="button" class="fc-cbtn" data-cx="dup" data-tip="${escapeText(t('Duplicate'))}" aria-label="${escapeText(t('Duplicate'))}">${icon(SVG.dup)}</button>
      <button type="button" class="fc-cbtn fc-danger" data-cx="del" data-tip="${escapeText(t('Delete'))}" aria-label="${escapeText(t('Delete'))}">${icon(SVG.trash)}</button>
      ${coarse ? `<button type="button" class="fc-cbtn${fc.multiTapMode ? ' is-on' : ''}" data-cx="multi" aria-pressed="${fc.multiTapMode}" data-tip="${escapeText(t('Select more - tap cards to add'))}" aria-label="${escapeText(t('Select more cards'))}">${icon(SVG.add)}</button>` : ''}
      ${coarse ? `<button type="button" class="fc-cbtn${fc.scaleContent ? ' is-on' : ''}" data-cx="scale" aria-pressed="${fc.scaleContent}" data-tip="${escapeText(t('Scale (K) - text, strokes and effects resize with the object'))}" aria-label="${escapeText(t('Scale mode'))}">${icon(SVG.scaleMode)}</button>` : ''}
      <button type="button" class="fc-readout" data-cx="dims" data-cx-readout${scaleDoor ? ' aria-haspopup="dialog"' : ''} data-tip="${escapeText(readTip)}" aria-label="${escapeText(readLabel)}"></button>`;
  wirePaintCtx(fc, ctxbar);
  ctxbar.querySelectorAll<HTMLElement>('[data-cx]').forEach((b) =>
    { b.addEventListener('click', (e) => {
      e.stopPropagation();
      const cx = b.dataset.cx;
      if(cx==='text-convert'){fc.storyVector.open(b);return;}
      if(cx==='text-path'){fc.storyPathUi.open(b,String(first[cfg.idField]));return;}
      if(cx==='text-path-edit'){fc.penTool.startPenEdit(String(first[cfg.idField]));return;}
      if (cx === 'text-frame' || cx === 'text-flow') {
        fc.storyFlowUi.open(b,String(first[cfg.idField]),cx==='text-frame');
      } else if (cx === 'text') {
        if (fc.inspectorPort) fc.inspectorPort.reveal('text');
        else fc.fieldPanels.openTextPanel(b);
      } else if (cx === 'stroke') {
        if (fc.inspectorPort) fc.inspectorPort.reveal('object');
        else fc.dialogs.openStrokePanel(b);
      } else if (cx === 'nodes') {
        if (fc.selection.size) fc.penTool.startPenEdit([...fc.selection][0]!);
      } else if (cx === 'edit') {
        if (fc.selection.size) fc.textEdit.startTextEdit([...fc.selection][0]!, { selectAll: !(fc.cv.textStoryField && first[fc.cv.textStoryField]) });
      } else if (cx === 'kf') {
        if (b.getAttribute('aria-disabled') !== 'true') addKeyframeFromCanvas(fc);
      } else if (cx === 'dup') fc.ops.duplicateSelection();
      else if (cx === 'del') fc.ops.deleteSelection();
      else if (cx === 'setimg') fc.objects.pickImage(b.dataset.cxAudio ? { pickType: 'audio' } : undefined);
      else if (cx === 'more') {
        if (fc.inspectorPort) fc.inspectorPort.reveal('object');
        else fc.document.openMorePanel(b);
      } else if (cx === 'grad') fc.gradient.toggleGradEdit(b);
      else if (cx === 'multi') {
        fc.multiTapMode = !fc.multiTapMode;
        b.classList.toggle('is-on', fc.multiTapMode);
        b.setAttribute('aria-pressed', String(fc.multiTapMode));
        announce(
          fc.multiTapMode ? t('Select more - tap cards to add them.') : t('Multi-select off.')
        );
      } else if (cx === 'scale') fc.scaleMode.toggle();
      else if (cx === 'dims') {
        if (fc.scaleMode.panelWanted(fc.select.getBoxes())) fc.scaleMode.openPanel(b);
        else if (fc.inspectorPort) fc.inspectorPort.reveal('object');
        else fc.fieldPanels.openDimsPanel(b);
      }
    }); }
  );
}
export function contextBarOps(fc: FcCtx) {
  return {
    selectionAllPaths: bindOp(fc, selectionAllPaths),
    kindOf: bindOp(fc, kindOf),
    selectionAllKinds: bindOp(fc, selectionAllKinds),
    selectionNoKinds: bindOp(fc, selectionNoKinds),
    colorScope: bindOp(fc, colorScope),
    colorSeed: bindOp(fc, colorSeed),
    seededColorField: bindOp(fc, seededColorField),
    paintCtxHtml: bindOp(fc, paintCtxHtml),
    wirePaintCtx: bindOp(fc, wirePaintCtx),
    kfCtxHtml: bindOp(fc, kfCtxHtml),
    addKeyframeFromCanvas: bindOp(fc, addKeyframeFromCanvas),
    camModeId: bindOp(fc, camModeId),
    wheelPx: bindOp(fc, wheelPx),
    flushDolly: bindOp(fc, flushDolly),
    onCameraWheel: bindOp(fc, onCameraWheel),
    ctxValueHeld: bindOp(fc, ctxValueHeld),
    ctxValueSig: bindOp(fc, ctxValueSig),
    setInspector: bindOp(fc, setInspector),
    stageReserves: bindOp(fc, stageReserves),
    rebuildCtxBar: bindOp(fc, rebuildCtxBar),
  };
}
