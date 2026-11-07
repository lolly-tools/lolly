// SPDX-License-Identifier: MPL-2.0
/**
 * Workspace templates: starting points a connected workspace publishes to the people it
 * serves (a brand team's partner data sheet, say), carried in the workspace's asset
 * catalog as entries of type `template`.
 *
 * An entry carries the tool it starts (`meta.toolId`), its version (`meta.version`), and,
 * when the workspace set rules, the inputs people may change (`meta.editable`). A
 * retired one stays in the catalog with `meta.retired` (and `meta.replacedBy`), so a
 * document made from it can tell the person; it is never offered as a new start.
 *
 * No server product is mentioned here: any catalog that serves such entries is read the
 * same way, and a plain build with no workspace has none, so every surface that asks
 * gets an empty list and renders exactly as before.
 */

import type { AssetRef } from '@lolly-tools/core/host-v1';
import type { InputValue } from '../../../../engine/src/inputs.ts';
import type { TemplateVariant } from './template-source.ts';

/** What a workspace template entry says about itself, before its values are read. */
export interface WorkspaceTemplate {
  /** The catalog id (`inst/<id>`), which is also its template ref. */
  id: string;
  name: string;
  description?: string;
  toolId: string;
  version: number;
  /** Inputs people may change; absent means every input. */
  editable?: string[];
  /** True when people keep the colourway and mode the template was made in. */
  fixedTheme?: boolean;
  retired?: boolean;
  replacedBy?: string;
  /** Inputs that take the person's company details, by company field (`logo`,
   *  `contact` and the rest), when the workspace says which company they are in. */
  bindings?: Record<string, string>;
  /** Where its JSON is served. */
  url: string;
}

/** The ref a workspace template travels under: its catalog id. */
export function isWorkspaceTemplateRef(ref: unknown): ref is `inst/${string}` {
  return typeof ref === 'string' && /^inst\/[A-Za-z0-9_-]{1,64}$/.test(ref);
}

/** The slice of the host this module reads: the catalog, metadata first. */
export interface MetadataHost {
  assets: {
    query(filter: Record<string, unknown>): Promise<AssetRef[]>;
    get(id: string): Promise<AssetRef>;
    /** The web shell's metadata-only listing: no bytes fetched for a list. */
    _queryMetadata?(filter: Record<string, unknown>): Promise<AssetRef[]>;
  };
}

/** Read one catalog ref as a workspace template, or null when it is not one. */
export function workspaceTemplateOf(ref: AssetRef | null | undefined): WorkspaceTemplate | null {
  if (!ref || !isWorkspaceTemplateRef(ref.id) || (ref.type as string) !== 'template') return null;
  const meta = (ref.meta ?? {}) as Record<string, unknown>;
  if (typeof meta.toolId !== 'string' || !meta.toolId || !ref.url) return null;
  const editable = Array.isArray(meta.editable) ? meta.editable.filter((id): id is string => typeof id === 'string') : undefined;
  return {
    id: ref.id,
    name: typeof meta.name === 'string' && meta.name ? meta.name : ref.id,
    ...(typeof meta.description === 'string' && meta.description ? { description: meta.description } : {}),
    toolId: meta.toolId,
    version: typeof meta.version === 'number' && meta.version > 0 ? meta.version : 1,
    ...(editable ? { editable } : {}),
    ...(meta.fixedTheme === true ? { fixedTheme: true } : {}),
    ...(meta.retired === true ? { retired: true } : {}),
    ...(typeof meta.replacedBy === 'string' ? { replacedBy: meta.replacedBy } : {}),
    ...(bindingsOf(meta.bindings) ? { bindings: bindingsOf(meta.bindings)! } : {}),
    url: ref.url,
  };
}

/** A bindings map read back from catalog metadata: input id to company field. */
function bindingsOf(raw: unknown): Record<string, string> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const out = Object.fromEntries(Object.entries(raw as Record<string, unknown>).filter(([, f]) => typeof f === 'string' && (COMPANY_FIELDS as readonly string[]).includes(f))) as Record<string, string>;
  return Object.keys(out).length ? out : undefined;
}

// ── The person's company ─────────────────────────────────────────────────────
// A workspace can say which company a person makes pieces for: its logos for light
// and dark surfaces and the details a piece prints. Inputs a template (or the
// workspace's own rules) binds to a company field start from these values. Set by
// whoever reads the workspace's configuration; null on a plain build, where nothing
// here changes what any tool does.

/** The company fields a binding may take, in the workspace's own words. */
export const COMPANY_FIELDS = [
  'name', 'logo', 'logoLight', 'logoDark', 'mark', 'website', 'contact', 'contactEmail', 'contactPhone', 'address', 'currency', 'taxNote',
] as const;

export interface WorkspaceCompany {
  id: string;
  name: string;
  revision?: number;
  logos: { light?: string; dark?: string; mark?: string };
  website?: string;
  contact?: { name?: string; email?: string; phone?: string };
  address?: string;
  currency?: string;
  taxNote?: string;
}

let company: WorkspaceCompany | null = null;

/** Name the person's company, or null for none. */
export function setWorkspaceCompany(next: WorkspaceCompany | null): void {
  company = next;
}

/** The person's company, or null. */
export function workspaceCompany(): WorkspaceCompany | null {
  return company;
}

/** The longest a first visit waits to learn the person's company. */
export const WORKSPACE_COMPANY_WAIT_MS = 3000;

let companyKnown = false;
let governed = false;
let companyWaiters: Array<() => void> = [];

/**
 * Boot has asked the instance who this person is (org/probe.ts), so the company,
 * if they have one, is set. Called once every outcome is in: no instance, a
 * sign-in gate or a member. `member` says a workspace now governs this session.
 */
export function settleWorkspaceCompany(member = false): void {
  governed = member;
  companyKnown = true;
  const ready = companyWaiters;
  companyWaiters = [];
  for (const resolve of ready) resolve();
}

/** Resolves once boot knows the person's company, or after `ms`, whichever is first. */
export function workspaceCompanySettled(ms = WORKSPACE_COMPANY_WAIT_MS): Promise<void> {
  if (companyKnown) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(done, ms);
    function done(): void { clearTimeout(timer); companyWaiters = companyWaiters.filter((w) => w !== done); resolve(); }
    companyWaiters.push(done);
  });
}

/** True once boot has signed this person in to a workspace. */
export function workspaceGoverned(): boolean {
  return governed;
}

/** Forget what boot learned, for tests. */
export function _resetWorkspaceCompanyForTests(): void {
  company = null;
  companyKnown = false;
  governed = false;
  companyWaiters = [];
}

export type CompanyMode = 'light' | 'dark';

/** The mode a document draws in, from its theme choices (`{ "": "dark" }`). */
export function modeOfSelection(selection: unknown): CompanyMode {
  if (!selection || typeof selection !== 'object') return 'light';
  return Object.values(selection as Record<string, unknown>).some((v) => typeof v === 'string' && /^dark$/i.test(v)) ? 'dark' : 'light';
}

/** The logo for a mode, falling back to the other surface's: the company's own mark
 *  beats any placeholder. */
export function companyLogo(c: WorkspaceCompany, mode: CompanyMode): string | undefined {
  return mode === 'dark' ? c.logos.dark ?? c.logos.light : c.logos.light ?? c.logos.dark;
}

/** The value one company field gives. The contact line reads "name, email, phone",
 *  as the workspace writes it for a server render, so both draw the same line. */
export function companyFieldValue(field: string, c: WorkspaceCompany, mode: CompanyMode): string | undefined {
  switch (field) {
    case 'name': return c.name;
    case 'logo': return companyLogo(c, mode);
    case 'logoLight': return c.logos.light;
    case 'logoDark': return c.logos.dark;
    case 'mark': return c.logos.mark;
    case 'website': return c.website;
    case 'contact': return [c.contact?.name, c.contact?.email, c.contact?.phone].filter(Boolean).join(', ') || undefined;
    case 'contactEmail': return c.contact?.email;
    case 'contactPhone': return c.contact?.phone;
    case 'address': return c.address;
    case 'currency': return c.currency;
    case 'taxNote': return c.taxNote;
    default: return undefined;
  }
}

/** The values a set of bindings gives for the person's company; empty with no company. */
export function companyValuesFor(bindings: Record<string, string> | undefined, mode: CompanyMode, c: WorkspaceCompany | null = company): Record<string, string> {
  const out: Record<string, string> = {};
  if (!bindings || !c) return out;
  for (const [id, field] of Object.entries(bindings)) {
    const value = companyFieldValue(field, c, mode);
    if (value !== undefined) out[id] = value;
  }
  return out;
}

/** Every workspace template the catalog holds, retired ones included. Empty on a
 *  plain build or when the catalog cannot be read. */
export async function listWorkspaceTemplates(host: MetadataHost): Promise<WorkspaceTemplate[]> {
  try {
    const filter = { type: 'template' };
    const refs = await (host.assets._queryMetadata ? host.assets._queryMetadata(filter) : host.assets.query(filter));
    return refs.map(workspaceTemplateOf).filter((t): t is WorkspaceTemplate => !!t)
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

/**
 * Whether the workspace set this tool to templates only for this person: its index
 * entry says `templatesOnly`. The tool is then unlisted (out of the gallery and
 * search), and a fresh open offers only the templates published to them.
 */
export function isTemplatesOnlyTool(entry: unknown): boolean {
  return !!entry && typeof entry === 'object' && (entry as { templatesOnly?: unknown }).templatesOnly === true;
}

/** The templates a person may start a tool from: this tool's, not retired. */
export function startableFor(list: readonly WorkspaceTemplate[], toolId: string): WorkspaceTemplate[] {
  return list.filter((t) => t.toolId === toolId && !t.retired);
}

/** One workspace template as the catalog serves it now, or null when it is gone. Read
 *  from the catalog's metadata, so asking never downloads the template itself. */
export async function getWorkspaceTemplate(host: MetadataHost, id: string): Promise<WorkspaceTemplate | null> {
  if (!isWorkspaceTemplateRef(id)) return null;
  const listed = (await listWorkspaceTemplates(host)).find((tpl) => tpl.id === id);
  if (listed || host.assets._queryMetadata) return listed ?? null;
  try { return workspaceTemplateOf(await host.assets.get(id)); } catch { return null; }
}

/** A workspace template's values, read from its JSON. Null when they cannot be read. */
export async function fetchWorkspaceValues(template: WorkspaceTemplate, fetchImpl: typeof fetch = fetch): Promise<Record<string, InputValue> | null> {
  try {
    // The address stays the same across versions, so never take a cached copy.
    const res = await fetchImpl(template.url, { credentials: 'include', cache: 'no-store' });
    if (!res.ok) return null;
    const doc = (await res.json()) as { toolId?: unknown; values?: unknown };
    if (doc.toolId !== undefined && doc.toolId !== template.toolId) return null;
    const values = doc.values;
    return values && typeof values === 'object' && !Array.isArray(values) ? values as Record<string, InputValue> : null;
  } catch {
    return null;
  }
}

/**
 * The chooser's tiles for a tool's workspace templates, values read up front (they are
 * small, and a live tile preview needs them), under one category label. A template whose
 * values cannot be read is left out rather than offered as a blank start. A template
 * with no description of its own takes `fallbackDescription`'s line.
 */
export async function workspaceVariants(list: readonly WorkspaceTemplate[], category: string, fetchImpl?: typeof fetch, fallbackDescription?: (tpl: WorkspaceTemplate) => string): Promise<TemplateVariant[]> {
  const out: TemplateVariant[] = [];
  for (const tpl of list) {
    const values = await fetchWorkspaceValues(tpl, fetchImpl);
    if (!values) continue;
    // Every tile carries a second line: its own description, or where it is from.
    const description = tpl.description ?? fallbackDescription?.(tpl);
    out.push({ id: tpl.id, name: tpl.name, ...(description ? { description } : {}), category, values, ref: tpl.id, own: false, published: true });
  }
  return out;
}

/** What a document started from a workspace template keeps about where it came from. */
export interface TemplateOrigin {
  ref: string;
  version: number;
  /** The rules it was started under, kept so a document whose template has left the
   *  catalog still offers only what it offered. */
  editable?: string[];
  /** Kept for the same reason: the template kept its colourway and mode. */
  fixedTheme?: boolean;
}

/** Read a saved document's origin back; null for anything else. */
export function readTemplateOrigin(raw: unknown): TemplateOrigin | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (!isWorkspaceTemplateRef(o.ref) || typeof o.version !== 'number') return null;
  const editable = Array.isArray(o.editable) ? o.editable.filter((id): id is string => typeof id === 'string') : undefined;
  return { ref: o.ref, version: o.version, ...(editable ? { editable } : {}), ...(o.fixedTheme === true ? { fixedTheme: true } : {}) };
}
