/* global host */
/**
 * Backdrop hooks.
 *
 * The tool combines curated Paper Shaders fragments (lib/paper-shaders.min.js,
 * Apache-2.0 - see lib/LICENSE) and three original MilkDrop-inspired fields:
 * sixteen generative GPU fields driven by the design system's swatches. Hooks only
 * validate/normalise the inputs and emit the host element + its config as a
 * data attribute; the template script owns the WebGL2 mount, the live loop
 * and the deterministic export frame clock (__lollyFrameRender). The host
 * div's inline CSS gradient is the no-WebGL2 fallback (and what the CLI's
 * jsdom render shows, since it never loads the lib): the colours still read
 * as a backdrop when the shader can't run.
 */

var EFFECTS = ['metaballs', 'smoke-ring', 'voronoi', 'neuro-noise', 'perlin-noise', 'dithering',
  'warp', 'spiral', 'swirl', 'silk-flow', 'prism-bloom', 'liquid-contours', 'dot-orbit', 'god-rays', 'color-panels', 'pulsing-border'];

// Brand-agnostic fallbacks for unresolved token aliases ('' after flattening).
var FALLBACK = ['#6d5bd8', '#e0679f', '#2fb6a3', '#f2a65a', '#5b8def', '#e0679f'];

function _num(v, d) { var n = Number(v); return Number.isFinite(n) ? n : d; }
function _clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }

// Values land in an inline style attribute and a JSON data attribute, so only
// strict hex survives (expanding #rgb); anything else takes the fallback.
function _hex6(v, fb) {
  v = (v == null ? '' : String(v)).trim().toLowerCase();
  var m3 = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(v);
  if (m3) return '#' + m3[1] + m3[1] + m3[2] + m3[2] + m3[3] + m3[3];
  return /^#[0-9a-f]{6}$/.test(v) ? v : fb;
}

var _memoKey = null;
var _memoResult = null;

function compute(model) {
  var a = Object.fromEntries(model.map(function (i) { return [i.id, i.value]; }));
  var effect = EFFECTS.indexOf(a.effect) >= 0 ? a.effect : 'metaballs';
  var count = _clamp(Math.round(_num(a.count, 4)), 1, 6);
  var colors = [];
  for (var i = 0; i < count; i++) colors.push(_hex6(a['color' + (i + 1)], FALLBACK[i]));
  var background = _hex6(a.background, '#0b1021');
  var cfg = JSON.stringify({
    effect: effect,
    colors: colors,
    background: background,
    brandInfluence: ['off', 'subtle', 'strong', 'full'].indexOf(a.brandInfluence) >= 0 ? a.brandInfluence : 'strong',
    intensity: _clamp(_num(a.intensity, 50), 0, 100),
    density: _clamp(_num(a.density, 50), 0, 100),
    scale: _clamp(_num(a.scale, 100), 25, 400),
    rotation: _clamp(_num(a.rotation, 0), 0, 360),
    speed: _clamp(_num(a.speed, 100), 0, 300),
    phase: _clamp(_num(a.phase, 0), 0, 100),
  });

  var key = cfg;
  if (key === _memoKey) return _memoResult;

  // Fallback wash: the swatches as soft radial pools over the background - an
  // honest stand-in wherever the shader can't mount.
  var pools = colors.map(function (c, idx) {
    var x = 18 + (idx * 137.508) % 64;
    var y = 16 + (idx * 71) % 68;
    return 'radial-gradient(circle at ' + x.toFixed(0) + '% ' + y.toFixed(0) + '%,' + c + ' 0%,transparent 55%)';
  });
  var bg = pools.join(',') + ',linear-gradient(' + background + ',' + background + ')';

  _memoKey = key;
  // The wash lives on an inner layer at z-index -2 (styles.css), BELOW the
  // ShaderMount canvas: Paper Shaders styles its canvas z-index -1 inside the
  // isolated host, i.e. BEHIND the host's own background - a background on
  // .bd-host itself would paint over the shader.
  _memoResult = {
    svgContent: '<div class="bd-host" data-bd=\'' + cfg + '\'>'
      + '<div class="bd-wash" style="background:' + bg + '"></div></div>',
  };
  return _memoResult;
}

function onInit(ctx) { return compute(ctx.model); }
function onInput(ctx) { return compute(ctx.model); }
