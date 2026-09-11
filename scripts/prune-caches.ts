// SPDX-License-Identifier: MPL-2.0
/**
 * Prune regenerable build caches when the disk runs low.
 *
 * The repo and its toolchain leave large caches behind that nothing cleans up:
 * the two Tauri shells' Rust `target/` trees (6 GB and 5 GB on 2026-09-11), the
 * Playwright browser cache, Xcode's DerivedData, the MCP service's own browser
 * install, and unreferenced packages in the pnpm store. None of it is tracked by
 * git and all of it comes back on the next build or install. On 2026-09-11 they
 * had filled the disk to 2 GB free and blocked a clone.
 *
 *   node scripts/prune-caches.ts                     # report sizes, delete nothing
 *   node scripts/prune-caches.ts --yes               # delete every candidate
 *   node scripts/prune-caches.ts --yes --when-below=10   # only if under 10 GiB free
 *   node scripts/prune-caches.ts --yes --only=tauri-desktop-target,playwright
 *   node scripts/prune-caches.ts --quiet             # print nothing unless it acts
 *
 * `--when-below` is what makes it safe to run automatically: the Claude Code
 * SessionStart hook in .claude/settings.json runs it with `--yes --when-below=10
 * --quiet`, so a healthy disk is never touched and a full one is cleared before
 * the first command needs room. Cost of a prune is rebuild time, never data:
 * a Rust rebuild is tens of minutes, a browser re-download a minute.
 *
 * What is deliberately NOT on the list: `shells/web/dist` (the RPM sources are
 * built from it), `node_modules` (an install, not a cache), the git object
 * stores, and anything under `~/Build/lolly-archives`.
 */
import { existsSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const HOME = homedir();

interface Candidate {
  id: string;
  path?: string;
  /** A command instead of a path: pnpm's own prune. */
  command?: string[];
  why: string;
}

const CANDIDATES: Candidate[] = [
  { id: 'tauri-desktop-target', path: join(ROOT, 'shells/tauri-desktop/src-tauri/target'), why: 'Rust build tree of the desktop shell; the next desktop build recompiles it' },
  { id: 'tauri-mobile-target', path: join(ROOT, 'shells/tauri-mobile/src-tauri/target'), why: 'Rust build tree of the mobile shell; the next mobile build recompiles it' },
  { id: 'playwright', path: join(HOME, 'Library/Caches/ms-playwright'), why: 'browser binaries; `pnpm exec playwright install chromium` re-downloads on demand' },
  { id: 'xcode-derived-data', path: join(HOME, 'Library/Developer/Xcode/DerivedData'), why: 'Xcode intermediates; rebuilt on the next iOS build' },
  { id: 'mcp-browsers', path: join(ROOT, 'services/mcp/.browsers'), why: 'the MCP service\'s own Playwright install; `pnpm run install:browser` restores it' },
  { id: 'pnpm-store', command: ['pnpm', 'store', 'prune'], why: 'packages no project references any more; a later install re-fetches what it needs' },
];

function args(): { yes: boolean; whenBelowGiB: number | null; only: Set<string> | null; quiet: boolean } {
  const a = process.argv.slice(2);
  const get = (k: string): string | undefined => a.find(x => x.startsWith(`--${k}=`))?.slice(k.length + 3);
  const below = get('when-below');
  return {
    yes: a.includes('--yes'),
    whenBelowGiB: below ? Number(below) : null,
    only: get('only') ? new Set(get('only')!.split(',').map(s => s.trim()).filter(Boolean)) : null,
    quiet: a.includes('--quiet'),
  };
}

function freeGiB(path: string): number {
  // `df -k` is the same on macOS and Linux: the fourth column is available KiB.
  const out = execFileSync('df', ['-k', path], { encoding: 'utf8' }).trim().split('\n').pop() ?? '';
  const cols = out.split(/\s+/);
  return Number(cols[3] ?? 0) / (1024 * 1024);
}

function sizeGiB(path: string): number {
  if (!existsSync(path)) return 0;
  try {
    const out = execFileSync('du', ['-sk', path], { encoding: 'utf8' }).trim().split(/\s+/)[0];
    return Number(out ?? 0) / (1024 * 1024);
  } catch { return 0; }
}

function gb(n: number): string { return `${n.toFixed(1)} GiB`; }

const opts = args();
const free = freeGiB(ROOT);
const wanted = CANDIDATES.filter(c => !opts.only || opts.only.has(c.id));
const present = wanted.filter(c => c.command || (c.path && existsSync(c.path)));

if (opts.whenBelowGiB !== null && free >= opts.whenBelowGiB) {
  if (!opts.quiet) console.log(`prune-caches: ${gb(free)} free, threshold ${gb(opts.whenBelowGiB)}; nothing to do`);
  process.exit(0);
}

if (!present.length) {
  if (!opts.quiet) console.log(`prune-caches: ${gb(free)} free; no cache candidates present`);
  process.exit(0);
}

let reclaimed = 0;
console.log(`prune-caches: ${gb(free)} free${opts.yes ? '' : ' (dry run - pass --yes to delete)'}`);
for (const c of present) {
  if (c.path) {
    const size = sizeGiB(c.path);
    console.log(`  ${opts.yes ? 'rm ' : '   '}${c.id.padEnd(22)} ${gb(size).padStart(9)}  ${c.path}`);
    if (opts.yes) { rmSync(c.path, { recursive: true, force: true }); reclaimed += size; }
  } else if (c.command) {
    console.log(`  ${opts.yes ? 'run' : '   '}${c.id.padEnd(22)} ${''.padStart(9)}  ${c.command.join(' ')}`);
    if (opts.yes) {
      try { execFileSync(c.command[0]!, c.command.slice(1), { stdio: 'pipe' }); } catch { console.log('      (pnpm store prune failed; continuing)'); }
    }
  }
}
if (opts.yes) console.log(`prune-caches: reclaimed about ${gb(reclaimed)} of directories; ${gb(freeGiB(ROOT))} free now`);
else console.log('prune-caches: each entry is regenerable build output; see the header of scripts/prune-caches.ts');
