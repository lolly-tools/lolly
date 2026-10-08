// SPDX-License-Identifier: MPL-2.0
/** node:test spec reporter which also emits machine-readable skipped-test identities. */

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { tap } from 'node:test/reporters';
import type { BrowserPartitionMetadata, FileSummary, TestSummary } from '../../scripts/browser-partitions.ts';

interface TestNode {
  file: string;
  name: string;
  parentId?: number;
}

export interface SkipIdentity {
  file: string;
  fullName: string;
  reason: string;
  capability: string;
  owner: string;
}

export function capabilityFor(reason: string): string {
  const value = reason.toLowerCase();
  if (/chromium|browser|playwright|web\/dist/.test(value)) return 'browser';
  if (/suse|brand pack|brand\.json|font/.test(value)) return 'brand:suse';
  if (/both packs|pack not mounted|packs are needed|packs need mounting/.test(value)) return 'brand:profiles';
  if (/qpdf|c2patool|ffmpeg|ffprobe|imagemagick|skera|binary|executable/.test(value)) return 'external-tool';
  if (/fixture|sample|penpot|profile/.test(value)) return 'fixture';
  if (/model|kokoro|whisper|weights/.test(value)) return 'model';
  if (/macos|windows|linux|platform/.test(value)) return 'platform';
  if (/bench|timing|perf/.test(value)) return 'benchmark';
  if (/built \/info|build:info|page seals|linked chrome/.test(value)) return 'docs-build';
  // A live service whose token only a person signing in can grant: no variable enables it.
  if (/oauth|signing in|sign in|credential/.test(value)) return 'credentials';
  // The store under test does not offer what the case checks, on any machine.
  if (/no write precondition/.test(value)) return 'service-limit';
  if (/env|set |opt-in|enabled/.test(value)) return 'environment';
  return 'unspecified';
}

export function ownerFor(file: string): string {
  const parts = file.split('/');
  if (parts[0] === 'shells' || parts[0] === 'services' || parts[0] === 'packages') return parts.slice(0, 2).join('/');
  return parts[0] || 'root';
}

function normalizedFile(file: unknown): string {
  if (typeof file !== 'string') return '<unknown>';
  return path.relative(process.cwd(), file).replaceAll(path.sep, '/');
}

export default async function* skipIdentityReporter(source: AsyncIterable<Record<string, any>>): AsyncGenerator<string> {
  const nodes = new Map<string, TestNode>();
  const skips: SkipIdentity[] = [];
  const metadata = process.env.LOLLY_TEST_COVERAGE_METADATA
    ? JSON.parse(process.env.LOLLY_TEST_COVERAGE_METADATA) as BrowserPartitionMetadata : undefined;
  const summaries: FileSummary[] = [];
  let runSummary: TestSummary | null = null;
  const tee = async function* (): AsyncGenerator<Record<string, any>> {
    for await (const event of source) {
      const data = event.data ?? {};
      if (metadata && event.type === 'test:summary') {
        const summary: TestSummary = { success: data.success, durationMs: data.duration_ms, counts: data.counts };
        if (typeof data.file === 'string') summaries.push({ ...summary, file: normalizedFile(data.entryFile ?? data.file) });
        else runSummary = summary;
      }
      // `file` is where test() was called, which can be a shared helper imported by
      // several test files. `entryFile` (Node 24.20+) is the test file that ran, so
      // the identity names the file a shard actually runs, and test ids, which are
      // only unique within one file's process, cannot collide across files.
      const file = normalizedFile(data.entryFile ?? data.file);
      const key = `${file}\0${String(data.testId ?? '')}`;
      if (event.type === 'test:start') {
        nodes.set(key, { file, name: String(data.name ?? ''), parentId: data.parentId });
      }
      if (event.type === 'test:pass' && data.skip && data.details?.type !== 'suite') {
        const names = [String(data.name ?? '')];
        let parentId = data.parentId;
        const seen = new Set<number>();
        while (typeof parentId === 'number' && !seen.has(parentId)) {
          seen.add(parentId);
          const parent = nodes.get(`${file}\0${String(parentId)}`);
          if (!parent) break;
          names.unshift(parent.name);
          parentId = parent.parentId;
        }
        const reason = typeof data.skip === 'string' ? data.skip.trim() : '';
        skips.push({
          file,
          fullName: names.filter(Boolean).join(' > '),
          reason,
          capability: capabilityFor(reason),
          owner: ownerFor(file),
        });
      }
      yield event;
    }
  };
  for await (const line of tap(tee() as Parameters<typeof tap>[0])) yield line;
  const output = process.env.LOLLY_SKIP_REPORT;
  if (output) {
    const absolute = path.resolve(output);
    mkdirSync(path.dirname(absolute), { recursive: true });
    skips.sort((a, b) => `${a.file}\0${a.fullName}`.localeCompare(`${b.file}\0${b.fullName}`));
    writeFileSync(absolute, `${JSON.stringify({ schemaVersion: 1, skips }, null, 2)}\n`);
  }
  const coverageOutput = process.env.LOLLY_TEST_COVERAGE_REPORT;
  if (metadata && coverageOutput) {
    const absolute = path.resolve(coverageOutput);
    mkdirSync(path.dirname(absolute), { recursive: true });
    writeFileSync(absolute, `${JSON.stringify({ ...metadata, summaries, runSummary }, null, 2)}\n`);
  }
}
