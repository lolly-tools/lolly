// SPDX-License-Identifier: MPL-2.0
import type { HostV1, TokenInspection, TokenResolveOptions } from '@lolly-tools/core/host-v1';
import { inspectTokenDocument, diffTokenDocuments } from '../../../../engine/src/token-inspect.ts';
import { generateTokenRecipe, readTokenRecipes, type TokenRecipe } from '../../../../engine/src/token-recipes.ts';
import { withTokenSourceValue } from '../../../../engine/src/token-edit.ts';
import { mergeTokenDocuments, decideTokenMergeConflict, type TokenMergeConflict } from '../../../../engine/src/token-merge.ts';
import { TOKEN_EXT } from '../../../../engine/src/token-ext.ts';
import { sha256Hex } from '../../../../engine/src/bytes.ts';
import { tokenSetNames } from '../../../../engine/src/token-selection.ts';
import { canonicalJson } from '../../../../engine/src/canonical-json.ts';
import { createTokenSet, colorToHex } from '../../../../engine/src/tokens.ts';
import { usageDependencies } from '../lib/design-system/usage-model.ts';
import { createTokenConsumerCheck, type TokenConsumerSources } from '../lib/token-consumer-index.ts';
import { escape as esc } from '../utils.ts';
import { t, tRaw } from '../i18n.ts';
import { tokenPreviewHtml, tokenTypeLabel, tokenValueText } from './token-preview.ts';
import { changeSummaryHtml } from './change-summary.ts';
import { mountModal } from './modal.ts';


export interface TokenWorkspaceOptions {
  read(): unknown;
  label?: string;
  context?: 'Editable head' | 'Render version' | 'Preview';
  initialSelection?: Record<string, string>;
  host?: HostV1;
  /** The caller owns persistence, policy and undo. Absent means inspection only. */
  commit?(candidate: Record<string, unknown>): void | Promise<void>;
  /** Saved work and mounted tools to search for uses. Absent hides that check. */
  consumers?: TokenConsumerSources;
}
/** A value as one line: bare strings, shadows and font lists read as text, the rest as JSON. */
const text = (v: unknown, type?: string | null): string => v === undefined ? t('Unavailable') : tokenValueText(type, v);
const DETAIL_LIMIT = 100;
const PAGE_SIZE = 100;
const sentenceCase = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
/** The context chip: an editable head reads as the current draft, or read-only with no way to commit. */
const contextLabel = (context: TokenWorkspaceOptions['context'], editable: boolean): string =>
  context === 'Render version' ? t('Render version') : context === 'Preview' ? t('Preview') : editable ? t('Current draft') : t('Read-only');

/** Shared retained-source browser, dimension preview and revision-bound review. */
export function mountTokenWorkspace(mount: HTMLElement, options: TokenWorkspaceOptions) {
  const abort = new AbortController();
  let disposed = false, page = 0, selected = '', history: string[] = [];
  let choices = options.initialSelection ? { ...options.initialSelection } : undefined;
  let renderChoices: Record<string, string> | undefined;
  let inspection: TokenInspection;
  let proofDispose: (() => void) | undefined;
  let reviewGeneration = 0;
  let review: { base: string; candidate: Record<string, unknown>; conflicts: TokenMergeConflict[]; decisions: Record<string, 'local' | 'incoming'>; beforeOptions: TokenResolveOptions; afterOptions: TokenResolveOptions; dependencies?: string; resourceError?: string } | null = null;

  mount.classList.add('token-workspace');
  mount.innerHTML = `<header class="tw-context section-header"><h3 class="section-header-title">${esc(options.label ?? t('Token workspace'))}</h3><span class="chip chip--status" data-tw-context>${esc(contextLabel(options.context, !!options.commit))}</span></header>
    <p class="section-header-sub">${t('Every token in this system, with where its value comes from. Theme choices here preview the design; the app’s own appearance is a separate setting.')}</p>
    <div data-tw-themes class="tw-themes"></div><button type="button" class="btn btn--ghost" data-tw-return-choices hidden>${t('Return to render choices')}</button><button type="button" class="btn btn--ghost" data-tw-apply-choices hidden>${t('Use these choices for this system')}</button>
    <p data-tw-status role="status" aria-live="polite"></p>
    <div class="tw-filters"><label>${t('Search tokens')}<input class="field-input" type="search" data-tw-search></label><label>${t('Type')}<select class="field-select" data-tw-type></select></label><label>${t('From set')}<select class="field-select" data-tw-set></select></label><label class="tw-issues"><input class="field-check" type="checkbox" data-tw-issues> ${t('Issues only')}</label></div>
    <p data-tw-count></p><div class="tw-browser"><div><ul class="tw-list" data-tw-list></ul><div class="tw-pages" hidden><button type="button" class="btn btn--ghost" data-tw-prev>${t('Previous')}</button><button type="button" class="btn btn--ghost" data-tw-next>${t('Next')}</button></div></div><section class="tw-detail card card--sub" data-tw-detail aria-label="${esc(t('Token details'))}" tabindex="-1"></section></div>
    <div data-tw-authoring ${options.commit ? '' : 'hidden'}><details class="section-card"><summary class="section-card-summary"><span class="section-card-title">${t('Generate a scale')}</span></summary><form data-tw-recipe class="tw-recipe"><label>${t('Existing recipe')}<select class="field-select" data-tw-existing-recipe><option value="">${t('New recipe')}</option></select></label><input type="hidden" name="id"><label>${t('Recipe')}<select class="field-select" name="kind"><option value="spacing">${t('Spacing')}</option><option value="type">${t('Modular type')}</option><option value="color">${t('Colour ramp')}</option></select></label><label>${t('Path')}<input class="field-input" name="prefix" value="generated.spacing" required></label><label>${t('Source set')}<select class="field-select" name="set" data-tw-recipe-set></select></label><label>${t('Steps')}<input class="field-input" name="count" type="number" value="8" min="2" max="32" required></label><label data-tw-recipe-field="base">${t('Base in pixels')}<input class="field-input" name="base" type="number" value="4" min="0.01" max="10000" step="any" required></label><label data-tw-recipe-field="ratio" hidden>${t('Ratio')}<input class="field-input" name="ratio" type="number" value="1.25" min="1" max="4" step="any" required></label><label data-tw-recipe-field="seed" hidden>${t('Colour seed')}<input class="field-input" name="seed" value="#7c3aed"></label><button type="submit" class="btn btn--ghost">${t('Review generated tokens')}</button></form></details>
    <details class="section-card"><summary class="section-card-summary"><span class="section-card-title">${t('Review an upstream update')}</span></summary><p>${t('Got a newer tokens file from your design team? Compare it with the one you started from. Conflicts keep your values, and nothing changes until you apply.')}</p><form data-tw-upstream><label>${t('Incoming revision')}<input class="field-input" name="revision" maxlength="256" placeholder="${esc(t('Optional. The incoming file’s name is used otherwise.'))}"></label><label>${t('Earlier source JSON')}<input class="field-input" type="file" name="base" accept=".json,application/json" required></label><label>${t('Incoming source JSON')}<input class="field-input" type="file" name="incoming" accept=".json,application/json" required></label><button type="submit" class="btn btn--ghost">${t('Compare update')}</button></form></details></div>
    <section data-tw-review hidden></section>`;
  const find = <T extends HTMLElement>(selector: string): T => mount.querySelector<T>(selector)!;
  const status = (message: string): void => { find('[data-tw-status]').textContent = message; };
  const on = (el: HTMLElement, event: string, fn: EventListener): void => { el.addEventListener(event, fn, { signal: abort.signal }); };
  const resolveOptions = (): TokenResolveOptions => ({ selection: choices });
  const consumers = options.consumers ? createTokenConsumerCheck(options.consumers, { root: () => mount, announce: message => { status(message); } }) : undefined;
  const select = (path: string, push = true): void => {
    if (push && selected) { history.push(selected); history = history.slice(-64); }
    selected = path;
    renderDetails(); renderList();
    find('[data-tw-detail]').focus();
  };
  /** `filtered`: called because a filter changed, so a selection the filters now hide says so. */
  function renderDetails(filtered = false): void {
    const token = inspection.tokens.find(x => x.path === selected);
    const detail = find('[data-tw-detail]');
    if (!token) { detail.textContent = t('Choose a token to inspect its value, references and source.'); return; }
    if (filtered && !matching().some(x => x.path === token.path)) {
      detail.innerHTML = `<p>${esc(tRaw('{path} is hidden by the current filters.', { path: token.path }))}</p><button type="button" class="btn btn--ghost" data-tw-clear>${t('Clear filters')}</button>`;
      return;
    }
    const recipe = readTokenRecipes(options.read()).find(r => r.set === (token.source?.set ?? undefined) && r.paths.includes(token.path));
    const links = (paths: string[]): string => paths.length ? `<ul>${paths.slice(0, DETAIL_LIMIT).map(p => `<li><button type="button" class="btn btn--ghost" data-tw-ref="${esc(p)}">${esc(p)}</button></li>`).join('')}</ul>${paths.length > DETAIL_LIMIT ? `<p>${t('Showing {shown} of {total} references. Search tokens to find the rest.', { shown: DETAIL_LIMIT, total: paths.length })}</p>` : ''}` : `<p>${t('None recorded')}</p>`;
    detail.innerHTML = `<button type="button" class="btn btn--ghost" data-tw-back ${history.length ? '' : 'disabled'}>${t('Back to previous token')}</button><h4>${esc(token.path)}</h4><p>${esc(tokenTypeLabel(token.type))} · ${token.source ? esc(token.source.set ?? t('Implicit set')) : t('Inactive definition')}</p>
      ${token.source?.description ? `<p>${esc(token.source.description)}</p>` : ''}<h5>${t('Value')}</h5><dl><dt>${t('Written as')}</dt><dd>${tokenPreviewHtml(token.type, token.authored, { path: token.path })}<code>${esc(text(token.authored, token.type))}</code></dd><dt>${t('Resolves to')}</dt><dd>${tokenPreviewHtml(token.type, token.resolved, { path: token.path })}<code>${esc(text(token.resolved, token.type))}</code></dd></dl>
      ${options.commit && token.source ? `<details class="section-card"><summary class="section-card-summary"><span class="section-card-title">${t('Edit the value')}</span></summary><p>${t('This edits the winning token definition in this system. Linked input overrides have their own controls.')}</p><textarea class="field-input" data-tw-source-value rows="4" aria-describedby="tw-source-err">${esc(typeof token.authored === 'string' ? token.authored : JSON.stringify(token.authored, null, 2))}</textarea><p class="be-err" id="tw-source-err" data-tw-source-err hidden></p><button type="button" class="btn btn--ghost" data-tw-edit-source>${t('Review source edit')}</button></details>` : ''}
      ${recipe ? `<h5>${t('Generation recipe')}</h5><p>${esc(recipe.id)} · ${esc(recipe.kind)} · v${recipe.version}</p><pre>${esc(JSON.stringify({ base: recipe.base, ratio: recipe.ratio, seed: recipe.seed, count: recipe.count }))}</pre><p>${canonicalJson(token.authored) !== canonicalJson(recipe.outputs[token.path]) || Object.hasOwn(recipe.overrides ?? {}, token.path) ? t('Local generated-value override') : t('Generated value')}</p>${options.commit ? `<button type="button" class="btn btn--ghost" data-tw-reset-generated>${t('Use generated value')}</button>` : ''}` : ''}<h5>${t('References')}</h5>${links(token.references)}<h5>${t('Used by')}</h5><p>${t('Token references in this document only. Dynamic tool hooks and other documents are outside this count.')}</p>${links(token.usedBy)}${consumers?.html(token.path) ?? ''}
      <h5>${t('Issues')}</h5>${token.diagnostics.length ? `<ul>${token.diagnostics.map(d => `<li>${esc(d.message)}</li>`).join('')}</ul>` : `<p>${t('No reference issues found')}</p>`}
      ${token.declaredConsumers?.length ? `<h5>${t('Declared roles and slots')}</h5><p>${t('Declarations in this source document. These are not observed render usage or rule checks.')}</p><ul>${token.declaredConsumers.map(consumer => `<li><strong>${esc(consumer.label)}</strong> <code>${esc(consumer.roleId)}</code>${consumer.bindings.length ? `<ul>${consumer.bindings.map(binding => `<li><code>${esc(binding.tool ?? t('Any tool'))} / ${esc(binding.slot)}</code>${binding.modes?.length ? ` · ${esc(binding.modes.join(', '))}` : ''}</li>`).join('')}</ul>` : ''}</li>`).join('')}</ul>` : ''}
      <h5>${t('Where this value comes from')}</h5><ol>${token.candidates.map(c => `<li><strong>${esc(c.set ?? t('Implicit set'))}</strong> · ${c.active ? c === token.source ? t('Used') : t('Overridden') : t('Inactive')}<code>${esc(c.location)}</code><pre>${esc(text(c.value, token.type))}</pre></li>`).join('')}</ol>`;
  }
  /** The tokens the search, type, set and Issues filters let through. */
  function matching(): TokenInspection['tokens'] {
    const search = find<HTMLInputElement>('[data-tw-search]').value.toLowerCase();
    const type = find<HTMLSelectElement>('[data-tw-type]').value, set = find<HTMLSelectElement>('[data-tw-set]').value;
    const issues = find<HTMLInputElement>('[data-tw-issues]').checked;
    return inspection.tokens.filter(x => x.path.toLowerCase().includes(search) && (!type || x.type === type) && (!set || x.candidates.some(c => (c.set ?? '') === set)) && (!issues || x.diagnostics.length));
  }
  function renderList(): void {
    const matches = matching();
    const pages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
    page = Math.min(page, pages - 1);
    const n = matches.length;
    find('[data-tw-count]').textContent = `${tRaw(n === 1 ? '{n} token' : '{n} tokens', { n })}${pages > 1 ? ` · ${tRaw('Page {p} of {total}', { p: page + 1, total: pages })}` : ''}`;
    find('.tw-pages').hidden = n <= PAGE_SIZE;
    // "Active" says something only when some definition in the document is not.
    const someInactive = inspection.tokens.some(x => !x.source);
    const list = find('[data-tw-list]');
    if (!n) {
      const search = find<HTMLInputElement>('[data-tw-search]').value.trim();
      const issuesOnly = find<HTMLInputElement>('[data-tw-issues]').checked && !search && !find<HTMLSelectElement>('[data-tw-type]').value && !find<HTMLSelectElement>('[data-tw-set]').value;
      const message = search ? t('No tokens match “{query}”.', { query: search }) : issuesOnly ? t('No reference issues found.') : t('No tokens match these filters.');
      list.innerHTML = `<li class="tw-empty"><p>${message}</p><button type="button" class="btn btn--ghost" data-tw-clear>${t('Clear filters')}</button></li>`;
    } else {
      list.innerHTML = matches.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE).map(x => {
        const value = x.resolved ?? x.candidates[0]?.value;
        return `<li><button type="button" class="btn btn--ghost" data-tw-token="${esc(x.path)}" aria-pressed="${x.path === selected}"><strong>${esc(x.path)}</strong><span>${esc(tokenTypeLabel(x.type))}${someInactive ? ` · ${x.source ? t('Active') : t('Inactive')}` : ''}</span><span class="tw-value">${tokenPreviewHtml(x.type, value, { path: x.path })}<code>${esc(text(value, x.type))}</code></span>${x.diagnostics.length ? `<span>${x.diagnostics.length} ${t('issues')}</span>` : ''}</button></li>`;
      }).join('');
    }
    find<HTMLButtonElement>('[data-tw-prev]').disabled = page === 0;
    find<HTMLButtonElement>('[data-tw-next]').disabled = (page + 1) * PAGE_SIZE >= n;
  }
  /** Search, type, set and Issues back to showing everything. */
  function clearFilters(): void {
    find<HTMLInputElement>('[data-tw-search]').value = '';
    find<HTMLSelectElement>('[data-tw-type]').value = '';
    find<HTMLSelectElement>('[data-tw-set]').value = '';
    find<HTMLInputElement>('[data-tw-issues]').checked = false;
    page = 0; renderList(); renderDetails();
    find<HTMLInputElement>('[data-tw-search]').focus();
  }
  function renderReview(): void {
    const generation = ++reviewGeneration;
    proofDispose?.(); proofDispose = undefined;
    const el = find('[data-tw-review]');
    if (!review) { el.hidden = true; return; }
    el.hidden = false;
    const changes = diffTokenDocuments(JSON.parse(review.base), review.candidate, review.beforeOptions, review.afterOptions);
    const stale = JSON.stringify(options.read()) !== review.base;
    const pending = !!options.host && !review.dependencies;
    const unresolved = review.conflicts.some(c => !review!.decisions[c.location]);
    const nChanges = changes.length, nConflicts = review.conflicts.length;
    const nothing = nChanges === 0 && nConflicts === 0;
    el.innerHTML = changeSummaryHtml(t('Review token change'), [{ label: t('Scope'), detail: t('This system on this device. Existing published versions remain separate.') }, { label: t('Changes'), detail: tRaw(nChanges === 1 ? '{n} value changes' : '{n} values change', { n: nChanges }) }, { label: t('Conflicts'), detail: tRaw(nConflicts === 1 ? '{n} decision needed' : '{n} decisions needed', { n: nConflicts }) }]) + `<p>${stale ? t('The source changed. Create a fresh review before applying.') : review.resourceError ? esc(review.resourceError) : nothing ? t('Nothing to change. The choices already match this system.') : pending ? t('Capturing referenced resource revisions…') : t('Apply uses the captured candidate. Your existing studio undo history owns recovery.')}</p><ul>${changes.slice(0, 100).map(c => `<li><strong>${esc(c.path)}</strong> (${esc(c.kind)}) <code>${esc(text(c.before))}</code> → <code>${esc(text(c.after))}</code></li>`).join('')}</ul>${review.conflicts.map(c => `<details class="section-card" open><summary class="section-card-summary"><span class="section-card-title">${esc(c.location || t('Whole document'))}</span></summary><dl><dt>${t('Earlier source')}</dt><dd><pre>${esc(text(c.base))}</pre></dd><dt>${t('Local')}</dt><dd><pre>${esc(text(c.local))}</pre></dd><dt>${t('Incoming')}</dt><dd><pre>${esc(text(c.incoming))}</pre></dd></dl><label>${t('Resolve this conflict')}<select class="field-select" data-tw-conflict="${esc(c.location)}"><option value="">${t('Choose a decision')}</option><option value="local" ${review!.decisions[c.location] === 'local' ? 'selected' : ''}>${t('Keep local')}</option><option value="incoming" ${review!.decisions[c.location] === 'incoming' ? 'selected' : ''}>${t('Use incoming')}</option></select></label></details>`).join('')}<button type="button" class="btn btn--primary" data-tw-apply ${stale || pending || unresolved || review.resourceError || nothing ? 'disabled' : ''}>${t('Apply reviewed change')}</button> <button type="button" class="btn btn--ghost" data-tw-discard>${t('Discard preview')}</button><div data-tw-proof></div>`;
    if (options.host?.compare?.visual) {
      const captured = review;
      void import('./token-review-proof.ts').then(({ mountTokenReviewProof }) => {
        if (disposed || generation !== reviewGeneration || review !== captured || !el.querySelector('[data-tw-proof]')) return;
        proofDispose?.();
        proofDispose = mountTokenReviewProof(el.querySelector<HTMLElement>('[data-tw-proof]')!, options.host!, JSON.parse(captured.base), captured.candidate, captured.beforeOptions, () => reviewCurrent(captured), captured.afterOptions);
      }).catch(() => { if (!disposed && generation === reviewGeneration && review === captured) status(t('Production comparison could not be loaded. The textual diff remains available.')); });
    }
  }
  async function dependencies(captured: NonNullable<typeof review>): Promise<string> {
    if (!options.host) return '';
    return JSON.stringify(await Promise.all([usageDependencies(options.host, JSON.parse(captured.base)), usageDependencies(options.host, captured.candidate)]));
  }
  async function reviewCurrent(captured: NonNullable<typeof review>): Promise<boolean> {
    if (disposed || review !== captured || JSON.stringify(options.read()) !== captured.base) return false;
    if (options.host && (!captured.dependencies || await dependencies(captured) !== captured.dependencies)) return false;
    return !disposed && review === captured && JSON.stringify(options.read()) === captured.base;
  }
  function captureResources(captured: NonNullable<typeof review>): void {
    if (!options.host) return;
    captured.dependencies = undefined;
    captured.resourceError = undefined;
    const candidateAtCapture = captured.candidate;
    void dependencies(captured).then(value => {
      if (disposed || review !== captured || captured.candidate !== candidateAtCapture) return;
      captured.dependencies = value; renderReview();
    }).catch(error => {
      if (disposed || review !== captured || captured.candidate !== candidateAtCapture) return;
      captured.resourceError = error instanceof Error ? error.message : t('Resources could not be checked.'); renderReview();
    });
  }
  const candidate = (value: Record<string, unknown>, conflicts: TokenMergeConflict[] = [], themeChange = false): void => {
    const context = structuredClone(resolveOptions());
    review = { base: JSON.stringify(options.read()), candidate: structuredClone(value), conflicts, decisions: {}, beforeOptions: themeChange ? {} : context, afterOptions: themeChange ? {} : context };
    captureResources(review);
    renderReview(); status(t('Preview ready. The active system has not changed.'));
  };
  function refresh(): void {
    if (disposed) return;
    inspection = inspectTokenDocument(options.read(), resolveOptions());
    choices ??= { ...inspection.selection.choices };
    if (options.context === 'Render version') {
      renderChoices ??= { ...inspection.selection.choices };
      const preview = canonicalJson(inspection.selection.choices) !== canonicalJson(renderChoices);
      find('[data-tw-context]').textContent = preview ? t('Preview') : t('Render version');
      find('[data-tw-return-choices]').hidden = !preview;
    }
    find('[data-tw-themes]').innerHTML = inspection.selection.groups.map(g => `<label>${g.id ? esc(sentenceCase(g.id)) : t('Theme')}${inspection.selection.defaults.includes(g.id) ? ` (${t('Default')})` : ''}<select class="field-select" data-tw-group="${esc(g.id)}">${g.options.map(o => `<option value="${esc(o.id)}" ${inspection.selection.choices[g.id] === o.id ? 'selected' : ''}>${esc(sentenceCase(o.name))}</option>`).join('')}</select></label>`).join('');
    find('[data-tw-apply-choices]').hidden = !options.commit || inspection.selection.groups.length === 0;
    const updateFilter = (selector: string, values: string[], all: string, label: (v: string) => string = v => v): void => {
      const el = find<HTMLSelectElement>(selector), value = el.value;
      el.innerHTML = `<option value="">${esc(all)}</option>${values.map(v => `<option value="${esc(v)}">${esc(label(v))}</option>`).join('')}`;
      if (values.includes(value)) el.value = value;
    };
    updateFilter('[data-tw-type]', [...new Set(inspection.tokens.map(x => x.type).filter((x): x is string => !!x))].sort(), t('All types'), tokenTypeLabel);
    updateFilter('[data-tw-set]', [...new Set(inspection.tokens.flatMap(x => x.candidates.map(c => c.set).filter((x): x is string => !!x)))], t('Any set'));
    const setEl = find<HTMLSelectElement>('[data-tw-recipe-set]');
    const sourceSets = tokenSetNames(options.read()) ?? [];
    const previousSet = setEl.value;
    setEl.innerHTML = sourceSets.length ? sourceSets.map(s => `<option>${esc(s)}</option>`).join('') : `<option value="">${t('Implicit set')}</option>`;
    if (sourceSets.includes(previousSet)) setEl.value = previousSet;
    updateFilter('[data-tw-existing-recipe]', readTokenRecipes(options.read()).map(r => r.id), t('New recipe'));
    renderList(); renderDetails(); renderReview();
    status(inspection.diagnostics.length ? `${inspection.diagnostics.slice(0, DETAIL_LIMIT).map(d => d.message).join(' ')}${inspection.diagnostics.length > DETAIL_LIMIT ? ` (${inspection.diagnostics.length} ${t('issues in total')})` : ''}` : tRaw('Values come from: {sets}', { sets: inspection.selection.sets.join(' → ') || t('no named set') }));
    syncRecipeFields();
  }
  on(mount, 'click', async event => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('button');
    if (!target || consumers?.click(target)) return;
    if (target.hasAttribute('data-tw-return-choices') && renderChoices) { choices = { ...renderChoices }; refresh(); find<HTMLSelectElement>('[data-tw-group]')?.focus(); }
    if (target.dataset.twToken !== undefined) select(target.dataset.twToken);
    if (target.dataset.twRef !== undefined) select(target.dataset.twRef);
    if (target.hasAttribute('data-tw-back') && history.length) select(history.pop()!, false);
    if (target.hasAttribute('data-tw-prev')) { page--; renderList(); }
    if (target.hasAttribute('data-tw-next')) { page++; renderList(); }
    if (target.hasAttribute('data-tw-discard')) { review = null; renderReview(); status(t('Preview discarded')); }
    if (target.hasAttribute('data-tw-clear')) clearFilters();
    if (target.hasAttribute('data-tw-reset-generated') && options.commit) {
      const token = inspection.tokens.find(x => x.path === selected);
      const recipe = readTokenRecipes(options.read()).find(r => r.set === (token?.source?.set ?? undefined) && r.paths.includes(selected));
      if (recipe) try { candidate(generateTokenRecipe(options.read(), recipe, { clearOverrides: [selected] })); } catch (error) { status((error as Error).message); }
    }
    if (target.hasAttribute('data-tw-edit-source')) {
      const source = inspection.tokens.find(x => x.path === selected)?.source;
      const field = find<HTMLTextAreaElement>('[data-tw-source-value]'), err = mount.querySelector<HTMLElement>('[data-tw-source-err]');
      // A bare value is a value: `#ff0000` and `16px` need no JSON quotes.
      const raw = field.value.trim();
      let value: unknown;
      try { value = JSON.parse(raw); } catch { value = raw; }
      if (source && options.commit) try {
        candidate(withTokenSourceValue(options.read(), source.location, value));
        if (err) err.hidden = true;
        field.removeAttribute('aria-invalid');
      } catch {
        if (err) { err.textContent = t('That isn’t a value Lolly can read. Try #ff0000 or 16px.'); err.hidden = false; }
        field.setAttribute('aria-invalid', 'true');
      }
    }
    if (target.hasAttribute('data-tw-apply-choices')) {
      const d = structuredClone(options.read()) as Record<string, unknown>;
      d.$metadata = { ...(d.$metadata as object ?? {}), activeThemeSelection: { ...choices } };
      candidate(d, [], true);
    }
    if (target.hasAttribute('data-tw-apply') && review && options.commit) {
      const captured = review;
      if (captured.conflicts.some(c => !captured.decisions[c.location])) return;
      if (JSON.stringify(options.read()) !== captured.base) { renderReview(); return; }
      (target as HTMLButtonElement).disabled = true;
      try {
        if (!await reviewCurrent(captured)) {
          if (disposed) return;
          captured.resourceError = t('The source or referenced resources changed. Create a fresh review.');
          renderReview(); status(captured.resourceError); return;
        }
        if (disposed) return;
        await options.commit(structuredClone(captured.candidate));
        if (disposed) return;
        if (review === captured) review = null;
        refresh(); status(t('Reviewed change applied'));
      }
      catch (error) { if (!disposed) { status(error instanceof Error ? error.message : t('The change could not be applied.')); renderReview(); } }
    }
  });
  on(mount, 'change', event => {
    const target = event.target as HTMLElement;
    if (target.hasAttribute('data-tw-existing-recipe')) {
      const recipe = readTokenRecipes(options.read()).find(r => r.id === (target as HTMLSelectElement).value);
      find<HTMLInputElement>('[data-tw-recipe] [name=id]').value = recipe?.id ?? '';
      if (recipe) for (const key of ['kind', 'prefix', 'set', 'count', 'base', 'ratio', 'seed'] as const) {
        find<HTMLInputElement | HTMLSelectElement>(`[data-tw-recipe] [name=${key}]`).value = String(recipe[key] ?? '');
      }
    }
    if (target.dataset.twConflict !== undefined && review) {
      const conflict = review.conflicts.find(c => c.location === target.dataset.twConflict);
      const choice = (target as HTMLSelectElement).value;
      if (conflict && (choice === 'local' || choice === 'incoming')) {
        review.candidate = decideTokenMergeConflict(review.candidate, conflict, choice);
        review.decisions[conflict.location] = choice;
        captureResources(review); renderReview();
      }
    }
    if (target.dataset.twGroup !== undefined) { choices = { ...choices, [target.dataset.twGroup]: (target as HTMLSelectElement).value }; refresh(); status(t('Preview choices. Use these choices for this system to review and apply.')); }
    if (target.matches('[data-tw-type],[data-tw-set],[data-tw-issues]')) { page = 0; renderList(); renderDetails(true); }
    if (target.matches('[data-tw-recipe] [name=kind]')) syncRecipeFields();
  });
  on(find('[data-tw-search]'), 'input', () => { page = 0; renderList(); renderDetails(true); });
  /** Show only the recipe fields the chosen recipe reads (engine/src/token-recipes.ts):
   *  a spacing scale is base times step, a type scale base times ratio, a colour ramp
   *  its seed. A colour ramp's seed starts from the system's primary. */
  function syncRecipeFields(): void {
    const kind = find<HTMLSelectElement>('[data-tw-recipe] [name=kind]').value;
    find('[data-tw-recipe-field="base"]').hidden = kind === 'color';
    find('[data-tw-recipe-field="ratio"]').hidden = kind !== 'type';
    find('[data-tw-recipe-field="seed"]').hidden = kind !== 'color';
    const seed = find<HTMLInputElement>('[data-tw-recipe] [name=seed]');
    if (kind === 'color' && !seed.dataset.touched) {
      let primary: string | null | undefined;
      try { primary = colorToHex(createTokenSet(options.read()).resolve('color.semantic.primary')); } catch { primary = null; }
      if (primary && /^#[0-9a-f]{6}$/i.test(primary)) seed.value = primary;
    }
  }
  on(find('[data-tw-recipe] [name=seed]'), 'input', event => { (event.target as HTMLInputElement).dataset.touched = '1'; });
  on(find('[data-tw-recipe]'), 'submit', event => {
    event.preventDefault();
    const data = new FormData(event.target as HTMLFormElement);
    const prefix = String(data.get('prefix')), set = String(data.get('set'));
    const recipe: TokenRecipe = { id: String(data.get('id') || `${set}/${prefix}`), version: 1, kind: String(data.get('kind')) as TokenRecipe['kind'], prefix, ...(set ? { set } : {}), count: Number(data.get('count')), base: Number(data.get('base')), ratio: Number(data.get('ratio')), seed: String(data.get('seed')) };
    try { candidate(generateTokenRecipe(options.read(), recipe)); } catch (error) { status((error as Error).message); }
  });
  on(find('[data-tw-upstream]'), 'submit', async event => {
    event.preventDefault();
    const data = new FormData(event.target as HTMLFormElement), base = data.get('base') as File, incoming = data.get('incoming') as File;
    const captured = JSON.stringify(options.read());
    try {
      if (base.size > 2000000 || incoming.size > 2000000) throw new Error(t('Use JSON sources smaller than 2 MB.'));
      const earlier = JSON.parse(await base.text()), next = JSON.parse(await incoming.text());
      const result = mergeTokenDocuments(earlier, JSON.parse(captured), next);
      const revision = (String(data.get('revision') ?? '').trim() || incoming.name.replace(/\.[^.]+$/, '')).slice(0, 256);
      if (!revision) throw new Error(t('Name the incoming release or revision.'));
      const extensions = (result.document.$extensions ?? {}) as Record<string, unknown>;
      const digest = (source: unknown): Promise<string> => sha256Hex(new TextEncoder().encode(canonicalJson(source)));
      const [baseSha256, incomingSha256] = await Promise.all([digest(earlier), digest(next)]);
      result.document.$extensions = { ...extensions, [TOKEN_EXT]: { ...(extensions[TOKEN_EXT] as object ?? {}), upstream: { kind: 'file', revision, baseSha256, incomingSha256 } } };
      if (disposed) return;
      if (captured !== JSON.stringify(options.read())) { status(t('The source changed while reading files. Compare again.')); return; }
      candidate(result.document, result.conflicts);
    } catch (error) { if (!disposed) status((error as Error).message); }
  });
  refresh();
  return { refresh, select, teardown(): void { disposed = true; abort.abort(); consumers?.dispose(); proofDispose?.(); mount.replaceChildren(); } };
}

/** Read-only effective render inspection shares the app's native modal lifecycle. */
export async function openTokenInspector(host: Pick<HostV1, 'tokens'>, path?: string, current: () => boolean = () => true): Promise<void> {
  const snapshot = await host.tokens?.snapshot?.();
  if (!current()) return;
  if (!snapshot?.document) throw new Error(t('Source inspection is unavailable in this host.'));
  let workspace: ReturnType<typeof mountTokenWorkspace> | undefined;
  const modal = mountModal(`<header class="token-inspector-head"><h2 class="modal-title">${esc(snapshot.system?.label ?? t('Design system'))} · ${esc(snapshot.version ?? t('Latest'))}</h2><button type="button" class="btn btn--ghost" data-token-close>${t('Close')}</button></header><div data-token-inspector></div>`, { className: 'modal token-inspector-dialog', ariaLabel: t('Token inspector'), onClose: () => workspace?.teardown() });
  workspace = mountTokenWorkspace(modal.el.querySelector<HTMLElement>('[data-token-inspector]')!, { read: () => snapshot.document, initialSelection: snapshot.selection.choices, context: 'Render version', label: snapshot.system?.label });
  if (path) workspace.select(path);
  modal.el.querySelector('[data-token-close]')!.addEventListener('click', () => modal.close(undefined));
}
