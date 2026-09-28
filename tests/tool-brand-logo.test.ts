// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import type { InputValue } from '../engine/src/inputs.ts';
import { baseHost } from './helpers/host.ts';

const root = new URL('../community/', import.meta.url);
const svg = (label: string) => 'data:image/svg+xml,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 20"><title>${label}</title><rect width="100" height="20" fill="red"/></svg>`,
);
const cases: Array<{ id: string; values: Record<string, InputValue>; edit: string }> = [
  { id: 'deck-studio', values: { deck: [{ layout: 'content', heading: 'Hello' }] }, edit: 'footerText' },
  { id: 'stationery', values: { company: 'Example' }, edit: 'company' },
  { id: 'link-card', values: { siteName: 'Example', url: 'https://example.org' }, edit: 'siteName' },
  { id: 'certificate', values: { company: 'Example' }, edit: 'company' },
  { id: 'multi-page-pdf', values: { coverTitle: 'Example' }, edit: 'coverTitle' },
];

function rig() {
  let brand = 'alpha';
  let missing = false;
  const queries: unknown[] = [];
  const warnings: string[] = [];
  const tokens = {
    get: async () => ({ resolve: () => undefined }),
    resolve: async (ref: string) => !missing && ref.startsWith('{asset.logo.')
      ? `user/ds/${brand}/logo/${ref.slice(12, -1)}` : undefined,
  };
  const host = baseHost({
    tokens,
    assets: {
      query: async (filter: unknown) => {
        queries.push(filter);
        return [{ id: 'foreign/logo/primary', url: svg('FOREIGN'), width: 100, height: 20 }];
      },
      get: async (id: string) => ({ id, url: svg(id), width: 100, height: 20 }),
    },
    log: (level: string, message: string) => { if (level === 'warn') warnings.push(message); },
  });
  return { host, queries, warnings, switchTo: (id: string) => { brand = id; }, removeLogos: () => { missing = true; } };
}

for (const spec of cases) {
  const tool = await loadTool(spec.id, (path) => readFile(new URL(path, root), 'utf8'));
  test(`${spec.id}: active logos survive switching and reload without consulting catalogue tags`, async () => {
    const r = rig();
    const rt = await createRuntime(tool, r.host, spec.values);
    assert.deepEqual(rt.hookErrors, []);
    assert.match(rt.getHydrated() as string, /user%2Fds%2Falpha%2Flogo/);
    assert.doesNotMatch(rt.getHydrated() as string, /FOREIGN/);
    r.switchTo('beta');
    await rt.setInput(spec.edit, 'Changed');
    assert.deepEqual(rt.hookErrors, []);
    assert.match(rt.getHydrated() as string, /user%2Fds%2Fbeta%2Flogo/);
    assert.doesNotMatch(rt.getHydrated() as string, /user%2Fds%2Falpha%2Flogo/);
    const reopened = await createRuntime(tool, r.host, spec.values);
    assert.match(reopened.getHydrated() as string, /user%2Fds%2Fbeta%2Flogo/);
    assert.deepEqual(r.queries, []);
  });

  test(`${spec.id}: missing requested logos warn; choosing no logo clears the warning`, async () => {
    const r = rig();
    r.removeLogos();
    const rt = await createRuntime(tool, r.host, spec.values);
    const doc = new JSDOM(rt.getHydrated() as string).window.document;
    const warning = doc.querySelector('[data-export-hide][role="status"]');
    assert.match(warning?.textContent ?? '', /logo.*unavailable/i);
    assert.equal(doc.querySelectorAll('img').length, 0);
    assert.equal(r.warnings.length, 1);
    await rt.setInput('brandLogo', false);
    assert.equal(new JSDOM(rt.getHydrated() as string).window.document.querySelector('[data-export-hide][role="status"]'), null);
    assert.deepEqual(r.queries, []);
  });
}

const source = await readFile(new URL('_shared/brand-logo.js', root), 'utf8');
test('Deck Studio preview and native PowerPoint model choose each requested variant and honour per-slide logo-off', async () => {
  const tool = await loadTool('deck-studio', (path) => readFile(new URL(path, root), 'utf8'));
  const r = rig();
  const rt = await createRuntime(tool, r.host, { deck: [
    { layout: 'content', heading: 'Light' },
    { layout: 'content', heading: 'Light mono', logo: 'mono' },
    { layout: 'title', heading: 'Dark' },
    { layout: 'title', heading: 'Dark mono', logo: 'mono' },
    { layout: 'content', heading: 'No logo', logo: 'off' },
  ] });
  const doc = new JSDOM(rt.getHydrated() as string).window.document;
  const deck = JSON.parse(doc.querySelector('[data-pptx-deck]')!.textContent!);
  const expected = ['horizontal-primary', 'horizontal-mono', 'horizontal-primary-reverse', 'horizontal-mono-reverse'];
  for (let i = 0; i < expected.length; i++) {
    const src = deck.slides[i].elements.find((el: { t: string }) => el.t === 'image').src;
    assert.equal(src, svg(`user/ds/alpha/logo/${expected[i]}`));
    assert.equal(doc.querySelectorAll('.ds-slide')[i]!.querySelector('img')!.src, src);
  }
  assert.ok(!deck.slides[4].elements.some((el: { t: string }) => el.t === 'image'));
  assert.equal(doc.querySelectorAll('.ds-slide')[4]!.querySelector('img'), null);
  r.removeLogos();
  const noLogo = await createRuntime(tool, r.host, { deck: [{ layout: 'title', heading: 'No logo', logo: 'off' }] });
  assert.equal(noLogo.getHydratedString('{{_logoWarning}}'), '');
});

test('logo slots keep background polarity, use same-system orientation/treatment fallbacks and retry broken slots', async () => {
  const slots: Record<string, string> = {
    'horizontal-primary': 'broken',
    'vertical-primary': 'alpha-vertical',
    'horizontal-mono': 'alpha-mono',
    'horizontal-primary-reverse': 'alpha-reverse',
  };
  const host = baseHost({
    tokens: { resolve: async (ref: string) => slots[ref.slice(12, -1)] },
    assets: { get: async (id: string) => {
      if (id === 'broken') throw new Error('Missing asset');
      return { id, url: svg(id) };
    }, query: async () => { throw new Error('Never query other brands'); } },
  });
  const resolve = new Function('host', `${source}\nreturn resolveBrandLogo;`)(host);
  assert.equal((await resolve(false, false)).id, 'alpha-vertical');
  assert.equal((await resolve(false, true)).id, 'alpha-mono');
  assert.equal((await resolve(true, true)).id, 'alpha-reverse');
  delete slots['horizontal-primary-reverse'];
  assert.equal(await resolve(true, false), null, 'never use a light mark on a dark background');
  host.tokens.resolve = async (ref: string) => ref;
  assert.equal(await resolve(false, false), null, 'unresolved aliases are not asset ids');
  delete host.tokens;
  assert.equal(await resolve(false, false), null, 'older hosts do not fall back to other brands');
});
