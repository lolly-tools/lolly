// SPDX-License-Identifier: MPL-2.0
/**
 * Content-root resolver: where the active profile's tools and catalog live.
 *
 * This replaces the gitignored repo-root `tools/` and `catalog/` symlink farms that
 * scripts/use-profile.ts used to materialise (plan 244 step 4). Content lives in
 * mounted packs and nowhere else:
 *
 *   community/            brand-agnostic tools
 *   brands/suse/          PRIVATE brand pack (tools + catalog)
 *   brands/lolly-start/   the blank starter brand
 *
 * profiles.json names which packs make up a profile; this module answers the two
 * questions every script, shell and service used to answer by reading a view path:
 * "where does tool <id> live" (toolDirs, toolFile, listToolFiles, readToolManifest)
 * and "where is the catalog" (catalogFile). The one copy that survives is
 * materializeInto, which writes a real tools/ + catalog/ tree for a dist/ build,
 * an RPM payload or a Docker image, because those serve the two paths over HTTP.
 *
 * The overlay rules are ported from use-profile.ts unchanged: a brand tool.json may
 * declare `"extends": "community"` and carry only the files that differ. The tool is
 * then the per-file union of the community base and the overlay, overlay winning on
 * filename collision, recursing one level into subdirs (i18n/, assets/), with the
 * `extends` marker stripped from the manifest so consumers see a plain tool. A
 * declared overlay whose base is missing is an error, never a silent partial tool.
 *
 * Two caveats a consumer has to know:
 *
 *  - `toolFile(id, 'tool.json')` returns a path on disk, so for an OVERLAY tool
 *    those bytes still carry the `extends` member. Read a manifest through
 *    `readToolManifest(id)`, which strips it; `materializeInto` writes the stripped
 *    form. Every other file is a plain path on either side of the union.
 *  - `materializeInto` writes no `.lolly-view.json` marker. That file was view
 *    bookkeeping (it carried a build timestamp, so it could never be byte-stable
 *    anyway) and nothing reads it after the collapse.
 */

import {
  cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';

import { repoRoot } from './repo-root.ts';

/** The only base pack `extends` may name in v1 (brand overlays of community tools). */
const BASE_PACK = 'community';

export interface ContentRoots {
  /** Resolved profile name, e.g. 'suse' or 'lolly-start'. */
  profile: string;
  /** Absolute tool-pack roots in precedence order. Later roots win on id collision. */
  toolRoots: string[];
  /** Absolute catalog root for this profile. */
  catalogRoot: string;
  /** Tool ids this profile drops (profiles.json `exclude`). */
  exclude: ReadonlySet<string>;
}

interface Profile { label?: string; tools: string[]; catalog: string; exclude?: string[] }
interface ProfilesFile { default: string; profiles: Record<string, Profile> }

function loadProfiles(root: string): ProfilesFile {
  const path = join(root, 'profiles.json');
  if (!existsSync(path)) {
    throw new Error(`content-roots: no profiles.json at ${root} - is this a Lolly checkout?`);
  }
  return JSON.parse(readFileSync(path, 'utf8')) as ProfilesFile;
}

/** All of a profile's content roots exist on disk (a private pack may not). */
function isComplete(root: string, p: Profile): boolean {
  return [...p.tools, p.catalog].every((r) => existsSync(join(root, r)));
}

/** The sticky local choice written by the old profile switcher, if any. */
function stickyProfile(root: string): string | null {
  try { return readFileSync(join(root, '.lolly-profile'), 'utf8').trim() || null; } catch { return null; }
}

/**
 * Profile precedence, in one implementation instead of three: explicit
 * `opts.profile`, then LOLLY_PROFILE (trimmed, so a stray newline in a dashboard
 * env var is not an unknown profile), then the sticky .lolly-profile if its packs
 * are complete, then profiles.json `default`, then the first profile whose packs
 * are all on disk.
 *
 * Under $VERCEL an incomplete profile throws instead of falling back: a git build
 * clones submodules anonymously and skips the private brands/suse pack
 * (update = none), and a silent fallback once shipped the blank brand to
 * production.
 */
function resolveProfileName(root: string, cfg: ProfilesFile, explicit?: string): string {
  const envChoice = process.env.LOLLY_PROFILE?.trim();
  if (explicit) return explicit;
  if (envChoice) return envChoice;
  const sticky = stickyProfile(root);
  if (sticky && cfg.profiles[sticky] && isComplete(root, cfg.profiles[sticky]!)) return sticky;
  const fallbackDefault = cfg.profiles[cfg.default];
  if (fallbackDefault && isComplete(root, fallbackDefault)) return cfg.default;
  if (process.env.VERCEL) {
    throw new Error(
      `content-roots: default profile "${cfg.default}" is incomplete on Vercel - the private ` +
      'brands/suse pack is not present in a git build. Deploy an archive of the local tree ' +
      '(packs included), or set LOLLY_PROFILE=lolly-start on the project to intentionally ' +
      'ship the blank brand.',
    );
  }
  const complete = Object.entries(cfg.profiles).find(([, p]) => isComplete(root, p))?.[0];
  if (!complete) {
    throw new Error(
      'content-roots: no complete profile - none of ' +
      `[${Object.keys(cfg.profiles).join(', ')}] has all its packs on disk at ${root}.`,
    );
  }
  return complete;
}

const cache = new Map<string, ContentRoots>();

/** Resolve once per process. `profile` overrides env; `root` overrides the marker walk. */
export function contentRoots(opts?: { profile?: string; root?: string }): ContentRoots {
  const root = resolve(opts?.root ?? repoRoot());
  const key = [root, opts?.profile ?? '', process.env.LOLLY_PROFILE ?? '', process.env.VERCEL ?? ''].join('\u0000');
  const hit = cache.get(key);
  if (hit) return hit;

  const cfg = loadProfiles(root);
  const name = resolveProfileName(root, cfg, opts?.profile);
  const profile = cfg.profiles[name];
  if (!profile) {
    throw new Error(
      `content-roots: unknown profile "${name}" - known: ${Object.keys(cfg.profiles).join(', ')}`,
    );
  }
  if (!isComplete(root, profile)) {
    const missing = [...profile.tools, profile.catalog].filter((r) => !existsSync(join(root, r)));
    throw new Error(
      `content-roots: profile "${name}" is missing: ${missing.join(', ')}` +
      ` (a private pack needs: git submodule update --init --checkout ${missing[0]})`,
    );
  }

  const resolved: ContentRoots = {
    profile: name,
    toolRoots: profile.tools.map((r) => join(root, r)),
    catalogRoot: join(root, profile.catalog),
    exclude: new Set(profile.exclude ?? []),
  };
  rootOf.set(resolved, root);
  cache.set(key, resolved);
  return resolved;
}

/** The overlay marker, if the manifest parses and declares one. A malformed
 *  tool.json is NOT an overlay - treat the dir as a plain tool and let
 *  validate:catalog report the JSON error with proper context. */
function readExtends(manifestPath: string): string | null {
  try {
    const v = (JSON.parse(readFileSync(manifestPath, 'utf8')) as { extends?: unknown }).extends;
    return typeof v === 'string' && v.length ? v : null;
  } catch { return null; }
}

/** Resolved per ContentRoots object, which contentRoots() itself caches, so the
 *  pack walk and the one-time exclude warning happen once per process. */
const plans = new WeakMap<ContentRoots, Map<string, { dir: string; base?: string }>>();

/** id -> { dir, base? }. `base` is set when the tool is a brand overlay of a community tool. */
export function toolDirs(r?: ContentRoots): Map<string, { dir: string; base?: string }> {
  const roots = r ?? contentRoots();
  const memo = plans.get(roots);
  if (memo) return new Map(memo);
  const plan = buildPlan(roots);
  plans.set(roots, plan);
  return new Map(plan);
}

function buildPlan(roots: ContentRoots): Map<string, { dir: string; base?: string }> {
  const plan = new Map<string, { dir: string; base?: string }>();
  const root = rootFor(roots);
  for (const rootAbs of roots.toolRoots) {
    const packRel = relative(root, rootAbs);
    const isBasePack = packRel === BASE_PACK;
    for (const entry of readdirSync(rootAbs)) {
      if (entry.startsWith('.') || entry === 'node_modules') continue;
      // Underscore-prefixed dirs are pack infrastructure, not tools - e.g.
      // community/_shared/, the canonical helper corpus that sync-shared-hooks.ts
      // copies into tool hooks.js.
      if (entry.startsWith('_')) continue;
      const dir = join(rootAbs, entry);
      if (!statSync(dir).isDirectory()) continue; // NOTICE.md, README.md, ...
      const extendsTarget = readExtends(join(dir, 'tool.json'));
      if (!extendsTarget) { plan.set(entry, { dir }); continue; }
      if (isBasePack) {
        throw new Error(
          `${packRel}/${entry}/tool.json declares "extends" - community tools are overlay BASES; only a brand pack may declare an overlay`,
        );
      }
      if (extendsTarget !== BASE_PACK) {
        throw new Error(
          `${packRel}/${entry}/tool.json declares "extends": "${extendsTarget}" - v1 supports only "${BASE_PACK}" as the base pack`,
        );
      }
      const base = join(root, BASE_PACK, entry);
      if (!existsSync(join(base, 'tool.json'))) {
        throw new Error(
          `${packRel}/${entry} extends "${BASE_PACK}" but ${BASE_PACK}/${entry}/tool.json does not exist - ` +
          'an overlay and its base share the same tool id (ids are permanent contracts); refusing to resolve a partial tool',
        );
      }
      plan.set(entry, { dir, base });
    }
  }
  // Per-profile exclusions: drop these ids whichever root won them. A miss is
  // warned, not fatal - an id that is not present is a no-op (likely a typo).
  for (const id of roots.exclude) {
    if (!plan.delete(id)) {
      console.warn(`⚠ profile exclude: "${id}" is not among the profile's tools - nothing to drop (typo?)`);
    }
  }
  return plan;
}

/** The checkout root a ContentRoots was resolved from. Overlay bases are looked
 *  up as <root>/community/<id>, the way use-profile.ts did it, so a brand overlay
 *  resolves against the same base pack whatever the profile lists. A hand-built
 *  ContentRoots (a test, a caller assembling its own) is not in the map, so fall
 *  back to the community root it names, then to the marker walk. */
const rootOf = new WeakMap<ContentRoots, string>();

function rootFor(roots: ContentRoots): string {
  const known = rootOf.get(roots);
  if (known) return known;
  const community = roots.toolRoots.find((p) => basename(p) === BASE_PACK);
  return community ? dirname(community) : repoRoot();
}

function entry(id: string, r?: ContentRoots): { dir: string; base?: string } {
  const found = toolDirs(r).get(id);
  if (!found) {
    const roots = r ?? contentRoots();
    throw new Error(`content-roots: no tool "${id}" in profile "${roots.profile}"`);
  }
  return found;
}

function isDir(p: string): boolean {
  try { return statSync(p).isDirectory(); } catch { return false; }
}

/**
 * Absolute path of a file inside a tool, overlay-aware. null when it does not exist.
 *
 * The union is per-file at the top level and one level down (i18n/, assets/);
 * anything deeper comes wholesale from the winning side, which is exactly how the
 * composed view was built.
 */
export function toolFile(id: string, rel: string, r?: ContentRoots): string | null {
  const { dir, base } = entry(id, r);
  const segs = rel.split(/[\\/]/).filter(Boolean);
  if (!segs.length) return null;
  if (!base) {
    const p = join(dir, ...segs);
    return existsSync(p) ? p : null;
  }
  const pick = (level: number, rest: string[], overlayDir: string, baseDir: string): string | null => {
    const [name, ...tail] = rest as [string, ...string[]];
    const overlayPath = join(overlayDir, name);
    const basePath = join(baseDir, name);
    if (!tail.length) {
      if (existsSync(overlayPath)) return overlayPath;
      return existsSync(basePath) ? basePath : null;
    }
    if (level === 0 && isDir(overlayPath) && isDir(basePath)) {
      return pick(level + 1, tail, overlayPath, basePath);
    }
    const winner = existsSync(overlayPath) ? overlayPath : basePath;
    const p = join(winner, ...tail);
    return existsSync(p) ? p : null;
  };
  return pick(0, segs, dir, base);
}

/** Tool-relative paths of every file under `dir`, '/' separated, sorted. */
function walkFiles(dir: string, prefix: string, out: string[]): void {
  for (const name of readdirSync(dir).sort()) {
    const abs = join(dir, name);
    const rel = prefix + name;
    if (isDir(abs)) walkFiles(abs, rel + '/', out);
    else out.push(rel);
  }
}

/** Every file a tool contributes, overlay union applied. Replaces readdir over tools/<id>/. */
export function listToolFiles(id: string, r?: ContentRoots): string[] {
  const { dir, base } = entry(id, r);
  const out: string[] = [];
  if (!base) walkFiles(dir, '', out);
  else unionFiles(base, dir, '', 0, out);
  return out.sort();
}

function unionFiles(
  baseDir: string, overlayDir: string, prefix: string, level: number, out: string[],
): void {
  const names = [...new Set([...readdirSync(baseDir), ...readdirSync(overlayDir)])].sort();
  for (const name of names) {
    if (name.startsWith('.')) continue; // .DS_Store and friends are never tool data
    const basePath = join(baseDir, name);
    const overlayPath = join(overlayDir, name);
    const inOverlay = existsSync(overlayPath);
    const winner = inOverlay ? overlayPath : basePath;
    if (level === 0 && name === 'tool.json') { out.push(prefix + name); continue; }
    if (level === 0 && inOverlay && isDir(basePath) && isDir(overlayPath)) {
      unionFiles(basePath, overlayPath, prefix + name + '/', level + 1, out);
      continue;
    }
    if (isDir(winner)) walkFiles(winner, prefix + name + '/', out);
    else out.push(prefix + name);
  }
}

/** Byte offset of the top-level "extends" KEY in raw manifest JSON, or -1.
 *  A one-pass string- and depth-aware scan (not a parse) so a nested member
 *  that happens to be named "extends" - e.g. inside an input's config object -
 *  is never matched. A depth-1 string only counts when a `:` follows it
 *  (a key, not a member's string value). */
function topLevelExtendsKeyOffset(raw: string): number {
  let depth = 0;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '"') {
      const keyStart = i;
      for (i++; i < raw.length && raw[i] !== '"'; i++) {
        if (raw[i] === '\\') i++; // skip the escaped char (incl. \")
      }
      if (depth !== 1 || raw.slice(keyStart + 1, i) !== 'extends') continue;
      let j = i + 1;
      while (j < raw.length && ' \t\r\n'.includes(raw[j]!)) j++;
      if (raw[j] === ':') return keyStart;
    } else if (ch === '{' || ch === '[') depth++;
    else if (ch === '}' || ch === ']') depth--;
  }
  return -1;
}

/** Remove the top-level "extends" member from raw manifest JSON while
 *  preserving every other byte - so a converted overlay's manifest stays
 *  byte-identical to the pre-conversion fork. The member's line is located
 *  depth-aware (topLevelExtendsKeyOffset - a NESTED key named "extends" is
 *  never touched) and stripped whole; if the author formatted the member
 *  unusually (same line as another member or the opening brace, last member
 *  with no trailing comma), the stringify-equality guard rejects the strip and
 *  we fall back to a canonical re-serialise - still correct JSON, just
 *  reformatted. */
function stripExtendsField(raw: string): string {
  const manifest = JSON.parse(raw) as Record<string, unknown>;
  if (!('extends' in manifest)) return raw;
  delete manifest.extends;
  const keyAt = topLevelExtendsKeyOffset(raw);
  if (keyAt !== -1) {
    const lineStart = raw.lastIndexOf('\n', keyAt) + 1;
    const nextNl = raw.indexOf('\n', keyAt);
    const stripped = raw.slice(0, lineStart) + (nextNl === -1 ? '' : raw.slice(nextNl + 1));
    try {
      if (JSON.stringify(JSON.parse(stripped)) === JSON.stringify(manifest)) return stripped;
    } catch { /* dangling comma etc. - fall through */ }
  }
  return JSON.stringify(manifest, null, 2) + '\n';
}

/** The manifest TEXT a consumer should see: the winning side's bytes with the
 *  `extends` marker stripped. One code path for readToolManifest and for the
 *  file materializeInto writes, so the two can never disagree. */
function manifestText(id: string, r?: ContentRoots): string {
  const { dir, base } = entry(id, r);
  const raw = readFileSync(join(dir, 'tool.json'), 'utf8');
  return base ? stripExtendsField(raw) : raw;
}

/** The tool's manifest with the `extends` marker stripped, as consumers see it today. */
export function readToolManifest(id: string, r?: ContentRoots): unknown {
  return JSON.parse(manifestText(id, r));
}

/** Absolute path inside the active catalog: catalogFile('tools/index.json'). */
export function catalogFile(rel: string, r?: ContentRoots): string {
  const roots = r ?? contentRoots();
  return join(roots.catalogRoot, ...rel.split(/[\\/]/).filter(Boolean));
}

/** Copy a tree as real bytes. `filter` forces Node's JS copy path, because the
 *  native recursive fast path has ignored `dereference` on affected releases
 *  (https://github.com/nodejs/node/issues/59168). */
function copyTree(src: string, dst: string): void {
  cpSync(src, dst, { recursive: true, dereference: true, filter: () => true });
}

/** The one remaining copy path: write a real tools/ + catalog/ tree into dest. */
export function materializeInto(dest: string, r?: ContentRoots): void {
  const roots = r ?? contentRoots();
  const toolsOut = join(dest, 'tools');
  const catalogOut = join(dest, 'catalog');
  const plan = toolDirs(roots);

  rmSync(toolsOut, { recursive: true, force: true });
  rmSync(catalogOut, { recursive: true, force: true });
  mkdirSync(toolsOut, { recursive: true });
  copyTree(roots.catalogRoot, catalogOut);

  for (const [id, { dir, base }] of plan) {
    const out = join(toolsOut, id);
    if (!base) { copyTree(dir, out); continue; }
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, 'tool.json'), manifestText(id, roots));
    for (const rel of listToolFiles(id, roots)) {
      if (rel === 'tool.json') continue;
      const from = toolFile(id, rel, roots);
      if (!from) continue;
      const to = join(out, ...rel.split('/'));
      mkdirSync(join(to, '..'), { recursive: true });
      copyTree(from, to);
    }
  }
}
