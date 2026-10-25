// SPDX-License-Identifier: MPL-2.0
/** The api/ bundle drift policy of scripts/check-api-bundles.ts. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isBundleInput, judge } from '../scripts/check-api-bundles.ts';

test('matching bundles pass on every event', () => {
  for (const event of ['push', 'pull_request', 'workflow_dispatch', undefined]) {
    assert.deepEqual(judge(false, event, null), { status: 'clean', inputs: [] });
  }
});

test('drift fails on a push, a tag and any event other than a pull request', () => {
  for (const event of ['push', 'workflow_dispatch', 'schedule', undefined]) {
    assert.equal(judge(true, event, ['docs/using.md']).status, 'fail', String(event));
  }
});

test('a pull request whose base is unknown stays strict', () => {
  assert.equal(judge(true, 'pull_request', null).status, 'fail');
});

test('a pull request that changes what the bundles are built from must carry matching bundles', () => {
  for (const path of ['api/mcp/[...path].js', 'engine/src/runtime.ts', 'packages/node-shell/src/rondo-worker.ts',
    'packages/rondo/generated/stage.js', 'services/mcp/src/gateway.ts', 'services/ca/handler.mjs', 'services/penpot/vercel-entry.ts',
    'schemas/tool.schema.json', 'shells/cli/src/bridge.ts', 'shells/web/src/capture/page-walk.ts', 'scripts/build-mcp-fn.ts',
    'scripts/mcp-fn-absent-runtime.ts', 'scripts/lib/workspace-aliases.ts', 'package.json', 'services/mcp/package.json',
    'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'tsconfig.json', 'engine/tsconfig.json']) {
    const verdict = judge(true, 'pull_request', ['docs/using.md', path]);
    assert.deepEqual(verdict, { status: 'fail', inputs: [path] }, path);
  }
});

test('drift a pull request did not cause is only a warning', () => {
  for (const path of ['docs/using.md', 'tests/url-mode.test.ts', 'engine/src/units.test.ts', 'engine/README.md',
    'shells/web/src/README.md', 'services/mcp/test/hosted.test.ts', 'tests/fixtures/x/package-shape.json',
    'community/qr-code/hooks.js', 'brands/lolly-start/catalog/tools/index.json', '.github/workflows/ci.yml',
    'scripts/check-api-bundles.ts', 'shells/tauri-desktop/src/main.ts']) {
    assert.equal(isBundleInput(path), false, path);
    assert.deepEqual(judge(true, 'pull_request', [path]), { status: 'warn', inputs: [] }, path);
  }
  assert.deepEqual(judge(true, 'pull_request', []), { status: 'warn', inputs: [] });
});

test('a bundle file itself is always an input, even as Markdown or a fixture path', () => {
  assert.equal(isBundleInput('api/mcp/notes.md'), true);
  assert.equal(isBundleInput('api/test/fixture.js'), true);
});
