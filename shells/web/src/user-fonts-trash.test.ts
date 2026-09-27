// SPDX-License-Identifier: MPL-2.0
/**
 * Fonts in the Trash (plan 277 P3, decided 2026-09-27): deleting one of the
 * person's own fonts in the brand editor moves the family to the same Trash as
 * sessions and uploads, and a restore puts it back fully, faces and roles.
 *
 * Driven through the real user-fonts.ts and lib/trash.ts against a memory host
 * that behaves like the web bridge: a trashed face keeps its record, marked, and
 * the tokens resolve from the active design system's head. What is pinned:
 *
 *   - trashing marks every face, drops the family from the installed list and
 *     releases its roles (the primary passes on, the rest clear);
 *   - restore brings the faces back and sets every role it held as it was;
 *   - a restore writes the roles into the design system they were in, even when
 *     another one is active now, and writes none when that system is gone;
 *   - Delete forever removes every face; a face a saved design pins stays.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/user-fonts-trash.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryStateAPI } from './lib/ephemeral-state.ts';
import { createTrash, TrashPurgeError, type TrashHost } from './lib/trash.ts';
import {
  USER_FONT_PREFIX, fontTrashHooks, listUserFonts, setDisplayFont, setItalicFont, setMonoFont, setPrimaryFont, trashUserFont,
  type UserFontsHost,
} from './user-fonts.ts';

interface Rec { id: string; type: string; format?: string; blob?: Blob; meta?: Record<string, unknown>; trashedAt?: string }
interface SysRecord { id: string; label: string; ns: string; headId: string; source: { kind: string }; locked: boolean; createdAt: number; lastUsedAt: number }

function fontsHost(opts: { systems?: boolean; inUse?: Set<string> } = {}) {
  const store = new Map<string, Rec>();
  let profile: Record<string, unknown> = {};
  const systems = new Map<string, SysRecord>();
  let activeId = 'default';
  if (opts.systems) {
    for (const [id, headId] of [['default', 'user/tokens/brand'], ['other', 'user/ds/other/tokens/brand']] as const) {
      systems.set(id, { id, label: id, ns: '', headId, source: { kind: 'local' }, locked: false, createdAt: 0, lastUsedAt: 0 });
    }
  }
  const headOf = (): string => (opts.systems ? systems.get(activeId)?.headId : undefined) ?? 'user/tokens/brand';
  const readDoc = async (id: string): Promise<Record<string, any> | null> => {
    const blob = store.get(id)?.blob;
    return blob ? JSON.parse(await blob.text()) : null;
  };
  const host = {
    store,
    systems,
    setActive(id: string) { activeId = id; },
    profile: {
      async get() { return structuredClone(profile); },
      async set(next: object) { profile = structuredClone(next as Record<string, unknown>); },
    },
    state: createMemoryStateAPI(),
    assets: {
      async _uploadUserAsset(record: Rec) { store.set(record.id, { ...record }); },
      async _deleteUserAsset(id: string) {
        if (opts.inUse?.has(id)) throw new Error('This asset is used by a saved creation or retained history.');
        store.delete(id);
      },
      async _exportUserAssets() { return [...store.values()]; },
      async _getBlob(id: string) { return store.get(id)?.blob ?? null; },
      async _listUserAssets() { return [...store.values()].filter(r => !r.trashedAt).map(r => ({ id: r.id })); },
      async _setUserAssetTrashed(id: string, at: string | null, set: { expect?: string | null } = {}) {
        const r = store.get(id);
        if (!r) return false;
        if (set.expect !== undefined && (r.trashedAt ?? null) !== set.expect) return false;
        if (at) r.trashedAt = at; else delete r.trashedAt;
        return true;
      },
      async _deleteTrashedUserAsset(id: string, trashedAt: string) {
        const r = store.get(id);
        if (!r || r.trashedAt !== trashedAt) return false;
        if (opts.inUse?.has(id)) throw new Error('This asset is used by a saved creation or retained history.');
        store.delete(id);
        return true;
      },
      async _listTrashedUserAssets() {
        return [...store.values()].filter(r => r.trashedAt).map(r => ({
          id: r.id, type: r.type, name: String(r.meta?.name ?? r.id), ...(typeof r.meta?.family === 'string' ? { family: r.meta.family } : {}),
          trashedAt: r.trashedAt!, bytes: r.blob?.size ?? 0,
        }));
      },
    },
    tokens: {
      async resolve(ref: string) {
        const doc = await readDoc(headOf());
        const role = /^\{font\.(\w+)\}$/.exec(ref)?.[1];
        return role ? doc?.font?.[role]?.$value : undefined;
      },
      bust() { /* nothing memoised */ },
      ...(opts.systems ? { async activeRecord() { return systems.get(activeId) ?? null; } } : {}),
    },
    ...(opts.systems ? {
      designSystems: {
        async get(id: string) { return systems.get(id) ?? null; },
        async active() { return systems.get(activeId)!; },
        async activeId() { return activeId; },
        async put(r: SysRecord) { systems.set(r.id, r); },
        async setActive(id: string) { activeId = id; },
      },
    } : {}),
    readDoc,
  };
  return host;
}

const face = (family: string, n: number, weight = '400') => ({
  id: `${USER_FONT_PREFIX}${family.toLowerCase()}/${n}`, type: 'font', format: 'woff2',
  blob: new Blob([new Uint8Array(64)], { type: 'font/woff2' }), meta: { family, weight, style: 'normal', name: `${family} ${weight}` },
});

const asFonts = (h: ReturnType<typeof fontsHost>) => h as unknown as UserFontsHost;
const trashOf = (h: ReturnType<typeof fontsHost>) => createTrash(h as unknown as TrashHost, { fonts: fontTrashHooks(asFonts(h)) });

async function interAndSora(h: ReturnType<typeof fontsHost>) {
  await h.assets._uploadUserAsset(face('Inter', 0));
  await h.assets._uploadUserAsset(face('Inter', 1, '700'));
  await h.assets._uploadUserAsset(face('Sora', 0));
  await setPrimaryFont(asFonts(h), 'Inter');
  await setMonoFont(asFonts(h), 'Inter');
  await setDisplayFont(asFonts(h), 'Inter');
  await setItalicFont(asFonts(h), 'Sora');
  return (await listUserFonts(asFonts(h))).find(f => f.family === 'Inter')!;
}

test('a deleted font leaves the installed list, keeps its faces marked, and releases its roles', async () => {
  const h = fontsHost();
  const inter = await interAndSora(h);
  const entry = await trashUserFont(asFonts(h), inter, trashOf(h));
  assert.ok(entry);
  assert.equal(entry.kind, 'font');
  assert.deepEqual(entry.roles, ['brand', 'mono', 'display']);
  assert.equal(entry.designSystemId, null, 'no registry on this host');
  assert.deepEqual(entry.assetIds.sort(), ['user/fonts/inter/0', 'user/fonts/inter/1']);
  assert.ok(entry.assetIds.every(id => h.store.get(id)?.trashedAt), 'the faces stay stored, marked');
  assert.deepEqual((await listUserFonts(asFonts(h))).map(f => f.family), ['Sora']);
  const doc = await h.readDoc('user/tokens/brand');
  assert.deepEqual(doc?.font?.brand?.$value, ['Sora'], 'the primary passed to the next family');
  assert.equal(doc?.font?.mono, undefined);
  assert.equal(doc?.font?.display, undefined);
  assert.deepEqual(doc?.font?.italic?.$value, ['Sora'], 'a role another family serves is untouched');
  assert.equal((await trashOf(h).list()).length, 1);
});

test('restore brings the faces back and sets every role it held as it was', async () => {
  const h = fontsHost();
  const inter = await interAndSora(h);
  const entry = await trashUserFont(asFonts(h), inter, trashOf(h));
  await trashOf(h).restore(entry!);
  assert.ok(!h.store.get('user/fonts/inter/0')?.trashedAt && !h.store.get('user/fonts/inter/1')?.trashedAt);
  const families = await listUserFonts(asFonts(h));
  assert.deepEqual(families.map(f => f.family).sort(), ['Inter', 'Sora']);
  assert.equal(families.find(f => f.family === 'Inter')?.primary, true);
  const doc = await h.readDoc('user/tokens/brand');
  assert.deepEqual(doc?.font?.brand?.$value, ['Inter']);
  assert.deepEqual(doc?.font?.mono?.$value, ['Inter']);
  assert.deepEqual(doc?.font?.display?.$value, ['Inter']);
  assert.deepEqual(doc?.font?.italic?.$value, ['Sora']);
  assert.deepEqual(await trashOf(h).list(), []);
});

test('the roles go back into the design system they were in, even when another is active', async () => {
  const h = fontsHost({ systems: true });
  const inter = await interAndSora(h);
  const entry = await trashUserFont(asFonts(h), inter, trashOf(h));
  assert.equal(entry?.designSystemId, 'default');
  h.setActive('other');
  await trashOf(h).restore(entry!);
  const own = await h.readDoc('user/tokens/brand');
  assert.deepEqual(own?.font?.brand?.$value, ['Inter'], 'written into the system the roles came from');
  assert.deepEqual(own?.font?.mono?.$value, ['Inter']);
  assert.equal(await h.readDoc('user/ds/other/tokens/brand'), null, 'the active system is not touched');
});

test('when that design system is gone the faces come back without roles', async () => {
  const h = fontsHost({ systems: true });
  const inter = await interAndSora(h);
  const entry = await trashUserFont(asFonts(h), inter, trashOf(h));
  h.systems.delete('default');
  h.setActive('other');
  await trashOf(h).restore(entry!);
  assert.deepEqual((await listUserFonts(asFonts(h))).map(f => f.family).sort(), ['Inter', 'Sora']);
  assert.equal(await h.readDoc('user/ds/other/tokens/brand'), null, 'no role is written anywhere else');
});

test('Delete forever removes every face; a face a saved design pins stays in the Trash', async () => {
  const h = fontsHost();
  const inter = await interAndSora(h);
  const entry = await trashUserFont(asFonts(h), inter, trashOf(h));
  await trashOf(h).purge(entry!);
  assert.equal(h.store.has('user/fonts/inter/0') || h.store.has('user/fonts/inter/1'), false);
  assert.deepEqual(await trashOf(h).list(), []);

  const pinned = fontsHost({ inUse: new Set(['user/fonts/inter/1']) });
  const again = await trashUserFont(asFonts(pinned), await interAndSora(pinned), trashOf(pinned));
  await assert.rejects(trashOf(pinned).purge(again!), TrashPurgeError);
  const [left] = await trashOf(pinned).list();
  assert.equal(left?.kind, 'font');
  assert.deepEqual(left?.kind === 'font' ? left.assetIds : [], ['user/fonts/inter/1'], 'only the pinned face is left');
});

test('faces marked with no entry come back as one font entry per family', async () => {
  const h = fontsHost();
  await h.assets._uploadUserAsset(face('Inter', 0));
  await h.assets._uploadUserAsset(face('Inter', 1, '700'));
  await h.assets._setUserAssetTrashed('user/fonts/inter/0', '2026-09-27T00:00:00.000Z');
  await h.assets._setUserAssetTrashed('user/fonts/inter/1', '2026-09-27T00:00:00.000Z');
  const entries = await trashOf(h).list();
  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.kind, 'font');
  assert.deepEqual(entries[0]?.kind === 'font' ? entries[0].assetIds.sort() : [], ['user/fonts/inter/0', 'user/fonts/inter/1']);
});

test('B3: Delete forever on a stale row never deletes a font restored meanwhile', async () => {
  const h = fontsHost();
  const inter = await interAndSora(h);
  const row = await trashUserFont(asFonts(h), inter, trashOf(h));
  await trashOf(h).restore(row!);                  // the Undo toast, or another tab
  const outcome = await trashOf(h).purge(row!);    // the open dialog's stale row
  assert.ok(h.store.has('user/fonts/inter/0') && h.store.has('user/fonts/inter/1'), 'every face is still installed');
  assert.equal(outcome, 'gone');
  assert.deepEqual((await listUserFonts(asFonts(h))).map(f => f.family).sort(), ['Inter', 'Sora']);
});

test('S7: a role chosen after the delete is kept when the font comes back', async () => {
  const h = fontsHost();
  await h.assets._uploadUserAsset(face('Roboto', 0));
  const inter = await interAndSora(h);
  const entry = await trashUserFont(asFonts(h), inter, trashOf(h));
  assert.deepEqual(entry?.released, { brand: 'Roboto', mono: '', display: '' }, 'what the delete left in each role');
  // After the delete the person deliberately makes Sora primary and Roboto the heading face.
  await setPrimaryFont(asFonts(h), 'Sora');
  await setDisplayFont(asFonts(h), 'Roboto');
  await trashOf(h).restore(entry!);
  const doc = await h.readDoc('user/tokens/brand');
  assert.deepEqual(doc?.font?.brand?.$value, ['Sora'], 'the new primary stays');
  assert.deepEqual(doc?.font?.display?.$value, ['Roboto'], 'the new heading face stays');
  assert.deepEqual(doc?.font?.mono?.$value, ['Inter'], 'a role still empty since the delete comes back');
});
