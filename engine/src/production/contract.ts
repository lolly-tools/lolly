// SPDX-License-Identifier: MPL-2.0
import { sha256Hex } from '../bytes.ts';
import type { ProductionContract, ProductionMotionContract, ProductionSpec } from './types.ts';

export function productionJson(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${Array.from(value, productionJson).join(',')}]`;
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${productionJson((value as Record<string, unknown>)[key])}`).join(',')}}`;
  }
  throw new Error('Production values must be finite JSON values.');
}
export const productionDigest = (value: unknown): Promise<string> => sha256Hex(new TextEncoder().encode(productionJson(value)));
const fail = (message: string): never => { throw new Error(`Invalid production contract: ${message}`); };
function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail('expected an object');
  const out = value as Record<string, unknown>;
  if (Object.keys(out).some(key => !keys.includes(key))) fail('unknown field');
  return out;
}
function text(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !value.length || value.length > 4096) fail('expected a bounded nonempty string');
}
function number(value: unknown, min: number, max: number, integer = false): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) fail('number outside supported range');
}
export function productionHash(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) fail('expected a SHA-256 digest');
}
/** Reject misspellings instead of quietly dropping a required check. */
export function parseProductionContract(value: unknown): ProductionContract {
  if (productionJson(value).length > 128 * 1024) fail('contract exceeds 128 KiB');
  const c = object(value, ['profile', 'id', 'revision', 'format', 'width', 'height', 'pages', 'alpha', 'sourceSha256', 'contextSha256', 'requirements', 'comparison']);
  if (c.profile !== 'lolly/production-still-v1') fail('unsupported profile');
  text(c.id); text(c.revision);
  if (!['svg', 'png', 'jpg', 'pdf'].includes(String(c.format))) fail('unsupported format');
  number(c.width, .001, 100_000); number(c.height, .001, 100_000); number(c.pages, 1, 100, true);
  if (!['any', 'opaque', 'transparent'].includes(String(c.alpha))) fail('unsupported alpha policy');
  for (const key of ['sourceSha256', 'contextSha256']) if (c[key] !== undefined) productionHash(c[key]);
  if (!Array.isArray(c.requirements) || c.requirements.length > 128) fail('requirements must be a list of at most 128 items');
  const ids = new Set<string>();
  for (const raw of c.requirements as unknown[]) {
    const r = object(raw, ['id', 'kind', 'location', 'expected']);
    text(r.id); text(r.location);
    if (ids.has(r.id)) fail('duplicate requirement id'); ids.add(r.id);
    if (!['text', 'link', 'resource', 'node', 'input'].includes(String(r.kind))) fail('unsupported requirement');
    if (typeof r.expected !== 'string' || r.expected.length > 16_384) fail('invalid expected value');
    if (r.kind === 'resource' || r.kind === 'node' || r.kind === 'input') productionHash(r.expected);
  }
  if (c.comparison !== undefined) {
    const v = object(c.comparison, ['referenceSha256', 'channelTolerance', 'maxChangedFraction', 'regions']);
    productionHash(v.referenceSha256); number(v.channelTolerance, 0, 255, true); number(v.maxChangedFraction, 0, 1);
    if (!Array.isArray(v.regions) || v.regions.length > 64) fail('comparison needs at most 64 regions');
    const names = new Set<string>();
    for (const raw of v.regions as unknown[]) {
      const r = object(raw, ['id', 'x', 'y', 'width', 'height', 'minSsim', 'maxInkDelta']); text(r.id);
      if (names.has(r.id)) fail('duplicate region id'); names.add(r.id);
      number(r.x, 0, 100_000, true); number(r.y, 0, 100_000, true); number(r.width, 1, 100_000, true); number(r.height, 1, 100_000, true);
      number(r.minSsim, -1, 1); number(r.maxInkDelta, 0, 1);
      if (r.x + r.width > c.width || r.y + r.height > c.height) fail('region outside output');
    }
    if (c.pages !== 1) fail('pixel comparison supports one page');
  }
  return JSON.parse(productionJson(c)) as ProductionContract;
}

/** Still contracts keep their existing parser; motion admission is explicit. */
export function parseProductionSpec(value: unknown): ProductionSpec {
  if (!value || typeof value !== 'object' || (value as { profile?: unknown }).profile !== 'lolly/production-motion-v1') return parseProductionContract(value);
  if (productionJson(value).length > 128 * 1024) fail('contract exceeds 128 KiB');
  const c = object(value, ['profile', 'id', 'revision', 'format', 'width', 'height', 'sourceSha256', 'contextSha256', 'requirements', 'motion']);
  if (c.format !== 'mp4' && c.format !== 'webm') fail('motion supports MP4 and WebM');
  const { motion, ...common } = c;
  parseProductionContract({ ...common, profile: 'lolly/production-still-v1', format: 'png', pages: 1, alpha: 'any' });
  number(c.width, 1, 4096, true); number(c.height, 1, 4096, true);
  if (c.width * c.height > 4_000_000) fail('motion viewport exceeds four million pixels');
  const m = object(motion, ['seconds', 'secondsTolerance', 'fps', 'fpsTolerance', 'frameCount', 'timestampTolerance', 'audio', 'audioSecondsTolerance', 'loudness', 'truePeakMax', 'comparison']);
  number(m.seconds, .001, 120); number(m.secondsTolerance, 0, 1); number(m.fps, 1, 120); number(m.fpsTolerance, 0, 1);
  number(m.frameCount, 1, 14_400, true); number(m.timestampTolerance, 0, 1);
  if (typeof m.audio !== 'boolean') fail('motion needs an explicit audio requirement');
  if (m.audio) number(m.audioSecondsTolerance, 0, 1);
  else if (m.audioSecondsTolerance !== undefined) fail('audio duration requires an audio track');
  if (m.loudness !== undefined) {
    const l = object(m.loudness, ['min', 'max']); number(l.min, -100, 10); number(l.max, l.min, 10);
    if (!m.audio) fail('loudness requires an audio track');
  }
  if (m.truePeakMax !== undefined) { number(m.truePeakMax, -100, 20); if (!m.audio) fail('true peak requires an audio track'); }
  if (m.comparison !== undefined) {
    const p = object(m.comparison, ['referenceSha256', 'times', 'channelTolerance', 'maxChangedFraction', 'regions']);
    if (!Array.isArray(p.times) || !p.times.length || p.times.length > 16) return fail('motion comparison needs one to sixteen times');
    let previous = -1;
    for (const t of p.times as unknown[]) { number(t, 0, m.seconds); if (t >= m.seconds || t <= previous || Math.round(t * m.fps) >= m.frameCount) fail('sample times must increase and address an output frame'); previous = t; }
    const { times: _times, ...comparison } = p;
    parseProductionContract({ ...common, profile: 'lolly/production-still-v1', format: 'png', pages: 1, alpha: 'any', comparison });
  }
  return JSON.parse(productionJson(c)) as ProductionMotionContract;
}
