// SPDX-License-Identifier: MPL-2.0
/** The saved document envelope shared by Save, automatic history and .lolly. */
import { emojiParams } from '../../../../engine/src/emoji-style.ts';
import type { EmojiStyleV1 } from '@lolly-tools/core';
import type { ToolManifest } from '../../../../engine/src/loader.ts';
import type { InputValue } from '../../../../engine/src/inputs.ts';
import { tokenRestoreRefsOf } from '../../../../engine/src/inputs.ts';
import type { ToolRuntime, ActionsExperience } from './tool.ts';
import type { SavedStateData } from '../bridge/state.ts';

export function snapshotSession(el: HTMLElement | null, manifest: ToolManifest, runtime: ToolRuntime,
  experience: ActionsExperience, readBleed: (el: Element | null) => string,
  readMarks: (el: Element | null) => string): SavedStateData & { __export_format: string } {
    const values: Record<string, InputValue> = Object.fromEntries(
      runtime.getModel().map((i) => [i.id, i.value])
    );
    // The effective export format (user-selected, or the tool's default). Drives
    // a vector (SVG) thumbnail for vector tools - see captureThumbnail.
    const fmt = el?.querySelector<HTMLSelectElement>('[data-action="format"]')?.value ?? '';
    const filename =
      el?.querySelector<HTMLInputElement>('[data-action="filename"]')?.value.trim() ?? '';
    const meta = experience.sessionMeta?.() ?? {};
    // A tool whose workspace gives the document its title (Text uses the file it
    // opened) offers that title through sessionMeta; a typed export name still wins.
    const metaLabel = typeof meta.__label === 'string' && meta.__label.trim() ? meta.__label.trim() : undefined;
    return {
      ...values,
      ...(Object.keys(tokenRestoreRefsOf(runtime.getModel())).length ? { __tokenLinks: tokenRestoreRefsOf(runtime.getModel()) } : {}),
      ...(runtime.tokenSelection ? { __tokenSelection: structuredClone(runtime.tokenSelection) } : {}),
      ...(runtime.emoji?.style ? { __emoji: emojiParams(runtime.emoji.style), __emojiAssets: runtime.emoji.assets ?? [] } : { __emoji: { emoji: 'none', emojifx: '' }, __emojiAssets: [] }),
      ...meta,
      __emojiUsage: runtime.emoji?.sources?.map(({ pack, assetId }) => ({ packId: pack.id, version: pack.pin.version, checksum: pack.checksum, assetId })),
      __toolId: manifest.id,
      __toolVersion: manifest.version,
      // The saved record's TITLE, which is the document name the author typed - the same
      // field the export sheet and the Design top bar both write (plan 179 M1). bridge/
      // state.ts maps `__label` onto the session record's label, which is what the
      // Projects tiles and the session list show; `undefined` (never '') leaves the
      // existing auto-label alone, so an unnamed document keeps the title it always had.
      __label: filename || metaLabel,
      __export_filename: filename,
      __export_format: fmt,
      __export_width:
        el?.querySelector<HTMLInputElement>('[data-action="export-width"]')?.value ?? '',
      __export_height:
        el?.querySelector<HTMLInputElement>('[data-action="export-height"]')?.value ?? '',
      __export_unit:
        el?.querySelector<HTMLSelectElement>('[data-action="export-unit"]')?.value ?? 'px',
      __export_dpi: el?.querySelector<HTMLInputElement>('[data-action="export-dpi"]')?.value ?? '',
      __export_profile:
        el?.querySelector<HTMLSelectElement>('[data-action="cmyk-profile"]')?.value ?? '',
      __export_bleed: readBleed(el),
      __export_marks: readMarks(el),
      __export_licence: runtime.outputLicence?.() ?? '',
    };
  }

/** The emoji stamp's three parts, whatever order a stored record keeps them in. */
function sameEmojiStamp(a: unknown, b: { emoji: string; emojifx: string; emojistyle: string }): boolean {
  if (!a || typeof a !== 'object') return false;
  const stamp = a as Record<string, unknown>;
  return stamp.emoji === b.emoji && stamp.emojifx === b.emojifx && (stamp.emojistyle ?? '') === b.emojistyle;
}

/**
 * The emoji artwork pins the opened document already records, while this runtime has
 * not resolved its own for the same style yet (plan 277 P4, phase 0 finding 1). The
 * pins arrive once the Emoji section has loaded the set's artwork, which can be after
 * the first write: without this, a reopened creation's first write dropped the pin
 * its record held and the next one added it back, so Compare showed a change nobody
 * made. The same style means the same artwork, so the stored pins are the right ones.
 * Returns nothing to add when the runtime has pins of its own, has no set chosen, or
 * the opened record was made with another style.
 */
export function carriedEmojiPins(
  emoji: { style: EmojiStyleV1 | null; assets?: readonly unknown[] } | undefined,
  opened: Readonly<Record<string, unknown>>,
): { __emojiAssets: unknown[] } | Record<string, never> {
  if (!emoji?.style || emoji.assets?.length) return {};
  const pins = opened.__emojiAssets;
  if (!Array.isArray(pins) || !pins.length || !sameEmojiStamp(opened.__emoji, emojiParams(emoji.style))) return {};
  return { __emojiAssets: structuredClone(pins) };
}

/** A snapshot has an emoji set chosen but carries none of its artwork pins yet. */
export function awaitsEmojiPins(data: Readonly<Record<string, unknown>>): boolean {
  const stamp = data.__emoji;
  const named = !!stamp && typeof stamp === 'object' && typeof (stamp as Record<string, unknown>).emoji === 'string'
    && (stamp as Record<string, unknown>).emoji !== 'none';
  return named && !(Array.isArray(data.__emojiAssets) && data.__emojiAssets.length);
}

/**
 * What a TEMPLATE keeps from a saved document (plans/226). A template is a starting
 * point, so it drops the per-document identity - the title (`__label`, and its twin
 * `__export_filename`, which would otherwise name every document it seeds) and the
 * tool stamp (the record carries `toolId`) - and every `file` input, whose value is bytes
 * in memory rather than a seed. Everything else stays verbatim, including the
 * `__export_*` settings, so a template opens at the size, format and dpi it was saved
 * at. The same helper feeds the editor's "Save as a template" and the Projects
 * "Save as a template..." on a session tile, so the two produce identical records.
 */
export function templateValuesFromSnapshot(
  snapshot: Record<string, unknown>,
  manifest: { inputs?: ReadonlyArray<{ id: string; type?: string }> },
): Record<string, unknown> {
  const fileInputs = new Set((manifest.inputs ?? []).filter((i) => i.type === 'file').map((i) => i.id));
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(snapshot)) {
    if (TEMPLATE_DROPPED_KEYS.has(key) || fileInputs.has(key) || value === undefined) continue;
    out[key] = value;
  }
  return out;
}

/** The per-document keys a template never carries (see templateValuesFromSnapshot). */
export const TEMPLATE_DROPPED_KEYS: ReadonlySet<string> = new Set([
  '__label', '__toolId', '__toolVersion', '__export_filename',
]);
