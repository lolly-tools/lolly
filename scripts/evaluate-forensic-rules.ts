// SPDX-License-Identifier: MPL-2.0
/**
 * Per-rule firing rates of the text AI evidence detector on a labelled corpus.
 *
 * Each document runs through the same engine calls the Verify view makes for a text upload:
 * `analyzeTextSignals(text, { source: 'digital' })` (the text panel) and `forensicReport` on
 * one page whose docKind follows valid-forensics-collect.ts (markdown for a .md upload, else
 * the detected kind). No model inference runs here, and nothing is imported from a shell.
 *
 *   node scripts/evaluate-forensic-rules.ts [--corpus=<dir>] [--split=dev|holdout|all]
 *     [--out=<name>] [--compare=<name>] [--limit=<n>]
 *
 * Writes rule-rates[-<name>].json, .md and .docs.jsonl into the corpus directory, and prints
 * a summary. `--compare=baseline` adds the change against rule-rates-baseline.json.
 *
 * Rule keys:
 *   forensic:<family>          a scored Verify evidence family (not context-excluded)
 *   forensic-excluded:<family> the same family seen but excluded by its context
 *   signal:<kind>              a text panel finding kind (family or model in brackets)
 *   tell:<kind> > <label>      one lexicon entry inside a finding, matched by exact span
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import * as lexicon from '../engine/src/claudisms.ts';
import { FORENSIC_VERSION, type ForensicPage, forensicReport } from '../engine/src/forensic.ts';
import {
  analyzeTextSignals,
  LEXICON_VERSION,
  type TextSignalFinding,
} from '../engine/src/text-signals.ts';
import { ENGINE_VERSION } from '../engine/src/version.ts';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const arg = (name: string): string | undefined =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const corpusDir = resolve(arg('corpus') ?? join(ROOT, 'plans/287-verify-forensics/corpus-v4'));
const split = arg('split') ?? 'dev';
const outName = arg('out');
const compareName = arg('compare');
const limit = Number(arg('limit') ?? Number.POSITIVE_INFINITY);
if (!['dev', 'holdout', 'all'].includes(split))
  throw new Error('--split must be dev, holdout or all.');
const stem = (name?: string): string => `rule-rates${name ? `-${name}` : ''}`;

type Band = 'none' | 'weak' | 'notable' | 'strong';
const BANDS: Band[] = ['none', 'weak', 'notable', 'strong'];
interface Doc {
  id: string;
  sourceGroup: string;
  generatorFamily: string;
  domain: string;
  label: 0 | 1;
  text: string;
  split?: string;
  provenance?: Record<string, unknown>;
}
interface Observation {
  id: string;
  label: 0 | 1;
  domain: string;
  generatorFamily: string;
  docKind: string;
  format: 'text' | 'markdown';
  signalBand: Band;
  signalScore: number;
  evidenceBand: Band;
  evidenceScore: number;
  rules: string[];
}

// ---------------------------------------------------------------------------------------
// Lexicon entries, read generically so new lists in claudisms.ts are measured too.
// ---------------------------------------------------------------------------------------
interface Entry {
  re: RegExp;
  label: string;
}
const lists = new Map<string, Entry[]>();
const isEntry = (v: unknown): v is Entry =>
  !!v &&
  typeof v === 'object' &&
  (v as Entry).re instanceof RegExp &&
  typeof (v as Entry).label === 'string';
for (const [name, value] of Object.entries(lexicon)) {
  if (!Array.isArray(value) || !value.length) continue;
  if (value.every(isEntry)) lists.set(name, value);
  else if (value.every((v) => typeof v === 'string') && name === 'AI_WORDS')
    lists.set(
      name,
      value.map((w: string) => ({ re: new RegExp(`\\b${w}\\b`, 'giu'), label: w }))
    );
  else if (
    value.every(
      (v: unknown) =>
        !!v && typeof v === 'object' && Array.isArray((v as { tells?: unknown }).tells)
    )
  )
    for (const group of value as unknown as { family: string; tells: unknown[] }[])
      if (group.tells.every(isEntry)) lists.set(`${name}:${group.family}`, group.tells as Entry[]);
}
const NOT_LEXICAL = new Set([
  'invisible-char',
  'tag-chars',
  'bidi-override',
  'variation-selectors',
  'mixed-script',
  'anomalous-space',
  'em-dash-density',
  'smart-punctuation',
  'list-heavy',
  'uniform-burstiness',
  'uniform-paragraphs',
  'spelling-variant-mix',
  'ai-span',
  'model-estimate',
  'model-fingerprint',
]);
function listsFor(f: TextSignalFinding): string[] {
  const known: Record<string, string[]> = {
    'ai-phrasing': ['AI_PHRASES'],
    'ai-structure': ['AI_STRUCTURE'],
    'ai-vocabulary': ['AI_WORDS'],
    'claude-tell': ['FAMILY_TELLS:Claude'],
    'chatbot-leftover': ['CHATBOT_ARTIFACTS', 'CHATBOT_SOFT'],
  };
  if (f.kind === 'family-tell' && f.family) return [`FAMILY_TELLS:${f.family}`];
  if (known[f.kind]) return known[f.kind]!.filter((n) => lists.has(n));
  // A kind this script does not know yet: try every list, matched by exact span.
  return NOT_LEXICAL.has(f.kind) ? [] : [...lists.keys()].filter((n) => n !== 'MODEL_FINGERPRINTS');
}
function tellsIn(text: string, f: TextSignalFinding): string[] {
  const spans = new Set((f.spans ?? []).map((s) => `${s.index}:${s.length}`));
  if (!spans.size) return [];
  const out = new Set<string>();
  for (const name of listsFor(f))
    for (const entry of lists.get(name) ?? []) {
      const re = new RegExp(
        entry.re.source,
        entry.re.flags.includes('g') ? entry.re.flags : `${entry.re.flags}g`
      );
      for (let m = re.exec(text); m !== null; m = re.exec(text)) {
        if (spans.has(`${m.index}:${m[0].length}`)) {
          out.add(`tell:${f.kind} > ${entry.label}`);
          break;
        }
        if (m[0].length === 0) re.lastIndex++;
      }
    }
  return [...out];
}

// ---------------------------------------------------------------------------------------
// One document, the way the Verify view handles a text upload.
// ---------------------------------------------------------------------------------------
async function observe(doc: Doc): Promise<Observation> {
  const ext = String(doc.provenance?.fileExtension ?? 'txt').toLowerCase();
  const markdown = ext === 'md' || ext === 'markdown';
  const text = doc.text;
  const signals = analyzeTextSignals(text, { source: 'digital' });
  const page: ForensicPage = {
    id: '1',
    width: 0,
    height: 0,
    text: text.slice(0, 65_536),
    source: 'digital',
    complete: text.length <= 65_536,
    lines: [],
    shapes: [],
  };
  page.docKind = markdown
    ? 'markdown'
    : page.text === text
      ? signals.docKind
      : analyzeTextSignals(page.text, { source: 'digital' }).docKind;
  const format = markdown ? 'markdown' : 'text';
  const report = await forensicReport(
    new TextEncoder().encode(text),
    [page],
    [],
    [],
    [],
    [],
    format
  );
  const rules = new Set<string>();
  for (const f of report.findings)
    rules.add(
      `${f.contribution === 'context-excluded' ? 'forensic-excluded' : 'forensic'}:${f.family}`
    );
  for (const f of signals.findings) {
    rules.add(`signal:${f.kind}`);
    if (f.family) rules.add(`signal:${f.kind}[${f.family}]`);
    if (f.model) rules.add(`signal:${f.kind}[${f.model}]`);
    for (const t of tellsIn(text, f)) rules.add(t);
  }
  return {
    id: doc.id,
    label: doc.label,
    domain: doc.domain,
    generatorFamily: doc.generatorFamily,
    docKind: page.docKind,
    format,
    signalBand: signals.band,
    signalScore: signals.score,
    evidenceBand: report.evidence.band,
    evidenceScore: report.evidence.score,
    rules: [...rules].sort(),
  };
}

// ---------------------------------------------------------------------------------------
// Aggregation.
// ---------------------------------------------------------------------------------------
function wilsonUpper(x: number, n: number, z = 1.959964): number {
  if (!n) return 1;
  const p = x / n,
    z2 = z * z;
  return Math.min(
    1,
    (p + z2 / (2 * n) + z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / (1 + z2 / n)
  );
}
type Pair = [fired: number, total: number];
interface RuleStats {
  rule: string;
  human: Pair;
  ai: Pair;
  humanRate: number;
  humanWilsonUpper95: number;
  aiRate: number;
  aiOverHuman: number | null;
  byDomain: Record<string, { human?: Pair; ai?: Pair }>;
  byGenerator: Record<string, Pair>;
}
function aggregate(obs: Observation[]) {
  const labelOf = (o: Observation): 'human' | 'ai' => (o.label ? 'ai' : 'human');
  const totals = { human: 0, ai: 0 };
  const domainTotals: Record<string, { human: number; ai: number }> = {};
  const generatorTotals: Record<string, number> = {};
  for (const o of obs) {
    totals[labelOf(o)]++;
    domainTotals[o.domain] ??= { human: 0, ai: 0 };
    domainTotals[o.domain]![labelOf(o)]++;
    generatorTotals[o.generatorFamily] = (generatorTotals[o.generatorFamily] ?? 0) + 1;
  }
  const fired = new Map<string, Observation[]>();
  for (const o of obs) for (const r of o.rules) fired.set(r, [...(fired.get(r) ?? []), o]);
  const rules: RuleStats[] = [...fired].map(([rule, hits]) => {
    const human = hits.filter((o) => !o.label).length,
      ai = hits.length - human;
    const byDomain: RuleStats['byDomain'] = {};
    for (const [domain, t] of Object.entries(domainTotals)) {
      const d = hits.filter((o) => o.domain === domain);
      byDomain[domain] = {
        ...(t.human ? { human: [d.filter((o) => !o.label).length, t.human] as Pair } : {}),
        ...(t.ai ? { ai: [d.filter((o) => o.label).length, t.ai] as Pair } : {}),
      };
    }
    const byGenerator: Record<string, Pair> = {};
    for (const [g, n] of Object.entries(generatorTotals))
      byGenerator[g] = [hits.filter((o) => o.generatorFamily === g).length, n];
    const humanRate = totals.human ? human / totals.human : 0,
      aiRate = totals.ai ? ai / totals.ai : 0;
    return {
      rule,
      human: [human, totals.human],
      ai: [ai, totals.ai],
      humanRate,
      humanWilsonUpper95: wilsonUpper(human, totals.human),
      aiRate,
      aiOverHuman: humanRate ? aiRate / humanRate : null,
      byDomain,
      byGenerator,
    };
  });
  rules.sort(
    (a, b) => b.humanRate - a.humanRate || b.aiRate - a.aiRate || a.rule.localeCompare(b.rule)
  );
  const bands = (key: 'evidenceBand' | 'signalBand') => {
    const out: Record<string, Record<Band, number> & { n: number }> = {};
    for (const o of obs)
      for (const k of [`ALL|${labelOf(o)}`, `${o.domain}|${labelOf(o)}`]) {
        out[k] ??= { n: 0, none: 0, weak: 0, notable: 0, strong: 0 };
        const row = out[k]!;
        row.n++;
        row[o[key]]++;
      }
    return out;
  };
  const docKinds: Record<string, Record<string, number>> = {};
  for (const o of obs) {
    docKinds[o.domain] ??= {};
    const row = docKinds[o.domain]!;
    row[o.docKind] = (row[o.docKind] ?? 0) + 1;
  }
  return {
    totals,
    domainTotals,
    generatorTotals,
    rules,
    evidenceBands: bands('evidenceBand'),
    signalBands: bands('signalBand'),
    docKinds,
  };
}
type Aggregate = ReturnType<typeof aggregate>;

// ---------------------------------------------------------------------------------------
// Run.
// ---------------------------------------------------------------------------------------
const startedAt = Date.now();
const raw = await readFile(join(corpusDir, 'documents.jsonl'), 'utf8');
let manifest: { documentsSha256?: string; profile?: string } = {};
try {
  manifest = JSON.parse(await readFile(join(corpusDir, 'manifest.json'), 'utf8'));
} catch {
  /* A corpus without a manifest is still measurable. */
}
const all = raw
  .split('\n')
  .filter((l) => l.trim())
  .map((l) => JSON.parse(l) as Doc);
if (all.some((d) => ![0, 1].includes(d.label) || typeof d.text !== 'string'))
  throw new Error('Corpus rows must carry label 0 or 1 and a text.');
const selected = all.filter((d) => split === 'all' || (d.split ?? 'dev') === split).slice(0, limit);
if (!selected.length) throw new Error(`No documents in split ${split}.`);
console.log(`Measuring ${selected.length} ${split} documents from ${relative(ROOT, corpusDir)}...`);
const observations: Observation[] = [];
for (const [i, doc] of selected.entries()) {
  observations.push(await observe(doc));
  if ((i + 1) % 1000 === 0) console.log(`  ${i + 1}/${selected.length}`);
}
const agg = aggregate(observations);
const runtimeSeconds = Math.round((Date.now() - startedAt) / 100) / 10;

let previous: { aggregate: Aggregate } | undefined;
let previousDocs = new Map<string, Observation>();
if (compareName) {
  previous = JSON.parse(await readFile(join(corpusDir, `${stem(compareName)}.json`), 'utf8'));
  try {
    previousDocs = new Map(
      (await readFile(join(corpusDir, `${stem(compareName)}.docs.jsonl`), 'utf8'))
        .split('\n')
        .filter((l) => l.trim())
        .map((l) => {
          const o = JSON.parse(l) as Observation;
          return [o.id, o];
        })
    );
  } catch {
    /* Per-document comparison is optional. */
  }
}
const prevRule = new Map((previous?.aggregate.rules ?? []).map((r) => [r.rule, r]));
const bandRank = (b: Band): number => BANDS.indexOf(b);
const changes = { humanUp: 0, humanDown: 0, aiUp: 0, aiDown: 0, compared: 0 };
for (const o of observations) {
  const p = previousDocs.get(o.id);
  if (!p) continue;
  changes.compared++;
  const d = bandRank(o.evidenceBand) - bandRank(p.evidenceBand);
  if (d > 0) changes[o.label ? 'aiUp' : 'humanUp']++;
  if (d < 0) changes[o.label ? 'aiDown' : 'humanDown']++;
}

const result = {
  profile: 'lolly/forensic-rule-rates-v1',
  date: new Date().toISOString(),
  corpus: relative(ROOT, corpusDir),
  corpusProfile: manifest.profile,
  corpusDocumentsSha256: createHash('sha256').update(raw).digest('hex'),
  manifestDocumentsSha256: manifest.documentsSha256,
  split,
  documents: observations.length,
  engineVersion: ENGINE_VERSION,
  lexiconVersion: LEXICON_VERSION,
  forensicVersion: FORENSIC_VERSION,
  runtimeSeconds,
  method:
    'analyzeTextSignals(text, { source: "digital" }) and forensicReport(bytes, [page], [], [], [], [], format) ' +
    'with page.docKind = markdown for an .md document, else the detected kind; text capped at 65,536 ' +
    'characters as the Verify collector does. No classifier, OCR or layout input.',
  ...(compareName ? { comparedWith: stem(compareName), bandChanges: changes } : {}),
  aggregate: agg,
};

// ---------------------------------------------------------------------------------------
// Readable report.
// ---------------------------------------------------------------------------------------
const pct = (x: number): string => `${(100 * x).toFixed(1)}%`;
const pctPair = (p?: Pair): string => (p?.[1] ? pct(p[0] / p[1]) : '');
const delta = (now: number, before?: number): string =>
  before === undefined
    ? 'new'
    : `${now - before >= 0 ? '+' : ''}${(100 * (now - before)).toFixed(1)}`;
const cell = (s: string): string => s.replace(/\|/g, '\\|');
function ruleTable(prefix: string): string[] {
  const rows = agg.rules.filter((r) => r.rule.startsWith(prefix));
  if (!rows.length) return ['_None fired._', ''];
  const head = [
    '| Rule | Human fired | Human rate | Human 95% upper | AI fired | AI rate | AI / human |' +
      (previous ? ' Δ human pp | Δ AI pp |' : ''),
    '|---|--:|--:|--:|--:|--:|--:|' + (previous ? '--:|--:|' : ''),
  ];
  return [
    ...head,
    ...rows.map((r) => {
      const p = prevRule.get(r.rule);
      return (
        `| ${cell(r.rule.slice(prefix.length))} | ${r.human[0]}/${r.human[1]} | ${pct(r.humanRate)} | ` +
        `${pct(r.humanWilsonUpper95)} | ${r.ai[0]}/${r.ai[1]} | ${pct(r.aiRate)} | ` +
        `${r.aiOverHuman === null ? (r.aiRate ? 'human 0' : '') : r.aiOverHuman.toFixed(1)} |` +
        (previous ? ` ${delta(r.humanRate, p?.humanRate)} | ${delta(r.aiRate, p?.aiRate)} |` : '')
      );
    }),
    ...(previous
      ? [
          '',
          `Rules in ${stem(compareName)} that no longer fire: ` +
            ([...prevRule.keys()]
              .filter((k) => k.startsWith(prefix) && !agg.rules.some((r) => r.rule === k))
              .map((k) => `\`${k.slice(prefix.length)}\``)
              .join(', ') || 'none') +
            '.',
        ]
      : []),
    '',
  ];
}
function matrix(prefix: string, side: 'human' | 'ai'): string[] {
  const domains = Object.entries(agg.domainTotals)
    .filter(([, t]) => t[side] > 0)
    .map(([d]) => d)
    .sort();
  const rows = agg.rules.filter(
    (r) => r.rule.startsWith(prefix) && Object.values(r.byDomain).some((d) => d[side]?.[0])
  );
  if (!rows.length) return ['_None fired._', ''];
  return [
    `| Rule | ${domains.map((d) => `${d} (n=${agg.domainTotals[d]![side]})`).join(' | ')} |`,
    `|---|${domains.map(() => '--:').join('|')}|`,
    ...rows.map(
      (r) =>
        `| ${cell(r.rule.slice(prefix.length))} | ${domains
          .map((d) => {
            const p = r.byDomain[d]?.[side];
            return p?.[0] ? pctPair(p) : '·';
          })
          .join(' | ')} |`
    ),
    '',
  ];
}
function generatorMatrix(prefix: string): string[] {
  const gens = Object.keys(agg.generatorTotals).sort();
  const rows = agg.rules.filter((r) => r.rule.startsWith(prefix));
  if (!rows.length) return ['_None fired._', ''];
  return [
    `| Rule | ${gens.map((g) => `${g} (n=${agg.generatorTotals[g]})`).join(' | ')} |`,
    `|---|${gens.map(() => '--:').join('|')}|`,
    ...rows.map(
      (r) =>
        `| ${cell(r.rule.slice(prefix.length))} | ${gens
          .map((g) => (r.byGenerator[g]?.[0] ? pctPair(r.byGenerator[g]) : '·'))
          .join(' | ')} |`
    ),
    '',
  ];
}
function bandTable(key: 'evidenceBands' | 'signalBands'): string[] {
  const rows = Object.entries(agg[key]).sort(([a], [b]) =>
    a.startsWith('ALL|') === b.startsWith('ALL|')
      ? a.localeCompare(b)
      : a.startsWith('ALL|')
        ? -1
        : 1
  );
  const before = previous?.aggregate[key];
  return [
    `| Domain | Label | n | none | weak | notable | strong |${before ? ' Δ notable+ pp |' : ''}`,
    `|---|---|--:|--:|--:|--:|--:|${before ? '--:|' : ''}`,
    ...rows.map(([k, r]) => {
      const [domain, label] = k.split('|');
      const high = (r.notable + r.strong) / r.n;
      const b = before?.[k];
      return (
        `| ${domain} | ${label} | ${r.n} | ${BANDS.map((x) => pct(r[x] / r.n)).join(' | ')} |` +
        (before ? ` ${b ? delta(high, (b.notable + b.strong) / b.n) : 'new'} |` : '')
      );
    }),
    '',
  ];
}
const md = [
  `# Forensic rule rates: ${split} split${outName ? ` (${outName})` : ''}`,
  '',
  `- Corpus: \`${result.corpus}\` (${result.corpusProfile ?? 'no manifest'}), documents.jsonl sha256 \`${result.corpusDocumentsSha256}\``,
  `- Documents: ${observations.length} (${agg.totals.human} human, ${agg.totals.ai} AI); runtime ${runtimeSeconds} s`,
  `- Engine ${ENGINE_VERSION}, lexicon ${LEXICON_VERSION}, ${FORENSIC_VERSION}; ${result.date}`,
  `- Method: ${result.method}`,
  '- A rule fires on a document when it appears at least once. "Human 95% upper" is the Wilson ' +
    'score upper bound on the human firing rate. Rates are development measurements, not ' +
    'calibrated probabilities.',
  ...(previous
    ? [
        `- Compared with \`${stem(compareName)}\`: of ${changes.compared} matched documents, the evidence band rose for ${changes.humanUp} human and ${changes.aiUp} AI documents and fell for ${changes.humanDown} human and ${changes.aiDown} AI documents.`,
      ]
    : []),
  '',
  '## Verify evidence families (forensicReport)',
  '',
  ...ruleTable('forensic:'),
  '### Seen but excluded by context',
  '',
  ...ruleTable('forensic-excluded:'),
  '## Text panel finding kinds (analyzeTextSignals)',
  '',
  ...ruleTable('signal:'),
  '## Lexicon entries inside findings',
  '',
  'Attributed by exact span: an entry counts when one of its matches is a span of the finding.',
  '',
  ...ruleTable('tell:'),
  '## Verify evidence band by domain',
  '',
  ...bandTable('evidenceBands'),
  '## Text panel band by domain',
  '',
  ...bandTable('signalBands'),
  '## Human firing rate by domain',
  '',
  '### Verify evidence families',
  '',
  ...matrix('forensic:', 'human'),
  '### Text panel kinds',
  '',
  ...matrix('signal:', 'human'),
  '### Lexicon entries',
  '',
  ...matrix('tell:', 'human'),
  '## AI firing rate by domain',
  '',
  '### Verify evidence families',
  '',
  ...matrix('forensic:', 'ai'),
  '### Text panel kinds',
  '',
  ...matrix('signal:', 'ai'),
  '### Lexicon entries',
  '',
  ...matrix('tell:', 'ai'),
  '## Firing rate by generator family',
  '',
  '### Verify evidence families',
  '',
  ...generatorMatrix('forensic:'),
  '### Text panel kinds',
  '',
  ...generatorMatrix('signal:'),
  '## Detected document kind by domain',
  '',
  '| Domain | prose | markdown | code |',
  '|---|--:|--:|--:|',
  ...Object.entries(agg.docKinds)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([d, k]) => `| ${d} | ${k.prose ?? 0} | ${k.markdown ?? 0} | ${k.code ?? 0} |`),
  '',
].join('\n');

await writeFile(join(corpusDir, `${stem(outName)}.json`), JSON.stringify(result, null, 1) + '\n');
await writeFile(join(corpusDir, `${stem(outName)}.md`), md);
await writeFile(
  join(corpusDir, `${stem(outName)}.docs.jsonl`),
  observations.map((o) => JSON.stringify(o)).join('\n') + '\n'
);

// ---------------------------------------------------------------------------------------
// Compact summary.
// ---------------------------------------------------------------------------------------
const pad = (s: string, n: number): string =>
  s.length > n ? `${s.slice(0, n - 1)}…` : s.padEnd(n);
console.log(
  `\n${observations.length} documents (${agg.totals.human} human, ${agg.totals.ai} AI), ${split} split, engine ${ENGINE_VERSION}, lexicon ${LEXICON_VERSION}, ${runtimeSeconds} s`
);
console.log(
  `\n${pad('Rule (top 20 by human rate)', 58)} ${'human'.padStart(7)} ${'h95up'.padStart(7)} ${'AI'.padStart(7)}`
);
for (const r of agg.rules.filter((r) => !r.rule.startsWith('forensic-excluded:')).slice(0, 20))
  console.log(
    `${pad(r.rule, 58)} ${pct(r.humanRate).padStart(7)} ${pct(r.humanWilsonUpper95).padStart(7)} ${pct(r.aiRate).padStart(7)}`
  );
console.log(
  `\n${pad('Verify evidence band', 34)} ${'n'.padStart(5)} ${BANDS.map((b) => b.padStart(8)).join('')}`
);
for (const [k, r] of Object.entries(agg.evidenceBands).sort(([a], [b]) => a.localeCompare(b)))
  console.log(
    `${pad(k.replace('|', ' / '), 34)} ${String(r.n).padStart(5)} ${BANDS.map((b) => pct(r[b] / r.n).padStart(8)).join('')}`
  );
if (previous)
  console.log(
    `\nAgainst ${stem(compareName)}: evidence band up for ${changes.humanUp} human / ${changes.aiUp} AI, down for ${changes.humanDown} human / ${changes.aiDown} AI (${changes.compared} matched).`
  );
console.log(`\nWrote ${relative(ROOT, join(corpusDir, stem(outName)))}.{json,md,docs.jsonl}`);
