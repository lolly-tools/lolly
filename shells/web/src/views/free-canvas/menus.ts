// SPDX-License-Identifier: MPL-2.0
/**
 * free-canvas: popovers, the import panel, the context menu, add and arrange menus.
 *
 * Every function takes the shared `fc: FcCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `fc.<module>.<fn>`. Extracted verbatim
 * from initFreeCanvas() by scripts/split-closure.ts.
 */
import { layoutArtboards, num, reorderZ, resolveFrame } from '../free-canvas-math.ts';
import type { Box } from '../free-canvas-math.ts';
import { booleanBoxes, boxOutlineKind, simplifyBoxes } from '../vector-ops.ts';
import type { BooleanOpName } from '../vector-ops.ts';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { InputValue } from '../../../../../engine/src/inputs.ts';
import { positionEditorPopover } from '../free-canvas-popover.ts';
import { escape as escapeText } from '../../utils.ts';
import { t, tRaw } from '../../i18n.ts';
import { SVG, icon } from '../free-canvas-icons.ts';
import type { ImportMode, PopGridItem, PopItem } from './shared.ts';
import { bindOp, type FcCtx } from './context.ts';

export function spawnPopover(fc: FcCtx, anchor: HTMLElement, items: PopItem[]): void {
  const { stageEl } = fc;
  fc.toolbox.closePopover();
  fc.popover = document.createElement('div');
  fc.popover.className = 'fc-popover';
  // A MENU, and one the keyboard can actually use. The popover is appended to the
  // STAGE (it has to be, to position itself absolutely inside it), so it is after
  // every bar and rail control in DOM order: a Tab from the trigger walked the whole
  // top bar before reaching the rows. Moving focus INTO it on open, with Escape and
  // Tab handing focus back to the trigger, is what closes that gap - the same
  // contract design-topbar's own menus keep.
  fc.popover.setAttribute('role', 'menu');
  const named = anchor.getAttribute('aria-label');
  if (named) fc.popover.setAttribute('aria-label', named);
  fc.toolbox.fillPopover(fc.popover, items);
  fc.popover.addEventListener('pointerdown', (e) => e.stopPropagation());
  fc.popover.addEventListener('keydown', fc.menus.onPopoverKey);
  positionEditorPopover(fc.popover, anchor, stageEl);
  fc.popoverAnchor = anchor;
  if (anchor.hasAttribute('aria-haspopup')) anchor.setAttribute('aria-expanded', 'true');
  popoverItems(fc)[0]?.focus();
}
/** The popover's focusable rows, in order - grid cells included, disabled skipped. */
export function popoverItems(fc: FcCtx): HTMLButtonElement[] {
  if (!fc.popover) return [];
  return [...fc.popover.querySelectorAll<HTMLButtonElement>('.fc-pop-item, .fc-pop-gitem')].filter(
    (b) => !b.disabled
  );
}
/**
 * Menu keys, the APG way: arrows roam, Home/End jump, Escape closes and Tab closes
 * and lets the browser move on - both handing focus back to the trigger, because a
 * menu removed with focus still inside it drops the keyboard onto `<body>` and the
 * next Tab restarts at the top of the page.
 */
export function onPopoverKey(fc: FcCtx, e: KeyboardEvent): void {
  if (!fc.popover) return;
  const list = popoverItems(fc);
  const at = list.indexOf(document.activeElement as HTMLButtonElement);
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    fc.toolbox.closePopover(true);
    return;
  }
  if (e.key === 'Tab') {
    fc.toolbox.closePopover(true);
    return;
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    list[(at + 1 + list.length) % list.length]?.focus();
    return;
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    list[(at - 1 + list.length) % list.length]?.focus();
    return;
  }
  if (e.key === 'Home') {
    e.preventDefault();
    list[0]?.focus();
    return;
  }
  if (e.key === 'End') {
    e.preventDefault();
    list[list.length - 1]?.focus();
    return;
  }
  // Everything else the canvas would have answered - a bare letter is a tool
  // shortcut, Delete deletes the selection - stops at the menu.
  if (!(e.metaKey || e.ctrlKey)) e.stopPropagation();
}
// Sequence editors (timeCfg) import a design file as SCENES instead: every
// frame/board/page becomes a stored vector asset placed as one full-canvas clip
// in the main sequence, appended after the existing timing so nothing the user
// authored moves. One commit → one undo step; the timeline opens to show the
// play-through. Returns the number of scenes added.
export async function importAsScenes(fc: FcCtx, f: File | Blob, setStatus: (m: string) => void): Promise<number> {
  const { cfg, host, importMap, timeCfg } = fc;
  const { parseDesignScenes } = await import('../design-import.ts');
  const { DEFAULT_CLIP_S } = await import('../timeline-math.ts');
  const res = await parseDesignScenes(f, {
    host: host as any,
    log: setStatus,
    interactive: true,
    map: importMap,
  });
  const scenes = res.scenes;
  if (!scenes.length) throw new Error(t('Nothing importable was found in that file.'));
  const tc = timeCfg!;
  const { w: cw, h: ch } = fc.helpers.canvasWH();
  const all = [...fc.select.getBoxes()];
  // Append after the current sequence's end - never disturb existing timing.
  let at = 0;
  for (const b of all) {
    if (String(b[tc.laneField] ?? '') !== 'seq') continue;
    const s = num(b[tc.startField], NaN);
    if (!Number.isFinite(s)) continue;
    const d = num(b[tc.durField], NaN);
    at = Math.max(at, s + (Number.isFinite(d) && d > 0 ? d : DEFAULT_CLIP_S));
  }
  for (const sc of scenes) {
    const id = fc.select.freshId(all);
    all.push({
      [cfg.idField]: id,
      [cfg.kindField]: 'image',
      [cfg.xField]: 0,
      [cfg.yField]: 0,
      [cfg.wField]: cw,
      [cfg.hField]: ch,
      ...(cfg.imageField ? { [cfg.imageField]: sc.asset } : {}),
      ...(cfg.fitField ? { [cfg.fitField]: 'contain' } : {}),
      [tc.laneField]: 'seq',
      [tc.startField]: at,
      [tc.durField]: DEFAULT_CLIP_S,
      // A Penpot prototype flow carries the authored transition INTO each board;
      // scenes from a file without interactions carry neither key, so the box is
      // written exactly as it always was (enter defaults to 'none' - a cut).
      ...(sc.enter ? { [tc.enterField]: sc.enter } : {}),
      ...(sc.enterMs !== undefined ? { [tc.enterMsField]: sc.enterMs } : {}),
    } as unknown as Box);
    at += DEFAULT_CLIP_S;
  }
  if (fc.disposed) return 0;
  fc.selection = new Set<string>();
  fc.select.commit(all);
  fc.timeline.openTimeline();
  return scenes.length;
}
/**
 * Import a document's pages as ARTBOARDS: one frame per page / slide / board, laid
 * out left to right, every page's parts inside it as editable boxes - the deck
 * import (Andy, 2026-09-02: "artboards for slides or frames for animation"). It
 * replaces the board (as a single-page import does), sizes the export frame to the
 * first page, and leaves the pages UNTIMED on purpose: the "play these in order"
 * prompt that follows any fresh set of artboards is how they become a slideshow, so
 * deck-or-animation stays the user's call after the import as well as before it.
 * Returns the number of artboards laid down.
 */
export async function importAsArtboards(fc: FcCtx, 
  f: File | Blob,
  setStatus: (m: string) => void
): Promise<number> {
  const { FRAME_NOTES_FIELD, addKinds, cfg, frameCfg, host, importMap, setCanvasSize } = fc;
  if (!frameCfg) throw new Error(t('This tool has no artboards.'));
  const { parseDesignArtboards } = await import('../design-import.ts');
  const res = await parseDesignArtboards(f, {
    host: host as any,
    log: setStatus,
    interactive: true,
    map: importMap,
  });
  if (!res.frames.length) throw new Error(t('Nothing importable was found in that file.'));
  const fk = frameCfg.frameKind;
  const frameAddKind = addKinds.find(
    (k) => k.id === 'frame' || (k.seed != null && String(k.seed[cfg.kindField]) === fk)
  );
  const rows = layoutArtboards(
    res.frames.map((fr) => ({
      name: fr.name,
      width: fr.width,
      height: fr.height,
      boxes: fr.boxes as Box[],
      ...(fr.background ? { background: fr.background } : {}),
      // plans/179 P2 - a .pptx's speaker notes are parsed, normalised and capped by
      // pptx-import, and used to stop here: the re-projection dropped the field, so
      // "Speaker notes…" was empty on every imported slide and a re-export to PowerPoint
      // (which P1 just fixed) had nothing to put back.
      ...(fr.notes ? { notes: fr.notes } : {}),
    })),
    {
      cfg,
      frameField: frameCfg.frameField,
      frameKind: fk,
      orderField: frameCfg.orderField,
      frameSeed: (frameAddKind?.seed || {}) as Box,
      mintId: (used) => fc.select.freshId(used),
      background: res.background,
      notesField: FRAME_NOTES_FIELD,
    }
  );
  if (fc.disposed) return 0;
  fc.selection = new Set<string>();
  fc.select.commit(rows);
  const first = res.frames[0]!;
  if (setCanvasSize && first.width > 0 && first.height > 0)
    setCanvasSize(first.width, first.height, 'px');
  return res.frames.length;
}
// Import a design file (Figma SVG / Penpot). The heavy DOM parser is lazy-loaded so it
// only ships to sessions that actually import. On success we REPLACE the whole boxes
// array (through the normal commit path) and resize the artboard to the file's frame.
// On a sequence editor the same panel imports frames as scenes (importAsScenes).
export function openImportPanel(fc: FcCtx, anchor: HTMLElement): void {
  const { host, importArtboardCapable, importSceneCapable, info, input, setCanvasSize, stageEl } = fc;
  fc.toolbox.closePopover();
  const panel = document.createElement('div');
  panel.className = 'fc-popover fc-import-panel';
  // The section 337 choice, per-import: scenes-capable tools (Design) let the user pick
  // between replacing the board and laying the frames out as timed scenes. Default
  // follows the manifest (importScenesMode) - false for Design, so it replaces.
  let importMode: ImportMode = fc.helpers.defaultImportMode();
  // Class-styled, not inline: this panel used to carry its whole look in `style=`
  // attributes (and a HARD-CODED brand green on the choose button, which never themed
  // or respected dark mode). The chrome now lives in `.fc-import-*` in editor.css and
  // the button is the standard `.btn .btn--primary`, so it follows the active brand.
  panel.innerHTML =
    `<div class="fc-import-title">${t('Import a design')}</div>` +
    '<p class="fc-import-hint">' +
    t(
      'Drop a Figma <b>.fig</b> / SVG, a Penpot <b>.penpot</b>, an Illustrator <b>.ai</b> or <b>.pdf</b>, a PowerPoint <b>.pptx</b>, or an InDesign <b>.idml</b> (File → Export → InDesign Markup). (For editable text from a Figma <b>SVG</b>, uncheck “Outline text” on export.)'
    ) +
    '</p>' +
    // The per-import choice (plans/104 section 337, widened 2026-09-02): one page onto
    // the board, every page as an artboard, or every frame as a timed scene. Each
    // option is present only where the tool can honour it; a tool with neither
    // capability gets no radiogroup at all.
    (importSceneCapable || importArtboardCapable
      ? `<div class="fc-import-mode" role="radiogroup" aria-label="${t('Import as')}">` +
        `<label class="fc-import-mode-opt"><input type="radio" name="fc-imp-mode" value="board"${importMode === 'board' ? ' checked' : ''}>${t('Replace the board')}</label>` +
        (importArtboardCapable
          ? `<label class="fc-import-mode-opt"><input type="radio" name="fc-imp-mode" value="artboards"${importMode === 'artboards' ? ' checked' : ''}>${t('As artboards')}</label>`
          : '') +
        (importSceneCapable
          ? `<label class="fc-import-mode-opt"><input type="radio" name="fc-imp-mode" value="scenes"${importMode === 'scenes' ? ' checked' : ''}>${t('As timed scenes')}</label>`
          : '') +
        '</div>' +
        `<p class="fc-import-scenes-hint" data-import-hint>${escapeText(fc.helpers.importHint(importMode))}</p>`
      : '') +
    `<button type="button" class="btn btn--primary fc-import-choose">${t('Choose file…')}</button>` +
    // Components-as-templates: revealed once the chosen file turns out to
    // define components (countPenpotComponents peeks the zip), so a file
    // without a design system never shows a control that would do nothing.
    '<label class="fc-import-templates" hidden>' +
    '<input type="checkbox" checked><span></span></label>' +
    '<div class="fc-import-status" role="status" aria-live="polite"></div>';
  panel.addEventListener('pointerdown', (e) => e.stopPropagation());
  stageEl.appendChild(panel);
  const ar = anchor.getBoundingClientRect();
  const sr = stageEl.getBoundingClientRect();
  panel.style.left = Math.min(ar.right - sr.left + 8, sr.width - 272) + 'px';
  panel.style.top = Math.max(6, ar.top - sr.top) + 'px';
  fc.popover = panel;

  const status = panel.querySelector<HTMLElement>('.fc-import-status')!;
  const chooseBtn = panel.querySelector<HTMLButtonElement>('.fc-import-choose')!;
  const tplRow = panel.querySelector<HTMLElement>('.fc-import-templates')!;
  const tplBox = tplRow.querySelector<HTMLInputElement>('input')!;
  const tplLabel = tplRow.querySelector<HTMLElement>('span')!;
  // Wire the board / artboards / scenes choice (present only where a mode is offered).
  const modeHint = panel.querySelector<HTMLElement>('[data-import-hint]');
  panel
    .querySelectorAll<HTMLInputElement>('.fc-import-mode input[name="fc-imp-mode"]')
    .forEach((r) => {
      r.addEventListener('change', () => {
        if (!r.checked) return;
        importMode =
          r.value === 'scenes' ? 'scenes' : r.value === 'artboards' ? 'artboards' : 'board';
        if (modeHint) modeHint.textContent = fc.helpers.importHint(importMode);
      });
    });
  const fileEl = document.createElement('input');
  fileEl.type = 'file';
  fileEl.accept =
    '.fig,.svg,.penpot,.zip,.ai,.pdf,.pptx,.idml,.indd,image/svg+xml,application/zip,application/pdf,application/illustrator,application/vnd.openxmlformats-officedocument.presentationml.presentation';
  fileEl.style.display = 'none';
  panel.appendChild(fileEl);
  chooseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    fileEl.click();
  });
  fileEl.addEventListener('change', async () => {
  const { importMap } = fc;
    const f = fileEl.files?.[0];
    fileEl.value = '';
    if (!f) return;
    status.classList.remove('is-ok', 'is-err');
    status.textContent = t('Importing…');
    // Re-hide the components offer for the NEW file. One handler serves every pick and
    // the panel survives a failed import (the auto-close is the last statement of the
    // try), so without this a Penpot file's "Also save 6 components as templates" row
    // stays on screen - checked - while a plain SVG is imported, offering something
    // that can never happen (componentCount is re-derived per file, and is 0).
    tplRow.hidden = true;
    tplLabel.textContent = '';
    tplBox.checked = true;
    chooseBtn.disabled = true;
    try {
      if (importMode === 'scenes') {
        // The user chose "As timed scenes": frames become timed scenes (importAsScenes above).
        const n = await importAsScenes(fc, f, (m: string) => {
          status.textContent = m;
        });
        status.classList.add('is-ok');
        status.textContent = n === 1 ? t('Added 1 scene.') : t('Added {n} scenes.', { n });
      } else if (importMode === 'artboards') {
        // "As artboards": one frame per page, the parts editable (importAsArtboards above).
        const n = await importAsArtboards(fc, f, (m: string) => {
          status.textContent = m;
        });
        status.classList.add('is-ok');
        status.textContent = n === 1 ? t('Added 1 artboard.') : t('Added {n} artboards.', { n });
      } else {
        const { parseDesignFile, countPenpotComponents, parseDesignTemplates } = await import(
          '../design-import.ts'
        );
        // A design system's component masters can also be saved as reusable
        // templates. The offer appears as soon as the chosen file turns out to
        // define components (a cheap peek at the zip's component records), and
        // the pass itself runs after the board import so the canvas is never
        // kept waiting on it. Needs the tool's identity to mint sessions with.
        const templateToolId = info?.id || '';
        let componentCount = 0;
        if (templateToolId) {
          componentCount = await countPenpotComponents(f);
          if (componentCount > 0) {
            tplLabel.textContent =
              componentCount === 1
                ? t('Also save 1 component as a template')
                : t('Also save {n} components as templates', { n: componentCount });
            tplRow.hidden = false;
          }
        }
        // interactive: a multi-page PDF/.ai asks which page (shared page-picker dialog)
        // instead of silently importing the first. `map` carries this tool's font
        // vocabulary + seed colours (importMap above) into the engine's box mapper.
        const res = await parseDesignFile(f, {
          host: host as any,
          log: (m: string) => {
            status.textContent = m;
          },
          interactive: true,
          map: importMap,
        });
        const boxes = (Array.isArray(res.boxes) ? res.boxes : []) as Box[];
        if (!boxes.length) throw new Error(t('Nothing importable was found in that file.'));
        fc.selection = new Set<string>();
        fc.select.commit(boxes);
        if (setCanvasSize && res.width > 0 && res.height > 0)
          setCanvasSize(res.width, res.height, 'px');
        status.classList.add('is-ok');
        const imported =
          boxes.length === 1
            ? t('Imported 1 object.')
            : t('Imported {n} objects.', { n: boxes.length });
        status.textContent = imported;
        if (componentCount > 0 && tplBox.checked) {
          // Never let the extra pass fail an import that already succeeded.
          try {
            status.textContent = `${imported} ${t('Saving templates…')}`;
            const { templates } = await parseDesignTemplates(f, {
              host: host as any,
              log: (m: string) => {
                status.textContent = `${imported} ${m}`;
              },
              // res.map carries the deck's own font families, already resolved
              // by the board import, so nothing is fetched or warned twice.
              map: res.map ?? importMap,
            });
            if (templates.length) {
              const { fileTemplatesAsSessions } = await import('../../lib/design-templates.ts');
              const filed = await fileTemplatesAsSessions(host as any, templates, {
                fileName: (f as File).name,
                toolId: templateToolId,
                toolVersion: info?.version,
                boxesField: input.id,
                format: info?.formats?.[0],
                warn: (m: string) => {
                  status.textContent = `${imported} ${m}`;
                },
              });
              status.textContent = `${imported} ${
                  filed.saved === 1
                    ? tRaw('Saved 1 template in “{folder}”.', { folder: filed.folderName })
                    : tRaw('Saved {n} templates in “{folder}”.', {
                        n: filed.saved,
                        folder: filed.folderName,
                      })
                }`;
            } else {
              status.textContent = `${imported} ${t('No components could be saved as templates.')}`;
            }
          } catch (_e) {
            status.textContent = `${imported} ${t('The components couldn’t be saved as templates.')}`;
          }
        }
      }
      setTimeout(() => {
        if (fc.popover === panel) fc.toolbox.closePopover();
      }, 1400);
    } catch (err) {
      status.classList.add('is-err');
      status.textContent = ((err as any) && (err as any).message) || t('Import failed.');
    } finally {
      chooseBtn.disabled = false;
    }
  });
}
// Right-click context menu at the cursor (desktop): a consolidated list of the
// arrange / align / group / clip / edit actions.
export function openContextMenu(fc: FcCtx, clientX: number, clientY: number): void {
  const { canFlip, cfg, frameCfg, host, stageEl, styleFields, timeCfg, vectorCfg, viewEl } = fc;
  fc.toolbox.closePopover();
  const has = fc.selection.size > 0;
  const multi = fc.selection.size >= 2;
  // Outline text is the primary action on a selected text box, so it sits high in
  // the menu (right under Delete) rather than buried at the end of the vector-ops
  // section - where, for a text selection, every other entry is disabled and the
  // whole menu can run past the bottom of the screen. Shown only when there's an
  // outlinable text box in the selection AND the tool can store the result
  // (vectorCfg = pathField declared) AND host.text is present.
  const canOutlineText = Boolean(vectorCfg && cfg.textField && (host as unknown as HostV1).text);
  const outlinableCount = canOutlineText ? fc.ops.countSelected(fc.objects.isOutlinableTextBox) : 0;
  // SLIDE actions for a selected frame (Frame state / Speaker notes / Stack),
  // collected here and spliced in right under Delete - the Outline-text
  // precedent: a frame IS a slide, so its slide verbs are the primary actions,
  // not row 23 of a menu that scrolls (Andy, 2026-09-02, after finding the
  // stack item below the fold).
  const slideItems: PopItem[] = [];
  const items: PopItem[] = [
    {
      label: t('Duplicate'),
      icon: icon(SVG.dup),
      run: () => fc.ops.duplicateSelection(),
      disabled: !has,
    },
    {
      label: t('Cut'),
      icon: icon(SVG.scissors),
      run: () => fc.modes.cutSelection(),
      disabled: !has,
    },
    {
      label: t('Copy style'),
      icon: icon(SVG.dup),
      run: () => fc.modes.copySelectionStyle(),
      disabled: !has || !styleFields.length,
    },
    {
      label: t('Paste style'),
      icon: icon(SVG.pencil),
      run: () => fc.modes.pasteSelectionStyle(),
      disabled: !has || !fc.styleClipboard,
    },
    {
      label: t('Delete'),
      icon: icon(SVG.trash),
      run: () => fc.ops.deleteSelection(),
      disabled: !has,
      danger: true,
    },
    { sep: true },
    ...(outlinableCount
      ? [
          {
            label: t('Outline text'),
            icon: icon(SVG.outlineText),
            run: () => void fc.objects.outlineTextOnSelection(),
          },
          { sep: true } as PopItem,
        ]
      : []),
    // Flip (mirror) - primary direct-manipulation actions on the selection, so they sit
    // high in the menu. Present only for a tool that declares the flip sub-fields
    // (`canFlip`), disabled with nothing selected like every action above.
    ...(canFlip
      ? [
          {
            label: t('Flip horizontal'),
            icon: icon(SVG.flipH),
            run: () => fc.objects.applyFlip('h'),
            disabled: !has,
          } as PopItem,
          {
            label: t('Flip vertical'),
            icon: icon(SVG.flipV),
            run: () => fc.objects.applyFlip('v'),
            disabled: !has,
          } as PopItem,
          { sep: true } as PopItem,
        ]
      : []),
    // Stacking order - icons only, 2×2: columns are magnitude (one step │ all the
    // way), rows are direction (up = forward/front, down = backward/back).
    {
      grid: [
        {
          label: t('Bring forward'),
          icon: icon(SVG.forward),
          run: () => fc.objects.applyZ('forward'),
          disabled: !has,
        },
        {
          label: t('Bring to front'),
          icon: icon(SVG.front),
          run: () => fc.objects.applyZ('front'),
          disabled: !has,
        },
        {
          label: t('Send backward'),
          icon: icon(SVG.backward),
          run: () => fc.objects.applyZ('backward'),
          disabled: !has,
        },
        {
          label: t('Send to back'),
          icon: icon(SVG.back),
          run: () => fc.objects.applyZ('back'),
          disabled: !has,
        },
      ],
      cols: 2,
    },
    { sep: true },
    // Align - icons only, 3 across × 2 rows (L/C/R then T/M/B).
    {
      grid: [
        {
          label: t('Align left'),
          icon: icon(SVG.alignL),
          run: () => fc.objects.applyAlign('left'),
          disabled: !has,
        },
        {
          label: t('Align centre'),
          icon: icon(SVG.alignC),
          run: () => fc.objects.applyAlign('hcentre'),
          disabled: !has,
        },
        {
          label: t('Align right'),
          icon: icon(SVG.alignR),
          run: () => fc.objects.applyAlign('right'),
          disabled: !has,
        },
        {
          label: t('Align top'),
          icon: icon(SVG.alignT),
          run: () => fc.objects.applyAlign('top'),
          disabled: !has,
        },
        {
          label: t('Align middle'),
          icon: icon(SVG.alignM),
          run: () => fc.objects.applyAlign('vcentre'),
          disabled: !has,
        },
        {
          label: t('Align bottom'),
          icon: icon(SVG.alignB),
          run: () => fc.objects.applyAlign('bottom'),
          disabled: !has,
        },
      ],
      cols: 3,
    },
    // Distribute - icons only, one row of 2 (needs 3+ boxes).
    {
      grid: [
        {
          label: t('Distribute horizontally'),
          icon: icon(SVG.distH),
          run: () => fc.objects.applyDistribute('h'),
          disabled: fc.selection.size < 3,
        },
        {
          label: t('Distribute vertically'),
          icon: icon(SVG.distV),
          run: () => fc.objects.applyDistribute('v'),
          disabled: fc.selection.size < 3,
        },
      ],
      cols: 2,
    },
    { sep: true },
    { label: t('Group'), icon: icon(SVG.group), run: () => fc.objects.groupSelection(), disabled: !multi },
    {
      label: t('Ungroup'),
      icon: icon(SVG.ungroup),
      run: () => fc.objects.ungroupSelection(),
      disabled: !fc.objects.canUngroup(),
    },
    {
      label: t('Clip to bottom shape'),
      icon: icon(SVG.clip),
      run: () => fc.objects.clipSelection(),
      disabled: !multi,
    },
    {
      label: t('Release clip'),
      icon: icon(SVG.unclip),
      run: () => fc.objects.releaseClip(),
      disabled: !fc.objects.selHasClip(),
    },
  ];
  // ── timeline ───────────────────────────────────────────────────────────────
  // Right-click parity with the panel's own timing toggle. Present for any
  // time-capable tool - `timeCfg` is null on Carousel Maker, Org Chart and Record, so
  // their menu is byte-for-byte what it was. It deliberately does NOT also require a
  // MOUNTED panel: a Design composition that has never opened its timeline is
  // exactly the user who needs to discover this, and a menu whose height changes
  // between two right-clicks on the same object is the thing the section above avoids.
  // So the panel is loaded on demand and the writer runs once it exists.
  // The two writers live in timeline-panel.ts (promote composes moveOverlay +
  // setDuration in ONE commit; demote clears to '' and repacks a seq row) and are
  // called, never reimplemented. Timing is per-box, so the items act on a single
  // selection and disable rather than hide, like Ungroup above.
  if (timeCfg) {
    const rows = fc.select.getBoxes();
    const i = fc.selection.size === 1 ? rows.findIndex((b, n) => fc.selection.has(fc.select.idOf(b, n))) : -1;
    const one = i >= 0 ? rows[i]! : null;
    const oneId = one ? fc.select.idOf(one, i) : '';
    const timed = !!one && fc.timeline.isTimedBox(one);
    // Open (loading the chunk if this is the first time), THEN write - `ensureTimeline`
    // resolves only once `timelinePanel` is assigned, and bails silently if the module
    // failed to load, so a broken chunk means no write rather than a half-written box.
    const withPanel = (fn: (p: NonNullable<typeof fc.timelinePanel>) => void) => () => {
      void fc.timeline.ensureTimeline(true).then(() => {
        if (fc.timelinePanel) fn(fc.timelinePanel);
      });
    };
    items.push({ sep: true });
    items.push({
      label: t('Add to the timeline'),
      icon: icon(SVG.timeline),
      run: withPanel((p) => p.promote(oneId)),
      disabled: !one || timed,
    });
    items.push({
      label: t('Make always on'),
      icon: icon(SVG.boxKind),
      run: withPanel((p) => p.demote(oneId)),
      disabled: !timed,
    });
  }
  // ── presentation (plan 112) ─────────────────────────────────────────────────
  // Per-box authoring for present mode, on a frame-capable tool: the audio opt-in and
  // the build (reveal) step. Shown ONLY for a single selected non-frame box, so a
  // multi-select, a frame, or a non-frame tool leaves the menu byte-for-byte unchanged.
  if (frameCfg && fc.selection.size === 1) {
    const rows = fc.select.getBoxes();
    const si = fc.select.selIndices(rows);
    const one = si.length === 1 ? rows[si[0]!]! : null;
    const isFrame = !!one && String(one[cfg.kindField]) === frameCfg.frameKind;
    if (one && !isFrame) {
      const img = one.image as { url?: string; type?: string } | undefined;
      const hasImage = !!img?.url;
      const isVid =
        img?.type === 'video' || /\.(mp4|m4v|mov|webm)($|\?|#)/i.test(String(img?.url ?? ''));
      const curBuild = Number(one.build);
      const frameBoxesNow = rows.filter((b) => String(b[cfg.kindField]) === frameCfg.frameKind);
      const bgFrameId = String(one.frame ?? '') || resolveFrame(one, frameBoxesNow);
      const setField = (field: string, value: InputValue): void => {
        const bs = fc.select.getBoxes();
        const idx = new Set(fc.select.selIndices(bs));
        fc.select.commit(bs.map((b, i) => (idx.has(i) ? { ...b, [field]: value } : b)));
      };
      items.push({ sep: true });
      // Set as background: fill the box's frame, cover-fit, adopt membership, and send it
      // behind its siblings - the one-click cover image/video backdrop (plan section 8). Any
      // image/video box that resolves to a frame; disabled otherwise so the row is stable.
      items.push({
        label: t('Set as slide background'),
        icon: icon(SVG.image),
        disabled: !(hasImage && bgFrameId),
        run: () => {
          const bs = fc.select.getBoxes();
          const idx = fc.select.selIndices(bs);
          const fbs = bs.filter((b) => String(b[cfg.kindField]) === frameCfg.frameKind);
          const fid = String(bs[idx[0]!]?.frame ?? '') || resolveFrame(bs[idx[0]!], fbs);
          const fb = bs.find((b) => String(b.id ?? '') === fid);
          if (!fb || idx.length !== 1) return;
          const filled = bs.map((b, i) =>
            i === idx[0]
              ? { ...b, x: fb.x, y: fb.y, w: fb.w, h: fb.h, fit: 'cover', frame: fid }
              : b
          );
          fc.select.commit(reorderZ(filled, idx, 'back'));
        },
      });
      items.push({
        label: t('Play sound when presenting'),
        icon: icon(SVG.video),
        on: one.presentAudio === true,
        disabled: !isVid,
        run: () => setField('presentAudio', one.presentAudio !== true),
      });
      // Reveal step (build): "Always visible" + steps 1–3 as radios (equal numbers
      // reveal together; a box hidden until its step is advanced to in present mode).
      items.push({
        label: t('Always visible'),
        icon: icon(SVG.present),
        on: !(curBuild >= 1),
        run: () => setField('build', ''),
      });
      for (const n of [1, 2, 3]) {
        items.push({
          label: `${t('Reveal at step')} ${n}`,
          on: curBuild === n,
          run: () => setField('build', n),
        });
      }
      // Morph match (plan 112 M5's last gap): the explicit pairing tag the morph
      // transition prefers over its implicit text/image matching.
      items.push({
        label: t('Morph match…'),
        icon: icon(SVG.present),
        run: () => fc.fieldPanels.openMorphMatchPanel(viewEl, si[0]!),
      });
    } else if (one && isFrame) {
      // A selected FRAME: set its present-mode `state` tokens (per-slide theming) and
      // its speaker `notes` (shown only in the speaker view, never on the slide).
      // These go into slideItems, which the tail splices in under Delete.
      slideItems.push({
        label: t('Frame state (present)…'),
        icon: icon(SVG.present),
        run: () => fc.fieldPanels.openFrameStatePanel(viewEl, si[0]!),
      });
      slideItems.push({
        label: t('Speaker notes…'),
        icon: icon(SVG.notes),
        run: () => fc.fieldPanels.openSpeakerNotesPanel(viewEl, si[0]!),
      });
      // Sub-slide stacks (plan 112 M5): structure disposes. Stacking writes the
      // previous COLUMN HEAD's id into stackOf; unstacking clears it. Present
      // order is the hook's own (order asc, x asc), so "previous" here is
      // exactly the slide to this one's left in the deck.
      {
        const bs2 = fc.select.getBoxes();
        const fbs = bs2
          .map((b, i2) => ({ b, i2 }))
          .filter((e) => String(e.b[cfg.kindField]) === frameCfg?.frameKind)
          .sort(
            (p, q) =>
              (Number(p.b.order) || 0) - (Number(q.b.order) || 0) ||
              (Number(p.b.x) || 0) - (Number(q.b.x) || 0)
          );
        const at = fbs.findIndex((e) => e.i2 === si[0]);
        const stacked = String(bs2[si[0]!]?.stackOf ?? '') !== '';
        const prevHead =
          at > 0
            ? fbs
                .slice(0, at)
                .reverse()
                .find((e) => String(e.b.stackOf ?? '') === '')
            : undefined;
        if (stacked) {
          slideItems.push({
            label: t('Unstack this slide'),
            icon: icon(SVG.present),
            run: () => fc.fieldPanels.setField('stackOf', ''),
          });
        } else if (prevHead) {
          const headId = String(prevHead.b.id ?? '');
          if (headId) {
            slideItems.push({
              label: t('Stack under the previous slide'),
              icon: icon(SVG.present),
              run: () => fc.fieldPanels.setField('stackOf', headId),
            });
          }
        }
      }
    }
    // Per-box CSS class names (plan 112 M4) - the companion to doc-level Custom CSS,
    // for ANY single box, frame included: a rule can then say `.callout { … }` instead
    // of addressing a machine-minted id. Not a present-only field (the class rides the
    // canvas and every export), so it sits at the end of the section rather than inside
    // either branch.
    if (one) {
      items.push({
        label: t('CSS class…'),
        icon: icon(SVG.code),
        run: () => fc.fieldPanels.openBoxClassPanel(viewEl, si[0]!),
      });
    }
  }
  // ── vector operations ──────────────────────────────────────────────────────
  // Present only for tools whose manifest declares `canvas.pathField` (there is
  // nowhere to store a result otherwise); WITHIN the section every entry disables
  // rather than hides, like Ungroup / Release clip above, so the menu keeps the same
  // height between right-clicks.
  if (vectorCfg) {
    const regions = fc.ops.countSelected((b) => boxOutlineKind(b, vectorCfg) !== 'none');
    const paths = fc.ops.countSelected((b) => boxOutlineKind(b, vectorCfg) === 'path');
    // A boolean needs two operands that actually bound a region - two text boxes are
    // two selected boxes and no shapes at all.
    const boolItem = (op: BooleanOpName, label: string, ic: string): PopGridItem => ({
      label,
      icon: icon(ic),
      disabled: regions < 2,
      run: () =>
        fc.ops.runVectorOp((ops, id) => booleanBoxes(ops, op, { cfg: vectorCfg, id }), {
          skipNote: true,
          empty: fc.ops.boolEmptyMessage(op),
        }),
    });
    items.push({ sep: true });
    items.push({
      cols: 4,
      grid: [
        boolItem('union', t('Union - merge into one shape'), SVG.boolUnion),
        // Operand order is vector-ops' documented convention and Illustrator's/Figma's:
        // the BOTTOMMOST selected shape is the base and everything above is taken away.
        boolItem(
          'difference',
          t('Subtract - remove the shapes above from the bottom one'),
          SVG.boolSubtract
        ),
        boolItem('intersect', t('Intersect - keep only where they overlap'), SVG.boolIntersect),
        boolItem('xor', t('Exclude - keep everything but the overlap'), SVG.boolExclude),
      ],
    });
    items.push({
      label: t('Outline stroke…'),
      icon: icon(SVG.outlineStroke),
      disabled: !regions,
      run: () => fc.ops.askOutlineStroke(),
    });
    items.push({
      label: t('Offset path…'),
      icon: icon(SVG.offsetPath),
      disabled: !regions,
      run: () => fc.ops.askOffsetPath(),
    });
    items.push({
      label: t('Simplify'),
      icon: icon(SVG.simplify),
      disabled: !paths,
      run: () =>
        fc.ops.runVectorOp((ops, id) => { const { SIMPLIFY_TOL } = fc; return simplifyBoxes(ops, SIMPLIFY_TOL, { cfg: vectorCfg, id }); }, {
          each: true,
        }),
    });
    // NOTE: "Outline text" lives near the TOP of this menu (just under Delete), not
    // here - see the canOutlineText block at the head of openContextMenu. It is the
    // gateway INTO vector editing for a text box, so it must not sit below a wall of
    // path-only ops that are all disabled while text is selected.
  }
  // ── remove background ──────────────────────────────────────────────────────
  // Present for any tool with an image field (somewhere to store the cutout)
  // once the on-device matte capability has a STAGED model - otherwise absent,
  // like the timeline/vector sections. Acts on ONE selected image box and, like
  // Ungroup / the vector ops, disables rather than hides so the menu keeps a
  // constant height between right-clicks.
  const matteApi = (host as unknown as HostV1).matte;
  if (cfg.imageField && matteApi?.isAvailable() === true && matteApi.models().length > 0) {
    const rows = fc.select.getBoxes();
    const idxs = fc.select.selIndices(rows);
    const one = idxs.length === 1 ? rows[idxs[0]!]! : null;
    const img = one
      ? (one[cfg.imageField] as { id?: string; url?: string } | undefined)
      : undefined;
    items.push({ sep: true });
    items.push({
      label: t('Remove background'),
      icon: icon(SVG.scissors),
      run: () => void fc.objects.removeBackgroundOnSelection(),
      disabled: !(img?.id || img?.url),
    });
  }
  // ── lift layers (plans/104 section 7) ─────────────────────────────────────────────
  // Present for any tool with an image field (somewhere to put the derived
  // documents) - absent entirely otherwise, like the timeline/vector/matte
  // sections. WITHIN the section it disables rather than hides, so the menu keeps
  // the same height between right-clicks: the entry is what tells someone the
  // action exists at all, and an entry that appears only once you have already
  // selected the right kind of box teaches nobody anything.
  if (fc.dialogs.canLift()) {
    items.push({ sep: true });
    items.push({
      label: t('Lift layers'),
      icon: icon(SVG.liftLayers),
      run: () => fc.dialogs.askLiftLayers(),
      disabled: fc.dialogs.liftTargetIndex(fc.select.getBoxes()) < 0,
    });
  }
  // ── choreograph (plans/104 P4) ────────────────────────────────────────────────────
  // Lift's own section, and its posture verbatim: present for any tool that can hold
  // keyframes at all, absent otherwise, and WITHIN the section disabled rather than
  // hidden so the menu keeps a constant height. The separator is Lift's when Lift is
  // here; a keyframe-capable tool with no image field opens the section itself.
  if (fc.dialogs.canChoreograph()) {
    if (!fc.dialogs.canLift()) items.push({ sep: true });
    items.push({
      label: t('Choreograph…'),
      icon: icon(SVG.choreo),
      run: () => fc.dialogs.askChoreograph(),
      disabled: !fc.dialogs.canChoreographNow(),
    });
  }
  fc.lastMenuAt = { x: clientX, y: clientY };
  // The slide splice: index 3 is the slot right after Duplicate, Delete and
  // their separator - the same slot Outline text takes for a text selection
  // (a frame selection never has one, so the two can't collide).
  if (slideItems.length) items.splice(3, 0, ...slideItems, { sep: true });
  fc.popover = document.createElement('div');
  fc.popover.className = 'fc-popover fc-context-menu';
  // The rows carry `role="menuitem"`, so the container has to say `menu` - an orphan
  // menuitem tells a screen reader less than a plain button would.
  fc.popover.setAttribute('role', 'menu');
  fc.toolbox.fillPopover(fc.popover, items);
  fc.popover.addEventListener('pointerdown', (e) => e.stopPropagation());
  fc.popover.addEventListener('keydown', fc.menus.onPopoverKey);
  stageEl.appendChild(fc.popover);
  const sr = stageEl.getBoundingClientRect();
  const left = Math.max(6, Math.min(clientX - sr.left, sr.width - fc.popover.offsetWidth - 6));
  const top = Math.max(6, Math.min(clientY - sr.top, sr.height - fc.popover.offsetHeight - 6));
  fc.popover.style.left = left + 'px';
  fc.popover.style.top = top + 'px';
}
// Open the menu at a point, selecting whatever is under it first (a right-click on an
// unselected box acts on THAT box, not on the stale selection). Shared by the desktop
// `contextmenu` event and the touch two-finger tap below, so both behave identically.
export function contextMenuAt(fc: FcCtx, clientX: number, clientY: number, soloBox: boolean): void {
  if (fc.editing) fc.textEdit.commitTextEdit();
  // While node editing, right-click is a NODE menu (align/distribute/continuity/delete),
  // not the object menu - and it must not re-select boxes underneath.
  if (fc.penEdit) {
    fc.penTool.openPenNodeMenu(clientX, clientY);
    return;
  }
  const nat = fc.stage.clientToNative(clientX, clientY);
  const boxes = fc.select.getBoxes();
  const hit = fc.select.selectHit(boxes, nat.x, nat.y); // artboard-aware: child over frame; frame on empty area
  // Plan 179 C4, both halves. An UNSELECTED box is SELECTED - `new Set`, replacing what
  // was there, never adding to it: a menu that acts on "this and whatever was selected
  // before" is a menu whose verbs are aimed at something the user cannot see. A box that
  // IS in the selection leaves the selection exactly as it stands, so right-clicking one
  // member of a group of five still means all five.
  if (hit >= 0 && !fc.selection.has(fc.select.idOf(boxes[hit], hit))) {
    fc.selection = new Set(fc.select.selectionForHit(boxes, hit, soloBox));
    fc.ctxSelKey = null; // the object bar re-gates for the new kind
    fc.chromeSync.renderChrome();
  }
  openContextMenu(fc, clientX, clientY);
}
export function onContextMenu(fc: FcCtx, e: MouseEvent): void {
  e.preventDefault();
  contextMenuAt(fc, e.clientX, e.clientY, e.altKey);
}
export function openAddMenu(fc: FcCtx, anchor: HTMLElement): void {
  const { ADD_KIND_ICON, addKinds } = fc;
  spawnPopover(fc, 
    anchor,
    addKinds.map((k) => ({
      label: k.label ? t(k.label) : k.id,
      icon: icon(ADD_KIND_ICON[k.id] || SVG.add),
      run: () => fc.modes.setMode('create', { kind: k }),
    }))
  );
}
export function openArrangeMenu(fc: FcCtx): void {
  const has = fc.selection.size > 0;
  const multi = fc.selection.size >= 2;
  const canDist = fc.selection.size >= 3;
  spawnPopover(fc, fc.arrangeBtn!, [
    // Align - a compact 3×2 icon grid (left/centre/right · top/middle/bottom).
    {
      cols: 3,
      grid: [
        { label: t('Align left'), icon: icon(SVG.alignL), run: () => fc.objects.applyAlign('left') },
        { label: t('Align centre'), icon: icon(SVG.alignC), run: () => fc.objects.applyAlign('hcentre') },
        { label: t('Align right'), icon: icon(SVG.alignR), run: () => fc.objects.applyAlign('right') },
        { label: t('Align top'), icon: icon(SVG.alignT), run: () => fc.objects.applyAlign('top') },
        { label: t('Align middle'), icon: icon(SVG.alignM), run: () => fc.objects.applyAlign('vcentre') },
        { label: t('Align bottom'), icon: icon(SVG.alignB), run: () => fc.objects.applyAlign('bottom') },
      ],
    },
    // Distribute - needs 3+ selected, so disabled otherwise.
    {
      cols: 2,
      grid: [
        {
          label: t('Distribute horizontally'),
          icon: icon(SVG.distH),
          run: () => fc.objects.applyDistribute('h'),
          disabled: !canDist,
        },
        {
          label: t('Distribute vertically'),
          icon: icon(SVG.distV),
          run: () => fc.objects.applyDistribute('v'),
          disabled: !canDist,
        },
      ],
    },
    { sep: true },
    { label: t('Bring to front'), icon: icon(SVG.front), run: () => has && fc.objects.applyZ('front') },
    { label: t('Bring forward'), icon: icon(SVG.forward), run: () => has && fc.objects.applyZ('forward') },
    { label: t('Send backward'), icon: icon(SVG.backward), run: () => has && fc.objects.applyZ('backward') },
    { label: t('Send to back'), icon: icon(SVG.back), run: () => has && fc.objects.applyZ('back') },
    { sep: true },
    { label: t('Group'), icon: icon(SVG.group), run: () => multi && fc.objects.groupSelection() },
    { label: t('Ungroup'), icon: icon(SVG.ungroup), run: () => fc.objects.ungroupSelection() },
    { sep: true },
    {
      label: t('Clip to bottom shape'),
      icon: icon(SVG.clip),
      run: () => multi && fc.objects.clipSelection(),
    },
    { label: t('Release clip'), icon: icon(SVG.unclip), run: () => fc.objects.releaseClip() },
  ]);
}
export function menusOps(fc: FcCtx) {
  return {
    spawnPopover: bindOp(fc, spawnPopover),
    popoverItems: bindOp(fc, popoverItems),
    onPopoverKey: bindOp(fc, onPopoverKey),
    importAsScenes: bindOp(fc, importAsScenes),
    importAsArtboards: bindOp(fc, importAsArtboards),
    openImportPanel: bindOp(fc, openImportPanel),
    openContextMenu: bindOp(fc, openContextMenu),
    contextMenuAt: bindOp(fc, contextMenuAt),
    onContextMenu: bindOp(fc, onContextMenu),
    openAddMenu: bindOp(fc, openAddMenu),
    openArrangeMenu: bindOp(fc, openArrangeMenu),
  };
}
