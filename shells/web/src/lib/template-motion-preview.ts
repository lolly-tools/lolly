// SPDX-License-Identifier: MPL-2.0
/** One disposable, on-demand player across all template discovery surfaces. */
import './template-motion-preview.css';
import { captureNeutralPinned } from './capture-neutral.ts';
import { prefersReducedMotion } from './a11y-prefs.ts';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { InputValue } from '../../../../engine/src/inputs.ts';
import type { TemplateMotion } from './template-motion.ts';
import { previewContextSignature } from './preview-context.ts';
import { t } from '../i18n.ts';

let activeStop: (() => void) | undefined;
export interface MotionPreviewEntry { values: Record<string, InputValue>; motion: TemplateMotion }

export function armTemplateMotion(root: HTMLElement, opts: {
  host: HostV1;
  toolId: string;
  card: string;
  media: string;
  id(card: HTMLElement): string | undefined;
  load(id: string): Promise<MotionPreviewEntry | null>;
}): () => void {
  let disposed = false, epoch = 0, frame = 0;
  let selected: HTMLElement | null = null;
  let player: Awaited<ReturnType<typeof import('../pro/render-export.ts').mountTemplateMotion>> | undefined;
  let resize: ResizeObserver | undefined;
  let visible: IntersectionObserver | undefined;
  let brandSignature = '';
  const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  const autoAllowed = () => !motionPreference.matches && !prefersReducedMotion() && !document.hidden && !captureNeutralPinned();
  const stop = (): void => {
    epoch++;
    cancelAnimationFrame(frame);
    resize?.disconnect(); resize = undefined;
    visible?.disconnect(); visible = undefined;
    player?.destroy(); player = undefined;
    const button = selected?.querySelector('button[data-motion-play]');
    button?.setAttribute('aria-pressed', 'false');
    if (button) button.textContent = t('Preview animation');
    selected?.removeAttribute('data-motion-playing');
    selected = null;
    if (activeStop === stop) activeStop = undefined;
  };
  const start = async (card: HTMLElement, explicit = false): Promise<void> => {
    if (disposed || (!explicit && !autoAllowed()) || card === selected || opts.toolId !== 'design') return;
    const id = opts.id(card), media = card.querySelector<HTMLElement>(opts.media);
    if (!id || !media) return;
    activeStop?.(); stop(); activeStop = stop;
    selected = card;
    const ticket = epoch;
    let mounted: typeof player;
    const live = () => !disposed && epoch === ticket && root.isConnected && card.isConnected && !card.hidden && !document.hidden && (explicit || autoAllowed());
    try {
      const entry = await opts.load(id);
      if (!entry || !live()) { if (epoch === ticket) stop(); return; }
      const signature = await previewContextSignature(opts.host);
      const { mountTemplateMotion } = await import('../pro/render-export.ts');
      if (!live()) return;
      mounted = await mountTemplateMotion(opts.host, opts.toolId, entry.values);
      if (!live() || signature !== await previewContextSignature(opts.host)) { mounted.destroy(); if (epoch === ticket) stop(); return; }
      player = mounted;
      brandSignature = signature;
      player.stage.classList.add('template-motion-stage');
      player.stage.style.cssText = 'position:absolute;inset:0;overflow:hidden;contain:paint;pointer-events:none;';
      player.canvas.style.transformOrigin = '0 0';
      media.appendChild(player.stage);
      const fit = () => {
        if (!player) return;
        const scale = Math.min(media.clientWidth / player.width, media.clientHeight / player.height);
        player.canvas.style.transform = `translate(${(media.clientWidth - player.width * scale) / 2}px,${(media.clientHeight - player.height * scale) / 2}px) scale(${scale})`;
      };
      fit(); resize = new ResizeObserver(fit); resize.observe(media);
      visible = new IntersectionObserver(entries => { if (entries.some(e => !e.isIntersecting)) stop(); });
      visible.observe(media);
      card.dataset.motionPlaying = 'true';
      const button = card.querySelector('button[data-motion-play]');
      button?.setAttribute('aria-pressed', 'true');
      if (button) button.textContent = t('Pause preview');
      const began = performance.now(); let last = -Infinity;
      const tick = (now: number) => {
        if (!live()) { stop(); return; }
        const rect = media.getBoundingClientRect();
        if (rect.bottom <= 0 || rect.top >= innerHeight || rect.right <= 0 || rect.left >= innerWidth || rect.width === 0) { stop(); return; }
        if (now - last >= 1000 / 30) { player?.seek((now - began) % entry.motion.durationMs); last = now; }
        frame = requestAnimationFrame(tick);
      };
      player.seek(0); frame = requestAnimationFrame(tick);
    } catch (error) {
      mounted?.destroy();
      if (epoch === ticket) {
        stop();
        const button = card.querySelector<HTMLButtonElement>('[data-motion-play]');
        if (button) button.title = t('Preview could not load. Open the template to try it.');
      }
      console.warn('Template motion preview failed', error);
    }
  };
  const cardOf = (event: Event) => (event.target as Element | null)?.closest<HTMLElement>(opts.card);
  const over = (event: Event) => { const card = cardOf(event); if (card && root.contains(card)) void start(card); };
  const leave = (event: Event) => {
    const next = (event as MouseEvent).relatedTarget;
    if (selected && (!(next instanceof Node) || !selected.contains(next))) stop();
  };
  const click = (event: Event) => {
    if (!(event.target as Element).closest('[data-motion-play]')) return;
    event.preventDefault(); event.stopPropagation();
    const card = cardOf(event);
    if (card) { if (card === selected && player) stop(); else if (card !== selected) void start(card, true); }
  };
  const visibility = () => { if (document.hidden) stop(); };
  root.addEventListener('pointerover', over);
  root.addEventListener('focusin', over);
  root.addEventListener('pointerout', leave);
  root.addEventListener('focusout', leave);
  root.addEventListener('click', click, true);
  document.addEventListener('visibilitychange', visibility);
  motionPreference.addEventListener('change', stop);
  // Brand edits/theme switches invalidate a mounted preview just as they do a poster.
  const brandObserver = new MutationObserver(() => {
    const ticket = epoch;
    if (player) void previewContextSignature(opts.host).then(signature => {
      if (ticket === epoch && signature !== brandSignature) stop();
    }).catch(stop);
  });
  brandObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'data-theme'] });
  // Closing a dialog/navigation must reap a player even during its async mount.
  const observer = new MutationObserver(() => { if (!root.isConnected) destroy(); else if (selected?.hidden) stop(); });
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
  const destroy = () => {
    disposed = true; stop(); observer.disconnect(); brandObserver.disconnect();
    root.removeEventListener('pointerover', over); root.removeEventListener('focusin', over);
    root.removeEventListener('pointerout', leave); root.removeEventListener('focusout', leave);
    root.removeEventListener('click', click, true);
    document.removeEventListener('visibilitychange', visibility);
    motionPreference.removeEventListener('change', stop);
  };
  return destroy;
}
