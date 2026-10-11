// SPDX-License-Identifier: MPL-2.0

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const kernelPath = 'packages/node-shell/wasm/layout-kernel';
const root = new URL('../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');
const upstream = JSON.parse(read(`${kernelPath}/upstream.json`)) as {
  repository: string;
  revision: string;
};
const license = read(`${kernelPath}/LICENSE`).trim();
const nodeShellPackage = JSON.parse(read('packages/node-shell/package.json')) as { name: string };

for (const path of [
  'THIRD-PARTY-NOTICES.md',
  'shells/web/public/THIRD-PARTY-LICENSES.txt',
]) {
  test(`${path} retains the shipped Penpot kernel notice and modified source location`, () => {
    const notice = read(path);
    const title = `Penpot layout kernel (compiled WASM) ${upstream.revision}`;
    const start = notice.indexOf(title);
    assert.ok(start >= 0, 'compiled kernel attribution is present');
    assert.equal(notice.indexOf(title, start + title.length), -1, 'one kernel entry');
    const entry = notice.slice(start).split(/\n(?:###? |-{80}\n)/, 1)[0]!;
    assert.match(entry, /SPDX-License-Identifier: `?MPL-2\.0`?\n/);
    assert.ok(entry.includes('Copyright (c) KALEIDOS SUBSIDIARY SL'));
    assert.ok(entry.includes(`${kernelPath}/layout-kernel.wasm`));
    assert.ok(entry.includes(`${upstream.repository}/tree/${upstream.revision}/render-wasm/`));
    assert.ok(entry.includes(`https://github.com/lolly-tools/lolly/tree/main/${kernelPath}/`));
    assert.ok(entry.includes('Modified Source Code Form'));
    assert.ok(entry.includes(`included in the ${nodeShellPackage.name} package`));
    assert.ok(entry.includes('README.md and upstream.json'));
    assert.ok(entry.includes(license), 'full crate MPL text travels with the WASM notice');
  });
}
