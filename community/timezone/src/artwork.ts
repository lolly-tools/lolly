// SPDX-License-Identifier: MPL-2.0

import {
  atlasCountries,
  geoPath,
  grid,
  layout,
  night,
  projection,
  region,
  sphere,
  wrapText,
} from './geography';
import { esc, mix, num, type State } from './model';

const text = (x: number, y: number, value: any, size: number, fill: string, extra = '') =>
  `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" ${extra}>${esc(value)}</text>`;
function lines(value: string, limit: number) {
  const words = String(value || '').split(/\s+/),
    out: string[] = [];
  let line = '';
  for (const w of words) {
    if (line.length + w.length > limit && line) {
      out.push(line);
      line = w;
    } else line += (line ? ' ' : '') + w;
  }
  if (line) out.push(line);
  return out;
}
export function markers(s: State, project: (p: number[]) => number[] | null, active = -1) {
  const c = s.palette,
    size = num(s.inputs.labelSize, 15),
    taken: number[][] = [];
  let out = '';
  for (const [i, p] of s.places.entries()) {
    if (p.error || p.longitude === null || p.latitude === null) continue;
    const xy = project([p.longitude, p.latitude]);
    if (!xy) continue;
    const [x, y] = xy.map((v) => v / layout(s).unit),
      focused = active === i;
    out += `<g data-place-index="${i}" aria-label="${esc(p.label)}"><circle cx="${x}" cy="${y}" r="${focused ? 19 : 12}" fill="${p.color}" opacity=".16"/><circle cx="${x}" cy="${y}" r="${focused ? 7 : 4.5}" fill="${p.color}" stroke="${c.background}" stroke-width="2"/>`;
    if (s.inputs.showLabels !== false) {
      let ly = y - 15;
      while (taken.some((a) => Math.abs(a[0] - x) < 130 && Math.abs(a[1] - ly) < size * 2.2))
        ly += size * 2.5;
      taken.push([x, ly]);
      const label = lines(p.label, 22)[0] || '',
        width = Math.max(label.length, (p.localTime || '').length) * size * 0.62 + 22,
        goLeft = x > layout(s).map.w / layout(s).unit - width - 22,
        lx = goLeft ? x - width - 12 : x + 12;
      out +=
        `<path d="M${x},${y} L${goLeft ? lx + width : lx},${ly + 9}" stroke="${p.color}" opacity=".65"/><rect x="${lx}" y="${ly - 17}" width="${width}" height="${size * 2.6}" rx="5" fill="${c.background}" opacity=".88"/>` +
        text(lx + 10, ly, label, size, c.ink, 'font-weight="600"') +
        text(
          lx + 10,
          ly + size * 1.3,
          p.localTime || '',
          size - 1,
          p.color,
          `font-family="${esc(c.mono)}"`
        );
    }
    out += '</g>';
  }
  return `<g transform="scale(${layout(s).unit})">${out}</g>`;
}
export function mapSvg(s: State, active = -1) {
  const p = projection(s),
    path = geoPath(p),
    c = s.palette,
    l = layout(s),
    d = (g: any) => path(g) || '';
  const shape = d(sphere);
  let out = `<path d="${shape}" fill="${c.ocean}" stroke="${c.edge}"/>`;
  out += `<path d="${d(atlasCountries)}" fill="${c.land}" stroke="${s.inputs.showBorders === false ? 'none' : s.inputs.theme === 'minimal' ? c.edge : c.ocean}" stroke-width=".6"/>`;
  const seen = new Set<string>();
  for (const place of s.places) {
    if (!place.spread || place.error || seen.has(place.timezone)) continue;
    const r = region(place.timezone);
    if (r) {
      out += `<path d="${d(r)}" fill="${place.color}" opacity="${num(s.inputs.regionOpacity, 0.45)}" stroke="${place.color}" stroke-width=".5"/>`;
      seen.add(place.timezone);
    }
  }
  if (s.inputs.showGrid !== false)
    out += `<path d="${d(grid)}" fill="none" stroke="${c.ink}" opacity=".13" stroke-width=".65"/>`;
  if (s.inputs.showNight !== false && s.instant)
    out += `<path d="${d(night(new Date(s.instant)))}" fill="#030910" opacity=".24"/>`;
  if (s.inputs.showConnections !== false) {
    const coords = s.places
      .filter((p) => !p.error && p.longitude !== null && p.latitude !== null)
      .map((p) => [p.longitude, p.latitude]);
    if (coords.length > 1)
      out += `<path d="${d({ type: 'LineString', coordinates: coords })}" fill="none" stroke="${c.accent}" stroke-width="1.3" stroke-dasharray="4 6" opacity=".6"/>`;
  }
  out += markers(s, (xy) => (d({ type: 'Point', coordinates: xy }) ? p(xy) : null), active);
  return `<svg x="${l.map.x}" y="${l.map.y}" width="${l.map.w}" height="${l.map.h}" viewBox="0 0 ${l.map.w} ${l.map.h}" overflow="hidden" class="tz-vector-map">${out}</svg>`;
}
export function artwork(s: State, active = -1, withMap = true) {
  const l = layout(s),
    c = s.palette,
    u = l.unit,
    pad = l.pad;
  let out = `<svg xmlns="http://www.w3.org/2000/svg" class="tz-artwork" width="${l.w}" height="${l.h}" viewBox="0 0 ${l.w} ${l.h}" role="img" aria-label="${esc(s.inputs.heading || 'World timezone map')}" font-family="${esc(c.body)}"><rect width="${l.w}" height="${l.h}" fill="${c.background}"/>`;
  if (l.showDetails && s.inputs.eyebrow)
    out +=
      `<g data-section="eyebrow"><circle cx="${pad + 4 * u}" cy="${l.eyebrowY - 4 * u}" r="${3 * u}" fill="${c.accent}"/>` +
      text(
        pad + 20 * u,
        l.eyebrowY,
        s.inputs.eyebrow,
        11 * u,
        c.accent,
        `letter-spacing="${2 * u}" font-weight="600"`
      ) +
      '</g>';
  if (l.title.length) {
    out += '<g data-section="heading">';
    l.title.forEach((line, i) => {
      out += text(
        pad,
        l.titleY + i * l.titleSize * 1.08,
        line,
        l.titleSize,
        c.ink,
        `font-family="${esc(c.display)}" font-weight="${num(s.inputs.titleWeight, 500)}" letter-spacing="${-1.6 * u}"`
      );
    });
    out += '</g>';
  }
  if (l.description.length) {
    out += '<g data-section="description">';
    l.description.forEach((line, i) => {
      out += text(pad, l.descriptionY + i * 24 * u, line, 16 * u, c.muted);
    });
    out += '</g>';
  }
  if (l.clock && s.instant) {
    const d = new Date(s.instant),
      zone = s.inputs.referenceZone || 'UTC',
      x = l.w - pad;
    out +=
      '<g data-section="clock">' +
      text(
        x,
        pad + 12 * u,
        s.inputs.timeMode === 'fixed' ? 'SCHEDULED MOMENT' : 'LIVE · NOW',
        10 * u,
        c.muted,
        `text-anchor="end" letter-spacing="${1.5 * u}"`
      ) +
      text(
        x,
        pad + 54 * u,
        new Intl.DateTimeFormat('en-GB', {
          timeZone: zone,
          hour: '2-digit',
          minute: '2-digit',
          hour12: s.inputs.clockStyle === '12',
        }).format(d),
        32 * u,
        c.ink,
        `text-anchor="end" font-family="${esc(c.mono)}"`
      ) +
      text(x, pad + 80 * u, zone, 12 * u, c.accent, 'text-anchor="end"') +
      text(
        x,
        pad + 102 * u,
        new Intl.DateTimeFormat('en-GB', {
          timeZone: zone,
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }).format(d),
        11 * u,
        c.muted,
        'text-anchor="end"'
      ) +
      '</g>';
  }
  if (withMap) out += mapSvg(s, active);
  if (l.rows) {
    out += `<g data-section="locations"><path d="M${pad},${l.cardsY - 7 * u}H${l.w - pad}" stroke="${c.edge}"/>`;
    const cardW = (l.w - pad * 2) / l.cols,
      k = l.cardScale;
    for (const [index, p] of s.places.entries()) {
      const x = pad + (index % l.cols) * cardW,
        y = l.cardsY + Math.floor(index / l.cols) * l.cardH;
      const label = wrapText(p.label, Math.floor((cardW - 25 * k) / (9 * k)), 1)[0];
      out +=
        `<g data-place-index="${index}" aria-label="${esc(p.label)}"><rect x="${x + k}" y="${y}" width="${cardW - 12 * k}" height="${l.cardH - 8 * k}" fill="${active === index ? mix(c.accent, c.background, 0.9) : c.background}" rx="${7 * k}"/><circle cx="${x + 7 * k}" cy="${y + 20 * k}" r="${3.5 * k}" fill="${p.color}"/>` +
        text(x + 20 * k, y + 25 * k, label, 16 * k, c.ink, 'font-weight="600"') +
        text(
          x + 4 * k,
          y + 64 * k,
          p.error ? 'CHECK PLACE' : p.localTime || '—',
          (p.error ? 16 : 32) * k,
          p.color,
          `font-family="${esc(c.mono)}" letter-spacing="${-k}"`
        ) +
        text(
          x + 4 * k,
          y + 87 * k,
          p.error
            ? wrapText(p.error, Math.floor(cardW / (6 * k)), 1)[0]
            : `${p.localDate || ''}  ${p.offset ? 'UTC' + p.offset : ''}${p.dayOffset ? ` · ${p.dayOffset > 0 ? '+' : ''}${p.dayOffset}d` : ''}`,
          11 * k,
          c.muted
        );
      if (p.annotation)
        out += text(
          x + 4 * k,
          y + 110 * k,
          wrapText(p.annotation, Math.floor(cardW / (6 * k)), 1)[0],
          11 * k,
          c.muted,
          'data-section="place-annotation"'
        );
      out += '</g>';
    }
    out += '</g>';
  }
  if (l.footer.length) {
    out += `<g data-section="footer"><path d="M${pad},${l.footerY - 24 * u}H${l.w - pad}" stroke="${c.edge}"/>`;
    l.footer.forEach((line, i) => {
      out += text(pad, l.footerY + i * 20 * u, line, 14 * u, c.ink);
    });
    out += '</g>';
  }
  if (l.attribution)
    out += text(
      pad,
      l.h - 12 * u,
      'Timezone regions © OpenStreetMap contributors · ODbL',
      8 * u,
      c.muted
    );
  if (s.error)
    out +=
      `<rect x="${pad}" y="${l.map.y + 20 * u}" width="${l.map.w}" height="${70 * u}" fill="${c.background}"/>` +
      text(pad + 20 * u, l.map.y + 60 * u, s.error, 18 * u, c.ink);
  return out + '</svg>';
}
