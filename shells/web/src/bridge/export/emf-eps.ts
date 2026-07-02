// SPDX-License-Identifier: MPL-2.0
/**
 * EMF (Enhanced Metafile) and EPS export — vector, always text-as-paths.
 *
 * EMF is a third sink on the SVG vector pipeline (alongside SVG and PDF): obtain
 * an SVG whose text is already outlined — the tool's own <svg>, or an outlined
 * SVG synthesised from an HTML layout via renderSvgFromHtml — walk it into the
 * engine IR (svgDomToIr), and serialize to bytes (emitEmf). Device RGB only;
 * gradients/images/alpha are flattened to solids upstream. See
 * plans/emf-support.md. The text-as-paths guarantee is enforced in svgDomToIr,
 * which throws on any run it can't vectorise rather than dropping it.
 *
 * EPS is the fourth sink: same outlined-SVG → engine IR walk, then serialised to
 * PostScript text by emitEps. Device RGB (cmyk=false) or naive DeviceCMYK
 * (cmyk=true, no embedded output intent); gradients/images/alpha are flattened
 * to solids upstream and text is outlined upstream, so the emitter ships no fonts.
 */

import { emitEmf, emitEps } from '@lolly/engine';
import type { HostV1 } from '@lolly/engine';
import { svgDomToIr } from '../svg-ir.ts';
import { renderSvgFromHtml } from './svg.ts';
import type { FormatAdapter, RenderContext, ExportOptions } from './types.ts';

// The tool's own <svg> when the canvas is SVG-rooted; otherwise an outlined SVG
// synthesised from the HTML layout (text as paths, no box shadows — those
// formats have no blur primitive).
async function outlinedSvgFor(node: HTMLElement, opts: ExportOptions, host: HostV1 | null): Promise<Element> {
  const own = node.tagName.toLowerCase() === 'svg' ? node : node.querySelector('svg');
  if (own) return own;
  const svgBlob = await renderSvgFromHtml(node, { ...opts, convertPaths: true, noBoxShadow: true }, host);
  const xml = await svgBlob.text();
  return new DOMParser().parseFromString(xml, 'image/svg+xml').documentElement;
}

async function renderEmf(node: HTMLElement, opts: ExportOptions, host: HostV1 | null): Promise<Blob> {
  const svgEl = await outlinedSvgFor(node, opts, host);
  const ir = await svgDomToIr(svgEl, {
    host,
    getComputedStyle: (el: Element) => window.getComputedStyle(el),
    background: opts.background,
  });
  const bytes = emitEmf(ir, { width: opts.width, height: opts.height, unit: opts.unit, dpi: opts.dpi });
  return new Blob([new Uint8Array(bytes)], { type: 'image/emf' });
}

async function renderEps(node: HTMLElement, opts: ExportOptions, cmyk: boolean, host: HostV1 | null): Promise<Blob> {
  const svgEl = await outlinedSvgFor(node, opts, host);
  const ir = await svgDomToIr(svgEl, {
    host,
    getComputedStyle: (el: Element) => window.getComputedStyle(el),
    background: opts.background,
    label: 'EPS',
  });
  // emitEps reads meta.title for the %%Title DSC comment. The old code handed it
  // the whole ExportMeta record — which has no `title` field — so the comment was
  // silently never emitted (latent bug the compiler exposed). Map the tool name.
  const meta = opts.meta?.tool !== undefined ? { title: opts.meta.tool } : undefined;
  const text = emitEps(ir, { width: opts.width, height: opts.height, unit: opts.unit, dpi: opts.dpi, cmyk, meta });
  return new Blob([text], { type: 'application/postscript' });
}

export const emfEpsAdapter: FormatAdapter = {
  formats: ['emf', 'eps', 'eps-cmyk'],
  render(ctx: RenderContext): Promise<Blob> {
    if (ctx.format === 'emf') return renderEmf(ctx.node, ctx.opts, ctx.host);
    return renderEps(ctx.node, ctx.opts, ctx.format === 'eps-cmyk', ctx.host);
  },
};
