// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parse } from 'yaml';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const minor = (version: string) => /^(\d+\.\d+)\./.exec(version)?.[1];

for (const shell of ['tauri-desktop', 'tauri-mobile']) {
  test(`${shell} locks JavaScript guests to the native plugin major/minor`, () => {
    const root = `shells/${shell}`;
    const manifest = JSON.parse(read(`${root}/package.json`)) as { dependencies: Record<string, string> };
    const lock = parse(read(`${root}/pnpm-lock.yaml`)) as { importers: Record<string, { dependencies: Record<string, { specifier: string; version: string }> }> };
    const rust = read(`${root}/src-tauri/Cargo.lock`).split('[[package]]');
    const guests = Object.entries(manifest.dependencies).filter(([name]) => name === '@tauri-apps/api' || name.startsWith('@tauri-apps/plugin-'));
    assert.ok(guests.length > 1, 'the native shell must retain its API and plugin guests');
    for (const [name, specifier] of guests) {
      const crate = name === '@tauri-apps/api' ? 'tauri' : `tauri-${name.slice('@tauri-apps/'.length)}`;
      const entries = rust.filter(block => new RegExp(`^name = "${crate}"$`, 'm').test(block));
      assert.equal(entries.length, 1, `${name}: exactly one locked native counterpart`);
      const native = /^version = "([^"]+)"$/m.exec(entries[0]!)?.[1];
      const guest = lock.importers['.']!.dependencies[name];
      assert.ok(native && guest, `${name}: both native and guest locks exist`);
      assert.equal(guest.specifier, specifier, `${name}: manifest and lock agree`);
      assert.ok(minor(native), `${crate}: native version has a major/minor`);
      assert.equal(minor(guest.version), minor(native), `${name} ${guest.version} must match ${crate} ${native}; Tauri refuses mismatched minor versions before packaging`);
    }
  });
}
