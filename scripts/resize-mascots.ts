// SPDX-License-Identifier: MPL-2.0
/**
 * resize-mascots - bring the /info landing mascots inside their weight budget
 * WITHOUT breaking their Content Credentials.
 *
 * Every mascot is AI-generated and declared: it ships with a C2PA manifest whose
 * ingredient chain reaches back to the original generated image, preserving
 * digitalSourceType = trainedAlgorithmicMedia. A bare image-tool resize would
 * strip that chain, so this script follows the same path as the web upload
 * flow's resize: sharp downscale -> fresh webp -> engine embedC2pa with a
 * c2pa.resized action and the PRIOR store carried as an ingredient. The engine
 * propagates the AI origin from the ingredient, so the new credential never
 * says less than the old one did.
 *
 * Targets are ~2.5x each mascot's largest rendered CSS width (retina-crisp with
 * headroom - Andy's call: spend the budget on quality), read from
 * styles/parts/docs-landing.css at the time of writing - update TARGETS if a
 * mascot's sizing class changes. Files already at or under target width are
 * only re-encoded if that saves >=10%.
 *
 * Usage:
 *   node scripts/resize-mascots.ts            # resize + re-credential + verify
 *   node scripts/resize-mascots.ts --check    # report what would change
 *   node scripts/resize-mascots.ts --quality 88
 *   node scripts/resize-mascots.ts --import=<dir> [--only=a.webp,b.webp]   # PNG cut-outs in
 *   node scripts/resize-mascots.ts --flip=echidna.webp   # mirror one mascot, ONCE, on the record
 *
 * After a run that writes: `npm run build:info` so credentialedMascot() re-bakes
 * each <img>'s intrinsic width/height from the new files.
 */

import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { embedC2pa } from '../engine/src/c2pa-containers.ts';
import { extractC2paStore, collectIngredients, prepareC2paIngredientFromStore } from '../engine/src/c2pa-extract.ts';
import { ENGINE_VERSION } from '../engine/src/version.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'shells/web/public/info/mascots');

/** Total budget for the directory, Andy's number (2026-08-28): quality first, inside 2.2 MB
 *  (held with the three lane mascots added 2026-09-03: 2161 KB of 2252). Raised to 2.7 MB
 *  the same day for three more lane mascots Andy supplied (pelican, wombat, bin-chicken:
 *  ~150 KB each at the 600px lane target), and to 3.0 MB that evening for the platypus on
 *  the Operators door, then 3.3 MB for the dolphin and whale on the Collaborate and Post
 *  lanes - the per-mascot quality bar is unchanged. */
const BUDGET_BYTES = 3.3 * 1024 * 1024;

/** file -> target pixel width = 2x the max width of its docs-landing.css sizing class. */
const TARGETS: Record<string, number> = {
  'echidna.webp': 600,            // .lane-mascot      clamp(...,240px)  (Legal lane, since 2026-09-03)
  'koala.webp': 900,              // .about-mascot     clamp(...,360px)
  'kookaburra.webp': 850,         // .import-mascot    clamp(...,340px)
  'magpie.webp': 750,             // .assure-mascot    clamp(...,300px)
  'quokka.webp': 850,             // .why-mascot       clamp(...,340px)
  'quoll.webp': 1075,             // .audience-mascot  clamp(...,430px)
  'ringtail-possum.webp': 800,    // .refusal-mascot   clamp(...,320px)
  'wedge-tailed-eagle.webp': 1500, // .everywhere-mascot clamp(...,600px)
  'lorikeet.webp': 600,           // .lane-mascot      clamp(...,240px)  (Designers lane)
  'kookaburra-lolly.webp': 600,   // .lane-mascot      clamp(...,240px)  (Developers lane)
  'bandicoot.webp': 600,          // .lane-mascot      clamp(...,240px)  (Make lane)
  'pelican.webp': 600,            // .lane-mascot      clamp(...,240px)  (Animate lane)
  'wombat.webp': 600,             // .lane-mascot      clamp(...,240px)  (Record lane)
  'bin-chicken.webp': 600,        // .lane-mascot      clamp(...,240px)  (AI lane)
  'platypus.webp': 600,           // .persona-mascot   12em square        (Operators door tab)
  'dolphin.webp': 600,            // .lane-mascot      clamp(...,240px)  (Collaborate lane)
  'whale.webp': 800,              // .lane-mascot      clamp(...,400px)  (Post lane - wide animal, wide column)
};
/**
 * PNG cut-outs that become mascots: `--import=<dir>` reads each `from` under that
 * directory, resizes it to its TARGETS width, encodes webp and writes `out` into
 * the mascots directory with a fresh credential whose ingredient is the PNG's own
 * store (which already chains back through the Lolly cut-out to the Google
 * generation), recording BOTH the container change and the resize. The main loop
 * then sees the file at target width and keeps it. A PNG without a store refuses,
 * exactly as the resize does - an undeclared image never becomes a mascot.
 */
const IMPORTS: ReadonlyArray<{ from: string; out: string }> = [
  { from: 'lorikeet.png', out: 'lorikeet.webp' },
  { from: 'kookaburra.png', out: 'kookaburra-lolly.webp' },
  { from: 'bandicoot.png', out: 'bandicoot.webp' },
  { from: 'pelican.png', out: 'pelican.webp' },
  { from: 'wombat.png', out: 'wombat.webp' },
  { from: 'bin-chicken.png', out: 'bin-chicken.webp' },
  { from: 'platypus.png', out: 'platypus.webp' },
  { from: 'dolphin.png', out: 'dolphin.webp' },
  { from: 'whale.png', out: 'whale.webp' },
];

async function main(): Promise<void> {
  const check = process.argv.includes('--check');
  const qArg = process.argv.indexOf('--quality');
  const quality = qArg >= 0 ? Number(process.argv[qArg + 1]) : 94;
  const { default: sharp } = await import('sharp');
  const importArg = process.argv.find(a => a.startsWith('--import='));
  if (importArg) {
    const from = resolve(importArg.slice('--import='.length));
    // `--only=a.webp,b.webp` imports just those: re-encoding an already-shipped mascot
    // from its PNG again would rewrite its bytes (a fresh credential timestamp) for
    // no visible change.
    const onlyArg = process.argv.find(a => a.startsWith('--only='));
    const only = onlyArg ? new Set(onlyArg.slice('--only='.length).split(',').map(x => x.trim()).filter(Boolean)) : null;
    for (const { from: name, out } of IMPORTS) {
      if (only && !only.has(out)) continue;
      const src = join(from, name);
      const orig = new Uint8Array(readFileSync(src));
      const ex = extractC2paStore(orig);
      if (!ex) throw new Error(`${name}: no C2PA store - refusing to import an uncredentialed image as a mascot`);
      const targetW = TARGETS[out];
      if (!targetW) throw new Error(`${out}: no TARGETS entry`);
      const meta = await sharp(orig).metadata();
      const srcW = meta.width ?? 0;
      const outW = Math.min(targetW, srcW);
      const webp = new Uint8Array(await sharp(orig)
        .resize({ width: outW, withoutEnlargement: true })
        .webp({ quality, alphaQuality: 95, effort: 6, smartSubsample: true })
        .toBuffer());
      const ingredient = prepareC2paIngredientFromStore(ex.store, ex.format);
      if (!ingredient) throw new Error(`${name}: could not prepare the existing credential as an ingredient`);
      const stamped = await embedC2pa(webp, 'webp', {
        actions: [
          { action: 'c2pa.converted', description: 'Converted from PNG to WebP for the /info landing' },
          { action: 'c2pa.resized', description: `Resized to ${outW}px wide for the /info landing weight budget` },
        ],
        ingredients: [ingredient],
        generatorInfo: { name: 'Lolly', version: ENGINE_VERSION },
      });
      if (!extractC2paStore(stamped)) throw new Error(`${out}: output lost its C2PA store`);
      if (collectIngredients(stamped).length < 1) throw new Error(`${out}: output lost its ingredient chain`);
      if (!check) writeFileSync(join(DIR, out), stamped);
      console.log(`  ${check ? '~' : '✓'} ${name} → ${out}  ${Math.round(orig.length / 1024)} KB → ${Math.round(stamped.length / 1024)} KB  (${srcW}px → ${outW}px)`);
    }
  }

  // `--flip=<file>`: mirror one mascot horizontally, ONCE, with the flip on the record.
  // A one-shot flag rather than a map the main loop reads, because a persistent flip
  // would apply again on every run and two flips are the original. The output carries a
  // c2pa.orientation action (the C2PA verb for a mirror or rotation) plus the resize, with
  // the prior credential as ingredient, so the chain back to the generation holds.
  const flipArg = process.argv.find(a => a.startsWith('--flip='));
  if (flipArg) {
    const file = flipArg.slice('--flip='.length);
    const targetW = TARGETS[file];
    if (!targetW) throw new Error(`${file}: no TARGETS entry`);
    const path = join(DIR, file);
    const orig = new Uint8Array(readFileSync(path));
    const ex = extractC2paStore(orig);
    if (!ex) throw new Error(`${file}: no C2PA store - refusing to edit an uncredentialed mascot`);
    const meta = await sharp(orig).metadata();
    const outW = Math.min(targetW, meta.width ?? targetW);
    const flipped = new Uint8Array(await sharp(orig)
      .flop()
      .resize({ width: outW, withoutEnlargement: true })
      .webp({ quality, alphaQuality: 95, effort: 6, smartSubsample: true })
      .toBuffer());
    const ingredient = prepareC2paIngredientFromStore(ex.store, ex.format);
    if (!ingredient) throw new Error(`${file}: could not prepare the existing credential as an ingredient`);
    const stamped = await embedC2pa(flipped, 'webp', {
      actions: [
        { action: 'c2pa.orientation', description: 'Mirrored horizontally so the animal faces the copy beside it' },
        { action: 'c2pa.resized', description: `Resized to ${outW}px wide for the /info landing weight budget` },
      ],
      ingredients: [ingredient],
      generatorInfo: { name: 'Lolly', version: ENGINE_VERSION },
    });
    if (!extractC2paStore(stamped)) throw new Error(`${file}: output lost its C2PA store`);
    if (collectIngredients(stamped).length < 1) throw new Error(`${file}: output lost its ingredient chain`);
    if (!check) writeFileSync(path, stamped);
    console.log(`  ${check ? '~' : '✓'} ${file} mirrored  ${Math.round(orig.length / 1024)} KB → ${Math.round(stamped.length / 1024)} KB  (${meta.width}px → ${outW}px)`);
  }

  let total = 0;
  const results: { file: string; before: number; after: number; width: number }[] = [];

  for (const [file, targetW] of Object.entries(TARGETS)) {
    const path = join(DIR, file);
    const orig = new Uint8Array(readFileSync(path));
    const ex = extractC2paStore(orig);
    if (!ex) throw new Error(`${file}: no C2PA store - refusing to resize an uncredentialed mascot (every mascot is declared AI art)`);

    const meta = await sharp(orig).metadata();
    const srcW = meta.width ?? 0;
    const outW = Math.min(targetW, srcW);
    const resized = new Uint8Array(await sharp(orig)
      .resize({ width: outW, withoutEnlargement: true })
      .webp({ quality, alphaQuality: 95, effort: 6, smartSubsample: true })
      .toBuffer());

    const ingredient = prepareC2paIngredientFromStore(ex.store, ex.format);
    if (!ingredient) throw new Error(`${file}: could not prepare the existing credential as an ingredient`);
    const out = await embedC2pa(resized, 'webp', {
      actions: [{ action: 'c2pa.resized', description: `Resized to ${outW}px wide for the /info landing weight budget` }],
      ingredients: [ingredient],
      generatorInfo: { name: 'Lolly', version: ENGINE_VERSION },
    });

    // Never ship a regression: keep the original when re-encoding didn't help.
    const keepOriginal = out.length >= orig.length * 0.9 && srcW <= targetW;
    const finalBytes = keepOriginal ? orig : out;

    if (!keepOriginal) {
      const store = extractC2paStore(finalBytes);
      if (!store) throw new Error(`${file}: output lost its C2PA store`);
      if (collectIngredients(finalBytes).length < 1) throw new Error(`${file}: output lost its ingredient chain`);
    }
    if (!check && !keepOriginal) writeFileSync(path, finalBytes);

    total += finalBytes.length;
    results.push({ file, before: orig.length, after: finalBytes.length, width: keepOriginal ? srcW : outW });
    const kb = (n: number): string => `${Math.round(n / 1024)} KB`;
    console.log(`  ${keepOriginal ? '=' : check ? '~' : '✓'} ${file}  ${kb(orig.length)} → ${kb(finalBytes.length)}  (${srcW}px → ${keepOriginal ? srcW : outW}px)`);
  }

  const totalKb = Math.round(total / 1024);
  console.log(`\nTotal: ${totalKb} KB of ${Math.round(BUDGET_BYTES / 1024)} KB budget`);
  if (total > BUDGET_BYTES) {
    console.error(`OVER BUDGET - re-run with a lower --quality (current ${quality})`);
    process.exitCode = 1;
  } else if (!check) {
    console.log('Next: npm run build:info (re-bakes each <img> width/height)');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
