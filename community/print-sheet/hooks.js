/* global host */
/**
 * Print Sheet - hooks.
 *
 * Imposition: one design, or a pile of them, laid out n-up on physical sheets,
 * with crop marks in the margin so the stack can be guillotined or die-cut, and
 * as many pages as it takes to place them all.
 *
 * The artwork is a `blocks` list - each block is one cell's design - so a user
 * can drop many images at once (dropToAdd) or paste a LOLLY TOOL LINK into any
 * cell (docs/authoring-tools.md, "Use any tool as an image"). The runtime
 * resolves each block's `art` sub-field the same way it resolves a top-level
 * asset - a tool link becomes a live render through host.compose.renderUrl on
 * every mount (runtime.ts resolveAssetRefs walks block asset sub-fields), so a
 * cell that holds a link always carries a fresh render of that tool. That is the
 * end-user compose path; a library asset or an upload works the same way, and on
 * a shell with no compose bridge a linked cell is simply empty and the grid
 * still renders.
 *
 * Two fill modes drive how the blocks land in the grid:
 *   - repeat: cycle the blocks to fill every cell of every page. One block makes
 *     a full sheet of the same thing; several make a mixed sheet. `pages` says
 *     how many sheets.
 *   - once: place each block a single time, adding pages until they all fit (a
 *     proof sheet). Trailing cells on the last page stay empty.
 *
 * All geometry is computed in MILLIMETRES and every page <svg> viewBox is in
 * millimetres too, so every number below is a real print measurement. The pixel
 * size mirrors engine/src/units.ts: CSS_DPI 96 and 25.4 mm to the inch.
 *
 * The hook never throws: a failure becomes the `error` extra, which the sheet
 * shows in plain text instead of painting an invalid grid.
 */

// ─── Constants mirrored from engine/src/units.ts ─────────────────────────────
var CSS_DPI = 96;
var MM_PER_INCH = 25.4;
var PX_PER_MM = CSS_DPI / MM_PER_INCH;

// ─── Sheet stock, in mm ──────────────────────────────────────────────────────
var SHEETS = {
  a4: { w: 210, h: 297, label: 'A4 portrait' },
  a4l: { w: 297, h: 210, label: 'A4 landscape' },
  letter: { w: 215.9, h: 279.4, label: 'US Letter' },
  a3: { w: 297, h: 420, label: 'A3 portrait' },
};

// Most cells one sheet renders. Each cell is a separate placed render, so the
// cap is about render cost, not paper: past this a second sheet is cheaper.
var MAX_CELLS = 40;
// ponytail: repeat x pages caps total placed renders at MAX_CELLS * MAX_PAGES
// (40 x 20 = 800). Cheap for images; a sheet made entirely of live TOOL LINKS
// pays one renderUrl per cell, so the real ceiling is the user's patience.
// Raise MAX_PAGES only alongside a per-cell render budget if that ever bites.
var MAX_PAGES = 20;
var MIN_CELL = 6;

function _sheet(v) {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(SHEETS, v)
    ? SHEETS[v]
    : SHEETS.a4;
}

function _num(v, dflt, lo, hi) {
  var n = typeof v === 'number' ? v : parseFloat(v);
  if (!isFinite(n)) return dflt;
  return Math.min(hi, Math.max(lo, n));
}

function _int(v, dflt, lo, hi) {
  return Math.round(_num(v, dflt, lo, hi));
}

// Print measurements are quoted to a tenth of a millimetre; four decimals in
// the SVG keeps the arithmetic exact without writing float noise into exports.
function _r(n) {
  return Math.round(n * 10000) / 10000;
}

// Trim the gap first, then the margin, so a cell never drops below MIN_CELL.
function _fit(total, n, gap, margin) {
  var g = n > 1 ? Math.min(gap, Math.max(0, (total - 2 * margin - n * MIN_CELL) / (n - 1))) : gap;
  var m = Math.min(margin, Math.max(0, (total - (n - 1) * g - n * MIN_CELL) / 2));
  return { gap: g, margin: m };
}

function _toInputs(model) {
  var out = {};
  for (var i = 0; i < model.length; i++) out[model[i].id] = model[i].value;
  return out;
}

// Pull the resolved artwork URL out of one `cells` block. The runtime has already
// turned a tool link or asset ref into an object carrying `url` before this hook
// runs; a block with nothing dropped in yet has no url and is skipped.
function _artsFrom(cells) {
  var out = [];
  if (!Array.isArray(cells)) return out;
  for (var i = 0; i < cells.length; i++) {
    var b = cells[i];
    var art = b && typeof b === 'object' ? b.art : null;
    var url = art && typeof art === 'object' && typeof art.url === 'string' ? art.url : '';
    // `block` is the sidebar block index this artwork lives in, so a tap on the
    // rendered cell (data-canvas-input="cells:<block>") focuses the right control.
    if (url) out.push({ url: url, block: i });
  }
  return out;
}

var _memoKey = null;
var _memoResult = null;

function compute(model) {
  var inputs = _toInputs(model);

  var arts = _artsFrom(inputs.cells);
  var K = arts.length;
  var hasArt = K > 0;

  var key = JSON.stringify([
    inputs.sheet, inputs.rows, inputs.cols, inputs.gap, inputs.margin,
    inputs.ticks, inputs.tickShape, inputs.fill, inputs.pages,
    arts.map(function (a) { return a.block + ':' + a.url; }),
  ]);
  if (key === _memoKey) return _memoResult;

  var sheet = _sheet(inputs.sheet);
  var W = sheet.w;
  var H = sheet.h;

  var rows = _int(inputs.rows, 2, 1, 10);
  var cols = _int(inputs.cols, 2, 1, 10);
  var notes = [];

  if (rows * cols > MAX_CELLS) {
    var keep = Math.max(1, Math.floor(MAX_CELLS / cols));
    notes.push(rows + ' x ' + cols + ' is ' + (rows * cols) + ' cells. One sheet carries ' +
      MAX_CELLS + ' at most, so this shows ' + keep + ' rows. Add pages, or a smaller grid, for the rest.');
    rows = keep;
  }
  var perSheet = rows * cols;

  var gapIn = _num(inputs.gap, 5, 0, 30);
  var marginIn = _num(inputs.margin, 10, 0, 30);
  var fx = _fit(W, cols, gapIn, marginIn);
  var fy = _fit(H, rows, gapIn, marginIn);
  // One gap and one margin for the whole sheet, so take whichever axis is tighter.
  var gap = Math.min(fx.gap, fy.gap);
  var margin = Math.min(fx.margin, fy.margin);
  if (gap < gapIn - 0.001 || margin < marginIn - 0.001) {
    notes.push('The gap and margin were trimmed to keep the cells printable at this grid.');
  }

  var cellW = (W - 2 * margin - (cols - 1) * gap) / cols;
  var cellH = (H - 2 * margin - (rows - 1) * gap) / rows;

  var isRound = inputs.tickShape === 'round-rect';
  var radius = isRound ? Math.max(1, Math.min(5, Math.min(cellW, cellH) * 0.12)) : 0;

  // Cell geometry is identical on every page - only the artwork in each slot
  // changes. Compute the placed boxes once.
  var geom = [];
  for (var r = 0; r < rows; r++) {
    for (var c = 0; c < cols; c++) {
      geom.push({
        x: _r(margin + c * (cellW + gap)),
        y: _r(margin + r * (cellH + gap)),
        w: _r(cellW),
        h: _r(cellH),
        rx: _r(radius),
      });
    }
  }

  // Crop marks live in the SHEET MARGIN, never over a cell. Same set on every page.
  var wantTicks = inputs.ticks !== false;
  var tickLen = Math.min(4, margin * 0.7);
  var tickOff = Math.min(1.5, margin * 0.2);
  var ticks = [];
  if (wantTicks && tickLen >= 1.4) {
    for (var ci = 0; ci < cols; ci++) {
      var x0 = margin + ci * (cellW + gap);
      var edgesX = [x0, x0 + cellW];
      for (var xi = 0; xi < edgesX.length; xi++) {
        var x = _r(edgesX[xi]);
        ticks.push({ x1: x, y1: _r(margin - tickOff - tickLen), x2: x, y2: _r(margin - tickOff) });
        ticks.push({ x1: x, y1: _r(H - margin + tickOff), x2: x, y2: _r(H - margin + tickOff + tickLen) });
      }
    }
    for (var ri = 0; ri < rows; ri++) {
      var y0 = margin + ri * (cellH + gap);
      var edgesY = [y0, y0 + cellH];
      for (var yi = 0; yi < edgesY.length; yi++) {
        var y = _r(edgesY[yi]);
        ticks.push({ x1: _r(margin - tickOff - tickLen), y1: y, x2: _r(margin - tickOff), y2: y });
        ticks.push({ x1: _r(W - margin + tickOff), y1: y, x2: _r(W - margin + tickOff + tickLen), y2: y });
      }
    }
  } else if (wantTicks) {
    notes.push('Crop marks need a margin of about 2 mm or more; this sheet has no room for them.');
  }

  // ─── Fill: map the artwork blocks into the grid, across pages ───────────────
  // repeat: cycle the blocks to fill every cell of `pages` sheets.
  // once:   place each block once; page count derives from how many there are.
  var mode = inputs.fill === 'once' ? 'once' : 'repeat';
  var pageCount, totalCells;
  if (mode === 'once') {
    totalCells = K;
    pageCount = Math.max(1, Math.ceil(K / perSheet));
  } else {
    pageCount = _int(inputs.pages, 1, 1, MAX_PAGES);
    totalCells = perSheet * pageCount;
  }

  var pxW = Math.round(W * PX_PER_MM);
  var pxH = Math.round(H * PX_PER_MM);
  var hairline = 0.2; // 0.2 mm reads on paper and stays a hairline on screen.
  var hintSize = Math.max(3, Math.min(6, W * 0.028));

  var pages = [];
  for (var p = 0; p < pageCount; p++) {
    var pcells = [];
    for (var gi = 0; gi < perSheet; gi++) {
      var g = p * perSheet + gi;
      var box = geom[gi];
      var url = '';
      var block = -1;
      if (g < totalCells && K > 0) {
        // once: block g exactly; repeat: cycle. Trailing once-cells stay empty.
        var idx = mode === 'once' ? (g < K ? g : -1) : (g % K);
        if (idx >= 0) { url = arts[idx].url; block = arts[idx].block; }
      }
      pcells.push({
        x: box.x, y: box.y, w: box.w, h: box.h, rx: box.rx,
        url: url, block: block, hasUrl: !!url,
      });
    }
    pages.push({
      sheetW: _r(W), sheetH: _r(H), sheetPxW: pxW, sheetPxH: pxH,
      isRound: isRound, hairline: hairline,
      rowsOut: rows, colsOut: cols,
      // The empty-state hint sits on the first page only, when nothing is dropped in yet.
      hint: !hasArt && p === 0,
      hintX: _r(W / 2), hintY: _r(H / 2), hintSize: hintSize,
      cells: pcells,
      ticks: ticks,
    });
  }

  _memoKey = key;
  _memoResult = {
    // Extras ACCUMULATE across hook runs, so a success has to clear the error a
    // previous run left behind - otherwise one bad patch pins the sheet on its
    // error text for the rest of the session.
    error: '',
    // The page list is `sheets`, NOT `pages`: a returned key that matches an input
    // id (there is a `pages` NUMBER input) is applied as that input's new VALUE
    // (runtime hook-patch semantics), which would clobber the page count with this
    // array of page objects and collapse the sheet to one page on the next render.
    sheets: pages,
    pageCount: pageCount,
    hasArt: hasArt,
    rowsOut: rows,
    colsOut: cols,
    cellCount: perSheet,
    note: notes.join(' '),
    summary: sheet.label + ' - ' + rows + ' x ' + cols + ' at ' +
      (Math.round(cellW * 10) / 10) + ' x ' + (Math.round(cellH * 10) / 10) + ' mm' +
      (pageCount > 1 ? ' - ' + pageCount + ' pages' : '') +
      (hasArt ? ' - ' + K + (K === 1 ? ' design' : ' designs') : ''),
  };
  return _memoResult;
}

// A hook must never throw: a failure becomes the `error` extra the sheet shows.
function _safe(ctx) {
  try {
    return compute(ctx.model);
  } catch (e) {
    if (host && host.log) host.log('warn', 'print-sheet: could not build the grid', { error: String(e) });
    // A4 dimensions ride along so the error text has a coordinate space to paint
    // into, on a single page, instead of coming out blank.
    var a4 = SHEETS.a4;
    return {
      error: 'Could not lay out this sheet: ' + (e && e.message ? e.message : 'unknown error'),
      sheets: [{
        sheetW: a4.w, sheetH: a4.h,
        sheetPxW: Math.round(a4.w * PX_PER_MM), sheetPxH: Math.round(a4.h * PX_PER_MM),
        isRound: false, hairline: 0.2, cells: [], ticks: [], hint: false,
      }],
      pageCount: 1,
    };
  }
}

function onInit(ctx) { return _safe(ctx); }
function onInput(ctx) { return _safe(ctx); }
