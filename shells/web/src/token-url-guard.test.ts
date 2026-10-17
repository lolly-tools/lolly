// SPDX-License-Identifier: MPL-2.0
/**
 * Token address guard.
 *
 * A Work instance may answer a byte route with a 302 to a short-lived token
 * address: `/e/i/<sha256>.<ext>?dt=` or `/o/<key>.<ext>?X-Amz-...`. `<img>`,
 * window.fetch and the Tauri `remote_fetch` command all follow that hop, and
 * each reports the final address as `response.url` (lib/instance.test.ts covers
 * the Tauri path). A token is a credential that expires in minutes, so no
 * reference the shell keeps may hold one: not a saved session, not a `.lolly`
 * pack and not a C2PA ingredient `url`. Each of those is built from the address
 * the shell asked for or from catalog data, and the only way a redirect target
 * reaches shell code is a read of the response's own address.
 *
 * The rule this pins: no module in the web shell or the Tauri bridge overrides
 * reads `.url` (or a `Location` header) off a fetch response, apart from the
 * transport adapters listed in ALLOWED. A response here is anything returned
 * by a call whose name ends in `fetch` (fetch, instanceFetch, io.fetch,
 * conditionalFetch), held in a variable, annotated as `Response`, or handed to
 * a `.then` callback. If this fails: keep the address you requested (or the
 * asset id) and use that; never store the address a response came from.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const SRC = dirname(fileURLToPath(import.meta.url));
const SHELLS = join(SRC, '..', '..');
const ROOTS = [
  SRC,
  join(SHELLS, 'tauri-desktop', 'bridge-overrides'),
  join(SHELLS, 'tauri-mobile', 'bridge-overrides'),
  join(SHELLS, 'tauri-shared', 'bridge-overrides'),
];

/** Files that may read a response's own address, each with its reason. */
const ALLOWED: Record<string, string> = {
  'web/src/catalog/tool-bytes.ts':
    'copies the transport address onto the verified Response it returns to a template library loader, in memory only',
};

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir).sort()) {
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) out.push(...sourceFiles(abs));
    else if (/\.ts$/.test(entry) && !/\.(test|d)\.ts$/.test(entry)) out.push(abs);
  }
  return out;
}

const FETCH_NAME = /fetch$/i;

function unwrap(node: ts.Node): ts.Node {
  let current = node;
  while (ts.isParenthesizedExpression(current) || ts.isAwaitExpression(current) || ts.isNonNullExpression(current)
    || ts.isAsExpression(current) || ts.isSatisfiesExpression(current) || ts.isTypeAssertionExpression(current)) {
    current = current.expression;
  }
  return current;
}

function isFetchCall(node: ts.Node): boolean {
  const call = unwrap(node);
  if (!ts.isCallExpression(call)) return false;
  const callee = unwrap(call.expression);
  const name = ts.isIdentifier(callee) ? callee.text : ts.isPropertyAccessExpression(callee) ? callee.name.text : '';
  return FETCH_NAME.test(name);
}

function namesResponse(type: ts.TypeNode | undefined): boolean {
  return !!type && /\bResponse\b/.test(type.getText());
}

function isScope(node: ts.Node): boolean {
  return ts.isSourceFile(node) || ts.isBlock(node) || ts.isFunctionLike(node) || ts.isCaseBlock(node)
    || ts.isForStatement(node) || ts.isForOfStatement(node) || ts.isForInStatement(node) || ts.isCatchClause(node);
}

function scopeOf(node: ts.Node): ts.Node {
  let current = node.parent;
  while (!isScope(current)) current = current.parent;
  return current;
}

/** The callback a `.then` on a fetch call hands its response to, if `node` is its first parameter. */
function isThenResponseParam(param: ts.ParameterDeclaration): boolean {
  const fn = param.parent;
  if (fn.parameters[0] !== param || !(ts.isArrowFunction(fn) || ts.isFunctionExpression(fn))) return false;
  const call = fn.parent;
  if (!ts.isCallExpression(call) || call.arguments[0] !== fn) return false;
  const callee = call.expression;
  return ts.isPropertyAccessExpression(callee) && callee.name.text === 'then' && isFetchCall(callee.expression);
}

/**
 * Reads of a fetch response's own address in one module, as `line: text`. The
 * scope lookup is lexical and file-local, which is enough for the patterns this
 * shell uses: a response bound by `const`/`let`, assigned later, annotated as
 * `Response`, or passed to `.then`.
 */
export function responseAddressReads(fileName: string, text: string): string[] {
  const file = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const bindings = new Map<string, Array<{ scope: ts.Node; response: () => boolean }>>();
  const bind = (name: string, scope: ts.Node, response: () => boolean) => {
    bindings.set(name, [...(bindings.get(name) ?? []), { scope, response }]);
  };
  const visiting = new Set<ts.Node>();
  const isResponse = (node: ts.Node): boolean => {
    const value = unwrap(node);
    if (isFetchCall(value)) return true;
    if (ts.isBinaryExpression(value) && (value.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
      || value.operatorToken.kind === ts.SyntaxKind.BarBarToken)) return isResponse(value.left) || isResponse(value.right);
    if (ts.isConditionalExpression(value)) return isResponse(value.whenTrue) || isResponse(value.whenFalse);
    if (!ts.isIdentifier(value) || visiting.has(value)) return false;
    const candidates = (bindings.get(value.text) ?? [])
      .filter(({ scope }) => scope.pos <= value.pos && value.end <= scope.end)
      .sort((a, b) => (a.scope.end - a.scope.pos) - (b.scope.end - b.scope.pos));
    const innermost = candidates[0]?.scope;
    visiting.add(value);
    try { return candidates.some(({ scope, response }) => scope === innermost && response()); }
    finally { visiting.delete(value); }
  };

  // `res = await instanceFetch(...)` after a bare `let res;` counts for that declaration.
  const assignments: Array<{ name: string; node: ts.BinaryExpression }> = [];
  const assignedResponse = (name: string, scope: ts.Node) => assignments.some(({ name: assigned, node }) =>
    assigned === name && scope.pos <= node.pos && node.end <= scope.end && isResponse(node.right));
  const collect = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      const { initializer, type } = node, name = node.name.text, scope = scopeOf(node);
      bind(name, scope, () => namesResponse(type) || (!!initializer && isResponse(initializer)) || assignedResponse(name, scope));
    } else if (ts.isParameter(node) && ts.isIdentifier(node.name)) {
      const param = node, name = node.name.text;
      bind(name, param.parent, () => namesResponse(param.type) || isThenResponseParam(param) || assignedResponse(name, param.parent));
    } else if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isIdentifier(node.left)) {
      assignments.push({ name: node.left.text, node });
    }
    ts.forEachChild(node, collect);
  };
  collect(file);

  const reads: string[] = [];
  const report = (node: ts.Node) => {
    const { line } = file.getLineAndCharacterOfPosition(node.getStart(file));
    reads.push(`${line + 1}: ${node.getText(file).replace(/\s+/g, ' ').slice(0, 120)}`);
  };
  const isWrite = (node: ts.Node) => ts.isBinaryExpression(node.parent) && node.parent.left === node
    && node.parent.operatorToken.kind === ts.SyntaxKind.EqualsToken;
  const destructuresUrl = (pattern: ts.BindingName) => ts.isObjectBindingPattern(pattern)
    && pattern.elements.some(element => (element.propertyName ?? element.name).getText(file) === 'url');

  // `res.headers.get('location')`: the redirect target itself, under `redirect: 'manual'`.
  const readsLocation = (node: ts.CallExpression) => {
    const callee = node.expression, first = node.arguments[0];
    return ts.isPropertyAccessExpression(callee) && callee.name.text === 'get'
      && ts.isPropertyAccessExpression(callee.expression) && callee.expression.name.text === 'headers'
      && !!first && ts.isStringLiteralLike(first) && first.text.toLowerCase() === 'location'
      && isResponse(callee.expression.expression);
  };

  const inspect = (node: ts.Node): void => {
    if (ts.isPropertyAccessExpression(node) && node.name.text === 'url' && !isWrite(node) && isResponse(node.expression)) report(node);
    else if (ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression)
      && node.argumentExpression.text === 'url' && !isWrite(node) && isResponse(node.expression)) report(node);
    else if (ts.isVariableDeclaration(node) && node.initializer && destructuresUrl(node.name) && isResponse(node.initializer)) report(node);
    else if (ts.isParameter(node) && destructuresUrl(node.name) && isThenResponseParam(node)) report(node);
    else if (ts.isCallExpression(node) && readsLocation(node)) report(node);
    ts.forEachChild(node, inspect);
  };
  inspect(file);
  return reads;
}

test('the detector finds each way a response address can be read', () => {
  const flagged = (source: string) => responseAddressReads('probe.ts', source).length;
  for (const source of [
    'async function a(u: string) { const resp = await instanceFetch(u); await db.put("profile", { src: resp.url }); }',
    'async function a(u: string) { let res; res = await fetch(u); keep(res.url); }',
    'async function a(u: string) { const res = await (adoptBootFetch(u) ?? instanceFetch(u)); keep(res.url); }',
    'async function a(u: string) { keep((await io.fetch(u)).url); }',
    'function a(u: string) { return fetch(u).then(r => r.url); }',
    'function a(u: string) { return fetch(u).then(({ url }) => url); }',
    'async function a(u: string) { const { url } = await instanceFetch(u); keep(url); }',
    'function a(r: Response) { keep(r["url"]); }',
    'async function a(u: string) { const r = await fetch(u, { redirect: "manual" }); keep(r.headers.get("Location")); }',
  ]) assert.equal(flagged(source), 1, source);
  for (const source of [
    'async function a(id: string) { const ref = await host.assets.get(id); keep(ref.url); }',
    'function a(id: string) { return host.assets.get(id).then(res => res.url); }',
    'async function a(ref: { url: string }) { const resp = await fetch(ref.url); keep(ref.url, await resp.blob()); }',
    'async function a(u: string) { const out = await fetch(u); out.url = u; }',
    'async function a(u: string) { const res = await fetch(u); keep(res.headers.get("content-type")); }',
    'async function a(u: string) { { const res = await fetch(u); keep(res.ok); } const res = await host.assets.get(u); keep(res.url); }',
  ]) assert.equal(flagged(source), 0, source);
});

test('no shell module keeps the address a fetch response came from', () => {
  const offenders: string[] = [];
  const allowedSeen = new Set<string>();
  for (const root of ROOTS) {
    for (const file of sourceFiles(root)) {
      const text = readFileSync(file, 'utf8');
      // Cheap prefilter: a module needs a response and an address read to have anything to report.
      if (!/fetch\s*\(|\bResponse\b/i.test(text) || !/\.\s*url\b|\[\s*['"`]url['"`]\s*\]|\burl\s*[,}:]|['"`]location['"`]/i.test(text)) continue;
      const reads = responseAddressReads(file, text);
      if (!reads.length) continue;
      const rel = relative(SHELLS, file).replaceAll('\\', '/');
      if (ALLOWED[rel]) { allowedSeen.add(rel); continue; }
      offenders.push(...reads.map(read => `${rel}:${read}`));
    }
  }
  assert.deepEqual(offenders, [],
    'a redirect can make response.url a short-lived token address (dt= or X-Amz-); keep the requested address or the asset id instead');
  assert.deepEqual([...allowedSeen].sort(), Object.keys(ALLOWED).sort(),
    'every allowed adapter still reads the address; drop an entry whose reason no longer holds');
});
