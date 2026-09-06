// SPDX-License-Identifier: MPL-2.0
import { mountModal } from '../../components/modal.ts';
import { escape } from '../../utils.ts';
import { t } from '../../i18n.ts';
import { icon } from '../icons.ts';
import { buildBrandPackage, emptyBrandSelection, listBrandContent, type BrandPackageHost, type BrandSelection, type ContentChoice, type ContentKind } from './brand-package.ts';

const GROUPS: Array<{ kind: ContentKind; label: string }> = [
  { kind: 'sessions', label: 'Saved sessions' }, { kind: 'assets', label: 'Catalogue & uploads' }, { kind: 'tools', label: 'Tools' },
];

/** No active-system switch, profile change or export until Download is pressed. */
export async function openBrandDownload(host: BrandPackageHost, system: string): Promise<void> {
  const record = await host.designSystems?.get(system);
  if (!record) throw new Error('This design system is no longer available.');
  return new Promise(resolve => {
    let alive = true;
    let busy = false;
    let choices: ContentChoice[] | null = null;
    let loading: Promise<void> | null = null;
    const selected = new Set<string>();
    const keyOf = (item: ContentChoice): string => `${item.kind}:${item.id}`;
    const modal = mountModal(`
      <header class="bd-head"><div><p class="bd-eyebrow">${t('TAKE YOUR BRAND WITH YOU')}</p><h2 class="modal-title">${t('Download {name}', { name: record.label })}</h2></div><button type="button" class="bd-close" data-bd-close aria-label="${t('Close')}">${icon('close', { size: 20 })}</button></header>
      <p class="bd-intro">${t('One .lolly file. Ready to open on another device or share with your team.')}</p>
      <fieldset class="bd-modes"><legend class="visually-hidden">${t('What to include')}</legend>
        <label><input type="radio" name="brand-download-mode" value="brand" checked><span><strong>${t('Brand only')}</strong><small>${t('Tokens, fonts, logos and published versions.')}</small></span></label>
        <label><input type="radio" name="brand-download-mode" value="collection"><span><strong>${t('Brand + selected content')}</strong><small>${t('Add sessions, catalogue items, uploads and tools.')}</small></span></label>
      </fieldset>
      <section class="bd-content" hidden>
        <label class="bd-search">${icon('search', { size: 18 })}<input type="search" placeholder="${t('Find something to include…')}" aria-label="${t('Search local content')}"></label>
        <p class="bd-help">${t('Nothing is selected automatically. Required local files travel with selected sessions. Tools can be included separately.')}</p>
        <div class="bd-lists"></div>
      </section>
      <footer class="bd-footer"><div><strong class="bd-summary">${t('Brand only')}</strong><p class="bd-status" role="status" aria-live="polite"></p></div><button type="button" class="btn bd-download" data-bd-download>${icon('download', { size: 18 })}<span>${t('Download .lolly')}</span></button></footer>
    `, { className: 'modal brand-download', ariaLabel: t('Download brand'), onClose: () => { alive = false; resolve(); } });
    const el = modal.el;
    const status = el.querySelector<HTMLElement>('.bd-status')!;
    const summary = el.querySelector<HTMLElement>('.bd-summary')!;
    const content = el.querySelector<HTMLElement>('.bd-content')!;
    const lists = el.querySelector<HTMLElement>('.bd-lists')!;
    const search = el.querySelector<HTMLInputElement>('[type="search"]')!;
    const download = el.querySelector<HTMLButtonElement>('[data-bd-download]')!;
    const withContent = (): boolean => !!el.querySelector<HTMLInputElement>('[value="collection"]:checked');
    const selection = (): BrandSelection => {
      const result = emptyBrandSelection();
      if (withContent()) for (const item of choices ?? []) if (selected.has(keyOf(item))) result[item.kind].push(item.id);
      return result;
    };
    const updateSummary = (): void => {
      const s = selection();
      const n = s.sessions.length + s.assets.length + s.tools.length;
      summary.textContent = n ? t('Brand + {sessions} sessions · {assets} files · {tools} tools', { sessions: s.sessions.length, assets: s.assets.length, tools: s.tools.length }) : t('Brand only');
      for (const group of GROUPS) {
        const counter = el.querySelector(`[data-bd-count="${group.kind}"]`);
        if (counter) counter.textContent = `${s[group.kind].length} / ${(choices ?? []).filter(c => c.kind === group.kind).length}`;
      }
    };
    const applyFilter = (): void => {
      const terms = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
      lists.querySelectorAll<HTMLElement>('[data-bd-item]').forEach(row => {
        const item = choices![Number(row.dataset.bdItem)]!;
        row.hidden = !terms.every(term => `${item.name} ${item.detail} ${item.id}`.toLowerCase().includes(term));
      });
      lists.querySelectorAll<HTMLElement>('.bd-group').forEach(group => {
        const visible = group.querySelectorAll('[data-bd-item]:not([hidden])').length;
        group.querySelector<HTMLElement>('.bd-empty')!.hidden = visible !== 0;
      });
    };
    const load = (): Promise<void> => {
      if (loading) return loading;
      status.textContent = t('Reading local content…');
      download.disabled = true;
      loading = listBrandContent(host).then(items => {
        if (!alive) return;
        choices = items;
        // Every label/id comes from on-device data, so interpolate only escaped text.
        lists.innerHTML = GROUPS.map(group => `<details class="bd-group" open><summary>${t(group.label)} <span data-bd-count="${group.kind}"></span></summary><button type="button" class="bd-select-visible" data-bd-select="${group.kind}">${t('Select visible')}</button><div class="bd-items">${items.map((item, i) => item.kind === group.kind ? `<label class="bd-item" data-bd-item="${i}"><input type="checkbox" data-bd-choice="${i}"><span><strong>${escape(item.name)}</strong><small>${escape(item.detail)}</small></span></label>` : '').join('')}<p class="bd-empty" hidden>${t('No matching items.')}</p></div></details>`).join('');
        status.textContent = '';
        updateSummary(); applyFilter();
      }).catch(error => {
        status.textContent = `${t('Could not read local content.')} ${error instanceof Error ? error.message : String(error)}`;
        loading = null;
      }).finally(() => { if (alive) download.disabled = withContent() && !choices; });
      return loading;
    };
    el.addEventListener('change', e => {
      if (busy) return;
      const target = e.target as HTMLInputElement;
      if (target.name === 'brand-download-mode') {
        content.hidden = !withContent();
        if (withContent() && !choices) void load();
        download.disabled = withContent() && !choices;
      }
      if (target.dataset.bdChoice !== undefined) {
        const item = choices?.[Number(target.dataset.bdChoice)];
        if (item) { if (target.checked) selected.add(keyOf(item)); else selected.delete(keyOf(item)); }
      }
      updateSummary();
    });
    search.addEventListener('input', applyFilter);
    el.addEventListener('click', e => {
      const target = (e.target as Element).closest<HTMLElement>('button');
      if (!target) return;
      if (target.hasAttribute('data-bd-close')) { modal.close(); return; }
      if (busy) return;
      if (target.dataset.bdSelect) {
        const boxes = [...target.closest('.bd-group')!.querySelectorAll<HTMLInputElement>('[data-bd-item]:not([hidden]) input')];
        const check = boxes.some(box => !box.checked);
        for (const box of boxes) { box.checked = check; const item = choices![Number(box.dataset.bdChoice)]!; if (check) selected.add(keyOf(item)); else selected.delete(keyOf(item)); }
        target.textContent = check ? t('Clear visible') : t('Select visible');
        updateSummary();
      }
      if (target.hasAttribute('data-bd-download')) {
        busy = true;
        const snapshot = selection();
        el.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input, button:not([data-bd-close])').forEach(control => { control.disabled = true; });
        download.setAttribute('aria-busy', 'true');
        void buildBrandPackage(host, system, snapshot, { progress: label => { if (alive) status.textContent = label; } }).then(async result => {
          if (!alive) return;
          await host.export.download(result.blob, result.filename);
          status.textContent = result.references ? t('Downloaded. {n} unavailable or licensed dependencies remain external references.', { n: result.references }) : t('Downloaded. Open the .lolly file in Lolly to import it.');
        }).catch(error => { if (alive) status.textContent = `${t('Download failed.')} ${error instanceof Error ? error.message : String(error)}`; }).finally(() => {
          busy = false;
          if (!alive) return;
          download.removeAttribute('aria-busy');
          el.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input, button').forEach(control => { control.disabled = false; });
        });
      }
    });
  });
}
