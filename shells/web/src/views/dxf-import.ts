// SPDX-License-Identifier: MPL-2.0
// DXF floor plans and drawings -> Design boxes.
//
// The shell half of the DXF import: it loads the WASM tag reader, hands it to the engine's
// flattener (engine/src/dxf-import.ts) and turns the result into Design boxes
// (engine/src/dxf-design.ts). Each layer is a group of native path boxes and text boxes. The
// plain-language report (XREFs, paper space, SHX fonts, skipped entities) goes to `warn`, which
// is the import panel's log, so nothing is dropped without being said.
import { importDxf, dxfToDesign, looksLikeDxf, type DesignMapOptions } from '@lolly/engine';
import { describeDxfError } from '@lolly-tools/node-shell/dxf';

/** True for a DXF by its bytes, or by its name when the bytes are binary-looking or odd. */
export function isDxf(buf: Uint8Array, name?: unknown): boolean {
  if (looksLikeDxf(buf)) return true;
  return typeof name === 'string' && /\.dxf$/i.test(name.trim());
}

export interface DxfDesignImport { boxes: unknown[]; width: number; height: number; background: string }

/** Read a DXF file and build its Design boxes. Throws an Error with a plain message on failure. */
export async function parseDxfAsDesign(
  buf: Uint8Array,
  { warn, map, layers }: { warn: (msg: string) => void; map?: DesignMapOptions; layers?: readonly string[] },
): Promise<DxfDesignImport> {
  const { loadDxfKernel } = await import('../bridge/dxf.ts');
  let imported;
  try {
    imported = importDxf(buf, { read: (await loadDxfKernel()).read, ...(layers ? { layers } : {}) });
  } catch (error) {
    throw new Error(describeDxfError(error));
  }
  const design = dxfToDesign(imported, map);
  for (const note of design.notes) warn(note);
  if (!design.boxes.length) throw new Error('No lines or text could be imported from this DXF file. The report above says what it holds.');
  return { boxes: design.boxes, width: design.width, height: design.height, background: design.background };
}
