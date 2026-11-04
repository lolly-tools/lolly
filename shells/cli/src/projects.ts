// SPDX-License-Identifier: MPL-2.0
import { writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolveStateDir } from '@lolly-tools/node-shell/state-dir';
import {
  listSessionRecords,
  readSessionRecord,
  writeSessionRecord,
} from '@lolly-tools/node-shell/session-store';
import { emitResult } from './envelope.ts';
import { usageError } from './exit-codes.ts';

/** Explicit access to this device's saved projects. Exported JSON contains private document state. */
export async function projectsCli(
  args: string[],
  flags: Record<string, string>,
  json: boolean
): Promise<void> {
  const dir = resolveStateDir().dir;
  const [command = 'list', slot] = args;
  let result: unknown;
  if (command === 'list') {
    const query = (flags.query ?? '').toLowerCase();
    result = (await listSessionRecords(dir))
      .filter(
        (record) =>
          record.toolId &&
          `${record.slot} ${record.label ?? ''} ${record.toolId}`.toLowerCase().includes(query)
      )
      .map(({ slot, toolId, label, updatedAt }) => ({ slot, toolId, label, updatedAt }));
  } else {
    if (!['show', 'export', 'copy'].includes(command))
      throw usageError(
        'Usage: lolly projects list|show|export|copy [slot] [--query=text] [--output=file.json] [--label=name]',
        'USAGE'
      );
    if (!slot)
      throw usageError('Specify the project slot from lolly projects list.', 'MISSING_ARGUMENT');
    const record = await readSessionRecord(dir, slot);
    if (!record?.toolId)
      throw usageError(`No saved project with slot ${JSON.stringify(slot)}.`, 'BAD_INPUT');
    if (command === 'show') result = record;
    else if (command === 'export') {
      if (!flags.output)
        throw usageError('projects export needs --output=file.json.', 'MISSING_ARGUMENT');
      await writeFile(flags.output, JSON.stringify(record, null, 2) + '\n', {
        mode: 0o600,
        flag: 'wx',
      });
      result = { slot, output: flags.output };
    } else {
      const label = flags.label ?? `${record.label ?? slot} copy`;
      const copy = await writeSessionRecord(dir, {
        slot: `${record.toolId}-${randomUUID()}`,
        expectedUpdatedAt: null,
        label,
        toolId: record.toolId,
        toolVersion: record.toolVersion,
        emoji: record.emoji,
        data: { ...record.data, __label: label },
        thumb: record.thumb,
        rightsDecisions: record.rightsDecisions,
      });
      result = {
        slot: copy.slot,
        toolId: copy.toolId,
        label: copy.label,
        updatedAt: copy.updatedAt,
      };
    }
  }
  if (json) await emitResult(result);
  else process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}
