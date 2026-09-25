// SPDX-License-Identifier: MPL-2.0
/**
 * Content-root resolver: where the active profile's tools and catalog live.
 *
 * This replaces the gitignored repo-root `tools/` and `catalog/` symlink farms that
 * scripts/use-profile.ts used to materialise (plan 244 step 4). Content lives in
 * mounted packs and nowhere else:
 *
 *   community/            brand-agnostic tools
 *   community/emoji-packs/  a SHARED asset root, mounted by every profile
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
 * A profile's optional `assets` list mounts SHARED asset roots: a directory holding
 * its own index.json plus its files, whose entries every profile serves. That is how
 * one emoji pack lives in one place and still appears in the asset index of the suse
 * brand and of lolly-start alike, with no file copied into either. Their urls are the
 * profile-independent /catalog/packs/<rootName>/<file>, still under /catalog/ so the
 * service worker, the static export and every script that strips a catalog url keep
 * working unchanged. readAssetIndex() is the merged index a Node reader wants;
 * materializeInto writes the same merge into dist.
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
 *    those bytes still carry the `extends` member. Anything that consumes manifest
 *    BYTES - the catalog signer, the dev server, readToolText, materializeInto -
 *    goes through `readToolManifestText(id)` (or `readToolManifest` for the parsed
 *    form), which strips it, so one set of bytes is signed, served and shipped.
 *    Every other file is a plain path on either side of the union.
 *  - A root that already IS a materializeInto output (the desktop app's exported
 *    content root, the RPM payload, a Docker image, a CLI test fixture) has real
 *    `tools/` and `catalog/` directories and no profiles.json. Such a root resolves as
 *    the single composed profile it carries, so every consumer below works against a
 *    packaged install and a checkout alike, with no second code path.
 *  - `materializeInto` writes no `.lolly-view.json` marker. That file was view
 *    bookkeeping (it carried a build timestamp, so it could never be byte-stable
 *    anyway) and nothing reads it after the collapse.
 */

import {
  cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
import { readFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve } from 'node:path';

import { isMaterializedRoot, repoRoot } from './repo-root.ts';

/** The only base pack `extends` may name in v1 (brand overlays of community tools). */
const BASE_PACK = 'community';

/**
 * Directories of the base pack that hold data the build reads, not a tool. The
 * slide layout library (plan 275) lives in community/ beside the tools it serves,
 * and scripts/build-slide-masters.ts turns it into engine data and pack masters;
 * it has no tool.json and is never listed as a tool.
 */
const BASE_PACK_DATA_DIRS: ReadonlySet<string> = new Set(['slide-structures']);

/** The profile name reported for a materialized root (a real tools/ + catalog/ tree,
 *  with no profiles.json to name a profile). See materializedRoots. */
const MATERIALIZED = 'materialized';

/** The catalog-relative directory a shared asset root is served under. */
const PACKS_DIR = 'packs';

/** One shared asset root: a directory of files plus its own index.json, mounted by
 *  every profile that lists it. `name` is the root's last path segment, and it names
 *  the url namespace: /catalog/packs/<name>/<file>. */
export interface SharedAssetRoot {
  name: string;
  dir: string;
}

export interface ContentRoots {
  /** Resolved profile name, e.g. 'suse' or 'lolly-start'. */
  profile: string;
  /** Absolute tool-pack roots in precedence order. Later roots win on id collision. */
  toolRoots: string[];
  /** Absolute catalog root for this profile. */
  catalogRoot: string;
  /** Shared asset roots this profile mounts, in profiles.json order. */
  assetRoots: SharedAssetRoot[];
  /** Tool ids this profile drops (profiles.json `exclude`). */
  exclude: ReadonlySet<string>;
}

/** The asset index as it is read: every brand key preserved, `assets` merged. */
export interface AssetIndexFile {
  assets: { id: string }[];
  [key: string]: unknown;
}

interface Profile {
  label?: string; tools: string[]; catalog: string; assets?: string[]; exclude?: string[];
}
interface ProfilesFile { default: string; profiles: Record<string, Profile> }

function loadProfiles(root: string): ProfilesFile {
  const path = join(root, 'profiles.json');
  if (!existsSync(path)) {
    throw new Error(`content-roots: no profiles.json at ${root} - is this a Lolly checkout?`);
  }
  return JSON.parse(readFileSync(path, 'utf8')) as ProfilesFile;
}

/**
 * Every root a profile REQUIRES, in one list: the packs completeness is judged on
 * and the paths a "missing pack" error names.
 *
 * A shared asset root is deliberately not one of them. It is additive - it adds
 * entries to an index that is already complete without it - and a deployment may
 * legitimately leave one out: the MCP serverless function excludes the emoji pack
 * bundle from its trace because the function is near its size limit. Judging
 * completeness on it would turn that choice into a throw on every content request
 * rather than a listing with one fewer pack in it. An absent root is skipped by
 * sharedRoots below, and readAssetIndex and assetIndexFiles already skip a root
 * with no index.json, so nothing else changes.
 */
function declaredRoots(p: Profile): string[] {
  return [...p.tools, p.catalog];
}

/** All of a profile's required content roots exist on disk (a private pack may not). */
function isComplete(root: string, p: Profile): boolean {
  return declaredRoots(p).every((r) => existsSync(join(root, r)));
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
 * With LOLLY_STRICT_PROFILE set an incomplete profile throws instead of falling
 * back. vercel.json's buildCommand sets it, because a git build clones the
 * submodule anonymously and skips the private brands/suse pack (update = none),
 * and a silent
 * fallback once shipped the blank brand to production. The flag names a BUILD, not
 * the platform: a deployed function only ever received the packs one build chose for
 * it, so refusing to serve them would turn a build-time question into a 500 on every
 * content request (the flag is not in the function's runtime env, so the fall-through
 * below is what runs there).
 */
function resolveProfileName(root: string, cfg: ProfilesFile, explicit?: string): string {
  const envChoice = process.env.LOLLY_PROFILE?.trim();
  if (explicit) return explicit;
  if (envChoice) return envChoice;
  const sticky = stickyProfile(root);
  if (sticky && cfg.profiles[sticky] && isComplete(root, cfg.profiles[sticky]!)) return sticky;
  const fallbackDefault = cfg.profiles[cfg.default];
  if (fallbackDefault && isComplete(root, fallbackDefault)) return cfg.default;
  if (process.env.LOLLY_STRICT_PROFILE) {
    throw new Error(
      `content-roots: default profile "${cfg.default}" is incomplete and LOLLY_STRICT_PROFILE ` +
      'is set, so this build will not fall back to another brand. The private brands/suse pack ' +
      'is not present in a git build. Deploy an archive of the local tree (packs included), or ' +
      'set LOLLY_PROFILE=lolly-start on the project to intentionally ship the blank brand.',
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

/**
 * A profile's `assets` list as mounted roots. The url namespace is the root's last
 * path segment, so two roots with the same segment would serve each other's files
 * from one prefix and the merged index could not say which file an entry meant. That
 * is refused here rather than resolved by order, whether or not both are on disk:
 * a profile that names two roots by one name is a configuration error either way.
 *
 * A root that is not on disk is skipped rather than mounted. These are additive, so
 * an absent one means one fewer pack in the index, which is what a deployment that
 * left it out of its bundle asked for.
 */
function sharedRoots(root: string, declared: string[], profile: string): SharedAssetRoot[] {
  const out: SharedAssetRoot[] = [];
  const seen = new Map<string, string>();
  for (const rel of declared) {
    const name = basename(rel);
    const dir = join(root, rel);
    const clash = seen.get(name);
    if (clash) {
      throw new Error(
        `content-roots: profile "${profile}" mounts two shared asset roots named "${name}" ` +
        `(${clash} and ${dir}) - one url namespace cannot serve both`,
      );
    }
    seen.set(name, dir);
    if (existsSync(dir)) out.push({ name, dir });
  }
  return out;
}

/**
 * Every shared asset root ANY profile mounts, deduped by directory. The per-profile
 * answer is `contentRoots().assetRoots`; this is for the build scripts that maintain
 * the roots themselves (checksums, added dates), because those files are shared and
 * a per-profile loop would rewrite the same bytes once per brand.
 */
export function allAssetRoots(opts?: { root?: string }): SharedAssetRoot[] {
  const root = resolve(opts?.root ?? repoRoot());
  if (!existsSync(join(root, 'profiles.json'))) return [];
  const cfg = loadProfiles(root);
  const out: SharedAssetRoot[] = [];
  for (const [name, profile] of Object.entries(cfg.profiles)) {
    for (const mounted of sharedRoots(root, profile.assets ?? [], name)) {
      if (!out.some((a) => a.dir === mounted.dir)) out.push(mounted);
    }
  }
  return out;
}

const cache = new Map<string, ContentRoots>();

/**
 * A root that carries a real `tools/` + `catalog/` tree instead of packs and a
 * profiles.json: what materializeInto writes, and therefore what the desktop app
 * exports beside itself, what the RPM payload and the Docker image ship, and what the
 * CLI contract suites build as a fixture. The tree is already one profile's composed
 * output - overlays resolved, `extends` stripped, exclusions applied - so there is
 * nothing left to choose and a profile name is not consulted for such a root.
 */
function materializedRoots(root: string): ContentRoots {
  return {
    profile: MATERIALIZED,
    toolRoots: [join(root, 'tools')],
    catalogRoot: join(root, 'catalog'),
    // A materialized tree carries each shared root as real bytes under
    // catalog/packs/<name>/ and an already-merged assets/index.json, so there is
    // nothing left to mount: catalogFile('packs/<name>/<rel>') finds those files by
    // the plain join below.
    assetRoots: [],
    exclude: new Set<string>(),
  };
}

/** Resolve once per process. `profile` overrides env; `root` overrides the marker walk. */
export function contentRoots(opts?: { profile?: string; root?: string }): ContentRoots {
  const root = resolve(opts?.root ?? repoRoot());
  const key = [
    root, opts?.profile ?? '', process.env.LOLLY_PROFILE ?? '',
    process.env.LOLLY_STRICT_PROFILE ?? '',
  ].join('\u0000');
  const hit = cache.get(key);
  if (hit) return hit;

  if (!existsSync(join(root, 'profiles.json')) && isMaterializedRoot(root)) {
    const materialized = materializedRoots(root);
    rootOf.set(materialized, root);
    cache.set(key, materialized);
    return materialized;
  }

  const cfg = loadProfiles(root);
  const name = resolveProfileName(root, cfg, opts?.profile);
  const profile = cfg.profiles[name];
  if (!profile) {
    throw new Error(
      `content-roots: unknown profile "${name}" - known: ${Object.keys(cfg.profiles).join(', ')}`,
    );
  }
  if (!isComplete(root, profile)) {
    const missing = declaredRoots(profile).filter((r) => !existsSync(join(root, r)));
    // Only brands/ holds a submodule, so only a missing brand gets the checkout
    // command. Naming it for a plain directory sends the reader after a submodule
    // that does not exist, and git answers with a pathspec error.
    const hint = missing[0]!.startsWith('brands/')
      ? ` (a private pack needs: git submodule update --init --checkout ${missing[0]})`
      : ' (that directory is not in this checkout)';
    throw new Error(`content-roots: profile "${name}" is missing: ${missing.join(', ')}${hint}`);
  }

  const resolved: ContentRoots = {
    profile: name,
    toolRoots: profile.tools.map((r) => join(root, r)),
    catalogRoot: join(root, profile.catalog),
    assetRoots: sharedRoots(root, profile.assets ?? [], name),
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
const plans = new WeakMap<
  ContentRoots,
  { stamp: string; plan: Map<string, { dir: string; base?: string }> }
>();

/**
 * What the plan was built from: the entries of every tool root and whether each one
 * carries a manifest. A dev server runs for days; a tool or a brand overlay created
 * after it started must be answered without a restart, and this is the cheapest
 * question that notices one - a few directory reads, no manifest parsing.
 */
function planStamp(roots: ContentRoots): string {
  const parts: string[] = [];
  for (const rootAbs of roots.toolRoots) {
    let names: string[] = [];
    try { names = readdirSync(rootAbs).sort(); } catch { names = ['<missing>']; }
    parts.push(rootAbs + ':' + names.map((n) => n + (existsSync(join(rootAbs, n, 'tool.json')) ? '+' : '-')).join(','));
  }
  return parts.join('|');
}

/** id -> { dir, base? }. `base` is set when the tool is a brand overlay of a community tool. */
export function toolDirs(r?: ContentRoots): Map<string, { dir: string; base?: string }> {
  const roots = r ?? contentRoots();
  const stamp = planStamp(roots);
  const memo = plans.get(roots);
  if (memo && memo.stamp === stamp) return new Map(memo.plan);
  const plan = buildPlan(roots);
  plans.set(roots, { stamp, plan });
  return new Map(plan);
}

function buildPlan(roots: ContentRoots): Map<string, { dir: string; base?: string }> {
  const plan = new Map<string, { dir: string; base?: string }>();
  const root = rootFor(roots);
  // A shared asset root can sit inside a tool pack (community/emoji-packs does), and
  // it is not a tool. Every profile's roots count, not just this one's, so the same
  // directory is never a tool under one profile and a pack under another.
  const sharedDirs = new Set([
    ...roots.assetRoots.map((a) => a.dir),
    ...allAssetRoots({ root }).map((a) => a.dir),
  ]);
  for (const rootAbs of roots.toolRoots) {
    const packRel = relative(root, rootAbs);
    const isBasePack = packRel === BASE_PACK;
    for (const entry of readdirSync(rootAbs)) {
      if (entry.startsWith('.') || entry === 'node_modules') continue;
      // Underscore-prefixed dirs are pack infrastructure, not tools - e.g.
      // community/_shared/, the canonical helper corpus that sync-shared-hooks.ts
      // copies into tool hooks.js.
      if (entry.startsWith('_')) continue;
      if (isBasePack && BASE_PACK_DATA_DIRS.has(entry)) continue;
      const dir = join(rootAbs, entry);
      if (sharedDirs.has(dir)) continue;
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

/**
 * Read one file out of a tool as text: the `fetchFile` callback loadTool() takes,
 * whose paths are `<id>/<rel>`. Every Node host wants exactly this - the CLI's
 * readToolFile, its batch and smoke loops, host.compose's child loader, and the MCP
 * server's fetchToolFile - so it lives here once.
 *
 * A miss throws an Error carrying `code: 'ENOENT'`, the way the readFile it replaces
 * did, because callers key their own "unknown tool" message off that code
 * (shells/cli/src/run.ts loadToolOrThrow). A `..` segment is refused: the resolver
 * matches an id against the profile's tool directories, so the id can name no path,
 * and the tool-relative part must not either.
 *
 * `<id>/tool.json` comes back through readToolManifestText, so an overlay tool's
 * manifest reads the same here as it does in dist and in the signed envelope. Reading
 * the overlay file's raw bytes instead would hand a caller an `extends` member no
 * consumer of a composed tool expects.
 */
export async function readToolText(path: string, r?: ContentRoots): Promise<string> {
  const [id, ...rest] = path.split(/[\\/]/).filter(Boolean);
  let abs: string | null = null;
  if (id && rest.length && !rest.includes('..')) {
    try { abs = toolFile(id, rest.join('/'), r); } catch { abs = null; } // no such tool in this profile
    if (abs && rest.join('/') === 'tool.json') return readToolManifestText(id!, r);
  }
  if (!abs) {
    const err = new Error(`ENOENT: no such tool file, open '${path}'`) as Error & { code?: string };
    err.code = 'ENOENT';
    throw err;
  }
  return readFile(abs, 'utf8');
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

/**
 * The manifest TEXT a consumer should see: the winning side's bytes with the
 * `extends` marker stripped. One code path for readToolManifest, for readToolText,
 * for the catalog signer and for the file materializeInto writes, so no two of them
 * can disagree about what `<id>/tool.json` is.
 *
 * Use this, not `readFileSync(toolFile(id, 'tool.json'))`, anywhere the BYTES matter.
 * For an overlay tool the path on disk still carries the `extends` member, so hashing
 * or serving that file would sign one manifest and ship another - a signed release
 * that fails its own verifier.
 */
export function readToolManifestText(id: string, r?: ContentRoots): string {
  const { dir, base } = entry(id, r);
  const raw = readFileSync(join(dir, 'tool.json'), 'utf8');
  return base ? stripExtendsField(raw) : raw;
}

/** The tool's manifest with the `extends` marker stripped, as consumers see it today. */
export function readToolManifest(id: string, r?: ContentRoots): unknown {
  return JSON.parse(readToolManifestText(id, r));
}

/** Path segments that stay inside the root they are joined onto. A `..` is refused
 *  rather than resolved, so a catalog url can never name a file outside the catalog. */
function contained(rel: string): string[] {
  const segs = rel.split(/[\\/]/).filter((s) => s && s !== '.');
  if (segs.includes('..')) {
    throw new Error(`content-roots: "${rel}" leaves the content root it is resolved against`);
  }
  return segs;
}

/**
 * Absolute path inside the active catalog: catalogFile('tools/index.json').
 *
 * `packs/<name>/<rel>` is the one namespace that does not live under the brand
 * catalog: it resolves to <rel> inside the shared asset root called <name>, which is
 * how one file serves every profile. A name no profile mounts falls through to the
 * plain join, which is what a materialized root needs: there the packs really are
 * directories under catalog/.
 */
export function catalogFile(rel: string, r?: ContentRoots): string {
  const roots = r ?? contentRoots();
  const segs = contained(rel);
  if (segs[0] === PACKS_DIR && segs.length >= 2) {
    const shared = roots.assetRoots.find((a) => a.name === segs[1]);
    if (shared) return join(shared.dir, ...segs.slice(2));
  }
  return join(roots.catalogRoot, ...segs);
}

/** The files the merged asset index is read from: the brand's, then each mounted
 *  shared root's. A caller that has to answer "has this changed" (a conditional
 *  fetch) stats these rather than guessing. */
export function assetIndexFiles(r?: ContentRoots): string[] {
  const roots = r ?? contentRoots();
  const out = [catalogFile('assets/index.json', roots)];
  for (const shared of roots.assetRoots) {
    const path = join(shared.dir, 'index.json');
    if (existsSync(path)) out.push(path);
  }
  return out;
}

/**
 * The asset index every Node reader should use: the brand's entries, then each
 * mounted shared root's, in root order.
 *
 * An id in two places is an error, not a precedence question. The web shell's own
 * instance merge lets a pack lay an entry over the base by id, but that is a device
 * choosing what it installed; a repository shipping one id twice means two different
 * files answer to the same permanent contract, and which one a reader got would
 * depend on the profile it happened to resolve.
 */
export function readAssetIndex(r?: ContentRoots): AssetIndexFile {
  const roots = r ?? contentRoots();
  const brandPath = catalogFile('assets/index.json', roots);
  const index = JSON.parse(readFileSync(brandPath, 'utf8')) as AssetIndexFile;
  const assets = Array.isArray(index.assets) ? [...index.assets] : [];
  const from = new Map<string, string>(assets.map((a) => [a.id, brandPath]));
  for (const shared of roots.assetRoots) {
    const path = join(shared.dir, 'index.json');
    if (!existsSync(path)) continue;
    const mounted = JSON.parse(readFileSync(path, 'utf8')) as AssetIndexFile;
    for (const asset of mounted.assets ?? []) {
      const prior = from.get(asset.id);
      if (prior) {
        throw new Error(
          `content-roots: asset id "${asset.id}" is declared in both ${prior} and ${path} - ` +
          'an asset id is a permanent contract, so a shared root may not redefine one',
        );
      }
      from.set(asset.id, path);
      assets.push(asset);
    }
  }
  return { ...index, assets };
}

/**
 * A rooted content URL onto disk. `/catalog/<rel>` and `/tools/<id>/<rel>` are the two
 * URL namespaces the site serves, and tool data is full of them: an asset's
 * `formats[].url`, a font url a hook hands host.text, a music track. Neither is a
 * directory under the repo root any more, so a Node consumer holding one asks here
 * instead of joining it onto a root.
 *
 * null when the url names neither namespace, when the tool is not in this profile, or
 * when the file is not there - the caller decides what a miss means.
 */
export function contentUrlFile(url: string, r?: ContentRoots): string | null {
  const segs = url.split('?')[0]!.split('#')[0]!.split('/').filter(Boolean);
  const [head, ...rest] = segs;
  if (!head || !rest.length) return null;
  try {
    const roots = r ?? contentRoots();
    if (head === 'catalog') {
      const p = catalogFile(rest.join('/'), roots);
      return existsSync(p) ? p : null;
    }
    if (head === 'tools' && rest.length > 1) {
      return toolFile(rest[0]!, rest.slice(1).join('/'), roots);
    }
  } catch { /* no profile resolves here, or no such tool: a miss like any other */ }
  return null;
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

  // Shared asset roots become real files under catalog/packs/<name>/, which is the
  // url their entries already carry, and the index the tree serves is the merged one.
  // The brand's own committed index is never touched: the merge exists in dist only.
  for (const shared of roots.assetRoots) {
    copyTree(shared.dir, join(catalogOut, PACKS_DIR, shared.name));
  }
  if (roots.assetRoots.length && existsSync(catalogFile('assets/index.json', roots))) {
    const merged = join(catalogOut, 'assets', 'index.json');
    mkdirSync(join(merged, '..'), { recursive: true });
    writeFileSync(merged, JSON.stringify(readAssetIndex(roots), null, 2) + '\n');
  }

  for (const [id, { dir, base }] of plan) {
    const out = join(toolsOut, id);
    if (!base) { copyTree(dir, out); continue; }
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, 'tool.json'), readToolManifestText(id, roots));
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
