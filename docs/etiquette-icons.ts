// SPDX-License-Identifier: MPL-2.0
/**
 * Lolly Demo's two-tone Etiquette icons as doc icons that follow the docs theme.
 *
 * The icons are catalog assets (`lolly/icons/<slug>`, brands/lolly-demo/catalog/assets/
 * lolly/icons/<slug>.svg, built by scripts/build-etiquette-icons.ts). Each file paints
 * its two parts through two classes with fixed fills: `c1` is the accent, the detail
 * that carries the meaning, and `c2` is the base, the object. A docs page cannot use the
 * fixed fills, because Spearmint on a dark page disappears. So the docs read each file at
 * build time, drop its stylesheet and paint the two parts from two custom properties
 * instead: `--eti-accent` and `--eti-base`. The reading stylesheet both readers share
 * (shells/web/src/styles/parts/docs-components.css) sets both from the theme's roles, so an
 * icon follows the theme, the colourway and High contrast on /info and in the app alike,
 * through the shared icon sprite as well as inline, because custom properties inherit into
 * a `<use>`. The fallbacks are the file's own pairing, Green Apple on Spearmint.
 *
 * The icons are Lucide drawings outlined by Lolly, and THIRD-PARTY-NOTICES.md credits
 * them under Lucide (ISC) by these exact files, so reading them here needs no new notice.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ICON_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../brands/lolly-demo/catalog/assets/lolly/icons');

/** The Etiquette icons the docs draw, each registered as the doc icon `eti-<slug>`: the
 *  whole set, so any page can open a section with one. They ship once, in the shared
 *  icon sprite. A new icon file needs its slug added here before a page can draw the icon. */
export const ETIQUETTE_DOC_ICONS = [
  'animation', 'award', 'badge-check', 'bird', 'blend', 'box', 'building', 'calendar', 'camera',
  'chat', 'checklist', 'circle-check', 'city', 'clipboard', 'clock', 'cloud-lightning',
  'cloud-rain', 'code', 'coffee', 'copy', 'cpu', 'crop', 'download', 'external-link', 'eye',
  'eye-off', 'file', 'file-plus', 'film', 'flask', 'folder-move', 'folder-plus', 'folder-shared',
  'gauge', 'globe', 'graduation-cap', 'grid', 'hammer', 'help', 'hexagon', 'history', 'home',
  'image', 'image-upload', 'images', 'info', 'keyboard', 'layers', 'link', 'lock', 'lolly', 'mail',
  'map-pin', 'megaphone', 'mic', 'monitor', 'music', 'mute', 'package', 'palette', 'pen',
  'pen-tool', 'pin', 'refresh', 'repeat', 'scissors', 'search', 'shapes', 'shield-check',
  'sliders', 'smile', 'sparkles', 'speak', 'stamp', 'sun', 'table', 'tag', 'train', 'trash',
  'type', 'unlink', 'upload', 'url', 'user-check', 'users', 'volume', 'warning', 'watermark',
  'wind-chimes',
] as const;

/** One icon file, repainted from the two custom properties. Throws on a file that does not
 *  have the two-class shape, so a redrawn icon cannot quietly lose its colours. */
export function themedEtiquetteSvg(svg: string): string {
  const body = /^\s*<svg\b[^>]*\bviewBox="0 0 24 24"[^>]*>([\s\S]*)<\/svg>\s*$/.exec(svg)?.[1];
  if (body === undefined) throw new Error('An Etiquette icon must be one 24 by 24 <svg>');
  const art = body.replace(/<defs>[\s\S]*?<\/defs>/, '');
  if (!/class="c1"/.test(art) || !/class="c2"/.test(art) || /<(?:style|script)\b|\bid=|\bon[a-z]+=/i.test(art)) {
    throw new Error('An Etiquette icon must paint with classes c1 and c2 only');
  }
  const painted = art
    .replace(/class="c1"/g, 'style="fill:var(--eti-accent,#50c369)"')
    .replace(/class="c2"/g, 'style="fill:var(--eti-base,#033633)"');
  return `<svg viewBox="0 0 24 24" class="eti" aria-hidden="true">${painted}</svg>`;
}

/** The registered icons, keyed `eti-<slug>`, read from the brand pack. */
export function etiquetteDocIcons(dir = ICON_DIR): Record<string, string> {
  const out: Record<string, string> = {};
  for (const slug of ETIQUETTE_DOC_ICONS) out[`eti-${slug}`] = themedEtiquetteSvg(readFileSync(resolve(dir, `${slug}.svg`), 'utf8'));
  return out;
}
