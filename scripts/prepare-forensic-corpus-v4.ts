// SPDX-License-Identifier: MPL-2.0
/**
 * Corpus v4 for the text AI evidence detector, a superset of the v1 RAID abstracts.
 *
 * Adds RAID rows from every English domain (human and the chat generators), HC3 human and
 * ChatGPT answers to the same questions, ELLIPSE learner essays as a non-native English
 * control, presumed-human package READMEs, and Claude chat answers in raw Markdown plus a
 * plain-text copy. Each row carries the v1 shape plus `split`, assigned by hashing
 * `sourceGroup`, so one source group never spans both splits.
 *
 *   node scripts/prepare-forensic-corpus-v4.ts [outDir] [--refresh] [--include-toefl] [--no-ellipse]
 *
 * Every download is a bounded GET and is cached under <outDir>/cache, so a re-run (for
 * example once more generated answers exist) is offline. `--refresh` downloads again.
 *
 * Sources and credits (each also recorded in the output manifest):
 * - RAID, Dugan et al., ACL 2024 (MIT dataset card; upstream human-source licences apply).
 * - HC3, Guo et al., "How Close is ChatGPT to Human Experts?", 2023 (CC BY-SA 4.0).
 * - ELLIPSE Corpus, Crossley et al., 2023 (CC BY-NC-SA 4.0), local non-commercial
 *   evaluation only; full credit beside ELLIPSE_REPO below.
 * - READMEs from installed npm packages, each under its own package licence.
 * The corpus stays under plans/ and is never redistributed.
 */
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { productionDigest } from '../engine/src/production/contract.ts';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const positionals = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const flags = new Set(process.argv.slice(2).filter((a) => a.startsWith('--')));
const destination = resolve(positionals[0] ?? join(ROOT, 'plans/287-verify-forensics/corpus-v4'));
const cacheDir = join(destination, 'cache');
const refresh = flags.has('--refresh');
const includeToefl = flags.has('--include-toefl');
const includeEllipse = !flags.has('--no-ellipse');

const SPLIT_SALT = 'lolly/forensic-corpus-v4/split/1';
const DEV_FRACTION = 0.7;
const CELL_CAP = 120;
const MAX_TEXT = 65_536;

interface Doc {
  id: string;
  sourceGroup: string;
  generatorFamily: string;
  domain: string;
  language: string;
  source: 'digital';
  label: 0 | 1;
  text: string;
  provenance: Record<string, unknown>;
  split?: 'dev' | 'holdout';
}
interface SourceRecord {
  name: string;
  status: 'included' | 'skipped' | 'partial';
  reason?: string;
  urls: string[];
  revision?: string;
  licence: string;
  attribution?: string;
  sampling: string;
  notes?: string[];
  documents: number;
  download?: Record<string, unknown>;
}

const started = Date.now();
const log = (message: string): void =>
  console.log(`[${((Date.now() - started) / 1000).toFixed(1).padStart(6)}s] ${message}`);
const sha256 = (value: string | Uint8Array): string =>
  createHash('sha256').update(value).digest('hex');
const words = (text: string): number => text.match(/\S+/g)?.length ?? 0;
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// Network: GET only, to an allowlisted host, with a per-request cap and a global byte budget.
const ALLOWED_HOSTS = new Set([
  'huggingface.co',
  'datasets-server.huggingface.co',
  'raw.githubusercontent.com',
  'github.com',
]);
const BYTE_BUDGET = 220 * 1024 * 1024;
const net = { bytes: 0, requests: 0 };

function allowedFinalHost(url: string): boolean {
  const host = new URL(url).hostname;
  // huggingface.co resolve URLs redirect to Hugging Face's own CDN under hf.co.
  return ALLOWED_HOSTS.has(host) || host.endsWith('.hf.co');
}

async function get(
  url: string,
  opts: { range?: [number, number]; cap: number; manualRedirect?: boolean }
): Promise<{ bytes: Uint8Array; total?: number; location?: string }> {
  if (!allowedFinalHost(url)) throw new Error(`Refusing a request to ${new URL(url).hostname}.`);
  for (let attempt = 0; ; attempt++) {
    try {
      net.requests++;
      const res = await fetch(url, {
        method: 'GET',
        headers: opts.range ? { Range: `bytes=${opts.range[0]}-${opts.range[1]}` } : {},
        redirect: opts.manualRedirect ? 'manual' : 'follow',
        signal: AbortSignal.timeout(90_000),
      });
      if (opts.manualRedirect && res.status >= 300 && res.status < 400) {
        await res.body?.cancel();
        return { bytes: new Uint8Array(0), location: res.headers.get('location') ?? undefined };
      }
      if (!allowedFinalHost(res.url))
        throw new Error(`Redirected to ${new URL(res.url).hostname}.`);
      if (res.status === 429 || res.status >= 500) {
        await res.body?.cancel();
        const wait = Number(res.headers.get('retry-after') ?? 0) * 1000 || 2000 * 2 ** attempt;
        throw Object.assign(new Error(`HTTP ${res.status}`), { retryAfter: wait });
      }
      let total: number | undefined;
      if (opts.range) {
        const contentRange = res.headers.get('content-range') ?? '';
        if (res.status !== 206 || !contentRange.startsWith(`bytes ${opts.range[0]}-`)) {
          await res.body?.cancel();
          throw new Error(`Server did not honour the bounded range (HTTP ${res.status}).`);
        }
        total = Number(contentRange.split('/')[1]);
      } else if (!res.ok) {
        await res.body?.cancel();
        throw new Error(`HTTP ${res.status} for ${url}`);
      }
      const reader = res.body!.getReader();
      const chunks: Uint8Array[] = [];
      let length = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.length;
        if (length > opts.cap) {
          await reader.cancel();
          throw Object.assign(new Error(`Download exceeded its ${opts.cap} byte cap: ${url}`), {
            fatal: true,
          });
        }
        chunks.push(value);
      }
      net.bytes += length;
      if (net.bytes > BYTE_BUDGET)
        throw Object.assign(new Error('Total download budget exceeded.'), { fatal: true });
      const bytes = new Uint8Array(length);
      let at = 0;
      for (const c of chunks) {
        bytes.set(c, at);
        at += c.length;
      }
      return { bytes, total };
    } catch (error) {
      const e = error as { fatal?: boolean; retryAfter?: number };
      if (e.fatal || attempt >= 4) throw error;
      await sleep(e.retryAfter ?? 1500 * 2 ** attempt);
    }
  }
}

async function cached<T>(name: string, build: () => Promise<T>): Promise<T> {
  const path = join(cacheDir, name);
  if (!refresh)
    try {
      const value = JSON.parse(await readFile(path, 'utf8')) as T;
      log(`cache hit ${name}`);
      return value;
    } catch {
      /* Not cached yet. */
    }
  const value = await build();
  await mkdir(cacheDir, { recursive: true });
  await writeFile(path, JSON.stringify(value));
  return value;
}

async function pool<T>(
  initial: T[],
  width: number,
  run: (item: T, push: (next: T) => void) => Promise<void>
): Promise<void> {
  const queue = [...initial];
  let active = 0;
  await new Promise<void>((done, fail) => {
    const pump = (): void => {
      if (!queue.length && !active) {
        done();
        return;
      }
      while (active < width && queue.length) {
        const item = queue.shift()!;
        active++;
        run(item, (next) => queue.push(next)).then(() => {
          active--;
          pump();
        }, fail);
      }
    };
    pump();
  });
}

/** Parses one CSV record that must end exactly at its closing newline. */
function parseCsvRecord(segment: string): string[] | null {
  const out: string[] = [];
  let field = '',
    quoted = false;
  for (let i = 0; i < segment.length; i++) {
    const c = segment[i]!;
    if (c === '"') {
      if (quoted && segment[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && c === ',') {
      out.push(field);
      field = '';
    } else if (!quoted && c === '\n') {
      out.push(field.replace(/\r$/, ''));
      return i === segment.length - 1 ? out : null;
    } else field += c;
  }
  return null;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = '',
    row: string[] = [],
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && (c === ',' || c === '\n')) {
      row.push(field.replace(/\r$/, ''));
      field = '';
      if (c === '\n') {
        rows.push(row);
        row = [];
      }
    } else field += c;
  }
  if (field || row.length) rows.push([...row, field]);
  return rows;
}

// Split by source group, never by document.
function splitOf(sourceGroup: string): 'dev' | 'holdout' {
  const unit = Number.parseInt(sha256(SPLIT_SALT + sourceGroup).slice(0, 8), 16) / 2 ** 32;
  return unit < DEV_FRACTION ? 'dev' : 'holdout';
}
const order = (key: string): string => sha256(`lolly/forensic-corpus-v4/order/${key}`);

// ---------------------------------------------------------------------------------------
// Source 6 (read first so RAID caps can count it): the v1 abstracts.
// ---------------------------------------------------------------------------------------
const sources: SourceRecord[] = [];
const docs: Doc[] = [];
const v1Path = resolve(destination, '../corpus/documents.jsonl');
const v1Docs: Doc[] = [];
try {
  for (const line of (await readFile(v1Path, 'utf8')).split('\n')) {
    if (!line.trim()) continue;
    const d = JSON.parse(line) as Doc;
    v1Docs.push({
      ...d,
      provenance: { ...d.provenance, corpusSource: 'raid-v1', fileExtension: 'txt' },
    });
  }
  sources.push({
    name: 'raid-v1',
    status: 'included',
    urls: [v1Path],
    revision: '865cac74188466cb0c3b7574a10204007b57a459',
    licence: 'MIT (RAID dataset card); upstream human-source licences remain applicable',
    attribution: 'Dugan et al., RAID, ACL 2024',
    sampling: 'Copied unchanged from corpus v1 (see its manifest.json).',
    documents: v1Docs.length,
  });
  log(`v1 abstracts: ${v1Docs.length}`);
} catch (error) {
  sources.push({
    name: 'raid-v1',
    status: 'skipped',
    reason: `v1 corpus unreadable: ${(error as Error).message}`,
    urls: [v1Path],
    licence: 'MIT',
    sampling: 'n/a',
    documents: 0,
  });
}
docs.push(...v1Docs);
const v1Ids = new Set(v1Docs.map((d) => d.id));
const v1Cells = new Map<string, number>();
for (const d of v1Docs)
  v1Cells.set(
    `${d.domain}/${d.generatorFamily}`,
    (v1Cells.get(`${d.domain}/${d.generatorFamily}`) ?? 0) + 1
  );

// ---------------------------------------------------------------------------------------
// Source 1: RAID across domains, by bounded Range reads at spread offsets.
// ---------------------------------------------------------------------------------------
const RAID_DATASET = 'liamdugan/raid';
const RAID_REVISION = '865cac74188466cb0c3b7574a10204007b57a459';
const RAID_URL = `https://huggingface.co/datasets/${RAID_DATASET}/resolve/${RAID_REVISION}/train.csv`;
const RAID_HEADER =
  'id,adv_source_id,source_id,model,decoding,repetition_penalty,attack,domain,title,prompt,generation';
const RAID_DOMAINS = [
  'abstracts',
  'books',
  'news',
  'poetry',
  'recipes',
  'reddit',
  'reviews',
  'wiki',
];
const RAID_SKIPPED_DOMAINS = ['czech', 'german'];
const RAID_MODELS = new Set([
  'human',
  'gpt2',
  'gpt3',
  'gpt4',
  'chatgpt',
  'mistral',
  'mistral-chat',
  'mpt',
  'mpt-chat',
  'llama-chat',
  'cohere',
  'cohere-chat',
]);
const RAID_TARGETS = [
  'human',
  'chatgpt',
  'gpt4',
  'cohere-chat',
  'llama-chat',
  'mistral-chat',
  'mpt-chat',
];
const RAID_PARAMS = {
  coarseSpacing: 16 * 1024 * 1024,
  coarseProbe: 16 * 1024,
  denseSpacing: 2 * 1024 * 1024,
  denseProbe: 32 * 1024,
  fillRead: 256 * 1024,
  fillReadsPerCell: 6,
  sweepSpacing: 512 * 1024,
  sweepProbe: 64 * 1024,
  raidByteBudget: 160 * 1024 * 1024,
};
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const ROW_START = new RegExp(`\\n(?=${UUID},(?:${UUID})?,${UUID},)`, 'g');
const UUID_ONLY = new RegExp(`^${UUID}$`);

interface RaidRow {
  id: string;
  adv_source_id: string;
  source_id: string;
  model: string;
  decoding: string;
  repetition_penalty: string;
  attack: string;
  domain: string;
  title: string;
  promptSha256: string;
  generation: string;
}
interface RaidCache {
  revision: string;
  params: typeof RAID_PARAMS;
  size: number;
  bytes: number;
  requests: number;
  reads: { offset: number; length: number; sha256: string; phase: string }[];
  map: { offset: number; cells: string[] }[];
  candidates: RaidRow[];
}

async function raidSample(): Promise<RaidCache> {
  const startBytes = net.bytes,
    startRequests = net.requests;
  // Resolve the signed CDN location once so later Range reads do not each hit the Hub.
  let location = '';
  const resolveLocation = async (): Promise<void> => {
    const r = await get(RAID_URL, { cap: 4096, manualRedirect: true });
    location = r.location ? new URL(r.location, RAID_URL).toString() : RAID_URL;
  };
  await resolveLocation();
  const reads: RaidCache['reads'] = [];
  const read = async (offset: number, length: number, phase: string): Promise<string> => {
    let r: Awaited<ReturnType<typeof get>>;
    try {
      r = await get(location, { range: [offset, offset + length - 1], cap: length });
    } catch {
      await resolveLocation();
      r = await get(location, { range: [offset, offset + length - 1], cap: length });
    }
    reads.push({ offset, length: r.bytes.length, sha256: sha256(r.bytes), phase });
    if (net.bytes - startBytes > RAID_PARAMS.raidByteBudget)
      throw new Error('RAID byte budget exceeded.');
    return new TextDecoder().decode(r.bytes);
  };
  const size = (await get(location, { range: [0, 0], cap: 1 })).total!;
  if (!Number.isFinite(size) || size < 1e9) throw new Error('RAID size is not plausible.');
  log(`RAID train.csv is ${(size / 1e9).toFixed(2)} GB`);
  const candidates = new Map<string, RaidRow>();
  const map = new Map<number, string[]>();
  let headerChecked = false;
  const rowsIn = (text: string, offset: number): RaidRow[] => {
    if (offset === 0) {
      const header = text.slice(0, text.indexOf('\n')).replace(/\r$/, '');
      if (header !== RAID_HEADER)
        throw new Error('RAID schema changed. Review before admitting labels.');
      headerChecked = true;
    }
    const starts = [...text.matchAll(ROW_START)].map((m) => m.index! + 1);
    const out: RaidRow[] = [];
    // The text before the first row start and after the last one is partial and is dropped.
    for (let i = 0; i + 1 < starts.length; i++) {
      const f = parseCsvRecord(text.slice(starts[i]!, starts[i + 1]!));
      if (f?.length !== 11) continue;
      const [id, adv, src, model, decoding, rep, attack, domain, title, prompt, generation] = f as [
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
      ];
      if (!UUID_ONLY.test(id) || !UUID_ONLY.test(src) || !RAID_MODELS.has(model)) continue;
      if (![...RAID_DOMAINS, ...RAID_SKIPPED_DOMAINS].includes(domain)) continue;
      out.push({
        id,
        adv_source_id: adv,
        source_id: src,
        model,
        decoding,
        repetition_penalty: rep,
        attack,
        domain,
        title,
        promptSha256: sha256(JSON.stringify(prompt)),
        generation,
      });
    }
    return out;
  };
  const record = (rows: RaidRow[], offset: number): RaidRow[] => {
    const none = rows.filter((r) => r.attack === 'none' && RAID_DOMAINS.includes(r.domain));
    map.set(offset, [...new Set(none.map((r) => `${r.domain}/${r.model}`))]);
    for (const r of none)
      if (RAID_TARGETS.includes(r.model) && r.generation.trim() && !v1Ids.has(r.id))
        candidates.set(r.id, r);
    return none;
  };
  // Phase A: a coarse map of the whole file.
  const coarse: number[] = [];
  for (let o = 0; o + RAID_PARAMS.coarseProbe < size; o += RAID_PARAMS.coarseSpacing)
    coarse.push(o);
  const hits: number[] = [];
  await pool(coarse, 8, async (offset) => {
    const none = record(
      rowsIn(await read(offset, RAID_PARAMS.coarseProbe, 'coarse'), offset),
      offset
    );
    if (none.length) hits.push(offset);
  });
  if (!headerChecked) throw new Error('RAID header was not read.');
  log(`RAID coarse map: ${coarse.length} probes, ${hits.length} with unattacked rows`);
  // Phase B: flood-fill each unattacked block at a finer spacing. A probe with no complete
  // row continues the walk one more step so a long row cannot end a block early.
  const dense = new Set<number>(coarse);
  const step = RAID_PARAMS.denseSpacing;
  const seeds = hits.flatMap((o) => [
    { offset: o - step, dir: -1, blind: 0 },
    { offset: o + step, dir: 1, blind: 0 },
  ]);
  await pool(seeds, 8, async (item, push) => {
    if (item.offset < 0 || item.offset + RAID_PARAMS.denseProbe >= size || dense.has(item.offset))
      return;
    dense.add(item.offset);
    const rows = rowsIn(await read(item.offset, RAID_PARAMS.denseProbe, 'dense'), item.offset);
    const none = record(rows, item.offset);
    const blind = rows.length ? 0 : item.blind + 1;
    if (none.length || blind === 1)
      push({ offset: item.offset + item.dir * step, dir: item.dir, blind });
  });
  log(`RAID dense map: ${dense.size - coarse.length} more probes; ${candidates.size} candidates`);
  // Phase C: larger reads where a still-short cell was seen.
  const count = (cell: string): number =>
    [...candidates.values()].filter((r) => `${r.domain}/${r.model}` === cell).length;
  const cells = RAID_DOMAINS.flatMap((d) => RAID_TARGETS.map((m) => `${d}/${m}`));
  const want = (cell: string): number => CELL_CAP - (v1Cells.get(cell) ?? 0);
  const short = (): string[] => cells.filter((c) => want(c) > 0 && count(c) < want(c));
  const fillDone = new Set<number>();
  const fill = async (phase: string): Promise<void> =>
    pool(short(), 6, async (cell) => {
      const seen = [...map]
        .filter(([, c]) => c.includes(cell))
        .map(([o]) => o)
        .sort((a, b) => a - b);
      // Visit the sightings spread out: the middle one, then the middles of each half.
      const spread: number[] = [];
      const ranges: [number, number][] = [[0, seen.length - 1]];
      while (ranges.length) {
        const [lo, hi] = ranges.shift()!;
        if (lo > hi) continue;
        const mid = (lo + hi) >> 1;
        spread.push(seen[mid]!);
        ranges.push([lo, mid - 1], [mid + 1, hi]);
      }
      let reads = 0;
      for (const offset of spread) {
        if (count(cell) >= want(cell) || reads >= RAID_PARAMS.fillReadsPerCell) break;
        if (fillDone.has(offset)) continue;
        fillDone.add(offset);
        reads++;
        record(rowsIn(await read(offset, RAID_PARAMS.fillRead, phase), offset), offset);
      }
    });
  await fill('fill');
  log(
    `RAID fill: ${fillDone.size} reads; ${candidates.size} candidates; short: ${short().join(', ')}`
  );
  // Phase D: a run of one model can be shorter than the map spacing (a human run is about
  // 0.5 MB), so sweep the unattacked regions of domains that still have short cells at a
  // finer spacing, then fill again from the new sightings.
  const sweep: number[] = [];
  const probed = [...map.keys()];
  for (const domain of new Set(short().map((c) => c.split('/')[0]!))) {
    const offsets = [...map]
      .filter(([, c]) => c.some((x) => x.startsWith(`${domain}/`)))
      .map(([o]) => o)
      .sort((a, b) => a - b);
    if (!offsets.length) continue;
    let lo = offsets[0]!,
      prev = offsets[0]!;
    for (const o of [...offsets.slice(1), Number.POSITIVE_INFINITY]) {
      if (o - prev > 2 * step) {
        for (
          let x = Math.max(0, lo - step) + RAID_PARAMS.sweepSpacing / 2;
          x < Math.min(size - RAID_PARAMS.sweepProbe, prev + step);
          x += RAID_PARAMS.sweepSpacing
        )
          if (!probed.some((p) => Math.abs(p - x) < RAID_PARAMS.sweepProbe))
            sweep.push(Math.round(x));
        lo = o;
      }
      prev = o;
    }
  }
  await pool(sweep, 8, async (offset) => {
    record(rowsIn(await read(offset, RAID_PARAMS.sweepProbe, 'sweep'), offset), offset);
  });
  log(`RAID sweep: ${sweep.length} probes; ${candidates.size} candidates`);
  await fill('fill-2');
  log(`RAID fill 2: ${fillDone.size} reads in all; short: ${short().join(', ') || 'none'}`);
  return {
    revision: RAID_REVISION,
    params: RAID_PARAMS,
    size,
    bytes: net.bytes - startBytes,
    requests: net.requests - startRequests,
    reads: reads.sort((a, b) => a.offset - b.offset),
    map: [...map].sort((a, b) => a[0] - b[0]).map(([offset, c]) => ({ offset, cells: c })),
    candidates: [...candidates.values()],
  };
}

try {
  const raid = await cached('raid-v4.json', raidSample);
  if (raid.revision !== RAID_REVISION) throw new Error('Cached RAID sample has another revision.');
  const byCell = new Map<string, RaidRow[]>();
  for (const r of raid.candidates) {
    const cell = `${r.domain}/${r.model}`;
    byCell.set(cell, [...(byCell.get(cell) ?? []), r]);
  }
  const shortCells: string[] = [];
  let admitted = 0;
  for (const domain of RAID_DOMAINS)
    for (const model of RAID_TARGETS) {
      const cell = `${domain}/${model}`;
      const want = CELL_CAP - (v1Cells.get(cell) ?? 0);
      if (want <= 0) continue;
      const pick = (byCell.get(cell) ?? [])
        .filter((r) => r.generation.length <= MAX_TEXT)
        .sort((a, b) => order(a.id).localeCompare(order(b.id)))
        .slice(0, want);
      if (pick.length < want) shortCells.push(`${cell}: ${pick.length}/${want}`);
      for (const r of pick) {
        admitted++;
        docs.push({
          id: r.id,
          sourceGroup: r.source_id,
          generatorFamily: r.model,
          domain: r.domain,
          language: 'en',
          source: 'digital',
          label: r.model === 'human' ? 0 : 1,
          text: r.generation,
          provenance: {
            corpusSource: 'raid',
            fileExtension: 'txt',
            dataset: RAID_DATASET,
            revision: RAID_REVISION,
            sourceId: r.source_id,
            adversarialSourceId: r.adv_source_id,
            model: r.model,
            attack: r.attack,
            decoding: r.decoding,
            repetitionPenalty: r.repetition_penalty,
            title: r.title,
            promptSha256: r.promptSha256,
          },
        });
      }
    }
  sources.push({
    name: 'raid',
    status: shortCells.length ? 'partial' : 'included',
    ...(shortCells.length ? { reason: `Cells below cap: ${shortCells.join('; ')}` } : {}),
    urls: [RAID_URL],
    revision: RAID_REVISION,
    licence: 'MIT (RAID dataset card); upstream human-source licences remain applicable',
    attribution: 'Dugan et al., RAID, ACL 2024',
    sampling:
      `Bounded HTTP Range reads of train.csv (${(raid.size / 1e9).toFixed(2)} GB): a coarse map ` +
      `(16 KiB every 16 MiB), a flood fill of each unattacked block (32 KiB every 2 MiB), up to ` +
      `${RAID_PARAMS.fillReadsPerCell} reads of 256 KiB per short cell, then for domains still ` +
      `short a sweep of their unattacked blocks (64 KiB every 512 KiB) and a second fill. ` +
      `Rows are resynchronised at ` +
      `"\\n<uuid>,<uuid>,<uuid>," boundaries and each record must parse to exactly 11 fields ending ` +
      `at its own newline; partial head and tail records are dropped. attack == "none" only; ` +
      `models ${RAID_TARGETS.join(', ')}; domains ${RAID_DOMAINS.join(', ')} (czech and german skipped). ` +
      `Up to ${CELL_CAP} per domain/model including v1 rows, chosen by sha256 order of the row id.`,
    notes: [
      'An unattacked block cycles through runs of one model (about 0.5-2 MB each), so a cell comes from a few contiguous runs of consecutive source documents.',
      'sourceGroup is RAID source_id, shared by a human document and its generations.',
    ],
    documents: admitted,
    download: {
      bytes: raid.bytes,
      requests: raid.requests,
      reads: raid.reads.length,
      readsSha256: sha256(JSON.stringify(raid.reads)),
      candidates: raid.candidates.length,
    },
  });
  log(`RAID admitted ${admitted}; short cells: ${shortCells.length}`);
} catch (error) {
  log(`RAID skipped: ${(error as Error).message}`);
  sources.push({
    name: 'raid',
    status: 'skipped',
    reason: (error as Error).message,
    urls: [RAID_URL],
    revision: RAID_REVISION,
    licence: 'MIT',
    sampling: 'n/a',
    documents: 0,
  });
}

// ---------------------------------------------------------------------------------------
// Source 2: HC3, human and ChatGPT answers to the same questions, from pinned raw files.
// ---------------------------------------------------------------------------------------
const HC3_DATASET = 'Hello-SimpleAI/HC3';
const HC3_REVISION = '4d0ff18143b5a7e1b1e79beb540c04549d1e59d3';
const HC3_CONFIGS = ['reddit_eli5', 'finance', 'medicine', 'open_qa', 'wiki_csai'];
const HC3_MIN_WORDS = 40;
interface Hc3Row {
  question: string;
  human_answers: string[];
  chatgpt_answers: string[];
}
const hc3Url = (config: string): string =>
  `https://huggingface.co/datasets/${HC3_DATASET}/resolve/${HC3_REVISION}/${config}.jsonl`;

async function hc3Fetch(): Promise<{
  rows: Record<string, Hc3Row[]>;
  reads: Record<string, unknown>[];
  bytes: number;
}> {
  const startBytes = net.bytes;
  const rows: Record<string, Hc3Row[]> = {};
  const reads: Record<string, unknown>[] = [];
  const parseLines = (text: string, partialHead: boolean, partialTail: boolean): Hc3Row[] => {
    const lines = text.split('\n');
    if (partialHead) lines.shift();
    if (partialTail) lines.pop();
    return lines.flatMap((line) => {
      if (!line.trim()) return [];
      try {
        const r = JSON.parse(line) as Hc3Row;
        return typeof r.question === 'string' && Array.isArray(r.human_answers) ? [r] : [];
      } catch {
        return [];
      }
    });
  };
  for (const config of HC3_CONFIGS) {
    const url = hc3Url(config);
    const size = (await get(url, { range: [0, 0], cap: 1 })).total!;
    if (size <= 12 * 1024 * 1024) {
      const { bytes } = await get(url, { cap: 12 * 1024 * 1024 });
      reads.push({
        config,
        offset: 0,
        length: bytes.length,
        sha256: sha256(bytes),
        complete: true,
      });
      rows[config] = parseLines(new TextDecoder().decode(bytes), false, false);
    } else {
      // Large file: four 2 MiB reads at spread offsets, resynchronised at line breaks.
      rows[config] = [];
      const length = 2 * 1024 * 1024;
      for (let k = 0; k < 4; k++) {
        const offset = Math.floor((k * (size - length)) / 3);
        const { bytes } = await get(url, { range: [offset, offset + length - 1], cap: length });
        reads.push({
          config,
          offset,
          length: bytes.length,
          sha256: sha256(bytes),
          complete: false,
        });
        rows[config]!.push(
          ...parseLines(new TextDecoder().decode(bytes), offset > 0, offset + length < size)
        );
      }
    }
    log(`HC3 ${config}: ${rows[config]!.length} questions read`);
  }
  return { rows, reads, bytes: net.bytes - startBytes };
}

try {
  const hc3 = await cached('hc3-v4.json', hc3Fetch);
  let admitted = 0;
  const artefacts: Record<
    string,
    { documents: number; lineBreaks: number; literalBackslashN: number; tokenised: number }
  > = {};
  for (const config of HC3_CONFIGS) {
    const seen = new Set<string>();
    const questions = (hc3.rows[config] ?? [])
      .filter((r) => {
        const key = r.question.trim();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((r) => ({
        r,
        human: r.human_answers.find((a) => typeof a === 'string' && words(a) >= HC3_MIN_WORDS),
        chatgpt: (r.chatgpt_answers ?? []).find(
          (a) => typeof a === 'string' && words(a) >= HC3_MIN_WORDS
        ),
      }))
      // Questions with both answers first, so most pairs are matched; then sha256 order.
      .sort(
        (a, b) =>
          Number(!(a.human && a.chatgpt)) - Number(!(b.human && b.chatgpt)) ||
          order(a.r.question).localeCompare(order(b.r.question))
      );
    const n = { human: 0, chatgpt: 0 };
    for (const q of questions) {
      const key = sha256(`${config}\n${q.r.question}`).slice(0, 16);
      for (const kind of ['human', 'chatgpt'] as const) {
        const text = q[kind];
        if (!text || n[kind] >= CELL_CAP || text.length > MAX_TEXT) continue;
        n[kind]++;
        admitted++;
        artefacts[`${config}/${kind}`] ??= {
          documents: 0,
          lineBreaks: 0,
          literalBackslashN: 0,
          tokenised: 0,
        };
        const stats = artefacts[`${config}/${kind}`]!;
        stats.documents++;
        if (text.includes('\n')) stats.lineBreaks++;
        if (text.includes('\\n')) stats.literalBackslashN++;
        if (/ [,.] |n 't\b| 's\b/.test(text)) stats.tokenised++;
        docs.push({
          id: `hc3-${config}-${key}-${kind}`,
          sourceGroup: `hc3:${config}:${key}`,
          generatorFamily: kind,
          domain: `hc3-${config}`,
          language: 'en',
          source: 'digital',
          label: kind === 'human' ? 0 : 1,
          text,
          provenance: {
            corpusSource: 'hc3',
            fileExtension: 'txt',
            dataset: HC3_DATASET,
            revision: HC3_REVISION,
            config,
            questionSha256: sha256(q.r.question),
            question: q.r.question.slice(0, 300),
            answer: kind,
          },
        });
      }
    }
    log(`HC3 ${config}: ${n.human} human, ${n.chatgpt} chatgpt`);
  }
  sources.push({
    name: 'hc3',
    status: 'included',
    urls: HC3_CONFIGS.map(hc3Url),
    revision: HC3_REVISION,
    licence: 'CC BY-SA 4.0 (dataset card)',
    attribution: 'Guo et al., How Close is ChatGPT to Human Experts? (HC3), arXiv:2301.07597',
    sampling:
      `English configs ${HC3_CONFIGS.join(', ')}. Files up to 12 MiB are read whole; reddit_eli5 ` +
      `(55 MB) is read as four 2 MiB ranges at spread offsets with partial lines dropped. Per ` +
      `question, the first human and first ChatGPT answer with at least ${HC3_MIN_WORDS} words; up ` +
      `to ${CELL_CAP} of each per config, questions with both answers first, then sha256 order.`,
    notes: [
      'Text is kept exactly as published. HC3 removed or escaped many paragraph breaks: ChatGPT ' +
        'answers often join sentences with no space where a newline was, and some contain a ' +
        'literal backslash-n sequence instead of a line break. Line-structure rules therefore see ' +
        'less structure than the original chat output had.',
      'Many human answers are tokenised (a space before punctuation, contractions split as ' +
        '"ca n\'t"), and most have no line breaks, so HC3 human text is a weak control for ' +
        'line-structure rules. Per config and answer: documents, with a real line break, with a ' +
        `literal backslash-n, tokenised: ${JSON.stringify(artefacts)}`,
    ],
    documents: admitted,
    download: { bytes: hc3.bytes, reads: hc3.reads },
  });
} catch (error) {
  log(`HC3 skipped: ${(error as Error).message}`);
  sources.push({
    name: 'hc3',
    status: 'skipped',
    reason: (error as Error).message,
    urls: HC3_CONFIGS.map(hc3Url),
    revision: HC3_REVISION,
    licence: 'CC BY-SA 4.0',
    sampling: 'n/a',
    documents: 0,
  });
}

// ---------------------------------------------------------------------------------------
// Source 3: non-native English human essays.
// ---------------------------------------------------------------------------------------
const TOEFL_REPO = 'weixin-liang/ChatGPT-Detector-Bias';
const TOEFL_COMMIT = '1d05ed8242d4694a0ed7b73a79c52be8864470f9';
const TOEFL_URL = `https://raw.githubusercontent.com/${TOEFL_REPO}/${TOEFL_COMMIT}/Data_and_Results/Human_Data/TOEFL_real_91/data.json`;
const TOEFL_LICENCE_NOTE =
  'Unclear. The README shows an MIT badge, but the repository has no LICENSE file at ' +
  `${TOEFL_COMMIT}, and the 91 essays are third-party writing whose original source and rights ` +
  'are not stated in the repository.';
if (includeToefl) {
  try {
    const { bytes } = await cached('toefl-v4.json', async () => {
      const r = await get(TOEFL_URL, { cap: 1024 * 1024 });
      return { bytes: new TextDecoder().decode(r.bytes) };
    });
    const essays = JSON.parse(bytes) as { document: string }[];
    let admitted = 0;
    essays.forEach((e, i) => {
      if (typeof e.document !== 'string' || !e.document.trim()) return;
      admitted++;
      docs.push({
        id: `toefl-${String(i).padStart(3, '0')}`,
        sourceGroup: `toefl:${i}`,
        generatorFamily: 'human-nonnative',
        domain: 'toefl-essay',
        language: 'en',
        source: 'digital',
        label: 0,
        text: e.document,
        provenance: {
          corpusSource: 'toefl',
          fileExtension: 'txt',
          repository: TOEFL_REPO,
          commit: TOEFL_COMMIT,
          index: i,
        },
      });
    });
    sources.push({
      name: 'toefl',
      status: 'included',
      reason: 'Included because --include-toefl was passed by the operator.',
      urls: [TOEFL_URL],
      revision: TOEFL_COMMIT,
      licence: TOEFL_LICENCE_NOTE,
      attribution:
        'Liang et al., GPT detectors are biased against non-native English writers, 2023',
      sampling: 'All essays in TOEFL_real_91/data.json.',
      documents: admitted,
    });
  } catch (error) {
    sources.push({
      name: 'toefl',
      status: 'skipped',
      reason: (error as Error).message,
      urls: [TOEFL_URL],
      revision: TOEFL_COMMIT,
      licence: TOEFL_LICENCE_NOTE,
      sampling: 'n/a',
      documents: 0,
    });
  }
} else
  sources.push({
    name: 'toefl',
    status: 'skipped',
    reason: `${TOEFL_LICENCE_NOTE} Skipped by default; --include-toefl includes it after review.`,
    urls: [TOEFL_URL],
    revision: TOEFL_COMMIT,
    licence: TOEFL_LICENCE_NOTE,
    attribution: 'Liang et al., GPT detectors are biased against non-native English writers, 2023',
    sampling: 'n/a',
    documents: 0,
  });

// The English Language Learner Insight, Proficiency and Skills Evaluation (ELLIPSE)
// Corpus, https://github.com/scrosseye/ELLIPSE-Corpus, licensed CC BY-NC-SA 4.0
// (https://creativecommons.org/licenses/by-nc-sa/4.0/). Citation, as the repository gives
// it: Crossley, S. A., Tian, Y., Baffour, P., Franklin, A., Kim, Y., Morris, W., Benner, B.,
// Picou, A., & Boser, U. (2023). Measuring second language proficiency using the English
// Language Learner Insight, Proficiency and Skills Evaluation (ELLIPSE) Corpus.
// International Journal of Learner Corpus Research, 9(2), 248-269.
// Used here only as a local, non-commercial evaluation control for false positives on
// non-native English writing. The essays are read at evaluation time, stay under plans/,
// are never shipped, and no product behaviour or released calibration is built from them.
const ELLIPSE_REPO = 'scrosseye/ELLIPSE-Corpus';
const ELLIPSE_COMMIT = 'dc3b8f0b3b4332fc9f64302c4ccfc4ed582f4b43';
const ELLIPSE_URL = `https://raw.githubusercontent.com/${ELLIPSE_REPO}/${ELLIPSE_COMMIT}/ELLIPSE_Final_github_train.csv`;
const ELLIPSE_CAP = 300;
if (includeEllipse) {
  try {
    const raw = await cached('ellipse-v4.json', async () => {
      const r = await get(ELLIPSE_URL, { cap: 16 * 1024 * 1024 });
      return {
        text: new TextDecoder().decode(r.bytes),
        sha256: sha256(r.bytes),
        bytes: r.bytes.length,
      };
    });
    const rows = parseCsv(raw.text);
    const header = rows.shift() ?? [];
    const col = (name: string): number => {
      const i = header.indexOf(name);
      if (i < 0) throw new Error(`ELLIPSE column ${name} is missing; review the schema.`);
      return i;
    };
    const [cId, cText, cGrade, cOverall, cPrompt, cSet] = [
      col('text_id_kaggle'),
      col('full_text'),
      col('grade'),
      col('Overall'),
      col('prompt'),
      col('set'),
    ];
    const picked = rows
      .filter((r) => r.length === header.length && r[cId] && words(r[cText] ?? '') >= 40)
      .sort((a, b) => order(a[cId]!).localeCompare(order(b[cId]!)))
      .slice(0, ELLIPSE_CAP);
    for (const r of picked)
      docs.push({
        id: `ellipse-${r[cId]}`,
        sourceGroup: `ellipse:${r[cId]}`,
        generatorFamily: 'human-ell',
        domain: 'learner-essay',
        language: 'en',
        source: 'digital',
        label: 0,
        text: r[cText]!,
        provenance: {
          corpusSource: 'ellipse',
          fileExtension: 'txt',
          repository: ELLIPSE_REPO,
          commit: ELLIPSE_COMMIT,
          textId: r[cId],
          grade: r[cGrade],
          overall: r[cOverall],
          prompt: r[cPrompt],
          set: r[cSet],
        },
      });
    sources.push({
      name: 'ellipse',
      status: 'included',
      urls: [ELLIPSE_URL],
      revision: ELLIPSE_COMMIT,
      licence:
        'CC BY-NC-SA 4.0 (stated in the repository README). Local, non-commercial evaluation ' +
        'only; do not redistribute or build a released calibration on it without review.',
      attribution:
        'Crossley, S. A., Tian, Y., Baffour, P., Franklin, A., Kim, Y., Morris, W., Benner, B., ' +
        'Picou, A., & Boser, U. (2023). Measuring second language proficiency using the English ' +
        'Language Learner Insight, Proficiency and Skills Evaluation (ELLIPSE) Corpus. ' +
        'International Journal of Learner Corpus Research, 9(2), 248-269.',
      sampling: `Public train CSV (${raw.bytes} bytes, sha256 ${raw.sha256}). Essays with at least 40 words; ${ELLIPSE_CAP} chosen by sha256 order of text_id_kaggle.`,
      notes: [
        'Added as the non-native English control because the TOEFL licence is unclear. Writers ' +
          'are English language learners in US grades 8-12.',
      ],
      documents: picked.length,
    });
    log(`ELLIPSE: ${picked.length} essays`);
  } catch (error) {
    sources.push({
      name: 'ellipse',
      status: 'skipped',
      reason: (error as Error).message,
      urls: [ELLIPSE_URL],
      revision: ELLIPSE_COMMIT,
      licence: 'CC BY-NC-SA 4.0',
      sampling: 'n/a',
      documents: 0,
    });
  }
} else
  sources.push({
    name: 'ellipse',
    status: 'skipped',
    reason: 'Excluded by --no-ellipse.',
    urls: [ELLIPSE_URL],
    revision: ELLIPSE_COMMIT,
    licence: 'CC BY-NC-SA 4.0',
    sampling: 'n/a',
    documents: 0,
  });

// ---------------------------------------------------------------------------------------
// Source 4: presumed-human package READMEs, offline from installed node_modules.
// ---------------------------------------------------------------------------------------
const README_CAP = 300;
const LICENCE_FILE = /^(?:licen[cs]e|copying)(?:[-.](?:md|txt|markdown|mit|apache|bsd))*$/i;
const RECENT_YEAR = /\b20(?:2[2-9]|[3-9]\d)\b/;

async function packageDirs(nodeModules: string, depth: number, out: string[]): Promise<void> {
  if (depth > 5) return;
  let entries: import('node:fs').Dirent[];
  try {
    entries = await readdir(nodeModules, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    // Symbolic links are workspace packages or pnpm aliases; the real copy is walked instead.
    if (!e.isDirectory() || e.name === '.bin' || e.name === '.cache') continue;
    const path = join(nodeModules, e.name);
    if (e.name === '.pnpm') {
      for (const s of await readdir(path, { withFileTypes: true }).catch(() => []))
        if (s.isDirectory()) await packageDirs(join(path, s.name, 'node_modules'), depth + 1, out);
    } else if (e.name.startsWith('@')) {
      for (const s of await readdir(path, { withFileTypes: true }).catch(() => []))
        if (s.isDirectory()) {
          out.push(join(path, s.name));
          await packageDirs(join(path, s.name, 'node_modules'), depth + 1, out);
        }
    } else {
      out.push(path);
      await packageDirs(join(path, 'node_modules'), depth + 1, out);
    }
  }
}

function stripFences(markdown: string): { text: string; fences: number } {
  const out: string[] = [];
  let fence: string | null = null,
    fences = 0;
  for (const line of markdown.split('\n')) {
    const f = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (fence) {
      if (f && f[1]![0] === fence[0] && f[1]!.length >= fence.length) fence = null;
      continue;
    }
    if (f) {
      fence = f[1]!;
      fences++;
      continue;
    }
    out.push(line);
  }
  return { text: out.join('\n'), fences };
}

try {
  const roots = [join(ROOT, 'node_modules')];
  for (const parent of ['engine', 'packages', 'services', 'shells']) {
    const base = join(ROOT, parent);
    if (parent === 'engine') roots.push(join(base, 'node_modules'));
    else
      for (const e of await readdir(base, { withFileTypes: true }).catch(() => []))
        if (e.isDirectory()) roots.push(join(base, e.name, 'node_modules'));
  }
  const dirs: string[] = [];
  for (const r of roots) await packageDirs(r, 0, dirs);
  const reasons: Record<string, number> = {};
  const reject = (why: string): void => {
    reasons[why] = (reasons[why] ?? 0) + 1;
  };
  const eligible = new Map<string, Doc>();
  for (const dir of dirs.sort()) {
    let pkg: { name?: string; version?: string };
    let pkgText: string;
    try {
      pkgText = await readFile(join(dir, 'package.json'), 'utf8');
      pkg = JSON.parse(pkgText);
    } catch {
      reject('no package.json');
      continue;
    }
    if (!pkg.name) {
      reject('no package name');
      continue;
    }
    if (eligible.has(pkg.name)) {
      reject('duplicate package name');
      continue;
    }
    const files = await readdir(dir).catch(() => [] as string[]);
    const readmeName = files.find((f) => /^readme\.(?:md|markdown)$/i.test(f));
    if (!readmeName) {
      reject('no README.md');
      continue;
    }
    const years: number[] = [];
    const collectYears = (text: string): void => {
      for (const line of text.split('\n'))
        if (/copyright|\(c\)|©/i.test(line))
          for (const m of line.matchAll(/\b(19[7-9]\d|20\d\d)\b/g)) years.push(Number(m[1]));
    };
    for (const f of files.filter((f) => LICENCE_FILE.test(f)))
      collectYears(await readFile(join(dir, f), 'utf8').catch(() => ''));
    collectYears(pkgText);
    if (!years.length) {
      reject('no copyright year');
      continue;
    }
    if (Math.max(...years) > 2021) {
      reject('copyright year after 2021');
      continue;
    }
    const readme = await readFile(join(dir, readmeName), 'utf8');
    if (RECENT_YEAR.test(readme)) {
      reject('README mentions 2022 or later');
      continue;
    }
    const { text, fences } = stripFences(readme);
    const n = words(text);
    if (n < 150 || n > 3000 || text.length > MAX_TEXT) {
      reject('outside 150-3000 words');
      continue;
    }
    eligible.set(pkg.name, {
      id: `readme-${pkg.name}`,
      sourceGroup: `readme:${pkg.name}`,
      generatorFamily: 'human-presumed',
      domain: 'readme',
      language: 'und',
      source: 'digital',
      label: 0,
      text,
      provenance: {
        corpusSource: 'readme',
        fileExtension: 'md',
        package: pkg.name,
        version: pkg.version,
        path: relative(ROOT, join(dir, readmeName)),
        readmeSha256: sha256(readme),
        copyrightYearMax: Math.max(...years),
        codeFencesRemoved: fences,
        authorship: 'presumed human, not verified',
      },
    });
  }
  const picked = [...eligible.values()]
    .sort((a, b) => order(a.id).localeCompare(order(b.id)))
    .slice(0, README_CAP);
  docs.push(...picked);
  sources.push({
    name: 'readme',
    status: 'included',
    urls: roots.map((r) => relative(ROOT, r)),
    licence: 'Each package under its own licence; local reading of installed files only.',
    sampling:
      `README.md files of ${dirs.length} installed package directories (hoisted node_modules, ` +
      'nested node_modules and any .pnpm store, symbolic links not followed). Kept when a ' +
      'copyright line in LICENSE*/COPYING* or package.json names a year and the latest is 2021 or ' +
      'earlier, the README names no year from 2022 on, and the README is 150-3000 words after ' +
      `fenced code blocks are removed. Deduplicated by package name; ${README_CAP} chosen by sha256 order.`,
    notes: [
      'Authorship is presumed human from dates, not verified. A README edited after 2021 ' +
        'without a new year anywhere in it would pass the filter.',
      `Rejections: ${JSON.stringify(reasons)}; eligible ${eligible.size}.`,
    ],
    documents: picked.length,
  });
  log(`READMEs: ${picked.length} of ${eligible.size} eligible (${dirs.length} package dirs)`);
} catch (error) {
  sources.push({
    name: 'readme',
    status: 'skipped',
    reason: (error as Error).message,
    urls: [],
    licence: 'n/a',
    sampling: 'n/a',
    documents: 0,
  });
}

// ---------------------------------------------------------------------------------------
// Source 5: Claude chat answers, raw Markdown plus the plain text a rendered copy gives.
// ---------------------------------------------------------------------------------------

/**
 * The plain text that copying a rendered chat answer gives: emphasis, heading markers,
 * backticks, bullet markers, link syntax, blockquote markers, rules and table pipes go;
 * line breaks and the words stay. Numbered list labels stay. Indentation is removed
 * because rendered text has none, and nothing is added at the start of a line.
 */
function plainFromMarkdown(markdown: string): string {
  const out: string[] = [];
  let fence: string | null = null;
  for (const line of markdown.split('\n')) {
    const f = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
    if (fence) {
      if (f && f[1]![0] === fence[0] && f[1]!.length >= fence.length) fence = null;
      else out.push(line);
      continue;
    }
    if (f) {
      fence = f[1]!;
      continue;
    }
    if (/^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/.test(line)) continue;
    if (/^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(line) && line.includes('|'))
      continue;
    let s = line.replace(/^(?:\s*>\s?)+/, '');
    if (/^\s{0,3}#{1,6}\s/.test(s)) s = s.replace(/^\s{0,3}#{1,6}\s+/, '').replace(/\s+#+\s*$/, '');
    s = s.replace(/^\s*[-*+]\s+(?:\[[ xX]\]\s+)?/, '');
    if (/^\s*\|.*\|\s*$/.test(s))
      s = s
        .trim()
        .replace(/^\||\|$/g, '')
        .split('|')
        .map((c) => c.trim())
        .join('\t');
    s = s
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/__(.+?)__/g, '$1')
      .replace(/\*\*|__/g, '')
      .replace(/(^|[^\w*])\*(?=\S)([^*\n]*?\S)\*(?![\w*])/g, '$1$2')
      .replace(/(^|[^\w_])_(?=\S)([^_\n]*?\S)_(?![\w_])/g, '$1$2')
      .replace(/`+/g, '')
      .replace(/\\([\\`*_{}[\]()#+\-.!|>])/g, '$1');
    out.push(s.trim());
  }
  return out.join('\n');
}

const generatedDir = join(destination, 'generated');
const promptsPath = join(destination, 'prompts.json');
let prompts: string[] = [];
try {
  prompts = JSON.parse(await readFile(promptsPath, 'utf8')) as string[];
} catch {
  /* Prompts are optional context; the answers still carry their prompt index. */
}
for (const stem of ['opus', 'sonnet', 'haiku']) {
  const path = join(generatedDir, `${stem}.jsonl`);
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch {
    sources.push({
      name: `claude-${stem}`,
      status: 'skipped',
      reason: `${relative(ROOT, path)} does not exist yet; re-run once it does.`,
      urls: [relative(ROOT, path)],
      licence: 'Generated for this evaluation.',
      sampling: 'n/a',
      documents: 0,
    });
    log(`claude-${stem}: not present`);
    continue;
  }
  let admitted = 0,
    malformed = 0;
  const ids = new Set<string>();
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    let row: { id?: unknown; promptIndex?: unknown; generator?: unknown; text?: unknown };
    try {
      row = JSON.parse(line);
    } catch {
      malformed++;
      continue;
    }
    if (
      typeof row.text !== 'string' ||
      !row.text.trim() ||
      typeof row.promptIndex !== 'number' ||
      !Number.isInteger(row.promptIndex) ||
      row.text.length > MAX_TEXT
    ) {
      malformed++;
      continue;
    }
    const rowId = typeof row.id === 'string' && row.id ? row.id : String(row.promptIndex);
    const baseId = `claude-${rowId.startsWith(`${stem}-`) ? rowId : `${stem}-${rowId}`}`;
    if (ids.has(baseId)) {
      malformed++;
      continue;
    }
    ids.add(baseId);
    const group = `prompt-${String(row.promptIndex).padStart(2, '0')}`;
    const provenance = {
      corpusSource: 'claude-generated',
      file: relative(ROOT, path),
      fileSha256: sha256(raw),
      rowId: row.id,
      generator: row.generator,
      promptIndex: row.promptIndex,
      prompt: prompts[row.promptIndex] ?? null,
    };
    const base = {
      sourceGroup: group,
      generatorFamily: `claude-${stem}`,
      language: 'und',
      source: 'digital' as const,
      label: 1 as const,
    };
    docs.push({
      ...base,
      id: baseId,
      domain: 'chat-answer',
      text: row.text,
      provenance: { ...provenance, fileExtension: 'md', variant: 'markdown' },
    });
    docs.push({
      ...base,
      id: `${baseId}-plain`,
      domain: 'chat-answer-plain',
      text: plainFromMarkdown(row.text),
      provenance: { ...provenance, fileExtension: 'txt', variant: 'plain-copy' },
    });
    admitted += 2;
  }
  sources.push({
    name: `claude-${stem}`,
    status: 'included',
    urls: [relative(ROOT, path)],
    licence: 'Generated for this evaluation.',
    sampling:
      `Every well-formed row of ${stem}.jsonl (prompts in prompts.json). Each answer appears twice: ` +
      'raw Markdown (domain chat-answer, read as .md) and a plain-text copy (domain ' +
      'chat-answer-plain, read as .txt) made by plainFromMarkdown in this script.',
    notes: [`File sha256 ${sha256(raw)}; malformed or duplicate rows skipped: ${malformed}.`],
    documents: admitted,
  });
  log(`claude-${stem}: ${admitted} documents (${malformed} skipped)`);
}

// ---------------------------------------------------------------------------------------
// Splits, invariants, output.
// ---------------------------------------------------------------------------------------
const seenIds = new Set<string>();
for (const d of docs) {
  if (seenIds.has(d.id)) throw new Error(`Duplicate document id ${d.id}.`);
  seenIds.add(d.id);
  if (!d.sourceGroup || ![0, 1].includes(d.label) || !d.text)
    throw new Error(`Invalid row ${d.id}.`);
  d.split = splitOf(d.sourceGroup);
}
const groupSplit = new Map<string, string>();
for (const d of docs) {
  const prior = groupSplit.get(d.sourceGroup);
  if (prior && prior !== d.split)
    throw new Error(`Source group ${d.sourceGroup} spans both splits.`);
  groupSplit.set(d.sourceGroup, d.split!);
}
const rows = docs.map((d) => ({
  id: d.id,
  sourceGroup: d.sourceGroup,
  generatorFamily: d.generatorFamily,
  domain: d.domain,
  language: d.language,
  source: d.source,
  label: d.label,
  text: d.text,
  provenance: d.provenance,
  split: d.split,
}));
const body = rows.map((d) => JSON.stringify(d)).join('\n') + '\n';
const tally = (key: (d: (typeof rows)[number]) => string): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const d of rows) out[key(d)] = (out[key(d)] ?? 0) + 1;
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
};
const corpusSource = (d: (typeof rows)[number]): string => String(d.provenance.corpusSource);
const manifest = {
  profile: 'lolly/forensic-corpus-v4',
  date: new Date().toISOString(),
  purpose:
    'Development measurement of per-rule firing rates on human and AI text. Not representative ' +
    'of deployment and not a released calibration.',
  rowShape:
    'v1 shape (id, sourceGroup, generatorFamily, domain, language, source, label, text, ' +
    'provenance) plus split. provenance.corpusSource names the source; provenance.fileExtension ' +
    '(md or txt) is the file type a Verify upload of the document would have.',
  split: {
    rule: `sha256("${SPLIT_SALT}" + sourceGroup); first 32 bits / 2^32 < ${DEV_FRACTION} is dev, else holdout.`,
    salt: SPLIT_SALT,
    devFraction: DEV_FRACTION,
    groups: groupSplit.size,
  },
  language: 'en only where the source states English; und otherwise.',
  textPolicy: `Text kept exactly as the source gives it, except README fenced code removal and the plain-copy variant. Documents over ${MAX_TEXT} characters are excluded (the Verify text cap).`,
  pretrainedExposure:
    'Unverified; public sources may be in the training data of current models and classifiers.',
  sources,
  counts: {
    bySourceLabelSplit: tally((d) => `${corpusSource(d)}|${d.label ? 'ai' : 'human'}|${d.split}`),
    byDomainLabelSplit: tally((d) => `${d.domain}|${d.label ? 'ai' : 'human'}|${d.split}`),
    byGeneratorLabel: tally((d) => `${d.generatorFamily}|${d.label ? 'ai' : 'human'}`),
    byLabelSplit: tally((d) => `${d.label ? 'ai' : 'human'}|${d.split}`),
    cells: tally(
      (d) =>
        `${corpusSource(d)}|${d.domain}|${d.generatorFamily}|${d.label ? 'ai' : 'human'}|${d.split}`
    ),
  },
  download: { bytesThisRun: net.bytes, requestsThisRun: net.requests, budget: BYTE_BUDGET },
  documents: rows.length,
  documentsSha256: sha256(body),
  sha256: await productionDigest(rows),
};
await mkdir(destination, { recursive: true });
await writeFile(join(destination, 'documents.jsonl'), body);
await writeFile(join(destination, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
log(
  `wrote ${rows.length} documents to ${relative(ROOT, destination)} (sha256 ${manifest.documentsSha256})`
);
console.log(
  JSON.stringify(
    { documents: rows.length, bySourceLabelSplit: manifest.counts.bySourceLabelSplit },
    null,
    1
  )
);
