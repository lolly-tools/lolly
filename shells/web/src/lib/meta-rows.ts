// SPDX-License-Identifier: MPL-2.0
/**
 * The label and value rows of a details list (`dl.cat-details-meta`): the asset
 * inspector's Details, its provenance, Used in, swatch and song rows, and the
 * Projects info sheet.
 *
 * Every row has a stable key, and the key, never the label, picks the glyph drawn
 * before the label and the place the row takes in the asset's Details list. Labels
 * are translated where they are written, so matching on their text would draw a
 * different glyph, or none, in every language but English. A key this table does
 * not know draws the neutral dot, so the label column stays aligned.
 *
 * The glyph is decoration: it is aria-hidden, and the label beside it stays text.
 */
import { escape as escapeText } from '../utils.ts';
import { icon, type IconName } from './icons.ts';

/**
 * Each key's glyph and its rank in the asset's Details list, where facts read in
 * the order most people look for them: what the asset is, how big it is, when it
 * was made or added, who it comes from and what using it asks of you, how it is
 * filed, then the encoding and camera detail, and the id last. Rank 0 marks a row
 * that never joins that list (a provenance, song, swatch, source or project row), or
 * that its owner places by hand, as the credential record's rows go ahead of the id.
 * A third entry gives the row a late fact would only repeat: an upload's import
 * date is the date it was added, and a song's tagged artist is usually its author.
 */
const ROWS = {
  // What it is
  category: ['grid', 100], format: ['document', 110],
  title: ['font', 120], artist: ['mic', 121], album: ['music', 122], year: ['history', 123], genre: ['shapes', 124],
  family: ['smile', 130], style: ['paintbrush', 131], release: ['history', 132], glyphs: ['gridDense', 133], coverage: ['dashboard', 134],
  discipline: ['graduationCap', 140], status: ['seal', 141], audience: ['users', 142], revision: ['history', 143], steward: ['user', 144], skill: ['sparkle', 145],
  // How big it is
  dimensions: ['ruler', 200], pages: ['layersStack', 210], duration: ['timer', 220], fileSize: ['hardDrive', 230],
  // When
  taken: ['clock', 300], added: ['calendar', 310], modified: ['pen', 320], imported: ['upload', 330, 'added'], importedFrom: ['filePlus', 340],
  // Who it comes from, and what using it asks
  source: ['package', 400], maker: ['userCheck', 402], madeWith: ['tool', 404], licence: ['scale', 410], credit: ['quote', 420], using: ['checklist', 430], author: ['user', 440, 'artist'], copyright: ['copyright', 450],
  // How it is filed
  tags: ['tag', 500], projects: ['folder', 510],
  // Encoding and camera detail
  resolution: ['gridDense', 600], colourDepth: ['palette', 610], iccProfile: ['droplet', 620], viewBox: ['fitAll', 630],
  camera: ['camera', 640], lens: ['focus', 641], aperture: ['aperture', 642], exposure: ['timer', 643], iso: ['sunburst', 644],
  focalLength: ['zoomIn', 645], orientation: ['rotateCw', 646], location: ['mapPin', 647],
  codec: ['cpu', 660], bitrate: ['dashboard', 661], sampleRate: ['noise', 662], channels: ['volumeOn', 663], frameRate: ['filmStrip', 664], frames: ['keyframe', 665], timecode: ['sliders', 666], playback: ['play', 667],
  software: ['wrench', 680], keywords: ['search', 681],
  id: ['hash', 900],
  // Rows of the other lists
  origins: ['penTool', 0], session: ['document', 0], language: ['code', 0],
  cmyk: ['droplet', 0], spotInk: ['paintbrush', 0], finish: ['sparkle', 0], appliedAs: ['layers', 0], authoredFor: ['penTool', 0],
  srgbFallback: ['convert', 0], designToken: ['tokens', 0], authoredAs: ['code', 0], description: ['textL', 0],
  displayableIn: ['monitor', 0], chromaHeadroom: ['sliders', 0],
  library: ['building', 0], sourceId: ['hash', 0], indexedVersion: ['history', 0], sourceModified: ['pen', 0], lastSync: ['refresh', 0],
  listingStatus: ['checklist', 0], availability: ['eye', 0], availableFrom: ['calendar', 0], availableUntil: ['calendar', 0],
  validFrom: ['calendar', 0], validUntil: ['calendar', 0],
  approval: ['seal', 0], purpose: ['focus', 0], prompt: ['quote', 0], brandPage: ['globe', 0], selectedFile: ['document', 0], fileRole: ['layers', 0], originalAvailability: ['download', 0],
  kind: ['grid', 0], where: ['folder', 0], contains: ['layersStack', 0], created: ['calendar', 0], lastOpened: ['eye', 0], favourite: ['star', 0],
} as const satisfies Record<string, readonly [IconName, number] | readonly [IconName, number, string]>;

export type MetaKey = keyof typeof ROWS;

/** Every key, for checks that read the whole table. */
export const META_KEYS = Object.keys(ROWS) as MetaKey[];

const known = (key: string | null | undefined): key is MetaKey => !!key && Object.hasOwn(ROWS, key);

/** The glyph drawn before a row's label: the key's own, or the neutral dot. */
export function metaGlyph(key: string | null | undefined): string {
  return icon(known(key) ? ROWS[key][0] : 'dot', { className: 'cat-meta-icon' });
}

/** A key's rank in the asset's Details list. An unknown key goes last. */
export function metaRank(key: string | null | undefined): number {
  return known(key) ? ROWS[key][1] || 1000 : 1000;
}

/**
 * One row. `label` is plain text and is escaped here; `valueHtml` is markup the
 * caller has already escaped. A row with no label continues the row above it, so it
 * draws no glyph.
 */
export function metaRow(key: MetaKey | null, label: string, valueHtml: string, ddAttrs = ''): string {
  return `<div${key ? ` data-meta="${key}"` : ''}><dt>${label ? metaGlyph(key) : ''}${escapeText(label)}</dt>`
    + `<dd${ddAttrs ? ` ${ddAttrs}` : ''}>${valueHtml}</dd></div>`;
}

/** A plain-text row as an element, for lists built node by node. */
export function metaRowElement(doc: Document, key: MetaKey | null, label: string, value: string): HTMLElement {
  return parseRow(doc, metaRow(key, label, escapeText(value)));
}

function parseRow(doc: Document, html: string): HTMLElement {
  const template = doc.createElement('template');
  template.innerHTML = html; // metaRow escapes the label and every caller escapes the value
  return template.content.firstElementChild as HTMLElement;
}

/** A fact read after the list was drawn, such as a file's measured dimensions. */
export interface LateMetaField { key: MetaKey; label: string; value: string }

/** The row a late fact would only repeat, when its value matches (see ROWS). */
export function metaTwin(key: MetaKey): MetaKey | null {
  const twin = (ROWS[key] as readonly unknown[])[2];
  return typeof twin === 'string' && known(twin) ? twin : null;
}

/**
 * Add facts to a list already on screen. A key the list already shows keeps its row
 * and takes the newer value, so nothing moves; a new key's row goes in at its rank,
 * after any row of the same rank. A key repeated in `fields` keeps its first value,
 * and a fact that only repeats its twin row's value is left out. Returns the rows
 * it added.
 */
export function mergeMetaRows(list: HTMLElement, fields: readonly LateMetaField[]): HTMLElement[] {
  const seen = new Set<string>(), added: HTMLElement[] = [];
  const keyOf = (row: Element): string | null => row.getAttribute('data-meta');
  const cellOf = (key: string): HTMLElement | null | undefined => [...list.children].find(row => keyOf(row) === key)?.querySelector('dd');
  for (const field of fields) {
    if (seen.has(field.key)) continue;
    seen.add(field.key);
    const twin = metaTwin(field.key);
    if (twin && cellOf(twin)?.textContent === field.value) continue;
    const value = cellOf(field.key);
    if (value) { if (value.textContent !== field.value) value.textContent = field.value; continue; }
    const row = metaRowElement(list.ownerDocument, field.key, field.label, field.value);
    const rank = metaRank(field.key);
    list.insertBefore(row, [...list.children].find(node => metaRank(keyOf(node)) > rank) ?? null);
    added.push(row);
  }
  return added;
}
