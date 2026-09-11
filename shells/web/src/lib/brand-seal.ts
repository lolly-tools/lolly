// SPDX-License-Identifier: MPL-2.0
/**
 * The locked-brand seal - shown on the Dashboard when the running catalogue's
 * brand is authoritative (host.tokens.isLocked(); see bridge/tokens.ts). A brand
 * you cannot edit deserves to look struck rather than greyed out, so this is a
 * turned-metal disc with a padlock over it.
 *
 * The metal is the classic SVG conic-gradient fake: two three-pointed fans (one
 * dark, one light) filled with radial gradients that fade at both ends, heavily
 * blurred, then re-stamped at descending scales so the sheen stays sharp at the
 * centre and soft at the rim. SVG still has no conic gradient, hence the trick.
 *
 * It is struck in the BRAND's own inks, not chrome: --seal-dark / --seal-light
 * are the darkest and lightest colours in the live palette and --seal-base is
 * its most saturated mid-tone, so a SUSE build turns out slate-and-jungle and a
 * red brand turns out red. sealColors() picks them (pure - unit-tested).
 */

import './brand-seal.css';
import { hexToOklch } from '@lolly/engine';
import { escapeHtml } from './html.ts';

export interface SealColors {
  /** The metal's body - the brand's most saturated mid-tone. */
  base: string;
  /** The dark rake - the palette's darkest ink. */
  dark: string;
  /** The light rake (and the padlock) - the palette's lightest ink. */
  light: string;
}

/** The seal's fallback inks when the palette is empty or unreadable - a neutral
 *  steel, so the disc still reads as metal rather than a flat blank. */
const SEAL_FALLBACK: SealColors = { base: '#6b7785', dark: '#1b2027', light: '#eef1f4' };

/**
 * Pick the three inks the seal is struck in from a brand's palette.
 *
 * - light / dark: the extremes of the lightness axis - the sheen's two rakes.
 * - base: the most CHROMATIC colour in the mid-lightness band, which is what
 *   makes the metal read as the brand's rather than as generic steel. Chroma is
 *   the right axis here: a brand's identity colour is its most saturated one,
 *   and the band keeps a near-black or near-white from winning on chroma alone.
 *
 * Near-duplicate extremes are the failure case (an all-mid-tone palette gives a
 * dark and a light barely a step apart, and the metal flattens to a disc), so
 * the rakes fall back to the neutral steel when they're too close to separate.
 */
export function sealColors(palette: readonly { hex: string }[]): SealColors {
  const lit = palette
    .map(p => ({ hex: p.hex, o: hexToOklch(p.hex) }))
    .filter((p): p is { hex: string; o: { l: number; c: number; h: number } } => !!p.o);
  if (!lit.length) return SEAL_FALLBACK;

  const byL = [...lit].sort((a, b) => a.o.l - b.o.l);
  const darkest = byL[0]!;
  const lightest = byL[byL.length - 1]!;

  // The band is generous (a brand whose only colours are pale still needs a
  // base); if nothing lands in it, fall back to the whole list.
  const mids = lit.filter(p => p.o.l >= 0.3 && p.o.l <= 0.8);
  const base = (mids.length ? mids : lit).reduce((best, p) => (p.o.c > best.o.c ? p : best));

  const separated = lightest.o.l - darkest.o.l > 0.25;
  return {
    base: base.hex,
    dark: separated ? darkest.hex : SEAL_FALLBACK.dark,
    light: separated ? lightest.hex : SEAL_FALLBACK.light,
  };
}

// Each mounted seal needs its own gradient/filter ids: SVG ids are
// document-global, so two seals sharing them would make the second one's
// url(#…) references resolve to the first one's defs.
let seq = 0;

const LOCK_ICON = `<svg class="brand-seal-lock" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
  fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <rect x="3" y="11" width="18" height="11" rx="2"/>
  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
</svg>`;

/**
 * The seal's markup. The disc is decorative (the surrounding copy carries the
 * meaning), so the whole thing is aria-hidden.
 */
export function renderBrandSeal(c: SealColors, size = 116): string {
  const uid = `seal${++seq}`;
  const dk = `${uid}-dk`, lt = `${uid}-lt`, blur = `${uid}-blur`, core = `${uid}-core`;
  // These land in a CSS context (a style attribute), where escaping alone would
  // not neutralise `;`/`url(` - and a palette hex can originate in a user-imported
  // tokens doc. Only a bare hex passes; anything else takes the fallback ink.
  const ink = (v: string, fb: string): string => (/^#[0-9a-f]{3,8}$/i.test(v.trim()) ? v.trim() : fb);
  const style = [
    `--seal-base:${escapeHtml(ink(c.base, SEAL_FALLBACK.base))}`,
    `--seal-dark:${escapeHtml(ink(c.dark, SEAL_FALLBACK.dark))}`,
    `--seal-light:${escapeHtml(ink(c.light, SEAL_FALLBACK.light))}`,
    `--seal-size:${size}px`,
  ].join(';');

  // The fans are stamped at descending scales (2× → 0.05×) so the sheen keeps a
  // sharp centre and a soft rim; the blur is what turns the hard triangles into
  // a rake. Safari ignores transform-origin on <use>, so the small stamps use a
  // matrix (scale + the translate that re-centres it) instead.
  return `<div class="brand-seal" style="${style}" aria-hidden="true">
    <svg class="brand-seal-metal" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" shape-rendering="optimizeSpeed">
      <defs>
        <radialGradient id="${dk}" cx="128" cy="128" r="156" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="var(--seal-dark)" stop-opacity="0"/>
          <stop offset=".4" stop-color="var(--seal-dark)" stop-opacity=".55"/>
          <stop offset="1" stop-color="var(--seal-dark)" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="${lt}" cx="128" cy="128" r="150" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="var(--seal-light)" stop-opacity="0"/>
          <stop offset=".36" stop-color="var(--seal-light)" stop-opacity=".55"/>
          <stop offset="1" stop-color="var(--seal-light)" stop-opacity="0"/>
        </radialGradient>
        <filter id="${blur}" x="0" y="0" width="128" height="128" color-interpolation-filters="sRGB">
          <feGaussianBlur stdDeviation="7"/>
        </filter>
      </defs>
      <g id="${core}" filter="url(#${blur})">
        <path fill="url(#${dk})" d="M128 128l177-22-101 175z m0 0l-177-22L52 281z m0 0L27-25h202z"/>
        <path fill="url(#${lt})" d="M128 128l104 135H29z m0 0L55-44-47 132z m0 0l78-172 102 176z"/>
      </g>
      <use href="#${core}" transform="scale(2)" transform-origin="128 128" transform-box="fill-box"/>
      <use href="#${core}" transform="matrix(.5 0 0 .5 63 69)"/>
      <use href="#${core}" transform="matrix(.3 0 0 .3 89 92)"/>
      <use href="#${core}" transform="matrix(.12 0 0 .12 113 114)"/>
      <use href="#${core}" transform="matrix(.05 0 0 .05 122 122)"/>
    </svg>
    ${LOCK_ICON}
  </div>`;
}
