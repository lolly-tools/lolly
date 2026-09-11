// SPDX-License-Identifier: MPL-2.0
/**
 * Penpot plugin tests: the static files under public/penpot-plugin/ ship as
 * data (no build step), so this suite checks the shipped text directly -
 * manifest shape + on-disk paths, the zero-egress invariant (no fetch/XHR/
 * dynamic import in plugin.js, no external src/href in index.html - that IS
 * the privacy story), and the DTCG walker, evaluated out of plugin.js with
 * node:vm against a stub `penpot` so the tested code is the shipped code.
 * Run directly:  node --test shells/web/src/penpot-plugin.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import vm from 'node:vm';

const publicDir = fileURLToPath(new URL('../public', import.meta.url));
const pluginDir = join(publicDir, 'penpot-plugin');

const manifestText = readFileSync(join(pluginDir, 'manifest.json'), 'utf8');
const pluginText = readFileSync(join(pluginDir, 'plugin.js'), 'utf8');
const htmlText = readFileSync(join(pluginDir, 'index.html'), 'utf8');

// ── manifest ─────────────────────────────────────────────────────────────────

test('manifest parses, declares exactly the three permissions, and its paths exist', () => {
  const manifest = JSON.parse(manifestText);
  assert.equal(manifest.name, 'Lolly bridge');
  assert.deepEqual(
    [...manifest.permissions].sort(),
    ['content:write', 'library:read', 'library:write'],
  );
  assert.equal(manifest.permissions.length, 3);
  // code + icon are absolute URLs served from public/ - both must exist on disk.
  for (const p of [manifest.code, manifest.icon]) {
    assert.match(p, /^\//, `${p} should be an absolute path`);
    assert.ok(existsSync(join(publicDir, p)), `${p} missing under public/`);
  }
});

// ── zero-egress invariants ───────────────────────────────────────────────────

test('plugin.js is non-empty and self-contained (no fetch/XHR/dynamic import)', () => {
  assert.ok(pluginText.trim().length > 0);
  assert.ok(!pluginText.includes('fetch('), 'plugin.js must not call fetch');
  assert.ok(!pluginText.includes('XMLHttpRequest'), 'plugin.js must not use XHR');
  assert.ok(!pluginText.includes('import('), 'plugin.js must not dynamic-import');
});

test('index.html is non-empty and declares no external src/href', () => {
  assert.ok(htmlText.trim().length > 0);
  // Every src=/href= attribute must stay on-page: no scheme, no //host.
  const refs = [...htmlText.matchAll(/\b(?:src|href)\s*=\s*["']([^"']*)["']/gi)].map(m => m[1] ?? '');
  for (const ref of refs) {
    assert.ok(!/^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(ref), `external ref: ${ref}`);
    assert.ok(!/^[a-z][a-z0-9+.-]*:/i.test(ref), `scheme ref: ${ref}`);
  }
});

// ── the DTCG walker, evaluated out of the shipped file ───────────────────────

function loadBridge() {
  const stub = {
    theme: 'dark',
    ui: { open() {}, onMessage() {}, sendMessage() {} },
    library: { local: { tokens: { sets: [], addSet() { return { tokens: [], addToken() {} }; } } } },
  };
  // Top-level `const LollyBridge` lives in the script scope, so append the
  // identifier to read it back as the script's completion value.
  return vm.runInNewContext(pluginText + '\n;LollyBridge', { penpot: stub, window: {} });
}

// vm results live in another realm, whose Array/Object prototypes fail strict
// deep-equality - round-trip through JSON to compare structure, which is all
// the shipped protocol carries anyway.
type Flat = { tokens: { name: string; type: string; value: unknown }[]; skipped: string[] };
function flatten(bridge: any, doc: unknown): Flat {
  return JSON.parse(JSON.stringify(bridge.flattenTokens(doc)));
}

test('flattenTokens walks nested groups to dotted names', () => {
  const bridge = loadBridge();
  const { tokens, skipped } = flatten(bridge, {
    color: {
      brand: {
        primary: { $type: 'color', $value: '#30ba78' },
        deep: { sea: { $type: 'color', $value: '#0c322c' } },
      },
    },
  });
  assert.deepEqual(skipped, []);
  assert.deepEqual(tokens, [
    { name: 'color.brand.primary', type: 'color', value: '#30ba78' },
    { name: 'color.brand.deep.sea', type: 'color', value: '#0c322c' },
  ]);
});

test('a node that is both token and group emits its leaf as <name>.default', () => {
  const bridge = loadBridge();
  const { tokens } = flatten(bridge, {
    edge: {
      $type: 'color',
      $value: '#333333',
      faint: { $type: 'color', $value: '#666666' },
    },
  });
  assert.deepEqual(tokens.map(t => t.name).sort(), ['edge.default', 'edge.faint']);
  assert.equal(tokens.find(t => t.name === 'edge.default')?.value, '#333333');
});

test('group-level $type inherits down to leaves without their own $type', () => {
  const bridge = loadBridge();
  const { tokens, skipped } = flatten(bridge, {
    space: {
      $type: 'spacing',
      sm: { $value: '4px' },
      lg: { $value: '24px' },
      odd: { $type: 'dimension', $value: '1px' }, // own $type wins
    },
  });
  assert.deepEqual(skipped, []);
  assert.equal(tokens.find(t => t.name === 'space.sm')?.type, 'spacing');
  assert.equal(tokens.find(t => t.name === 'space.lg')?.type, 'spacing');
  assert.equal(tokens.find(t => t.name === 'space.odd')?.type, 'dimension');
});

test('unknown $type is counted as skipped, not silently dropped', () => {
  const bridge = loadBridge();
  const { tokens, skipped } = flatten(bridge, {
    weird: { $type: 'cubicBezier', $value: [0.4, 0, 0.2, 1] },
    fine: { $type: 'color', $value: '#fff' },
  });
  assert.deepEqual(skipped, ['weird']);
  assert.equal(tokens.length, 1);
});

test('duration converts to a bare ms number string', () => {
  const bridge = loadBridge();
  const { tokens } = flatten(bridge, {
    anim: {
      fast: { $type: 'duration', $value: '150ms' },
      slow: { $type: 'duration', $value: '0.3s' },
    },
  });
  assert.deepEqual(tokens, [
    { name: 'anim.fast', type: 'number', value: '150' },
    { name: 'anim.slow', type: 'number', value: '300' },
  ]);
});

test('a shadow whose $value carries no offsets is skipped, a real one maps to string fields', () => {
  const bridge = loadBridge();
  const { tokens, skipped } = flatten(bridge, {
    fx: {
      lift: {
        $type: 'shadow',
        $value: { color: '#00000040', offsetX: '0px', offsetY: '2px', blur: '8px', spread: '0px' },
      },
      cssOnly: { $type: 'shadow', $value: '0 2px 8px #00000040' },
    },
  });
  assert.deepEqual(skipped, ['fx.cssOnly']);
  assert.deepEqual(tokens, [{
    name: 'fx.lift',
    type: 'shadow',
    value: [{ color: '#00000040', inset: 'false', offsetX: '0px', offsetY: '2px', blur: '8px', spread: '0px' }],
  }]);
});
