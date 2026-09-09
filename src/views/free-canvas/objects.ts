// SPDX-License-Identifier: MPL-2.0
/**
 * free-canvas: object operations - images, background removal, text outlining, group and clip, z, align, flip.
 *
 * Every function takes the shared `fc: FcCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `fc.<module>.<fn>`. Extracted verbatim
 * from initFreeCanvas() by scripts/split-closure.ts.
 */
import { alignBoxes, applyLift, distributeBoxes, isSvgImageRef, liftCanCrop, liftCropScale, liftRows, num, reorderZ } from '../free-canvas-math.ts';
import type { AlignEdge, Axis, Box, ZOp } from '../free-canvas-math.ts';
import { pathToBox, replaceBoxes } from '../vector-ops.ts';
import type { OutlineGroup } from '../outline-text.ts';
import type { MatteHost, MatteSource } from '../matte-dialog.ts';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { InputValue } from '../../../../../engine/src/inputs.ts';
import { announce } from '../../a11y.ts';
import { t } from '../../i18n.ts';
import { boolOf } from './shared.ts';
import type { SvgLayerPlan, SvgSourceBox } from './shared.ts';
import { bindOp, type FcCtx } from './context.ts';

// `initialTab` is the picker pane this add-kind should OPEN on (picker.ts's
// PickerOpts.initialTab - a default the user can leave immediately, not a lock):
// 'tools' for the Tool kind, 'library' for the media kinds, whose `pickType` has
// already narrowed the library to just the assets that fit.
export async function pickImage(fc: FcCtx, pickOpts?: {
  pickType?: 'lottie' | 'video' | 'audio';
  initialTab?: 'library' | 'tools';
}): Promise<void> {
  const { cfg, editTool, host } = fc;
  if (!cfg.imageField || !host.assets?.pick) return;
  const pickType = pickOpts?.pickType;
  const boxes0 = fc.select.getBoxes();
  const first: Box = boxes0[fc.select.selIndices(boxes0)[0]!] || {};
  // The box's current image, viewed as an asset ref (the image field holds one).
  const curImg = first[cfg.imageField] as
    | { id?: string; meta?: { toolUrl?: string; name?: string } }
    | undefined;
  // A box already filled by a live Lolly render: ask edit-or-replace before
  // opening the picker (same choice-first flow as the sidebar image slots).
  const curToolUrl = curImg?.meta?.toolUrl;
  if (curToolUrl && editTool) {
    // Lazy: picker.ts pulls in the picker's own CSS chunk, and the overlay only needs
    // it on this one branch - a static import would ship (and evaluate) it for every
    // editor mount.
    const { askLollyIntent } = await import('../picker.ts');
    const intent = await askLollyIntent(curImg?.meta?.name);
    if (!intent) return;
    if (intent === 'edit') {
      try {
        const edited = await editTool(curToolUrl, 'edit');
        if (!edited) return;
        const boxes = fc.select.getBoxes();
        const sel = new Set(fc.select.selIndices(boxes));
        fc.select.commit(boxes.map((b, i) => (sel.has(i) ? { ...b, [cfg.imageField]: edited } : b)));
      } catch {
        /* user cancelled */
      }
      return;
    }
  }
  try {
    const ref = await host.assets!.pick({
      title:
        pickType === 'video'
          ? t('Choose a video')
          : pickType === 'lottie'
            ? t('Choose an animation')
            : pickType === 'audio'
              ? t('Choose a sound')
              : pickOpts?.initialTab === 'tools'
                ? t('Choose a tool')
                : t('Choose an image'),
      // No type constraint by default: boxes take rasters AND vectors - logos and
      // the themable two-colour icons (with the picker's theme strip) included, plus
      // animated rasters (gif/apng/webp, which are type:'raster'). The "Animation" /
      // "Video" add-kinds constrain the picker to lottie / video respectively; each
      // renders as a live player once placed (mediaHtmlFor dispatches on asset type).
      ...(pickType ? { type: pickType } : {}),
      // Open on the pane that matches what the user asked to add (see the note on
      // this function). Omitted → the picker's own default (Library).
      ...(pickOpts?.initialTab ? { initialTab: pickOpts.initialTab } : {}),
      allowUpload: true,
      current: curImg?.id,
      // A box image that's already a Lolly render surfaces the picker's
      // edit-the-current-tool banner (inputs pre-filled) - the box's only
      // route back into the source tool, since boxes have no Edit badge.
      currentToolUrl: curImg?.meta?.toolUrl,
      currentToolName: curImg?.meta?.name,
      // Choosing a Lolly link or a saved creation opens its inputs first so the
      // user can set values (configure → insert), reusing the sidebar's editor.
      editTool,
    });
    if (!ref) return;
    const boxes = fc.select.getBoxes();
    const sel = new Set(fc.select.selIndices(boxes));
    fc.select.commit(boxes.map((b, i) => (sel.has(i) ? { ...b, [cfg.imageField]: ref } : b)));
  } catch {
    /* user cancelled */
  }
}
// Cut the background out of the single selected image box on-device (host.matte)
// and drop the cutout back over that box - the exact tail of pickImage, so the
// result is an ordinary image ref with alpha, its original preserved as a C2PA
// ingredient. Lazy chunk (matte-dialog.ts) like askLollyIntent above.
//
// The run is a BACKGROUND job (WP-F): the dialog closes at once and the cutout
// arrives minutes later, by which time the selection may be somewhere else
// entirely. So the swap is pinned to the BOX'S OWN ID (plan 100 section 3), never
// the live selection, and simply doesn't happen if that box is gone - the cutout
// is a saved asset either way, so nothing is lost.
export async function removeBackgroundOnSelection(fc: FcCtx): Promise<void> {
  const { cfg, host } = fc;
  const imageField = cfg.imageField;
  if (!imageField) return;
  const boxes0 = fc.select.getBoxes();
  const idxs = fc.select.selIndices(boxes0);
  if (idxs.length !== 1) return;
  const at0 = idxs[0]!;
  const box = boxes0[at0]!;
  const cur = box[imageField] as
    | { id?: string; url?: string; meta?: { name?: string } }
    | undefined;
  if (!cur || (!cur.id && !cur.url)) return; // no image to cut out
  const boxId = fc.select.idOf(box, at0);
  try {
    const { openMatteDialog } = await import('../matte-dialog.ts');
    await openMatteDialog(host as unknown as MatteHost, {
      source: cur as unknown as MatteSource,
      sourceName: cur.meta?.name,
      onComplete: (cutout) => {
        const boxes = fc.select.getBoxes();
        const at = fc.select.indexOfId(boxes, boxId);
        if (at < 0) return; // that box is gone - leave the canvas alone
        fc.select.commit(boxes.map((b, i) => (i === at ? { ...b, [imageField]: cutout } : b)));
      },
    });
  } catch {
    /* cancelled or unavailable */
  }
}
// ── outline text ─────────────────────────────────────────────────────────────
// Convert selected text boxes' glyphs into ordinary kind:'path' boxes (plan 88 -
// the Font Outliner capability, in place). Measurement + shaping live in the lazy
// outline-text.ts chunk, which reuses the export walk's line plumbing; here is
// only the model surgery: source box → per-fill path boxes at the same z, one
// commit, refusal-first (a box that can't be outlined faithfully is left alone
// and said so, never partially converted).

export function isOutlinableTextBox(fc: FcCtx, b: Box): boolean {
  const { cfg } = fc;
  const kind = String(b[cfg.kindField] ?? '');
  if (kind === 'path' || kind === 'audio') return false;
  return Boolean(cfg.textField && String(b[cfg.textField] ?? '').trim());
}
/** A box that paints something besides its text (fill, gradient, image, or a
 *  border) keeps its frame; only the text leaves it. A bare text box is replaced
 *  outright. The border matters because a non-path box renders strokeW>0 + a stroke
 *  colour as a CSS border on the frame, and the glyph path boxes deliberately clear
 *  their stroke - so without keeping the frame a bordered label would silently lose
 *  its border on outline. */
export function paintsBesidesText(fc: FcCtx, b: Box): boolean {
  const { cfg } = fc;
  const bg = cfg.fillField ? String(b[cfg.fillField] ?? '').trim() : '';
  const grad = cfg.gradField ? String(b[cfg.gradField] ?? '').trim() : '';
  const img = cfg.imageField
    ? (b[cfg.imageField] as { id?: string; url?: string } | undefined)
    : undefined;
  const border =
    num(b[cfg.strokeWField], 0) > 0 && String(b[cfg.strokeField] ?? '').trim() !== '';
  return Boolean(bg || grad || (img && (img.id || img.url)) || border);
}
export async function outlineTextOnSelection(fc: FcCtx): Promise<void> {
  if (fc.outliningInFlight) return;
  fc.outliningInFlight = true;
  try {
    await runOutlineTextOnSelection(fc);
  } finally {
    fc.outliningInFlight = false;
  }
}
export async function runOutlineTextOnSelection(fc: FcCtx): Promise<void> {
  const { canvasEl, cfg, host, timeCfg, vectorCfg } = fc;
  if (!vectorCfg || !cfg.textField) return;
  const textApi = (host as unknown as HostV1).text;
  if (!textApi) return;
  const boxes0 = fc.select.getBoxes();
  const srcIds = fc.select.selIndices(boxes0)
    .filter((i) => isOutlinableTextBox(fc, boxes0[i]!))
    .map((i) => fc.select.idOf(boxes0[i], i));
  if (!srcIds.length) return;

  const { outlineBoxText, rotatedFrameShift } = await import('../outline-text.ts');
  const rectToNative = (r: DOMRect): { x: number; y: number; w: number; h: number } => {
    const { cr, scale } = fc.stage.metrics();
    return {
      x: (r.left - cr.left) / scale,
      y: (r.top - cr.top) / scale,
      w: r.width / scale,
      h: r.height / scale,
    };
  };

  // Settle fonts AND layout ONCE, up front - before touching any box DOM. A pending
  // webfont load resolves here, and the template's fit pass (which re-runs on
  // document.fonts.ready and rewrites --fit → font-size → line wrapping) gets two
  // paint frames to finish. If we awaited this per box instead, a font-load could
  // move the box between the query and the measurement, so the captured element is
  // stale and the shaped glyphs land at the wrong size/place (or a repaint drops the
  // result). After this, each box is queried fresh and measured with no await between.
  try {
    await document.fonts?.ready;
  } catch {
    /* no Font Loading API */
  }
  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

  const results = new Map<string, OutlineGroup[]>();
  let firstRefusal: string | null = null;
  for (const id of srcIds) {
    const el = canvasEl.querySelector<HTMLElement>(`.lolly-box[data-box-id="${fc.keys.cssEscape(id)}"]`);
    const textEl = el?.querySelector<HTMLElement>('.lolly-box-text');
    if (!el || !textEl) {
      firstRefusal ??= 'no-text';
      continue;
    }
    try {
      const res = await outlineBoxText(el, textEl, textApi, rectToNative);
      if (res.ok) results.set(id, res.groups);
      else firstRefusal ??= res.reason;
    } catch {
      firstRefusal ??= 'empty';
    }
  }

  // The model may have moved while shaping - re-read and apply by id, one commit.
  // `kfField` and `zField` ride along with the timing (plans/104, the M1-flagged
  // gap): a clip on screen 2s..5s stays 2s..5s, and a clip that was FLYING stays
  // flying - outlining its text must not quietly un-animate it, or drop it back to
  // the floor. Both are per-box authored values with no cross-box identity (unlike
  // `linkOf`, which is deliberately absent from this list), and the keyframe
  // channels are relative offsets, so a glyph box inherits the motion correctly
  // wherever the outlining put it.
  const timeCarry = timeCfg
    ? [
        timeCfg.startField,
        timeCfg.durField,
        timeCfg.clipInField,
        timeCfg.speedField,
        timeCfg.enterField,
        timeCfg.exitField,
        timeCfg.enterMsField,
        timeCfg.exitMsField,
        timeCfg.muteField,
        timeCfg.laneField,
        timeCfg.enterEaseField,
        timeCfg.exitEaseField,
        timeCfg.kfField,
        timeCfg.zField,
      ].filter((f): f is string => Boolean(f))
    : [];
  const shadowCarry = [
    cfg.shadowColorField,
    cfg.shadowXField,
    cfg.shadowYField,
    cfg.shadowBlurField,
  ].filter(Boolean) as string[];
  let next = fc.select.getBoxes();
  const nextSel = new Set<string>();
  let outlined = 0;
  for (const [srcId, groups] of results) {
    const at = next.findIndex((b, i) => fc.select.idOf(b, i) === srcId);
    if (at < 0) continue;
    const src = next[at]!;
    // Keep the source frame (only the text leaves it) when it also paints a fill/
    // gradient/image/border; a bare text box is replaced outright. Decided once here
    // because it also governs shadow carry below.
    const keepSource = paintsBesidesText(fc, src);
    const rot = num(src[cfg.rotationField], 0);
    const scx = num(src[cfg.xField], 0) + num(src[cfg.wField], 0) / 2;
    const scy = num(src[cfg.yField], 0) + num(src[cfg.hField], 0) / 2;
    const made: Box[] = [];
    let failed = false;
    // Outlining now yields one box PER GLYPH, so the letters are GROUPED to stay a word:
    // keep the source's own group if it had one (respect existing structure), else mint a
    // fresh shared group when there is more than one box. A lone glyph needs no group.
    const madeGroup = cfg.groupField
      ? src[cfg.groupField]
        ? String(src[cfg.groupField])
        : groups.length > 1
          ? freshGroupId(fc, next)
          : ''
      : '';
    for (const g of groups) {
      const pb = pathToBox(g.path, src, { cfg: vectorCfg, id: fc.select.freshId(next.concat(made)) });
      // Only the node ceiling gets here (finite, non-empty geometry by construction)
      // - too much text for one encodable shape. Refuse the whole box.
      if (!pb) {
        failed = true;
        break;
      }
      // A path box's fill field paints the GLYPHS; the text box's fill was its
      // background. pathToBox inherited the latter - override with the run colour.
      if (cfg.fillField) pb[cfg.fillField] = g.fill;
      pb[cfg.strokeField] = '';
      pb[cfg.strokeWField] = 0;
      pb[cfg.fillRuleField] = 'nonzero';
      // Shadow: only carry it onto the glyphs when the source is REPLACED. If the
      // frame is kept (keepSource), it still paints the box's own shadow, so copying
      // it onto each glyph too would double it. And any carried shadow becomes
      // 'content' (a drop-shadow following the glyph silhouette): 'text' has nothing
      // to attach to once the text is geometry, and 'box' would otherwise draw a
      // rectangle around each colour group's bounding box - never what was intended.
      // Timing fields always carry (a clip on screen 2s..5s stays 2s..5s) - but never
      // linkOf: duplicating a detach-audio link id would corrupt its link group.
      const shadowField = cfg.shadowField;
      if (!keepSource && shadowField) {
        const sh = src[shadowField];
        if (sh !== undefined && sh !== '' && sh !== 'none') {
          pb[shadowField] = 'content';
          for (const f of shadowCarry) if (src[f] !== undefined) pb[f] = src[f];
        }
      }
      for (const f of timeCarry) if (src[f] !== undefined) pb[f] = src[f];
      // Group membership: every glyph box of one source shares `madeGroup` (its old group
      // if it had one, else a fresh one for the word), so the letters move together and
      // the replace/keep-source branches match replaceBoxes (which only fills group when
      // unset) instead of orphaning glyphs when the group later moves.
      if (cfg.groupField && madeGroup) pb[cfg.groupField] = madeGroup;
      if (rot) {
        const cx = num(pb[cfg.xField], 0) + num(pb[cfg.wField], 0) / 2;
        const cy = num(pb[cfg.yField], 0) + num(pb[cfg.hField], 0) / 2;
        const { dx, dy } = rotatedFrameShift(scx, scy, cx, cy, rot);
        pb[cfg.xField] = num(pb[cfg.xField], 0) + dx;
        pb[cfg.yField] = num(pb[cfg.yField], 0) + dy;
        pb[cfg.rotationField] = rot;
      }
      made.push(pb);
    }
    if (failed || !made.length) {
      firstRefusal ??= 'too-complex';
      continue;
    }
    if (keepSource) {
      next = next.map((b, i) => (i === at ? { ...b, [cfg.textField as string]: '' } : b));
      next = [...next.slice(0, at + 1), ...made, ...next.slice(at + 1)];
    } else {
      next = replaceBoxes(next, [srcId], -1, made, { cfg: vectorCfg });
    }
    for (const nb of made) nextSel.add(String(nb[cfg.idField]));
    outlined++;
  }

  if (!outlined) {
    fc.stage.flash(
      firstRefusal === 'not-visible'
        ? t(
            'This clip is not on screen at the current playhead. Move to it, then outline its text.'
          )
        : firstRefusal === 'no-font'
          ? t('No font file could be resolved for this text, so it was left as it is.')
          : firstRefusal === 'notdef'
            ? t('The font cannot draw some of these characters, so the text was left as it is.')
            : firstRefusal === 'too-complex'
              ? t('There is too much text to outline in one shape, so it was left as it is.')
              : t('Nothing in this selection can be outlined.')
    );
    return;
  }
  fc.selection = nextSel;
  fc.select.commit(next);
  const skipped = srcIds.length - outlined;
  fc.stage.flash(
    (outlined === 1
      ? t('Text outlined. It is now a shape and can no longer be edited as text.')
      : t('{n} text boxes outlined. They are now shapes and can no longer be edited as text.', {
          n: outlined,
        })) +
      (skipped
        ? ' ' +
          (skipped === 1
            ? t('One selected item could not be outlined and was left as it is.')
            : t('{n} selected items could not be outlined and were left as they are.', {
                n: skipped,
              }))
        : '')
  );
}
export function freshGroupId(fc: FcCtx, boxes: Box[]): string {
  const used = new Set(boxes.map((b) => fc.select.groupOf(b)).filter(Boolean));
  let g: string;
  do {
    g = 'g' + Date.now().toString(36).slice(-4) + (fc.groupSeq++).toString(36);
  } while (used.has(g));
  return g;
}
export function groupSelection(fc: FcCtx): void {
  const { cfg } = fc;
  if (!cfg.groupField) return;
  const boxes = fc.select.getBoxes();
  const idx = fc.select.selIndices(boxes);
  if (idx.length < 2) return;
  const g = freshGroupId(fc, boxes);
  const set = new Set(idx);
  fc.select.commit(boxes.map((b, i) => (set.has(i) ? { ...b, [cfg.groupField]: g } : b)));
}
export function ungroupSelection(fc: FcCtx): void {
  const { cfg } = fc;
  if (!cfg.groupField) return;
  const boxes = fc.select.getBoxes();
  const set = new Set(fc.select.selIndices(boxes));
  if (boxes.some((b, i) => set.has(i) && fc.select.groupOf(b))) {
    fc.select.commit(boxes.map((b, i) => (set.has(i) && fc.select.groupOf(b) ? { ...b, [cfg.groupField]: '' } : b)));
    return;
  }
  // Nothing tagged: an imported vector is the other kind of group (below).
  const targets = unpackTargetIds(fc, boxes);
  if (targets.length) void unpackSvgBoxes(fc, targets);
}
/**
 * The selected boxes an Ungroup would take APART rather than untag: each holds an SVG
 * and carries no group of its own. An imported vector is a group in every sense but
 * the field - it was drawn as parts and arrives as one picture - so Ungroup on it does
 * what Ungroup does everywhere else and separates the parts: one box per layer of the
 * drawing, cropped to its ink, sharing a fresh group so the whole still selects and
 * moves as one until the next Ungroup peels that too (Andy, 2026-09-02: "importing
 * vectors as images into design should allow groups to be ungrouped"). Every derived
 * part is itself a standalone SVG, so the peel repeats down to the leaves.
 *
 * Lift layers is the same enumeration with a different intent - a depth ladder and a
 * shadow for a camera move, behind a confirm - so the two share `liftRows` and differ
 * only in `flat` (and in the hero heuristic, see `unpackSvgBoxes`).
 */
export function unpackTargetIds(fc: FcCtx, boxes: Box[]): string[] {
  const { cfg } = fc;
  if (!cfg.imageField || !cfg.groupField) return [];
  return fc.select.selIndices(boxes)
    .filter((i) => !fc.select.groupOf(boxes[i]) && isSvgImageRef(boxes[i]?.[cfg.imageField]))
    .map((i) => fc.select.idOf(boxes[i], i));
}
/** Is Ungroup live for this selection - a group to dissolve, or a vector to take apart? */
export const canUngroup = (fc: FcCtx): boolean => selHasGroup(fc) || unpackTargetIds(fc, fc.select.getBoxes()).length > 0;
/**
 * Take the SVG boxes `ids` apart into their layers - ONE commit for all of them, so one
 * ⌘Z puts every picture back. Every read and every asset store happens BEFORE the
 * commit (runLift's rule): a failure part-way leaves the board exactly as it was.
 * The model is re-read after the awaits and each source found by ID, never by the
 * index the action started with.
 */
export async function unpackSvgBoxes(fc: FcCtx, ids: string[]): Promise<void> {
  const { cfg, cv, host } = fc;
  if (!cfg.imageField || !cfg.groupField) return;
  announce(t('Ungrouping…'));
  try {
    const [
      { fetchAnimSvg },
      { enumerateSvgLayers, svgRootViewBox },
      { storeUserUpload },
      { KF_Z_FIELD_CLAMP },
    ] = await Promise.all([
      import('../anim-svg-mount.ts'),
      import('../../../../../engine/src/svg-layers.ts'),
      import('../picker.ts'),
      import('../../../../../engine/src/keyframes.ts'),
    ]);
    interface Part {
      layers: SvgLayerPlan[];
      refs: InputValue[];
      viewBox: SvgSourceBox;
    }
    const parts = new Map<string, Part>();
    let single = 0;
    for (const id of ids) {
      const boxes = fc.select.getBoxes();
      const src = boxes[fc.select.indexOfId(boxes, id)];
      const ref = src?.[cfg.imageField] as { url?: unknown } | undefined;
      const url = typeof ref?.url === 'string' ? ref.url : '';
      if (!src || !url) continue;
      const markup = await fetchAnimSvg(url);
      if (fc.disposed) return;
      const place = {
        viewBox: svgRootViewBox(markup),
        fit: String(src[cfg.fitField] ?? 'contain'),
      };
      const cropToInk = liftCanCrop(src, cfg, place);
      const cropScale = liftCropScale(src, cfg, place) || undefined;
      // `heroDescent: false`: an Ungroup peels ONE level of the drawing's own structure,
      // the way every vector editor's does, so it is predictable and it repeats. The
      // hero heuristic belongs to the Lift dialog, where one big layer means a
      // flythrough over a picture; here it would be a second, unasked-for peel.
      const { layers, viewBox } = enumerateSvgLayers(markup, {
        heroDescent: false,
        cropToInk,
        cropScale,
      });
      if (layers.length < 2) {
        single++;
        continue;
      }
      const base = fc.dialogs.liftBaseName(ref);
      const refs: InputValue[] = [];
      for (let i = 0; i < layers.length; i++) {
        const file = new File([layers[i]!.markup], `${base}-part-${i + 1}.svg`, {
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
      parts.set(id, { layers, refs, viewBox });
    }
    if (!parts.size) {
      fc.stage.flash(
        single
          ? t('This artwork is a single shape, so there is nothing to ungroup.')
          : t('That artwork could not be read.')
      );
      return;
    }
    let scratch = fc.select.getBoxes();
    const newIds: string[] = [];
    for (const [id, part] of parts) {
      const at = fc.select.indexOfId(scratch, id);
      if (at < 0) continue; // gone while it was being read - the others still apply
      const source = scratch[at]!;
      // Ids are minted against a GROWING array, so no two rows can collide.
      const rowIds: string[] = [];
      let minted = scratch;
      for (let i = 0; i < part.layers.length; i++) {
        const rid = fc.select.freshId(minted);
        rowIds.push(rid);
        minted = [...minted, { [cfg.idField]: rid } as Box];
      }
      const rows = liftRows(
        source,
        part.layers.map((L, i) => ({
          src: String((part.refs[i] as { url?: unknown } | null)?.url ?? ''),
          id: rowIds[i]!,
          crop: L.viewBox ?? null,
          bbox: L.bbox ?? null,
        })),
        { ...cfg, zField: cv.zField || '' },
        {
          zClamp: KF_Z_FIELD_CLAMP,
          group: freshGroupId(fc, scratch),
          viewBox: part.viewBox,
          fit: String(source[cfg.fitField] ?? 'contain'),
          flat: true,
        }
        // The whole ref, not the URL string - the same reason runLift gives: the engine
        // resolves a block's asset sub-field by `.id` and the hook reads `image.url`.
      ).map((row, i) => ({ ...row, [cfg.imageField]: part.refs[i] }));
      scratch = applyLift(scratch, at, rows);
      newIds.push(...rowIds);
    }
    if (!newIds.length) {
      fc.stage.flash(t('That artwork is no longer on the canvas, so nothing was changed.'));
      return;
    }
    fc.selection = new Set(newIds);
    fc.select.commit(scratch);
    fc.stage.flash(t('Ungrouped into {n} parts.', { n: newIds.length }));
  } catch (e) {
    console.error(e);
    if (!fc.disposed) fc.stage.flash(t('Those parts could not be separated, so nothing was changed.'));
  }
}
// Clip: the LOWEST selected box (bottom of the stack) is the mask; every higher
// selected box is clipped to its shape. They're grouped so the mask + content
// travel together (Figma-style mask group).
export function clipSelection(fc: FcCtx): void {
  const { cfg } = fc;
  if (!cfg.clipField) return;
  const boxes = fc.select.getBoxes();
  const idx = fc.select.selIndices(boxes)
    .slice()
    .sort((a, b) => a - b);
  if (idx.length < 2) return;
  const maskId = fc.select.idOf(boxes[idx[0]!], idx[0]!);
  const clipSet = new Set(idx.slice(1));
  const allSet = new Set(idx);
  const g = cfg.groupField ? freshGroupId(fc, boxes) : '';
  fc.select.commit(
    boxes.map((b, i) => {
      if (!allSet.has(i)) return b;
      const nb = { ...b };
      if (clipSet.has(i)) nb[cfg.clipField] = maskId;
      if (cfg.groupField) nb[cfg.groupField] = g;
      return nb;
    })
  );
}
export function releaseClip(fc: FcCtx): void {
  const { cfg } = fc;
  if (!cfg.clipField) return;
  const boxes = fc.select.getBoxes();
  const set = new Set(fc.select.selIndices(boxes));
  if (!boxes.some((b, i) => set.has(i) && b[cfg.clipField])) return;
  fc.select.commit(
    boxes.map((b, i) => (set.has(i) && b[cfg.clipField] ? { ...b, [cfg.clipField]: '' } : b))
  );
}
export const selHasGroup = (fc: FcCtx) => {
  const bx = fc.select.getBoxes();
  return fc.select.selIndices(bx).some((i) => fc.select.groupOf(bx[i]));
};
export const selHasClip = (fc: FcCtx) => {
  const { cfg } = fc;
  const bx = fc.select.getBoxes();
  return cfg.clipField && fc.select.selIndices(bx).some((i) => bx[i]![cfg.clipField]);
};
// ── z-order / align / distribute ─────────────────────────────────────────────
export function applyZ(fc: FcCtx, op: string): void {
  const boxes = fc.select.getBoxes();
  const idx = fc.select.selIndices(boxes);
  if (!idx.length) return;
  fc.select.commit(reorderZ(boxes, idx, op as ZOp));
}
export function applyAlign(fc: FcCtx, edge: string): void {
  const { cfg } = fc;
  const boxes = fc.select.getBoxes();
  const idx = fc.select.selIndices(boxes);
  if (!idx.length) return;
  fc.select.commit(alignBoxes(boxes, idx, edge as AlignEdge, cfg, fc.helpers.canvasWH()));
}
export function applyDistribute(fc: FcCtx, axis: string): void {
  const { cfg } = fc;
  const boxes = fc.select.getBoxes();
  const idx = fc.select.selIndices(boxes);
  if (idx.length < 3) return;
  fc.select.commit(distributeBoxes(boxes, idx, axis as Axis, cfg));
}
/**
 * Mirror the selection horizontally ('h') or vertically ('v'). The flip is a per-box
 * boolean the tool's hooks.js folds into the box transform as a NEGATIVE SCALE about the
 * box centre (transform-origin 50% 50%) - so it mirrors the artwork itself, on the canvas
 * AND in every export (the vector walkers read that inline transform as a 2-D affine and
 * keep the mirror; see engine's isAxisAlignedMat), not just the on-canvas preview.
 *
 * TOGGLES each box's own flag, so the action is its own inverse and a mixed selection
 * (some already flipped) un-flips those and flips the rest. Mirror-IN-PLACE per box: a
 * multi-box flip mirrors every member about ITS OWN centre, not the selection's combined
 * bounds - each box keeps its position and turns over in place. Group-bounds
 * mirroring would have to move boxes (reflect each centre across the selection midline)
 * and re-bucket frames; per-box mirror needs neither and never surprises the user with a
 * box that jumped. One commit for the whole selection - one undo step. No-op on a tool
 * that declares no flip fields (`canFlip`).
 */
export function applyFlip(fc: FcCtx, axis: 'h' | 'v'): void {
  const { FLIP_H_FIELD, FLIP_V_FIELD, canFlip } = fc;
  if (!canFlip) return;
  const field = axis === 'h' ? FLIP_H_FIELD : FLIP_V_FIELD;
  const boxes = fc.select.getBoxes();
  const sel = new Set(fc.select.selIndices(boxes));
  if (!sel.size) return;
  fc.select.commit(boxes.map((b, i) => (sel.has(i) ? { ...b, [field]: !boolOf(b[field], false) } : b)));
}
export function objectsOps(fc: FcCtx) {
  return {
    pickImage: bindOp(fc, pickImage),
    removeBackgroundOnSelection: bindOp(fc, removeBackgroundOnSelection),
    isOutlinableTextBox: bindOp(fc, isOutlinableTextBox),
    paintsBesidesText: bindOp(fc, paintsBesidesText),
    outlineTextOnSelection: bindOp(fc, outlineTextOnSelection),
    runOutlineTextOnSelection: bindOp(fc, runOutlineTextOnSelection),
    freshGroupId: bindOp(fc, freshGroupId),
    groupSelection: bindOp(fc, groupSelection),
    ungroupSelection: bindOp(fc, ungroupSelection),
    unpackTargetIds: bindOp(fc, unpackTargetIds),
    canUngroup: bindOp(fc, canUngroup),
    unpackSvgBoxes: bindOp(fc, unpackSvgBoxes),
    clipSelection: bindOp(fc, clipSelection),
    releaseClip: bindOp(fc, releaseClip),
    selHasGroup: bindOp(fc, selHasGroup),
    selHasClip: bindOp(fc, selHasClip),
    applyZ: bindOp(fc, applyZ),
    applyAlign: bindOp(fc, applyAlign),
    applyDistribute: bindOp(fc, applyDistribute),
    applyFlip: bindOp(fc, applyFlip),
  };
}
