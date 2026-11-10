/**
 * Chart Studio - renderer-neutral hooks.
 *
 * The hook stays DOM-free: it parses pasted data, compiles every input into a
 * portable ChartSpecV1 document, and hands renderer state to the template as a
 * `_state` extra. D3 renders the SVG path, Three renders real-z scenes, and the
 * same spec drives deterministic vector fallbacks and accessibility metadata.
 *
 * One model shape feeds every chart type:
 *   categories   - labels down column 0 (the x-axis / slice / row labels)
 *   series       - every OTHER numeric column, aligned to categories
 *   numericCols  - every numeric column in order (scatter x/y/size)
 * Charts pick what they need: bar/line/area/radar use categories×series; pie/
 * donut/treemap/pack use the first series; scatter uses numericCols; heatmap uses
 * the categories×series matrix; histogram bins the first numeric column.
 */

// ── table parsing ────────────────────────────────────────────────────────────

// RFC-4180-ish split of one delimited document into a grid of string cells.
// Honours "double quotes" with "" escaping (quoted cells may embed the delimiter
// and newlines), folds CRLF, tolerates a leading BOM. Works for any single-char
// delimiter (comma / tab / semicolon / pipe).
function splitTable(text, delim) {
  const s = String(text).replace(/^/, '');
  const rows = [];
  let row = [], field = '', inQ = false, i = 0;
  while (i < s.length) {
    const c = s[i];
    if (inQ) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQ = false; i++; continue;
      }
      field += c; i++; continue;
    }
    // A quote only OPENS a quoted field at the field start (RFC 4180). A quote
    // mid-field (an inch/second mark like 6.1" or a foot-inch 5'6") is literal -
    // otherwise it would swallow the rest of the table into one cell.
    if (c === '"' && field === '') { inQ = true; i++; continue; }
    if (c === delim) { row.push(field); field = ''; i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += c; i++;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  // Drop wholly-blank rows (trailing newline, spacer lines).
  return rows.filter((r) => r.some((c) => String(c).trim() !== ''));
}

// Pick the delimiter by CONSISTENCY across the first several rows, not just the
// max column-count on line 1. A real separator splits every row into the same
// (>1) number of columns; stray punctuation in one line (e.g. "Region (EU|US)")
// does not recur, so it loses. Falls back to the old first-line-max heuristic
// when no candidate is fully consistent (e.g. genuinely ragged data).
function detectDelim(text) {
  const lines = String(text).replace(/^/, '').split(/\r?\n/).filter((l) => l.trim() !== '').slice(0, 12);
  if (!lines.length) return ',';
  const cands = ['\t', ';', '|', ','];
  let fallback = ',', fbN = 1, consistent = null, consistentN = 1;
  for (const d of cands) {
    const counts = lines.map((l) => l.split(d).length);
    if (counts[0] > fbN) { fbN = counts[0]; fallback = d; }
    if (counts[0] > 1 && counts.every((n) => n === counts[0]) && counts[0] > consistentN) {
      consistentN = counts[0]; consistent = d;
    }
  }
  return consistent || fallback;
}

const DELIM_MAP = { comma: ',', tab: '\t', semicolon: ';', pipe: '|' };

// Blank / not-a-number tokens that must count as a GAP, not as text - otherwise a
// few "N/A"s or a spreadsheet error cell would drag a real number column below the
// numeric threshold and drop it. Covers dashes, Excel errors, and common fillers.
function isBlankToken(raw) {
  const t = String(raw == null ? '' : raw).trim();
  if (!t) return true;
  return /^(-{1,2}|–|\u2014|\.|\?|nil|none|null|nan|na|n\/?a|tbd|#n\/?a|#ref!?|#div\/0!?|#value!?|#name\??!?|#null!?|#num!?)$/i.test(t);
}

// Parse one cell, tolerating how spreadsheets/locales actually write numbers:
// currency & %, grouping by comma / dot / apostrophe / (thin/nbsp) space, EU
// decimal comma, (1,234) accounting negatives, a Unicode minus, and k/m/b/t
// magnitude suffixes. A cell must be WHOLLY numeric after cleaning, so "Q1"/"Mar"
// stay text. `commaDecimal` (per column) says whether comma is the decimal mark.
function parseNum(raw, commaDecimal) {
  if (raw == null) return NaN;
  let s = String(raw).trim();
  if (isBlankToken(s)) return NaN;
  let sign = 1;
  const paren = /^\((.+)\)$/.exec(s);                       // (1,234) accounting negative
  if (paren) { sign = -1; s = paren[1].trim(); }
  s = s.replace(/^[−‒–\u2014]/, '-');        // unicode minus / dashes
  s = s.replace(/[€$£¥%\s' ]/g, '');    // currency / % / apostrophe & space grouping
  let mult = 1;
  const suf = /[kmbt]$/i.exec(s);                           // 1.2M, 850k, 3.4B, 5T
  if (suf && /\d/.test(s)) { mult = { k: 1e3, m: 1e6, b: 1e9, t: 1e12 }[suf[0].toLowerCase()]; s = s.slice(0, -1); }
  if (commaDecimal) s = s.replace(/\.(?=\d{3}\b)/g, '').replace(',', '.');
  else s = s.replace(/,(?=\d{3}\b)/g, '');
  if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s)) return NaN;
  return sign * parseFloat(s) * mult;
}

// Does a column use a comma as its DECIMAL separator (EU locale)? Decides the
// comma-vs-dot ambiguity per column by content, so "copy cells from Excel" (which
// arrives TAB-separated, never ';') still reads "1.234,50" / "4,6" correctly.
// "1,234" stays ambiguous → left as thousands; a lone comma+3-digits is not proof.
function columnCommaDecimal(cells) {
  let seen = 0, dec = 0;
  for (const raw of cells) {
    const s = String(raw == null ? '' : raw).replace(/[€$£¥%\s]/g, '').trim();
    if (!s) continue;
    seen++;
    if (/^[+-]?\d{1,3}(\.\d{3})+,\d+$/.test(s) || /^[+-]?\d+,\d{1,2}$/.test(s) || /^[+-]?\d+,\d{4,}$/.test(s)) dec++;
  }
  return seen > 0 && dec / seen >= 0.5;
}

// A column is numeric when most of its non-blank cells parse as numbers. Blank /
// error tokens ("N/A", "#DIV/0!", "-") are skipped, not counted against it.
function columnIsNumeric(grid, col, commaDecimal) {
  let seen = 0, num = 0;
  for (let r = 0; r < grid.length; r++) {
    const cell = grid[r][col];
    if (isBlankToken(cell)) continue;
    seen++;
    if (Number.isFinite(parseNum(cell, commaDecimal))) num++;
  }
  return seen > 0 && num / seen >= 0.6;
}

function dateLike(raw, header) {
  const s = String(raw == null ? '' : raw).trim(); if (!s) return false;
  const h = String(header || '').toLowerCase();
  if (/^(19|20)\d{2}$/.test(s)) return /(year|date|time|period|fiscal|fy)/.test(h);
  if (/^(q[1-4]|h[12]|w\d{1,2})$/i.test(s)) return /(quarter|period|week|date|time)/.test(h);
  if (!(/\d[-/.]\d/.test(s) || /[a-z]{3,}/i.test(s) || /t\d{1,2}:\d{2}/i.test(s))) return false;
  return Number.isFinite(Date.parse(s));
}

function profileTable(text, opts) {
  const raw = String(text || '').trim();
  if (!raw) return { shape: 'empty', rows: 0, columns: 0, missing: 0, fields: [] };
  const delim = opts.delimiter === 'auto' ? detectDelim(raw) : (DELIM_MAP[opts.delimiter] || ',');
  const semicolon = delim === ';';
  let grid = splitTable(raw, delim); if (opts.transpose) grid = transposeGrid(grid);
  if (!grid.length) return { shape: 'empty', rows: 0, columns: 0, missing: 0, fields: [] };
  const width = Math.min(MAX_COLS, grid.reduce((m, r) => Math.max(m, r.length), 0));
  grid = grid.map((r) => { const c = r.slice(0, width); while (c.length < width) c.push(''); return c; });
  let header, body;
  if (opts.hasHeader && grid.length > 1) { header = grid[0].map((h, i) => String(h).trim() || `Column ${i + 1}`); body = grid.slice(1); }
  else { header = grid[0].map((_, i) => i === 0 ? 'Category' : `Series ${i}`); body = grid; }
  body = body.slice(0, MAX_ROWS);
  const fields = [], totalRows = body.length;
  for (let c = 0; c < width; c++) {
    const cells = body.map((r) => r[c]), commaDecimal = semicolon || columnCommaDecimal(cells);
    const present = cells.filter((cell) => !isBlankToken(cell));
    const numeric = present.filter((cell) => Number.isFinite(parseNum(cell, commaDecimal)));
    const dates = present.filter((cell) => dateLike(cell, header[c]));
    const booleans = present.filter((cell) => /^(true|false|yes|no)$/i.test(String(cell).trim()));
    const unique = new Set(present.map((cell) => String(cell).trim())).size;
    const h = String(header[c] || '').toLowerCase();
    const ratio = present.length ? numeric.length / present.length : 0;
    const dateRatio = present.length ? dates.length / present.length : 0;
    let type = dateRatio >= .6 ? (dates.some((cell) => /[t ]\d{1,2}:\d{2}/i.test(String(cell))) ? 'datetime' : 'date')
      : ratio >= .6 ? 'number' : booleans.length === present.length && present.length ? 'boolean' : 'string';
    const percent = present.filter((cell) => /%/.test(String(cell))).length;
    const currency = present.filter((cell) => /[€$£¥]/.test(String(cell))).length;
    const integers = numeric.filter((cell) => Number.isInteger(parseNum(cell, commaDecimal))).length;
    let format = type === 'date' ? 'date' : type === 'datetime' ? 'datetime' : type === 'boolean' ? 'boolean'
      : type !== 'number' ? 'plain' : percent > present.length / 2 ? 'percent' : currency > present.length / 2 ? 'currency'
        : integers === numeric.length ? 'integer' : 'decimal';
    let role = type === 'number' ? 'measure' : type === 'date' || type === 'datetime' ? 'time' : 'dimension';
    if (/(error|stderr|std dev|standard deviation|uncertainty|margin|lower|upper|low|high|minimum|maximum)/.test(h)) role = 'uncertainty';
    else if (/(^|[ _-])(id|uuid|guid|code|sku|key|index)([ _-]|$)/.test(h) && unique >= Math.max(2, present.length * .8)) role = 'identifier';
    else if (/(date|time|year|quarter|month|week|period|timestamp)/.test(h) && (dateRatio >= .35 || unique > 1)) role = 'time';
    else if (/(series|segment|group|cohort|variant|region|team)/.test(h) && type === 'string') role = 'series';
    fields.push({ name: header[c], type, role, format, missing: totalRows - present.length, unique });
  }
  const measures = fields.filter((f) => f.role === 'measure' || f.role === 'uncertainty');
  const dimensions = fields.filter((f) => f.role === 'dimension' || f.role === 'series' || f.role === 'time');
  const firstValues = body.map((r) => String(r[0] == null ? '' : r[0]).trim()).filter(Boolean);
  const repeatedFirst = new Set(firstValues).size < firstValues.length;
  const textFields = fields.filter((f) => f.type === 'string');
  let shape = !totalRows ? 'empty' : width === 1 ? 'single'
    : repeatedFirst && textFields.length >= 2 && measures.length >= 1 ? 'long'
      : measures.length >= 4 && dimensions.length >= 1 ? 'matrix' : 'wide';
  return { shape, rows: totalRows, columns: width,
    missing: fields.reduce((n, f) => n + f.missing, 0), fields };
}

function dataProfileSummary(profile) {
  const measures = profile.fields.filter((f) => f.role === 'measure').length;
  const times = profile.fields.filter((f) => f.role === 'time').length;
  const parts = [`${profile.rows} row${profile.rows === 1 ? '' : 's'}`, `${profile.columns} column${profile.columns === 1 ? '' : 's'}`];
  if (times) parts.push(`${times} time field${times === 1 ? '' : 's'}`);
  if (measures) parts.push(`${measures} measure${measures === 1 ? '' : 's'}`);
  if (profile.missing) parts.push(`${profile.missing} missing`);
  return parts.join(' · ');
}

function recommendChart(profile, requestedIntent) {
  const fields = profile.fields || [];
  const measures = fields.filter((f) => f.role === 'measure');
  const uncertainty = fields.filter((f) => f.role === 'uncertainty');
  const errorMagnitude = uncertainty.filter((f) => /(error|stderr|std dev|standard deviation|uncertainty|margin)/i.test(f.name));
  const lowerBounds = uncertainty.filter((f) => /(^|[ _-])(low|lower|min|minimum)([ _-]|$)/i.test(f.name));
  const upperBounds = uncertainty.filter((f) => /(^|[ _-])(high|upper|max|maximum)([ _-]|$)/i.test(f.name));
  const times = fields.filter((f) => f.role === 'time');
  const dimensions = fields.filter((f) => f.role === 'dimension' || f.role === 'series');
  const x = (times[0] || dimensions[0] || measures[0]);
  const valueFields = measures.concat(uncertainty);
  const mapping = {
    x: x ? [x.name] : [], y: measures.slice(x && x.role === 'measure' ? 1 : 0).map((f) => f.name),
    z: measures[2] ? [measures[2].name] : [], size: measures[3] ? [measures[3].name] : [],
    colour: fields.filter((f) => f.role === 'series').slice(0, 1).map((f) => f.name),
    facet: fields.filter((f) => f.role === 'series').slice(0, 1).map((f) => f.name),
    label: dimensions[0] ? [dimensions[0].name] : [],
    error: errorMagnitude.slice(0, 1).map((f) => f.name), frame: times.slice(1, 2).map((f) => f.name),
    camera: valueFields.slice(0, 1).map((f) => f.name),
  };
  if (!mapping.y.length && measures.length) mapping.y = measures.map((f) => f.name);
  const temporal = times.length > 0;
  const partWhole = fields.some((f) => f.format === 'percent' || /(share|percent|percentage|portion|mix)/i.test(f.name));
  let intent = requestedIntent === 'manual' ? 'auto' : requestedIntent;
  if (intent === 'auto') {
    if (temporal && measures.length) intent = 'trend';
    else if (partWhole && measures.length && profile.rows <= 12) intent = 'composition';
    else if (!dimensions.length && !times.length && measures.length >= 2) intent = 'relationship';
    else if (!dimensions.length && measures.length === 1 && profile.rows >= 8) intent = 'distribution';
    else intent = 'compare';
  }
  let renderMode = 'vector', chartType = 'bar', label = 'Bar chart', reason = '', confidence = measures.length ? 'high' : 'low';
  if (intent === 'trend') {
    renderMode = measures.length > 4 ? 'statistical' : 'vector'; chartType = measures.length > 4 ? 'small-multiples' : 'line'; label = measures.length > 4 ? 'Small multiple trends' : 'Line chart';
    reason = temporal ? `“${times[0].name}” reads as time, so position preserves its order and ${measures.length || 'the'} measure${measures.length === 1 ? '' : 's'} can be followed across it.` : 'The first dimension supplies an ordered path for showing change.';
    confidence = temporal ? 'high' : 'medium';
  } else if (intent === 'composition') {
    renderMode = 'vector'; chartType = profile.rows <= 8 && measures.length <= 1 ? 'donut' : 'bar'; label = chartType === 'donut' ? 'Donut chart' : '100% stacked bars';
    reason = chartType === 'donut' ? `${profile.rows} parts fit a compact whole; the values should be non-negative and share one denominator.` : 'There are too many parts for a reliable angle comparison, so a common 100% baseline is clearer.';
    confidence = partWhole ? 'high' : 'medium';
  } else if (intent === 'distribution') {
    renderMode = 'statistical'; chartType = measures.length > 1 ? 'distribution-facets' : 'rug-histogram'; label = measures.length > 1 ? 'Distribution facets' : 'Histogram + observations';
    reason = `${profile.rows} observations can be binned while the rug retains the underlying values${measures.length > 1 ? '; facets keep measures separate' : ''}.`;
  } else if (intent === 'relationship') {
    renderMode = 'statistical'; chartType = 'regression'; label = 'Scatter + regression';
    reason = measures.length >= 2 ? `“${measures[0].name}” and “${measures[1].name}” are quantitative, so position can show their association without binning.` : 'A relationship needs at least two quantitative fields; add or map another measure.';
    confidence = measures.length >= 2 && profile.rows >= 3 ? 'high' : 'low';
    if (measures.length >= 2) { mapping.x = [measures[0].name]; mapping.y = [measures[1].name]; }
  } else if (intent === 'uncertainty') {
    if (lowerBounds.length && upperBounds.length) {
      renderMode = 'statistical'; chartType = 'range-band'; label = 'Range / uncertainty band';
      mapping.y = [lowerBounds[0].name].concat(measures.slice(0, 1).map((f) => f.name), [upperBounds[0].name]);
      mapping.error = [];
      reason = `“${lowerBounds[0].name}” and “${upperBounds[0].name}” read as bounds; the band preserves them${measures[0] ? ` around “${measures[0].name}”` : ''}.`;
      confidence = 'high';
    } else if (errorMagnitude.length && measures.length) {
      renderMode = 'vector'; chartType = temporal ? 'line' : 'bar'; label = temporal ? 'Line with uncertainty whiskers' : 'Bars with uncertainty whiskers';
      mapping.y = [measures[0].name]; mapping.error = [errorMagnitude[0].name];
      reason = `“${errorMagnitude[0].name}” reads as an error magnitude, so it becomes whiskers around “${measures[0].name}” rather than another series.`;
      confidence = 'high';
    } else {
      renderMode = 'statistical'; chartType = measures.length >= 2 ? 'range-band' : 'control-band'; label = chartType === 'range-band' ? 'Range / uncertainty band' : 'Control band';
      mapping.y = measures.slice(0, Math.max(1, Math.min(3, measures.length))).map((f) => f.name);
      reason = measures.length >= 2 ? 'Two or more measures can define a low/high range; confirm their order in Y / measures.' : 'One measure can be compared with its process mean and variation.';
      confidence = 'medium';
    }
  } else if (intent === 'story') {
    renderMode = 'cinematic'; chartType = 'flythrough3d'; label = 'Cinematic data flight';
    reason = `${x ? `“${x.name}”` : 'Row order'} supplies the route and “${(measures[0] || {}).name || 'the first measure'}” drives camera altitude; other measures remain comparison lanes.`;
    confidence = profile.rows >= 3 && measures.length ? 'high' : 'low';
  } else {
    renderMode = measures.length > 1 && profile.rows > 16 ? 'statistical' : 'vector'; chartType = renderMode === 'statistical' ? 'dot-strip' : 'bar'; label = renderMode === 'statistical' ? 'Editorial dot comparison' : 'Bar chart';
    reason = dimensions.length || times.length ? `“${(dimensions[0] || times[0]).name}” supplies comparable categories and a common value axis makes differences easy to judge.` : 'Rows can be compared on one common quantitative baseline.';
  }
  return { intent, renderMode, chartType, label, reason, confidence, mappings: mapping };
}

function transposeGrid(grid) {
  const cols = grid.reduce((m, r) => Math.max(m, r.length), 0);
  const out = [];
  for (let c = 0; c < cols; c++) out.push(grid.map((r) => (r[c] == null ? '' : r[c])));
  return out;
}

// Parse the raw pasted text into { categories, series, numericCols, note }.
function buildModel(text, opts) {
  const raw = String(text || '').trim();
  if (!raw) return { categories: [], series: [], numericCols: [], note: 'Paste a table to draw a chart.' };

  const delim = opts.delimiter === 'auto' ? detectDelim(raw) : (DELIM_MAP[opts.delimiter] || ',');
  const semicolon = delim === ';';
  let grid = splitTable(raw, delim);
  if (opts.transpose) grid = transposeGrid(grid);
  if (!grid.length) return { categories: [], series: [], numericCols: [], note: 'No rows found.' };

  // Normalise ragged rows to a common width. reduce() (not Math.max(...spread))
  // so a huge paste can't overflow the argument-count limit and throw. Bound the
  // column and (below) row counts so an oversized table can't freeze the render.
  const width = Math.min(MAX_COLS, grid.reduce((m, r) => Math.max(m, r.length), 0));
  grid = grid.map((r) => { const c = r.slice(0, width); while (c.length < width) c.push(''); return c; });

  let header, body;
  if (opts.hasHeader && grid.length > 1) {
    header = grid[0].map((h, i) => String(h).trim() || `Column ${i + 1}`);
    body = grid.slice(1);
  } else {
    header = grid[0].map((_, i) => (i === 0 ? 'Category' : `Series ${i}`));
    body = grid;
  }
  if (!body.length) return { categories: [], series: [], numericCols: [], note: 'No data rows found.' };
  let note = '';
  if (body.length > MAX_ROWS) { note = `Showing the first ${MAX_ROWS} of ${body.length} rows.`; body = body.slice(0, MAX_ROWS); }

  // Decide comma-vs-dot decimals per column (EU sheets), then which are numeric.
  const commaDecCol = [];
  for (let c = 0; c < width; c++) commaDecCol[c] = semicolon || columnCommaDecimal(body.map((r) => r[c]));
  const numericFlag = [];
  for (let c = 0; c < width; c++) numericFlag[c] = columnIsNumeric(body, c, commaDecCol[c]);

  // ── column roles (explicit overrides fall back to auto-detection) ──────────
  const labelIdx = orDefault(resolveColRef(opts.labelCol, header), 0);
  const pivotIdx = resolveColRef(opts.pivotCol, header);
  const errIdx   = resolveColRef(opts.errorCol, header);   // ± error per value (not plotted as a series)
  const zIdx     = resolveColRef(opts.zCol, header);       // explicit depth channel
  const sizeIdx  = resolveColRef(opts.sizeCol, header);    // explicit size channel
  const chosen   = resolveColList(opts.seriesCols, header);

  // Category / label column (col 0 by default; a numeric label like a Year still
  // names the x-axis rather than being plotted).
  const categories = body.map((r, i) => {
    const v = String(r[labelIdx] == null ? '' : r[labelIdx]).trim();
    return v || `Item ${i + 1}`;
  });

  // Series = the user's chosen columns (numeric only), else every numeric column
  // other than the label. numericCols keeps ALL numeric columns (scatter x/y/size).
  const colSeries = (cols) => cols.map((c) => ({ name: header[c], values: body.map((r) => nOrNull(parseNum(r[c], commaDecCol[c]))) }));
  const mappedElsewhere = new Set([zIdx, sizeIdx].filter((c) => c >= 0));
  const series = colSeries((chosen.length ? chosen : range(width)).filter((c) =>
    c !== labelIdx && c !== pivotIdx && c !== errIdx && numericFlag[c] && (chosen.length || !mappedElsewhere.has(c))));
  // Scatter-like renderers consume numericCols positionally. Put explicit
  // x/y/z/size mappings first, then retain every remaining numeric field so a
  // mode switch never throws source data away.
  const numericOrder = uniqueInOrder([
    ...(numericFlag[labelIdx] ? [labelIdx] : []), ...chosen.filter((c) => numericFlag[c]),
    ...(numericFlag[zIdx] ? [zIdx] : []), ...(numericFlag[sizeIdx] ? [sizeIdx] : []),
    ...range(width).filter((c) => numericFlag[c]),
  ]);
  const numericCols = colSeries(numericOrder);
  // ± error column → magnitudes aligned to rows (whiskers in the template). Only the
  // standard wide path carries it; pivot/single-col reshapes return before this.
  const errorValues = errIdx >= 0 && errIdx !== labelIdx
    ? body.map((r) => { const e = nOrNull(parseNum(r[errIdx], commaDecCol[errIdx])); return e == null ? null : Math.abs(e); })
    : null;

  // ── reshape: long/tidy → wide ──────────────────────────────────────────────
  // Explicit pivot (a column the user chose) OR auto (a REPEATED label column + a
  // text "key" column + a numeric value column → one series per key) - the most
  // common "my data won't chart" case for pasted spreadsheet extracts.
  const wantPivot = pivotIdx >= 0 && pivotIdx !== labelIdx;
  if (wantPivot || new Set(categories).size < categories.length) {
    const keyCol = wantPivot ? pivotIdx : firstIndex(width, (c) => c !== labelIdx && !numericFlag[c]);
    const valCol = (chosen.find((c) => numericFlag[c] && c !== labelIdx && c !== keyCol)) ??
                   firstIndex(width, (c) => c !== labelIdx && c !== keyCol && numericFlag[c]);
    if (keyCol != null && keyCol >= 0 && valCol != null && valCol >= 0) {
      const p = pivotRows(body, labelIdx, keyCol, valCol, commaDecCol);
      if (p) return { categories: p.categories, categoryField: header[labelIdx], series: p.series, numericCols,
        note: appendNote(note, `Pivoted long-format data by “${header[keyCol]}” into ${p.series.length} series.`) };
    }
  }

  // A single value column (the only numeric column is the label) → chart it against
  // row numbers instead of treating the numbers as labels and finding "no series".
  if (!series.length && numericFlag[labelIdx]) {
    const only = { name: header[labelIdx] === 'Category' ? 'Value' : header[labelIdx],
      values: body.map((r) => nOrNull(parseNum(r[labelIdx], commaDecCol[labelIdx]))) };
    return { categories: body.map((_, i) => String(i + 1)), categoryField: 'Row', series: [only], numericCols,
      note: appendNote(note, 'Charted a single value column with row numbers as labels.') };
  }

  // Diagnostics - turn silent mis-parses into a nudge the user can act on.
  if (!series.length && !numericCols.length) {
    note = appendNote(note, 'No numeric columns found - is the first row a header, and are the values numbers?');
  } else if (!series.length) {
    note = appendNote(note, 'The only numeric column is the label - pick a Series column, or add data columns.');
  } else if (opts.hasHeader && headerLooksNumeric(header, numericFlag)) {
    note = appendNote(note, 'First row looks like data - turn off “First row is a header” if a row is missing.');
  } else if (!opts.hasHeader && firstRowLooksLikeHeader(body, numericFlag)) {
    note = appendNote(note, 'First row looks like column names - turn on “First row is a header”.');
  }
  return { categories, categoryField: header[labelIdx], series, numericCols, errorValues, note };
}

function range(n) { const a = []; for (let i = 0; i < n; i++) a.push(i); return a; }
function orDefault(i, d) { return i >= 0 ? i : d; }
// Resolve a column reference - a 1-based number OR a case-insensitive header name -
// to a 0-based index, or -1 when blank / unknown.
function resolveColRef(ref, header) {
  const s = String(ref == null ? '' : ref).trim();
  if (!s) return -1;
  if (/^\d+$/.test(s)) { const n = parseInt(s, 10) - 1; return (n >= 0 && n < header.length) ? n : -1; }
  const lc = s.toLowerCase();
  return header.findIndex((h) => String(h).trim().toLowerCase() === lc);
}
function resolveColList(ref, header) {
  return String(ref == null ? '' : ref).split(',').map((s) => resolveColRef(s, header)).filter((i) => i >= 0);
}
// Pivot long rows into wide: category = labelIdx column, one series per unique
// keyCol value, cell = valCol. null when the result has <2 or >40 series.
function pivotRows(body, labelIdx, keyCol, valCol, commaDecCol) {
  const catOf = (r) => String(r[labelIdx] == null ? '' : r[labelIdx]).trim() || 'Item';
  const keyOf = (r) => String(r[keyCol] == null ? '' : r[keyCol]).trim() || '-';
  const cats = uniqueInOrder(body.map(catOf));
  const keys = uniqueInOrder(body.map(keyOf));
  if (keys.length < 2 || keys.length > 40) return null;
  const ci = new Map(cats.map((c, i) => [c, i]));
  const ki = new Map(keys.map((k, i) => [k, i]));
  const series = keys.map((k) => ({ name: k, values: cats.map(() => null) }));
  body.forEach((r) => {
    const ii = ci.get(catOf(r)), jj = ki.get(keyOf(r));
    if (ii != null && jj != null) series[jj].values[ii] = nOrNull(parseNum(r[valCol], commaDecCol[valCol]));
  });
  return { categories: cats, series };
}

function firstIndex(n, pred) { for (let i = 0; i < n; i++) if (pred(i)) return i; return null; }
function uniqueInOrder(arr) { const seen = new Set(), out = []; for (const v of arr) if (!seen.has(v)) { seen.add(v); out.push(v); } return out; }
function appendNote(a, b) { return a ? `${a} ${b}` : b; }
// The "header" cells sitting over numeric columns are themselves numeric → the
// first row is probably data, not headers.
function headerLooksNumeric(header, numericFlag) {
  let checked = 0, numeric = 0;
  for (let c = 1; c < header.length; c++) {
    if (!numericFlag[c]) continue;
    checked++;
    if (Number.isFinite(parseNum(header[c], false))) numeric++;
  }
  return checked > 0 && numeric === checked;
}
// The inverse: header is off but the first DATA row is text over numeric columns
// → it is probably a header the user forgot to flag.
function firstRowLooksLikeHeader(body, numericFlag) {
  if (body.length < 2) return false;
  let checked = 0, textish = 0;
  for (let c = 1; c < numericFlag.length; c++) {
    if (!numericFlag[c]) continue;
    checked++;
    if (!Number.isFinite(parseNum(body[0][c], false))) textish++;
  }
  return checked > 0 && textish === checked;
}

// Bounds so an oversized paste can't overflow argument limits or freeze the render.
const MAX_ROWS = 4000, MAX_COLS = 256;

// null (not 0) for a blank/unparseable cell so gaps stay gaps in a line chart.
function nOrNull(n) { return Number.isFinite(n) ? n : null; }

// ── config normalisation ─────────────────────────────────────────────────────

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
function num(v, d) { const n = parseFloat(v); return Number.isFinite(n) ? n : d; }
function isHex(s) { return typeof s === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(s.trim()); }

// Legend position: a 2-char side+alignment code (tl/tc/tr/bl/bc/br/lt/lc/lb/rt/rc/rb).
// Old single-word values (bottom/top/left/right) map to their centred forms.
const LEGEND_POS = new Set(['tl', 'tc', 'tr', 'bl', 'bc', 'br', 'lt', 'lc', 'lb', 'rt', 'rc', 'rb']);
function normLegendPos(v) {
  v = String(v == null ? '' : v).toLowerCase().trim();
  const legacy = { bottom: 'bc', top: 'tc', left: 'lc', right: 'rc' };
  if (legacy[v]) return legacy[v];
  return LEGEND_POS.has(v) ? v : 'bc';
}

const STYLE_PRESETS = {
  'brand-default': {},
  editorial: {
    showGrid: false, showAxes: true, shadow: 'none', cornerRadius: 0,
    lineWidth: 2, titleSize: 40, titleWeight: 650, labelSize: 20,
    legendPosition: 'bc', legendGap: 30,
  },
  technical: {
    showGrid: true, showAxes: true, shadow: 'none', cornerRadius: 0,
    lineWidth: 2, titleSize: 30, titleWeight: 650, labelSize: 17,
    tickCount: 7, legendMono: true, differentiate: 'both',
  },
  poster: {
    showGrid: false, showAxes: false, showValues: true, shadow: 'soft',
    cornerRadius: 12, lineWidth: 6, pointSize: 16, titleSize: 50,
    titleWeight: 800, labelSize: 27, legendGap: 34, barPadding: 0.28,
  },
  'iso-vector': {
    shadow: 'none', depth3d: 44, cornerRadius: 2,
  },
  'studio-3d': {
    sceneMaterial: 'matte', sceneRoughness: 0.58, sceneMetalness: 0.04,
    sceneShadows: true,
  },
  'glass-3d': {
    sceneMaterial: 'glass', sceneRoughness: 0.12, sceneMetalness: 0.06,
    sceneShadows: true,
  },
};

// A style supplies defaults, never a destructive macro. Any control the user
// actually changed (`isDirty`) wins; switching style can therefore never erase
// deliberate axis, label, palette or motion choices. Brand governance still
// resolves above both through the theme compiler below.
function applyStyleDefaults(cfg, dirty) {
  const preset = STYLE_PRESETS[cfg.chartStyle] || STYLE_PRESETS['brand-default'];
  for (const [key, value] of Object.entries(preset)) if (!dirty[key]) cfg[key] = value;
  if (cfg.chartStyle === 'iso-vector') {
    if (!dirty.barStyle && (cfg.chartType === 'bar' || cfg.chartType === 'bar-horizontal')) cfg.barStyle = 'iso3d';
    if (!dirty.pieStyle && (cfg.chartType === 'pie' || cfg.chartType === 'donut')) cfg.pieStyle = 'iso3d';
  }
  return cfg;
}

function buildConfig(inp, dirty) {
  const W = clamp(Math.round(num(inp.width, 1280)), 100, 8000);
  const H = clamp(Math.round(num(inp.height, 800)), 100, 8000);
  const transparent = inp.transparentBg === true || inp.transparentBg === 'true';
  const background = isHex(inp.background) ? inp.background.trim() : '#ffffff';
  // Blank text colour → 'auto': the template contrasts it against the background,
  // so titles/axes/labels/legend/gridlines stay legible on any background without
  // the user colouring each one. A real hex overrides.
  const textColor = isHex(inp.textColor) ? inp.textColor.trim() : 'auto';
  // Manual categorical palette slots (Colour 1..6) - blank = brand palette there.
  const paletteSlots = ['palette1', 'palette2', 'palette3', 'palette4', 'palette5', 'palette6']
    .map((k) => (isHex(inp[k]) ? inp[k].trim().toLowerCase() : null));

  const cfg = {
    chartType:      String(inp.chartType || 'bar'),
    chartStyle:     String(inp.chartStyle || 'brand-default'),
    stackMode:      String(inp.stackMode || 'grouped'),
    curve:          String(inp.curve || 'monotone'),
    showPoints:     inp.showPoints === true || inp.showPoints === 'true',
    pointSize:      clamp(num(inp.pointSize, 10), 2, 48),
    sizeBy:         String(inp.sizeBy || 'uniform'),
    lineWidth:      clamp(num(inp.lineWidth, 3), 1, 16),
    fillOpacity:    clamp(num(inp.fillOpacity, 85), 0, 100) / 100,
    donutRadius:    clamp(num(inp.donutRadius, 0.55), 0, 0.9),
    sliceGap:       clamp(num(inp.sliceGap, 1), 0, 24),
    cornerRadius:   clamp(num(inp.cornerRadius, 3), 0, 40),
    barPadding:     clamp(num(inp.barPadding, 0.2), 0, 0.9),
    barGap:         clamp(num(inp.barGap, 0.08), 0, 0.8),
    paletteSlots,
    binCount:       clamp(Math.round(num(inp.binCount, 0)), 0, 60),
    paretoCumulative: inp.paretoCumulative !== false && inp.paretoCumulative !== 'false',
    paretoThreshold: clamp(num(inp.paretoThreshold, 80), 0, 100),
    bulletTarget: Math.max(0, num(inp.bulletTarget, 100)),
    bulletBands: inp.bulletBands !== false && inp.bulletBands !== 'false',
    rangeMidpoint: inp.rangeMidpoint !== false && inp.rangeMidpoint !== 'false',
    sort:           String(inp.sort || 'none'),
    labelLayout:    String(inp.labelLayout || 'auto'),
    labelReserve:   clamp(num(inp.labelReserve, 0), 0, 60),
    labelLines:     clamp(Math.round(num(inp.labelLines, 2)), 1, 4),
    barThickness:   clamp(num(inp.barThickness, 0), 0, 400),
    barStyle:       String(inp.barStyle || 'flat'),
    pieStyle:       String(inp.pieStyle || 'flat'),
    depth3d:        clamp(num(inp.depth3d, 0), 0, 160),
    reference:      String(inp.reference || ''),          // reference lines & bands (one per line)
    trend:          String(inp.trend || 'none'),          // none/linear/poly2/exp/log/power/movavg - fitted trend line
    errorColumn:    String(inp.errorColumn || ''),        // column name/number holding the ± error per value
    frameColumn:    String(inp.frameColumn || ''),        // column whose distinct values become animation keyframes
    animSpeed:      clamp(num(inp.animSpeed, 1.5), 0.3, 8),// seconds each keyframe holds before morphing
    frameLabelShow: inp.frameLabelShow !== false && inp.frameLabelShow !== 'false',
    frameLabelSize: clamp(num(inp.frameLabelSize, 36), 8, 160),
    frameLabelWeight: clamp(Math.round(num(inp.frameLabelWeight, 700)), 100, 900),
    frameLabelColor: isHex(inp.frameLabelColor) ? inp.frameLabelColor.trim() : '',
    frameLabelPos:  String(inp.frameLabelPos || 'tr'),      // tl / tr / bl / br
    animEase:       String(inp.animEase || 'smooth'),      // smooth / linear / steps
    animDirection:  String(inp.animDirection || 'loop'),   // loop / bounce (ping-pong)
    motionPreset:   String(inp.motionPreset || 'none'),    // real 3-D reveal/orbit clock
    cameraProjection: String(inp.cameraProjection || 'perspective'),
    cameraAzimuth:  clamp(num(inp.cameraAzimuth, 38), -180, 180),
    cameraElevation: clamp(num(inp.cameraElevation, 24), 5, 80),
    flightSeries:   String(inp.flightSeries || ''),
    flightHeight:   clamp(num(inp.flightHeight, 0.85), 0.2, 3),
    flightLookAhead: clamp(num(inp.flightLookAhead, 1.5), 0.4, 5),
    flightBank:     clamp(num(inp.flightBank, 10), 0, 30),
    flightFov:      clamp(num(inp.flightFov, 54), 28, 82),
    sceneMaterial:  String(inp.sceneMaterial || 'matte'),
    sceneRoughness: clamp(num(inp.sceneRoughness, 0.58), 0, 1),
    sceneMetalness: clamp(num(inp.sceneMetalness, 0.04), 0, 1),
    sceneShadows:   inp.sceneShadows !== false && inp.sceneShadows !== 'false',
    sceneLayout:    String(inp.sceneLayout || 'auto'),      // bars: grid / grouped / stacked / ring; donut: donut / pie / towers / exploded
    scenePose:      String(inp.scenePose || 'hero'),        // named camera pose, or custom (azimuth + elevation)
    sceneFraming:   String(inp.sceneFraming || 'fit'),      // fit / close / room
    sceneStage:     String(inp.sceneStage || 'studio'),     // studio / floor / float / plinth / night
    sceneHighlight: String(inp.sceneHighlight || ''),       // category or series names to pick out
    plotBins:       clamp(Math.round(num(inp.plotBins, 20)), 6, 60),
    plotBinWidth:   clamp(num(inp.plotBinWidth, 24), 6, 64),
    plotBandwidth:  clamp(num(inp.plotBandwidth, 20), 4, 80),
    plotShowRaw:    inp.plotShowRaw !== false && inp.plotShowRaw !== 'false',
    plotConfidenceBand: inp.plotConfidenceBand !== false && inp.plotConfidenceBand !== 'false',
    plotFacetDirection: String(inp.plotFacetDirection || 'rows'),
    plotMotionPreset: String(inp.plotMotionPreset || 'none'),
    timeAxis:       String(inp.timeAxis || 'auto'),        // auto / on / off - parse the label column as dates
    yScaleType:     String(inp.yScaleType || 'linear'),
    yZero:          inp.yZero !== false && inp.yZero !== 'false',
    yMax:           Math.max(0, num(inp.yMax, 0)),
    showGrid:       inp.showGrid !== false && inp.showGrid !== 'false',
    showAxes:       inp.showAxes !== false && inp.showAxes !== 'false',
    tickCount:      clamp(Math.round(num(inp.tickCount, 5)), 2, 12),
    numberFormat:   String(inp.numberFormat || 'auto'),
    xTitle:         String(inp.xTitle || ''),
    yTitle:         String(inp.yTitle || ''),
    palette:        String(inp.palette || 'ordered'),
    paletteBlend:   String(inp.paletteBlend || 'smooth'),  // smooth / vivid / srgb ramp interpolation
    paletteSeed:    isHex(inp.paletteSeed) ? inp.paletteSeed.trim() : '',        // base colour (seed palette + vivid 'from')
    paletteBlendTo: isHex(inp.paletteBlendTo) ? inp.paletteBlendTo.trim() : '',  // vivid 'to' - the second colour
    hueRoute:       inp.hueRoute === 'long' ? 'long' : 'short',                  // vivid hue travel: short / long way round
    colorBy:        String(inp.colorBy || 'series'),
    shadow:         String(inp.shadow || 'none'),          // none / soft / medium / strong / glow
    differentiate:  String(inp.differentiate || 'auto'),   // colour / pattern / both
    colorOverrides: String(inp.colorOverrides || ''),       // JSON map: value → hex (click-to-recolour)
    annotations:    String(inp.annotations || ''),          // JSON map: category → {i,t,fg,bg} (click a data label)
    background,
    textColor,
    transparent,
    strokeWidth:    clamp(num(inp.strokeWidth, 0), 0, 12),
    strokeColor:    isHex(inp.strokeColor) ? inp.strokeColor.trim() : '#ffffff',
    heading:        String(inp.heading || ''),
    subheading:     String(inp.subheading || ''),
    showValues:     inp.showValues === true || inp.showValues === 'true',
    valueSize:      clamp(num(inp.valueSize, 0), 0, 80),         // data-label font size (0 = auto)
    valueOffset:    clamp(num(inp.valueOffset, 0), -40, 160),    // extra gap from the mark
    valueWeight:    clamp(Math.round(num(inp.valueWeight, 600)), 100, 900),
    valueColor:     isHex(inp.valueColor) ? inp.valueColor.trim() : '',   // blank = auto-contrast
    labelSize:      clamp(num(inp.labelSize, 22), 8, 56),
    titleSize:      clamp(num(inp.titleSize, 34), 14, 72),
    titleAlign:     String(inp.titleAlign || 'left'),
    titlePosition:  String(inp.titlePosition || 'top'),
    titleWeight:    clamp(Math.round(num(inp.titleWeight, 700)), 100, 900),
    labelWeight:    clamp(Math.round(num(inp.labelWeight, 500)), 100, 900),
    axisTitleSize:  clamp(num(inp.axisTitleSize, 0), 0, 80),   // 0 = auto
    axisTitleWeight: clamp(Math.round(num(inp.axisTitleWeight, 600)), 100, 900),
    axisTitleColor: isHex(inp.axisTitleColor) ? inp.axisTitleColor.trim() : '',
    showLegend:     inp.showLegend !== false && inp.showLegend !== 'false',
    legendPosition: normLegendPos(inp.legendPosition),
    legendTextSize: clamp(num(inp.legendTextSize, 0), 0, 48),
    legendSwatchSize: clamp(num(inp.legendSwatchSize, 0), 0, 48),
    legendGap:      clamp(num(inp.legendGap, 24), 0, 80),
    legendRadius:   clamp(num(inp.legendRadius, 3), 0, 24),
    legendMono:     inp.legendMono === true || inp.legendMono === 'true',
    legendBold:     inp.legendBold === true || inp.legendBold === 'true',
    legendItalic:   inp.legendItalic === true || inp.legendItalic === 'true',
    legendColor:    isHex(inp.legendColor) ? inp.legendColor.trim() : '',   // blank = auto ink
    width:          W,
    height:         H,
  };
  return applyStyleDefaults(cfg, dirty || {});
}

// ── assemble ─────────────────────────────────────────────────────────────────

// JSON safe to drop verbatim into <script type="application/json">…</script>:
// the only special sequence is a literal "</script", killed by escaping "<".
// Also escape the JS line terminators U+2028/U+2029 for good measure.
function safeJson(obj) {
  return JSON.stringify(obj)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

// ── brand-driven palettes (host.color/host.tokens, engine ≥ 1.40) ────────────
// Resolves the ACTIVE brand's colours ONCE in onInit so every palette feels
// native to the brand instead of the shipped SUSE hues:
//   • spectrum   - categorical hues (color.spectrum.*), topped up via distinct()
//   • ramps      - sequential/diverging/mono ramps built from the brand's
//                  primary/secondary with host.color.ramp()/mix() (variations of
//                  one brand hue + combinations of two) - light→dark anchor stops
//                  the template feeds to d3 exactly like the shipped RAMPS
//   • swatches   - a curated brand-swatch list for the click-to-recolour picker
//   • monochrome - fewer than 4 spectrum hues → the template auto-adds patterns
// A brand/host that can't supply a piece leaves it null and the template falls
// back to its shipped hand-tuned palette (older shells stay byte-identical).
//
// A design system with several colourways (plans/319) also gives a FAMILY: every
// colourway's lead in the current look, from host.tokens.family. The leads head
// the spectrum the design system authored, or, when it authored none, the
// template's shipped hues (cfg.brandLeads). They follow Primary and Secondary in
// the ordered palette and supply the second hue of the alternate and diverging ramps.
// Fewer than two leads is no family, so a one-lead design system charts exactly
// as it did before.
let BRAND = null;
// The colours BRAND was resolved under. A colourway or look switch changes them,
// and onInput re-resolves BRAND without re-running onInit (which would reset the
// user's inputs).
let BRAND_KEY = null;

async function brandKey() {
  try {
    if (typeof host === 'undefined' || !host || !host.tokens || !host.tokens.resolve) return '';
    const read = async (slot) => {
      try { const v = await host.tokens.resolve('{color.semantic.' + slot + '}'); return typeof v === 'string' ? v : JSON.stringify(v == null ? null : v); }
      catch (e) { return ''; }
    };
    return JSON.stringify([await read('primary'), await read('secondary'), await read('surface')]);
  } catch (e) { return ''; }
}

// The family of leads, the artefact's own colourway first, then the others in the
// design system's order. [] for fewer than two, or a shell without the API.
async function brandLeads() {
  try {
    if (typeof host === 'undefined' || !host || !host.tokens || typeof host.tokens.family !== 'function') return [];
    const family = (await host.tokens.family('primary')) || [];
    const ordered = family.filter((m) => m && m.active).concat(family.filter((m) => m && !m.active));
    const out = [], seen = new Set();
    for (const m of ordered) {
      const v = normHex(m.value);
      if (!v || seen.has(v)) continue;
      seen.add(v); out.push({ name: String(m.name || v), value: v, active: !!m.active });
    }
    return out.length >= 2 ? out : [];
  } catch (e) { return []; }
}

function normHex(x) {
  return typeof x === 'string' && /^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(x.trim()) ? x.trim().toLowerCase() : null;
}

// The slots the chart draws its ground and its words in. A colour role Lolly reads as
// one of these is never a series colour: a series in the background colour vanishes.
const GROUND_SLOTS = ['surface', 'text', 'muted', 'edge'];

// The design system's colour roles (plans/352) for the 'roles' palette: each declared
// role's colour in this colourway and look, in the design system's own order. The
// roles come from host.tokens.inspect() (engine 1.323); an older host has none, and
// the palette then draws as Design system - ordered.
async function brandRoles(toHex) {
  try {
    if (typeof host === 'undefined' || !host || !host.tokens || typeof host.tokens.inspect !== 'function') return [];
    const reading = (await host.tokens.inspect()).colourRoles;
    const roles = reading && Array.isArray(reading.roles) ? reading.roles : [];
    const out = [];
    for (const role of roles) {
      if (!role || role.declared !== true || typeof role.path !== 'string') continue;
      const slots = Array.isArray(role.slots) ? role.slots : [];
      if (slots.some((s) => GROUND_SLOTS.indexOf(s) >= 0)) continue;
      let value = null;
      try { value = await host.tokens.resolve('{' + role.path + '}'); } catch (e) { value = null; }
      const hex = typeof value === 'string' ? toHex(value) : null;
      if (hex && out.indexOf(hex) < 0) out.push(hex);
    }
    return out;
  } catch (e) { return []; }
}

// A palette that leads with `first` and carries on with the colours of `rest` it does
// not already hold, so every series still gets a colour of its own.
function leadWith(first, rest) {
  return first.concat((rest || []).filter((v) => first.indexOf(String(v).toLowerCase()) < 0));
}

async function resolveBrandColors() {
  try {
    const c = typeof host !== 'undefined' && host && host.color;
    if (!c || !host.tokens || !host.tokens.colors) return null;
    const swatchesRaw = (await host.tokens.colors()) || [];

    // host.color accepts hex OR oklch()/lch() strings; mix(x,x,0) normalises any
    // resolvable colour to hex (blank/mono brands write oklch() semantic values).
    const toHex = (x) => x ? (normHex(x) || (c.mix ? normHex(c.mix(x, x, 0)) : null)) : null;
    const chroma = (col) => { try { const o = c.oklch && c.oklch(col); return o ? o.c : 0; } catch (e) { return 0; } };
    async function token(path) {
      try { const v = await host.tokens.resolve('{' + path + '}'); return (typeof v === 'string' && v) ? v : null; }
      catch (e) { return null; }
    }
    async function sem(name) { return token('color.semantic.' + name); }

    // ── categorical spectrum (as before; .value is already resolved hex) ────
    const spectrum = [], seen = new Set();
    for (const s of swatchesRaw) {
      const v = normHex(s.value);
      if (!v || seen.has(v)) continue;
      const path = String(s.path || ''), group = String(s.group || '');
      if (path.indexOf('color.spectrum.') !== 0 && group !== 'Spectrum') continue;
      seen.add(v); spectrum.push(v);
    }
    // The family's leads come first in a spectrum the design system authored. With
    // no spectrum of its own the leads alone would be the whole categorical palette,
    // two or three colours where the shipped set has ten, so the spectrum stays
    // empty and the template puts the leads ahead of its shipped hues instead.
    const leads = await brandLeads();
    if (spectrum.length && leads.length) {
      const own = spectrum.filter((v) => !leads.some((l) => l.value === v));
      spectrum.length = 0;
      for (const l of leads) spectrum.push(l.value);
      for (const v of own) spectrum.push(v);
    }
    const roles = await brandRoles(toHex);
    const primary = await sem('primary');
    const surface = (await sem('surface')) || '#ffffff';
    const text    = (await sem('text')) || '#111111';
    const muted   = (await sem('muted')) || text;
    const edge    = (await sem('edge')) || muted;
    const onPrimary = (await sem('on-primary')) || surface;
    let secondary = await sem('secondary');
    const fontBrand = await token('font.brand');
    const fontDisplay = (await token('font.display')) || fontBrand;
    const fontMono = await token('font.mono');
    let active = null;
    try { if (host.tokens.active) active = await host.tokens.active(); } catch (e) { active = null; }
    if (spectrum.length >= 4 && c.distinct && c.deltaE && spectrum.length < 10) {
      const anchor = toHex(primary);
      for (const g of c.distinct(20, anchor ? { anchorHex: anchor } : {})) {
        if (spectrum.length >= 10) break;
        const gh = normHex(g);
        if (gh && spectrum.every(v => c.deltaE(v, gh) >= 0.05)) spectrum.push(gh);
      }
    }

    // ── sequential / diverging / mono ramps from the brand ─────────────────
    // Needs ramp()+mix(); without them the template keeps the shipped ramps.
    let ramps = null;
    if (c.ramp && c.mix && primary) {
      const mix = (a, b, t) => c.mix(a, b, t) || a;
      if (!secondary && c.schemes) { const acc = c.schemes(primary, 'complement'); if (acc && acc[0] && acc[0].hex) secondary = acc[0].hex; }
      if (!secondary && spectrum[1]) secondary = spectrum[1];
      if (!secondary) secondary = primary;
      // The "vibrant" brand hue leads the sequential ramps - the more chromatic of
      // primary/secondary. (SUSE's primary is a near-black ink and its Pine green
      // lives in secondary, so this keeps charts feeling Pine-green, not grey.)
      const vib = chroma(secondary) > chroma(primary) ? secondary : primary;
      // A SECOND, distinct hue for the alternate + diverging ramps: the other
      // semantic hue, or - when that's near-neutral / too close - the most
      // chromatic spectrum hue that's far from vib.
      let second = (vib === secondary) ? primary : secondary;
      // Family first: another colourway's lead, when one stands apart from vib.
      const lead2 = leads.find((l) => !l.active && chroma(l.value) >= 0.04 && (!c.deltaE || c.deltaE(l.value, vib) >= 0.12));
      if (lead2) second = lead2.value;
      else if (chroma(second) < 0.04 || (c.deltaE && c.deltaE(second, vib) < 0.12)) {
        let best = null, bestScore = -1;
        for (const s of (spectrum || [])) {
          if (c.deltaE && c.deltaE(s, vib) < 0.12) continue;
          const sc = chroma(s) + (c.deltaE ? c.deltaE(s, vib) : 0);
          if (sc > bestScore) { bestScore = sc; best = s; }
        }
        if (best) second = best;
      }
      // a light→dark ramp of ONE brand hue (5 OKLab-even anchors = variations)
      const seq = (hue) => c.ramp([mix(hue, surface, 0.88), mix(hue, surface, 0.42), hue, mix(hue, text, 0.42), mix(hue, text, 0.72)], 5, { correctLightness: true });
      ramps = {
        suse:      seq(vib),
        pine:      seq(vib),
        waterhole: seq(second),
        warm:      seq(mix(vib, '#f47a34', 0.5)),   // brand hue biased warm
        cool:      seq(mix(vib, '#2f6bff', 0.5)),   // brand hue biased cool
        mono:      seq(vib),
        // diverging = a COMBINATION of two brand hues through a neutral middle
        diverging: c.ramp([second, mix(second, surface, 0.5), mix(surface, text, 0.05), mix(vib, surface, 0.5), vib], 5, { correctLightness: false }),
      };
      for (const k of Object.keys(ramps)) {
        const r = (ramps[k] || []).map(normHex).filter(Boolean);
        if (r.length >= 3) ramps[k] = r; else { ramps = null; break; }   // junk → shipped ramps
      }
    }

    // ── click-to-recolour swatches ─────────────────────────────────────────
    // Order = "start with the primary set, then the brand's other colours":
    // primary → secondary → the brand's chromatic hues (spectrum/brand palette) →
    // tints & shades of the two lead hues (variations) → a few neutrals for
    // emphasis last. Near-greys are held back so brand HUES lead the picker.
    // The FULL brand palette for the pickers: primary/secondary lead, then EVERY
    // brand swatch (spectrum, brand hues, ramp steps) - chromatic hues first, then
    // the neutral ramp steps - then tint/shade variations of the lead hues, then a
    // few semantic neutrals. Generous cap so the whole palette is selectable.
    const swatches = [], sseen = new Set();
    const pushSwatch = (name, value, path) => {
      const v = toHex(value);
      if (!v || sseen.has(v) || /^#[0-9a-f]{6}00$/i.test(v) || swatches.length >= 64) return;
      sseen.add(v); swatches.push({ name: String(name || v), value: v, path: String(path || '') });
    };
    const primaryHex = toHex(primary), secondaryHex = toHex(secondary);
    const surfaceHex = toHex(surface) || '#ffffff', textHex = toHex(text) || '#111111';
    pushSwatch('Primary', primaryHex, 'color.semantic.primary');
    pushSwatch('Secondary', secondaryHex, 'color.semantic.secondary');
    for (const l of leads) pushSwatch(l.name, l.value, '');   // the other colourways' leads
    for (const s of swatchesRaw) { const hx = toHex(s.value); if (hx && chroma(hx) >= 0.03) pushSwatch(s.name, s.value, s.path); }   // brand hues
    if (c.mix) {                                    // tints + shades = variations of the lead hues
      for (const base of [primaryHex, secondaryHex]) {
        if (!base) continue;
        pushSwatch('Light', c.mix(base, surfaceHex, 0.5));
        pushSwatch('Lighter', c.mix(base, surfaceHex, 0.76));
        pushSwatch('Dark', c.mix(base, textHex, 0.45));
      }
    }
    for (const s of swatchesRaw) { const hx = toHex(s.value); if (hx && chroma(hx) < 0.03) pushSwatch(s.name, s.value, s.path); }   // neutral ramp steps last
    pushSwatch('Muted', toHex(await sem('muted')), 'color.semantic.muted');
    pushSwatch('Ink', textHex, 'color.semantic.text');
    pushSwatch('Paper', surfaceHex, 'color.semantic.surface');

    return {
      spectrum: spectrum.length ? spectrum : null,
      // The family's leads, active first; null without a family.
      leads: leads.length ? leads.map(function (l) { return l.value; }) : null,
      // The declared colour roles a series can take, in brand order; null without any.
      roles: roles.length ? roles : null,
      // The brand's swatches in their AUTHORED order (primary → secondary → brand
      // hues → variations → neutrals) - what the 'ordered' palette (the default)
      // and the recolour picker both follow, so a chart matches the palette the way
      // the brand presents it rather than a re-spaced spectrum.
      ordered: swatches.length ? swatches.map(function (s) { return s.value; }) : null,
      ramps, swatches,
      monochrome: spectrum.length < 4,
      primary: primaryHex, secondary: secondaryHex,
      surface: surfaceHex, text: textHex,
      muted: toHex(muted) || textHex,
      edge: toHex(edge) || toHex(muted) || textHex,
      onPrimary: toHex(onPrimary) || surfaceHex,
      font: { brand: fontBrand || null, display: fontDisplay || null, mono: fontMono || null },
      source: active ? {
        id: String(active.id || ''), label: String(active.label || active.id || ''),
        locked: !!active.locked, headId: active.headId ? String(active.headId) : null,
      } : null,
    };
  } catch (e) {
    return null; // tokens/host unavailable (older shell) - shipped palette
  }
}

// Extrapolate a WHOLE palette from ONE base colour (the 'seed' palette option): a
// spread of distinct categorical hues anchored on the seed, plus light→dark
// sequential ramps and a diverging ramp - the same shapes resolveBrandColors
// builds for the brand, keyed off the user's chosen hue. All host.color calls are
// synchronous; returns null on an older shell so the template keeps the brand
// palette. Surface/text anchors come from the brand (so the ramps sit on the
// brand's paper/ink), falling back to white / near-black.
function seedPalette(seedHex) {
  try {
    const c = typeof host !== 'undefined' && host && host.color;
    const seed = normHex(seedHex);
    if (!c || !seed) return null;
    const surface = (BRAND && BRAND.surface) || '#ffffff';
    const text    = (BRAND && BRAND.text) || '#111111';
    const mix = (a, b, t) => (c.mix ? (normHex(c.mix(a, b, t)) || a) : a);
    // categorical: the seed, then distinct hues anchored on it (perceptually spread)
    const cat = [], seen = new Set();
    const push = (h) => { const x = normHex(h); if (x && !seen.has(x)) { seen.add(x); cat.push(x); } };
    push(seed);
    if (c.distinct) { for (const g of c.distinct(12, { anchorHex: seed })) { if (cat.length >= 12) break; push(g); } }
    else if (c.schemes) { (c.schemes(seed, 'tetrad-4') || []).forEach((a) => push(a && a.hex)); }
    // a second, contrasting hue for the alternate + diverging ramps
    let second = cat[1] || seed;
    if (c.schemes) { const comp = c.schemes(seed, 'complement'); if (comp && comp[0] && comp[0].hex) second = normHex(comp[0].hex) || second; }
    const seq = (hue) => (c.ramp ? c.ramp([mix(hue, surface, 0.88), mix(hue, surface, 0.42), hue, mix(hue, text, 0.42), mix(hue, text, 0.72)], 5, { correctLightness: true }) : null);
    const ramps = {
      suse:      seq(seed),
      pine:      seq(seed),
      waterhole: seq(second),
      warm:      seq(mix(seed, '#f47a34', 0.5)),
      cool:      seq(mix(seed, '#2f6bff', 0.5)),
      mono:      seq(seed),
      diverging: c.ramp ? c.ramp([second, mix(second, surface, 0.5), mix(surface, text, 0.05), mix(seed, surface, 0.5), seed], 5, { correctLightness: false }) : null,
    };
    for (const k of Object.keys(ramps)) { const r = (ramps[k] || []).map(normHex).filter(Boolean); ramps[k] = r.length >= 3 ? r : null; }
    return { categorical: cat.length ? cat : [seed], ramps: ramps.suse ? ramps : null };
  } catch (e) {
    return null;
  }
}

// ── renderer-neutral chart document + resolved brand theme ─────────────────

const SCENE_TYPES = ['bar3d', 'donut3d', 'scatter3d', 'surface3d'];
const CINEMATIC_TYPES = ['flythrough3d', 'ribbon3d', 'constellation3d', 'skyline3d'];
const REAL_3D_TYPES = SCENE_TYPES.concat(CINEMATIC_TYPES);
const PLOT_TYPES = [
  'dot-strip', 'interval', 'range-band', 'difference-area', 'indexed-change',
  'box-observations', 'rug-histogram', 'distribution-facets', 'density-ridges', 'ecdf',
  'small-multiples', 'control-band', 'hexbin', 'density-contour', 'regression',
  'candlestick',
];
const SCENE_TO_VECTOR = {
  bar3d: 'bar', donut3d: 'donut', scatter3d: 'scatter', surface3d: 'heatmap',
  flythrough3d: 'line', ribbon3d: 'area', constellation3d: 'scatter', skyline3d: 'bar',
};

// Renderer mode is an authoring choice, not a second copy of the document. Keep
// one parked type choice for each renderer family: switching mode therefore
// leaves the pasted table and every shared input untouched, while switching back
// restores the exact 2-D/3-D family the user had chosen there. `chartType` used
// to carry the real-3D values directly (<= 1.19); legacyModePatch migrates those
// saved URLs/sessions into the split controls without losing their meaning.
function legacyModePatch(model) {
  const inp = Object.fromEntries(model.map((i) => [i.id, i.value]));
  const oldType = String(inp.chartType || 'bar');
  if (REAL_3D_TYPES.indexOf(oldType) < 0) return {};
  if (CINEMATIC_TYPES.indexOf(oldType) >= 0) return {
    renderMode: 'cinematic', cinematicType: oldType,
    chartType: SCENE_TO_VECTOR[oldType] || 'line',
  };
  return {
    renderMode: 'scene',
    sceneType: oldType,
    chartType: SCENE_TO_VECTOR[oldType] || 'bar',
  };
}

// Saved charts from before the named poses and finishes keep their look: a
// camera angle or a roughness someone set by hand carries on as the Custom
// choice. A 3-D chart paints its own stage, so its background is opaque until
// someone ticks Transparent background; leaving 3-D restores the transparency.
function scenePatch(model, priorPatch) {
  const inp = Object.assign(Object.fromEntries(model.map((i) => [i.id, i.value])), priorPatch || {});
  const dirty = Object.fromEntries(model.map((i) => [i.id, !!i.isDirty]));
  const patch = {};
  if ((dirty.cameraAzimuth || dirty.cameraElevation) && !dirty.scenePose && inp.scenePose !== 'custom') patch.scenePose = 'custom';
  if ((dirty.sceneRoughness || dirty.sceneMetalness) && !dirty.sceneMaterial && inp.sceneMaterial !== 'custom') patch.sceneMaterial = 'custom';
  if (!dirty.transparentBg && !Object.prototype.hasOwnProperty.call(priorPatch || {}, 'transparentBg')) {
    const mode = effectiveChartInputs(inp).mode;
    const want = !(mode === 'scene' || mode === 'cinematic');
    if ((inp.transparentBg === true || inp.transparentBg === 'true') !== want) patch.transparentBg = want;
  }
  return patch;
}

function effectiveChartInputs(inp) {
  const mode = inp.renderMode === 'cinematic' ? 'cinematic'
    : inp.renderMode === 'scene' ? 'scene' : inp.renderMode === 'statistical' ? 'statistical' : 'vector';
  const vectorType = REAL_3D_TYPES.indexOf(String(inp.chartType || 'bar')) >= 0
    ? (SCENE_TO_VECTOR[inp.chartType] || 'bar') : String(inp.chartType || 'bar');
  const sceneType = SCENE_TYPES.indexOf(String(inp.sceneType || 'bar3d')) >= 0
    ? String(inp.sceneType) : 'bar3d';
  const cinematicType = CINEMATIC_TYPES.indexOf(String(inp.cinematicType || 'flythrough3d')) >= 0
    ? String(inp.cinematicType) : 'flythrough3d';
  const plotType = PLOT_TYPES.indexOf(String(inp.plotType || 'dot-strip')) >= 0
    ? String(inp.plotType) : 'dot-strip';
  return { mode, vectorType, sceneType, cinematicType, plotType,
    effectiveType: mode === 'cinematic' ? cinematicType : mode === 'scene' ? sceneType : mode === 'statistical' ? plotType : vectorType };
}

function chartParseOptions(inp) {
  return {
    delimiter: String(inp.delimiter || 'auto'),
    hasHeader: inp.hasHeader !== false && inp.hasHeader !== 'false',
    transpose: inp.transpose === true || inp.transpose === 'true',
    labelCol: String(inp.labelColumn || ''),
    seriesCols: String(inp.seriesColumns || ''),
    pivotCol: String(inp.pivotColumn || ''),
    errorCol: String(inp.errorColumn || ''),
    zCol: String(inp.zColumn || ''),
    sizeCol: String(inp.sizeColumn || ''),
  };
}

// A goal is a reversible starting-point generator, not a lock. Selecting a new
// goal may move to its recommended renderer; after that, an explicit renderer
// or type selection wins. Mapping fields only follow while untouched so expert
// work is never replaced by a later inference.
function recommendationInputPatch(model, priorPatch, changedId) {
  const inp = Object.assign(Object.fromEntries(model.map((i) => [i.id, i.value])), priorPatch || {});
  const intent = String(inp.chartIntent || 'manual');
  if (intent === 'manual') return {};
  const dirty = Object.fromEntries(model.map((i) => [i.id, !!i.isDirty]));
  const profile = profileTable(inp.data, chartParseOptions(inp));
  const recommendation = recommendChart(profile, intent);
  const patch = {};
  const goalChanged = changedId === 'chartIntent';
  const sourceChanged = !changedId || goalChanged || ['data', 'delimiter', 'hasHeader', 'transpose'].indexOf(changedId) >= 0;
  if (sourceChanged && (goalChanged || !dirty.renderMode)) patch.renderMode = recommendation.renderMode;
  const target = recommendation.renderMode === 'statistical' ? 'plotType'
    : recommendation.renderMode === 'scene' ? 'sceneType'
      : recommendation.renderMode === 'cinematic' ? 'cinematicType' : 'chartType';
  if (sourceChanged && (goalChanged || !dirty[target])) patch[target] = recommendation.chartType;
  if (recommendation.intent === 'composition' && recommendation.chartType === 'bar' && !dirty.stackMode) patch.stackMode = 'stacked100';

  const mappings = recommendation.mappings || {};
  const inferred = {
    labelColumn: (mappings.x || [])[0] || '',
    seriesColumns: (mappings.y || []).join(','),
    pivotColumn: (mappings.colour || [])[0] || '',
    zColumn: (mappings.z || [])[0] || '',
    sizeColumn: (mappings.size || [])[0] || '',
    errorColumn: (mappings.error || [])[0] || '',
    frameColumn: (mappings.frame || [])[0] || '',
    flightSeries: (mappings.camera || [])[0] || '',
  };
  if (sourceChanged) for (const [id, value] of Object.entries(inferred)) {
    if (value && !dirty[id] && id !== changedId) patch[id] = value;
  }
  return patch;
}

// The chart document records a finish in its four-word material vocabulary;
// the renderer reads the full finish from the scene plan.
const SPEC_MATERIAL = { accurate: 'accurate', matte: 'matte', satin: 'matte', clay: 'matte', gloss: 'gloss', metal: 'gloss', glow: 'gloss', glass: 'glass' };

function chartThemeFromBrand(cfg) {
  const fallback = ['#008657','#2453ff','#fe7c3f','#5d4f99','#00bda7','#bd3314','#3c8eef','#192072'];
  const seeded = cfg.seedPalette && cfg.seedPalette.categorical;
  const authored = (BRAND && BRAND.ordered) || (BRAND && BRAND.spectrum) || null;
  const rolesFirst = cfg.brandRoles ? leadWith(cfg.brandRoles, authored || fallback) : null;
  const categorical = (seeded || rolesFirst || authored || fallback).slice(0, 16);
  const ramps = (cfg.seedPalette && cfg.seedPalette.ramps) || (BRAND && BRAND.ramps) || null;
  const sequential = (ramps && (ramps[cfg.palette] || ramps.suse || ramps.pine)) || categorical.slice(0, 7);
  const diverging = (ramps && ramps.diverging) || categorical.slice(0, 7);
  const source = BRAND && BRAND.source;
  const sparse = !(BRAND && BRAND.ramps && BRAND.spectrum && BRAND.spectrum.length >= 4);
  return {
    id: ((source && source.id) || 'lolly') + ':' + cfg.chartStyle,
    source: source ? (sparse ? 'brand-derived' : 'brand-profile') : 'lolly-fallback',
    sourceId: (source && source.id) || undefined,
    sourceLabel: (source && source.label) || undefined,
    locked: !!(source && source.locked),
    font: {
      brand: (BRAND && BRAND.font && BRAND.font.brand) || undefined,
      display: (BRAND && BRAND.font && BRAND.font.display) || undefined,
      mono: (BRAND && BRAND.font && BRAND.font.mono) || undefined,
    },
    colours: {
      surface: cfg.background,
      ink: isHex(cfg.textColor) ? cfg.textColor : ((BRAND && BRAND.text) || '#111111'),
      muted: (BRAND && BRAND.muted) || ((BRAND && BRAND.text) || '#555555'),
      edge: (BRAND && BRAND.edge) || ((BRAND && BRAND.muted) || '#d4d4d4'),
      primary: (BRAND && BRAND.primary) || categorical[0],
      secondary: (BRAND && BRAND.secondary) || categorical[1] || categorical[0],
      categorical: categorical,
      sequential: sequential,
      diverging: diverging,
    },
    marks: {
      lineWidth: cfg.lineWidth,
      cornerRadius: cfg.cornerRadius,
      pointShape: cfg.chartStyle === 'technical' ? 'square' : 'circle',
      patterns: cfg.differentiate === 'both' || (cfg.differentiate === 'auto' && !!(BRAND && BRAND.monochrome)),
    },
    scene: {
      material: SPEC_MATERIAL[cfg.sceneMaterial] || (cfg.sceneMaterial === 'custom' && cfg.sceneRoughness < 0.35 ? 'gloss' : 'matte'),
      roughness: cfg.sceneRoughness,
      metalness: cfg.sceneMetalness,
      shadows: cfg.sceneShadows,
    },
    motion: {
      easing: cfg.animEase === 'linear' ? 'linear' : 'smooth',
      durationMs: Math.round(cfg.animSpeed * 1000),
      staggerMs: cfg.chartStyle === 'poster' ? 70 : 45,
    },
    provenance: {
      palette: authored ? 'active-brand:authored-order' : 'derived:active-brand-primary',
      sequential: ramps ? 'active-brand:oklab-ramp' : 'lolly:fallback-ramp',
      font: (BRAND && BRAND.font && BRAND.font.brand) ? 'active-brand:font.brand' : 'css:--font-brand',
      style: 'chart-style:' + cfg.chartStyle,
    },
  };
}

function fieldId(label, index) {
  const s = String(label || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return (s && /^[a-z]/.test(s) ? s : 'field_' + (index + 1)).slice(0, 80) + '_' + (index + 1);
}

function chartMark(type) {
  const map = {
    'bar-horizontal': 'bar', scatter: 'point', pie: 'arc', donut: 'arc',
    'radial-bar': 'radial-bar', wordcloud: 'wordcloud', bar3d: 'bar3d',
    scatter3d: 'scatter3d', surface3d: 'surface3d', donut3d: 'arc',
    flythrough3d: 'line3d', ribbon3d: 'ribbon3d', constellation3d: 'line3d', skyline3d: 'bar3d',
  };
  return map[type] || type;
}

function annotateChartFields(fields, rows, data) {
  const profileFields = data.profile && data.profile.fields || [];
  const byName = (name) => profileFields.find((item) => String(item.name).toLowerCase() === String(name || '').toLowerCase());
  return fields.map((field) => {
    const sourceName = field.id === 'category' ? data.categoryField
      : field.id === 'frame' ? data.frameField : field.label;
    const source = byName(sourceName) || byName(field.label);
    let role = source && source.role;
    if (!role) role = field.id === 'category' ? 'dimension'
      : field.id === 'series' ? 'series'
        : field.id === 'frame' ? 'time'
          : field.id === 'order' ? 'identifier'
            : /^(low|high|lower|upper|error)$/i.test(field.id) ? 'uncertainty'
              : field.type === 'number' ? 'measure' : 'unknown';
    const format = source && source.format || (field.id === 'order' ? 'integer' : field.type === 'number' ? 'decimal' : 'plain');
    const nullable = !!(source && source.missing > 0) || rows.some((row) => row[field.id] == null);
    return Object.assign({}, field, { role, format, nullable });
  });
}

function statisticalSpecParts(data, cfg) {
  const cats = data.categories || [], sourceSeries = data.series || [], nums = data.numericCols || [];
  const seriesValue = (si, ri) => {
    const value = sourceSeries[si] && sourceSeries[si].values && sourceSeries[si].values[ri];
    return value == null || !Number.isFinite(+value) ? null : +value;
  };
  const tidyFields = [
    { id: 'category', label: 'Category', type: 'string' },
    { id: 'series', label: 'Series', type: 'string' },
    { id: 'value', label: 'Value', type: 'number' },
  ];
  const tidyRows = [];
  for (let si = 0; si < sourceSeries.length; si++) for (let ri = 0; ri < cats.length; ri++) {
    const value = sourceSeries[si] && sourceSeries[si].values[ri];
    if (value != null && Number.isFinite(+value)) tidyRows.push({
      category: String(cats[ri]), series: String(sourceSeries[si].name || ('Series ' + (si + 1))), value: +value,
    });
  }
  const title = cfg.heading || cfg.chartType.replace(/-/g, ' ');
  const facetSeries = { facetY: { field: 'series', type: 'string', title: 'Series' } };

  if (cfg.chartType === 'dot-strip' || cfg.chartType === 'box-observations' ||
      cfg.chartType === 'rug-histogram' || cfg.chartType === 'small-multiples' ||
      cfg.chartType === 'distribution-facets') {
    const mark = cfg.chartType === 'dot-strip' ? 'point'
      : cfg.chartType === 'box-observations' ? 'box'
        : cfg.chartType === 'small-multiples' ? 'line' : 'histogram';
    const isCategoryX = cfg.chartType === 'small-multiples';
    const isCategoryY = cfg.chartType === 'dot-strip';
    const isBox = cfg.chartType === 'box-observations';
    const isDistribution = cfg.chartType === 'rug-histogram' || cfg.chartType === 'distribution-facets';
    return {
      fields: tidyFields, rows: tidyRows,
      series: [{ id: 'series_1', name: title, dataset: 'data', mark: mark, channels: {
        x: { field: isCategoryX ? 'category' : 'value', type: isCategoryX ? 'string' : 'number' },
        y: { field: isCategoryY ? 'category' : isBox ? 'series' : 'value', type: isCategoryY || isBox ? 'string' : 'number' },
        colour: { field: 'series', type: 'string' },
        ...(cfg.chartType === 'dot-strip' || cfg.chartType === 'box-observations' ? {} : facetSeries),
      } }],
      scales: [
        { id: 'x', type: isCategoryX ? 'band' : cfg.yScaleType, nice: true },
        { id: 'y', type: isCategoryY || cfg.chartType === 'box-observations' ? 'band' : 'linear', zero: isDistribution, nice: true },
      ],
      axes: [
        { id: 'x', scale: 'x', side: 'bottom', title: cfg.xTitle || (isCategoryX ? 'Category' : 'Value'), grid: cfg.showGrid },
        { id: 'y', scale: 'y', side: 'left', title: cfg.yTitle || (isCategoryY ? 'Category' : isBox ? 'Series' : isDistribution ? 'Count' : 'Value'), grid: cfg.showGrid },
      ],
    };
  }

  if (cfg.chartType === 'interval') {
    const fields = [
      { id: 'category', label: 'Category', type: 'string' },
      { id: 'low', label: (sourceSeries[0] && sourceSeries[0].name) || 'Low', type: 'number' },
      { id: 'high', label: (sourceSeries[1] && sourceSeries[1].name) || 'High', type: 'number' },
    ];
    const rows = cats.map((category, i) => ({ category: String(category),
      low: seriesValue(0, i), high: seriesValue(1, i),
    }));
    return { fields, rows, series: [{ id: 'series_1', name: title, dataset: 'data', mark: 'rule', channels: {
      y: { field: 'category', type: 'string' }, low: { field: 'low', type: 'number' }, high: { field: 'high', type: 'number' },
    } }], scales: [{ id: 'x', type: cfg.yScaleType, nice: true }, { id: 'y', type: 'band' }], axes: [
      { id: 'x', scale: 'x', side: 'bottom', title: cfg.xTitle || 'Range', grid: cfg.showGrid },
      { id: 'y', scale: 'y', side: 'left', title: cfg.yTitle || 'Category', grid: false },
    ] };
  }

  if (cfg.chartType === 'range-band' || cfg.chartType === 'difference-area' || cfg.chartType === 'control-band') {
    let fields, rows, series;
    if (cfg.chartType === 'range-band') {
      fields = [
        { id: 'category', label: 'Category', type: 'string' },
        { id: 'low', label: (sourceSeries[0] && sourceSeries[0].name) || 'Low', type: 'number' },
        { id: 'expected', label: (sourceSeries[1] && sourceSeries[1].name) || 'Expected', type: 'number' },
        { id: 'high', label: (sourceSeries[2] && sourceSeries[2].name) || 'High', type: 'number' },
      ];
      rows = cats.map((category, i) => {
        const low = seriesValue(0, i);
        const high = sourceSeries.length >= 3 ? seriesValue(2, i) : seriesValue(1, i);
        const expected = sourceSeries.length >= 3
          ? seriesValue(1, i)
          : low == null || high == null ? null : (low + high) / 2;
        return { category: String(category), low, expected, high };
      });
      series = [
        { id: 'range', name: title + ' range', dataset: 'data', mark: 'area', channels: {
          x: { field: 'category', type: 'string' }, low: { field: 'low', type: 'number' }, high: { field: 'high', type: 'number' },
        } },
        { id: 'expected', name: 'Expected', dataset: 'data', mark: 'line', channels: {
          x: { field: 'category', type: 'string' }, y: { field: 'expected', type: 'number' },
        } },
      ];
    } else if (cfg.chartType === 'difference-area') {
      fields = [
        { id: 'category', label: 'Category', type: 'string' },
        { id: 'first', label: (sourceSeries[0] && sourceSeries[0].name) || 'First', type: 'number' },
        { id: 'second', label: (sourceSeries[1] && sourceSeries[1].name) || 'Second', type: 'number' },
        { id: 'difference', label: 'Difference', type: 'number' },
      ];
      rows = cats.map((category, i) => { const first = seriesValue(0, i), second = seriesValue(1, i); return {
        category: String(category), first, second,
        difference: first == null || second == null ? null : second - first,
      }; });
      series = [
        { id: 'difference', name: title + ' difference', dataset: 'data', mark: 'area', channels: {
          x: { field: 'category', type: 'string' }, low: { field: 'first', type: 'number' }, high: { field: 'second', type: 'number' },
        } },
        { id: 'first', name: fields[1].label, dataset: 'data', mark: 'line', channels: { x: { field: 'category', type: 'string' }, y: { field: 'first', type: 'number' } } },
        { id: 'second', name: fields[2].label, dataset: 'data', mark: 'line', channels: { x: { field: 'category', type: 'string' }, y: { field: 'second', type: 'number' } } },
      ];
    } else {
      const values = (sourceSeries[0] && sourceSeries[0].values || []).filter((value) => value != null && Number.isFinite(+value)).map(Number);
      const mean = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
      const deviation = values.length > 1 ? Math.sqrt(values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / (values.length - 1)) : 0;
      fields = [
        { id: 'category', label: 'Category', type: 'string' },
        { id: 'value', label: (sourceSeries[0] && sourceSeries[0].name) || 'Value', type: 'number' },
        { id: 'mean', label: 'Mean', type: 'number' },
        { id: 'lower', label: 'Lower control limit', type: 'number' },
        { id: 'upper', label: 'Upper control limit', type: 'number' },
      ];
      rows = cats.map((category, i) => ({ category: String(category), value: seriesValue(0, i), mean,
        lower: mean - deviation * 2, upper: mean + deviation * 2,
      }));
      series = [
        { id: 'control_range', name: 'Two standard deviations', dataset: 'data', mark: 'area', channels: {
          x: { field: 'category', type: 'string' }, low: { field: 'lower', type: 'number' }, high: { field: 'upper', type: 'number' },
        } },
        { id: 'observed', name: fields[1].label, dataset: 'data', mark: 'line', channels: { x: { field: 'category', type: 'string' }, y: { field: 'value', type: 'number' } } },
        { id: 'mean', name: 'Mean', dataset: 'data', mark: 'rule', channels: { y: { field: 'mean', type: 'number' } } },
      ];
    }
    return { fields, rows, series, scales: [{ id: 'x', type: 'band' }, { id: 'y', type: cfg.yScaleType, nice: true }], axes: [
      { id: 'x', scale: 'x', side: 'bottom', title: cfg.xTitle || 'Category', grid: false },
      { id: 'y', scale: 'y', side: 'left', title: cfg.yTitle || 'Value', grid: cfg.showGrid },
    ] };
  }

  if (cfg.chartType === 'indexed-change') {
    const rows = [];
    for (let si = 0; si < sourceSeries.length; si++) {
      const base = (sourceSeries[si].values || []).map(Number).find((value) => Number.isFinite(value) && value !== 0);
      for (let ri = 0; ri < cats.length; ri++) {
        const value = seriesValue(si, ri);
        rows.push({ category: String(cats[ri]), series: String(sourceSeries[si].name || ('Series ' + (si + 1))),
          index: value == null || !Number.isFinite(base) ? null : value / base * 100,
        });
      }
    }
    const fields = [
      { id: 'category', label: 'Category', type: 'string' },
      { id: 'series', label: 'Series', type: 'string' },
      { id: 'index', label: 'Index (first observation = 100)', type: 'number' },
    ];
    return { fields, rows, series: [{ id: 'series_1', name: title, dataset: 'data', mark: 'line', channels: {
      x: { field: 'category', type: 'string' }, y: { field: 'index', type: 'number' }, colour: { field: 'series', type: 'string' },
    } }], scales: [{ id: 'x', type: 'band' }, { id: 'y', type: 'linear', nice: true }], axes: [
      { id: 'x', scale: 'x', side: 'bottom', title: cfg.xTitle || 'Category', grid: false },
      { id: 'y', scale: 'y', side: 'left', title: cfg.yTitle || 'Index (100 = first)', grid: cfg.showGrid },
    ] };
  }

  if (cfg.chartType === 'density-ridges' || cfg.chartType === 'ecdf') {
    const rows = [];
    for (let si = 0; si < sourceSeries.length; si++) {
      const values = (sourceSeries[si].values || []).filter((value) => value != null && Number.isFinite(+value)).map(Number).sort((a, b) => a - b);
      if (!values.length) continue;
      if (cfg.chartType === 'ecdf') {
        values.forEach((value, i) => rows.push({ series: String(sourceSeries[si].name), value, probability: (i + 1) / values.length }));
      } else {
        const lo = values[0], hi = values[values.length - 1], span = Math.max(1e-9, hi - lo);
        const bandwidth = Math.max(span / 80, span * cfg.plotBandwidth / Math.max(160, cfg.width));
        for (let i = 0; i < 64; i++) {
          const value = lo - span * 0.08 + span * 1.16 * i / 63;
          const density = values.reduce((sum, sample) => { const z = (value - sample) / bandwidth; return sum + Math.exp(-0.5 * z * z); }, 0) / (values.length * bandwidth * Math.sqrt(2 * Math.PI));
          rows.push({ series: String(sourceSeries[si].name), value, density });
        }
      }
    }
    const isEcdf = cfg.chartType === 'ecdf';
    const y = isEcdf ? 'probability' : 'density';
    const fields = [
      { id: 'series', label: 'Series', type: 'string' },
      { id: 'value', label: 'Value', type: 'number' },
      { id: y, label: isEcdf ? 'Cumulative probability' : 'Estimated density', type: 'number' },
    ];
    return { fields, rows, series: [{ id: 'series_1', name: title, dataset: 'data', mark: isEcdf ? 'line' : 'area', channels: {
      x: { field: 'value', type: 'number' }, y: { field: y, type: 'number' }, colour: { field: 'series', type: 'string' },
      ...(isEcdf ? {} : facetSeries),
    } }], scales: [{ id: 'x', type: cfg.yScaleType, nice: true }, { id: 'y', type: 'linear', zero: true, nice: true }], axes: [
      { id: 'x', scale: 'x', side: 'bottom', title: cfg.xTitle || 'Value', grid: cfg.showGrid },
      { id: 'y', scale: 'y', side: 'left', title: cfg.yTitle || (isEcdf ? 'Cumulative share' : 'Density'), grid: cfg.showGrid },
    ] };
  }

  if (cfg.chartType === 'candlestick') {
    const names = ['Open', 'High', 'Low', 'Close'];
    const fields = [{ id: 'category', label: 'Category', type: 'string' }]
      .concat(names.map((name, i) => ({ id: name.toLowerCase(), label: (sourceSeries[i] && sourceSeries[i].name) || name, type: 'number' })));
    const rows = cats.map((category, i) => ({ category: String(category),
      open: seriesValue(0, i), high: seriesValue(1, i),
      low: seriesValue(2, i), close: seriesValue(3, i),
    }));
    return { fields, rows, series: [{ id: 'series_1', name: title, dataset: 'data', mark: 'candlestick', channels: {
      x: { field: 'category', type: 'string' }, open: { field: 'open', type: 'number' }, high: { field: 'high', type: 'number' },
      low: { field: 'low', type: 'number' }, close: { field: 'close', type: 'number' },
    } }], scales: [{ id: 'x', type: 'band' }, { id: 'y', type: cfg.yScaleType, nice: true }], axes: [
      { id: 'x', scale: 'x', side: 'bottom', title: cfg.xTitle || 'Period', grid: false },
      { id: 'y', scale: 'y', side: 'left', title: cfg.yTitle || 'Value', grid: cfg.showGrid },
    ] };
  }

  const cols = nums.slice(0, 3), ids = cols.map((c, i) => fieldId(c.name, i));
  const fields = cols.map((c, i) => ({ id: ids[i], label: c.name, type: 'number' }));
  const count = cols.reduce((n, c) => Math.max(n, (c.values || []).length), 0);
  const rows = Array.from({ length: count }, (_, ri) => Object.fromEntries(cols.map((c, ci) => [ids[ci], c.values[ri] == null ? null : c.values[ri]])));
  const mark = cfg.chartType === 'hexbin' ? 'hexbin' : cfg.chartType === 'density-contour' ? 'density' : 'regression';
  const channels = ids.length >= 2 ? { x: { field: ids[0], type: 'number', title: cols[0].name }, y: { field: ids[1], type: 'number', title: cols[1].name },
    ...(ids[2] ? { size: { field: ids[2], type: 'number', title: cols[2].name } } : {}) } : {};
  return { fields: fields.length ? fields : [{ id: 'value', label: 'Value', type: 'number' }], rows,
    series: [{ id: 'series_1', name: title, dataset: 'data', mark, channels }],
    scales: [{ id: 'x', type: cfg.yScaleType, nice: true }, { id: 'y', type: cfg.yScaleType, nice: true }], axes: [
      { id: 'x', scale: 'x', side: 'bottom', title: cfg.xTitle || (cols[0] && cols[0].name) || 'x', grid: cfg.showGrid },
      { id: 'y', scale: 'y', side: 'left', title: cfg.yTitle || (cols[1] && cols[1].name) || 'y', grid: cfg.showGrid },
    ] };
}

// These compound charts use the same prepared rows for SVG, accessible tables
// and portable chart documents. Missing cells never turn into zero measures.
function comparisonData(data, cfg) {
  const ss = data.series || [], cats = data.categories || [];
  const value = (s, i) => ss[s] && ss[s].values[i] != null && Number.isFinite(+ss[s].values[i]) ? +ss[s].values[i] : null;
  let rows = cats.map((category, i) => {
    const first = value(0, i), second = value(1, i);
    if (cfg.chartType === 'range-bar') return { category, low: first == null || second == null ? null : Math.min(first, second), high: first == null || second == null ? null : Math.max(first, second), ...(cfg.rangeMidpoint ? { midpoint: first == null || second == null ? null : (first + second) / 2 } : {}) };
    if (cfg.chartType === 'bullet') return { category, value: first, target: ss.length < 2 ? cfg.bulletTarget : second, maximum: value(2, i) };
    return { category, value: first };
  });
  const missing = rows.filter((r) => cfg.chartType === 'range-bar' ? r.low == null : r.value == null).length;
  rows = rows.filter((r) => cfg.chartType === 'range-bar' ? r.low != null : r.value != null);
  let error = '';
  if (cfg.chartType === 'range-bar' && ss.length < 2) error = 'Range bars need two numeric columns: Low and High.';
  if (cfg.chartType !== 'range-bar' && rows.some((r) => r.value < 0 || (cfg.chartType === 'bullet' && (r.target < 0 || r.maximum < 0)))) error = 'This chart needs non-negative values. Use bars or range bars for signed values.';
  if (!rows.length && !error) error = 'No complete numeric rows to chart. Check the selected value columns.';
  if (cfg.chartType === 'pareto') {
    rows.sort((a, b) => b.value - a.value);
    const total = rows.reduce((n, r) => n + r.value, 0);
    if (!(total > 0) && !error) error = 'Pareto needs a positive total to calculate cumulative percentages.';
    let sum = 0;
    rows.forEach((r) => { sum += r.value; r.cumulative = total > 0 ? sum / total * 100 : null; });
  }
  return { rows, error, missing };
}

function comparisonSpecParts(data, cfg) {
  const rows = data.comparison.rows, source = data.series || [];
  const field = (id, label) => ({ id, label, type: 'number' });
  const cat = { field: 'category', type: 'string' };
  const enc = (id, scale) => ({ field: id, type: 'number', ...(scale ? { scale } : {}) });
  const series = [], fields = [{ id: 'category', label: data.categoryField || 'Category', type: 'string' }];
  const horizontal = cfg.chartType !== 'pareto';
  if (cfg.chartType === 'range-bar') {
    fields.push(field('low', source[0] && source[0].name || 'Low'), field('high', source[1] && source[1].name || 'High'));
    series.push({ id: 'range', name: 'Low–high range', dataset: 'data', mark: 'bar', channels: { y: cat, low: enc('low', 'x'), high: enc('high', 'x') } });
    if (cfg.rangeMidpoint) {
      fields.push(field('midpoint', 'Arithmetic midpoint'));
      series.push({ id: 'midpoint', name: 'Arithmetic midpoint', dataset: 'data', mark: 'rule', channels: { x: enc('midpoint', 'x'), y: cat } });
    }
  } else {
    fields.push(field('value', source[0] && source[0].name || 'Actual'));
    series.push({ id: 'actual', name: fields[1].label, dataset: 'data', mark: 'bar', channels: horizontal ? { x: enc('value', 'x'), y: cat } : { x: cat, y: enc('value', 'y') } });
    if (cfg.chartType === 'bullet') {
      fields.push(field('target', source[1] && source[1].name || 'Target'), field('maximum', source[2] && source[2].name || 'Maximum'));
      series.push({ id: 'target', name: fields[2].label, dataset: 'data', mark: 'rule', channels: { x: enc('target', 'x'), y: cat } });
    } else {
      fields.push(field('cumulative', 'Cumulative share (%)'));
      if (cfg.paretoCumulative) series.push({ id: 'cumulative', name: 'Cumulative share (%)', dataset: 'data', mark: 'line', channels: { x: cat, y: enc('cumulative', 'cumulative') } });
    }
  }
  const scales = [{ id: 'x', type: horizontal ? 'linear' : 'band', zero: horizontal }, { id: 'y', type: horizontal ? 'band' : 'linear', zero: !horizontal }];
  const axes = [{ id: 'x', scale: 'x', side: 'bottom', title: cfg.xTitle || (horizontal ? 'Value' : 'Category'), grid: horizontal && cfg.showGrid }, { id: 'y', scale: 'y', side: 'left', title: cfg.yTitle || (horizontal ? 'Category' : fields[1].label), grid: !horizontal && cfg.showGrid }];
  if (cfg.chartType === 'pareto' && cfg.paretoCumulative) { scales.push({ id: 'cumulative', type: 'linear', domain: [0, 100] }); axes.push({ id: 'cumulative', scale: 'cumulative', side: 'right', title: 'Cumulative share (%)', grid: false }); }
  return { rows, fields, series, scales, axes };
}

function makeChartSpec(data, cfg) {
  const is3d = REAL_3D_TYPES.indexOf(cfg.chartType) >= 0;
  const isCinematic = CINEMATIC_TYPES.indexOf(cfg.chartType) >= 0;
  const isPlot = PLOT_TYPES.indexOf(cfg.chartType) >= 0;
  const mark = chartMark(cfg.chartType);
  const cats = data.categories || [], sourceSeries = data.series || [], nums = data.numericCols || [];
  let fields = [], rows = [], series = [];

  let plotParts = null;
  if (data.comparison) {
    plotParts = comparisonSpecParts(data, cfg);
    fields = plotParts.fields; rows = plotParts.rows; series = plotParts.series;
  } else if (isPlot) {
    plotParts = statisticalSpecParts(data, cfg);
    fields = plotParts.fields; rows = plotParts.rows; series = plotParts.series;
    if (data.frames && data.frames.length >= 2) {
      const frameField = { id: 'frame', label: cfg.frameColumn || 'Frame', type: 'string' };
      fields = fields.concat(frameField);
      rows = [];
      data.frames.forEach((frame, fi) => {
        const part = statisticalSpecParts({ categories: data.categories, series: frame, numericCols: frame }, cfg);
        const label = (data.frameLabels && data.frameLabels[fi]) || String(fi + 1);
        part.rows.forEach((row) => rows.push(Object.assign({}, row, { frame: label })));
      });
      series = series.map((item) => ({
        ...item,
        channels: { ...item.channels, frame: { field: 'frame', type: 'string', title: cfg.frameColumn || 'Frame' } },
      }));
    }
  } else if (isCinematic) {
    fields = [
      { id: 'order', label: 'Route order', type: 'number' },
      { id: 'category', label: 'Category', type: 'string' },
      { id: 'series', label: 'Series', type: 'string' },
      { id: 'value', label: 'Value', type: 'number' },
    ];
    for (let ci = 0; ci < cats.length; ci++) for (const s of sourceSeries) rows.push({
      order: ci, category: String(cats[ci]), series: String(s.name),
      value: s.values[ci] == null || !Number.isFinite(+s.values[ci]) ? null : +s.values[ci],
    });
    series = [{
      id: 'flight_path', name: cfg.heading || 'Data flight', dataset: 'data', mark: chartMark(cfg.chartType),
      channels: {
        x: { field: 'order', type: 'number', title: cfg.xTitle || 'Route order' },
        y: { field: 'value', type: 'number', title: cfg.yTitle || 'Value' },
        z: { field: 'series', type: 'string', title: 'Series' },
        colour: { field: 'series', type: 'string' },
        label: { field: 'category', type: 'string' },
      },
    }];
  } else if (cfg.chartType === 'scatter3d') {
    const cols = nums.slice(0, 4), ids = cols.map((c, i) => fieldId(c.name, i));
    fields = cols.map((c, i) => ({ id: ids[i], label: c.name, type: 'number' }));
    const count = cols.reduce((n, c) => Math.max(n, (c.values || []).length), 0);
    rows = Array.from({ length: count }, (_, ri) => Object.fromEntries(cols.map((c, ci) => [ids[ci], c.values[ri] == null ? null : c.values[ri]])));
    if (cols.length >= 3) series = [{
      id: 'series_1', name: cfg.heading || '3-D points', dataset: 'data', mark: 'scatter3d',
      channels: {
        x: { field: ids[0], type: 'number', title: cols[0].name },
        y: { field: ids[1], type: 'number', title: cols[1].name },
        z: { field: ids[2], type: 'number', title: cols[2].name },
        ...(ids[3] ? { size: { field: ids[3], type: 'number', title: cols[3].name } } : {}),
      },
    }];
  } else if (cfg.chartType === 'bar3d' || cfg.chartType === 'surface3d') {
    fields = [
      { id: 'category', label: 'Category', type: 'string' },
      { id: 'series', label: 'Series', type: 'string' },
      { id: 'value', label: 'Value', type: 'number' },
    ];
    for (let ci = 0; ci < cats.length; ci++) for (const s of sourceSeries) rows.push({
      category: cats[ci], series: s.name, value: s.values[ci] == null ? null : s.values[ci],
    });
    series = [{
      id: 'series_1', name: cfg.heading || (cfg.chartType === 'surface3d' ? 'Surface' : '3-D bars'),
      dataset: 'data', mark: mark,
      channels: {
        x: { field: 'category', type: 'string', title: 'Category' },
        y: { field: 'value', type: 'number', title: cfg.yTitle || 'Value' },
        z: { field: 'series', type: 'string', title: 'Series' },
        colour: { field: 'series', type: 'string' },
      },
      stack: cfg.stackMode === 'stacked100' ? 'normalised' : cfg.stackMode === 'stacked' ? 'stacked' : 'none',
    }];
  } else {
    const ids = sourceSeries.map((s, i) => fieldId(s.name, i));
    fields = [{ id: 'category', label: 'Category', type: 'string' }]
      .concat(sourceSeries.map((s, i) => ({ id: ids[i], label: s.name, type: 'number' })));
    if (data.frames && data.frames.length) {
      fields.push({ id: 'frame', label: cfg.frameColumn || 'Frame', type: 'string' });
      data.frames.forEach((frame, fi) => cats.forEach((category, ri) => {
        const row = { category: category, frame: (data.frameLabels && data.frameLabels[fi]) || String(fi + 1) };
        frame.forEach((s, si) => { row[ids[si]] = s.values[ri] == null ? null : s.values[ri]; });
        rows.push(row);
      }));
    } else {
      rows = cats.map((category, ri) => {
        const row = { category: category };
        sourceSeries.forEach((s, si) => { row[ids[si]] = s.values[ri] == null ? null : s.values[ri]; });
        return row;
      });
    }
    series = sourceSeries.map((s, i) => ({
      id: 'series_' + (i + 1), name: s.name, dataset: 'data', mark: mark,
      channels: {
        x: { field: 'category', type: 'string', title: cfg.xTitle || 'Category' },
        y: { field: ids[i], type: 'number', title: s.name },
        colour: { field: ids[i], type: 'number' },
        ...(data.frames ? { frame: { field: 'frame', type: 'string', title: cfg.frameColumn || 'Frame' } } : {}),
      },
      stack: cfg.stackMode === 'stacked100' ? 'normalised' : cfg.stackMode === 'stacked' ? 'stacked' : 'none',
    }));
  }

  fields = annotateChartFields(fields, rows, data);

  const title = (cfg.heading || (cfg.chartType.replace(/3d/g, ' 3-D').replace(/-/g, ' ') + ' chart')).trim();
  const seriesNames = (data.comparison ? series : cfg.chartType === 'scatter3d' ? nums.slice(0, 4) : sourceSeries).map((s) => s.name);
  const count = rows.length;
  const sourceLabel = cfg.brandTheme.sourceLabel || cfg.brandTheme.sourceId || 'the active brand';
  const description = (cfg.subheading ? cfg.subheading + '. ' : '') + title + ' uses ' + count + ' data row' + (count === 1 ? '' : 's') +
    (seriesNames.length ? ' across ' + seriesNames.length + ' series' : '') + ', styled from ' + sourceLabel + '.';
  const motion = isCinematic
    ? { enabled: true, preset: 'data-flight', duration: cfg.animSpeed, loop: cfg.animDirection === 'bounce' ? 'bounce' : 'loop', easing: cfg.animEase, poster: 0.16 }
    : is3d
    ? { enabled: cfg.motionPreset !== 'none', preset: cfg.motionPreset === 'arc' ? 'orbit' : cfg.motionPreset, duration: cfg.animSpeed, loop: 'loop', easing: cfg.animEase, poster: cfg._scenePoster != null ? cfg._scenePoster : 0.22 }
    : cfg.frameColumn && data.frames && data.frames.length >= 2
      ? { enabled: true, preset: 'by-frame-field', duration: cfg.animSpeed, loop: cfg.animDirection === 'bounce' ? 'bounce' : 'loop', easing: cfg.animEase, poster: 0, frameField: 'frame' }
      : isPlot && cfg.plotMotionPreset !== 'none'
        ? { enabled: true, preset: cfg.plotMotionPreset, duration: cfg.animSpeed, loop: 'loop', easing: cfg.animEase, poster: 1 }
      : { enabled: false, preset: 'none', duration: cfg.animSpeed, loop: 'once', easing: cfg.animEase, poster: 0 };
  return {
    version: 1,
    datasets: [{ id: 'data', fields: fields, rows: rows, ...(data.note ? { note: data.note } : {}) }],
    series: series,
    scales: isCinematic ? [
      { id: 'x', type: 'linear', zero: true, nice: false },
      { id: 'y', type: cfg.yScaleType, zero: cfg.yZero, nice: true },
      { id: 'z', type: 'band' },
    ] : plotParts ? plotParts.scales : [
      { id: 'x', type: 'band' },
      { id: 'y', type: cfg.yScaleType, zero: cfg.yZero, nice: true },
      ...(is3d ? [{ id: 'z', type: 'band' }] : []),
    ],
    axes: isCinematic ? [
      { id: 'x', scale: 'x', side: 'bottom', title: cfg.xTitle || 'Route', grid: false },
      { id: 'y', scale: 'y', side: 'left', title: cfg.yTitle || 'Value', grid: cfg.showGrid, ticks: cfg.tickCount },
      { id: 'z', scale: 'z', side: 'z', title: 'Series', grid: false },
    ] : plotParts ? plotParts.axes : [
      { id: 'x', scale: 'x', side: 'bottom', title: cfg.xTitle || undefined, grid: false },
      { id: 'y', scale: 'y', side: 'left', title: cfg.yTitle || undefined, grid: cfg.showGrid, ticks: cfg.tickCount },
      ...(is3d ? [{ id: 'z', scale: 'z', side: 'z', title: 'Series', grid: false }] : []),
    ],
    legends: cfg.showLegend ? [{ id: 'legend', series: series.map((s) => s.id), position: cfg.legendPosition }] : [],
    formatting: { value: { type: cfg.numberFormat === 'percent' ? 'percent' : cfg.numberFormat === 'currency' ? 'currency' : 'number' } },
    theme: cfg.brandTheme,
    motion: motion,
    presentation: {
      style: cfg.chartStyle,
      dimension: is3d || cfg.chartStyle === 'iso-vector' ? 3 : 2,
      rendererFamily: is3d ? 'scene-3d' : isPlot ? 'scientific' : 'svg',
      exportFidelity: is3d ? 'hybrid' : 'vector',
      width: cfg.width, height: cfg.height, transparent: cfg.transparent,
      ...(is3d ? { camera: cfg._sceneCamera || { projection: isCinematic || cfg.cameraProjection !== 'orthographic' ? 'perspective' : 'orthographic', azimuth: cfg.cameraAzimuth, elevation: cfg.cameraElevation } } : {}),
    },
    accessibility: {
      title: title, description: description, readingOrder: seriesNames,
      table: { columns: fields.map((f) => f.label), rows: rows.map((r) => fields.map((f) => r[f.id] == null ? null : r[f.id])) },
      // Statistical recipes pair colour with position, facet, endpoint or
      // symbol; the colour-only warning would be false there even for a vivid
      // brand. Classic multi-series SVG keeps its established pattern policy.
      colourOnly: isPlot || data.comparison ? false : !(cfg.brandTheme.marks.patterns), patterns: !!cfg.brandTheme.marks.patterns,
      ...(motion.enabled ? { motionDescription: isCinematic
        ? 'The camera follows the ordered data path; values drive altitude and series occupy depth.'
        : cfg.motionPreset === 'arc' ? 'The camera sweeps across the chart and back.'
        : motion.preset === 'orbit' ? 'The camera orbits the chart.'
        : motion.preset === 'stagger' ? 'The marks rise one after another.' : 'The chart reveals and changes over time.' } : {}),
    },
  };
}

function xml(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Screen-reader data view generated from the SAME typed table as the visual.
// Keep the DOM bounded; the full dataset remains in ChartSpecV1 and data exports.
function chartA11yHtml(spec) {
  const table = spec.accessibility.table, limit = 200, rows = table.rows.slice(0, limit);
  const th = table.columns.map((c) => '<th scope="col">' + xml(c) + '</th>').join('');
  const body = rows.map((r) => '<tr>' + r.map((v) => '<td>' + xml(v == null ? '' : v) + '</td>').join('') + '</tr>').join('');
  const more = table.rows.length > limit ? '<p>' + xml((table.rows.length - limit) + ' additional rows are available in the data export.') + '</p>' : '';
  return '<div data-chart-a11y style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0">' +
    '<h2>' + xml(spec.accessibility.title) + '</h2><p>' + xml(spec.accessibility.description) + '</p>' +
    '<table><caption>Chart data</caption><thead><tr>' + th + '</tr></thead><tbody>' + body + '</tbody></table>' + more + '</div>';
}

// The design system's text face as a font-family list, for the scene's SVG text.
// === lolly:shared brandFonts - generated from community/_shared/brand-fonts.js; edit there and run npm run sync:shared ===
// The design system's text face (font.brand) and mono face (font.mono) as
// font-family lists, for an SVG attribute, an inline style or a canvas font.
// A tool never names a face of its own. A headless SVG has no stylesheet, so
// the CLI, the TUI and the MCP server read the attribute to outline the text,
// and the page draws the same family. A design system that declares no such
// face gets the shell's own default, SUSE or SUSE Mono, as --font-brand and
// --font-mono do. Family names pass the shell's brand-vars.ts rule; a name
// with a space or a digit is quoted.
var BF_FAMILY = /^[A-Za-z0-9][A-Za-z0-9 _-]{0,63}$/;
var BF_GENERIC = /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-(sans-serif|serif|monospace|rounded)|emoji|math|fangsong)$/i;
function bfFamilyList(value, fallback, generic) {
  var names = [];
  var list = Array.isArray(value) ? value : (typeof value === 'string' && value.charAt(0) !== '{' ? value.split(',') : []);
  for (var i = 0; i < list.length; i++) {
    var n = String(list[i]).trim().replace(/^['"]+|['"]+$/g, '').trim();
    if (!BF_FAMILY.test(n) || BF_GENERIC.test(n)) continue;
    var dup = false;
    for (var j = 0; j < names.length; j++) if (names[j].toLowerCase() === n.toLowerCase()) dup = true;
    if (!dup) names.push(n);
  }
  if (!names.length) names.push(fallback);
  return names.map(function (f) { return /^[A-Za-z_-][A-Za-z0-9_-]*$/.test(f) ? f : "'" + f + "'"; }).join(', ') + ', ' + generic;
}
async function brandFonts(host) {
  var out = { brand: bfFamilyList(null, 'SUSE', 'sans-serif'), mono: bfFamilyList(null, 'SUSE Mono', 'monospace') };
  if (!host || !host.tokens || !host.tokens.resolve) return out;
  try { out.brand = bfFamilyList(await host.tokens.resolve('{font.brand}'), 'SUSE', 'sans-serif'); } catch (e) { /* the shell's default face stands */ }
  try { out.mono = bfFamilyList(await host.tokens.resolve('{font.mono}'), 'SUSE Mono', 'monospace'); } catch (e) { /* the shell's default face stands */ }
  return out;
}
// === /lolly:shared brandFonts ===

// ── 3-D scene plan ──────────────────────────────────────────────────────────
// The real 3-D charts are planned here, once, as plain data: each mark's box,
// sector, sphere or path, the stage and its colours, the labels, the overlay
// and a camera framed to fill the artboard. The browser's WebGL adapter
// (lib/chart-three.js) builds its meshes from this plan, and sceneVectorSvg()
// projects the same plan through the same camera for the CLI, for a browser
// without WebGL and for SVG and PDF export. One plan, so every output agrees.
//
// World units: one category step is 1. y is up, the floor is y = 0, and the
// camera's azimuth turns from +z towards +x, as three.js measures it.

// Named camera poses. Each is an azimuth and an elevation in degrees. The hero
// pose tries a few azimuths and keeps the one that fills the frame best, which
// is how a tall artboard and a wide one each get a three-quarter view that
// suits them.
const SCENE_POSES = {
  hero:  { az: 36, el: 24, candidates: [24, 30, 36, 42, 50, 58] },
  low:   { az: 30, el: 8 },
  high:  { az: 40, el: 52 },
  front: { az: 0, el: 12 },
  side:  { az: 74, el: 16 },
  top:   { az: 0, el: 84 },
  iso:   { az: 45, el: 35.264, lens: 'orthographic' },
};
// Lens, as a vertical field of view. Orthographic has no perspective at all.
const SCENE_LENS_FOV = { wide: 64, perspective: 34, long: 16 };
const SCENE_STAGES = ['studio', 'floor', 'float', 'plinth', 'night'];
const SCENE_FINISHES = ['accurate', 'matte', 'satin', 'gloss', 'metal', 'clay', 'glass', 'glow', 'custom'];

function r4(n) { return Math.round(n * 10000) / 10000; }
function hexRgb(hex) {
  const h = normHex(hex) || '#777777';
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}
function rgbHex(c) { return '#' + c.map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join(''); }
function mixHex(a, b, t) { const x = hexRgb(a), y = hexRgb(b); return rgbHex(x.map((v, i) => v + (y[i] - v) * t)); }
function relLum(hex) {
  const c = hexRgb(hex).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contrastHex(a, b) { const x = relLum(a), y = relLum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }

// Number text for a value label, matching the vector chart's Number format.
function sceneFmt(v, kind, total) {
  if (v == null || !Number.isFinite(+v)) return '';
  v = +v;
  const grouped = (x, d) => x.toLocaleString('en', { minimumFractionDigits: d, maximumFractionDigits: d });
  const si = (x) => {
    const a = Math.abs(x), units = [[1e12, 'T'], [1e9, 'G'], [1e6, 'M'], [1e3, 'k']];
    for (const [n, u] of units) if (a >= n) return String(Math.round((x / n) * 10) / 10) + u;
    return String(Math.round(x * 100) / 100);
  };
  switch (kind) {
    case 'si': return si(v);
    case 'comma': return v.toLocaleString('en', { maximumFractionDigits: 6 });
    case 'integer': return grouped(v, 0);
    case 'decimal1': return grouped(v, 1);
    case 'decimal2': return grouped(v, 2);
    case 'percent': return (Math.round(v * 10) / 10) + '%';
    case 'currency': return '€' + v.toLocaleString('en', { maximumFractionDigits: 2 });
    case 'share': return total ? Math.round((v / total) * 100) + '%' : '';
    default:
      if (Math.abs(v) >= 10000) return si(v);
      if (Number.isInteger(v)) return v.toLocaleString('en');
      return v.toLocaleString('en', { maximumFractionDigits: 2 });
  }
}

// The stage's colours, all from the active colourway. A dark colourway gives a
// dark studio; the night stage takes the deepest colour the design system holds
// and pushes it towards black. Text and quiet tones are chosen against the
// backdrop so labels and de-emphasised marks read on either.
function sceneStageColours(cfg, stage) {
  const t = cfg.brandTheme.colours;
  const ink = normHex(t.ink) || '#111111';
  const paper = normHex(t.surface) || '#ffffff';
  let backdrop = normHex(cfg.background) || paper;
  if (stage === 'night' && !cfg.backgroundChosen) {
    const deep = [t.ink, t.primary, t.secondary, t.edge].map(normHex).filter(Boolean)
      .reduce((a, b) => (relLum(b) < relLum(a) ? b : a), ink);
    backdrop = mixHex(deep, '#000000', relLum(deep) > 0.06 ? 0.62 : 0.32);
  }
  const dark = relLum(backdrop) < 0.2;
  const text = contrastHex(ink, backdrop) >= contrastHex(paper, backdrop)
    ? (contrastHex(ink, backdrop) >= 4.5 ? ink : (dark ? '#ffffff' : '#111111'))
    : (contrastHex(paper, backdrop) >= 4.5 ? paper : (dark ? '#ffffff' : '#111111'));
  const primary = normHex(t.primary) || '#4676ee';
  const secondary = normHex(t.secondary) || primary;
  return {
    backdrop,
    floor: dark ? mixHex(backdrop, '#ffffff', 0.045) : mixHex(backdrop, text, 0.03),
    text,
    quiet: mixHex(backdrop, text, dark ? 0.3 : 0.2),
    grid: mixHex(backdrop, text, dark ? 0.24 : 0.17),
    plinth: dark ? mixHex(backdrop, '#ffffff', 0.12) : mixHex(backdrop, text, 0.08),
    sky: dark ? mixHex(backdrop, '#ffffff', 0.18) : mixHex(backdrop, '#ffffff', 0.55),
    ground: mixHex(backdrop, text, dark ? 0.12 : 0.42),
    fill: mixHex(secondary, '#ffffff', dark ? 0.1 : 0.45),
    rim: mixHex(primary, '#ffffff', dark ? 0.35 : 0.6),
    accent: secondary,
    dark,
  };
}

// The colourway's categorical colours that read on this stage, in the design
// system's order. A colour too close to the backdrop is left out rather than
// shifted, so a night stage built from the primary leads with the brand's
// brighter hues instead of a muddied primary.
function sceneCategorical(cfg, colours) {
  const all = (cfg.brandTheme.colours.categorical || []).map(normHex).filter(Boolean);
  const keep = all.filter((c) => contrastHex(c, colours.backdrop) >= 1.55);
  if (keep.length >= 3 || keep.length === all.length) return keep.length ? keep : [colours.text];
  // Too few survive: lift the rest away from the backdrop and keep them in order.
  return all.map((c) => {
    let x = c;
    for (let i = 0; i < 8 && contrastHex(x, colours.backdrop) < 1.55; i++) x = mixHex(x, colours.text, 0.18);
    return x;
  });
}

// The colourway's sequential ramp, ordered so a larger value is more prominent
// on this stage: darker on a light stage, brighter on a dark one.
function sceneRamp(cfg, colours) {
  let stops = (cfg.brandTheme.colours.sequential || []).map(normHex).filter(Boolean);
  // Without ramps from the design system the theme's sequential list is its
  // categorical colours, which make a rainbow. Build one hue's ramp instead,
  // from the stage's own backdrop and text through the most colourful lead.
  if (stops.length < 2 || (cfg.brandTheme.provenance && cfg.brandTheme.provenance.sequential === 'lolly:fallback-ramp')) {
    const leads = [cfg.brandTheme.colours.primary, cfg.brandTheme.colours.secondary].concat(sceneCategorical(cfg, colours)).map(normHex).filter(Boolean);
    const sat = (h) => { const c = hexRgb(h); return Math.max(...c) - Math.min(...c); };
    const hue = leads.reduce((a, b) => (sat(b) > sat(a) ? b : a), leads[0] || colours.text);
    stops = [mixHex(hue, colours.backdrop, 0.78), mixHex(hue, colours.backdrop, 0.42), hue, mixHex(hue, colours.text, 0.38), mixHex(hue, colours.text, 0.62)];
  }
  const l0 = relLum(stops[0]), l1 = relLum(stops[stops.length - 1]);
  if (colours.dark ? l0 > l1 : l0 < l1) stops = stops.slice().reverse();
  const usable = stops.filter((c) => contrastHex(c, colours.backdrop) >= 1.25);
  return usable.length >= 2 ? usable : stops;
}
function rampAt(stops, t) {
  t = clamp(Number.isFinite(t) ? t : 0, 0, 1) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(t));
  return mixHex(stops[i], stops[i + 1], t - i);
}

// Which marks the Highlight input picks out: names of categories or series,
// separated by commas, or the words max, min or last.
function sceneHighlightSet(cfg) {
  const words = String(cfg.sceneHighlight || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  return words.length ? new Set(words) : null;
}

// ── camera ──
function camBasis(azDeg, elDeg) {
  const a = azDeg * Math.PI / 180, e = clamp(elDeg, -85, 85) * Math.PI / 180;
  const dir = [Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)];
  // three.js lookAt: x = up × z, y = z × x, with z pointing from target to eye.
  let right = [dir[2], 0, -dir[0]];
  const rl = Math.hypot(right[0], right[2]) || 1;
  right = [right[0] / rl, 0, right[2] / rl];
  const up = [dir[1] * right[2] - dir[2] * right[1], dir[2] * right[0] - dir[0] * right[2], dir[0] * right[1] - dir[1] * right[0]];
  return { dir, right, up };
}
function dot3(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }

// Camera-relative coordinates of each point: across, up and towards the camera.
function camCoords(points, basis, target) {
  return points.map((p) => {
    const v = [p[0] - target[0], p[1] - target[1], p[2] - target[2]];
    return [dot3(v, basis.right), dot3(v, basis.up), dot3(v, basis.dir)];
  });
}
// NDC extents of camera-relative points for one lens and distance (or half height).
function ndcExtents(cc, lens, dist, aspect) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const q of cc) {
    let x, y;
    if (lens.ortho) { x = q[0] / (lens.half * aspect); y = q[1] / lens.half; }
    else { const depth = dist - q[2]; x = q[0] / (depth * lens.tan * aspect); y = q[1] / (depth * lens.tan); }
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return { x0, x1, y0, y1 };
}

// Frame one pose: the distance (perspective) or half height (orthographic) and
// the lens shift that put every point inside the safe rectangle `safe` (NDC),
// as large as it fits. `scale` above 1 crops in for a close-up.
function fitPose(points, pose, lensKind, aspect, safe, target, scale) {
  const basis = camBasis(pose.az, pose.el);
  const cc = camCoords(points, basis, target);
  const sw = safe.x1 - safe.x0, sh = safe.y1 - safe.y0;
  let radius = 0;
  for (const q of cc) radius = Math.max(radius, Math.hypot(q[0], q[1], q[2]));
  radius = Math.max(radius, 0.5);
  scale = scale || 1;
  let lens, dist, ext;
  if (lensKind === 'orthographic') {
    let ax0 = Infinity, ax1 = -Infinity, ay0 = Infinity, ay1 = -Infinity;
    for (const q of cc) { ax0 = Math.min(ax0, q[0]); ax1 = Math.max(ax1, q[0]); ay0 = Math.min(ay0, q[1]); ay1 = Math.max(ay1, q[1]); }
    const half = Math.max((ay1 - ay0) / sh, (ax1 - ax0) / (sw * aspect)) / scale;
    lens = { ortho: true, half: Math.max(half, 0.05) };
    dist = radius * 3 + 4;
    ext = ndcExtents(cc, lens, dist, aspect);
  } else {
    const fov = SCENE_LENS_FOV[lensKind] || SCENE_LENS_FOV.perspective;
    lens = { ortho: false, fov, tan: Math.tan(fov * Math.PI / 360) };
    let maxC = -Infinity; for (const q of cc) maxC = Math.max(maxC, q[2]);
    let lo = maxC + radius * 0.08 + 0.05, hi = maxC + radius * 80 + 50;
    const fits = (d) => { const e = ndcExtents(cc, lens, d, aspect); return (e.x1 - e.x0) * scale <= sw && (e.y1 - e.y0) * scale <= sh; };
    if (fits(lo)) hi = lo;
    else for (let i = 0; i < 48; i++) { const mid = (lo + hi) / 2; if (fits(mid)) hi = mid; else lo = mid; }
    dist = hi;
    if (scale > 1) {
      // Close-up: move in until the chart is `scale` times its fitted size.
      const fitted = ndcExtents(cc, lens, dist, aspect);
      const want = Math.max((fitted.x1 - fitted.x0) / sw, (fitted.y1 - fitted.y0) / sh) * scale;
      let a = maxC + radius * 0.08 + 0.05, b = dist;
      for (let i = 0; i < 40; i++) {
        const mid = (a + b) / 2, e = ndcExtents(cc, lens, mid, aspect);
        if (Math.max((e.x1 - e.x0) / sw, (e.y1 - e.y0) / sh) > want) a = mid; else b = mid;
      }
      dist = b;
    }
    ext = ndcExtents(cc, lens, dist, aspect);
  }
  const shift = [(safe.x0 + safe.x1) / 2 - (ext.x0 + ext.x1) / 2, (safe.y0 + safe.y1) / 2 - (ext.y0 + ext.y1) / 2];
  const fill = ((ext.x1 - ext.x0) * (ext.y1 - ext.y0)) / (sw * sh);
  return { az: pose.az, el: pose.el, lens, dist, shift, ext, radius, fill };
}

// Project world points to artboard pixels through a plan camera.
function makeProjector(cam, W, H) {
  const basis = camBasis(cam.az, cam.el), t = cam.target, aspect = W / H;
  const tan = cam.ortho ? 0 : Math.tan(cam.fov * Math.PI / 360);
  const eye = [t[0] + basis.dir[0] * cam.dist, t[1] + basis.dir[1] * cam.dist, t[2] + basis.dir[2] * cam.dist];
  const project = (p) => {
    const v = [p[0] - t[0], p[1] - t[1], p[2] - t[2]];
    const xc = dot3(v, basis.right), yc = dot3(v, basis.up), zc = dot3(v, basis.dir);
    const depth = cam.dist - zc;
    let x, y, k;
    if (cam.ortho) { x = xc / (cam.half * aspect); y = yc / cam.half; k = H / 2 / cam.half; }
    else { x = xc / (depth * tan * aspect); y = yc / (depth * tan); k = H / 2 / (depth * tan); }
    return [((x + cam.shift[0]) + 1) / 2 * W, (1 - (y + cam.shift[1])) / 2 * H, depth, k];
  };
  return { project, basis, eye };
}

// ── overlay layout (pixels) ──
function sceneOverlay(cfg, legend, hud) {
  const W = cfg.width, H = cfg.height;
  const pad = Math.round(Math.min(W, H) * 0.045) + 12;
  const out = { pad, title: null, subtitle: null, legend: null, top: pad, bottom: H - pad };
  let y = pad;
  if (cfg.heading) {
    const size = cfg.titleSize, maxW = W - pad * 2;
    const words = String(cfg.heading).split(/\s+/), lines = [];
    let line = '';
    for (const w of words) {
      const next = line ? line + ' ' + w : w;
      if (line && next.length * size * 0.52 > maxW && lines.length < 2) { lines.push(line); line = w; } else line = next;
    }
    if (line) lines.push(line);
    out.title = { lines, size, weight: cfg.titleWeight, x: pad, y: y + size * 0.92 };
    y += lines.length * size * 1.12;
  }
  if (cfg.subheading) {
    const size = Math.max(14, Math.round(cfg.labelSize * 0.86));
    out.subtitle = { text: String(cfg.subheading), size, x: pad, y: y + size * 1.15 };
    y += size * 1.55;
  }
  out.top = y > pad ? y + Math.round(pad * 0.45) : pad;
  let bottom = H - pad;
  if (hud) bottom -= 118;
  if (legend && (legend.items && legend.items.length > 1 || legend.ramp)) {
    const fs = clamp(cfg.legendTextSize || Math.round(cfg.labelSize * 0.82), 11, 40);
    const sw = Math.round(fs * 0.8), gap = Math.max(12, cfg.legendGap || 24);
    const rows = [];
    if (legend.ramp) rows.push([{ ramp: true, w: Math.min(W - pad * 2, 260 + fs * 8) }]);
    else {
      let row = [], width = 0;
      for (const it of legend.items.slice(0, 24)) {
        const w = sw + 8 + String(it.label).length * fs * 0.56;
        if (row.length && width + gap + w > W - pad * 2) { rows.push(row); row = []; width = 0; }
        width += (row.length ? gap : 0) + w; row.push(Object.assign({ w }, it));
      }
      if (row.length) rows.push(row);
    }
    const rowH = Math.round(fs * 1.7);
    const blockH = rows.length * rowH;
    out.legend = { rows, fs, sw, gap, rowH, x: pad, y: bottom - blockH + rowH * 0.7, ramp: legend.ramp || null, radius: cfg.legendRadius };
    bottom -= blockH + Math.round(pad * 0.35);
  }
  out.bottom = bottom;
  return out;
}

// ── layouts ──

// Bars: a grid of categories by series, side-by-side groups, stacked towers or
// a ring. Heights keep an honest zero baseline; negative values go below it.
function planBars(data, cfg, ctx) {
  const cats = data.categories || [], series = (data.series || []).filter((s) => s && s.values);
  const nx = Math.max(1, cats.length), nz = Math.max(1, series.length);
  let layout = cfg.sceneLayout;
  if (['grid', 'grouped', 'stacked', 'ring'].indexOf(layout) < 0) layout = nz > 1 ? 'grid' : 'grouped';
  const vals = [];
  series.forEach((s) => s.values.forEach((v) => { if (v != null && Number.isFinite(+v)) vals.push(+v); }));
  let maxAbs = 1;
  if (layout === 'stacked') {
    for (let c = 0; c < nx; c++) {
      let pos = 0, neg = 0;
      series.forEach((s) => { const v = +s.values[c]; if (Number.isFinite(v)) { if (v >= 0) pos += v; else neg -= v; } });
      maxAbs = Math.max(maxAbs, pos, neg);
    }
  } else vals.forEach((v) => { maxAbs = Math.max(maxAbs, Math.abs(v)); });
  if (cfg.yMax > maxAbs) maxAbs = cfg.yMax;
  const marks = [], labels = [], hl = ctx.highlight;
  const maxVal = vals.length ? Math.max(...vals) : 0, minVal = vals.length ? Math.min(...vals) : 0;
  const isHl = (ci, si, v) => {
    if (!hl) return true;
    const c = String(cats[ci] || '').toLowerCase(), s = String((series[si] && series[si].name) || '').toLowerCase();
    return hl.has(c) || hl.has(s) || (hl.has('max') && v === maxVal) || (hl.has('min') && v === minVal) || (hl.has('last') && ci === nx - 1);
  };
  const colourFor = (ci, si, v) => {
    if (ctx.colorBy === 'value') return rampAt(ctx.ramp, maxAbs ? Math.abs(v) / maxAbs : 0);
    const pal = ctx.palette;
    if (ctx.colorBy === 'category') return pal[ci % pal.length];
    if (nz === 1 && !hl) return pal[0];
    return pal[si % pal.length];
  };
  // Rows by series: shortest at the front so no row hides another.
  const order = series.map((s, si) => {
    let sum = 0, n = 0; s.values.forEach((v) => { if (Number.isFinite(+v)) { sum += Math.abs(+v); n++; } });
    return { si, mean: n ? sum / n : 0 };
  });
  const rowOf = new Array(nz);
  if (layout === 'grid') order.slice().sort((a, b) => a.mean - b.mean || a.si - b.si).forEach((o, i) => { rowOf[o.si] = i; });
  else series.forEach((_, si) => { rowOf[si] = 0; });
  const rows = layout === 'grid' ? nz : 1;
  const span = layout === 'ring' ? 0 : Math.max(nx, rows);
  const hMax = layout === 'ring' ? clamp(Math.sqrt(nx) * 1.25 + 1.2, 2.6, 6) : clamp(span * 0.58 + 0.9, 2.6, 6.8);
  const scale = hMax / maxAbs;
  const valueSize = cfg.valueSize || Math.round(cfg.labelSize * 0.82);
  const showAllValues = cfg.showValues && nx * nz <= 30;
  let order3 = 0;
  const total = nx * nz;
  const pushBar = (x, z, w, d, y0, y1, ci, si, v, rot) => {
    const h = Math.max(0.012, Math.abs(y1 - y0));
    const on = isHl(ci, si, v);
    const colour = on ? colourFor(ci, si, v) : ctx.colours.quiet;
    marks.push({ t: 'box', p: [r4(x), r4((y0 + y1) / 2), r4(z)], s: [r4(w), r4(h), r4(d)], c: colour, r: rot ? r4(rot) : 0, g: r4(order3++ / Math.max(1, total)), q: on ? 0 : 1, k: ci + ':' + si });
    if (layout === 'ring' && nz === 1) {
      // A ring has no front edge to label, so each bar carries its own name.
      const top = Math.max(y0, y1) + 0.16;
      labels.push({ p: [r4(x), r4(top), r4(z)], text: String(cats[ci]), sub: cfg.showValues ? sceneFmt(v, cfg.numberFormat) : '', kind: 'value', size: Math.round(cfg.labelSize * 0.8), weight: on && hl ? 750 : 600, pri: on && hl ? 3 : 2, colour: cfg.valueColor || null, up: 1 });
    } else if (cfg.showValues && (showAllValues || (hl && on) || v === maxVal)) {
      const top = Math.max(y0, y1), lift = 0.16;
      labels.push({ p: [r4(x), r4(v < 0 ? Math.min(y0, y1) - lift - 0.1 : top + lift), r4(z)], text: sceneFmt(v, cfg.numberFormat), kind: 'value', size: valueSize, weight: on && hl ? 750 : cfg.valueWeight, pri: on && hl ? 3 : 2, colour: cfg.valueColor || null });
    }
  };
  if (layout === 'ring') {
    const ringW = 0.82;
    const R = Math.max(1.6, (nx * 0.95) / (2 * Math.PI) + 0.4);
    const step = (2 * Math.PI) / nx;
    const startA = -(ctx.poseAz * Math.PI / 180) - Math.PI / 2;
    for (let ci = 0; ci < nx; ci++) {
      const a = startA + ci * step;
      series.forEach((s, si) => {
        const v = +s.values[ci]; if (!Number.isFinite(v)) return;
        const rr = R + si * ringW, chord = Math.min(0.8, rr * step * 0.62);
        const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
        // Rotated by -a, the box's local x runs outwards, so width is the radial depth.
        pushBar(x, z, Math.min(ringW * 0.72, 0.7), Math.min(chord, 0.7), Math.min(0, v * scale), Math.max(0, v * scale), ci, si, v, -a);
      });
      if (nz > 1) {
        const lr = R + (nz - 1) * ringW + 0.95;
        labels.push({ p: [r4(Math.cos(a) * lr), 0.02, r4(Math.sin(a) * lr)], text: String(cats[ci]), kind: 'category', size: cfg.labelSize, weight: cfg.labelWeight, pri: 1 });
      }
    }
    const outer = R + (nz - 1) * ringW + 0.6;
    return { marks, labels, layout, hMax, footprint: { circle: [0, 0, outer + 0.4] }, grid: ringGrid(outer, nx, startA, step), rows, nx, nz, maxAbs };
  }
  // Categories run left to right as the camera sees them, and row 0 is the
  // row nearest the camera, whichever side of the chart the camera is on.
  const xs = ctx.camRight[0] >= 0 ? 1 : -1, zs = ctx.camDir[2] >= 0 ? 1 : -1;
  const pitch = xs;
  const x0 = -(nx - 1) / 2 * pitch;
  const z0 = zs * (rows - 1) / 2;
  for (let ci = 0; ci < nx; ci++) {
    const cx = x0 + ci * pitch;
    if (layout === 'stacked') {
      let pos = 0, neg = 0;
      series.forEach((s, si) => {
        const v = +s.values[ci]; if (!Number.isFinite(v)) return;
        const y0 = v >= 0 ? pos : -neg; const y1 = y0 + v * scale;
        if (v >= 0) pos = y1; else neg = -y1;
        pushBarSeg(cx, 0, ci, si, v, y0, y1);
      });
      continue;
    }
    if (layout === 'grouped') {
      const gw = nz === 1 ? 0.64 : Math.min(0.88, 0.28 * nz + 0.3), bw = gw / nz;
      series.forEach((s, si) => {
        const v = +s.values[ci]; if (!Number.isFinite(v)) return;
        const x = cx + xs * (-gw / 2 + bw * (si + 0.5));
        pushBar(x, 0, bw * (nz === 1 ? 1 : 0.88), nz === 1 ? 0.64 : Math.max(0.42, bw * 0.88), Math.min(0, v * scale), Math.max(0, v * scale), ci, si, v, 0);
      });
      continue;
    }
    series.forEach((s, si) => {
      const v = +s.values[ci]; if (!Number.isFinite(v)) return;
      const z = z0 - zs * rowOf[si];
      pushBar(cx, z, 0.62, 0.62, Math.min(0, v * scale), Math.max(0, v * scale), ci, si, v, 0);
    });
  }
  function pushBarSeg(x, z, ci, si, v, y0, y1) {
    const on = isHl(ci, si, v);
    marks.push({ t: 'box', p: [r4(x), r4((y0 + y1) / 2), r4(z)], s: [0.64, r4(Math.max(0.012, Math.abs(y1 - y0))), 0.64], c: on ? colourFor(ci, si, v) : ctx.colours.quiet, r: 0, g: r4(ci / nx), q: on ? 0 : 1, k: ci + ':' + si });
  }
  if (layout === 'stacked' && cfg.showValues) {
    for (let ci = 0; ci < nx; ci++) {
      let pos = 0, sum = 0;
      series.forEach((s) => { const v = +s.values[ci]; if (Number.isFinite(v)) { sum += v; if (v > 0) pos += v; } });
      labels.push({ p: [r4(x0 + ci * pitch), r4(pos * scale + 0.16), 0], text: sceneFmt(sum, cfg.numberFormat), kind: 'value', size: valueSize, weight: cfg.valueWeight, pri: 2, colour: cfg.valueColor || null });
    }
  }
  const front = z0 + zs * 0.5;
  cats.forEach((c, ci) => labels.push({ p: [r4(x0 + ci * pitch), 0.02, r4(front + zs * 0.4)], text: String(c), kind: 'category', size: cfg.labelSize, weight: cfg.labelWeight, pri: 1 }));
  if (layout === 'grid' && nz > 1) series.forEach((s, si) => labels.push({ p: [r4(x0 + (nx - 1) * pitch + xs * 0.62), 0.02, r4(z0 - zs * rowOf[si])], text: String(s.name), kind: 'series', size: Math.round(cfg.labelSize * 0.86), weight: cfg.labelWeight, pri: 1, anchor: 'start' }));
  const ax0 = Math.min(x0, x0 + (nx - 1) * pitch) - 0.5, ax1 = Math.max(x0, x0 + (nx - 1) * pitch) + 0.5;
  const az0 = -(rows - 1) / 2 - 0.5, az1 = (rows - 1) / 2 + 0.5;
  return { marks, labels, layout, hMax, footprint: { rect: [ax0, ax1, az0, az1] }, grid: rectGrid(ax0, ax1, az0, az1, nx, rows), rows, nx, nz, maxAbs };
}
function rectGrid(xs, xe, zs, ze, nx, nz) {
  const g = [], m = 0.35;
  for (let i = 0; i <= nx; i++) { const x = r4(xs + i * (xe - xs) / nx); g.push([x, r4(zs - m), x, r4(ze + m)]); }
  for (let j = 0; j <= nz; j++) { const z = r4(zs + j * (ze - zs) / nz); g.push([r4(xs - m), z, r4(xe + m), z]); }
  return g;
}
function ringGrid(R, n, startA, step) {
  const g = [], seg = 96;
  for (const rr of [R * 0.45, R]) for (let i = 0; i < seg; i++) {
    const a = (i / seg) * 2 * Math.PI, b = ((i + 1) / seg) * 2 * Math.PI;
    g.push([r4(Math.cos(a) * rr), r4(Math.sin(a) * rr), r4(Math.cos(b) * rr), r4(Math.sin(b) * rr)]);
  }
  for (let i = 0; i < n; i++) { const a = startA + (i + 0.5) * step; g.push([r4(Math.cos(a) * R * 0.45), r4(Math.sin(a) * R * 0.45), r4(Math.cos(a) * R), r4(Math.sin(a) * R)]); }
  return g;
}

// Donut and pie: one series, a slice per category, starting at twelve o'clock
// as the camera sees it and running clockwise. Towers raise each slice by its
// value; exploded pulls every slice out from the centre.
function planDonut(data, cfg, ctx) {
  const cats = data.categories || [], s = (data.series || [])[0];
  const items = [];
  if (s) cats.forEach((c, i) => { const v = +s.values[i]; if (Number.isFinite(v) && v > 0) items.push({ c: String(c), v, i }); });
  let layout = cfg.sceneLayout;
  if (['donut', 'pie', 'towers', 'exploded'].indexOf(layout) < 0) layout = 'donut';
  const total = items.reduce((n, it) => n + it.v, 0) || 1, max = items.reduce((m, it) => Math.max(m, it.v), 0) || 1;
  const R = 3, r0 = layout === 'pie' || layout === 'exploded' ? 0 : R * clamp(cfg.donutRadius || 0.55, 0.2, 0.85);
  const gap = clamp(cfg.sliceGap, 0, 12) * Math.PI / 180 * 0.6;
  const marks = [], labels = [], hl = ctx.highlight;
  const azr = ctx.poseAz * Math.PI / 180;
  let phi = 0;
  const hiVal = max, loVal = items.reduce((m, it) => Math.min(m, it.v), Infinity);
  items.forEach((it, k) => {
    const sweep = (it.v / total) * 2 * Math.PI;
    const p0 = phi + gap / 2, p1 = phi + sweep - gap / 2, mid = phi + sweep / 2;
    phi += sweep;
    const a0 = p0 - azr - Math.PI / 2, a1 = Math.max(a0 + 0.002, p1 - azr - Math.PI / 2), am = mid - azr - Math.PI / 2;
    const h = layout === 'towers' ? 0.3 + 2.4 * (it.v / max) : 0.62;
    const on = !hl || hl.has(it.c.toLowerCase()) || (hl.has('max') && it.v === hiVal) || (hl.has('min') && it.v === loVal) || (hl.has('last') && k === items.length - 1);
    const pop = layout === 'exploded' ? 0.32 : (hl && on ? 0.28 : 0);
    const off = [r4(Math.cos(am) * pop), r4(Math.sin(am) * pop)];
    const colour = on ? (ctx.colorBy === 'value' ? rampAt(ctx.ramp, it.v / max) : ctx.palette[it.i % ctx.palette.length]) : ctx.colours.quiet;
    marks.push({ t: 'sector', a0: r4(a0), a1: r4(a1), r0: r4(r0), r1: R, y0: 0, y1: r4(h), off, c: colour, q: on ? 0 : 1, g: r4(k / Math.max(1, items.length)), k: String(it.i) });
    if (cfg.showValues) {
      const lr = R + 0.62 + pop;
      labels.push({ p: [r4(Math.cos(am) * lr), r4(h * 0.5), r4(Math.sin(am) * lr)], text: it.c, sub: sceneFmt(it.v, cfg.numberFormat === 'auto' ? 'share' : cfg.numberFormat, total), kind: 'category', size: cfg.labelSize, weight: on && hl ? 750 : cfg.labelWeight, pri: on ? 2 : 1, side: Math.cos(am) * ctx.camRight[0] + Math.sin(am) * ctx.camRight[2] });
    }
  });
  const outer = R + 0.4;
  return { marks, labels, layout, hMax: 2.7, footprint: { circle: [0, 0, outer] }, grid: ringGrid(R + 0.3, Math.max(1, items.length), -azr - Math.PI / 2, 2 * Math.PI / Math.max(1, items.length)), nx: items.length, nz: 1, total };
}

// Points in a cube: the first three numeric columns are x, y and z, an optional
// fourth is size. Colour follows a repeated label column as groups, or the
// y value as a ramp, or stays one brand colour.
function planScatter(data, cfg, ctx) {
  const cols = (data.numericCols || []).slice(0, 4), marks = [], labels = [];
  const ext = (a) => { let lo = Infinity, hi = -Infinity; (a || []).forEach((v) => { if (v != null && Number.isFinite(+v)) { lo = Math.min(lo, +v); hi = Math.max(hi, +v); } }); return Number.isFinite(lo) ? (lo === hi ? [lo - 0.5, hi + 0.5] : [lo, hi]) : [0, 1]; };
  const SX = 6, SY = 4.4, SZ = 6;
  if (cols.length < 3) return { marks, labels, layout: 'cube', hMax: SY, footprint: { rect: [-SX / 2, SX / 2, -SZ / 2, SZ / 2] }, grid: rectGrid(-SX / 2, SX / 2, -SZ / 2, SZ / 2, 6, 6), nx: 0, nz: 0, legend: null };
  const ex = ext(cols[0].values), ey = ext(cols[1].values), ez = ext(cols[2].values), es = cols[3] ? ext(cols[3].values) : null;
  const n = Math.min(2000, cols[0].values.length);
  const groups = uniqueInOrder((data.categories || []).slice(0, n));
  const grouped = ctx.colorBy !== 'value' && groups.length > 1 && groups.length <= 12 && groups.length < n;
  const baseR = clamp(1.25 / Math.cbrt(Math.max(1, n)), 0.06, 0.2);
  const hl = ctx.highlight;
  for (let i = 0; i < n; i++) {
    const xv = cols[0].values[i], yv = cols[1].values[i], zv = cols[2].values[i];
    if (![xv, yv, zv].every((v) => v != null && Number.isFinite(+v))) continue;
    const nx_ = (+xv - ex[0]) / (ex[1] - ex[0]), ny = (+yv - ey[0]) / (ey[1] - ey[0]), nz_ = (+zv - ez[0]) / (ez[1] - ez[0]);
    const sv = es && cols[3].values[i] != null && Number.isFinite(+cols[3].values[i]) ? (+cols[3].values[i] - es[0]) / (es[1] - es[0]) : 0.4;
    const group = data.categories && data.categories[i];
    const on = !hl || (group != null && hl.has(String(group).toLowerCase()));
    let colour = ctx.palette[0];
    if (ctx.colorBy === 'value') colour = rampAt(ctx.ramp, ny);
    else if (grouped) colour = ctx.palette[groups.indexOf(group) % ctx.palette.length];
    const p = [r4((nx_ - 0.5) * SX), r4(ny * SY + 0.12), r4((nz_ - 0.5) * SZ)];
    marks.push({ t: 'sphere', p, r: r4(baseR * (es ? 0.55 + sv * 1.3 : 1)), c: on ? colour : ctx.colours.quiet, q: on ? 0 : 1, g: r4(i / n), stem: n <= 80 ? 1 : 0 });
  }
  // Axis titles at the ends of the three axes that run along the floor's back
  // and left edges as the camera sees them.
  const camX = ctx.camDir[0] >= 0 ? 1 : -1, camZ = ctx.camDir[2] >= 0 ? 1 : -1;
  const bx = -camX * SX / 2, bz = -camZ * SZ / 2;
  const t = (s) => String(s || '');
  labels.push({ p: [0, 0.02, r4(-bz + camZ * 0.55)], text: t(cfg.xTitle || cols[0].name), kind: 'axis', size: cfg.labelSize, weight: 650, pri: 3 });
  labels.push({ p: [r4(bx), r4(SY + 0.5), r4(bz)], text: t(cfg.yTitle || cols[1].name), kind: 'axis', size: cfg.labelSize, weight: 650, pri: 3 });
  labels.push({ p: [r4(-bx + camX * 0.55), 0.02, 0], text: t(cols[2].name), kind: 'axis', size: cfg.labelSize, weight: 650, pri: 3 });
  const small = Math.round(cfg.labelSize * 0.72);
  labels.push({ p: [r4(-SX / 2), 0.02, r4(-bz + camZ * 0.55)], text: sceneFmt(ex[0], cfg.numberFormat), kind: 'tick', size: small, weight: 500, pri: 1 });
  labels.push({ p: [r4(SX / 2), 0.02, r4(-bz + camZ * 0.55)], text: sceneFmt(ex[1], cfg.numberFormat), kind: 'tick', size: small, weight: 500, pri: 1 });
  labels.push({ p: [r4(bx), r4(SY + 0.12), r4(bz)], text: sceneFmt(ey[1], cfg.numberFormat), kind: 'tick', size: small, weight: 500, pri: 1, anchor: 'end', dx: -8 });
  labels.push({ p: [r4(bx), 0.12, r4(bz)], text: sceneFmt(ey[0], cfg.numberFormat), kind: 'tick', size: small, weight: 500, pri: 1, anchor: 'end', dx: -8 });
  const axisLines = [[bx, 0, bz, bx, SY + 0.12, bz]];
  return {
    marks, labels, layout: 'cube', hMax: SY + 0.3, axisLines,
    footprint: { rect: [-SX / 2, SX / 2, -SZ / 2, SZ / 2] }, grid: rectGrid(-SX / 2, SX / 2, -SZ / 2, SZ / 2, 6, 6),
    legend: ctx.colorBy === 'value' ? { ramp: { stops: ctx.ramp, min: sceneFmt(ey[0], cfg.numberFormat), max: sceneFmt(ey[1], cfg.numberFormat), title: cols[1].name } }
      : grouped ? { items: groups.map((g, i) => ({ label: String(g), colour: ctx.palette[i % ctx.palette.length] })) } : null,
  };
}

// A surface over categories (x) and series (z), smoothed between the data with
// Catmull-Rom so a small table still reads as terrain. Colour is the
// colourway's ramp by height; the data's own rows and columns are drawn on it.
function planSurface(data, cfg, ctx) {
  const cats = data.categories || [], series = data.series || [], marks = [], labels = [];
  const nx = cats.length, nz = series.length;
  if (nx < 2 || nz < 2) return { marks, labels, layout: 'surface', hMax: 3, footprint: { rect: [-3, 3, -2, 2] }, grid: [], nx, nz };
  const all = []; series.forEach((s) => s.values.forEach((v) => { if (v != null && Number.isFinite(+v)) all.push(+v); }));
  const lo = Math.min(...all), hi = Math.max(...all), rng = hi - lo || 1;
  const SX = clamp(nx * 0.9, 4.5, 9), SZ = clamp(nz * 0.9, 3, 7), hMax = clamp(Math.max(SX, SZ) * 0.42, 2.2, 3.6);
  const at = (si, ci) => { const v = +series[si].values[ci]; return Number.isFinite(v) ? v : lo; };
  const cr = (p0, p1, p2, p3, t) => 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
  const sample = (u, v) => {
    // u along categories, v along series, both in data index space.
    const ci = clamp(Math.floor(u), 0, nx - 2), si = clamp(Math.floor(v), 0, nz - 2), tu = u - ci, tv = v - si;
    const row = (s) => cr(at(s, Math.max(0, ci - 1)), at(s, ci), at(s, ci + 1), at(s, Math.min(nx - 1, ci + 2)), tu);
    const r = [row(Math.max(0, si - 1)), row(si), row(si + 1), row(Math.min(nz - 1, si + 2))];
    return clamp(cr(r[0], r[1], r[2], r[3], tv), lo - rng * 0.15, hi + rng * 0.15);
  };
  const res = (n) => Math.min(48, (n - 1) * Math.max(2, Math.ceil(36 / (n - 1)))) + 1;
  const rx = res(nx), rz = res(nz);
  const pts = [], cols = [];
  for (let j = 0; j < rz; j++) for (let i = 0; i < rx; i++) {
    const u = (i / (rx - 1)) * (nx - 1), v = (j / (rz - 1)) * (nz - 1);
    const val = sample(u, v), tt = (val - lo) / rng;
    pts.push(r4((i / (rx - 1) - 0.5) * SX), r4(0.04 + clamp(tt, -0.1, 1.1) * hMax), r4((j / (rz - 1) - 0.5) * SZ));
    cols.push(rampAt(ctx.ramp, tt));
  }
  // The data's rows and columns as lines lying on the surface.
  const lines = [];
  for (let si = 0; si < nz; si++) {
    const v = si, line = [];
    for (let i = 0; i < rx; i++) { const u = (i / (rx - 1)) * (nx - 1); line.push([r4((i / (rx - 1) - 0.5) * SX), r4(0.05 + ((sample(u, v) - lo) / rng) * hMax), r4((v / (nz - 1) - 0.5) * SZ)]); }
    lines.push(line);
  }
  for (let ci = 0; ci < nx; ci++) {
    const u = ci, line = [];
    for (let j = 0; j < rz; j++) { const v = (j / (rz - 1)) * (nz - 1); line.push([r4((u / (nx - 1) - 0.5) * SX), r4(0.05 + ((sample(u, v) - lo) / rng) * hMax), r4((j / (rz - 1) - 0.5) * SZ)]); }
    lines.push(line);
  }
  marks.push({ t: 'surface', nx: rx, nz: rz, pts, cols, lines, skirt: 1, c: ctx.ramp[ctx.ramp.length - 1], q: 0, g: 0 });
  const camZ = ctx.camDir[2] >= 0 ? 1 : -1, camX = ctx.camDir[0] >= 0 ? 1 : -1;
  cats.forEach((c, ci) => labels.push({ p: [r4((ci / (nx - 1) - 0.5) * SX), 0.02, r4(camZ * (SZ / 2 + 0.6))], text: String(c), kind: 'category', size: cfg.labelSize, weight: cfg.labelWeight, pri: 1 }));
  series.forEach((s, si) => labels.push({ p: [r4(camX * (SX / 2 + 0.55)), 0.02, r4((si / (nz - 1) - 0.5) * SZ)], text: String(s.name), kind: 'series', size: Math.round(cfg.labelSize * 0.86), weight: cfg.labelWeight, pri: 1, anchor: camX > 0 ? 'start' : 'end' }));
  // The peak, named.
  let best = null;
  series.forEach((s, si) => s.values.forEach((v, ci) => { if (Number.isFinite(+v) && (!best || +v > best.v)) best = { v: +v, si, ci }; }));
  if (best && cfg.showValues) labels.push({ p: [r4((best.ci / (nx - 1) - 0.5) * SX), r4(0.05 + ((best.v - lo) / rng) * hMax + 0.3), r4((best.si / (nz - 1) - 0.5) * SZ)], text: sceneFmt(best.v, cfg.numberFormat), kind: 'value', size: cfg.valueSize || Math.round(cfg.labelSize * 0.9), weight: 750, pri: 3 });
  return {
    marks, labels, layout: 'surface', hMax: hMax + 0.2,
    footprint: { rect: [-SX / 2, SX / 2, -SZ / 2, SZ / 2] }, grid: rectGrid(-SX / 2, SX / 2, -SZ / 2, SZ / 2, nx - 1, nz - 1), nx, nz,
    legend: { ramp: { stops: ctx.ramp, min: sceneFmt(lo, cfg.numberFormat), max: sceneFmt(hi, cfg.numberFormat), title: cfg.yTitle || 'Value' } },
  };
}

// Cinematic flights: each series is a route through the ordered categories;
// altitude is value and series sit side by side in lanes. The adapter flies a
// camera along the followed series; the plan's own camera is the establishing
// shot, which is also the still and the vector export.
function planFlight(data, cfg, ctx) {
  const cats = data.categories || [], series = data.series || [], marks = [], labels = [];
  const nx = cats.length, nz = series.length;
  if (nx < 2 || !nz) return { marks, labels, layout: 'flight', hMax: 4, footprint: { rect: [-3, 3, -3, 3] }, grid: [], nx, nz, flight: null };
  const values = []; series.forEach((s) => s.values.forEach((v) => { if (v != null && Number.isFinite(+v)) values.push(+v); }));
  const lo = values.length ? Math.min(...values) : 0, hi = values.length ? Math.max(...values) : 1, rng = hi - lo || 1;
  const maxAbs = values.reduce((m, v) => Math.max(m, Math.abs(v)), 1);
  const pitch = 1.18, spanZ = Math.max(7, (nx - 1) * pitch), lane = Math.min(1.55, 5.2 / Math.max(1, nz));
  const kind = cfg.chartType;
  const valueAt = (s, i) => {
    const d = s.values[i]; if (d != null && Number.isFinite(+d)) return +d;
    let a = i - 1, b = i + 1;
    while (a >= 0 && !Number.isFinite(+s.values[a])) a--;
    while (b < nx && !Number.isFinite(+s.values[b])) b++;
    if (a >= 0 && b < nx) return +s.values[a] + (+s.values[b] - +s.values[a]) * ((i - a) / (b - a));
    if (a >= 0) return +s.values[a]; if (b < nx) return +s.values[b]; return lo;
  };
  const pointFor = (si, i) => {
    const v = valueAt(series[si], i);
    const y = kind === 'skyline3d' ? v / maxAbs * 3.9 : 0.28 + clamp((v - lo) / rng, 0, 1) * 3.9;
    return [r4((si - (nz - 1) / 2) * lane), r4(y), r4(spanZ / 2 - i * pitch)];
  };
  const req = String(cfg.flightSeries || '').trim().toLowerCase();
  let follow = 0;
  if (/^\d+$/.test(req)) follow = clamp(+req - 1, 0, nz - 1);
  else if (req) for (let fi = 0; fi < nz; fi++) if (String(series[fi].name || '').trim().toLowerCase() === req) { follow = fi; break; }
  series.forEach((s, si) => {
    const pts = cats.map((_, i) => pointFor(si, i));
    const lead = si === follow, colour = ctx.palette[si % ctx.palette.length];
    if (kind === 'ribbon3d') marks.push({ t: 'path', k: 'ribbon', pts, r: lead ? 0.25 : 0.18, c: colour, o: lead ? 0.92 : 0.6, q: lead ? 0 : 1 });
    else marks.push({ t: 'path', k: 'tube', pts, r: kind === 'constellation3d' ? 0.028 : kind === 'skyline3d' ? 0.022 : (lead ? 0.075 : 0.04), c: colour, o: lead ? 0.97 : 0.62, q: lead ? 0 : 1 });
    pts.forEach((p, i) => {
      if (kind === 'skyline3d') {
        const h = Math.max(0.03, Math.abs(p[1])), w = lead ? 0.32 : 0.24;
        marks.push({ t: 'box', p: [p[0], r4(p[1] < 0 ? -h / 2 : h / 2), p[2]], s: [w, r4(h), w], c: colour, o: lead ? 0.92 : 0.6, q: lead ? 0 : 1, g: r4(i / nx), r: 0 });
      }
      if (kind === 'constellation3d') {
        const h = Math.max(0.02, p[1]);
        marks.push({ t: 'box', p: [p[0], r4(h / 2), p[2]], s: [0.018, r4(h), 0.018], c: colour, o: 0.25, q: 1, g: r4(i / nx), r: 0 });
      }
      marks.push({ t: 'sphere', p, r: kind === 'constellation3d' ? 0.13 : kind === 'skyline3d' ? 0.065 : (lead ? 0.09 : 0.06), c: colour, o: lead ? 1 : 0.75, q: lead ? 0 : 1, g: r4(i / nx) });
    });
  });
  const every = Math.max(1, Math.ceil(nx / 10));
  cats.forEach((c, i) => { if (i % every === 0 || i === nx - 1) labels.push({ p: [r4(-(nz - 1) / 2 * lane - 0.7), 0.02, r4(spanZ / 2 - i * pitch)], text: String(c), kind: 'category', size: Math.round(cfg.labelSize * 0.86), weight: cfg.labelWeight, pri: 1, anchor: 'end' }); });
  const halfX = (nz - 1) / 2 * lane + 1.1;
  return {
    marks, labels, layout: 'flight', hMax: 4.3,
    footprint: { rect: [-halfX, halfX, -spanZ / 2 - 0.6, spanZ / 2 + 0.6] },
    grid: rectGrid(-halfX, halfX, -spanZ / 2 - 0.6, spanZ / 2 + 0.6, Math.max(2, nz * 2), Math.max(4, nx - 1)),
    nx, nz,
    flight: {
      follow, pitch, categories: cats.map(String), series: String(series[follow].name || 'Value'),
      values: cats.map((_, i) => valueAt(series[follow], i)),
      outward: follow < (nz - 1) / 2 ? -1 : 1,
    },
  };
}

// The world points a frame must hold: every mark's extremes and the label
// anchors. Floors and grids are left out, so they bleed past the edges.
function scenePoints(layout) {
  const pts = [];
  for (const m of layout.marks) {
    if (m.t === 'box') {
      const ca = Math.cos(m.r || 0), sa = Math.sin(m.r || 0), hw = m.s[0] / 2, hh = m.s[1] / 2, hd = m.s[2] / 2;
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
        const lx = sx * hw, lz = sz * hd;
        pts.push([m.p[0] + lx * ca + lz * sa, m.p[1] + sy * hh, m.p[2] - lx * sa + lz * ca]);
      }
    } else if (m.t === 'sector') {
      const n = Math.max(2, Math.ceil((m.a1 - m.a0) / 0.25));
      for (let i = 0; i <= n; i++) {
        const a = m.a0 + (m.a1 - m.a0) * i / n;
        for (const y of [m.y0, m.y1]) pts.push([m.off[0] + Math.cos(a) * m.r1, y, m.off[1] + Math.sin(a) * m.r1]);
      }
    } else if (m.t === 'sphere') {
      pts.push([m.p[0] - m.r, m.p[1], m.p[2]], [m.p[0] + m.r, m.p[1], m.p[2]], [m.p[0], m.p[1] + m.r, m.p[2]], [m.p[0], Math.max(0, m.p[1] - m.r), m.p[2]], [m.p[0], m.p[1], m.p[2] - m.r], [m.p[0], m.p[1], m.p[2] + m.r]);
    } else if (m.t === 'path') {
      m.pts.forEach((p) => pts.push(p, [p[0], 0, p[2]]));
    } else if (m.t === 'surface') {
      for (let i = 0; i < m.pts.length; i += 3 * 3) pts.push([m.pts[i], m.pts[i + 1], m.pts[i + 2]], [m.pts[i], 0, m.pts[i + 2]]);
    }
  }
  for (const l of layout.labels) pts.push(l.p);
  return pts;
}

// Lay out labels in pixels, greedily, highest priority first; a label that
// would overlap one already placed, or leave the artboard, is not drawn.
function placeSceneLabels(labels, project, W, H, pad, bottom) {
  const placed = [], boxes = [], limit = bottom == null ? H - pad * 0.25 : bottom;
  // Highest priority first; among equals the nearer label wins, so the front of
  // a ring is named before its far side.
  const order = labels.map((l, i) => ({ l, i, q: project(l.p) })).sort((a, b) => (b.l.pri || 0) - (a.l.pri || 0) || a.q[2] - b.q[2] || a.i - b.i);
  for (const { l, q } of order) {
    if (!(q[2] > 0)) continue;
    const size = l.size || 16, text = String(l.text || '');
    const w = Math.max(text.length, l.sub ? String(l.sub).length : 0) * size * 0.56 + 6;
    const h = size * (l.sub ? 2.3 : 1.25);
    let anchor = l.anchor || 'middle';
    if (l.side != null) anchor = l.side > 0.25 ? 'start' : l.side < -0.25 ? 'end' : 'middle';
    let x = q[0] + (l.dx || 0), y = q[1];
    if (l.kind === 'value') y -= size * 0.25 + (l.sub && l.up ? size * 1.15 : 0);
    else if (l.kind === 'category' || l.kind === 'series' || l.kind === 'axis' || l.kind === 'tick') y += size * 0.35;
    const left = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2;
    const top = y - size * 0.95;
    const box = [left, top, left + w, top + h];
    if (box[0] < pad * 0.25 || box[2] > W - pad * 0.25 || box[1] < pad * 0.25 || box[3] > limit) { placed.offFrame = (placed.offFrame || 0) + 1; continue; }
    if (boxes.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])) continue;
    boxes.push(box);
    placed.push({ x: r4(x), y: r4(y), anchor, text, sub: l.sub || '', size, weight: l.weight || 500, kind: l.kind, colour: l.colour || null });
  }
  return placed;
}

// Build the whole plan for one chart.
function planScene(data, cfg) {
  const W = cfg.width, H = cfg.height, aspect = W / H;
  const kind = cfg.chartType === 'scatter3d' ? 'scatter' : cfg.chartType === 'surface3d' ? 'surface'
    : cfg.chartType === 'donut3d' ? 'donut' : CINEMATIC_TYPES.indexOf(cfg.chartType) >= 0 ? 'flight' : 'bars';
  const stage = SCENE_STAGES.indexOf(cfg.sceneStage) >= 0 ? cfg.sceneStage : 'studio';
  const colours = sceneStageColours(cfg, stage);
  const palette = sceneCategorical(cfg, colours);
  const ramp = sceneRamp(cfg, colours);
  const poseName = kind === 'flight' ? 'hero' : (cfg.scenePose || 'hero');
  let poseDef = poseName === 'custom' ? { az: cfg.cameraAzimuth, el: cfg.cameraElevation } : (SCENE_POSES[poseName] || SCENE_POSES.hero);
  const lensKind = poseDef.lens || (kind === 'flight' ? 'perspective' : (['wide', 'long', 'orthographic'].indexOf(cfg.cameraProjection) >= 0 ? cfg.cameraProjection : 'perspective'));
  const colorBy = kind === 'surface' ? 'value' : cfg.colorBy;
  // A ring hides its far side from a low camera, so its hero view looks down more.
  if (poseName === 'hero' && kind === 'bars' && cfg.sceneLayout === 'ring') poseDef = Object.assign({}, poseDef, { el: 40 });
  const baseBasis = camBasis(poseDef.az, poseDef.el);
  const ctx = { colours, palette, ramp, colorBy, highlight: sceneHighlightSet(cfg), poseAz: poseDef.az, camDir: baseBasis.dir, camRight: baseBasis.right };
  const layout = kind === 'scatter' ? planScatter(data, cfg, ctx) : kind === 'surface' ? planSurface(data, cfg, ctx)
    : kind === 'donut' ? planDonut(data, cfg, ctx) : kind === 'flight' ? planFlight(data, cfg, ctx) : planBars(data, cfg, ctx);

  // Legend: series for bars and flights, groups or a ramp where the layout says.
  let legend = layout.legend || null;
  if (!legend && kind === 'bars' && colorBy === 'value') legend = { ramp: { stops: ramp, min: sceneFmt(0, cfg.numberFormat), max: sceneFmt(layout.maxAbs, cfg.numberFormat), title: cfg.yTitle || 'Value' } };
  else if (!legend && (kind === 'bars' || kind === 'flight') && colorBy !== 'category' && (data.series || []).length > 1) {
    legend = { items: (data.series || []).map((s, i) => ({ label: String(s.name), colour: palette[i % palette.length] })) };
  } else if (!legend && kind === 'donut' && !cfg.showValues) {
    legend = { items: (data.categories || []).map((c, i) => ({ label: String(c), colour: palette[i % palette.length] })) };
  }
  if (!cfg.showLegend) legend = null;
  const overlay = sceneOverlay(cfg, legend, kind === 'flight');

  // The safe rectangle in NDC. Framing chooses the margin.
  const framing = ['fit', 'close', 'room'].indexOf(cfg.sceneFraming) >= 0 ? cfg.sceneFraming : 'fit';
  const inset = framing === 'room' ? overlay.pad * 2.4 : overlay.pad * 0.6;
  const labelPad = Math.round(cfg.labelSize * 0.6);
  const px = { x0: inset + labelPad, x1: W - inset - labelPad, y0: overlay.top + labelPad, y1: overlay.bottom - labelPad * 0.5 };
  if (px.y1 - px.y0 < H * 0.3) { px.y0 = H * 0.3; px.y1 = H * 0.92; }
  const safe = { x0: px.x0 / W * 2 - 1, x1: px.x1 / W * 2 - 1, y0: 1 - px.y1 / H * 2, y1: 1 - px.y0 / H * 2 };

  const points = scenePoints(layout);
  if (!points.length) points.push([-1, 0, -1], [1, 1, 1]);
  let bx0 = Infinity, bx1 = -Infinity, by0 = Infinity, by1 = -Infinity, bz0 = Infinity, bz1 = -Infinity;
  for (const p of points) { bx0 = Math.min(bx0, p[0]); bx1 = Math.max(bx1, p[0]); by0 = Math.min(by0, p[1]); by1 = Math.max(by1, p[1]); bz0 = Math.min(bz0, p[2]); bz1 = Math.max(bz1, p[2]); }
  const target = [(bx0 + bx1) / 2, (by0 + by1) / 2, (bz0 + bz1) / 2];
  const motion = kind === 'flight' ? 'data-flight' : (cfg.motionPreset || 'none');
  const orbit = motion === 'orbit' || motion === 'reveal-orbit';
  const arc = motion === 'arc' ? 26 : 0;
  const scale = framing === 'close' ? 1.38 : 1;

  // Choose the pose: the hero tries its candidate azimuths and keeps the
  // fullest frame. A camera that moves is framed for every angle it visits.
  const cands = poseName === 'hero' && kind !== 'donut' && !orbit ? SCENE_POSES.hero.candidates : [poseDef.az];
  let best = null;
  for (const az of cands) {
    const f = fitPose(points, { az, el: poseDef.el }, lensKind, aspect, safe, target, 1);
    // Prefer the default three-quarter angle unless another fills clearly more.
    const score = f.fill * (az === poseDef.az ? 1.06 : 1);
    if (!best || score > best.score) best = Object.assign(f, { score });
  }
  let cam = best;
  if (orbit || arc) {
    const angles = orbit ? Array.from({ length: 16 }, (_, i) => cam.az + i * 22.5) : [cam.az - arc, cam.az - arc / 2, cam.az, cam.az + arc / 2, cam.az + arc];
    const fits = angles.map((az) => fitPose(points, { az, el: cam.el }, lensKind, aspect, safe, target, 1));
    const worst = fits.reduce((m, f) => (lensKind === 'orthographic' ? (f.lens.half > m.lens.half ? f : m) : (f.dist > m.dist ? f : m)), fits[0]);
    const avgShift = [fits.reduce((n, f) => n + f.shift[0], 0) / fits.length, fits.reduce((n, f) => n + f.shift[1], 0) / fits.length];
    cam = Object.assign({}, cam, { dist: worst.dist * 1.04, lens: lensKind === 'orthographic' ? { ortho: true, half: worst.lens.half * 1.04 } : cam.lens, shift: avgShift });
  } else if (scale > 1) {
    cam = fitPose(points, { az: cam.az, el: cam.el }, lensKind, aspect, safe, target, scale);
  }
  const camera = {
    az: r4(cam.az), el: r4(cam.el), ortho: !!cam.lens.ortho, fov: cam.lens.ortho ? 0 : cam.lens.fov, half: cam.lens.ortho ? r4(cam.lens.half) : 0,
    dist: r4(cam.dist), target: target.map(r4), shift: cam.shift.map(r4), near: 0.05, far: r4(cam.dist + cam.radius * 6 + 60),
    motion, arc, pose: poseName, lens: lensKind, framing,
  };

  // A close-up centres its focus: the highlighted marks, else the tallest.
  let projector = makeProjector(camera, W, H);
  if (framing === 'close' && !orbit && !arc) {
    const focusMarks = layout.marks.filter((m) => !m.q && (m.t === 'box' || m.t === 'sector' || m.t === 'sphere'));
    const pool = ctx.highlight && focusMarks.length < layout.marks.length ? focusMarks : layout.marks.filter((m) => m.t === 'box').sort((a, b) => b.s[1] - a.s[1]).slice(0, 1);
    if (pool.length) {
      let fx = 0, fy = 0;
      pool.forEach((m) => { const c = m.t === 'sector' ? [m.off[0] + Math.cos((m.a0 + m.a1) / 2) * m.r1 * 0.7, m.y1, m.off[1] + Math.sin((m.a0 + m.a1) / 2) * m.r1 * 0.7] : m.p; const q = projector.project(c); fx += q[0]; fy += q[1]; });
      fx /= pool.length; fy /= pool.length;
      const cx = (px.x0 + px.x1) / 2, cy = (px.y0 + px.y1) / 2;
      // Move towards the focus, but never so far that a chart wider than the
      // frame shows its edge, or one narrower than the frame leaves it.
      const e = cam.ext, sx = cam.shift[0], sy = cam.shift[1];
      const within = (d, a, b) => clamp(d, Math.min(a, b), Math.max(a, b));
      const dx = within((cx - fx) / W * 2, safe.x0 - (e.x0 + sx), safe.x1 - (e.x1 + sx));
      const dy = within(-(cy - fy) / H * 2, safe.y0 - (e.y0 + sy), safe.y1 - (e.y1 + sy));
      camera.shift = [r4(sx + dx), r4(sy + dy)];
      projector = makeProjector(camera, W, H);
    }
  }

  // Labels placed for the still camera; a moving camera places them per frame.
  // A label that would run off the artboard pulls the camera back a little,
  // a few times at most, so the fit holds the words as well as the marks.
  const labelFloor = overlay.bottom + overlay.pad * 0.5;
  let placed = placeSceneLabels(layout.labels, projector.project, W, H, overlay.pad, labelFloor);
  for (let tries = 0; tries < 6 && placed.offFrame && framing !== 'close'; tries++) {
    if (camera.ortho) camera.half = r4(camera.half * 1.06); else camera.dist = r4(camera.dist * 1.06);
    projector = makeProjector(camera, W, H);
    placed = placeSceneLabels(layout.labels, projector.project, W, H, overlay.pad, labelFloor);
  }
  const footprint = layout.footprint;
  return {
    version: 1, kind, layout: layout.layout, W, H,
    transparent: !!cfg.transparent,
    // The floor grid belongs to the Floor stage; a scatter keeps its grid on
    // every stage with a floor, because the floor is how its depth is read.
    stage: { kind: stage, colours, shadows: cfg.sceneShadows !== false, grid: stage === 'floor' || (kind === 'scatter' && stage !== 'float') ? layout.grid : [], footprint, axisLines: layout.axisLines || [] },
    finish: SCENE_FINISHES.indexOf(cfg.sceneMaterial) >= 0 ? cfg.sceneMaterial : 'matte',
    roughness: cfg.sceneRoughness, metalness: cfg.sceneMetalness,
    marks: layout.marks, labels: layout.labels, placed, legend, overlay, camera,
    bounds: { min: [bx0, by0, bz0].map(r4), max: [bx1, by1, bz1].map(r4) },
    flight: layout.flight || null,
    font: cfg.fontFamily || null,
    uid: 'c3' + sceneHash(JSON.stringify([layout.marks, colours, camera, W, H])),
    poster: motion === 'reveal' ? 0.8 : motion === 'stagger' ? 0.92 : motion === 'reveal-orbit' ? 0.9999 : motion === 'data-flight' ? 0.16 : 0,
  };
}

function sceneHash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

// ── vector projection ──
// Draws the plan through its own camera as plain SVG: faces of boxes and
// sectors with flat shading from the key light, spheres as shaded discs,
// paths as strokes, all in back-to-front order.
function sceneShade(hex, n, light, finish) {
  if (finish === 'accurate') return hex;
  const lam = Math.max(0, dot3(n, light));
  const k = 0.6 + 0.52 * lam;
  return k >= 1 ? mixHex(hex, '#ffffff', Math.min(0.16, (k - 1) * 1.4)) : mixHex(hex, '#000000', (1 - k) * 0.95);
}
function sceneVectorSvg(plan, cfg) {
  const W = plan.W, H = plan.H, C = plan.stage.colours, cam = plan.camera;
  const { project, eye } = makeProjector(cam, W, H);
  const keyAz = (cam.az - 42) * Math.PI / 180, keyEl = 52 * Math.PI / 180;
  const light = [Math.sin(keyAz) * Math.cos(keyEl), Math.sin(keyEl), Math.cos(keyAz) * Math.cos(keyEl)];
  const font = plan.font ? ' font-family="' + xml(plan.font) + '"' : '';
  const out = ['<g class="chart3d-vector"' + font + '>'];
  const f2 = (n) => (Math.round(n * 100) / 100);
  const ptsAttr = (ps) => ps.map((q) => f2(q[0]) + ',' + f2(q[1])).join(' ');
  if (!plan.transparent) {
    out.push('<defs><linearGradient id="' + plan.uid + 'stage" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + C.backdrop + '"/><stop offset=".55" stop-color="' + C.backdrop + '"/><stop offset="1" stop-color="' + (plan.stage.kind === 'float' ? C.backdrop : C.floor) + '"/></linearGradient></defs>');
    out.push('<rect width="' + W + '" height="' + H + '" fill="url(#' + plan.uid + 'stage)"/>');
  }
  // Contact shadow: the footprint's outline, softened by a radial fade.
  const fp = plan.stage.footprint;
  if (plan.stage.shadows && plan.finish !== 'accurate' && fp) {
    const ring = [];
    if (fp.circle) for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; ring.push(project([fp.circle[0] + Math.cos(a) * fp.circle[2], 0, fp.circle[1] + Math.sin(a) * fp.circle[2]])); }
    else if (fp.rect) [[fp.rect[0], fp.rect[2]], [fp.rect[1], fp.rect[2]], [fp.rect[1], fp.rect[3]], [fp.rect[0], fp.rect[3]]].forEach((c) => ring.push(project([c[0], 0, c[1]])));
    if (ring.length) {
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      ring.forEach((q) => { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); });
      out.push('<defs><radialGradient id="' + plan.uid + 'contact"><stop offset="0" stop-color="#000" stop-opacity="' + (C.dark ? 0.42 : 0.16) + '"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs>');
      out.push('<ellipse cx="' + f2((x0 + x1) / 2) + '" cy="' + f2((y0 + y1) / 2) + '" rx="' + f2((x1 - x0) * 0.62) + '" ry="' + f2(Math.max(8, (y1 - y0) * 0.68)) + '" fill="url(#' + plan.uid + 'contact)"/>');
    }
  }
  if (plan.stage.kind === 'plinth' && fp) {
    const items = [];
    if (fp.rect) pushBoxFaces(items, { p: [(fp.rect[0] + fp.rect[1]) / 2, -0.09, (fp.rect[2] + fp.rect[3]) / 2], s: [fp.rect[1] - fp.rect[0] + 0.5, 0.18, fp.rect[3] - fp.rect[2] + 0.5], c: C.plinth, r: 0 });
    else if (fp.circle) pushSectorFaces(items, { a0: 0, a1: Math.PI * 2, r0: 0, r1: fp.circle[2] + 0.25, y0: -0.18, y1: 0, off: [fp.circle[0], fp.circle[1]], c: C.plinth });
    items.sort((a, b) => b.d - a.d).forEach((it) => out.push(it.svg));
  }
  plan.stage.grid.forEach((g) => {
    const a = project([g[0], 0.003, g[1]]), b = project([g[2], 0.003, g[3]]);
    out.push('<line x1="' + f2(a[0]) + '" y1="' + f2(a[1]) + '" x2="' + f2(b[0]) + '" y2="' + f2(b[1]) + '" stroke="' + C.grid + '" stroke-width="1" stroke-opacity=".7"/>');
  });
  (plan.stage.axisLines || []).forEach((g) => {
    const a = project([g[0], g[1], g[2]]), b = project([g[3], g[4], g[5]]);
    out.push('<line x1="' + f2(a[0]) + '" y1="' + f2(a[1]) + '" x2="' + f2(b[0]) + '" y2="' + f2(b[1]) + '" stroke="' + C.grid + '" stroke-width="1.5"/>');
  });

  const items = [];
  function faceSvg(ps, colour, opacity) {
    return '<polygon points="' + ptsAttr(ps) + '" fill="' + colour + '"' + (opacity < 1 ? ' fill-opacity="' + f2(opacity) + '"' : '') + ' stroke="' + colour + '" stroke-width=".6" stroke-linejoin="round"' + (opacity < 1 ? ' stroke-opacity="' + f2(opacity) + '"' : '') + '/>';
  }
  function facing(centre, normal) {
    if (cam.ortho) return dot3(normal, camBasis(cam.az, cam.el).dir) > 0.0001;
    return dot3(normal, [eye[0] - centre[0], eye[1] - centre[1], eye[2] - centre[2]]) > 0.0001;
  }
  function pushBoxFaces(list, m) {
    const ca = Math.cos(m.r || 0), sa = Math.sin(m.r || 0), hw = m.s[0] / 2, hh = m.s[1] / 2, hd = m.s[2] / 2;
    const P = (sx, sy, sz) => { const lx = sx * hw, lz = sz * hd; return [m.p[0] + lx * ca + lz * sa, m.p[1] + sy * hh, m.p[2] - lx * sa + lz * ca]; };
    const R = (v) => [v[0] * ca + v[2] * sa, v[1], -v[0] * sa + v[2] * ca];
    const faces = [
      { n: [0, 1, 0], c: [P(-1, 1, -1), P(1, 1, -1), P(1, 1, 1), P(-1, 1, 1)] },
      { n: R([0, 0, 1]), c: [P(-1, -1, 1), P(1, -1, 1), P(1, 1, 1), P(-1, 1, 1)] },
      { n: R([0, 0, -1]), c: [P(1, -1, -1), P(-1, -1, -1), P(-1, 1, -1), P(1, 1, -1)] },
      { n: R([1, 0, 0]), c: [P(1, -1, 1), P(1, -1, -1), P(1, 1, -1), P(1, 1, 1)] },
      { n: R([-1, 0, 0]), c: [P(-1, -1, -1), P(-1, -1, 1), P(-1, 1, 1), P(-1, 1, -1)] },
    ];
    const depth = project(m.p)[2];
    const svg = [];
    faces.forEach((f) => {
      const ctr = [0, 1, 2].map((k) => f.c.reduce((n, q) => n + q[k], 0) / 4);
      if (!facing(ctr, f.n)) return;
      svg.push(faceSvg(f.c.map(project), sceneShade(m.c, f.n, light, plan.finish), m.o == null ? 1 : m.o));
    });
    list.push({ d: depth, svg: svg.join('') });
  }
  function pushSectorFaces(list, m) {
    const n = Math.max(2, Math.ceil((m.a1 - m.a0) / 0.12)), parts = [];
    const at = (a, r, y) => [m.off[0] + Math.cos(a) * r, y, m.off[1] + Math.sin(a) * r];
    const walls = [];
    for (let i = 0; i < n; i++) {
      const a = m.a0 + (m.a1 - m.a0) * i / n, b = m.a0 + (m.a1 - m.a0) * (i + 1) / n, mid = (a + b) / 2;
      const on = [Math.cos(mid), 0, Math.sin(mid)];
      const o = [at(a, m.r1, m.y0), at(b, m.r1, m.y0), at(b, m.r1, m.y1), at(a, m.r1, m.y1)];
      if (facing(at(mid, m.r1, (m.y0 + m.y1) / 2), on)) walls.push({ d: project(at(mid, m.r1, m.y0))[2], svg: faceSvg(o.map(project), sceneShade(m.c, on, light, plan.finish), 1) });
      if (m.r0 > 0.01) {
        const inn = [at(b, m.r0, m.y0), at(a, m.r0, m.y0), at(a, m.r0, m.y1), at(b, m.r0, m.y1)], nn = [-on[0], 0, -on[2]];
        if (facing(at(mid, m.r0, (m.y0 + m.y1) / 2), nn)) walls.push({ d: project(at(mid, m.r0, m.y0))[2], svg: faceSvg(inn.map(project), sceneShade(m.c, nn, light, plan.finish), 1) });
      }
    }
    // The two cut faces at the slice's ends.
    if (m.a1 - m.a0 < Math.PI * 2 - 0.01) for (const [a, sgn] of [[m.a0, -1], [m.a1, 1]]) {
      const nrm = [-Math.sin(a) * sgn, 0, Math.cos(a) * sgn];
      const q = [at(a, m.r0, m.y0), at(a, m.r1, m.y0), at(a, m.r1, m.y1), at(a, m.r0, m.y1)];
      if (facing(at(a, (m.r0 + m.r1) / 2, (m.y0 + m.y1) / 2), nrm)) walls.push({ d: project(at(a, (m.r0 + m.r1) / 2, m.y0))[2], svg: faceSvg(q.map(project), sceneShade(m.c, nrm, light, plan.finish), 1) });
    }
    walls.sort((x, y) => y.d - x.d).forEach((w) => parts.push(w.svg));
    const top = [];
    for (let i = 0; i <= n; i++) top.push(at(m.a0 + (m.a1 - m.a0) * i / n, m.r1, m.y1));
    if (m.r0 > 0.01) for (let i = n; i >= 0; i--) top.push(at(m.a0 + (m.a1 - m.a0) * i / n, m.r0, m.y1));
    else top.push(at(0, 0, m.y1));
    parts.push(faceSvg(top.map(project), sceneShade(m.c, [0, 1, 0], light, plan.finish), 1));
    const mid = (m.a0 + m.a1) / 2;
    list.push({ d: project(at(mid, (m.r0 + m.r1) / 2, m.y0))[2], svg: parts.join('') });
  }
  let gid = 0;
  for (const m of plan.marks) {
    if (m.t === 'box') pushBoxFaces(items, m);
    else if (m.t === 'sector') pushSectorFaces(items, m);
    else if (m.t === 'sphere') {
      const q = project(m.p), r = Math.max(1.2, m.r * q[3]);
      const id = plan.uid + 's' + (gid++);
      const lit = plan.finish === 'accurate' ? m.c : mixHex(m.c, '#ffffff', 0.35), deep = plan.finish === 'accurate' ? m.c : mixHex(m.c, '#000000', 0.32);
      let svg = '<radialGradient id="' + id + '" cx=".38" cy=".34" r=".72"><stop offset="0" stop-color="' + lit + '"/><stop offset=".55" stop-color="' + m.c + '"/><stop offset="1" stop-color="' + deep + '"/></radialGradient>';
      if (m.stem) { const b = project([m.p[0], 0, m.p[2]]); svg = '<line x1="' + f2(q[0]) + '" y1="' + f2(q[1]) + '" x2="' + f2(b[0]) + '" y2="' + f2(b[1]) + '" stroke="' + m.c + '" stroke-opacity=".35" stroke-width="1.2"/>' + svg; }
      svg += '<circle cx="' + f2(q[0]) + '" cy="' + f2(q[1]) + '" r="' + f2(r) + '" fill="url(#' + id + ')"' + (m.o != null && m.o < 1 ? ' fill-opacity="' + f2(m.o) + '"' : '') + '/>';
      items.push({ d: q[2], svg });
    } else if (m.t === 'path') {
      const qs = m.pts.map(project);
      const mid = qs[Math.floor(qs.length / 2)];
      const w = Math.max(1.4, m.r * 2 * (mid ? mid[3] : 1));
      items.push({ d: mid ? mid[2] : 0, svg: '<polyline points="' + ptsAttr(qs) + '" fill="none" stroke="' + m.c + '" stroke-width="' + f2(w) + '" stroke-linecap="round" stroke-linejoin="round"' + (m.o != null && m.o < 1 ? ' stroke-opacity="' + f2(m.o) + '"' : '') + '/>' });
    } else if (m.t === 'surface') {
      // A coarser mesh is enough for vector; quads in back-to-front order.
      const step = Math.max(1, Math.round((m.nx - 1) / 16)), stepz = Math.max(1, Math.round((m.nz - 1) / 12));
      const V = (i, j) => { const k = (j * m.nx + i) * 3; return [m.pts[k], m.pts[k + 1], m.pts[k + 2]]; };
      const quads = [];
      for (let j = 0; j < m.nz - 1; j += stepz) for (let i = 0; i < m.nx - 1; i += step) {
        const i2 = Math.min(m.nx - 1, i + step), j2 = Math.min(m.nz - 1, j + stepz);
        const a = V(i, j), b = V(i2, j), c = V(i2, j2), d = V(i, j2);
        const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
        let nrm = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
        const nl = Math.hypot(nrm[0], nrm[1], nrm[2]) || 1; nrm = nrm.map((x) => x / nl); if (nrm[1] < 0) nrm = nrm.map((x) => -x);
        const col = m.cols[j * m.nx + i];
        const ctr = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2];
        quads.push({ d: project(ctr)[2], svg: faceSvg([a, b, c, d].map(project), sceneShade(col, nrm, light, plan.finish), 1) });
      }
      quads.sort((x, y) => y.d - x.d);
      // Skirts: the edges facing the camera drop to the floor, so the surface
      // reads as a solid slab of terrain rather than a sheet in the air.
      const walls = [];
      if (m.skirt) {
        const edges = [
          { n: [0, 0, 1], idx: (k) => [k, m.nz - 1], len: m.nx, st: step },
          { n: [0, 0, -1], idx: (k) => [k, 0], len: m.nx, st: step },
          { n: [1, 0, 0], idx: (k) => [m.nx - 1, k], len: m.nz, st: stepz },
          { n: [-1, 0, 0], idx: (k) => [0, k], len: m.nz, st: stepz },
        ];
        for (const e of edges) {
          const mid = e.idx(Math.floor(e.len / 2)), mp = V(mid[0], mid[1]);
          if (!facing([mp[0], mp[1] / 2, mp[2]], e.n)) continue;
          for (let k = 0; k < e.len - 1; k += e.st) {
            const k2 = Math.min(e.len - 1, k + e.st), i1 = e.idx(k), i2 = e.idx(k2);
            const a = V(i1[0], i1[1]), b = V(i2[0], i2[1]);
            const col = m.cols[i1[1] * m.nx + i1[0]];
            walls.push(faceSvg([a, b, [b[0], 0, b[2]], [a[0], 0, a[2]]].map(project), sceneShade(mixHex(col, C.text, 0.12), e.n, light, plan.finish), 1));
          }
        }
      }
      const lines = (m.lines || []).map((ln) => '<polyline points="' + ptsAttr(ln.map(project)) + '" fill="none" stroke="' + C.text + '" stroke-opacity=".28" stroke-width="1"/>');
      items.push({ d: Infinity, svg: quads.map((q) => q.svg).join('') + walls.join('') + lines.join('') });
    }
  }
  items.sort((a, b) => b.d - a.d).forEach((it) => out.push(it.svg));
  out.push(sceneOverlaySvg(plan, plan.placed, plan.uid + 'v'));
  out.push('</g>');
  return out.join('');
}

// Title, subtitle, legend and labels as SVG text. Shared by the vector
// projection; the WebGL adapter draws the same layout into its overlay.
function sceneLabelsSvg(plan, placed) {
  const C = plan.stage.colours, out = ['<g data-c3d-labels>'];
  const halo = plan.transparent ? '' : ' stroke="' + C.backdrop + '" stroke-width="4" stroke-linejoin="round" paint-order="stroke"';
  for (const l of placed) {
    const fill = l.colour || C.text;
    const op = l.kind === 'category' || l.kind === 'series' || l.kind === 'tick' ? 0.78 : 1;
    out.push('<text class="c3d-' + l.kind + '" x="' + l.x + '" y="' + l.y + '" text-anchor="' + l.anchor + '" font-size="' + l.size + '" font-weight="' + l.weight + '" fill="' + fill + '"' + (op < 1 ? ' fill-opacity="' + op + '"' : '') + halo + '>' + xml(l.text) + '</text>');
    if (l.sub) out.push('<text class="c3d-' + l.kind + '" x="' + l.x + '" y="' + r4(l.y + l.size * 1.15) + '" text-anchor="' + l.anchor + '" font-size="' + Math.round(l.size * 0.86) + '" font-weight="500" fill="' + fill + '" fill-opacity=".7"' + halo + '>' + xml(l.sub) + '</text>');
  }
  out.push('</g>');
  return out.join('');
}
function sceneOverlaySvg(plan, placed, idp) {
  const C = plan.stage.colours, o = plan.overlay, out = [sceneLabelsSvg(plan, placed)];
  if (o.title) o.title.lines.forEach((line, i) => out.push('<text x="' + o.title.x + '" y="' + r4(o.title.y + i * o.title.size * 1.12) + '" font-size="' + o.title.size + '" font-weight="' + o.title.weight + '" fill="' + C.text + '" data-canvas-input="heading">' + xml(line) + '</text>'));
  if (o.subtitle) out.push('<text x="' + o.subtitle.x + '" y="' + r4(o.subtitle.y) + '" font-size="' + o.subtitle.size + '" fill="' + C.text + '" fill-opacity=".68" data-canvas-input="subheading">' + xml(o.subtitle.text) + '</text>');
  const lg = o.legend;
  if (lg) {
    if (lg.ramp) {
      const w = lg.rows[0][0].w, x = lg.x, y = lg.y - lg.fs * 0.55, stops = lg.ramp.stops;
      out.push('<defs><linearGradient id="' + idp + 'ramp" x1="0" x2="1">' + stops.map((s, i) => '<stop offset="' + r4(i / Math.max(1, stops.length - 1)) + '" stop-color="' + s + '"/>').join('') + '</linearGradient></defs>');
      const tw = String(lg.ramp.min).length * lg.fs * 0.56 + 8;
      out.push('<text x="' + x + '" y="' + r4(lg.y) + '" font-size="' + lg.fs + '" fill="' + C.text + '" fill-opacity=".78">' + xml(lg.ramp.min) + '</text>');
      out.push('<rect x="' + r4(x + tw) + '" y="' + r4(y) + '" width="' + r4(Math.max(40, w - tw * 2)) + '" height="' + r4(lg.fs * 0.6) + '" rx="' + r4(lg.fs * 0.3) + '" fill="url(#' + idp + 'ramp)"/>');
      out.push('<text x="' + r4(x + tw + Math.max(40, w - tw * 2) + 8) + '" y="' + r4(lg.y) + '" font-size="' + lg.fs + '" fill="' + C.text + '" fill-opacity=".78">' + xml(lg.ramp.max) + '</text>');
    } else lg.rows.forEach((row, ri) => {
      let x = lg.x; const y = lg.y + ri * lg.rowH;
      row.forEach((it) => {
        out.push('<rect x="' + r4(x) + '" y="' + r4(y - lg.sw * 0.85) + '" width="' + lg.sw + '" height="' + lg.sw + '" rx="' + Math.min(lg.sw / 2, lg.radius || 3) + '" fill="' + it.colour + '"/>');
        out.push('<text x="' + r4(x + lg.sw + 8) + '" y="' + r4(y) + '" font-size="' + lg.fs + '" fill="' + C.text + '">' + xml(it.label) + '</text>');
        x += it.w + lg.gap;
      });
    });
  }
  return out.join('');
}

// A dependency-free vector poster while Observable Plot loads (and a useful
// fallback if it cannot). It deliberately shows the underlying observations,
// not a screenshot, so SVG/PDF never become accidentally raster-only.
function plotFallbackSvg(data, cfg) {
  const W = cfg.width, H = cfg.height, theme = cfg.brandTheme;
  const ink = theme.colours.ink, muted = theme.colours.muted, edge = theme.colours.edge;
  const palette = theme.colours.categorical, left = 92, right = W - 52;
  const top = cfg.heading ? (cfg.subheading ? 126 : 96) : 58, bottom = H - 74;
  const out = ['<g class="chart-plot-vector-fallback">'];
  out.push('<rect x="' + left + '" y="' + top + '" width="' + Math.max(1, right - left) + '" height="' + Math.max(1, bottom - top) + '" fill="none" stroke="' + edge + '"/>');
  const cols = data.numericCols || [];
  if (cols.length >= 2) {
    const extent = (values) => { let lo = Infinity, hi = -Infinity; (values || []).forEach((v) => { if (v != null && Number.isFinite(+v)) { lo = Math.min(lo, +v); hi = Math.max(hi, +v); } }); return Number.isFinite(lo) ? [lo, hi === lo ? lo + 1 : hi] : [0, 1]; };
    const ex = extent(cols[0].values), ey = extent(cols[1].values), n = Math.min(1200, Math.max(cols[0].values.length, cols[1].values.length));
    for (let i = 0; i < n; i++) {
      const xv = cols[0].values[i], yv = cols[1].values[i]; if (xv == null || yv == null || !Number.isFinite(+xv) || !Number.isFinite(+yv)) continue;
      const x = left + ((+xv - ex[0]) / (ex[1] - ex[0])) * (right - left);
      const y = bottom - ((+yv - ey[0]) / (ey[1] - ey[0])) * (bottom - top);
      out.push('<circle cx="' + x.toFixed(2) + '" cy="' + y.toFixed(2) + '" r="4" fill="' + palette[i % palette.length] + '" fill-opacity=".6"/>');
    }
  } else {
    const cats = data.categories || [], s = data.series && data.series[0], values = (s && s.values) || [];
    let max = 1; values.forEach((v) => { if (v != null && Number.isFinite(+v)) max = Math.max(max, Math.abs(+v)); });
    for (let i = 0; i < Math.min(80, cats.length); i++) {
      const value = values[i]; if (value == null || !Number.isFinite(+value)) continue;
      const y = top + ((i + 0.5) / Math.max(1, cats.length)) * (bottom - top), x = left + (+value / max) * (right - left);
      out.push('<line x1="' + left + '" y1="' + y + '" x2="' + x + '" y2="' + y + '" stroke="' + edge + '" stroke-width="2"/><circle cx="' + x + '" cy="' + y + '" r="6" fill="' + palette[i % palette.length] + '"/>');
    }
  }
  if (cfg.heading) out.push('<text x="44" y="48" fill="' + ink + '" font-size="' + cfg.titleSize + '" font-weight="' + cfg.titleWeight + '">' + xml(cfg.heading) + '</text>');
  if (cfg.subheading) out.push('<text x="44" y="80" fill="' + muted + '" font-size="' + Math.max(14, cfg.labelSize) + '">' + xml(cfg.subheading) + '</text>');
  out.push('<text x="44" y="' + (H - 24) + '" fill="' + muted + '" font-size="14">Semantic vector fallback · ' + xml(cfg.chartType.replace(/-/g, ' ')) + '</text>');
  return out.join('') + '</g>';
}

// Split the pasted table into animation keyframes by a frame/time column. Each
// distinct frame value (first-seen order) yields one keyframe of series aligned to
// the UNION of category labels across all frames - so a bar/line morphs between
// them. Returns null when there's no frame column, <2 frames, or no numeric series.
// (Only built for the tweenable chart types; scatter/pie fall back to buildModel.)
function buildFrames(text, opts) {
  const raw = String(text || '').trim(); if (!raw) return null;
  const delim = opts.delimiter === 'auto' ? detectDelim(raw) : (DELIM_MAP[opts.delimiter] || ',');
  const semicolon = delim === ';';
  let grid = splitTable(raw, delim);
  if (opts.transpose) grid = transposeGrid(grid);
  if (grid.length < 2) return null;
  const width = Math.min(MAX_COLS, grid.reduce((m, r) => Math.max(m, r.length), 0));
  grid = grid.map((r) => { const c = r.slice(0, width); while (c.length < width) c.push(''); return c; });
  let header, body;
  if (opts.hasHeader) { header = grid[0].map((h, i) => String(h).trim() || `Column ${i + 1}`); body = grid.slice(1); }
  else { header = grid[0].map((_, i) => (i === 0 ? 'Category' : `Series ${i}`)); body = grid; }
  if (!body.length) return null;
  if (body.length > MAX_ROWS) body = body.slice(0, MAX_ROWS);
  const commaDecCol = [], numericFlag = [];
  for (let c = 0; c < width; c++) { commaDecCol[c] = semicolon || columnCommaDecimal(body.map((r) => r[c])); numericFlag[c] = columnIsNumeric(body, c, commaDecCol[c]); }
  const frameIdx = resolveColRef(opts.frameCol, header);
  if (frameIdx < 0) return null;
  const labelIdx = orDefault(resolveColRef(opts.labelCol, header), (frameIdx === 0 ? 1 : 0));
  const chosen = resolveColList(opts.seriesCols, header);
  const seriesCols = (chosen.length ? chosen : range(width)).filter((c) => c !== labelIdx && c !== frameIdx && numericFlag[c]);
  if (!seriesCols.length) return null;
  const cell = (r, i) => String(r[i] == null ? '' : r[i]).trim();
  const frameOrder = [], frameRows = {};
  body.forEach((r) => { const f = cell(r, frameIdx) || '-'; if (!(f in frameRows)) { frameRows[f] = []; frameOrder.push(f); } frameRows[f].push(r); });
  if (frameOrder.length < 2) return null;
  const catOrder = [], seen = {};
  body.forEach((r) => { const c = cell(r, labelIdx) || '?'; if (!(c in seen)) { seen[c] = 1; catOrder.push(c); } });
  const frames = frameOrder.map((f) => {
    const byCat = {}; frameRows[f].forEach((r) => { byCat[cell(r, labelIdx) || '?'] = r; });
    return seriesCols.map((c) => ({ name: header[c],
      values: catOrder.map((cat) => { const r = byCat[cat]; return r ? nOrNull(parseNum(r[c], commaDecCol[c])) : null; }) }));
  });
  return { labels: frameOrder, categories: catOrder, categoryField: header[labelIdx], frameField: header[frameIdx], frames };
}

const ANIMATABLE = ['bar', 'bar-horizontal', 'line', 'area', 'pie', 'donut', 'scatter'].concat(PLOT_TYPES);

function compute(model, inputPatch) {
  const inp = Object.assign(Object.fromEntries(model.map((i) => [i.id, i.value])), inputPatch || {});
  const dirty = Object.fromEntries(model.map((i) => [i.id, !!i.isDirty]));
  const mode = effectiveChartInputs(inp);
  // The semantic compiler and both renderers continue to consume the historic
  // `chartType` key. Feed them the active family's parked choice; the manifest
  // keeps the two choices separate solely so switching mode is non-destructive.
  const cfg = buildConfig(Object.assign({}, inp, { chartType: mode.effectiveType }),
    Object.assign({}, dirty, { chartType: mode.mode === 'scene' ? dirty.sceneType : dirty.chartType }));
  cfg.brandPalette  = BRAND && BRAND.spectrum;     // categorical spectrum (existing name)
  cfg.brandOrdered  = (BRAND && BRAND.ordered) || null;   // brand swatches in authored order → the 'ordered' palette (default)
  cfg.brandRamps    = BRAND && BRAND.ramps;        // sequential/diverging/mono ramps
  cfg.brandSwatches = (BRAND && BRAND.swatches) || null;  // click-to-recolour picker
  cfg.brandMono     = !!(BRAND && BRAND.monochrome);      // few hues → auto patterns
  // The family's leads, which the template puts ahead of its shipped hues when the
  // design system has no spectrum. Absent without a family, so a one-lead state
  // is byte-identical to one from before colourways.
  if (BRAND && BRAND.leads) cfg.brandLeads = BRAND.leads;
  // 'roles' palette: the design system's colour roles lead, in its own order, and the
  // ordered palette follows. Set only when chosen, so every other palette's state is
  // what it was, and a design system with no roles charts as the ordered palette.
  if (cfg.palette === 'roles' && BRAND && BRAND.roles) cfg.brandRoles = BRAND.roles;
  // 'seed' palette: extrapolate a whole palette from the chosen base colour. A
  // colour input's token default arrives already resolved to hex; blank/unresolved
  // falls back to the brand's primary so the option still does something on any brand.
  if (cfg.palette === 'seed') {
    cfg.seedPalette = seedPalette(isHex(inp.paletteSeed) ? inp.paletteSeed.trim() : ((BRAND && BRAND.primary) || null));
  }
  cfg.brandTheme = chartThemeFromBrand(cfg);
  const parseOpts = chartParseOptions(inp);
  const dataProfile = profileTable(inp.data, parseOpts);
  const recommendation = recommendChart(dataProfile, String(inp.chartIntent || 'manual'));
  // Keyframe animation: only for the tweenable chart types + a frame column set.
  const frameData = (cfg.frameColumn && ANIMATABLE.indexOf(cfg.chartType) >= 0)
    ? buildFrames(inp.data, Object.assign({ frameCol: cfg.frameColumn }, parseOpts)) : null;
  let data;
  if (frameData && frameData.frames.length >= 2) {
    // Fixed axis extent(s) over ALL frames so the gridlines/axes hold still while the
    // marks animate within them (else they rescale every frame → jerky).
    const cats = frameData.categories, frs = frameData.frames;
    const ext = (pick) => { let mn = Infinity, mx = -Infinity; frs.forEach((fr) => pick(fr, (v) => { const n = Number(v); if (Number.isFinite(n)) { if (n < mn) mn = n; if (n > mx) mx = n; } })); return [Number.isFinite(mn) ? mn : 0, Number.isFinite(mx) ? mx : 1]; };
    if (cfg.chartType === 'scatter' || ['hexbin', 'density-contour', 'regression'].indexOf(cfg.chartType) >= 0) {
      // scatter: series[0]=X, series[1]=Y - fix BOTH axes independently.
      cfg.animExtentX = ext((fr, add) => (fr[0] ? fr[0].values : []).forEach(add));
      cfg.animExtent  = ext((fr, add) => (fr[1] ? fr[1].values : []).forEach(add));
    } else {
      // bar/line/area: stacked per-category sum when stacking, else the max single value.
      const stacked = frs[0].length > 1 && cfg.stackMode !== 'grouped'
        && (cfg.chartType === 'area' || cfg.chartType === 'bar' || cfg.chartType === 'bar-horizontal');
      cfg.animExtent = ext((fr, add) => {
        for (let c = 0; c < cats.length; c++) {
          if (stacked) { let pos = 0, neg = 0; fr.forEach((s) => { const v = Number(s.values[c]); if (Number.isFinite(v)) { if (v >= 0) pos += v; else neg += v; } }); add(pos); add(neg); }
          else fr.forEach((s) => add(s.values[c]));
        }
      });
    }
    // scatter reads numericCols (x/y cols); bar/line/pie read series - populate the one each needs from frame 0.
    data = { categories: frameData.categories, categoryField: frameData.categoryField, frameField: frameData.frameField, series: frameData.frames[0],
      numericCols: cfg.chartType === 'scatter' || PLOT_TYPES.indexOf(cfg.chartType) >= 0 ? frameData.frames[0] : [], errorValues: null,
      frames: frameData.frames, frameLabels: frameData.labels,
      note: `Animating ${frameData.frames.length} frames by “${cfg.frameColumn}”.` };
  } else {
    data = buildModel(inp.data, parseOpts);
  }
  data.profile = dataProfile;
  data.profileSummary = dataProfileSummary(dataProfile);
  data.recommendation = String(inp.chartIntent || 'manual') === 'manual' ? null : recommendation;
  if (['pareto', 'bullet', 'range-bar'].indexOf(cfg.chartType) >= 0) {
    data.comparison = comparisonData(data, cfg);
    if (data.comparison.error) data.note = appendNote(data.note, data.comparison.error);
    if (data.comparison.missing) data.note = appendNote(data.note, data.comparison.missing + ' incomplete row(s) omitted.');
    const expected = cfg.chartType === 'pareto' ? 1 : cfg.chartType === 'bullet' ? 3 : 2;
    if (data.series.length > expected) data.note = appendNote(data.note, 'This chart uses the first ' + expected + ' numeric column(s). Change Series columns to choose different measures.');
  }
  if (cfg.chartType === 'scatter3d' && (!data.numericCols || data.numericCols.length < 3)) {
    data.note = appendNote(data.note, '3-D scatter needs at least three numeric columns for x, y and z.');
  }
  if (cfg.chartType === 'donut3d' && data.series && data.series.length > 1) {
    data.note = appendNote(data.note, 'A 3-D donut draws the first numeric series; choose another with Value columns.');
  }
  if (cfg.chartType === 'surface3d' && (!data.series || data.series.length < 2 || !data.categories || data.categories.length < 2)) {
    data.note = appendNote(data.note, 'A surface needs at least two categories and two numeric series.');
  }
  if (CINEMATIC_TYPES.indexOf(cfg.chartType) >= 0) {
    if (!data.series || !data.series.length || !data.categories || data.categories.length < 2) {
      data.note = appendNote(data.note, 'A cinematic flight needs at least two ordered categories and one numeric series.');
    }
    if (cfg.flightSeries && data.series && data.series.length) {
      const ref = cfg.flightSeries.trim().toLowerCase();
      const index = /^\d+$/.test(ref) ? Number(ref) - 1 : data.series.findIndex((series) => String(series.name).trim().toLowerCase() === ref);
      if (index < 0 || index >= data.series.length) data.note = appendNote(data.note, `Camera series “${cfg.flightSeries}” was not found; following “${data.series[0].name}”.`);
    }
  }
  if (['hexbin', 'density-contour', 'regression'].indexOf(cfg.chartType) >= 0 && (!data.numericCols || data.numericCols.length < 2)) {
    data.note = appendNote(data.note, 'This statistical view needs at least two numeric columns for x and y.');
  }
  if (cfg.chartType === 'interval' && (!data.series || data.series.length < 2)) {
    data.note = appendNote(data.note, 'An interval view needs two numeric series for its endpoints.');
  }
  if (['range-band', 'difference-area'].indexOf(cfg.chartType) >= 0 && (!data.series || data.series.length < 2)) {
    data.note = appendNote(data.note, 'This comparison needs at least two numeric series. Range band can use a third series as its expected line.');
  }
  if (cfg.chartType === 'candlestick' && (!data.series || data.series.length < 4)) {
    data.note = appendNote(data.note, 'Candlesticks need four numeric series ordered Open, High, Low, Close.');
  }
  if (cfg.frameColumn && (!data.frames || data.frames.length < 2)) {
    data.note = appendNote(data.note, 'Animate by column did not resolve at least two usable frames; check the column name and table shape.');
  }
  const useThree = REAL_3D_TYPES.indexOf(cfg.chartType) >= 0;
  // A real 3-D chart is planned once here; the GPU adapter and the vector
  // projection both draw this plan, and the chart document records its camera.
  let scenePlan = null;
  if (useThree) {
    cfg.backgroundChosen = !!dirty.background;
    cfg.fontFamily = bfFamilyList(BRAND && BRAND.font && BRAND.font.brand, 'SUSE', 'sans-serif');
    scenePlan = planScene(data, cfg);
    cfg._sceneCamera = { projection: scenePlan.camera.ortho ? 'orthographic' : 'perspective', azimuth: scenePlan.camera.az, elevation: scenePlan.camera.el };
    cfg._scenePoster = scenePlan.poster;
  }
  const spec = makeChartSpec(data, cfg);
  const usePlot = PLOT_TYPES.indexOf(cfg.chartType) >= 0;
  const findings = [];
  if (data.recommendation) findings.push({
    id: 'chart.recommendation', severity: 'info',
    message: `Recommended ${recommendation.label}: ${recommendation.reason}`,
  });
  if (data.note) findings.push({ id: 'chart.data.note', severity: 'info', message: data.note });
  const report = {
    version: 1,
    rendererFamily: spec.presentation.rendererFamily,
    rendererId: useThree ? (CINEMATIC_TYPES.indexOf(cfg.chartType) >= 0 ? 'three-data-flight' : 'three-webgl') : usePlot ? 'observable-plot-svg' : 'd3-svg-compat',
    style: spec.presentation.style,
    dimension: spec.presentation.dimension,
    exportFidelity: spec.presentation.exportFidelity,
    datasets: spec.datasets.length,
    rows: spec.datasets.reduce((n, d) => n + d.rows.length, 0),
    series: spec.series.length,
    theme: {
      id: spec.theme.id, source: spec.theme.source, sourceId: spec.theme.sourceId,
      sourceLabel: spec.theme.sourceLabel, sourceChecksum: spec.theme.sourceChecksum, locked: spec.theme.locked,
    },
    dataProfile,
    recommendation,
    findings,
  };
  return {
    _state:  safeJson({ data, cfg, spec, report, scene: scenePlan }),
    _bgFill: scenePlan ? (scenePlan.transparent ? 'none' : scenePlan.stage.colours.backdrop) : cfg.transparent ? 'none' : cfg.background,
    _useThree: useThree,
    _usePlot: usePlot,
    _threeFallback: scenePlan ? sceneVectorSvg(scenePlan, cfg) : '',
    _threeOverlay: scenePlan ? sceneOverlaySvg(scenePlan, scenePlan.placed, scenePlan.uid + 'o') : '',
    _plotFallback: usePlot ? plotFallbackSvg(data, cfg) : '',
    _chartTitle: spec.accessibility.title,
    _chartDescription: spec.accessibility.description,
    _a11yTable: chartA11yHtml(spec),
    _rendererFamily: spec.presentation.rendererFamily,
    _renderMode: mode.mode,
    _effectiveChartType: mode.effectiveType,
    _chartStyle: spec.presentation.style,
    _brandName: spec.theme.sourceLabel || spec.theme.sourceId || 'Active brand',
    _dataProfileSummary: dataProfileSummary(dataProfile),
    _recommendationLabel: data.recommendation ? recommendation.label : '',
    _recommendationReason: data.recommendation ? recommendation.reason : '',
    _recommendationConfidence: data.recommendation ? recommendation.confidence : '',
    mdSource: d3Md(inp),
    // What an empty Colour 1..6 means, for the web shell's chips: that slot of the
    // design system's palette. No value: the template picks the colour per chart
    // type and palette, so the chip shows the neutral automatic pattern.
    autoColors: BRAND ? PALETTE_SLOT_AUTO : {},
  };
}

const PALETTE_SLOT_AUTO = Object.freeze(Object.fromEntries(
  ['palette1', 'palette2', 'palette3', 'palette4', 'palette5', 'palette6'].map((id) => [id, { source: 'design-system' }])
));

// The `md` export: heading/subheading + the pasted data re-emitted as a GFM table
// (reusing the same delimiter detection + grid parser the chart uses).
function d3Md(inp) {
  const raw = String(inp.data || '').trim();
  const out = [];
  if (String(inp.heading || '').trim()) out.push('# ' + String(inp.heading).trim());
  if (String(inp.subheading || '').trim()) out.push('_' + String(inp.subheading).trim() + '_');
  if (raw) {
    const delim = String(inp.delimiter || 'auto') === 'auto' ? detectDelim(raw) : (DELIM_MAP[inp.delimiter] || ',');
    let grid = splitTable(raw, delim);
    if (inp.transpose === true || inp.transpose === 'true') grid = transposeGrid(grid);
    const cols = grid.reduce((m, r) => Math.max(m, r.length), 0);
    if (grid.length && cols) {
      const cell = (s) => String(s == null ? '' : s).replace(/\|/g, '\\|').replace(/\n/g, ' ').trim();
      const lines = [];
      grid.forEach((r, ri) => {
        const cs = []; for (let c = 0; c < cols; c++) cs.push(cell(r[c]));
        lines.push('| ' + cs.join(' | ') + ' |');
        if (ri === 0) lines.push('| ' + Array(cols).fill('---').join(' | ') + ' |');
      });
      out.push(lines.join('\n'));
    }
  }
  return out.join('\n\n') + '\n';
}

// A brand result is "degraded" when tokens weren't ready at resolve time (no
// primary / spectrum / ramps) - e.g. a cold first paint before the brand pack
// loads. Re-attempt on the next input so the chart picks the brand up rather than
// being stuck on the shipped fallback palette for the session.
function brandDegraded(b) { return !b || (!b.primary && !b.spectrum && !b.ramps); }

async function onInit({ model }) {
  BRAND_KEY = await brandKey();
  BRAND = await resolveBrandColors();
  const modePatch = legacyModePatch(model);
  const guidedPatch = recommendationInputPatch(model, modePatch, null);
  const priorPatch = Object.assign({}, modePatch, guidedPatch);
  const inputPatch = Object.assign(priorPatch, scenePatch(model, priorPatch));
  return Object.assign(compute(model, inputPatch), inputPatch);
}
async function onInput({ model, id }) {
  // A theme or colourway switch (id '__tokens') changes every colour BRAND was read
  // from, so it is read again in the new choice, as a fresh mount in that choice
  // would read it. onInit is not run again, because it would reset the inputs.
  // Any other edit re-reads the brand when it was not ready at mount, or when the
  // colours it was read under have moved since.
  if (id === '__tokens') {
    try { BRAND = await resolveBrandColors(); BRAND_KEY = await brandKey(); } catch (e) { /* keep prior */ }
  } else {
    const key = await brandKey();
    if (brandDegraded(BRAND) || key !== BRAND_KEY) {
      try { const b = await resolveBrandColors(); if (!brandDegraded(b)) { BRAND = b; BRAND_KEY = key; } } catch (e) { /* keep prior */ }
    }
  }
  const modePatch = legacyModePatch(model);
  const guidedPatch = recommendationInputPatch(model, modePatch, id);
  const priorPatch = Object.assign({}, modePatch, guidedPatch);
  const inputPatch = Object.assign(priorPatch, scenePatch(model, priorPatch));
  return Object.assign(compute(model, inputPatch), inputPatch);
}

function exportNode(ctx) {
  const node = ctx && ctx.node;
  return node && typeof node.querySelector === 'function' ? node : null;
}

// Animated SVG swaps in a self-contained SMIL flipbook. Real 3-D deliberately
// swaps the presentation canvas for its projected SVG sibling on vector/PDF
// export: one chart document, a format-appropriate renderer, never a blank GPU
// rectangle or an accidental base64 screenshot in an otherwise-vector file.
function beforeExport(ctx) {
  try {
    const node = exportNode(ctx); if (!node) return;
    const vector = ctx.format === 'svg' || ctx.format === 'svgz' || ctx.format === 'pdf';
    const svg = node.matches && node.matches('#d3-svg') ? node : node.querySelector('#d3-svg');
    if (vector && svg && typeof svg.__lollyBuildSmil === 'function') svg.__lollyBuildSmil();

    const wrap = node.matches && node.matches('[data-chart3d-wrap]') ? node : node.querySelector('[data-chart3d-wrap]');
    if (vector && wrap) {
      const fallback = wrap.querySelector('[data-chart3d-fallback]');
      const canvas = wrap.querySelector('[data-chart3d-canvas]');
      const overlay = wrap.querySelector('[data-chart3d-overlay]');
      wrap.__lollyVectorExport = {
        fallback: fallback && fallback.style.display,
        canvas: canvas && canvas.style.opacity,
        overlay: overlay && overlay.style.opacity,
      };
      if (fallback) fallback.style.display = 'block';
      if (canvas) canvas.style.opacity = '0';
      if (overlay) overlay.style.opacity = '0';
      wrap.setAttribute('data-export-renderer', 'svg-projection');
    }

    const plotWrap = node.matches && node.matches('[data-chart-plot-wrap]') ? node
      : (node.closest && node.closest('[data-chart-plot-wrap]')) || node.querySelector('[data-chart-plot-wrap]');
    if (vector && plotWrap && typeof plotWrap.__lollyPlotPoster === 'function') {
      plotWrap.__lollyPlotPoster();
      plotWrap.setAttribute('data-export-renderer', 'observable-plot-poster');
    }
  } catch (e) { /* fall through to the normal static SVG */ }
}
function afterExport(ctx) {
  try {
    const node = exportNode(ctx); if (!node) return;
    const svg = node.matches && node.matches('#d3-svg') ? node : node.querySelector('#d3-svg');
    if (svg && typeof svg.__lollyRestoreLive === 'function') svg.__lollyRestoreLive();

    const wrap = node.matches && node.matches('[data-chart3d-wrap]') ? node : node.querySelector('[data-chart3d-wrap]');
    const prior = wrap && wrap.__lollyVectorExport;
    if (wrap && prior) {
      const fallback = wrap.querySelector('[data-chart3d-fallback]');
      const canvas = wrap.querySelector('[data-chart3d-canvas]');
      const overlay = wrap.querySelector('[data-chart3d-overlay]');
      if (fallback) fallback.style.display = prior.fallback || 'none';
      if (canvas) canvas.style.opacity = prior.canvas || '1';
      if (overlay) overlay.style.opacity = prior.overlay || '1';
      wrap.removeAttribute('data-export-renderer');
      delete wrap.__lollyVectorExport;
    }
    const plotWrap = node.matches && node.matches('[data-chart-plot-wrap]') ? node
      : (node.closest && node.closest('[data-chart-plot-wrap]')) || node.querySelector('[data-chart-plot-wrap]');
    if (plotWrap && typeof plotWrap.__lollyPlotRestore === 'function') plotWrap.__lollyPlotRestore();
    if (plotWrap) plotWrap.removeAttribute('data-export-renderer');
  } catch (e) { /* no-op */ }
}
