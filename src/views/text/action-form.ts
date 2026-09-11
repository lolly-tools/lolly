// SPDX-License-Identifier: MPL-2.0
import type { TextOperation } from '@lolly-tools/core/host-v1';
import { mountModal } from '../../components/modal.ts';
import { escapeHtml as esc } from '../../lib/html.ts';
import { detectCodeLanguage } from '../../../../../engine/src/text-syntax.ts';
import { actionName, actionHelp, actionIcon } from './shared.ts';
import { selectionForAction, type TextContext } from './context.ts';

const ADVANCED: Record<string, string[]> = {
  ascii: ['ink', 'spacing', 'width', 'align'],
  regex: ['flags'],
  diff: ['granularity'],
  hash: ['expected'],
  random: ['alphabet'],
  xml: ['schema'],
};
export function openActionForm(ctx: TextContext, operation: TextOperation): void {
  const source = selectionForAction(ctx);
  const cached = ctx.options.get(operation.id) ?? {};
  const options = operation.options ?? [];
  const defaults = { ...cached };
  const detected = detectCodeLanguage(source.text);
  if (
    operation.id === 'format' &&
    !defaults.language &&
    options.find((o) => o.id === 'language')?.choices?.includes(detected)
  )
    defaults.language = detected;
  if (
    operation.id === 'structured' &&
    !defaults.from &&
    ['json', 'yaml', 'toml'].includes(detected)
  )
    defaults.from = detected;
  const render = (option: (typeof options)[number]): string => {
    const value = defaults[option.id] ?? option.default ?? '';
    const label = option.id === 'width' ? 'Maximum columns (0 = automatic)' : option.label;
    const multiline = ['after', 'schema', 'map', 'literals', 'alphabet'].includes(option.id);
    const required =
      ['find', 'pattern', 'map', 'after'].includes(option.id) ||
      (operation.id === 'schema' && option.id === 'schema');
    const control =
      option.type === 'select'
        ? `<select name="${esc(option.id)}">${option.choices?.map((c) => `<option value="${esc(c)}"${c === value ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select>`
        : multiline
          ? `<textarea name="${esc(option.id)}" rows="${option.id === 'after' || option.id === 'schema' ? 6 : 3}"${required ? ' required' : ''}>${esc(String(value))}</textarea>`
          : `<input name="${esc(option.id)}" type="${option.type === 'number' ? 'number' : 'text'}" value="${esc(String(value))}"${required ? ' required' : ''}>`;
    return `<label${option.id === 'replacement' && operation.id === 'regex' ? ' data-replacement' : ''}><span>${esc(label)}</span>${control}</label>`;
  };
  const advanced = options.filter((option) => ADVANCED[operation.id]?.includes(option.id));
  const ordinary = options.filter((option) => !advanced.includes(option));
  const verb =
    operation.id === 'ascii'
      ? 'Create art'
      : operation.id === 'diff'
        ? 'Compare text'
        : ['schema', 'xml'].includes(operation.id)
          ? 'Validate'
          : operation.id === 'regex'
            ? 'Find matches'
            : operation.group === 'Generate'
              ? 'Generate'
              : 'Preview result';
  const scope =
    source.start !== source.end &&
    (source.start > 0 || source.end < ctx.editor.document.value.text.length)
      ? `${source.end - source.start} selected characters`
      : `Whole text · ${source.text.length} characters`;
  let running = false;
  let previewRevision = 0;
  const form = mountModal(
    `<form class="text-action-form"><header><h2>${actionIcon(operation)}${esc(actionName(operation))}</h2><p class="text-muted">${esc(actionHelp(operation))}</p><p class="text-form-scope">${operation.id === 'ascii' ? 'Creates a new result. Your text stays unchanged.' : esc(scope)}</p></header>
      ${operation.id === 'ascii' ? `<label><span>Text for the banner</span><textarea name="__phrase" rows="2" maxlength="300" placeholder="Your words here" required>${esc(String(cached.__phrase ?? source.text))}</textarea></label>` : ''}
      ${ordinary.map(render).join('')}
      ${advanced.length ? `<details class="text-advanced"><summary>${operation.id === 'xml' ? 'Validate against a schema (optional)' : 'More options'}</summary><div>${advanced.map(render).join('')}</div></details>` : ''}
      ${operation.id === 'ascii' ? '<div class="text-ascii-preview"><span class="text-muted">Live preview</span><pre data-live-preview aria-label="ASCII preview"></pre></div>' : ''}
      <p role="status" data-form-message class="text-form-error" hidden></p><footer class="text-dialog-footer"><button type="button" class="btn btn--ghost" data-close>Cancel</button><button type="submit" class="btn btn--primary" data-submit>${esc(verb)}</button></footer></form>`,
    {
      className: 'modal text-action-dialog',
      ariaLabel: actionName(operation),
      onClose: () => {
        if (running) ctx.activeJob?.abort();
      },
      initialFocus: (el) => el.querySelector<HTMLElement>('textarea, input, select'),
    }
  );
  const message = form.el.querySelector<HTMLElement>('[data-form-message]')!;
  const fields = (): Record<string, string | number | boolean> => {
    const data = new FormData(form.el.querySelector('form')!);
    return Object.fromEntries(
      options.map((option) => [
        option.id,
        option.type === 'number' ? Number(data.get(option.id)) : String(data.get(option.id) ?? ''),
      ])
    );
  };
  const update = async (): Promise<void> => {
    const revision = ++previewRevision;
    const values = fields();
    if (operation.id === 'regex') {
      form.el.querySelector<HTMLElement>('[data-replacement]')!.hidden = values.mode !== 'replace';
      form.el.querySelector('[data-submit]')!.textContent =
        values.mode === 'replace' ? 'Preview replacement' : 'Find matches';
    }
    if (operation.id === 'ascii') {
      const { textAscii } = await import('../../../../../engine/src/text-ascii.ts');
      if (!form.el.isConnected || revision !== previewRevision) return;
      const phrase = form.el.querySelector<HTMLTextAreaElement>('[name="__phrase"]')!.value;
      try {
        form.el.querySelector('[data-live-preview]')!.textContent = phrase
          ? textAscii(phrase, values)
          : 'Your banner will appear here.';
        message.hidden = true;
      } catch (error) {
        message.textContent = error instanceof Error ? error.message : String(error);
        message.hidden = false;
      }
    }
  };
  form.el.addEventListener('input', () => {
    void update();
  });
  form.el.querySelector('[data-close]')!.addEventListener('click', () => {
    if (running) ctx.activeJob?.abort();
    form.close();
  });
  form.el.querySelector('form')!.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (running) return;
    const values = fields();
    ctx.options.set(operation.id, values);
    running = true;
    const submit = form.el.querySelector<HTMLButtonElement>('[data-submit]')!;
    submit.disabled = true;
    submit.textContent = 'Working…';
    message.hidden = true;
    const phrase = form.el.querySelector<HTMLTextAreaElement>('[name="__phrase"]')?.value;
    if (phrase !== undefined) values.__phrase = phrase;
    const ok = await ctx.actions.run(operation, values, phrase);
    running = false;
    if (ok) {
      form.close();
      ctx.root.querySelector<HTMLElement>('[data-result-title]')?.focus({ preventScroll: true });
    } else if (form.el.isConnected) {
      message.textContent =
        ctx.lastError || 'The action could not finish. Check the options and try again.';
      message.hidden = false;
      submit.disabled = false;
      submit.textContent = verb;
    }
  });
  void update();
}
