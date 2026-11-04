// SPDX-License-Identifier: MPL-2.0
/**
 * The role chips at the top of the Colours room (plan 346 change 7).
 *
 * "Which colour is my primary" is the first decision a brand builder makes and
 * the one every tool reads, so it leads the room: one chip per assignable role
 * a person decides first (Primary, Secondary, Surface, Text - `ROLE_IDS`), each
 * showing the colour that plays it and its name. Pressing a chip opens a small
 * picker of the palette's own swatches; choosing one re-points the role. The
 * full strip (all seven slots, contrast readouts, Not set) stays in the Colour
 * roles wing for experts, and both read the same model, so they cannot disagree.
 *
 * Pure down to `roleChipsHtml` and `rolePickerHtml`, which are string builders
 * over `buildRolesModel`'s rows; `mountRoleChips` is the only part that touches
 * the DOM. The chips never write the document themselves: the room's `assign`
 * does the write, the repaint and the persist, exactly as for the full strip.
 */
import { escape as esc } from '../../utils.ts';
import { t, tRaw } from '../../i18n.ts';
import { icon } from '../icons.ts';
import { mountBodyPopover, type BodyPopoverHandle, type PopoverAnchor } from '../../components/body-popover.ts';
import { groupName } from './palette-groups.ts';
import { ASSIGNABLE_ROLES, ROLE_IDS, buildRolesModel } from './roles.ts';
import type { RoleId, RoleRow, RolesCtx, RolesModel, RoleSwatchOption } from './roles.ts';

/** The chips' model: the four first decisions, in the full strip's order. */
export function roleChipsModel(
  doc: unknown, ctx: Parameters<typeof buildRolesModel>[1], swatches: RoleSwatchOption[], resolve?: (key: string) => unknown,
): RolesModel {
  return buildRolesModel(doc, ctx, swatches, resolve, ROLE_IDS);
}

/** What a chip shows it holds: the colour's name. A chip is too narrow for the
 *  strip's stand-in sentence, so a starter colour is named plainly and the chip
 *  says "Starter" beside its role instead; the primary showing through keeps
 *  its short arrow; an unset role says Not set. */
function chipValue(row: RoleRow): string {
  if (row.follows) return row.value;
  return row.name || row.value;
}

/** The chip's accessible name: the role, what it holds (the strip's full
 *  sentence, stand-ins included), and what pressing does. */
function chipLabel(row: RoleRow): string {
  return tRaw('{role}: {value}. Choose a colour', { role: row.label, value: row.value });
}

/** One chip per role. Pure, so its shape is asserted headless. */
export function roleChipsHtml(model: RolesModel): string {
  return `<div class="be-rolechips" role="group" aria-label="${esc(t('Colour roles'))}">${model.rows.map(row => `
    <button type="button" class="be-rolechip${row.set ? '' : ' is-unset'}${row.starter || row.follows ? ' is-starter' : ''}"
      data-be-rolechip="${esc(row.id)}" aria-haspopup="dialog" aria-expanded="false"
      aria-label="${esc(chipLabel(row))}">
      <span class="be-rolechip-sw" style="--sw:${esc(row.hex || 'transparent')}" aria-hidden="true"></span>
      <span class="be-rolechip-meta" aria-hidden="true">
        <span class="be-rolechip-role">${esc(row.label)}${row.starter ? `<span class="be-rolechip-tag">${esc(t('Starter'))}</span>` : ''}</span>
        <span class="be-rolechip-val">${esc(chipValue(row))}</span>
      </span>
      <span class="be-rolechip-chev" aria-hidden="true">${icon('chevronDown', { size: 14 })}</span>
    </button>`).join('')}</div>`;
}

/** A swatch's name and hex, for the picker's caption and accessible name. */
const swatchText = (s: RoleSwatchOption): string => `${s.name} ${s.hex}`;

/**
 * The picker for one role: the palette's swatches under their own group
 * headings, the person's colours first and the starter's last under "Starter",
 * the way the full strip's select files them. The swatch the role sits on is
 * pressed. Pure.
 */
export function rolePickerHtml(model: RolesModel, role: RoleId): string {
  const row = model.rows.find(r => r.id === role);
  if (!row) return '';
  const groups = new Map<string, RoleSwatchOption[]>();
  const starters: RoleSwatchOption[] = [];
  for (const s of model.options) {
    if (s.starter) { starters.push(s); continue; }
    const g = groupName(s.group ?? '') || t('Colours');
    const bucket = groups.get(g) ?? [];
    bucket.push(s);
    groups.set(g, bucket);
  }
  if (starters.length) groups.set(t('Starter'), starters);
  // A stand-in (row.selected is '') is named in the caption and never shown as a
  // pressed choice: nobody chose that colour.
  const current = row.selected;
  const sitting = model.options.find(s => s.key === current);
  const caption = sitting ? swatchText(sitting) : row.value;
  const sw = (s: RoleSwatchOption): string => `<button type="button" class="be-rolepick-sw" data-be-rolepick="${esc(s.key)}"
      style="--sw:${esc(s.hex)}" aria-pressed="${s.key === current}" aria-label="${esc(swatchText(s))}" title="${esc(swatchText(s))}"></button>`;
  const body = groups.size
    ? [...groups].map(([g, list]) => `<div class="be-rolepick-group">
        <p class="be-rolepick-glabel">${esc(g)}</p>
        <div class="be-rolepick-grid" role="group" aria-label="${esc(g)}">${list.map(sw).join('')}</div>
      </div>`).join('')
    : `<p class="be-rolepick-empty">${esc(t('Add a colour to the palette first.'))}</p>`;
  return `<div class="be-rolepick-head">
      <span class="be-rolepick-title">${esc(tRaw('Colour for {role}', { role: row.label }))}</span>
      <span class="be-rolepick-cap" data-be-rolepick-cap aria-live="polite">${esc(caption)}</span>
    </div>${body}`;
}

/** Arrow keys walk the swatches: left and right step, up and down move by the
 *  row the focused swatch sits in, Home and End jump to the ends. */
function wireArrows(el: HTMLElement): void {
  el.addEventListener('keydown', (e) => {
    const all = [...el.querySelectorAll<HTMLButtonElement>('[data-be-rolepick]')];
    const at = all.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    const grid = all[at]!.parentElement;
    const inGrid = grid ? [...grid.querySelectorAll<HTMLElement>('[data-be-rolepick]')] : [];
    const top = inGrid[0]?.offsetTop ?? 0;
    const cols = Math.max(1, inGrid.filter(b => b.offsetTop === top).length);
    const step: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols };
    let next = at;
    if (e.key in step) next = Math.min(all.length - 1, Math.max(0, at + step[e.key]!));
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = all.length - 1;
    else return;
    e.preventDefault();
    all[next]?.focus();
  });
}

export interface RoleChipsHandle {
  render: () => void;
  close: () => void;
  /** True while a chip's picker is open, so the room's own Escape ladder can
   *  leave the key to the picker, the innermost overlay. */
  isOpen: () => boolean;
  destroy: () => void;
}

/**
 * Render the chips into `mount` and wire them. `render()` is the room's resync
 * hook (it goes on the palette hooks, beside the full strip's). The picker is a
 * body popover anchored to whichever chip is CURRENT for its role, looked up
 * fresh, so a repaint under an open picker never strands it on a dead node.
 */
export function mountRoleChips(mount: HTMLElement, ctx: Omit<RolesCtx, 'clear' | 'ids'>): RoleChipsHandle {
  let popover: BodyPopoverHandle | null = null;
  let openRole: RoleId | null = null;
  const model = (): RolesModel => roleChipsModel(ctx.doc(), ctx.context(), ctx.swatches(), ctx.resolve);
  const chipFor = (role: RoleId): HTMLElement | null => mount.querySelector<HTMLElement>(`[data-be-rolechip="${role}"]`);

  const render = (): void => {
    const m = model();
    const focused = mount.contains(mount.ownerDocument.activeElement)
      ? (mount.ownerDocument.activeElement as HTMLElement).closest<HTMLElement>('[data-be-rolechip]')?.dataset.beRolechip ?? '' : '';
    mount.innerHTML = roleChipsHtml(m);
    if (openRole) chipFor(openRole)?.setAttribute('aria-expanded', 'true');
    if (focused) chipFor(focused as RoleId)?.focus();
  };

  const close = (): void => { popover?.close(); };

  const open = (role: RoleId): void => {
    popover?.close();
    openRole = role;
    const anchor: PopoverAnchor = {
      getBoundingClientRect: () => (chipFor(role) ?? mount).getBoundingClientRect(),
      contains: (node: Node | null) => !!chipFor(role)?.contains(node),
      focus: () => chipFor(role)?.focus({ preventScroll: true }),
      setAttribute: (name: string, value: string) => chipFor(role)?.setAttribute(name, value),
    };
    popover = mountBodyPopover(anchor, (el, pop) => {
      el.innerHTML = rolePickerHtml(model(), role);
      wireArrows(el);
      const cap = el.querySelector<HTMLElement>('[data-be-rolepick-cap]');
      const resting = cap?.textContent ?? '';
      const say = (btn: HTMLElement | null): void => { if (cap) cap.textContent = btn?.getAttribute('aria-label') ?? resting; };
      el.addEventListener('focusin', e => say((e.target as HTMLElement).closest<HTMLElement>('[data-be-rolepick]')));
      el.addEventListener('pointerover', e => say((e.target as HTMLElement).closest<HTMLElement>('[data-be-rolepick]')));
      el.addEventListener('click', (e) => {
        const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-be-rolepick]');
        const key = btn?.dataset.beRolepick;
        if (!key) return;
        pop.close(true);
        if (btn.getAttribute('aria-pressed') !== 'true') ctx.assign(role, key);
      });
      return el.querySelector<HTMLElement>('[data-be-rolepick][aria-pressed="true"]')
        ?? el.querySelector<HTMLElement>('[data-be-rolepick]');
    }, {
      className: 'folder-menu be-rolepick', role: 'dialog',
      ariaLabel: tRaw('Colour for {role}', { role: model().rows.find(r => r.id === role)?.label ?? role }),
      trackScroll: true, trackSize: true,
      position: placeBelow,
      onClose: () => { openRole = null; popover = null; },
    });
    popover.open();
  };

  const onClick = (e: Event): void => {
    const chip = (e.target as HTMLElement).closest<HTMLElement>('[data-be-rolechip]');
    const role = chip?.dataset.beRolechip as RoleId | undefined;
    if (!role || !ASSIGNABLE_ROLES.includes(role)) return;
    if (openRole === role && popover?.isOpen()) { popover.close(true); return; }
    open(role);
  };
  mount.addEventListener('click', onClick);
  render();
  return {
    render,
    close,
    isOpen: () => !!popover?.isOpen(),
    destroy: () => { mount.removeEventListener('click', onClick); close(); },
  };
}

/** Under the chip and aligned with its leading edge (a picker aligned to the
 *  far edge would sit two chips away from the first one), flipped above when the
 *  drop would leave the viewport, and clamped in. The panel is position: fixed
 *  (see .be-rolepick), so viewport space is its space. */
function placeBelow(el: HTMLDivElement, anchor: PopoverAnchor): void {
  const r = anchor.getBoundingClientRect();
  const M = 8;
  const vw = window.innerWidth, vh = window.innerHeight;
  const pw = el.offsetWidth, ph = el.offsetHeight;
  let top = r.bottom + M;
  if (ph > 0 && top + ph > vh - M) {
    const above = r.top - ph - M;
    top = above >= M ? above : Math.max(M, vh - ph - M);
  }
  const rtl = el.ownerDocument.defaultView?.getComputedStyle(el).direction === 'rtl';
  const left = Math.max(M, Math.min(rtl ? r.right - pw : r.left, vw - pw - M));
  el.style.top = `${Math.round(top)}px`;
  el.style.left = `${Math.round(left)}px`;
  el.style.right = 'auto';
}
