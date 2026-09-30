// SPDX-License-Identifier: MPL-2.0
import type { BrandRuleV1, BrandSystemV1 } from '@lolly-tools/core/brand-system-v1';
import { BRAND_EXAMPLES, BRAND_RULE_KINDS, brandRuleSlot, resolveBrandRule } from '../../../../../engine/src/brand-rules.ts';
import { createTokenSet } from '../../../../../engine/src/tokens.ts';
import { mountModal } from '../../components/modal.ts';

import { t } from '../../i18n.ts';
import { escape as e } from '../../utils.ts';
import { EXAMPLE_LABELS } from './brand-examples.ts';
import { replaceUsageRule } from './usage-model.ts';

import type { UsageHost } from './usage-model.ts';

export const RULE_LABELS: Record<string, string> = { 'color-choices': 'Colour choices', 'font-choices': 'Font choices', 'fixed-artwork': 'Fixed artwork', 'text-length': 'Text length' };
const option = (value: string, label: string, selected?: string): string => `<option value="${e(value)}"${value === selected ? ' selected' : ''}>${e(t(label))}</option>`;

/** One decision at a time; advanced source and identity remain visible in the guide. */
export function editUsageRule(opts: { host: UsageHost; doc: unknown; system: BrandSystemV1; mode: string; rule?: BrandRuleV1; save(system: BrandSystemV1): Promise<void>; closed(): void }) {
  const original = opts.rule;
  const modal = mountModal(`<header><p class="start-eyebrow">${t('Usage & rules')}</p><h2>${t(original ? 'Edit rule' : 'Add a rule')}</h2><p>${t('Choose what this example allows. Your brand’s names stay separate from Lolly’s fields.')}</p></header>
    <form class="usage-rule-form">
      <label>${t('Rule name')}<input class="field-input" name="label" maxlength="160" required value="${e(original?.label ?? '')}" placeholder="${e(t('For example, Beacon accents'))}"></label>
      <div class="usage-form-pair"><label>${t('Check')}<select class="field-select" name="kind">${BRAND_RULE_KINDS.map(kind => option(kind, RULE_LABELS[kind]!, original?.kind ?? 'color-choices')).join('')}</select></label>
      <label>${t('Example')}<select class="field-select" name="example">${BRAND_EXAMPLES.map(id => option(id, EXAMPLE_LABELS[id], original?.scope?.tools?.[0] ?? 'brand-poster')).join('')}</select></label></div>
      <div data-rule-material></div>
      <div class="usage-form-pair"><label>${t('Mode')}<select class="field-select" name="mode">${option('', 'Every mode', original?.scope?.modes?.[0] ?? '')}${createTokenSet(opts.doc).themes().map(theme => option(theme.name, theme.name, original?.scope?.modes?.[0])).join('')}</select></label>
      <label>${t('Requirement')}<select class="field-select" name="requirement">${option('required', 'Required', original?.requirement ?? 'required')}${option('advisory', 'Advisory', original?.requirement)}</select></label></div>
      <label>${t('Reviewed by')}<input class="field-input" name="author" maxlength="160" required value="${e(original?.review.state === 'approved' ? original.review.authority : original?.origin.kind === 'manual' ? original.origin.author : t('Local author'))}"></label>
      <p class="usage-hint">${t('Approval records your local decision. Required approved rules constrain the reusable poster. Example checks cover PNG output; they do not change other tools.')}</p>
      <p class="usage-message" role="status" aria-live="polite"></p>
      <footer><button type="button" class="btn" data-cancel>${t('Cancel')}</button><button type="submit" class="btn" name="decision" value="draft">${t('Save draft')}</button><button type="submit" class="btn btn--primary" name="decision" value="approved">${t('Approve & save')}</button></footer>
    </form>`, { className: 'modal usage-rule-modal', ariaLabel: t(original ? 'Edit rule' : 'Add a rule'), onClose: opts.closed });
  modal.el.addEventListener('keydown', event => { if (event.key === 'Escape') event.stopPropagation(); });
  const form = modal.el.querySelector<HTMLFormElement>('form')!;
  const field = (name: string): HTMLInputElement | HTMLSelectElement => form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement;
  const material = modal.el.querySelector<HTMLElement>('[data-rule-material]')!;
  const message = modal.el.querySelector<HTMLElement>('[role="status"]')!;
  let revision = 0, busy = false;
  const resources = async (): Promise<void> => {
    const current = ++revision, kind = field('kind').value;
    if (kind === 'text-length') {
      material.innerHTML = `<div class="usage-form-pair"><label>${t('Text field')}<select class="field-select" name="slot">${option('heading', 'Heading', String(original?.parameters.slot ?? 'heading'))}${option('body', 'Supporting text', String(original?.parameters.slot))}</select></label><label>${t('Maximum length')}<input class="field-input" name="max" type="number" min="1" max="10000" required value="${e(String(original?.parameters.max ?? 100))}"></label></div><p class="usage-hint">${t('Uses the same length limit as Lolly tool inputs (UTF-16 units). Some emoji count as more than one. Text fit is checked separately.')}</p>`;
      return;
    }
    const roles = opts.system.roles.filter(role => role.resources.length && role.resources.every(ref => kind === 'fixed-artwork' ? ref.type === 'asset' : ref.type === 'token' && createTokenSet(opts.doc).get(ref.path)?.type === (kind === 'color-choices' ? 'color' : 'fontFamily')));
    material.innerHTML = `<label>${t('Brand role')}<select class="field-select" name="role">${option('', 'Create a named role', original?.roleIds[0] ?? '')}${roles.map(role => option(role.id, role.label, original?.roleIds[0])).join('')}</select></label><div data-new-role><label>${t('Your name for this role')}<input class="field-input" name="roleLabel" maxlength="160" placeholder="${e(t('For example, Beacon or Signal ribbon'))}"></label><fieldset class="usage-resource-list"><legend>${t(kind === 'fixed-artwork' ? 'Choose one artwork file' : 'Allowed choices')}</legend><label class="usage-resource-search">${t('Find a resource')}<input class="field-input" type="search" data-resource-search placeholder="${e(t('Search names or token paths'))}"></label><div data-resources><p>${t('Reading available resources…')}</p></div></fieldset></div><p class="usage-hint" data-role-hint></p>`;
    const newRole = material.querySelector<HTMLElement>('[data-new-role]')!;
    const syncRole = (): void => {
      newRole.hidden = !!field('role').value;
      (field('roleLabel') as HTMLInputElement).required = !field('role').value;
      const role = roles.find(role => role.id === field('role').value);
      material.querySelector<HTMLElement>('[data-role-hint]')!.textContent = role ? role.resources.map(ref => ref.type === 'token' ? ref.path : ref.id).join(' · ') : t('The name is yours. Lolly maps the role to this example field.');
    };
    field('role').addEventListener('change', syncRole); syncRole();
    try {
      const rows = kind === 'fixed-artwork'
        ? (await opts.host.assets.query({})).filter(asset => ['image', 'raster', 'vector'].includes(asset.type)).map(asset => ({ value: asset.id, label: String(asset.meta?.name ?? asset.id), detail: asset.id, colour: '' }))
        : createTokenSet(opts.doc, { theme: opts.mode }).query({ type: kind === 'color-choices' ? 'color' : 'fontFamily' }).filter(token => typeof token.value === 'string' && !String(token.value).startsWith('{')).map(token => ({ value: token.path, label: String(token.value), detail: token.path, colour: kind === 'color-choices' ? String(token.value) : '' }));
      if (current !== revision || !modal.el.isConnected) return;
      material.querySelector('[data-resources]')!.innerHTML = rows.length ? rows.map(row => `<label class="usage-resource"><input class="${kind === 'fixed-artwork' ? 'field-radio' : 'field-check'}" type="${kind === 'fixed-artwork' ? 'radio' : 'checkbox'}" name="resource" value="${e(row.value)}">${row.colour ? '<span class="usage-colour-chip" aria-hidden="true"></span>' : ''}<span>${e(row.label)}<small>${e(row.detail)}</small></span></label>`).join('') : `<p>${t(kind === 'fixed-artwork' ? 'Add artwork in Logos or Files first.' : kind === 'color-choices' ? 'Add a colour in Colours first.' : 'Choose a font in Type first.')}</p>`;
      const labels = [...material.querySelectorAll<HTMLElement>('.usage-resource')];
      rows.forEach((row, index) => { const chip = labels[index]?.querySelector<HTMLElement>('.usage-colour-chip'); if (chip) chip.style.backgroundColor = row.colour; });
      material.querySelector<HTMLInputElement>('[data-resource-search]')!.addEventListener('input', event => {
        const query = (event.target as HTMLInputElement).value.trim().toLocaleLowerCase();
        labels.forEach(label => { label.hidden = !label.textContent?.toLocaleLowerCase().includes(query); });
      });
    } catch { if (current === revision) message.textContent = t('Resources could not be read. Close this dialog and try again.'); }
  };
  field('kind').addEventListener('change', () => { void resources(); });
  void resources();
  modal.el.querySelector('[data-cancel]')!.addEventListener('click', () => modal.close());
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (busy) return;
    const approved = (event.submitter as HTMLButtonElement | null)?.value === 'approved';
    const next = structuredClone(opts.system);
    const kind = field('kind').value, example = field('example').value, mode = field('mode').value, author = field('author').value.trim();
    const slot = kind === 'text-length' ? field('slot').value : brandRuleSlot(kind)!;
    let roleIds: string[] = [];
    try {
      if (kind !== 'text-length') {
        let roleId = field('role').value;
        if (!roleId) {
          const selected = [...form.querySelectorAll<HTMLInputElement>('[name="resource"]:checked')].map(input => input.value);
          if (!selected.length) throw new Error(t('Choose at least one resource for this role.'));
          const label = field('roleLabel').value.trim();
          if (!label) throw new Error(t('Give this brand role a name.'));
          roleId = `role-${crypto.randomUUID().slice(0, 12)}`;
          next.roles.push({ id: roleId, label, resources: selected.map(value => kind === 'fixed-artwork' ? { type: 'asset', id: value } : { type: 'token', path: value }) });
        }
        roleIds = [roleId];
        if (!next.bindings.some(binding => binding.roleId === roleId && binding.consumer.tool === example && binding.consumer.slot === slot && !binding.modes)) next.bindings.push({ id: `binding-${crypto.randomUUID().slice(0, 12)}`, roleId, consumer: { tool: example, slot } });
      }
      const rule: BrandRuleV1 = { id: original?.id ?? `rule-${crypto.randomUUID().slice(0, 12)}`, label: field('label').value.trim(), kind, roleIds,
        parameters: { slot, ...(kind === 'text-length' ? { max: Number(field('max').value) } : {}) }, scope: { tools: [example], outputs: ['png'], ...(mode ? { modes: [mode] } : {}) }, requirement: field('requirement').value as BrandRuleV1['requirement'], origin: { kind: 'manual', author }, review: approved ? { state: 'approved', authority: author } : { state: 'draft' }, ...(original?.description ? { description: original.description } : {}) };
      const validation = resolveBrandRule(rule, next, opts.doc, { tool: example, mode: mode || opts.mode, output: 'png' });
      if (!validation.constraint) throw new Error(validation.reason);
      busy = true;
      for (const button of form.querySelectorAll<HTMLButtonElement>('button')) button.disabled = true;
      message.textContent = t('Saving rule…');
      await opts.save(replaceUsageRule(next, rule));
      modal.close();
    } catch (error) { message.textContent = (error as Error).message; }
    finally { busy = false; for (const button of form.querySelectorAll<HTMLButtonElement>('button')) button.disabled = false; }
  });
  return modal;
}
