// SPDX-License-Identifier: MPL-2.0
/**
 * `lolly_measure_text` (plan 291 W5): where a plain Design text layer's lines break
 * and how tall it is, before anything is drawn, as a `TextMeasureV1`
 * (schemas/text-measure-v1.schema.json). The same measure `lolly measure --text` runs
 * (`measureTextNode`, @lolly-tools/node-shell/text-measure): HarfBuzz advances from
 * the faces the canvas loads, CSS pre-wrap greedy breaking, and Chromium's line box and
 * `scrollHeight`, so a clipped verdict here is the mounted audit's verdict.
 *
 * Two shapes of call. A text box: `text` and `width`, with any of the row fields the
 * layout reads (`font`, `weight`, `fontSize`, `lineHeight`, `pad`, `tracking`,
 * `height`, `valign`, `italic`) or a `style` id, which sets the box up as an authored
 * row with that style. A document: `document` (a boxes array, `{boxes}` or Design
 * input values) with optional `layerIds`, which measures every plain text layer and
 * returns `{ layers, skipped }`.
 *
 * Faces follow this server's content profile (its `font.*` tokens), else the platform
 * faces. Nothing is drawn and no browser runs, so the tool works on a hosted server.
 * Errors carry a stable code (`MEASURE_TEXT_TOOL_CODES`); the call never throws.
 */
import type { TextMeasureSpecV1, TextMeasureV1 } from '@lolly-tools/core';
// Imported, not read from disk: the bundled Vercel function carries no schemas/ directory.
import measureSchema from '../../../schemas/text-measure-v1.schema.json' with { type: 'json' };
import {
  BOOL,
  INT,
  STR,
  STRUCTURED_LIMITS,
  ToolCodeError,
  contractPart,
  errorOut,
  failure,
  obj,
  plural,
  success,
  type Env,
  type Schema,
  type StructuredCtx,
  type StructuredLimitsV1,
  type StructuredResult,
} from './structured.ts';

/** Every code a `lolly_measure_text` error carries. */
export type MeasureTextToolCodeV1 = 'request.invalid' | 'font.unavailable' | 'output.too-large' | 'internal';

const CODES: Record<MeasureTextToolCodeV1, true> = {
  'request.invalid': true,
  'font.unavailable': true,
  'output.too-large': true,
  internal: true,
};
export const MEASURE_TEXT_TOOL_CODES = Object.keys(CODES) as MeasureTextToolCodeV1[];

/** Text layers one document call measures, so one call stays inside a hosted function's time. */
export const MEASURE_TEXT_MAX_LAYERS = 2000;
/**
 * Text units (UTF-16) one document call measures, summed over its layers: four times
 * the longest single text. Counted before anything is measured, so a call over it is
 * refused at once rather than running past a hosted function's time.
 */
export const MEASURE_TEXT_MAX_UNITS = 262144;
/** The artboard width a `style` is sized for when the call names none, px. */
export const MEASURE_TEXT_DEFAULT_ARTBOARD_WIDTH = 1920;

const measure = contractPart(measureSchema as Schema);

const LAYERS_OUT = obj({
  layers: { type: 'array', items: obj({ layerId: STR, index: INT, measure: { $ref: '#/$defs/textMeasure' } }) },
  skipped: { type: 'array', items: obj({ layerId: STR, index: INT, reason: STR }) },
});

/** The structured result: one measure, the measures of a document's layers, or an error. */
export const MEASURE_TEXT_OUTPUT_SCHEMA: Schema = {
  type: 'object',
  $defs: { ...measure.defs, textMeasure: measure.root },
  oneOf: [{ $ref: '#/$defs/textMeasure' }, LAYERS_OUT, errorOut(MEASURE_TEXT_TOOL_CODES)],
};

const NUM = { type: ['number', 'string'] } as const;

const ARGS: Record<string, Schema> = {
  text: { type: 'string', description: "The text, in Design's subset: **bold**, *italic*, {w600|...}, {mono|...}, lines starting - or 1. are lists, \\n is a new line." },
  width: { ...NUM, description: 'The text box width, px.' },
  height: { ...NUM, description: 'The text box height, px. Given, the result says whether the box clips the text.' },
  font: { type: 'string', description: 'sans (default), display, mono, or a family name.' },
  weight: { ...NUM, description: 'CSS weight, 100 to 900. Default 700.' },
  fontSize: { ...NUM, description: 'px. Default 48.' },
  lineHeight: { ...NUM, description: 'Unitless. Default 1.12.' },
  pad: { ...NUM, description: 'Inner padding on every side, px. Default 8.' },
  tracking: { ...NUM, description: 'Letter spacing, px. Default 0.' },
  valign: { type: 'string', enum: ['top', 'middle', 'bottom'], description: 'Default middle.' },
  italic: { ...BOOL, description: 'Set every run in emphasis, as an italic style writes *...*: the italic face, the list marker upright.' },
  style: { type: 'string', description: 'A text style id (title, subtitle, body, caption, label, quote, number, attribution): the box as an authored row with that style (padding 0, top, left), the other arguments over it. A style\'s size scales with the artboard width.' },
  artboardWidth: { ...NUM, description: 'With style: the width of the artboard the box sits on, px, which the style\'s size scales with. Default 1920.' },
  theme: { type: 'string', description: 'The token theme the style takes its colours from.' },
  document: { description: 'A Design document: a boxes array, {boxes}, or Design input values. Measures every plain text layer instead of one box.' },
  layerIds: { type: 'array', items: { type: 'string' }, description: 'With document: measure only these text layers.' },
};

const DOCUMENT_ONLY = new Set(['document', 'layerIds', 'theme']);

export const MEASURE_TEXT_TOOL_DEF = {
  name: 'lolly_measure_text',
  description:
    'Measure a plain Design text layer before drawing it: the line breaks with each line\'s width and a nearEdge flag, the line box, ' +
    'height and the scrollHeight the canvas reports, and with a height whether the box clips the text (the mounted audit\'s rule). ' +
    'Pass text and width (plus any row fields, or a style id), or a document to measure every plain text layer. ' +
    'HarfBuzz with the faces the canvas loads and a CSS pre-wrap breaker; the same measure as `lolly measure --text --json`. ' +
    'Widen a box a few px where a line is nearEdge rather than trust a sub-pixel fit.',
  inputSchema: { type: 'object', properties: ARGS, additionalProperties: false },
  outputSchema: MEASURE_TEXT_OUTPUT_SCHEMA,
};

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

function numberArg(args: Record<string, unknown>, key: string, opts: { positive?: boolean; min?: number } = {}): number | undefined {
  const raw = args[key];
  if (raw === undefined || raw === null) return undefined;
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() ? Number(raw) : NaN;
  if (!Number.isFinite(n) || (opts.positive && n <= 0) || (opts.min !== undefined && n < opts.min))
    throw new ToolCodeError<MeasureTextToolCodeV1>('request.invalid', `${key} must be ${opts.positive ? 'a positive number' : opts.min !== undefined ? `a number of at least ${opts.min}` : 'a number'}.`);
  return n;
}

/** This server's design brief, for its faces and text styles; null with no tokens asset. */
async function profileBrief(theme: string | undefined): Promise<unknown | null> {
  try {
    const { readProfileBriefCatalog, readProfileTokenDocument } = await import('@lolly-tools/node-shell/design-brief');
    const tokens = readProfileTokenDocument();
    if (!tokens) return null;
    const { designBrief } = await import('@lolly/engine');
    return designBrief(tokens.doc, readProfileBriefCatalog(), theme ? { theme } : {});
  } catch (err) {
    if (theme && err instanceof Error && /theme/i.test(err.message)) throw new ToolCodeError<MeasureTextToolCodeV1>('request.invalid', err.message);
    return null;
  }
}

function asMeasureError(err: unknown): ToolCodeError<MeasureTextToolCodeV1> {
  if (err instanceof ToolCodeError && Object.hasOwn(CODES, err.code)) return err as ToolCodeError<MeasureTextToolCodeV1>;
  const message = err instanceof Error ? err.message : String(err);
  const code = (err as { code?: unknown })?.code;
  if (err instanceof Error && err.name === 'TextMeasureError') return new ToolCodeError(code === 'font.unavailable' ? 'font.unavailable' : 'request.invalid', message);
  return new ToolCodeError('internal', message);
}

/** The spec one text box describes, through `style` when one is named, with a note saying what a style was sized for. */
async function boxSpec(args: Record<string, unknown>, brief: unknown | null): Promise<{ spec: TextMeasureSpecV1; note?: string }> {
  if (typeof args.text !== 'string') throw new ToolCodeError<MeasureTextToolCodeV1>('request.invalid', 'text is required: the text to measure, or pass document for a whole document.');
  const width = numberArg(args, 'width', { positive: true });
  if (width === undefined) throw new ToolCodeError<MeasureTextToolCodeV1>('request.invalid', 'width is required: the text box width in px.');
  const height = numberArg(args, 'height', { positive: true });
  const fields: Record<string, unknown> = {};
  const size = numberArg(args, 'fontSize', { positive: true });
  const lineHeight = numberArg(args, 'lineHeight', { positive: true });
  const pad = numberArg(args, 'pad', { min: 0 });
  const tracking = numberArg(args, 'tracking');
  const weight = numberArg(args, 'weight', { positive: true });
  if (size !== undefined) fields.fontSize = size;
  if (lineHeight !== undefined) fields.lineHeight = lineHeight;
  if (pad !== undefined) fields.pad = pad;
  if (tracking !== undefined) fields.tracking = tracking;
  if (weight !== undefined) fields.weight = String(weight);
  if (args.font !== undefined) {
    if (typeof args.font !== 'string' || !args.font.trim()) throw new ToolCodeError<MeasureTextToolCodeV1>('request.invalid', 'font must be sans, display, mono or a family name.');
    fields.font = args.font;
  }
  if (args.valign !== undefined) {
    if (!['top', 'middle', 'bottom'].includes(String(args.valign))) throw new ToolCodeError<MeasureTextToolCodeV1>('request.invalid', 'valign must be top, middle or bottom.');
    fields.valign = args.valign;
  }
  if (args.italic !== undefined && typeof args.italic !== 'boolean') throw new ToolCodeError<MeasureTextToolCodeV1>('request.invalid', 'italic must be true or false.');
  const artboardWidth = numberArg(args, 'artboardWidth', { positive: true });
  if (artboardWidth !== undefined && args.style === undefined)
    throw new ToolCodeError<MeasureTextToolCodeV1>('request.invalid', 'artboardWidth sizes a style: pass it with style.');
  const { measureFontsFromBrief, textMeasureSpecOfRow } = await import('@lolly-tools/node-shell/text-measure');
  const fonts = measureFontsFromBrief(brief);
  let row: Record<string, unknown> = { id: 'measure', kind: 'text', x: 0, y: 0, w: width, h: height ?? 1, text: args.text, ...fields };
  let sized: string | undefined;
  if (args.style !== undefined) {
    if (typeof args.style !== 'string' || !args.style.trim()) throw new ToolCodeError<MeasureTextToolCodeV1>('request.invalid', 'style must be a text style id.');
    const { expandDesignAuthoring } = await import('@lolly/engine');
    // The style is sized for the artboard the box sits on, so the box sits on one.
    const aw = artboardWidth ?? MEASURE_TEXT_DEFAULT_ARTBOARD_WIDTH;
    const artboard = { id: 'measure-artboard', kind: 'frame', x: 0, y: 0, w: aw, h: Math.round((aw * 9) / 16) };
    try {
      row = expandDesignAuthoring([{ ...row, frame: artboard.id, $style: args.style }], { existing: [artboard], ...(brief ? { brief } : {}), ...(typeof args.theme === 'string' ? { theme: args.theme } : {}) }).rows[0] as Record<string, unknown>;
    } catch (err) {
      throw new ToolCodeError<MeasureTextToolCodeV1>('request.invalid', `style: ${err instanceof Error ? err.message.replace(/^\/0\/\$style: /, '') : String(err)}`);
    }
    sized = `Style "${args.style}" was sized for an artboard ${aw} px wide${artboardWidth === undefined ? ' (the default; pass artboardWidth for another)' : ''}. A document's own $styles are measured with document and layerIds.`;
  }
  const spec = textMeasureSpecOfRow(row, fonts);
  if (height === undefined) delete spec.height;
  if (args.italic === true) spec.italic = true;
  return { spec, ...(sized ? { note: sized } : {}) };
}

/** The rows of a document argument in any shape `lolly_check` reads. */
function documentRows(doc: unknown): unknown[] {
  const top = record(doc) ? doc : {};
  const values = record(top.values) ? top.values : top;
  const boxes = Array.isArray(doc) ? doc : values.boxes;
  if (!Array.isArray(boxes)) throw new ToolCodeError<MeasureTextToolCodeV1>('request.invalid', 'document must be a Design document: a boxes array, {boxes}, or Design input values.');
  if (boxes.length > MEASURE_TEXT_MAX_LAYERS * 4)
    throw new ToolCodeError<MeasureTextToolCodeV1>('request.invalid', `document has ${boxes.length} rows; this tool reads up to ${MEASURE_TEXT_MAX_LAYERS * 4}. Run lolly measure --text-layers on the CLI.`);
  // Every row kept in place, so each reported index is the row's own place in boxes.
  return boxes;
}

/** Measure one box or a document's text layers. Never throws: a failure is an error result with its code. */
export async function callMeasureText(
  args: Record<string, unknown>,
  env: Env = process.env,
  limits: Readonly<StructuredLimitsV1> = STRUCTURED_LIMITS,
): Promise<StructuredResult> {
  const ctx: StructuredCtx = { env, limits };
  try {
    const extra = Object.keys(args).find((key) => !Object.hasOwn(ARGS, key));
    if (extra) throw new ToolCodeError('request.invalid', `lolly_measure_text takes ${Object.keys(ARGS).join(', ')}, not ${extra}.`);
    if (args.theme !== undefined && typeof args.theme !== 'string') throw new ToolCodeError('request.invalid', 'theme must be a theme name.');
    const brief = await profileBrief(typeof args.theme === 'string' && args.theme ? args.theme : undefined);
    if (args.document !== undefined) {
      const box = Object.keys(args).find((key) => !DOCUMENT_ONLY.has(key));
      if (box) throw new ToolCodeError('request.invalid', `${box} describes one text box and is not taken with document, where every layer brings its own fields.`);
      if (args.layerIds !== undefined && (!Array.isArray(args.layerIds) || args.layerIds.some((id) => typeof id !== 'string' || !id)))
        throw new ToolCodeError('request.invalid', 'layerIds must be an array of layer ids.');
      let document = args.document;
      // An authoring document is measured as the stored rows it lowers to (design-authoring-v1).
      const { expandDesignAuthoringDocument, hasDesignAuthoring } = await import('@lolly/engine');
      if (hasDesignAuthoring(document)) {
        try {
          document = expandDesignAuthoringDocument(document, { brief: brief ?? null, ...(typeof args.theme === 'string' && args.theme ? { theme: args.theme } : {}) }).values;
        } catch (err) {
          throw new ToolCodeError<MeasureTextToolCodeV1>('request.invalid', `document: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      const rows = documentRows(document);
      const { countMeasurableTextLayers, measureDesignRowsReport } = await import('@lolly-tools/node-shell/text-measure');
      const layerIds = Array.isArray(args.layerIds) && args.layerIds.length ? (args.layerIds as string[]) : undefined;
      // Counted before anything is measured, so an oversized call is refused at once.
      const load = countMeasurableTextLayers(rows, layerIds);
      if (load.layers > MEASURE_TEXT_MAX_LAYERS)
        throw new ToolCodeError('request.invalid', `The document has ${load.layers} text layers to measure; this tool measures up to ${MEASURE_TEXT_MAX_LAYERS}. Pass layerIds, or run lolly measure --text-layers on the CLI.`);
      if (load.units > MEASURE_TEXT_MAX_UNITS)
        throw new ToolCodeError('request.invalid', `The text layers to measure hold ${load.units} characters; this tool measures up to ${MEASURE_TEXT_MAX_UNITS} in one call. Pass layerIds, or run lolly measure --text-layers on the CLI.`);
      const report = await measureDesignRowsReport(rows, { ...(layerIds ? { layerIds } : {}), ...(brief ? { brief } : {}) });
      const clipped = report.measured.filter((l) => l.measure.overflow?.clipped);
      const structured = { layers: report.measured, skipped: report.skipped };
      const sentence = `Measured ${plural(report.measured.length, 'plain text layer')}: ${clipped.length ? `${clipped.length} clipped (${clipped.slice(0, 8).map((l) => l.layerId).join(', ')}${clipped.length > 8 ? ', ...' : ''})` : 'none clipped'}` +
        `${report.skipped.length ? `; ${plural(report.skipped.length, 'layer')} not measured` : ''}.`;
      return success<MeasureTextToolCodeV1>(sentence, structured, [], ctx, 'output.too-large', 'pass layerIds for fewer layers, or run lolly measure --text-layers on the CLI.');
    }
    const { spec, note: sized } = await boxSpec(args, brief);
    const { measureTextNode } = await import('@lolly-tools/node-shell/text-measure');
    const m: TextMeasureV1 = await measureTextNode(spec);
    if (sized) m.notes.push(sized);
    const verdict = m.overflow ? (m.overflow.clipped ? `, clipped by ${m.overflow.y} px` : `, fits with ${-m.overflow.y} px to spare`) : '';
    const sentence = `${plural(m.lineCount, 'line')}, ${Math.round(m.height * 100) / 100} px tall, scrollHeight ${m.scrollHeight}${verdict}${m.nearEdge ? '; a line is near the edge, so widen the box a little' : ''}.`;
    const structured: Record<string, unknown> = { ...m };
    return success<MeasureTextToolCodeV1>(sentence, structured, [], ctx, 'output.too-large', 'measure less text in one call.');
  } catch (err) {
    return failure(asMeasureError(err));
  }
}
