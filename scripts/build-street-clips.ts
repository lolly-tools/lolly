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
 *   node scripts/build-street-clips.ts                # build every city in CITIES
 *   node scripts/build-street-clips.ts nuremberg      # build one (or several)
 *
 * Add a city by extending CITIES below and re-running. center is [lon, lat];
 * radiusM is the half-extent (how far the user can pan from centre, in metres).
 */

import { mkdirSync, writeFileSync, readFileSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

type Coord = [number, number];
type BBox = { s: number; w: number; n: number; e: number };
type City = { label: string; center: Coord; radiusM: number };
type RegistryEntry = { label: string; center: Coord; data: string };

type OsmPoint = { lon: number; lat: number };
type OsmElement = {
  type: string;
  geometry?: OsmPoint[];
  tags?: Record<string, string>;
};
type OverpassResult = { elements?: OsmElement[] };

type Feature = {
  type: 'Feature';
  properties: { k: string; w?: number };
  geometry:
    | { type: 'LineString'; coordinates: Coord[] }
    | { type: 'Polygon'; coordinates: Coord[][] };
};

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

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

const LIB_DIR   = join(ROOT, 'tools', 'street-map', 'lib');
const ROADS_DIR = join(LIB_DIR, 'roads');
const OVERPASS  = 'https://overpass-api.de/api/interpreter';

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

function bbox(center: Coord, radiusM: number): BBox {
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

function cleanCoords(geometry: OsmPoint[]): Coord[] {
  let coords = geometry.map((p): Coord => [round(p.lon), round(p.lat)]);
  // drop consecutive duplicate vertices
  coords = coords.filter(
    (c, i) => i === 0 || c[0] !== coords[i - 1]![0] || c[1] !== coords[i - 1]![1]
  );
  return coords;
}

function wayToFeature(el: OsmElement): Feature | null {
  if (!el.geometry || el.geometry.length < 2) return null;
  const t = el.tags || {};
  const coords = cleanCoords(el.geometry);
  if (coords.length < 2) return null;
  const closed =
    coords.length > 3 &&
    coords[0]![0] === coords[coords.length - 1]![0] &&
    coords[0]![1] === coords[coords.length - 1]![1];

  if (t.highway && t.highway in ROAD_TIERS) {
    return {
      type: 'Feature',
      properties: { k: 'road', w: ROAD_TIERS[t.highway]! },
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

async function overpassFetch(b: BBox, bCoast: BBox, attempt: number = 1): Promise<OverpassResult> {
  const res = await fetch(OVERPASS, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'lolly-street-map/0.1 (lolly data-prep)',
    },
    body: 'data=' + encodeURIComponent(overpassQuery(b, bCoast)),
  });
  if (res.ok) return res.json() as Promise<OverpassResult>;
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

const _key  = (p: Coord): string => p[0] + ',' + p[1];
const _near = (a: number, b: number): boolean => Math.abs(a - b) < 1e-9;
const _mod  = (x: number, n: number): number => ((x % n) + n) % n;
const _lerp = (a: Coord, b: Coord, t: number): Coord => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

// Join coastline ways into maximal chains. Only end→start joins, never a reversal
// (reversing a way would flip its land/water side).
function stitchChains(lines: Coord[][]): Coord[][] {
  const chains: (Coord[] | null)[] = lines.map((l) => l.slice());
  for (let merged = true; merged; ) {
    merged = false;
    for (let i = 0; i < chains.length; i++) {
      if (!chains[i]) continue;
      for (let j = 0; j < chains.length; j++) {
        if (i === j || !chains[i] || !chains[j]) continue;
        if (_key(chains[i]![chains[i]!.length - 1]!) === _key(chains[j]![0]!)) {
          chains[i] = chains[i]!.concat(chains[j]!.slice(1));
          chains[j] = null;
          merged = true;
        }
      }
    }
  }
  return chains.filter(Boolean) as Coord[][];
}

// Liang–Barsky: clip param range [t0,t1] of segment p0→p1 to rect R, or null.
function clipSeg(p0: Coord, p1: Coord, R: BBox): [number, number] | null {
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
function clipChain(pts: Coord[], R: BBox): Coord[][] {
  const out: Coord[][] = [];
  let cur: Coord[] | null = null;
  for (let i = 0; i < pts.length - 1; i++) {
    const c = clipSeg(pts[i]!, pts[i + 1]!, R);
    if (!c) { cur = null; continue; }
    const A = _lerp(pts[i]!, pts[i + 1]!, c[0]);
    const B = _lerp(pts[i]!, pts[i + 1]!, c[1]);
    if (cur === null || c[0] > 0) { cur = [A]; out.push(cur); }
    const last = cur[cur.length - 1]!;
    if (!_near(last[0], B[0]) || !_near(last[1], B[1])) cur.push(B);
    if (c[1] < 1) cur = null;
  }
  return out.filter((s) => s.length >= 2);
}

const onEdge = (p: Coord, R: BBox): boolean =>
  _near(p[0], R.w) || _near(p[0], R.e) || _near(p[1], R.s) || _near(p[1], R.n);

// Clockwise perimeter coordinate in [0,4): top L→R, right N→S, bottom R→L, left S→N.
function perim(p: Coord, R: BBox): number {
  if (_near(p[1], R.n)) return (p[0] - R.w) / (R.e - R.w);
  if (_near(p[0], R.e)) return 1 + (R.n - p[1]) / (R.n - R.s);
  if (_near(p[1], R.s)) return 2 + (R.e - p[0]) / (R.e - R.w);
  return 3 + (p[1] - R.s) / (R.n - R.s);
}
const cornerAt = (m: number, R: BBox): Coord => {
  m = _mod(Math.round(m), 4);
  return m === 0 ? [R.w, R.n] : m === 1 ? [R.e, R.n] : m === 2 ? [R.e, R.s] : [R.w, R.s];
};

// Bbox corners strictly between two perimeter positions, in travel order.
function cornersBetween(fromPos: number, toPos: number, dir: number, R: BBox): Coord[] {
  const span = dir > 0 ? _mod(toPos - fromPos, 4) : _mod(fromPos - toPos, 4);
  const got: [number, Coord][] = [];
  for (const m of [1, 2, 3, 4]) {
    const d = dir > 0 ? _mod(m - fromPos, 4) : _mod(fromPos - m, 4);
    if (d > 1e-9 && d < span - 1e-9) got.push([d, cornerAt(m, R)]);
  }
  return got.sort((a, b) => a[0] - b[0]).map((c) => c[1]);
}

function pointInRings(rings: Coord[][], pt: Coord): boolean {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i]!, [xj, yj] = ring[j]!;
      if ((yi > pt[1]) !== (yj > pt[1]) &&
          pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

function assembleSea(coastLines: Coord[][], R: BBox): Coord[][] {
  // Stitch → clip → keep only sub-paths that cross the bbox (both ends on edge).
  const open: Coord[][] = [];
  for (const chain of stitchChains(coastLines)) {
    for (const sub of clipChain(chain, R)) {
      if (onEdge(sub[0]!, R) && onEdge(sub[sub.length - 1]!, R)) open.push(sub);
    }
  }
  if (!open.length) return [];

  // A guaranteed-water point: just off the RIGHT side of the coastline segment
  // nearest the bbox centre (right normal of travel (dx,dy) is (dy,−dx), y-up).
  const cx = (R.w + R.e) / 2, cy = (R.s + R.n) / 2;
  let seg: [Coord, Coord] = [open[0]![0]!, open[0]![1]!], bestD = Infinity;
  for (const sub of open) {
    for (let i = 0; i + 1 < sub.length; i++) {
      const mx = (sub[i]![0] + sub[i + 1]![0]) / 2, my = (sub[i]![1] + sub[i + 1]![1]) / 2;
      const d = (mx - cx) ** 2 + (my - cy) ** 2;
      if (d < bestD) { bestD = d; seg = [sub[i]!, sub[i + 1]!]; }
    }
  }
  const dx = seg[1][0] - seg[0][0], dy = seg[1][1] - seg[0][1];
  const len = Math.hypot(dx, dy) || 1;
  const eps = (R.e - R.w) * 0.02;
  const midx = (seg[0][0] + seg[1][0]) / 2, midy = (seg[0][1] + seg[1][1]) / 2;
  const waterPt: Coord = [midx + (dy / len) * eps, midy + (-dx / len) * eps]; // right of coast = sea
  const landPt: Coord  = [midx - (dy / len) * eps, midy - (-dx / len) * eps]; // left  of coast = land

  const build = (dir: number): Coord[][] => {
    const used: boolean[] = new Array(open.length).fill(false);
    const rings: Coord[][] = [];
    for (let s = 0; s < open.length; s++) {
      if (used[s]) continue;
      const ring: Coord[] = [];
      let ci = s;
      for (let guard = 0; guard <= open.length; guard++) {
        used[ci] = true;
        for (const p of open[ci]!) ring.push(p);
        const exitPos = perim(open[ci]![open[ci]!.length - 1]!, R);
        let nx = -1, nd = Infinity;
        for (let j = 0; j < open.length; j++) {
          let d = dir > 0 ? _mod(perim(open[j]![0]!, R) - exitPos, 4)
                          : _mod(exitPos - perim(open[j]![0]!, R), 4);
          if (d < 1e-9) d = 4; // a near-zero hop means "all the way around" to self
          if (d < nd) { nd = d; nx = j; }
        }
        for (const c of cornersBetween(exitPos, perim(open[nx]![0]!, R), dir, R)) ring.push(c);
        if (nx === s || used[nx]) break;
        ci = nx;
      }
      if (ring.length > 2) { ring.push(ring[0]!.slice() as Coord); rings.push(ring); }
    }
    return rings;
  };

  // A correct sea fill contains the guaranteed-water point and excludes BOTH the
  // guaranteed-land point and the (land) city centre. The two closures are
  // complementary, so for a clean coast exactly one passes. If neither does (a
  // tangled multi-chain coast, e.g. a city wedged between two rivers), skip the
  // fill — never flood the land. cx/cy (bbox centre) is the city centre.
  const ok = (rings: Coord[][]): boolean => rings.length > 0 &&
    pointInRings(rings, waterPt) && !pointInRings(rings, landPt) && !pointInRings(rings, [cx, cy]);

  const ringsCW = build(1);
  if (ok(ringsCW)) return ringsCW;
  const ringsCCW = build(-1);
  if (ok(ringsCCW)) return ringsCCW;
  return [];
}

async function buildCity(key: string): Promise<RegistryEntry> {
  const city = CITIES[key];
  if (!city) throw new Error(`Unknown city "${key}". Known: ${Object.keys(CITIES).join(', ')}`);
  const b = bbox(city.center, city.radiusM);
  const bCoast = bbox(city.center, city.radiusM * 2); // wider net for coastline only
  process.stdout.write(`[${key}] querying Overpass… `);
  const json = await overpassFetch(b, bCoast);
  const elements = (json.elements || []).filter((e) => e.type === 'way');
  const features = elements.map(wayToFeature).filter((f): f is Feature => Boolean(f));

  // Fill the ocean: assemble polygons from natural=coastline ways (open lines,
  // water-on-right). Inland cities return none → no-op. Failures are non-fatal:
  // we just skip the sea fill rather than lose the whole clip.
  const coast = elements
    .filter((e) => e.tags && e.tags.natural === 'coastline' && e.geometry && e.geometry.length >= 2)
    .map((e) => cleanCoords(e.geometry!))
    .filter((c) => c.length >= 2);
  if (coast.length) {
    try {
      const rings = assembleSea(coast, b).map((r) => r.map((p): Coord => [round(p[0]), round(p[1])]));
      for (const ring of rings) {
        features.push({ type: 'Feature', properties: { k: 'water' }, geometry: { type: 'Polygon', coordinates: [ring] } });
      }
      if (rings.length) process.stdout.write(`(+${rings.length} sea) `);
    } catch (e) {
      process.stdout.write(`(sea skipped: ${(e as Error).message}) `);
    }
  }

  const fc = {
    type: 'FeatureCollection',
    center: city.center,
    bbox: [b.w, b.s, b.e, b.n],
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

  const registry: Record<string, RegistryEntry> = {};
  const failed: string[] = [];
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i]!;
    try {
      registry[k] = await buildCity(k);
    } catch (e) {
      failed.push(k);
      console.log(`[${k}] FAILED — ${(e as Error).message} (skipping)`);
    }
    if (i < keys.length - 1) await sleep(1500); // be polite to the public API
  }
  if (!Object.keys(registry).length) throw new Error('No cities built.');

  // Merge into any existing registry so adding one city doesn't drop the rest.
  const citiesFile = join(LIB_DIR, 'cities.json');
  let existing: Record<string, RegistryEntry> = {};
  try {
    existing = JSON.parse(readFileSync(citiesFile, 'utf8'));
  } catch (_) {
    /* first run */
  }
  const merged = { ...existing, ...registry };
  writeFileSync(citiesFile, JSON.stringify(merged, null, 2) + '\n');
  console.log(`cities.json → ${Object.keys(merged).join(', ')}`);
  if (failed.length) console.log(`\n⚠ failed (re-run to retry): ${failed.join(', ')}`);
}

main().catch((e) => {
  console.error('\nbuild-street-clips failed:', e.message);
  process.exit(1);
});
