// SPDX-License-Identifier: MPL-2.0
/**
 * `lolly files convert` data choices through the real entry point. --sheet is
 * passed as text, so a worksheet named with digits (a year, say) is found by
 * name, and digits that match no worksheet name are a 0-based position.
 *
 * Run with: node --test tests/cli-files-data.test.ts
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { strToU8, zipSync } from 'fflate';

const BIN = join(dirname(fileURLToPath(import.meta.url)), '..', 'shells', 'cli', 'bin', 'lolly.ts');
const root = await mkdtemp(join(tmpdir(), 'lolly-files-data-'));
after(() => rm(root, { recursive: true, force: true }));

/** A workbook whose sheets each hold one inline string in A1, in tab order. */
function workbook(sheets: [name: string, value: string][]): Uint8Array {
  const files: Record<string, Uint8Array> = {
    'xl/workbook.xml': strToU8(`<workbook xmlns:r="r"><sheets>${sheets.map(([name], i) => `<sheet name="${name}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`),
    'xl/_rels/workbook.xml.rels': strToU8(`<Relationships>${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}</Relationships>`),
  };
  sheets.forEach(([, value], i) => {
    files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(`<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>${value}</t></is></c></row></sheetData></worksheet>`);
  });
  return zipSync(files);
}

function cli(args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [BIN, ...args], { cwd: root, env: { ...process.env, NO_COLOR: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (c: Buffer) => { stdout += c.toString('utf8'); });
    child.stderr.on('data', (c: Buffer) => { stderr += c.toString('utf8'); });
    child.on('close', (code) => resolve({ stdout, stderr, code: code ?? -1 }));
  });
}

const book = join(root, 'years.xlsx');
await writeFile(book, workbook([['Summary', 'summary'], ['2024', 'year'], ['1', 'named one']]));

test('--sheet finds a worksheet named 2024, and a name wins over a position', async () => {
  const year = await cli(['files', 'convert', book, '--to=csv', `--output=${join(root, 'year.csv')}`, '--sheet=2024']);
  assert.equal(year.code, 0, year.stderr || year.stdout);
  assert.equal(await readFile(join(root, 'year.csv'), 'utf8'), 'year');
  const named = await cli(['files', 'convert', book, '--to=csv', `--output=${join(root, 'one.csv')}`, '--sheet=1']);
  assert.equal(named.code, 0, named.stderr || named.stdout);
  assert.equal(await readFile(join(root, 'one.csv'), 'utf8'), 'named one');
});

test('--sheet digits that match no name count from 0, and a missing position names both readings', async () => {
  const first = await cli(['files', 'convert', book, '--to=csv', `--output=${join(root, 'first.csv')}`, '--sheet=0']);
  assert.equal(first.code, 0, first.stderr || first.stdout);
  assert.equal(await readFile(join(root, 'first.csv'), 'utf8'), 'summary');
  const missing = await cli(['files', 'convert', book, '--to=csv', `--output=${join(root, 'missing.csv')}`, '--sheet=7']);
  assert.equal(missing.code, 1);
  assert.match(missing.stdout, /no worksheet named “7” and no worksheet at position 7 \(0 is the first\)/);
});
