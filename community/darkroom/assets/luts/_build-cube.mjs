#!/usr/bin/env node
// Build the shipped preset .cube LUTs for Bitmap Studio from their CC0 source.
//
// Source: sguyader/FilmSim (https://github.com/sguyader/FilmSim), commit
// 1453b2b55c48d99a889b1e455f91f6898ba2db41, dedicated to the public domain under
// CC0 1.0. Each source is a HaldCLUT .tif - a 144³ LUT (level 12) encoded in a
// 1728×1728 8-bit RGB image, row-major, red-fastest, so a grid node (r,g,b) sits
// at raw offset (r + g·144 + b·144²)·3.
//
// This resamples each 144³ source to a 33³ Adobe/IRIDAS .cube (the industry
// default, and Bitmap Studio's own bake default) with trilinear interpolation,
// and names the outputs DESCRIPTIVELY - the upstream stock names (Acros, Provia,
// Velvia, Classic Chrome) are Fujifilm trademarks, so the UI never brands them;
// their factual origin lives only in the # provenance comment + NOTICE.md.
//
// Regenerate (needs ImageMagick `magick` + the source .tif checked out):
//   node _build-cube.mjs /path/to/FilmSim
// Reproducibility (source .tif are NOT committed - 36 MB - verify by SHA256):
//   Acros.tif           d4c9f720c1588531b7f748e13505e11f392af663415e625bda0ff3455b41c7a5
//   Classic_Chrome.tif  cc303723b76205aedf970dc814dbecd6d9795955411aa2d6b265873864de7a66
//   Provia_Std.tif      acf26aee152dbce9fff685aa727a5550855d425aa90610dd63b3ff2f15be0fe7
//   Velvia_Vivid_v2.tif 1b347b4c5afec78ad7f79103bf04b319e182b7133ffe2a8864c732a7003b7eea

import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = dirname(fileURLToPath(import.meta.url));
const SRC = process.argv[2];
if (!SRC) { console.error('usage: node _build-cube.mjs <FilmSim source dir>'); process.exit(1); }

const N = 33;      // output grid (33³ - industry default)
const EDGE = 144;  // Hald edge (12²); source image is 1728² = 12³²
const WIDTH = 1728;

// source .tif basename → { id (shipped filename + UI value), title (descriptive) }
const MAP = [
  { src: 'Acros',           id: 'mono-fine',     title: 'Fine mono' },
  { src: 'Classic_Chrome',  id: 'chrome-muted',  title: 'Muted chrome' },
  { src: 'Provia_Std',      id: 'slide-standard', title: 'Standard slide' },
  { src: 'Velvia_Vivid_v2', id: 'slide-vivid',   title: 'Vivid slide' },
];

function decodeRaw(tif) {
  const raw = execFileSync('magick', [tif, '-depth', '8', 'rgb:-'], { maxBuffer: 1 << 30 });
  if (raw.length !== WIDTH * WIDTH * 3) throw new Error(`unexpected raw size ${raw.length} for ${tif}`);
  return raw;
}
function node3(raw, ri, gi, bi, c) { return raw[(ri + gi * EDGE + bi * EDGE * EDGE) * 3 + c] / 255; }
function sample(raw, r, g, b) {
  const gx = r * (EDGE - 1), gy = g * (EDGE - 1), gz = b * (EDGE - 1);
  const x0 = Math.min(gx | 0, EDGE - 2), y0 = Math.min(gy | 0, EDGE - 2), z0 = Math.min(gz | 0, EDGE - 2);
  const fx = gx - x0, fy = gy - y0, fz = gz - z0;
  const out = [0, 0, 0];
  for (let c = 0; c < 3; c++) {
    const c00 = node3(raw, x0, y0, z0, c) * (1 - fx) + node3(raw, x0 + 1, y0, z0, c) * fx;
    const c10 = node3(raw, x0, y0 + 1, z0, c) * (1 - fx) + node3(raw, x0 + 1, y0 + 1, z0, c) * fx;
    const c01 = node3(raw, x0, y0, z0 + 1, c) * (1 - fx) + node3(raw, x0 + 1, y0, z0 + 1, c) * fx;
    const c11 = node3(raw, x0, y0 + 1, z0 + 1, c) * (1 - fx) + node3(raw, x0 + 1, y0 + 1, z0 + 1, c) * fx;
    const c0 = c00 * (1 - fy) + c10 * fy, c1 = c01 * (1 - fy) + c11 * fy;
    out[c] = c0 * (1 - fz) + c1 * fz;
  }
  return out;
}
const f6 = (v) => (Math.round(Math.max(0, Math.min(1, v)) * 1e6) / 1e6).toFixed(6);

for (const { src, id, title } of MAP) {
  const raw = decodeRaw(join(SRC, `${src}.tif`));
  const lines = [
    `TITLE "${title}"`,
    '# Preset LUT for Lolly Bitmap Studio.',
    `# Derived from sguyader/FilmSim "${src}" (CC0 1.0, https://github.com/sguyader/FilmSim),`,
    '# resampled from the 144³ HaldCLUT to a 33³ .cube. Public domain - see NOTICE.md.',
    `LUT_3D_SIZE ${N}`,
    'DOMAIN_MIN 0.0 0.0 0.0',
    'DOMAIN_MAX 1.0 1.0 1.0',
  ];
  for (let bi = 0; bi < N; bi++) for (let gi = 0; gi < N; gi++) for (let ri = 0; ri < N; ri++) {
    const [r, g, b] = sample(raw, ri / (N - 1), gi / (N - 1), bi / (N - 1));
    lines.push(`${f6(r)} ${f6(g)} ${f6(b)}`);
  }
  writeFileSync(join(OUT, `${id}.cube`), lines.join('\n') + '\n');
  console.log(`wrote ${id}.cube  (from ${src}.tif)`);
}
