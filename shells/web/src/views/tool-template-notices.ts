// SPDX-License-Identifier: MPL-2.0
/**
 * What a saved copy hears about the template it was made from (plans/82 M2), through
 * the one notifications list (lib/notifications.ts):
 *
 *   - a new version of a workspace template: "Use new version" brings the template's
 *     new values in and keeps what the person changed. With rules, only the inputs the
 *     template fixes move; without rules every input was theirs to change, so the new
 *     version opens as a fresh document and the saved copy stays as it is;
 *   - a retired template: the copy keeps working, and "Use the new one" opens the
 *     replacement when the workspace named one;
 *   - a tool built from a Share with rules file: the copy opens on the newest version
 *     (decision D1, 2026-11-07), and tells the person once.
 *
 * Each notice is published while the document is open and taken down with it, and a
 * dismissal is remembered per version, so "Not now" does not come back for the same one.
 */
import { publishNotification } from '../lib/notifications.ts';
import { fetchWorkspaceValues, getWorkspaceTemplate, type TemplateOrigin, type WorkspaceTemplate } from '../lib/workspace-templates.ts';
import { setTemplateInputs } from '../lib/input-policy.ts';
import { t, tRaw } from '../i18n.ts';

interface NoticeRuntime {
  getModel(): Array<{ id: string; value: unknown }>;
  applyPatch(patch: Record<string, unknown>): Promise<unknown>;
  resolveRefs(): Promise<unknown>;
}

/** The template's new values for the inputs it fixes: what "Use new version" applies.
 *  Inputs the person may change keep their own values. Pure, exported for tests. */
export function newVersionPatch(values: Record<string, unknown>, declared: readonly string[], editable: readonly string[]): Record<string, unknown> {
  const open = new Set(editable);
  const out: Record<string, unknown> = {};
  for (const id of declared) if (!open.has(id) && Object.hasOwn(values, id)) out[id] = values[id];
  return out;
}

/** Notices for a document made from a workspace template. Returns the teardown. */
export function mountTemplateNotices(opts: {
  host: unknown;
  toolId: string;
  origin: TemplateOrigin;
  now: WorkspaceTemplate | null;
  runtime: NoticeRuntime;
  /** Keep the document's origin current after an update, for its next save. */
  updated(origin: TemplateOrigin): void;
  open(href: string): void;
  fetchValues?: (tpl: WorkspaceTemplate) => Promise<Record<string, unknown> | null>;
}): () => void {
  const { now, origin } = opts;
  if (!now) return () => {};
  const offs: Array<() => void> = [];
  if (now.retired) {
    const replacement = now.replacedBy;
    offs.push(publishNotification({
      id: `template-retired:${origin.ref}`,
      title: t('Template retired'),
      body: tRaw('{name} was retired. This copy keeps working.', { name: now.name }),
      tone: 'info',
      ...(replacement ? { action: { label: t('Use the new one'), run: async () => {
        const next = await getWorkspaceTemplate(opts.host as never, replacement);
        if (next && !next.retired) opts.open(`#/tool/${encodeURIComponent(next.toolId)}?template=${encodeURIComponent(next.id)}`);
      } } } : {}),
    }));
    return () => { for (const off of offs) off(); };
  }
  if (now.version <= origin.version) return () => {};
  const startAgain = (): void => opts.open(`#/tool/${encodeURIComponent(now.toolId)}?template=${encodeURIComponent(now.id)}`);
  const editable = now.editable;
  let off = (): void => {};
  off = publishNotification({
    id: `template-version:${origin.ref}:${now.version}`,
    title: t('New version available'),
    body: editable
      ? tRaw('{name} has a new version. What you changed is kept.', { name: now.name })
      : tRaw('{name} has a new version. It opens as a new document, and this copy stays as it is.', { name: now.name }),
    tone: 'action',
    action: editable ? { label: t('Use new version'), run: async () => {
      const values = await (opts.fetchValues ?? fetchWorkspaceValues)(now);
      if (!values) return;
      const declared = opts.runtime.getModel().map((input) => input.id);
      await opts.runtime.applyPatch(newVersionPatch(values, declared, editable));
      await opts.runtime.resolveRefs();
      setTemplateInputs(opts.toolId, editable);
      opts.updated({ ref: origin.ref, version: now.version, editable });
      off();
    } } : { label: t('Open new version'), run: startAgain },
  });
  return () => off();
}

/** The once-only notice for a tool built from a Share with rules file that moved on
 *  since this copy was saved: the copy opens on the newest version (decision D1). */
export function mountRulesToolNotice(opts: { toolId: string; name: string; savedVersion: unknown; version: string }): () => void {
  if (typeof opts.savedVersion !== 'string' || opts.savedVersion === opts.version) return () => {};
  return publishNotification({
    id: `rules-tool-updated:${opts.toolId}:${opts.version}`,
    title: t('Updated to the new version'),
    body: tRaw('{name} is now version {version}. Your entries are kept.', { name: opts.name, version: opts.version }),
    tone: 'info',
  });
}
