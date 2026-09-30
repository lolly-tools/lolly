// SPDX-License-Identifier: MPL-2.0
/** Paginated, searchable report pages with local previews and explicit evidence scope. */
import {
  productionCheckLabel,
  productionCheckReason,
  productionCheckValue,
} from './valid-production-copy.ts';
import {
  PDFDocument,
  PDFName,
  PDFString,
  StandardFonts,
  rgb,
  type PDFPage,
  type PDFFont,
  type PDFRef,
} from 'pdf-lib';
import type { ForensicReport, ForensicAnnotation } from '../../../../engine/src/forensic.ts';
import type { ProductionReport } from '../../../../engine/src/production.ts';

import type { ReportTheme } from './valid-report-theme.ts';

export interface VerifyPdfInput {
  theme?: ReportTheme;
  name: string;
  verdict: string;
  timestamp: string;
  sha256: string;
  sections: { title: string; text: string }[];
  preview?: Uint8Array;
  textPreview?: string;
  map?: { image: Uint8Array; coordinates: string };
  forensic?: {
    report: ForensicReport;
    annotations: ForensicAnnotation[];
    pageCount: number;
    previews: Map<string, Uint8Array>;
    imported?: boolean;
  };
  production?: ProductionReport;
  signing: string;
}
const W = 595.28,
  H = 841.89,
  M = 44,
  BOTTOM = 786,
  WIDTH = W - M * 2;

/** Convert only an already-local preview to a bounded print image. No remote fetches. */
export async function reportPreviewPng(url: string): Promise<Uint8Array> {
  if (!/^(?:blob:|data:image\/)/i.test(url)) throw new Error('Report previews must be local.');
  const image = new Image();
  image.src = url;
  await image.decode();
  const scale = Math.min(2, 1800 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error('Preview conversion failed.'))),
      'image/png'
    )
  );
  return new Uint8Array(await blob.arrayBuffer());
}

export async function buildVerifyPdf(input: VerifyPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const theme = input.theme;
  const color = (css: string) => {
    const context = document.createElement('canvas').getContext('2d')!;
    context.fillStyle = css;
    context.fillRect(0, 0, 1, 1);
    const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
    return rgb(r! / 255, g! / 255, b! / 255);
  };
  const ink = color(theme?.ink || '#102e29'), muted = color(theme?.muted || '#52615e'),
    line = color(theme?.line || '#d1dbd6'), accent = color(theme?.accent || '#0a6e52'),
    paper = color(theme?.paper || '#ffffff'), surface = color(theme?.surface || '#f7faf9');
  if (theme?.regular || theme?.bold) {
    const { default: fontkit } = await import('@pdf-lib/fontkit');
    doc.registerFontkit(fontkit);
  }
  const regular = await doc.embedFont(theme?.regular || StandardFonts.Helvetica, { subset: true }),
    bold = await doc.embedFont(theme?.bold || StandardFonts.HelveticaBold, { subset: true });
  const rasterFont = (font: PDFFont) => !!theme && !(font === bold ? theme.bold : theme.regular);
  const family = theme?.family || 'sans-serif';
  doc.setTitle(`Verification - ${input.name}`);
  doc.setAuthor('Lolly');
  doc.setCreator('Lolly Verify');
  doc.setSubject(`Local verification of SHA-256 ${input.sha256}`);
  let page: PDFPage,
    y = M;
  const pending: Promise<void>[] = [];
  const associated: PDFRef[] = [];
  const attach = (value: unknown, name: string) => {
    const stream = doc.context.register(
      doc.context.flateStream(new TextEncoder().encode(JSON.stringify(value, null, 2)), {
        Type: 'EmbeddedFile',
        Subtype: 'application/json',
      })
    );
    associated.push(
      doc.context.register(
        doc.context.obj({
          Type: 'Filespec',
          F: PDFString.of(name),
          UF: PDFString.of(name),
          AFRelationship: 'Data',
          EF: { F: stream },
        })
      )
    );
  };
  const newPage = () => {
    page = doc.addPage([W, H]);
    page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: paper });
    y = M;
  };
  newPage();
  const ensure = (height: number) => {
    if (y + height > BOTTOM) newPage();
  };
  const canvas = document.createElement('canvas'),
    ctx = canvas.getContext('2d')!;
  const width = (value: string, size: number, font: PDFFont) => {
    try {
      if (rasterFont(font)) throw new Error('Use the active browser font.');
      return font.widthOfTextAtSize(value, size);
    } catch {
      ctx.font = `${font === bold ? '600' : '400'} ${size}px ${family}`;
      return ctx.measureText(value).width;
    }
  };
  const draw = (
    value: string,
    x: number,
    top: number,
    size = 10,
    font = regular,
    color = ink,
    target = page
  ) => {
    try {
      if (rasterFont(font)) throw new Error('Use the active browser font.');
      target.drawText(value, { x, y: H - top - size, size, font, color });
    } catch {
      // Keep scripts outside WinAnsi readable with a print-resolution local glyph strip.
      const raster = document.createElement('canvas');
      raster.width = Math.ceil(width(value, size, font) * 3 + 6);
      raster.height = Math.ceil(size * 4.5);
      const paint = raster.getContext('2d')!;
      paint.scale(3, 3);
      paint.font = `${font === bold ? '600' : '400'} ${size}px ${family}`;
      paint.textBaseline = 'top';
      paint.fillStyle = `rgb(${color.red * 255}, ${color.green * 255}, ${color.blue * 255})`;
      // Preserve searchable Latin text beneath browser-rendered font glyphs.
      try { target.drawText(value, { x, y: H - top - size, size, font, opacity: 0 }); } catch { /* Other scripts retain their visible glyphs. */ }
      paint.fillText(value, 0, 0);
      pending.push(
        (async () => {
          const image = await doc.embedPng(raster.toDataURL());
          target.drawImage(image, {
            x,
            y: H - top - raster.height / 3,
            width: raster.width / 3,
            height: raster.height / 3,
          });
        })()
      );
    }
  };
  const lines = (value: string, size: number, font: PDFFont, maxWidth = WIDTH): string[] => {
    const result: string[] = [];
    for (const paragraph of value.replace(/\t/g, '  ').split('\n')) {
      let current = '';
      for (const word of paragraph.split(/\s+/)) {
        if (width(`${current} ${word}`.trim(), size, font) <= maxWidth)
          current = `${current} ${word}`.trim();
        else {
          if (current) result.push(current);
          current = '';
          for (const char of word) {
            if (width(current + char, size, font) > maxWidth && current) {
              result.push(current);
              current = '';
            }
            current += char;
          }
        }
      }
      result.push(current);
    }
    return result;
  };
  const text = (value: string, size = 10, font = regular, color = ink) => {
    for (const row of lines(value, size, font)) {
      ensure(size * 1.5);
      draw(row, M, y, size, font, color);
      y += size * 1.5;
    }
    y += 7;
  };
  const heading = (title: string, following = 36) => {
    ensure(40 + following);
    y += 10;
    text(title, 18, bold);
  };
  const image = async (bytes: Uint8Array, maxHeight = 290) => {
    const embedded = await doc.embedPng(bytes),
      scale = Math.min(WIDTH / embedded.width, maxHeight / embedded.height);
    const w = embedded.width * scale,
      h = embedded.height * scale;
    ensure(h + 16);
    const top = y,
      x = M + (WIDTH - w) / 2;
    page.drawRectangle({
      x: M,
      y: H - y - h,
      width: WIDTH,
      height: h,
      color: surface,
    });
    page.drawImage(embedded, { x, y: H - y - h, width: w, height: h });
    y += h + 16;
    return { x, top, w, h, page };
  };
  const ring = (
    value: number | null,
    label: string,
    title: string,
    caption: string,
    x: number,
    top: number
  ) => {
    const cx = x + 22,
      cy = H - top - 22;
    page.drawCircle({ x: cx, y: cy, size: 20, borderColor: line, borderWidth: 3 });
    if (value !== null)
      for (let i = 0; i < Math.min(100, Math.max(0, value)); i++) {
        const a = (i / 100) * Math.PI * 2,
          b = ((i + 1) / 100) * Math.PI * 2;
        page.drawLine({
          start: { x: cx + Math.sin(a) * 20, y: cy + Math.cos(a) * 20 },
          end: { x: cx + Math.sin(b) * 20, y: cy + Math.cos(b) * 20 },
          thickness: 3,
          color: accent,
        });
      }
    draw(label, cx - width(label, 12, bold) / 2, top + 14, 12, bold);
    draw(title, x + 55, top + 3, 11, bold);
    draw(caption, x + 55, top + 23, 9, regular, muted);
  };
  text('Verification', 30, bold);
  text(input.name, 16, bold);
  text(input.verdict, 12);
  text(
    new Date(input.timestamp).toLocaleString('en-GB', {
      dateStyle: 'long',
      timeStyle: 'short',
      timeZone: 'UTC',
    }) + ' UTC',
    9,
    regular,
    muted
  );
  if (input.preview) await image(input.preview, 245);
  else if (input.textPreview) {
    text(input.textPreview, 10, regular, muted);
    text('Text preview from Verify.', 9, regular, muted);
  }
  heading('Assessment');
  const forensic = input.forensic;
  if (forensic) {
    const { report } = forensic;
    ensure(70);
    ring(
      report.evidence.score,
      String(report.evidence.score),
      'Evidence',
      report.evidence.band,
      M,
      y
    );
    ring(
      report.likelihood.state === 'calibrated' ? report.likelihood.probability * 100 : null,
      report.likelihood.state === 'calibrated'
        ? `${Math.round(report.likelihood.probability * 100)}%`
        : '?',
      'AI probability',
      report.likelihood.state === 'calibrated' ? 'Calibrated' : 'Not estimable',
      M + WIDTH / 2,
      y
    );
    y += 65;
    text(
      `${report.pages.length} of ${forensic.pageCount} pages inspected. Evidence strength is a clue index, not AI probability. Patterns can occur in human work.`,
      10,
      regular,
      muted
    );
    if (forensic.imported)
      text(
        'Imported assessment. File and report hashes match; conclusions were not recomputed.',
        10,
        bold
      );
  } else
    text(
      'AI inspection has not run. No AI confidence is assigned. Use Inspect in Verify, then export again.'
    );
  text(input.signing, 9, regular, muted);
  if (input.map) {
    heading('Location', 235);
    await image(input.map.image, 210);
    text(input.map.coordinates, 13, bold);
    text(
      'EXIF coordinates are editable metadata. This offline map shows the recorded location, not verified capture provenance.',
      10,
      regular,
      muted
    );
  }
  for (const section of input.sections) {
    if (section.text.trim()) {
      heading(section.title);
      text(section.text);
    }
  }
  if (input.production) {
    heading('Production');
    for (const check of input.production.checks) {
      ensure(60);
      text(
        `${productionCheckLabel(check)}: ${check.state === 'pass' ? 'Passed' : check.state === 'fail' ? 'Mismatch' : 'Unchecked'}`,
        11,
        bold
      );
      text(
        `${productionCheckReason(check)}${check.expected !== undefined ? ` Expected: ${productionCheckValue(check, check.expected)}.` : ''}${check.actual !== undefined ? ` Measured: ${productionCheckValue(check, check.actual)}.` : ''}`,
        10,
        regular,
        muted
      );
    }
  }
  if (forensic) {
    const { report } = forensic;
    for (const source of report.pages) {
      if (forensic.previews.has(source.id)) newPage();
      else ensure(160);
      text(`Page ${source.id}`, 26, bold);
      const findings = report.findings.filter((f) => f.locations.some((l) => l.page === source.id));
      text(
        `AI probability: not estimable for this page. ${findings.length} evidence families observed.`,
        11
      );
      const preview = forensic.previews.get(source.id);
      if (preview) {
        const area = await image(preview, 330);
        if (source.width > 0 && source.height > 0)
          for (const finding of findings)
            for (const location of finding.locations) {
              if (location.page !== source.id || !location.box) continue;
              const b = location.box;
              const left = Math.max(0, Math.min(source.width, b.x)),
                top = Math.max(0, Math.min(source.height, b.y));
              const w = Math.max(0, Math.min(source.width, b.x + b.width) - left),
                h = Math.max(0, Math.min(source.height, b.y + b.height) - top);
              area.page.drawRectangle({
                x: area.x + (left / source.width) * area.w,
                y: H - area.top - ((top + h) / source.height) * area.h,
                width: (w / source.width) * area.w,
                height: (h / source.height) * area.h,
                borderColor: accent,
                borderWidth: 1,
              });
            }
      } else if (source.text) {
        heading('Text');
        text(source.text.slice(0, 1200), 10);
        if (source.text.length > 1200)
          text(
            'First 1,200 characters shown. The associated evidence file retains the full recovered text.',
            9,
            regular,
            muted
          );
      } else text('Visual preview unavailable for this page.', 10, regular, muted);
      if (!findings.length)
        text('No clues found in the inspected content. This does not establish human authorship.');
      for (const finding of findings) {
        const observations = finding.observations?.filter((o) =>
          o.locations.some((l) => l.page === source.id)
        );
        const confidence = observations?.length
          ? Math.max(...observations.map((o) => o.confidence))
          : finding.confidence;
        heading(finding.label, 95);
        ensure(65);
        ring(
          confidence * 100,
          String(Math.round(confidence * 100)),
          'Pattern confidence',
          'Feature match, not authorship',
          M,
          y
        );
        y += 58;
        text(
          finding.locations[0]?.page === source.id
            ? finding.detail
            : 'The same pattern was located on this page. See the marked region and attached measurements.'
        );
        text(
          `${finding.contribution === 'context-excluded' ? 'Excluded from the evidence index' : finding.contribution === 'specific-artifact' ? 'Specific artifact' : 'Weak clue'}. ${finding.alternatives.join(' ')}`,
          10,
          regular,
          muted
        );
        for (const note of forensic.annotations.filter((a) => a.finding === finding.id))
          text(`Review: ${note.kind}. ${note.note}`);
      }
      const coverage = report.coverage.filter((c) => !c.page || c.page === source.id);
      heading('Coverage');
      for (const check of coverage)
        text(`${check.collector}: ${check.state}. ${check.reason}`, 9, regular, muted);
    }
    if (forensic.pageCount > report.pages.length) {
      heading('Unread pages');
      text(
        `${forensic.pageCount - report.pages.length} pages were outside this inspection. No AI confidence is assigned to unread pages. Choose Inspect to read more pages before exporting again.`
      );
    }
    heading('Method');
    text(report.limitations.join('\n'));
    text(`Rules: ${report.version}\nEvidence SHA-256: ${report.reportSha256}`, 9, regular, muted);
    for (const model of report.models)
      text(
        `${model.model}: raw score ${model.windows.length ? model.windows.map((w) => w.rawScore.toFixed(4)).join(', ') : 'unavailable'}. Raw scores are not AI probabilities.`,
        9,
        regular,
        muted
      );
    attach({ report, annotations: forensic.annotations }, 'evidence.json');
  }
  heading('Record');
  text(`File SHA-256\n${input.sha256}\nCreated ${input.timestamp}`, 9, regular, muted);
  text(
    'The signature protects this report. It does not certify the source file or prove authorship. Open this PDF in Lolly Verify to inspect its Content Credentials.',
    10
  );
  if (input.production) attach(input.production, 'production.json');
  if (associated.length) doc.catalog.set(PDFName.of('AF'), doc.context.obj(associated));
  const pages = doc.getPages();
  for (const [i, target] of pages.entries()) {
    target.drawLine({
      start: { x: M, y: 39 },
      end: { x: W - M, y: 39 },
      color: line,
      thickness: 0.5,
    });
    draw('Lolly / Verify', M, H - 31, 8, regular, muted, target);
    draw(`${i + 1} / ${pages.length}`, W - M - 38, H - 31, 8, regular, muted, target);
  }
  await Promise.all(pending);
  return doc.save({ useObjectStreams: false });
}
