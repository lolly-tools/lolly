// SPDX-License-Identifier: MPL-2.0
/** Preview a candidate through Design's shared renderer without writing the document. */
import './choreograph-preview.css';
import { t } from '../i18n.ts';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { InputValue } from '../../../../engine/src/inputs.ts';

export interface ChoreographPreviewSeed {
  values: Record<string, InputValue>;
  width: number;
  height: number;
  durationMs: number;
  startMs: number;
}
type MotionPlayer = Awaited<ReturnType<typeof import('../pro/render-export.ts').mountTemplateMotion>>;

export function wireChoreographPreview(panel: HTMLElement, host: HostV1, build: () => Promise<ChoreographPreviewSeed>): { invalidate(): void; destroy(): void } {
  const floating = typeof panel.showPopover === 'function';
  if (floating) {
    const position = panel.getBoundingClientRect();
    panel.setAttribute('popover', 'manual');
    panel.style.position = 'fixed'; panel.style.inset = 'auto'; panel.style.margin = '0';
    panel.style.left = `${position.left}px`; panel.style.top = `${position.top}px`;
    panel.showPopover();
  }
  const media = panel.querySelector<HTMLElement>('[data-choreo-preview-media]')!;
  const play = panel.querySelector<HTMLButtonElement>('[data-choreo-preview]')!;
  const scrub = panel.querySelector<HTMLInputElement>('[data-choreo-scrub]')!;
  const status = panel.querySelector<HTMLElement>('[data-choreo-preview-status]')!;
  let player: MotionPlayer | undefined;
  let seed: ChoreographPreviewSeed | undefined;
  let epoch = 0, frame = 0, at = 0, running = false, disposed = false;
  const paint = () => {
    player?.seek((seed?.startMs ?? 0) + Math.min(at, Math.max(0, (seed?.durationMs ?? 0) - 0.001)));
    scrub.value = String(seed ? at / seed.durationMs * 1000 : 0);
    status.textContent = seed ? t('{time} / {length} seconds', { time: (at / 1000).toFixed(1), length: (seed.durationMs / 1000).toFixed(1) }) : t('Preview leaves your document unchanged.');
  };
  const pause = () => {
    running = false; cancelAnimationFrame(frame);
    play.textContent = t('Preview motion'); play.setAttribute('aria-pressed', 'false');
  };
  const invalidate = () => {
    epoch++; pause(); player?.destroy(); player = undefined; seed = undefined; at = 0;
    media.hidden = true; scrub.disabled = true; play.disabled = false; paint();
  };
  const fit = () => {
    const bounds = floating ? { left: 0, top: 0, width: innerWidth, height: innerHeight } : panel.parentElement?.getBoundingClientRect();
    if (bounds) {
      const left = Math.max(6, 6 - bounds.left), right = Math.min(bounds.width - 6, innerWidth - bounds.left - 6);
      const top = Math.max(6, 6 - bounds.top), bottom = Math.min(bounds.height - 6, innerHeight - bounds.top - 72);
      panel.style.minWidth = `${Math.min(300, Math.max(0, right - left))}px`;
      panel.style.maxWidth = `${Math.min(360, Math.max(0, right - left))}px`;
      panel.style.maxHeight = `${Math.max(100, bottom - top)}px`;
      panel.style.left = `${Math.max(left, Math.min(parseFloat(panel.style.left) || left, right - panel.offsetWidth))}px`;
      panel.style.top = `${Math.max(top, Math.min(parseFloat(panel.style.top) || top, bottom - panel.offsetHeight))}px`;
    }
    if (!player) return;
    const scale = Math.min(media.clientWidth / player.width, media.clientHeight / player.height);
    player.canvas.style.transform = `translate(${(media.clientWidth - player.width * scale) / 2}px,${(media.clientHeight - player.height * scale) / 2}px) scale(${scale})`;
  };
  const resize = new ResizeObserver(fit); resize.observe(media); resize.observe(panel);
  if (panel.parentElement) resize.observe(panel.parentElement);
  window.addEventListener('resize', fit);
  const onPlay = async () => {
    if (running) { pause(); return; }
    const ticket = epoch;
    const live = () => !disposed && panel.isConnected && ticket === epoch && !document.hidden;
    if (!player) {
      play.disabled = true; status.textContent = t('Preparing preview…');
      let mounted: MotionPlayer | undefined;
      try {
        const candidate = await build();
        if (!live()) return;
        const { mountTemplateMotion } = await import('../pro/render-export.ts');
        if (!live()) return;
        mounted = await mountTemplateMotion(host, 'design', candidate.values, { width: candidate.width, height: candidate.height });
        if (!live()) { mounted.destroy(); return; }
        player = mounted; seed = candidate; media.hidden = false;
        player.stage.classList.add('choreo-preview-stage'); media.appendChild(player.stage);
        player.stage.style.cssText = 'position:absolute;inset:0;overflow:hidden;contain:paint;pointer-events:none;';
        player.canvas.style.transformOrigin = '0 0'; fit(); scrub.disabled = false;
      } catch (error) {
        mounted?.destroy();
        if (live()) { invalidate(); status.textContent = error instanceof Error ? error.message : t('Preview could not load.'); }
        return;
      } finally { if (live()) play.disabled = false; }
    }
    if (!live() || !seed) return;
    if (at >= seed.durationMs) at = 0;
    running = true; play.textContent = t('Pause preview'); play.setAttribute('aria-pressed', 'true');
    const began = performance.now() - at;
    const tick = (now: number) => {
      if (!live() || !running || !seed) { pause(); return; }
      at = (now - began) % seed.durationMs; paint(); frame = requestAnimationFrame(tick);
    };
    paint(); frame = requestAnimationFrame(tick);
  };
  const onScrub = () => { pause(); if (seed) { at = Number(scrub.value) / 1000 * seed.durationMs; paint(); } };
  const visibility = () => { if (document.hidden) invalidate(); };
  play.addEventListener('click', onPlay); scrub.addEventListener('input', onScrub);
  document.addEventListener('visibilitychange', visibility);
  const observer = new MutationObserver(() => { if (!panel.isConnected) destroy(); });
  observer.observe(document.body, { childList: true, subtree: true });
  function destroy() {
    if (disposed) return;
    disposed = true; invalidate(); resize.disconnect(); observer.disconnect();
    window.removeEventListener('resize', fit);
    play.removeEventListener('click', onPlay); scrub.removeEventListener('input', onScrub);
    document.removeEventListener('visibilitychange', visibility);
  }
  paint();
  return { invalidate, destroy };
}
