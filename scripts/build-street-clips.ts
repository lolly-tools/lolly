#!/usr/bin/env node
/**
 * build-street-clips.js — offline street-map data prep for the `street-map` tool.
 *
 * Fetches road + water geometry from OpenStreetMap (via the public Overpass API),
 * clips it to a radius around each city centre, converts OSM ways → GeoJSON, and
 * writes one compact clip per city to tools/street-map/lib/roads/<key>.json.
 * Also maintains tools/street-map/lib/cities.json (the name → centre registry the
 * tool's <select> and projection read from).
 *
 * This is the ONLY step that touches the network. The tool itself ships the
 * generated files and runs fully offline — no API at render time.
 *
 *   node scripts/build-street-clips.js                # build every city in CITIES
 *   node scripts/build-street-clips.js nuremberg      # build one (or several)
 *
 * Add a city by extending CITIES below and re-running. center is [lon, lat];
 * radiusM is the half-extent (how far the user can pan from centre, in metres).
 */

import { mkdirSync, writeFileSync, readFileSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

type Point = [number, number];
const pt = (x: number, y: number): Point => [x, y];
const clonePoint = (p: Point): Point => [p[0], p[1]];

interface City {
  label: string;
  center: Point;
  radiusM: number;
}

// ─── City registry ───────────────────────────────────────────────────────────
// center is [lon, lat] (an iconic, dense downtown point); radiusM is the pan
// half-extent in metres. The default framing shows ~700 m / 5 blocks across.
const CITIES: Record<string, City> = {
  // ── Original 15 ──────────────────────────────────────────────────────────
  nuremberg:    { label: 'Nuremberg',     center: [11.0767, 49.4521],    radiusM: 1100 },
  provo:        { label: 'Provo',         center: [-111.6586, 40.2338],  radiusM: 1100 },
  munich:       { label: 'Munich',        center: [11.5755, 48.1374],    radiusM: 1100 },
  berlin:       { label: 'Berlin',        center: [13.4050, 52.5200],    radiusM: 1100 },
  prague:       { label: 'Prague',        center: [14.4209, 50.0875],    radiusM: 1100 },
  london:       { label: 'London',        center: [-0.1276, 51.5072],    radiusM: 1100 },
  paris:        { label: 'Paris',         center: [2.3376, 48.8606],     radiusM: 1100 },
  barcelona:    { label: 'Barcelona',     center: [2.1734, 41.3851],     radiusM: 1100 },
  amsterdam:    { label: 'Amsterdam',     center: [4.8952, 52.3702],     radiusM: 1100 },
  dublin:       { label: 'Dublin',        center: [-6.2603, 53.3498],    radiusM: 1100 },
  newyork:      { label: 'New York',      center: [-73.9857, 40.7484],   radiusM: 1100 },
  sanfrancisco: { label: 'San Francisco', center: [-122.4089, 37.7837],  radiusM: 1100 },
  tokyo:        { label: 'Tokyo',         center: [139.7671, 35.6812],   radiusM: 1100 },
  singapore:    { label: 'Singapore',     center: [103.8519, 1.2897],    radiusM: 1100 },
  sydney:       { label: 'Sydney',        center: [151.2093, -33.8688],  radiusM: 1100 },

  // ── Europe ───────────────────────────────────────────────────────────────
  madrid:       { label: 'Madrid',        center: [-3.7038, 40.4168],    radiusM: 1100 }, // Puerta del Sol
  rome:         { label: 'Rome',          center: [12.4823, 41.8955],    radiusM: 1100 }, // Piazza Venezia
  vienna:       { label: 'Vienna',        center: [16.3725, 48.2085],    radiusM: 1100 }, // Stephansplatz
  lisbon:       { label: 'Lisbon',        center: [-9.1393, 38.7139],    radiusM: 1100 }, // Baixa / Rossio
  copenhagen:   { label: 'Copenhagen',    center: [12.5700, 55.6759],    radiusM: 1100 }, // Rådhuspladsen
  stockholm:    { label: 'Stockholm',     center: [18.0686, 59.3293],    radiusM: 1100 }, // Gamla stan
  oslo:         { label: 'Oslo',          center: [10.7390, 59.9133],    radiusM: 1100 }, // Karl Johans gate
  helsinki:     { label: 'Helsinki',      center: [24.9420, 60.1699],    radiusM: 1100 }, // Senate Square
  warsaw:       { label: 'Warsaw',        center: [21.0122, 52.2297],    radiusM: 1100 }, // Śródmieście
  budapest:     { label: 'Budapest',      center: [19.0536, 47.4972],    radiusM: 1100 }, // Deák Ferenc tér
  athens:       { label: 'Athens',        center: [23.7348, 37.9755],    radiusM: 1100 }, // Syntagma
  brussels:     { label: 'Brussels',      center: [4.3525, 50.8467],     radiusM: 1100 }, // Grand-Place
  zurich:       { label: 'Zurich',        center: [8.5400, 47.3744],     radiusM: 1100 }, // Paradeplatz
  edinburgh:    { label: 'Edinburgh',     center: [-3.1900, 55.9533],    radiusM: 1100 }, // Old Town
  istanbul:     { label: 'Istanbul',      center: [28.9770, 41.0086],    radiusM: 1100 }, // Sultanahmet
  moscow:       { label: 'Moscow',        center: [37.6173, 55.7558],    radiusM: 1100 }, // Red Square

  // ── Americas ─────────────────────────────────────────────────────────────
  washington:   { label: 'Washington, DC',center: [-77.0364, 38.8951],   radiusM: 1100 }, // Downtown
  chicago:      { label: 'Chicago',       center: [-87.6298, 41.8781],   radiusM: 1100 }, // The Loop
  losangeles:   { label: 'Los Angeles',   center: [-118.2437, 34.0522],  radiusM: 1100 }, // Downtown
  toronto:      { label: 'Toronto',       center: [-79.3832, 43.6532],   radiusM: 1100 }, // Downtown
  vancouver:    { label: 'Vancouver',     center: [-123.1207, 49.2827],  radiusM: 1100 }, // Downtown
  mexicocity:   { label: 'Mexico City',   center: [-99.1332, 19.4326],   radiusM: 1100 }, // Zócalo
  buenosaires:  { label: 'Buenos Aires',  center: [-58.3816, -34.6037],  radiusM: 1100 }, // Microcentro
  riodejaneiro: { label: 'Rio de Janeiro',center: [-43.1822, -22.9035],  radiusM: 1100 }, // Centro
  saopaulo:     { label: 'São Paulo',     center: [-46.6388, -23.5475],  radiusM: 1100 }, // Sé

  // ── Asia & Middle East ───────────────────────────────────────────────────
  beijing:      { label: 'Beijing',       center: [116.4074, 39.9087],   radiusM: 1100 }, // Tiananmen
  shanghai:     { label: 'Shanghai',      center: [121.4750, 31.2304],   radiusM: 1100 }, // People's Square
  seoul:        { label: 'Seoul',         center: [126.9780, 37.5665],   radiusM: 1100 }, // City Hall
  bangkok:      { label: 'Bangkok',       center: [100.5333, 13.7460],   radiusM: 1100 }, // Siam
  hongkong:     { label: 'Hong Kong',     center: [114.1577, 22.2820],   radiusM: 1100 }, // Central
  mumbai:       { label: 'Mumbai',        center: [72.8311, 18.9389],    radiusM: 1100 }, // Fort
  delhi:        { label: 'Delhi',         center: [77.2197, 28.6328],    radiusM: 1100 }, // Connaught Place
  dubai:        { label: 'Dubai',         center: [55.2744, 25.1972],    radiusM: 1100 }, // Downtown
  kualalumpur:  { label: 'Kuala Lumpur',  center: [101.6958, 3.1478],    radiusM: 1100 }, // Bukit Bintang

  // ── Africa ───────────────────────────────────────────────────────────────
  cairo:        { label: 'Cairo',         center: [31.2357, 30.0444],    radiusM: 1100 }, // Tahrir
  capetown:     { label: 'Cape Town',     center: [18.4241, -33.9249],   radiusM: 1100 }, // CBD

  // ── Oceania ──────────────────────────────────────────────────────────────
  brisbane:     { label: 'Brisbane',      center: [153.0251, -27.4698],  radiusM: 1100 }, // Queen Street Mall
  noosa:        { label: 'Noosa',         center: [153.0910, -26.3910],  radiusM: 1100 }, // Hastings St / Main Beach
};

const LIB_DIR = join(ROOT, 'tools', 'street-map', 'lib');
const ROADS_DIR = join(LIB_DIR, 'roads');
const OVERPASS = 'https://overpass-api.de/api/interpreter';

// Highway classes we keep, mapped to a render weight tier. Anything not listed
// is dropped (railways, aerialways, etc. would clutter a 5-block street view).
const ROAD_TIERS: Record<string, number> = {
  motorway: 5, motorway_link: 4, trunk: 5, trunk_link: 4,
  primary: 4, primary_link: 3, secondary: 3, secondary_link: 3,
  tertiary: 2, tertiary_link: 2, unclassified: 2, residential: 2,
  living_street: 1, service: 1, pedestrian: 1, road: 2,
  footway: 0, path: 0, cycleway: 0, steps: 0, track: 0,
};

const round = (n: number): number => Math.round(n * 1e6) / 1e6; // ~0.1 m precision; shrinks files

interface BBox {
  s: number;
  w: number;
  n: number;
  e: number;
}

function bbox(center: Point, radiusM: number): BBox {
  const [lon, lat] = center;
  const dLat = radiusM / 111320;
  const dLon = radiusM / (111320 * Math.cos((lat * Math.PI) / 180));
  return { s: lat - dLat, w: lon - dLon, n: lat + dLat, e: lon + dLon };
}

function overpassQuery(b: BBox, bCoast: BBox): string {
  const box = `${b.s},${b.w},${b.n},${b.e}`;
  // Coastline is fetched over a larger box than we clip to, so chains reliably
  // cross the clip boundary instead of dead-ending just inside it (which would
  // leave a dangling endpoint the sea assembler can't close).
  const coastBox = `${bCoast.s},${bCoast.w},${bCoast.n},${bCoast.e}`;
  return `[out:json][timeout:90];
(
  way[highway][!area](${box});
  way[waterway](${box});
  way[natural=water](${box});
  way[natural=coastline](${coastBox});
);
out geom;`;
}

interface OverpassGeometryPoint {
  lat: number;
  lon: number;
}
interface OverpassElement {
  type: string;
  tags?: Record<string, string>;
  geometry?: OverpassGeometryPoint[];
}
interface OverpassResponse {
  elements?: OverpassElement[];
}

function cleanCoords(geometry: OverpassGeometryPoint[]): Point[] {
  const raw = geometry.map((p) => pt(round(p.lon), round(p.lat)));
  // drop consecutive duplicate vertices
  const out: Point[] = [];
  for (const c of raw) {
    const last = out[out.length - 1];
    if (!last || c[0] !== last[0] || c[1] !== last[1]) out.push(c);
  }
  return out;
}

interface RoadFeature {
  type: 'Feature';
  properties: { k: 'road'; w: number };
  geometry: { type: 'LineString'; coordinates: Point[] };
}
interface WaterFeature {
  type: 'Feature';
  properties: { k: 'water' };
  geometry: { type: 'Polygon'; coordinates: Point[][] };
}
interface WaterwayFeature {
  type: 'Feature';
  properties: { k: 'waterway' };
  geometry: { type: 'LineString'; coordinates: Point[] };
}
type ClipFeature = RoadFeature | WaterFeature | WaterwayFeature;

function wayToFeature(el: OverpassElement): ClipFeature | null {
  if (!el.geometry || el.geometry.length < 2) return null;
  const t = el.tags ?? {};
  const coords = cleanCoords(el.geometry);
  if (coords.length < 2) return null;
  const first = coords[0];
  const last = coords[coords.length - 1];
  const closed =
    coords.length > 3 && !!first && !!last &&
    first[0] === last[0] &&
    first[1] === last[1];

  const highway = t.highway;
  const tier = highway ? ROAD_TIERS[highway] : undefined;
  if (tier !== undefined) {
    return {
      type: 'Feature',
      properties: { k: 'road', w: tier },
      geometry: { type: 'LineString', coordinates: coords },
    };
  }
  if (t.natural === 'water' && closed) {
    return {
      type: 'Feature',
      properties: { k: 'water' },
      geometry: { type: 'Polygon', coordinates: [coords] },
    };
  }
  if (t.waterway) {
    return {
      type: 'Feature',
      properties: { k: 'waterway' },
      geometry: { type: 'LineString', coordinates: coords },
    };
  }
  return null;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function overpassFetch(b: BBox, bCoast: BBox, attempt = 1): Promise<OverpassResponse> {
  const res = await fetch(OVERPASS, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'lolly-street-map/0.1 (lolly data-prep)',
    },
    body: 'data=' + encodeURIComponent(overpassQuery(b, bCoast)),
  });
  if (res.ok) return (await res.json()) as OverpassResponse;
  // 429 (rate limit) / 504 (timeout) are transient — back off and retry.
  if ((res.status === 429 || res.status === 504) && attempt <= 3) {
    const wait = 5000 * attempt;
    process.stdout.write(`(HTTP ${res.status}, retry in ${wait / 1000}s) `);
    await sleep(wait);
    return overpassFetch(b, bCoast, attempt + 1);
  }
  throw new Error(`Overpass HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
}

// ─── Coastline → sea polygons ─────────────────────────────────────────────────
// OSM marks the sea edge with open `natural=coastline` ways, directed so that
// LAND is on the left and WATER on the right. To fill the ocean we stitch those
// ways into chains, clip them to the city bbox, then close each chain along the
// bbox edges into a polygon. The closing direction is chosen self-correctingly:
// we sample a point just off the RIGHT of the coast (guaranteed sea by the OSM
// rule) and keep whichever closure actually contains it — so an orientation slip
// can never paint the land instead of the water. All build-time; the tool renders
// the result like any other water fill.

const _key = (p: Point): string => p[0] + ',' + p[1];
const _near = (a: number, b: number): boolean => Math.abs(a - b) < 1e-9;
const _mod = (x: number, n: number): number => ((x % n) + n) % n;
const _lerp = (a: Point, b: Point, t: number): Point => pt(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t);

// Join coastline ways into maximal chains. Only end→start joins, never a reversal
// (reversing a way would flip its land/water side).
function stitchChains(lines: Point[][]): Point[][] {
  const chains: (Point[] | null)[] = lines.map((l) => l.slice());
  for (let merged = true; merged; ) {
    merged = false;
    for (let i = 0; i < chains.length; i++) {
      if (!chains[i]) continue;
      for (let j = 0; j < chains.length; j++) {
        if (i === j) continue;
        const ci = chains[i];
        const cj = chains[j];
        if (!ci || !cj) continue;
        const ciLast = ci[ci.length - 1];
        const cjFirst = cj[0];
        if (ciLast && cjFirst && _key(ciLast) === _key(cjFirst)) {
          chains[i] = ci.concat(cj.slice(1));
          chains[j] = null;
          merged = true;
        }
      }
    }
  }
  return chains.filter((c): c is Point[] => c !== null);
}

// Liang–Barsky: clip param range [t0,t1] of segment p0→p1 to rect R, or null.
function clipSeg(p0: Point, p1: Point, R: BBox): [number, number] | null {
  let t0 = 0, t1 = 1;
  const dx = p1[0] - p0[0], dy = p1[1] - p0[1];
  const edges: [number, number][] = [[-dx, p0[0] - R.w], [dx, R.e - p0[0]], [-dy, p0[1] - R.s], [dy, R.n - p0[1]]];
  for (const [p, q] of edges) {
    if (p === 0) { if (q < 0) return null; continue; }
    const r = q / p;
    if (p < 0) { if (r > t1) return null; if (r > t0) t0 = r; }
    else       { if (r < t0) return null; if (r < t1) t1 = r; }
  }
  return [t0, t1];
}

// Clip a chain to R → inside sub-paths, with the bbox-edge crossing points kept.
function clipChain(pts: Point[], R: BBox): Point[][] {
  const out: Point[][] = [];
  let cur: Point[] | null = null;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i];
    const p1 = pts[i + 1];
    if (!p0 || !p1) continue;
    const c = clipSeg(p0, p1, R);
    if (!c) { cur = null; continue; }
    const A = _lerp(p0, p1, c[0]);
    const B = _lerp(p0, p1, c[1]);
    if (cur === null || c[0] > 0) { cur = [A]; out.push(cur); }
    const last = cur[cur.length - 1];
    if (!last || !_near(last[0], B[0]) || !_near(last[1], B[1])) cur.push(B);
    if (c[1] < 1) cur = null;
  }
  return out.filter((s) => s.length >= 2);
}

const onEdge = (p: Point, R: BBox): boolean =>
  _near(p[0], R.w) || _near(p[0], R.e) || _near(p[1], R.s) || _near(p[1], R.n);

// Clockwise perimeter coordinate in [0,4): top L→R, right N→S, bottom R→L, left S→N.
function perim(p: Point, R: BBox): number {
  if (_near(p[1], R.n)) return (p[0] - R.w) / (R.e - R.w);
  if (_near(p[0], R.e)) return 1 + (R.n - p[1]) / (R.n - R.s);
  if (_near(p[1], R.s)) return 2 + (R.e - p[0]) / (R.e - R.w);
  return 3 + (p[1] - R.s) / (R.n - R.s);
}
function cornerAt(m: number, R: BBox): Point {
  m = _mod(Math.round(m), 4);
  return m === 0 ? pt(R.w, R.n) : m === 1 ? pt(R.e, R.n) : m === 2 ? pt(R.e, R.s) : pt(R.w, R.s);
}

// Bbox corners strictly between two perimeter positions, in travel order.
function cornersBetween(fromPos: number, toPos: number, dir: number, R: BBox): Point[] {
  const span = dir > 0 ? _mod(toPos - fromPos, 4) : _mod(fromPos - toPos, 4);
  const got: [number, Point][] = [];
  for (const m of [1, 2, 3, 4]) {
    const d = dir > 0 ? _mod(m - fromPos, 4) : _mod(fromPos - m, 4);
    if (d > 1e-9 && d < span - 1e-9) got.push([d, cornerAt(m, R)]);
  }
  return got.sort((a, b) => a[0] - b[0]).map((c) => c[1]);
}

function pointInRings(rings: Point[][], point: Point): boolean {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const pi = ring[i];
      const pj = ring[j];
      if (!pi || !pj) continue;
      const [xi, yi] = pi, [xj, yj] = pj;
      if ((yi > point[1]) !== (yj > point[1]) &&
          point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

function assembleSea(coastLines: Point[][], R: BBox): Point[][] {
  // Stitch → clip → keep only sub-paths that cross the bbox (both ends on edge).
  const open: Point[][] = [];
  for (const chain of stitchChains(coastLines)) {
    for (const sub of clipChain(chain, R)) {
      const first = sub[0];
      const last = sub[sub.length - 1];
      if (first && last && onEdge(first, R) && onEdge(last, R)) open.push(sub);
    }
  }
  if (!open.length) return [];

  // A guaranteed-water point: just off the RIGHT side of the coastline segment
  // nearest the bbox centre (right normal of travel (dx,dy) is (dy,−dx), y-up).
  const cx = (R.w + R.e) / 2, cy = (R.s + R.n) / 2;
  const open0 = open[0];
  if (!open0) return []; // unreachable — `open.length` was just checked truthy above
  const seed0 = open0[0];
  const seed1 = open0[1];
  if (!seed0 || !seed1) return []; // unreachable — clipChain only keeps sub-paths of length >= 2
  let seg: [Point, Point] = [seed0, seed1];
  let bestD = Infinity;
  for (const sub of open) {
    for (let i = 0; i + 1 < sub.length; i++) {
      const a = sub[i];
      const b = sub[i + 1];
      if (!a || !b) continue;
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      const d = (mx - cx) ** 2 + (my - cy) ** 2;
      if (d < bestD) { bestD = d; seg = [a, b]; }
    }
  }
  const dx = seg[1][0] - seg[0][0], dy = seg[1][1] - seg[0][1];
  const len = Math.hypot(dx, dy) || 1;
  const eps = (R.e - R.w) * 0.02;
  const midx = (seg[0][0] + seg[1][0]) / 2, midy = (seg[0][1] + seg[1][1]) / 2;
  const waterPt = pt(midx + (dy / len) * eps, midy + (-dx / len) * eps); // right of coast = sea
  const landPt = pt(midx - (dy / len) * eps, midy - (-dx / len) * eps);  // left  of coast = land

  const build = (dir: number): Point[][] => {
    const used = new Array<boolean>(open.length).fill(false);
    const rings: Point[][] = [];
    for (let s = 0; s < open.length; s++) {
      if (used[s]) continue;
      const ring: Point[] = [];
      let ci = s;
      for (let guard = 0; guard <= open.length; guard++) {
        used[ci] = true;
        const chainAtCi = open[ci];
        if (!chainAtCi) break;
        for (const p of chainAtCi) ring.push(p);
        const lastPt = chainAtCi[chainAtCi.length - 1];
        if (!lastPt) break;
        const exitPos = perim(lastPt, R);
        let nx = -1, nd = Infinity;
        for (let j = 0; j < open.length; j++) {
          const chainJ = open[j];
          const jFirst = chainJ?.[0];
          if (!jFirst) continue;
          let d = dir > 0 ? _mod(perim(jFirst, R) - exitPos, 4)
                          : _mod(exitPos - perim(jFirst, R), 4);
          if (d < 1e-9) d = 4; // a near-zero hop means "all the way around" to self
          if (d < nd) { nd = d; nx = j; }
        }
        const nxFirst = nx >= 0 ? open[nx]?.[0] : undefined;
        if (nxFirst) {
          for (const c of cornersBetween(exitPos, perim(nxFirst, R), dir, R)) ring.push(c);
        }
        if (nx === s || nx < 0 || used[nx]) break;
        ci = nx;
      }
      if (ring.length > 2) {
        const first = ring[0];
        if (first) { ring.push(clonePoint(first)); rings.push(ring); }
      }
    }
    return rings;
  };

  // A correct sea fill contains the guaranteed-water point and excludes BOTH the
  // guaranteed-land point and the (land) city centre. The two closures are
  // complementary, so for a clean coast exactly one passes. If neither does (a
  // tangled multi-chain coast, e.g. a city wedged between two rivers), skip the
  // fill — never flood the land. cx/cy (bbox centre) is the city centre.
  const ok = (rings: Point[][]): boolean => rings.length > 0 &&
    pointInRings(rings, waterPt) && !pointInRings(rings, landPt) && !pointInRings(rings, pt(cx, cy));

  const ringsCW = build(1);
  if (ok(ringsCW)) return ringsCW;
  const ringsCCW = build(-1);
  if (ok(ringsCCW)) return ringsCCW;
  return [];
}

interface StreetClipCity {
  label: string;
  center: Point;
  data: string;
}

async function buildCity(key: string): Promise<StreetClipCity> {
  const city = CITIES[key];
  if (!city) throw new Error(`Unknown city "${key}". Known: ${Object.keys(CITIES).join(', ')}`);
  const b = bbox(city.center, city.radiusM);
  const bCoast = bbox(city.center, city.radiusM * 2); // wider net for coastline only
  process.stdout.write(`[${key}] querying Overpass… `);
  const json = await overpassFetch(b, bCoast);
  const elements = (json.elements ?? []).filter((e) => e.type === 'way');
  const features: ClipFeature[] = elements.map(wayToFeature).filter((f): f is ClipFeature => f !== null);

  // Fill the ocean: assemble polygons from natural=coastline ways (open lines,
  // water-on-right). Inland cities return none → no-op. Failures are non-fatal:
  // we just skip the sea fill rather than lose the whole clip.
  const coast = elements
    .filter((e) => e.tags?.natural === 'coastline' && e.geometry && e.geometry.length >= 2)
    .map((e) => cleanCoords(e.geometry ?? []))
    .filter((c) => c.length >= 2);
  if (coast.length) {
    try {
      const rings = assembleSea(coast, b).map((r) => r.map((p) => pt(round(p[0]), round(p[1]))));
      for (const ring of rings) {
        features.push({ type: 'Feature', properties: { k: 'water' }, geometry: { type: 'Polygon', coordinates: [ring] } });
      }
      if (rings.length) process.stdout.write(`(+${rings.length} sea) `);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      process.stdout.write(`(sea skipped: ${message}) `);
    }
  }

  const fc = {
    type: 'FeatureCollection' as const,
    center: city.center,
    bbox: [b.w, b.s, b.e, b.n] as [number, number, number, number],
    features,
  };
  mkdirSync(ROADS_DIR, { recursive: true });
  const file = join(ROADS_DIR, `${key}.json`);
  writeFileSync(file, JSON.stringify(fc));
  const kb = (statSync(file).size / 1024).toFixed(0);
  console.log(`${features.length} features → roads/${key}.json (${kb} KB)`);
  return { label: city.label, center: city.center, data: `roads/${key}.json` };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const keys = args.length ? args : Object.keys(CITIES);

  const registry: Record<string, StreetClipCity> = {};
  const failed: string[] = [];
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (k === undefined) continue;
    try {
      registry[k] = await buildCity(k);
    } catch (e) {
      failed.push(k);
      const message = e instanceof Error ? e.message : String(e);
      console.log(`[${k}] FAILED — ${message} (skipping)`);
    }
    if (i < keys.length - 1) await sleep(1500); // be polite to the public API
  }
  if (!Object.keys(registry).length) throw new Error('No cities built.');

  // Merge into any existing registry so adding one city doesn't drop the rest.
  const citiesFile = join(LIB_DIR, 'cities.json');
  let existing: Record<string, StreetClipCity> = {};
  try {
    existing = JSON.parse(readFileSync(citiesFile, 'utf8')) as Record<string, StreetClipCity>;
  } catch {
    /* first run */
  }
  const merged = { ...existing, ...registry };
  writeFileSync(citiesFile, JSON.stringify(merged, null, 2) + '\n');
  console.log(`cities.json → ${Object.keys(merged).join(', ')}`);
  if (failed.length) console.log(`\n⚠ failed (re-run to retry): ${failed.join(', ')}`);
}

main().catch((e: unknown) => {
  const message = e instanceof Error ? e.message : String(e);
  console.error('\nbuild-street-clips failed:', message);
  process.exit(1);
});
