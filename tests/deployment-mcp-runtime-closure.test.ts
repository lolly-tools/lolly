// SPDX-License-Identifier: MPL-2.0
/** A workspace install is insufficient when the final image omits a link target. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const manifests = new Map<string, { path: string; dependencies: Record<string, string> }>(
  ['services/mcp', 'engine', 'packages/core', 'packages/node-shell', 'packages/rondo'].map(path => {
    const manifest = JSON.parse(read(`${path}/package.json`)) as { name: string; dependencies?: Record<string, string> };
    return [manifest.name, { path, dependencies: manifest.dependencies ?? {} }];
  })
);

/** Follow the actual production manifests so a new required workspace is visible. */
function workspaceClosure(name: string): Set<string> {
  const paths = new Set<string>();
  const visit = (current: string): void => {
    const manifest = manifests.get(current);
    assert.ok(manifest, `Unreviewed runtime workspace ${current}`);
    if (paths.has(manifest.path)) return;
    paths.add(manifest.path);
    for (const [dependency, version] of Object.entries(manifest.dependencies))
      if (version.startsWith('workspace:')) visit(dependency);
  };
  visit(name);
  return paths;
}

for (const file of ['mcp.Dockerfile', 'mcp-browser.Dockerfile']) {
  test(`${file} copies every transitive production workspace into the final image`, () => {
    const instructions = read(`deploy/docker/${file}`).replace(/^\s*#.*$/gm, '');
    const runtime = instructions.split(/^FROM /m).at(-1)!;
    const copied = new Map([...runtime.matchAll(/^COPY --from=build \/src\/(\S+) \.\/(\S+)$/gm)]
      .map(match => [match[1]!, match[2]!]));
    for (const path of workspaceClosure('@lolly/mcp-server'))
      assert.equal(copied.get(path), path, `${file}: missing workspace link target ${path}`);
    assert.equal(copied.get('node_modules'), 'node_modules', 'production package store is retained');
    assert.ok(workspaceClosure('@lolly/mcp-server').has('packages/rondo'));
    assert.ok(!/^RUN .*rm .*packages\/rondo(?:\/node_modules)?/m.test(runtime));
  });

  test(`${file} checks real MCP imports and instantiates QuickJS after the final copies`, () => {
    const runtime = read(`deploy/docker/${file}`).split(/^FROM /m).at(-1)!;
    const check = runtime.indexOf('RUN node --input-type=module -e "await import(\'./services/mcp/src/server.ts\');');
    assert.ok(check > runtime.indexOf('COPY --from=build /src/packages/rondo ./packages/rondo'));
    assert.ok(check > runtime.indexOf('COPY --from=build /runtime-content/catalog ./catalog'));
    assert.ok(check < runtime.indexOf('USER node'));
    assert.match(runtime.slice(check), /await import\('\.\/packages\/rondo\/src\/index\.ts'\); await quickjs\(\);/);
    assert.match(read('packages/rondo/package.json'), /"@jitl\/quickjs-wasmfile-release-sync": "0\.31\.0"/);
    assert.match(read('packages/rondo/package.json'), /"quickjs-emscripten-core": "0\.31\.0"/);
  });
}
