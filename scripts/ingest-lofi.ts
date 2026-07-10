// SPDX-License-Identifier: MPL-2.0
/**
 * ingest-lofi — convert a curated set of public-domain lo-fi tracks to opus and register them as
 * catalog audio assets under `lolly/loops/` in the BLANK `lolly-start` brand — the focus beats
 * behind "Neurospicy Mode" (they also flow into the video-export music picker, which lists every
 * type:'audio' asset). The SUSE profile has its own drum-break loops via `ingest-loops.ts`; this
 * is the start-profile analogue, and unlike those SUSE breaks these ship with a real, public
 * licence so the blank brand is clean to distribute.
 *
 * Source: the Open Lo-Fi collection (github.com/btahir/open-lofi) — 166 tracks generated with
 * Suno v5 and donated to the public domain under CC0 1.0. Default layout:
 *   ~/Build/openlofi           — the *.mp3 tracks
 *   ~/Build/open-lofi-main     — repo checkout with catalog.json (title/category) + LICENSE
 *
 * SELECTION rationale: neurospicy loops re-encode to opus at a fixed bitrate, so the smallest
 * output files are simply the shortest source tracks. The list below is the 12 shortest tracks
 * (all < 100 s), which also happens to span jazzhop / activities / soul-rnb / late-night /
 * seasonal for variety in the picker. Re-encoded to opus @64k — ~half the size of mp3/aac, loops
 * gaplessly via Web Audio, and (unlike vorbis) decodes in Safari.
 *
 * A one-shot generator (like previews): run locally (needs ffmpeg), commit the output, then
 * `npm run build:catalog` (fills checksum + size) and `npm run validate:catalog`. Idempotent:
 * strips any prior `lolly/loops/*` from the index before re-adding.
 *
 * Usage:  node scripts/ingest-lofi.ts
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = join(homedir(), 'Build/openlofi');
const MANIFEST = join(homedir(), 'Build/open-lofi-main/catalog.json');
const OUT_ROOT = join(ROOT, 'brands/lolly-start/catalog'); // parent-owned blank brand (not a submodule)
const OUT_DIR = join(OUT_ROOT, 'assets/lolly/loops');
const OUT_URL = '/catalog/assets/lolly/loops';
const INDEX = join(OUT_ROOT, 'assets/index.json');
const ID_PREFIX = 'lolly/loops/';
const LICENSE = 'CC0-1.0';

// The 12 shortest tracks (→ smallest opus), curated for a bit of category spread. Source filenames.
const SELECTION = [
  'pixel-quest-save-point.mp3',       // activities
  'breezy-afternoon-terrace.mp3',     // jazzhop
  'rain-on-the-boulevard.mp3',        // jazzhop
  'fireplace-loop.mp3',               // seasonal-weather
  'first-coffee-thoughts.mp3',        // activities
  'continue-screen-dreams.mp3',       // activities
  'slow-dance-in-the-living-room.mp3',// soul-rnb
  '3-am-echoes.mp3',                  // late-night
  'after-school-rain.mp3',            // seasonal-weather
  '3am-sink-light.mp3',               // soul-rnb
  'saxophone-in-the-rain.mp3',        // jazzhop
  'empty-street-static.mp3',          // late-night
];

interface Track { title: string; filename: string; category: string }
interface AssetFormat { format: string; url: string; checksum: string; size: number }
interface AssetEntry { id: string; name: string; description: string; type: string; version: string; tier: string; tags: string[]; formats: AssetFormat[]; license: string }

const CATEGORY_LABEL: Record<string, string> = {
  chillhop: 'chillhop', jazzhop: 'jazz-lounge', 'ambient-lofi': 'ambient', 'soul-rnb': 'soul & slow-jam',
  'asian-lofi': 'zen', 'funk-soul': 'funk', 'seasonal-weather': 'rainy-day', 'late-night': 'late-night',
  activities: 'focus', hybrid: 'cinematic',
};

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')) as { tracks: Track[] };
const byFile = new Map(manifest.tracks.map((t) => [t.filename, t]));

mkdirSync(OUT_DIR, { recursive: true });
const index = JSON.parse(readFileSync(INDEX, 'utf8')) as { assets: AssetEntry[] };
const entries: AssetEntry[] = [];

for (const file of SELECTION) {
  const src = join(SRC_DIR, file);
  if (!existsSync(src)) { console.log(`  (skipping ${file} — not found in ${SRC_DIR})`); continue; }
  const track = byFile.get(file);
  const slug = file.replace(/\.[^.]+$/, '');
  const name = track?.title ?? slug.replace(/-/g, ' ');
  const cat = track?.category ?? '';
  const label = CATEGORY_LABEL[cat] ?? 'lo-fi';
  execFileSync('ffmpeg', ['-y', '-i', src, '-c:a', 'libopus', '-b:a', '64k', join(OUT_DIR, `${slug}.opus`)], { stdio: 'ignore' });
  entries.push({
    id: ID_PREFIX + slug,
    name,
    description: `Looping lo-fi beat (${label}) — a focus track for Neurospicy Mode, also selectable as a video music bed. Public domain (CC0).`,
    type: 'audio',
    version: '1.0.0',
    tier: 'on-demand',
    tags: ['audio', 'loop', 'beat', 'neurospicy', 'lofi', ...(cat ? [cat] : [])],
    formats: [{ format: 'opus', url: `${OUT_URL}/${slug}.opus`, checksum: 'sha256-PLACEHOLDER', size: 0 }],
    license: LICENSE,
  });
  console.log(`  ✓ ${ID_PREFIX + slug}  (${label})`);
}

index.assets = index.assets.filter((a) => !a.id.startsWith(ID_PREFIX)).concat(entries);
writeFileSync(INDEX, JSON.stringify(index, null, 2) + '\n');
console.log(`\nIngested ${entries.length} lo-fi loops → ${OUT_DIR}\nNext: npm run build:catalog && npm run validate:catalog`);
