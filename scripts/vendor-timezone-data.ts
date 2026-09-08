// SPDX-License-Identifier: MPL-2.0
/** Regenerate the timezone tool's offline geography from pinned public sources. */

import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { unzipSync } from 'fflate';

const dir = resolve(import.meta.dirname, '../community/timezone/data');
const sources = {
  atlas: 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json',
  countries: 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json',
  zones:
    'https://github.com/evansiroky/timezone-boundary-builder/releases/download/2026c/timezones.geojson.zip',
  centres: 'https://raw.githubusercontent.com/eggert/tz/2026c/zone.tab',
  cities:
    'https://raw.githubusercontent.com/kevinroberts/city-timezones/3b4979521a38d71e0141d7a36f097af9967f0dd8/data/cityMap.json',
};
const provenance: Record<string, { url: string; sha256: string }> = {};
async function get(key: keyof typeof sources) {
  const r = await fetch(sources[key]);
  if (!r.ok) throw new Error(`${r.status}: ${sources[key]}`);
  const b = new Uint8Array(await r.arrayBuffer());
  provenance[key] = { url: sources[key], sha256: createHash('sha256').update(b).digest('hex') };
  return b;
}
// Iterative Douglas–Peucker, preserving ring endpoints. 0.025° is artwork detail,
// not a cadastral boundary; collapsed tiny islands/holes are deliberately omitted.
function simplify(points: number[][]) {
  const keep = new Set([0, points.length - 1]),
    stack: [[number, number]] | Array<[number, number]> = [[0, points.length - 1]],
    eps = 0.025 ** 2;
  while (stack.length) {
    const [a, b] = stack.pop()!,
      p = points[a]!,
      q = points[b]!,
      dx = q[0]! - p[0]!,
      dy = q[1]! - p[1]!,
      den = dx * dx + dy * dy;
    let max = eps,
      index = -1;
    for (let i = a + 1; i < b; i++) {
      const r = points[i]!,
        t = den ? Math.max(0, Math.min(1, ((r[0]! - p[0]!) * dx + (r[1]! - p[1]!) * dy) / den)) : 0,
        d = (r[0]! - p[0]! - dx * t) ** 2 + (r[1]! - p[1]! - dy * t) ** 2;
      if (d > max) {
        max = d;
        index = i;
      }
    }
    if (index >= 0) {
      keep.add(index);
      stack.push([a, index], [index, b]);
    }
  }
  return [...keep].sort((a, b) => a - b).map((i) => points[i]!.map((n) => +n.toFixed(4)));
}
function angle(s: string) {
  const value = s.slice(1),
    deg = value.length % 2 === 0 ? 2 : 3;
  return (
    (s[0] === '-' ? -1 : 1) *
    (+value.slice(0, deg) + +value.slice(deg, deg + 2) / 60 + +(value.slice(deg + 2) || 0) / 3600)
  );
}
await mkdir(dir, { recursive: true });
const [world, archive, tab, cities, atlas] = await Promise.all([
  get('countries'),
  get('zones'),
  get('centres'),
  get('cities'),
  get('atlas'),
]);
const decode = (b: Uint8Array) => new TextDecoder().decode(b);
const zipped = unzipSync(archive),
  raw = JSON.parse(decode(zipped['combined.json']!));
const boundaries = {
  type: 'FeatureCollection',
  features: raw.features.map((f: any) => ({
    type: 'Feature',
    properties: { tzid: f.properties.tzid },
    geometry: {
      type: 'MultiPolygon',
      coordinates: (f.geometry.type === 'Polygon'
        ? [f.geometry.coordinates]
        : f.geometry.coordinates
      )
        .map((p: number[][][]) => p.map(simplify).filter((r) => r.length >= 4))
        .filter((p: number[][][]) => p.length),
    },
  })),
};
const centres: Record<string, number[]> = { UTC: [0, 0] };
for (const line of decode(tab).split('\n')) {
  if (!line || line[0] === '#') continue;
  const [, xy, zone] = line.split('\t'),
    m = xy!.match(/([+-]\d+)([+-]\d+)/)!;
  centres[zone!] = [+angle(m[2]!).toFixed(4), +angle(m[1]!).toFixed(4)];
}
const reduced = JSON.parse(decode(cities))
  .filter((c: any) => c.timezone)
  .map((c: any) => [
    c.city,
    c.city_ascii,
    c.iso2,
    c.province,
    c.timezone,
    +c.lng.toFixed(4),
    +c.lat.toFixed(4),
    c.pop || 0,
  ]);
await Promise.all([
  writeFile(resolve(dir, 'countries-50m.json'), world),
  writeFile(resolve(dir, 'countries-110m.json'), atlas),
  writeFile(resolve(dir, 'zone.tab'), tab),
  writeFile(resolve(dir, 'timezones.json'), JSON.stringify(boundaries)),
  writeFile(resolve(dir, 'places.json'), JSON.stringify(centres)),
  writeFile(resolve(dir, 'cities.json'), JSON.stringify(reduced)),
  writeFile(resolve(dir, 'sources.json'), JSON.stringify(provenance, null, 2) + '\n'),
]);
console.log(
  `Vendored ${boundaries.features.length} timezone regions and ${reduced.length} cities.`
);
