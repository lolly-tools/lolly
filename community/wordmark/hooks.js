/**
 * Wordmark - type a word, get a pure-path vector wordmark.
 *
 * The whole render is host.* data: host.tokens names the brand's font family
 * ({font.brand} / {font.mono}), host.text.fontUrl (v1.60) resolves that family
 * to an actual font file (plus the variable-axis settings for the requested
 * weight), and host.text.toPath (HarfBuzz) shapes the run into one SVG <path>.
 * The preview IS the export - true outlines, so SVG/PDF/EMF/EPS/DXF need no
 * font installed to view, and the same code renders headlessly in the CLI/TUI
 * (the Node shell implements both methods over the catalog font files).
 *
 * When either method is missing (older host) or the resolved font lacks a
 * glyph for some character (toPath's notdef count), outlining would draw tofu -
 * so we fall back to a live <text> element and say why in `wmWarning` instead
 * of silently exporting blanks.
 */

// The platform face - every shell can resolve it (web: font-registry's PLATFORM_FACES;
// CLI/TUI: the node shell scans shells/web/public/fonts). 'Outfit' until 2026-08-10;
// SUSE is the default now AND has a real italic, which Outfit never did.
var FALLBACK_FAMILY = 'SUSE';

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function fmt(n) { return Math.round(n * 100) / 100; }

function num(v, dflt) { var n = Number(v); return Number.isFinite(n) ? n : dflt; }

// HarfBuzz applies kern + standard ligatures by default, so "Standard" passes
// nothing; the toggles map to the classic OpenType tags.
function featuresFor(sel) {
  if (sel === 'liga-off') return ['liga=0', 'clig=0'];
  if (sel === 'salt') return ['salt=1'];
  return undefined;
}

// {font.brand} / {font.mono} → family name. Unresolvable (blank brand, host
// without tokens) falls back to the platform face rather than failing.
async function familyFor(host, kind) {
  var ref = kind === 'mono' ? '{font.mono}' : '{font.brand}';
  try {
    if (host && host.tokens && host.tokens.resolve) {
      var fam = await host.tokens.resolve(ref);
      if (typeof fam === 'string' && fam && fam.indexOf('{') !== 0) return fam;
    }
  } catch (e) { /* keep the fallback */ }
  return FALLBACK_FAMILY;
}

// Honest fallback: a live <text> run (needs the font at view time). Width is a
// rough estimate - the preview stays usable and wmWarning explains what happened.
function textSvg(text, family, weight, size, tracking, color) {
  var w = Math.max(size * 2, text.length * (size * 0.62 + Math.max(0, tracking)));
  var h = size * 1.5;
  return '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ' + fmt(w) + ' ' + fmt(h) + '" role="img" aria-label="' + esc(text) + '">'
    + '<text x="' + fmt(w / 2) + '" y="' + fmt(size * 1.08) + '" text-anchor="middle"'
    + ' font-family="' + esc(family) + '" font-size="' + fmt(size) + '" font-weight="' + weight + '"'
    + ' letter-spacing="' + fmt(tracking) + '" fill="' + esc(color) + '">' + esc(text) + '</text></svg>';
}

// One-entry memo: shaping is cheap but not free, and an unchanged input (a
// re-render that didn't touch any field) should return the same SVG untouched.
var _memoKey = null;
var _memoResult = null;

async function compute(host, args) {
  var key = JSON.stringify(args);
  if (key === _memoKey) return _memoResult;

  // Hard cap (manifest maxLength mirror): URL mode / headless renders bypass the
  // input UI, and the output viewBox scales with text length × size - unbounded
  // text would mint an arbitrarily huge SVG for downstream rasterisers.
  var text = (typeof args.text === 'string' && args.text.trim()) ? args.text.trim().slice(0, 120) : 'Wordmark';
  var size = Math.min(1000, Math.max(8, num(args.size, 160)));
  var tracking = Math.max(-size / 4, Math.min(size, num(args.tracking, 0)));
  var weight = Math.min(900, Math.max(100, Math.round(num(args.weight, 600) / 100) * 100));
  var color = (typeof args.color === 'string' && args.color) ? args.color : '#111111';
  var features = featuresFor(args.features);

  var family = await familyFor(host, args.font);
  var result;
  try {
    if (!host || !host.text || !host.text.fontUrl || !host.text.toPath) {
      throw new Error('this host cannot resolve fonts (host.text.fontUrl unavailable)');
    }
    var f = await host.text.fontUrl(family, { weight: weight });
    if (!f || !f.url) throw new Error('no font file found for "' + family + '"');
    var run = await host.text.toPath({
      text: text,
      fontUrl: f.url,
      fontSize: size,
      letterSpacing: tracking,
      variations: f.variations,
      features: features,
    });
    if (!run || !run.bbox || !run.d) throw new Error('nothing to outline');
    if (run.notdef > 0) {
      // The font has no glyph for some characters - an outline would be tofu.
      result = {
        svgContent: textSvg(text, family, weight, size, tracking, color),
        wmWarning: run.notdef + ' character' + (run.notdef === 1 ? '' : 's') + ' missing from ' + family
          + ' - showing live text instead of outlines, so exports need the font installed.',
      };
    } else {
      var pad = size * 0.12;
      var b = run.bbox;
      result = {
        svgContent: '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="'
          + fmt(b.x1 - pad) + ' ' + fmt(b.y1 - pad) + ' ' + fmt((b.x2 - b.x1) + pad * 2) + ' ' + fmt((b.y2 - b.y1) + pad * 2)
          + '" role="img" aria-label="' + esc(text) + '">'
          + '<path fill="' + esc(color) + '" d="' + run.d + '"/></svg>',
        wmWarning: '',
      };
    }
  } catch (err) {
    result = {
      svgContent: textSvg(text, family, weight, size, tracking, color),
      wmWarning: 'Could not outline "' + family + '" (' + ((err && err.message) || 'unknown error')
        + ') - showing live text, so exports need the font installed.',
    };
  }

  _memoKey = key;
  _memoResult = result;
  return result;
}

function values(model) {
  return Object.fromEntries(model.map(function (i) { return [i.id, i.value]; }));
}

async function onInit(ctx) { return compute(ctx.host, values(ctx.model)); }
async function onInput(ctx) { return compute(ctx.host, values(ctx.model)); }
