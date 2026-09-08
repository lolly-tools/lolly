// SPDX-License-Identifier: MPL-2.0
import { coerceUiState, type EditorState, type UiState } from './editor-state.ts';

/** The public editor-state channel changes the view, never the document. */
export function attachCanvasEditorApi(canvas: {
  uiState(): Omit<UiState, 'v'>;
  applyUi(state: EditorState): void;
}): () => void {
  const ui = {
    getState: () => ({ v: 1 as const, ...canvas.uiState() }),
    apply: (state: unknown) => {
      const parsed = coerceUiState(state);
      if (parsed) canvas.applyUi(parsed);
    },
  };
  const w = window as unknown as { lolly?: { ui?: typeof ui } };
  w.lolly = { ...w.lolly, ui };
  const onMessage = (event: MessageEvent): void => {
    const data = event.data as { type?: unknown; state?: unknown } | null;
    if (data?.type === 'lolly:ui') ui.apply(data.state);
  };
  window.addEventListener('message', onMessage);
  return () => {
    window.removeEventListener('message', onMessage);
    if (w.lolly?.ui === ui) delete w.lolly.ui;
  };
}
