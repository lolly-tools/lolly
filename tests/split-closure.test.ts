// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));

test('a constant immediately before an extracted block is published before the block reads it', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'lolly-split-boundary-'));
  const relative = path.relative(root, dir);
  try {
    writeFileSync(path.join(dir, 'view.ts'), `export function mount() {
  const value = 42;
  const result: number[] = [];
  result.push(value);
  function read(): number[] { return result; }
  return read();
}
`);
    writeFileSync(path.join(dir, 'tsconfig.json'), '{}');
    writeFileSync(path.join(dir, 'plan.json'), JSON.stringify({
      file: `${relative}/view.ts`, fn: 'mount', tsconfig: `${relative}/tsconfig.json`,
      outDir: `${relative}/features`, ctxName: 'ctx', ctxType: 'ViewCtx',
      modules: [{ name: 'setup', start: 'read' }], blocks: [{ name: 'writeResult', module: 'setup', from: 4, to: 4 }],
    }));
    execFileSync(process.execPath, ['scripts/split-closure.ts', path.join(dir, 'plan.json'), '--apply'], { cwd: root });
    const generated = await import(path.join(dir, 'view.ts')) as { mount(): number[] };
    assert.deepEqual(generated.mount(), [42]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('closure splitting preserves ordered side-effect imports on the lazy entry only', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'lolly-split-imports-'));
  const relative = path.relative(root, dir);
  try {
    writeFileSync(path.join(dir, 'view.ts'), `
import './first.css';
import './register.ts';
import './last.css';
export function mount(value: number) {
  function read(): number { return value; }
  return read();
}
`);
    writeFileSync(path.join(dir, 'tsconfig.json'), '{}');
    writeFileSync(path.join(dir, 'plan.json'), JSON.stringify({
      file: `${relative}/view.ts`, fn: 'mount', tsconfig: `${relative}/tsconfig.json`,
      outDir: `${relative}/features`, ctxName: 'ctx', ctxType: 'ViewCtx',
      modules: [{ name: 'reader', start: 'read' }],
    }));
    execFileSync(process.execPath, ['scripts/split-closure.ts', path.join(dir, 'plan.json'), '--apply'], { cwd: root });
    const imports = (file: string) => readFileSync(path.join(dir, file), 'utf8').match(/import ['"][^'"]+['"];?/g) ?? [];
    assert.deepEqual(imports('view.ts'), ["import './first.css';", "import './register.ts';", "import './last.css';"]);
    for (const file of ['features/reader.ts', 'features/shared.ts', 'features/context.ts']) {
      assert.deepEqual(imports(file), [], `${file} must not eagerly load entry side effects`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('lazy tool, timeline, assets, profile and brand entries retain their required stylesheets', () => {
  const entries: Record<string, string[]> = {
    'views/tool.ts': ['tool', 'editor', 'design-topbar', 'design-navigator', 'design-inspector', 'design-guides', 'document', 'deck-editor', 'tool-chrome'].map(name => `../styles/parts/${name}.css`).concat('../styles/vendor-flatpickr.css'),
    'views/timeline-panel.ts': ['../styles/parts/timeline.css'],
    'views/assets.ts': ['../styles/parts/platform.css', '../styles/parts/assets.css'],
    'views/profile.ts': ['../styles/parts/profile.css', '../styles/parts/tool.css', '../styles/parts/storage.css', '../styles/parts/offline-manager.css'],
    'lib/brand-editor.ts': ['../styles/parts/brand-studio.css', '../styles/parts/tool.css', './oklch-slice.css'],
  };
  for (const [entry, sheets] of Object.entries(entries)) {
    const source = readFileSync(path.join(root, 'shells/web/src', entry), 'utf8');
    for (const sheet of sheets) assert.ok(source.includes(`import '${sheet}';`), `${entry} must load ${sheet}`);
  }
});

// A split view's orchestrator creates its context as `{} as Ctx` and fills it field by
// field, so the compiler never sees a field that is left out. A comment that grows over
// the publishing statement (`const x = ...; // note ctx.x = x;`) leaves the field
// undefined, and the first module that reads it throws. 1b6298c79 did that to
// cat.ALL_SECTION_KEYS: folding a section in Assets threw before the address and the
// deferred tiles were updated. So every required field must be assigned in code.
test('every required context field of a split view is assigned in code, not only in a comment', () => {
  const plansDir = path.join(root, 'scripts/data/closure-splits');
  const plans = readdirSync(plansDir).filter(name => name.endsWith('.json'));
  assert.ok(plans.length >= 8, 'the closure split plans were found');
  for (const name of plans) {
    const plan = JSON.parse(readFileSync(path.join(plansDir, name), 'utf8')) as { file: string; outDir: string; ctxName: string; ctxType: string; prefix?: string };
    const prefix = plan.prefix ?? '';
    const contextFile = path.join(root, plan.outDir, `${prefix}context.ts`);
    const context = ts.createSourceFile(contextFile, readFileSync(contextFile, 'utf8'), ts.ScriptTarget.Latest, true);
    const required: string[] = [];
    context.forEachChild(node => {
      if (!ts.isInterfaceDeclaration(node) || node.name.text !== plan.ctxType) return;
      for (const member of node.members) {
        if (ts.isPropertySignature(member) && !member.questionToken && ts.isIdentifier(member.name)) required.push(member.name.text);
      }
    });
    assert.ok(required.length > 0, `${name}: ${plan.ctxType} lists its fields in ${path.relative(root, contextFile)}`);
    const modules = readdirSync(path.join(root, plan.outDir))
      .filter(file => file.endsWith('.ts') && !file.endsWith('.test.ts') && file.startsWith(prefix))
      .map(file => path.join(root, plan.outDir, file));
    const assigned = new Set<string>();
    for (const file of [path.join(root, plan.file), ...modules]) {
      const visit = (node: ts.Node): void => {
        if (ts.isBinaryExpression(node)
          && node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
          && ts.isPropertyAccessExpression(node.left) && ts.isIdentifier(node.left.expression)
          && node.left.expression.text === plan.ctxName) assigned.add(node.left.name.text);
        node.forEachChild(visit);
      };
      visit(ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true));
    }
    assert.deepEqual(required.filter(field => !assigned.has(field)), [], `${name}: ${plan.ctxName} fields no code assigns`);
  }
});
