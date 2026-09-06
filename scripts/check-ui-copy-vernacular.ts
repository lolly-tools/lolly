// SPDX-License-Identifier: MPL-2.0
/**
 * Ratcheting vernacular gate for UI COPY - the strings a person actually reads
 * in the app: every `t('…')` / `tRaw('…')` literal in the web shell, and the
 * `name`, `label`, `help`, `description` and option `label` fields of every
 * tool manifest. The docs gate (check-docs-vernacular.ts) and the comment gate
 * (check-code-comment-vernacular.ts) already hold prose and comments to the
 * plain-language rule; this closes the gap the review found in between - the
 * chrome said "sessions land here" while the docs gate banned exactly that.
 *
 * Same shape as the comment gate: a per-file baseline that only goes DOWN
 * (scripts/vernacular-ui-baseline.json). A new file must be clean; a file that
 * improves lowers its baseline with --write; a file that regresses fails.
 *
 *   node scripts/check-ui-copy-vernacular.ts          # check
 *   node scripts/check-ui-copy-vernacular.ts --write  # lock the current counts
 */
import { readFileSync, readdirSync, statSync, existsSync, writeFileSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { BANNED_PHRASES } from './check-docs-vernacular.ts';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const BASELINE_PATH = join(ROOT, 'scripts/vernacular-ui-baseline.json');
const EM_DASH = /—/;
const COPY_FIELDS = new Set(['name', 'label', 'help', 'description', 'placeholder', 'a11yLabel']);

export interface Finding { file: string; text: string; what: string }

function findingsIn(text: string): string[] {
  const out: string[] = [];
  if (EM_DASH.test(text)) out.push('em dash');
  for (const { what, re } of BANNED_PHRASES) if (re.test(text)) out.push(what);
  return out;
}

/** Every t()/tRaw() single- or double-quoted literal in a TS source. */
export function uiLiterals(src: string): string[] {
  const out: string[] = [];
  const re = /\bt(?:Raw)?\(\s*(?:'((?:\\.|[^'\\\n])*)'|"((?:\\.|[^"\\\n])*)")/g;
  for (const m of src.matchAll(re)) out.push((m[1] ?? m[2] ?? '').replace(/\\(.)/g, '$1'));
  return out;
}

/** Every copy field value in a manifest, recursively (inputs, options, sections…). */
export function manifestCopy(value: unknown, out: string[] = []): string[] {
  if (Array.isArray(value)) { for (const v of value) manifestCopy(v, out); return out; }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (COPY_FIELDS.has(k) && typeof v === 'string') out.push(v);
      else manifestCopy(v, out);
    }
  }
  return out;
}

function walk(dir: string, pick: (f: string) => boolean, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const abs = join(dir, name);
    const st = statSync(abs);
    if (st.isDirectory()) walk(abs, pick, out);
    else if (pick(abs)) out.push(abs);
  }
  return out;
}

export function scan(): Map<string, Finding[]> {
  const byFile = new Map<string, Finding[]>();
  const add = (file: string, text: string, whats: string[]): void => {
    if (!whats.length) return;
    const rel = relative(ROOT, file).replaceAll('\\', '/');
    const list = byFile.get(rel) ?? [];
    for (const what of whats) list.push({ file: rel, text, what });
    byFile.set(rel, list);
  };
  for (const f of walk(join(ROOT, 'shells/web/src'), (p) => p.endsWith('.ts') && !p.endsWith('.test.ts'))) {
    for (const lit of uiLiterals(readFileSync(f, 'utf8'))) add(f, lit, findingsIn(lit));
  }
  const roots = ['community', 'brands/suse/tools', 'brands/lolly-start/tools'];
  for (const root of roots) {
    for (const f of walk(join(ROOT, root), (p) => p.endsWith('/tool.json'))) {
      let doc: unknown;
      try { doc = JSON.parse(readFileSync(f, 'utf8')); } catch { continue; }
      for (const text of manifestCopy(doc)) add(f, text, findingsIn(text));
    }
  }
  return byFile;
}

export function counts(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [file, list] of scan()) out[file] = list.length;
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}

export function drift(): { over: { file: string; was: number; now: number }[]; fresh: { file: string; now: number }[]; under: { file: string; was: number; now: number }[] } {
  const baseline: Record<string, number> = existsSync(BASELINE_PATH) ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) : {};
  const now = counts();
  const over: { file: string; was: number; now: number }[] = [];
  const fresh: { file: string; now: number }[] = [];
  const under: { file: string; was: number; now: number }[] = [];
  for (const [file, n] of Object.entries(now)) {
    const was = baseline[file];
    if (was === undefined) fresh.push({ file, now: n });
    else if (n > was) over.push({ file, was, now: n });
    else if (n < was) under.push({ file, was, now: n });
  }
  // A baseline file that is not on disk was not scanned, so it is not an
  // improvement: brands/suse is a private submodule a public clone and CI never
  // mount, and its two entries must not read as "better" there.
  for (const [file, was] of Object.entries(baseline)) {
    if (!(file in now) && was > 0 && existsSync(join(ROOT, file))) under.push({ file, was, now: 0 });
  }
  return { over, fresh, under };
}

if (import.meta.url === new URL(process.argv[1] ?? '', 'file://').href) {
  if (process.argv.includes('--write')) {
    writeFileSync(BASELINE_PATH, JSON.stringify(counts(), null, 2) + '\n');
    console.log(`wrote ${BASELINE_PATH}`);
  } else {
    const d = drift();
    for (const x of d.over) console.error(`ROSE   ${x.file}: ${x.was} → ${x.now}`);
    for (const x of d.fresh) console.error(`NEW    ${x.file}: ${x.now}`);
    for (const x of d.under) console.log(`better ${x.file}: ${x.was} → ${x.now} (run --write to lock)`);
    if (d.over.length || d.fresh.length || d.under.length) process.exitCode = 1;
    else console.log('ui copy vernacular: no drift');
  }
}
