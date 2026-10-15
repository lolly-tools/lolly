// SPDX-License-Identifier: MPL-2.0
/**
 * resolveRefs re-runs onInput for every value it completes.
 *
 * A template or starter picked after mount arrives through applyPatch or setInput,
 * which resolve no refs, so its `{color.*}` links reach onInput unresolved. The shell
 * then calls runtime.resolveRefs(), which completes the links in the model. A tool
 * whose hook builds its markup from those values (QR Code's svgContent, Design's
 * mediaHtml) kept the markup from the unresolved pass: QR Code's "Website link"
 * starter drew its modules in the fallback near-black until the first edit, while the
 * Module colour swatch already showed the brand colour. setTokenSelection already
 * re-runs onInput for the values it changes; resolveRefs now does the same.
 *
 * Run with: node --import ./tests/css-stub.mjs --test tests/resolve-refs-hooks.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { createTokenSet } from '../engine/src/tokens.ts';
import { baseHost } from './helpers/host.ts';

/** A design system whose secondary is unmistakable: Opal's Bunyapine. */
const DOC = {
  color: {
    semantic: {
      primary: { $type: 'color', $value: '#033633' },
      secondary: { $type: 'color', $value: '#008657' },
      surface: { $type: 'color', $value: '#ffffff' },
      text: { $type: 'color', $value: '#09141a' },
    },
  },
};

function tokenHost(): any {
  return baseHost({
    tokens: {
      get: async (opts = {}) => createTokenSet(DOC as never, opts),
      colors: async (opts = {}) => createTokenSet(DOC as never, opts).colors(),
      resolve: async (ref: string, opts = {}) => createTokenSet(DOC as never, opts).resolve(ref),
    },
  });
}

test('resolveRefs runs onInput again, so markup a hook builds from a colour link follows the resolved colour', async () => {
  const seen: unknown[] = [];
  const tool: any = {
    manifest: {
      id: 'resolve-refs-hooks', name: 'Swatch', version: '1.0.0', engineVersion: '^1.0.0', status: 'official',
      render: { width: 10, height: 10, formats: ['png'] },
      inputs: [{ id: 'ink', type: 'color', default: '#111111' }],
      hooks: ['onInit', 'onInput'],
    },
    template: '{{{mark}}}',
    hooksSource: `
      function paint(model) {
        var ink = model.find(function (i) { return i.id === 'ink'; }).value;
        var hex = ink && typeof ink === 'object' ? ink.value : ink;
        return { mark: '<b data-ink="' + (hex || 'none') + '"></b>' };
      }
      function onInit({ model }) { return paint(model); }
      function onInput({ id, value, model }) { globalThis.__resolveRefsSeen.push(value); return paint(model); }
    `,
  };
  (globalThis as any).__resolveRefsSeen = seen;
  const rt: any = await createRuntime(tool, tokenHost(), {});
  assert.match(rt.getHydrated(), /data-ink="#111111"/, 'the default paints at mount');

  // A starter seeds a link the way the tool view's template pick does.
  await rt.applyPatch({ ink: '{color.semantic.secondary}' });
  assert.doesNotMatch(rt.getHydrated(), /#008657/, 'applyPatch resolves no links');

  await rt.resolveRefs();
  assert.equal(rt.getModel().find((i: any) => i.id === 'ink').value.value, '#008657', 'the model holds the resolved colour');
  assert.match(rt.getHydrated(), /data-ink="#008657"/, 'the hook rebuilt its markup from the resolved colour');
  assert.equal(seen.at(-1), '#008657', 'onInput was told the resolved value');
  rt.destroy?.();
  delete (globalThis as any).__resolveRefsSeen;
});

test('resolveRefs with nothing to complete runs no hook and renders nothing new', async () => {
  let runs = 0;
  const tool: any = {
    manifest: {
      id: 'resolve-refs-quiet', name: 'Quiet', version: '1.0.0', engineVersion: '^1.0.0', status: 'official',
      render: { width: 10, height: 10, formats: ['png'] },
      inputs: [{ id: 'ink', type: 'color', default: '#111111' }],
      hooks: ['onInput'],
    },
    template: '<i></i>',
    hooksSource: 'function onInput() { globalThis.__resolveRefsRuns(); return null; }',
  };
  (globalThis as any).__resolveRefsRuns = () => { runs++; };
  const rt: any = await createRuntime(tool, tokenHost(), {});
  let emits = 0;
  rt.subscribe(() => { emits++; });
  const afterSubscribe = emits;
  await rt.resolveRefs();
  assert.equal(runs, 0, 'no value changed, so onInput does not run');
  assert.equal(emits, afterSubscribe, 'and nothing re-renders');
  rt.destroy?.();
  delete (globalThis as any).__resolveRefsRuns;
});

const COMMUNITY = join(dirname(fileURLToPath(import.meta.url)), '..', 'community');
const SKIP = !existsSync(COMMUNITY) && 'community pack not mounted';

test('QR Code: the Website link starter paints its modules in the design system colour on the first render', { skip: SKIP }, async () => {
  const tool: any = await loadTool('qr-code', (path: string) => readFile(join(COMMUNITY, path), 'utf8'));
  const starter = JSON.parse(await readFile(join(COMMUNITY, 'qr-code', 'templates', 'website.json'), 'utf8'));
  assert.equal(starter.values.color, '{color.semantic.secondary}', 'the starter links its modules to the secondary colour');
  const rt: any = await createRuntime(tool, tokenHost(), {});
  // What the tool view does with a picked starter: applyPatch, then one resolve pass.
  await rt.applyPatch(starter.values);
  await rt.resolveRefs();
  const svg = rt.getHydratedString('{{{svgContent}}}') as string;
  assert.match(svg, /fill:#008657/, 'the modules take the resolved secondary colour');
  assert.doesNotMatch(svg, /fill:#111111/, 'not the fallback paint an unresolved link gets');
  rt.destroy?.();
});
