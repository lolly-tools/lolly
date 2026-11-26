// SPDX-License-Identifier: MPL-2.0
/**
 * The TUI's verify panel prints Verify's six findings, over the real Profile view.
 *
 * The view is mounted, `v` is pressed and a path is typed, the way a person does. For
 * a file another tool signed, a file with nothing in it and a file whose metadata
 * states a licence and a place, the panel shows the six labels in the engine's fixed
 * order straight after the verdict, in the words `lolly validate` prints, and keeps
 * the lines the panel showed before.
 *
 * The files carry no picture extension, so the panel never starts its pixel scan here.
 *
 * Run with: node --test shells/tui/src/verify-findings.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createElement, type ComponentType } from 'react';
import { render } from 'ink-testing-library';
import { build } from 'esbuild';
import { FINDING_LABELS_IN_ORDER, labelPositions, licensedLocatedJpeg, plainJpeg, signedPng } from '../../../tests/helpers/verify-findings-fixtures.ts';

const DIR = await mkdtemp(join(tmpdir(), 'lolly-tui-findings-'));
process.env.LOLLY_STATE_DIR = DIR;
delete process.env.LOLLY_TRUST_ANCHOR;
test.after(() => rm(DIR, { recursive: true, force: true }));

const SIGNED = join(DIR, 'signed.dat');
const PLAIN = join(DIR, 'plain.dat');
const LICENSED = join(DIR, 'licensed.dat');
await writeFile(SIGNED, signedPng());
await writeFile(PLAIN, plainJpeg());
await writeFile(LICENSED, licensedLocatedJpeg());

/** Bundle the .tsx files only, as token-inspector.test.ts does, and import the result. */
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

type ProfileProps = { bridge: unknown; onNav: () => void; onQuit: () => void };
const Profile = await loadView<ComponentType<ProfileProps>>('./views/Profile.tsx', 'Profile');

const tick = (): Promise<void> => new Promise((done) => setTimeout(done, 25));
const WAIT_BUDGET_MS = 20_000;
async function until(check: () => boolean, what: string): Promise<void> {
  const deadline = Date.now() + WAIT_BUDGET_MS;
  while (Date.now() < deadline) {
    if (check()) return;
    await tick();
  }
  assert.fail(`${what} did not appear within ${WAIT_BUDGET_MS} ms.`);
}

/** Open the verify panel on one file and return its lines, without the frame around them. */
async function verifyPanel(path: string): Promise<string[]> {
  const ui = render(createElement(Profile, { bridge: {}, onNav: () => {}, onQuit: () => {} }));
  Object.defineProperty(ui.stdout, 'columns', { value: 200, configurable: true });
  Object.defineProperty(ui.stdout, 'rows', { value: 60, configurable: true });
  ui.stdout.emit('resize');
  const frame = (): string => ui.lastFrame() ?? '';
  try {
    await until(() => frame().includes('First name'), 'The profile fields');
    ui.stdin.write('v');
    await until(() => frame().includes('Verify file (C2PA):'), 'The path prompt');
    ui.stdin.write(path);
    await tick();
    ui.stdin.write('\r');
    await until(() => frame().includes('Hidden content: '), 'The verify panel');
    return frame().split('\n')
      .filter((line) => /^\s*│.*│\s*$/.test(line))
      .map((line) => line.replace(/^\s*│ ?/, '').replace(/\s*│\s*$/, ''));
  } finally {
    ui.unmount();
  }
}

const isFinding = (line: string): boolean => FINDING_LABELS_IN_ORDER.some((label) => line.startsWith(`  ${label}: `));

test('a file another tool signed: the six findings follow the verdict', async () => {
  const lines = await verifyPanel(SIGNED);
  labelPositions(lines.join('\n'));
  const at = lines.findIndex((line) => line.startsWith('✓ Credential intact'));
  assert.ok(at >= 0, lines.join('\n'));
  assert.deepEqual(lines.slice(at + 1, at + 7), [
    '  Credential: Unchanged, signer not recognised (Signed)',
    '  Made with: c2patool 0.26.68 (Signed)',
    '  AI: Nothing declared',
    '  Licence: None recorded',
    '  Personal data: None found',
    '  Hidden content: None found',
  ]);
  // The lines the panel showed before the findings are still there, in the same order.
  const rest = lines.slice(at).filter((line) => !isFinding(line));
  assert.deepEqual(rest.slice(0, 5), [
    '✓ Credential intact - signed on-device (integrity, not identity)',
    '  (fields below are self-asserted by whoever signed the file)',
    '  Title       c2patool cross-validation fixture',
    '  Made with   c2patool 0.26.68',
    '  Signer      c2patool cross-validation test signer',
  ]);
  assert.ok(rest.includes('  ✓ assertion.dataHash.match - data hash valid'));
});

test('a file with nothing in it: all six slots still print', async () => {
  const lines = await verifyPanel(PLAIN);
  const at = lines.findIndex((line) => line.startsWith('○ No Content Credentials found'));
  assert.ok(at >= 0, lines.join('\n'));
  assert.deepEqual(lines.slice(at + 1, at + 8), [
    '  no Content Credentials found',
    '  Credential: Not signed',
    '  Made with: Not identified',
    '  AI: Nothing declared',
    '  Licence: None recorded',
    '  Personal data: None found',
    '  Hidden content: None found',
  ]);
});

test('a licence and a place in the metadata are stated, never signed', async () => {
  const lines = await verifyPanel(LICENSED);
  assert.deepEqual(lines.filter(isFinding), [
    '  Credential: Not signed',
    '  Made with: TestCam (Stated in the file)',
    '  AI: Nothing declared',
    '  Licence: CC BY 4.0 (Stated in the file)',
    '  Personal data: Location recorded (Stated in the file)',
    '  Hidden content: None found',
  ]);
  assert.doesNotMatch(lines.join('\n'), /%|royalty-free|cleared|legally safe|copyright verified/i);
});
