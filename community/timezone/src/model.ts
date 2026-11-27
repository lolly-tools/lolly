// SPDX-License-Identifier: MPL-2.0

import cityData from '../data/cities.json';
import centres from '../data/places.json';
export type Inputs = Record<string, any>;
export type View = [number, number, number, number];
export interface Place {
  label: string;
  place: string;
  timezone: string;
  annotation: string;
  color: string;
  spread: boolean;
  longitude: number | null;
  latitude: number | null;
  error?: string;
  localTime?: string;
  localDate?: string;
  offset?: string;
  offsetMinutes?: number;
  localISO?: string;
  dayOffset?: number;
  /** How sociable the local hour is: night is before 06:00 or from 22:00, edge is
   *  before 08:00 or from 20:00. The rule Meeting Planner drew its times by. */
  hourQuality?: 'ok' | 'edge' | 'night';
}
export interface Palette {
  background: string;
  ink: string;
  /** What background and ink are while their overrides are left empty (the theme's own). */
  auto: { background: string; ink: string };
  muted: string;
  accent: string;
  land: string;
  ocean: string;
  edge: string;
  colors: string[];
  body: string;
  display: string;
  mono: string;
  /** The design system's own warning colours for a marked hour, where the theme reads them. */
  alert?: { night: string; edge: string };
}
/** The reveal's timing in ms, from the design system's motion tokens. */
export interface Reveal {
  /** What deals in: the cards of the times table, or the pins when there is no table. */
  target: 'cards' | 'pins';
  unitMs: number;
  staggerMs: number;
  ease: string;
  clipMs: number;
}
export interface State {
  inputs: Inputs;
  instant: string | null;
  error: string;
  places: Place[];
  palette: Palette;
  view: View;
  width: number;
  height: number;
  /** Set while the motion is the reveal and there is a place to deal in. */
  reveal?: Reveal;
}
export const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
export const num = (v: any, f: number) => (v !== '' && v != null && Number.isFinite(+v) ? +v : f);
export const esc = (s: any) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
  );
export const safeJson = (v: any) => JSON.stringify(v).replace(/</g, '\\u003c');
const norm = (v: any) =>
  String(v ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[_-]/g, ' ')
    .trim();
const canonical = new Map<string, string>();
export function zoneName(z: string): string {
  if (canonical.has(z)) return canonical.get(z)!;
  const value = new Intl.DateTimeFormat('en', { timeZone: z }).resolvedOptions().timeZone;
  canonical.set(z, value);
  return value;
}
export function parts(date: Date, zone: string) {
  return Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value])
  );
}
export function offsetMinutes(date: Date, zone: string) {
  const p = parts(date, zone);
  return Math.round(
    (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) -
      Math.floor(date.getTime() / 1000) * 1000) /
      60000
  );
}
export function wallTime(value: string, zone: string, ambiguity: string): Date {
  zoneName(zone);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value))
    throw new Error('Choose a scheduled date and time.');
  const input = value.length === 16 ? value + ':00' : value,
    naive = new Date(input + 'Z');
  if (!Number.isFinite(+naive) || naive.toISOString().slice(0, 19) !== input)
    throw new Error('The scheduled date is invalid.');
  const offsets = new Set<number>();
  for (let h = -36; h <= 36; h += 6)
    offsets.add(offsetMinutes(new Date(+naive + h * 3600000), zone));
  const matches = [...offsets]
    .map((o) => new Date(+naive - o * 60000))
    .filter((d) => {
      const p = parts(d, zone);
      return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}` === input;
    })
    .sort((a, b) => +a - +b);
  if (!matches.length)
    throw new Error(
      `This local time does not exist in ${zone} because the clock moves forward. Choose another time.`
    );
  return matches[ambiguity === 'later' ? matches.length - 1 : 0];
}
const countryNames = new Intl.DisplayNames(['en'], { type: 'region' });
let cityIndex: Map<string, any[]> | null = null;
function cities() {
  if (!cityIndex) {
    cityIndex = new Map();
    for (const c of cityData) {
      for (const k of new Set([norm(c[0]), norm(c[1])]))
        cityIndex.set(k, [...(cityIndex.get(k) || []), c]);
    }
    // English spelling of the existing offline Nürnberg record.
    cityIndex.set('nuremberg', cityIndex.get('nurnberg') || []);
    // Queensland place-names register, population centre 24497 (Noosa Heads).
    // Kept outside generated cityData so upstream refreshes retain this addition.
    const noosa = ['Noosa', 'Noosa Heads', 'AU', 'Queensland', 'Australia/Brisbane', 153.09139, -26.38694, 0];
    cityIndex.set('noosa', [noosa]);
    cityIndex.set('noosa heads', [noosa]);
  }
  return cityIndex;
}
export function resolvePlace(row: Inputs, index: number, colors: string[]): Place {
  const place = String(row.place || '').trim(),
    override = String(row.timezone || '').trim();
  const out: Place = {
    label: String(row.label || place.split(',')[0] || row.timezone || `Place ${index + 1}`).trim(),
    place,
    timezone: override,
    annotation: String(row.annotation || '').trim(),
    color: hex(row.color) || colors[index % colors.length],
    // Compact legacy block URLs carry scalar fields as strings.
    spread: row.spread === true || row.spread === 'true',
    longitude: null,
    latitude: null,
  };
  try {
    let zone = override,
      xy: number[] | undefined;
    if (place.includes('/') || place === 'UTC') {
      zone = zone || place;
      xy = (centres as any)[place];
    } else if (place) {
      const [name, ...rest] = place.split(',').map(norm);
      let matches = cities().get(name) || [];
      if (rest.length)
        matches = matches.filter((c) => rest.every((r) => [norm(c[2]), norm(c[3]),
          norm(countryNames.of(c[2]))].includes(r)));
      // A zone override is an explicit disambiguator too.
      if (override)
        matches = matches.filter((c) => {
          try {
            return zoneName(c[4]) === zoneName(override);
          } catch {
            return false;
          }
        });
      // A name shared by a large city and small ones means the large one: London is
      // London, GB without the country, as a map search would answer. Ten times the
      // next largest in another zone is the bar; closer than that still asks.
      const ranked = [...matches].sort((a, b) => +b[7] - +a[7]);
      const rival = ranked.find((c) => c[4] !== ranked[0]?.[4]);
      if (ranked[0] && rival && +ranked[0][7] >= 10 * Math.max(1, +rival[7]))
        matches = matches.filter((c) => c[4] === ranked[0][4]);
      const zones = new Set(matches.map((c) => c[4]));
      if (zones.size > 1)
        throw new Error(
          `“${place}” matches several timezones. Add a country / province, or specify the timezone.`
        );
      const c = matches.sort((a, b) => +b[7] - +a[7])[0];
      if (c) {
        zone = zone || c[4];
        xy = [+c[5], +c[6]];
      } else if (!zone) {
        const z = Object.keys(centres).find((k) => norm(k.split('/').pop()) === norm(place));
        if (z) {
          zone = z;
          xy = (centres as any)[z];
        }
      }
    }
    if (!zone)
      throw new Error(
        `Place not found: ${place || 'enter a city or IANA timezone'}. You can supply a timezone and coordinates.`
      );
    zoneName(zone);
    out.timezone = zone;
    xy =
      xy ||
      (centres as any)[zone] ||
      (Object.entries(centres).find(([z]) => {
        try {
          return zoneName(z) === zoneName(zone);
        } catch {
          return false;
        }
      })?.[1] as number[] | undefined);
    const hasLon = String(row.longitude ?? '').trim() !== '',
      hasLat = String(row.latitude ?? '').trim() !== '';
    if (hasLon !== hasLat) throw new Error('Supply both longitude and latitude.');
    if (hasLon) {
      const lon = +row.longitude,
        lat = +row.latitude;
      if (
        !Number.isFinite(lon) ||
        !Number.isFinite(lat) ||
        Math.abs(lon) > 180 ||
        Math.abs(lat) > 90
      )
        throw new Error('Coordinates must be longitude −180…180 and latitude −90…90.');
      xy = [lon, lat];
    }
    if (xy && zone !== 'UTC') {
      out.longitude = xy[0];
      out.latitude = xy[1];
    }
    if (hasLon && xy) {
      out.longitude = xy[0];
      out.latitude = xy[1];
    }
  } catch (e) {
    out.error = e instanceof Error ? e.message : String(e);
  }
  return out;
}
export function hex(v: any): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (/^#?[a-f\d]{6}$/i.test(s)) return '#' + s.replace('#', '');
  if (/^#[a-f\d]{3}$/i.test(s))
    return (
      '#' +
      s
        .slice(1)
        .split('')
        .map((c) => c + c)
        .join('')
    );
  return null;
}
export function mix(a: string, b: string, t: number) {
  const aa = hex(a) || '#000000',
    bb = hex(b) || '#ffffff';
  return (
    '#' +
    [1, 3, 5]
      .map((i) =>
        Math.round(
          parseInt(aa.slice(i, i + 2), 16) * (1 - t) + parseInt(bb.slice(i, i + 2), 16) * t
        )
          .toString(16)
          .padStart(2, '0')
      )
      .join('')
  );
}
export function font(v: any, fallback: string) {
  const s = (Array.isArray(v) ? v : [v])
    .filter((x) => typeof x === 'string')
    .join(',')
    .replace(/[;{}<>\\]/g, '')
    .trim();
  return s || fallback;
}
const DARK_INK = '#132629',
  LIGHT_INK = '#f3f4ee';
/** WCAG contrast between two hex colours. */
export function contrast(a: string, b: string) {
  const lum = (c: string) =>
    [1, 3, 5].reduce((n, i, j) => {
      const v = parseInt(c.slice(i, i + 2), 16) / 255;
      return n + (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4) * [0.2126, 0.7152, 0.0722][j];
    }, 0);
  const la = lum(a),
    lb = lum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
/** A duration token as ms, or 0 when the system has none. */
function durationMs(v: any): number {
  let n = 0,
    unit = 'ms';
  if (typeof v === 'number') n = v;
  else if (typeof v === 'string') {
    const m = /^\s*(\d+(?:\.\d+)?|\.\d+)\s*(ms|s)\s*$/i.exec(v);
    if (m) {
      n = +m[1];
      unit = m[2].toLowerCase();
    }
  } else if (v && typeof v.value === 'number') {
    n = v.value;
    unit = v.unit === 's' ? 's' : 'ms';
  }
  return n > 0 ? Math.min(4000, unit === 's' ? n * 1000 : n) : 0;
}
/** A curve token as a CSS easing, or '' when the system has none. */
function curveCss(value: any): string {
  const v = Array.isArray(value?.timingFunction) ? value.timingFunction : value;
  if (!Array.isArray(v) || v.length !== 4 || v.some((n) => typeof n !== 'number' || !Number.isFinite(n)))
    return '';
  if (v[0] < 0 || v[0] > 1 || v[2] < 0 || v[2] > 1) return '';
  return 'cubic-bezier(' + v.map((n) => Math.round(n * 1000) / 1000).join(',') + ')';
}
/** The reveal for this document, or undefined when nothing would deal in. The rows
 *  take about a second between them however many there are, and the finished picture
 *  then holds long enough to find a city in: two seconds at least. */
export async function revealOf(host: any, inputs: Inputs, places: Place[]): Promise<Reveal | undefined> {
  if (inputs.motion !== 'reveal') return undefined;
  const cards = inputs.composition !== 'map' && places.length > 0;
  const count = cards
    ? places.length
    : places.filter((p) => !p.error && p.longitude !== null && p.latitude !== null).length;
  if (!count) return undefined;
  const read = async (ref: string) => {
    try {
      return host?.tokens ? await host.tokens.resolve(ref) : null;
    } catch {
      return null;
    }
  };
  const unitMs = Math.round(durationMs(await read('{motion.duration.medium}')) || 400),
    ease = curveCss(await read('{motion.curve.emphasised}')) || 'cubic-bezier(0.05,0.7,0.1,1)',
    staggerMs = count > 1 ? Math.min(120, Math.floor(600 / (count - 1))) : 0,
    // The last time label starts half a unit after its row and takes a unit to arrive.
    end = (count - 1) * staggerMs + Math.round(unitMs * 1.5);
  return {
    target: cards ? 'cards' : 'pins',
    unitMs,
    staggerMs,
    ease,
    clipMs: end + clamp(count * 500, 2000, 6000),
  };
}
/** The mark that keeps one part's entrance: its keyframes, length, curve and start.
 *  Empty unless the document's motion is the reveal, so every other picture is unchanged. */
export function motionMark(s: State, name: 'tz-deal' | 'tz-settle', index: number): string {
  const r = s.reveal;
  if (!r) return '';
  const at = index * r.staggerMs + (name === 'tz-settle' ? Math.round(r.unitMs / 2) : 0);
  return ` data-svg-motion="${name} ${r.unitMs}ms ${r.ease} ${at}ms"`;
}
export async function brand(host: any, inputs: Inputs): Promise<Palette> {
  const tokens = host?.tokens;
  const resolve = async (path: string) => {
    try {
      return tokens ? await tokens.resolve('{' + path + '}') : null;
    } catch {
      return null;
    }
  };
  const bold = inputs.theme === 'brand';
  // Only the design system theme reads these, so the other themes ask for nothing new.
  const [surfaceToken, textToken, alertInk, alertTint] = bold
    ? await Promise.all([
        resolve('color.semantic.surface'),
        resolve('color.semantic.text'),
        resolve('color.role.alert-ink'),
        resolve('color.role.alert-tint'),
      ])
    : [null, null, null, null];
  const [primary, secondary, body, display, mono, swatches] = await Promise.all([
    resolve('color.semantic.primary'),
    resolve('color.semantic.secondary'),
    resolve('font.brand'),
    resolve('font.display'),
    resolve('font.mono'),
    tokens?.colors?.().catch(() => []) || [],
  ]);
  const toHex = (v: any) => {
    if (hex(v)) return hex(v);
    try {
      return hex(host?.color?.mix(v, v, 0));
    } catch {
      return null;
    }
  };
  const anchor = toHex(inputs.accent) || toHex(primary) || '#8bb6ac';
  // The design system theme draws on the system's own surface. An override or that
  // surface decides whether the picture is a light one; with neither, the theme keeps
  // the dark ground it always mixed from the accent.
  const surface = bold ? toHex(surfaceToken) : null,
    ground = bold ? hex(inputs.background) || surface : null;
  const light = ground
    ? contrast(ground, DARK_INK) > contrast(ground, LIGHT_INK)
    : inputs.theme === 'paper' || inputs.theme === 'minimal';
  // The system's text colour where it reads on the ground, else the plainer of the two inks.
  const readable = (on: string) => {
    const text = toHex(textToken);
    if (text && contrast(text, on) >= 4.5) return text;
    return contrast(on, DARK_INK) > contrast(on, LIGHT_INK) ? DARK_INK : LIGHT_INK;
  };
  const luminance = (c: string) =>
    [1, 3, 5].reduce(
      (n, i, j) => n + (parseInt(c.slice(i, i + 2), 16) / 255) * [0.2126, 0.7152, 0.0722][j],
      0
    );
  const visible = (c: string) =>
    light
      ? luminance(c) > 0.72
        ? mix(c, '#172022', 0.4)
        : c
      : luminance(c) < 0.4
        ? mix(c, '#ffffff', 0.56)
        : c;
  const accent = visible(anchor);
  const colors = [
    accent,
    toHex(secondary),
    ...(swatches || [])
      .filter((s: any) => /spectrum|brand|primary|secondary/i.test(s.path))
      .map((s: any) => toHex(s.value)),
  ]
    .filter((c, i, a) => c && a.indexOf(c) === i)
    .map((c) => visible(c!)) as string[];
  if (colors.length < 3) colors.push(mix(accent, '#ffffff', 0.3), mix(accent, '#657f9f', 0.5));
  const autoBackground = bold
    ? surface || mix(accent, '#10151c', 0.42)
    : light
      ? mix(accent, '#ffffff', 0.96)
      : mix(accent, '#050c13', 0.93);
  const background = hex(inputs.background) || autoBackground;
  const auto = {
    background: autoBackground,
    ink: bold ? readable(background) : light ? DARK_INK : LIGHT_INK,
  };
  const ink = hex(inputs.ink) || auto.ink;
  // A marked hour is large type, so 3:1 against the ground is the bar. The fill that
  // warns is the milder mark where it reads, else the warning ink softened with the text.
  const night = toHex(alertInk),
    tint = toHex(alertTint);
  const alert =
    night && contrast(night, background) >= 3
      ? {
          night,
          edge:
            tint && tint !== night && contrast(tint, background) >= 3 ? tint : mix(night, ink, 0.5),
        }
      : undefined;
  return {
    ...(alert ? { alert } : {}),
    accent,
    background,
    ink,
    auto,
    muted: mix(ink, background, 0.2),
    land: inputs.theme === 'minimal' ? background : mix(accent, background, light ? 0.5 : 0.3),
    ocean: mix(accent, background, 0.94),
    edge: mix(ink, background, 0.55),
    colors,
    body: font(body, 'sans-serif'),
    display: font(display || body, 'sans-serif'),
    mono: font(mono || body, 'sans-serif'),
  };
}
export function viewOf(v: any): View {
  const p = String(v || '15,22,0,1').split(',');
  return [num(p[0], 15), clamp(num(p[1], 22), -89, 89), num(p[2], 0), clamp(num(p[3], 1), 0.4, 4)];
}
export function updateTimes(state: State, instant: Date) {
  state.instant = instant.toISOString();
  const ref = parts(instant, state.inputs.referenceZone || 'UTC');
  const refDay = Date.UTC(+ref.year, +ref.month - 1, +ref.day);
  for (const p of state.places) {
    if (p.error) continue;
    const s = parts(instant, p.timezone),
      off = offsetMinutes(instant, p.timezone),
      sign = off < 0 ? '-' : '+';
    p.offsetMinutes = off;
    p.offset =
      sign +
      String(Math.floor(Math.abs(off) / 60)).padStart(2, '0') +
      ':' +
      String(Math.abs(off) % 60).padStart(2, '0');
    p.localISO = `${s.year}-${s.month}-${s.day}T${s.hour}:${s.minute}:${s.second}${p.offset}`;
    p.localTime = new Intl.DateTimeFormat('en-GB', {
      timeZone: p.timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: state.inputs.clockStyle === '12',
    }).format(instant);
    p.localDate = new Intl.DateTimeFormat('en-GB', {
      timeZone: p.timezone,
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }).format(instant);
    const hour = +s.hour;
    p.hourQuality = hour < 6 || hour >= 22 ? 'night' : hour < 8 || hour >= 20 ? 'edge' : 'ok';
    p.dayOffset = Math.round((Date.UTC(+s.year, +s.month - 1, +s.day) - refDay) / 86400000);
  }
}
/** The reference clock as an IANA zone. A city is accepted too ("Nuremberg",
 *  "London, GB") and read from the offline list, as a row's place is; anything that
 *  is not found is passed on, and the zone check reports the error. */
export function referenceZoneOf(value: string): string {
  if (!value || value === 'UTC' || value.includes('/')) return value;
  const found = resolvePlace({ place: value }, 0, ['#000000']);
  return found.error || !found.timezone ? value : found.timezone;
}
/** The colour a place's time is drawn in: the place's own, or amber and red for an
 *  early, late or night hour when the document asks for that mark. */
export function timeColor(s: State, p: Place): string {
  if (s.inputs.showHourQuality !== true && s.inputs.showHourQuality !== 'true') return p.color;
  const alert = s.palette.alert;
  return p.hourQuality === 'night'
    ? alert?.night || '#ef4444'
    : p.hourQuality === 'edge'
      ? alert?.edge || '#f59e0b'
      : p.color;
}
/** The same mark in words, for a reader who cannot tell the colours apart. */
export function hourWord(s: State, p: Place): string {
  if (s.inputs.showHourQuality !== true && s.inputs.showHourQuality !== 'true') return '';
  const hour = +(p.localISO || '').slice(11, 13);
  if (p.hourQuality === 'night') return 'night';
  if (p.hourQuality === 'edge') return hour < 12 ? 'early' : 'late';
  return '';
}
export async function makeState(inputs: Inputs, host: any, now = new Date()): Promise<State> {
  inputs = { ...inputs };
  for (const key of ['heading', 'eyebrow', 'annotation', 'footer', 'referenceZone'])
    inputs[key] = String(inputs[key] || '').trim();
  inputs.referenceZone = referenceZoneOf(inputs.referenceZone);
  const palette = await brand(host, inputs);
  const state: State = {
    inputs,
    instant: null,
    error: '',
    palette,
    places: (Array.isArray(inputs.locations) ? inputs.locations : [])
      .filter(
        (p: any) =>
          p &&
          ['label', 'place', 'timezone', 'annotation', 'longitude', 'latitude'].some(
            (key) => String(p[key] ?? '').trim() !== ''
          )
      )
      .map((p: any, i: number) => resolvePlace(p, i, palette.colors)),
    view: viewOf(inputs.view),
    width: Math.max(1, num(inputs.width, 1440)),
    height: Math.max(1, num(inputs.height, 1080)),
  };
  const reveal = await revealOf(host, inputs, state.places);
  if (reveal) state.reveal = reveal;
  try {
    zoneName(inputs.referenceZone || 'UTC');
    updateTimes(
      state,
      inputs.timeMode === 'fixed'
        ? wallTime(inputs.eventTime || '', inputs.referenceZone || 'UTC', inputs.ambiguity)
        : now
    );
  } catch (e) {
    state.error = e instanceof Error ? e.message : String(e);
  }
  return state;
}
export function dataDocument(s: State) {
  return {
    schemaVersion: 1,
    title: s.inputs.heading || '',
    annotation: s.inputs.annotation || '',
    footer: s.inputs.footer || '',
    timeMode: s.inputs.timeMode,
    instant: s.instant,
    referenceTimezone: s.inputs.referenceZone || 'UTC',
    durationMinutes: num(s.inputs.eventMinutes, 60),
    error: s.error || null,
    locations: s.places.map((p) => ({ ...p, error: p.error || null })),
  };
}
export const csvCell = (s: any) => '"' + String(s ?? '').replace(/"/g, '""') + '"';
export function dataCsv(s: State) {
  const fields = [
    'label',
    'place',
    'timezone',
    'annotation',
    'color',
    'longitude',
    'latitude',
    'localISO',
    'localTime',
    'localDate',
    'offsetMinutes',
    'dayOffset',
    'error',
  ];
  return [
    ['title', 'instant', 'referenceTimezone', 'description', 'footer', ...fields].join(','),
    ...s.places.map((p) =>
      [
        s.inputs.heading,
        s.instant,
        s.inputs.referenceZone,
        s.inputs.annotation,
        s.inputs.footer,
        ...fields.map((k) => (p as any)[k]),
      ]
        .map(csvCell)
        .join(',')
    ),
  ].join('\r\n');
}
const md = (v: any) =>
  String(v ?? '')
    .replace(/[\\`*_{}[\]<>|]/g, '\\$&')
    .replace(/\r?\n/g, ' / ');
export function dataMarkdown(s: State) {
  return (
    [
      s.inputs.heading && `# ${md(s.inputs.heading)}`,
      s.inputs.eyebrow && md(s.inputs.eyebrow),
      s.inputs.annotation && md(s.inputs.annotation),
      s.instant || s.error,
      s.inputs.referenceZone && `Reference timezone: ${md(s.inputs.referenceZone)}`,
      s.places.length
        ? `| Label | Place | Local date & time | Timezone | Annotation |\n| --- | --- | --- | --- | --- |\n${s.places.map((p) => `| ${[p.label, p.place, p.error || p.localISO, p.timezone, p.annotation].map(md).join(' | ')} |`).join('\n')}`
        : '',
      s.inputs.footer && md(s.inputs.footer),
    ]
      .filter(Boolean)
      .join('\n\n') + '\n'
  );
}
const icsText = (v: any) =>
  String(v ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
export function dataIcs(s: State) {
  if (!s.instant || s.error || s.places.some((p) => p.error)) return '';
  const stamp = (v: Date) => v.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const start = new Date(s.instant),
    description = [
      s.inputs.annotation,
      ...s.places.map((p) => `${p.label}: ${p.localISO} [${p.timezone}] ${p.annotation}`),
      s.inputs.footer,
    ].join('\n');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Lolly//Timezone//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${stamp(start)}-${Array.from(String(s.inputs.heading)).reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 0)}@timezone.lolly.tools`,
    `DTSTAMP:${stamp(start)}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(new Date(+start + num(s.inputs.eventMinutes, 60) * 60000))}`,
    `SUMMARY:${icsText(s.inputs.heading)}`,
    `DESCRIPTION:${icsText(description)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return (
    lines
      .map((line) => {
        let out = '',
          bytes = 0;
        for (const c of line) {
          const n = new TextEncoder().encode(c).length;
          if (bytes + n > 75) {
            out += '\r\n ';
            bytes = 1;
          }
          out += c;
          bytes += n;
        }
        return out;
      })
      .join('\r\n') + '\r\n'
  );
}
