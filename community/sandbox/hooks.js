/* global host */
/**
 * Run Web Code hooks.
 *
 * ONE job: before the shell captures the export, re-render the live preview at the
 * CHOSEN export dimensions - so a viewport-driven pen (a WebGL canvas sized to
 * window.innerWidth, a 100vh layout, …) exports at the export size rather than the
 * small on-screen preview size. Nobody on a small screen should be capped to a small
 * export of their running code.
 *
 * The runtime AWAITS beforeExport before it rasterises, which is the seam we need.
 * The actual work lives in the template's IIFE (it owns the preview iframe + the
 * export-mirror snapshot); this hook runs in the same realm, finds the tool root, and
 * drives the bridges it exposes: `__rwcFlush` lands any pending pane commits so the
 * synced model matches exactly what we export (keeping a collaborator's model in step
 * with the exported snapshot), then `__rwcExportRender` re-renders the mirror at the
 * chosen size. Gallery THUMBNAILS (opts.thumbnail) skip only the resize - a small tile
 * doesn't need it, and skipping it keeps saving flicker-free.
 */
async function beforeExport(ctx) {
  try {
    var opts = (ctx && ctx.opts) || {};
    if (typeof document === 'undefined') return; // non-DOM shell (CLI) - nothing to re-render
    var root = document.querySelector('[data-rwc]');
    if (!root) return;
    if (typeof root.__rwcFlush === 'function') { try { root.__rwcFlush(); } catch (_) { /* ignore */ } }
    if (opts.thumbnail) return;                 // gallery tile - leave the preview-size snapshot
    if (typeof root.__rwcExportRender !== 'function') return;
    var w = parseFloat(opts.width), h = parseFloat(opts.height);
    await root.__rwcExportRender(w > 0 ? w : 0, h > 0 ? h : 0);
  } catch (e) {
    // Never block the export: on any failure fall back to the last preview-size snapshot.
  }
}

// The design system's text faces as files the preview frame can be handed. The frame is
// opaque, so it cannot load the app's fonts, and the template can only find a face that
// a stylesheet declares. A font uploaded to the brand is registered by script, with no
// stylesheet rule, so without this list the preview fell back while the export (which
// reads the faces through host.text) drew the uploaded font.
async function onInit() {
  return { rwcFaces: JSON.stringify(await brandFaceFiles(host)) };
}

var FACE_WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900];
// Each file is handed over once, with the range of weights the app's lookup answers
// with that file, for each slant. The frame then picks the same file for a weight that
// the export does: a family with 400 and 700 files covers 100 to 500 with the first and
// 600 to 900 with the second, so a `font-weight: 500` heading previews in the 400 file
// as it exports. A slant the family has no file for is left out (the lookup gives none,
// or gives the upright file), and the frame makes its own.
async function brandFaceFiles(host) {
  if (!host || !host.text || typeof host.text.fontUrl !== 'function') return [];
  var fonts = await brandFonts(host);
  var out = [];
  var families = fonts.brand.split(',').map(function (f) { return f.trim().replace(/^['"]+|['"]+$/g, ''); })
    .filter(function (f) { return f && !BF_GENERIC.test(f); });
  for (var i = 0; i < families.length && out.length < 12; i++) {
    var upright = {};
    for (var s = 0; s < 2; s++) {
      var italic = s === 1, files = [], byUrl = {};
      for (var w = 0; w < FACE_WEIGHTS.length; w++) {
        var face = null;
        try { face = await host.text.fontUrl(families[i], { weight: FACE_WEIGHTS[w], italic: italic }); } catch (e) { face = null; }
        if (!face || !face.url || (italic && upright[face.url])) continue;
        var file = byUrl[face.url];
        if (!file) { file = byUrl[face.url] = { url: face.url, lo: FACE_WEIGHTS[w], hi: FACE_WEIGHTS[w] }; files.push(file); }
        file.hi = FACE_WEIGHTS[w];
      }
      for (var k = 0; k < files.length; k++) {
        if (!italic) upright[files[k].url] = true;
        out.push({ family: families[i], url: files[k].url, weight: files[k].lo === files[k].hi ? String(files[k].lo) : files[k].lo + ' ' + files[k].hi, style: italic ? 'italic' : 'normal' });
      }
    }
  }
  return out;
}

// === lolly:shared brandFonts - generated from community/_shared/brand-fonts.js; edit there and run npm run sync:shared ===
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
