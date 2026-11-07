// SPDX-License-Identifier: MPL-2.0
/**
 * Guest-mark checks: a Design document's partner marks against the partner kit's rules
 * (Lolly Work plan 82 M8). A sibling of `brand-check.ts`, pure and DOM-free, so the app's
 * checks and export pre-flight, `lolly check --kit` and Lolly Work's server read the same
 * answer from the same boxes.
 *
 * Three rules, each only when the kit states it:
 *
 * - Minimum size: the mark's drawn height in export pixels and, on a document measured in
 *   a physical unit, in millimetres, against `rules.minSize`.
 * - Clear space: the mark inflated on every side by `clearSpace.value` times its drawn
 *   height. Any other visible layer that overlaps that band is named, except one that holds
 *   the whole mark, which is its background and not a neighbour. Two kit marks check each
 *   other the same way.
 * - Treatment: a mark recoloured by a photo treatment or an icon theme is drawn in one
 *   colour, else in full colour; a mark whose nearest layer beneath that holds it whole is a
 *   picture sits on a photo. A treatment the kit does not list is pointed out. `reverse` is
 *   in the vocabulary and is not measured: the logo for dark surfaces is the reverse by
 *   construction, so the report says so rather than guessing.
 *
 * Findings are reviews and never refusals: nothing here blocks an export, a render or a
 * save, and no finding carries an automatic fix, because sizing a mark is the person's
 * call. Geometry is read from the boxes as authored (CSS pixels); a rotated layer is
 * measured by its bounding box. A tool's logo input has no geometry without a render, so
 * only Design documents are measured.
 */
import type { PartnerKitTreatmentV1, PartnerKitV1 } from '@lolly-tools/core/partner-kit-v1';
import type { BrandFinding } from './brand-check.ts';
import { parseThemedAssetId, parseTreatedAssetId, stripAssetModifiers } from './asset-modifiers.ts';
import { AUTO_ASSET_THEME } from './icon-theme.ts';
import { partnerKitLogoIds } from './partner-kit.ts';
import { CSS_DPI, isUnit } from './units.ts';

/** How the document's CSS pixels become export pixels and millimetres. */
export interface GuestMarkMeasure {
  /** The document's unit (`px`, `mm`, `cm`, `in`, `pt`, `pc`). Default `px`. */
  unit?: string;
  /** Raster resolution for a physical unit. Default 300. */
  dpi?: number;
  /** For a pixel document exported at another width than it was laid out at: export px per CSS px. Default 1. */
  scale?: number;
  /** A logo's width over its height, so a contained mark is measured where it is drawn rather than by its box. */
  logoAspect?: (assetId: string) => number | null | undefined;
  /** Whether an asset is a raster picture or a vector drawing. Unknown counts as a picture. */
  pictureKind?: (assetId: string) => 'raster' | 'vector' | null | undefined;
}

export interface GuestMarkReport {
  /** `kind: 'mark'`, `status: 'review'`, one per mark and rule. */
  findings: BrandFinding[];
  /** Marks measured, and the kit rules they were measured against. */
  checked: { marks: number; rules: Array<'min-size' | 'clear-space' | 'treatment'> };
  /** What the kit states and this check does not measure, in words. */
  notMeasured: string[];
}

type Row = Record<string, unknown>;
interface Rect { x: number; y: number; w: number; h: number }
interface Layer { row: Row; id: string; index: number; z: number; rect: Rect; label: string; kind: string; image: string; start: number; end: number }

const MAX_ROWS = 5000;
const MAX_FINDINGS = 200;
/** Layers that are pages, sound or a camera path, never a neighbour on the page. */
const NOT_ON_PAGE = new Set(['frame', 'audio', 'camera']);
const TREATMENT_WORDS: Record<PartnerKitTreatmentV1, string> = { colour: 'full colour', mono: 'one colour', reverse: 'reversed', 'on-photo': 'on a photo' };

const record = (v: unknown): v is Row => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v: unknown, fallback = 0): number => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback;
};
const imageId = (v: unknown): string => (typeof v === 'string' ? v : record(v) && typeof v.id === 'string' ? v.id : '');
const hidden = (row: Row): boolean => row.hidden === true || row.hidden === 'true';

/** Choices in a sentence: "A, B or C", with no comma before the last. */
function orList(words: string[]): string {
  return words.length <= 1 ? (words[0] ?? '') : `${words.slice(0, -1).join(', ')} or ${words[words.length - 1]}`;
}

/** A number for a sentence: whole pixels, millimetres to one place. */
const pxText = (n: number): string => `${Math.round(n)}`;
const mmText = (n: number): string => `${Math.round(n * 10) / 10}`;

/** The axis-aligned bounds of a box, rotated about its centre. */
function boundsOf(row: Row): Rect {
  const x = num(row.x), y = num(row.y), w = Math.max(0, num(row.w)), h = Math.max(0, num(row.h));
  const rot = ((num(row.rot) % 360) + 360) % 360;
  if (!rot) return { x, y, w, h };
  const r = (rot * Math.PI) / 180;
  const cos = Math.abs(Math.cos(r)), sin = Math.abs(Math.sin(r));
  const bw = w * cos + h * sin, bh = w * sin + h * cos;
  return { x: x + w / 2 - bw / 2, y: y + h / 2 - bh / 2, w: bw, h: bh };
}

/** Where a contained logo is drawn inside its box, from its aspect and the box's `imgpos`. */
function drawnRect(row: Row, rect: Rect, aspect: number | null | undefined): Rect {
  const fit = typeof row.fit === 'string' ? row.fit : 'contain';
  if (fit !== 'contain' || !aspect || !(aspect > 0) || !Number.isFinite(aspect) || num(row.rot) % 360) return rect;
  const w = Math.min(rect.w, rect.h * aspect);
  const h = Math.min(rect.h, rect.w / aspect);
  const pos = typeof row.imgpos === 'string' ? row.imgpos : 'center';
  const fx = /left/.test(pos) ? 0 : /right/.test(pos) ? 1 : 0.5;
  const fy = /top/.test(pos) ? 0 : /bottom/.test(pos) ? 1 : 0.5;
  return { x: rect.x + (rect.w - w) * fx, y: rect.y + (rect.h - h) * fy, w, h };
}

const EPS = 0.01;
const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w - EPS && b.x < a.x + a.w - EPS && a.y < b.y + b.h - EPS && b.y < a.y + a.h - EPS;
const holds = (outer: Rect, inner: Rect): boolean =>
  inner.x >= outer.x - EPS && inner.y >= outer.y - EPS && inner.x + inner.w <= outer.x + outer.w + EPS && inner.y + inner.h <= outer.y + outer.h + EPS;
/** Two timed layers that are never on screen together are not neighbours. */
const together = (a: Layer, b: Layer): boolean => a.start < b.end && b.start < a.end;

function layerLabel(row: Row, id: string): string {
  const name = typeof row.name === 'string' ? row.name.trim() : '';
  if (name) return name;
  const text = typeof row.text === 'string' ? row.text.trim().replace(/\s+/g, ' ') : '';
  if (text) return text.length > 40 ? `${text.slice(0, 39)}…` : text;
  return id || 'Layer';
}

/**
 * Check a Design document's partner marks against a kit. `boxes` is Design's flat boxes
 * value; `kit` a kit `readPartnerKit` accepted. A mark is an image layer whose asset is one
 * of the kit's logos, by id: the pinned version does not matter, so a mark placed from an
 * older revision is still the partner's mark.
 */
export function checkGuestMarks(boxes: unknown, kit: Pick<PartnerKitV1, 'label' | 'logos' | 'rules'>, measure: GuestMarkMeasure = {}): GuestMarkReport {
  const rules = kit.rules ?? {};
  const company = typeof kit.label === 'string' && kit.label ? kit.label : 'The partner';
  const logos = new Set(partnerKitLogoIds(kit));
  const unit = typeof measure.unit === 'string' && isUnit(measure.unit) ? measure.unit : 'px';
  const physical = unit !== 'px';
  const dpi = num(measure.dpi, 300) > 0 ? num(measure.dpi, 300) : 300;
  const scale = num(measure.scale, 1) > 0 ? num(measure.scale, 1) : 1;
  const exportPx = (cssPx: number): number => (physical ? (cssPx / CSS_DPI) * dpi : cssPx * scale);
  const millimetres = (cssPx: number): number => (cssPx / CSS_DPI) * 25.4;

  const checkedRules: GuestMarkReport['checked']['rules'] = [];
  if (rules.minSize && (rules.minSize.px !== undefined || rules.minSize.mm !== undefined)) checkedRules.push('min-size');
  if (rules.clearSpace) checkedRules.push('clear-space');
  if (rules.treatments?.length) checkedRules.push('treatment');
  const notMeasured: string[] = [];
  if (rules.treatments?.length) notMeasured.push('reversed use: the logo for dark surfaces is the reverse, so a reversed mark is not measured');
  if (rules.minSize?.mm !== undefined && !physical) notMeasured.push('the minimum size in millimetres: the document is measured in pixels');

  const rows = Array.isArray(boxes) ? boxes.filter(record) : [];
  const layers: Layer[] = [];
  rows.slice(0, MAX_ROWS).forEach((row, index) => {
    if (hidden(row)) return;
    const id = typeof row.id === 'string' ? row.id : '';
    const kind = typeof row.kind === 'string' && row.kind ? row.kind : 'box';
    const rect = boundsOf(row);
    if (!(rect.w > 0) || !(rect.h > 0)) return;
    const start = num(row.start, 0);
    const dur = num(row.dur, 0);
    layers.push({ row, id, index, z: num(row.z, index), rect, label: layerLabel(row, id), kind, image: imageId(row.image), start, end: dur > 0 ? start + dur : Number.POSITIVE_INFINITY });
  });
  if (rows.length > MAX_ROWS) notMeasured.push(`layers past the first ${MAX_ROWS.toLocaleString('en')}`);

  const marks = layers.filter(l => !NOT_ON_PAGE.has(l.kind) && l.image && logos.has(stripAssetModifiers(l.image)));
  const findings: BrandFinding[] = [];
  const add = (mark: Layer, rule: 'min-size' | 'clear-space' | 'treatment', part: string, message: string, extra: Partial<BrandFinding> = {}): void => {
    if (findings.length >= MAX_FINDINGS) return;
    findings.push({
      id: `brand.mark.${mark.id}.${rule}${part ? `.${part}` : ''}`,
      kind: 'mark', status: 'review', layerId: mark.id, label: mark.label, field: rule === 'clear-space' ? undefined : 'image',
      rule, message, company, ...extra,
    });
  };
  const beneath = (a: Layer, b: Layer): boolean => a.z < b.z || (a.z === b.z && a.index < b.index);

  for (const mark of marks) {
    const drawn = drawnRect(mark.row, mark.rect, measure.logoAspect?.(stripAssetModifiers(mark.image)));
    if (rules.minSize) {
      const min = rules.minSize;
      const px = exportPx(drawn.h);
      if (min.px !== undefined && px + 0.5 < min.px) {
        add(mark, 'min-size', 'px', `${company}'s mark is ${pxText(px)} px high; the kit asks for at least ${pxText(min.px)} px.`, { value: `${pxText(px)} px`, expected: `${pxText(min.px)} px` });
      }
      const mm = millimetres(drawn.h);
      if (physical && min.mm !== undefined && mm + 0.05 < min.mm) {
        add(mark, 'min-size', 'mm', `${company}'s mark is ${mmText(mm)} mm high; the kit asks for at least ${mmText(min.mm)} mm.`, { value: `${mmText(mm)} mm`, expected: `${mmText(min.mm)} mm` });
      }
    }
    if (rules.clearSpace) {
      const pad = rules.clearSpace.value * drawn.h;
      const band: Rect = { x: drawn.x - pad, y: drawn.y - pad, w: drawn.w + pad * 2, h: drawn.h + pad * 2 };
      const inside = layers.filter(l => l !== mark && !NOT_ON_PAGE.has(l.kind) && l.kind !== 'group' && together(l, mark) && overlaps(l.rect, band) && !holds(l.rect, drawn));
      if (inside.length) {
        const first = inside[0]!;
        const message = inside.length === 1
          ? `“${first.label}” sits inside ${company}'s clear space.`
          : `“${first.label}” and ${inside.length - 1} other ${inside.length === 2 ? 'layer sit' : 'layers sit'} inside ${company}'s clear space.`;
        add(mark, 'clear-space', '', message, { value: first.label, expected: `${rules.clearSpace.value} of the mark's height`, related: inside.map(l => l.id).filter(Boolean) });
      }
    }
    const allowed = rules.treatments;
    if (allowed?.length) {
      const recoloured = !!parseTreatedAssetId(mark.image).treatment || ((t) => !!t && t !== AUTO_ASSET_THEME)(parseThemedAssetId(mark.image).theme);
      const drawnAs: PartnerKitTreatmentV1 = recoloured ? 'mono' : 'colour';
      const rest = allowed.map(t => TREATMENT_WORDS[t]);
      if (!allowed.includes(drawnAs)) {
        add(mark, 'treatment', drawnAs, `${company}'s mark is drawn in ${TREATMENT_WORDS[drawnAs]}; the kit allows ${orList(rest)}.`, { value: drawnAs, expected: allowed.join(', ') });
      }
      // The nearest layer beneath that holds the whole mark is what the mark sits on.
      const ground = layers
        .filter(l => l !== mark && !NOT_ON_PAGE.has(l.kind) && l.kind !== 'group' && beneath(l, mark) && together(l, mark) && holds(l.rect, drawn))
        .sort((a, b) => (b.z - a.z) || (b.index - a.index))[0];
      const groundAsset = ground?.image && !logos.has(stripAssetModifiers(ground.image)) ? stripAssetModifiers(ground.image) : '';
      const onPicture = !!groundAsset && measure.pictureKind?.(groundAsset) !== 'vector';
      if (onPicture && !allowed.includes('on-photo')) {
        add(mark, 'treatment', 'on-photo', `${company}'s mark sits on a photo; the kit allows ${orList(rest)}.`, { value: 'on-photo', expected: allowed.join(', '), related: ground?.id ? [ground.id] : [] });
      }
    }
  }
  return { findings, checked: { marks: marks.length, rules: checkedRules }, notMeasured };
}
