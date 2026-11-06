// SPDX-License-Identifier: MPL-2.0
import type { InputModelItem, TableValue } from '../../../../engine/src/inputs.ts';
import { parseTableText } from '../../../../engine/src/table-text.ts';
import {
  appendTable,
  shiftTable,
  tableField,
  tableMapping,
  tableMinutes,
  validTableDate,
} from '../../../../engine/src/table-edit.ts';
import { mountDataGrid, type DataGridHandle } from '../components/data-grid.ts';
import { mountModal } from '../components/modal.ts';
import { htmlTableToTsv } from '../lib/table-paste.ts';
import { t } from '../i18n.ts';
import '../styles/parts/table-workbench.css';

interface Options {
  input(): InputModelItem;
  commit(value: TableValue): Promise<void>;
  preview?(id: string, value: string): Promise<void>;
  diagnostics?(): string;
}

/** A shared semantic table editor; all field roles come from the input model. */
export function openTableWorkbench(opts: Options): void {
  const candidate = opts.input().tableEditor;
  if (!candidate) return;
  const spec = candidate;
  let value = structuredClone(opts.input().value) as TableValue;
  const addFields = (): void => {
    for (const field of spec.fields)
      if (!value.columns.some((column) => tableField(column, spec)?.key === field.key)) {
        value.columns.push(field.column ?? field.label);
        value.rows.forEach((row) => {
          row.push('');
        });
      }
  };
  addFields();
  let active = 0,
    activeColumn = 0,
    expanded = false,
    grid: DataGridHandle | undefined;
  const undo: TableValue[] = [],
    redo: TableValue[] = [];
  const modal = mountModal(
    '<header></header><p class="tw-status" role="status"></p><div class="tw-actions"></div><div class="tw-body"><div class="tw-grid"></div><form class="tw-form"></form></div><section class="tw-import" hidden></section>',
    {
      className: 'modal table-workbench',
      ariaLabel: spec.title,
      onClose: () => grid?.destroy(),
    }
  );
  const root = modal.el;
  const header = root.querySelector('header')!;
  const heading = document.createElement('h2');
  heading.textContent = spec.title;
  header.append(heading);
  const status = root.querySelector<HTMLElement>('.tw-status')!;
  const toolbar = root.querySelector<HTMLElement>('.tw-actions')!;
  const gridRoot = root.querySelector<HTMLElement>('.tw-grid')!;
  const form = root.querySelector<HTMLFormElement>('.tw-form')!;
  const importer = root.querySelector<HTMLElement>('.tw-import')!;
  form.addEventListener('submit', (e) => e.preventDefault());
  const say = (message: string) => {
    status.textContent =
      message + (opts.diagnostics?.() ? ' · ' + opts.diagnostics()!.slice(0, 700) : '');
  };
  // Edits run one at a time, in the order they were made. Each reads the table as the
  // edit before it left it, so none is lost. A save takes a while on a long programme,
  // and an edit made meanwhile (Undo just after typing, a second cell) used to be
  // dropped while the grid still showed the typed value.
  let edits: Promise<void> = Promise.resolve();
  const queue = (edit: () => void | Promise<void>): void => {
    edits = edits.then(edit).catch((error: unknown) => {
      say(String((error as Error).message));
    });
  };
  const button = (parent: Element, label: string, action: () => void | Promise<void>): HTMLButtonElement => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn';
    b.textContent = t(label);
    b.addEventListener('click', () => queue(action));
    parent.append(b);
    return b;
  };
  button(header, 'Done', () => modal.close());
  /** Store one edit. Called only from a queued edit, so saves never overlap. */
  const save = async (next: TableValue, remember = true, focusGrid = false): Promise<void> => {
    const gridFocused = focusGrid || gridRoot.contains(document.activeElement);
    try {
      if (remember) {
        undo.push(structuredClone(value));
        redo.length = 0;
      }
      await opts.commit(next);
      value = structuredClone(opts.input().value) as TableValue;
      addFields();
      active = Math.max(0, Math.min(active, value.rows.length - 1));
      renderGrid();
      renderForm();
      if (gridFocused) grid?.focusCell({ row: active, col: activeColumn });
      say(`${value.rows.length} ${t('rows')} · ${value.columns.length} ${t('columns')}`);
    } catch (error) {
      say(String((error as Error).message));
    }
  };
  const indices = () => {
    const order = spec.fields
      .filter((field) => expanded || field.primary)
      .flatMap((field) =>
        value.columns
          .map((column, c) => (tableField(column, spec)?.key === field.key ? c : -1))
          .filter((c) => c >= 0)
      );
    return expanded
      ? [...order, ...value.columns.map((_, c) => c).filter((c) => !order.includes(c))]
      : order.length
        ? order
        : value.columns.map((_, c) => c);
  };
  function renderGrid(): void {
    const cols = indices();
    const projected = {
      columns: cols.map((c) => value.columns[c]!),
      rows: value.rows.map((row) => cols.map((c) => row[c] ?? '')),
    };
    grid?.destroy();
    grid = mountDataGrid(gridRoot, {
      value: projected,
      fixedColumns: true,
      rowHeight: 44,
      columnKinds: cols.map((c) => tableField(value.columns[c]!, spec)?.editor),
      readOnlyCols: cols.flatMap((c, i) =>
        tableField(value.columns[c]!, spec)?.identity ? [i] : []
      ),
      activeCell: { row: active, col: activeColumn },
      onError: say,
      onCellSelect: (row, column) => {
        active = row;
        activeColumn = column;
        renderForm();
      },
      onChange: (next, change) =>
        queue(() => {
          const full = structuredClone(value);
          if (change?.deletedRow !== undefined) full.rows.splice(change.deletedRow, 1);
          next.rows.forEach((row, r) => {
            full.rows[r] ??= full.columns.map(() => '');
            cols.forEach((c, i) => {
              full.rows[r]![c] = row[i] ?? '';
            });
          });
          return save(full, true, true);
        }),
    });
  }
  function renderForm(): void {
    form.replaceChildren();
    const name = document.createElement('h3');
    name.textContent = `${t('Row')} ${active + 1}`;
    form.append(name);
    if (!value.rows[active]) return;
    const nav = document.createElement('div');
    nav.className = 'tw-row-actions';
    form.append(nav);
    button(nav, 'Previous', () => {
      active = Math.max(0, active - 1);
      renderForm();
    });
    button(nav, 'Next', () => {
      active = Math.min(value.rows.length - 1, active + 1);
      renderForm();
    });
    const ordered = [
      ...spec.fields.flatMap((field) =>
        value.columns
          .map((column, c) => (tableField(column, spec)?.key === field.key ? c : -1))
          .filter((c) => c >= 0)
      ),
    ];
    for (const c of [
      ...ordered,
      ...value.columns.map((_, c) => c).filter((c) => !ordered.includes(c)),
    ]) {
      const column = value.columns[c]!;
      const field = tableField(column, spec);
      const label = document.createElement('label');
      label.textContent = field?.label ?? column;
      const control = document.createElement(
        field?.editor === 'text' || !field?.editor ? 'textarea' : 'input'
      );
      control.value = value.rows[active]?.[c] ?? '';
      control.dataset.column = String(c);
      control.readOnly = !!field?.identity;
      if (control instanceof HTMLInputElement) {
        // Text preserves invalid pasted dates/times until the author repairs them.
        control.type =
          field?.editor === 'url'
            ? 'url'
            : field?.editor === 'date' && (!control.value || validTableDate(control.value))
              ? 'date'
              : field?.editor === 'time' &&
                  (!control.value ||
                    (tableMinutes(control.value) !== null && tableMinutes(control.value)! < 1440))
                ? 'time'
                : 'text';
        if (field?.editor === 'date') control.placeholder = 'YYYY-MM-DD';
        if (field?.editor === 'time') {
          control.placeholder = 'HH:MM';
          control.inputMode = 'decimal';
        }
        if (field?.editor === 'choice') {
          const list = document.createElement('datalist');
          list.id = `tw-choice-${c}`;
          for (const word of new Set([
            ...(field.choices ?? []),
            ...value.rows.map((row) => row[c] ?? '').filter(Boolean),
          ])) {
            const option = document.createElement('option');
            option.value = word;
            list.append(option);
          }
          control.setAttribute('list', list.id);
          label.append(list);
        }
      } else control.rows = 2;
      const validate = (): string => {
        if (!control.value.trim()) return field?.required ? t('Required') : '';
        if (field?.editor === 'date' && !validTableDate(control.value))
          return t('Use a real date in YYYY-MM-DD format.');
        if (field?.editor === 'time' && tableMinutes(control.value) === null)
          return t('Use a time in HH:MM format.');
        return '';
      };
      const problem = document.createElement('span');
      problem.className = 'tw-error';
      problem.textContent = validate();
      control.setAttribute('aria-invalid', String(!!problem.textContent));
      control.addEventListener('change', () =>
        queue(async () => {
          const next = structuredClone(value);
          if (!next.rows[active]) return;
          next.rows[active]![c] = control.value;
          await save(next);
          const focus = form.querySelector<HTMLElement>(`[data-column="${c}"]`);
          focus?.focus();
        })
      );
      label.append(control, problem);
      form.append(label);
      if (
        control instanceof HTMLInputElement &&
        control.type === 'text' &&
        ['date', 'time'].includes(field?.editor ?? '')
      ) {
        const picker = document.createElement('input');
        picker.type = field!.editor!;
        picker.setAttribute('aria-label', `${field!.label} ${t('picker')}`);
        if (!validate()) picker.value = control.value;
        picker.addEventListener('change', () => {
          if (picker.value) {
            control.value = picker.value;
            control.dispatchEvent(new Event('change'));
          }
        });
        label.append(picker);
      }
    }
    const actions = document.createElement('div');
    actions.className = 'tw-row-actions';
    form.append(actions);
    button(actions, 'Duplicate', () => {
      const next = structuredClone(value),
        row = [...next.rows[active]!];
      next.columns.forEach((column, c) => {
        if (tableField(column, spec)?.identity) row[c] = '';
      });
      next.rows.splice(++active, 0, row);
      return save(next);
    });
    button(actions, 'Insert above', () => {
      const next = structuredClone(value);
      next.rows.splice(
        active,
        0,
        next.columns.map(() => '')
      );
      return save(next);
    });
    button(actions, 'Insert below', () => {
      const next = structuredClone(value);
      next.rows.splice(
        ++active,
        0,
        next.columns.map(() => '')
      );
      return save(next);
    });
    for (const direction of [-1, 1])
      button(actions, direction < 0 ? 'Move up' : 'Move down', () => {
        const next = structuredClone(value),
          to = active + direction;
        if (to < 0 || to >= next.rows.length) return;
        [next.rows[active], next.rows[to]] = [next.rows[to]!, next.rows[active]!];
        active = to;
        return save(next);
      });
    button(actions, 'Delete row', () => {
      const next = structuredClone(value);
      next.rows.splice(active, 1);
      return save(next);
    });
    if (spec.preview)
      button(actions, 'Preview this time', () => {
        const preview = spec.preview!;
        const get = (field: string) =>
          value.rows[active]?.[
            value.columns.findIndex((column) => tableField(column, spec)?.key === field)
          ] ?? '';
        const date = get(preview.date),
          time = get(preview.time);
        if (!validTableDate(date) || tableMinutes(time) === null) {
          say(t('Fix the date and time before previewing.'));
          return;
        }
        void opts.preview?.(preview.input, `${date}T${time}`).then(() => modal.close());
      });
  }
  button(toolbar, 'Add row', () => {
    const next = structuredClone(value);
    next.rows.push(next.columns.map(() => ''));
    active = next.rows.length - 1;
    return save(next);
  });
  button(toolbar, 'All columns', () => {
    expanded = !expanded;
    renderGrid();
  });
  button(toolbar, 'Undo table edit', () => {
    const previous = undo.pop();
    if (previous) {
      redo.push(structuredClone(value));
      return save(previous, false);
    }
  });
  button(toolbar, 'Redo table edit', () => {
    const next = redo.pop();
    if (next) {
      undo.push(structuredClone(value));
      return save(next, false);
    }
  });
  button(toolbar, 'Sort by date and time', () => {
    const order = spec.fields
      .filter(
        (field) =>
          (field.editor === 'date' && field.primary) || (field.editor === 'time' && field.primary)
      )
      .map((field) =>
        value.columns.findIndex((column) => tableField(column, spec)?.key === field.key)
      )
      .filter((c) => c >= 0);
    const next = structuredClone(value);
    next.rows.sort((a, b) => {
      for (const c of order) {
        const n = (a[c] ?? '').localeCompare(b[c] ?? '');
        if (n) return n;
      }
      return 0;
    });
    return save(next);
  });
  button(toolbar, 'Shift times', () => {
    importer.hidden = false;
    importer.replaceChildren();
    const minutes = document.createElement('input'),
      days = document.createElement('input');
    for (const [control, label] of [
      [minutes, 'Minutes'],
      [days, 'Days'],
    ] as const) {
      const l = document.createElement('label');
      l.textContent = t(label);
      control.type = 'number';
      control.value = '0';
      control.step = '1';
      l.append(control);
      importer.append(l);
    }
    const all = document.createElement('input');
    all.type = 'checkbox';
    all.checked = true;
    const label = document.createElement('label');
    label.append(all, t('All rows'));
    importer.append(label);
    button(importer, 'Apply shift', () => {
      try {
        const next = shiftTable(
          value,
          spec,
          Number(minutes.value),
          Number(days.value),
          all.checked ? undefined : active
        );
        importer.hidden = true;
        return save(next);
      } catch (error) {
        say((error as Error).message);
      }
    });
    button(importer, 'Cancel', () => {
      importer.hidden = true;
    });
  });
  button(toolbar, 'Import programme', () => {
    importer.hidden = false;
    importer.replaceChildren();
    const source = document.createElement('textarea');
    source.rows = 5;
    source.setAttribute('aria-label', t('Paste spreadsheet data'));
    importer.append(source);
    source.addEventListener('paste', (e) => {
      const text = htmlTableToTsv(e.clipboardData?.getData('text/html') ?? '');
      if (text) {
        e.preventDefault();
        source.value = text;
      }
    });
    const file = document.createElement('input');
    file.type = 'file';
    file.accept = '.csv,.tsv,.txt';
    file.setAttribute('aria-label', t('Import CSV or TSV'));
    file.addEventListener('change', () => {
      const f = file.files?.[0];
      if (f && f.size <= 5_000_000)
        void f.text().then((text) => {
          source.value = text;
        });
      else say(t('Choose a CSV or TSV file under 5 MB.'));
    });
    importer.append(file);
    const preview = document.createElement('div');
    importer.append(preview);
    button(importer, 'Review import', () => {
      preview.replaceChildren();
      const parsed = parseTableText(source.value);
      if (!parsed?.columns.length || parsed.rows.length > 10000) {
        say(t('Use a table with headings and at most 10,000 rows.'));
        return;
      }
      const map = tableMapping(parsed, spec);
      const summary = document.createElement('p');
      summary.textContent = `${parsed.rows.length} ${t('rows')} · ${map.issues.join('; ')}`;
      preview.append(summary);
      const selects = parsed.columns.map((column, c) => {
        const label = document.createElement('label');
        label.textContent = column;
        const select = document.createElement('select');
        for (const name of new Set([
          column,
          ...spec.fields.map((field) => field.column ?? field.label),
        ])) {
          const option = document.createElement('option');
          option.value = name;
          option.textContent = name;
          select.append(option);
        }
        select.value = map.columns[c]!;
        label.append(select);
        preview.append(label);
        return select;
      });
      const sample = document.createElement('pre');
      sample.textContent = parsed.rows
        .slice(0, 5)
        .map((row) => row.join(' | '))
        .join('\n');
      preview.append(sample);
      const apply = (append: boolean) => {
        const incoming = { columns: selects.map((select) => select.value), rows: parsed.rows };
        const mapped = tableMapping(incoming, spec);
        if (mapped.issues.length) {
          say(mapped.issues.join('; '));
          return;
        }
        incoming.columns = mapped.columns;
        importer.hidden = true;
        return save(append ? appendTable(value, incoming) : incoming);
      };
      button(preview, 'Add sessions', () => apply(true));
      button(preview, 'Replace programme', () => apply(false));
    });
    button(importer, 'Cancel', () => {
      importer.hidden = true;
    });
    source.focus();
  });
  renderGrid();
  renderForm();
  say(`${value.rows.length} ${t('rows')}`);
}
