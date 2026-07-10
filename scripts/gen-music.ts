/**
 * Procedural music generator — emits a varied set of CC0 ZzFXM tracks into the
 * lolly-start catalog for Neurospicy Mode + video music beds. Variety by design:
 * ambient (melody + soothing sweeps, no drums), rhythmic (kick/snare/hats + bass
 * groove), and melodic (lead + pad + light hats). Deterministic (seeded) so files
 * and checksums are byte-stable across runs — no git churn.
 *
 * Each track is a few KB of ZzFXM data yet ~30–60s long (a handful of reused
 * patterns arranged into a longer sequence; low BPM stretches patterns so length
 * costs almost no data). Composition helpers live in ./lib/zzfx-music.ts.
 *
 * Run:  node scripts/gen-music.ts   then `npm run build:catalog` (fills
 * checksums/sizes) and `npm run validate:catalog`.
 *
 * NOTE: rendering here only checks the audio is present, in-range and the right
 * length — it can't judge taste. Audition in the app.
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderZzfxm, type ZzfxSong } from '../engine/src/zzfxm.ts';
import { composeSong, type SongSpec } from './lib/zzfx-music.ts';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const SONGS_DIR = join(ROOT, 'brands/lolly-start/catalog/assets/lolly/songs');
const INDEX_PATH = join(ROOT, 'brands/lolly-start/catalog/assets/index.json');
const URL_BASE = '/catalog/assets/lolly/songs';

interface Track {
  slug: string;
  name: string;
  spec: SongSpec;
  extraTags: string[];
  description: string;
}

const BASE_TAGS = ['audio', 'song', 'neurospicy', 'generated'];

const TRACKS: Track[] = [
  {
    slug: 'drift',
    name: 'Drift',
    spec: { archetype: 'melodic', seed: 0x1a2b3c, bpm: 66, scale: 'majorPent', roots: [12, 19, 21, 16], targetSec: 45, lead: 'bell' },
    extraTags: ['melodic', 'calm'],
    description: 'A gentle bell melody over a warm pad with a light offbeat pulse.',
  },
  {
    slug: 'amber-glow',
    name: 'Amber Glow',
    spec: { archetype: 'ambient', seed: 0x5d6e7f, bpm: 54, scale: 'minorPent', roots: [12, 17, 19, 15], targetSec: 55, lead: 'glass' },
    extraTags: ['ambient', 'calm', 'sweeps'],
    description: 'Sparse glass notes drifting over soothing pad swells — no drums.',
  },
  {
    slug: 'tide-pool',
    name: 'Tide Pool',
    spec: { archetype: 'ambient', seed: 0x2c9a11, bpm: 50, scale: 'suspended', roots: [12, 19, 17, 14], targetSec: 58, lead: 'glass', restProb: 0.62 },
    extraTags: ['ambient', 'calm', 'sweeps', 'dreamy'],
    description: 'Very slow, open, suspended chords with long swells — drift-away focus.',
  },
  {
    slug: 'paper-lanterns',
    name: 'Paper Lanterns',
    spec: { archetype: 'melodic', seed: 0x77c0de, bpm: 72, scale: 'minorPent', roots: [12, 15, 19, 17], targetSec: 44, lead: 'glass' },
    extraTags: ['melodic', 'calm'],
    description: 'A wistful minor-pentatonic melody with a gentle, rocking lilt.',
  },
  {
    slug: 'night-bus',
    name: 'Night Bus',
    spec: { archetype: 'rhythmic', seed: 0x3f11aa, bpm: 78, scale: 'minorPent', roots: [12, 17, 15, 19], targetSec: 42, bass: 'bass', lead: 'pluck' },
    extraTags: ['beat', 'rhythm', 'focus'],
    description: 'A soft, steady beat with a round bass groove and quiet chord stabs.',
  },
  {
    slug: 'slow-train',
    name: 'Slow Train',
    spec: { archetype: 'rhythmic', seed: 0x9be220, bpm: 84, scale: 'majorPent', roots: [12, 16, 19, 21], targetSec: 40, bass: 'sub', lead: 'pluck' },
    extraTags: ['beat', 'rhythm', 'focus'],
    description: 'A rolling four-on-the-floor pulse with a deep sub and plucked chords.',
  },
  {
    slug: 'meadow',
    name: 'Meadow',
    spec: { archetype: 'melodic', seed: 0x40e7a5, bpm: 60, scale: 'majorPent', roots: [12, 21, 19, 16], targetSec: 50, lead: 'bell', pan: 0.15 },
    extraTags: ['melodic', 'calm'],
    description: 'Bright, unhurried bell phrases over an easy pad — open and sunny.',
  },
];

interface AssetFormat { format: string; url: string; checksum: string; size?: number }
interface Asset {
  id: string; name: string; description: string; type: string; version: string;
  tier: string; tags: string[]; formats: AssetFormat[]; license: string;
}

mkdirSync(SONGS_DIR, { recursive: true });

const newEntries: Asset[] = [];
let anyBad = false;
for (const t of TRACKS) {
  const song: ZzfxSong = { ...composeSong(t.spec), title: t.name };

  const pcm = renderZzfxm(song);
  let peak = 0;
  for (let i = 0; i < pcm.left.length; i++) {
    peak = Math.max(peak, Math.abs(pcm.left[i]!), Math.abs(pcm.right[i]!));
  }
  const sec = pcm.left.length / pcm.sampleRate;
  const bad = peak < 0.02 || peak > 1 || sec < 30 || sec > 60;
  if (bad) anyBad = true;
  const flag = peak < 0.02 ? 'SILENT?!' : peak > 1 ? 'CLIPPING?!' : sec < 30 || sec > 60 ? `LEN ${sec.toFixed(0)}s` : 'ok';

  const file = `${t.slug}.zzfxm.json`;
  const json = JSON.stringify(song);
  const bytes = json + '\n';
  writeFileSync(join(SONGS_DIR, file), bytes);
  // Self-fill the SRI checksum + size (same format as scripts/checksum-assets.ts)
  // so the index is complete regardless of which profile's catalog view is active
  // — the songs live in the lolly-start SOURCE, which build:catalog only reaches
  // when that profile is the active view.
  const checksum = `sha256-${createHash('sha256').update(bytes).digest('base64')}`;
  const size = Buffer.byteLength(bytes);
  console.log(
    `  ${t.slug.padEnd(16)} ${t.spec.archetype.padEnd(9)} ${sec.toFixed(0).padStart(2)}s  ` +
      `peak=${peak.toFixed(3)}  ${song.patterns.length}pat×seq${song.sequence.length}  ${json.length}B  [${flag}]`,
  );

  newEntries.push({
    id: `lolly/songs/${t.slug}`,
    name: t.name,
    description: `${t.description} Generated on device from a few KB of ZzFXM data (~${Math.round(sec)}s loop). A focus track for Neurospicy Mode, also selectable as a video music bed. Public domain (CC0).`,
    type: 'audio',
    version: '1.0.0',
    tier: 'on-demand',
    tags: [...BASE_TAGS, ...t.extraTags],
    formats: [{ format: 'zzfxm', url: `${URL_BASE}/${file}`, checksum, size }],
    license: 'CC0-1.0',
  });
}

const index = existsSync(INDEX_PATH)
  ? (JSON.parse(readFileSync(INDEX_PATH, 'utf8')) as { assets: Asset[]; [k: string]: unknown })
  : { assets: [] as Asset[] };
index.assets = (index.assets ?? []).filter((a) => !a.id.startsWith('lolly/songs/'));
index.assets.push(...newEntries);
writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2) + '\n');

console.log(`\n${anyBad ? '⚠ some tracks out of range — check flags above' : '✓'} Generated ${newEntries.length} ZzFXM tracks → ${SONGS_DIR}`);
console.log('  Checksums/sizes are self-filled; no build:catalog needed for the songs.');
console.log('  To hear them: npm run profile:start && npm run dev:web (they live in the lolly-start brand).');
