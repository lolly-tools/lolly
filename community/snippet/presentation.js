// SPDX-License-Identifier: MPL-2.0
(function () {
  var DEFAULT_CODE = "const greet = (name) => {\\n  console.log(`Hello, ${name}!`);\\n  return name;\\n};\\n\\ngreet('World');";

  // Indentation tab stop. Kept in lockstep with `tab-size` in the stylesheet above:
  // both must be the same number so an expanded snippet reads identically to a raw one.
  var TAB_SIZE = 2;

  // Expand tabs to spaces against fixed tab stops BEFORE anything renders. A raw TAB is
  // the one whitespace character whose rendered width depends on `tab-size` being
  // honoured, and that does NOT survive every export path. The raster (PNG/JPEG) export
  // serialises the canvas into an SVG <foreignObject>, and some browser versions drop
  // `tab-size` there: leading tabs collapse to zero width while internal spaces are
  // kept, so indentation vanishes from the saved image even though the on-screen preview
  // is perfect (the exact bug a gofmt'd, tab-indented snippet hit). Expanding here makes
  // indentation pure spaces, which render the same on screen and in every export, on
  // every browser. Column-aware, so a tab used for alignment lands on the same stop it
  // would on screen.
  function expandTabs(src, size) {
    var out = '', col = 0;
    for (var i = 0; i < src.length; i++) {
      var c = src[i];
      if (c === '\t') {
        var n = size - (col % size);
        for (var s = 0; s < n; s++) out += ' ';
        col += n;
      } else if (c === '\n') {
        out += c; col = 0;
      } else {
        out += c; col++;
      }
    }
    return out;
  }

  var root = document.currentScript && document.currentScript.previousElementSibling;
  if (!root || root.id !== 'cc-root') root = document.getElementById('cc-root');
  if (root.__snippet) root.__snippet.destroy();
  var authoredMarkup = root.outerHTML;
  var code = expandTabs(root.dataset.code == null ? DEFAULT_CODE : root.dataset.code.replace(/\r\n?/g, '\n'), TAB_SIZE);
  var scene = JSON.parse(root.querySelector('.cc-scene').textContent);
  var language = root.dataset.language || 'javascript';
  var theme = root.dataset.theme || 'suse-dark';
  var lineNums = root.dataset.lineNumbers !== 'false';
  var showWindow = root.dataset.showWindow !== 'false';
  var shadow = root.dataset.shadow !== 'off';
  var scale = parseFloat(root.dataset.scale || '100') / 100;
  var titleScale = parseFloat(root.dataset.titleScale || '100') / 100;
  var iconScale = parseFloat(root.dataset.iconScale || '100') / 100;
  var lineHeight = parseFloat(root.dataset.lineHeight || '1.7');
  if (isNaN(lineHeight)) lineHeight = 1.7;
  var calloutMode = root.dataset.calloutMode || 'off';
  var calloutPrefixes = (root.dataset.calloutPrefix || '').split(',')
    .map(function (s) { return s.trim().toLowerCase(); })
    .filter(function (s) { return s.length > 0; });
  var calloutFont = root.dataset.calloutFont || 'mono';
  var transparentBg = root.dataset.transparentBg === 'true';
  var windowStyle = root.dataset.windowStyle || 'nuremberg';

  // ── Theme definitions ────────────────────────────────────────────────────
  var THEMES = {
    'suse-dark': {
      outerBg:   'linear-gradient(135deg, #1a5c3a 0%, #0c322c 100%)',
      windowBg:  '#0c322c',
      headerBg:  '#092b23',
      codeBg:    '#0c322c',
      fg:        '#d4ede1',
      gutter:    '#d4ede1',
      keyword:   '#30ba78',
      string:    '#7dd3a8',
      comment:   '#3d7a58',
      number:    '#fe7c3f',
      fn:        '#5ecf94',
      type:      '#8be9fd',
      operator:  '#30ba78'
    },
    'suse-light': {
      outerBg:   'linear-gradient(135deg, #30ba78 0%, #e8f5ee 100%)',
      windowBg:  '#ffffff',
      headerBg:  '#f0f7f3',
      codeBg:    '#ffffff',
      fg:        '#0c322c',
      gutter:    '#0c322c',
      keyword:   '#0c8c5c',
      string:    '#1a6e40',
      comment:   '#7aaa90',
      number:    '#d45c00',
      fn:        '#0c322c',
      type:      '#006b8c',
      operator:  '#0c8c5c'
    },
    'github-dark': {
      outerBg:   'linear-gradient(135deg, #1c2128 0%, #0d1117 100%)',
      windowBg:  '#0d1117',
      headerBg:  '#161b22',
      codeBg:    '#0d1117',
      fg:        '#c9d1d9',
      gutter:    '#c9d1d9',
      keyword:   '#ff7b72',
      string:    '#a5d6ff',
      comment:   '#8b949e',
      number:    '#79c0ff',
      fn:        '#d2a8ff',
      type:      '#ffa657',
      operator:  '#ff7b72'
    },
    'nord': {
      outerBg:   'linear-gradient(135deg, #5e81ac 0%, #2e3440 100%)',
      windowBg:  '#2e3440',
      headerBg:  '#252932',
      codeBg:    '#2e3440',
      fg:        '#d8dee9',
      gutter:    '#d8dee9',
      keyword:   '#81a1c1',
      string:    '#a3be8c',
      comment:   '#4c566a',
      number:    '#b48ead',
      fn:        '#88c0d0',
      type:      '#8fbcbb',
      operator:  '#81a1c1'
    }
  };

  // ── Brand-derived "Brand Dark / Brand Light" ─────────────────────────────
  // The suse-dark/suse-light entries above are only the FALLBACK seeds (the
  // CLI and an unbranded canvas inject no --brand-* vars). On a branded
  // canvas the two "Brand" themes re-derive every green-family member from
  // the resolved --brand-primary hue, so their labels stay true under any
  // design system. `number` and `type` keep their fixed contrast hues -
  // syntax needs more distinguishable hues than one brand slot provides
  // (sandbox's auto theme takes the same line). Values stay hex so the
  // rgba() helper below keeps working.
  function hexHsl(hex) {
    var r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    var h = 0;
    if (d > 0) {
      if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
      else if (mx === g) h = ((b - r) / d + 2) * 60;
      else h = ((r - g) / d + 4) * 60;
    }
    var l = (mx + mn) / 2;
    var s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    return [h, s * 100, l * 100];
  }
  function hslHex(h, s, l) {
    h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
    var c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
    var rgb = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    var out = '#';
    for (var i = 0; i < 3; i++) {
      var v = Math.round((rgb[i] + m) * 255).toString(16);
      out += v.length < 2 ? '0' + v : v;
    }
    return out;
  }
  // Any CSS colour the canvas hands over -> #rrggbb. The brand layer passes ramp
  // values through as raw oklch() strings (brand-vars.ts: the browser resolves them
  // in var()), so a hex-only test here quietly threw the whole brand away and the
  // SUSE seeds above painted a magenta brand green (Andy, 2026-09-03). A 1x1 canvas
  // fill is the one parser every engine shares for oklch/lch/lab/hsl/rgb/named
  // colours; a sentinel fill first tells a refused value from a real black. Under
  // jsdom (the CLI) there is no 2D context, so this returns null and the seeds stand.
  function cssHex(v) {
    v = (v || '').trim();
    if (!v) return null;
    if (/^#[0-9a-f]{6}$/i.test(v)) return v.toLowerCase();
    try {
      var c = document.createElement('canvas');
      c.width = c.height = 1;
      var ctx = c.getContext('2d');
      if (!ctx) return null;
      ctx.fillStyle = '#010203';
      ctx.fillStyle = v;
      if (ctx.fillStyle === '#010203') return null;   // not a colour the engine can read
      ctx.fillRect(0, 0, 1, 1);
      var d = ctx.getImageData(0, 0, 1, 1).data;
      var out = '#';
      for (var i = 0; i < 3; i++) { var s = d[i].toString(16); out += s.length < 2 ? '0' + s : s; }
      return out;
    } catch (e) { return null; }
  }
  function brandVar(name) {
    try { return cssHex(getComputedStyle(root).getPropertyValue(name)); } catch (e) { return null; }
  }
  (function brandise() {
    var v = brandVar('--brand-primary');
    if (!v) return;
    // Only the HUE is taken from the brand; every role sits at a FIXED
    // lightness band so contrast holds by construction. The raw value is
    // never used as a text colour - a brand whose primary is near-black
    // (SUSE's Pine) or near-white would otherwise vanish into the derived
    // background of the same hue.
    var p = hexHsl(v), h = p[0], s = Math.min(p[1], 72);
    var d = THEMES['suse-dark'], l = THEMES['suse-light'];
    d.outerBg = 'linear-gradient(135deg, ' + hslHex(h, s, 26) + ' 0%, ' + hslHex(h, s, 12) + ' 100%)';
    d.windowBg = d.codeBg = hslHex(h, s, 12);
    d.headerBg = hslHex(h, s, 9);
    d.fg = d.gutter = hslHex(h, 25, 88);
    d.keyword = d.operator = hslHex(h, 58, 58);
    d.string = hslHex(h, 45, 74);
    d.comment = hslHex(h, 20, 44);
    d.fn = hslHex(h, 50, 66);
    l.outerBg = 'linear-gradient(135deg, ' + hslHex(h, 52, 46) + ' 0%, ' + hslHex(h, 35, 94) + ' 100%)';
    l.headerBg = hslHex(h, 30, 96);
    l.fg = l.gutter = hslHex(h, 45, 14);
    l.keyword = l.operator = hslHex(h, 62, 30);
    l.string = hslHex(h, 55, 25);
    l.comment = hslHex(h, 18, 58);
    l.fn = hslHex(h, 45, 20);
    // The brand's own surface and ink, where the canvas exposes them and they fit the
    // theme: a light surface is Brand Light's paper and a dark one is Brand Dark's
    // window, an ink darker than mid is Brand Light's text and a lighter one Brand
    // Dark's. An ink-and-paper brand (no hue at all) reads as its real greys this way
    // instead of a derived tint; a mismatched pair (say a dark surface while the app
    // is in light mode) is simply left to the hue derivation above.
    var surface = brandVar('--brand-surface'), ink = brandVar('--brand-text');
    if (surface) {
      var sl = hexHsl(surface)[2];
      if (sl >= 60) { l.windowBg = l.codeBg = surface; l.headerBg = hslHex(hexHsl(surface)[0], Math.min(hexHsl(surface)[1], 30), Math.max(0, sl - 4)); }
      else if (sl <= 40) { d.windowBg = d.codeBg = surface; d.headerBg = hslHex(hexHsl(surface)[0], Math.min(hexHsl(surface)[1], 30), Math.max(0, sl - 3)); }
    }
    if (ink) {
      var il = hexHsl(ink)[2];
      if (il <= 40) l.fg = l.gutter = ink;
      else if (il >= 60) d.fg = d.gutter = ink;
    }
  })();

  var t = THEMES[theme] || THEMES['suse-dark'];

  // ── Apply theme ──────────────────────────────────────────────────────────
  var window_ = root.querySelector('#cc-window');
  var header = root.querySelector('#cc-header');
  var codeEl = root.querySelector('#cc-code');
  var gutter = root.querySelector('#cc-gutter');
  var filenameEl = root.querySelector('#cc-filename');
  var leftCtl = root.querySelector('#cc-controls-left');
  var rightCtl = root.querySelector('#cc-controls-right');

  root.style.background = transparentBg ? 'transparent' : t.outerBg;
  if (!shadow) window_.style.boxShadow = 'none';
  window_.style.background = t.codeBg;
  header.style.background  = t.headerBg;
  codeEl.style.background  = t.codeBg;
  codeEl.style.color       = t.fg;
  gutter.style.background  = t.headerBg;
  gutter.style.color       = t.gutter;

  // CSS vars on root (token colours + ui scale)
  var cssVars = '--tok-keyword:' + t.keyword + ';--tok-string:' + t.string +
    ';--tok-comment:' + t.comment + ';--tok-number:' + t.number +
    ';--tok-function:' + t.fn + ';--tok-type:' + t.type +
    ';--tok-operator:' + t.operator +
    ';--cc-ca-fg:' + t.fg + ';--cc-ca-bg:' + rgba(t.fg, 0.07) +
    ';--cc-ca-bd:' + rgba(t.number, 0.55) + ';--cc-ca-arrow:' + t.number +
    ';--cc-ca-font:' + (calloutFont.indexOf('brand') === 0
      ? "var(--font-brand, 'SUSE', ui-sans-serif, sans-serif)"
      : "var(--font-mono, 'SUSE Mono', 'Roboto Mono', ui-monospace, monospace)") +
    ';--cc-ca-style:' + (/italic/.test(calloutFont) ? 'italic' : 'normal');
  root.setAttribute('style', root.getAttribute('style') + ';' + cssVars);

  // ── Window chrome ────────────────────────────────────────────────────────
  if (!showWindow) {
    header.style.display = 'none';
    gutter.style.borderTop = 'none';
  }

  // ── Render ───────────────────────────────────────────────────────────────
  var highlighted = JSON.parse(root.querySelector('.cc-highlighted').textContent);
  codeEl.innerHTML = highlighted;

  var lineCount = code.split('\n').length;
  if (lineNums) {
    var nums = '';
    for (var ln = 1; ln <= lineCount; ln++) nums += (ln > 1 ? '\n' : '') + ln;
    gutter.textContent = nums;
    gutter.style.display = '';
  } else {
    gutter.style.display = 'none';
  }

  // ── Window-manager chrome (cupertino / redmond / nuremberg) ──────────────
  // Glyphs are inline SVG with EXPLICIT stroke colours (not currentColor) so
  // they survive both the PNG path (foreignObject) and the SVG export path
  // (inline-<svg> passthrough clones verbatim, with no inherited colour). The
  // Adwaita close button is a border-radius:50% div → exports as a circle.
  var SVGNS = 'http://www.w3.org/2000/svg';

  function hexToRgb(hex) {
    hex = String(hex || '').trim().replace('#', '');
    if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    var n = parseInt(hex, 16);
    if (isNaN(n)) return [128, 128, 128];
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgba(hex, a) { var c = hexToRgb(hex); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }

  function makeSvg(box) {
    var s = document.createElementNS(SVGNS, 'svg');
    s.setAttribute('viewBox', '0 0 ' + box + ' ' + box);
    s.setAttribute('width', box);
    s.setAttribute('height', box);
    s.style.display = 'block';
    s.style.overflow = 'visible';
    return s;
  }
  function svgLine(svg, x1, y1, x2, y2, stroke, w) {
    var l = document.createElementNS(SVGNS, 'line');
    l.setAttribute('x1', x1); l.setAttribute('y1', y1);
    l.setAttribute('x2', x2); l.setAttribute('y2', y2);
    l.setAttribute('stroke', stroke); l.setAttribute('stroke-width', w);
    l.setAttribute('stroke-linecap', 'round');
    svg.appendChild(l);
  }

  // macOS traffic-light dot
  function macDot(color, IS) {
    var d = document.createElement('span');
    d.className = 'cc-dot';
    d.style.width = d.style.height = (12 * IS) + 'px';
    d.style.background = color;
    return d;
  }

  // Windows 11 caption button (minimize / maximize / close), flat + monochrome
  function winCap(kind, IS) {
    var b = document.createElement('div');
    b.className = 'cc-cap';
    b.style.width = (46 * IS) + 'px';
    b.style.alignSelf = 'stretch';
    var glyph = rgba(t.fg, 0.78);          // neutral monochrome, never the hover-red
    var sw = Math.max(1, 1.1 * IS);
    var box = 10 * IS;
    var svg = makeSvg(box);
    if (kind === 'min') {
      svgLine(svg, 0, box / 2, box, box / 2, glyph, sw);
    } else if (kind === 'max') {
      var r = document.createElementNS(SVGNS, 'rect');
      r.setAttribute('x', sw / 2); r.setAttribute('y', sw / 2);
      r.setAttribute('width', box - sw); r.setAttribute('height', box - sw);
      r.setAttribute('rx', 1.5 * IS);
      r.setAttribute('fill', 'none');
      r.setAttribute('stroke', glyph); r.setAttribute('stroke-width', sw);
      svg.appendChild(r);
    } else {
      svgLine(svg, 0, 0, box, box, glyph, sw);
      svgLine(svg, box, 0, 0, box, glyph, sw);
    }
    b.appendChild(svg);
    return b;
  }

  // GNOME Adwaita close button: circular, faint currentColor-tinted background
  // (libadwaita resting bg ≈ currentColor @10%), thin × glyph.
  function adwClose(IS) {
    var b = document.createElement('div');
    b.className = 'cc-cap';
    var d = 26 * IS;
    b.style.width = b.style.height = d + 'px';
    b.style.borderRadius = '50%';
    b.style.background = rgba(t.fg, 0.13);
    var box = 11 * IS;
    var sw = Math.max(1, 1.5 * IS);
    var glyph = rgba(t.fg, 0.92);
    var svg = makeSvg(box);
    svgLine(svg, 0, 0, box, box, glyph, sw);
    svgLine(svg, box, 0, 0, box, glyph, sw);
    b.appendChild(svg);
    return b;
  }

  function buildChrome(IS) {
    leftCtl.innerHTML = '';
    rightCtl.innerHTML = '';
    // reset shared props (inline styles persist across re-renders / WM switches)
    header.style.minHeight   = '';
    header.style.gap         = (14 * IS) + 'px';
    header.style.borderBottom = '1px solid ' + rgba(t.fg, 0.10);
    leftCtl.style.gap        = '0';
    rightCtl.style.gap       = '0';
    rightCtl.style.alignSelf = '';
    filenameEl.style.color      = t.fg;
    filenameEl.style.margin     = '0 auto';
    filenameEl.style.opacity    = '1';
    filenameEl.style.fontWeight = '700';
    filenameEl.style.fontSize   = (14 * IS * titleScale) + 'px';

    var radius;
    if (windowStyle === 'redmond') {
      radius = 8;
      header.style.padding   = '0 0 0 ' + (16 * IS) + 'px';
      header.style.minHeight = (34 * IS) + 'px';
      filenameEl.style.margin     = '0 auto 0 0';   // title left, controls flush right
      filenameEl.style.opacity    = '0.8';
      filenameEl.style.fontWeight = '600';
      rightCtl.appendChild(winCap('min', IS));
      rightCtl.appendChild(winCap('max', IS));
      rightCtl.appendChild(winCap('close', IS));
    } else if (windowStyle === 'cupertino') {
      radius = 11;
      header.style.padding = (14 * IS) + 'px ' + (20 * IS) + 'px';
      filenameEl.style.opacity = '0.5';
      leftCtl.style.gap = (8 * IS) + 'px';
      leftCtl.appendChild(macDot('#ff5f56', IS));
      leftCtl.appendChild(macDot('#febc2e', IS));
      leftCtl.appendChild(macDot('#28c840', IS));
    } else { // nuremberg - GNOME Adwaita (default)
      radius = 14;
      header.style.padding = (12 * IS) + 'px ' + (14 * IS) + 'px';
      rightCtl.appendChild(adwClose(IS));
    }
    window_.style.borderRadius = (radius * IS) + 'px';
  }

  // ── Chrome sizing (slider scale only, not content-dependent) ─────────────
  var IS = scale; // slider value: 0.7 - 2.0
  buildChrome(IS);

  // Title-bar icon scale: em-based so it tracks the (already title-scaled) filename
  // font-size; iconScale is an extra multiplier on top of that.
  var iconEl = filenameEl.querySelector('.cc-icon');
  if (iconEl) iconEl.style.height = (1.15 * iconScale) + 'em';

  // Line height applies to code + gutter alike so line numbers stay aligned. Set
  // before fit() so the binary search measures the real rendered height.
  codeEl.style.lineHeight = String(lineHeight);
  gutter.style.lineHeight = String(lineHeight);

  codeEl.style.paddingTop    = (20 * IS) + 'px';
  codeEl.style.paddingRight  = (24 * IS) + 'px';
  codeEl.style.paddingBottom = (20 * IS) + 'px';
  codeEl.style.paddingLeft   = (24 * IS) + 'px';
  gutter.style.paddingTop    = (20 * IS) + 'px';
  gutter.style.paddingRight  = (16 * IS) + 'px';
  gutter.style.paddingBottom = (20 * IS) + 'px';
  gutter.style.paddingLeft   = (20 * IS) + 'px';

  // ── Auto-fit: binary search for the largest font that doesn't overflow ────
  // The slider then acts as a multiplier on the fitted size.
  function applyFs(fs) {
    codeEl.style.fontSize  = fs + 'px';
    gutter.style.fontSize  = fs + 'px';
    // Cap callout pills to one code line so a 2-line pill can't grow the row and
    // drift the separate gutter. Tracks the fitted size on every fit() path.
    codeEl.style.setProperty('--cc-ca-max', (fs * lineHeight) + 'px');
  }

  // True when a line reaches past the code's content edge, leaving `room` px after
  // its last glyph (the caret's width in animated scenes). scrollWidth alone is not
  // a safe test: for an unwrapped line Chromium leaves the right padding out of it,
  // so a fitted long line could end anywhere in that padding, up to the window edge,
  // depending on how the platform font's advances landed (a Linux fallback face put
  // the caret outside the window). The glyph box is measured from the live layout,
  // so the padding holds on every font. Wrapped lines break at the content edge.
  function overflowsX(slack, room) {
    if (codeEl.scrollWidth > codeEl.clientWidth + slack) return true;
    if (scene.wrap) return false;
    var css = getComputedStyle(codeEl), range = document.createRange();
    range.selectNodeContents(codeEl.querySelector('.cc-source') || codeEl);
    var glyphs = range.getBoundingClientRect();
    if (!glyphs.width) return false;
    var box = codeEl.getBoundingClientRect(), zoom = root.getBoundingClientRect().width / (root.clientWidth || 1) || 1;
    var edge = box.left + (codeEl.clientLeft + codeEl.clientWidth - parseFloat(css.paddingRight)) * zoom;
    return glyphs.right + room * zoom > edge;
  }

  function fit() {
    var availH = root.clientHeight - 112; // 56px root-padding each side
    if (availH <= 0) { applyFs(13 * IS); return; }
    var lo = 0, hi = 26 * IS;
    applyFs(hi);
    if (window_.scrollHeight <= availH && !overflowsX(0, 0)) {
      applyFs(hi); return;
    }
    while (hi - lo > 0.01) {
      var mid = (lo + hi) / 2;
      applyFs(mid);
      if (window_.scrollHeight > availH || overflowsX(0, 0)) hi = mid;
      else lo = mid;
    }
    applyFs(lo);
  }

  fit();
  mountScene();

  function mountScene() {
    let body = root.querySelector('#cc-body');
    let source = document.createElement('span');
    source.className = 'cc-source'; source.style.display = 'block';
    source.innerHTML = highlighted;
    codeEl.replaceChildren(source);
    let numberLines = document.createElement('div'); numberLines.className = 'cc-number-lines'; numberLines.textContent = gutter.textContent;
    gutter.replaceChildren(numberLines);
    let library = document.createElement('div'); library.hidden = true; library.dataset.exportHide = ''; library.setAttribute('aria-hidden', 'true');
    let documents = scene.animated ? scene.docs.map(function (doc) {
      let element = document.createElement('span'); element.innerHTML = doc.html; library.appendChild(element);
      return { element: element, parts: null };
    }) : [];
    root.appendChild(library);
    let marks = document.createElement('div'); marks.className = 'cc-marks'; marks.setAttribute('aria-hidden', 'true'); body.appendChild(marks);
    let caret = document.createElement('div'); caret.className = 'cc-caret'; caret.style.background = t.fg; marks.appendChild(caret);
    let suggestion = document.createElement('div'); suggestion.className = 'cc-suggestion'; suggestion.hidden = true;
    suggestion.style.background = t.headerBg; suggestion.style.color = t.fg; suggestion.style.borderColor = rgba(t.fg, .25);
    let suggestionText = document.createElement('span'); suggestionText.className = 'cc-suggestion-text';
    let suggestionKey = document.createElement('span'); suggestionKey.className = 'cc-suggestion-key'; suggestionKey.textContent = 'Tab to accept';
    suggestion.append(suggestionText, suggestionKey); body.appendChild(suggestion);
    let target = document.createElement('span'); target.className = 'cc-target'; window_.appendChild(target);
    let pointer = document.createElementNS(SVGNS, 'svg'); pointer.classList.add('cc-pointer'); pointer.setAttribute('viewBox', '0 0 25 30'); pointer.setAttribute('aria-hidden', 'true');
    let cursorScale = scene.cursorScale || 1;
    pointer.style.width = (25 * cursorScale) + 'px'; pointer.style.height = (30 * cursorScale) + 'px';
    let arrow = document.createElementNS(SVGNS, 'path'); arrow.setAttribute('d', 'M3 2 L3 23 L8 18 L12 27 L16 25 L12 17 L20 17 Z'); arrow.setAttribute('fill', t.fg); arrow.setAttribute('stroke', t.codeBg); arrow.setAttribute('stroke-width', '1.5');
    let beam = document.createElementNS(SVGNS, 'path'); beam.setAttribute('d', 'M3 2 H13 M8 2 V23 M3 23 H13'); beam.setAttribute('fill', 'none'); beam.setAttribute('stroke', t.fg); beam.setAttribute('stroke-width', '2');
    pointer.append(arrow, beam); root.appendChild(pointer);
    let ring = document.createElement('div'); ring.className = 'cc-click-ring'; ring.style.borderColor = t.fg; root.appendChild(ring);
    let clock = document.createElement('canvas'); clock.width = clock.height = 0; clock.style.display = 'none'; clock.setAttribute('aria-hidden', 'true');
    if (scene.animated) root.appendChild(clock);
    let controls = document.createElement('div'); controls.className = 'cc-playback'; controls.dataset.exportHide = ''; controls.style.color = t.fg;
    let play = document.createElement('button'); play.type = 'button'; play.textContent = 'Play';
    let scrub = document.createElement('input'); scrub.type = 'range'; scrub.min = '0'; scrub.max = String(scene.duration); scrub.step = '.01'; scrub.setAttribute('aria-label', 'Scene time in seconds');
    let output = document.createElement('output'); output.setAttribute('aria-live', 'off');
    controls.append(play, scrub, output); controls.hidden = !scene.animated; root.appendChild(controls);
    let warning = document.createElement('div'); warning.className = 'cc-scene-warning'; warning.dataset.exportHide = ''; warning.setAttribute('role', 'status'); warning.style.color = t.fg;
    warning.textContent = scene.warnings.join(' '); warning.hidden = !warning.textContent; root.appendChild(warning);
    let closeButton = windowStyle === 'cupertino' ? leftCtl.firstElementChild : rightCtl.lastElementChild;
    let selected = [], textNodes = [], currentDoc = -1, lastCut = '', time = scene.posterAt < 0 ? scene.poster : scene.posterAt;
    let playing = false, poster = true, frame = 0, lastNow = 0, exportMode = '', exportLength = scene.duration, saved = null, disposed = false;
    let observer, removal, poseFit = 1;
    let maxLines = Math.max.apply(null, scene.docs.map(function (doc) { return doc.text.split('\n').length; }));
    if (lineNums && scene.animated) gutter.style.width = 'calc(' + String(maxLines).length + 'ch + ' + (36 * IS + 1) + 'px)';
    if (scene.animated) root.dataset.blink = 'off';
    codeEl.style.whiteSpace = scene.wrap ? 'pre-wrap' : 'pre';
    codeEl.style.overflowWrap = scene.wrap ? 'anywhere' : 'normal';

    function clamp(n) { return Math.max(0, Math.min(1, n)); }
    function ease(n) { n = clamp(n); return n * n * (3 - 2 * n); }
    function revealed(cuts, fraction) {
      let lo = 0, hi = cuts.length;
      while (lo < hi) { let mid = (lo + hi) >> 1; if (cuts[mid][0] <= fraction) lo = mid + 1; else hi = mid; }
      return lo ? cuts[lo - 1][1] : 0;
    }
    function viewAt(seconds) {
      let state = scene.initial, active = null;
      for (let i = 0; i < scene.events.length; i++) {
        let event = scene.events[i];
        if (seconds >= event.end) state = event.after;
        else if (seconds >= event.start) { active = event; break; }
        else break;
      }
      let view = { state: Object.assign({}, state), event: active, progress: 1, hidden: null, opening: state.open ? 1 : 0, closing: 0, typing: false, completion: false };
      if (!active) return view;
      let p = clamp((seconds - active.start) / Math.max(.001, active.end - active.start));
      view.progress = p; view.state = Object.assign({}, active.before);
      if (active.action === 'open') { view.state.open = true; view.opening = ease(p); }
      if (active.action === 'close') { view.closing = ease((p - .6) / .3); view.opening = active.before.open ? 1 : 0; }
      if (active.action === 'click' && p >= .85) view.state = Object.assign({}, active.after);
      if (['type', 'replace', 'complete'].includes(active.action) && (active.action !== 'replace' || active.before.selection)) {
        let count = active.action === 'complete' ? (p < .8 ? 0 : active.insert.length) : revealed(active.cuts, p);
        view.state = Object.assign({}, active.after);
        view.state.caret = active.at + count;
        view.hidden = [active.at + count, active.at + active.insert.length];
        view.opening = 1; view.typing = true; view.completion = active.action === 'complete' && p < .8;
      }
      if (active.action === 'select' && active.after.selection) {
        let range = active.after.selection;
        let end = range[0] + revealed(active.cuts, clamp((p - .3) / .7));
        view.state.selection = [range[0], end]; view.state.caret = end;
        view.state.focused = true;
      }
      return view;
    }
    function documentParts(record) {
      if (record.parts && record.parts.every(function (part) { return record.element.contains(part.node); })) return record.parts;
      if (record.parts) record.parts.forEach(function (part) { if (record.element.contains(part.node) && !part.emoji) part.node.textContent = part.text; });
      let parts = [], offset = 0;
      function visit(node) {
        let emoji = node.nodeType === 1 && node.classList.contains('lolly-emoji');
        if (emoji || node.nodeType === 3) {
          let text = emoji ? node.getAttribute('data-emoji') : node.textContent;
          parts.push({ node: node, text: text, start: offset, emoji: emoji }); offset += text.length;
        } else Array.from(node.childNodes).forEach(visit);
      }
      visit(record.element); record.parts = parts; return parts;
    }
    function restoreDocument(record) {
      documentParts(record).forEach(function (part) { if (part.emoji) part.node.hidden = false; else part.node.textContent = part.text; });
    }
    function loadDocument(id) {
      let record = documents[id], parts = documentParts(record);
      if (id === currentDoc && parts === textNodes) return;
      if (source.firstChild !== record.element && documents.some(function (doc) { return doc.element === source.firstChild; })) library.appendChild(source.firstChild);
      source.replaceChildren(record.element);
      currentDoc = id; textNodes = parts; lastCut = '';
    }
    function paintText(view) {
      loadDocument(view.state.doc);
      let hidden = view.hidden || [0, 0], key = hidden.join(':');
      if (lastCut === key) return;
      lastCut = key;
      textNodes.forEach(function (part) {
        let a = Math.max(0, Math.min(part.text.length, hidden[0] - part.start));
        let b = Math.max(0, Math.min(part.text.length, hidden[1] - part.start));
        if (part.emoji) part.node.hidden = a === 0 && b === part.text.length && b > a;
        else part.node.textContent = part.text.slice(0, a) + part.text.slice(b);
      });
      if (lineNums) {
        let count = visibleText().split('\n').length;
        numberLines.textContent = Array.from({ length: count }, function (_, n) { return n + 1; }).join('\n');
      }
    }
    function visibleText() {
      return scene.animated ? textNodes.map(function (part) { return part.emoji ? (part.node.hidden ? '' : part.text) : part.node.textContent; }).join('') : source.textContent;
    }
    function textRange(start, end) {
      let parts = scene.animated ? textNodes : documentParts({ element: source, parts: null });
      let offset = 0, first = null, last = null;
      function endpoint(part, at) {
        if (!part.emoji) return [part.node, at];
        let parent = part.node.parentNode, index = Array.prototype.indexOf.call(parent.childNodes, part.node);
        return [parent, index + (at > 0 ? 1 : 0)];
      }
      for (let i = 0; i < parts.length; i++) {
        let part = parts[i];
        if (part.emoji && part.node.hidden) continue;
        let length = part.emoji ? part.text.length : part.node.textContent.length, next = offset + length;
        if (!first && start <= next) first = endpoint(part, Math.max(0, start - offset));
        if (end <= next) { last = endpoint(part, Math.max(0, end - offset)); break; }
        offset = next;
      }
      if (!first || !last) return null;
      let range = document.createRange(); range.setStart(first[0], first[1]); range.setEnd(last[0], last[1]); return range;
    }
    function caretRect(offset) {
      let range = textRange(offset, offset), rect = range && range.getBoundingClientRect && range.getBoundingClientRect();
      if (rect && rect.height) return rect;
      let box = codeEl.getBoundingClientRect(), css = getComputedStyle(codeEl), zoom = root.getBoundingClientRect().width / (root.clientWidth || 1) || 1;
      let x = box.left + parseFloat(css.paddingLeft) * zoom, y = box.top + parseFloat(css.paddingTop) * zoom;
      if (offset > 0) {
        let start = offset - 1, position = 0;
        textNodes.forEach(function (part) {
          let length = part.emoji ? (part.node.hidden ? 0 : part.text.length) : part.node.textContent.length;
          if (part.emoji && offset > position && offset <= position + length) start = position;
          position += length;
        });
        let previous = textRange(start, offset), before = previous && previous.getBoundingClientRect && previous.getBoundingClientRect();
        if (before && before.height) {
          let newline = visibleText().charAt(offset - 1) === '\n';
          x = newline ? x - codeEl.scrollLeft * zoom : before.right;
          y = before.top + (newline ? parseFloat(css.lineHeight) * zoom : 0);
          return { left: x, right: x, top: y, bottom: y + before.height, height: before.height };
        }
      }
      let height = parseFloat(css.fontSize) * zoom;
      return { left: x, right: x, top: y, bottom: y + height, height: height };
    }
    function poseStyle(view, exit) {
      let intro = 1 - view.opening, outro = exit ? view.closing : 0;
      let scaleBy = 1 - (scene.entry === 'scale' ? intro * .06 : 0) - (scene.exit === 'scale' ? outro * .08 : 0);
      let y = (scene.entry === 'slide' ? intro * 45 : 0) + (scene.exit === 'slide' ? outro * 45 : 0);
      let transforms = [];
      if (scene.tiltX || scene.tiltY) transforms.push('perspective(1100px)', 'rotateX(' + scene.tiltX + 'deg)', 'rotateY(' + scene.tiltY + 'deg)');
      if (scene.rotate) transforms.push('rotate(' + scene.rotate + 'deg)');
      if (y) transforms.push('translateY(' + y + 'px)');
      if (scaleBy * poseFit !== 1) transforms.push('scale(' + scaleBy * poseFit + ')');
      return transforms.join(' ') || 'none';
    }
    function placePointer(view, point, isPoster) {
      let stage = root.getBoundingClientRect(), sx = root.clientWidth / (stage.width || 1), sy = root.clientHeight / (stage.height || 1);
      let idle = { x: root.clientWidth * .85, y: root.clientHeight * .78 };
      target.style.left = point.x + 'px'; target.style.top = point.y + 'px';
      let rect = target.getBoundingClientRect();
      let hit = { x: (rect.left - stage.left) * sx, y: (rect.top - stage.top) * sy };
      let event = view.event, p = view.progress, action = event && event.action, position = idle, isText = false;
      function mix(a, b, amount) { return { x: a.x + (b.x - a.x) * amount, y: a.y + (b.y - a.y) * amount }; }
      if (action === 'click') { position = mix(idle, hit, ease(p / .85)); isText = p >= .85; }
      if (action === 'type' || action === 'replace' || action === 'complete') position = mix(hit, idle, ease(p * 5));
      if (action === 'select') { position = p < .3 ? mix(idle, hit, ease(p / .3)) : hit; isText = p >= .3; }
      if (action === 'wait' && view.state.selection) { position = hit; isText = true; }
      if (action === 'close' && showWindow && closeButton) {
        let close = closeButton.getBoundingClientRect();
        hit = { x: (close.left + close.width / 2 - stage.left) * sx, y: (close.top + close.height / 2 - stage.top) * sy };
        position = mix(idle, hit, ease(p / .55));
      }
      pointer.hidden = isPoster || !scene.animated || !scene.pointer || !view.state.open || view.closing >= 1 || action === 'open';
      pointer.style.display = pointer.hidden ? 'none' : 'block';
      pointer.style.left = (position.x - (isText ? 8 : 3) * cursorScale) + 'px'; pointer.style.top = (position.y - (isText ? 12 : 2) * cursorScale) + 'px';
      if (closeButton) closeButton.style.filter = action === 'close' && p > .45 && p < .75 ? 'brightness(1.25)' : '';
      arrow.style.display = isText ? 'none' : ''; beam.style.display = isText ? '' : 'none';
      let pulse = action === 'click' ? (p - .85) / .15 : action === 'close' && showWindow ? (p - .55) / .15 : -1;
      ring.hidden = pointer.hidden || !scene.clickRing || pulse < 0 || pulse > 1;
      ring.style.left = (position.x - 16) + 'px'; ring.style.top = (position.y - 16) + 'px'; ring.style.opacity = String(1 - clamp(pulse)); ring.style.transform = 'scale(' + (.5 + clamp(pulse)) + ')';
    }
    function paint(seconds, isPoster) {
      time = Math.max(0, Math.min(scene.duration, seconds)); poster = isPoster;
      let view = viewAt(time);
      window_.style.transform = 'none';
      if (scene.animated) paintText(view);
      let zoom = root.getBoundingClientRect().width / (root.clientWidth || 1) || 1;
      codeEl.scrollTop = codeEl.scrollLeft = gutter.scrollTop = 0;
      source.style.transform = numberLines.style.transform = 'none';
      let rect = caretRect(view.state.caret), area = body.getBoundingClientRect();
      if (scene.wrap && lineNums) {
        let offset = 0, css = getComputedStyle(codeEl), linePx = parseFloat(css.fontSize) * lineHeight;
        let numbers = visibleText().split('\n').map(function (line, index) {
          let range = textRange(offset, offset + line.length), rows = range && range.getClientRects ? Array.from(range.getClientRects()) : [];
          let tops = rows.filter(function (r) { return r.height; }).map(function (r) { return r.top; });
          let height = tops.length ? (Math.max.apply(null, tops) - Math.min.apply(null, tops)) / zoom + linePx : linePx;
          let number = document.createElement('span'); number.textContent = String(index + 1); number.style.display = 'block'; number.style.height = height + 'px';
          offset += line.length + 1;
          return number;
        });
        numberLines.replaceChildren.apply(numberLines, numbers);
      }
      if (scene.scroll) {
        let scrollY = Math.max(0, Math.min(codeEl.scrollHeight - codeEl.clientHeight, (rect.bottom - area.bottom) / zoom + 40 * IS));
        let scrollX = scene.wrap ? 0 : Math.max(0, Math.min(codeEl.scrollWidth - codeEl.clientWidth + 24 * IS, (rect.right - codeEl.getBoundingClientRect().right) / zoom + 35 * IS));
        // Content transforms preserve the scroll position in captured frames.
        source.style.transform = 'translate(' + -scrollX + 'px,' + -scrollY + 'px)';
        numberLines.style.transform = 'translateY(' + -scrollY + 'px)';
        rect = caretRect(view.state.caret);
      }
      let base = window_.getBoundingClientRect();
      let point = { x: (rect.left - base.left) / zoom, y: (rect.top - base.top + rect.height * .6) / zoom };
      selected.forEach(function (el) { el.remove(); }); selected = [];
      if (view.state.selection && !isPoster) {
        let range = textRange(view.state.selection[0], view.state.selection[1]);
        if (range && range.getClientRects) Array.from(range.getClientRects()).forEach(function (r) {
          let el = document.createElement('div'); el.className = 'cc-selection'; el.style.background = rgba(t.number, .3);
          el.style.cssText += ';left:' + (r.left - area.left) / zoom + 'px;top:' + (r.top - area.top) / zoom + 'px;width:' + r.width / zoom + 'px;height:' + r.height / zoom + 'px';
          marks.appendChild(el); selected.push(el);
        });
      }
      caret.hidden = !scene.animated || isPoster || !view.state.focused || !!view.state.selection || (!view.typing && Math.floor(time * 2) % 2 === 1);
      caret.style.left = (rect.left - area.left) / zoom + 'px'; caret.style.top = (rect.top - area.top) / zoom + 'px'; caret.style.height = rect.height / zoom + 'px';
      suggestion.hidden = !view.completion || isPoster;
      if (view.completion) {
        suggestionText.textContent = view.event.insert.split('\n')[0] || 'Insert remaining text';
        suggestion.style.left = suggestion.style.top = '0px';
        let menuWidth = suggestion.offsetWidth, menuHeight = suggestion.offsetHeight;
        suggestion.style.left = Math.max(0, Math.min(body.clientWidth - menuWidth - 4, (rect.left - area.left) / zoom)) + 'px';
        suggestion.style.top = Math.max(0, Math.min(body.clientHeight - menuHeight - 4, (rect.bottom - area.top) / zoom + 5)) + 'px';
      }
      window_.style.transform = poseStyle(view, false);
      placePointer(view, point, isPoster);
      window_.style.transform = poseStyle(view, true);
      window_.style.opacity = String((scene.entry === 'none' ? (view.opening > 0 ? 1 : 0) : view.opening) * (scene.exit === 'none' ? (view.closing < 1 ? 1 : 0) : 1 - view.closing));
      root.dataset.sceneAction = view.event ? view.event.action : 'hold';
      scrub.value = String(time); output.textContent = time.toFixed(1) + ' / ' + scene.duration.toFixed(1) + ' s';
      play.textContent = playing ? 'Pause' : 'Play'; play.setAttribute('aria-pressed', String(playing));
    }
    function layout() {
      if (disposed) return;
      window_.style.transform = 'none'; body.style.height = ''; codeEl.style.height = ''; gutter.style.height = '';
      source.style.transform = numberLines.style.transform = 'none';
      if (scene.animated) {
        let maxHeight = 0, caretWidth = parseFloat(getComputedStyle(caret).width) || 2;
        function measure(fs) {
          applyFs(fs); let fits = true; maxHeight = 0;
          documents.forEach(function (record, index) {
            restoreDocument(record); loadDocument(index);
            if (lineNums) numberLines.textContent = Array.from({ length: scene.docs[index].text.split('\n').length }, function (_, n) { return n + 1; }).join('\n');
            maxHeight = Math.max(maxHeight, codeEl.scrollHeight);
            if (overflowsX(1, caretWidth) || window_.scrollHeight > root.clientHeight - 112) fits = false;
          });
          return fits;
        }
        if (scene.scroll) measure(22 * IS);
        else {
          let lo = 0, hi = 26 * IS;
          while (hi - lo > .01) { let mid = (lo + hi) / 2; if (measure(mid)) lo = mid; else hi = mid; }
          measure(lo);
        }
        let minHeight = scene.events.some(function (event) { return event.action === 'complete'; }) ? 80 : 60;
        body.style.height = Math.max(minHeight, Math.min(maxHeight, root.clientHeight - 112 - header.offsetHeight)) + 'px';
        codeEl.style.height = gutter.style.height = '100%';
        currentDoc = -1;
      } else { fit(); }
      let smallText = !scene.scroll && parseFloat(codeEl.style.fontSize) < 7 * IS;
      warning.textContent = scene.warnings.join(' ') + (smallText ? ' Text is very small. Choose Scroll with the caret for a closer view.' : '');
      warning.hidden = !warning.textContent;
      poseFit = 1;
      if (root.clientWidth && (scene.rotate || scene.tiltX || scene.tiltY)) {
        for (let attempt = 0; attempt < 3; attempt++) {
          window_.style.transform = poseStyle({ opening: 1, closing: 0 }, false);
          let stage = root.getBoundingClientRect(), posed = window_.getBoundingClientRect();
          let cx = stage.left + stage.width / 2, cy = stage.top + stage.height / 2;
          let fitScale = Math.min(1, stage.width * .45 / Math.max(cx - posed.left, posed.right - cx, 1), stage.height * .43 / Math.max(cy - posed.top, posed.bottom - cy, 1));
          poseFit *= fitScale;
        }
      }
      paint(time, poster);
    }
    function stop() { playing = false; if (frame && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame); }
    function tick(now) {
      if (disposed || !root.isConnected) { destroy(); return; }
      if (!playing) return;
      if (!clock.__lollyFrameDriven && !exportMode) {
        let next = Math.min(scene.duration, time + (now - lastNow) / 1000);
        if (next >= scene.duration) stop();
        paint(next, false);
      }
      lastNow = now;
      if (playing) frame = requestAnimationFrame(tick);
    }
    function destroy() { disposed = true; stop(); if (observer) observer.disconnect(); if (removal) removal.disconnect(); }
    play.addEventListener('click', function () {
      if (playing) stop();
      else { if (poster || time >= scene.duration) time = 0; playing = true; lastNow = performance.now(); frame = requestAnimationFrame(tick); }
      paint(time, false);
    });
    scrub.addEventListener('input', function () { stop(); paint(Number(scrub.value), false); });
    clock.__lollyFrameRender = function (fraction, clipSeconds) {
      let still = exportMode === 'still' || (!clipSeconds && exportMode !== 'motion');
      let span = exportMode === 'motion' ? (clipSeconds || exportLength) * scene.duration / exportLength : scene.duration;
      paint(still ? (scene.posterAt < 0 ? scene.poster : scene.posterAt) : clamp(fraction) * span, still);
    };
    root.__snippet = {
      animated: scene.animated, duration: scene.duration,
      seek: function (seconds) { stop(); paint(seconds, false); },
      prepareExport: function (motion, length) {
        if (motion && scene.warnings.length) throw new Error(scene.warnings.join(' '));
        documents.forEach(restoreDocument);
        currentDoc = -1;
        saved = { time: time, playing: playing, poster: poster }; stop(); exportMode = motion ? 'motion' : 'still';
        exportLength = Number.isFinite(length) && length > 0 ? length : scene.duration;
        paint(motion ? 0 : (scene.posterAt < 0 ? scene.poster : scene.posterAt), !motion);
      },
      finishExport: function () {
        exportMode = '';
        if (!saved) return;
        let previous = saved; saved = null; playing = previous.playing;
        paint(previous.time, previous.poster);
        if (playing) { lastNow = performance.now(); frame = requestAnimationFrame(tick); }
      },
      destroy: destroy
    };
    {
      root.setAttribute('data-lolly-player', '');
      root.__lollyPlayback = {
        animated: scene.animated, duration: scene.duration, poster: scene.posterAt < 0 ? scene.poster : scene.posterAt,
        seek: root.__snippet.seek,
        portableMarkup: function () {
          if (!scene.animated) return authoredMarkup;
          documents.forEach(restoreDocument);
          var copy = document.createElement('template'); copy.innerHTML = authoredMarkup;
          var portableScene = Object.assign({}, scene, { docs: scene.docs.map(function (doc, i) {
            return Object.assign({}, doc, { html: documents[i].element.innerHTML });
          }) });
          copy.content.querySelector('.cc-scene').textContent = JSON.stringify(portableScene).replace(/</g, '\\u003c');
          currentDoc = -1; paint(time, poster);
          return copy.innerHTML;
        }
      };
    }
    layout();
    if (typeof ResizeObserver !== 'undefined') { observer = new ResizeObserver(layout); observer.observe(root); }
    if (typeof MutationObserver !== 'undefined') { removal = new MutationObserver(function () { if (!root.isConnected) destroy(); }); removal.observe(root.ownerDocument, { childList: true, subtree: true }); }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (!disposed && root.isConnected) layout(); });
  }

}());
