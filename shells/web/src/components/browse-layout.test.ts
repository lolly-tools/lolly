// SPDX-License-Identifier: MPL-2.0
/**
 * Browse layouts (components/browse-layout.ts, plan 302): the values, the read order,
 * the one-time moves from the older Assets and Projects keys, and the controls that
 * switch a live container in place.
 *
 * Run directly:  node --test shells/web/src/components/browse-layout.test.ts
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://example.test/#/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement });
const BL = await import('./browse-layout.ts');
const { favouritesViewSection, cardSizeHtml } = await import('./view-options.ts');

const hashParams = (): URLSearchParams => new URLSearchParams(window.location.hash.split('?')[1] ?? '');
const fresh = (): void => { localStorage.clear(); window.history.replaceState(null, '', '/#/'); };

test('values: grid, card and list, with preview read as grid and anything else refused', () => {
  assert.equal(BL.parseLayout('grid'), 'grid');
  assert.equal(BL.parseLayout('preview'), 'grid', 'Projects stored and linked "preview" before the three layouts shared a name');
  assert.equal(BL.parseLayout('card'), 'card');
  assert.equal(BL.parseLayout('list'), 'list');
  for (const junk of ['', 'cards', 'LIST', null, undefined, 3]) assert.equal(BL.parseLayout(junk), null, `${String(junk)} is not a layout`);
  assert.equal(BL.parseDensity('compact'), 'compact');
  assert.equal(BL.parseDensity('comfortable'), 'comfortable');
  assert.equal(BL.parseDensity('dense'), null);
});

test('read order: the link, then Grid under a capture, then the saved choice, then Grid', () => {
  fresh();
  assert.equal(BL.readLayout('tools'), 'grid', 'nothing saved reads as Grid');
  BL.writeLayout('tools', 'card');
  assert.equal(localStorage.getItem('lolly-layout-tools'), 'card');
  assert.equal(BL.readLayout('tools'), 'card');
  assert.equal(BL.readLayout('utilities'), 'grid', 'each view keeps its own choice');
  assert.equal(BL.readLayout('tools', 'layout=list'), 'list', 'a link wins over the saved choice');
  assert.equal(localStorage.getItem('lolly-layout-tools'), 'card', 'a link is never saved');
  assert.equal(BL.readLayout('tools', 'layout=list', ['grid', 'card']), 'card', 'a layout the view cannot draw yet falls through');
  BL.writeLayout('tools', 'list');
  assert.equal(BL.readLayout('tools', '', ['grid', 'card']), 'grid', 'and so does a saved one');
  assert.equal(BL.readLayout('projects', 'view=list'), 'list', 'Projects reads its older view= as an alias');
  BL.writeLayout('tools', 'grid');
  assert.equal(localStorage.getItem('lolly-layout-tools'), null, 'Grid, the default, is stored as nothing');
  assert.equal(BL.readLayout('tools', 'view=list'), 'grid', 'in Tools view= is the favourites strip, never the layout');
});

test('a docs capture always draws Grid and Comfortable unless its link names a layout', () => {
  fresh();
  BL.writeLayout('catalog', 'list');
  BL.writeDensity('catalog', 'compact');
  localStorage.setItem('lolly-capture-neutral', '1');
  try {
    assert.equal(BL.readLayout('catalog'), 'grid');
    assert.equal(BL.readDensity('catalog'), 'comfortable');
    assert.equal(BL.readLayout('catalog', 'layout=card'), 'card', 'a recipe can ask for Card on purpose');
  } finally { localStorage.removeItem('lolly-capture-neutral'); }
  assert.equal(BL.readLayout('catalog'), 'list');
  assert.equal(BL.readDensity('catalog'), 'compact');
});

test('the older Assets and Projects keys move once, never over a newer choice', () => {
  fresh();
  localStorage.setItem('lolly-catalog-layout', 'list');
  assert.equal(BL.readLayout('catalog'), 'list');
  assert.equal(localStorage.getItem('lolly-catalog-layout'), null, 'the old key is removed, so the move runs once');
  assert.equal(localStorage.getItem('lolly-layout-catalog'), 'list');

  fresh();
  localStorage.setItem('lolly-catalog-layout', 'grid');
  assert.equal(BL.readLayout('catalog'), 'grid');
  assert.equal(localStorage.getItem('lolly-catalog-layout'), null);
  assert.equal(localStorage.getItem('lolly-layout-catalog'), null, 'Grid moves as nothing');

  fresh();
  localStorage.setItem('lolly-layout-catalog', 'card');
  localStorage.setItem('lolly-catalog-layout', 'list');
  assert.equal(BL.readLayout('catalog'), 'card', 'a newer choice is not overwritten');
  assert.equal(localStorage.getItem('lolly-catalog-layout'), null);

  fresh();
  localStorage.setItem('lolly:projectsView', 'list');
  assert.equal(BL.readLayout('projects'), 'list');
  assert.equal(localStorage.getItem('lolly:projectsView'), null);
  assert.equal(localStorage.getItem('lolly-layout-projects'), 'list');

  fresh();
  localStorage.setItem('lolly-catalog-density', 'compact');
  assert.equal(BL.readDensity('catalog'), 'compact');
  assert.equal(localStorage.getItem('lolly-catalog-density'), null);
  assert.equal(localStorage.getItem('lolly-density-catalog'), 'compact');

  fresh();
  localStorage.setItem('lolly-catalog-density', 'comfortable');
  assert.equal(BL.readDensity('catalog'), 'comfortable');
  assert.equal(localStorage.getItem('lolly-catalog-density'), null);
  assert.equal(localStorage.getItem('lolly-density-catalog'), null, 'Comfortable moves as nothing');

  fresh();
  localStorage.setItem('lolly-layout-tools', 'preview');
  assert.equal(BL.readLayout('tools'), 'grid', 'a development build of plan 296 stored "preview"');
});

test('density is per view and stored as nothing at Comfortable', () => {
  fresh();
  assert.equal(BL.readDensity('tools'), 'comfortable');
  BL.writeDensity('tools', 'compact');
  assert.equal(BL.readDensity('tools'), 'compact');
  assert.equal(BL.readDensity('projects'), 'comfortable');
  BL.writeDensity('tools', 'comfortable');
  assert.equal(localStorage.getItem('lolly-density-tools'), null);
  localStorage.setItem('lolly-density-tools', 'roomy');
  assert.equal(BL.readDensity('tools'), 'comfortable', 'junk reads as the default');
});

test('markup attributes are empty at the defaults', () => {
  assert.equal(BL.layoutAttr('grid'), '');
  assert.equal(BL.layoutAttr('card'), ' data-browse-layout="card"');
  assert.equal(BL.layoutAttr('list'), ' data-browse-layout="list"');
  assert.equal(BL.densityAttr('comfortable'), '');
  assert.equal(BL.densityAttr('compact'), ' data-browse-density="compact"');
});

test('a switch keeps every live node and describes tiles only outside Grid', () => {
  const grid = document.createElement('div');
  grid.innerHTML = '<article><img class="preview"><a class="name" data-describedby="cells-1">One</a><span id="cells-1">2d ago</span></article>';
  const preview = grid.querySelector('img');
  const name = grid.querySelector<HTMLElement>('.name')!;
  BL.syncDescriptions(grid, 'grid');
  assert.equal(name.hasAttribute('aria-describedby'), false, 'a Grid tile announces no hidden detail');
  BL.applyLayout(grid, 'card');
  assert.equal(grid.getAttribute('data-browse-layout'), 'card');
  assert.equal(name.getAttribute('aria-describedby'), 'cells-1');
  assert.equal(grid.querySelector('img'), preview, 'the preview node is the same node');
  BL.applyLayout(grid, 'grid');
  assert.equal(grid.hasAttribute('data-browse-layout'), false);
  assert.equal(name.hasAttribute('aria-describedby'), false);
  assert.equal(grid.querySelector('img'), preview);
  BL.applyDensity(grid, 'compact');
  assert.equal(grid.getAttribute('data-browse-density'), 'compact');
  BL.applyDensity(grid, 'comfortable');
  assert.equal(grid.hasAttribute('data-browse-density'), false);
  BL.applyLayout(null, 'card');
  BL.applyDensity(undefined, 'compact');
});

test('the Layout section offers what the view draws, with the slider and density after it', () => {
  const host = document.createElement('div');
  host.innerHTML = BL.layoutSection('gallery-layout', 'card', ['grid', 'card'], cardSizeHtml(2) + BL.densityHtml('gallery-density', 'compact'));
  const seg = host.querySelector<HTMLElement>('.view-seg--layout')!;
  assert.equal(seg.getAttribute('role'), 'group');
  assert.equal(seg.getAttribute('aria-label'), 'Layout');
  assert.deepEqual([...seg.querySelectorAll<HTMLElement>('[data-layout-mode]')].map(b => [b.textContent, b.getAttribute('aria-pressed')]), [['Grid', 'false'], ['Card', 'true']]);
  const all = document.createElement('div');
  all.innerHTML = BL.layoutSection('projects-layout', 'list');
  assert.deepEqual([...all.querySelectorAll<HTMLElement>('[data-layout-mode]')].map(b => b.dataset.layoutMode), ['grid', 'card', 'list']);
  const density = host.querySelector<HTMLElement>('.view-seg--density')!;
  assert.equal(density.getAttribute('aria-label'), 'Tile density');
  assert.deepEqual([...density.querySelectorAll<HTMLElement>('[data-density-mode]')].map(b => [b.textContent, b.getAttribute('aria-pressed')]), [['Comfortable', 'false'], ['Compact', 'true']]);
  const order = [...host.querySelectorAll('.view-seg--layout, .view-options-size, .view-seg--density')].map(el => el.className.split(' ').find(c => c.startsWith('view-')));
  assert.deepEqual(order, ['view-seg', 'view-options-size', 'view-seg'], 'layout, then the slider, then density');
});

test('the layout control presses, hides the slider in List and Favourites outside Grid, remembers and links', () => {
  fresh();
  const panel = document.createElement('div');
  panel.innerHTML = favouritesViewSection('gallery') + BL.layoutSection('projects-layout', 'grid', undefined, cardSizeHtml(2));
  document.body.append(panel);
  const seen: string[] = [];
  BL.wireLayoutControl(panel, { view: 'tools', current: 'grid', onChange: mode => seen.push(mode) });
  const favourites = panel.querySelector('[data-be-seg="featured-view"]')!.closest<HTMLElement>('.filter-pop-sort')!;
  const slider = panel.querySelector<HTMLElement>('.view-options-size')!;
  const press = (mode: string): void => panel.querySelector<HTMLElement>(`[data-layout-mode="${mode}"]`)!.click();
  assert.equal(favourites.hidden, false);
  press('card');
  assert.deepEqual(seen, ['card']);
  assert.equal(panel.querySelector('[data-layout-mode="card"]')!.getAttribute('aria-pressed'), 'true');
  assert.equal(panel.querySelector('[data-layout-mode="grid"]')!.getAttribute('aria-pressed'), 'false');
  assert.equal(favourites.hidden, true, 'the favourites strip draws only in Grid');
  assert.equal(slider.hidden, false, 'Card moves along its own card-size ladder');
  assert.equal(localStorage.getItem('lolly-layout-tools'), 'card');
  assert.equal(hashParams().get('layout'), 'card');
  press('card');
  assert.deepEqual(seen, ['card'], 'pressing the current layout changes nothing');
  press('list');
  assert.equal(slider.hidden, true, 'List rows take their height from density, not the slider');
  press('grid');
  assert.equal(favourites.hidden, false);
  assert.equal(slider.hidden, false);
  assert.equal(hashParams().has('layout'), false, 'Grid, the default, is left out of the address');
  assert.equal(localStorage.getItem('lolly-layout-tools'), null);
  assert.deepEqual(seen, ['card', 'list', 'grid']);
  panel.remove();
});

test('Projects drops its older view= alias on the first change; the picker writes no address', () => {
  fresh();
  window.history.replaceState(null, '', '/#/p?view=list&sort=name');
  const panel = document.createElement('div');
  panel.innerHTML = BL.layoutSection('projects-layout', 'list');
  BL.wireLayoutControl(panel, { view: 'projects', current: 'list', onChange: () => {} });
  panel.querySelector<HTMLElement>('[data-layout-mode="card"]')!.click();
  assert.equal(hashParams().get('layout'), 'card');
  assert.equal(hashParams().has('view'), false);
  assert.equal(hashParams().get('sort'), 'name', 'other parameters stay');

  window.history.replaceState(null, '', '/#/');
  const picker = document.createElement('div');
  picker.innerHTML = BL.layoutSection('picker-layout', 'grid');
  BL.wireLayoutControl(picker, { view: 'picker', current: 'grid', onChange: () => {} });
  picker.querySelector<HTMLElement>('[data-layout-mode="list"]')!.click();
  assert.equal(window.location.hash, '#/', 'the picker is a modal with no address of its own');
  assert.equal(localStorage.getItem('lolly-layout-picker'), 'list');
});

test('the density control presses, remembers per view and hands the value on', () => {
  fresh();
  const panel = document.createElement('div');
  panel.innerHTML = BL.densityHtml('gallery-density', 'comfortable');
  const seen: string[] = [];
  BL.wireDensityControl(panel, { view: 'utilities', current: 'comfortable', onChange: d => seen.push(d) });
  panel.querySelector<HTMLElement>('[data-density-mode="compact"]')!.click();
  assert.deepEqual(seen, ['compact']);
  assert.equal(panel.querySelector('[data-density-mode="compact"]')!.getAttribute('aria-pressed'), 'true');
  assert.equal(localStorage.getItem('lolly-density-utilities'), 'compact');
  assert.equal(window.location.hash, '#/', 'density does not ride the address');
  panel.querySelector<HTMLElement>('[data-density-mode="compact"]')!.click();
  assert.deepEqual(seen, ['compact']);
  panel.querySelector<HTMLElement>('[data-density-mode="comfortable"]')!.click();
  assert.equal(localStorage.getItem('lolly-density-utilities'), null);
  assert.deepEqual(seen, ['compact', 'comfortable']);
});
