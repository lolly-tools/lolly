/**
 * Multi-Page PDF — hooks.
 *
 * The hook turns a cover + a flat list of content "blocks" + a back page into a
 * sequence of FIXED-SIZE page boxes. Each page box is exactly the export page
 * size (width/height come from the export bar, in CSS px), so the export bridge
 * can emit one true PDF page per box (it walks every [data-pdf-page] element —
 * see shells/web/src/bridge/export.js renderMultiPagePdf). Keeping each page's
 * height locked to the export height is what makes the browser lay content into
 * discrete pages and what makes every PDF page come out the right size.
 *
 * Pagination is done HERE, not in CSS, because hooks run before the DOM exists
 * and can't measure rendered height. Each block is given an integer row-span on
 * a 12-row, 2-column grid — estimated from its text/image content, or pinned by
 * the block's Height control. Blocks are then packed column-by-column; when a
 * page fills, a new one is created. A block can be Column (one grid column) or
 * Wide (spans both). The result is a `pages` array the template renders verbatim.
 *
 * No client JS ships in the canvas — layout is plain CSS grid driven by the
 * per-cell grid-column/grid-row the packer computes, so the live preview and the
 * vector PDF render identically.
 */

var ROWS = 12;                 // grid rows per content page
var SIZE_ROWS = { short: 3, medium: 5, tall: 8, full: ROWS };

// ── helpers ──────────────────────────────────────────────────────────────────

function toInputs(model) {
  var o = {};
  model.forEach(function (i) { o[i.id] = i.value; });
  return o;
}
function num(v, d) { var x = Number(v); return isFinite(x) ? x : d; }
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function str(v) { return (typeof v === 'string') ? v : (v == null ? '' : String(v)); }
function r2(x) { return Math.round(x * 100) / 100; }

// Colour values land in raw style attributes, so a crafted shared URL could try
// to break out of the attribute. Only let through hex / rgb(a) / hsl(a) / a few
// keywords; anything else falls back to the default.
var COLOUR_RE = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$|^(?:rgb|rgba|hsl|hsla)\([0-9.,%\s/]+\)$/;
var COLOUR_WORDS = { transparent: 1, black: 1, white: 1, currentcolor: 1 };
function colour(v, fallback) {
  var s = str(v).trim();
  if (!s) return fallback;
  return (COLOUR_RE.test(s) || COLOUR_WORDS[s.toLowerCase()]) ? s : fallback;
}

// WCAG-ish luminance of a #hex, to pick a contrasting ink for a band.
function relLum(hex) {
  var s = str(hex).replace('#', '');
  var h = s.length === 3 ? s.replace(/(.)/g, '$1$1') : (s + '000000').slice(0, 6);
  function lin(i) { var v = parseInt(h.slice(i, i + 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
  return 0.2126 * lin(0) + 0.7152 * lin(2) + 0.0722 * lin(4);
}
function isDark(hex) { return relLum(hex) < 0.5; }

// Resolve a catalog asset id → object URL (empty on failure / headless).
async function getAssetUrl(id) {
  try { var a = await host.assets.get(id); return (a && a.url) || ''; }
  catch (e) { if (host.log) host.log('warn', 'multi-page-pdf: asset unavailable', { id: id }); return ''; }
}
function refUrl(ref) {
  return (ref && typeof ref === 'object' && typeof ref.url === 'string') ? ref.url : '';
}
function refAspect(ref, fallback) {
  if (ref && typeof ref === 'object' && ref.width > 0 && ref.height > 0) return ref.height / ref.width;
  return fallback;
}

// ── the work ─────────────────────────────────────────────────────────────────

async function compute(model) {
  var inputs = toInputs(model);

  // Page size in CSS px (the export bar feeds width/height here). Each page box
  // is rendered at exactly this size; the PDF bridge converts px → points.
  var W = clamp(Math.round(num(inputs.width, 794)), 100, 8000);
  var H = clamp(Math.round(num(inputs.height, 1123)), 100, 8000);

  // Derived layout — all proportional to the page so A4/A5/Letter all look right.
  var marginX = Math.round(W * 0.085);
  var marginY = Math.round(H * 0.07);
  var footerH = Math.round(H * 0.035);
  var colGap  = Math.round(W * 0.05);
  var rowGap  = Math.round(H * 0.018);
  var contentW = W - 2 * marginX;
  // Leave a little slack above the footer so a full grid never collides with it.
  var contentH = H - 2 * marginY - footerH - Math.round(H * 0.02);
  var rowH = r2((contentH - (ROWS - 1) * rowGap) / ROWS);

  var bodySize    = clamp(Math.round(W * 0.0185), 9, 30);
  var headingSize = clamp(Math.round(W * 0.030), 12, 52);
  var captionSize = clamp(Math.round(W * 0.0155), 8, 24);
  var coverTitleSize = clamp(Math.round(W * 0.072), 20, 130);
  var coverSubSize   = clamp(Math.round(W * 0.030), 12, 54);
  var footerSize  = clamp(Math.round(W * 0.0135), 8, 20);

  // Colours / theme.
  var accent = colour(inputs.accent, '#30ba78');

  // Cover: the light/dark style sets the ink + logo variant; an optional custom
  // background colour overrides the style's default background.
  var coverDark = str(inputs.theme) === 'dark';
  var coverBg  = colour(inputs.coverBg, coverDark ? '#0c322c' : '#ffffff');
  var coverInk = coverDark ? '#ffffff' : '#0c322c';

  // Content pages are always on white — the two-column grid is built for light paper.
  var ink   = '#10231f';
  var muted = '#5b6b66';

  // Back page shares the cover's light/dark style (ink + logo variant), but keeps
  // its own optional custom background so the two cards can differ in colour.
  var backDark  = coverDark;
  var backBg    = colour(inputs.backBg, backDark ? '#0c322c' : '#ffffff');
  var backInk   = backDark ? '#ffffff' : '#10231f';
  var backMuted = backDark ? 'rgba(255,255,255,.72)' : '#5b6b66';

  // ── per-block row-span estimate ──────────────────────────────────────────
  function estLines(text, w, fs) {
    var cpl = Math.max(6, Math.floor(w / (fs * 0.52)));
    var lines = 0;
    var paras = str(text).split('\n');
    for (var i = 0; i < paras.length; i++) {
      var ln = paras[i];
      if (ln.trim() === '') { lines += 0.6; continue; }   // blank line = paragraph gap
      lines += Math.max(1, Math.ceil(ln.length / cpl));
    }
    return Math.max(1, lines);
  }
  function estimateRows(b, isWide) {
    var colW = isWide ? contentW : Math.round((contentW - colGap) / 2);
    var padY = Math.round(H * 0.012) * 2 + Math.round(H * 0.01);
    var hh = b.heading ? (headingSize * 1.25 + Math.round(H * 0.012)) : 0;
    var contentPx;
    if (b.kind === 'image') {
      var imgH = Math.min(colW * b._ar, contentH * 0.85);
      contentPx = imgH + (b.caption ? estLines(b.caption, colW, captionSize) * captionSize * 1.4 + 8 : 0);
    } else {
      contentPx = estLines(b.body, colW, bodySize) * bodySize * 1.5;
    }
    var span = Math.ceil((hh + contentPx + padY) / (rowH + rowGap));
    return clamp(span, 1, ROWS);
  }
  function rowSpanOf(b, isWide) {
    if (b.size && SIZE_ROWS[b.size]) return clamp(SIZE_ROWS[b.size], 1, ROWS);
    return estimateRows(b, isWide);
  }

  // ── normalise blocks ─────────────────────────────────────────────────────
  var raw = Array.isArray(inputs.content) ? inputs.content : [];
  var blocks = [];
  for (var i = 0; i < raw.length; i++) {
    var d = raw[i] || {};
    var kind = str(d.kind) || 'text';
    var imgUrl = kind === 'image' ? refUrl(d.image) : '';
    var b = {
      idx: i,                 // index in the raw content array → sidebar block index
      kind: kind,
      heading: str(d.heading).trim(),
      body: kind === 'text' ? str(d.body) : '',
      imageUrl: imgUrl,
      caption: kind === 'image' ? str(d.caption) : '',
      width: str(d.width) === 'wide' ? 'wide' : 'column',
      size: str(d.size) || 'auto',
      brk: str(d.break) === 'page',
      _ar: refAspect(d.image, 0.62),
    };
    // Skip a block that is entirely empty (e.g. a freshly-added image block with
    // no picture yet) so it doesn't reserve a blank cell.
    if (b.kind === 'image' && !b.imageUrl && !b.heading && !b.caption) continue;
    if (b.kind === 'text' && !b.heading && !b.body.trim()) continue;
    blocks.push(b);
  }

  // ── pack blocks into 2-column pages ──────────────────────────────────────
  var contentPages = [];
  var pg = null;
  function newPage() { pg = { cells: [], col: [0, 0] }; contentPages.push(pg); return pg; }

  for (var k = 0; k < blocks.length; k++) {
    var blk = blocks[k];
    var isWide = blk.width === 'wide';
    var span = rowSpanOf(blk, isWide);
    if (!pg || blk.brk) newPage();

    var base, gridStyle;
    if (isWide) {
      base = Math.max(pg.col[0], pg.col[1]);
      if (base + span > ROWS) { newPage(); base = 0; }
      gridStyle = 'grid-column:1 / -1;grid-row:' + (base + 1) + ' / span ' + span + ';';
      pg.col[0] = pg.col[1] = base + span;
    } else {
      var c = pg.col[0] <= pg.col[1] ? 0 : 1;
      if (pg.col[c] + span > ROWS) {
        var other = c === 0 ? 1 : 0;
        if (pg.col[other] + span <= ROWS) c = other;
        else { newPage(); c = 0; }
      }
      base = pg.col[c];
      gridStyle = 'grid-column:' + (c + 1) + ';grid-row:' + (base + 1) + ' / span ' + span + ';';
      pg.col[c] = base + span;
    }

    pg.cells.push({
      blockIndex: blk.idx,            // → data-canvas-input="content:N" for click-to-focus
      kind: blk.kind,
      isImage: blk.kind === 'image',
      heading: blk.heading,
      body: blk.body,
      imageUrl: blk.imageUrl,
      caption: blk.caption,
      gridStyle: gridStyle,
    });
  }

  // ── resolve cover / back assets ──────────────────────────────────────────
  var coverLogoUrl = refUrl(inputs.coverLogo) ||
    await getAssetUrl(coverDark ? 'suse/logo/hor-neg-white' : 'suse/logo/hor-pos-black');
  var coverImageUrl = refUrl(inputs.coverImage);
  // Back logo follows the back page's own light/dark style: green on light, the
  // white knockout on dark so it stays legible.
  var backLogoUrl = await getAssetUrl(backDark ? 'suse/logo/hor-neg-white' : 'suse/logo/hor-pos-green');
  var backImageUrl = refUrl(inputs.backImage);

  // ── assemble the page list: cover, content pages, back ───────────────────
  var pages = [];
  pages.push({
    type: 'cover', isCover: true,
    coverTitle: str(inputs.coverTitle),
    coverSubtitle: str(inputs.coverSubtitle),
    coverText: str(inputs.coverText),
    coverLogoUrl: coverLogoUrl,
    coverImageUrl: coverImageUrl,
    hasHero: !!coverImageUrl,
  });
  for (var p = 0; p < contentPages.length; p++) {
    pages.push({ type: 'content', isContent: true, cells: contentPages[p].cells });
  }
  pages.push({
    type: 'back', isBack: true,
    backHeading: str(inputs.backHeading),
    backText: str(inputs.backText),
    backCompany: str(inputs.backCompany),
    backEmail: str(inputs.backEmail),
    backPhone: str(inputs.backPhone),
    backWebsite: str(inputs.backWebsite),
    aboutHeading: str(inputs.aboutHeading),
    aboutText: str(inputs.aboutText),
    backLogoUrl: backLogoUrl,
    backImageUrl: backImageUrl,
    hasHero: !!backImageUrl,
  });

  // Footer page numbering ("n / total"), shown on content + back pages.
  var total = pages.length;
  var docTitle = str(inputs.coverTitle);
  for (var q = 0; q < pages.length; q++) {
    pages[q].pageNo = q + 1;
    pages[q].pageTotal = total;
    pages[q].docTitle = docTitle;
  }

  // CSS custom properties consumed by the template's <style> block.
  var docStyle = [
    '--pw:' + W + 'px', '--ph:' + H + 'px',
    '--margin-x:' + marginX + 'px', '--margin-y:' + marginY + 'px',
    '--footer-h:' + footerH + 'px',
    '--col-gap:' + colGap + 'px', '--row-gap:' + rowGap + 'px',
    '--row-h:' + rowH + 'px',
    '--accent:' + accent,
    '--ink:' + ink, '--muted:' + muted,
    '--cover-bg:' + coverBg, '--cover-ink:' + coverInk,
    '--back-bg:' + backBg, '--back-ink:' + backInk, '--back-muted:' + backMuted,
    '--body-size:' + bodySize + 'px', '--heading-size:' + headingSize + 'px',
    '--caption-size:' + captionSize + 'px',
    '--cover-title-size:' + coverTitleSize + 'px', '--cover-sub-size:' + coverSubSize + 'px',
    '--footer-size:' + footerSize + 'px',
  ].join(';');

  return {
    pages: pages,
    docStyle: docStyle,
    pageCount: total,
  };
}

function onInit(ctx) { return compute(ctx.model); }
function onInput(ctx) { return compute(ctx.model); }
