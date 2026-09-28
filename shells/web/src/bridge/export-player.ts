// SPDX-License-Identifier: MPL-2.0
/** Portable HTML for timed Design stages and declared tool playback controllers. */
import type { ExportOpts, WebHost } from './export-shared.ts';
import { renderPortableHtml } from './export-portable.ts';
import { withAuthoredDom } from './sequence-dom.ts';
import { sequenceSettings } from './sequence-range.ts';
import { scopeCss, unscopeCss } from '../lib/scope-css.ts';
import { playerCss, playerMarkup, type PlaybackElement, type PortablePlayerConfig } from './portable-player-document.ts';
import { fitPlayerScenes, playerScenes } from './portable-player-scenes.ts';
import { stageDeckAsSequence } from '../lib/deck-as-sequence.ts';

const asDataUrl = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Could not embed the soundtrack.'));
  reader.readAsDataURL(blob);
});

export async function renderPlayerHtml(node: Element, opts: ExportOpts, host: WebHost | null): Promise<Blob | null> {
  return withAuthoredDom(node as HTMLElement, async () => {
    const restore = opts.sourceDocument?.toolId === 'design' ? stageDeckAsSequence(node as HTMLElement, { dwellMs: 5000 }) : null;
    try { return await renderAuthoredPlayerHtml(node, opts, host); }
    finally { restore?.(); }
  });
}

async function renderAuthoredPlayerHtml(node: Element, opts: ExportOpts, host: WebHost | null): Promise<Blob | null> {
  const sequence = node.matches('[data-sequence]') ? node as HTMLElement : node.querySelector<HTMLElement>('[data-sequence]');
  const declared = opts.portableDocument;
  const toolRoot = declared ? node.matches('[data-lolly-player]') ? node as PlaybackElement : node.querySelector<PlaybackElement>('[data-lolly-player]') : null;
  const tool = toolRoot?.__lollyPlayback;
  const design = opts.sourceDocument?.toolId === 'design';
  if (!sequence && !tool && !design) return null;
  const stage = sequence ?? toolRoot ?? node.querySelector<HTMLElement>('.artboard,[data-pdf-page],#cc-root') ?? node as HTMLElement;
  const frame = sequence?.querySelector<HTMLElement>('[data-pdf-page][data-t-start]');
  const size = frame ?? stage;
  const width = frame && Number(opts.width) > 0 ? Number(opts.width) : size.offsetWidth || (node as HTMLElement).offsetWidth;
  const height = frame && Number(opts.height) > 0 ? Number(opts.height) : size.offsetHeight || (node as HTMLElement).offsetHeight;
  if (!(width > 0 && height > 0)) throw new Error('The document needs a visible canvas before HTML export.');
  if (sequence?.matches('.lolly-frames') && !frame) throw new Error('Place your artboards in order in the timeline before exporting animated HTML.');
  if (sequence?.querySelector('[data-lottie-src],[data-lolly-scene],video,[data-video-src]')) throw new Error('HTML playback for embedded video, Lottie and 3D clips is not available yet. Export this sequence as video.');
  const totalMs = sequence ? Number(sequence.dataset.seqMs) : (tool?.duration ?? 1) * 1000;
  const range = sequence ? sequenceSettings(node, totalMs) : { fromMs: 0, toMs: totalMs, fps: 30 };
  const duration = (range.toMs - range.fromMs) / 1000;
  if (!(duration > 0 && Number.isFinite(duration))) throw new Error('The animation needs a finite duration.');
  const fps = Math.max(1, opts.fps ?? range.fps);
  const config: PortablePlayerConfig = { kind: sequence ? 'sequence' : tool?.animated !== false && tool ? 'tool' : 'still', width, height, duration,
    sourceDuration: duration, from: range.fromMs / 1000, poster: tool ? tool.poster : sequence ? duration / 2 : 0, fps };
  if (frame) config.scenes = playerScenes(stage, range.fromMs, range.toMs);
  let audio = '';
  if (sequence) {
    const { sequenceAudioPcm } = await import('./sequence-render.ts');
    const pcm = await sequenceAudioPcm(node, opts, host);
    if (pcm) audio = await asDataUrl((await import('../lib/audio-encode.ts')).encodeWav(pcm));
  }
  const playerResponse = await fetch(new URL((import.meta.env?.BASE_URL ?? '/') + 'portable/player.js', document.baseURI));
  if (!playerResponse.ok) throw new Error('The HTML player could not load. Reload the app and retry.');
  const playerSource = await playerResponse.text();
    const clone = stage.cloneNode(true) as HTMLElement;
    if (frame) fitPlayerScenes(clone, width, height);
    clone.querySelectorAll('script:not([type="application/json"]),[data-export-hide]:not([data-cam])').forEach(el => { el.remove(); });
    clone.querySelectorAll('[data-audio-src]').forEach(el => { el.removeAttribute('data-audio-src'); });
    for (const el of clone.querySelectorAll('[data-canvas-input],[data-canvas-settings]')) {
      el.removeAttribute('tabindex'); el.removeAttribute('data-canvas-input'); el.removeAttribute('data-canvas-settings'); if (el.getAttribute('role') === 'button') { el.removeAttribute('role'); el.removeAttribute('aria-label'); }
    }
    clone.style.width = `${width}px`; clone.style.height = `${height}px`;
    const authored = tool?.portableMarkup?.() ?? declared?.markup ?? clone.outerHTML;
    const markup = `<div id="tool-canvas" class="tool-canvas" style="position:relative;width:${width}px;height:${height}px">${authored}</div>`;
    const sheets = new Set([...node.querySelectorAll('style')]);
    for (const el of document.head.querySelectorAll<HTMLStyleElement>('style[data-lolly-scope]')) {
      const scope = el.getAttribute('data-lolly-scope')!;
      if (node.matches(scope) || node.closest(scope)) sheets.add(el);
    }
    const styles = [...sheets].map(el => {
      const scope = el.getAttribute('data-lolly-scope'), css = el.textContent ?? '';
      return scope ? scopeCss(unscopeCss(css, scope), '#tool-canvas') : css;
    }).join('\n');
    return renderPortableHtml(node, { title: declared?.title ?? opts.filename ?? 'Made with Lolly', lang: declared?.lang ?? document.documentElement.lang ?? 'en',
      markup: playerMarkup(markup, config, audio), styles: styles + '\n' + (declared?.styles ?? '') + '\n' + playerCss,
      script: (declared?.script ?? '') + '\n;' + playerSource });
}
