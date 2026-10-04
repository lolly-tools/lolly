// SPDX-License-Identifier: MPL-2.0
/**
 * The brand family for a delivered .pptx (plan 291 M4).
 *
 * A PowerPoint export carries no Design layers, so `lolly check` used to skip the brand
 * family on one, and a deck exported in the wrong palette scored clean. This reads the
 * colours the slides actually paint (each shape's fill and outline, each text run's
 * colour, each slide's ground, scheme colours resolved through the deck's theme) and
 * holds them to one theme of the design system:
 *
 *   - every colour goes through the same brand check a Design document gets
 *     (`brand.color.review` for one outside the palette, `brand.color.unknown` for one
 *     that cannot be compared);
 *   - every slide's ground (its background, or the topmost shape that covers 90% of it
 *     or more) must be the theme's surface, or its primary or secondary colour, which a
 *     title or section slide may be drawn in (`brand.ground.theme`). A picture under
 *     the content is a photo ground and is not judged.
 *
 * Pure apart from the XML parser: the same bytes and design system give the same findings.
 */
import { checkBrandDesign, checkFindingFromBrand, createTokenSet, deltaEOk, parseColor, readPptx } from '@lolly/engine';
import type { CheckFindingV1 } from '@lolly-tools/core';
import type { PptxReadColor, PptxReadNode, PptxReadSlide } from '../../../engine/src/pptx-read.ts';
import { inflatePptx } from './pptx.ts';
import { inventoryXmlParser } from './content-inventory.ts';

/** A colour the slide paints, as `#rrggbb` (or `#rrggbbaa` when translucent), or null. */
function hexOf(color: PptxReadColor | undefined): string | null {
  const raw = color && typeof color.hex === 'string' ? color.hex.replace(/^#/, '') : '';
  if (!/^[0-9a-f]{6}$/i.test(raw)) return null;
  const alpha = typeof color!.alpha === 'number' && color!.alpha < 1 ? Math.max(0, Math.round(color!.alpha * 255)) : 255;
  return `#${raw.toLowerCase()}${alpha < 255 ? alpha.toString(16).padStart(2, '0') : ''}`;
}

/** What is behind a slide's content: a colour, a picture, or nothing that can be read. */
export type PptxSlideGround = { slide: number; hex: string } | { slide: number; photo: true } | { slide: number; unknown: true };

const COVER = 0.9;

function covers(node: PptxReadNode, w: number, h: number): boolean {
  const ix = Math.max(0, Math.min(node.xEmu + node.cxEmu, w) - Math.max(node.xEmu, 0));
  const iy = Math.max(0, Math.min(node.yEmu + node.cyEmu, h) - Math.max(node.yEmu, 0));
  return w > 0 && h > 0 && (ix * iy) / (w * h) >= COVER;
}

/** One slide's ground: the topmost full-bleed picture or opaque solid shape, else the slide background. */
function groundOf(slide: PptxReadSlide, n: number, w: number, h: number): PptxSlideGround {
  let ground: PptxSlideGround = { slide: n, unknown: true };
  const bg = slide.background;
  if (bg?.media) ground = { slide: n, photo: true };
  else if (bg && !bg.gradient) {
    const hex = hexOf(bg.color);
    if (hex && hex.length === 7) ground = { slide: n, hex };
  }
  for (const node of [...(slide.inherited ?? []), ...slide.nodes]) {
    if (!covers(node, w, h)) continue;
    if (node.type === 'pic') ground = { slide: n, photo: true };
    else if ((node.type === 'shape' || node.type === 'text') && !node.gradient) {
      // A translucent fill over the ground (a scrim) leaves the ground as it was.
      const hex = hexOf(node.fill);
      if (hex && hex.length === 7) ground = { slide: n, hex };
    }
  }
  return ground;
}

/** The pieces of a deck the brand family reads: Design-like rows of its colours, and each slide's ground. */
export interface PptxBrandRead {
  rows: Array<Record<string, unknown>>;
  grounds: PptxSlideGround[];
  /** The slide (1-based) each row came from. */
  slideOf: Map<string, number>;
}

/** Read a .pptx's painted colours as rows the brand check reads, and each slide's ground. */
export async function readPptxBrand(bytes: Uint8Array): Promise<PptxBrandRead> {
  const deck = readPptx(await inflatePptx(bytes) as never, await inventoryXmlParser() as never);
  const rows: Array<Record<string, unknown>> = [];
  const grounds: PptxSlideGround[] = [];
  const slideOf = new Map<string, number>();
  const w = deck.widthEmu;
  const h = deck.heightEmu;
  deck.slides.forEach((slide, i) => {
    const n = i + 1;
    const frame = `slide-${n}`;
    const add = (row: Record<string, unknown>): void => {
      rows.push({ frame, ...row });
      slideOf.set(String(row.id), n);
    };
    rows.push({ id: frame, kind: 'frame', name: `Slide ${n}`, x: 0, y: 0, w: 1, h: 1, ...(hexOf(slide.background?.color) && !slide.background?.gradient ? { bg: hexOf(slide.background?.color) } : {}) });
    slideOf.set(frame, n);
    grounds.push(groundOf(slide, n, w, h));
    [...(slide.inherited ?? []), ...slide.nodes].forEach((node, j) => {
      const id = `${frame}-${j + 1}`;
      const alt = (node as unknown as { alt?: unknown }).alt;
      const name = typeof alt === 'string' && alt.trim() ? alt.trim().slice(0, 80) : `Slide ${n} shape ${j + 1}`;
      if (node.type === 'shape') {
        const bg = node.gradient ? null : hexOf(node.fill);
        const stroke = node.lineGradient ? null : hexOf(node.line);
        if (bg || stroke) add({ id, kind: 'box', name, ...(bg ? { bg } : {}), ...(stroke ? { stroke } : {}) });
      } else if (node.type === 'text') {
        const bg = node.gradient ? null : hexOf(node.fill);
        if (bg) add({ id: `${id}-fill`, kind: 'box', name, bg });
        // One row per distinct run colour, named by the first words drawn in that colour.
        const seen = new Map<string, string>();
        for (const para of node.paras) for (const run of para.runs) {
          const fg = hexOf(run.color);
          if (!fg || !run.text.trim()) continue;
          if (!seen.has(fg)) seen.set(fg, run.text.trim().slice(0, 40));
        }
        let k = 0;
        for (const [fg, text] of seen) add({ id: `${id}-run${++k}`, kind: 'text', name, text, fg });
      }
    });
  });
  return { rows, grounds, slideOf };
}

/** The colour a token path resolves to in one theme, as `#rrggbb`, or null. */
function tokenHex(doc: unknown, theme: string | undefined, path: string): string | null {
  const set = createTokenSet(doc, theme ? { theme } : {});
  const value = set.resolve(path);
  const parsed = typeof value === 'string' ? parseColor(value) : null;
  return parsed && parsed.alpha > 0 && typeof value === 'string' ? value : null;
}

/**
 * The brand family of a .pptx against one theme of a design system: the colour findings
 * the Design brand check gives for the painted colours, and one ground finding per slide
 * whose ground is not the theme's.
 */
export async function pptxBrandFindings(bytes: Uint8Array, doc: unknown, theme: string | undefined): Promise<{ findings: CheckFindingV1[]; reason: string }> {
  const read = await readPptxBrand(bytes);
  const result = checkBrandDesign(read.rows, doc, theme ? { theme } : {});
  const findings: CheckFindingV1[] = [];
  const seen = new Set<string>();
  for (const f of result.findings) {
    if (f.kind !== 'color' && f.kind !== 'coverage') continue;
    const slide = f.layerId ? read.slideOf.get(f.layerId) : undefined;
    const key = `${slide ?? ''}|${f.kind}|${f.status}|${f.value ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // The rows are a reading of the slides, not layers of a document: no path, no fix.
    const { path: _path, layerId: _layer, box: _box, fix: _fix, artboardId: _artboard, ...finding } = checkFindingFromBrand(f);
    findings.push({ ...finding, ...(slide ? { page: String(slide) } : {}), evidence: { ...(finding.evidence ?? {}), ...(slide ? { slide: String(slide) } : {}) } });
  }

  const surface = tokenHex(doc, theme, 'color.semantic.surface');
  const accents = ['color.semantic.primary', 'color.semantic.secondary'].map((p) => tokenHex(doc, theme, p)).filter((v): v is string => !!v);
  const same = (a: string, b: string): boolean => {
    const d = deltaEOk(a, b);
    return Number.isFinite(d) && d < 0.02;
  };
  let judged = 0;
  let photos = 0;
  if (surface) {
    for (const ground of read.grounds) {
      if ('photo' in ground) { photos++; continue; }
      if (!('hex' in ground)) continue;
      judged++;
      if (same(ground.hex, surface) || accents.some((a) => same(ground.hex, a))) continue;
      findings.push({
        code: 'brand.ground.theme',
        family: 'brand',
        severity: 'warn',
        message: `Slide ${ground.slide} is drawn on ${ground.hex}, which is not the ${theme ?? 'default'} theme's surface (${surface}) or its primary or secondary colour. The deck may be in another theme or off the palette.`,
        needs: 'review',
        page: String(ground.slide),
        evidence: { slide: String(ground.slide), value: ground.hex, expected: surface, ...(theme ? { theme } : {}) },
        suggestion: surface,
        origin: { checker: 'brand-check', id: 'ground.theme' },
      });
    }
  }
  const slides = read.grounds.length;
  const reason = [
    `Read ${result.checked.colors === 1 ? 'one colour value' : `${result.checked.colors} colour values`} painted on ${slides === 1 ? 'one slide' : `${slides} slides`} (fills, outlines, text runs and grounds) and compared them with the design system${theme ? ` in the ${theme} theme` : ''}.`,
    surface
      ? `Checked ${judged === 1 ? 'one slide ground' : `${judged} slide grounds`} against the theme's surface${photos ? `; ${photos === 1 ? 'one slide has' : `${photos} slides have`} a picture ground, which was not judged` : ''}.`
      : 'The design system names no color.semantic.surface, so the slide grounds were not judged.',
    'Fonts, pictures and gradients in the deck were not compared.',
  ].join(' ');
  return { findings, reason };
}
