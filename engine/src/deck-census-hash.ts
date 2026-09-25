// SPDX-License-Identifier: MPL-2.0
/**
 * Small pure hashes the deck census uses to GENERATE candidates (plan 274
 * section 3.2): a difference hash over a decoded picture, a translation-free
 * hash over vector path data, a digit-wildcarded key for repeated text, and the
 * 64-bit string hash the other two are built on.
 *
 * None of these is an identity. Storage identity stays the exact content hash
 * the source adapter records on `SourceObjectV1.media`; a dHash match, a path
 * hash match or a digit-normalised text match only says "these two are worth
 * comparing", and the census verifies a candidate group before it reports one.
 * Crops, low-detail graphics and recolourings collide under a dHash, which is
 * why the verification step exists rather than a wider hash.
 *
 * Pure: no DOM, no clock, no filesystem, no node crypto, no randomness. The
 * same input gives the same 16 hex characters on every host, so a census taken
 * in a browser and one taken on a terminal agree.
 */

/** Rows and columns of the grey downsample a dHash compares along. */
const DHASH_COLS = 9;
const DHASH_ROWS = 8;
/** Adjacent column pairs in one row, which is how many bits that row contributes. */
const DHASH_PAIRS = DHASH_COLS - 1;
/** Hex characters one row of bits packs into, so the grid and the packing cannot drift apart. */
const DHASH_ROW_HEX = Math.ceil(DHASH_PAIRS / 4);

/** Default rounding step for `pathHash`, in the path's own user units. */
const DEFAULT_PATH_TOLERANCE = 0.5;

/**
 * Two FNV-1a passes over 32 bits each, written side by side as 16 lower case
 * hex characters. Integer arithmetic only, through `Math.imul`, so the result
 * is the same on every JavaScript engine; the second pass reads the text
 * backwards from a different basis, so a one character swap moves both halves.
 *
 * This is a grouping key, never a content identity or a security claim.
 */
export function censusHash(text: string): string {
  let forward = 0x811c9dc5;
  let backward = 0x01000193;
  for (let i = 0; i < text.length; i += 1) {
    forward = Math.imul(forward ^ (text.charCodeAt(i) & 0xffff), 0x01000193) >>> 0;
    const mirror = text.charCodeAt(text.length - 1 - i) & 0xffff;
    backward = Math.imul(backward ^ (mirror + i), 0x85ebca6b) >>> 0;
  }
  return (forward >>> 0).toString(16).padStart(8, '0') + (backward >>> 0).toString(16).padStart(8, '0');
}

/**
 * A 64-bit difference hash over a grey image, as 16 hex characters.
 *
 * The samples are box-averaged down to nine columns by eight rows, and each of
 * the eight pairs in a row contributes one bit: 1 when the left sample is
 * brighter than the right. Bits are written row by row, most significant first,
 * so two hosts that downsample the same picture agree bit for bit.
 *
 * `grey` holds one sample per pixel in row-major order, 0 to 255. Values
 * outside that range are clamped rather than refused, because a decoder that
 * hands back a slightly wider range should not fail a census.
 */
export function dhashFromGrey(width: number, height: number, grey: Uint8Array | number[]): string {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new RangeError('dhashFromGrey needs a positive integer width and height');
  }
  if (grey.length < width * height) {
    throw new RangeError(`dhashFromGrey needs ${width * height} samples, got ${grey.length}`);
  }
  const cells = new Float64Array(DHASH_COLS * DHASH_ROWS);
  for (let ty = 0; ty < DHASH_ROWS; ty += 1) {
    const y0 = Math.floor((ty * height) / DHASH_ROWS);
    const y1 = Math.max(y0 + 1, Math.floor(((ty + 1) * height) / DHASH_ROWS));
    for (let tx = 0; tx < DHASH_COLS; tx += 1) {
      const x0 = Math.floor((tx * width) / DHASH_COLS);
      const x1 = Math.max(x0 + 1, Math.floor(((tx + 1) * width) / DHASH_COLS));
      let sum = 0;
      let count = 0;
      for (let y = y0; y < y1 && y < height; y += 1) {
        for (let x = x0; x < x1 && x < width; x += 1) {
          const raw = grey[y * width + x] ?? 0;
          sum += raw < 0 ? 0 : raw > 255 ? 255 : raw;
          count += 1;
        }
      }
      cells[ty * DHASH_COLS + tx] = count > 0 ? sum / count : 0;
    }
  }
  let out = '';
  for (let ty = 0; ty < DHASH_ROWS; ty += 1) {
    let byte = 0;
    for (let tx = 0; tx < DHASH_PAIRS; tx += 1) {
      const left = cells[ty * DHASH_COLS + tx] ?? 0;
      const right = cells[ty * DHASH_COLS + tx + 1] ?? 0;
      byte = (byte << 1) | (left > right ? 1 : 0);
    }
    out += byte.toString(16).padStart(DHASH_ROW_HEX, '0');
  }
  return out;
}

/** Bits that differ between two hashes of the same width. */
export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) throw new RangeError('hammingDistance needs two hashes of one width');
  let bits = 0;
  for (let i = 0; i < a.length; i += 1) {
    const left = Number.parseInt(a[i] ?? '0', 16);
    const right = Number.parseInt(b[i] ?? '0', 16);
    if (Number.isNaN(left) || Number.isNaN(right)) throw new RangeError('hammingDistance needs hex characters');
    let diff = (left ^ right) & 0xf;
    while (diff) {
      bits += diff & 1;
      diff >>= 1;
    }
  }
  return bits;
}

/** Round to a step, with the sign of zero removed so -0 and 0 print alike. */
function roundTo(value: number, step: number): number {
  const rounded = Math.round(value / step) * step;
  const fixed = Number(rounded.toFixed(4));
  return fixed === 0 ? 0 : fixed;
}

/** One read token: a command name, or a number that may be an x or a y. */
interface PathToken { command?: string; value?: number; axis?: 'x' | 'y' }

/** Geometry attributes of a basic shape, in the order they are hashed. */
const SHAPE_GEOMETRY: Record<string, Array<{ name: string; axis?: 'x' | 'y' }>> = {
  rect: [
    { name: 'x', axis: 'x' }, { name: 'y', axis: 'y' },
    { name: 'width' }, { name: 'height' }, { name: 'rx' }, { name: 'ry' },
  ],
  circle: [{ name: 'cx', axis: 'x' }, { name: 'cy', axis: 'y' }, { name: 'r' }],
  ellipse: [{ name: 'cx', axis: 'x' }, { name: 'cy', axis: 'y' }, { name: 'rx' }, { name: 'ry' }],
  line: [
    { name: 'x1', axis: 'x' }, { name: 'y1', axis: 'y' },
    { name: 'x2', axis: 'x' }, { name: 'y2', axis: 'y' },
  ],
};

/** The value of one attribute inside an element's attribute text. */
function readAttribute(attrs: string, name: string): string | undefined {
  const re = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i');
  const match = re.exec(attrs);
  if (!match) return undefined;
  return match[1] ?? match[2];
}

/** Read path data into tokens, marking which numbers are an x and which a y. */
function readPathData(data: string, into: PathToken[]): void {
  const re = /([MmLlHhVvCcSsQqTtAaZz])|(-?\d*\.?\d+(?:[eE][-+]?\d+)?)/g;
  let command = 'M';
  let slot = 0;
  let match = re.exec(data);
  while (match) {
    if (match[1]) {
      command = match[1];
      slot = 0;
      into.push({ command });
    } else {
      const value = Number.parseFloat(match[2] ?? '0');
      const upper = command.toUpperCase();
      let axis: 'x' | 'y' | undefined;
      if (upper === 'H') axis = 'x';
      else if (upper === 'V') axis = 'y';
      else if (upper === 'A') axis = slot % 7 === 5 ? 'x' : slot % 7 === 6 ? 'y' : undefined;
      else axis = slot % 2 === 0 ? 'x' : 'y';
      // A relative command states an offset, which a translation never moves.
      into.push(command === upper ? { value, axis } : { value });
      slot += 1;
    }
    match = re.exec(data);
  }
}

/** Read a polyline or polygon point list as alternating x and y. */
function readPoints(points: string, into: PathToken[]): void {
  const re = /-?\d*\.?\d+(?:[eE][-+]?\d+)?/g;
  let slot = 0;
  let match = re.exec(points);
  while (match) {
    into.push({ value: Number.parseFloat(match[0]), axis: slot % 2 === 0 ? 'x' : 'y' });
    slot += 1;
    match = re.exec(points);
  }
}

/**
 * A hash over vector geometry that ignores the drawing's position: it is
 * moved so its smallest x and y are zero, every coordinate is rounded to
 * `tolerance`, and the command names travel with the numbers.
 *
 * The input may be a whole SVG document or bare path data. From a document it
 * reads, in document order, the `d` of every `path` AND the geometry of every
 * `rect`, `circle`, `ellipse`, `line`, `polyline` and `polygon`, because
 * extracted vector art routinely draws a mark with none of them a path and two
 * such drawings must not share one family key. Anything that does not start
 * with `<` is read as path data straight away.
 *
 * `null` means no geometry was found, so the caller forms no family from it
 * rather than grouping every path-free drawing under one empty key.
 *
 * Known limit, stated rather than hidden: the reader pairs numbers as x and y
 * after each command letter, with `H` and `V` taking one coordinate each and
 * `A` taking its five leading parameters before the endpoint. An elliptical arc
 * written with unusual whitespace still hashes consistently, but the radii are
 * not translated, so two arcs that differ only in radius stay apart, which is
 * the answer a candidate generator wants. A transform attribute is not read, so
 * two drawings that differ only by a scale or a rotation stay apart too.
 */
export function pathHash(svgOrPathData: string, tolerance: number = DEFAULT_PATH_TOLERANCE): string | null {
  const step = tolerance > 0 ? tolerance : DEFAULT_PATH_TOLERANCE;
  const source = svgOrPathData.trim();
  const tokens: PathToken[] = [];

  if (source.startsWith('<')) {
    const elements = /<\s*(path|rect|circle|ellipse|line|polyline|polygon)\b([^>]*)>/gi;
    let match = elements.exec(source);
    while (match) {
      const tag = (match[1] ?? '').toLowerCase();
      const attrs = match[2] ?? '';
      if (tag === 'path') {
        const data = readAttribute(attrs, 'd');
        if (data !== undefined && data.trim().length > 0) {
          readPathData(data, tokens);
          tokens.push({ command: '|' });
        }
      } else if (tag === 'polyline' || tag === 'polygon') {
        const points = readAttribute(attrs, 'points');
        if (points !== undefined && points.trim().length > 0) {
          tokens.push({ command: tag });
          readPoints(points, tokens);
          tokens.push({ command: '|' });
        }
      } else {
        const fields = SHAPE_GEOMETRY[tag] ?? [];
        const read: PathToken[] = [];
        for (const field of fields) {
          const raw = readAttribute(attrs, field.name);
          if (raw === undefined) continue;
          const value = Number.parseFloat(raw);
          if (!Number.isFinite(value)) continue;
          read.push(field.axis ? { value, axis: field.axis } : { value });
        }
        if (read.length > 0) {
          tokens.push({ command: tag });
          tokens.push(...read);
          tokens.push({ command: '|' });
        }
      }
      match = elements.exec(source);
    }
  } else if (source.length > 0) {
    readPathData(source, tokens);
    tokens.push({ command: '|' });
  }

  if (!tokens.some((token) => token.value !== undefined)) return null;

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  for (const token of tokens) {
    if (token.value === undefined) continue;
    if (token.axis === 'x') minX = Math.min(minX, token.value);
    else if (token.axis === 'y') minY = Math.min(minY, token.value);
  }
  if (!Number.isFinite(minX)) minX = 0;
  if (!Number.isFinite(minY)) minY = 0;

  const parts: string[] = [];
  for (const token of tokens) {
    if (token.command !== undefined) {
      parts.push(token.command);
      continue;
    }
    const raw = token.value ?? 0;
    const moved = token.axis === 'x' ? raw - minX : token.axis === 'y' ? raw - minY : raw;
    parts.push(String(roundTo(moved, step)));
  }
  return censusHash(parts.join(' '));
}

/**
 * The key a repeated line is grouped by: lower case, one space between words,
 * and every run of digits replaced by `#`, so "Source: report 2021" and
 * "Source: report 2023" share one key and a page number never splits a footer
 * into three.
 */
export function digitNormalise(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase().replace(/\d+/g, '#');
}
