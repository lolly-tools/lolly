// SPDX-License-Identifier: MPL-2.0
/** Asset inspection uses the same disclosure and splitter controls as the other sidebars. */
import { mountSplitter, readStoredWidths, writeStoredWidths, type SplitterHandle } from '../lib/splitter.ts';
import { icon } from '../lib/icons.ts';
import { t } from '../i18n.ts';
import './asset-inspector-dock.css';

const PREF_KEY = 'lolly:asset-inspector';
const RAIL = 48, MIN = 300, DEFAULT = 380, COLLAPSE_AT = 220;

export function mountAssetInspectorDock(dialog: HTMLDialogElement): () => void {
  const body = dialog.querySelector<HTMLElement>('.cat-details-body');
  if (!body) return () => {};
  const prefs = readStoredWidths(PREF_KEY), desktop = window.matchMedia('(min-width: 860px)');
  let width = prefs.width ?? DEFAULT, collapsed = prefs.collapsed === 1, disposed = false, pointerResizing = false;
  let splitter: SplitterHandle | undefined;
  const cleanups: Array<() => void> = [];
  const aside = document.createElement('aside'); aside.className = 'cat-inspector'; aside.setAttribute('aria-label', t('Asset details'));
  const header = document.createElement('header'); header.className = 'cat-inspector-head';
  const titleRow = document.createElement('div'); titleRow.className = 'cat-inspector-title-row';
  const title = body.querySelector<HTMLElement>('.cat-details-name'); if (title) titleRow.append(title);
  const close = dialog.querySelector<HTMLElement>('.cat-details-close');
  const toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'btn btn--ghost cat-inspector-collapse'; toggle.innerHTML = icon('panelLeft');
  toggle.setAttribute('aria-label', t('Collapse asset details')); titleRow.append(toggle); header.append(titleRow);
  const primary = document.createElement('div'); primary.className = 'cat-inspector-primary';
  const verify = body.querySelector('.cat-act-verify'); if (verify) primary.append(verify);
  const actions = body.querySelector('.cat-details-actions');
  const download = actions?.querySelector('.cat-act-download'); if (download) primary.prepend(download);
  const favourites = actions?.querySelector(':scope > .cat-act-row');
  const favourite = favourites?.querySelector<HTMLElement>('.cat-act-fav'); if (favourite) { favourite.setAttribute('aria-label', t('Favourite')); favourite.title = t('Favourite'); titleRow.insertBefore(favourite, toggle); }
  if (favourites?.childElementCount) primary.append(favourites); else favourites?.remove();
  if (primary.childElementCount) header.append(primary);
  const rail = document.createElement('div'); rail.className = 'cat-inspector-rail';
  const expand = document.createElement('button'); expand.type = 'button'; expand.className = 'btn btn--ghost'; expand.innerHTML = icon('sliders'); expand.setAttribute('aria-label', t('Expand asset details')); expand.title = t('Expand asset details'); rail.append(expand);
  const grip = document.createElement('div'); grip.className = 'cat-inspector-grip resize-grip';
  body.before(grip, aside); aside.append(header, body, rail); dialog.classList.add('has-inspector-dock');
  body.classList.add('cat-inspector-scroll');
  const save = () => writeStoredWidths(PREF_KEY, { ...prefs, width, collapsed: collapsed ? 1 : undefined });
  const enhance = (section: HTMLDetailsElement, id: string, open = false): HTMLDetailsElement => {
    if (section.dataset.inspectorSection) return section;
    section.dataset.inspectorSection = id; section.classList.add('section-card', 'cat-inspector-section');
    const summary = section.querySelector<HTMLElement>(':scope > summary');
    if (summary) {
      const label = summary.textContent ?? '';
      summary.className = 'section-card-summary'; summary.replaceChildren();
      const name = document.createElement('span'); name.className = 'section-card-title'; name.textContent = label;
      const chev = document.createElement('span'); chev.className = 'section-card-chev'; chev.setAttribute('aria-hidden', 'true'); chev.innerHTML = icon('chevronDown'); summary.append(name, chev);
    }
    const children = [...section.children].filter(node => node !== summary);
    if (children.length && !(children.length === 1 && children[0]!.classList.contains('cat-inspector-section-body'))) {
      const content = document.createElement('div'); content.className = 'cat-inspector-section-body'; content.append(...children); section.append(content);
    }
    section.open = prefs[`section:${id}`] ? prefs[`section:${id}`] === 1 : open;
    const remember = () => { prefs[`section:${id}`] = section.open ? 1 : 2; save(); };
    section.addEventListener('toggle', remember); cleanups.push(() => section.removeEventListener('toggle', remember));
    return section;
  };
  const wrap = (node: HTMLElement | null, label: string, id: string, open = false) => {
    if (!node) return null;
    const section = document.createElement('details'), summary = document.createElement('summary'), content = document.createElement('div');
    summary.textContent = t(label); content.className = 'cat-inspector-section-body';
    node.before(section); content.append(node); section.append(summary, content); enhance(section, id, open);
    return section;
  };
  const passport = body.querySelector<HTMLElement>('[data-passport]');
  const provenance = body.querySelector<HTMLElement>('.cat-details-provenance'); provenance?.querySelector('.cat-inspector-heading')?.remove();
  const credentials = wrap(provenance, 'Origins & credentials', 'credentials');
  const fileDetails = wrap(body.querySelector<HTMLElement>(':scope > .cat-details-meta'), 'File details', 'details', true);
  const files = body.querySelector<HTMLElement>('[data-asset-files]'); const fileSection = wrap(files, 'Files', 'files', true);
  const tech = body.querySelector<HTMLElement>('[data-tech]'), techSection = wrap(tech, 'Technical details', 'technical');
  const usage = body.querySelector<HTMLElement>('[data-usage]'), usageSection = wrap(usage, 'Used in', 'usage');
  const text = body.querySelector<HTMLElement>('[data-tsig]'), textSection = wrap(text, 'Text analysis', 'text');
  const rondo = wrap(body.querySelector<HTMLElement>('.cat-details-rondo'), 'Audio settings', 'audio');
  const appearance = [...body.querySelectorAll<HTMLElement>(':scope > .cat-dl-section')];
  const appearanceSection = appearance.length ? wrap(appearance[0]!, 'Appearance', 'appearance') : null;
  for (const node of appearance.slice(1)) appearanceSection?.querySelector('.cat-inspector-section-body')?.append(node);
  for (const [index, section] of [...(actions?.querySelectorAll<HTMLDetailsElement>(':scope > details') ?? [])].entries()) enhance(section, index ? 'file-actions' : 'export');
  const checks = wrap(passport, 'Checks', 'checks', true);
  const shared = body.querySelector<HTMLElement>('[data-shared-metadata]');
  for (const node of [fileSection, shared, fileDetails, appearanceSection, actions, credentials, techSection, usageSection, rondo, textSection, checks]) if (node) body.append(node);
  const watched = [[fileSection, files], [techSection, tech], [usageSection, usage], [textSection, text], [checks, passport]] as const;
  const refresh = () => {
    if (disposed) return;
    if (checks && body.lastElementChild !== checks) body.append(checks);
    for (const [section, node] of watched) if (section && node) {
      const hidden = node.hidden || !node.hasChildNodes();
      if (section.hidden !== hidden) { section.hidden = hidden; if (!hidden && section === textSection) section.open = true; }
    }
    if (shared) for (const child of [...shared.children]) {
      if (child instanceof HTMLDetailsElement) enhance(child, 'organisation');
      else if (child instanceof HTMLElement && child.matches('.cat-shared-facts, .cat-shared-index')) {
        const heading = child.querySelector<HTMLElement>('h3'), label = heading?.textContent ?? t('Source'); heading?.remove();
        wrap(child, label, child.matches('.cat-shared-facts') ? 'source' : 'search');
      }
    }
  };
  const observer = new MutationObserver(refresh); observer.observe(body, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden'] }); refresh();
  const max = () => Math.max(MIN, Math.min(640, dialog.clientWidth - 320));
  const actual = () => collapsed ? RAIL : Math.min(max(), Math.max(MIN, width));
  const layout = () => {
    const shut = desktop.matches && collapsed;
    dialog.classList.toggle('is-inspector-collapsed', shut); dialog.style.setProperty('--cat-inspector-width', `${actual()}px`);
    const closeHost = shut ? rail : titleRow;
    if (close && close.parentElement !== closeHost) { const focused = document.activeElement === close; if (shut) rail.prepend(close); else titleRow.append(close); if (focused) close.focus({ preventScroll: true }); }
    body.inert = shut; header.inert = shut; rail.inert = !shut;
    toggle.setAttribute('aria-expanded', String(!shut)); expand.setAttribute('aria-expanded', String(!shut));
    splitter?.sync();
  };
  const setCollapsed = (next: boolean) => {
    collapsed = next; layout(); save(); (next ? expand : toggle).focus();
  };
  const collapseClick = () => setCollapsed(true), expandClick = () => setCollapsed(false);
  toggle.addEventListener('click', collapseClick); expand.addEventListener('click', expandClick);
  splitter = mountSplitter({ grip, controls: aside, panel: 'end', label: t('Resize asset details'),
    value: actual, limits: () => ({ min: RAIL, max: max(), initial: Math.min(DEFAULT, max()) }),
    valueText: value => value === RAIL ? t('Asset details collapsed') : t('{width} pixels wide', { width: value }),
    hint: t('Drag to resize or collapse. Use arrow keys to resize, Home to collapse, or Enter to reset.'),
    set: (next, done) => {
      const dragging = pointerResizing;
      const shut = next <= RAIL || (dragging ? next < COLLAPSE_AT : collapsed ? false : next < MIN);
      collapsed = shut; if (!shut) width = Math.max(MIN, next);
      layout(); if (done) save(); return actual();
    },
    reset: () => { width = DEFAULT; collapsed = false; layout(); save(); },
    onDrag: dragging => { pointerResizing = dragging; },
  });
  const revealText = (event: Event) => { if ((event.target as Element).closest('[data-act="read-text"], [data-act="analyse-text"]') && textSection) textSection.open = true; };
  dialog.addEventListener('click', revealText);
  desktop.addEventListener('change', layout); window.addEventListener('resize', layout);
  const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(layout); resize?.observe(dialog);
  layout();
  return () => {
    disposed = true; observer.disconnect(); resize?.disconnect(); splitter?.dispose();
    desktop.removeEventListener('change', layout); window.removeEventListener('resize', layout);
    toggle.removeEventListener('click', collapseClick); expand.removeEventListener('click', expandClick); dialog.removeEventListener('click', revealText);
    for (const clean of cleanups) clean();
  };
}
