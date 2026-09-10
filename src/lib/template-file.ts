// SPDX-License-Identifier: MPL-2.0
/**
 * Template files - "Export as file (.json)" writes a user template in the exact shape a
 * shipped template carries (`tools/<toolId>/templates/<tid>.json`: id, name, description,
 * values), so a self-hoster drops it into their pack and a contributor opens a pull request
 * against lolly-tools with it. This is the bridge from "mine" to "shipped" until catalog
 * submission exists in lolly-work (plans/226 section 4.7).
 *
 * The file's `id` is a slug of the name because validate-catalog requires id == basename;
 * `values` is written verbatim (the `__export_*` markers are legal keys - the validator
 * only asks for a plain object).
 */

import type { UserTemplate } from './user-templates.ts';

export interface TemplateFile {
  id: string;
  name: string;
  description?: string;
  values: Record<string, unknown>;
}

/** A filename-safe id: lowercase ascii letters, digits and single hyphens. */
export function templateFileSlug(name: string): string {
  const slug = String(name ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 64)
    .replace(/-+$/g, '');
  return slug || 'template';
}

export function templateFileFromUserTemplate(tpl: UserTemplate): TemplateFile {
  return {
    id: templateFileSlug(tpl.name),
    name: tpl.name,
    ...(tpl.description ? { description: tpl.description } : {}),
    values: tpl.values,
  };
}

/** The bytes to download: pretty JSON with a trailing newline, like the shipped files. */
export function templateFileJson(tpl: UserTemplate): string {
  return `${JSON.stringify(templateFileFromUserTemplate(tpl), null, 2)}\n`;
}

/** The suggested download name, `<toolId>-<slug>.json`. */
export function templateFileName(tpl: UserTemplate): string {
  return `${tpl.toolId}-${templateFileSlug(tpl.name)}.json`;
}
