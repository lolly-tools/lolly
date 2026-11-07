// SPDX-License-Identifier: MPL-2.0
/**
 * The vector IR that EMF, WMF, EPS and DXF are written from: the tool's own `<svg>` when
 * the canvas is one, else the walker's SVG of the HTML layout, walked by svg-ir.ts.
 *
 * A run no font here can draw (a script with no fallback font, or a Chinese, Japanese or
 * Korean character outside the national sets) used to outline as boxes. EPS and WMF now
 * draw it as a picture by the browser's own text renderer, as a PDF does, with one notice
 * that gives the scripts. DXF goes to cutting machines and CAD, so it stops with a message
 * that quotes the run. EMF keeps its own rules: live text, or outlines when asked.
 */
import { renderSvgFromHtml } from './export-svg-walker.ts';
import { notePicturedText, takePicturedTextNotice } from './export-pdf-text-picture.ts';
import { _exportNotice } from './export-notice.ts';
import { _host, type ExportOpts } from './export-shared.ts';
import { svgDomToIr, type SvgIrContext, type VectorIrResult } from './svg-ir.ts';

/** Is the export node an `<svg>`, or a wrapper whose first drawn child is one? */
export function isSvgRooted(node: Element): boolean {
  if (node.tagName?.toLowerCase() === 'svg') return true;
  for (const child of node.children) {
    const t = child.tagName.toLowerCase();
    if (t === 'style' || t === 'script') continue;
    return t === 'svg';
  }
  return false;
}

/** The SVG to walk: the tool's own, or the walker's synthesis of an HTML layout. */
export async function vectorSvgRoot(node: Element, opts: ExportOpts, convertPaths: boolean): Promise<Element> {
  const own = node.tagName?.toLowerCase() === 'svg' ? node : isSvgRooted(node) ? node.querySelector('svg') : null;
  if (own) return own;
  const svgBlob = await renderSvgFromHtml(node, { ...opts, convertPaths, noBoxShadow: true });
  return new DOMParser().parseFromString(await svgBlob.text(), 'image/svg+xml').documentElement;
}

/**
 * The outlined IR for a WMF, EPS or DXF export, and `notify`, which puts one notice on the
 * export card for the scripts an EPS or WMF drew as pictures. Call it once the file is written.
 */
export async function outlinedVectorIr(node: Element, opts: ExportOpts, label: 'WMF' | 'EPS' | 'DXF'): Promise<{ ir: VectorIrResult; notify: () => void }> {
  const pictured = {};
  const uncovered: Pick<SvgIrContext, 'uncoveredText' | 'pictureText' | 'onPicturedText'> = label === 'DXF'
    ? { uncoveredText: 'refuse' }
    : {
      uncoveredText: 'picture',
      pictureText: async (run) => (await import('./export-text-stencil.ts')).pictureTextRun(run),
      onPicturedText: (text) => notePicturedText(pictured, text),
    };
  const ir = await svgDomToIr(await vectorSvgRoot(node, opts, true), {
    host: _host,
    getComputedStyle: (el: Element) => window.getComputedStyle(el),
    background: opts.background,
    label,
    ...uncovered,
  });
  const notify = (): void => {
    if (label === 'DXF') return;
    const notice = takePicturedTextNotice(pictured, label);
    if (notice) { _host?.log?.('warn', `${label.toLowerCase()}: ${notice}`); _exportNotice(notice); }
  };
  return { ir, notify };
}
