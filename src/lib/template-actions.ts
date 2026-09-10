// SPDX-License-Identifier: MPL-2.0
/**
 * Template actions - the handlers the chooser's tile menu and the Projects Templates
 * collection share (plans/226 section 4), so hide / restore / start-with / make-a-copy /
 * export-as-file behave identically wherever a template tile is. Each takes the host and
 * does its own profile read, so a caller never has to thread a profile through.
 */

import type { HostV1, Profile } from '@lolly-tools/core/host-v1';
import { loadHiddenTemplates, saveHiddenTemplates } from './hidden-templates.ts';
import { templateFileJson, templateFileName } from './template-file.ts';
import { parseTemplateRef, shippedTemplateRef, type TemplateRef } from './template-ref.ts';
import { loadTemplateStart, saveTemplateStart, type TemplateStart } from './template-start.ts';
import { createUserTemplateStore, type UserTemplate } from './user-templates.ts';

/** The host slice these actions need: the profile pair. `set` is optional in the type so a
 *  plain HostV1 passes without a cast; the web host has it at runtime. */
export type TemplateActionHost = HostV1 & { profile: { set?(p: Profile): Promise<void> } };

const templateStore = (host: TemplateActionHost) =>
  createUserTemplateStore(host);

/** Hide a SHIPPED template; `defaults` = the brand's defaultHiddenTemplateRefs(). */
export async function hideShippedTemplate(host: TemplateActionHost, ref: TemplateRef, defaults: readonly string[] = []): Promise<Set<string>> {
  if (parseTemplateRef(ref)?.kind !== 'shipped') throw new Error('Only a shipped template can be hidden.');
  const profile = await host.profile.get();
  const set = loadHiddenTemplates(profile, defaults);
  set.add(ref);
  await saveHiddenTemplates(host, profile, set);
  return set;
}

/** Restore a hidden shipped template. */
export async function restoreShippedTemplate(host: TemplateActionHost, ref: TemplateRef, defaults: readonly string[] = []): Promise<Set<string>> {
  const profile = await host.profile.get();
  const set = loadHiddenTemplates(profile, defaults);
  set.delete(ref);
  await saveHiddenTemplates(host, profile, set);
  return set;
}

export async function hiddenTemplates(host: TemplateActionHost, defaults: readonly string[] = []): Promise<Set<string>> {
  return loadHiddenTemplates(await host.profile.get(), defaults);
}

/** Read a tool's "Start with" (null = ask). */
export async function startWith(host: TemplateActionHost, toolId: string): Promise<TemplateStart | null> {
  return loadTemplateStart(await host.profile.get(), toolId);
}

/** Set a tool's "Start with" to a template ref or 'blank'; null = ask (clears it). */
export async function setStartWith(host: TemplateActionHost, toolId: string, value: TemplateStart | null): Promise<void> {
  const profile = await host.profile.get();
  await saveTemplateStart(host, profile, toolId, value);
}

/**
 * "Make a copy": a user template seeded from a shipped one, `from` stamped with the
 * shipped ref so the tile can say where it came from. The caller has already fetched the
 * shipped values (the chooser has them; the collection uses resolveTemplateSeed).
 */
export async function copyShippedTemplate(
  host: TemplateActionHost,
  toolId: string,
  tid: string,
  values: Record<string, unknown>,
  meta: { name: string; description?: string; designSystem?: { id: string; label: string } },
): Promise<UserTemplate> {
  return templateStore(host).save({
    toolId,
    name: meta.name,
    description: meta.description,
    values: JSON.parse(JSON.stringify(values)) as Record<string, unknown>,
    designSystem: meta.designSystem,
    from: shippedTemplateRef(toolId, tid),
  });
}

/** Delete a template the person saved; if it was a tool's "Start with", the setting clears. */
export async function deleteUserTemplate(host: TemplateActionHost, tpl: Pick<UserTemplate, 'id' | 'toolId'>): Promise<void> {
  await templateStore(host).remove(tpl.id);
  const profile = await host.profile.get();
  if (loadTemplateStart(profile, tpl.toolId) === `user:${tpl.id}`) await saveTemplateStart(host, profile, tpl.toolId, null);
}

/**
 * The design-system stamp a saved template carries (display only): the active record's
 * id + label, read the way sessions read it. Undefined when the shell has no registry.
 */
export async function templateDesignSystemStamp(host: HostV1): Promise<{ id: string; label: string } | undefined> {
  try {
    const { activeDesignSystemRecord } = await import('./design-system/active.ts');
    const rec = await activeDesignSystemRecord(host);
    return rec && typeof rec.id === 'string' && typeof rec.label === 'string' ? { id: rec.id, label: rec.label } : undefined;
  } catch {
    return undefined;
  }
}

/**
 * "Export as file (.json)": the shipped file shape, delivered through the host's
 * overridable download verb so the Tauri shells save natively (a raw anchor click is a
 * no-op in a WebView - see raw-anchor-download-guard.test.ts). Without a host, the one
 * legitimate anchor in bridge/export.ts is used.
 */
export async function downloadTemplateFile(tpl: UserTemplate, host?: Pick<HostV1, 'export'>): Promise<void> {
  const blob = new Blob([templateFileJson(tpl)], { type: 'application/json' });
  const filename = templateFileName(tpl);
  if (host?.export?.download) {
    await host.export.download(blob, filename);
    return;
  }
  const { anchorSave } = await import('../bridge/export.ts');
  anchorSave(blob, filename);
}
