// SPDX-License-Identifier: MPL-2.0
/**
 * `lolly measure --text` and `lolly measure <doc> --text-layers` (plan 291 W5): where a
 * plain Design text layer's lines break and how tall it is, before anything is drawn.
 *
 *   lolly measure --text=<string|-> --width=<px> [--height=<px>] [--font=sans|display|mono|<family>]
 *                 [--weight=100..900] [--size=<px>] [--line-height=<n>] [--pad=<px>]
 *                 [--tracking=<px>] [--italic] [--valign=top|middle|bottom]
 *                 [--style=<id> [--artboard-width=<px>]] [--file=<tokens.json>] [--theme=<name>] [--json]
 *   lolly measure <design.json|file.lolly|-> --text-layers [--layer=<id>]... [--file] [--theme] [--json]
 *
 * The work is `measureTextNode` and `measureDesignRowsReport`
 * (@lolly-tools/node-shell/text-measure), shared with the `lolly_measure_text` MCP tool
 * and the `text-measure` checker of `lolly check`. With `--json` the envelope's
 * `result` is a `TextMeasureV1` (schemas/text-measure-v1.schema.json), or for a
 * document `{ layers: [{ layerId, index, measure }], skipped: [{ layerId, index, reason }] }`.
 *
 * On these branches `--width` and `--height` are the text box in px; on the compiled
 * document `lolly measure <document.json>` they keep their export-size meaning, and
 * the document mode refuses them. A field left out takes the renderer's default (size
 * 48, weight 700, line height 1.12, padding 8, valign middle). `--style=<id>` sets the
 * layer up as an authored row with that style (`$style`): the agent base (padding 0,
 * top, left, line height 1.2), then the style, then any flag given here. A style's
 * size scales with the artboard width, `--artboard-width` (default 1920), and the
 * output says which width it used; a document's own `$styles` are measured with
 * `--text-layers --layer=<id>`. `--italic` sets every run in emphasis, as an italic
 * style writes `*...*`.
 *
 * Faces follow the design system, by the `system context` ladder: `--file`, then the
 * active terminal system, then the active content profile; with none, the platform
 * faces. `--text=-` reads the text from standard input, so newlines and markup
 * survive the shell. A clipped verdict is data, not a failure: the exit code is 0.
 */
import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import type { TextMeasureSpecV1, TextMeasureV1 } from '@lolly-tools/core';
import { cleanControlChars } from '@lolly-tools/node-shell/verdict-report';
import { CliError, EXIT, usageError } from './exit-codes.ts';
import { emitResult } from './envelope.ts';
import { note, writeOut } from './output.ts';
import { readStdin } from './run.ts';

export interface MeasureTextCliOptions {
  json?: boolean;
  /** Repeated `--layer=<id>` values. */
  layers?: string[];
}

/** The flags of the text spec, which the document mode refuses. */
const SPEC_FLAGS = ['text', 'font', 'weight', 'size', 'width', 'height', 'line-height', 'pad', 'tracking', 'italic', 'valign', 'style', 'artboard-width'] as const;

/** The artboard width a `--style` is sized for when `--artboard-width` is not given, px. */
export const MEASURE_DEFAULT_ARTBOARD_WIDTH = 1920;

const clean = cleanControlChars;

function numberFlag(flags: Record<string, string>, name: string, opts: { min?: number; positive?: boolean } = {}): number | undefined {
  const raw = flags[name];
  if (raw === undefined) return undefined;
  const value = raw.trim() === '' ? NaN : Number(raw);
  if (!Number.isFinite(value) || (opts.positive && value <= 0) || (opts.min !== undefined && value < opts.min))
    throw usageError(`--${name} must be ${opts.positive ? 'a positive number' : opts.min !== undefined ? `a number of at least ${opts.min}` : 'a number'} (got "${raw}").`, 'BAD_FLAG_VALUE');
  return value;
}

function asCliError(err: unknown): unknown {
  const code = (err as { code?: unknown })?.code;
  if (err instanceof Error && err.name === 'TextMeasureError' && typeof code === 'string') {
    const exit = code === 'input.invalid' ? EXIT.USAGE : EXIT.FAILED;
    return new CliError(err.message, exit, code.toUpperCase().replace(/[.-]/g, '_'), code);
  }
  return err;
}

/** The design system by the `system context` ladder, as a brief; null with none. */
async function briefFor(flags: Record<string, string>): Promise<unknown | null> {
  const { briefSource } = await import('./system.ts');
  const { doc, origin, name } = await briefSource(flags);
  if (!doc) return null;
  const { readBriefCatalogFor } = await import('@lolly-tools/node-shell/design-brief');
  const { designBrief } = await import('@lolly/engine');
  try {
    return designBrief(doc, readBriefCatalogFor(origin?.kind, doc), { ...(name ? { name } : {}), ...(flags.theme ? { theme: flags.theme } : {}) });
  } catch (err) {
    throw usageError(err instanceof Error ? err.message : String(err), 'BAD_FLAG_VALUE');
  }
}

/** The spec the flags describe, through `--style` when one is named, with a note saying what a style was sized for. */
async function specFromFlags(flags: Record<string, string>, brief: unknown | null): Promise<{ spec: TextMeasureSpecV1; note?: string }> {
  let text = flags.text ?? '';
  if (text === '-') text = Buffer.from(await readStdin()).toString('utf8').replace(/\r?\n$/, '');
  const width = numberFlag(flags, 'width', { positive: true });
  if (width === undefined) throw usageError('lolly measure --text needs the box width: add --width=<px>.', 'MISSING_ARGUMENT');
  const height = numberFlag(flags, 'height', { positive: true });
  const size = numberFlag(flags, 'size', { positive: true });
  const lineHeight = numberFlag(flags, 'line-height', { positive: true });
  const pad = numberFlag(flags, 'pad', { min: 0 });
  const tracking = numberFlag(flags, 'tracking');
  const artboardWidth = numberFlag(flags, 'artboard-width', { positive: true });
  if (artboardWidth !== undefined && flags.style === undefined)
    throw usageError('--artboard-width sizes a text style: use it with --style=<id>.', 'BAD_FLAG_VALUE');
  let weight: string | undefined;
  if (flags.weight !== undefined) {
    const w = Number(flags.weight);
    if (!Number.isFinite(w) || w < 1 || w > 1000) throw usageError(`--weight must be a CSS weight from 100 to 900 (got "${flags.weight}").`, 'BAD_FLAG_VALUE');
    weight = String(w);
  }
  const valign = flags.valign;
  if (valign !== undefined && !['top', 'middle', 'bottom'].includes(valign))
    throw usageError(`--valign must be top, middle or bottom (got "${valign}").`, 'BAD_FLAG_VALUE');
  if (flags.font !== undefined && !flags.font.trim()) throw usageError('--font needs a value: sans, display, mono or a family name.', 'MISSING_FLAG_VALUE');
  const italic = flags.italic !== undefined && !/^(0|false|off|no)$/i.test(flags.italic);

  const { measureFontsFromBrief, textMeasureSpecOfRow } = await import('@lolly-tools/node-shell/text-measure');
  const fonts = measureFontsFromBrief(brief);
  if (flags.style !== undefined) {
    if (!flags.style.trim()) throw usageError('--style needs a style id (title, subtitle, body, caption, label, quote, number, attribution).', 'MISSING_FLAG_VALUE');
    // The layer as an authored row on an artboard, since a style is sized for the
    // artboard's width: the style fills what the flags leave out.
    const aw = artboardWidth ?? MEASURE_DEFAULT_ARTBOARD_WIDTH;
    const artboard = { id: 'measure-artboard', kind: 'frame', x: 0, y: 0, w: aw, h: Math.round((aw * 9) / 16) };
    const row: Record<string, unknown> = { id: 'measure', kind: 'text', frame: artboard.id, x: 0, y: 0, w: width, h: height ?? 1, text, $style: flags.style };
    if (size !== undefined) row.fontSize = size;
    if (weight !== undefined) row.weight = weight;
    if (lineHeight !== undefined) row.lineHeight = lineHeight;
    if (pad !== undefined) row.pad = pad;
    if (tracking !== undefined) row.tracking = tracking;
    if (flags.font !== undefined) row.font = flags.font;
    if (valign !== undefined) row.valign = valign;
    const { expandDesignAuthoring } = await import('@lolly/engine');
    let stored: Record<string, unknown>;
    try {
      stored = expandDesignAuthoring([row], { existing: [artboard], ...(brief ? { brief } : {}), ...(flags.theme ? { theme: flags.theme } : {}) }).rows[0] as Record<string, unknown>;
    } catch (err) {
      throw usageError(`--style: ${err instanceof Error ? err.message.replace(/^\/0\/\$style: /, '') : String(err)}`, 'BAD_FLAG_VALUE');
    }
    const spec = textMeasureSpecOfRow(stored, fonts);
    if (height === undefined) delete spec.height;
    if (italic) spec.italic = true;
    const note = `Style "${flags.style}" was sized for an artboard ${aw} px wide${artboardWidth === undefined ? ' (the default; give --artboard-width=<px> for another)' : ''}. A document's own $styles are measured with lolly measure <file> --text-layers --layer=<id>.`;
    return { spec, note };
  }
  const spec: TextMeasureSpecV1 = { text, width, fonts };
  if (height !== undefined) spec.height = height;
  if (flags.font !== undefined) spec.font = flags.font;
  if (weight !== undefined) spec.weight = weight;
  if (size !== undefined) spec.size = size;
  if (lineHeight !== undefined) spec.lineHeight = lineHeight;
  if (pad !== undefined) spec.pad = pad;
  if (tracking !== undefined) spec.tracking = tracking;
  if (valign !== undefined) spec.valign = valign as TextMeasureSpecV1['valign'];
  if (italic) spec.italic = true;
  return { spec };
}

const px = (n: number): string => `${Math.round(n * 100) / 100}`;

/** One measure in words: the lines, the heights and the box verdict. */
export function measureOutline(m: TextMeasureV1, label?: string): string {
  const out: string[] = [];
  const face = `${clean(m.font.family)} ${m.weight}${m.font.italic ? ' italic' : ''}, ${m.size} px, line ${px(m.lineHeightPx)} px`;
  out.push(`${label ? `${clean(label)}: ` : ''}${m.lineCount} line${m.lineCount === 1 ? '' : 's'}, ${px(m.height)} px tall, scrollHeight ${m.scrollHeight} (${face}; ${px(m.availableWidth)} of ${m.width} px wide)`);
  for (const line of m.lines) out.push(`  ${String(line.index + 1).padStart(2)}  ${px(line.width).padStart(8)} px  slack ${px(line.slack).padStart(7)}${line.nearEdge ? '  near edge' : ''}  "${clean(line.text)}"`);
  if (m.box && m.overflow) {
    out.push(m.overflow.clipped
      ? `  Clipped: ${m.overflow.x ? 'a line is wider than the box' : `${m.overflow.y} px taller than the box (clientHeight ${m.box.clientHeight})`}${m.overflow.hiddenLines.length ? `; lines ${m.overflow.hiddenLines.map((i) => i + 1).join(', ')} are cut off` : ''}.`
      : `  Fits: ${-m.overflow.y} px to spare in a ${m.box.clientHeight} px text area.`);
  }
  if (m.nearEdge) out.push(`  A line is within ${m.tolerance.nearEdgePx} px of breaking elsewhere: widen the box a little rather than trust the fit.`);
  for (const n of m.notes) out.push(`  Note: ${clean(n)}`);
  return `${out.join('\n')}\n`;
}

/** The rows of a Design document in any shape `lolly check` reads, or of a `.lolly`. */
async function documentRows(path: string): Promise<{ rows: unknown[]; name: string; raw: unknown }> {
  let bytes: Uint8Array;
  let name: string;
  if (path === '-') {
    bytes = new Uint8Array(await readStdin());
    name = 'standard-input.json';
  } else {
    try {
      bytes = new Uint8Array(await readFile(resolve(process.cwd(), path)));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') throw usageError(`No file at ${path}.`, 'FILE_NOT_FOUND');
      throw err;
    }
    name = basename(path);
  }
  if (!bytes.length) throw usageError('The document is empty.', 'EMPTY_INPUT');
  let raw: unknown;
  if (/\.lolly$/i.test(name)) {
    const { readLollyFile } = await import('@lolly-tools/node-shell/lolly-file');
    let contents: ReturnType<typeof readLollyFile>;
    try {
      contents = readLollyFile(bytes);
    } catch (err) {
      throw new CliError(err instanceof Error ? err.message : String(err), EXIT.FAILED, 'INPUT_UNREADABLE', 'input.unreadable');
    }
    const tool = contents.manifest.tool?.id;
    if (tool && tool !== 'design') throw usageError(`This .lolly holds a ${tool} session; lolly measure --text-layers reads Design documents.`, 'NO_COMPOSITION');
    raw = contents.session;
  } else {
    try {
      raw = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      throw usageError(`${name} is not JSON. Supply a Design document: a boxes array, an object with boxes, Design input values, or a .lolly.`, 'NO_COMPOSITION');
    }
  }
  const top = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const values = top.values && typeof top.values === 'object' && !Array.isArray(top.values) ? top.values as Record<string, unknown> : top;
  const boxes = Array.isArray(raw) ? raw : values.boxes;
  if (!Array.isArray(boxes)) throw usageError('Supply a Design document: a boxes array, an object with boxes, Design input values, or a .lolly.', 'NO_COMPOSITION');
  // Every row kept in place, so each reported index is the row's own place in boxes.
  return { rows: boxes, name, raw };
}

/** The rows to measure: a document's own, or the stored rows its authoring keys lower to. */
async function loweredRows(raw: unknown, rows: unknown[], brief: unknown, theme: string | undefined): Promise<unknown[]> {
  const { expandDesignAuthoringDocument, hasDesignAuthoring } = await import('@lolly/engine');
  if (!hasDesignAuthoring(raw)) return rows;
  try {
    return expandDesignAuthoringDocument(raw, { brief: brief ?? null, ...(theme ? { theme } : {}) }).rows;
  } catch (err) {
    throw new CliError(err instanceof Error ? err.message : String(err), EXIT.REFUSED, 'AUTHORING_INVALID');
  }
}

/**
 * Run either branch. `positionals` are the words after `measure`: none for `--text`,
 * the document for `--text-layers`.
 */
export async function measureTextCli(positionals: string[], flags: Record<string, string>, opts: MeasureTextCliOptions = {}): Promise<number> {
  const documentMode = flags['text-layers'] !== undefined || flags.layer !== undefined;
  if (documentMode) {
    if (flags['text-layers'] !== undefined && /^(0|false|off|no)$/i.test(flags['text-layers']))
      throw usageError('--text-layers takes no value: write --text-layers to measure every plain text layer.', 'BAD_FLAG_VALUE');
    const extra = SPEC_FLAGS.find((f) => flags[f] !== undefined);
    if (extra) throw usageError(`--${extra} describes one text box and is not taken with --text-layers, where every layer brings its own fields.`, 'BAD_FLAG_VALUE');
    if (positionals.length !== 1) throw usageError(`lolly measure --text-layers takes one Design document (.json, .lolly or -); got ${positionals.length}.`, positionals.length ? 'TOO_MANY_ARGUMENTS' : 'MISSING_ARGUMENT');
    const layers = (opts.layers?.length ? opts.layers : flags.layer !== undefined ? [flags.layer] : []).map((l) => l.trim());
    if (layers.some((l) => !l)) throw usageError('--layer needs a layer id: write --layer=<id>.', 'MISSING_FLAG_VALUE');
    const read = await documentRows(positionals[0]!);
    const { name } = read;
    const brief = await briefFor(flags);
    // An authoring document (`$in`, `$style`, `$stack` and the rest) is measured as the
    // stored rows it lowers to, with the same design system's styles.
    const rows = await loweredRows(read.raw, read.rows, brief, flags.theme);
    const { measureDesignRowsReport } = await import('@lolly-tools/node-shell/text-measure');
    let report: Awaited<ReturnType<typeof measureDesignRowsReport>>;
    try {
      report = await measureDesignRowsReport(rows, { ...(layers.length ? { layerIds: layers } : {}), ...(brief ? { brief } : {}) });
    } catch (err) {
      throw asCliError(err);
    }
    const result = { layers: report.measured, skipped: report.skipped };
    if (opts.json) {
      await emitResult(result);
      return EXIT.OK;
    }
    const clipped = report.measured.filter((l) => l.measure.overflow?.clipped).length;
    await writeOut(report.measured.map((l) => measureOutline(l.measure, l.layerId)).join(''));
    note(`${clean(name)}: measured ${report.measured.length} plain text layer${report.measured.length === 1 ? '' : 's'}, ${clipped} clipped.`);
    for (const s of report.skipped) note(`Not measured: ${clean(s.layerId)}. ${clean(s.reason)}`);
    return EXIT.OK;
  }
  if (positionals.length) throw usageError('lolly measure --text measures the text it is given and takes no file; for a document use lolly measure <design.json> --text-layers.', 'TOO_MANY_ARGUMENTS');
  const brief = await briefFor(flags);
  const { spec, note: sized } = await specFromFlags(flags, brief);
  const { measureTextNode } = await import('@lolly-tools/node-shell/text-measure');
  let measure: TextMeasureV1;
  try {
    measure = await measureTextNode(spec);
  } catch (err) {
    throw asCliError(err);
  }
  if (sized) measure.notes.push(sized);
  if (opts.json) await emitResult(measure);
  else await writeOut(measureOutline(measure));
  return EXIT.OK;
}
