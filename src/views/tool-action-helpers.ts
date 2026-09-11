// SPDX-License-Identifier: MPL-2.0

import type { ToolManifest } from '../../../../engine/src/loader.ts';
import type { Runtime } from '../../../../engine/src/runtime.ts';
import { showScrubReadout, hideScrubReadout } from '../components/scrub-readout.ts';
import { playScrubTick } from '../lib/sfx.ts';
import { cssEscape } from '../lib/util/escape.ts';

/** Strip-scale → export → reapply wrapper shared by the tool mount and action helpers. */
export type ExportUnscaled = <T>(
  fn: (report?: (done: number, total: number) => void) => Promise<T>,
  opts?: { shutter?: boolean; detail?: string; onCancel?: () => void }
) => Promise<T>;

// Export-target opt-in (plan: sandbox render). A tool whose exported output is
// NOT its whole canvas - e.g. a code sandbox whose rendered preview is transplanted
// into a same-origin mirror node - marks that node with `data-export-root`; the
// walker then rasterises the mirror instead of the IDE chrome. Inert by construction
// for every other tool: no marker → querySelector null → the canvas itself is used.
export const exportTargetNode = (c: HTMLElement | null): HTMLElement | null =>
  c?.querySelector<HTMLElement>('[data-export-root]') ?? c;

// Flat single-image paths (copy, send-to, thumbnails): with artboards in the doc,
// capture the ACTIVE artboard's page rather than the whole canvas - the canvas rect
// is just the pasteboard there, and would leak scratch boxes and sibling boards into
// the shot (plans/142 WP-C). free-canvas stamps the active artboard's id on the
// canvas (`data-fc-active-frame`). Multi-page paths (PDF / PPTX / the still
// fan-out) keep exportTargetNode: their walkers need every [data-pdf-page].
export const flatExportNode = (c: HTMLElement | null): HTMLElement | null => {
  const root = c?.querySelector<HTMLElement>('[data-export-root]');
  if (root) return root;
  const fid = c?.dataset.fcActiveFrame;
  return (
    (fid ? c!.querySelector<HTMLElement>(`[data-pdf-page][data-frame-id="${cssEscape(fid)}"]`) : null) ??
    c
  );
};

// Adds scroll-to-change and click-drag-to-scrub to a number input.
// Dragging uses Pointer Lock once the threshold is crossed so the cursor
// wraps across screen edges and movement is truly unbounded.
// onChange fires after every value change from either interaction.
// opts.format(value) returns the label shown in the floating readout that
// appears while dragging (defaults to the bare value) - see scrub-readout.js.
// opts.step() is one tick's worth in the field's current unit (default 1) - read per
// event, since the export bar's unit select can change under a live field; the value
// is kept to that step's decimals, so a mm field scrubs by 0.1 and an in field by 0.01.
export function addScrubBehavior(
  inputEl: HTMLInputElement,
  onChange: () => void,
  opts: { format?: (value: string) => string; step?: () => number } = {}
): void {
  const format = opts.format ?? ((v: string) => String(v));
  const stepNow = (): number => {
    const s = opts.step?.();
    return s != null && s > 0 && Number.isFinite(s) ? s : 1;
  };
  const read = (v: string): number => parseFloat(v) || 0;
  const getMin = () => parseFloat(inputEl.min) || 1;
  const getMax = () => parseFloat(inputEl.max) || 99999;
  /** Snapped to the step and written with the step's decimals, so 0.1 + 0.2 is '0.3'. */
  const fmt = (v: number): string => {
    const s = stepNow();
    const dec = s >= 1 ? 0 : Math.min(6, (String(s).split('.')[1] ?? '').length);
    const out = (Math.round(v / s) * s).toFixed(dec);
    return dec ? out.replace(/\.?0+$/, '') : out;
  };
  // Not the numeric engine clamp: the bounds are read live off the field on every call.
  const clamp = (v: number): number => Math.min(getMax(), Math.max(getMin(), v));

  inputEl.addEventListener(
    'wheel',
    (e) => {
      // Only hijack the wheel to scrub the value when the field is focused; otherwise
      // let the event bubble so the surrounding panel scrolls past it normally.
      if (document.activeElement !== inputEl) return;
      e.preventDefault();
      const step = (e.shiftKey ? 10 : 1) * stepNow();
      inputEl.value = fmt(clamp(read(inputEl.value) + (e.deltaY < 0 ? step : -step)));
      onChange();
    },
    { passive: false }
  );

  let dragging = false;
  let wasDragging = false;
  let activeId: number | null = null; // the one pointer currently driving a drag

  inputEl.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    // One scrub at a time: a second finger landing on the field mustn't reset the
    // baseline of the drag already in progress (it drove jumpy values on touch).
    if (activeId !== null) return;
    activeId = e.pointerId;
    const startX = e.clientX;
    const startVal = read(inputEl.value);
    // Touch can't lock the pointer, so the value stays hidden under the finger -
    // track the readout above the touch point; otherwise anchor it to the field.
    const isTouch = e.pointerType === 'touch';
    let accumulated = 0; // total delta once pointer lock is active
    let lastScrubVal = String(startVal); // last value we ticked on, so we tick per step
    dragging = false;
    inputEl.setPointerCapture(e.pointerId);

    // Float the live value clear of the cursor/finger while dragging.
    function showReadout(ev: PointerEvent): void {
      const text = format(inputEl.value);
      if (isTouch) showScrubReadout({ text, finger: { x: ev.clientX, y: ev.clientY } });
      else showScrubReadout({ text, anchorEl: inputEl });
    }

    function onMove(e: PointerEvent): void {
      if (e.pointerId !== activeId) return; // ignore any other pointer
      if (!dragging) {
        if (Math.abs(e.clientX - startX) < 4) return;
        dragging = true;
        document.body.style.cursor = 'ew-resize';
        // Request pointer lock so the cursor wraps at screen edges.
        // unadjustedMovement removes OS pointer acceleration for 1:1 scrubbing.
        // Skipped for touch (unsupported) - the clientX fallback drives it there.
        if (!isTouch) {
          const req = inputEl.requestPointerLock?.({ unadjustedMovement: true });
          if (req instanceof Promise) {
            req.catch(() => inputEl.requestPointerLock?.());
          }
        }
      }

      const step = (e.shiftKey ? 10 : 1) * stepNow();
      if (document.pointerLockElement === inputEl) {
        // Locked: accumulate raw movementX - no screen-edge limit.
        accumulated += e.movementX * step;
        inputEl.value = fmt(clamp(startVal + accumulated));
      } else {
        // Lock not yet active (or unavailable): fall back to clientX delta.
        const dx = e.clientX - startX;
        inputEl.value = fmt(clamp(startVal + dx * step));
        // Keep accumulated in sync so the switch to locked mode is smooth.
        accumulated = read(inputEl.value) - startVal;
      }
      if (inputEl.value !== lastScrubVal) {
        lastScrubVal = inputEl.value;
        playScrubTick();
      } // detent per step
      onChange();
      showReadout(e);
    }

    function onUp(e?: PointerEvent): void {
      // pointerup/cancel carry an event (ignore other pointers); onLockChange
      // calls onUp() with no argument to force a release.
      if (e && e.pointerId !== activeId) return;
      inputEl.removeEventListener('pointermove', onMove);
      inputEl.removeEventListener('pointerup', onUp);
      inputEl.removeEventListener('pointercancel', onUp);
      document.removeEventListener('pointerlockchange', onLockChange);
      if (document.pointerLockElement === inputEl) document.exitPointerLock();
      document.body.style.cursor = '';
      hideScrubReadout();
      if (dragging) {
        wasDragging = true;
        setTimeout(() => {
          wasDragging = false;
        }, 50);
      }
      dragging = false;
      activeId = null;
    }

    function onLockChange(): void {
      // Escape key or other external release - stop dragging cleanly.
      if (document.pointerLockElement !== inputEl) onUp();
    }

    inputEl.addEventListener('pointermove', onMove);
    inputEl.addEventListener('pointerup', onUp);
    inputEl.addEventListener('pointercancel', onUp);
    document.addEventListener('pointerlockchange', onLockChange);
  });

  // Suppress the click-to-focus that follows a drag so the cursor doesn't jump into text mode.
  inputEl.addEventListener('click', (e) => {
    if (wasDragging) {
      e.preventDefault();
      inputEl.blur();
    }
  });
}

// Cap on a vector thumbnail's raw SVG size. Dense vector output (e.g. a halftone
// with thousands of dots) can serialise to megabytes; above this we fall back to
// the raster path so a single thumbnail never bloats storage unbounded.
const SVG_THUMB_MAX_BYTES = 1_500_000;

// Upper bound on how long a save waits for its (best-effort) thumbnail render. Generous -
// a normal capture is well under a second - so it only ever fires on a render that has
// genuinely stalled, in which case the save proceeds thumbnail-less rather than hanging.
export const THUMB_CAPTURE_TIMEOUT_MS = 8000;

export async function captureThumbnail(
  manifest: ToolManifest,
  canvasEl: HTMLElement | null,
  runtime: Runtime,
  exportUnscaled: ExportUnscaled,
  format = '',
  shutter = true
): Promise<string | null> {
  // Capture at the canvas's ACTUAL laid-out aspect, not the manifest default. A reflow tool
  // (e.g. color-block) sizes its canvas to the ?width/height it was loaded with, so a wide /
  // tall / banner look must be captured at THAT aspect - exporting it into the default square
  // scales it non-uniformly and it comes out stretched. offsetWidth/Height are transform-
  // independent (unaffected by the editor's zoom), the same basis the paged-page capture and
  // the offscreen renderVariantAt dims use; the manifest is the fallback when the node has no
  // box yet. For a default-size session this equals the manifest, so nothing else changes.
  // A paged tool's canvas is EVERY page stacked (battlecards' four cards make a
  // 1:3 strip) - as a tile that squashes into an unrecognisable ribbon. The
  // thumbnail should be what one card/page looks like, so capture the FIRST
  // [data-pdf-page] box at its own laid-out size instead of the whole document.
  const firstPage =
    manifest.render.paged === true
      ? (canvasEl?.querySelector<HTMLElement>('[data-pdf-page]') ?? null)
      : null;
  if (firstPage) canvasEl = firstPage;
  else {
    // A framed doc's thumbnail is its ACTIVE artboard for the same reason - the whole
    // canvas is pasteboard + scattered boards, squashed and half-empty as a tile
    // (plans/142 WP-C). No frames, no export-root → flatExportNode returns canvasEl.
    const flat = flatExportNode(canvasEl);
    if (flat && flat !== canvasEl) canvasEl = flat;
  }

  const nw = canvasEl?.offsetWidth || manifest.render.width || 600;
  const nh = canvasEl?.offsetHeight || manifest.render.height || 600;

  // Vector thumbnail: when the effective export format is SVG (the user picked it,
  // or it's the tool's default), capture an SVG data-URL instead of a PNG. SVG is
  // resolution-independent - it renders in the gallery's <img> and stays crisp at
  // any card size. renderSvg() inlines blob-URLs and vector tools outline their
  // text, so the SVG is self-contained and safe in an <img> sandbox. Falls through
  // to the raster path on failure or if the SVG is pathologically large.
  //
  // A gallery tile is just a screenshot, and a *vector* screenshot stays crisp at any
  // size - so preview generation (scripts/build-previews.ts) sets __lollyForceVectorThumb
  // to take this branch for ANY tool, even one that doesn't offer SVG *export*. The
  // walker (renderSvgFromHtml) vectorises any HTML/CSS canvas; a hiccup or an oversized
  // (dense) result falls through to the pixel-faithful raster path below. Real user
  // saves never set the flag, so their thumbnail still tracks the chosen export format.
  const forceVector = !!(globalThis as { __lollyForceVectorThumb?: boolean })
    .__lollyForceVectorThumb;
  if (format === 'svg' || forceVector) {
    try {
      const blob = await exportUnscaled(
        () =>
          runtime.export(exportTargetNode(canvasEl), 'svg', {
            width: nw,
            height: nh,
            embedMeta: false,
            thumbnail: true,
          }),
        { shutter }
      );
      const svg = await blob.text();
      // The preview generator downsamples embedded map/photo rasters and applies
      // its own size budget next. Preserve the vector text until that pass; a
      // large retina canvas alone must not flatten the entire gallery card.
      if (svg && (forceVector || svg.length <= SVG_THUMB_MAX_BYTES)) {
        return `data:image/svg+xml,${encodeURIComponent(svg)}`;
      }
    } catch {
      /* fall through to the raster path */
    }
  }

  // Raster thumbnail (default): a PNG sized for the gallery's preview-forward hero
  // (shown up to a full card column wide, at 2× for retina). Storage isn't a
  // concern for the single most-recent session per tool.
  try {
    const maxW = 720;
    const maxH = 560;
    const scale = Math.min(maxW / nw, maxH / nh);
    const tw = Math.max(1, Math.round(nw * scale));
    const th = Math.max(1, Math.round(nh * scale));
    // Mask the brief full-res resize with the shutter - the thumbnail is a fast
    // single PNG frame, so the shutter fully covers it for every tool.
    const blob = await exportUnscaled(
      // thumbnail:true lets expensive hooks (e.g. url-shot's capture) reuse the
      // last render on the canvas instead of re-running a slow capture.
      () =>
        runtime.export(exportTargetNode(canvasEl), 'png', {
          width: tw,
          height: th,
          embedMeta: false,
          thumbnail: true,
        }),
      { shutter }
    );
    return await new Promise<string | null>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
