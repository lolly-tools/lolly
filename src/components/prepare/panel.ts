// SPDX-License-Identifier: MPL-2.0
/**
 * Prepare for sharing - the one controller behind the route and the dialog entry.
 *
 * The flow is automatic wherever a person gains nothing from pressing a button: adding,
 * dropping or pasting a file starts the inspection, pasted text is inspected at once and
 * typed text once the typing pauses; a finished inspection prepares the copies with every
 * suggestion selected, and changing a suggestion prepares them again. The explicit
 * actions are the ones that move bytes somewhere - download, copy, send, save to the
 * library - and those stay a click.
 *
 * The inspection panel has two homes. The route docks it into the app's one right edge
 * column (lib/edge-dock.ts, desktop only); the dialog entry and phones keep it in flow
 * beside the sources. It is the same element either way, so every data-* hook resolves
 * inside the panel whichever home it is in - the controller queries its own main column
 * and its own panel, never the page root, for exactly that reason.
 */
import type { HostV1, PreparationSource, PreparationInspection, PreparationResult, PreparationRule, PreparationRecipe } from '@lolly-tools/core/host-v1';
import { preparationRecipe, readPreparationRecipe, applyPreparationMetadata } from '@lolly/engine';
import { runPreparation } from '../../lib/prepare-client.ts';
import { openFileInUtility, type NativeUtilityTarget } from '../../lib/drop-router.ts';
import { fmtBytes } from '../../lib/format.ts';
import { icon } from '../../lib/icons.ts';
import { escape as htmlEscape } from '../../utils.ts';
import { t } from '../../i18n.ts';
import { renderPreparationReview, preparationChoices } from './review.ts';
import { renderPreparationOutputs } from './outputs.ts';
import { renderInspectorShell, renderInspectorEmpty, renderInspectorStats, renderCoverage, renderReport, renderRules, setInspectorStatus, type InspectorTone } from './inspector.ts';
import './prepare.css';

const MAX_FILES = 100;
const MAX_FILE_BYTES = 32 * 1024 * 1024;
const MAX_TOTAL_BYTES = 64 * 1024 * 1024;
/** Typing pauses this long before the text is inspected; a paste is inspected at once. */
const TYPE_DEBOUNCE_MS = 700;
/** Choices settle this long before the copies are prepared again. */
const CHOICE_DEBOUNCE_MS = 400;
/** Files whose hidden metadata the Strip Hidden Data path can remove. The option is OFF
 *  until the person ticks it: metadata carries provenance (Content Credentials, signatures,
 *  colour profiles), and Lolly never removes that without being asked (Andy, 2026-09-10). */
const ADAPTER_FILE = /\.(pdf|png|jpe?g|svg)$/i;
const FORMATS = ['Text', 'JSON', 'YAML', 'HAR', 'ZIP', 'PDF', 'PNG', 'JPG', 'SVG'];

export interface PreparationPanelOptions {
  /** Dock the inspection panel into the app's right edge column (desktop only). The dialog
   *  entry leaves this off: a modal's top layer would sit over a body-level column. */
  dock?: boolean;
}

class PreparationPanel {
  private files: File[];
  private sources: PreparationSource[] = [];
  private inspection?: PreparationInspection;
  private result?: PreparationResult;
  private rules: PreparationRule[] = [];
  private recipe?: PreparationRecipe;
  private work?: AbortController;
  private releaseOutput?: () => void;
  private disposed = false;
  private run = 0;
  private reviewEmpty = false;
  private inspectTimer?: ReturnType<typeof setTimeout>;
  private applyTimer?: ReturnType<typeof setTimeout>;
  /** Every listener this panel adds, removed on dispose. Plain add/remove pairs: jsdom rejects a Node AbortSignal in the listener options. */
  private readonly listeners: (() => void)[] = [];
  private undock?: () => void;
  private readonly root: HTMLElement;
  private readonly host: HostV1;
  private readonly main: HTMLElement;
  private readonly side: HTMLElement;
  private readonly review: HTMLElement;
  private readonly output: HTMLElement;
  private readonly status: HTMLElement;
  private readonly text: HTMLTextAreaElement;
  private readonly drop: HTMLElement;

  constructor(root: HTMLElement, host: HostV1, files: File[], opts: PreparationPanelOptions) {
    this.root = root; this.host = host; this.files = files;
    const uid = Math.random().toString(36).slice(2, 8);
    root.classList.add('prepare-panel');
    root.innerHTML = `<div class="prepare-layout">
      <div class="prep-main">
        <section class="card prep-card prep-sources" aria-labelledby="prep-sources-${uid}">
          <header class="prep-card-head"><h2 class="prep-card-title" id="prep-sources-${uid}">${t('Sources')}</h2><p class="prep-card-sub">${t('Read here, on this device. Originals are never changed.')}</p></header>
          <label class="prep-drop" data-drop>
            <span class="prep-drop-icon" aria-hidden="true">${icon('upload')}</span>
            <span class="prep-drop-lead" data-drop-lead>${t('Drop files to inspect them')}</span>
            <span class="prep-drop-hint" aria-hidden="true">${FORMATS.map(f => `<span class="chip">${f}</span>`).join('')}</span>
            <span class="btn btn--primary btn--sm prep-drop-cta">${t('Choose files…')}</span>
            <input data-files type="file" multiple class="prep-vh" aria-label="${t('Choose files')}">
          </label>
          <ul class="prep-files" data-file-list></ul>
          <p class="prep-note" data-adapter-note hidden>${t('Metadata is kept unless you ask to remove it: it can carry Content Credentials, signatures, colour profiles and JPEG HDR gain maps, and removal discards them. Visible content and attachments need their own review: the utilities open the file in memory, and their exported copy can come back here.')}</p>
          <div class="prep-text">
            <label class="field-label" for="prep-text-${uid}">${t('Or paste text')}</label>
            <textarea id="prep-text-${uid}" class="field-input prep-textarea" data-text rows="6" spellcheck="false" autocomplete="off" autocapitalize="off" placeholder="${t('A log, a config file, a message…')}"></textarea>
          </div>
          <div class="prep-actions">
            <button type="button" class="btn btn--sm" data-inspect>${t('Inspect now')}</button>
            <p class="prep-status" role="status" aria-live="polite" data-status></p>
          </div>
          <p class="prep-limits">${t('Text, JSON, YAML, HAR and ZIP are inspected. PDF, PNG, JPG and SVG can have hidden metadata removed. Up to 100 files, 32 MiB each and 64 MiB in total; text inspection stops at 1 MiB per file.')}</p>
        </section>
        <section class="card prep-card prep-copies" data-output aria-label="${t('Prepared copies')}" hidden></section>
        <p class="prep-footnote">${t('Originals, private values and replacement maps stay in this view’s memory. They are not saved to history, links or recipes. Leaving or clearing this view releases its working state.')}</p>
      </div>
      <aside class="prep-side" data-side aria-label="${t('Inspection')}"></aside>
    </div>`;
    this.main = this.root.querySelector<HTMLElement>('.prep-main')!;
    this.side = this.root.querySelector<HTMLElement>('[data-side]')!;
    this.output = this.main.querySelector<HTMLElement>('[data-output]')!;
    this.status = this.main.querySelector<HTMLElement>('[data-status]')!;
    this.text = this.main.querySelector<HTMLTextAreaElement>('[data-text]')!;
    this.drop = this.main.querySelector<HTMLElement>('[data-drop]')!;
    renderInspectorShell(this.side);
    this.review = this.side.querySelector<HTMLElement>('[data-review]')!;
    renderRules(this.side, this.rules);
    this.wire();
    this.invalidate();
    this.listFiles();
    if (this.files.length) void this.inspect();
    if (opts.dock) void this.dock();
  }

  // ── wiring ────────────────────────────────────────────────────────────────────
  private wire(): void {
    const on = <K extends keyof DocumentEventMap>(target: EventTarget, type: K, fn: (event: DocumentEventMap[K]) => void): void => {
      target.addEventListener(type, fn as EventListener);
      this.listeners.push(() => { target.removeEventListener(type, fn as EventListener); });
    };
    for (const el of [this.main, this.side]) {
      on(el, 'click', event => { this.onClick(event); });
      on(el, 'change', event => { this.onChange(event); });
      on(el, 'input', event => { this.onInput(event); });
    }
    // Bound on the textarea itself, not delegated: a programmatic non-bubbling input event
    // (the contract test's, a form library's) must still invalidate the review.
    on(this.text, 'input', event => { this.onTextInput(event); });
    // Drop anywhere on the panel, not only on the dashed zone.
    let depth = 0;
    const isFileDrag = (event: DragEvent): boolean => !!event.dataTransfer?.types?.includes('Files');
    on(this.root, 'dragenter', event => { if (!isFileDrag(event)) return; event.preventDefault(); depth++; this.root.classList.add('is-file-drag'); });
    on(this.root, 'dragover', event => { if (!isFileDrag(event)) return; event.preventDefault(); if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'; });
    on(this.root, 'dragleave', event => { if (!isFileDrag(event)) return; if (--depth <= 0) { depth = 0; this.root.classList.remove('is-file-drag'); } });
    on(this.root, 'drop', event => {
      if (!isFileDrag(event)) return;
      event.preventDefault(); depth = 0; this.root.classList.remove('is-file-drag');
      this.addFiles([...(event.dataTransfer?.files ?? [])]);
    });
    // A pasted file (a screenshot, a copied document) becomes a source too.
    on(document, 'paste', event => {
      const files = [...(event.clipboardData?.files ?? [])];
      if (!files.length || !this.root.isConnected) return;
      event.preventDefault(); this.addFiles(files);
    });
  }
  private onClick(event: Event): void {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-inspect],[data-cancel],[data-reset],[data-originals],[data-preview],[data-unchanged],[data-select-all],[data-category],[data-rule-add],[data-rule-clear],[data-rule-remove],[data-recipe-save],[data-report],[data-file-remove],[data-utility]');
    if (!target) return;
    const run = (fn: () => void | Promise<void>): void => { void Promise.resolve().then(fn).catch(() => { this.say(t('Could not complete this action. Your originals are still available.'), 'error'); }); };
    if (target.matches('[data-inspect]')) run(() => this.inspect());
    else if (target.matches('[data-cancel]')) run(() => { this.work?.abort(); });
    else if (target.matches('[data-reset]')) run(() => this.reset());
    else if (target.matches('[data-originals]')) run(() => this.downloadOriginals());
    else if (target.matches('[data-preview]')) run(() => this.apply(false));
    else if (target.matches('[data-unchanged]')) run(() => this.keepEverything());
    else if (target.matches('[data-select-all], [data-category]')) run(() => { this.choicesChanged(); });
    else if (target.matches('[data-rule-add]')) run(() => this.addRule());
    else if (target.matches('[data-rule-clear]')) run(() => this.setRules([]));
    else if (target.matches('[data-rule-remove]')) run(() => this.setRules(this.rules.filter(r => r.id !== target.dataset.ruleRemove)));
    else if (target.matches('[data-recipe-save]')) run(() => this.saveRecipe());
    else if (target.matches('[data-report]')) run(() => this.downloadReport());
    else if (target.matches('[data-file-remove]')) run(() => this.removeFile(Number(target.dataset.fileRemove)));
    else if (target.matches('[data-utility]')) run(() => { const file = this.files[Number(target.dataset.file)]; if (file) openFileInUtility(target.dataset.utility as NativeUtilityTarget, file); });
  }
  private onChange(event: Event): void {
    const el = event.target as HTMLElement;
    if (el.matches('[data-files]')) { const input = el as HTMLInputElement; this.addFiles([...(input.files ?? [])]); input.value = ''; return; }
    if (el.matches('[data-recipe-load]')) { const input = el as HTMLInputElement; void this.loadRecipe(input.files?.[0]); input.value = ''; return; }
    if (el.matches('[data-selected], [data-finding], [data-remove], [data-strip]')) this.choicesChanged();
  }
  private onInput(event: Event): void {
    const el = event.target as HTMLElement;
    if (el === this.text) return;   // handled by onTextInput, bound directly
    if (el.matches('[data-replacement]')) this.choicesChanged();
  }
  private onTextInput(event: Event): void {
    this.fitText();
    this.invalidate();
    const pasted = (event as InputEvent).inputType === 'insertFromPaste';
    this.scheduleInspect(pasted ? 0 : TYPE_DEBOUNCE_MS);
  }

  // ── state ─────────────────────────────────────────────────────────────────────
  /** Size the textarea to its content (capped by the sheet's max-height) so a paste reads whole. */
  private fitText(): void {
    if (!this.text.isConnected || typeof this.text.scrollHeight !== 'number') return;
    this.text.style.height = 'auto';
    if (this.text.scrollHeight > 0) this.text.style.height = `${this.text.scrollHeight + 2}px`;
  }
  private hasContent(): boolean { return this.files.length > 0 || this.text.value.trim().length > 0; }
  private toggle(selector: string, show: boolean): void { const el = this.side.querySelector<HTMLElement>(selector); if (el) el.hidden = !show; }
  /** One message in two voices: the sentence beside the sources, the short chip in the panel head. */
  private say(text: string, tone: InspectorTone = 'idle', chip = text): void {
    this.status.textContent = text; this.status.dataset.tone = tone;
    setInspectorStatus(this.side, chip, tone);
  }
  private idle(): void { this.say('', 'idle', t('Waiting for content')); }
  private emptyReview(): void { if (this.reviewEmpty) return; renderInspectorEmpty(this.review); this.reviewEmpty = true; }
  private clearOutput(): void {
    this.releaseOutput?.(); this.releaseOutput = undefined;
    this.output.replaceChildren(); this.output.hidden = true; this.output.style.minHeight = ''; this.output.removeAttribute('aria-busy'); delete this.output.dataset.stale;
  }
  private invalidate(): void {
    this.work?.abort();
    clearTimeout(this.applyTimer); this.applyTimer = undefined;
    this.inspection = undefined; this.result = undefined; this.sources = [];
    this.emptyReview();
    renderCoverage(this.side, null); renderReport(this.side, null); renderInspectorStats(this.side, null);
    this.toggle('[data-preview]', false);
    this.clearOutput();
  }
  private scheduleInspect(delay: number): void {
    clearTimeout(this.inspectTimer); this.inspectTimer = undefined;
    if (!this.hasContent()) { this.idle(); return; }
    this.say(t('Inspecting once you pause…'), 'busy', t('Waiting to inspect'));
    this.inspectTimer = setTimeout(() => { this.inspectTimer = undefined; void this.inspect(); }, delay);
  }
  private choicesChanged(): void {
    if (!this.inspection) return;
    this.work?.abort();
    if (!this.output.hidden) this.output.dataset.stale = '';
    this.say(t('Updating the copies with your choices…'), 'busy', t('Updating…'));
    clearTimeout(this.applyTimer);
    this.applyTimer = setTimeout(() => { this.applyTimer = undefined; void this.apply(false); }, CHOICE_DEBOUNCE_MS);
  }

  // ── sources ───────────────────────────────────────────────────────────────────
  private listFiles(): void {
    const list = this.main.querySelector<HTMLElement>('[data-file-list]')!;
    list.innerHTML = this.files.map((file, i) => {
      const adapter = ADAPTER_FILE.test(file.name);
      const ext = (file.name.includes('.') ? file.name.split('.').pop() ?? '' : '').toUpperCase();
      return `<li class="prep-file">
        <span class="prep-file-icon" aria-hidden="true">${icon(adapter ? 'image' : 'document')}</span>
        <div class="prep-file-body">
          <span class="prep-file-name">${htmlEscape(file.name)}</span>
          <span class="prep-file-meta">${htmlEscape(fmtBytes(file.size))}${ext ? ` <span class="chip">${htmlEscape(ext)}</span>` : ''}</span>
          ${adapter ? `<label class="prep-file-opt"><input type="checkbox" class="field-check" data-strip="file${i}"> ${t('Also remove hidden metadata from the copy')}</label>` : ''}
        </div>
        <div class="prep-file-actions">
          ${adapter ? `<button type="button" class="btn btn--sm btn--ghost" data-utility="strip-data" data-file="${i}">${t('Strip hidden data…')}</button><button type="button" class="btn btn--sm btn--ghost" data-utility="redact" data-file="${i}">${t('Redact…')}</button>` : ''}
          <button type="button" class="prep-icon-btn" data-file-remove="${i}" aria-label="${htmlEscape(t('Remove {name}', { name: file.name }))}">${icon('close')}</button>
        </div>
      </li>`;
    }).join('');
    this.drop.classList.toggle('has-files', this.files.length > 0);
    this.main.querySelector<HTMLElement>('[data-drop-lead]')!.textContent = this.files.length ? t('Drop more files') : t('Drop files to inspect them');
    this.main.querySelector<HTMLElement>('[data-adapter-note]')!.hidden = !this.files.some(f => ADAPTER_FILE.test(f.name));
  }
  private addFiles(incoming: File[]): void {
    const key = (f: File): string => `${f.name} ${f.size} ${f.lastModified}`;
    const seen = new Set(this.files.map(key));
    const fresh = incoming.filter(f => !seen.has(key(f)));
    if (!fresh.length) return;
    this.invalidate(); this.files = [...this.files, ...fresh]; this.listFiles();
    void this.inspect();
  }
  private removeFile(index: number): void {
    if (!(index in this.files)) return;
    this.invalidate(); this.files.splice(index, 1); this.listFiles();
    if (this.hasContent()) void this.inspect(); else this.idle();
  }
  private reset(): void {
    clearTimeout(this.inspectTimer); this.inspectTimer = undefined;
    this.invalidate();
    this.files = []; this.text.value = ''; this.text.style.height = ''; this.rules = []; this.recipe = undefined;
    this.side.querySelector<HTMLInputElement>('[data-rule-value]')!.value = '';
    this.listFiles(); renderRules(this.side, this.rules);
    this.say(t('Working state cleared.'), 'idle', t('Waiting for content'));
  }
  private async downloadOriginals(): Promise<void> {
    for (const file of this.files) await this.host.export.download(file, file.name);
    if (this.text.value) await this.host.export.download(new Blob([this.text.value], { type: 'text/plain' }), 'text.txt');
  }

  // ── rules and recipes ─────────────────────────────────────────────────────────
  private setRules(rules: PreparationRule[]): void {
    this.rules = rules; renderRules(this.side, rules);
    this.invalidate();
    if (this.hasContent()) void this.inspect(); else this.idle();
  }
  private addRule(): void {
    const input = this.side.querySelector<HTMLInputElement>('[data-rule-value]')!;
    if (!input.value.trim()) { input.focus(); return; }
    const kind = this.side.querySelector<HTMLSelectElement>('[data-rule-kind]')!.value as 'literal' | 'field';
    const value = input.value; input.value = '';
    this.setRules([...this.rules, { id: `custom-${crypto.randomUUID()}`, label: 'Custom rule', kind, value }]);
  }
  private async loadRecipe(file?: File): Promise<void> {
    if (!file) return;
    try {
      if (file.size > 65536) throw new Error();
      const recipe = readPreparationRecipe(JSON.parse(await file.text()));
      if (this.disposed) return;
      this.recipe = recipe;
      this.setRules(recipe.fields.map((value, i) => ({ id: `field-${i}`, kind: 'field', label: 'Custom field', value })));
      if (!this.hasContent()) this.say(t('Recipe loaded. Add a file or paste text to use it.'), 'idle', t('Recipe loaded'));
    } catch { this.say(t('That recipe could not be read. Use a preparation recipe JSON file.'), 'error', t('Recipe not read')); }
  }
  private async saveRecipe(): Promise<void> {
    const selected = new Set(preparationChoices(this.review).map(c => c.groupId));
    const recipe = preparationRecipe(this.inspection?.groups.filter(g => selected.has(g.id)).map(g => g.category) ?? [], this.rules);
    await this.host.export.download(new Blob([JSON.stringify(recipe, null, 2)], { type: 'application/json' }), 'preparation-recipe.json');
  }
  private async downloadReport(): Promise<void> {
    if (!this.result) return;
    await this.host.export.download(new Blob([JSON.stringify(this.result.report, null, 2)], { type: 'application/json' }), 'preparation-report.json');
  }

  // ── the work ──────────────────────────────────────────────────────────────────
  private async task(fn: (signal: AbortSignal) => Promise<void>, retryable = false): Promise<void> {
    this.work?.abort();
    const controller = new AbortController(); this.work = controller;
    this.toggle('[data-cancel]', true); this.toggle('[data-preview]', false);
    try { await fn(controller.signal); }
    catch (error) {
      if (this.disposed || this.work !== controller) return;
      if (error instanceof DOMException && error.name === 'AbortError') { this.say(t('Cancelled. Your originals are unchanged.'), 'idle', t('Cancelled')); this.clearOutput(); }
      else {
        this.say(error instanceof Error && error.message ? error.message : t('Preparation failed. Your originals are unchanged.'), 'error', t('Failed'));
        this.clearOutput();
        if (retryable) this.toggle('[data-preview]', true);
      }
    }
    finally { if (!this.disposed && this.work === controller) { this.work = undefined; this.toggle('[data-cancel]', false); } }
  }
  private async inspect(): Promise<void> {
    clearTimeout(this.inspectTimer); this.inspectTimer = undefined;
    this.invalidate();
    const run = ++this.run;
    const files = [...this.files], text = this.text.value;
    if (!files.length && !text) { this.say(t('Add a file or paste text first.'), 'idle', t('Waiting for content')); return; }
    this.say(t('Reading sources…'), 'busy', t('Inspecting…'));
    await this.task(async signal => {
      const textBytes = new TextEncoder().encode(text).length;
      if (files.length + Number(Boolean(text)) > MAX_FILES || files.some(f => f.size > MAX_FILE_BYTES) || files.reduce((n, f) => n + f.size, textBytes) > MAX_TOTAL_BYTES) throw new Error(t('Choose at most 100 files, 32 MiB each and 64 MiB total. Originals can still be downloaded.'));
      const sources: PreparationSource[] = [];
      for (const [i, f] of files.entries()) { signal.throwIfAborted(); sources.push({ id: `file${i}`, name: f.name, mime: f.type, bytes: new Uint8Array(await f.arrayBuffer()) }); }
      if (text) sources.push({ id: 'text', name: 'text.txt', mime: 'text/plain', bytes: new TextEncoder().encode(text) });
      const inspection = await runPreparation<PreparationInspection>({ action: 'inspect', sources, rules: this.rules }, signal, m => { this.say(m, 'busy', t('Inspecting…')); });
      signal.throwIfAborted();
      this.sources = sources; this.inspection = inspection;
      renderPreparationReview(this.review, inspection, this.recipe?.categories); this.reviewEmpty = false;
      renderCoverage(this.side, inspection);
      renderInspectorStats(this.side, { files: sources.length, size: fmtBytes(sources.reduce((n, s) => n + s.bytes.length, 0)), findings: inspection.findings.length });
      const n = inspection.groups.length;
      this.say(n ? t('{n} suggestions found. The copies are prepared with them selected; adjust any of them in the Inspection panel.', { n }) : t('No pattern suggestions. The copies are prepared as they are; read them yourself before sharing.'), 'ready', n ? `${n} ${n === 1 ? t('suggestion') : t('suggestions')}` : t('No suggestions'));
    });
    if (!this.disposed && this.run === run && this.inspection) await this.apply(false);
  }
  private async apply(unchanged: boolean): Promise<void> {
    clearTimeout(this.applyTimer); this.applyTimer = undefined;
    const inspection = this.inspection, sources = this.sources;
    if (!inspection) return;
    const choices = unchanged ? [] : preparationChoices(this.review);
    const remove = unchanged ? [] : [...this.side.querySelectorAll<HTMLInputElement>('[data-remove]:checked')].map(i => i.dataset.remove!);
    const metadata = unchanged ? [] : [...this.main.querySelectorAll<HTMLInputElement>('[data-strip]:checked')].map(i => i.dataset.strip!);
    // A copy on screen never lags the choices: the old cards go before the new run
    // starts, and the card keeps its height so the page does not jump while it works.
    const height = this.output.hidden ? 0 : this.output.offsetHeight;
    this.clearOutput();
    if (height) {
      this.output.hidden = false; this.output.style.minHeight = `${height}px`; this.output.setAttribute('aria-busy', 'true');
      this.output.innerHTML = `<header class="prep-card-head"><h2 class="prep-card-title">${t('Prepared copies')}</h2><p class="prep-card-sub">${t('Updating…')}</p></header>`;
    }
    this.say(t('Preparing the copies…'), 'busy', t('Preparing…'));
    await this.task(async signal => {
      let result = await runPreparation<PreparationResult>({ action: 'apply', sources, inspection, choices, remove }, signal, m => { this.say(m, 'busy', t('Preparing…')); });
      if (metadata.length) { this.say(t('Removing metadata and inspecting the result…'), 'busy', t('Preparing…')); result = await applyPreparationMetadata(result, metadata, this.host.pdf, { signal }); }
      signal.throwIfAborted();
      this.result = result;
      this.releaseOutput?.(); this.releaseOutput = renderPreparationOutputs(this.output, result, sources, this.host);
      this.output.hidden = false; this.output.style.minHeight = ''; this.output.removeAttribute('aria-busy');
      renderReport(this.side, result.report);
      renderInspectorStats(this.side, { files: sources.length, size: fmtBytes(sources.reduce((n, s) => n + s.bytes.length, 0)), findings: inspection.findings.length, changed: result.report.replaced });
      this.say(t('Copies are ready. Download, copy, send or save only when you choose.'), 'ready', t('Copies ready'));
      if (!height) this.output.scrollIntoView({ block: 'nearest' });
    }, true);
  }
  private async keepEverything(): Promise<void> {
    for (const el of [this.review, this.side, this.main]) el.querySelectorAll<HTMLInputElement>('[data-selected], [data-finding], [data-remove], [data-strip]').forEach(i => { i.checked = false; });
    await this.apply(true);
  }

  // ── the right edge column ─────────────────────────────────────────────────────
  private async dock(): Promise<void> {
    const dock = await import('../../lib/edge-dock.ts');
    if (this.disposed || !dock.edgeDockAvailable()) return;
    if (dock.isDocked('inspector')) dock.releaseDock('inspector', 'host');
    const docked = dock.requestDock('inspector', this.side, {
      icon: icon('shield'), label: t('Inspection'),
      onRelease: () => { this.root.classList.remove('is-docked'); },
    });
    if (!docked) return;
    this.root.classList.add('is-docked');
    this.undock = () => { if (dock.isDocked('inspector')) dock.releaseDock('inspector', 'host'); };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.listeners.splice(0).forEach(off => { off(); });
    clearTimeout(this.inspectTimer); clearTimeout(this.applyTimer);
    this.work?.abort(); this.work = undefined;
    this.undock?.(); this.undock = undefined;
    this.releaseOutput?.(); this.releaseOutput = undefined;
    this.inspection = undefined; this.result = undefined; this.sources = []; this.files = []; this.rules = []; this.recipe = undefined; this.text.value = '';
    this.root.replaceChildren();
    this.root.classList.remove('is-docked', 'is-file-drag');
  }
}

export function mountPreparationPanel(root: HTMLElement, host: HostV1, files: File[] = [], opts: PreparationPanelOptions = {}): () => void {
  const panel = new PreparationPanel(root, host, files, opts);
  return () => panel.dispose();
}
