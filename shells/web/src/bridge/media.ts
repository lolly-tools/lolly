// SPDX-License-Identifier: MPL-2.0
/**
 * Web implementation of the `media` capability - a live camera frame source
 * (engine bridge v1.4). The runtime drives a tool's `onFrame` hook from these
 * frames so a tool (e.g. a filter) can react to motion.
 *
 * The whole MediaStream / <video> / grab-loop lives HERE, in the shell - the engine
 * only ever sees plain RGBA pixel frames, so it stays DOM-free (mirrors how capture
 * keeps its browser engine in the shell). Pixels are read on the device and never
 * leave it; the only consumer is the in-page filter.
 *
 * Performance + privacy:
 *   - Frames are downscaled to a working size (a halftone/scanline trace doesn't
 *     need 720p) and throttled to ~MAX_FPS so the per-frame vector trace keeps up.
 *   - The grab loop pauses while the document is hidden (don't read the camera in a
 *     backgrounded tab), and the camera is fully released when the last start() is
 *     balanced by a stop().
 */

import type { MediaAPI, MediaFrame } from '@lolly-tools/core/host-v1';
import { cameraAvailable } from './capture-support.ts';

type FrameCallback = (frame: MediaFrame) => void;

/**
 * The web media source, with a shell-private extension: a NON-camera "animated
 * asset" source. Arm it with a source spec and the next start() plays that
 * animation instead of the camera, sampling it with the SAME
 * drawImage→getImageData→MediaFrame path the camera uses - so an onFrame tool
 * (e.g. filter) runs "live" with no camera, on a moving subject the user chose.
 * Three source kinds:
 *   - svg:    ready-to-render markup (already sanitised + brand-resolved by the
 *             caller). An off-screen live <svg> animates on its own clock; each
 *             grab bakes the current pose to a static snapshot (see bakeStaticSvg)
 *             and decodes it through one reused <img>.
 *   - raster: a gif/apng/animated-webp URL, stepped frame-by-frame via
 *             WebCodecs ImageDecoder honouring each frame's own duration.
 *             (drawImage of an animated <img> always yields the FIRST frame per
 *             spec, so an <img> can't drive this.) Callers feature-detect
 *             ImageDecoder before arming; where it's absent the asset simply
 *             stays a still, exactly as before.
 *   - video:  a video URL played muted/looped in an off-screen <video>; drawImage
 *             reads the current playback frame directly.
 * Camera and anim source are mutually exclusive (one refcounted singleton); the
 * arm method is NOT on the portable MediaAPI contract - only the web shell
 * reaches for it.
 */
export type AnimSourceSpec =
  | { kind: 'svg'; markup: string }
  | { kind: 'raster'; url: string }
  | { kind: 'video'; url: string };

export interface WebMediaAPI extends MediaAPI {
  /** Arm a specific camera (deviceId) for the next camera start(); null clears it
   *  back to the facing preference (plans/162, device picker). Shell-private. */
  armPreferredCamera(deviceId: string | null): void;
  /** Arm the non-camera animated source for the next start(). A bare string is
   *  the legacy spelling of { kind: 'svg', markup }. Pass null to disarm. */
  armAnimSource(src: AnimSourceSpec | string | null): void;
  /**
   * DETERMINISTICALLY render the armed anim source at exactly `tMs` (independent of the
   * live rAF clock) into an RGBA frame - the frame-accurate export path: the live preview
   * is real time, the final render feeds each source frame at its true time through the
   * effect. Null when no source is set up, or the kind can't be seeked yet. Does NOT emit
   * or touch the live loop, so it composes with a running preview.
   */
  renderFrameAt(tMs: number): Promise<MediaFrame | null>;
}

// Minimal WebCodecs ImageDecoder surface (lib.dom's coverage varies by TS
// version, and the raster source is feature-detected at runtime anyway).
type WcImageFrame = {
  displayWidth?: number; displayHeight?: number;
  codedWidth?: number; codedHeight?: number;
  /** Frame duration in MICROSECONDS (may be null for a malformed frame). */
  duration?: number | null;
  close(): void;
};
type WcImageDecoder = {
  tracks: { ready: Promise<unknown>; selectedTrack?: { frameCount?: number } | null };
  decode(opts: { frameIndex: number }): Promise<{ image: WcImageFrame }>;
  close(): void;
};
type WcImageDecoderCtor = new (init: { data: ArrayBuffer; type: string }) => WcImageDecoder;

/** Sniff the container MIME from magic bytes - ImageDecoder requires a type, and a
 *  blob: fetch may not carry one. Covers exactly the three animated-raster kinds. */
export function sniffRasterMime(bytes: Uint8Array): string | null {
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return 'image/gif';           // GIF8…
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png'; // ‰PNG (APNG decodes as PNG with an animated track)
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'image/webp';       // RIFF…WEBP
  return null;
}

// Default cap for the working frame's longest edge - plenty for a dot/line vector
// trace, and keeps getImageData + the downstream trace cheap. A subscriber can ask
// for more (subscribe opts.maxEdge) when its output is a bitmap rather than a vector
// trace - e.g. filter-pixel-stretch - and the grab loop produces frames at the
// largest size any live subscriber requested (clamped to the native frame).
const DEFAULT_MAX_EDGE = 480;
const MAX_EDGE_CAP = 1920; // ceiling so a tool can't request an absurd working frame
const MAX_FPS = 30;
const MIN_INTERVAL = 1000 / MAX_FPS;

// One warning per page for a commitStyles refusal (bakeStaticSvg) - visible, not noisy.
let commitWarnedOnce = false;

/**
 * Copy each animated target's RESOLVED transform (plus transform-origin and
 * transform-box, so the matrix applies in the same reference frame) onto the
 * corresponding node of a STRUCTURAL clone of `srcRoot`. The mapping is by tree
 * order - `cloneNode(true)` preserves it exactly, and both sides are walked with
 * the same `[root, ...querySelectorAll('*')]` enumeration - so no ids or
 * attributes are needed on either side. Targets outside the cloned subtree and
 * targets whose computed transform is 'none' are skipped.
 *
 * Exported for tests (jsdom drives it with an injected style reader): this is the
 * commitStyles bypass that keeps SVG rotation animating in the baked frames.
 */
export function stampComputedTransforms(
  srcRoot: Element,
  cloneRoot: Element,
  targets: ReadonlyArray<Element>,
  readStyle: (el: Element) => { transform: string; transformOrigin: string; transformBox: string },
): void {
  if (!targets.length) return;
  const srcEls: Element[] = [srcRoot, ...srcRoot.querySelectorAll('*')];
  const cloneEls: Element[] = [cloneRoot, ...cloneRoot.querySelectorAll('*')];
  const seen = new Set<Element>();
  for (const target of targets) {
    if (seen.has(target)) continue;
    seen.add(target);
    const idx = srcEls.indexOf(target);
    if (idx < 0 || idx >= cloneEls.length) continue; // outside the cloned subtree
    const cs = readStyle(target);
    if (!cs.transform || cs.transform === 'none') continue;
    const dst = cloneEls[idx] as Element & { style?: CSSStyleDeclaration };
    if (!dst?.style) continue;
    dst.style.setProperty('transform', cs.transform);
    if (cs.transformOrigin) dst.style.setProperty('transform-origin', cs.transformOrigin);
    if (cs.transformBox) dst.style.setProperty('transform-box', cs.transformBox);
  }
}

export function createMediaAPI(): WebMediaAPI {
  let stream: MediaStream | null = null;
  let videoEl: HTMLVideoElement | null = null;
  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let rafId = 0;
  let refcount = 0;
  let starting: Promise<void> | null = null; // in-flight start() promise (so concurrent starts share one stream)
  let lastGrab = 0;
  const subscribers = new Map<FrameCallback, number>(); // cb → requested maxEdge
  // Non-camera animated source (see WebMediaAPI). When `animSpec` is armed, start()
  // brings up that source instead of the camera. For the SVG kind, grabAnim seeks a
  // live off-screen inline <svg> to the wall-clock time, BAKES that frame to a
  // static SVG, and samples it via a lightweight <img> + drawImage. Baking is the
  // whole trick: an <img>-embedded SVG (or a dom-to-image clone) restarts its
  // @keyframes at t=0 on rasterise, so we commit the seeked transforms as inline
  // style and disable animation in the snapshot - the img then renders exactly the
  // frame we seeked. Far lighter than a per-frame dom-to-image.
  let animSpec: AnimSourceSpec | null = null;
  // A specific camera chosen via the device picker (plans/162). Shell-private (the
  // portable MediaAPI keeps only facingMode); the next camera start() opens this id.
  let preferredCameraId: string | null = null;
  let animHost: HTMLElement | null = null; // SVG kind: off-screen host holding the live inline <svg>
  let animImg: HTMLImageElement | null = null; // reused <img> that decodes each baked frame
  let animStart = 0;                       // wall-clock of the first anim frame (drives playback time)
  let animBusy = false;                    // a bake/decode is in flight (skip-if-busy → adaptive fps)
  // VIDEO kind: an off-screen muted looping <video>; drawImage reads its current frame.
  let animVideo: HTMLVideoElement | null = null;
  // RASTER kind (gif/apng/animated-webp via ImageDecoder): the decoder + a stepping
  // clock. One frame is decoded at a time and closed right after it's drawn, so a
  // long GIF never accumulates decoded frames in memory.
  let rasterDec: WcImageDecoder | null = null;
  let rasterOn = false;       // the raster source is active (decoder may still be starting)
  let rasterFrames = 0;       // frameCount from the selected track (0 until ready)
  let rasterIdx = -1;         // index of the frame currently shown
  let rasterNextAt = 0;       // wall-clock (ms) when the next frame is due
  let rasterEpoch = 0;        // invalidates in-flight async setup/decode after teardown

  // The same probe bridge/index.ts's lazy facade answers from (capture-support.ts),
  // called rather than re-typed so the two can never disagree.
  const isAvailable = cameraAvailable;

  function teardown(): void {
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    if (videoEl) { try { videoEl.pause(); } catch { /* ignore */ } videoEl.srcObject = null; videoEl = null; }
    if (stream) { stream.getTracks().forEach(t => { try { t.stop(); } catch { /* ignore */ } }); stream = null; }
    if (animHost) { try { animHost.remove(); } catch { /* ignore */ } animHost = null; }
    if (animImg) { animImg.onload = null; animImg.onerror = null; animImg = null; }
    if (animVideo) { try { animVideo.pause(); } catch { /* ignore */ } animVideo.removeAttribute('src'); try { animVideo.load(); } catch { /* ignore */ } animVideo = null; }
    if (rasterDec) { try { rasterDec.close(); } catch { /* ignore */ } rasterDec = null; }
    rasterOn = false; rasterFrames = 0; rasterIdx = -1; rasterNextAt = 0; rasterEpoch++;
    animBusy = false; animStart = 0;
    canvas = null; ctx = null;
    lastGrab = 0;
  }

  function workingSize(vw: number, vh: number): { cw: number; ch: number } {
    let want = DEFAULT_MAX_EDGE;
    for (const e of subscribers.values()) if (e > want) want = e;
    const scale = Math.min(1, want / Math.max(vw, vh));
    return { cw: Math.max(1, Math.round(vw * scale)), ch: Math.max(1, Math.round(vh * scale)) };
  }

  function emit(data: Uint8ClampedArray, width: number, height: number, now: number): void {
    const frame: MediaFrame = { width, height, data, t: now };
    // Snapshot the keys so a subscriber that unsubscribes mid-iteration is safe.
    for (const cb of [...subscribers.keys()]) {
      try { cb(frame); } catch { /* one bad subscriber must not kill the loop */ }
    }
  }

  function grab(now: number): void {
    if (!videoEl || !stream || subscribers.size === 0) return;
    // Don't read the camera while backgrounded (privacy + perf).
    if (typeof document !== 'undefined' && document.hidden) return;
    const vw = videoEl.videoWidth, vh = videoEl.videoHeight;
    if (!vw || !vh) return; // stream not yet producing frames
    // Working size = the largest edge any live subscriber asked for, clamped to native.
    const { cw, ch } = workingSize(vw, vh);
    if (canvas!.width !== cw) canvas!.width = cw;
    if (canvas!.height !== ch) canvas!.height = ch;
    try {
      ctx!.drawImage(videoEl, 0, 0, cw, ch);
      emit(ctx!.getImageData(0, 0, cw, ch).data, cw, ch, now);
    } catch { /* tainted canvas etc. - skip this frame */ }
  }

  // Seek the live inline SVG to `elapsedMs`, then produce a STATIC snapshot of that exact
  // frame: commitStyles writes each animation's current computed value as an inline
  // style, then the clone disables all animation so those baked inline values are
  // what render (a live @keyframes would restart at 0 when the snapshot is drawn).
  //
  // TRANSFORMS get their own lane: commitStyles is known-flaky for `transform` on
  // SVG targets (transform is a PRESENTATION attribute there - Chrome can refuse
  // or miswrite the commit, and the old silent catch made the failure invisible).
  // The field symptom (Andy, 2026-08-10, repo-root icon.svg): a mark whose
  // @keyframes hue-rotate animates while its @keyframes rotate stays frozen. So
  // after seeking, every animated target's RESOLVED matrix is read straight off
  // getComputedStyle and stamped inline on the clone's corresponding node - 
  // together with the computed transform-origin/transform-box so the matrix lands
  // in the same reference frame - bypassing commitStyles for transforms entirely.
  // Returns serialised SVG, or null if there's nothing to draw.
  function bakeStaticSvg(host: HTMLElement, elapsedMs: number): string | null {
    const svg = host.querySelector('svg');
    if (!svg) return null;
    const anims = (host as Element & { getAnimations?: (o?: { subtree?: boolean }) => Animation[] })
      .getAnimations?.({ subtree: true }) ?? [];
    for (const a of anims) {
      try { a.pause(); a.currentTime = elapsedMs; } catch { /* idle/finished - skip */ }
    }
    for (const a of anims) {
      try { (a as Animation & { commitStyles?: () => void }).commitStyles?.(); } catch (e) {
        // Once, not per frame - but never silently: a swallowed commit failure is
        // exactly how the frozen-rotation bug hid.
        if (!commitWarnedOnce) {
          commitWarnedOnce = true;
          console.warn('media: commitStyles failed on an animated target (typically transform on an SVG element) - using computed-style transform stamping instead', e);
        }
      }
    }
    const clone = svg.cloneNode(true) as SVGSVGElement;
    const targets = anims
      .map((a) => (a.effect as KeyframeEffect | null)?.target)
      .filter((el): el is Element => el instanceof Element);
    stampComputedTransforms(svg, clone, targets, (el) => {
      const cs = getComputedStyle(el);
      return {
        transform: cs.transform,
        transformOrigin: cs.transformOrigin,
        transformBox: cs.getPropertyValue('transform-box'),
      };
    });
    const kill = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    kill.textContent = '*{animation:none!important;transition:none!important}';
    clone.appendChild(kill);
    return new XMLSerializer().serializeToString(clone);
  }

  // Non-camera source: bake the current frame (above) and decode it through a reused <img>,
  // then drawImage → getImageData → emit. Async + skip-if-busy so a slow decode just lowers
  // the effective fps. The sync work per frame (seek + commit + clone + serialise) is a few
  // ms on a small SVG - nothing like a per-frame dom-to-image DOM clone.
  function grabAnim(now: number): void {
    if (!animHost || animBusy || subscribers.size === 0) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    const host = animHost;
    if (!animStart) animStart = now;
    const svgStr = bakeStaticSvg(host, now - animStart);
    if (!svgStr) return;
    animBusy = true;
    const url = URL.createObjectURL(new Blob([svgStr], { type: 'image/svg+xml' }));
    const img = animImg ?? (animImg = new Image());
    img.onload = () => {
      try {
        if (animHost !== host || !canvas || !ctx) return; // torn down mid-decode
        const { cw, ch } = workingSize(img.naturalWidth || 512, img.naturalHeight || 512);
        if (canvas.width !== cw) canvas.width = cw;
        if (canvas.height !== ch) canvas.height = ch;
        ctx.drawImage(img, 0, 0, cw, ch);
        emit(ctx.getImageData(0, 0, cw, ch).data, cw, ch, now);
      } catch { /* a bad frame must not kill the loop */ }
      finally { URL.revokeObjectURL(url); animBusy = false; }
    };
    img.onerror = () => { URL.revokeObjectURL(url); animBusy = false; };
    img.src = url;
  }

  // VIDEO kind: identical to the camera grab, but reading the off-screen anim
  // <video> (no MediaStream involved) - drawImage of a <video> yields the current
  // playback frame, so the loop needs no seeking of its own.
  function grabVideo(now: number): void {
    if (!animVideo || subscribers.size === 0) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    const vw = animVideo.videoWidth, vh = animVideo.videoHeight;
    if (!vw || !vh) return; // metadata not yet loaded
    const { cw, ch } = workingSize(vw, vh);
    if (canvas!.width !== cw) canvas!.width = cw;
    if (canvas!.height !== ch) canvas!.height = ch;
    try {
      ctx!.drawImage(animVideo, 0, 0, cw, ch);
      emit(ctx!.getImageData(0, 0, cw, ch).data, cw, ch, now);
    } catch { /* tainted / not yet decodable - skip this frame */ }
  }

  // RASTER kind: step gif/apng/animated-webp frames on their own clock. Exactly one
  // decode is in flight at a time (skip-if-busy via animBusy, shared with the SVG
  // bake) and each VideoFrame is closed immediately after drawing - constant memory
  // regardless of clip length. Frame durations come from the frames themselves.
  function grabRaster(now: number): void {
    if (!rasterDec || animBusy || subscribers.size === 0) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    if (rasterIdx >= 0 && now < rasterNextAt) return; // current frame still showing
    const epoch = rasterEpoch;
    const idx = rasterFrames > 0 ? (rasterIdx + 1) % rasterFrames : 0;
    animBusy = true;
    rasterDec.decode({ frameIndex: idx }).then(({ image }) => {
      try {
        if (epoch !== rasterEpoch || !canvas || !ctx) return; // torn down mid-decode
        const iw = image.displayWidth || image.codedWidth || 1;
        const ih = image.displayHeight || image.codedHeight || 1;
        const { cw, ch } = workingSize(iw, ih);
        if (canvas.width !== cw) canvas.width = cw;
        if (canvas.height !== ch) canvas.height = ch;
        ctx.drawImage(image as unknown as CanvasImageSource, 0, 0, cw, ch);
        // µs → ms; a missing/zero duration gets the classic 100 ms GIF default.
        const durMs = Math.max(20, (Number(image.duration) || 100_000) / 1000);
        rasterIdx = idx;
        rasterNextAt = now + durMs;
        emit(ctx.getImageData(0, 0, cw, ch).data, cw, ch, now);
      } catch { /* a bad frame must not kill the loop */ }
      finally { try { image.close(); } catch { /* already closed */ } }
    }).catch(() => { /* decoder closed / malformed frame - the loop just idles */ })
      .finally(() => { animBusy = false; });
  }

  function loop(now: number): void {
    if (!stream && !animHost && !animVideo && !rasterOn) return; // torn down
    const t = now ?? 0;
    if (t - lastGrab >= MIN_INTERVAL) {
      lastGrab = t;
      if (animHost) grabAnim(t);
      else if (animVideo) grabVideo(t);
      else if (rasterOn) grabRaster(t);
      else grab(t);
    }
    rafId = requestAnimationFrame(loop);
  }

  async function start(opts?: { facingMode?: 'user' | 'environment' }): Promise<void> {
    refcount++;
    if (stream || animHost || animVideo || rasterOn) return; // already running (camera or anim source)
    // Non-camera path: an animated source is armed → bring THAT up instead of the
    // camera. No getUserMedia, no permission - works with no camera at all.
    if (animSpec) {
      canvas = document.createElement('canvas');
      ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (animSpec.kind === 'svg') {
        // INLINE the (already-sanitised - see svg-sanitize) markup live in an
        // off-screen host, rendered so its CSS/SMIL animation actually ticks, and
        // let grabAnim bake + sample the current frame.
        const host = document.createElement('div');
        host.setAttribute('aria-hidden', 'true');
        host.style.cssText = 'position:fixed;left:-99999px;top:0;width:512px;height:512px;pointer-events:none;opacity:0.01;overflow:hidden';
        host.innerHTML = animSpec.markup;
        const svg = host.querySelector('svg');
        if (svg) { svg.setAttribute('width', '512'); svg.setAttribute('height', '512'); }
        (document.body ?? document.documentElement).appendChild(host);
        animHost = host;
      } else if (animSpec.kind === 'video') {
        const v = document.createElement('video');
        v.muted = true; v.loop = true; v.playsInline = true; v.autoplay = true;
        v.preload = 'auto';
        v.src = animSpec.url;
        // Kick playback but DON'T await it (same reasoning as the camera <video>):
        // the grab loop no-ops until videoWidth is set, so start() resolving early
        // is harmless and can never hang on an autoplay policy.
        v.play().catch(() => { /* frames still arrive once playback is allowed */ });
        animVideo = v;
      } else {
        // gif/apng/animated-webp: fetch the bytes once and step frames through
        // ImageDecoder. Feature-detected here too (callers already gate on it):
        // without ImageDecoder this source can't run, so start() cleanly no-ops
        // the loop rather than pretending.
        const ImgDec = (globalThis as { ImageDecoder?: WcImageDecoderCtor }).ImageDecoder;
        if (!ImgDec) { canvas = null; ctx = null; refcount = Math.max(0, refcount - 1); throw new Error('ImageDecoder unavailable'); }
        rasterOn = true;
        const epoch = ++rasterEpoch;
        const url = animSpec.url;
        void (async () => {
          try {
            const res = await fetch(url);
            const buf = await res.arrayBuffer();
            const headerType = (res.headers?.get?.('content-type') ?? '').split(';')[0]?.trim() ?? '';
            const type = (headerType && headerType !== 'application/octet-stream')
              ? headerType
              : (sniffRasterMime(new Uint8Array(buf, 0, Math.min(16, buf.byteLength))) ?? 'image/gif');
            const dec = new ImgDec({ data: buf, type });
            await dec.tracks.ready;
            if (epoch !== rasterEpoch || !rasterOn) { try { dec.close(); } catch { /* ignore */ } return; }
            rasterDec = dec;
            rasterFrames = dec.tracks.selectedTrack?.frameCount ?? 0;
          } catch { /* undecodable - the loop idles; the still render stands */ }
        })();
      }
      rafId = requestAnimationFrame(loop);
      return;
    }
    if (starting) return starting; // a concurrent start is bringing the camera up
    const facingMode = opts?.facingMode ?? 'user';
    // A specific camera (device-picker) wins over the facing preference: deviceId +
    // facingMode over-constrain, so an armed id drops facingMode. plans/162.
    const wantId = preferredCameraId;
    const dims = { width: { ideal: 1920 }, height: { ideal: 1080 } } as const;
    starting = (async () => {
      // Capture at 1080p so a high-resolution subscriber (a raster filter, or a
      // user-driven resolution slider - see runtime `render.liveMaxEdgeInput`) has
      // real pixels to downscale from; the grab loop never upscales past native
      // (grab() clamps scale ≤ 1), so a low working edge still stays cheap.
      let s: MediaStream;
      try {
        s = await navigator.mediaDevices.getUserMedia({
          video: wantId ? { deviceId: { exact: wantId }, ...dims } : { facingMode, ...dims },
          audio: false,
        });
      } catch (e) {
        // A saved camera that's gone (unplugged, or a stale id) throws
        // OverconstrainedError - fall back to the facing preference so the camera
        // still opens rather than failing outright.
        if (wantId && (e as { name?: string })?.name === 'OverconstrainedError') {
          preferredCameraId = null;
          s = await navigator.mediaDevices.getUserMedia({ video: { facingMode, ...dims }, audio: false });
        } else {
          throw e;
        }
      }
      stream = s;
      videoEl = document.createElement('video');
      videoEl.autoplay = true;
      videoEl.muted = true;
      videoEl.playsInline = true;
      videoEl.srcObject = s;
      // Kick playback but DON'T await it: a detached <video> (and autoplay policies)
      // can leave play() pending indefinitely, and the grab loop already waits for the
      // first frame (it no-ops until videoWidth is set). So start() resolves as soon as
      // the stream + loop are wired, not when the first frame decodes.
      videoEl.play().catch(() => { /* autoplay blocked - frames still arrive via the loop */ });
      canvas = document.createElement('canvas');
      ctx = canvas.getContext('2d', { willReadFrequently: true });
      rafId = requestAnimationFrame(loop);
    })();
    try {
      await starting;
    } catch (e) {
      // Failed to come up - undo this reference and surface the error to the caller.
      refcount = Math.max(0, refcount - 1);
      teardown();
      throw e;
    } finally {
      starting = null;
    }
  }

  function stop(): void {
    refcount = Math.max(0, refcount - 1);
    if (refcount === 0) teardown();
  }

  function subscribe(cb: FrameCallback, opts?: { maxEdge?: number }): () => void {
    const want = Math.max(1, Math.min(MAX_EDGE_CAP, Math.round(Number(opts?.maxEdge) || DEFAULT_MAX_EDGE)));
    subscribers.set(cb, want);
    return () => subscribers.delete(cb);
  }

  // Arm/disarm the non-camera animated source. Only takes effect on the next
  // start(); a running source keeps playing until stop()/teardown. Disarming (null)
  // while an anim source runs tears it down so it can't leak an off-screen element
  // or a decoder. A bare string keeps the legacy "SVG markup" spelling working.
  function armAnimSource(src: AnimSourceSpec | string | null): void {
    animSpec = typeof src === 'string' ? { kind: 'svg', markup: src } : src;
    if (!animSpec && (animHost || animVideo || rasterOn) && refcount === 0) teardown();
  }

  // Arm a specific camera for the next camera start() (device picker). Takes effect
  // on the next start() - a caller switches cameras with stop() then start() (the
  // media singleton is refcounted). null clears back to the facing preference.
  function armPreferredCamera(deviceId: string | null): void {
    preferredCameraId = deviceId || null;
  }

  // Sample a decoded source (img/video) into an RGBA MediaFrame at the working size.
  function sampleToFrame(src: CanvasImageSource, iw: number, ih: number, t: number): MediaFrame | null {
    if (typeof document === 'undefined') return null;
    const { cw, ch } = workingSize(iw || 512, ih || 512);
    const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
    const cx = cv.getContext('2d', { willReadFrequently: true });
    if (!cx) return null;
    try { cx.drawImage(src, 0, 0, cw, ch); return { width: cw, height: ch, data: cx.getImageData(0, 0, cw, ch).data, t }; }
    catch { return null; }
  }

  async function renderFrameAt(tMs: number): Promise<MediaFrame | null> {
    if (typeof document === 'undefined') return null;
    const t = Math.max(0, tMs);
    // SVG: bake the animation to exactly t (same bake the live loop uses, but at a chosen
    // time) and rasterise it - fully deterministic and independent of wall-clock.
    if (animHost) {
      const svgStr = bakeStaticSvg(animHost, t);
      if (!svgStr) return null;
      const url = URL.createObjectURL(new Blob([svgStr], { type: 'image/svg+xml' }));
      try {
        const img = await new Promise<HTMLImageElement>((res, rej) => {
          const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('svg decode')); im.src = url;
        });
        return sampleToFrame(img, img.naturalWidth, img.naturalHeight, t);
      } catch { return null; }
      finally { URL.revokeObjectURL(url); }
    }
    // VIDEO: seek to t and read that exact frame. Looping footage wraps within its duration.
    if (animVideo) {
      const v = animVideo;
      const target = (Number.isFinite(v.duration) && v.duration > 0) ? (t / 1000) % v.duration : t / 1000;
      try {
        await new Promise<void>((res) => {
          let settled = false;
          const done = () => { if (settled) return; settled = true; v.removeEventListener('seeked', done); res(); };
          v.addEventListener('seeked', done);
          try { v.pause(); } catch { /* ignore */ }
          v.currentTime = target;
          if (Math.abs(v.currentTime - target) < 1e-3 && v.readyState >= 2) done(); // already there
          setTimeout(done, 250); // guard: a seek that fires no event must not hang the export
        });
      } catch { /* sample whatever frame is showing */ }
      if (!v.videoWidth || !v.videoHeight) return null;
      return sampleToFrame(v, v.videoWidth, v.videoHeight, t);
    }
    // RASTER (gif/apng/animated-webp): deterministic frame-index mapping needs cached
    // per-frame durations - a follow-up. Returning null keeps the frozen base rather than
    // guessing a wrong frame.
    return null;
  }

  return {
    isAvailable, start, stop, subscribe, armAnimSource, armPreferredCamera, renderFrameAt,
    // Loaded on demand: the trimmer is a user action, not first paint (check-bundle-budget).
    trim: async (bytes, opts) => (await import('./media-trim.ts')).trimMedia(bytes, opts),
  };
}
