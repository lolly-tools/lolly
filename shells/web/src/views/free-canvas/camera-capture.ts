// SPDX-License-Identifier: MPL-2.0
/** Webcam streams belong to one mounted editor, never to saved document data. */
import { iconNode } from '../../lib/icon-node.ts';
import { t } from '../../i18n.ts';
import type { PickerHost } from '../picker.ts';
import { positionEditorPopover } from '../free-canvas-popover.ts';
import type { FcCtx } from './context.ts';
import '../../styles/parts/design-camera.css';

type Camera = { id: string; marker: HTMLElement; video: HTMLVideoElement | null; stream: MediaStream | null;
  generation: number; pending: boolean; capturing: boolean; error: string };

export function cameraCaptureOps(fc: FcCtx) {
  const cameras = new Map<string, Camera>();
  let observer: MutationObserver | null = null, controls: HTMLElement | null = null;
  let raf = 0, closed = false, lastState = '', lastBounds = '';
  const supported = () => typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
  const available = () => Boolean(fc.designChrome && fc.addKinds.some(kind => kind.id === 'webcam') && supported());
  const current = (camera: Camera, generation: number) => !closed && !fc.disposed && cameras.get(camera.id) === camera && camera.generation === generation
    && fc.select.getBoxes().some((box, i) => fc.select.idOf(box, i) === camera.id && String(box[fc.cfg.kindField]) === 'webcam');
  const selected = () => fc.selection.size === 1 ? cameras.get([...fc.selection][0]!) : undefined;

  function stop(camera: Camera): void {
    camera.generation++;
    camera.pending = false;
    camera.capturing = false;
    camera.stream?.getTracks().forEach(track => { track.stop(); }); camera.stream = null;
    if (camera.video) { camera.video.srcObject = null; camera.video.remove(); camera.video = null; }
    camera.marker.dataset.cameraState = 'stopped';
  }

  function attach(camera: Camera): void {
    camera.marker.dataset.cameraState = camera.stream ? 'live' : camera.pending ? 'starting' : 'stopped';
    if (!camera.stream) return;
    if (camera.video) {
      camera.video.setAttribute('style', camera.marker.dataset.cameraStyle || 'object-fit:cover');
      if (camera.video.parentElement !== camera.marker) camera.marker.append(camera.video);
      return;
    }
    const video = camera.marker.ownerDocument.createElement('video');
    video.className = 'lolly-box-img live-camera-video';
    video.setAttribute('data-live-camera-video', '');
    video.setAttribute('style', camera.marker.dataset.cameraStyle || 'object-fit:cover');
    video.autoplay = true; video.muted = true; video.playsInline = true; video.srcObject = camera.stream;
    camera.marker.append(video); camera.video = video;
    void video.play().catch(() => {
      if (camera.video !== video || closed) return;
      camera.error = t('Couldn’t play the camera.'); stop(camera);
    });
  }

  async function start(camera: Camera): Promise<void> {
    if (closed || camera.stream || camera.pending || !supported()) return;
    camera.pending = true; camera.error = '';
    const generation = ++camera.generation;
    attach(camera);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false,
      });
      if (!current(camera, generation)) { stream.getTracks().forEach(track => { track.stop(); }); return; }
      camera.pending = false; camera.stream = stream;
      for (const track of stream.getVideoTracks()) track.addEventListener('ended', () => {
        if (current(camera, generation)) stop(camera);
      }, { once: true });
      attach(camera);
    } catch (error) {
      if (!current(camera, generation)) return;
      camera.pending = false;
      camera.error = (error as Error)?.name === 'NotAllowedError' ? t('Camera access was declined. Try again to allow camera access.') : t('Couldn’t start this camera.');
      attach(camera);
    }
  }

  async function capture(camera: Camera): Promise<void> {
    const video = camera.video;
    if (!video?.videoWidth || !video.videoHeight || camera.capturing || fc.opts.canEdit?.() === false) return;
    const generation = camera.generation;
    camera.capturing = true;
    try {
      const canvas = video.ownerDocument.createElement('canvas');
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (!context) throw new Error(t('Couldn’t capture the frame.'));
      context.drawImage(video, 0, 0);
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error(t('Couldn’t capture the frame.'));
      if (!current(camera, generation) || fc.opts.canEdit?.() === false) return;
      const { storeUserUpload } = await import('../picker.ts');
      if (!current(camera, generation)) return;
      const ref = await storeUserUpload(fc.host as PickerHost, new File([blob], `camera-frame-${Date.now()}.png`, { type: 'image/png' }));
      if (!current(camera, generation) || fc.opts.canEdit?.() === false) return;
      const boxes = fc.select.getBoxes();
      const index = boxes.findIndex((box, i) => fc.select.idOf(box, i) === camera.id);
      if (index < 0 || String(boxes[index]![fc.cfg.kindField]) !== 'webcam') return;
      fc.select.commit(boxes.map((box, i) => i === index ? { ...box, [fc.cfg.imageField!]: ref } : box));
    } catch (error) {
      if (current(camera, generation)) camera.error = error instanceof Error ? error.message : t('Couldn’t capture the frame.');
    } finally { if (camera.generation === generation) camera.capturing = false; }
  }

  function action(label: string, symbol: 'camera' | 'close' | 'image', run: () => void): HTMLButtonElement {
    const button = fc.canvasEl.ownerDocument.createElement('button');
    button.type = 'button'; button.className = 'btn btn--labelled btn--sm'; button.setAttribute('aria-label', label);
    const glyph = iconNode(symbol, button.ownerDocument);
    if (glyph) button.append(glyph);
    const text = button.ownerDocument.createElement('span');
    text.className = 'btn-label'; text.textContent = label; button.append(text);
    button.addEventListener('click', event => { event.stopPropagation(); run(); });
    return button;
  }

  function paintControls(): void {
    if (!controls || closed) return;
    const camera = selected(); controls.hidden = !camera;
    if (!camera) { lastState = ''; return; }
    const state = JSON.stringify([camera.id, !!camera.stream, camera.pending, camera.capturing, camera.error, fc.opts.canEdit?.()]);
    if (state !== lastState) {
      lastState = state;
      const focused = controls.contains(controls.ownerDocument.activeElement);
      controls.replaceChildren();
      if (camera.stream) {
        controls.append(action(t('Stop camera'), 'close', () => stop(camera)));
        const shot = action(t('Capture frame'), 'image', () => { void capture(camera); });
        shot.disabled = camera.capturing || fc.opts.canEdit?.() === false; controls.append(shot);
      } else {
        const startButton = action(camera.pending ? t('Starting camera…') : t('Start camera'), 'camera', () => { void start(camera); });
        startButton.disabled = camera.pending || !supported(); controls.append(startButton);
      }
      if (camera.error || !supported()) {
        const status = controls.ownerDocument.createElement('span'); status.className = 'live-camera-status';
        status.setAttribute('role', 'status'); status.textContent = camera.error || t('Camera access is unavailable.'); controls.append(status);
      }
      if (focused) controls.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
      lastBounds = '';
    }
    const bounds = camera.marker.getBoundingClientRect();
    const geometry = `${bounds.x}:${bounds.y}:${bounds.width}:${bounds.height}:${fc.stageEl.clientWidth}:${fc.stageEl.clientHeight}`;
    if (geometry !== lastBounds) { lastBounds = geometry; positionEditorPopover(controls, camera.marker, fc.stageEl); }
  }

  function tick(): void { raf = 0; paintControls(); if (!closed && cameras.size) raf = requestAnimationFrame(tick); }
  function refresh(): void {
    if (closed) return;
    const markers = new Map([...fc.canvasEl.querySelectorAll<HTMLElement>('[data-live-camera]')].map(marker => [marker.dataset.liveCamera!, marker]));
    for (const [id, camera] of cameras) if (!markers.has(id)) { stop(camera); cameras.delete(id); }
    for (const [id, marker] of markers) {
      if (!id) continue;
      let camera = cameras.get(id);
      if (!camera) { camera = { id, marker, video: null, stream: null, generation: 0, pending: false, capturing: false, error: '' }; cameras.set(id, camera); }
      else if (camera.marker === marker) continue;
      else camera.marker = marker;
      attach(camera);
    }
    paintControls();
    if (cameras.size && !raf) raf = requestAnimationFrame(tick);
    else if (!cameras.size && raf) { cancelAnimationFrame(raf); raf = 0; }
  }

  return {
    available,
    add() { const kind = fc.addKinds.find(kind => kind.id === 'webcam'); if (kind && !closed && fc.opts.canEdit?.() !== false) fc.modes.setMode('create', { kind }); },
    wire() {
      if (!fc.addKinds.some(kind => kind.id === 'webcam')) return;
      controls = fc.canvasEl.ownerDocument.createElement('div'); controls.className = 'live-camera-controls'; controls.hidden = true;
      controls.setAttribute('role', 'toolbar'); controls.setAttribute('aria-label', t('Camera')); controls.setAttribute('data-export-hide', '');
      controls.addEventListener('pointerdown', event => event.stopPropagation()); fc.stageEl.append(controls);
      observer = new MutationObserver(refresh); observer.observe(fc.canvasEl, { childList: true, subtree: true }); refresh();
    },
    destroy() {
      closed = true; observer?.disconnect(); observer = null; if (raf) cancelAnimationFrame(raf); raf = 0;
      for (const camera of cameras.values()) stop(camera); cameras.clear(); controls?.remove(); controls = null;
    },
  };
}
