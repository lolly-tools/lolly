// SPDX-License-Identifier: MPL-2.0
/**
 * Count what a committed docs screenshot is actually MADE of, at build time, so the
 * credential line can state it rather than assert it.
 *
 * The claim the /info screenshots make is that they are documents, not pictures:
 * real <path> geometry that zooms, diffs and re-renders. "12,400 paths in 41 KB" is
 * that claim in a form a reader can check against the file they were just served - 
 * and against the PNG they would otherwise have been sent. A raster baseline has no
 * such structure, and says so instead of borrowing the sentence.
 *
 * Counted with regexes over the file text, never a DOM. These files reach 500 KB
 * (one is 6.8 MB) and the docs build re-runs on every save under --watch, so parsing
 * 95 MB of SVG into a tree twenty-seven times over would cost more than every other
 * part of the build put together. Start tags are all that is being counted, XML
 * escapes any literal `<` in text, and the numbers are self-evidently approximate to
 * one decision (see the metadata strip below) that is documented rather than hidden.
 *
 * Cached on path+size+mtime like docs/shot-provenance.ts, for the same reason: a
 * 27-locale build asks for the same ~320 files once per locale.
 *
 * Total by construction. Anything unreadable - a missing file, a permissions error,
 * bytes that do not look like markup - returns null, and the caller simply leaves
 * the facts off the line. A credential must never be the thing that breaks a build.
 */
import { readFileSync, statSync } from 'node:fs';

export interface ShotAnatomy {
  /**
   * 'vector' when the drawing is real shapes; 'raster' for a PNG/JPEG baseline OR for
   * an .svg that turned out to be a wrapper around one or more embedded bitmaps with
   * no vector geometry of its own. The credential must not claim structure a
   * mostly-bitmap SVG does not have - an .svg extension is not proof of vector.
   */
  kind: 'vector' | 'raster';
  /** <path> elements. 0 on a raster. */
  paths: number;
  /**
   * On-curve anchor NODES across all <path d> and <polygon>/<polyline> geometry - the
   * vertices, one per drawing command, NOT the bezier control handles (those run to too
   * many to mean anything). This is the "it's real geometry" claim as a shape a reader
   * can picture: a text-heavy shot outlines to thousands of nodes, a raster has none.
   * Counted per COMMAND so H/V's single coordinate and an arc's radii/flags are not
   * miscounted; approximate on the rare packed-arc-flag path, exact on walker output.
   */
  nodes: number;
  /** <g> elements. 0 on a raster. */
  groups: number;
  /** Embedded <image> elements (a raster baked into the SVG). */
  images: number;
  /** Every element in the drawing, the <svg> root included. 0 on a raster. */
  elements: number;
  /** The committed file's size on disk, in bytes. */
  bytes: number;
}

const cache = new Map<string, ShotAnatomy | null>();

/** The anatomy of one committed shot, or null if it cannot be read. */
export function readShotAnatomy(path: string): ShotAnatomy | null {
  let key: string;
  let bytes: number;
  try {
    const st = statSync(path);
    // A directory has a size too, and reporting it as "10 KB of raster" would be a
    // confident answer to a question nobody asked.
    if (!st.isFile()) return null;
    bytes = st.size;
    key = `${path}:${st.size}:${st.mtimeMs}`;
  } catch {
    return null;
  }
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const out = count(path, bytes);
  cache.set(key, out);
  return out;
}

// A start tag, and nothing else: `</g>` starts with a slash, `<!--` with a bang and
// `<?xml` with a question mark, so none of them are elements. XML escapes any `<` in
// text content, so a stray angle bracket in a screenshot's own words cannot inflate
// the count.
const EL_RE = /<[a-z][a-z0-9:-]*[\s/>]/gi;
const PATH_RE = /<path[\s/>]/gi;
const GROUP_RE = /<g[\s/>]/gi;
const IMAGE_RE = /<image[\s/>]/gi;
const METADATA_RE = /<metadata\b[\s\S]*?<\/metadata>/gi;

// Node counting. `\sd=` (not `d=`) so the `d="…"` inside `id="…"` is never mistaken
// for path data. Each command run yields floor(numbers / numbers-per-vertex) anchor
// nodes - one per vertex the command lands on. H/V take a single coordinate; an arc's
// seven numbers (radii, rotation, two flags, endpoint) resolve to one endpoint node;
// beziers count only where the curve arrives, not their control handles. Implicit
// repeats ("L 1 2 3 4" is two linetos) fall out of the divide.
const D_RE = /\sd\s*=\s*"([^"]*)"/gi;
const POINTS_ATTR_RE = /<(?:polygon|polyline)\b[^>]*?\bpoints\s*=\s*"([^"]*)"/gi;
const NODE_CMD_RE = /([mlhvcsqtaz])([^mlhvcsqtaz]*)/gi;
const NUM_RE = /-?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/gi;
// numbers-per-vertex for each command; every landing command is worth ONE node.
const NUMS_PER_NODE: Record<string, number> = { m: 2, l: 2, t: 2, h: 1, v: 1, q: 4, s: 4, c: 6, a: 7 };

function countNodes(art: string): number {
  let nodes = 0;
  let m: RegExpExecArray | null;
  D_RE.lastIndex = 0;
  while ((m = D_RE.exec(art))) {
    const d = m[1]!;
    let c: RegExpExecArray | null;
    NODE_CMD_RE.lastIndex = 0;
    while ((c = NODE_CMD_RE.exec(d))) {
      const per = NUMS_PER_NODE[c[1]!.toLowerCase()];
      if (!per) continue; // Z/z closes a subpath - no new vertex
      nodes += Math.floor((c[2]!.match(NUM_RE) ?? []).length / per);
    }
  }
  POINTS_ATTR_RE.lastIndex = 0;
  while ((m = POINTS_ATTR_RE.exec(art))) {
    nodes += Math.floor((m[1]!.match(NUM_RE) ?? []).length / 2);
  }
  return nodes;
}

function count(path: string, bytes: number): ShotAnatomy | null {
  if (!path.endsWith('.svg')) return { kind: 'raster', paths: 0, nodes: 0, groups: 0, images: 0, elements: 0, bytes };
  let text: string;
  try {
    text = readFileSync(path, 'utf-8');
  } catch {
    return null;
  }
  // The C2PA manifest lives in <metadata> as base64. It is packaging, not drawing,
  // and counting its two wrapper elements would make the smallest shots look like
  // they contain more than they do.
  const art = text.replace(METADATA_RE, '');
  const elements = (art.match(EL_RE) ?? []).length;
  if (!elements) return null;   // not markup we can read; say nothing rather than "0 paths"
  const paths = (art.match(PATH_RE) ?? []).length;
  const groups = (art.match(GROUP_RE) ?? []).length;
  const images = (art.match(IMAGE_RE) ?? []).length;
  // An .svg with no <path>/<rect>/<circle>… of its own is a bitmap in an SVG wrapper
  // (a locale shot embedding a JPEG, incl-neuro-viz's WebGL frame). Calling it 'vector'
  // and printing "0 paths" would be the exact dishonesty this module exists to avoid:
  // the extension is not the answer, the geometry is. `paths` is the essential shape
  // count - a shot that draws only <rect>/<circle> and no <path> is vanishingly rare in
  // this corpus and still reads honestly as vector via its element count.
  const kind = (paths === 0 && images > 0) ? 'raster' : 'vector';
  // Nodes only matter for the vector claim; a bitmap-wrapper .svg has none worth stating.
  const nodes = kind === 'vector' ? countNodes(art) : 0;
  return { kind, paths, nodes, groups, images, elements, bytes };
}
