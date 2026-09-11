// SPDX-License-Identifier: MPL-2.0
/**
 * Design import → a saved Design session. Reads a PDF/.ai from disk, turns its
 * first page into editable boxes (import/pdf.ts), seeds a design runtime, and
 * saves the serialised state as a project - which then opens in the ToolView like any
 * other saved session (fully re-editable). Terminal scope is PDF/.ai; IDML/Penpot stay
 * a web feature (they need a DOM/canvas the Node shell doesn't have).
 */
import { readFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import { homedir } from 'node:os';
import { parsePdfBytes } from './import/pdf.ts';
import { mountTool, currentQuery, modelValues, type Manifest } from './engine-render.ts';
import { saveSession } from './store.ts';
import type { DesignMapOptions } from '@lolly/engine';
import type { HostV1 } from '@lolly-tools/core/host-v1';

const expandHome = (p: string): string => (p.startsWith('~') && (p.length === 1 || p[1] === '/') ? homedir() + p.slice(1) : p);

export interface ImportedSession { slot: string; label: string; query: string; toolId: string; boxes: number }

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
export async function importDesignFile(path: string, host: HostV1): Promise<ImportedSession> {
  const ext = extname(path).toLowerCase();
  if (ext !== '.pdf' && ext !== '.ai') {
    throw new Error('The terminal imports PDF and .ai files. For IDML or Penpot, use the web app.');
  }
  const bytes = new Uint8Array(await readFile(expandHome(path)));
  // Mount first: the imported boxes must speak the ACTIVE profile's design
  // vocabulary (fonts/seed colours from its manifest), not the engine's neutral one.
  const { runtime, manifest } = await mountTool('design', host, '');
  const { boxes, background } = await parsePdfBytes(bytes, undefined, designMapFromManifest(manifest));
  await runtime.setInput('boxes', boxes as never);
  await runtime.setInput('background', background as never);
  const query = currentQuery(runtime);

  const label = `Imported ${basename(path)}`;
  const slot = `design-${Date.now()}`;
  await saveSession({ slot, toolId: 'design', label, query, values: modelValues(runtime), updatedAt: new Date().toISOString() });
  return { slot, label, query, toolId: 'design', boxes: boxes.length };
}
