// SPDX-License-Identifier: MPL-2.0
/** Portable authored text and settled layout contracts. Source offsets are UTF-16. */
export const TEXT_DOCUMENT_VERSION = 1 as const;
export type TextDirection = 'auto' | 'ltr' | 'rtl';
export type TextComposition = 'standard' | 'balanced' | 'best';
export interface TextRangeV1 { start: number; end: number }
export interface TextCharacterV1 {
  /** Resource id in TextDocumentV1.fonts. */
  font?: string;
  fallbackFonts?: string[];
  size?: number;
  weight?: number;
  italic?: boolean;
  color?: string;
  tracking?: number;
  baselineShift?: number;
  case?: 'none' | 'upper' | 'lower' | 'small-caps';
  underline?: boolean;
  strike?: boolean;
  features?: Record<string, number>;
  axes?: Record<string, number>;
}
export interface TextTabV1 {
  position: number;
  align: 'start' | 'center' | 'end' | 'decimal';
  leader?: string;
}
export interface TextParagraphStyleV1 {
  /** Cached scalar paragraph links; local edits preserve the reference for restoration. */
  tokenLinks?: string;
  character?: TextCharacterV1;
  direction?: TextDirection;
  language?: string;
  composition?: TextComposition;
  align?: 'start' | 'center' | 'end' | 'justify';
  lastAlign?: 'start' | 'center' | 'end' | 'justify';
  lineHeight?: number;
  spaceBefore?: number;
  spaceAfter?: number;
  indentStart?: number;
  indentEnd?: number;
  firstIndent?: number;
  wordSpacing?: { min: number; ideal: number; max: number };
  shortLastLine?: { enabled: boolean; words: number; fraction: number };
  keep?: { startLines: number; endLines: number; together: boolean; nextLines: number };
  hyphenation?: { mode: 'off' | 'manual' | 'auto'; minWord: number; minBefore: number; minAfter: number; consecutive: number };
  tabs?: TextTabV1[];
  baselineGrid?: boolean;
  opticalMargin?: boolean;
  dropCap?: { enabled?:boolean; characters: number; lines: number; gap: number };
  ruleBefore?: { enabled?: boolean; width: number; color: string; offset: number };
  ruleAfter?: { enabled?: boolean; width: number; color: string; offset: number };
}
export interface TextNamedStyleV1 {
  id: string;
  name: string;
  kind: 'character' | 'paragraph';
  basedOn?: string;
  next?: string;
  character?: TextCharacterV1;
  paragraph?: TextParagraphStyleV1;
}
export interface TextSpanV1 extends TextRangeV1 {
  style?: string;
  character?: TextCharacterV1;
  noBreak?: boolean;
  /** Literal/code content is excluded from optional typographic cleanup. */
  literal?: boolean;
}
export interface TextParagraphV1 extends TextRangeV1 {
  id: string;
  style?: string;
  paragraph?: TextParagraphStyleV1;
}
/** Every source line separator has one record. No implicit source normalization. */
export interface TextBreakV1 { start: number; length: 1 | 2; kind: 'paragraph' | 'soft' }
export interface TextInlineV1 {
  id: string;
  /** Points at exactly one U+FFFC source unit. */
  offset: number;
  label: string;
  originalText: string;
  emojiSources?: import('./emoji-v1.ts').EmojiSourceRecordV1[];
  /** Frozen glyph overhangs may extend beyond their unchanged logical advance. */
  overflow?: 'visible';
  svg: string;
  width: number;
  ascent: number;
  descent: number;
  credits?: Array<{ name: string; url?: string; license?: string }>;
}
export interface TextStoryV1 {
  version: 1;
  id: string;
  revision: number;
  source: string;
  paragraphs: TextParagraphV1[];
  breaks: TextBreakV1[];
  spans: TextSpanV1[];
  inlines: TextInlineV1[];
  frameIds: string[];
  defaultStyle?: string;
}
export interface TextFontResourceV1 {
  id: string;
  family: string;
  sha256: string;
  faceIndex: number;
  source: { kind: 'asset'; id: string } | { kind: 'bundled'; path: string } | { kind: 'embedded'; base64: string };
}
export interface TextDocumentV1 {
  version: 1;
  stories: TextStoryV1[];
  styles: TextNamedStyleV1[];
  fonts: TextFontResourceV1[];
}
export interface TextFrameV1 {
  id: string;
  storyId: string;
  width: number;
  height: number;
  mode: 'auto-width' | 'auto-height' | 'fixed' | 'path';
  inset: { top: number; right: number; bottom: number; left: number };
  columns: { count: number; gutter: number; balance: boolean };
  verticalAlign: 'top' | 'center' | 'bottom';
  firstBaseline?: number;
  grid?: { step: number; offset: number };
  honorWrap?: boolean;
  hidden?: boolean;
  locked?: boolean;
  shrink?: { minSize: number };
  path?: { d: string; start: number; end: number; baseline: number; flip: boolean; reverse: boolean; fit: boolean; guide: boolean };
}
/** Source identity and exact instance determine shaping; a URL alone is not a pin. */
export interface TextFontV1 {
  id: string;
  faceIndex: number;
  sha256: string;
  family: string;
  axes: Record<string, number>;
  features: Record<string, number>;
}
export interface TextShapedClusterV1 extends TextRangeV1 {
  x: number;
  advance: number;
  d: string;
  /** Legal grapheme carets, including endpoints. Positions are local to the run. */
  carets: Array<{ offset: number; x: number }>;
}
export interface TextShapedRunV1 extends TextRangeV1 {
  text: string;
  direction: 'ltr' | 'rtl';
  script: string;
  language: string;
  font: TextFontV1;
  size: number;
  advance: number;
  ascent: number;
  descent: number;
  lineGap: number;
  clusters: TextShapedClusterV1[];
  missing: TextRangeV1[];
}
export interface TextDiagnosticV1 extends TextRangeV1 {
  code: string;
  severity: 'error' | 'warning' | 'info';
  storyId: string;
  frameId?: string;
  message: string;
}
export interface TextCaretV1 {
  offset: number;
  affinity: 'upstream' | 'downstream';
  x: number;
  y: number;
  height: number;
  angle: number;
}
export interface TextLayoutLineV1 extends TextRangeV1 {
  /** Resolved source occupied by a drop capital, including inherited styles. */
  dropCap?: TextRangeV1;
  paragraphId: string;
  frameId: string;
  /** Positions and carets follow an authored curved baseline. */
  path?: boolean;
  column: number;
  x: number;
  y: number;
  baseline: number;
  width: number;
  height: number;
  direction: 'ltr' | 'rtl';
  carets: TextCaretV1[];
  runs: Array<{ x: number; y: number; angle: number; color: string; character: TextCharacterV1; shape: TextShapedRunV1 }>;
  inlines: Array<{ offset: number; x: number; y: number; advance: number; width: number; height: number; angle: number; svg: string; overflow?: 'visible'; ascent?: number; baselineShift?: number; direction?: 'ltr' | 'rtl' }>;
  leaders?: Array<{ x:number; y:number; shape:TextShapedRunV1; count:number; step:number; color:string }>;
  rules?: Array<{ x:number; y:number; width:number; height:number; color:string }>;
  /** Authored text ends at end. A visible hyphen is layout output only. */
  hyphen?: { x: number; y: number; shape: TextShapedRunV1; color?: string };
}
export interface TextLayoutV1 {
  version: 1;
  algorithm: string;
  shaper: string;
  unicode: string;
  resources: Array<{ id: string; sha256: string }>;
  storyId: string;
  revision: number;
  /** Hash of admitted authored data, used to refuse stale destructive commands. */
  documentHash?: string;
  lines: TextLayoutLineV1[];
  frames: Array<TextRangeV1 & { id: string; width: number; height: number; columnEnds: number[]; geometryKey?: string; clip?: boolean; svg?: string; appliedScale?: number; guide?: string }>;
  overset: TextRangeV1 | null;
  diagnostics: TextDiagnosticV1[];
  emojiSources?: import('./emoji-v1.ts').EmojiSourceRecordV1[];
}

export interface TextFontInfoV1 {
  resource: TextFontResourceV1;
  shaper: string;
  unitsPerEm: number;
  axes: Record<string, { min: number; default: number; max: number; name: string }>;
  features: string[];
  instances?: Array<{ name: string; axes: Record<string, number> }>;
  /** Inclusive Unicode code point ranges from this face's cmap. */
  coverage: Array<[number, number]>;
}
export interface TextShapeRunRequestV1 {
  /** False returns metrics and source clusters without constructing outline paths. */
  outline?: boolean;
  font: TextFontResourceV1;
  text: string;
  start: number;
  direction: 'ltr' | 'rtl';
  script: string;
  language: string;
  size: number;
  tracking?: number;
  axes?: Record<string, number>;
  features?: Record<string, number>;
  /** Adjacent text on this settled line preserves joining across styled runs. */
  context?: { before: string; after: string };
}

export interface TextLayoutServicesV1 {
  fontInfo(font: TextFontResourceV1): Promise<TextFontInfoV1>;
  shapeRun(request: TextShapeRunRequestV1): Promise<TextShapedRunV1>;
}
/** Admitted artwork prepared by the shell from the document's pinned emoji choice. */
export interface TextArtworkV1 extends TextRangeV1 {
  svg: string;
  /** Logical advance; the ink may occupy a different width. */
  width: number;
  inkWidth?: number;
  whitespace?: boolean;
  overflow?: 'visible';
  ascent: number;
  descent: number;
  id: string;
  sha256: string;
}
export interface TextLayoutRequestV1 {
  document: TextDocumentV1;
  storyId: string;
  frames: TextFrameV1[];
  artwork?: TextArtworkV1[];
  wrap?:TextWrapContextV1;
  /** Include admitted vector markup for each settled frame. */
  includeSvg?: boolean;
}

/** World-space placement; scope names an artboard, independently of paint order. */
export interface TextWrapPlacementV1 { id:string;scope:string;x:number;y:number;width:number;height:number;rotation:number;flipX?:boolean;flipY?:boolean }
export interface TextWrapObjectV1 extends TextWrapPlacementV1 {
  mode:'box'|'contour';
  offset:{top:number;right:number;bottom:number;left:number};
  geometry:{kind:'rect'|'ellipse'|'path';radius?:number;path?:string};
}
export interface TextWrapContextV1 { placements:TextWrapPlacementV1[];objects:TextWrapObjectV1[] }
