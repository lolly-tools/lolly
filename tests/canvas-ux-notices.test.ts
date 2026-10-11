// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const sourcePath = 'shells/web/src/views/design-canvas-ux.penpot';
const root = new URL('../', import.meta.url);
const bytes = (path: string) => readFileSync(new URL(path, root));
const read = (path: string) => bytes(path).toString('utf8');
const upstream = JSON.parse(read(`${sourcePath}/upstream.json`)) as {
  repository: string;
  revision: string;
  license: string;
  licenseSha256: string;
  copyright: string;
  files: {
    source: string;
    upstreamSha256: string;
    snapshot: string;
    destinations: string[];
    adaptations: string;
  }[];
};
const license = read(`${sourcePath}/LICENSE`).trim();
const sources = [
  'frontend/src/app/main/ui/components/context_menu_a11y.cljs',
  'frontend/src/app/main/ui/ds/controls/select.cljs',
  'frontend/src/app/main/ui/workspace/viewport/guides.cljs',
  'frontend/src/app/worker/snap.cljs',
  'frontend/src/app/main/snap.cljs',
  'render-wasm/src/render/ui/rulers.rs',
];

test('canvas interaction reuse pins the modern kernel revision and exact adapted sources', () => {
  const kernel = JSON.parse(read('packages/node-shell/wasm/layout-kernel/upstream.json')) as {
    revision: string;
  };
  assert.equal(upstream.repository, 'https://github.com/penpot/penpot');
  assert.equal(upstream.revision, '10955f17e27943429a10e90360d0404e3f56e27c');
  assert.equal(upstream.revision, kernel.revision);
  assert.equal(upstream.license, 'MPL-2.0');
  assert.equal(upstream.copyright, 'Copyright (c) KALEIDOS SUBSIDIARY SL');
  assert.deepEqual(upstream.files.map((file) => file.source).sort(), sources.toSorted());
  assert.equal(
    createHash('sha256')
      .update(bytes(`${sourcePath}/LICENSE`))
      .digest('hex'),
    upstream.licenseSha256
  );
  assert.equal(
    upstream.licenseSha256,
    '1f256ecad192880510e84ad60474eab7589218784b9a50bc7ceee34c2b91f1d5'
  );
  for (const file of upstream.files) {
    assert.equal(file.snapshot, `upstream/${file.source}`);
    const snapshot = bytes(`${sourcePath}/${file.snapshot}`);
    assert.equal(
      createHash('sha256').update(snapshot).digest('hex'),
      file.upstreamSha256,
      file.source
    );
    assert.ok(file.adaptations.length > 0, file.source);
    assert.ok(file.destinations.length > 0, file.source);
    if (file.source.endsWith('.cljs')) {
      assert.ok(
        snapshot
          .toString()
          .includes('This Source Code Form is subject to the terms of the Mozilla Public'),
        file.source
      );
      assert.ok(snapshot.toString().includes(upstream.copyright), file.source);
    }
  }
});

test('adapted canvas and menu source preserves the MPL notice and upstream copyright', () => {
  for (const destination of new Set(upstream.files.flatMap((file) => file.destinations))) {
    const source = read(destination);
    assert.ok(
      source.includes('This Source Code Form is subject to the terms of the Mozilla Public'),
      destination
    );
    assert.ok(source.includes('License, v. 2.0.'), destination);
    assert.ok(
      source.includes('file, You can obtain one at http://mozilla.org/MPL/2.0/.'),
      destination
    );
    assert.ok(source.includes(upstream.copyright), destination);
  }
});

for (const path of ['THIRD-PARTY-NOTICES.md', 'shells/web/public/THIRD-PARTY-LICENSES.txt']) {
  test(`${path} distributes canvas interaction attribution and the full MPL source notice`, () => {
    const notice = read(path);
    const title = `Penpot canvas and menu interactions (adapted source) ${upstream.revision}`;
    const start = notice.indexOf(title);
    assert.ok(start >= 0);
    assert.equal(notice.indexOf(title, start + title.length), -1);
    const entry = notice.slice(start).split(/\n(?:###? |-{80}\n)/, 1)[0]!;
    assert.match(entry, /SPDX-License-Identifier: `?MPL-2\.0`?\n/);
    assert.ok(entry.includes(upstream.copyright));
    assert.ok(entry.includes(`${upstream.repository}/tree/${upstream.revision}/`));
    assert.ok(entry.includes(`https://github.com/lolly-tools/lolly/tree/main/${sourcePath}/`));
    assert.ok(entry.includes('Modified Source Code Form'));
    assert.ok(entry.includes('PROVENANCE.md and upstream.json'));
    for (const destination of new Set(upstream.files.flatMap((file) => file.destinations)))
      assert.ok(entry.includes(destination), destination);
    assert.ok(entry.includes(license), 'full MPL text travels with the canvas interaction notice');
  });
}
