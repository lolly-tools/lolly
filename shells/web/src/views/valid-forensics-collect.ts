// SPDX-License-Identifier: MPL-2.0
/** Shell-owned decoding, OCR and inference with a coverage receipt for each page. */
import { analyzeTextSignals, imageDimensions } from '@lolly/engine';
import { forensicLanguage, forensicReport, FORENSIC_CHUNK_VERSION } from '../../../../engine/src/forensic.ts';
import type {
  ForensicCoverage,
  ForensicPage,
  ForensicReport,
  ForensicShape,
  ForensicModelObservation,
  ForensicOrigin,
} from '../../../../engine/src/forensic.ts';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { passiveForensicSvg } from './valid-forensics-svg.ts';
export interface ForensicCollection {
  report: ForensicReport;
  previews: Map<string, string>;
  pageCount: number;
}
export interface ForensicCollectOptions {
  signal: AbortSignal;
  origins?: ForensicOrigin[];
  pageCap?: number;
  progress?: (done: number, total: number) => void;
}
async function cards(
  frame: { data: Uint8ClampedArray; width: number; height: number },
  signal: AbortSignal
): Promise<ForensicShape[]> {
  if (signal.aborted) return [];
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../lib/forensic-worker.ts', import.meta.url), {
      type: 'module',
    });
    const end = () => {
      worker.terminate();
      signal.removeEventListener('abort', cancel);
    };
    const cancel = () => {
      end();
      resolve([]);
    };
    signal.addEventListener('abort', cancel, { once: true });
    worker.onmessage = (e) => {
      end();
      if (e.data.error) reject(new Error(e.data.error));
      else resolve(e.data.shapes);
    };
    worker.onerror = () => {
      end();
      reject(new Error('Pixel inspection worker failed.'));
    };
    worker.postMessage(frame, [frame.data.buffer]);
  });
}
async function decode(blob: Blob): Promise<{
  data: Uint8ClampedArray;
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
}> {
  const dimensions = imageDimensions(
    new Uint8Array(await blob.slice(0, 1_048_576).arrayBuffer()),
    blob.type
  );
  if (
    !dimensions ||
    dimensions.w <= 0 ||
    dimensions.h <= 0 ||
    dimensions.w * dimensions.h > 40_000_000
  )
    throw new Error('Image dimensions exceed the bounded decoding limits.');
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Preview could not decode.'));
      image.src = url;
    });
    if (image.naturalWidth * image.naturalHeight > 40_000_000)
      throw new Error('Source image exceeds the 40 megapixel admission limit.');
    const scale = Math.min(1, 1800 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Pixel decoding is unavailable.');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return {
      sourceWidth: image.naturalWidth,
      sourceHeight: image.naturalHeight,
      data: ctx.getImageData(0, 0, canvas.width, canvas.height).data,
      width: canvas.width,
      height: canvas.height,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}
export async function collectForensicFile(
  file: File,
  host: HostV1,
  opts: ForensicCollectOptions
): Promise<ForensicCollection> {
  if (file.size > 64_000_000)
    throw new Error('Forensic inspection is limited to files under 64 MB.');
  const extension = file.name.split('.').at(-1)?.toLowerCase();
  const format =
    extension === 'jpg' || extension === 'jpeg'
      ? 'jpeg'
      : extension === 'txt' ||
          (file.type.startsWith('text/') && !['svg', 'md', 'markdown'].includes(extension ?? ''))
        ? 'text'
        : extension === 'md' || extension === 'markdown'
          ? 'markdown'
          : ['png', 'webp', 'svg', 'pdf', 'pptx', 'docx'].includes(extension ?? '')
            ? (extension as 'png' | 'webp' | 'svg' | 'pdf' | 'pptx' | 'docx')
            : 'unknown';
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pages: ForensicPage[] = [],
    coverage: ForensicCoverage[] = [],
    models: ForensicModelObservation[] = [],
    previews = new Map<string, string>();
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
      ...(page ? { page } : {}),
      version: 'forensic-collect/1',
    });
  let pageCount = 1;
  if (opts.signal.aborted) {
    receipt('assessment', 'cancelled', 'Cancelled before extraction.');
    return { report: await forensicReport(bytes, [], coverage), previews, pageCount: 0 };
  }
  const cap = Math.max(1, Math.min(100, opts.pageCap ?? 6));
  const ocr = host.ocr;
  const ocrModel = ocr?.models().find((m) => /en/i.test(m.id)) ?? ocr?.models()[0];
  const ocrReady = !!ocr?.isAvailable() && !!ocrModel && (await ocr.cached(ocrModel.id));
  const { aiDetectStatus, scoreAiText } = await import('../lib/ai-detect.ts');
  const { aiDetectModel } = await import('../lib/ai-detect-models.ts');
  const modelReady = (await aiDetectStatus()) === 'ready';
  async function inspect(page: ForensicPage, blob?: Blob): Promise<void> {
    pages.push(page);
    if (blob) {
      const url = URL.createObjectURL(blob);
      previews.set(page.id, url);
      try {
        const frame = await decode(blob);
        if (!page.width || !page.height) {
          page.width = frame.sourceWidth;
          page.height = frame.sourceHeight;
        }
        const sx = page.width / frame.width,
          sy = page.height / frame.height;
        if (!page.text.trim()) {
          if (ocrReady && !opts.signal.aborted) {
            const result = await ocr!.run(
              { ...frame, data: new Uint8ClampedArray(frame.data) },
              { model: ocrModel!.id, signal: opts.signal }
            );
            page.source = 'ocr';
            page.text = result.text.slice(0, 65_536);
            page.lines = result.lines.map((l) => ({
              text: l.text,
              confidence: l.confidence,
              box: {
                x: l.box.x * (sx || 1),
                y: l.box.y * (sy || 1),
                width: l.box.w * (sx || 1),
                height: l.box.h * (sy || 1),
              },
            }));
            page.complete = false;
            receipt(
              'ocr',
              page.complete ? 'completed' : 'partial',
              'Local OCR; recognition and line boxes are estimates. Undetected text may remain unread.',
              page.id
            );
          } else {
            page.complete = false;
            receipt(
              'ocr',
              'unavailable',
              'Text was not read. Install the local OCR model and retry.',
              page.id
            );
          }
        }
        if (!opts.signal.aborted) {
          const detected = await cards(frame, opts.signal);
          if (!page.shapes.length) {
            page.shapes = detected.map((s) => ({
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
                x: s.box.x * (sx || 1),
                y: s.box.y * (sy || 1),
                width: s.box.width * (sx || 1),
                height: s.box.height * (sy || 1),
              },
            }));
            page.layoutMethod = 'decoded-pixels';
          }
          receipt(
            'pixel-layout',
            opts.signal.aborted ? 'cancelled' : 'partial',
            'Bounded accent-card segmentation. White-on-white cards and other layouts may be missed; maximum preview edge 1800 pixels.',
            page.id
          );
        }
      } catch (error) {
        page.complete = false;
        receipt(
          'pixel-layout',
          'failed',
          error instanceof Error ? error.message : String(error),
          page.id
        );
      }
    }
    if (opts.signal.aborted) {
      receipt(
        'assessment',
        'cancelled',
        'Cancelled after this page. Unread portions do not count as negative evidence.',
        page.id
      );
      return;
    }
    const language = forensicLanguage(page.text);
    if (page.docKind === 'code' || language !== 'english')
      receipt(
        'text-model',
        'skipped',
        page.docKind === 'code'
          ? 'Source code is outside the classifier population.'
          : `English classifier eligibility: ${language}.`,
        page.id
      );
    else if (!modelReady)
      receipt(
        'text-model',
        'unavailable',
        'The local text classifier is not cached. Download and retry to include it.',
        page.id
      );
    else {
      const estimate = await scoreAiText(page.text, { signal: opts.signal, chunks: true });
      if (estimate?.windows) {
        const roster = aiDetectModel();
        models.push({
          page: page.id,
          model: estimate.modelId,
          version: 'window-policy/3;onnx-wasm-basic',
          windows: estimate.windows,
          complete: estimate.complete === true,
          rawMean: estimate.probAi,
          threshold: estimate.threshold,
          ...(estimate.chunks?.length && roster
            ? {
                chunks: estimate.chunks,
                chunkThreshold: roster.chunkThreshold,
                chunkFloor: roster.chunkFloor,
                chunkVersion: FORENSIC_CHUNK_VERSION,
              }
            : {}),
        });
        coverage.push({
          collector: 'text-model',
          page: page.id,
          state: estimate.complete ? 'completed' : 'partial',
          reason: 'Raw classifier scores are observations, not authorship probabilities.',
          version: 'window-policy/3;onnx-wasm-basic',
          ranges: estimate.windows.map((w) => ({ index: w.index, length: w.length })),
        });
      } else
        receipt(
          'text-model',
          opts.signal.aborted ? 'cancelled' : 'failed',
          'The classifier did not return window coverage.',
          page.id
        );
    }
  }
  const makePage = (id: string, text = '', width = 0, height = 0): ForensicPage => ({
    id,
    width,
    height,
    text: text.slice(0, 65_536),
    source: 'digital',
    complete: text.length <= 65_536,
    lines: [],
    shapes: [],
  });
  try {
    if (/\.(pdf|pptx)$/i.test(file.name)) {
      const pptx = /\.pptx$/i.test(file.name);
      const handle = pptx
        ? await (await import('./pptx-import.ts')).openPptxFile(file)
        : await (await import('./pdf-import.ts')).openPdfFile(file);
      pageCount = handle.pageCount;
      for (let i = 0; i < Math.min(pageCount, cap) && !opts.signal.aborted; i++) {
        opts.progress?.(i, pageCount);
        try {
          const vector = await handle.pageToSvg(i),
            admitted = passiveForensicSvg(vector.svg);
          const native = handle.pageToText?.(i),
            page = makePage(
              String(i + 1),
              native?.text ?? admitted.lines.map((l) => l.text).join('\n'),
              vector.width,
              vector.height
            );
          page.lines =
            native?.lines?.map((l) => ({
              text: l.text,
              size: l.size,
              confidence: 0.8,
              box: { x: l.x, y: l.baseline - l.size, width: l.right - l.x, height: l.size * 1.2 },
            })) ?? admitted.lines;
          page.shapes = admitted.shapes;
          page.layoutMethod = 'source-geometry';
          receipt(
            'native-text',
            page.complete ? 'completed' : 'partial',
            'Native text; line bounds use glyph-width estimates.',
            page.id
          );
          receipt(
            'source-layout',
            'partial',
            'Supported rendered drawing subset; substituted fonts, unsupported objects and styles may affect layout.',
            page.id
          );
          await inspect(page, new Blob([admitted.svg], { type: 'image/svg+xml' }));
        } catch (error) {
          receipt(
            'page',
            'failed',
            error instanceof Error ? error.message : String(error),
            String(i + 1)
          );
        }
      }
      if (pages.length < pageCount)
        receipt(
          'pages',
          opts.signal.aborted ? 'cancelled' : 'partial',
          `${pages.length} of ${pageCount} pages inspected. Remaining pages are unread.`
        );
    } else if (/\.svg$/i.test(file.name)) {
      const admitted = passiveForensicSvg(new TextDecoder().decode(bytes)),
        page = makePage(
          '1',
          admitted.lines.map((l) => l.text).join('\n'),
          admitted.width,
          admitted.height
        );
      page.lines = admitted.lines;
      page.shapes = admitted.shapes;
      page.layoutMethod = 'source-geometry';
      if (admitted.partial) page.complete = false;
      receipt(
        'native-text',
        admitted.partial ? 'partial' : 'completed',
        'Passive SVG text; line widths and font metrics are estimates.',
        '1'
      );
      receipt(
        'source-layout',
        admitted.partial ? 'partial' : 'completed',
        'Passive SVG subset; external resources, CSS, scripts and unsupported transforms are excluded.',
        '1'
      );
      await inspect(page, new Blob([admitted.svg], { type: 'image/svg+xml' }));
    } else if (/\.(png|jpe?g|webp)$/i.test(file.name)) {
      await inspect(makePage('1'), file);
    } else if (/\.(txt|md|markdown|docx)$/i.test(file.name) || file.type.startsWith('text/')) {
      const word = /\.docx$/i.test(file.name);
      const text = word
        ? (await (await import('../lib/office-text.ts')).docxToMarkdown(bytes)).markdown
        : new TextDecoder().decode(bytes);
      const page = makePage('1', text);
      page.docKind =
        word || /\.(md|markdown)$/i.test(file.name)
          ? 'markdown'
          : analyzeTextSignals(page.text, { source: 'digital' }).docKind;
      receipt(
        'native-text',
        page.complete ? 'completed' : 'partial',
        page.complete ? 'Original document text.' : 'Text capped at 65,536 characters.',
        '1'
      );
      receipt('layout', 'unsupported', 'Reflowable text has no trustworthy page geometry.', '1');
      await inspect(page);
    } else
      receipt(
        'format',
        'unsupported',
        'AI assessment supports text, PNG, JPEG, WebP, SVG, PDF, PPTX and DOCX. Existing credential checks remain available.'
      );
  } catch (error) {
    receipt('extraction', 'failed', error instanceof Error ? error.message : String(error));
  }
  if (opts.signal.aborted)
    receipt(
      'assessment',
      'cancelled',
      'Inspection cancelled; collected evidence remains available.'
    );
  opts.progress?.(pages.length, pageCount);
  return {
    report: await forensicReport(bytes, pages, coverage, models, [], opts.origins ?? [], format),
    previews,
    pageCount,
  };
}
