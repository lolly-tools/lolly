// SPDX-License-Identifier: MPL-2.0
/**
 * credential-lofi — stamp each committed lo-fi loop (`lolly/loops/*.opus` in the
 * blank `lolly-start` brand) with a C2PA Content Credential that discloses its
 * ORIGIN: these tracks are the Open Lo-Fi collection (github.com/btahir/open-lofi),
 * **generated with Suno** and donated to the public domain under CC0. See
 * `scripts/ingest-lofi.ts` for how the .opus files were produced.
 *
 * The credential is deliberately NOT signed as Lolly. Lolly did not make this
 * music; it is only attaching an honest provenance record to a CC0 asset it
 * redistributes. So the manifest is:
 *   - signed by a self-signed "Open Lo-Fi (Suno v5)" identity (never Lolly's) —
 *     the verifier reads a valid-but-untrusted signer, and `madeWithLolly` is
 *     false;
 *   - a `c2pa.created` action with IPTC digitalSourceType `trainedAlgorithmicMedia`
 *     (the GenAI signal the /verify AI banner and the catalog pill read);
 *   - author = the Open Lo-Fi project, rights = CC0.
 * It rides in the OpusTags comment header (engine `placeOgg`; grammar in
 * `engine/src/ogg.ts`), byte-range excluded from the hard binding, so the audio
 * is untouched and the file stays a valid, playable Ogg. The catalog side is
 * marked in the same pass: `aiGenerated: 'full'` on each index entry (the violet
 * "GEN AI" pill) + a Suno line appended to the description.
 *
 * A one-shot generator (like ingest-lofi/previews): operates on the COMMITTED
 * .opus files — no source mp3s needed — then re-runnable idempotently (re-stamp
 * replaces the prior credential; the flag/description edits are guarded). Run it,
 * commit, then `npm run build:catalog` (refills checksum + size, since bytes
 * changed) and `npm run validate:catalog`.
 *
 * Usage:  node scripts/credential-lofi.ts
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { embedC2pa, verifyC2pa, GENERATED_SOURCE_TYPE } from '../engine/src/index.ts';
import { generateSigner } from '../engine/src/x509.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_ROOT = join(ROOT, 'brands/lolly-start/catalog'); // parent-owned blank brand (not a submodule)
const OUT_DIR = join(OUT_ROOT, 'assets/lolly/loops');
const INDEX = join(OUT_ROOT, 'assets/index.json');
const ID_PREFIX = 'lolly/loops/';

// The upstream project + generator, recorded verbatim in the credential and the
// catalog copy. This is the whole point: the music's real origin, stated once.
const PROJECT = 'Open Lo-Fi';
const PROJECT_URL = 'github.com/btahir/open-lofi';
const GENERATOR = 'Suno v5';
const AUTHOR = `${PROJECT} (${PROJECT_URL})`;
const RIGHTS = 'CC0 1.0 Universal (public domain dedication)';
const CREATED_DESCRIPTION = `Generated with ${GENERATOR} and released to the public domain (CC0) by the ${PROJECT} project`;
// Appended (once) to each catalog entry's human-facing description.
const AI_NOTE = `AI-generated with Suno (the ${PROJECT} project, ${PROJECT_URL}).`;

// Pinned so re-runs only churn the fresh signature/key, not the timestamps.
const DATES = { signedAt: '2026-08-09T00:00:00Z', notBefore: '2026-08-09T00:00:00Z', notAfter: '2036-08-09T00:00:00Z' };
const SUBJECT = { organization: PROJECT, commonName: `${PROJECT} (${GENERATOR})` };

interface AssetFormat { format: string; url: string; checksum: string; size: number }
interface AssetEntry { id: string; name: string; description: string; formats: AssetFormat[]; aiGenerated?: string; [k: string]: unknown }

const index = JSON.parse(readFileSync(INDEX, 'utf8')) as { assets: AssetEntry[] };
const loops = index.assets.filter((a) => a.id.startsWith(ID_PREFIX));
if (!loops.length) { console.error(`No ${ID_PREFIX}* assets in ${INDEX} — run ingest-lofi first.`); process.exit(1); }

let stamped = 0;
for (const entry of loops) {
  const slug = entry.id.slice(ID_PREFIX.length);
  const file = join(OUT_DIR, `${slug}.opus`);
  if (!existsSync(file)) { console.log(`  (skipping ${entry.id} — ${file} not found)`); continue; }

  const bytes = new Uint8Array(readFileSync(file));
  // A fresh self-signed key per track (identity is the subject Name, not the key).
  const signer = await generateSigner(DATES, SUBJECT);
  const out = await embedC2pa(bytes, 'opus', {
    signer,
    dates: DATES,
    title: entry.name,
    claimGenerator: GENERATOR,
    generatorInfo: { name: GENERATOR },
    author: { name: AUTHOR },
    rights: RIGHTS,
    actions: [{ action: 'c2pa.created', digitalSourceType: GENERATED_SOURCE_TYPE, description: CREATED_DESCRIPTION }],
  });

  // Self-check: the credential must read back valid, flagged GenAI, and NOT as Lolly.
  const rep = await verifyC2pa(out);
  if (rep.state !== 'valid') throw new Error(`${entry.id}: credential did not verify (state=${rep.state})`);
  if (rep.aiGenerated?.kind !== 'generated') throw new Error(`${entry.id}: GenAI flag missing (${JSON.stringify(rep.aiGenerated)})`);
  if (rep.madeWithLolly || rep.signer?.organization === 'Lolly') throw new Error(`${entry.id}: credential wrongly attributes to Lolly`);

  writeFileSync(file, out);
  entry.aiGenerated = 'full';
  if (!/\bSuno\b/.test(entry.description)) entry.description = `${entry.description.replace(/\s*$/, '')} ${AI_NOTE}`;
  stamped++;
  console.log(`  ✓ ${entry.id}  signed by ${rep.signer?.commonName} · GenAI · CC0  (+${out.length - bytes.length} B)`);
}

writeFileSync(INDEX, JSON.stringify(index, null, 2) + '\n');
console.log(`\nCredentialed ${stamped} lo-fi loops (GenAI / ${GENERATOR} / CC0, signed as ${PROJECT}).`);
console.log('Next: npm run build:catalog && npm run validate:catalog');
