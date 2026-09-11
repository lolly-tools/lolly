// SPDX-License-Identifier: MPL-2.0
// Display-capture control (engine v1.54) - the Screenshot + Record pair for a tool
// declaring render.capture: "screen". Sibling of record-control.ts, deliberately NOT
// folded into it: a camera take needs a viewfinder, framing and level coaching, while a
// screen take needs none of them. The browser's own picker is the entire selection UI - 
// it chooses the screen/window/tab, and a page can neither enumerate the options nor
// pre-answer it. So this module has no preview to draw before the fact and nothing to
// coach; it arms nothing, and the first tap goes straight to the picker.
import { announce } from '../a11y.ts';
import { icon } from '../lib/icons.ts';
import { composeCropRect, cropPixelSize } from './screen-capture-crop.ts';
import { subscribeRecordPreview } from '../lib/record-preview.ts';
import { storeRecordingAsset } from './picker.ts';
import { fmtBytes } from '../lib/device-info.ts';
import type { AssetRef, RecordOpts } from '@lolly-tools/core/host-v1';
import type { ToolRuntime, WebToolHost } from './tool.ts';

/** Hard ceiling on a screen take. Long enough for a real walkthrough, short enough that
 *  a forgotten recording can't fill the device - the blob is held in memory until stop. */
const MAX_MS = 10 * 60 * 1000;

/**
 * Mounts the screen-capture affordances on the stage:
 *   - Screenshot → host.recorder.still({source:'screen'}) → one frame → the `shot` input,
 *     which the tool renders and the normal export bar crops/encodes.
 *   - Record → host.recorder.record({source:'screen'}) → the finished clip is handed
 *     straight back through host.export.file (the transform path: never watermarked,
 *     never re-encoded, audio intact).
 * The tool's own inputs (`micNarration`, `systemAudio`) choose what audio to ask for.
 */
export function setupScreenCaptureControl({
  stageEl, runtime, host, markSessionDirty, canvasEl, actionsApi, sizeExplicit,
}: {
  stageEl: HTMLElement; runtime: ToolRuntime; host: WebToolHost; markSessionDirty: () => void;
  canvasEl?: HTMLElement | null;
  actionsApi?: { setDims?: (d?: { width?: number; height?: number; unit?: string }) => void };
  sizeExplicit?: boolean;
}): void {
  let disposed = false;
  const bar = document.createElement('div');
  bar.className = 'canvas-screen-bar';
  bar.setAttribute('data-export-hide', '');   // never let the control land in the capture

  const shotBtn = document.createElement('button');
  shotBtn.type = 'button';
  shotBtn.className = 'canvas-screen-btn';
  shotBtn.innerHTML = `${icon('camera', { size: 16 })}<span>Screenshot</span>`;

  const recBtn = document.createElement('button');
  recBtn.type = 'button';
  recBtn.className = 'canvas-record-btn canvas-screen-rec';

  const timerEl = document.createElement('span');
  timerEl.className = 'canvas-record-timer';
  timerEl.hidden = true;

  bar.append(shotBtn, recBtn);
  stageEl.appendChild(bar);
  stageEl.appendChild(timerEl);
  stageEl.classList.add('has-record');

  const DOT = '<span class="canvas-record-dot" aria-hidden="true"></span>';
  const SQUARE = '<span class="canvas-record-square" aria-hidden="true"></span>';
  let state: 'idle' | 'recording' = 'idle';
  let startTs = 0, timerRaf = 0;
  let busy = false;   // a picker is open / a still is encoding - don't let a second tap race it
  // Set once the crop overlay exists; called from render() on every state change so the
  // crop layer hides during a take (via cropEnabled()) and re-shows after. A no-op until
  // then to avoid a TDZ reference to the const-declared layer below.
  let refreshCrop: () => void = () => {};

  const fmt = (ms: number): string => {
    const s = Math.max(0, Math.floor(ms / 1000));
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };

  const render = (): void => {
    if (disposed) return;
    recBtn.dataset.state = state;
    recBtn.setAttribute('aria-pressed', String(state === 'recording'));
    stageEl.classList.toggle('is-recording', state === 'recording');
    if (state === 'recording') {
      recBtn.innerHTML = `${SQUARE}<span>Stop</span>`;
      recBtn.title = 'Stop recording';
      timerEl.hidden = false;
      shotBtn.disabled = true;     // the display is already claimed by the take
    } else {
      recBtn.innerHTML = `${DOT}<span>Record screen</span>`;
      recBtn.title = 'Record your screen, a window, or a tab';
      timerEl.hidden = true;
      shotBtn.disabled = busy;
    }
    recBtn.disabled = busy;
    refreshCrop();
  };
  render();

  // A denial is the normal, expected answer to a screen-share prompt - the user changed
  // their mind at the picker. Say so plainly and leave the tool exactly as it was.
  const reportFailure = (e: unknown, what: string): void => {
    if (disposed) return;
    const name = (e as { name?: string })?.name;
    announce(
      name === 'NotAllowedError' ? 'Screen sharing was cancelled.'
      : name === 'NotFoundError' ? 'No screen was available to capture.'
      : name === 'NotReadableError' ? 'Your screen could not be read - another app may be blocking capture.'
      : `Couldn’t ${what}.`, { assertive: true });
    host.log('warn', `screencap: ${what} failed`, { error: String(e) });
  };

  // ── Live preview of the take ────────────────────────────────────────────────
  // The recorder publishes its stream on the shell-internal channel (the engine is
  // DOM-free), so mirror it into the canvas placeholder while recording - otherwise a
  // screen take is completely blind: the shared surface is usually BEHIND this window.
  let previewVideo: HTMLVideoElement | null = null;
  const previewHost = (): HTMLElement =>
    (stageEl.querySelector('[data-screen-preview]') as HTMLElement | null) ?? stageEl;
  const previewUnsub = subscribeRecordPreview((stream) => {
    if (disposed) return;
    if (stream) {
      if (!previewVideo) {
        previewVideo = document.createElement('video');
        previewVideo.className = 'canvas-record-viewfinder canvas-screen-preview';
        previewVideo.autoplay = true; previewVideo.muted = true; previewVideo.playsInline = true;
        previewVideo.style.objectFit = 'contain';   // a screen must never be cropped to fit
        previewVideo.setAttribute('data-export-hide', '');
        previewHost().appendChild(previewVideo);
      }
      previewVideo.srcObject = stream;
      void previewVideo.play?.().catch(() => { /* muted inline autoplay */ });
    } else {
      if (previewVideo) {
        previewVideo.srcObject = null;
        previewVideo.remove();
        previewVideo = null;
      }
      // The browser's own "Stop sharing" bar (or the OS) ends the source without touching
      // our Stop button: the recorder finalises the clip, but the control would sit stuck
      // in 'recording' - timer running forever, footage never offered, lost on navigate.
      // Finalise the take here. The `!busy` guard distinguishes this external end from the
      // null emit our own stop() also triggers (stop() sets busy=true before awaiting), so
      // we never re-enter the normal Stop path.
      if (state === 'recording' && !busy) void stop();
    }
  });
  // The template rebuilds #tool-content on every paint, orphaning the preview - re-adopt
  // it into the freshest placeholder (same trick as record-control's camera).
  const reparent = (): void => {
    const h = previewHost();
    if (h !== stageEl && previewVideo && previewVideo.parentElement !== h) h.appendChild(previewVideo);
  };
  const observer = new MutationObserver(reparent);
  observer.observe(stageEl, { childList: true, subtree: true });

  const boolInput = (id: string, fallback: boolean): boolean => {
    const v = runtime.getModel().find(i => i.id === id)?.value;
    return typeof v === 'boolean' ? v : fallback;
  };

  // ── Crop model + export-size sync ─────────────────────────────────────────────
  // The shot is stored intact and never resampled. `crop` is four numbers (percent
  // of the shot). On capture and on every crop change we push the crop's NATURAL
  // pixel size into the export bar (actionsApi.setDims); because the tool declares
  // render.width/height 7680x4320, previewScale stays 1 and the export draw is an
  // identity blit at the crop's true pixel count.
  const FULL = { x: 0, y: 0, w: 100, h: 100 };

  const shotRef = () => runtime.getModel().find(i => i.id === 'shot')?.value as
    { id?: string; url?: string; width?: number; height?: number } | undefined;

  const cropVal = () => {
    const v = runtime.getModel().find(i => i.id === 'crop')?.value as Record<string, number> | undefined;
    const n = (k: keyof typeof FULL) => (Number.isFinite(Number(v?.[k])) ? Number(v![k]) : FULL[k]);
    return { x: n('x'), y: n('y'), w: n('w'), h: n('h') };
  };

  /** The crop's true pixel size, or null when the shot has no usable dimensions. */
  function derivedTarget(): { width: number; height: number } | null {
    const s = shotRef();
    // readDimensions is best-effort - cropPixelSize returns null (never NaN/0) when absent.
    return cropPixelSize(cropVal(), Number(s?.width) || 0, Number(s?.height) || 0);
  }

  let lastPushed = '';
  function pushDims(): void {
    const t = derivedTarget();
    if (!t) return;                                   // dimensionless shot → leave the bar alone
    const key = `${shotRef()?.id ?? ''}|${t.width}x${t.height}`;
    if (key === lastPushed) return;                   // idempotent: kills thrash AND any re-entry
    lastPushed = key;
    actionsApi?.setDims?.({ width: t.width, height: t.height, unit: 'px' });
  }

  // Mount: if the URL explicitly sized the export, respect it - only PRIME the guard.
  // Otherwise (session restore, fresh mount with a shot) push so the bar matches the crop.
  if (sizeExplicit) {
    const t = derivedTarget();
    if (t) lastPushed = `${shotRef()?.id ?? ''}|${t.width}x${t.height}`;
  } else {
    pushDims();
  }

  // ── Crop overlay: shell-owned, pointer-driven ─────────────────────────────────
  // Owned by the shell (not a template <script>) so a setDims-triggered
  // runTemplateScripts can't double-bind the drag handler, and so the tool never
  // reaches into shell-private vector markup. Drag rects are read as fractions of
  // the canvas's VISUAL rect, so fitCanvas's scale drops out (same reason
  // catalog.ts uses fractions).
  const cropLayer = document.createElement('div');
  cropLayer.className = 'canvas-crop-layer';
  cropLayer.setAttribute('data-export-hide', '');
  cropLayer.hidden = true;
  const cropBox = document.createElement('div');
  cropBox.className = 'canvas-crop-box';
  cropBox.hidden = true;
  cropLayer.appendChild(cropBox);
  stageEl.appendChild(cropLayer);

  // The crop layer can only sit over a live, dimensioned shot that isn't recording.
  const cropEnabled = (): boolean => state !== 'recording' && derivedTarget() !== null;

  function positionCropLayer(): void {
    if (!canvasEl) { cropLayer.hidden = true; return; }
    const on = cropEnabled();
    cropLayer.hidden = !on;
    cropLayer.style.pointerEvents = on ? 'auto' : 'none';
    if (!on) return;
    const cr = canvasEl.getBoundingClientRect();
    const sr = stageEl.getBoundingClientRect();
    cropLayer.style.left   = `${cr.left - sr.left}px`;
    cropLayer.style.top    = `${cr.top - sr.top}px`;
    cropLayer.style.width  = `${cr.width}px`;
    cropLayer.style.height = `${cr.height}px`;
  }
  refreshCrop = positionCropLayer;   // render() now hides/re-shows the layer on record state changes

  let dragging = false, activePointer = -1;
  let ax = 0, ay = 0;   // drag origin, in canvas-local px

  cropLayer.addEventListener('pointerdown', (e: PointerEvent) => {
    if (!canvasEl || !cropEnabled() || e.button !== 0) return;
    const r = canvasEl.getBoundingClientRect();
    ax = e.clientX - r.left; ay = e.clientY - r.top;
    dragging = true; activePointer = e.pointerId;
    try { cropLayer.setPointerCapture(e.pointerId); } catch { /* capture is best-effort */ }
    cropBox.hidden = false;
    cropBox.style.left = `${ax}px`; cropBox.style.top = `${ay}px`;
    cropBox.style.width = '0px'; cropBox.style.height = '0px';
    e.preventDefault();
  });

  cropLayer.addEventListener('pointermove', (e: PointerEvent) => {
    if (!dragging || !canvasEl) return;
    const r = canvasEl.getBoundingClientRect();
    const bx = e.clientX - r.left, by = e.clientY - r.top;
    cropBox.style.left = `${Math.min(ax, bx)}px`;
    cropBox.style.top = `${Math.min(ay, by)}px`;
    cropBox.style.width = `${Math.abs(bx - ax)}px`;
    cropBox.style.height = `${Math.abs(by - ay)}px`;
  });

  async function endDrag(e: PointerEvent): Promise<void> {
    if (!dragging || e.pointerId !== activePointer) return;
    dragging = false; activePointer = -1;
    try { cropLayer.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    cropBox.hidden = true;
    const s = shotRef();
    if (!canvasEl || !s) return;
    const nw = Number(s.width) || 0, nh = Number(s.height) || 0;
    if (!(nw > 0 && nh > 0)) return;

    const r = canvasEl.getBoundingClientRect();
    const bx = e.clientX - r.left, by = e.clientY - r.top;
    // Drag rect as 0..1 fractions of the canvas (== the CURRENT crop window).
    const drag = {
      x: Math.min(ax, bx) / r.width,  w: Math.abs(bx - ax) / r.width,
      y: Math.min(ay, by) / r.height, h: Math.abs(by - ay) / r.height,
    };
    const next = composeCropRect(cropVal(), drag, nw, nh);
    if (!next) return;                                 // a tap is not a crop
    // Fresh literal (not the named CropRect) so it satisfies the vector InputValue shape.
    await runtime.setInput('crop', { x: next.x, y: next.y, w: next.w, h: next.h });  // ONE call → ONE undo entry
    markSessionDirty();
  }
  cropLayer.addEventListener('pointerup', (e: PointerEvent) => { void endDrag(e); });
  cropLayer.addEventListener('pointercancel', (e: PointerEvent) => {
    if (e.pointerId === activePointer) { dragging = false; activePointer = -1; cropBox.hidden = true; }
  });

  // ── Reset-crop button ─────────────────────────────────────────────────────────
  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'canvas-screen-btn canvas-screen-reset';
  resetBtn.innerHTML = '<span>Reset crop</span>';
  resetBtn.title = 'Show the whole shot again';
  resetBtn.hidden = true;
  resetBtn.addEventListener('click', () => {
    void runtime.setInput('crop', { ...FULL });
    markSessionDirty();
  });
  bar.appendChild(resetBtn);

  const isCropped = (): boolean => {
    const c = cropVal();
    return c.x !== FULL.x || c.y !== FULL.y || c.w !== FULL.w || c.h !== FULL.h;
  };

  // ── ONE subscriber: drag, sidebar typing, URL deep-link, undo, session restore ──
  // Why this cannot loop: setDims → refreshCanvasPreview → the tool declares no
  // width/height inputs, so it takes the else branch (runTemplateScripts + onUrlSync)
  // and writes NOTHING to the model → no emit → the subscriber never re-fires. The
  // lastPushed guard makes it terminate in one pass even on a spurious emit.
  function syncFromModel(): void {
    pushDims();
    resetBtn.hidden = !isCropped();
    positionCropLayer();
  }
  syncFromModel();
  const unsubModel = runtime.subscribe(() => syncFromModel());
  // Re-place the overlay when the stage/canvas resizes (fit-to-window, sidebar toggle).
  const onResize = () => positionCropLayer();
  window.addEventListener('resize', onResize);

  // ── Screenshot ──────────────────────────────────────────────────────────────
  shotBtn.addEventListener('click', async () => {
    if (disposed || busy || state === 'recording') return;
    busy = true; render();
    announce('Choose what to capture.');
    try {
      const blob = await host.recorder!.still({ source: 'screen', type: 'image/png' });
      if (disposed) return;
      const prev = runtime.getModel().find(i => i.id === 'shot')?.value as { id?: string; url?: string } | undefined;
      // Sign the still at capture time as an on-device screen capture, so the file
      // self-asserts what it is and chains as a credentialed ingredient once placed.
      // Never throws - a stamping hiccup returns the original bytes.
      const { stampCaptureClip } = await import('../bridge/export.ts');
      if (disposed) return;
      const { blob: png, credential } = await stampCaptureClip(host, blob, 'png', { screen: true });
      if (disposed) return;
      // Persist as a durable user asset: a blob: URL dies on navigation, so a saved
      // session would otherwise reopen with an empty canvas.
      let ref: AssetRef;
      try {
        ref = await storeRecordingAsset(
          host as unknown as Parameters<typeof storeRecordingAsset>[0], png, 'png', prev?.id, credential ?? undefined,
        );
      } catch (e) {
        if (disposed) return;
        host.log('warn', 'screencap: could not persist the shot - using an in-memory image', { error: String(e) });
        ref = { source: 'user', id: 'screenshot.png', type: 'raster', format: 'png', url: URL.createObjectURL(png), meta: { bytes: png.size } };
      }
      if (disposed) return;
      if (prev?.url?.startsWith('blob:') && String(prev.id).startsWith('screenshot.')) URL.revokeObjectURL(prev.url);
      await runtime.setInput('shot', ref);
      if (disposed) return;
      await runtime.setInput('crop', { ...FULL });   // a new shot invalidates the old crop region
      if (disposed) return;
      markSessionDirty();
      // getDisplayMedia may hand back a DPR-scaled or tab-capped surface - report
      // what actually arrived, never a guess.
      const t = derivedTarget();
      announce(`Screenshot captured${t ? ` at ${t.width}×${t.height}` : ''} (${fmtBytes(png.size)}) - drag on the canvas to crop, then export.`);
    } catch (e) {
      reportFailure(e, 'take the screenshot');
    } finally {
      busy = false; render();
    }
  });

  // ── Recording ───────────────────────────────────────────────────────────────
  let cappedWarned = false;
  const tick = (): void => {
    if (disposed || state !== 'recording') return;
    const el = performance.now() - startTs;
    const remaining = MAX_MS - el;
    timerEl.textContent = fmt(el);
    const ending = remaining <= 10000 && remaining > 0;
    timerEl.classList.toggle('is-ending', ending);
    if (!ending) cappedWarned = false;
    else if (!cappedWarned) { cappedWarned = true; announce(`Recording stops in ${Math.ceil(remaining / 1000)} seconds.`, { assertive: true }); }
    if (el >= MAX_MS) { void stop(); return; }
    timerRaf = requestAnimationFrame(tick);
  };

  async function begin(): Promise<void> {
    busy = true; render();
    announce('Choose what to record.');
    try {
      const wantMic = boolInput('micNarration', false);
      const opts: RecordOpts = {
        source: 'screen',
        video: true,
        audio: wantMic,
        systemAudio: boolInput('systemAudio', true),
        format: 'mp4',
        maxMs: MAX_MS,
      };
      const res = await runtime.startRecording(opts);
      if (disposed) return;
      if (!res.started) { busy = false; render(); return; }
      state = 'recording'; startTs = performance.now();
      busy = false; render();
      timerRaf = requestAnimationFrame(tick);
      // If the user asked to narrate but the mic was blocked, the take records silently.
      // Say so NOW, at the start - otherwise they narrate a whole take that has no voice.
      if (wantMic && res.micActive === false) {
        announce('Recording started, but your microphone is blocked, so there’s no narration. Allow mic access and record again for a voiceover.', { assertive: true });
      } else {
        announce('Screen recording started.');
      }
    } catch (e) {
      if (disposed) return;
      reportFailure(e, 'start recording');
      state = 'idle'; busy = false; render();
    }
  }

  async function stop(): Promise<void> {
    if (disposed || busy || state !== 'recording') return;
    if (timerRaf) cancelAnimationFrame(timerRaf);
    busy = true; render();
    let res: { blob: Blob; mimeType: string; micActive?: boolean } | null = null;
    try { res = await runtime.stopRecording(); }
    catch (e) { host.log('warn', 'screencap: stopRecording failed', { error: String(e) }); }
    if (disposed) return;
    state = 'idle'; render();
    try {
      if (res && res.blob.size > 0) await offerClip(res.blob, res.mimeType, res.micActive);
      else if (res) announce('That recording was too short to save - try again.', { assertive: true });
    } catch (e) { reportFailure(e, 'finish the recording'); }
    finally { busy = false; render(); }
  }

  recBtn.addEventListener('click', () => {
    if (disposed || busy) return;
    if (state === 'recording') { void stop(); return; }
    if (!busy) void begin();
  });

  // The finished clip goes back through the TRANSFORM path (host.export.file): the bytes
  // the encoder produced, unwatermarked and never re-encoded. Cropping a recording would
  // mean re-rasterising every frame - the stills path is where crop lives.
  let dlBar: HTMLElement | null = null;
  let dlUrl: string | null = null;
  async function offerClip(blob: Blob, mimeType: string, micActive?: boolean): Promise<void> {
    const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
    // Sign the take as an on-device screen capture - same provenance the still gets. The
    // mic flag reflects what was ACTUALLY captured (micActive from the recorder), not the
    // "Narrate" checkbox: a requested-but-denied mic records a silent take, and the signed
    // manifest must never claim narration that isn't there. Undefined (older path) falls
    // back to the checkbox.
    const micGot = micActive ?? boolInput('micNarration', false);
    const { stampCaptureClip } = await import('../bridge/export.ts');
    if (disposed) return;
    const { blob: clip } = await stampCaptureClip(host, blob, ext, { screen: true, microphone: micGot });
    if (disposed) return;

    dlBar?.remove();
    if (dlUrl) { URL.revokeObjectURL(dlUrl); dlUrl = null; }
    dlBar = document.createElement('div');
    dlBar.className = 'canvas-audio-dl';   // shares the post-capture bar styling with the voice recorder
    dlBar.setAttribute('data-export-hide', '');
    const player = document.createElement('video');
    player.controls = true;
    player.playsInline = true;
    dlUrl = URL.createObjectURL(clip);
    player.src = dlUrl;
    const actions = document.createElement('div');
    actions.className = 'canvas-audio-dl-actions';
    const saveBtn = Object.assign(document.createElement('button'), {
      type: 'button', className: 'btn-go', textContent: `Save .${ext} · ${fmtBytes(clip.size)}`,
    });
    const xBtn = Object.assign(document.createElement('button'), {
      type: 'button', className: 'canvas-audio-dl-x', title: 'Dismiss', textContent: '✕',
    });
    xBtn.setAttribute('aria-label', 'Dismiss');
    actions.append(saveBtn, xBtn);
    dlBar.append(player, actions);
    stageEl.appendChild(dlBar);

    const title = String(runtime.getModel().find(i => i.id === 'title')?.value || 'screen-recording').trim() || 'screen-recording';
    const base = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'screen-recording';
    saveBtn.addEventListener('click', () => { void host.export.file(clip, { filename: `${base}.${ext}` }); });
    xBtn.addEventListener('click', () => {
      dlBar?.remove(); dlBar = null;
      if (dlUrl) { URL.revokeObjectURL(dlUrl); dlUrl = null; }
    });
    announce(`Recording ready (${fmtBytes(clip.size)}) - save it from the bar below the canvas.`);
  }

  (stageEl as HTMLElement & { _recordCleanup?: () => void })._recordCleanup = () => {
    if (disposed) return;
    disposed = true;
    runtime.cancelRecording();
    if (timerRaf) cancelAnimationFrame(timerRaf);
    observer.disconnect();
    unsubModel();
    window.removeEventListener('resize', onResize);
    if (activePointer !== -1) { try { cropLayer.releasePointerCapture(activePointer); } catch { /* gone */ } }
    cropLayer.remove();
    previewUnsub();
    if (previewVideo) { previewVideo.srcObject = null; previewVideo.remove(); previewVideo = null; }
    dlBar?.remove();
    if (dlUrl) { URL.revokeObjectURL(dlUrl); dlUrl = null; }
    const shot = runtime.getModel().find(i => i.id === 'shot')?.value as { id?: string; url?: string } | undefined;
    if (shot?.url?.startsWith('blob:') && String(shot.id).startsWith('screenshot.')) URL.revokeObjectURL(shot.url);
  };
}
