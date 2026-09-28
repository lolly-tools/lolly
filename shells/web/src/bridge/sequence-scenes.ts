// SPDX-License-Identifier: MPL-2.0
/** Evaluate timed artboards in separate camera and animation contexts. */
import type { ApplyCtx } from './sequence-dom.ts';
import { applyDeckTransitions, readLayer, layerKind } from './sequence-plan.ts';
import { poseSlideBoxes } from '../lib/slide-pose.ts';
import { sceneAudioTiming } from './scene-audio.ts';

type Apply = (elements: HTMLElement[], ms: number, context: ApplyCtx) => void;

/** The outgoing scene holds its last pose during a junction dissolve. */
export function sceneSampleMs(ms: number, start: number, duration: number): number {
  return Math.min(ms, start + Math.max(0, duration - 0.001));
}

/** False means this is an ordinary single-stage composition. */
export function applySceneElements(elements: HTMLElement[], ms: number, ctx: ApplyCtx, apply: Apply): boolean {
  const pages = elements.filter(el => el.hasAttribute('data-pdf-page'));
  if (!pages.length) return false;
  const pageSet = new Set(pages);
  const outer = elements.filter(el => !pageSet.has(el.closest('[data-pdf-page]') as HTMLElement) || pageSet.has(el));
  const layers = applyDeckTransitions(pages.map((el, index) => readLayer(el, index, ctx.seqMs)));
  const undo: Array<() => void> = [];
  const stamp = (el: HTMLElement, name: string, value: string) => {
    const previous = el.getAttribute(name);
    if (previous === value) return;
    el.setAttribute(name, value);
    undo.push(() => { if (previous === null) el.removeAttribute(name); else el.setAttribute(name, previous); });
  };
  try {
    for (const layer of layers) {
      for (const phase of ['enter', 'exit'] as const) {
        if (layer[phase]) {
          stamp(layer.el, `data-t-${phase}`, layer[phase]!);
          stamp(layer.el, `data-t-${phase}-ms`, String(layer[`${phase}Ms`]));
        }
      }
    }
    apply(outer, ms, ctx);
    for (const layer of layers) {
      const page = layer.el;
      const pose = poseSlideBoxes(page, { reduced: false, clicks: 'show', pageStartMs: layer.startMs,
        authoredPageStartMs: page.closest('[data-deck-staged]') ? 0 : layer.startMs, pageDurMs: layer.durMs });
      try {
        const active = ms >= layer.startMs && ms < layer.startMs + layer.durMs && !layer.ignored;
        apply([...page.querySelectorAll<HTMLElement>('.lolly-box')], sceneSampleMs(ms, layer.startMs, layer.durMs), {
          seqMs: layer.startMs + layer.durMs, store: ctx.store,
          stage: () => ({ w: page.offsetWidth || parseFloat(page.style.width) || 0, h: page.offsetHeight || parseFloat(page.style.height) || 0 }),
          ...(ctx.media ? { media: (el, timing, source, on) => {
            if (layerKind(el) === 'audio') {
              const clipped = sceneAudioTiming({ startMs: timing.start, durMs: timing.dur ?? ctx.seqMs - timing.start,
                clipInMs: timing.clipIn, speed: timing.speed, kf: timing.kf }, layer.startMs, layer.startMs + layer.durMs);
              ctx.media!(el, { ...timing, start: clipped.startMs, dur: clipped.durMs, clipIn: clipped.clipInMs, kf: clipped.kf }, source, on && active && clipped.durMs > 0);
            } else ctx.media!(el, timing, source, on && active);
          } } : {}),
        });
      } finally { pose.restore(); }
    }
  } finally { for (const restore of undo.reverse()) restore(); }
  return true;
}
