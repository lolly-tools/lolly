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

// ─── City registry ───────────────────────────────────────────────────────────
// center is [lon, lat] (an iconic, dense downtown point); radiusM is the pan
// half-extent in metres. The default framing shows ~700 m / 5 blocks across.
const CITIES = {
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
};

const LIB_DIR   = join(ROOT, 'tools', 'street-map', 'lib');
const ROADS_DIR = join(LIB_DIR, 'roads');
const OVERPASS  = 'https://overpass-api.de/api/interpreter';

// Highway classes we keep, mapped to a render weight tier. Anything not listed
// is dropped (railways, aerialways, etc. would clutter a 5-block street view).
const ROAD_TIERS = {
  motorway: 5, motorway_link: 4, trunk: 5, trunk_link: 4,
  primary: 4, primary_link: 3, secondary: 3, secondary_link: 3,
  tertiary: 2, tertiary_link: 2, unclassified: 2, residential: 2,
  living_street: 1, service: 1, pedestrian: 1, road: 2,
  footway: 0, path: 0, cycleway: 0, steps: 0, track: 0,
};

const round = (n) => Math.round(n * 1e6) / 1e6; // ~0.1 m precision; shrinks files

function bbox(center, radiusM) {
  const [lon, lat] = center;
  const dLat = radiusM / 111320;
  const dLon = radiusM / (111320 * Math.cos((lat * Math.PI) / 180));
  return { s: lat - dLat, w: lon - dLon, n: lat + dLat, e: lon + dLon };
}

function overpassQuery(b) {
  const box = `${b.s},${b.w},${b.n},${b.e}`;
  return `[out:json][timeout:90];
(
  way[highway][!area](${box});
  way[waterway](${box});
  way[natural=water](${box});
);
out geom;`;
}

function cleanCoords(geometry) {
  let coords = geometry.map((p) => [round(p.lon), round(p.lat)]);
  // drop consecutive duplicate vertices
  coords = coords.filter(
    (c, i) => i === 0 || c[0] !== coords[i - 1][0] || c[1] !== coords[i - 1][1]
  );
  return coords;
}

function wayToFeature(el) {
  if (!el.geometry || el.geometry.length < 2) return null;
  const t = el.tags || {};
  const coords = cleanCoords(el.geometry);
  if (coords.length < 2) return null;
  const closed =
    coords.length > 3 &&
    coords[0][0] === coords[coords.length - 1][0] &&
    coords[0][1] === coords[coords.length - 1][1];

  if (t.highway && t.highway in ROAD_TIERS) {
    return {
      type: 'Feature',
      properties: { k: 'road', w: ROAD_TIERS[t.highway] },
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function overpassFetch(b, attempt = 1) {
  const res = await fetch(OVERPASS, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'lolly-street-map/0.1 (brandtools data-prep)',
    },
    body: 'data=' + encodeURIComponent(overpassQuery(b)),
  });
  if (res.ok) return res.json();
  // 429 (rate limit) / 504 (timeout) are transient — back off and retry.
  if ((res.status === 429 || res.status === 504) && attempt <= 3) {
    const wait = 5000 * attempt;
    process.stdout.write(`(HTTP ${res.status}, retry in ${wait / 1000}s) `);
    await sleep(wait);
    return overpassFetch(b, attempt + 1);
  }
  throw new Error(`Overpass HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
}

async function buildCity(key) {
  const city = CITIES[key];
  if (!city) throw new Error(`Unknown city "${key}". Known: ${Object.keys(CITIES).join(', ')}`);
  const b = bbox(city.center, city.radiusM);
  process.stdout.write(`[${key}] querying Overpass… `);
  const json = await overpassFetch(b);
  const features = (json.elements || [])
    .filter((e) => e.type === 'way')
    .map(wayToFeature)
    .filter(Boolean);

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

async function main() {
  const args = process.argv.slice(2);
  const keys = args.length ? args : Object.keys(CITIES);

  const registry = {};
  const failed = [];
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    try {
      registry[k] = await buildCity(k);
    } catch (e) {
      failed.push(k);
      console.log(`[${k}] FAILED — ${e.message} (skipping)`);
    }
    if (i < keys.length - 1) await sleep(1500); // be polite to the public API
  }
  if (!Object.keys(registry).length) throw new Error('No cities built.');

  // Merge into any existing registry so adding one city doesn't drop the rest.
  const citiesFile = join(LIB_DIR, 'cities.json');
  let existing = {};
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
