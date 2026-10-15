// SPDX-License-Identifier: MPL-2.0
/**
 * The one explanation scripts/check-house-rules.ts prints when it fails, so a
 * person who has never met the check can tell quickly what was flagged and why.
 * Written like vernacular-why.ts: plain, short and the first thing a sceptic reads.
 */

export const HOUSE_RULES_WHY = `
Why this check exists
  Lolly's chrome follows a few written design rules. They kept coming back
  after every fix because nothing enforced them, so a machine keeps them now.
  This reads the shell's own CSS (shells/web/src, the <style> blocks in
  shells/web/index.html and the CSS literals in docs/build.ts). It does not
  check a brand's Design documents.

What each rule means
  H1  A rounded element gets a full border, a full wash or padding. A stripe
      on one edge of a rounded box breaks where it meets the curve. Square
      segment dividers and the --bevel highlight are fine.
  H2  Dashed means "drop here" and nothing else. Use a solid hairline, a muted
      fill or a state glyph for empty, busy, missing and mixed states. A real
      drop area goes in scripts/data/house-rules-allow.json with its reason.
  H4  Durations come from --dur-*, --ui-motion-* or --ease-* so motion can be
      tuned in one place.
  H5  Anything that moves needs both switches: the operating system's
      prefers-reduced-motion and the app's html[data-a11y-motion="reduce"].
  H6  A custom property nobody defines resolves to nothing. Define the
      property, use a defined one or give var() a fallback.

Why it is a ratchet
  The tree started with debt, so scripts/house-rules-baseline.json records a
  count per file and rule that may only go down. A new file or rule must be
  clean. A count that falls must be recorded, so the baseline always states
  the real floor.

How to pass
  Fix the finding. For a reviewed improvement run
  node scripts/check-house-rules.ts --write (it refuses to record a rise).
  Never raise a count to pass. node scripts/check-house-rules.ts --list
  prints every finding, and --rule=H2 or --file=<path> narrows the list.
`.trimEnd();

/** Print the explanation once, after the per-finding lines. */
export function printHouseRulesWhy(): void {
  console.error(HOUSE_RULES_WHY);
}
