// SPDX-License-Identifier: MPL-2.0
/**
 * Where a CSS background image actually lands.
 *
 * The walker used to place every `background-image: url()` at the element's full
 * border box. That is right for exactly one case - a `cover` hero - and wrong for
 * every other: the select chevron (14px, right-centred) came out stretched across
 * the whole field, and the checkbox tick filled the entire box. Both ship in this
 * app's field primitive, so the defect was on every form control on every page.
 *
 * CSS Backgrounds 3 section 3.9 (`background-size`) and section 3.6 (`background-position`) are a
 * self-contained bit of arithmetic over four numbers, so they live here as pure
 * functions and are tested as arithmetic. The DOM parts the walker keeps: reading the
 * computed strings, and discovering the image's intrinsic size.
 */

export interface Size {
  w: number;
  h: number;
}

/** The rect an image paints into, plus the tile step when it repeats. */
export interface BgPlacement {
  /** Top-left of the first tile, relative to the positioning area's origin. */
  x: number;
  y: number;
  /** Painted size of one tile. */
  w: number;
  h: number;
  repeatX: boolean;
  repeatY: boolean;
}

/**
 * Resolve `background-size` against the positioning area.
 *
 * `intrinsic` is null when the image has no natural size we could discover (an SVG
 * with no width/height, a load failure). CSS then treats it as having the area's
 * dimensions, which is also the old behaviour - so an undiscoverable image degrades
 * to exactly what the walker did before rather than to nothing.
 */
export function resolveBgSize(value: string, area: Size, intrinsic: Size | null): Size {
  const v = (value || 'auto').trim().toLowerCase();
  const nat = intrinsic && intrinsic.w > 0 && intrinsic.h > 0 ? intrinsic : null;
  const ratio = nat ? nat.w / nat.h : 0;

  if (v === 'cover' || v === 'contain') {
    if (!ratio) return { w: area.w, h: area.h };
    const areaRatio = area.h > 0 ? area.w / area.h : 0;
    const fitWidth = v === 'cover' ? areaRatio < ratio : areaRatio > ratio;
    return fitWidth ? { w: area.h * ratio, h: area.h } : { w: area.w, h: area.w / ratio };
  }

  const parts = v.split(/\s+/).filter(Boolean);
  const one = (token: string | undefined, basis: number): number | null => {
    if (!token || token === 'auto') return null;
    if (token.endsWith('%')) return (Number.parseFloat(token) / 100) * basis;
    const n = Number.parseFloat(token);
    return Number.isFinite(n) ? n : null;
  };
  let w = one(parts[0], area.w);
  // A single value sets the width; the height is auto (section 3.9), NOT the same value.
  // Getting this wrong squashes every non-square icon.
  let h = one(parts[1], area.h);

  if (w === null && h === null) return nat ? { w: nat.w, h: nat.h } : { w: area.w, h: area.h };
  if (w === null) w = ratio ? h! * ratio : area.w;
  if (h === null) h = ratio ? w / ratio : area.h;
  return { w, h };
}

/**
 * Split a CSS value on top-level whitespace, keeping bracketed groups whole.
 *
 * Necessary because the computed form of an edge offset is a `calc()`: Chromium
 * reports `background-position: right 12px center` as `calc(100% - 12px) 50%`, and a
 * naive split on whitespace turns that one value into three meaningless tokens.
 */
export function splitTopLevel(value: string): string[] {
  const out: string[] = [];
  let depth = 0,
    cur = '';
  for (const ch of value) {
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (/\s/.test(ch) && depth === 0) {
      if (cur) {
        out.push(cur);
        cur = '';
      }
      continue;
    }
    cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

/**
 * One axis of `background-position`.
 *
 * Percentages align the image's own X% with the area's X% - which is why a centred
 * 14px chevron sits at `(area - 14) / 2` rather than `area / 2`, and why treating a
 * percentage as a plain offset puts every centred icon in the wrong place.
 *
 * `calc()` mixing the two resolves the same way: percentage against `area - img`,
 * lengths added on top.
 */
export function resolveBgPositionAxis(token: string, area: number, img: number): number {
  const t = (token || '0%').trim().toLowerCase();
  const kw: Record<string, string> = {
    left: '0%',
    top: '0%',
    center: '50%',
    right: '100%',
    bottom: '100%',
  };
  const v = kw[t] ?? t;

  const calc = /^calc\((.*)\)$/.exec(v);
  const body = calc ? calc[1]! : v;
  // Terms with their signs. Only + and - are meaningful for a position; a calc with
  // * or / falls out as unparsed terms and contributes 0, which is the safe default.
  let total = 0;
  const re = /([+-]?)\s*([\d.]+)(%|[a-z]*)/g;
  let m: RegExpExecArray | null;
  let seen = false;
  while ((m = re.exec(body))) {
    const sign = m[1] === '-' ? -1 : 1;
    const n = Number.parseFloat(m[2]!);
    if (!Number.isFinite(n)) continue;
    seen = true;
    total += sign * (m[3] === '%' ? ((area - img) * n) / 100 : n);
  }
  return seen ? total : 0;
}

/**
 * Full placement of one background layer.
 *
 * `position` is the computed two-value form ("50% 50%", "right 4px center" is
 * normalised by the UA to two or four tokens). The four-token edge-offset syntax
 * ("right 10px bottom 5px") is handled: an offset following a keyword is measured
 * from that edge.
 */
export function placeBackground(
  size: string,
  position: string,
  repeat: string,
  area: Size,
  intrinsic: Size | null
): BgPlacement {
  const s = resolveBgSize(size, area, intrinsic);
  const tokens = splitTopLevel((position || '0% 0%').trim().toLowerCase());

  // Split the token list into an x-part and a y-part. Either axis may be written
  // first - `top right` is legal and means x=right, y=top - so the vertical
  // keywords decide the pairing rather than the token order.
  const VERT = ['top', 'bottom'],
    HORIZ = ['left', 'right'];
  let xTok = '50%',
    yTok = '50%';
  let xFromEnd = false,
    yFromEnd = false;

  if (tokens.length <= 2) {
    const [a, b] = tokens;
    if (tokens.length === 1) {
      // One value sets its own axis; the other is centre (section 3.6).
      if (a && VERT.includes(a)) yTok = a;
      else xTok = a ?? '0%';
    } else if (a && b) {
      const swap = VERT.includes(a) || HORIZ.includes(b);
      xTok = swap ? b : a;
      yTok = swap ? a : b;
    }
  } else {
    // The edge-offset form: a keyword optionally followed by a length, twice.
    const isKw = (t: string) => VERT.includes(t) || HORIZ.includes(t) || t === 'center';
    const parts: string[][] = [];
    for (const t of tokens) {
      if (isKw(t) || !parts.length) parts.push([t]);
      else parts[parts.length - 1]!.push(t);
    }
    const [a, b] = parts;
    if (a && b) {
      const [xp, yp] = VERT.includes(a[0]!) ? [b, a] : [a, b];
      xFromEnd = xp![0] === 'right';
      yFromEnd = yp![0] === 'bottom';
      xTok = xp!.length > 1 ? xp![1]! : xp![0]!;
      yTok = yp!.length > 1 ? yp![1]! : yp![0]!;
    }
  }

  let x = xFromEnd
    ? area.w - s.w - (Number.parseFloat(xTok) || 0)
    : resolveBgPositionAxis(xTok, area.w, s.w);
  let y = yFromEnd
    ? area.h - s.h - (Number.parseFloat(yTok) || 0)
    : resolveBgPositionAxis(yTok, area.h, s.h);
  if (!Number.isFinite(x)) x = 0;
  if (!Number.isFinite(y)) y = 0;

  const { x: repeatX, y: repeatY } = repeatAxes(repeat);
  return { x, y, w: s.w, h: s.h, repeatX, repeatY };
}

/** Which axes a `background-repeat` tiles on. `round` and `space` tile too - they
 *  only differ in how the remainder is distributed, which at our fidelity is noise. */
export function repeatAxes(repeat: string): { x: boolean; y: boolean } {
  const t = (repeat || 'repeat').trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (t[0] === 'repeat-x') return { x: true, y: false };
  if (t[0] === 'repeat-y') return { x: false, y: true };
  const tiles = (k: string) => k === 'repeat' || k === 'round' || k === 'space';
  return { x: tiles(t[0] ?? 'repeat'), y: tiles(t[1] ?? t[0] ?? 'repeat') };
}
