// SPDX-License-Identifier: MPL-2.0
/** Timed artboards become named chapters and a fitted stack in portable HTML. */
import { parseSequenceStage, normalizeFrameScene } from './sequence-plan.ts';
import type { PortablePlayerScene } from './portable-player-document.ts';

export function playerScenes(stage: HTMLElement, fromMs: number, toMs: number): PortablePlayerScene[] {
  return (parseSequenceStage(stage)?.layers ?? []).filter(layer => layer.frameScene && !layer.ignored && layer.durMs > 0)
    .sort((a, b) => a.startMs - b.startMs || a.idx - b.idx)
    .filter(layer => layer.startMs < toMs && layer.startMs + layer.durMs > fromMs)
    .map((layer, index) => ({ id: layer.el.getAttribute('data-frame-id') || String(index + 1),
      name: layer.el.getAttribute('data-frame-name') || `Scene ${index + 1}`,
      start: Math.max(0, layer.startMs - fromMs) / 1000,
      end: (Math.min(toMs, layer.startMs + layer.durMs) - fromMs) / 1000 }));
}

/** Reuse the movie's contain-fit rule, with native text and geometry inside each page. */
export function fitPlayerScenes(stage: HTMLElement, width: number, height: number): void {
  const layers = parseSequenceStage(stage)?.layers.filter(layer => layer.frameScene && !layer.ignored) ?? [];
  const pages = layers.map(layer => {
    const fit = normalizeFrameScene(layer, width, height);
    const wrapper = document.createElement('div');
    wrapper.className = 'lp-scene-fit';
    wrapper.style.cssText = `position:absolute;left:${fit.rect.x}px;top:${fit.rect.y}px;width:${layer.rect.w}px;height:${layer.rect.h}px;transform-origin:0 0;transform:scale(${fit.rect.w / layer.rect.w});`;
    layer.el.style.left = '0px'; layer.el.style.top = '0px';
    layer.el.style.margin = '0';
    wrapper.append(layer.el);
    return wrapper;
  });
  stage.replaceChildren(...pages);
  stage.style.cssText = `position:relative;display:block;width:${width}px;height:${height}px;min-width:0;min-height:0;overflow:hidden;background:#111;`;
}
