// SPDX-License-Identifier: MPL-2.0
/** Place catalog sources through normal canvas commits and timeline intake. */
import { takeAssetOpening } from '../../lib/asset-open-handoff.ts';
import { seedBox } from '../free-canvas-math.ts';
import { announce } from '../../a11y.ts';
import { t } from '../../i18n.ts';
import { bindOp, type FcCtx } from './context.ts';

export async function intake(fc: FcCtx): Promise<void> {
  const loc = globalThis.location;
  if (!loc) return; // no address to read a slot from (a headless harness)
  const slot = new URLSearchParams(loc.hash.split('?')[1] ?? loc.search).get('slot') ?? '';
  const opening = takeAssetOpening(fc.info?.id ?? '', slot, true);
  if (!opening || fc.disposed) return;
  try {
    if (opening.kind === 'timeline') {
      for (const ref of opening.refs) if (!fc.timeline.addMediaRef(ref, 0)) throw new Error(t('This editor cannot place that media.'));
      await fc.timeline.ensureTimeline(true);
      if (fc.disposed) return;
      const ids = fc.select.getBoxes().map((box, index) => fc.select.idOf(box, index));
      fc.timelinePanel?.selectAndReveal(ids);
      fc.selection = new Set(ids);
      fc.chromeSync.renderChrome();
      fc.select.notifySelection();
      fc.info?.setFilename?.(String(opening.refs[0]?.meta?.name ?? opening.refs[0]?.id.split('/').pop() ?? 'Audio'));
      return;
    }
    const kind = fc.addKinds.find(kind => kind.id === 'image');
    if (!kind || !fc.cfg.imageField) throw new Error(t('This editor cannot place images.'));
    const boxes = [...fc.select.getBoxes()];
    const size = fc.helpers.canvasWH();
    for (const [index, ref] of opening.refs.entries()) {
      const scale = Math.min(1, size.w / (ref.width || size.w), size.h / (ref.height || size.h));
      const w = (ref.width || size.w) * scale, h = (ref.height || size.h) * scale;
      const box = seedBox(fc.cfg, {}, kind.seed, { x: (size.w - w) / 2 + index * 12, y: (size.h - h) / 2 + index * 12, w, h, rot: 0 }, fc.select.freshId(boxes));
      box[fc.cfg.imageField] = ref;
      if (fc.cfg.fitField) box[fc.cfg.fitField] = 'contain';
      boxes.push(box);
    }
    fc.select.commit(boxes);
    fc.info?.setFilename?.(String(opening.refs[0]?.meta?.name ?? opening.refs[0]?.id.split('/').pop() ?? 'Image'));
  } catch (error) { announce(error instanceof Error ? error.message : t('Could not open this asset.'), { assertive: true }); }
}
export const catalogIntakeOps = (fc: FcCtx) => ({ intake: bindOp(fc, intake) });
