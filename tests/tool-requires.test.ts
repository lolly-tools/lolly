// SPDX-License-Identifier: MPL-2.0
/**
 * Manifest `requires` - the optional host.* APIs a tool calls unguarded.
 * Three layers: the static analyser (scripts/tool-requires.ts) that computes
 * the list from hooks.js, the runtime refusal (engine/src/runtime.ts) that
 * keeps a tool off a shell lacking one, and the drift guard that every shipped
 * manifest agrees with its own hooks.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { analyseRequires, apiIntroductions, impliedFloor, rangeFloor } from '../scripts/tool-requires.ts';
import { HOST_V1_OPTIONAL_APIS, presentApis, missingRequires } from '../packages/core/src/host-v1/apis.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { createMockHost } from '../packages/core/src/mock-host.ts';
import type { LoadedTool } from '../engine/src/loader.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('analyser: an unguarded reach into an optional API is required; a guarded one is not', () => {
  const a = analyseRequires(`
    async function onInit({ host }) {
      const p = await host.text.toPath('x');          // unguarded → required
      const t = host.tokens?.resolve('a');            // optional chaining → guarded
      if (host.pdf) await host.pdf.analyze(bytes);    // if-guard → guarded
      const ok = typeof host.audio !== 'undefined' && host.audio.analyse(b); // typeof → guarded
      return { p, t, ok };
    }
  `);
  assert.deepEqual(a.used.sort(), ['audio', 'pdf', 'text', 'tokens']);
  assert.deepEqual(a.guarded.sort(), ['audio', 'pdf', 'tokens']);
  assert.deepEqual(a.required, ['text']);
});

test('analyser: merely naming an API (a comment, a string) is not a use', () => {
  const a = analyseRequires(`// host.text would be nice\nconst why = 'host.pdf';\nfunction onInit() { return {}; }`);
  assert.deepEqual(a.used, []);
  assert.deepEqual(a.required, []);
});

test('analyser: a comment that explains an API is prose, not a reach into it', () => {
  const a = analyseRequires(`
    /** host.text.toPath emits absolute M/L/C/Q/Z only, so the subdivision below
     *  never sees an arc. host.audio.analyse turns the clip into a track. */
    // brand-driven palettes (host.color/host.tokens, engine >= 1.40): host.color.ramp()
    function onInit() { return { url: 'https://example.test/x' }; }
  `);
  assert.deepEqual(a.used, []);
  assert.deepEqual(a.required, []);
  const real = analyseRequires(`// host.text is documented above\nasync function onInit({ host }) { return { p: await host.text.toPath({ text: 'a' }) }; }`);
  assert.deepEqual(real.required, ['text'], 'the call after the comment still counts');
});

test('analyser: reading the bare API as a value is a guard, wherever it sits in the expression', () => {
  const ternary = analyseRequires(`
    async function onInit() {
      var t = (typeof host !== 'undefined' && host && host.tokens) ? host.tokens : null;
      return { n: t ? (await t.colors()).length : 0 };
    }
  `);
  assert.deepEqual(ternary.required, [], JSON.stringify(ternary));
  const lastOperand = analyseRequires(`
    async function onInit() {
      if (typeof host !== 'undefined' && host && host.compose) {
        return { img: await host.compose.renderUrl('https://lolly.tools/tool/x.svg') };
      }
      return {};
    }
  `);
  assert.deepEqual(lastOperand.required, [], JSON.stringify(lastOperand));
  const assigned = analyseRequires(`
    async function onInit() {
      const c = typeof host !== 'undefined' && host && host.color;
      return { hex: c ? c.mix('#000', '#fff', 0.5) : '#888', x: host.color.mix('#000', '#fff', 0) };
    }
  `);
  assert.deepEqual(assigned.required, [], JSON.stringify(assigned));
  const unguarded = analyseRequires(`async function onInit({ host }) { return { ok: await host.c2pa.sign(new Uint8Array(0)) }; }`);
  assert.deepEqual(unguarded.required, ['c2pa']);
});

test('changelog: every API that has shipped has a recorded introduction, and floors only rise', () => {
  const intro = apiIntroductions(readFileSync(join(ROOT, 'engine/CHANGELOG.md'), 'utf8'));
  for (const api of ['tokens', 'text', 'pdf', 'audio', 'recorder', 'media', 'compose', 'c2pa', 'color'] as const) {
    assert.ok(intro.get(api), `${api} has an introduction version`);
  }
  assert.equal(rangeFloor('^1.0.0'), '1.0.0');
  assert.equal(rangeFloor('>=1.150.0 <2.0.0'), '1.150.0');
  assert.equal(rangeFloor(undefined), null);
  const floor = impliedFloor(['tokens', 'text'], intro);
  assert.ok(floor && floor >= (intro.get('tokens') ?? ''), 'the floor is the newest introduction among the required set');
});

test('presentApis / missingRequires read the host as it is', () => {
  const host = createMockHost();
  const present = presentApis(host as never);
  for (const api of present) assert.ok((HOST_V1_OPTIONAL_APIS as readonly string[]).includes(api));
  assert.deepEqual(missingRequires(['text'], { text: {} }), []);
  assert.deepEqual(missingRequires(['text', 'pdf'], { text: {} }), ['pdf']);
  assert.deepEqual(missingRequires(['nonsense'], { text: {} }), ['nonsense'], 'a typo is a miss, not a pass');
  assert.deepEqual(missingRequires(undefined, {}), []);
});

test('runtime: a tool whose requires the host cannot meet is refused before any hook runs', async () => {
  let hookRan = false;
  const tool = {
    manifest: {
      id: 'needs-text', name: 'Needs text', version: '1.0.0', engineVersion: '^1.0.0', status: 'community',
      inputs: [], hooks: true, requires: ['text'],
    },
    template: '<div></div>',
    hooksSource: 'function onInit() { globalThis.__hookRan = true; return {}; }',
  } as unknown as LoadedTool;
  const host = createMockHost() as unknown as Parameters<typeof createRuntime>[1];
  delete (host as unknown as Record<string, unknown>).text;
  await assert.rejects(() => createRuntime(tool, host), /requires host\.text/);
  hookRan = Boolean((globalThis as Record<string, unknown>).__hookRan);
  assert.equal(hookRan, false);
});

test('every shipped manifest agrees with its own hooks about requires', () => {
  const roots = ['community', 'brands/lolly-start/tools', 'brands/suse/tools'];
  const drift: string[] = [];
  for (const root of roots) {
    const abs = join(ROOT, root);
    if (!existsSync(abs)) continue;
    for (const dir of readdirSync(abs)) {
      const manifestPath = join(abs, dir, 'tool.json');
      if (dir.startsWith('_') || !existsSync(manifestPath)) continue;
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { requires?: string[] };
      const hooksPath = join(abs, dir, 'hooks.js');
      const { required } = analyseRequires(existsSync(hooksPath) ? readFileSync(hooksPath, 'utf8') : '');
      const declared = manifest.requires ?? [];
      if (declared.join(',') !== required.join(',')) drift.push(`${root}/${dir}: declared [${declared}] vs hooks [${required}]`);
    }
  }
  assert.deepEqual(drift, [], 'run `node scripts/tool-requires.ts --write`');
});
