// SPDX-License-Identifier: MPL-2.0
/**
 * `lolly read` (plan 291 W2): what a deck says, slide by slide, for an agent that
 * has to rebuild the deck.
 *
 *   lolly read <deck.pptx|deck.pdf|file.psd|-> [--media=<dir>] [--thumbnails] [--force] [--json]
 *
 * One read through the rebrand reader and census (@lolly-tools/node-shell/content-inventory),
 * so `lolly read`, the `lolly_read` MCP tool and the fidelity family of `lolly check` see
 * the same text, notes and pictures. With `--json` the envelope's `result` is a
 * `ContentInventoryV1` (schemas/content-inventory-v1.schema.json). Without it, an outline
 * goes to stdout: each slide's text in reading order with its role, its pictures and
 * the first line of its notes.
 *
 * `--media=<dir>` writes each distinct picture once, as `<sha256>.<ext>`, and records the
 * path on the inventory. A file already there with the same bytes is reused; one with
 * other bytes is refused (exit 4) unless `--force` is given, and nothing is written then.
 * `--thumbnails` (with `--media`) also draws each slide as a PNG there, recorded as the
 * slide's `thumbnail`.
 *
 * `--extract` writes the file as blocks in reading order instead (plan 203, rank 10):
 * the engine's `readExtract` over the same inventory, bounded by `--pages` and
 * `--max-chars` and continued with `--from`, as plain text, Markdown (`--markdown`) or
 * a `ReadExtractV1` envelope (`--json`). `--ocr` reads the text of pages that are
 * pictures with the text recognition model on this machine, and never downloads the model.
 *
 * Needs no catalog and no browser: the verb is content-free.
 */

import { readFile, stat } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import type { ContentInventoryV1, ReadExtractV1 } from '@lolly-tools/core';
import { extractMarkdown, extractPlainText, readExtract, ReadExtractError } from '@lolly/engine';
import { ContentInventoryError, readContentInventory, type ReadInventoryInputV1 } from '@lolly-tools/node-shell/content-inventory';
import { nodeFlattenedOcr, RebrandPipelineError } from '@lolly-tools/node-shell/rebrand';
import { cleanControlChars } from '@lolly-tools/node-shell/verdict-report';
import { CliError, EXIT, usageError } from './exit-codes.ts';
import { emitResult } from './envelope.ts';
import { note, writeOut } from './output.ts';
import { readStdin } from './run.ts';

export interface ReadCliOptions {
  json?: boolean;
  /** The folder pictures are written to. */
  media?: string;
  force?: boolean;
  /** Draw each slide as a PNG under `media`. */
  thumbnails?: boolean;
  /** Read the text of pages that are pictures with the cached text recognition model. */
  ocr?: boolean;
  /** Write blocks in reading order (`ReadExtractV1`) instead of the inventory. */
  extract?: boolean;
  /** With `extract`: a page expression. */
  pages?: string;
  /** With `extract`: the character budget, as typed. */
  maxChars?: string;
  /** With `extract`: the block to continue from. */
  from?: string;
  /** With `extract`: Markdown rather than plain text. */
  markdown?: boolean;
}

/** Exit and envelope kind for each reader failure code. */
const PIPELINE_EXIT: Record<string, number> = {
  'source.unsupported': EXIT.USAGE,
  'source.missing': EXIT.USAGE,
  'source.unreadable': EXIT.FAILED,
  'source.encrypted': EXIT.FAILED,
  'source.too-large': EXIT.FAILED,
};

const kindOf = (code: string): string => code.toUpperCase().replace(/[.-]/g, '_');

/** A reader or media failure as the run's own error, with a stable kind. */
function asCliError(err: unknown): unknown {
  if (err instanceof ContentInventoryError) {
    const exit = err.code === 'media.exists' ? EXIT.REFUSED : err.code === 'thumbnails.no-media' ? EXIT.USAGE : EXIT.FAILED;
    return new CliError(err.message, exit, kindOf(err.code), err.code);
  }
  if (err instanceof RebrandPipelineError) {
    return new CliError(err.message, PIPELINE_EXIT[err.code] ?? EXIT.FAILED, kindOf(err.code), err.code);
  }
  return err;
}

async function readSource(source: string): Promise<{ bytes: Uint8Array; name: string }> {
  if (!source) throw usageError('lolly read needs a deck: a .pptx, a .pdf or a Photoshop .psd file, or - for standard input.', 'MISSING_ARGUMENT');
  if (source !== '-') {
    const info = await stat(resolve(process.cwd(), source)).catch(() => null);
    if (info?.isDirectory()) {
      throw usageError(`${source} is a folder; lolly read takes one deck file (.pptx, .pdf, .psd) or - for standard input.`, 'SOURCE_IS_FOLDER');
    }
  }
  const bytes = source === '-' ? new Uint8Array(await readStdin()) : new Uint8Array(await readFile(resolve(process.cwd(), source)));
  if (!bytes.length) throw usageError('The deck is empty.', 'EMPTY_SOURCE');
  return { bytes, name: source === '-' ? 'standard-input' : basename(source) };
}

const truncate = (text: string, max: number): string => (text.length > max ? `${text.slice(0, max - 3)}...` : text);
const oneLine = (text: string): string => text.replace(/\n+/g, ' / ');
/**
 * The deck's own words, names and warnings, scrubbed of control characters at this
 * print boundary (as preflight does), so a crafted deck cannot write ANSI that
 * rewrites the terminal. The `--json` inventory is data and is left as it is.
 */
const clean = cleanControlChars;

/** The human outline: slide by slide, text in reading order, pictures, the first line of the notes. */
export function inventoryOutline(inventory: ContentInventoryV1): string {
  const lines: string[] = [];
  for (const slide of inventory.slides) {
    lines.push(`Slide ${slide.number}${slide.layoutName ? `  (${clean(slide.layoutName)})` : ''}`);
    for (const text of slide.text) lines.push(`  [${text.role}] ${clean(truncate(oneLine(text.plain), 100))}`);
    for (const picture of slide.pictures) {
      const size = picture.width && picture.height ? ` ${picture.width}x${picture.height}` : '';
      lines.push(`  picture ${picture.kind} ${clean(picture.mime)}${size} ${clean(picture.file ?? picture.sha256.slice(0, 12))}`);
    }
    if (slide.thumbnail) lines.push(`  thumbnail ${slide.thumbnail.width}x${slide.thumbnail.height} ${slide.thumbnail.file}`);
    for (const table of slide.tables) lines.push(`  table ${table.rows.length} rows`);
    for (const chart of slide.charts) lines.push(`  chart${chart.type ? ` ${clean(chart.type)}` : ''}`);
    if (slide.notes) {
      const count = slide.notes.paragraphs.length;
      lines.push(`  notes (${count} paragraph${count === 1 ? '' : 's'}): ${clean(truncate(slide.notes.paragraphs[0]?.lines[0] ?? '', 90))}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

/**
 * The extract's own text, with the control characters a crafted file could use to
 * rewrite the terminal turned to spaces. Line breaks and tabs are the extract's
 * structure, so they stay.
 */
const cleanText = (text: string): string => Array.from(text, (ch) => {
  const code = ch.charCodeAt(0);
  return (code < 0x20 && code !== 0x09 && code !== 0x0a) || (code >= 0x7f && code < 0xa0) ? ' ' : ch;
}).join('');

/** The extract flags, refused without `--extract` so a bound is never silently ignored. */
function checkExtractFlags(opts: ReadCliOptions): number | undefined {
  const given: Array<[string, unknown]> = [['pages', opts.pages], ['max-chars', opts.maxChars], ['from', opts.from], ['markdown', opts.markdown || undefined]];
  if (!opts.extract) {
    const stray = given.find(([, value]) => value !== undefined);
    if (stray) throw usageError(`--${stray[0]} shapes the extract: add --extract.`, 'MISSING_ARGUMENT');
    return undefined;
  }
  if (opts.markdown && opts.json) throw usageError('--markdown writes Markdown and --json writes the envelope; choose one.', 'CONFLICTING_FLAGS');
  if (opts.maxChars === undefined) return undefined;
  if (!/^[1-9][0-9]{0,9}$/.test(opts.maxChars)) throw usageError(`--max-chars takes a whole number of characters, such as 20000 (got "${opts.maxChars}").`, 'BAD_FLAG_VALUE');
  return Number(opts.maxChars);
}

/** Text recognition for pages that are pictures, or the reason it cannot run here. Downloads nothing. */
async function ocrRead(wanted: boolean | undefined): Promise<{ read: Pick<ReadInventoryInputV1, 'ocr' | 'ocrModel' | 'ocrMissing'>; unavailable?: string }> {
  if (!wanted) return { read: {} };
  const runner = await nodeFlattenedOcr();
  if (runner.ok) return { read: { ocr: runner.ocr, ocrModel: runner.model } };
  return { read: { ocrMissing: 'unavailable' }, unavailable: runner.message };
}

/** One line on standard error: what the extract holds, and where to continue. */
function extractSummary(extract: ReadExtractV1, name: string): string {
  const blocks = extract.blocks.length;
  const pages = extract.request.pages;
  const span = pages.length === extract.source.pages ? `${pages.length} page${pages.length === 1 ? '' : 's'}` : `page${pages.length === 1 ? '' : 's'} ${pages.join(', ')}`;
  const recognised = extract.blocks.filter((b) => b.origin === 'recognized').length;
  let summary = `Extracted ${blocks} block${blocks === 1 ? '' : 's'} (${extract.chars} characters) from ${span} of ${name}`;
  if (recognised) summary += `, ${recognised} read by text recognition`;
  summary += '.';
  if (!extract.complete && extract.next) summary += ` Stopped at the budget: continue with --from=${extract.next}.`;
  return summary;
}

export async function readCli(positionals: string[], opts: ReadCliOptions = {}): Promise<number> {
  if (positionals.length > 1) throw usageError(`lolly read takes one deck; got ${positionals.length}.`, 'TOO_MANY_ARGUMENTS');
  if (opts.media === '') throw usageError('--media needs a value: write --media=<folder>.', 'MISSING_FLAG_VALUE');
  if (opts.thumbnails && opts.media === undefined) throw usageError('--thumbnails writes beside the pictures: add --media=<folder>.', 'MISSING_ARGUMENT');
  const maxChars = checkExtractFlags(opts);
  const { bytes, name } = await readSource(positionals[0] ?? '');
  const mediaDir = opts.media !== undefined ? resolve(process.cwd(), opts.media) : undefined;
  const ocr = await ocrRead(opts.ocr);
  if (ocr.unavailable) note(ocr.unavailable);
  let read: Awaited<ReturnType<typeof readContentInventory>>;
  try {
    read = await readContentInventory({
      bytes, name, ...(mediaDir ? { mediaDir } : {}), ...(opts.force ? { force: true } : {}), ...(opts.thumbnails ? { thumbnails: true } : {}),
      ...ocr.read,
    });
  } catch (err) {
    throw asCliError(err);
  }
  const { inventory, written, reused } = read;
  if (opts.extract) {
    let extract: ReadExtractV1;
    try {
      extract = readExtract(inventory, {
        ...(opts.pages !== undefined ? { pages: opts.pages } : {}),
        ...(maxChars !== undefined ? { maxChars } : {}),
        ...(opts.from !== undefined ? { from: opts.from } : {}),
      });
    } catch (err) {
      if (err instanceof ReadExtractError) throw new CliError(err.message, EXIT.USAGE, kindOf(err.code), err.code);
      throw err;
    }
    if (opts.json) {
      await emitResult(extract);
      return EXIT.OK;
    }
    await writeOut(cleanText(opts.markdown ? extractMarkdown(extract) : extractPlainText(extract)));
    note(extractSummary(extract, clean(name)));
    for (const w of extract.warnings) note(`Note (${clean(w.code)}): ${clean(w.message)}`);
    return EXIT.OK;
  }
  if (opts.json) {
    await emitResult(inventory);
    return EXIT.OK;
  }
  await writeOut(inventoryOutline(inventory));
  const slides = inventory.source.slides;
  const withNotes = inventory.slides.filter((s) => s.notes).length;
  const flattened = inventory.warnings.filter((w) => w.code === 'slide-flattened').length;
  const thumbs = inventory.slides.filter((s) => s.thumbnail).length;
  let summary = `Read ${slides} slide${slides === 1 ? '' : 's'} of ${name}: ${inventory.media.length} distinct picture${inventory.media.length === 1 ? '' : 's'}, notes on ${withNotes}`;
  if (flattened) summary += `, ${flattened} ${flattened === 1 ? 'slide is' : 'slides are'} one picture of ${flattened === 1 ? 'its' : 'their'} text`;
  if (thumbs) summary += `, ${thumbs} thumbnail${thumbs === 1 ? '' : 's'}`;
  summary += '.';
  if (mediaDir) summary += ` Wrote ${written.length} to ${mediaDir}${reused.length ? `, ${reused.length} already there` : ''}.`;
  note(summary);
  for (const w of inventory.warnings) note(`Note (${clean(w.code)}): ${clean(w.message)}`);
  return EXIT.OK;
}
