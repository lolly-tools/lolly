// SPDX-License-Identifier: MPL-2.0
/**
 * audio-fx.ts - the per-clip effect kernels and the `fx` chain grammar
 * (plans/101 sections 2.2 + 3.4, plans/165's deferred tier).
 *
 * Pure, DOM-free, zero-dep DSP: RBJ Audio-EQ-Cookbook biquads, the public-domain
 * Freeverb (8 combs + 4 allpasses per channel, +23-sample stereo spread,
 * constants rescaled from 44.1 kHz to the running rate), delay/echo, a noise
 * gate, de-hum (mains fundamental + harmonic notches), bitcrush and reverse -
 * plus the parser, serialiser and chain compiler for the wire grammar.
 *
 * THE GRAMMAR (a permanent wire contract, append-only like every other):
 * entries joined by `.`, each `name(params)` with `-`-joined integer params in
 * fixed scales, alphabet `a-z0-9().-` only - so the value costs no URL-escape
 * blowup inside the compact blocks codec. Unknown entries are SKIPPED (with the
 * skip reported to the caller), never an error: a newer document opens in an
 * older engine and applies what it can. Presets are WRITERS that store the
 * expanded chain - re-tuning a preset later must never change what an
 * already-shared link sounds like.
 *
 * Deviation from plans/101 section 3.4, stated: `pitch()` is NOT a grammar token
 * here - pitch shipped earlier as its own wire field (plans/165 WP-7b, design
 * slot 92) and two doors onto one value would drift.
 *
 * Token registry (append-only):
 *   hp(f)          high-pass at f Hz (12 dB/oct biquad, Q 0.707)
 *   lp(f)          low-pass at f Hz
 *   eq(l-m-h)      3-band tone: low shelf 200 Hz / peak 1 kHz / high shelf 4 kHz,
 *                  each param dB x10 offset by 240 (so -24..24 dB -> 0..480)
 *   rv(mix-room)   Freeverb: wet mix % (0..100) and room size % (0..100)
 *   echo(ms-fb-mx) delay: time ms (1..2000), feedback % (0..90), wet mix % (0..100)
 *   gate(db)       noise gate threshold, -db dBFS (param 20..90)
 *   dehum(f)       mains hum notches at f (50 or 60) + 3 harmonics
 *   crush(bits)    bitcrush to 2..12 bits
 *   rev()          reverse the buffer
 *   clean()        speech enhancement via the on-device GTCRN model - a SHELL
 *                  entry: it parses and serialises here like any token, but
 *                  `processFxPcm` SKIPS it (the model cannot live in the
 *                  zero-dep engine); the web shell splices its driver in at the
 *                  token's position. A shell without the model plays the rest
 *                  of the chain - graceful, like an unknown token.
 */

export interface FxEntry {
  name: string;
  params: number[];
}

const TOKEN_RE = /^([a-z]+)\(([0-9-]*)\)$/;

/** Parameter count + inclusive ranges per token - the append-only registry. */
const REGISTRY: Record<string, { params: [number, number][] }> = {
  hp: { params: [[20, 12000]] },
  lp: { params: [[100, 20000]] },
  eq: { params: [[0, 480], [0, 480], [0, 480]] },
  rv: { params: [[0, 100], [0, 100]] },
  echo: { params: [[1, 2000], [0, 90], [0, 100]] },
  gate: { params: [[20, 90]] },
  dehum: { params: [[50, 60]] },
  crush: { params: [[2, 12]] },
  rev: { params: [] },
  clean: { params: [] },
};

/** The grammar cap: a chain longer than this is authoring junk, not intent. */
export const FX_CHAIN_MAX_CHARS = 200;

export interface ParsedFxChain {
  entries: FxEntry[];
  /** Tokens present in the string but unknown or malformed - skipped, reported. */
  skipped: string[];
}

/** Parse a wire chain. Hostile input degrades to skips, never a throw. */
export function parseFxChain(value: string | null | undefined): ParsedFxChain {
  const out: ParsedFxChain = { entries: [], skipped: [] };
  const s = String(value ?? '').trim().toLowerCase();
  if (!s || s.length > FX_CHAIN_MAX_CHARS) {
    if (s.length > FX_CHAIN_MAX_CHARS) out.skipped.push('(overlong chain)');
    return out;
  }
  for (const raw of s.split('.')) {
    if (!raw) continue;
    const m = TOKEN_RE.exec(raw);
    const reg = m ? REGISTRY[m[1]!] : undefined;
    if (!m || !reg) { out.skipped.push(raw); continue; }
    const params = m[2] ? m[2].split('-').map((p) => Number(p)) : [];
    const ok = params.length === reg.params.length
      && params.every((p, i) => Number.isInteger(p) && p >= reg.params[i]![0] && p <= reg.params[i]![1]);
    if (!ok) { out.skipped.push(raw); continue; }
    out.entries.push({ name: m[1]!, params });
  }
  return out;
}

/** Serialise entries back to the wire form (the exact inverse of a clean parse). */
export function serializeFxChain(entries: readonly FxEntry[]): string {
  return entries.map((e) => `${e.name}(${e.params.join('-')})`).join('.');
}

/**
 * Presets: writers that expand into today's tuning, stored EXPANDED (the
 * authored-output stability rule - a later re-tune never changes shared links).
 */
export const FX_PRESETS: Record<string, string> = {
  'voice-cleanup': 'clean().hp(80)',
  'voice-clarity': 'hp(90).eq(230-280-270).gate(55)',
  warm: 'eq(280-240-210)',
  bright: 'eq(220-240-300)',
  telephone: 'hp(300).lp(3400).eq(240-300-240)',
  muffled: 'lp(1200)',
  radio: 'hp(120).lp(8000).eq(250-270-250).crush(10)',
  'lo-fi': 'crush(6).lp(6000)',
  echo: 'echo(280-35-35)',
  room: 'rv(20-35)',
  hall: 'rv(30-75)',
  plate: 'rv(25-55)',
  'de-hum': 'dehum(50)',
  gate: 'gate(55)',
};

// ── kernels ─────────────────────────────────────────────────────────────────────

interface BiquadCoeffs { b0: number; b1: number; b2: number; a1: number; a2: number }

/** RBJ cookbook coefficient builders (normalised by a0). */
function rbj(kind: 'hp' | 'lp' | 'peak' | 'lowshelf' | 'highshelf' | 'notch', rate: number, freq: number, q: number, gainDb = 0): BiquadCoeffs {
  const w0 = (2 * Math.PI * Math.min(freq, rate / 2 - 1)) / rate;
  const cw = Math.cos(w0);
  const sw = Math.sin(w0);
  const alpha = sw / (2 * q);
  const A = 10 ** (gainDb / 40);
  let b0 = 1, b1 = 0, b2 = 0, a0 = 1, a1 = 0, a2 = 0;
  if (kind === 'hp') {
    b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = (1 + cw) / 2;
    a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha;
  } else if (kind === 'lp') {
    b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = (1 - cw) / 2;
    a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha;
  } else if (kind === 'peak') {
    b0 = 1 + alpha * A; b1 = -2 * cw; b2 = 1 - alpha * A;
    a0 = 1 + alpha / A; a1 = -2 * cw; a2 = 1 - alpha / A;
  } else if (kind === 'notch') {
    b0 = 1; b1 = -2 * cw; b2 = 1;
    a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha;
  } else {
    const sqA = Math.sqrt(A);
    const sign = kind === 'lowshelf' ? 1 : -1;
    b0 = A * ((A + 1) - sign * (A - 1) * cw + 2 * sqA * alpha);
    b1 = sign * 2 * A * ((A - 1) - sign * (A + 1) * cw);
    b2 = A * ((A + 1) - sign * (A - 1) * cw - 2 * sqA * alpha);
    a0 = (A + 1) + sign * (A - 1) * cw + 2 * sqA * alpha;
    a1 = sign * -2 * ((A - 1) + sign * (A + 1) * cw);
    a2 = (A + 1) + sign * (A - 1) * cw - 2 * sqA * alpha;
  }
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}

function runBiquad(x: Float32Array, c: BiquadCoeffs): void {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const xi = x[i]!;
    const y = c.b0 * xi + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
    x2 = x1; x1 = xi;
    y2 = y1; y1 = y;
    x[i] = y;
  }
}

/** Freeverb tuning (public-domain Schroeder/Moorer), 44.1 kHz reference. */
const FV_COMBS = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
const FV_ALLPASSES = [556, 441, 341, 225];
const FV_SPREAD = 23;

function freeverb(channels: Float32Array[], rate: number, mixPct: number, roomPct: number): void {
  const wet = Math.min(1, Math.max(0, mixPct / 100));
  if (wet === 0) return;
  // The classic freeverb room mapping: offsetroom 0.7 + scaleroom 0.28, so the
  // comb feedback runs 0.7 (tight) .. 0.98 (cavern).
  const feedback = 0.7 + (roomPct / 100) * 0.28;
  const damp = 0.2;
  const scale = rate / 44_100;
  const n = channels[0]!.length;
  for (let ch = 0; ch < channels.length; ch++) {
    const spread = ch === 0 ? 0 : FV_SPREAD;
    const src = Float32Array.from(channels[ch]!);
    const acc = new Float32Array(n);
    for (const base of FV_COMBS) {
      const len = Math.max(1, Math.round((base + spread) * scale));
      const buf = new Float32Array(len);
      let idx = 0;
      let store = 0;
      for (let i = 0; i < n; i++) {
        const out = buf[idx]!;
        store = out * (1 - damp) + store * damp;
        buf[idx] = src[i]! + store * Math.min(0.98, feedback);
        idx = (idx + 1) % len;
        acc[i] = (acc[i] as number) + out;
      }
    }
    let wetCh = acc;
    for (const base of FV_ALLPASSES) {
      const len = Math.max(1, Math.round((base + spread) * scale));
      const buf = new Float32Array(len);
      let idx = 0;
      const next = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const bufout = buf[idx]!;
        const input = wetCh[i]!;
        next[i] = -input + bufout;
        buf[idx] = input + bufout * 0.5;
        idx = (idx + 1) % len;
      }
      wetCh = next;
    }
    const dst = channels[ch]!;
    const wetGain = wet * 0.015 * 3;   // fixedgain x the classic wet scale
    for (let i = 0; i < n; i++) dst[i] = dst[i]! * (1 - wet) + wetCh[i]! * wetGain;
  }
}

function echoFx(channels: Float32Array[], rate: number, ms: number, fbPct: number, mixPct: number): void {
  const wet = Math.min(1, Math.max(0, mixPct / 100));
  if (wet === 0) return;
  const fb = Math.min(0.9, Math.max(0, fbPct / 100));
  const len = Math.max(1, Math.round((ms / 1000) * rate));
  for (const ch of channels) {
    const buf = new Float32Array(len);
    let idx = 0;
    for (let i = 0; i < ch.length; i++) {
      const delayed = buf[idx]!;
      buf[idx] = ch[i]! + delayed * fb;
      idx = (idx + 1) % len;
      ch[i] = ch[i]! + delayed * wet;
    }
  }
}

function gateFx(channels: Float32Array[], rate: number, thresholdDb: number): void {
  // A FAST detector and a slower gain: the envelope follower must fall quickly
  // (~30 ms) or the gate stays open long after loud content ends; the smoothing
  // that stops zero-crossing chatter lives on the GAIN ramps instead (5 ms open,
  // 60 ms close - speech-pause territory, no click either way).
  const thr = 10 ** (-thresholdDb / 20);
  const envAtt = Math.exp(-1 / (0.002 * rate));
  const envRel = Math.exp(-1 / (0.030 * rate));
  const gAtt = Math.exp(-1 / (0.005 * rate));
  const gRel = Math.exp(-1 / (0.060 * rate));
  for (const ch of channels) {
    let env = 0;
    let g = 0;
    for (let i = 0; i < ch.length; i++) {
      const a = Math.abs(ch[i]!);
      env = a > env ? a + (env - a) * envAtt : a + (env - a) * envRel;
      const want = env >= thr ? 1 : 0;
      g = want > g ? want + (g - want) * gAtt : want + (g - want) * gRel;
      ch[i] = ch[i]! * g;
    }
  }
}

function dehumFx(channels: Float32Array[], rate: number, mains: number): void {
  // The fundamental plus three harmonics, each a narrow notch (Q 30).
  for (let h = 1; h <= 4; h++) {
    const c = rbj('notch', rate, mains * h, 30);
    for (const ch of channels) runBiquad(ch, c);
  }
}

function crushFx(channels: Float32Array[], bits: number): void {
  const steps = 2 ** (bits - 1);
  for (const ch of channels) {
    for (let i = 0; i < ch.length; i++) ch[i] = Math.round(ch[i]! * steps) / steps;
  }
}

/** dB-x10 wire param (offset 240) back to dB. */
const eqDb = (p: number): number => (p - 240) / 10;

/**
 * Apply a parsed chain to PCM, in entry order, IN PLACE (callers pass copies).
 * Deterministic: the same chain over the same samples yields the same bytes.
 */
export function processFxPcm(channels: Float32Array[], rate: number, chain: readonly FxEntry[]): void {
  for (const e of chain) {
    if (e.name === 'hp') {
      const c = rbj('hp', rate, e.params[0]!, Math.SQRT1_2);
      for (const ch of channels) runBiquad(ch, c);
    } else if (e.name === 'lp') {
      const c = rbj('lp', rate, e.params[0]!, Math.SQRT1_2);
      for (const ch of channels) runBiquad(ch, c);
    } else if (e.name === 'eq') {
      const low = rbj('lowshelf', rate, 200, Math.SQRT1_2, eqDb(e.params[0]!));
      const mid = rbj('peak', rate, 1000, 1, eqDb(e.params[1]!));
      const high = rbj('highshelf', rate, 4000, Math.SQRT1_2, eqDb(e.params[2]!));
      for (const ch of channels) { runBiquad(ch, low); runBiquad(ch, mid); runBiquad(ch, high); }
    } else if (e.name === 'rv') {
      freeverb(channels, rate, e.params[0]!, e.params[1]!);
    } else if (e.name === 'echo') {
      echoFx(channels, rate, e.params[0]!, e.params[1]!, e.params[2]!);
    } else if (e.name === 'gate') {
      gateFx(channels, rate, e.params[0]!);
    } else if (e.name === 'dehum') {
      dehumFx(channels, rate, e.params[0]!);
    } else if (e.name === 'crush') {
      crushFx(channels, e.params[0]!);
    } else if (e.name === 'rev') {
      for (const ch of channels) ch.reverse();
    }
    // 'clean' deliberately falls through untouched: the shell owns the model
    // (see the token registry docblock) and splices it around this function.
  }
}
