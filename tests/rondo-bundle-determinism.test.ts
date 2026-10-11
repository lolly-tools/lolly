import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { build, type InlineConfig } from 'vite';
import { rondoBundleOptions } from '../scripts/lib/rondo-bundle-options.ts';

const literal = 'literal\n//#region retain this string\n//#endregion';

/** The same package bytes occupy different physical dependency locations. */
function layout(directory: string, storage: string): string {
  const root = join(directory, storage === 'store-a' ? 'first-root' : 'second-root');
  const dependency = join(root, storage);
  mkdirSync(join(root, 'node_modules'), { recursive: true });
  mkdirSync(dependency, { recursive: true });
  writeFileSync(join(dependency, 'package.json'), JSON.stringify({ name: 'region-fixture', type: 'module', exports: './index.js' }));
  writeFileSync(join(dependency, 'index.js'), `/*! Fixture dependency legal notice */\nexport const literal = ${JSON.stringify(literal)};\nexport function decorate(value) { return literal + '|' + value; }\n`);
  symlinkSync(dependency, join(root, 'node_modules/region-fixture'));
  writeFileSync(join(root, 'entry.js'), "import { decorate } from 'region-fixture';\nexport const result = decorate('ready');\n");
  return root;
}

async function bundle(root: string, stable: boolean): Promise<string> {
  const options = rondoBundleOptions();
  if (!stable) delete options.experimental;
  const configuration: InlineConfig = {
    root, configFile: false, envDir: false, publicDir: false, logLevel: 'silent',
    build: {
      write: false, minify: true, reportCompressedSize: false,
      lib: { entry: join(root, 'entry.js'), formats: ['es'], fileName: 'fixture' },
      rolldownOptions: options,
    },
  };
  const result = await build(configuration);
  const outputs = (Array.isArray(result) ? result : [result]).flatMap((item) => 'output' in item ? item.output : []);
  assert.equal(outputs.length, 1);
  const chunk = outputs[0];
  assert.ok(chunk && chunk.type === 'chunk');
  return chunk.code;
}

test('Rondo bundles ignore dependency labels while preserving legal notices and string values', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'lolly-rondo-bundle-'));
  try {
    const first = layout(directory, 'store-a');
    const second = layout(directory, 'longer-store-b');
    const baselineFirst = await bundle(first, false);
    const baselineSecond = await bundle(second, false);
    assert.notEqual(baselineFirst, baselineSecond, 'The original bundler exposes physical dependency labels');
    const stableFirst = await bundle(first, true);
    const stableSecond = await bundle(second, true);
    assert.equal(stableFirst, stableSecond);
    assert.ok(stableFirst.includes('Fixture dependency legal notice'));
    for (const code of [baselineFirst, baselineSecond, stableFirst, stableSecond]) {
      const module = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
      assert.equal(module.result, `${literal}|ready`);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
