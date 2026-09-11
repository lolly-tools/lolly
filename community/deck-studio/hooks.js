// Deck Studio - turn a simple slide spec (the block builder OR a pasted JSON deck) into
// ONE px-positioned element list per slide, then render that same list two ways:
//   • an HTML preview (a [data-pdf-page] section per slide) for the canvas + PDF/PNG export
//   • a native PowerPoint model in <script data-pptx-deck> (editable text/tables/theme)
// Because both outputs derive from the SAME element list, the preview can't drift from the
// .pptx. The engine's export-pptx bridge lowers the model (px→EMU, css→hex); this hook
// never touches the DOM. Charts/diagrams are composed from OTHER Lolly tools: a tool link
// dropped into a `visual` asset slot is resolved to an image URL by the runtime before
// onInit, so we just read its .url.

// ─── tiny helpers ─────────────────────────────────────────────────────────────
function str(v) { return v == null ? '' : String(v); }
function htmlEsc(s) { return str(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
// JSON safe to drop verbatim into <script type="application/json">: kill the only
// tag-closing sequence ("</script") by escaping '<', plus the JS line terminators.
function safeJson(obj) {
  return JSON.stringify(obj).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}
function isHexish(s) { return typeof s === 'string' && /^#?[0-9a-fA-F]{3,8}$/.test(s.trim()); }
// Normalise a hex colour to always carry '#': the engine's deckColor accepts bare hex but
// a CSS `background:ff0000` in the preview is invalid, so the two would drift. '#' in front
// makes both agree. Idempotent for values that already have one.
function normHex(s) { s = str(s).trim(); return /^[0-9a-fA-F]{3,8}$/.test(s) ? '#' + s : s; }

var SIZES = { wide: [1280, 720], classic: [1280, 960], square: [1080, 1080], story: [720, 1280] };

// ─── brand theme (host.tokens → hex colours + font) ───────────────────────────
// colours: swatch.value is ALWAYS hex; read by path. font: resolve('{font.brand}').
// Everything guarded - headless/older shells and the blank profile just get fallbacks.
// The extended hues drive the brand-template slide designs (the segmented footer
// bar, hero backgrounds, card wells, arrow bullets). A pack that exposes named
// brand colours (color.brand.*, color.ramp.*) gets them verbatim; any other pack
// derives the tints from its own primary/secondary so nothing off-brand leaks in.
function mixHex(a, b, t) {
  var pa = hexToRgb(a), pb = hexToRgb(b);
  if (!pa || !pb) return a;
  function ch(i) { return Math.round(pa[i] + (pb[i] - pa[i]) * t); }
  function h2(v) { v = Math.max(0, Math.min(255, v)).toString(16); return v.length < 2 ? '0' + v : v; }
  return '#' + h2(ch(0)) + h2(ch(1)) + h2(ch(2));
}
async function readBrandTheme() {
  var T = {
    // legacy keys (accent-override plumbing + pptxTheme read these)
    primary: '#0c322c', accent: '#30ba78', dark: '#0c322c', light: '#ffffff',
    // template palette
    ink: '#0c322c', green: '#30ba78', mint: '#90ebcd', blue: '#2453ff', orange: '#fe7c3f',
    card: '#efefef', edge: '#dcdbdc', paleA: '#eafaf8', paleB: '#c0efde', pine2: '#01564a',
    step1: '#42d29f', step2: '#83e1be', step3: '#c0efde',
    font: 'SUSE', mono: 'SUSE Mono',
  };
  try {
    if (typeof host === 'undefined' || !host || !host.tokens) return T;
    if (host.tokens.colors) {
      var byPath = {};
      var sw = (await host.tokens.colors({ theme: 'light' })) || [];
      for (var i = 0; i < sw.length; i++) { var s = sw[i]; if (s && typeof s.value === 'string') byPath[s.path] = s.value; }
      function pick(paths, cur) { for (var k = 0; k < paths.length; k++) if (isHexish(byPath[paths[k]])) return normHex(byPath[paths[k]]); return cur; }
      T.primary = pick(['color.semantic.primary'], T.primary);
      T.accent = pick(['color.semantic.secondary'], T.accent);
      T.light = pick(['color.semantic.surface'], T.light);
      T.ink = pick(['color.semantic.text', 'color.semantic.primary'], T.ink);
      T.dark = T.ink;
      T.green = T.accent;
      T.edge = pick(['color.semantic.edge'], T.edge);
      // Named brand hues; note which were REAL so the rest can derive on-brand.
      var named = {
        mint: ['color.brand.mint'], blue: ['color.brand.waterhole'], orange: ['color.brand.persimmon'],
        card: ['color.brand.fog'], pine2: ['color.ramp.pine.2'], paleA: ['color.ramp.pine.8'],
        paleB: ['color.ramp.jungle.7'], step1: ['color.ramp.jungle.5'], step2: ['color.ramp.jungle.6'], step3: ['color.ramp.jungle.7'],
      };
      var found = {};
      for (var key in named) { var v = pick(named[key], ''); if (v) { T[key] = v; found[key] = 1; } }
      var branded = found.mint || found.blue || found.orange;
      if (!branded) {
        // Two-colour brand: tint the design out of primary + secondary.
        T.mint = mixHex(T.green, '#ffffff', 0.6);
        T.blue = T.primary;
        T.orange = mixHex(T.green, T.ink, 0.45);
      }
      if (!found.card) T.card = '#efefef';
      if (!found.pine2) T.pine2 = mixHex(T.ink, T.green, 0.28);
      if (!found.paleA) T.paleA = mixHex(T.green, '#ffffff', 0.92);
      if (!found.paleB) T.paleB = mixHex(T.green, '#ffffff', 0.72);
      if (!found.step1) T.step1 = mixHex(T.green, '#ffffff', 0.16);
      if (!found.step2) T.step2 = mixHex(T.green, '#ffffff', 0.45);
      if (!found.step3) T.step3 = mixHex(T.green, '#ffffff', 0.72);
    }
    if (host.tokens.resolve) {
      var valid = function (v) { return typeof v === 'string' && v && v.indexOf('{') !== 0; };
      var f = await host.tokens.resolve('{font.brand}'); if (valid(f)) { T.font = f; T.mono = f; }
      var fm = await host.tokens.resolve('{font.mono}'); if (valid(fm)) T.mono = fm;
    }
  } catch (e) { /* keep fallbacks */ }
  return T;
}
// The DrawingML theme (values) the engine threads into the .pptx - mirrors the SUSE
// template's own scheme shape: dk1 ink, accent1 green, accent3 blue, accent4 orange,
// accent6 mint, lt2 the card grey.
function pptxTheme(T) {
  return {
    name: 'Brand',
    colors: { dk1: T.ink, lt1: T.light, dk2: T.pine2, lt2: T.card, accent1: T.green, accent2: T.ink, accent3: T.blue, accent4: T.orange, accent5: T.blue, accent6: T.mint, hlink: T.green },
    fonts: { major: T.font, minor: T.font },
  };
}

// ─── brand logo (host.assets - pick light/dark + colour/mono variant per slide) ─
// The active brand's logo is tagged in the catalog: logo + on-light|on-dark + optional
// mono + horizontal|vertical. We query by those TAGS (portable across brands that follow
// the convention) and identify the colour vs mono variant by id (the mono one carries the
// `mono` tag, so it's the query result WITH it; the colour one is the other). Blank brands
// with no logo asset just get nothing (guarded everywhere).
// A logo SVG's true width/height ratio, read from its viewBox - the catalog carries no
// dimensions, so a fallback ratio would clip a wide lockup. Handles a data: URI (what
// get() returns headless) and a plain url (fetched in the browser).
async function svgAspect(url) {
  try {
    var svg = '';
    if (url.indexOf('data:') === 0) {
      var comma = url.indexOf(','), meta = url.slice(5, comma), data = url.slice(comma + 1);
      svg = /base64/i.test(meta) ? (typeof atob !== 'undefined' ? atob(data) : '') : decodeURIComponent(data);
    } else if (host.assets && host.assets.bytes) {
      // Portable read (v1.183): the same call answers in a page, a Worker and a headless shell.
      svg = new TextDecoder().decode(await host.assets.bytes(url));
    } else if (typeof fetch !== 'undefined') {
      svg = await (await fetch(url)).text();
    }
    var vb = /viewBox\s*=\s*["']([^"']+)["']/i.exec(svg);
    if (vb) { var p = vb[1].trim().split(/[\s,]+/); var w = +p[2], h = +p[3]; if (w > 0 && h > 0) return w / h; }
  } catch (e) { /* fall back to metadata / default */ }
  return null;
}
async function resolveLogos() {
  var out = { onLight: { color: null, mono: null }, onDark: { color: null, mono: null } };
  try {
    if (typeof host === 'undefined' || !host || !host.assets || !host.assets.query) return out;
    async function q(tags) { try { return (await host.assets.query({ type: 'vector', tags: tags })) || []; } catch (e) { return []; } }
    // query() results may carry no url (some shells return metadata only - the real url
    // comes from get()). Always resolve the chosen id to a fetchable url + its real aspect.
    async function resolve(ref) {
      if (!ref) return null;
      var url = ref.url, w = ref.width, h = ref.height;
      if ((!url || !w) && host.assets.get) {
        try { var full = await host.assets.get(ref.id); if (full) { url = full.url || url; w = full.width || w; h = full.height || h; } } catch (e) { /* keep what we have */ }
      }
      if (typeof url !== 'string' || !url) return null;
      var asp = (await svgAspect(url)) || (w && h ? w / h : 3.4);
      return { url: url, aspect: asp };
    }
    var sides = [['onLight', 'on-light'], ['onDark', 'on-dark']];
    for (var i = 0; i < sides.length; i++) {
      var key = sides[i][0], on = sides[i][1];
      var all = await q(['logo', on, 'horizontal']);
      if (!all.length) all = await q(['logo', on]);
      var monoList = await q(['logo', on, 'mono', 'horizontal']);
      if (!monoList.length) monoList = await q(['logo', on, 'mono']);
      var mono = monoList[0] || null;
      var color = null;
      for (var k = 0; k < all.length; k++) { if (!mono || all[k].id !== mono.id) { color = all[k]; break; } }
      if (!color) color = all[0] || null;
      out[key].color = await resolve(color);
      out[key].mono = (await resolve(mono)) || out[key].color;
    }
  } catch (e) { /* no logos - decks just render without one */ }
  return out;
}
function pickLogo(logos, darkBg, mono) {
  if (!logos) return null;
  var g = darkBg ? logos.onDark : logos.onLight;
  return mono ? (g.mono || g.color) : (g.color || g.mono);
}

// Luminance of a slide background (solid or the first gradient stop) → is it dark?
function hexToRgb(s) {
  s = str(s).trim();
  var m = /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i.exec(s);
  if (m) return [+m[1], +m[2], +m[3]];
  s = s.replace('#', '');
  if (/^[0-9a-fA-F]{3}$/.test(s)) s = s.split('').map(function (c) { return c + c; }).join('');
  if (/^[0-9a-fA-F]{6,8}$/.test(s)) return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
  return null;
}
function bgIsDark(bg) {
  var c = typeof bg === 'string' ? bg : (bg && bg.grad && bg.grad.stops && bg.grad.stops[0] && bg.grad.stops[0].color);
  var rgb = hexToRgb(c);
  if (!rgb) return false;
  return (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) < 140;
}

// ─── input → slide-content[] ──────────────────────────────────────────────────
// slide-content: { layout, title, subtitle, body, table?, image?, accent?, notes }
function refUrl(r) { return r && typeof r === 'object' && typeof r.url === 'string' ? r.url : (typeof r === 'string' ? r : ''); }
var LAYOUTS = { title: 1, section: 1, agenda: 1, content: 1, 'two-col': 1, split: 1, table: 1, visual: 1, 'full-image': 1, quote: 1, 'big-number': 1, 'main-point': 1, 'one-column': 1 };
var LOGO_MODES = { auto: 1, mono: 1, off: 1 };
function normLogo(v) { v = str(v); return LOGO_MODES[v] ? v : 'auto'; }
function normLayout(v) { v = str(v); return LAYOUTS[v] ? v : 'content'; }

// Pull a Markdown table and/or image out of a body blob (what mdPaste dumps in as raw
// text) so they render as a real table / picture instead of literal text. Returns the
// remaining prose as `text`, the table rows as `tableSrc`, and the first image url.
function splitMarkdownBody(body) {
  var lines = str(body).replace(/\r/g, '').split('\n');
  var text = [], pipes = [], image = '';
  for (var i = 0; i < lines.length; i++) {
    var l = lines[i], t = l.trim();
    var im = /!\[[^\]]*\]\(\s*([^)\s]+)[^)]*\)/.exec(t);
    if (im && !image) {
      image = im[1];
      var rest = t.replace(/!\[[^\]]*\]\([^)]*\)/, '').trim();
      if (rest) text.push(rest);
      continue;
    }
    if (t.indexOf('|') !== -1) { pipes.push(l); continue; }
    text.push(l);
  }
  var tableSrc = pipes.length >= 2 ? pipes.join('\n') : '';
  if (!tableSrc && pipes.length) text = text.concat(pipes); // a lone pipe line is just prose
  return { text: text.join('\n'), tableSrc: tableSrc, image: image };
}
// Given a base layout + what a body actually contains, pick the layout that renders it.
// Only promotes the DEFAULT 'content' layout (an explicit choice is always respected).
function autoLayout(layout, md, image) {
  if (layout !== 'content') return layout;
  if (md.tableSrc) return 'table';
  if (image) return md.text.trim() ? 'split' : 'visual';
  return 'content';
}

function blockToContent(row) {
  row = row || {};
  var md = splitMarkdownBody(row.body);
  var image = refUrl(row.visual || row.image) || md.image;
  return {
    layout: autoLayout(normLayout(row.layout), md, image),
    title: str(row.heading || row.title),
    subtitle: str(row.subtitle),
    body: md.text,
    tableSrc: str(row.data) || md.tableSrc,
    image: image,
    accent: isHexish(row.accent) ? normHex(row.accent) : '',
    logo: normLogo(row.logo),
    notes: str(row.notes),
  };
}
// A pasted JSON deck. Accepts { slides:[…] } or a bare array. Each slide mirrors the
// block fields; `bullets` (array) or `body` (string) both feed the body; `table` can be
// { headers, rows } or a CSV/markdown string; `image` is a url/data-uri.
function specToContent(slide) {
  slide = slide || {};
  var body = slide.body;
  if (Array.isArray(slide.bullets)) body = slide.bullets.map(function (b) { return str(b); }).join('\n');
  var md = splitMarkdownBody(body);
  var image = str(slide.image || slide.visual) || md.image;
  var tableSrc = typeof slide.table === 'string' ? slide.table : md.tableSrc;
  return {
    layout: autoLayout(normLayout(slide.layout), md, image),
    title: str(slide.title || slide.heading),
    subtitle: str(slide.subtitle),
    body: md.text,
    tableSrc: tableSrc,
    tableObj: slide.table && typeof slide.table === 'object' ? slide.table : null,
    image: image,
    accent: isHexish(slide.accent) ? normHex(slide.accent) : '',
    logo: normLogo(slide.logo),
    notes: str(slide.notes),
  };
}
// One Markdown chunk (one slide) → slide-content. First heading = title, a second
// heading = subtitle, the rest is the body (bullets + any table/image are pulled out).
// A trailing `<!-- notes: … -->` comment (the Marp presenter-note convention, and what
// the engine's deckToMarkdown writes) becomes the slide's speaker notes and is removed
// from the body first, so it never shows up as a bullet.
function mdChunkToContent(chunk) {
  var notes = [];
  var src = str(chunk).replace(/<!--\s*notes\s*:([\s\S]*?)-->/gi, function (m, body) {
    var t = str(body).trim();
    if (t) notes.push(t);
    return '';
  });
  var lines = src.split('\n');
  var title = '', subtitle = '', bodyLines = [];
  for (var i = 0; i < lines.length; i++) {
    var l = lines[i], t = l.trim();
    var h = /^#{1,6}\s+(.*)$/.exec(t);
    if (h) {
      var htext = h[1].replace(/#+\s*$/, '').trim();
      if (!title) title = htext;
      else if (!subtitle) subtitle = htext;
      else bodyLines.push(l);
    } else bodyLines.push(l);
  }
  var md = splitMarkdownBody(bodyLines.join('\n'));
  return {
    layout: autoLayout('content', md, md.image),
    title: title, subtitle: subtitle,
    body: md.text, tableSrc: md.tableSrc, image: md.image,
    accent: '', logo: 'auto', notes: notes.join('\n'),
  };
}
// A whole Markdown deck → slides. Splits on `---` slide breaks (Marp) when present,
// else before each top-level heading. Strips leading YAML/`---` frontmatter first.
function parseMarkdownDeck(text) {
  text = str(text).replace(/\r/g, '');
  text = text.replace(/^\s*---\n[\s\S]*?\n---\s*(\n|$)/, ''); // frontmatter
  var chunks;
  if (/\n-{3,}[ \t]*(\n|$)/.test(text)) {
    chunks = text.split(/\n-{3,}[ \t]*(?:\n|$)/);
  } else {
    chunks = [];
    var cur = '', lines = text.split('\n');
    for (var i = 0; i < lines.length; i++) {
      if (/^#{1,2}\s+/.test(lines[i]) && cur.trim()) { chunks.push(cur); cur = ''; }
      cur += lines[i] + '\n';
    }
    if (cur.trim()) chunks.push(cur);
  }
  var slides = [];
  for (var c = 0; c < chunks.length; c++) {
    if (str(chunks[c]).trim()) slides.push(mdChunkToContent(chunks[c]));
  }
  return slides.length ? slides : null;
}
// The `spec` field accepts EITHER a JSON deck OR raw Markdown. JSON wins when the text
// opens with { or [; otherwise it's parsed as a Markdown deck.
function parseSpec(specStr) {
  var s = str(specStr).trim();
  if (!s) return null;
  if (s.charAt(0) === '{' || s.charAt(0) === '[') {
    try {
      var doc = JSON.parse(s);
      var arr = Array.isArray(doc) ? doc : (doc && Array.isArray(doc.slides) ? doc.slides : null);
      if (arr && arr.length) return { slides: arr.map(specToContent), size: doc && !Array.isArray(doc) ? str(doc.size) : '' };
    } catch (e) { /* not JSON after all - fall through to Markdown */ }
  }
  var md = parseMarkdownDeck(s);
  return md ? { slides: md, size: '' } : null;
}
function slidesFromInputs(model) {
  var spec = null, deck = [], size = '';
  for (var i = 0; i < model.length; i++) {
    var it = model[i];
    if (it.id === 'spec') spec = it.value;
    else if (it.id === 'deck') deck = Array.isArray(it.value) ? it.value : [];
    else if (it.id === 'size') size = str(it.value);
  }
  var parsed = parseSpec(spec);
  if (parsed) return { slides: parsed.slides, size: parsed.size || size };
  return { slides: deck.map(blockToContent), size: size };
}

// ─── inline text → runs (**bold** *italic* __underline__ ~~strike~~) ──────────
function parseRuns(text, base) {
  text = str(text);
  var runs = [];
  var re = /(\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|\*[^*]+\*)/g;
  var last = 0, m;
  function push(t, style) { if (!t) return; var r = { text: t, sizePt: base.sizePt, color: base.color, font: base.font }; if (style) r[style] = true; runs.push(r); }
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) push(text.slice(last, m.index));
    var tok = m[0];
    if (tok.slice(0, 2) === '**') push(tok.slice(2, -2), 'bold');
    else if (tok.slice(0, 2) === '__') push(tok.slice(2, -2), 'underline');
    else if (tok.slice(0, 2) === '~~') push(tok.slice(2, -2), 'strike');
    else push(tok.slice(1, -1), 'italic');
    last = re.lastIndex;
  }
  if (last < text.length) push(text.slice(last));
  if (!runs.length) push(text || ' ');
  return runs;
}
// Body → paragraphs. Leading spaces (2 per level) = indent; a leading -/*/• = bullet.
function parseBody(body, opt) {
  opt = opt || {};
  var lines = str(body).replace(/\r/g, '').split('\n');
  var paras = [];
  for (var i = 0; i < lines.length; i++) {
    var raw = lines[i].replace(/\t/g, '  '); // count a leading tab as one indent level
    if (!raw.trim()) continue;
    var indent = (raw.match(/^ */)[0] || '').length;
    var level = Math.min(4, Math.floor(indent / 2));
    var t = raw.trim();
    var isBul = /^[-*•]\s+/.test(t);
    if (isBul) t = t.replace(/^[-*•]\s+/, '');
    var sizePt = opt.sizePt || 18;
    if (level > 0) sizePt = Math.max(12, Math.round(sizePt - level * 2));
    // Template list style: EVERY body line is a green-arrow bullet ("one line per
    // bullet" is the input contract). bullets:false (quote fallbacks) opts out.
    var bul = opt.bullets !== false;
    var para = {
      level: level,
      // Brand-template list style: green arrow markers (the SUSE typeface's
      // directional arrow), not round dots.
      bullet: bul ? { char: '→' } : false,
      runs: parseRuns(t, { sizePt: sizePt, color: opt.color, font: opt.font }),
    };
    if (bul && opt.bulletColor) para.bulletColor = opt.bulletColor;
    paras.push(para);
  }
  return paras;
}

// ─── table source (CSV or Markdown pipe) → { headers, rows } ──────────────────
// Strip inline-markdown emphasis markers (table cells render as plain text, so a raw
// **Total** would otherwise show its asterisks).
function stripInlineMd(s) {
  return str(s).replace(/\*\*(.+?)\*\*/g, '$1').replace(/__(.+?)__/g, '$1').replace(/~~(.+?)~~/g, '$1').replace(/\*(.+?)\*/g, '$1');
}
function splitCsvLine(line) { return line.split(',').map(function (c) { return c.trim(); }); }
function parseTableSrc(src, obj) {
  if (obj && Array.isArray(obj.rows)) {
    return { headers: Array.isArray(obj.headers) ? obj.headers.map(str) : null, rows: obj.rows.map(function (r) { return (Array.isArray(r) ? r : [r]).map(str); }) };
  }
  var lines = str(src).replace(/\r/g, '').split('\n').filter(function (l) { return l.trim(); });
  if (!lines.length) return null;
  var pipe = lines[0].indexOf('|') !== -1;
  var rows = [];
  for (var i = 0; i < lines.length; i++) {
    var l = lines[i];
    if (pipe) {
      // Only the SECOND line can be a header/body separator - an all-dash line elsewhere is data.
      if (i === 1 && /^\s*\|?[\s:|-]+\|?\s*$/.test(l) && /-/.test(l)) continue;
      var cells = l.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map(function (c) { return c.trim(); });
      rows.push(cells);
    } else {
      rows.push(splitCsvLine(l));
    }
  }
  if (!rows.length) return null;
  return { headers: rows[0], rows: rows.slice(1) };
}

// ─── layout engine: slide-content → { bg, elements[] } (px in the W×H space) ──
function textEl(x, y, w, h, paras, anchor, align) {
  if (align) for (var i = 0; i < paras.length; i++) if (!paras[i].align) paras[i].align = align;
  return { t: 'text', x: x, y: y, w: w, h: h, anchor: anchor || 't', paras: paras };
}
function runsOf(text, sizePt, color, font, extra) {
  var r = { text: str(text) || ' ', sizePt: sizePt, color: color, font: font };
  if (extra) for (var k in extra) r[k] = extra[k];
  return [r];
}

// Furniture geometry, measured off the SUSE brand template (fractions of W/H).
// Content slides: logo bottom-left, page number centred just left of the segmented
// brand bar (mint | blue | orange | green, bleeding off the right edge at 93.25%).
// Hero slides (section/title designs): a LARGER logo top-left, page number
// bottom-right, no bar. The SAME numbers drive the canvas chrome AND the exported
// layout gallery, so preview and .pptx furniture cannot drift.
var FURN = {
  logoX: 0.024, logoTop: 0.92, logoH: 0.044,
  heroLogoX: 0.053, heroLogoY: 0.075, heroLogoH: 0.088,
  numX: 0.4232, numRX: 0.9208, numY: 0.917, numW: 0.06, numH: 0.0516,
  barY: 0.9325, barH: 0.0206,
  footX: 0.16, footY: 0.9325, footW: 0.25, footH: 0.028,
};
// The bar's segment starts/widths (fractions of W) with the hue key into T.
var BAR_SEGS = [[0.4992, 0.1799, 'mint'], [0.6791, 0.0725, 'blue'], [0.7516, 0.0365, 'orange'], [0.7881, 0.2119, 'green']];

// Chrome shared by every layout. `opts`: { hero: top-left logo + right page number,
// no bar; cover: logo only; centerLogo: hero logo centred (the dark centred design) }.
function addChrome(els, bg, sc, ctx, W, H, T, opts) {
  if (!ctx) return;
  opts = opts || {};
  var darkBg = bgIsDark(bg);
  var ink = darkBg ? '#ffffff' : T.ink;
  if (!opts.hero && !opts.cover) {
    for (var b = 0; b < BAR_SEGS.length; b++) {
      var seg = BAR_SEGS[b];
      // +1px overlap per segment so rounding can never open a hairline gap.
      els.push({ t: 'rect', x: Math.round(W * seg[0]), y: Math.round(H * FURN.barY), w: Math.round(W * seg[1]) + 1, h: Math.round(H * FURN.barH), fill: T[seg[2]] });
    }
    if (ctx.footerText) {
      els.push(textEl(Math.round(W * FURN.footX), Math.round(H * FURN.footY), Math.round(W * FURN.footW), Math.round(H * FURN.footH), [{ runs: runsOf(ctx.footerText, 8, ink, T.font) }], 't'));
    }
  }
  if (ctx.pageNumbers && !opts.cover) {
    var nx = (opts.hero || opts.pageRight) ? FURN.numRX : FURN.numX;
    els.push(textEl(Math.round(W * nx), Math.round(H * FURN.numY), Math.round(W * FURN.numW), Math.round(H * FURN.numH), [{ align: 'ctr', runs: runsOf(String((ctx.index || 0) + 1), 8, ink, T.font, { bold: true }) }], 'ctr'));
  }
  if (ctx.brandLogo && sc.logo !== 'off' && ctx.logos) {
    var v = pickLogo(ctx.logos, darkBg, sc.logo === 'mono');
    if (v && v.url) {
      // Box matches the logo's REAL aspect (from its viewBox) and fits `contain`, so a wide
      // lockup is never clipped or stretched.
      var aspect = v.aspect || 5.5;
      if (opts.hero || opts.cover) {
        var hh = Math.round(H * FURN.heroLogoH);
        var hw = Math.round(hh * aspect);
        var hx = opts.centerLogo ? Math.round((W - hw) / 2) : Math.round(W * FURN.heroLogoX);
        els.push({ t: 'image', x: hx, y: Math.round(H * FURN.heroLogoY), w: hw, h: hh, src: v.url, fit: 'contain' });
      } else {
        var lh = Math.round(H * FURN.logoH);
        els.push({ t: 'image', x: Math.round(W * FURN.logoX), y: Math.round(H * FURN.logoTop), w: Math.round(lh * aspect), h: lh, src: v.url, fit: 'contain' });
      }
    }
  }
}

// The hero slides' decorative stripe cluster (template MAIN_POINT_2's right edge):
// thin bars in the brand hues, geometry verbatim from the template. `side` -1 mirrors
// the cluster to the left edge. On dark backgrounds the ink bars swap to green so
// the cluster stays visible.
var STRIPES = [
  [0.8137, 0.4694, 0.1863, 'mint'], [0.8475, 0.5198, 0.1188, 'blue'], [0.7782, 0.5746, 0.128, 'mint'],
  [0.9663, 0.5198, 0.0337, 'orange'], [0.8137, 0.6337, 0.0924, 'ink'], [0.9061, 0.6337, 0.0939, 'blue'],
  [0.9352, 0.5746, 0.0659, 'mint'], [0.9336, 0.4146, 0.0664, 'ink'], [0.9336, 0.6928, 0.0664, 'ink'],
];
// BIG_NUMBER's sparser three-row cluster (template layout: green / blue+orange / mint).
var NUM_STRIPES = [
  [0.7881, 0.385, 0.2119, 'green'], [0.8475, 0.435, 0.1188, 'blue'], [0.9663, 0.435, 0.0337, 'orange'],
  [0.82, 0.49, 0.18, 'mint'],
];
function pushStripes(els, list, W, H, T, side, dark) {
  for (var i = 0; i < list.length; i++) {
    var s = list[i];
    var x = side < 0 ? 1 - s[0] - s[2] : s[0];
    var hue = s[3] === 'ink' && dark ? 'green' : s[3];
    els.push({ t: 'rect', x: Math.round(W * x), y: Math.round(H * s[1]), w: Math.round(W * s[2]), h: Math.round(H * 0.0206), fill: T[hue] });
  }
}
function addStripes(els, W, H, T, side, dark) { pushStripes(els, STRIPES, W, H, T, side, dark); }

// Tag the LAST pushed element with a layout-placeholder binding - the engine emits
// `<p:ph>` for it, which is what makes outline view / Reset Slide / re-layout work
// on the exported deck. Text elements only.
function bindPh(els, type, idx) {
  var e = els[els.length - 1];
  if (e && e.t === 'text') e.ph = idx != null ? { type: type, idx: idx } : { type: type };
}

function layoutSlide(sc, W, H, T, ctx) {
  // Geometry follows the SUSE brand template: 3.41% margins, title strip at
  // 3.42-14.55%, body to 84.66%, furniture below 91.7%. All boxes are template
  // measurements (fractions of W/H) so the render matches the reference deck.
  function px(f) { return Math.round(W * f); }
  function py(f) { return Math.round(H * f); }
  var M = px(0.0341);
  var cw = W - 2 * M;
  var green = sc.accent || T.green;   // per-slide accent recolours the hero designs
  var els = [];
  var bg = T.light;
  var chrome = { bar: 1 };

  if (sc.layout === 'title') {
    // Cover (template TITLE_1_2): pine gradient, green title lower-left, white subtitle.
    bg = { grad: { stops: [{ pos: 0, color: T.ink }, { pos: 1, color: T.pine2 }], angle: 90 } };
    els.push(textEl(M, py(0.22), px(0.723), py(0.399), [{ runs: runsOf(sc.title, 52, green, T.font) }], 'b'));
    bindPh(els, 'ctrTitle');
    if (sc.subtitle) { els.push(textEl(M, py(0.646), px(0.932), py(0.154), [{ runs: runsOf(sc.subtitle, 20, '#ffffff', T.font) }], 't')); bindPh(els, 'subTitle', 1); }
    chrome = { cover: 1 };
  } else if (sc.layout === 'section') {
    // Green hero (template MAIN_POINT_2): ink title left-middle, stripe cluster right.
    bg = green;
    var sparas = [{ runs: runsOf(sc.title, 44, T.ink, T.font) }];
    if (sc.subtitle) sparas.push({ spaceBeforePt: 10, runs: runsOf(sc.subtitle, 18, T.ink, T.font) });
    els.push(textEl(px(0.0533), py(0.2537), px(0.6), py(0.6), sparas, 'ctr'));
    bindPh(els, 'title');
    addStripes(els, W, H, T, 1, false);
    chrome = { hero: 1 };
  } else if (sc.layout === 'main-point') {
    // Mint-gradient hero (template MAIN_POINT_2_1): ink statement left-middle.
    bg = { grad: { stops: [{ pos: 0, color: T.paleA }, { pos: 1, color: T.paleB }], angle: 180 } };
    var mparas = [{ runs: runsOf(sc.title || sc.body, 44, T.ink, T.font) }];
    if (sc.subtitle) mparas.push({ spaceBeforePt: 10, runs: runsOf(sc.subtitle, 18, T.ink, T.font) });
    els.push(textEl(px(0.0533), py(0.2537), px(0.65), py(0.6), mparas, 'ctr'));
    bindPh(els, 'title');
    chrome = { hero: 1 };
  } else if (sc.layout === 'quote') {
    // Dark centred hero (template MAIN_POINT_2_1_1): pine gradient, centred white
    // quote under the centred logo, green attribution. Big green quote glyph above.
    bg = { grad: { stops: [{ pos: 0, color: T.ink }, { pos: 1, color: T.pine2 }], angle: 180 } };
    els.push(textEl(px(0.2), py(0.2), px(0.6), py(0.14), [{ align: 'ctr', runs: runsOf('\u201c', 60, green, T.font, { bold: true }) }], 'b'));
    els.push(textEl(px(0.14), py(0.34), px(0.72), py(0.34), [{ align: 'ctr', runs: runsOf(sc.title || sc.body, 30, '#ffffff', T.font) }], 'ctr'));
    bindPh(els, 'title');
    if (sc.subtitle) els.push(textEl(px(0.14), py(0.72), px(0.72), py(0.08), [{ align: 'ctr', runs: runsOf(sc.subtitle, 16, green, T.font, { bold: true }) }], 't'));
    chrome = { hero: 1, centerLogo: 1 };
  } else if (sc.layout === 'big-number') {
    // BIG_NUMBER: huge green stat centred between the mirrored stripe clusters.
    els.push(textEl(px(0.225), py(0.255), px(0.563), py(0.382), [{ align: 'ctr', runs: runsOf(sc.title, 84, green, T.font, { bold: true }) }], 'ctr'));
    bindPh(els, 'title');
    var cap = sc.subtitle || sc.body;
    if (cap) { els.push(textEl(px(0.225), py(0.618), px(0.563), py(0.131), [{ align: 'ctr', runs: runsOf(cap, 18, T.ink, T.font) }], 't')); bindPh(els, 'body', 1); }
    pushStripes(els, NUM_STRIPES, W, H, T, 1, false);
    pushStripes(els, NUM_STRIPES, W, H, T, -1, false);
    chrome = { hero: 1 };
  } else if (sc.layout === 'full-image') {
    if (sc.image) els.push({ t: 'image', x: 0, y: 0, w: W, h: H, src: sc.image, fit: 'cover' });
    else els.push({ t: 'rect', x: 0, y: 0, w: W, h: H, fill: T.ink });
    if (sc.title) {
      els.push({ t: 'rect', x: 0, y: py(0.8), w: W, h: py(0.2), fill: 'rgba(12,50,44,0.72)' });
      els.push(textEl(M, py(0.82), cw, py(0.14), [{ runs: runsOf(sc.title, 26, '#ffffff', T.font, { bold: true }) }], 'ctr'));
      bindPh(els, 'title');
    }
    bg = T.ink;
    chrome = { hero: 1 };
  } else if (sc.layout === 'split') {
    // Template TITLE_AND_BODY_1_1: pine panel left third (white title + body), visual right.
    els.push({ t: 'rect', x: 0, y: 0, w: px(0.3314), h: H, fill: T.ink });
    els.push(textEl(M, py(0.0342), px(0.267), py(0.3144), [{ runs: runsOf(sc.title, 28, '#ffffff', T.font, { bold: true }) }], 'b'));
    bindPh(els, 'title');
    var lparas = parseBody(sc.body, { sizePt: 15, color: '#ffffff', font: T.font, bulletColor: green });
    if (sc.subtitle) lparas.unshift({ spaceAfterPt: 8, runs: runsOf(sc.subtitle, 15, green, T.font, { bold: true }) });
    els.push(textEl(M, py(0.3768), px(0.2792), py(0.4632), lparas, 't'));
    bindPh(els, 'body', 1);
    if (sc.image) els.push({ t: 'image', x: px(0.367), y: py(0.0342), w: px(0.5706), h: py(0.8596), src: sc.image });
    else {
      els.push({ t: 'rect', x: px(0.367), y: py(0.0342), w: px(0.5706), h: py(0.8596), fill: T.card, radius: Math.round(py(0.8596) * 0.105) });
    }
    bg = T.light;
    chrome = { bar: 1, pageRight: 1 };
  } else {
    // Content family: title strip + optional green subtitle strip + the body region.
    els.push(textEl(M, py(0.0342), px(0.9318), py(0.1113), [{ runs: runsOf(sc.title, 28, T.ink, T.font, { bold: true }) }], 'b'));
    bindPh(els, 'title');
    var bodyY = py(0.1455);
    if (sc.subtitle && (sc.layout === 'content' || sc.layout === 'two-col' || sc.layout === 'one-column' || sc.layout === 'table' || sc.layout === 'visual')) {
      els.push(textEl(M, py(0.1335), px(0.9318), py(0.0713), [{ runs: runsOf(sc.subtitle, 15, green, T.font, { bold: true }) }], 't'));
      bodyY = py(0.2241);
    }
    var bodyH = py(0.8466) - bodyY;

    if (sc.layout === 'table') {
      var tbl = parseTableSrc(sc.tableSrc, sc.tableObj);
      if (tbl) els.push(tableEl(M, bodyY, cw, bodyH, tbl, green, T));
    } else if (sc.layout === 'visual') {
      if (sc.image) els.push({ t: 'image', x: M, y: bodyY, w: cw, h: bodyH, src: sc.image });
      else els.push({ t: 'rect', x: M, y: bodyY, w: cw, h: bodyH, fill: T.card, radius: Math.round(bodyH * 0.105) });
    } else if (sc.layout === 'two-col') {
      // Template card wells: two rounded fog cards with the columns inside.
      var paras = parseBody(sc.body, { sizePt: 15, color: T.ink, font: T.font, bulletColor: green });
      var cut = splitParasAtLevel0(paras);
      var cardY = py(0.2279), cardH = py(0.6591), rad = Math.round(cardH * 0.105);
      var cards = [[0.0358, 0.4571], [0.5071, 0.4571]];
      var colParas = [paras.slice(0, cut), paras.slice(cut)];
      for (var c = 0; c < 2; c++) {
        els.push({ t: 'rect', x: px(cards[c][0]), y: cardY, w: px(cards[c][1]), h: cardH, fill: T.card, radius: rad });
        els.push(textEl(px(cards[c][0] + 0.018), py(0.2598), px(cards[c][1] - 0.036), py(0.5974), colParas[c], 't'));
        bindPh(els, 'body', c + 1);
      }
    } else if (sc.layout === 'one-column') {
      els.push(textEl(px(0.22), bodyY, W - 2 * px(0.22), bodyH, parseBody(sc.body, { sizePt: 18, color: T.ink, font: T.font, bulletColor: green }), 't'));
      bindPh(els, 'body', 1);
    } else if (sc.layout === 'agenda') {
      // Green numbered list of the deck's section slides (linked, template list style).
      var secs = (ctx && ctx.sections) || [];
      var aparas = [];
      for (var si = 0; si < secs.length; si++) {
        aparas.push({ bullet: 'number', bulletColor: green, spaceAfterPt: 10, runs: [{ text: secs[si].title || ('Section ' + (si + 1)), sizePt: 20, color: T.ink, font: T.font, linkSlide: secs[si].idx }] });
      }
      if (!aparas.length) aparas.push({ runs: runsOf('Add \u201cSection header\u201d slides \u2014 they become the agenda.', 18, T.ink, T.font) });
      els.push(textEl(M, bodyY, cw, bodyH, aparas, 't'));
      bindPh(els, 'body', 1);
    } else {
      els.push(textEl(M, bodyY, cw, bodyH, parseBody(sc.body, { sizePt: 18, color: T.ink, font: T.font, bulletColor: green }), 't'));
      bindPh(els, 'body', 1);
    }
  }
  addChrome(els, bg, sc, ctx, W, H, T, chrome);
  return { bg: bg, elements: els, dark: bgIsDark(bg) };
}
// Split a paragraph list into two columns at the top-level (level-0) boundary nearest the
// midpoint, so a sub-bullet is never orphaned from its parent bullet across the column gap.
function splitParasAtLevel0(paras) {
  var mid = Math.ceil(paras.length / 2);
  for (var i = mid; i < paras.length; i++) if (!paras[i].level) return i;
  for (var j = mid - 1; j > 0; j--) if (!paras[j].level) return j;
  return mid;
}

function tableEl(x, y, w, h, tbl, accent, T) {
  var ncol = Math.max(1, (tbl.headers || tbl.rows[0] || ['']).length);
  var colW = Math.floor(w / ncol);
  var cols = []; for (var i = 0; i < ncol; i++) cols.push(colW);
  var rows = [];
  if (tbl.headers) {
    // Template table style: pine-ink header band, white text.
    rows.push({ cells: tbl.headers.map(function (c) { return { text: stripInlineMd(c), fill: T.ink, color: '#ffffff', bold: true, align: 'l' }; }) });
  }
  for (var r = 0; r < tbl.rows.length; r++) {
    var cells = [];
    for (var cIx = 0; cIx < ncol; cIx++) {
      cells.push({ text: stripInlineMd(tbl.rows[r][cIx] == null ? '' : tbl.rows[r][cIx]), color: T.ink, align: cIx === 0 ? 'l' : 'r', margin: 10, borders: { b: { color: T.edge || '#dcdbdc', w: 1 } } });
    }
    rows.push({ cells: cells });
  }
  if (rows.length && tbl.headers) for (var hc = 0; hc < rows[0].cells.length; hc++) rows[0].cells[hc].margin = 10;
  // Compact rows (the template look): never stretch a short table to fill the body.
  var rowH = Math.min(Math.floor(h / Math.max(1, rows.length)), 52);
  for (var k = 0; k < rows.length; k++) rows[k].h = rowH;
  return { t: 'table', x: x, y: y, w: w, h: rowH * rows.length, firstRow: !!tbl.headers, cols: cols, rows: rows };
}

// ─── the branded layout gallery (deck.layouts → engine PptxLayout[]) ──────────
// Ten archetypes × light/dark = 20 layouts in every exported .pptx, so the file
// doubles as a working brand template: recipients keep building slides from
// PowerPoint's "New Slide" gallery with the logo/footer riding along. Names are the
// Google-Slides canonical set (best re-import mapping); geometry follows the SUSE
// brand template (margins 3.4%, title strip 3.4–14.6%, body to 84.7%, furniture
// below 91.7% - see FURN). Light layouts get the on-light logo, dark the on-dark.
var GALLERY = ['TITLE', 'SECTION_HEADER', 'TITLE_AND_BODY', 'TITLE_AND_TWO_COLUMNS', 'TITLE_ONLY', 'ONE_COLUMN_TEXT', 'MAIN_POINT', 'SECTION_TITLE_AND_DESCRIPTION', 'CAPTION_ONLY', 'BIG_NUMBER'];
var LAYOUT_TO_ARCH = {
  title: 'TITLE', section: 'SECTION_HEADER', agenda: 'TITLE_AND_BODY', content: 'TITLE_AND_BODY',
  'two-col': 'TITLE_AND_TWO_COLUMNS', split: 'SECTION_TITLE_AND_DESCRIPTION', table: 'TITLE_ONLY', visual: 'TITLE_ONLY',
  'full-image': 'CAPTION_ONLY', quote: 'MAIN_POINT', 'big-number': 'BIG_NUMBER', 'main-point': 'MAIN_POINT', 'one-column': 'ONE_COLUMN_TEXT',
};
// Gallery order: light at 2i, its dark twin at 2i+1.
function galleryIndexFor(layout, dark) {
  var i = GALLERY.indexOf(LAYOUT_TO_ARCH[layout] || 'TITLE_AND_BODY');
  return (i < 0 ? 2 : i) * 2 + (dark ? 1 : 0);
}

function galleryLayout(name, dark, T, logos, W, H, ctx) {
  function px(f) { return Math.round(W * f); }
  function py(f) { return Math.round(H * f); }
  var HERO = { TITLE: 1, SECTION_HEADER: 1, MAIN_POINT: 1, CAPTION_ONLY: 1, BIG_NUMBER: 1 };
  var hero = !!HERO[name];
  // Backgrounds per design (light/dark twins mirror the template's variants).
  var bg, ink, titleInk;
  if (name === 'TITLE') {
    bg = { grad: { stops: [{ pos: 0, color: T.ink }, { pos: 1, color: T.pine2 }], angle: 90 } };
    ink = '#ffffff'; titleInk = T.green;
  } else if (name === 'SECTION_HEADER') {
    bg = dark ? { grad: { stops: [{ pos: 0, color: T.ink }, { pos: 1, color: T.pine2 }], angle: 180 } } : T.green;
    ink = dark ? '#ffffff' : T.ink; titleInk = ink;
  } else if (name === 'MAIN_POINT') {
    bg = dark ? { grad: { stops: [{ pos: 0, color: T.ink }, { pos: 1, color: T.pine2 }], angle: 180 } }
              : { grad: { stops: [{ pos: 0, color: T.paleA }, { pos: 1, color: T.paleB }], angle: 180 } };
    ink = dark ? '#ffffff' : T.ink; titleInk = ink;
  } else if (name === 'CAPTION_ONLY') {
    bg = T.ink; ink = '#ffffff'; titleInk = '#ffffff';
  } else {
    bg = dark ? T.ink : T.light;
    ink = dark ? '#ffffff' : T.ink; titleInk = ink;
  }
  var els = [], phs = [];
  var barDark = typeof bg !== 'string' || bgIsDark(bg);
  // Furniture: the segmented bar + bottom-left logo on content designs; the larger
  // top-left logo on heroes. Same constants as addChrome so gallery = slides.
  if (!hero) {
    for (var b = 0; b < BAR_SEGS.length; b++) {
      var seg = BAR_SEGS[b];
      els.push({ t: 'rect', x: px(seg[0]), y: py(FURN.barY), w: px(seg[1]) + 1, h: py(FURN.barH), fill: T[seg[2]] });
    }
    if (ctx.footerText) els.push(textEl(px(FURN.footX), py(FURN.footY), px(FURN.footW), py(FURN.footH), [{ runs: runsOf(ctx.footerText, 8, ink, T.font) }], 't'));
  }
  if (ctx.brandLogo && logos) {
    var v = pickLogo(logos, barDark, false);
    if (v && v.url) {
      var aspect = v.aspect || 5.5;
      if (hero) {
        var hh = py(FURN.heroLogoH);
        els.push({ t: 'image', x: px(FURN.heroLogoX), y: py(FURN.heroLogoY), w: Math.round(hh * aspect), h: hh, src: v.url, fit: 'contain' });
      } else {
        var lh = py(FURN.logoH);
        els.push({ t: 'image', x: px(FURN.logoX), y: py(FURN.logoTop), w: Math.round(lh * aspect), h: lh, src: v.url, fit: 'contain' });
      }
    }
  }
  function ph(type, idx, xf, yf, wf, hf, style, prompt, anchor) {
    var pp = { type: type, x: px(xf), y: py(yf), w: px(wf), h: py(hf), style: style };
    if (idx != null) pp.idx = idx;
    if (prompt) pp.prompt = prompt;
    if (anchor) pp.anchor = anchor;
    phs.push(pp);
  }
  if (ctx.pageNumbers && name !== 'TITLE') ph('sldNum', 12, hero ? FURN.numRX : FURN.numX, FURN.numY, FURN.numW, FURN.numH, { sizePt: 8, color: ink, align: 'ctr', font: T.font });
  var M = 0.0341;
  var titleStyle = { font: T.font, sizePt: 28, color: titleInk, align: 'l' };
  var bodyStyle = { font: T.font, sizePt: 18, color: ink, bullet: true };
  if (name === 'TITLE') {
    ph('ctrTitle', null, M, 0.22, 0.723, 0.399, { font: T.font, sizePt: 52, color: T.green }, 'Presentation title', 'b');
    ph('subTitle', 1, M, 0.646, 0.932, 0.154, { font: T.font, sizePt: 20, color: '#ffffff' }, 'Subtitle');
  } else if (name === 'SECTION_HEADER' || name === 'MAIN_POINT') {
    if (name === 'SECTION_HEADER') addStripes(els, W, H, T, 1, dark);
    ph('title', null, 0.0533, 0.2537, 0.62, 0.6, { font: T.font, sizePt: 44, color: titleInk }, name === 'MAIN_POINT' ? 'One big statement' : 'Section header', 'ctr');
  } else if (name === 'TITLE_AND_BODY') {
    ph('title', null, M, 0.0342, 0.9318, 0.1113, titleStyle, 'Title', 'b');
    ph('body', 1, M, 0.1455, 0.9318, 0.7011, bodyStyle, 'Add your points');
  } else if (name === 'TITLE_AND_TWO_COLUMNS') {
    ph('title', null, M, 0.0342, 0.9318, 0.1113, titleStyle, 'Title', 'b');
    var rad = Math.round(py(0.6591) * 0.105);
    var cards = [[0.0358, 0.4571], [0.5071, 0.4571]];
    for (var c = 0; c < 2; c++) {
      els.push({ t: 'rect', x: px(cards[c][0]), y: py(0.2279), w: px(cards[c][1]), h: py(0.6591), fill: dark ? T.pine2 : T.card, radius: rad });
      ph('body', c + 1, cards[c][0] + 0.018, 0.2598, cards[c][1] - 0.036, 0.5974, bodyStyle, c ? 'Right column' : 'Left column');
    }
  } else if (name === 'TITLE_ONLY') {
    ph('title', null, M, 0.0342, 0.9318, 0.1113, titleStyle, 'Title', 'b');
  } else if (name === 'ONE_COLUMN_TEXT') {
    ph('title', null, M, 0.0342, 0.9318, 0.1113, titleStyle, 'Title', 'b');
    ph('body', 1, 0.22, 0.1455, 0.56, 0.7011, { font: T.font, sizePt: 18, color: ink }, 'A narrow, readable measure');
  } else if (name === 'SECTION_TITLE_AND_DESCRIPTION') {
    // The split design: pine panel left third, description right.
    els.push({ t: 'rect', x: 0, y: 0, w: px(0.3314), h: H, fill: T.ink });
    ph('title', null, M, 0.0342, 0.267, 0.3144, { font: T.font, sizePt: 28, color: '#ffffff' }, 'Section title', 'b');
    ph('body', 1, M, 0.3768, 0.2792, 0.4632, { font: T.font, sizePt: 15, color: '#ffffff' }, 'Description');
  } else if (name === 'CAPTION_ONLY') {
    ph('title', null, M, 0.8, 0.9318, 0.14, { font: T.font, sizePt: 26, color: '#ffffff' }, 'Caption');
  } else if (name === 'BIG_NUMBER') {
    pushStripes(els, NUM_STRIPES, W, H, T, 1, false);
    pushStripes(els, NUM_STRIPES, W, H, T, -1, false);
    ph('title', null, 0.225, 0.255, 0.563, 0.382, { font: T.font, sizePt: 84, color: dark ? '#ffffff' : T.green, align: 'ctr' }, 'xx%', 'ctr');
    ph('body', 1, 0.225, 0.618, 0.563, 0.131, { font: T.font, sizePt: 18, color: ink, align: 'ctr' }, 'What the number means');
  }
  return { name: dark ? name + '_DARK' : name, bg: bg, elements: els, placeholders: phs };
}
function buildGallery(T, logos, W, H, ctx) {
  var out = [];
  for (var i = 0; i < GALLERY.length; i++) {
    out.push(galleryLayout(GALLERY[i], false, T, logos, W, H, ctx));
    out.push(galleryLayout(GALLERY[i], true, T, logos, W, H, ctx));
  }
  return out;
}

// One sample slide per archetype - the "Starter template" mode: a self-serve branded
// .pptx (like the brand team's own template file) built from the active brand.
function templateSlides() {
  function s(layout, title, subtitle, body, extra) {
    var o = { layout: layout, title: title || '', subtitle: subtitle || '', body: body || '', tableSrc: '', image: '', accent: '', logo: 'auto', notes: '' };
    if (extra) for (var k in extra) o[k] = extra[k];
    return o;
  }
  return [
    s('title', 'Presentation title', 'Subtitle or date'),
    s('agenda', 'Agenda'),
    s('section', 'Section header', 'Optional description'),
    s('content', 'Title and body', '', 'First point\nSecond point\n  Supporting detail'),
    s('two-col', 'Two columns', '', 'Left point one\nLeft point two\nRight point one\nRight point two'),
    s('split', 'Story panel', 'The setup', 'A point on the panel\nAnother point'),
    s('one-column', 'One column', '', 'A narrow measure keeps long-form text readable.'),
    s('main-point', 'One big statement per slide'),
    s('big-number', '87%', 'What the number means'),
    s('table', 'Native editable table', '', '', { tableSrc: 'Metric,Q1,Q2\nRevenue,$1.2M,$1.6M\nGrowth,+18%,+33%' }),
    s('quote', 'A quote worth a whole slide', 'Attribution'),
    s('full-image', 'Full-bleed image with a caption'),
  ];
}

// ─── element list → preview HTML (positions in %, sizes in cqw) ───────────────
function pctX(v, W) { return (v / W * 100); }
function pctY(v, H) { return (v / H * 100); }
function cqw(px, W) { return (px / W * 100).toFixed(3) + 'cqw'; }
function ptCqw(pt, W) { return cqw(pt * 4 / 3, W); }
function fillCss(fill, W) {
  if (!fill) return '';
  if (typeof fill === 'string') return fill;
  if (fill.grad && fill.grad.stops) {
    var stops = fill.grad.stops.map(function (s) { return htmlEsc(s.color) + ' ' + Math.round((s.pos || 0) * 100) + '%'; }).join(', ');
    return 'linear-gradient(' + (Math.round((fill.grad.angle || 180))) + 'deg, ' + stops + ')';
  }
  return '';
}
function runHtml(run) {
  var s = htmlEsc(run.text);
  if (run.bold) s = '<b>' + s + '</b>';
  if (run.italic) s = '<i>' + s + '</i>';
  if (run.underline) s = '<u>' + s + '</u>';
  if (run.strike) s = '<s>' + s + '</s>';
  return { s: s, color: run.color, sizePt: run.sizePt };
}
function paraHtml(p, W) {
  var isNum = p.bullet === 'number';
  var custom = p.bullet && typeof p.bullet === 'object' && p.bullet.char ? p.bullet.char : '';
  var cls = 'ds-p' + (isNum ? ' ds-num' : (p.bullet ? ' ds-bullet' : ''));
  var style = p.level ? 'margin-left:' + (p.level * 4) + 'cqw;' : '';
  if (custom) style += "--ds-bul:'" + htmlEsc(custom).replace(/'/g, '') + "';";
  if (p.bulletColor) style += '--ds-bulc:' + htmlEsc(p.bulletColor) + ';';
  var align = p.align === 'ctr' ? 'center' : p.align === 'r' ? 'right' : p.align === 'just' ? 'justify' : 'left';
  var inner = (p.runs || []).map(function (run) {
    var r = runHtml(run);
    var link = run.linkSlide != null ? ';text-decoration:underline;text-underline-offset:2px' : '';
    return '<span style="font-size:' + ptCqw(r.sizePt, W) + ';color:' + htmlEsc(r.color || '#111') + link + '">' + r.s + '</span>';
  }).join('');
  return '<p class="' + cls + '" style="' + style + 'text-align:' + align + '">' + inner + '</p>';
}
function elHtml(el, W, H) {
  var pos = 'left:' + pctX(el.x, W).toFixed(3) + '%;top:' + pctY(el.y, H).toFixed(3) + '%;width:' + pctX(el.w, W).toFixed(3) + '%;height:' + pctY(el.h, H).toFixed(3) + '%;';
  if (el.t === 'rect') {
    var bd = el.line ? 'border:' + Math.max(1, el.line.w) + 'px solid ' + htmlEsc(el.line.color) + ';' : '';
    var rad = el.radius ? 'border-radius:' + cqw(el.radius, W) + ';' : '';
    return '<div class="ds-el" style="' + pos + 'background:' + htmlEsc(fillCss(el.fill, W)) + ';' + bd + rad + '"></div>';
  }
  if (el.t === 'text') {
    var anchor = el.anchor === 'ctr' ? ' ds-anchor-ctr' : el.anchor === 'b' ? ' ds-anchor-b' : '';
    return '<div class="ds-el ds-text' + anchor + '" style="' + pos + '">' + (el.paras || []).map(function (p) { return paraHtml(p, W); }).join('') + '</div>';
  }
  if (el.t === 'image') {
    // Default to `contain` (never clip a logo/chart); only a full-bleed background covers.
    var fitCls = el.fit === 'cover' ? ' ds-cover' : '';
    return '<div class="ds-el' + fitCls + '" style="' + pos + '"><img src="' + htmlEsc(el.src) + '" alt=""></div>';
  }
  if (el.t === 'table') {
    var trs = (el.rows || []).map(function (row) {
      var tds = (row.cells || []).map(function (c) {
        var st = 'font-size:' + ptCqw(c.sizePt || 13, W) + ';padding:0.6cqw 0.9cqw;color:' + htmlEsc(c.color || '#111') + ';';
        if (c.fill) st += 'background:' + htmlEsc(c.fill) + ';';
        if (c.bold) st += 'font-weight:700;';
        st += 'text-align:' + (c.align === 'r' ? 'right' : c.align === 'ctr' ? 'center' : 'left') + ';';
        if (c.borders && c.borders.b) st += 'border-bottom:1px solid ' + htmlEsc(c.borders.b.color) + ';';
        var span = c.colSpan > 1 ? ' colspan="' + c.colSpan + '"' : '';
        return '<td' + span + ' style="' + st + '">' + htmlEsc(c.text || '') + '</td>';
      }).join('');
      return '<tr>' + tds + '</tr>';
    }).join('');
    return '<div class="ds-el" style="' + pos + '"><table class="ds-table" style="width:100%;height:100%;">' + trs + '</table></div>';
  }
  return '';
}
function slideHtml(slide, W, H, notes, idx) {
  var bgCss = fillCss(slide.bg, W) || '#ffffff';
  var body = (slide.elements || []).map(function (el) { return elHtml(el, W, H); }).join('');
  var note = notes ? '<div class="ds-notes" data-slide-notes hidden>' + htmlEsc(notes) + '</div>' : '';
  // data-block-index ties this page to its sidebar block (index-aligned) so the shell's
  // filmstrip can jump between a slide and the block that authors it.
  return '<section class="ds-slide" data-pdf-page data-block-index="' + idx + '" style="background:' + htmlEsc(bgCss) + ';">' + body + note + '</section>';
}

// ─── compute ──────────────────────────────────────────────────────────────────
var _cachedTheme = null;
var _cachedLogos = null;

function boolInput(model, id, dflt) { for (var i = 0; i < model.length; i++) if (model[i].id === id) return model[i].value !== false; return dflt; }
function strInput(model, id) { for (var i = 0; i < model.length; i++) if (model[i].id === id) return str(model[i].value); return ''; }

function build(model, theme, logos) {
  var picked = slidesFromInputs(model);
  var sz = SIZES[picked.size] || SIZES[str(pickSize(model))] || SIZES.wide;
  var W = sz[0], H = sz[1];
  var isTemplate = strInput(model, 'mode') === 'template';
  var slides = isTemplate ? templateSlides()
    : picked.slides.length ? picked.slides : [{ layout: 'title', title: 'Deck Studio', subtitle: '', body: '', notes: '', logo: 'auto' }];
  // Pass 1: the section slides become the agenda's linked table of contents.
  var sections = [];
  for (var s = 0; s < slides.length; s++) if (slides[s].layout === 'section') sections.push({ idx: s, title: slides[s].title });
  var pageNumbers = boolInput(model, 'pageNumbers', true);
  var brandLogo = boolInput(model, 'brandLogo', true);
  var footerText = strInput(model, 'footerText');
  var ctxBase = { sections: sections, logos: logos, pageNumbers: pageNumbers, brandLogo: brandLogo, footerText: footerText };
  var laid = slides.map(function (sc, i) {
    return layoutSlide(sc, W, H, theme, { index: i, total: slides.length, sections: ctxBase.sections, logos: logos, pageNumbers: pageNumbers, brandLogo: brandLogo, footerText: footerText });
  });
  var deck = {
    size: { w: W, h: H },
    theme: pptxTheme(theme),
    // The full branded gallery rides in EVERY export (light + dark twins), so the file
    // doubles as a template; each slide binds to its archetype via `layout`.
    layouts: buildGallery(theme, logos, W, H, ctxBase),
    slides: laid.map(function (sl, i) { return { bg: sl.bg, layout: galleryIndexFor(slides[i].layout, sl.dark), notes: slides[i].notes || undefined, elements: sl.elements }; }),
  };
  var previewHtml = laid.map(function (sl, i) { return slideHtml(sl, W, H, slides[i].notes, i); }).join('');
  return { _deckJson: safeJson(deck), _previewHtml: previewHtml, _aspect: W + ' / ' + H, _slideCount: slides.length };
}
function pickSize(model) { for (var i = 0; i < model.length; i++) if (model[i].id === 'size') return model[i].value; return 'wide'; }

async function onInit(ctx) {
  _cachedTheme = await readBrandTheme();
  _cachedLogos = await resolveLogos();
  return build(ctx.model, _cachedTheme, _cachedLogos);
}
function onInput(ctx) {
  var theme = _cachedTheme || { primary: '#0c322c', accent: '#30ba78', dark: '#1b1b1b', light: '#ffffff', font: 'SUSE' };
  return build(ctx.model, theme, _cachedLogos);
}
