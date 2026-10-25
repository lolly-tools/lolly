// SPDX-License-Identifier: MPL-2.0
/**
 * The last step of a page walk, run where the capturing shell has a DOM and a canvas
 * of its own: fill the walk's region boxes from the screenshot and score the result
 * against that screenshot. The CLI runs this in a blank scratch page (the page-walk
 * script carries a copy); the desktop app and the web app import the module. Never in the
 * captured page, whose Content-Security-Policy may refuse data: images.
 *
 * Kept apart from page-walk.ts so the app can finish a capture without loading the
 * export walker.
 */

const NS = 'http://www.w3.org/2000/svg';
/** The href prefix of a region placeholder: `lolly-region:x,y,width,height`, viewport CSS px. */
export const REGION = 'lolly-region:';
const n4 = (v: number): number => Math.round(v * 1e4) / 1e4;

export interface FinishOpts {
  svg: string;
  /** A PNG screenshot of the viewport at the moment of the walk, base64. */
  shot: string;
  /** Screenshot pixels per CSS px (the capture's device scale). */
  scale: number;
  /** Also score the finished SVG against the screenshot (see vectorDistance). */
  score?: boolean;
}

export interface FinishResult {
  svg: string;
  /** Regions filled from the screenshot, and regions dropped (nothing on screen). */
  filled: number;
  dropped: number;
  /** Share of coarse cells that differ from the screenshot, when asked for. */
  distance?: number;
}

/** Fill the page walk's region placeholders from the screenshot, then optionally
 *  score the result. */
export async function finishPageVector(o: FinishOpts): Promise<FinishResult> {
  const shot = await loadImage(`data:image/png;base64,${o.shot}`);
  const sw = shot.naturalWidth / o.scale, sh = shot.naturalHeight / o.scale;
  const doc = new DOMParser().parseFromString(o.svg, 'image/svg+xml');
  let filled = 0, dropped = 0;
  for (const im of Array.from(doc.getElementsByTagNameNS(NS, 'image'))) {
    const href = im.getAttribute('href') || '';
    if (!href.startsWith(REGION)) continue;
    const [rx, ry, rw, rh] = href.slice(REGION.length).split(',').map(Number) as [number, number, number, number];
    // Clamp to what the screenshot holds, and move the image box by the same amount.
    const x0 = Math.max(0, rx), y0 = Math.max(0, ry);
    const x1 = Math.min(sw, rx + rw), y1 = Math.min(sh, ry + rh);
    if (!(x1 - x0 >= 0.5 && y1 - y0 >= 0.5)) { im.remove(); dropped++; continue; }
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round((x1 - x0) * o.scale));
    c.height = Math.max(1, Math.round((y1 - y0) * o.scale));
    c.getContext('2d')!.drawImage(shot, x0 * o.scale, y0 * o.scale, (x1 - x0) * o.scale, (y1 - y0) * o.scale, 0, 0, c.width, c.height);
    const ix = Number(im.getAttribute('x')) || 0, iy = Number(im.getAttribute('y')) || 0;
    im.setAttribute('x', String(n4(ix + (x0 - rx)))); im.setAttribute('y', String(n4(iy + (y0 - ry))));
    im.setAttribute('width', String(n4(x1 - x0))); im.setAttribute('height', String(n4(y1 - y0)));
    im.setAttribute('href', c.toDataURL('image/png'));
    filled++;
  }
  const svg = new XMLSerializer().serializeToString(doc);
  return { svg, filled, dropped, ...(o.score ? { distance: await vectorDistance(svg, shot) } : {}) };
}

/**
 * How far a vector capture is from the screenshot of the same moment, in [0,1]:
 * the share of 8-px cells whose mean colour differs once both are reduced.
 *
 * Coarse on purpose. Text a host could not outline stays `<text>` in whatever face
 * the viewer has, so glyph shapes differ from the screenshot by design and a fine
 * per-pixel score would fail every text-heavy page. Averaged cells keep what the
 * check is for - a missing panel, a wrong backdrop, a layer over the content.
 */
export async function vectorDistance(svg: string, shot: HTMLImageElement): Promise<number> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const pic = await loadImage(url);
    const CELL = 8;
    const vbw = shot.naturalWidth, vbh = shot.naturalHeight;
    const cw = Math.max(1, Math.round(vbw / CELL)), ch = Math.max(1, Math.round(vbh / CELL));
    const cells = (im: HTMLImageElement): Uint8ClampedArray => {
      const c = document.createElement('canvas');
      c.width = cw; c.height = ch;
      const x = c.getContext('2d')!;
      x.imageSmoothingEnabled = true;
      x.imageSmoothingQuality = 'high';
      x.fillStyle = '#fff';
      x.fillRect(0, 0, cw, ch);
      x.drawImage(im, 0, 0, cw, ch);
      return x.getImageData(0, 0, cw, ch).data;
    };
    const A = cells(shot), B = cells(pic);
    let bad = 0;
    for (let i = 0; i < A.length; i += 4) {
      const d = Math.abs(A[i]! - B[i]!) + Math.abs(A[i + 1]! - B[i + 1]!) + Math.abs(A[i + 2]! - B[i + 2]!);
      if (d > 60) bad++;
    }
    return bad / (cw * ch);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, fail) => {
    const im = new Image();
    im.onload = () => ok(im);
    im.onerror = () => fail(new Error('An image in the capture did not decode.'));
    im.src = src;
  });
}

