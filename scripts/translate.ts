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
 * Usage:
 *   npm run translate -- --corpus spa --lang de
 *   npm run translate -- --corpus tools --all
 *   npm run translate -- --check              # exit non-zero on stale/missing, no API calls
 *
 * Future corpora (docs pages, site.json chrome) plug into the generic
 * runCorpus() shape — see plans/localize.md §8.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const I18N_DIR = join(REPO_ROOT, 'scripts', 'i18n');
const CACHE_PATH = join(I18N_DIR, 'cache.json');
const GLOSSARY_PATH = join(I18N_DIR, 'glossary.json');

// Canonical language list (engine/src/lang.ts's LANGS, minus 'en' — the source).
const LANGS = ['es', 'de', 'fr', 'zh', 'ja', 'vi', 'pt', 'zh-hant', 'cs', 'nl', 'tl', 'sv', 'ms'] as const;
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
  keys(): string[];
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

const CORPORA: Record<string, CorpusDef> = { spa: SPA_CORPUS };

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
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, `${lang}.json`), JSON.stringify(sidecar, null, 2) + '\n', 'utf8');
    filesWritten++;
  }
  console.log(`  [tools/${lang}] wrote ${filesWritten} sidecar files (${Object.keys(overrides).length} overridden)`);

  return { translated: translatedCount, cached: cachedCount, failed: failedCount };
}

// ─── Validation: placeholders + markdown-ish structure must survive ────────
const PLACEHOLDER_RE = /\{[a-zA-Z0-9_]+\}/g;

function validate(source: string, translated: string): string | null {
  const srcPh = (source.match(PLACEHOLDER_RE) ?? []).sort();
  const outPh = (translated.match(PLACEHOLDER_RE) ?? []).sort();
  if (srcPh.join(',') !== outPh.join(',')) return `placeholder mismatch: source has [${srcPh}], output has [${outPh}]`;
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
    'Preserve punctuation choices like → and & as-is where they read naturally in the target language; do not add explanatory text.',
    'Match the source length and tone — this is compact UI microcopy, not marketing prose. Do not pad or embellish.',
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
): Promise<Map<number, string>> {
  const system = buildSystemPrompt(lang, corpusContext, glossary);
  const userText = JSON.stringify(items);

  const ask = async (extra?: string): Promise<Map<number, string>> => {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
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
    const err = validate(bySourceId.get(id) ?? '', text);
    if (err) failed.push(id);
    else out.set(id, text);
  }
  for (const item of items) if (!first.has(item.id)) failed.push(item.id);

  if (failed.length) {
    const retryItems = items.filter(i => failed.includes(i.id));
    const retryOut = await (async () => {
      try {
        return await translateRetry(client, lang, retryItems, system);
      } catch { return new Map<number, string>(); }
    })();
    for (const [id, text] of retryOut) {
      const err = validate(bySourceId.get(id) ?? '', text);
      if (!err) out.set(id, text);
    }
  }
  return out;
}

async function translateRetry(client: Anthropic, lang: Lang, items: BatchItem[], system: string): Promise<Map<number, string>> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
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
  const keys = corpus.keys();
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
function parseArgs(argv: string[]): { corpus?: string; lang?: Lang; all: boolean; check: boolean } {
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
  return { corpus: typeof flags.corpus === 'string' ? flags.corpus : undefined, lang, all: !!flags.all, check: !!flags.check };
}

// 'tools' doesn't fit the generic one-file-per-language CorpusDef shape (see
// runToolsCorpus's doc comment) — it's a recognized --corpus value handled as
// a special case in the loop below, not registered in CORPORA.
const ALL_CORPUS_IDS = [...Object.keys(CORPORA), 'tools'];

async function main(): Promise<void> {
  const { corpus: corpusId, lang, all, check } = parseArgs(process.argv.slice(2));
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
        : await runCorpus(client, CORPORA[id]!, l, cache, glossary);
      totalFailed += failed;
      if (!check) console.log(`  [${id}/${l}] ${translated} translated, ${cached} cached, ${failed} fell back to English`);
      else if (failed) console.log(`  [${id}/${l}] ${failed} strings missing/stale`);
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
