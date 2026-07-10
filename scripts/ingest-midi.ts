/**
 * MIDI → ZzFXM ingest. Converts a Standard MIDI File into a tiny ZzFXM song and
 * registers it as a `type:'audio'`, `format:'zzfxm'` catalog asset (lolly-start),
 * tagged `neurospicy` so it plays in the focus-music player. Self-contained: a
 * minimal SMF parser + a note→pattern mapper (no runtime deps).
 *
 * Usage:  node scripts/ingest-midi.ts <file.mid> [--slug fur-elise] [--name "Für Elise"] [--grid 4]
 *   --grid = steps per quarter note (4 = 16th grid, 8 = 32nd). Default 4.
 *
 * How it maps: notes quantize to a fixed step grid; ZzFXM BPM is set so a step
 * equals that grid unit at the file's tempo. Overlapping notes (chords/polyphony)
 * are split greedily across ZzFXM voice-channels (one note per channel per step).
 * Notes are shifted so the LOWEST note is a positive ZzFXM note value (0/negative
 * are rest/stop in ZzFXM); the instrument's base frequency is set to compensate,
 * so absolute pitches stay exact. Velocity/dynamics are dropped (v1).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderZzfxm } from '../engine/src/zzfxm.ts';
import { parseMidi, midiToSong } from '../engine/src/midi.ts';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const SONGS_DIR = join(ROOT, 'brands/lolly-start/catalog/assets/lolly/songs');
const INDEX_PATH = join(ROOT, 'brands/lolly-start/catalog/assets/index.json');
const URL_BASE = '/catalog/assets/lolly/songs';

// parseMidi + midiToSong live in engine/src/midi.ts so the browser upload path and
// this CLI convert MIDI identically (one code path). This script adds the Node-only
// wrapper: read a file, render-verify, and register the song in the catalog index.

// ── CLI ──
const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
if (!file) { console.error('usage: node scripts/ingest-midi.ts <file.mid> [--slug X] [--name "Y"] [--grid 4]'); process.exit(1); }
const opt = (k: string): string | undefined => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : undefined; };
const slug = (opt('slug') ?? basename(file).replace(/\.midi?$/i, '')).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const name = opt('name') ?? slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const grid = Number(opt('grid')) || 4;

const parsed = parseMidi(readFileSync(file));
const song = midiToSong(parsed, { name, stepsPerQuarter: grid });

const pcm = renderZzfxm(song);
let peak = 0;
for (let i = 0; i < pcm.left.length; i++) peak = Math.max(peak, Math.abs(pcm.left[i]!), Math.abs(pcm.right[i]!));
const sec = pcm.left.length / pcm.sampleRate;
console.log(`  ${slug}: ${sec.toFixed(1)}s  peak=${peak.toFixed(3)}  notes=${parsed.notes.length}  voices=${song.patterns[0]!.length}  bpm=${song.bpm}  ${peak > 1 ? 'CLIPPING?!' : peak < 0.02 ? 'SILENT?!' : 'ok'}`);

mkdirSync(SONGS_DIR, { recursive: true });
const fileName = `${slug}.zzfxm.json`;
const bytes = JSON.stringify(song) + '\n';
writeFileSync(join(SONGS_DIR, fileName), bytes);

const index = existsSync(INDEX_PATH) ? JSON.parse(readFileSync(INDEX_PATH, 'utf8')) : { assets: [] };
type Asset = { id: string; [k: string]: unknown };
index.assets = (index.assets as Asset[]).filter((a) => a.id !== `lolly/songs/${slug}`);
index.assets.push({
  id: `lolly/songs/${slug}`,
  name,
  description: `${name} — a public-domain piano piece, converted from MIDI to a tiny ZzFXM song and synthesised on device. A focus track for Neurospicy Mode, also a video music bed. Public domain (CC0).`,
  type: 'audio',
  version: '1.0.0',
  tier: 'on-demand',
  tags: ['audio', 'song', 'neurospicy', 'melodic', 'piano', 'classical'],
  formats: [{ format: 'zzfxm', url: `${URL_BASE}/${fileName}`, checksum: `sha256-${createHash('sha256').update(bytes).digest('base64')}`, size: Buffer.byteLength(bytes) }],
  license: 'CC0-1.0',
});
writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2) + '\n');
console.log(`\n✓ Added ${name} → ${join(SONGS_DIR, fileName)} (${bytes.length}B). Audition in the player.`);
