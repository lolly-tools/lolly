// SPDX-License-Identifier: MPL-2.0
/**
 * Fallback fonts for the Node shells (CLI, TUI, MCP), read straight off disk.
 *
 * The web shell downloads a fallback font the first time a document needs one; here the
 * files are already under the shared root community/fallback-fonts, so a run takes the
 * same pack the web would choose (fallback-fonts.ts decides for both) and HarfBuzz reads
 * it through the `/catalog/packs/` url the content roots resolve. A deployment that left
 * the font files out of its trace keeps the index, and those packs are skipped: the run
 * keeps the answer it had without them.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { contentRoots, contentUrlFile, type ContentRoots } from './content-roots.ts';
import {
  choosePacks, fallbackPacksFrom, hanEvidence, hanForms, packVariations, runLang, uncoveredClusters,
  type FallbackFontPack, type FillUse, type HanEvidence, type LangElement,
} from './fallback-fonts.ts';

const listed = new Map<string, FallbackFontPack[]>();

/** The fallback fonts every mounted shared root offers whose files are on this disk. */
export function diskFallbackPacks(roots: ContentRoots = contentRoots()): FallbackFontPack[] {
  const key = roots.assetRoots.map((r) => r.dir).join('\u0000');
  const hit = listed.get(key);
  if (hit) return hit;
  const entries: unknown[] = [];
  for (const shared of roots.assetRoots) {
    const path = join(shared.dir, 'index.json');
    if (!existsSync(path)) continue;
    try { entries.push(...(JSON.parse(readFileSync(path, 'utf8')) as { assets?: unknown[] }).assets ?? []); }
    catch { /* an unreadable index offers nothing */ }
  }
  const packs = fallbackPacksFrom(entries).filter((p) => contentUrlFile(p.url, roots));
  listed.set(key, packs);
  return packs;
}

/** What a document's text shows about its language, read once per document. */
const evidenceOf = new WeakMap<object, HanEvidence>();

/**
 * A run's element and document, for choosing between the Chinese, Japanese and Korean fonts
 * (fallback-fonts.ts `hanForms`): its element, whose `lang` counts, and the document it
 * belongs to, whose text is read for kana and Hangul.
 */
export interface FillPlace { at?: LangElement | null; document?: { readonly textContent: string | null } | null }

/** A face in the shape toPath takes. */
export interface FillFace { fontUrl: string; variations?: string[] }

/**
 * The faces to add to a run's chain so it draws whole: first the later families of its
 * own stack (`later`), then the fallback fonts for what none of them maps. Null when the
 * chain already covers the run, which leaves it exactly as it was. `characters` is
 * `host.text.characters`.
 */
export async function nodeFillChain(
  characters: (fontUrl: string) => Promise<readonly number[]>,
  chain: readonly FillFace[],
  later: readonly FillFace[],
  text: string,
  opts: { weight: number; italic: boolean; roots?: ContentRoots; place?: FillPlace },
): Promise<{ fallbacks: Array<FillFace & { fill: true }>; uses: FillUse[] } | null> {
  if (/^\p{ASCII}*$/u.test(text)) return null;
  const cover = async (url: string): Promise<ReadonlySet<number>> => new Set(await characters(url).catch(() => []));
  const urls = chain.map((f) => f.fontUrl);
  const sets = await Promise.all(urls.map(cover));
  let found = uncoveredClusters(text, sets);
  if (!found.length) return null;
  const add: Array<FillFace & { fill: true }> = [];
  for (const face of later) {
    if (!found.length) break;
    if (urls.includes(face.fontUrl)) continue;
    urls.push(face.fontUrl);
    add.push({ ...face, fill: true });
    sets.push(await cover(face.fontUrl));
    found = uncoveredClusters(text, sets);
  }
  const uses: FillUse[] = [];
  if (found.length) {
    const packs = diskFallbackPacks(opts.roots);
    const doc = opts.place?.document;
    let evidence: HanEvidence | null = null;
    if (doc) {
      evidence = evidenceOf.get(doc) ?? hanEvidence(doc.textContent ?? '', packs);
      evidenceOf.set(doc, evidence);
    }
    const han = hanForms({ lang: runLang(opts.place?.at), text, document: evidence }, packs);
    for (const pack of choosePacks(found, packs, opts.italic, han).packs) {
      add.push({ fontUrl: pack.url, variations: packVariations(pack, opts.weight), fill: true });
      uses.push({ label: pack.label, family: pack.family });
    }
  }
  return add.length ? { fallbacks: add, uses } : null;
}
