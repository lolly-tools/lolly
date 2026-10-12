// SPDX-License-Identifier: MPL-2.0
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { InputModelItem, InputValue } from '../../../../engine/src/inputs.ts';
import { flattenValue } from '../../../../engine/src/inputs.ts';
import { isTokenValue, aliasPath } from '../../../../engine/src/tokens.ts';
import { resolveTokenBinding, type TokenConsumer, type TokenBindingResult } from '../../../../engine/src/token-binding.ts';
import { escape as esc } from '../utils.ts';
import { t } from '../i18n.ts';
import { icon } from '../lib/icons.ts';
import type { TokenEntry } from '../../../../engine/src/bridge/host-v1.ts';
import type { TokenAdapter } from '../../../../engine/src/token-consumer-adapters.ts';

/** Adds link actions around the caller's existing typed editor; never edits source tokens. */
export function mountTokenBindingField(root: HTMLElement, input: InputModelItem, host: Pick<HostV1, 'tokens'>, commit: (value: InputValue) => void | Promise<void>, options: { consumer?: TokenConsumer; fallbackAdapter?: TokenAdapter; candidatePreflight?: (entry: TokenEntry | undefined) => TokenBindingResult | undefined; readOnly?: boolean; mixed?: boolean; restoreRef?: string; compact?: boolean; colorTarget?: 'srgb' | 'rec2020'; candidateType?: 'transition'; onPendingChange?: (pending: boolean) => void } = {}): () => void {
  const resolve = (entry: TokenEntry | undefined) => {
    const consumer = { ...input, ...options.consumer, colorTarget: options.colorTarget };
    const primary = resolveTokenBinding(entry, consumer);
    const result = primary.status !== 'linked' && options.fallbackAdapter ? resolveTokenBinding(entry, { ...consumer, adapter: options.fallbackAdapter }) : primary;
    return result.status === 'linked' ? options.candidatePreflight?.(entry) ?? result : result;
  };
  const abort = new AbortController();
  let disposed = false, pending = 0;
  let candidates: TokenEntry[] = [];
  const explicit = options.candidateType === 'transition';
  async function duringAction(work: () => Promise<void>): Promise<void> {
    if (++pending === 1) options.onPendingChange?.(true);
    try { await work(); } finally { if (--pending === 0) options.onPendingChange?.(false); }
  }
  const linked = isTokenValue(input.value) ? input.value : null;
  const state = linked ? (input.value as { status?: string }).status ?? 'linked' : 'custom';
  root.classList.add('token-binding-field');
  const label = options.mixed ? t('Mixed values') : linked ? `${t(state === 'linked' ? 'Linked' : 'Using cached value')}: ${linked.ref}` : t('Custom value');
  const reason = (input.value as { reason?: string } | null)?.reason;
  root.innerHTML = `<span>${esc(label)}${options.readOnly ? ` · ${t('Read-only')}` : ''}</span>${options.readOnly ? '' : `<button type="button" class="btn btn--ghost btn--sm" data-token-choose>${t('Link a token')}</button>${linked ? `<button type="button" class="btn btn--ghost btn--sm" data-token-custom>${t('Make custom')}</button>` : options.restoreRef ? `<button type="button" class="btn btn--ghost btn--sm" data-token-restore>${t('Restore link')}</button>` : ''}`}${linked ? `<button type="button" class="btn btn--ghost btn--sm" data-token-inspect>${t('Inspect source')}</button>` : ''}<label data-token-options hidden>${explicit ? t('Transition tokens') : t('Compatible tokens')}<select class="field-select" ${options.readOnly ? 'disabled' : ''}><option value="">${t('Choose a token')}</option></select></label>${explicit && !options.readOnly ? `<button type="button" class="btn btn--ghost btn--sm" data-token-link disabled hidden>${t('Link token')}</button>` : ''}<span role="status" aria-live="polite" data-token-message>${esc(reason ?? '')}</span>`;
  const message = root.querySelector<HTMLElement>('[data-token-message]')!;
  if (options.compact) {
    const disclosure = document.createElement('details');
    disclosure.className = 'token-binding-disclosure';
    const summary = document.createElement('summary');
    summary.className = 'section-card-summary btn btn--ghost btn--sm token-binding-summary';
    summary.innerHTML = `${icon(linked ? 'link' : options.restoreRef ? 'unlink' : 'link', { size: 14 })}<span>${esc(linked || options.mixed ? label : options.restoreRef ? t('Custom value') : t('Link token'))}${options.readOnly ? ` · ${t('Read-only')}` : ''}</span>${icon('chevronRight', { size: 14, className: 'section-card-chev' })}`;
    const actions = document.createElement('div'); actions.className = 'token-binding-actions';
    for (const child of [...root.children]) if (child !== message && child !== root.firstElementChild) actions.append(child);
    root.firstElementChild?.remove(); disclosure.append(summary, actions); root.prepend(disclosure);
  }
  const chooser = root.querySelector<HTMLSelectElement>('select')!;
  const linkButton = root.querySelector<HTMLButtonElement>('[data-token-link]');
  function showCompatibility(): void {
    if (!linkButton) return;
    const entry = candidates.find(candidate => candidate.path === chooser.value);
    const result = entry ? resolve(entry) : undefined;
    linkButton.disabled = options.readOnly === true || result?.status !== 'linked';
    message.textContent = result && result.status !== 'linked' ? t(result.reason ?? 'This token cannot be linked here.') : '';
  }
  async function apply(value: InputValue): Promise<void> {
    try { await commit(value); }
    catch (error) { if (!disposed) message.textContent = error instanceof Error ? error.message : t('The value could not be changed.'); }
  }
  async function link(ref: string): Promise<void> {
    try {
      const set = await host.tokens?.get();
      if (disposed || !root.isConnected || options.readOnly) return;
      const path = aliasPath(ref) ?? ref;
      const entry = set?.get(path);
      const value = resolve(entry);
      if (explicit) { candidates = candidates.filter(candidate => candidate.path !== path); if (entry) candidates.push({ ...entry, path }); }
      if (linkButton && chooser.value === path) {
        linkButton.disabled = value.status !== 'linked';
        chooser.selectedOptions[0]!.textContent = `${chooser.value}${value.status !== 'linked' ? ` · ${t('Incompatible')}` : ''}`;
      }
      if (value.status === 'linked') await apply({ ref: `{${aliasPath(ref) ?? ref}}`, value: value.value, ...(value.adapter ? { adapter: value.adapter } : {}) });
      else message.textContent = value.reason ?? t('This token cannot be linked here.');
    } catch { if (!disposed) message.textContent = t('Tokens could not be read.'); }
  }
  root.addEventListener('click', async event => {
    const target = (event.target as HTMLElement).closest('button');
    if (!target || !['data-token-custom', 'data-token-restore', 'data-token-inspect', 'data-token-choose', 'data-token-link'].some(attr => target.hasAttribute(attr))) return;
    await duringAction(async () => {
      if (target?.hasAttribute('data-token-custom') && !options.readOnly) await apply(flattenValue(input.value));
      if (target?.hasAttribute('data-token-restore') && options.restoreRef) await link(options.restoreRef);
      if (target?.hasAttribute('data-token-link') && !target.disabled && chooser.value) await link(chooser.value);
      if (target?.hasAttribute('data-token-inspect')) {
        try {
          const { openTokenInspector } = await import('./token-workspace.ts');
          if (!disposed && root.isConnected) {
            target.focus({ preventScroll: true });
            await openTokenInspector(host, aliasPath(linked?.ref) ?? linked?.ref, () => !disposed && root.isConnected);
          }
        } catch (error) { if (!disposed) message.textContent = error instanceof Error ? error.message : t('Tokens could not be read.'); }
      }
      if (target?.hasAttribute('data-token-choose')) {
        message.textContent = explicit ? t('Reading transition tokens…') : t('Reading compatible tokens…');
        try {
          const set = await host.tokens?.get();
          if (disposed || !root.isConnected || options.readOnly) return;
          const entries = set?.query().filter(e => explicit ? e.type === options.candidateType : resolve(e).status === 'linked') ?? [];
          candidates = entries.slice(0, 2000);
          chooser.innerHTML = `<option value="">${t('Choose a token')}</option>${candidates.map(e => `<option value="${esc(e.path)}">${esc(e.path)}${explicit && resolve(e).status !== 'linked' ? ` · ${t('Incompatible')}` : ''}</option>`).join('')}`;
          root.querySelector<HTMLElement>('[data-token-options]')!.hidden = false;
          if (linkButton) { linkButton.hidden = false; linkButton.disabled = true; }
          message.textContent = entries.length > 2000 ? explicit ? t('Showing the first 2000 transition tokens. Inspect the system to search all tokens.') : t('Showing the first 2000 compatible tokens. Inspect the system to search all tokens.') : entries.length ? '' : explicit ? t('No transition tokens in this context.') : t('No compatible tokens in this context.');
          chooser.focus();
        } catch { if (!disposed) message.textContent = t('Tokens could not be read.'); }
      }
    });
  }, { signal: abort.signal });
  chooser.addEventListener('change', async () => {
    if (explicit) { showCompatibility(); return; }
    const path = chooser.value;
    if (!path) return;
    await duringAction(() => link(path));
  }, { signal: abort.signal });
  return () => { disposed = true; abort.abort(); root.replaceChildren(); };
}
