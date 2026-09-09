// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');

for (const hoisted of ['web', 'transformers']) {
  test(`runtime staging preserves both ONNX versions with ${hoisted} hoisted`, (t) => {
    const root = mkdtempSync(join(tmpdir(), 'lolly-ort-layout-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    for (const dir of ['scripts', 'shells/web/src/lib', 'node_modules/@huggingface/transformers']) {
      mkdirSync(join(root, dir), { recursive: true });
    }
    writeFileSync(join(root, 'package.json'), '{"type":"module"}');
    writeFileSync(join(root, 'shells/web/package.json'), '{"name":"@lolly/web"}');
    const hf = join(root, 'node_modules/@huggingface/transformers');
    writeFileSync(join(hf, 'package.json'), '{"name":"@huggingface/transformers","main":"index.js"}');
    writeFileSync(join(hf, 'index.js'), '');
    function runtime(parent: string, version: string): void {
      const pkg = join(parent, 'node_modules/onnxruntime-web');
      mkdirSync(join(pkg, 'dist'), { recursive: true });
      writeFileSync(join(pkg, 'package.json'), JSON.stringify({ name: 'onnxruntime-web', version, main: 'dist/ort.node.min.js' }));
      writeFileSync(join(pkg, 'dist/ort.node.min.js'), '');
      writeFileSync(join(pkg, 'dist/ort-wasm.wasm'), version);
      writeFileSync(join(pkg, 'dist/ort-wasm.mjs'), version);
    }
    runtime(hoisted === 'web' ? root : join(root, 'shells/web'), '1.27.0');
    runtime(hoisted === 'transformers' ? root : hf, '1.22.0-dev.test');
    for (const script of ['copy-ort.ts', 'copy-transformers-ort.ts']) {
      copyFileSync(join(REPO, 'scripts', script), join(root, 'scripts', script));
      execFileSync(process.execPath, [join(root, 'scripts', script)], { stdio: 'pipe' });
    }
    for (const extension of ['wasm', 'mjs']) {
      assert.equal(readFileSync(join(root, `shells/web/public/ort/ort-wasm.${extension}`), 'utf8'), '1.27.0');
      assert.equal(readFileSync(join(root, `shells/web/public/ort-hf/1.22.0-dev.test/ort-wasm.${extension}`), 'utf8'), '1.22.0-dev.test');
    }
    assert.match(readFileSync(join(root, 'shells/web/src/lib/ort-hf-base.ts'), 'utf8'), /\/ort-hf\/1\.22\.0-dev\.test\//);
  });
}
