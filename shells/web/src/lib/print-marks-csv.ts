/**
 * The `marks` CSV codec - the ONE place the web shell encodes and decodes print
 * mark flags.
 *
 * The `marks` URL param is a CSV (`crop,reg,bleed,bars,prov`). The engine parses
 * it (`parseMarks` in engine/src/url-mode.ts) but that function is module-private
 * and there is no engine-side ENCODER at all - `serializeUrlState` takes a
 * pre-made string. So the shell owns both directions, and before this module it
 * owned only one: `marksToCsv` lived inside the tool-actions view, and nothing
 * could read a stored CSV back. That asymmetry is why a saved session's print
 * marks were silently dropped on the batch/folder render path - the settings were
 * stored faithfully and then had no decoder to come back through.
 *
 * `csvToMarks` deliberately mirrors the engine's token aliases exactly (`reg` /
 * `registration`, `bars` / `colorbars`, `prov` / `provenance`) so a CSV that came
 * from a URL, a saved session, or a batch CSV column all decode identically. Keep
 * the two in step: engine/src/url-mode.ts `parseMarks` is the reference.
 *
 * Absent (`null`/`undefined`/empty) decodes to `null`, NOT to all-false - callers
 * fall back to their own defaults, matching the engine's contract. All-false is a
 * real state ("card on, every mark unticked") and must stay distinguishable.
 */
import type { PrintMarks } from '../views/tool.ts';

/** Encode print-mark flags as the `marks` CSV. Empty string when nothing is set. */
export function marksToCsv(m: Partial<PrintMarks> | null | undefined): string {
  return m
    ? [m.crop && 'crop', m.registration && 'reg', m.bleed && 'bleed', m.colorBars && 'bars', m.provenance && 'prov']
      .filter(Boolean).join(',')
    : '';
}

/** Decode the `marks` CSV. `null` when absent, so callers keep their own defaults. */
export function csvToMarks(raw: string | null | undefined): PrintMarks | null {
  if (raw == null || raw === '') return null;
  const set = new Set(String(raw).split(',').map(s => s.trim().toLowerCase()).filter(Boolean));
  return {
    crop:         set.has('crop'),
    registration: set.has('reg') || set.has('registration'),
    bleed:        set.has('bleed'),
    colorBars:    set.has('bars') || set.has('colorbars'),
    provenance:   set.has('prov') || set.has('provenance'),
  };
}
