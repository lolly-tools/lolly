// SPDX-License-Identifier: MPL-2.0
/**
 * Bulk machine-translation pipeline (plans/localize.md §4).
 *
 * Batch-translates UI strings via the Claude API, with a shared glossary,
 * content-hash incremental caching (only re-translates changed English
 * source), placeholder/structure validation, and a human-overrides layer
 * that always wins over machine output. Requires ANTHROPIC_API_KEY.
 *
 * Corpora (see plans/localize.md §10 for the rest still to come):
 *   spa   — shells/web/src/locales/<lang>.json, keyed by the exact English
 *           string used as a t() call site across shells/web/src (i18n.ts).
 *           Literal `t('...')` calls are found by scanning source; the small
 *           number of dynamically-keyed calls (t(FIELD_LABELS[f]), ternaries)
 *           are listed by hand in scripts/i18n/extra-keys.spa.json.
 *   tools — per-tool i18n sidecars (plans/localize.md §7), one
 *           tools/<id>/i18n/<lang>.json per tool per language. Scoped to the
 *           three gallery-card-visible fields (`name`, `description`,
 *           `featured.blurb`) — NOT the full sidecar key grammar
 *           (input labels/help/options) engine/src/loader.ts's
 *           applyManifestI18n also supports; those stay English until a tool
 *           author (or a future pass) opts in. Scans community/ and
 *           brands/{suse,lolly-start}/tools/ directly (not the gitignored
 *           tools/ profile view — that symlink farm only contains whichever
 *           ONE profile is currently active, and this corpus must cover every
 *           pack regardless of what's active locally) and writes sidecars
 *           straight into each tool's own source directory. Unlike the spa
 *           corpus's one-file-per-language output, this is many small files;
 *           see runToolsCorpus() below rather than the generic runCorpus().
 *
 *   docs  — /info page BODIES, one docs/i18n/<lang>/<slug>.md per page per
 *           language, for the curated page list in DOCS_PAGES (not all 38 —
 *           see that constant for why the engineering references stay English).
 *           Translates and caches per markdown BLOCK, and writes a page only
 *           when every block resolved, so a page is either fully translated or
 *           left to docs/build.ts's English fallback. Like `tools`, it writes
 *           whole files rather than a key→value catalog, so it has its own
 *           runner (runDocsCorpus) instead of the generic runCorpus().
 *
 * Usage:
 *   npm run translate -- --corpus spa --lang de
 *   npm run translate -- --corpus tools --all
 *   npm run translate -- --corpus docs --lang de              # every DOCS_PAGES page
 *   npm run translate -- --corpus docs --only privacy --all   # one page, all 26 languages
 *   npm run translate -- --check              # exit non-zero on stale/missing, no API calls
 *
 * Future corpora (site.json chrome) plug into the generic runCorpus() shape —
 * see plans/localize.md §8.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// The Anthropic SDK reads ANTHROPIC_API_KEY from the environment. This is the only
// script in the repo that needs a secret, and exporting it from a shell profile
// would hand it to every process on the machine — so also accept it from the
// repo's gitignored `.env.local` (which already exists for VERCEL_OIDC_TOKEN).
//
// Precedence is the right way round and verified, not assumed: an already-set
// environment variable WINS over the file, so `ANTHROPIC_API_KEY=… npm run
// translate` still overrides whatever is on disk. A missing file throws ENOENT
// rather than returning quietly, hence the guard — running with no .env.local is
// the normal case for anyone who exports the key themselves.
// `.env.local` is what the Vercel CLI created and what it REWRITES on `vercel env
// pull`, which would silently drop a key added by hand — so `.env` is read too and
// is the safer home for this one. `.env.local` is loaded first and therefore wins,
// matching the usual dotenv precedence (loadEnvFile never overwrites an already-set
// variable, so first-loaded is highest-priority here). Both are gitignored.
for (const f of ['.env.local', '.env']) {
  try { process.loadEnvFile(join(REPO_ROOT, f)); } catch { /* absent — fine */ }
}

const I18N_DIR = join(REPO_ROOT, 'scripts', 'i18n');
const CACHE_PATH = join(I18N_DIR, 'cache.json');
const GLOSSARY_PATH = join(I18N_DIR, 'glossary.json');

// Canonical language list (engine/src/lang.ts's LANGS, minus 'en' — the source).
const LANGS = ['es', 'de', 'fr', 'zh', 'ja', 'vi', 'pt', 'zh-hant', 'cs', 'nl', 'tl', 'sv', 'ms', 'ro', 'hi', 'bn', 'ur', 'id', 'ar', 'it', 'no', 'ko', 'bg', 'tr', 'uk', 'pl'] as const;
type Lang = (typeof LANGS)[number];

// Chosen deliberately for this pipeline (see plans/localize.md §4) — not the
// skill's default Opus-4.8 recommendation, which is for open-ended/reasoning
// work. Bulk, high-volume, quality-sensitive-but-not-frontier-reasoning
// translation is exactly what Sonnet-tier is priced and built for.
const MODEL = 'claude-sonnet-5';
const BATCH_SIZE = 50;

interface Glossary {
  neverTranslate: string[];
  registerNotes: Record<Lang, string>;
}

function loadGlossary(): Glossary {
  return JSON.parse(readFileSync(GLOSSARY_PATH, 'utf8')) as Glossary;
}

// ─── Cache: corpus → lang → sha256(englishSource) → translatedText ─────────
type Cache = Record<string, Record<string, Record<string, string>>>;

function loadCache(): Cache {
  if (!existsSync(CACHE_PATH)) return {};
  return JSON.parse(readFileSync(CACHE_PATH, 'utf8')) as Cache;
}

function saveCache(cache: Cache): void {
  writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2) + '\n', 'utf8');
}

function sha256(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

// ─── Overrides: human corrections. ALWAYS win over machine output. ─────────
function loadOverrides(corpus: string, lang: Lang): Record<string, string> {
  const p = join(I18N_DIR, 'overrides', `${corpus}.${lang}.json`);
  if (!existsSync(p)) return {};
  return JSON.parse(readFileSync(p, 'utf8')) as Record<string, string>;
}

// ─── spa corpus: extract every literal t('...') / t("...") call site ───────
function walkFiles(dir: string, out: string[]): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'locales' || entry.endsWith('.test.ts')) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walkFiles(full, out);
    else if (entry.endsWith('.ts')) out.push(full);
  }
  return out;
}

const T_CALL_RE = /(^|[^A-Za-z0-9_$.])t\(\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")/g;

function extractSpaKeys(): string[] {
  const srcDir = join(REPO_ROOT, 'shells', 'web', 'src');
  const keys = new Set<string>();
  for (const file of walkFiles(srcDir, [])) {
    const src = readFileSync(file, 'utf8');
    T_CALL_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = T_CALL_RE.exec(src))) keys.add((m[2] !== undefined ? m[2] : m[3])!);
  }
  const extra = JSON.parse(readFileSync(join(I18N_DIR, 'extra-keys.spa.json'), 'utf8')) as string[];
  extra.forEach(k => keys.add(k));
  return [...keys].sort();
}

interface CorpusDef {
  id: string;
  /** All translatable English source strings, in a stable order. */
  keys(): string[] | Promise<string[]>;
  /** Context sentence for the system prompt (what kind of copy this is). */
  context: string;
  /** Where the per-language catalog is written. */
  outPath(lang: Lang): string;
}

const SPA_CORPUS: CorpusDef = {
  id: 'spa',
  keys: extractSpaKeys,
  context: 'These are short UI microcopy strings — button labels, headings, aria-labels, and one-line descriptions — in a design-tool web app called Lolly. Keep them as short as the source; this is UI chrome, not prose.',
  outPath: lang => join(REPO_ROOT, 'shells', 'web', 'src', 'locales', `${lang}.json`),
};

// ─── caps corpus: the capability map's prose (a lazy string NAMESPACE) ─────
// The Dashboard's Capabilities tab (#/d?tab=caps) renders shells/web/src/lib/
// capabilities-data.ts — ~300 strings, ~22 KB of English, several of them full
// paragraphs carrying authored inline HTML. Two reasons it is its own corpus
// rather than more keys in `spa`:
//   1. Register. The spa prompt tells the model "compact UI microcopy, not
//      marketing prose" — the exact wrong instruction for a 570-character
//      paragraph explaining CMYK output intents.
//   2. Weight. Its catalog is loaded on demand by the one panel that shows it
//      (i18n.ts's loadNamespace('caps')), so a non-English user doesn't download
//      a fifth of a boot catalog for a tab they may never open.
// The strings are plain data, NOT literal t() call sites, so they can't be found
// by extractSpaKeys's scan — the module is imported and walked instead. Node runs
// the .ts directly (type-stripping); the module imports nothing, so this is safe.
const CAPS_DATA_PATH = join(REPO_ROOT, 'shells', 'web', 'src', 'lib', 'capabilities-data.ts');

interface CapsSection {
  title: string;
  desc: string;
  cards: Array<{ title: string; features: Array<{ name: string; desc: string }> }>;
}

async function extractCapsKeys(): Promise<string[]> {
  const mod = (await import(pathToFileURL(CAPS_DATA_PATH).href)) as { CAPABILITY_SECTIONS: CapsSection[] };
  const keys = new Set<string>();
  for (const section of mod.CAPABILITY_SECTIONS) {
    keys.add(section.title);
    keys.add(section.desc);
    for (const card of section.cards) {
      keys.add(card.title);
      for (const feature of card.features) {
        keys.add(feature.name);
        keys.add(feature.desc);
      }
    }
  }
  // Source order, not sorted: the catalog then reads as the page reads, which is
  // what a human reviewing a diff of it wants.
  return [...keys];
}

const CAPS_CORPUS: CorpusDef = {
  id: 'caps',
  keys: extractCapsKeys,
  context:
    'These strings describe what a design-tool web app called Lolly can do — they are the feature map on its dashboard. ' +
    'Unlike button labels, many are full explanatory sentences or short paragraphs written for a curious professional ' +
    '(a designer, a print operator, a developer). Translate them as clear, confident product prose in the target ' +
    'language — same length, same register, no marketing embellishment and no added explanation. Several contain ' +
    'authored inline HTML (<code>, <strong>, <em>, <a href="…">): keep every tag, attribute and entity exactly as it ' +
    'appears and translate only the human text around and inside it. Never translate what sits inside a <code> tag ' +
    '(they are literal parameters, flags and file formats), nor format/technology names (PNG, SVG, PDF, CMYK, C2PA, ' +
    'MCP, OAuth 2.1, Tauri, HarfBuzz, IndexedDB, AES-256).',
  outPath: lang => join(REPO_ROOT, 'shells', 'web', 'src', 'locales', 'caps', `${lang}.json`),
};

const CORPORA: Record<string, CorpusDef> = { spa: SPA_CORPUS, caps: CAPS_CORPUS };

// ─── tools corpus: gallery-card fields (name/description/featured.blurb) ───
// Every tool pack this corpus covers — community (public, shared across every
// brand profile) plus the two brand packs that ship their own exclusive
// tools. Deliberately NOT the gitignored tools/ profile view (scripts/use-
// profile.ts's symlink farm): that only contains whichever ONE profile is
// active on this machine, and a translation run must cover every pack a
// developer might have checked out, regardless of what's active locally.
const TOOL_PACK_DIRS = ['community', join('brands', 'suse', 'tools'), join('brands', 'lolly-start', 'tools')];

interface ToolManifestSlice {
  id: string;
  dir: string; // absolute path to the tool's own directory (sidecars land in <dir>/i18n/<lang>.json)
  name: string;
  description?: string;
  blurb?: string;
}

function listToolManifests(): ToolManifestSlice[] {
  const out: ToolManifestSlice[] = [];
  for (const packDir of TOOL_PACK_DIRS) {
    const abs = join(REPO_ROOT, packDir);
    if (!existsSync(abs)) continue;
    for (const entry of readdirSync(abs)) {
      const dir = join(abs, entry);
      const manifestPath = join(dir, 'tool.json');
      if (!statSync(dir).isDirectory() || !existsSync(manifestPath)) continue;
      let manifest: { id: string; name: string; description?: string; featured?: { blurb?: string } };
      try { manifest = JSON.parse(readFileSync(manifestPath, 'utf8')); } catch { continue; }
      out.push({ id: manifest.id, dir, name: manifest.name, description: manifest.description, blurb: manifest.featured?.blurb });
    }
  }
  return out;
}

const TOOLS_CORPUS_CONTEXT = 'These are creative-tool catalog entries in a design-tool web app called Lolly — a short product name, a one-sentence description, and (sometimes) an even shorter marketing blurb shown on a gallery card. Keep translations as concise as the source.';

async function runToolsCorpus(client: Anthropic | null, lang: Lang, cache: Cache, glossary: Glossary): Promise<{ translated: number; cached: number; failed: number }> {
  const tools = listToolManifests();
  cache.tools ??= {};
  cache.tools[lang] ??= {};
  const langCache = cache.tools[lang]!;

  // One flat batch across every tool's translatable fields for this language —
  // batch ids are "toolId::field" so results route back to the right sidecar;
  // the cache itself stays keyed by content hash of the ENGLISH TEXT (not the
  // batch id), so identical strings shared across tools (e.g. two tools both
  // titled with the same word) translate once and reuse the cached result.
  const toTranslate: BatchItem[] = [];
  const resolved = new Map<string, string>(); // "toolId::field" → translated text
  let cachedCount = 0;
  let idCounter = 0;
  const idToBatchKey = new Map<number, string>();
  for (const tool of tools) {
    const fields: Array<['name' | 'description' | 'blurb', string | undefined]> = [
      ['name', tool.name], ['description', tool.description], ['blurb', tool.blurb],
    ];
    for (const [field, text] of fields) {
      if (!text) continue;
      const batchKey = `${tool.id}::${field}`;
      const hash = sha256(text);
      if (langCache[hash] !== undefined) { resolved.set(batchKey, langCache[hash]); cachedCount++; continue; }
      const id = idCounter++;
      idToBatchKey.set(id, batchKey);
      toTranslate.push({ id, text });
    }
  }

  let translatedCount = 0;
  let failedCount = 0;
  if (toTranslate.length && client) {
    console.log(`  [tools/${lang}] translating ${toTranslate.length} new/changed strings across ${tools.length} tools (${cachedCount} already cached)…`);
    for (let i = 0; i < toTranslate.length; i += BATCH_SIZE) {
      const batch = toTranslate.slice(i, i + BATCH_SIZE);
      const translated = await translateBatch(client, lang, batch, TOOLS_CORPUS_CONTEXT, glossary);
      for (const item of batch) {
        const batchKey = idToBatchKey.get(item.id)!;
        const text = translated.get(item.id);
        if (text) {
          resolved.set(batchKey, text);
          langCache[sha256(item.text)] = text;
          translatedCount++;
        } else {
          resolved.set(batchKey, item.text); // fallback: English, never ship broken output
          failedCount++;
        }
      }
    }
  } else if (toTranslate.length) {
    for (const item of toTranslate) resolved.set(idToBatchKey.get(item.id)!, item.text);
    failedCount = toTranslate.length;
  }

  // Overrides key as "toolId::field", always win, applied last.
  const overrides = loadOverrides('tools', lang);
  for (const [k, v] of Object.entries(overrides)) resolved.set(k, v);

  let filesWritten = 0;
  for (const tool of tools) {
    const sidecar: Record<string, string> = {};
    if (tool.name) sidecar.name = resolved.get(`${tool.id}::name`) ?? tool.name;
    if (tool.description) sidecar.description = resolved.get(`${tool.id}::description`) ?? tool.description;
    if (tool.blurb) sidecar['featured.blurb'] = resolved.get(`${tool.id}::blurb`) ?? tool.blurb;
    if (!Object.keys(sidecar).length) continue;
    const outDir = join(tool.dir, 'i18n');
    const outPath = join(outDir, `${lang}.json`);
    // MERGE with an existing sidecar: this corpus only manages the three
    // gallery-card fields, but shipped sidecars also carry the full input
    // key grammar (inputs.*.label/help/options…) written by other passes —
    // overwriting the file wholesale would silently truncate those.
    let existing: Record<string, string> = {};
    if (existsSync(outPath)) {
      try { existing = JSON.parse(readFileSync(outPath, 'utf8')) as Record<string, string>; } catch { /* rewrite corrupt file */ }
    }
    mkdirSync(outDir, { recursive: true });
    writeFileSync(outPath, JSON.stringify({ ...existing, ...sidecar }, null, 2) + '\n', 'utf8');
    filesWritten++;
  }
  console.log(`  [tools/${lang}] wrote ${filesWritten} sidecar files (${Object.keys(overrides).length} overridden)`);

  return { translated: translatedCount, cached: cachedCount, failed: failedCount };
}

// ─── docs corpus: /info page bodies, block by block ────────────────────────
// docs/build.ts renders each page from `docs/<src>.md`, and for a non-English
// locale it uses `docs/i18n/<lang>/<slug>.md` WHEN THAT FILE EXISTS, falling
// back to the English body otherwise (see its `localized` lookup). So this
// corpus is per-page opt-in by construction: a slug listed here gets 26
// translations, a slug left out keeps serving accurate English. That property
// is why the privacy translations could simply be deleted when they went stale
// — a wrong translation is worse than an English fallback, especially for a
// legal document.
//
// Unlike every other corpus, the output is not a key→value catalog but a whole
// markdown FILE, so `runDocsCorpus` does its own writing (as `runToolsCorpus`
// does) rather than going through the generic runCorpus.
//
// GRANULARITY: the unit of translation and of caching is a markdown BLOCK, not
// a page. Editing one paragraph of privacy.md therefore re-translates one
// paragraph, not 20 KB — and because the cache is keyed by content hash, a
// block whose text is identical across pages (a shared warning note, say) is
// translated once for the whole corpus.
//
// Which pages: deliberately NOT all 38. The engineering references (host-api,
// authoring-tools, content-credentials-engineering, threat-model,
// server-surface) are read by developers working in English, are the densest in
// code identifiers, and are the ones a translation is most likely to quietly
// corrupt — they stay English on purpose. What is listed below is the material
// a non-English *user* actually needs: the legal document, the on-ramps, and
// the operator overview whose stale SEAL sentence is still live in ~24 locales.
export const DOCS_PAGES: Array<{ slug: string; src: string }> = [
  { slug: 'privacy', src: 'privacy.md' },              // the reason this corpus exists
  { slug: 'quickstart', src: 'quickstart.md' },
  { slug: 'creators', src: 'creators.md' },
  { slug: 'using', src: 'using.md' },
  { slug: 'faq', src: 'faq.md' },
  { slug: 'overview', src: 'overview.md' },
  { slug: 'operators', src: 'operators.md' },
  { slug: 'profile', src: 'profile.md' },
  { slug: 'brand-studio', src: 'brand-studio.md' },
  { slug: 'exporting', src: 'exporting.md' },
  { slug: 'data-transfer', src: 'data-transfer.md' },
  { slug: 'extension', src: 'extension.md' },
  { slug: 'verify-yourself', src: 'verify-yourself.md' },
];

interface DocBlock {
  text: string;
  /** false → reproduced byte-for-byte (code fences, blank lines, HTML comments). */
  translatable: boolean;
}

/**
 * Split a markdown document into blocks that rejoin to the exact original with
 * `blocks.map(b => b.text).join('\n')`.
 *
 * Fenced code is scanned line-by-line rather than split on blank lines, because
 * a fence legitimately CONTAINS blank lines — splitting first would tear a code
 * block in half and hand its second half to the model as prose.
 */
export function splitDocBlocks(md: string): DocBlock[] {
  const blocks: DocBlock[] = [];
  let buf: string[] = [];
  let inFence = false;
  let fenceMark = '';
  const flush = (translatable: boolean): void => {
    if (buf.length) { blocks.push({ text: buf.join('\n'), translatable }); buf = []; }
  };
  for (const line of md.split('\n')) {
    const fence = /^\s*(```|~~~)/.exec(line);
    if (inFence) {
      buf.push(line);
      if (fence && line.trim().startsWith(fenceMark)) { inFence = false; flush(false); }
      continue;
    }
    if (fence) { flush(true); inFence = true; fenceMark = fence[1]!; buf.push(line); continue; }
    if (line.trim() === '') { flush(true); blocks.push({ text: '', translatable: false }); continue; }
    buf.push(line);
  }
  // An unterminated fence stays opaque — better to ship the code untranslated
  // than to feed a half-open fence to the model.
  flush(!inFence);
  // A pure HTML comment block is machinery (build directives, review notes).
  return blocks.map(b =>
    b.translatable && /^\s*<!--[\s\S]*-->\s*$/.test(b.text) ? { ...b, translatable: false } : b);
}

// A markdown link/image target must survive byte-for-byte: these carry the
// url-shot screenshot recipes (long query strings full of English CSS selectors
// and filenames) and every cross-page /info/ href. A "helpfully" localised
// target is a 404 or a broken screenshot, and it is invisible in review.
const MD_TARGET_RE = /\]\(([^)]*)\)/g;
const MD_HEADING_RE = /^(#{1,6})\s/;

/** Docs-specific structural checks, on top of the shared `validate`. */
export function validateDocBlock(source: string, translated: string): string | null {
  const targets = (s: string): string[] => {
    const out: string[] = [];
    MD_TARGET_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = MD_TARGET_RE.exec(s))) out.push(m[1]!);
    return out.sort();
  };
  const srcT = targets(source);
  const outT = targets(translated);
  if (srcT.join(' ') !== outT.join(' ')) {
    return `markdown link target changed: source has [${srcT.join(' | ')}], output has [${outT.join(' | ')}]`;
  }
  const srcH = MD_HEADING_RE.exec(source)?.[1] ?? '';
  const outH = MD_HEADING_RE.exec(translated)?.[1] ?? '';
  if (srcH !== outH) return `heading level changed: source "${srcH}" vs output "${outH}"`;
  // Tables: same row count, same column count per row, or the table renders
  // mangled. Cheap shape check, catches a dropped or merged row.
  const rows = (s: string): number[] => s.split('\n').filter(l => l.trim().startsWith('|'))
    .map(l => l.split('|').length);
  const srcR = rows(source);
  const outR = rows(translated);
  if (srcR.join(',') !== outR.join(',')) {
    return `table shape changed: source rows/cols [${srcR.join(',')}], output [${outR.join(',')}]`;
  }
  // A fence appearing inside a translatable block means the model invented one.
  if (/^\s*(```|~~~)/m.test(translated) && !/^\s*(```|~~~)/m.test(source)) {
    return 'output introduced a code fence that is not in the source';
  }
  return null;
}

const DOCS_CONTEXT =
  'These are blocks of a documentation page for an open-source design-asset platform called Lolly — ' +
  'body prose written for a professional reader: paragraphs, bullet lists, markdown tables, headings and ' +
  'blockquote notes. Translate them as clear, precise technical documentation in the target language: same ' +
  'length, same register, no marketing embellishment, no added explanation, and never soften a precise ' +
  'statement into a vague one (several of these pages are legal or security documents where the exact scope ' +
  'of a claim is the point). Preserve markdown structure EXACTLY: the same leading #/##/### heading marks, ' +
  'the same list markers and indentation, the same table pipes with the same number of rows and columns, the ' +
  'same **bold**/*italic*/`backtick` spans. Never translate anything inside `backticks` (they are literal ' +
  'file paths, commands, flags and formats), a URL, or a markdown link target — translate only the visible ' +
  'link text between the square brackets and leave everything inside the following parentheses byte-for-byte ' +
  'identical, including long query strings. Do not translate format, protocol or product names (PNG, SVG, ' +
  'PDF, CMYK, C2PA, SEAL, MCP, OAuth 2.1, IndexedDB, AES-256, GDPR, DPO), legal citations (Art. 6(1)(f), ' +
  'RFC 9116, ePrivacy Directive), company or product names (SUSE, Vercel, Resend, Cloudflare, Google Fonts, ' +
  'GitHub), or the names of on-screen buttons and menu items when the interface itself is not translated — ' +
  'if a button label appears in bold as **Clear all my data**, keep the English label and, only where it ' +
  'genuinely aids comprehension, follow it with your translation in parentheses.';

// Blocks are far longer than UI strings, so batch by CHARACTER BUDGET rather
// than a fixed count: 50 paragraphs would overflow the model's output ceiling,
// while 50 one-line bullets would waste a round trip. ~6 000 chars of English in
// ⇒ comfortably inside a 16 384-token output for any target language, including
// the ones that expand (German, Ukrainian) and the CJK ones that re-encode.
const DOCS_CHAR_BUDGET = 6_000;
const DOCS_MAX_TOKENS = 16_384;

function batchByChars(items: BatchItem[], budget: number): BatchItem[][] {
  const out: BatchItem[][] = [];
  let cur: BatchItem[] = [];
  let size = 0;
  for (const item of items) {
    // An oversized single block still goes out alone rather than being split —
    // splitting mid-paragraph would hand the model half a sentence.
    if (cur.length && size + item.text.length > budget) { out.push(cur); cur = []; size = 0; }
    cur.push(item);
    size += item.text.length;
  }
  if (cur.length) out.push(cur);
  return out;
}

async function runDocsCorpus(
  client: Anthropic | null,
  lang: Lang,
  cache: Cache,
  glossary: Glossary,
  only?: string,
): Promise<{ translated: number; cached: number; failed: number }> {
  // `client === null` means --check: a read-only audit ("what would be stale?"),
  // which is also the CI guard. It must touch NOTHING on disk. This matters more
  // here than in the other corpora: their check pass rewrites a catalog with
  // English fallbacks, but an untranslated page in THIS corpus means "delete the
  // stale file so build.ts falls back", and a --check that deletes 26 languages'
  // worth of real translations would be a data-loss bug wearing an audit's
  // clothes. (It was exactly that for one commit; hence this comment.)
  const readOnly = client === null;
  const pages = only ? DOCS_PAGES.filter(p => p.slug === only) : DOCS_PAGES;
  if (only && !pages.length) {
    console.error(`Unknown --only page "${only}". Available: ${DOCS_PAGES.map(p => p.slug).join(', ')}`);
    process.exit(1);
  }
  cache.docs ??= {};
  cache.docs[lang] ??= {};
  const langCache = cache.docs[lang]!;
  const overrides = loadOverrides('docs', lang);

  // One flat batch list across every page, so a short page rides along with a
  // long one instead of paying for its own round trip. Batch ids route the
  // result back to (page, blockIndex); the CACHE is keyed by content hash, so a
  // block repeated across pages is translated once.
  const docs = pages.map(p => ({ ...p, blocks: splitDocBlocks(readFileSync(join(REPO_ROOT, 'docs', p.src), 'utf8')) }));
  const toTranslate: BatchItem[] = [];
  const idToSlot = new Map<number, { slug: string; index: number }>();
  const resolved = new Map<string, string>(); // `${slug}::${index}` → translated block
  let cachedCount = 0;
  let idCounter = 0;

  for (const doc of docs) {
    doc.blocks.forEach((block, index) => {
      if (!block.translatable || !block.text.trim()) return;
      const override = overrides[block.text];
      if (override !== undefined) { resolved.set(`${doc.slug}::${index}`, override); cachedCount++; return; }
      const hit = langCache[sha256(block.text)];
      if (hit !== undefined) { resolved.set(`${doc.slug}::${index}`, hit); cachedCount++; return; }
      const id = idCounter++;
      idToSlot.set(id, { slug: doc.slug, index });
      toTranslate.push({ id, text: block.text });
    });
  }

  let translatedCount = 0;
  let failedCount = 0;
  if (toTranslate.length && client) {
    const batches = batchByChars(toTranslate, DOCS_CHAR_BUDGET);
    console.log(`  [docs/${lang}] translating ${toTranslate.length} new/changed blocks across ${pages.length} page(s) in ${batches.length} batch(es) (${cachedCount} already cached)…`);
    for (const batch of batches) {
      const got = await translateBatch(client, lang, batch, DOCS_CONTEXT, glossary,
        { maxTokens: DOCS_MAX_TOKENS, extraValidate: validateDocBlock });
      for (const item of batch) {
        const slot = idToSlot.get(item.id)!;
        const text = got.get(item.id);
        if (text) {
          resolved.set(`${slot.slug}::${slot.index}`, text);
          langCache[sha256(item.text)] = text;
          translatedCount++;
        } else {
          failedCount++; // left unresolved → the English block is written through
        }
      }
    }
  } else if (toTranslate.length) {
    failedCount = toTranslate.length; // --check: report, translate nothing
  }

  // Write only when a page is FULLY translated. A half-translated legal page is
  // worse than an English one: the reader cannot tell which half they are
  // reading, and the untranslated half looks like an oversight rather than a
  // deliberate fallback. Partial ⇒ remove any stale file so build.ts falls back
  // to the English body, which is the honest outcome.
  let written = 0;
  let skipped = 0;
  for (const doc of docs) {
    const missing = doc.blocks.some((b, i) =>
      b.translatable && b.text.trim() && !resolved.has(`${doc.slug}::${i}`));
    const outPath = join(REPO_ROOT, 'docs', 'i18n', lang, `${doc.slug}.md`);
    if (missing) {
      skipped++;
      if (readOnly || !existsSync(outPath)) continue;
      rmSync(outPath);
      console.log(`  [docs/${lang}] ${doc.slug}: incomplete — removed stale ${relative(REPO_ROOT, outPath)} (English fallback)`);
      continue;
    }
    if (readOnly) continue;
    const body = doc.blocks.map((b, i) =>
      b.translatable && b.text.trim() ? resolved.get(`${doc.slug}::${i}`)! : b.text).join('\n');
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, body, 'utf8');
    written++;
  }
  if (readOnly) {
    console.log(`  [docs/${lang}] check only, nothing written: ${skipped}/${docs.length} page(s) would fall back to English`);
  } else {
    console.log(`  [docs/${lang}] wrote ${written} page(s)${skipped ? `, ${skipped} left as English fallback` : ''}${Object.keys(overrides).length ? `, ${Object.keys(overrides).length} block override(s)` : ''}`);
  }

  return { translated: translatedCount, cached: cachedCount, failed: failedCount };
}

// ─── Validation: placeholders + inline HTML must survive ───────────────────
const PLACEHOLDER_RE = /\{[a-zA-Z0-9_]+\}/g;
// Authored inline HTML — <code>, <strong>, <em>, <a href="…"> — appears in both
// corpora (a handful of spa strings, many caps ones). A translation that drops a
// closing tag, invents one, or "translates" an href silently ships broken markup
// straight into the DOM, so tags are compared as a multiset: word order may move
// them around, but the exact same tags must come out the other side.
const TAG_RE = /<\/?[a-zA-Z][^>]*>/g;
// `<code>…</code>` wraps literal parameters, flags and formats (e.g. the
// `&amp;export` URL flag) — never prose, so its inner text must survive
// byte-for-byte. Prose entities like a rendered `&` MAY become the target
// language's word for "and", which is why we compare code CONTENTS specifically
// rather than a blanket entity multiset.
const CODE_RE = /<code>([\s\S]*?)<\/code>/g;

function tagBag(s: string): string[] {
  return (s.match(TAG_RE) ?? []).map(tag => tag.replace(/\s+/g, ' ').toLowerCase()).sort();
}
function codeBag(s: string): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  CODE_RE.lastIndex = 0;
  while ((m = CODE_RE.exec(s))) out.push(m[1]!);
  return out.sort();
}

function validate(source: string, translated: string): string | null {
  const srcPh = (source.match(PLACEHOLDER_RE) ?? []).sort();
  const outPh = (translated.match(PLACEHOLDER_RE) ?? []).sort();
  if (srcPh.join(',') !== outPh.join(',')) return `placeholder mismatch: source has [${srcPh}], output has [${outPh}]`;
  const srcTags = tagBag(source);
  const outTags = tagBag(translated);
  if (srcTags.join('') !== outTags.join('')) return `HTML tag mismatch: source has [${srcTags.join(' ')}], output has [${outTags.join(' ')}]`;
  const srcCode = codeBag(source);
  const outCode = codeBag(translated);
  if (srcCode.join(' ') !== outCode.join(' ')) return `<code> content changed: source has [${srcCode.join(' | ')}], output has [${outCode.join(' | ')}]`;
  if (translated.length > source.length * 3 && source.length > 3) return 'output is >3x source length (likely hallucinated padding)';
  if (!translated.trim()) return 'empty output';
  return null;
}

// ─── Translation call ───────────────────────────────────────────────────────
interface BatchItem { id: number; text: string }

function buildSystemPrompt(lang: Lang, corpusContext: string, glossary: Glossary): string {
  const never = glossary.neverTranslate.map(t => `"${t}"`).join(', ');
  const register = glossary.registerNotes[lang];
  return [
    `Translate the given UI strings from English into ${lang} for a software product.`,
    corpusContext,
    `Register: ${register}.`,
    `Never translate these terms — copy them verbatim wherever they appear: ${never}.`,
    'Preserve every {placeholder} token exactly (same braces, same name, same count) — these are runtime interpolations, not prose.',
    'Preserve any inline HTML exactly: the same tags, the same count, every attribute (href, target, rel) byte-for-byte, and every HTML entity (&amp;, &lt;). Translate only the human text around and between the tags — never a tag name, an attribute value, or the contents of a <code> element.',
    'Preserve punctuation choices like → and & as-is where they read naturally in the target language; do not add explanatory text.',
    'Match the source length and register. Do not pad or embellish.',
    'Return ONLY the JSON matching the given schema — one translation per input id, in the same order.',
  ].join('\n');
}

const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    translations: {
      type: 'array',
      items: {
        type: 'object',
        properties: { id: { type: 'integer' }, text: { type: 'string' } },
        required: ['id', 'text'],
        additionalProperties: false,
      },
    },
  },
  required: ['translations'],
  additionalProperties: false,
} as const;

async function translateBatch(
  client: Anthropic,
  lang: Lang,
  items: BatchItem[],
  corpusContext: string,
  glossary: Glossary,
  // The docs corpus translates whole markdown blocks — paragraphs, tables,
  // bullet lists — not one-line UI strings, so it needs both a bigger output
  // ceiling and structural checks (link targets, heading level, table shape)
  // that mean nothing to the other corpora. Both default to today's behaviour.
  opts: { maxTokens?: number; extraValidate?: (source: string, translated: string) => string | null } = {},
): Promise<Map<number, string>> {
  const { maxTokens = 4096, extraValidate } = opts;
  const check = (source: string, translated: string): string | null =>
    validate(source, translated) ?? extraValidate?.(source, translated) ?? null;
  const system = buildSystemPrompt(lang, corpusContext, glossary);
  const userText = JSON.stringify(items);

  const ask = async (extra?: string): Promise<Map<number, string>> => {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      // Adaptive thinking (Sonnet 5's default when `thinking` is omitted) adds
      // latency this mechanical, non-reasoning task doesn't need.
      thinking: { type: 'disabled' },
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
      system: extra ? `${system}\n\n${extra}` : system,
      messages: [{ role: 'user', content: userText }],
    });
    if (response.stop_reason === 'refusal') {
      console.warn(`  [${lang}] batch refused by the model — falling back to English for these ${items.length} strings`);
      return new Map();
    }
    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
    if (!textBlock) return new Map();
    const parsed = JSON.parse(textBlock.text) as { translations: BatchItem[] };
    return new Map(parsed.translations.map(t => [t.id, t.text]));
  };

  const first = await ask();
  const bySourceId = new Map(items.map(i => [i.id, i.text]));
  const failed: number[] = [];
  const out = new Map<number, string>();
  for (const [id, text] of first) {
    const err = check(bySourceId.get(id) ?? '', text);
    if (err) failed.push(id);
    else out.set(id, text);
  }
  for (const item of items) if (!first.has(item.id)) failed.push(item.id);

  if (failed.length) {
    const retryItems = items.filter(i => failed.includes(i.id));
    const retryOut = await (async () => {
      try {
        return await translateRetry(client, lang, retryItems, system, maxTokens);
      } catch { return new Map<number, string>(); }
    })();
    for (const [id, text] of retryOut) {
      const err = check(bySourceId.get(id) ?? '', text);
      if (!err) out.set(id, text);
    }
  }
  return out;
}

async function translateRetry(client: Anthropic, lang: Lang, items: BatchItem[], system: string, maxTokens = 4096): Promise<Map<number, string>> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    thinking: { type: 'disabled' },
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
    system: `${system}\n\nYour previous attempt on some of these strings failed validation (dropped or altered a {placeholder}, or was empty). Be exact this time.`,
    messages: [{ role: 'user', content: JSON.stringify(items) }],
  });
  if (response.stop_reason === 'refusal') return new Map();
  const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
  if (!textBlock) return new Map();
  const parsed = JSON.parse(textBlock.text) as { translations: BatchItem[] };
  return new Map(parsed.translations.map(t => [t.id, t.text]));
}

// ─── Orchestration ──────────────────────────────────────────────────────────
async function runCorpus(client: Anthropic | null, corpus: CorpusDef, lang: Lang, cache: Cache, glossary: Glossary): Promise<{ translated: number; cached: number; failed: number }> {
  const keys = await corpus.keys(); // caps reads its strings from a module import
  cache[corpus.id] ??= {};
  cache[corpus.id]![lang] ??= {};
  const langCache = cache[corpus.id]![lang]!;

  const toTranslate: BatchItem[] = [];
  const result: Record<string, string> = {};
  let cachedCount = 0;
  keys.forEach((key, i) => {
    const hash = sha256(key);
    if (langCache[hash] !== undefined) { result[key] = langCache[hash]; cachedCount++; }
    else toTranslate.push({ id: i, text: key });
  });

  let translatedCount = 0;
  let failedCount = 0;
  if (toTranslate.length && client) {
    console.log(`  [${corpus.id}/${lang}] translating ${toTranslate.length} new/changed strings (${cachedCount} already cached)…`);
    for (let i = 0; i < toTranslate.length; i += BATCH_SIZE) {
      const batch = toTranslate.slice(i, i + BATCH_SIZE);
      const translated = await translateBatch(client, lang, batch, corpus.context, glossary);
      for (const item of batch) {
        const text = translated.get(item.id);
        if (text) {
          result[item.text] = text;
          langCache[sha256(item.text)] = text;
          translatedCount++;
        } else {
          result[item.text] = item.text; // fallback: English, never ship broken output
          failedCount++;
        }
      }
    }
  } else if (toTranslate.length) {
    // --check mode (no client): count as missing, fall back to English for the write.
    for (const item of toTranslate) result[item.text] = item.text;
    failedCount = toTranslate.length;
  }

  // Overrides always win, applied last.
  const overrides = loadOverrides(corpus.id, lang);
  Object.assign(result, overrides);

  const outPath = corpus.outPath(lang);
  const ordered: Record<string, string> = {};
  for (const k of keys) ordered[k] = result[k]!;
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(ordered, null, 2) + '\n', 'utf8');
  console.log(`  [${corpus.id}/${lang}] wrote ${relative(REPO_ROOT, outPath)} (${keys.length} keys, ${Object.keys(overrides).length} overridden)`);

  return { translated: translatedCount, cached: cachedCount, failed: failedCount };
}

// ─── CLI ────────────────────────────────────────────────────────────────────
function parseArgs(argv: string[]): { corpus?: string; lang?: Lang; all: boolean; check: boolean; only?: string } {
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    const key = eq === -1 ? a.slice(2) : a.slice(2, eq);
    if (key === 'all' || key === 'check') { flags[key] = true; continue; }
    const value = eq === -1 ? argv[++i] : a.slice(eq + 1);
    if (value !== undefined) flags[key] = value;
  }
  const lang = typeof flags.lang === 'string' ? (flags.lang as Lang) : undefined;
  if (lang && !LANGS.includes(lang)) { console.error(`Unknown --lang "${lang}". Expected one of: ${LANGS.join(', ')}`); process.exit(1); }
  return {
    corpus: typeof flags.corpus === 'string' ? flags.corpus : undefined,
    lang, all: !!flags.all, check: !!flags.check,
    only: typeof flags.only === 'string' ? flags.only : undefined,
  };
}

// 'tools' doesn't fit the generic one-file-per-language CorpusDef shape (see
// runToolsCorpus's doc comment) — it's a recognized --corpus value handled as
// a special case in the loop below, not registered in CORPORA.
const ALL_CORPUS_IDS = [...Object.keys(CORPORA), 'tools', 'docs'];

async function main(): Promise<void> {
  const { corpus: corpusId, lang, all, check, only } = parseArgs(process.argv.slice(2));
  if (only && corpusId !== 'docs') { console.error('--only <page-slug> applies to --corpus docs.'); process.exit(1); }
  const corpusIds = corpusId ? [corpusId] : ALL_CORPUS_IDS;
  for (const id of corpusIds) if (!ALL_CORPUS_IDS.includes(id)) { console.error(`Unknown --corpus "${id}". Available: ${ALL_CORPUS_IDS.join(', ')}`); process.exit(1); }
  const targetLangs: Lang[] = lang ? [lang] : all || check ? [...LANGS] : (() => { console.error('Pass --lang <code>, --all, or --check.'); process.exit(1); })();

  const glossary = loadGlossary();
  const cache = loadCache();

  let client: Anthropic | null = null;
  if (!check) {
    if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
      console.error('ANTHROPIC_API_KEY (or an `ant auth login` profile) is required — omit only with --check.');
      process.exit(1);
    }
    client = new Anthropic();
  }

  let totalFailed = 0;
  for (const id of corpusIds) {
    for (const l of targetLangs) {
      const { translated, cached, failed } = id === 'tools'
        ? await runToolsCorpus(client, l, cache, glossary)
        : id === 'docs'
          ? await runDocsCorpus(client, l, cache, glossary, only)
          : await runCorpus(client, CORPORA[id]!, l, cache, glossary);
      totalFailed += failed;
      if (!check) console.log(`  [${id}/${l}] ${translated} translated, ${cached} cached, ${failed} fell back to English`);
      else if (failed) console.log(`  [${id}/${l}] ${failed} ${id === 'docs' ? 'blocks' : 'strings'} missing/stale`);
    }
  }
  if (!check) saveCache(cache);

  if (check && totalFailed > 0) {
    console.error(`\n${totalFailed} missing/stale translation(s) across the requested corpora/languages.`);
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(err => { console.error(err); process.exit(1); });
}
