// SPDX-License-Identifier: MPL-2.0
/**
 * build-voice-clips - synthesize a robot voice speaking each catalog TYPE FILTER name,
 * at build time. A one-shot generator (like `pnpm run previews`): run it locally, commit
 * the output. The web shell plays the clip on click (data-voice="<label>", see
 * lib/sfx.ts playVoice). Requires macOS `say` (the Zarvox robot voice) + ffmpeg, so it
 * runs on a Mac, NOT on Vercel - the committed mp3s ship with the static build.
 *
 * Clips: one mp3 per UNIQUE spoken label, named by a slug of the label, under
 * shells/web/public/voice/<slug>.mp3 (served at /voice/<slug>.mp3).
 *
 * The colour swatches do NOT speak: an icon theme or photo treatment is a brand colour
 * pairing, and a robot reading its name over every swatch click is not how the brand
 * sounds. Those rows carry the shimmer cue alone (views/assets/thumbs.ts).
 *
 * Usage:  node scripts/build-voice-clips.ts
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'shells/web/public/voice');
const VOICE = 'Zarvox'; // the classic macOS robot voice

export const voiceSlug = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// The labels to voice: the catalog's type filters, and nothing else. Brand-independent,
// so this script produces the same set under every profile.
const labels = new Set<string>(['All', 'Image', 'Vector', 'Motion']);

// Snappier + deeper: pitch DOWN then speed UP, independently. `say` renders at a fixed
// 22050 Hz; asetrate replays at PITCH× (drops pitch AND tempo), aresample normalises,
// then atempo speeds tempo back up past 1× WITHOUT touching the (now lower) pitch.
const SR = 22050;      // say's output sample rate
const PITCH = 0.8;     // 20 % lower
const SPEED = 1.48;    // ~1.5× faster overall
const AFILTER = `asetrate=${SR}*${PITCH},aresample=${SR},atempo=${(SPEED / PITCH).toFixed(3)}`;

mkdirSync(OUT, { recursive: true });
const tmp = join(OUT, '_tmp.aiff');
for (const label of [...labels].sort()) {
  const slug = voiceSlug(label);
  if (!slug) continue;
  execFileSync('say', ['-v', VOICE, '-o', tmp, label]);
  // mono, 48 kbps mp3 - a robot voice needs no more; each clip lands at a few KB.
  execFileSync('ffmpeg', ['-y', '-i', tmp, '-af', AFILTER, '-codec:a', 'libmp3lame', '-b:a', '48k', '-ac', '1', join(OUT, `${slug}.mp3`)], { stdio: 'ignore' });
  console.log(`  ✓ voice/${slug}.mp3  ← "${label}"`);
}
rmSync(tmp, { force: true });
console.log(`\nVoiced ${labels.size} labels (${VOICE}) → shells/web/public/voice/`);
