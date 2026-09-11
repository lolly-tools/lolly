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
let BRAND = null;

function normHex(x) {
  return typeof x === 'string' && /^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(x.trim()) ? x.trim().toLowerCase() : null;
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
      if (chroma(second) < 0.04 || (c.deltaE && c.deltaE(second, vib) < 0.12)) {
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

const SCENE_TYPES = ['bar3d', 'scatter3d', 'surface3d'];
const CINEMATIC_TYPES = ['flythrough3d', 'ribbon3d', 'constellation3d', 'skyline3d'];
const REAL_3D_TYPES = SCENE_TYPES.concat(CINEMATIC_TYPES);
const PLOT_TYPES = [
  'dot-strip', 'interval', 'range-band', 'difference-area', 'indexed-change',
  'box-observations', 'rug-histogram', 'distribution-facets', 'density-ridges', 'ecdf',
  'small-multiples', 'control-band', 'hexbin', 'density-contour', 'regression',
  'candlestick',
];
const SCENE_TO_VECTOR = {
  bar3d: 'bar', scatter3d: 'scatter', surface3d: 'heatmap',
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

function chartThemeFromBrand(cfg) {
  const fallback = ['#008657','#2453ff','#fe7c3f','#5d4f99','#00bda7','#bd3314','#3c8eef','#192072'];
  const seeded = cfg.seedPalette && cfg.seedPalette.categorical;
  const authored = (BRAND && BRAND.ordered) || (BRAND && BRAND.spectrum) || null;
  const categorical = (seeded || authored || fallback).slice(0, 16);
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
      material: cfg.sceneMaterial,
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
    scatter3d: 'scatter3d', surface3d: 'surface3d',
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
    ? { enabled: cfg.motionPreset !== 'none', preset: cfg.motionPreset, duration: cfg.animSpeed, loop: 'loop', easing: cfg.animEase, poster: 0.22 }
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
      ...(is3d ? { camera: { projection: isCinematic ? 'perspective' : cfg.cameraProjection, azimuth: cfg.cameraAzimuth, elevation: cfg.cameraElevation } } : {}),
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
        : motion.preset === 'orbit' ? 'The camera orbits the chart.' : 'The chart reveals and changes over time.' } : {}),
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

function shade(hex, factor) {
  const h = normHex(hex) || '#777777';
  const c = h.slice(1, 7).match(/../g).map((x) => parseInt(x, 16));
  return '#' + c.map((v) => clamp(Math.round(factor < 1 ? v * factor : v + (255 - v) * (factor - 1)), 0, 255).toString(16).padStart(2, '0')).join('');
}

// A deterministic, real-vector projected fallback for CLI, blocked WebGL and
// context loss. Browser GPU output replaces it only after the first frame is
// ready, so an advanced chart never degrades to a blank rectangle.
function threeFallbackSvg(data, cfg) {
  const W = cfg.width, H = cfg.height, cats = data.categories || [], ss = data.series || [];
  const palette = cfg.brandTheme.colours.categorical;
  const ink = cfg.brandTheme.colours.ink, edge = cfg.brandTheme.colours.edge;
  const top = cfg.heading ? 116 : 70, baseY = H - 105, originX = W * 0.5;
  const vals = [];
  ss.forEach((s) => (s.values || []).forEach((v) => { if (Number.isFinite(+v)) vals.push(+v); }));
  const max = vals.reduce((m, v) => Math.max(m, Math.abs(v)), 1);
  const nx = Math.max(1, cats.length), nz = Math.max(1, ss.length);
  const sx = Math.min(74, (W * 0.62) / Math.max(2, nx + nz));
  const sz = sx * 0.54, sy = (H - top - 150) / max;
  const project = (x, y, z) => [originX + (x - (nx - 1) / 2) * sx - (z - (nz - 1) / 2) * sx * 0.72, baseY - y * sy + (x + z - (nx + nz - 2) / 2) * sz * 0.5];
  const out = ['<g class="chart3d-vector-fallback">'];
  const axisA = project(-0.7, 0, -0.7), axisB = project(nx - 0.3, 0, -0.7), axisC = project(-0.7, 0, nz - 0.3);
  out.push('<path d="M' + axisA[0] + ' ' + axisA[1] + 'L' + axisB[0] + ' ' + axisB[1] + 'M' + axisA[0] + ' ' + axisA[1] + 'L' + axisC[0] + ' ' + axisC[1] + '" fill="none" stroke="' + edge + '" stroke-width="2"/>');

  if (CINEMATIC_TYPES.indexOf(cfg.chartType) >= 0) {
    for (let z = 0; z < nz; z++) {
      const points = [];
      for (let x = 0; x < nx; x++) {
        const value = +(ss[z] && ss[z].values[x]); if (!Number.isFinite(value)) continue;
        const p = project(x, value, z); points.push(p[0].toFixed(2) + ',' + p[1].toFixed(2));
      }
      if (points.length > 1) out.push('<polyline points="' + points.join(' ') + '" fill="none" stroke="' + palette[z % palette.length] + '" stroke-width="' + (cfg.chartType === 'ribbon3d' ? 14 : 5) + '" stroke-linecap="round" stroke-linejoin="round" opacity="' + (z === 0 ? '.94' : '.64') + '"/>');
      for (let x = 0; x < nx; x++) {
        const value = +(ss[z] && ss[z].values[x]); if (!Number.isFinite(value)) continue;
        const p = project(x, value, z);
        if (cfg.chartType === 'skyline3d') {
          const foot = project(x, 0, z);
          out.push('<line x1="' + foot[0].toFixed(2) + '" y1="' + foot[1].toFixed(2) + '" x2="' + p[0].toFixed(2) + '" y2="' + p[1].toFixed(2) + '" stroke="' + palette[z % palette.length] + '" stroke-width="12" stroke-linecap="square" opacity="' + (z === 0 ? '.82' : '.52') + '"/>');
        }
        out.push('<circle cx="' + p[0].toFixed(2) + '" cy="' + p[1].toFixed(2) + '" r="' + (cfg.chartType === 'constellation3d' ? 8 : 4) + '" fill="' + palette[z % palette.length] + '" stroke="' + cfg.brandTheme.colours.surface + '" stroke-width="2"/>');
      }
    }
  } else if (cfg.chartType === 'scatter3d') {
    const cols = data.numericCols || [], n = Math.min(1500, (cols[0] && cols[0].values.length) || 0);
    const ext = (a) => { const f = (a || []).filter((v) => Number.isFinite(+v)).map(Number); return [Math.min(...f, 0), Math.max(...f, 1)]; };
    const ex = ext(cols[0] && cols[0].values), ey = ext(cols[1] && cols[1].values), ez = ext(cols[2] && cols[2].values);
    const norm = (v, e) => e[1] === e[0] ? 0.5 : (+v - e[0]) / (e[1] - e[0]);
    const dots = [];
    for (let i = 0; i < n; i++) {
      const xv = cols[0] && cols[0].values[i], yv = cols[1] && cols[1].values[i], zv = cols[2] && cols[2].values[i];
      if (![xv,yv,zv].every((v) => Number.isFinite(+v))) continue;
      const p = project(norm(xv, ex) * Math.max(1, nx - 1), norm(yv, ey) * max, norm(zv, ez) * Math.max(1, nz - 1));
      dots.push({ z: norm(zv, ez), svg: '<circle cx="' + p[0].toFixed(2) + '" cy="' + p[1].toFixed(2) + '" r="' + (5 + 5 * norm(zv, ez)).toFixed(2) + '" fill="' + palette[i % palette.length] + '" fill-opacity=".82" stroke="' + cfg.brandTheme.colours.surface + '" stroke-width="1"/>' });
    }
    dots.sort((a,b) => a.z - b.z).forEach((d) => out.push(d.svg));
  } else if (cfg.chartType === 'surface3d') {
    const cells = [];
    for (let z = 0; z < Math.max(0, nz - 1); z++) for (let x = 0; x < Math.max(0, nx - 1); x++) {
      const y00 = +ss[z].values[x], y10 = +ss[z].values[x + 1], y11 = +ss[z + 1].values[x + 1], y01 = +ss[z + 1].values[x];
      if (![y00,y10,y11,y01].every(Number.isFinite)) continue;
      const ps = [project(x,y00,z), project(x+1,y10,z), project(x+1,y11,z+1), project(x,y01,z+1)];
      const avg = (y00+y10+y11+y01)/4, ci = clamp(Math.floor((avg / max) * (palette.length - 1)), 0, palette.length - 1);
      cells.push({ depth: x + z, svg: '<polygon points="' + ps.map((p) => p[0].toFixed(2)+','+p[1].toFixed(2)).join(' ') + '" fill="' + palette[ci] + '" fill-opacity=".88" stroke="' + edge + '" stroke-opacity=".45"/>' });
    }
    cells.sort((a,b) => a.depth - b.depth).forEach((c) => out.push(c.svg));
  } else {
    const bars = [];
    for (let z = 0; z < nz; z++) for (let x = 0; x < nx; x++) {
      const value = +(ss[z] && ss[z].values[x]); if (!Number.isFinite(value)) continue;
      const y0 = Math.min(0, value), y1 = Math.max(0, value), col = palette[z % palette.length];
      const a = project(x-.28,y0,z-.28), b = project(x+.28,y0,z-.28), c = project(x+.28,y1,z-.28), d = project(x-.28,y1,z-.28);
      const e = project(x+.28,y0,z+.28), f = project(x+.28,y1,z+.28), g = project(x-.28,y1,z+.28);
      bars.push({ depth: x + z, svg:
        '<polygon points="'+b[0]+','+b[1]+' '+e[0]+','+e[1]+' '+f[0]+','+f[1]+' '+c[0]+','+c[1]+'" fill="'+shade(col,.7)+'"/>'+
        '<polygon points="'+d[0]+','+d[1]+' '+c[0]+','+c[1]+' '+f[0]+','+f[1]+' '+g[0]+','+g[1]+'" fill="'+shade(col,1.18)+'"/>'+
        '<polygon points="'+a[0]+','+a[1]+' '+b[0]+','+b[1]+' '+c[0]+','+c[1]+' '+d[0]+','+d[1]+'" fill="'+col+'"/>' });
    }
    bars.sort((a,b) => a.depth - b.depth).forEach((b) => out.push(b.svg));
  }
  if (cfg.heading) out.push('<text x="54" y="58" fill="' + ink + '" font-size="' + cfg.titleSize + '" font-weight="' + cfg.titleWeight + '">' + xml(cfg.heading) + '</text>');
  if (cfg.subheading) out.push('<text x="54" y="91" fill="' + ink + '" fill-opacity=".65" font-size="20">' + xml(cfg.subheading) + '</text>');
  out.push('<text x="54" y="' + (H - 24) + '" fill="' + ink + '" fill-opacity=".52" font-size="15">' + (CINEMATIC_TYPES.indexOf(cfg.chartType) >= 0 ? 'Cinematic vector poster' : 'Vector 3-D view') + '</text>');
  return out.join('') + '</g>';
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
  const spec = makeChartSpec(data, cfg);
  const useThree = REAL_3D_TYPES.indexOf(cfg.chartType) >= 0;
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
    _state:  safeJson({ data, cfg, spec, report }),
    _bgFill: cfg.transparent ? 'none' : cfg.background,
    _useThree: useThree,
    _usePlot: usePlot,
    _threeFallback: useThree ? threeFallbackSvg(data, cfg) : '',
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
  };
}

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
  BRAND = await resolveBrandColors();
  const modePatch = legacyModePatch(model);
  const guidedPatch = recommendationInputPatch(model, modePatch, null);
  const inputPatch = Object.assign({}, modePatch, guidedPatch);
  return Object.assign(compute(model, inputPatch), inputPatch);
}
async function onInput({ model, id }) {
  if (brandDegraded(BRAND)) { try { const b = await resolveBrandColors(); if (!brandDegraded(b)) BRAND = b; } catch (e) { /* keep prior */ } }
  const modePatch = legacyModePatch(model);
  const guidedPatch = recommendationInputPatch(model, modePatch, id);
  const inputPatch = Object.assign({}, modePatch, guidedPatch);
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
