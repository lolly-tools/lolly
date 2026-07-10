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

  // ── drum and bass ────────────────────────────────────────────────────────
  {
    slug: 'db-night-signal',
    name: 'Night Signal',
    spec: { archetype: 'drumAndBass', seed: 0xb4001d, bpm: 174, scale: 'minorPent', roots: [12, 17, 19, 15, 22], targetSec: 48, lead: 'pad', bass: 'reese', restProb: 0.12, pan: -0.15 },
    extraTags: ['drum-and-bass', 'dark', 'energetic', 'bass'],
    description: 'A syncopated breakbeat with a growling, ever-moving bass and a sparse dark pad stabbing through the gaps.',
  },
  {
    slug: 'db-glass-current',
    name: 'Glass Current',
    spec: { archetype: 'drumAndBass', seed: 0xe2f9a6, bpm: 168, scale: 'suspended', roots: [12, 19, 17, 14], targetSec: 40, lead: 'glass', bass: 'sub', restProb: 0.28, pan: 0.2 },
    extraTags: ['drum-and-bass', 'moody', 'melodic', 'atmospheric'],
    description: 'Fast rolling hats and a deep gliding sub under cool glassy stabs — moody and propulsive.',
  },
  {
    slug: 'db-red-district',
    name: 'Red District',
    spec: { archetype: 'drumAndBass', seed: 0xc17b5f, bpm: 172, scale: 'harmonicMinor', roots: [12, 20, 15, 17, 24], targetSec: 55, lead: 'sweep', bass: 'reese', restProb: 0.1, pan: -0.25 },
    extraTags: ['drum-and-bass', 'dark', 'aggressive', 'bass'],
    description: 'A driving breakbeat with a snarling bass and a haunting minor-key swell, dark and relentless.',
  },

  // ── jungle ───────────────────────────────────────────────────────────────
  {
    slug: 'jn-undergrowth',
    name: 'Undergrowth',
    spec: { archetype: 'jungle', seed: 0x8f3c21, bpm: 174, scale: 'minorPent', roots: [12, 15, 19, 17], targetSec: 42, lead: 'glockenspiel', bass: 'sub', restProb: 0.4, pan: -0.2 },
    extraTags: ['jungle', 'beat', 'breakbeat', 'dark'],
    description: 'A dense, chopped breakbeat with ghost snare hits, a deep sub pulse, and a sparkling echo-y bell melody darting through the gaps.',
  },
  {
    slug: 'jn-ragga-transmission',
    name: 'Ragga Transmission',
    spec: { archetype: 'jungle', seed: 0xc419e6, bpm: 88, scale: 'phrygianDominant', roots: [12, 19, 13, 20, 17], targetSec: 52, lead: 'bell', bass: 'reese', restProb: 0.6, pan: 0.25 },
    extraTags: ['jungle', 'beat', 'echo', 'dreamy'],
    description: 'A half-time jungle groove with a deep wobbling sub, ragga-flavored bell stabs, and plenty of space between the breaks.',
  },

  // ── classical ────────────────────────────────────────────────────────────
  {
    slug: 'cl-morning-sonata',
    name: 'Morning Sonata',
    spec: { archetype: 'classical', seed: 0xc1a5e0, bpm: 96, scale: 'majorScale', roots: [12, 19, 21, 17], targetSec: 48, lead: 'harpsichord', restProb: 0.15, pan: 0.1 },
    extraTags: ['classical', 'graceful', 'melodic'],
    description: 'A bright, arpeggiated harpsichord dances over a warm string pad through a classic major-key turn.',
  },
  {
    slug: 'cl-autumn-reverie',
    name: 'Autumn Reverie',
    spec: { archetype: 'classical', seed: 0x8b3fd2, bpm: 78, scale: 'harmonicMinor', roots: [12, 20, 17, 19, 12], targetSec: 52, lead: 'piano', restProb: 0.3, pan: -0.15 },
    extraTags: ['classical', 'dreamy', 'strings'],
    description: 'A wistful piano arpeggio drifts beneath a slow string swell, turning gently through a minor key.',
  },
  {
    slug: 'cl-twilight-waltz',
    name: 'Twilight Waltz',
    spec: { archetype: 'classical', seed: 0xe47a19, bpm: 88, scale: 'majorScale', roots: [24, 19, 21, 17], targetSec: 40, lead: 'harpsichord', restProb: 0.22, pan: 0.2 },
    extraTags: ['classical', 'graceful', 'dreamy'],
    description: 'A graceful, waltz-like harpsichord arpeggio swirls over lush strings, drifting between light and shadow.',
  },

  // ── spanish guitar ───────────────────────────────────────────────────────
  {
    slug: 'sg-ember-rain',
    name: 'Ember and Rain',
    spec: { archetype: 'spanishGuitar', seed: 0xa13f9c, bpm: 96, scale: 'harmonicMinor', roots: [12, 20, 17, 19], targetSec: 48, lead: 'nylonGuitar', restProb: 0.42, pan: -0.12 },
    extraTags: ['melodic', 'moody', 'spanish-guitar'],
    description: 'Slow, brooding nylon-guitar arpeggios circle a minor-key progression over a low grounding bass and the faintest hand-claps.',
  },
  {
    slug: 'sg-andalusian-fire',
    name: 'Andalusian Fire',
    spec: { archetype: 'spanishGuitar', seed: 0x5e7bd2, bpm: 122, scale: 'phrygianDominant', roots: [12, 13, 20, 22, 19], targetSec: 36, lead: 'nylonGuitar', restProb: 0.2, pan: 0.15 },
    extraTags: ['rhythm', 'passionate', 'spanish-guitar'],
    description: 'Fast, fiery flamenco-flavored guitar runs snap between sharp chord stabs and a driving off-beat clap.',
  },

  // ── cuban ────────────────────────────────────────────────────────────────
  {
    slug: 'cb-malecon-sunset',
    name: 'Malecón Sunset',
    spec: { archetype: 'cuban', seed: 0xc8a3f1, bpm: 108, scale: 'majorPent', roots: [12, 16, 19, 21], targetSec: 42, lead: 'piano', bass: 'bass', pan: 0.15 },
    extraTags: ['cuban', 'rhythm', 'beat', 'melodic'],
    description: 'Bouncy piano-montuno stabs ride a lively son-clave with congas and bongos, bright and sunny like a Havana afternoon.',
  },
  {
    slug: 'cb-havana-midnight',
    name: 'Havana Midnight',
    spec: { archetype: 'cuban', seed: 0xe21b7a, bpm: 98, scale: 'harmonicMinor', roots: [12, 15, 19, 20, 17], targetSec: 50, lead: 'epiano', bass: 'sub', pan: -0.15 },
    extraTags: ['cuban', 'rhythm', 'beat', 'dreamy'],
    description: 'A slower, sultry son groove — mellow electric-piano montuno and a deep rolling bass under murmuring congas after dark.',
  },

  // ── bossa nova ───────────────────────────────────────────────────────────
  {
    slug: 'bn-copacabana-breeze',
    name: 'Copacabana Breeze',
    spec: { archetype: 'bossaNova', seed: 0x6b2e9f, bpm: 122, scale: 'majorScale', roots: [12, 19, 17, 21], targetSec: 48, lead: 'nylonGuitar', pan: 0.12 },
    extraTags: ['bossa-nova', 'melodic', 'calm'],
    description: 'Warm nylon guitar comping bounces over a soft brushed snare and a gentle shaker pulse — a sunny, unhurried bossa sway.',
  },
  {
    slug: 'bn-midnight-veranda',
    name: 'Midnight Veranda',
    spec: { archetype: 'bossaNova', seed: 0xd174ab, bpm: 117, scale: 'harmonicMinor', roots: [12, 20, 17, 15, 19], targetSec: 52, lead: 'epiano', pan: -0.15 },
    extraTags: ['bossa-nova', 'dreamy', 'calm'],
    description: 'Mellow electric piano comps in a minor key over a soft brushed snare and shaker — a hushed, late-night bossa mood.',
  },

  // ── whimsical ────────────────────────────────────────────────────────────
  {
    slug: 'wh-button-jar',
    name: 'Button Jar',
    spec: { archetype: 'whimsical', seed: 0xa1c3f2, bpm: 140, scale: 'majorPent', roots: [12, 19, 21, 16], targetSec: 38, lead: 'glockenspiel', restProb: 0.22, pan: 0.1 },
    extraTags: ['whimsical', 'playful', 'bright', 'melodic'],
    description: 'A bright, bouncy music-box melody that hops and skips over a plucky little bass line.',
  },
  {
    slug: 'wh-teacup-parade',
    name: 'Teacup Parade',
    spec: { archetype: 'whimsical', seed: 0x5e7d91, bpm: 118, scale: 'suspended', roots: [12, 17, 22, 19], targetSec: 48, lead: 'bell', restProb: 0.4, pan: -0.15 },
    extraTags: ['whimsical', 'dreamy', 'curious', 'melodic'],
    description: 'A curious, airy bell tune that wanders and pauses unexpectedly, like tiptoeing through a strange garden.',
  },
  {
    slug: 'wh-clockwork-sparrow',
    name: 'Clockwork Sparrow',
    spec: { archetype: 'whimsical', seed: 0xc02aab, bpm: 128, scale: 'minorPent', roots: [12, 19, 15, 22, 17], targetSec: 42, lead: 'glass', restProb: 0.18, pan: 0.2 },
    extraTags: ['whimsical', 'quirky', 'playful', 'melodic'],
    description: 'A quirky, glassy melody with a mechanical little skip and impish, ticking pauses.',
  },

  // ── chiptune ─────────────────────────────────────────────────────────────
  {
    slug: 'ct-turbo-dash',
    name: 'Turbo Dash',
    spec: { archetype: 'chiptune', seed: 0x2f7ae4, bpm: 156, scale: 'majorPent', roots: [12, 16, 19, 24, 21], targetSec: 38, lead: 'pulse', pan: -0.2 },
    extraTags: ['chiptune', 'energetic', 'arcade', 'beat'],
    description: 'A buzzy pulse-wave arpeggio sprints over a punchy 8-bit kick, pure retro race-track energy.',
  },
  {
    slug: 'ct-pixel-quest',
    name: 'Pixel Quest',
    spec: { archetype: 'chiptune', seed: 0xb81c56, bpm: 144, scale: 'majorScale', roots: [12, 17, 19, 24], targetSec: 46, lead: 'square', pan: 0.15 },
    extraTags: ['chiptune', 'catchy', 'playful', 'melodic'],
    description: 'A bright square-wave melody bounces through a cheerful chord march, like a hero setting off on a quest.',
  },

  // ── lo-fi ────────────────────────────────────────────────────────────────
  {
    slug: 'lf-rainy-window',
    name: 'Rainy Window',
    spec: { archetype: 'lofi', seed: 0xb17ea5, bpm: 74, scale: 'minorPent', roots: [12, 19, 15, 17], targetSec: 48, lead: 'epiano', bass: 'bass', pan: -0.15 },
    extraTags: ['lofi', 'beat', 'calm'],
    description: 'A hazy electric-piano loop over a swung, laid-back beat, like listening to rain through a café window.',
  },
  {
    slug: 'lf-corner-booth',
    name: 'Corner Booth',
    spec: { archetype: 'lofi', seed: 0x2f9c41, bpm: 85, scale: 'majorScale', roots: [21, 17, 12, 19], targetSec: 36, lead: 'piano', bass: 'sub', pan: 0.2 },
    extraTags: ['lofi', 'rhythm', 'focus'],
    description: 'Late-night jazzy piano stabs ride a deep rolling bass, shuffled just enough to feel unhurried.',
  },
  {
    slug: 'lf-sunday-static',
    name: 'Sunday Static',
    spec: { archetype: 'lofi', seed: 0xd48ac0, bpm: 80, scale: 'suspended', roots: [12, 19, 22, 17, 14], targetSec: 52, lead: 'nylonGuitar', bass: 'bass', pan: 0.1 },
    extraTags: ['lofi', 'melodic', 'dreamy'],
    description: 'A dusty plucked-guitar loop drifts over a soft shuffled beat, a lazy Sunday with a little vinyl crackle.',
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
// Only replace entries THIS script owns (one per TRACKS slug) — songs registered by
// other sources (e.g. scripts/ingest-midi.ts's fur-elise) must survive a rerun.
const ownedSlugs = new Set(TRACKS.map((t) => `lolly/songs/${t.slug}`));
index.assets = (index.assets ?? []).filter((a) => !ownedSlugs.has(a.id));
index.assets.push(...newEntries);
writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2) + '\n');

console.log(`\n${anyBad ? '⚠ some tracks out of range — check flags above' : '✓'} Generated ${newEntries.length} ZzFXM tracks → ${SONGS_DIR}`);
console.log('  Checksums/sizes are self-filled; no build:catalog needed for the songs.');
console.log('  To hear them: npm run profile:start && npm run dev:web (they live in the lolly-start brand).');
