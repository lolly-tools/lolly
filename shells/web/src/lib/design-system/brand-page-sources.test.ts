// SPDX-License-Identifier: MPL-2.0
/**
 * What the web shell hands the page builder: internal skills stay unread, a brand lock
 * holds until the manager's yes, and the shipped slot never becomes the page's address.
 * Run: node --import ./tests/css-stub.mjs --test shells/web/src/lib/design-system/brand-page-sources.test.ts
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import type { AssetRef } from '@lolly-tools/core/host-v1';
import { assembleBrandPage, EMPTY_CHOICES, includableLogos, readBrandPageSources } from './brand-page-sources.ts';

const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>');
const DOC = {
  $description: 'Acme keeps things simple.',
  color: { $type: 'color', semantic: { primary: { $value: '#123456' }, surface: { $value: '#ffffff' }, text: { $value: '#111111' } } },
};

const logo = (id: string, meta: Record<string, unknown>): AssetRef => ({
  id, source: 'library', type: 'vector', format: 'svg', url: `/catalog/${id}.svg`, meta: { name: id, tags: ['logo'], ...meta },
});
const skill = (name: string, audience: 'public' | 'internal'): AssetRef => ({
  id: `acme/skill/${name}`, source: 'library', type: 'skill', format: 'md', url: `/catalog/${name}.md`,
  meta: { name, skill: { name, description: `${name} guidance.`, discipline: 'brand', audience, status: 'approved', skillRevision: '1' } },
});

function hostWith(refs: AssetRef[], record: Record<string, unknown>) {
  const read: string[] = [];
  const host = {
    tokens: {
      snapshot: async () => ({ document: DOC, system: { label: 'Acme' }, selection: {}, version: null }),
      activeRecord: async () => record,
    },
    assets: {
      query: async (filter: { type?: string } = {}) => refs.filter(ref => !filter.type || ref.type === filter.type),
      get: async (id: string) => refs.find(ref => ref.id === id)!,
      bytes: async (target: AssetRef | string) => {
        read.push(typeof target === 'string' ? target : target.id);
        return SVG;
      },
      _listUserAssets: async () => [],
    },
  };
  return { host: host as never, read };
}

const SHIPPED = { id: 'shipped', label: 'Acme', headId: 'x', locked: false, source: { kind: 'shipped' } };

test('an internal skill goes in as a name only, and its text is never read', async () => {
  const { host, read } = hostWith([skill('voice', 'public'), skill('secret', 'internal')], SHIPPED);
  const sources = (await readBrandPageSources(host))!;
  assert.ok(read.includes('acme/skill/voice'));
  assert.equal(read.includes('acme/skill/secret'), false);
  assert.deepEqual(sources.skills.find(row => row.name === 'secret')?.files, {});
  const build = await assembleBrandPage(sources, EMPTY_CHOICES);
  assert.equal(build.files.some(file => file.path.includes('secret')), false);
  assert.ok(build.files.some(file => file.path === 'skills/voice/SKILL.md'));
});

test('a logo with no recorded licence stays out until the publisher includes it', async () => {
  const { host } = hostWith([logo('acme/logo/mark', {})], SHIPPED);
  const sources = (await readBrandPageSources(host))!;
  assert.deepEqual(includableLogos(sources.logos).map(row => row.id), ['acme/logo/mark']);
  const held = await assembleBrandPage(sources, EMPTY_CHOICES);
  assert.equal(held.files.some(file => file.role === 'logo'), false);
  assert.ok(held.manifest.held.some(row => row.item === 'acme/logo/mark'));
  const included = await assembleBrandPage(sources, { ...EMPTY_CHOICES, include: ['acme/logo/mark'] });
  assert.ok(included.files.some(file => file.role === 'logo'));
});

test('a managed system reports it, and a brand lock holds until the manager says yes', async () => {
  const locked = logo('acme/logo/locked', { brandLock: true, license: 'CC0-1.0' });
  const { host } = hostWith([locked], { ...SHIPPED, locked: true });
  const blocked = (await readBrandPageSources(host))!;
  assert.equal(blocked.managed, true);
  assert.equal(blocked.logos[0]!.brandLock, true);
  assert.deepEqual(includableLogos(blocked.logos), [], 'a lock is not something a publisher can tick past');
  const allowed = (await readBrandPageSources(host, { allowManaged: true }))!;
  assert.equal(allowed.logos[0]!.brandLock, undefined);
});

test('the shipped slot is not an address: the page takes its id from the document or its name', async () => {
  const { host } = hostWith([], SHIPPED);
  const sources = (await readBrandPageSources(host))!;
  assert.equal(sources.id, '');
  const build = await assembleBrandPage(sources, EMPTY_CHOICES);
  assert.equal(build.manifest.id, 'acme');
});

test('the publisher\'s words and the footer switch reach the page', async () => {
  const { host } = hostWith([], SHIPPED);
  const sources = (await readBrandPageSources(host))!;
  const build = await assembleBrandPage(sources, { ...EMPTY_CHOICES, statement: ' Use it kindly. ', contact: 'brand@example.com', madeWith: false, origin: 'javascript:alert(1)' });
  assert.deepEqual(build.manifest.usage, { statement: 'Use it kindly.', contact: 'brand@example.com' });
  assert.equal('origin' in build.manifest && build.manifest.origin, false, 'only an http address is an address');
  const page = new TextDecoder().decode(build.files.find(file => file.path === 'index.html')!.bytes);
  assert.doesNotMatch(page, /Made with/);
});

test('nothing to read gives null, so the sheet can say so', async () => {
  const empty = { tokens: { snapshot: async () => ({ document: null, system: null }) }, assets: { query: async () => [] } };
  assert.equal(await readBrandPageSources(empty as never), null);
});
