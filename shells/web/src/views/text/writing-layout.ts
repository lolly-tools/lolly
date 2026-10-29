// SPDX-License-Identifier: MPL-2.0
/** Write's resizable panes, reading measure, active line and fullscreen workspace. */
import { mountSplitter } from '../../lib/splitter.ts';
import type { TextContext } from './context.ts';
import './writing-layout.css';

export interface WriterLayout { refresh(): void }

export function mountWriterLayout(ctx: TextContext): WriterLayout {
  const { root, editor, abort } = ctx;
  const area = root.querySelector<HTMLElement>('.text-work-area')!;
  const pane = root.querySelector<HTMLElement>('.write-pane')!;
  const canvas = root.querySelector<HTMLElement>('[data-editor]')!;
  const measure = root.querySelector<HTMLSelectElement>('[data-write-measure]')!;
  const columns = root.querySelector<HTMLInputElement>('[data-write-columns]')!;
  const focus = root.querySelector<HTMLInputElement>('[data-write-line-focus]')!;
  const grip = document.createElement('div');
  grip.className = 'write-splitter resize-grip';
  pane.before(grip);
  let fraction = 0.5;
  const available = (): number => Math.max(0, area.clientWidth - grip.offsetWidth);
  const splitter = mountSplitter({
    grip, controls: pane, panel: 'end', label: 'Resize writing panes',
    hint: 'Drag or use arrow keys to resize. Double-click or press Enter to reset.',
    value: () => available() * (1 - fraction),
    limits: () => ({ min: available() * 0.25, max: available() * 0.75, initial: available() * 0.5 }),
    set(px) {
      if (available() > 0) fraction = 1 - px / available();
      area.style.setProperty('--write-source-share', String(fraction));
      area.style.setProperty('--write-preview-share', String(1 - fraction));
      return available() * (1 - fraction);
    },
  });
  const ink = document.createElement('pre');
  ink.className = 'write-line-ink';
  ink.setAttribute('aria-hidden', 'true');
  ink.hidden = true;
  canvas.insertBefore(ink, editor.input);
  const mirror = document.createElement('div');
  mirror.className = 'write-line-mirror';
  mirror.setAttribute('aria-hidden', 'true');
  canvas.append(mirror);
  const marker = document.createElement('span');
  let frame = 0, lastText: string | undefined;
  const paint = (): void => {
    frame = 0;
    canvas.style.setProperty('--write-scrollbar-width', `${editor.input.offsetWidth - editor.input.clientWidth}px`);
    canvas.style.setProperty('--write-scrollbar-height', `${editor.input.offsetHeight - editor.input.clientHeight}px`);
    canvas.classList.toggle('write-line-focus', focus.checked);
    ink.hidden = !focus.checked;
    if (!focus.checked || abort.signal.aborted) return;
    const input = editor.input;
    const style = getComputedStyle(input);
    Object.assign(mirror.style, {
      width: `${input.clientWidth}px`, font: style.font, lineHeight: style.lineHeight,
      padding: style.padding, boxSizing: 'border-box', letterSpacing: style.letterSpacing,
      tabSize: style.tabSize, whiteSpace: input.wrap === 'off' ? 'pre' : 'pre-wrap',
      overflowWrap: style.overflowWrap, wordBreak: style.wordBreak,
    });
    const position = input.selectionDirection === 'backward' ? input.selectionStart : input.selectionEnd;
    mirror.replaceChildren(document.createTextNode(input.value.slice(0, position)), marker);
    marker.textContent = input.value.slice(position) || '.';
    const height = Number.parseFloat(style.lineHeight);
    const leading = Math.max(0, (height - (marker.getClientRects()[0]?.height ?? height)) / 2);
    const top = marker.offsetTop - leading - input.scrollTop;
    canvas.style.setProperty('--write-line-y', `${top}px`);
    canvas.style.setProperty('--write-line-height', `${height}px`);
    canvas.dataset.activeLine = String(input.value.slice(0, position).split('\n').length);
    ink.hidden = top + height < 0 || top >= input.clientHeight;
    if (lastText !== input.value) { lastText = input.value; ink.textContent = input.value + '\n'; }
    ink.scrollTop = input.scrollTop;
    ink.scrollLeft = input.scrollLeft;
  };
  const refresh = (): void => { if (!frame && !abort.signal.aborted) frame = requestAnimationFrame(paint); };
  const setMeasure = (): void => {
    const value = measure.value;
    const width = value === 'custom' ? Number(columns.value) : Number(value);
    const count = Math.max(30, Math.min(200, Number.isFinite(width) ? width : 72));
    if (value === 'custom') columns.value = String(Math.round(count));
    root.querySelector<HTMLElement>('[data-write-custom]')!.hidden = value !== 'custom';
    root.style.setProperty('--write-measure', value === 'full' || value === 'nowrap' ? '100%' : `${Math.round(count)}ch`);
    root.dataset.wrapManual = 'true';
    const wrap = value !== 'nowrap';
    root.querySelector<HTMLInputElement>('[data-wrap]')!.checked = wrap;
    editor.wrap(wrap);
    refresh();
  };
  measure.addEventListener('change', setMeasure, { signal: abort.signal });
  columns.addEventListener('change', setMeasure, { signal: abort.signal });
  focus.addEventListener('change', refresh, { signal: abort.signal });
  for (const event of ['input', 'select', 'keyup', 'pointerup', 'scroll']) editor.input.addEventListener(event, refresh, { signal: abort.signal });
  const resize = new ResizeObserver(() => { splitter.sync(); refresh(); });
  resize.observe(canvas);
  resize.observe(area);

  const bar = document.createElement('header');
  bar.className = 'write-fullscreen-bar';
  bar.hidden = true;
  bar.innerHTML = '<span class="text-muted">Write <span aria-hidden="true">·</span> Esc to leave fullscreen</span><button type="button" class="btn btn--ghost" data-write-exit>Exit fullscreen</button>';
  root.prepend(bar);
  const fullButton = root.querySelector<HTMLButtonElement>('[data-write-fullscreen]')!;
  const placeholder = document.createComment('Write workspace position');
  let active = false, hadFullscreen = false;
  const leave = (exitNative = true): void => {
    active = false;
    hadFullscreen = false;
    if (exitNative && document.fullscreenElement === root) void document.exitFullscreen().catch(() => {});
    root.classList.remove('write-distraction');
    bar.hidden = true;
    fullButton.setAttribute('aria-pressed', 'false');
    if (placeholder.parentNode) placeholder.replaceWith(root);
    if (!abort.signal.aborted) { editor.input.focus({ preventScroll: true }); refresh(); }
  };
  const enter = (): void => {
    if (active) return;
    active = true;
    root.before(placeholder);
    document.body.append(root);
    root.classList.add('write-distraction');
    bar.hidden = false;
    fullButton.setAttribute('aria-pressed', 'true');
    // Keep the writing view available when the browser declines native fullscreen.
    void root.requestFullscreen?.().catch(() => {});
    editor.input.focus({ preventScroll: true });
    refresh();
  };
  fullButton.addEventListener('click', enter, { signal: abort.signal });
  bar.querySelector('button')!.addEventListener('click', () => leave(), { signal: abort.signal });
  root.addEventListener('keydown', event => {
    if (active && event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); leave(); }
    else if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === 'Enter') {
      event.preventDefault(); event.stopImmediatePropagation();
      if (active) leave(); else enter();
    }
  }, { capture: true, signal: abort.signal });
  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement === root) {
      hadFullscreen = true;
      if (!active) void document.exitFullscreen().catch(() => {});
    } else if (active && hadFullscreen) leave(false);
  }, { signal: abort.signal });
  abort.signal.addEventListener('abort', () => {
    cancelAnimationFrame(frame);
    resize.disconnect(); splitter.dispose();
    leave();
    placeholder.remove();
  }, { once: true });
  setMeasure();
  return { refresh };
}
