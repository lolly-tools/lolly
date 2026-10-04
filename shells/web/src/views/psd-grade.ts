// SPDX-License-Identifier: MPL-2.0
/**
 * Photoshop adjustment layers as Darkroom's grade (plans/289 M3, item 5).
 *
 * Darkroom's "Open as layers" keeps the pixel layers and has one grade over the
 * whole stack: exposure, contrast, Levels, Curves, saturation, the HSL mixer,
 * black and white and colour balance, applied in that order. A Photoshop
 * adjustment layer becomes part of that grade when it means the same thing to the
 * same pixels: at the top of the stack, outside any group, not clipped, not masked,
 * at full opacity and in Normal mode. Anything else is listed in the report and
 * left out, because applying it to the whole picture would change what the file
 * showed.
 *
 * The values come from engine/src/psd-adjustments.ts. What maps one to one is
 * listed as kept; what Darkroom can only come close to is listed with the reason.
 */

import type { RasterLayer } from '../../../../engine/src/raster-layers.ts';
import type { PsdAdjustmentValue, PsdHsl } from '../../../../engine/src/psd-adjustments.ts';
import { formatToneCurve } from '../../../../engine/src/tone-curve.ts';
import { t, tRaw } from '../i18n.ts';

export interface DarkroomGrade {
  /** Darkroom input values to seed. */
  inputs: Record<string, unknown>;
  /** One line per adjustment layer that became part of the grade. */
  kept: string[];
  /** One line per adjustment layer, or part of one, that did not. */
  notes: string[];
}

const LEVEL_CHANNELS = ['', 'Red', 'Green', 'Blue'] as const;
const CURVE_IDS = ['curveRgb', 'curveRed', 'curveGreen', 'curveBlue'] as const;
const HSL_BANDS = ['Red', 'Orange', 'Yellow', 'Green', 'Aqua', 'Blue', 'Purple', 'Magenta'] as const;
/** Photoshop's six Hue/Saturation ranges onto Darkroom's bands. */
const RANGE_BANDS = ['Red', 'Yellow', 'Green', 'Aqua', 'Blue', 'Magenta'] as const;
/** Darkroom's mixer turns a band by at most 40 degrees (hooks.js `hslBandsFrom`). */
const HUE_PER_STEP = 0.4;

/** Each kind's place in Darkroom's fixed order. */
const STAGE: Record<PsdAdjustmentValue['kind'], number> = {
  exposure: 1, 'brightness-contrast': 1, levels: 2, curves: 3, invert: 3, 'hue-saturation': 4, 'black-white': 5, 'color-balance': 6,
};

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
const round2 = (v: number): number => Math.round(v * 100) / 100;

/** Hue (0..360) and saturation (0..100) of a #rrggbb colour. */
export function hueSat(hex: string): { hue: number; sat: number } {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min, l = (max + min) / 2;
  if (d === 0) return { hue: 0, sat: 0 };
  const sat = d / (1 - Math.abs(2 * l - 1));
  const hue = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { hue: Math.round(((hue * 60) + 360) % 360), sat: Math.round(sat * 100) };
}

interface Mapped { inputs: Record<string, unknown>; approximate: string[] }

const identityLevels = (l: { inBlack: number; inWhite: number; outBlack: number; outWhite: number; gamma: number }) =>
  l.inBlack === 0 && l.inWhite === 255 && l.outBlack === 0 && l.outWhite === 255 && l.gamma === 1;

/** One adjustment's Darkroom inputs, and why any of it is only close. */
export function mapAdjustment(v: PsdAdjustmentValue): Mapped {
  const inputs: Record<string, unknown> = {};
  const approximate: string[] = [];
  switch (v.kind) {
    case 'levels':
      v.channels.forEach((l, i) => {
        if (!l || identityLevels(l)) return;
        const k = `levels${LEVEL_CHANNELS[i]}`;
        inputs[`${k}InBlack`] = clamp(l.inBlack, 0, 253);
        inputs[`${k}InWhite`] = clamp(Math.max(l.inWhite, l.inBlack + 2), 2, 255);
        inputs[`${k}OutBlack`] = l.outBlack;
        inputs[`${k}OutWhite`] = l.outWhite;
        inputs[`${k}Gamma`] = round2(clamp(l.gamma, 0.1, 5));
        if (l.gamma > 5) approximate.push(t('Darkroom’s gamma stops at 5.'));
      });
      break;
    case 'curves':
      v.channels.forEach((points, i) => {
        if (!points) return;
        const text = formatToneCurve(points);
        if (text) inputs[CURVE_IDS[i]!] = text;
      });
      approximate.push(t('The curve passes through the same points; between them it can bend slightly differently.'));
      break;
    case 'invert':
      inputs.curveRgb = '0-255_255-0';
      break;
    case 'hue-saturation':
      if (v.colorize) {
        inputs.bwMode = true;
        inputs.bwTint = true;
        inputs.bwTintHue = Math.round(((v.colorized.hue % 360) + 360) % 360);
        inputs.bwTintSat = clamp(Math.round(v.colorized.saturation), 0, 100);
        approximate.push(t('Colorize becomes a tinted black and white.'));
        if (v.colorized.lightness) approximate.push(t('Its lightness was not carried.'));
        break;
      }
      mapHueSat(v.master, v.ranges, inputs, approximate);
      approximate.push(t('Darkroom’s colour mixer bands are close to Photoshop’s ranges, not the same.'));
      break;
    case 'brightness-contrast':
      if (v.brightness) inputs.exposure = round2(clamp(v.brightness / 150, -1, 1));
      if (v.contrast) inputs.contrast = clamp(Math.round(v.contrast), -100, 100);
      approximate.push(t('Brightness becomes exposure, which brightens highlights more than Photoshop does.'));
      break;
    case 'exposure':
      inputs.exposure = round2(clamp(v.exposure, -3, 3));
      if (Math.abs(v.exposure) > 3) approximate.push(t('Darkroom’s exposure stops at 3 stops.'));
      if (Math.abs(v.offset) > 1e-4 || Math.abs(v.gamma - 1) > 1e-3) approximate.push(t('Its offset and gamma correction were not carried.'));
      break;
    case 'color-balance': {
      const set = (range: string, triple: [number, number, number]) => {
        inputs[`cb${range}CR`] = triple[0];
        inputs[`cb${range}MG`] = triple[1];
        inputs[`cb${range}YB`] = triple[2];
      };
      set('Shadows', v.shadows);
      set('Midtones', v.midtones);
      set('Highlights', v.highlights);
      inputs.cbPreserve = v.preserveLuminosity;
      break;
    }
    case 'black-white':
      inputs.bwMode = true;
      inputs.bwReds = v.reds;
      inputs.bwYellows = v.yellows;
      inputs.bwGreens = v.greens;
      inputs.bwCyans = v.cyans;
      inputs.bwBlues = v.blues;
      inputs.bwMagentas = v.magentas;
      if (v.tint) {
        const { hue, sat } = hueSat(v.tint);
        inputs.bwTint = true;
        inputs.bwTintHue = hue;
        inputs.bwTintSat = sat;
        approximate.push(t('The tint colour becomes a hue and strength.'));
      }
      break;
  }
  return { inputs, approximate };
}

function mapHueSat(master: PsdHsl, ranges: PsdHsl[], inputs: Record<string, unknown>, approximate: string[]): void {
  if (master.saturation) inputs.saturation = clamp(100 + master.saturation, 0, 200);
  const bandHue = new Map<string, number>();
  if (master.hue) {
    for (const band of HSL_BANDS) bandHue.set(band, master.hue);
    if (Math.abs(master.hue) > 100 * HUE_PER_STEP) approximate.push(t('Darkroom turns a colour by at most 40 degrees.'));
  }
  if (master.lightness) approximate.push(t('Its master lightness was not carried.'));
  ranges.forEach((r, i) => {
    const band = RANGE_BANDS[i]!;
    if (r.hue) bandHue.set(band, (bandHue.get(band) ?? 0) + r.hue);
    if (r.saturation) inputs[`hslSat${band}`] = clamp(Math.round(r.saturation), -100, 100);
    if (r.lightness) inputs[`hslLum${band}`] = clamp(Math.round(r.lightness), -100, 100);
  });
  for (const [band, deg] of bandHue) inputs[`hslHue${band}`] = clamp(Math.round(deg / HUE_PER_STEP), -100, 100);
}

/**
 * The grade for a layered file: the adjustments that can join it, in the order
 * Photoshop applied them, and a line for each one that could not.
 */
export function darkroomGradeFromLayers(layers: readonly RasterLayer[]): DarkroomGrade {
  const inputs: Record<string, unknown> = {};
  const kept: string[] = [];
  const notes: string[] = [];
  const name = (l: RasterLayer) => l.name || t('Untitled layer');

  // From the top of the stack down, the adjustments above every visible picture.
  const top: RasterLayer[] = [];
  let i = layers.length - 1;
  for (; i >= 0; i--) {
    const l = layers[i]!;
    if (!l.visible || l.isGroup) continue;
    if (!l.psd?.adjustment) break;
    top.push(l);
  }
  // Adjustments under a picture change only what is below them.
  for (; i >= 0; i--) {
    const l = layers[i]!;
    if (l.visible && l.psd?.adjustment) notes.push(tRaw('{name}: changes only the layers under it, so it was not applied.', { name: name(l) }));
  }

  const stages: number[] = [];
  const setBy = new Map<string, string>();
  // Photoshop applies the lowest adjustment first.
  for (const l of top.reverse()) {
    const psd = l.psd!;
    const why = !psd.adjustmentValue ? t('Darkroom has no control for this adjustment.')
      : l.groupPath.length ? t('It is inside a group.')
        : l.clipped ? t('It is clipped to the layer underneath.')
          : psd.adjustmentMask === 'partial' ? t('Its mask limits it to part of the picture.')
            : psd.adjustmentMask === 'hidden' ? null
              : l.opacity < 0.995 ? tRaw('It is at {n}% opacity, and Darkroom’s grade has no opacity.', { n: Math.round(l.opacity * 100) })
                : l.blend !== 'normal' ? t('It uses a blend mode, and Darkroom’s grade has none.')
                  : '';
    if (why === null) continue; // a black mask: the adjustment shows nowhere
    if (why) { notes.push(tRaw('{name} was not applied. {why}', { name: name(l), why })); continue; }
    const mapped = mapAdjustment(psd.adjustmentValue!);
    const clash = Object.keys(mapped.inputs).find((k) => setBy.has(k));
    if (clash) {
      notes.push(tRaw('{name} was not applied. {other}, lower in the stack, already sets the same Darkroom control.', { name: name(l), other: setBy.get(clash)! }));
      continue;
    }
    for (const k of Object.keys(mapped.inputs)) setBy.set(k, name(l));
    Object.assign(inputs, mapped.inputs);
    stages.push(STAGE[psd.adjustmentValue!.kind]);
    kept.push(mapped.approximate.length
      ? tRaw('{name}: kept, approximately. {why}', { name: name(l), why: mapped.approximate.join(' ') })
      : tRaw('{name}: kept.', { name: name(l) }));
  }
  if (stages.some((s, k) => k > 0 && s < stages[k - 1]!)) {
    notes.push(t('Darkroom applies its grade in a fixed order, which differs from the order of these layers, so the result can differ a little.'));
  }
  return { inputs, kept, notes };
}
