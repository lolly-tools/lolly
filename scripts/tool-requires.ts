// SPDX-License-Identifier: MPL-2.0
/**
 * tool-requires - compute a tool's `requires` (the optional host.* APIs its
 * hooks call WITHOUT feature-detecting them) and the engine floor those APIs
 * imply, and optionally write both back into tool.json.
 *
 *   node scripts/tool-requires.ts                 # report every tool under the given roots
 *   node scripts/tool-requires.ts --write         # rewrite `requires` + raise `engineVersion` floors
 *   node scripts/tool-requires.ts --roots community,brands/suse/tools,brands/lolly-start/tools
 *
 * Why static: hooks.js is data with no imports, so the only honest signal of
 * what a tool needs is the text of its calls. An API counts as REQUIRED when
 * the hooks reach into it (`host.text.toPath(`) and nowhere in the file guard
 * it (`if (host.text)`, `host.text?.`, `typeof host.text`, `'text' in host`,
 * `host.text && …`, `!host.text`). A guarded API is a progressive enhancement
 * and must NOT be listed - the runtime refuses to mount a tool whose
 * `requires` a shell cannot meet, so listing a guarded API would take a tool
 * off the CLI that runs fine there.
 *
 * The engine floor: each optional API first appeared in one ENGINE_VERSION
 * minor, recorded in engine/CHANGELOG.md (`1.NN.0 - … host.<api> …`). A tool
 * that requires `host.audio` on an engine older than the one that added it
 * would be refused by the API check, but only after the whole tool was
 * fetched; `engineVersion` refuses it before that, so the floor is raised to
 * the newest introduction among its `requires`. Floors are only ever raised.
 *
 * `validate:catalog` calls `analyseRequires` and warns on drift, so this file
 * is both the generator and the single source of the rule.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { HOST_V1_OPTIONAL_APIS, type HostApiName } from '../packages/core/src/host-v1/apis.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_ROOTS = ['community', 'brands/suse/tools', 'brands/lolly-start/tools'];

export interface RequiresAnalysis {
  /** Every optional API the hooks mention at all. */
  used: HostApiName[];
  /** The subset the hooks feature-detect somewhere. */
  guarded: HostApiName[];
  /** used minus guarded - what `requires` should say. */
  required: HostApiName[];
}

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Static read of one hooks.js: which optional host APIs it uses, and which it guards. */
/**
 * Comments are prose, not calls. A hooks.js header that explains "host.text.toPath
 * emits absolute segments" must not count as a reach into host.text - it is exactly
 * how the first pass of this analyser over-listed nine tools (2026-09-06). Block
 * comments go first; a line comment is one that starts a line or follows code, so a
 * `//` inside a URL string (`'https://…'`) is left alone.
 */
export function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
}

export function analyseRequires(hooksSource: string | null | undefined): RequiresAnalysis {
  const src = stripComments(hooksSource ?? '');
  const used: HostApiName[] = [];
  const guarded: HostApiName[] = [];
  for (const api of HOST_V1_OPTIONAL_APIS) {
    const a = escapeRe(api);
    // A real use reaches INTO the API (a member access or call), not merely names it.
    const use = new RegExp(`\\bhost\\.${a}\\s*(\\?\\.|[.(\\[])`);
    if (!use.test(src)) continue;
    used.push(api);
    // A guard is any place the bare API (no member access behind it) is read as a
    // value: tested, compared, typeof'd, optional-chained, or assigned to a local
    // that the hooks then check. `host && host.tokens ? host.tokens : null` and
    // `if (typeof host !== 'undefined' && host && host.tokens) {` are the two
    // shapes the shipped tools actually use.
    const bare = `\\bhost\\.${a}\\b(?!\\s*[.(\\[])`;
    const guards = [
      `\\bhost\\.${a}\\s*\\?\\.`,                 // host.text?.toPath
      `\\btypeof\\s+host\\.${a}\\b`,              // typeof host.text
      `\\bif\\s*\\(\\s*!?\\s*host\\.${a}\\s*[)&|]`, // if (host.text) / if (!host.text) / if (host.text && …)
      `${bare}\\s*(&&|\\|\\||\\?\\?|\\?|\\)|:|,|;|$)`, // host.text && … / host.text ? … / … && host.text) …
      `!\\s*${bare}`,                                // !host.text
      `['"]${a}['"]\\s+in\\s+host\\b`,            // 'text' in host
      `\\bhost\\.${a}\\s*(===|!==|==|!=)`,        // host.text === undefined
      `=\\s*${bare}`,                                // const text = host.text (then checked)
    ];
    if (guards.some((g) => new RegExp(g, 'm').test(src))) guarded.push(api);
  }
  return { used, guarded, required: used.filter((u) => !guarded.includes(u)) };
}

/** The ENGINE_VERSION minor that first mentioned `host.<api>`, from the changelog. */
export function apiIntroductions(changelog: string): Map<HostApiName, string> {
  const intro = new Map<HostApiName, string>();
  let current: string | null = null;
  const cmp = (a: string, b: string): number => {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
    return 0;
  };
  for (const line of changelog.split('\n')) {
    const m = /^(\d+\.\d+\.\d+)\s+-\s/.exec(line) ?? /^## (\d+\.\d+\.\d+)/.exec(line);
    if (m) current = m[1]!;
    if (!current) continue;
    for (const api of HOST_V1_OPTIONAL_APIS) {
      if (new RegExp(`\\bhost\\.${escapeRe(api)}\\b`).test(line)) {
        const prev = intro.get(api);
        if (!prev || cmp(current, prev) < 0) intro.set(api, current);
      }
    }
  }
  return intro;
}

/** The floor a set of required APIs implies (null when none carries a known introduction). */
export function impliedFloor(required: readonly HostApiName[], intro: Map<HostApiName, string>): string | null {
  let best: string | null = null;
  for (const api of required) {
    const v = intro.get(api);
    if (!v) continue;
    if (!best || compareVersions(v, best) > 0) best = v;
  }
  return best;
}

export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  return 0;
}

/** The lower bound a manifest range states, for the `^1.N.0` / `>=1.N.0` shapes tools use. */
export function rangeFloor(range: string | undefined): string | null {
  if (!range) return null;
  const m = /^(?:\^|>=|~)?\s*(\d+\.\d+\.\d+)/.exec(range.trim());
  return m ? m[1]! : null;
}

interface ToolRow {
  dir: string;
  id: string;
  requires: HostApiName[];
  declared: string[];
  engineVersion: string | undefined;
  floor: string | null;
  changed: boolean;
}

function toolDirs(root: string): string[] {
  const abs = resolve(ROOT, root);
  if (!existsSync(abs)) return [];
  return readdirSync(abs)
    .filter((d) => !d.startsWith('_') && !d.startsWith('.') && statSync(join(abs, d)).isDirectory() && existsSync(join(abs, d, 'tool.json')))
    .map((d) => join(abs, d));
}

/**
 * Rewrite `requires` and `engineVersion` in place, textually, so the rest of
 * the file keeps its authored formatting (inline arrays, key order, spacing).
 * `requires` goes on the line after `engineVersion`.
 */
export function rewriteManifestText(raw: string, requires: readonly string[], engineVersion: string | null): string {
  let out = raw;
  // Drop any existing requires line/block (single-line or multi-line array).
  out = out.replace(/\n[ \t]*"requires"\s*:\s*\[[^\]]*\][ \t]*,?/g, '');
  const evLine = /(\n[ \t]*)"engineVersion"\s*:\s*"([^"]*)"([ \t]*,?)/.exec(out);
  if (!evLine) throw new Error('manifest has no engineVersion line');
  const indent = evLine[1]!;
  const ev = engineVersion ?? evLine[2]!;
  const req = requires.length ? `${indent}"requires": [${requires.map((r) => `"${r}"`).join(', ')}],` : '';
  const replaced = `${indent}"engineVersion": "${ev}",${req}`;
  // The engineVersion line must keep a trailing comma: it is never the last key
  // (status/inputs follow). If it had none, the next line would have to absorb one.
  if (!evLine[3]!.includes(',')) throw new Error('engineVersion is the last key; cannot insert requires after it');
  out = out.replace(evLine[0], replaced);
  return out;
}

export function run(argv = process.argv.slice(2)): number {
  const write = argv.includes('--write');
  const rootsArg = argv.find((a) => a.startsWith('--roots='))?.slice('--roots='.length);
  const roots = rootsArg ? rootsArg.split(',') : DEFAULT_ROOTS;
  const intro = apiIntroductions(readFileSync(join(ROOT, 'engine/CHANGELOG.md'), 'utf8'));
  const rows: ToolRow[] = [];
  for (const root of roots) {
    for (const dir of toolDirs(root)) {
      const manifestPath = join(dir, 'tool.json');
      const raw = readFileSync(manifestPath, 'utf8');
      const manifest = JSON.parse(raw) as Record<string, unknown>;
      const hooksPath = join(dir, 'hooks.js');
      const hooks = existsSync(hooksPath) ? readFileSync(hooksPath, 'utf8') : '';
      const { required } = analyseRequires(hooks);
      const declared = Array.isArray(manifest.requires) ? (manifest.requires as string[]) : [];
      const engineVersion = typeof manifest.engineVersion === 'string' ? manifest.engineVersion : undefined;
      const floor = impliedFloor(required, intro);
      const currentFloor = rangeFloor(engineVersion);
      const raise = floor && (!currentFloor || compareVersions(floor, currentFloor) > 0);
      const sameRequires = declared.length === required.length && declared.every((d, i) => d === required[i]);
      const changed = !sameRequires || !!raise;
      rows.push({ dir, id: String(manifest.id), requires: required, declared, engineVersion, floor, changed });
      if (write && changed) {
        const next = rewriteManifestText(raw, required, raise ? `^${floor}` : null);
        JSON.parse(next); // never write a manifest that no longer parses
        writeFileSync(manifestPath, next);
      }
    }
  }
  const changed = rows.filter((r) => r.changed);
  for (const r of rows) {
    const mark = r.changed ? (write ? 'W' : '!') : ' ';
    console.log(`${mark} ${r.id.padEnd(24)} requires=[${r.requires.join(',')}]${r.declared.length && !r.changed ? '' : ` declared=[${r.declared.join(',')}]`} engine=${r.engineVersion ?? '-'}${r.floor ? ` floor=${r.floor}` : ''}`);
  }
  console.log(`${rows.length} tools, ${changed.length} ${write ? 'rewritten' : 'out of date'}${write ? '' : changed.length ? ' (run with --write)' : ''}`);
  return 0;
}

const invoked = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invoked) process.exitCode = run();
