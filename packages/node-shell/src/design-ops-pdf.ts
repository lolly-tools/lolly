// SPDX-License-Identifier: MPL-2.0
/** Outlined RGB Design pages from authored drawing operations, with the shared PDF finishing pass. */
import { parseDimension, toPoints } from '@lolly/engine';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { designPagesPdf } from '../../../engine/src/design-page-svg.ts';
import type { PrintGeometry } from '../../../engine/src/print-marks.ts';
import { designOpsNodeHost } from './design-ops-host.ts';
import { finishPdfX, printGeometryForSize, provenanceLabels, encryptPdfStrong } from './pdf-finishing.ts';
import type { PdfFinishingOpts } from './pdf-finishing.ts';

/** A declared admission failure can use the browser tier; finishing/security errors cannot. */
export const DESIGN_PDF_BROWSER_REQUIRED = 'DESIGN_PDF_BROWSER_REQUIRED';

export async function designOpsPdfNode(node: Element | null | undefined, opts: PdfFinishingOpts & { text?: string }, host: HostV1,
  ctx: { repoRoot: string }): Promise<{ pdf: Blob } | { reason: string } | null> {
  const doc = opts.sourceDocument;
  if (doc?.toolId !== 'design') return null;
  // The runtime snapshots authored values before the hook composes stories. Keep that job with its browser owner.
  if (String(doc.values.textDocument ?? '').trim()) return { reason: 'the document composes text stories' };
  if (opts.watermark) return { reason: 'the export carries a watermark' };
  if (opts.password) return { reason: 'the export carries a standard password' };
  if (opts.convertPaths === false || opts.text === 'live') return { reason: 'the export keeps its words as live text' };
  const pages = node?.matches?.('[data-pdf-page]') ? [node] : Array.from(node?.querySelectorAll?.('[data-pdf-page]') ?? []);
  const ids = pages.map((page) => page.getAttribute('data-frame-id'));
  if (!ids.length || ids.some((id) => !id)) return { reason: 'a page is not a Design frame' };
  const use = await designOpsNodeHost(host, ctx);
  if (!use) return { reason: 'this shell has no text host' };
  const geos: (PrintGeometry | null)[] = [];
  const m = opts.meta;
  const creator = m?.software || 'Lolly';
  let out: Awaited<ReturnType<typeof designPagesPdf>>;
  try {
    out = await designPagesPdf(doc.values, ids as string[], use.drawing, {
      ...(opts.dpi && opts.dpi > 0 ? { dpi: opts.dpi } : {}),
      info: {
        creator, author: m?.author || creator,
        ...(m?.tool ? { title: m.tool } : {}),
        ...(m?.description ? { subject: m.description } : {}),
        ...(m ? { keywords: [m.software, m.source, m.contact].filter(Boolean).join(', ') } : {}),
      },
      place: (frame) => {
        const w = toPoints({ value: frame.width, unit: 'px' }), h = toPoints({ value: frame.height, unit: 'px' });
        const g = printGeometryForSize(w, h, opts, opts.palette);
        geos.push(g);
        return g ? { size: g.page, artwork: g.artwork } : { size: { w, h } };
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'RenderIntegrityError') throw error;
    return { reason: `the drawing could not be compiled (${error instanceof Error ? error.message : String(error)})` };
  }
  if (!out.pdf) return { reason: `a page holds features the drawing operations or PDF do not carry yet: ${[...new Set(out.findings.map((f) => `${f.feature} (${f.id})`))].join(', ')}` };
  if (use.credentialed()) return { reason: 'a picture carries Content Credentials that only the browser tier records as an ingredient' };
  const bleed = parseDimension(opts.bleed);
  const hasGeo = (bleed ? toPoints(bleed) : 0) > 0 || opts.cropMarks || opts.registrationMarks || opts.bleedMarks || opts.colorBars || opts.provenance;
  const finished = await finishPdfX(out.pdf, opts, {
    intentKind: 'srgb', log: (level, message) => host.log?.(level, message),
    ...(hasGeo ? { geos, space: 'rgb', labels: provenanceLabels(opts.meta) } : {}),
  });
  // Encryption is last. The caller must skip its C2PA update on encrypted bytes.
  const pdf = opts.strongPassword ? await encryptPdfStrong(finished, opts.strongPassword) : finished;
  host.log?.('info', `Design PDF export: ${ids.length} pages drawn from the drawing operations without a browser.`);
  return { pdf };
}
