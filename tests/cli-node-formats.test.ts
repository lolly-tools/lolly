// SPDX-License-Identifier: MPL-2.0
// The terminal shells write every text format the engine can hydrate without a browser
// (plans/371, M1.2). The list of browser-free formats lagged the engine once: seven
// caption and palette formats went to a headless browser that had no part in the job.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { DATA_FORMATS } from '../engine/src/runtime.ts';
import { NODE_FORMATS } from '../packages/node-shell/src/raster.ts';

const run = promisify(execFile);
const entry = fileURLToPath(new URL('../shells/cli/bin/lolly.ts', import.meta.url));
// A web shell that is not there: any format that reached the browser tier would fail.
const env = { ...process.env, LOLLY_PROFILE: 'lolly-demo', LOLLY_WEB_DIST: '/nonexistent/lolly-web-dist' };
delete (env as Record<string, string | undefined>).LOLLY_WEB_BASE;

test('every text format the engine writes is a browser-free format in the terminal shells', () => {
  const missing = Object.keys(DATA_FORMATS).filter(format => !NODE_FORMATS.includes(format));
  assert.deepEqual(missing, [], 'add these to NODE_FORMATS in packages/node-shell/src/raster.ts');
});

const cases: Array<[tool: string, format: string, starts: RegExp]> = [
  ['captions', 'srt', /^1\n00:00:00,000 --> /],
  ['captions', 'vtt', /^WEBVTT\n/],
  ['captions', 'ttml', /^<\?xml version="1\.0" encoding="UTF-8"\?>\n<tt /],
  ['captions', 'scc', /^Scenarist_SCC V1\.0\n/],
  ['color-palette', 'css', /^:root \{\n\s+--color-/],
  ['color-palette', 'scss', /^\$color-/],
  ['color-palette', 'gpl', /^GIMP Palette\n/],
];

for (const [tool, format, starts] of cases) {
  test(`${tool} writes ${format} with no web shell built`, async () => {
    const { stdout } = await run(process.execPath, [entry, 'run', tool, `--export=${format}`], { env, maxBuffer: 16 * 1024 * 1024 });
    assert.match(stdout, starts);
  });
}
