// SPDX-License-Identifier: MPL-2.0
import type { ComparisonRequest, HostV1, VisualComparisonRequest } from '@lolly-tools/core/host-v1';
import type { FileFactsV1 } from '@lolly-tools/core/file-v1';
import { assetComparisonMode } from './compare-asset-sources.ts';
import { comparisonFileSource } from './compare-sources.ts';
import { comparisonVisualSource } from './compare-visual-sources.ts';

export type OperationComparisonPair = { mode: 'visual'; request: VisualComparisonRequest }
  | { mode: 'text' | 'json'; request: ComparisonRequest };

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
export async function operationComparisonPair(before: File, after: File, host: HostV1, signal?: AbortSignal): Promise<OperationComparisonPair> {
  signal?.throwIfAborted();
  const mode = assetComparisonMode([before, after].map(file => ({ format: file.name.split('.').pop()?.toLowerCase() ?? '' })));
  if (!mode) throw new Error('Comparison supports text, JSON, images and PDF pages. This file pair is not supported.');
  if (mode === 'visual') {
    const pair = await Promise.all([before, after].map(file => comparisonVisualSource(file, host, signal)));
    return { mode, request: { version: 1, before: pair[0]!, after: pair[1]! } };
  }
  const pair = await Promise.all([before, after].map(file => comparisonFileSource(file, mode, signal)));
  return { mode, request: { version: 1, before: pair[0]!, after: pair[1]! } };
}
