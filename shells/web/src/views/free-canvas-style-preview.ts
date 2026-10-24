// SPDX-License-Identifier: MPL-2.0
/**
 * A drag's live preview, written straight onto the canvas elements it changes and
 * taken off again before the one commit at the end.
 *
 * A slider or a colour drag used to commit on every tick, and each commit runs the
 * whole edit pipeline: two template hydrations, the Design hook, undo, the address bar
 * and the side panels. On a large document that is a quarter of a second per tick. So
 * a drag now shows its value on the selected elements only, and the model hears about
 * it once, on release: one commit and one undo step per drag.
 *
 * The preview is put back exactly as it was (the element's `style` attribute, byte for
 * byte) before the commit, so the paint that follows compares the live canvas with the
 * template it came from and can still take its fast path. Nothing here reaches an
 * export: the commit, not the preview, is what the export renders.
 *
 * Pure DOM, no editor state. Its tests, and the drags that use it, are in
 * free-canvas-drag-commit.test.ts.
 */

export interface StylePreview {
  /** Set one CSS property on `el`, remembering the element's `style` attribute the
   *  first time this preview touches that element. */
  set(el: HTMLElement, prop: string, value: string): void;
  /** Put every touched element's `style` attribute back as it was. Idempotent. */
  restore(): void;
  /** Whether anything is previewed now. */
  active(): boolean;
}

export function createStylePreview(): StylePreview {
  const saved = new Map<HTMLElement, string | null>();
  return {
    set(el, prop, value) {
      if (!saved.has(el)) saved.set(el, el.getAttribute('style'));
      el.style.setProperty(prop, value);
    },
    restore() {
      for (const [el, style] of saved) {
        if (style === null) el.removeAttribute('style');
        else el.setAttribute('style', style);
      }
      saved.clear();
    },
    active: () => saved.size > 0,
  };
}

/** The typography sliders the Text panel drags: its `data-tp` key to a CSS value. The
 *  clamps and units are the Design renderer's own (`textCss` in
 *  community/_shared/design-renderer.js), so the preview shows what the commit will. */
export const TYPE_PREVIEW: Record<string, (v: number) => [prop: string, value: string]> = {
  lh: (v) => ['line-height', String(Math.min(4, Math.max(0.5, v)))],
  tr: (v) => ['letter-spacing', `${Math.round(Math.min(400, Math.max(-100, v)) * 100) / 100}px`],
  pad: (v) => ['padding', `${Math.round(Math.min(400, Math.max(0, v)))}px`],
};
