/**
 * Street Map hooks.
 *
 * The interactive map itself lives in the template <script> (it needs the DOM
 * and d3, which the sandboxed hook context doesn't have). The hook's only job is
 * to normalise input values and expose them as `_`-prefixed extras so the
 * template script can read them - declared input IDs get wrapped in HTML comment
 * markers by the engine's annotateTemplate, which would break JS if read inside
 * <script>. See meeting-planner for the same pattern.
 *
 * The GPX route is parsed HERE, with string + regex work only: no DOMParser, so
 * the CLI (jsdom-free hook context) reads the same file the browser does. What
 * the hook hands over is plain "lon,lat" lists - it never projects anything.
 * Projection stays in the template script, which draws the route with the SAME
 * d3 geoPath/projection objects that draw the roads, so a route can never sit
 * off the streets it was recorded on.
 */

/* Rendered track points, after downsampling. A watch export can carry tens of
   thousands of trackpoints and every one of them would ride into the extras
   string and the SVG. 1500 is far more than a 900px canvas can show apart. */
var MAX_ROUTE_POINTS = 1500;
var MAX_ROUTE_DOTS = 200;

/* Namespace-tolerant tag matching: <trkpt>, <gpx:trkpt>, <ns1:trkseg> all hit. */
var PT_RE = /<(?:[A-Za-z0-9_.-]+:)?(trkpt|rtept|wpt)\b([^>]*?)\/?>/gi;
var SEG_RE = /<(?:[A-Za-z0-9_.-]+:)?(trkseg|rte)\b[^>]*?>([\s\S]*?)<\/(?:[A-Za-z0-9_.-]+:)?\1\s*>/gi;
var SEG_OPEN_RE = /<(?:[A-Za-z0-9_.-]+:)?(?:trkseg|rte)\b[^>]*?(\/?)>/gi;
var LAT_RE = /\blat\s*=\s*["']?([^"'\s>/]+)/i;
var LON_RE = /\blon\s*=\s*["']?([^"'\s>/]+)/i;

function round6(n) {
  return Math.round(n * 1e6) / 1e6;
}

/* Pull every point of the wanted kinds out of one chunk of GPX text.
   Anything with a missing or out-of-range coordinate is COUNTED, never
   silently dropped - the count becomes the warning the user sees. */
function readPoints(chunk, kinds, acc) {
  PT_RE.lastIndex = 0;
  var m;
  while ((m = PT_RE.exec(chunk))) {
    if (kinds.indexOf(m[1].toLowerCase()) < 0) continue;
    var attrs = m[2] || '';
    var la = LAT_RE.exec(attrs);
    var lo = LON_RE.exec(attrs);
    var lat = la ? Number(la[1]) : NaN;
    var lon = lo ? Number(lo[1]) : NaN;
    if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      acc.bad++;
      continue;
    }
    acc.pts.push([round6(lon), round6(lat)]);
  }
}

function parseGpx(text) {
  var src = String(text == null ? '' : text).replace(/\r\n?/g, '\n');
  var out = { lines: [], dots: [], badSegs: 0, badPts: 0, points: 0, empty: !src.trim() };
  if (out.empty) return out;

  /* Tracks and routes: one polyline per <trkseg> / <rte>. */
  var blocks = 0;
  var m;
  SEG_RE.lastIndex = 0;
  while ((m = SEG_RE.exec(src))) {
    blocks++;
    var acc = { pts: [], bad: 0 };
    readPoints(m[2] || '', ['trkpt', 'rtept'], acc);
    out.badPts += acc.bad;
    if (acc.pts.length > 1) out.lines.push(acc.pts);
    else out.badSegs++;
  }

  if (blocks) {
    /* An opening tag with no closing one never became a block. Only counted
       when some block DID parse: with none, the loose scan below reads the
       whole file anyway, so nothing was lost and there is nothing to report. */
    var opens = 0;
    SEG_OPEN_RE.lastIndex = 0;
    while ((m = SEG_OPEN_RE.exec(src))) if (!m[1]) opens++;
    if (opens > blocks) out.badSegs += opens - blocks;
  } else {
    /* No usable wrapper (truncated file, or trackpoints written flat): read the
       document as one line rather than showing the user an empty map. */
    var loose = { pts: [], bad: 0 };
    readPoints(src, ['trkpt', 'rtept'], loose);
    out.badPts += loose.bad;
    if (loose.pts.length > 1) out.lines.push(loose.pts);
  }

  /* Waypoints are dots, never part of a line. */
  var wacc = { pts: [], bad: 0 };
  readPoints(src, ['wpt'], wacc);
  out.badPts += wacc.bad;
  out.dots = wacc.pts.slice(0, MAX_ROUTE_DOTS);

  var total = 0;
  for (var i = 0; i < out.lines.length; i++) total += out.lines[i].length;
  if (total > MAX_ROUTE_POINTS) {
    var stride = Math.ceil(total / MAX_ROUTE_POINTS);
    out.lines = out.lines.map(function (line) {
      var kept = line.filter(function (_, idx) { return idx % stride === 0; });
      var last = line[line.length - 1];
      if (kept[kept.length - 1] !== last) kept.push(last);
      return kept;
    });
    total = 0;
    for (var j = 0; j < out.lines.length; j++) total += out.lines[j].length;
  }
  out.points = total + out.dots.length;
  return out;
}

function routeWarning(p) {
  if (p.empty) return '';
  if (!p.lines.length && !p.dots.length) {
    return 'No route points found in that file. A GPX export from a watch or a phone app should work.';
  }
  var bits = [];
  if (p.badSegs) bits.push(p.badSegs + (p.badSegs === 1 ? ' segment' : ' segments'));
  if (p.badPts) bits.push(p.badPts + (p.badPts === 1 ? ' point' : ' points'));
  if (!bits.length) return '';
  return 'Skipped ' + bits.join(' and ') + ' with no usable coordinates.';
}

function encodePts(pts) {
  return pts.map(function (p) { return p[0] + ',' + p[1]; }).join(';');
}

/* Re-parsing a big GPX on every keystroke of an unrelated slider is pure waste,
   and the route text is the only thing the parse depends on. */
var _lastRoute = null;
var _lastParse = null;

function gpxFor(text) {
  if (_lastParse && _lastRoute === text) return _lastParse;
  _lastRoute = text;
  _lastParse = parseGpx(text);
  return _lastParse;
}

function compute(inputs) {
  const theme           = inputs.theme === 'dark' ? 'dark' : 'light';
  const city            = (inputs.city || 'nuremberg').trim();
  const minorRoadWeight = Math.max(0.1, Number(inputs.minorRoadWeight) || 1);
  const majorRoadWeight = Math.max(0.1, Number(inputs.majorRoadWeight) || 1);
  const waterWeight     = Math.max(0.1, Number(inputs.waterWeight) || 1);
  const showWater       = inputs.showWater !== false && inputs.showWater !== 'false';
  const roadColor       = (inputs.roadColor || '').trim();
  const waterColor      = (inputs.waterColor || '').trim();
  const background       = (inputs.background || '').trim();
  const view            = (inputs.view || '').trim();
  const routeColor      = (inputs.routeColor || '').trim();
  const routeWidth      = Math.max(0.2, Number(inputs.routeWidth) || 3);

  const route = gpxFor(typeof inputs.route === 'string' ? inputs.route : '');
  const hasRoute = route.lines.length > 0 || route.dots.length > 0;

  return {
    // Declared values - only used in attribute context in the markup (safe).
    theme,
    city,

    // Route report - plain extras, so the template can show them as text.
    routeWarning: routeWarning(route),
    routePoints: route.points,
    routeSegments: route.lines.length,

    // Extras for the template <script> (keys don't match input IDs → not annotated).
    _theme:           theme,
    _city:            city,
    _minorRoadWeight: String(minorRoadWeight),
    _majorRoadWeight: String(majorRoadWeight),
    _waterWeight:     String(waterWeight),
    _showWater:       showWater ? 'yes' : 'no',
    _roadColor:       roadColor,
    _waterColor:      waterColor,
    _background:      background,
    _view:            view,
    _routeSegs:       route.lines.map(encodePts).join('|'),
    _routeDots:       encodePts(route.dots),
    _routeColor:      routeColor,
    _routeWidth:      String(routeWidth),
    // Auto-fit only while the viewport is untouched: an explicit pan or zoom
    // has written `view`, and the user's framing always wins from then on.
    _routeFit:        hasRoute && !view ? 'yes' : 'no',
  };
}

function onInit({ model }) {
  return compute(Object.fromEntries(model.map((i) => [i.id, i.value])));
}

function onInput({ model }) {
  return compute(Object.fromEntries(model.map((i) => [i.id, i.value])));
}
