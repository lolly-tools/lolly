// SPDX-License-Identifier: MPL-2.0
// Device recording control - the Record button + framing viewfinder + coaching HUD +
// live self-view + timer + capture-session orchestration for a tool declaring
// render.capture. Extracted verbatim from tool.ts: a self-contained, module-level
// subsystem that closes over only its param object plus these imports.
import { announce } from '../a11y.ts';
import { mountCoachHud, coachAudio, type CoachHud, type CoachTarget } from '../lib/audio-coaching.ts';
import { frameLuma, coachVideo } from '../lib/video-coach-core.ts';
import { subscribeRecordPreview } from '../lib/record-preview.ts';
import { mountRecordingHelp, createTipFlasher, type RecordingHelp } from '../lib/recording-tips.ts';
import { setAudioTake, saveTakeMp3, saveTakeNative } from '../lib/audio-take.ts';
import { storeRecordingAsset } from './picker.ts';
import { fmtBytes } from '../lib/device-info.ts';
import { icon } from '../lib/icons.ts';
import type { AssetRef, RecordOpts } from '@lolly-tools/core/host-v1';
import type { ToolRuntime, WebToolHost } from './tool.ts';

/**
 * Device recording control (engine v1.17). Mounts a Record button on the stage for a
 * tool declaring render.capture, where the shell exposes host.recorder.
 *   - audio: first tap ARMS the mic (a level sound-check via the tool's onLevel hook,
 *     which the runtime drives) → tap again to record → Stop → offer MP3 / native save.
 *   - video: a host.media viewfinder for FRAMING (shell-drawn, no onFrame hook) → tap
 *     Record to capture camera+mic → the finished clip becomes the top-&-tail
 *     compositor's `clip` input, which the render wraps with the intro/outro bookends.
 * The runtime owns startMeter/startRecording/stopRecording; this only drives the UI.
 */
export function setupRecordControl({ stageEl, runtime, host, mode, markSessionDirty }: {
  stageEl: HTMLElement; runtime: ToolRuntime; host: WebToolHost; mode: 'audio' | 'video' | 'av'; markSessionDirty: () => void;
}): void {
  let disposed = false;
  const isAudio = mode === 'audio';
  const wantAudio = mode !== 'video'; // 'audio' + 'av' capture the mic; 'video' is camera-only
  const wantVideo = mode !== 'audio';
  const MAX_MS = isAudio ? 10 * 60 * 1000 : 60 * 1000; // 10 min audio / 1 min video

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'canvas-record-btn';
  const timerEl = document.createElement('span');
  timerEl.className = 'canvas-record-timer';
  timerEl.hidden = true;
  stageEl.appendChild(btn);
  stageEl.appendChild(timerEl);
  // Marks a capture-tool stage so its overlay text can size to the canvas (a scoped
  // container context - see .tool-stage.has-record in tool.css).
  stageEl.classList.add('has-record');

  // Where the live camera view mounts. An EDITOR-layout record tool (the `record`
  // tool) renders a [data-record-camera] placeholder in its MIDDLE frame, so the
  // viewfinder / self-view sit inside that frame - inheriting its pan/zoom/fit - rather
  // than covering the whole stage. Plain capture tools (top-tail-recorder) have no
  // placeholder → the camera falls back to a full-stage overlay, unchanged. The
  // placeholder is re-created on every editor re-render (contentEl.innerHTML rebuild),
  // so it's resolved fresh each time; a MutationObserver (wired below, once the camera
  // elements exist) re-parents them into the newest placeholder after each paint.
  const cameraHost = (): HTMLElement =>
    (stageEl.querySelector('[data-record-camera]') as HTMLElement | null) ?? stageEl;

  // Flip-camera control - offered only where a rear camera is the point: a touch device
  // recording video/av. Sets `facingMode` for the framing viewfinder AND the next take.
  let facingMode: 'user' | 'environment' = 'user';
  const canFlip = wantVideo && !!host.media?.isAvailable?.() && matchMedia('(pointer: coarse)').matches;
  const flipBtn = document.createElement('button');
  flipBtn.type = 'button';
  flipBtn.className = 'canvas-record-flip';
  flipBtn.title = 'Flip camera';
  flipBtn.setAttribute('aria-label', 'Flip camera');
  flipBtn.hidden = true;
  flipBtn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 0 1-9 9 9 9 0 0 1-6.7-3M3 12a9 9 0 0 1 9-9 9 9 0 0 1 6.7 3"/><path d="M18 3v3h-3M6 21v-3h3"/></svg>';
  if (canFlip) {
    stageEl.appendChild(flipBtn);
    flipBtn.addEventListener('click', () => {
      if (disposed || btn.disabled) return;
      facingMode = facingMode === 'user' ? 'environment' : 'user';
      if (viewfinder) { stopViewfinder(); void startViewfinder(); }   // re-frame with the new camera
      announce(facingMode === 'environment' ? 'Rear camera' : 'Front camera');
    });
  }

  // Choose-mic control (device picker) - offered where this take captures audio.
  // The chosen mic feeds BOTH the sound-check meter and the take (the pairing).
  let micDeviceId: string | null = null;
  const micBtn = document.createElement('button');
  micBtn.type = 'button';
  micBtn.className = 'canvas-record-mic';
  micBtn.title = 'Choose microphone';
  micBtn.setAttribute('aria-label', 'Choose microphone');
  micBtn.hidden = true;
  micBtn.innerHTML = icon('mic', { size: 18 });
  if (wantAudio && host.recorder) {
    stageEl.appendChild(micBtn);
    micBtn.addEventListener('click', async () => {
      if (disposed || btn.disabled) return;
      const { openDevicePicker } = await import('../components/device-picker.ts');
      if (disposed) return;
      const pick = await openDevicePicker({ kind: 'audioinput', currentMicId: micDeviceId ?? undefined, title: 'Choose a microphone' });
      if (!pick || disposed) return;
      micDeviceId = pick.deviceId;
      // If a sound-check meter is already running, restart it on the new mic so the
      // levels match what the take will record.
      if (state === 'armed') { try { runtime.stopMeter(); await runtime.startMeter({ deviceId: micDeviceId }); } catch { /* ignore */ } }
      if (!disposed) announce('Microphone changed');
    });
  }

  // Always-available "?" tips panel on the stage (both audio + video capture tools).
  // A video/av tool also gets the lighting tips (too dark / too bright / backlit).
  const help: RecordingHelp = mountRecordingHelp(stageEl, { video: wantVideo });

  // Proactive coaching: watch the same sound-check meter the HUD/onLevel use and flash
  // the relevant tip when a condition persists (debounced + cooled-down, so it nudges
  // rather than nags). The meter only emits while armed/recording; for audio it's the
  // arm/sound-check window (startRecording swaps to the record session), for video/av it
  // stays open through the take. Honours the tool's "Coaching tips" toggle where present.
  const flasher = createTipFlasher(help.flash);
  let flashUnsub: (() => void) | null = null;
  if (host.recorder) {
    // A red (hot) meter held this long = a CONSTANT loud source - a fan / AC / air blowing
    // on the mic - not speech's brief peaks (speech dips between syllables and resets it).
    const RED_SUSTAIN_MS = 2000, FAN_COOLDOWN_MS = 12000;
    let redSince = 0, fanFlashedAt = -Infinity;
    flashUnsub = host.recorder.meter.subscribe((level) => {
      const model = runtime.getModel();
      if (model.find((i) => i.id === 'showTips')?.value === false) { flasher.reset(); redSince = 0; return; }
      const target = (model.find((i) => i.id === 'targetLevel')?.value as CoachTarget) || 'normal';
      const coaching = coachAudio(level, { target, phase: coachPhase });
      const now = performance.now();
      if (coaching.tone === 'hot') {
        redSince = redSince || now;
        if (now - redSince >= RED_SUSTAIN_MS && now - fanFlashedAt >= FAN_COOLDOWN_MS) {
          fanFlashedAt = now; flasher.reset(); help.flash('fan');
        }
        return;  // while red, the fan tracker owns coaching - don't also push the generic cue
      }
      redSince = 0;
      flasher.push(coaching.cue);
    });
  }

  const DOT = '<span class="canvas-record-dot" aria-hidden="true"></span>';
  const SQUARE = '<span class="canvas-record-square" aria-hidden="true"></span>';
  let state: 'idle' | 'armed' | 'recording' = 'idle';
  let startTs = 0, timerRaf = 0;

  const fmt = (ms: number): string => {
    const s = Math.max(0, Math.floor(ms / 1000));
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };
  // The FIRST tap warms the capture device (mic sound-check / camera framing) rather than
  // recording - so the idle button says so plainly instead of a misleading "Record". Once
  // warmed (armed), the next tap records. If this tool/shell can't arm (no level hook / no
  // camera), the first tap records directly, so it just says "Record".
  const warmLabel = isAudio ? 'Warm the mic' : (wantAudio ? 'Warm the camera and mic' : 'Warm the camera');
  const willArm = (): boolean => (isAudio ? runtime.hasLevelHook : !!host.media?.isAvailable?.());
  const render = (): void => {
    if (disposed) return;
    btn.dataset.state = state;
    btn.setAttribute('aria-pressed', String(state === 'recording'));
    stageEl.classList.toggle('is-recording', state === 'recording');
    if (state === 'recording') { btn.innerHTML = `${SQUARE}<span>Stop</span>`; btn.title = 'Stop recording'; timerEl.hidden = false; }
    else if (state === 'armed') { btn.innerHTML = `${DOT}<span>Record</span>`; btn.title = isAudio ? 'Mic live - tap to record' : 'Framing - tap to record'; timerEl.hidden = true; }
    else {
      const warm = willArm();
      btn.innerHTML = `${DOT}<span>${warm ? warmLabel : 'Record'}</span>`;
      btn.title = warm ? `${warmLabel} - check your levels, then record` : 'Record';
      timerEl.hidden = true;
    }
    if (canFlip) flipBtn.hidden = state === 'recording';   // can't switch cameras mid-take
    if (wantAudio && host.recorder) micBtn.hidden = state === 'recording'; // can't switch mics mid-take
  };
  render();

  // While awaiting getUserMedia (arm/begin) a slow permission prompt would otherwise
  // leave the button disabled and unlabelled - a dead UI. Show a transient "Starting…"
  // affordance (and announce it) until the try/catch settles and render() restores state.
  const showStarting = (): void => {
    btn.disabled = true;
    btn.innerHTML = `${DOT}<span>Starting…</span>`;
    btn.title = 'Starting…';
    announce('Starting…');
  };

  // Exposure-coaching state. Declared up here (ahead of the self-view section, whose
  // subscribeRecordPreview fires synchronously) so the sampler it may start never reads a
  // `let`/`const` still in its temporal dead zone. The rest of the coaching wiring - the
  // HUD, feedExposure, the sampler loop - lives in the coaching section below.
  const wantExposure = wantVideo && !!host.media?.isAvailable?.(); // exposure coaching available?
  let sampCanvas: HTMLCanvasElement | null = null;                 // offscreen sampler for the take self-view
  let sampRaf = 0, sampAt = 0;

  // ── Video framing viewfinder (shell-drawn from host.media; no onFrame hook) ──
  let viewfinder: HTMLCanvasElement | null = null;
  let vfUnsub: (() => void) | null = null;
  let vfGeneration = 0, vfStarting = false;
  async function startViewfinder(): Promise<void> {
    const media = host.media;
    if (disposed || isAudio || !media?.isAvailable?.() || vfUnsub || vfStarting) return;
    const generation = ++vfGeneration;
    vfStarting = true;
    try { await media.start({ facingMode }); }
    catch { return; /* denied - record still works, just no live view */ }
    finally { if (generation === vfGeneration) vfStarting = false; }
    if (disposed || generation !== vfGeneration) {
      try { media.stop(); } catch { /* release this late acquisition */ }
      return;
    }
    viewfinder = document.createElement('canvas');
    viewfinder.className = 'canvas-record-viewfinder';
    viewfinder.setAttribute('data-export-hide', '');
    cameraHost().appendChild(viewfinder);
    const vctx = viewfinder.getContext('2d');
    vfUnsub = media.subscribe((frame) => {
      if (disposed || generation !== vfGeneration || !viewfinder || !vctx) return;
      if (viewfinder.width !== frame.width) viewfinder.width = frame.width;
      if (viewfinder.height !== frame.height) viewfinder.height = frame.height;
      vctx.putImageData(new ImageData(frame.data.slice(), frame.width, frame.height), 0, 0);
      // Exposure coaching off the live framing frame (RGBA already in hand - no readback).
      feedExposure(frame.data, frame.width, frame.height);
    }, { maxEdge: 640 });
  }
  function stopViewfinder(): void {
    ++vfGeneration;
    vfStarting = false;
    if (vfUnsub) { vfUnsub(); vfUnsub = null; try { host.media?.stop(); } catch { /* ignore */ } }
    viewfinder?.remove(); viewfinder = null;
    // Framing has ended (flip / begin) - clear any lingering exposure warning; the take's
    // self-view sampler takes over from here.
    coachHud?.updateExposure({ tone: 'ok', warning: '', cue: null });
    exposureFlasher.reset();
  }

  // ── Live self-view during the take ──────────────────────────────────────────
  // Once recording starts the framing viewfinder is torn down so the recorder can open
  // its own stream - leaving the take "blind". The recorder publishes that stream via a
  // shell-internal channel (record-preview.ts, since the engine is DOM-free); mirror it
  // into a <video> so the user keeps seeing themselves. Cleared when the take ends.
  let previewVideo: HTMLVideoElement | null = null;
  const previewUnsub = subscribeRecordPreview((stream) => {
    if (disposed) return;
    if (stream && !isAudio) {
      if (!previewVideo) {
        previewVideo = document.createElement('video');
        previewVideo.className = 'canvas-record-viewfinder';   // same placement as the framing view
        previewVideo.autoplay = true; previewVideo.muted = true; previewVideo.playsInline = true;
        previewVideo.style.objectFit = 'cover';
        previewVideo.setAttribute('data-export-hide', '');
        cameraHost().appendChild(previewVideo);
      }
      previewVideo.srcObject = stream;
      void previewVideo.play?.().catch(() => { /* autoplay policy - muted inline should be fine */ });
      startExposureSampler();   // keep exposure coaching live through the take (framing view is gone)
    } else if (previewVideo) {
      stopExposureSampler();
      previewVideo.srcObject = null;
      previewVideo.remove();
      previewVideo = null;
    }
  });

  // Keep the camera elements inside the middle-frame placeholder across editor
  // re-renders. contentEl.innerHTML is rebuilt on every paint, orphaning whatever the
  // viewfinder / self-view were parented into; on each rebuilt paint, re-adopt them into
  // the fresh placeholder. No-op for non-editor capture tools (cameraHost() === stageEl,
  // which is never rebuilt). Cheap: a couple of parent checks per paint.
  const reparentCamera = (): void => {
    const camHost = cameraHost();
    if (camHost === stageEl) return;                       // no placeholder → nothing to re-home
    if (viewfinder && viewfinder.parentElement !== camHost) camHost.appendChild(viewfinder);
    if (previewVideo && previewVideo.parentElement !== camHost) camHost.appendChild(previewVideo);
  };
  const cameraObserver = new MutationObserver(reparentCamera);
  cameraObserver.observe(stageEl, { childList: true, subtree: true });

  // ── Coaching HUD (video/av capture): audio levels + video exposure ──────────
  // An audio tool renders its own meter in the template (onLevel); a video/av tool's
  // canvas shows the composited bookends, so the shell draws a level+warning HUD over
  // the viewfinder instead. It carries two rows:
  //   • audio - fed by the raw sound-check meter (levels + noiseFloor/hum/hiss), live
  //     from arm through the take;
  //   • exposure - fed by the live camera frames (too dark / too bright / overexposed),
  //     off the framing viewfinder while arming and off the self-view during the take.
  const wantCoach = wantAudio && !isAudio && !!host.recorder;   // audio-level coaching (wantExposure hoisted above)
  const coachTarget: CoachTarget = 'normal';
  let coachHud: CoachHud | null = null;
  let coachUnsub: (() => void) | null = null;
  let coachPhase: 'check' | 'record' = 'check';
  let coachMeterOn = false;
  // Create the HUD once, shared by both channels. Audio row is included only when the
  // tool captures the mic; a video-only tool shows just the exposure row.
  const ensureCoachHud = (): CoachHud => (coachHud ??= mountCoachHud(stageEl, { audio: wantCoach }));

  // Exposure: a dwell/cooldown flasher for the lighting tips, plus an offscreen canvas to
  // sample the take's self-view <video> (the framing viewfinder is torn down once recording
  // starts, so its RGBA frames stop arriving).
  const exposureFlasher = createTipFlasher(help.flash, { dwellMs: 1800 });
  function feedExposure(data: Uint8ClampedArray, w: number, h: number): void {
    if (!wantExposure) return;
    const v = coachVideo(frameLuma(data, w, h));
    ensureCoachHud().updateExposure(v);
    // Honour the tool's "Coaching tips" toggle for the flash nudge (the HUD chip stays).
    if (runtime.getModel().find((i) => i.id === 'showTips')?.value === false) { exposureFlasher.reset(); return; }
    exposureFlasher.push(v.cue);
  }
  function startExposureSampler(): void {
    if (!wantExposure || sampRaf) return;
    sampCanvas ??= document.createElement('canvas');
    const sctx = sampCanvas.getContext('2d', { willReadFrequently: true });
    const loop = (): void => {
      sampRaf = requestAnimationFrame(loop);
      const now = performance.now();
      if (now - sampAt < 220) return;              // ~4–5 Hz is plenty for exposure
      const vid = previewVideo;
      if (!sctx || !vid || vid.readyState < 2) return;
      const vw = vid.videoWidth, vh = vid.videoHeight;
      if (!vw || !vh) return;
      sampAt = now;
      const scale = Math.min(1, 160 / Math.max(vw, vh));  // downscale - exposure needs no detail
      const w = Math.max(1, Math.round(vw * scale)), h = Math.max(1, Math.round(vh * scale));
      if (sampCanvas!.width !== w) sampCanvas!.width = w;
      if (sampCanvas!.height !== h) sampCanvas!.height = h;
      try {
        sctx.drawImage(vid, 0, 0, w, h);
        feedExposure(sctx.getImageData(0, 0, w, h).data, w, h);
      } catch { /* frame not paintable yet - try next tick */ }
    };
    sampRaf = requestAnimationFrame(loop);
  }
  function stopExposureSampler(): void { if (sampRaf) { cancelAnimationFrame(sampRaf); sampRaf = 0; } sampAt = 0; }

  let coachGeneration = 0, coachStarting = false;
  async function startCoach(): Promise<void> {
    if (disposed || !wantCoach || coachMeterOn || coachStarting) return;
    const generation = ++coachGeneration;
    coachStarting = true;
    try {
      await host.recorder!.meter.start(); // raw sound-check stream (kept open through the take)
      if (disposed || generation !== coachGeneration) {
        try { host.recorder!.meter.stop(); } catch { /* release this late acquisition */ }
        return;
      }
      coachMeterOn = true;
      ensureCoachHud();
      coachUnsub = host.recorder!.meter.subscribe((level) => {
        coachHud?.updateAudio(level, { target: coachTarget, phase: coachPhase });
      });
    } catch { /* mic denied - the take can still proceed, just without coaching */ }
    finally { if (generation === coachGeneration) coachStarting = false; }
  }
  function stopCoach(): void {
    ++coachGeneration;
    coachStarting = false;
    if (coachUnsub) { coachUnsub(); coachUnsub = null; }
    stopExposureSampler();
    exposureFlasher.reset();
    coachHud?.destroy(); coachHud = null;
    if (coachMeterOn) { try { host.recorder?.meter.stop(); } catch { /* ignore */ } coachMeterOn = false; }
    coachPhase = 'check';
  }

  let cappedWarned = false;
  const tick = (): void => {
    if (disposed || state !== 'recording') return;
    const el = performance.now() - startTs;
    const remaining = MAX_MS - el;
    timerEl.textContent = fmt(el);
    // Warn (visibly + for screen readers) as the hard cap nears, so the auto-stop
    // at MAX_MS isn't a surprise mid-sentence.
    const ending = remaining <= 5000 && remaining > 0;
    timerEl.classList.toggle('is-ending', ending);
    if (!ending) cappedWarned = false;
    else if (!cappedWarned) { cappedWarned = true; announce(`Recording stops in ${Math.ceil(remaining / 1000)} seconds.`, { assertive: true }); }
    if (el >= MAX_MS) { void stop(); return; }
    timerRaf = requestAnimationFrame(tick);
  };

  async function begin(): Promise<void> {
    showStarting();
    stopViewfinder(); // free the camera before host.recorder opens its own A/V stream
    try {
      const opts: RecordOpts = {
        audio: wantAudio,
        video: wantVideo,
        format: wantVideo ? 'mp4' : 'webm',
        maxMs: MAX_MS,
        ...(wantVideo ? { maxEdge: 1280, facingMode } : {}),
        ...(wantAudio && micDeviceId ? { audioDeviceId: micDeviceId } : {}),
      };
      const result = await runtime.startRecording(opts);
      if (disposed) return;
      if (!result.started) { stopCoach(); state = 'idle'; render(); return; }
      coachPhase = 'record';     // switch the HUD from room-check to level coaching
      if (wantCoach) await startCoach(); // in case recording began without an arm (framing) step
      if (disposed) return;
      state = 'recording'; startTs = performance.now(); render();
      timerRaf = requestAnimationFrame(tick);
      announce(isAudio ? 'Recording started' : 'Video recording started');
    } catch (e) {
      if (disposed) return;
      const name = (e as { name?: string })?.name;
      const dev = isAudio ? 'microphone' : (wantAudio ? 'camera or microphone' : 'camera');
      announce(
        name === 'NotAllowedError' ? (isAudio ? 'Microphone permission was declined.' : 'Camera or microphone permission was declined.')
        : name === 'NotFoundError' ? `No ${dev} found.`
        : name === 'NotReadableError' ? `Your ${dev} is in use by another app.`
        : 'Couldn’t start recording.', { assertive: true });
      host.log('warn', 'startRecording failed', { error: String(e) });
      stopCoach();   // release the sound-check mic + HUD so a failed take never leaves them live
      state = 'idle'; render();
    } finally { if (!disposed) btn.disabled = false; }
  }

  async function stop(): Promise<void> {
    if (disposed || state !== 'recording' || btn.disabled) return;
    if (timerRaf) cancelAnimationFrame(timerRaf);
    // Measured take length - the one reliable duration source. A fresh MediaRecorder blob
    // often reports duration=Infinity/0, so we hand this to the compositor as a fallback.
    const takeMs = startTs ? performance.now() - startTs : 0;
    btn.disabled = true;
    let res: { blob: Blob; mimeType: string; micActive?: boolean } | null = null;
    try { res = await runtime.stopRecording(); }
    catch (e) { host.log('warn', 'stopRecording failed', { error: String(e) }); }
    if (disposed) return;
    stopCoach();   // release the sound-check mic + drop the HUD when the take ends
    state = 'idle'; render();
    try {
      if (res && res.blob.size > 0) await handleClip(res.blob, res.mimeType, takeMs, res.micActive);
      else if (res) announce('That recording was too short to save - try again.', { assertive: true });
      // Rearm only while this control still owns the tool, after processing the take.
      if (!disposed && isAudio && runtime.hasLevelHook) {
        coachPhase = 'check';
        const started = await runtime.startMeter(micDeviceId ? { deviceId: micDeviceId } : undefined);
        if (!disposed && started) { state = 'armed'; render(); }
      }
    } catch (e) {
      if (!disposed) { host.log('warn', 'record: finish failed', { error: String(e) }); announce('Couldn’t finish the recording.', { assertive: true }); }
    } finally { if (!disposed) btn.disabled = false; }
  }

  // First tap ARMS (audio: mic sound-check; video: camera framing) - so the camera /
  // mic only opens on an explicit tap, never just from opening the tool. Second tap
  // records.
  async function arm(): Promise<void> {
    showStarting();
    try {
      if (isAudio) {
        coachPhase = 'check';   // arming an audio take is a sound check (room cues valid)
        const started = await runtime.startMeter(micDeviceId ? { deviceId: micDeviceId } : undefined);
        if (disposed) return;
        if (!started) { render(); return; }
        announce('Microphone live - check your levels, then tap Record');
      } else {
        await startViewfinder(); // no-op if the camera is denied; recording still works
        if (disposed) return;
        coachPhase = 'check';
        await startCoach();      // raw mic sound-check → level + background-noise HUD
        if (disposed) return;
        announce(wantCoach ? 'Camera framing + mic check - tap Record when you’re ready'
          : 'Camera framing - tap Record when you’re ready');
      }
      state = 'armed'; render();
    } catch (e) {
      if (disposed) return;
      const name = (e as { name?: string })?.name;
      const dev = isAudio ? 'microphone' : 'camera';
      announce(
        name === 'NotAllowedError' ? (isAudio ? 'Microphone permission was declined.' : 'Camera permission was declined.')
        : name === 'NotFoundError' ? `No ${dev} found.`
        : name === 'NotReadableError' ? `Your ${dev} is in use by another app.`
        : (isAudio ? 'Couldn’t access the microphone.' : 'Couldn’t access the camera.'), { assertive: true });
      host.log('warn', 'arm failed', { error: String(e) });
      render();   // restore the idle label after the transient "Starting…" (state stays 'idle')
    } finally { if (!disposed) btn.disabled = false; }
  }

  btn.addEventListener('click', () => {
    if (disposed || btn.disabled) return;
    if (state === 'recording') { void stop(); return; }
    // Audio arms only when the tool has a coaching hook; video always arms (framing).
    if (state === 'idle' && (isAudio ? runtime.hasLevelHook : host.media?.isAvailable?.())) { void arm(); return; }
    void begin();
  });

  async function handleClip(blob: Blob, mimeType: string, takeMs = 0, micActive?: boolean): Promise<void> {
    if (!isAudio) {
      // Video: the footage becomes the compositor's body clip (see export.renderRecord).
      const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
      const prevClip = runtime.getModel().find(i => i.id === 'clip')?.value as { id?: string; url?: string } | undefined;
      // Sign the take at capture time as a live camera+mic capture (IPTC digitalCapture,
      // on-device Lolly) so the clip file self-asserts AND, placed into the composition,
      // chains as a credentialed ingredient. Never throws - a stamping hiccup returns the
      // original bytes + a null credential, so a take is never lost.
      const { stampCaptureClip } = await import('../bridge/export.ts');
      if (disposed) return;
      const { blob: clip, credential } = await stampCaptureClip(host, blob, ext, { camera: true, microphone: micActive ?? wantAudio });
      if (disposed) return;
      // Persist the take as a DURABLE user asset so a SAVED session restores its footage
      // after a reload - a blob: URL dies on navigation and a bare `recording.mp4` id
      // can't be re-resolved, so before this the clip vanished from any reopened session.
      // storeRecordingAsset also retires the previous auto-recorded take (no orphan pile-up)
      // and stamps meta.bytes for the save/exit dialog. Fall back to an in-memory blob URL
      // if the store refuses (e.g. device quota), so a take is never lost.
      let ref: AssetRef;
      try {
        ref = await storeRecordingAsset(
          host as unknown as Parameters<typeof storeRecordingAsset>[0], clip, ext, prevClip?.id, credential ?? undefined,
        );
      } catch (e) {
        if (disposed) return;
        host.log('warn', 'record: could not persist clip - using an in-memory clip', { error: String(e) });
        ref = { source: 'user', id: `recording.${ext}`, type: 'video', format: ext, url: URL.createObjectURL(clip), meta: { bytes: clip.size } };
      }
      if (disposed) return;
      // Free the prior take's object URL only if it's OUR in-memory fallback (id
      // `recording.<ext>`, minted just above). Every other clip URL - a persisted
      // user/recording|upload/* or a library asset - is bridge-owned + cached, so
      // revoking it would break a later get() of the same asset; the store handles its
      // own eviction on delete.
      if (prevClip?.url?.startsWith('blob:') && String(prevClip.id).startsWith('recording.')) URL.revokeObjectURL(prevClip.url);
      await runtime.setInput('clip', ref);
      if (disposed) return;
      markSessionDirty();
      // An editable record stage ([data-record-camera] middle frame) auto-processes the
      // export the moment you stop - the tab is foreground and the clip is fresh, so the
      // real-time compositor runs cleanly. Other capture tools (top-tail-recorder) keep
      // the manual "export in the bar" flow.
      if (stageEl.querySelector('[data-record-camera]')) { await autoProcessRecording(ext, takeMs); return; }
      announce(`Clip captured (${fmtBytes(clip.size)}) - export to save your top-&-tail video.`);
      return;
    }
    // Audio: sign the take so the downloaded voice recording self-asserts as a live
    // mic capture - the SAME credential a video take gets. Every container a
    // MediaRecorder hands back here is one the engine embeds into: audio/webm (Opus in
    // Matroska), audio/mp4 (AAC → the m4a BMFF placer, which names the manifest
    // audio/mp4 rather than video/mp4), and audio/ogg (Ogg Opus, what Firefox writes - 
    // native support landed with the Ogg placer). captureContainer maps MIME → the
    // container key; null (an encoder we don't recognise) saves unsigned + logs, rather
    // than mislabelling the bytes.
    const { stampCaptureClip, captureContainer } = await import('../bridge/export.ts');
    if (disposed) return;
    const container = captureContainer(mimeType);
    let clip = blob;
    if (container) clip = (await stampCaptureClip(host, blob, container, { microphone: true })).blob;
    else host.log('warn', 'record: take saved without Content Credentials - no embedder for this container', { mimeType });
    if (disposed) return;
    // Publish the take so the export sheet's "Your recording" card offers the
    // same saves (lib/audio-take.ts) - the sheet otherwise only exports the card.
    setAudioTake({ blob: clip, mimeType, container: container ?? null });
    showAudioDownload(clip, mimeType, container);
  }

  // Wrap the fresh clip with the intro/outro on the spot: show a "processing" curtain,
  // let the template re-render with the clip + decode a frame, then run the record
  // compositor (renderRecord via runtime.export) and hand back the finished MP4.
  async function autoProcessRecording(ext: string, takeMs = 0): Promise<void> {
    if (disposed) return;
    if (!stageEl.querySelector('[data-record-stage]')) { announce('Clip captured - export to save your video.'); return; }
    const curtain = showProcessing();
    try {
      // CRITICAL: setInput('clip') repaints by rebuilding #tool-content's innerHTML, which
      // REPLACES the whole strip node. So we must grab the stage AFTER that paint lands and
      // re-query it live - capturing it up front (as this did before) hands renderRecord the
      // stale pre-clip strip with no [data-record-clip], and the export comes out as just the
      // intro+outro bookends. The paint is coalesced behind rAF (and the onInput hook can
      // schedule a second), so poll a few frames until the clip <video> actually appears.
      let recStage: HTMLElement | null = null;
      let clipVid: HTMLVideoElement | null = null;
      for (let i = 0; i < 20 && !clipVid; i++) {
        await new Promise<void>((r) => requestAnimationFrame(() => r()));
        if (disposed) return;
        recStage = stageEl.querySelector('[data-record-stage]') as HTMLElement | null;
        clipVid = (recStage?.querySelector('[data-record-clip]') as HTMLVideoElement | null) ?? null;
      }
      if (curtain.cancelled()) return;
      if (!recStage) { curtain.close(); announce('Clip captured - export to save your video.'); return; }
      // Hand the compositor the measured take length: a fresh MediaRecorder blob often
      // reports duration=Infinity/0, and without this renderRecord falls back to a blind
      // 6s and truncates a longer take (see export.ts renderRecord).
      if (clipVid && takeMs > 0) clipVid.dataset.clipMs = String(Math.round(takeMs));
      // Wait for a decoded frame so the clip's src is loadable before the compositor reads it.
      if (clipVid && clipVid.readyState < 2) {
        await new Promise<void>((res) => {
          const to = setTimeout(res, 5000);
          const done = (): void => { clearTimeout(to); res(); };
          clipVid!.addEventListener('loadeddata', done, { once: true });
          clipVid!.addEventListener('error', done, { once: true });
        });
      }
      if (curtain.cancelled()) return;
      const filename = (runtime.manifest?.name || 'Record').trim() || 'Record';
      // The curtain's Cancel stops the composite for real (ExportOpts.signal, engine
      // 1.141): renderRecord polls the signal on its rAF tick, so the encode ends and
      // the recorder is torn down instead of the run finishing unseen. We still stop
      // waiting on the same promise race, and the rejection is CAPTURED rather than
      // raced, so an aborted render can never surface as an unhandled rejection.
      const abort = new AbortController();
      void curtain.whenCancelled.then(() => abort.abort());
      let renderErr: unknown = null;
      const rendering = runtime.export(recStage, ext === 'webm' ? 'webm' : 'mp4', { signal: abort.signal })
        .catch((err: unknown) => { renderErr = err; return null; });
      const blob = await Promise.race([rendering, curtain.whenCancelled.then(() => null)]);
      if (disposed) return;
      if (curtain.cancelled()) {
        announce('Kept your recording - use the Export button when you are ready.');
        return;
      }
      if (renderErr) throw renderErr;
      // Never hand back an empty render - a 0-byte download reads as "broken" with no
      // clue. Surface it instead so the user can retry / use the manual Export button.
      if (!blob || blob.size < 1024) throw new Error(`empty render (${blob?.size ?? 0} bytes)`);
      await host.export.download(blob, `${filename}.${ext}`);
      if (disposed) return;
      markSessionDirty();
      announce(`Your video is ready - ${fmtBytes(blob.size)}.`);
      curtain.succeed(`${fmtBytes(blob.size)} · ready`);   // self-closes after a beat
    } catch (e) {
      if (disposed) return;
      host.log('warn', 'record auto-export failed', { error: String(e) });
      announce('Couldn’t process the video automatically - use the Export button to try again.', { assertive: true });
      curtain.close();
    }
  }

  // "Processing your video" curtain - darkens the stage with a spinner while the
  // compositor runs. data-export-hide keeps it out of any concurrent capture.
  //
  // The compositor reports no progress (renderRecord runs a real-time canvas
  // composite), so the sub line carries ELAPSED time - honest about "still working"
  // without inventing a percentage - and a Cancel that aborts the composite (via the
  // export's abort signal) and hands the stage back with the recorded take on it.
  let liveCurtain: { cancel: () => void } | null = null; // teardown also aborts the compositor
  function showProcessing(): { close: () => void; succeed: (sub: string) => void; cancelled: () => boolean; whenCancelled: Promise<void> } {
    const ov = document.createElement('div');
    ov.className = 'canvas-processing';
    ov.setAttribute('data-export-hide', '');
    ov.setAttribute('role', 'status');
    ov.setAttribute('aria-live', 'polite');
    ov.innerHTML =
      '<div class="canvas-processing-card">' +
      '<div class="canvas-processing-spinner" aria-hidden="true"></div>' +
      '<div class="canvas-processing-text">Processing your video…</div>' +
      '<div class="canvas-processing-sub">Wrapping your clip with the intro &amp; outro</div>' +
      '</div>';
    const card = ov.querySelector('.canvas-processing-card')!;
    const cancelBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'btn', textContent: 'Cancel' });
    card.appendChild(cancelBtn);
    stageEl.appendChild(ov);

    // Elapsed clock on the sub line - the only progress this render can honestly give.
    const subEl0 = ov.querySelector('.canvas-processing-sub');
    const startedAt = Date.now();
    const tick = (): void => {
      if (!subEl0) return;
      const s = Math.round((Date.now() - startedAt) / 1000);
      subEl0.textContent = `Wrapping your clip with the intro & outro · ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    };
    const timer = setInterval(tick, 1000);

    let didCancel = false;
    let resolveCancel!: () => void;
    const whenCancelled = new Promise<void>((res) => { resolveCancel = res; });
    const close = (): void => { clearInterval(timer); liveCurtain = null; ov.remove(); };
    const cancel = (): void => {
      if (didCancel) return;
      didCancel = true;
      close();
      resolveCancel();
    };
    cancelBtn.addEventListener('click', cancel);
    // Swap to a "ready + size" confirmation, then dismiss - so the user sees what was
    // produced (and how big) rather than the curtain just vanishing.
    const succeed = (sub: string): void => {
      clearInterval(timer);            // the elapsed clock must not overwrite the result line
      cancelBtn.remove();
      const spin = ov.querySelector<HTMLElement>('.canvas-processing-spinner');
      if (spin) spin.style.display = 'none';
      const text = ov.querySelector('.canvas-processing-text');
      if (text) text.textContent = 'Your video is ready';
      const subEl = ov.querySelector('.canvas-processing-sub');
      if (subEl) subEl.textContent = sub;
      setTimeout(close, 1600);
    };
    liveCurtain = { cancel };
    return { close, succeed, cancelled: () => didCancel, whenCancelled };
  }

  // Post-record download bar for audio: MP3 (primary) + the native container.
  let dlBar: HTMLElement | null = null;
  let dlUrl: string | null = null;  // the <audio> preview's object URL - revoked when the bar is replaced/dismissed/torn down
  function showAudioDownload(blob: Blob, mimeType: string, container?: string | null): void {
    dlBar?.remove();
    if (dlUrl) { URL.revokeObjectURL(dlUrl); dlUrl = null; }
    // The extension names the CONTAINER the credential was placed in, so the saved file
    // and its manifest agree (an audio/mp4 take is a .m4a). Falls back to the MIME sniff
    // for the unrecognised-encoder path, where nothing was stamped.
    const nativeExt = container ?? (mimeType.includes('mp4') ? 'm4a' : mimeType.includes('ogg') ? 'ogg' : 'webm');
    dlBar = document.createElement('div');
    dlBar.className = 'canvas-audio-dl';
    const player = document.createElement('audio');
    player.controls = true;
    dlUrl = URL.createObjectURL(blob);
    player.src = dlUrl;
    const actions = document.createElement('div');
    actions.className = 'canvas-audio-dl-actions';
    const mp3Btn = Object.assign(document.createElement('button'), { type: 'button', className: 'btn-go canvas-audio-dl-mp3', textContent: 'Save MP3' });
    const natBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'canvas-audio-dl-native', textContent: `Save .${nativeExt}` });
    const xBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'canvas-audio-dl-x', title: 'Dismiss', textContent: '✕' });
    xBtn.setAttribute('aria-label', 'Dismiss');
    // Say where the credential can be READ rather than implying parity: MP3's ID3v2
    // GEOB and M4A's BMFF box are the C2PA spec's own homes, while the Ogg and
    // Matroska bindings are Lolly's (c2pa-rs has a reader for neither). Since the
    // recorder prefers audio/webm, the DEFAULT container is the least portable one - 
    // so the MP3 save is the one that travels, and the affordance should not be coy
    // about it (plan 102 section 5.4).
    const portableCred = container === 'm4a' || container === 'mp3' || container === 'wav';
    natBtn.title = !container
      ? 'Saved without Content Credentials - no embedder for this container.'
      : portableCred
        ? 'Includes Content Credentials any C2PA viewer can read.'
        : 'Includes Content Credentials - readable in Lolly. This container has no cross-tool C2PA standard yet; save MP3 for one that travels.';
    mp3Btn.title = 'Re-encodes your take and includes Content Credentials any C2PA viewer can read.';
    actions.append(mp3Btn, natBtn, xBtn);
    dlBar.append(player, actions);
    stageEl.appendChild(dlBar);

    // Both saves route through lib/audio-take.ts, the same helpers the export
    // sheet's "Your recording" card calls - one signing path, one filename rule
    // (signed saves carry the "-lolly" suffix). The MP3 helper re-signs the
    // transcode as the same live mic capture; without that the PRIMARY save
    // button was the one shipping unsigned.
    const take = { blob, mimeType, container: container ?? null };
    natBtn.addEventListener('click', () => { void saveTakeNative(host, take); });
    mp3Btn.addEventListener('click', async () => {
      mp3Btn.disabled = true; mp3Btn.textContent = 'Encoding…';
      try {
        await saveTakeMp3(host, take);
      } catch (err) {
        host.log('warn', 'mp3 transcode failed', { error: String(err) });
        announce('MP3 encoding failed - saving the original instead.', { assertive: true });
        await saveTakeNative(host, take);
      } finally { mp3Btn.disabled = false; mp3Btn.textContent = 'Save MP3'; }
    });
    xBtn.addEventListener('click', () => { dlBar?.remove(); dlBar = null; if (dlUrl) { URL.revokeObjectURL(dlUrl); dlUrl = null; } });
  }

  // Teardown when the stage is removed (the mountTool cleanup calls this plus the
  // runtime's stopMeter/cancelRecording).
  (stageEl as HTMLElement & { _recordCleanup?: () => void })._recordCleanup = () => {
    if (disposed) return;
    disposed = true;
    runtime.stopMeter();
    runtime.cancelRecording();
    if (timerRaf) cancelAnimationFrame(timerRaf);
    flashUnsub?.();
    cameraObserver.disconnect();
    help.destroy();
    stopViewfinder();
    previewUnsub();
    if (previewVideo) { previewVideo.srcObject = null; previewVideo.remove(); previewVideo = null; }
    stopCoach();
    liveCurtain?.cancel();
    dlBar?.remove();
    if (dlUrl) { URL.revokeObjectURL(dlUrl); dlUrl = null; }
    setAudioTake(null);   // the take must not outlive its tool view
    // Free the last captured clip's object URL only if it's OUR in-memory fallback (id
    // `recording.<ext>`). A persisted user/* or library clip's URL is bridge-owned +
    // cached - revoking it would break a later read of the same asset elsewhere.
    const clip = runtime.getModel().find(i => i.id === 'clip')?.value as { id?: string; url?: string } | undefined;
    if (clip?.url?.startsWith('blob:') && String(clip.id).startsWith('recording.')) URL.revokeObjectURL(clip.url);
  };
}
