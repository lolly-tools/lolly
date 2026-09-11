// SPDX-License-Identifier: MPL-2.0
import type { TextOperation } from '@lolly-tools/core/host-v1';
import { mountModal } from '../../components/modal.ts';
import { escapeHtml as esc } from '../../lib/util/escape.ts';
import { runTextOperation } from '../../bridge/text-tools.ts';
import { segHtml } from '../../lib/seg.ts';
import {
  actionName,
  actionHelp,
  actionIcon,
  needsText,
  findActions,
  suggestedActions,
} from './shared.ts';
import { query, selectionForAction, type TextContext } from './context.ts';
export async function runAction(
  ctx: TextContext,
  operation: TextOperation,
  options: Record<string, string | number | boolean> = {},
  sourceText?: string
): Promise<boolean> {
  ctx.activeJob?.abort();
  ctx.aiAbort?.();
  const controller = new AbortController();
  ctx.activeJob = controller;
  const selection = selectionForAction(ctx);
  if (sourceText !== undefined) selection.text = sourceText;
  ctx.lastError = '';
  ctx.options.set(operation.id, options);
  ctx.status(`${actionName(operation)}…`);
  query(ctx, '[data-cancel]').hidden = false;
  try {
    const value = await runTextOperation(
      { text: selection.text, operation: operation.id, options },
      controller.signal
    );
    if (ctx.abort.signal.aborted || controller !== ctx.activeJob) return false;
    if (ctx.editor.document.revision !== selection.revision) {
      ctx.status(
        'The text changed while the action was running. Run it again on the current text.'
      );
      return false;
    }
    ctx.result = { value, ...selection, ai: false, operation: operation.id };
    const simple =
      operation.group === 'Edit' &&
      !operation.options &&
      !['clean', 'restore'].includes(operation.id);
    if (simple) {
      ctx.editor.replace(value.text, selection, selection.revision);
      ctx.status(`${operation.label} applied. Undo restores the original.`);
    } else {
      ctx.resultReady();
      ctx.status('Result ready. Review it before applying.');
    }
    ctx.sync();
    return true;
  } catch (error) {
    ctx.lastError = error instanceof Error ? error.message : String(error);
    if (!ctx.abort.signal.aborted && ctx.activeJob === controller) ctx.status(ctx.lastError);
    return false;
  } finally {
    if (ctx.activeJob === controller) {
      ctx.activeJob = null;
      query(ctx, '[data-cancel]').hidden = true;
    }
  }
}
export function openAction(ctx: TextContext, operation: TextOperation, adjust = false): void {
  ctx.focusText();
  if (needsText(operation) && !selectionForAction(ctx).text.trim()) {
    ctx.status('Paste, type or open some text first, then choose this action.');
    return;
  }
  if (operation.id === 'prepare-sharing') {
    const selected = selectionForAction(ctx);
    void import('../../lib/prepare-entry.ts').then(({ openPreparation }) =>
      openPreparation(ctx.host, [new File([selected.text], 'text.txt', { type: 'text/plain' })])
    );
    return;
  }
  if (operation.id === 'preview-markdown') {
    void ctx.presentation.markdown();
    return;
  }
  if (operation.id === 'ai-rewrite') {
    void runAiAction(ctx, 'rewrite');
    return;
  }
  if (operation.id === 'ai-synopsis') {
    void runAiAction(ctx, 'synopsis');
    return;
  }

  const defaults = Object.fromEntries(
    (operation.options ?? []).map((option) => [option.id, option.default ?? ''])
  );
  if (
    !operation.options?.length ||
    (!adjust &&
      ['logs', 'json', 'sort', 'hash', 'uuid', 'lorem', 'base64-encode', 'timestamp'].includes(
        operation.id
      ))
  ) {
    void runAction(ctx, operation, defaults);
  } else ctx.actions.form(operation);
}
export function openAllActions(ctx: TextContext): void {
  const selection = selectionForAction(ctx);
  const preferred = suggestedActions(
    selection.text,
    query<HTMLSelectElement>(ctx, '[data-language]').value,
    ctx.source.name
  );
  const modal = mountModal(
    `<header class="text-dialog-heading"><h2>Find an action</h2><p class="text-muted">${selection.text.trim() ? 'Use the selection, or the whole text when nothing is selected.' : 'Create something new, or add text to edit and analyse.'}</p></header><label class="text-search-field"><input type="search" aria-label="Find an action" placeholder="Try “uppercase”, “JSON”, “summary” or “ASCII”…" data-search></label>${segHtml(
      'text-action-group',
      [
        { id: 'popular', label: 'Popular' },
        { id: 'Edit', label: 'Edit' },
        { id: 'Inspect', label: 'Inspect' },
        { id: 'Convert', label: 'Convert' },
        { id: 'Generate', label: 'Create' },
      ],
      'popular',
      'Action category',
      { attr: 'data-group', extraClass: 'text-action-groups' }
    )}<div data-actions class="text-action-list"></div><footer class="text-dialog-footer"><span class="text-muted">Enter to choose · Esc to close</span><button class="btn btn--ghost" data-close>Close</button></footer>`,
    {
      className: 'modal text-action-dialog text-action-picker',
      ariaLabel: 'Text actions',
      initialFocus: (el) => el.querySelector('input'),
    }
  );
  const search = modal.el.querySelector<HTMLInputElement>('[data-search]')!,
    list = modal.el.querySelector<HTMLElement>('[data-actions]')!;
  let group = 'popular';
  const render = (): void => {
    let found = findActions(ctx.operations, search.value, preferred);
    if (!search.value.trim())
      found =
        group === 'popular'
          ? found
              .filter((op) =>
                [
                  ...preferred,
                  'upper',
                  'lower',
                  'clean',
                  'replace',
                  'diff',
                  'inspect',
                  'logs',
                  'ascii',
                ].includes(op.id)
              )
              .slice(0, 10)
          : found.filter((op) => op.group === group);
    list.innerHTML =
      found
        .map(
          (op) =>
            `<button class="btn btn--ghost text-action-item" data-operation="${esc(op.id)}"${needsText(op) && !selection.text.trim() ? ' disabled' : ''}>${actionIcon(op)}<span><strong>${esc(actionName(op))}</strong><span>${esc(actionHelp(op))}</span></span></button>`
        )
        .join('') ||
      '<p class="text-no-results">No actions match. Try a shorter task name, such as “spaces” or “JSON”.</p>';
  };
  search.addEventListener('input', render);
  modal.el.querySelector('[data-close]')!.addEventListener('click', () => modal.close());
  modal.el.addEventListener('click', (event) => {
    const target = (event.target as Element).closest<HTMLElement>('[data-group]');
    if (!target) return;
    group = target.dataset.group!;
    modal.el.querySelectorAll<HTMLElement>('[data-group]').forEach((el) => {
      el.setAttribute('aria-pressed', String(el === target));
    });
    search.value = '';
    render();
  });
  const choose = (button: HTMLElement | null): void => {
    const op = ctx.operations.find((op) => op.id === button?.dataset.operation);
    if (!op) return;
    modal.close();
    openAction(ctx, op);
  };
  list.addEventListener('click', (event) =>
    choose((event.target as Element).closest('[data-operation]'))
  );
  search.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      choose(list.querySelector('[data-operation]:not(:disabled)'));
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      list.querySelector<HTMLElement>('[data-operation]:not(:disabled)')?.focus();
    }
  });
  list.addEventListener('keydown', (event) => {
    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    event.preventDefault();
    const buttons = [...list.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'ArrowUp' && at === 0) search.focus();
    else
      buttons[
        Math.max(0, Math.min(buttons.length - 1, at + (event.key === 'ArrowDown' ? 1 : -1)))
      ]?.focus();
  });
  render();
}
export async function runAiAction(
  ctx: TextContext,
  task: 'synopsis' | 'rewrite' | 'explain-logs'
): Promise<void> {
  const selection = selectionForAction(ctx);
  if (task === 'explain-logs' && ctx.result?.operation === 'logs') {
    const events = ctx.result.value.details?.visible as
      | Array<{ line: number; lastLine: number; raw: string }>
      | undefined;
    const offset = Number(ctx.result.value.details?.sourceLineOffset ?? 0);
    if (events)
      selection.text = events
        .map(
          (event) =>
            `[original lines ${event.line + offset}-${event.lastLine + offset}] ${event.raw}`
        )
        .join('');
  }
  if (!selection.text.trim()) {
    ctx.status('Add some text first.');
    return;
  }
  if (selection.text.length > 16000) {
    ctx.status('Select up to 16,000 characters for an AI action.');
    return;
  }
  try {
    const model = await import('../../lib/reworder.ts');
    if (!model.rewordAvailable()) {
      ctx.status(
        'Local AI is not available with the current settings. Text actions still work on device.'
      );
      return;
    }
    const state = await model.rewordStatus();
    if (state === 'unstaged') {
      ctx.status('The local text model has not been installed in this app.');
      return;
    }
    const start = async (): Promise<void> => {
      if (selection.revision !== ctx.editor.document.revision) {
        ctx.status('The text changed. Run the AI action again on the current selection.');
        return;
      }
      ctx.activeJob?.abort();
      ctx.aiAbort?.();
      const controller = new AbortController();
      ctx.activeJob = controller;
      query(ctx, '[data-cancel]').hidden = false;
      try {
        const job = model.assistText(
          selection.text,
          task,
          (progress) => {
            if (!ctx.abort.signal.aborted && ctx.activeJob === controller)
              ctx.status(
                `${progress.phase === 'download' ? 'Downloading local model' : 'Generating'} ${Math.round(progress.fraction * 100)}%`
              );
          },
          task === 'explain-logs'
            ? 1
            : 1 +
                (ctx.editor.document.value.text.slice(0, selection.start).match(/\n/g) ?? []).length
        );
        ctx.aiAbort = job.abort;
        const parts = await job.done;
        if (ctx.abort.signal.aborted || ctx.activeJob !== controller) return;
        if (selection.revision !== ctx.editor.document.revision) {
          ctx.status('The text changed. Run the AI action again on the current text.');
          return;
        }
        ctx.result = {
          ...selection,
          ai: true,
          operation: task,
          value: {
            text: parts.join('\n\n'),
            format: 'txt',
            notes: [
              task === 'rewrite'
                ? 'AI rewrite. Checks preserve names, numbers and links; review meaning against the source.'
                : 'AI-selected excerpts, using the original wording. Review the surrounding context; the selection may omit important details.',
              task === 'explain-logs'
                ? 'These are selected observations. They do not establish a root cause. Original line labels refer to the loaded log.'
                : 'Long passages are processed in sections.',
            ],
          },
        };
        ctx.resultReady();
        ctx.status('AI result ready for review.');
      } catch (error) {
        if (ctx.activeJob === controller)
          ctx.status(error instanceof Error ? error.message : String(error));
      } finally {
        if (ctx.activeJob === controller) {
          ctx.activeJob = null;
          ctx.aiAbort = null;
          query(ctx, '[data-cancel]').hidden = true;
        }
      }
    };
    if (state === 'need-download') {
      const dialog = mountModal(
        `<h2>Local text assistance</h2><p>Download the ${Math.round(model.rewordModelBytes() / 1024 / 1024)} MiB model once. Your text is processed on this device.</p><div class="text-row"><button class="btn btn--primary" data-run>Download and run</button><button class="btn" data-close>Cancel</button></div>`,
        { className: 'modal text-action-dialog', ariaLabel: 'Local text assistance' }
      );
      dialog.el.querySelector('[data-close]')!.addEventListener('click', () => dialog.close());
      dialog.el.querySelector('[data-run]')!.addEventListener('click', () => {
        dialog.close();
        void start();
      });
    } else await start();
  } catch (error) {
    ctx.status(error instanceof Error ? error.message : String(error));
  }
}
