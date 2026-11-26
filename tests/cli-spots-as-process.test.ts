// SPDX-License-Identifier: MPL-2.0
/**
 * `--spots=process` on the command line (engine 1.324): the CLI spelling of a link's
 * `_spots=process`. Browser-free: the share link, the refusals and the EPS sink. The plate
 * evidence for the Print PDF is plate scenes 13 and 14 (scripts/plate-oracle.test.ts).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const entry = fileURLToPath(new URL('../shells/cli/bin/lolly.ts', import.meta.url));
const env = { ...process.env, LOLLY_PROFILE: 'lolly-demo', NO_COLOR: '1' };
const linkParams = (stdout: string): URLSearchParams => new URLSearchParams(stdout.trim().split('?')[1] ?? '');

test('--spots=process and --_spots=process both ride the share link; the default writes nothing', async () => {
  const base = [entry, 'run', 'qr-code', '--url=https://lolly.tools', '--export=pdf-cmyk', '--share'];
  assert.equal(linkParams((await run(process.execPath, [...base, '--spots=process'], { env })).stdout).get('_spots'), 'process');
  assert.equal(linkParams((await run(process.execPath, [...base, '--_spots=process'], { env })).stdout).get('_spots'), 'process');
  assert.equal(linkParams((await run(process.execPath, base, { env })).stdout).get('_spots'), null);
});

test('a --spots value other than process is a usage error, never a quiet default', async () => {
  for (const flag of ['--spots=keep', '--spots']) {
    await assert.rejects(
      run(process.execPath, [entry, 'run', 'qr-code', '--url=https://lolly.tools', '--export=eps-cmyk', flag], { env }),
      (error: { code?: number; stderr?: string }) => error.code === 2 && /spots/.test(error.stderr ?? ''),
      flag,
    );
  }
});

test('eps-cmyk keeps its bytes with --spots=process, since EPS has no named plates', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'lolly-spots-eps-'));
  try {
    const out = (name: string): string => join(dir, name);
    const args = (extra: string[], file: string): string[] => [entry, 'run', 'qr-code', '--url=https://lolly.tools', '--export=eps-cmyk', '--no-provenance', `--output=${file}`, ...extra];
    await run(process.execPath, args([], out('off.eps')), { env: { ...env, LOLLY_STATE_DIR: join(dir, 'a') } });
    await run(process.execPath, args(['--spots=process'], out('on.eps')), { env: { ...env, LOLLY_STATE_DIR: join(dir, 'b') } });
    const off = readFileSync(out('off.eps')), on = readFileSync(out('on.eps'));
    assert.ok(off.length > 0);
    assert.ok(off.equals(on), 'the same EPS bytes with and without the flag');
    // Lolly Demo's Liquorice is a spot ink; EPS writes it as its declared build, 100% K, either
    // way. The press conversion of #09141a would be a four-ink build, so K alone is the token's.
    assert.match(off.toString('latin1'), /\n0 0 0 1 setcmykcolor\n/);
    assert.doesNotMatch(off.toString('latin1'), /0\.89 0\.48 0\.32 1 setcmykcolor/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('lolly preflight counts the plates the file will have: no spot plate with --spots=process', async () => {
  const counts = async (extra: string[]): Promise<Record<string, number>> => {
    const { stdout } = await run(process.execPath, [entry, 'preflight', 'qr-code', '--url=https://lolly.tools', '--export=pdf-cmyk', '--json', ...extra], { env });
    const report = JSON.parse(stdout).result as { counts: { kind: string; value: number }[] };
    return Object.fromEntries(report.counts.filter((c) => c.kind.endsWith('Plates')).map((c) => [c.kind, c.value]));
  };
  const off = await counts([]);
  assert.equal(off.processPlates, 4);
  assert.ok((off.spotPlates ?? 0) > 0, 'Lolly Demo declares spot inks, so the default counts spot plates');
  for (const flag of ['--spots=process', '--_spots=process']) {
    assert.deepEqual(await counts([flag]), { processPlates: 4 }, flag);
  }
  await assert.rejects(
    run(process.execPath, [entry, 'preflight', 'qr-code', '--url=https://lolly.tools', '--export=pdf-cmyk', '--spots=keep'], { env }),
    (error: { code?: number; stderr?: string }) => error.code === 2 && /spots/.test(error.stderr ?? ''),
  );
});
