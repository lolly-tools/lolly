// SPDX-License-Identifier: MPL-2.0
/**
 * PDF FunctionType 4 - the PostScript calculator function (PDF 32000-1 section 7.10.5).
 *
 * A tiny, total, side-effect-free stack language: numbers, booleans, a fixed
 * operator set, and `{…}` procedures that exist only as operands to `if`/`ifelse`.
 * No loops, no variables, no I/O. That makes it safe to interpret directly - the
 * only unbounded things are our own bugs, which the step budget below catches.
 *
 * WHY this module exists: Chromium's print backend encodes an out-of-sRGB CSS
 * colour (`oklch()`), a `conic-gradient()`, and any wide-gamut interpolated
 * gradient as a ShadingType 1 (function-based) shading driven by a FunctionType 4
 * function. Without a Type 4 evaluator the shading is dropped, `scn` clears the
 * fill, and a colour-heavy page - the Brand Studio colours tab is the reference
 * case - prints as a white ghost of itself.
 *
 * WHERE this lives: the SHELL, next to the rest of the PDF byte work. The pure engine
 * receives pre-sampled colour, never a PostScript program (see pdf-shading.ts for
 * the classifier that does the sampling). This module itself is DOM-free and
 * dependency-free so it is directly unit-testable.
 *
 * HARDENING: reachable from any uploaded PDF, so it follows the house rule for
 * untrusted binary/text parsers - every limit is explicit, nothing throws, and any
 * breach degrades to `null`, i.e. exactly the behaviour before this module existed.
 */

/** A compiled Type 4 function: inputs → outputs, or null when the program faulted
 *  (a type error, division by zero, a stack breach, the step budget). */
export type PsCalculator = (args: number[]) => number[] | null;

// ── limits ───────────────────────────────────────────────────────────────────
// Every one of these is a hostile-input guard, not a performance tuning knob.
const MAX_TOKENS = 100_000;   // a 1 MB garbage stream tokenises to well under this
const MAX_DEPTH = 32;         // `{{{{…}}}}` nesting; real programs use 2–4
const MAX_STACK = 100;        // PDF 32000-1 section 7.10.5: "at most 100 numbers"
const MAX_STEPS = 10_000;     // per evaluation; the language has no loops, so this
                              // only ever fires on pathological ifelse nests or us

// ── parse ────────────────────────────────────────────────────────────────────

type PsNode = { t: 'n'; v: number } | { t: 'o'; v: string } | { t: 'p'; v: PsProc };
type PsProc = PsNode[];

/** Operators we implement - PDF 32000-1 section 7.10.5, Table 42 in full. A token that is
 *  neither a number nor one of these fails the COMPILE, not some later sample. */
const OPS = new Set([
  // arithmetic
  'abs', 'add', 'atan', 'ceiling', 'cos', 'cvi', 'cvr', 'div', 'exp', 'floor',
  'idiv', 'ln', 'log', 'mod', 'mul', 'neg', 'round', 'sin', 'sqrt', 'sub', 'truncate',
  // relational, boolean, bitwise
  'and', 'bitshift', 'eq', 'false', 'ge', 'gt', 'le', 'lt', 'ne', 'not', 'or', 'true', 'xor',
  // conditional
  'if', 'ifelse',
  // stack
  'copy', 'dup', 'exch', 'index', 'pop', 'roll',
]);

/** Split a calculator program into `{`, `}`, numbers and operator names.
 *  `%` starts a comment to end-of-line (PDF 32000-1 section 7.2.3). */
function tokenizePs(src: string): string[] | null {
  const clean = String(src ?? '').replace(/%[^\r\n]*/g, ' ');
  const out: string[] = [];
  const re = /\{|\}|[^\s{}]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(clean))) {
    if (out.length >= MAX_TOKENS) return null;
    out.push(m[0]);
  }
  return out;
}

/** Tokens → a nested procedure tree. The whole program is one outer `{…}`;
 *  `ifelse` needs both of its branches as first-class values, hence the tree. */
function parsePs(toks: string[]): PsProc | null {
  let i = 0;
  if (toks[0] !== '{') return null;

  const proc = (depth: number): PsProc | null => {
    if (depth > MAX_DEPTH) return null;
    const body: PsProc = [];
    i++; // consume '{'
    while (i < toks.length) {
      const t = toks[i]!;
      if (t === '}') { i++; return body; }
      if (t === '{') {
        const inner = proc(depth + 1);
        if (!inner) return null;
        body.push({ t: 'p', v: inner });
        continue;
      }
      i++;
      // PostScript reals: 1, -1, .5, 1., 1e3, 16#FF is NOT valid here (Type 4
      // programs are plain decimal per section 7.10.5), so a strict decimal test is right.
      if (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(t)) {
        const v = parseFloat(t);
        if (!isFinite(v)) return null;
        body.push({ t: 'n', v });
      } else if (OPS.has(t)) {
        body.push({ t: 'o', v: t });
      } else {
        return null; // unknown token - refuse the whole program
      }
    }
    return null; // unbalanced: ran out of tokens before '}'
  };

  const root = proc(0);
  if (!root) return null;
  // Trailing tokens after the outer procedure mean we mis-parsed something.
  return i === toks.length ? root : null;
}

// ── execute ──────────────────────────────────────────────────────────────────

type PsVal = number | boolean | PsProc;

const isNum = (v: PsVal | undefined): v is number => typeof v === 'number';
const isBool = (v: PsVal | undefined): v is boolean => typeof v === 'boolean';
const isProc = (v: PsVal | undefined): v is PsProc => Array.isArray(v);
/** PostScript integers are 32-bit; `idiv`/`mod`/the bitwise ops require them. */
const isInt = (v: PsVal | undefined): v is number => typeof v === 'number' && Number.isInteger(v);

const DEG = Math.PI / 180;

interface Budget { steps: number }

/**
 * Run one procedure against the shared operand stack.
 * @returns false on ANY fault (type error, undefined result, budget breach) - the
 *          caller turns that into `null`. Faulting is always preferable to
 *          propagating a NaN into a colour.
 */
function execPs(proc: PsProc, st: PsVal[], budget: Budget, depth: number): boolean {
  if (depth > MAX_DEPTH) return false;
  for (const node of proc) {
    if (--budget.steps < 0) return false;
    if (node.t === 'n') { if (st.length >= MAX_STACK) return false; st.push(node.v); continue; }
    if (node.t === 'p') { if (st.length >= MAX_STACK) return false; st.push(node.v); continue; }

    const op = node.v;

    // ── conditionals (section 7.10.5.3) ───────────────────────────────────────────
    if (op === 'if') {
      const p = st.pop(), c = st.pop();
      if (!isProc(p) || !isBool(c)) return false;
      if (c && !execPs(p, st, budget, depth + 1)) return false;
      continue;
    }
    if (op === 'ifelse') {
      const p2 = st.pop(), p1 = st.pop(), c = st.pop();
      if (!isProc(p1) || !isProc(p2) || !isBool(c)) return false;
      if (!execPs(c ? p1 : p2, st, budget, depth + 1)) return false;
      continue;
    }
    if (op === 'true') { if (st.length >= MAX_STACK) return false; st.push(true); continue; }
    if (op === 'false') { if (st.length >= MAX_STACK) return false; st.push(false); continue; }

    // ── stack operators (section 7.10.5.4) ────────────────────────────────────────
    if (op === 'pop') { if (!st.length) return false; st.pop(); continue; }
    if (op === 'exch') {
      if (st.length < 2) return false;
      const b = st.pop()!, a = st.pop()!;
      st.push(b, a);
      continue;
    }
    if (op === 'dup') {
      if (!st.length || st.length >= MAX_STACK) return false;
      st.push(st[st.length - 1]!);
      continue;
    }
    if (op === 'copy') {
      // any1..anyn n copy → duplicates the top n. `0 copy` is legal and a no-op.
      const n = st.pop();
      if (!isInt(n) || n < 0 || n > st.length || st.length + n > MAX_STACK) return false;
      // Snapshot BEFORE pushing - st.length moves as we go.
      for (const v of st.slice(st.length - n)) st.push(v);
      continue;
    }
    if (op === 'index') {
      // anyn..any0 n index → any_n. 0-based FROM THE TOP.
      const n = st.pop();
      if (!isInt(n) || n < 0 || n >= st.length || st.length >= MAX_STACK) return false;
      st.push(st[st.length - 1 - n]!);
      continue;
    }
    if (op === 'roll') {
      // anyn-1..any0 n j roll → circular shift of the top n by j (j may be negative).
      const j = st.pop(), n = st.pop();
      if (!isInt(j) || !isInt(n) || n < 0 || n > st.length) return false;
      if (n > 0) {
        const part = st.splice(st.length - n, n);
        const k = ((j % n) + n) % n;
        st.push(...part.slice(n - k), ...part.slice(0, n - k));
      }
      continue;
    }

    // ── unary/binary numeric + boolean operators ──────────────────────────
    // `not`/`and`/`or`/`xor` are LOGICAL on booleans and BITWISE on integers
    // (section 7.10.5.2); mixing the two is a type error, deliberately.
    if (op === 'not') {
      const a = st.pop();
      if (isBool(a)) { st.push(!a); continue; }
      if (isInt(a)) { st.push(~a | 0); continue; }
      return false;
    }
    if (op === 'and' || op === 'or' || op === 'xor') {
      const b = st.pop(), a = st.pop();
      if (isBool(a) && isBool(b)) { st.push(op === 'and' ? (a && b) : op === 'or' ? (a || b) : (a !== b)); continue; }
      if (isInt(a) && isInt(b)) { st.push(op === 'and' ? (a & b) : op === 'or' ? (a | b) : (a ^ b)); continue; }
      return false;
    }
    if (op === 'bitshift') {
      // Positive shift = left; negative = right, with ZEROS shifted in (a logical
      // shift, per the PostScript language definition section bitshift) - hence `>>>`.
      const sft = st.pop(), a = st.pop();
      if (!isInt(a) || !isInt(sft) || Math.abs(sft) > 31) return false;
      st.push(sft >= 0 ? (a << sft) | 0 : (a >>> -sft) | 0);
      continue;
    }
    // eq/ne compare any two non-procedure objects; mismatched types are simply
    // unequal (PLRM `eq`), not a fault - being stricter than the language would
    // reject valid programs.
    if (op === 'eq' || op === 'ne') {
      const b = st.pop(), a = st.pop();
      if (a === undefined || b === undefined || isProc(a) || isProc(b)) return false;
      st.push(op === 'eq' ? a === b : a !== b);
      continue;
    }
    if (op === 'ge' || op === 'gt' || op === 'le' || op === 'lt') {
      const b = st.pop(), a = st.pop();
      if (!isNum(a) || !isNum(b)) return false;
      st.push(op === 'ge' ? a >= b : op === 'gt' ? a > b : op === 'le' ? a <= b : a < b);
      continue;
    }

    // Everything left is numeric.
    let out: number;
    if (op === 'add' || op === 'sub' || op === 'mul' || op === 'div' || op === 'idiv'
      || op === 'mod' || op === 'exp' || op === 'atan') {
      const b = st.pop(), a = st.pop();
      if (!isNum(a) || !isNum(b)) return false;
      switch (op) {
        case 'add': out = a + b; break;
        case 'sub': out = a - b; break;
        case 'mul': out = a * b; break;
        case 'div': if (b === 0) return false; out = a / b; break;
        // idiv truncates TOWARD ZERO and requires integer operands.
        case 'idiv': if (!isInt(a) || !isInt(b) || b === 0) return false; out = Math.trunc(a / b); break;
        // mod's sign follows the DIVIDEND - which is what JS `%` already does.
        case 'mod': if (!isInt(a) || !isInt(b) || b === 0) return false; out = a % b; break;
        case 'exp': out = Math.pow(a, b); break;
        // atan: `num den atan` → degrees in [0,360), NOT radians and NOT signed.
        // This is essential: it is how Chromium computes a hue sweep,
        // and a sign or unit slip here silently ruins every OKLCH wheel.
        default: {
          if (a === 0 && b === 0) return false;
          const deg = Math.atan2(a, b) / DEG;
          out = deg < 0 ? deg + 360 : deg;
          break;
        }
      }
    } else {
      const a = st.pop();
      if (!isNum(a)) return false;
      switch (op) {
        case 'abs': out = Math.abs(a); break;
        case 'neg': out = -a; break;
        case 'ceiling': out = Math.ceil(a); break;
        case 'floor': out = Math.floor(a); break;
        // PostScript `round` is half-away-from-zero; JS Math.round is half-up.
        case 'round': out = Math.sign(a) * Math.round(Math.abs(a)); break;
        case 'truncate': out = Math.trunc(a); break;
        case 'sqrt': if (a < 0) return false; out = Math.sqrt(a); break;
        // sin/cos take DEGREES (section 7.10.5.1).
        case 'sin': out = Math.sin(a * DEG); break;
        case 'cos': out = Math.cos(a * DEG); break;
        case 'ln': if (!(a > 0)) return false; out = Math.log(a); break;
        case 'log': if (!(a > 0)) return false; out = Math.log10(a); break;
        case 'cvi': out = Math.trunc(a); break;
        case 'cvr': out = a; break;
        default: return false;   // unreachable: OPS gated the compile
      }
    }
    if (!isFinite(out)) return false;
    if (st.length >= MAX_STACK) return false;
    st.push(out);
  }
  return true;
}

// ── public entry ─────────────────────────────────────────────────────────────

/**
 * Compile a Type 4 program ONCE into a reusable evaluator.
 *
 * Compiling up front matters: the function-based-shading classifier makes ~550
 * calls per shading, and re-tokenising a program per sample is not acceptable.
 *
 * @param src   the raw stream text, including the outer `{ … }`.
 * @param nIn   declared input count (from /Domain); inputs beyond it are ignored.
 * @param range /Range, which is MANDATORY for Type 4 (PDF 32000-1 Table 39) - it
 *              gives the output count and clips every output. Without it we cannot
 *              know how many of the values left on the stack are results, so a
 *              missing/odd-length Range refuses the compile.
 * @returns the evaluator, or null if the program is unparseable or over a limit.
 */
export function compilePostScriptCalculator(src: string, nIn: number, range: number[]): PsCalculator | null {
  if (!Array.isArray(range) || range.length < 2 || range.length % 2 !== 0) return null;
  if (!range.every((v) => typeof v === 'number' && isFinite(v))) return null;
  const nOut = range.length / 2;
  if (!(nIn >= 1) || nIn > MAX_STACK) return null;

  const toks = tokenizePs(src);
  if (!toks || !toks.length) return null;
  const prog = parsePs(toks);
  if (!prog) return null;

  return (args: number[]): number[] | null => {
    const st: PsVal[] = [];
    for (let i = 0; i < nIn; i++) {
      const v = args[i];
      if (typeof v !== 'number' || !isFinite(v)) return null;
      st.push(v);
    }
    const budget: Budget = { steps: MAX_STEPS };
    if (!execPs(prog, st, budget, 0)) return null;
    if (st.length < nOut) return null;
    // The results are the topmost nOut values, in order.
    const tail = st.slice(st.length - nOut);
    const out: number[] = [];
    for (let c = 0; c < nOut; c++) {
      const v = tail[c];
      if (!isNum(v)) return null;
      const lo = range[2 * c]!, hi = range[2 * c + 1]!;
      out.push(v < lo ? lo : v > hi ? hi : v);
    }
    return out;
  };
}
