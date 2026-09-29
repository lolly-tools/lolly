#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
import { Worker } from 'node:worker_threads';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { FIXTURES } from './layout-lab/fixtures.ts';
import { prepareCandidates } from './layout-lab/candidates.ts';
import { resultFor, rulesRanking, scoreResult, summarize } from './layout-lab/ranking.ts';
import { METHODS, type ExperimentResult, type Method, type Fixture } from './layout-lab/types.ts';
import type { CorpusCase, CorpusIndex } from './layout-lab/corpus.ts';
import type { LayoutFeaturesV1 } from '../packages/core/src/rebrand-v1.ts';
import { ENGINE_VERSION } from '../engine/src/version.ts';

const args = new Map(process.argv.slice(2).map(a => { const at = a.indexOf('='); return at < 0 ? [a, 'true'] : [a.slice(0, at), a.slice(at + 1)]; }));
const known = new Set(['--help', '--serve', '--port', '--methods', '--limit', '--out', '--case', '--rotate', '--timeout', '--corpus']);
for (const key of args.keys()) if (!known.has(key)) throw new Error(`Unknown option: ${key}`);
if (args.has('--help')) {
  console.log('node scripts/layout-lab.ts --serve [--port=4317] [--corpus=directory]\nnode scripts/layout-lab.ts [--methods=rules,embed,choice,json] [--corpus=directory] [--case=id] [--limit=18] [--rotate=1] [--timeout=120000] [--out=plans/scratch/layout-lab/report.json]');
} else if (args.has('--serve')) {
  const port = Number(args.get('--port') ?? 4317);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid port.');
  await (await import('./layout-lab/server.ts')).serve(port, args.get('--corpus'));
} else {
  const methods = (args.get('--methods') ?? 'rules').split(',');
  if (methods.some(m => !METHODS.includes(m as Method))) throw new Error('Unknown ranking method.');
  let corpusSize: number | undefined;
  let sourceFixtures: Array<Fixture & { features?: LayoutFeaturesV1 }> = FIXTURES;
  if (args.has('--corpus')) {
    const base = path.resolve(args.get('--corpus')!);
    const corpus = JSON.parse(readFileSync(path.join(base, 'index.json'), 'utf8')) as CorpusIndex;
    corpusSize = corpus.cases.length;
    sourceFixtures = corpus.cases.filter(c => c.status === 'ready').map(c => {
      if (!/^[a-f0-9]{16}-p[1-9][0-9]*$/.test(c.id)) throw new Error('Invalid corpus case id.');
      const one = JSON.parse(readFileSync(path.join(base, 'cases', `${c.id}.json`), 'utf8')) as CorpusCase;
      if (!one.brief) throw new Error('A ready corpus case has no brief.');
      return { brief: one.brief, acceptable: [], features: one.features };
    });
  }
  const limit = Number(args.get('--limit') ?? sourceFixtures.length);
  const rotate = Number(args.get('--rotate') ?? 0);
  const timeout = Number(args.get('--timeout') ?? 120_000);
  if (!Number.isInteger(limit) || limit < 1 || !Number.isInteger(rotate) || rotate < 0 || !Number.isFinite(timeout) || timeout < 100) throw new Error('Invalid experiment budget.');
  const fixtures = sourceFixtures.filter(f => !args.has('--case') || f.brief.id === args.get('--case')).slice(0, limit);
  if (!fixtures.length) throw new Error('No matching fixture.');
  let worker: Worker | undefined;
  const rows: ExperimentResult[] = [];
  const out = path.resolve(args.get('--out') ?? 'plans/scratch/layout-lab/report.json');
  const save = (): void => {
    mkdirSync(path.dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify({ version: 1, created: new Date().toISOString(), engine: ENGINE_VERSION, corpus: corpusSize === undefined ? 'synthetic' : { slides: corpusSize, eligible: sourceFixtures.length, labels: 'none' }, environment: { node: process.version, platform: process.platform, arch: process.arch, cpu: os.cpus()[0]?.model }, rotate, summary: summarize(rows), results: rows }, null, 2));
  };
  try {
    for (const fixture of fixtures) {
      const prepared = prepareCandidates(fixture.brief, fixture.features);
      const n = prepared.eligible.length;
      const offset = n ? rotate % n : 0;
      const candidates = [...prepared.eligible.slice(offset), ...prepared.eligible.slice(0, offset)];
      for (const method of methods as Method[]) {
        let result: ExperimentResult;
        if (method === 'rules' || !n) result = resultFor(fixture.brief, candidates, method, rulesRanking(prepared.eligible), { backend: 'rules', loadMs: 0, inferenceMs: 0 });
        else {
          worker ??= new Worker(new URL('./layout-lab/node-worker.ts', import.meta.url));
          const current = worker;
          result = await new Promise<ExperimentResult>(resolve => {
            const cleanup = (): void => { clearTimeout(timer); current.off('message', onMessage); current.off('error', onError); current.off('exit', onExit); };
            const failed = (error: string): void => { cleanup(); resolve(resultFor(fixture.brief, candidates, method, { ids: [], valid: false, raw: '', error }, { backend: 'node-cpu', loadMs: 0, inferenceMs: performance.now() - start })); };
            const onMessage = (value: ExperimentResult): void => { cleanup(); resolve(value); };
            const onError = (error: Error): void => { worker = undefined; failed(error.message); };
            const onExit = (code: number): void => { worker = undefined; failed(`Worker exited (${code}).`); };
            const start = performance.now();
            const timer = setTimeout(() => { worker = undefined; failed('Inference timed out; worker terminated.'); void current.terminate(); }, timeout);
            current.once('message', onMessage); current.once('error', onError); current.once('exit', onExit);
            current.postMessage({ brief: fixture.brief, candidates, method });
          });
        }
        rows.push(scoreResult(result, fixture));
        save();
        console.log(`${fixture.brief.id.padEnd(22)} ${method.padEnd(6)} ${result.valid ? result.ids.join(', ') : result.error} (${Math.round(result.inferenceMs)} ms)`);
      }
    }
  } finally { await worker?.terminate(); }
  console.table(summarize(rows));
  console.log(`Report: ${out}`);
}
