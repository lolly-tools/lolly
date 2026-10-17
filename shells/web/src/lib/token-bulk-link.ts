// SPDX-License-Identifier: MPL-2.0
/**
 * A token link applied to many documents at once (Batch rows, multi-edit sessions)
 * is planned and shown before anything changes. Each target is resolved in its own
 * theme choices and checked against its own input declaration, so the review can
 * state which items change, which keep an intentional override and which cannot
 * take the token. Pure: no DOM, no host and no writes.
 *
 * An intentional override is a custom value that records the link it replaced
 * (`restoreTokenRef` in the model, `__tokenLinks` in a stored document), or a link
 * to another token. Both are kept unless the reviewer selects them. A plain value
 * that was never linked is what a bulk link is for, so it is selected by default.
 */
import type { InputValue } from '../../../../engine/src/inputs.ts';
import type { TokenEntry } from '../../../../engine/src/bridge/host-v1.ts';
import { flattenValue } from '../../../../engine/src/inputs.ts';
import { aliasPath, isAlias, isTokenValue, type TokenValue } from '../../../../engine/src/tokens.ts';
import { resolveTokenBinding, type TokenConsumer } from '../../../../engine/src/token-binding.ts';

/** Stored-document keys that carry token context: theme choices and the previous link of each custom value. */
export const TOKEN_CONTEXT_KEYS = ['__tokenSelection', '__tokenLinks'] as const;

/** Input types a bulk token link can target; colour keeps its own picker. */
export const BULK_TOKEN_TYPES: ReadonlySet<string> = new Set(['number', 'text', 'longtext', 'select']);

export type BulkLinkStatus = 'change' | 'linked' | 'override' | 'other-link' | 'incompatible' | 'read-only';

export interface BulkLinkTarget {
  /** Stable identity: a session slot or a row uid. */
  key: string;
  label: string;
  /** The stored value: a literal or a `{ ref, value }` link. */
  value: InputValue | undefined;
  /** The link a custom value replaced, when one is recorded. */
  restoreRef?: string;
  /** This target's own declaration; absent when the input takes no token here. */
  consumer?: TokenConsumer;
  readOnly?: boolean;
  /** The token entry, resolved in this target's own theme choices. */
  entry?: TokenEntry;
}

export interface BulkLinkItem {
  key: string;
  label: string;
  status: BulkLinkStatus;
  /** The current value as text. */
  before: string;
  /** The value this target would show once linked. */
  after?: string;
  /** The other token this item links to, or the link its custom value replaced. */
  previous?: string;
  reason?: string;
  /** Selected when the review opens. */
  include: boolean;
  /** Whether the reviewer may change the selection. */
  optional: boolean;
  /** What Apply writes for this item. */
  value?: TokenValue & { adapter?: string };
}

export interface BulkLinkPlan {
  path: string;
  items: BulkLinkItem[];
}

const pathOf = (ref: string | undefined): string | undefined => ref === undefined ? undefined : aliasPath(ref) ?? ref.replace(/^\{|\}$/g, '');
const text = (value: InputValue | undefined): string => {
  const flat = value === undefined ? '' : flattenValue(value);
  return flat === null || flat === undefined ? '' : typeof flat === 'object' ? '' : String(flat);
};

/**
 * Classify every target for one token. `restore` is the Restore link action: a
 * custom value that replaced this same token is then selected, because returning
 * to that link is what was asked for.
 */
export function planBulkTokenLink(ref: string, targets: readonly BulkLinkTarget[], options: { restore?: boolean } = {}): BulkLinkPlan {
  const path = pathOf(ref) ?? ref;
  const items = targets.map((target): BulkLinkItem => {
    const base = { key: target.key, label: target.label, before: text(target.value) };
    const fixed = (status: BulkLinkStatus, reason?: string): BulkLinkItem => ({ ...base, status, include: false, optional: false, ...(reason ? { reason } : {}) });
    const current = isTokenValue(target.value) ? pathOf(target.value.ref) : undefined;
    if (current === path) return fixed('linked');
    if (target.readOnly) return fixed('read-only');
    if (!target.consumer || !BULK_TOKEN_TYPES.has(target.consumer.type)) return fixed('incompatible', 'This input does not accept design tokens.');
    const result = resolveTokenBinding(target.entry, target.consumer);
    if (result.status !== 'linked') return fixed('incompatible', result.reason ?? 'This token cannot be linked here.');
    const linked = { ...base, after: String(result.value), value: { ref: `{${path}}`, value: result.value, ...(result.adapter ? { adapter: result.adapter } : {}) }, optional: true };
    if (current) return { ...linked, status: 'other-link', previous: current, include: false };
    const replaced = !isTokenValue(target.value) && isAlias(target.restoreRef) ? pathOf(target.restoreRef) : undefined;
    if (replaced) return { ...linked, status: 'override', previous: replaced, include: options.restore === true && replaced === path };
    return { ...linked, status: 'change', include: true };
  });
  return { path, items };
}

/** How many items carry each status, and how many are selected. */
export function countBulkLink(items: readonly BulkLinkItem[], selected: ReadonlySet<string>): Record<BulkLinkStatus, number> & { selected: number } {
  const counts = { change: 0, linked: 0, override: 0, 'other-link': 0, incompatible: 0, 'read-only': 0, selected: 0 };
  for (const item of items) {
    counts[item.status]++;
    if (item.value && selected.has(item.key)) counts.selected++;
  }
  return counts;
}

/**
 * The state one shared token field shows for many targets: their common link, or
 * mixed when their link states differ, and a Restore reference only when every
 * target is custom and records the same previous link. A mixed field still carries
 * a link when any target has one, so Make custom stays available.
 */
export function sharedTokenState(targets: ReadonlyArray<Pick<BulkLinkTarget, 'value' | 'restoreRef'>>): { value: InputValue | undefined; mixed: boolean; restoreRef?: string } {
  const first = targets[0];
  if (!first) return { value: undefined, mixed: false };
  const links = targets.map(target => isTokenValue(target.value) ? pathOf(target.value.ref) : null);
  const mixed = new Set(links).size > 1;
  const restores = targets.map(target => !isTokenValue(target.value) && isAlias(target.restoreRef) ? pathOf(target.restoreRef) : undefined);
  const restore = links[0] === null && !mixed && restores[0] && restores.every(path => path === restores[0]) ? `{${restores[0]}}` : undefined;
  return { value: targets.find(target => isTokenValue(target.value))?.value ?? first.value, mixed, ...(restore ? { restoreRef: restore } : {}) };
}

/** Make custom for many targets: each linked target keeps its own current value. */
export function customValuesOf<T extends Pick<BulkLinkTarget, 'key' | 'value'>>(targets: readonly T[]): Array<{ target: T; value: InputValue; ref: string }> {
  return targets.flatMap(target => isTokenValue(target.value) ? [{ target, value: flattenValue(target.value), ref: target.value.ref }] : []);
}

type StoredValues = Record<string, unknown>;
const links = (values: StoredValues): Record<string, unknown> => {
  const stored = values.__tokenLinks;
  return stored && typeof stored === 'object' && !Array.isArray(stored) ? stored as Record<string, unknown> : {};
};

/** The link a stored custom value replaced, when one is recorded. */
export function storedRestoreRef(values: StoredValues, id: string): string | undefined {
  const previous = links(values)[id];
  return !isTokenValue(values[id]) && isAlias(previous) ? previous : undefined;
}

/**
 * Write one input into a stored value map (a Batch row, an unopened multi-edit
 * session) with the engine's own rule from `updateInput`: a value over a link
 * records that link for Restore, a link clears the record, and a value over a
 * value keeps whatever was recorded.
 */
export function writeStoredInput(values: StoredValues, id: string, value: InputValue | undefined): void {
  const before = values[id];
  if (value === undefined) delete values[id]; else values[id] = value;
  const next = { ...links(values) };
  if (isTokenValue(value)) delete next[id];
  else if (isTokenValue(before) && isAlias(before.ref)) next[id] = before.ref;
  if (Object.keys(next).length) values.__tokenLinks = next; else delete values.__tokenLinks;
}
