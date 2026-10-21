// SPDX-License-Identifier: MPL-2.0
/**
 * The cover: a design system shown small, in its own look. A ground in the
 * system's surface colour, its logo for the current app theme (or a monogram
 * when it has none) and a band of its primary and secondary colours. The
 * Settings strip shows it as a 64x44 thumbnail and the Preferences rows as a
 * 144x90 one; the Design system tab's cover uses the same look variables.
 *
 * Both looks are written into the markup (`--cv-l-*` for light, `--cv-d-*` for
 * dark) and design-system-specimen.css picks one from `:root[data-theme]`, so a
 * theme change repaints every cover with no script. Each logo carries the app
 * themes it serves in `data-looks`, and the sheet shows only the one for the
 * theme in force.
 *
 * Imported documents are untrusted: only a plain hex value reaches a style
 * attribute, a font stack has already been through brandFontStack, and a logo
 * URL with a scheme other than http(s), blob or an image data URL is dropped.
 * The whole cover is aria-hidden; the system's name, printed next to the
 * cover, carries the meaning.
 */
import '../../styles/parts/design-system-specimen.css';
import { escape as escapeText } from '../../utils.ts';
import type { CoverLook, CoverLooks, DesignSystemPreview } from './preview.ts';

export type CoverSize = 'thumb' | 'row';
export type CoverPreview = Pick<DesignSystemPreview, 'looks' | 'logos' | 'monogram' | 'display' | 'colors'> & Partial<DesignSystemPreview>;

/** The app themes a cover can be seen under, in the order data-looks lists them. */
const LOOKS = ['light', 'dark', 'brand'] as const;
type Look = typeof LOOKS[number];

const HEX = /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i;
const hex = (value: unknown): string | null => typeof value === 'string' && HEX.test(value) ? value.toLowerCase() : null;

/** What a light look falls back to when a slot is not plain hex: black on white. */
const PLAIN: CoverLook = { surface: '#ffffff', ink: '#000000', primary: '#000000', onPrimary: '#ffffff', secondary: '#000000' };

/**
 * The cover's look variables, for a style attribute. A light slot that is not
 * plain hex takes the plain black-on-white value; a dark one is left out, so
 * the sheet shows the light value in its place. The names are written out in
 * full so the house-rules check can see each one defined.
 */
export function coverVars(looks: CoverLooks): string {
  const l = looks.light;
  const d = looks.dark;
  const light = [
    `--cv-l-surface:${hex(l?.surface) ?? PLAIN.surface}`,
    `--cv-l-ink:${hex(l?.ink) ?? PLAIN.ink}`,
    `--cv-l-primary:${hex(l?.primary) ?? PLAIN.primary}`,
    `--cv-l-on-primary:${hex(l?.onPrimary) ?? PLAIN.onPrimary}`,
    `--cv-l-secondary:${hex(l?.secondary) ?? PLAIN.secondary}`,
  ];
  const dark = d ? [
    hex(d.surface) && `--cv-d-surface:${hex(d.surface)}`,
    hex(d.ink) && `--cv-d-ink:${hex(d.ink)}`,
    hex(d.primary) && `--cv-d-primary:${hex(d.primary)}`,
    hex(d.onPrimary) && `--cv-d-on-primary:${hex(d.onPrimary)}`,
    hex(d.secondary) && `--cv-d-secondary:${hex(d.secondary)}`,
  ].filter((v): v is string => !!v) : [];
  return [...light, ...dark].join(';');
}

/** A logo URL the cover may load: http(s), blob, an image data URL or a path. */
function safeSrc(url: unknown): string | null {
  if (typeof url !== 'string' || !url.trim() || [...url].some(ch => ch.charCodeAt(0) < 32)) return null;
  const scheme = /^([a-z][a-z\d+.-]*):/i.exec(url.trim())?.[1]?.toLowerCase();
  if (!scheme) return url;
  if (scheme === 'http' || scheme === 'https' || scheme === 'blob') return url;
  return scheme === 'data' && /^data:image\//i.test(url.trim()) ? url : null;
}

/**
 * The logo for each app theme. A system with no dark look is painted in its
 * light look under the dark theme, so it shows its light logo there too: the
 * reverse form on a light ground would disappear.
 */
function logoPerLook(p: CoverPreview): Record<Look, string | null> {
  const logos = p.logos ?? (p.logoUrl ? { light: p.logoUrl, dark: p.logoUrl, brand: p.logoUrl } : {});
  return {
    light: safeSrc(logos.light),
    dark: safeSrc(p.looks.dark ? logos.dark : logos.light),
    brand: safeSrc(logos.brand),
  };
}

/** True when the browser holds a face of this family, so the cover can use that face. */
function hasFace(family: string | undefined): boolean {
  if (!family || typeof document === 'undefined' || !document.fonts) return false;
  const want = family.toLowerCase();
  try {
    for (const face of document.fonts) {
      if (face.family.replace(/^["']|["']$/g, '').toLowerCase() === want) return true;
    }
  } catch { /* an engine without an iterable FontFaceSet: use the fallback face */ }
  return false;
}

/** The first family a font stack names, unquoted. */
const firstFamily = (stack: string): string | undefined => stack.split(',')[0]?.trim().replace(/^["']|["']$/g, '') || undefined;

/**
 * One cover. `thumb` is the strip's 64x44, `row` the Preferences row's 144x90,
 * whose band adds up to four more of the system's colours after its primary and
 * secondary. The monogram is set in the system's display face only when that
 * face is in the browser (it always is for the active system); otherwise it
 * falls back to the shell's text face.
 */
export function coverHtml(p: CoverPreview, size: CoverSize, opts: { active?: boolean } = {}): string {
  const family = p.families?.[0] ?? firstFamily(p.display);
  const font = p.display && (opts.active || hasFace(family)) ? `;--cv-font:${p.display}` : '';
  const logos = logoPerLook(p);
  const byUrl = new Map<string, Look[]>();
  for (const look of LOOKS) {
    const url = logos[look];
    if (url) byUrl.set(url, [...(byUrl.get(url) ?? []), look]);
  }
  const bare = LOOKS.filter(look => !logos[look]);
  const imgs = [...byUrl].map(([url, looks]) => `<img class="ds-cover-logo" src="${escapeText(url)}" alt="" data-looks="${looks.join(' ')}" decoding="async">`).join('');
  // The extra chips leave out what the cover already paints (either look's ground,
  // primary and secondary), so no chip repeats the band or vanishes into the ground.
  const lead = [p.looks.light, p.looks.dark].flatMap(l => l ? [hex(l.surface), hex(l.primary), hex(l.secondary)] : []);
  const more = size === 'row'
    ? [...new Set(p.colors.map(hex).filter((c): c is string => !!c && !lead.includes(c)))].slice(0, 4)
    : [];
  const band = `<i></i><i></i>${more.map(c => `<i style="--sw:${c}"></i>`).join('')}`;
  return `<span class="ds-cover ds-cover--${size} ds-look" style="${escapeText(coverVars(p.looks) + font)}" aria-hidden="true">${imgs}<span class="ds-cover-mono" data-looks="${bare.join(' ')}">${escapeText(p.monogram)}</span><span class="ds-cover-band">${band}</span></span>`;
}

/**
 * A logo that fails to load leaves its cover: the monogram takes over the app
 * themes the logo served. Wire once per render, straight after the markup is written.
 */
export function wireCoverImages(root: ParentNode): void {
  root.querySelectorAll<HTMLImageElement>('.ds-cover img.ds-cover-logo').forEach(img => {
    img.addEventListener('error', () => {
      const mono = img.closest('.ds-cover')?.querySelector<HTMLElement>('.ds-cover-mono');
      const looks = new Set([...(mono?.dataset.looks ?? '').split(' '), ...(img.dataset.looks ?? '').split(' ')].filter(Boolean));
      img.remove();
      if (mono) mono.dataset.looks = LOOKS.filter(look => looks.has(look)).join(' ');
    }, { once: true });
  });
}
