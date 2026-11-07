/**
 * Shared hook helpers - the design system's fonts for text a hook writes itself.
 *
 * CANONICAL SOURCE for the `brandFonts` region below. Tool hooks.js ship as
 * self-contained data (no imports), so each consumer carries a byte-for-byte
 * copy of the region between `lolly:shared` marker comments. Edit the region
 * HERE, then run `pnpm run sync:shared` to rewrite every consumer;
 * `pnpm run validate:catalog` fails if any consumer drifts.
 */

// === lolly:shared brandFonts - canonical source; edit here and run pnpm run sync:shared ===
// The design system's text face (font.brand) and mono face (font.mono) as
// font-family lists, for an SVG attribute, an inline style or a canvas font.
// A tool never names a face of its own. A headless SVG has no stylesheet, so
// the CLI, the TUI and the MCP server read the attribute to outline the text,
// and the page draws the same family. A design system that declares no such
// face gets the shell's own default, SUSE or SUSE Mono, as --font-brand and
// --font-mono do. Family names pass the shell's brand-vars.ts rule; a name
// with a space or a digit is quoted.
var BF_FAMILY = /^[A-Za-z0-9][A-Za-z0-9 _-]{0,63}$/;
var BF_GENERIC = /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-(sans-serif|serif|monospace|rounded)|emoji|math|fangsong)$/i;
function bfFamilyList(value, fallback, generic) {
  var names = [];
  var list = Array.isArray(value) ? value : (typeof value === 'string' && value.charAt(0) !== '{' ? value.split(',') : []);
  for (var i = 0; i < list.length; i++) {
    var n = String(list[i]).trim().replace(/^['"]+|['"]+$/g, '').trim();
    if (!BF_FAMILY.test(n) || BF_GENERIC.test(n)) continue;
    var dup = false;
    for (var j = 0; j < names.length; j++) if (names[j].toLowerCase() === n.toLowerCase()) dup = true;
    if (!dup) names.push(n);
  }
  if (!names.length) names.push(fallback);
  return names.map(function (f) { return /^[A-Za-z_-][A-Za-z0-9_-]*$/.test(f) ? f : "'" + f + "'"; }).join(', ') + ', ' + generic;
}
async function brandFonts(host) {
  var out = { brand: bfFamilyList(null, 'SUSE', 'sans-serif'), mono: bfFamilyList(null, 'SUSE Mono', 'monospace') };
  if (!host || !host.tokens || !host.tokens.resolve) return out;
  try { out.brand = bfFamilyList(await host.tokens.resolve('{font.brand}'), 'SUSE', 'sans-serif'); } catch (e) { /* the shell's default face stands */ }
  try { out.mono = bfFamilyList(await host.tokens.resolve('{font.mono}'), 'SUSE Mono', 'monospace'); } catch (e) { /* the shell's default face stands */ }
  return out;
}
// === /lolly:shared brandFonts ===
