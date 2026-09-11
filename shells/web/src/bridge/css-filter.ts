// SPDX-License-Identifier: MPL-2.0
/**
 * CSS `filter` → SVG filter primitives.
 *
 * Every CSS shorthand filter is DEFINED by the Filter Effects spec (section 18.1) as an
 * equivalent SVG filter - `grayscale(x)` is a specific feColorMatrix, `contrast(x)`
 * a specific feComponentTransfer. So this is a translation table, not an
 * approximation, and the numbers below are the spec's own matrices rather than
 * anything tuned by eye.
 *
 * Before this, a filtered element simply lost its filter in vector output: 49 of them
 * on the gallery fixture alone. `drop-shadow()` is excluded - the walker already
 * draws those as real geometry, which survives EMF/EPS where a filter would not.
 *
 * Pure: it returns primitive descriptors, and export.ts turns them into elements.
 */

export type FilterPrimitive =
  | { kind: 'blur'; stdDeviation: number }
  | { kind: 'colorMatrix'; values: number[] }
  | {
      kind: 'componentTransfer';
      slope?: number;
      intercept?: number;
      amount?: number;
      mode: 'linear' | 'invert' | 'alpha';
    }
  | { kind: 'hueRotate'; deg: number };

/** `10px` / `0.4` / `40%` → a number. Percentages are fractions. */
function amount(raw: string, dflt: number): number {
  const t = (raw ?? '').trim();
  if (!t) return dflt;
  const n = Number.parseFloat(t);
  if (!Number.isFinite(n)) return dflt;
  return t.endsWith('%') ? n / 100 : n;
}

/** Luminance coefficients from the spec's grayscale/sepia/saturate matrices. */
const LR = 0.2126, LG = 0.7152, LB = 0.0722;

/** saturate(s) as a 5×4 colour matrix (Filter Effects section 18.1, `feColorMatrix type=saturate`). */
function saturateMatrix(s: number): number[] {
  // Laid out as the 5x4 matrix it is. One number per line is technically the same
  // array and completely unreadable next to the spec.
  return [
    LR + (1 - LR) * s, LG - LG * s,       LB - LB * s,       0, 0,
    LR - LR * s,       LG + (1 - LG) * s, LB - LB * s,       0, 0,
    LR - LR * s,       LG - LG * s,       LB + (1 - LB) * s, 0, 0,
    0,                 0,                 0,                 1, 0,
  ];
}

/** sepia(a), interpolated from identity toward the spec's sepia matrix. */
function sepiaMatrix(a: number): number[] {
  const mix = (from: number, to: number) => from + (to - from) * a;
  return [
    mix(1, 0.393), mix(0, 0.769), mix(0, 0.189), 0, 0,
    mix(0, 0.349), mix(1, 0.686), mix(0, 0.168), 0, 0,
    mix(0, 0.272), mix(0, 0.534), mix(1, 0.131), 0, 0,
    0,             0,             0,             1, 0,
  ];
}

/**
 * Parse a computed `filter` value into primitives, in order.
 *
 * Returns null when the value contains anything with no SVG equivalent - a
 * `url(#ref)` reference to a filter we are not reproducing, or an unknown function.
 * Null means "leave it to the caller's escape hatch": emitting the recognisable half
 * of a chain would be a confidently wrong picture, which is worse than a raster.
 */
export function parseCssFilter(value: string): FilterPrimitive[] | null {
  const v = (value ?? '').trim();
  if (!v || v === 'none') return [];

  const out: FilterPrimitive[] = [];
  const re = /([a-z-]+)\(([^)]*)\)/gi;
  let m: RegExpExecArray | null;
  let consumed = 0;
  while ((m = re.exec(v))) {
    consumed = re.lastIndex;
    const fn = m[1]!.toLowerCase();
    const arg = m[2]!.trim();
    switch (fn) {
      case 'blur':
        // CSS blur(N) is a Gaussian of stdDeviation N - unlike backdrop-filter's
        // and box-shadow's radius conventions, this one is 1:1.
        out.push({ kind: 'blur', stdDeviation: Math.max(0, amount(arg, 0)) });
        break;
      case 'grayscale':
        out.push({
          kind: 'colorMatrix',
          values: saturateMatrix(1 - Math.min(1, Math.max(0, amount(arg, 1)))),
        });
        break;
      case 'saturate':
        out.push({ kind: 'colorMatrix', values: saturateMatrix(Math.max(0, amount(arg, 1))) });
        break;
      case 'sepia':
        out.push({
          kind: 'colorMatrix',
          values: sepiaMatrix(Math.min(1, Math.max(0, amount(arg, 1)))),
        });
        break;
      case 'hue-rotate': {
        const deg = /rad$/.test(arg)
          ? (Number.parseFloat(arg) * 180) / Math.PI
          : /turn$/.test(arg)
            ? Number.parseFloat(arg) * 360
            : Number.parseFloat(arg);
        out.push({ kind: 'hueRotate', deg: Number.isFinite(deg) ? deg : 0 });
        break;
      }
      case 'invert':
        out.push({
          kind: 'componentTransfer',
          mode: 'invert',
          amount: Math.min(1, Math.max(0, amount(arg, 1))),
        });
        break;
      case 'brightness':
        out.push({
          kind: 'componentTransfer',
          mode: 'linear',
          slope: Math.max(0, amount(arg, 1)),
          intercept: 0,
        });
        break;
      case 'contrast': {
        const c = Math.max(0, amount(arg, 1));
        out.push({
          kind: 'componentTransfer',
          mode: 'linear',
          slope: c,
          intercept: -(0.5 * c) + 0.5,
        });
        break;
      }
      case 'opacity':
        out.push({
          kind: 'componentTransfer',
          mode: 'alpha',
          amount: Math.min(1, Math.max(0, amount(arg, 1))),
        });
        break;
      case 'drop-shadow':
        // Drawn as real geometry by the walker, and geometry survives EMF/EPS where
        // a filter reference does not. Skipping it here is deliberate, not an
        // omission - see the box-shadow block in export.ts.
        break;
      default:
        return null;
    }
  }
  // A value with text outside the functions we matched (a url() reference, a var()
  // that never resolved) is not something we understood in full.
  if (v.replace(/\s+/g, '').length > v.slice(0, consumed).replace(/\s+/g, '').length) return null;
  return out;
}

/** True when a computed filter is entirely drop-shadow(s), which the walker already
 *  draws as geometry - so no SVG filter is needed at all. */
export function isDropShadowOnly(value: string): boolean {
  const v = (value ?? '').trim();
  if (!v || v === 'none') return false;
  return /^(\s*drop-shadow\([^)]*\)\s*)+$/i.test(v);
}
