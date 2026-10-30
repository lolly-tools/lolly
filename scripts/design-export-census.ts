// SPDX-License-Identifier: MPL-2.0
/**
 * design-export-census - which Design frames each export route would carry today
 * (plan 326): the drawing operations as SVG, the drawing operations as PDF, and the
 * GPU page renderer for pixels, with every refusal counted by its finding.
 *
 *   node scripts/design-export-census.ts                         # shipped templates + drawing fidelity pages
 *   node scripts/design-export-census.ts ~/Downloads/*.lolly     # plus saved sessions (.lolly, or session .json)
 *   node scripts/design-export-census.ts --json --out=plans/326-validation/census.json <files...>
 *
 * Read-only. Colours written as `var(--x, #fallback)` resolve to their fallback, and a
 * readable one-pixel bitmap stands in for every still picture, so the counts are an
 * upper bound on admission: a real brand or picture can only add refusals. Saved
 * sessions are listed by a digest of their path, never by name, because the census of
 * someone's own documents belongs to them; the report holds counts and the findings' feature words only.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { designFrames, designPageDrawing, type DesignPageSvgHost } from '../engine/src/design-page-svg.ts';
import { designDrawPdfFindings } from '../engine/src/design-draw-pdf.ts';
import { prepareDesignRaster } from '../engine/src/design-draw-raster.ts';
import { createNodeTextShaper } from '../packages/node-shell/src/text-measure.ts';
import { createNodeTextAPI, nodeStrikeMetrics } from '../packages/node-shell/src/text.ts';
import { readLollyFile } from '../packages/node-shell/src/lolly-file.ts';
import { fidelityPages, fidelityPictures } from '../tests/helpers/design-fidelity.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const asJson = args.includes('--json');
const outArg = args.find((a) => a.startsWith('--out='))?.slice('--out='.length);
const inputs = args.filter((a) => !a.startsWith('--'));

/** One-pixel opaque PNG, the stand-in for any still picture. */
const STAND_IN = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));
const MOTION = /\.(json|lottie|mp4|m4v|mov|webm)($|\?|#)/i;
const SOUND = /\.(mp3|wav|ogg|m4a|flac)($|\?|#)/i;

const text = createNodeTextAPI({ repoRoot: ROOT });
function hostFor(pictures?: Record<string, { url: string; width: number; height: number }>): DesignPageSvgHost {
  return {
    shaper: createNodeTextShaper({ repoRoot: ROOT }),
    toPath: (o) => text.toPath(o as never),
    strikeMetrics: (url, variations) => nodeStrikeMetrics(url, variations, ROOT),
    picture: async (ref) => {
      if (SOUND.test(ref)) return { media: 'audio' };
      if (MOTION.test(ref)) return { media: 'motion' };
      const known = pictures?.[ref];
      if (known) return { bytes: Uint8Array.from(Buffer.from(known.url.slice(known.url.indexOf(',') + 1), 'base64')), width: known.width, height: known.height };
      return { bytes: STAND_IN, width: 1, height: 1 };
    },
    resolveColor: (css) => /#[0-9a-f]{3,8}\b/i.exec(css)?.[0] ?? null,
  };
}

interface FrameRow { corpus: string; source: string; frame: string; svg: string[]; pdf: string[]; gpu: string[]; pictures: number; compileMs: number; admitMs: number; ops: number }
const rows: FrameRow[] = [];
const errors: string[] = [];

async function censusDocument(corpus: string, source: string, values: Record<string, unknown>, host: DesignPageSvgHost): Promise<void> {
  let frames: Array<{ id: string; width: number; height: number }>;
  try { frames = designFrames(values); } catch (error) { errors.push(`${source}: ${(error as Error).message}`); return; }
  const composes = String(values.textDocument ?? '').trim() !== '';
  for (const f of frames) {
    const started = performance.now();
    let drawing: Awaited<ReturnType<typeof designPageDrawing>>;
    try { drawing = await designPageDrawing(values, f.id, host, { dpi: 96 }); } catch (error) { errors.push(`${source}#${f.id}: ${(error as Error).message}`); continue; }
    const compileMs = performance.now() - started;
    const svg: string[] = [...new Set(drawing.findings.map((x) => x.feature))];
    if (composes) svg.push('composed-story');
    const pdf = [...new Set([...svg, ...designDrawPdfFindings(drawing.page, drawing.pictures).map((x) => x.feature)])];
    const admitStart = performance.now();
    const admitted = prepareDesignRaster(drawing.page, { width: drawing.frame.width, height: drawing.frame.height, dpi: 96 });
    const admitMs = performance.now() - admitStart;
    const gpu = admitted.ok ? (composes ? ['composed-story'] : []) : [...new Set(admitted.findings.map((x) => x.feature))];
    const pictures = [...(drawing.page.frame ? [drawing.page.frame] : []), ...drawing.page.ops].filter((op) => op.picture).length;
    rows.push({ corpus, source, frame: f.id, svg, pdf, gpu, pictures, compileMs, admitMs, ops: drawing.page.ops.length });
  }
}

/** Saved sessions are named by a digest of their path; their content never leaves this machine. */
const anonymous = (path: string): string => `session-${createHash('sha256').update(resolve(path)).digest('hex').slice(0, 10)}`;

function sessionFiles(path: string): string[] {
  const stat = statSync(path);
  if (stat.isDirectory()) return readdirSync(path).flatMap((name) => sessionFiles(join(path, name)));
  return ['.lolly', '.json'].includes(extname(path).toLowerCase()) ? [path] : [];
}

function sessionValues(path: string): Record<string, unknown> | null {
  const bytes = readFileSync(path);
  if (extname(path).toLowerCase() === '.lolly') {
    const file = readLollyFile(new Uint8Array(bytes));
    return file.manifest.tool?.id === 'design' ? file.session : null;
  }
  const json = JSON.parse(bytes.toString('utf8')) as Record<string, unknown>;
  const values = (json.values ?? json) as Record<string, unknown>;
  return Array.isArray(values.boxes) ? values : null;
}

const templatesDir = join(ROOT, 'community/design/templates');
const templateHost = hostFor();
for (const file of readdirSync(templatesDir).filter((f) => f.endsWith('.json')).sort()) {
  const t = JSON.parse(readFileSync(join(templatesDir, file), 'utf8')) as { values?: Record<string, unknown> };
  await censusDocument('templates', file, t.values ?? {}, templateHost);
}
const fixtureHost = hostFor(fidelityPictures());
for (const page of fidelityPages()) await censusDocument('fidelity', page.name, { boxes: page.rows }, fixtureHost);
let skipped = 0;
for (const path of inputs.flatMap(sessionFiles)) {
  try {
    const values = sessionValues(path);
    if (!values) { skipped++; continue; }
    await censusDocument('sessions', anonymous(path), values, templateHost);
  } catch (error) { errors.push(`${anonymous(path)}: ${(error as Error).message}`); }
}

const pct = (n: number, of: number) => (of ? `${Math.round(100 * n / of)}%` : '-');
const quantile = (values: number[], q: number) => { const s = [...values].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))]! : 0; };
const summary = ['templates', 'fidelity', 'sessions'].map((corpus) => {
  const mine = rows.filter((r) => r.corpus === corpus);
  const why = (key: 'svg' | 'pdf' | 'gpu') => Object.fromEntries([...mine.flatMap((r) => r[key]).reduce((m, k) => m.set(k, (m.get(k) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1]));
  return {
    corpus, documents: new Set(mine.map((r) => r.source)).size, frames: mine.length,
    admitted: { svg: mine.filter((r) => !r.svg.length).length, pdf: mine.filter((r) => !r.pdf.length).length, gpu: mine.filter((r) => !r.gpu.length).length },
    framesWithPictures: mine.filter((r) => r.pictures).length,
    refusals: { svg: why('svg'), pdf: why('pdf'), gpu: why('gpu') },
    compileMs: { p50: quantile(mine.map((r) => r.compileMs), 0.5), p95: quantile(mine.map((r) => r.compileMs), 0.95) },
    admitMs: { p50: quantile(mine.map((r) => r.admitMs), 0.5), p95: quantile(mine.map((r) => r.admitMs), 0.95) },
  };
});

const report = { date: new Date().toISOString(), upperBound: 'colours by their CSS fallback, a readable stand-in for every still picture', summary, frames: rows, skipped, errors };
const textReport = [
  ...summary.map((s) => `${s.corpus}: ${s.documents} documents, ${s.frames} frames; operations SVG ${s.admitted.svg} (${pct(s.admitted.svg, s.frames)}), PDF ${s.admitted.pdf} (${pct(s.admitted.pdf, s.frames)}), GPU ${s.admitted.gpu} (${pct(s.admitted.gpu, s.frames)}); ${s.framesWithPictures} frames hold pictures; compile p50 ${s.compileMs.p50.toFixed(1)} ms p95 ${s.compileMs.p95.toFixed(1)} ms, GPU admission p50 ${s.admitMs.p50.toFixed(1)} ms p95 ${s.admitMs.p95.toFixed(1)} ms\n`
    + (['svg', 'pdf', 'gpu'] as const).map((k) => `  ${k.toUpperCase()} refusals: ${Object.entries(s.refusals[k]).map(([f, n]) => `${f} ${n}`).join('; ') || 'none'}`).join('\n')),
  ...rows.map((r) => `${r.corpus} ${r.source}#${r.frame}: svg[${r.svg}] pdf[${r.pdf}] gpu[${r.gpu}]`),
  ...(skipped ? [`skipped ${skipped} files that are not Design sessions`] : []),
  ...errors.map((e) => `error ${e}`),
].join('\n');
const output = asJson ? JSON.stringify(report, null, 2) : textReport;
if (outArg) { mkdirSync(dirname(resolve(outArg)), { recursive: true }); writeFileSync(resolve(outArg), output + '\n'); console.log(`${basename(outArg)}: ${rows.length} frames`); }
else console.log(output);
