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

function buildViews(name: string, profile: Profile, copyMode: boolean): void {
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

  // tools/ → merged farm over the profile's tool roots; later roots win.
  mkdirSync(toolsView);
  writeFileSync(join(toolsView, MARKER), marker);
  let linked = 0;
  for (const root of profile.tools) {
    const rootAbs = join(ROOT, root);
    for (const entry of readdirSync(rootAbs)) {
      if (entry.startsWith('.') || entry === 'node_modules') continue;
      const src = join(rootAbs, entry);
      if (!statSync(src).isDirectory()) continue; // NOTICE.md, README.md, …
      const dest = join(toolsView, entry);
      if (lstatOrNull(dest)) rmSync(dest, { recursive: true, force: true });
      if (copyMode) cpSync(src, dest, { recursive: true, dereference: true });
      else symlinkSync(relative(toolsView, src), dest, 'dir');
      linked++;
    }
  }

  writeFileSync(STATE_FILE, name + '\n');
  console.log(
    `✓ profile "${name}"${profile.label ? ` (${profile.label})` : ''} — ` +
    `${linked} tools from [${profile.tools.join(', ')}], catalog → ${profile.catalog}` +
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
    const envChoice = process.env.LOLLY_PROFILE;
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
    process.exit(auto ? 0 : 1);
  }
  try {
    buildViews(target, profile, copyMode);
  } catch (e) {
    console.error(`✗ ${(e as Error).message}`);
    process.exit(auto ? 0 : 1);
  }
}

main();
