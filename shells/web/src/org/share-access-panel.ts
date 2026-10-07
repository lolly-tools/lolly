// SPDX-License-Identifier: MPL-2.0
/**
 * org/share-access-panel - "Groups with access" and "General access" under a team
 * project's people list, plus an end date on each member's row (lolly plan 299 M1).
 *
 * Mounted by org/team-people.ts, which keeps the people list and the invite form;
 * this module adds what the sharing routes carry (org/share-access.ts):
 *  - groups with their own role and end date: directory groups the person may share
 *    with, and groups members make themselves ("New group…", org/share-groups-sheet.ts);
 *  - general access: only the people and groups listed, or everyone signed in to the
 *    instance at Viewer or Commenter (Editor when the instance allows it);
 *  - a member's end date: No end date, a day, a week, 30 days or a chosen day.
 *
 * Managers change these; everyone else reads them. Every change is sent at once and
 * the section is drawn again from the instance's answer, so what shows is what the
 * instance holds. An instance without the sharing routes answers 404 and the section
 * stays hidden, so an older instance looks exactly as before.
 */
import {
  EXPIRY_PRESET_DAYS, grantLive, principalKey, rolesForAudience,
  type ShareGrant, type ShareGroupSummary, type ShareRole, type ShareState,
} from '@lolly-tools/core/sharing-v1';
import { announce } from '../a11y.ts';
import { tRaw } from '../i18n.ts';
import { iconNode } from '../lib/icon-node.ts';
import type { TeamRole } from '../lib/session-source.ts';
import {
  getShareState, listShareGroups, putShareState, setMemberExpiry, type GrantWrite, type SharePatch,
} from './share-access.ts';
import { dayLabel, roleLabel } from './team-access.ts';

export interface ShareAccessOptions {
  projectId: string;
  /** The people panel's status line. */
  say: (message: string, error: boolean) => void;
  /** What the workspace is called, which directory groups this person may share with,
   *  and whether they may make groups (org/team-access.ts invitePolicy carries all three). */
  context: () => ShareContext;
}

export interface ShareContext { workspace: string; directoryGroups: string[]; canCreateGroups: boolean }

export interface ShareAccessHandle {
  /** Placed under the people list; hidden until the instance answers. */
  section: HTMLElement;
  /** Add the end-date control (managers) or note (everyone else) to a member row. */
  decorateMember(controls: HTMLElement, member: { userId: string; name: string; role: TeamRole }, manage: boolean): void;
}

type El = HTMLElementTagNameMap;
function el<K extends keyof El>(tag: K, className?: string, text?: string): El[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function withIcon(name: Parameters<typeof iconNode>[0], className: string): HTMLElement {
  const box = el('span', className);
  box.setAttribute('aria-hidden', 'true');
  const glyph = iconNode(name);
  if (glyph) box.append(glyph);
  return box;
}

function select(label: string, className = 'field-select field-select--sm field-select--auto'): HTMLSelectElement {
  const s = el('select', className);
  s.setAttribute('aria-label', label);
  return s;
}

function option(value: string, text: string): HTMLOptionElement {
  const o = el('option', undefined, text);
  o.value = value;
  return o;
}

/** "Until 14 Oct" or "Ended 2 Oct". Plain text. */
export function endDateText(expiresAt: string, now: number = Date.now()): string {
  return grantLive(expiresAt, now) ? tRaw('Until {date}', { date: dayLabel(expiresAt) }) : tRaw('Ended {date}', { date: dayLabel(expiresAt) });
}

/** The end of the chosen local day, as an ISO time. Pure. */
export function endOfDay(day: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return null;
  const at = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 0);
  return Number.isFinite(at.getTime()) ? at.toISOString() : null;
}

const isoDay = (t: number): string => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * An end-date select: No end date, the presets within `maxDays`, the current date when
 * one is set, and "Pick a date…", which shows a date field. `commit` sends the choice;
 * a refused one puts the select back.
 */
function endDateControl(o: {
  label: string; current?: string; maxDays?: number; commit: (expiresAt: string | null) => Promise<boolean>;
}): HTMLElement {
  const wrap = el('span', 'share-access-ends');
  const s = select(o.label);
  s.append(option('none', tRaw('No end date')));
  if (o.current) s.append(option('current', endDateText(o.current)));
  for (const days of EXPIRY_PRESET_DAYS) {
    if (o.maxDays && days > o.maxDays) continue;
    s.append(option(String(days), days === 1 ? tRaw('For 1 day') : days === 7 ? tRaw('For 1 week') : tRaw('For {count} days', { count: days })));
  }
  s.append(option('pick', tRaw('Pick a date…')));
  const initial = o.current ? 'current' : 'none';
  s.value = initial;
  const day = el('input', 'field-input field-input--sm share-access-day');
  day.type = 'date';
  day.hidden = true;
  day.setAttribute('aria-label', tRaw('End date'));
  const tomorrow = Date.now() + 86_400_000;
  day.min = isoDay(tomorrow);
  if (o.maxDays) day.max = isoDay(Date.now() + o.maxDays * 86_400_000);
  let busy = false;
  const send = async (expiresAt: string | null): Promise<void> => {
    if (busy) return;
    busy = true;
    wrap.setAttribute('aria-busy', 'true');
    const ok = await o.commit(expiresAt);
    busy = false;
    wrap.removeAttribute('aria-busy');
    if (!ok) { s.value = initial; day.hidden = true; }
  };
  s.addEventListener('change', () => {
    if (s.value === 'pick') { day.hidden = false; day.focus(); return; }
    day.hidden = true;
    if (s.value === 'current') return;
    if (s.value === 'none') { void send(null); return; }
    void send(new Date(Date.now() + Number(s.value) * 86_400_000).toISOString());
  });
  day.addEventListener('change', () => {
    const at = endOfDay(day.value);
    if (at) void send(at);
  });
  wrap.append(s, day);
  return wrap;
}

/** What a refused change says, from the instance's code. Plain text. */
function refusal(status: number, code?: string): string {
  if (status === 0) return tRaw('Could not reach the workspace. Try again.');
  if (code === 'ROLE_NOT_ALLOWED') return tRaw('This workspace does not allow that role here.');
  if (code === 'AUDIENCE_NOT_ALLOWED') return tRaw('This workspace does not allow sharing with everyone.');
  if (code === 'PROJECT_ARCHIVED') return tRaw('Restore the project before changing who has access.');
  if (status === 403) return tRaw('You cannot change who has access to this project.');
  if (status === 404) return tRaw('That group is no longer available.');
  return tRaw('Could not save that change. Try again.');
}

export function shareAccessFor(opts: ShareAccessOptions): ShareAccessHandle {
  const context = opts.context;
  const section = el('section', 'share-access');
  section.hidden = true;
  let state: ShareState | null = null;
  let myGroups: ShareGroupSummary[] = [];
  const rows = new Map<string, { controls: HTMLElement; member: { userId: string; name: string; role: TeamRole }; manage: boolean; slot: HTMLElement }>();
  let saving = Promise.resolve();

  const grantsOf = (s: ShareState): GrantWrite[] => s.grants.map((g) => ({
    principal: g.principal.kind === 'group' ? { kind: 'group', name: g.principal.name } : { kind: 'custom-group', id: (g.principal as { id: string }).id },
    role: g.role, ...(g.expiresAt ? { expiresAt: g.expiresAt } : {}),
  }));

  /** Send one change, one at a time, and draw again from the answer. */
  const change = (patch: SharePatch, done: string): Promise<boolean> => {
    const run = saving.then(async () => {
      const got = await putShareState(opts.projectId, patch);
      if (!got.ok) { opts.say(refusal(got.status, got.code), true); return false; }
      state = got.data;
      render();
      opts.say(done, false);
      return true;
    });
    saving = run.then(() => undefined);
    return run;
  };

  function groupRow(g: ShareGrant, index: number, s: ShareState): HTMLLIElement {
    const li = el('li', 'share-access-row');
    li.append(withIcon('users', 'share-access-icon'));
    const who = el('div', 'share-access-who');
    const name = g.principal.name;
    who.append(el('div', 'share-access-name', name));
    const custom = g.principal.kind === 'custom-group' ? g.principal : null;
    const detail = custom
      ? [custom.memberCount !== undefined ? tRaw('{count} people', { count: custom.memberCount }) : '', tRaw('Group made in this workspace')]
      : [tRaw('Directory group')];
    if (g.expiresAt && !s.canManage) detail.push(endDateText(g.expiresAt));
    who.append(el('div', 'share-access-muted', detail.filter(Boolean).join(' · ')));
    const controls = el('div', 'share-access-controls');
    if (s.canManage) {
      const role = select(tRaw('Role for {name}', { name }));
      for (const r of s.policy.roles.includes(g.role) ? s.policy.roles : [...s.policy.roles, g.role]) role.append(option(r, roleLabel(r as TeamRole)));
      role.value = g.role;
      role.addEventListener('change', () => {
        const grants = grantsOf(s);
        grants[index] = { ...grants[index]!, role: role.value as ShareRole };
        void change({ grants }, tRaw('{name} is now {role}.', { name, role: roleLabel(role.value as TeamRole) })).then((ok) => { if (!ok) role.value = g.role; });
      });
      const ends = endDateControl({
        label: tRaw('End date for {name}', { name }),
        ...(g.expiresAt ? { current: g.expiresAt } : {}),
        ...(s.policy.maxGrantDays ? { maxDays: s.policy.maxGrantDays } : {}),
        commit: (expiresAt) => {
          const grants = grantsOf(s);
          const { expiresAt: _old, ...rest } = grants[index]!;
          grants[index] = expiresAt ? { ...rest, expiresAt } : rest;
          return change({ grants }, expiresAt ? tRaw('Access for {name} ends {date}.', { name, date: dayLabel(expiresAt) }) : tRaw('Access for {name} has no end date.', { name }));
        },
      });
      const remove = el('button', 'btn btn--sm btn--ghost share-access-remove', tRaw('Remove'));
      remove.type = 'button';
      remove.setAttribute('aria-label', tRaw('Remove {name}', { name }));
      remove.addEventListener('click', () => {
        const grants = grantsOf(s).filter((_, i) => i !== index);
        void change({ grants }, tRaw('{name} no longer has access.', { name }));
      });
      controls.append(role, ends, remove);
      if (custom && myGroups.some((m) => m.id === custom.id && m.myRole !== 'member')) {
        const edit = el('button', 'btn btn--sm btn--ghost', tRaw('Edit group'));
        edit.type = 'button';
        edit.addEventListener('click', () => { void openGroup(custom.id); });
        controls.append(edit);
      }
    } else {
      controls.append(el('span', 'share-access-muted', roleLabel(g.role as TeamRole)));
    }
    li.append(who, controls);
    return li;
  }

  function addGroupRow(s: ShareState): HTMLElement | null {
    const granted = new Set(s.grants.map((g) => principalKey(g.principal)));
    const ctx = context();
    const directory = ctx.directoryGroups.filter((n) => !granted.has(`group:${n}`));
    const mine = myGroups.filter((g) => !granted.has(`custom-group:${g.id}`));
    const canCreate = s.policy.customGroups && ctx.canCreateGroups;
    if (!directory.length && !mine.length && !canCreate) return null;
    const row = el('div', 'share-access-add');
    const pick = select(tRaw('Group to add'), 'field-select field-select--sm share-access-pick');
    pick.append(option('', tRaw('Add a group…')));
    if (mine.length) {
      const og = el('optgroup');
      og.label = tRaw('Groups you are in');
      for (const g of mine) og.append(option(`custom-group:${g.id}`, g.name));
      pick.append(og);
    }
    if (directory.length) {
      const og = el('optgroup');
      og.label = tRaw('Directory groups');
      for (const n of directory) og.append(option(`group:${n}`, n));
      pick.append(og);
    }
    if (canCreate) pick.append(option('new', tRaw('New group…')));
    const roles = s.policy.roles;
    const role = select(tRaw('Role for the group'));
    for (const r of roles) role.append(option(r, roleLabel(r as TeamRole)));
    role.value = roles.includes('viewer') ? 'viewer' : roles[0] ?? 'viewer';
    const add = el('button', 'btn btn--sm', tRaw('Add'));
    add.type = 'button';
    add.disabled = true;
    const addKey = async (key: string, label: string): Promise<void> => {
      const principal: GrantWrite['principal'] = key.startsWith('group:') ? { kind: 'group', name: key.slice(6) } : { kind: 'custom-group', id: key.slice(13) };
      await change({ grants: [...grantsOf(s), { principal, role: role.value as ShareRole }] },
        tRaw('{name} can now open this project as {role}.', { name: label, role: roleLabel(role.value as TeamRole) }));
    };
    pick.addEventListener('change', () => {
      if (pick.value === 'new') {
        pick.value = '';
        void import('./share-groups-sheet.ts').then((m) => m.openShareGroupSheet({
          onSaved: (g) => { myGroups = [...myGroups.filter((x) => x.id !== g.id), g]; void addKey(`custom-group:${g.id}`, g.name); },
        }));
        return;
      }
      add.disabled = !pick.value;
    });
    add.addEventListener('click', () => {
      const key = pick.value;
      if (!key) return;
      void addKey(key, pick.selectedOptions[0]?.textContent ?? key);
    });
    row.append(pick, role, add);
    return row;
  }

  function generalBlock(s: ShareState): HTMLElement {
    const workspace = context().workspace || tRaw('this workspace');
    const box = el('div', 'share-access-general');
    const instance = s.general.audience === 'instance';
    box.append(withIcon(instance ? 'building' : 'lock', 'share-access-icon'));
    const body = el('div', 'share-access-who');
    const roleName = roleLabel(s.general.role as TeamRole);
    const hint = instance
      ? tRaw('Everyone who signs in to {workspace} can open this project as {role}.', { workspace, role: roleName })
      : tRaw('Only the people and groups listed can open this project.');
    if (s.canManage && s.policy.audiences.includes('instance')) {
      const controls = el('div', 'share-access-controls');
      const audience = select(tRaw('Who can open this project'), 'field-select field-select--sm share-access-pick');
      audience.append(option('restricted', tRaw('Only people and groups added')), option('instance', tRaw('Anyone at {workspace}', { workspace })));
      audience.value = s.general.audience;
      const roles = rolesForAudience('instance', s.policy.instanceMaxRole);
      const role = select(tRaw('Role for everyone at {workspace}', { workspace }));
      for (const r of roles) role.append(option(r, roleLabel(r as TeamRole)));
      role.value = roles.includes(s.general.role) ? s.general.role : roles[0] ?? 'viewer';
      role.hidden = !instance;
      const send = (): void => {
        const next: SharePatch['general'] = audience.value === 'instance' ? { audience: 'instance', role: role.value as ShareRole } : { audience: 'restricted' };
        void change({ general: next }, audience.value === 'instance'
          ? tRaw('Everyone at {workspace} can now open this project.', { workspace })
          : tRaw('Only the people and groups listed can open this project now.'));
      };
      audience.addEventListener('change', send);
      role.addEventListener('change', send);
      controls.append(audience, role);
      body.append(controls);
    } else {
      body.append(el('div', 'share-access-name', instance ? tRaw('Anyone at {workspace}', { workspace }) : tRaw('Only people and groups added')));
    }
    body.append(el('div', 'share-access-muted', hint));
    box.append(body);
    return box;
  }

  function render(): void {
    const s = state;
    if (!s) { section.hidden = true; return; }
    const h = el('h4', 'share-access-head', tRaw('Groups with access'));
    const parts: HTMLElement[] = [];
    if (s.grants.length) {
      const list = el('ul', 'share-access-list');
      for (const [i, g] of s.grants.entries()) list.append(groupRow(g, i, s));
      parts.push(h, list);
    } else if (s.canManage) {
      parts.push(h, el('p', 'share-access-muted', tRaw('No groups yet. Add one to share with many people at once.')));
    }
    if (s.canManage) { const add = addGroupRow(s); if (add) parts.push(add); }
    parts.push(el('h4', 'share-access-head', tRaw('General access')), generalBlock(s));
    section.replaceChildren(...parts);
    section.hidden = false;
    for (const row of rows.values()) fillMember(row);
  }

  function fillMember(row: { member: { userId: string; name: string; role: TeamRole }; manage: boolean; slot: HTMLElement }): void {
    const s = state;
    row.slot.replaceChildren();
    if (!s || row.member.role === 'owner') return;
    const current = s.expiries[row.member.userId];
    if (row.manage && s.canManage) {
      row.slot.append(endDateControl({
        label: tRaw('End date for {name}', { name: row.member.name }),
        ...(current ? { current } : {}),
        ...(s.policy.maxGrantDays ? { maxDays: s.policy.maxGrantDays } : {}),
        commit: async (expiresAt) => {
          const got = await setMemberExpiry(opts.projectId, row.member.userId, expiresAt);
          if (!got.ok) { opts.say(refusal(got.status, got.code), true); return false; }
          const next = { ...s.expiries };
          if (got.data.expiresAt) next[row.member.userId] = got.data.expiresAt; else delete next[row.member.userId];
          state = { ...s, expiries: next };
          fillMember(row);
          const name = row.member.name;
          opts.say(expiresAt ? tRaw('Access for {name} ends {date}.', { name, date: dayLabel(expiresAt) }) : tRaw('Access for {name} has no end date.', { name }), false);
          announce(expiresAt ? endDateText(expiresAt) : tRaw('No end date'));
          return true;
        },
      }));
    } else if (current) {
      row.slot.append(el('span', grantLive(current) ? 'share-access-muted' : 'share-access-ended', endDateText(current)));
    }
  }

  async function openGroup(id: string): Promise<void> {
    const m = await import('./share-groups-sheet.ts');
    m.openShareGroupSheet({
      groupId: id,
      onSaved: (g) => { myGroups = [...myGroups.filter((x) => x.id !== g.id), g]; void reload(); },
      onDeleted: () => { myGroups = myGroups.filter((x) => x.id !== id); void reload(); },
    });
  }

  async function reload(): Promise<void> {
    const [got, groups] = await Promise.all([getShareState(opts.projectId), listShareGroups()]);
    if (groups.ok) myGroups = groups.data;
    if (!got.ok) { state = null; render(); return; }
    state = got.data;
    render();
  }
  void reload();

  return {
    section,
    decorateMember(controls, member, manage) {
      const slot = el('span', 'share-access-member');
      // Between the role and Remove on a manager's row; last on a read-only one.
      if (manage && controls.lastElementChild) controls.insertBefore(slot, controls.lastElementChild);
      else controls.append(slot);
      const row = { controls, member, manage, slot };
      rows.set(member.userId, row);
      fillMember(row);
    },
  };
}
