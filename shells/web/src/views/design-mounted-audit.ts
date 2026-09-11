// SPDX-License-Identifier: MPL-2.0
/**
 * Checks that only the mounted Design render can answer honestly.
 *
 * The portable `inspectDesignV1` report owns document structure. This module owns
 * browser layout: actual overflow after shaping/text-fit, computed foreground and
 * background colours, and whether the vector-export font registry can resolve the
 * rendered run. It is read-only and web-shell-specific by design.
 */

import type { DesignInspectionV1, DesignLayerInspectionV1 } from '@lolly-tools/core/design-v1';

export type MountedDesignFindingId =
  | 'design.text.overflow'
  | 'design.text.contrast-low'
  | 'design.text.contrast-review'
  | 'design.font.unembeddable';

export interface MountedDesignFinding {
  id: MountedDesignFindingId;
  severity: 'warn' | 'info';
  path: string;
  /** Structured values let the shell translate at presentation time without
   * parsing the English fallback message. */
  evidence: {
    name: string;
    reason?: 'complex-background' | 'unresolved-colours';
    ratio?: string;
    minimum?: string;
    family?: string;
  };
  /** Stable English fallback for non-translating consumers and diagnostics. */
  message: string;
  layerId: string;
}

export interface MountedDesignAudit {
  findings: MountedDesignFinding[];
  checked: {
    overflow: number;
    contrast: number;
    fonts: number;
  };
  manualContrastReview: number;
}

export interface MountedFontStyle {
  fontFamily: string;
  fontWeight: string;
  fontStyle: string;
}

export interface MountedDesignAuditOptions {
  /** The same resolver SVG/PDF text outlining uses. `true` means real font bytes
   * cover the run; absent means font readiness is left unchecked. */
  resolveFont?: (style: MountedFontStyle, text: string) => Promise<boolean>;
  /** Test seam; the default is the browser's computed cascade. */
  styleOf?: (element: Element) => CSSStyleDeclaration;
}

interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

const TRANSPARENT: Rgba = { r: 0, g: 0, b: 0, a: 0 };

function parseRgb(value: string): Rgba | null {
  const input = value.trim().toLowerCase();
  if (!input || input === 'transparent') return TRANSPARENT;
  const match = input.match(
    /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+)(%)?)?\s*\)$/
  );
  if (!match) return null;
  const alphaRaw = match[4] === undefined ? 1 : Number(match[4]);
  const alpha = match[5] ? alphaRaw / 100 : alphaRaw;
  return {
    r: Math.max(0, Math.min(255, Number(match[1]))),
    g: Math.max(0, Math.min(255, Number(match[2]))),
    b: Math.max(0, Math.min(255, Number(match[3]))),
    a: Math.max(0, Math.min(1, alpha)),
  };
}

/** `front` painted over `back`. */
function over(front: Rgba, back: Rgba): Rgba {
  const a = front.a + back.a * (1 - front.a);
  if (a <= 0) return TRANSPARENT;
  return {
    r: (front.r * front.a + back.r * back.a * (1 - front.a)) / a,
    g: (front.g * front.a + back.g * back.a * (1 - front.a)) / a,
    b: (front.b * front.a + back.b * back.a * (1 - front.a)) / a,
    a,
  };
}

function luminance(colour: Rgba): number {
  const channel = (n: number): number => {
    const s = n / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(colour.r) + 0.7152 * channel(colour.g) + 0.0722 * channel(colour.b);
}

function contrastRatio(a: Rgba, b: Rgba): number {
  const one = luminance(a);
  const two = luminance(b);
  return (Math.max(one, two) + 0.05) / (Math.min(one, two) + 0.05);
}

function labelOf(layer: DesignLayerInspectionV1): string {
  return layer.name || layer.text?.trim().slice(0, 32) || layer.id;
}

function hasComplexPaint(
  box: HTMLElement,
  stop: HTMLElement,
  styleOf: (element: Element) => CSSStyleDeclaration
): boolean {
  if (
    box.querySelector(
      '.lolly-box-img, .lolly-box-video, .lolly-box-lottie, .lolly-box-anim, canvas'
    )
  )
    return true;
  for (let node: HTMLElement | null = box; node; node = node.parentElement) {
    const computed = styleOf(node);
    const image = computed.backgroundImage;
    if (image && image !== 'none') return true;
    if (Number.parseFloat(computed.opacity) < 0.999) return true;
    if (computed.mixBlendMode && computed.mixBlendMode !== 'normal') return true;
    if (computed.filter && computed.filter !== 'none') return true;
    if (computed.backdropFilter && computed.backdropFilter !== 'none') return true;
    if (
      node.classList.contains('lolly-frame-page') &&
      node.querySelector(':scope > .lolly-frame-img')
    )
      return true;
    if (node === stop) break;
  }
  return false;
}

/** Resolve the flat colour behind a text box from the real computed cascade. */
function flatBackground(
  box: HTMLElement,
  stop: HTMLElement,
  styleOf: (element: Element) => CSSStyleDeclaration
): Rgba | null {
  const paints: Rgba[] = [];
  for (let node: HTMLElement | null = box; node; node = node.parentElement) {
    const colour = parseRgb(styleOf(node).backgroundColor);
    if (colour && colour.a > 0) paints.push(colour);
    if (node === stop) break;
  }
  if (!paints.length) return null;
  let result = TRANSPARENT;
  for (let index = paints.length - 1; index >= 0; index--) result = over(paints[index]!, result);
  return result.a >= 0.999 ? result : null;
}

function intersects(a: DesignLayerInspectionV1, b: DesignLayerInspectionV1): boolean {
  return (
    a.bounds.x < b.bounds.x + b.bounds.width &&
    a.bounds.x + a.bounds.width > b.bounds.x &&
    a.bounds.y < b.bounds.y + b.bounds.height &&
    a.bounds.y + a.bounds.height > b.bounds.y
  );
}

function containsLayer(outer: DesignLayerInspectionV1, inner: DesignLayerInspectionV1): boolean {
  return (
    outer.bounds.x <= inner.bounds.x &&
    outer.bounds.y <= inner.bounds.y &&
    outer.bounds.x + outer.bounds.width >= inner.bounds.x + inner.bounds.width &&
    outer.bounds.y + outer.bounds.height >= inner.bounds.y + inner.bounds.height
  );
}

/** A transparent text box may be painted over a sibling rather than its ancestor.
 * Return the one honest flat-colour case (an opaque solid sibling covers the whole
 * run); anything partial, rotated or media-backed needs visual review. */
function siblingUnderlay(
  layer: DesignLayerInspectionV1,
  box: HTMLElement,
  layers: readonly DesignLayerInspectionV1[],
  elements: ReadonlyMap<string, HTMLElement>,
  styleOf: (element: Element) => CSSStyleDeclaration
): { colour?: Rgba; review: boolean } {
  const order = new Map<Element, number>();
  [...(box.parentElement?.children ?? [])].forEach((element, index) => {
    order.set(element, index);
  });
  const zOf = (element: HTMLElement): number => {
    const value = Number.parseFloat(styleOf(element).zIndex);
    return Number.isFinite(value) ? value : 0;
  };
  const targetZ = zOf(box);
  const targetOrder = order.get(box) ?? layer.index;
  const candidates = layers
    .filter((candidate) => {
      if (
        candidate.id === layer.id ||
        candidate.kind === 'frame' ||
        candidate.hidden ||
        candidate.artboardId !== layer.artboardId ||
        !intersects(candidate, layer)
      )
        return false;
      const element = elements.get(candidate.id);
      if (!element || element.parentElement !== box.parentElement) return false;
      const z = zOf(element);
      return (
        z < targetZ || (z === targetZ && (order.get(element) ?? candidate.index) < targetOrder)
      );
    })
    .sort((a, b) => {
      const aElement = elements.get(a.id)!;
      const bElement = elements.get(b.id)!;
      return (
        zOf(bElement) - zOf(aElement) ||
        (order.get(bElement) ?? b.index) - (order.get(aElement) ?? a.index)
      );
    });

  for (const candidate of candidates) {
    const element = elements.get(candidate.id)!;
    const colour = parseRgb(styleOf(element).backgroundColor);
    const hasContent = Boolean(
      element.querySelector('.lolly-box-img, .lolly-box-text:not(:empty), svg, canvas, video')
    );
    const complex =
      hasComplexPaint(element, element, styleOf) ||
      candidate.bounds.rotation !== 0 ||
      layer.bounds.rotation !== 0;
    if (!complex && (!colour || colour.a === 0) && !hasContent) continue;
    if (!complex && colour?.a === 1 && containsLayer(candidate, layer))
      return { colour, review: false };
    return { review: true };
  }
  return { review: false };
}

function pathOf(layer: DesignLayerInspectionV1, field?: string): string {
  return `/boxes/${layer.index}${field ? `/${field}` : ''}`;
}

/** Inspect a settled, mounted Design canvas. The caller owns repaint/font timing. */
export async function auditMountedDesign(
  canvas: HTMLElement,
  documentReport: DesignInspectionV1,
  options: MountedDesignAuditOptions = {}
): Promise<MountedDesignAudit> {
  const styleOf = options.styleOf ?? ((element: Element) => getComputedStyle(element));
  const findings: MountedDesignFinding[] = [];
  const checked = { overflow: 0, contrast: 0, fonts: 0 };
  let manualContrastReview = 0;
  const elements = new Map<string, HTMLElement>();
  for (const element of canvas.querySelectorAll<HTMLElement>('.lolly-box[data-box-id]')) {
    const id = element.dataset.boxId;
    if (id && !elements.has(id)) elements.set(id, element);
  }

  const fontRuns = new Map<
    string,
    {
      style: MountedFontStyle;
      text: string;
      layers: DesignLayerInspectionV1[];
    }
  >();

  for (const layer of documentReport.layers) {
    if (layer.kind !== 'text' || layer.hidden || !layer.id || !layer.text?.trim()) continue;
    const box = elements.get(layer.id);
    const text = box?.querySelector<HTMLElement>('.lolly-box-text');
    if (!box || !text) continue; // transient/not painted: do not manufacture a finding
    const name = labelOf(layer);

    if (box.clientWidth > 0 && box.clientHeight > 0) {
      checked.overflow++;
      if (text.scrollWidth > box.clientWidth + 0.5 || text.scrollHeight > box.clientHeight + 0.5) {
        findings.push({
          id: 'design.text.overflow',
          severity: 'warn',
          path: pathOf(layer, 'text'),
          evidence: { name },
          message: `Text in “${name}” is clipped at the current size.`,
          layerId: layer.id,
        });
      }
    }

    const boxColour = parseRgb(styleOf(box).backgroundColor);
    const underlay =
      boxColour?.a === 1
        ? { review: false }
        : siblingUnderlay(layer, box, documentReport.layers, elements, styleOf);
    if (hasComplexPaint(box, canvas, styleOf) || underlay.review) {
      manualContrastReview++;
      findings.push({
        id: 'design.text.contrast-review',
        severity: 'info',
        path: pathOf(layer, 'fg'),
        evidence: { name, reason: 'complex-background' },
        message: `Check “${name}” visually: its image or gradient background has no single contrast ratio.`,
        layerId: layer.id,
      });
    } else {
      const background = underlay.colour
        ? boxColour && boxColour.a > 0
          ? over(boxColour, underlay.colour)
          : underlay.colour
        : flatBackground(box, canvas, styleOf);
      const foreground = parseRgb(styleOf(text).color);
      if (!background || !foreground) {
        manualContrastReview++;
        findings.push({
          id: 'design.text.contrast-review',
          severity: 'info',
          path: pathOf(layer, 'fg'),
          evidence: { name, reason: 'unresolved-colours' },
          message: `Check “${name}” visually: its rendered colours could not be reduced to one contrast ratio.`,
          layerId: layer.id,
        });
      } else {
        checked.contrast++;
        const finalForeground = foreground.a < 1 ? over(foreground, background) : foreground;
        const ratio = contrastRatio(finalForeground, background);
        const computed = styleOf(text);
        const size = Number.parseFloat(computed.fontSize) || 16;
        const weight = Number.parseInt(computed.fontWeight, 10) || 400;
        const large = size >= 24 || (size >= 18.66 && weight >= 700);
        const minimum = large ? 3 : 4.5;
        if (ratio + 0.005 < minimum) {
          findings.push({
            id: 'design.text.contrast-low',
            severity: 'warn',
            path: pathOf(layer, 'fg'),
            evidence: {
              name,
              ratio: ratio.toFixed(1),
              minimum: minimum.toFixed(1),
            },
            message: `“${name}” has ${ratio.toFixed(1)}:1 contrast; this text needs at least ${minimum.toFixed(1)}:1.`,
            layerId: layer.id,
          });
        }
      }
    }

    if (options.resolveFont) {
      const computed = styleOf(text);
      const style: MountedFontStyle = {
        fontFamily: computed.fontFamily,
        fontWeight: computed.fontWeight,
        fontStyle: computed.fontStyle,
      };
      const key = `${style.fontFamily}|${style.fontWeight}|${style.fontStyle}|${layer.text}`;
      const existing = fontRuns.get(key);
      if (existing) existing.layers.push(layer);
      else fontRuns.set(key, { style, text: layer.text, layers: [layer] });
    }
  }

  if (options.resolveFont) {
    await Promise.all(
      [...fontRuns.values()].map(async (run) => {
        let resolved = false;
        try {
          resolved = await options.resolveFont!(run.style, run.text);
        } catch {
          resolved = false;
        }
        checked.fonts += run.layers.length;
        if (resolved) return;
        for (const layer of run.layers) {
          const family =
            run.style.fontFamily.split(',')[0]?.replace(/["']/g, '').trim() || 'selected font';
          findings.push({
            id: 'design.font.unembeddable',
            severity: 'warn',
            path: pathOf(layer, 'font'),
            evidence: { name: labelOf(layer), family },
            message: `“${labelOf(layer)}” uses ${family}, which cannot be embedded in vector exports.`,
            layerId: layer.id,
          });
        }
      })
    );
  }

  return { findings, checked, manualContrastReview };
}
