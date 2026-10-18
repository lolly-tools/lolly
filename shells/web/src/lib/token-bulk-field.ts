// SPDX-License-Identifier: MPL-2.0
/**
 * One token field acting on many documents (plan 286, M5): multi-edit's Shared card
 * and the Batch grid's Fill popover. A link is planned per document, in its own
 * theme choices and against its own declaration and input policy, and reviewed
 * before anything is written (components/token-bulk-review.ts). Make custom keeps
 * each linked document's own value and records its link for Restore.
 *
 * A document may have a live runtime (a built multi-edit cell) or only stored
 * values (an unbuilt cell, a Batch row). Stored values are read through the
 * engine's own input model and written with the restore rule `updateInput`
 * applies (lib/multi-edit-lazy.ts applySharedEdit), so both behave the same.
 */
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { InputModelItem, InputValue } from '../../../../engine/src/inputs.ts';
import { buildInputModel } from '../../../../engine/src/inputs.ts';
import type { ToolManifest } from '../../../../engine/src/loader.ts';
import type { Runtime } from '../../../../engine/src/runtime.ts';
import type { TokenEntry } from '../../../../engine/src/bridge/host-v1.ts';
import { withTokenSelection } from '../../../../engine/src/token-context.ts';
import { parseTokenSelection } from '../../../../engine/src/token-selection.ts';
import { aliasPath, isTokenValue } from '../../../../engine/src/tokens.ts';
import { mountTokenBindingField, type TokenFieldAction } from '../components/token-binding-field.ts';
import { reviewBulkTokenLink } from '../components/token-bulk-review.ts';
import { getInputPolicy, policyLocksControl } from './input-policy.ts';
import { applySharedEdit } from './multi-edit-lazy.ts';
import { customValuesOf, planBulkTokenLink, sharedTokenState, type BulkLinkPlan, type BulkLinkTarget } from './token-bulk-link.ts';
import { announce } from '../a11y.ts';
import { tRaw } from '../i18n.ts';

/** A document a bulk token action can reach: a multi-edit session or a Batch row. */
export interface TokenMember {
  /** Stable identity: a session slot or a row uid. */
  slot: string;
  label: string;
  tool: { manifest: ToolManifest };
  runtime: Runtime | null;
  values: Record<string, InputValue>;
  dirty: boolean;
}

/** The theme choices a member renders with: its runtime's, else its stored ones. */
export function memberSelection(member: TokenMember): Record<string, string> | undefined {
  if (member.runtime) return member.runtime.tokenSelection;
  const stored = member.values.__tokenSelection;
  try { return stored && typeof stored === 'object' ? parseTokenSelection(JSON.stringify(stored)) : undefined; }
  catch { return undefined; }
}

/** One input as the member's own model holds it, built or not. */
export function memberInput(member: TokenMember, id: string): InputModelItem | undefined {
  const model = member.runtime ? member.runtime.getModel() : buildInputModel(member.tool.manifest, { initial: member.values });
  return model.find(item => item.id === id);
}

/** Plan one token across members, each resolved in its own theme choices. */
export async function planMemberLink(host: HostV1, members: readonly TokenMember[], id: string, ref: string, restore: boolean): Promise<BulkLinkPlan> {
  const path = aliasPath(ref) ?? ref;
  const reads = new Map<string, Promise<TokenEntry | undefined>>();
  const entryFor = (selection: Record<string, string> | undefined): Promise<TokenEntry | undefined> => {
    const key = JSON.stringify(selection ? Object.entries(selection).sort(([a], [b]) => a.localeCompare(b, 'en')) : null);
    let read = reads.get(key);
    if (!read) {
      const scoped = selection ? withTokenSelection(host, selection) : host;
      read = Promise.resolve(scoped.tokens?.get()).then(set => set?.get(path));
      reads.set(key, read);
    }
    return read;
  };
  const targets = await Promise.all(members.map(async (member): Promise<BulkLinkTarget> => {
    const item = memberInput(member, id);
    const policy = getInputPolicy(member.tool.manifest.id, id);
    const options = policy?.mode === 'choice' && policy.allow ? item?.options?.filter(option => policy.allow!.includes(String(option.value))) : item?.options;
    return {
      key: member.slot,
      label: member.label,
      value: item?.value,
      restoreRef: item?.restoreTokenRef,
      readOnly: !item || policy?.mode === 'hidden' || policyLocksControl(item.control, policy),
      consumer: item ? { ...item, options } : undefined,
      entry: await entryFor(memberSelection(member)),
    };
  }));
  return planBulkTokenLink(ref, targets, { restore });
}

export interface BulkTokenFieldOptions {
  host: HostV1;
  id: string;
  /** The input's display name, for the review title. */
  label: string;
  members: readonly TokenMember[];
  /** After a write, with the number of documents changed. */
  applied: (count: number) => void;
}

/**
 * Mount the shared token field for one input across `members`. Returns the
 * disposer, or undefined when no member declares the input.
 */
export function mountBulkTokenField(root: HTMLElement, opts: BulkTokenFieldOptions): (() => void) | undefined {
  const { host, id, members } = opts;
  const lead = members[0];
  const input = lead ? memberInput(lead, id) : undefined;
  if (!lead || !input) return undefined;
  const targets = members.map(member => ({ key: member.slot, member, item: memberInput(member, id) }));
  const state = sharedTokenState(targets.map(({ item }) => ({ value: item?.value, restoreRef: item?.restoreTokenRef })));
  const locked = targets.every(({ member, item }) => !item || policyLocksControl(item.control, getInputPolicy(member.tool.manifest.id, id)));
  const selection = memberSelection(lead);
  const commit = async (value: InputValue, action: TokenFieldAction): Promise<void> => {
    if (action === 'custom') {
      // Read each value again: a document may have changed while the menu was open.
      const custom = customValuesOf(members.map(member => ({ key: member.slot, member, value: memberInput(member, id)?.value })));
      for (const { target, value: own } of custom) await applySharedEdit(target.member, id, own);
      announce(tRaw('Custom values kept: {n}.', { n: custom.length }));
      opts.applied(custom.length);
      return;
    }
    if (!isTokenValue(value)) return;
    const plan = await planMemberLink(host, members, id, value.ref, action === 'restore');
    const chosen = await reviewBulkTokenLink(plan, tRaw('Link {name}', { name: opts.label }));
    if (!chosen) { announce(tRaw('Nothing changed.')); return; }
    const bySlot = new Map(members.map(member => [member.slot, member]));
    for (const item of chosen) {
      const member = bySlot.get(item.key);
      if (member && item.value) await applySharedEdit(member, id, item.value);
    }
    announce(tRaw('Linked {path}: {n} changed.', { path: plan.path, n: chosen.length }));
    opts.applied(chosen.length);
  };
  return mountTokenBindingField(root, { ...input, value: state.value ?? input.value }, selection ? withTokenSelection(host, selection) : host, commit,
    { readOnly: locked, mixed: state.mixed, restoreRef: state.restoreRef });
}
