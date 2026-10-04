// SPDX-License-Identifier: MPL-2.0
import type { InputModelItem } from '../../../../engine/src/inputs.ts';

/** Track parsed inputs by permanent id, including aliases and vector fields. */
export function inputParamIds(query: string, model: readonly InputModelItem[]): Set<string> {
  const keys = [...new URLSearchParams(query).keys()];
  const ids = new Set(keys);
  for (const input of model) {
    const names = [input.id, input.urlKey].filter((name): name is string => !!name);
    if (keys.some(key => names.some(name => key === name || key === `_ref.${name}` || key === `_restore.${name}` || (input.type === 'vector' && key.startsWith(`${name}.`))))) ids.add(input.id);
  }
  if (ids.has('width')) ids.add('w');
  if (ids.has('height')) ids.add('h');
  return ids;
}

/** Result settings with no live control must survive subsequent edits. */
export const RESULT_CONTEXT_PARAMS = ['meta', 'depth', 'cuts', 'sampletimes', 'motionblur', 'seqrange', 'fps', 'seconds', 'wait', 'codec', 'vq', 'ds', 'designv'] as const;

/** Shell navigation belongs in the address, outside packed content and Share. */
export const WORKSPACE_PARAMS = ['_ui', '_sel', '_t', '_panel', '_view', '_dialog', '_appearance', '_nav', '_inspector', 'lang', 'full', 'options', 'present', 's', 'kiosk', 'slot'] as const;

/** Replace only workspace keys; an explicit empty value still counts as state. */
export function copyWorkspaceParams(target: URLSearchParams, source: URLSearchParams): void {
  for (const key of WORKSPACE_PARAMS) {
    target.delete(key);
    if (source.has('_ui') && ['_sel', '_t', '_panel'].includes(key)) continue;
    const value = source.get(key);
    if (value !== null) target.set(key, value);
  }
}

/**
 * Document state a packed address (`?z=`) keeps readable beside its token. `_themes`
 * scopes the web token bridge (bridge/tokens.ts), which reads the plain key and never
 * inflates a token; packed, a dark document's swatches and links fell back to the
 * default theme after the first edit (plan 291 W4). A link opened later still reads it:
 * expandQuery appends every plain key after the decoded state.
 */
export const BESIDE_PACK_PARAMS = ['_themes'] as const;

/** The part of a query that goes into a packed token: everything but the workspace keys and BESIDE_PACK_PARAMS. */
export function packableContent(params: URLSearchParams): URLSearchParams {
  const content = new URLSearchParams(params);
  for (const key of [...WORKSPACE_PARAMS, ...BESIDE_PACK_PARAMS]) content.delete(key);
  return content;
}

/** Put the BESIDE_PACK_PARAMS of `source` (the query that was packed) next to a packed token. */
export function copyBesidePackParams(target: URLSearchParams, source: URLSearchParams): void {
  for (const key of BESIDE_PACK_PARAMS) {
    target.delete(key);
    const value = source.get(key);
    if (value !== null) target.set(key, value);
  }
}
