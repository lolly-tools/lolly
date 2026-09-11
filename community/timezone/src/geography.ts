// SPDX-License-Identifier: MPL-2.0
import {
  geoArea,
  geoCircle,
  geoEqualEarth,
  geoEquirectangular,
  geoGraticule10,
  geoInterpolate,
  geoMercator,
  geoNaturalEarth1,
  geoPath,
  geoProjection,
  geoRotation,
} from 'd3-geo';
import topology from '../data/countries-50m.json';
import atlasTopology from '../data/countries-110m.json';
import timezoneData from '../data/timezones.json';
import { clamp, num, type State, type View, zoneName } from './model';
export const RAD = Math.PI / 180;
function decodeTopology(topo: any) {
  const arcs = topo.arcs.map((arc: number[][]) => {
    let x = 0,
      y = 0;
    return arc.map((p) => {
      x += p[0];
      y += p[1];
      return [
        x * topo.transform.scale[0] + topo.transform.translate[0],
        y * topo.transform.scale[1] + topo.transform.translate[1],
      ];
    });
  });
  const ring = (ids: number[]) =>
    ids.flatMap((id, j) => {
      const a = id < 0 ? [...arcs[~id]].reverse() : arcs[id];
      return j ? a.slice(1) : a;
    });
  return {
    type: 'FeatureCollection',
    features: topo.objects.countries.geometries.map((g: any) => ({
      type: 'Feature',
      properties: g.properties,
      geometry: {
        type: g.type,
        coordinates:
          g.type === 'Polygon' ? g.arcs.map(ring) : g.arcs.map((p: number[][]) => p.map(ring)),
      },
    })),
  };
}
export const countries = /* @__PURE__ */ decodeTopology(topology);
export const atlasCountries = /* @__PURE__ */ decodeTopology(atlasTopology);
export const zones = new Map<string, any>();
for (const f of timezoneData.features) {
  const geo = {
    ...f,
    geometry: {
      ...f.geometry,
      coordinates: f.geometry.coordinates.map((p) =>
        geoArea({ type: 'Polygon', coordinates: p }) > 2 * Math.PI
          ? p.map((r) => r.slice().reverse())
          : p
      ),
    },
  };
  zones.set(f.properties.tzid, geo);
  try {
    zones.set(zoneName(f.properties.tzid), geo);
  } catch {
    /* Runtime ICU may be older than the boundary release. */
  }
}
export function region(zone: string) {
  try {
    return zones.get(zone) || zones.get(zoneName(zone));
  } catch {
    return zones.get(zone);
  }
}
export const sphere: any = { type: 'Sphere' },
  grid = geoGraticule10();
export function wrapText(value: string, limit: number, maxLines = 3) {
  const out: string[] = [];
  let line = '';
  for (const word of String(value || '')
    .trim()
    .split(/\s+/)) {
    if (line && line.length + word.length + 1 > limit) {
      out.push(line);
      line = word;
    } else line += (line ? ' ' : '') + word;
  }
  if (line) out.push(line);
  return out
    .slice(0, maxLines)
    .map((line, i) =>
      line.length > limit || (i === maxLines - 1 && out.length > maxLines)
        ? line.slice(0, Math.max(1, limit - 1)) + '…'
        : line
    );
}
export function layout(s: State) {
  const w = s.width,
    h = s.height;
  // Work at the same typographic scale across output resolutions; the aspect
  // ratio changes the composition, never the selected output size.
  const unit = Math.min(w / 1080, h / 810),
    pad = 32 * unit;
  const showDetails = s.inputs.composition !== 'map';
  const clock =
    showDetails &&
    Boolean(s.inputs.referenceZone || (s.inputs.timeMode === 'fixed' && s.inputs.eventTime));
  const clockW = clock ? 192 * unit : 0;
  const storyW = w - pad * 2 - clockW;
  const titleSize = num(s.inputs.titleSize, 68) * unit;
  const title = wrapText(
    showDetails ? s.inputs.heading : '',
    Math.max(6, Math.floor(storyW / (titleSize * 0.56))),
    2
  );
  const description = wrapText(
    showDetails ? s.inputs.annotation : '',
    Math.floor(storyW / (9 * unit)),
    3
  );
  let cursor = pad;
  const eyebrowY = cursor + 12 * unit;
  if (showDetails && s.inputs.eyebrow) cursor += 34 * unit;
  const titleY = cursor + titleSize * 0.8;
  if (title.length) cursor += title.length * titleSize * 1.08 + 12 * unit;
  const descriptionY = cursor + 14 * unit;
  if (description.length) cursor += description.length * 24 * unit;
  const headerBottom = Math.max(cursor, clock ? pad + 116 * unit : 0);
  const footer = wrapText(
    showDetails ? s.inputs.footer : '',
    Math.floor((w - pad * 2) / (8 * unit)),
    2
  );
  const attribution = s.places.some((p) => p.spread && !p.error && region(p.timezone));
  const footerH = footer.length ? (footer.length * 20 + 22) * unit : 0;
  const hasCards = showDetails && s.places.length > 0;
  const bottom =
    h - (hasCards || footer.length ? pad + footerH + (attribution ? 16 * unit : 0) : 0);
  const cols = Math.min(
    Math.max(1, s.places.length),
    Math.max(1, Math.floor((w - pad * 2) / (240 * unit)))
  );
  const rows = hasCards ? Math.ceil(s.places.length / cols) : 0;
  const detail = s.places.some((p) => p.annotation);
  const naturalCardH = (detail ? 126 : 106) * unit;
  const cardsH = rows
    ? Math.min(rows * naturalCardH, Math.max(0, bottom - headerBottom) * 0.43)
    : 0;
  const cardH = rows ? cardsH / rows : 0;
  const cardScale = rows ? Math.min(unit, cardH / (detail ? 126 : 106)) : unit;
  const hasHeader =
    clock ||
    title.length > 0 ||
    description.length > 0 ||
    (showDetails && Boolean(s.inputs.eyebrow));
  const mapY = hasHeader ? headerBottom + 16 * unit : 0;
  const cardsY = bottom - cardsH;
  return {
    w,
    h,
    unit,
    pad,
    clock,
    showDetails,
    title,
    titleSize,
    titleY,
    eyebrowY,
    description,
    descriptionY,
    footer,
    footerY: bottom + 32 * unit,
    attribution,
    cols,
    rows,
    cardH,
    cardScale,
    cardsY,
    map: {
      x: 0,
      y: mapY,
      w,
      h: Math.max(unit, cardsY - mapY - (rows ? 20 * unit : 0)),
    },
  };
}
// Both renderers use the same framing, including the flattened WebGL endpoint.
export function fitMap(p: any, width: number, height: number, fillWidth: boolean) {
  p.fitSize([width, height], sphere);
  if (fillWidth) {
    const bounds = geoPath(p).bounds(sphere);
    const span = bounds[1][0] - bounds[0][0];
    if (span > 0) p.scale((p.scale() * width) / span);
    const centered = geoPath(p).bounds(sphere),
      t = p.translate();
    p.translate([
      t[0] + width / 2 - (centered[0][0] + centered[1][0]) / 2,
      t[1] + height / 2 - (centered[0][1] + centered[1][1]) / 2,
    ]);
  }
  return p;
}
export function cameraDistance(s: State) {
  return 1 + 1.85 / Math.tan((clamp(num(s.inputs.fov, 40), 20, 80) * RAD) / 2);
}
export function projection(s: State, view = s.view) {
  const l = layout(s),
    v = s.inputs.projection || 'globe';
  let p: any;
  if (v === 'globe') {
    const d = cameraDistance(s),
      raw = (lon: number, lat: number): [number, number] => {
        const z = Math.cos(lat) * Math.cos(lon),
          k = (d - 1) / (d - z);
        return [k * Math.cos(lat) * Math.sin(lon), k * Math.sin(lat)];
      };
    p = geoProjection(raw).clipAngle(Math.acos(1 / d) / RAD - 0.01);
  } else
    p = (
      {
        equalEarth: geoEqualEarth,
        naturalEarth: geoNaturalEarth1,
        equirectangular: geoEquirectangular,
        mercator: geoMercator,
      }[v as 'equalEarth'] || geoEqualEarth
    )();
  p.rotate([-view[0], -view[1], view[2]]).precision(0.3);
  fitMap(p, l.map.w, l.map.h, s.inputs.mapFit !== 'fit');
  p.scale(p.scale() * view[3] * num(s.inputs.mapScale, 1));
  return p;
}
export function night(date: Date) {
  const day = (+date - Date.UTC(date.getUTCFullYear(), 0, 0)) / 86400000,
    decl = 23.44 * Math.sin((2 * Math.PI * (day - 80)) / 365.2422),
    lon = 180 - (date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600) * 15;
  return geoCircle()
    .center([lon > 0 ? lon - 180 : lon + 180, -decl])
    .radius(90)();
}
export function tourView(s: State, t: number): { view: View; unfold: number; active: number } {
  t = ((t % 1) + 1) % 1;
  const v: [number, number, number, number] = [...s.view];
  let unfold = num(s.inputs.unfold, 1),
    active = -1;
  if (s.inputs.motion === 'orbit') v[0] += 360 * t;
  if (s.inputs.motion === 'unfold') unfold = (1 - Math.cos(t * 2 * Math.PI)) / 2;
  if (s.inputs.motion === 'tour') {
    const places = s.places
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => !p.error && p.longitude !== null && p.latitude !== null);
    if (places.length) {
      const n = t * places.length,
        k = Math.floor(n),
        f = n - k,
        a = places[k],
        b = places[(k + 1) % places.length],
        hold = clamp(num(s.inputs.tourHold, 0.35), 0, 0.8),
        u = clamp((f - hold) / (1 - hold), 0, 1),
        e = u * u * (3 - 2 * u),
        xy = geoInterpolate([a.p.longitude!, a.p.latitude!], [b.p.longitude!, b.p.latitude!])(e);
      v[0] = xy[0];
      v[1] = xy[1];
      v[3] = s.view[3] * (1 - 0.15 * Math.sin(Math.PI * e));
      active = u < 0.5 ? a.i : b.i;
    }
  }
  return { view: v, unfold, active };
}
export { geoPath, geoRotation };
