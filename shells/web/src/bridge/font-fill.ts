// SPDX-License-Identifier: MPL-2.0
/**
 * Fallback fonts in an export: the shell's half of fallback-fonts.ts.
 *
 * `resolveExportFont` is `resolveVectorFont` for a run about to be outlined. When the
 * design system's fonts draw all of the run, it returns exactly what resolveVectorFont
 * did, so a covered run keeps its bytes. When they do not, it extends the chain the way a
 * browser walks a `font-family` list: first the later families in the run's own stack,
 * then the fallback font made for the script that is still missing. Each added face is a
 * `fill` face, which toPath only uses for clusters every face before it cannot draw, so a
 * brand font keeps every character it maps.
 *
 * A fallback font downloads the first time a run needs one and is then kept in the
 * catalog cache and held through prunes, so the script draws offline from then on. It is
 * never stored as an upload. Nothing here runs for ASCII text, and nothing downloads for
 * text the design system covers.
 *
 * Chinese, Japanese and Korean draw the same Han characters differently, so a run takes
 * them from one of those fonts, chosen by the run's `lang`, then its script, then a
 * stated default (fallback-fonts.ts `hanForms`). The run's element gives the `lang`; the
 * document an export draws (`withFallbackFonts`) gives the script context.
 */
import { parseFontFamilies } from '@lolly-tools/node-shell/font-faces';
import {
  choosePacks, fallbackPacksFrom, fillNotice, hanEvidence, hanForms, packVariations, runLang, uncoveredClusters,
  type FallbackFontPack, type FillCluster, type FillUse, type HanContext, type HanEvidence, type HanForm,
} from '@lolly-tools/node-shell/fallback-fonts';
import { brandRoleStack, genericFontRole, resolveFamilyChain, resolveVectorFont, type VectorFont } from './font-registry.ts';
import { PAGE_FALLBACK_FAMILY, catalogSynced, fallbackFontSource, markFillChain, openFillLog, pageFillSettled } from './fallback-font-source.ts';
import { _exportNotice } from './export-notice.ts';
import { _host } from './export-shared.ts';
import type { FontStyleSlice } from './text-svg.ts';

const ASCII = /^\p{ASCII}*$/u;

let packList: Promise<FallbackFontPack[]> | null = null;
let packsKnown = 0;

/** Moves on once the catalog's fallback fonts are known, so an answer given before can be asked again. */
export function packsGeneration(): number { return packsKnown; }

/** The fallback fonts this catalog offers, read once the catalog has synced. */
export function fallbackPacks(): Promise<FallbackFontPack[]> {
  if (packList) return packList;
  const source = fallbackFontSource();
  if (!source) return Promise.resolve([]);
  const read = (): Promise<FallbackFontPack[]> => source.entries().then((entries) => fallbackPacksFrom(entries)).catch(() => []);
  // On a first visit the catalog may still be arriving: wait for it once, then read again.
  const job = read().then(async (list) => (list.length ? list : catalogSynced().then(read)));
  packList = job;
  // A catalog that has not synced yet holds none; ask again next time rather than remember that.
  void job.then((list) => { if (list.length) packsKnown++; else if (packList === job) packList = null; });
  return job;
}

const packUrls = new Map<string, Promise<string | null>>();

/**
 * A pack's file as an sfnt HarfBuzz can read, as an object URL for the session. Null when
 * the bytes cannot be had (offline before first use), and asked again next time.
 */
export function fallbackPackUrl(pack: FallbackFontPack): Promise<string | null> {
  const key = `${pack.id}@${pack.version}`;
  const hit = packUrls.get(key);
  if (hit) return hit;
  const job = (async (): Promise<string | null> => {
    const source = fallbackFontSource();
    const bytes = source ? await source.bytes(pack.id) : null;
    if (!bytes?.length) return null;
    const woff2 = bytes[0] === 0x77 && bytes[1] === 0x4f && bytes[2] === 0x46 && bytes[3] === 0x32;
    const sfnt = woff2 ? await (await import('woff2-encoder/decompress')).default(bytes) : bytes;
    void source?.hold([pack.id]).catch(() => {});
    return URL.createObjectURL(new Blob([sfnt as BlobPart], { type: 'font/ttf' }));
  })().catch(() => null);
  packUrls.set(key, job);
  void job.then((url) => { if (!url && packUrls.get(key) === job) packUrls.delete(key); });
  return job;
}

const coverage = new Map<string, Promise<ReadonlySet<number>>>();

/**
 * The characters a face maps, through the host's text API, so the export walker never
 * loads the text implementation itself. Asked once per file for the session.
 */
function charactersIn(url: string): Promise<ReadonlySet<number>> {
  let hit = coverage.get(url);
  if (!hit) {
    const ask = fallbackFontSource()?.characters ?? _host?.text?.characters?.bind(_host.text);
    hit = (ask ? ask(url) : Promise.resolve([] as readonly number[])).then((list) => new Set(list), () => new Set<number>());
    coverage.set(url, hit);
    void hit.then((set) => { if (!set.size && coverage.get(url) === hit) coverage.delete(url); });
  }
  return hit;
}

const charactersOf = (urls: readonly string[]): Promise<Array<ReadonlySet<number>>> => Promise.all(urls.map(charactersIn));

/**
 * The families a browser would try after `resolved` for a character it lacks, in order.
 * A generic name stands for the brand's own stack for that role, the rule
 * resolveVectorFont already applies, so the brand's faces come before any fallback font.
 */
function laterFamilies(stack: string, resolved: string | undefined): string[] {
  const expanded: string[] = [];
  for (const family of parseFontFamilies(stack)) {
    // The live page's own registrations (page-fallback-fonts.ts) are the same files the
    // packs below supply, so they are taken from the catalog rather than from the page.
    if (family.startsWith(PAGE_FALLBACK_FAMILY)) continue;
    const role = genericFontRole(family);
    expanded.push(...(role ? brandRoleStack(role).filter((f) => !genericFontRole(f)) : [family]));
  }
  const at = resolved ? expanded.findIndex((f) => f.toLowerCase() === resolved.toLowerCase()) : -1;
  const out: string[] = [];
  for (const family of expanded.slice(at + 1)) {
    if (family.toLowerCase() !== resolved?.toLowerCase() && !out.some((f) => f.toLowerCase() === family.toLowerCase())) out.push(family);
  }
  return out;
}

type Entry = NonNullable<VectorFont['fallbacks']>[number];

/** The documents being exported now, each read once for what its text says about its language. */
const exporting: Array<{ root: Element; evidence?: HanEvidence }> = [];

/** What the document holding `at` shows (kana, Hangul, Traditional-only characters). */
function documentEvidence(at: Element | null | undefined, packs: readonly FallbackFontPack[]): HanEvidence | null {
  let doc = at ? [...exporting].reverse().find((d) => d.root.contains(at)) : undefined;
  // A walker that draws from a copy of the tree has no live ancestor; the export's own
  // document is the one it is drawing.
  doc ??= exporting[exporting.length - 1];
  if (!doc) return null;
  doc.evidence ??= hanEvidence(doc.root.textContent ?? '', packs);
  return doc.evidence;
}

/** How a run chooses between the Chinese, Japanese and Korean fonts: a context, or the answer. */
type HanChoice = HanContext | readonly HanForm[] | ((packs: readonly FallbackFontPack[]) => HanContext);

/**
 * The font a run about to be outlined is drawn with, fallback fonts included. `at` is
 * the run's element, which says its language and the document it belongs to.
 */
export async function resolveExportFont(style: FontStyleSlice, text: string, at?: Element | null): Promise<VectorFont | null> {
  const base = await resolveVectorFont(style, text);
  if (!base || ASCII.test(text)) return base;
  const han: HanChoice = (packs) => ({ lang: runLang(at), text, document: documentEvidence(at, packs) });
  try { return await withFill(base, style, text, han); }
  catch { return base; }
}

/**
 * What a run needs beyond its first family: later families of its stack, then packs.
 * `unfilled` holds the clusters that no face and no pack can draw.
 */
interface FillPlan { added: Entry[]; packs: FallbackFontPack[]; unfilled: FillCluster[]; italic: boolean; weight: number }

async function fillPlan(base: VectorFont, style: FontStyleSlice, text: string, han?: HanChoice): Promise<FillPlan | null> {
  const urls = [base.url, ...(base.fallbacks ?? []).map((f) => f.fontUrl)];
  const sets = await charactersOf(urls);
  let found = uncoveredClusters(text, sets);
  if (!found.length) return null;

  const added: Entry[] = [];
  for (const family of laterFamilies(style.fontFamily ?? '', base.face?.family)) {
    const chain = await resolveFamilyChain(family, style, found.map((c) => c.text).join(''));
    if (!chain) continue;
    const entries: Entry[] = [
      { fontUrl: chain.url, ...(chain.variations ? { variations: chain.variations } : {}), ...(chain.face ? { face: chain.face } : {}) },
      ...(chain.fallbacks ?? []),
    ].filter((e) => !urls.includes(e.fontUrl));
    if (!entries.length) continue;
    for (const e of entries) { urls.push(e.fontUrl); added.push({ ...e, fill: true }); }
    sets.push(...await charactersOf(entries.map((e) => e.fontUrl)));
    found = uncoveredClusters(text, sets);
    if (!found.length) break;
  }

  const italic = style.fontStyle === 'italic' || style.fontStyle === 'oblique';
  const weight = parseInt(style.fontWeight ?? '', 10) || 400;
  let packs: FallbackFontPack[] = [];
  let unfilled: FillCluster[] = [];
  if (found.length) {
    const all = await fallbackPacks();
    const forms = Array.isArray(han) ? han as readonly HanForm[] : hanForms(typeof han === 'function' ? han(all) : han as HanContext | undefined, all);
    ({ packs, unfilled } = choosePacks(found, all, italic, forms));
  }
  return { added, packs, unfilled, italic, weight };
}

async function withFill(base: VectorFont, style: FontStyleSlice, text: string, han?: HanChoice): Promise<VectorFont> {
  const plan = await fillPlan(base, style, text, han);
  if (!plan) return base;
  const { added } = plan;
  const uses: FillUse[] = [];
  for (const pack of plan.packs) {
    const url = await fallbackPackUrl(pack);
    if (!url) continue;
    added.push({ fontUrl: url, variations: packVariations(pack, plan.weight), fill: true, face: { family: pack.family, weight: pack.weight, style: pack.style, source: 'catalog', file: pack.url } });
    uses.push({ label: pack.label, family: pack.family });
  }
  if (!added.length) return base;
  const fallbacks = [...(base.fallbacks ?? []), ...added];
  if (uses.length) markFillChain(fallbacks, uses);
  return { ...base, fallbacks };
}

/**
 * The fallback fonts an export would draw this run with, without loading them: what the
 * live page registers so it shows the same faces. Empty for a run the design system's
 * fonts draw whole, and for one no font of its stack resolves at all (an export keeps
 * that run as live text or a picture, so the page should not draw it differently).
 * `han` is the Chinese, Japanese or Korean choice the export would make for this text.
 */
export async function packsForText(style: FontStyleSlice, text: string, han?: readonly HanForm[]): Promise<FallbackFontPack[]> {
  if (ASCII.test(text)) return [];
  try {
    const base = await resolveVectorFont(style, text);
    if (!base) return [];
    return (await fillPlan(base, style, text, han))?.packs ?? [];
  } catch { return []; }
}

/** A run's element, which gives its `lang`, and the document that holds the run. */
export interface RunPlace { at?: Element | null; root?: Element | null }

const placeEvidence = new WeakMap<Element, { text: string; packs: readonly FallbackFontPack[]; evidence: HanEvidence }>();

/** What the document `root` shows about its language, read once while its text stays the same. */
function rootEvidence(root: Element, packs: readonly FallbackFontPack[]): HanEvidence {
  const text = root.textContent ?? '';
  const hit = placeEvidence.get(root);
  if (hit && hit.text === text && hit.packs === packs) return hit.evidence;
  const evidence = hanEvidence(text, packs);
  placeEvidence.set(root, { text, packs, evidence });
  return evidence;
}

/**
 * Does an export draw every character of this run, with the fonts it fills from? Asked
 * when shaping the run with `base`, the resolveVectorFont answer, missed a glyph. This reads the same coverage the export
 * reads: the character map of each face in the run's own stack, then the coverage table
 * that each fallback font's catalog entry records, with the same Chinese, Japanese and
 * Korean choice (`place` gives the run's `lang` and its document). It downloads nothing.
 *
 * False for ASCII text, because an export never fills ASCII. False when any cluster has
 * no font, such as a script with no fallback font or a Chinese character outside the
 * national sets: an export draws those as a picture in a PDF and as live text in an SVG.
 */
export async function fillDrawsAll(base: VectorFont, style: FontStyleSlice, text: string, place?: RunPlace): Promise<boolean> {
  if (ASCII.test(text)) return false;
  const han: HanChoice = (packs) => ({ lang: runLang(place?.at), text, document: place?.root ? rootEvidence(place.root, packs) : null });
  try {
    const plan = await fillPlan(base, style, text, han);
    // No plan means the faces' character maps hold every cluster, yet shaping still
    // missed a glyph: the export draws that run as it is, so it is not covered.
    return plan !== null && plan.unfilled.length === 0;
  } catch { return false; }
}

/** Does this resolved font draw with faces the run's first family does not hold? */
export function extendsChain(vf: VectorFont | null | undefined): boolean {
  return Boolean(vf?.fallbacks?.some((f) => f.fill));
}

/**
 * One export's render, in step with the fallback fonts: it waits (bounded) for the live
 * page to put its fallback fonts in place, so the export lays text out in the faces the
 * page shows, and afterwards puts one note on the export card for the fonts that drew
 * some of the text. `root` is the document being drawn, read for its language.
 */
export async function withFallbackFonts<T>(render: () => Promise<T>, root?: Element | null): Promise<T> {
  const close = openFillLog();
  const doc = root ? { root } : null;
  if (doc) exporting.push(doc);
  try {
    await pageFillSettled();
    const out = await render();
    const filled = fillNotice(close());
    if (filled) { _host?.log?.('info', `fonts: ${filled}`); _exportNotice(filled); }
    return out;
  } finally {
    close();
    if (doc) exporting.splice(exporting.indexOf(doc), 1);
  }
}

