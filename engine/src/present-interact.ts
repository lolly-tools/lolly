// SPDX-License-Identifier: MPL-2.0
/** Authored presentation controls, independent of a page or a browser. */
import { KF_EASE_PRESETS, kfEaseAt, normaliseKfEase } from './keyframes.ts';

export type PresentInteractDepth = number | `${number}%` | `#${string}`;
export interface PresentInteractOptions {
  highlight: 'ring' | 'spotlight' | 'zoom' | 'none';
  highlightColor: string;
  keys: 'scroll' | 'key' | 'none';
  mode: 'none' | 'places' | 'pan';
  pageLength: number;
  start: PresentInteractDepth;
  stops: PresentInteractDepth[];
  walk: boolean;
  auto: 'off' | 'open' | 'focus';
  from: PresentInteractDepth;
  to: PresentInteractDepth;
  seconds: number;
  ease: string;
  repeat: 'once' | 'loop' | 'alternate';
  pauseSeconds: number;
  hand: boolean;
  scrollMs: number;
  keep: boolean;
}
export interface PresentInteractContext { scrollMax: number; boxHeight: number }
export interface PresentInteractStop { depth: PresentInteractDepth; y: number | null; index: number }
export interface PresentInteractAutoSample {
  to: PresentInteractDepth; done: boolean; stopIndex: number | null; paused: boolean;
}
export const PRESENT_INTERACT_MAX_BYTES = 1024;
export const PRESENT_INTERACT_MAX_STOPS = 32;
export const PRESENT_INTERACT_MAX_DEPTH = 1_000_000;
export const PRESENT_INTERACT_DEFAULTS: Readonly<PresentInteractOptions> = Object.freeze({
  highlight: 'ring', highlightColor: 'accent', keys: 'scroll', mode: 'none', pageLength: 0,
  start: 0, stops: Object.freeze([]) as unknown as PresentInteractDepth[], walk: false,
  auto: 'off', from: 0, to: '100%', seconds: 12, ease: 'eio', repeat: 'once',
  pauseSeconds: 0, hand: false, scrollMs: 600, keep: false,
});

const KEYS = Object.freeze({
  hl: 'highlight', hlc: 'highlightColor', keys: 'keys', mode: 'mode', len: 'pageLength',
  start: 'start', stops: 'stops', walk: 'walk', auto: 'auto', from: 'from', to: 'to',
  sec: 'seconds', ease: 'ease', rep: 'repeat', pause: 'pauseSeconds', hand: 'hand',
  ms: 'scrollMs', keep: 'keep',
} as const);
const NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));
const defaults = (): PresentInteractOptions => ({ ...PRESENT_INTERACT_DEFAULTS, stops: [] });
function boundedNumber(value: string, lo: number, hi: number): number | null {
  if (!NUMBER.test(value)) return null;
  const n = Number(value);
  return Number.isFinite(n) ? clamp(n, lo, hi) : null;
}
function invalidDepthText(text: string): boolean {
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    if (code < 32 || code === 127) return true;
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = text.charCodeAt(++index);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
    } else if (code >= 0xdc00 && code <= 0xdfff) return true;
  }
  return false;
}

/** A fragment remains a fragment: resolving its position belongs to the page. */
export function parsePresentInteractDepth(value: unknown): PresentInteractDepth | null {
  if (typeof value === 'number') return Number.isFinite(value) ? clamp(value, 0, PRESENT_INTERACT_MAX_DEPTH) : null;
  if (typeof value !== 'string' || value.length > 256 || invalidDepthText(value)) return null;
  const text = value.trim();
  if (/^#[^\s#]{1,128}$/u.test(text)) return text as `#${string}`;
  if (text.endsWith('%')) {
    const n = boundedNumber(text.slice(0, -1), 0, 100);
    return n === null ? null : `${n}%`;
  }
  return boundedNumber(text, 0, PRESENT_INTERACT_MAX_DEPTH);
}

function enumValue<T extends string>(value: string, values: readonly T[]): T | null {
  return values.includes(value as T) ? value as T : null;
}
function parseValue(key: keyof typeof KEYS, text: string): string | number | boolean | PresentInteractDepth[] | null {
  switch (key) {
    case 'hl': return enumValue(text, ['ring', 'spotlight', 'zoom', 'none']);
    case 'hlc': return !Object.hasOwn(Object.prototype, text) && text !== 'prototype'
      && /^(?:#[\da-f]{3,4}|#[\da-f]{6}|#[\da-f]{8}|[a-z][\w.-]{0,127})$/i.test(text) ? text : null;
    case 'keys': return enumValue(text, ['scroll', 'key', 'none']);
    case 'mode': return enumValue(text, ['none', 'places', 'pan']);
    case 'auto': return enumValue(text, ['off', 'open', 'focus']);
    case 'rep': return enumValue(text, ['once', 'loop', 'alternate']);
    case 'len': return boundedNumber(text, 0, PRESENT_INTERACT_MAX_DEPTH);
    case 'sec': return boundedNumber(text, 1, 600);
    case 'pause': return boundedNumber(text, 0, 600);
    case 'ms': return boundedNumber(text, 0, 10_000);
    case 'walk': case 'hand': case 'keep': return text === '1' ? true : text === '0' ? false : null;
    case 'ease': return normaliseKfEase(text)
      ?? Object.entries(KF_EASE_PRESETS).find(([, preset]) => preset.name === text)?.[0] ?? null;
    case 'start': case 'from': case 'to': return parsePresentInteractDepth(text);
    case 'stops': return null;
  }
}

/** Invalid options are refused together, so a typo cannot partly change routing. */
export function parsePresentInteractOpts(value: unknown): PresentInteractOptions | null {
  if (value === undefined || value === null || value === '') return defaults();
  if (typeof value !== 'string' || value.length > PRESENT_INTERACT_MAX_BYTES
    || new TextEncoder().encode(value).length > PRESENT_INTERACT_MAX_BYTES) return null;
  const out = defaults();
  const seen = new Set<string>();
  const parts = value.split(';');
  if (parts.at(-1) === '') parts.pop();
  for (const part of parts) {
    const split = part.indexOf('=');
    if (split < 1) return null;
    const key = part.slice(0, split);
    if (!Object.hasOwn(KEYS, key) || seen.has(key)) return null;
    seen.add(key);
    const wireKey = key as keyof typeof KEYS;
    const raw = part.slice(split + 1);
    try {
      if (wireKey === 'stops') {
        const items = raw === '' ? [] : raw.split(',');
        if (items.length > PRESENT_INTERACT_MAX_STOPS) return null;
        const stops = items.map((item) => parsePresentInteractDepth(decodeURIComponent(item)));
        if (stops.some((stop) => stop === null)) return null;
        out.stops = stops as PresentInteractDepth[];
      } else {
        const parsed = parseValue(wireKey, decodeURIComponent(raw));
        if (parsed === null) return null;
        Object.assign(out, { [KEYS[wireKey]]: parsed });
      }
    } catch { return null; }
  }
  return out;
}

/** Emits a bounded canonical wire; omitted settings retain the defaults. */
export function serialisePresentInteractOpts(options: Partial<PresentInteractOptions>): string {
  if (!options || (Object.getPrototypeOf(options) !== Object.prototype && Object.getPrototypeOf(options) !== null)) {
    throw new TypeError('Presentation options must be a plain object');
  }
  const fields = Object.values(KEYS);
  if (Object.keys(options).some((key) => !fields.includes(key as typeof fields[number]))) {
    throw new TypeError('Unknown presentation option');
  }
  const parts: string[] = [];
  for (const [wireKey, field] of Object.entries(KEYS)) {
    if (!Object.hasOwn(options, field) || options[field as keyof PresentInteractOptions] === undefined) continue;
    const value = options[field as keyof PresentInteractOptions];
    if (field === 'stops') {
      if (!Array.isArray(value)) throw new TypeError('Presentation stops must be a list');
      if (value.length > PRESENT_INTERACT_MAX_STOPS) throw new RangeError('Too many presentation stops');
      if (!value.length) continue;
      parts.push(`${wireKey}=${value.map((depth) => encodeURIComponent(String(depth))).join(',')}`);
    } else {
      if (value === PRESENT_INTERACT_DEFAULTS[field]) continue;
      const text = typeof value === 'boolean' ? value ? '1' : '0' : String(value);
      parts.push(`${wireKey}=${encodeURIComponent(text)}`);
    }
  }
  const parsed = parsePresentInteractOpts(parts.join(';'));
  if (!parsed) throw new RangeError('Invalid or oversized presentation options');
  const wire = Object.entries(KEYS).flatMap(([key, field]) => {
    const value = parsed[field];
    if (field === 'stops') return parsed.stops.length ? [`${key}=${parsed.stops.map((depth) => encodeURIComponent(String(depth))).join(',')}`] : [];
    if (value === PRESENT_INTERACT_DEFAULTS[field]) return [];
    return [`${key}=${encodeURIComponent(typeof value === 'boolean' ? value ? '1' : '0' : String(value))}`];
  }).join(';');
  if (new TextEncoder().encode(wire).length > PRESENT_INTERACT_MAX_BYTES) throw new RangeError('Oversized presentation options');
  return wire;
}

export function resolvePresentInteractDepth(depth: PresentInteractDepth, context: PresentInteractContext): number | null {
  const parsed = parsePresentInteractDepth(depth);
  if (parsed === null || typeof parsed === 'string' && parsed.startsWith('#') || !Number.isFinite(context.scrollMax)) return null;
  const max = clamp(context.scrollMax, 0, PRESENT_INTERACT_MAX_DEPTH);
  return typeof parsed === 'number' ? clamp(parsed, 0, max) : Number(parsed.slice(0, -1)) * max / 100;
}
export function resolvePresentInteractStops(stops: readonly PresentInteractDepth[], context: PresentInteractContext): PresentInteractStop[] {
  return stops.slice(0, PRESENT_INTERACT_MAX_STOPS).map((depth, index) => ({ depth, y: resolvePresentInteractDepth(depth, context), index }));
}

/** Stops keep their authored order, including a deliberate return up the page. */
export function pickPresentInteractStop(stops: readonly PresentInteractStop[], current: PresentInteractDepth, direction: 1 | -1, currentIndex: number | null = null): PresentInteractStop | null {
  const retained = currentIndex !== null && Number.isInteger(currentIndex) ? stops.findIndex((stop) => stop.index === currentIndex) : -1;
  if (retained >= 0) return stops[retained + direction] ?? null;
  const exact = stops.findIndex((stop) => stop.depth === current || typeof current === 'number' && stop.y === current);
  if (exact >= 0) return stops[exact + direction] ?? null;
  if (typeof current !== 'number') return (direction === 1 ? stops[0] : stops.at(-1)) ?? null;
  const ordered = direction === 1 ? stops : [...stops].reverse();
  return ordered.find((stop) => stop.y !== null && (direction === 1 ? stop.y > current : stop.y < current)) ?? null;
}

interface AutoPoint { depth: PresentInteractDepth; y: number | null; stopIndex: number | null }
function autoPoints(options: PresentInteractOptions, context: PresentInteractContext): AutoPoint[] {
  const from: AutoPoint = { depth: options.from, y: resolvePresentInteractDepth(options.from, context), stopIndex: null };
  const to: AutoPoint = { depth: options.to, y: resolvePresentInteractDepth(options.to, context), stopIndex: null };
  const stops = resolvePresentInteractStops(options.stops, context);
  if (options.mode === 'places') {
    const places = stops.filter((stop) => typeof stop.depth === 'string' && stop.depth.startsWith('#'));
    const startIndex = places.findIndex((stop) => stop.depth === options.from);
    const endIndex = places.findIndex((stop) => stop.depth === options.to);
    const start = startIndex >= 0 ? startIndex : 0;
    const end = endIndex >= 0 ? endIndex : places.length - 1;
    const route = start <= end ? places.slice(start, end + 1) : places.slice(end, start + 1).reverse();
    if (route.length) return route.map((stop) => ({ depth: stop.depth, y: null, stopIndex: stop.index }));
  }
  const numeric = from.y !== null && to.y !== null;
  const direction = numeric && to.y! < from.y! ? -1 : 1;
  const between = numeric ? stops.filter((stop) => stop.y !== null && (direction === 1
    ? stop.y! >= from.y! && stop.y! <= to.y! : stop.y! <= from.y! && stop.y! >= to.y!)) : stops;
  const points: AutoPoint[] = [from];
  for (const stop of between) {
    const previous = points.at(-1)!;
    if (previous.depth === stop.depth || previous.y !== null && previous.y === stop.y) previous.stopIndex = stop.index;
    else points.push({ depth: stop.depth, y: stop.y, stopIndex: stop.index });
  }
  const last = points.at(-1)!;
  if (last.depth !== to.depth && !(last.y !== null && last.y === to.y)) points.push(to);
  return points;
}

/** Time is supplied by the shell. Paused time freezes the sample without a clock. */
export function samplePresentInteractAuto(
  options: PresentInteractOptions, tMs: number, context: PresentInteractContext,
  flags: { reducedMotion?: boolean; pausedAtMs?: number } = {},
): PresentInteractAutoSample {
  const paused = Number.isFinite(flags.pausedAtMs);
  const time = Math.max(0, Number.isFinite(paused ? flags.pausedAtMs : tMs) ? (paused ? flags.pausedAtMs! : tMs) : 0);
  if (options.auto === 'off') return { to: options.start, done: true, stopIndex: null, paused };
  const points = autoPoints(options, context);
  if (flags.reducedMotion && !options.stops.length) return { to: options.from, done: false, stopIndex: null, paused };
  const duration = clamp(options.seconds, 1, 600) * 1000;
  const pause = clamp(options.pauseSeconds, 0, 600) * 1000;
  const segments = Math.max(1, points.length - 1);
  const legDuration = duration + points.filter((point) => point.stopIndex !== null).length * pause;
  const done = options.repeat === 'once' && time >= legDuration;
  const iteration = options.repeat === 'once' ? 0 : Math.floor(time / legDuration);
  const reverse = options.repeat === 'alternate' && iteration % 2 === 1;
  const route = reverse ? [...points].reverse() : points;
  let left = done ? legDuration : options.repeat === 'once' ? time : time % legDuration;
  if (done) { const last = route.at(-1)!; return { to: last.depth, done, stopIndex: last.stopIndex, paused }; }
  for (let index = 0; index < route.length; index++) {
    const point = route[index]!;
    if (point.stopIndex !== null && pause > 0) {
      if (left < pause) return { to: point.depth, done: false, stopIndex: point.stopIndex, paused: true };
      left -= pause;
    }
    const next = route[index + 1];
    if (!next) return { to: point.depth, done: false, stopIndex: point.stopIndex, paused };
    const segmentMs = duration / segments;
    if (left < segmentMs) {
      const fraction = kfEaseAt(options.ease, left / segmentMs);
      const to = flags.reducedMotion || point.y === null || next.y === null ? point.depth
        : clamp(point.y + (next.y - point.y) * fraction, 0, clamp(context.scrollMax, 0, PRESENT_INTERACT_MAX_DEPTH));
      return { to, done: false, stopIndex: point.stopIndex, paused };
    }
    left -= segmentMs;
  }
  const last = route.at(-1)!;
  return { to: last.depth, done: false, stopIndex: last.stopIndex, paused };
}
