// SPDX-License-Identifier: MPL-2.0
/**
 * Where the export root is on the page, read in the same layout as each box measured
 * from that root.
 *
 * The vector walkers (PDF, SVG and the formats built on the SVG walk, and PowerPoint)
 * write each box at its offset from the export root: the box's client rect less the
 * root's. A walk awaits fonts, text shaping and pictures, and the page keeps laying out
 * while the walk waits. The walkers used to read the root once, before the walk, so a
 * root that moved during the walk put every box read after the move that far from its
 * place. That is how a command-line Print PDF of a Lolly Demo design came out with every
 * box 170 px to the left in one run of five on 2026-11-07: the Design inspector had just
 * docked, `#view`'s margin was still sliding 340 px narrower (lib/edge-dock.css), and
 * the centred canvas moved half that during the walk.
 *
 * `liveOrigin` reads the root each time its `left` or `top` is read, so an offset taken
 * in the same task as the box's own rect is measured in one layout. Geometry that is
 * kept across an await (the line boxes of a text run, the box a picture was taken of)
 * takes `originNow` in the task that read the geometry and carries that fixed copy, so
 * both halves of each subtraction come from the same layout.
 */

/** A top-left corner in client px. */
export interface Origin {
  readonly left: number;
  readonly top: number;
}

class LiveOrigin implements Origin {
  private readonly root: Element;
  private readonly dx: number;
  private readonly dy: number;
  constructor(root: Element, dx: number, dy: number) {
    this.root = root;
    this.dx = dx;
    this.dy = dy;
  }
  get left(): number { return this.root.getBoundingClientRect().left - this.dx; }
  get top(): number { return this.root.getBoundingClientRect().top - this.dy; }
  now(): Origin {
    const r = this.root.getBoundingClientRect();
    return { left: r.left - this.dx, top: r.top - this.dy };
  }
}

/**
 * The root's top-left as it is whenever it is read. `dx` and `dy` move the origin up and
 * to the left, in client px: the PDF walker uses them to place the artwork at a region's
 * offset on the page.
 */
export function liveOrigin(root: Element, dx = 0, dy = 0): Origin {
  return new LiveOrigin(root, dx, dy);
}

/** The origin as it is now, as a fixed copy. A fixed origin gives a copy of itself. */
export function originNow(origin: Origin): Origin {
  return origin instanceof LiveOrigin ? origin.now() : { left: origin.left, top: origin.top };
}
