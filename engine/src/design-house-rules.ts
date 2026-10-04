// SPDX-License-Identifier: MPL-2.0
/**
 * House rules for a Design document (plan 291 W1 and W3): brand rule records whose kind
 * is one of `DESIGN_HOUSE_RULE_KINDS`, checked layer by layer against the boxes a Design
 * document stores.
 *
 * The records are ordinary `BrandRuleV1` entries from the token document's
 * `$extensions["com.suse.lolly"].brandSystem`, so a brand states them once and the brief,
 * the Start Usage room and this checker all read the same list. They are deliberately not
 * `BRAND_RULE_KINDS` (`brand-rules.ts`): that evaluator answers for named example slots
 * and is shared with the console, while these read layer geometry and style.
 *
 * Absent fields take the Design renderer's own defaults, because that is what paints:
 * text weight 700, text alignment centre, stroke width 0. Paint order is array order, so
 * "the surface under a layer" is the topmost earlier layer of the same artboard that
 * covers most of it, then the artboard's own fill.
 *
 * A finding is a review item with the rule's `requirement`, never a verdict on its own:
 * which findings block is the caller's decision. A rule whose kind this build does not
 * know, or whose parameters it cannot read, is listed in `unknown` and never passes.
 *
 * Pure: no DOM, no storage, no network.
 */
import type { BrandRuleV1 } from '@lolly-tools/core/brand-system-v1';
import { aliasPath, createTokenSet } from './tokens.ts';
import { TOKEN_EXT } from './token-ext.ts';
import { parseColor, parseColorToSrgb8 } from './css-color.ts';
import { stripAssetModifiers } from './photo-treatment.ts';
import { AUTO_ASSET_THEME, parseThemedAssetId } from './icon-theme.ts';
import { buildSurfaceVariantTable, pickSurfaceVariant, surfaceColourResolver, surfaceUnderDesignLayer, type SurfaceVariantTableV1 } from './surface-variant.ts';
import { parseDesignText } from './design-text.ts';

/** The layer-level rule kinds this module checks. */
export const DESIGN_HOUSE_RULE_KINDS = [
  'text-weight', 'text-align', 'text-case', 'color-pairing', 'stroke-on-rounded', 'dash-reserved', 'logo-surface',
] as const;
export type DesignHouseRuleKind = (typeof DESIGN_HOUSE_RULE_KINDS)[number];

/** One layer that does not follow one house rule. */
export interface HouseRuleFinding {
  ruleId: string;
  kind: string;
  layerId: string;
  artboardId?: string;
  field?: string;
  value?: string;
  expected?: string;
  /** Plain English: the rule's own label, then what this layer does. */
  message: string;
  requirement: 'required' | 'advisory';
}

export interface DesignHouseRuleOpts {
  /** The token theme the document is composed in, for alias colours. */
  theme?: string;
  /** Catalog facts (`DesignBriefCatalogV1`): the logo set stands in when a logo rule names none. */
  catalog?: unknown;
  /**
   * The document's canvas background (Design's `background` input), which a document
   * with no frames paints under every layer. An alias reads in `theme`.
   */
  background?: unknown;
}

export interface DesignHouseRuleResult {
  findings: HouseRuleFinding[];
  /** How many rules were evaluated. */
  checked: number;
  /** Rule ids that were not evaluated: an unknown kind or parameters this build cannot read. */
  unknown: string[];
}

type Row = Record<string, unknown>;
const record = (v: unknown): v is Row => !!v && typeof v === 'object' && !Array.isArray(v);
const strings = (v: unknown): string[] => Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string' && s.length > 0) : [];
const num = (v: unknown, fallback: number): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
};
const valueText = (v: unknown): string => typeof v === 'string' ? v : record(v) && typeof v.ref === 'string' ? v.ref : '';
const isHidden = (row: Row): boolean => row.hidden === true || row.hidden === 'true';
const textOf = (row: Row): string => typeof row.text === 'string' ? row.text : '';

/** The roles a slide master gives headlines. A role-less text counts by its size. */
const HEADLINE_ROLES = ['title'];
/** A role-less text at or above this share of its artboard's height reads as a headline. */
const HEADLINE_SCALE = 0.05;
/** The headline size used when a text sits on no artboard. */
const HEADLINE_MIN_PX = 48;

const ROUNDED_SHAPES = ['rounded', 'pill', 'ellipse', 'circle'];
const DESIGN_DEFAULT_WEIGHT = '700';
const DESIGN_DEFAULT_ALIGN = 'center';

function hex8(input: string): string | null {
  const rgba = parseColorToSrgb8(input);
  if (!rgba || rgba[3] < 1) return null;
  return '#' + rgba.slice(0, 3).map((n) => n.toString(16).padStart(2, '0')).join('');
}

/** Glob with one trailing `*`, the only wildcard rule parameters use. */
const matches = (pattern: string, value: string): boolean =>
  pattern.endsWith('*') ? value.startsWith(pattern.slice(0, -1)) : pattern === value;

/**
 * Capitals throughout, judged over words rather than letters: an acronym, a product name
 * or a brand name in capitals ("Q&A", "SUSE", "SLES 16") is ordinary usage, so it takes at
 * least two all-capital words of three letters or more, and every word in capitals, before
 * a text counts as set in capitals. `exempt` words (a rule's `exemptWords`) are left out.
 */
function setInCapitals(text: string, exempt: ReadonlySet<string>): boolean {
  const words = (text.replace(/\{[^|{}]+\|/g, '').match(/\p{L}+/gu) ?? []).filter((w) => !exempt.has(w));
  const cased = words.filter((w) => w !== w.toLowerCase() || w !== w.toUpperCase());
  if (!cased.length || cased.some((w) => w !== w.toUpperCase())) return false;
  return cased.filter((w) => w.length >= 3).length >= 2;
}

/** A text made only of digits, signs and short units: a stat, a year, a step number. */
const NUMERIC_TEXT = /^[\s\d.,:;%+\-/#()x×]+$/i;

interface Layout {
  rows: Row[];
  frames: Map<string, Row>;
  /** Per artboard id ('' for none): the largest text size and how many texts share that size. */
  largest: Map<string, { size: number; count: number }>;
  tokens: ReturnType<typeof createTokenSet>;
}

function colourOf(layout: Layout, raw: string): string | null {
  if (!raw || raw === 'transparent' || raw === 'none') return null;
  const path = aliasPath(raw);
  if (path) {
    const resolved = layout.tokens.resolve(path);
    return typeof resolved === 'string' ? hex8(resolved) : null;
  }
  return hex8(raw);
}

const artboardOf = (row: Row): string | undefined =>
  typeof row.frame === 'string' && row.frame ? row.frame : row.kind === 'frame' && typeof row.id === 'string' ? row.id : undefined;

function covers(over: Row, row: Row): boolean {
  const [x, y, w, h] = [num(row.x, 0), num(row.y, 0), num(row.w, 0), num(row.h, 0)];
  const [ox, oy, ow, oh] = [num(over.x, 0), num(over.y, 0), num(over.w, 0), num(over.h, 0)];
  const iw = Math.min(x + w, ox + ow) - Math.max(x, ox);
  const ih = Math.min(y + h, oy + oh) - Math.max(y, oy);
  if (iw <= 0 || ih <= 0) return false;
  const area = Math.max(1, w * h);
  return (iw * ih) / area >= 0.9;
}

/** What paints under a layer: an opaque colour, a picture, or null when that cannot be told. */
type Surface = { kind: 'color'; hex: string } | { kind: 'image' };

function paintOf(layout: Layout, row: Row): Surface | null | 'clear' {
  if (row.kind === 'image' || valueText(row.image) || (record(row.image) && typeof row.image.id === 'string')) return { kind: 'image' };
  if (typeof row.grad === 'string' && row.grad.trim()) return null;
  const raw = valueText(row.bg);
  if (!raw || raw === 'transparent' || raw === 'none') return 'clear';
  const path = aliasPath(raw);
  const resolved = path ? layout.tokens.resolve(path) : raw;
  if (typeof resolved !== 'string') return null;
  const parsed = parseColor(resolved);
  if (!parsed) return null;
  if (parsed.alpha <= 0) return 'clear';
  if (parsed.alpha < 1 || num(row.opacity, 1) < 1) return null;
  const hex = hex8(resolved);
  return hex ? { kind: 'color', hex } : null;
}

function surfaceUnder(layout: Layout, index: number, own: boolean): Surface | null {
  const row = layout.rows[index]!;
  if (own && row.kind !== 'image') {
    const self = paintOf(layout, row);
    if (self !== 'clear') return self;
  }
  const board = artboardOf(row);
  for (let i = index - 1; i >= 0; i--) {
    const under = layout.rows[i]!;
    if (isHidden(under) || under.kind === 'frame' || under.kind === 'path' || artboardOf(under) !== board) continue;
    if (!covers(under, row)) continue;
    const paint = paintOf(layout, under);
    if (paint === 'clear') continue;
    return paint;
  }
  const frame = board && row.kind !== 'frame' ? layout.frames.get(board) : undefined;
  if (!frame) return null;
  const paint = paintOf(layout, frame);
  return paint === 'clear' ? null : paint;
}

/**
 * A headline is a title-role text. A text with no role counts when it is the one largest
 * text on its artboard and large for the artboard: a row of equal display lines is a list,
 * not a headline.
 */
function isHeadline(layout: Layout, row: Row): boolean {
  const role = typeof row.role === 'string' ? row.role : '';
  if (role) return HEADLINE_ROLES.includes(role);
  const board = artboardOf(row);
  const frame = board ? layout.frames.get(board) : undefined;
  const size = num(row.fontSize, 0);
  const frameH = frame ? num(frame.h, 0) : 0;
  if (frameH > 0 ? size < frameH * HEADLINE_SCALE : size < HEADLINE_MIN_PX) return false;
  const largest = layout.largest.get(board ?? '');
  return !!largest && largest.size === size && largest.count === 1;
}

/** Every weight a text paints: its own, any run that states one, and bold (`**`) runs as 700. */
function weightsOf(row: Row): { own: string; runs: string[]; bold: boolean } {
  const own = typeof row.weight === 'string' || typeof row.weight === 'number' ? String(row.weight) : DESIGN_DEFAULT_WEIGHT;
  const runs = new Set<string>();
  let bold = false;
  for (const line of parseDesignText(textOf(row))) {
    for (const run of line.runs) {
      if (!run.text.trim()) continue;
      if (typeof run.weight === 'number') runs.add(String(run.weight));
      else if (run.bold) { runs.add('700'); bold = true; }
    }
  }
  return { own, runs: [...runs], bold };
}

/** The colours a text paints: its own foreground and every attribute-run colour. */
function textColoursOf(layout: Layout, row: Row): Array<{ raw: string; hex: string }> {
  const out: Array<{ raw: string; hex: string }> = [];
  const own = valueText(row.fg);
  const ownHex = own ? colourOf(layout, own) : null;
  if (own && ownHex) out.push({ raw: own, hex: ownHex });
  for (const line of parseDesignText(textOf(row))) {
    for (const run of line.runs) {
      if (!run.color || !run.text.trim()) continue;
      const hex = colourOf(layout, run.color);
      if (hex && !out.some((c) => c.hex === hex)) out.push({ raw: run.color, hex });
    }
  }
  return out;
}

interface Pairings {
  /** Background hex to its named colour and approved lists. */
  byBackground: Map<string, { name: string; text: string[]; graphic: string[] }>;
  /** Hex to every colour in the policy's colour group with that value, by leaf name. */
  names: Map<string, string[]>;
}

/**
 * The combination policy a token document declares on its background colours:
 * `$extensions["com.suse.lolly"].combinations = { text, graphic }`, names relative to the
 * background token's own group.
 */
export function combinationPolicy(doc: unknown, theme?: string): Pairings {
  const tokens = createTokenSet(doc, { theme });
  const byBackground: Pairings['byBackground'] = new Map();
  const names: Pairings['names'] = new Map();
  const groups = new Set<string>();
  for (const entry of tokens.query({ type: 'color' })) {
    const vendor = entry.extensions?.[TOKEN_EXT];
    const combos = record(vendor) && record(vendor.combinations) ? vendor.combinations : null;
    if (!combos || typeof entry.value !== 'string') continue;
    const hex = hex8(entry.value);
    if (!hex) continue;
    const segs = entry.path.split('.');
    const name = segs.pop()!;
    groups.add(segs.join('.'));
    byBackground.set(hex, { name, text: strings(combos.text), graphic: strings(combos.graphic) });
  }
  for (const entry of tokens.query({ type: 'color' })) {
    const segs = entry.path.split('.');
    const name = segs.pop()!;
    if (!groups.has(segs.join('.')) || typeof entry.value !== 'string') continue;
    const hex = hex8(entry.value);
    if (!hex) continue;
    names.set(hex, [...(names.get(hex) ?? []), name]);
  }
  return { byBackground, names };
}

const label = (name: string): string => name.charAt(0).toUpperCase() + name.slice(1);
const list = (values: readonly string[]): string => values.join(', ');

/** Check boxes against the house rules among `rules`. Rules of other kinds are left alone. */
export function checkDesignHouseRules(boxes: unknown, rules: BrandRuleV1[], doc: unknown, opts: DesignHouseRuleOpts = {}): DesignHouseRuleResult {
  const findings: HouseRuleFinding[] = [];
  const unknown: string[] = [];
  let checked = 0;
  const rows = Array.isArray(boxes) ? boxes.filter(record) : [];
  const layout: Layout = {
    rows,
    frames: new Map(rows.filter((r) => r.kind === 'frame' && typeof r.id === 'string').map((r) => [r.id as string, r])),
    tokens: createTokenSet(doc, { theme: opts.theme }),
    largest: new Map(),
  };
  for (const row of rows) {
    if (isHidden(row) || !textOf(row).trim() || row.kind === 'image') continue;
    const key = artboardOf(row) ?? '';
    const size = num(row.fontSize, 0);
    const top = layout.largest.get(key);
    if (!top || size > top.size) layout.largest.set(key, { size, count: 1 });
    else if (size === top.size) top.count++;
  }
  let pairings: Pairings | null = null;
  const catalogLogos = record(opts.catalog) && record(opts.catalog.logos) ? opts.catalog.logos : {};
  const layers = rows.slice(0, 5000).map((row, index) => ({ row, index })).filter(({ row }) => !isHidden(row) && typeof row.id === 'string' && row.id);
  const texts = layers.filter(({ row }) => textOf(row).trim() && row.kind !== 'image');

  for (const rule of Array.isArray(rules) ? rules : []) {
    if (!record(rule) || typeof rule.id !== 'string') continue;
    if (rule.scope?.tools && !rule.scope.tools.includes('design')) continue;
    if (!(DESIGN_HOUSE_RULE_KINDS as readonly string[]).includes(rule.kind)) { unknown.push(rule.id); continue; }
    const p = record(rule.parameters) ? rule.parameters : {};
    const requirement = rule.requirement === 'required' ? 'required' : 'advisory';
    const add = (row: Row, field: string | undefined, value: string | undefined, expected: string | undefined, detail: string): void => {
      const artboardId = artboardOf(row);
      findings.push({
        ruleId: rule.id, kind: rule.kind, layerId: String(row.id),
        ...(artboardId && artboardId !== row.id ? { artboardId } : {}),
        ...(field ? { field } : {}), ...(value !== undefined ? { value } : {}), ...(expected !== undefined ? { expected } : {}),
        message: `${rule.label}. ${detail}`, requirement,
      });
    };
    const exemptRoles = strings(p.exemptRoles);
    const target = typeof p.target === 'string' ? p.target : 'text';
    const inTarget = (row: Row): boolean => {
      const role = typeof row.role === 'string' ? row.role : '';
      if (role && exemptRoles.includes(role)) return false;
      if (typeof row.furniture === 'string' && row.furniture) return false;
      const roles = strings(p.roles);
      if (roles.length) return roles.includes(role) || (target === 'headline' && !role && isHeadline(layout, row));
      if (target === 'headline') return isHeadline(layout, row);
      if (target === 'body') return !isHeadline(layout, row);
      return true;
    };

    if (rule.kind === 'text-weight') {
      const allowed = strings(p.weights).map(String);
      if (!allowed.length) { unknown.push(rule.id); continue; }
      checked++;
      for (const { row } of texts) {
        if (!inTarget(row)) continue;
        const weights = weightsOf(row);
        if (!allowed.includes(weights.own)) {
          add(row, 'weight', weights.own, list(allowed), `This text is set at weight ${weights.own}${row.weight === undefined ? ' (the Design default)' : ''}; allowed: ${list(allowed)}.`);
          continue;
        }
        const off = weights.runs.filter((w) => !allowed.includes(w));
        if (off.length) {
          add(row, 'text', off.join(', '), list(allowed), `${weights.bold ? 'Bold runs' : 'Runs'} in this text paint at weight ${list(off)}; allowed: ${list(allowed)}. State an allowed weight on the run instead, such as {w${allowed[allowed.length - 1]}|...}.`);
        }
      }
    } else if (rule.kind === 'text-case') {
      if (p.forbid !== 'upper') { unknown.push(rule.id); continue; }
      checked++;
      const exemptWords = new Set(strings(p.exemptWords));
      for (const { row } of texts) {
        if (!inTarget(row)) continue;
        if (setInCapitals(textOf(row), exemptWords)) add(row, 'text', undefined, undefined, 'This text is set in capitals.');
      }
    } else if (rule.kind === 'text-align') {
      const align = typeof p.align === 'string' ? p.align : '';
      if (!['left', 'center', 'right'].includes(align)) { unknown.push(rule.id); continue; }
      checked++;
      const exemptArchetypes = strings(p.exemptArchetypes);
      const exemptFurniture = strings(p.exemptFurniture);
      for (const { row } of texts) {
        if (!inTarget(row)) continue;
        const furniture = typeof row.furniture === 'string' ? row.furniture : '';
        if (furniture && exemptFurniture.some((f) => matches(f, furniture))) continue;
        const board = artboardOf(row);
        const archetype = typeof row.archetype === 'string' ? row.archetype
          : board && typeof layout.frames.get(board)?.archetype === 'string' ? String(layout.frames.get(board)!.archetype) : '';
        if (archetype && exemptArchetypes.some((a) => matches(a, archetype))) continue;
        if (p.exemptNumeric === true && NUMERIC_TEXT.test(textOf(row))) continue;
        const value = typeof row.align === 'string' && row.align ? row.align : DESIGN_DEFAULT_ALIGN;
        if (value !== align) add(row, 'align', value, align, `This text is ${value === 'center' ? 'centred' : `${value}-aligned`}; use ${align}.`);
      }
    } else if (rule.kind === 'color-pairing') {
      if (p.source !== undefined && p.source !== 'token-extension') { unknown.push(rule.id); continue; }
      pairings ??= combinationPolicy(doc, opts.theme);
      if (!pairings.byBackground.size) { unknown.push(rule.id); continue; }
      checked++;
      for (const { row, index } of texts) {
        const surface = surfaceUnder(layout, index, true);
        if (surface?.kind !== 'color') continue;
        const policy = pairings.byBackground.get(surface.hex);
        if (!policy) continue;
        for (const colour of textColoursOf(layout, row)) {
          if (colour.hex === surface.hex) continue;
          const fgNames = pairings.names.get(colour.hex);
          // Shades outside the named colours are outside the policy: no claim either way.
          if (!fgNames?.length) continue;
          if (fgNames.some((n) => policy.text.includes(n))) continue;
          const graphicOnly = fgNames.some((n) => policy.graphic.includes(n));
          const fg = label(fgNames[0]!);
          add(row, 'fg', colour.raw, list(policy.text),
            `${fg} text on ${label(policy.name)} is not an approved pairing${graphicOnly ? ' (approved for graphics only)' : ''}. Text colours approved on ${label(policy.name)}: ${list(policy.text.map(label))}.`);
        }
      }
    } else if (rule.kind === 'stroke-on-rounded') {
      checked++;
      const shapes = strings(p.shapes).length ? strings(p.shapes) : ROUNDED_SHAPES;
      const neutral = new Set(strings(p.neutral).map((v) => colourOf(layout, v)).filter((v): v is string => !!v));
      const stripMax = num(p.stripMax, 12);
      const rounded = (row: Row): boolean => {
        const shape = typeof row.shape === 'string' ? row.shape : '';
        if (!shapes.includes(shape)) return false;
        return shape !== 'rounded' || num(row.radius, 0) > 0;
      };
      const accent = (hex: string): boolean => {
        if (neutral.has(hex)) return false;
        const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
        return Math.max(r, g, b) - Math.min(r, g, b) >= 40;
      };
      for (const { row, index } of layers) {
        if (row.kind === 'path' || row.kind === 'frame' || !rounded(row)) continue;
        const stroke = colourOf(layout, valueText(row.stroke));
        if (stroke && num(row.strokeW, 0) > 0 && !neutral.has(stroke)) {
          add(row, 'stroke', valueText(row.stroke), neutral.size ? list(strings(p.neutral)) : undefined,
            `This rounded shape has a ${valueText(row.stroke)} border. Carry an accent with a tinted fill${neutral.size ? ', or use a neutral hairline' : ''}.`);
        }
        // A thin accent bar laid along one edge of the rounded shape reads as the same border.
        const [x, y, w, h] = [num(row.x, 0), num(row.y, 0), num(row.w, 0), num(row.h, 0)];
        for (let i = index + 1; i < layout.rows.length && i < 5000; i++) {
          const strip = layout.rows[i]!;
          if (isHidden(strip) || strip.kind === 'frame' || strip.kind === 'image' || textOf(strip).trim() || artboardOf(strip) !== artboardOf(row)) continue;
          const fill = colourOf(layout, valueText(strip.bg));
          if (!fill || !accent(fill) || num(strip.opacity, 1) <= 0) continue;
          const [sx, sy, sw, sh] = [num(strip.x, 0), num(strip.y, 0), num(strip.w, 0), num(strip.h, 0)];
          const tol = 2;
          const inside = sx >= x - tol && sy >= y - tol && sx + sw <= x + w + tol && sy + sh <= y + h + tol;
          if (!inside) continue;
          const horizontal = sh <= stripMax && sh < h / 4 && sw >= w / 2 && (Math.abs(sy - y) <= tol || Math.abs(sy + sh - (y + h)) <= tol);
          const vertical = sw <= stripMax && sw < w / 4 && sh >= h / 2 && (Math.abs(sx - x) <= tol || Math.abs(sx + sw - (x + w)) <= tol);
          if (horizontal || vertical) {
            add(strip, 'bg', valueText(strip.bg), undefined,
              `This accent strip runs along an edge of the rounded shape ${JSON.stringify(String(row.name || row.id))}. Carry an accent with a tinted fill instead.`);
          }
        }
      }
    } else if (rule.kind === 'dash-reserved') {
      checked++;
      const styles = strings(p.styles).length ? strings(p.styles) : ['dashed'];
      const meaning = typeof p.meaning === 'string' && p.meaning ? p.meaning.replace(/-/g, ' ') : 'one purpose';
      for (const { row } of layers) {
        if (row.kind === 'path') continue;
        const style = typeof row.strokeDash === 'string' && row.strokeDash ? row.strokeDash
          : typeof row.strokeDashArray === 'string' && row.strokeDashArray.trim() ? 'dashed' : '';
        if (!style || !styles.includes(style) || num(row.strokeW, 0) <= 0 || !colourOf(layout, valueText(row.stroke))) continue;
        add(row, 'strokeDash', style, 'solid', `A ${style} border is reserved for ${meaning}.`);
      }
    } else if (rule.kind === 'logo-surface') {
      const fromCatalog = (names: string[]): string[] => names.map((n) => catalogLogos[n]).filter((v): v is string => typeof v === 'string');
      const light = strings(p.light).length ? strings(p.light) : fromCatalog(['onLight', 'monoOnLight']);
      const dark = strings(p.dark).length ? strings(p.dark) : fromCatalog(['onDark', 'monoOnDark']);
      const photo = strings(p.photo).length ? strings(p.photo) : dark;
      const all = new Set([...light, ...dark, ...photo]);
      if (!all.size) { unknown.push(rule.id); continue; }
      checked++;
      // The surface is the one the runtime's surface-aware pick reads (plan 291 W4),
      // so a `?theme=auto` logo is judged on the mark it takes there.
      const readColour = surfaceColourResolver(layout.tokens);
      let table: SurfaceVariantTableV1 | null = null;
      for (const { row, index } of layers) {
        const raw = valueText(row.image) || (record(row.image) && typeof row.image.id === 'string' ? row.image.id : '');
        const resolved = aliasPath(raw) ? layout.tokens.resolve(aliasPath(raw)!) : raw;
        if (typeof resolved !== 'string') continue;
        let id = stripAssetModifiers(resolved);
        if (!all.has(id)) continue;
        const kind = surfaceUnderDesignLayer(layout.rows, index, opts.background !== undefined ? { background: opts.background } : {}, readColour);
        if (!kind) continue;
        if (parseThemedAssetId(resolved).theme === AUTO_ASSET_THEME) {
          table ??= buildSurfaceVariantTable({
            tokens: layout.tokens, rules: [rule],
            ...(record(opts.catalog) ? { iconThemes: opts.catalog.iconThemes } : {}),
            logos: catalogLogos as Record<string, string>,
          });
          const pick = pickSurfaceVariant(resolved, kind, table);
          if (pick) id = stripAssetModifiers(pick);
        }
        const allowed = kind === 'photo' ? photo : kind === 'dark' ? dark : light;
        if (allowed.length && !allowed.includes(id)) {
          add(row, 'image', id, list(allowed), `The logo ${id} sits on a ${kind === 'photo' ? 'photograph' : `${kind} surface`}; use ${list(allowed)}.`);
        }
      }
    }
  }
  return { findings, checked, unknown };
}

/** The house rules among a brand system's rules: the kinds this module checks. */
export function designHouseRules(rules: readonly BrandRuleV1[] | null | undefined): BrandRuleV1[] {
  return (rules ?? []).filter((r) => (DESIGN_HOUSE_RULE_KINDS as readonly string[]).includes(r.kind));
}
