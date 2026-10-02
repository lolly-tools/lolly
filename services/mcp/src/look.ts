// SPDX-License-Identifier: MPL-2.0
/**
 * The looking tools (plans/289 section 6): lolly_look, lolly_sample_color and
 * lolly_trace_edges. They let an agent see a render in the render's own
 * coordinates instead of guessing from a small picture.
 *
 *   - lolly_look draws the render, or one region of it at full size, with a
 *     labelled grid. The numbers on the grid are document units: the SVG's
 *     viewBox, which for Design is the artboard's pixel space, so they are the
 *     numbers a layer's x, y, w and h use.
 *   - lolly_sample_color reads the colours at points and gives the nearest
 *     colour of the active design system, with its distance.
 *   - lolly_trace_edges returns the picture's edges as polylines in document
 *     units, optionally as ready Design path layers.
 *
 * Each works on a tool render (the same toolId / inputs / layerOperations as
 * lolly_render) or on an image the agent supplies. What it returns is for
 * looking: never an export, never stamped, never linked. The drawing, sampling
 * and tracing live in @lolly-tools/node-shell/look, shared with the CLI's
 * `lolly look`, `lolly sample` and `lolly trace`; this file turns MCP arguments
 * into a source and the results into MCP content.
 *
 * THE RASTERISER READS LOCAL FILES. resvg resolves an `<image href>` that is a
 * file path, and has no switch to stop that, so a supplied SVG could otherwise
 * make the server draw any image on its disk into the answer. Every SVG is
 * therefore cleaned before resvg sees it (`cleanImageRefs`): only `#` fragments
 * and strict-base64 `data:` images survive, a `data:` SVG is cleaned
 * recursively, and a local reference is inlined only when it resolves inside
 * the profile's own content (catalog, tool packs, shared asset roots), which is
 * where a render's catalog pictures come from.
 */

import {
  lookAt, regionText, sampleColors, sampleLine, sourceFromBytes, traceSourceEdges, unitsText,
  type LookContext, type LookSource,
} from '@lolly-tools/node-shell/look';
import type { ColorSwatch, ViewRegion } from '@lolly/engine';
import type { ContentBlock, ToolCallResult } from './protocol.ts';
import { contentImageRoots, fontsDir } from './paths.ts';
import { withHost } from './host.ts';
import { MAX_TRANSFORM_INPUT_BYTES, maxRasterPixelsFor } from './render.ts';
import { isHostedServer } from './rebrand.ts';

export { cleanImageRefs } from '@lolly-tools/node-shell/look';

/** What tools.ts renders for a look: the tool's own SVG when it draws vector,
 *  else its first raster format. */
export type LookRender = (args: Record<string, unknown>) => Promise<
  { bytes: Uint8Array; mime: string; format: string; warnings: string[] } | { error: string }
>;

/** The schema fragments tools.ts shares, so these tools take a source exactly
 *  as lolly_render takes one. */
export interface LookSchemaParts {
  toolId: unknown; inputs: unknown; template: Record<string, unknown>; layerOperations: unknown; layerPatches: unknown; file: unknown;
}

const REGION_ARG = {
  type: 'object',
  description: 'A rectangle in document units (x, y, w, h). Left out for the whole document.',
  properties: { x: { type: 'number' }, y: { type: 'number' }, w: { type: 'number' }, h: { type: 'number' } },
  required: ['x', 'y', 'w', 'h'],
  additionalProperties: false,
};

const SOURCE_NOTE = 'Give a toolId with its inputs (as lolly_render takes them) or a file (PNG, JPEG, GIF, WebP or SVG).';

export function lookToolDefs(p: LookSchemaParts) {
  const source = {
    toolId: p.toolId, inputs: p.inputs, ...p.template, layerOperations: p.layerOperations, layerPatches: p.layerPatches, file: p.file,
  };
  return [
    {
      name: 'lolly_look',
      description: 'Look at a render with a labelled coordinate grid, or at one region of it enlarged. '
        + 'The grid numbers are document units: for Design, the artboard pixels that a layer\'s x, y, w and h use, '
        + 'so you can place and check layers by reading the picture. For looking only; not an export. ' + SOURCE_NOTE,
      inputSchema: {
        type: 'object',
        properties: {
          ...source,
          grid: { description: 'Grid spacing in document units; true (the default) picks a round spacing, false or 0 draws none.', oneOf: [{ type: 'number', minimum: 0 }, { type: 'boolean' }] },
          region: REGION_ARG,
          maxSide: { type: 'number', minimum: 128, maximum: 2048, description: 'Longest side of the returned image in pixels (default 1024). A region is enlarged to fill it, up to 8 times.' },
        },
        additionalProperties: false,
      },
    },
    {
      name: 'lolly_sample_color',
      description: 'Read the colours at points of a render or image, each averaged over a small disc, and name the nearest '
        + 'colour of the active design system with its distance (ΔE in OKLab; about 0.02 is just noticeable). '
        + 'Use it to check that a colour is a brand colour, or to pick one from a photo. ' + SOURCE_NOTE,
      inputSchema: {
        type: 'object',
        properties: {
          ...source,
          points: { type: 'array', minItems: 1, maxItems: 500, items: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 }, description: 'Points as [[x, y], ...] in document units.' },
          radius: { type: 'number', minimum: 0, maximum: 50, description: 'Radius of the averaged disc in document units (default 2; 0 reads one pixel).' },
        },
        required: ['points'],
        additionalProperties: false,
      },
    },
    {
      name: 'lolly_trace_edges',
      description: 'The edges in a render or image as polylines in document units, longest first, so line work and '
        + 'outlines can follow where a subject really is. With asDesignLayers, each line is also returned as a Design '
        + 'path layer (give it an id) ready for layerOperations. ' + SOURCE_NOTE,
      inputSchema: {
        type: 'object',
        properties: {
          ...source,
          region: REGION_ARG,
          detail: { type: 'number', minimum: 0, maximum: 100, description: 'How faint an edge may be, 0 to 100 (default 50).' },
          minLength: { type: 'number', minimum: 0, description: 'Shortest line kept, in document units (default 20).' },
          simplify: { type: 'number', minimum: 0, description: 'How far a line may stray from the edge, in document units (default 2). Higher means fewer points.' },
          maxLines: { type: 'number', minimum: 1, maximum: 500, description: 'At most this many lines (default 50).' },
          maxSide: { type: 'number', minimum: 128, maximum: 2048, description: 'Resolution the edges are found at: longest side in pixels (default 1024).' },
          asDesignLayers: { type: 'boolean', description: 'Also return each line as a Design path layer.' },
        },
        additionalProperties: false,
      },
    },
  ];
}

// ── sources ──────────────────────────────────────────────────────────────────

async function lookSource(args: Record<string, unknown>, renderFn: LookRender): Promise<LookSource | { error: string }> {
  const file = args.file as { base64?: unknown; name?: unknown; mime?: unknown } | undefined;
  if (file && args.toolId) return { error: 'Give a toolId or a file, not both.' };
  if (file) {
    if (typeof file.base64 !== 'string') return { error: 'file.base64 is required.' };
    const bytes = Uint8Array.from(Buffer.from(file.base64, 'base64'));
    if (!bytes.length) return { error: 'The file is empty.' };
    if (bytes.length > MAX_TRANSFORM_INPUT_BYTES) return { error: `The file is larger than ${MAX_TRANSFORM_INPUT_BYTES / 1024 / 1024} MB.` };
    return sourceFromBytes(bytes, typeof file.mime === 'string' ? file.mime : undefined, [], typeof file.name === 'string' ? file.name : 'the file', []);
  }
  if (!args.toolId) return { error: SOURCE_NOTE };
  const rendered = await renderFn(args);
  if ('error' in rendered) return rendered;
  return sourceFromBytes(rendered.bytes, rendered.mime, contentImageRoots(), `${String(args.toolId)} (${rendered.format})`, rendered.warnings);
}

/** The pixel area one look may draw: the hosted raster cap when there is one. */
function lookContext(): LookContext {
  return { fontDirs: [fontsDir()], areaCap: maxRasterPixelsFor(process.env, isHostedServer()) ?? 16_000_000 };
}

function errorResult(message: string): ToolCallResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

// ── the tools ────────────────────────────────────────────────────────────────

export async function callLookTool(name: string, args: Record<string, unknown>, renderFn: LookRender): Promise<ToolCallResult> {
  const source = await lookSource(args, renderFn);
  if ('error' in source) return errorResult(`${name}: ${source.error}`);
  const ctx = lookContext();
  const warnings = source.warnings.length ? `\nWarnings: ${source.warnings.join('; ')}` : '';

  if (name === 'lolly_look') {
    const look = await lookAt(source, { region: args.region as Partial<ViewRegion> | undefined, grid: args.grid as number | boolean | undefined, maxSide: args.maxSide as number | undefined }, ctx);
    const text = [
      `Looking at ${source.label}: document ${regionText(source.frame)}.`,
      `Showing ${look.whole ? 'the whole document' : `region ${regionText(look.region)}`} at ${look.width} x ${look.height} px (${Math.round(look.pxPerUnit * 100) / 100} px per unit).`,
      look.spacing ? `Grid every ${Math.round(look.spacing * 10) / 10} units, numbered on the top and left edges.` : 'No grid.',
      unitsText(source.units),
    ].join('\n') + warnings;
    const content: ContentBlock[] = [{ type: 'text', text }, { type: 'image', data: Buffer.from(look.png).toString('base64'), mimeType: 'image/png' }];
    return { content };
  }

  if (name === 'lolly_sample_color') {
    const raw = Array.isArray(args.points) ? args.points : [];
    const points = raw.slice(0, 500).filter((p): p is [number, number] =>
      Array.isArray(p) && p.length === 2 && Number.isFinite(Number(p[0])) && Number.isFinite(Number(p[1]))).map(p => [Number(p[0]), Number(p[1])] as [number, number]);
    if (!points.length) return errorResult('lolly_sample_color: points must be [[x, y], ...] with at least one point.');
    const swatches = await withHost({}, async (_dom, host) => {
      try { return (await host.tokens?.colors?.()) as ColorSwatch[] ?? []; } catch { return []; }
    });
    const { radius, samples } = await sampleColors(source, { points, radius: args.radius as number | undefined, swatches }, ctx);
    const header = `Sampled ${samples.length} point${samples.length === 1 ? '' : 's'} of ${source.label}, radius ${radius} units. ${unitsText(source.units)}`
      + (swatches.length ? ` Compared with ${swatches.length} design-system colour${swatches.length === 1 ? '' : 's'}.` : ' No design-system colours to compare with.');
    return {
      content: [
        { type: 'text', text: [header, ...samples.slice(0, 20).map(sampleLine), samples.length > 20 ? `... and ${samples.length - 20} more in the JSON below.` : ''].filter(Boolean).join('\n') + warnings },
        { type: 'text', text: JSON.stringify({ frame: source.frame, units: source.units, radius, samples }, null, 2) },
      ],
    };
  }

  if (name === 'lolly_trace_edges') {
    const asLayers = args.asDesignLayers === true;
    const traced = await traceSourceEdges(source, {
      region: args.region as Partial<ViewRegion> | undefined, detail: args.detail as number | undefined, minLength: args.minLength as number | undefined,
      simplify: args.simplify as number | undefined, maxLines: args.maxLines as number | undefined, maxSide: args.maxSide as number | undefined, asDesignLayers: asLayers,
    }, ctx);
    const { lines, region } = traced;
    const text = `Traced ${lines.length} edge line${lines.length === 1 ? '' : 's'} in ${source.label}, ${traced.whole ? 'whole document' : `region ${regionText(region)}`}, `
      + `found at ${traced.width} x ${traced.height} px. ${lines.filter(l => l.closed).length} closed. ${unitsText(source.units)}`
      + (asLayers ? ' Each line carries a Design path layer: add an id and pass it to layerOperations as { op: "add", layer }.' : '')
      + warnings;
    return { content: [{ type: 'text', text }, { type: 'text', text: JSON.stringify({ frame: source.frame, region, units: source.units, lines }, null, 2) }] };
  }

  return errorResult(`Unknown tool: ${name}`);
}
