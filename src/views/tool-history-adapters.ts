// SPDX-License-Identifier: MPL-2.0
import type { ToolManifest } from '../../../../engine/src/loader.ts';

/** Audited durable-input tools. This is an adapter rollout, not a promise that
 * arbitrary file/camera/provider tools can reconstruct their original bytes. */
export const AUTOMATIC_HISTORY_TOOLS: readonly string[] = Object.freeze([
  'text-helper', 'design', 'gradient', 'chart', 'snippet', 'qr-code', 'org-chart', 'pricing-table', 'wordmark',
]);
const durableTypes = new Set(['text', 'longtext', 'number', 'boolean', 'color', 'select', 'asset', 'date', 'time', 'datetime-local', 'url', 'vector', 'table', 'blocks']);

export function hasHistoryAdapter(toolId: string): boolean { return AUTOMATIC_HISTORY_TOOLS.includes(toolId); }

/** Refuse new unsupported input types, including nested files, until their
 * adapter is reviewed. Vector fields are numeric and have no type property. */
export function historyParticipation(manifest: Pick<ToolManifest, 'id' | 'inputs' | 'capabilities'>, shared: boolean) {
  const supported = (inputs: readonly { type?: string; fields?: readonly { type?: string }[] }[], depth = 0): boolean => depth < 32 && inputs.every(input =>
    !!input.type && durableTypes.has(input.type) && (input.type !== 'blocks' || !input.fields || supported(input.fields, depth + 1)));
  return { localHistory: !shared && hasHistoryAdapter(manifest.id) && !manifest.capabilities?.length && supported(manifest.inputs), recordDeviceActivity: !shared };
}

/** Protect the immediate edit, then the final inputs after its async hook.
 * Merely rendering/playing an animation does not count as another edit. */
export function trackRevisionInput<T>(result: Promise<T>, changed: () => void): Promise<T> {
  changed(); void result.then(changed, () => {}); return result;
}
