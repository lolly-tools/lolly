// SPDX-License-Identifier: MPL-2.0
/**
 * Split one giant view closure into feature modules that share an explicit context.
 *
 * The web shell grew several views as a single `function initX(opts) { ... }` holding
 * hundreds of nested functions over a few hundred closure variables (free-canvas.ts's
 * initFreeCanvas was 15,600 lines). This tool rewrites such a closure, checker-resolved
 * so every reference is exact:
 *
 *   - every closure-level variable becomes a property of one context object (`fc`),
 *     typed by a generated `interface` in `<outDir>/context.ts`; `const` variables stay
 *     local in the orchestrator and are published once (`fc.cfg = cfg`), `let` variables
 *     are read and written through the context everywhere;
 *   - every closure-level function moves verbatim into the module the plan assigns it
 *     to, gains `fc: <Ctx>` as its first parameter, aliases the `const` state it reads
 *     (`const { cfg, stageEl } = fc;`) and reads `let` state as `fc.x`;
 *   - each module exports an `<name>Ops(fc)` factory of bound wrappers, and the context
 *     carries one namespace per module (`fc.pen.enterPen()`), so cross-module calls and
 *     every use of a function as a value (event listeners) go through the context and
 *     no feature module imports another - the only edges are module -> context;
 *   - module-level declarations the closure used (types, constants, helpers) move to
 *     `<outDir>/shared.ts` so feature modules never import the orchestrator file.
 *
 * Usage: node scripts/split-closure.ts <plan.json> [--apply]
 * Without --apply the output is written under $SPLIT_OUT (default /tmp/split-closure).
 * The plan lists modules in source order, each starting at a named function; explicit
 * `overrides` move single functions elsewhere. See scripts/data/closure-splits/.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

interface Plan {
  file: string;            // repo-relative path of the view file
  fn: string;              // the closure function to split
  tsconfig: string;        // repo-relative tsconfig that covers the file
  outDir: string;          // repo-relative directory for the new modules
  ctxName: string;         // parameter/variable name of the context object, e.g. "fc"
  ctxType: string;         // interface name, e.g. "FcCtx"
  modules: Array<{ name: string; start?: string; doc?: string }>; // start: first function of the module (omit for a block-only module)
  overrides?: Record<string, string>;
  /** Runs of closure-level STATEMENTS (setup code, wiring) to lift into `export function <name>(ctx)` in a
   *  module; `from`/`to` are 1-based inclusive line numbers of the file as it is when the tool runs.
   *  Variables declared inside a block live on the context (read as `ctx.x` everywhere, no local alias). */
  blocks?: Array<{ name: string; module: string; from: number; to: number; doc?: string }>;
  renameImports?: Record<string, string>; // import local name -> name used inside feature modules (e.g. escape -> escapeText)
  header?: string;         // one-line description used in generated file headers
  prefix?: string;         // file-name prefix for context/shared/modules when outDir is shared with another split (e.g. "details-")
}

interface VarInfo { name: string; isConst: boolean; stmt: ts.VariableStatement | ts.ParameterDeclaration; decl: ts.VariableDeclaration | ts.ParameterDeclaration; typeText: string; nameNode: ts.Identifier; isParam?: boolean; blockResident?: boolean; declaredText?: string }
interface FnInfo { name: string; stmt: ts.Statement; node: ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression; arrow: boolean; module: string }
interface Edit { start: number; end: number; text: string }

function fail(msg: string): never { throw new Error(msg); }
/** Whether a module-level statement carries the `export` keyword. */
function isExported(st: ts.Statement): boolean {
  return ts.canHaveModifiers(st) && (ts.getModifiers(st) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
}

const plan = JSON.parse(readFileSync(path.resolve(process.argv[2] ?? fail('usage: split-closure <plan.json> [--apply]')), 'utf8')) as Plan;
const APPLY = process.argv.includes('--apply');
const ctx = plan.ctxName;
const CTX = plan.ctxType;
const abs = path.join(REPO, plan.file);
const outDir = APPLY ? path.join(REPO, plan.outDir) : path.join(process.env.SPLIT_OUT ?? '/tmp/split-closure', plan.outDir);
const orchestratorOut = APPLY ? abs : path.join(process.env.SPLIT_OUT ?? '/tmp/split-closure', plan.file);
const relOutFromView = ((): string => {
  // '.' when outDir IS the view's own directory (a second-level split beside its parent), never './/x'.
  const rel = path.relative(path.dirname(abs), path.join(REPO, plan.outDir)).replaceAll(path.sep, '/');
  return rel === '' ? '.' : rel.startsWith('.') ? rel : `./${rel}`;
})();
const relViewDirFromOut = path.relative(path.join(REPO, plan.outDir), path.dirname(abs)).replaceAll(path.sep, '/') || '.';
const PFX = plan.prefix ?? '';

const cfgPath = path.join(REPO, plan.tsconfig);
const cfg = ts.parseJsonConfigFileContent(ts.readConfigFile(cfgPath, ts.sys.readFile).config, ts.sys, path.dirname(cfgPath));
const program = ts.createProgram([abs], { ...cfg.options, noEmit: true });
const checker = program.getTypeChecker();
const sf = program.getSourceFile(abs) ?? fail(`not in program: ${abs}`);
const src = sf.getFullText();
const lineOf = (pos: number): number => sf.getLineAndCharacterOfPosition(pos).line + 1;

let target: ts.FunctionDeclaration | undefined;
ts.forEachChild(sf, (n) => { if (ts.isFunctionDeclaration(n) && n.name?.text === plan.fn) target = n; });
if (!target?.body) fail(`no function ${plan.fn}`);
const body = target.body;
const targetSym = target.name ? checker.getSymbolAtLocation(target.name) : undefined;
let selfRef = false;

// ---------------------------------------------------------------- module level
const importStmts = sf.statements.filter(ts.isImportDeclaration);
interface ImportBinding { spec: string; kind: 'default' | 'namespace' | 'named'; propertyName?: string; typeOnly: boolean }
const importBySym = new Map<ts.Symbol, ImportBinding & { local: string }>();
for (const st of importStmts) {
  const spec = (st.moduleSpecifier as ts.StringLiteral).text;
  const c = st.importClause; if (!c) continue;
  const reg = (id: ts.Identifier, b: ImportBinding): void => { const s = checker.getSymbolAtLocation(id); if (s) importBySym.set(s, { ...b, local: id.text }); };
  if (c.name) reg(c.name, { spec, kind: 'default', typeOnly: c.isTypeOnly });
  if (c.namedBindings) {
    if (ts.isNamespaceImport(c.namedBindings)) reg(c.namedBindings.name, { spec, kind: 'namespace', typeOnly: c.isTypeOnly });
    else for (const e of c.namedBindings.elements) reg(e.name, { spec, kind: 'named', propertyName: e.propertyName?.text, typeOnly: c.isTypeOnly || e.isTypeOnly });
  }
}
interface ModDecl { name: string; stmt: ts.Statement; exported: boolean; isType: boolean; isLet?: boolean; typeText?: string }
const modDeclBySym = new Map<ts.Symbol, ModDecl>();
const modStmtNames = new Map<ts.Statement, string[]>();
for (const st of sf.statements) {
  if (ts.isImportDeclaration(st) || st === target) continue;
  const names: ts.Identifier[] = [];
  let isType = false;
  if ((ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st) || ts.isEnumDeclaration(st)) && st.name) names.push(st.name);
  else if (ts.isInterfaceDeclaration(st) || ts.isTypeAliasDeclaration(st)) { names.push(st.name); isType = true; }
  else if (ts.isVariableStatement(st)) for (const d of st.declarationList.declarations) (function w(n: ts.Node) { if (ts.isIdentifier(n)) names.push(n); else ts.forEachChild(n, w); })(d.name);
  const exported = isExported(st);
  const isLet = ts.isVariableStatement(st) && !!(st.declarationList.flags & ts.NodeFlags.Let);
  for (const n of names) {
    const s = checker.getSymbolAtLocation(n); if (!s) continue;
    const decl = isLet ? (st as ts.VariableStatement).declarationList.declarations.find((d) => d.name === n) : undefined;
    const typeText = decl?.type ? src.slice(decl.type.getStart(sf), decl.type.end) : (isLet ? checker.typeToString(checker.getTypeAtLocation(n), n, ts.TypeFormatFlags.NoTruncation) : undefined);
    modDeclBySym.set(s, { name: n.text, stmt: st, exported, isType, isLet, typeText });
  }
  modStmtNames.set(st, names.map((n) => n.text));
}

const setterOf = (name: string): string => `set${name.charAt(0).toUpperCase()}${name.slice(1)}`;
const assignedModLets = new Set<ts.Symbol>();

// ---------------------------------------------------------------- closure level
const vars = new Map<ts.Symbol, VarInfo>();
const fns = new Map<ts.Symbol, FnInfo>();
const hoistedTypes: ts.Statement[] = [];
const hoistedTypeSyms = new Map<ts.Symbol, string>();
for (const st of body.statements) {
  if (ts.isFunctionDeclaration(st) && st.name) {
    const s = checker.getSymbolAtLocation(st.name) ?? fail(`no symbol ${st.name.text}`);
    fns.set(s, { name: st.name.text, stmt: st, node: st, arrow: false, module: '' });
  } else if (ts.isInterfaceDeclaration(st) || ts.isTypeAliasDeclaration(st)) {
    hoistedTypes.push(st);
    const s = checker.getSymbolAtLocation(st.name); if (s) hoistedTypeSyms.set(s, st.name.text);
  } else if (ts.isVariableStatement(st)) {
    const isConst = !!(st.declarationList.flags & ts.NodeFlags.Const);
    for (const d of st.declarationList.declarations) {
      if (ts.isIdentifier(d.name) && isConst && d.initializer && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer))) {
        const s = checker.getSymbolAtLocation(d.name) ?? fail(`no symbol ${d.name.text}`);
        fns.set(s, { name: d.name.text, stmt: st, node: d.initializer, arrow: true, module: '' });
        continue;
      }
      (function w(n: ts.Node) {
        if (ts.isIdentifier(n)) {
          const s = checker.getSymbolAtLocation(n) ?? fail(`no symbol ${n.text}`);
          vars.set(s, { name: n.text, isConst, stmt: st, decl: d, nameNode: n, typeText: '' });
        } else if (ts.isBindingElement(n)) { w(n.name); }
        else ts.forEachChild(n, (c) => { if (ts.isBindingElement(c) || ts.isObjectBindingPattern(c) || ts.isArrayBindingPattern(c)) w(c); });
      })(d.name);
    }
  }
}
/** Drop line and block comments from a type annotation's source text (string contents are kept). */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1').replace(/[ \t]+$/gm, '');
}
// the closure function's own parameters: constants the whole feature reads (`opts`, or its destructured members)
const paramVars: VarInfo[] = [];
for (const prm of target.parameters) {
  const annotatedType = prm.type ? stripComments(src.slice(prm.type.getStart(sf), prm.type.end)) : checker.typeToString(checker.getTypeAtLocation(prm.name), prm, ts.TypeFormatFlags.NoTruncation);
  // `x?: T` and `x: T = d` are `T | undefined` to a caller: the context field must accept the bare argument
  const paramType = (prm.questionToken || prm.initializer) && !/\bundefined\b/.test(annotatedType) ? `${annotatedType} | undefined` : annotatedType;
  // a parameter the body reassigns (`host = { ...host, state }`) is mutable state: every read goes through the context
  const reassigned = new Set<ts.Symbol>();
  (function w(n: ts.Node) {
    if (ts.isIdentifier(n) && isWriteTarget(n)) { const sym = checker.getSymbolAtLocation(n); if (sym) reassigned.add(sym); }
    ts.forEachChild(n, w);
  })(body);
  const reg = (id: ts.Identifier, annotated: string): void => {
    const sym = checker.getSymbolAtLocation(id) ?? fail(`no symbol for parameter ${id.text}`);
    if (reassigned.has(sym)) {
      console.error(`parameter ${id.text} is reassigned inside ${plan.fn}: treated as mutable context state`);
      const v: VarInfo = { name: id.text, isConst: false, stmt: prm, decl: prm, nameNode: id, typeText: annotated, isParam: true };
      vars.set(sym, v); paramVars.push(v); return;
    }
    const lastStmt = body.statements[body.statements.length - 1];
    let typeText = annotated;
    if (lastStmt) {
      const narrowedText = checker.typeToString(checker.getTypeOfSymbolAtLocation(sym, lastStmt), id, ts.TypeFormatFlags.NoTruncation);
      const stripped = annotated.replace(/\s*\|\s*(null|undefined)\b/g, '').replace(/\b(null|undefined)\s*\|\s*/g, '');
      if (/\b(null|undefined)\b/.test(annotated) && !/\b(null|undefined)\b/.test(narrowedText)) typeText = stripped;
    }
    const v: VarInfo = { name: id.text, isConst: true, stmt: prm, decl: prm, nameNode: id, typeText, isParam: true };
    vars.set(sym, v); paramVars.push(v);
  };
  if (ts.isIdentifier(prm.name)) reg(prm.name, paramType);
  else if (ts.isObjectBindingPattern(prm.name)) {
    for (const el of prm.name.elements) {
      if (!ts.isIdentifier(el.name)) fail(`nested destructuring in parameter at line ${lineOf(el.getStart(sf))} - convert by hand first`);
      const prop = (el.propertyName ?? el.name) as ts.Identifier;
      reg(el.name, /^[A-Za-z_$][\w$]*$/.test(paramType) ? `${paramType}['${prop.text}']` : checker.typeToString(checker.getTypeAtLocation(el.name), el, ts.TypeFormatFlags.NoTruncation));
    }
  } else fail(`array-destructured parameter at line ${lineOf(prm.getStart(sf))} - convert by hand first`);
}
// state types: annotation text if present, else `<Owner>['prop']` for destructured members of a named type, else the checker's string
const typeFlags = ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope;
for (const v of vars.values()) {
  if (v.isParam) continue;
  const d = v.decl as ts.VariableDeclaration;
  if (ts.isIdentifier(d.name) && d.type) {
    const annotated = stripComments(src.slice(d.type.getStart(sf), d.type.end));
    if (v.isConst) {
      const lastStmt = body.statements[body.statements.length - 1];
      const sym = checker.getSymbolAtLocation(v.nameNode);
      const narrowedText = sym && lastStmt ? checker.typeToString(checker.getTypeOfSymbolAtLocation(sym, lastStmt), v.nameNode, typeFlags) : annotated;
      // keep the author's annotation unless a top-level guard narrowed nullability away
      const stripped = annotated.replace(/\s*\|\s*(null|undefined)\b/g, '').replace(/\b(null|undefined)\s*\|\s*/g, '');
      v.typeText = /\b(null|undefined)\b/.test(annotated) && !/\b(null|undefined)\b/.test(narrowedText) ? stripped : annotated;
    } else v.typeText = annotated;
    continue;
  }
  const elem = v.nameNode.parent;
  if (ts.isBindingElement(elem) && ts.isObjectBindingPattern(elem.parent) && elem.parent === d.name && d.initializer) {
    const ownerType = checker.getTypeAtLocation(d.initializer);
    const ownerText = checker.typeToString(ownerType, d, typeFlags);
    if (/^[A-Za-z_$][\w$]*$/.test(ownerText)) { const prop = (elem.propertyName ?? elem.name) as ts.Identifier; v.typeText = `${ownerText}['${prop.text}']`; continue; }
  }
  const lastStmt = body.statements[body.statements.length - 1];
  const sym = checker.getSymbolAtLocation(v.nameNode);
  const narrowed = v.isConst && sym && lastStmt ? checker.getTypeOfSymbolAtLocation(sym, lastStmt) : checker.getTypeAtLocation(v.nameNode);
  v.typeText = checker.typeToString(narrowed, v.nameNode, typeFlags);
}
for (const v of vars.values()) v.typeText = v.typeText.replace(/(^|[^\w{])\{\}(?=$|[^\w}])/g, '$1object');


/** Type names referenced by a printed type: identifiers that are not property keys or string contents. */
function typeNamesIn(typeText: string): string[] {
  const noStrings = typeText.replace(/'[^']*'|"[^"]*"/g, '""');
  const noKeys = noStrings.replace(/\b[A-Za-z_$][\w$]*\??\s*:/g, ':').replace(/\b[A-Za-z_$][\w$]*\s*(?=\()/g, '');
  return [...noKeys.matchAll(/[A-Za-z_$][\w$]*/g)].map((m) => m[0]);
}

// the context name must be free: any local, parameter or binding named like it would shadow it
{
  const clashes: number[] = [];
  (function w(n: ts.Node) {
    if (ts.isIdentifier(n) && n.text === ctx && isDeclName(n)) clashes.push(lineOf(n.getStart(sf)));
    ts.forEachChild(n, w);
  })(body);
  if (clashes.length) fail(`ctxName "${ctx}" is declared inside ${plan.fn} at line(s) ${clashes.slice(0, 8).join(', ')}${clashes.length > 8 ? ', …' : ''} - pick another ctxName in the plan`);
}

// module assignment
const fnList = [...fns.values()].sort((a, b) => a.stmt.getStart(sf) - b.stmt.getStart(sf));
{
  const starts = new Map(plan.modules.filter((m) => m.start).map((m) => [m.start!, m.name]));
  let current = plan.modules.find((m) => m.start)?.name ?? fail('plan.modules has no module with a start function');
  let sawFirst = false;
  for (const f of fnList) {
    if (starts.has(f.name)) { current = starts.get(f.name)!; sawFirst = true; }
    if (!sawFirst) fail(`first function ${f.name} precedes the first module marker ${plan.modules.find((m) => m.start)?.start}`);
    f.module = plan.overrides?.[f.name] ?? current;
  }
  for (const m of plan.modules) if (m.start && !fnList.some((f) => f.name === m.start)) fail(`module ${m.name} start ${m.start} is not a closure function`);
  for (const b of plan.blocks ?? []) if (!plan.modules.some((m) => m.name === b.module)) fail(`block ${b.name} names unknown module ${b.module}`);
  for (const f of fnList) if (!plan.modules.some((m) => m.name === f.module)) fail(`${f.name} assigned to unknown module ${f.module}`);
}
const fnByName = new Map(fnList.map((f) => [f.name, f]));
const fileOf = (name: string): string => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
type BlockPlan = NonNullable<Plan['blocks']>[number];
const blockOf = new Map<ts.Statement, BlockPlan>();
const blockStmts = new Map<BlockPlan, ts.Statement[]>();
{
  const fnStmts = new Set([...fns.values()].map((f) => f.stmt));
  for (const st of body.statements) {
    if (fnStmts.has(st) || hoistedTypes.includes(st)) continue;
    const line = lineOf(st.getStart(sf));
    const b = (plan.blocks ?? []).find((x) => line >= x.from && line <= x.to);
    if (!b) continue;
    (function w(n: ts.Node) {
      if (ts.isFunctionLike(n) && n !== st) return;
      if (ts.isReturnStatement(n)) fail(`block ${b.name}: a return at line ${lineOf(n.getStart(sf))} would leave the block function, not the view - move the range`);
      ts.forEachChild(n, w);
    })(st);
    blockOf.set(st, b);
    (blockStmts.get(b) ?? blockStmts.set(b, []).get(b)!).push(st);
  }
  for (const b of plan.blocks ?? []) if (!blockStmts.get(b)?.length) fail(`block ${b.name}: no closure-level statements between lines ${b.from} and ${b.to}`);
  {
    const taken = new Set<string>([...fnByName.keys(), ...[...importBySym.values()].map((b) => b.local), ...[...modDeclBySym.values()].map((d) => d.name)]);
    const clash = (plan.blocks ?? []).map((b) => b.name).filter((n) => taken.has(n));
    if (clash.length) fail(`block names shadow imports or functions: ${clash.join(', ')} - rename the blocks in the plan`);
  }
  for (const v of vars.values()) if (!v.isParam && blockOf.has(v.stmt as ts.Statement)) v.blockResident = true;
}
// block-resident variables are assigned like lets, so a literal type widens to its base
for (const v of vars.values()) {
  if (!v.blockResident || v.isParam || (v.decl as ts.VariableDeclaration).type) continue;
  const t = checker.getTypeAtLocation(v.nameNode);
  const parts = t.isUnion() ? t.types : [t];
  const lit = (f: ts.TypeFlags): boolean => parts.every((x) => !!(x.flags & f) || !!(x.flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined)));
  const nullish = parts.filter((x) => x.flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined)).map((x) => checker.typeToString(x));
  const base = lit(ts.TypeFlags.StringLiteral | ts.TypeFlags.TemplateLiteral) ? 'string' : lit(ts.TypeFlags.NumberLiteral) ? 'number' : lit(ts.TypeFlags.BooleanLiteral) ? 'boolean' : null;
  if (base && parts.some((x) => x.flags & (ts.TypeFlags.StringLiteral | ts.TypeFlags.TemplateLiteral | ts.TypeFlags.NumberLiteral | ts.TypeFlags.BooleanLiteral))) v.typeText = [base, ...nullish].join(' | ');
}

const blockIsAsync = (b: BlockPlan): boolean => (blockStmts.get(b) ?? []).some((st) => { let found = false; (function w(n: ts.Node) { if (found) return; if (ts.isFunctionLike(n) && n !== st) return; if (ts.isAwaitExpression(n) || (ts.isForOfStatement(n) && n.awaitModifier)) { found = true; return; } ts.forEachChild(n, w); })(st); return found; });
{
  const stateNames = new Set([...vars.values()].map((v) => v.name));
  const clash = plan.modules.map((m) => m.name).filter((n) => stateNames.has(n) || fnByName.has(n));
  if (clash.length) fail(`module names collide with closure names: ${clash.join(', ')} - rename the modules in the plan`);
}

// ---------------------------------------------------------------- reference walk
type Owner = { kind: 'fn'; fn: FnInfo } | { kind: 'orchestrator' } | { kind: 'block'; block: BlockPlan };
const blockEntryAliases = new Map<BlockPlan, Set<string>>();
const blockScopeAliases = new Map<BlockPlan, Map<ts.Node, Set<string>>>();
const blockScopeTypes = new Map<BlockPlan, Map<ts.Node, Map<string, Set<string>>>>();
const blockFirstStart = new Map<BlockPlan, number>();
interface Refs { constReads: Set<string>; letVars: Set<string>; fnsCalledSameModule: Set<string>; modSyms: Set<ts.Symbol>; imports: Set<ts.Symbol>; hoisted: Set<ts.Symbol>; firstCallPos: number; aliasScopes: Map<ts.Node, Set<string>>; aliasTypes: Map<ts.Node, Map<string, Set<string>>> }
function isPropName(n: ts.Identifier): boolean {
  const p = n.parent;
  return (ts.isPropertyAccessExpression(p) && p.name === n)
    || ((ts.isPropertyAssignment(p) || ts.isPropertySignature(p) || ts.isMethodDeclaration(p) || ts.isMethodSignature(p) || ts.isPropertyDeclaration(p) || ts.isEnumMember(p) || ts.isGetAccessor(p) || ts.isSetAccessor(p)) && p.name === n)
    || (ts.isBindingElement(p) && p.propertyName === n)
    || (ts.isImportSpecifier(p) || ts.isExportSpecifier(p));
}
function isWriteTarget(id: ts.Identifier): boolean {
  const p = id.parent;
  if (ts.isBinaryExpression(p) && p.left === id && [ts.SyntaxKind.EqualsToken, ts.SyntaxKind.PlusEqualsToken, ts.SyntaxKind.MinusEqualsToken, ts.SyntaxKind.AsteriskEqualsToken, ts.SyntaxKind.SlashEqualsToken, ts.SyntaxKind.QuestionQuestionEqualsToken, ts.SyntaxKind.BarBarEqualsToken, ts.SyntaxKind.AmpersandAmpersandEqualsToken].includes(p.operatorToken.kind)) return true;
  if ((ts.isPrefixUnaryExpression(p) || ts.isPostfixUnaryExpression(p)) && (p.operator === ts.SyntaxKind.PlusPlusToken || p.operator === ts.SyntaxKind.MinusMinusToken)) return true;
  return false;
}
function isDeclName(n: ts.Identifier): boolean {
  const p = n.parent;
  return ((ts.isVariableDeclaration(p) || ts.isParameter(p) || ts.isFunctionDeclaration(p) || ts.isBindingElement(p) || ts.isClassDeclaration(p) || ts.isInterfaceDeclaration(p) || ts.isTypeAliasDeclaration(p) || ts.isTypeParameterDeclaration(p)) && p.name === n);
}

/** True when the identifier sits inside the parameter list of its innermost enclosing function. */
function inParameterList(id: ts.Node): boolean {
  let p: ts.Node = id.parent;
  while (p && !ts.isFunctionLike(p)) { if (ts.isParameter(p)) return true; p = p.parent; }
  return false;
}
const SYNC_METHODS = new Set(['find', 'findIndex', 'findLast', 'findLastIndex', 'map', 'filter', 'forEach', 'some', 'every', 'reduce', 'reduceRight', 'flatMap', 'sort', 'toSorted']);
/** True for a closure handed straight to a synchronous collection method, or invoked as an IIFE. */
function runsSynchronously(fnNode: ts.Node): boolean {
  let outer: ts.Node = fnNode;
  while (ts.isParenthesizedExpression(outer.parent)) outer = outer.parent;
  const p = outer.parent;
  if (!ts.isCallExpression(p)) return false;
  if (p.expression === outer) return true; // IIFE
  if (!p.arguments.includes(outer as ts.Expression)) return false;
  return ts.isPropertyAccessExpression(p.expression) && SYNC_METHODS.has(p.expression.name.text);
}

function collect(node: ts.Node, owner: Owner, edits: Edit[], refs: Refs): void {
  const walk = (n: ts.Node): void => {
    if (owner.kind !== 'orchestrator' && ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword && n.arguments[0] && ts.isStringLiteral(n.arguments[0]) && n.arguments[0].text.startsWith('.')) {
      const lit = n.arguments[0];
      edits.push({ start: lit.getStart(sf), end: lit.end, text: `'${rebase(lit.text)}'` });
    }
    if (owner.kind !== 'orchestrator' && ts.isImportTypeNode(n) && ts.isLiteralTypeNode(n.argument) && ts.isStringLiteral(n.argument.literal) && n.argument.literal.text.startsWith('.')) {
      const lit = n.argument.literal;
      edits.push({ start: lit.getStart(sf), end: lit.end, text: `'${rebase(lit.text)}'` });
    }
    if (ts.isIdentifier(n) && !isPropName(n) && !(isDeclName(n) && !ts.isBindingElement(n.parent))) {
      let s = checker.getSymbolAtLocation(n);
      const shorthand = ts.isShorthandPropertyAssignment(n.parent) && n.parent.name === n;
      if (shorthand) s = checker.getShorthandAssignmentValueSymbol(n.parent) ?? s;
      if (s) {
        const v = vars.get(s);
        const f = fns.get(s);
        const declaringName = ts.isBindingElement(n.parent) && n.parent.name === n && (owner.kind === 'orchestrator' || owner.kind === 'block');
        if (v && !declaringName) {
          if (owner.kind === 'fn' && v.isConst && v.blockResident) {
            // a block-declared constant read from a moved function: alias like any constant (below)
            refs.constReads.add(v.name);
            let scope: ts.Node = owner.fn.node;
            if (!aliasable.has(v.name)) {
              scope = n.parent;
              while (!(ts.isFunctionLike(scope) && (scope as ts.FunctionLikeDeclaration).body) || (scope as ts.Node) === n) scope = scope.parent;
              while (scope !== owner.fn.node && runsSynchronously(scope)) { scope = scope.parent; while (!(ts.isFunctionLike(scope) && (scope as ts.FunctionLikeDeclaration).body)) scope = scope.parent; }
            }
            (refs.aliasScopes.get(scope) ?? refs.aliasScopes.set(scope, new Set()).get(scope)!).add(v.name);
            if (scope !== owner.fn.node) {
              const tt = checker.typeToString(checker.getTypeAtLocation(n), n, typeFlags);
              const perScope = refs.aliasTypes.get(scope) ?? refs.aliasTypes.set(scope, new Map()).get(scope)!;
              (perScope.get(v.name) ?? perScope.set(v.name, new Set()).get(v.name)!).add(tt);
            }
          }
          else if (owner.kind === 'block' && v.isConst && !v.isParam && blockOf.get(v.stmt as ts.Statement) === owner.block) { /* a block's own constant stays local */ }
          else if (owner.kind === 'block' && v.isConst) {
            const first = blockFirstStart.get(owner.block) ?? 0;
            // is this read inside a closure within the block statement?
            let scope: ts.Node = n.parent; let stmtNode: ts.Node = n; while (stmtNode.parent && stmtNode.parent !== body) stmtNode = stmtNode.parent;
            while (scope !== stmtNode && !(ts.isFunctionLike(scope) && (scope as ts.FunctionLikeDeclaration).body)) scope = scope.parent;
            const inClosure = scope !== stmtNode;
            if (v.isParam || v.stmt.end < first) (blockEntryAliases.get(owner.block) ?? blockEntryAliases.set(owner.block, new Set()).get(owner.block)!).add(v.name);
            else if (inClosure) {
              const scopes = blockScopeAliases.get(owner.block) ?? blockScopeAliases.set(owner.block, new Map()).get(owner.block)!;
              (scopes.get(scope) ?? scopes.set(scope, new Set()).get(scope)!).add(v.name);
              const tt = checker.typeToString(checker.getTypeAtLocation(n), n, typeFlags);
              const types = blockScopeTypes.get(owner.block) ?? blockScopeTypes.set(owner.block, new Map()).get(owner.block)!;
              const perScope = types.get(scope) ?? types.set(scope, new Map()).get(scope)!;
              (perScope.get(v.name) ?? perScope.set(v.name, new Set()).get(v.name)!).add(tt);
            } else edits.push({ start: n.getStart(sf), end: n.end, text: shorthand ? `${v.name}: ${ctx}.${v.name}` : `${ctx}.${v.name}` });
          }
          else if (v.blockResident || owner.kind === 'block') {
            // block code reads everything else on the context; block-declared lets live there
            edits.push({ start: n.getStart(sf), end: n.end, text: shorthand ? `${v.name}: ${ctx}.${v.name}` : `${ctx}.${v.name}` });
          }
          else if (v.isConst && owner.kind === 'orchestrator') { /* the orchestrator keeps its local const */ }
          else if (v.isConst && owner.kind === 'fn' && inParameterList(n)) {
            // A default value in a parameter list runs before the body's alias exists: read the context.
            edits.push({ start: n.getStart(sf), end: n.end, text: shorthand ? `${v.name}: ${ctx}.${v.name}` : `${ctx}.${v.name}` });
          }
          else if (v.isConst && owner.kind === 'fn') {
            // Alias at the innermost function that reads it. A read inside a nested closure
            // (an event handler) must see the value at the time the closure RUNS, exactly as the
            // original closure variable did - not the value when the enclosing function was set up.
            // A constant published before the first synchronous call into moved code is
            // aliased once at the top of the moved function: it is always current there, and
            // TypeScript's narrowing of a const flows into nested closures as it did before.
            // A constant published later is aliased in the innermost closure that reads it.
            refs.constReads.add(v.name);
            let scope: ts.Node = owner.fn.node;
            if (!aliasable.has(v.name)) {
              scope = n.parent;
              while (!(ts.isFunctionLike(scope) && (scope as ts.FunctionLikeDeclaration).body) || (scope as ts.Node) === n) scope = scope.parent;
              // A callback to a synchronous collection method (find, map, forEach, ...) or an
              // IIFE runs before its enclosing function returns, so the enclosing function's
              // alias is just as current - and it keeps that function's narrowing.
              while (scope !== owner.fn.node && runsSynchronously(scope)) {
                scope = scope.parent;
                while (!(ts.isFunctionLike(scope) && (scope as ts.FunctionLikeDeclaration).body)) scope = scope.parent;
              }
            }
            (refs.aliasScopes.get(scope) ?? refs.aliasScopes.set(scope, new Set()).get(scope)!).add(v.name);
            if (scope !== owner.fn.node) {
              // remember what the original reference was typed as, so the alias can keep that narrowing
              const tt = checker.typeToString(checker.getTypeAtLocation(n), n, typeFlags);
              const perScope = refs.aliasTypes.get(scope) ?? refs.aliasTypes.set(scope, new Map()).get(scope)!;
              (perScope.get(v.name) ?? perScope.set(v.name, new Set()).get(v.name)!).add(tt);
            }
          }
          else {
            refs.letVars.add(v.name);
            edits.push({ start: n.getStart(sf), end: n.end, text: shorthand ? `${v.name}: ${ctx}.${v.name}` : `${ctx}.${v.name}` });
          }
        } else if (f) {
          const isCall = ts.isCallExpression(n.parent) && n.parent.expression === n;
          const sameModule = owner.kind === 'fn' && owner.fn.module === f.module;
          if (isCall && owner.kind === 'orchestrator') refs.firstCallPos = Math.min(refs.firstCallPos, n.getStart(sf));
          if (owner.kind === 'block') refs.firstCallPos = Math.min(refs.firstCallPos, n.getStart(sf));
          if (isCall && sameModule) {
            refs.fnsCalledSameModule.add(f.name);
            const call = n.parent as ts.CallExpression;
            const insertAt = call.arguments.pos; // just after "("
            edits.push({ start: insertAt, end: insertAt, text: call.arguments.length ? `${ctx}, ` : ctx });
          } else {
            const via = `${ctx}.${f.module}.${f.name}`;
            edits.push({ start: n.getStart(sf), end: n.end, text: shorthand ? `${f.name}: ${via}` : via });
          }
        } else if (targetSym && s === targetSym && owner.kind !== 'orchestrator') {
          // the closure calls itself (re-opening for another record): route it through the context
          selfRef = true;
          edits.push({ start: n.getStart(sf), end: n.end, text: shorthand ? `${plan.fn}: ${ctx}.${plan.fn}` : `${ctx}.${plan.fn}` });
        } else if (modDeclBySym.has(s)) {
          refs.modSyms.add(s);
          const d = modDeclBySym.get(s)!;
          const p = n.parent;
          if (d.isLet && ts.isBinaryExpression(p) && p.left === n && p.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
            // `x = rhs` on a module-level let that now lives in shared.ts -> `setX(rhs)`
            assignedModLets.add(s);
            edits.push({ start: n.getStart(sf), end: p.right.getStart(sf), text: `${setterOf(d.name)}(` });
            edits.push({ start: p.end, end: p.end, text: ')' });
          } else if (d.isLet && isWriteTarget(n) && ts.isExpressionStatement(p.parent) && (ts.isPostfixUnaryExpression(p) || ts.isPrefixUnaryExpression(p))) {
            // statement-level `x++` / `x--` -> `setX(x + 1)` / `setX(x - 1)`
            assignedModLets.add(s);
            const op = p.operator === ts.SyntaxKind.PlusPlusToken ? '+' : '-';
            edits.push({ start: p.getStart(sf), end: p.end, text: `${setterOf(d.name)}(${d.name} ${op} 1)` });
          } else if (d.isLet && isWriteTarget(n) && ts.isBinaryExpression(p) && ts.isExpressionStatement(p.parent)) {
            // statement-level `x op= rhs` -> `setX(x op (rhs))`
            assignedModLets.add(s);
            const op = src.slice(p.operatorToken.getStart(sf), p.operatorToken.end).replace('=', '');
            edits.push({ start: n.getStart(sf), end: p.right.getStart(sf), text: `${setterOf(d.name)}(${d.name} ${op} (` });
            edits.push({ start: p.end, end: p.end, text: '))' });
          } else if (d.isLet && isWriteTarget(n)) fail(`write to module-level let ${d.name} inside an expression at line ${lineOf(n.getStart(sf))} - convert by hand first`);
        }
        else if (importBySym.has(s)) {
          refs.imports.add(s);
          const renamed = owner.kind !== 'orchestrator' ? plan.renameImports?.[importBySym.get(s)!.local] : undefined;
          if (renamed) edits.push({ start: n.getStart(sf), end: n.end, text: shorthand ? `${n.text}: ${renamed}` : renamed });
        }
        else if (hoistedTypeSyms.has(s)) refs.hoisted.add(s);
      }
    }
    ts.forEachChild(n, walk);
  };
  walk(node);
}
const newRefs = (): Refs => ({ constReads: new Set(), letVars: new Set(), fnsCalledSameModule: new Set(), modSyms: new Set(), imports: new Set(), hoisted: new Set(), firstCallPos: Number.POSITIVE_INFINITY, aliasScopes: new Map(), aliasTypes: new Map() });
/** Closure constants a moved function may alias at entry: published before the first synchronous call into moved code. */
const aliasable = new Set<string>();

function applyEdits(text: string, base: number, edits: Edit[]): string {
  const sorted = [...edits].sort((a, b) => b.start - a.start || b.end - a.end);
  let out = text;
  let last = Number.POSITIVE_INFINITY;
  for (const e of sorted) {
    if (e.end > last) fail(`overlapping edits at ${lineOf(e.start)}`);
    out = out.slice(0, e.start - base) + e.text + out.slice(e.end - base);
    last = e.start;
  }
  return out;
}

// template-literal spans, so de-indenting never touches a multi-line string
const templateSpans: Array<[number, number]> = [];
(function w(n: ts.Node) { if (ts.isTemplateExpression(n) || ts.isNoSubstitutionTemplateLiteral(n)) templateSpans.push([n.getStart(sf), n.end]); ts.forEachChild(n, w); })(body);
const inTemplate = (pos: number): boolean => templateSpans.some(([a, b]) => pos > a && pos < b);
/** One level (two spaces) off every line start in [from, to) that is not inside a template literal. */
function dedentEdits(from: number, to: number): Edit[] {
  const out: Edit[] = [];
  let pos = src.indexOf('\n', from);
  while (pos >= 0 && pos + 1 < to) {
    const lineStart = pos + 1;
    if (!inTemplate(lineStart) && src.startsWith('  ', lineStart)) out.push({ start: lineStart, end: lineStart + 2, text: '' });
    pos = src.indexOf('\n', lineStart);
  }
  return out;
}


/** Rewrite a binding pattern into an assignment target that writes every name onto the context. */
function patternAsAssignment(pattern: ts.BindingName): string {
  if (ts.isIdentifier(pattern)) return `${ctx}.${pattern.text}`;
  const parts: string[] = [];
  for (const el of pattern.elements) {
    if (ts.isOmittedExpression(el)) { parts.push(''); continue; }
    const target = patternAsAssignment(el.name);
    const dflt = el.initializer ? ` = ${src.slice(el.initializer.getStart(sf), el.initializer.end)}` : '';
    const rest = el.dotDotDotToken ? '...' : '';
    if (ts.isObjectBindingPattern(pattern)) {
      const key = el.propertyName ? src.slice(el.propertyName.getStart(sf), el.propertyName.end) : (el.name as ts.Identifier).text;
      parts.push(rest ? `${rest}${target}` : `${key}: ${target}${dflt}`);
    } else parts.push(`${rest}${target}${dflt}`);
  }
  return ts.isObjectBindingPattern(pattern) ? `{ ${parts.join(', ')} }` : `[${parts.join(', ')}]`;
}

const lateRefOf = new Map<string, ts.Identifier>();
// A constant or parameter that a top-level guard narrowed (`if (!el) return;`) is that narrower
// type for every statement and function after the guard - which is where all moved code lives.
// The type at its LAST top-level reference is the one to publish; the publish line carries an
// `as` to bridge the declaration site, which still sees the declared type.
{
  const lastRef = new Map<ts.Symbol, ts.Identifier>();
  (function w(n: ts.Node, nested: boolean) {
    if (ts.isIdentifier(n) && !nested && !isPropName(n) && !isDeclName(n)) {
      const sym = checker.getSymbolAtLocation(n);
      if (sym && vars.has(sym)) { const prev = lastRef.get(sym); if (!prev || n.getStart(sf) > prev.getStart(sf)) lastRef.set(sym, n); }
    }
    ts.forEachChild(n, (c) => w(c, nested || (ts.isFunctionLike(c) && c !== target)));
  })(body, false);
  for (const [sym, v] of vars) {
    v.declaredText = v.typeText;
    if (!v.isConst) continue;
    const ref = lastRef.get(sym); if (!ref) continue;
    lateRefOf.set(v.name, ref);
    const late = checker.typeToString(checker.getTypeAtLocation(ref), ref, typeFlags).replace(/(^|[^\w{])\{\}(?=$|[^\w}])/g, '$1object');
    if (late !== v.typeText && /\b(null|undefined)\b/.test(v.typeText) && !/\b(null|undefined)\b/.test(late)) v.typeText = late;
  }
}
const publishCast = (v: VarInfo): string => (v.declaredText && v.declaredText !== v.typeText ? ` as ${CTX}['${v.name}']` : '');
const isNullish = (t: string): boolean => /\b(null|undefined)\b/.test(t);

for (const [b, stmts] of blockStmts) blockFirstStart.set(b, stmts[0]!.getStart(sf));
// ---------------------------------------------------------------- orchestrator statements (first: they decide which constants moved code may alias)
const orchEdits: Edit[] = [];
const orchRefs = newRefs();
const orchRemoved: Array<[number, number]> = [];
{
  const edits = orchEdits; const refs = orchRefs; const removed = orchRemoved;
  for (const st of body.statements) {
    if (ts.isFunctionDeclaration(st) || hoistedTypes.includes(st)) { removed.push([st.getFullStart(), st.end]); continue; }
    if (ts.isVariableStatement(st)) {
      const decls = st.declarationList.declarations;
      const fnDecl = decls.every((d) => ts.isIdentifier(d.name) && fns.has(checker.getSymbolAtLocation(d.name)!));
      if (fnDecl) { removed.push([st.getFullStart(), st.end]); continue; }
      const isConst = !!(st.declarationList.flags & ts.NodeFlags.Const);
      const inBlock = blockOf.get(st);
      collect(st, inBlock ? { kind: 'block', block: inBlock } : { kind: 'orchestrator' }, edits, refs);
      if (isConst) {
        // keep the local; publish each name once (with the narrowed type's cast when a later guard narrows it)
        const names: string[] = [];
        for (const d of decls) (function w(n: ts.Node) { if (ts.isIdentifier(n)) names.push(n.text); else if (ts.isBindingElement(n)) w(n.name); else ts.forEachChild(n, (c) => { if (ts.isBindingElement(c) || ts.isObjectBindingPattern(c) || ts.isArrayBindingPattern(c)) w(c); }); })(d.name);
        const publishedVars = names.map((n) => [...vars.values()].find((v) => v.name === n && v.isConst)).filter((v): v is VarInfo => !!v);
        const lines = publishedVars.map((v) => `${ctx}.${v.name} = ${v.name}${publishCast(v)};`);
        if (lines.length) edits.push({ start: st.end, end: st.end, text: lines.length > 3 ? `\n  ${lines.join('\n  ')}` : ` ${lines.join(' ')}` });
      } else {
        // let (or a block's const): rewrite the declaration into context assignments
        const pieces: string[] = [];
        for (const d of decls) {
          if (!d.initializer) { if (!ts.isIdentifier(d.name)) fail(`destructuring without initializer at line ${lineOf(d.getStart(sf))}`); continue; }
          const init = applyEdits(src.slice(d.initializer.getStart(sf), d.initializer.end), d.initializer.getStart(sf), edits.filter((e) => e.start >= d.initializer!.getStart(sf) && e.end <= d.initializer!.end));
          if (ts.isIdentifier(d.name)) pieces.push(`${ctx}.${d.name.text} = ${init};`);
          else pieces.push(ts.isObjectBindingPattern(d.name) ? `(${patternAsAssignment(d.name)} = ${init});` : `${patternAsAssignment(d.name)} = ${init};`);
        }
        // drop the inner edits we just consumed, replace the whole statement
        for (let i = edits.length - 1; i >= 0; i--) { const e = edits[i]; if (e && e.start >= st.getStart(sf) && e.end <= st.end) edits.splice(i, 1); }
        edits.push({ start: st.getStart(sf), end: st.end, text: pieces.length ? pieces.join(' ') : `// ${ctx}.${decls.map((d) => (d.name as ts.Identifier).text).join(', ')}: assigned later`, });
      }
      continue;
    }
    const inBlock = blockOf.get(st);
    collect(st, inBlock ? { kind: 'block', block: inBlock } : { kind: 'orchestrator' }, edits, refs);
  }
}
for (const [b, stmts] of blockStmts) { const first = stmts[0]; if (first) orchRefs.firstCallPos = Math.min(orchRefs.firstCallPos, first.getStart(sf)); void b; }
for (const v of vars.values()) if (v.isConst && !v.blockResident && (v.isParam || v.stmt.end < orchRefs.firstCallPos)) aliasable.add(v.name);
console.error(`constants aliased at function entry: ${aliasable.size}/${[...vars.values()].filter((v) => v.isConst).length} (first synchronous call into moved code at line ${Number.isFinite(orchRefs.firstCallPos) ? lineOf(orchRefs.firstCallPos) : 'none'}); the rest alias per closure`);

// ---------------------------------------------------------------- moved functions
interface ModuleOut { name: string; fns: FnInfo[]; refs: Refs; bodies: string[] }
const modules = new Map<string, ModuleOut>(plan.modules.map((m) => [m.name, { name: m.name, fns: [], refs: newRefs(), bodies: [] }]));
for (const f of fnList) modules.get(f.module)!.fns.push(f);

for (const mod of modules.values()) {
  for (const f of mod.fns) {
    const edits: Edit[] = [];
    const refs = newRefs();
    collect(f.arrow ? f.stmt : f.node, { kind: 'fn', fn: f }, edits, refs);
    if (f.arrow) {
      const decl = (f.stmt as ts.VariableStatement).declarationList.declarations[0];
      if (decl?.type) {
        // `const fn: Sig = (b) => …` - Sig described the closure signature; the context parameter changes it
        const sig = src.slice(decl.type.getStart(sf), decl.type.end);
        edits.push({ start: decl.name.end, end: decl.type.end, text: '' });
        f.node.parameters.forEach((prm, i) => { if (!prm.type && ts.isIdentifier(prm.name)) edits.push({ start: prm.name.end, end: prm.name.end, text: `: Parameters<${sig}>[${i}]` }); });
        if (!f.node.type && ts.isArrowFunction(f.node)) edits.push({ start: f.node.equalsGreaterThanToken.pos, end: f.node.equalsGreaterThanToken.pos, text: `: ReturnType<${sig}>` });
      }
    }
    for (const k of ['modSyms', 'imports', 'hoisted'] as const) for (const s of refs[k]) mod.refs[k].add(s);
    // signature: fc first (named _fc when the body never touches the context)
    const params = f.node.parameters;
    const usesCtx = refs.aliasScopes.size > 0 || edits.some((e) => e.text.includes(`${ctx}.`) || e.text === ctx || e.text.startsWith(`${ctx}, `));
    const ctxParam = usesCtx ? ctx : `_${ctx}`;
    edits.push({ start: params.pos, end: params.pos, text: params.length ? `${ctxParam}: ${CTX}, ` : `${ctxParam}: ${CTX}` });
    // const aliases, at the top of each function-like scope that reads them
    for (const [scope, names] of refs.aliasScopes) {
      const fnLike = scope as ts.FunctionLikeDeclaration;
      const b = fnLike.body ?? fail(`${f.name}: alias scope has no body`);
      const varByName = new Map([...vars.values()].map((v) => [v.name, v]));
      const cast = (name: string): string | null => { const t = refs.aliasTypes.get(scope)?.get(name); if (t?.size !== 1) return null; const only = [...t][0]!; const prop = varByName.get(name)?.typeText ?? ''; return only !== prop && isNullish(prop) && !isNullish(only) ? `NonNullable<${CTX}['${name}']>` : null; };
      const plain = [...names].filter((n) => !cast(n)).sort(); const casted = [...names].filter((n) => cast(n)).sort();
      const alias = [plain.length ? `const { ${plain.join(', ')} } = ${ctx};` : '', ...casted.map((n) => `const ${n} = ${ctx}.${n} as ${cast(n)};`)].filter(Boolean).join(' ');
      if (ts.isBlock(b)) {
        const open = b.getStart(sf) + 1;
        // indent like the block's own first statement: the `{` line's leading whitespace plus one level
        const braceLine = sf.getLineAndCharacterOfPosition(b.getStart(sf)).line;
        const lineStart = sf.getPositionOfLineAndCharacter(braceLine, 0);
        const leading = (src.slice(lineStart, b.getStart(sf)).match(/^\s*/) ?? [''])[0].length;
        const indent = scope === f.node ? '\n  ' : `\n${' '.repeat(Math.max(0, leading - 2))}`;
        edits.push({ start: open, end: open, text: `${indent}${alias}` });
      } else {
        const typeNode = (fnLike as ts.ArrowFunction).type;
        const isVoid = !!typeNode && src.slice(typeNode.getStart(sf), typeNode.end) === 'void';
        edits.push({ start: b.getStart(sf), end: b.getStart(sf), text: `{ ${alias} ${isVoid ? '' : 'return '}` });
        edits.push({ start: b.end, end: b.end, text: `; }` });
      }
    }
    const full = src.slice(f.stmt.getFullStart(), f.stmt.end);
    edits.push(...dedentEdits(f.stmt.getFullStart(), f.stmt.end));
    edits.push({ start: f.stmt.getStart(sf), end: f.stmt.getStart(sf), text: 'export ' });
    mod.bodies.push(applyEdits(full, f.stmt.getFullStart(), edits).replace(/^\n+/, '\n'));
  }
}

// ---------------------------------------------------------------- shared.ts (module-level closure)
const sharedSyms = new Set<ts.Symbol>();
{
  const queue: ts.Symbol[] = [];
  for (const mod of modules.values()) for (const s of mod.refs.modSyms) queue.push(s);
  // types named in the context interface
  const identsInTypes = new Set<string>();
  for (const v of vars.values()) for (const id of typeNamesIn(v.typeText)) identsInTypes.add(id);
  for (const [s, d] of modDeclBySym) if (identsInTypes.has(d.name)) queue.push(s);
  for (const st of [...hoistedTypes, ...blockOf.keys()]) (function w(n: ts.Node) {
    if (ts.isIdentifier(n) && !isPropName(n)) { const t = checker.getSymbolAtLocation(n); if (t && modDeclBySym.has(t)) queue.push(t); }
    ts.forEachChild(n, w);
  })(st);
  // orchestrator's own references are collected later; it can import from shared too
  while (queue.length) {
    const s = queue.pop()!;
    if (sharedSyms.has(s)) continue;
    sharedSyms.add(s);
    const d = modDeclBySym.get(s)!;
    (function w(n: ts.Node) {
      if (ts.isIdentifier(n) && !isPropName(n)) { const t = checker.getSymbolAtLocation(n); if (t && modDeclBySym.has(t) && !sharedSyms.has(t)) queue.push(t); }
      ts.forEachChild(n, w);
    })(d.stmt);
  }
}
const sharedStmts = [...new Set([...sharedSyms].map((s) => modDeclBySym.get(s)!.stmt))].sort((a, b) => a.getStart(sf) - b.getStart(sf));
const sharedNames = new Set(sharedStmts.flatMap((st) => modStmtNames.get(st) ?? []));
const hoistedNames = new Set(hoistedTypes.flatMap((st) => (ts.isInterfaceDeclaration(st) || ts.isTypeAliasDeclaration(st)) ? [st.name.text] : []));

function importLines(needImports: Set<ts.Symbol>, needShared: Set<string>, fromDirOfOut: boolean, typesOnly = false, rename = true): string[] {
  const bySpec = new Map<string, { values: string[]; types: string[]; def?: string; defType?: boolean; ns?: string }>();
  for (const s of needImports) {
    const b = importBySym.get(s)!;
    let spec = b.spec;
    if (fromDirOfOut && spec.startsWith('.')) spec = rebase(spec);
    const g = bySpec.get(spec) ?? bySpec.set(spec, { values: [], types: [] }).get(spec)!;
    if (b.kind === 'default') { g.def = b.local; g.defType = b.typeOnly; }
    else if (b.kind === 'namespace') g.ns = b.local;
    else {
      const local = fromDirOfOut && !typesOnly && rename ? (plan.renameImports?.[b.local] ?? b.local) : b.local;
      const imported = b.propertyName ?? b.local;
      (b.typeOnly || typesOnly ? g.types : g.values).push(imported !== local ? `${imported} as ${local}` : local);
    }
  }
  const lines: string[] = [];
  const seenSpecs = new Set<string>();
  for (const st of importStmts) {
    let spec = (st.moduleSpecifier as ts.StringLiteral).text;
    if (fromDirOfOut && spec.startsWith('.')) spec = rebase(spec);
    if (seenSpecs.has(spec)) continue; seenSpecs.add(spec);
    const g = bySpec.get(spec); if (!g) continue;
    if (g.ns) lines.push(`import * as ${g.ns} from '${spec}';`);
    if (g.def && g.values.length) lines.push(`import ${g.def}, { ${g.values.sort().join(', ')} } from '${spec}';`);
    else { if (g.def) lines.push(`import ${g.defType ? 'type ' : ''}${g.def} from '${spec}';`); if (g.values.length) lines.push(`import { ${g.values.sort().join(', ')} } from '${spec}';`); }
    if (g.types.length) lines.push(`import type { ${g.types.sort().join(', ')} } from '${spec}';`);
  }
  if (needShared.size) {
    const names = [...needShared].sort();
    const isTypeName = (n: string): boolean => hoistedNames.has(n) || [...modDeclBySym.values()].some((d) => d.name === n && d.isType);
    for (const n of names) if (/^set[A-Z]/.test(n) && !sharedNames.has(n) && !hoistedNames.has(n) && ![...importBySym.values()].some((b) => b.local === n)) { /* a generated setter */ }
    const values = typesOnly ? [] : names.filter((n) => !isTypeName(n)); const types = typesOnly ? names : names.filter(isTypeName);
    const spec = fromDirOfOut ? `./${PFX}shared.ts` : `${relOutFromView}/${PFX}shared.ts`;
    if (values.length) lines.push(`import { ${values.join(', ')} } from '${spec}';`);
    if (types.length) lines.push(`import type { ${types.join(', ')} } from '${spec}';`);
  }
  return lines;
}
/** Re-express `import('./x.ts')` specifiers inside copied type text from the view's directory to outDir. */
function rebaseImportTypes(text: string): string {
  return text.replace(/import\((['"])(\.[^'"]+)\1\)/g, (_m, q: string, spec: string) => `import(${q}${rebase(spec)}${q})`);
}
function rebase(spec: string): string {
  // a relative specifier written from the view file, re-expressed from outDir
  const absTarget = path.resolve(path.dirname(abs), spec);
  let rel = path.relative(path.join(REPO, plan.outDir), absTarget).replaceAll(path.sep, '/');
  if (!rel.startsWith('.')) rel = `./${rel}`;
  return rel;
}

const header = (doc: string): string => `// SPDX-License-Identifier: MPL-2.0\n/**\n${doc.split('\n').map((l) => ` * ${l}`.trimEnd()).join('\n')}\n */\n`;
const viewBase = path.basename(plan.file, '.ts');

// shared.ts
{
  const needImports = new Set<ts.Symbol>();
  const hoistedRefs = new Set<string>();
  for (const st of [...sharedStmts, ...hoistedTypes]) (function w(n: ts.Node) {
    if (ts.isIdentifier(n) && !isPropName(n)) { const s = checker.getSymbolAtLocation(n); if (s && importBySym.has(s)) needImports.add(s); }
    ts.forEachChild(n, w);
  })(st);
  const parts: string[] = [];
  for (const st of [...sharedStmts, ...hoistedTypes]) {
    const text = src.slice(st.getFullStart(), st.end);
    const stEdits: Edit[] = isExported(st) ? [] : [{ start: st.getStart(sf), end: st.getStart(sf), text: 'export ' }];
    if (hoistedTypes.includes(st)) stEdits.push(...dedentEdits(st.getFullStart(), st.end));
    parts.push(rebaseImportTypes(applyEdits(text, st.getFullStart(), stEdits)));
  }
  for (const s of assignedModLets) {
    const d = modDeclBySym.get(s)!;
    if (!sharedSyms.has(s)) fail(`${d.name} is assigned inside the closure but did not move to shared.ts`);
    parts.push(`\n/** ${d.name} is an ES module binding now: importers read it live and write it through here. */\nexport function ${setterOf(d.name)}(value: ${d.typeText}): void { ${d.name} = value; }\n`);
  }
  const doc = `Module-level declarations of ${viewBase}.ts that its feature modules use: the types,\nconstants and pure helpers that used to sit above ${plan.fn}(). Moved here verbatim so\nno feature module has to import the orchestrator file. ${plan.header ?? ''}`.trim();
  const text = `${header(doc)}${importLines(needImports, new Set(), true, false, false).join('\n')}\n${parts.join('').replace(/^\n+/, '\n')}\n`;
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, `${PFX}shared.ts`), text);
  void hoistedRefs;
}

// context.ts
{
  const identsInTypes = new Set<string>();
  const stateLines: string[] = [];
  for (const v of [...vars.values()].sort((a, b) => a.nameNode.getStart(sf) - b.nameNode.getStart(sf))) {
    stateLines.push(`  ${v.name}: ${rebaseImportTypes(v.typeText)};`);
    for (const id of typeNamesIn(v.typeText)) identsInTypes.add(id);
  }
  const needImports = new Set<ts.Symbol>();
  const needShared = new Set<string>();
  const unresolved: string[] = [];
  const globalish = new Set(['string', 'number', 'boolean', 'null', 'undefined', 'void', 'never', 'unknown', 'any', 'object', 'symbol', 'bigint', 'true', 'false', 'typeof', 'keyof', 'readonly', 'infer', 'extends', 'in', 'is', 'as']);
  for (const id of identsInTypes) {
    if (globalish.has(id)) continue;
    const imp = [...importBySym.values()].find((b) => b.local === id);
    if (imp) { needImports.add([...importBySym.entries()].find(([, b]) => b.local === id)![0]); continue; }
    if (sharedNames.has(id) || hoistedNames.has(id)) { needShared.add(id); continue; }
    if (checker.resolveName(id, sf, ts.SymbolFlags.Type | ts.SymbolFlags.Value, false)) continue; // lib / global
    unresolved.push(id);
  }
  // names the checker printed but the view never imported (an inferred type the view never named):
  // find the declaring file through the state variables' types and import from there
  const extraImports = new Map<string, Set<string>>(); // relative spec -> names
  if (unresolved.length) {
    const want = new Set(unresolved);
    const seen = new Set<ts.Type>();
    const visit = (t: ts.Type, depth: number): void => {
      if (seen.has(t) || depth > 8) return; seen.add(t);
      const sym = t.aliasSymbol ?? t.getSymbol();
      const decl = sym?.declarations?.[0];
      const isTypeDecl = !!decl && (ts.isInterfaceDeclaration(decl) || ts.isTypeAliasDeclaration(decl) || ts.isClassDeclaration(decl) || ts.isEnumDeclaration(decl));
      if (sym && want.has(sym.name) && decl && isTypeDecl && !isExported(decl as ts.Statement)) console.warn(`context.ts: ${sym.name} is declared but not exported by ${path.relative(REPO, decl.getSourceFile().fileName)} - export it`);
      if (sym && want.has(sym.name) && decl && isTypeDecl && isExported(decl as ts.Statement)) {
        const from = decl.getSourceFile().fileName;
        if (from !== abs && !from.includes('node_modules') && !from.endsWith('.d.ts')) {
          let rel = path.relative(path.join(REPO, plan.outDir), from).replaceAll(path.sep, '/'); if (!rel.startsWith('.')) rel = `./${rel}`;
          (extraImports.get(rel) ?? extraImports.set(rel, new Set()).get(rel)!).add(sym.name); want.delete(sym.name);
        }
      }
      for (const a of t.aliasTypeArguments ?? []) visit(a, depth + 1);
      if (t.isUnionOrIntersection()) for (const c of t.types) visit(c, depth + 1);
      const ref = t as ts.TypeReference; if (ref.typeArguments) for (const a of ref.typeArguments) visit(a, depth + 1);
      for (const p of t.getProperties()) { const d = p.declarations?.[0]; if (d) visit(checker.getTypeOfSymbolAtLocation(p, d), depth + 1); }
      const idx = t.getStringIndexType(); if (idx) visit(idx, depth + 1);
      const nidx = t.getNumberIndexType(); if (nidx) visit(nidx, depth + 1);
      for (const sig of t.getCallSignatures()) { visit(sig.getReturnType(), depth + 1); for (const p of sig.parameters) { const d = p.declarations?.[0]; if (d) visit(checker.getTypeOfSymbolAtLocation(p, d), depth + 1); } }
    };
    for (const v of vars.values()) visit(checker.getTypeAtLocation(v.nameNode), 0);
    for (const v of vars.values()) { const r = lateRefOf.get(v.name); if (r) visit(checker.getTypeAtLocation(r), 0); }
    // last resort: a unique exported declaration of that name anywhere in the program's own sources
    for (const name of [...want]) {
      const homes = new Set<string>();
      for (const f of program.getSourceFiles()) {
        if (f.isDeclarationFile || f.fileName.includes('node_modules')) continue;
        for (const st of f.statements) {
          if ((ts.isInterfaceDeclaration(st) || ts.isTypeAliasDeclaration(st) || ts.isClassDeclaration(st) || ts.isEnumDeclaration(st)) && st.name?.text === name && isExported(st)) homes.add(f.fileName);
        }
      }
      if (homes.size === 1) {
        const from = [...homes][0]!;
        let rel = path.relative(path.join(REPO, plan.outDir), from).replaceAll(path.sep, '/'); if (!rel.startsWith('.')) rel = `./${rel}`;
        (extraImports.get(rel) ?? extraImports.set(rel, new Set()).get(rel)!).add(name); want.delete(name);
      }
    }
    if (want.size) console.warn(`context.ts: unresolved type names (fix by hand): ${[...want].join(', ')}`);
  }
  const extraLines = [...extraImports].map(([spec, names]) => `import type { ${[...names].sort().join(', ')} } from '${spec}';`);
  const opsLines = plan.modules.map((m) => `  ${m.name}: ReturnType<typeof ${m.name}Ops>;`);
  const opsImports = plan.modules.map((m) => `import type { ${m.name}Ops } from './${PFX}${fileOf(m.name)}.ts';`);
  if (selfRef) { opsLines.push(`  /** The closure itself, for the moved code that re-enters it. */\n  ${plan.fn}: typeof ${plan.fn};`); opsImports.push(`import type { ${plan.fn} } from '${relViewDirFromOut}/${viewBase}.ts';`); }
  const doc = `The context every ${viewBase} feature module receives as its first argument: the\nstate ${plan.fn}() used to keep as closure variables, plus one namespace of bound\noperations per module. Generated by scripts/split-closure.ts; edit by hand from here on.\n${plan.header ?? ''}`.trim();
  const text = `${header(doc)}${[...importLines(needImports, needShared, true, true), ...extraLines, ...opsImports].join('\n')}

export interface ${CTX} {
  // ---- state (was: closure variables of ${plan.fn}) ----
${stateLines.join('\n')}
  // ---- operations, one namespace per module ----
${opsLines.join('\n')}
}

/** A module function minus its leading context parameter. */
export type Op<F> = F extends (${ctx}: ${CTX}, ...a: infer A) => infer R ? (...a: A) => R : never;

/** Bind a module function to one context so it can be passed around as a value. */
export function bindOp<F extends (${ctx}: ${CTX}, ...a: never[]) => unknown>(${ctx}: ${CTX}, f: F): Op<F> {
  return ((...a: never[]) => f(${ctx}, ...a)) as Op<F>;
}
`;
  writeFileSync(path.join(outDir, `${PFX}context.ts`), text);
}

const moduleAssigns = (mod: ModuleOut, s: ts.Symbol): boolean => mod.bodies.some((b) => b.includes(`${setterOf(modDeclBySym.get(s)!.name)}(`));

// block functions: the statements of each block, with the orchestrator's edits applied, as one function
const blockText = new Map<BlockPlan, string>();
const blockNeeds = new Map<string, { shared: Set<string>; imports: Set<ts.Symbol> }>();
for (const [b, stmts] of blockStmts) {
  const first = stmts[0]!; const last = stmts[stmts.length - 1]!;
  const from = first.getFullStart(); const to = last.end;
  const inRange = orchEdits.filter((e) => e.start >= from && e.end <= to);
  const varByName = new Map([...vars.values()].map((v) => [v.name, v]));
  for (const [scope, names] of blockScopeAliases.get(b) ?? []) {
    const fnLike = scope as ts.FunctionLikeDeclaration; const bd = fnLike.body ?? fail(`${b.name}: alias scope has no body`);
    const cast = (name: string): string | null => { const t = blockScopeTypes.get(b)?.get(scope)?.get(name); if (t?.size !== 1) return null; const only = [...t][0]!; const prop = varByName.get(name)?.typeText ?? ''; return only !== prop && isNullish(prop) && !isNullish(only) ? `NonNullable<${CTX}['${name}']>` : null; };
    const plain = [...names].filter((n) => !cast(n)).sort(); const casted = [...names].filter((n) => cast(n)).sort();
    const alias = [plain.length ? `const { ${plain.join(', ')} } = ${ctx};` : '', ...casted.map((n) => `const ${n} = ${ctx}.${n} as ${cast(n)};`)].filter(Boolean).join(' ');
    if (ts.isBlock(bd)) {
      const open = bd.getStart(sf) + 1;
      const braceLine = sf.getLineAndCharacterOfPosition(bd.getStart(sf)).line;
      const lineStart = sf.getPositionOfLineAndCharacter(braceLine, 0);
      const leading = (src.slice(lineStart, bd.getStart(sf)).match(/^\s*/) ?? [''])[0].length;
      inRange.push({ start: open, end: open, text: `\n${' '.repeat(leading + 2)}${alias}` });
    } else {
      const typeNode = (fnLike as ts.ArrowFunction).type;
      const isVoid = !!typeNode && src.slice(typeNode.getStart(sf), typeNode.end) === 'void';
      inRange.push({ start: bd.getStart(sf), end: bd.getStart(sf), text: `{ ${alias} ${isVoid ? '' : 'return '}` });
      inRange.push({ start: bd.end, end: bd.end, text: `; }` });
    }
  }
  const text = applyEdits(src.slice(from, to), from, inRange);
  const asyncKw = blockIsAsync(b) ? 'async ' : '';
  const doc = b.doc ? `/** ${b.doc} */\n` : '';
  const entry = blockEntryAliases.get(b); const entryLine = entry?.size ? `\n  const { ${[...entry].sort().join(', ')} } = ${ctx};` : '';
  blockText.set(b, `\n${doc}export ${asyncKw}function ${b.name}(${ctx}: ${CTX}): ${asyncKw ? 'Promise<void>' : 'void'} {${entryLine}${text.replace(/^\n+/, '\n')}\n}\n`);
  const need = blockNeeds.get(b.module) ?? blockNeeds.set(b.module, { shared: new Set(), imports: new Set() }).get(b.module)!;
  for (const st of stmts) (function w(n: ts.Node) {
    if (ts.isIdentifier(n) && !isPropName(n)) {
      const sym = ts.isShorthandPropertyAssignment(n.parent) ? checker.getShorthandAssignmentValueSymbol(n.parent) : checker.getSymbolAtLocation(n);
      if (sym) {
        if (sharedSyms.has(sym)) { need.shared.add(modDeclBySym.get(sym)!.name); if (assignedModLets.has(sym)) need.shared.add(setterOf(modDeclBySym.get(sym)!.name)); }
        else if (hoistedTypeSyms.has(sym)) need.shared.add(hoistedTypeSyms.get(sym)!);
        else if (importBySym.has(sym) && !vars.has(sym) && !fns.has(sym)) need.imports.add(sym);
      }
    }
    ts.forEachChild(n, w);
  })(st);
}

// feature modules
for (const m of plan.modules) {
  const mod = modules.get(m.name)!;
  const blocksHere = (plan.blocks ?? []).filter((b) => b.module === m.name);
  const bn = blockNeeds.get(m.name);
  if (bn) for (const sym of bn.imports) mod.refs.imports.add(sym);
  const needShared = new Set<string>(bn?.shared ?? []);
  for (const s of mod.refs.modSyms) { needShared.add(modDeclBySym.get(s)!.name); if (assignedModLets.has(s) && moduleAssigns(mod, s)) needShared.add(setterOf(modDeclBySym.get(s)!.name)); }
  for (const s of mod.refs.hoisted) needShared.add(hoistedTypeSyms.get(s)!);
  const imports = importLines(mod.refs.imports, needShared, true);
  imports.push(`import { bindOp, type ${CTX} } from './${PFX}context.ts';`);
  const blockBodies = blocksHere.map((b) => blockText.get(b) ?? '').join('');
  const opLine = (f: FnInfo): string => {
    const tps = f.node.typeParameters;
    if (!tps?.length || f.node.parameters.some((p) => !ts.isIdentifier(p.name))) return `    ${f.name}: bindOp(${ctx}, ${f.name}),`;
    // an explicit wrapper: `<T>(a: A, b: B): R => name<T>(ctx, a, b)`
    const tpText = src.slice(tps.pos, tps.end).trim();
    const params = f.node.parameters.map((p) => src.slice(p.getStart(sf), p.end)).join(', ');
    const args = f.node.parameters.map((p) => `${p.dotDotDotToken ? '...' : ''}${(p.name as ts.Identifier).text}`).join(', ');
    const ret = f.node.type ? `: ${src.slice(f.node.type.getStart(sf), f.node.type.end)}` : '';
    const tpNames = tps.map((t) => t.name.text).join(', ');
    return `    ${f.name}: <${tpText}>(${params})${ret} => ${f.name}<${tpNames}>(${ctx}${args ? `, ${args}` : ''}),`;
  };
  const ops = `\nexport function ${m.name}Ops(${ctx}: ${CTX}) {\n  return {\n${[...mod.fns.map(opLine), ...blocksHere.map((b) => `    ${b.name}: bindOp(${ctx}, ${b.name}),`)].join('\n')}\n  };\n}\n`;
  const doc = `${m.doc ?? `${viewBase}: ${m.name}.`}\n\nEvery function takes the shared \`${ctx}: ${CTX}\` first (see context.ts). Sibling\ncalls in this file are direct; anything in another module, and any function used as\na value (an event listener), goes through \`${ctx}.<module>.<fn>\`. Extracted verbatim\nfrom ${plan.fn}() by scripts/split-closure.ts.`;
  writeFileSync(path.join(outDir, `${PFX}${fileOf(m.name)}.ts`), `${header(doc)}${imports.join('\n')}\n${mod.bodies.join('')}${blockBodies}${ops}`);
}

// ---------------------------------------------------------------- orchestrator
{
  const edits = orchEdits;
  for (const [a, b] of orchRemoved) edits.push({ start: a, end: b, text: '' });
  // block statements leave the orchestrator: their edits went into the block functions above
  for (const [b, stmts] of blockStmts) {
    const first = stmts[0]!; const last = stmts[stmts.length - 1]!;
    const from = first.getFullStart(); const to = last.end;
    for (let i = edits.length - 1; i >= 0; i--) { const e = edits[i]; if (e && e.start >= from && e.end <= to) edits.splice(i, 1); }
    edits.push({ start: from, end: to, text: `\n\n  ${blockIsAsync(b) ? 'await ' : ''}${ctx}.${b.module}.${b.name}();` });
  }
  // context creation at the top of the body. Pushed AFTER the block removals: a block whose first
  // statement opens the body starts at the same offset, and the sweep above would swallow the insert.
  const open = body.getStart(sf) + 1;
  const wiring = plan.modules.map((m) => `  ${ctx}.${m.name} = ${m.name}Ops(${ctx});`).join('\n');
  const publishParams = [...paramVars.map((v) => `  ${ctx}.${v.name} = ${v.name}${publishCast(v)};`), ...(selfRef ? [`  ${ctx}.${plan.fn} = ${plan.fn};`] : [])].join('\n');
  edits.push({ start: open, end: open, text: `\n  const ${ctx} = {} as ${CTX};\n${wiring}\n${publishParams ? `${publishParams}\n` : ''}` });
  // module level: the statements that moved to shared.ts go, the import block is rebuilt,
  // everything else keeps its bytes. All of it as position edits on the original source.
  for (const st of sharedStmts) edits.push({ start: st.getFullStart(), end: st.end, text: '' });
  const remainingNeedsShared = new Set<string>();
  const remainingImports = new Set<ts.Symbol>();
  {
    const remainingStmts = sf.statements.filter((st) => !ts.isImportDeclaration(st) && !sharedStmts.includes(st));
    const movedStmts = new Set<ts.Statement>([...fns.values()].map((f) => f.stmt).concat(hoistedTypes, [...blockOf.keys()]));
    const letTypeNodes = new Set<ts.Node>();
    for (const v of vars.values()) if (!v.isConst && !v.isParam && (v.decl as ts.VariableDeclaration).type) letTypeNodes.add((v.decl as ts.VariableDeclaration).type!);
    for (const st of remainingStmts) (function w(n: ts.Node) {
      if (st === target && n !== target && movedStmts.has(n as ts.Statement)) return; // moved
      if (letTypeNodes.has(n)) return; // a let's annotation lives on the context interface now
      const exportedLocal = ts.isIdentifier(n) && ts.isExportSpecifier(n.parent) && !(n.parent.parent.parent as ts.ExportDeclaration).moduleSpecifier && (n.parent.propertyName ?? n.parent.name) === n;
      if (ts.isIdentifier(n) && (!isPropName(n) || exportedLocal)) {
        const s = exportedLocal ? checker.getExportSpecifierLocalTargetSymbol(n.parent as ts.ExportSpecifier) : ts.isShorthandPropertyAssignment(n.parent) ? checker.getShorthandAssignmentValueSymbol(n.parent) : checker.getSymbolAtLocation(n);
        if (s) {
          if (sharedSyms.has(s)) { remainingNeedsShared.add(modDeclBySym.get(s)!.name); if (assignedModLets.has(s)) remainingNeedsShared.add(setterOf(modDeclBySym.get(s)!.name)); }
          else if (hoistedTypeSyms.has(s)) remainingNeedsShared.add(hoistedTypeSyms.get(s)!);
          else if (importBySym.has(s) && !fns.has(s)) remainingImports.add(s);
        }
      }
      ts.forEachChild(n, w);
    })(st);
  }
  const reexports: string[] = [];
  const movedExported = sharedStmts.filter(isExported).flatMap((st) => modStmtNames.get(st) ?? []);
  const typeNames = new Set([...modDeclBySym.values()].filter((d) => d.isType).map((d) => d.name));
  const values = movedExported.filter((n) => !typeNames.has(n)); const types = movedExported.filter((n) => typeNames.has(n));
  if (values.length) reexports.push(`export { ${values.join(', ')} } from '${relOutFromView}/${PFX}shared.ts';`);
  if (types.length) reexports.push(`export type { ${types.join(', ')} } from '${relOutFromView}/${PFX}shared.ts';`);
  const modImports = plan.modules.map((m) => `import { ${m.name}Ops } from '${relOutFromView}/${PFX}${fileOf(m.name)}.ts';`);
  const newBlock = [...importLines(remainingImports, remainingNeedsShared, false), `import type { ${CTX} } from '${relOutFromView}/${PFX}context.ts';`, ...modImports, ...reexports].join('\n');
  importStmts.forEach((st, i) => { edits.push({ start: st.getStart(sf), end: st.end, text: i === 0 ? newBlock : '' }); });
  const out = applyEdits(src, 0, edits).replace(/\n{4,}/g, '\n\n\n');
  mkdirSync(path.dirname(orchestratorOut), { recursive: true });
  writeFileSync(orchestratorOut, out);
  void relViewDirFromOut;
}

// ---------------------------------------------------------------- report
const lines = (p: string): number => existsSync(p) ? readFileSync(p, 'utf8').split('\n').length : 0;
console.log(`${plan.file}: ${src.split('\n').length} -> ${lines(orchestratorOut)} lines`);
for (const m of plan.modules) { const mod = modules.get(m.name)!; console.log(`  ${PFX}${fileOf(m.name)}.ts: ${mod.fns.length} fns, ${lines(path.join(outDir, `${PFX}${fileOf(m.name)}.ts`))} lines`); }
console.log(`  ${PFX}shared.ts: ${sharedStmts.length} module-level statements + ${hoistedTypes.length} hoisted types, ${lines(path.join(outDir, `${PFX}shared.ts`))} lines`);
console.log(`  context.ts: ${vars.size} state properties (${[...vars.values()].filter((v) => v.isConst).length} const, ${[...vars.values()].filter((v) => !v.isConst).length} let), ${plan.modules.length} op namespaces`);
console.log(APPLY ? `APPLIED under ${plan.outDir}` : `dry run under ${process.env.SPLIT_OUT ?? '/tmp/split-closure'}`);
