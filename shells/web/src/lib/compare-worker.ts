// SPDX-License-Identifier: MPL-2.0
import { compareSources, compareVisualSources } from '@lolly/engine';
import type { ComparisonRequest, VisualComparisonRequest } from '@lolly-tools/core/host-v1';
self.onmessage = (event: MessageEvent<{ mode: 'content'; request: ComparisonRequest } | { mode: 'visual'; request: VisualComparisonRequest }>) => {
  try { self.postMessage({ result: event.data.mode === 'visual' ? compareVisualSources(event.data.request) : compareSources(event.data.request) }); }
  catch { self.postMessage({ error: 'The supplied snapshots could not be compared.' }); }
};
