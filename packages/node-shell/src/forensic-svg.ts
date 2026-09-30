// SPDX-License-Identifier: MPL-2.0
/** Passive SVG admission. Imported code and remote resources never reach a renderer. */
import { parseColorToSrgb8, imageDimensions } from '@lolly/engine';
import { base64ToBytes } from '../../../engine/src/bytes.ts';
import type { ForensicLine, ForensicShape } from '@lolly/engine';
const TAGS = new Set(
  'svg g defs rect path circle ellipse polygon polyline line text tspan image clipPath linearGradient radialGradient stop'
    .toLowerCase()
    .split(' ')
);
const ATTRS = new Set(
  'xmlns viewBox width height x y dx dy x1 y1 x2 y2 rx ry r cx cy d points fill stroke stroke-width opacity fill-opacity stroke-opacity transform font-size font-family font-weight text-anchor dominant-baseline id clip-path offset stop-color stop-opacity gradientUnits gradientTransform preserveAspectRatio visibility display'
    .split(' ')
    .map((s) => s.toLowerCase())
);
export function passiveForensicSvg(
  source: string,
  parse: (source: string) => Document = (source) =>
    new DOMParser().parseFromString(source, 'image/svg+xml'),
  serialize: (element: Element) => string = (element) =>
    new XMLSerializer().serializeToString(element)
): {
  svg: string;
  width: number;
  height: number;
  lines: ForensicLine[];
  shapes: ForensicShape[];
  partial: boolean;
} {
  if (source.length > 16_000_000 || /<!DOCTYPE|<!ENTITY/i.test(source))
    throw new Error('SVG exceeds the passive inspection limits.');
  const doc = parse(source);
  const root = doc.documentElement;
  if (root.localName !== 'svg' || doc.querySelector('parsererror')) throw new Error('Invalid SVG.');
  let partial = false;
  const all = [...root.querySelectorAll('*')];
  if (all.length > 50_000) throw new Error('SVG element budget exceeded.');
  const hasStylesheet = !!root.querySelector('style');
  for (const el of [root, ...all]) {
    if (
      el.hasAttribute('style') ||
      (hasStylesheet && el.hasAttribute('class')) ||
      el.hasAttribute('filter') ||
      el.hasAttribute('mask')
    ) {
      if (el === root) throw new Error('Root CSS, filters or masks exceed the passive SVG subset.');
      el.remove();
      partial = true;
      continue;
    }
    if (!TAGS.has(el.localName.toLowerCase())) {
      el.remove();
      partial = true;
      continue;
    }
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase(),
        value = attr.value;
      if (name === 'href' || name === 'xlink:href') {
        if (
          el.localName === 'image' &&
          /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(value) &&
          value.length < 8_000_000
        ) {
          const data = base64ToBytes(value.slice(value.indexOf(',') + 1));
          const dimensions = imageDimensions(data);
          if (
            dimensions &&
            dimensions.w > 0 &&
            dimensions.h > 0 &&
            dimensions.w * dimensions.h <= 40_000_000
          )
            continue;
        }
        el.removeAttribute(attr.name);
        partial = true;
        continue;
      }
      if (!ATTRS.has(name) || (/url\(/i.test(value) && !/^url\(#[\w.-]+\)$/.test(value))) {
        el.removeAttribute(attr.name);
        partial = true;
      }
    }
  }
  const vb = (root.getAttribute('viewBox') ?? '')
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  const width = vb.length === 4 ? vb[2]! : Number.parseFloat(root.getAttribute('width') ?? '1200');
  const height =
    vb.length === 4 ? vb[3]! : Number.parseFloat(root.getAttribute('height') ?? '1200');
  if (![width, height].every((n) => Number.isFinite(n) && n > 0 && n <= 50_000))
    throw new Error('Invalid SVG dimensions.');
  const originX = vb.length === 4 ? vb[0]! : 0,
    originY = vb.length === 4 ? vb[1]! : 0;
  root.setAttribute('width', String(width));
  root.setAttribute('height', String(height));
  function inherited(el: Element, key: string, fallback: string): string {
    for (let e: Element | null = el; e; e = e.parentElement) {
      const v = e.getAttribute(key);
      if (v !== null) return v;
    }
    return fallback;
  }
  function box(el: Element, x: number, y: number, w: number, h: number) {
    let sx = 1,
      sy = 1,
      tx = 0,
      ty = 0;
    const ancestors: Element[] = [];
    for (let e: Element | null = el; e; e = e.parentElement) ancestors.unshift(e);
    for (const e of ancestors)
      for (const m of (e.getAttribute('transform') ?? '').matchAll(/([a-z]+)\(([^)]+)\)/gi)) {
        const a = m[2]!
          .trim()
          .split(/[\s,]+/)
          .map(Number);
        if (a.some((v) => !Number.isFinite(v))) return null;
        if (m[1] === 'translate') {
          tx += sx * a[0]!;
          ty += sy * (a[1] ?? 0);
        } else if (m[1] === 'scale') {
          sx *= a[0]!;
          sy *= a[1] ?? a[0]!;
        } else if (m[1] === 'matrix' && a.length === 6 && a[1] === 0 && a[2] === 0) {
          tx += sx * a[4]!;
          ty += sy * a[5]!;
          sx *= a[0]!;
          sy *= a[3]!;
        } else {
          partial = true;
          return null;
        }
      }
    if (sx <= 0 || sy <= 0) return null;
    const b = { x: x * sx + tx - originX, y: y * sy + ty - originY, width: w * sx, height: h * sy };
    return Object.values(b).every(Number.isFinite) ? b : null;
  }
  const lines: ForensicLine[] = [];
  const hidden = (el: Element): boolean =>
    !!el.closest('defs, clipPath') ||
    inherited(el, 'clip-path', '') !== '' ||
    inherited(el, 'display', '') === 'none' ||
    inherited(el, 'visibility', '') === 'hidden' ||
    Number(inherited(el, 'opacity', '1')) === 0;
  for (const el of root.querySelectorAll('text')) {
    if (hidden(el)) continue;
    const text = el.textContent?.trim() ?? '';
    const spans = [...el.querySelectorAll('tspan')];
    if (
      spans.some(
        (span) =>
          span.hasAttribute('x') ||
          span.hasAttribute('y') ||
          span.hasAttribute('dx') ||
          span.hasAttribute('dy')
      )
    ) {
      partial = true;
      continue;
    }
    const runs = spans.length ? spans : [el];
    const sizes = new Map<number, number>();
    for (const run of runs) {
      const size = Number.parseFloat(inherited(run, 'font-size', '16'));
      if (Number.isFinite(size) && size > 0)
        sizes.set(size, (sizes.get(size) ?? 0) + (run.textContent?.length ?? 0));
    }
    const size = [...sizes].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 16;
    const x = Number.parseFloat(el.getAttribute('x') ?? '0'),
      y = Number.parseFloat(el.getAttribute('y') ?? '0');
    const b = box(el, x, y - size, text.length * size * 0.6, size * 1.2);
    if (text && b && size > 0) lines.push({ text, box: b, size: b.height / 1.2, confidence: 0.7 });
  }
  const rects = [...root.querySelectorAll('rect')].flatMap((el) => {
    const number = (key: string) => Number.parseFloat(el.getAttribute(key) ?? '0');
    if (hidden(el) || !parseColorToSrgb8(inherited(el, 'fill', '#000'))) return [];
    const b = box(el, number('x'), number('y'), number('width'), number('height'));
    return b && b.width > 0 && b.height > 0
      ? [
          {
            box: b,
            radius: Math.max(number('rx'), number('ry')),
            fill: inherited(el, 'fill', '#000'),
          },
        ]
      : [];
  });
  const shapes: ForensicShape[] = [];
  for (const panel of rects.filter(
    (r) => r.radius > 0 && r.box.width >= 60 && r.box.height >= 40
  )) {
    const p = panel.box;
    for (const strip of rects) {
      const colour = parseColorToSrgb8(strip.fill);
      if (
        strip === panel ||
        strip.fill === panel.fill ||
        !colour ||
        Math.max(...colour.slice(0, 3)) - Math.min(...colour.slice(0, 3)) < 60
      )
        continue;
      const s = strip.box,
        tolerance = 3;
      const vertical = Math.abs(s.y - p.y) < tolerance && Math.abs(s.height - p.height) < tolerance;
      const horizontal = Math.abs(s.x - p.x) < tolerance && Math.abs(s.width - p.width) < tolerance;
      const left =
        vertical &&
        s.x <= p.x + tolerance &&
        s.x + s.width > p.x &&
        (s.x + s.width < p.x + p.width * 0.15 ||
          (rects.indexOf(strip) < rects.indexOf(panel) &&
            strip.radius > 0 &&
            Math.abs(s.x + s.width - p.x - p.width) < tolerance &&
            p.x - s.x > 0 &&
            p.x - s.x < p.width * 0.15));
      const top =
        horizontal &&
        s.y <= p.y + tolerance &&
        s.y + s.height > p.y &&
        (s.y + s.height < p.y + p.height * 0.15 ||
          (rects.indexOf(strip) < rects.indexOf(panel) &&
            strip.radius > 0 &&
            Math.abs(s.y + s.height - p.y - p.height) < tolerance &&
            p.y - s.y > 0 &&
            p.y - s.y < p.height * 0.15));
      if (left || top)
        shapes.push({
          ...panel,
          box: {
            x: Math.min(p.x, s.x),
            y: Math.min(p.y, s.y),
            width: Math.max(p.x + p.width, s.x + s.width) - Math.min(p.x, s.x),
            height: Math.max(p.y + p.height, s.y + s.height) - Math.min(p.y, s.y),
          },
          accent: {
            edge: left ? 'left' : 'top',
            width: left
              ? s.width > p.width * 0.15
                ? p.x - s.x
                : s.width
              : s.height > p.height * 0.15
                ? p.y - s.y
                : s.height,
            colour: strip.fill,
          },
        });
    }
  }
  return { svg: serialize(root), width, height, lines, shapes: shapes.slice(0, 64), partial };
}
