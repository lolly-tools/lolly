// SPDX-License-Identifier: MPL-2.0
/** Node collectors share the evidence rules; unsupported renderers remain gaps. */
import {
  analyzeTextSignals,
  forensicRasterCards,
  forensicReport,
  extractPageText,
  readPptx,
  readDocx,
  mdFromBlocks,
  pdfNodesToSvg,
} from '@lolly/engine';
import type {
  ForensicCoverage,
  ForensicPage,
  ForensicModelObservation,
  ForensicReport,
} from '@lolly/engine';
import { createNodeAiDetectAPI } from './ml/ai-detect.ts';
import { createNodeOcrAPI } from './ml/ocr.ts';
import { passiveForensicSvg } from './forensic-svg.ts';
import { inflatePptx } from './pptx.ts';
export async function inspectForensicBytes(
  bytes: Uint8Array,
  name: string,
  opts: { pageCap?: number; signal?: AbortSignal; classifier?: boolean } = {}
): Promise<ForensicReport> {
  if (bytes.length > 64_000_000) throw new Error('Forensic input exceeds 64 MB.');
  if (opts.pageCap !== undefined && (!Number.isInteger(opts.pageCap) || opts.pageCap < 1 || opts.pageCap > 100)) throw new Error('Forensic page cap must be an integer from 1 to 100.');
  const pages: ForensicPage[] = [],
    coverage: ForensicCoverage[] = [],
    models: ForensicModelObservation[] = [];
  const receipt = (
    collector: string,
    state: ForensicCoverage['state'],
    reason: string,
    page?: string
  ) =>
    coverage.push({
      collector,
      state,
      reason,
      version: 'node-forensic/1',
      ...(page ? { page } : {}),
    });
  const cap = Math.min(100, Math.max(1, opts.pageCap ?? 6));
  const make = (id: string, text = '', width = 0, height = 0): ForensicPage => ({
    id,
    text: text.slice(0, 65_536),
    width,
    height,
    complete: text.length <= 65_536,
    source: 'digital',
    lines: [],
    shapes: [],
  });
  let dom:
    | {
        window: { DOMParser: typeof DOMParser; XMLSerializer: typeof XMLSerializer; close(): void };
      }
    | undefined;
  async function parsers() {
    dom ??= new (await import('jsdom')).JSDOM('');
    return {
      parse: (source: string) =>
        new dom!.window.DOMParser().parseFromString(source, 'application/xml'),
      serialize: (el: Element) => new dom!.window.XMLSerializer().serializeToString(el),
    };
  }
  async function raster(page: ForensicPage, input: Uint8Array): Promise<void> {
    try {
      opts.signal?.throwIfAborted();
      const sharp = (await import('sharp')).default;
      const original = await sharp(input, { limitInputPixels: 40_000_000 }).metadata();
      const { data, info } = await sharp(input, { limitInputPixels: 40_000_000 })
        .resize({ width: 1800, height: 1800, fit: 'inside', withoutEnlargement: true })
        .flatten({ background: '#fff' })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      if (!page.width && original.width && original.height) {
        page.width = original.width;
        page.height = original.height;
      }
      const sx = page.width ? page.width / info.width : 1,
        sy = page.height ? page.height / info.height : 1;
      if (!page.width) {
        page.width = info.width;
        page.height = info.height;
      }
      const frame = { width: info.width, height: info.height, data: new Uint8ClampedArray(data) };
      if (!page.text.trim()) {
        const ocr = createNodeOcrAPI(),
          model = ocr?.models()[0];
        if (ocr && model && (await ocr.cached(model.id))) {
          const read = await ocr.run(frame, { model: model.id });
          page.source = 'ocr';
          page.text = read.text.slice(0, 65_536);
          page.complete = false;
          page.lines = read.lines.map((l) => ({
            text: l.text,
            confidence: l.confidence,
            box: { x: l.box.x * sx, y: l.box.y * sy, width: l.box.w * sx, height: l.box.h * sy },
          }));
          receipt(
            'ocr',
            page.complete ? 'completed' : 'partial',
            'Local OCR; boxes and characters are estimates.',
            page.id
          );
        } else {
          page.complete = false;
          receipt('ocr', 'unavailable', 'No cached OCR model; image text remains unread.', page.id);
        }
      }
      if (!page.shapes.length) {
        page.shapes = forensicRasterCards(frame.data, info.width, info.height).map((s) => ({
          ...s,
          radius: s.radius * Math.min(sx, sy),
          ...(s.accent
            ? {
                accent: {
                  ...s.accent,
                  width: s.accent.width * (['left', 'right'].includes(s.accent.edge) ? sx : sy),
                },
              }
            : {}),
          box: {
            x: s.box.x * sx,
            y: s.box.y * sy,
            width: s.box.width * sx,
            height: s.box.height * sy,
          },
        }));
        page.layoutMethod = 'decoded-pixels';
      }
      receipt(
        'pixel-layout',
        'partial',
        'Accent-card segmentation only; maximum edge 1800 pixels. White-on-white panels may be missed.',
        page.id
      );
    } catch (error) {
      receipt(
        'pixel-layout',
        opts.signal?.aborted ? 'cancelled' : 'unavailable',
        error instanceof Error ? error.message : String(error),
        page.id
      );
    }
  }
  try {
    if (/\.(png|jpe?g|webp)$/i.test(name)) {
      const p = make('1');
      pages.push(p);
      await raster(p, bytes);
    } else if (/\.svg$/i.test(name)) {
      const { parse, serialize } = await parsers(),
        svg = passiveForensicSvg(new TextDecoder().decode(bytes), parse, serialize);
      const p = make('1', svg.lines.map((l) => l.text).join('\n'), svg.width, svg.height);
      p.lines = svg.lines;
      p.shapes = svg.shapes;
      p.complete = p.complete && !svg.partial;
      p.layoutMethod = 'source-geometry';
      pages.push(p);
      receipt(
        'source-layout',
        svg.partial ? 'partial' : 'completed',
        'Passive SVG subset; excluded scripts, CSS, unsupported transforms and external resources.',
        p.id
      );
      await raster(p, new TextEncoder().encode(svg.svg));
    } else if (/\.pdf$/i.test(name)) {
      const { loadPdfDocument, interpretPdfDocPage } = await import('./pdf-read.ts'),
        doc = await loadPdfDocument(bytes),
        count = doc.getPageCount();
      for (let i = 0; i < Math.min(cap, count); i++) {
        opts.signal?.throwIfAborted();
        const result = interpretPdfDocPage(doc, i, { maxContentChars: 4_000_000 }),
          text = extractPageText(result.nodes, { width: result.width, height: result.height }),
          p = make(String(i + 1), text.text, result.width, result.height);
        p.lines = (text.lines ?? []).map((l) => ({
          text: l.text,
          size: l.size,
          confidence: 0.8,
          box: { x: l.x, y: l.baseline - l.size, width: l.right - l.x, height: l.size * 1.2 },
        }));
        pages.push(p);
        receipt(
          'native-text',
          p.complete ? 'completed' : 'partial',
          'Native PDF text; positions follow interpreted glyph estimates.',
          p.id
        );
        receipt(
          'source-layout',
          'partial',
          'Native drawing subset; embedded raster resources are not decoded by this Node adapter.',
          p.id
        );
        const svg = pdfNodesToSvg(result.nodes, { width: p.width, height: p.height });
        await raster(p, new TextEncoder().encode(svg));
      }
      if (count > cap) receipt('pages', 'partial', `${cap}/${count} pages inspected.`);
    } else if (/\.(docx|pptx)$/i.test(name)) {
      const { parse } = await parsers(),
        parts = await inflatePptx(bytes);
      if (/\.docx$/i.test(name)) {
        const p = make('1', mdFromBlocks(readDocx(parts, parse).blocks));
        p.docKind = 'markdown';
        pages.push(p);
        receipt('layout', 'unsupported', 'DOCX has no trustworthy rendered geometry.');
      } else {
        const deck = readPptx(parts, parse);
        for (const [index, slide] of deck.slides.slice(0, cap).entries()) {
          const text = slide.nodes
            .flatMap((n) =>
              n.type === 'text'
                ? n.paras.map((p) => p.runs.map((r) => r.text).join(''))
                : n.type === 'table'
                  ? n.rows.map((r) => r.join(' '))
                  : []
            )
            .join('\n');
          pages.push(make(String(index + 1), text));
        }
        receipt(
          'native-text',
          deck.warnings?.length ? 'partial' : 'completed',
          'Native slide text.'
        );
        receipt(
          'layout',
          'unsupported',
          'Use browser Verify for rendered slide geometry and flattened slide images.'
        );
        if (deck.slides.length > cap)
          receipt('pages', 'partial', `${cap}/${deck.slides.length} slides inspected.`);
      }
    } else if (/\.(txt|md|markdown)$/i.test(name)) {
      const p = make('1', new TextDecoder().decode(bytes));
      p.docKind = /\.(md|markdown)$/i.test(name)
        ? 'markdown'
        : analyzeTextSignals(p.text, { source: 'digital' }).docKind;
      pages.push(p);
      receipt(
        'native-text',
        p.complete ? 'completed' : 'partial',
        'Original text; maximum 65,536 characters.'
      );
      receipt('layout', 'unsupported', 'No page geometry for reflowable text.');
    } else
      receipt(
        'format',
        'unsupported',
        'Unsupported forensic format. Credential inspection remains separate.'
      );
    const api = opts.classifier === false ? null : createNodeAiDetectAPI(),
      ready = api && (await api.cached());
    for (const p of pages) {
      opts.signal?.throwIfAborted();
      if (p.docKind === 'code' || !api?.eligible(p.text))
        receipt('text-model', 'skipped', 'Outside the conservative English prose gate.', p.id);
      else if (!ready) receipt('text-model', 'unavailable', 'No cached text classifier.', p.id);
      else {
        const estimate = await api.score(p.text);
        if (estimate?.windows) {
          models.push({
            page: p.id,
            model: estimate.modelId,
            version: 'window-policy/3;onnx-cpu-basic',
            windows: estimate.windows,
            complete: !!estimate.complete,
            rawMean: estimate.probAi,
            threshold: estimate.threshold,
          });
          coverage.push({
            collector: 'text-model',
            page: p.id,
            state: estimate.complete ? 'completed' : 'partial',
            reason: 'Raw model observations; no calibrated probability.',
            version: 'window-policy/3;onnx-cpu-basic',
            ranges: estimate.windows.map((w) => ({ index: w.index, length: w.length })),
          });
        } else receipt('text-model', 'failed', 'Classifier did not return located coverage.', p.id);
      }
    }
  } catch (error) {
    receipt(
      'assessment',
      opts.signal?.aborted ? 'cancelled' : 'failed',
      error instanceof Error ? error.message : String(error)
    );
  } finally {
    dom?.window.close();
  }
  const extension = name.split('.').at(-1)?.toLowerCase();
  const format =
    extension === 'jpg' || extension === 'jpeg'
      ? 'jpeg'
      : extension === 'txt'
        ? 'text'
        : extension === 'md' || extension === 'markdown'
          ? 'markdown'
          : ['png', 'webp', 'svg', 'pdf', 'pptx', 'docx'].includes(extension ?? '')
            ? (extension as 'png' | 'webp' | 'svg' | 'pdf' | 'pptx' | 'docx')
            : 'unknown';
  return forensicReport(bytes, pages, coverage, models, [], [], format);
}
