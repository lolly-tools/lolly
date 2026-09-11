// SPDX-License-Identifier: MPL-2.0
/**
 * Shared value helpers for the tool view (tool.ts / tool-inputs.ts).
 *
 * A neutral module so both runtime halves can use isRecord/asRow without a
 * value-import cycle between tool.ts and tool-inputs.ts. Imports only engine
 * types (erased at build), so it pulls in no runtime dependencies.
 */
import type { InputValue } from '../../../../engine/src/inputs.js';

/** One row of a blocks array (free-form sub-field map). */
export type BlockRow = { [key: string]: InputValue | undefined };
export const isRecord = (v: InputValue | undefined): v is BlockRow =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof Uint8Array);
export const asRow = (v: InputValue | undefined): BlockRow => (isRecord(v) ? v : {});
