// SPDX-License-Identifier: MPL-2.0
/**
 * The active brand's palette, live - for the few call sites that need real
 * PaletteEntry[] (CMYK PDF ink substitution, the Dashboard/Catalog swatch
 * displays) rather than a colour picker's flat swatch list.
 *
 * palette.ts's PALETTE is deliberately the tokenless STARTER fallback (its own
 * header says so) - every profile that ships a brand (SUSE included) carries
 * its own catalog tokens doc, resolved through host.tokens exactly like the
 * colour-field picker already does (see tool.ts's setSwatches call). Without
 * this, anything importing PALETTE directly shows the starter swatches (and,
 * worse, substitutes the starter's placeholder/absent CMYK ink) regardless of
 * which brand's catalog is actually active - see plans/… the SUSE profile
 * regression this fixes.
 */
import { PALETTE, type PaletteEntry } from '../palette.ts';
import type { SpotColor } from '@lolly-tools/core/host-v1';

/** The host slice this module reads. */
interface LivePaletteHost {
  tokens?: { colors?(opts?: { theme?: string }): Promise<LiveSwatch[]> };
}

/** The shape host.tokens.colors() resolves (engine ColorSwatch, structurally). */
interface LiveSwatch {
  path: string;
  name: string;
  group: string | null;
  value: string;
  cmyk: number[] | null;
  spot: SpotColor | null;
}

// A resolved token's `group` is already prettified for display (e.g. a ramp
// step's group is its family, "Jungle"; a top-level brand/spectrum colour's
// group is its DTCG parent, "Brand"/"Spectrum") - not the raw grouping
// groupPalette() expects (undefined for a brand colour, the literal lowercase
// 'spectrum' for the secondary palette). The DTCG path's second segment (the
// bucket right under `color.`) says which is which, so use that instead of
// the display group to reconstruct groupPalette()-compatible entries.
/** Exported for tests - see live-palette.test.ts. */
export function toPaletteEntry(s: LiveSwatch): PaletteEntry {
  const bucket = s.path.split('.')[1]; // 'brand' | 'ramp' | 'spectrum' | 'semantic' | 'custom' | …
  return {
    hex: s.value,
    label: s.name,
    cmyk: Array.isArray(s.cmyk) && s.cmyk.length === 4 ? (s.cmyk as [number, number, number, number]) : null,
    spot: s.spot,
    group: bucket === 'spectrum' ? 'spectrum' : bucket === 'ramp' ? (s.group ?? undefined) : undefined,
  };
}

// Cached per host instance - repeat calls (export clicks, panel re-renders)
// reuse the same resolved palette instead of re-fetching tokens each time.
const cache = new WeakMap<object, Promise<readonly PaletteEntry[]>>();

/** Drop the memoised palette for `host` - a design-system switch (plans/186
 *  section 3.4) changes the answer under the same host object. */
export function bustLivePalette(host: object): void { cache.delete(host); }

/**
 * The active brand's palette (hex + CMYK), resolved from host.tokens.colors()
 * when available, else the tokenless PALETTE fallback. Never throws.
 */
export function livePalette(host: LivePaletteHost): Promise<readonly PaletteEntry[]> {
  let p = cache.get(host);
  if (!p) {
    p = (async () => {
      try {
        const swatches = await host.tokens?.colors?.() ?? [];
        if (swatches.length) return swatches.map(toPaletteEntry);
      } catch { /* IDB/tokens unavailable - keep the starter fallback */ }
      return PALETTE;
    })();
    cache.set(host, p);
  }
  return p;
}
