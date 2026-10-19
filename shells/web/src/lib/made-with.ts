// SPDX-License-Identifier: MPL-2.0
/**
 * The design-system record (plans/319) in the words people read, shared by every surface that shows the record.
 *
 * Three surfaces show the same words, so they share this module: the export
 * panel's "Design system" card (views/tool-actions/notes.ts), the Design editor's
 * "Embedded in exports" panel (views/free-canvas/field-panels.ts) and Verify's
 * file details (views/valid.ts). The label is text the design system's owners
 * typed, possibly a client's name, so it is shown exactly as it will be written.
 *
 * Every string here is for a TEXT sink (textContent, or a caller that escapes) and
 * so goes through tRaw: an HTML-escaped label would show its entities literally.
 */
import type { DesignRecord, MadeWithPreview } from '../../../../engine/src/metadata.ts';
import { readDesignRecord, themesSelection } from '../../../../engine/src/metadata.ts';
import { t, tRaw } from '../i18n.ts';

/**
 * The record as one line: "Acme · Version 2026-10 · Colourway: Persimmon". Empty
 * for an empty record.
 */
export function madeWithWords(record: DesignRecord | null | undefined): string {
  if (!record) return '';
  const parts: string[] = [];
  if (record.designSystem) parts.push(record.designSystem.label);
  if (record.designVersion) parts.push(tRaw('Version {version}', { version: record.designVersion }));
  for (const choice of record.themes ?? []) {
    parts.push(choice.kind === 'colourway'
      ? tRaw('Colourway: {name}', { name: choice.name })
      : tRaw('{group}: {name}', { group: choice.group || t('Theme'), name: choice.name }));
  }
  return parts.join(' · ');
}

/** The slice of a design-system summary the Recreate rule compares. */
export interface HeldDesignSystem {
  id: string;
  label: string;
}

/**
 * The record's design system as a `ds=` value, or null. Only a system this device
 * holds under the same id AND the same label qualifies: an id is a slug of a label,
 * so two people's "My design system" share one, and a Recreate link must never
 * switch this device to an unrelated system that happens to share the id. Without
 * a match the link opens with the active design system, as any `ds=` link to a
 * system the device lacks does.
 */
export function recreateSystemId(record: DesignRecord | null | undefined, held: readonly HeldDesignSystem[]): string | null {
  const wanted = record?.designSystem;
  if (!wanted) return null;
  return held.some((s) => s.id === wanted.id && s.label.trim() === wanted.label.trim()) ? wanted.id : null;
}

/**
 * A tool link that reopens the design version and theme choices a record names,
 * plus the design system itself when `systemId` says the device holds it
 * (recreateSystemId): `ds=`, `designv=` and `_themes=` appended to the hash route
 * `toolSeedHref` built. The link always opens; an unknown version or theme falls
 * back the way every link's does.
 */
export function withDesignRecordParams(href: string, record: DesignRecord | null | undefined, systemId: string | null = null): string {
  if (!record) return href;
  const extra = new URLSearchParams();
  if (systemId) extra.set('ds', systemId);
  if (record.designVersion) extra.set('designv', record.designVersion);
  const themes = themesSelection(record.themes);
  if (themes) extra.set('_themes', JSON.stringify(themes));
  const tail = extra.toString();
  if (!tail) return href;
  return `${href}${href.includes('?') ? '&' : '?'}${tail}`;
}

/**
 * Verify's "Recreate with these settings" link with the credential's design-system
 * record applied (plans/319): `href` is the settings link `toolSeedHref` built,
 * `environment` the credential's `tools.lolly.export` assertion and `held` the
 * design systems this device holds. A credential with no record returns `href`.
 */
export function recreateWithRecord(
  href: string,
  environment: Readonly<Record<string, unknown>> | null | undefined,
  held: readonly HeldDesignSystem[],
): string {
  const record = readDesignRecord(environment ?? null);
  return record ? withDesignRecordParams(href, record, recreateSystemId(record, held)) : href;
}

/** Verify's "Design system" fact for a credential's export assertion, or null when it records none. */
export function madeWithFact(environment: Readonly<Record<string, unknown>> | null | undefined): string | null {
  return madeWithWords(readDesignRecord(environment ?? null)) || null;
}

/**
 * The Recreate link for one verified file: `recreateWithRecord` over the report's
 * credential and the design systems the host holds. A host that cannot list its
 * systems recreates with the version and theme choices only.
 */
export async function recreateHrefFor(
  href: string,
  report: { environment?: Readonly<Record<string, unknown>> | null } | null | undefined,
  host: { tokens?: { list?(): Promise<readonly HeldDesignSystem[]> } },
): Promise<string> {
  if (!report?.environment) return href;
  const held = await host.tokens?.list?.().catch(() => []) ?? [];
  return recreateWithRecord(href, report.environment, held);
}

/**
 * The Design editor's "Embedded in exports" line (DocInfo.madeWith) from a runtime:
 * whether the record is on, its words and the description as it will read. Null
 * when there is nothing to record.
 */
export async function madeWithLine(runtime: {
  madeWithPreview(): Promise<MadeWithPreview | null>;
  madeWith(): boolean;
}): Promise<{ on: boolean; words: string; description: string } | null> {
  const preview = await runtime.madeWithPreview().catch(() => null);
  if (!preview) return null;
  const on = runtime.madeWith();
  return { on, words: madeWithWords(preview.record), description: on ? preview.description : preview.plainDescription };
}
