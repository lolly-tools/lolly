// SPDX-License-Identifier: MPL-2.0
/**
 * org/team-files-panel.ts - a team project's "Shared files" screen, mounted in jsdom
 * against a stubbed instance: the list with its limits line, the empty state, upload
 * offered only to people who can save, Delete only for the uploader or a manager,
 * the sentence for each refusal, a file in use (its sessions, and "Delete anyway"
 * for a manager only), a download through the host's own save, and Cancel deleting
 * the unfinished upload. Also the Team section's sentence for a save that failed on
 * a file (org/team-save.ts teamSaveFailure).
 *   node --import ./tests/css-stub.mjs --test shells/web/src/org/team-files-panel.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { HostV1 } from '@lolly-tools/core/host-v1';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://instance.test/#/p', pretendToBeVisual: true });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.location = dom.window.location as unknown as Location;
globalThis.Element = dom.window.Element as unknown as typeof Element;
globalThis.HTMLElement = dom.window.HTMLElement as unknown as typeof HTMLElement;
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => { setTimeout(() => cb(0), 0); return 0; }) as unknown as typeof requestAnimationFrame;

type Handler = (url: string, method: string, init?: RequestInit) => Response | Promise<Response>;
let router: Handler = () => new Response('', { status: 404 });
const calls: Array<{ url: string; method: string }> = [];
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const method = (init?.method ?? 'GET').toUpperCase();
  calls.push({ url: String(input), method });
  return router(String(input), method, init);
}) as typeof fetch;
const json = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const refuse = (status: number, code: string, extra: Record<string, unknown> = {}): Response => json({ error: { code, message: code, ...extra } }, status);

const { buildTeamFilesPanel } = await import('./team-files-panel.ts');
const { PART_RETRY_DELAYS_MS } = await import('./team-files.ts');
const { teamSaveFailure } = await import('./team-save.ts');
const { setHostRef } = await import('../lib/host-ref.ts');
PART_RETRY_DELAYS_MS.splice(0, PART_RETRY_DELAYS_MS.length, 0, 0, 0);

const MiB = 1024 * 1024;
const LIMITS = { partBytes: MiB, maxBytes: 25 * MiB, projectBudgetBytes: 128 * MiB, projectUsedBytes: 3 * MiB, instanceRemainingBytes: 200 * MiB };
const fid = (c: string): string => `fil_${c.repeat(22)}`;
const file = (c: string, name: string, createdBy: string, size = 2 * MiB) => ({
  id: fid(c), projectId: 'p1', name, size, checksum: c.repeat(64).slice(0, 64).replace(/[^a-f0-9]/g, 'a'), contentType: 'image/png',
  ready: true, asset: {}, createdAt: '2026-10-03T10:00:00Z', createdBy, createdByName: createdBy === 'u1' ? 'Ana' : 'Bo',
});
const FILES = [file('a', 'poster.png', 'u1'), file('b', 'logo.svg', 'u2', 1024)];

async function until(check: () => boolean, what: string): Promise<void> {
  for (let i = 0; i < 400; i++) { if (check()) return; await new Promise((r) => setTimeout(r, 5)); }
  assert.fail(`timed out waiting for ${what}`);
}
const reset = (): void => { calls.length = 0; router = () => new Response('', { status: 404 }); document.body.replaceChildren(); };
const mount = (opts: { canUpload?: boolean; canManage?: boolean; fileId?: string } = {}): HTMLElement => {
  const panel = buildTeamFilesPanel({ projectId: 'p1', fileId: opts.fileId, canUpload: opts.canUpload ?? true, canManage: opts.canManage ?? false, onBack: () => {} });
  document.body.append(panel);
  return panel;
};
const statusOf = (panel: HTMLElement): string => panel.querySelector('[role="status"]')?.textContent ?? '';
const rows = (panel: HTMLElement): HTMLElement[] => [...panel.querySelectorAll<HTMLElement>('li[data-team-file]')];
const listed = (files: unknown[] = FILES, limits = LIMITS): Handler => (url, method) =>
  (url.endsWith('/files') && method === 'GET' ? json({ files, limits }) : url.endsWith('/members') ? json({ myRole: 'editor', members: [{ userId: 'u2', name: 'Bo', role: 'editor', isMe: true }] }) : new Response('', { status: 404 }));
/** Choose files in the hidden picker, as the person would. */
function pick(panel: HTMLElement, files: File[]): void {
  const input = panel.querySelector<HTMLInputElement>('input[type="file"]')!;
  Object.defineProperty(input, 'files', { value: files, configurable: true });
  input.dispatchEvent(new dom.window.Event('change'));
}

test('the list shows each file, who added it, and the project\'s limits', async () => {
  reset();
  router = listed();
  const panel = mount();
  await until(() => rows(panel).length === 2, 'rows');
  assert.deepEqual(rows(panel).map((r) => r.querySelector('span')?.textContent), ['poster.png', 'logo.svg'], 'in the instance\'s order, newest first');
  assert.match(rows(panel)[0]!.textContent ?? '', /2\.0 MB · Ana/);
  assert.equal(rows(panel)[0]!.querySelector('[data-act="file-download"]')?.getAttribute('aria-label'), 'Download poster.png');
  assert.match(panel.textContent ?? '', /Each file can be up to 25 MB\. This project uses 3\.0 MB of 128 MB\./);
  assert.equal(statusOf(panel), '');
});

test('an empty project says so, and upload is offered only to people who can save', async () => {
  reset();
  router = listed([]);
  const panel = mount({ canUpload: false });
  await until(() => /no shared files yet/.test(panel.textContent ?? ''), 'empty state');
  assert.equal(panel.querySelector('[data-act="files-upload"]'), null);
  assert.equal(panel.querySelector('input[type="file"]'), null);
  reset();
  router = listed([]);
  const writer = mount({ canUpload: true });
  await until(() => /no shared files yet/.test(writer.textContent ?? ''), 'empty state');
  assert.ok(writer.querySelector('[data-act="files-upload"]'));
  assert.equal(writer.querySelector<HTMLButtonElement>('[data-act="files-cancel"]')?.hidden, true, 'Cancel shows only while uploading');
});

test('a viewer can copy an individual file link without changing project access', async () => {
  reset(); router = listed();
  const copied: string[] = [];
  const previous = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text: string) => { copied.push(text); } } });
  try {
    const panel = mount({ canUpload: false });
    await until(() => rows(panel).length === 2, 'rows');
    assert.match(panel.textContent ?? '', /Sharing a link does not give someone access/);
    const copy = rows(panel)[0]!.querySelector<HTMLButtonElement>('[data-act="file-copy-link"]')!;
    assert.equal(copy.getAttribute('aria-label'), 'Copy link to poster.png');
    copy.click();
    await until(() => statusOf(panel) === 'Link copied', 'copied');
    assert.deepEqual(copied, [`https://instance.test/#/team/project/p1?file=${fid('a')}`]);
    assert.equal(calls.some(call => call.method !== 'GET'), false, 'a file link grants no permissions');
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('denied'); } } });
    copy.click();
    await until(() => statusOf(panel) === 'Could not copy. Try again.', 'copy refusal');
  } finally {
    if (previous) Object.defineProperty(navigator, 'clipboard', previous);
    else Reflect.deleteProperty(navigator, 'clipboard');
  }
});

test('a file link selects the intended file, while a deleted file says it is unavailable', async () => {
  reset(); router = listed();
  const panel = mount({ canUpload: false, fileId: fid('b') });
  await until(() => rows(panel).length === 2, 'rows');
  const selected = panel.querySelector<HTMLElement>('[aria-current="true"]');
  assert.equal(selected?.dataset.teamFile, fid('b'));
  assert.equal(document.activeElement, selected);
  assert.equal(calls.some(call => call.url.endsWith(`/${fid('b')}`)), false, 'opening a link does not start a download');
  reset(); router = listed();
  const missing = mount({ canUpload: false, fileId: fid('z') });
  await until(() => statusOf(missing) === 'That file is no longer available.', 'deleted file');
  assert.equal(missing.querySelector('[aria-current]'), null);
});

test('Delete is offered to a manager on every file, and otherwise only on your own', async () => {
  reset();
  router = listed();
  const manager = mount({ canManage: true });
  await until(() => rows(manager).length === 2, 'rows');
  assert.equal(manager.querySelectorAll('[data-act="file-delete"]').length, 2);
  assert.equal(calls.some((c) => c.url.endsWith('/members')), false, 'a manager needs no lookup');
  reset();
  router = listed();
  const editor = mount();
  await until(() => rows(editor).length === 2, 'rows');
  assert.deepEqual(rows(editor).map((r) => !!r.querySelector('[data-act="file-delete"]')), [false, true], 'only logo.svg is theirs (isMe: u2)');
  assert.equal(editor.querySelector('[data-act="file-delete"]')?.getAttribute('aria-label'), 'Delete logo.svg');
  reset();
  router = (url, method) => (url.endsWith('/members') ? refuse(403, 'FORBIDDEN') : listed()(url, method));
  const stranger = mount();
  await until(() => rows(stranger).length === 2, 'rows');
  assert.equal(stranger.querySelectorAll('[data-act="file-delete"]').length, 0, 'unknown identity: no Delete');
});

test('a file in use lists its sessions; only a manager may delete it anyway', async () => {
  reset();
  let forced = false;
  router = (url, method) => {
    if (method === 'DELETE') {
      if (url.endsWith('?force=1')) { forced = true; return new Response(null, { status: 204 }); }
      return refuse(409, 'FILE_IN_USE', { sessions: [{ id: 's1', title: 'Spring poster' }, { id: 's2', title: 'Flyer' }] });
    }
    return listed(forced ? [FILES[1]] : FILES)(url, method);
  };
  const manager = mount({ canManage: true });
  await until(() => rows(manager).length === 2, 'rows');
  rows(manager)[0]!.querySelector<HTMLButtonElement>('[data-act="file-delete"]')!.click();
  await until(() => !!manager.querySelector('[data-file-in-use]'), 'in-use box');
  const box = manager.querySelector<HTMLElement>('[data-file-in-use]')!;
  assert.deepEqual([...box.querySelectorAll('li')].map((li) => li.textContent), ['Spring poster', 'Flyer']);
  assert.match(box.textContent ?? '', /These sessions use “poster\.png”:/);
  assert.match(box.textContent ?? '', /those sessions cannot be opened/);
  const force = box.querySelector<HTMLButtonElement>('[data-act="file-delete-force"]')!;
  assert.equal(force.getAttribute('aria-label'), 'Delete poster.png anyway');
  assert.equal(document.activeElement, force, 'focus moves to the choice');
  force.click();
  await until(() => rows(manager).length === 1, 'deleted');
  assert.ok(calls.some((c) => c.method === 'DELETE' && c.url.endsWith(`/files/${fid('a')}?force=1`)));
  assert.equal(statusOf(manager), 'Deleted “poster.png”.');

  reset();
  forced = false;
  router = (url, method) => (method === 'DELETE'
    ? refuse(409, 'FILE_IN_USE', { sessions: [{ id: 's1', title: 'Spring poster' }] })
    : listed()(url, method));
  const uploader = mount();
  await until(() => rows(uploader).length === 2, 'rows');
  rows(uploader)[1]!.querySelector<HTMLButtonElement>('[data-act="file-delete"]')!.click();
  await until(() => !!uploader.querySelector('[data-file-in-use]'), 'in-use box');
  assert.equal(uploader.querySelector('[data-act="file-delete-force"]'), null);
  assert.match(uploader.textContent ?? '', /Only a project manager can delete a file that a session uses\./);
  uploader.querySelector<HTMLButtonElement>('[data-act="file-keep"]')!.click();
  assert.equal(uploader.querySelector('[data-file-in-use]'), null);
});

test('a refused delete and a failed download each get their own sentence', async () => {
  reset();
  router = (url, method) => (method === 'DELETE' ? refuse(403, 'FORBIDDEN') : url.endsWith(`/${fid('a')}`) ? refuse(404, 'NOT_FOUND') : listed()(url, method));
  const panel = mount({ canManage: true });
  await until(() => rows(panel).length === 2, 'rows');
  rows(panel)[1]!.querySelector<HTMLButtonElement>('[data-act="file-delete"]')!.click();
  await until(() => /delete files you uploaded/.test(statusOf(panel)), 'refusal');
  rows(panel)[0]!.querySelector<HTMLButtonElement>('[data-act="file-download"]')!.click();
  await until(() => statusOf(panel) === 'That file is no longer available.', 'download refusal');
});

test('a download is handed to the host\'s own save', async () => {
  reset();
  const bytes = new Uint8Array([1, 2, 3]);
  const sum = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (n) => n.toString(16).padStart(2, '0')).join('');
  const one = { ...file('c', 'notes.txt', 'u1', 3), checksum: sum, contentType: 'text/plain' };
  const saved: string[] = [];
  setHostRef({ export: { download: async (_blob: Blob, name: string) => { saved.push(name); } } } as unknown as HostV1);
  router = (url, method) => (url.endsWith(`/${one.id}`) ? new Response(bytes, { headers: { 'content-length': '3' } }) : listed([one])(url, method));
  const panel = mount();
  await until(() => rows(panel).length === 1, 'rows');
  rows(panel)[0]!.querySelector<HTMLButtonElement>('[data-act="file-download"]')!.click();
  await until(() => saved.length === 1, 'saved');
  assert.deepEqual(saved, ['notes.txt']);
});

test('each upload refusal shows its own sentence, and the unfinished file is deleted', async () => {
  const cases: Array<[string, Handler, RegExp]> = [
    ['project budget', (url, method) => (method === 'POST' ? refuse(413, 'PROJECT_FILE_BUDGET') : listed([])(url, method)), /no room left for files in this project/],
    ['instance budget', (url, method) => (method === 'POST' ? refuse(413, 'INSTANCE_FILE_BUDGET') : listed([])(url, method)), /no room left for files on this instance/],
    ['pending', (url, method) => (method === 'POST' ? refuse(413, 'PROJECT_FILE_PENDING') : listed([])(url, method)), /too many unfinished uploads/],
    ['too large', listed([], { ...LIMITS, maxBytes: 4 }), /^A file is too large to share\. Each file can be up to 4 B\.$/],
    ['expired', (url, method) => {
      if (method === 'POST' && url.endsWith('/files')) return json({ file: { ...file('d', 'a.bin', 'u2', 8), ready: false } }, 201);
      if (method === 'PUT') return refuse(410, 'UPLOAD_EXPIRED');
      if (method === 'DELETE') return new Response(null, { status: 204 });
      return listed([])(url, method);
    }, /^The upload was interrupted\. Try again\.$/],
  ];
  for (const [what, handler, sentence] of cases) {
    reset();
    router = handler;
    const panel = mount();
    await until(() => /no shared files yet/.test(panel.textContent ?? ''), 'empty');
    pick(panel, [new File([new Uint8Array(8).fill(3)], 'a.bin')]);
    await until(() => sentence.test(statusOf(panel)), `${what}: ${statusOf(panel)}`);
    assert.equal(panel.querySelector<HTMLButtonElement>('[data-act="files-upload"]')?.disabled, false, `${what}: upload is offered again`);
    if (what === 'expired') assert.ok(calls.some((c) => c.method === 'DELETE' && c.url.endsWith(`/files/${fid('d')}`)), 'the reservation is given back');
  }
});

test('Cancel stops an upload and deletes its reservation; progress is shown meanwhile', async () => {
  reset();
  let deleted = false;
  router = (url, method, init) => {
    if (method === 'POST' && url.endsWith('/files')) return json({ file: { ...file('e', 'big.bin', 'u2', 2 * MiB + 1), ready: false } }, 201);
    if (method === 'PUT' && url.endsWith('/parts/0')) return new Response(null, { status: 204 });
    if (method === 'PUT') {
      return new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))));
    }
    if (method === 'DELETE') { deleted = true; return new Response(null, { status: 204 }); }
    return listed([])(url, method);
  };
  const panel = mount();
  await until(() => /no shared files yet/.test(panel.textContent ?? ''), 'empty');
  pick(panel, [new File([new Uint8Array(2 * MiB + 1).fill(9)], 'big.bin')]);
  const cancel = panel.querySelector<HTMLButtonElement>('[data-act="files-cancel"]')!;
  await until(() => statusOf(panel) === 'Uploading big.bin… 49%', `progress: ${statusOf(panel)}`);
  assert.equal(cancel.hidden, false);
  assert.equal(panel.querySelector<HTMLButtonElement>('[data-act="files-upload"]')?.disabled, true);
  cancel.click();
  await until(() => statusOf(panel) === 'Upload cancelled.', `cancelled: ${statusOf(panel)}`);
  assert.equal(deleted, true, 'the unfinished file is deleted');
  assert.ok(calls.some((c) => c.method === 'DELETE' && c.url.endsWith(`/files/${fid('e')}`)));
  assert.equal(cancel.hidden, true);
});

test('a save that failed on a file says why in its own words', () => {
  assert.equal(teamSaveFailure({ kind: 'file-error', message: 'The upload was interrupted. Try again.', code: 'UPLOAD_EXPIRED' }), 'The upload was interrupted. Try again.');
  assert.match(teamSaveFailure({ kind: 'error', status: 413 }), /This document is too large/);
});

test('Rename changes only the name, and an instance without the route turns it off with a reason', async () => {
  reset();
  const { resetTeamFileRenameForTest } = await import('./team-folders.ts');
  resetTeamFileRenameForTest();
  dom.window.HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.open = true; };
  dom.window.HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.open = false; this.dispatchEvent(new dom.window.Event('close')); };
  Reflect.set(globalThis, 'HTMLDialogElement', dom.window.HTMLDialogElement);
  const answer = (name: string): void => {
    const input = document.querySelector<HTMLInputElement>('dialog .modal-input')!;
    input.value = name;
    document.querySelector<HTMLButtonElement>('dialog [data-act="ok"]')!.click();
  };
  const renamed: unknown[] = [];
  let routed = true;
  router = (url, method, init) => {
    if (method === 'PATCH') {
      if (!routed) return refuse(404, 'NOT_FOUND', { message: `no route for PATCH ${url}` });
      renamed.push([url, JSON.parse(String(init?.body))]);
      return json({ name: 'final logo.svg' });
    }
    return listed()(url, method);
  };
  const viewer = mount({ canUpload: false });
  await until(() => rows(viewer).length === 2, 'rows');
  assert.equal(viewer.querySelector('[data-act="file-rename"]'), null, 'Rename needs edit access');
  const panel = buildTeamFilesPanel({ projectId: 'p1', canUpload: true, canRename: true, onBack: () => {} });
  document.body.append(panel);
  await until(() => rows(panel).length === 2, 'rows');
  rows(panel)[1]!.querySelector<HTMLButtonElement>('[data-act="file-rename"]')!.click();
  answer('final logo.svg');
  await until(() => statusOf(panel) === 'Saved.', `renamed: ${statusOf(panel)}`);
  assert.deepEqual(renamed, [[`/api/v1/projects/p1/files/${fid('b')}`, { name: 'final logo.svg' }]]);
  routed = false;
  rows(panel)[0]!.querySelector<HTMLButtonElement>('[data-act="file-rename"]')!.click();
  answer('poster final.png');
  await until(() => /cannot rename shared files yet/.test(statusOf(panel)), `old instance: ${statusOf(panel)}`);
  assert.ok([...panel.querySelectorAll<HTMLButtonElement>('[data-act="file-rename"]')].every(b => b.disabled));
  assert.equal(panel.querySelector<HTMLElement>('[id^="team-files-rename-"]')?.hidden, false);
  resetTeamFileRenameForTest();
});
