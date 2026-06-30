/**
 * Web Icon Maker hooks.
 *
 * The whole challenge of a favicon label is legibility once the icon is scaled
 * down to a 16 px browser tab. So the label is AUTO-FITTED: we estimate the
 * rendered width of the (upper-cased) text, then pick the largest font size that
 * fills the tile without spilling out — taking letter-spacing into account.
 * The label is set in SUSE Mono, so every glyph shares one advance width and the
 * estimate is just a per-character constant. Pure arithmetic, no DOM, so it
 * produces the same result in the web shell and the headless CLI.
 *
 * Returns extras only (labelSize / trackingEm / tileBg) — none collide with a
 * declared input id, so nothing is clobbered.
 */

// SUSE Mono is monospaced: every cap / digit / symbol occupies the same advance
// (~0.6 em). Slightly overestimated so the fitted label keeps off the edges.
var MONO_ADV = 0.62;

function advance() { return MONO_ADV; }

function toArgs(model) {
  var o = {};
  model.forEach(function (i) { o[i.id] = i.value; });
  return o;
}

function compute(a) {
  var text = (a.text == null ? '' : String(a.text)).toUpperCase();
  var hasArt = !!(a.image && typeof a.image === 'object' && a.image.url);

  var trackingNum = isFinite(Number(a.tracking)) ? Number(a.tracking) : -4;
  var trackingEm = trackingNum / 100;

  // Total advance of the line in em (glyphs + the gaps between them). Monospace,
  // so weight doesn't change the advance — every glyph is MONO_ADV wide.
  var n = text.length;
  var totalEm = 0;
  for (var i = 0; i < n; i++) totalEm += advance(text[i]);
  if (n > 1) totalEm += trackingEm * (n - 1);
  if (totalEm < 0.2) totalEm = 0.2; // guard divide-by-~zero for empty/odd input

  // Fill this fraction of the tile width; cap the height so a 1–2 char label
  // doesn't tower. The band is shorter when an image sits above the label.
  var targetW = hasArt ? 84 : 90;
  var heightCap = hasArt ? 30 : 64;
  var size = Math.min(targetW / totalEm, heightCap);

  var scale = isFinite(Number(a.labelScale)) ? Number(a.labelScale) : 100;
  size = size * scale / 100;
  if (size < 6) size = 6;
  if (size > 130) size = 130;

  // transparentBg toggle (injected by the engine) → see-through tile fill, for a
  // glyph/letter-only icon. Otherwise the chosen background colour.
  var tileBg = a.transparentBg ? 'transparent' : (a.background || '#0c322c');

  return {
    labelSize: Math.round(size * 10) / 10,
    trackingEm: trackingEm,
    tileBg: tileBg
  };
}

function onInit(ctx)  { return compute(toArgs(ctx.model)); }
function onInput(ctx) { return compute(toArgs(ctx.model)); }

function beforeExport(ctx) {
  // A favicon should be transparent OUTSIDE its shape so a rounded / circular
  // icon never rides on a white box in the browser tab. Force an alpha background
  // for the raster favicon formats; the tile's own fill is painted by the
  // template, so only the corners outside the shape go transparent.
  var alpha = ['png', 'ico', 'webp', 'avif'];
  if (alpha.indexOf(ctx.format) !== -1) ctx.opts.background = 'transparent';
}
