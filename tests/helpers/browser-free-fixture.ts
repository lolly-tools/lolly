// SPDX-License-Identifier: MPL-2.0
/**
 * A `browser-free.json` for a test fixture tool: the record scripts/tool-browser-free.ts
 * would write, with the fixture's own files as its digest. A fixture whose own test checks
 * what the browser-free route draws carries one, since the route admits no tool without a record.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BROWSER_FREE_FILE, digestToolSources, type BrowserFreeRecordV1 } from '../../packages/node-shell/src/browser-free-record.ts';

export function writeBrowserFreeFixture(dir: string): void {
  const read = (name: string): string | null => (existsSync(join(dir, name)) ? readFileSync(join(dir, name), 'utf8') : null);
  const manifest = JSON.parse(read('tool.json')!) as { id: string; version: string };
  const record: BrowserFreeRecordV1 = {
    version: 1,
    tool: { id: manifest.id, version: manifest.version, digest: digestToolSources(read) },
    verdict: 'resvg',
    measured: {
      date: '2026-11-20', profile: 'test fixture', webShell: 'none',
      renderers: { resvg: 'fixture', engine: 'fixture', chromium: 'none' },
      bands: { threshold: 24, fillThreshold: 72, regionShare: 0.005, inkShare: 0.25, inkShift: 1.5, gradientLevels: 2 },
    },
    cases: [{ name: `${manifest.id}-fixture`, args: [], result: 'inside', detail: 'checked by the fixture\'s own test' }],
  };
  writeFileSync(join(dir, BROWSER_FREE_FILE), JSON.stringify(record));
}
