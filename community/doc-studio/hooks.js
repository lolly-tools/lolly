/**
 * Doc Studio - hooks.
 *
 * The document is authored on the canvas with a TipTap (ProseMirror) editor and stored
 * as portable ProseMirror JSON in the `content` input. This hook is the ENGINE render
 * path: it parses that JSON and walks the node tree into fixed-size page boxes so the
 * export bridge emits one true PDF page per [data-pdf-page] box (and CLI / OG previews
 * render the same document headlessly). Pagination is heuristic - hooks run before the
 * DOM exists and can't measure - so each top-level block's height is estimated from its
 * content and blocks flow down a single column, opening a new page when it fills. A block
 * is atomic (never split across a page). No client JS ships in the canvas.
 *
 * The editor and this renderer share the same `.doc-*` CSS (styles below via docStyle +
 * the template), so the on-screen editor and the exported pages look the same.
 */

// ── primitives ─────────────────────────────────────────────────────────────────
function toInputs(model) { var o = {}; model.forEach(function (i) { o[i.id] = i.value; }); return o; }
function num(v, d) { var x = Number(v); return isFinite(x) ? x : d; }
// === lolly:shared clamp - generated from community/_shared/math.js; edit there and run npm run sync:shared ===
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
// === /lolly:shared clamp ===
function str(v) { return (typeof v === 'string') ? v : (v == null ? '' : String(v)); }
function r2(x) { return Math.round(x * 100) / 100; }
// === lolly:shared esc - generated from community/_shared/text.js; edit there and run npm run sync:shared ===
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
// === /lolly:shared esc ===

// Colour / font-family reaching a style="" attribute - only validated shapes pass.
var COLOUR_RE = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$|^(?:rgb|rgba|hsl|hsla)\([0-9.,%\s/]+\)$/;
function safeColor(v) { var s = str(v).trim(); return COLOUR_RE.test(s) ? s : ''; }
function safeFont(v) {
  // Resolve to the ACTIVE brand's font via the injected brand vars (brand-vars sets
  // --font-brand / --font-mono on the canvas root), so this works under any brand and
  // falls back to system fonts where a brand sets none. Accept 'suse' for back-compat
  // with values the editor stored before this tool became brand-agnostic.
  var s = str(v);
  if (/mono/i.test(s)) return "var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace)";
  if (/suse|brand|sans/i.test(s)) return "var(--font-brand, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif)";
  return '';
}
// A link href reaching an <a href> - only safe schemes (no javascript:/data:).
function safeUrl(v) { var s = str(v).trim(); return /^(https?:\/\/|mailto:|\/|#)/i.test(s) ? esc(s) : ''; }
// A link href for MARKDOWN output: same scheme guard, NOT HTML-escaped, and
// angle-bracketed when it contains spaces or parens so the `[](url)` still parses.
function mdUrl(v) {
  var s = str(v).trim();
  if (!/^(https?:\/\/|mailto:|\/|#)/i.test(s)) return '';
  return /[()\s]/.test(s) ? '<' + s.replace(/>/g, '%3E') + '>' : s;
}

// A built-in starter document, shown when `content` is empty (fresh tool / gallery / OG).
var STARTER = {
  type: 'doc', content: [
    { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Your document title' }] },
    { type: 'paragraph', content: [
      { type: 'text', text: 'Welcome to ' },
      { type: 'text', marks: [{ type: 'bold' }], text: 'Doc Studio' },
      { type: 'text', text: ' - a real word processor. Select and delete across anything, and insert tables, lists and images inline.' },
    ] },
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Write the way you think' }] },
    { type: 'bulletList', content: [
      { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Paste rich text - bold, italics, lists and tables keep their shape' }] }] },
      { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Insert a Lolly render (a QR code, a chart, a map) inline' }] }] },
      { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Headings 1 to 4, SUSE or SUSE Mono, export to PDF' }] }] },
    ] },
  ],
};

function parseDoc(v) {
  var d = null;
  if (v && typeof v === 'object') d = v;
  else if (typeof v === 'string' && v.trim()) { try { d = JSON.parse(v); } catch (e) { d = null; } }
  if (!d || d.type !== 'doc' || !Array.isArray(d.content) || !d.content.length) d = STARTER;
  return d;
}

// ── inline (text + marks) → HTML ─────────────────────────────────────────────
function inline(nodes) {
  if (!Array.isArray(nodes)) return '';
  var out = '';
  for (var i = 0; i < nodes.length; i++) {
    var n = nodes[i] || {};
    if (n.type === 'hardBreak') { out += '<br>'; continue; }
    if (n.type !== 'text') continue;
    var piece = esc(n.text);
    var marks = Array.isArray(n.marks) ? n.marks : [];
    var styles = [];
    for (var m = 0; m < marks.length; m++) {
      var mk = marks[m] || {};
      var a = mk.attrs || {};
      if (mk.type === 'textStyle') {
        var c = safeColor(a.color); if (c) styles.push('color:' + c);
        var f = safeFont(a.fontFamily); if (f) styles.push('font-family:' + f);
      }
    }
    if (styles.length) piece = '<span style="' + styles.join(';') + '">' + piece + '</span>';
    for (var k = marks.length - 1; k >= 0; k--) {
      switch (marks[k].type) {
        case 'bold': case 'strong': piece = '<strong>' + piece + '</strong>'; break;
        case 'italic': case 'em': piece = '<em>' + piece + '</em>'; break;
        case 'underline': piece = '<u>' + piece + '</u>'; break;
        case 'strike': piece = '<s>' + piece + '</s>'; break;
        case 'code': piece = '<code class="doc-code">' + piece + '</code>'; break;
        case 'link': { var href = safeUrl((marks[k].attrs || {}).href); if (href) piece = '<a href="' + href + '">' + piece + '</a>'; break; }
      }
    }
    out += piece;
  }
  return out;
}

// Per-block inline style: alignment + line-height + letter-spacing (the two
// typographic block attrs the Doc Studio editor sets). Every value is range-checked
// before it reaches a style="" attribute - only validated shapes pass.
function blockStyle(attrs) {
  var a = attrs || {};
  var s = '';
  var al = a.textAlign;
  if (al === 'center' || al === 'right' || al === 'justify') s += 'text-align:' + al + ';';
  var lh = num(a.lineHeight, 0);
  if (lh >= 0.5 && lh <= 4) s += 'line-height:' + lh + ';';
  var ls = str(a.letterSpacing);
  if (/^-?\d*\.?\d+em$/.test(ls) && parseFloat(ls) >= -0.5 && parseFloat(ls) <= 2) s += 'letter-spacing:' + ls + ';';
  return s;
}

// ── block node → HTML ────────────────────────────────────────────────────────
var TABLE_BORDER = { grid: 1, rows: 1, none: 1 };
var TABLE_PAD = { tight: 1, normal: 1, roomy: 1 };
function tableHtml(node) {
  var attrs = node.attrs || {};
  var border = TABLE_BORDER[str(attrs.border)] ? str(attrs.border) : 'grid';
  var pad = TABLE_PAD[str(attrs.pad)] ? str(attrs.pad) : 'normal';
  var rows = Array.isArray(node.content) ? node.content : [];
  var cols = 0;
  for (var r = 0; r < rows.length; r++) cols = Math.max(cols, (rows[r].content || []).length);
  cols = Math.max(1, cols);
  var cells = '';
  for (var ri = 0; ri < rows.length; ri++) {
    var cs = rows[ri].content || [];
    for (var ci = 0; ci < cols; ci++) {
      var cell = cs[ci] || { type: 'tableCell', content: [] };
      var head = cell.type === 'tableHeader';
      var bg = safeColor((cell.attrs || {}).backgroundColor);   // per-cell fill (multi-select)
      var body = '';
      var kids = cell.content || [];
      for (var p = 0; p < kids.length; p++) body += inline(kids[p].content || []);
      cells += '<div class="doc-cell' + (head ? ' doc-cell-head' : '') + '"' +
        (bg ? ' style="background:' + bg + '"' : '') + '>' + (body || '&nbsp;') + '</div>';
    }
  }
  return '<div class="doc-table doc-tb-' + border + ' doc-pad-' + pad +
    '" style="grid-template-columns:repeat(' + cols + ',1fr)">' + cells + '</div>';
}

function listHtml(node, ordered) {
  var items = Array.isArray(node.content) ? node.content : [];
  var out = '';
  for (var i = 0; i < items.length; i++) {
    var kids = items[i].content || [];
    var inner = '';
    for (var k = 0; k < kids.length; k++) {
      var kn = kids[k];
      if (kn.type === 'bulletList') inner += listHtml(kn, false);
      else if (kn.type === 'orderedList') inner += listHtml(kn, true);
      else inner += '<div class="doc-li-p">' + inline(kn.content || []) + '</div>';
    }
    out += '<li>' + inner + '</li>';
  }
  return ordered ? '<ol class="doc-ol">' + out + '</ol>' : '<ul class="doc-ul">' + out + '</ul>';
}

function blockHtml(node) {
  if (!node || !node.type) return '';
  switch (node.type) {
    case 'heading': {
      var lvl = clamp(Math.round(num(node.attrs && node.attrs.level, 2)), 1, 4);
      return '<h' + lvl + ' class="doc-h doc-h' + lvl + '" style="' + blockStyle(node.attrs) + '">' + inline(node.content || []) + '</h' + lvl + '>';
    }
    case 'paragraph':
      return '<p class="doc-p" style="' + blockStyle(node.attrs) + '">' + (inline(node.content || []) || '<br>') + '</p>';
    case 'bulletList': return listHtml(node, false);
    case 'orderedList': return listHtml(node, true);
    case 'blockquote': {
      var inner = '';
      var kids = node.content || [];
      for (var i = 0; i < kids.length; i++) inner += blockHtml(kids[i]);
      return '<blockquote class="doc-quote">' + inner + '</blockquote>';
    }
    case 'codeBlock': {
      // Join ALL text nodes - a multi-line block can be more than one node.
      var code = '', cc = node.content || [];
      for (var ci = 0; ci < cc.length; ci++) code += (cc[ci] && cc[ci].text) || '';
      return '<pre class="doc-pre"><code>' + esc(code) + '</code></pre>';
    }
    case 'horizontalRule': return '<hr class="doc-hr">';
    case 'table': return tableHtml(node);
    case 'image': {
      var a = node.attrs || {};
      var src = str(a.src);
      if (!src) return '';
      // width is a percentage of the text column (set by the editor's resize handle);
      // apply it to the img so the exported image matches the on-canvas size exactly.
      var wm = str(a.width).match(/^(\d+(?:\.\d+)?)%$/);
      var wstyle = wm ? ' style="width:' + wm[1] + '%"' : '';
      return '<figure class="doc-fig"><img src="' + esc(src) + '" alt="' + esc(a.alt) + '"' + wstyle + '></figure>';
    }
    default: return '';
  }
}

// ── ProseMirror JSON → Markdown (the `md` export format) ─────────────────────
function repeatStr(s, n) { var o = ''; for (var i = 0; i < n; i++) o += s; return o; }
function mdInline(nodes) {
  if (!Array.isArray(nodes)) return '';
  var out = '';
  for (var i = 0; i < nodes.length; i++) {
    var n = nodes[i] || {};
    if (n.type === 'hardBreak') { out += '  \n'; continue; }
    if (n.type !== 'text') continue;
    var t = String(n.text || '');
    var marks = Array.isArray(n.marks) ? n.marks : [];
    var bold = false, ital = false, strike = false, code = false, href = '';
    for (var m = 0; m < marks.length; m++) {
      var mt = marks[m].type;
      if (mt === 'bold' || mt === 'strong') bold = true;
      else if (mt === 'italic' || mt === 'em') ital = true;
      else if (mt === 'strike') strike = true;
      else if (mt === 'code') code = true;
      else if (mt === 'link') href = str((marks[m].attrs || {}).href);
    }
    if (code) t = '`' + t + '`';        // inline code holds no other markup
    else {
      if (strike) t = '~~' + t + '~~';
      if (bold) t = '**' + t + '**';
      if (ital) t = '*' + t + '*';
    }
    if (href) { var u = mdUrl(href); if (u) t = '[' + t.replace(/([[\]])/g, '\\$1') + '](' + u + ')'; }
    out += t;
  }
  return out;
}
function listMd(node, ordered, depth) {
  var items = Array.isArray(node.content) ? node.content : [];
  var indent = repeatStr('  ', depth);
  var out = '';
  for (var i = 0; i < items.length; i++) {
    var kids = items[i].content || [];
    var marker = ordered ? (i + 1) + '. ' : '- ';
    var lead = '', rest = '';
    for (var k = 0; k < kids.length; k++) {
      var kn = kids[k];
      if (kn.type === 'bulletList') rest += listMd(kn, false, depth + 1);
      else if (kn.type === 'orderedList') rest += listMd(kn, true, depth + 1);
      else if (kn.type === 'paragraph') { if (!lead) lead = mdInline(kn.content || []); }
    }
    out += indent + marker + lead + '\n' + rest;
  }
  return out + (depth === 0 ? '\n' : '');
}
function tableMd(node) {
  var rows = Array.isArray(node.content) ? node.content : [];
  if (!rows.length) return '';
  var grid = [], cols = 0, r, c;
  for (r = 0; r < rows.length; r++) {
    var cells = rows[r].content || []; cols = Math.max(cols, cells.length);
    var row = [];
    for (c = 0; c < cells.length; c++) {
      var cell = cells[c] || {}, txt = '', ck = cell.content || [];
      for (var p = 0; p < ck.length; p++) txt += mdInline(ck[p].content || []);
      row.push(txt.replace(/\|/g, '\\|').replace(/\n/g, ' '));
    }
    grid.push(row);
  }
  var out = '';
  for (r = 0; r < grid.length; r++) {
    while (grid[r].length < cols) grid[r].push('');
    out += '| ' + grid[r].join(' | ') + ' |\n';
    if (r === 0) { var sep = []; for (c = 0; c < cols; c++) sep.push('---'); out += '| ' + sep.join(' | ') + ' |\n'; }
  }
  return out + '\n';
}
function blockMd(node) {
  if (!node || !node.type) return '';
  switch (node.type) {
    case 'heading': { var lvl = clamp(Math.round(num(node.attrs && node.attrs.level, 2)), 1, 6); return repeatStr('#', lvl) + ' ' + mdInline(node.content || []) + '\n\n'; }
    case 'paragraph': { var t = mdInline(node.content || []); return t ? t + '\n\n' : ''; }
    case 'bulletList': return listMd(node, false, 0);
    case 'orderedList': return listMd(node, true, 0);
    case 'blockquote': {
      var inner = '', kids = node.content || [];
      for (var i = 0; i < kids.length; i++) inner += blockMd(kids[i]);
      return inner.replace(/\n+$/, '').split('\n').map(function (l) { return l ? '> ' + l : '>'; }).join('\n') + '\n\n';
    }
    case 'codeBlock': {
      var code = '', cc = node.content || [];
      for (var ci = 0; ci < cc.length; ci++) code += (cc[ci] && cc[ci].text) || '';
      // Fence longer than the longest backtick run in the body (so an inner ``` line
      // doesn't close it early on re-import). CommonMark rule.
      var longest = 0, run = 0;
      for (var q = 0; q < code.length; q++) { if (code.charAt(q) === '`') { if (++run > longest) longest = run; } else run = 0; }
      var f = repeatStr('`', Math.max(3, longest + 1));
      return f + '\n' + code + '\n' + f + '\n\n';
    }
    case 'horizontalRule': return '---\n\n';
    case 'table': return tableMd(node);
    case 'image': { var a = node.attrs || {}; return a.src ? '![' + str(a.alt) + '](' + str(a.src) + ')\n\n' : ''; }
    default: return '';   // pageBreak etc. have no markdown form
  }
}
function docToMarkdown(doc) {
  var content = (doc && Array.isArray(doc.content)) ? doc.content : [];
  var out = '';
  for (var i = 0; i < content.length; i++) out += blockMd(content[i]);
  // Collapse 3+ newlines between blocks - but NOT inside fenced code (verbatim
  // whitespace). Mask fenced regions (open fence → same-length close) first.
  var fences = [];
  out = out.replace(/(`{3,})[^]*?\1/g, function (m) { fences.push(m); return '\x00F' + (fences.length - 1) + '\x00'; });
  out = out.replace(/\n{3,}/g, '\n\n');
  out = out.replace(/\x00F(\d+)\x00/g, function (_m, n) { return fences[+n]; });
  return out.replace(/\s+$/, '') + '\n';
}

// ── height estimate (px) for pagination ──────────────────────────────────────
function textLen(nodes) { var n = 0; if (Array.isArray(nodes)) for (var i = 0; i < nodes.length; i++) if (nodes[i] && nodes[i].type === 'text') n += String(nodes[i].text || '').length; return n; }
function estLines(len, w, fs) { var cpl = Math.max(6, Math.floor(w / (fs * 0.5))); return Math.max(1, Math.ceil(len / cpl)); }

// ── the work ─────────────────────────────────────────────────────────────────
function compute(model) {
  var inputs = toInputs(model);
  var W = clamp(Math.round(num(inputs.width, 794)), 100, 8000);
  var H = clamp(Math.round(num(inputs.height, 1123)), 100, 8000);

  var marginX = Math.round(W * 0.085);
  var marginY = Math.round(H * 0.075);
  var footerH = Math.round(H * 0.03);
  var contentW = W - 2 * marginX;
  var contentH = H - 2 * marginY - footerH;

  // Multi-column pages: content flows down N columns per page, then onto the next page.
  // The browser (CSS column-count) balances each page's blocks across the columns; the
  // hook only decides which blocks land on which page, budgeting the column WIDTH for
  // height estimates and contentH×N of total column area per page. N=1 is unchanged.
  var cols = clamp(Math.round(num(inputs.columns, 1)), 1, 3);
  var colGap = Math.round(W * 0.04);
  var colW = cols > 1 ? Math.round((contentW - (cols - 1) * colGap) / cols) : contentW;

  var bodySize = clamp(Math.round(W * 0.017), 9, 28);
  var lineH = 1.5;
  var captionSize = clamp(Math.round(W * 0.0145), 8, 22);
  var footerSize = clamp(Math.round(W * 0.013), 8, 18);
  var H_SCALE = { 1: 2.1, 2: 1.6, 3: 1.28, 4: 1.08 };

  var accent = safeColor(inputs.accent) || '#30ba78';
  var dark = str(inputs.theme) === 'dark';
  var paperBg = dark ? '#0c322c' : '#ffffff';
  var ink = dark ? '#f3f7f5' : '#10231f';
  var muted = dark ? 'rgba(243,247,245,.62)' : '#5b6b66';
  var tableLine = dark ? 'rgba(243,247,245,.28)' : 'rgba(16,35,31,.16)';
  var headBg = dark ? 'rgba(255,255,255,.06)' : 'rgba(48,186,120,.10)';
  var docFont = safeFont(inputs.font) || "'SUSE', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

  var docTitle = str(inputs.docTitle);
  var showNums = inputs.pageNumbers !== false;

  var d = parseDoc(inputs.content);
  var top = Array.isArray(d.content) ? d.content : [];

  function estimateHeight(node) {
    switch (node.type) {
      case 'heading': {
        var hs = bodySize * (H_SCALE[clamp(Math.round(num(node.attrs && node.attrs.level, 2)), 1, 4)] || H_SCALE[2]);
        // Headings span all columns (see template.html), so estimate at full width.
        return estLines(textLen(node.content), contentW, hs) * hs * 1.25 + hs * 0.9;
      }
      case 'paragraph':
        return estLines(textLen(node.content), colW, bodySize) * bodySize * lineH + bodySize * 0.9;
      case 'bulletList': case 'orderedList': {
        var items = node.content || []; var h = bodySize * 0.4;
        for (var i = 0; i < items.length; i++) {
          var kids = items[i].content || []; var len = 0;
          for (var k = 0; k < kids.length; k++) len += textLen(kids[k].content || []);
          h += estLines(len, colW - bodySize, bodySize) * bodySize * lineH + bodySize * 0.3;
        }
        return h;
      }
      case 'blockquote': {
        var kk = node.content || []; var hh = bodySize;
        for (var j = 0; j < kk.length; j++) hh += estimateHeight(kk[j]);
        return hh;
      }
      case 'codeBlock':
        return (String((node.content && node.content[0] && node.content[0].text) || '').split('\n').length) * bodySize * 1.5 + bodySize;
      case 'horizontalRule': return bodySize * 1.5;
      case 'table': {
        var rows = node.content || []; var cols = 1;
        for (var rr = 0; rr < rows.length; rr++) cols = Math.max(cols, (rows[rr].content || []).length);
        var cw = contentW / Math.max(1, cols); var th = bodySize;   // table spans all columns
        for (var r = 0; r < rows.length; r++) {
          var cs = rows[r].content || []; var maxLines = 1;
          for (var c = 0; c < cs.length; c++) { var pk = cs[c].content || []; var l = 0; for (var pp = 0; pp < pk.length; pp++) l += textLen(pk[pp].content || []); maxLines = Math.max(maxLines, estLines(l, cw, bodySize * 0.94)); }
          th += maxLines * bodySize * 0.94 * 1.4 + bodySize * 0.8;
        }
        return th;
      }
      case 'image': {
        var iwm = str(node.attrs && node.attrs.width).match(/^(\d+(?:\.\d+)?)%$/);
        var ifrac = iwm ? clamp(num(iwm[1], 62), 8, 100) / 100 : 0.62;
        return Math.min(colW * ifrac, contentH * 0.7) + bodySize;
      }
      default: return bodySize * lineH;
    }
  }

  var pages = [];
  function newPage() { var p = { html: '' }; pages.push(p); return p; }
  var pg = newPage();
  var used = 0;
  var rowGap = Math.round(bodySize * 0.5);
  var pageBudget = contentH * cols;   // N columns of height contentH per page
  var pendingBreak = false;           // an explicit break waits for the NEXT content block
  for (var i = 0; i < top.length; i++) {
    var node = top[i];
    // Defer the new page to the next real content block, so a leading / trailing /
    // duplicate page break never leaves a blank page.
    if (node && node.type === 'pageBreak') { pendingBreak = true; continue; }
    var html = blockHtml(node);
    if (!html) continue;
    var need = estimateHeight(node);
    if (pendingBreak && pg.html) { pg = newPage(); used = 0; }
    else if (used > 0 && used + need > pageBudget) { pg = newPage(); used = 0; }
    pendingBreak = false;
    pg.html += html;
    used += need + rowGap;
  }
  if (!pages.length) newPage();

  var total = pages.length;
  var hasFooter = showNums || !!docTitle;
  var out = [];
  for (var p = 0; p < pages.length; p++) {
    out.push({ html: pages[p].html, pageNo: p + 1, pageTotal: total, docTitle: docTitle, showNums: showNums, hasFooter: hasFooter });
  }

  var docStyle = [
    '--pw:' + W + 'px', '--ph:' + H + 'px',
    '--margin-x:' + marginX + 'px', '--margin-y:' + marginY + 'px', '--footer-h:' + footerH + 'px',
    '--body-size:' + bodySize + 'px', '--caption-size:' + captionSize + 'px', '--footer-size:' + footerSize + 'px',
    '--line-h:' + lineH,
    '--h1:' + r2(bodySize * H_SCALE[1]) + 'px', '--h2:' + r2(bodySize * H_SCALE[2]) + 'px',
    '--h3:' + r2(bodySize * H_SCALE[3]) + 'px', '--h4:' + r2(bodySize * H_SCALE[4]) + 'px',
    '--accent:' + accent, '--ink:' + ink, '--muted:' + muted,
    '--paper:' + paperBg, '--table-line:' + tableLine, '--head-bg:' + headBg,
    '--doc-font:' + docFont,
    '--cols:' + cols, '--col-gap:' + colGap + 'px',
  ].join(';');

  return { pages: out, docStyle: docStyle, pageCount: total, mdSource: docToMarkdown(d) };
}

function onInit(ctx) { return compute(ctx.model); }
function onInput(ctx) { return compute(ctx.model); }
