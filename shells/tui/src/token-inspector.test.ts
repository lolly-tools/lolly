// SPDX-License-Identifier: MPL-2.0
/**
 * The TUI token inspector (plan 286 M5) by keyboard at 80 columns: the captured
 * context and one choice per group, a choice step shown as a preview, search, a
 * token's trace and a step through it, the reviewed store on the active terminal
 * system, the refusal for a bundled profile, and the stale-review refusal when
 * another shell edits the system between the review and the store.
 *
 * `design-systems.ts` reads $LOLLY_STATE_DIR at call time, so it is set here, once,
 * before anything reads the store.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createElement, type ComponentType } from 'react';
import { render } from 'ink-testing-library';
import { build } from 'esbuild';

const DIR = await mkdtemp(join(tmpdir(), 'lolly-tui-tokens-'));
process.env.LOLLY_STATE_DIR = DIR;
test.after(() => rm(DIR, { recursive: true, force: true }));

const { activeNodeDesignSystem, createNodeDesignSystem, readActiveDesignSystemTokens, writeNodeDesignSystemTokens } = await import('@lolly-tools/node-shell/design-systems');
const { readTerminalTokenSource, stepChoice, terminalValue, withStoredChoices } = await import('./token-inspector.ts');

const BEACON = JSON.parse(await readFile(new URL('../../web/public/examples/beacon.tokens.json', import.meta.url), 'utf8')) as Record<string, unknown>;

/**
 * Load a view without writing a file into the source tree: esbuild bundles the .tsx
 * files (Node cannot strip JSX), every other import becomes an absolute URL, and the
 * result is imported from a data: URL. The same loader as rebrand.test.ts.
 */
async function loadView<T>(file: string, name: string): Promise<T> {
  const out = await build({
    entryPoints: [fileURLToPath(new URL(file, import.meta.url))],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
    jsx: 'automatic',
    logLevel: 'silent',
    plugins: [{
      name: 'bundle-tsx-only',
      setup(b) {
        b.onResolve({ filter: /.*/ }, (args) => {
          if (args.kind === 'entry-point') return undefined;
          if (args.path.startsWith('node:')) return { path: args.path, external: true };
          if (args.path.startsWith('.')) {
            const abs = resolve(args.resolveDir, args.path);
            return abs.endsWith('.tsx') ? { path: abs } : { path: pathToFileURL(abs).href, external: true };
          }
          return { path: import.meta.resolve(args.path), external: true };
        });
      },
    }],
  });
  const code = out.outputFiles[0]!.text;
  const mod = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`) as Record<string, unknown>;
  return mod[name] as T;
}

const tick = (): Promise<void> => new Promise((done) => setTimeout(done, 25));
// A deadline, not a tick count: a cold runner's first render can take seconds.
const WAIT_BUDGET_MS = 20_000;
async function until(check: () => boolean, what: string): Promise<void> {
  const deadline = Date.now() + WAIT_BUDGET_MS;
  while (Date.now() < deadline) {
    if (check()) return;
    await tick();
  }
  assert.fail(`${what} did not appear within ${WAIT_BUDGET_MS} ms.`);
}

const DOWN = '\u001b[B';
const ESC = '\u001b';

function mount(SystemTokens: ComponentType<{ onBack: () => void }>, onBack: () => void, cols = 80, rows = 32) {
  const ui = render(createElement(SystemTokens, { onBack }));
  Object.defineProperty(ui.stdout, 'columns', { value: cols, configurable: true });
  Object.defineProperty(ui.stdout, 'rows', { value: rows, configurable: true });
  ui.stdout.emit('resize');
  const frame = (): string => ui.lastFrame() ?? '';
  const fits = (where: string): void => {
    const lines = frame().split('\n');
    for (const line of lines) assert.ok(line.length <= cols, `${where}: a line is wider than ${cols} columns: ${line}`);
    assert.ok(lines.length <= rows, `${where}: ${lines.length} lines on a ${rows}-row terminal`);
    assert.match(lines.at(-1) ?? '', /esc (back|cancel|keep reviewing)/, `${where}: the footer stays on screen`);
    // Content taller than the frame squeezes Ink's layout: text runs over the bottom border.
    assert.ok(lines.some((line) => /^\s*╰─+╯\s*$/.test(line)), `${where}: the frame's bottom border is clear of text`);
  };
  return { ui, frame, fits };
}

test('choices step and wrap, a stored selection reports its resolved changes, and values fit one line', () => {
  const groups = [{ id: 'appearance', options: [{ id: 'day', name: 'Day' }, { id: 'night', name: 'Night' }] }];
  assert.deepEqual(stepChoice({ groups }, { appearance: 'day' }, 0), { appearance: 'night' });
  assert.deepEqual(stepChoice({ groups }, { appearance: 'night' }, 0), { appearance: 'day' });
  assert.deepEqual(stepChoice({ groups }, { appearance: 'day' }, 0, -1), { appearance: 'night' });
  assert.deepEqual(stepChoice({ groups }, { appearance: 'day' }, 3), { appearance: 'day' }, 'a group that does not exist changes nothing');

  const before = structuredClone(BEACON);
  const { candidate, changes } = withStoredChoices(BEACON, { appearance: 'night', density: 'compact' });
  assert.deepEqual((candidate.$metadata as Record<string, unknown>).activeThemeSelection, { appearance: 'night', density: 'compact' });
  assert.deepEqual((candidate.$metadata as Record<string, unknown>).tokenSetOrder, (BEACON.$metadata as Record<string, unknown>).tokenSetOrder);
  assert.equal(changes, 4, 'three semantic colours and the border resolve differently at night');
  assert.deepEqual(BEACON, before, 'the source document is not changed');
  assert.equal(withStoredChoices(BEACON, { appearance: 'day', density: 'compact' }).changes, 0);

  assert.equal(terminalValue('#7c3aed'), '#7c3aed');
  assert.equal(terminalValue({ value: 2, unit: 'px' }), '{"value":2,"unit":"px"}');
  assert.equal(terminalValue(undefined), 'unavailable');
  assert.equal(terminalValue('x'.repeat(100), 10), `${'x'.repeat(9)}…`);
});

test('a bundled profile is inspected read-only and refuses to store choices', async () => {
  const source = await readTerminalTokenSource();
  assert.ok(source, 'the public profile ships tokens');
  assert.equal(source.origin.kind, 'profile');
  assert.equal(source.writable, false);
  const SystemTokens = await loadView<ComponentType<{ onBack: () => void }>>('./views/SystemTokens.tsx', 'SystemTokens');
  const { ui, frame, fits } = mount(SystemTokens, () => {});
  try {
    await until(() => frame().includes('Theme: light'), 'The profile choices');
    assert.ok(frame().includes(`content profile ${source.origin.id}, read-only`));
    fits('the profile view');
    ui.stdin.write('o');
    await until(() => frame().includes('Theme: dark') && frame().includes('Preview'), 'The stepped choice');
    ui.stdin.write('s');
    await until(() => frame().includes('read-only here'), 'The read-only refusal');
    ui.stdin.write('r');
    await until(() => frame().includes('Theme: light') && !frame().includes('Preview'), 'The stored choices');
  } finally { ui.unmount(); ui.cleanup(); }
});

test('the terminal system: preview a choice, search, trace and step, then store the reviewed choices', async () => {
  await createNodeDesignSystem({ label: 'Beacon test', tokens: BEACON, source: { kind: 'file', name: 'beacon.tokens.json' } });
  const system = await activeNodeDesignSystem();
  assert.ok(system);
  const SystemTokens = await loadView<ComponentType<{ onBack: () => void }>>('./views/SystemTokens.tsx', 'SystemTokens');
  let backs = 0;
  const { ui, frame, fits } = mount(SystemTokens, () => { backs += 1; });
  try {
    await until(() => frame().includes('appearance: Day'), 'The stored choices');
    assert.ok(frame().includes(`terminal system ${system.id}`));
    assert.ok(frame().includes('density: Compact'));
    assert.ok(frame().includes('Set order foundation → day → compact'));
    assert.ok(frame().includes('No issues found in this document.'));
    assert.ok(frame().includes('10 tokens · page 1 of 1'));
    assert.ok(!frame().includes('Preview'));
    fits('the list');

    ui.stdin.write('o');
    await until(() => frame().includes('appearance: Night') && frame().includes('Preview'), 'The night preview');
    assert.equal(JSON.stringify(await readActiveDesignSystemTokens()), JSON.stringify(BEACON), 'a preview writes nothing');

    ui.stdin.write('/');
    await until(() => frame().includes('Search paths'), 'The search field');
    await tick();
    ui.stdin.write('outline');
    await tick();
    ui.stdin.write('\r');
    await until(() => frame().includes('1 token matching "outline"'), 'The filtered list');
    ui.stdin.write('\r');
    await until(() => frame().includes('Reads 2 · read by 0'), 'The border trace');
    assert.ok(frame().includes('winning set night'));
    assert.ok(frame().includes('color.semantic.primary  #b5a0ff'));
    assert.ok(frame().includes('Override order  day (inactive) · night (winning)'));
    fits('the trace');

    ui.stdin.write(DOWN);
    await tick();
    ui.stdin.write('\r');
    await until(() => frame().includes('stroke.exampleWidth') && frame().includes('Reads 0 · read by 1'), 'The width trace');
    ui.stdin.write(ESC);
    await until(() => frame().includes('Reads 2 · read by 0'), 'Back to the border trace');
    ui.stdin.write(ESC);
    await until(() => frame().includes('1 token matching "outline"'), 'Back to the list');
    assert.equal(backs, 0);

    ui.stdin.write('s');
    await until(() => frame().includes('Store appearance night, density compact on Beacon test?'), 'The review');
    assert.ok(frame().includes('4 resolved values change.'));
    ui.stdin.write('y');
    await until(() => frame().includes('✓ Stored appearance night, density compact on Beacon test.'), 'The stored status');
    assert.ok(!frame().includes('Preview'), 'the stored choices are now the render choices');
    const stored = await readActiveDesignSystemTokens() as Record<string, Record<string, unknown>>;
    assert.deepEqual(stored.$metadata!.activeThemeSelection, { appearance: 'night', density: 'compact' });

    ui.stdin.write(ESC);
    await until(() => backs === 1, 'Leaving the inspector');
  } finally { ui.unmount(); ui.cleanup(); }
});

test('a review goes stale when another shell edits the system first, and nothing is stored', async () => {
  const SystemTokens = await loadView<ComponentType<{ onBack: () => void }>>('./views/SystemTokens.tsx', 'SystemTokens');
  const { ui, frame } = mount(SystemTokens, () => {});
  try {
    await until(() => frame().includes('appearance: Night'), 'The stored night choice');
    ui.stdin.write('o');
    await until(() => frame().includes('appearance: Day') && frame().includes('Preview'), 'The day preview');
    ui.stdin.write('s');
    await until(() => frame().includes('Store appearance day, density compact'), 'The review');
    const system = (await activeNodeDesignSystem())!;
    const edited = structuredClone(await readActiveDesignSystemTokens()) as Record<string, Record<string, Record<string, Record<string, unknown>>>>;
    edited.foundation!.identity!.Beacon!.$value = '#123456';
    await writeNodeDesignSystemTokens({ id: system.id, tokens: edited, source: system.source });
    ui.stdin.write('y');
    await until(() => frame().includes('The system changed after this review.'), 'The stale refusal');
    const now = await readActiveDesignSystemTokens() as Record<string, Record<string, unknown>>;
    assert.deepEqual(now, edited, 'the other edit is kept and the review stored nothing');
    assert.ok(frame().includes('appearance: Night'), 'the current choices are shown again');
  } finally { ui.unmount(); ui.cleanup(); }
});

test('a long list and a wide trace keep the footer on screen, at full size and on a small terminal', async () => {
  const wide: Record<string, unknown> = { root: { $type: 'color', $value: '#000000' } };
  for (let i = 0; i < 40; i++) wide[`leaf${String(i).padStart(2, '0')}`] = { $type: 'color', $value: '{root}' };
  await createNodeDesignSystem({ label: 'Fan out', tokens: wide, source: { kind: 'file', name: 'fan.json' } });
  const SystemTokens = await loadView<ComponentType<{ onBack: () => void }>>('./views/SystemTokens.tsx', 'SystemTokens');
  for (const [cols, rows] of [[80, 30], [60, 20]] as const) {
    const { ui, frame, fits } = mount(SystemTokens, () => {}, cols, rows);
    try {
      await until(() => frame().includes('41 tokens'), `The list at ${cols}x${rows}`);
      assert.ok(frame().includes('No theme groups. Every set applies.'));
      fits(`the list at ${cols}x${rows}`);
      ui.stdin.write('s');
      await until(() => frame().includes('already the stored choices'), 'The no-change refusal');
      fits(`the status at ${cols}x${rows}`);
      ui.stdin.write('\r');
      await until(() => frame().includes('Reads 0 · read by 40'), `The trace at ${cols}x${rows}`);
      fits(`the trace at ${cols}x${rows}`);
      for (let i = 0; i < 30; i++) ui.stdin.write(DOWN);
      await until(() => frame().includes('› read by  leaf30'), 'The trace scrolled to the 31st dependent');
      fits(`the scrolled trace at ${cols}x${rows}`);
      ui.stdin.write('/');
      await tick();
      ui.stdin.write(ESC);
      await until(() => frame().includes('41 tokens'), 'Back to the list');
      ui.stdin.write('/');
      await until(() => frame().includes('Search paths'), 'The search field');
      fits(`the search at ${cols}x${rows}`);
    } finally { ui.unmount(); ui.cleanup(); }
  }
});

test('the System view opens the inspector with t and comes back with Esc', async () => {
  type SystemProps = { onNav: (target: string) => void; onQuit: () => void };
  const System = await loadView<ComponentType<SystemProps>>('./views/System.tsx', 'System');
  const ui = render(createElement(System, { onNav: () => {}, onQuit: () => {} }));
  Object.defineProperty(ui.stdout, 'columns', { value: 80, configurable: true });
  Object.defineProperty(ui.stdout, 'rows', { value: 32, configurable: true });
  ui.stdout.emit('resize');
  const frame = (): string => ui.lastFrame() ?? '';
  try {
    await until(() => frame().includes('Inspect tokens') && frame().includes('Fan out'), 'The System room');
    ui.stdin.write('t');
    await until(() => frame().includes('DESIGN TOKENS') && frame().includes('41 tokens'), 'The inspector');
    ui.stdin.write(ESC);
    await until(() => frame().includes('Start with what you have.'), 'Back in the System room');
  } finally { ui.unmount(); ui.cleanup(); }
});
