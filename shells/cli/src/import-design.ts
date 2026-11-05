// SPDX-License-Identifier: MPL-2.0
import { readFile, stat, writeFile } from 'node:fs/promises';
import { isBannerbearTemplate, mapBannerbearTemplate } from '../../../engine/src/design-map-bannerbear.ts';
import { writeOut } from './output.ts';
import { usageError } from './exit-codes.ts';

export const IMPORT_HELP = `lolly import <template.json> [--output=design.json] [--mapping=mapping.json]

Turns a design from another service into a Design document on this device. Today that means a
Bannerbear V5 image template, the JSON that GET /v5/image_templates/{uid} returns, which
\`lw render-api inventory\` keeps under templates/. Nothing is sent anywhere.

With no flags it prints the report: what was left out or approximated, one note per line. --json
prints the whole result. --output writes the Design frames and the report. --mapping writes the
entry for \`lw render-api\`, so old requests reach the same layers by name.

Bannerbear V2 and Placid return field names and a preview, not a design, so they cannot be
imported: rebuild them against a reference. Built from public documentation and never run
against a live account.
`;

const MAX_INPUT_BYTES = 32 * 1024 * 1024;

export async function importCli(args: string[], flags: Record<string, string>, asJson: boolean): Promise<void> {
  const [path] = args;
  if (!path || args.length !== 1) throw usageError(IMPORT_HELP);
  for (const key of ['output', 'mapping']) {
    if (flags[key] === '') throw usageError(`--${key} needs a value: write --${key}=<path>.`, 'MISSING_FLAG_VALUE');
    if (flags[key] === path) throw usageError('Choose a different output path.');
  }
  if ((await stat(path)).size > MAX_INPUT_BYTES) throw new Error('Choose a file smaller than 32 MB.');
  let parsed: unknown;
  try { parsed = JSON.parse(await readFile(path, 'utf8')); }
  catch { throw new Error('This file is not JSON. lolly import reads a Bannerbear V5 image template.'); }
  if (!isBannerbearTemplate(parsed)) {
    throw new Error('This is not a Bannerbear V5 image template: it has no `uid` and `config.objects`. Bannerbear V2 and Placid return no design, so those templates are rebuilt against a reference.');
  }
  const result = mapBannerbearTemplate(parsed);
  if (flags.output) await writeFile(flags.output, `${JSON.stringify({ frames: result.frames, report: result.report, fields: result.fields, designTool: result.designTool }, null, 2)}\n`, { flag: 'wx' });
  if (flags.mapping) await writeFile(flags.mapping, `${JSON.stringify({ templates: [result.mapping] }, null, 2)}\n`, { flag: 'wx' });
  if (asJson) { await writeOut(`${JSON.stringify(result, null, 2)}\n`); return; }
  const [frame] = result.frames;
  await writeOut(`${frame!.name}: ${frame!.boxes.length} layers, ${frame!.width} x ${frame!.height} px, ${result.fields.length} editable fields.\n`);
  for (const note of result.report) await writeOut(`${note.kind}: ${note.text}\n`);
}
