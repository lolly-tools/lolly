// SPDX-License-Identifier: MPL-2.0
/** Artboard and group branches keep stable rows; large expanded trees mount a row window. */
import type { Box } from './free-canvas-math.ts';
import { navigatorWindow } from './design-navigator-window.ts';
import { tRaw as t } from '../i18n.ts';

/** Reorder displayed members in their existing slots, preserving collapsed siblings. */
export function mergeLayerOrder(all: string[], ordered: string[]): string[] {
  const members = new Set(ordered), remaining = ordered.filter(id => all.includes(id));
  let index = 0;
  return all.map(id => members.has(id) ? remaining[index++]! : id);
}

export function mountLayerGroups(opts: {
  host: HTMLElement; pages: HTMLElement; section: HTMLElement; list: HTMLElement; heading: HTMLElement;
  id(box: Box): string; name(box: Box, index: number): string; children(box: Box): Box[];
  row(box: Box, index: number, loose: boolean, list: HTMLElement): HTMLElement;
  group(box: Box): string; select(ids: string[]): void; jump(id: string): void;
}) {
  const expanded = new Map<string, boolean>(), objectExpanded = new Map<string, boolean>();
  const objectMembers = new WeakMap<HTMLElement, string[]>();
  const rows = new Map<string, { box: Box; index: number; loose: boolean; list: HTMLElement; node: HTMLElement }>();
  const branches = new Map<string, { details: HTMLDetailsElement; list: HTMLElement; summary: HTMLElement; signature: string; paint: () => void }>();
  let mode: 'layers' | 'artboards' = 'layers', active = '', chosen: string[] = [], hasFrames = false, hasLayers = false;
  let currentFrames: Box[] = [], currentLoose: Box[] = [], disposed = false;
  let membersByOwner = new Map<string, Box[]>(), explicitIds = new Set<string>();
  const scroll = { layers: 0, artboards: 0 };
  const switcher = document.createElement('div'); switcher.className = 'fc-nav-modes';
  switcher.setAttribute('role', 'group'); switcher.setAttribute('aria-label', t('Navigator view'));
  const buttons = new Map<string, HTMLButtonElement>();
  function applyMode(): void {
    opts.pages.hidden = mode !== 'artboards' || !hasFrames;
    opts.section.hidden = mode !== 'layers' || !hasLayers;
    switcher.hidden = !hasFrames;
    for (const [key, button] of buttons) button.setAttribute('aria-pressed', String(mode === key));
  }
  for (const [key, label] of [['layers', 'Layers'], ['artboards', 'Artboards']] as const) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'btn btn--ghost btn--sm'; button.textContent = t(label);
    button.onclick = () => { if (mode === key) return; scroll[mode] = opts.host.scrollTop; mode = key; applyMode(); opts.host.scrollTop = scroll[mode]; };
    buttons.set(key, button); switcher.append(button);
  }
  opts.host.prepend(switcher); opts.heading.hidden = true;
  opts.list.setAttribute('role', 'region'); opts.list.setAttribute('aria-label', t('Document layers')); opts.list.removeAttribute('aria-multiselectable');
  function row(box: Box, index: number, loose: boolean, list: HTMLElement): HTMLElement {
    const id = opts.id(box), cached = rows.get(id);
    if (cached?.box === box && cached.index === index && cached.loose === loose && cached.list === list) return cached.node;
    const node = opts.row(box, index, loose, list); rows.set(id, { box, index, loose, list, node });
    if (rows.size > 256) {
      const oldest = [...rows].find(([key, value]) => key !== id && !value.node.isConnected)?.[0];
      if (oldest) rows.delete(oldest);
    }
    return node;
  }
  function replace(list: HTMLElement, nodes: HTMLElement[]): void {
    let previous: ChildNode | null = null;
    for (const node of nodes) {
      const following: ChildNode | null = previous ? previous.nextSibling : list.firstChild;
      if (following !== node) list.insertBefore(node, following);
      previous = node;
    }
    while (previous ? previous.nextSibling : list.firstChild) (previous ? previous.nextSibling : list.firstChild)!.remove();
  }
  function branch(key: string, id: string, name: string, members: Box[], parent: string, explicit: Box | null, loose: boolean, defaultOpen: boolean, ancestors: Set<string> = new Set()): HTMLElement {
    let cached = branches.get(key);
    if (!cached) {
      const details = document.createElement('details'); details.className = `fc-nav-group${explicit || key.startsWith('legacy:') ? ' fc-nav-object-group' : ''}`;
      const summary = document.createElement('summary'), list = document.createElement('div'); list.className = 'fc-nav-group-children';
      list.setAttribute('role', 'listbox'); list.setAttribute('aria-multiselectable', 'true'); list.dataset.layerGroup = id;
      details.append(summary, list); cached = { details, summary, list, signature: '', paint: () => {} }; branches.set(key, cached);
      details.addEventListener('toggle', () => { if (!details.isConnected || disposed) return; (key.startsWith('frame:') ? expanded : objectExpanded).set(key, details.open); cached!.paint(); });
      summary.addEventListener('keydown', event => {
        if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
        event.preventDefault(); event.stopPropagation(); details.open = event.key === 'ArrowRight';
        (key.startsWith('frame:') ? expanded : objectExpanded).set(key, details.open); cached!.paint();
        if (details.open) list.querySelector<HTMLElement>('[data-nav-row]')?.focus(); else summary.focus();
      });
      list.addEventListener('keydown', event => {
        if (event.key !== 'ArrowLeft' || event.altKey || event.ctrlKey || event.metaKey) return;
        const target = event.target as Element;
        if (target.closest('summary')) return;
        event.preventDefault(); event.stopPropagation();
        (target.closest('.fc-nav-object-group')?.querySelector<HTMLElement>('summary') ?? summary).focus();
      }, true);
    }
    const { details, summary, list } = cached;
    const memo = key.startsWith('frame:') ? expanded : objectExpanded;
    details.open = memo.get(key) ?? defaultOpen;
    if (key.startsWith('frame:')) details.dataset.artboard = id; else details.dataset.objectGroup = id;
    objectMembers.set(details, explicit ? [id, ...members.map(opts.id)] : members.map(opts.id));
    const signature = `${name}|${members.length}|${explicit ? JSON.stringify(explicit) : ''}`;
    if (cached.signature !== signature) {
      cached.signature = signature;
      if (explicit) summary.replaceChildren(row(explicit, 0, loose, list));
      else {
        const jump = document.createElement('button'); jump.type = 'button'; jump.className = 'btn btn--ghost fc-nav-group-jump'; jump.textContent = name;
        if (key.startsWith('frame:')) { jump.dataset.jumpArtboard = id; jump.title = t('Go to {name}', { name }); jump.onclick = event => { event.preventDefault(); event.stopPropagation(); expanded.set(key, true); details.open = true; cached!.paint(); opts.jump(id); }; }
        else jump.onclick = event => { event.preventDefault(); event.stopPropagation(); if (parent) opts.jump(parent); opts.select(members.map(opts.id)); };
        const count = document.createElement('span'); count.className = 'chip chip--count'; count.textContent = String(members.length); count.setAttribute('aria-label', t('{n} layers', { n: members.length }));
        summary.replaceChildren(jump, count);
      }
    }
    list.setAttribute('aria-label', t('{name} layers', { name }));
    const path = new Set([...ancestors, id]);
    cached.paint = () => { if (details.open) paintLayers(members, list, parent, loose, path); else list.replaceChildren(); paintActive(active, chosen); };
    cached.paint(); return details;
  }
  function paintLayers(boxes: Box[], list: HTMLElement, parent: string, loose: boolean, seen: Set<string>): void {
    const grouped = new Map<string, Box[]>();
    for (const box of boxes) {
      const id = opts.group(box); if (!id) continue;
      const members = grouped.get(id) ?? []; members.push(box); grouped.set(id, members);
    }
    const nodes: HTMLElement[] = [], painted = new Set<string>();
    for (const [index, box] of boxes.entries()) {
      const owner = opts.group(box), id = opts.id(box);
      if (owner && explicitIds.has(owner) && !seen.has(owner)) continue;
      if (owner && !explicitIds.has(owner) && !seen.has(owner)) {
        if (painted.has(owner)) continue; painted.add(owner);
        nodes.push(branch(`legacy:${parent}:${owner}`, owner, t('Group {n}', { n: [...grouped.keys()].indexOf(owner) + 1 }), grouped.get(owner)!, parent, null, loose, true, seen));
      } else if (box.kind === 'group' && !seen.has(id) && seen.size < 64) {
        const members = membersByOwner.get(id) ?? [];
        nodes.push(branch(`group:${id}`, id, String(box.name || t('Group')), members, parent, box, loose, true, seen));
      } else nodes.push(row(box, index, loose, list));
    }
    replace(list, nodes);
  }
  type TreeEntry = { box: Box; index: number; depth: number; branch: boolean; loose: boolean };
  function flattened(): TreeEntry[] {
    const entries: TreeEntry[] = [], visited = new Set<string>();
    function walk(box: Box, index: number, depth: number, loose: boolean): void {
      const id = opts.id(box); if (visited.has(id) || depth > 64) return; visited.add(id);
      const children = box.kind === 'frame' ? opts.children(box).slice().reverse() : membersByOwner.get(id) ?? [];
      const isBranch = box.kind === 'frame' || box.kind === 'group';
      entries.push({ box, index, depth, branch: isBranch, loose });
      const key = `${box.kind === 'frame' ? 'frame' : 'group'}:${id}`;
      if (!isBranch || !(box.kind === 'frame' ? expanded.get(key) ?? id === active : objectExpanded.get(key) ?? true)) return;
      for (const [childIndex, child] of children.entries()) if (!opts.group(child) || opts.group(child) === id || !explicitIds.has(opts.group(child))) walk(child, childIndex, depth + 1, loose);
    }
    currentFrames.forEach((box, index) => { walk(box, index, 0, false); });
    currentLoose.forEach((box, index) => { if (!opts.group(box) || !explicitIds.has(opts.group(box))) walk(box, index, 0, true); });
    return entries;
  }
  const windowed = navigatorWindow(opts.list, (entry: TreeEntry) => {
    const node = row(entry.box, entry.index, entry.loose, opts.list); node.style.paddingInlineStart = `${entry.depth * 14}px`;
    node.dataset.treeDepth = String(entry.depth);
    if (entry.branch) {
      const id = opts.id(entry.box), key = `${entry.box.kind === 'frame' ? 'frame' : 'group'}:${id}`;
      const toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'fc-nav-tree-toggle'; toggle.textContent = '›';
      const open = entry.box.kind === 'frame' ? expanded.get(key) ?? id === active : objectExpanded.get(key) ?? true;
      toggle.setAttribute('aria-label', open ? t('Collapse group') : t('Expand group')); toggle.setAttribute('aria-expanded', String(open));
      toggle.onclick = event => { event.stopPropagation(); (entry.box.kind === 'frame' ? expanded : objectExpanded).set(key, !open); windowed.set(flattened()); paintActive(active, chosen); };
      node.querySelector('[data-tree-toggle]')?.remove(); toggle.dataset.treeToggle = ''; node.prepend(toggle);
    }
    return node;
  });
  function render(frames: Box[], loose: Box[], nextActive: string): void {
    if (nextActive !== active && nextActive) expanded.set(`frame:${nextActive}`, true);
    active = nextActive; currentFrames = frames; currentLoose = loose; hasFrames = frames.length > 0; hasLayers = hasFrames || loose.length > 0;
    opts.heading.textContent = t(hasFrames ? 'Layers' : 'Loose layers'); opts.heading.hidden = hasFrames;
    const all = [...frames, ...frames.flatMap(opts.children), ...loose], known = new Set(all.map(opts.id));
    membersByOwner = new Map(); explicitIds = new Set(all.filter(box => box.kind === 'group').map(opts.id));
    const scanned = new Set<string>();
    for (const box of all) {
      const id = opts.id(box); if (scanned.has(id)) continue; scanned.add(id);
      const owner = opts.group(box); if (!owner) continue;
      const members = membersByOwner.get(owner) ?? []; members.push(box); membersByOwner.set(owner, members);
    }
    for (const members of membersByOwner.values()) members.reverse();
    for (const id of rows.keys()) if (!known.has(id)) rows.delete(id);
    for (const [key, cached] of branches) if (!known.has(cached.details.dataset.artboard || cached.details.dataset.objectGroup || '') && !key.startsWith('legacy:')) branches.delete(key);
    if (all.length > 240) windowed.set(flattened());
    else {
      windowed.reset();
      const nodes = frames.map((frame, index) => branch(`frame:${opts.id(frame)}`, opts.id(frame), opts.name(frame, index), opts.children(frame).slice().reverse(), opts.id(frame), null, false, opts.id(frame) === active));
      if (loose.length) {
        let list = opts.list.querySelector<HTMLElement>('[data-loose-layers]');
        if (!list) { list = document.createElement('div'); list.dataset.looseLayers = ''; list.className = 'fc-nav-group-children'; list.dataset.layerGroup = ''; list.setAttribute('role', 'listbox'); list.setAttribute('aria-label', t('Loose layers')); }
        paintLayers(loose.slice().reverse(), list, '', true, new Set()); nodes.push(list);
      }
      replace(opts.list, nodes);
    }
    applyMode(); paintActive(nextActive, chosen);
  }
  function paintActive(id: string, selected: string[]): void {
    chosen = selected; const chosenSet = new Set(selected);
    for (const group of opts.list.querySelectorAll<HTMLElement>('[data-artboard]')) {
      const current = group.dataset.artboard === id; group.classList.toggle('is-active-board', current);
      const button = group.querySelector('button'); if (current) button?.setAttribute('aria-current', 'true'); else button?.removeAttribute('aria-current');
    }
    for (const group of opts.list.querySelectorAll<HTMLElement>('[data-object-group]')) group.classList.toggle('is-active-group', (objectMembers.get(group) ?? []).some(member => chosenSet.has(member)));
    const rows = [...opts.list.querySelectorAll<HTMLElement>('[data-nav-row]')], rover = rows.find(row => chosenSet.has(row.dataset.id || '')) || rows[0];
    for (const row of rows) { row.tabIndex = row === rover ? 0 : -1; const on = chosenSet.has(row.dataset.id || ''); row.classList.toggle('is-active', on); row.setAttribute('aria-selected', String(on)); }
  }
  function expand(id: string): void {
    if (!explicitIds.has(id)) return;
    objectExpanded.set(`group:${id}`, true);
    const cached = branches.get(`group:${id}`);
    if (cached) { cached.details.open = true; cached.paint(); }
    if (opts.list.classList.contains('is-windowed')) windowed.set(flattened());
    paintActive(active, chosen);
  }
  return { render, paintActive, expand, destroy(): void { disposed = true; windowed.destroy(); branches.clear(); rows.clear(); switcher.remove(); } };
}
