// SPDX-License-Identifier: MPL-2.0
/** Bounded download of a labelled RAID development corpus, with source history. */
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sha256Hex } from '../engine/src/bytes.ts';
import { productionDigest } from '../engine/src/production/contract.ts';
const destination = resolve(process.argv[2] ?? 'plans/287-verify-forensics/corpus');
const dataset = 'liamdugan/raid',
  revision = '865cac74188466cb0c3b7574a10204007b57a459';
const url = `https://huggingface.co/datasets/${dataset}/resolve/${revision}/train.csv`;
const byteCap = 16 * 1024 * 1024;
const response = await fetch(url, {
  headers: { Range: `bytes=0-${byteCap - 1}` },
  signal: AbortSignal.timeout(60_000),
});
if (response.status !== 206 || !response.headers.get('content-range')?.startsWith('bytes 0-'))
  throw new Error('Corpus server did not honour the bounded download.');
const raw = new Uint8Array(await response.arrayBuffer());
if (raw.length > byteCap) throw new Error('Corpus download exceeded its byte budget.');
const text = new TextDecoder().decode(raw),
  rows: string[][] = [];
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
const header = rows.shift()!;
if (
  header.join(',') !==
  'id,adv_source_id,source_id,model,decoding,repetition_penalty,attack,domain,title,prompt,generation'
)
  throw new Error('RAID schema changed. Review before admitting labels.');
const counts = new Map<string, number>(),
  documents: Record<string, unknown>[] = [];
for (const fields of rows) {
  if (fields.length !== header.length) continue;
  const r = Object.fromEntries(header.map((key, i) => [key, fields[i]!])) as Record<string, string>;
  if (r.attack !== 'none' || !r.generation || !/^[\da-f-]{36}$/i.test(r.id!) || !r.source_id)
    continue;
  const key = `${r.domain}/${r.model}`,
    n = counts.get(key) ?? 0;
  if (n >= 200) continue;
  counts.set(key, n + 1);
  documents.push({
    id: r.id,
    sourceGroup: r.source_id,
    generatorFamily: r.model,
    domain: r.domain,
    language: 'en',
    source: 'digital',
    label: r.model === 'human' ? 0 : 1,
    text: r.generation,
    provenance: {
      dataset,
      revision,
      sourceId: r.source_id,
      adversarialSourceId: r.adv_source_id,
      model: r.model,
      attack: r.attack,
      decoding: r.decoding,
      repetitionPenalty: r.repetition_penalty,
      title: r.title,
      promptSha256: await productionDigest(r.prompt),
    },
  });
}
const manifest = {
  profile: 'lolly/forensic-corpus-v1',
  source: `https://huggingface.co/datasets/${dataset}`,
  revision,
  license: 'MIT (dataset card); upstream human-source licences remain applicable',
  attribution: 'Dugan et al., RAID, ACL 2024',
  date: new Date().toISOString(),
  purpose:
    'Development and baseline evaluation; not representative of deployment and not a released calibration.',
  sampling:
    'Complete clean rows in a bounded 16 MiB CSV prefix; up to 200 per domain/model. The incomplete final row is discarded. Source groups must remain in one split.',
  pretrainedExposure:
    'Unverified; no claim that the classifier has never seen these source documents.',
  rawSha256: await sha256Hex(raw),
  counts: Object.fromEntries(counts),
  documents: documents.length,
  sha256: await productionDigest(documents),
};
await mkdir(destination, { recursive: true });
await writeFile(
  resolve(destination, 'documents.jsonl'),
  documents.map((d) => JSON.stringify(d)).join('\n') + '\n'
);
await writeFile(resolve(destination, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(
  JSON.stringify({
    documents: documents.length,
    counts: Object.fromEntries(counts),
    digest: manifest.sha256,
  })
);
