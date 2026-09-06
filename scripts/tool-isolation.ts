// SPDX-License-Identifier: MPL-2.0
/**
 * tool-isolation - decide, from evidence, which tools may run their hooks.js in
 * an isolated Worker by default, and write the manifest `isolate: true` flag.
 *
 *   node scripts/tool-isolation.ts                   # report: realm-bound globals per hooks.js
 *   node scripts/tool-isolation.ts --verify          # + render every tool twice (in-realm, worker
 *                                                    #   thread) through the CLI and compare bytes
 *   node scripts/tool-isolation.ts --verify --write  # + set `isolate: true` where both agree
 *   node scripts/tool-isolation.ts --write --from=<realmDir>,<workerDir>   # reuse two smoke runs
 *
 * Two independent signals, and a tool is flipped only when BOTH hold:
 *   1. STATIC - the hooks reference none of the realm-bound globals a Worker
 *      lacks (`document`, `window`, `DOMParser`, `XMLSerializer`, `Image`,
 *      `getComputedStyle`, `requestAnimationFrame`, `localStorage`, …). This is
 *      conservative on purpose: a `document.createElement('canvas')` in a
 *      never-taken branch still keeps the tool in-realm.
 *   2. VERIFIED - `lolly smoke` renders the tool at manifest defaults once
 *      in-realm and once with `LOLLY_HOOK_WORKER=1` (the worker_threads
 *      executor over the same core the web Worker runs), and the two outputs
 *      are byte-identical. A hook whose result depends on the realm shows up
 *      here even when the static read passed.
 *
 * `isolate: true` is what the web shell's interactive mount already honours
 * (shells/web/src/lib/mount-runtime.ts: manifest opt-in → Worker executor with
 * in-realm fallback), so this script turns the default on per tool, in data,
 * with the evidence in the commit that flipped it. A tool that later grows a
 * DOM dependency fails `--verify` and is flipped back the same way.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join, resolve, dirname, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_ROOTS = ['community', 'brands/suse/tools', 'brands/lolly-start/tools'];

/** Globals a hook may touch in the page realm that a Worker does not have (or
 *  has with different semantics). Matched as identifiers, not substrings. */
export const REALM_BOUND_GLOBALS = [
  'document', 'window', 'DOMParser', 'XMLSerializer', 'Image', 'HTMLElement', 'HTMLCanvasElement',
  'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame', 'localStorage', 'sessionStorage',
  'navigator', 'location', 'history', 'MutationObserver', 'ResizeObserver', 'IntersectionObserver',
  'CanvasRenderingContext2D', 'FontFace', 'matchMedia', 'devicePixelRatio', 'screen',
] as const;

export interface IsolationAnalysis {
  /** Realm-bound globals the hooks reference, with the first line each appears on. */
  realmBound: { name: string; line: number }[];
  clean: boolean;
}

/** Strip comments and string literals so a mention in prose is not a use. */
function codeOnly(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:\\])\/\/[^\n]*/g, (_m, pre) => pre)
    .replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`/g, (m) => m.replace(/[^\n]/g, ' '));
}

export function analyseIsolation(hooksSource: string | null | undefined): IsolationAnalysis {
  const src = codeOnly(hooksSource ?? '');
  const realmBound: { name: string; line: number }[] = [];
  for (const name of REALM_BOUND_GLOBALS) {
    // A bare identifier, not a property (`host.window`, `foo.document`) and not
    // a `typeof`-guarded probe on its own.
    const re = new RegExp(`(?<![\\w$.])${name}(?![\\w$])`);
    const m = re.exec(src);
    if (!m) continue;
    const before = src.slice(Math.max(0, m.index - 12), m.index);
    if (/typeof\s+$/.test(before)) {
      // `typeof document !== 'undefined'` alone is a guard; count it only when
      // the same name is also used unguarded elsewhere.
      const again = new RegExp(`(?<![\\w$.])${name}(?![\\w$])`, 'g');
      let unguarded = false;
      let mm: RegExpExecArray | null;
      while ((mm = again.exec(src))) {
        if (!/typeof\s+$/.test(src.slice(Math.max(0, mm.index - 12), mm.index))) { unguarded = true; break; }
      }
      if (!unguarded) continue;
    }
    realmBound.push({ name, line: src.slice(0, m.index).split('\n').length });
  }
  return { realmBound, clean: realmBound.length === 0 };
}

function toolDirs(root: string): string[] {
  const abs = resolve(ROOT, root);
  if (!existsSync(abs)) return [];
  return readdirSync(abs)
    .filter((d) => !d.startsWith('_') && !d.startsWith('.') && statSync(join(abs, d)).isDirectory() && existsSync(join(abs, d, 'tool.json')))
    .map((d) => join(abs, d));
}

/** Run `lolly smoke` once and return the output directory it names. */
function smoke(env: NodeJS.ProcessEnv): string {
  const r = spawnSync(process.execPath, ['shells/cli/bin/lolly.ts', 'smoke'], { cwd: ROOT, env: { ...process.env, ...env }, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const out = `${r.stdout}\n${r.stderr}`;
  const m = /outputs in (\S+)/.exec(out);
  if (!m) throw new Error(`smoke did not report an output directory:\n${out.slice(-2000)}`);
  return m[1]!;
}

/** Tools whose in-realm and worker-thread renders are byte-identical. */
export function verifyIdentical(from?: [string, string]): { identical: Set<string>; differed: Set<string>; missing: Set<string> } {
  // `--from=<realmDir>,<workerDir>` reuses two finished `lolly smoke` output
  // directories instead of rendering again (CI keeps them as artefacts).
  const a = from ? from[0] : smoke({});
  const b = from ? from[1] : smoke({ LOLLY_HOOK_WORKER: '1' });
  const identical = new Set<string>();
  const differed = new Set<string>();
  const missing = new Set<string>();
  for (const f of readdirSync(a)) {
    const id = basename(f).replace(/\.[^.]+$/, '');
    const other = join(b, f);
    if (!existsSync(other)) { missing.add(id); continue; }
    if (readFileSync(join(a, f)).equals(readFileSync(other))) identical.add(id); else differed.add(id);
  }
  return { identical, differed, missing };
}

/** Set or clear `isolate` textually, next to `hooks`, keeping the file's formatting. */
export function rewriteIsolate(raw: string, isolate: boolean): string {
  let out = raw.replace(/\n[ \t]*"isolate"\s*:\s*(true|false)[ \t]*,?/g, '');
  if (!isolate) return out;
  const hooksLine = /(\n[ \t]*)"hooks"\s*:/.exec(out);
  if (!hooksLine) throw new Error('manifest declares no hooks');
  out = out.replace(hooksLine[0], `${hooksLine[1]}"isolate": true,${hooksLine[0]}`);
  return out;
}

export function run(argv = process.argv.slice(2)): number {
  const write = argv.includes('--write');
  const verify = argv.includes('--verify') || write;
  const rootsArg = argv.find((a) => a.startsWith('--roots='))?.slice('--roots='.length);
  const roots = rootsArg ? rootsArg.split(',') : DEFAULT_ROOTS;
  const fromArg = argv.find((a) => a.startsWith('--from='))?.slice('--from='.length);
  const from = fromArg ? (fromArg.split(',') as [string, string]) : undefined;
  const verdicts = verify || from ? verifyIdentical(from) : null;
  let flipped = 0;
  let cleared = 0;
  for (const root of roots) {
    for (const dir of toolDirs(root)) {
      const manifestPath = join(dir, 'tool.json');
      const raw = readFileSync(manifestPath, 'utf8');
      const manifest = JSON.parse(raw) as { id: string; hooks?: unknown; isolate?: boolean };
      if (!manifest.hooks) continue;
      const hooksPath = join(dir, 'hooks.js');
      const { realmBound, clean } = analyseIsolation(existsSync(hooksPath) ? readFileSync(hooksPath, 'utf8') : '');
      const verified = verdicts ? verdicts.identical.has(manifest.id) : null;
      const eligible = clean && verified === true;
      const state = manifest.isolate === true;
      const mark = eligible === state ? ' ' : (eligible ? '+' : (state ? '-' : ' '));
      const why = clean ? '' : ` realm-bound: ${realmBound.map((r) => `${r.name}@${r.line}`).join(' ')}`;
      const ver = verdicts ? (verified ? ' verified' : verdicts.differed.has(manifest.id) ? ' DIFFERS' : ' unrendered') : '';
      console.log(`${mark} ${manifest.id.padEnd(24)} isolate=${state}${ver}${why}`);
      if (write && eligible !== state) {
        const next = rewriteIsolate(raw, eligible);
        JSON.parse(next);
        writeFileSync(manifestPath, next);
        if (eligible) flipped++; else cleared++;
      }
    }
  }
  if (write) console.log(`${flipped} tool(s) now isolate by default, ${cleared} cleared`);
  return 0;
}

const invoked = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invoked) process.exitCode = run();
