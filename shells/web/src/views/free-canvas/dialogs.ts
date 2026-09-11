// SPDX-License-Identifier: MPL-2.0
/**
 * free-canvas: the stroke panel, ask dialogs, page import, layer lift and choreography.
 *
 * Every function takes the shared `fc: FcCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `fc.<module>.<fn>`. Extracted verbatim
 * from initFreeCanvas() by scripts/split-closure.ts.
 */
import { LIFT_STRENGTH, applyLift, boxRect, formatDashArray, isSvgImageRef, liftCanCrop, liftCropScale, liftRows, parseDashArray } from '../free-canvas-math.ts';
import type { Box } from '../free-canvas-math.ts';
import { segHtml, segRow, wireSegs } from '../free-canvas-fields.ts';
import type { ChoreoOrder, ShowcaseId } from '../choreograph.ts';
import type { InputValue } from '../../../../../engine/src/inputs.ts';
import { escape as escapeText } from '../../utils.ts';
import { t } from '../../i18n.ts';
import { SVG, icon } from '../free-canvas-icons.ts';
import { CHOREO_SHOWCASES, reflectChoreographChoice } from '../choreograph-options.ts';
import { HEAD_CHOICES, ROUTE_CHOICES, dashRowOn } from './shared.ts';
import type { ConfirmAsk, ImportMode, NumberAsk, SvgLayerPlan, SvgSourceBox } from './shared.ts';
import { bindOp, type FcCtx } from './context.ts';

/**
 * Validate a typed dash pattern. The ENGINE owns this contract (it is the same parse the
 * tool's hook runs on the stored value), so the running engine's primitive wins whenever
 * it is there; `parseDashArray` in free-canvas-math.ts is the identical fallback for a
 * build that predates it, so the field never stops validating. Feature-detected at the
 * call, not cached, because the bridge is assembled asynchronously.
 */
export function parseDashText(fc: FcCtx, text: string): number[] | null {
  const { host } = fc;
  // An emptied field is "no authored array", never an error - decided here rather than
  // delegated, so clearing the control cannot depend on how the engine reads a blank.
  if (!text.trim()) return [];
  const viaHost = host?.connectors?.dashFit?.parse;
  if (typeof viaHost === 'function') {
    try {
      return viaHost(text);
    } catch {
      /* a refusing primitive is not a reason to lose the field */
    }
  }
  return parseDashArray(text);
}
/**
 * ── Stroke panel: width / style / ends / corners / fill rule ───────────────────
 *
 * A path box's stroke had a colour control and nothing else, so the width and the two
 * decorations were unreachable from the canvas - which is the working surface for an
 * `render.layout:"editor"` tool. Everything writes through `setField`, i.e. to EVERY
 * selected box in one `commit()`, the same as the More panel's controls.
 *
 * Fill rule lives here rather than under More because it is a property of the path's
 * paint, and it is what makes a hole a hole the moment anyone uses Subtract.
 *
 * Stroke ALIGNMENT (inside / centre / outside) is deliberately absent: SVG strokes on the
 * centreline only, so inside/outside is not a paint setting but a real outline conversion -
 * which the context menu already offers, exactly, as "Outline stroke".
 *
 * Plan 96 adds three things a keyword-only stroke could not say: the two ARROWHEADS (a
 * spline, a line and a connector are one primitive, so they share one decoration set), the
 * authored DASH ARRAY for anyone who wants the actual numbers, and the corner FIT that
 * makes a dashed rectangle land a dash on each corner instead of a half one.
 */
export function openStrokePanel(fc: FcCtx, anchor: HTMLElement): void {
  const { cfg, hasDashArrayCfg, hasHeadCfg, hasRouteCfg, stageEl } = fc;
  fc.document.closeMorePanel();
  const boxes = fc.select.getBoxes();
  const idx = fc.select.selIndices(boxes);
  if (!idx.length) return;
  const b: Box = boxes[idx[0]!] || {};
  const swCur = Math.max(
    0,
    Math.round(fc.keys.clampN(parseFloat(String(b[cfg.strokeWField])), 0, 0, 400))
  );
  const dashCur = String(b[cfg.strokeDashField] ?? '');
  const capCur = String(b[cfg.strokeCapField] || 'round');
  const joinCur = String(b[cfg.strokeJoinField] || 'round');
  const ruleCur = String(b[cfg.fillRuleField] || 'nonzero');
  const dashArrCur = String(b[cfg.strokeDashArrayField] ?? '');
  const dashFitCur = b[cfg.dashFitField] === true || String(b[cfg.dashFitField]) === 'true';
  const headStartCur = String(b[cfg.headStartField] || 'none');
  const headEndCur = String(b[cfg.headEndField] || 'none');
  // Route is a property of a CONNECTOR, so it is offered only once an end is attached:
  // on a free spline it would be a control with nothing to act on. `pathRouteStyle`
  // supplies the label for what Auto currently resolves to, so "auto" is never a mystery.
  const routeCur = String(b[cfg.routeField] ?? '');
  const routeBound = hasRouteCfg && fc.connectors.isBoundPath(b);
  // Plan 179 A5: the panel is reachable from any kind that renders a stroke now, and a
  // box / image / artboard paints its stroke as a CSS BORDER. A border has a width and
  // a solid/dashed/dotted style and nothing else - no line ends, no join style, no fill
  // rule, no arrowheads, no dash array. Those are the SVG path's, and the manifest says
  // so (`strokeCap`, `strokeJoin`, `fillRule`, `headStart/End`, `strokeDashArray` and
  // `dashFit` all declare `showFor: ["path"]`). Offering them here would be the object
  // bar's old mistake one level down: a control that writes a field the render ignores.
  const pathOnly = fc.contextBar.selectionAllPaths(boxes, idx);
  const headSelect = (field: string, cur: string, lbl: string): string =>
    `<select class="field-select field-select--sm" data-sp-head="${escapeText(field)}" aria-label="${escapeText(lbl)}">` +
    HEAD_CHOICES.map(
      ([v, l]) => `<option value="${v}"${cur === v ? ' selected' : ''}>${escapeText(t(l))}</option>`
    ).join('') +
    '</select>';
  const p = document.createElement('div');
  p.className = 'fc-panel fc-more-panel fc-stroke-panel';
  p.innerHTML =
    `<label class="fc-row"><span class="fc-row-lbl" data-tip="${escapeText(t('Stroke width'))}">${icon(SVG.strokeIc)}<span>${t('Stroke width')}</span></span>` +
    `<input type="range" class="field-range" data-sp="width" min="0" max="120" value="${swCur}"><b data-sp-val="width">${swCur}</b></label>` +
    segRow(
      SVG.dashDashed,
      t('Stroke style'),
      segHtml(cfg.strokeDashField, dashCur, [
        ['', t('Solid'), SVG.dashSolid],
        ['dashed', t('Dashed'), SVG.dashDashed],
        ['dotted', t('Dotted'), SVG.dashDotted],
      ])
    ) +
    // The power-user pair, where the manifest declares them (hasDashArrayCfg). Shown when
    // a dash style is on, or whenever an array is already authored - so a pattern can
    // never become unreachable by switching the keyword back to Solid, and a solid stroke
    // is not asked about dashes it has none of.
    (hasDashArrayCfg && pathOnly
      ? `<label class="fc-row" data-sp-row="dasharray"${dashRowOn(dashCur, dashArrCur) ? '' : ' hidden'}>` +
        `<span class="fc-row-lbl" data-tip="${escapeText(t('Dash array'))}">${icon(SVG.dashDotted)}<span>${t('Dash array')}</span></span>` +
        `<input type="text" data-sp="dasharray" inputmode="decimal" spellcheck="false" autocomplete="off"` +
        ` value="${escapeText(dashArrCur)}" placeholder="6 4" aria-label="${escapeText(t('Dash array'))}"></label>` +
        `<label class="fc-row fc-row-toggle field-toggle" data-sp-row="dashfit"${dashRowOn(dashCur, dashArrCur) ? '' : ' hidden'}>` +
        `<span class="fc-row-lbl" data-tip="${escapeText(t('Fit dashes to corners'))}">${icon(SVG.joinMiter)}<span>${t('Fit dashes to corners')}</span></span>` +
        `<input type="checkbox" class="field-check" data-sp="dashfit"${dashFitCur ? ' checked' : ''}></label>`
      : '') +
    (pathOnly
      ? segRow(
          SVG.capRound,
          t('Line ends'),
          segHtml(cfg.strokeCapField, capCur, [
            ['round', t('Round ends'), SVG.capRound],
            ['butt', t('Flat ends'), SVG.capButt],
            ['square', t('Square ends'), SVG.capSquare],
          ])
        )
      : '') +
    // Arrowheads. Two plain menus rather than twelve icon buttons: the six shapes are
    // named things, and the row already carries three other segmented controls. Offered
    // only where the manifest declares them - see hasHeadCfg.
    (hasHeadCfg && pathOnly
      ? segRow(
          SVG.line,
          t('Path start'),
          headSelect(cfg.headStartField, headStartCur, t('Path start'))
        ) +
        segRow(SVG.line, t('Path end'), headSelect(cfg.headEndField, headEndCur, t('Path end')))
      : '') +
    // Route - how a line with an attached end is bent between the two boxes. One plain
    // menu, beside the heads, because the three of them are the connector's whole shape.
    (routeBound
      ? segRow(
          SVG.tidy,
          t('Route'),
          `<select class="field-select field-select--sm" data-sp-route aria-label="${escapeText(t('Route'))}">` +
            ROUTE_CHOICES.map(
              ([v, l]) =>
                `<option value="${v}"${routeCur === v ? ' selected' : ''}>${escapeText(t(l))}</option>`
            ).join('') +
            '</select>'
        )
      : '') +
    (pathOnly
      ? segRow(
          SVG.joinRound,
          t('Corners'),
          segHtml(cfg.strokeJoinField, joinCur, [
            ['round', t('Round corners'), SVG.joinRound],
            ['miter', t('Sharp corners'), SVG.joinMiter],
            ['bevel', t('Bevelled corners'), SVG.joinBevel],
          ])
        ) +
        segRow(
          SVG.ruleEvenOdd,
          t('Fill rule'),
          segHtml(cfg.fillRuleField, ruleCur, [
            ['nonzero', t('Fill overlaps (non-zero)'), SVG.ruleNonzero],
            ['evenodd', t('Punch holes (even-odd)'), SVG.ruleEvenOdd],
          ])
        )
      : '');
  p.addEventListener('pointerdown', (e) => e.stopPropagation());
  // The dash-style segment also decides whether the two dash rows are on screen, so it
  // needs the write PLUS the reveal - hence a custom onSet rather than wireSegs' default.
  const dashArrEl = p.querySelector<HTMLInputElement>('input[data-sp="dasharray"]');
  const syncDashRows = (styleVal: string): void => {
    const on = dashRowOn(styleVal, dashArrEl?.value ?? dashArrCur);
    p.querySelectorAll<HTMLElement>('[data-sp-row="dasharray"], [data-sp-row="dashfit"]').forEach(
      (row) => {
        row.hidden = !on;
      }
    );
  };
  wireSegs(p, (field, v) => {
    fc.fieldPanels.setField(field, v);
    if (field === cfg.strokeDashField) syncDashRows(String(v ?? ''));
  });
  p.querySelectorAll<HTMLInputElement>('input[data-sp="width"]').forEach((rng) =>
    { rng.addEventListener('input', () => {
      const valEl = p.querySelector<HTMLElement>('[data-sp-val="width"]');
      if (valEl) valEl.textContent = rng.value;
      fc.fieldPanels.setField(cfg.strokeWField, Number(rng.value));
    }); }
  );
  // Dash array: validated on every keystroke, but a REFUSAL writes nothing at all rather
  // than a repaired guess. That is what keeps the hook's injection stance intact - only
  // numbers ever reach `stroke-dasharray` - and it is also the honest answer to "6 x":
  // there is no pattern there to store, and silently dropping the 'x' would author a
  // pattern the user did not type.
  if (dashArrEl) {
    dashArrEl.addEventListener('input', () => {
      const nums = parseDashText(fc, dashArrEl.value);
      const bad = nums === null;
      dashArrEl.setAttribute('aria-invalid', String(bad));
      if (bad) return;
      fc.fieldPanels.setField(cfg.strokeDashArrayField, nums.length ? formatDashArray(nums) : '');
    });
    // Leaving the field with something unparseable puts back what is actually stored,
    // so the control never shows a value the document does not have.
    dashArrEl.addEventListener('blur', () => {
      if (dashArrEl.getAttribute('aria-invalid') !== 'true') return;
      const cur = fc.select.getBoxes()[fc.select.selIndices(fc.select.getBoxes())[0] ?? -1] as Box | undefined;
      dashArrEl.value = String(cur?.[cfg.strokeDashArrayField] ?? '');
      dashArrEl.setAttribute('aria-invalid', 'false');
    });
  }
  p.querySelectorAll<HTMLInputElement>('input[data-sp="dashfit"]').forEach((cb) =>
    { cb.addEventListener('change', () => fc.fieldPanels.setField(cfg.dashFitField, cb.checked)); }
  );
  p.querySelectorAll<HTMLSelectElement>('select[data-sp-head]').forEach((sel) =>
    { sel.addEventListener('change', () => fc.fieldPanels.setField(sel.dataset.spHead, sel.value)); }
  );
  p.querySelectorAll<HTMLSelectElement>('select[data-sp-route]').forEach((sel) =>
    { sel.addEventListener('change', () => fc.fieldPanels.setField(cfg.routeField, sel.value)); }
  );
  stageEl.appendChild(p);
  fc.morePanel = p;
  const ar = anchor.getBoundingClientRect();
  const sr = stageEl.getBoundingClientRect();
  p.style.left = Math.min(ar.left - sr.left, Math.max(0, sr.width - p.offsetWidth - 8)) + 'px';
  p.style.top = ar.bottom - sr.top + 8 + 'px';
}
export function askNumber(fc: FcCtx, ask: NumberAsk): void {
  const { stageEl } = fc;
  fc.toolbox.closePopover();
  fc.document.closeMorePanel();
  const p = document.createElement('div');
  p.className = 'fc-panel fc-num-panel';
  p.innerHTML =
    `<div class="fc-panel-head">${escapeText(ask.title)}</div>` +
    (ask.hint ? `<p class="fc-num-hint">${escapeText(ask.hint)}</p>` : '') +
    '<div class="fc-num-row">' +
    `<input type="number" data-num step="${ask.step ?? 1}"` +
    (ask.min != null ? ` min="${ask.min}"` : '') +
    (ask.max != null ? ` max="${ask.max}"` : '') +
    ` value="${ask.value}" aria-label="${escapeText(ask.title)}">` +
    `<i>${escapeText(ask.unit || 'px')}</i>` +
    `<button type="button" class="btn btn--primary btn--sm fc-num-go" data-num-go>${escapeText(ask.confirm)}</button>` +
    '</div>';
  p.addEventListener('pointerdown', (e) => e.stopPropagation());
  const inp = p.querySelector<HTMLInputElement>('[data-num]')!;
  const go = (): void => {
    const v = parseFloat(inp.value);
    fc.document.closeMorePanel();
    if (Number.isFinite(v)) ask.apply(v);
  };
  // Enter is the only keyboard commit; Escape falls through to onKey, which closes the
  // panel without applying.
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      go();
    }
  });
  p.querySelector<HTMLButtonElement>('[data-num-go]')!.addEventListener('click', (e) => {
    e.stopPropagation();
    go();
  });
  stageEl.appendChild(p);
  fc.morePanel = p;
  const sr = stageEl.getBoundingClientRect();
  p.style.left =
    Math.max(6, Math.min(ask.at.x - sr.left, Math.max(6, sr.width - p.offsetWidth - 6))) + 'px';
  p.style.top =
    Math.max(6, Math.min(ask.at.y - sr.top, Math.max(6, sr.height - p.offsetHeight - 6))) + 'px';
  inp.focus();
  inp.select();
}
export function askConfirm(fc: FcCtx, ask: ConfirmAsk): void {
  const { stageEl } = fc;
  fc.toolbox.closePopover();
  fc.document.closeMorePanel();
  const p = document.createElement('div');
  p.className = 'fc-panel fc-num-panel fc-confirm-panel';
  p.innerHTML =
    `<div class="fc-panel-head">${escapeText(ask.title)}</div>` +
    `<p class="fc-num-hint">${escapeText(ask.hint)}</p>` +
    '<div class="fc-num-row fc-confirm-row">' +
    `<button type="button" class="btn btn--sm" data-confirm-no>${escapeText(t('Keep them'))}</button>` +
    `<button type="button" class="btn btn--primary btn--sm" data-confirm-yes>${escapeText(ask.confirm)}</button>` +
    '</div>';
  p.addEventListener('pointerdown', (e) => e.stopPropagation());
  // Exactly one of apply/cancel runs, exactly once, whichever way the panel goes away.
  // The two buttons settle it synchronously; the observer only catches the INDIRECT
  // dismissals (Escape, an outside click), which go through the generic closeMorePanel
  // and so cannot call back here themselves. Synchronously matters: the caller usually has
  // UI to put back - a <select> still showing the kind it did not switch to - and leaving
  // that until a microtask would show the wrong value for a frame.
  let settled = false;
  const settle = (ok: boolean): void => {
    if (settled) return;
    settled = true;
    observer.disconnect();
    if (ok) ask.apply();
    else ask.cancel?.();
  };
  const observer = new MutationObserver(() => {
    if (!p.isConnected) settle(false);
  });
  p.querySelector<HTMLButtonElement>('[data-confirm-yes]')!.addEventListener('click', (e) => {
    e.stopPropagation();
    fc.document.closeMorePanel();
    settle(true);
  });
  p.querySelector<HTMLButtonElement>('[data-confirm-no]')!.addEventListener('click', (e) => {
    e.stopPropagation();
    fc.document.closeMorePanel();
    settle(false);
  });
  stageEl.appendChild(p);
  observer.observe(stageEl, { childList: true });
  fc.morePanel = p;
  const sr = stageEl.getBoundingClientRect();
  p.style.left =
    Math.max(6, Math.min(ask.at.x - sr.left, Math.max(6, sr.width - p.offsetWidth - 6))) + 'px';
  p.style.top =
    Math.max(6, Math.min(ask.at.y - sr.top, Math.max(6, sr.height - p.offsetHeight - 6))) + 'px';
  p.querySelector<HTMLButtonElement>('[data-confirm-yes]')!.focus();
}
/**
 * The drop door's question for a document of several pages: artboards, timed scenes,
 * or just one page. The SAME `fc-panel` recipe as askConfirm, centred on the stage,
 * and deliberately NOT the shared `choiceDialog`: that modal rides the phantom
 * history entry the Back button needs, and popping it on close fires a popstate the
 * router answers by re-mounting the tool - which tore down the very view that was
 * mid-import and dropped the result on the floor (measured 2026-09-02). A stage panel
 * touches no history. Resolves null on Escape / an outside click.
 */
export function askImportPages(fc: FcCtx, pages: number | null): Promise<ImportMode | null> {
  const { stageEl } = fc;
  return new Promise((resolve) => {
  const { importArtboardCapable, importSceneCapable } = fc;
    fc.toolbox.closePopover();
    fc.document.closeMorePanel();
    const p = document.createElement('div');
    p.className = 'fc-panel fc-num-panel fc-confirm-panel fc-import-pages-panel';
    p.setAttribute('role', 'dialog');
    p.setAttribute('aria-label', t('Import pages'));
    p.tabIndex = -1;
    const hint = pages
      ? t('This document has {n} pages. How should they come in?', { n: pages })
      : t('How should this document’s pages come in?');
    p.innerHTML =
      `<div class="fc-panel-head">${escapeText(t('Import pages'))}</div>` +
      `<p class="fc-num-hint">${escapeText(hint)}</p>` +
      '<div class="fc-num-row fc-confirm-row">' +
      `<button type="button" class="btn btn--sm" data-import-mode="">${escapeText(t('Cancel'))}</button>` +
      (importArtboardCapable
        ? `<button type="button" class="btn btn--primary btn--sm" data-import-mode="artboards">${escapeText(t('As artboards'))}</button>`
        : '') +
      (importSceneCapable
        ? `<button type="button" class="btn ${importArtboardCapable ? '' : 'btn--primary '}btn--sm" data-import-mode="scenes">${escapeText(t('As timed scenes'))}</button>`
        : '') +
      `<button type="button" class="btn btn--sm" data-import-mode="board">${escapeText(t('Just one page'))}</button>` +
      '</div>';
    p.addEventListener('pointerdown', (e) => e.stopPropagation());
    let settled = false;
    const settle = (mode: ImportMode | null): void => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      resolve(mode);
    };
    const observer = new MutationObserver(() => {
      if (!p.isConnected) settle(null);
    });
    p.querySelectorAll<HTMLButtonElement>('[data-import-mode]').forEach((b) => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        const v = b.dataset.importMode;
        fc.document.closeMorePanel();
        settle(
          v === 'artboards'
            ? 'artboards'
            : v === 'scenes'
              ? 'scenes'
              : v === 'board'
                ? 'board'
                : null
        );
      });
    });
    stageEl.appendChild(p);
    observer.observe(stageEl, { childList: true });
    fc.morePanel = p;
    const sr = stageEl.getBoundingClientRect();
    p.style.left = Math.max(6, Math.round((sr.width - p.offsetWidth) / 2)) + 'px';
    p.style.top = Math.max(6, Math.round((sr.height - p.offsetHeight) / 2)) + 'px';
    (p.querySelector<HTMLButtonElement>('.btn--primary') ?? p).focus();
  });
}
// ── Lift layers (plans/104 section 7) ───────────────────────────────────────────────
//
// "The feature that makes this especially for vectors": one box holding a flat SVG
// becomes N stacked boxes, one per layer of the drawing, sharing a group, with their
// depth auto-staggered and `shadow: depth` pre-set - at which point every layer is an
// ordinary plate with its own z, keyframes and blur, and the rest of this plan works
// on it unchanged. Zero new plumbing downstream; the whole feature is here plus the
// engine's enumerator.
//
// The division of labour, and why nothing below re-implements any of it:
//   • `enumerateSvgLayers` (engine, 1.119) reads the sanitised markup and derives one
//     STANDALONE `<svg>` per layer, in the source's own root coordinates - which is
//     what makes the geometry identity hold (N layers at z = 0 render as the original).
//   • `liftRows` + `applyLift` (free-canvas-math) synthesise the rows and splice them
//     in place, including the paint-order distribution (bg on the bottom row, text on
//     the top) that keeps a lift from compositing the background N times.
//   • `storeUserUpload` (picker) is the ONE ingest funnel: every derived document goes
//     through DOMPurify again on the way in, exactly like a file the user dragged.
//
// ONE commit for the whole thing, so one ⌘Z puts the original box back.

/** The single selected box that can be lifted, or -1. */
export function liftTargetIndex(fc: FcCtx, boxes: Box[]): number {
  const { cfg } = fc;
  if (!cfg.imageField) return -1;
  const idx = fc.select.selIndices(boxes);
  if (idx.length !== 1) return -1;
  return isSvgImageRef(boxes[idx[0]!]?.[cfg.imageField]) ? idx[0]! : -1;
}
/** Is "Lift layers" available on this tool at all? (Somewhere to put the rows.) */
export const canLift = (fc: FcCtx): boolean => { const { cfg } = fc; return !!cfg.imageField; };
/** The stem of a source asset's name, for naming the derived documents. */
export function liftBaseName(_fc: FcCtx, ref: unknown): string {
  const r = (ref || {}) as { url?: unknown; meta?: { name?: unknown } | null };
  const named = typeof r.meta?.name === 'string' ? r.meta.name : '';
  // `decodeURIComponent` THROWS on a lone `%` or a bad escape, and the tail it is
  // handed comes from a ref the shell did not necessarily mint - `isSvgImageRef`
  // accepts a hand-written `data:image/svg+xml` link, and a hook patch can put
  // anything in `url`. A URIError here used to escape a naming helper into an
  // unhandled rejection; the raw tail is a perfectly good name.
  const tail =
    typeof r.url === 'string' ? (r.url.split(/[?#]/)[0] || '').split('/').pop() || '' : '';
  let fromUrl = tail;
  try {
    fromUrl = decodeURIComponent(tail);
  } catch {
    /* keep the raw tail */
  }
  const raw = (named || fromUrl || 'artwork').replace(/\.[a-z0-9]+$/i, '');
  // The picker's own id sanitiser runs over the final filename anyway; keeping this
  // conservative means the derived names stay readable in the asset library.
  return (
    raw
      .replace(/[^a-z0-9 _-]/gi, '')
      .trim()
      .slice(0, 40) || 'artwork'
  );
}
/**
 * The confirm dialog: what the lift WILL do, before it does it.
 *
 * The `fc-panel` recipe `askConfirm` established - a titled panel with a sentence and
 * two buttons, riding `morePanel` so an outside click or Escape dismisses it and that
 * dismissal means "no". It grows one thing: the list of layers.
 *
 * The list is READ-ONLY, deliberately, and this is a v1 decision worth stating. section 7
 * calls it a "checklist preview", and the obvious reading is checkboxes - but an
 * unticked layer has nowhere to go: dropping it would silently delete artwork the
 * user never asked to lose, and merging it into a neighbour is a semantic section 7 does not
 * define. So v1 SHOWS the plan and asks yes or no to all of it; per-layer control
 * belongs with the Objects panel (plan 100), which is section 7's own stated home for the
 * list. No thumbnails either: rendering N derived documents to preview them costs a
 * rasteriser and a frame each, and the label plus the element count already answers
 * the only question the dialog is asked ("did it find my layers, or one big blob?").
 *
 * Two async stages, one panel: it opens IMMEDIATELY in a reading state (the fetch +
 * sanitise + enumerate can take a moment on a large file, and a menu item that does
 * nothing visible for half a second reads as broken), then re-renders in place with
 * the plan, or with the enumerator's own refusal in its own words.
 *
 * That second stage is the whole reason this panel is built in THREE pieces (head,
 * a live `[data-lift-msg]` sentence, a swapped `[data-lift-body]`) rather than one
 * `innerHTML` per stage. "Reading the artwork…" is a picture of work in flight, and
 * a picture is all it was: the panel opened without focus and repainted wholesale
 * whenever the enumeration arrived, so a screen reader was told nothing at open and
 * nothing at the finish - and then focus jumped to a button that had appeared out of
 * a silence. Three habits the shell already has fix it:
 *
 *   • `aria-busy` on the container while it reads (template-chooser's tile,
 *     tool-actions' export button, color-lab's charts section);
 *   • ONE `role="status"` sentence that OUTLIVES both stages, so the outcome is a
 *     mutation of a mounted live region rather than a new region nobody announces;
 *   • focus taken at OPEN (askConfirm's move, and it is the user's own gesture that
 *     opened this), then moved WITHIN the panel afterwards - `focusInPanel` declines
 *     when the user has since gone somewhere else, because a control that appears
 *     after an await has no claim on where they went while it loaded.
 */
export function askLiftLayers(fc: FcCtx): void {
  const { cfg, stageEl } = fc;
  if (!cfg.imageField) return;
  const boxes0 = fc.select.getBoxes();
  const at = liftTargetIndex(fc, boxes0);
  if (at < 0) return;
  const sourceId = fc.select.idOf(boxes0[at], at);
  const ref = boxes0[at]![cfg.imageField] as { url?: unknown } | undefined;
  const url = typeof ref?.url === 'string' ? ref.url : '';
  if (!url) return;

  fc.toolbox.closePopover();
  fc.document.closeMorePanel();
  const p = document.createElement('div');
  p.className = 'fc-panel fc-num-panel fc-lift-panel';
  p.tabIndex = -1;
  p.setAttribute('role', 'dialog');
  p.setAttribute('aria-label', t('Lift layers'));
  // Reading is a STATE, not just a sentence. Dropped again by whichever of
  // renderPlan / renderRefusal arrives - both are the end of the work.
  p.setAttribute('aria-busy', 'true');
  p.addEventListener('pointerdown', (e) => e.stopPropagation());
  p.innerHTML =
    `<div class="fc-panel-head">${escapeText(t('Lift layers'))}</div>` +
    `<p class="fc-num-hint" data-lift-msg role="status" aria-live="polite">${escapeText(t('Reading the artwork…'))}</p>` +
    '<div data-lift-body></div>';
  // Mounted once and only ever re-WORDED: the count sentence, the refusal and the
  // reading state are the same line of the panel, so the announcement is a change to
  // a live region that was already in the tree.
  const msgEl = p.querySelector<HTMLElement>('[data-lift-msg]')!;
  const bodyEl = p.querySelector<HTMLElement>('[data-lift-body]')!;
  stageEl.appendChild(p);
  fc.morePanel = p;
  const sr = stageEl.getBoundingClientRect();
  p.style.left =
    Math.max(6, Math.min(fc.lastMenuAt.x - sr.left, Math.max(6, sr.width - p.offsetWidth - 6))) +
    'px';
  p.style.top =
    Math.max(6, Math.min(fc.lastMenuAt.y - sr.top, Math.max(6, sr.height - p.offsetHeight - 6))) +
    'px';
  // At OPEN, synchronously, on the gesture that asked for it - so the dialog's name
  // and its reading sentence are what gets read, and every later focus move is a move
  // WITHIN a surface the user is already in rather than a jump out of one they left.
  p.focus();

  /** Still the panel on screen? Every await below re-asks before touching the DOM. */
  const live = (): boolean => !fc.disposed && fc.morePanel === p && p.isConnected;

  /**
   * Move focus to a control this panel just built - unless the user went elsewhere
   * while it was reading. `document.body` (or nothing at all) counts as "still ours":
   * that is where focus arrives when the element it was on is replaced, which is
   * exactly what the stage swap below does.
   */
  const focusInPanel = (el: HTMLElement | null | undefined): void => {
    if (!el) return;
    const active = document.activeElement;
    if (active === null || active === document.body || p.contains(active)) el.focus();
  };

  void (async () => {
    try {
      // The sanitised markup, through the shell's ONE untrusted-SVG path (DOMPurify,
      // serialised from the sanitised NODE). `fetchAnimSvg` is that path plus a
      // per-URL cache - named for its first caller, but it is simply "give me this
      // SVG's markup, safely", which is exactly what an enumeration needs.
      const [{ fetchAnimSvg }, { enumerateSvgLayers, svgRootViewBox }] = await Promise.all([
        import('../anim-svg-mount.ts'),
        import('../../../../../engine/src/svg-layers.ts'),
      ]);
      const markup = await fetchAnimSvg(url);
      if (!live()) return;
      // Whether a derived document may be CROPPED to its own ink is a property of
      // the box it will land in, and it has to be settled before the documents
      // exist - a cropped document needs a row cut to the same rect (plans/104
      // P3.2). `liftCanCrop` is the one predicate; `liftRows` asks it again at
      // commit time, so the dialog and the write cannot disagree.
      const sboxes = fc.select.getBoxes();
      const src = sboxes[fc.select.indexOfId(sboxes, sourceId)];
      const place = {
        viewBox: svgRootViewBox(markup),
        fit: String(src?.[cfg.fitField] ?? 'contain'),
      };
      const cropToInk = !!src && liftCanCrop(src, cfg, place);
      // …and WHERE it will be cropped to. A crop is only free if the row it maps
      // to ends up on the pixel grid the uncropped picture was already on, and the
      // scale that decides that is a property of THIS box, not of the artwork -
      // so the engine is told it rather than assuming 1:1 (engine 1.122).
      const cropScale = (src && liftCropScale(src, cfg, place)) || undefined;
      const { layers, warnings, viewBox } = enumerateSvgLayers(markup, { cropToInk, cropScale });
      if (!live()) return;
      if (layers.length < 2) {
        // ONE layer is not a stack, and lifting it would add a box and a group for no
        // gain. The enumerator's own warning (if any) says why in plain words.
        renderRefusal(
          warnings[0] || t('This artwork is a single layer, so there is nothing to lift apart.')
        );
        return;
      }
      renderPlan(layers, warnings, viewBox);
    } catch (e) {
      console.error(e);
      if (live()) renderRefusal(t('That artwork could not be read.'));
    }
  })();

  function renderRefusal(message: string): void {
    p.removeAttribute('aria-busy');
    msgEl.textContent = message;
    bodyEl.innerHTML = `<div class="fc-num-row fc-confirm-row"><button type="button" class="btn btn--sm" data-lift-close>${escapeText(t('Close'))}</button></div>`;
    const close = bodyEl.querySelector<HTMLButtonElement>('[data-lift-close]');
    close?.addEventListener('click', (e) => {
      e.stopPropagation();
      fc.document.closeMorePanel();
    });
    focusInPanel(close);
  }

  function renderPlan(layers: SvgLayerPlan[], warnings: string[], viewBox: SvgSourceBox): void {
    p.removeAttribute('aria-busy');
    // The count sentence is the headline section 7 names verbatim ("6 layers found"), and it
    // is the SAME line that said "Reading the artwork…" a moment ago - so a screen
    // reader hears the finish without the dialog being rebuilt around it.
    msgEl.textContent = t('{n} layers found', { n: layers.length });
    bodyEl.innerHTML =
      `<ul class="fc-lift-list">${layers
          .map((L, i) => {
            // The label is an INDEX, never a name out of the file: the engine never
            // reads `data-name`/`inkscape:label`, so "Layer 3" is the honest thing to
            // print. The count beside it is what tells a stack of six real layers apart
            // from six stray leaves the clusterer happened to group.
            //
            // One exception, and it is an ID rather than a name: `boxId` is the walker's
            // `data-box-id` come back round (section 7's identity passthrough - a Lolly
            // screenshot exported with `layerIds` carries the canvas's own box ids), so
            // when it is there the row can say WHICH element of the original page this
            // layer is. Minted by the canvas, never read out of a stranger's file.
            const label = t('Layer {n}', { n: i + 1 });
            const nodes = L.nodes === 1 ? t('1 shape') : t('{n} shapes', { n: L.nodes });
            const from =
              typeof L.boxId === 'string' && L.boxId
                ? ` <span class="fc-lift-n">${escapeText(L.boxId)}</span>`
                : '';
            return (
              `<li class="fc-lift-row"><span class="fc-lift-tick" aria-hidden="true">${icon(SVG.check)}</span>` +
              `<span class="fc-lift-name">${escapeText(label)}${from}</span><span class="fc-lift-n">${escapeText(nodes)}</span></li>`
            );
          })
          .join('')}</ul>` +
      (warnings.length
        ? `<p class="fc-num-hint fc-lift-warn">${escapeText(warnings.join(' '))}</p>`
        : '') +
      // Depth intensity (audit A5#2): how far apart the stack stands. Medium is the
      // shipped taste ceiling - an unchanged lift is byte-identical to before - with
      // Dramatic there for a sparse hero shot that reads flat at the default.
      '<div class="fc-num-row fc-lift-strength-row">' +
      `<label class="field-label fc-lift-strength-lab" for="fc-lift-strength">${escapeText(t('Depth intensity'))}</label>` +
      '<select class="field-select field-select--sm fc-lift-strength" id="fc-lift-strength" data-lift-strength>' +
      `<option value="subtle">${escapeText(t('Subtle'))}</option>` +
      `<option value="medium" selected>${escapeText(t('Medium'))}</option>` +
      `<option value="dramatic">${escapeText(t('Dramatic'))}</option>` +
      '</select>' +
      '</div>' +
      '<div class="fc-num-row fc-confirm-row">' +
      `<button type="button" class="btn btn--sm" data-lift-no>${escapeText(t('Cancel'))}</button>` +
      `<button type="button" class="btn btn--primary btn--sm" data-lift-yes>${escapeText(t('Lift layers'))}</button>` +
      '</div>';
    bodyEl.querySelector<HTMLButtonElement>('[data-lift-no]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      fc.document.closeMorePanel();
    });
    const yes = bodyEl.querySelector<HTMLButtonElement>('[data-lift-yes]');
    yes?.addEventListener('click', (e) => {
      e.stopPropagation();
      // Read the Depth-intensity choice at commit time - the select is the only source
      // of truth, and an unknown value maps to `medium` (1), the byte-identical default.
      const pick =
        bodyEl.querySelector<HTMLSelectElement>('[data-lift-strength]')?.value ?? 'medium';
      const strength = LIFT_STRENGTH[pick] ?? LIFT_STRENGTH.medium;
      yes.disabled = true;
      yes.textContent = t('Lifting…');
      // Busy again, and for the same reason it was at open: the stores and the commit
      // are work in flight. `runLift`'s `finally` takes the panel down whichever way
      // it goes, so there is no path that leaves this attribute standing.
      p.setAttribute('aria-busy', 'true');
      // The button that was pressed is now disabled, so focus is about to be dropped
      // on the floor by the browser - park it on the panel, which still says what is
      // happening, rather than letting it fall to <body> and out of the dialog.
      p.focus();
      void runLift(fc, sourceId, ref, layers, viewBox, () => live(), strength);
    });
    focusInPanel(yes);
  }
}
/**
 * Do the lift: store one asset per derived layer, then write the rows in ONE commit.
 *
 * The stores happen FIRST and the commit last, so a failure part-way through leaves
 * the board exactly as it was - a half-lifted stack (some layers boxed, the original
 * gone) is the one outcome worth engineering against, and "nothing changed, here is
 * why" is recoverable where that is not.
 *
 * The model is re-read AFTER the awaits and the source box found by ID, never by the
 * index the dialog opened with: a collaborator's edit, an undo, or the user's own
 * click could have moved it while the assets were being written.
 */
export async function runLift(fc: FcCtx, 
  sourceId: string,
  ref: unknown,
  layers: SvgLayerPlan[],
  viewBox: SvgSourceBox,
  stillOpen: () => boolean,
  strength = 1
): Promise<void> {
  const { cfg, cv, host } = fc;
  if (!cfg.imageField) return;
  try {
    // Inside the try, with the panel's close in the `finally` below: the confirm
    // button is already disabled and reading "Lifting…", so ANY throw from here on
    // that left the panel open would strand it in that state, dismissable only by
    // clicking outside. Naming the file was the one step that used to sit outside
    // both.
    const base = liftBaseName(fc, ref);
    const [{ storeUserUpload }, { KF_Z_FIELD_CLAMP }] = await Promise.all([
      import('../picker.ts'),
      import('../../../../../engine/src/keyframes.ts'),
    ]);
    const refs = [] as InputValue[];
    for (let i = 0; i < layers.length; i++) {
      const file = new File([layers[i]!.markup], `${base}-layer-${i + 1}.svg`, {
        type: 'image/svg+xml',
      });
      refs.push(
        (await storeUserUpload(
          host as unknown as Parameters<typeof storeUserUpload>[0],
          file
        )) as unknown as InputValue
      );
    }
    if (fc.disposed) return;
    // Still closed here on the happy path, BEFORE the commit re-renders the
    // stage - the `finally` below is the safety net for the paths that used to
    // sail past this line, not a replacement for it.
    if (stillOpen()) fc.document.closeMorePanel();

    const boxes = fc.select.getBoxes();
    const at = fc.select.indexOfId(boxes, sourceId);
    if (at < 0) {
      fc.stage.flash(t('That artwork is no longer on the canvas, so nothing was changed.'));
      return;
    }
    const source = boxes[at]!;
    // Ids are minted against a GROWING array, so two rows can never collide.
    let scratch = boxes;
    const ids: string[] = [];
    for (let i = 0; i < layers.length; i++) {
      const id = fc.select.freshId(scratch);
      ids.push(id);
      scratch = [...scratch, { [cfg.idField]: id } as Box];
    }
    const rows = liftRows(
      source,
      layers.map((L, i) => ({
        src: String((refs[i] as { url?: unknown } | null)?.url ?? ''),
        id: ids[i]!,
        // The engine cropped the document; this is the same rect, so the row can
        // be sized to the ink instead of to the stage (plans/104 P3.2).
        crop: L.viewBox ?? null,
        bbox: L.bbox ?? null,
      })),
      // `zField` is the DEPTH field (plans/104 section 5.3) and lives on the canvas block
      // rather than in this module's geometry cfg - the only reader it has had until
      // now is `timeCfg`, because a keyed `z` replaces it for its segment. A lift is
      // its second reader, so it is named here rather than smuggled into FieldCfg,
      // where thirty other call sites would then have to ignore it.
      { ...cfg, zField: cv.zField || '' },
      {
        zClamp: KF_Z_FIELD_CLAMP,
        group: cfg.groupField ? fc.objects.freshGroupId(boxes) : '',
        viewBox,
        fit: String(source[cfg.fitField] ?? 'contain'),
        strength,
      }
      // `liftRows` types the image value as a URL STRING, but this canvas's image
      // sub-field is a declared `asset`: the engine resolves block asset sub-fields by
      // their `.id` (runtime.ts resolveAssetRefs) and the tool hook reads `image.url`,
      // so a bare string would render nothing and would not survive a reload. The row
      // therefore carries the whole ref, written in the same pass - one object per row,
      // still one commit.
    ).map((row, i) => ({ ...row, [cfg.imageField]: refs[i] }));

    fc.selection = new Set(ids);
    fc.select.commit(applyLift(boxes, at, rows));
    // No singular branch: `askLiftLayers` refuses anything under two layers with
    // `renderRefusal`, and `runLift` is reachable only from `renderPlan`, so a
    // "Lifted 1 layer." string could never have been shown - it was a dead key in
    // twenty-six locales.
    fc.stage.flash(t('Lifted {n} layers.', { n: layers.length }));
  } catch (e) {
    console.error(e);
    if (!fc.disposed) fc.stage.flash(t('Those layers could not be lifted, so nothing was changed.'));
  } finally {
    // The panel closes whatever happened, which the try alone never guaranteed:
    // an IndexedDB quota rejection during the uploads (the very failure a heavy
    // lift invites - see the engine's SVG_LAYERS_HEAVY_BYTES warning) flashed a
    // message and left the confirm button disabled and reading "Lifting…" for
    // good, dismissable only by clicking outside. Idempotent - on the happy path
    // the panel is already gone and `stillOpen()` is false.
    if (stillOpen()) fc.document.closeMorePanel();
  }
}
// ── Choreograph (plans/104 P4) ──────────────────────────────────────────────────────
//
// One click over a stack of boxes writes EXPANDED per-box keyframe tracks plus a camera
// track - the camera presets' posture exactly: nothing is stored by name, so what a
// showcase writes is ordinary keyframes the user can retime, split or delete afterwards.
// All of the maths and the model write live in ./choreograph.ts, which is a LAZY chunk
// (it pulls timeline-math and the engine's keyframe module); everything below is picker.

/** Is "Choreograph" available on this tool at all? (Somewhere to write the tracks.) */
export const canChoreograph = (fc: FcCtx): boolean => { const { timeCfg } = fc; return !!timeCfg?.kfField; };
/**
 * A box a showcase may pose. Mirrors `choreographable` in ./choreograph.ts, which stays
 * the authority at write time - this copy exists only so the menu can gate itself
 * without fetching the chunk. (`cfg.kindField` is 'kind', the literal key the camera
 * readers use, so the two ask the same question of the same field.)
 */
export const isPosable = (fc: FcCtx, b: Box | undefined): boolean =>
  { const { cfg } = fc; return !!b && !['camera', 'frame', 'audio'].includes(String(b[cfg.kindField] ?? '')); };
/** The selected boxes a showcase would pose, in array order. */
export function choreoIds(fc: FcCtx, boxes: Box[]): string[] {
  return fc.select.selIndices(boxes)
    .filter((i) => isPosable(fc, boxes[i]))
    .map((i) => fc.select.idOf(boxes[i], i));
}
/** A showcase over one box is just a keyframe, so two is the floor - and it is the same
 *  floor `applyChoreograph` refuses under, rather than a second opinion about it. */
export const canChoreographNow = (fc: FcCtx): boolean => choreoIds(fc, fc.select.getBoxes()).length >= 2;
/**
 * The picker: six showcases, four settings, one button.
 *
 * The same `fc-panel` recipe as `askLiftLayers` - it rides `morePanel`, so an outside
 * click or Escape dismisses it and that dismissal means "no" - minus the reading state,
 * because there is nothing to fetch before it can draw itself: the plan is generated at
 * commit time out of boxes already on the canvas.
 */
export function askChoreograph(fc: FcCtx): void {
  const { addKinds, cfg, stageEl } = fc;
  if (!canChoreograph(fc)) return;
  fc.toolbox.closePopover();
  fc.document.closeMorePanel();
  let showcase: ShowcaseId = 'buildup';
  // The length follows the chosen showcase until the user types one. After that it is
  // theirs, and switching cards must not quietly overwrite it.
  let secDirty = false;
  const n = choreoIds(fc, fc.select.getBoxes()).length;
  const secOf = (id: ShowcaseId): string =>
    String((CHOREO_SHOWCASES.find((s) => s.id === id)?.ms ?? 3000) / 1000);
  const orderOpt = (v: string, label: string): string =>
    `<option value="${v}">${escapeText(label)}</option>`;

  const p = document.createElement('div');
  p.className = 'fc-panel fc-num-panel fc-choreo-panel';
  p.tabIndex = -1;
  p.setAttribute('role', 'dialog');
  p.setAttribute('aria-label', t('Choreograph'));
  // The count sentence is written once and never re-worded, so a live region would
  // announce nothing (only a mutation fires one). It is the dialog's DESCRIPTION instead,
  // read after the name when focus arrives.
  p.setAttribute('aria-describedby', 'fc-choreo-desc');
  p.addEventListener('pointerdown', (e) => e.stopPropagation());
  p.innerHTML =
    `<div class="fc-panel-head">${escapeText(t('Choreograph'))}</div>` +
    `<p class="fc-num-hint" id="fc-choreo-desc">${escapeText(t('{n} boxes. One click writes a full motion arc - every keyframe stays editable afterwards.', { n }))}</p>` +
    `<div class="fc-choreo-grid" role="radiogroup" aria-label="${escapeText(t('Showcase'))}">` +
    CHOREO_SHOWCASES.map(
      (s) =>
        // Roving tabindex: the checked card is the group's one Tab stop, the arrows walk the rest.
        `<button type="button" class="fc-choreo-card" role="radio" data-choreo="${s.id}" aria-checked="${s.id === showcase ? 'true' : 'false'}" tabindex="${s.id === showcase ? 0 : -1}">` +
        `${icon(s.icon)}<span class="fc-choreo-name">${escapeText(s.label)}</span>` +
        `<span class="fc-choreo-sub">${escapeText(s.sub)}</span></button>`
    ).join('') +
    '</div>' +
    `<div class="fc-choreo-quick" role="group" aria-label="${escapeText(t('Apply a Launch recipe'))}">${CHOREO_SHOWCASES.filter(s => s.quick).map(s => `<button type="button" class="btn btn--sm" data-choreo-quick="${s.id}">${escapeText(t('Apply'))} ${escapeText(s.label)}</button>`).join('')}</div>` +
    '<div class="fc-num-row">' +
    // step=any accepts every authored length against the 0.8-second floor.
    `<label class="field-label fc-choreo-lab" for="fc-choreo-sec">${escapeText(t('Length in seconds'))}</label>` +
    `<input type="number" class="field-input fc-choreo-num" id="fc-choreo-sec" data-choreo-sec min="0.8" step="any" value="${secOf(showcase)}">` +
    '</div>' +
    '<div class="fc-num-row">' +
    // Match DEFAULT_STAGGER_MS without loading the generator to draw the picker.
    `<label class="field-label fc-choreo-lab" for="fc-choreo-stagger">${escapeText(t('Stagger ms'))}</label>` +
    '<input type="number" class="field-input fc-choreo-num" id="fc-choreo-stagger" data-choreo-stagger min="0" step="10" value="90">' +
    '</div>' +
    '<div class="fc-num-row">' +
    `<label class="field-label fc-choreo-lab" for="fc-choreo-order">${escapeText(t('Order'))}</label>` +
    '<select class="field-select field-select--sm fc-choreo-order" id="fc-choreo-order" data-choreo-order>' +
    orderOpt('', t('First to last')) +
    orderOpt('reverse', t('Last to first')) +
    orderOpt('center', t('From the centre')) +
    orderOpt('depth', t('By depth')) +
    orderOpt('random', t('Random')) +
    '</select>' +
    '</div>' +
    `<label class="fc-row fc-row-toggle field-toggle"><span>${escapeText(t('Camera move'))}</span>` +
    '<input type="checkbox" class="field-check" data-choreo-camera checked></label>' +
    `<label class="fc-row fc-row-toggle field-toggle"><span>${escapeText(t('Float - a breath of scale'))}</span>` +
    '<input type="checkbox" class="field-check" data-choreo-float checked></label>' +
    // Unchecked on purpose: one tilt key moves the whole export onto the slower
    // capture tier and refuses a board holding video, so 3D is a choice, not a default.
    `<label class="fc-row fc-row-toggle field-toggle"><span>${escapeText(t('Tumble - a 3D wobble (slower to export)'))}</span>` +
    '<input type="checkbox" class="field-check" data-choreo-tumble></label>' +
    '<div class="fc-num-row fc-confirm-row">' +
    `<button type="button" class="btn btn--sm" data-choreo-no>${escapeText(t('Cancel'))}</button>` +
    `<button type="button" class="btn btn--primary btn--sm" data-choreo-yes>${escapeText(t('Choreograph'))}</button>` +
    '</div>';
  stageEl.appendChild(p);
  fc.morePanel = p;
  const sr = stageEl.getBoundingClientRect();
  p.style.left =
    Math.max(6, Math.min(fc.lastMenuAt.x - sr.left, Math.max(6, sr.width - p.offsetWidth - 6))) +
    'px';
  p.style.top =
    Math.max(6, Math.min(fc.lastMenuAt.y - sr.top, Math.max(6, sr.height - p.offsetHeight - 6))) +
    'px';
  // At OPEN, synchronously, on the gesture that asked for it - askLiftLayers' rule, and
  // the reason the dialog's own name is what a screen reader is given first.
  p.focus();

  /** Still the panel on screen? The one await below re-asks before touching anything. */
  const live = (): boolean => !fc.disposed && fc.morePanel === p && p.isConnected;

  const cards = Array.from(p.querySelectorAll<HTMLButtonElement>('[data-choreo]'));
  const secIn = p.querySelector<HTMLInputElement>('[data-choreo-sec]')!;
  const staggerIn = p.querySelector<HTMLInputElement>('[data-choreo-stagger]')!;
  const orderSel = p.querySelector<HTMLSelectElement>('[data-choreo-order]')!;
  const camIn = p.querySelector<HTMLInputElement>('[data-choreo-camera]')!;
  const floatIn = p.querySelector<HTMLInputElement>('[data-choreo-float]')!;
  const tumbleIn = p.querySelector<HTMLInputElement>('[data-choreo-tumble]')!;
  const yes = p.querySelector<HTMLButtonElement>('[data-choreo-yes]')!;

  const pick = (id: ShowcaseId): void => {
    showcase = id;
    reflectChoreographChoice(p, id);
    if (!secDirty) secIn.value = secOf(id);
  };
  for (const c of cards) {
    c.addEventListener('click', (e) => {
      e.stopPropagation();
      pick(c.dataset.choreo as ShowcaseId);
    });
  }
  for (const quick of p.querySelectorAll<HTMLButtonElement>('[data-choreo-quick]')) {
    quick.addEventListener('click', () => { pick(quick.dataset.choreoQuick as ShowcaseId); camIn.checked = false; void run(); });
  }
  // Arrows walk the group, which is what calling it a radiogroup owes its keyboard users.
  p.querySelector('.fc-choreo-grid')?.addEventListener('keydown', (ev) => {
    const key = (ev as KeyboardEvent).key;
    const step =
      key === 'ArrowRight' || key === 'ArrowDown'
        ? 1
        : key === 'ArrowLeft' || key === 'ArrowUp'
          ? -1
          : 0;
    if (!step) return;
    ev.preventDefault();
    const at = cards.findIndex((c) => c.getAttribute('aria-checked') === 'true');
    const next = cards[(Math.max(0, at) + step + cards.length) % cards.length];
    if (next) {
      pick(next.dataset.choreo as ShowcaseId);
      next.focus();
    }
  });
  secIn.addEventListener('input', () => {
    secDirty = true;
  });
  // Enter in either number field commits, exactly as askNumber's does.
  for (const inp of [secIn, staggerIn]) {
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        void run();
      }
    });
  }
  p.querySelector<HTMLButtonElement>('[data-choreo-no]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    fc.document.closeMorePanel();
  });
  yes.addEventListener('click', (e) => {
    e.stopPropagation();
    void run();
  });

  /**
   * Read the panel, generate, commit ONCE - the tracks, any clip promotions and the
   * camera in a single undo step, which is `applyChoreograph`'s whole contract.
   */
  async function run(): Promise<void> {
  const { timeCfg } = fc;
    if (yes.disabled || !timeCfg) return;
    // The generator floors the arc at 0.8 s; say so in the field rather than let it read
    // 0.1 while a 0.8 s arc is made.
    let sec = parseFloat(secIn.value);
    if (secDirty && Number.isFinite(sec) && sec < 0.8) {
      sec = 0.8;
      secIn.value = '0.8';
    }
    const opts = {
      showcase,
      staggerMs: Math.max(0, Math.round(parseFloat(staggerIn.value) || 0)),
      order: orderSel.value as ChoreoOrder,
      camera: camIn.checked,
      float: floatIn.checked,
      tumble: tumbleIn.checked,
      // Left alone, the generator picks: a timed board's own clip span, and the
      // showcase's authored length on a board with no sequence yet.
      durationMs: secDirty && Number.isFinite(sec) ? Math.round(sec * 1000) : undefined,
    };
    yes.disabled = true;
    yes.textContent = t('Choreographing…');
    // Busy for the reason the lift's confirm is: the chunk fetch and the commit are work
    // in flight. The pressed button is now disabled, so park focus on the panel rather
    // than let the browser drop it on <body> and out of the dialog.
    p.setAttribute('aria-busy', 'true');
    p.focus();
    try {
      // LAZY, and this is why: choreograph.ts pulls timeline-math and with it the
      // engine's keyframe module - the same reason DEFAULT_CLIP_S is read through a
      // dynamic import rather than named at the top of this file.
      const { applyChoreograph, whyNotChoreograph } = await import('../choreograph.ts');
      if (!live()) return;
      const boxes = fc.select.getBoxes();
      const ids = choreoIds(fc, boxes);
      // A frames document opts out of depth and keyframe projection wholesale, so a
      // showcase written there would render as nothing: refuse, and say which.
      if (whyNotChoreograph(boxes, ids, timeCfg) === 'frames') {
        fc.stage.flash(
          t(
            'Choreograph works on a single artboard - a document with frames cannot be projected.'
          )
        );
        return;
      }
      const res = applyChoreograph(boxes, ids, opts, {
        cfg: timeCfg,
        rect: (b) => boxRect(b, cfg),
        stage: fc.helpers.canvasWH(),
        // The manifest's own camera seed, exactly as ensureSceneCameraRows mints one.
        cameraSeed: addKinds.find((k) => k.id === 'camera')?.seed,
        mint: (rows) => fc.select.freshId(rows),
      });
      if (!res) {
        fc.stage.flash(t('Select at least two boxes to choreograph.'));
        return;
      }
      fc.document.closeMorePanel();
      fc.selection = new Set(res.ids);
      fc.select.commit(res.rows);
      // A hundred new keyframes are invisible until the timeline is up, so open it
      // rather than leave the user to go looking for what just happened.
      fc.timeline.openTimeline();
      fc.stage.flash(t('Choreographed {n} boxes.', { n: res.ids.length }));
    } catch (e) {
      console.error(e);
      if (!fc.disposed) fc.stage.flash(t('That showcase could not be written, so nothing was changed.'));
    } finally {
      // Idempotent: on the happy path the panel is already gone and `live()` is false.
      if (live()) fc.document.closeMorePanel();
    }
  }
}
export function dialogsOps(fc: FcCtx) {
  return {
    parseDashText: bindOp(fc, parseDashText),
    openStrokePanel: bindOp(fc, openStrokePanel),
    askNumber: bindOp(fc, askNumber),
    askConfirm: bindOp(fc, askConfirm),
    askImportPages: bindOp(fc, askImportPages),
    liftTargetIndex: bindOp(fc, liftTargetIndex),
    canLift: bindOp(fc, canLift),
    liftBaseName: bindOp(fc, liftBaseName),
    askLiftLayers: bindOp(fc, askLiftLayers),
    runLift: bindOp(fc, runLift),
    canChoreograph: bindOp(fc, canChoreograph),
    isPosable: bindOp(fc, isPosable),
    choreoIds: bindOp(fc, choreoIds),
    canChoreographNow: bindOp(fc, canChoreographNow),
    askChoreograph: bindOp(fc, askChoreograph),
  };
}
