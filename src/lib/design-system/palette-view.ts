// SPDX-License-Identifier: MPL-2.0
import { contrastRatio } from '@lolly/engine';
import { escape as esc } from '../../utils.ts';
import { t, tRaw } from '../../i18n.ts';
import { setSwatchGroup, type BrandSwatch } from '../brand-doc.ts';
import { swatchTile } from '../swatches.ts';
import { colorIdentity } from './ownership.ts';
import { groupName, paletteGroups, addPaletteGroup, changePaletteGroup } from './palette-groups.ts';

export interface PaletteViewOptions {
  roles: ReadonlyMap<string, string>;
  groups: string[];
  hidden: number;
  starterGroup: string | null;
}

/** Shared tile stays the edit target; the sibling checkbox makes selection discoverable. */
export function paletteCard(s: BrandSwatch, idx: number, roleGlyph?: string): string {
  return `<div class="be-pal-card">
    ${swatchTile({ label: s.name, hex: s.hex, locked: !!s.lock }, { idx, roleGlyph, roleOnLight: contrastRatio(s.hex, '#000000') > contrastRatio(s.hex, '#ffffff') })}
    <label class="be-pal-check"><input type="checkbox" data-be-select="${idx}" aria-label="${esc(tRaw('Select {name}', { name: s.name }))}"><span aria-hidden="true"></span></label>
    <span class="be-pal-name">${esc(s.name)}</span><code class="be-pal-hex">${esc(s.hex || 'transparent')}</code>
  </div>`;
}

export function paletteHtml(swatches: BrandSwatch[], starter: Set<string>, opts: PaletteViewOptions): string {
  const material = swatches.filter(s => s.kind !== 'semantic');
  const isStarter = (s: BrandSwatch): boolean => starter.has(colorIdentity(s.key, s.raw)) && !opts.groups.includes(groupName(s.group));
  const chosen = material.filter(s => !isStarter(s));
  const inherited = material.filter(isStarter);
  const groups = new Map<string, BrandSwatch[]>(opts.groups.map(g => [g, []]));
  const rank = (s: BrandSwatch): number => s.kind === 'custom' ? 0 : s.kind === 'spectrum' ? 1 : 2;
  for (const s of [...chosen].sort((a, b) => rank(a) - rank(b))) {
    const name = groupName(s.group);
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name)!.push(s);
  }
  const cards = (items: BrandSwatch[]): string => items.map(s => paletteCard(s, swatches.indexOf(s), opts.roles.get(s.key))).join('');
  const action = (attr: string, name: string, label: string): string => `<button type="button" class="be-pal-group-all" ${attr}="${esc(name)}">${esc(label)}</button>`;
  const body = [...groups].map(([name, items]) => `<details class="be-pal-group" data-be-group="${esc(name)}" open>
    <summary class="be-pal-group-head"><span class="be-pal-group-label">${esc(name)}<span class="be-pal-group-n">${items.length}</span></span>
      ${items.length ? action('data-be-pal-all', name, t('Select')) : ''}
      ${opts.groups.includes(name) ? action('data-be-group-rename', name, t('Rename')) + action('data-be-group-remove', name, t('Ungroup')) : ''}
      <button type="button" class="be-add be-add--sm" data-be-add="custom" data-be-add-group="${esc(name)}" aria-label="${esc(tRaw('Add swatch to {group}', { group: name }))}">+</button>
    </summary>
    ${items.length ? `<div class="be-pal-grid">${cards(items)}</div>` : `<button type="button" class="be-pal-empty" data-be-add="custom" data-be-add-group="${esc(name)}">${t('+ Add a swatch')}</button>`}
  </details>`).join('');
  const count = chosen.length ? tRaw('{n} colours', { n: chosen.length }) : inherited.length ? tRaw('{n} starter colours', { n: inherited.length }) : t('No colours yet');
  return `<div class="be-pal-top"><span class="be-pal-count">${count}</span><div class="be-pal-topbtns">
      <button type="button" class="be-add" data-be-add="custom">${t('+ Add swatch')}</button>
      <button type="button" class="be-add" data-be-addgroup>${t('+ Add group')}</button>
    </div></div><div data-be-group-form></div>${body}
    ${inherited.length ? `<details class="be-pal-group be-pal-group--starter" data-be-group="Starter colours"${!chosen.length || opts.starterGroup ? ' open' : ''}>
      <summary class="be-pal-group-head"><span class="be-pal-group-label">${t('Starter colours')}<span class="be-pal-group-n">${inherited.length}</span></span>
        ${action('data-be-pal-all', 'Starter colours', t('Select'))}<button type="button" class="be-pal-group-all" data-be-hide-starter>${t('Hide all')}</button>
      </summary><div class="be-pal-grid">${cards(inherited)}</div></details>` : ''}
    ${opts.hidden ? `<button type="button" class="be-pal-restore" data-be-restore>${tRaw('Restore hidden colours ({n})', { n: opts.hidden })}</button>` : ''}`;
}

interface GroupControls {
  doc(): unknown;
  swatches(): BrandSwatch[];
  current(): BrandSwatch | undefined;
  before(label: string): void;
  commit(): void;
  close(): void;
  open(path: string[]): void;
}

/** Inline group creation and direct swatch moves share the same document surgery. */
export function mountPaletteGroupControls(palette: HTMLElement | null, editor: HTMLElement | null, ctx: GroupControls): { renderEditorGroup(swatch: BrandSwatch): void } {
  const focusAdd = (): void => { palette?.querySelector<HTMLElement>('[data-be-addgroup]')?.focus(); };
  const showForm = (rename?: string, movePath?: string[]): void => {
    const mount = palette?.querySelector<HTMLElement>('[data-be-group-form]');
    if (!mount) return;
    const form = document.createElement('form'); form.className = 'be-group-form';
    const input = document.createElement('input');
    input.className = 'field-input'; input.maxLength = 60;
    input.placeholder = t('Group name'); input.setAttribute('aria-label', t('Group name')); input.value = rename ?? '';
    const save = document.createElement('button');
    save.type = 'submit'; save.className = 'be-btn'; save.textContent = rename ? t('Rename') : t('Create group');
    const cancel = document.createElement('button');
    cancel.type = 'button'; cancel.className = 'be-btn'; cancel.textContent = t('Cancel');
    const dismiss = (): void => { mount.replaceChildren(); focusAdd(); };
    cancel.addEventListener('click', dismiss);
    form.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); dismiss(); } });
    form.addEventListener('submit', e => {
      e.preventDefault();
      if (!groupName(input.value)) { input.focus(); return; }
      ctx.before(rename ? t('Rename group') : t('Create group'));
      if (rename) changePaletteGroup(ctx.doc(), rename, input.value);
      else {
        const name = addPaletteGroup(ctx.doc(), input.value);
        if (name && movePath) setSwatchGroup(ctx.doc(), movePath, name);
      }
      ctx.commit(); focusAdd();
    });
    form.append(input, save, cancel); mount.replaceChildren(form); input.focus(); input.select();
  };
  palette?.addEventListener('click', e => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-be-addgroup], [data-be-group-rename], [data-be-group-remove]');
    if (!target) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (target.hasAttribute('data-be-addgroup')) showForm();
    else if (target.dataset.beGroupRename) showForm(target.dataset.beGroupRename);
    else if (target.dataset.beGroupRemove) {
      ctx.before(t('Ungroup colours')); changePaletteGroup(ctx.doc(), target.dataset.beGroupRemove, null); ctx.commit(); focusAdd();
    }
  });
  editor?.querySelector('[data-be-editor-group]')?.addEventListener('change', e => {
    const cur = ctx.current(); if (!cur) return;
    const value = (e.target as HTMLSelectElement).value;
    if (!value) { ctx.close(); showForm(undefined, cur.path); return; }
    ctx.before(t('Move swatch'));
    addPaletteGroup(ctx.doc(), value); setSwatchGroup(ctx.doc(), cur.path, value);
    ctx.close(); ctx.commit(); ctx.open(cur.path);
  });
  return {
    renderEditorGroup(swatch) {
      const select = editor?.querySelector<HTMLSelectElement>('[data-be-editor-group]'); if (!select) return;
      const current = groupName(swatch.group);
      const names = [...new Set([current, ...paletteGroups(ctx.doc()), ...ctx.swatches().filter(s => s.kind !== 'semantic').map(s => groupName(s.group))])];
      select.replaceChildren(...names.map(name => new Option(name, name, false, name === current)), new Option(t('+ New group…'), ''));
    },
  };
}
