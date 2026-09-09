// SPDX-License-Identifier: MPL-2.0
/**
 * brand editor: palette multi-select, the bulk bar, groups and marquee.
 *
 * Every function takes the shared `bedit: BrandEditorCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `bedit.<module>.<fn>`. Extracted verbatim
 * from mountBrandEditor() by scripts/split-closure.ts.
 */
import { aliasPath } from '@lolly/engine';
import { addPaletteGroup, groupName, paletteGroups } from '../design-system/palette-groups.ts';
import { deleteSwatch, getExcludedSwatches, setSwatchExcluded, setSwatchGroup } from '../brand-doc.ts';
import type { BrandSwatch } from '../brand-doc.ts';
import { exportSwatches } from '../swatch-export.ts';
import type { SwatchExportFormat } from '../swatch-export.ts';
import { gradientAliasRefCount, materializeGradientAliases } from '../token-studio.ts';
import { saveBlob } from '../../pro/zip.ts';
import { t, tRaw } from '../../i18n.ts';
import { announce } from '../../a11y.ts';
import { playSfx } from '../sfx.ts';
import type { SelectTile } from '../design-system/palette-select.ts';
import { ROLE_IDS, assignRole, roleLabel } from '../design-system/roles.ts';
import type { RoleId } from '../design-system/roles.ts';
import { bindOp, type BrandEditorCtx } from './context.ts';

// Palette selection supports checkboxes, touch, marquee and keyboard gestures.
export const swKey = (_bedit: BrandEditorCtx, s: BrandSwatch): string => s.path.join('␟');
export const ownTileEls = (bedit: BrandEditorCtx, groupSel = ''): HTMLElement[] => { const { palMount } = bedit; return palMount
  ? [...palMount.querySelectorAll<HTMLElement>(`.be-pal-group${groupSel} [data-be-tile]`)]
  : []; };
export const keyOfTile = (bedit: BrandEditorCtx, el: HTMLElement): string | null => {
  const s = bedit.swatches[Number(el.dataset.beTile)];
  return s ? swKey(bedit, s) : null;
};
export const ownOrder = (bedit: BrandEditorCtx): string[] => ownTileEls(bedit).map(bedit.palSelect.keyOfTile).filter((k): k is string => !!k);
export const tileForKey = (bedit: BrandEditorCtx, key: string): HTMLElement | null => ownTileEls(bedit).find(el => keyOfTile(bedit, el) === key) ?? null;
/** The selected swatches in the pane's READING order, which is the order the
 *  bar's role walk and the copied list both follow. */
export const selectedSwatches = (bedit: BrandEditorCtx): BrandSwatch[] => {
  const { palSel } = bedit;
  const byKey = new Map(bedit.swatches.map(s => [swKey(bedit, s), s]));
  return palSel.keys().map(k => byKey.get(k)).filter((s): s is BrandSwatch => !!s);
};
export const closeBulkMenu = (bedit: BrandEditorCtx): void => {
  const { bulkbar } = bedit;
  if (!bulkbar) return;
  bedit.openBulkPanel = null;
  bulkbar.querySelectorAll<HTMLElement>('[data-be-bulk-panel]').forEach(p => { p.hidden = true; });
  bulkbar.querySelectorAll<HTMLElement>('[data-be-bulk-menu]').forEach(b => { b.setAttribute('aria-expanded', 'false'); });
};
export const syncPalSelect = (bedit: BrandEditorCtx): void => {
  const { bulkbar, palSel, root } = bedit;
  palSel.prune();
  const n = palSel.size();
  bedit.previewSelection = selectedSwatches(bedit).map(s => s.key);
  const source = bedit.ramps.$('[data-be-preview-source]');
  if (source) source.textContent = n ? tRaw('{n} selected', { n }) : t('Your palette');
  bedit.derive.renderPreviews();
  const order = ownOrder(bedit);
  if (bedit.palFocusKey && !order.includes(bedit.palFocusKey)) bedit.palFocusKey = null;
  const roving = bedit.palFocusKey ?? order[0] ?? null;
  for (const el of ownTileEls(bedit)) {
    const k = keyOfTile(bedit, el);
    if (!k) continue;
    const on = palSel.has(k);
    el.classList.toggle('is-multi', on);
    const check = el.closest('.be-pal-card')?.querySelector<HTMLInputElement>('[data-be-select]');
    if (check) check.checked = on;
    if (on) el.setAttribute('aria-pressed', 'true');
    else el.removeAttribute('aria-pressed');
    // One tab stop for the whole grid: Tab crosses it in a press and the
    // arrows do the walking inside it.
    el.tabIndex = k === roving ? 0 : -1;
  }
  if (bulkbar) {
    bulkbar.hidden = n === 0;
    if (n === 0) closeBulkMenu(bedit);
    const nEl = bulkbar.querySelector<HTMLElement>('[data-be-bulk-n]');
    if (nEl) nEl.textContent = n === 1 ? t('1 selected') : tRaw('{n} selected', { n });
    for (const id of ['move', 'role']) {
      const wrap = bulkbar.querySelector<HTMLElement>(`[data-be-bulk-wrap="${id}"]`);
      if (wrap) wrap.hidden = false;
    }
  }
  if (n) root.setAttribute('data-pal-selecting', '1');
  else root.removeAttribute('data-pal-selecting');
  dockBulkBar(bedit);
};
/**
 * Sit the bar on the palette pane's bottom edge where there IS a pane to sit
 * on - the ≥1100px split, whose width is a per-person number the divider
 * writes, so no stylesheet can know it. Below that (and on the phone, where
 * the bar rides the sheet's free edge) it stays the centred pill it was.
 */
export const dockBulkBar = (bedit: BrandEditorCtx): void => {
  const { bulkbar, root } = bedit;
  if (!bulkbar) return;
  const pane = root.querySelector<HTMLElement>('[data-be-split-side]');
  let wide = false;
  try { wide = !!window.matchMedia?.('(min-width: 1100px)').matches; } catch { /* no matchMedia - stay centred */ }
  const r = wide ? pane?.getBoundingClientRect() : null;
  if (!r?.width) { bulkbar.classList.remove('is-docked'); return; }
  bulkbar.style.setProperty('--be-bulk-left', `${Math.round(r.left)}px`);
  bulkbar.style.setProperty('--be-bulk-w', `${Math.round(r.width)}px`);
  bulkbar.style.setProperty('--be-bulk-bottom', `${Math.max(8, Math.round(window.innerHeight - r.bottom + 8))}px`);
  bulkbar.classList.add('is-docked');
};
export const onBulkResize = (bedit: BrandEditorCtx): void => {
  const { bulkbar } = bedit; if (!bulkbar?.hidden) dockBulkBar(bedit); };
/**
 * Hand focus back to the grid once the bulk bar has gone.
 *
 * Cancel and Delete both hide the bar that holds the button being pressed, so
 * without this the document's focus falls to `<body>` and a keyboard user
 * restarts from the top of the page. Only a bar that HELD focus hands it over
 * (`was` inside the bar) - plus the `<body>` case, which is both a Safari
 * click, where pressing a button never focuses it, and the state left behind
 * when a repaint has already detached whatever was focused. Focus that is
 * demonstrably somewhere else is left alone.
 *
 * The tile is re-queried each time: it lives in the grid, which the delete
 * path rebuilds, so a handle taken before the repaint would be a dead node.
 */
export const handBackPalFocus = (bedit: BrandEditorCtx, was: Element | null): void => {
  const { bulkbar } = bedit;
  if (was && was !== document.body && !bulkbar?.contains(was)) return;
  const order = ownOrder(bedit);
  const key = bedit.palFocusKey && order.includes(bedit.palFocusKey) ? bedit.palFocusKey : order[0];
  if (key) tileForKey(bedit, key)?.focus();
};
export const exitPalSelect = (bedit: BrandEditorCtx): void => {
  const { palSel } = bedit;
  if (!palSel.size()) return;
  const was = document.activeElement;
  palSel.clear(); syncPalSelect(bedit);
  handBackPalFocus(bedit, was);
};
// ── What the bar does ──────────────────────────────────────────────────────
// Every bulk write is ONE undo entry and one durable checkpoint: forty
// swatches moved with one press come back with one Ctrl-Z.
export const bulkWrite = (bedit: BrandEditorCtx, label: string, checkpoint: string, run: () => void): void => {
  bedit.state.pushUndo(label);
  bedit.state.ctxCheckpoint(checkpoint);
  run();
  closeBulkMenu(bedit);
  bedit.ramps.repaintPalette(); bedit.state.persist(true);
};
export const moveSelectionTo = (bedit: BrandEditorCtx, group: string): void => {
  const items = selectedSwatches(bedit);
  // The tag is stored theme-less by contract (see setSwatchGroup), so a live
  // heading loses its "· Light" before it is written.
  const name = group.replace(/\s*·.*$/, '').trim();
  if (!items.length || !name) return;
  bulkWrite(bedit, tRaw('Move {n} swatches', { n: items.length }), t('Before moving swatches'), () => {
    addPaletteGroup(bedit.doc, name);
    for (const s of items) setSwatchGroup(bedit.doc, s.path, name);
  });
  announce(`${tRaw('{n} moved to {group}.', { n: items.length, group: name })} ${t('Undo with Control Z.')}`);
};
/** Walk the selection onto consecutive roles from the one that was chosen, so
 *  a four-tile selection can take all four in one press. A role's own alias
 *  tile cannot take a role (the alias would chain), so those sit it out. */
export const giveSelectionRoles = (bedit: BrandEditorCtx, from: RoleId): void => {
  const items = selectedSwatches(bedit).filter(s => s.kind !== 'semantic');
  const start = ROLE_IDS.indexOf(from);
  if (!items.length || start < 0) return;
  const pairs = items.slice(0, ROLE_IDS.length - start).map((s, i) => ({ s, role: ROLE_IDS[start + i]! }));
  bulkWrite(bedit, tRaw('Give {n} swatches a role', { n: pairs.length }), t('Before assigning roles'), () => {
    for (const p of pairs) assignRole(bedit.doc, p.role, p.s.key, bedit.addColor.roleTheme());
  });
  const said = pairs.map(p => tRaw('{role} is now {name}', { role: roleLabel(p.role), name: p.s.name })).join(' ');
  const spare = items.length - pairs.length;
  const left = spare > 0 ? ` ${tRaw('{n} colours had no role left to take.', { n: spare })}` : '';
  announce(`${said}${left} ${t('Undo with Control Z.')}`);
};
export const downloadSelection = async (bedit: BrandEditorCtx, format: SwatchExportFormat): Promise<void> => {
  const { palErr } = bedit;
  const items = selectedSwatches(bedit);
  if (!items.length) return;
  closeBulkMenu(bedit);
  if (palErr) palErr.hidden = true;
  try {
    const fonts = format === 'tokens-json' ? await bedit.pack.exportFonts() : undefined;
    const { blob, filename } = exportSwatches(items, format, undefined, fonts?.length ? { fonts } : undefined);
    await saveBlob(blob, filename);
    announce(tRaw('{n} colours downloaded as {filename}', { n: items.length, filename }));
  } catch (err) {
    if (palErr) { palErr.textContent = String((err as { message?: unknown })?.message ?? err); palErr.hidden = false; }
  }
};
export const copySelectionValues = (bedit: BrandEditorCtx): void => {
  const { host } = bedit;
  const items = selectedSwatches(bedit);
  if (!items.length) return;
  closeBulkMenu(bedit);
  // The STORED notation - what the document holds and what a person pasting it
  // back would type. An alias has no notation of its own, so it copies as the
  // hex it currently resolves to.
  const text = items.map(s => (s.isAlias ? s.hex : s.raw)).filter(Boolean).join('\n');
  void Promise.resolve(host.clipboard?.writeText?.(text)).then(
    () => announce(items.length === 1
      ? tRaw('Copied {value}', { value: text })
      : tRaw('{n} colours copied', { n: items.length })),
    () => announce(t('Copy failed - your browser blocked clipboard access'), { assertive: true }),
  );
};
/** The Move-to menu's rows: every heading the pane is showing right now, plus
 *  the door to a new one. Built at open time with textContent because the
 *  names are the person's own group headings. */
export const fillMoveMenu = (bedit: BrandEditorCtx, panel: HTMLElement): void => {
  panel.textContent = '';
  const stems: string[] = [...paletteGroups(bedit.doc)];
  for (const el of ownTileEls(bedit)) {
    const stem = (el.closest<HTMLElement>('.be-pal-group')?.dataset.beGroup ?? '').replace(/\s*·.*$/, '').trim();
    if (stem && !stems.includes(stem)) stems.push(stem);
  }
  for (const stem of stems) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'be-bulkbar-item';
    b.dataset.beBulkMove = stem;
    b.textContent = stem;
    panel.append(b);
  }
  const fresh = document.createElement('button');
  fresh.type = 'button';
  fresh.className = 'be-bulkbar-item';
  fresh.dataset.beBulkMoveNew = '1';
  fresh.textContent = t('New group…');
  panel.append(fresh);
};
/** "New group…" asks for the name in the menu itself rather than in a prompt
 *  the person has to leave the selection to answer. */
export const askNewGroup = (bedit: BrandEditorCtx, panel: HTMLElement): void => {
  panel.textContent = '';
  const form = document.createElement('form');
  form.className = 'be-bulkbar-newgroup';
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'field-input be-bulkbar-newname';
  input.maxLength = 60;
  input.autocomplete = 'off';
  input.placeholder = t('Group name');
  input.setAttribute('aria-label', t('New group name'));
  const go = document.createElement('button');
  go.type = 'submit';
  go.className = 'be-bulkbar-item';
  go.textContent = t('Move');
  form.append(input, go);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (input.value.trim()) moveSelectionTo(bedit, input.value);
    else input.focus();
  });
  panel.append(form);
  input.focus();
};
export const openBulkMenu = (bedit: BrandEditorCtx, id: string): void => {
  const { bulkbar } = bedit;
  if (!bulkbar) return;
  const wasOpen = bedit.openBulkPanel === id;
  closeBulkMenu(bedit);
  if (wasOpen) return;
  const panel = bulkbar.querySelector<HTMLElement>(`[data-be-bulk-panel="${id}"]`);
  const btn = bulkbar.querySelector<HTMLElement>(`[data-be-bulk-menu="${id}"]`);
  if (!panel || !btn) return;
  if (id === 'move') fillMoveMenu(bedit, panel);
  panel.hidden = false;
  btn.setAttribute('aria-expanded', 'true');
  bedit.openBulkPanel = id;
  panel.querySelector<HTMLElement>('button, input')?.focus();
};
export const deleteSelection = (bedit: BrandEditorCtx): void => {
  const items = selectedSwatches(bedit);
  if (!items.length) return;
  const refs = items.reduce((n, s) => n + (s.kind !== 'ramp' && s.kind !== 'semantic' && s.deletable ? gradientAliasRefCount(bedit.doc, s.key) : 0), 0);
  bedit.state.pushUndo(items.length === 1 ? tRaw('Delete {name}', { name: items[0]!.name }) : tRaw('Delete {n} swatches', { n: items.length }));
  bedit.state.ctxCheckpoint(t('Before removing swatches'));
  let removed = 0;
  for (const s of items) {
    if (!s.deletable || bedit.ramps.isStarterSwatch(s) || s.kind === 'ramp' || s.kind === 'semantic') { setSwatchExcluded(bedit.doc, s.key, true); removed++; continue; }
    if (!s.deletable) continue;
    if (gradientAliasRefCount(bedit.doc, s.key)) materializeGradientAliases(bedit.doc, ref => aliasPath(ref) === s.key, () => s.hex || null);
    deleteSwatch(bedit.doc, s.path); removed++;
  }
  exitPalSelect(bedit); closeBulkMenu(bedit); bedit.swatchEditor.closeEditor(); bedit.ramps.repaintPalette(); bedit.state.persist(true);
  // The repaint rebuilt the grid, and with it the tile exitPalSelect had
  // just focused - so the handoff is repeated against the live one.
  handBackPalFocus(bedit, document.activeElement);
  const gone = removed === 1 ? t('1 swatch removed') : tRaw('{n} swatches removed', { n: removed });
  // Selection reaches every own tile now, so a selection can hold a swatch
  // this room does not remove (a token an import brought in read-only). Say
  // so rather than quietly dropping it from the count.
  const held = items.length - removed;
  const kept = held > 0 ? ` ${tRaw('{n} were kept - they are not this room to remove.', { n: held })}` : '';
  const stops = refs === 0 ? ''
    : refs === 1 ? ` ${t('1 gradient stop keeps its colour as a fixed value.')}`
      : ` ${tRaw('{refs} gradient stops keep their colour as a fixed value.', { refs })}`;
  announce(`${gone}${kept}${stops} ${t('Undo with Control Z.')}`);
};
export const marqueeTiles = (bedit: BrandEditorCtx): SelectTile[] => ownTileEls(bedit, '[open]').flatMap((el) => {
  const k = keyOfTile(bedit, el);
  if (!k) return [];
  const r = el.getBoundingClientRect();
  return [{ key: k, rect: { left: r.left, top: r.top, right: r.right, bottom: r.bottom } }];
});
export const endMarquee = (bedit: BrandEditorCtx): void => {
  const { palMount } = bedit;
  bedit.marqueeEl?.remove();
  bedit.marqueeEl = null; bedit.marqueeFrom = null; bedit.marqueeMoved = false;
  palMount?.classList.remove('is-marqueeing');
};
export const finishPalPointer = (bedit: BrandEditorCtx, e: PointerEvent): void => {
  const { palMount, palSel } = bedit;
  clearTimeout(bedit.longPressTimer); bedit.longPressFrom = null;
  if (!bedit.marqueeFrom) return;
  const moved = bedit.marqueeMoved;
  try { palMount?.releasePointerCapture(e.pointerId); } catch { /* already released */ }
  endMarquee(bedit);
  // A press on empty space that never became a drag drops the selection - the
  // same gesture every file manager answers to.
  if (!moved && palSel.size()) { palSel.clear(); syncPalSelect(bedit); }
};
export function wireBulkBar(bedit: BrandEditorCtx): void {
  const { bulkbar } = bedit;
  bulkbar?.addEventListener('click', (e) => {
    const el = e.target as HTMLElement;
    const menu = el.closest<HTMLElement>('[data-be-bulk-menu]');
    if (menu) { bedit.palSelect.openBulkMenu(menu.dataset.beBulkMenu ?? ''); return; }
    const move = el.closest<HTMLElement>('[data-be-bulk-move]');
    if (move) { bedit.palSelect.moveSelectionTo(move.dataset.beBulkMove ?? ''); return; }
    if (el.closest('[data-be-bulk-move-new]')) {
      const panel = bulkbar.querySelector<HTMLElement>('[data-be-bulk-panel="move"]');
      if (panel) bedit.palSelect.askNewGroup(panel);
      return;
    }
    const role = el.closest<HTMLElement>('[data-be-bulk-role]');
    if (role) { bedit.palSelect.giveSelectionRoles(role.dataset.beBulkRole as RoleId); return; }
    const dl = el.closest<HTMLElement>('[data-be-bulk-dl]');
    if (dl) { void bedit.palSelect.downloadSelection(dl.dataset.beBulkDl as SwatchExportFormat); return; }
    if (el.closest('[data-be-bulk-copy]')) bedit.palSelect.copySelectionValues();
  });
  // No confirm dialog: undo is the safety net (plan 97 section 3 principle 3). The
  // gradient-stop side effect moves from a pre-hoc warning to a post-hoc
  // statement, and the per-swatch semantics are byte-for-byte what they were.
  bulkbar?.querySelector<HTMLElement>('[data-be-bulk-del]')?.addEventListener('click', () => {
    bedit.palSelect.deleteSelection();
  });
}

export function seedMarquee(bedit: BrandEditorCtx): void {
  const { cleanups } = bedit;
  // ── Marquee, and the touch gesture that stands in for it ───────────────────
  // Drag on the pane's empty space and every tile the rectangle touches joins
  // the selection, across group boundaries. Pure geometry over
  // getBoundingClientRect(), no library. The rectangle is one absolutely
  // positioned div inside `.be-pal` (which is position: relative for exactly
  // this), so it scrolls with the tiles and paints under the swatch popover,
  // which is a sibling of the pane at z 30.
  //
  // Tiles come from the OPEN groups only: a folded <details> contributes none,
  // which is what stops a sweep collecting colours nobody can see.
  //
  // TOUCH HAS NO MARQUEE. A drag on a phone is the pane scrolling, so a long
  // press on a tile starts the selection instead and every later tap toggles;
  // the per-group "Select all" carries the rest.
  const DRAG_SLOP = 4; bedit.DRAG_SLOP = DRAG_SLOP;
  const LONG_PRESS_MS = 500; bedit.LONG_PRESS_MS = LONG_PRESS_MS;
  bedit.lastPointerType = '';
  /** A long press has just made a selection - swallow the click it turns into,
   *  or the tap that started the selection immediately undoes it. */
  bedit.swallowTileClick = false;
  // bedit.longPressTimer: assigned later
  bedit.longPressFrom = null;
  bedit.marqueeEl = null;
  bedit.marqueeFrom = null;
  bedit.marqueeBase = [];
  bedit.marqueeMoved = false;
  cleanups.push(() => clearTimeout(bedit.longPressTimer));
}

export function wireMarquee(bedit: BrandEditorCtx): void {
  const { DRAG_SLOP, LONG_PRESS_MS, cleanups, palMount, palSel } = bedit;
  cleanups.push(bedit.palSelect.endMarquee);

  palMount?.addEventListener('pointerdown', (e) => {
    bedit.lastPointerType = e.pointerType;
    // A press that never became a click (a long press then a scroll) must not
    // leave the swallow armed for whatever is pressed next.
    bedit.swallowTileClick = false;
    clearTimeout(bedit.longPressTimer); bedit.longPressFrom = null;
    const el = e.target as HTMLElement;
    const tile = el.closest<HTMLElement>('[data-be-tile]');
    if (tile) {
      if (e.pointerType !== 'touch' || palSel.size()) return;
      const k = bedit.palSelect.keyOfTile(tile);
      if (!k) return;
      bedit.longPressFrom = { x: e.clientX, y: e.clientY };
      bedit.longPressTimer = setTimeout(() => {
        bedit.longPressFrom = null;
        bedit.swallowTileClick = true;
        bedit.palFocusKey = k;
        palSel.toggle(k);
        bedit.palSelect.syncPalSelect();
        playSfx('click');
      }, LONG_PRESS_MS);
      return;
    }
    if (e.button !== 0 || e.pointerType === 'touch' || !palMount) return;
    // The pane's own empty space only - a group head, a disclosure or a button
    // is a control, not canvas.
    if (el.closest('button, a, input, select, label, summary, .be-pal-group-note')) return;
    e.preventDefault(); // no text selection dragging along behind the rectangle
    bedit.marqueeBase = (e.shiftKey || e.metaKey || e.ctrlKey) ? palSel.keys() : [];
    const pr = palMount.getBoundingClientRect();
    bedit.marqueeFrom = { x: e.clientX - pr.left, y: e.clientY - pr.top };
    bedit.marqueeMoved = false;
    try { palMount.setPointerCapture(e.pointerId); } catch { /* capture is a nicety, not the gesture */ }
  });

  palMount?.addEventListener('pointermove', (e) => {
    if (bedit.longPressFrom
      && (Math.abs(e.clientX - bedit.longPressFrom.x) > DRAG_SLOP || Math.abs(e.clientY - bedit.longPressFrom.y) > DRAG_SLOP)) {
      clearTimeout(bedit.longPressTimer); bedit.longPressFrom = null; // a scroll, not a press
    }
    if (!bedit.marqueeFrom || !palMount) return;
    // Measured fresh every move: the pane's scroller can move under the drag,
    // and the anchor is held in pane-local coordinates so it stays on the tile
    // it started beside rather than on a point of the viewport.
    const pr = palMount.getBoundingClientRect();
    const x = e.clientX - pr.left, y = e.clientY - pr.top;
    if (!bedit.marqueeMoved) {
      if (Math.abs(x - bedit.marqueeFrom.x) < DRAG_SLOP && Math.abs(y - bedit.marqueeFrom.y) < DRAG_SLOP) return;
      bedit.marqueeMoved = true;
      bedit.marqueeEl = document.createElement('div');
      bedit.marqueeEl.className = 'be-marquee';
      palMount.append(bedit.marqueeEl);
      palMount.classList.add('is-marqueeing');
    }
    const left = Math.min(x, bedit.marqueeFrom.x), top = Math.min(y, bedit.marqueeFrom.y);
    const w = Math.abs(x - bedit.marqueeFrom.x), h = Math.abs(y - bedit.marqueeFrom.y);
    if (bedit.marqueeEl) {
      bedit.marqueeEl.style.left = `${left}px`; bedit.marqueeEl.style.top = `${top}px`;
      bedit.marqueeEl.style.width = `${w}px`; bedit.marqueeEl.style.height = `${h}px`;
    }
    palSel.marquee(
      { left: pr.left + left, top: pr.top + top, right: pr.left + left + w, bottom: pr.top + top + h },
      bedit.palSelect.marqueeTiles(), bedit.marqueeBase,
    );
    bedit.palSelect.syncPalSelect();
  });
}

export function wirePalettePointer(bedit: BrandEditorCtx): void {
  const { palMount, palSel } = bedit;
  palMount?.addEventListener('pointerup', bedit.palSelect.finishPalPointer);
  palMount?.addEventListener('pointercancel', bedit.palSelect.finishPalPointer);

  palMount?.addEventListener('change', e => {
    const checkbox = (e.target as HTMLElement).closest<HTMLInputElement>('[data-be-select]');
    if (!checkbox) return;
    const s = bedit.swatches[Number(checkbox.dataset.beSelect)];
    if (s) { palSel.toggle(bedit.palSelect.swKey(s)); bedit.palSelect.syncPalSelect(); }
  });
  palMount?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.closest('.be-pal-check')) return;
    if (target.closest('[data-be-hide-starter]')) {
      e.preventDefault(); bedit.state.pushUndo(t('Hide starter colours'));
      for (const swatch of bedit.swatches.filter(s => s.kind !== 'semantic' && bedit.ramps.isStarterSwatch(s) && !paletteGroups(bedit.doc).includes(groupName(s.group)))) setSwatchExcluded(bedit.doc, swatch.key, true);
      bedit.ramps.repaintPalette(); bedit.state.persist(true); return;
    }
    if (target.closest('[data-be-restore]')) {
      bedit.state.pushUndo(t('Restore hidden colours'));
      for (const key of getExcludedSwatches(bedit.doc)) setSwatchExcluded(bedit.doc, key, false);
      bedit.ramps.repaintPalette(); bedit.state.persist(true); return;
    }
    if (bedit.swallowTileClick) { bedit.swallowTileClick = false; e.preventDefault(); return; }
    const all = (e.target as HTMLElement).closest<HTMLElement>('[data-be-pal-all]');
    if (all) {
      // It sits in a <summary>, so the default toggle has to be swallowed or
      // selecting a section folds it away under the selection.
      e.preventDefault();
      const g = all.dataset.bePalAll ?? '';
      // Matched in JS rather than through a selector: a heading is the person's
      // own text and may hold anything a CSS attribute selector would need
      // escaping for.
      const keys = bedit.palSelect.ownTileEls()
        .filter(el => (el.closest<HTMLElement>('.be-pal-group')?.dataset.beGroup ?? '') === g)
        .map(bedit.palSelect.keyOfTile).filter((k): k is string => !!k);
      palSel.allInGroup(keys);
      bedit.palSelect.syncPalSelect();
      return;
    }
    const add = (e.target as HTMLElement).closest<HTMLElement>('[data-be-add]');
    if (add) {
      // Group Adds live inside a <summary> - swallow the default toggle so
      // adding a swatch never folds the section it ends up in.
      e.preventDefault();
      bedit.swatchEditor.openPickCard(add, null);
      bedit.pickGroup = add.dataset.beAddGroup;

      return;
    }
    const tileEl = (e.target as HTMLElement).closest<HTMLElement>('[data-be-tile]');
    if (!tileEl) return;
    const tIdx = Number(tileEl.dataset.beTile);
    const s = bedit.swatches[tIdx];
    const k = s ? bedit.palSelect.swKey(s) : null;
    const own = !!k;
    if (own && k) {
      bedit.palFocusKey = k;
      if (e.metaKey || e.ctrlKey) { palSel.toggle(k); bedit.palSelect.syncPalSelect(); return; }
      if (e.shiftKey) { palSel.range(palSel.anchor() ?? k, k); bedit.palSelect.syncPalSelect(); return; }
      // On a touch screen there is no marquee and no modifier key, so once a
      // long press has started a selection a tap adds and removes. With a
      // pointer, a plain click still opens the editor exactly as it always did,
      // and drops the selection on the way in.
      if (bedit.lastPointerType === 'touch' && palSel.size()) { palSel.toggle(k); bedit.palSelect.syncPalSelect(); return; }
      if (palSel.size()) { palSel.clear(); bedit.palSelect.syncPalSelect(); }
    }
    bedit.swatchEditor.openEditor(tIdx, tileEl);
  });
}

export function palSelectOps(bedit: BrandEditorCtx) {
  return {
    swKey: bindOp(bedit, swKey),
    ownTileEls: bindOp(bedit, ownTileEls),
    keyOfTile: bindOp(bedit, keyOfTile),
    ownOrder: bindOp(bedit, ownOrder),
    tileForKey: bindOp(bedit, tileForKey),
    selectedSwatches: bindOp(bedit, selectedSwatches),
    closeBulkMenu: bindOp(bedit, closeBulkMenu),
    syncPalSelect: bindOp(bedit, syncPalSelect),
    dockBulkBar: bindOp(bedit, dockBulkBar),
    onBulkResize: bindOp(bedit, onBulkResize),
    handBackPalFocus: bindOp(bedit, handBackPalFocus),
    exitPalSelect: bindOp(bedit, exitPalSelect),
    bulkWrite: bindOp(bedit, bulkWrite),
    moveSelectionTo: bindOp(bedit, moveSelectionTo),
    giveSelectionRoles: bindOp(bedit, giveSelectionRoles),
    downloadSelection: bindOp(bedit, downloadSelection),
    copySelectionValues: bindOp(bedit, copySelectionValues),
    fillMoveMenu: bindOp(bedit, fillMoveMenu),
    askNewGroup: bindOp(bedit, askNewGroup),
    openBulkMenu: bindOp(bedit, openBulkMenu),
    deleteSelection: bindOp(bedit, deleteSelection),
    marqueeTiles: bindOp(bedit, marqueeTiles),
    endMarquee: bindOp(bedit, endMarquee),
    finishPalPointer: bindOp(bedit, finishPalPointer),
    wireBulkBar: bindOp(bedit, wireBulkBar),
    seedMarquee: bindOp(bedit, seedMarquee),
    wireMarquee: bindOp(bedit, wireMarquee),
    wirePalettePointer: bindOp(bedit, wirePalettePointer),
  };
}
