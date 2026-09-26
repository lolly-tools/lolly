// SPDX-License-Identifier: MPL-2.0
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { SourceMap } from 'node:module';
import type { LoadSpan } from './lib/collab-load-browser.ts';
const file = process.argv[2]!;
const dist = process.argv[3]!;
if (!file || !dist) throw new Error('usage: node scripts/analyze-collab-render-load.ts report.json built-dist');
const report = JSON.parse(readFileSync(file, 'utf8'));
const summary = (values: number[]) => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  return { n: sorted.length, p50: sorted[Math.floor(sorted.length / 2)], p95: sorted[Math.ceil(sorted.length * .95) - 1], max: sorted.at(-1) };
};
const phases: Record<string, unknown> = {};
for (const phase of ['baseline', 'loaded']) {
  const values: Record<string, number[]> = {};
  const add = (key: string, value: number | undefined) => {
    if (value === undefined) return;
    values[key] ??= [];
    values[key].push(value);
  };
  for (const input of report[phase].inputs) {
    const alice: LoadSpan[] = report.browserSpans.alice.filter((span: LoadSpan) => span.sample === input.sample);
    const bob: LoadSpan[] = report.browserSpans.bob.filter((span: LoadSpan) => span.sample === input.sample);
    const sent = alice.find(span => span.kind === 'ws-send');
    const received = bob.find(span => span.kind === 'ws-receive-ops');
    const save = alice.filter(span => span.kind === 'idb-readwrite' && span.stores?.includes('profile') && span.end <= (sent?.start ?? 0)).at(-1);
    add('inputToSendMs', sent ? sent.start - input.at : undefined);
    add('outboxTransactionMs', save ? save.end - save.start : undefined);
    add('sendToPeerReceiveMs', sent && received ? received.start - sent.start : undefined);
    add('peerReceiveToDomMs', received ? input.dom - received.start : undefined);
    add('domToFramesMs', input.painted - input.dom);
    const commit = report.serverCommits.find((span: LoadSpan) => sent && received && span.start >= sent.start && span.end <= received.start);
    add('serverCommitMs', commit ? commit.end - commit.start : undefined);
  }
  phases[phase] = Object.fromEntries(Object.entries(values).map(([key, values]) => [key, summary(values)]));
}
const maps = new Map<string, SourceMap>();
const scanLines = new Map<string, Set<number>>();
const profiles: Record<string, unknown> = {};
const nativeCallers: Record<string, unknown> = {};
const fidelityScanSampledMs: Record<string, number> = {};
for (const peer of ['alice', 'bob']) {
  const profile = JSON.parse(readFileSync(`${file}.${peer}.cpuprofile`, 'utf8'));
  type Frame = { functionName: string; url: string; lineNumber: number; columnNumber: number };
  const nodes = new Map<number, { callFrame: Frame; children?: number[] }>(profile.nodes.map((node: { id: number }) => [node.id, node]));
  const parents = new Map<number, number>();
  for (const [id, node] of nodes) for (const child of node.children ?? []) parents.set(child, id);
  const labelFor = (frame: Frame) => {
    const mapFile = resolve(dist, '_app', basename(frame.url) + '.map');
    if (!maps.has(mapFile) && existsSync(mapFile)) {
      const payload = JSON.parse(readFileSync(mapFile, 'utf8'));
      maps.set(mapFile, new SourceMap(payload));
      const index = payload.sources.findIndex((source: string) => source.endsWith('/tool-actions/dims.ts'));
      const lines: string[] = (payload.sourcesContent[index] ?? '').split('\n');
      const scan = new Set<number>();
      let inside = false;
      for (const [line, text] of lines.entries()) {
        if (text.startsWith('export function ')) inside = /^export function canvas(UsesBackdropFilter|HasPerspectivePose)\(/.test(text);
        if (inside) scan.add(line);
      }
      scanLines.set(mapFile, scan);
    }
    const map = maps.get(mapFile);
    const source = map && frame.lineNumber >= 0 ? map.findEntry(frame.lineNumber, frame.columnNumber) : null;
    if (source && 'originalSource' in source && 'originalLine' in source && typeof source.originalLine === 'number') return {
      label: `${source.originalSource}:${source.originalLine + 1} ${'name' in source && source.name || frame.functionName}`,
      scan: String(source.originalSource).endsWith('/tool-actions/dims.ts') && Boolean(scanLines.get(mapFile)?.has(source.originalLine)),
    };
    return { label: `${frame.url ? basename(frame.url) + ':' + (frame.lineNumber + 1) : ''} ${frame.functionName}`, scan: false };
  };
  const times = new Map<string, number>(), callers = new Map<string, number>();
  fidelityScanSampledMs[peer] = 0;
  for (const [index, id] of profile.samples.entries()) {
    const frame = nodes.get(id)!.callFrame;
    if (['(idle)', '(root)'].includes(frame.functionName)) continue;
    const { label, scan } = labelFor(frame), ms = profile.timeDeltas[index] / 1000;
    if (scan) fidelityScanSampledMs[peer] += ms;
    times.set(label, (times.get(label) ?? 0) + ms);
    if (!frame.url && frame.functionName && !frame.functionName.startsWith('(')) {
      for (let parent = parents.get(id); parent !== undefined; parent = parents.get(parent)) {
        const caller = nodes.get(parent)!.callFrame;
        if (!caller.url) continue;
        const name = `${frame.functionName} <- ${labelFor(caller).label}`;
        callers.set(name, (callers.get(name) ?? 0) + ms);
        break;
      }
    }
  }
  nativeCallers[peer] = [...callers].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([source, sampledMs]) => ({ source, sampledMs }));
  profiles[peer] = [...times].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([source, sampledMs]) => ({ source, sampledMs }));
}
const processes: Record<string, { peakRssMiB: number; sampledCpuSeconds: number }> = {};
for (const sample of report.processSamples) for (const [name, group] of Object.entries(sample.groups) as [string, { rss: number; cpuSeconds: number }][]) {
  processes[name] ??= { peakRssMiB: 0, sampledCpuSeconds: 0 };
  const current = processes[name];
  current.peakRssMiB = Math.max(current.peakRssMiB, group.rss / 1024 ** 2);
  current.sampledCpuSeconds = Math.max(current.sampledCpuSeconds, group.cpuSeconds);
}
const result = { phases, processes, profiles, nativeCallers, fidelityScanSampledMs };
writeFileSync(file + '.analysis.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
