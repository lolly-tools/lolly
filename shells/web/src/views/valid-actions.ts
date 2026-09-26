// SPDX-License-Identifier: MPL-2.0
/** One persistent set of file actions, backed by the report's existing handlers. */
import { icon, type IconName } from '../lib/icons.ts';
import { escape as esc } from '../utils.ts';
import { t } from '../i18n.ts';
import { prefersReducedMotion } from '../lib/a11y-prefs.ts';
import '../styles/parts/valid-actions.css';

type ActionElement = HTMLButtonElement | HTMLAnchorElement;
interface ActionSpec {
  id: string; label: string; icon: IconName; selector: string;
  primary?: boolean; group?: string; note?: string; reveal?: string;
  keepLocal?: boolean; global?: boolean;
}
const SPECS: readonly ActionSpec[] = [
  { id: 'report', label: 'Save report', icon: 'download', selector: '[data-report-card]', primary: true },
  { id: 'clean', label: 'Clean copy', icon: 'eyeOff', selector: '[data-clean-copy]:not([data-clean-package])', primary: true },
  { id: 'keep', label: 'Keep in Assets', icon: 'package', selector: '[data-add-catalog]', group: 'Save & use' },
  { id: 'claim', label: 'Add credentials', icon: 'seal', selector: '[data-claim-panel] > summary', group: 'Save & use', reveal: '[data-claim-panel]', keepLocal: true },
  { id: 'recreate', label: 'Recreate', icon: 'tool', selector: '[data-recreate]', group: 'Save & use' },
  { id: 'redact', label: 'Redact', icon: 'pen', selector: '.valid-meta-actions a[href="#/tool/redact"]', group: 'Save & use' },
  { id: 'text', label: 'Read text', icon: 'document', selector: '[data-ocr-read]', group: 'Inspect', reveal: '[data-ocr-result]' },
  { id: 'address', label: 'Request address', icon: 'mapPin', selector: '[data-request-address]', group: 'Inspect', note: 'OpenStreetMap Nominatim · opens a website', keepLocal: true },
  { id: 'hidden', label: 'Hidden Data', icon: 'eye', selector: '.valid-meta-actions a[href="#/tool/strip-data"]', group: 'Inspect' },
  { id: 'imprint', label: 'Search for a resized Imprint', icon: 'search', selector: '[data-imprint-rescan]', group: 'Inspect', reveal: '.valid-wm--action' },
  { id: 'watermark', label: 'Check watermarks in all images', icon: 'search', selector: '[data-deep-scan-enable]', group: 'Inspect', global: true, note: 'Downloads a detector once (~90 MB)', reveal: '[data-deepscan-banner]' },
  { id: 'request', label: 'Copy a request for credentials', icon: 'clipboard', selector: '[data-ask-cred]', group: 'Share & export' },
  { id: 'credits', label: 'Clean copy with separate credits', icon: 'download', selector: '[data-clean-package]', group: 'Share & export' },
  { id: 'payload', label: 'Download embedded data', icon: 'package', selector: '[data-payload-download]', group: 'Share & export' },
];
interface BoundAction { spec: ActionSpec; source: HTMLElement; original: string; }

function reveal(element: HTMLElement): void {
  for (let parent: HTMLElement | null = element; parent; parent = parent.parentElement) {
    if (parent instanceof HTMLDetailsElement) parent.open = true;
  }
  element.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'instant' : 'smooth' });
}

export function wireVerifyActions(view: HTMLElement, report: HTMLElement): void {
  const toolbar = document.createElement('section');
  toolbar.className = 'valid-actions';
  toolbar.setAttribute('aria-label', t('Asset actions'));
  toolbar.hidden = true;
  toolbar.innerHTML = `<div class="valid-actions-file">${icon('document')}<span data-actions-name></span><select data-actions-file aria-label="${esc(t('Asset for these actions'))}"></select></div><div class="valid-actions-buttons"><div data-actions-primary></div><details class="valid-actions-more"><summary class="btn">${icon('tool')}<span>${t('More')}</span>${icon('chevronDown')}</summary><div class="valid-actions-menu" data-actions-menu></div></details></div><span class="valid-actions-status" role="status" data-actions-status></span>`;
  view.appendChild(toolbar);
  const picker = toolbar.querySelector<HTMLSelectElement>('[data-actions-file]')!;
  const name = toolbar.querySelector<HTMLElement>('[data-actions-name]')!;
  const primary = toolbar.querySelector<HTMLElement>('[data-actions-primary]')!;
  const more = toolbar.querySelector<HTMLDetailsElement>('.valid-actions-more')!;
  const menu = toolbar.querySelector<HTMLElement>('[data-actions-menu]')!;
  const status = toolbar.querySelector<HTMLElement>('[data-actions-status]')!;
  const originals = new WeakMap<HTMLElement, string>();
  let selected = '', structure = '', filesKey = '';
  let actions: BoundAction[] = [];
  let waiting: { target: HTMLElement } | undefined;
  let lastScope: HTMLElement | undefined;

  const sync = (): void => {
    const scopes = [...report.querySelectorAll<HTMLElement>('.valid-result[data-actions-index]')]
      .filter((el) => !el.closest('.valid-item[hidden]'));
    const scope = scopes.find((el) => el.dataset.actionsIndex === selected) ?? scopes[0];
    toolbar.hidden = !scope;
    view.classList.toggle('has-valid-actions', !!scope);
    if (!scope) { selected = ''; more.open = false; waiting = undefined; return; }
    for (const item of scopes) {
      for (const spec of SPECS.filter((s) => !s.keepLocal && !s.global)) {
        item.querySelectorAll<HTMLElement>(spec.selector).forEach((source) => { source.dataset.toolbarSource = ''; });
      }
    }
    if (lastScope && lastScope !== scope) { more.open = false; waiting = undefined; }
    lastScope = scope;
    selected = scope.dataset.actionsIndex!;
    const files = scopes.map((el) => ({ index: el.dataset.actionsIndex!, name: el.querySelector('.valid-hero-filename')?.textContent ?? t('Asset') }));
    const nextFilesKey = JSON.stringify(files);
    if (nextFilesKey !== filesKey) {
      picker.innerHTML = files.map((f) => `<option value="${esc(f.index)}">${esc(f.name)}</option>`).join('');
      filesKey = nextFilesKey;
    }
    picker.value = selected;
    picker.hidden = files.length === 1;
    name.hidden = files.length !== 1;
    name.textContent = files.find((f) => f.index === selected)?.name ?? '';
    name.title = name.textContent;
    toolbar.setAttribute('aria-label', t('Actions for {name}', { name: name.textContent }));
    actions = SPECS.flatMap((spec) => {
      const source = (spec.global ? report : scope).querySelector<HTMLElement>(spec.selector);
      if (!source || source.hidden) return [];
      if (!originals.has(source)) originals.set(source, source.textContent?.trim() ?? '');
      if (!spec.keepLocal) source.dataset.toolbarSource = '';
      return [{ spec, source, original: originals.get(source)! }];
    });
    const nextStructure = actions.map(({ spec }) => spec.id).join(',');
    if (structure !== nextStructure) {
      const button = ({ spec }: BoundAction): string => `<button type="button" class="btn valid-actions-command" data-verify-action="${spec.id}">${icon(spec.icon)}<span>${esc(t(spec.label))}</span>${spec.note ? `<small>${esc(t(spec.note))}</small>` : ''}</button>`;
      primary.innerHTML = actions.filter((a) => a.spec.primary).map(button).join('');
      const groups = [...new Set(actions.filter((a) => !a.spec.primary).map((a) => a.spec.group!))];
      menu.innerHTML = groups.map((group) => `<div class="valid-actions-group"><span>${esc(t(group))}</span>${actions.filter((a) => a.spec.group === group).map(button).join('')}</div>`).join('');
      more.hidden = groups.length === 0;
      structure = nextStructure;
    }
    const busy: string[] = [];
    for (const { spec, source, original } of actions) {
      const button = toolbar.querySelector<HTMLButtonElement>(`[data-verify-action="${spec.id}"]`)!;
      const disabled = source instanceof HTMLButtonElement && source.disabled;
      button.disabled = disabled;
      const changed = source.textContent?.trim() !== original;
      const label = disabled && changed ? source.textContent?.trim() ?? t(spec.label) : t(spec.label);
      const span = button.querySelector('span')!;
      if (span.textContent !== label) span.textContent = label;
      button.title = source.textContent?.trim() ?? t(spec.label);
      if (disabled && changed) busy.push(label);
    }
    const message = busy.join(' · ');
    if (status.textContent !== message) status.textContent = message;
    if (waiting && !waiting.target.hidden && waiting.target.textContent?.trim()) {
      reveal(waiting.target);
      waiting = undefined;
    }
  };

  toolbar.addEventListener('click', (event) => {
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[data-verify-action]') : null;
    const action = actions.find((a) => a.spec.id === button?.dataset.verifyAction);
    if (!action || !button || button.disabled || !action.source.isConnected) return;
    more.open = false;
    const scope = action.source.closest<HTMLElement>('.valid-result') ?? report;
    if (action.spec.id === 'claim') {
      const panel = scope.querySelector<HTMLElement>(action.spec.reveal!);
      if (panel) { reveal(panel); panel.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true }); }
      return;
    }
    if (action.spec.reveal) {
      const target = scope.querySelector<HTMLElement>(action.spec.reveal);
      if (target) {
        if (!target.hidden) reveal(target);
        else waiting = { target };
      }
    }
    (action.source as ActionElement).click();
    if (!action.spec.primary) more.querySelector<HTMLElement>('summary')?.focus({ preventScroll: true });
    sync();
  });
  picker.addEventListener('change', () => {
    selected = picker.value;
    sync();
    if (lastScope) reveal(lastScope);
  });
  const onToggle = (event: Event): void => {
    if (!(event.target instanceof HTMLDetailsElement) || !event.target.matches('.valid-item[open]')) return;
    selected = event.target.querySelector<HTMLElement>('.valid-result')?.dataset.actionsIndex ?? selected;
    sync();
  };
  report.addEventListener('toggle', onToggle, true);
  toolbar.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && more.open) {
      event.preventDefault(); event.stopPropagation(); more.open = false;
      more.querySelector<HTMLElement>('summary')?.focus();
    }
    if (event.key === 'Tab') setTimeout(() => { if (!more.contains(document.activeElement)) more.open = false; }, 0);
  });
  const closeOutside = (event: Event): void => { if (event.target instanceof Node && !more.contains(event.target)) more.open = false; };
  document.addEventListener('pointerdown', closeOutside);
  const observer = new MutationObserver(sync);
  observer.observe(report, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['disabled', 'hidden'] });
  const resize = new ResizeObserver(() => {
    view.style.setProperty('--valid-actions-height', `${Math.ceil(toolbar.getBoundingClientRect().height)}px`);
  });
  resize.observe(toolbar);
  sync();
  const owner = view as HTMLElement & { _cleanup?: () => void };
  const previous = owner._cleanup;
  owner._cleanup = () => {
    observer.disconnect(); resize.disconnect();
    document.removeEventListener('pointerdown', closeOutside);
    report.removeEventListener('toggle', onToggle, true);
    report.querySelectorAll<HTMLElement>('[data-toolbar-source]').forEach((source) => { delete source.dataset.toolbarSource; });
    toolbar.remove(); view.classList.remove('has-valid-actions'); view.style.removeProperty('--valid-actions-height');
    previous?.();
  };
}
