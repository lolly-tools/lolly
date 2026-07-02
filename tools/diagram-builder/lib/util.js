// SPDX-License-Identifier: MPL-2.0
// ── small helpers ─────────────────────────────────────────────────────────────
export function inputsFrom(model) { var o = {}; model.forEach(function (i) { o[i.id] = i.value; }); return o; }
export function num(v, d) { var x = Number(v); return isFinite(x) ? x : d; }
export function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
export function f2(v) { return Math.round(v * 100) / 100; }
export function arr(v) { return Array.isArray(v) ? v : []; }
export function trim(v) { return String(v == null ? '' : v).trim(); }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
export function color(v, fallback) {
  var s = (typeof v === 'string' ? v : '').trim();
  if (s.toLowerCase() === 'transparent') return 'transparent';
  return /^#[0-9a-f]{3,8}$/i.test(s) || /^(rgb|hsl)a?\([\d%.,\s/]+\)$/i.test(s) ? s : fallback;
}
export function slug(s) { return trim(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
export function titleize(s) { s = String(s == null ? '' : s).replace(/[-_]+/g, ' ').trim(); return s.replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }

// ── auto-contrast text (house pattern: shells/web/src/palette.js + sibling tools) ──
// WCAG relative luminance of a #hex; null for transparent/rgb()/invalid (unmeasurable).
export function relLuminance(hex) {
  var s = String(hex == null ? '' : hex).replace('#', '');
  if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(s)) return null;
  var h = s.length === 3 ? s.replace(/(.)/g, '$1$1') : s;
  function lin(i) { var v = parseInt(h.slice(i, i + 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
  return 0.2126 * lin(0) + 0.7152 * lin(2) + 0.0722 * lin(4);
}
export function contrastRatio(l1, l2) { var hi = Math.max(l1, l2), lo = Math.min(l1, l2); return (hi + 0.05) / (lo + 0.05); }
// Text ink for a coloured fill: keep the chosen `prefer` colour while it stays
// readable on `fill`, otherwise flip to white (dark fill) or brand pine (light fill).
// A non-hex fill (transparent / rgb() / gradient) keeps `prefer` unchanged.
export function inkOn(fill, prefer) {
  var lf = relLuminance(fill);
  if (lf == null) return prefer;
  var lp = relLuminance(prefer);
  if (lp != null && contrastRatio(lf, lp) >= 3) return prefer;
  return lf < 0.5 ? '#ffffff' : '#0c322c';
}

// Greedy word-wrap into at most `maxLines` lines of ~maxChars each.
export function wrapLines(text, maxChars, maxLines) {
  maxChars = Math.max(4, Math.floor(maxChars));
  var words = trim(text).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  var lines = [], cur = '', i = 0;
  for (; i < words.length; i++) {
    var w = words[i];
    if (w.length > maxChars) w = w.slice(0, Math.max(1, maxChars - 1)) + '…';
    var cand = cur ? cur + ' ' + w : w;
    if (!cur || cand.length <= maxChars) { cur = cand; }
    else {
      lines.push(cur); cur = w;
      if (lines.length === maxLines) { cur = ''; break; }
    }
  }
  if (cur) lines.push(cur);
  if ((i < words.length) || lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    var k = lines.length - 1;
    if (k >= 0) {
      var l = lines[k];
      if (l.length > maxChars - 1) l = l.slice(0, Math.max(1, maxChars - 1));
      if (!/…$/.test(l)) l += '…';
      lines[k] = l;
    }
  }
  return lines;
}
export function estLineCount(text, maxChars) { return wrapLines(text, maxChars, 6).length; }
export function maxCharsFor(width, fontSize) { return Math.max(4, Math.floor((width - 18) / (fontSize * 0.56))); }
export function textWidth(str, fontSize) { return String(str).length * fontSize * 0.62; }

// ── matrix quadrant text parsing (shared by the matrix layout + the DSL parser) ──
export function quadFromText(s) {
  s = String(s == null ? '' : s).toLowerCase();
  if (/^(tl|tr|bl|br)$/.test(s)) return s;
  var top = /top|upper|high/.test(s), bot = /bottom|lower|low/.test(s), left = /left/.test(s), right = /right/.test(s);
  if (top && left) return 'tl'; if (top && right) return 'tr'; if (bot && left) return 'bl'; if (bot && right) return 'br';
  return '';
}
