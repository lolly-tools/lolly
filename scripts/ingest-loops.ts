// SPDX-License-Identifier: MPL-2.0
/**
 * ingest-loops — convert the looping-beat source files to opus and register them as catalog
 * audio assets under `suse/loops/` — the focus beats behind "Neurospicy Mode" (they also flow
 * into the video-export music picker, since that lists every type:'audio' asset). A one-shot
 * generator (like previews): run locally (needs ffmpeg), commit the output, then
 * `npm run build:catalog` (fills checksum + size) and `npm run validate:catalog`.
 *
 * Sources (default):
 *   ~/Build/wav         — the Amen-break WAVs   (cw_amenNN_<bpm>.wav)
 *   ~/Build/neurospicy  — the junglebreaks OGGs  (junglebreaks.co.uk - <name> (1) - …ogg)
 * Everything is re-encoded to opus @96k — ~half the size of mp3/aac, loops gaplessly, and
 * (unlike the source .ogg/vorbis) decodes in Safari's Web Audio. Idempotent: strips any prior
 * `suse/loops/*` from the index before re-adding.
 *
 * Usage:  node scripts/ingest-loops.ts
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'catalog/assets/suse/loops');
const OUT_URL = '/catalog/assets/suse/loops';
const INDEX = join(ROOT, 'catalog/assets/index.json');
const ID_PREFIX = 'suse/loops/';

// Slugs pulled from the catalogue on purpose — skip on (re-)ingest so they don't come back even
// though their source file is still in the sources folder.
const EXCLUDE = new Set(['humpty-dump', 'let-a-woman-be-a-woman', 'give-it-up-or-turnit-a-loose']);

const SOURCES: { dir: string; kind: 'amen' | 'jungle' }[] = [
  { dir: join(homedir(), 'Build/wav'), kind: 'amen' },
  { dir: join(homedir(), 'Build/neurospicy'), kind: 'jungle' },
];

interface AssetEntry { id: string; name: string; description: string; type: string; version: string; tier: string; tags: string[]; formats: { format: string; url: string; checksum: string; size: number }[]; license: string; }

const title = (s: string): string => s.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/\b\w/g, (c) => c.toUpperCase());
const slugify = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

function meta(kind: 'amen' | 'jungle', file: string, i: number): { slug: string; name: string; bpm: number; extraTags: string[] } {
  if (kind === 'amen') {
    const m = /amen0*(\d+)_(\d+)/i.exec(file);
    const n = String(m ? Number(m[1]) : i + 1).padStart(2, '0');
    const bpm = m ? Number(m[2]) : 0;
    return { slug: `amen-${n}`, name: `Amen Break ${n}${bpm ? ` · ${bpm} BPM` : ''}`, bpm, extraTags: ['amen'] };
  }
  // "junglebreaks.co.uk - funky_drummer (1) - 706kbps.ogg" → "funky_drummer"
  const m = /-\s*([a-z0-9_]+?)\s*(?:\(|-|$)/i.exec(file.replace(/^[^-]*-\s*/, '- '));
  const raw = (m ? m[1] : file.replace(/\.[^.]+$/, '')) ?? String(i + 1);
  return { slug: slugify(raw), name: title(raw), bpm: 0, extraTags: ['breakbeat', 'jungle'] };
}

mkdirSync(OUT_DIR, { recursive: true });
const index = JSON.parse(readFileSync(INDEX, 'utf8')) as { assets: AssetEntry[] };
const entries: AssetEntry[] = [];
const seen = new Set<string>();
for (const { dir, kind } of SOURCES) {
  let files: string[];
  try { files = readdirSync(dir).filter((f) => /\.(wav|ogg|mp3|aiff?|flac|m4a)$/i.test(f)).sort(); }
  catch { console.log(`  (skipping ${dir} — not found)`); continue; }
  files.forEach((file, i) => {
    const { slug, name, bpm, extraTags } = meta(kind, file, i);
    if (seen.has(slug) || EXCLUDE.has(slug)) return; // dedup across sources; skip removed ones
    seen.add(slug);
    execFileSync('ffmpeg', ['-y', '-i', join(dir, file), '-c:a', 'libopus', '-b:a', '64k', join(OUT_DIR, `${slug}.opus`)], { stdio: 'ignore' });
    entries.push({
      id: ID_PREFIX + slug,
      name,
      description: `Looping ${kind === 'amen' ? 'Amen-break' : 'breakbeat'} drum loop${bpm ? ` (~${bpm} BPM)` : ''} — a focus beat for Neurospicy Mode, also selectable as a video music bed.`,
      type: 'audio',
      version: '1.0.0',
      tier: 'on-demand',
      tags: ['audio', 'loop', 'beat', 'neurospicy', ...extraTags, ...(bpm ? [`${bpm}bpm`] : [])],
      formats: [{ format: 'opus', url: `${OUT_URL}/${slug}.opus`, checksum: 'sha256-PLACEHOLDER', size: 0 }],
      license: 'LicenseRef-Unspecified', // TODO: set the real licence for these loops before shipping.
    });
    console.log(`  ✓ ${ID_PREFIX + slug}${bpm ? `  (${bpm} BPM)` : ''}`);
  });
}
index.assets = index.assets.filter((a) => !a.id.startsWith(ID_PREFIX)).concat(entries);
writeFileSync(INDEX, JSON.stringify(index, null, 2) + '\n');
console.log(`\nIngested ${entries.length} loops → ${OUT_DIR}\nNext: npm run build:catalog && npm run validate:catalog`);
