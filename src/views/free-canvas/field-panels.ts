// SPDX-License-Identifier: MPL-2.0
/**
 * free-canvas: the small field panels - dims, CSS, frame state, box class, notes, morph match, info, shape, text.
 *
 * Every function takes the shared `fc: FcCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `fc.<module>.<fn>`. Extracted verbatim
 * from initFreeCanvas() by scripts/split-closure.ts.
 */
import { num } from '../free-canvas-math.ts';
import type { Box } from '../free-canvas-math.ts';
import { dimsCell, opt, segHtml, wireSegs } from '../free-canvas-fields.ts';
import { pickPathPaint } from '../free-canvas-pen.ts';
import { mountCssEditor } from '../../lib/css-code-editor.ts';
import { escape as escapeText } from '../../utils.ts';
import { t, tRaw } from '../../i18n.ts';
import { SVG, icon } from '../free-canvas-icons.ts';
import { boolOf } from './shared.ts';
import { bindOp, type FcCtx } from './context.ts';

// Clamp a floating panel below-and-left of its anchor, inside the stage.
export function positionPanelBelow(fc: FcCtx, p: HTMLElement, anchor: HTMLElement): void {
  const { stageEl } = fc;
  const ar = anchor.getBoundingClientRect(),
    sr = stageEl.getBoundingClientRect();
  p.style.left = Math.max(6, Math.min(ar.left - sr.left, sr.width - p.offsetWidth - 8)) + 'px';
  p.style.top =
    Math.max(6, Math.min(ar.bottom - sr.top + 8, sr.height - p.offsetHeight - 8)) + 'px';
}
// ── Dimensions panel: manual X / Y / W / H / rotation for ONE box ─────────────
// Opened from the object bar's transform readout (single selection only - editing
// X on many boxes would stack them). Writes each field on `change`.
export function openDimsPanel(fc: FcCtx, anchor: HTMLElement): void {
  const { cfg, stageEl } = fc;
  fc.document.closeMorePanel();
  const boxes = fc.select.getBoxes();
  const idx = fc.select.selIndices(boxes);
  if (idx.length !== 1) return;
  const b: Box = boxes[idx[0]!] || {};
  const rd = (f: string, d: number): number => Math.round(fc.keys.clampN(b[f], d, -100000, 100000));
  const x = rd(cfg.xField, 0),
    y = rd(cfg.yField, 0);
  const w = Math.max(1, rd(cfg.wField, 1)),
    h = Math.max(1, rd(cfg.hField, 1));
  const rot = Math.round(fc.keys.clampN(b[cfg.rotationField], 0, -180, 180));
  // One labelled number cell: leading axis letter · the field · trailing unit. Shared
  // with the inspector's Object section - see ./free-canvas-fields.ts's `dimsCell`.
  const cell = dimsCell;
  const p = document.createElement('div');
  p.className = 'fc-panel fc-dims-panel';
  p.innerHTML =
    `<div class="fc-panel-head">${t('Position &amp; size')}</div>` +
    '<div class="fc-dims">' +
    `<div class="fc-dims-row"><span class="fc-dims-ic" data-tip="${escapeText(t('Position'))}">${icon(SVG.move)}</span>${cell(t('X'), cfg.xField, x)}${cell(t('Y'), cfg.yField, y)}</div>` +
    `<div class="fc-dims-row"><span class="fc-dims-ic" data-tip="${escapeText(t('Size'))}">${icon(SVG.size)}</span>${cell(t('W'), cfg.wField, w, true)}${cell(t('H'), cfg.hField, h, true)}</div>` +
    (cfg.rotationField
      ? `<div class="fc-dims-row fc-dims-rot"><span class="fc-dims-ic" data-tip="${escapeText(t('Rotation'))}">${icon(SVG.rotate)}</span>` +
        `<label class="fc-dims-f"><input type="number" min="-180" max="180" data-dm="${cfg.rotationField}" value="${rot}"><i>°</i></label>` +
        `<input type="range" class="field-range fc-dims-slider" min="-180" max="180" value="${rot}" aria-label="${escapeText(t('Rotation'))}" data-dm-slider></div>`
      : '') +
    '</div>';
  p.addEventListener('pointerdown', (e) => e.stopPropagation());
  // Number fields commit on `change`; W/H floor at 1 and rotation clamps to ±180.
  p.querySelectorAll<HTMLInputElement>('input[data-dm]').forEach((inp) =>
    { inp.addEventListener('change', () => {
      const f = inp.dataset.dm;
      let v = parseFloat(inp.value);
      if (!Number.isFinite(v)) return;
      if (f === cfg.wField || f === cfg.hField) v = Math.max(1, v);
      if (f === cfg.rotationField) {
        v = fc.keys.clampN(v, 0, -180, 180);
        inp.value = String(v);
      }
      setField(fc, f, Math.round(v * 100) / 100);
    }); }
  );
  // Rotation slider - drags live-mirror the number readout and commit once on
  // release, so a drag never floods the undo history with intermediate steps.
  if (cfg.rotationField) {
    const rotNum = p.querySelector<HTMLInputElement>(
      `input[type="number"][data-dm="${cfg.rotationField}"]`
    );
    const rotRange = p.querySelector<HTMLInputElement>('[data-dm-slider]');
    if (rotNum && rotRange) {
      rotRange.addEventListener('input', () => {
        rotNum.value = rotRange.value;
      });
      rotRange.addEventListener('change', () =>
        setField(fc, cfg.rotationField, fc.keys.clampN(parseFloat(rotRange.value), 0, -180, 180))
      );
      rotNum.addEventListener('input', () => {
        rotRange.value = rotNum.value;
      });
    }
  }
  stageEl.appendChild(p);
  fc.morePanel = p;
  positionPanelBelow(fc, p, anchor);
  // Anchor the readout drops BELOW the bar (readout sits at the bar's right end).
  const ar = anchor.getBoundingClientRect(),
    sr = stageEl.getBoundingClientRect();
  p.style.left =
    Math.max(6, Math.min(ar.right - sr.left - p.offsetWidth, sr.width - p.offsetWidth - 8)) +
    'px';
}
// ── Document info panel: rename the session/file + at-a-glance details ─────────
// Custom CSS editor panel (plan 112 M4): a highlighted, auto-completing editor bound to
// the doc-level `customCss` input. setInput (+ onDirty) applies it live to the editor,
// exports, and presentation, and rides undo/save like any other edit. rAF-coalesced, so
// per-keystroke re-render is a live preview, not churn.
export function openCssPanel(fc: FcCtx, anchor: HTMLElement): void {
  const { onDirty, runtime, stageEl } = fc;
  fc.document.closeMorePanel();
  const current = String(runtime.getModel().find((i) => i.id === 'customCss')?.value ?? '');
  const p = document.createElement('div');
  p.className = 'fc-panel fc-css-panel';
  p.innerHTML =
    `<div class="fc-panel-head">${t('Custom CSS')}</div>` +
    `<div class="fc-css-hint">${t('Applies to the editor, exports, and presentation. Target .lolly-box, a frame with [data-frame-id], or a present state like .pr-active.')}</div>` +
    '<div class="fc-css-mount"></div>';
  p.addEventListener('pointerdown', (e) => e.stopPropagation());
  stageEl.appendChild(p);
  fc.morePanel = p;
  positionPanelBelow(fc, p, anchor);
  mountCssEditor(p.querySelector<HTMLElement>('.fc-css-mount')!, {
    value: current,
    ariaLabel: t('Custom CSS'),
    placeholder: '.lolly-box { … }',
    onChange: (v) => {
      onDirty?.('customCss');
      runtime.setInput('customCss', v);
    },
  });
}
// Per-frame present `state` panel (plan 112 M4): a one-field editor for a selected
// frame's state tokens. Commits on change (blur), not per keystroke - state has no live
// editor effect (it themes present mode), so there is no reason to churn the boxes array.
export function openFrameStatePanel(fc: FcCtx, anchor: HTMLElement, frameIdx: number): void {
  const { stageEl } = fc;
  fc.document.closeMorePanel();
  const cur = String(fc.select.getBoxes()[frameIdx]?.state ?? '');
  const p = document.createElement('div');
  p.className = 'fc-panel fc-fstate-panel';
  p.innerHTML =
    `<div class="fc-panel-head">${t('Frame state')}</div>` +
    `<div class="fc-css-hint">${t('Space-separated tokens for present mode. Stamped as data-frame-state on the frame - target them in Custom CSS, e.g. [data-frame-state~="dark"] .lolly-box { … }. Also lifted onto the presenter root while this slide is active.')}</div>` +
    `<input type="text" class="fc-fstate-input field-input" value="${fc.keys.escapeHtml(cur)}" placeholder="dark title-slide" spellcheck="false" autocomplete="off" autocapitalize="off">`;
  p.addEventListener('pointerdown', (e) => e.stopPropagation());
  stageEl.appendChild(p);
  fc.morePanel = p;
  positionPanelBelow(fc, p, anchor);
  const input = p.querySelector<HTMLInputElement>('.fc-fstate-input');
  input?.addEventListener('change', () => {
    const boxes = fc.select.getBoxes();
    if (frameIdx < boxes.length)
      fc.select.commit(boxes.map((b, i) => (i === frameIdx ? { ...b, state: input.value } : b)));
  });
  input?.focus();
}
// Per-box CSS class names (plan 112 M4): the author's handle for Custom CSS. Commits on
// change (blur) like the frame-state panel - the hook re-renders the box with the new
// class list, and the doc-level Custom CSS rules then apply live.
export function openBoxClassPanel(fc: FcCtx, anchor: HTMLElement, boxIdx: number): void {
  const { stageEl } = fc;
  fc.document.closeMorePanel();
  const cur = String(fc.select.getBoxes()[boxIdx]?.cls ?? '');
  const p = document.createElement('div');
  p.className = 'fc-panel fc-fstate-panel';
  p.innerHTML =
    `<div class="fc-panel-head">${t('CSS class')}</div>` +
    `<div class="fc-css-hint">${t('Space-separated class names for this box (a–z, 0–9, -, _). Target them in Custom CSS, e.g. .callout { outline: 2px solid red }, on the canvas, in exports and while presenting. Names beginning lolly- pr- seq- fc- belong to the app and are dropped.')}</div>` +
    `<input type="text" class="fc-fstate-input field-input" value="${fc.keys.escapeHtml(cur)}" placeholder="callout hero" spellcheck="false" autocomplete="off" autocapitalize="off">`;
  p.addEventListener('pointerdown', (e) => e.stopPropagation());
  stageEl.appendChild(p);
  fc.morePanel = p;
  positionPanelBelow(fc, p, anchor);
  const input = p.querySelector<HTMLInputElement>('.fc-fstate-input');
  input?.addEventListener('change', () => {
    const boxes = fc.select.getBoxes();
    if (boxIdx < boxes.length)
      fc.select.commit(boxes.map((b, i) => (i === boxIdx ? { ...b, cls: input.value } : b)));
  });
  input?.focus();
}
// Speaker notes (plan 112 M5): a multi-line note the presenter reads while this slide is
// active in the speaker view - never rendered on the slide the audience sees.
export function openSpeakerNotesPanel(fc: FcCtx, anchor: HTMLElement, frameIdx: number): void {
  const { FRAME_NOTES_FIELD, stageEl } = fc;
  fc.document.closeMorePanel();
  const cur = String(fc.select.getBoxes()[frameIdx]?.[FRAME_NOTES_FIELD] ?? '');
  const p = document.createElement('div');
  p.className = 'fc-panel fc-notes-panel';
  p.innerHTML =
    `<div class="fc-panel-head">${t('Speaker notes')}</div>` +
    `<div class="fc-css-hint">${t('Shown only in the speaker view (press S while presenting) while this slide is active. Never rendered on the slide itself.')}</div>` +
    `<textarea class="fc-notes-input field-input" rows="5" spellcheck="true" placeholder="${fc.keys.escapeHtml(t('What to say on this slide…'))}">${fc.keys.escapeHtml(cur)}</textarea>`;
  p.addEventListener('pointerdown', (e) => e.stopPropagation());
  stageEl.appendChild(p);
  fc.morePanel = p;
  positionPanelBelow(fc, p, anchor);
  const input = p.querySelector<HTMLTextAreaElement>('.fc-notes-input');
  input?.addEventListener('change', () => {
  const { FRAME_NOTES_FIELD } = fc;
    const boxes = fc.select.getBoxes();
    if (frameIdx < boxes.length)
      fc.select.commit(
        boxes.map((b, i) => (i === frameIdx ? { ...b, [FRAME_NOTES_FIELD]: input.value } : b))
      );
  });
  input?.focus();
}
// Morph match (plan 112 M5): the explicit pairing key for the morph slide
// transition. Two boxes on different slides carrying the SAME tag morph into each
// other, overriding the implicit matching (identical text, or the same image).
export function openMorphMatchPanel(fc: FcCtx, anchor: HTMLElement, boxIdx: number): void {
  const { stageEl } = fc;
  fc.document.closeMorePanel();
  const cur = String(fc.select.getBoxes()[boxIdx]?.matchOf ?? '');
  const p = document.createElement('div');
  p.className = 'fc-panel fc-fstate-panel';
  p.innerHTML =
    `<div class="fc-panel-head">${t('Morph match')}</div>` +
    `<div class="fc-css-hint">${t('Give this box and its partner on another slide the same tag; the morph slide transition then moves between them. Boxes with identical text or the same image already match on their own - the tag overrides that.')}</div>` +
    `<input type="text" class="fc-fstate-input field-input" value="${fc.keys.escapeHtml(cur)}" placeholder="hero" spellcheck="false" autocomplete="off" autocapitalize="off">`;
  p.addEventListener('pointerdown', (e) => e.stopPropagation());
  stageEl.appendChild(p);
  fc.morePanel = p;
  positionPanelBelow(fc, p, anchor);
  const input = p.querySelector<HTMLInputElement>('.fc-fstate-input');
  input?.addEventListener('change', () => {
    const boxes = fc.select.getBoxes();
    if (boxIdx < boxes.length)
      fc.select.commit(boxes.map((b, i) => (i === boxIdx ? { ...b, matchOf: input.value.trim() } : b)));
  });
  input?.focus();
}
export function openInfoPanel(fc: FcCtx, anchor: HTMLElement): void {
  const { info, stageEl } = fc;
  fc.document.closeMorePanel();
  const d = fc.helpers.canvasWH();
  const fname = info?.getFilename?.() ?? '';
  const p = document.createElement('div');
  p.className = 'fc-panel fc-info-panel';
  p.innerHTML =
    `<div class="fc-panel-head">${t('Document')}</div>` +
    `<label class="fc-row"><span>${t('Name')}</span><input type="text" data-info="filename" value="${fc.keys.escapeHtml(fname)}" placeholder="${fc.keys.escapeHtml(t('Untitled'))}"></label>` +
    '<div class="fc-info-meta">' +
    `<div class="fc-info-line"><span>${t('Last edited')}</span><b data-info-edited>…</b></div>` +
    `<div class="fc-info-line"><span>${t('Canvas')}</span><b>${d.w} × ${d.h} px</b></div>` +
    (info?.name
      ? `<div class="fc-info-line"><span>${t('Tool')}</span><b>${fc.keys.escapeHtml(info!.name)}${info!.version ? ' · v' + fc.keys.escapeHtml(info!.version) : ''}</b></div>`
      : '') +
    (info?.status
      ? `<div class="fc-info-line"><span>${t('Status')}</span><b>${fc.keys.escapeHtml(info!.status)}</b></div>`
      : '') +
    (info?.formats?.length
      ? `<div class="fc-info-line"><span>${t('Exports')}</span><b>${info!.formats!.map(fc.keys.escapeHtml).join(', ')}</b></div>`
      : '') +
    '</div>' +
    // Provenance: what travels in the exported file's metadata. Read-only display +
    // an opt in/out toggle; the name/contact are edited in the profile.
    (info?.provenance
      ? `<div class="fc-panel-head fc-info-sub">${t('Embedded in exports')}</div>` +
        `<label class="fc-row fc-row-toggle field-toggle"><span>${t('Credit me')}</span><input type="checkbox" class="field-check" data-info="optin" disabled></label>` +
        '<div class="fc-info-meta">' +
        `<div class="fc-info-line"><span>${t('Made with')}</span><b>Lolly · lolly.tools</b></div>` +
        `<div class="fc-info-line" data-prov="author" hidden><span>${t('Name')}</span><b></b></div>` +
        `<div class="fc-info-line" data-prov="contact" hidden><span>${t('Contact')}</span><b></b></div>` +
        '<div class="fc-info-note" data-prov="note"></div>' +
        '</div>'
      : '');
  p.addEventListener('pointerdown', (e) => e.stopPropagation());
  const fn = p.querySelector<HTMLInputElement>('[data-info="filename"]');
  fn?.addEventListener('input', () => info?.setFilename?.(fn!.value));
  stageEl.appendChild(p);
  fc.morePanel = p;
  positionPanelBelow(fc, p, anchor);
  // Last-edited resolves async (reads the saved session's timestamp).
  Promise.resolve(info?.lastEdited?.())
    .then((iso) => {
      const el = p.querySelector<HTMLElement>('[data-info-edited]');
      if (el) el.textContent = iso ? fc.keys.fmtDate(iso) : t('Not saved yet');
    })
    .catch(() => {});
  // Provenance section fills async (reads the profile) then wires the opt-in toggle.
  const prov = info?.provenance;
  if (prov) {
    const optin = p.querySelector<HTMLInputElement>('[data-info="optin"]');
    const authorRow = p.querySelector<HTMLElement>('[data-prov="author"]');
    const contactRow = p.querySelector<HTMLElement>('[data-prov="contact"]');
    const note = p.querySelector<HTMLElement>('[data-prov="note"]');
    const editLink = prov.editHref
      // nosemgrep: lolly-href-escape-is-not-scheme-validation - editHref's only caller passes the literal '#/profile?focus=use-details' (views/tool.ts)
      ? ` <a href="${fc.keys.escapeHtml(prov.editHref)}">${t('Edit details')}</a>`
      : '';
    const paint = (optedIn: boolean, author: string, contact: string): void => {
      if (optin) optin.checked = optedIn;
      if (authorRow) {
        authorRow.hidden = !(optedIn && author);
        authorRow.querySelector('b')!.textContent = author;
      }
      if (contactRow) {
        contactRow.hidden = !(optedIn && contact);
        contactRow.querySelector('b')!.textContent = contact;
      }
      if (note) {
        note.innerHTML = optedIn
          ? author || contact
            ? t('Baked into your PNG, PDF & SVG file metadata.')
            : tRaw('No name on file yet -{action} to be credited.', {
                action: editLink || ` ${t('add your details in your profile')}`,
              })
          : tRaw('Your name &amp; contact stay off your files.{link}', { link: editLink });
      }
    };
    prov
      .get()
      .then(({ optedIn, author, contact }) => {
        if (optin) optin.disabled = false;
        paint(optedIn, author, contact);
        optin?.addEventListener('change', () => {
          const on = optin.checked;
          paint(on, author, contact); // reflect immediately
          optin.disabled = true;
          Promise.resolve(prov.setOptIn(on))
            .catch(() => {
              optin.checked = !on;
              paint(!on, author, contact);
            }) // revert on failure
            .finally(() => {
              optin.disabled = false;
            });
        });
      })
      .catch(() => {});
  }
}
// ── field editing (applies to all selected boxes) ────────────────────────────
export function setField(fc: FcCtx, field: string | undefined, value: any): void {
  const { penPaintFields } = fc;
  if (!field) return;
  const boxes = fc.select.getBoxes();
  const idx = fc.select.selIndices(boxes);
  const sel = new Set(idx);
  const next = boxes.map((b, i) => (sel.has(i) ? { ...b, [field]: value } : b));
  // Recolouring a path is what teaches the pen its next paint. Every paint control on
  // both bars (and the whole stroke panel) writes through here, so this is the one place
  // that has to notice - and it is gated on the selection being ALL paths so restyling a
  // text box or an image can't hand the pen a fill that means nothing for a curve.
  if (idx.length > 0 && fc.contextBar.selectionAllPaths(boxes, idx)) {
    const remembered = pickPathPaint(penPaintFields, next[idx[0]!]);
    if (remembered) fc.penLastPaint = remembered;
  }
  fc.select.commit(next);
}
// Is this box a circle? (An ellipse the geometry keeps square - see setShape.)
export const isCircle = (fc: FcCtx, b: Box | undefined): boolean =>
  { const { cfg } = fc; return !!cfg.shapeField && String(b?.[cfg.shapeField]) === 'circle'; };
// Set the shape on the selection. "circle" additionally squares each box to its
// smaller side about its centre (an inscribed circle), in the SAME commit as the
// shape change (one undo step) - otherwise a w≠h box would render as an ellipse and
// the label would lie. Any other shape writes straight through.
export function setShape(fc: FcCtx, v: string | undefined): void {
  const { cfg } = fc;
  if (!cfg.shapeField) return;
  if (v !== 'circle' || !cfg.wField || !cfg.hField) {
    setField(fc, cfg.shapeField, v);
    return;
  }
  const boxes = fc.select.getBoxes();
  const sel = new Set(fc.select.selIndices(boxes));
  fc.select.commit(
    boxes.map((b, i) => {
      if (!sel.has(i)) return b;
      const w = Math.max(1, num(b[cfg.wField], 1));
      const h = Math.max(1, num(b[cfg.hField], 1));
      const d = Math.round(Math.min(w, h));
      const cx = num(b[cfg.xField], 0) + w / 2;
      const cy = num(b[cfg.yField], 0) + h / 2;
      return {
        ...b,
        [cfg.shapeField]: 'circle',
        [cfg.wField]: d,
        [cfg.hField]: d,
        [cfg.xField]: Math.round(cx - d / 2),
        [cfg.yField]: Math.round(cy - d / 2),
      };
    })
  );
}
export function bumpFont(fc: FcCtx, delta: number): void {
  const { cfg } = fc;
  if (!cfg.fontSizeField) return;
  const boxes = fc.select.getBoxes();
  const sel = new Set(fc.select.selIndices(boxes));
  fc.select.commit(
    boxes.map((b, i) => {
      if (!sel.has(i)) return b;
      const cur = parseFloat(String(b[cfg.fontSizeField]));
      const base = Number.isFinite(cur) ? cur : 48;
      return { ...b, [cfg.fontSizeField]: Math.max(4, base + delta) };
    })
  );
}
// `segHtml`, `POS9`/`posGridHtml` and `wireSegs` used to live here as closures over
// `setField`. They are ./free-canvas-fields.ts's now (plans/179 M3), so the Design
// inspector column renders the same rows from the same builder - and `wireSegs` takes
// an explicit `onSet` at every call site, because a shared builder that writes through
// one panel's closure by default is not shared.
// ── Text panel: font · size · weight · line height · align · vertical · padding ─
// In editor layout there is NO sidebar, so this panel is the only place these
// typographic properties (several of which were previously unreachable) can be
// set. Every control shows and writes the selected box's current value.
export function openTextPanel(fc: FcCtx, anchor: HTMLElement): void {
  const { cfg, defaultFont, stageEl } = fc;
  fc.document.closeMorePanel();
  const boxes = fc.select.getBoxes();
  const idx = fc.select.selIndices(boxes);
  if (!idx.length) return;
  const b: Box = boxes[idx[0]!] || {};
  const fontCur = String(b[cfg.fontField] || defaultFont);
  const sizeCur = Math.max(1, Math.round(parseFloat(String(b[cfg.fontSizeField])) || 48));
  const weightCur = String(b[cfg.weightField] || '700');
  const lhRaw = parseFloat(String(b[cfg.lineHeightField]));
  const lhCur = Number.isFinite(lhRaw) ? lhRaw : 1.12;
  // Defaults here MUST match hooks.js textCss so the panel shows the real rendered
  // value for a box that hasn't set the field yet (pad defaults to 8, not 0).
  const padRaw = parseFloat(String(b[cfg.padField]));
  const padCur = Math.max(0, Math.round(Number.isFinite(padRaw) ? padRaw : 8));
  const trRaw = parseFloat(String(b[cfg.trackingField]));
  const trCur = Number.isFinite(trRaw) ? trRaw : 0;
  const ligCur = boolOf(b[cfg.ligaturesField], true);
  const altCur = boolOf(b[cfg.alternatesField], false);
  const fitCur = boolOf(b[cfg.fitTextField], false);
  const alignCur = String(b[cfg.alignField] || 'center');
  const valignCur = String(b[cfg.valignField] || 'middle');
  const p = document.createElement('div');
  p.className = 'fc-panel fc-text-panel';
  p.innerHTML =
    `<div class="fc-panel-head">${t('Text')}</div>` +
    (cfg.fontField
      ? `<label class="fc-row"><span>${t('Font')}</span><select class="field-select field-select--sm" data-tp="font">${fc.helpers.fontOptionsHtml(fontCur)}</select></label>`
      : '') +
    // Size row now carries the A−/A+ steppers (moved off the object bar) around the number.
    (cfg.fontSizeField
      ? `<div class="fc-row"><span>${t('Size')}</span><div class="fc-stepper">
        <button type="button" class="fc-cbtn" data-tp="smaller" data-tip="${escapeText(t('Smaller'))}" aria-label="${escapeText(t('Smaller text'))}">A−</button>
        <input type="number" min="4" max="2000" data-tp="size" value="${sizeCur}">
        <button type="button" class="fc-cbtn" data-tp="bigger" data-tip="${escapeText(t('Bigger'))}" aria-label="${escapeText(t('Bigger text'))}">A+</button>
      </div></div>`
      : '') +
    (cfg.weightField
      ? `<label class="fc-row"><span>${t('Weight')}</span><select class="field-select field-select--sm" data-tp="weight">${fc.helpers.weightChoicesFor(
            fontCur
          )
            .map(([v, l]) => opt(v, t(l), weightCur))
            .join('')}</select></label>`
      : '') +
    (cfg.lineHeightField
      ? `<label class="fc-row"><span>${t('Line height')}</span><input type="range" class="field-range" min="0.7" max="3" step="0.01" data-tp="lh" value="${lhCur}"><b data-tp-val="lh">${lhCur.toFixed(2)}</b></label>`
      : '') +
    (cfg.trackingField
      ? `<label class="fc-row"><span>${t('Letter spacing')}</span><input type="range" class="field-range" min="-20" max="100" step="0.5" data-tp="tr" value="${trCur}"><b data-tp-val="tr">${trCur}</b></label>`
      : '') +
    (cfg.ligaturesField
      ? `<label class="fc-row fc-row-toggle field-toggle"><span>${t('Ligatures')}</span><input type="checkbox" class="field-check" data-tp="lig"${ligCur ? ' checked' : ''}></label>`
      : '') +
    (cfg.alternatesField
      ? `<label class="fc-row fc-row-toggle field-toggle"><span>${t('Alternates')}</span><input type="checkbox" class="field-check" data-tp="alt"${altCur ? ' checked' : ''}></label>`
      : '') +
    // Shrink-to-fit: on → the text scales down to fit the box (never up); off → the box
    // grows to the text (the default). See the hooks.js fit pass driven by data-fit.
    (cfg.fitTextField
      ? `<label class="fc-row fc-row-toggle field-toggle"><span>${t('Shrink text to fit')}</span><input type="checkbox" class="field-check" data-tp="fit"${fitCur ? ' checked' : ''}></label>`
      : '') +
    (cfg.alignField
      ? `<div class="fc-row"><span>${t('Align')}</span>${segHtml(cfg.alignField, alignCur, [
            ['left', t('Align left'), SVG.textL],
            ['center', t('Align centre'), SVG.textC],
            ['right', t('Align right'), SVG.textR],
          ])}</div>`
      : '') +
    (cfg.valignField
      ? `<div class="fc-row"><span>${t('Vertical')}</span>${segHtml(cfg.valignField, valignCur, [
            ['top', t('Align top'), SVG.textT],
            ['middle', t('Centre vertically'), SVG.textM],
            ['bottom', t('Align bottom'), SVG.textB],
          ])}</div>`
      : '') +
    (cfg.padField
      ? `<label class="fc-row"><span>${t('Padding')}</span><input type="range" class="field-range" min="0" max="200" data-tp="pad" value="${padCur}"><b data-tp-val="pad">${padCur}</b></label>`
      : '');
  p.addEventListener('pointerdown', (e) => e.stopPropagation());
  p.querySelector<HTMLButtonElement>('[data-tp="smaller"]')?.addEventListener('click', () => {
    bumpFont(fc, -6);
    const s = p.querySelector<HTMLInputElement>('[data-tp="size"]');
    if (s) s.value = String(Math.max(4, (parseInt(s.value, 10) || 48) - 6));
  });
  p.querySelector<HTMLButtonElement>('[data-tp="bigger"]')?.addEventListener('click', () => {
    bumpFont(fc, 6);
    const s = p.querySelector<HTMLInputElement>('[data-tp="size"]');
    if (s) s.value = String((parseInt(s.value, 10) || 48) + 6);
  });
  p.querySelectorAll<HTMLSelectElement>('select[data-tp]').forEach((sel) =>
    { sel.addEventListener('change', () => {
      if (sel.dataset.tp !== 'font') {
        setField(fc, cfg.weightField, sel.value);
        return;
      }
      // Font change: mono cuts have no 900, so clamp any Black boxes to 800 in
      // the SAME commit (one undo step), then refresh the weight menu to match.
      const font = sel.value;
      const bx = fc.select.getBoxes();
      const selSet = new Set(fc.select.selIndices(bx));
      fc.select.commit(
        bx.map((row, k) => {
          if (!selSet.has(k)) return row;
          const nb = { ...row, [cfg.fontField]: font };
          if (
            cfg.weightField &&
            fc.helpers.isMonoFont(font) &&
            (parseInt(String(nb[cfg.weightField]), 10) || 700) > 800
          )
            nb[cfg.weightField] = '800';
          return nb;
        })
      );
      const wSel = p.querySelector<HTMLSelectElement>('select[data-tp="weight"]');
      if (wSel) {
        const cur = Math.min(parseInt(wSel.value, 10) || 700, fc.helpers.maxWeightFor(font));
        wSel.innerHTML = fc.helpers.weightChoicesFor(font)
          .map(([v, l]) => opt(v, t(l), String(cur)))
          .join('');
      }
    }); }
  );
  p.querySelectorAll<HTMLInputElement>('input[type="number"][data-tp]').forEach((inp) =>
    { inp.addEventListener('change', () => {
      const v = parseInt(inp.value, 10);
      if (Number.isFinite(v) && v >= 4) setField(fc, cfg.fontSizeField, v);
    }); }
  );
  p.querySelectorAll<HTMLInputElement>('input[type="range"][data-tp]').forEach((rng) =>
    { rng.addEventListener('input', () => {
      const k = rng.dataset.tp;
      const valEl = p.querySelector<HTMLElement>(`[data-tp-val="${k}"]`);
      if (k === 'lh') {
        if (valEl) valEl.textContent = (+rng.value).toFixed(2);
        setField(fc, cfg.lineHeightField, +rng.value);
      } else if (k === 'tr') {
        if (valEl) valEl.textContent = rng.value;
        setField(fc, cfg.trackingField, +rng.value);
      } else {
        if (valEl) valEl.textContent = rng.value;
        setField(fc, cfg.padField, +rng.value);
      }
    }); }
  );
  const cbField: Record<string, string> = {
    lig: cfg.ligaturesField,
    alt: cfg.alternatesField,
    fit: cfg.fitTextField,
  };
  p.querySelectorAll<HTMLInputElement>('input[type="checkbox"][data-tp]').forEach((cb) =>
    { cb.addEventListener('change', () => {
      setField(fc, cbField[cb.dataset.tp!], cb.checked);
    }); }
  );
  wireSegs(p, (field, v) => setField(fc, field, v));
  stageEl.appendChild(p);
  fc.morePanel = p;
  const ar = anchor.getBoundingClientRect();
  const sr = stageEl.getBoundingClientRect();
  p.style.left = Math.max(6, Math.min(ar.left - sr.left, sr.width - p.offsetWidth - 8)) + 'px';
  p.style.top =
    Math.max(6, Math.min(ar.bottom - sr.top + 8, sr.height - p.offsetHeight - 8)) + 'px';
}
export function fieldPanelsOps(fc: FcCtx) {
  return {
    positionPanelBelow: bindOp(fc, positionPanelBelow),
    openDimsPanel: bindOp(fc, openDimsPanel),
    openCssPanel: bindOp(fc, openCssPanel),
    openFrameStatePanel: bindOp(fc, openFrameStatePanel),
    openBoxClassPanel: bindOp(fc, openBoxClassPanel),
    openSpeakerNotesPanel: bindOp(fc, openSpeakerNotesPanel),
    openMorphMatchPanel: bindOp(fc, openMorphMatchPanel),
    openInfoPanel: bindOp(fc, openInfoPanel),
    setField: bindOp(fc, setField),
    isCircle: bindOp(fc, isCircle),
    setShape: bindOp(fc, setShape),
    bumpFont: bindOp(fc, bumpFont),
    openTextPanel: bindOp(fc, openTextPanel),
  };
}
