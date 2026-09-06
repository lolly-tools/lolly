// SPDX-License-Identifier: MPL-2.0
/**
 * scripts/tool-isolation.ts - the static half of deciding which tools may run
 * their hooks in a Worker by default, and the manifest rewrite it performs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyseIsolation, rewriteIsolate, REALM_BOUND_GLOBALS } from '../scripts/tool-isolation.ts';

test('a hook that touches the DOM is realm-bound; one that only uses host.* is clean', () => {
  const dirty = analyseIsolation(`
    function onInit() {
      const c = document.createElement('canvas');   // line 3
      return { w: window.innerWidth };
    }
  `);
  assert.equal(dirty.clean, false);
  assert.deepEqual(dirty.realmBound.map((r) => r.name).sort(), ['document', 'window']);
  assert.equal(dirty.realmBound.find((r) => r.name === 'document')?.line, 3);

  const clean = analyseIsolation(`
    async function onInit({ host }) {
      const a = await host.assets.get('x');
      return { url: a.url, ok: host.color.deltaE('#000', '#fff') > 0.5 };
    }
  `);
  assert.equal(clean.clean, true);
});

test('mentions in comments, strings and property positions are not uses; a lone typeof probe is a guard', () => {
  const a = analyseIsolation(`
    // document is not touched here
    const why = "window.foo";
    const x = host.window;
    function onInit() { return { has: typeof document !== 'undefined' }; }
  `);
  assert.equal(a.clean, true, JSON.stringify(a.realmBound));
  const b = analyseIsolation(`function onInit() { if (typeof document !== 'undefined') return { t: document.title }; return {}; }`);
  assert.equal(b.clean, false, 'a guarded probe followed by a real use is a use');
});

test('every realm-bound name is a bare identifier check, so host.<name> never matches', () => {
  for (const name of REALM_BOUND_GLOBALS) {
    assert.equal(analyseIsolation(`function onInit({ host }) { return host.${name}; }`).clean, true, name);
  }
});

test('rewriteIsolate places the flag beside hooks and is idempotent both ways', () => {
  const raw = '{\n  "id": "x",\n  "hooks": { "onInit": true },\n  "status": "official"\n}\n';
  const on = rewriteIsolate(raw, true);
  assert.match(on, /\n  "isolate": true,\n  "hooks": \{/);
  assert.deepEqual(JSON.parse(on), { id: 'x', isolate: true, hooks: { onInit: true }, status: 'official' });
  assert.equal(rewriteIsolate(on, true), on);
  assert.equal(rewriteIsolate(on, false), raw);
  assert.throws(() => rewriteIsolate('{ "id": "y" }', true), /declares no hooks/);
});
