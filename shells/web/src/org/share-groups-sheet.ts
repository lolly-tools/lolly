// SPDX-License-Identifier: MPL-2.0
/**
 * org/share-groups-sheet - make or edit a group of people to share with (lolly plan
 * 299 M1). Opened from the share section's "New group…" and "Edit group".
 *
 * A new group: a name and its people. An existing group: a new name, people added and
 * removed, and, for the owner, managers and deletion. People come from the
 * instance's suggestions (those the person already shares a project or group with) or
 * an exact address typed in full; the instance never returns an address, and nothing
 * here shows one.
 */
import type { ShareGroupDetail, ShareGroupSummary } from '@lolly-tools/core/sharing-v1';
import { SHARE_GROUP_NAME_MAX } from '@lolly-tools/core/sharing-v1';
import { announce } from '../a11y.ts';
import { confirmDialog } from '../components/confirm-dialog.ts';
import { mountModal } from '../components/modal.ts';
import { tRaw } from '../i18n.ts';
import {
  createShareGroup, deleteShareGroup, getShareGroup, suggestPeople, updateShareGroup, type PersonSuggestion,
} from './share-access.ts';

export interface ShareGroupSheetOptions {
  /** Edit this group; absent makes a new one. */
  groupId?: string;
  onSaved?: (group: ShareGroupSummary) => void;
  onDeleted?: () => void;
}

type El = HTMLElementTagNameMap;
function el<K extends keyof El>(tag: K, className?: string, text?: string): El[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function btn(label: string, className = 'btn btn--sm'): HTMLButtonElement {
  const b = el('button', className, label);
  b.type = 'button';
  return b;
}

let openSheet: HTMLDialogElement | undefined;

export function openShareGroupSheet(opts: ShareGroupSheetOptions = {}): void {
  if (openSheet?.isConnected) return;
  const editing = !!opts.groupId;
  const modal = mountModal('', { className: 'modal share-group-sheet', ariaLabel: editing ? tRaw('Edit group') : tRaw('New group'), onClose: () => { openSheet = undefined; } });
  openSheet = modal.el;

  const head = el('header', 'team-project-head');
  const title = el('h2', 'modal-title', editing ? tRaw('Edit group') : tRaw('New group'));
  const close = btn(tRaw('Close'));
  close.addEventListener('click', () => modal.close());
  head.append(title, close);

  const form = el('form', 'share-group-form');
  form.noValidate = true;
  const status = el('p', 'share-group-status');
  status.setAttribute('role', 'status');
  status.hidden = true;
  const say = (msg: string, error: boolean): void => {
    status.textContent = msg;
    status.classList.toggle('is-error', error);
    status.hidden = false;
    announce(msg, { assertive: error });
  };

  const nameId = `share-group-name-${Date.now()}`;
  const nameLabel = el('label', 'share-group-label', tRaw('Group name'));
  nameLabel.htmlFor = nameId;
  const name = el('input', 'field-input');
  name.id = nameId;
  name.maxLength = SHARE_GROUP_NAME_MAX;
  name.required = true;
  name.autocomplete = 'off';
  name.placeholder = tRaw('For example, Agency reviewers');

  // People: who is in, who is being added, who is being taken out.
  let detail: ShareGroupDetail | null = null;
  const adding = new Map<string, PersonSuggestion>();
  /** Someone found by typing their full address is sent by that address: the
   *  instance accepts an id only for people the person already works with. */
  const typed = new Map<string, string>();
  const removing = new Set<string>();
  const managers = new Set<string>();
  const peopleHead = el('h3', 'share-group-subhead', tRaw('People'));
  const list = el('ul', 'share-group-people');
  const findId = `${nameId}-find`;
  const findLabel = el('label', 'share-group-label', tRaw('Add people'));
  findLabel.htmlFor = findId;
  const find = el('input', 'field-input');
  find.id = findId;
  find.type = 'search';
  find.autocomplete = 'off';
  find.placeholder = tRaw('Name, or a full email address');
  const results = el('ul', 'share-group-results');
  results.setAttribute('aria-label', tRaw('People to add'));

  const isOwner = (): boolean => detail?.myRole === 'owner';
  function drawPeople(): void {
    list.replaceChildren();
    const rows: Array<{ id: string; name: string; role: string; fresh: boolean }> = [
      ...(detail?.members ?? []).filter((m) => !removing.has(m.id)).map((m) => ({ id: m.id, name: m.name, role: m.role, fresh: false })),
      ...[...adding.values()].map((p) => ({ id: p.id, name: p.name, role: 'member', fresh: true })),
    ];
    if (!rows.length) list.append(el('li', 'share-group-empty', editing ? tRaw('Nobody else is in this group.') : tRaw('Add the people this group is for. You are in it too.')));
    for (const row of rows) {
      const li = el('li', 'share-access-row');
      const who = el('div', 'share-access-who');
      who.append(el('div', 'share-access-name', row.name));
      const note = row.role === 'owner' ? tRaw('Owner') : row.fresh ? tRaw('Will be added') : '';
      if (note) who.append(el('div', 'share-access-muted', note));
      const controls = el('div', 'share-access-controls');
      if (row.role !== 'owner' && isOwner() && !row.fresh) {
        const id = `${findId}-mgr-${row.id}`;
        const box = el('input');
        box.type = 'checkbox';
        box.id = id;
        box.checked = managers.has(row.id);
        box.addEventListener('change', () => { if (box.checked) managers.add(row.id); else managers.delete(row.id); });
        const label = el('label', 'share-group-check', tRaw('Manager'));
        label.htmlFor = id;
        controls.append(box, label);
      }
      if (row.role !== 'owner') {
        const remove = btn(tRaw('Remove'), 'btn btn--sm btn--ghost');
        remove.setAttribute('aria-label', tRaw('Remove {name}', { name: row.name }));
        remove.addEventListener('click', () => {
          if (row.fresh) adding.delete(row.id); else removing.add(row.id);
          drawPeople();
          find.focus();
        });
        controls.append(remove);
      }
      li.append(who, controls);
      list.append(li);
    }
  }

  let searchSeq = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const search = (): void => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const q = find.value.trim();
      const mine = ++searchSeq;
      const got = await suggestPeople(q);
      if (mine !== searchSeq || !modal.el.isConnected) return;
      results.replaceChildren();
      if (!got.ok) { results.append(el('li', 'share-group-empty', tRaw('Could not load suggestions.'))); return; }
      const inGroup = new Set([...(detail?.members ?? []).filter((m) => !removing.has(m.id)).map((m) => m.id), ...adding.keys()]);
      const offer = got.data.filter((p) => !inGroup.has(p.id));
      if (!offer.length) {
        results.append(el('li', 'share-group-empty', q.includes('@') ? tRaw('No member of this workspace has that address.') : tRaw('Nobody matches. Try a full email address.')));
        return;
      }
      for (const p of offer.slice(0, 8)) {
        if (q.includes('@')) typed.set(p.id, q);
        const li = el('li');
        const add = btn(tRaw('Add {name}', { name: p.name }), 'btn btn--sm btn--ghost share-group-add');
        add.addEventListener('click', () => {
          removing.delete(p.id);
          if (!detail?.members.some((m) => m.id === p.id)) adding.set(p.id, p);
          drawPeople();
          find.value = '';
          results.replaceChildren();
          find.focus();
          announce(tRaw('{name} will be added.', { name: p.name }));
        });
        li.append(add);
        results.append(li);
      }
    }, 200);
  };
  find.addEventListener('input', search);
  find.addEventListener('focus', () => { if (!find.value) search(); });

  const actions = el('div', 'share-group-actions');
  const save = btn(editing ? tRaw('Save changes') : tRaw('Create group'), 'btn btn--sm btn--primary');
  save.type = 'submit';
  actions.append(save);
  if (editing) {
    const del = btn(tRaw('Delete group'), 'btn btn--sm btn--ghost share-group-delete');
    del.hidden = true;
    del.addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: tRaw('Delete {name}?', { name: detail?.name ?? '' }),
        message: tRaw('Projects shared with this group stop being shared with its people. Nobody loses access they have in their own right.'),
        confirmLabel: tRaw('Delete group'), danger: true,
      });
      if (!ok || !opts.groupId) return;
      const got = await deleteShareGroup(opts.groupId);
      if (!got.ok) { say(tRaw('Could not delete the group. Try again.'), true); return; }
      announce(tRaw('Group deleted.'));
      opts.onDeleted?.();
      modal.close();
    });
    actions.append(del);
    (async () => {
      const got = await getShareGroup(opts.groupId!);
      if (!modal.el.isConnected) return;
      if (!got.ok) { say(tRaw('This group is no longer available.'), true); save.disabled = true; return; }
      detail = got.data;
      name.value = detail.name;
      for (const m of detail.members) if (m.role === 'manager') managers.add(m.id);
      del.hidden = detail.myRole !== 'owner';
      drawPeople();
    })();
  } else drawPeople();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const label = name.value.trim();
    if (!label) { say(tRaw('Give the group a name.'), true); name.focus(); return; }
    save.disabled = true;
    const add = [...adding.keys()].map((id) => typed.get(id) ?? id);
    const got = editing && opts.groupId
      ? await updateShareGroup(opts.groupId, {
        ...(label !== detail?.name ? { name: label } : {}),
        ...(add.length ? { add } : {}),
        ...(removing.size ? { remove: [...removing] } : {}),
        ...(isOwner() ? { managers: [...managers].filter((m) => !removing.has(m)) } : {}),
      })
      : await createShareGroup({ name: label, ...(add.length ? { add } : {}) });
    save.disabled = false;
    if (!got.ok) {
      say(got.code === 'GROUP_LIMIT' ? tRaw('You have reached the number of groups you can own.')
        : got.code === 'PERSON_NOT_FOUND' ? tRaw('Someone you added is no longer available. Remove them and try again.')
        : got.code === 'GROUPS_OFF' ? tRaw('This workspace does not allow making groups.')
        : tRaw('Could not save the group. Try again.'), true);
      return;
    }
    if (got.data) {
      const g = got.data;
      opts.onSaved?.({ id: g.id, name: g.name, memberCount: g.memberCount, myRole: g.myRole, ...(g.description ? { description: g.description } : {}) });
    }
    announce(editing ? tRaw('Group saved.') : tRaw('Group created.'));
    modal.close();
  });

  form.append(nameLabel, name, peopleHead, list, findLabel, find, results, status, actions);
  modal.el.append(head, form);
  name.focus();
}
