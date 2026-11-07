// SPDX-License-Identifier: MPL-2.0
/**
 * The "Choose the format last" figure: one Lolly Demo piece, five files Lolly made from
 * it, each drawn by the program a recipient would open it in. Nothing in a panel is
 * mocked up. The landing shows the five panels in a row; the formats page shows them
 * with the reader that drew each one and the original file to download.
 *
 *   slide  the Design document as PPTX (Lolly Design, from the Lolly Demo slide master),
 *          drawn by LibreOffice Impress, converted to vector SVG by pdftocairo
 *   page   Lolly Doc Studio's DOCX, drawn by LibreOffice Writer, then pdftocairo.
 *          Design does not write DOCX, so the page is Doc Studio's own piece with the
 *          same words; the figure says so
 *   svg    the Design document's own SVG, text outlined, drawn by the browser
 *   video  one frame of the Design document's MP4, taken by FFmpeg at two seconds.
 *          RASTER: a video frame is pixels by nature
 *   print  the Design document's Print PDF, separated by Ghostscript's tiffsep device
 *          into cyan, magenta, yellow and black plates. RASTER: tiffsep draws each
 *          plate as pixels, the way a press RIP sees the file. Lolly Demo's colours
 *          also carry named spot inks; -dMaxSpots=0 folds them into the four process
 *          plates through the alternate CMYK the PDF gives each one
 *
 * LibreOffice is given Lolly Demo's own open fonts (the OFL files in the brand pack) in a
 * throwaway profile, the way a recipient who installed them would see the deck and the
 * page. The DOCX sets the design system's faces in its styles and is laid out on A4,
 * the size Doc Studio's page is set to.
 *
 * Needs: a web shell built on the lolly-demo profile (`LOLLY_PROFILE=lolly-demo pnpm
 * run build:web`), LibreOffice (soffice), poppler (pdftocairo), Ghostscript, FFmpeg and
 * ImageMagick. Recipes stay beside the outputs in docs/figures/; run from the repo root:
 *
 *   node scripts/build-format-last-art.ts [--keep=<dir>]
 *
 * --keep copies the five original files (pptx, docx, svg, mp4, pdf) into <dir> as well.
 */
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { artC2paOpts, signDocsArt, type ArtMeta } from './sign-docs-art.ts';
import { embedC2pa } from '../engine/src/c2pa.ts';
import { verifyC2pa } from '../engine/src/c2pa-verify.ts';
import { svgoThumb } from './optimize-preview-svg.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const figures = resolve(root, 'docs/figures');
const ID = 'formats-last';
const keep = process.argv.find((a) => a.startsWith('--keep='))?.slice('--keep='.length);
const work = mkdtempSync(join(tmpdir(), 'format-last-'));
const env = { ...process.env, LOLLY_PROFILE: 'lolly-demo' };
const run = (cmd: string, args: string[], opts: { env?: NodeJS.ProcessEnv } = {}): string =>
  execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'inherit'], env: opts.env ?? process.env }).toString();
const lolly = (args: string[]): void => {
  execFileSync(process.execPath, [resolve(root, 'shells/cli/bin/lolly.ts'), ...args], { stdio: 'inherit', env });
};
const version = (cmd: string, args: string[], re: RegExp): string => re.exec(run(cmd, args))?.[1] ?? '';

// ── The piece ──────────────────────────────────────────────────────────────────
// One Design document (the slide master's main-point archetype, so the deck has real
// title and subtitle placeholders in the brand's faces) and Doc Studio's page with the
// same words. The circles are fully rounded boxes, which every format writes as a
// circle, including PowerPoint's own rounded rectangle.
const design = resolve(figures, `${ID}.design.json`);
const doc = resolve(figures, `${ID}.doc.json`);

// ── 1. Lolly makes the five files ──────────────────────────────────────────────
const out = (ext: string): string => resolve(figures, `${ID}.${ext}`);
lolly(['run', 'design', `--document=${design}`, '--export=pptx', `--output=${out('pptx')}`]);
lolly(['run', 'design', `--document=${design}`, '--convertPaths=true', '--c2pa=off', '--meta=off',
  '--export=svg', `--output=${resolve(figures, `${ID}-svg.svg`)}`]);
lolly(['run', 'design', `--document=${design}`, '--export=mp4', '--fps=24', '--seconds=4', '--codec=h264',
  '--width=1280', '--height=720', `--output=${out('mp4')}`]);
lolly(['run', 'design', `--document=${design}`, '--convertPaths=true', '--export=pdf-cmyk',
  `--output=${resolve(figures, `${ID}-print.pdf`)}`]);
lolly(['run', 'doc-studio', '--docTitle=Riverside Garden Day',
  `--content=${JSON.stringify(JSON.parse(readFileSync(doc, 'utf8')))}`, '--export=docx', `--output=${out('docx')}`]);

// The bank refuses URLs in prose: keep the generator description, drop the source URL.
const svgPanel = resolve(figures, `${ID}-svg.svg`);
writeFileSync(svgPanel, readFileSync(svgPanel, 'utf8')
  .replace(/<desc>Made with https:\/\/lolly\.tools : Design([^<]*)<\/desc>/, '<desc>Made with Lolly Design$1</desc>')
  .replace(/<dc:source>https:\/\/lolly\.tools\/t\/design<\/dc:source>/, ''));

// ── 2. Each file goes through its own reader ───────────────────────────────────
// LibreOffice, in a profile of its own holding the brand pack's OFL fonts.
const profile = resolve(work, 'lo-profile');
mkdirSync(resolve(profile, 'user/fonts'), { recursive: true });
const fontDir = resolve(root, 'brands/lolly-demo/catalog/fonts');
for (const f of readdirSync(fontDir).filter((n) => n.endsWith('.ttf'))) copyFileSync(resolve(fontDir, f), resolve(profile, 'user/fonts', f));
const office = (src: string, name: string): string => {
  const at = resolve(work, name);
  copyFileSync(src, at);
  run('soffice', [`-env:UserInstallation=file://${profile}`, '--headless', '--convert-to', 'pdf', '--outdir', work, at]);
  return at.replace(/\.[a-z]+$/, '.pdf');
};
// pdftocairo turns the reader's page into vector SVG; the thumbnail optimiser then
// rounds coordinates to 0.01 of a unit, which nobody can see at any zoom the page offers.
const toSvg = (pdf: string, name: string): void => {
  const target = resolve(figures, `${ID}-${name}.svg`);
  run('pdftocairo', ['-svg', '-f', '1', '-l', '1', pdf, target]);
  writeFileSync(target, svgoThumb(readFileSync(target, 'utf8')));
};
toSvg(office(out('pptx'), 'slide.pptx'), 'slide');
toSvg(office(out('docx'), 'page.docx'), 'page');

// FFmpeg: the frame at two seconds, where the circles are furthest from rest. FFmpeg
// writes it as a PNG and cwebp encodes the WebP, since not every FFmpeg build has libwebp.
const frame = resolve(work, 'frame.png');
run('ffmpeg', ['-v', 'error', '-y', '-ss', '2', '-i', out('mp4'), '-frames:v', '1', '-vf', 'scale=960:540', frame]);
run('cwebp', ['-quiet', '-q', '82', frame, '-o', resolve(figures, `${ID}-video.webp`)]);

// Ghostscript: the four process plates, each tinted in its ink and set in a 2 x 2 grid
// (cyan, magenta / yellow, black). Dark in a plate is ink, so +level-colors maps black
// to the ink and white to paper.
const sep = resolve(work, 'sep');
mkdirSync(sep);
run('gs', ['-q', '-dNOPAUSE', '-dBATCH', '-dSAFER', '-sDEVICE=tiffsep', '-dMaxSpots=0', '-r36',
  `-sOutputFile=${resolve(sep, 'plate.tif')}`, resolve(figures, `${ID}-print.pdf`)]);
const INKS: Array<[string, string]> = [['Cyan', '#00a0e9'], ['Magenta', '#e5007e'], ['Yellow', '#ffed00'], ['Black', '#1d1d1b']];
const tinted = INKS.map(([plate, ink]) => {
  const png = resolve(sep, `${plate}.png`);
  run('magick', [resolve(sep, `plate(${plate}).tif`), '-colorspace', 'gray', '+level-colors', `${ink},white`, png]);
  return png;
});
run('magick', [
  '(', tinted[0]!, tinted[1]!, '-bordercolor', 'white', '-border', '4', '+append', ')',
  '(', tinted[2]!, tinted[3]!, '-bordercolor', 'white', '-border', '4', '+append', ')',
  '-append', '-define', 'webp:lossless=true', resolve(figures, `${ID}-print.webp`),
]);

// ── 3. Provenance ──────────────────────────────────────────────────────────────
const lo = version('soffice', ['--version'], /LibreOffice ([\d.]+)/);
const readers: Record<string, ArtMeta['generator']> = {
  slide: { name: 'LibreOffice Impress', version: lo },
  page: { name: 'LibreOffice Writer', version: lo },
  svg: { name: 'Lolly Design' },
  video: { name: 'FFmpeg', version: version('ffmpeg', ['-version'], /ffmpeg version (\S+)/) },
  print: { name: 'Ghostscript', version: version('gs', ['--version'], /([\d.]+)/) },
};
const metaOf = (generator: ArtMeta['generator']): ArtMeta => ({
  generator,
  model: { name: 'Claude Opus 5.5', identifier: 'claude-opus-5-5', vendor: 'Anthropic' },
  oversight: 'prompt_guided',
  source: 'compositeWithTrainedAlgorithmicMedia',
  author: { name: 'Andy Fitzsimon' },
});
for (const [name, generator] of Object.entries(readers)) {
  writeFileSync(resolve(figures, `${ID}-${name}.meta.json`), `${JSON.stringify(metaOf(generator), null, 2)}\n`);
}
// The two raster panels are not bank artifacts (the bank signs SVG and HTML), so they
// are signed here with the same claim, as the tenets exports are.
for (const name of ['video', 'print']) {
  const file = resolve(figures, `${ID}-${name}.webp`);
  const [width, height] = run('magick', ['identify', '-format', '%w %h', file]).split(' ').map(Number);
  writeFileSync(file, await embedC2pa(new Uint8Array(readFileSync(file)), 'webp', artC2paOpts(metaOf(readers[name]!), {
    id: `${ID}-${name}`, kind: 'figure', format: 'webp', dims: { width: width!, height: height! },
  })));
}
const signed = await signDocsArt();
if (signed.violations.length) throw new Error('The format-last panels failed the docs bank checks');
for (const name of Object.keys(readers)) {
  const file = resolve(figures, `${ID}-${name}.${name === 'video' || name === 'print' ? 'webp' : 'svg'}`);
  const report = await verifyC2pa(new Uint8Array(readFileSync(file)));
  if (report.state !== 'valid' || report.author?.name !== 'Andy Fitzsimon') throw new Error(`No valid credential on ${file}`);
}

if (keep) {
  mkdirSync(keep, { recursive: true });
  for (const f of [`${ID}.pptx`, `${ID}.docx`, `${ID}.mp4`, `${ID}-print.pdf`, `${ID}-svg.svg`]) copyFileSync(resolve(figures, f), resolve(keep, f));
}
rmSync(work, { recursive: true, force: true });
console.log(`✓ ${ID}: five panels and five originals in docs/figures/`);
