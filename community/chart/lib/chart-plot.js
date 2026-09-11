/* SPDX-License-Identifier: MPL-2.0 */
/* Observable Plot adapter for Chart's curated statistical/editorial forms.
 * The public document stays ChartSpecV1; this reviewed adapter is the only
 * place that knows Plot's API. No user or brand value becomes executable code. */
(function (global) {
  'use strict';

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var INSTANCE = 0;
  function finite(v) { return v != null && v !== '' && Number.isFinite(+v); }
  function num(v, d) { v = +v; return Number.isFinite(v) ? v : d; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function cleanRows(rows) { return rows.filter(function (r) { return r && typeof r === 'object'; }); }
  function valueFormat(cfg) {
    var kind = String(cfg.numberFormat || 'auto');
    return function (v) {
      if (!finite(v)) return '';
      if (kind === 'percent') return (+v).toLocaleString('en', { maximumFractionDigits: 1 }) + '%';
      if (kind === 'currency') return '€' + (+v).toLocaleString('en', { maximumFractionDigits: 2 });
      if (kind === 'integer') return Math.round(+v).toLocaleString('en');
      if (kind === 'decimal1') return (+v).toLocaleString('en', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
      if (kind === 'decimal2') return (+v).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return (+v).toLocaleString('en', { maximumFractionDigits: 3 });
    };
  }

  function longRows(data) {
    var out = [], cats = data.categories || [], series = data.series || [];
    for (var si = 0; si < series.length; si++) for (var i = 0; i < cats.length; i++) {
      var value = series[si] && series[si].values && series[si].values[i];
      if (finite(value)) out.push({ category: String(cats[i]), series: String(series[si].name || ('Series ' + (si + 1))), value: +value });
    }
    return out;
  }

  function pointRows(data) {
    var cols = data.numericCols || [], count = 0, out = [];
    for (var ci = 0; ci < cols.length; ci++) count = Math.max(count, (cols[ci].values || []).length);
    for (var i = 0; i < count; i++) {
      var x = cols[0] && cols[0].values[i], y = cols[1] && cols[1].values[i];
      if (!finite(x) || !finite(y)) continue;
      out.push({ x: +x, y: +y, size: finite(cols[2] && cols[2].values[i]) ? +cols[2].values[i] : 1 });
    }
    return out;
  }

  function intervalRows(data) {
    var cats = data.categories || [], ss = data.series || [], out = [];
    for (var i = 0; i < cats.length; i++) {
      var a = ss[0] && ss[0].values[i], b = ss[1] && ss[1].values[i];
      if (!finite(a) || !finite(b)) continue;
      out.push({ category: String(cats[i]), low: Math.min(+a, +b), high: Math.max(+a, +b), first: +a, second: +b });
    }
    return out;
  }

  function candleRows(data) {
    var cats = data.categories || [], ss = data.series || [], out = [];
    for (var i = 0; i < cats.length; i++) {
      var open = ss[0] && ss[0].values[i], high = ss[1] && ss[1].values[i];
      var low = ss[2] && ss[2].values[i], close = ss[3] && ss[3].values[i];
      if (![open, high, low, close].every(finite)) continue;
      out.push({ category: String(cats[i]), open: +open, high: +high, low: +low, close: +close, direction: +close >= +open ? 'Up' : 'Down' });
    }
    return out;
  }

  function bandRows(data) {
    var cats = data.categories || [], ss = data.series || [], out = [];
    for (var i = 0; i < cats.length; i++) {
      var a = ss[0] && ss[0].values[i], b = ss[1] && ss[1].values[i], c = ss[2] && ss[2].values[i];
      if (!finite(a) || !finite(ss.length >= 3 ? c : b)) continue;
      var low = Math.min(+a, +(ss.length >= 3 ? c : b));
      var high = Math.max(+a, +(ss.length >= 3 ? c : b));
      out.push({ category: String(cats[i]), low: low, high: high,
        expected: finite(b) ? +b : (low + high) / 2 });
    }
    return out;
  }

  function differenceRows(data) {
    var cats = data.categories || [], ss = data.series || [], out = [];
    for (var i = 0; i < cats.length; i++) {
      var first = ss[0] && ss[0].values[i], second = ss[1] && ss[1].values[i];
      if (!finite(first) || !finite(second)) continue;
      out.push({ category: String(cats[i]), first: +first, second: +second, difference: +second - +first });
    }
    return out;
  }

  function indexedRows(data) {
    var out = [], cats = data.categories || [], ss = data.series || [];
    for (var si = 0; si < ss.length; si++) {
      var values = ss[si].values || [], base = null;
      for (var bi = 0; bi < values.length; bi++) if (finite(values[bi]) && +values[bi] !== 0) { base = +values[bi]; break; }
      if (base == null) continue;
      for (var i = 0; i < cats.length; i++) if (finite(values[i])) out.push({
        category: String(cats[i]), series: String(ss[si].name || ('Series ' + (si + 1))), index: +values[i] / base * 100,
      });
    }
    return out;
  }

  function controlRows(data) {
    var cats = data.categories || [], s = data.series && data.series[0], values = s && s.values || [];
    var finiteValues = values.filter(finite).map(Number);
    if (finiteValues.length < 2) return [];
    var mean = finiteValues.reduce(function (sum, value) { return sum + value; }, 0) / finiteValues.length;
    var deviation = Math.sqrt(finiteValues.reduce(function (sum, value) { return sum + Math.pow(value - mean, 2); }, 0) / (finiteValues.length - 1));
    return cats.map(function (category, i) { return finite(values[i]) ? {
      category: String(category), value: +values[i], mean: mean,
      lower: mean - deviation * 2, upper: mean + deviation * 2,
    } : null; }).filter(Boolean);
  }

  function ecdfRows(data) {
    var out = [], ss = data.series || [];
    for (var si = 0; si < ss.length; si++) {
      var values = (ss[si].values || []).filter(finite).map(Number).sort(function (a, b) { return a - b; });
      for (var i = 0; i < values.length; i++) out.push({ series: String(ss[si].name || ('Series ' + (si + 1))), value: values[i], probability: (i + 1) / values.length });
    }
    return out;
  }

  function densityRows(data, cfg) {
    var out = [], ss = data.series || [];
    for (var si = 0; si < ss.length; si++) {
      var values = (ss[si].values || []).filter(finite).map(Number).sort(function (a, b) { return a - b; });
      if (values.length < 2) continue;
      var lo = values[0], hi = values[values.length - 1], span = Math.max(1e-9, hi - lo);
      var bandwidth = Math.max(span / 80, span * num(cfg.plotBandwidth, 20) / Math.max(160, num(cfg.width, 1280)));
      for (var i = 0; i < 64; i++) {
        var value = lo - span * 0.08 + span * 1.16 * i / 63, sum = 0;
        for (var vi = 0; vi < values.length; vi++) { var z = (value - values[vi]) / bandwidth; sum += Math.exp(-0.5 * z * z); }
        out.push({ series: String(ss[si].name || ('Series ' + (si + 1))), value: value,
          density: sum / (values.length * bandwidth * Math.sqrt(2 * Math.PI)) });
      }
    }
    return out;
  }

  function frame(Plot, edge) { return Plot.frame({ stroke: edge, strokeOpacity: 0.7 }); }
  function categoryMargin(data, cfg) {
    var longest = (data.categories || []).reduce(function (n, value) { return Math.max(n, String(value).length); }, 0);
    return Math.max(82, Math.min(250, 34 + longest * Math.max(6, num(cfg.labelSize, 17) * 0.46)));
  }

  function recipe(Plot, type, data, cfg, theme) {
    var colours = theme.colours.categorical || [theme.colours.primary, theme.colours.secondary];
    var sequential = theme.colours.sequential || colours;
    var ink = theme.colours.ink, muted = theme.colours.muted, edge = theme.colours.edge;
    var pointR = Math.max(3, Math.min(16, num(cfg.pointSize, 10) * 0.62));
    var opacity = Math.max(0.12, Math.min(1, num(cfg.fillOpacity, 0.85)));
    var binWidth = Math.max(6, Math.min(64, num(cfg.plotBinWidth, 24)));
    var bandwidth = Math.max(4, Math.min(80, num(cfg.plotBandwidth, 20)));
    var facet = cfg.plotFacetDirection === 'columns' ? 'fx' : 'fy';
    var fmt = valueFormat(cfg), marks = [], options = {};

    if (type === 'dot-strip') {
      var dots = longRows(data);
      if (!dots.length) return null;
      marks = [Plot.ruleX([0], { stroke: edge }), Plot.dot(dots, {
        x: 'value', y: 'category', fill: 'series', symbol: 'series', r: pointR,
        fillOpacity: opacity, stroke: theme.colours.surface, strokeWidth: 1,
        title: function (d) { return d.series + ' · ' + d.category + ': ' + fmt(d.value); }
      }), frame(Plot, edge)];
      options = { marginLeft: categoryMargin(data, cfg), x: { grid: !!cfg.showGrid, label: cfg.xTitle || 'Value', tickFormat: fmt }, y: { label: cfg.yTitle || null, domain: data.categories || [] }, color: { domain: (data.series || []).map(function (s) { return s.name; }), range: colours }, symbol: { legend: false }, legend: (data.series || []).map(function (s) { return String(s.name); }) };
    } else if (type === 'interval') {
      var intervals = intervalRows(data);
      if (!intervals.length) return null;
      marks = [Plot.ruleY(intervals, { y: 'category', x1: 'low', x2: 'high', stroke: edge, strokeWidth: Math.max(2, cfg.lineWidth) }),
        Plot.dot(intervals, { x: 'first', y: 'category', r: pointR, fill: colours[0], title: function (d) { return fmt(d.first); } }),
        Plot.dot(intervals, { x: 'second', y: 'category', r: pointR, fill: colours[1] || colours[0], symbol: 'diamond', title: function (d) { return fmt(d.second); } }), frame(Plot, edge)];
      options = { marginLeft: categoryMargin(data, cfg), x: { grid: !!cfg.showGrid, label: cfg.xTitle || 'Range', tickFormat: fmt }, y: { label: cfg.yTitle || null, domain: data.categories || [] }, legend: (data.series || []).slice(0, 2).map(function (s) { return String(s.name); }) };
    } else if (type === 'range-band') {
      var bands = bandRows(data);
      if (!bands.length) return null;
      marks = [Plot.areaY(bands, { x: 'category', y1: 'low', y2: 'high', fill: theme.colours.primary, fillOpacity: Math.min(0.34, opacity * 0.42), title: function (d) { return d.category + ': ' + fmt(d.low) + '–' + fmt(d.high); } }),
        Plot.lineY(bands, { x: 'category', y: 'expected', stroke: theme.colours.secondary, strokeWidth: Math.max(2, cfg.lineWidth), marker: 'circle' }), frame(Plot, edge)];
      options = { x: { label: cfg.xTitle || null, domain: data.categories || [] }, y: { grid: !!cfg.showGrid, label: cfg.yTitle || 'Value', tickFormat: fmt }, legend: ['Range', (data.series[1] && data.series[1].name) || 'Expected'] };
    } else if (type === 'difference-area') {
      var difference = differenceRows(data);
      if (!difference.length) return null;
      marks = [Plot.areaY(difference, { x: 'category', y1: 'first', y2: 'second', fill: theme.colours.secondary, fillOpacity: Math.min(0.28, opacity * 0.34), title: function (d) { return d.category + ': ' + (d.difference >= 0 ? '+' : '') + fmt(d.difference); } }),
        Plot.lineY(difference, { x: 'category', y: 'first', stroke: colours[0], strokeWidth: Math.max(1.5, cfg.lineWidth) }),
        Plot.lineY(difference, { x: 'category', y: 'second', stroke: colours[1] || theme.colours.secondary, strokeWidth: Math.max(1.5, cfg.lineWidth), marker: 'circle' }), frame(Plot, edge)];
      options = { x: { label: cfg.xTitle || null, domain: data.categories || [] }, y: { grid: !!cfg.showGrid, label: cfg.yTitle || 'Value', tickFormat: fmt }, legend: (data.series || []).slice(0, 2).map(function (s) { return String(s.name); }) };
    } else if (type === 'indexed-change') {
      var indexed = indexedRows(data);
      if (!indexed.length) return null;
      marks = [Plot.ruleY([100], { stroke: edge, strokeDasharray: '5,4' }), Plot.lineY(indexed, { x: 'category', y: 'index', z: 'series', stroke: 'series', strokeWidth: Math.max(1.5, cfg.lineWidth), marker: 'circle', title: function (d) { return d.series + ' · ' + d.category + ': ' + fmt(d.index); } }), frame(Plot, edge)];
      options = { x: { label: cfg.xTitle || null, domain: data.categories || [] }, y: { grid: !!cfg.showGrid, label: cfg.yTitle || 'Index (first = 100)', tickFormat: fmt }, color: { domain: (data.series || []).map(function (s) { return s.name; }), range: colours }, legend: (data.series || []).map(function (s) { return String(s.name); }) };
    } else if (type === 'box-observations') {
      var boxes = longRows(data);
      if (!boxes.length) return null;
      marks = [cfg.plotShowRaw ? Plot.dot(boxes, { x: 'value', y: 'series', r: Math.max(2, pointR * 0.38), fill: theme.colours.secondary, fillOpacity: 0.34, title: function (d) { return d.series + ': ' + fmt(d.value); } }) : null,
        Plot.boxX(boxes, { x: 'value', y: 'series', fill: theme.colours.primary, fillOpacity: 0.22, stroke: ink, strokeWidth: Math.max(1, cfg.lineWidth * 0.65) }), frame(Plot, edge)];
      options = { marginLeft: Math.max(100, categoryMargin({ categories: (data.series || []).map(function (s) { return s.name; }) }, cfg)), x: { grid: !!cfg.showGrid, label: cfg.xTitle || 'Value', tickFormat: fmt }, y: { label: cfg.yTitle || null, domain: (data.series || []).map(function (s) { return s.name; }) } };
    } else if (type === 'small-multiples') {
      var multiples = longRows(data), facetOptions = {};
      if (!multiples.length) return null;
      facetOptions[facet] = 'series';
      marks = [Plot.line(multiples, Object.assign({ x: 'category', y: 'value', stroke: theme.colours.primary, strokeWidth: Math.max(1.5, cfg.lineWidth), marker: 'circle', title: function (d) { return d.category + ': ' + fmt(d.value); } }, facetOptions)), frame(Plot, edge)];
      options = { marginRight: facet === 'fy' ? 130 : 44, x: { label: cfg.xTitle || null, domain: data.categories || [] }, y: { grid: !!cfg.showGrid, label: cfg.yTitle || 'Value', tickFormat: fmt } };
      options[facet] = { label: null, domain: (data.series || []).map(function (s) { return s.name; }) };
    } else if (type === 'distribution-facets') {
      var distributions = longRows(data), histOptions = { x: 'value', thresholds: Math.max(6, Math.min(60, Math.round(num(cfg.plotBins, 20)))), fill: theme.colours.primary, fillOpacity: opacity, stroke: theme.colours.surface };
      if (!distributions.length) return null;
      histOptions[facet] = 'series';
      marks = [Plot.rectY(distributions, Plot.binX({ y: 'count' }, histOptions)), Plot.ruleY([0], { stroke: edge }), frame(Plot, edge)];
      options = { x: { grid: !!cfg.showGrid, label: cfg.xTitle || 'Value', tickFormat: fmt }, y: { label: 'Count' } };
      options[facet] = { label: null, domain: (data.series || []).map(function (s) { return s.name; }) };
    } else if (type === 'rug-histogram') {
      var rug = longRows(data), rugHist = { x: 'value', thresholds: Math.max(6, Math.min(60, Math.round(num(cfg.plotBins, 20)))), fill: theme.colours.primary, fillOpacity: Math.min(0.55, opacity * 0.7), stroke: theme.colours.surface };
      if (!rug.length) return null;
      rugHist[facet] = 'series';
      var rugTicks = { x: 'value', stroke: ink, strokeOpacity: cfg.plotShowRaw ? 0.34 : 0, insetTop: 2 };
      rugTicks[facet] = 'series';
      marks = [Plot.rectY(rug, Plot.binX({ y: 'count' }, rugHist)), cfg.plotShowRaw ? Plot.tickX(rug, rugTicks) : null, Plot.ruleY([0], { stroke: edge }), frame(Plot, edge)];
      options = { marginRight: facet === 'fy' ? 130 : 44, x: { grid: !!cfg.showGrid, label: cfg.xTitle || 'Value', tickFormat: fmt }, y: { label: 'Count' } };
      options[facet] = { label: null, domain: (data.series || []).map(function (s) { return s.name; }) };
    } else if (type === 'density-ridges') {
      var ridges = densityRows(data, cfg), ridgeFacet = {};
      if (!ridges.length) return null;
      ridgeFacet[facet] = 'series';
      marks = [Plot.areaY(ridges, Object.assign({ x: 'value', y: 'density', fill: theme.colours.primary, fillOpacity: Math.min(0.48, opacity * 0.56) }, ridgeFacet)),
        Plot.lineY(ridges, Object.assign({ x: 'value', y: 'density', stroke: ink, strokeOpacity: 0.78, strokeWidth: Math.max(1, cfg.lineWidth * 0.6) }, ridgeFacet)), frame(Plot, edge)];
      options = { marginRight: facet === 'fy' ? 130 : 44, x: { grid: !!cfg.showGrid, label: cfg.xTitle || 'Value', tickFormat: fmt }, y: { label: 'Density' } };
      options[facet] = { label: null, domain: (data.series || []).map(function (s) { return s.name; }) };
    } else if (type === 'ecdf') {
      var cumulative = ecdfRows(data);
      if (!cumulative.length) return null;
      marks = [Plot.ruleY([0, 1], { stroke: edge }), Plot.lineY(cumulative, { x: 'value', y: 'probability', z: 'series', stroke: 'series', curve: 'step', strokeWidth: Math.max(1.5, cfg.lineWidth), title: function (d) { return d.series + ': ' + fmt(d.value) + ' · ' + Math.round(d.probability * 100) + '%'; } }), frame(Plot, edge)];
      options = { x: { grid: !!cfg.showGrid, label: cfg.xTitle || 'Value', tickFormat: fmt }, y: { grid: !!cfg.showGrid, domain: [0, 1], label: cfg.yTitle || 'Cumulative share', tickFormat: function (v) { return Math.round(v * 100) + '%'; } }, color: { domain: (data.series || []).map(function (s) { return s.name; }), range: colours }, legend: (data.series || []).map(function (s) { return String(s.name); }) };
    } else if (type === 'control-band') {
      var control = controlRows(data);
      if (!control.length) return null;
      var limits = [control[0].lower, control[0].upper];
      marks = [Plot.areaY(control, { x: 'category', y1: 'lower', y2: 'upper', fill: theme.colours.primary, fillOpacity: Math.min(0.2, opacity * 0.24) }),
        Plot.ruleY(limits, { stroke: theme.colours.secondary, strokeOpacity: 0.72, strokeDasharray: '7,5' }),
        Plot.ruleY([control[0].mean], { stroke: muted, strokeWidth: Math.max(1.2, cfg.lineWidth * 0.6) }),
        Plot.lineY(control, { x: 'category', y: 'value', stroke: ink, strokeWidth: Math.max(2, cfg.lineWidth), marker: 'circle', title: function (d) { return d.category + ': ' + fmt(d.value); } }), frame(Plot, edge)];
      options = { x: { label: cfg.xTitle || null, domain: data.categories || [] }, y: { grid: !!cfg.showGrid, label: cfg.yTitle || ((data.series[0] || {}).name || 'Value'), tickFormat: fmt }, legend: ['Observed', 'Mean', '±2 standard deviations'] };
    } else if (type === 'hexbin') {
      var hex = pointRows(data);
      if (!hex.length) return null;
      marks = [Plot.hexgrid({ binWidth: binWidth, stroke: edge, strokeOpacity: 0.18 }), Plot.dot(hex, Plot.hexbin({ fill: 'count' }, { x: 'x', y: 'y', binWidth: binWidth, stroke: theme.colours.surface, strokeWidth: 0.7 })), frame(Plot, edge)];
      options = { x: { grid: false, label: cfg.xTitle || ((data.numericCols[0] || {}).name || 'x'), tickFormat: fmt }, y: { grid: false, label: cfg.yTitle || ((data.numericCols[1] || {}).name || 'y'), tickFormat: fmt }, color: { type: 'linear', range: sequential, label: 'Density' } };
    } else if (type === 'density-contour') {
      var density = pointRows(data);
      if (density.length < 2) return null;
      marks = [cfg.plotShowRaw ? Plot.dot(density, { x: 'x', y: 'y', r: Math.max(1.5, pointR * 0.32), fill: ink, fillOpacity: 0.18 }) : null,
        Plot.density(density, { x: 'x', y: 'y', fill: 'density', stroke: theme.colours.primary, strokeWidth: Math.max(1, cfg.lineWidth * 0.65), fillOpacity: Math.min(0.5, opacity * 0.45), bandwidth: bandwidth, thresholds: Math.max(6, Math.min(40, Math.round(num(cfg.plotBins, 20)))) }), frame(Plot, edge)];
      options = { x: { grid: false, label: cfg.xTitle || ((data.numericCols[0] || {}).name || 'x'), tickFormat: fmt }, y: { grid: false, label: cfg.yTitle || ((data.numericCols[1] || {}).name || 'y'), tickFormat: fmt }, color: { type: 'linear', range: sequential, label: 'Density' } };
    } else if (type === 'regression') {
      var regression = pointRows(data);
      // A fitted line and interval are not meaningful with fewer than three
      // finite observations; retain the semantic fallback instead of asking
      // Plot to manufacture NaN path coordinates.
      if (regression.length < 3) return null;
      marks = [Plot.ruleY([0], { stroke: edge }), cfg.plotShowRaw ? Plot.dot(regression, { x: 'x', y: 'y', r: pointR, fill: theme.colours.primary, fillOpacity: Math.min(0.65, opacity), title: function (d) { return fmt(d.x) + ', ' + fmt(d.y); } }) : null,
        Plot.linearRegressionY(regression, { x: 'x', y: 'y', stroke: theme.colours.secondary, fill: theme.colours.secondary, fillOpacity: cfg.plotConfidenceBand ? 0.14 : 0, ci: cfg.plotConfidenceBand ? 0.95 : 0, strokeWidth: Math.max(2, cfg.lineWidth) }), frame(Plot, edge)];
      options = { x: { grid: !!cfg.showGrid, label: cfg.xTitle || ((data.numericCols[0] || {}).name || 'x'), tickFormat: fmt }, y: { grid: !!cfg.showGrid, label: cfg.yTitle || ((data.numericCols[1] || {}).name || 'y'), tickFormat: fmt } };
    } else if (type === 'candlestick') {
      var candles = candleRows(data);
      if (!candles.length) return null;
      marks = [Plot.ruleX(candles, { x: 'category', y1: 'low', y2: 'high', stroke: muted, strokeWidth: Math.max(1.2, cfg.lineWidth * 0.55) }),
        Plot.barY(candles, { x: 'category', y1: 'open', y2: 'close', fill: 'direction', stroke: 'direction', inset: Math.max(3, num(cfg.barPadding, 0.2) * 18), title: function (d) { return d.category + '\nO ' + fmt(d.open) + ' H ' + fmt(d.high) + ' L ' + fmt(d.low) + ' C ' + fmt(d.close); } }), frame(Plot, edge)];
      options = { x: { label: cfg.xTitle || null, domain: data.categories || [] }, y: { grid: !!cfg.showGrid, label: cfg.yTitle || 'Value', tickFormat: fmt }, color: { domain: ['Up', 'Down'], range: [colours[0], colours[1] || muted] }, legend: ['Up', 'Down'] };
    } else return null;
    return { marks: marks.filter(Boolean), options: options };
  }

  function svgEl(name, attrs, text) {
    var el = document.createElementNS(SVG_NS, name);
    Object.keys(attrs || {}).forEach(function (key) { el.setAttribute(key, String(attrs[key])); });
    if (text != null) el.textContent = String(text);
    return el;
  }

  function decorate(svg, state, recipeResult, frameLabel) {
    var cfg = state.cfg, spec = state.spec, theme = spec.theme, W = cfg.width, H = cfg.height;
    svg.setAttribute('data-chart-plot-svg', '');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', spec.accessibility.description);
    svg.setAttribute('width', W); svg.setAttribute('height', H);
    svg.style.width = '100%'; svg.style.height = '100%'; svg.style.display = 'block';
    svg.insertBefore(svgEl('desc', {}, spec.accessibility.description), svg.firstChild);
    svg.insertBefore(svgEl('title', {}, spec.accessibility.title), svg.firstChild);
    if (cfg.heading) svg.appendChild(svgEl('text', { x: 44, y: 48, fill: theme.colours.ink, 'font-size': cfg.titleSize, 'font-weight': cfg.titleWeight, 'text-anchor': 'start' }, cfg.heading));
    if (cfg.subheading) svg.appendChild(svgEl('text', { x: 44, y: 80, fill: theme.colours.muted, 'font-size': Math.max(14, cfg.labelSize), 'text-anchor': 'start' }, cfg.subheading));
    var legends = recipeResult.options.legend || [];
    if (cfg.showLegend && legends.length) {
      var g = svgEl('g', { transform: 'translate(44 ' + (H - 24) + ')', 'aria-label': 'Legend' });
      legends.slice(0, 8).forEach(function (label, i) {
        var x = i * Math.max(96, Math.min(180, (W - 88) / Math.max(1, legends.length)));
        g.appendChild(svgEl('circle', { cx: x + 6, cy: 0, r: 5, fill: theme.colours.categorical[i % theme.colours.categorical.length] }));
        g.appendChild(svgEl('text', { x: x + 17, y: 5, fill: theme.colours.ink, 'font-size': Math.max(12, cfg.labelSize * 0.72), 'text-anchor': 'start' }, label));
      });
      svg.appendChild(g);
    }
    if (state.data && state.data.recommendation && W >= 520 && H >= 220) {
      var rec = state.data.recommendation, cardW = Math.min(500, Math.max(300, W * 0.42), W - 88);
      var cardX = W - 44 - cardW, cardY = cfg.subheading ? 104 : cfg.heading ? 72 : 24;
      var recG = svgEl('g', { 'data-export-hide': '', role: 'note',
        'aria-label': 'Chart recommendation: ' + rec.label + '. ' + rec.reason });
      recG.appendChild(svgEl('rect', { x: cardX, y: cardY, width: cardW, height: 96, rx: 12,
        fill: theme.colours.surface, 'fill-opacity': 0.94, stroke: theme.colours.edge, 'stroke-opacity': 0.55 }));
      recG.appendChild(svgEl('text', { x: cardX + 16, y: cardY + 26, fill: theme.colours.ink,
        'font-size': 14, 'font-weight': 750 }, 'Recommended · ' + rec.label + ' · ' + rec.confidence + ' confidence'));
      var reason = String(rec.reason || '');
      if (reason.length > 96) reason = reason.slice(0, 93).replace(/\s+\S*$/, '') + '…';
      recG.appendChild(svgEl('text', { x: cardX + 16, y: cardY + 53, fill: theme.colours.muted,
        'font-size': 13 }, reason));
      recG.appendChild(svgEl('text', { x: cardX + 16, y: cardY + 77, fill: theme.colours.muted,
        'fill-opacity': 0.74, 'font-size': 12 }, state.data.profileSummary || ''));
      svg.appendChild(recG);
    }
    if (cfg.frameLabelShow !== false && frameLabel != null && frameLabel !== '') {
      var position = String(cfg.frameLabelPos || 'tr');
      var left = position === 'tl' || position === 'bl';
      var bottom = position === 'bl' || position === 'br';
      var labelSize = clamp(num(cfg.frameLabelSize, 36), 8, 160);
      svg.appendChild(svgEl('text', {
        x: left ? 24 : W - 24, y: bottom ? H - 24 : labelSize + 18,
        fill: cfg.frameLabelColor || theme.colours.ink,
        'font-size': labelSize, 'font-weight': clamp(num(cfg.frameLabelWeight, 700), 100, 900),
        'text-anchor': left ? 'start' : 'end', opacity: 0.92,
        'aria-label': 'Animation frame ' + frameLabel,
      }, frameLabel));
    }
  }

  function ease(t, mode) {
    t = clamp(t, 0, 1);
    if (mode === 'steps') return t < 1 ? 0 : 1;
    if (mode === 'linear') return t;
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  function frameAt(data, cfg, t) {
    var frames = data.frames || [], count = frames.length, bounce = cfg.animDirection === 'bounce';
    if (count < 2) return null;
    var i, j, local;
    if (bounce) {
      var u = t < 0.5 ? t * 2 : (1 - t) * 2, p = u * (count - 1);
      i = Math.min(count - 1, Math.floor(p)); j = Math.min(count - 1, i + 1); local = p - i;
    } else {
      var q = t * count;
      i = Math.floor(q) % count; j = (i + 1) % count; local = q - Math.floor(q);
    }
    var tween = cfg.animEase === 'steps' ? 0 : cfg.animEase === 'linear'
      ? local : local < 0.35 ? 0 : ease((local - 0.35) / 0.65, 'smooth');
    var series = frames[i].map(function (a, si) {
      var b = frames[j][si] || a;
      return { name: a.name, values: (a.values || []).map(function (av, ri) {
        var bv = b.values && b.values[ri], an = finite(av) ? +av : null, bn = finite(bv) ? +bv : null;
        if (an == null && bn == null) return null;
        if (an == null) return bn * tween;
        if (bn == null) return an * (1 - tween);
        return an + (bn - an) * tween;
      }) };
    });
    return {
      data: { categories: data.categories || [], series: series, numericCols: series, errorValues: null },
      label: (data.frameLabels || [])[tween < 0.5 ? i : j] || String((tween < 0.5 ? i : j) + 1),
    };
  }

  function markShapes(svg) {
    var groups = Array.prototype.filter.call(svg.querySelectorAll('g[aria-label]'), function (group) {
      return /^(area|bar|box|cell|density|dot|hex|line|link|rect|rule|tick)/i.test(group.getAttribute('aria-label') || '');
    });
    var seen = [], shapes = [];
    groups.forEach(function (group) {
      Array.prototype.forEach.call(group.querySelectorAll('path,circle,rect,line,polygon,polyline'), function (shape) {
        if (seen.indexOf(shape) < 0) { seen.push(shape); shapes.push(shape); }
      });
    });
    return { groups: groups, shapes: shapes };
  }

  function entrance(svg, cfg, preset, t, clipId) {
    var progress = ease(clamp(t / 0.78, 0, 1), cfg.animEase || 'smooth');
    var marks = markShapes(svg);
    if (preset === 'reveal') {
      var defs = svg.querySelector('defs[data-lolly-motion]');
      if (!defs) {
        defs = svgEl('defs', { 'data-lolly-motion': '' });
        var clip = svgEl('clipPath', { id: clipId });
        clip.appendChild(svgEl('rect', { x: 0, y: 0, width: 0, height: cfg.height }));
        defs.appendChild(clip); svg.insertBefore(defs, svg.firstChild);
        marks.groups.forEach(function (group) { group.setAttribute('clip-path', 'url(#' + clipId + ')'); });
      }
      var reveal = defs.querySelector('rect');
      if (reveal) reveal.setAttribute('width', String(cfg.width * progress));
    } else if (preset === 'stagger') {
      var count = Math.max(1, marks.shapes.length);
      marks.shapes.forEach(function (shape, i) {
        var start = i / count * 0.72;
        shape.style.opacity = String(ease(clamp((progress - start) / 0.28, 0, 1), cfg.animEase || 'smooth'));
      });
    }
  }

  function mount(args) {
    var root = args.root, state = args.state, Plot = args.Plot;
    var target = root.querySelector('[data-chart-plot-root]');
    var fallback = root.querySelector('[data-chart-plot-fallback]');
    var clockNode = args.clock || root.querySelector('[data-chart-plot-clock]');
    if (!target || !state || !state.cfg || !state.spec || !Plot) return { dispose: function () {} };
    var cfg = state.cfg, theme = state.spec.theme, data = state.data || {};
    var currentSvg = null, raf = 0, disposed = false, lastT = 0, resumeT = 0, priorT = null, lastDraw = -1e9;
    var instanceId = ++INSTANCE, clipId = 'lolly-plot-reveal-' + instanceId;
    var motion = state.spec.motion || { enabled: false, preset: 'none', duration: 1, poster: 1 };
    var hasFrames = !!(data.frames && data.frames.length >= 2);
    var reduced = !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);

    function draw(drawData, frameLabel) {
      var result = recipe(Plot, cfg.chartType, drawData, cfg, theme);
      if (!result) return false;
      var style = {
        background: cfg.transparent ? 'transparent' : cfg.background,
        color: theme.colours.ink,
        fontFamily: theme.font.brand || "var(--font-brand, 'SUSE', system-ui, sans-serif)",
        fontSize: Math.max(11, cfg.labelSize * 0.72) + 'px',
      };
      var topMargin = cfg.heading ? (cfg.subheading ? 112 : 82) : 42;
      if (data.recommendation && cfg.width >= 520 && cfg.height >= 320) topMargin += 112;
      var options = Object.assign({
        width: cfg.width, height: cfg.height, figure: false,
        marginTop: topMargin,
        marginRight: 44, marginBottom: cfg.showLegend ? 72 : 50, marginLeft: 82,
        style: style, ariaLabel: state.spec.accessibility.title,
        ariaDescription: state.spec.accessibility.description,
        marks: result.marks,
      }, result.options);
      delete options.legend;
      currentSvg = Plot.plot(options);
      decorate(currentSvg, state, result, frameLabel);
      currentSvg.__lollyFrameRender = renderAt;
      target.replaceChildren(currentSvg);
      return true;
    }

    function renderAt(t) {
      t = clamp(num(t, 0), 0, 0.999999); lastT = t;
      if (hasFrames) {
        var keyed = frameAt(data, cfg, t);
        if (!keyed || !draw(keyed.data, keyed.label)) return false;
      } else {
        if (!currentSvg && !draw(data, null)) return false;
        if (motion.enabled && motion.preset !== 'none') entrance(currentSvg, cfg, motion.preset, t, clipId);
      }
      if (global.__lollyAnim && global.__lollyAnim.owner === root) global.__lollyAnim.curT = t;
      return true;
    }

    if (!renderAt(motion.enabled && reduced ? clamp(num(motion.poster, 1), 0, 0.999999) : 0)) {
      root.setAttribute('data-backend', 'semantic-fallback');
      return { dispose: function () { target.replaceChildren(); } };
    }
    if (fallback) fallback.style.display = 'none';
    target.style.display = 'block';
    root.setAttribute('data-backend', 'observable-plot-svg');

    function driven() { return !!((clockNode && clockNode.__lollyFrameDriven) || (currentSvg && currentSvg.__lollyFrameDriven)); }
    function stop() { if (raf) { global.cancelAnimationFrame(raf); raf = 0; } }
    var loopMs = Math.max(300, num(motion.duration, 1.5) * 1000) * (hasFrames ? data.frames.length : 1);
    var previous = global.__lollyAnim || {};
    var transport = motion.enabled ? global.__lollyAnim = {
      active: true, owner: root, loopMs: loopMs, labels: hasFrames ? (data.frameLabels || []) : [],
      playing: reduced ? false : previous.playing !== false,
      scrubT: previous.scrubT != null ? previous.scrubT : null,
      curT: previous.curT || 0, gen: (previous.gen || 0) + 1,
    } : null;
    var elapsed = (transport ? transport.curT : 0) * loopMs;
    function tick(ts) {
      if (disposed) return;
      if (priorT == null) priorT = ts;
      var dt = ts - priorT; priorT = ts;
      if (!driven()) {
        var t = lastT;
        if (transport && transport.scrubT != null) { t = clamp(transport.scrubT, 0, 1); elapsed = t * loopMs; }
        else if (!transport || transport.playing !== false) { elapsed = (elapsed + dt) % loopMs; t = elapsed / loopMs; }
        var moving = !transport || (transport.scrubT == null && transport.playing !== false);
        if ((moving && ts - lastDraw >= 32) || (!moving && Math.abs(t - lastT) > 0.0005)) { renderAt(t); lastDraw = ts; }
      }
      raf = global.requestAnimationFrame(tick);
    }
    function play() { if (!disposed && motion.enabled && !raf) { priorT = null; raf = global.requestAnimationFrame(tick); } }
    function poster() { resumeT = lastT; stop(); return renderAt(clamp(num(motion.poster, hasFrames ? 0 : 1), 0, 0.999999)); }
    function restore() { renderAt(resumeT); play(); }
    if (clockNode) clockNode.__lollyFrameRender = renderAt;
    play();
    return {
      animated: !!motion.enabled, renderAt: renderAt, poster: poster, restore: restore,
      dispose: function () {
        disposed = true; stop();
        if (clockNode) { delete clockNode.__lollyFrameRender; delete clockNode.__lollyFrameDriven; }
        if (global.__lollyAnim && global.__lollyAnim.owner === root) global.__lollyAnim.active = false;
        target.replaceChildren(); if (fallback) fallback.style.display = '';
      },
    };
  }

  global.LollyChartPlot = Object.freeze({ mount: mount });
})(typeof window !== 'undefined' ? window : globalThis);
