// SPDX-License-Identifier: MPL-2.0
/**
 * `lolly preflight design --file=<tokens.json>` counts the plates of the design system the
 * file names, the one `lolly run design --file` separates with, and not the content
 * profile's. Browser-free: preflight renders nothing. The plates the export writes for the
 * same system are plate scene 14 (scripts/plate-oracle.test.ts).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const entry = fileURLToPath(new URL('../shells/cli/bin/lolly.ts', import.meta.url));
const tokens = fileURLToPath(new URL('./fixtures/plate-scenes/tokens/ink-and-foil.tokens.json', import.meta.url));
const colourways = fileURLToPath(new URL('./fixtures/plate-scenes/tokens/two-colourways.tokens.json', import.meta.url));
const env = { ...process.env, LOLLY_PROFILE: 'lolly-demo', NO_COLOR: '1' };

type Report = { counts: { kind: string; value: number }[]; findings: { id: string; evidence?: Record<string, unknown> }[]; job?: unknown };
const preflight = async (args: string[]): Promise<Report> => {
  const { stdout } = await run(process.execPath, [entry, 'preflight', ...args, '--export=pdf-cmyk', '--json'], { env });
  return JSON.parse(stdout).result as Report;
};
const plates = (r: Report): Record<string, number> =>
  Object.fromEntries(r.counts.filter((c) => c.kind.endsWith('Plates')).map((c) => [c.kind, c.value]));
const evidence = (r: Report, id: string): Record<string, unknown> | undefined => r.findings.find((f) => f.id === id)?.evidence;

test('--file names the design system preflight counts, as it does for the export', async () => {
  const profile = await preflight(['design', '--width=400', '--height=200']);
  const file = await preflight(['design', '--width=400', '--height=200', `--file=${tokens}`]);
  // The fixture declares one spot ink and one foil finish; Lolly Demo declares many inks and no finish.
  assert.deepEqual(plates(file), { processPlates: 4, spotPlates: 1, finishPlates: 1 });
  assert.equal(evidence(file, 'plates.spot-ceiling')?.spots, 'Fixture Tide');
  assert.equal(evidence(file, 'plates.finish-ceiling')?.finishes, 'Fixture Foil');
  assert.ok((plates(profile).spotPlates ?? 0) > 1, 'without --file the profile\'s palette is counted');
  assert.equal(plates(profile).finishPlates, undefined);
  // With spot inks as process the ink folds into the four plates and the finish keeps its own.
  assert.deepEqual(plates(await preflight(['design', `--file=${tokens}`, '--spots=process'])), { processPlates: 4, finishPlates: 1 });
});

test('--file is refused where the export refuses it, so nothing is checked against the wrong system', async () => {
  const refused = (args: string[], kind: string) => assert.rejects(
    run(process.execPath, [entry, 'preflight', ...args, '--export=pdf-cmyk', '--json'], { env }),
    (error: { code?: number; stdout?: string; stderr?: string }) => {
      assert.equal(error.code, 2);
      assert.equal(JSON.parse(error.stdout ?? '{}').error?.kind, kind);
      assert.match(error.stderr ?? '', /--file/);
      return true;
    },
  );
  await refused(['qr-code', '--url=https://lolly.tools', `--file=${tokens}`], 'UNSUPPORTED_FLAG');
  await refused(['design', '--file'], 'MISSING_FLAG_VALUE');
});

test('a pasted link cannot choose the design system file', async () => {
  const link = `https://lolly.tools/tool/design?width=400&height=200&file=${encodeURIComponent(tokens)}`;
  assert.equal(plates(await preflight([link])).finishPlates, undefined, 'the link\'s file= is not read');
  assert.deepEqual(plates(await preflight([link, `--file=${tokens}`])), { processPlates: 4, spotPlates: 1, finishPlates: 1 }, 'the flag typed after the link is');
});

test('a link\'s _themes choice decides the palette preflight counts, as it decides the export\'s', async () => {
  const night = JSON.stringify({ '': 'night' });
  // Day is the canonical colourway: one spot ink, no finish.
  assert.deepEqual(plates(await preflight(['design', `--file=${colourways}`])), { processPlates: 4, spotPlates: 1 });
  const chosen = await preflight(['design', `--file=${colourways}`, `--_themes=${night}`]);
  assert.deepEqual(plates(chosen), { processPlates: 4, spotPlates: 2, finishPlates: 1 });
  assert.equal(evidence(chosen, 'plates.finish-ceiling')?.finishes, 'Fixture Foil');
  // The same choice carried by a pasted link.
  const link = `https://lolly.tools/tool/design?width=400&height=200&_themes=${encodeURIComponent(night)}`;
  assert.deepEqual(plates(await preflight([link, `--file=${colourways}`])), { processPlates: 4, spotPlates: 2, finishPlates: 1 });
});
