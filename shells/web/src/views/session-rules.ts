// SPDX-License-Identifier: MPL-2.0
/** Author public controls over a captured tool session. */
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { matchesShowIf } from '@lolly/engine';
import type { Runtime } from '../../../../engine/src/runtime.ts';
import type { LoadedTool } from '../../../../engine/src/loader.ts';
import type { DesignInputV1 } from '@lolly-tools/core/design-tool-v1';
import { getDesignToolDraft, setDesignToolDraft } from '../lib/design-tool-draft.ts';
import {
  sessionField,
  sessionInputReason,
  newSessionToolDraft,
} from '../lib/session-tool-draft.ts';
import { prepareSessionTool, sessionToolRights } from '../lib/session-tool-compile.ts';
import { registerRulesEditor, takeRulesRequest, openRegisteredRules } from '../lib/rules-launch.ts';
import { createRulesShare } from './design-rules-share.ts';
import { tryDesignToolFile } from './design-rules-trial.ts';
import { buildLollyFile } from '../lib/lolly-pack.ts';
import { mountModal } from '../components/modal.ts';
import { wireReorderList } from '../components/reorder-list.ts';
import { icon } from '../lib/icons.ts';
import { tRaw as t } from '../i18n.ts';
import '../styles/parts/design-rules.css';

export function openSessionRules(opts: {
  tool: LoadedTool;
  runtime: Runtime;
  host: HostV1;
  canvas: HTMLElement;
  name: string;
  size: { width: number; height: number };
  saveMaster(): void;
  autoOpen?: boolean;
  inputId?: string;
}): () => void {
  const saved = getDesignToolDraft(opts.runtime);
  let draft = saved?.sourceTool
    ? structuredClone(saved)
    : newSessionToolDraft(opts.tool.manifest, opts.name, opts.size);
  const fields = opts.tool.manifest.inputs.map((input, index) => ({
    source: input,
    field: sessionField(input, opts.runtime.getModel().find((i) => i.id === input.id)!, index),
  }));
  const syncFields = (): void => {
    for (const entry of fields) {
      const existing = draft.inputs.find(
        (f) => draft.sourceTool!.inputs[f.input.id] === entry.source.id
      );
      if (existing) entry.field = existing;
    }
    fields.sort((a, b) => {
      const at = draft.inputs.indexOf(a.field),
        bt = draft.inputs.indexOf(b.field);
      return (at < 0 ? 1000 : at) - (bt < 0 ? 1000 : bt);
    });
  };
  syncFields();
  if (opts.inputId) {
    const entry = fields.find(entry => entry.source.id === opts.inputId);
    if (entry && !sessionInputReason(entry.source) && !draft.inputs.includes(entry.field)) {
      draft.inputs.push(entry.field); draft.sourceTool!.inputs[entry.field.input.id] = entry.source.id;
    }
  }
  let modal: ReturnType<typeof mountModal> | undefined;
  let stopOrder: (() => void) | undefined;
  let stopped = false;
  const save = (): void => {
    setDesignToolDraft(opts.runtime, draft);
  };
  const sharing = createRulesShare({
    runtime: opts.runtime,
    host: opts.host,
    canvas: opts.canvas,
    draft: () => draft,
    checkSource() {},
    commit(next) {
      draft = next;
      syncFields();
      save();
    },
    status(message) {
      const status = modal?.el.querySelector('[role="status"]');
      if (status) status.textContent = message;
    },
    saveMaster: opts.saveMaster,
    rights: () => sessionToolRights(opts.runtime),
    prepare: (candidate, options) =>
      prepareSessionTool(candidate, opts.tool, opts.runtime, opts.canvas, opts.host, options),
    repair() {
      open();
    },
  });
  function open(): void {
    if (stopped || modal?.el.isConnected) return;
    modal = mountModal('', {
      className: 'modal sr-dialog',
      ariaLabel: t('Share with rules'),
      onClose() {
        stopOrder?.();
      },
    });
    const heading = document.createElement('h2');
    heading.textContent = t('Share with rules');
    const note = document.createElement('p');
    note.className = 'sr-help';
    note.textContent = t(
      'Select the inputs people can edit. The other settings stay fixed. Drag to arrange the controls.'
    );
    const setup = document.createElement('div');
    setup.className = 'dr-pair';
    setup.append(
      textControl('Tool name', draft.name, (value) => {
        draft.name = value;
        save();
      })
    );
    const placement = document.createElement('select');
    placement.className = 'field-select';
    for (const [value, label] of [
      ['sidebar', 'Sidebar'],
      ['on-canvas', 'Edit inputs button'],
    ] as const) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = t(label);
      placement.append(option);
    }
    placement.value = draft.presentation;
    placement.onchange = () => {
      draft.presentation = placement.value as typeof draft.presentation;
      save();
    };
    setup.append(labelControl('Input placement', placement));
    const search = document.createElement('input');
    search.className = 'field-input';
    search.type = 'search';
    search.placeholder = t('Find an input');
    search.setAttribute('aria-label', t('Find an input'));
    const showAll = document.createElement('input');
    showAll.type = 'checkbox';
    const allLabel = document.createElement('label');
    allLabel.className = 'dr-check sr-help';
    allLabel.append(showAll, document.createTextNode(t('Show settings for other content types')));
    const selectedOnly = document.createElement('input'); selectedOnly.type = 'checkbox'; selectedOnly.checked = !!opts.inputId;
    const selectedLabel = document.createElement('label'); selectedLabel.className = 'dr-check sr-help'; selectedLabel.append(selectedOnly, document.createTextNode(t('Show editable inputs only')));
    const sourceValues = Object.fromEntries(opts.runtime.getModel().map((i) => [i.id, i.value]));
    let visibleFields = fields;
    const list = document.createElement('div');
    list.className = 'sr-inputs';
    const status = document.createElement('p');
    status.className = 'sr-help';
    status.setAttribute('role', 'status');
    const selected = (field: DesignInputV1): boolean =>
      draft.inputs.some((f) => f.input.id === field.input.id);
    const order = (): void => {
      draft.inputs.sort(
        (a, b) =>
          fields.findIndex((e) => e.field.input.id === a.input.id) -
          fields.findIndex((e) => e.field.input.id === b.input.id)
      );
      save();
    };
    const update = (): void => {
      status.textContent = t('{n} editable inputs. Unselected settings stay fixed.', {
        n: draft.inputs.length,
      });
    };
    const paint = (): void => {
      list.replaceChildren();
      const query = search.value.trim().toLocaleLowerCase();
      visibleFields = fields.filter(
        ({ source, field }) =>
          (!selectedOnly.checked || selected(field)) &&
          (showAll.checked ||
            !!query ||
            selected(field) ||
            matchesShowIf(source.showIf, sourceValues)) &&
          (!query ||
            `${source.id} ${source.label} ${field.input.label}`.toLocaleLowerCase().includes(query))
      );
      for (const { source, field } of visibleFields) {
        const row = document.createElement('details');
        row.className = 'dr-input';
        row.dataset.reorderRow = '';
        row.open = source.id === opts.inputId;
        row.dataset.search =
          `${source.id} ${source.label} ${field.input.label}`.toLocaleLowerCase();
        const summary = document.createElement('summary');
        const handle = document.createElement('button');
        handle.type = 'button';
        handle.className = 'btn btn--ghost dr-grab';
        handle.disabled = !!query;
        handle.dataset.reorderHandle = '';
        handle.setAttribute('aria-pressed', 'false');
        handle.setAttribute('aria-label', t('Reorder {name}', { name: String(field.input.label) }));
        handle.title = t('Drag, or press Space then use the arrow keys');
        // The icon comes only from the shared static registry.
        handle.append(
          new DOMParser().parseFromString(icon('grip', { filled: true, size: 16 }), 'image/svg+xml')
            .documentElement
        );
        const label = document.createElement('label');
        label.className = 'dr-check sr-select';
        const check = document.createElement('input');
        check.type = 'checkbox';
        check.dataset.sourceInput = source.id;
        check.checked = selected(field);
        const reason = sessionInputReason(source);
        check.disabled = !!reason;
        const text = document.createElement('span');
        text.textContent = String(field.input.label);
        label.append(check, text);
        const state = document.createElement('span');
        state.className = 'sr-state';
        const disclosure = document.createElement('span');
        disclosure.className = 'sr-disclosure';
        disclosure.textContent = t('Settings');
        summary.append(handle, label, state, disclosure);
        row.append(summary);
        label.onclick = (event) => event.stopPropagation();
        handle.onclick = (event) => {
          event.preventDefault();
          event.stopPropagation();
        };
        const body = document.createElement('div');
        body.className = 'sr-input-body';
        const value = document.createElement('p');
        value.className = 'sr-value';
        value.textContent =
          reason ||
          t('Current value: {value}', {
            value:
              typeof field.input.default === 'object'
                ? t('Included artwork or content')
                : String(field.input.default ?? ''),
          });
        body.append(value);
        const settings = document.createElement('fieldset');
        settings.className = 'sr-settings';
        const refreshRow = (): void => {
          state.textContent = t(check.checked ? 'Editable' : 'Fixed');
          row.classList.toggle('is-editable', check.checked);
          settings.disabled = !check.checked || !!reason;
        };
        check.onchange = () => {
          if (check.checked) {
            draft.inputs.push(field);
            draft.sourceTool!.inputs[field.input.id] = source.id;
          } else {
            draft.inputs = draft.inputs.filter((f) => f.input.id !== field.input.id);
            delete draft.sourceTool!.inputs[field.input.id];
          }
          order();
          refreshRow();
          update();
        };
        if (!reason) {
          settings.append(
            textControl('Input label', String(field.input.label), (value) => {
              field.input.label = value;
              text.textContent = value;
              save();
            })
          );
          const placement = document.createElement('select'); placement.className = 'field-select';
          for (const [value, title] of [['', 'Main inputs'], ['More options', 'More options']]) { const option = document.createElement('option'); option.value = value!; option.textContent = t(title!); placement.append(option); }
          placement.value = field.input.section || ''; placement.onchange = () => { field.input.section = placement.value || undefined; save(); };
          settings.append(labelControl('Placement', placement));
          if (['text', 'longtext', 'url'].includes(source.type))
            settings.append(
              textControl(
                'Maximum characters',
                String(field.input.maxLength),
                (value) => {
                  field.input.maxLength = Number(value);
                  save();
                },
                'number'
              )
            );
          if (source.type === 'number')
            for (const [key, title] of [
              ['min', 'Minimum'],
              ['max', 'Maximum'],
              ['step', 'Step'],
            ] as const) {
              settings.append(
                textControl(
                  title,
                  String(field.input[key]),
                  (value) => {
                    field.input[key] = Number(value);
                    save();
                  },
                  'number'
                )
              );
            }
          if (source.type === 'select') {
            const title = document.createElement('legend');
            title.textContent = t('Allowed options');
            const choices = document.createElement('fieldset');
            choices.className = 'sr-choices';
            choices.append(title);
            const error = document.createElement('p'); error.className = 'dr-field-error'; error.setAttribute('role', 'status');
            const starting = document.createElement('select'); starting.className = 'field-select';
            const refreshChoices = (): void => {
              starting.replaceChildren();
              for (const option of field.input.options || []) { const el = document.createElement('option'); el.value = option.value; el.textContent = option.label || option.value; starting.append(el); }
              starting.value = String(field.input.default || '');
              error.textContent = field.input.options?.length ? '' : t('Choose at least one allowed option.');
            };
            starting.onchange = () => { field.input.default = starting.value; save(); };
            for (const option of source.options || []) {
              const optionLabel = document.createElement('label');
              optionLabel.className = 'dr-check';
              const allowed = document.createElement('input');
              allowed.type = 'checkbox';
              allowed.checked = field.input.options!.some((o) => o.value === option.value);
              allowed.onchange = () => {
                field.input.options = allowed.checked
                  ? [...field.input.options!, option]
                  : field.input.options!.filter((o) => o.value !== option.value);
                if (!field.input.options.some((o) => o.value === field.input.default))
                  field.input.default = field.input.options[0]?.value || '';
                save();
                refreshChoices();
              };
              optionLabel.append(allowed, document.createTextNode(option.label || option.value));
              choices.append(optionLabel);
            }
            refreshChoices(); settings.append(choices, labelControl('Default choice', starting), error);
          }
        }
        refreshRow();
        body.append(settings);
        row.append(body);
        list.append(row);
      }
    };
    search.oninput = paint;
    showAll.onchange = paint;
    selectedOnly.onchange = paint;
    const footer = document.createElement('footer');
    const action = (label: string, run: () => void, primary = false): HTMLButtonElement => {
      const button = document.createElement('button');
      button.className = primary ? 'btn btn--primary' : 'btn';
      button.textContent = t(label);
      button.onclick = run;
      footer.append(button);
      return button;
    };
    action('Close', () => modal?.close());
    action('Save draft', () => {
      save();
      modal?.close();
      opts.saveMaster();
    });
    const preview = action('Preview', () => {
      void (async () => {
        preview.disabled = true;
        save();
        try {
          const compiled = await prepareSessionTool(
            draft,
            opts.tool,
            opts.runtime,
            opts.canvas,
            opts.host
          );
          const files = Object.fromEntries(
            Object.entries(compiled.files).map(([path, value]) => [
              path,
              typeof value === 'string' ? new TextEncoder().encode(value) : value,
            ])
          );
          const result = await buildLollyFile({
            kind: 'tool',
            session: null,
            toolId: draft.id,
            toolVersion: draft.version,
            name: draft.name,
            userAssets: [],
            tool: { id: draft.id, version: draft.version, trust: 'custom', files },
          });
          if (!modal?.el.isConnected || stopped) return;
          await tryDesignToolFile(new File([result.blob], result.filename), opts.host);
        } catch (error) {
          status.textContent = (error as Error).message;
        } finally {
          preview.disabled = false;
        }
      })();
    });
    action(
      'Share .lolly',
      () => {
        save();
        modal?.close();
        sharing.open();
      },
      true
    );
    modal.el.append(heading, note, setup, search, selectedLabel, allLabel, list, status, footer);
    paint();
    update();
    stopOrder = wireReorderList(
      list,
      (from, to) => {
        const a = fields.indexOf(visibleFields[from]!),
          b = fields.indexOf(visibleFields[to]!);
        fields.splice(b, 0, fields.splice(a, 1)[0]!);
        order();
        paint();
      },
      (message) => {
        status.textContent = message;
      }
    );
  }
  const unregister = registerRulesEditor(opts.runtime, open);
  if (opts.autoOpen !== false) open();
  return () => {
    stopped = true;
    unregister();
    modal?.close();
    sharing.destroy();
  };
}

function labelControl(title: string, input: HTMLElement): HTMLLabelElement {
  const label = document.createElement('label');
  label.className = 'dr-field';
  label.textContent = t(title);
  label.append(input);
  return label;
}
function textControl(
  title: string,
  value: string,
  change: (value: string) => void,
  type = 'text'
): HTMLLabelElement {
  const input = document.createElement('input');
  input.className = 'field-input';
  input.type = type;
  input.value = value;
  input.onchange = () => change(input.value);
  return labelControl(title, input);
}


/** Design registers its editor asynchronously; a request waits for that exact runtime. */
export async function openPendingRules(opts: {
  tool: LoadedTool; runtime: Runtime; host: HostV1; canvas: HTMLElement;
  size: {width:number;height:number}; saveMaster():void;
}): Promise<(() => void) | undefined> {
  const request=takeRulesRequest(opts.tool.manifest.id);
  const draft=getDesignToolDraft(opts.runtime);
  if(!request&&!draft?.sourceTool)return;
  const name=request?.name||draft!.name;
  if(opts.tool.manifest.id==='design'){openRegisteredRules(opts.runtime,name);return;}
  return openSessionRules({...opts,name,autoOpen:!!request,inputId:request?.inputId});
}
