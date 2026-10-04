// SPDX-License-Identifier: MPL-2.0
/**
 * The live tools (plans/289 D1): an agent working in the Design document the person
 * has open, in the desktop app or a browser tab. Listed only by the local stdio
 * server, which passes a LiveBridge in the dispatch context; the hosted server has
 * none, so it neither lists nor answers them.
 *
 * Every edit becomes one ordinary, labelled undo step in the person's editor, and
 * the agent can undo only its own newest step. Text in the document is data: these
 * tools never run anything they read.
 */

import { lookAt, regionText, sourceFromBytes, unitsText } from '@lolly-tools/node-shell/look';
import type { ViewRegion } from '@lolly/engine';
import type { ToolCallResult } from './protocol.ts';
import type { LiveBridge, LiveStatus } from './live-bridge.ts';
import { contentImageRoots, fontsDir } from './paths.ts';

const REGION = {
  type: 'object',
  description: 'A rectangle in document units (x, y, w, h). Left out for the whole document.',
  properties: { x: { type: 'number' }, y: { type: 'number' }, w: { type: 'number' }, h: { type: 'number' } },
  required: ['x', 'y', 'w', 'h'],
  additionalProperties: false,
};

export const LIVE_TOOLS = [
  {
    name: 'lolly_live_connect',
    description: 'Connect to the Design document the person has open in Lolly, so you can read it, edit it and look at it while they watch. '
      + 'In the desktop app this connects at once when the person has turned on Allow AI control. In a browser it returns a pairing code: '
      + 'ask the person to open Design, choose Connect an AI agent in the Lolly menu and type the code, then call lolly_live_status with wait.',
    inputSchema: {
      type: 'object',
      properties: {
        surface: { type: 'string', enum: ['auto', 'desktop', 'web'], description: 'auto (the default) tries the desktop app first.' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'lolly_live_status',
    description: 'Whether an editor is connected, and the pairing code while one is awaited. With wait, waits up to that many seconds for the person to pair.',
    inputSchema: { type: 'object', properties: { wait: { type: 'number', minimum: 0, maximum: 120 } }, additionalProperties: false },
  },
  {
    name: 'lolly_live_document',
    description: 'The open Design document: its rows (layers, with the stable ids that layerOperations and layerPatches address), canvas size, the person\'s selection and a revision string.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'lolly_live_apply',
    description: 'Edit the open document with layerOperations (add, duplicate, remove, reparent, reorder) and layerPatches ({ id, set }), the same vocabulary lolly_render takes. '
      + 'All of it applies as ONE undo step labelled with your label, or none of it does. Pass ifRevision from lolly_live_document to refuse the edit if the person changed the document since.',
    inputSchema: {
      type: 'object',
      properties: {
        layerOperations: { type: 'array', items: { type: 'object' } },
        layerPatches: { type: 'array', items: { type: 'object' } },
        label: { type: 'string', maxLength: 80, description: 'What the edit does, shown in the person\'s history (for example "Align the headings").' },
        ifRevision: { type: 'string' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'lolly_live_look',
    description: 'Look at the open document as it renders now, with a labelled grid in document units, or at one region enlarged. For looking only; nothing is exported.',
    inputSchema: {
      type: 'object',
      properties: {
        grid: { description: 'Grid spacing in document units; true (the default) picks one, false or 0 draws none.', oneOf: [{ type: 'number', minimum: 0 }, { type: 'boolean' }] },
        region: REGION,
        maxSide: { type: 'number', minimum: 128, maximum: 2048 },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'lolly_live_undo',
    description: 'Undo your own newest edit. Refused when the newest change in the person\'s history is not yours.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'lolly_live_disconnect',
    description: 'End the connection. The person can also end it from the editor at any time.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
] as const;

const text = (t: string): ToolCallResult => ({ content: [{ type: 'text', text: t }] });
const failure = (t: string): ToolCallResult => ({ content: [{ type: 'text', text: t }], isError: true });

export function statusText(s: LiveStatus): string {
  if (s.state === 'connected') {
    const where = s.surface === 'desktop' ? 'the Lolly app' : 'a browser tab';
    return `Connected to ${where}${s.editor?.tool ? `, ${s.editor.tool} open (engine ${s.editor.engine})` : ''}. `
      + 'Read the document with lolly_live_document, edit with lolly_live_apply, check with lolly_live_look.';
  }
  if (s.state === 'pairing') {
    return `Waiting for the person to pair. Ask them to open Design in Lolly, choose Connect an AI agent in the Lolly menu, and type this code: ${s.code}\n`
      + 'Then call lolly_live_status with wait (up to 120 seconds). The code works once.';
  }
  return `Not connected.${s.ended ? ` ${s.ended}` : ''} Call lolly_live_connect to start.`;
}

export async function callLiveTool(bridge: LiveBridge, name: string, args: Record<string, unknown>): Promise<ToolCallResult> {
  try {
    switch (name) {
      case 'lolly_live_connect': {
        const surface = args.surface === 'desktop' || args.surface === 'web' ? args.surface : 'auto';
        return text(statusText(await bridge.connect(surface)));
      }
      case 'lolly_live_status': {
        const wait = Math.min(120, Math.max(0, Number(args.wait) || 0));
        return text(statusText(await bridge.waitConnected(wait * 1000)));
      }
      case 'lolly_live_document': {
        const doc = await bridge.request('document.get') as { rows?: unknown[]; width?: number; height?: number; selection?: string[] };
        const summary = `${doc.rows?.length ?? 0} rows, canvas ${doc.width} x ${doc.height}, ${doc.selection?.length ? `selected: ${doc.selection.join(', ')}` : 'nothing selected'}.`;
        return { content: [{ type: 'text', text: summary }, { type: 'text', text: JSON.stringify(doc, null, 2) }] };
      }
      case 'lolly_live_apply': {
        const params: Record<string, unknown> = {};
        for (const key of ['layerOperations', 'layerPatches', 'label', 'ifRevision']) if (args[key] !== undefined) params[key] = args[key];
        const result = await bridge.request('document.apply', params) as { changed?: boolean; revision?: string; layers?: number };
        return text(result.changed
          ? `Applied as one undo step. The document has ${result.layers} rows; revision ${result.revision}.`
          : `Nothing changed; no undo step was made. Revision ${result.revision}.`);
      }
      case 'lolly_live_look': {
        const view = await bridge.request('look') as { svg?: unknown };
        if (typeof view?.svg !== 'string') return failure('lolly_live_look: the editor returned no picture.');
        const source = await sourceFromBytes(Buffer.from(view.svg, 'utf8'), 'image/svg+xml', contentImageRoots(), 'the open document');
        if ('error' in source) return failure(`lolly_live_look: ${source.error}`);
        const look = await lookAt(source, { region: args.region as Partial<ViewRegion> | undefined, grid: args.grid as number | boolean | undefined, maxSide: args.maxSide as number | undefined }, { fontDirs: [fontsDir()], areaCap: 16_000_000 });
        const lines = [
          `Looking at the open document: ${regionText(source.frame)}.`,
          `Showing ${look.whole ? 'the whole document' : `region ${regionText(look.region)}`} at ${look.width} x ${look.height} px.`,
          look.spacing ? `Grid every ${Math.round(look.spacing * 10) / 10} units, numbered on the top and left edges.` : 'No grid.',
          unitsText(source.units),
        ];
        return { content: [{ type: 'text', text: lines.join('\n') }, { type: 'image', data: Buffer.from(look.png).toString('base64'), mimeType: 'image/png' }] };
      }
      case 'lolly_live_undo':
        await bridge.request('history.undo');
        return text('Your newest edit was undone.');
      case 'lolly_live_disconnect':
        bridge.close();
        return text('Disconnected.');
      default:
        return failure(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return failure(`${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
