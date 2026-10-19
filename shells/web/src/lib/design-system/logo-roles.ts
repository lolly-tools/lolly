// SPDX-License-Identifier: MPL-2.0
/**
 * The colour roles a placed logo proposes (plan 320 S1).
 *
 * A placed logo used to hand its FIRST colour to the primary role and send the
 * rest to the tray. A mark drawn on a white rectangle therefore made white the
 * primary, and every tool kept the starter ink. Here the file's own colours are
 * ranked the way the role proposer ranks any artwork (brand-propose.ts through
 * census.ts): ink before ground, then chroma times weight for the main colour.
 *
 * A text colour comes from the file too, when the file carries a dark neutral
 * that reads on paper: a wordmark is usually set in the brand's text colour.
 * The surface is left alone. A logo's ground is usually only the canvas the
 * file was exported on, and the starter's paper is a better page than that.
 *
 * Pure and DOM-free, so the ranking is tested under node.
 */
import { contrastRatio, deltaEOk, hexToOklch } from '@lolly/engine';
import { proposeBrandRoles } from '../brand-propose.ts';
import { censusFromRasterInks, censusFromSvgColors, censusHex, censusToUsage } from './census.ts';
import type { DesignCensus } from './census.ts';

export interface LogoRoleOffer {
  /** The file's own colours as `#RRGGBB`, the proposed main colour first, then
   *  the other inks, then the neutrals. */
  colours: string[];
  /** The proposed main colour, the first of `colours`. */
  main: string;
}

/** A raster ink smaller than this share of the opaque pixels is an edge or a
 *  speck, not a colour anyone chose. */
const RASTER_MIN_SHARE = 0.03;
/** Two raster inks closer than this (OKLab distance) are one colour, split by
 *  anti-aliasing or compression. */
const RASTER_SAME_INK = 0.06;
/** The most colours one logo offers. */
const MAX_COLOURS = 6;
/** Below this OKLCH chroma a colour is a neutral (brand-propose.ts's accent floor). */
const NEUTRAL_CHROMA = 0.09;
/** The darkest a text colour may be is unbounded; the lightest is this OKLCH L. */
const TEXT_L_MAX = 0.5;
/** WCAG body-text floor against white paper. */
const TEXT_CONTRAST_MIN = 4.5;

/** An SVG logo's offer, from `extractSvgColors` output in document order. */
export function logoOfferFromSvg(colors: string[], label = ''): LogoRoleOffer | null {
  const own = unique(colors);
  return own.length ? offerFrom(censusFromSvgColors(own, label), own) : null;
}

/**
 * A raster logo's offer, from a census of its opaque pixels (any order). Specks
 * and anti-aliasing blends are dropped first: each ink must cover a few percent
 * of the mark, and an ink close to a heavier one is folded into that one.
 */
export function logoOfferFromRaster(inks: { hex: string; weight: number }[], label = ''): LogoRoleOffer | null {
  const total = inks.reduce((sum, ink) => sum + (Number.isFinite(ink.weight) && ink.weight > 0 ? ink.weight : 0), 0);
  if (!total) return null;
  const kept: { hex: string; weight: number }[] = [];
  for (const ink of [...inks].sort((a, b) => b.weight - a.weight)) {
    const hex = censusHex(ink.hex);
    if (!hex || !(ink.weight / total >= RASTER_MIN_SHARE)) continue;
    const near = kept.find(k => deltaEOk(k.hex, hex) < RASTER_SAME_INK);
    if (near) near.weight += ink.weight;
    else kept.push({ hex, weight: ink.weight });
  }
  return kept.length ? offerFrom(censusFromRasterInks(kept, label), kept.map(k => k.hex)) : null;
}

/**
 * The text colour a logo proposes once `main` is the main colour: the first of
 * the file's dark neutrals, other than the main colour, that reads at 4.5:1 on
 * white. Null leaves the text role as it is.
 */
export function logoTextFor(offer: LogoRoleOffer, main: string): string | null {
  for (const hex of offer.colours) {
    if (hex === main) continue;
    const ok = hexToOklch(hex);
    if (!ok || ok.c >= NEUTRAL_CHROMA || ok.l > TEXT_L_MAX) continue;
    if (contrastRatio(hex, '#FFFFFF') >= TEXT_CONTRAST_MIN) return hex;
  }
  return null;
}

function unique(colors: string[]): string[] {
  const out: string[] = [];
  for (const c of colors) {
    const hex = censusHex(c);
    if (hex && !out.includes(hex)) out.push(hex);
  }
  return out;
}

const isNeutral = (hex: string): boolean => (hexToOklch(hex)?.c ?? 0) < NEUTRAL_CHROMA;
const lightness = (hex: string): number => hexToOklch(hex)?.l ?? 1;

/**
 * Rank the file's own colours: the proposer's main colour and its other accents
 * in score order, then the remaining inks, then the neutrals, each in the order
 * the file gave them. Pure white is left out when the file has anything else:
 * in a logo it is the canvas or a knockout, not a colour anyone picked. The
 * implied ground a census adds is never offered.
 *
 * A mark with no colour at all (black on white, say) has no accent to lead with,
 * and the proposer would read its leading neutral as the page. Its ink is the
 * darkest colour, so that one leads.
 */
function offerFrom(census: DesignCensus, own: string[]): LogoRoleOffer | null {
  const roles = proposeBrandRoles(censusToUsage(census));
  if (!roles) return null;
  const painted = own.length > 1 ? own.filter(hex => hex !== '#FFFFFF') : own;
  const accents = [roles.primary, roles.secondary, ...roles.extras]
    .filter((hex): hex is string => !!hex && painted.includes(hex) && !isNeutral(hex));
  const neutrals = painted.filter(isNeutral);
  const lead = accents.length ? [] : [...neutrals].sort((a, b) => lightness(a) - lightness(b)).slice(0, 1);
  const colours = [...new Set([...accents, ...lead, ...painted.filter(hex => !isNeutral(hex)), ...neutrals])].slice(0, MAX_COLOURS);
  const main = colours[0];
  return main ? { colours, main } : null;
}
