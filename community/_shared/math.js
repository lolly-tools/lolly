/**
 * Shared hook helpers - numeric + colour-string utilities.
 *
 * CANONICAL SOURCE for the `clamp` and `safeColor` regions below. Tool
 * hooks.js ship as self-contained data (no imports), so each consumer carries
 * a byte-for-byte copy of each region between `lolly:shared` marker comments.
 * Edit the regions HERE, then run `npm run sync:shared` to rewrite every
 * consumer; `npm run validate:catalog` fails if any consumer drifts.
 */

// === lolly:shared clamp - canonical source; edit here and run npm run sync:shared ===
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
// === /lolly:shared clamp ===

// === lolly:shared safeColor - canonical source; edit here and run npm run sync:shared ===
function safeColor(v, fallback) {
  var s = String(v == null ? '' : v).trim();
  if (!s) return fallback;
  if (/^#[0-9a-fA-F]{3,8}$/.test(s)) return s;
  if (/^(rgb|rgba|hsl|hsla)\([0-9.,%\s/]+\)$/i.test(s)) return s;
  if (/^[a-zA-Z]+$/.test(s)) return s; // named colour (e.g. "transparent", "tomato")
  // A brand-token CSS var with an OPTIONAL literal-colour fallback - the documented
  // brand-inheritance path (brand-vars.ts injects --brand-primary/… onto the canvas root,
  // so a template can carry var(--brand-primary, #hex)). Strict on purpose: a var name and
  // at most one hex / named / rgb / hsl fallback, so nothing (no ; " ' < > { } or a nested
  // function) can break out of the style="…" property this value is interpolated into.
  if (/^var\(\s*--[a-zA-Z0-9-]+\s*(,\s*(#[0-9a-fA-F]{3,8}|[a-zA-Z]+|(?:rgb|rgba|hsl|hsla)\([0-9.,%\s/]+\)))?\s*\)$/.test(s)) return s;
  return fallback;
}
// === /lolly:shared safeColor ===
