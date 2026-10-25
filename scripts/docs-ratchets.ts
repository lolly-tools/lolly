#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Three one-directional docs ratchets, each with a baseline of what the English pages carry
 * today, so a docs PR fails only on something NEW:
 *
 *   public-examples  a tool id or catalog asset id that a public clone does not have. The
 *                    public tree is community/, brands/lolly-start and brands/lolly-demo
 *                    (their profiles in profiles.json). On lolly.tools such an example opens
 *                    "Tool not found", and the screenshots next to the example disagree with the text.
 *   h1-title         a page whose first `# ` heading is not its nav title, or a longer form
 *                    of it (every title word, in order). "Settings" over "The Dashboard"
 *                    reads as two pages.
 *   vercel           Vercel named on a page. Lolly no longer runs on Vercel, so the docs
 *                    describe hosting neutrally. A count per page that may only go down.
 *
 * Baselines live in scripts/data/docs-ratchets/. A fix needs no baseline edit: an entry
 * that no longer matches is simply unused. To record a reviewed change (or to shrink a
 * baseline after fixes land):
 *
 *   node scripts/docs-ratchets.ts                          report against the baselines
 *   node scripts/docs-ratchets.ts --write                  rewrite all three from this tree
 *   node scripts/docs-ratchets.ts --write --also-ref=<ref> ...also keep what each ref carries
 *
 * --also-ref reads docs from another branch through git, so a baseline can cover docs PRs
 * that are open at the same time. The tests are tests/docs-public-examples.test.ts,
 * tests/docs-h1-title.test.ts and tests/docs-platform-neutral.test.ts.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const BASELINE_DIR = join(ROOT, 'scripts/data/docs-ratchets');

/** The profiles whose packs are all in the public tree: what a public clone can run. */
export const PUBLIC_PROFILES = ['lolly-start', 'lolly-demo'] as const;
/**
 * Catalog namespaces a public clone never has. The SUSE pack (brands/suse) is a private
 * submodule, absent from a public clone and from CI, so its namespace cannot be read from
 * disk there and is named here instead. Any id in it is an example that will not run.
 */
export const PRIVATE_ASSET_NAMESPACES = ['suse'] as const;

// ── Reading the docs, from this tree or from a git ref ─────────────────────────────────

export interface DocsPageRef { slug: string; title: string; src: string }
export interface DocsTree {
  /** The English pages in the manifest, each `src` relative to docs/. */
  pages: DocsPageRef[];
  /** A page's English source, or null when that ref has no such file. */
  read(src: string): string | null;
}

export function workingTree(root = ROOT): DocsTree {
  const manifest = JSON.parse(readFileSync(join(root, 'docs/manifest.json'), 'utf8')) as { pages: DocsPageRef[] };
  return {
    pages: manifest.pages.map(({ slug, title, src }) => ({ slug, title, src })),
    read: src => {
      const path = join(root, 'docs', src);
      return existsSync(path) ? readFileSync(path, 'utf8') : null;
    },
  };
}

/** The docs as another branch has them, read in one `git cat-file --batch` call. */
export function gitTree(ref: string, root = ROOT): DocsTree {
  const show = (path: string) => execFileSync('git', ['-C', root, 'show', `${ref}:${path}`], { encoding: 'utf8', maxBuffer: 64 << 20 });
  const manifest = JSON.parse(show('docs/manifest.json')) as { pages: DocsPageRef[] };
  const pages = manifest.pages.map(({ slug, title, src }) => ({ slug, title, src }));
  const out = execFileSync('git', ['-C', root, 'cat-file', '--batch'], {
    input: pages.map(p => `${ref}:docs/${p.src}`).join('\n') + '\n', maxBuffer: 256 << 20,
  });
  const files = new Map<string, string>();
  let at = 0;
  for (const p of pages) {
    const eol = out.indexOf(10, at);
    const header = out.subarray(at, eol).toString('utf8');
    at = eol + 1;
    if (header.endsWith(' missing')) continue;
    const size = Number(header.split(' ')[2]);
    files.set(p.src, out.subarray(at, at + size).toString('utf8'));
    at += size + 1;
  }
  return { pages, read: src => files.get(src) ?? null };
}

// ── What a public clone has ────────────────────────────────────────────────────────────

export interface PublicIds {
  tools: Set<string>;
  assets: Set<string>;
  /** Asset namespace → the second path segments ("kinds") its public ids use. */
  kinds: Map<string, Set<string>>;
}

interface Profile { tools: string[]; assets?: string[]; catalog: string }

export function publicIds(root = ROOT): PublicIds {
  const { profiles } = JSON.parse(readFileSync(join(root, 'profiles.json'), 'utf8')) as { profiles: Record<string, Profile> };
  const tools = new Set<string>();
  const assets = new Set<string>();
  for (const name of PUBLIC_PROFILES) {
    const profile = profiles[name];
    if (!profile) throw new Error(`profiles.json has no ${name} profile`);
    for (const dir of profile.tools) {
      if (!existsSync(join(root, dir))) continue;
      for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
        if (entry.isDirectory() && existsSync(join(root, dir, entry.name, 'tool.json'))) tools.add(entry.name);
      }
    }
    for (const index of [join(profile.catalog, 'assets/index.json'), ...(profile.assets ?? []).map(dir => join(dir, 'index.json'))]) {
      if (!existsSync(join(root, index))) continue;
      const { assets: list } = JSON.parse(readFileSync(join(root, index), 'utf8')) as { assets?: Array<{ id: string }> };
      for (const asset of list ?? []) assets.add(asset.id);
    }
  }
  const kinds = new Map<string, Set<string>>();
  for (const id of assets) {
    const [ns, kind] = id.split('/');
    if (!ns || !kind) continue;
    if (!kinds.has(ns)) kinds.set(ns, new Set());
    kinds.get(ns)!.add(kind);
  }
  return { tools, assets, kinds };
}

// ── Check 1: public-clone examples ─────────────────────────────────────────────────────

export interface ExampleHit { src: string; line: number; kind: 'tool' | 'asset'; id: string }

const ID = /^[a-z0-9][a-z0-9-]*$/;
const CLI_PREFIXES = ['lolly', 'pnpm run cli', 'pnpm cli', 'npx @lolly-tools/cli', 'node shells/cli/bin/lolly.ts'];
/** On a Work guide, `pnpm run cli` runs the Work repository's own `lw` CLI, not Lolly's. */
const WORK_CLI_PREFIXES = CLI_PREFIXES.filter(p => !p.startsWith('pnpm'));
/** CLI verbs that take a tool id as their next argument. */
const CLI_ID_VERBS = new Set(['run', 'describe']);
/** CLI verbs whose flag takes a comma list of tool ids. */
const CLI_LIST_FLAGS: Record<string, string> = { batch: 'template', smoke: 'only' };

/** The CLI's own verbs, read from its entry point so a new verb is never mistaken for a tool. */
export function cliVerbs(root = ROOT): Set<string> {
  const src = readFileSync(join(root, 'shells/cli/bin/lolly.ts'), 'utf8');
  const m = /const VERBS = new Set\(\[([^\]]*)\]\)/.exec(src);
  if (!m) throw new Error('shells/cli/bin/lolly.ts: the VERBS set has moved; update cliVerbs');
  return new Set([...m[1]!.matchAll(/'([a-z-]+)'/g)].map(v => v[1]!).concat(['adobe', 'help']));
}

/** Tool ids that a line of shell names as the tool to run. */
export function cliToolIds(code: string, verbs: Set<string>, prefixes = CLI_PREFIXES): string[] {
  const ids: string[] = [];
  for (let segment of code.split(/&&|\|\||[;|\n]|\$\(/)) {
    segment = segment.trim().replace(/^\$\s+/, '').replace(/^(?:[A-Z_][A-Z0-9_]*=\S*\s+)+/, '')
      .replace(/^pnpm\s+(?:(?:--silent|-s)\s+)+/, 'pnpm ');
    const prefix = prefixes.find(p => segment === p || segment.startsWith(p + ' '));
    if (!prefix) continue;
    const args = segment.slice(prefix.length).trim().split(/\s+/).filter(Boolean);
    const positionals = args.filter(t => !t.startsWith('-'));
    let id = positionals[0];
    if (id && verbs.has(id)) {
      const listFlag = CLI_LIST_FLAGS[id];
      const list = listFlag ? args.find(a => a.startsWith(`--${listFlag}=`))?.slice(listFlag.length + 3) : undefined;
      if (list) ids.push(...list.split(',').filter(t => ID.test(t)));
      id = CLI_ID_VERBS.has(id) ? positionals[1] : undefined;
    }
    if (id && ID.test(id)) ids.push(id);
  }
  return ids;
}

/** Three or more path segments, as in a catalog asset id such as lolly/logo/primary. */
const ASSET_LIKE = /(?<![\w./@~:%-])([a-z][a-z0-9-]*)\/([a-z0-9-]+)\/([a-z0-9*.][a-z0-9*._/-]*)/g;
/** `/tool/<id>` and `/t/<id>`: an app route, a share link or an embed URL. */
const TOOL_ROUTE = /(?:^|[\s("'`<=#]|[a-z0-9-]+\.[a-z]{2,}(?::\d+)?|localhost(?::\d+)?)\/(?:tool|t)\/([a-z0-9][a-z0-9-]*)/g;
/** A tool field in a JSON or MCP example, or a `tool=` query parameter. */
const TOOL_FIELD = /"(?:tool|toolId|tool_id)"\s*:\s*"([a-z0-9][a-z0-9-]*)"|[?&]tool=([a-z0-9][a-z0-9-]*)/g;
/** "tools such as `a`, `b` and `c`": prose that lists tool ids. */
const TOOL_LIST = /\btools?\s+(?:such as|like|including)\s+((?:`[a-z0-9-]+`(?:,\s*|\s+and\s+|\s+or\s+)?)+)/g;
/** "`a` composes `b`": only a tool composes another. */
const TOOL_COMPOSES = /`([a-z0-9][a-z0-9-]*)`\s+composes\s+`([a-z0-9][a-z0-9-]*)`/g;
/** A code span written as `<id> --export=<format>`, the CLI with its name left off. */
const TOOL_EXPORT = /^([a-z0-9][a-z0-9-]*)\s+--export=/;

/** Percent-escapes decoded, so a route inside a url-shot recipe (`%2F%23%2Ftool%2Fchart`) is read. */
function decoded(line: string): string {
  if (!/%[0-9A-Fa-f]{2}/.test(line)) return line;
  return line.replace(/(?:%[0-9A-Fa-f]{2})+/g, run => { try { return decodeURIComponent(run); } catch { return run; } });
}

export function scanExamples(src: string, text: string, ids: PublicIds, verbs: Set<string>): ExampleHit[] {
  const hits: ExampleHit[] = [];
  const privateNs = new Set<string>(PRIVATE_ASSET_NAMESPACES);
  const prefixes = src.startsWith('docs/work/') ? WORK_CLI_PREFIXES : CLI_PREFIXES;
  let inCode = false;
  text.split('\n').forEach((raw, i) => {
    const at = { src, line: i + 1 };
    const seen = new Set<string>();
    const hit = (kind: 'tool' | 'asset', id: string) => {
      if (seen.has(kind + id)) return;
      seen.add(kind + id);
      hits.push({ ...at, kind, id });
    };
    const tool = (id: string) => { if (!ids.tools.has(id)) hit('tool', id); };
    if (/^\s*(```|~~~)/.test(raw)) { inCode = !inCode; return; }
    const line = decoded(raw);
    for (const m of line.matchAll(TOOL_ROUTE)) tool(m[1]!);
    for (const m of line.matchAll(TOOL_FIELD)) tool((m[1] ?? m[2])!);
    for (const m of line.matchAll(TOOL_LIST)) for (const t of m[1]!.matchAll(/`([a-z0-9-]+)`/g)) tool(t[1]!);
    for (const m of line.matchAll(TOOL_COMPOSES)) { tool(m[1]!); tool(m[2]!); }
    const code = inCode ? [line] : [...line.matchAll(/`([^`]+)`/g)].map(m => m[1]!);
    for (const c of code) {
      for (const id of cliToolIds(c, verbs, prefixes)) tool(id);
      const shorthand = TOOL_EXPORT.exec(c.trim());
      if (shorthand && !verbs.has(shorthand[1]!) && !CLI_PREFIXES.includes(shorthand[1]!)) tool(shorthand[1]!);
    }
    for (const m of line.matchAll(ASSET_LIKE)) {
      const [, ns, kind] = m as unknown as [string, string, string];
      let rest = m[3]!;
      if (!/^\.+$/.test(rest)) rest = rest.replace(/[.,;:)/]+$/, '');
      if (/\.[a-z0-9]{2,5}$/i.test(rest) && !/^\.+$/.test(rest)) continue;   // a file path, not an id
      const id = `${ns}/${kind}/${rest}`;
      const wildcard = /\*|^\.+$/.test(rest);
      if (privateNs.has(ns)) { hit('asset', id); continue; }
      if (!ids.kinds.get(ns)?.has(kind)) continue;   // a path such as lolly/shells/web
      const known = wildcard
        ? [...ids.assets].some(a => a.startsWith(`${ns}/${kind}/` + rest.split(/\*|\.\.\./)[0]))
        : ids.assets.has(id);
      if (!known) hit('asset', id);
    }
  });
  return hits;
}

export function scanAllExamples(tree: DocsTree, root = ROOT): ExampleHit[] {
  const ids = publicIds(root);
  const verbs = cliVerbs(root);
  return tree.pages.flatMap(p => {
    const text = tree.read(p.src);
    return text === null ? [] : scanExamples('docs/' + p.src, text, ids, verbs);
  });
}

// ── Check 2: H1 equals the nav title ───────────────────────────────────────────────────

export interface TitleHit { slug: string; title: string; h1: string | null }

/** The first `# ` heading outside code, or null. */
export function firstH1(md: string): string | null {
  let inCode = false;
  for (const line of md.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) { inCode = !inCode; continue; }
    if (inCode) continue;
    const m = /^# (.+)$/.exec(line);
    if (m) return m[1]!.trim();
  }
  return null;
}

const words = (s: string) => s.toLowerCase().replace(/[`*_]/g, '').replace(/&amp;/g, '&')
  .replace(/[^\p{L}\p{N}&+]+/gu, ' ').trim().split(' ').filter(Boolean);

/** True when the heading is the title, or a longer form of it: every title word, in order. */
export function headingMatchesTitle(h1: string, title: string): boolean {
  const want = words(title);
  let at = 0;
  for (const w of words(h1)) if (w === want[at]) at++;
  return want.length > 0 && at === want.length;
}

export function scanTitles(tree: DocsTree): TitleHit[] {
  const hits: TitleHit[] = [];
  for (const p of tree.pages) {
    const text = tree.read(p.src);
    if (text === null) continue;
    const h1 = firstH1(text);
    if (h1 === null || !headingMatchesTitle(h1, p.title)) hits.push({ slug: p.slug, title: p.title, h1 });
  }
  return hits;
}

// ── Check 3: no Vercel ─────────────────────────────────────────────────────────────────

export const VERCEL = /vercel/gi;

/** docs/<src> → how many times the page names Vercel, for each page that does. */
export function scanVercel(tree: DocsTree): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const p of tree.pages) {
    const n = (tree.read(p.src)?.match(VERCEL) ?? []).length;
    if (n) counts['docs/' + p.src] = n;
  }
  return counts;
}

// ── Baselines ──────────────────────────────────────────────────────────────────────────

export interface ExamplesBaseline { $comment: string; tools: Record<string, string[]>; assets: Record<string, string[]> }
export interface TitlesBaseline { $comment: string; pages: Record<string, { title: string; h1: string | null }> }
export interface VercelBaseline { $comment: string; pages: Record<string, number> }

const readJson = <T>(name: string): T => JSON.parse(readFileSync(join(BASELINE_DIR, name), 'utf8')) as T;
export const readExamplesBaseline = () => readJson<ExamplesBaseline>('public-examples.json');
export const readTitlesBaseline = () => readJson<TitlesBaseline>('h1-title.json');
export const readVercelBaseline = () => readJson<VercelBaseline>('vercel.json');

/** Offenders whose id the baseline does not hold. An id moving to another page is not new. */
export function newExamples(hits: ExampleHit[], baseline: ExamplesBaseline): ExampleHit[] {
  return hits.filter(h => !Object.hasOwn(h.kind === 'tool' ? baseline.tools : baseline.assets, h.id));
}
export function newTitles(hits: TitleHit[], baseline: TitlesBaseline): TitleHit[] {
  return hits.filter(h => !Object.hasOwn(baseline.pages, h.slug));
}
export function risenVercel(counts: Record<string, number>, baseline: VercelBaseline): Array<{ src: string; was: number; now: number }> {
  return Object.entries(counts).flatMap(([src, now]) => {
    const was = baseline.pages[src] ?? 0;
    return now > was ? [{ src, was, now }] : [];
  });
}

const sorted = <T>(o: Record<string, T>): Record<string, T> => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
const COMMENTS = {
  examples: 'Tool and asset ids that English docs pages name but a public clone (community/, brands/lolly-start, brands/lolly-demo) does not have, recorded 2026-10-23 with the docs PRs open then. tests/docs-public-examples.test.ts fails only on an id missing here. Replace an example with a lolly-demo or lolly-start id; do not add to this list. The page lists are for reading; regenerate with node scripts/docs-ratchets.ts --write.',
  titles: 'Pages whose first # heading is not their manifest title or a longer form of it, recorded 2026-10-23 with the docs PRs open then. tests/docs-h1-title.test.ts fails only on a page missing here. Fix the heading or the title; do not add to this list. Regenerate with node scripts/docs-ratchets.ts --write.',
  vercel: 'How many times each English docs page names Vercel, recorded 2026-10-23 with the docs PRs open then. Lolly no longer runs on Vercel. tests/docs-platform-neutral.test.ts fails when a page goes above its count here. Describe hosting neutrally; do not raise a count. Regenerate with node scripts/docs-ratchets.ts --write.',
};

export function writeBaselines(trees: DocsTree[], root = ROOT): void {
  const examples: ExamplesBaseline = { $comment: COMMENTS.examples, tools: {}, assets: {} };
  const titles: TitlesBaseline = { $comment: COMMENTS.titles, pages: {} };
  const vercel: VercelBaseline = { $comment: COMMENTS.vercel, pages: {} };
  for (const tree of trees) {
    for (const hit of scanAllExamples(tree, root)) {
      const byId = hit.kind === 'tool' ? examples.tools : examples.assets;
      const list = byId[hit.id] ?? [];
      byId[hit.id] = list;
      if (!list.includes(hit.src)) list.push(hit.src);
    }
    for (const hit of scanTitles(tree)) titles.pages[hit.slug] ??= { title: hit.title, h1: hit.h1 };
    for (const [src, n] of Object.entries(scanVercel(tree))) vercel.pages[src] = Math.max(vercel.pages[src] ?? 0, n);
  }
  for (const list of [...Object.values(examples.tools), ...Object.values(examples.assets)]) list.sort();
  const write = (name: string, value: object) => writeFileSync(join(BASELINE_DIR, name), JSON.stringify(value, null, 2) + '\n');
  write('public-examples.json', { ...examples, tools: sorted(examples.tools), assets: sorted(examples.assets) });
  write('h1-title.json', { ...titles, pages: sorted(titles.pages) });
  write('vercel.json', { ...vercel, pages: sorted(vercel.pages) });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const tree = workingTree();
  if (args.includes('--write')) {
    const refs = args.filter(a => a.startsWith('--also-ref=')).map(a => a.slice('--also-ref='.length));
    writeBaselines([tree, ...refs.map(ref => gitTree(ref))]);
    console.log(`Docs ratchet baselines written from this tree${refs.length ? ` and ${refs.length} other ref(s)` : ''}.`);
  } else {
    const ex = newExamples(scanAllExamples(tree), readExamplesBaseline());
    const ti = newTitles(scanTitles(tree), readTitlesBaseline());
    const ve = risenVercel(scanVercel(tree), readVercelBaseline());
    for (const h of ex) console.error(`✗ ${h.src}:${h.line} names ${h.kind} "${h.id}", which a public clone does not have`);
    for (const h of ti) console.error(`✗ ${h.slug}: heading ${JSON.stringify(h.h1)} is not its title ${JSON.stringify(h.title)}`);
    for (const v of ve) console.error(`✗ ${v.src}: names Vercel ${v.now} times, baseline ${v.was}`);
    if (ex.length || ti.length || ve.length) process.exit(1);
    console.log('Docs ratchets hold: no new private example, heading mismatch or Vercel mention.');
  }
}
