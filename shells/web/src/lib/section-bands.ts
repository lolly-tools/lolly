// SPDX-License-Identifier: MPL-2.0
/**
 * Which band a tool sidebar's section belongs to (plans/273).
 *
 * `input.section` is a free string in the manifest, and 144 distinct ones are in
 * use across the catalogue, 114 of them exactly once. This module does not rename
 * any of them. It answers one question - which of the five bands does this section
 * sit in - so every tool's sidebar is ordered by the same five questions rather
 * than by whatever order its author happened to declare inputs in.
 *
 * The table is data, in `schemas/section-vocabulary.json`, so the renderer, the
 * catalog validator and the authoring guide read one file.
 *
 * WHAT THIS IS NOT. It is not a codemod and it changes no manifest. A manifest may
 * later spell its band explicitly ("Content/Data"); until then the band is resolved
 * here, at render time, which means every tool gains the ladder with no churn and
 * the whole thing is one import away from being reverted.
 *
 * Chrome only. The CLI, the TUI and MCP ignore bands exactly as they ignore
 * `render.sectionIcons`; the input model, URL encoding and determinism are
 * untouched.
 */
import vocabulary from '../../../../schemas/section-vocabulary.json' with { type: 'json' };

export const BANDS = ['content', 'style', 'layout', 'presence', 'more'] as const;
export type Band = (typeof BANDS)[number];

interface BandMeta { id: Band; title: string; glyph: string; asks: string }
interface SectionMeta { band: Band; glyph: string }

const isBand = (value: unknown): value is Band => typeof value === 'string' && (BANDS as readonly string[]).includes(value);

/** The vocabulary file read through a guard, so a band id the code does not know is dropped rather than trusted. */
const BAND_LIST: BandMeta[] = vocabulary.bands.flatMap((band) =>
  isBand(band.id) ? [{ id: band.id, title: band.title, glyph: band.glyph, asks: band.asks }] : []);
const SECTIONS: Record<string, SectionMeta> = Object.fromEntries(
  Object.entries(vocabulary.sections).flatMap(([name, section]) =>
    isBand(section.band) ? [[name, { band: section.band, glyph: section.glyph }]] : []),
);

/** `Object.hasOwn`, not a bare lookup: a section literally named `constructor` or
 *  `__proto__` must not resolve through the prototype into a band. */
const own = (name: string): SectionMeta | undefined =>
  Object.hasOwn(SECTIONS, name) ? SECTIONS[name] : undefined;

/**
 * Case and punctuation are not the author's contract, the word is. "Colour & style"
 * and "Colour and style" are the same section to a reader, so they are the same
 * section here.
 */
function normalise(name: string): string {
  return name.trim().toLowerCase().replace(/\band\b/g, '&').replace(/[^a-z0-9&]+/g, ' ').trim();
}
const BY_NORMAL = new Map<string, SectionMeta>();
for (const [name, meta] of Object.entries(SECTIONS)) BY_NORMAL.set(normalise(name), meta);

/** A band's word and glyph, in ladder order. */
export function bandList(): readonly BandMeta[] { return BAND_LIST; }
export function bandMeta(id: Band): BandMeta {
  return BAND_LIST.find((b) => b.id === id) ?? BAND_LIST[0]!;
}

/** The glyph the vocabulary gives this section, or undefined to leave the
 *  manifest's own `sectionIcons` choice alone. */
export function sectionGlyph(name: string): string | undefined {
  return (own(name) ?? BY_NORMAL.get(normalise(name)))?.glyph;
}

/**
 * The band for each section name, in the order the sections were declared.
 *
 * A name the vocabulary does not know INHERITS the band of the section before it,
 * and falls to `content` when it is the first. That is the conservative answer: a
 * tool-specific name stays where its author put it rather than being filed under a
 * band somebody guessed at, and a tool whose every name is unknown renders as one
 * Content band, which is what it looks like today plus a label.
 */
export function resolveBands(sections: readonly string[]): Map<string, Band> {
  const out = new Map<string, Band>();
  let carried: Band = 'content';
  for (const name of sections) {
    const known = own(name) ?? BY_NORMAL.get(normalise(name));
    carried = known?.band ?? carried;
    out.set(name, carried);
  }
  return out;
}

/**
 * Whether a band is drawn with a band head (`.lp-band-head` in panel.css) rather
 * than a band label: it holds exactly one section, and that section has the
 * band's own name ("Layout" alone in the layout band). A label reading LAYOUT
 * over a section head reading Layout says one word twice, so the rule becomes
 * the section's head. Every other band keeps its label, including one whose single
 * section has a different name (Position alone is still Layout, then Position).
 */
export function isBandHead(band: Band, sections: readonly string[]): boolean {
  return sections.length === 1 && normalise(sections[0]!) === normalise(bandMeta(band).title);
}

/** The sections a tool declares, regrouped into ladder order. Order WITHIN a band
 *  is the manifest's own, so an author still decides what comes first. */
export function orderSections(sections: readonly string[]): string[] {
  const bands = resolveBands(sections);
  return sections
    .map((name, i) => [name, i] as const)
    .sort(([a, ai], [b, bi]) =>
      (BANDS.indexOf(bands.get(a) ?? 'content') - BANDS.indexOf(bands.get(b) ?? 'content')) || (ai - bi))
    .map(([name]) => name);
}
