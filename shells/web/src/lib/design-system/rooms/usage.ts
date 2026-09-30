// SPDX-License-Identifier: MPL-2.0
import type { BrandSystemV1 } from '@lolly-tools/core/brand-system-v1';
import { BRAND_EXAMPLES, BRAND_RULE_KINDS, type BrandExample } from '../../../../../../engine/src/brand-rules.ts';
import { createTokenSet } from '../../../../../../engine/src/tokens.ts';

import { mountModal, type ModalHandle } from '../../../components/modal.ts';
import { t } from '../../../i18n.ts';
import { icon } from '../../icons.ts';
import { escape as e } from '../../../utils.ts';
import { brandExample, EXAMPLE_LABELS, EXAMPLE_TEXT, type ExampleText } from '../brand-examples.ts';
import { usageRevision, usageSystem, withUsageSystem, usageDependencies, removeUsageRule } from '../usage-model.ts';
import { editUsageRule, RULE_LABELS } from '../usage-editor.ts';
import type { BrandExampleProof } from '../example-proof.ts';
import type { StudioState } from '../studio-state.ts';

import type { UsageHost } from '../usage-model.ts';

export function mountUsageRoom(el: HTMLElement, opts: { host: UsageHost; readonly?: boolean; studio?: StudioState; changed?(): void }) {
  let doc: unknown, system: BrandSystemV1, mode = '', text: ExampleText = { ...EXAMPLE_TEXT };
  let modal: ModalHandle<void> | undefined, disposed = false, sequence = 0, abort: AbortController | undefined;
  let dependency = '', activeLabel = '', working = false;
  const failures = new Map<BrandExample, string>();
  const readDoc = () => opts.readonly ? opts.host.tokens.snapshot().then(snapshot => snapshot.document) : opts.host.tokens.raw();
  const results = new Map<BrandExample, BrandExampleProof>();
  const urls = new Set<string>();
  el.classList.add('usage-room');
  const clearResults = (): void => {
    abort?.abort(); abort = undefined; sequence++; working = false;
    const runButton = el.querySelector<HTMLButtonElement>('[data-run]'); if (runButton) runButton.disabled = false;
    for (const url of urls) URL.revokeObjectURL(url); urls.clear(); results.clear(); failures.clear();
  };
  const status = (message: string): void => { const node = el.querySelector<HTMLElement>('[data-usage-status]'); if (node) node.textContent = message; };
  const invalidate = (): void => { clearResults(); if (el.querySelector('[data-examples]')) { paintExamples(); status(t('Examples changed. Run the checks again.')); } };
  const paintExamples = (): void => {
    for (const url of urls) URL.revokeObjectURL(url); urls.clear();
    const container = el.querySelector<HTMLElement>('[data-examples]')!;
    const expanded = new Set([...container.querySelectorAll('article:has(details[open])')].map(card => (card as HTMLElement).dataset.example));
    container.innerHTML = BRAND_EXAMPLES.map(id => {
      const result = results.get(id), failure = failures.get(id);
      let url = '';
      if (result) { url = URL.createObjectURL(result.blob); urls.add(url); }
      const active = result?.rules.filter(rule => rule.state !== 'outside') ?? [];
      const passed = active.filter(rule => rule.state === 'pass').length;
      return `<article class="usage-example" data-example="${id}"><div class="usage-example-image">${url ? `<img src="${url}" alt="${e(t('{name} with your brand', { name: t(EXAMPLE_LABELS[id]) }))}">` : `<span aria-hidden="true">${icon(id === 'brand-chart' ? 'table' : 'document', { size: 32 })}</span><p>${t(failure ? 'Could not render' : 'Ready to render')}</p>`}</div><div class="usage-example-body"><div class="usage-example-title"><h3>${t(EXAMPLE_LABELS[id])}</h3>${result ? `<span class="usage-badge" data-state="${result.state}">${t(result.state === 'blocked' ? 'Needs changes' : result.state === 'draft' ? 'Partly unchecked' : 'Measured')}</span>` : ''}</div>
      <p class="usage-hint">${result ? active.length ? t('{passed} of {total} applicable rules met', { passed, total: active.length }) : t('No brand rules apply to this example.') : t(id === 'brand-chart' ? 'One data series, labels and brand colour.' : id === 'brand-slide-content' ? 'Longer text in a bounded slide layout.' : id === 'brand-poster' ? 'A headline, supporting text and fixed artwork.' : 'A large heading and an opening line.')}</p>
      ${failure ? `<p class="usage-message usage-message--error">${e(failure)}</p>` : ''}${result ? `<details class="usage-details"><summary>${t('See checks & sources')}</summary><ul>${result.checks.map(check => `<li><span class="usage-check-state" data-state="${check.state}">${t(check.state === 'pass' ? 'Measured' : check.state === 'fail' ? 'Issue' : 'Unchecked')}</span><strong>${e(t(check.label))}</strong><p>${e(t(check.detail))}</p></li>`).join('')}${active.map(rule => `<li><span class="usage-check-state" data-state="${rule.state}">${t(rule.state === 'pass' ? 'Met' : rule.state === 'fail' ? 'Issue' : 'Unchecked')}</span><strong>${e(system.rules.find(item => item.id === rule.id)?.label ?? rule.id)}</strong><p>${e(t(rule.reason))}</p></li>`).join('')}</ul><p class="usage-hint">${t('Font and layout facts come from the mounted source. The PNG is checked independently for its format and dimensions. This is not a brand approval.')}</p><p class="usage-hint">${t('Output identity')}: <code>${result.report.artifactSha256.slice(0, 16)}</code></p><button class="btn btn--sm" type="button" data-report="${id}">${t('Download check report')}</button></details><div class="usage-example-actions"><button class="btn btn--sm" type="button" data-image="${id}"${working || result.state === 'blocked' ? ' disabled' : ''}>${t(result.state === 'draft' ? 'Download draft PNG' : 'Download PNG')}</button>${id === 'brand-poster' ? `<button class="btn btn--sm" type="button" data-package${working || result.state !== 'checked' ? ' disabled' : ''}>${t('Make reusable poster')}</button>` : ''}</div>` : ''}</div></article>`;
    }).join('');
    for (const card of container.querySelectorAll<HTMLElement>('article')) if (expanded.has(card.dataset.example)) card.querySelector('details')?.setAttribute('open', '');
  };
  const paint = (): void => {
    const themes = createTokenSet(doc).themes();
    const groupFor = (id: string): string => system.guide?.groups.find(group => group.ruleIds.includes(id))?.label ?? '';
    el.innerHTML = `<header class="usage-head"><div><p class="start-eyebrow">${e(activeLabel || system.label)}</p><h2>${t('Usage & rules')}</h2><p>${t('Put your brand’s choices to work. See what people can change, what stays fixed and what Lolly can check.')}</p></div>${!opts.readonly ? `<button class="btn btn--primary" type="button" data-add>${icon('plus', { size: 16 })} ${t('Add rule')}</button>` : `<span class="usage-badge">${t('Read-only')}</span>`}</header>
      <section class="usage-rules" aria-label="${e(t('Brand rules'))}">${system.rules.length ? system.rules.map(rule => {
        const supported = (BRAND_RULE_KINDS as readonly string[]).includes(rule.kind);
        const editable = supported && Object.keys(rule.parameters).every(key => (rule.kind === 'text-length' ? ['slot', 'max'] : ['slot']).includes(key)) && rule.roleIds.length <= 1 && rule.scope?.tools?.length === 1 && rule.scope.outputs?.length === 1 && rule.scope.outputs[0] === 'png' && (!rule.scope.modes || rule.scope.modes.length <= 1);
        const names = rule.roleIds.map(id => system.roles.find(role => role.id === id)?.label ?? id);
        const scope = rule.scope?.tools?.map(id => EXAMPLE_LABELS[id as BrandExample] ?? id).join(', ') || t('Any tool');
        return `<article class="usage-rule"><div class="usage-rule-icon" aria-hidden="true">${icon(rule.kind === 'font-choices' ? 'font' : rule.kind === 'color-choices' ? 'palette' : 'document', { size: 20 })}</div><div class="usage-rule-copy">${groupFor(rule.id) ? `<p class="start-eyebrow">${e(groupFor(rule.id))}</p>` : ''}<h3>${e(rule.label)}</h3><p>${e(names.join(' · ') || t(RULE_LABELS[rule.kind] ?? rule.kind))}</p><p class="usage-hint">${e(scope)} · ${e(rule.scope?.modes?.join(', ') || t('Every mode'))} · ${e(rule.scope?.outputs?.join(', ').toUpperCase() || t('Any format'))}</p><details class="usage-details"><summary>${t('Rule details')}</summary><p>${e(rule.description ?? '')}</p><p>${e(t(supported ? rule.kind === 'color-choices' ? 'This role sets the poster heading colour, slide accent line or chart palette seed, according to the selected example. Other colours are outside this rule.' : rule.kind === 'font-choices' ? 'The text uses a font family from this role. Font files and glyph coverage are checked separately.' : rule.kind === 'fixed-artwork' ? 'This artwork is included in the example and has no editable input in the reusable poster.' : 'The text field must fit the saved length limit. Visual fit is checked separately.' : 'This rule is retained as supplied. This build has no checker for it.'))}</p><ul>${rule.roleIds.flatMap(id => system.roles.find(role => role.id === id)?.resources ?? []).map(ref => `<li><code>${e(ref.type === 'token' ? ref.path : ref.id)}</code></li>`).join('')}</ul>${rule.kind === 'text-length' ? `<p>${t('Maximum')}: ${e(String(rule.parameters.max))} · ${e(String(rule.parameters.slot))}</p>` : ''}<p>${e(rule.origin.kind === 'manual' ? t('Recorded by {name}', { name: rule.origin.author }) : `${rule.origin.reference}${rule.origin.locator ? ` · ${rule.origin.locator}` : ''}`)}</p>${rule.review.state === 'approved' ? `<p>${e(t('Approved locally by {name}', { name: rule.review.authority }))}</p>` : ''}${!opts.readonly ? `<button class="btn btn--sm" type="button" data-remove="${e(rule.id)}">${t('Remove rule')}</button>` : ''}</details></div><div class="usage-rule-meta"><span class="usage-badge">${t(!supported ? 'Unchecked' : rule.review.state === 'draft' ? 'Draft' : rule.requirement === 'required' ? 'Required' : 'Advisory')}</span>${!opts.readonly && editable ? `<button class="btn btn--sm" type="button" data-edit="${e(rule.id)}">${t('Edit')}</button>` : ''}</div></article>`;
      }).join('') : `<div class="usage-empty">${icon('document', { size: 28 })}<h3>${t(opts.readonly ? 'No rules published yet' : 'Start with one useful rule')}</h3><p>${t(opts.readonly ? 'The examples below use this design system’s current tokens. Published rules will appear here when the source includes them.' : 'A named colour choice, a font, fixed artwork or a text limit. You choose the terminology and the example it applies to.')}</p>${!opts.readonly ? `<button class="btn" type="button" data-add>${t('Add your first rule')}</button>` : ''}</div>`}</section>
      <section class="usage-proof"><header class="usage-head"><div><h2>${t('Try your brand in use')}</h2><p>${t('Render four examples from this revision. Checks apply to these PNGs and their source facts only.')}</p></div><button type="button" class="btn btn--primary" data-run>${t('Render & check examples')}</button></header>
      <div class="usage-proof-controls">${themes.length ? `<label>${t('Brand mode')}<select class="field-select" data-mode><option value="">${t('Default')}</option>${themes.map(theme => `<option value="${e(theme.name)}"${mode === theme.name ? ' selected' : ''}>${e(theme.name)}</option>`).join('')}</select></label>` : ''}<details class="usage-details"><summary>${t('Try your own text')}</summary><div class="usage-sample-fields"><label>${t('Heading')}<input class="field-input" data-text="heading" maxlength="1000" value="${e(text.heading)}"></label><label>${t('Supporting text')}<textarea class="field-input" data-text="body" maxlength="4000" rows="2">${e(text.body)}</textarea></label><label>${t('Content slide text')}<textarea class="field-input" data-text="dense" maxlength="10000" rows="5">${e(text.dense)}</textarea></label></div></details></div><p data-usage-status class="usage-message" role="status" aria-live="polite">${t('Examples are local. Nothing is published or approved by running a check.')}</p><div class="usage-examples" data-examples></div></section>`;
    paintExamples();
  };
  const refresh = async (): Promise<void> => {
    clearResults(); const current = sequence;
    try {
      const [nextDoc, active] = await Promise.all([readDoc(), opts.host.tokens.active()]);
      if (disposed || current !== sequence) return;
      doc = nextDoc; activeLabel = active?.label || t('Your brand'); system = usageSystem(doc, activeLabel); paint();
    } catch (error) { if (!disposed) el.textContent = error instanceof Error ? error.message : t('The usage guide could not be read. Open this room again to retry.'); }
  };
  const edit = async (id?: string): Promise<void> => {
    if (opts.readonly || modal) return;
    try {
      const revision = await usageRevision(opts.host);
      if (disposed) return;
      const currentSystem = usageSystem(revision.doc, system.label);
      modal = editUsageRule({ host: opts.host, doc: revision.doc, system: currentSystem, mode, rule: currentSystem.rules.find(rule => rule.id === id), closed() { modal = undefined; }, async save(next) {
        const candidate = await opts.host.brandAdoption.prepare(revision.snapshot, { doc: withUsageSystem(revision.doc, next) });
        await opts.studio?.load(); await opts.studio?.checkpoint(t('Before editing brand rules'));
        await opts.host.brandAdoption.commit(candidate, { recovery: false });
        await opts.studio?.load(); opts.changed?.(); await refresh();
      } });
    } catch (error) { status((error as Error).message); }
  };
  const remove = async (id: string): Promise<void> => {
    if (opts.readonly || modal) return;
    try {
      const revision = await usageRevision(opts.host);
      if (disposed) return;
      const currentSystem = usageSystem(revision.doc, system.label);
      const rule = currentSystem.rules.find(item => item.id === id); if (!rule) return;
      modal = mountModal(`<header><h2>${t('Remove rule?')}</h2><p>${e(rule.label)}</p><p>${t('A checkpoint keeps this revision available in Restore brand settings. The brand role and its resources stay available.')}</p></header><p role="status" class="usage-message"></p><footer><button class="btn" data-cancel>${t('Cancel')}</button><button class="btn btn--primary" data-confirm>${t('Remove rule')}</button></footer>`, { className: 'modal usage-rule-modal', ariaLabel: t('Remove rule'), onClose() { modal = undefined; } });
      const dialog = modal;
      dialog.el.addEventListener('keydown', event => { if (event.key === 'Escape') event.stopPropagation(); });
      dialog.el.querySelector('[data-cancel]')!.addEventListener('click', () => dialog.close());
      dialog.el.querySelector('[data-confirm]')!.addEventListener('click', async event => {
        const button = event.currentTarget as HTMLButtonElement; button.disabled = true;
        try {
          const candidate = await opts.host.brandAdoption.prepare(revision.snapshot, { doc: withUsageSystem(revision.doc, removeUsageRule(currentSystem, id)) });
          await opts.studio?.load(); await opts.studio?.checkpoint(t('Before removing a brand rule'));
          await opts.host.brandAdoption.commit(candidate, { recovery: false });
          await opts.studio?.load(); opts.changed?.(); dialog.close(); await refresh();
        } catch (error) { dialog.el.querySelector('[role="status"]')!.textContent = (error as Error).message; button.disabled = false; }
      });
    } catch (error) { status((error as Error).message); }
  };
  const run = async (): Promise<void> => {
    clearResults(); working = true; paintExamples();
    const controller = new AbortController(); abort = controller; const current = sequence;
    const runButton = el.querySelector<HTMLButtonElement>('[data-run]')!; runButton.disabled = true;
    try {
      const latest = await readDoc();
      if (JSON.stringify(latest) !== JSON.stringify(doc)) { await refresh(); status(t('The brand changed. Run the examples again.')); return; }
      dependency = await usageDependencies(opts.host, latest);
      const { renderBrandExample } = await import('../example-proof.ts');
      for (const id of BRAND_EXAMPLES) {
        status(t('Rendering {name}…', { name: t(EXAMPLE_LABELS[id]) }));
        try {
          const result = await renderBrandExample(opts.host, doc, system, mode, id, text, controller.signal);
          if (disposed || current !== sequence) return;
          results.set(id, result); paintExamples();
        } catch (error) {
          controller.signal.throwIfAborted();
          failures.set(id, (error as Error).message); paintExamples();
        }
      }
      if (dependency !== await usageDependencies(opts.host, await readDoc())) { invalidate(); return; }
      status(failures.size ? t('{count} of four examples rendered. Review the messages on the remaining examples, then try again.', { count: results.size }) : t('Checks complete for this revision. Open each example to inspect its coverage.'));
    } catch (error) { if (!controller.signal.aborted) status((error as Error).message); }
    finally { if (current === sequence) { abort = undefined; working = false; runButton.disabled = false; paintExamples(); } }
  };
  const download = async (id: BrandExample, reportOnly = false, makeTool = false): Promise<void> => {
    const previous = results.get(id); if (!previous) return;
    if (reportOnly) { await opts.host.export.download(new Blob([JSON.stringify(previous.report, null, 2)], { type: 'application/json' }), `${id}${previous.state === 'draft' ? '-DRAFT' : ''}-checks.json`); return; }
    const controller = new AbortController(); abort?.abort(); abort = controller;
    const current = ++sequence; working = true; paintExamples();
    status(t(makeTool ? 'Preparing the reusable poster and checking its packaged fonts…' : 'Rechecking this revision before download…'));
    try {
      const latest = await readDoc();
      if (JSON.stringify(latest) !== JSON.stringify(doc)) { await refresh(); status(t('The brand changed. Run the examples again.')); return; }
      const before = await usageDependencies(opts.host, latest);
      let include: ReadonlySet<string> | undefined;
      if (makeTool) {
        const [{ designToolRights }, { reviewUsageArtwork }] = await Promise.all([import('../../design-tool-compile.ts'), import('../usage-package.ts')]);
        const example = await brandExample(id, doc, system, mode, text);
        const held = await designToolRights(example.draft!, opts.host);
        controller.signal.throwIfAborted();
        const approved = await reviewUsageArtwork(held, controller.signal, handle => { modal = handle; });
        if (!approved) { status(t('Poster preparation cancelled.')); return; }
        include = approved;
      }
      const { renderBrandExample } = await import('../example-proof.ts');
      const result = await renderBrandExample(opts.host, doc, system, mode, id, text, controller.signal, makeTool, include);
      controller.signal.throwIfAborted(); if (disposed || current !== sequence) return;
      if (before !== await usageDependencies(opts.host, await readDoc())) { invalidate(); return; }
      dependency = before; results.set(id, result); paintExamples();
      if (result.state === 'blocked') { status(t('Resolve the reported issues before downloading this example.')); return; }
      if (makeTool && result.compiled) {
        const [{ preflightDesignTool }, { buildLollyFile, readLollyFile }] = await Promise.all([import('../../design-tool-preflight.ts'), import('../../lolly-pack.ts')]);
        await preflightDesignTool(result.compiled, opts.host, { signal: controller.signal, checkInputs: true });
        const compiled = result.compiled;
        const files = Object.fromEntries(Object.entries(compiled.files).map(([name, value]) => [name, typeof value === 'string' ? new TextEncoder().encode(value) : value]));
        files['brand-rules.json'] = new TextEncoder().encode(JSON.stringify({ system, mode, report: result.report }, null, 2));
        const packed = await buildLollyFile({ kind: 'tool', session: null, toolId: compiled.manifest.id, toolVersion: compiled.manifest.version, name: compiled.manifest.name, userAssets: [], toolCredits: JSON.parse(String(compiled.files['compilation.json'])).dependencies.map((item: { credit?: string }) => item.credit).filter(Boolean).join('\n\n'), tool: { id: compiled.manifest.id, version: compiled.manifest.version, trust: 'custom', files } });
        await readLollyFile(new Uint8Array(await packed.blob.arrayBuffer()));
        controller.signal.throwIfAborted();
        if (before !== await usageDependencies(opts.host, await readDoc())) { invalidate(); return; }
        await opts.host.export.download(packed.blob, packed.filename);
        status(t('Downloaded a reusable poster. Its fixed layout and approved input choices travel with the file.'));
      } else {
        await opts.host.export.download(result.blob, `${id}${result.state === 'draft' ? '-DRAFT' : ''}.png`);
        status(t(result.state === 'draft' ? 'Downloaded as a draft. Required facts remain unchecked.' : 'Downloaded this measured example. This does not approve the brand.'));
      }
    } catch (error) { if (!controller.signal.aborted) status((error as Error).message); }
    finally { if (current === sequence) { abort = undefined; working = false; paintExamples(); } }
  };
  el.addEventListener('click', event => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button'); if (!button || button.disabled) return;
    if (button.hasAttribute('data-add')) void edit();
    if (button.dataset.edit) void edit(button.dataset.edit);
    if (button.dataset.remove) void remove(button.dataset.remove);
    if (button.hasAttribute('data-run')) void run();
    if (button.dataset.report) void download(button.dataset.report as BrandExample, true);
    if (button.dataset.image) void download(button.dataset.image as BrandExample);
    if (button.hasAttribute('data-package')) void download('brand-poster', false, true);
  });
  el.addEventListener('input', event => {
    const target = event.target as HTMLInputElement;
    if (target.dataset.text) { text = { ...text, [target.dataset.text]: target.value }; invalidate(); }
  });
  el.addEventListener('change', event => { const target = event.target as HTMLSelectElement; if (target.hasAttribute('data-mode')) { mode = target.value; invalidate(); } });
  const onFocus = (): void => {
    if (!results.size) return;
    void readDoc().then(async latest => {
      const stamp = await usageDependencies(opts.host, latest);
      if (!disposed && stamp !== dependency) invalidate();
    }).catch(() => { if (!disposed) invalidate(); });
  };
  window.addEventListener('focus', onFocus);
  document.addEventListener('lolly:user-asset-deleted', invalidate);
  void refresh();
  return { refresh, modalOpen: () => !!modal, suspend: invalidate, teardown() { disposed = true; clearResults(); modal?.close(); window.removeEventListener('focus', onFocus); document.removeEventListener('lolly:user-asset-deleted', invalidate); } };
}
export type UsageRoom = ReturnType<typeof mountUsageRoom>;
