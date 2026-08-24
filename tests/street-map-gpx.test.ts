// SPDX-License-Identifier: MPL-2.0
/**
 * Street Map (community/street-map) - GPX route import contract.
 *
 * Loads the REAL tool from disk (manifest + template + hooks) and drives it
 * through the engine. What each test pins:
 *
 *  - the parser reads namespaced tags, CRLF files, rte/rtept and wpt, and
 *    COUNTS everything it cannot use instead of dropping it in silence;
 *  - junk in is a warning, never a throw and never an invented line;
 *  - the route is projected by the SAME d3 projection the roads use - the
 *    template holds exactly one projection, and a point put through the
 *    route's geoPath comes out where proj() puts it (the dots' path);
 *  - auto-fit is gated on an untouched viewport, so it never fights a user
 *    who has panned or zoomed;
 *  - every example, template and preset seed hydrates with no hook error.
 *
 * Run with: node --import ./tests/css-stub.mjs --test tests/street-map-gpx.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { baseHost } from './helpers/host.ts';

// street-map ships in the PUBLIC community pack and is EXCLUDED from the SUSE
// profile, so the gitignored tools/ view may not hold it at all. Load from the
// SOURCE pack: skip only when community/ isn't checked out.
const COMMUNITY = join(dirname(fileURLToPath(import.meta.url)), '..', 'community');
const TOOL_DIR = join(COMMUNITY, 'street-map');
const fetchFile = (path: string) => readFile(join(COMMUNITY, path), 'utf8');

const PACK_MOUNTED = existsSync(COMMUNITY);
const SKIP = !PACK_MOUNTED && 'community pack not mounted (clone without submodules)';
if (PACK_MOUNTED) {
  assert.ok(existsSync(join(TOOL_DIR, 'tool.json')),
    'community/street-map/tool.json is missing - pack is mounted, so the tool was renamed or deleted');
}

const tool: any = SKIP ? null : await loadTool('street-map', fetchFile);
const TEMPLATE = SKIP ? '' : readFileSync(join(TOOL_DIR, 'template.html'), 'utf8');

async function mount(state: Record<string, unknown>) {
  return createRuntime(tool, baseHost(), state as Record<string, any>);
}

/** One hook extra as text. The extras are the tool's data surface. */
async function extras(state: Record<string, unknown>) {
  const rt = await mount(state);
  const read = (name: string) => (rt.getHydratedString(`{{${name}}}`) as string);
  return {
    segs: read('_routeSegs'),
    dots: read('_routeDots'),
    fit: read('_routeFit'),
    warning: read('routeWarning'),
    points: Number(read('routePoints')),
    lines: Number(read('routeSegments')),
    html: rt.getHydrated() as string,
  };
}

/** "lon,lat;lon,lat|..." back into arrays. The test decodes independently. */
function decode(s: string): Array<Array<[number, number]>> {
  if (!s) return [];
  return s.split('|').filter(Boolean).map(seg => seg.split(';').filter(Boolean).map(pair => {
    const [lon, lat] = pair.split(',').map(Number);
    return [lon, lat] as [number, number];
  }));
}

// ── Fixtures ────────────────────────────────────────────────────────────────

// Namespaced tags, CRLF line endings, closing tags rather than self-closing.
const NAMESPACED_CRLF = [
  '<?xml version="1.0"?>',
  '<gpx:gpx xmlns:gpx="http://www.topografix.com/GPX/1/1" version="1.1">',
  '<gpx:trk><gpx:name>Ride</gpx:name><gpx:trkseg>',
  '<gpx:trkpt lat="49.4530" lon="11.0740"><gpx:ele>309</gpx:ele></gpx:trkpt>',
  '<gpx:trkpt lat="49.4538" lon="11.0752"></gpx:trkpt>',
  '<gpx:trkpt lat="49.4547" lon="11.0764"></gpx:trkpt>',
  '<gpx:trkpt lat="49.4553" lon="11.0781"></gpx:trkpt>',
  '</gpx:trkseg></gpx:trk>',
  '</gpx:gpx>',
].join('\r\n');

// A plain route, no track at all - lon before lat in the attribute order, to
// prove the parser reads attributes by name and not by position.
const RTE_ONLY = `<gpx version="1.1"><rte><name>Planned</name>
 <rtept lon="11.0740" lat="49.4530"/>
 <rtept lon="11.0760" lat="49.4545"/>
 <rtept lon="11.0790" lat="49.4550"/>
</rte></gpx>`;

// Waypoints only: dots, no line.
const WPTS_ONLY = `<gpx version="1.1">
 <wpt lat="49.4530" lon="11.0740"><name>Start</name></wpt>
 <wpt lat="49.4553" lon="11.0781"><name>Coffee</name></wpt>
</gpx>`;

// One usable segment with a broken point, one single-point segment, and one
// segment that was never closed (a truncated download).
const MESSY = `<gpx version="1.1"><trk>
<trkseg>
 <trkpt lat="49.4530" lon="11.0740"/>
 <trkpt lat="north" lon="11.0752"/>
 <trkpt lat="49.4547" lon="11.0764"/>
</trkseg>
<trkseg>
 <trkpt lat="49.4553" lon="11.0781"/>
</trkseg>
<trkseg>
 <trkpt lat="49.4547" lon="11.0796"/>
 <trkpt lat="49.4536" lon="11.0798"/>
</trk></gpx>`;

const JUNK = 'Saturday: 42km along the river, felt great, no watch though.';

// ── Parsing ─────────────────────────────────────────────────────────────────

test('namespaced tags and CRLF parse to one line', { skip: SKIP }, async () => {
  const e = await extras({ route: NAMESPACED_CRLF });
  const lines = decode(e.segs);
  assert.equal(lines.length, 1, 'one <trkseg> is one polyline');
  assert.equal(lines[0]!.length, 4);
  // GeoJSON order: lon first. A swap here would put the route in the Indian Ocean.
  assert.deepEqual(lines[0]![0], [11.074, 49.453]);
  assert.deepEqual(lines[0]![3], [11.0781, 49.4553]);
  assert.equal(e.dots, '', 'no <wpt> in the file, so no dots');
  assert.equal(e.warning, '', 'a clean file warns about nothing');
  assert.equal(e.points, 4);
});

test('a route with no track (rte/rtept) still draws', { skip: SKIP }, async () => {
  const e = await extras({ route: RTE_ONLY });
  const lines = decode(e.segs);
  assert.equal(lines.length, 1);
  assert.deepEqual(lines[0]!.map(p => p[1]), [49.453, 49.4545, 49.455]);
  assert.equal(e.warning, '');
});

test('waypoints become dots, not a line', { skip: SKIP }, async () => {
  const e = await extras({ route: WPTS_ONLY });
  assert.equal(e.segs, '', 'two waypoints are not a track');
  assert.deepEqual(decode(e.dots)[0], [[11.074, 49.453], [11.0781, 49.4553]]);
  assert.equal(e.lines, 0);
  assert.equal(e.points, 2);
  assert.equal(e.warning, '', 'a waypoint-only file is a valid file');
});

test('what cannot be parsed is counted, and the good part still draws', { skip: SKIP }, async () => {
  const e = await extras({ route: MESSY });
  const lines = decode(e.segs);
  assert.equal(lines.length, 1, 'the one usable segment survives');
  assert.equal(lines[0]!.length, 2, 'the point with lat="north" is out');
  // 1 single-point segment + 1 segment that was never closed.
  assert.equal(e.warning, 'Skipped 2 segments and 1 point with no usable coordinates.');
  assert.equal(e.points, 2);
});

test('an out-of-range coordinate is a bad point, not a line to nowhere', { skip: SKIP }, async () => {
  const e = await extras({
    route: '<gpx><trkseg><trkpt lat="95.1" lon="11.07"/><trkpt lat="49.45" lon="11.08"/>'
      + '<trkpt lat="49.46" lon="11.09"/></trkseg></gpx>',
  });
  assert.equal(decode(e.segs)[0]!.length, 2);
  assert.equal(e.warning, 'Skipped 1 point with no usable coordinates.');
});

test('junk in is a warning, never a throw and never an invented line', { skip: SKIP }, async () => {
  const e = await extras({ route: JUNK });
  assert.equal(e.segs, '');
  assert.equal(e.dots, '');
  assert.match(e.warning, /^No route points found/);
  assert.ok(e.html.includes('sm-root'), 'the map still renders');
  assert.ok(e.html.includes(e.warning), 'the notice reaches the canvas');
});

test('no route at all is silent', { skip: SKIP }, async () => {
  for (const route of ['', '   ']) {
    const e = await extras({ route });
    assert.equal(e.warning, '', `route=${JSON.stringify(route)} must not warn`);
    assert.equal(e.points, 0);
  }
});

test('trackpoints with no segment wrapper still draw as one line', { skip: SKIP }, async () => {
  // A truncated export: the opening <trkseg> is there, the closing one is not.
  const e = await extras({
    route: '<gpx><trk><trkseg>\n<trkpt lat="49.45" lon="11.07"/>\n<trkpt lat="49.46" lon="11.08"/>',
  });
  assert.equal(decode(e.segs).length, 1);
  assert.equal(e.warning, '', 'nothing was lost, so nothing is reported');
});

test('a watch-sized track is thinned, keeping both ends', { skip: SKIP }, async () => {
  const n = 5000;
  const pts: string[] = [];
  for (let i = 0; i < n; i++) {
    pts.push(`<trkpt lat="${(49.45 + i * 1e-5).toFixed(5)}" lon="${(11.07 + i * 1e-5).toFixed(5)}"/>`);
  }
  const e = await extras({ route: `<gpx><trk><trkseg>${pts.join('\n')}</trkseg></trk></gpx>` });
  const line = decode(e.segs)[0]!;
  assert.ok(line.length > 100 && line.length <= 1501, `thinned to ${line.length} points`);
  assert.deepEqual(line[0], [11.07, 49.45], 'the start survives thinning');
  assert.deepEqual(line[line.length - 1], [11.11999, 49.49999], 'and so does the finish');
  assert.equal(e.warning, '', 'thinning is not a failure to report');
});

// ── Projection ──────────────────────────────────────────────────────────────

/**
 * The template holds ONE projection. The route line goes through geoPath (the
 * roads' own `path`), the dots and the auto-fit box go through `proj` directly.
 * This runs the tool's own mercatorScale (lifted out of the template source, so
 * it is the shipped maths and not a copy) and checks the two agree.
 */
test('the route projects exactly where the roads do', { skip: SKIP }, async () => {
  const d3src = readFileSync(join(TOOL_DIR, 'lib', 'd3.min.js'), 'utf8');
  const d3: any = {};
  new Function('exports', 'module', d3src)(d3, { exports: d3 });

  const fnSrc = /function mercatorScale\([\s\S]*?\n  \}/.exec(TEMPLATE);
  assert.ok(fnSrc, 'mercatorScale is gone from the template - this test is measuring nothing');
  const mercatorScale = new Function(`${fnSrc![0]}; return mercatorScale;`)() as
    (span: number, w: number, lat: number) => number;
  const span = Number(/var BASE_SPAN_M = (\d+(?:\.\d+)?)/.exec(TEMPLATE)?.[1]);
  assert.ok(Number.isFinite(span), 'BASE_SPAN_M is gone from the template');

  const W = 900;
  const H = 900;
  const center: [number, number] = [11.0767, 49.4521];
  const proj = d3.geoMercator().center(center)
    .scale(mercatorScale(span, W, center[1]))
    .translate([W / 2, H / 2]);
  const path = d3.geoPath(proj);

  const e = await extras({ route: NAMESPACED_CRLF });
  const pts = decode(e.segs)[0]!;
  const d = path({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: pts } });
  const drawn = d.slice(1).split('L').map((p: string) => p.split(',').map(Number));

  assert.equal(drawn.length, pts.length, 'every route point reaches the path');
  pts.forEach((ll, i) => {
    const p = proj(ll);
    // geoPath rounds to 3 decimals; proj() is the same number before rounding.
    assert.equal(drawn[i]![0], Number(p[0].toFixed(3)), `point ${i} x`);
    assert.equal(drawn[i]![1], Number(p[1].toFixed(3)), `point ${i} y`);
  });
});

test('the template holds exactly one projection, and the route uses it', { skip: SKIP }, () => {
  const count = (re: RegExp) => (TEMPLATE.match(re) ?? []).length;
  assert.equal(count(/geoMercator\(/g), 1, 'a second projection would let the route drift off the roads');
  assert.equal(count(/geoPath\(/g), 1);
  assert.equal(count(/function mercatorScale/g), 1);

  const roads = TEMPLATE.indexOf('Roads - one path per weight tier');
  const route = TEMPLATE.indexOf('Route overlay');
  assert.ok(roads > 0 && route > roads, 'the route must be appended after the roads, so it draws above them');
  const block = TEMPLATE.slice(route, route + 1200);
  assert.ok(block.includes(".attr('d', path)"), 'the route line must be drawn by the shared geoPath');
});

/**
 * Markers are chrome, and every stroke on this map is a screen size
 * (non-scaling-stroke). A circle's `r` is NOT: it rides the zoom transform. The
 * template therefore stores each dot's base radius and divides by the live
 * scale. This lifts that pair straight out of the template source and runs it,
 * so the arithmetic is the shipped arithmetic.
 */
test('marker radii are screen sizes, not map sizes', { skip: SKIP }, () => {
  const from = TEMPLATE.indexOf('var dots = [');
  const to = TEMPLATE.indexOf('routeDots.forEach');
  assert.ok(from > 0 && to > from, 'the dot sizing pair is gone from the template');

  type Stub = { attr(k: string, v?: unknown): Stub; _a: Record<string, unknown> };
  const made: Stub[] = [];
  const stub = (): Stub => {
    const _a: Record<string, unknown> = {};
    const s: Stub = { _a, attr(k, v) { _a[k] = v; return s; } };
    return s;
  };
  const gMap = { append: () => { const s = stub(); made.push(s); return s; } };
  const proj = (ll: [number, number]) => [ll[0] * 10, ll[1] * 10];
  const api = new Function('gMap', 'proj', 'routeWidth',
    `${TEMPLATE.slice(from, to)}\nreturn { dot: dot, sizeDots: sizeDots, dots: dots };`,
  )(gMap, proj, 3) as {
    dot(ll: [number, number], r: number, fill: string, stroke?: string): void;
    sizeDots(k: number): void;
    dots: unknown[];
  };

  api.dot([11.07, 49.45], 5.1, '#f00');
  assert.equal(made[0]!._a.r, 5.1, 'an unzoomed dot is its base radius');
  api.sizeDots(8);
  assert.equal(made[0]!._a.r, 5.1 / 8, 'at the top of the zoom range the dot must shrink, not swell');
  api.sizeDots(1);
  assert.equal(made[0]!._a.r, 5.1, 'and come back on reset');

  // A point the projection cannot place must not enter the sizing list either.
  api.dot([Number.NaN, 49.45], 4, '#f00');
  assert.equal(made.length, 1, 'an unprojectable point draws nothing');
  assert.equal(api.dots.length, 1);

  // Wired to the live scale, in the zoom handler itself.
  const zoomAt = TEMPLATE.indexOf("window.d3.zoom().scaleExtent");
  const call = TEMPLATE.indexOf('sizeDots(event.transform.k)');
  assert.ok(call > zoomAt && zoomAt > 0, 'the resize must ride the zoom event, or it only ever runs once');
});

/**
 * Roads default to the brand primary. If the route did too, dropping a GPX on a
 * default map would paint the track in exactly the road colour and the user
 * would see nothing happen. The route is the one colour here that has to
 * contrast rather than conform.
 */
test('a route can never come out the same colour as the roads', { skip: SKIP }, () => {
  const byId = (id: string) => (tool.manifest.inputs as Array<Record<string, unknown>>)
    .find(i => i.id === id) as Record<string, unknown>;
  assert.notEqual(byId('routeColor').default, byId('roadColor').default,
    'same default token means an invisible route on a default map');

  const src = /var PALETTES = (\{[\s\S]*?\n  \});/.exec(TEMPLATE);
  assert.ok(src, 'PALETTES is gone from the template');
  const pal = new Function(`return ${src![1]}`)() as Record<string, Record<string, string>>;
  for (const theme of ['light', 'dark']) {
    assert.ok(pal[theme]!.route, `the ${theme} theme has no route colour to fall back to`);
    assert.notEqual(pal[theme]!.route, pal[theme]!.road, `the ${theme} route colour is the road colour`);
  }
});

test('the route inputs explain themselves briefly, and promise nothing the shell lacks', { skip: SKIP }, () => {
  for (const id of ['route', 'routeColor', 'routeWidth']) {
    const help = String(((tool.manifest.inputs as Array<Record<string, unknown>>)
      .find(i => i.id === id) as Record<string, unknown>).help ?? '');
    assert.ok(help, `${id} has no help`);
    assert.ok(help.length <= 140, `${id} help is ${help.length} chars, too long for a sidebar hint`);
    // A longtext control has no drop handler in the web shell (only asset and
    // file-picker controls do), so the copy must not offer one.
    assert.doesNotMatch(help, /\bdrop\b/i, `${id} help offers a drop target the control does not have`);
  }
});

// ── Auto-fit gating ─────────────────────────────────────────────────────────

test('auto-fit runs on an untouched viewport and never fights an explicit one', { skip: SKIP }, async () => {
  const fitOf = async (state: Record<string, unknown>) => (await extras(state)).fit;

  assert.equal(await fitOf({ route: NAMESPACED_CRLF }), 'yes', 'default viewport + a route fits');
  assert.equal(await fitOf({ route: WPTS_ONLY }), 'yes', 'waypoints alone are still something to frame');
  assert.equal(await fitOf({ route: NAMESPACED_CRLF, view: '2.4,-120.00,88.50' }), 'no',
    'a saved pan or zoom is an explicit user value');
  assert.equal(await fitOf({ route: '' }), 'no', 'no route, nothing to fit');
  assert.equal(await fitOf({ route: JUNK }), 'no', 'an unreadable file must not move the map');
});

test('the auto-fit is applied without writing the view input', { skip: SKIP }, () => {
  const at = TEMPLATE.indexOf('if (!restore && routeFit)');
  assert.ok(at > 0, 'the auto-fit call is gone');
  // It must sit inside the _applying guard that suppresses the commit, i.e.
  // before the svg.call(zoomFn.transform, ...) that applies `restore`.
  const apply = TEMPLATE.indexOf('svg.call(zoomFn.transform, restore)');
  assert.ok(apply > at, 'auto-fit must be chosen before the guarded apply, not committed on its own');
});

// ── Seeds ───────────────────────────────────────────────────────────────────

type Seed = { label: string; values: Record<string, unknown> };

function seeds(): Seed[] {
  const out: Seed[] = [];
  for (const ex of (tool.manifest.examples ?? []) as Array<{ label: string; values: Record<string, unknown> }>) {
    out.push({ label: `example ${ex.label}`, values: ex.values });
  }
  const dir = join(TOOL_DIR, 'templates');
  for (const file of readdirSync(dir).sort()) {
    if (!file.endsWith('.json')) continue;
    const t = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    out.push({ label: `template ${t.id}`, values: t.values });
    for (const p of t.presets ?? []) {
      out.push({ label: `template ${t.id} preset ${p.id}`, values: { ...t.values, ...p.values } });
    }
  }
  return out;
}

test('every example, template and preset seed hydrates', { skip: SKIP }, async () => {
  const ids = new Set((tool.manifest.inputs as Array<{ id: string }>).map(i => i.id));
  const list = seeds();
  assert.ok(list.length >= 5, 'the seed sweep found nothing to check');

  for (const { label, values } of list) {
    for (const key of Object.keys(values)) {
      assert.ok(ids.has(key), `${label} seeds "${key}", which is not an input`);
    }
    const e = await extras(values);
    assert.ok(e.html.includes('sm-root'), `${label} did not render`);
    assert.equal(e.warning, '', `${label} raised a route warning`);
  }
});

test('the shipped GPX example is a loop the map can frame', { skip: SKIP }, async () => {
  const ex = (tool.manifest.examples as Array<{ label: string; values: Record<string, unknown> }>)
    .find(e => typeof e.values.route === 'string' && e.values.route);
  assert.ok(ex, 'the GPX example is gone');
  const e = await extras(ex!.values);
  const pts = decode(e.segs)[0]!;
  assert.equal(pts.length, 8, 'the example is the documented 8-point loop');
  assert.equal(e.fit, 'yes');
  // It ends near where it started (a loop), and it is small enough to sit in
  // one canvas of streets rather than spanning the city.
  const [lon0, lat0] = pts[0]!;
  const [lonN, latN] = pts[pts.length - 1]!;
  assert.ok(Math.abs(lon0 - lonN) < 0.002 && Math.abs(lat0 - latN) < 0.002, 'the example loop closes');
  const lons = pts.map(p => p[0]);
  const lats = pts.map(p => p[1]);
  assert.ok(Math.max(...lons) - Math.min(...lons) < 0.02);
  assert.ok(Math.max(...lats) - Math.min(...lats) < 0.02);
});
