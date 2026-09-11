// SPDX-License-Identifier: MPL-2.0
import {
  markdownPreview,
  downloadText,
  wireSelectionActions,
  openTextMenu,
} from './text/presentation.ts';
import { mountActionHistory } from './tool-revision-history.ts';
import type { AutomaticHistory } from './automatic-history.ts';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { Runtime } from '../../../../engine/src/runtime.ts';
import { detectCodeLanguage } from '../../../../engine/src/text-syntax.ts';
import { workspaceMarkup } from './text/markup.ts';
import { openActionForm } from './text/action-form.ts';
import {
  actionName,
  actionIcon,
  SAMPLE_TEXT,
  suggestedActions,
  RESULT_NAMES,
} from './text/shared.ts';
import { wireTabs } from '../lib/tabs.ts';
import { icon } from '../lib/icons.ts';
import { confirmDialog } from '../components/confirm-dialog.ts';
import { mountCodeEditor } from '../components/code-editor.ts';
import { mountModal } from '../components/modal.ts';
import { escapeHtml as esc } from '../lib/util/escape.ts';
import {
  readTextAsset,
  takeTextHandoff,
  type TextHandoff,
  type TextSource,
} from '../lib/text-handoff.ts';
import { syntaxLanguageForFile } from '../lib/syntax-preview.ts';
import { readTextFile, saveTextAsset } from './text/files.ts';
import { openAllActions, openAction, runAction, runAiAction } from './text/actions.ts';
import { mountLogResults } from './text/logs.ts';
import { mountTextInspection } from './text/inspection.ts';
import { showResult } from './text/results.ts';
import { query, type TextContext } from './text/context.ts';
import './text/text.css';
export async function mountTextWorkspace(options: {
  container: HTMLElement;
  runtime: Runtime;
  host: HostV1;
  onDirty: (id: string) => void;
  flushState?: () => Promise<void>;
  history?: AutomaticHistory;
  historyEnabled?: boolean;
  slot?: string;
  historyBase?: import('../bridge/revision-records.ts').RevisionCursor;
}): Promise<() => void> {
  const { container, runtime, host } = options;
  const root = document.createElement('section');
  root.className = 'text-workspace';
  container.append(root);
  const abort = new AbortController();
  const value = (id: string): string =>
    String(runtime.getModel().find((input) => input.id === id)?.value ?? '');
  let source: TextSource = {};
  try {
    source = JSON.parse(value('source') || '{}');
  } catch {
    /* Older sessions have no source information. */
  }
  root.innerHTML = workspaceMarkup(`text-${crypto.randomUUID()}`);
  const privacy = container
    .closest('.tool-stage')
    ?.querySelector<HTMLElement>('.on-device-badge--float');
  const privacyParent = privacy?.parentElement;
  if (privacy) {
    privacy.classList.remove('on-device-badge--float');
    root.querySelector('[data-privacy]')!.append(privacy);
  }
  const resultTabs = wireTabs(root.querySelector('[data-result-tabs]')!, {
    key: 'resultView',
    onSelect: (next) => {
      root.dataset.textView = next;
    },
  });
  let ctx: TextContext;
  let automatic: AutomaticHistory | undefined = options.history;
  let activeSlot = options.slot ?? null;
  let ignore = false,
    persistTimer: ReturnType<typeof setTimeout> | undefined;
  let cleanupCharacters: (() => void) | null = null,
    loadingCharacters = false;
  const write = (id: string, text: string): void => {
    if (abort.signal.aborted) return;
    options.onDirty(id);
    automatic?.changed();
    void runtime
      .setInput(id, text)
      .then(() => automatic?.changed())
      .catch((error) => ctx.status(String(error)));
  };
  const persist = (): void => {
    automatic?.changed();
    clearTimeout(persistTimer);
    const text = ctx.editor.document.value.text;
    persistTimer = setTimeout(() => {
      persistTimer = undefined;
      write('body', text);
    }, 180);
  };
  let lastRevision = -1;
  let suggestionKey = '';
  const selected = (): void => {
    if (!ctx) return;
    const current = ctx.editor.document.value;
    const range = current.end - current.start;
    const empty = !current.text.length;
    root.dataset.empty = String(empty);
    query(ctx, '[data-empty-help]').hidden = !empty;
    query(ctx, '[data-selection-actions]').hidden = !range;
    query(ctx, '[data-scope]').textContent = range
      ? `${[...current.text.slice(current.start, current.end)].length} selected`
      : 'Whole text';
    query(ctx, '[data-scope]').classList.toggle('has-selection', !!range);
    query<HTMLButtonElement>(ctx, '[data-copy]').disabled = empty;
    query<HTMLButtonElement>(ctx, '[data-save]').disabled = empty;
    query<HTMLButtonElement>(ctx, '[data-undo]').disabled = !editor.document.canUndo;
    query<HTMLButtonElement>(ctx, '[data-redo]').disabled = !editor.document.canRedo;
    const language = query<HTMLSelectElement>(ctx, '[data-language]').value || 'auto';
    if (lastRevision !== editor.document.revision) {
      lastRevision = editor.document.revision;
      const words = (current.text.match(/\S+/g) ?? []).length;
      const characters = [...current.text].length;
      query(ctx, '[data-facts]').textContent =
        `${words} ${words === 1 ? 'word' : 'words'} · ${characters} ${characters === 1 ? 'character' : 'characters'} · ${current.text.split('\n').length} ${current.text.includes('\n') ? 'lines' : 'line'}`;
      if (root.dataset.wrapManual !== 'true') {
        const wrap =
          (language === 'auto' ? detectCodeLanguage(current.text.slice(0, 8000)) : language) ===
          'plain';
        editor.wrap(wrap);
        query<HTMLInputElement>(ctx, '[data-wrap]').checked = wrap;
      }
    }
    const ids = [
      ...new Set(suggestedActions(current.text.slice(0, 8000), language, ctx.source.name)),
    ];
    const key = ids.join(',');
    if (key !== suggestionKey) {
      suggestionKey = key;
      const strip = query(ctx, '[data-suggestions]');
      strip.replaceChildren();
      for (const id of ids) {
        const operation = ctx.operations.find((op) => op.id === id);
        if (!operation) continue;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn btn--ghost';
        button.dataset.op = id;
        button.innerHTML = actionIcon(operation);
        const label = document.createElement('span');
        label.textContent = actionName(operation);
        button.append(label);
        strip.append(button);
      }
    }
    if (ctx.result && ctx.result.revision !== editor.document.revision) {
      query<HTMLButtonElement>(ctx, '[data-apply]').disabled = true;
      query<HTMLButtonElement>(ctx, '[data-insert-result]').disabled = true;
      query(ctx, '[data-result-notes]').textContent =
        'Your text has changed. Run the action again before replacing it, or copy this result.';
    }
  };
  const editor = mountCodeEditor(root.querySelector('[data-editor]')!, {
    text: value('body'),
    language: value('language') || 'auto',
    label: 'Text to edit',
    placeholder: 'Paste or type your text here…',
    wrap: true,
    onChange: () => {
      if (!ignore && ctx) persist();
      selected();
    },
    onSelect: selected,
  });
  ctx = {
    root,
    host,
    runtime,
    editor,
    source,
    operations: [
      ...(await host.textTools!.operations()),
      {
        id: 'prepare-sharing',
        label: 'Prepare for sharing',
        group: 'Edit',
        keywords: ['privacy', 'redact'],
      },
      {
        id: 'preview-markdown',
        label: 'Markdown preview',
        group: 'Convert',
        keywords: ['markdown', 'render'],
      },
      {
        id: 'ai-rewrite',
        label: 'AI rewrite',
        group: 'Edit',
        keywords: ['reword', 'simplify', 'shorten'],
      },
      {
        id: 'ai-synopsis',
        label: 'AI synopsis',
        group: 'Inspect',
        keywords: ['summary', 'summarize'],
      },
    ],
    actions: {
      open: (operation, adjust) => openAction(ctx, operation, adjust),
      form: (operation) => openActionForm(ctx, operation),
      run: (operation, settings, sourceText) => runAction(ctx, operation, settings, sourceText),
      all: () => openAllActions(ctx),
      ai: (task) => runAiAction(ctx, task),
    },
    presentation: {
      markdown: () => markdownPreview(ctx),
      logs: (el) => mountLogResults(ctx, el),
      inspect: (el) => mountTextInspection(ctx, el),
    },
    abort,
    activeJob: null,
    aiAbort: null,
    lastError: '',
    options: new Map(),
    sync: selected,
    focusText: () => {
      void mode('text', false, true);
    },
    result: null,
    resultCleanup: null,
    write,
    status(message) {
      if (!abort.signal.aborted) {
        query(ctx, '[data-status]').textContent = message;
        query(ctx, '[data-status-row]').hidden = !message;
      }
    },
    resultReady() {
      query(ctx, '[data-result-tabs]').hidden = false;
      root.dataset.resultLayout = ['logs', 'inspect', 'diff'].includes(ctx.result?.operation ?? '')
        ? 'wide'
        : 'split';
      root.classList.add('has-result');
      resultTabs('result');
      const op = ctx.operations.find((item) => item.id === ctx.result?.operation);
      query(ctx, '[data-result-title]').textContent =
        RESULT_NAMES[ctx.result?.operation ?? ''] ?? (op ? actionName(op) : 'Result');
      query(ctx, '[data-result-icon]').innerHTML = op
        ? actionIcon(op)
        : icon('document', { className: 'text-icon' });
      query(ctx, '[data-result-scope]').textContent =
        ctx.result?.operation === 'ascii'
          ? 'Generated from your phrase'
          : ctx.result?.start === 0 && ctx.result.end === editor.document.value.text.length
            ? 'From the whole text'
            : 'From your selection';
      query(ctx, '[data-adjust]').hidden = !op?.options?.length || op.id === 'logs';
      query<HTMLButtonElement>(ctx, '[data-apply]').disabled = false;
      query<HTMLButtonElement>(ctx, '[data-insert-result]').disabled = false;
      query(ctx, '[data-apply] span').textContent =
        ctx.result?.start === 0 && ctx.result.end === editor.document.value.text.length
          ? 'Replace text'
          : 'Replace selection';
      query(ctx, '[data-explain]').hidden = true;
      showResult(ctx);
      query(ctx, '[data-result-title]').focus({ preventScroll: true });
    },
  };
  if (!automatic)
    automatic = mountActionHistory({
      enabled: options.historyEnabled,
      host,
      toolId: runtime.manifest.id,
      el: root,
      canvas: null,
      initial: options.historyBase,
      getSlot: () => activeSlot,
      setSlot: (slot) => {
        activeSlot = slot;
      },
      takeFolder: () => undefined,
      snapshot: () => ({
        ...Object.fromEntries(runtime.getModel().map((input) => [input.id, input.value])),
        body: editor.document.value.text,
        source: JSON.stringify(ctx.source),
        __toolId: runtime.manifest.id,
        __toolVersion: runtime.manifest.version,
        __label: ctx.source.name ?? 'Text draft',
      }),
    });
  const flush = async (): Promise<void> => {
    automatic?.changed();
    await automatic?.flush();
  };
  window.addEventListener(
    'pagehide',
    () => {
      void flush();
    },
    { signal: abort.signal }
  );
  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.visibilityState === 'hidden') void flush();
    },
    { signal: abort.signal }
  );
  const updateHistory = (): void => {
    const state = automatic?.status() ?? 'Save a copy to keep this text.';
    const label = query(ctx, '[data-history-status]');
    label.title = state;
    label.textContent = /(?:work|checkpoint) saved at/i.test(state)
      ? 'Draft saved on this device'
      : /could not|paused|another tab|failed/i.test(state)
        ? state
        : automatic
          ? 'Draft recovery on'
          : state;
  };
  const stopHistory = automatic?.subscribe(updateHistory);
  updateHistory();
  const showSource = (): void => {
    query(ctx, '[data-source]').textContent = ctx.source.name ?? 'Untitled text';
    query(ctx, '[data-source]').title = ctx.source.assetId
      ? `${ctx.source.origin ?? 'Catalog'}${ctx.source.writable ? '' : ' · Read-only source; save a copy'}`
      : 'Working draft';
    query(ctx, '[data-save] span').textContent =
      ctx.source.assetId && ctx.source.writable ? 'Save changes' : 'Save';
  };
  const mode = async (next: string, remember = true, focus = false): Promise<void> => {
    if (remember && value('workspaceMode') !== next) write('workspaceMode', next);
    query(ctx, '[data-document]').hidden = next !== 'text';
    query(ctx, '[data-characters]').hidden = next !== 'characters';
    root.querySelectorAll<HTMLElement>('[data-mode]').forEach((button) => {
      button.setAttribute('aria-selected', String(button.dataset.mode === next));
      button.classList.toggle('is-active', button.dataset.mode === next);
      button.tabIndex = button.dataset.mode === next ? 0 : -1;
    });
    if (next === 'text') {
      if (focus) editor.input.focus({ preventScroll: true });
    } else if (!cleanupCharacters && !loadingCharacters) {
      loadingCharacters = true;
      try {
        const { mountCharacters } = await import('./text/characters.ts');
        if (abort.signal.aborted) return;
        let recents: string[] = [];
        try {
          recents = JSON.parse(value('characterRecents') || '[]');
        } catch {
          /* Start with no recent picks. */
        }
        cleanupCharacters = await mountCharacters(
          query(ctx, '[data-characters]'),
          host,
          (char) => {
            void mode('text', true, true);
            editor.replace(char);
          },
          { recents, save: (items) => write('characterRecents', JSON.stringify(items)) }
        );
        if (abort.signal.aborted) cleanupCharacters();
      } catch (error) {
        ctx.status(error instanceof Error ? error.message : String(error));
      } finally {
        loadingCharacters = false;
      }
    }
  };
  wireTabs(root.querySelector('[aria-label="Text workspace"]')!, {
    key: 'mode',
    onSelect: (next, info) => {
      void mode(next, info.reason !== 'programmatic');
    },
  });
  const load = (handoff: TextHandoff): void => {
    ctx.activeJob?.abort();
    ctx.activeJob = null;
    query(ctx, '[data-cancel]').hidden = true;
    ctx.aiAbort?.();
    ctx.resultCleanup?.();
    ctx.resultCleanup = null;
    ctx.result = null;
    query(ctx, '[data-result-tabs]').hidden = true;
    root.dataset.textView = 'text';
    ctx.source = handoff.source;
    write('source', JSON.stringify(ctx.source));
    const lang = handoff.language ?? syntaxLanguageForFile(ctx.source.name ?? '');
    query<HTMLSelectElement>(ctx, '[data-language]').value = lang;
    editor.language(lang);
    write('language', lang);
    root.classList.remove('has-result');
    editor.loadText(handoff.text);
    persist();
    showSource();
    query(ctx, '[data-result]').hidden = true;
    ctx.result = null;
    void mode('text', true, true);
    ctx.status(`Opened ${ctx.source.name ?? 'text'}.`);
  };
  const openDocument = async (handoff: TextHandoff): Promise<void> => {
    if (
      editor.document.value.text &&
      !(await confirmDialog({
        title: 'Replace the text in the editor?',
        message: `Open ${handoff.source.name ?? 'a new text'} in this editor. Cancel to save a separate copy of your current text first.`,
        confirmLabel: 'Open text',
        danger: false,
      }))
    )
      return;
    ctx.status('Opening text…');
    await flush();
    load(handoff);
  };
  const save = (result = false): void => {
    const picked = result ? ctx.result : null;
    if (result && !picked) return;
    const text = picked?.value.text ?? editor.document.value.text;
    const saveSource = { ...ctx.source, aiEdited: ctx.source.aiEdited || picked?.ai };
    const defaultName = result
      ? `text-result.${picked!.value.format}`
      : (ctx.source.name ?? 'text.txt');
    const canReplace = !result && ctx.source.assetId && ctx.source.writable;
    const modal = mountModal(
      `<form><h2>${icon('document', { className: 'text-icon' })}${canReplace ? 'Save changes' : 'Save text'}</h2><p class="text-muted">${canReplace ? 'Update the catalog file you opened. Its project references keep working.' : `Save a text asset in the catalog${ctx.source.folderId ? ' and the source project' : ''}.`}</p><label class="text-save-name">Filename <input data-name value="${esc(defaultName)}"></label><p role="status" data-message class="text-form-error"></p><footer class="text-dialog-footer"><button type="button" class="btn btn--ghost" data-close>Cancel</button>${canReplace ? '<button type="button" class="btn btn--ghost" data-copy>Save a copy</button><button type="submit" class="btn btn--primary" data-replace>Save changes</button>' : '<button type="submit" class="btn btn--primary" data-copy>Save to catalog</button>'}</footer></form>`,
      {
        className: 'modal text-action-dialog',
        ariaLabel: 'Save text',
        initialFocus: (el) => el.querySelector<HTMLElement>('[data-name]'),
      }
    );
    modal.el.querySelector('[data-close]')!.addEventListener('click', () => modal.close());
    let saving = false;
    const run = async (replace: boolean): Promise<void> => {
      if (saving) return;
      const name = modal.el
        .querySelector<HTMLInputElement>('[data-name]')!
        .value.trim()
        .replace(/[\\/]/g, '-');
      if (!name) {
        modal.el.querySelector('[data-message]')!.textContent = 'Enter a filename.';
        return;
      }
      saving = true;
      modal.el.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
        button.disabled = true;
      });
      try {
        clearTimeout(persistTimer);
        persistTimer = undefined;
        await runtime.setInput('body', editor.document.value.text);
        await flush();
        const next = await saveTextAsset(host, text, saveSource, name, replace);
        if (!result) {
          ctx.source = next;
          await runtime.setInput('source', JSON.stringify(next));
          await flush();
          showSource();
        }
        modal.close();
        ctx.status(replace ? 'Saved to the source asset.' : 'Saved a copy in the catalog.');
      } catch (error) {
        saving = false;
        modal.el.querySelector('[data-message]')!.textContent =
          error instanceof Error ? error.message : String(error);
        modal.el.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
          button.disabled = false;
        });
      }
    };
    modal.el.querySelector('form')!.addEventListener('submit', (event) => {
      event.preventDefault();
      void run(!!canReplace);
    });
    if (canReplace) modal.el.querySelector('[data-copy]')!.addEventListener('click', () => {
      void run(false);
    });
  };
  const copy = async (text: string): Promise<void> => {
    try {
      await host.clipboard.writeText(text);
      ctx.status('Copied.');
    } catch {
      ctx.status('Could not write to the clipboard. Select the text and copy it.');
    }
  };
  const download = async (text: string, name: string): Promise<void> => {
    try {
      await host.export.download(new Blob([text], { type: 'text/plain;charset=utf-8' }), name);
    } catch (error) {
      ctx.status(String(error));
    }
  };
  root.addEventListener(
    'click',
    async (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
      if (!button) return;
      try {
        if (button.dataset.mode || button.dataset.resultView) return;
        if (button.hasAttribute('data-open-menu')) openTextMenu(ctx, button, 'open');
        else if (button.hasAttribute('data-document-menu')) openTextMenu(ctx, button, 'document');
        else if (button.hasAttribute('data-result-menu')) openTextMenu(ctx, button, 'result');
        else if (button.dataset.sample) {
          const sample = button.dataset.sample;
          await openDocument({
            text: SAMPLE_TEXT[sample] ?? '',
            source: {
              name: `sample.${sample === 'json' ? 'json' : sample === 'logs' ? 'log' : 'txt'}`,
              origin: 'Sample',
            },
            language: sample === 'json' ? 'json' : 'auto',
          });
        } else if (button.hasAttribute('data-new'))
          await openDocument({ text: '', source: {}, language: 'auto' });
        else if (button.hasAttribute('data-adjust') && ctx.result) {
          const op = ctx.operations.find((item) => item.id === ctx.result?.operation);
          if (op) openAction(ctx, op, true);
        } else if (button.hasAttribute('data-markdown')) await markdownPreview(ctx);
        else if (button.hasAttribute('data-all')) openAllActions(ctx);
        else if (button.dataset.op) {
          const operation = ctx.operations.find((op) => op.id === button.dataset.op);
          if (operation) openAction(ctx, operation);
        } else if (button.dataset.ai)
          await runAiAction(ctx, button.dataset.ai as 'synopsis' | 'rewrite' | 'explain-logs');
        else if (button.hasAttribute('data-open'))
          query<HTMLInputElement>(ctx, '[data-file]').click();
        else if (button.hasAttribute('data-paste')) {
          try {
            const text = await navigator.clipboard.readText();
            editor.replace(text);
          } catch {
            ctx.focusText();
            ctx.status(
              'Clipboard access is unavailable. Paste into the editor with Ctrl+V or Command+V.'
            );
          }
        } else if (button.hasAttribute('data-catalog')) {
          const ref = await host.assets.pick({
            type: 'text',
            types: ['text', 'data'],
            title: 'Open text from catalog',
            allowUpload: true,
          });
          if (ref) await openDocument(await readTextAsset(host, ref));
        } else if (button.hasAttribute('data-save')) save();
        else if (button.hasAttribute('data-save-result')) save(true);
        else if (button.hasAttribute('data-copy')) await copy(editor.document.value.text);
        else if (button.hasAttribute('data-copy-result') && ctx.result)
          await copy(ctx.result.value.text);
        else if (button.hasAttribute('data-download'))
          downloadText(ctx, editor.document.value.text, ctx.source.name ?? 'text.txt');
        else if (button.hasAttribute('data-download-result') && ctx.result)
          downloadText(ctx, ctx.result.value.text, `text-result.${ctx.result.value.format}`);
        else if (button.hasAttribute('data-alias-map') && ctx.result)
          await download(
            JSON.stringify(ctx.result.value.details?.aliases, null, 2),
            'private-alias-map.json'
          );
        else if (button.hasAttribute('data-undo')) editor.undo();
        else if (button.hasAttribute('data-redo')) editor.redo();
        else if (button.hasAttribute('data-dismiss-result')) {
          query(ctx, '[data-result]').hidden = true;
          query(ctx, '[data-result-tabs]').hidden = true;
          root.classList.remove('has-result');
          resultTabs('text');
          editor.input.focus({ preventScroll: true });
        } else if (button.hasAttribute('data-cancel')) {
          ctx.activeJob?.abort();
          ctx.aiAbort?.();
          ctx.activeJob = null;
          ctx.aiAbort = null;
          button.hidden = true;
          ctx.status('Cancelled.');
        } else if (
          (button.hasAttribute('data-apply') || button.hasAttribute('data-insert-result')) &&
          ctx.result
        ) {
          const r = ctx.result,
            insert = button.hasAttribute('data-insert-result');
          const done = editor.replace(
            insert ? '\n' + r.value.text : r.value.text,
            { start: insert ? r.end : r.start, end: r.end },
            r.revision
          );
          if (done) {
            if (r.ai) {
              ctx.source.aiEdited = true;
              write('source', JSON.stringify(ctx.source));
            }
            query(ctx, '[data-result]').hidden = true;
            query(ctx, '[data-result-tabs]').hidden = true;
            root.classList.remove('has-result');
            resultTabs('text');
            ctx.sync();
            ctx.status('Applied. Undo restores the original.');
          } else ctx.status('The text has changed. Run the action again before applying.');
        }
      } catch (error) {
        ctx.status(error instanceof Error ? error.message : String(error));
      }
    },
    { signal: abort.signal }
  );
  query<HTMLInputElement>(ctx, '[data-file]').addEventListener(
    'change',
    async (event) => {
      const input = event.target as HTMLInputElement;
      try {
        if (input.files?.[0]) await openDocument(await readTextFile(input.files[0]));
      } catch (error) {
        ctx.status(error instanceof Error ? error.message : String(error));
      }
      input.value = '';
    },
    { signal: abort.signal }
  );
  query<HTMLSelectElement>(ctx, '[data-language]').value = value('language') || 'auto';
  query(ctx, '[data-language]').addEventListener(
    'change',
    (event) => {
      const lang = (event.target as HTMLSelectElement).value;
      editor.language(lang);
      write('language', lang);
      lastRevision = -1;
      selected();
    },
    { signal: abort.signal }
  );
  query(ctx, '[data-wrap]').addEventListener(
    'change',
    () => {
      root.dataset.wrapManual = 'true';
      editor.wrap(query<HTMLInputElement>(ctx, '[data-wrap]').checked);
    },
    { signal: abort.signal }
  );
  const unsub = runtime.subscribe(() => {
    const current = value('body');
    if (current !== editor.document.value.text && persistTimer === undefined) {
      ignore = true;
      editor.setText(current);
      ignore = false;
    }
  });
  editor.input.addEventListener(
    'keydown',
    (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        const operation = ctx.operations.find((op) => op.id === 'replace');
        if (operation) openAction(ctx, operation);
      }
    },
    { signal: abort.signal }
  );
  root.addEventListener(
    'keydown',
    (event) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLowerCase() === 'k') {
        event.preventDefault();
        event.stopPropagation();
        openAllActions(ctx);
      }
      if (event.key.toLowerCase() === 's') {
        event.preventDefault();
        event.stopPropagation();
        save();
      }
    },
    { signal: abort.signal }
  );
  const selectionCleanup = wireSelectionActions(ctx);
  const pending = takeTextHandoff();
  if (pending) load(pending);
  else
    void mode(
      value('workspaceMode') || (editor.document.value.text ? 'text' : 'characters'),
      false
    );
  showSource();
  selected();
  return () => {
    clearTimeout(persistTimer);
    if (value('body') !== editor.document.value.text) write('body', editor.document.value.text);
    void flush().finally(() => {
      if (automatic !== options.history) automatic?.dispose();
    });
    abort.abort();
    ctx.activeJob?.abort();
    ctx.aiAbort?.();
    ctx.resultCleanup?.();
    cleanupCharacters?.();
    stopHistory?.();
    if (privacy && privacyParent?.isConnected) {
      privacy.classList.add('on-device-badge--float');
      privacyParent.append(privacy);
    }
    unsub();
    selectionCleanup();
    editor.destroy();
    root.remove();
  };
}
