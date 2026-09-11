// SPDX-License-Identifier: MPL-2.0
import { icon } from '../../lib/icons.ts';
import { mountModal } from '../../components/modal.ts';
import { mountBodyPopover, pointAnchor } from '../../components/body-popover.ts';
import { menuItemHtml } from '../../lib/context-menu.ts';
import { query, selectionForAction, type TextContext } from './context.ts';
export async function markdownPreview(ctx: TextContext): Promise<void> {
  const { mdToHtml } = await import('../../lib/markdown.ts');
  const current = selectionForAction(ctx);
  const modal = mountModal(
    '<h2>Markdown preview</h2><article data-preview></article><button class="btn" data-close>Close</button>',
    { className: 'modal text-action-dialog', ariaLabel: 'Markdown preview' }
  );
  modal.el.querySelector('[data-preview]')!.innerHTML = mdToHtml(current.text);
  modal.el.querySelector('[data-close]')!.addEventListener('click', () => modal.close());
}
export function downloadText(ctx: TextContext, text: string, name: string): void {
  const dialog = mountModal(
    '<h2>Download text</h2><label>Format <select data-format><option value="source">Text file (current content)</option><option value="md">Markdown</option><option value="html">HTML document</option><option value="rtf">RTF document</option><option value="docx">Word document</option><option value="odt">OpenDocument text</option></select></label><div class="text-row"><button class="btn btn--primary" data-download>Download</button><button class="btn" data-close>Cancel</button></div><p role="status" data-message></p>',
    { className: 'modal text-action-dialog', ariaLabel: 'Download text' }
  );
  dialog.el.querySelector('[data-close]')!.addEventListener('click', () => dialog.close());
  dialog.el.querySelector('[data-download]')!.addEventListener('click', async () => {
    const format = dialog.el.querySelector<HTMLSelectElement>('[data-format]')!.value;
    try {
      let blob: Blob;
      const base = name.replace(/\.[^.]+$/, '');
      if (format === 'source' || format === 'md')
        blob = new Blob([text], { type: format === 'md' ? 'text/markdown' : 'text/plain' });
      else {
        const exportText = await import('../../lib/text-doc-export.ts');
        blob =
          format === 'docx'
            ? await exportText.mdToDocxBlob(text, base)
            : format === 'odt'
              ? await exportText.mdToOdtBlob(text, base)
              : format === 'rtf'
                ? new Blob([exportText.mdToRtf(text)], { type: 'application/rtf' })
                : new Blob([exportText.mdToStandaloneHtml(text, base)], { type: 'text/html' });
      }
      await ctx.host.export.download(blob, format === 'source' ? name : `${base}.${format}`);
      dialog.close();
    } catch (error) {
      dialog.el.querySelector('[data-message]')!.textContent =
        error instanceof Error ? error.message : String(error);
    }
  });
}
export function wireSelectionActions(ctx: TextContext): () => void {
  let close: (() => void) | null = null;
  const show = (anchor: HTMLElement | ReturnType<typeof pointAnchor>): void => {
    close?.();
    const pop = mountBodyPopover(
      anchor,
      (el, handle) => {
        el.innerHTML =
          menuItemHtml('upper', icon('font'), 'UPPERCASE') +
          menuItemHtml('lower', icon('font'), 'lowercase') +
          menuItemHtml('replace', icon('repeat'), 'Find and replace') +
          menuItemHtml('inspect', icon('search'), 'Inspect selection') +
          menuItemHtml('rewrite', icon('aiSpark'), 'AI rewrite') +
          menuItemHtml('all', icon('grid'), 'All actions…');
        el.addEventListener('click', (event) => {
          const act = (event.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
          if (!act) return;
          handle.close();
          if (act === 'all') ctx.actions.all();
          else if (act === 'rewrite') void ctx.actions.ai('rewrite');
          else {
            const operation = ctx.operations.find((op) => op.id === act);
            if (operation) ctx.actions.open(operation);
          }
        });
        return el.querySelector<HTMLElement>('button');
      },
      { className: 'folder-menu', role: 'menu', ariaLabel: 'Text selection actions' }
    );
    close = () => pop.close();
    pop.open();
  };
  const menu = (event: MouseEvent): void => {
    if (ctx.editor.document.value.start === ctx.editor.document.value.end) return;
    event.preventDefault();
    show(pointAnchor(event.clientX, event.clientY));
  };
  ctx.editor.input.addEventListener('contextmenu', menu, { signal: ctx.abort.signal });
  query(ctx, '[data-selection-actions]').addEventListener(
    'click',
    (event) => show(event.currentTarget as HTMLElement),
    { signal: ctx.abort.signal }
  );
  return () => close?.();
}

export function openTextMenu(
  ctx: TextContext,
  anchor: HTMLElement,
  kind: 'open' | 'document' | 'result'
): void {
  const choices: Array<{
    action: string;
    label: string;
    glyph: import('../../lib/icons.ts').IconName;
  }> =
    kind === 'open'
      ? [
          { action: 'open', label: 'Open a file', glyph: 'upload' },
          { action: 'catalog', label: 'Open from catalog', glyph: 'grid' },
        ]
      : kind === 'document'
        ? [
            { action: 'paste', label: 'Paste text', glyph: 'clipboard' },
            { action: 'download', label: 'Download file…', glyph: 'download' },
            { action: 'new', label: 'New text…', glyph: 'filePlus' },
          ]
        : [
            { action: 'save-result', label: 'Save result to catalog…', glyph: 'document' },
            { action: 'download-result', label: 'Download result…', glyph: 'download' },
          ];
  if (kind === 'result' && ctx.result) {
    if (!query(ctx, '[data-apply]').hidden)
      choices.push({ action: 'insert-result', label: 'Insert after selection', glyph: 'plus' });
    if (ctx.result.value.details?.aliases)
      choices.push({ action: 'alias-map', label: 'Download private alias map', glyph: 'keyframe' });
    if (ctx.result.operation === 'logs')
      choices.push({ action: 'explain', label: 'AI synopsis of these events', glyph: 'aiSpark' });
  }
  const popover = mountBodyPopover(
    anchor,
    (el, handle) => {
      el.innerHTML = choices
        .map((choice) => menuItemHtml(choice.action, icon(choice.glyph), choice.label))
        .join('');
      el.addEventListener('click', (event) => {
        const action = (event.target as Element).closest<HTMLElement>('[data-act]')?.dataset.act;
        if (!action) return;
        handle.close();
        ctx.root.querySelector<HTMLButtonElement>(`[data-${action}]`)?.click();
      });
      return el.querySelector('button');
    },
    {
      className: 'folder-menu',
      role: 'menu',
      ariaLabel: kind === 'result' ? 'Result actions' : 'Document actions',
    }
  );
  ctx.abort.signal.addEventListener('abort', () => popover.close(), { once: true });
  popover.open();
}
