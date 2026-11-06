// SPDX-License-Identifier: MPL-2.0
/**
 * The Colour roles table in the DOM (plans/352 R2): a person states the design system's
 * vocabulary here and sees what Lolly does with each word.
 *
 * The room writes nothing itself. Every edit is a pure engine function returning a new
 * document, handed to `ctx.commit`, which takes the undo step, swaps the document, repaints
 * and saves, the way every other Colours room edit does. A visit that changes nothing
 * therefore leaves the document byte-identical.
 *
 * A managed system mounts the same table with `readOnly`, which draws no controls beyond
 * choosing which colourway to look at.
 *
 * Rendering replaces the markup, so every focusable element carries a `data-crt-focus` key
 * and focus returns to the same control. A render asked for while a text field's `change`
 * is being handled waits a tick: the browser moves focus after that event, and replacing
 * the field underneath it would send Tab back to the top of the page.
 */
import '../../../styles/parts/panel.css';
import '../../../styles/parts/brand-studio.css';
import '../../../styles/parts/colour-roles.css';
import {
  addColourRole, bindRole, describeColourRole, removeColourRole, renameColourRole, reorderColourRoles, setColourRoles,
  setRoleSameAsLight, setRoleValue, unbindRole,
} from '@lolly/engine';
import type { ColourRoleEdit } from '../../../../../../engine/src/colour-roles.ts';
import { mountBodyPopover, type BodyPopoverHandle, type PopoverAnchor } from '../../../components/body-popover.ts';
import { mountColorField } from '../../../components/color-field.ts';
import { wireReorderList } from '../../../components/reorder-list.ts';
import { announce } from '../../../a11y.ts';
import { t, tRaw } from '../../../i18n.ts';
import { canonicalLiftOptions, listLeads } from '../leads.ts';
import { byNameWord, colourRolesModel, explainRemoval, parseRoleWords, refusalText, sameAsWords, slotWord, specsForShippedRename, specsForWords, STARTING_POINTS } from '../colour-roles-model.ts';
import type { ColourRolesModel, RoleTableRow, SlotId } from '../colour-roles-model.ts';
import { placeBelow, wireSwatchArrows } from '../role-chips.ts';
import type { RoleSwatchOption } from '../roles.ts';
import { emptyUi, roomHtml, startPreviewHtml, valuePickerHtml, viewChipsHtml } from './colour-roles-html.ts';
import type { RoomUi } from './colour-roles-html.ts';

export interface ColourRolesRoomCtx {
  doc(): unknown;
  /** The colourway the values belong to, null for the default. */
  colourway(): string | null;
  /** Draw the table with no editing controls. */
  readOnly?: boolean;
  /** The palette's own colours, offered in the value picker. */
  swatches?(): RoleSwatchOption[];
  /** The room's one write. False when nothing was written. */
  commit?(label: string, edit: ColourRoleEdit): boolean;
  /** A shipped word's colour: a palette colour or a literal, written through the slot. */
  setSlot?(slot: SlotId, mode: string, value: { key: string } | { literal: string }): boolean;
}

export interface ColourRolesRoomHandle {
  render(): void;
  /** True while a value picker is open, so the room's Escape ladder closes that first. */
  isOpen(): boolean;
  close(returnFocus?: boolean): void;
  /** Open the value picker for a role from outside the table: a palette tile, say. */
  openValue(key: string, mode: string, anchor?: HTMLElement): void;
  destroy(): void;
}

export function mountColourRolesRoom(mount: HTMLElement, ctx: ColourRolesRoomCtx): ColourRolesRoomHandle {
  const ui: RoomUi = emptyUi();
  let popover: BodyPopoverHandle | null = null;
  let stopReorder: (() => void) | null = null;
  let holdRender = false;
  let renderOwed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let destroyed = false;
  mount.classList.add('lp', 'crt');

  // A read-only view chooses its own colourway to look at, having no row above the table.
  let viewing: string | null = null;
  const colourway = (): string | null => viewing ?? ctx.colourway();
  const model = (): ColourRolesModel => colourRolesModel(ctx.doc(), { colourway: colourway(), readOnly: !!ctx.readOnly });
  const rowOf = (m: ColourRolesModel, key: string): RoleTableRow | undefined => m.rows.find(r => r.key === key);

  const focusKey = (key: string): void => {
    mount.querySelector<HTMLElement>(`[data-crt-focus="${CSS.escape(key)}"]`)?.focus({ preventScroll: true });
  };

  const render = (): void => {
    if (destroyed) return;
    if (holdRender) { renderOwed = true; return; }
    const m = model();
    const active = mount.ownerDocument.activeElement;
    const key = active instanceof HTMLElement && mount.contains(active) ? active.dataset.crtFocus : undefined;
    const selection = active instanceof HTMLInputElement ? [active.selectionStart, active.selectionEnd] as const : null;
    stopReorder?.(); stopReorder = null;
    const chips = ctx.readOnly ? viewChipsHtml(leadChips(ctx.doc()), m.colourway?.id ?? null) : '';
    mount.innerHTML = `${chips}${roomHtml(m, ui)}`;
    wireRows(m);
    if (key) {
      focusKey(key);
      const again = mount.ownerDocument.activeElement;
      if (selection && again instanceof HTMLInputElement) { try { again.setSelectionRange(selection[0], selection[1]); } catch { /* not a text field */ } }
    }
  };

  /** Run an edit from a text field's `change`, then repaint once focus has settled. */
  const whileEditing = (run: () => void): void => {
    holdRender = true;
    try { run(); } finally { holdRender = false; }
    if (renderOwed) {
      renderOwed = false;
      clearTimeout(timer);
      timer = setTimeout(render, 0);
    }
  };

  const apply = (label: string, edit: ColourRoleEdit, where: string, shown = ''): boolean => {
    if (!edit.ok) {
      const text = refusalText(edit, shown);
      ui.notice = { key: where, text };
      announce(text, { assertive: true });
      render();
      return false;
    }
    ui.notice = null;
    if (!edit.changed) { render(); return false; }
    const wrote = ctx.commit?.(label, edit) ?? false;
    render();
    return wrote;
  };

  /** Wire the grips: the shared pointer and keyboard gesture, one undoable write per move. */
  const wireRows = (m: ColourRolesModel): void => {
    const rows = mount.querySelector<HTMLElement>('.crt-rows');
    if (!rows || !m.editable || m.state !== 'declared') return;
    stopReorder = wireReorderList(rows, (from, to) => {
      const order = m.rows.map(r => r.key);
      const [moved] = order.splice(from, 1);
      if (!moved) return;
      order.splice(to, 0, moved);
      apply(tRaw('Reorder {role}', { role: rowOf(m, moved)?.label ?? moved }), reorderColourRoles(ctx.doc(), order), `name:${moved}`);
      // The markup was replaced, so focus goes back to the moved row's handle by its key.
      focusKey(`grip:${moved}`);
    }, announce, {
      instructions: t('Use the arrow keys to move this role. Space drops. Escape cancels.'),
      cancelled: t('Move cancelled.'),
      position: (index, count) => tRaw('Role {position} of {count}.', { position: index + 1, count }),
    });
  };

  // ── Value picker ───────────────────────────────────────────────────────────

  const closePicker = (returnFocus = false): void => { popover?.close(returnFocus); };

  const writeValue = (key: string, mode: string, row: RoleTableRow, value: { key: string } | { literal: string }): void => {
    if (row.shipped) { ctx.setSlot?.(key as SlotId, mode, value); return; }
    const stored = 'key' in value ? `{${value.key}}` : value.literal;
    apply(tRaw('Change {role}', { role: row.label }), setRoleValue(ctx.doc(), { roleId: key, colourway: colourway(), mode, value: stored }), `name:${key}`);
  };

  const openValue = (key: string, mode: string, anchorEl?: HTMLElement): void => {
    if (!ctx.commit) return;
    closePicker();
    const m = model();
    const row = rowOf(m, key);
    const cell = row?.cells.find(c => c.mode === mode);
    if (!row || !cell) return;
    const cellButton = (): HTMLElement | null => anchorEl?.isConnected ? anchorEl
      : mount.querySelector<HTMLElement>(`[data-crt-value="${CSS.escape(key)}"][data-crt-mode="${CSS.escape(mode)}"]`);
    const anchor: PopoverAnchor = {
      getBoundingClientRect: () => (cellButton() ?? mount).getBoundingClientRect(),
      contains: (node: Node | null) => !!cellButton()?.contains(node),
      focus: () => cellButton()?.focus({ preventScroll: true }),
      setAttribute: (name: string, value: string) => cellButton()?.setAttribute(name, value),
    };
    const firstLook = m.modes[0]?.id;
    const options = ctx.swatches?.() ?? [];
    const title = m.colourway && m.modes.length
      ? tRaw('{role} in {colourway}, {look}', { role: row.label, colourway: m.colourway.name, look: cell.modeName })
      : tRaw('{role}, {look}', { role: row.label, look: cell.modeName });
    popover = mountBodyPopover(anchor, (el, pop) => {
      const stored = options.find(s => s.name === cell.text);
      el.innerHTML = valuePickerHtml({
        title,
        caption: cell.sameAs ? sameAsWords(cell.sameAs) : cell.text || t('No colour here'),
        cell,
        sameAs: !row.shipped && firstLook && firstLook !== mode ? { label: sameAsWords(m.modes[0]!.name), pressed: !!cell.sameAs } : null,
        options,
        current: stored?.key ?? '',
      });
      wireSwatchArrows(el);
      const cap = el.querySelector<HTMLElement>('[data-be-rolepick-cap]');
      const resting = cap?.textContent ?? '';
      const say = (btn: HTMLElement | null): void => { if (cap) cap.textContent = btn?.getAttribute('aria-label') ?? resting; };
      el.addEventListener('focusin', e => say((e.target as HTMLElement).closest<HTMLElement>('[data-be-rolepick]')));
      el.addEventListener('pointerover', e => say((e.target as HTMLElement).closest<HTMLElement>('[data-be-rolepick]')));
      el.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const swatch = target.closest<HTMLElement>('[data-be-rolepick]');
        if (swatch?.dataset.beRolepick) {
          pop.close(true);
          if (swatch.getAttribute('aria-pressed') !== 'true') writeValue(key, mode, row, { key: swatch.dataset.beRolepick });
          return;
        }
        if (target.closest('[data-crt-same]')) {
          if (cell.sameAs) return;
          pop.close(true);
          apply(sameAsWords(m.modes[0]!.name), setRoleSameAsLight(ctx.doc(), { roleId: key, colourway: colourway(), mode, from: firstLook }), `name:${key}`);
          return;
        }
        if (target.closest('[data-crt-keep]')) {
          pop.close(true);
          // Setting the colour it already has clears the copied mark, and the value stays.
          const value = cell.hex;
          if (value) apply(tRaw('Keep {role}', { role: row.label }), setRoleValue(ctx.doc(), { roleId: key, colourway: colourway(), mode, value }), `name:${key}`);
        }
      });
      // The studio's own picker, for a colour the palette does not hold. A drag writes once it ends.
      const field = el.querySelector<HTMLElement>('[data-crt-field]');
      if (field) {
        let dragging = false;
        let owed: string | null = null;
        const write = (value: string): void => { if (value && value !== 'transparent') writeValue(key, mode, row, { literal: value }); };
        mountColorField(field, `crt-${key}-${mode}`, {
          value: cell.hex, inline: true, modes: true, progressive: true,
          onChange: (value) => { if (dragging) owed = value; else write(value); },
          onInteractStart: () => { dragging = true; },
          onInteractEnd: () => { dragging = false; if (owed) { const value = owed; owed = null; write(value); } },
        });
      }
      // Focus sits on what the value is now, or on the panel: landing on some other swatch
      // would put that colour's name in the caption and read as if it were this value.
      el.tabIndex = -1;
      return el.querySelector<HTMLElement>('[data-be-rolepick][aria-pressed="true"]') ?? el;
    }, {
      className: 'folder-menu be-rolepick crt-pick', role: 'dialog', ariaLabel: title,
      trackScroll: true, trackSize: true, position: placeBelow,
      // The colour field floats panels of its own on the body, which are part of this one.
      isInside: (node) => !!(node as Element | null)?.closest?.('.color-popover, [data-color-popover]'),
      onClose: () => { popover = null; },
    });
    popover.open();
  };

  // ── Reading a role ─────────────────────────────────────────────────────────

  const setReading = (m: ColourRolesModel, row: RoleTableRow, slot: SlotId | ''): void => {
    const holder = slot ? m.slotHolders.get(slot) : undefined;
    let next: unknown = ctx.doc();
    let last: ColourRoleEdit | null = null;
    for (const other of row.slots) {
      if (other === slot) continue;
      const edit = unbindRole(next, other);
      last = edit;
      if (!edit.ok) break;
      next = edit.doc;
    }
    if (slot && (!last || last.ok)) last = bindRole(next, slot, row.key);
    if (!last) return;
    const word = slot ? slotWord(slot) : byNameWord();
    const wrote = apply(tRaw('{role} read as {word}', { role: row.label, word }), last, `reads:${row.key}`);
    if (wrote) {
      const moved = holder && holder.roleId !== row.key ? ` ${tRaw('{role} is now read by name only.', { role: holder.label })}` : '';
      announce(`${tRaw('Lolly now reads {role} as {word}.', { role: row.label, word })}${moved}`);
    }
  };

  // ── Starting points and adding ─────────────────────────────────────────────

  const useWords = (text: string): void => {
    const words = parseRoleWords(text);
    if (!words.length) { ui.notice = { key: 'start', text: t('Type at least one word.') }; render(); focusKey('words'); return; }
    const edit = setColourRoles(ctx.doc(), specsForWords(words), { lift: canonicalLiftOptions(ctx.doc()) });
    if (!edit.ok) { ui.notice = { key: 'start', text: refusalText(edit, words[0]) }; announce(ui.notice.text, { assertive: true }); render(); focusKey('words'); return; }
    ui.starting = null;
    ui.notice = null;
    if (!edit.changed) { announce(t('These are the words this design system uses now, so nothing changes.')); render(); focusKey('add'); return; }
    ctx.commit?.(t('Colour roles'), edit);
    announce(tRaw('Colour roles are now {words}.', { words: words.join(', ') }));
    render();
    focusKey(`name:${model().rows[0]?.key ?? ''}`);
  };

  const addWord = (word: string): void => {
    const label = word.trim();
    if (!label) { focusKey('add-word'); return; }
    const edit = addColourRole(ctx.doc(), { label, lift: canonicalLiftOptions(ctx.doc()) });
    if (!edit.ok) { ui.notice = { key: 'add', text: refusalText(edit, label) }; announce(ui.notice.text, { assertive: true }); render(); focusKey('add-word'); return; }
    ui.notice = null;
    ctx.commit?.(tRaw('Add {role}', { role: label }), edit);
    announce(tRaw('{role} added. No tool picks this colour by itself until you choose how Lolly reads the role.', { role: label }));
    render();
    focusKey('add-word');
  };

  // ── Removing ───────────────────────────────────────────────────────────────

  const askToRemove = (key: string): void => {
    const row = rowOf(model(), key);
    if (!row) return;
    const doc = ctx.doc();
    const plain = removeColourRole(doc, key);
    if (plain.ok) {
      ui.removing = { key, label: row.label, plain: true, explanation: explainRemoval(doc, row.label, undefined, { canRelease: false }) };
    } else if (plain.code === 'role-in-use') {
      const released = removeColourRole(doc, key, { release: true });
      const inUse = released.ok ? plain.inUse : (released.inUse ?? plain.inUse);
      ui.removing = { key, label: row.label, plain: false, explanation: explainRemoval(doc, row.label, inUse, { canRelease: released.ok }) };
    } else {
      ui.notice = { key: `name:${key}`, text: refusalText(plain, row.label) };
      render();
      return;
    }
    render();
    focusKey('remove-go');
    if (!mount.ownerDocument.activeElement?.matches('[data-crt-focus="remove-go"]')) focusKey('remove-cancel');
  };

  const removeRole = (release: boolean): void => {
    const r = ui.removing;
    if (!r) return;
    const edit = removeColourRole(ctx.doc(), r.key, release ? { release: true } : {});
    ui.removing = null;
    if (apply(tRaw('Remove {role}', { role: r.label }), edit, `name:${r.key}`, r.label)) announce(tRaw('{role} removed. Undo is available.', { role: r.label }));
    focusKey('add');
  };

  // ── Events ─────────────────────────────────────────────────────────────────

  const onClick = (e: Event): void => {
    const el = e.target as HTMLElement;
    const value = el.closest<HTMLElement>('[data-crt-value]');
    if (value) { openValue(value.dataset.crtValue!, value.dataset.crtMode!); return; }
    const remove = el.closest<HTMLElement>('[data-crt-remove]');
    if (remove) { askToRemove(remove.dataset.crtRemove!); return; }
    const go = el.closest<HTMLElement>('[data-crt-remove-go]');
    if (go) { removeRole(go.dataset.crtRemoveGo === 'release'); return; }
    if (el.closest('[data-crt-remove-cancel]')) { const k = ui.removing?.key; ui.removing = null; render(); if (k) focusKey(`remove:${k}`); return; }
    if (el.closest('[data-crt-start-open]')) { ui.starting = ''; ui.notice = null; render(); focusKey('seed:0'); return; }
    const seed = el.closest<HTMLElement>('[data-crt-seed]');
    if (seed) {
      ui.starting = (STARTING_POINTS[Number(seed.dataset.crtSeed)] ?? []).join(', ');
      render();
      focusKey('words');
      return;
    }
    if (el.closest('[data-crt-start-use]')) { useWords(mount.querySelector<HTMLInputElement>('[data-crt-words]')?.value ?? ''); return; }
    if (el.closest('[data-crt-start-cancel]')) { ui.starting = null; ui.notice = null; render(); focusKey('add'); return; }
    if (el.closest('[data-crt-add]')) { ui.adding = true; ui.notice = null; render(); focusKey('add-word'); return; }
    if (el.closest('[data-crt-add-go]')) { addWord(mount.querySelector<HTMLInputElement>('[data-crt-add-word]')?.value ?? ''); return; }
    if (el.closest('[data-crt-add-cancel]')) { ui.adding = false; ui.notice = null; render(); focusKey('add'); return; }
    const token = el.closest<HTMLElement>('[data-crt-name-token]');
    if (token) { nameToken(token.dataset.crtNameToken!); return; }
    const letGo = el.closest<HTMLElement>('[data-crt-letgo]');
    if (letGo) {
      const role = letGo.dataset.crtRole!;
      apply(tRaw('Let go of {slot}', { slot: slotWord(letGo.dataset.crtLetgo as SlotId) }), unbindRole(ctx.doc(), letGo.dataset.crtLetgo!), `reads:${role}`);
      focusKey(`reads:${role}`);
      return;
    }
    const link = el.closest<HTMLElement>('[data-crt-link]');
    if (link) {
      const role = link.dataset.crtRole!;
      apply(tRaw('Link {slot}', { slot: slotWord(link.dataset.crtLink as SlotId) }), bindRole(ctx.doc(), link.dataset.crtLink!, role), `reads:${role}`);
      focusKey(`reads:${role}`);
    }
  };

  const nameToken = (id: string): void => {
    const input = mount.querySelector<HTMLInputElement>(`[data-crt-token-word="${CSS.escape(id)}"]`);
    const label = input?.value.trim() || id;
    const edit = addColourRole(ctx.doc(), { id, label, lift: canonicalLiftOptions(ctx.doc()) });
    if (apply(tRaw('Add {role}', { role: label }), edit, `token:${id}`, label)) announce(tRaw('{role} is now a colour role.', { role: label }));
  };

  const onChange = (e: Event): void => {
    const el = e.target as HTMLElement;
    const name = el.closest<HTMLInputElement>('[data-crt-name]');
    if (name) {
      const key = name.dataset.crtName!;
      const m = model();
      const row = rowOf(m, key);
      const label = name.value.trim();
      if (!row) return;
      if (label === row.label) { name.value = row.label; return; }
      if (!label) { name.value = row.label; ui.notice = { key: `name:${key}`, text: t('A colour role needs a name.') }; render(); return; }
      whileEditing(() => {
        if (row.shipped) {
          const edit = setColourRoles(ctx.doc(), specsForShippedRename(key as SlotId, label), { lift: canonicalLiftOptions(ctx.doc()) });
          apply(tRaw('Rename {role}', { role: row.label }), edit, `name:${key}`, label);
        } else {
          apply(tRaw('Rename {role}', { role: row.label }), renameColourRole(ctx.doc(), key, label), `name:${key}`, label);
        }
      });
      return;
    }
    const desc = el.closest<HTMLTextAreaElement>('[data-crt-desc]');
    if (desc) {
      const key = desc.dataset.crtDesc!;
      const row = rowOf(model(), key);
      if (!row || desc.value.trim() === row.description) return;
      whileEditing(() => apply(tRaw('Describe {role}', { role: row.label }), describeColourRole(ctx.doc(), key, desc.value.trim() || null), `name:${key}`));
      return;
    }
    const reads = el.closest<HTMLSelectElement>('[data-crt-reads]');
    if (reads) {
      const m = model();
      const row = rowOf(m, reads.dataset.crtReads!);
      if (row) setReading(m, row, reads.value as SlotId | '');
    }
  };

  const onInput = (e: Event): void => {
    const words = (e.target as HTMLElement).closest<HTMLInputElement>('[data-crt-words]');
    if (!words) return;
    ui.starting = words.value;
    const preview = mount.querySelector<HTMLElement>('[data-crt-start-preview]');
    if (preview) preview.innerHTML = startPreviewHtml(words.value);
  };

  const onKeydown = (e: KeyboardEvent): void => {
    const el = e.target as HTMLElement;
    if (e.key === 'Enter') {
      if (el.matches('[data-crt-name], [data-crt-desc]')) { e.preventDefault(); (el as HTMLInputElement).blur(); return; }
      if (el.matches('[data-crt-words]')) { e.preventDefault(); useWords((el as HTMLInputElement).value); return; }
      if (el.matches('[data-crt-add-word]')) { e.preventDefault(); addWord((el as HTMLInputElement).value); return; }
      if (el.matches('[data-crt-token-word]')) { e.preventDefault(); nameToken(el.dataset.crtTokenWord!); return; }
    }
    if (e.key !== 'Escape') return;
    if (el.matches('[data-crt-name]')) {
      const row = rowOf(model(), el.dataset.crtName!);
      if (row && (el as HTMLInputElement).value !== row.label) { (el as HTMLInputElement).value = row.label; e.stopPropagation(); }
      return;
    }
    if (el.matches('[data-crt-desc]')) {
      const row = rowOf(model(), el.dataset.crtDesc!);
      if (row && (el as HTMLTextAreaElement).value !== row.description) { (el as HTMLTextAreaElement).value = row.description; e.stopPropagation(); }
      return;
    }
    const panel = el.closest<HTMLElement>('[data-crt-panel]')?.dataset.crtPanel;
    if (!panel) return;
    e.stopPropagation();
    if (panel === 'removal') { const k = ui.removing?.key; ui.removing = null; render(); if (k) focusKey(`remove:${k}`); return; }
    if (panel === 'start') ui.starting = null;
    if (panel === 'add') ui.adding = false;
    ui.notice = null;
    render();
    focusKey('add');
  };

  const onViewClick = (e: Event): void => {
    const chip = (e.target as HTMLElement).closest<HTMLElement>('[data-crt-view]');
    if (chip) { viewing = chip.dataset.crtView ?? null; render(); }
  };

  mount.addEventListener('click', ctx.readOnly ? onViewClick : onClick);
  mount.addEventListener('change', onChange);
  mount.addEventListener('input', onInput);
  mount.addEventListener('keydown', onKeydown);
  render();

  return {
    render,
    isOpen: () => !!popover?.isOpen(),
    close: closePicker,
    openValue,
    destroy: () => {
      destroyed = true;
      clearTimeout(timer);
      stopReorder?.();
      closePicker();
      mount.removeEventListener('click', ctx.readOnly ? onViewClick : onClick);
      mount.removeEventListener('change', onChange);
      mount.removeEventListener('input', onInput);
      mount.removeEventListener('keydown', onKeydown);
    },
  };
}

/** The colourways as the read-only view lists them. */
function leadChips(doc: unknown): Array<{ id: string; name: string; canonical: boolean; hex: string }> {
  return listLeads(doc).map(lead => ({ id: lead.id, name: lead.name, canonical: lead.canonical, hex: lead.colours.light?.primary ?? '' }));
}

/** A managed system's section: its heading, and the table with no controls. */
export function mountColourRolesReadOnly(section: HTMLElement, doc: unknown): ColourRolesRoomHandle {
  section.classList.add('crt-section');
  const heading = section.ownerDocument.createElement('h2');
  heading.className = 'crt-section-head';
  heading.textContent = t('Colour roles');
  const body = section.ownerDocument.createElement('div');
  section.replaceChildren(heading, body);
  return mountColourRolesRoom(body, { doc: () => doc, colourway: () => null, readOnly: true });
}
