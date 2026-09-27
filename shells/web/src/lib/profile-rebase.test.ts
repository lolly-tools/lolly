// SPDX-License-Identifier: MPL-2.0
/**
 * What a profile write made from an old copy does to the stored record
 * (lib/profile-rebase.ts, plan 277 review R3). Three copies of each field: the
 * base the writer read, the record stored now, and what the writer sends.
 *
 * Run directly:  node --test shells/web/src/lib/profile-rebase.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ID_LIST_FIELDS, MAP_FIELDS, RECORD_LIST_FIELDS, rebaseProfileWrite, sameValue } from './profile-rebase.ts';
import { RECORD_LISTS, UNION_LISTS } from './profile-merge.ts';

type Rec = Record<string, unknown>;
const rebase = (base: Rec, current: Rec, next: Rec): Rec => rebaseProfileWrite(base, current, next);

const session = (slot: string, deletedAt: string, extra: Rec = {}): Rec =>
  ({ kind: 'session', slot, originalSlot: slot.replace(/^__trash__:@[0-9a-z]+:/, ''), label: slot, parentId: null, deletedAt, ...extra });
const folder = (id: string, refs: string[], extra: Rec = {}): Rec =>
  ({ id, name: id, parentId: null, items: refs.map(ref => ({ type: 'session', ref })), createdAt: 't0', updatedAt: 't0', ...extra });

test('sameValue ignores key order and treats an undefined field as absent', () => {
  assert.ok(sameValue({ a: 1, b: [1, { c: 2 }] }, { b: [1, { c: 2 }], a: 1 }));
  assert.ok(sameValue({ a: 1, b: undefined }, { a: 1 }));
  assert.ok(!sameValue([1, 2], [2, 1]), 'list order matters');
  assert.ok(!sameValue({ a: 1 }, { a: '1' }));
});

test('a field the writer left alone keeps the stored value, and one it changed takes the writer\'s', () => {
  const base = { firstname: 'Ada', trash: [session('__trash__:a', 't1')], favourites: ['qr'] };
  const current = { ...base, trash: [session('__trash__:b', 't2'), ...base.trash], lang: 'de' };
  const next = { ...base, favourites: ['qr', 'chart'], firstname: 'Ada L.' };
  assert.deepEqual(rebase(base, current, next), {
    firstname: 'Ada L.', trash: current.trash, favourites: ['qr', 'chart'], lang: 'de',
  });
});

test('a field the writer removed is removed, and a field the other writer removed stays removed', () => {
  const base = { exportHome: 'dropbox', theme: 'dark', saveRenders: false };
  const current = { exportHome: 'dropbox', saveRenders: false };      // the other tab cleared the theme
  const next = { theme: 'dark', saveRenders: false };                 // this writer cleared the export home
  assert.deepEqual(rebase(base, current, next), { saveRenders: false });
});

test('Trash: both sides add entries, each keeps its own, and the writer\'s new entry goes first', () => {
  const old = session('__trash__:@1:old', '2026-09-01T00:00:00.000Z');
  const base = { trash: [old] };
  const theirs = session('__trash__:@2:a', '2026-09-27T10:00:00.000Z', { parentId: 'fold', label: 'Poster FINAL' });
  const mine = session('__trash__:@3:b', '2026-09-27T10:05:00.000Z');
  const out = rebase(base, { trash: [theirs, old] }, { trash: [mine, old] });
  assert.deepEqual(out.trash, [mine, theirs, old]);
});

test('Trash: an entry restored or deleted forever by the other writer is never brought back', () => {
  const kept = session('__trash__:@1:kept', '2026-09-20T00:00:00.000Z');
  const restored = session('__trash__:@2:gone', '2026-09-21T00:00:00.000Z');
  const base = { trash: [restored, kept] };
  const current = { trash: [kept] };
  // The writer still holds the restored entry and adds one of its own.
  const added = session('__trash__:@3:new', '2026-09-27T00:00:00.000Z');
  assert.deepEqual(rebase(base, current, { trash: [added, restored, kept] }).trash, [added, kept]);
  // A writer that narrowed the removed entry does not bring it back either: removal wins.
  assert.deepEqual(rebase(base, current, { trash: [{ ...restored, label: 'renamed' }, kept] }).trash, [kept]);
});

test('Trash: the same upload deleted twice is two events, told apart by the delete time', () => {
  const first = { kind: 'asset', id: 'user/a', label: 'A', parentId: null, deletedAt: '2026-09-01T00:00:00.000Z' };
  const second = { ...first, deletedAt: '2026-09-27T00:00:00.000Z' };
  const out = rebase({ trash: [first] }, { trash: [] }, { trash: [second, first] });
  assert.deepEqual(out.trash, [second], 'the first event, gone from the store, stays gone; the second arrives');
});

test('folders: a move out of a folder in one tab and an add to it in another both hold', () => {
  const base = { folders: [folder('event', ['qr:a', 'qr:b'])] };
  // Tab A moved qr:a to the Trash (out of the folder).
  const current = { folders: [folder('event', ['qr:b'], { updatedAt: 't1' })] };
  // Tab B, from its old copy, files qr:c in the same folder and renames the folder.
  const next = { folders: [folder('event', ['qr:a', 'qr:b', 'qr:c'], { name: 'Launch', updatedAt: 't2' })] };
  const [event] = rebase(base, current, next).folders as Rec[];
  assert.deepEqual(event!.items, [{ type: 'session', ref: 'qr:b' }, { type: 'session', ref: 'qr:c' }]);
  assert.equal(event!.name, 'Launch');
  assert.equal(event!.updatedAt, 't2');
});

test('folders: a folder one side deleted stays deleted, and one each side created is kept', () => {
  const base = { folders: [folder('a', []), folder('b', [])] };
  const current = { folders: [folder('b', []), folder('c', [])] };          // a deleted, c created
  const next = { folders: [folder('a', ['x'], { updatedAt: 't2' }), folder('b', []), folder('d', [])] };
  assert.deepEqual((rebase(base, current, next).folders as Rec[]).map(f => f.id), ['b', 'd', 'c']);
});

test('id lists combine as sets, removals included', () => {
  const base = { favourites: ['a', 'b'], hiddenTools: ['x'] };
  const current = { favourites: ['a', 'b', 'c'], hiddenTools: [] };
  const next = { favourites: ['b', 'd'], hiddenTools: ['x', 'y'] };
  assert.deepEqual(rebase(base, current, next), { favourites: ['b', 'd', 'c'], hiddenTools: ['y'] });
});

test('maps combine entry by entry; any other field both changed takes the writer\'s value', () => {
  const base = { featureFlags: { a: true }, headshot: { id: 'user/h1', version: '1' } };
  const current = { featureFlags: { a: true, b: false }, headshot: { id: 'user/h2', version: '1' } };
  const next = { featureFlags: { a: false, c: true }, headshot: { id: 'user/h3', version: '2' } };
  assert.deepEqual(rebase(base, current, next), {
    featureFlags: { a: false, b: false, c: true },
    headshot: { id: 'user/h3', version: '2' },
  });
});

test('N1: an entry with no key of its own is matched by its whole value, so the rest of the list still combines', () => {
  // A Trash kind this build does not know (a tab on another build), and an entry with no delete time.
  const odd = { kind: 'template', id: 'tpl1', label: 'T', parentId: null, deletedAt: 't0' };
  const undated = { kind: 'session', slot: '__trash__:x', label: 'X', parentId: null };
  const theirs = { kind: 'asset', id: 'user/a', label: 'A', parentId: null, deletedAt: 't2' };
  const mine = { kind: 'asset', id: 'user/b', label: 'B', parentId: null, deletedAt: 't3' };
  const out = rebase({ trash: [odd, undated] }, { trash: [theirs, odd, undated] }, { trash: [mine, odd, undated] });
  assert.deepEqual(out.trash, [mine, theirs, odd, undated], 'both new entries are kept, and the odd ones stay once');
  const removed = rebase({ trash: [odd, theirs] }, { trash: [theirs] }, { trash: [mine, odd, theirs] });
  assert.deepEqual(removed.trash, [mine, theirs], 'an odd entry the other writer removed stays removed');
});

test('N1: an id that repeats is numbered by occurrence rather than making the list fall back', () => {
  assert.deepEqual(rebase({ favourites: ['a', 'a'] }, { favourites: ['a', 'a', 'c'] }, { favourites: ['a', 'a', 'd'] }).favourites, ['a', 'a', 'd', 'c']);
  const t = (id: string, name: string): Rec => ({ id, name });
  const out = rebase({ userTemplates: [t('x', '1'), t('x', '2')] }, { userTemplates: [t('x', '1'), t('x', '2'), t('y', '3')] }, { userTemplates: [t('x', '1')] });
  assert.deepEqual(out.userTemplates, [t('x', '1'), t('y', '3')], 'the writer removed the second copy; the other writer added y');
});

test('N4: map keys named like Object members or __proto__ are kept as the record\'s own', () => {
  const inherited = rebase({ custom: { team: 'a' }, lang: 'en' }, { custom: { team: 'a', toString: 'x', constructor: 'y' }, lang: 'en' }, { custom: { team: 'a' }, lang: 'de' });
  assert.deepEqual(inherited, { custom: { team: 'a', toString: 'x', constructor: 'y' }, lang: 'de' });
  const both = rebase({ custom: { team: 'a' } }, { custom: { team: 'a', constructor: 'y', dept: 'z' } }, { custom: { team: 'b' } });
  assert.deepEqual(both.custom, { team: 'b', constructor: 'y', dept: 'z' });
  const current = JSON.parse('{"lang":"en","custom":{"__proto__":"keep me","team":"a"}}') as Rec;
  const out = rebase({ lang: 'en', custom: { team: 'a' } }, current, { lang: 'de', custom: { team: 'b' } });
  const custom = out.custom as Rec;
  assert.deepEqual(Object.keys(custom).sort(), ['__proto__', 'team']);
  assert.equal(Object.getOwnPropertyDescriptor(custom, '__proto__')?.value, 'keep me');
  assert.equal(Object.getPrototypeOf(custom), Object.prototype, 'the prototype is untouched');
});

test('S2: an item moved to two folders by two writers ends up in one, the writer\'s', () => {
  const base = { folders: [folder('F1', ['R']), folder('F2', []), folder('F3', [])] };
  const current = { folders: [folder('F1', [], { updatedAt: 'a' }), folder('F2', ['R'], { updatedAt: 'a' }), folder('F3', [])] };
  const next = { folders: [folder('F1', [], { updatedAt: 'b' }), folder('F2', []), folder('F3', ['R'], { updatedAt: 'b' })] };
  const out = rebase(base, current, next).folders as Rec[];
  assert.deepEqual(out.filter(f => (f.items as Rec[]).some(i => i.ref === 'R')).map(f => f.id), ['F3']);
});

test('S2: an item the other writer moved, which the writer left alone, stays where the other writer put it', () => {
  const base = { folders: [folder('F1', ['R', 'S']), folder('F2', [])] };
  const current = { folders: [folder('F1', ['S']), folder('F2', ['R'])] };
  // The writer renames F1 from its old copy, which still lists R in F1.
  const next = { folders: [folder('F1', ['R', 'S'], { name: 'Renamed' }), folder('F2', [])] };
  const out = rebase(base, current, next).folders as Rec[];
  assert.deepEqual(out.map(f => [f.id, f.name, (f.items as Rec[]).map(i => i.ref)]), [['F1', 'Renamed', ['S']], ['F2', 'F2', ['R']]]);
});

test('S2: a record the other writer moved to the Trash is never filed into a folder by a stale writer', () => {
  const entry = { kind: 'session', slot: '__trash__:@1:R', originalSlot: 'R', label: 'R', parentId: 'F1', deletedAt: 't1' };
  const base = { folders: [folder('F1', ['R']), folder('F2', [])], trash: [] as Rec[] };
  const current = { folders: [folder('F1', [], { updatedAt: 'a' }), folder('F2', [])], trash: [entry] };
  const next = { folders: [folder('F1', [], { updatedAt: 'b' }), folder('F2', ['R'], { updatedAt: 'b' })], trash: [] as Rec[] };
  const out = rebase(base, current, next);
  assert.deepEqual((out.folders as Rec[]).map(f => (f.items as Rec[]).map(i => i.ref)), [[], []]);
  assert.deepEqual(out.trash, [entry], 'the entry keeps its folder for the restore');
  // A new creation saved at the same slot and filed since is a different record, and stays filed.
  const refiled = { folders: [folder('F1', []), folder('F2', []), folder('F3', ['R'])], trash: [entry] };
  const later = rebase({ ...base, folders: [...base.folders, folder('F3', [])] }, refiled, { ...next, folders: [...next.folders, folder('F3', [])] });
  assert.deepEqual((later.folders as Rec[]).map(f => [f.id, (f.items as Rec[]).map(i => i.ref)]), [['F1', []], ['F2', []], ['F3', ['R']]]);
});

test('sameValue: NaN equals NaN, and two dates with the same time are equal', () => {
  assert.ok(sameValue(NaN, NaN));
  assert.ok(sameValue(new Date(0), new Date(0)));
  assert.ok(!sameValue(new Date(0), new Date(1)));
  const out = rebase({ when: new Date(0), x: 1 }, { when: new Date(5), x: 1 }, { when: new Date(0), x: 2 });
  assert.equal((out.when as Date).getTime(), 5, 'the other writer\'s date is kept when the writer left it alone');
});

test('the lists it combines include every list the import merge combines', () => {
  for (const key of UNION_LISTS) assert.ok(ID_LIST_FIELDS.includes(key), key);
  for (const key of RECORD_LISTS) assert.ok(RECORD_LIST_FIELDS.includes(key), key);
  assert.ok(MAP_FIELDS.includes('featureFlags'));
});

test('no argument is changed', () => {
  const base = { trash: [session('s1', 't1')], folders: [folder('f', ['a'])] };
  const current = { trash: [session('s2', 't2'), session('s1', 't1')], folders: [folder('f', [])] };
  const next = { trash: [session('s3', 't3'), session('s1', 't1')], folders: [folder('f', ['a', 'b'])] };
  const copies = structuredClone([base, current, next]);
  rebase(base, current, next);
  assert.deepEqual([base, current, next], copies);
});
