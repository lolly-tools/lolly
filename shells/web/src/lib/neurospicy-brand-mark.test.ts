// SPDX-License-Identifier: MPL-2.0
/**
 * The music player's brand mark: the silhouette laid over the visualiser is the
 * active design system's declared mono-reverse logo, wide and stacked. Lolly Demo
 * declares its reversed wordmark and its reversed mark, whose ids name no
 * orientation, so a guess from file names found nothing there.
 *
 *   node --import ./tests/css-stub.mjs --test shells/web/src/lib/neurospicy-brand-mark.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://localhost/' });
for (const key of ['window', 'document', 'navigator', 'localStorage', 'HTMLElement'] as const) {
  if (!(key in globalThis)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: (dom.window as unknown as Record<string, unknown>)[key] });
}
if (!('matchMedia' in globalThis)) Object.defineProperty(globalThis, 'matchMedia', { configurable: true, value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) });

const { createNeurospicyDockHost } = await import('./neurospicy-dock-host.ts');

function host(slots: Record<string, string>, catalogue: string[] = []) {
  return {
    assets: {
      get: async (id: string) => ({ id, url: `/catalog/${id}.svg` }),
      query: async () => catalogue.map((id) => ({ id, url: `/catalog/${id}.svg` })),
      _listUserAssets: async () => [],
    },
    profile: { get: async () => ({}), set: async () => ({}) },
    tokens: { colors: async () => [], resolve: async (ref: string) => slots[ref] ?? ref },
  };
}

test('the declared mono-reverse logos are the brand mark, wide and stacked', async () => {
  const handle = createNeurospicyDockHost(host({
    '{asset.logo.horizontal-mono-reverse}': 'lolly/logo/horizontal-reverse',
    '{asset.logo.vertical-mono-reverse}': 'lolly/logo/mono-reverse',
  }) as never);
  assert.deepEqual(await handle.host.viz?.brandMark?.(), {
    horizontal: '/catalog/lolly/logo/horizontal-reverse.svg',
    vertical: '/catalog/lolly/logo/mono-reverse.svg',
  });
  handle.destroy();
});

test('a design system that declares no slots still gets a mark named for its orientation', async () => {
  const handle = createNeurospicyDockHost(host({}, ['acme/logo/horizontal-mono-reverse', 'acme/logo/primary']) as never);
  assert.deepEqual(await handle.host.viz?.brandMark?.(), { horizontal: '/catalog/acme/logo/horizontal-mono-reverse.svg', vertical: null });
  handle.destroy();
});
