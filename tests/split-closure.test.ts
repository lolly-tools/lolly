// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

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

test('lazy tool, timeline, catalog, profile and brand entries retain their required stylesheets', () => {
  const entries: Record<string, string[]> = {
    'views/tool.ts': ['tool', 'editor', 'design-topbar', 'design-navigator', 'design-inspector', 'design-guides', 'document', 'deck-editor', 'tool-chrome'].map(name => `../styles/parts/${name}.css`).concat('../styles/vendor-flatpickr.css'),
    'views/timeline-panel.ts': ['../styles/parts/timeline.css'],
    'views/catalog.ts': ['../styles/parts/platform.css'],
    'views/profile.ts': ['../styles/parts/profile.css', '../styles/parts/tool.css', '../styles/parts/storage.css', '../styles/parts/offline-manager.css'],
    'lib/brand-editor.ts': ['../styles/parts/brand-studio.css', '../styles/parts/tool.css', './oklch-slice.css'],
  };
  for (const [entry, sheets] of Object.entries(entries)) {
    const source = readFileSync(path.join(root, 'shells/web/src', entry), 'utf8');
    for (const sheet of sheets) assert.ok(source.includes(`import '${sheet}';`), `${entry} must load ${sheet}`);
  }
});
