// SPDX-License-Identifier: MPL-2.0
/**
 * lib/profile-merge.ts (plans/277 P7): Import data… and Sync's "Bring it to this
 * device" add the incoming profile record to this device's and lose nothing here.
 * Two records with overlapping and distinct folders, favourites, templates and
 * Trash: every entry on this device survives, every new incoming entry arrives,
 * and a second import of the same record changes nothing.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeProfileRecords, isEmptyValue } from './profile-merge.ts';

const T0 = '2026-09-01T00:00:00.000Z';
const T1 = '2026-09-10T00:00:00.000Z';

function folder(id: string, name: string, refs: string[], extra: Record<string, unknown> = {}) {
  return { id, name, parentId: null, items: refs.map(ref => ({ type: 'session', ref })), createdAt: T0, updatedAt: T0, ...extra };
}

/** This device: its own folders, stars, templates, Trash and settings. */
function laptop(): Record<string, unknown> {
  return {
    firstname: 'Ada', email: 'ada@here.example', lang: 'de', useDetails: false,
    featureFlags: { 'cat-designer': true },
    favourites: ['qr-code', 'chart'],
    favouriteAssets: ['lolly/logo/primary'],
    favouriteProjects: ['folder:shared'],
    hiddenTools: ['countdown-timer'], hiddenToolsSeeded: true,
    hiddenTemplates: [], hiddenTemplatesSeeded: true,
    folders: [
      folder('only-here', 'Laptop work', ['laptop-1']),
      folder('shared', 'Event', ['laptop-2'], { color: '#e5484d' }),
      folder('child', 'Drafts', [], { parentId: 'only-here' }),
    ],
    trash: [
      { kind: 'session', slot: '__trash__:t-here', originalSlot: 't-here', label: 'Old', parentId: null, deletedAt: T0 },
      { kind: 'folder', rootId: 'gone-here', name: 'Gone', tree: [], sessions: [], deletedAt: T0 },
    ],
    userTemplates: [{ id: 'tpl-here', toolId: 'qr-code', name: 'Mine', values: { url: 'a' }, createdAt: T0, updatedAt: T0 }],
    projectTemplates: [{ id: 'ptpl-both', name: 'Kit (laptop)', createdAt: T0, tree: [] }],
    userTools: [{ id: 'utool-here', title: 'Mine', formats: ['png'], baseToolId: 'design', values: {}, createdAt: T0, updatedAt: T0 }],
  };
}

/** The incoming copy (another device's backup). */
function phone(): Record<string, unknown> {
  return {
    firstname: 'Ada L.', lastname: 'Lovelace', email: 'ada@phone.example', lang: 'fr', useDetails: true, city: 'London',
    featureFlags: { 'cat-designer': false, other: true },
    favourites: ['chart', 'gradient'],
    favouriteAssets: ['lolly/photos/1'],
    favouriteProjects: ['folder:only-there'],
    hiddenTools: ['gradient'], hiddenToolsSeeded: true,
    hiddenAssets: ['lolly/photos/2'], catalogDefaultsSeeded: true,
    folders: [
      folder('shared', 'Event (renamed there)', ['laptop-2', 'phone-1', 'laptop-1'], { updatedAt: T1, color: '#0090ff' }),
      folder('only-there', 'Phone work', ['phone-2', 'laptop-1']),
      folder('nested-there', 'Inside', ['phone-3'], { parentId: 'only-there' }),
    ],
    trash: [
      { kind: 'session', slot: '__trash__:t-here', originalSlot: 't-here', label: 'Old (phone)', parentId: null, deletedAt: T1 },
      { kind: 'session', slot: '__trash__:t-there', originalSlot: 't-there', label: 'Phone old', parentId: null, deletedAt: T1 },
      { kind: 'folder', rootId: 'gone-there', name: 'Gone there', tree: [], sessions: [], deletedAt: T1 },
      { kind: 'asset', id: 'user/upload/pic.png', label: 'pic.png', parentId: null, deletedAt: T1 },
      { kind: 'font', family: 'Inter', label: 'Inter', assetIds: ['user/fonts/inter/0'], roles: [], designSystemId: null, deletedAt: T1 },
    ],
    userTemplates: [
      { id: 'tpl-here', toolId: 'qr-code', name: 'Mine (phone edit)', values: { url: 'b' }, createdAt: T0, updatedAt: T1 },
      { id: 'tpl-there', toolId: 'chart', name: 'Phone', values: {}, createdAt: T1, updatedAt: T1 },
    ],
    projectTemplates: [
      { id: 'ptpl-both', name: 'Kit (phone)', createdAt: T1, tree: [] },
      { id: 'ptpl-there', name: 'Phone kit', createdAt: T1, tree: [] },
    ],
    userTools: [{ id: 'utool-there', title: 'Phone tool', formats: ['svg'], baseToolId: 'design', values: {}, createdAt: T1, updatedAt: T1 }],
  };
}

const ids = (list: unknown): string[] => (list as Array<{ id: string }>).map(r => r.id);
const byId = (list: unknown, id: string): any => (list as Array<{ id: string }>).find(r => r.id === id);
const refs = (f: { items: Array<{ ref: string }> }): string[] => f.items.map(it => it.ref);

test('folders: every folder here stays with its contents, new ones arrive, a shared one gains members', () => {
  const merged = mergeProfileRecords(laptop(), phone());
  assert.deepEqual(ids(merged.folders), ['only-here', 'shared', 'child', 'only-there', 'nested-there']);

  const shared = byId(merged.folders, 'shared');
  assert.equal(shared.name, 'Event', 'this device keeps its name for a folder on both sides');
  assert.equal(shared.color, '#e5484d', 'and its colour');
  assert.deepEqual(refs(shared), ['laptop-2', 'phone-1'], 'the incoming member it lacked is added');
  assert.equal(shared.updatedAt, T1, 'a folder that gained members takes the later stamp');

  assert.deepEqual(refs(byId(merged.folders, 'only-here')), ['laptop-1'], 'a session filed here stays filed here');
  assert.deepEqual(refs(byId(merged.folders, 'only-there')), ['phone-2'],
    'an incoming member already filed in another folder here is not moved or duplicated');
  assert.equal(byId(merged.folders, 'nested-there').parentId, 'only-there', 'an added folder keeps its parent');
  assert.equal(byId(merged.folders, 'child').parentId, 'only-here');

  const everyRef = (merged.folders as Array<{ items: Array<{ ref: string }> }>).flatMap(refs);
  assert.equal(new Set(everyRef).size, everyRef.length, 'each ref still belongs to one folder');
});

test('favourites: a union, this device first, nothing removed', () => {
  const merged = mergeProfileRecords(laptop(), phone());
  assert.deepEqual(merged.favourites, ['qr-code', 'chart', 'gradient']);
  assert.deepEqual(merged.favouriteAssets, ['lolly/logo/primary', 'lolly/photos/1']);
  assert.deepEqual(merged.favouriteProjects, ['folder:shared', 'folder:only-there']);
});

test('templates and user tools: incoming ids not here are added, every record here stays as it is', () => {
  const merged = mergeProfileRecords(laptop(), phone());
  assert.deepEqual(ids(merged.userTemplates), ['tpl-here', 'tpl-there']);
  assert.equal(byId(merged.userTemplates, 'tpl-here').name, 'Mine', 'a template on both sides keeps this device’s copy');
  assert.deepEqual(byId(merged.userTemplates, 'tpl-here').values, { url: 'a' });
  assert.deepEqual(ids(merged.projectTemplates), ['ptpl-both', 'ptpl-there']);
  assert.equal(byId(merged.projectTemplates, 'ptpl-both').name, 'Kit (laptop)');
  assert.deepEqual(ids(merged.userTools), ['utool-here', 'utool-there']);
});

test('Trash: a union by slot or root id, so an item restorable on either side stays restorable', () => {
  const merged = mergeProfileRecords(laptop(), phone());
  const keys = (merged.trash as Array<{ kind: string; slot?: string; rootId?: string; id?: string; family?: string }>)
    .map(e => e.kind === 'session' ? e.slot : e.kind === 'folder' ? e.rootId : e.kind === 'font' ? e.family : e.id);
  assert.deepEqual(keys, ['__trash__:t-here', 'gone-here', '__trash__:t-there', 'gone-there', 'user/upload/pic.png', 'Inter']);
  const fontAgain = mergeProfileRecords(merged, { trash: [{ kind: 'font', family: 'Inter', label: 'Inter', assetIds: ['user/fonts/inter/0'], roles: ['brand'], designSystemId: null, deletedAt: T0 }] });
  assert.equal((fontAgain.trash as unknown[]).length, 6, 'a font entry is matched by its first face, not compared whole');
  assert.equal((merged.trash as Array<{ label?: string }>)[0]!.label, 'Old', 'an entry on both sides keeps this device’s copy');
});

test('other fields: this device’s values stay; only empty ones are filled from the incoming copy', () => {
  const merged = mergeProfileRecords(laptop(), phone());
  assert.equal(merged.firstname, 'Ada');
  assert.equal(merged.email, 'ada@here.example');
  assert.equal(merged.lang, 'de');
  assert.equal(merged.useDetails, false, 'false is a value, not an empty field');
  assert.deepEqual(merged.featureFlags, { 'cat-designer': true }, 'a set field is kept whole, not merged key by key');
  assert.equal(merged.lastname, 'Lovelace', 'a field absent here is filled');
  assert.equal(merged.city, 'London');
  assert.deepEqual(merged.hiddenTools, ['countdown-timer'], 'hidden tools stay this device’s');
  assert.deepEqual(merged.hiddenTemplates, [], 'a hidden list emptied on purpose here stays empty');
  assert.deepEqual(merged.hiddenAssets, ['lolly/photos/2'], 'an untouched hidden list takes the incoming one');
  assert.equal(merged.catalogDefaultsSeeded, true, 'with its marker');
});

test('empty fields: absent, null, blank, [] and {} are filled; false and 0 are kept', () => {
  const here = { a: null, b: '', c: [], d: {}, e: false, f: 0, g: 'kept' };
  const incoming = { a: 1, b: 'two', c: ['three'], d: { four: 4 }, e: true, f: 6, g: 'lost', h: 'new', i: '' };
  assert.deepEqual(mergeProfileRecords(here, incoming), { a: 1, b: 'two', c: ['three'], d: { four: 4 }, e: false, f: 0, g: 'kept', h: 'new' });
  assert.equal(isEmptyValue(undefined), true);
  assert.equal(isEmptyValue(false), false);
});

test('nothing here is lost, and neither record is mutated', () => {
  const here = laptop();
  const incoming = phone();
  const hereBefore = structuredClone(here);
  const incomingBefore = structuredClone(incoming);
  const merged = mergeProfileRecords(here, incoming);
  assert.deepEqual(here, hereBefore, 'this device’s record (the bridge cache) is untouched');
  assert.deepEqual(incoming, incomingBefore);

  for (const f of hereBefore.folders as Array<{ id: string; items: Array<{ ref: string }> }>) {
    const kept = byId(merged.folders, f.id);
    assert.ok(kept, `folder ${f.id} kept`);
    for (const r of refs(f)) assert.ok(refs(kept).includes(r), `${r} still in ${f.id}`);
  }
  for (const key of ['favourites', 'favouriteAssets', 'favouriteProjects'] as const) {
    for (const v of hereBefore[key] as string[]) assert.ok((merged[key] as string[]).includes(v), `${key} keeps ${v}`);
  }
  for (const key of ['userTemplates', 'projectTemplates', 'userTools', 'trash'] as const) {
    for (const rec of hereBefore[key] as object[]) assert.ok((merged[key] as object[]).some(m => JSON.stringify(m) === JSON.stringify(rec)), `${key} keeps a record unchanged`);
  }

  // Editing the merged record must not write through into the incoming one.
  (byId(merged.folders, 'only-there').items as unknown[]).push({ type: 'session', ref: 'x' });
  assert.deepEqual(incoming, incomingBefore);
});

// plans/277 review B5: trash slots are reused, so an old folder entry brought back
// by an import could purge a newer Trash item, or act on a folder restored since.
test('Trash: an incoming entry for a folder live here, or for a trash slot claimed here, is refused', () => {
  const here = {
    folders: [folder('old-event', 'Old event', [])],
    trash: [{ kind: 'session', slot: '__trash__:qr-code:s', originalSlot: 'qr-code:s', label: 'Invoice QR', parentId: null, deletedAt: T1 }],
  };
  const incoming = {
    trash: [
      // The folder was restored here after this copy was made.
      { kind: 'folder', rootId: 'old-event', name: 'Old event', tree: [], sessions: [], deletedAt: T0 },
      // Another folder whose member's trash slot now holds the newer Invoice QR here.
      { kind: 'folder', rootId: 'gone', name: 'Gone', tree: [], sessions: [{ originalSlot: 'qr-code:s', slot: '__trash__:qr-code:s' }], deletedAt: T0 },
      // Unrelated: still travels.
      { kind: 'folder', rootId: 'other', name: 'Other', tree: [], sessions: [{ originalSlot: 'chart:1', slot: '__trash__:chart:1' }], deletedAt: T0 },
      // Claims the same member slot as 'other' (already accepted above): refused.
      { kind: 'session', slot: '__trash__:chart:1', originalSlot: 'chart:1', label: 'Chart', parentId: null, deletedAt: T0 },
    ],
  };
  const merged = mergeProfileRecords(here, incoming);
  const keys = (merged.trash as Array<{ kind: string; slot?: string; rootId?: string }>).map(e => e.kind === 'session' ? e.slot : e.rootId);
  assert.deepEqual(keys, ['__trash__:qr-code:s', 'other']);
  assert.deepEqual(mergeProfileRecords(merged, incoming).trash, merged.trash, 'and the same again on a repeat');
});

test('a Trash entry of a kind this build does not know still travels, once', () => {
  const future = { kind: 'palette', ref: 'p1', deletedAt: T1 };
  const once = mergeProfileRecords({ trash: [] }, { trash: [future] });
  assert.deepEqual(once.trash, [future]);
  assert.deepEqual(mergeProfileRecords(once, { trash: [future] }).trash, [future]);
});

test('importing the same record twice gives the same result as once', () => {
  const once = mergeProfileRecords(laptop(), phone());
  const twice = mergeProfileRecords(once, phone());
  assert.deepEqual(twice, once);
});

test('a fresh device takes the incoming record as it is', () => {
  const incoming = phone();
  // The fixture files laptop-1 twice on purpose (for the tests above); a real record
  // files each ref once.
  for (const f of incoming.folders as Array<{ items: Array<{ ref: string }> }>) f.items = f.items.filter(it => it.ref !== 'laptop-1');
  assert.deepEqual(mergeProfileRecords({}, incoming), incoming);
  assert.deepEqual(mergeProfileRecords(undefined, incoming), incoming);
});

test('malformed incoming entries are ignored and malformed local ones are kept', () => {
  const here = { folders: [folder('a', 'A', ['s1']), 'junk'], favourites: ['x'] };
  const incoming = { folders: [null, { name: 'no id' }, folder('b', 'B', ['s1', 's2'])], favourites: [7, 'y'], trash: [null, { slot: 'no kind' }] };
  const merged = mergeProfileRecords(here as never, incoming as never);
  assert.equal((merged.folders as unknown[])[1], 'junk');
  assert.deepEqual(refs(byId((merged.folders as unknown[]).filter(f => typeof f === 'object'), 'b')), ['s2']);
  assert.deepEqual(merged.favourites, ['x', 'y']);
  assert.equal(merged.trash, undefined, 'no valid Trash entry, nothing written');
});
