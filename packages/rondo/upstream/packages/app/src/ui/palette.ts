/* ------------------------------------------------------------------------- *
 * The UI palette — SINGLE source of truth for every shared color.
 *
 * Three consumers, one origin:
 * - main.ts calls applyPalette() on boot, writing each entry as a :root CSS
 *   custom property, so style.css styles with var(--c-*) and never repeats
 *   a hex.
 * - theme.ts (CodeMirror theme) imports the consts directly — CM themes are
 *   JS-built style sheets, so vars would work there too, but consts keep the
 *   theme usable standalone (tests, SSR-ish tooling) without a DOM boot step.
 * - viz.ts paints canvases with the consts (canvas 2D has no var() access).
 *
 * One-off colors that exist in exactly one place (syntax highlight hues,
 * the error-strip reds, flash rgba ramps) stay where they are used — this
 * file is for colors with more than one consumer, not a registry of every
 * shade in the app.
 * ------------------------------------------------------------------------- */

/* Oscilloscope Lab palette — the UI reads like looking through scope glass:
 * a green-cast black, faint graticule lines, a phosphor-mint trace with a cyan
 * tip, and amber as the second (warning) channel. Cool green-tinted text, not
 * neutral gray — everything is "on the display". */
import { lolly } from '../lolly/host'

/* Lolly: the utility hands over a table derived from the active design system
 * (same entries, contrast-checked, light or dark as the app is). Upstream's hex
 * is the fallback. The table changes while the editor is open (the app's theme
 * switch, its design system), so inside Lolly each constant is a var(--c-*)
 * reference and the hex lives only in the custom properties, which the boot
 * script rewrites: everything that styles with them, CodeMirror's theme
 * included, repaints. With no host the constants are upstream's hex. */
const L: Readonly<Record<string, string>> = lolly?.palette ?? {}
const HEX: Record<string, string> = {}
const live = (name: string, hex: string): string => {
  HEX[name] = hex
  return lolly ? `var(${name})` : hex
}

export const C_BG = live('--c-bg', L.bg ?? '#050807') // scope glass — near-black with a faint green cast
export const C_BAR = live('--c-bar', L.bar ?? '#0a100e') // header / viz panel bezel
export const C_SURFACE = live('--c-surface', L.surface ?? '#0e1512') // inputs, selects
export const C_RAISED = live('--c-raised', L.raised ?? '#14201b') // buttons, meter tracks, tooltips
export const C_BORDER = live('--c-border', L.border ?? '#1e352c') // hairline control borders (green-cast)
export const C_TEXT = live('--c-text', L.text ?? '#c8e6da') // cool phosphor-white
export const C_DIM = live('--c-dim', L.dim ?? '#6f9284') // secondary text
export const C_FAINT = live('--c-faint', L.faint ?? '#3c5249') // gutter numbers, graticule-adjacent
export const C_ACCENT = live('--c-accent', L.accent ?? '#6ee7b7') // phosphor mint — the primary trace/accent
export const C_ACCENT_ALT = live('--c-accent-alt', L.accentAlt ?? '#67e8f9') // cyan trace-tip (meter/scope gradient)
export const C_GREEN = live('--c-green', L.green ?? '#155e45') // run-button / selection phosphor
export const C_GREEN_DEEP = live('--c-green-deep', L.greenDeep ?? '#0b2c20')
export const C_WARN = live('--c-warn', L.warn ?? '#f2b155') // amber channel
/** RESTS. Their own channel because amber already carries both the numbers
 *  and the grouping characters, so in `[~ -7!7]` the one thing you scan a
 *  pattern for — where the holes are — was the same colour as everything
 *  around it. Violet is the gap in a palette that is otherwise green, cyan
 *  and amber. */
export const C_REST = live('--c-rest', L.rest ?? '#c39bf5')
export const C_ERROR = live('--c-error', L.error ?? '#ff6b6b')
export const C_ERROR_BG = live('--c-error-bg', L.errorBg ?? '#170c0a') // error surfaces (status strip, boot error)
export const C_ERROR_BORDER = live('--c-error-border', L.errorBorder ?? '#3a1e18')
/** Faint graticule grid line color (the scope's measurement grid). */
export const C_GRID = live('--c-grid', L.grid ?? '#12241d')
/** Lolly: three syntax hues and two inks that upstream writes as literals in
 *  editor/theme.ts and style.css, gathered here so they follow the table too. */
export const C_KEYWORD = live('--c-keyword', L.keyword ?? '#a7f3d0')
export const C_PROPERTY = live('--c-property', L.property ?? '#5ec8b0')
export const C_MAGENTA = live('--c-magenta', L.magenta ?? '#f7a8ff')
export const C_ON_GREEN = live('--c-on-green', L.onGreen ?? '#d7fff0')
export const C_ON_ACCENT = live('--c-on-accent', L.onAccent ?? '#04120c')

export const CSS_VARS: Readonly<Record<string, string>> = HEX

/** Write the palette as CSS custom properties (call once on boot, before
 *  anything renders — style.css consumes these with no fallbacks). */
export const applyPalette = (root: HTMLElement = document.documentElement): void => {
  for (const [name, hex] of Object.entries(CSS_VARS)) root.style.setProperty(name, hex)
}
