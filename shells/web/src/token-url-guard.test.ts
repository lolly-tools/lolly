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
 * reads the address off a fetch `Response`, apart from the transport adapters
 * listed in ALLOWED. The scan uses the TypeScript checker over the web shell's
 * own tsconfig plus the three bridge-overrides directories, so a response is
 * anything whose type is or includes the global `Response`, however it got
 * there: a wrapper such as `request()` or `sendJson()`, `fetch(u).catch(() =>
 * null)`, `Promise.all(urls.map(fetch))` or a parameter. A read is `.url`,
 * `['url']`, a destructured or assigned `url`, `Reflect.get(r, 'url')` or
 * `r.headers.get('location')`. Where a type is missing (an `any`, such as an
 * import the CI checkout cannot resolve), a value from a call with `fetch` in
 * its name still counts. If this fails: keep the address you requested (or the
 * asset id) and use that; never store the address a response came from.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const SRC = dirname(fileURLToPath(import.meta.url));
const WEB = join(SRC, '..');
const SHELLS = join(WEB, '..');
const OVERRIDES = ['tauri-desktop', 'tauri-mobile', 'tauri-shared'].map(shell => join(SHELLS, shell, 'bridge-overrides'));
const ROOTS = [SRC, ...OVERRIDES];

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

/** Shell code the scan covers: not tests, declarations or vendored third-party modules. */
function scanned(fileName: string): boolean {
  return ROOTS.some(root => fileName.startsWith(`${root}/`)) && /\.[cm]?[jt]s$/.test(fileName)
    && !/\.d\.[cm]?ts$|\.test\.[cm]?[jt]s$|\/vendor\//.test(fileName);
}

function guardConfig(): { rootNames: string[]; options: ts.CompilerOptions } {
  const configPath = join(WEB, 'tsconfig.json');
  const { config, error } = ts.readConfigFile(configPath, ts.sys.readFile);
  if (error) throw new Error(ts.flattenDiagnosticMessageText(error.messageText, '\n'));
  const parsed = ts.parseJsonConfigFileContent(config, ts.sys, WEB, undefined, configPath);
  return { rootNames: [...parsed.fileNames, ...OVERRIDES.flatMap(sourceFiles)], options: parsed.options };
}

// Parsed files are shared between the programs below, so the lib files and the
// unchanged shell modules are read and parsed once.
const parsedFiles = new Map<string, ts.SourceFile>();

function guardProgram(rootNames: readonly string[], options: ts.CompilerOptions, overrides = new Map<string, string>(), oldProgram?: ts.Program): ts.Program {
  const host = ts.createCompilerHost(options, true);
  const { fileExists, readFile, getSourceFile } = host;
  host.fileExists = name => overrides.has(name) || fileExists.call(host, name);
  host.readFile = name => overrides.get(name) ?? readFile.call(host, name);
  host.getSourceFile = (name, language, onError, shouldCreate) => {
    const text = overrides.get(name);
    if (text !== undefined) return ts.createSourceFile(name, text, language, true);
    let file = parsedFiles.get(name);
    if (!file) {
      file = getSourceFile.call(host, name, language, onError, shouldCreate);
      if (file) parsedFiles.set(name, file);
    }
    return file;
  };
  return ts.createProgram({ rootNames, options, host, oldProgram });
}

let shellProgram: ts.Program | undefined;
const shell = () => {
  if (!shellProgram) {
    const { rootNames, options } = guardConfig();
    shellProgram = guardProgram(rootNames, options);
  }
  return shellProgram;
};

const FETCH_NAME = /fetch/i;

function unwrap(node: ts.Node): ts.Node {
  let current = node;
  while (ts.isParenthesizedExpression(current) || ts.isAwaitExpression(current) || ts.isNonNullExpression(current)
    || ts.isAsExpression(current) || ts.isSatisfiesExpression(current) || ts.isTypeAssertionExpression(current)) {
    current = current.expression;
  }
  return current;
}

function nameText(name: ts.Node): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteralLike(name)) return name.text;
  if (ts.isComputedPropertyName(name) && ts.isStringLiteralLike(name.expression)) return name.expression.text;
  return undefined;
}

const isUrlLiteral = (node: ts.Node | undefined) => !!node && ts.isStringLiteralLike(node) && node.text === 'url';

/** Reads of a fetch response's own address in one module of `program`, as `line: text`. */
export function responseAddressReads(program: ts.Program, file: ts.SourceFile): string[] {
  const checker = program.getTypeChecker();
  const responseSymbol = checker.resolveName('Response', undefined, ts.SymbolFlags.Type, false);
  assert.ok(responseSymbol, 'the DOM lib declares Response');
  const response = checker.getDeclaredTypeOfSymbol(responseSymbol);

  const isResponseType = (type: ts.Type): boolean => {
    const resolved = checker.getBaseConstraintOfType(type) ?? type;
    return (resolved.isUnion() ? resolved.types : [resolved]).some(part =>
      !(part.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.Never))
      && checker.isTypeAssignableTo(part, response));
  };

  // Without a type, fall back on the name: a value from a call with `fetch` in
  // its name, directly, through `.catch()` or `.finally()`, through a variable,
  // or handed to that call's `.then` callback.
  const fromFetchCall = (node: ts.Node, seen = new Set<ts.Node>()): boolean => {
    const value = unwrap(node);
    if (seen.has(value)) return false;
    seen.add(value);
    if (ts.isCallExpression(value)) {
      const callee = unwrap(value.expression);
      if (ts.isPropertyAccessExpression(callee) && ['catch', 'finally'].includes(callee.name.text)) return fromFetchCall(callee.expression, seen);
      return FETCH_NAME.test(ts.isIdentifier(callee) ? callee.text : ts.isPropertyAccessExpression(callee) ? callee.name.text : '');
    }
    if (ts.isBinaryExpression(value) && [ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.BarBarToken].includes(value.operatorToken.kind)) {
      return fromFetchCall(value.left, seen) || fromFetchCall(value.right, seen);
    }
    if (ts.isConditionalExpression(value)) return fromFetchCall(value.whenTrue, seen) || fromFetchCall(value.whenFalse, seen);
    if (!ts.isIdentifier(value)) return false;
    const declaration = checker.getSymbolAtLocation(value)?.valueDeclaration;
    if (declaration && ts.isVariableDeclaration(declaration) && declaration.initializer) return fromFetchCall(declaration.initializer, seen);
    return !!declaration && ts.isParameter(declaration) && thenArgument(declaration, seen);
  };
  const thenArgument = (param: ts.ParameterDeclaration, seen?: Set<ts.Node>): boolean => {
    const fn = param.parent;
    if (!(ts.isArrowFunction(fn) || ts.isFunctionExpression(fn)) || fn.parameters[0] !== param) return false;
    const call = fn.parent;
    return ts.isCallExpression(call) && call.arguments[0] === fn && ts.isPropertyAccessExpression(call.expression)
      && call.expression.name.text === 'then' && fromFetchCall(call.expression.expression, seen);
  };

  const isResponse = (node: ts.Node) => {
    const type = checker.getTypeAtLocation(node);
    return isResponseType(type) || (!!(type.flags & ts.TypeFlags.Any) && fromFetchCall(node));
  };
  // A destructuring pattern's type is the type of the value it takes apart.
  const isResponsePattern = (pattern: ts.ObjectBindingPattern) => {
    const type = checker.getTypeAtLocation(pattern);
    if (isResponseType(type)) return true;
    if (!(type.flags & ts.TypeFlags.Any)) return false;
    const owner = pattern.parent;
    if (ts.isVariableDeclaration(owner)) return !!owner.initializer && fromFetchCall(owner.initializer);
    return ts.isParameter(owner) && thenArgument(owner);
  };

  const isWrite = (node: ts.Node) => ts.isBinaryExpression(node.parent) && node.parent.left === node
    && node.parent.operatorToken.kind === ts.SyntaxKind.EqualsToken;
  const assignedFrom = (node: ts.ObjectLiteralExpression) => ts.isBinaryExpression(node.parent) && node.parent.left === node
    && node.parent.operatorToken.kind === ts.SyntaxKind.EqualsToken ? node.parent.right : undefined;
  const takesUrl = (properties: readonly ts.Node[]) => properties.some(property =>
    (ts.isBindingElement(property) && nameText(property.propertyName ?? property.name) === 'url')
    || ((ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property)) && nameText(property.name) === 'url'));
  // `Reflect.get(r, 'url')`.
  const reflectedFrom = (node: ts.CallExpression) => {
    const callee = node.expression;
    return ts.isPropertyAccessExpression(callee) && callee.name.text === 'get' && ts.isIdentifier(callee.expression)
      && callee.expression.text === 'Reflect' && isUrlLiteral(node.arguments[1]) ? node.arguments[0] : undefined;
  };
  // `r.headers.get('location')`: the redirect target itself, under `redirect: 'manual'`.
  const locationFrom = (node: ts.CallExpression) => {
    const callee = node.expression, first = node.arguments[0];
    return ts.isPropertyAccessExpression(callee) && callee.name.text === 'get'
      && ts.isPropertyAccessExpression(callee.expression) && callee.expression.name.text === 'headers'
      && first !== undefined && ts.isStringLiteralLike(first) && first.text.toLowerCase() === 'location' ? callee.expression.expression : undefined;
  };

  const reads: string[] = [];
  const report = (node: ts.Node) => {
    const { line } = file.getLineAndCharacterOfPosition(node.getStart(file));
    reads.push(`${line + 1}: ${node.getText(file).replace(/\s+/g, ' ').slice(0, 120)}`);
  };
  const inspect = (node: ts.Node): void => {
    let receiver: ts.Node | undefined;
    if (ts.isPropertyAccessExpression(node) && node.name.text === 'url' && !isWrite(node)) receiver = node.expression;
    else if (ts.isElementAccessExpression(node) && isUrlLiteral(node.argumentExpression) && !isWrite(node)) receiver = node.expression;
    else if (ts.isObjectLiteralExpression(node) && takesUrl(node.properties)) receiver = assignedFrom(node);
    else if (ts.isCallExpression(node)) receiver = reflectedFrom(node) ?? locationFrom(node);
    if (receiver ? isResponse(receiver) : ts.isObjectBindingPattern(node) && takesUrl(node.elements) && isResponsePattern(node)) report(node);
    ts.forEachChild(node, inspect);
  };
  inspect(file);
  return reads;
}

const PRELUDE = `export {};
declare function keep(...values: unknown[]): void;
declare function instanceFetch(input: string): Promise<Response>;
declare function adoptBootFetch(input: string): Promise<Response> | null;
declare const io: { fetch: typeof fetch };
declare const host: { assets: { get(id: string): Promise<{ url: string; type?: string }> } };
declare const db: { put(store: string, value: unknown): Promise<void> };
declare const nativeFetch: any;
declare const untyped: any;
`;

test('the detector finds each way a response address can be read', () => {
  const found = [
    'async function a(u: string) { const resp = await instanceFetch(u); await db.put("profile", { src: resp.url }); }',
    'async function a(u: string) { let res; res = await fetch(u); keep(res.url); }',
    'async function a(u: string) { const res = await (adoptBootFetch(u) ?? instanceFetch(u)); keep(res.url); }',
    'async function a(u: string) { keep((await io.fetch(u)).url); }',
    'function a(u: string) { return fetch(u).then(r => r.url); }',
    'function a(u: string) { return fetch(u).then(({ url }) => url); }',
    'async function a(u: string) { const { url } = await instanceFetch(u); keep(url); }',
    'function a(r: Response) { keep(r["url"]); }',
    'async function a(u: string) { const r = await fetch(u, { redirect: "manual" }); keep(r.headers.get("Location")); }',
    // Wrappers and shapes a name match cannot see.
    'async function a(u: string, fetchFn: typeof fetch) { const r = await fetchFn(u); keep(r.url); }',
    'async function request(u: string): Promise<Response> { return fetch(u); } async function a(u: string) { const res = await request(u); keep(res.url); }',
    'async function sendJson(u: string): Promise<Response | null> { return u ? fetch(u) : null; } async function a(u: string) { const res = await sendJson(u); keep(res?.url); }',
    'async function a(u: string) { const response = await fetch(u).catch(() => null); keep(response?.url); }',
    'async function a(urls: string[]) { const all = await Promise.all(urls.map(fetch)); keep(all[0]?.url); }',
    'async function a(u: string) { keep(Reflect.get(await fetch(u), "url")); }',
    'async function a(u: string) { let x = ""; const r = await fetch(u); ({ url: x } = r); keep(x); }',
    'async function a(urls: string[]) { for (const { url } of await Promise.all(urls.map(u => fetch(u)))) keep(url); }',
    'async function a<T extends Response>(r: T) { keep(r.url); }',
    // No type to go on: the call name still counts.
    'async function a(u: string) { const r = await nativeFetch(u); keep(r.url); }',
    'async function a(u: string) { const r = await nativeFetch(u).catch(() => null); keep(r.url); }',
  ];
  const clean = [
    'async function a(id: string) { const ref = await host.assets.get(id); keep(ref.url); }',
    'function a(id: string) { return host.assets.get(id).then(res => res.url); }',
    'async function a(ref: { url: string }) { const resp = await fetch(ref.url); keep(ref.url, await resp.blob()); }',
    'async function a(u: string) { const out = await fetch(u); out.url = u; }',
    'async function a(u: string) { const res = await fetch(u); keep(res.headers.get("content-type")); }',
    'async function a(u: string) { { const res = await fetch(u); keep(res.ok); } const res = await host.assets.get(u); keep(res.url); }',
    'function a(request: Request) { keep(request.url); }',
    'function a() { keep(untyped.url, untyped.then((r: any) => r.url)); }',
    'async function a(u: string) { const { url } = await host.assets.get(u); keep(url); }',
  ];
  const probes = new Map<string, string>([...found, ...clean].map((source, index) => [join(SRC, '__guard_probe__', `case-${index}.ts`), PRELUDE + source]));
  const program = guardProgram([...probes.keys()], guardConfig().options, probes);
  const reads = [...probes.keys()].map(name => responseAddressReads(program, program.getSourceFile(name)!).length);
  for (const [index, source] of [...found, ...clean].entries()) assert.equal(reads[index], index < found.length ? 1 : 0, source);
});

/**
 * Real paths that hold a response under a name the old name match missed. Each
 * case adds `void <binding>?.url;` after the statement in that module and
 * expects the guard to report that line.
 */
const SHELL_PATHS = [
  { file: 'org/team-files.ts', path: 'downloadTeamFile, the /api/v1/projects/<id>/files/<id> route that redirects to /o/', binding: 'res', call: 'request(filePath(projectId' },
  { file: 'org/session-source.ts', path: 'the session document writer', binding: 'res', call: "sendJson('PUT', `/api/v1/sessions/" },
  { file: 'bridge/export-design-ops.ts', path: 'the bitmap read that feeds the C2PA ingredient sink', binding: 'response', call: 'fetch(asset.url).catch(' },
  { file: 'lib/google-fonts.ts', path: 'the Google Fonts face download', binding: 'resp', call: 'fetch(face.url).catch(' },
];

test('the guard catches a response address read on the session, project file and ingredient paths', () => {
  const base = shell();
  const overrides = new Map<string, string>();
  const expected = new Map<string, number>();
  for (const { file, path, binding, call } of SHELL_PATHS) {
    const name = join(SRC, file);
    const source = base.getSourceFile(name);
    assert.ok(source, `${file} is part of the scanned program`);
    assert.deepEqual(responseAddressReads(base, source), [], `${file} reads no response address today`);
    let statement: ts.Node | undefined;
    const find = (node: ts.Node): void => {
      if (!statement && ts.isVariableStatement(node) && node.declarationList.declarations.some(declaration =>
        ts.isIdentifier(declaration.name) && declaration.name.text === binding && !!declaration.initializer
        && declaration.initializer.getText(source).includes(call))) statement = node;
      else ts.forEachChild(node, find);
    };
    find(source);
    assert.ok(statement, `${file}: no \`const ${binding} = ... ${call}\` left for ${path}; point this case at where that response is held now`);
    const text = source.getFullText();
    overrides.set(name, `${text.slice(0, statement.end)} void ${binding}?.url;${text.slice(statement.end)}`);
    expected.set(name, source.getLineAndCharacterOfPosition(statement.end).line + 1);
  }
  const injected = guardProgram(base.getRootFileNames(), base.getCompilerOptions(), overrides, base);
  for (const { file, path, binding } of SHELL_PATHS) {
    const name = join(SRC, file);
    assert.deepEqual(responseAddressReads(injected, injected.getSourceFile(name)!), [`${expected.get(name)}: ${binding}?.url`],
      `${file}: a read on ${path} must fail the guard`);
  }
});

test('no shell module keeps the address a fetch response came from', () => {
  const program = shell();
  const offenders: string[] = [];
  const allowedSeen = new Set<string>();
  const covered = new Set<string>();
  for (const file of program.getSourceFiles()) {
    if (!scanned(file.fileName)) continue;
    covered.add(file.fileName);
    const reads = responseAddressReads(program, file);
    if (!reads.length) continue;
    const rel = relative(SHELLS, file.fileName).replaceAll('\\', '/');
    if (ALLOWED[rel]) { allowedSeen.add(rel); continue; }
    offenders.push(...reads.map(read => `${rel}:${read}`));
  }
  const missing = ROOTS.flatMap(sourceFiles).filter(file => scanned(file) && !covered.has(file));
  assert.deepEqual(missing, [], 'every shell module is in the scanned program');
  assert.deepEqual(offenders, [],
    'a redirect can make response.url a short-lived token address (dt= or X-Amz-); keep the requested address or the asset id instead');
  assert.deepEqual([...allowedSeen].sort(), Object.keys(ALLOWED).sort(),
    'every allowed adapter still reads the address; drop an entry whose reason no longer holds');
});
