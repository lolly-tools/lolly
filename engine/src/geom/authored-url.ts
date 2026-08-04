// SPDX-License-Identifier: MPL-2.0
/**
 * The wire form of an `AuthoredPath` — what a pen shape looks like inside one
 * `blocks` sub-field, and therefore inside a share link.
 *
 * ## Why this is not JSON
 *
 * A blocks input has TWO URL forms and a pen path has to survive both:
 *
 *   - the compact one, `field,field,field~field,field,field` (encoded by the web
 *     shell, decoded by `decodeBlocksCompact` in url-mode.ts), and
 *   - the lossless JSON fallback the shell drops to when compact is impossible.
 *
 * The compact form's two separators cannot be escaped. The value is pushed into
 * the query and `URLSearchParams` percent-DECODES the whole thing before the
 * block splitter runs, so a `%2C` written on the way out is a real `,` again on
 * the way in — which is exactly why `encodeBlocksCompact` refuses to emit a
 * compact string at all when any value contains `,` or `~`. `AuthoredPath` JSON
 * is nothing but commas, so a JSON path field would silently force every
 * layout-studio link that contains one pen shape onto the JSON fallback: the
 * whole `boxes` array, every field of every box, re-encoded as JSON. On a
 * 30-box poster that is several kilobytes of collateral damage for one shape.
 *
 * So the encoding is chosen to be delimiter-safe by construction. Every
 * character it emits is in `encodeURIComponent`'s unreserved set
 * (`A-Za-z0-9 - _ . ! * ' ( )`) minus `~`, which means three things at once:
 * there is no `,` or `~` to corrupt the split, percent-encoding expands it by
 * ZERO bytes, and the value is still legible in a raw URL.
 *
 * ## The grammar
 *
 *     value  := path ( "*" path )*
 *     path   := header ( "_" node )*
 *     header := "1" "!" kind "!" closed [ "!" tension ]
 *     node   := x "!" y [ "!" hInX "!" hInY "!" hOutX "!" hOutY [ "!" cont ] ]
 *     cont   := "c" | "s" | "y"          // corner | smooth | symmetric
 *
 * `_` separates records, `!` separates fields, `1` is the format version, and
 * trailing empty fields are trimmed — so the common case (a node-only spline
 * such as `hyperbezier`, which owns its own handles) costs two numbers per node
 * and nothing else. An empty field means "absent", not zero, so a node that
 * declares no handles round-trips as a node that declares no handles rather
 * than one whose handles are pinned at the point.
 *
 * `kind` is written out in full and validated only for SHAPE (`[a-z][a-z0-9-]*`),
 * never against a list. A spline family added in a later engine has to travel
 * through this codec unchanged — the engine that lowers it is the one that gets
 * to say whether it knows the name (see `GeomAPI.fromNodes`).
 *
 * ## Why there is a plural form
 *
 * One `AuthoredPath` holds one `nodes` run, and a great many shapes are not one
 * run: a boolean subtract punches a hole, an xor of two rings is four loops. So a
 * value is a LIST of paths, `*`-separated, and `fill-rule` does its job across
 * them. `*` is the separator because it is in `encodeURIComponent`'s unreserved
 * set (so the value still expands by zero bytes), it is neither blocks delimiter
 * (`,` / `~`), and nothing else in the grammar can emit it — records are `_`,
 * fields are `!`, `kind` is `[a-z][a-z0-9-]*`, continuity is `c`/`s`/`y`, and
 * `numOut` emits only digits, `.` and `-`.
 *
 * A ONE-path value therefore contains no `*` and is byte-identical to what the
 * singular form has always produced. Two things depend on that: links already
 * written in this format keep decoding, and the format stays a fixed point under
 * decode∘encode at both arities.
 *
 * ## One home
 *
 * `hooks.js` needs to decode (to render), the editor overlay needs both (to
 * edit), and the tests need both. Tools may not import from the engine, so the
 * codec is exposed on `host.geom` (`encodeAuthored` / `decodeAuthored`) and
 * exported from the engine barrel for shell code. Same implementation for all
 * three callers; there is no second copy to drift.
 */
import type { AuthoredPath, Continuity, Node } from './spline.ts';

/** Record and field separators. Both survive `encodeURIComponent` untouched and
 *  neither is a blocks-URL delimiter. */
const REC = '_';
const FLD = '!';
/** Path separator for the multi-contour form — see the header. Unreserved under
 *  `encodeURIComponent`, not a blocks delimiter, and unreachable by any other
 *  production in the grammar. */
const PTH = '*';
const VERSION = '1';

/**
 * Coordinate precision. Node coordinates are NORMALISED to the box frame (see
 * plans/57-pen-tool-and-vector-ops.md), so 1e-6 of a frame is a nanometre on an A4
 * page and well under a millionth of any canvas anyone renders. Fixing the
 * precision here rather than at render time is what keeps the wire form stable:
 * the same shape always encodes to the same bytes, so a link does not churn
 * because a float re-serialised differently.
 */
const DECIMALS = 6;

/** Characters in one encoded value. Above any real authored path (a 20k-node
 *  path encodes to well under this) and low enough that a hostile field costs
 *  nothing to reject. */
const MAX_CHARS = 400_000;
/** Nodes in one decoded VALUE — matches the geom API's own `maxNodes`. Counted
 *  across the whole payload rather than per path, so a value carrying N paths
 *  cannot multiply the ceiling by N. */
const MAX_NODES = 20_000;

/** Spline kinds are lower-case identifiers (`cubic`, `catmull-rom`, …). Shape
 *  only: the ENGINE owns the list of names it can lower. */
const KIND_RE = /^[a-z][a-z0-9-]*$/;

const CONT_OUT: Record<Continuity, string> = { corner: 'c', smooth: 's', symmetric: 'y' };
const CONT_IN: Record<string, Continuity> = { c: 'corner', s: 'smooth', y: 'symmetric' };

/**
 * A number, shortest safe decimal. Rounded to `DECIMALS`, exponent forms
 * rejected (they carry an `e+`, which is legal here but pointless, and a `+`
 * that percent-encodes), and a leading `0` before the point dropped — `.5`
 * instead of `0.5`, `-.5` instead of `-0.5`. `Number()` reads both back
 * exactly, and over a few hundred nodes the byte per coordinate is real.
 */
function numOut(v: number): string {
  const r = Number(v.toFixed(DECIMALS));
  // toFixed already excluded the exponent form for anything inside MAX magnitude;
  // a value large enough to need one is not a normalised coordinate.
  let s = Object.is(r, -0) ? '0' : String(r);
  if (s.includes('e') || s.includes('E')) s = r.toFixed(DECIMALS);
  if (s.startsWith('0.')) return s.slice(1);
  if (s.startsWith('-0.')) return `-${s.slice(2)}`;
  return s;
}

/**
 * A handle offset's field, or `''` for "no handle".
 *
 * The rounding happens BEFORE the zero test, and that is the whole point: a handle
 * of −3e-18 (what `sin(π)` leaves behind) is not zero, but it writes as `0` at six
 * decimals and reads back as zero, so testing the raw value would encode it as `0`
 * and re-encode it as `''`. The format has to be a fixed point under
 * decode∘encode — otherwise re-sharing an opened link changes its bytes, and any
 * cache or equality check keyed on the value churns.
 */
function handleOut(v: number | undefined): string {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '';
  const r = Number(v.toFixed(DECIMALS));
  return r === 0 ? '' : numOut(r);
}

/** A field back to a number. Empty/absent → `undefined`; anything unusable →
 *  `null`, which the caller treats as a corrupt value rather than a zero. */
function numIn(s: string | undefined): number | undefined | null {
  if (s === undefined || s === '') return undefined;
  // Number('') is 0 and Number(' 1 ') is 1: neither is something this format
  // ever emits, so accept only what it does emit.
  if (!/^-?(\d+(\.\d+)?|\.\d+)$/.test(s)) return null;
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
}

/**
 * `AuthoredPath` → one URL-safe, delimiter-safe field value.
 *
 * Throws only on a path this codec cannot represent (a `kind` that is not an
 * identifier, a non-finite coordinate) — a programming error at the call site,
 * not user input. `GeomAPI.encodeAuthored` turns it into a returned failure.
 *
 * A single path is written WITHOUT the `*` separator, so this is exactly
 * `encodeAuthoredPaths([path])` and the two arities share one wire form.
 */
export function encodeAuthoredPath(path: AuthoredPath): string {
  if (!path || typeof path !== 'object') throw new Error('authored-url: expected an authored path');
  const kind = String(path.kind ?? '');
  if (!KIND_RE.test(kind)) throw new Error(`authored-url: unusable spline kind "${kind}"`);
  const nodes = Array.isArray(path.nodes) ? path.nodes : [];
  if (nodes.length > MAX_NODES) throw new Error(`authored-url: ${nodes.length} nodes (limit ${MAX_NODES})`);

  const header = [VERSION, kind, path.closed ? '1' : '0'];
  if (typeof path.tension === 'number' && Number.isFinite(path.tension)) header.push(numOut(path.tension));

  const recs = [header.join(FLD)];
  for (const n of nodes) {
    for (const v of [n.x, n.y]) {
      if (typeof v !== 'number' || !Number.isFinite(v)) {
        throw new Error('authored-url: node coordinates must be finite numbers');
      }
    }
    const fields = [numOut(n.x), numOut(n.y)];
    // Handles are written as a block of four or not at all: writing hInX alone
    // would make the positions ambiguous, and a path that has any handle almost
    // always has more than one.
    const hs = [n.hInX, n.hInY, n.hOutX, n.hOutY].map(handleOut);
    const cont = n.continuity ? CONT_OUT[n.continuity] : '';
    if (hs.some((s) => s !== '') || cont) fields.push(...hs);
    if (cont) fields.push(cont);
    // Trim the trailing empties the handle block may have left.
    while (fields.length > 2 && fields[fields.length - 1] === '') fields.pop();
    recs.push(fields.join(FLD));
  }
  return recs.join(REC);
}

/**
 * Several `AuthoredPath`s → one field value, `*`-separated.
 *
 * A one-element list encodes byte-identically to `encodeAuthoredPath` of its only
 * member; there is no length marker and no wrapper. Throws on the same
 * programming errors the singular form does, plus an empty list (a value with no
 * paths in it is not a value) and a node total past `MAX_NODES` — the ceiling is
 * on the payload, so N paths cannot multiply it.
 */
export function encodeAuthoredPaths(paths: AuthoredPath[]): string {
  if (!Array.isArray(paths) || !paths.length) {
    throw new Error('authored-url: expected at least one authored path');
  }
  let total = 0;
  for (const p of paths) total += Array.isArray(p?.nodes) ? p.nodes.length : 0;
  if (total > MAX_NODES) throw new Error(`authored-url: ${total} nodes across the value (limit ${MAX_NODES})`);
  return paths.map(encodeAuthoredPath).join(PTH);
}

/**
 * Why a value would not decode. The distinction exists because a caller has two
 * genuinely different things to say to a user: "that is not a shape" and "that
 * shape is bigger than this engine will read". Everything else about the failure
 * posture is unchanged — nothing is ever partially decoded.
 */
export type AuthoredDecodeFail = 'malformed' | 'too-complex';

/**
 * One field value → the paths it carries, or WHY it carries none.
 *
 * A reason rather than a throw, and rather than a best-effort partial path: this
 * runs on a hand-editable URL param on every render, and the useful answers are
 * "here are the shapes" and "there are no shapes here, for this reason". A
 * half-decoded path would render as confidently-wrong artwork.
 */
export function decodeAuthoredPathsResult(value: string): AuthoredPath[] | AuthoredDecodeFail {
  if (typeof value !== 'string') return 'malformed';
  const s = value.trim();
  if (!s) return 'malformed';
  if (s.length > MAX_CHARS) return 'too-complex';

  const out: AuthoredPath[] = [];
  let total = 0;
  for (const part of s.split(PTH)) {
    const one = decodeOne(part);
    if (typeof one === 'string') return one;
    total += one.nodes.length;
    if (total > MAX_NODES) return 'too-complex';
    out.push(one);
  }
  return out;
}

/**
 * The same thing with the reason dropped — `null` for "no shapes here", whatever
 * the reason. What a caller that only renders wants.
 */
export function decodeAuthoredPaths(value: string): AuthoredPath[] | null {
  const r = decodeAuthoredPathsResult(value);
  return typeof r === 'string' ? null : r;
}

/**
 * One field value → the ONE `AuthoredPath` it carries, or `null`.
 *
 * A value carrying several paths answers `null`, deliberately: returning the
 * first of them would be a silent, partial read of the value — the same class of
 * defect as decoding half a path. Callers that may be handed either arity call
 * `decodeAuthoredPaths` and handle a list.
 */
export function decodeAuthoredPath(value: string): AuthoredPath | null {
  const r = decodeAuthoredPaths(value);
  return r && r.length === 1 ? r[0]! : null;
}

/** One `*`-separated segment. */
function decodeOne(value: string): AuthoredPath | AuthoredDecodeFail {
  const s = value;
  if (!s) return 'malformed';
  const recs = s.split(REC);
  const header = recs[0]!.split(FLD);
  if (header[0] !== VERSION) return 'malformed';
  const kind = header[1] ?? '';
  if (!KIND_RE.test(kind)) return 'malformed';
  const closed = header[2] === '1';
  let tension: number | undefined;
  if (header.length > 3) {
    const t = numIn(header[3]);
    if (t === null) return 'malformed';
    tension = t;
  }
  if (recs.length - 1 > MAX_NODES) return 'too-complex';

  const nodes: Node[] = [];
  for (let i = 1; i < recs.length; i++) {
    const f = recs[i]!.split(FLD);
    const x = numIn(f[0]);
    const y = numIn(f[1]);
    if (x === null || y === null || x === undefined || y === undefined) return 'malformed';
    const node: Node = { x, y };
    const keys = ['hInX', 'hInY', 'hOutX', 'hOutY'] as const;
    for (let k = 0; k < keys.length; k++) {
      const v = numIn(f[2 + k]);
      if (v === null) return 'malformed';
      if (v !== undefined) node[keys[k]!] = v;
    }
    const c = f[6];
    if (c !== undefined && c !== '') {
      const cont = CONT_IN[c];
      if (!cont) return 'malformed';
      node.continuity = cont;
    }
    if (f.length > 7) return 'malformed';
    nodes.push(node);
  }
  if (!nodes.length) return 'malformed';
  return { kind, nodes, closed, ...(tension !== undefined ? { tension } : {}) } as AuthoredPath;
}
