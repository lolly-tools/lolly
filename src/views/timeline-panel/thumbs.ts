// SPDX-License-Identifier: MPL-2.0
/**
 * timeline-panel: clip thumbnail passes.
 *
 * Every function takes the shared `tp: TpCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `tp.<module>.<fn>`. Extracted verbatim
 * from initTimelinePanel() by scripts/split-closure.ts.
 */
import { filmstrip, nodeKey, nodeRasterFailed, nodeRasterPending, nodeStill, onIdle, peaks, peekNodeRaster, stillFrames, svgMarkup, withBorrowedVisibility } from '../../lib/clip-thumbs.ts';
import { escXml, n3, parseSvgRoot, rectBody, stillTilePx, svgDoc, tileBody, waveformPathD } from '../../lib/vector-paint.ts';
import type { VectorTwin, VectorTwinCanvas } from '../../lib/vector-paint.ts';
import { boxTiming, kfBoxTrack } from '../timeline-math.ts';
import type { Box } from '../timeline-math.ts';
import { clipGainValueAt } from '../../bridge/audio-envelope.ts';
import type { VolumeKey } from '../../bridge/audio-envelope.ts';
import { clamp, finite } from '../timeline-config.ts';
import { MAX_NODE_RASTERS_PER_PASS, MAX_THUMB_PASSES, appearanceSig, canRasterBox, frameCountFor, isPaintedColor, thumbMode } from './shared.ts';
import type { ThumbJob } from './shared.ts';
import { bindOp, type TpCtx } from './context.ts';

export function scheduleThumbs(tp: TpCtx): void {
  tp.cancelIdle?.();
  tp.cancelIdle = null;
  abortThumbs(tp);
  if (!tp.open || tp.disposed) return;
  const ac = new AbortController();
  tp.thumbAbort = ac;
  queueThumbPass(tp, ac, 0);
}
/**
 * One idle pass, and - when it left work behind - the next.
 *
 * The continuation reuses the SAME AbortController rather than going back through
 * `scheduleThumbs`, which would abort the shots this pass has just started. Every
 * external abort still kills the chain dead: the queued callback checks the signal,
 * and `scheduleThumbs`/`destroy` cancel the pending idle handle outright.
 */
export function queueThumbPass(tp: TpCtx, ac: AbortController, pass: number): void {
  const { bars, cfg, getBoxes } = tp;
  tp.cancelIdle = onIdle(() => {
    tp.cancelIdle = null;
    if (ac.signal.aborted || tp.disposed) return;
    // READ every bar first, THEN paint - one style/layout pass for the whole panel.
    // Interleaving clientWidth/getComputedStyle reads with canvas size writes forces
    // a synchronous layout PER BAR, which is what this two-phase shape exists to stop.
    // getComputedStyle joined the read phase when the card fallback arrived: it is the
    // most expensive read here, so it must not be the one call left inside the paint.
    const cs = typeof getComputedStyle === 'function' ? getComputedStyle : null;
    const dpr = Math.min(2, Math.max(1, Number(globalThis.devicePixelRatio) || 1));
    // The model rows, indexed ONCE. Also the two environment terms a node raster's
    // signature needs beyond the row: the theme stamp (a theme flip repaints every
    // box without touching a single field) is one attribute read for the whole pass,
    // and the box's own computed background is already being read per bar below.
    const rowsById = new Map<string, Box>();
    for (const b of getBoxes()) {
      const rid = b?.[cfg.idField];
      if (rid != null && rid !== '') rowsById.set(String(rid), b);
    }
    const themeStamp = document.documentElement?.getAttribute('data-theme') ?? '';

    const jobs: ThumbJob[] = [];
    for (const [id, el] of bars) {
      const box = tp.helpers.boxEl(id);
      const media = tp.helpers.mediaOf(id);
      const fill = (box && cs ? cs(box).backgroundColor : '') || '';
      // Only a box with NO media is a candidate: an <img>/<video>/Lottie/audio box
      // has a real picture to decode, which is both cheaper and more faithful than
      // a photograph of the tag holding it. Skipping the predicate here also keeps
      // its querySelectorAll off every media bar.
      const canRaster = !media.kind && canRasterBox(box, fill);
      const row = rowsById.get(id) ?? null;
      jobs.push({
        id,
        el,
        w: el.clientWidth,
        h: el.clientHeight,
        dpr,
        media,
        ink: (cs ? cs(el).color : '') || '#888',
        fill,
        box,
        row,
        sig: canRaster
          ? `${appearanceSig(row ?? undefined, cfg)}\u0001${fill}\u0001${themeStamp}`
          : '',
        canRaster,
        allowRaster: false,
      });
    }

    // The hard bound. Only work that would START a shot spends the budget, in bar
    // order (document order, i.e. left to right); everything past it keeps its fill
    // underlay and is retried on the next pass rather than queueing a seventh
    // uncancellable shot behind six others. Three kinds of bar are free:
    //
    //   • a cache HIT paints synchronously out of the LRU and costs nothing;
    //   • a bar already IN FLIGHT joins the running shot (`share()` dedups it) - this
    //     is what makes the retry chain converge, because the shots are serialised and
    //     a continuation pass fires long before its predecessor's six have arrived;
    //   • a bar whose shot already FAILED is retired, not retried forever.
    //
    // The `w > 8` term mirrors paintThumbs' own guard: a sliver bar paints nothing at
    // all, so granting it a shot would spend the pass's budget on an invisible bar.
    let budget = MAX_NODE_RASTERS_PER_PASS;
    let deferred = 0;
    for (const job of jobs) {
      if (!job.sig || !job.box || !(job.h > 8) || !(job.w > 8)) continue;
      const key = nodeKey(job.sig, Math.round(job.h * dpr));
      if (nodeRasterFailed(key)) continue;
      if (peekNodeRaster(key) || nodeRasterPending(key)) {
        job.allowRaster = true;
        continue;
      }
      if (budget > 0) {
        budget--;
        job.allowRaster = true;
      } else deferred++;
    }

    for (const job of jobs) paintThumbs(tp, job, ac.signal);

    // A Lottie whose player has not mounted its <svg> yet is the other kind of
    // unfinished work: `captureStill` would fall back to loading the .json as an
    // <img>, which yields nothing, and no gesture is coming to re-trigger a pass.
    let pending = deferred;
    for (const job of jobs) if (job.media.kind === 'lottie' && !job.media.el) pending++;
    if (pending > 0 && pass + 1 < MAX_THUMB_PASSES) queueThumbPass(tp, ac, pass + 1);
  }, 400);
}
export function abortThumbs(tp: TpCtx): void {
  tp.thumbAbort?.abort();
  tp.thumbAbort = null;
}
export function paintThumbs(tp: TpCtx, job: ThumbJob, signal: AbortSignal): void {
  const { cfg, getBoxes } = tp;
  const { el, w, h, dpr, media } = job;
  const cv = el.querySelector<HTMLCanvasElement>('canvas.tl-clip-thumbs');
  if (!cv) return;

  /**
   * The bar's VECTOR TWIN: what this canvas would look like as SVG, for the export
   * walker (lib/vector-paint.ts, bridge/export.ts's `vectorTwinEl`). Presence-keyed
   * and invisible - no element, class, attribute or ThumbMode is added, so the bar's
   * four children and the live paint are byte-for-byte what they always were, and a
   * canvas that never gets a twin serialises exactly as it does today.
   *
   * It is CLEARED first and stamped only where a picture actually arrived, because a
   * stale twin is worse than none: it would describe pixels the bar is no longer
   * showing, and the export would disagree with the screen.
   */
  const setTwin = (f: VectorTwin | null): void => {
    const c = cv as VectorTwinCanvas;
    if (f) c.__lollyVectorTwin = f;
    else delete c.__lollyVectorTwin;
  };
  setTwin(null);

  if (!(w > 8) || !(h > 8)) return;
  const mode = thumbMode(media.kind, media.url, job.fill, job.canRaster);
  // Nothing to say about this box: leave the bar's kind tint alone rather than
  // sizing a canvas that would only be cleared.
  if (mode === 'none') return;

  // Sizing a canvas RESETS its bitmap - assigning `cv.width` clears it even when the
  // value is unchanged - so it is deferred behind whoever actually has something to
  // draw. That matters for exactly one bar: a transparent node bar (every text card,
  // every pen shape) whose raster is a cache MISS this pass. Sizing it eagerly wiped
  // the picture it was already showing and left it blank until the shot arrived, so
  // zooming a long timeline made thumbnails flicker out. Nothing else changes: every
  // other branch sizes immediately, exactly as before.
  let ctx2d: CanvasRenderingContext2D | null = null;
  let sizedOnce = false;
  const sized = (): CanvasRenderingContext2D | null => {
    if (sizedOnce) return ctx2d;
    sizedOnce = true;
    cv.width = Math.round(w * dpr);
    // Assigning width RESETS the bitmap (see above) - so whatever a twin was
    // describing has just been erased. Cleared here rather than only at entry
    // because `sized()` is deferred: the node branch's underlay can size the canvas
    // passes after the twin that is still hanging off it was stamped.
    setTwin(null);
    cv.height = Math.round(h * dpr);
    cv.style.width = `${w}px`;
    cv.style.height = `${h}px`;
    ctx2d = cv.getContext('2d');
    ctx2d?.scale(dpr, dpr);
    return ctx2d;
  };

  /** One bitmap, repeated across the bar at its own aspect ratio. */
  const drawTiled = (c: CanvasRenderingContext2D, bm: ImageBitmap): void => {
    c.clearRect(0, 0, w, h);
    const tile = bm.height > 0 ? Math.max(6, (bm.width / bm.height) * h) : h;
    for (let x = 0; x < w; x += tile) c.drawImage(bm, x, 0, tile, h);
    el.classList.add('has-thumbs');
  };

  /**
   * ONE bitmap, once, over the box's own flat fill - the STATIC bar (plans/104 section 8's
   * M2.5 revision, point 4).
   *
   * A filmstrip or a waveform repeats because it is a picture of time passing. A
   * photograph of a text card is not: it is identical in every tile, so a three-second
   * title card read as the same sentence printed twenty times at 6px - noise wearing
   * the costume of information. Drawn once at the leading edge, with the fill carrying
   * the rest of the bar, so the bar reads as one label over one colour.
   *
   * The fill is re-laid here rather than relied on from `paintFill`'s earlier pass:
   * `clearRect` is what makes the upgrade flicker-free (one synchronous overwrite),
   * and it takes the underlay with it.
   */
  const drawSingle = (c: CanvasRenderingContext2D, bm: ImageBitmap): void => {
    c.clearRect(0, 0, w, h);
    if (isPaintedColor(job.fill)) {
      c.fillStyle = job.fill;
      c.fillRect(0, 0, w, h);
    }
    const tile = stillTilePx(bm.height > 0 ? bm.width / bm.height : 0, h);
    // The FULL tile, cut by the canvas edge - never squeezed into `min(tile, w)`.
    // `drawTiled` has always drawn every tile at its own aspect and let the last one
    // overhang, and the vector twin below models exactly that (the walk is sized to
    // `tile` and clipped at `min(tile, w)`). Scaling here instead made a bar narrower
    // than one tile - a short clip, or any clip at low zoom - show a squeezed whole
    // thumbnail on screen against an undistorted left slice in the exported SVG, which
    // is the preview-authenticity rule broken in the one place it is cheapest to keep.
    c.drawImage(bm, 0, 0, tile, h);
    el.classList.add('has-thumbs');
  };

  // The box's own background, flat across the bar. It is honest - it IS the colour
  // that box paints on the frame - and it costs one fillRect, which is why it is
  // also the UNDERLAY a node raster upgrades from (below).
  const paintFill = (): void => {
    const ctx = sized();
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = job.fill;
    ctx.fillRect(0, 0, w, h);
    // One fillRect is one <rect>. The colour is captured by value: `job.fill` is a
    // resolved colour string, and the job object is rebuilt every pass.
    const fill = job.fill;
    setTwin(() => svgDoc(w, h, rectBody(fill, w, h)));
    el.classList.add('has-thumbs');
  };

  // No media, and nothing worth photographing (or a subtree too big to photograph
  // cheaply): the colour is all there is to say.
  if (mode === 'fill') {
    paintFill();
    return;
  }

  // A FRAME: a card, a text box, a pen shape, a composed group. No media element to
  // decode, so the picture is a photograph of the box itself.
  //
  // Three states, and none of them ever un-paints. The fill underlay goes down
  // SYNCHRONOUSLY, before any await, so there is no blank frame and - because the
  // upgrade overwrites the same canvas inside one synchronous `.then` body, and
  // `has-thumbs` is only ever added - no flash either. A declined, deferred, failed,
  // timed-out or aborted raster simply leaves the underlay standing.
  //
  // ONE bitmap, drawn ONCE: a node-mode box cannot animate by construction (any
  // <video>/<img>/Lottie/audio child would have classified it as media instead, and
  // this tool has no box nesting - an animated neighbour is a SIBLING with its own
  // bar), so N rasters would buy N identical pictures and N TILES of one raster buy
  // N identical thumbnails. This branch used to tile it like a still, which is what
  // section 8's M2.5 revision (point 4) calls clip-bar label noise: the picture repeated
  // dozens of times across a wide bar. It is drawn once now, at the leading edge,
  // over the flat fill. The trim window below is skipped for the same reason the
  // repeat is: there is no time axis here.
  if (mode === 'node') {
    if (isPaintedColor(job.fill)) paintFill();
    if (!job.allowRaster || !job.box || !job.sig) return;
    nodeStill(job.sig, job.box, { h: Math.round(h * dpr) }, signal)
      .then((frames) => {
        const bm = frames[0];
        if (signal.aborted || !bm) return;
        // OWNERSHIP CONTRACT (as below): cache-owned bitmap, drawn synchronously here
        // and never held past this callback. `sized()` is a no-op if the underlay
        // already sized the canvas, and is the FIRST touch of it when there was none.
        const ctx = sized();
        if (!ctx) return;
        drawSingle(ctx, bm);
        // ONLY once the raster actually arrived. A declined, deferred, failed or aborted
        // shot returns above and keeps `paintFill`'s honest flat-colour twin - an export
        // must not claim a crisp walk of a box the bar never showed.
        //
        // The twin does not reuse the bitmap: it re-walks the LIVE box to real vector.
        // Only numbers survive this callback (the aspect, hence the tile advance) -
        // the bitmap belongs to the clip-thumbs LRU and is never retained.
        const tile = stillTilePx(bm.height > 0 ? bm.width / bm.height : 0, h);
        const box = job.box;
        // The appearance this bitmap was keyed on. Re-checked at export time because a
        // twin that merely re-walks the LIVE box exports whatever the box says NOW,
        // which is not necessarily what the bar is showing: `scheduleThumbs` is
        // debounced behind `onIdle(…, 400)`, so for at least that long after an edit the
        // canvas still holds the OLD raster. Exporting in that window would emit a
        // picture the user never saw - and, because `tile` is frozen from the old
        // bitmap while the walk is sized live and stretched with
        // preserveAspectRatio="none", a box resized in that window would export
        // distorted. Mismatch ⇒ null ⇒ the PNG on screen, which is always honest.
        const sigAtPaint = job.sig;
        setTwin(async () => {
          // The stage is live and the box may have been removed, re-laid-out or hidden
          // by the clock since the shot; a detached node has no geometry to walk.
          if (!box?.isConnected) return null;
          // Recomputed from the LIVE model/style, exactly as the pass built `job.sig`.
          // Reading the theme here rather than closing over the pass's stamp is
          // deliberate: a theme flip between paint and export changes the picture too.
          const rowNow = getBoxes().find((b) => String(b?.[cfg.idField] ?? '') === job.id);
          const fillNow = getComputedStyle(box).backgroundColor || '';
          const themeNow = document.documentElement?.getAttribute('data-theme') ?? '';
          if (`${appearanceSig(rowNow, cfg)}\u0001${fillNow}\u0001${themeNow}` !== sigAtPaint)
            return null;
          try {
            const { renderSvgFromHtml } = await import('../../bridge/export.ts');
            // LAYOUT size, not the rendered rect - the same reasoning as
            // `defaultNodeRasterer` in clip-thumbs: the stage carries the editor's zoom,
            // and sizing off the rect would walk the box at whatever magnification the
            // user happens to be at.
            const bw = Math.max(1, Number.parseFloat(box.style.width) || box.offsetWidth || 1);
            const bh = Math.max(1, Number.parseFloat(box.style.height) || box.offsetHeight || 1);
            // `.seq-off` (display:none) is on every box outside the playhead window, and
            // a walk of a display:none subtree yields nothing. withBorrowedVisibility is
            // the right lease here precisely because this caller owns the read to
            // completion - unlike captureNode, whose lease must outlive its own race.
            const blob = await withBorrowedVisibility(box, () =>
              renderSvgFromHtml(box, { width: bw, height: bh })
            );
            const root = parseSvgRoot(await blob.text());
            if (!root) return null;
            // The canvas draws ONE bitmap ONCE at its own aspect over the flat fill,
            // so the vector does exactly that: the walk is sized to the tile box and
            // stretched to it (the tile advance already carries the aspect, so nothing
            // is distorted), placed once, over a rect of the same fill the canvas laid.
            root.setAttribute('width', n3(tile));
            root.setAttribute('height', n3(h));
            root.setAttribute('preserveAspectRatio', 'none');
            const inner = new XMLSerializer().serializeToString(root);
            // `tileBody` over the SINGLE-tile width: one <use>, clipped exactly where
            // the canvas's own edge cuts it. It cannot return null at one tile, but the
            // guard stays - a null twin falls through to the PNG, which is always what
            // the user is actually looking at.
            const under = isPaintedColor(job.fill) ? rectBody(job.fill, w, h) : '';
            const body = tileBody(inner, tile, Math.min(tile, w), h);
            return body === null ? null : svgDoc(w, h, under + body);
          } catch {
            return null; // any failure leaves the walker on its unmodified raster path
          }
        });
      })
      .catch(() => {
        /* clip-thumbs never rejects; belt and braces */
      });
    return;
  }

  // Every remaining mode has a picture coming, so the canvas is sized now - same
  // point in the paint as before this was a closure.
  const ctx = sized();
  if (!ctx) return;

  // The trim window, needed by both of the TIME-WINDOWED branches (a still has no
  // time axis, and a card has no media at all). It used to be computed only for the
  // filmstrip, so a waveform was drawn over the WHOLE track and stretched to fit the
  // bar: trimming an audio clip squeezed the same picture instead of showing the part
  // that plays, and the two halves of a split clip drew identical waveforms.
  const box0 = job.row;
  const timing0 = box0 ? boxTiming(box0, cfg) : null;
  const clipIn0 = timing0?.clipIn ?? 0;
  // The length must come from span(), NOT from `timing.dur ?? 0`. An OPEN-ENDED box
  // (no authored dur - which is what the default music bed is, and what any box
  // promoted with only a Start becomes) has a null dur meaning "run to the end of the
  // sequence". Defaulting that to 0 collapses the window to zero width, and
  // windowPeaks correctly answers with silence - so the waveform was still drawn, but
  // flat at the 0.02 floor: a hairline that reads as no waveform at all. span() is the
  // one place that resolves the effective length, and every other geometry read in
  // this panel already goes through it.
  const eff0 = box0 ? tp.rows.span(box0, tp.rows.durationSec()) : null;
  const out0 = clipIn0 + (eff0?.dur ?? 0) * (timing0?.speed ?? 1);

  if (mode === 'waveform') {
    const buckets = Math.max(8, Math.min(600, Math.round(w / 2)));
    // Clip-warning tint (plans/101 "clip-warning waveforms"): the bars that will
    // play HOT are painted amber (within 1 dB of full scale) or red (over it),
    // POST-envelope - source peak x the same closed form the preview drives a
    // video's volume with (gain, fades, volume keys; duck only ever lowers, so
    // skipping it errs safe). Level feedback across the whole timeline with no
    // meter-watching; the master limiter still guards the exported file - red
    // here means "the limiter will be working", not "the file will clip".
    const gain0 = clamp(finite(box0?.[cfg.gainField ?? ''], 1), 0, 2);
    const enterK0 = box0?.[cfg.enterField];
    const exitK0 = box0?.[cfg.exitField];
    const audio0 = media.kind === 'audio';
    const fadeInSec0 =
      (audio0 && enterK0) || enterK0 === 'fade'
        ? clamp(finite(box0?.[cfg.enterMsField], 400), 100, 3000) / 1000
        : 0;
    const fadeOutSec0 =
      (audio0 && exitK0) || exitK0 === 'fade'
        ? clamp(finite(box0?.[cfg.exitMsField], 400), 100, 3000) / 1000
        : 0;
    const vKeys0: VolumeKey[] =
      cfg.kfField && box0
        ? kfBoxTrack(box0, cfg)
            .filter((k) => typeof k.v.v === 'number')
            .map((k) => ({ tSec: k.t / 1000, value: k.v.v as number }))
        : [];
    const spanSec0 = eff0?.dur ?? 0;
    const speed0 = timing0?.speed ?? 1;
    peaks(media.url, buckets, signal, { fromSec: clipIn0, toSec: out0 })
      .then((data) => {
        if (signal.aborted || !data.length) return;
        // Synchronous draw on receipt - the array is cache-owned, never mutated or kept.
        ctx.clearRect(0, 0, w, h);
        // Canvas 2D has no `currentColor` - assigning it is silently IGNORED and the
        // waveform paints default black, invisible on a dark clip. `ink` is that cascade
        // resolved to a real colour (in the read pass), so the bars follow the theme.
        const bw = w / data.length;
        // Three passes batched by colour, not a per-bar fillStyle flip: style writes
        // are the expensive part of this loop, and hot bars are the rare case.
        const HOT = 10 ** (-1 / 20); // -1 dBTP, the master limiter's own ceiling
        const tintOf = (i: number): 0 | 1 | 2 => {
          const amp = Math.min(1, data[i]!);
          const srcT = clipIn0 + ((i + 0.5) / data.length) * Math.max(0, out0 - clipIn0);
          const post =
            amp *
            clipGainValueAt({
              spanSec: spanSec0,
              gain: gain0,
              fadeInSec: fadeInSec0,
              fadeOutSec: fadeOutSec0,
              ...(vKeys0.length ? { volumeKeys: vKeys0 } : {}),
              tSec: (srcT - clipIn0) / speed0,
            });
          return post >= 1 ? 2 : post >= HOT ? 1 : 0;
        };
        const paintPass = (want: 0 | 1 | 2, style: string): void => {
          ctx.fillStyle = style;
          for (let i = 0; i < data.length; i++) {
            if (tintOf(i) !== want) continue;
            const amp = Math.max(0.02, Math.min(1, data[i]!));
            const bh = amp * (h - 4);
            ctx.fillRect(i * bw, (h - bh) / 2, Math.max(1, bw - 0.5), bh);
          }
        };
        paintPass(0, job.ink);
        paintPass(1, '#d97706');
        paintPass(2, '#dc2626');
        // Same bars, as one <path> of subpaths. Built SYNCHRONOUSLY, here, for the same
        // ownership reason the draw is: `data` is cache-owned, so the twin closes over
        // the finished `d` string and never over the Float32Array.
        const d = waveformPathD(data, w, h);
        const ink = job.ink;
        setTwin(() => svgDoc(w, h, `<path fill="${escXml(ink)}" d="${d}"/>`));
        el.classList.add('has-thumbs');
      })
      .catch(() => {
        /* clip-thumbs never rejects; belt and braces */
      });
    return;
  }
  // One picture, TILED across the bar - an image, a Lottie's live frame, or a tool
  // clip's compose render. Tiled rather than stretched for the same reason the video
  // branch draws a strip: a long bar must read as a length of film, and a single
  // stretched thumbnail reads as a smear. One bitmap serves every bar width, so the
  // decode happens once per (asset, device-pixel height) and zooming re-uses it.
  if (mode === 'still') {
    stillFrames(media.url, { h: Math.round(h * dpr) }, signal, media.el)
      .then((frames) => {
        const bm = frames[0];
        if (signal.aborted || !bm) return;
        // OWNERSHIP CONTRACT (as below): cache-owned bitmap, drawn synchronously here
        // and never held past this callback.
        drawTiled(ctx, bm);
        // A still is vector-expressible only when its SOURCE is vector. Numbers plus the
        // source string are all that survives the callback; the bitmap is not retained.
        const tile = stillTilePx(bm.height > 0 ? bm.width / bm.height : 0, h);
        const src = media.url;
        setTwin(async () => {
          // data: only. `inlineSvgFromImg` would happily fetch a blob:/http(s) source,
          // but the panel does no network I/O - a photograph stays a photograph, and a
          // remote SVG simply keeps the raster path, which is correct and bounded.
          if (!/^data:/i.test(src)) return null;
          try {
            const { inlineSvgFromImg } = await import('../../bridge/export.ts');
            const svg = await inlineSvgFromImg(src);
            // svgMarkup is the same normaliser the live still path uses (root style
            // stripped, viewBox-or-attrs sizing, size ceiling), so screen and export
            // agree on what the source document even is.
            const markup = svg ? svgMarkup(svg) : null;
            const root = markup ? parseSvgRoot(markup) : null;
            if (!root) return null;
            // svgMarkup guarantees positive width/height attributes; a source with no
            // viewBox needs one before width/height can scale rather than crop.
            const nw = Number.parseFloat(root.getAttribute('width') || '');
            const nh = Number.parseFloat(root.getAttribute('height') || '');
            if (!(nw > 0) || !(nh > 0)) return null;
            if (!root.getAttribute('viewBox'))
              root.setAttribute('viewBox', `0 0 ${n3(nw)} ${n3(nh)}`);
            root.setAttribute('width', n3(tile));
            root.setAttribute('height', n3(h));
            root.setAttribute('preserveAspectRatio', 'none');
            const inner = new XMLSerializer().serializeToString(root);
            // Null when the bar would need more tiles than the vector form emits: the
            // canvas loop is uncapped, so a short run would export a bar the user sees
            // fully tiled with a blank right-hand end. The PNG is the honest answer.
            const body = tileBody(inner, tile, w, h);
            return body === null ? null : svgDoc(w, h, body);
          } catch {
            return null;
          }
        });
      })
      .catch(() => {
        /* see above */
      });
    return;
  }

  if (mode !== 'filmstrip') {
    // Exhaustiveness guard. Every other mode returns above, so TypeScript narrows
    // `mode` to `never` here - which makes ADDING a ThumbMode without a branch a
    // compile error instead of a bar that silently paints nothing. That is exactly
    // how a new mode would fail: quietly, on one clip kind, in a browser only.
    const unhandled: never = mode;
    void unhandled;
    return;
  }
  filmstrip(
    media.url,
    { count: frameCountFor(w), h, clipInSec: clipIn0, clipOutSec: out0 },
    signal
  )
    .then((frames) => {
      if (signal.aborted || !frames.length) return;
      // OWNERSHIP CONTRACT: these ImageBitmaps belong to the clip-thumbs LRU. Draw them
      // into our own canvas right here, synchronously, and drop the references - never
      // hold one across an await or a repaint, and never close() one.
      ctx.clearRect(0, 0, w, h);
      let x = 0;
      for (const bm of frames) {
        const fw = bm.height > 0 ? (bm.width / bm.height) * h : h;
        ctx.drawImage(bm, x, 0, fw, h);
        x += fw;
        if (x >= w) break;
      }
      // No twin, deliberately: decoded video frames are photographs. There is no vector
      // form to recover, so the walker keeps rasterising this bar - which is the right
      // answer, not a gap.
      setTwin(null);
      el.classList.add('has-thumbs');
    })
    .catch(() => {
      /* see above */
    });
}
// ── sync (runtime.subscribe → rAF-coalesced, skipped mid-gesture) ────────────

/**
 * Every box's appearance, in one string. Changing it is what re-runs a thumb pass.
 *
 * Deliberately the same signature the raster cache is keyed on, so the two agree by
 * construction: if this string moved, at least one bar's `nodeKey` moved too and the
 * pass will retake exactly that picture (every other bar is a cache hit and free).
 * O(rows × fields) once per model change, alongside `tracksKey`'s own walk.
 */
export function appearanceKey(tp: TpCtx, boxes: Box[]): string {
  const { cfg } = tp;
  const parts: string[] = [];
  for (const b of boxes) parts.push(`${b?.[cfg.idField] ?? ''}${appearanceSig(b, cfg)}`);
  return parts.join('');
}
export function thumbsOps(tp: TpCtx) {
  return {
    scheduleThumbs: bindOp(tp, scheduleThumbs),
    queueThumbPass: bindOp(tp, queueThumbPass),
    abortThumbs: bindOp(tp, abortThumbs),
    paintThumbs: bindOp(tp, paintThumbs),
    appearanceKey: bindOp(tp, appearanceKey),
  };
}
