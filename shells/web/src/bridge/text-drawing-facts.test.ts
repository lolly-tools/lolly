// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { registerLazyTextStrikeMetrics, registerTextStrikeMetrics, textStrikeMetrics } from './text-drawing-facts.ts';

test('drawing keeps each text implementation private and loads a facade only when its facts are needed', async () => {
  const implementation = {}, facade = {}, other = {};
  let loads = 0;
  const calls: Array<[string, string[] | undefined]> = [];
  registerTextStrikeMetrics(implementation, async (font, variations) => {
    calls.push([font, variations]);
    return { upem: 1000, ascent: 800 };
  });
  registerLazyTextStrikeMetrics(facade, async () => { loads++; return implementation; });
  const provider = textStrikeMetrics(facade);
  assert.ok(provider);
  assert.equal(loads, 0);
  assert.equal(textStrikeMetrics(other), undefined);
  assert.deepEqual(Object.keys(implementation), []);
  assert.deepEqual(Object.keys(facade), []);
  assert.deepEqual(await provider('face.ttf', ['wght=700']), { upem: 1000, ascent: 800 });
  assert.equal(loads, 1);
  assert.deepEqual(calls, [['face.ttf', ['wght=700']]]);
  registerLazyTextStrikeMetrics(other, async () => ({}));
  assert.equal(await textStrikeMetrics(other)!('missing.ttf'), null);
});

for (const format of ['iife', 'esm'] as const) {
  test(`the ${format} HTML export bundle leaves the font engine behind the text host`, async () => {
    const module = fileURLToPath(new URL('./export.ts', import.meta.url));
    const result = await build({
      stdin: { contents: `import { createExportAPI } from ${JSON.stringify(module)}; globalThis.exporter = createExportAPI;`, resolveDir: fileURLToPath(new URL('.', import.meta.url)) },
      bundle: true, write: false, metafile: true, format, platform: 'browser', logLevel: 'silent', loader: { '.css': 'empty' },
    });
    assert.ok(result.outputFiles[0]!.text.includes('exporter'));
    assert.ok(Object.keys(result.metafile.inputs).every(path => !path.includes('harfbuzzjs') && !path.endsWith('/bridge/text.ts')), 'the export walker must not load the text implementation itself');
  });
}
