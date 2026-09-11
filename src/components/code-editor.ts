// SPDX-License-Identifier: MPL-2.0
import { highlightCode } from '../../../../engine/src/text-syntax.ts';
import {
  TextDocument,
  sourceOffset,
  displayOffset,
  textFromInput,
  type TextSelection,
} from '../../../../engine/src/text-document.ts';
import './code-editor.css';
export interface CodeEditor {
  input: HTMLTextAreaElement;
  document: TextDocument;
  language(value: string): void;
  setText(text: string): void;
  loadText(text: string): void;
  wrap(enabled: boolean): void;
  replace(text: string, selection?: TextSelection, revision?: number): boolean;
  undo(): void;
  redo(): void;
  destroy(): void;
}
/** Accessible textarea with a decorative syntax layer. Source text stays exact. */
export function mountCodeEditor(
  container: HTMLElement,
  options: {
    text?: string;
    language?: string;
    label: string;
    placeholder?: string;
    wrap?: boolean;
    onChange?: (text: string) => void;
    onSelect?: () => void;
  }
): CodeEditor {
  const abort = new AbortController();
  const documentModel = new TextDocument(options.text);
  container.classList.add('code-editor');
  const pre = document.createElement('pre');
  pre.setAttribute('aria-hidden', 'true');
  const input = document.createElement('textarea');
  input.setAttribute('aria-label', options.label);
  input.autocapitalize = 'off';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.wrap = options.wrap ? 'soft' : 'off';
  input.placeholder = options.placeholder ?? '';
  container.classList.toggle('code-editor--wrap', !!options.wrap);
  container.replaceChildren(pre, input);
  let language = options.language ?? 'auto',
    frame = 0,
    composing = false;
  const paint = (): void => {
    frame = 0;
    pre.innerHTML = highlightCode(input.value, language).html + '\n';
    pre.scrollTop = input.scrollTop;
    pre.scrollLeft = input.scrollLeft;
  };
  const repaint = (): void => {
    if (!frame) frame = requestAnimationFrame(paint);
  };
  const selection = (): void => {
    documentModel.select(
      sourceOffset(documentModel.value.text, input.selectionStart),
      sourceOffset(documentModel.value.text, input.selectionEnd),
      input.scrollTop
    );
    options.onSelect?.();
  };
  const render = (): void => {
    input.value = documentModel.value.text;
    input.setSelectionRange(
      displayOffset(documentModel.value.text, documentModel.value.start),
      displayOffset(documentModel.value.text, documentModel.value.end)
    );
    input.scrollTop = documentModel.value.scroll;
    paint();
    options.onChange?.(documentModel.value.text);
    options.onSelect?.();
  };
  const listen = (event: string, fn: EventListener): void =>
    input.addEventListener(event, fn, { signal: abort.signal });
  listen('beforeinput', (event) => {
    const e = event as InputEvent;
    if (e.inputType === 'historyUndo' || e.inputType === 'historyRedo') {
      e.preventDefault();
      if (e.inputType === 'historyUndo') api.undo();
      else api.redo();
    } else selection();
  });
  listen('input', () => {
    const text = textFromInput(documentModel.value.text, input.value);
    documentModel.commit({
      text,
      start: sourceOffset(text, input.selectionStart),
      end: sourceOffset(text, input.selectionEnd),
      scroll: input.scrollTop,
    });
    repaint();
    options.onChange?.(documentModel.value.text);
    options.onSelect?.();
  });
  listen('select', selection);
  listen('keyup', selection);
  listen('pointerup', selection);
  listen('scroll', () => {
    pre.scrollTop = input.scrollTop;
    pre.scrollLeft = input.scrollLeft;
    documentModel.select(
      sourceOffset(documentModel.value.text, input.selectionStart),
      sourceOffset(documentModel.value.text, input.selectionEnd),
      input.scrollTop
    );
  });
  listen('compositionstart', () => {
    composing = true;
  });
  listen('compositionend', () => {
    composing = false;
  });
  listen('keydown', (event) => {
    const e = event as KeyboardEvent;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !composing) {
      e.preventDefault();
      e.stopPropagation();
      if (e.shiftKey) api.redo();
      else api.undo();
    }
  });
  const api: CodeEditor = {
    input,
    document: documentModel,
    language(value) {
      language = value;
      paint();
    },
    wrap(enabled) {
      input.wrap = enabled ? 'soft' : 'off';
      container.classList.toggle('code-editor--wrap', enabled);
      paint();
    },
    loadText(text) {
      documentModel.reset(text);
      render();
    },
    setText(text) {
      if (text === documentModel.value.text) return;
      documentModel.commit({ text, start: 0, end: 0, scroll: 0 });
      render();
    },
    replace(text, range, revision) {
      if (composing) return false;
      selection();
      const done = documentModel.replace(text, range, revision);
      if (done) {
        render();
        input.focus();
      }
      return done;
    },
    undo() {
      if (documentModel.undo()) render();
    },
    redo() {
      if (documentModel.redo()) render();
    },
    destroy() {
      abort.abort();
      cancelAnimationFrame(frame);
      container.replaceChildren();
    },
  };
  input.value = documentModel.value.text;
  paint();
  return api;
}
