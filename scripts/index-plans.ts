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
 * GITIGNORED (.gitignore:59) - zero files tracked. So a hand-written index there
 * could never be committed, reviewed, or seen by anyone but the person whose
 * working copy it sits in, and nothing could stop it going stale. A checked-in
 * static index was never actually available as an option.
 *
 * So this is a generator instead. THE SCRIPT is tracked (it lives in scripts/,
 * which is in the repo); its OUTPUT is the untracked index. Anyone can rebuild it
 * in a second and it is therefore never stale by more than one command - the only
 * kind of index that works for an ignored directory.
 *
 * Top-level plans follow their numbered reading order. The updated date remains
 * visible as a staleness signal; the title comes from each file's first `# `
 * heading. No CI check, deliberately: CI never sees this directory.
 */

import { readFileSync, readdirSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PLANS = join(ROOT, 'plans');
const OUT = join(PLANS, 'README.md');

/** Recently-touched cutoff, in days - the "probably still live" band. */
const RECENT_DAYS = 21;

interface Plan {
  name: string;
  title: string;
  status: string;
  bucket: 'active' | 'followup' | 'closed' | 'reference';
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
  } catch { /* unreadable - fall back to the name */ }
  return name.replace(/\.md$/, '');
}

function statusOf(path: string): Pick<Plan, 'status' | 'bucket'> {
  try {
    const lines = readFileSync(path, 'utf8').split('\n', 80);
    const cleanLine = (line: string): string => line.trim().replace(/^>\s*/, '');
    const start = lines.findIndex(line => /^(?:\*\*)?Status:/i.test(cleanLine(line)));
    if (start < 0) return { status: 'Unstated', bucket: 'reference' };
    let end = start + 1;
    while (end < lines.length && cleanLine(lines[end]!).length > 0) {
      const continuation = cleanLine(lines[end]!);
      // Wrapped prose belongs to the status paragraph. A new labelled metadata
      // field (`**Owner:**`, `Companion:`, and so on) does not.
      if (/^(?:\*\*)?[A-Z][A-Za-z /-]{1,30}:(?:\*\*)?(?:\s|$)/.test(continuation)) break;
      end += 1;
    }
    const paragraph = lines.slice(start, end).map(cleanLine).join(' ');
    // Historical plans use all three forms: `**Status:** value`,
    // `**Status: value**`, and `Status: **value**`.
    const raw = paragraph
      .replace(/^\*\*Status:\*\*\s*/i, '')
      .replace(/^\*\*Status:\s*/i, '')
      .replace(/^Status:\s*/i, '')
      .replace(/\*\*/g, '')
      .trim();
    if (!raw) return { status: 'Unstated', bucket: 'reference' };
    const status = raw.length > 240 ? `${raw.slice(0, 237).trimEnd()}…` : raw;
    if (/^REFERENCE\b/i.test(raw)) return { status, bucket: 'reference' };
    // A closed tracker can explain which formerly open list replaced it. Do not let
    // that historical wording pull an explicitly CLOSED document back into follow-up.
    if (/^CLOSED\b/i.test(raw)) return { status, bucket: 'closed' };
    // Do not turn "nothing is built" into a completion signal merely because it
    // contains the word "built". Keep the original text for display and for the
    // open-state scan; remove only these explicit negations before classifying done.
    const positive = raw.replace(
      /\bNOTHING\b[^.;]{0,80}\b(?:BUILT|SHIPPED|EXECUTED|IMPLEMENTED|DONE)\b|\bNOT\s+(?:IS\s+)?(?:BUILT|SHIPPED|EXECUTED|IMPLEMENTED|DONE)\b/gi,
      '',
    );
    const done = /\b(COMPLETE|COMPLETED|DONE|IMPLEMENTED|EXECUTED|DECIDED|BUILT|SHIPPED|SHIPPING|LANDED)\b/i.test(positive);
    const actionable = raw.replace(/\b(?:NO|NOTHING)\s+(?:IS\s+)?(?:OPEN|PENDING|REMAINING)\b/gi, '');
    const open = /\b(IN EXECUTION|IN PROGRESS|PROPOSED|PLANNED|PLAN(?!['’]S)|OPEN|PENDING|PARTIAL|PARTLY|EXPANDED|NOT STARTED|NOT YET|GREENLIT|OWED|NEXT|FOLLOW-?UPS?|REMAINING|REMAINS|EXCEPT)\b/i.test(actionable);
    const bucket = done && open ? 'followup' : done ? 'closed' : open ? 'active' : 'reference';
    return { status, bucket };
  } catch {
    return { status: 'Unreadable', bucket: 'reference' };
  }
}

const iso = (d: Date): string => d.toISOString().slice(0, 10);
const kb = (n: number): string => `${Math.max(1, Math.round(n / 1024))}k`;

function collect(dir: string): Plan[] {
  return readdirSync(dir)
    .filter((n) => n.endsWith('.md') && n !== 'README.md')
    .map((name) => {
      const p = join(dir, name);
      const st = statSync(p);
      return { name, title: titleOf(p, name), ...statusOf(p), mtime: st.mtime, bytes: st.size };
    })
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
}

function table(plans: Plan[], base = ''): string {
  return [
    '| Updated | Plan | Status | Title | Size |',
    '|---|---|---|---|---|',
    ...plans.map((p) => `| ${iso(p.mtime)} | [\`${p.name}\`](${base}${p.name}) | ${p.status.replace(/\|/g, '\\|')} | ${p.title} | ${kb(p.bytes)} |`),
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
    '**Generated - do not hand-edit.** Rebuild with `npm run index:plans`',
    '(`scripts/index-plans.ts`). `plans/` is gitignored, so this file is not committed;',
    'the generator is, which is why the index can never be more than one command stale.',
    '',
    'Sorted by the `NN-` reading-order prefix (status → strategy → ops → security →',
    'provenance → utilities → docs/i18n → brand → editors → engine → rendering →',
    'shells → enterprise). The Updated column is the staleness signal - a plan can be',
    `finished and still recently touched, or dormant and still true. Read the file.`,
    '',
    'A status in the file, not its directory or modification date, decides which table it appears in.',
    '“Implemented with follow-ups” means the code wave is done but named acceptance, owner or release work remains.',
  ];

  const sections: Array<[Plan['bucket'], string]> = [
    ['active', 'Active / planned'],
    ['followup', 'Implemented with follow-ups'],
    ['closed', 'Closed'],
    ['reference', 'Reference or status unstated'],
  ];
  for (const [bucket, label] of sections) {
    const rows = plans.filter(plan => plan.bucket === bucket);
    out.push('', `## ${label} - ${rows.length}`, '', rows.length ? table(rows) : '_none_');
  }

  if (archived.length) {
    out.push('', `## \`archive/\` - ${archived.length}`, '', table(archived, 'archive/'));
  }

  out.push('', `_Top level: ${plans.length} plan(s), ${recentCount} touched in the last ${RECENT_DAYS} days. Total with archive: ${plans.length + archived.length}._`, '');
  return out.join('\n');
}

function main(): void {
  if (!existsSync(PLANS)) {
    console.error('✗ plans/ does not exist in this checkout - nothing to index.');
    process.exit(1);
  }
  writeFileSync(OUT, buildIndex(new Date()));
  console.log(`plans/README.md regenerated (${collect(PLANS).length} plans).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
