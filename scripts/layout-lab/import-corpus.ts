// SPDX-License-Identifier: MPL-2.0
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { JSDOM } from 'jsdom';
import { ENGINE_VERSION } from '../../engine/src/version.ts';
import { censusDeck } from '../../engine/src/deck-census.ts';
import { decodePipelinePicture, readDeck, sourceHashOf } from '../../packages/node-shell/src/rebrand/pipeline.ts';
import { flattenedPictureOf, reconstructFlattenedSlide } from '../../packages/node-shell/src/rebrand/flattened.ts';
import { nodeFlattenedOcr } from '../../packages/node-shell/src/rebrand/ocr-node.ts';
import type { DeckCensusV1, SlideSourceV1, SourceDeckV1 } from '../../packages/core/src/rebrand-v1.ts';
import { caseFromSource, sourceText, type CorpusCase, type CorpusIndex, type OcrAudit } from './corpus.ts';

const args = process.argv.slice(2);
const directory = args.find(a => !a.startsWith('--'));
if (!directory) throw new Error('Usage: node scripts/layout-lab/import-corpus.ts <directory> [--ocr] [--render] [--out=directory] [--references=directory]');
const out = path.resolve(args.find(a => a.startsWith('--out='))?.slice(6) ?? '.scratch/layout-lab/real');
const references = path.resolve(args.find(a => a.startsWith('--references='))?.slice(13) ?? path.join(out, 'references'));
for (const folder of [out, references, path.join(out, 'cases'), path.join(out, 'previews'), path.join(out, 'pictures')]) mkdirSync(folder, { recursive: true });
const dom = new JSDOM('');
const parseXml = (s: string): Document => new dom.window.DOMParser().parseFromString(s, 'text/xml') as unknown as Document;
const json = <T>(file: string): T => JSON.parse(readFileSync(file, 'utf8')) as T;
const save = (file: string, value: unknown): void => { writeFileSync(file, JSON.stringify(value, null, 2)); };
const runner = args.includes('--ocr') ? await nodeFlattenedOcr() : undefined;
if (runner && !runner.ok) throw new Error(runner.message);
const index: CorpusIndex = { version: 1, created: new Date().toISOString(), engine: ENGINE_VERSION, decks: 0, cases: [], errors: [] };
const cases: CorpusCase[] = [];

function previewDeck(file: string, id: string, total: number): string | undefined {
  if (!args.includes('--render')) return;
  let pdf = file;
  if (/\.pptx$/i.test(file)) {
    pdf = path.join(references, path.basename(file).replace(/\.pptx$/i, '.pdf'));
    if (!existsSync(pdf)) execFileSync('soffice', [
      `-env:UserInstallation=${new URL(`file://${path.join(out, 'libreoffice-profile')}`).href}`,
      '--headless', '--convert-to', 'pdf:impress_pdf_Export:{"ExportHiddenSlides":{"type":"boolean","value":"true"}}', '--outdir', references, file,
    ], { timeout: 180_000, stdio: 'pipe' });
  }
  const info = execFileSync('pdfinfo', [pdf], { encoding: 'utf8', timeout: 20_000 });
  const pages = Number(/Pages:\s+(\d+)/.exec(info)?.[1]);
  if (pages !== total) return `Reference render has ${pages} pages but the source has ${total}; previews were not attached.`;
  const prefix = path.join(out, 'previews', `${id}-render`);
  if (!existsSync(path.join(out, 'previews', `${id}-p${total}.png`))) {
    execFileSync('pdftoppm', ['-scale-to', '1100', '-png', pdf, prefix], { timeout: 180_000, stdio: 'pipe' });
    for (const name of readdirSync(path.join(out, 'previews'))) {
      const match = new RegExp(`^${id}-render-(\\d+)\\.png$`).exec(name);
      if (match) renameSync(path.join(out, 'previews', name), path.join(out, 'previews', `${id}-p${Number(match[1])}.png`));
    }
  }
}

try {
  for (const name of readdirSync(directory).filter(n => /\.(pptx|pdf)$/i.test(n)).sort()) {
    const file = path.resolve(directory, name);
    try {
      const bytes = new Uint8Array(readFileSync(file));
      const hash = sourceHashOf(bytes);
      const id = hash.slice(7, 23);
      const cache = path.join(out, id);
      mkdirSync(cache, { recursive: true });
      let source: SourceDeckV1;
      let census: DeckCensusV1;
      let media: Record<string, { file: string; mime: string }>;
      const sourcePath = path.join(cache, 'source.json');
      const cached = existsSync(sourcePath) ? json<SourceDeckV1>(sourcePath) : undefined;
      if (cached?.source.hash === hash && cached.reader.version === ENGINE_VERSION) {
        source = cached; census = json(path.join(cache, 'census.json')); media = json(path.join(cache, 'media.json'));
      } else {
        const read = await readDeck({ name, bytes, parseXml, instanceId: 'layout-lab-corpus', flattened: 'keep' });
        source = read.source; census = read.census; media = {};
        for (const [ref, item] of read.media) {
          const mediaFile = ref.split('/').at(-1)!;
          writeFileSync(path.join(cache, mediaFile), item.bytes); media[ref] = { file: mediaFile, mime: item.mime };
        }
        save(sourcePath, source); save(path.join(cache, 'census.json'), census); save(path.join(cache, 'media.json'), media);
      }
      const previewWarning = previewDeck(file, id, source.slides.length);
      const ocrCache = path.join(cache, `ocr-${ENGINE_VERSION}.json`);
      const rebuilt = existsSync(ocrCache) ? json<Record<string, { slide: SlideSourceV1; audit: OcrAudit }>>(ocrCache) : {};
      for (const slide of source.slides) {
        if (!slide.origin.flattened || !runner?.ok || rebuilt[slide.id]) continue;
        const started = performance.now();
        const audit: OcrAudit = { state: 'not-run', model: runner.model, calls: 0, ms: 0, before: slide.objects.filter(o => sourceText(o).trim()).length, after: 0 };
        let recovered = slide;
        try {
          const pic = flattenedPictureOf(slide);
          const entry = pic?.media ? media[pic.media] : undefined;
          if (!entry) throw new Error('Rebrand did not identify one stored picture to rebuild.');
          const picture = await decodePipelinePicture(new Uint8Array(readFileSync(path.join(cache, entry.file))), entry.mime);
          if (!picture) throw new Error('The source picture could not be decoded.');
          const signal = AbortSignal.timeout(120_000);
          recovered = await reconstructFlattenedSlide({ slide, picture, ocrModel: runner.model, signal,
            ocr: async (frame, region) => { signal.throwIfAborted(); audit.calls++; return runner.ocr(frame, region); },
            sink: async (data, mime, hash) => {
              const ref = `user/media/${hash}`;
              writeFileSync(path.join(cache, hash), data); media[ref] = { file: hash, mime }; return ref;
            },
          });
          audit.state = recovered.ocr?.state ?? 'not-run';
          const confidences = recovered.objects.flatMap(o => o.ocr?.lines?.map(l => l.confidence) ?? []);
          if (confidences.length) audit.meanConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;
          audit.after = recovered.objects.filter(o => sourceText(o).trim()).length;
        } catch (error) { audit.error = error instanceof Error ? error.message : String(error); }
        audit.ms = Math.round(performance.now() - started);
        rebuilt[slide.id] = { slide: recovered, audit };
        save(ocrCache, rebuilt); save(path.join(cache, 'media.json'), media);
        console.log(`${name} / ${slide.index + 1}: OCR ${audit.state}, ${audit.after} text objects, ${audit.calls} calls, ${audit.ms} ms${audit.error ? `; ${audit.error}` : ''}`);
      }
      const effective = { ...source, slides: source.slides.map(s => rebuilt[s.id]?.slide ?? s) };
      const readCensus = Object.keys(rebuilt).length ? censusDeck(effective) : census;
      for (const slide of effective.slides) {
        const one = caseFromSource(name, `${id}-p${slide.index + 1}`, slide, readCensus, rebuilt[slide.id]?.audit);
        one.preview = existsSync(path.join(out, 'previews', `${one.id}.png`));
        const picture = slide.objects.find(o => o.id === one.brief?.image?.id);
        const held = picture?.media ? media[picture.media] : undefined;
        const ext = held ? ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' } as Record<string, string>)[held.mime] : undefined;
        if (held && ext && picture) {
          const pictureFile = `${one.id}.${ext}`;
          writeFileSync(path.join(out, 'pictures', pictureFile), readFileSync(path.join(cache, held.file)));
          one.picture = { id: picture.id, file: pictureFile };
        }
        if (previewWarning) one.warnings.push(previewWarning);
        save(path.join(out, 'cases', `${one.id}.json`), one);
        cases.push(one);
        const { brief: _brief, readout: _readout, features: _features, baseline: _baseline, ocr: _ocr, warnings: _warnings, picture: _picture, ...row } = one;
        index.cases.push(row);
      }
      index.decks++;
      save(path.join(out, 'index.json'), index);
      console.log(`${name}: ${source.slides.length} slides, ${index.cases.filter(c => c.deck === name && c.status === 'ready').length} within the first layout contract`);
    } catch (error) {
      index.errors.push({ name, error: error instanceof Error ? error.message : String(error) });
      save(path.join(out, 'index.json'), index);
      console.error(`${name}: ${String(error)}`);
    }
  }
  const count = (predicate: (c: CorpusCase) => boolean): number => cases.filter(predicate).length;
  const summary = {
    decks: index.decks, slides: cases.length, ready: count(c => c.status === 'ready'), inspect: count(c => c.status === 'inspect'),
    flattened: count(c => c.categories.includes('flattened')), ocrRun: count(c => !!c.ocr), ocrTextFound: count(c => c.mode === 'ocr'),
    previews: count(c => c.preview), errors: index.errors,
    reasons: Object.fromEntries([...new Set(cases.flatMap(c => c.reasons))].map(reason => [reason, count(c => c.reasons.includes(reason))])),
    accuracy: null, accuracyNote: 'No independent labels or verified OCR transcripts. Coverage is not accuracy.',
  };
  save(path.join(out, 'summary.json'), summary);
  console.log(JSON.stringify(summary, null, 2));
} finally { dom.window.close(); }
