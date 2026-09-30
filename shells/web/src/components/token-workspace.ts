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
import { usageDependencies } from '../lib/design-system/usage-model.ts';
import { escape as esc } from '../utils.ts';
import { t } from '../i18n.ts';
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
}
const text = (v: unknown): string => v === undefined ? t('Unavailable') : JSON.stringify(v);
const DETAIL_LIMIT = 100;

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
  mount.innerHTML = `<header class="tw-context section-header"><h3 class="section-header-title">${esc(options.label ?? t('Token workspace'))}</h3><span class="chip chip--status" data-tw-context>${esc(t(options.context ?? 'Editable head'))}</span><span class="chip chip--status">${options.commit ? t('Local editing') : t('Read-only')}</span></header>
    <p class="section-header-sub">${t('Inspect every retained set. Theme choices here preview the authored design; app appearance has its own setting.')}</p>
    <div data-tw-themes class="tw-themes"></div><button type="button" class="btn btn--ghost" data-tw-return-choices hidden>${t('Return to render choices')}</button><button type="button" class="btn btn--ghost" data-tw-apply-choices ${options.commit ? '' : 'hidden'}>${t('Use these choices for this system')}</button>
    <p data-tw-status role="status" aria-live="polite"></p>
    <div class="tw-filters"><label>${t('Search tokens')}<input class="field-input" type="search" data-tw-search></label><label>${t('Type')}<select class="field-select" data-tw-type></select></label><label>${t('Source set')}<select class="field-select" data-tw-set></select></label><label class="tw-issues"><input class="field-check" type="checkbox" data-tw-issues> ${t('Issues only')}</label></div>
    <p data-tw-count></p><div class="tw-browser"><div><ul class="tw-list" data-tw-list></ul><div class="tw-pages"><button type="button" class="btn btn--ghost" data-tw-prev>${t('Previous')}</button><button type="button" class="btn btn--ghost" data-tw-next>${t('Next')}</button></div></div><section class="tw-detail card card--sub" data-tw-detail aria-label="${esc(t('Token details'))}" tabindex="-1"></section></div>
    <p><a class="btn btn--ghost" href="/examples/beacon.tokens.json" download="beacon.tokens.json">${t('Download the example system')}</a></p>
    <div data-tw-authoring ${options.commit ? '' : 'hidden'}><details class="section-card"><summary class="section-card-summary"><span class="section-card-title">${t('Generate a scale')}</span></summary><form data-tw-recipe class="tw-recipe"><label>${t('Existing recipe')}<select class="field-select" data-tw-existing-recipe><option value="">${t('New recipe')}</option></select></label><input type="hidden" name="id"><label>${t('Recipe')}<select class="field-select" name="kind"><option value="spacing">${t('Spacing')}</option><option value="type">${t('Modular type')}</option><option value="color">${t('Colour ramp')}</option></select></label><label>${t('Path')}<input class="field-input" name="prefix" value="generated.spacing" required></label><label>${t('Source set')}<select class="field-select" name="set" data-tw-recipe-set></select></label><label>${t('Steps')}<input class="field-input" name="count" type="number" value="8" min="2" max="32" required></label><label>${t('Base in pixels')}<input class="field-input" name="base" type="number" value="4" min="0.01" max="10000" step="any" required></label><label>${t('Ratio')}<input class="field-input" name="ratio" type="number" value="1.25" min="1" max="4" step="any" required></label><label>${t('Colour seed')}<input class="field-input" name="seed" value="#7c3aed"></label><button type="submit" class="btn btn--ghost">${t('Review generated tokens')}</button></form></details>
    <details class="section-card"><summary class="section-card-summary"><span class="section-card-title">${t('Review an upstream update')}</span></summary><p>${t('Select the exact earlier source and the incoming source. Conflicts keep local values. No source is activated until Apply.')}</p><form data-tw-upstream><label>${t('Incoming revision')}<input class="field-input" name="revision" maxlength="256" required></label><label>${t('Earlier source JSON')}<input class="field-input" type="file" name="base" accept=".json,application/json" required></label><label>${t('Incoming source JSON')}<input class="field-input" type="file" name="incoming" accept=".json,application/json" required></label><button type="submit" class="btn btn--ghost">${t('Compare update')}</button></form></details></div>
    <section data-tw-review hidden></section>`;
  const find = <T extends HTMLElement>(selector: string): T => mount.querySelector<T>(selector)!;
  const status = (message: string): void => { find('[data-tw-status]').textContent = message; };
  const on = (el: HTMLElement, event: string, fn: EventListener): void => { el.addEventListener(event, fn, { signal: abort.signal }); };
  const resolveOptions = (): TokenResolveOptions => ({ selection: choices });
  const select = (path: string, push = true): void => {
    if (push && selected) { history.push(selected); history = history.slice(-64); }
    selected = path;
    renderDetails(); renderList();
    find('[data-tw-detail]').focus();
  };
  function renderDetails(): void {
    const token = inspection.tokens.find(x => x.path === selected);
    const detail = find('[data-tw-detail]');
    if (!token) { detail.textContent = t('Choose a token to inspect its value, references and source.'); return; }
    const recipe = readTokenRecipes(options.read()).find(r => r.set === (token.source?.set ?? undefined) && r.paths.includes(token.path));
    const links = (paths: string[]): string => paths.length ? `<ul>${paths.slice(0, DETAIL_LIMIT).map(p => `<li><button type="button" class="btn btn--ghost" data-tw-ref="${esc(p)}">${esc(p)}</button></li>`).join('')}</ul>${paths.length > DETAIL_LIMIT ? `<p>${t('Showing')} ${DETAIL_LIMIT} ${t('of')} ${paths.length} ${t('references. Search tokens to find the remaining references.')}</p>` : ''}` : `<p>${t('None recorded')}</p>`;
    detail.innerHTML = `<button type="button" class="btn btn--ghost" data-tw-back ${history.length ? '' : 'disabled'}>${t('Back to previous token')}</button><h4>${esc(token.path)}</h4><p>${esc(token.type ?? t('Unknown type'))} · ${token.source ? esc(token.source.set ?? t('Implicit set')) : t('Inactive definition')}</p>
      ${token.source?.description ? `<p>${esc(token.source.description)}</p>` : ''}<h5>${t('Value')}</h5><dl><dt>${t('Authored')}</dt><dd><code>${esc(text(token.authored))}</code></dd><dt>${t('Resolved')}</dt><dd><code>${esc(text(token.resolved))}</code></dd></dl>
      ${options.commit && token.source ? `<details class="section-card"><summary class="section-card-summary"><span class="section-card-title">${t('Edit source value')}</span></summary><p>${t('This edits the winning token definition in this system. Linked input overrides have their own controls.')}</p><textarea class="field-input" data-tw-source-value rows="4">${esc(text(token.authored))}</textarea><button type="button" class="btn btn--ghost" data-tw-edit-source>${t('Review source edit')}</button></details>` : ''}
      ${recipe ? `<h5>${t('Generation recipe')}</h5><p>${esc(recipe.id)} · ${esc(recipe.kind)} · v${recipe.version}</p><pre>${esc(text({ base: recipe.base, ratio: recipe.ratio, seed: recipe.seed, count: recipe.count }))}</pre><p>${canonicalJson(token.authored) !== canonicalJson(recipe.outputs[token.path]) || Object.hasOwn(recipe.overrides ?? {}, token.path) ? t('Local generated-value override') : t('Generated value')}</p>${options.commit ? `<button type="button" class="btn btn--ghost" data-tw-reset-generated>${t('Use generated value')}</button>` : ''}` : ''}<h5>${t('References')}</h5>${links(token.references)}<h5>${t('Used by')}</h5><p>${t('Token references in this document only. Dynamic tool hooks and other documents are outside this count.')}</p>${links(token.usedBy)}
      <h5>${t('Issues')}</h5>${token.diagnostics.length ? `<ul>${token.diagnostics.map(d => `<li>${esc(d.message)}</li>`).join('')}</ul>` : `<p>${t('No reference issues found')}</p>`}
      ${token.declaredConsumers?.length ? `<h5>${t('Declared roles and slots')}</h5><p>${t('Declarations in this source document. These are not observed render usage or rule checks.')}</p><ul>${token.declaredConsumers.map(consumer => `<li><strong>${esc(consumer.label)}</strong> <code>${esc(consumer.roleId)}</code>${consumer.bindings.length ? `<ul>${consumer.bindings.map(binding => `<li><code>${esc(binding.tool ?? t('Any tool'))} / ${esc(binding.slot)}</code>${binding.modes?.length ? ` · ${esc(binding.modes.join(', '))}` : ''}</li>`).join('')}</ul>` : ''}</li>`).join('')}</ul>` : ''}
      <h5>${t('Source and override order')}</h5><ol>${token.candidates.map(c => `<li><strong>${esc(c.set ?? t('Implicit set'))}</strong> · ${c.active ? c === token.source ? t('Winning definition') : t('Overridden') : t('Inactive')}<code>${esc(c.location)}</code><pre>${esc(text(c.value))}</pre></li>`).join('')}</ol>`;
  }
  function renderList(): void {
    const search = find<HTMLInputElement>('[data-tw-search]').value.toLowerCase();
    const type = find<HTMLSelectElement>('[data-tw-type]').value, set = find<HTMLSelectElement>('[data-tw-set]').value;
    const issues = find<HTMLInputElement>('[data-tw-issues]').checked;
    const matches = inspection.tokens.filter(x => x.path.toLowerCase().includes(search) && (!type || x.type === type) && (!set || x.candidates.some(c => (c.set ?? '') === set)) && (!issues || x.diagnostics.length));
    page = Math.min(page, Math.max(0, Math.ceil(matches.length / 100) - 1));
    find('[data-tw-count]').textContent = `${matches.length} ${t('tokens')} · ${t('Page')} ${page + 1}`;
    find('[data-tw-list]').innerHTML = matches.slice(page * 100, page * 100 + 100).map(x => `<li><button type="button" class="btn btn--ghost" data-tw-token="${esc(x.path)}" aria-pressed="${x.path === selected}"><strong>${esc(x.path)}</strong><span>${esc(x.type ?? t('Unknown type'))} · ${x.source ? t('Active') : t('Inactive')}</span><code>${esc(text(x.resolved ?? x.candidates[0]?.value))}</code>${x.diagnostics.length ? `<span>${x.diagnostics.length} ${t('issues')}</span>` : ''}</button></li>`).join('');
    find<HTMLButtonElement>('[data-tw-prev]').disabled = page === 0;
    find<HTMLButtonElement>('[data-tw-next]').disabled = (page + 1) * 100 >= matches.length;
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
    el.innerHTML = changeSummaryHtml(t('Review token change'), [{ label: t('Scope'), detail: t('This system on this device. Existing published versions remain separate.') }, { label: t('Changes'), detail: `${changes.length} ${t('authored or resolved changes')}` }, { label: t('Conflicts'), detail: `${review.conflicts.length} ${t('individual decisions required')}` }]) + `<p>${stale ? t('The source changed. Create a fresh review before applying.') : review.resourceError ? esc(review.resourceError) : pending ? t('Capturing referenced resource revisions…') : t('Apply uses the captured candidate. Your existing studio undo history owns recovery.')}</p><ul>${changes.slice(0, 100).map(c => `<li><strong>${esc(c.path)}</strong> (${esc(c.kind)}) <code>${esc(text(c.before))}</code> → <code>${esc(text(c.after))}</code></li>`).join('')}</ul>${review.conflicts.map(c => `<details class="section-card" open><summary class="section-card-summary"><span class="section-card-title">${esc(c.location || t('Whole document'))}</span></summary><dl><dt>${t('Earlier source')}</dt><dd><pre>${esc(text(c.base))}</pre></dd><dt>${t('Local')}</dt><dd><pre>${esc(text(c.local))}</pre></dd><dt>${t('Incoming')}</dt><dd><pre>${esc(text(c.incoming))}</pre></dd></dl><label>${t('Resolve this conflict')}<select class="field-select" data-tw-conflict="${esc(c.location)}"><option value="">${t('Choose a decision')}</option><option value="local" ${review!.decisions[c.location] === 'local' ? 'selected' : ''}>${t('Keep local')}</option><option value="incoming" ${review!.decisions[c.location] === 'incoming' ? 'selected' : ''}>${t('Use incoming')}</option></select></label></details>`).join('')}<button type="button" class="btn btn--primary" data-tw-apply ${stale || pending || unresolved || review.resourceError ? 'disabled' : ''}>${t('Apply reviewed change')}</button> <button type="button" class="btn btn--ghost" data-tw-discard>${t('Discard preview')}</button><div data-tw-proof></div>`;
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
    find('[data-tw-themes]').innerHTML = inspection.selection.groups.map(g => `<label>${esc(g.id || t('Themes'))}${inspection.selection.defaults.includes(g.id) ? ` (${t('Default')})` : ''}<select class="field-select" data-tw-group="${esc(g.id)}">${g.options.map(o => `<option value="${esc(o.id)}" ${inspection.selection.choices[g.id] === o.id ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}</select></label>`).join('');
    const updateFilter = (selector: string, values: string[], all: string): void => {
      const el = find<HTMLSelectElement>(selector), value = el.value;
      el.innerHTML = `<option value="">${esc(all)}</option>${values.map(v => `<option>${esc(v)}</option>`).join('')}`;
      if (values.includes(value)) el.value = value;
    };
    updateFilter('[data-tw-type]', [...new Set(inspection.tokens.map(x => x.type).filter((x): x is string => !!x))].sort(), t('All types'));
    updateFilter('[data-tw-set]', [...new Set(inspection.tokens.flatMap(x => x.candidates.map(c => c.set).filter((x): x is string => !!x)))], t('All retained sets'));
    const setEl = find<HTMLSelectElement>('[data-tw-recipe-set]');
    const sourceSets = tokenSetNames(options.read()) ?? [];
    const previousSet = setEl.value;
    setEl.innerHTML = sourceSets.length ? sourceSets.map(s => `<option>${esc(s)}</option>`).join('') : `<option value="">${t('Implicit set')}</option>`;
    if (sourceSets.includes(previousSet)) setEl.value = previousSet;
    updateFilter('[data-tw-existing-recipe]', readTokenRecipes(options.read()).map(r => r.id), t('New recipe'));
    renderList(); renderDetails(); renderReview();
    status(inspection.diagnostics.length ? `${inspection.diagnostics.slice(0, DETAIL_LIMIT).map(d => d.message).join(' ')}${inspection.diagnostics.length > DETAIL_LIMIT ? ` (${inspection.diagnostics.length} ${t('issues in total')})` : ''}` : `${t('Effective set order')}: ${inspection.selection.sets.join(' → ') || t('Implicit set')}`);
  }
  on(mount, 'click', async event => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('button');
    if (!target) return;
    if (target.hasAttribute('data-tw-return-choices') && renderChoices) { choices = { ...renderChoices }; refresh(); find<HTMLSelectElement>('[data-tw-group]')?.focus(); }
    if (target.dataset.twToken !== undefined) select(target.dataset.twToken);
    if (target.dataset.twRef !== undefined) select(target.dataset.twRef);
    if (target.hasAttribute('data-tw-back') && history.length) select(history.pop()!, false);
    if (target.hasAttribute('data-tw-prev')) { page--; renderList(); }
    if (target.hasAttribute('data-tw-next')) { page++; renderList(); }
    if (target.hasAttribute('data-tw-discard')) { review = null; renderReview(); status(t('Preview discarded')); }
    if (target.hasAttribute('data-tw-reset-generated') && options.commit) {
      const token = inspection.tokens.find(x => x.path === selected);
      const recipe = readTokenRecipes(options.read()).find(r => r.set === (token?.source?.set ?? undefined) && r.paths.includes(selected));
      if (recipe) try { candidate(generateTokenRecipe(options.read(), recipe, { clearOverrides: [selected] })); } catch (error) { status((error as Error).message); }
    }
    if (target.hasAttribute('data-tw-edit-source')) {
      const source = inspection.tokens.find(x => x.path === selected)?.source;
      if (source && options.commit) try { candidate(withTokenSourceValue(options.read(), source.location, JSON.parse(find<HTMLTextAreaElement>('[data-tw-source-value]').value))); } catch (error) { status((error as Error).message); }
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
    if (target.matches('[data-tw-type],[data-tw-set],[data-tw-issues]')) { page = 0; renderList(); }
  });
  on(find('[data-tw-search]'), 'input', () => { page = 0; renderList(); });
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
      const revision = String(data.get('revision') ?? '').trim();
      if (!revision || revision.length > 256) throw new Error(t('Name the incoming release or revision.'));
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
  return { refresh, select, teardown(): void { disposed = true; abort.abort(); proofDispose?.(); mount.replaceChildren(); } };
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
