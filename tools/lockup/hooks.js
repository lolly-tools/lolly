/**
 * Lockup tool hooks.
 *
 * Live preview: browser-rendered text inside a <foreignObject>.
 * SVG export:   outlined paths via host.text.toPath (HarfBuzz WASM).
 *
 * The SUSE brand font encodes two logo-mark ligatures as emoji sequences:
 *   🦎💚🐧  →  dark-on-light variant  (use on light backgrounds)
 *   🐧💚🦎  →  light-on-dark variant  (use on dark backgrounds)
 * The logo row switches automatically based on background luminance.
 *
 * All text — logo mark, SUSE wordmark, product name, configuration — flows as
 * a single inline token stream.  At wide lineWidth the result is one horizontal
 * line; at narrow lineWidth the tokens wrap naturally (stacked).
 *
 * Font weights:
 *   logo + SUSE   → ExtraBold (800)
 *   product name  → Medium (500)
 *   configuration → Light (300)
 */

const CANVAS_W  = 256;
const PADDING_H = 60;
const PADDING_V = 48;
const FONT_SIZE = 108;
const LINE_H    = 130;  /* ~1.2× font-size — brand-spec line spacing */
const SPACE_PX  = FONT_SIZE * 0.28; /* word-space estimate */

/* Dark-on-light / light-on-dark logo ligature sequences */
const LOGO_FOR_LIGHT_BG = '\u{1F98E}\u{1F49A}\u{1F427}'; /* 🦎💚🐧 */
const LOGO_FOR_DARK_BG  = '\u{1F427}\u{1F49A}\u{1F98E}'; /* 🐧💚🦎 */

/* Approximate char-width / font-size per weight — preview estimation only. */
const ASPECT = { 800: 0.65, 500: 0.56, 300: 0.52 };

const FONT_URLS = {
  extrabold:  '/tools/lockup/src/fonts/otf/SUSE-ExtraBold.otf',
  bold:       '/tools/lockup/src/fonts/otf/SUSE-Bold.otf',
  medium:     '/tools/lockup/src/fonts/otf/SUSE-Medium.otf',
  light:      '/tools/lockup/src/fonts/otf/SUSE-Light.otf',
  extralight: '/tools/lockup/src/fonts/otf/SUSE-ExtraLight.otf',
  thin:       '/tools/lockup/src/fonts/otf/SUSE-Thin.otf',
};

let _lastValues          = { name: '', config: '', color: '#0c322c', background: '#ffffff' };
let _lastSolidBackground = '#ffffff'; /* last valid hex bg — preserves logo choice when transparent */
let _savedViewBox        = null;
let _savedWidth          = null;

// ── Luminance ────────────────────────────────────────────────────────────────

/**
 * WCAG 2.1 relative luminance of a hex color.
 * Returns a value in [0, 1] where 0 = black, 1 = white.
 */
function relativeLuminance(hex) {
  if (!hex || !hex.startsWith('#') || hex.length < 7) return 1;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const lin = c => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/**
 * Choose the correct logo ligature for a background color.
 * When background is transparent or unreadable, the last solid background
 * is used to preserve the logo choice. Defaults to 🦎💚🐧 (light-bg variant).
 */
function logoForBg(bgColor) {
  if (bgColor && bgColor.startsWith('#') && bgColor.length >= 7) {
    _lastSolidBackground = bgColor;
  }
  return relativeLuminance(_lastSolidBackground) > 0.35 ? LOGO_FOR_LIGHT_BG : LOGO_FOR_DARK_BG;
}

// ── Layout ───────────────────────────────────────────────────────────────────

/**
 * Build visual lines from an inline token stream.
 *
 * Each returned line is an array of segments.  All text — logo, SUSE wordmark,
 * product name words, config words — is treated as a single flow so that a wide
 * lineWidth produces one horizontal line and a narrow lineWidth stacks naturally.
 *
 * Segment shape:
 *   { text, weight, fontKey, fill, inputId?,
 *     isLogo?, logoEmoji?, logoFill? }
 *
 * @param {string} name      Product name (may be multi-word).
 * @param {string} config    Configuration string (may be multi-word).
 * @param {string} fill      Text color.
 * @param {string} bgColor   Background color (drives logo ligature choice).
 * @param {number} maxPixels Target line width in px (the lineWidth input value).
 * @param {boolean} oneColor When true the logo mark uses the same fill as text.
 */
function buildLines(name, config, fill, bgColor, maxPixels, oneColor) {
  const logo     = logoForBg(bgColor);
  const logoFill = oneColor ? fill : '#30ba78';

  /* Atomic word tokens in flow order */
  const tokens = [
    { isLogo: true, logoEmoji: logo, logoFill, fill,
      fontKey: 'bold', weight: 700,
      text: `${logo}  SUSE` },               /* treated as one unbreakable unit */
  ];
  for (const w of name.trim().split(/\s+/).filter(Boolean))
    tokens.push({ text: w, fontKey: 'medium', weight: 400, fill, inputId: 'name' });
  for (const w of config.trim().split(/\s+/).filter(Boolean))
    tokens.push({ text: w, fontKey: 'thin',   weight: 200, fill, inputId: 'config' });

  /* Pack tokens onto lines using pixel-width estimates */
  const contentW = Math.max(CANVAS_W, maxPixels) - 2 * PADDING_H;
  const lines    = [];
  let cur = [], curW = 0;

  for (const tok of tokens) {
    const tw = [...tok.text].length * (ASPECT[tok.weight] || 0.56) * FONT_SIZE;
    if (cur.length === 0) {
      cur.push(tok);
      curW = tw;
    } else if (curW + SPACE_PX + tw <= contentW) {
      cur.push(tok);
      curW += SPACE_PX + tw;
    } else {
      lines.push(cur);
      cur  = [tok];
      curW = tw;
    }
  }
  if (cur.length) lines.push(cur);

  return lines;
}

function computeSvgH(lineCount) {
  return 2 * PADDING_V + lineCount * LINE_H;
}

function computeSvgW(lines) {
  let maxEstW = 0;
  for (const line of lines) {
    let lw = 0;
    for (let j = 0; j < line.length; j++) {
      const seg = line[j];
      lw += (j > 0 ? SPACE_PX : 0) +
            [...seg.text].length * (ASPECT[seg.weight] || 0.56) * FONT_SIZE;
    }
    if (lw > maxEstW) maxEstW = lw;
  }
  return Math.max(CANVAS_W, Math.ceil(2 * PADDING_H + maxEstW));
}

// ── HTML preview builder ─────────────────────────────────────────────────────

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function updateLogoStyle(logoFill) {
  let el = document.getElementById('lockup-logo-style');
  if (!el) {
    el = document.createElement('style');
    el.id = 'lockup-logo-style';
    document.head.appendChild(el);
  }
  el.textContent = `.lockup-logo{color:${logoFill};}`;
}

/**
 * Render visual lines as HTML divs containing inline spans.
 * Each line is one <div>; segments within a line are <span> elements so that
 * mixed weights and colors stay on the same baseline.
 */
function buildHtmlLines(lines) {
  return lines.map(line => {
    const divStyle =
      `margin:0;font-family:'SUSE',sans-serif;font-size:${FONT_SIZE}px;` +
      `line-height:${LINE_H}px;overflow-wrap:break-word;` +
      `font-feature-settings:'liga' 1,'kern' 1;`;

    const inner = line.map((seg, j) => {
      if (seg.isLogo) {
        return (
          `<span class="lockup-logo" style="font-weight:${seg.weight};color:${seg.logoFill};">${esc(seg.logoEmoji)}</span>` +
          `<span class="logotext"    style="font-weight:${seg.weight};color:${seg.fill};">SUSE</span>`
        );
      }
      const space = j > 0 ? ' ' : '';
      const dci   = seg.inputId ? ` data-canvas-input="${seg.inputId}"` : '';
      return (
        `<span${dci} style="font-weight:${seg.weight};color:${seg.fill};">` +
        `${space}${esc(seg.text)}</span>`
      );
    }).join('');

    return `<div style="${divStyle}">${inner}</div>`;
  }).join('');
}

// ── SVG path generator (export only) ─────────────────────────────────────────

/**
 * Render each visual line as outlined SVG paths.
 * Segments within a line are laid out left-to-right using advanceWidth.
 */
async function generateSvgPaths(lines, host) {
  const halfLead = Math.round((LINE_H - FONT_SIZE) / 2);
  let maxRight = 0;
  const parts  = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const ty0  = PADDING_V + i * LINE_H + halfLead;
    let lineX  = PADDING_H;
    let ty     = null;  /* baseline offset resolved from first rendered glyph */

    for (let j = 0; j < line.length; j++) {
      const seg   = line[j];
      const space = j > 0 ? ' ' : '';  /* word-space before every token except first */

      if (seg.isLogo) {
        /* Shape logo mark and 'SUSE' separately so each can have its own fill. */
        const [rMark, rSUSE] = await Promise.all([
          host.text.toPath({ text: seg.logoEmoji, fontUrl: FONT_URLS[seg.fontKey], fontSize: FONT_SIZE }),
          host.text.toPath({ text: ' SUSE',       fontUrl: FONT_URLS[seg.fontKey], fontSize: FONT_SIZE }),
        ]);
        const { d: dMark, bbox: bMark, advanceWidth: advMark } = rMark;
        const { d: dSUSE, bbox: bSUSE, advanceWidth: advSUSE } = rSUSE;

        if (ty === null) {
          const yRef = bMark ?? bSUSE;
          if (yRef) ty = Math.round(ty0 - yRef.y1);
        }

        const tx = lineX;
        if (dMark) parts.push(`<path fill="${seg.logoFill}" d="${dMark}" transform="translate(${tx},${ty})"/>`);
        if (dSUSE) parts.push(`<path fill="${seg.fill}"     d="${dSUSE}" transform="translate(${tx + advMark},${ty})"/>`);

        lineX += (advMark || 0) + (advSUSE || 0);

        if (bSUSE) {
          const right = tx + advMark + bSUSE.x2;
          if (right > maxRight) maxRight = right;
        }
        continue;
      }

      const r = await host.text.toPath({
        text:     space + seg.text,
        fontUrl:  FONT_URLS[seg.fontKey],
        fontSize: FONT_SIZE,
      });
      if (!r?.d || !r?.bbox) {
        lineX += r?.advanceWidth || 0;
        continue;
      }

      if (ty === null) ty = Math.round(ty0 - r.bbox.y1);

      const tx    = lineX;
      const right = tx + r.bbox.x2;
      if (right > maxRight) maxRight = right;

      parts.push(`<path fill="${seg.fill}" d="${r.d}" transform="translate(${tx},${ty})"/>`);
      lineX += r.advanceWidth || (r.bbox.x2 - (r.bbox.x1 || 0));
    }
  }

  const exportW = Math.max(CANVAS_W, Math.ceil(maxRight + PADDING_H));
  return { svgPaths: parts.join('\n'), exportW };
}

// ── Canvas + export-dims sync ────────────────────────────────────────────────

/*
 * Only the canvas WIDTH is driven here.  Height is handled by the inline RAF
 * script in template.html which reads the SVG's actual rendered bounding box —
 * letting the browser be the single source of truth for height avoids
 * overwriting a user-set export-height dimension on every keystroke.
 */
function syncDims(svgW, svgH) {
  const canvas = document.getElementById('tool-canvas');
  if (canvas && parseInt(canvas.style.width, 10) !== svgW) {
    canvas.style.width = svgW + 'px';
    canvas.dispatchEvent(new CustomEvent('canvas-resize'));
  }
  const wIn = document.querySelector('[data-action="export-width"]');
  const hIn = document.querySelector('[data-action="export-height"]');
  if (wIn) wIn.value = svgW;
  if (hIn) hIn.value = svgH;
}

// ── Hooks ────────────────────────────────────────────────────────────────────

async function onInit({ model, host }) {
  const v = Object.fromEntries(model.map(i => [i.id, i.value ?? '']));
  _lastValues = {
    name:       v.name       || '',
    config:     v.config     || '',
    color:      v.color      || '#0c322c',
    background: v.background || '#ffffff',
    lineWidth:  v.lineWidth  || '800',
    oneColor:   v.oneColor === true || v.oneColor === 'true',
  };

  /* Seed so the logo choice is correct on the very first render. */
  if (_lastValues.background.startsWith('#')) {
    _lastSolidBackground = _lastValues.background;
  }

  if (!document.getElementById('lockup-font-face')) {
    const style = document.createElement('style');
    style.id = 'lockup-font-face';
    style.textContent =
      "@font-face{font-family:'SUSE';" +
      "src:url('/tools/lockup/src/fonts/webfonts/SUSE[wght].woff2') format('woff2-variations');" +
      "font-weight:100 900;font-display:block;}";
    document.head.appendChild(style);
  }

  Object.values(FONT_URLS).forEach(url => host.text.preload(url).catch(() => {}));

  const targetW = parseInt(v.lineWidth, 10) || 800;
  const lines   = buildLines(
    _lastValues.name, _lastValues.config,
    _lastValues.color, _lastValues.background,
    targetW, _lastValues.oneColor,
  );
  const svgW = computeSvgW(lines);
  const svgH = computeSvgH(lines.length);

  setTimeout(() => {
    syncDims(svgW, svgH);
    updateLogoStyle(lines[0]?.[0]?.logoFill ?? '#30ba78');
  }, 0);

  return {
    htmlLines:  buildHtmlLines(lines),
    svgPaths:   '',
    svgH,
    svgW,
    background: _lastValues.background,
    color:      _lastValues.color,
  };
}

async function onInput({ id, value, model }) {
  const v = Object.fromEntries(model.map(i => [i.id, i.value ?? '']));
  _lastValues = {
    name:       v.name       || '',
    config:     v.config     || '',
    color:      v.color      || '#0c322c',
    background: v.background || '#ffffff',
    lineWidth:  v.lineWidth  || '800',
    oneColor:   v.oneColor === true || v.oneColor === 'true',
  };

  const targetW = parseInt(v.lineWidth, 10) || 800;
  const lines   = buildLines(
    _lastValues.name, _lastValues.config,
    _lastValues.color, _lastValues.background,
    targetW, _lastValues.oneColor,
  );
  const svgW = computeSvgW(lines);
  const svgH = computeSvgH(lines.length);

  syncDims(svgW, svgH);
  updateLogoStyle(lines[0]?.[0]?.logoFill ?? '#30ba78');

  return {
    htmlLines:  buildHtmlLines(lines),
    svgPaths:   '',
    svgH,
    svgW,
    background: _lastValues.background,
    color:      _lastValues.color,
  };
}

async function beforeExport({ node, format, host }) {
  if (format !== 'svg') return;

  const targetW = parseInt(_lastValues.lineWidth, 10) || 800;
  const lines   = buildLines(
    _lastValues.name, _lastValues.config,
    _lastValues.color, _lastValues.background,
    targetW, _lastValues.oneColor,
  );
  const { svgPaths: paths, exportW } = await generateSvgPaths(lines, host);

  const fo      = node.querySelector('#lockup-fo');
  const pathsEl = node.querySelector('#lockup-paths');
  const svgEl   = node.querySelector('#lockup-svg');

  if (fo)      fo.style.display = 'none';
  if (pathsEl) pathsEl.innerHTML = paths;

  if (svgEl) {
    _savedViewBox = svgEl.getAttribute('viewBox');
    _savedWidth   = svgEl.getAttribute('width');
    const h = parseInt(svgEl.getAttribute('height'), 10) || computeSvgH(lines.length);
    svgEl.setAttribute('width',   exportW);
    svgEl.setAttribute('viewBox', `0 0 ${exportW} ${h}`);
  }
}

async function afterExport({ node, format }) {
  if (format !== 'svg') return;

  const fo      = node.querySelector('#lockup-fo');
  const pathsEl = node.querySelector('#lockup-paths');
  const svgEl   = node.querySelector('#lockup-svg');

  if (fo)      fo.style.display = '';
  if (pathsEl) pathsEl.innerHTML = '';

  if (svgEl && _savedViewBox != null) {
    svgEl.setAttribute('viewBox', _savedViewBox);
    svgEl.setAttribute('width',   _savedWidth);
    _savedViewBox = null;
    _savedWidth   = null;
  }
}
