// SPDX-License-Identifier: MPL-2.0
/**
 * The brand-swatch → CMYK lookup every CMYK sink shares.
 *
 * ## Why it is in the engine
 *
 * There are four CMYK sinks in the platform and they live in two different
 * shells: the web shell's CMYK PDF rewrite and its flat TIFF/EPS paths
 * (`shells/web/src/bridge/export.ts` + `export-pdf-vector.ts`), and the CLI's
 * `eps-cmyk` (`shells/cli/src/bridge.ts` → `engine/src/eps.ts`). While the
 * builder lived under `shells/web`, the CLI sink could not reach it, so the
 * FINISH FIX was web-only: `lolly wordmark --export=eps-cmyk` still converted a
 * declared foil to its plausible swatch gold, silently, which is the exact defect
 * the fix set out to remove. A contract test that only scanned `shells/web` could
 * not see it either.
 *
 * So the rule this module exists to hold: **one implementation, reachable from
 * every shell.** Pure, DOM-free, no brand knowledge beyond the swatch list it is
 * handed.
 */
import { rgbToCmyk } from './color.ts';
import type { FinishKind, SpotColor } from '@lolly-tools/core/host-v1';

/**
 * A shell's brand palette entry: hex + CMYK 0–100, with independent `cmyk` and
 * `spot` locks (a swatch may carry either, both, or neither).
 *
 * `spot` is the CANONICAL host-v1 `SpotColor`, not a local restatement, so a
 * field added to the contract (v1.91's `finish`) can never again be silently
 * dropped at this boundary.
 */
export interface BrandPaletteEntry {
  hex?: string;
  cmyk?: number[];
  label?: string;
  spot?: SpotColor | null;
}

export interface PaletteSpotHit { name: string; cmyk: [number, number, number, number]; finish?: FinishKind; }
export interface PaletteHit { cmyk: [number, number, number, number]; spot?: PaletteSpotHit; }

/**
 * The CMYK build every DECLARED FINISH gets, in every CMYK sink.
 *
 * A finish (host-v1 `FinishKind`: foil, emboss, spot-uv, cut, …) is not a
 * colour — it is a press instruction with its own plate — so it has no process
 * build at all, and the swatch hex a brand author picked merely to DEPICT it on
 * screen must never become one. 100% K is the trade convention for technical /
 * mask art:
 *   - a RIP that honours the named /Separation never evaluates the tint
 *     transform's alternate, so this value is inert there — the plate is
 *     byte-for-byte what it was before this constant existed;
 *   - a RIP (or web-to-print portal) that FLATTENS spots to process paints an
 *     unmistakable solid black mask where the foil goes, instead of a plausible
 *     metallic gold that sails through unnoticed. That is the whole point: the
 *     failure becomes loud rather than silent.
 * Never [0,0,0,0] (flattens to invisible — silent again) and never [1,1,1,1]
 * (400% TAC, and registration ink already means something else).
 *
 * This is the RIP-FLATTEN FALLBACK, not the primary path: in the pdf-cmyk export
 * the finish plate now OVERPRINTS (the export bridge selects an overprint graphics
 * state for it), so on a RIP that honours the named plate it sits ON the artwork.
 * This 100% K mask is what a RIP that DROPS the plate paints instead — loud and
 * unmistakable, never a plausible metallic. `print.finish-separates-as-ink` now
 * reports the handoff choice (own overprinting plate vs separate finish artwork),
 * not a knockout defect.
 */
export const FINISH_MASK_CMYK: [number, number, number, number] = [0, 0, 0, 1];

/**
 * Quantise an RGB triple (0–1) to a brand-match key.
 *
 * The precision MUST match what jsPDF writes into the content stream: it emits
 * colour operators at two decimals (254/255 → "1.", 124/255 → "0.49"), so the
 * palette side has to bucket to two decimals too — a 3-decimal key never matches
 * jsPDF's "0.49" against the hex-exact 0.486, and every brand colour silently
 * falls through to the generic conversion. No 0–255 channel lands on a .5
 * boundary at x100, so jsPDF's toFixed(2) and Math.round always agree.
 */
export function cmykKey(r: number, g: number, b: number): string {
  return `${Math.round(r * 100)},${Math.round(g * 100)},${Math.round(b * 100)}`;
}

/**
 * Builds a lookup map from quantised RGB keys to their locked CMYK (+ optional
 * spot name). Shared by every CMYK export path (PDF / TIFF / EPS, web and CLI)
 * for exact brand-swatch matches.
 */
export function buildCmykPaletteMap(palette: readonly BrandPaletteEntry[]): Map<string, PaletteHit> {
  const map = new Map<string, PaletteHit>();
  for (const { hex, cmyk, spot } of palette ?? []) {
    if (!hex || (!cmyk && !spot)) continue;
    const h = hex.replace('#', '').toLowerCase();
    if (h.length !== 6) continue;
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    // An explicit cmyk lock always wins; a spot-only lock derives its
    // equivalent from the swatch's own hex (same fallback used when neither
    // is locked at all).
    const frac = cmyk && cmyk.length === 4 ? (cmyk.map(v => v / 100) as [number, number, number, number]) : rgbToCmyk(r, g, b);
    // A DECLARED FINISH never contributes to the process build, and is never
    // gamut-mapped or merged into CMYK — its build is the mask, not the swatch's
    // own colour, and an explicit cmyk anchor is deliberately overridden (a
    // brand may have anchored a "gold-ish" build for on-screen use; honouring it
    // here is precisely the silent failure). This one line covers every CMYK
    // sink: the PDF Separation's tint transform reads spot.cmyk, the flat
    // TIFF/EPS paths read cmyk.
    const build = spot?.finish ? FINISH_MASK_CMYK : frac;
    map.set(cmykKey(r, g, b), spot
      ? { cmyk: build, spot: { name: spot.name, cmyk: build, ...(spot.finish ? { finish: spot.finish } : {}) } }
      : { cmyk: frac });
  }
  return map;
}

/** True when any swatch in scope declares a finish. */
export function paletteHasFinish(palette: readonly BrandPaletteEntry[] | undefined): boolean {
  return (palette ?? []).some(p => typeof p?.spot?.finish === 'string' && p.spot.finish !== '');
}
