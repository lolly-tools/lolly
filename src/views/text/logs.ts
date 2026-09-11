// SPDX-License-Identifier: MPL-2.0
import {
  filterTextLogs,
  groupTextLogs,
  type TextLogEvent,
} from '../../../../../engine/src/text-logs.ts';
import { mountDataGrid } from '../../components/data-grid.ts';
import { mountModal } from '../../components/modal.ts';
import { icon } from '../../lib/icons.ts';
import { escapeHtml as esc } from '../../lib/html.ts';
import { query, type TextContext } from './context.ts';
export function mountLogResults(ctx: TextContext, container: HTMLElement): void {
  const result = ctx.result!;
  const details = result.value.details!;
  const events = details.events as TextLogEvent[];
  const sources = details.sources as string[];
  const abort = new AbortController();
  const offset = ctx.editor.document.value.text.slice(0, result.start).split('\n').length - 1;
  details.sourceLineOffset = offset;
  container.innerHTML = `<div class="text-log-filters"><label class="text-search-field">${icon('search', { className: 'text-icon' })}<input type="search" data-log-search aria-label="Search log events" placeholder="Search log events"></label><label>Level <select data-log-level><option value="all">All events</option><option value="important">Errors and warnings</option>${[...new Set(events.map((e) => e.severity))].map((level) => `<option value="${esc(level)}">${esc(level[0]!.toUpperCase() + level.slice(1))}</option>`).join('')}</select></label>${sources.length ? `<label>Source <select data-log-source><option value="">All sources</option>${sources.map((source) => `<option>${esc(source)}</option>`).join('')}</select></label>` : ''}<button class="btn btn--ghost" data-log-reset>${icon('refresh', { className: 'text-icon' })}Reset</button></div>
    <details class="text-advanced"><summary>Time range and exact search</summary><div class="text-row"><label>From <input type="datetime-local" data-log-from></label><label>Until <input type="datetime-local" data-log-until></label><label><input type="checkbox" data-log-exact> Match the complete message</label></div><p class="text-muted">Time filtering needs a complete date in the original log.</p></details>
    <p data-log-count role="status" class="text-muted"></p><p data-log-error role="alert" class="text-form-error" hidden></p><div class="text-log-layout"><div><div class="text-log-grid" data-log-grid aria-label="Log events; select a row to inspect"></div><div data-log-empty class="text-empty-state" hidden><p>No events match these filters.</p><button class="btn btn--ghost" data-log-clear>Show all events</button></div></div><aside class="text-log-detail"><h3>Event details</h3><p data-log-position class="text-muted"></p><pre data-log-detail></pre><button class="btn btn--ghost" data-copy-event>${icon('duplicate', { className: 'text-icon' })}Copy event</button></aside></div>`;
  const q = <T extends HTMLElement>(selector: string): T => container.querySelector<T>(selector)!;
  let shown: TextLogEvent[][] = [],
    current: TextLogEvent[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  const detailText = (group: TextLogEvent[]): string =>
    group
      .map(
        (event) =>
          event.raw +
          (Object.keys(event.fields).length
            ? '\nFields\n' + JSON.stringify(event.fields, null, 2)
            : '')
      )
      .join('\n');
  const copy = async (group: TextLogEvent[]): Promise<boolean> => {
    try {
      await ctx.host.clipboard.writeText(group.map((event) => event.raw).join(''));
      ctx.status('Copied the selected event.');
      return true;
    } catch {
      ctx.status('Clipboard unavailable. Select and copy the event text.');
      return false;
    }
  };
  const show = (row: number, open = true): void => {
    current = shown[row] ?? [];
    const first = current[0],
      last = current.at(-1);
    const position = first
      ? `Lines ${first.line + offset}-${last!.lastLine + offset}${current.length > 1 ? ` · ${current.length} occurrences` : ''}`
      : 'Select an event to see its original lines.';
    q('[data-log-position]').textContent = position;
    q('[data-log-detail]').textContent = detailText(current);
    q<HTMLButtonElement>('[data-copy-event]').disabled = !first;
    if (open && first && matchMedia('(max-width: 760px)').matches) {
      const group = [...current];
      const modal = mountModal(
        `<h2>Event details</h2><p class="text-muted">${esc(position)}</p><pre class="text-event-source">${esc(detailText(group))}</pre><footer class="text-dialog-footer"><button class="btn btn--ghost" data-close>Close</button><button class="btn btn--primary" data-copy>${icon('duplicate', { className: 'text-icon' })}Copy event</button></footer>`,
        { className: 'modal text-action-dialog', ariaLabel: 'Log event details' }
      );
      modal.el.querySelector('[data-close]')!.addEventListener('click', () => modal.close());
      modal.el.querySelector('[data-copy]')!.addEventListener('click', async () => {
        const copied = await copy(group);
        modal.el.querySelector('[data-copy]')!.textContent = copied ? 'Copied' : 'Copy unavailable';
      });
    }
  };
  const grid = mountDataGrid(q('[data-log-grid]'), {
    editable: false,
    rowHeight: 40,
    growColumn: 1,
    onRowActivate: show,
    value: { columns: [], rows: [] },
  });
  const filter = (): void => {
    try {
      const visible = filterTextLogs(events, {
        query: q<HTMLInputElement>('[data-log-search]').value,
        severity: q<HTMLSelectElement>('[data-log-level]').value,
        source: container.querySelector<HTMLSelectElement>('[data-log-source]')?.value,
        from: q<HTMLInputElement>('[data-log-from]').value,
        until: q<HTMLInputElement>('[data-log-until]').value,
        exact: q<HTMLInputElement>('[data-log-exact]').checked,
      });
      shown = groupTextLogs(visible);
      details.visible = visible;
      details.groups = shown;
      result.value.text = visible.map((event) => event.raw).join('');
      grid.setValue({
        columns: ['Level', 'Message', 'Time', 'Count'],
        rows: shown.map((group) => {
          const e = group[0]!;
          return [e.severity, e.message.split('\n')[0]!, e.timestamp, String(group.length)];
        }),
      });
      q('[data-log-count]').textContent =
        `${visible.length} of ${events.length} events · ${shown.length} rows. Select a row for the original text.`;
      query(ctx, '[data-result-notes]').textContent =
        'Copy and save include the filtered events, with their original lines.';
      q('[data-log-error]').hidden = true;
      q('[data-log-empty]').hidden = visible.length > 0;
      q('[data-log-grid]').hidden = !visible.length;
      show(0, false);
    } catch (error) {
      q('[data-log-error]').textContent = error instanceof Error ? error.message : String(error);
      q('[data-log-error]').hidden = false;
    }
  };
  const reset = (): void => {
    container.querySelectorAll<HTMLInputElement>('input').forEach((input) => {
      input.value = '';
      input.checked = false;
    });
    q<HTMLSelectElement>('[data-log-level]').value = 'all';
    const source = container.querySelector<HTMLSelectElement>('[data-log-source]');
    if (source) source.value = '';
    filter();
  };
  container.addEventListener(
    'input',
    () => {
      clearTimeout(timer);
      timer = setTimeout(filter, 120);
    },
    { signal: abort.signal }
  );
  container.addEventListener('change', filter, { signal: abort.signal });
  q('[data-log-reset]').addEventListener('click', reset, { signal: abort.signal });
  q('[data-log-clear]').addEventListener('click', reset, { signal: abort.signal });
  q('[data-copy-event]').addEventListener(
    'click',
    () => {
      void copy(current);
    },
    { signal: abort.signal }
  );
  filter();
  ctx.resultCleanup = () => {
    abort.abort();
    clearTimeout(timer);
    grid.destroy();
  };
}
