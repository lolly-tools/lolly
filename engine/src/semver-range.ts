// SPDX-License-Identifier: MPL-2.0
/**
 * Minimal SemVer range satisfaction — just enough to enforce a tool manifest's
 * `engineVersion` against the running ENGINE_VERSION (loader.ts, P0-3).
 *
 * Deliberately NOT a dependency: engine/package.json ships only handlebars, ajv,
 * and @lolly-tools/core, and the release plan requires keeping it that way. This
 * covers the operators tools actually use — caret (`^`), tilde (`~`),
 * comparators (`>= > <= <`), exact, and x-ranges (`1.2.x`, `1.x`) — combined
 * with whitespace/comma (AND) and `||` (OR). Prerelease/build metadata on the
 * *version* is tolerated (compared on the numeric core triple only); ranges here
 * never carry prerelease tags. Anything it genuinely can't parse is treated as
 * unsatisfiable, so an unrecognised range fails closed rather than loading a
 * tool the host may not support.
 */

type Triple = [number, number, number];

/** Parse "1.52.0" / "v1.52" / "1" (→ [1,0,0]) into a numeric triple, or null. */
export function parseVersion(v: string): Triple | null {
  const core = String(v).trim().replace(/^[v=\s]+/, '').split(/[-+]/)[0]; // drop -pre / +build
  if (!core) return null;
  const parts = core.split('.');
  const out: number[] = [];
  for (let i = 0; i < 3; i++) {
    const seg = parts[i];
    const n = seg === undefined || seg === '' ? 0 : Number(seg);
    if (!Number.isFinite(n) || n < 0) return null;
    out.push(Math.floor(n));
  }
  return out as Triple;
}

function cmp(a: Triple, b: Triple): number {
  // Tuple literal-index access is number (not number|undefined), so this is safe
  // under noUncheckedIndexedAccess. Returns sign only; magnitude is irrelevant.
  return (a[0] - b[0]) || (a[1] - b[1]) || (a[2] - b[2]);
}

function isWild(s: string | undefined): boolean {
  return s === undefined || s === '' || s === '*' || s === 'x' || s === 'X';
}

/** Turn one comparator term ("^1.2.3", ">=1.0", "1.x", "1.2.3") into a test. */
function termToPredicate(term: string): (v: Triple) => boolean {
  const t = term.trim();
  if (t === '' || t === '*' || t === 'x' || t === 'X') return () => true;

  const m = /^(\^|~|>=|<=|>|<|=)?\s*v?(.+)$/.exec(t);
  if (!m) return () => false;
  const op = m[1] ?? '';
  const core = (m[2] as string).split(/[-+]/)[0] ?? ''; // drop any pre/build on the bound
  const seg = core.split('.'); // major.minor.patch
  const majW = isWild(seg[0]);
  const minW = isWild(seg[1]);
  const patW = isWild(seg[2]);
  const maj = majW ? 0 : Math.floor(Number(seg[0]));
  const min = minW ? 0 : Math.floor(Number(seg[1]));
  const pat = patW ? 0 : Math.floor(Number(seg[2]));
  if ([maj, min, pat].some(n => !Number.isFinite(n) || n < 0)) return () => false;
  const base: Triple = [maj, min, pat];

  const atLeast = (lo: Triple) => (v: Triple) => cmp(v, lo) >= 0;
  const below = (hi: Triple) => (v: Triple) => cmp(v, hi) < 0;
  const and = (a: (v: Triple) => boolean, b: (v: Triple) => boolean) => (v: Triple) => a(v) && b(v);

  switch (op) {
    case '>=': return atLeast(base);
    case '>':  return (v: Triple) => cmp(v, base) > 0;
    case '<=': return (v: Triple) => cmp(v, base) <= 0;
    case '<':  return below(base);
    case '^': {
      // Caret: allow changes that don't modify the left-most non-zero element.
      let hi: Triple;
      if (maj > 0) hi = [maj + 1, 0, 0];
      else if (min > 0) hi = [0, min + 1, 0];
      else hi = [0, 0, pat + 1];
      return and(atLeast(base), below(hi));
    }
    case '~': {
      // Tilde: allow patch-level changes if a minor is specified, else minor.
      const hi: Triple = minW ? [maj + 1, 0, 0] : [maj, min + 1, 0];
      return and(atLeast(base), below(hi));
    }
    default: {
      // Bare version or `=`: exact when all three parts are given, else an
      // x-range (`1.2.x` → >=1.2.0 <1.3.0, `1.x` → >=1.0.0 <2.0.0, `*` → any).
      if (majW) return () => true;
      if (minW) return and(atLeast([maj, 0, 0]), below([maj + 1, 0, 0]));
      if (patW) return and(atLeast([maj, min, 0]), below([maj, min + 1, 0]));
      return (v: Triple) => cmp(v, base) === 0;
    }
  }
}

/**
 * True when `version` satisfies the SemVer `range`. Empty/`*` range matches
 * anything; an unparseable version returns false. OR groups are split on `||`;
 * within a group, whitespace/comma-separated terms are ANDed.
 */
export function satisfiesRange(version: string, range: string): boolean {
  const v = parseVersion(version);
  if (!v) return false;
  const r = String(range).trim();
  if (r === '' || r === '*') return true;

  return r.split('||').some(group => {
    const terms = group.trim().split(/[\s,]+/).filter(Boolean);
    if (terms.length === 0) return true;
    return terms.every(term => termToPredicate(term)(v));
  });
}
