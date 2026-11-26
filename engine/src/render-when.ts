// SPDX-License-Identifier: MPL-2.0
/**
 * Render settings that follow one input's value (`render.when`).
 *
 * A tool with two modes can need different chrome in each: a code maker exports a
 * file and offers Copy, Download and Save, while its reader has nothing to export
 * and shows a live page. `render.when` states that in the manifest:
 *
 *   "render": {
 *     "formats": ["png", "svg"],
 *     "when": { "input": "mode", "value": "scan",
 *               "set": { "export": false, "webPreview": true, "actions": [] } }
 *   }
 *
 * While the input holds the value, the keys under `set` replace the same keys of the
 * `render` block. At any other value, and for a tool with no `when`, the block is
 * used as written. The condition is read by {@link matchesShowIf}, the evaluator an
 * input's `showIf` already uses, so `value` may be one value or a list of them.
 *
 * `export`, `webPreview` and `actions` can be set, and so can the live camera keys
 * `live`, `liveFacing` and `liveCameraWhen`, for a tool whose `onFrame` hook serves
 * one mode only. The canvas size and the format list stay those of the tool: a
 * select option's own `formats` already narrows the format list by value.
 *
 * Pure: no DOM, no host, no clock.
 */
import type { RenderSpec, RenderWhen } from '@lolly-tools/core';
import { matchesShowIf } from './inputs.ts';
import type { InputValue } from './inputs.ts';

/** The `render` keys a `when` block may set. A key outside this list is ignored. */
export const RENDER_WHEN_KEYS = ['export', 'webPreview', 'actions', 'live', 'liveFacing', 'liveCameraWhen'] as const;

/** Whether a `render` block's `when` condition holds against the current values. */
export function renderWhenMatches(render: Pick<RenderSpec, 'when'> | null | undefined, values: Record<string, unknown>): boolean {
  const when = render?.when as RenderWhen | undefined;
  if (!when || typeof when.input !== 'string' || !when.input || when.value === undefined) return false;
  // An input the tool does not declare has no value, so the condition cannot hold.
  if (!Object.hasOwn(values, when.input)) return false;
  return matchesShowIf({ [when.input]: when.value as InputValue }, values);
}

/**
 * The `render` block in effect for these values: the block itself when no `when`
 * applies (the same object, so a caller can compare by reference), or a copy with
 * the `set` keys applied.
 */
export function resolveRender<T extends Pick<RenderSpec, 'when'>>(render: T, values: Record<string, unknown>): T {
  if (!renderWhenMatches(render, values)) return render;
  const set = ((render.when as RenderWhen).set ?? {}) as Record<string, unknown>;
  const resolved: Record<string, unknown> = { ...render };
  for (const key of RENDER_WHEN_KEYS) {
    if (Object.hasOwn(set, key) && set[key] !== undefined) resolved[key] = set[key];
  }
  return resolved as T;
}
