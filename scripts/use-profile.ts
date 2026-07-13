#!/usr/bin/env node
/**
 * Profile switcher — builds the repo-root `tools/` and `catalog/` VIEWS.
 *
 * Run as:
 *   npm run profile                 # show the active profile + what's available
 *   npm run profile:suse            # switch to the SUSE brand pack
 *   npm run profile:start           # switch to the blank lolly-start brand
 *   node scripts/use-profile.ts <name> [--copy]
 *   node scripts/use-profile.ts --auto        # postinstall: default profile, or
 *                                             # first complete fallback; never fails
 *
 * Since the repo split, tool/catalog content lives in mounted packs:
 *
 *   community/            (submodule lolly-tools/lolly-tools — brand-agnostic tools)
 *   brands/suse/          (submodule lolly-tools/suse-lolly  — PRIVATE: SUSE tools + catalog)
 *   brands/lolly-start/   (parent-owned — the blank starter brand)
 *
 * Everything else in the platform (scripts, shells, deploy, the /tools/ and
 * /catalog/ URL namespaces) still consumes the single repo-root `tools/` and
 * `catalog/` paths. This script materialises those paths as gitignored VIEWS of
 * the active profile (profiles.json): `catalog` becomes a symlink to the brand's
 * catalog, and `tools/` becomes a directory of per-tool symlinks merged from the
 * profile's tool roots (later roots win on id collisions). Writes through the
 * views land in the real pack checkouts, so the edit→commit workflow per
 * submodule is unchanged.
 *
 * --copy (implied by $VERCEL) materialises real copies instead of symlinks —
 * Vercel's function-bundling globs (vercel.json includeFiles) and the tgz
 * archive path are not symlink-safe, and the views are .vercelignore'd, so the
 * Vercel build reconstructs them from the shipped packs at install time.
 *
 * A view is only ever deleted when it is recognisably ours (a symlink, a
 * symlink farm, or a copy carrying the .lolly-view.json marker) — real content
 * at tools/ or catalog/ aborts the switch instead of being clobbered.
 *
 * Brand overlays (`"extends": "community"` in a brand-pack tool.json): instead
 * of the brand pack carrying a whole fork of a community tool, it may carry
 * only the files that differ. The view dir for that id is then COMPOSED — the
 * per-file union of the community base and the overlay, overlay winning on
 * filename collision, recursing one level into subdirs (i18n/, assets/) — and
 * the `extends` marker itself is stripped from the composed tool.json so view
 * consumers (engine, shells, catalog scripts) see a plain tool. A declared
 * overlay whose base is missing fails the build loudly — even under --auto —
 * never a silent partial tool.
 */

import {
  cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync,
  rmSync, statSync, symlinkSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MARKER = '.lolly-view.json';
const STATE_FILE = join(ROOT, '.lolly-profile');
/** The only base pack `extends` may name in v1 (brand overlays of community tools). */
const BASE_PACK = 'community';

/** Overlay (extends) authoring errors are fail-closed even under --auto:
 *  a missing/invalid base must fail the build loudly — postinstall included —
 *  rather than ship a silent partial tool. */
class OverlayError extends Error {}

interface Profile { label?: string; tools: string[]; catalog: string }
interface ProfilesFile { default: string; profiles: Record<string, Profile> }

function loadProfiles(): ProfilesFile {
  return JSON.parse(readFileSync(join(ROOT, 'profiles.json'), 'utf8'));
}

/** All of a profile's content roots exist on disk (a private pack may not). */
function isComplete(p: Profile): boolean {
  return [...p.tools, p.catalog].every((r) => existsSync(join(ROOT, r)));
}

function activeProfile(): string | null {
  try { return readFileSync(STATE_FILE, 'utf8').trim() || null; } catch { return null; }
}

/** lstat that doesn't throw — null when the path doesn't exist. */
function lstatOrNull(p: string) {
  try { return lstatSync(p); } catch { return null; }
}

/** Remove an existing view iff it is recognisably ours; throw otherwise. */
function removeView(path: string, what: string): void {
  const st = lstatOrNull(path);
  if (!st) return;
  if (st.isSymbolicLink()) { unlinkSync(path); return; }
  if (st.isDirectory()) {
    const marker = join(path, MARKER);
    const entries = readdirSync(path);
    const allLinksOrMarker = entries.every(
      (e) => e === MARKER || lstatSync(join(path, e)).isSymbolicLink(),
    );
    if (existsSync(marker) || allLinksOrMarker) {
      rmSync(path, { recursive: true, force: true });
      return;
    }
  }
  throw new Error(
    `refusing to replace ${what} at ${path} — it contains real content, not a profile view. ` +
    `Move it aside (the packs live under community/ and brands/) and re-run.`,
  );
}

interface ToolPlan { src: string; base?: string } // base set ⇒ overlay compose

/** The overlay marker, if the manifest parses and declares one. A malformed
 *  tool.json is NOT an overlay — link the dir plainly and let validate:catalog
 *  report the JSON error with proper context. */
function readExtends(manifestPath: string): string | null {
  try {
    const v = JSON.parse(readFileSync(manifestPath, 'utf8')).extends;
    return typeof v === 'string' && v.length ? v : null;
  } catch { return null; }
}

/**
 * Resolve the profile's tool roots into a per-id plan BEFORE touching the
 * existing views, so an overlay error (missing base, extends declared in
 * community/) aborts with the previous views fully intact — never a
 * half-built farm. Later roots still win on id collisions.
 */
function planTools(profile: Profile): Map<string, ToolPlan> {
  const plan = new Map<string, ToolPlan>();
  for (const root of profile.tools) {
    const rootAbs = join(ROOT, root);
    for (const entry of readdirSync(rootAbs)) {
      if (entry.startsWith('.') || entry === 'node_modules') continue;
      // Underscore-prefixed dirs are pack infrastructure, not tools — e.g.
      // community/_shared/, the canonical helper corpus that sync-shared-hooks.ts
      // copies into tool hooks.js. Linking it into the view would make the
      // catalog validator flag it as a tool with a missing tool.json.
      if (entry.startsWith('_')) continue;
      const src = join(rootAbs, entry);
      if (!statSync(src).isDirectory()) continue; // NOTICE.md, README.md, …
      const extendsTarget = readExtends(join(src, 'tool.json'));
      if (!extendsTarget) { plan.set(entry, { src }); continue; }
      if (root === BASE_PACK) {
        throw new OverlayError(
          `${root}/${entry}/tool.json declares "extends" — community tools are overlay BASES; only a brand pack may declare an overlay`,
        );
      }
      if (extendsTarget !== BASE_PACK) {
        throw new OverlayError(
          `${root}/${entry}/tool.json declares "extends": "${extendsTarget}" — v1 supports only "${BASE_PACK}" as the base pack`,
        );
      }
      const base = join(ROOT, BASE_PACK, entry);
      if (!existsSync(join(base, 'tool.json'))) {
        throw new OverlayError(
          `${root}/${entry} extends "${BASE_PACK}" but ${BASE_PACK}/${entry}/tool.json does not exist — ` +
          `an overlay and its base share the same tool id (ids are permanent contracts); refusing to build a partial tool`,
        );
      }
      plan.set(entry, { src, base });
    }
  }
  return plan;
}

/** Byte offset of the top-level "extends" KEY in raw manifest JSON, or -1.
 *  A one-pass string- and depth-aware scan (not a parse) so a nested member
 *  that happens to be named "extends" — e.g. inside an input's config object —
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
 *  preserving every other byte — so a converted overlay's composed tool.json
 *  stays byte-identical to the pre-conversion fork. The member's line is
 *  located depth-aware (topLevelExtendsKeyOffset — a NESTED key named
 *  "extends" is never touched) and stripped whole; if the author formatted
 *  the member unusually (same line as another member or the opening brace,
 *  last member with no trailing comma), the stringify-equality guard rejects
 *  the strip and we fall back to a canonical re-serialise — still correct
 *  JSON, just reformatted. */
function stripExtendsField(raw: string): string {
  const manifest = JSON.parse(raw);
  if (!('extends' in manifest)) return raw;
  delete manifest.extends;
  const keyAt = topLevelExtendsKeyOffset(raw);
  if (keyAt !== -1) {
    const lineStart = raw.lastIndexOf('\n', keyAt) + 1;
    const nextNl = raw.indexOf('\n', keyAt);
    const stripped = raw.slice(0, lineStart) + (nextNl === -1 ? '' : raw.slice(nextNl + 1));
    try {
      if (JSON.stringify(JSON.parse(stripped)) === JSON.stringify(manifest)) return stripped;
    } catch { /* dangling comma etc. — fall through */ }
  }
  return JSON.stringify(manifest, null, 2) + '\n';
}

/**
 * Materialise one overlay tool dir into the view: the per-file union of
 * base + overlay, overlay winning on filename collision. Recurses ONE level
 * into subdirs (i18n/, assets/); anything deeper is taken wholesale from the
 * winning side. The composed tool.json is always a REAL file with the
 * `extends` marker stripped — edits to IT in the view do not write through
 * (edit the pack source instead); every other composed file keeps the normal
 * write-through symlink behaviour in symlink mode.
 */
function composeToolDir(baseDir: string, overlayDir: string, dest: string, copyMode: boolean, level = 0): void {
  mkdirSync(dest, { recursive: true });
  const names = [...new Set([...readdirSync(baseDir), ...readdirSync(overlayDir)])].sort();
  for (const name of names) {
    if (name.startsWith('.')) continue; // .DS_Store & co — never tool data
    const basePath = join(baseDir, name);
    const overlayPath = join(overlayDir, name);
    const destPath = join(dest, name);
    const inOverlay = existsSync(overlayPath);
    const winner = inOverlay ? overlayPath : basePath;
    if (level === 0 && name === 'tool.json') {
      writeFileSync(destPath, stripExtendsField(readFileSync(winner, 'utf8')));
      continue;
    }
    const bothDirs = inOverlay && existsSync(basePath)
      && statSync(basePath).isDirectory() && statSync(overlayPath).isDirectory();
    if (bothDirs && level === 0) {
      composeToolDir(basePath, overlayPath, destPath, copyMode, level + 1);
      continue;
    }
    if (copyMode) cpSync(winner, destPath, { recursive: true, dereference: true });
    else symlinkSync(relative(dest, winner), destPath, statSync(winner).isDirectory() ? 'dir' : 'file');
  }
}

function buildViews(name: string, profile: Profile, copyMode: boolean): void {
  // Plan first (validates overlay declarations), mutate second — an overlay
  // error must abort while the previous views are still intact.
  const plan = planTools(profile);

  const toolsView = join(ROOT, 'tools');
  const catalogView = join(ROOT, 'catalog');
  removeView(toolsView, 'tools view');
  removeView(catalogView, 'catalog view');

  const marker = JSON.stringify(
    { profile: name, mode: copyMode ? 'copy' : 'symlink', generatedAt: new Date().toISOString() },
    null, 2,
  ) + '\n';

  // catalog → the brand pack's catalog dir.
  const catalogSrc = join(ROOT, profile.catalog);
  if (copyMode) {
    cpSync(catalogSrc, catalogView, { recursive: true, dereference: true });
    writeFileSync(join(catalogView, MARKER), marker);
  } else {
    symlinkSync(relative(ROOT, catalogSrc), catalogView, 'dir');
  }

  // tools/ → merged farm over the profile's tool roots; later roots win
  // (already resolved in the plan). A brand tool declaring
  // `"extends": "community"` COMPOSES with its base instead of replacing it.
  mkdirSync(toolsView);
  writeFileSync(join(toolsView, MARKER), marker);
  let linked = 0;
  let composed = 0;
  for (const [entry, { src, base }] of plan) {
    const dest = join(toolsView, entry);
    if (base) {
      composeToolDir(base, src, dest, copyMode);
      composed++;
    } else if (copyMode) {
      cpSync(src, dest, { recursive: true, dereference: true });
    } else {
      symlinkSync(relative(toolsView, src), dest, 'dir');
    }
    linked++;
  }

  writeFileSync(STATE_FILE, name + '\n');
  console.log(
    `✓ profile "${name}"${profile.label ? ` (${profile.label})` : ''} — ` +
    `${linked} tools from [${profile.tools.join(', ')}]` +
    `${composed ? ` (${composed} composed overlay${composed === 1 ? '' : 's'})` : ''}, ` +
    `catalog → ${profile.catalog}` +
    `${copyMode ? ' (materialised copies)' : ''}`,
  );
}

function show(cfg: ProfilesFile): void {
  const active = activeProfile();
  console.log(`Active profile: ${active ?? '(none — run npm run profile:<name>)'}\n`);
  for (const [name, p] of Object.entries(cfg.profiles)) {
    const flags = [
      name === cfg.default ? 'default' : '',
      isComplete(p) ? '' : 'INCOMPLETE — missing pack(s)',
      name === active ? 'active' : '',
    ].filter(Boolean).join(', ');
    console.log(`  ${name.padEnd(14)} ${p.label ?? ''}${flags ? `  [${flags}]` : ''}`);
    console.log(`  ${''.padEnd(14)} tools: ${p.tools.join(' + ')} · catalog: ${p.catalog}`);
  }
}

function main(): void {
  const cfg = loadProfiles();
  const args = process.argv.slice(2);
  const copyMode = args.includes('--copy') || !!process.env.VERCEL;
  const auto = args.includes('--auto');
  const name = args.find((a) => !a.startsWith('--'));

  if (!name && !auto) { show(cfg); return; }

  let target = name ?? cfg.default;
  if (auto && !name) {
    // Precedence: LOLLY_PROFILE env (explicit, works on Vercel) → the sticky
    // local choice (.lolly-profile) → the default → first complete fallback.
    // Trimmed to match the sticky-file handling (activeProfile trims too): a
    // stray space/newline in a dashboard env var shouldn't become an "unknown
    // profile" build failure. Empty string stays falsy → falls through.
    const envChoice = process.env.LOLLY_PROFILE?.trim();
    const active = activeProfile();
    if (envChoice) {
      target = envChoice;
    } else if (active && cfg.profiles[active] && isComplete(cfg.profiles[active]!)) {
      target = active;
    } else if (!isComplete(cfg.profiles[cfg.default]!)) {
      // On Vercel a silent fallback would DEPLOY the wrong brand: a git-build
      // clones submodules anonymously and skips the private brands/suse pack
      // (update = none), so the default profile is incomplete there. Fail the
      // build loudly instead of shipping the blank brand to production.
      if (process.env.VERCEL) {
        console.error(`✗ use-profile --auto: default profile "${cfg.default}" is incomplete on Vercel — the private brands/suse pack is not present in a git-build.`);
        console.error('  Deploy with `loldev ship` (archive deploy tarballs the local tree, packs included),');
        console.error('  or set LOLLY_PROFILE=lolly-start on the Vercel project to intentionally ship the blank brand.');
        process.exit(1);
      }
      const fallback = Object.entries(cfg.profiles).find(([, p]) => isComplete(p))?.[0];
      if (!fallback) {
        console.warn('⚠ use-profile --auto: no complete profile found (packs not initialised yet?) — skipping.');
        return;
      }
      console.warn(`⚠ default profile "${cfg.default}" is missing pack(s) (private submodule not initialised?) — falling back to "${fallback}".`);
      target = fallback;
    }
  }

  const profile = cfg.profiles[target];
  if (!profile) {
    console.error(`✗ unknown profile "${target}" — known: ${Object.keys(cfg.profiles).join(', ')}`);
    process.exit(1);
  }
  if (!isComplete(profile)) {
    const missing = [...profile.tools, profile.catalog].filter((r) => !existsSync(join(ROOT, r)));
    console.error(`✗ profile "${target}" is missing: ${missing.join(', ')}`);
    console.error(`  (private packs need: git submodule update --init --checkout ${missing[0]})`);
    // On Vercel, fail LOUDLY regardless of how the profile was resolved. The
    // early guard above only covers the incomplete-DEFAULT path; an explicitly
    // set-but-incomplete LOLLY_PROFILE (e.g. `suse` on a git-build where the
    // private pack is absent) would otherwise reach here and exit(0) under
    // --auto, letting the build continue with no tools/catalog views and ship
    // an empty catalog. Same fail-safe as the default-branch guard.
    if (process.env.VERCEL) {
      console.error(`  On Vercel this must not silently continue — deploy via \`loldev ship\` (archive includes the packs), or point LOLLY_PROFILE at a profile whose packs are present.`);
      process.exit(1);
    }
    process.exit(auto ? 0 : 1);
  }
  try {
    buildViews(target, profile, copyMode);
  } catch (e) {
    console.error(`✗ ${(e as Error).message}`);
    // Overlay authoring errors are fail-closed even under --auto (postinstall):
    // a missing base would otherwise ship a silent partial tool.
    process.exit(auto && !(e instanceof OverlayError) ? 0 : 1);
  }
}

main();
