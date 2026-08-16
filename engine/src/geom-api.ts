// SPDX-License-Identifier: MPL-2.0
/**
 * `host.geom` - the tool-facing face of the geometry kernel (HostV1 v1.64).
 *
 * Sits at top level rather than inside `geom/` for the same reason `color-tools.ts`
 * does: `geom/` is the kernel, this is the bridge over it. Nothing here does geometry
 * - every operation is delegated to `geom/*` verbatim. What this module actually owns
 * is the three things that stand between a tool and that kernel:
 *
 * 1. **Currency.** Tools speak SVG path data. The kernel speaks `GeomPath` (contours
 *    of flat 8-number cubics). A tool cannot import `Cubic`, so `d` in / `d` out is
 *    the contract and the structured form is offered, not required.
 * 2. **Bounded parsing.** A `d` string reaching a tool is untrusted by default - it
 *    can come from a paste, a URL param, or an imported SVG. `parseSvgPath` is a
 *    tokenizer built for the engine's own well-formed output: it is lenient, silently
 *    ignoring garbage and short argument runs. That is the right posture for a sink
 *    that already trusts its input and the wrong one here, so this module validates
 *    the grammar FIRST - size, command vocabulary, argument arity, number syntax,
 *    coordinate magnitude - and rejects rather than guesses. (See `validatePathData`.)
 * 3. **Error shape.** The kernel THROWS `GeomLimitError` rather than return a
 *    plausible wrong answer, which is right for engine callers and wrong for hooks: a
 *    throw from `onInit`/`onInput` is caught, logged and DISCARDED by the runtime, so
 *    the user's pen tool would just stop responding with nothing on screen to say
 *    why. Every method here returns a discriminated result instead, with a `code`
 *    that keeps the kernel's distinctions intact - `'limit'` (cannot be answered) is
 *    never conflated with `'invalid-path'` (your input was wrong) or with `ok: true,
 *    d: ''` (the answer is legitimately empty).
 *
 * Pure, synchronous, DOM-free - every shell attaches this same object.
 */
import type {
  GeomAPI, GeomAuthoredPath, GeomBooleanOpts, GeomBox, GeomContour, GeomErrorCode,
  GeomFailure, GeomLimits, GeomNearest, GeomNode, GeomOffsetOpts, GeomPathResult,
  GeomResult, GeomStrokeOpts,
} from './bridge/host-v1.ts';
import { type Cubic, nearestOnCubic } from './geom/bezier.ts';
import {
  type Contour, type GeomPath, contourArea, pathBounds, pathFromSubPaths, toSvgPathData,
} from './geom/path.ts';
import {
  type BooleanOptions, GeomLimitError, differencePath, intersectPath, pointInPath,
  selfUnion, unionPath, windingNumber, xorPath,
} from './geom/boolean.ts';
import { type OffsetOptions, offsetPath } from './geom/offset.ts';
import { strokeToPath } from './geom/stroke.ts';
import { type AuthoredPath, type Node as SplineNode, enforceContinuity, toCubics } from './geom/spline.ts';
import { decodeAuthoredPathsResult, encodeAuthoredPaths } from './geom/authored-url.ts';
import { simplifyCubics } from './geom/fit.ts';
import { parseSvgPath } from './svg-path.ts';

// ── ceilings ──────────────────────────────────────────────────────────────────
// Sized above any real authored path and below where the superlinear kernel passes
// stop being interactive. They are reported through `limits()` so a tool can check a
// path before offering an operation on it, rather than after failing one.

/** Characters in one `d`. A 512 kB path is a 200-page glyph dump, not a tool input,
 *  and checking the length before any regex touches the string is what keeps a
 *  megabyte of `MMMM…` from costing anything at all. */
const MAX_CHARS = 512_000;
/** Commands in one `d`. */
const MAX_COMMANDS = 20_000;
/** Cubics after normalisation. Below the kernel's own 8000-per-operand pairwise
 *  ceiling times two, so a path that parses can at least be attempted. */
const MAX_CURVES = 16_000;
/** Operands per boolean call. A selection, not a scene. */
const MAX_PATHS = 64;
const MAX_NODES = 20_000;
/**
 * Coordinate magnitude. Not a canvas size - a guard on numbers that are corrupt
 * rather than large: at 1e9 px the double still has ~1e-7 of resolution, while an
 * arc radius of 1e200 squares to Infinity inside the endpoint parameterisation and
 * every coordinate downstream of it becomes NaN.
 */
const MAX_COORD = 1e9;

const LIMITS: GeomLimits = {
  maxChars: MAX_CHARS,
  maxCommands: MAX_COMMANDS,
  maxCurves: MAX_CURVES,
  maxCoordinate: MAX_COORD,
  maxPaths: MAX_PATHS,
  maxNodes: MAX_NODES,
};

// ── results ───────────────────────────────────────────────────────────────────

function fail(code: GeomErrorCode, message: string): GeomFailure {
  return { ok: false, code, message };
}

function isFail(v: unknown): v is GeomFailure {
  return typeof v === 'object' && v !== null && (v as { ok?: unknown }).ok === false;
}

function ok<T>(value: T): GeomResult<T> {
  return { ok: true, value };
}

/** A path result, with the counts a caller uses to decide whether to simplify. */
function pathOut(p: GeomPath, decimals?: number): GeomPathResult {
  const dp = usableDecimals(decimals);
  let curves = 0;
  for (const c of p) curves += c.curves.length;
  // The kernel is exact and every input was finiteness-checked, so a non-finite here
  // is an engine defect. Reporting it beats emitting `M NaN NaN` into a template.
  for (const c of p) {
    for (const k of c.curves) {
      for (const v of k) {
        if (!Number.isFinite(v)) return fail('internal', 'geom: operation produced a non-finite coordinate');
      }
    }
  }
  return { ok: true, d: toSvgPathData(p, dp), contours: p.length, curves };
}

function usableDecimals(dp: number | undefined): number {
  if (typeof dp !== 'number' || !Number.isFinite(dp)) return 4;
  return Math.max(0, Math.min(12, Math.round(dp)));
}

/**
 * Run a kernel call, translating its throws into codes.
 *
 * `GeomLimitError` is the only one the kernel raises deliberately, and it means
 * exactly one thing: the answer exists and this engine declines to guess at it. Every
 * other throw is either a declared-but-unimplemented feature (the spline lowerings
 * say so in their message) or a defect, and the two are kept apart because a caller
 * does different things about them - pick another spline kind, versus file a bug.
 */
function attempt(run: () => GeomPathResult): GeomPathResult {
  try {
    return run();
  } catch (e) {
    if (e instanceof GeomLimitError) return fail('limit', e.message);
    const msg = e instanceof Error ? e.message : String(e);
    // The spline lowering says which of the two it is, and the two are matched on
    // rather than enumerated here on purpose: a family added to `SplineKind` later
    // starts working through this bridge with no edit, and one declared but not yet
    // lowered reports 'unsupported' rather than "unknown".
    if (/unknown spline kind/i.test(msg)) return fail('invalid-argument', `geom: ${msg}`);
    if (/not implemented/i.test(msg)) return fail('unsupported', `geom: ${msg}`);
    return fail('internal', `geom: ${msg}`);
  }
}

// ── path-data validation ──────────────────────────────────────────────────────

/** Argument count per command. Every run must be a non-zero multiple of it (SVG
 *  1.1 section 8.3: a command with a short trailing run is in error, not truncated). */
const ARITY: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };
/** Curves one command's argument group can contribute, for the pre-parse estimate.
 *  An arc is up to four (one per ≤90° sweep), everything else is one. */
const CURVES_PER_GROUP: Record<string, number> = { M: 1, L: 1, H: 1, V: 1, C: 1, S: 1, Q: 1, T: 1, A: 4, Z: 0 };

const NUM_RE = /[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/y;
const FLAG_RE = /[01]/y;
const SEP_RE = /[\s,]*/y;
/** Characters a number token may begin with. Non-sticky and single-char - used only to
 *  decide whether an argument run continues. */
const NUM_START = /[0-9.+-]/;

/**
 * Validate an SVG `d` string against the grammar, bounded, before any parsing.
 *
 * Single forward pass, no backtracking and no recursion, so the cost is linear in the
 * string length and the stack depth is constant - the two properties the hostile-input
 * posture actually needs. It rejects, in order: oversized input, a first command that
 * is not a move, an unknown command letter, an argument run that is not a whole
 * number of groups, a number token that does not terminate (`1e`, `.`, `--3`), a
 * non-finite or absurd coordinate, and any character the grammar has no place for.
 *
 * Returns the command count on success - the caller uses it for nothing except a
 * bound, but a bound that has already been paid for.
 */
function validatePathData(d: string): { commands: number } | GeomFailure {
  if (d.length > MAX_CHARS) {
    return fail('too-large', `geom: path data is ${d.length} chars (limit ${MAX_CHARS})`);
  }
  let i = 0;
  let commands = 0;
  let curves = 0;
  const skipSep = (): void => { SEP_RE.lastIndex = i; SEP_RE.exec(d); i = SEP_RE.lastIndex; };
  /** One number token, validated for finiteness and magnitude. */
  const number = (): number | GeomFailure | null => {
    skipSep();
    NUM_RE.lastIndex = i;
    const m = NUM_RE.exec(d);
    if (!m) return null;
    const v = Number(m[0]);
    if (!Number.isFinite(v)) return fail('invalid-path', `geom: non-finite number "${m[0]}" at offset ${i}`);
    if (Math.abs(v) > MAX_COORD) {
      return fail('invalid-path', `geom: coordinate ${m[0]} exceeds ±${MAX_COORD} at offset ${i}`);
    }
    i = NUM_RE.lastIndex;
    return v;
  };
  const flag = (): number | null => {
    skipSep();
    FLAG_RE.lastIndex = i;
    const m = FLAG_RE.exec(d);
    if (!m) return null;
    i = FLAG_RE.lastIndex;
    return Number(m[0]);
  };

  skipSep();
  if (i >= d.length) return { commands: 0 };   // empty / whitespace-only is an empty path
  if (d[i] !== 'M' && d[i] !== 'm') {
    return fail('invalid-path', 'geom: path data must begin with a moveto (M or m)');
  }

  while (i < d.length) {
    const letter = d[i]!;
    const C = letter.toUpperCase();
    const arity = ARITY[C];
    if (arity === undefined) {
      return fail('invalid-path', `geom: unknown path command "${letter}" at offset ${i}`);
    }
    i++;
    commands++;
    if (commands > MAX_COMMANDS) {
      return fail('too-large', `geom: over ${MAX_COMMANDS} path commands`);
    }
    if (C === 'Z') { skipSep(); continue; }

    // Argument groups, until the next command letter or the end of the string.
    let groups = 0;
    for (;;) {
      skipSep();
      if (i >= d.length) break;
      // Only a number can continue the run. A command letter ends it; anything else
      // is garbage, and reporting it as an unknown COMMAND (which the outer loop does
      // on the next turn) says more than "incomplete arguments" would.
      if (!NUM_START.test(d[i]!)) break;
      for (let a = 0; a < arity; a++) {
        // Arc flags are single '0'/'1' characters that may abut the next number with
        // no separator ("0110" is laf 0, swf 1, x 10) - the generic number tokenizer
        // reads that as one number, so arcs need the grammar-aware form.
        const isFlag = C === 'A' && (a === 3 || a === 4);
        const v = isFlag ? flag() : number();
        if (isFail(v)) return v;
        if (v === null) {
          return fail('invalid-path', `geom: "${letter}" has an incomplete argument group at offset ${i}`);
        }
      }
      groups++;
      curves += (CURVES_PER_GROUP[C] ?? 1);
      if (curves > MAX_CURVES) {
        return fail('too-large', `geom: over ${MAX_CURVES} curves after normalisation`);
      }
    }
    if (groups === 0) {
      return fail('invalid-path', `geom: "${letter}" has no arguments at offset ${i}`);
    }
    skipSep();
  }
  return { commands };
}

/**
 * Path data → the kernel's path model, validated and bounded.
 *
 * Arcs and quadratics are converted EXACTLY where an exact conversion exists, by
 * `svg-path.ts` (the engine's one tokenizer, shared with the PDF/EMF/EPS/DXF sinks):
 * Q/T raise to a cubic by the standard degree elevation (control points at ⅔ of the
 * way from each endpoint to the quadratic's control), which is exact; A decomposes by
 * the SVG spec's endpoint parameterisation (F.6.5 - out-of-range radii scaled up per
 * F.6.6) into one cubic per ≤90° sweep with the k = 4/3·tan(Δθ/4) tangent scaling,
 * which is the standard circular-arc approximation and is exact at both endpoints and
 * in tangent direction there. H/V and the S/T reflections are exact by definition.
 */
function parsePath(d: unknown): GeomPath | GeomFailure {
  if (typeof d !== 'string') return fail('invalid-argument', 'geom: path data must be a string');
  const v = validatePathData(d);
  if (isFail(v)) return v;
  if (v.commands === 0) return [];
  const path = pathFromSubPaths(parseSvgPath(d));
  let curves = 0;
  for (const c of path) curves += c.curves.length;
  if (curves > MAX_CURVES) {
    return fail('too-large', `geom: ${curves} curves after normalisation (limit ${MAX_CURVES})`);
  }
  // Belt and braces over the arc decomposition: the inputs are magnitude-checked, but
  // a near-degenerate ellipse divides by a radius, and one NaN in a control point
  // poisons every operation downstream of it silently.
  for (const c of path) {
    for (const k of c.curves) {
      for (const n of k) {
        if (!Number.isFinite(n)) return fail('invalid-path', 'geom: path data yields a non-finite coordinate');
      }
    }
  }
  return path;
}

/** Several operands at once - the selection shape every boolean takes. */
function parsePaths(ds: unknown): GeomPath[] | GeomFailure {
  if (!Array.isArray(ds)) return fail('invalid-argument', 'geom: expected an array of path-data strings');
  if (ds.length === 0) return fail('invalid-argument', 'geom: no paths given');
  if (ds.length > MAX_PATHS) {
    return fail('too-large', `geom: ${ds.length} operands (limit ${MAX_PATHS})`);
  }
  const out: GeomPath[] = [];
  for (const d of ds) {
    const p = parsePath(d);
    if (isFail(p)) return p;
    out.push(p);
  }
  return out;
}

function booleanOpts(o: GeomBooleanOpts | undefined): BooleanOptions {
  const out: BooleanOptions = {};
  if (typeof o?.tolerance === 'number') out.tol = o.tolerance;
  if (o?.fillRule) out.fillRule = o.fillRule;
  return out;
}

function offsetOpts(o: GeomOffsetOpts | undefined): OffsetOptions {
  const out: OffsetOptions = {};
  if (o?.join) out.join = o.join;
  if (typeof o?.miterLimit === 'number') out.miterLimit = o.miterLimit;
  if (typeof o?.tolerance === 'number') out.tol = o.tolerance;
  return out;
}

/** Reject the option values the kernel would otherwise absorb into a default. A
 *  misspelled join style is an authoring error, and quietly mitring where the tool
 *  asked to round is the class of silence this API exists to avoid. */
function checkEnums(o: {
  join?: string; cap?: string; fillRule?: string; tolerance?: number; miterLimit?: number;
} | undefined): GeomFailure | null {
  if (o?.join && !['miter', 'round', 'bevel'].includes(o.join)) {
    return fail('invalid-argument', `geom: unknown join style "${String(o.join)}"`);
  }
  if (o?.cap && !['butt', 'round', 'square'].includes(o.cap)) {
    return fail('invalid-argument', `geom: unknown cap style "${String(o.cap)}"`);
  }
  if (o?.fillRule && o.fillRule !== 'nonzero' && o.fillRule !== 'evenodd') {
    return fail('invalid-argument', `geom: unknown fill rule "${String(o.fillRule)}"`);
  }
  for (const [k, v] of [['tolerance', o?.tolerance], ['miterLimit', o?.miterLimit]] as const) {
    if (v !== undefined && (typeof v !== 'number' || !Number.isFinite(v) || v <= 0)) {
      return fail('invalid-argument', `geom: ${k} must be a finite positive number`);
    }
  }
  return null;
}

/** Fold a two-operand boolean left to right over a whole selection. A single operand
 *  folds to its own canonical form, which is the right answer for all four ops. */
function fold(
  paths: GeomPath[],
  op: (a: GeomPath, b: GeomPath, o: BooleanOptions) => GeomPath,
  o: BooleanOptions,
): GeomPath {
  let acc = selfUnion(paths[0]!, o);
  for (let i = 1; i < paths.length; i++) acc = op(acc, paths[i]!, o);
  return acc;
}

// ── structured form ───────────────────────────────────────────────────────────

function contoursOut(p: GeomPath): GeomContour[] {
  return p.map((c) => ({ curves: c.curves.map((k) => [...k]), closed: c.closed }));
}

function contoursIn(input: unknown): GeomPath | GeomFailure {
  if (!Array.isArray(input)) return fail('invalid-argument', 'geom: expected an array of contours');
  const out: GeomPath = [];
  let total = 0;
  for (const c of input) {
    const curves = (c as GeomContour | null)?.curves;
    if (!Array.isArray(curves)) return fail('invalid-argument', 'geom: each contour needs a `curves` array');
    total += curves.length;
    if (total > MAX_CURVES) return fail('too-large', `geom: over ${MAX_CURVES} curves`);
    const built: Cubic[] = [];
    for (const k of curves) {
      if (!Array.isArray(k) || k.length !== 8) {
        return fail('invalid-argument', 'geom: each curve must be 8 numbers [x0,y0,x1,y1,x2,y2,x3,y3]');
      }
      for (const n of k) {
        if (typeof n !== 'number' || !Number.isFinite(n) || Math.abs(n) > MAX_COORD) {
          return fail('invalid-argument', `geom: curve coordinate ${String(n)} is not a usable number`);
        }
      }
      built.push([...k] as Cubic);
    }
    out.push({ curves: built, closed: (c as GeomContour).closed === true });
  }
  return out;
}

// ── authored splines ──────────────────────────────────────────────────────────

const CONTINUITIES = ['corner', 'smooth', 'symmetric'];

function nodeIn(n: unknown): SplineNode | GeomFailure {
  const o = n as GeomNode | null;
  if (!o || typeof o !== 'object') return fail('invalid-argument', 'geom: node must be an object');
  for (const key of ['x', 'y', 'hInX', 'hInY', 'hOutX', 'hOutY'] as const) {
    const v = o[key];
    if (v === undefined) {
      if (key === 'x' || key === 'y') return fail('invalid-argument', `geom: node.${key} is required`);
      continue;
    }
    if (typeof v !== 'number' || !Number.isFinite(v) || Math.abs(v) > MAX_COORD) {
      return fail('invalid-argument', `geom: node.${key} is not a usable number`);
    }
  }
  if (o.continuity !== undefined && !CONTINUITIES.includes(o.continuity)) {
    return fail('invalid-argument', `geom: unknown continuity "${String(o.continuity)}"`);
  }
  return o as SplineNode;
}

// ── the API ───────────────────────────────────────────────────────────────────

/**
 * The `host.geom` bridge implementation (HostV1 v1.64, optional/additive).
 * Every shell attaches THIS (`host.geom = makeGeomApi()`) instead of implementing
 * anything, so the surface can never drift between web, CLI and Tauri.
 */
export function makeGeomApi(): GeomAPI {
  const boolOp = (
    ds: unknown,
    op: (a: GeomPath, b: GeomPath, o: BooleanOptions) => GeomPath,
    opts: GeomBooleanOpts | undefined,
  ): GeomPathResult => {
    const bad = checkEnums(opts);
    if (bad) return bad;
    const paths = parsePaths(ds);
    if (isFail(paths)) return paths;
    return attempt(() => pathOut(fold(paths, op, booleanOpts(opts)), opts?.decimals));
  };

  return {
    union: (paths, opts) => boolOp(paths, (a, b, o) => unionPath(a, b, o), opts),
    intersect: (paths, opts) => boolOp(paths, (a, b, o) => intersectPath(a, b, o), opts),
    difference: (paths, opts) => boolOp(paths, (a, b, o) => differencePath(a, b, o), opts),
    xor: (paths, opts) => boolOp(paths, (a, b, o) => xorPath(a, b, o), opts),

    selfUnion: (d, opts) => {
      const bad = checkEnums(opts);
      if (bad) return bad;
      const p = parsePath(d);
      if (isFail(p)) return p;
      return attempt(() => pathOut(selfUnion(p, booleanOpts(opts)), opts?.decimals));
    },

    offset: (d, distance, opts) => {
      const bad = checkEnums(opts);
      if (bad) return bad;
      if (typeof distance !== 'number' || !Number.isFinite(distance)) {
        return fail('invalid-argument', 'geom: offset distance must be a finite number');
      }
      if (Math.abs(distance) > MAX_COORD) {
        return fail('invalid-argument', `geom: offset distance exceeds ±${MAX_COORD}`);
      }
      const p = parsePath(d);
      if (isFail(p)) return p;
      return attempt(() => pathOut(offsetPath(p, distance, offsetOpts(opts)), opts?.decimals));
    },

    stroke: (d, width, opts) => {
      const bad = checkEnums(opts);
      if (bad) return bad;
      if (typeof width !== 'number' || !Number.isFinite(width) || width <= 0) {
        return fail('invalid-argument', 'geom: stroke width must be a finite positive number');
      }
      if (width > MAX_COORD) return fail('invalid-argument', `geom: stroke width exceeds ${MAX_COORD}`);
      const p = parsePath(d);
      if (isFail(p)) return p;
      return attempt(() => pathOut(strokeToPath(p, width, {
        ...offsetOpts(opts),
        ...(opts?.cap ? { cap: opts.cap } : {}),
      }), opts?.decimals));
    },

    simplify: (d, opts) => {
      const tol = opts?.tolerance;
      if (tol !== undefined && (typeof tol !== 'number' || !Number.isFinite(tol) || tol <= 0)) {
        return fail('invalid-argument', 'geom: tolerance must be a finite positive number');
      }
      const p = parsePath(d);
      if (isFail(p)) return p;
      return attempt(() => pathOut(
        p.map((c): Contour => ({ curves: simplifyCubics(c.curves, tol), closed: c.closed })),
      ));
    },

    fromNodes: (path) => {
      const src = path as GeomAuthoredPath | null;
      if (!src || typeof src !== 'object') return fail('invalid-argument', 'geom: expected an authored path');
      if (typeof src.kind !== 'string' || !src.kind) {
        return fail('invalid-argument', 'geom: authored path needs a `kind` string');
      }
      if (!Array.isArray(src.nodes)) return fail('invalid-argument', 'geom: authored path needs a `nodes` array');
      if (src.nodes.length > MAX_NODES) {
        return fail('too-large', `geom: ${src.nodes.length} nodes (limit ${MAX_NODES})`);
      }
      if (src.tension !== undefined && (typeof src.tension !== 'number' || !Number.isFinite(src.tension))) {
        return fail('invalid-argument', 'geom: tension must be a finite number');
      }
      const nodes: SplineNode[] = [];
      for (const n of src.nodes) {
        const v = nodeIn(n);
        if (isFail(v)) return v;
        nodes.push(v);
      }
      // The KIND is validated by the engine, not here: that is what lets a spline
      // family added in a later engine reach it through an unchanged bridge. The
      // lowering distinguishes "never heard of it" from "declared, not implemented
      // yet" in its message, and `attempt` maps those to different codes.
      const authored = {
        kind: src.kind, nodes, closed: src.closed === true,
        ...(src.tension !== undefined ? { tension: src.tension } : {}),
      } as AuthoredPath;
      return attempt(() => {
        const curves = toCubics(authored);
        return pathOut(curves.length ? [{ curves, closed: authored.closed }] : [], src.decimals);
      });
    },

    encodeAuthored: (path) => {
      // One path or several: a shape with a hole is two contours and an
      // `AuthoredPath` holds exactly one `nodes` run, so the list is the general
      // case. A single path is written identically either way.
      const list = Array.isArray(path) ? path : [path];
      if (!list.length) return fail('invalid-argument', 'geom: expected at least one authored path');
      const built: AuthoredPath[] = [];
      let total = 0;
      for (const entry of list) {
        const src = entry as GeomAuthoredPath | null;
        if (!src || typeof src !== 'object') return fail('invalid-argument', 'geom: expected an authored path');
        if (!Array.isArray(src.nodes) || !src.nodes.length) {
          return fail('invalid-argument', 'geom: authored path needs at least one node');
        }
        // The node ceiling is on the whole VALUE, so a list of paths cannot
        // multiply it by its own length.
        total += src.nodes.length;
        if (total > MAX_NODES) return fail('too-large', `geom: ${total} nodes (limit ${MAX_NODES})`);
        // Validate every node through the SAME gate `fromNodes` uses, so a path that
        // encodes is a path that lowers - an encoded value that cannot be rendered
        // would be a link the recipient can only look at.
        const nodes: SplineNode[] = [];
        for (const n of src.nodes) {
          const v = nodeIn(n);
          if (isFail(v)) return v;
          nodes.push(v);
        }
        built.push({
          kind: String(src.kind ?? ''), nodes, closed: src.closed === true,
          ...(src.tension !== undefined ? { tension: src.tension } : {}),
        } as AuthoredPath);
      }
      try {
        return ok(encodeAuthoredPaths(built));
      } catch (e) {
        return fail('invalid-argument', `geom: ${e instanceof Error ? e.message : String(e)}`);
      }
    },

    decodeAuthored: (value) => {
      if (typeof value !== 'string') return fail('invalid-argument', 'geom: expected an encoded authored path');
      const r = decodeAuthoredPathsResult(value);
      // 'too-complex' is well-formed-but-past-the-ceiling, which is what
      // `'too-large'` means everywhere else in this API; it is never conflated with
      // "that is not an encoded path".
      if (r === 'too-complex') return fail('too-large', `geom: encoded path is past the ${MAX_NODES}-node ceiling`);
      if (r === 'malformed') return fail('invalid-argument', 'geom: not a usable encoded authored path');
      return ok(r as GeomAuthoredPath[]);
    },

    continuity: (node, moved) => {
      if (moved !== 'in' && moved !== 'out') {
        return fail('invalid-argument', "geom: `moved` must be 'in' or 'out'");
      }
      const n = nodeIn(node);
      if (isFail(n)) return n;
      try {
        return ok(enforceContinuity(n, moved) as GeomNode);
      } catch (e) {
        return fail('internal', `geom: ${e instanceof Error ? e.message : String(e)}`);
      }
    },

    bounds: (d) => {
      const p = parsePath(d);
      if (isFail(p)) return p;
      return ok(pathBounds(p) as GeomBox | null);
    },

    area: (d) => {
      const p = parsePath(d);
      if (isFail(p)) return p;
      let a = 0;
      for (const c of p) a += contourArea(c);
      return Number.isFinite(a) ? ok(a) : fail('internal', 'geom: area is not finite');
    },

    contains: (d, x, y, opts) => {
      const pt = point(x, y);
      if (isFail(pt)) return pt;
      const rule = opts?.fillRule ?? 'nonzero';
      if (rule !== 'nonzero' && rule !== 'evenodd') {
        return fail('invalid-argument', `geom: unknown fill rule "${String(rule)}"`);
      }
      const p = parsePath(d);
      if (isFail(p)) return p;
      try {
        return ok(pointInPath(p, x, y, rule));
      } catch (e) {
        return fail('internal', `geom: ${e instanceof Error ? e.message : String(e)}`);
      }
    },

    winding: (d, x, y) => {
      const pt = point(x, y);
      if (isFail(pt)) return pt;
      const p = parsePath(d);
      if (isFail(p)) return p;
      try {
        const w = windingNumber(p, x, y);
        return Number.isFinite(w) ? ok(w) : fail('internal', 'geom: winding number is not finite');
      } catch (e) {
        return fail('internal', `geom: ${e instanceof Error ? e.message : String(e)}`);
      }
    },

    /**
     * Nearest point, by projecting onto every curve and keeping the closest - the
     * kernel's own `nearestOnCubic` (bracket then Newton on the squared-distance
     * derivative), so the answer is computed FROM the curve rather than sampled near
     * it, and the `t` it reports is the parameter to split at to insert a node.
     * `distanceToPath` would give the distance alone and the address is the half a
     * pen tool actually needs.
     */
    nearest: (d, x, y) => {
      const pt = point(x, y);
      if (isFail(pt)) return pt;
      const p = parsePath(d);
      if (isFail(p)) return p;
      let best: GeomNearest | null = null;
      for (let ci = 0; ci < p.length; ci++) {
        const curves = p[ci]!.curves;
        for (let ki = 0; ki < curves.length; ki++) {
          const r = nearestOnCubic(curves[ki]!, x, y);
          if (!Number.isFinite(r.distance)) continue;
          if (!best || r.distance < best.distance) {
            best = { x: r.point.x, y: r.point.y, distance: r.distance, contour: ci, curve: ki, t: r.t };
          }
        }
      }
      if (!best) return fail('invalid-path', 'geom: path has no curves to measure against');
      return ok(best);
    },

    parse: (d) => {
      const p = parsePath(d);
      if (isFail(p)) return p;
      return ok(contoursOut(p));
    },

    toPathData: (contours, opts) => {
      const p = contoursIn(contours);
      if (isFail(p)) return p;
      return pathOut(p, opts?.decimals);
    },

    limits: () => ({ ...LIMITS }),
  };
}

/** A probe point has to be a real coordinate: NaN compares false against every
 *  bound, so an unchecked one makes a hit test answer "outside" everywhere. */
function point(x: unknown, y: unknown): true | GeomFailure {
  for (const [k, v] of [['x', x], ['y', y]] as const) {
    if (typeof v !== 'number' || !Number.isFinite(v) || Math.abs(v) > MAX_COORD) {
      return fail('invalid-argument', `geom: ${k} must be a finite coordinate`);
    }
  }
  return true;
}
