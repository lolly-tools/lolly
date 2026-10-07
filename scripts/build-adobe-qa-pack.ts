#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/** Build native Adobe qualification files; application checks remain manual. */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { exportDesignIdml } from '../engine/src/design-idml.ts';
import { exportDesignPremiere } from '../engine/src/design-premiere.ts';
import { readIdmlSpreads } from '../engine/src/idml-read.ts';
import { ENGINE_VERSION } from '../engine/src/version.ts';
import { packPng } from '../engine/src/png.ts';
import { readPremiereXml } from '../engine/src/premiere-xml.ts';
import { readZip, storeZip } from '../engine/src/zip.ts';
import { loadPsdKernel } from '../packages/node-shell/src/adobe-psd-node.ts';
import type { AssetRef, HostV1 } from '../packages/core/src/host-v1.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).map(arg => {
  const match = /^--(out|corpus)=(.+)$/.exec(arg);
  if (!match) throw new Error('Use --out=<directory> and --corpus=<pinned PSD corpus>.');
  return [match[1], resolve(match[2]!)];
}));
const out = args.out ?? join(root, 'plans/artifacts/adobe-native-qa');
await mkdir(out, { recursive: true });
if ((await readdir(out)).length) throw new Error('Choose an empty output directory to preserve prior QA results.');
const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const files: { name: string; bytes: Uint8Array }[] = [];
async function add(name: string, content: string | Uint8Array) {
  const bytes = typeof content === 'string' ? new TextEncoder().encode(content) : content;
  const filename = join(out, name);
  await mkdir(dirname(filename), { recursive: true });
  await writeFile(filename, bytes);
  files.push({ name, bytes });
}

const pixels = new Uint8Array(32 * 32 * 4);
for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
  const offset = (y * 32 + x) * 4;
  pixels.set((x < 16) === (y < 16) ? [32, 160, 96, 255] : [240, 208, 80, 255], offset);
}
const png = packPng(pixels, { width: 32, height: 32, channels: 4 });
const image: AssetRef = { id: 'qa/checker', source: 'user', type: 'raster', format: 'png', url: `data:image/png;base64,${Buffer.from(png).toString('base64')}`, width: 32, height: 32 };
const host = { assets: { bytes: async () => png }, log() {} } as unknown as HostV1;
const boxes = [
  { id: 'portrait', kind: 'frame', x: 0, y: 0, w: 600, h: 800 },
  { id: 'title', kind: 'text', frame: 'portrait', x: 40, y: 50, w: 400, h: 90, text: 'Adobe QA & layout', font: 'Arial', fontSize: 24, weight: 400, fg: '#182820', align: 'left', valign: 'top', opacity: 100 },
  { id: 'oval', kind: 'box', frame: 'portrait', x: 40, y: 180, w: 160, h: 80, shape: 'ellipse', bg: '#20a060', opacity: 100 },
  { id: 'landscape', kind: 'frame', x: 900, y: 0, w: 400, h: 300 },
  { id: 'picture', kind: 'image', frame: 'landscape', x: 940, y: 40, w: 160, h: 160, image, opacity: 100 },
];
const layout = new Uint8Array(await (await exportDesignIdml({ sourceDocument: { toolId: 'design', values: { boxes } } }, host)).arrayBuffer());
await add('InDesign/two-spreads.idml', layout);
await add('InDesign/source-layout.json', JSON.stringify({ boxes }, null, 2));
await add('Illustrator/reference.svg', '<svg xmlns="http://www.w3.org/2000/svg" width="600pt" height="800pt" viewBox="0 0 600 800"><rect width="600" height="800" fill="white"/><text x="40" y="74" font-family="Arial" font-size="24" fill="#182820">Adobe QA &amp; layout</text><ellipse cx="120" cy="220" rx="80" ry="40" fill="#20a060"/></svg>');

const clips = [
  { id: 'first', name: 'First checker', kind: 'image', x: 0, y: 0, w: 640, h: 360, image, start: 0, dur: 2, clipIn: 0, speed: 1, opacity: 100, mute: true },
  { id: 'second', name: 'Second checker', kind: 'image', x: 0, y: 0, w: 640, h: 360, image, start: 3, dur: 2, clipIn: 0, speed: 1, opacity: 100, mute: true },
];
const timeline = new Uint8Array(await (await exportDesignPremiere({ width: 640, height: 360, sourceDocument: { toolId: 'design', values: { title: 'Lolly native QA', boxes: clips, projectFps: '30' } } }, host)).arrayBuffer());
const timelineFiles = readZip(timeline);
for (const entry of timelineFiles) await add(`Premiere/${entry.name}`, entry.bytes);
await add('Darkroom/preset.xmp', await readFile(join(root, 'tests/fixtures/adobe/preset.xmp')));

const dom = new JSDOM('');
let layoutPages: { width: number; height: number }[];
try {
  const spreads = await readIdmlSpreads(Object.fromEntries(readZip(layout).map(file => [file.name, file.bytes])), text => new dom.window.DOMParser().parseFromString(text, 'application/xml'), { storeImage: async () => image });
  layoutPages = spreads.map(({ width, height }) => ({ width, height }));
  if (JSON.stringify(layoutPages) !== JSON.stringify([{ width: 600, height: 800 }, { width: 400, height: 300 }])) throw new Error('IDML page geometry changed.');
  const xml = timelineFiles.find(file => file.name === 'sequence.xml');
  const sequence = readPremiereXml(new TextDecoder().decode(xml!.bytes), text => new dom.window.DOMParser().parseFromString(text, 'application/xml'));
  if (sequence.duration !== 150 || sequence.clips.length !== 2 || sequence.clips[1]!.start !== 90) throw new Error('Premiere frame placement changed.');
  const media = timelineFiles.find(file => file.name === 'Media/source-1.png');
  if (!media || sha256(media.bytes) !== sha256(png)) throw new Error('Premiere media bytes changed.');
} finally { dom.window.close(); }

const psdChecks: Record<string, unknown>[] = [];
if (args.corpus) {
  const recipe = JSON.parse(await readFile(join(root, 'scripts/data/adobe-corpus.json'), 'utf8')) as { repository: string; commit: string; files: { path: string; sha256: string }[] };
  const kernel = await loadPsdKernel();
  for (const [name, mode, depth] of [['rgb8', 3, 8], ['rgb16', 3, 16], ['rgb32', 3, 32], ['lab8', 9, 8]] as const) {
    let found = false;
    for (const fixture of recipe.files) {
      const original = new Uint8Array(await readFile(join(args.corpus, fixture.path)));
      const header = new DataView(original.buffer, original.byteOffset, original.byteLength);
      if (header.getUint16(22) !== depth || header.getUint16(24) !== mode) continue;
      if (sha256(original) !== fixture.sha256) throw new Error(`Pinned corpus hash mismatch: ${fixture.path}`);
      const preserved = kernel.roundTrip(original), document = kernel.read(original, { compositeOnly: true });
      if (sha256(preserved) !== fixture.sha256) throw new Error(`PSD preservation changed ${fixture.path}.`);
      await add(`Photoshop/${name}-original.psd`, original);
      await add(`Photoshop/${name}-preserved.psd`, preserved);
      if (document.composite) await add(`Photoshop/${name}-preview.png`, packPng(document.composite.pixels, { width: document.width, height: document.height, channels: 4 }));
      psdChecks.push({ name, source: fixture.path, repository: recipe.repository, commit: recipe.commit, sha256: fixture.sha256, mode, depth, warnings: document.warnings, byteIdentical: true });
      found = true;
      break;
    }
    if (!found) throw new Error(`No pinned PSD specimen for ${name}.`);
  }
}
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const sourceDirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim().length > 0;
await add('README.md', '# Native Adobe qualification\n\nThese files come from the recorded Lolly source. Automated geometry, frame and preservation checks pass; native Adobe application validation is pending. Record application version, file name, warnings and pass/fail for each check in results.json.\n\n1. Photoshop: open each original and preserved PSD. Check size, mode, depth, layers and visible content. Each preserved file must remain byte-identical to its original. Preview PNGs are display-referred 8-bit comparisons, with source conversion notes in manifest.json.\n2. InDesign: open two-spreads.idml. Check separate 600 x 800 pt and 400 x 300 pt pages, editable text, oval geometry and the linked checker image. Record missing-font/link notices. Save as IDML and reimport in Lolly; compare geometry and supported content.\n3. Illustrator: open reference.svg, edit the text and oval, save as SVG and reimport in Lolly. This tests SVG interchange; it does not claim native AI project support.\n4. Premiere: import Premiere/sequence.xml and relink Media/source-1.png if prompted. Check 640 x 360, 30 fps, five seconds, clips at frames 0-60 and 90-150. Record framing and audio behavior. Save/export XML and reimport in Lolly. Generated motion is validated separately as rendered video.\n5. Lolly Darkroom: import Darkroom/preset.xmp. Check exposure 0.75, contrast 12, saturation 80 and highlights -35. Temperature and CameraProfile remain unmapped; Adobe color parity is not claimed.\n\nKeep the source originals and record any modified files separately.\n');
await add('results.json', JSON.stringify({ nativeApplicationChecks: 'pending', applications: ['Photoshop', 'InDesign', 'Illustrator', 'Premiere'].map(application => ({ application, version: null, checks: [], result: 'pending' })) }, null, 2));
await add('manifest.json', JSON.stringify({ sourceCommit, sourceDirty, engineVersion: ENGINE_VERSION, nativeApplicationChecks: 'pending', automated: { idmlPages: layoutPages!, premiereFrames: 150, premiereClipStarts: [0, 90], premiereMediaByteIdentical: true, psd: psdChecks }, files: files.map(file => ({ path: file.name, bytes: file.bytes.length, sha256: sha256(file.bytes) })) }, null, 2));
const archive = storeZip(files);
await writeFile(join(out, 'adobe-native-qa.zip'), archive);
console.log(JSON.stringify({ out, files: files.length, sourceCommit, sourceDirty, sha256: sha256(archive), nativeApplicationChecks: 'pending' }));
