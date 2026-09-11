// SPDX-License-Identifier: MPL-2.0
/**
 * The MCP meta-tools: list / describe / build_url / render / transform / verify.
 * Plus the catalog-derived prompts (server.ts prompts/*).
 *
 * The surface is small and fixed. It stays compact and scales to the whole
 * catalog without flooding a client's tool picker. Per-tool input schemas are
 * returned as data by describe_tool. See plans/77-mcp-server.md section 3.
 */

import { buildInputModel, serializeUrlState, parseUrlState, expandQuery, buildEmbedUrl, ENGINE_VERSION, verifyC2pa, resolveVerdict, defaultTrustAnchors, extractFileMetadata, HDR_DEFAULTS, compileDocument, inspectDocument, diffDocuments, measureDocument, packageDocument, validateDocument } from '@lolly/engine';
import type { C2paVerdict } from '@lolly/engine';
import { inspectDesignV1 } from '@lolly-tools/core';
// Relative import (not `@lolly-tools/node-shell/...`): this file is inlined into the
// serverless bundle, same as render.ts's node-shell imports.
import { VERDICT_SLUGS } from '@lolly-tools/node-shell/verdict-slugs';
import { cleanControlChars, verdictFacts, verdictChecks } from '@lolly-tools/node-shell/verdict-report';
import type { ToolManifest } from '../../../engine/src/loader.ts';
import type { ContentBlock, ToolCallResult } from './protocol.ts';
import { listTools, loadToolCached, loadIndex, listToolTemplates, loadTemplateSeed } from './catalog.ts';
import { toolInputSchema, fileInputId } from './schema.ts';
import { render, transform, isTextFormat, normFormat } from './render.ts';
import { withHost } from './host.ts';
import type { RenderOpts } from './render.ts';

const WEB_BASE = (process.env.LOLLY_WEB_BASE || 'https://lolly.tools').replace(/\/$/, '');

export interface McpToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

const FILE_ARG = {
  type: 'object',
  description: 'The input file.',
  properties: {
    base64: { type: 'string', description: 'File bytes, base64-encoded.' },
    name: { type: 'string', description: 'Original filename, e.g. photo.jpg.' },
    mime: { type: 'string', description: 'MIME type, e.g. image/jpeg.' },
  },
  required: ['base64'],
  additionalProperties: false,
};

const RENDER_ARGS = {
  toolId: { type: 'string', description: 'The tool id (from lolly_list_tools).' },
  inputs: { type: 'object', description: "The tool's inputs. Get the exact schema from lolly_describe_tool.", additionalProperties: true },
  format: { type: 'string', description: 'Output format (must be one the tool supports). Defaults to the first declared format.' },
  width: { type: 'number', description: 'Output width, in `unit`.' },
  height: { type: 'number', description: 'Output height, in `unit`.' },
  unit: { type: 'string', enum: ['px', 'mm', 'cm', 'in', 'pt'], description: 'Unit for width/height (default px).' },
  dpi: { type: 'number', description: 'Raster DPI for physical units (default 300).' },
};

const TEMPLATE_ARGS = {
  templateId: { type: 'string', description: 'Start from this built-in template id (listed by lolly_describe_tool).' },
  presetId: { type: 'string', description: 'Apply this preset from the selected template. Requires templateId.' },
};

const DESIGN_PATCH_ARG = {
  type: 'array',
  description: 'Design only: update template/document layers by stable id without resending their coordinates. Applied after template and inputs.',
  items: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Existing Design layer id (discover it with lolly_inspect).' },
      set: { type: 'object', description: 'Declared Design layer fields to replace, e.g. {"text":"New headline"}. The stable id itself cannot be changed.', additionalProperties: true },
    },
    required: ['id', 'set'],
    additionalProperties: false,
  },
};

const DESIGN_OPERATION_ARG = {
  type: 'array',
  description: 'Design only: add, duplicate, remove, reparent or reorder layers by stable id. Operations are applied in order before layerPatches.',
  items: {
    oneOf: [
      {
        type: 'object',
        properties: {
          op: { const: 'add' },
          layer: { type: 'object', description: 'The new Design layer. id is required; omitted kind/x/y/w/h use the Design defaults.', additionalProperties: true },
          beforeId: { type: 'string', description: 'Insert before this sibling id.' },
          afterId: { type: 'string', description: 'Insert after this sibling id.' },
        },
        required: ['op', 'layer'],
        additionalProperties: false,
      },
      {
        type: 'object',
        properties: {
          op: { const: 'duplicate' },
          id: { type: 'string', description: 'Existing stable layer id to clone.' },
          newId: { type: 'string', description: 'New stable id for the clone.' },
          childIds: {
            type: 'object',
            description: 'When duplicating a non-empty artboard, a complete old child id to new child id map.',
            additionalProperties: { type: 'string' },
          },
          beforeId: { type: 'string', description: 'Place the clone before this sibling id.' },
          afterId: { type: 'string', description: 'Place the clone after this sibling id.' },
        },
        required: ['op', 'id', 'newId'],
        additionalProperties: false,
      },
      {
        type: 'object',
        properties: {
          op: { const: 'remove' },
          id: { type: 'string', description: 'Existing stable layer id.' },
          cascade: { type: 'boolean', description: 'Required to remove a non-empty artboard and all of its child layers.' },
        },
        required: ['op', 'id'],
        additionalProperties: false,
      },
      {
        type: 'object',
        properties: {
          op: { const: 'reparent' },
          id: { type: 'string', description: 'Existing non-artboard layer id.' },
          artboardId: {
            oneOf: [
              { type: 'string', description: 'Destination artboard stable id.' },
              { type: 'null', description: 'Move the layer to the pasteboard.' },
            ],
          },
          beforeId: { type: 'string', description: 'Place the moved layer before this destination sibling id.' },
          afterId: { type: 'string', description: 'Place the moved layer after this destination sibling id.' },
        },
        required: ['op', 'id', 'artboardId'],
        additionalProperties: false,
      },
      {
        type: 'object',
        properties: {
          op: { const: 'reorder' },
          id: { type: 'string', description: 'Existing stable layer id.' },
          beforeId: { type: 'string', description: 'Place the layer before this sibling id.' },
          afterId: { type: 'string', description: 'Place the layer after this sibling id.' },
        },
        required: ['op', 'id'],
        additionalProperties: false,
      },
    ],
  },
};

/**
 * Export controls that are reserved URL params rather than tool inputs. Split
 * out of RENDER_ARGS because they also belong on lolly_build_url: a link an
 * agent hands to a person has to carry the same press setup and provenance
 * choices the render used, or the two disagree the moment the person opens it.
 *
 * These all reach the shell as ordinary query params (serializeUrlState writes
 * every one of them). That is why nothing downstream had to change to expose
 * them here: the capability was always in the URL surface, just not in this
 * schema. `depth` and `hdr` are additionally threaded into RenderOpts because
 * the browser-free tier exports through the engine directly and never sees the
 * query.
 */
const EXPORT_ARGS = {
  depth: {
    type: 'string',
    enum: ['8', '16', 'float', 'auto'],
    description: 'Bits per channel. A REQUEST, not a promise: the writers never emit bits the render did not produce, so asking for float on an 8-bit source still returns 8-bit.',
  },
  hdr: {
    type: 'object',
    description: 'Opt-in HDR raster export (Rec.2100 PQ, or a gain-map JPEG). Presence turns it on; every dial is optional.',
    properties: {
      peakNits: { type: 'number', description: 'Peak luminance ceiling in nits (default 1000).' },
      reach: { type: 'number', description: '0-100: how far down the lightness range the glow reaches (default 45).' },
      lift: { type: 'number', description: '0-100: how much darks are lifted (default 0 - darks stay dark).' },
      richness: { type: 'number', description: '0-100: colour-richness focus of the boost (default 40).' },
    },
    additionalProperties: false,
  },
  bleed: { type: 'string', description: "Print bleed, e.g. '3mm'. Grows the page past the trim so a trim that drifts still lands on artwork." },
  marks: { type: 'string', description: "Printer's marks to draw, comma-separated (e.g. 'crop,registration,colorbar,info')." },
  cuts: { type: 'number', description: 'Emit N frames of a timed tool as a contact sheet instead of the single playhead frame.' },
  imprint: { type: 'boolean', description: "Lolly's own pixel watermark on raster exports. ON by default - pass false to opt out." },
  durable: { type: 'boolean', description: 'Embed the durable Content Credential that survives re-encoding (opt-in, off by default).' },
};

type BuildLinkOpts = {
  format?: string; width?: number; height?: number; unit?: string; dpi?: number;
} & ReturnType<typeof exportSettings>;

/** The reserved-param half of a render request, in the shape serializeUrlState
 *  and RenderOpts both want. One reader, so the link and the file agree. */
function exportSettings(args: Record<string, unknown>): {
  depth?: 8 | 16 | 'float' | 'auto';
  hdr?: { peakNits: number; reach: number; lift: number; richness: number } | null;
  bleed?: string | null;
  marks?: string | null;
  cuts?: number | null;
  imprint?: boolean;
  durable?: boolean;
} {
  const rawDepth = args.depth == null ? null : String(args.depth);
  const depth = rawDepth === '8' ? 8 : rawDepth === '16' ? 16
    : rawDepth === 'float' ? 'float' : rawDepth === 'auto' ? 'auto' : undefined;

  // Presence is the switch; each dial falls back to the engine's own default so
  // `hdr: {}` means "HDR, your call on the look" rather than four zeroes.
  const h = args.hdr;
  const hdr = h && typeof h === 'object' ? (() => {
    const o = h as Record<string, unknown>;
    const num = (v: unknown, d: number): number => (typeof v === 'number' && isFinite(v) ? v : d);
    return {
      peakNits: num(o.peakNits, HDR_DEFAULTS.peakNits),
      reach: num(o.reach, HDR_DEFAULTS.reach),
      lift: num(o.lift, HDR_DEFAULTS.lift),
      richness: num(o.richness, HDR_DEFAULTS.richness),
    };
  })() : undefined;

  const cuts = typeof args.cuts === 'number' && args.cuts > 1 ? args.cuts : undefined;
  return {
    ...(depth !== undefined ? { depth } : {}),
    ...(hdr ? { hdr } : {}),
    ...(args.bleed ? { bleed: String(args.bleed) } : {}),
    ...(args.marks ? { marks: String(args.marks) } : {}),
    ...(cuts !== undefined ? { cuts } : {}),
    // Only an explicit false is an opt-out; absent means the default (on).
    ...(args.imprint === false ? { imprint: false } : {}),
    ...(args.durable === true ? { durable: true } : {}),
  };
}

export const TOOL_DEFS: McpToolDef[] = [
  ...(['compile', 'inspect', 'measure'] as const).map((verb): McpToolDef => ({
    name: `lolly_${verb}`,
    description: `${verb[0]!.toUpperCase()}${verb.slice(1)} a Lolly document without rasterising it.`,
    inputSchema: { type: 'object', properties: { toolId: RENDER_ARGS.toolId, inputs: RENDER_ARGS.inputs, ...TEMPLATE_ARGS, layerOperations: DESIGN_OPERATION_ARG, layerPatches: DESIGN_PATCH_ARG, document: { type: 'object' }, ...(verb === 'inspect' ? { file: FILE_ARG } : {}) }, additionalProperties: false },
  })),
  {
    name: 'lolly_validate',
    description: 'Validate tool inputs before compile or render. Returns path-specific errors, warnings and Design structure checks without drawing.',
    inputSchema: {
      type: 'object',
      properties: { toolId: RENDER_ARGS.toolId, inputs: RENDER_ARGS.inputs, ...TEMPLATE_ARGS, layerOperations: DESIGN_OPERATION_ARG, layerPatches: DESIGN_PATCH_ARG },
      required: ['toolId'],
      additionalProperties: false,
    },
  },
  {
    name: 'lolly_diff', description: 'Semantically diff two compiled Lolly documents or recipe query strings.',
    inputSchema: { type: 'object', properties: { a: {}, b: {} }, required: ['a', 'b'], additionalProperties: false },
  },
  {
    name: 'lolly_package', description: 'Package a compiled Lolly document into portable .lolly bytes.',
    inputSchema: { type: 'object', properties: { document: { type: 'object' } }, required: ['document'], additionalProperties: false },
  },
  {
    name: 'lolly_list_tools',
    description: 'List Lolly tools in the on-brand catalog. Filter by free-text q, status, category, format, or capability.',
    inputSchema: {
      type: 'object',
      properties: {
        q: { type: 'string', description: 'Free-text search over id/name/description.' },
        status: { type: 'string', enum: ['official', 'community', 'experimental'] },
        category: { type: 'string' },
        format: { type: 'string', description: 'Only tools that can output this format.' },
        capability: { type: 'string', description: 'Only tools requiring this capability.' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'lolly_describe_tool',
    description: "Get one tool's full input JSON Schema, templates/presets, supported formats, canvas size, status, and example invocations.",
    inputSchema: {
      type: 'object',
      properties: { toolId: RENDER_ARGS.toolId },
      required: ['toolId'],
      additionalProperties: false,
    },
  },
  {
    name: 'lolly_build_url',
    description: 'Build a shareable, editable lolly.tools link (and a raw render URL) for a tool + inputs, without rendering.',
    inputSchema: {
      type: 'object',
      properties: { toolId: RENDER_ARGS.toolId, inputs: RENDER_ARGS.inputs, ...TEMPLATE_ARGS, layerOperations: DESIGN_OPERATION_ARG, layerPatches: DESIGN_PATCH_ARG, format: RENDER_ARGS.format, width: RENDER_ARGS.width, height: RENDER_ARGS.height, unit: RENDER_ARGS.unit, dpi: RENDER_ARGS.dpi, ...EXPORT_ARGS },
      required: ['toolId'],
      additionalProperties: false,
    },
  },
  {
    name: 'lolly_render',
    description: 'Render a Lolly tool to an on-brand asset (PNG/SVG/PDF/…). Returns the image plus an editable lolly.tools link.',
    inputSchema: {
      type: 'object',
      properties: {
        ...RENDER_ARGS,
        ...TEMPLATE_ARGS,
        layerOperations: DESIGN_OPERATION_ARG,
        layerPatches: DESIGN_PATCH_ARG,
        ...EXPORT_ARGS,
        transparentBg: { type: 'boolean', description: 'Remove the background fill (alpha formats).' },
        convertPaths: { type: 'boolean', description: 'Outline text to vector paths in SVG/PDF (default on).' },
        background: { type: 'string', description: 'Override background colour.' },
        colorProfile: { type: 'string', description: "srgb | none | a CMYK press condition (e.g. 'fogra39')." },
        c2pa: { type: 'string', enum: ['off', '7', '30', '90', '365'], description: 'Stamp Content Credentials with the given cert lifetime (days).' },
        password: { type: 'string', description: 'Open-password for standard PDF export (never logged).' },
        link: { type: 'boolean', description: 'Also return the editable lolly.tools link (default true).' },
      },
      required: ['toolId'],
      additionalProperties: false,
    },
  },
  {
    name: 'lolly_transform',
    description: 'Run an on-device file utility (e.g. strip-data, compress-pdf) on a file you provide. Returns the transformed file. Never watermarked.',
    inputSchema: {
      type: 'object',
      properties: {
        toolId: RENDER_ARGS.toolId,
        file: FILE_ARG,
        inputs: RENDER_ARGS.inputs,
      },
      required: ['toolId', 'file'],
      additionalProperties: false,
    },
  },
  {
    name: 'lolly_redact',
    description:
      'Redact regions of an image, SVG or PDF on-device. Covered content is destroyed and the file rebuilt, ' +
      'not drawn over: the returned file has no metadata, no trailing bytes and, for a PDF, no text layer. ' +
      'Instructions are the same canonical string a Lolly share link carries, so one string can be applied to ' +
      'every file of an identical layout. The tool re-checks its own output and returns an error with nothing ' +
      'attached when a check fails. Not watermarked; Content Credentials only when resign is set.',
    inputSchema: {
      type: 'object',
      properties: {
        file: FILE_ARG,
        instructions: {
          type: 'string',
          description:
            'Canonical instruction string: a lolly.tools redact link, or just its query - e.g. ' +
            '"bars=1,40,60,200,24~1,40,100,120,14&quantise=1&grayscale=1". Bar fields are page,x,y,w,h: ' +
            "PDF bars in points from the page's top-left, image bars in pixels from the top-left.",
        },
        bars: {
          type: 'array',
          description: 'Bars as objects instead of a string. Merged over anything in `instructions`.',
          items: {
            type: 'object',
            properties: {
              page: { type: 'number', description: '1-based page (1 for a single image).' },
              x: { type: 'number' }, y: { type: 'number' }, w: { type: 'number' }, h: { type: 'number' },
            },
            required: ['x', 'y', 'w', 'h'],
            additionalProperties: true,
          },
        },
        quantise: { type: 'boolean', description: 'Round bar widths up to a coarse grid so width hints at length less (default on).' },
        grayscale: { type: 'boolean', description: 'Drop colour - removes colour-laser tracking dots from a scan.' },
        resign: { type: 'boolean', description: 'Opt in to a fresh Content Credential on the redacted copy (default off).' },
      },
      required: ['file'],
      additionalProperties: false,
    },
  },
  {
    name: 'lolly_verify',
    description: "Verify a file's Content Credentials (C2PA) on-device: was it genuinely made with Lolly, who signed it, and has it changed since export. Returns the verdict, signer identity, edit history, and embedded file metadata (EXIF/XMP) as text + JSON. Bytes in, verdict out - nothing leaves the server.",
    inputSchema: {
      type: 'object',
      properties: { file: FILE_ARG },
      required: ['file'],
      additionalProperties: false,
    },
  },
];

/** Tool ids are `[a-z0-9-]` slugs (matches resources.ts); reject anything else so a
 *  crafted id never reaches the loader (existence-probe / path leak). The resolver
 *  matches an id against the profile's own tool directories rather than joining it
 *  onto a path (paths.ts fetchToolFile), so this is the request-shape check it reads
 *  as, not the only thing between a crafted id and the filesystem. */
const TOOL_ID_RE = /^[a-z0-9-]+$/;

function textOnly(text: string): ToolCallResult {
  return { content: [{ type: 'text', text }] };
}

function errorResult(message: string): ToolCallResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

type InputValidationIssue = { path: string; message: string; id?: string; layerId?: string; artboardId?: string };
type InputValidationReport = {
  ok: boolean;
  errors: InputValidationIssue[];
  warnings: InputValidationIssue[];
  info: InputValidationIssue[];
  design?: ReturnType<typeof inspectDesignV1>;
};

function inputObject(value: unknown): Record<string, unknown> {
  if (value === undefined) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('inputs must be an object.');
  return value as Record<string, unknown>;
}

/** Template values first, explicit agent inputs last. One resolver for every verb. */
async function resolveInputs(
  toolId: string,
  manifest: ToolManifest,
  args: Record<string, unknown>,
): Promise<{ inputs: Record<string, unknown>; template?: { id: string; name: string; preset?: string } }> {
  const explicit = inputObject(args.inputs);
  const templateId = args.templateId;
  const presetId = args.presetId;
  const finish = (base: Record<string, unknown>): Record<string, unknown> =>
    applyDesignLayerPatches(
      toolId,
      manifest,
      applyDesignLayerOperations(toolId, manifest, base, args.layerOperations),
      args.layerPatches,
    );
  if (templateId === undefined) {
    if (presetId !== undefined) throw new Error('presetId requires templateId.');
    return { inputs: finish(explicit) };
  }
  if (typeof templateId !== 'string' || !templateId) throw new Error('templateId must be a non-empty string.');
  if (presetId !== undefined && (typeof presetId !== 'string' || !presetId)) throw new Error('presetId must be a non-empty string.');
  const seed = await loadTemplateSeed(toolId, templateId, presetId as string | undefined);
  return {
    inputs: finish({ ...seed.inputs, ...explicit }),
    template: { id: seed.template.id, name: seed.template.name, ...(seed.preset ? { preset: seed.preset.id } : {}) },
  };
}

type DesignRow = Record<string, unknown>;

function designRows(
  manifest: ToolManifest,
  inputs: Record<string, unknown>,
  argName: 'layerOperations' | 'layerPatches',
): unknown[] {
  const boxesInput = manifest.inputs?.find((input) => input.id === 'boxes' && input.type === 'blocks');
  const source = inputs.boxes ?? boxesInput?.default;
  if (!Array.isArray(source)) throw new Error(`${argName} requires a Design boxes array or template.`);
  return source.map((row) => row && typeof row === 'object' && !Array.isArray(row)
    ? { ...(row as DesignRow) }
    : row);
}

function rowAt(rows: unknown[], id: unknown, path: string): { index: number; row: DesignRow } {
  if (typeof id !== 'string' || !id.trim()) throw new Error(`${path}: a stable layer id is required.`);
  const matches = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => Boolean(row && typeof row === 'object' && !Array.isArray(row) && (row as DesignRow).id === id));
  if (matches.length !== 1)
    throw new Error(`${path}: layer "${id}" ${matches.length ? 'is duplicated' : 'does not exist'}.`);
  return matches[0] as { index: number; row: DesignRow };
}

function anchorOf(record: DesignRow, path: string): { side: 'before' | 'after'; id: string } {
  const before = record.beforeId;
  const after = record.afterId;
  if (before !== undefined && (typeof before !== 'string' || !before.trim()))
    throw new Error(`${path}/beforeId: a stable layer id is required.`);
  if (after !== undefined && (typeof after !== 'string' || !after.trim()))
    throw new Error(`${path}/afterId: a stable layer id is required.`);
  if ((before === undefined) === (after === undefined))
    throw new Error(`${path}: provide exactly one of beforeId or afterId.`);
  return before !== undefined
    ? { side: 'before', id: before as string }
    : { side: 'after', id: after as string };
}

function optionalAnchorOf(
  record: DesignRow,
  path: string,
): { side: 'before' | 'after'; id: string } | null {
  if (record.beforeId === undefined && record.afterId === undefined) return null;
  return anchorOf(record, path);
}

function assertNewDesignId(rows: unknown[], value: unknown, path: string): string {
  if (typeof value !== 'string' || !value.trim())
    throw new Error(`${path}: a new stable layer id is required.`);
  if (rows.some((row) => row && typeof row === 'object' && !Array.isArray(row) && (row as DesignRow).id === value))
    throw new Error(`${path}: layer "${value}" already exists.`);
  return value;
}

function sameReorderDomain(a: DesignRow, b: DesignRow): boolean {
  const aFrame = a.kind === 'frame';
  const bFrame = b.kind === 'frame';
  if (aFrame || bFrame) return aFrame && bFrame;
  return String(a.frame ?? '') === String(b.frame ?? '');
}

/** Move one row relative to a sibling and rewrite the renderer's actual order field:
 * `order` for artboards, `z` for layers in the same artboard/pasteboard. */
function reorderDesignRow(rows: unknown[], id: string, anchor: { side: 'before' | 'after'; id: string }, path: string): void {
  const target = rowAt(rows, id, `${path}/id`);
  const relative = rowAt(rows, anchor.id, `${path}/${anchor.side}Id`);
  if (target.index === relative.index) throw new Error(`${path}: a layer cannot be reordered relative to itself.`);
  if (!sameReorderDomain(target.row, relative.row))
    throw new Error(`${path}: reorder targets must be sibling layers or two artboards.`);

  const isFrame = target.row.kind === 'frame';
  const parent = String(target.row.frame ?? '');
  const domain = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) return false;
      const r = row as DesignRow;
      return isFrame ? r.kind === 'frame' : r.kind !== 'frame' && String(r.frame ?? '') === parent;
    })
    .sort((a, b) => {
      const field = isFrame ? 'order' : 'z';
      const av = typeof (a.row as DesignRow)[field] === 'number' ? (a.row as DesignRow)[field] as number : a.index;
      const bv = typeof (b.row as DesignRow)[field] === 'number' ? (b.row as DesignRow)[field] as number : b.index;
      return av - bv || a.index - b.index;
    })
    .map(({ row }) => row as DesignRow);
  const movingAt = domain.indexOf(target.row);
  domain.splice(movingAt, 1);
  const anchorAt = domain.indexOf(relative.row);
  domain.splice(anchorAt + (anchor.side === 'after' ? 1 : 0), 0, target.row);
  const field = isFrame ? 'order' : 'z';
  domain.forEach((row, index) => { row[field] = index; });

  // Keep the flat document's order aligned with the semantic order as well. Other
  // sibling domains stay in place; only the target crosses the named anchor.
  const [moving] = rows.splice(target.index, 1);
  const anchorNow = rows.indexOf(relative.row);
  rows.splice(anchorNow + (anchor.side === 'after' ? 1 : 0), 0, moving);
}

/** Strict, stateful Design mutations for agents. Operations run in array order, so
 * a later operation can address a layer added by an earlier one. */
function applyDesignLayerOperations(
  toolId: string,
  manifest: ToolManifest,
  inputs: Record<string, unknown>,
  value: unknown,
): Record<string, unknown> {
  if (value === undefined) return inputs;
  if (toolId !== 'design') throw new Error('layerOperations is available only for the Design tool.');
  if (!Array.isArray(value)) throw new Error('layerOperations must be an array.');
  const rows = designRows(manifest, inputs, 'layerOperations');
  const boxesInput = manifest.inputs?.find((input) => input.id === 'boxes' && input.type === 'blocks');
  const fieldDefault = (id: string, fallback: unknown): unknown =>
    boxesInput?.fields?.find((field) => field.id === id)?.default ?? fallback;

  for (let index = 0; index < value.length; index++) {
    const path = `/layerOperations/${index}`;
    const operation = value[index];
    if (!operation || typeof operation !== 'object' || Array.isArray(operation))
      throw new Error(`${path}: operation must be an object.`);
    const record = operation as DesignRow;
    const op = record.op;
    if (op !== 'add' && op !== 'duplicate' && op !== 'remove' && op !== 'reparent' && op !== 'reorder')
      throw new Error(`${path}/op: expected add, duplicate, remove, reparent or reorder.`);
    const allowed = new Set(
      op === 'add'
        ? ['op', 'layer', 'beforeId', 'afterId']
        : op === 'duplicate'
          ? ['op', 'id', 'newId', 'childIds', 'beforeId', 'afterId']
          : op === 'remove'
            ? ['op', 'id', 'cascade']
            : op === 'reparent'
              ? ['op', 'id', 'artboardId', 'beforeId', 'afterId']
              : ['op', 'id', 'beforeId', 'afterId']
    );
    const extra = Object.keys(record).find((key) => !allowed.has(key));
    if (extra) throw new Error(`${path}/${extra}: unknown ${op} field.`);

    if (op === 'add') {
      const valueLayer = record.layer;
      if (!valueLayer || typeof valueLayer !== 'object' || Array.isArray(valueLayer))
        throw new Error(`${path}/layer: a layer object is required.`);
      const supplied = valueLayer as DesignRow;
      const id = supplied.id;
      if (typeof id !== 'string' || !id.trim()) throw new Error(`${path}/layer/id: a stable layer id is required.`);
      if (rows.some((row) => row && typeof row === 'object' && !Array.isArray(row) && (row as DesignRow).id === id))
        throw new Error(`${path}/layer/id: layer "${id}" already exists.`);
      const layer: DesignRow = {
        kind: fieldDefault('kind', 'box'),
        x: fieldDefault('x', 120),
        y: fieldDefault('y', 120),
        w: fieldDefault('w', 320),
        h: fieldDefault('h', 200),
        ...supplied,
      };
      const hasAnchor = record.beforeId !== undefined || record.afterId !== undefined;
      if (!hasAnchor) rows.push(layer);
      else {
        const anchor = anchorOf(record, path);
        const relative = rowAt(rows, anchor.id, `${path}/${anchor.side}Id`);
        if (!sameReorderDomain(layer, relative.row))
          throw new Error(`${path}: an added layer and its anchor must be siblings or two artboards.`);
        rows.splice(relative.index + (anchor.side === 'after' ? 1 : 0), 0, layer);
        reorderDesignRow(rows, id, anchor, path);
      }
      continue;
    }

    if (op === 'duplicate') {
      const source = rowAt(rows, record.id, `${path}/id`);
      const newId = assertNewDesignId(rows, record.newId, `${path}/newId`);
      const anchor = optionalAnchorOf(record, path) ?? {
        side: 'after' as const,
        id: String(source.row.id),
      };
      const isFrame = source.row.kind === 'frame';
      const children = isFrame
        ? rows.filter((row) => row && typeof row === 'object' && !Array.isArray(row)
          && (row as DesignRow).kind !== 'frame'
          && (row as DesignRow).frame === source.row.id) as DesignRow[]
        : [];
      const childIdsValue = record.childIds;
      if (!isFrame && childIdsValue !== undefined)
        throw new Error(`${path}/childIds: only an artboard duplicate may supply child ids.`);
      if (childIdsValue !== undefined && (!childIdsValue || typeof childIdsValue !== 'object' || Array.isArray(childIdsValue)))
        throw new Error(`${path}/childIds: expected an old child id to new child id object.`);
      if (children.length && childIdsValue === undefined)
        throw new Error(`${path}/childIds: duplicating artboard "${String(source.row.id)}" requires a new id for each of its ${children.length} child layers.`);
      const childIds = (childIdsValue ?? {}) as Record<string, unknown>;
      const sourceChildIds = children.map((child, childIndex) => {
        const id = child.id;
        if (typeof id !== 'string' || !id.trim())
          throw new Error(`${path}/childIds: source child at index ${childIndex} has no stable id.`);
        return id;
      });
      const extraChild = Object.keys(childIds).find((id) => !sourceChildIds.includes(id));
      if (extraChild) throw new Error(`${path}/childIds/${extraChild}: source artboard has no child with this id.`);
      const proposed = [newId];
      const mappedChildIds = new Map<string, string>();
      for (const sourceId of sourceChildIds) {
        const mapped = childIds[sourceId];
        if (typeof mapped !== 'string' || !mapped.trim())
          throw new Error(`${path}/childIds/${sourceId}: a new stable layer id is required.`);
        proposed.push(mapped);
        mappedChildIds.set(sourceId, mapped);
      }
      const duplicateProposed = proposed.find((id, proposedIndex) => proposed.indexOf(id) !== proposedIndex);
      if (duplicateProposed)
        throw new Error(`${path}: new layer id "${duplicateProposed}" is used more than once.`);
      const collision = proposed.find((id) => rows.some((row) => row && typeof row === 'object'
        && !Array.isArray(row) && (row as DesignRow).id === id));
      if (collision)
        throw new Error(`${path}: layer "${collision}" already exists.`);

      const clone: DesignRow = { ...source.row, id: newId };
      rows.push(clone);
      reorderDesignRow(rows, newId, anchor, path);
      for (const child of children) {
        rows.push({
          ...child,
          id: mappedChildIds.get(String(child.id))!,
          frame: newId,
        });
      }
      continue;
    }

    if (op === 'remove') {
      const target = rowAt(rows, record.id, `${path}/id`);
      const children = target.row.kind === 'frame'
        ? rows.filter((row) => row && typeof row === 'object' && !Array.isArray(row) && (row as DesignRow).frame === target.row.id)
        : [];
      if (children.length && record.cascade !== true)
        throw new Error(`${path}/cascade: artboard "${String(target.row.id)}" has ${children.length} child layer${children.length === 1 ? '' : 's'}; pass cascade:true to remove them.`);
      const removeIds = new Set([target.row.id, ...children.map((row) => (row as DesignRow).id)]);
      for (let rowIndex = rows.length - 1; rowIndex >= 0; rowIndex--) {
        const row = rows[rowIndex];
        if (row && typeof row === 'object' && !Array.isArray(row) && removeIds.has((row as DesignRow).id)) rows.splice(rowIndex, 1);
      }
      continue;
    }

    if (op === 'reparent') {
      const target = rowAt(rows, record.id, `${path}/id`);
      if (target.row.kind === 'frame')
        throw new Error(`${path}/id: artboards cannot be reparented.`);
      const artboardId = record.artboardId;
      if (artboardId !== null && (typeof artboardId !== 'string' || !artboardId.trim()))
        throw new Error(`${path}/artboardId: expected an artboard stable id or null for the pasteboard.`);
      if (typeof artboardId === 'string') {
        const destination = rowAt(rows, artboardId, `${path}/artboardId`);
        if (destination.row.kind !== 'frame')
          throw new Error(`${path}/artboardId: layer "${artboardId}" is not an artboard.`);
      }
      target.row.frame = artboardId ?? '';
      const anchor = optionalAnchorOf(record, path);
      if (anchor) {
        reorderDesignRow(rows, String(target.row.id), anchor, path);
      } else {
        const parent = String(target.row.frame ?? '');
        const siblings = rows.filter((row) => row && typeof row === 'object' && !Array.isArray(row)
          && row !== target.row && (row as DesignRow).kind !== 'frame'
          && String((row as DesignRow).frame ?? '') === parent) as DesignRow[];
        target.row.z = siblings.reduce((max, sibling) =>
          Math.max(max, typeof sibling.z === 'number' ? sibling.z : -1), -1) + 1;
        const [moving] = rows.splice(target.index, 1);
        let lastSibling = -1;
        rows.forEach((row, rowIndex) => {
          if (siblings.includes(row as DesignRow)) lastSibling = rowIndex;
        });
        rows.splice(lastSibling >= 0 ? lastSibling + 1 : rows.length, 0, moving);
      }
      continue;
    }

    const id = record.id;
    if (typeof id !== 'string' || !id.trim()) throw new Error(`${path}/id: a stable layer id is required.`);
    reorderDesignRow(rows, id, anchorOf(record, path), path);
  }
  return { ...inputs, boxes: rows };
}

/** Stable-id edits are the small semantic delta an agent needs after choosing a
 * template. Geometry stays in the template; the patch can replace a headline,
 * image or other declared field without rebuilding a 99-field block row. */
function applyDesignLayerPatches(
  toolId: string,
  manifest: ToolManifest,
  inputs: Record<string, unknown>,
  value: unknown,
): Record<string, unknown> {
  if (value === undefined) return inputs;
  if (toolId !== 'design') throw new Error('layerPatches is available only for the Design tool.');
  if (!Array.isArray(value)) throw new Error('layerPatches must be an array.');
  const rows = designRows(manifest, inputs, 'layerPatches');
  for (let index = 0; index < value.length; index++) {
    const patch = value[index];
    if (!patch || typeof patch !== 'object' || Array.isArray(patch))
      throw new Error(`/layerPatches/${index}: patch must be an object.`);
    const record = patch as Record<string, unknown>;
    const extra = Object.keys(record).find((key) => key !== 'id' && key !== 'set');
    if (extra) throw new Error(`/layerPatches/${index}/${extra}: unknown patch field.`);
    const id = record.id;
    if (typeof id !== 'string' || !id) throw new Error(`/layerPatches/${index}/id: a stable layer id is required.`);
    const set = record.set;
    if (!set || typeof set !== 'object' || Array.isArray(set)) throw new Error(`/layerPatches/${index}/set: fields must be an object.`);
    if (Object.hasOwn(set, 'id')) throw new Error(`/layerPatches/${index}/set/id: a stable layer id cannot be changed.`);
    const match = rowAt(rows, id, `/layerPatches/${index}/id`);
    rows[match.index] = { ...match.row, ...(set as Record<string, unknown>) };
  }
  return { ...inputs, boxes: rows };
}

function validateToolInputs(manifest: ToolManifest, inputs: Record<string, unknown>): InputValidationReport {
  const base = validateDocument({ kind: 'inputs', manifest, value: inputs });
  const errors: InputValidationIssue[] = [...base.errors];
  const warnings: InputValidationIssue[] = [...base.warnings];
  const info: InputValidationIssue[] = [];
  let design: ReturnType<typeof inspectDesignV1> | undefined;
  if (manifest.id === 'design') {
    const model = buildInputModel(manifest, { initial: inputs as never });
    const boxes = model.find((item) => item.id === 'boxes')?.value;
    design = inspectDesignV1(boxes, { width: manifest.render.width, height: manifest.render.height });
    for (const item of design.findings) {
      const issue = {
        path: item.path,
        message: item.message,
        id: item.id,
        ...(item.layerId ? { layerId: item.layerId } : {}),
        ...(item.artboardId ? { artboardId: item.artboardId } : {}),
      };
      if (item.severity === 'error') errors.push(issue);
      else if (item.severity === 'warn') warnings.push(issue);
      else info.push(issue);
    }
  }
  return { ok: errors.length === 0, errors, warnings, info, ...(design ? { design } : {}) };
}

function invalidInputs(report: InputValidationReport): ToolCallResult {
  const summary = report.errors.map((item) => `${item.path}: ${item.message}`).join('\n');
  return errorResult(`Invalid inputs (${report.errors.length}):\n${summary}\n\nCall lolly_validate for the complete report.`);
}

function inspectCompiledDocument(document: any): Record<string, unknown> {
  const base = inspectDocument(document) as unknown as Record<string, unknown>;
  if (document?.toolId !== 'design') return base;
  return {
    ...base,
    design: inspectDesignV1(document?.values?.boxes, {
      width: document?.manifest?.render?.width,
      height: document?.manifest?.render?.height,
    }),
  };
}

/** Build the shareable query + URLs for a tool + inputs. */
function buildLinks(manifest: ToolManifest, inputs: Record<string, unknown>, o: BuildLinkOpts): { query: string; editUrl: string; renderUrl: string | null } {
  const model = buildInputModel(manifest, { initial: inputs as never });
  const query = serializeUrlState(model, {
    format: o.format ?? null,
    width: o.width ?? null,
    height: o.height ?? null,
    unit: o.unit ?? null,
    dpi: o.dpi ?? null,
    // The press setup and provenance choices ride the link too, so opening it
    // reproduces the file rather than a differently-configured cousin. They
    // also carry the browser tier's whole configuration: exportUrl() strips the
    // params it sets itself and passes the rest through untouched.
    bleed: o.bleed ?? null,
    marks: o.marks ?? null,
    cuts: o.cuts ?? null,
    depth: o.depth ?? null,
    // `hdr` serialises as a presence flag (`hdr=1`); the dials only exist on the
    // engine-side opts, so the link carries "HDR on" and the render carries how.
    hdr: o.hdr ? '1' : null,
    imprint: o.imprint,
    durable: o.durable,
  });
  const editUrl = query ? `${WEB_BASE}/#/tool/${manifest.id}?${query}` : `${WEB_BASE}/#/tool/${manifest.id}`;
  const renderUrl = buildEmbedUrl({ toolId: manifest.id, format: o.format ?? manifest.render.formats[0], query });
  return { query, editUrl, renderUrl };
}

/**
 * Turn a lolly_redact call into the tool's inputs. The instruction string is the
 * canonical one - a lolly.tools redact link or just its query - so the identical
 * string works as a share link, as `lolly redact --bars=…`, and here. Explicit
 * `bars`/`quantise`/`grayscale`/`resign` arguments win over the string, and the
 * file-typed input never comes from it (the bytes are the `file` argument).
 */
export async function redactInputs(manifest: ToolManifest, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const raw = String(args.instructions ?? '').trim();
  const query = raw.includes('?') ? raw.slice(raw.indexOf('?') + 1) : raw;
  const inputs: Record<string, unknown> = {};
  if (query) Object.assign(inputs, parseUrlState(await expandQuery(query), manifest).values);
  delete inputs[fileInputId(manifest) ?? 'source'];
  if (Array.isArray(args.bars)) inputs.bars = args.bars;
  for (const k of ['quantise', 'grayscale', 'resign']) {
    if (typeof args[k] === 'boolean') inputs[k] = args[k];
  }
  return inputs;
}

type ExampleVariant = { label?: string; theme?: string; values?: Record<string, unknown> };

/** Example looks for a tool: top-level `examples`, else the deprecated `featured.variants` alias.
 *  (Omit first: the SDK manifest type now declares `examples?: unknown[]`, and intersecting
 *  that with ExampleVariant[] made the element type collapse to unknown.) */
function exampleLooks(m: ToolManifest, cap: number): { label?: string; inputs?: Record<string, unknown> }[] {
  const t = m as Omit<ToolManifest, 'examples'> & { examples?: ExampleVariant[]; featured?: { variants?: ExampleVariant[] } };
  const ex = t.examples?.length ? t.examples : (t.featured?.variants ?? []);
  return ex.slice(0, cap).map(v => ({ ...(v.label ? { label: v.label } : {}), inputs: v.values }));
}

// Every claim/signer string is attacker-controlled bytes from the file being checked.
// Strip control characters so a crafted manifest can't smuggle escape sequences into
// the agent-facing report (same hygiene as shells/cli/src/validate.ts).
const clean = cleanControlChars;

type VerifyReport = Awaited<ReturnType<typeof verifyC2pa>>;

/**
 * The verdict slug + headline for each engine-resolved state now lives in the shared
 * Node package (packages/node-shell/src/verdict-slugs.ts) so this server and
 * `lolly validate --json` cannot answer the same question in two vocabularies. This
 * is the lesson the forked verdict LADDER already taught. Two quirks of this surface
 * survive the move, because they are properties of the shared table itself:
 *  • no partsMadeWithLolly headline (unlike the CLI, which elevates that flag): a
 *    parts file keeps reading 'credential-intact';
 *  • no separate "verified identity" slug (the web /valid has a "Verified" hero): the
 *    'trusted' state also reads 'credential-intact', with the identity carried in the
 *    report/resolved fields.
 */

function verifyVerdict(report: VerifyReport): { verdict: string; headline: string; resolved: C2paVerdict } {
  const resolved = resolveVerdict(report);
  return { ...VERDICT_SLUGS[resolved.state], resolved };
}

/** Human-readable verify report - the same facts `lolly validate` prints. */
function verifyText(name: string, report: VerifyReport, headline: string): string {
  const lines = [`${name}${report.format ? `  [${report.format}]` : ''}`, headline];
  if (report.reason && report.state !== 'invalid') lines.push(`  ${clean(report.reason)}`);
  if (report.claim && !report.madeWithLolly) {
    lines.push(report.trusted
      ? "  (fields below are the CA-verified signer's own claim)"
      : '  (fields below are self-asserted by whoever signed the file)');
  }
  // The claim facts come from the SHARED node-shell renderer (verdict-report.ts),
  // already scrubbed and filtered, so this server and `lolly validate` cannot drift
  // on the same file. The MCP-only "Edit history" block below is appended on top.
  for (const [k, v] of verdictFacts(report)) lines.push(`  ${k.padEnd(11)} ${v}`);
  const history = report.history ?? [];
  if (history.length) {
    lines.push('Edit history (incl. ingredient/parent manifests):');
    for (const h of history) {
      const who = h.softwareAgent || h.generator;
      lines.push(`  - ${clean(h.action)}${h.when ? ` @ ${clean(h.when)}` : ''}${who ? ` (${clean(who)})` : ''}${h.description ? ` - ${clean(h.description)}` : ''}`);
    }
  }
  for (const chk of verdictChecks(report)) {
    const mark = chk.mark === 'ok' ? '✓' : chk.mark === 'info' ? 'ℹ' : '✕';
    lines.push(`  ${mark} ${chk.code} - ${chk.explanation}`);
  }
  return lines.join('\n');
}

function c2paSetting(v: unknown): RenderOpts['c2pa'] {
  if (v === undefined || v === null) return null;
  const s = String(v).toLowerCase();
  if (s === 'off') return { on: false, days: null };
  const n = Number(s);
  return { on: true, days: [7, 30, 90, 365].includes(n) ? n : null };
}

export async function callTool(name: string, args: Record<string, unknown>): Promise<ToolCallResult> {
  try {
    switch (name) {
      case 'lolly_compile':
      case 'lolly_inspect':
      case 'lolly_measure': {
        if (name === 'lolly_inspect' && args.file && typeof args.file === 'object') {
          const file = args.file as { base64?: unknown };
          if (typeof file.base64 !== 'string') return errorResult('file.base64 is required.');
          return textOnly(JSON.stringify(inspectDocument(Uint8Array.from(Buffer.from(file.base64, 'base64'))), null, 2));
        }
        let document = args.document;
        if (name === 'lolly_compile' || !document) {
          const toolId = String(args.toolId ?? '');
          if (!toolId || !TOOL_ID_RE.test(toolId)) return errorResult('A valid toolId or document is required.');
          const tool = await loadToolCached(toolId).catch(() => null);
          if (!tool) return errorResult(`Tool not found: ${toolId}.`);
          const resolved = await resolveInputs(toolId, tool.manifest, args);
          const validation = validateToolInputs(tool.manifest, resolved.inputs);
          if (!validation.ok) return invalidInputs(validation);
          const compiled = await withHost({}, async (_dom, host) => compileDocument(tool, resolved.inputs as Record<string, never>, { host }));
          if (name === 'lolly_compile') return textOnly(JSON.stringify({ ...compiled, validation, ...(resolved.template ? { template: resolved.template } : {}) }, null, 2));
          document = compiled.document;
        }
        return textOnly(JSON.stringify(name === 'lolly_inspect' ? inspectCompiledDocument(document) : measureDocument(document as never), null, 2));
      }

      case 'lolly_validate': {
        const toolId = String(args.toolId ?? '');
        if (!toolId || !TOOL_ID_RE.test(toolId)) return errorResult('A valid toolId is required.');
        const tool = await loadToolCached(toolId).catch(() => null);
        if (!tool) return errorResult(`Tool not found: ${toolId}.`);
        const resolved = await resolveInputs(toolId, tool.manifest, args);
        const validation = validateToolInputs(tool.manifest, resolved.inputs);
        return textOnly(JSON.stringify({ ...validation, ...(resolved.template ? { template: resolved.template } : {}) }, null, 2));
      }

      case 'lolly_diff':
        return textOnly(JSON.stringify(diffDocuments(args.a as never, args.b as never), null, 2));

      case 'lolly_package': {
        const packed = await packageDocument(args.document);
        return { content: [{ type: 'text', text: JSON.stringify(packed.manifest) }, { type: 'resource', resource: { uri: 'data:application/vnd.lolly+zip;base64,' + Buffer.from(packed.bytes).toString('base64'), mimeType: 'application/vnd.lolly+zip', blob: Buffer.from(packed.bytes).toString('base64') } }] } as ToolCallResult;
      }

      case 'lolly_list_tools': {
        const tools = await listTools(args as never);
        const lines = tools.map(t => `• ${t.id} - ${t.name} [${t.status}] · formats: ${(t.formats ?? []).join(', ')} · ${t.width}×${t.height}`);
        const summary = `${tools.length} tool(s):\n${lines.join('\n')}`;
        return {
          content: [
            { type: 'text', text: summary },
            { type: 'text', text: JSON.stringify(tools.map(t => ({ id: t.id, name: t.name, description: t.description, status: t.status, formats: t.formats, width: t.width, height: t.height, exportable: t.exportable })), null, 2) },
          ],
        };
      }

      case 'lolly_describe_tool': {
        const toolId = String(args.toolId ?? '');
        if (!toolId) return errorResult('toolId is required.');
        if (!TOOL_ID_RE.test(toolId)) return errorResult(`Invalid toolId: ${toolId}. Use lolly_list_tools.`);
        const tool = await loadToolCached(toolId).catch(() => null);
        if (!tool) return errorResult(`Tool not found: ${toolId}. Use lolly_list_tools.`);
        const m = tool.manifest;
        const schema = toolInputSchema(m);
        const examples = exampleLooks(m, 2);
        const templates = await listToolTemplates(toolId);
        const doc = {
          id: m.id, name: m.name, description: m.description, status: m.status, version: m.version,
          formats: m.render.formats, width: m.render.width, height: m.render.height,
          transform: Boolean(m.hooks?.exportFile),
          note: m.status === 'experimental' ? 'Experimental - exports are watermarked.' : undefined,
          inputSchema: schema,
          examples,
          templates,
          workflow: templates.length
            ? 'Prefer templateId + optional presetId. For Design, inspect once, use layerOperations to add/duplicate/remove/reparent/reorder and layerPatches for stable-id field edits; validate before render.'
            : 'Validate inputs before render.',
        };
        return textOnly(JSON.stringify(doc, null, 2));
      }

      case 'lolly_build_url': {
        const toolId = String(args.toolId ?? '');
        if (!toolId) return errorResult('toolId is required.');
        if (!TOOL_ID_RE.test(toolId)) return errorResult(`Invalid toolId: ${toolId}.`);
        const tool = await loadToolCached(toolId).catch(() => null);
        if (!tool) return errorResult(`Tool not found: ${toolId}.`);
        const resolved = await resolveInputs(toolId, tool.manifest, args);
        const inputs = resolved.inputs;
        const validation = validateToolInputs(tool.manifest, inputs);
        if (!validation.ok) return invalidInputs(validation);
        // Read through the same door lolly_render uses, so a link built here
        // and a file rendered there from the same arguments agree.
        const links = buildLinks(tool.manifest, inputs, {
          format: args.format as string | undefined,
          width: args.width as number | undefined,
          height: args.height as number | undefined,
          unit: args.unit as string | undefined,
          dpi: args.dpi as number | undefined,
          ...exportSettings(args),
        });
        const check = validation.design && validation.warnings.length
          ? `\n\nDesign check: ${validation.warnings.length} warning(s). Call lolly_validate for details.`
          : '';
        return textOnly(`Editable link:\n${links.editUrl}\n\nRaw render URL:\n${links.renderUrl ?? '(unavailable)'}${check}`);
      }

      case 'lolly_render': {
        const toolId = String(args.toolId ?? '');
        if (!toolId) return errorResult('toolId is required.');
        if (!TOOL_ID_RE.test(toolId)) return errorResult(`Invalid toolId: ${toolId}. Use lolly_list_tools.`);
        const tool = await loadToolCached(toolId).catch(() => null);
        if (!tool) return errorResult(`Tool not found: ${toolId}. Use lolly_list_tools.`);
        const resolved = await resolveInputs(toolId, tool.manifest, args);
        const inputs = resolved.inputs;
        const validation = validateToolInputs(tool.manifest, inputs);
        if (!validation.ok) return invalidInputs(validation);
        const opts: RenderOpts = {
          format: args.format as string | undefined,
          width: args.width as number | undefined,
          height: args.height as number | undefined,
          unit: args.unit as string | undefined,
          dpi: args.dpi as number | undefined,
          background: args.background as string | undefined,
          colorProfile: args.colorProfile as string | undefined,
          transparentBg: args.transparentBg as boolean | undefined,
          convertPaths: args.convertPaths as boolean | undefined,
          password: args.password as string | undefined,
          c2pa: c2paSetting(args.c2pa),
          ...exportSettings(args),
        };
        const links = buildLinks(tool.manifest, inputs, opts);
        const result = await render(toolId, links.query, opts);

        const provenance = [
          tool.manifest.status === 'experimental' ? 'watermarked (experimental tool)' : 'not watermarked',
          result.warnings.length ? `warnings: ${result.warnings.join('; ')}` : '',
          validation.design && validation.warnings.length ? `design check: ${validation.warnings.length} warning(s)` : '',
        ].filter(Boolean).join(' · ');

        const header = [
          `Rendered ${toolId} → ${result.format} (${result.bytes.length} bytes, tier ${result.tier}).`,
          args.link === false ? '' : `Edit: ${links.editUrl}`,
          `Provenance: ${provenance}`,
        ].filter(Boolean).join('\n');

        const content: ContentBlock[] = [{ type: 'text', text: header }];
        const b64 = Buffer.from(result.bytes).toString('base64');
        const fmt = normFormat(result.format);
        const RASTER = ['png', 'jpg', 'webp', 'avif', 'gif', 'apng'];
        if (RASTER.includes(fmt)) {
          content.push({ type: 'image', data: b64, mimeType: result.mime });
        } else if (fmt === 'svg') {
          // SVG: give a viewable PNG preview + the SVG source as a resource.
          try {
            const preview = await render(toolId, links.query, { ...opts, format: 'png' });
            content.push({ type: 'image', data: Buffer.from(preview.bytes).toString('base64'), mimeType: 'image/png' });
          } catch { /* preview is best-effort */ }
          content.push({ type: 'resource', resource: { uri: `${links.renderUrl ?? `lolly://render/${toolId}.svg`}`, mimeType: 'image/svg+xml', text: new TextDecoder().decode(result.bytes) } });
        } else if (isTextFormat(fmt)) {
          content.push({ type: 'resource', resource: { uri: links.renderUrl ?? `lolly://render/${toolId}.${fmt}`, mimeType: result.mime, text: new TextDecoder().decode(result.bytes) } });
        } else {
          content.push({ type: 'resource', resource: { uri: links.renderUrl ?? `lolly://render/${toolId}.${fmt}`, mimeType: result.mime, blob: b64 } });
        }
        return { content };
      }

      case 'lolly_transform': {
        const toolId = String(args.toolId ?? '');
        const file = args.file as { base64?: string; name?: string; mime?: string } | undefined;
        if (!toolId) return errorResult('toolId is required.');
        if (!TOOL_ID_RE.test(toolId)) return errorResult(`Invalid toolId: ${toolId}. Use lolly_list_tools.`);
        if (!file?.base64) return errorResult('file.base64 is required.');
        const inputs = (args.inputs as Record<string, unknown>) ?? {};
        const res = await transform(toolId, { base64: file.base64, name: file.name, mime: file.mime }, inputs);
        return {
          content: [
            { type: 'text', text: `Transformed ${file.name ?? 'file'} → ${res.filename} (${res.bytes.length} bytes, tier ${res.tier}). Not watermarked; no provenance added.` },
            { type: 'resource', resource: { uri: `lolly://transform/${res.filename}`, mimeType: res.mime, blob: Buffer.from(res.bytes).toString('base64') } },
          ],
        };
      }

      case 'lolly_redact': {
        const file = args.file as { base64?: string; name?: string; mime?: string } | undefined;
        if (!file?.base64) return errorResult('file.base64 is required.');
        const tool = await loadToolCached('redact').catch(() => null);
        if (!tool) return errorResult('The redact tool is not in this catalog.');
        const inputs = await redactInputs(tool.manifest, args);
        const bars = inputs.bars;
        if (!Array.isArray(bars) || bars.length === 0) {
          return errorResult(
            'No redaction bars given. Pass `instructions` (e.g. "bars=1,40,60,200,24") or a `bars` array - ' +
            'a redaction with no bars would just re-encode the file.',
          );
        }
        const res = await transform('redact', { base64: file.base64, name: file.name, mime: file.mime }, inputs);
        const notes = [
          `Redacted ${file.name ?? 'file'} → ${res.filename} (${res.bytes.length} bytes, tier ${res.tier}).`,
          `${bars.length} bar${bars.length === 1 ? '' : 's'} applied. The tool rebuilt the file and re-checked its own output; ` +
          'nothing is returned unless those checks pass.',
          inputs.resign === true
            ? 'Signed as a redacted derivative (fresh Content Credential, no ingredients).'
            : 'Not watermarked; no provenance added.',
          'Covered content is destroyed, not hidden. Invisible whole-image watermarks are unaffected, and this tool cannot detect whether one is present.',
        ];
        return {
          content: [
            { type: 'text', text: notes.join('\n') },
            { type: 'resource', resource: { uri: `lolly://redact/${res.filename}`, mimeType: res.mime, blob: Buffer.from(res.bytes).toString('base64') } },
          ],
        };
      }

      case 'lolly_verify': {
        const file = args.file as { base64?: string; name?: string; mime?: string } | undefined;
        if (!file?.base64) return errorResult('file.base64 is required.');
        const bytes = Uint8Array.from(Buffer.from(file.base64, 'base64'));
        // The Lolly CA root + the vendored C2PA trust list - the SAME anchor set
        // the web /valid view and `lolly validate` use (plans/73-cli-ga-contract.md
        // section 12 O1, Andy 2026-08-01). It used to be vendored-only here, so a
        // Lolly-CA-signed export read as a CA-verified identity on the web and
        // plain intact through this tool: one word, two meanings, depending on
        // which surface asked. This tool has no argv, so there is no
        // `--no-default-anchors` twin; the bare-trust check is a CLI affordance.
        // Deliberately NOT reading LOLLY_TRUST_ANCHOR or a caller-supplied pin here,
        // unlike the two terminal shells: this server is a hosted, multi-tenant
        // surface, where a server-side env anchor would silently vouch for one
        // tenant's roots on every other tenant's file. The built-in set only.
        const report = await verifyC2pa(bytes, { trustAnchors: defaultTrustAnchors({ includeLollyRoot: true }) });
        let metadata: ReturnType<typeof extractFileMetadata> | null = null;
        try { metadata = extractFileMetadata(bytes); } catch { /* best-effort - the verdict stands alone */ }
        const { verdict, headline, resolved } = verifyVerdict(report);
        return {
          content: [
            { type: 'text', text: verifyText(file.name ?? 'file', report, headline) },
            // `verdict` (legacy slug) and `report` are the compatibility surface.
            // Shapes unchanged; `resolved` is ADDITIVE: the engine's semantic
            // verdict (state/tone + the flags that drove it) from resolveVerdict.
            { type: 'text', text: JSON.stringify({ verdict, resolved, report, metadata }, null, 2) },
          ],
        };
      }

      default:
        return errorResult(`Unknown tool: ${name}`);
    }
  } catch (e) {
    return errorResult(`${name} failed: ${(e as Error).message}`);
  }
}

export async function serverInstructions(): Promise<string> {
  const { tools } = await loadIndex();
  return (
    `Lolly MCP server (engine ${ENGINE_VERSION}) - generate on-brand SUSE creative assets. ` +
    `${tools.length} tools available. Workflow: lolly_list_tools → lolly_describe_tool → lolly_validate → lolly_render. ` +
    `Use lolly_build_url for a shareable/editable link without rendering, lolly_transform for on-device file utilities, ` +
    `lolly_redact to destroy regions of an image/SVG/PDF from one reusable instruction string, ` +
    `and lolly_verify to check a file's Content Credentials (C2PA). ` +
    `Brand assets, tokens, and tool docs are available as resources (lolly://catalog, lolly://assets, lolly://tool/{id}, ` +
    `lolly://tool/{id}/preview, lolly://asset/{id}, lolly://tokens).`
  );
}

// ── Prompts - catalog-derived guided invocations (server.ts prompts/*) ────────
// One prompt per featured tool plus a generic guided workflow, all derived from
// the live catalog at request time (no hardcoded tool lists). New tools get
// prompts for free when they're featured.

export interface McpPromptArg { name: string; description?: string; required?: boolean }
export interface McpPromptDef { name: string; description?: string; arguments?: McpPromptArg[] }
export interface McpPromptMessage { role: 'user' | 'assistant'; content: ContentBlock }
export interface McpPromptResult { description?: string; messages: McpPromptMessage[] }

const GENERIC_PROMPT = 'create-branded-asset';

const GENERIC_PROMPT_DEF: McpPromptDef = {
  name: GENERIC_PROMPT,
  description: 'Guided workflow: turn a plain-language brief into an on-brand asset with the right Lolly tool.',
  arguments: [
    { name: 'brief', description: 'What to make, in plain language (content, audience, occasion).', required: true },
    { name: 'format', description: 'Preferred output format (e.g. svg, png, pdf).' },
  ],
};

async function toolPromptDef(toolId: string): Promise<McpPromptDef> {
  const { manifest: m } = await loadToolCached(toolId);
  const schema = toolInputSchema(m);
  const props = (schema.properties ?? {}) as Record<string, { description?: string }>;
  const required = new Set((schema.required as string[] | undefined) ?? []);
  // Required inputs first (stable within groups), capped so the prompt stays a
  // small form. The message itself points at lolly_describe_tool for the rest.
  const ids = Object.keys(props).sort((a, b) => Number(required.has(b)) - Number(required.has(a)));
  const promptArgs: McpPromptArg[] = ids.slice(0, 10).map(pid => ({
    name: pid,
    ...(props[pid]?.description ? { description: props[pid]!.description } : {}),
    ...(required.has(pid) ? { required: true } : {}),
  }));
  const featured = (m as { featured?: { blurb?: string } }).featured;
  return {
    name: m.id,
    description: featured?.blurb || m.description || m.name,
    ...(promptArgs.length ? { arguments: promptArgs } : {}),
  };
}

export async function listPrompts(): Promise<McpPromptDef[]> {
  const { tools } = await loadIndex();
  const prompts: McpPromptDef[] = [GENERIC_PROMPT_DEF];
  for (const t of tools.filter(t => t.featured)) {
    // A featured tool whose manifest fails to load just drops out of the list.
    const def = await toolPromptDef(t.id).catch(() => null);
    if (def) prompts.push(def);
  }
  return prompts;
}

/** Resolve one prompt to its messages. Returns null for an unknown name. */
export async function getPrompt(name: string, args: Record<string, string> = {}): Promise<McpPromptResult | null> {
  if (name === GENERIC_PROMPT) {
    const { tools } = await loadIndex();
    const listing = tools.map(t => `• ${t.id} - ${t.name}${t.description ? `: ${t.description}` : ''}`).join('\n');
    const head = [
      "You are creating an on-brand asset with Lolly (the brand's constraint-first asset generator).",
      args.brief ? `Brief: ${args.brief}` : 'No brief was provided - ask the user what they need first.',
      ...(args.format ? [`Preferred format: ${args.format}`] : []),
    ].join('\n');
    const text =
      `${head}\n\nWorkflow:\n` +
      '1. Pick the best-fitting tool from the catalog below (or call lolly_list_tools to search).\n' +
      '2. Call lolly_describe_tool with its toolId for the exact input schema and examples.\n' +
      '3. Call lolly_validate with the toolId and inputs; correct every error.\n' +
      '4. Call lolly_render with the toolId, your inputs, and a supported format.\n' +
      '5. Share the returned editable lolly.tools link so the user can fine-tune the result.\n\n' +
      `Catalog:\n${listing}`;
    return { description: GENERIC_PROMPT_DEF.description, messages: [{ role: 'user', content: { type: 'text', text } }] };
  }

  if (!TOOL_ID_RE.test(name)) return null;
  const tool = await loadToolCached(name).catch(() => null);
  if (!tool) return null;
  // Only featured tools are LISTED, but any valid tool id resolves. A client's
  // pinned prompt keeps working if curation changes.
  const m = tool.manifest;
  const looks = exampleLooks(m, 3);
  const given = Object.entries(args).filter(([, v]) => v !== undefined && v !== '');
  const text = [
    `Create an on-brand asset with the Lolly tool "${m.id}" (${m.name}).`,
    ...(m.description ? [m.description] : []),
    '',
    'Steps:',
    `1. Call lolly_describe_tool with toolId "${m.id}" for the exact input JSON Schema.`,
    `2. Choose inputs${looks.length ? " - example looks that show the tool's range:" : '.'}`,
    ...(looks.length ? [JSON.stringify(looks, null, 2)] : []),
    `3. Call lolly_validate with toolId "${m.id}" and the chosen inputs; correct every error.`,
    `4. Call lolly_render with toolId "${m.id}" and a format from: ${m.render.formats.join(', ')}.`,
    ...(given.length ? ['', 'User-provided inputs to honour:', JSON.stringify(Object.fromEntries(given), null, 2)] : []),
  ].join('\n');
  const featured = (m as { featured?: { blurb?: string } }).featured;
  return {
    description: featured?.blurb || m.description || m.name,
    messages: [{ role: 'user', content: { type: 'text', text } }],
  };
}
