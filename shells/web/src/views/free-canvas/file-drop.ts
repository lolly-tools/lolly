// SPDX-License-Identifier: MPL-2.0
/** Files dropped on the editor become ordinary saved canvas objects. */
import type { AssetRef } from '@lolly-tools/core/host-v1';
import { announce } from '../../a11y.ts';
import { t } from '../../i18n.ts';
import { boxRect, seedBox } from '../free-canvas-math.ts';
import type { PickerHost } from '../picker.ts';
import { bindOp, type FcCtx } from './context.ts';

type Point = { x: number; y: number };
type StoreFile = (file: File) => Promise<AssetRef | null>;
const MEDIA_FILE =
  /\.(png|apng|jpe?g|webp|gif|avif|jxl|heic|heif|tiff?|svg|svgz|bmp|ico|cur|psd|psb|xcf|mp4|m4v|webm|mov|mkv|mp3|wav|ogg|oga|opus|m4a|aac|flac|mid|midi|mod|xm|it|s3m|stm|mtm|json|lottie)$/i;

/** One drop is one commit, even when it contains several kinds of media. */
export function placeRefs(fc: FcCtx, refs: AssetRef[], centre: Point, at: number): void {
  if (fc.disposed || fc.opts.canEdit?.() === false || !fc.cfg.imageField) return;
  const { cfg, timeCfg } = fc;
  const boxes = [...fc.select.getBoxes()];
  const touched = new Set<number>();
  const ids: string[] = [];
  const size = fc.helpers.canvasWH();
  for (const ref of refs) {
    const media = ['video', 'audio', 'lottie'].includes(ref.type);
    const kindId = media ? ref.type : 'image';
    if (!media && !['raster', 'vector'].includes(ref.type)) continue;
    const kind = fc.addKinds.find((item) => item.id === kindId);
    if (!kind || (media && !timeCfg)) continue;
    const sourceW = ref.type === 'audio' ? 320 : ref.width || size.w / 2;
    const sourceH = ref.type === 'audio' ? 80 : ref.height || size.h / 2;
    const scale = Math.min(1, size.w / sourceW, size.h / sourceH);
    const w = sourceW * scale,
      h = sourceH * scale;
    const id = fc.select.freshId(boxes);
    const offset = ids.length * 12;
    let box = seedBox(
      cfg,
      {},
      kind.seed,
      { x: centre.x - w / 2 + offset, y: centre.y - h / 2 + offset, w, h, rot: 0 },
      id
    );
    box[cfg.imageField] = ref;
    if (cfg.fitField) box[cfg.fitField] = 'contain';
    if (fc.cv.labelField)
      box[fc.cv.labelField] = String(ref.meta?.name ?? ref.id.split('/').pop() ?? '');
    if (media && timeCfg) {
      const ms = Number(ref.meta?.durationMs);
      box[timeCfg.startField] = at;
      box[timeCfg.durField] = Number.isFinite(ms) && ms > 0 ? ms / 1000 : 3;
      box[timeCfg.clipInField] = 0;
      box[timeCfg.speedField] = 1;
      box[timeCfg.laneField] = '';
      if (ref.type === 'lottie') box.animationId = String(ref.meta?.lottieAnimationId ?? '');
    }
    box = fc.document.clampToWorkArea(box);
    touched.add(boxes.length);
    boxes.push(box);
    ids.push(id);
  }
  if (!ids.length) return;
  fc.modes.toPointer();
  fc.selection = new Set(ids);
  fc.select.commit(fc.select.assignFrames(boxes, touched));
  fc.chromeSync.renderChrome();
  fc.select.notifySelection();
  if (refs.some((ref) => ['audio', 'video', 'lottie'].includes(ref.type)))
    fc.timeline.openTimeline();
  announce(
    ids.length === 1 ? t('Imported 1 object.') : t('Imported {n} objects.', { n: ids.length })
  );
}

export function wire(fc: FcCtx, store?: StoreFile): () => void {
  if (!fc.cfg.imageField || !fc.addKinds.some((kind) => kind.id === 'image')) return () => {};
  const { viewEl, canvasEl } = fc;
  let disposed = false;
  let depth = 0;
  let chain = Promise.resolve();
  const editable = () => !disposed && !fc.disposed && fc.opts.canEdit?.() !== false;
  const hasFiles = (event: DragEvent) =>
    Array.from(event.dataTransfer?.types ?? []).includes('Files');
  const highlight = (on: boolean) => canvasEl.classList.toggle('is-file-dragover', on);
  const enter = (event: DragEvent) => {
    if (event.defaultPrevented || !editable() || !hasFiles(event)) return;
    event.preventDefault();
    depth++;
    highlight(true);
  };
  const over = (event: DragEvent) => {
    if (event.defaultPrevented || !editable() || !hasFiles(event)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  };
  const leave = () => {
    depth = Math.max(0, depth - 1);
    if (!depth) highlight(false);
  };
  const reset = () => {
    depth = 0;
    highlight(false);
  };
  const drop = (event: DragEvent) => {
    if (event.defaultPrevented || !editable() || !hasFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    // Copy now: browsers protect the transfer's FileList after the event returns.
    const files = Array.from(event.dataTransfer?.files ?? []);
    const rect = fc.stage.metrics().sr;
    const overControls = (event.target as Element | null)?.closest?.(
      'button,input,select,textarea,[contenteditable],.design-topbar,.fc-nav,.fc-insp,.tl-panel,.fc-toolbar,.fc-ctxbar'
    );
    const onStage =
      !overControls &&
      event.target instanceof Node &&
      fc.stageEl.contains(event.target) &&
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;
    let centre = fc.stage.clientToNative(
      onStage ? event.clientX : rect.left + rect.width / 2,
      onStage ? event.clientY : rect.top + rect.height / 2
    );
    if (!onStage) {
      const boxes = fc.select.getBoxes();
      const active = fc.document.activeArtboardId();
      const frame = active && boxes.find((box, index) => fc.select.idOf(box, index) === active);
      if (frame) {
        const r = boxRect(frame, fc.cfg);
        centre = { x: r.x + r.w / 2, y: r.y + r.h / 2 };
      }
    }
    const at = fc.timelinePanel?.time() ?? 0;
    chain = chain
      .then(async () => {
        const refs: AssetRef[] = [];
        for (const file of files) {
          if (!editable()) return;
          try {
            if (!/^(image|video|audio)\//i.test(file.type) && !MEDIA_FILE.test(file.name))
              throw new Error(t('This editor cannot place that media.'));
            const ref = store
              ? await store(file)
              : await (await import('../picker.ts')).storeUserUpload(
                  fc.host as unknown as PickerHost,
                  file,
                  { batch: true }
                );
            if (!editable()) return;
            if (ref && ['raster', 'vector', 'video', 'audio', 'lottie'].includes(ref.type))
              refs.push(ref);
            else if (ref) throw new Error(t('This editor cannot place that media.'));
          } catch (error) {
            if (editable())
              announce(
                `${file.name}: ${error instanceof Error ? error.message : t('Upload failed.')}`,
                { assertive: true }
              );
          }
        }
        if (editable()) placeRefs(fc, refs, centre, at);
      })
      .catch((error: unknown) => {
        if (editable())
          announce(error instanceof Error ? error.message : t('Upload failed.'), {
            assertive: true,
          });
      });
  };
  viewEl.addEventListener('dragenter', enter);
  viewEl.addEventListener('dragover', over);
  viewEl.addEventListener('dragleave', leave);
  viewEl.addEventListener('drop', reset, true);
  viewEl.addEventListener('dragend', reset);
  viewEl.addEventListener('drop', drop);
  return () => {
    disposed = true;
    highlight(false);
    viewEl.removeEventListener('dragenter', enter);
    viewEl.removeEventListener('dragover', over);
    viewEl.removeEventListener('dragleave', leave);
    viewEl.removeEventListener('drop', reset, true);
    viewEl.removeEventListener('dragend', reset);
    viewEl.removeEventListener('drop', drop);
  };
}

export const fileDropOps = (fc: FcCtx) => ({ wire: bindOp(fc, wire) });
