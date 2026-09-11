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

export interface LazyMember {
  /** null until the cell nears the viewport (or its card opens, or it leads a shared input). */
  runtime: Runtime | null;
  /** The createRuntime seed, and the buffer a shared edit writes into while un-created. */
  values: Record<string, InputValue>;
  dirty: boolean;
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
 *  Either way the value is written and the member is marked dirty. */
export async function applySharedEdit(m: LazyMember, id: string, value: InputValue): Promise<void> {
  if (m.runtime) await m.runtime.setInput(id, value);
  else m.values[id] = value;
  m.dirty = true;
}
