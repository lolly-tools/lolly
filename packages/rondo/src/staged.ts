// SPDX-License-Identifier: MPL-2.0
/**
 * The staged-data validator: the inspect step between the vm and the DSP.
 *
 * The vm's output is untrusted in full. The song ran in the same realm as the
 * staging code, so it could have rewritten JSON.stringify, Array.prototype or the
 * staging functions themselves before the string came back. This module therefore
 * reads the string as if a stranger wrote it: it rebuilds every value it accepts,
 * refuses unknown keys, keeps every number finite and in range, and caps every
 * count the renderer would allocate for or loop over (src/limits.ts). Upstream's
 * DSP kernels clamp their own config as well (dsp/delay.ts clamps maxTime to
 * 60 s, because its AudioWorklet also receives graphs as data), so these caps are
 * the budget on top, never the only line.
 *
 * Nothing here evaluates anything. A value that passes is plain data.
 */
import { RONDO_LIMITS } from './limits.ts';
import { NODE_TYPES } from './node-types.generated.ts';
import { reviver, WireError } from './wire.ts';
import { validateGraph, validateWavetableFrames } from '../generated/render.mjs';

const L = RONDO_LIMITS;
const NODE_TYPE_SET: ReadonlySet<string> = new Set(NODE_TYPES);

export class StagedError extends Error {
  override name = 'StagedError';
  readonly code: string;
  constructor(message: string, code = 'rondo.staged.invalid') {
    super(message);
    this.code = code;
  }
}

export interface GraphData {
  nodes: { id: number; type: string; inputs: Record<string, number | { node: number }>; config?: Record<string, unknown> }[];
  out: number;
  params: Record<string, unknown>[];
}

export interface SynthData {
  graph: GraphData;
  post?: GraphData;
  voiceOpts?: Record<string, unknown>;
  maxVoices?: number;
}

export type EventData =
  | { time: number; type: 'noteOn'; note: number; velocity: number; begin?: number; end?: number }
  | { time: number; type: 'noteOff'; note: number }
  | { time: number; type: 'param'; name: string; value: number };

export interface StagedSong {
  cps: number;
  synths: Map<string, SynthData>;
  events: Map<string, EventData[]>;
  buses: Map<string, { graph: GraphData; gain: number }>;
  sends: { synth: string; bus: string; amount: number }[];
  sidechain?: { source: string; depth: number; releaseMs: number; amounts?: Record<string, number> };
  masterComp?: { threshold: number; ratio: number; attack: number; release: number; knee: number; makeup: number };
  masterGain?: number;
  stereo?: { width?: number; monoBelow?: number };
  wavetables: Record<string, number[][]>;
}

function fail(what: string): never {
  throw new StagedError(`staged data is not valid: ${what}`);
}

const isPlain = (v: unknown): v is Record<string, unknown> => {
  if (v === null || typeof v !== 'object' || Array.isArray(v) || ArrayBuffer.isView(v) || v instanceof Map) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
};

function onlyKeys(o: Record<string, unknown>, allowed: readonly string[], what: string): void {
  for (const k of Object.keys(o)) if (!allowed.includes(k)) fail(`${what} has an unexpected field "${k.slice(0, 40)}"`);
}

function num(v: unknown, lo: number, hi: number, what: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi) fail(`${what} must be a number from ${lo} to ${hi}`);
  return v as number;
}

function int(v: unknown, lo: number, hi: number, what: string): number {
  const n = num(v, lo, hi, what);
  if (!Number.isInteger(n)) fail(`${what} must be a whole number`);
  return n;
}

function str(v: unknown, max: number, what: string): string {
  if (typeof v !== 'string' || v.length > max) fail(`${what} must be text of at most ${max} characters`);
  return v as string;
}

const opt = <T>(v: unknown, read: (v: unknown) => T): T | undefined => (v === undefined ? undefined : read(v));

/**
 * Copy an arbitrary config value, bounded. Numbers may be infinite (a clip with
 * no ceiling is legitimate) but never NaN; typed arrays are copied, never shared.
 */
function copyConfig(v: unknown, depth: number, budget: { numbers: number }, what: string): unknown {
  if (depth > L.maxConfigDepth) fail(`${what} nests deeper than ${L.maxConfigDepth}`);
  if (v === null || typeof v === 'boolean') return v;
  if (typeof v === 'number') {
    if (Number.isNaN(v)) fail(`${what} holds NaN`);
    if (--budget.numbers < 0) fail(`${what} holds more than ${L.maxConfigNumbers} numbers`);
    return v;
  }
  if (typeof v === 'string') return str(v, L.maxStringChars, what);
  if (ArrayBuffer.isView(v)) {
    const arr = v as unknown as ArrayLike<number> & { slice(): ArrayBufferView };
    budget.numbers -= arr.length;
    if (budget.numbers < 0) fail(`${what} holds more than ${L.maxConfigNumbers} numbers`);
    for (let i = 0; i < arr.length; i++) if (Number.isNaN(arr[i])) fail(`${what} holds NaN`);
    return arr.slice();
  }
  if (Array.isArray(v)) return v.map((x, i) => copyConfig(x, depth + 1, budget, `${what}[${i}]`));
  if (isPlain(v)) {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) out[str(k, 128, `${what} key`)] = copyConfig(x, depth + 1, budget, `${what}.${k}`);
    return out;
  }
  return fail(`${what} holds a value of an unknown kind`);
}

function readGraph(v: unknown, what: string): GraphData {
  if (!isPlain(v)) fail(`${what} is not a graph`);
  const g = v as Record<string, unknown>;
  onlyKeys(g, ['nodes', 'out', 'params'], what);
  if (!Array.isArray(g.nodes) || g.nodes.length < 1 || g.nodes.length > L.maxNodesPerGraph) {
    fail(`${what} must have 1 to ${L.maxNodesPerGraph} nodes`);
  }
  const budget = { numbers: L.maxConfigNumbers };
  const nodes = (g.nodes as unknown[]).map((n, i) => {
    const at = `${what}.nodes[${i}]`;
    if (!isPlain(n)) fail(`${at} is not a node`);
    const node = n as Record<string, unknown>;
    onlyKeys(node, ['id', 'type', 'inputs', 'config'], at);
    const type = str(node.type, 32, `${at}.type`);
    if (!NODE_TYPE_SET.has(type)) fail(`${at} has the unknown node type "${type}"`);
    if (!isPlain(node.inputs)) fail(`${at}.inputs is not a map`);
    const inputs: Record<string, number | { node: number }> = {};
    const entries = Object.entries(node.inputs as Record<string, unknown>);
    if (entries.length > 64) fail(`${at} has more than 64 inputs`);
    for (const [port, src] of entries) {
      const p = str(port, 64, `${at} input name`);
      if (typeof src === 'number') inputs[p] = num(src, -1e12, 1e12, `${at}.inputs.${p}`);
      else if (isPlain(src)) {
        onlyKeys(src, ['node'], `${at}.inputs.${p}`);
        inputs[p] = { node: int(src.node, 0, 1e7, `${at}.inputs.${p}.node`) };
      } else fail(`${at}.inputs.${p} is neither a constant nor a node`);
    }
    const out: GraphData['nodes'][number] = { id: int(node.id, 0, 1e7, `${at}.id`), type, inputs };
    if (node.config !== undefined) {
      if (!isPlain(node.config)) fail(`${at}.config is not a map`);
      out.config = copyConfig(node.config, 0, budget, `${at}.config`) as Record<string, unknown>;
    }
    return out;
  });
  if (!Array.isArray(g.params) || g.params.length > L.maxParamsPerGraph) fail(`${what}.params must be a list of at most ${L.maxParamsPerGraph}`);
  const params = (g.params as unknown[]).map((p, i) => {
    if (!isPlain(p)) fail(`${what}.params[${i}] is not a parameter`);
    return copyConfig(p, 1, budget, `${what}.params[${i}]`) as Record<string, unknown>;
  });
  const graph: GraphData = { nodes, out: int(g.out, 0, 1e7, `${what}.out`), params };
  try {
    validateGraph(graph);
  } catch (e) {
    fail(`${what}: ${e instanceof Error ? e.message.slice(0, 200) : 'invalid graph'}`);
  }
  return graph;
}

function readEvent(v: unknown, maxTime: number, what: string): EventData {
  if (!isPlain(v)) fail(`${what} is not an event`);
  const e = v as Record<string, unknown>;
  const time = num(e.time, 0, maxTime, `${what}.time`);
  switch (e.type) {
    case 'noteOn': {
      onlyKeys(e, ['time', 'type', 'note', 'velocity', 'begin', 'end'], what);
      const out: EventData = { time, type: 'noteOn', note: num(e.note, -512, 512, `${what}.note`), velocity: num(e.velocity, 0, 64, `${what}.velocity`) };
      const begin = opt(e.begin, (x) => num(x, -4, 4, `${what}.begin`));
      const end = opt(e.end, (x) => num(x, -4, 4, `${what}.end`));
      if (begin !== undefined) out.begin = begin;
      if (end !== undefined) out.end = end;
      return out;
    }
    case 'noteOff':
      onlyKeys(e, ['time', 'type', 'note'], what);
      return { time, type: 'noteOff', note: num(e.note, -512, 512, `${what}.note`) };
    case 'param':
      onlyKeys(e, ['time', 'type', 'name', 'value'], what);
      return { time, type: 'param', name: str(e.name, 128, `${what}.name`), value: num(e.value, -1e12, 1e12, `${what}.value`) };
    default:
      return fail(`${what} has an unknown event type`);
  }
}

const nameOf = (k: string, what: string): string => {
  if (k.length < 1) fail(`${what} has an empty name`);
  return str(k, 128, `${what} name`);
};

function readMap<T>(v: unknown, max: number, what: string, read: (x: unknown, at: string) => T): Map<string, T> {
  if (!(v instanceof Map)) fail(`${what} is not a map`);
  const m = v as Map<string, unknown>;
  if (m.size > max) fail(`${what} has more than ${max} entries`);
  const out = new Map<string, T>();
  for (const [k, x] of m) out.set(nameOf(k, what), read(x, `${what}["${k.slice(0, 40)}"]`));
  return out;
}

/**
 * Parse and validate the vm's `schedule` output for a render of `seconds`.
 * Throws StagedError (with a stable `code`) on anything it cannot vouch for.
 */
export function parseStaged(text: string, seconds: number): StagedSong {
  if (typeof text !== 'string' || text.length > L.maxStagedChars) {
    throw new StagedError(`the staged song is larger than ${L.maxStagedChars} characters`, 'rondo.staged.size');
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text, reviver);
  } catch (e) {
    throw new StagedError(e instanceof WireError ? e.message : 'the staged song is not valid JSON');
  }
  if (!isPlain(raw)) fail('the result is not an object');
  const r = raw as Record<string, unknown>;
  if (r.ok !== true) fail('the stage did not report success');
  onlyKeys(r, ['ok', 'cps', 'synths', 'events', 'buses', 'sends', 'sidechain', 'masterComp', 'masterGain', 'stereo', 'wavetables'], 'the result');

  // Upstream clamps setCps() to 0.05..4 (render-runner StageResult).
  const cps = num(r.cps, 0.05, 4, 'cps');
  const synths = readMap(r.synths, L.maxSynths, 'synths', (x, at): SynthData => {
    if (!isPlain(x)) fail(`${at} is not a synth`);
    const d = x as Record<string, unknown>;
    onlyKeys(d, ['graph', 'post', 'voiceOpts', 'maxVoices'], at);
    const out: SynthData = { graph: readGraph(d.graph, `${at}.graph`) };
    if (d.post !== undefined) out.post = readGraph(d.post, `${at}.post`);
    if (d.voiceOpts !== undefined) {
      if (!isPlain(d.voiceOpts)) fail(`${at}.voiceOpts is not a map`);
      out.voiceOpts = copyConfig(d.voiceOpts, 1, { numbers: 4096 }, `${at}.voiceOpts`) as Record<string, unknown>;
    }
    if (d.maxVoices !== undefined) out.maxVoices = int(d.maxVoices, 1, L.maxVoices, `${at}.maxVoices`);
    return out;
  });

  // An event may land a little past the window (a slide note held into the next
  // cycle), never far past the window.
  const maxTime = seconds + 60;
  let eventCount = 0;
  const events = readMap(r.events, L.maxSynths * 4, 'events', (x, at) => {
    if (!Array.isArray(x)) fail(`${at} is not a list`);
    const list = x as unknown[];
    eventCount += list.length;
    if (eventCount > L.maxEvents) fail(`there are more than ${L.maxEvents} events`);
    return list.map((ev, i) => readEvent(ev, maxTime, `${at}[${i}]`));
  });

  const buses = readMap(r.buses, L.maxBuses, 'buses', (x, at) => {
    if (!isPlain(x)) fail(`${at} is not a bus`);
    onlyKeys(x, ['graph', 'gain'], at);
    return { graph: readGraph(x.graph, `${at}.graph`), gain: num(x.gain, 0, 64, `${at}.gain`) };
  });

  if (!Array.isArray(r.sends) || r.sends.length > L.maxSends) fail(`sends must be a list of at most ${L.maxSends}`);
  const sends = (r.sends as unknown[]).map((s, i) => {
    const at = `sends[${i}]`;
    if (!isPlain(s)) fail(`${at} is not a send`);
    onlyKeys(s, ['synth', 'bus', 'amount'], at);
    return { synth: str(s.synth, 128, `${at}.synth`), bus: str(s.bus, 128, `${at}.bus`), amount: num(s.amount, 0, 16, `${at}.amount`) };
  });

  const song: StagedSong = { cps, synths, events, buses, sends, wavetables: {} };

  if (r.sidechain !== undefined) {
    const s = r.sidechain;
    if (!isPlain(s)) fail('sidechain is not a map');
    onlyKeys(s, ['source', 'depth', 'releaseMs', 'amounts'], 'sidechain');
    song.sidechain = { source: str(s.source, 128, 'sidechain.source'), depth: num(s.depth, 0, 1, 'sidechain.depth'), releaseMs: num(s.releaseMs, 0, 60_000, 'sidechain.releaseMs') };
    if (s.amounts !== undefined) {
      if (!isPlain(s.amounts)) fail('sidechain.amounts is not a map');
      const amounts: Record<string, number> = {};
      const entries = Object.entries(s.amounts);
      if (entries.length > L.maxSynths) fail('sidechain.amounts names too many synths');
      for (const [k, x] of entries) amounts[nameOf(k, 'sidechain.amounts')] = num(x, 0, 1, `sidechain.amounts.${k}`);
      song.sidechain.amounts = amounts;
    }
  }
  if (r.masterComp !== undefined) {
    const c = r.masterComp;
    if (!isPlain(c)) fail('masterComp is not a map');
    onlyKeys(c, ['threshold', 'ratio', 'attack', 'release', 'knee', 'makeup'], 'masterComp');
    song.masterComp = {
      threshold: num(c.threshold, -120, 24, 'masterComp.threshold'),
      ratio: num(c.ratio, 1, 1000, 'masterComp.ratio'),
      attack: num(c.attack, 0, 10_000, 'masterComp.attack'),
      release: num(c.release, 0, 60_000, 'masterComp.release'),
      knee: num(c.knee, 0, 96, 'masterComp.knee'),
      makeup: num(c.makeup, -96, 96, 'masterComp.makeup'),
    };
  }
  if (r.masterGain !== undefined) song.masterGain = num(r.masterGain, -120, 48, 'masterGain');
  if (r.stereo !== undefined) {
    const s = r.stereo;
    if (!isPlain(s)) fail('stereo is not a map');
    onlyKeys(s, ['width', 'monoBelow'], 'stereo');
    song.stereo = {};
    const width = opt(s.width, (x) => num(x, 0, 16, 'stereo.width'));
    const monoBelow = opt(s.monoBelow, (x) => num(x, 0, 24_000, 'stereo.monoBelow'));
    if (width !== undefined) song.stereo.width = width;
    if (monoBelow !== undefined) song.stereo.monoBelow = monoBelow;
  }
  if (r.wavetables !== undefined) {
    if (!isPlain(r.wavetables)) fail('wavetables is not a map');
    const entries = Object.entries(r.wavetables);
    if (entries.length > 64) fail('more than 64 custom wavetables');
    for (const [k, frames] of entries) {
      const name = nameOf(k, 'wavetables');
      try {
        validateWavetableFrames(`wavetable "${name.slice(0, 40)}"`, frames);
      } catch (e) {
        fail(e instanceof Error ? e.message.slice(0, 200) : 'a wavetable is invalid');
      }
      song.wavetables[name] = (frames as number[][]).map((f) => [...f]);
    }
  }

  // The CPU budget: render time grows with voices times nodes.
  let voiceNodes = 0;
  for (const def of synths.values()) {
    const voices = def.maxVoices ?? 12;
    voiceNodes += voices * def.graph.nodes.length + (def.post?.nodes.length ?? 0);
  }
  for (const bus of buses.values()) voiceNodes += bus.graph.nodes.length;
  if (voiceNodes > L.maxVoiceNodes) {
    throw new StagedError(`the song needs ${voiceNodes} voice-nodes; the limit is ${L.maxVoiceNodes}`, 'rondo.limits.cost');
  }
  return song;
}

