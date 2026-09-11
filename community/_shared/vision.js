/**
 * Shared hook helpers - colour-vision simulation + WCAG level naming.
 *
 * CANONICAL SOURCE for the `cvd` region below. Tool hooks.js ship as
 * self-contained data (no imports), so each consumer carries a byte-for-byte
 * copy of the region between `lolly:shared` marker comments. Edit the region
 * HERE, then run `npm run sync:shared` to rewrite every consumer;
 * `npm run validate:catalog` fails if any consumer drifts.
 *
 * Consumers: community/contrast-check, community/color-palette.
 */

// === lolly:shared cvd - canonical source; edit here and run npm run sync:shared ===
// Colour-vision-deficiency simulation - Machado, Oliveira & Fernandes (2009),
// "A Physiologically-based Model for Simulation of Color Vision Deficiency",
// IEEE TVCG 15(6), pp. 1291-1298. Severity 1.0 only: protanopia, deuteranopia,
// tritanopia. Plus a Rec.709 greyscale and the WCAG level namer.
//
// This mirrors engine/src/color-vision.ts and must stay numerically identical
// to it. Two conventions carried over from there:
//  - the matrix multiplies the GAMMA-ENCODED sRGB channels, with no
//    linearisation, which is what the authors' own reference code does;
//  - channels are clamped to [0,1] after the multiply and rounded to 8 bits.
// Row-major 3x3, copied verbatim from the published table. Do not tidy them.
var CVD_MATRICES = {
  protan: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
  deutan: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881],
  tritan: [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039],
};

// '#abc' / '#aabbcc' / '#aabbccdd' (alpha dropped) -> [r,g,b] 0..255, or null.
function cvdHexToRgb(hex) {
  var s = String(hex == null ? '' : hex).trim();
  var m3 = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(s);
  if (m3) s = '#' + m3[1] + m3[1] + m3[2] + m3[2] + m3[3] + m3[3];
  var m6 = /^#?([0-9a-f]{6})(?:[0-9a-f]{2})?$/i.exec(s);
  if (!m6) return null;
  var n = parseInt(m6[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function cvdRgbToHex(rgb) {
  var out = '#';
  for (var i = 0; i < 3; i++) {
    var v = Math.round(rgb[i]);
    v = v < 0 ? 0 : (v > 255 ? 255 : v);
    out += (v < 16 ? '0' : '') + v.toString(16);
  }
  return out;
}

// Hex in, hex out. `type` is 'protan' | 'deutan' | 'tritan'. Null on bad input.
function cvdSimulateHex(hex, type) {
  var m = CVD_MATRICES[type];
  var rgb = cvdHexToRgb(hex);
  if (!m || !rgb) return null;
  var r = rgb[0] / 255;
  var g = rgb[1] / 255;
  var b = rgb[2] / 255;
  var ch = function (a, bb, c) {
    var v = a * r + bb * g + c * b;
    v = v < 0 ? 0 : (v > 1 ? 1 : v);
    return Math.round(v * 255);
  };
  return cvdRgbToHex([ch(m[0], m[1], m[2]), ch(m[3], m[4], m[5]), ch(m[6], m[7], m[8])]);
}

// Rec.709 luma (0.2126 / 0.7152 / 0.0722) of the gamma-encoded channels.
function cvdGreyscaleHex(hex) {
  var rgb = cvdHexToRgb(hex);
  if (!rgb) return null;
  var y = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
  y = y < 0 ? 0 : (y > 1 ? 1 : y);
  var v = Math.round(y * 255);
  return cvdRgbToHex([v, v, v]);
}

// The best WCAG 2.1 level a ratio reaches. Normal text: AA 4.5, AAA 7. Large
// text (18pt, or 14pt bold): AA 3, AAA 4.5. Below the AA bar for normal text,
// 3:1 still carries UI components and graphical objects, reported as 'UI'.
function cvdWcagLevel(ratio, large) {
  if (!(ratio >= 1)) return 'Fail';
  if (ratio >= (large ? 4.5 : 7)) return 'AAA';
  if (ratio >= (large ? 3 : 4.5)) return 'AA';
  return ratio >= 3 ? 'UI' : 'Fail';
}
// === /lolly:shared cvd ===
