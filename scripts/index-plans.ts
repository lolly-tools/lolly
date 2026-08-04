#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * `plans/README.md` index generator.
 *
 * Run as: node scripts/index-plans.ts   (npm run index:plans)
 *
 * maintainability-2026-07-29.md item 5: "plans/ has 80 files and no index, so a
 * reader cannot tell current from historical."
 *
 * ONE THING THAT AUDIT DID NOT SAY, AND IT CHANGES THE FIX. `plans/` is
 * GITIGNORED (.gitignore:59) — zero files tracked. So a hand-written index there
 * could never be committed, reviewed, or seen by anyone but the person whose
 * working copy it sits in, and nothing could stop it going stale. A checked-in
 * static index was never actually available as an option.
 *
 * So this is a generator instead. THE SCRIPT is tracked (it lives in scripts/,
 * which is in the repo); its OUTPUT is the untracked index. Anyone can rebuild it
 * in a second and it is therefore never stale by more than one command — the only
 * shape of index that works for an ignored directory.
 *
 * Sorted newest-first by mtime, which is the "current vs historical" signal the
 * audit actually wanted; the title comes from each file's first `# ` heading.
 * No CI check, deliberately: CI never sees this directory.
 */

import { readFileSync, readdirSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PLANS = join(ROOT, 'plans');
const OUT = join(PLANS, 'README.md');

/** Recently-touched cutoff, in days — the "probably still live" band. */
const RECENT_DAYS = 21;

interface Plan {
  name: string;
  title: string;
  mtime: Date;
  bytes: number;
}

/** First `# Heading` in the file, else the filename without its extension. */
function titleOf(path: string, name: string): string {
  try {
    for (const line of readFileSync(path, 'utf8').split('\n', 60)) {
      const m = /^#\s+(.+?)\s*$/.exec(line);
      if (m) return (m[1] as string).replace(/\s*\|\s*/g, ' - ');
    }
  } catch { /* unreadable — fall back to the name */ }
  return name.replace(/\.md$/, '');
}

const iso = (d: Date): string => d.toISOString().slice(0, 10);
const kb = (n: number): string => `${Math.max(1, Math.round(n / 1024))}k`;

function collect(dir: string): Plan[] {
  return readdirSync(dir)
    .filter((n) => n.endsWith('.md') && n !== 'README.md')
    .map((name) => {
      const p = join(dir, name);
      const st = statSync(p);
      return { name, title: titleOf(p, name), mtime: st.mtime, bytes: st.size };
    })
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
}

function table(plans: Plan[], base = ''): string {
  return [
    '| Updated | Plan | Title | Size |',
    '|---|---|---|---|',
    ...plans.map((p) => `| ${iso(p.mtime)} | [\`${p.name}\`](${base}${p.name}) | ${p.title} | ${kb(p.bytes)} |`),
  ].join('\n');
}

/** Leading `NN-` ordinal, or Infinity for unnumbered files (they sort last). */
const ordinal = (name: string): number => {
  const m = /^(\d+)-/.exec(name);
  return m ? Number(m[1]) : Number.POSITIVE_INFINITY;
};

export function buildIndex(now: Date): string {
  // Since the 2026-08-04 reorganisation, active plans carry a `NN-` prefix that
  // encodes the reading order (status → strategy → ops → security → provenance →
  // utilities → docs/i18n → brand → editors → engine → rendering → shells →
  // enterprise); historic plans live in archive/ under their original names.
  const plans = collect(PLANS).sort(
    (a, b) => ordinal(a.name) - ordinal(b.name) || a.name.localeCompare(b.name),
  );
  const cutoff = now.getTime() - RECENT_DAYS * 86_400_000;
  const recentCount = plans.filter((p) => p.mtime.getTime() >= cutoff).length;

  const archiveDir = join(PLANS, 'archive');
  const archived = existsSync(archiveDir) ? collect(archiveDir) : [];

  const out = [
    '# `plans/` index',
    '',
    '**Generated — do not hand-edit.** Rebuild with `npm run index:plans`',
    '(`scripts/index-plans.ts`). `plans/` is gitignored, so this file is not committed;',
    'the generator is, which is why the index can never be more than one command stale.',
    '',
    'Sorted by the `NN-` reading-order prefix (status → strategy → ops → security →',
    'provenance → utilities → docs/i18n → brand → editors → engine → rendering →',
    'shells → enterprise). The Updated column is the staleness signal — a plan can be',
    `finished and still recently touched, or dormant and still true. Read the file.`,
    '',
    `## Active — ${plans.length} (${recentCount} touched in the last ${RECENT_DAYS} days)`,
    '',
    plans.length ? table(plans) : '_none_',
  ];

  if (archived.length) {
    out.push('', `## \`archive/\` — ${archived.length}`, '', table(archived, 'archive/'));
  }

  out.push('', `_${plans.length + archived.length} plan(s) indexed._`, '');
  return out.join('\n');
}

function main(): void {
  if (!existsSync(PLANS)) {
    console.error('✗ plans/ does not exist in this checkout — nothing to index.');
    process.exit(1);
  }
  writeFileSync(OUT, buildIndex(new Date()));
  console.log(`plans/README.md regenerated (${collect(PLANS).length} plans).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
