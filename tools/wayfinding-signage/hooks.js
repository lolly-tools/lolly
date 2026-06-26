/**
 * Wayfinding Signage — hooks.
 *
 * Computes what the logic-less template can't:
 *   • sign proportions + orientation from the chosen standard size,
 *   • the ink / muted / hairline contrast colours from the background,
 *   • each direction row: its arrow glyph (a SUSE-font character), which side
 *     the arrow sits, and a resolved accent colour, and
 *   • the default SUSE logo (auto light/dark) when no event logo is supplied.
 *
 * No imports, no globals beyond ECMAScript built-ins + the host bridge.
 */

// WCAG relative luminance of a #hex colour (0 = black, 1 = white).
function relLuminance(hex) {
  var s = String(hex || '#000000').replace('#', '');
  var h = s.length === 3 ? s.replace(/(.)/g, '$1$1') : (s + '000000').slice(0, 6);
  function lin(i) {
    var v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  }
  return 0.2126 * lin(0) + 0.7152 * lin(2) + 0.0722 * lin(4);
}
function isDark(hex) { return relLuminance(hex) < 0.5; }
// High-contrast ink for a given background — brand ink on light, white on dark.
function idealInk(hex) { return isDark(hex) ? '#ffffff' : '#0c322c'; }

// Standard large-format sign trim sizes (mm). Drives the aspect-ratio +
// orientation; the exact print size is set per-export.
var SIZES = {
  a4:        { w: 210,   h: 297,   label: 'A4 · 210 × 297 mm' },
  a3:        { w: 297,   h: 420,   label: 'A3 · 297 × 420 mm' },
  a2:        { w: 420,   h: 594,   label: 'A2 · 420 × 594 mm' },
  a1:        { w: 594,   h: 841,   label: 'A1 · 594 × 841 mm' },
  a3land:    { w: 420,   h: 297,   label: 'A3 landscape · 420 × 297 mm' },
  a2land:    { w: 594,   h: 420,   label: 'A2 landscape · 594 × 420 mm' },
  '18x24in': { w: 457.2, h: 609.6, label: '18 × 24 in · 457 × 610 mm' },
  '24x36in': { w: 609.6, h: 914.4, label: '24 × 36 in · 610 × 914 mm' }
};

// Arrow direction token → Unicode glyph. All eight are present in the SUSE font
// (basic arrows U+2190–2193, diagonals U+2196–2199), so they render on-brand.
var GLYPHS = {
  'up': '↑', 'up-right': '↗', 'right': '→', 'down-right': '↘',
  'down': '↓', 'down-left': '↙', 'left': '←', 'up-left': '↖'
};

function toInputs(model) {
  return Object.fromEntries(model.map(function (i) { return [i.id, i.value]; }));
}

async function compute(model) {
  var inputs = toInputs(model);
  var out = {};

  // Size → proportions + orientation + trim caption.
  var sz = SIZES[inputs.size] || SIZES.a3;
  out.aspW = sz.w;
  out.aspH = sz.h;
  out.orient = sz.w > sz.h ? 'landscape' : 'portrait';
  out.trimLabel = sz.label;

  // Colour scheme.
  var bg = (typeof inputs.background === 'string' && inputs.background) ? inputs.background : '#ffffff';
  var accent = (typeof inputs.accent === 'string' && inputs.accent.trim()) ? inputs.accent.trim() : '#30ba78';
  out.accent = accent;
  out.ink = idealInk(bg);
  out.muted = isDark(bg) ? 'rgba(255,255,255,0.66)' : 'rgba(12,50,44,0.60)';
  out.hairline = isDark(bg) ? 'rgba(255,255,255,0.16)' : 'rgba(12,50,44,0.12)';

  // Directions → rows. Keep a row if it has a label OR an image (a sponsor logo
  // can stand in for the text). Resolve glyph, side, per-row accent, the optional
  // image, and carry each row's ORIGINAL block index (bi) so a click on the
  // rendered row can focus the matching block in the editor (data-canvas-input).
  var dirs = Array.isArray(inputs.directions) ? inputs.directions : [];
  function rowImage(d) {
    return (d && d.image && typeof d.image === 'object' && typeof d.image.url === 'string') ? d.image : null;
  }
  out.directionsOut = dirs
    .map(function (d, i) { return { d: d, i: i }; })
    .filter(function (x) {
      var d = x.d;
      if (!d) return false;
      var hasLabel = typeof d.label === 'string' && d.label.trim();
      return hasLabel || rowImage(d);
    })
    .map(function (x) {
      var d = x.d;
      var key = (typeof d.arrow === 'string' && GLYPHS[d.arrow]) ? d.arrow : 'right';
      var c = (typeof d.color === 'string' && d.color.trim()) ? d.color.trim() : accent;
      var label = (typeof d.label === 'string') ? d.label.trim() : '';
      var img = rowImage(d);
      return {
        label: label,
        imageUrl: img ? img.url : '',
        // Alt text keeps the row meaningful to screen readers when it's a logo.
        imageAlt: label || (img && img.meta && img.meta.name) || 'Destination',
        glyph: GLYPHS[key],
        side: (d.side === 'right') ? 'right' : 'left',
        accent: c,
        bi: x.i
      };
    });

  // Default logo: when no event logo is chosen, use the SUSE horizontal logo,
  // reversed for dark backgrounds. A user-selected eventLogo resolves in-template.
  if (!inputs.eventLogo) {
    var id = 'suse/logo/hor-' + (isDark(bg) ? 'neg-white' : 'pos-green');
    try { out.defaultLogo = await host.assets.get(id); }
    catch (e) { if (host.log) host.log('warn', 'wayfinding-signage: logo not found', { id: id }); }
  }

  return out;
}

function onInit(ctx)  { return compute(ctx.model); }
function onInput(ctx) { return compute(ctx.model); }
