// SPDX-License-Identifier: MPL-2.0
/**
 * Template refs - one string that names a template wherever the profile has to point at
 * one (the hidden set, "Start with" per tool, a Projects tile's "Use" link, plans/226):
 *
 *   "<toolId>:<tid>"   a SHIPPED template - tools/<toolId>/templates/<tid>.json
 *   "user:<id>"        a template the person saved (lib/user-templates.ts)
 *
 * A bare "<tid>" is accepted where the tool is already known (the `?template=` launcher has
 * always taken one), so every existing deep link keeps working unchanged. No tool id is
 * `user` (validate-catalog refuses it), so the prefix cannot collide with a shipped ref.
 *
 * `resolveTemplateSeed` is the one lookup every surface shares: the person's own store
 * first (inline values, no fetch), then the shipped file, then the inline manifest
 * metadata. It returns null for anything missing so a caller falls through to the normal
 * fresh-open flow instead of throwing - a stale "Start with" or a deleted template must
 * open the tool, not break it.
 */

import type { InputValue } from '../../../../engine/src/inputs.ts';
import { fetchTemplateSeed, parseTemplates, templateValuesById, type TemplateVariant } from './template-source.ts';
import { createUserTemplateStore, type UserTemplate, type UserTemplateHost } from './user-templates.ts';

export type TemplateRef = string;

export type ParsedTemplateRef =
  | { kind: 'shipped'; toolId: string; id: string }
  | { kind: 'user'; id: string };

const USER_PREFIX = 'user:';

export function userTemplateRef(id: string): TemplateRef { return USER_PREFIX + id; }
export function shippedTemplateRef(toolId: string, tid: string): TemplateRef { return `${toolId}:${tid}`; }
export function formatTemplateRef(ref: ParsedTemplateRef): TemplateRef {
  return ref.kind === 'user' ? userTemplateRef(ref.id) : shippedTemplateRef(ref.toolId, ref.id);
}
export function isUserTemplateRef(ref: unknown): boolean {
  return typeof ref === 'string' && ref.startsWith(USER_PREFIX) && ref.length > USER_PREFIX.length;
}

/** Parse a ref; a bare template id resolves only when `toolId` says which tool. */
export function parseTemplateRef(ref: unknown, opts: { toolId?: string } = {}): ParsedTemplateRef | null {
  if (typeof ref !== 'string') return null;
  const s = ref.trim();
  if (!s) return null;
  if (s.startsWith(USER_PREFIX)) {
    const id = s.slice(USER_PREFIX.length).trim();
    return id ? { kind: 'user', id } : null;
  }
  const i = s.indexOf(':');
  if (i > 0 && i < s.length - 1) return { kind: 'shipped', toolId: s.slice(0, i), id: s.slice(i + 1) };
  if (i === -1 && opts.toolId) return { kind: 'shipped', toolId: opts.toolId, id: s };
  return null;
}

export interface ResolvedTemplate {
  ref: ParsedTemplateRef;
  toolId: string;
  /** The template's display name when known (a user record, or the index metadata). */
  name?: string;
  values: Record<string, InputValue>;
}

export interface ResolveTemplateOpts {
  /** Refuse a template that belongs to another tool (and lets a bare id parse). */
  toolId?: string;
  /** The tool's inline `templates[]` metadata - the last-resort seed for a shipped ref. */
  templateMeta?: unknown;
  presetId?: string | null;
  /** The shipped-file reader; defaults to fetchTemplateSeed (tests inject one). */
  fetchShipped?: (toolId: string, tid: string, presetId?: string | null) => Promise<Record<string, InputValue> | null>;
}

export async function resolveTemplateSeed(
  host: UserTemplateHost,
  ref: unknown,
  opts: ResolveTemplateOpts = {},
): Promise<ResolvedTemplate | null> {
  const parsed = parseTemplateRef(ref, opts);
  if (!parsed) return null;
  if (parsed.kind === 'user') {
    let tpl: Awaited<ReturnType<ReturnType<typeof createUserTemplateStore>['get']>> = null;
    try { tpl = await createUserTemplateStore(host).get(parsed.id); } catch { return null; }
    if (!tpl) return null;
    if (opts.toolId && tpl.toolId !== opts.toolId) return null;
    return { ref: parsed, toolId: tpl.toolId, name: tpl.name, values: tpl.values as Record<string, InputValue> };
  }
  if (opts.toolId && parsed.toolId !== opts.toolId) return null;
  const meta = parseTemplates(opts.templateMeta).find(v => v.id === parsed.id);
  const read = opts.fetchShipped ?? fetchTemplateSeed;
  const fetched = await read(parsed.toolId, parsed.id, opts.presetId ?? null);
  const values = fetched ?? templateValuesById(opts.templateMeta, parsed.id, opts.presetId ?? null);
  if (!values) return null;
  return { ref: parsed, toolId: parsed.toolId, name: meta?.name, values };
}

/**
 * The shipped templates of a tool as chooser variants, each carrying its ref. `templateMeta`
 * is the index / inline-manifest metadata (values are fetched on demand by the chooser).
 */
export function shippedVariants(toolId: string, templateMeta: unknown): TemplateVariant[] {
  return parseTemplates(templateMeta).map(v => ({ ...v, ref: shippedTemplateRef(toolId, v.id), own: false }));
}

/**
 * The person's own templates as chooser variants (values inline, so no fetch), under one
 * category label - the caller passes the translated group name. Newest first, as listed.
 */
export function userVariants(list: readonly UserTemplate[], category: string): TemplateVariant[] {
  return list.map(ut => ({
    id: ut.id,
    name: ut.name,
    ...(ut.description ? { description: ut.description } : {}),
    category,
    values: ut.values as Record<string, InputValue>,
    ref: userTemplateRef(ut.id),
    own: true,
  }));
}
