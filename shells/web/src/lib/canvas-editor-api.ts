// SPDX-License-Identifier: MPL-2.0
import { updateRouteParams } from './url-state.ts';
import { isIframeMode } from './iframe-mode.ts';
import { encodeUiState, coerceUiState, type EditorState, type UiState } from './editor-state.ts';
import { isTrustedSender } from './message-sender.ts';

/** The public editor-state channel changes the view, never the document. */
export function attachCanvasEditorApi(canvas: {
  uiState(): Omit<UiState, 'v'>;
  applyUi(state: EditorState): void;
  subscribeUi?(listener: () => void): () => void;
}): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let last = '';
  const sync = (): void => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      if (isIframeMode()) return;
      const encoded = encodeUiState({ v: 1, ...canvas.uiState() });
      if (encoded === last) return;
      last = encoded;
      updateRouteParams({ _ui: encoded, _sel: null, _t: null, _panel: null });
    }, 100);
  };
  const release = canvas.subscribeUi?.(sync);
  const events = ['pointerup', 'keyup', 'change', 'click'];
  for (const event of events) document.addEventListener(event, sync);
  const ui = {
    getState: () => ({ v: 1 as const, ...canvas.uiState() }),
    apply: (state: unknown) => {
      const parsed = coerceUiState(state);
      if (parsed) { canvas.applyUi(parsed); sync(); }
    },
  };
  const w = window as unknown as { lolly?: { ui?: typeof ui } };
  w.lolly = { ...w.lolly, ui };
  const onMessage = (event: MessageEvent): void => {
    const data = event.data as { type?: unknown; state?: unknown } | null;
    if (data?.type === 'lolly:ui' && isTrustedSender(event, window)) ui.apply(data.state);
  };
  window.addEventListener('message', onMessage);
  return () => {
    if (timer) clearTimeout(timer);
    release?.();
    for (const event of events) document.removeEventListener(event, sync);
    window.removeEventListener('message', onMessage);
    if (w.lolly?.ui === ui) delete w.lolly.ui;
  };
}
