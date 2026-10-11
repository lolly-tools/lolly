// SPDX-License-Identifier: MPL-2.0

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { layoutIcon } from '../shells/web/src/views/design-layout-icons.ts';

const sourcePath = 'shells/web/src/views/design-layout-section.penpot';
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

test('sidebar reuse retains the modern kernel revision and exact upstream snapshots', () => {
  const kernel = JSON.parse(read('packages/node-shell/wasm/layout-kernel/upstream.json')) as {
    revision: string;
  };
  assert.equal(upstream.repository, 'https://github.com/penpot/penpot');
  assert.equal(upstream.revision, kernel.revision);
  assert.match(upstream.revision, /^[0-9a-f]{40}$/);
  assert.equal(upstream.license, 'MPL-2.0');
  assert.equal(
    createHash('sha256')
      .update(bytes(`${sourcePath}/LICENSE`))
      .digest('hex'),
    upstream.licenseSha256
  );
  assert.equal(upstream.copyright, 'Copyright (c) KALEIDOS SUBSIDIARY SL');
  assert.ok(upstream.files.length > 0);
  assert.equal(new Set(upstream.files.map((file) => file.source)).size, upstream.files.length);
  for (const file of upstream.files) {
    assert.equal(file.snapshot, `upstream/${file.source}`);
    const snapshot = bytes(`${sourcePath}/${file.snapshot}`);
    assert.equal(
      createHash('sha256').update(snapshot).digest('hex'),
      file.upstreamSha256,
      file.source
    );
    assert.ok(file.adaptations.length > 0, `${file.source} identifies modifications`);
    assert.ok(file.destinations.length > 0, `${file.source} identifies its adapted source`);
    if (/\.(cljs|cljc|scss)$/.test(file.source)) {
      const original = snapshot.toString('utf8');
      assert.ok(
        original.includes('This Source Code Form is subject to the terms of the Mozilla Public')
      );
      assert.ok(original.includes(upstream.copyright));
    }
  }
});

test('adapted sidebar source retains the MPL notice and upstream copyright', () => {
  const destinations = [...new Set(upstream.files.flatMap((file) => file.destinations))];
  for (const destination of destinations) {
    const source = read(destination);
    assert.ok(
      source.includes('This Source Code Form is subject to the terms of the Mozilla Public'),
      destination
    );
    assert.ok(source.includes('License, v. 2.0.'), destination);
    assert.ok(source.includes('file, You can obtain one at http://mozilla.org/MPL/2.0/.'), destination);
    assert.ok(source.includes(upstream.copyright), destination);
  }
});

test('copied sidebar icons retain their exact upstream geometry and stroke attributes', () => {
  const icons = upstream.files.filter((file) => file.source.endsWith('.svg'));
  assert.ok(icons.length > 0);
  for (const file of icons) {
    const original = read(`${sourcePath}/${file.snapshot}`);
    const name = file.source
      .split('/')
      .at(-1)!
      .replace(/\.svg$/, '');
    const adapted = layoutIcon(name);
    for (const attribute of ['viewBox', 'stroke-linecap', 'stroke-linejoin']) {
      const pattern = new RegExp(`${attribute}="[^"]*"`);
      assert.equal(
        adapted.match(pattern)?.[0],
        original.match(pattern)?.[0],
        `${name} ${attribute}`
      );
    }
    const body = (svg: string) => svg.slice(svg.indexOf('>') + 1, svg.lastIndexOf('</svg>'));
    assert.equal(body(adapted), body(original), `${name} path and shape bytes`);
  }
});

for (const path of ['THIRD-PARTY-NOTICES.md', 'shells/web/public/THIRD-PARTY-LICENSES.txt']) {
  test(`${path} ships sidebar attribution, full MPL and modified source locations`, () => {
    const notice = read(path);
    const title = `Penpot layout sidebar (adapted source and icons) ${upstream.revision}`;
    const start = notice.indexOf(title);
    assert.ok(start >= 0, 'sidebar attribution is present');
    assert.equal(notice.indexOf(title, start + title.length), -1, 'one sidebar entry');
    const entry = notice.slice(start).split(/\n(?:###? |-{80}\n)/, 1)[0]!;
    assert.match(entry, /SPDX-License-Identifier: `?MPL-2\.0`?\n/);
    assert.ok(entry.includes(upstream.copyright));
    assert.ok(entry.includes(`${upstream.repository}/tree/${upstream.revision}/frontend/`));
    assert.ok(entry.includes(`https://github.com/lolly-tools/lolly/tree/main/${sourcePath}/`));
    assert.ok(entry.includes('Modified Source Code Form'));
    assert.ok(entry.includes('PROVENANCE.md and upstream.json'));
    for (const destination of new Set(upstream.files.flatMap((file) => file.destinations))) {
      assert.ok(entry.includes(destination), destination);
    }
    assert.ok(entry.includes(license), 'full MPL text travels with the sidebar notice');
  });
}
