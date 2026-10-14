// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { test } from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('./main.ts', import.meta.url), 'utf8');
const tree = ts.createSourceFile('main.ts', source, ts.ScriptTarget.Latest, true);
const boot = tree.statements.find((node): node is ts.FunctionDeclaration =>
  ts.isFunctionDeclaration(node) && node.name?.text === 'boot');
assert.ok(boot?.body);
const statements = boot.body.statements;
function declaration(name: string): ts.VariableStatement {
  const node = statements.find((item): item is ts.VariableStatement => ts.isVariableStatement(item)
    && item.declarationList.declarations.some(d => ts.isIdentifier(d.name) && d.name.text === name));
  assert.ok(node, `boot declaration ${name} is missing`);
  return node;
}
const captured = [declaration('bootRoute'), declaration('scriptedExport')];
const prefetch = statements.find(node => ts.isIfStatement(node) && node.getText(tree).includes('syncCorePrefetch('));
assert.ok(prefetch, 'the core prefetch scheduler is missing');

interface Route { name: string; params?: string }
async function runWarmup(initial: Route, rewritten: Route, iframe = false): Promise<string[]> {
  let current = initial;
  let ready!: () => void;
  const catalogReady = new Promise<void>(resolve => { ready = resolve; });
  const calls: string[] = [];
  // Execute the actual captured decision and scheduling statement without booting the UI.
  const code = [...captured.map(node => node.getText(tree)), 'rewrite();', prefetch!.getText(tree)].join('\n');
  const execute = new Function('parseRoute', 'rewrite', 'isIframeMode', 'catalogReady', 'afterWelcomeIdle', 'syncCorePrefetch', 'host',
    stripTypeScriptTypes(code));
  execute(() => current, () => { current = rewritten; }, () => iframe, catalogReady,
    (run: () => void) => { calls.push('idle'); run(); }, () => { calls.push('prefetch'); }, {});
  assert.deepEqual(calls, [], 'warmup must wait for the accepted catalog');
  ready();
  await catalogReady;
  await Promise.resolve();
  return calls;
}

test('scripted exports never schedule asset prefetch after the URL is rewritten', async () => {
  for (const params of ['url=https%3A%2F%2Flolly.ing&format=svg&export=1', 'export']) {
    assert.deepEqual(await runWarmup({ name: 'tool', params }, { name: 'tool', params: '' }), []);
  }
});

test('ordinary tool and gallery boots retain asset warming after catalog readiness', async () => {
  for (const route of [{ name: 'gallery' }, { name: 'tool', params: 'url=https%3A%2F%2Flolly.ing' }]) {
    assert.deepEqual(await runWarmup(route, { name: 'tool', params: 'export=1' }), ['idle', 'prefetch']);
  }
});

test('framed tools retain their existing no-prefetch behavior', async () => {
  assert.deepEqual(await runWarmup({ name: 'tool', params: '' }, { name: 'tool', params: '' }, true), []);
});

test('export intent is captured synchronously before boot can yield', () => {
  assert.equal(statements[0], captured[0]);
  assert.equal(statements[1], captured[1]);
});
