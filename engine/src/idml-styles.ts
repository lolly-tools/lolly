// SPDX-License-Identifier: MPL-2.0
/**
 * IDML named styles: collect the style elements of Styles.xml, follow `BasedOn` chains with a
 * depth and cycle bound, and read typed text and object properties from the merged result.
 *
 * A property is either an attribute of the style element or a child of its `Properties`
 * element, and InDesign writes both. Only the keys this reader maps are kept, so a hostile
 * package cannot make the book larger than the style count times the key list.
 */

export type StyleKind = 'paragraph' | 'character' | 'object' | 'cell';
export type StyleProps = Readonly<Record<string, string>>;

export const MAX_STYLES = 20000;
const MAX_CHAIN = 32;
const EMPTY: StyleProps = Object.freeze({});

const TEXT_KEYS = [
  'AppliedFont', 'FontStyle', 'PointSize', 'Tracking', 'Leading', 'AutoLeading', 'FillColor', 'FillTint',
  'Justification', 'SpaceBefore', 'SpaceAfter', 'LeftIndent', 'RightIndent', 'FirstLineIndent',
  'Underline', 'StrikeThru', 'Capitalization', 'Position', 'BulletsAndNumberingListType',
  'BulletChar', 'HorizontalScale', 'Skew',
];
const OBJECT_KEYS = [
  'FillColor', 'FillTint', 'StrokeColor', 'StrokeTint', 'StrokeWeight', 'StrokeAlignment', 'StrokeType',
  'CornerOption', 'CornerRadius', 'TopLeftCornerOption', 'TopRightCornerOption', 'BottomLeftCornerOption', 'BottomRightCornerOption',
  'TopLeftCornerRadius', 'TopRightCornerRadius', 'BottomLeftCornerRadius', 'BottomRightCornerRadius',
  'Opacity', 'BlendMode', 'TextWrapMode', 'InsetSpacing', 'VerticalJustification', 'TextColumnCount',
];
const CELL_KEYS = [
  'FillColor', 'FillTint', 'TopInset', 'LeftInset', 'BottomInset', 'RightInset',
  'TopEdgeStrokeWeight', 'LeftEdgeStrokeWeight', 'BottomEdgeStrokeWeight', 'RightEdgeStrokeWeight',
  'TopEdgeStrokeColor', 'LeftEdgeStrokeColor', 'BottomEdgeStrokeColor', 'RightEdgeStrokeColor',
  'TopEdgeStrokeTint', 'LeftEdgeStrokeTint', 'BottomEdgeStrokeTint', 'RightEdgeStrokeTint',
];
const KEYS: Record<StyleKind, ReadonlySet<string>> = {
  paragraph: new Set([...TEXT_KEYS, 'BasedOn']),
  character: new Set([...TEXT_KEYS, 'BasedOn']),
  object: new Set([...OBJECT_KEYS, 'BasedOn']),
  cell: new Set([...CELL_KEYS, 'BasedOn']),
};
const ELEMENT: Record<string, StyleKind> = { ParagraphStyle: 'paragraph', CharacterStyle: 'character', ObjectStyle: 'object', CellStyle: 'cell' };

function directChild(el: Element, localName: string): Element | null {
  for (const c of Array.from(el.children)) if (c.localName === localName) return c;
  return null;
}

/**
 * Read the mapped properties an element states itself, from attributes and from its `Properties`
 * child. A child with element children (a tab list, a record) is not a scalar and is skipped,
 * except the bullet character, which is a record whose value is read.
 */
export function ownProps(el: Element, kind: StyleKind): Record<string, string> {
  const keys = KEYS[kind], out: Record<string, string> = Object.create(null);
  for (const key of keys) {
    if (key === 'BasedOn') continue;
    const v = el.getAttribute(key);
    if (v !== null) out[key] = v;
  }
  const props = directChild(el, 'Properties');
  if (props) for (const child of Array.from(props.children)) {
    const key = child.localName;
    if (!keys.has(key)) continue;
    if (key === 'BulletChar') { const value = child.getAttribute('BulletCharacterValue'); if (value) out[key] = value; continue; }
    if (key === 'InsetSpacing') {
      const items = Array.from(child.children).map(c => (c.textContent || '').trim());
      if (items.length === 4) out[key] = items.join(' ');
      continue;
    }
    if (child.children.length) continue;
    out[key] = (child.textContent || '').trim();
  }
  return out;
}

/** The ObjectStyle elements also state transparency and text wrap as child elements, not scalars. */
function objectChildProps(el: Element, into: Record<string, string>): void {
  for (const holder of ['TransparencySetting', 'FillTransparencySetting']) {
    const t = directChild(el, holder), blending = t && directChild(t, 'BlendingSetting');
    const opacity = blending?.getAttribute('Opacity');
    if (opacity && holder === 'TransparencySetting') into.Opacity = opacity;
    const mode = blending?.getAttribute('BlendMode');
    if (mode && holder === 'TransparencySetting') into.BlendMode = mode;
  }
  const wrap = directChild(el, 'TextWrapPreference');
  const mode = wrap?.getAttribute('TextWrapMode');
  if (mode) into.TextWrapMode = mode;
  const text = directChild(el, 'TextFramePreference');
  if (text) {
    for (const key of ['VerticalJustification', 'TextColumnCount']) { const v = text.getAttribute(key); if (v !== null) into[key] = v; }
    const inset = directChild(text, 'Properties'), spacing = inset && directChild(inset, 'InsetSpacing');
    if (spacing) { const items = Array.from(spacing.children).map(c => (c.textContent || '').trim()); if (items.length === 4) into.InsetSpacing = items.join(' '); }
    else { const v = text.getAttribute('InsetSpacing'); if (v) into.InsetSpacing = v; }
  }
}

/** Child-element properties of an item (not a style): transparency, wrap and frame preferences. */
export function itemChildProps(el: Element): Record<string, string> {
  const out: Record<string, string> = Object.create(null);
  objectChildProps(el, out);
  return out;
}

/** The name of the style a `BasedOn` value points at, without the `$ID/` built-in marker. */
function basedOnRef(value: string | undefined): string {
  return value ? value.trim() : '';
}

export class StyleBook {
  private readonly own: Record<StyleKind, Map<string, Record<string, string>>> = {
    paragraph: new Map(), character: new Map(), object: new Map(), cell: new Map(),
  };
  private readonly basedOn: Record<StyleKind, Map<string, string>> = {
    paragraph: new Map(), character: new Map(), object: new Map(), cell: new Map(),
  };
  private readonly cache: Record<StyleKind, Map<string, StyleProps>> = {
    paragraph: new Map(), character: new Map(), object: new Map(), cell: new Map(),
  };
  /** Styles read, so a report can say how many named styles the package carried. */
  count = 0;
  /** Chains that were cut short by a cycle or the depth bound. */
  truncated = 0;

  constructor(doc: Document | null) {
    if (!doc) return;
    for (const el of Array.from(doc.getElementsByTagName('*'))) {
      const kind = ELEMENT[el.localName];
      const self = kind && el.getAttribute('Self');
      if (!kind || !self) continue;
      if (++this.count > MAX_STYLES) throw new Error('IDML contains more than 20000 named styles.');
      const own = ownProps(el, kind);
      if (kind === 'object') objectChildProps(el, own);
      this.own[kind].set(self, own);
      const props = directChild(el, 'Properties'), based = props && directChild(props, 'BasedOn');
      const ref = basedOnRef(based?.textContent || undefined);
      if (ref && ref !== self) this.basedOn[kind].set(self, ref);
    }
  }

  has(kind: StyleKind, id: string | null | undefined): boolean { return !!id && this.own[kind].has(id); }

  /** The style's properties with its `BasedOn` ancestors underneath, nearest ancestor winning. */
  resolve(kind: StyleKind, id: string | null | undefined): StyleProps {
    if (!id) return EMPTY;
    const hit = this.cache[kind].get(id);
    if (hit) return hit;
    const chain: Record<string, string>[] = [], seen = new Set<string>();
    for (let at: string | undefined = id; at && !seen.has(at); at = this.basedOn[kind].get(at)) {
      if (chain.length >= MAX_CHAIN) { this.truncated++; break; }
      seen.add(at);
      const own = this.own[kind].get(at);
      if (own) chain.push(own);
    }
    if (chain.length && this.basedOn[kind].has([...seen].at(-1)!) && seen.has(this.basedOn[kind].get([...seen].at(-1)!)!)) this.truncated++;
    const merged: Record<string, string> = Object.create(null);
    for (let i = chain.length - 1; i >= 0; i--) Object.assign(merged, chain[i]);
    this.cache[kind].set(id, merged);
    return merged;
  }
}

// ── typed readers ───────────────────────────────────────────────────────────

function finite(v: string | undefined, min: number, max: number): number | undefined {
  if (v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : undefined;
}

export interface TextAttrs {
  font?: string; fontStyle?: string; size?: number;
  /** Thousandths of an em. */
  tracking?: number;
  /** Absolute leading in points; undefined when the leading is automatic. */
  leading?: number;
  /** Automatic leading as a percentage of the size. */
  autoLeading?: number;
  fill?: string; fillTint?: number;
  justification?: string;
  spaceBefore?: number; spaceAfter?: number; leftIndent?: number; rightIndent?: number; firstIndent?: number;
  underline?: boolean; strike?: boolean;
  capitalization?: string; position?: string;
  bullet?: 'bullet' | 'number' | 'none';
  bulletChar?: string;
  /** Characters the source states that Design cannot draw: horizontal scale and skew. */
  distorted?: boolean;
}

/** Typed text attributes from a merged property bag; later bags override earlier ones. */
export function textAttrs(...bags: StyleProps[]): TextAttrs {
  const p: Record<string, string> = {};
  for (const bag of bags) Object.assign(p, bag);
  const out: TextAttrs = {};
  if (p.AppliedFont) out.font = p.AppliedFont;
  if (p.FontStyle) out.fontStyle = p.FontStyle;
  const size = finite(p.PointSize, 1, 2000); if (size !== undefined) out.size = size;
  const tracking = finite(p.Tracking, -1000, 10000); if (tracking !== undefined) out.tracking = tracking;
  if (p.Leading !== undefined && p.Leading !== '') {
    const lead = p.Leading.toLowerCase() === 'auto' ? undefined : finite(p.Leading, 0, 4000);
    if (lead !== undefined && lead > 0) out.leading = lead;
  }
  const auto = finite(p.AutoLeading, 1, 1000); if (auto !== undefined) out.autoLeading = auto;
  if (p.FillColor) out.fill = p.FillColor;
  const tint = finite(p.FillTint, -1, 100); if (tint !== undefined && tint >= 0) out.fillTint = tint;
  if (p.Justification) out.justification = p.Justification;
  const before = finite(p.SpaceBefore, 0, 4000); if (before !== undefined) out.spaceBefore = before;
  const after = finite(p.SpaceAfter, 0, 4000); if (after !== undefined) out.spaceAfter = after;
  const left = finite(p.LeftIndent, -4000, 4000); if (left !== undefined) out.leftIndent = left;
  const right = finite(p.RightIndent, -4000, 4000); if (right !== undefined) out.rightIndent = right;
  const first = finite(p.FirstLineIndent, -4000, 4000); if (first !== undefined) out.firstIndent = first;
  if (p.Underline !== undefined) out.underline = p.Underline === 'true';
  if (p.StrikeThru !== undefined) out.strike = p.StrikeThru === 'true';
  if (p.Capitalization) out.capitalization = p.Capitalization;
  if (p.Position) out.position = p.Position;
  if (p.BulletsAndNumberingListType) out.bullet = /^Bullet/i.test(p.BulletsAndNumberingListType) ? 'bullet' : /^Numbered/i.test(p.BulletsAndNumberingListType) ? 'number' : 'none';
  if (p.BulletChar) { const code = Number(p.BulletChar); if (Number.isInteger(code) && code > 31 && code < 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)) out.bulletChar = String.fromCodePoint(code); }
  const scale = finite(p.HorizontalScale, 1, 1000), skew = finite(p.Skew, -180, 180);
  if ((scale !== undefined && Math.abs(scale - 100) > 0.5) || (skew !== undefined && Math.abs(skew) > 0.5)) out.distorted = true;
  return out;
}

/** Apply a tint (percent of the ink) to a `#rrggbb` colour, mixing towards white. */
export function tintHex(hex: string, tint: number | undefined): string {
  if (tint === undefined || tint >= 100 || !/^#[0-9a-f]{6}$/i.test(hex)) return hex;
  const t = Math.max(0, tint) / 100, channel = (i: number) => Math.round(255 - (255 - parseInt(hex.slice(i, i + 2), 16)) * t);
  return '#' + [1, 3, 5].map(i => channel(i).toString(16).padStart(2, '0')).join('');
}

export function numericAttr(v: string | null | undefined, min: number, max: number): number | undefined {
  return finite(v ?? undefined, min, max);
}

// ── per-feature accounting ───────────────────────────────────────────────────

export type Fate = 'mapped' | 'approximated' | 'dropped';
export type IdmlStats = Record<string, { mapped: number; approximated: number; dropped: number }>;

/** Count `n` things of one feature as mapped, approximated or dropped. */
export function tally(stats: IdmlStats | undefined, feature: string, fate: Fate, n = 1): void {
  if (!stats || n <= 0) return;
  stats[feature] ??= { mapped: 0, approximated: 0, dropped: 0 };
  stats[feature][fate] += n;
}

/** What the import report says for each feature that was approximated or dropped. */
const REPORT: Record<string, { approximated?: string; dropped?: string }> = {
  'text.mixed-type': { approximated: 'Text frames that mix sizes or fonts are set in their most common size and font.' },
  'text.justified': { approximated: 'Justified paragraphs are set left aligned.' },
  'text.paragraph-spacing': { dropped: 'Space before and after paragraphs is not carried; Design text has no paragraph spacing.' },
  'text.indents': { dropped: 'Paragraph indents are not carried.' },
  'text.letter-case-position': { dropped: 'All caps, small caps, superscript and subscript runs are set as typed.' },
  'text.distortion': { dropped: 'Horizontal scale and skew on text are not carried.' },
  'text.anchored-objects': { dropped: 'Objects anchored inside text and footnotes are not carried.' },
  'style.unresolved': { dropped: 'Some styles named in the text were not found, so their formatting is not applied.' },
  'style.chain-cut': { approximated: 'Some style chains were cut short at 32 levels or at a loop.' },
  'master.items': { approximated: 'Master items are placed on each page by position; overridden items use the page copy.' },
  'master.nested': { dropped: 'Masters based on other masters beyond 8 levels are not placed.' },
  'text.threaded': { approximated: 'Text threaded across several frames is placed in the first frame only.' },
  'table.skipped': { dropped: 'Tables or cells beyond the size limits, or with unreadable positions, are not carried.' },
  'table.border-colours': { approximated: 'Cells with borders in several colours use one border colour.' },
  'table.layout': { approximated: 'Tables become grouped frames placed at the top of their text frame, below the text before them.' },
  'table.styles': { dropped: 'Table style regions (header and banded fills) are not carried; cell fills and borders are.' },
  'table.spans': { approximated: 'Merged cells keep their combined size but not their inner borders.' },
  'wrap.text': { dropped: 'Text wrap around objects is not carried; Design text does not flow around other boxes.' },
  'object.gradient': { approximated: 'Gradient fills are set to the first colour of the gradient.' },
  'object.corner': { approximated: 'Corner shapes other than rounded are set rounded; unequal corners use the largest radius.' },
  'object.stroke-type': { approximated: 'Stroke types other than solid, dashed and dotted are drawn solid.' },
  'object.line': { approximated: 'Diagonal lines become thin rotated frames with an outline.' },
  'object.inset': { approximated: 'Text frames with unequal insets use their average inset.' },
  'object.vertical-justify': { dropped: 'Vertical alignment of text in a frame is not carried.' },
  'object.effects': { dropped: 'Drop shadows, feathering and other effects are not carried.' },
};

/** One report line per feature that lost something, with the count where it helps. */
export function statsNotes(stats: IdmlStats): string[] {
  const notes: string[] = [];
  for (const [feature, row] of Object.entries(stats)) {
    const say = REPORT[feature];
    if (!say) continue;
    if (row.dropped && say.dropped) notes.push(`${say.dropped} (${row.dropped})`);
    if (row.approximated && say.approximated) notes.push(`${say.approximated} (${row.approximated})`);
  }
  return notes;
}
