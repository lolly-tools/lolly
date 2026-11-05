// SPDX-License-Identifier: MPL-2.0
import { readFile, stat, writeFile } from 'node:fs/promises';
import { importDxf, dxfReportLines, looksLikeDxf, type DxfImportOptions } from '../../../engine/src/dxf-import.ts';
import { dxfToDesign, dxfToSvg } from '../../../engine/src/dxf-design.ts';
import { loadDxfKernel } from '@lolly-tools/node-shell/dxf-node';
import { DXF_MAX_INPUT, describeDxfError } from '@lolly-tools/node-shell/dxf';
import { writeOut } from './output.ts';
import { usageError } from './exit-codes.ts';

export const DXF_HELP = `lolly dxf <drawing.dxf> [--output=preview.svg|design.json] [--layers=A,B] [--include-hidden]
                         [--unitless=mm|in] [--px-per-unit=<n>]

Reads an AutoCAD DXF file (ASCII or binary, R12 to 2018) on this device. With no --output it prints
the import report: units and scale, layers, and what was not drawn (external references, paper
space, SHX fonts, hatches and other entities). --output=name.svg writes an SVG preview;
--output=name.json writes the Design boxes (layers as groups, native paths, text boxes that carry
the font name the file states). --json prints the report as JSON. --layers keeps only the named
layers; layers the file turns off or freezes are skipped unless --include-hidden is given. A file
that states no drawing units is read as millimetres unless --unitless=in says inches.
`;

export async function dxfCli(args: string[], flags: Record<string, string>, asJson: boolean): Promise<void> {
  const [path] = args;
  if (!path || args.length !== 1) throw usageError(DXF_HELP);
  for (const k of ['output', 'layers', 'unitless', 'px-per-unit']) if (flags[k] === '') throw usageError(`--${k} needs a value: write --${k}=<value>.`, 'MISSING_FLAG_VALUE');
  if ((await stat(path)).size > DXF_MAX_INPUT) throw new Error('Choose a DXF file smaller than 32 MB.');
  const bytes = new Uint8Array(await readFile(path));
  if (!looksLikeDxf(bytes) && !/\.dxf$/i.test(path)) throw new Error('This file does not look like a DXF drawing.');
  const unitless = flags.unitless;
  if (unitless !== undefined && unitless !== 'mm' && unitless !== 'in') throw usageError('--unitless takes mm or in.');
  const pxPerUnit = flags['px-per-unit'] === undefined ? undefined : Number(flags['px-per-unit']);
  if (pxPerUnit !== undefined && !(pxPerUnit > 0 && Number.isFinite(pxPerUnit))) throw usageError('--px-per-unit takes a positive number.');
  const opts: Omit<DxfImportOptions, 'read'> = {
    ...(flags.layers ? { layers: flags.layers.split(',').map((s) => s.trim()).filter(Boolean) } : {}),
    ...(flags['include-hidden'] !== undefined && flags['include-hidden'] !== 'false' ? { includeHidden: true } : {}),
    ...(unitless ? { unitless } : {}),
    ...(pxPerUnit ? { pxPerUnit } : {}),
  };
  let imported: ReturnType<typeof importDxf>;
  try { imported = importDxf(bytes, { read: (await loadDxfKernel()).read, ...opts }); }
  catch (error) { throw new Error(describeDxfError(error)); }

  if (flags.output) {
    if (flags.output === path) throw usageError('Choose a different output path.');
    const out = /\.json$/i.test(flags.output)
      ? `${JSON.stringify({ ...dxfToDesign(imported), report: imported.report }, null, 2)}\n`
      : /\.svg$/i.test(flags.output) ? dxfToSvg(imported)
      : (() => { throw usageError('--output takes a .svg or .json path.'); })();
    await writeFile(flags.output, out, { flag: 'wx' });
    for (const line of dxfReportLines(imported.report)) process.stderr.write(`${line}\n`);
    return;
  }
  if (asJson) {
    await writeOut(`${JSON.stringify({ width: imported.width, height: imported.height, layers: imported.layers, report: imported.report, notes: dxfReportLines(imported.report) }, null, 2)}\n`);
    return;
  }
  const rows = imported.layers.filter((l) => l.strokes + l.texts > 0).map((l) => `  ${l.name}: ${l.strokes} paths, ${l.texts} text items${l.hidden ? ' (hidden in the file)' : ''}`);
  await writeOut(`${dxfReportLines(imported.report).join('\n')}\nLayers:\n${rows.join('\n') || '  none drawn'}\n`);
}
