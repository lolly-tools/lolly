// SPDX-License-Identifier: MPL-2.0
import { readFile, stat, writeFile } from 'node:fs/promises';
import { loadAffinityKernel } from '@lolly-tools/node-shell/affinity-node';
import { AFFINITY_MAX_INPUT, describeAffinityError, isAffinitySignature } from '@lolly-tools/node-shell/affinity';
import { mapAffinityDocument } from '../../../engine/src/design-map-affinity.ts';
import { writeOut } from './output.ts';
import { usageError } from './exit-codes.ts';

export const AFFINITY_HELP = `lolly affinity <file.af|.afdesign|.afphoto|.afpub> [--preview=preview.png] [--output=design.json]

Reads a native Affinity document on this device. With no flags it prints the facts: kind, size,
artboard and page counts, the Affinity container version and the size of Affinity's own preview
picture. --json prints them as JSON. --preview writes that embedded PNG. --output writes the Design
boxes for every artboard (pictures are listed in the report but not stored) and prints what was
approximated or left out, one note per line, on stderr. Affinity files from versions 1 to 3 are read.
`;

export async function affinityCli(args: string[], flags: Record<string, string>, asJson: boolean): Promise<void> {
  const [path] = args;
  if (!path || args.length !== 1) throw usageError(AFFINITY_HELP);
  for (const k of ['preview', 'output']) if (flags[k] === '') throw usageError(`--${k} needs a value: write --${k}=<path>.`, 'MISSING_FLAG_VALUE');
  if ((await stat(path)).size > AFFINITY_MAX_INPUT) throw new Error('Choose an Affinity file smaller than 96 MB.');
  const bytes = new Uint8Array(await readFile(path));
  if (!isAffinitySignature(bytes)) throw new Error('This file is not an Affinity document.');
  const kernel = await loadAffinityKernel();
  let info: ReturnType<typeof kernel.inspect>;
  try { info = kernel.inspect(bytes, path); } catch (error) { throw new Error(describeAffinityError(error)); }

  if (flags.preview) {
    if (flags.preview === path) throw usageError('Choose a different output path.');
    if (!info.preview) throw new Error(`This file has no preview picture the reader accepts (${info.previewError ?? 'none stored'}).`);
    await writeFile(flags.preview, info.preview.png, { flag: 'wx' });
  }
  if (flags.output) {
    if (flags.output === path) throw usageError('Choose a different output path.');
    let read: ReturnType<typeof kernel.model>;
    try { read = kernel.model(bytes); } catch (error) { throw new Error(describeAffinityError(error)); }
    const mapped = await mapAffinityDocument(read.model, { image: () => null });
    await writeFile(flags.output, `${JSON.stringify({ frames: mapped.frames, report: mapped.report }, null, 2)}\n`, { flag: 'wx' });
    for (const n of mapped.report) process.stderr.write(`${n.kind}: ${n.text}\n`);
    return;
  }
  const facts = {
    kind: info.kind, container: info.container,
    width: info.document ? Math.round(info.document.width) : null, height: info.document ? Math.round(info.document.height) : null,
    artboards: info.document?.artboards ?? null, pages: info.document?.pages ?? null, layers: info.document?.layers ?? null,
    preview: info.preview ? `${info.preview.width}x${info.preview.height}` : null, savedBy: info.document?.savedBy ?? null,
  };
  if (asJson) { await writeOut(`${JSON.stringify(facts, null, 2)}\n`); return; }
  await writeOut(`Kind: ${facts.kind}\nContainer version: ${facts.container}\nSize: ${facts.width ?? '?'} x ${facts.height ?? '?'} px\nArtboards: ${facts.artboards ?? '?'}\nPages: ${facts.pages ?? '?'}\nPreview: ${facts.preview ?? 'none'}\n`);
}
