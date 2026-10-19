// SPDX-License-Identifier: MPL-2.0
/**
 * The review a bulk token link opens before it writes anything (plan 286, M5):
 * every target with its current value, what it would become and why it is or is
 * not selected. Opening, toggling and cancelling change nothing; Apply returns the
 * chosen items and the caller writes them as one action.
 */
import { mountModal } from './modal.ts';
import { countBulkLink, type BulkLinkItem, type BulkLinkPlan } from '../lib/token-bulk-link.ts';
import { escape as esc } from '../utils.ts';
import { t, tRaw } from '../i18n.ts';

let reviews = 0;

/** One line describing an item's current state and what Apply would change. */
function detailOf(item: BulkLinkItem): string {
  const before = item.before === '' ? tRaw('empty') : item.before;
  switch (item.status) {
    case 'change': return tRaw('{before} becomes {after}', { before, after: item.after ?? '' });
    case 'override': return tRaw('Custom value {before}, previously linked to {token}. Select to replace it with {after}.', { before, token: item.previous ?? '', after: item.after ?? '' });
    case 'other-link': return tRaw('Linked to {token} ({before}). Select to link this token instead, giving {after}.', { token: item.previous ?? '', before, after: item.after ?? '' });
    case 'linked': return tRaw('Already linked to this token.');
    case 'read-only': return tRaw('Read-only here.');
    default: return item.reason ? tRaw(item.reason) : tRaw('This token cannot be linked here.');
  }
}

/** The status line: what the current selection will do and what it leaves alone. */
function summaryOf(items: readonly BulkLinkItem[], selected: ReadonlySet<string>): string {
  const counts = countBulkLink(items, selected);
  const keptOverrides = items.filter(item => item.status === 'override' && !selected.has(item.key)).length;
  const keptLinks = items.filter(item => item.status === 'other-link' && !selected.has(item.key)).length;
  const parts = [tRaw('Will change: {n}.', { n: counts.selected })];
  if (keptOverrides) parts.push(tRaw('Custom values kept: {n}.', { n: keptOverrides }));
  if (keptLinks) parts.push(tRaw('Links to other tokens kept: {n}.', { n: keptLinks }));
  if (counts.linked) parts.push(tRaw('Already linked: {n}.', { n: counts.linked }));
  if (counts.incompatible) parts.push(tRaw('Cannot link: {n}.', { n: counts.incompatible }));
  if (counts['read-only']) parts.push(tRaw('Read-only: {n}.', { n: counts['read-only'] }));
  return parts.join(' ');
}

/**
 * Show the plan and resolve with the items to write, or null when the reviewer
 * cancels or nothing is selected. Items that cannot take the token stay visible
 * with their reason and a disabled checkbox.
 */
export function reviewBulkTokenLink(plan: BulkLinkPlan, title: string): Promise<BulkLinkItem[] | null> {
  const id = `token-bulk-${++reviews}`;
  const selected = new Set(plan.items.filter(item => item.include && item.value).map(item => item.key));
  const rows = plan.items.map((item, index) => `<li class="token-bulk-item" data-status="${esc(item.status)}">
      <input type="checkbox" class="field-check" id="${id}-${index}" data-bulk-item="${index}" aria-describedby="${id}-${index}-detail"${selected.has(item.key) ? ' checked' : ''}${item.optional ? '' : ' disabled'}>
      <label for="${id}-${index}">${esc(item.label)}</label>
      <span class="token-bulk-detail" id="${id}-${index}-detail">${esc(detailOf(item))}</span>
    </li>`).join('');
  return new Promise(resolve => {
    const modal = mountModal<BulkLinkItem[] | null>(`<h2 class="modal-title">${esc(title)}</h2>
      <p class="modal-msg token-bulk-token">${t('Token: {path}', { path: plan.path })}</p>
      <p class="token-bulk-summary" role="status" aria-live="polite" data-bulk-summary></p>
      <ul class="token-bulk-list">${rows}</ul>
      <div class="modal-actions">
        <button type="button" class="btn" data-act="cancel">${t('Cancel')}</button>
        <button type="button" class="btn modal-primary" data-act="apply"></button>
      </div>`, {
      className: 'modal token-bulk-dialog',
      ariaLabel: title,
      cancelValue: null,
      // Focus starts in the list, so a keyboard user reads the plan before reaching Apply.
      initialFocus: el => el.querySelector<HTMLElement>('[data-bulk-item]:not(:disabled)') ?? el.querySelector<HTMLElement>('[data-act="cancel"]'),
      onClose: result => resolve(result ?? null),
    });
    const summary = modal.el.querySelector<HTMLElement>('[data-bulk-summary]')!;
    const apply = modal.el.querySelector<HTMLButtonElement>('[data-act="apply"]')!;
    const refresh = (): void => {
      const count = plan.items.filter(item => item.value && selected.has(item.key)).length;
      summary.textContent = summaryOf(plan.items, selected);
      apply.textContent = tRaw('Apply to {n}', { n: count });
      apply.disabled = count === 0;
    };
    refresh();
    modal.el.addEventListener('change', event => {
      const box = (event.target as HTMLElement).closest<HTMLInputElement>('[data-bulk-item]');
      const item = box ? plan.items[Number(box.dataset.bulkItem)] : undefined;
      if (!box || !item?.optional) return;
      if (box.checked) selected.add(item.key); else selected.delete(item.key);
      refresh();
    });
    modal.el.querySelector('[data-act="cancel"]')!.addEventListener('click', () => modal.close(null));
    apply.addEventListener('click', () => {
      const chosen = plan.items.filter(item => item.value && selected.has(item.key));
      modal.close(chosen.length ? chosen : null);
    });
  });
}
