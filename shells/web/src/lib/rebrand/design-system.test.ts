// SPDX-License-Identifier: MPL-2.0
/**
 * The active design system as the renovation journey reads it (plan 274 sections 3.3
 * and 3.5), against the real module over a stub host: a catalog that answers a slide
 * master and three logos, and a token set with colours and two faces.
 *
 * What these pin: the plain-JSON input the worker takes, the summary the view shows,
 * the neutral stand-in when the pack ships no master (and that it says so), and the
 * readiness needs read in the same pass.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { neutralSlideMaster } from '@lolly/engine';
import type { SlideMasterFileV1 } from '@lolly-tools/core';
import {
  MASTER_ASSET_TAGS,
  readActiveDesignSystem,
  readFonts,
  readMasterFile,
  resolveActiveDesignSystem,
} from './design-system.ts';

const MASTER_FILE: SlideMasterFileV1 = {
  version: 1,
  masters: [
    {
      id: 'stub/slides/masters',
      version: '2.0.0',
      name: 'Stub master',
      size: { width: 1280, height: 720 },
      typeScale: { title: 40, subtitle: 28, body: 22, caption: 16, number: 12, label: 12 },
      logo: {
        variantByBackground: true,
        assetTags: { onLight: ['logo', 'primary'], onDark: ['logo', 'on-dark'], mono: ['logo', 'mono'] },
      },
      furniture: [{ id: 'logo', kind: 'logo', box: { x: 0.8, y: 0.05, w: 0.15, h: 0.1 }, variantByBackground: true }],
      archetypes: [
        { id: 'content', name: 'Content', furniture: ['logo'], placeholders: [{ role: 'title', box: { x: 0, y: 0, w: 1, h: 0.2 }, kind: 'text' }] },
        { id: 'title', name: 'Title', furniture: ['logo'], placeholders: [{ role: 'title', box: { x: 0, y: 0.3, w: 1, h: 0.3 }, kind: 'text' }] },
        { id: 'quote', name: 'Quote', furniture: [], placeholders: [{ role: 'quote', box: { x: 0.1, y: 0.3, w: 0.8, h: 0.3 }, kind: 'text' }] },
      ],
    },
  ],
};

const MASTER_BYTES = new TextEncoder().encode(JSON.stringify(MASTER_FILE));

interface Row { id: string; type: string; tags: string[]; url: string }

const LOGOS: Row[] = [
  { id: 'stub/logo/primary', type: 'vector', tags: ['logo', 'primary'], url: '/primary.svg' },
  { id: 'stub/logo/reverse', type: 'vector', tags: ['logo', 'on-dark'], url: '/reverse.svg' },
  { id: 'stub/logo/mono-dark', type: 'vector', tags: ['logo', 'on-dark', 'mono'], url: '/mono.svg' },
];

const TOKENS = [
  { path: 'color.semantic.surface', type: 'color', value: '#ffffff' },
  { path: 'color.semantic.text', type: 'color', value: '#101010' },
  { path: 'color.brand.accent', type: 'color', value: '#2244cc' },
  { path: 'font.brand', type: 'fontFamily', value: 'Stub Sans' },
  { path: 'font.mono', type: 'fontFamily', value: ["'Stub Mono'", 'monospace'] },
];

function stubHost(opts: { master?: Uint8Array | null; record?: { id: string; label: string } | null } = {}) {
  const master = opts.master === undefined ? MASTER_BYTES : opts.master;
  const catalog: Row[] = [
    ...(master ? [{ id: 'stub/slides/masters', type: 'data', tags: [...MASTER_ASSET_TAGS], url: '/masters.json' }] : []),
    ...LOGOS,
  ];
  return {
    assets: {
      async query(filter: { type?: string; tags?: string[] }) {
        return catalog.filter((row) =>
          (!filter.type || row.type === filter.type) && (filter.tags ?? []).every((tag) => row.tags.includes(tag)));
      },
      async get(id: string) {
        return catalog.find((row) => row.id === id) ?? null;
      },
      async bytes(target: unknown) {
        if (target === '/masters.json' && master) return master;
        throw new Error(`no bytes for ${String(target)}`);
      },
    },
    tokens: {
      async get() {
        return {
          query: (filter?: { type?: string }) => TOKENS.filter((entry) => !filter?.type || entry.type === filter.type),
          get: (path: string) => TOKENS.find((entry) => entry.path === path),
        };
      },
      ...(opts.record === null ? {} : { async activeRecord() { return opts.record ?? { id: 'stub-system', label: 'Stub system' }; } }),
    },
  };
}

test('a design system with a master resolves to plain input and a summary', async () => {
  const resolved = await resolveActiveDesignSystem(stubHost());
  assert.ok(resolved);
  const { input, info } = resolved;

  assert.equal(input.id, 'stub-system');
  assert.equal(input.name, 'Stub system');
  assert.equal(input.master.id, 'stub/slides/masters');
  assert.equal(input.neutralMaster, false);
  assert.deepEqual(input.colors, {
    'color.semantic.surface': '#ffffff',
    'color.semantic.text': '#101010',
    'color.brand.accent': '#2244cc',
  });
  assert.deepEqual(input.logos, {
    onLight: 'stub/logo/primary',
    onDark: 'stub/logo/reverse',
    monoOnDark: 'stub/logo/mono-dark',
  });
  assert.equal(input.fonts?.brand, 'Stub Sans');
  assert.equal(input.fonts?.mono, 'Stub Mono', 'the first family of a stack, quotes dropped');
  assert.ok(input.fonts?.available?.includes('SUSE'), 'the bundled faces are available on every device');
  assert.equal(
    input.assetHashes?.['stub/slides/masters'],
    `sha256:${createHash('sha256').update(MASTER_BYTES).digest('hex')}`,
    'the master bytes the plan ran against are hashed into the snapshot',
  );
  assert.deepEqual(JSON.parse(JSON.stringify(input)), input, 'the input survives a trip to the worker as JSON');

  assert.equal(info.id, 'stub-system');
  assert.equal(info.name, 'Stub system');
  assert.equal(info.neutralMaster, false);
  assert.equal(info.hasLogo, true);
  assert.deepEqual(info.archetypes, ['content', 'title', 'quote'], 'the archetypes in the master order');
  assert.deepEqual(info.colors, input.colors);
  assert.deepEqual(info.fonts.slice(0, 2), ['Stub Sans', 'Stub Mono']);
});

test('a design system with no master gets the neutral one and says so', async () => {
  const read = await readActiveDesignSystem(stubHost({ master: null }));
  assert.ok(read);
  const { input, info } = read.resolved;
  assert.equal(info.neutralMaster, true);
  assert.equal(input.neutralMaster, true);
  assert.deepEqual(input.master, neutralSlideMaster());
  assert.deepEqual(info.archetypes, neutralSlideMaster().archetypes.map((a) => a.id));
  assert.equal(info.hasLogo, true, 'logos are still looked up against the neutral master tags');
  assert.equal(read.needs.masterAssetId, undefined, 'the neutral master is engine data, not an asset to check');
  assert.deepEqual(input.assetHashes, {});
});

test('a master file this build cannot read is treated as no master', async () => {
  const broken = new TextEncoder().encode(JSON.stringify({ version: 1, masters: [{ id: 'half' }] }));
  const resolved = await resolveActiveDesignSystem(stubHost({ master: broken }));
  assert.equal(resolved?.info.neutralMaster, true);
  assert.equal(await readMasterFile(stubHost({ master: broken }).assets), null);
});

test('the readiness needs are read in the same pass', async () => {
  const read = await readActiveDesignSystem(stubHost());
  assert.equal(read?.needs.masterAssetId, 'stub/slides/masters');
  assert.deepEqual(read?.needs.logoTags, ['primary', 'on-dark'], 'one distinguishing tag per logo side');
});

test('with no registry the shipped design system is the one named', async () => {
  const resolved = await resolveActiveDesignSystem(stubHost({ record: null }));
  assert.equal(resolved?.info.id, 'shipped');
  assert.equal(resolved?.info.name, 'Design system');
});

test('a host with no assets and no tokens has nothing to read', async () => {
  assert.equal(await resolveActiveDesignSystem({}), null);
});

test('faces are absent when the token set names none', async () => {
  assert.deepEqual(await readFonts(undefined), {});
  assert.deepEqual(await readFonts({ async get() { return { get: () => undefined }; } }), {});
});
