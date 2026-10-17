// SPDX-License-Identifier: MPL-2.0
/**
 * Token links in the Batch grid (plan 286, M5). The Fill popover of a column that
 * accepts tokens can link one token across the rows in scope; each row is resolved
 * in its own theme choices and the link is reviewed row by row before any row
 * changes (lib/token-bulk-field.ts). Cell edits follow the engine's restore rule
 * (lib/token-bulk-link.ts writeStoredInput), so a value typed over a link is an
 * intentional override that a later bulk link keeps unless it is selected.
 */
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { InputValue } from '../../../../engine/src/inputs.ts';
import type { ToolManifest } from '../../../../engine/src/loader.ts';
import { mountBulkTokenField, type TokenMember } from '../lib/token-bulk-field.ts';
import { BULK_TOKEN_TYPES } from '../lib/token-bulk-link.ts';
import { tRaw } from '../i18n.ts';

/** The part of a grid row a bulk token link reads and writes. */
export interface TokenRow {
  uid: string;
  toolId: string;
  manifest: ToolManifest | null;
  values: Record<string, InputValue>;
  filename?: string;
}

export interface BatchTokenSectionOptions {
  host: HostV1;
  key: string;
  label: string;
  type: string;
  /** Every grid row, for the row numbers the review shows. */
  rows: readonly TokenRow[];
  /** The rows the Fill popover writes to. */
  targets: readonly TokenRow[];
  applied: (count: number) => void;
}

/** A row as a bulk token target: no runtime, and its own value map written in place. */
function rowMember(row: TokenRow, manifest: ToolManifest, position: number): TokenMember {
  const name = row.filename?.trim() || manifest.name || row.toolId;
  return { slot: row.uid, label: tRaw('Row {n}: {name}', { n: position + 1, name }), tool: { manifest }, runtime: null, values: row.values, dirty: false };
}

/**
 * Add a Design token section to a Fill popover. Returns its disposer, or undefined
 * when the column's type takes no token or the host has no design tokens.
 */
export function mountBatchTokenSection(container: HTMLElement, opts: BatchTokenSectionOptions): (() => void) | undefined {
  if (!opts.host.tokens || !BULK_TOKEN_TYPES.has(opts.type)) return undefined;
  const members: TokenMember[] = [];
  for (const row of opts.targets) if (row.manifest) members.push(rowMember(row, row.manifest, opts.rows.indexOf(row)));
  if (!members.length) return undefined;
  const section = document.createElement('section'); section.className = 'pro-popover-token';
  const heading = document.createElement('span'); heading.className = 'pro-popover-subtitle'; heading.textContent = tRaw('Design token');
  const note = document.createElement('p'); note.className = 'input-token-note';
  note.textContent = tRaw('Linking shows which rows change before anything is written. Custom values and other links are kept unless you select them.');
  const field = document.createElement('div');
  section.append(heading, note, field);
  container.append(section);
  const dispose = mountBulkTokenField(field, { host: opts.host, id: opts.key, label: opts.label, members, applied: opts.applied });
  return () => { dispose?.(); section.remove(); };
}
