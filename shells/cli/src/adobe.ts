// SPDX-License-Identifier: MPL-2.0
import { readFile, stat, writeFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { readCameraRawPreset } from '../../../engine/src/camera-raw-preset.ts';
import { readPremiereXml, premiereSequenceValues } from '../../../engine/src/premiere-xml.ts';
import { serializeUrlState } from '../../../engine/src/url-mode.ts';
import { loadPsdKernel } from '@lolly-tools/node-shell/adobe-psd-node';
import { writeOut } from './output.ts';
import { usageError } from './exit-codes.ts';
import { readIdmlSpreads } from '../../../engine/src/idml-read.ts';
import { readZip } from '../../../engine/src/zip.ts';

export const ADOBE_HELP = `lolly adobe preset <preset.xmp> [--output=report.json]
lolly adobe timeline <sequence.xml> [--output=report.json]
lolly adobe idml <document.idml> [--output=report.json]
lolly adobe psd-inspect <source.psd>
lolly adobe psd-preserve <source.psd> --output=copy.psd

Preset reports contain Darkroom input values and a shareable URL. Timeline reports
retain rational frame counts and include Design inputs with missing-media placeholders.
PSD preservation writes a no-edit copy; composed Lolly PSD exports are separate.
`;
export async function adobeCli(args: string[], flags: Record<string, string>): Promise<void> {
  const [command, path] = args;
  if (!path || args.length !== 2 || !['preset', 'timeline', 'idml', 'psd-inspect', 'psd-preserve'].includes(command ?? '')) throw usageError(ADOBE_HELP);
  const cap = command === 'preset' ? 1024 * 1024 : command === 'timeline' ? 8 * 1024 * 1024 : command === 'idml' ? 128 * 1024 * 1024 : 64 * 1024 * 1024;
  if ((await stat(path)).size > cap) throw new Error('Adobe input exceeds this operation\'s byte limit.');
  const bytes = new Uint8Array(await readFile(path)); if (bytes.length > cap) throw new Error('Adobe input exceeds this operation\'s byte limit.');
  if (command === 'psd-preserve') {
    if (!flags.output || flags.output === path) throw usageError('Choose a different output path for the preserved PSD.');
    await writeFile(flags.output, (await loadPsdKernel()).roundTrip(bytes), { flag: 'wx' }); return;
  }
  let report: unknown;
  if (command === 'psd-inspect') report = (await loadPsdKernel()).inspect(bytes);
  else {
    const dom = new JSDOM(''), parse = (s: string) => new dom.window.DOMParser().parseFromString(s, 'application/xml');
    try {
      const source = new TextDecoder().decode(bytes);
      if (command === 'idml') {
        const parts = readZip(bytes, { maxInputBytes: cap, maxTotalBytes: cap, maxEntryBytes: 8 * 1024 * 1024, maxEntries: 4096 }), notes: string[] = [];
        const frames = await readIdmlSpreads(Object.fromEntries(parts.map(p => [p.name, p.bytes])), parse, { warn: note => notes.push(note) });
        report = { frames, notes };
      } else if (command === 'preset') {
        const preset = readCameraRawPreset(source, parse);
        report = { ...preset, url: `https://lolly.tools/t/darkroom?${serializeUrlState(Object.entries(preset.values).map(([id, value]) => ({ id, type: 'number', value })))}` };
      } else { const sequence = readPremiereXml(source, parse); report = { sequence, ...await premiereSequenceValues(sequence) }; }
    } finally { dom.window.close(); }
  }
  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (flags.output) await writeFile(flags.output, json, { flag: 'wx' }); else await writeOut(json);
}
