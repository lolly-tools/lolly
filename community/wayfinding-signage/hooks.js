/**
 * Wayfinding Signage - hooks.
 *
 * Computes what the logic-less template can't:
 *   • sign proportions + orientation from the chosen standard size,
 *   • the ink / muted / hairline contrast colours from the background,
 *   • each direction row: its arrow glyph (a Unicode character), which side
 *     the arrow sits, and a resolved accent colour.
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
// High-contrast ink for a given background - brand ink on light, white on dark.
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

// Arrow direction token → Unicode glyph. All eight are present in the brand font
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
  // The accent is NOT returned as `accent`: that is the input's own id, and writing
  // it would replace the input's design-system link with a fixed colour, so a theme
  // or colourway switch would leave the accent behind. The template reads the input
  // itself, with the same fallback; `accent` here is only each row's default.
  var accent = (typeof inputs.accent === 'string' && inputs.accent.trim()) ? inputs.accent.trim() : '#30ba78';
  out.ink = idealInk(bg);
  out.muted = isDark(bg) ? 'rgba(255,255,255,0.66)' : 'rgba(12,50,44,0.60)';
  out.hairline = isDark(bg) ? 'rgba(255,255,255,0.16)' : 'rgba(12,50,44,0.12)';
  // Ink/muted/hairline stay keyed to the chosen background colour (for contrast)
  // even when transparentBg wins the actual paint below.
  out.bgStyle = (inputs.transparentBg === true) ? 'transparent' : bg;

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

  // Header (logo + event name) collapses entirely when both are empty, so the
  // default state isn't left with a gap where the logo would be. No logo is shown
  // unless the user supplies one - there is no brand-logo fallback.
  var hasEventName = typeof inputs.eventName === 'string' && inputs.eventName.trim();
  out.hasHeader = Boolean(inputs.eventLogo) || Boolean(hasEventName);

  return out;
}

function onInit(ctx)  { return surfaceRender(ctx.model); }
function onInput(ctx) { return surfaceRender(ctx.model); }

async function surfaceRender(model) {
  var values = toInputs(model);
  var palette = await toolSurface(values);
  var inputs = Object.assign({}, values, { background: palette.surfacePaper, accent: palette.surfaceAccent });
  var effective = model.map(function (i) { return Object.assign({}, i, { value: inputs[i.id] }); });
  return Object.assign(await compute(effective), palette);
}

// === lolly:shared tool-surface - generated from community/_shared/tool-surface.js; edit there and run pnpm run sync:shared ===
function surfaceHex(value, fallback) {
  if (value && typeof value === 'object' && Array.isArray(value.components)) {
    var space = value.colorSpace || 'srgb';
    if (space === 'srgb' && value.components.length === 3 && value.components.every(Number.isFinite)) {
      value = '#' + value.components.map(function (n) { return Math.round(Math.max(0, Math.min(1, n)) * 255).toString(16).padStart(2, '0'); }).join('');
    } else value = 'color(' + space + ' ' + value.components.join(' ') + ')';
  }
  if (host.color && typeof host.color.mix === 'function') {
    try {
      var normalized = host.color.mix(String(value), String(value), 0);
      if (normalized && /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(normalized)) return normalized.slice(0, 7);
    } catch (_) { /* Try the plain hex form below. */ }
  }
  var match = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(String(value || '').trim());
  if (!match) return fallback;
  var hex = match[1];
  if (hex.length === 3) hex = hex.split('').map(function (c) { return c + c; }).join('');
  return '#' + hex.slice(0, 6).toLowerCase();
}

function surfaceMix(a, b, amount) {
  if (host.color && typeof host.color.mix === 'function') {
    try { return surfaceHex(host.color.mix(a, b, amount), a); } catch (_) { /* Use sRGB below. */ }
  }
  return '#' + [1, 3, 5].map(function (at) {
    var first = parseInt(a.slice(at, at + 2), 16);
    var last = parseInt(b.slice(at, at + 2), 16);
    return Math.round(first + (last - first) * amount).toString(16).padStart(2, '0');
  }).join('');
}

function surfaceContrast(a, b) {
  function luminance(hex) {
    var channels = [1, 3, 5].map(function (at) {
      var c = parseInt(hex.slice(at, at + 2), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  }
  var x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

function surfaceReadable(preferred, ground, alternatives) {
  if (surfaceContrast(preferred, ground) >= 4.5) return preferred;
  var choices = alternatives.concat(['#111111', '#ffffff']);
  return choices.reduce(function (best, colour) {
    return surfaceContrast(colour, ground) > surfaceContrast(best, ground) ? colour : best;
  }, preferred);
}

async function toolSurface(values, aliases) {
  aliases = aliases || {};
  async function readToken(path) {
    try {
      if (host.tokens && typeof host.tokens.resolve === 'function') {
        return await host.tokens.resolve('{' + path + '}');
      }
      if (host.tokens && typeof host.tokens.get === 'function') {
        var set = await host.tokens.get();
        if (set && typeof set.resolve === 'function') return set.resolve('{' + path + '}');
      }
    } catch (_) { /* A tool without a design system still draws. */ }
    return null;
  }
  var colours = await Promise.all([
    readToken('color.semantic.primary'), readToken('color.semantic.on-primary'),
    readToken('color.semantic.surface'), readToken('color.semantic.text'),
  ]);
  colours = colours.map(function (c, i) { return surfaceHex(c, ['#2563eb', '#ffffff', '#f6f7f9', '#17232b'][i]); });
  var primary = surfaceHex(values[aliases.accent || 'accent'], colours[0]);
  var paper = surfaceHex(values[aliases.background || 'background'], colours[2]);
  var text = surfaceHex(values[aliases.ink || 'ink'], colours[3]);
  var ground = values.ground || 'tint';
  var fill = ground === 'lead' ? primary : ground === 'ink' ? text
    : ground === 'surface' ? paper : surfaceMix(paper, primary, 0.1);
  var ink = ground === 'lead' ? colours[1] : ground === 'ink' ? paper : text;
  ink = surfaceReadable(ink, fill, [text, paper, colours[1]]);
  var accent = primary;
  for (var amount = 0.1; surfaceContrast(accent, fill) < 4.5 && amount <= 1.01; amount += 0.1) {
    accent = surfaceMix(primary, ink, Math.min(1, amount));
  }
  var onAccent = surfaceReadable(colours[1], accent, [fill, text, paper]);
  var density = values.density || 'auto';
  var chars = JSON.stringify(['body', 'heading', 'subheading', 'quote', 'criteria', 'events', 'data',
    'directions', 'blocks', 'content', 'company', 'firstname', 'lastname', 'description', 'title']
    .map(function (key) { return values[key]; })).length;
  var spacing = density === 'compact' ? 0.78 : density === 'spacious' ? 1.16
    : density === 'comfortable' ? 1 : chars > 4500 ? 0.78 : chars > 2400 ? 0.9 : 1;
  var timing = await readToken('motion.duration.long');
  var ms = 700;
  if (typeof timing === 'number' && Number.isFinite(timing)) ms = timing;
  else if (timing && typeof timing === 'object' && typeof timing.value === 'number') {
    ms = timing.value * (timing.unit === 's' ? 1000 : 1);
  } else if (typeof timing === 'string') {
    var match = /^(\d+(?:\.\d+)?)(ms|s)$/.exec(timing.trim());
    if (match) ms = Number(match[1]) * (match[2] === 's' ? 1000 : 1);
  }
  var curve = await readToken('motion.curve.emphasised');
  if (!Array.isArray(curve) || curve.length !== 4 || !curve.every(Number.isFinite)
      || curve[0] < 0 || curve[0] > 1 || curve[2] < 0 || curve[2] > 1) curve = [0.2, 0, 0, 1];
  return {
    surfaceGround: values.transparentBg === true || values.transparentBg === 'true' ? 'transparent' : fill,
    surfacePaper: fill,
    surfaceInk: ink,
    surfaceAccent: accent,
    surfaceOnAccent: onAccent,
    surfaceMuted: surfaceMix(ink, fill, 0.22),
    surfaceEdge: surfaceMix(fill, ink, 0.2),
    surfacePanel: surfaceMix(fill, ink, 0.045),
    surfaceTint: surfaceMix(fill, accent, 0.12),
    surfaceSpacing: String(spacing),
    surfaceEnterSeconds: String(Math.max(0, Math.min(3000, ms)) / 1000),
    surfaceCurve: curve.join(','),
  };
}
// === /lolly:shared tool-surface ===
