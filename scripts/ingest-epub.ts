// SPDX-License-Identifier: MPL-2.0
/**
 * ingest-epub - turn a brand's `.epub` body copy into managed catalog TEXT assets so
 * boilerplate lives centrally and drops into tools as text/longtext input.
 *
 *   npm run ingest:boilerplate -- <file.epub> --brand <name> --ns <ns> [--label "Title"]
 *
 * Each EPUB chapter becomes one `type:'text'` / `format:'md'` asset written to
 * `brands/<brand>/catalog/assets/<ns>/boilerplate/<slug>.md` and MERGED into that
 * brand's `catalog/assets/index.json` (prior `<ns>/boilerplate/*` records are replaced,
 * so re-ingest is idempotent). Every tool in the profile can then reach them via
 * `host.assets.query({ tags: ['boilerplate'] })`.
 *
 * `readEpub` is deliberately lossy (headings/paragraphs/lists/emphasis only - no
 * styling, columns, or imagery), which is why ingestion happens at BUILD time: the
 * extracted Markdown is reviewable output, not a live round-trip.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readEpub } from '../engine/src/index.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export interface BoilerplateAsset {
  id: string;
  name: string;
  description: string;
  type: 'text';
  version: string;
  tier: 'catalog';
  tags: string[];
  formats: { format: 'md'; url: string; checksum: string; size: number }[];
}

/** A chapter's markdown + the asset record + the file to write. */
export interface BoilerplateOutput {
  slug: string;
  relPath: string;              // relative to the brand pack root
  bytes: Uint8Array;
  record: BoilerplateAsset;
}

/** Kebab-case ascii slug from a chapter title, stable for a given title. */
export function slugForTitle(title: string): string {
  const s = title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')      // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return s || 'chapter';
}

/**
 * Pure transform: EPUB chapters → boilerplate outputs for namespace `ns`. Empty
 * chapters are skipped; duplicate slugs get a `-2`, `-3`… suffix so ids stay unique
 * and deterministic for a given document.
 */
export function buildBoilerplate(
  doc: { title?: string; chapters: { title: string; markdown: string }[] },
  ns: string,
): BoilerplateOutput[] {
  const out: BoilerplateOutput[] = [];
  const used = new Map<string, number>();
  for (const ch of doc.chapters) {
    const md = (ch.markdown ?? '').trim();
    if (!md) continue;                                   // nothing to store
    let slug = slugForTitle(ch.title || 'chapter');
    const n = (used.get(slug) ?? 0) + 1;
    used.set(slug, n);
    if (n > 1) slug = `${slug}-${n}`;
    const bytes = new TextEncoder().encode(`${md}\n`);
    const rel = `catalog/assets/${ns}/boilerplate/${slug}.md`;
    out.push({
      slug,
      relPath: rel,
      bytes,
      record: {
        id: `${ns}/boilerplate/${slug}`,
        name: ch.title || slug,
        description: doc.title ? `Boilerplate from “${doc.title}”.` : 'Brand boilerplate text.',
        type: 'text',
        version: '1.0.0',
        tier: 'catalog',
        tags: ['boilerplate', 'text'],
        formats: [{
          format: 'md',
          url: `/${rel}`,
          checksum: `sha256-${createHash('sha256').update(bytes).digest('base64')}`,
          size: bytes.length,
        }],
      },
    });
  }
  return out;
}

/** Merge new boilerplate records into an existing index's asset list, replacing any
 *  prior `<ns>/boilerplate/*` entries so re-ingest is idempotent. */
export function mergeBoilerplateIndex(
  index: { version?: string; generatedAt?: string; assets: { id: string }[] },
  ns: string,
  records: BoilerplateAsset[],
): { version: string; generatedAt: string; assets: { id: string }[] } {
  const prefix = `${ns}/boilerplate/`;
  const kept = (index.assets ?? []).filter((a) => !a.id.startsWith(prefix));
  return {
    version: index.version ?? '1',
    generatedAt: index.generatedAt ?? '',
    assets: [...kept, ...records],
  };
}

function parseArgs(argv: string[]) {
  const [file] = argv;
  const flag = (name: string) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const brand = flag('brand');
  const ns = flag('ns') ?? brand;
  if (!file || !brand || !ns) {
    throw new Error('usage: ingest-epub <file.epub> --brand <name> --ns <ns> [--label "Title"]');
  }
  return { file, brand, ns, label: flag('label') };
}

function main(argv: string[]): void {
  const { file, brand, ns } = parseArgs(argv);
  const packRoot = join(ROOT, 'brands', brand);
  if (!existsSync(packRoot)) throw new Error(`brand pack not found: brands/${brand} (is the submodule mounted?)`);

  const doc = readEpub(new Uint8Array(readFileSync(resolve(file))));
  const outputs = buildBoilerplate(doc, ns);
  if (!outputs.length) throw new Error('no non-empty chapters found in that EPUB');

  for (const o of outputs) {
    const abs = join(packRoot, o.relPath);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, o.bytes);
  }

  const indexPath = join(packRoot, 'catalog/assets/index.json');
  const index = existsSync(indexPath)
    ? JSON.parse(readFileSync(indexPath, 'utf8'))
    : { version: '1', generatedAt: '', assets: [] };
  const merged = mergeBoilerplateIndex(index, ns, outputs.map((o) => o.record));
  writeFileSync(indexPath, `${JSON.stringify(merged, null, 2)}\n`);

  // eslint-disable-next-line no-console
  console.log(`ingest-epub: wrote ${outputs.length} boilerplate asset(s) to brands/${brand}/catalog/assets/${ns}/boilerplate/ and merged the index. Run build:catalog + validate:catalog.`);
}

// Run as a script (not when imported by a test).
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
