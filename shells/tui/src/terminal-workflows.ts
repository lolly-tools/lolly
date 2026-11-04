// SPDX-License-Identifier: MPL-2.0
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { serializeUrlState } from '../../../engine/src/url-mode.ts';

export const shellWord = (word: string): string => `'${word.replaceAll("'", "'\\''")}'`;

/** Binary inputs need their original path; expanding them as JSON would lose their type. */
export function inputValuesJson(values: Record<string, unknown>): string {
  return JSON.stringify(
    values,
    (_key, value: unknown) => {
      if (
        value instanceof ArrayBuffer ||
        ArrayBuffer.isView(value) ||
        (typeof Blob !== 'undefined' && value instanceof Blob)
      )
        throw new Error(
          'This document contains a loaded file. Use its original file path with the CLI.'
        );
      return value;
    },
    2
  );
}

/** Private values travel on stdin, never in process arguments. Bash/Zsh syntax. */
export function cliRecipe(
  toolId: string,
  values: Record<string, unknown>,
  options: Parameters<typeof serializeUrlState>[1],
  output: string
): string {
  const json = inputValuesJson(values);
  const flags = [...new URLSearchParams(serializeUrlState([], options))].map(([key, value]) =>
    shellWord(`--${key}=${value}`)
  );
  return [
    `lolly run ${shellWord(toolId)} --inputs=- ${flags.join(' ')} ${shellWord(`--output=${output}`)} <<'LOLLY_INPUTS'`,
    json,
    'LOLLY_INPUTS',
    '',
  ].join('\n');
}

/** The editor command is the user's configuration; the private path is a separate argument. */
export async function editInputValues(
  values: Record<string, unknown>,
  suspend: (callback: () => Promise<void>) => Promise<void>
): Promise<Record<string, unknown>> {
  const editor = process.env.VISUAL || process.env.EDITOR;
  if (!editor) throw new Error('Set VISUAL or EDITOR to use an external editor.');
  const json = inputValuesJson(values);
  const dir = await mkdtemp(join(tmpdir(), 'lolly-edit-'));
  const path = join(dir, 'inputs.json');
  try {
    await writeFile(path, json, { mode: 0o600 });
    await suspend(async () => {
      await new Promise<void>((resolve, reject) => {
        const child =
          process.platform === 'win32'
            ? spawn(editor, [path], { stdio: 'inherit' })
            : spawn('/bin/sh', ['-c', `${editor} "$1"`, 'lolly-editor', path], {
                stdio: 'inherit',
              });
        child.once('error', reject);
        child.once('exit', (code, signal) =>
          code === 0
            ? resolve()
            : reject(new Error(`Editor exited ${signal ?? code}. No changes applied.`))
        );
      });
    });
    const candidate: unknown = JSON.parse(await readFile(path, 'utf8'));
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate))
      throw new Error('The editor must return an object of input values.');
    return candidate as Record<string, unknown>;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
