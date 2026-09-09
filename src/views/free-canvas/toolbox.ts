// SPDX-License-Identifier: MPL-2.0
/**
 * free-canvas: rail drag, the toolbar and its buttons, the background field and fill popover.
 *
 * Every function takes the shared `fc: FcCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `fc.<module>.<fn>`. Extracted verbatim
 * from initFreeCanvas() by scripts/split-closure.ts.
 */
import { activeFrameIdFor } from '../free-canvas-math.ts';
import { LOLLY_MARK_SVG } from '../../lib/lolly-mark.ts';
import { t } from '../../i18n.ts';
import { wireColorField } from '../../components/color-field.ts';
import { SVG, icon } from '../free-canvas-icons.ts';
import type { PopItem } from './shared.ts';
import { bindOp, type FcCtx } from './context.ts';

export function closePopover(fc: FcCtx, restoreFocus = false): void {
  const anchor = fc.popoverAnchor;
  fc.popoverAnchor = null;
  fc.popover?.remove();
  fc.popover = null;
  if (!anchor) return;
  if (anchor.hasAttribute('aria-haspopup')) anchor.setAttribute('aria-expanded', 'false');
  // Only when the CLOSE came from the keyboard: a pointer dismiss has already moved
  // focus wherever the user clicked, and yanking it back would fight them.
  if (restoreFocus && anchor.isConnected) anchor.focus();
}
/**
 * A rail button, optionally with a press-and-hold menu of its own.
 *
 * `hold` is the touch-reachable half of a right-click: press and keep pressing, or
 * right-click, and the tool offers its options instead of running. The short click is
 * untouched - the tool still does its main job on a tap, which is what makes this safe
 * to add to a button people already use. The two never both fire: a hold that opened a
 * menu swallows the click that the pointerup would otherwise deliver.
 */
export function toolBtn(fc: FcCtx, 
  label: string,
  svg: string,
  onClick: (b: HTMLButtonElement, e: MouseEvent) => void,
  extraClass = '',
  hold?: (b: HTMLButtonElement) => void
): HTMLButtonElement {
  const { toolbar } = fc;
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'fc-btn ' + extraClass;
  b.setAttribute('data-tip', label);
  b.setAttribute('aria-label', label);
  b.innerHTML = icon(svg);
  let holdTimer: ReturnType<typeof setTimeout> | 0 = 0;
  let holdFired = false;
  let holdFrom: { x: number; y: number } | null = null;
  const cancelHold = (): void => {
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = 0;
    }
    holdFrom = null;
  };
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    // The pointerup that ends a hold still delivers a click. Eat exactly that one.
    if (holdFired) {
      holdFired = false;
      return;
    }
    onClick(b, e);
  });
  b.addEventListener('pointerdown', (e) => {
  const { HOLD_MS } = fc;
    e.stopPropagation();
    if (!hold || e.button > 0) return; // secondary buttons take the contextmenu path
    holdFired = false;
    holdFrom = { x: e.clientX, y: e.clientY };
    // Bare `setTimeout`/`clearTimeout`, matching `flashTimer` above - pairing
    // `window.setTimeout` with a bare `clearTimeout` cancels nothing wherever the two
    // are not the same object, which is every jsdom-hosted test in this file.
    holdTimer = setTimeout(() => {
      holdTimer = 0;
      holdFired = true;
      hold(b);
    }, HOLD_MS);
  });
  if (hold) {
    // A press that travels is someone scrolling the rail, not someone holding it.
    b.addEventListener('pointermove', (e) => {
    const { HOLD_SLOP } = fc;
      if (holdFrom && Math.hypot(e.clientX - holdFrom.x, e.clientY - holdFrom.y) > HOLD_SLOP)
        cancelHold();
    });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave'])
      b.addEventListener(ev, cancelHold);
    b.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      cancelHold();
      hold(b);
    });
    b.setAttribute('aria-haspopup', 'true');
  }
  toolbar.appendChild(b);
  return b;
}
export function buildToolbar(fc: FcCtx): void {
  const { actions, cv, designChrome, frameCfg, hasBindCfg, history, importCfg, info, modeBtns, onDirty, pages, runtime, setCanvasSize, stageEl, timeCfg, toolbar } = fc;
  // ONE menu at the top of the rail, behind Lolly's own mark: every DOCUMENT-level
  // action - export, save, undo/redo, canvas size, copy, share, document info,
  // import. The rail underneath it is tools only. The trigger is the brand-hued
  // identity mark (--lolly-mark), never the verify verdict green.
  //
  // Export/Save still go through opts.actions (which .click() the hidden
  // #render-fab / #render-save) - no duplicated export or save logic anywhere.
  let histUndo = false,
    histRedo = false;
  if (history) {
    history.register((canUndo, canRedo) => {
      histUndo = canUndo;
      histRedo = canRedo;
      // The pair keeps the menu open so you can step back repeatedly, so its
      // enabled state has to follow the stack live rather than freeze at open.
      // (The Cmd/Ctrl-Z shortcuts are the shell's own and never touched the rail.)
      const u = fc.popover?.querySelector<HTMLButtonElement>('[data-pop="undo"]');
      const r = fc.popover?.querySelector<HTMLButtonElement>('[data-pop="redo"]');
      const active = document.activeElement;
      if (active === u && !canUndo && canRedo) r?.focus();
      else if (active === r && !canRedo && canUndo) u?.focus();
      if (u) u.disabled = !canUndo;
      if (r) r.disabled = !canRedo;
    });
  }
  let lollyBtn: HTMLButtonElement | null = null;
  /**
   * WHERE THE MARK MENU IS HANGING FROM right now. The menu has two triggers - the
   * rail's own mark and the Design top bar's (`openLollyMenu`) - and four of its rows
   * open a PANEL that positions itself under its anchor. Hard-wiring `lollyBtn` there
   * put "Artboard size" / "Custom CSS" / "Document info" / "Import" on the far left of
   * the stage, docked to a rail button, whenever the menu had been opened from the bar.
   */
  const anchorEl = (): HTMLElement => fc.lollyAnchor ?? lollyBtn!;
  /**
   * Is a Design TOP BAR mounted over this stage (plans/179 M1)? `opts.chrome` is only
   * handed over by a tool view that mounted one, so its presence is the signal - not a
   * media query, and not a guess from the layout.
   *
   * When it is, the menu stops being the editor's only door to the document actions and
   * becomes what a menu is for: the long tail. Export, Save, Copy, Share, Undo, Redo,
   * Slide transition and Present all have their own visible control up there, and a
   * second copy of each is a second thing to keep in step (the Undo rows in particular
   * would fight the bar over `history.register`'s single slot). What only a menu can
   * hold - Theme and Interface sounds, which used to ride the zoom HUD the bar retires -
   * moves IN. Without a bar the menu is byte-identical to what it has always been.
   */
  const barMounted = !!designChrome;
  /**
   * …and is that bar in its NARROW form? Under 640px design-topbar.css folds the
   * centre cluster (undo/redo, the zoom cluster, the panel toggles) and Share away,
   * and its comment has always said they "fold into the mark menu" - this is where
   * they land, so a phone is not left with no undo at all.
   *
   * Read off the LIVE DOM rather than a second copy of the breakpoint: `offsetParent`
   * is null exactly when a rule has taken the element out of the layout, so the menu
   * grows the rows the bar dropped whatever that sheet decides. NO BAR at all reads as
   * "not folded" - the bar's own controls are then not the ones missing. A bar that
   * cannot be measured (a host with no layout engine) reads as folded, which is the
   * safe direction: the cost is a duplicated row, and the cost of guessing the other
   * way is a phone with no undo.
   */
  const barFolded = (): boolean => {
    if (!barMounted) return false;
    const centre = stageEl.querySelector<HTMLElement>('.design-topbar .dtb-centre');
    return !!centre && centre.offsetParent === null;
  };
  const lollyItems = (): PopItem[] => {
    const items: PopItem[] = [];
    // Export leads - it's the star of the Lolly menu. Present is added LAST (very bottom).
    if (actions && !barMounted) {
      items.push({
        label: t('Export'),
        icon: icon(SVG.exportUp),
        key: 'export',
        run: () => actions.export(),
      });
      if (actions.canSave !== false)
        items.push({
          label: t('Save to your library'),
          icon: icon(SVG.save),
          key: 'save',
          run: () => actions.save(),
        });
      // Copy + Share ride directly under Save with NO divider - the on-device outputs of
      // the same "you've made something, now get it out" moment. "Share" reads plainly now
      // that the target can be a .lolly file or a private collab, not just a URL.
      items.push({
        label: t('Copy image to clipboard'),
        icon: icon(SVG.dup),
        key: 'copy',
        run: () => actions.copy(),
      });
      items.push({
        label: t('Share'),
        icon: icon(SVG.share),
        key: 'share',
        run: () => actions.share(),
      });
    }
    // The one action the bar hands BACK: saving is the render pill's, and the pill is
    // hidden in editor layout, so the menu keeps the door open when the view offers it.
    if (barMounted && designChrome?.saveToLibrary) {
      items.push({
        label: t('Save to your library'),
        icon: icon(SVG.save),
        key: 'save',
        run: () => designChrome.saveToLibrary!(),
      });
    }
    // Share is hidden with the bar's centre under 640px, and a phone has no ⌘Z, so
    // the two rows the fold takes away come back here (see barFolded).
    if (actions && barMounted && barFolded()) {
      items.push({
        label: t('Share'),
        icon: icon(SVG.share),
        key: 'share',
        run: () => actions.share(),
      });
    }
    if (history && (!barMounted || barFolded())) {
      if (items.length) items.push({ sep: true });
      items.push({
        label: t('Undo - step back'),
        icon: icon(SVG.undo),
        key: 'undo',
        disabled: !histUndo,
        keepOpen: true,
        run: () => history.undo(),
      });
      items.push({
        label: t('Redo - step forward'),
        icon: icon(SVG.redo),
        key: 'redo',
        disabled: !histRedo,
        keepOpen: true,
        run: () => history.redo(),
      });
    }
    // The inspector's toggle is folded away with the rest of the bar's centre, and
    // with nothing selected the object bar (its other door) does not exist either -
    // so the column would be unreachable on a phone. It closes from its own header.
    if (fc.inspectorPort && barFolded()) {
      items.push({
        label: t('Inspector'),
        icon: icon(SVG.more),
        key: 'inspector',
        run: () => fc.inspectorPort?.reveal('document'),
      });
    }
    if (pages || setCanvasSize) {
      if (items.length) items.push({ sep: true });
      if (pages)
        items.push({
          label: t('Pages & page size'),
          icon: icon(SVG.pages),
          key: 'pages',
          run: () => fc.document.openPagesMenu(anchorEl()),
        });
      else
        items.push({
          label: fc.document.activeFrameIndex(fc.select.getBoxes()) >= 0 ? t('Artboard size') : t('Canvas size'),
          icon: icon(SVG.size),
          key: 'size',
          run: () => fc.document.openSizeMenu(anchorEl()),
        });
    }
    if (info || importCfg || actions?.newFromTemplate || actions?.bulk) {
      if (items.length) items.push({ sep: true });
      if (info)
        items.push({
          label: t('Document info'),
          icon: icon(SVG.info),
          key: 'info',
          run: () => fc.fieldPanels.openInfoPanel(anchorEl()),
        });
      // Back to the Start chooser (plans/142 WP-1) - sits in the same "bring a
      // document in" group as Import. The pick applies through the tool's own
      // undoable path, so it is one ⌘Z away, never a destructive reset.
      if (actions?.newFromTemplate)
        items.push({
          label: t('New from template'),
          icon: icon(SVG.templates),
          key: 'templates',
          run: () => actions.newFromTemplate!(),
        });
      // "Bulk from rows" - the same group, because it is the other way a document
      // arrives: one sheet of rows in, one render per row out (plans/147 M1).
      if (actions?.bulk)
        items.push({
          label: t('Bulk from rows'),
          icon: icon(SVG.rows),
          key: 'bulk',
          run: () => actions.bulk!(),
        });
      // keepOpen, because openImportPanel closes this menu and then assigns its own
      // panel to `popover`: without it fillPopover's trailing closePopover() would
      // tear the freshly-mounted import panel down in the same click. (The pages /
      // size / info rows are safe - those assign `morePanel`, a different variable.)
      if (importCfg)
        items.push({
          label: t('Import a design'),
          icon: icon(SVG.importFile),
          key: 'import',
          keepOpen: true,
          run: () => fc.menus.openImportPanel(anchorEl()),
        });
    }
    // Custom CSS (plan 112 M4): only for a tool that declares the `customCss` input
    // (Design). Opens a highlighted, auto-completing editor bound to that input.
    if (runtime.getModel().some((i) => i.id === 'customCss')) {
      if (items.length) items.push({ sep: true });
      items.push({
        label: t('Custom CSS'),
        icon: icon(SVG.code),
        key: 'css',
        run: () => fc.fieldPanels.openCssPanel(anchorEl()),
      });
    }
    // Design's canvas keyboard used to be invisible while the timeline alone carried a
    // `?` sheet. The document menu is the pointer/touch door onto that same inventory;
    // a focused timeline keeps its own, more detailed sheet because its root consumes
    // the key before this window-level handler sees it.
    if (barMounted) {
      if (items.length) items.push({ sep: true });
      if (fc.authoringGuides) {
        items.push({
          label: t('Rulers and guides'),
          icon: icon(SVG.grid),
          key: 'guides',
          on: fc.authoringGuides.isVisible(),
          run: () => fc.stage.setGuidesVisible(!fc.authoringGuides!.isVisible()),
        });
        if (fc.authoringGuides.hasGuides()) {
          items.push({
            label: t('Remove all guides'),
            icon: icon(SVG.trash),
            key: 'clear-guides',
            run: () => fc.authoringGuides?.clear(),
          });
        }
      }
      items.push({
        label: t('Keyboard shortcuts'),
        icon: icon(SVG.info),
        key: 'shortcuts',
        run: () => fc.select.showShortcuts(anchorEl()),
      });
    }
    // Slide transition (plan 112 M5): one compact cycling row - Slide → Fade → Morph.
    // The menu closes on click; reopening shows the new value (no live refresh needed).
    //
    // Kept when a top bar is mounted, unlike the eight rows the bar really does carry:
    // this one is DOC-LEVEL and the bar has no transition control (nor has the
    // inspector's Document section, nor the navigator, which only reads it as a chip).
    // Dropping it left the input with no door anywhere in the editor - a deck set to
    // Morph could not be changed back to Fade except by hand-editing the URL. It goes
    // back to the per-frame slot's owner when plan 179 M4 ships that select.
    const trModel = runtime.getModel().find((i) => i.id === 'transition');
    if (trModel) {
      const order = ['slide', 'fade', 'morph'];
      const cur = String(trModel.value ?? 'slide');
      const nice = cur === 'morph' ? t('Morph') : cur === 'fade' ? t('Fade') : t('Slide');
      items.push({
        label: `${t('Slide transition')}: ${nice}`,
        icon: icon(SVG.present),
        key: 'transition',
        run: () => {
          const next = order[(order.indexOf(cur) + 1) % order.length]!;
          onDirty?.('transition');
          runtime.setInput('transition', next);
        },
      });
    }
    // Present is the VERY LAST row (Andy: Export is the star; Present sits at the bottom),
    // set off by its own separator and next to the Slide transition it uses (plan 112).
    if (actions?.present && !barMounted) {
      if (items.length) items.push({ sep: true });
      items.push({
        label: t('Present'),
        icon: icon(SVG.present),
        key: 'present',
        run: () => actions.present!(),
      });
    }
    // App preferences, at the very bottom (plans/179 M1). The rows are PROXIES: the tool
    // view built the real controls and lends them here, so the theme/sound state and its
    // persistence stay in one place and the menu never becomes a second opinion.
    if (barMounted && (designChrome?.themeToggle || designChrome?.soundToggle)) {
      if (items.length) items.push({ sep: true });
      if (designChrome.themeToggle) {
        items.push({
          label: t('Theme'),
          icon: icon(SVG.theme),
          key: 'theme',
          run: () => designChrome.themeToggle!.click(),
        });
      }
      if (designChrome.soundToggle) {
        items.push({
          label: t('Interface sounds'),
          icon: icon(SVG.sound),
          key: 'sound',
          run: () => designChrome.soundToggle!.click(),
        });
      }
    }
    return items;
  };
  // The ports' door onto the same menu: the top bar's mark button opens it anchored to
  // ITSELF, not to a rail button that may not even be on screen (see openLollyMenu).
  fc.lollyMenuItems = lollyItems;
  if (actions || history || info || importCfg || pages || setCanvasSize) {
    // `fc-action-primary` is kept on the trigger because it is now the editor's
    // primary action affordance - mountTool focuses it on open (tool.ts) - with
    // .fc-btn-lolly restyling it back to the mark's own colour.
    lollyBtn = toolBtn(fc, 
      t('Menu - export, save, undo, canvas size'),
      '',
      () => {
        fc.select.setLollyAnchor(lollyBtn!);
        const items = lollyItems();
        if (items.length) fc.menus.spawnPopover(lollyBtn!, items);
      },
      'fc-action fc-action-primary fc-btn-lolly'
    );
    // The mark is a whole <svg> (the brand swirl, root icon.svg), not a path set, so it
    // replaces toolBtn's icon(). Its three rings spin on hover only - see .fc-btn-lolly in
    // editor.css, the same interaction-only treatment as the Ask Lolly send button.
    lollyBtn.innerHTML = LOLLY_MARK_SVG;
    lollyBtn.setAttribute('aria-haspopup', 'menu');
    const ref = actions?.dirtyRef;
    if (ref && actions && actions.canSave !== false) {
      // The render pill's amber "unsaved" cue, mirrored onto the trigger - Save
      // lives inside the menu now, so the mark is what has to carry the cue.
      const mark = lollyBtn;
      const mirror = (): void => {
        mark.classList.toggle('is-unsaved', ref.classList.contains('is-unsaved'));
      };
      mirror();
      fc.dirtyObserver = new MutationObserver(mirror);
      fc.dirtyObserver.observe(ref, { attributes: true, attributeFilter: ['class'] });
    }
    const asep = document.createElement('div');
    asep.className = 'fc-sep';
    toolbar.appendChild(asep);
  }
  // Pointer leads the tools, and is the way OUT of every other one. Before it existed the
  // only exit from the pen or from connect mode was clicking that same tool's own button
  // again - discoverable only if you already knew, which is what "trapped in the current
  // tool" meant. Its own click is not a no-op even when it is already lit: it also leaves
  // point editing and finishes a draft.
  modeBtns.select = toolBtn(fc, 
    t('Pointer - select and move (V)'),
    SVG.pointer,
    () => fc.modes.pickPointer(),
    'fc-btn-pointer'
  );
  const add = toolBtn(fc, t('Add a box'), SVG.add, () => fc.menus.openAddMenu(add), 'fc-btn-add');
  modeBtns.create = add;
  // Pen (opt-in via canvas.pathField - a tool with nowhere to store an authored path has
  // no pen). The tooltip carries the corner modifier, which is otherwise undiscoverable;
  // Alt is free here because a pen click returns long before `selectionForHit`, where Alt
  // means "drill into the group".
  if (cv.pathField) {
    modeBtns.pen = toolBtn(fc, 
      t('Pen - click to place points, drag to curve, Alt for a corner. Hold for the spline type'),
      SVG.pen,
      () => {
        fc.mode === 'pen' ? fc.modes.toPointer() : fc.modes.setMode('pen');
      },
      'fc-btn-pen',
      (b) => fc.penTool.openPenKindMenu(b)
    );
    // Node tool (Inkscape's N): click a shape to edit its points directly.
    fc.nodeToolBtn = toolBtn(fc, 
      t('Edit points (N) - click a shape to edit its nodes directly'),
      SVG.nodes,
      () => fc.modes.toggleNodeTool(),
      'fc-btn-nodes'
    );
    // Line - the pen's other gesture (plan 96 P2). One drag makes a two-node path box,
    // arrowhead on by default; it lives beside the Pen because it is the SAME primitive
    // drawn a different way, and it is opt-in on `pathField` for the same reason the pen
    // is: a tool with nowhere to store an authored path cannot hold a line either.
    // Auto-arrange now rides a HOLD (or right-click) of the Line tool, when the boxes can
    // be joined (opt-in via bindings): lines are what create those bindings, so their tool
    // is the natural home for tidying the graph they make. Mirrors the pen's hold-for-spline.
    modeBtns.line = toolBtn(fc, 
      hasBindCfg
        ? t('Line - drag to draw a line or arrow. Hold to auto-arrange the connected cards')
        : t('Line - drag to draw a line or arrow'),
      SVG.line,
      () => {
        fc.mode === 'line' ? fc.modes.toPointer() : fc.modes.setMode('line');
      },
      'fc-btn-line',
      hasBindCfg
        ? (b) =>
            fc.menus.spawnPopover(b, [
              {
                label: t('Auto-arrange the connected cards'),
                icon: icon(SVG.tidy),
                run: () => fc.modes.autoLayout(),
              },
            ])
        : undefined
    );
  }
  // Timeline (opt-in via the canvas time-model fields - a tool with nowhere to store
  // a start/duration has no timeline). Toggles the docked panel; the panel module
  // itself is only fetched the first time it is opened.
  if (timeCfg) {
    fc.timelineBtn = toolBtn(fc, 
      t('Timeline - arrange clips over time'),
      SVG.timeline,
      () => fc.timeline.toggleTimeline(),
      'fc-btn-timeline'
    );
    fc.timelineBtn.setAttribute('aria-pressed', String(!!fc.timelinePanel?.isOpen()));
  }
  // Frames reorder (opt-in via canvas.orderField - the frame primitive's page-order
  // field). A tool with nowhere to store `order` has no frame sequence to sort, so the
  // button is absent for carousel/deck and every non-frame tool. Toggles the panel.
  if (frameCfg?.orderField) {
    toolBtn(fc, t('Artboards'), SVG.frame, (b) => fc.document.toggleFramesPanel(b), 'fc-btn-frames');
  }
  // (Auto-arrange no longer has a standalone rail button - it moved to a HOLD / right-click
  // of the Line tool above, since the line tool is what creates the bindings it lays out.)
  // One "Arrange" menu - align + distribute + stacking order + group + clip
  // (previously two separate rail buttons). Every one of those acts ON a selection,
  // so the button only appears once there is one (syncArrangeUI, from the same
  // paint that shows the object bar). The right-click menu and the keyboard keep
  // their own gating - nothing here is the only way to reach an action.
  fc.arrangeBtn = toolBtn(fc, t('Arrange - align, distribute, order, group'), SVG.align, () =>
    fc.menus.openArrangeMenu()
  );
  fc.keys.syncArrangeUI();
  // Snap-to-grid toggle (opt-in).
  if (cv.grid) {
    const gbtn = toolBtn(fc, t('Snap to grid'), SVG.grid, () => {
      fc.gridOn = !fc.gridOn;
      gbtn.classList.toggle('is-armed', fc.gridOn);
      gbtn.setAttribute('aria-pressed', String(fc.gridOn));
    });
    gbtn.setAttribute('aria-pressed', String(fc.gridOn));
    if (fc.gridOn) gbtn.classList.add('is-armed');
  }
  // Pages / canvas size, copy, share, document info and import all live in the
  // Lolly menu at the top of the rail now - see lollyItems() above.
  const sep = document.createElement('div');
  sep.className = 'fc-sep';
  toolbar.appendChild(sep);
  // The paint at the foot of the rail - the app's shared colour picker (swatches + hex
  // + alpha). WHAT it paints depends on the document; see paintBgField. It lives in a
  // `display:contents` slot so the field itself can be REPLACED (not mutated) on a
  // re-sync while staying a direct flex child of the rail.
  fc.bgSlot = document.createElement('div');
  fc.bgSlot.style.display = 'contents';
  toolbar.appendChild(fc.bgSlot);
  paintBgField(fc);
  fc.modes.syncModeUI(); // Pointer lit on mount; the rail is never rebuilt after this
}
// ── the rail's paint swatch (plans/179 A1) ───────────────────────────────────
//
// It used to write the document `background` input unconditionally. In any document
// with artboards - which is every new one, since the default `boxes` seeds artboard-1 -
// the hook forces the page background to `transparent`, so the most visible control on
// the rail did nothing at all. That is the "can't fill artboards" report.
//
// Now it follows the ACTIVE artboard (the one holding the selection, else the primary)
// and paints its fill; with no artboards in the document it keeps writing `background`.
// The field is rebuilt rather than mutated, because the swatch, the value field, the
// LCH sliders and the aria-label are all seeded from the value at build time - and it
// is replaced wholesale (a fresh element, freshly wired) because `wireColorField` binds
// delegated listeners on the scope it is handed, so re-wiring one in place would fire
// every later edit twice.
/** What the swatch edits right now. `frameId` empty = the document background. */
export function bgTarget(fc: FcCtx): { frameId: string; value: unknown; tip: string } {
  const { cfg, frameCfg } = fc;
  if (frameCfg && cfg.fillField) {
    const boxes = fc.select.getBoxes();
    const fid = fc.select.hasFrames(boxes) ? activeFrameIdFor(boxes, fc.selection, fc.select.frameFields()) : '';
    if (fid) {
      const fb = boxes.find((b, i) => fc.select.idOf(b, i) === fid);
      return {
        frameId: fid,
        value: fb ? (fb[cfg.fillField] ?? '') : '',
        tip: t('Artboard fill'),
      };
    }
  }
  return { frameId: '', value: fc.select.getBg(), tip: t('Canvas background') };
}
export function paintBgField(fc: FcCtx): void {
  const { cfg, onDirty, runtime } = fc;
  if (!fc.bgSlot) return;
  const tgt = bgTarget(fc);
  fc.bgFieldKey = `${tgt.frameId}|${String(tgt.value ?? '')}`;
  const wrap = document.createElement('div');
  wrap.className = 'fc-btn fc-color-btn';
  wrap.setAttribute('data-tip', tgt.tip);
  // Resolved, never raw (plan 179 A2): an artboard whose fill is `var(--brand-surface)`
  // seeded this swatch BLACK and its sliders a blue that came from the field's own
  // neutral seed. `seededColorField` reads the token off the canvas's computed style
  // and labels the trigger with the token's name; the model keeps the `var()`.
  wrap.innerHTML = fc.contextBar.seededColorField('fc-bg', tgt.value);
  wrap.addEventListener('pointerdown', (e) => e.stopPropagation());
  fc.bgSlot.replaceChildren(wrap);
  wireColorField(wrap, {
    onChange: (_id, val) => {
    const { bgInputId } = fc;
      const col = fc.helpers.unwrapColor(val);
      // Read the target FRESH: the selection may have moved since the field was built.
      const now = bgTarget(fc);
      if (now.frameId && cfg.fillField) {
        const boxes = fc.select.getBoxes();
        const i = boxes.findIndex((b, n) => fc.select.idOf(b, n) === now.frameId);
        if (i < 0) return;
        // The field now SHOWS the pick while the popover stays open, and the open-popover
        // guard in syncBgField will skip the repaint that would have recorded it - so
        // forget the last painted key here, or an undo that restores the old value
        // compares equal to that stale key and leaves the swatch showing the pick.
        fc.bgFieldKey = '';
        fc.select.commit(boxes.map((b, n) => (n === i ? { ...b, [cfg.fillField]: col } : b)));
        return;
      }
      onDirty?.(bgInputId);
      runtime.setInput(bgInputId, col);
    },
  });
}
/** Keep the swatch honest as the selection and the model move. Skipped while the
 *  picker is open - rebuilding the field under an open popover would close it
 *  mid-edit - and skipped when nothing it shows has changed. */
export function syncBgField(fc: FcCtx): void {
  if (!fc.bgSlot) return;
  const tgt = bgTarget(fc);
  if (`${tgt.frameId}|${String(tgt.value ?? '')}` === fc.bgFieldKey) return;
  // Skipped while the picker is open: drop the key so the deferred repaint happens on
  // the next sync after it closes, whatever the model says by then.
  if (fc.bgSlot.querySelector('.color-popover:not([hidden])')) {
    fc.bgFieldKey = '';
    return;
  }
  paintBgField(fc);
}
export function fillPopover(fc: FcCtx, el: HTMLElement, items: PopItem[]): void {
  for (const it of items) {
    if (it.sep) {
      const s = document.createElement('div');
      s.className = 'fc-pop-sep';
      el.appendChild(s);
      continue;
    }
    // Icon-only grid row (e.g. align = 3 cols × 2 rows, distribute = 2 cols): each
    // action is a compact square button labelled only by its icon (title/aria carry
    // the text). `cols` drives the column count via a CSS var.
    if (it.grid) {
      const g = document.createElement('div');
      g.className = 'fc-pop-grid';
      g.style.setProperty('--cols', String(it.cols || it.grid.length));
      for (const gi of it.grid) {
        const gb = document.createElement('button');
        gb.type = 'button';
        gb.className = 'fc-pop-gitem' + (gi.danger ? ' fc-pop-danger' : '');
        gb.disabled = gi.disabled === true;
        gb.setAttribute('role', 'menuitem');
        gb.setAttribute('data-tip', gi.label);
        gb.setAttribute('aria-label', gi.label);
        gb.innerHTML = gi.icon || '';
        // `activeElement === gb` is read AFTER run(): a row that opened a panel and
        // focused something inside it must keep that focus, and one that did not has
        // to hand the keyboard back to the trigger rather than to <body>.
        gb.addEventListener('click', (e) => {
          e.stopPropagation();
          if (gb.disabled) return;
          gi.run();
          if (!gi.keepOpen) closePopover(fc, document.activeElement === gb);
        });
        g.appendChild(gb);
      }
      el.appendChild(g);
      continue;
    }
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'fc-pop-item' + (it.danger ? ' fc-pop-danger' : '') + (it.on ? ' is-on' : '');
    // A row in a `role="menu"` has to be a menuitem, or the container's role makes the
    // whole popover unnavigable to a screen reader: only the radio rows carried one,
    // so every plain row (Export, Undo, Custom CSS…) announced as a bare button.
    b.setAttribute('role', it.on !== undefined ? 'menuitemradio' : 'menuitem');
    if (it.on !== undefined) b.setAttribute('aria-checked', String(it.on));
    if (it.key) b.dataset.pop = it.key;
    b.disabled = it.disabled === true;
    b.innerHTML =
      (it.icon ? `<span class="fc-pop-ic">${it.icon}</span>` : '') + `<span>${it.label}</span>`;
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      if (b.disabled) return;
      it.run();
      if (!it.keepOpen) closePopover(fc, document.activeElement === b);
    });
    el.appendChild(b);
  }
}
export function toolboxOps(fc: FcCtx) {
  return {
    closePopover: bindOp(fc, closePopover),
    toolBtn: bindOp(fc, toolBtn),
    buildToolbar: bindOp(fc, buildToolbar),
    bgTarget: bindOp(fc, bgTarget),
    paintBgField: bindOp(fc, paintBgField),
    syncBgField: bindOp(fc, syncBgField),
    fillPopover: bindOp(fc, fillPopover),
  };
}
