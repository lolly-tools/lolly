// SPDX-License-Identifier: MPL-2.0
/**
 * The remembered export shape, per tool (plans/163 L3).
 *
 * Someone who exports a tool as PNG at 1080 three times should find the sheet
 * already set that way on the fourth visit. Every successful Download writes its
 * `{ format, width, height, unit, dpi }` here; the next fresh mount fills in
 * whatever nothing else supplied. There is no UI and no switch - it is the tool's
 * own defaults getting better, not a feature.
 *
 * Persisted through `host.state`, never localStorage (the bridge rule), under the
 * `__xprefs__:` namespace so `isHiddenSlot` keeps these out of every session list -
 * they are a preference, not saved work.
 */
import { XPREFS_SLOT_PREFIX } from './batch-slots.ts';

/** What the sheet remembers about a finished download. */
export interface ExportPrefs {
  format?: string;
  width?: number;
  height?: number;
  unit?: string;
  dpi?: number;
}

/** The slice of the host this module touches. */
interface PrefsHost {
  state: {
    save(slot: string, data: object): Promise<void>;
    load(slot: string): Promise<object | null>;
  };
}

const slotFor = (toolId: string): string => XPREFS_SLOT_PREFIX + toolId;

/** Remember this export's shape. Best-effort: a failed write only costs the memory. */
export async function saveExportPrefs(host: PrefsHost, toolId: string, prefs: ExportPrefs): Promise<void> {
  if (!toolId) return;
  const clean: ExportPrefs = {};
  if (prefs.format) clean.format = prefs.format;
  if (prefs.width) clean.width = prefs.width;
  if (prefs.height) clean.height = prefs.height;
  if (prefs.unit) clean.unit = prefs.unit;
  if (prefs.dpi) clean.dpi = prefs.dpi;
  try { await host.state.save(slotFor(toolId), clean); }
  catch { /* remembering is best-effort - the file already reached the user */ }
}

/** What this tool was last exported as, or null when it never has been. */
export async function loadExportPrefs(host: PrefsHost, toolId: string): Promise<ExportPrefs | null> {
  if (!toolId) return null;
  try {
    const stored = await host.state.load(slotFor(toolId));
    return stored ? stored as ExportPrefs : null;
  } catch { return null; }
}

/**
 * Fill export defaults from the remembered shape. Everything explicit - a URL
 * param, a restored session, a manifest size driver - is already in `base` and
 * always wins; the remembered values only reach fields that would otherwise fall
 * back to the manifest.
 *
 * The size is remembered as ONE shape: width, height, unit and DPI fill together,
 * and only when nothing supplied a size at all. Filling `unit` on its own would
 * read an explicit `?w=800` as 800 mm.
 *
 * A format the tool no longer offers (a narrowed manifest, an export policy) is
 * dropped rather than carried - the same test the export sheet applies to
 * `exportDefaults.format` before it seeds the picker.
 */
export function mergeExportPrefs<T extends ExportPrefs>(
  base: T,
  remembered: ExportPrefs | null | undefined,
  formats: readonly string[],
): T {
  if (!remembered) return base;
  const out = { ...base };
  if (!out.format && remembered.format && formats.includes(remembered.format)) {
    out.format = remembered.format;
  }
  if (out.width == null && out.height == null && (remembered.width || remembered.height)) {
    if (remembered.width) out.width = remembered.width;
    if (remembered.height) out.height = remembered.height;
    if (remembered.unit) out.unit = remembered.unit;
    if (remembered.dpi) out.dpi = remembered.dpi;
  }
  return out;
}
