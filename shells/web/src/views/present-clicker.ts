// SPDX-License-Identifier: MPL-2.0
import { t } from '../i18n.ts';
import { escape as esc } from '../utils.ts';

export type ClickerAction = 'next' | 'previous' | 'up' | 'down' | 'blackout';
export const CLICKER_STORAGE_KEY = 'lolly-clicker-keys';
const ACTION_KEYS: Record<ClickerAction, string> = { next: 'PageDown', previous: 'PageUp', up: 'ArrowUp', down: 'ArrowDown', blackout: 'b' };
const ACTIONS = new Set(Object.keys(ACTION_KEYS));

/** Device preferences never replace browser shortcuts or the escape route. */
export function clickerSignature(event: Pick<KeyboardEvent, 'key' | 'shiftKey' | 'ctrlKey' | 'metaKey' | 'altKey'>): string | null {
  if (event.ctrlKey || event.metaKey || event.altKey || ['Escape', 'Tab', 'F5', '__proto__', 'constructor', 'prototype'].includes(event.key)) return null;
  if (!event.key || event.key.length > 32) return null;
  return `${event.shiftKey ? 'Shift+' : ''}${event.key}`;
}

export function parseClickerMap(raw: string | null): Record<string, ClickerAction> {
  const result = Object.create(null) as Record<string, ClickerAction>;
  if (!raw || raw.length > 4096) return result;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
    const entries = Object.entries(value);
    if (entries.length > 16) return result;
    for (const [key, action] of entries) {
      const actualKey = key.startsWith('Shift+') ? key.slice(6) : key;
      if (!clickerSignature({ key: actualKey, shiftKey: false, ctrlKey: false, metaKey: false, altKey: false })) continue;
      if (typeof action === 'string' && ACTIONS.has(action)) result[key] = action as ClickerAction;
    }
  } catch { /* A damaged preference does not change the deck keys. */ }
  return result;
}

function readMap(): Record<string, ClickerAction> {
  try { return parseClickerMap(window.localStorage.getItem(CLICKER_STORAGE_KEY)); } catch { return Object.create(null) as Record<string, ClickerAction>; }
}

export function clickerKey(event: KeyboardEvent): string {
  const signature = clickerSignature(event);
  const action = signature ? readMap()[signature] : undefined;
  return action ? ACTION_KEYS[action] : event.key;
}

function actionLabel(action: ClickerAction): string {
  switch (action) {
    case 'next': return t('Next');
    case 'previous': return t('Previous');
    case 'up': return t('Page up');
    case 'down': return t('Page down');
    case 'blackout': return t('Blackout');
  }
}

function keyMeaning(key: string): string {
  if (['ArrowRight', 'PageDown', ' ', 'Spacebar'].includes(key)) return t('Next');
  if (['ArrowLeft', 'PageUp'].includes(key)) return t('Previous');
  if (key === 'ArrowUp') return t('Page up');
  if (key === 'ArrowDown') return t('Page down');
  if (['b', 'B', '.'].includes(key)) return t('Blackout');
  if (key === 'Escape') return t('Release the page, then leave the presentation');
  if (key === 'F5') return t('Kept from reloading while presenting');
  return t('No deck action');
}

export function clickerPanelHtml(): string {
  return `<details class="pwc-clicker"><summary>${t('Test your clicker')}</summary>`
    + `<p>${t('Start the test, then press each button. Choose an action to remember a button on this device.')}</p>`
    + `<div class="pwc-clicker-result" role="status" aria-live="polite" tabindex="-1" data-clicker-result>${t('Waiting for a button')}</div>`
    + `<div class="pwc-clicker-actions"><button type="button" class="btn btn--sm" data-clicker-test aria-pressed="false">${t('Start test')}</button>`
    + `<label>${t('Remember as')} <select data-clicker-action aria-label="${t('Remember as')}"><option value="">${t('Choose an action')}</option>`
    + (Object.keys(ACTION_KEYS) as ClickerAction[]).map((action) => `<option value="${action}">${esc(actionLabel(action))}</option>`).join('')
    + `</select></label><button type="button" class="btn btn--sm" data-clicker-save disabled>${t('Remember button')}</button>`
    + `<button type="button" class="btn btn--sm" data-clicker-reset>${t('Reset remembered buttons')}</button></div>`
    + `<p class="pwc-clicker-note">${t('Escape, Tab and browser shortcuts stay unchanged. Page up and Page down drive the focused page, or the slide stack when no page is focused.')}</p></details>`;
}

/** Captures keys only during a deliberate test, and releases every listener on close. */
export function wireClickerPanel(root: HTMLElement): () => void {
  const doc = root.ownerDocument;
  const panel = root.querySelector<HTMLDetailsElement>('.pwc-clicker');
  const result = root.querySelector<HTMLElement>('[data-clicker-result]');
  const test = root.querySelector<HTMLButtonElement>('[data-clicker-test]');
  const action = root.querySelector<HTMLSelectElement>('[data-clicker-action]');
  const save = root.querySelector<HTMLButtonElement>('[data-clicker-save]');
  let testing = false, last: string | null = null;
  const setTesting = (on: boolean): void => {
    testing = on; test?.setAttribute('aria-pressed', String(on));
    if (test) test.textContent = on ? t('Finish test') : t('Start test');
    if (on) {
      last = null; updateSave();
      if (result) { result.textContent = t('Waiting for a button'); result.focus({ preventScroll: true }); }
    }
  };
  const updateSave = (): void => { if (save) save.disabled = !last || !ACTIONS.has(action?.value ?? ''); };
  const onKey = (event: KeyboardEvent): void => {
    if (!testing || !panel?.open || event.ctrlKey || event.metaKey || event.altKey || event.key === 'Escape' || event.key === 'Tab') return;
    if ((event.target as Element | null)?.closest?.('select, input, textarea, [contenteditable="true"]')) return;
    // Leave control activation native; the readout receives the clicker's keys.
    if (['Enter', ' ', 'Spacebar'].includes(event.key) && (event.target as Element | null)?.closest?.('button, a[href]')) return;
    event.preventDefault(); event.stopImmediatePropagation();
    last = clickerSignature(event); updateSave();
    const label = event.key === ' ' ? t('Space') : `${event.shiftKey ? 'Shift + ' : ''}${event.key}`;
    if (result) result.textContent = `${label} · ${keyMeaning(clickerKey(event))}`;
  };
  const onClick = (event: Event): void => {
    const target = (event.target as Element | null)?.closest<HTMLButtonElement>('button');
    if (target?.hasAttribute('data-clicker-test')) setTesting(!testing);
    if (target?.hasAttribute('data-clicker-save') && last && ACTIONS.has(action?.value ?? '')) {
      const map = readMap();
      if (!Object.hasOwn(map, last) && Object.keys(map).length >= 16) {
        if (result) result.textContent = t('Sixteen buttons are remembered. Reset them to learn another.');
        return;
      }
      map[last] = action!.value as ClickerAction;
      try {
        window.localStorage.setItem(CLICKER_STORAGE_KEY, JSON.stringify(map));
        if (result) result.textContent = t('Button remembered on this device.');
      } catch { if (result) result.textContent = t('This browser could not remember the button.'); }
      setTesting(false);
    }
    if (target?.hasAttribute('data-clicker-reset')) {
      try { window.localStorage.removeItem(CLICKER_STORAGE_KEY); } catch { /* Private mode can refuse storage. */ }
      last = null; updateSave(); setTesting(false);
      if (result) result.textContent = t('Remembered buttons cleared.');
    }
  };
  const onToggle = (): void => { if (!panel?.open) setTesting(false); };
  doc.addEventListener('keydown', onKey, true); root.addEventListener('click', onClick);
  action?.addEventListener('change', updateSave); panel?.addEventListener('toggle', onToggle);
  return () => { setTesting(false); doc.removeEventListener('keydown', onKey, true); root.removeEventListener('click', onClick); action?.removeEventListener('change', updateSave); panel?.removeEventListener('toggle', onToggle); };
}
