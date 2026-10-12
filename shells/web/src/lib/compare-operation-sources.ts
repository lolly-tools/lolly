// SPDX-License-Identifier: MPL-2.0
import type { ComparisonRequest, ComparisonSource, HostV1, VisualComparisonRequest } from '@lolly-tools/core/host-v1';
import type { FileFactsV1 } from '@lolly-tools/core/file-v1';
import { assetComparisonMode } from './compare-asset-sources.ts';
import { comparisonFileSource, comparisonRequest, type ContentComparisonMode, type ContentComparisonOverride } from './compare-sources.ts';
import { comparisonVisualSource } from './compare-visual-sources.ts';

export type OperationComparisonPair = { mode: 'visual'; request: VisualComparisonRequest }
  | { mode: ContentComparisonMode; request: ComparisonRequest };

/** History retains the copy only. A reselected original must match its recorded hash. */
export async function verifyComparisonOriginal(file: File, expected: FileFactsV1, signal?: AbortSignal): Promise<void> {
  signal?.throwIfAborted();
  if (!expected.sha256) throw new Error('The original hash was not recorded. This operation cannot verify a reselected original.');
  if (file.size !== expected.size) throw new Error('That file does not match the recorded original.');
  if (file.size > 32 * 1024 * 1024) throw new Error('Choose files up to 32 MiB per side.');
  const bytes = await file.arrayBuffer();
  signal?.throwIfAborted();
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  signal?.throwIfAborted();
  const hash = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
  if (hash !== expected.sha256) throw new Error('That file does not match the recorded original.');
}

/** Files are immutable snapshots. Decoding and comparison use the existing shared paths. */
export async function operationComparisonPair(before: File, after: File, host: HostV1, signal?: AbortSignal, override?: ContentComparisonOverride): Promise<OperationComparisonPair> {
  signal?.throwIfAborted();
  if (override === undefined && [before, after].every(file => /\.docx$/i.test(file.name))) {
    if (!host.prepare || before.size > 32 * 1024 * 1024 || after.size > 32 * 1024 * 1024) throw new Error('DOCX property review is not supported for this pair.');
    const sides: ComparisonSource[] = [];
    for (const [index, file] of [before, after].entries()) {
      const bytes = new Uint8Array(await file.arrayBuffer()); signal?.throwIfAborted();
      const inspection = await host.prepare.inspect([{ id: 'document', name: file.name, bytes }]); signal?.throwIfAborted();
      if (!inspection.scopes.find(s => s.id === 'document')?.actions?.includes('remove-property')) throw new Error('DOCX property review is not supported for this file. It remains inspect-only.');
      const findings = inspection.findings.filter(f => f.action === 'remove-property');
      if (findings.some(f => !f.propertyId) || new Set(findings.map(f => f.propertyId)).size !== findings.length) throw new Error('DOCX property identities could not be verified.');
      const properties = Object.fromEntries(findings.map(f => [f.propertyId!, { label: f.label, location: f.location, value: f.value }]));
      sides.push({ identity: { id: index ? 'docx-copy' : 'docx-original', kind: 'file', label: index ? 'Copy document properties' : 'Original document properties' }, bytes,
        content: { kind: 'structure', value: properties }, fidelity: { level: 'partial', limitations: ['Only supported DOCX core and custom properties are compared. Visible content, rendered appearance and other package data are not compared.'] } });
    }
    return { mode: 'json', request: { version: 1, before: sides[0]!, after: sides[1]!, options: { mode: 'structure' } } };
  }
  const mode = override ?? assetComparisonMode([before, after].map(file => ({ format: file.name.split('.').pop()?.toLowerCase() ?? '' })));
  if (!mode) throw new Error('Comparison supports text, JSON, YAML, tables, documents, images and PDF pages. This file pair is not supported.');
  if (mode === 'visual') {
    const pair = await Promise.all([before, after].map(file => comparisonVisualSource(file, host, signal)));
    return { mode, request: { version: 1, before: pair[0]!, after: pair[1]! } };
  }
  const pair = await Promise.all([before, after].map(file => comparisonFileSource(file, mode, signal)));
  return { mode, request: comparisonRequest(pair[0]!, pair[1]!, mode) };
}
