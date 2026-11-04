// SPDX-License-Identifier: MPL-2.0
/**
 * Design import → a saved Design session. Reads a PDF/.ai from disk, turns its
 * first page into editable boxes (import/pdf.ts), seeds a design runtime, and
 * saves the serialised state as a project - which then opens in the ToolView like any
 * other saved session (fully re-editable). Terminal scope is PDF/.ai; IDML/Penpot stay
 * a web feature (they need a DOM/canvas the Node shell doesn't have).
 */
import { sessionRightsDecisions, sessionEmojiStamp } from '../../../engine/src/session-record.ts';
import { randomUUID } from 'node:crypto';
import { readLollyFile } from '@lolly-tools/node-shell/lolly-file';
import { readFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import { homedir } from 'node:os';
import { parsePdfBytes } from './import/pdf.ts';
import { mountTool, currentQuery, modelValues, type Manifest } from './engine-render.ts';
import type { SavedSession } from './store.ts';
import { saveSession } from './store.ts';
import type { DesignMapOptions } from '@lolly/engine';
import type { HostV1 } from '@lolly-tools/core/host-v1';

const expandHome = (p: string): string => (p.startsWith('~') && (p.length === 1 || p[1] === '/') ? homedir() + p.slice(1) : p);

export interface ImportedSession extends SavedSession { boxes: number }
export interface ImportOptions { acceptLossy?: boolean; page?: number }
export interface ImportResult { error?: string; review?: { warnings: string[]; page: number; pageCount: number } }
export class ImportReviewRequired extends Error {
  readonly warnings: string[];
  readonly page: number;
  readonly pageCount: number;
  constructor(warnings: string[], page: number, pageCount: number) { super(warnings.join(' ')); this.warnings = warnings; this.page = page; this.pageCount = pageCount; }
}

/** Brand vocabulary for the importer (engine DesignMapOptions), derived from the
 *  target tool's OWN manifest - its font select wire values + addKinds seed colours
 * - mirroring the web shell's importMap (free-canvas.ts) so a TUI import emits the
 *  same boxes as a web import under any profile (SUSE: 'SUSE'/'SUSE Mono' + its
 *  seeds; lolly-start: 'sans'/'mono'). Fields the manifest doesn't declare stay
 *  undefined → the engine's neutral defaults apply. */
export function designMapFromManifest(manifest: Manifest): DesignMapOptions {
  const input = (manifest.inputs || []).find((i) => i.type === 'blocks' && i.canvas);
  const cv = (input?.canvas || {}) as Record<string, unknown>;
  const fontField = typeof cv.fontField === 'string' ? cv.fontField : '';
  const fieldDef = fontField ? (input?.fields || []).find((f) => f.id === fontField) : undefined;
  const options = (fieldDef?.options || [])
    .map((o) => ({ value: String(o.value ?? ''), label: String(o.label ?? o.value ?? '') }));
  const defaultFamily = String(fieldDef?.default ?? '') || options[0]?.value;
  // Mono detection mirrors free-canvas.ts isMonoFont: /mono/i on the wire value, or
  // on the label when values don't self-describe. Mono cuts rarely ship a Black, so
  // the mono ceiling is 800 (same cap the web editor applies).
  const monoOpt = options.find((o) => /mono/i.test(o.value) || /mono/i.test(o.label));
  const addKinds = Array.isArray(cv.addKinds)
    ? (cv.addKinds as Array<{ id?: unknown; seed?: Record<string, unknown> }>) : [];
  // '' is a real seed value (transparent fill), so only a missing/non-string seed
  // defers to the engine default - same rule as the web importMap.
  const seedColor = (kindId: string, field: string): string | undefined => {
    const seed = addKinds.find((k) => k.id === kindId)?.seed;
    const v = seed ? seed[field] : undefined;
    return typeof v === 'string' ? v : undefined;
  };
  const fillField = (typeof cv.fillField === 'string' && cv.fillField) || 'bg';
  const textColorField = (typeof cv.textColorField === 'string' && cv.textColorField) || 'fg';
  return {
    ...(defaultFamily ? {
      fonts: {
        defaultFamily,
        ...(monoOpt ? { monoFamily: monoOpt.value, monoMaxWeight: 800 } : {}),
      },
    } : {}),
    seedColors: {
      boxBg: seedColor('box', fillField),
      textFg: seedColor('text', textColorField) || undefined, // text ink must be a colour
      imageBg: seedColor('image', fillField),
    },
  };
}

/** Import a PDF/.ai file → a saved Design project. Returns the session so the
 *  caller can open it immediately. Throws a user-facing message on any failure. */
export async function importDesignFile(path: string, host: HostV1, options: ImportOptions = {}): Promise<ImportedSession> {
  const ext = extname(path).toLowerCase();
  if (!['.pdf', '.ai', '.lolly', '.json'].includes(ext)) throw new Error('Open a saved .lolly/.json document, or import a PDF/.ai page.');
  const bytes = new Uint8Array(await readFile(expandHome(path)));
  if (ext === '.lolly' || ext === '.json') {
    const file = ext === '.lolly' ? readLollyFile(bytes) : null;
    if (file?.manifest.assets?.some(asset => typeof asset.path === 'string') || file?.manifest.fonts?.length) throw new Error('This document carries media or fonts. Open it in the web or desktop app to import those resources.');
    const raw: unknown = file ? file.session : JSON.parse(new TextDecoder().decode(bytes));
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('The saved document must contain an object.');
    const record = raw as Record<string, unknown>;
    const values = (record.data && typeof record.data === 'object' && !Array.isArray(record.data) ? record.data : record) as Record<string, unknown>;
    const toolId = file?.manifest.tool.id ?? values.__toolId ?? record.toolId;
    if (typeof toolId !== 'string') throw new Error('The saved document has no tool identity.');
    const query = typeof values.__tui_query === 'string' ? values.__tui_query : '';
    const { runtime, reserved } = await mountTool(toolId, host, query, values, { fromLink: true, untrustedValues: true, emojiStamp: sessionEmojiStamp(record) ?? undefined });
    const decisions = sessionRightsDecisions(record);
    if (decisions) runtime.setRightsDecisions(decisions);
    const label = String(values.__label ?? record.label ?? basename(path));
    const slot = `${toolId}-${randomUUID()}`;
    const data = modelValues(runtime);
    const savedQuery = currentQuery(runtime, { width: reserved.width, height: reserved.height, unit: reserved.unit, dpi: reserved.dpi, format: reserved.format, c2pa: reserved.c2pa?.on, c2paDays: reserved.c2pa?.days, bleed: reserved.bleed, marks: new URLSearchParams(query).get('marks'), profile: reserved.profile, filename: reserved.filename ?? undefined, madeWith: reserved.madeWith ?? undefined, imprint: reserved.imprint ?? undefined, durable: reserved.durable ?? undefined });
    const updatedAt = await saveSession({ slot, toolId, label, query: savedQuery, values: data, rightsDecisions: runtime.rightsDecisions(), updatedAt: new Date().toISOString(), expectedUpdatedAt: null });
    return { slot, toolId, label, query: savedQuery, data, updatedAt, boxes: 0 };
  }
  // Mount first: the imported boxes must speak the ACTIVE profile's design
  // vocabulary (fonts/seed colours from its manifest), not the engine's neutral one.
  const { runtime, manifest } = await mountTool('design', host, '');
  const warnings: string[] = [];
  const { boxes, background, page, pageCount } = await parsePdfBytes(bytes, message => warnings.push(message), designMapFromManifest(manifest), options.page);
  if (warnings.length && !options.acceptLossy) throw new ImportReviewRequired(warnings, page, pageCount);
  await runtime.setInput('boxes', boxes as never);
  await runtime.setInput('background', background as never);
  const query = currentQuery(runtime);

  const label = `Imported ${basename(path)}`;
  const slot = `design-${randomUUID()}`;
  const data = modelValues(runtime);
  const updatedAt = await saveSession({ slot, toolId: 'design', label, query, values: data, updatedAt: new Date().toISOString() });
  return { slot, label, query, toolId: 'design', boxes: boxes.length, updatedAt, data };
}
