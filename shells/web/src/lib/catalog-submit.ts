// SPDX-License-Identifier: MPL-2.0
/**
 * catalog-submit - a generic seam for offering one of the person's own things to a
 * shared catalog: an uploaded file, a saved template, or a tool they built.
 *
 * The sibling of lib/approval-request.ts and lib/share-sections.ts: EMPTY by default,
 * so a plain build renders every surface exactly as before (no menu row, no button,
 * no network). A deployment's optional control plane (src/org/) registers a submitter
 * when the signed-in member may submit, and the surfaces that hold the person's own
 * things ask this module whether to offer the action and, when pressed, hand it a
 * subject. Everything after that - the dialog, the request, the review state - belongs
 * to whoever registered.
 *
 * A subject is described here without naming any server product, and its bytes are produced
 * only when the submitter asks for them, so a surface never reads a file or builds a
 * JSON document for an action nobody took.
 */

import type { AssetRef } from '@lolly-tools/core/host-v1';
import { getHostRef } from './host-ref.ts';
import { templateFileFromUserTemplate } from './template-file.ts';
import type { UserTemplate } from './user-templates.ts';
import type { UserTool } from './user-tools.ts';

export type CatalogSubmitKind = 'upload' | 'template' | 'user-tool';

export interface CatalogSubmitSubject {
  kind: CatalogSubmitKind;
  /** A stable reference the submitter can use to find this thing's earlier submission,
   *  e.g. `template:<id>`. */
  ref: string;
  name: string;
  description?: string;
  tags?: string[];
  /** The tool a template or user tool opens in. */
  toolId?: string;
  /** The bytes to send, produced on demand. */
  body(): Promise<Blob>;
}

export interface CatalogSubmitter {
  /** The action's label, already localised ("Submit to Acme"). */
  label(): string;
  /** Whether this submitter takes this kind of thing. */
  accepts(kind: CatalogSubmitKind): boolean;
  /** Open the submit flow for one subject. */
  open(subject: CatalogSubmitSubject): void;
}

let current: CatalogSubmitter | undefined;

/** Register the submitter; returns an unregister fn. A later register replaces the
 *  current one (last wins), like the approval opener. */
export function registerCatalogSubmitter(s: CatalogSubmitter): () => void {
  current = s;
  return () => { if (current === s) current = undefined; };
}

/** The submitter for this kind of thing, or null (the dormant default). */
export function catalogSubmitter(kind: CatalogSubmitKind): CatalogSubmitter | null {
  try { return current?.accepts(kind) ? current : null; } catch { return null; }
}

/** Open the flow for a subject; false when nothing is registered for its kind.
 *  Tolerant: a throwing submitter is swallowed so a surface never breaks on a submitter's error. */
export function openCatalogSubmit(subject: CatalogSubmitSubject): boolean {
  const s = catalogSubmitter(subject.kind);
  if (!s) return false;
  try { s.open(subject); return true; } catch { return false; }
}

const json = (doc: unknown): Blob => new Blob([`${JSON.stringify(doc, null, 2)}\n`], { type: 'application/json' });

/** One of the person's uploads, as a subject. */
export function uploadSubject(ref: AssetRef): CatalogSubmitSubject {
  const meta = (ref.meta ?? {}) as { name?: unknown; tags?: unknown; description?: unknown };
  const name = typeof meta.name === 'string' && meta.name.trim() ? meta.name.trim() : ref.id.split('/').pop() ?? ref.id;
  return {
    kind: 'upload',
    ref: `upload:${ref.id}`,
    name,
    ...(typeof meta.description === 'string' && meta.description.trim() ? { description: meta.description.trim() } : {}),
    tags: Array.isArray(meta.tags) ? meta.tags.filter((t): t is string => typeof t === 'string') : [],
    body: async () => {
      const res = await fetch(ref.url);
      if (!res.ok) throw new Error(`could not read ${name}`);
      return res.blob();
    },
  };
}

/** A saved template, as a subject: the exported file's shape plus the tool it seeds. */
export function templateSubject(tpl: UserTemplate): CatalogSubmitSubject {
  return {
    kind: 'template',
    ref: `template:${tpl.id}`,
    name: tpl.name,
    ...(tpl.description ? { description: tpl.description } : {}),
    toolId: tpl.toolId,
    body: async () => json({ toolId: tpl.toolId, ...templateFileFromUserTemplate(tpl) }),
  };
}

/** A tool the person built on another tool, as a subject. */
export function userToolSubject(tool: UserTool): CatalogSubmitSubject {
  return {
    kind: 'user-tool',
    ref: `user-tool:${tool.id}`,
    name: tool.title,
    ...(tool.description ? { description: tool.description } : {}),
    toolId: tool.baseToolId,
    body: async () => json({
      baseToolId: tool.baseToolId, title: tool.title,
      ...(tool.description ? { description: tool.description } : {}),
      ...(tool.icon ? { icon: tool.icon } : {}),
      formats: tool.formats, values: tool.values,
    }),
  };
}

/**
 * After a tool is built from a document, offer it to the workspace with a toast whose
 * action opens the submit flow. The tool is read back from the profile by its title
 * (newest first), which is where the save just put the new tool. Does nothing when no submitter
 * takes user tools, so a plain build shows only what it showed before.
 */
export async function offerUserToolSubmit(title: string, message: string): Promise<void> {
  const submitter = catalogSubmitter('user-tool');
  const host = getHostRef();
  if (!submitter || !host) return;
  try {
    const profile = (await host.profile.get()) as { userTools?: UserTool[] };
    const tool = (profile.userTools ?? [])
      .filter((u) => u.title === title)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))[0];
    if (!tool) return;
    const { showUndoToast } = await import('./undo-toast.ts');
    showUndoToast({ message, actionLabel: submitter.label(), duration: 8000, undo: () => { openCatalogSubmit(userToolSubject(tool)); } });
  } catch { /* an offer, never a failure the person has to read */ }
}

/** TEST-ONLY: drop any registered submitter, restoring the dormant default. */
export function _clearCatalogSubmitterForTests(): void {
  current = undefined;
}
