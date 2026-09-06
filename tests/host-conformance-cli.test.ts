// SPDX-License-Identifier: MPL-2.0
/**
 * The CLI bridge is a real HostV1 shell: it must pass the conformance kit
 * (shape + behaviour), and what it reports as present must match what a tool's
 * `requires` can rely on there.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import { runHostConformance, formatConformance } from '../packages/core/src/host-conformance.ts';
import { presentApis } from '../packages/core/src/host-v1/apis.ts';
import { createCliBridge } from '../shells/cli/src/bridge.ts';

test('the CLI bridge conforms to HostV1, shape and behaviour', async () => {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  const host = await createCliBridge({ dom: dom.window as never, profile: {} } as never);
  const report = await runHostConformance(host);
  assert.ok(report.ok, formatConformance(report));
  assert.equal(report.shell, 'cli');
  // The APIs shipped tools declare in `requires` today must all be there, or
  // those tools stop mounting on the CLI (tests/tool-requires.test.ts keeps the
  // manifests honest; this keeps the shell honest).
  const present = new Set(presentApis(host as never));
  for (const api of ['tokens', 'text', 'compose', 'color', 'c2pa', 'audio'] as const) {
    assert.ok(present.has(api), `CLI provides host.${api} (present: ${[...present].join(', ')})`);
  }
  assert.ok(!present.has('recorder'), 'a headless shell has no recorder');
});
