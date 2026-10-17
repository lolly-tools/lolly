// SPDX-License-Identifier: MPL-2.0
/**
 * The correctness core of multi-edit's lazy cells (views/multi-edit.ts): a session's
 * state must survive whether or not its runtime was ever built. A cell far off-screen
 * is a stored thumbnail with NO runtime until it nears the viewport, so:
 *
 *  - a fanned-out "shared" edit must reach it even while it's frozen - buffered into
 *    its seed values so createRuntime picks it up when the cell is finally built; and
 *  - saving/exporting it must read those buffered values, not a runtime that doesn't
 *    exist yet.
 *
 * Both branches are one line, but getting the branch wrong silently drops a user's
 * edit on save - hence the extraction and the unit test.
 */
import type { InputValue } from '../../../../engine/src/inputs.js';
import type { Runtime } from '../../../../engine/src/runtime.js';
import { tokenRestoreRefsOf } from '../../../../engine/src/inputs.ts';
import { TOKEN_CONTEXT_KEYS, writeStoredInput } from './token-bulk-link.ts';

export interface LazyMember {
  /** null until the cell nears the viewport (or its card opens, or it leads a shared input). */
  runtime: Runtime | null;
  /** The createRuntime seed, and the buffer a shared edit writes into while un-created. */
  values: Record<string, InputValue>;
  dirty: boolean;
}

const TOKEN_CONTEXT = new Set<string>(TOKEN_CONTEXT_KEYS);

/** A stored session's runtime seed: its inputs plus the token context (theme choices,
 *  previous links) the runtime seeds from, so each session renders and reviews token
 *  links in its own choices. Other `__` meta stays in the stored record. */
export function sessionSeedValues(data: Record<string, unknown>): Record<string, InputValue> {
  const values: Record<string, InputValue> = {};
  for (const [k, v] of Object.entries(data)) if (!k.startsWith('__') || TOKEN_CONTEXT.has(k)) values[k] = v as InputValue;
  return values;
}

/** A live runtime's current values as a plain map, with its theme choices and the
 *  previous link of each custom value, as the tool view's own save records them
 *  (views/tool-session-snapshot.ts). */
export function runtimeSaveValues(runtime: Runtime): Record<string, InputValue> {
  const model = runtime.getModel();
  const links = tokenRestoreRefsOf(model);
  return {
    ...Object.fromEntries(model.map(i => [i.id, i.value])),
    ...(Object.keys(links).length ? { __tokenLinks: links } : {}),
    ...(runtime.tokenSelection ? { __tokenSelection: structuredClone(runtime.tokenSelection) } : {}),
  };
}

/** The record a session saves: its stored meta, then `values`. The token context comes
 *  from `values` alone, so a link restored here does not leave the record's earlier
 *  Restore reference behind. */
export function sessionSaveData<T extends Record<string, unknown>>(data: T, values: Record<string, InputValue>): Record<string, unknown> {
  const kept: Record<string, unknown> = { ...data };
  for (const key of TOKEN_CONTEXT_KEYS) delete kept[key];
  return { ...kept, ...values };
}

/** The values a session persists: its live runtime's model if built, else the seed +
 *  any shared edits buffered into it while the cell was frozen. */
export function memberSaveValues(
  m: LazyMember,
  modelValues: (r: Runtime) => Record<string, InputValue>,
): Record<string, InputValue> {
  return m.runtime ? modelValues(m.runtime) : m.values;
}

/** Apply a fanned-out shared edit to one member: through its runtime when live, else
 *  buffered into its seed so createRuntime picks it up when the cell is finally built.
 *  Either way the value is written and the member is marked dirty. The seed follows
 *  the runtime's restore rule: a value written over a token link records that link,
 *  so a frozen cell can still offer Restore link once it is built. */
export async function applySharedEdit(m: LazyMember, id: string, value: InputValue): Promise<void> {
  if (m.runtime) await m.runtime.setInput(id, value);
  else writeStoredInput(m.values, id, value);
  m.dirty = true;
}
