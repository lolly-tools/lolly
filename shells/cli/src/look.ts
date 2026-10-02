// SPDX-License-Identifier: MPL-2.0
/**
 * `lolly look`, `lolly sample` and `lolly trace` (plans/289 D5): the MCP looking
 * tools on the command line, over the same core (@lolly-tools/node-shell/look), so
 * a script and an agent see the same picture, the same colours and the same edges.
 *
 *   lolly look <file|-> [--region=x,y,w,h] [--grid=N|0] [--max-side=1024] [--output=look.png]
 *   lolly sample <file|-> --points=x,y;x,y [--radius=2]
 *   lolly trace <file|-> [--region=x,y,w,h] [--detail=50] [--min-length=20] [--simplify=2]
 *                        [--max-lines=50] [--max-side=1024] [--design-layers]
 *
 * The source is an SVG, PNG, JPEG, GIF or WebP file, or `-` for standard input, so a
 * render pipes straight in: `lolly design --z=… --export=svg | lolly look - --output=look.png`.
 * Coordinates are document units for an SVG (its viewBox; for Design, the artboard
 * pixels a layer's x, y, w and h use) and pixels for a raster image.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import type { ColorSwatch, ViewRegion } from '@lolly/engine';
import { catalogFile, contentRoots } from '@lolly-tools/node-shell/content-roots';
import {
  lookAt, regionText, sampleColors, sampleLine, sourceFromBytes, traceSourceEdges, unitsText, type LookContext,
} from '@lolly-tools/node-shell/look';
import { usageError, EXIT } from './exit-codes.ts';
import { emitResult } from './envelope.ts';
import { note, warn, writeOut } from './output.ts';
import { readProfile, readStdin } from './run.ts';
import { createCliBridge } from './bridge.ts';

export const LOOK_VERBS = ['look', 'sample', 'trace'] as const;
export type LookVerb = (typeof LOOK_VERBS)[number];

export interface LookCliOptions {
  json?: boolean;
  output?: string;
  region?: string;
  grid?: string;
  maxSide?: string;
  points?: string;
  radius?: string;
  detail?: string;
  minLength?: string;
  simplify?: string;
  maxLines?: string;
  designLayers?: boolean;
  userProfile?: string;
}

/** The largest source read, the same limit as the MCP tools. */
const MAX_SOURCE_BYTES = 24 * 1024 * 1024;
/** A local look has no hosted raster cap; this keeps one picture reasonable. */
const LOCAL_AREA_CAP = 16_000_000;

/** `x,y,w,h` as a region, or a usage error naming the flag. */
export function parseRegion(text: string | undefined): ViewRegion | undefined {
  if (text === undefined) return undefined;
  const n = text.split(',').map(v => Number(v.trim()));
  if (n.length !== 4 || n.some(v => !Number.isFinite(v)) || n[2]! <= 0 || n[3]! <= 0) {
    throw usageError('--region takes x,y,w,h in document units, with a positive width and height: --region=0,0,400,300.', 'BAD_REGION');
  }
  return { x: n[0]!, y: n[1]!, w: n[2]!, h: n[3]! };
}

/** `x,y;x,y` (or one point) as points, or a usage error naming the flag. */
export function parsePoints(text: string | undefined): Array<[number, number]> {
  if (!text) throw usageError('lolly sample needs --points=x,y (several as x,y;x,y).', 'MISSING_ARGUMENT');
  const points = text.split(';').filter(p => p.trim()).map((p) => {
    const n = p.split(',').map(v => Number(v.trim()));
    if (n.length !== 2 || n.some(v => !Number.isFinite(v))) throw usageError(`--points: "${p}" is not x,y.`, 'BAD_POINTS');
    return [n[0]!, n[1]!] as [number, number];
  });
  if (points.length > 500) throw usageError('--points takes at most 500 points.', 'BAD_POINTS');
  return points;
}

const numFlag = (v: string | undefined): number | undefined => (v === undefined || v === '' ? undefined : Number(v));

async function readSource(source: string): Promise<{ bytes: Uint8Array; label: string; dir: string | null }> {
  if (!source) throw usageError('Give an SVG, PNG, JPEG, GIF or WebP file, or - for standard input.', 'MISSING_ARGUMENT');
  const bytes = source === '-' ? new Uint8Array(await readStdin()) : new Uint8Array(await readFile(resolve(process.cwd(), source)));
  if (!bytes.length) throw usageError('The source is empty.', 'EMPTY_SOURCE');
  if (bytes.length > MAX_SOURCE_BYTES) throw usageError(`The source is larger than ${MAX_SOURCE_BYTES / 1024 / 1024} MB.`, 'SOURCE_TOO_LARGE');
  return { bytes, label: source === '-' ? 'standard input' : source, dir: source === '-' ? null : dirname(resolve(process.cwd(), source)) };
}

/** Where a local `<image href>` may be inlined from: the profile's content and the
 *  source file's own folder. */
function imageRoots(dir: string | null): string[] {
  const roots: string[] = dir ? [dir] : [];
  try {
    const c = contentRoots();
    roots.push(c.catalogRoot, ...c.toolRoots, ...c.assetRoots.map(a => a.dir));
  } catch { /* no content on this install: the source's folder only */ }
  return roots;
}

function lookContext(): LookContext {
  let fontDirs: string[] = [];
  try { fontDirs = [catalogFile('fonts')]; } catch { /* system fonts only */ }
  return { fontDirs, areaCap: LOCAL_AREA_CAP };
}

/** The active design system's colours, read through the same bridge a render uses. */
async function designColors(userProfile: string | undefined): Promise<ColorSwatch[]> {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  try {
    const host = await createCliBridge({ dom: dom as never, profile: await readProfile(userProfile) });
    return ((await host.tokens?.colors?.()) ?? []) as ColorSwatch[];
  } catch {
    return [];
  } finally {
    dom.window.close();
  }
}

export async function lookCli(verb: LookVerb, source: string, opts: LookCliOptions = {}): Promise<number> {
  const read = await readSource(source);
  const src = await sourceFromBytes(read.bytes, undefined, imageRoots(read.dir), read.label);
  if ('error' in src) throw usageError(src.error, 'BAD_SOURCE');
  const ctx = lookContext();

  if (verb === 'look') {
    const out = opts.output && opts.output !== '-' ? resolve(process.cwd(), opts.output) : null;
    if (opts.json && !out) throw usageError('lolly look --json needs --output=<file.png>: the picture cannot share standard output with the JSON.', 'CONFLICTING_FLAGS');
    const grid = opts.grid === undefined ? undefined : opts.grid === 'false' || opts.grid === '0' ? 0 : Number(opts.grid);
    if (grid !== undefined && !Number.isFinite(grid)) throw usageError('--grid takes a spacing in document units, or 0 for none.', 'BAD_GRID');
    const look = await lookAt(src, { region: parseRegion(opts.region), grid, maxSide: numFlag(opts.maxSide) }, ctx);
    if (out) await writeFile(out, look.png);
    else await writeOut(look.png);
    const result = {
      output: out, width: look.width, height: look.height, frame: src.frame, region: look.region, units: src.units,
      gridSpacing: look.spacing, pxPerUnit: Math.round(look.pxPerUnit * 1000) / 1000,
    };
    if (opts.json) await emitResult(result);
    else {
      if (out) note(`✓ Wrote ${look.width} x ${look.height} px to ${out}`);
      note(`${read.label}: document ${regionText(src.frame)}; showing ${look.whole ? 'the whole document' : `region ${regionText(look.region)}`}`
        + (look.spacing ? `, grid every ${Math.round(look.spacing * 10) / 10} units` : ', no grid') + '.');
      note(unitsText(src.units));
    }
    return EXIT.OK;
  }

  if (verb === 'sample') {
    const points = parsePoints(opts.points);
    const swatches = await designColors(opts.userProfile);
    const { radius, samples } = await sampleColors(src, { points, radius: numFlag(opts.radius), swatches }, ctx);
    if (!swatches.length) warn('NO_DESIGN_COLORS', 'No design-system colours to compare with; samples carry no nearest colour.');
    if (opts.json) await emitResult({ frame: src.frame, units: src.units, radius, samples });
    else {
      await writeOut(`${samples.map(sampleLine).join('\n')}\n`);
      note(`${samples.length} point${samples.length === 1 ? '' : 's'} of ${read.label}, radius ${radius} units. ${unitsText(src.units)}`);
    }
    return EXIT.OK;
  }

  const traced = await traceSourceEdges(src, {
    region: parseRegion(opts.region), detail: numFlag(opts.detail), minLength: numFlag(opts.minLength), simplify: numFlag(opts.simplify),
    maxLines: numFlag(opts.maxLines), maxSide: numFlag(opts.maxSide), asDesignLayers: opts.designLayers === true,
  }, ctx);
  const result = { frame: src.frame, region: traced.region, units: src.units, lines: traced.lines };
  if (opts.json) await emitResult(result);
  else {
    await writeOut(`${JSON.stringify(result, null, 2)}\n`);
    note(`Traced ${traced.lines.length} edge line${traced.lines.length === 1 ? '' : 's'} in ${read.label} at ${traced.width} x ${traced.height} px, `
      + `${traced.lines.filter(l => l.closed).length} closed. ${unitsText(src.units)}`);
  }
  return EXIT.OK;
}
