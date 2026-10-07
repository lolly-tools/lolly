// SPDX-License-Identifier: MPL-2.0
/**
 * A placed tool's live settings panel: the embed editor's inputs without its modal.
 *
 * Design's inspector shows the controls of a tool placed on the board (its Tool
 * section, design-inspector.ts) by mounting this panel. The controls are the tool
 * sidebar's own (tool-inputs.ts syncInputs), driven by a child runtime exactly as the
 * embed editor drives them, so a placed tool is tuned with the board in view.
 */
import { parseUrlState, serializeUrlState, buildEmbedUrl, parseToolUrl } from '@lolly/engine';
import type { AssetRef, ComposeAPI } from '@lolly-tools/core/host-v1';
import type { InputModelItem } from '../../../../engine/src/inputs.ts';
import type { Runtime } from '../../../../engine/src/runtime.ts';
import { getTool } from '../bridge/tool-loader.ts';
import { createToolRuntime as createRuntime } from '../lib/mount-runtime.ts';
import { t } from '../i18n.ts';
import { syncInputs, _sliderDragging } from './tool-inputs.ts';
import type { WebToolHost, PanelEl } from './tool.ts';

/** A placed tool's live settings panel (see mountEmbedPanel). */
export interface EmbedPanelHandle {
  /** The panel element: the host may move it between rebuilds of its own column. */
  el: HTMLElement;
  /** The canonical tool link this panel last loaded or rendered: the box's link while
   *  the two agree, so a host can tell its own write from an outside one (an undo). */
  url(): string;
  /** True while the person is working in the panel (a pointer held down in it, or a
   *  caret in one of its fields): a host column should not rebuild around it then. */
  busy(): boolean;
  destroy(): void;
}

/**
 * The embed editor's inputs WITHOUT its modal: the placed tool's own controls, driven by
 * a child runtime exactly as openEmbedEditor drives them, mounted into `slot` - a panel
 * in the host's own column (Design's inspector), next to the board the tool sits on.
 *
 * Each settled change re-renders the tool through the same lossless round trip the
 * editor commits with (serializeUrlState → buildEmbedUrl → host.compose.renderUrl) and
 * hands the fresh AssetRef to `onRender`, which writes it to the box. So a slider in the
 * inspector changes the picture on the canvas directly, there is no Apply step, and
 * every write is one undo step of the host's. The render keeps the link's own format
 * and size (`w`/`h`), so editing a Pose Geeko's eyes never turns its SVG into a PNG.
 *
 * The first subscribe call is the initial paint, not a change, so mounting renders
 * nothing. Resolves null when the link is not a tool this shell has.
 */
export async function mountEmbedPanel(
  host: WebToolHost,
  slot: HTMLElement,
  { url: startUrl, onRender, onError }: {
    url: string;
    onRender: (ref: AssetRef) => void;
    onError?: (message: string) => void;
  },
): Promise<EmbedPanelHandle | null> {
  if (!host.compose?.renderUrl) return null;
  const parsed = parseToolUrl(startUrl);
  if (!parsed) return null;
  let child: Runtime;
  let emojiStyle: typeof import('../lib/emoji-runtime-style.ts');
  let state: ReturnType<typeof parseUrlState>;
  try {
    const tool = await getTool(parsed.toolId);
    if (!tool) return null;
    state = parseUrlState(parsed.query, tool.manifest);
    child = await createRuntime(tool, host, state.values);
    emojiStyle = await import('../lib/emoji-runtime-style.ts');
    await emojiStyle.seedEmojiRuntime(child, host, state.emoji ? { emoji: state.emoji, emojifx: state.emojiFx ?? '', emojistyle: state.emojiStyle ?? '' } : null);
  } catch {
    return null;
  }
  const format = parsed.format || 'svg';
  const el = document.createElement('div') as PanelEl;
  el.className = 'tool-inputs ee-inputs embed-panel';
  slot.appendChild(el);

  let current = startUrl;
  let prevModel: InputModelItem[] | undefined;
  let renderSeq = 0;
  let debounce: ReturnType<typeof setTimeout> | undefined;
  let held = false;
  let destroyed = false;

  const render = async (): Promise<void> => {
    const seq = ++renderSeq;
    const query = emojiStyle.queryWithEmoji(serializeUrlState(child.getModel()), child.emoji.style);
    const next = buildEmbedUrl({ toolId: parsed.toolId, format, query });
    const ref = next
      ? await host.compose!.renderUrl!(next, {
          format,
          width: state.width ?? undefined,
          height: state.height ?? undefined,
          unit: state.unit ?? undefined,
          dpi: state.dpi ?? undefined,
        } as Parameters<NonNullable<ComposeAPI['renderUrl']>>[1]).catch(() => null)
      : null;
    if (destroyed || seq !== renderSeq) return;
    if (!ref) { onError?.(t("Couldn't render this - the inputs may be too large to keep as a link.")); return; }
    const meta = ref.meta as { toolUrl?: unknown } | undefined;
    current = typeof meta?.toolUrl === 'string' ? meta.toolUrl : ref.id;
    onRender(ref);
  };
  const schedule = (): void => { clearTimeout(debounce); debounce = setTimeout(() => { void render(); }, 250); };

  let first = true;
  const offModel = child.subscribe(({ model }) => {
    if (!_sliderDragging) prevModel = syncInputs(el, model, prevModel, child, host, () => {}, child.manifest.id);
    if (first) { first = false; return; }
    schedule();
  });
  let lastEmoji = JSON.stringify(child.emoji.style);
  const offEmoji = child.onEmojiChange(({ style }) => {
    const next = JSON.stringify(style);
    if (next !== lastEmoji) { lastEmoji = next; schedule(); }
  });
  const down = (): void => { held = true; };
  const up = (): void => { held = false; };
  el.addEventListener('pointerdown', down);
  document.addEventListener('pointerup', up, true);
  document.addEventListener('pointercancel', up, true);

  return {
    el,
    url: () => current,
    busy: () => held || _sliderDragging || (el.contains(document.activeElement)
      && /^(INPUT|TEXTAREA)$/.test(document.activeElement!.tagName)
      && !/^(range|checkbox|radio|button|color)$/.test((document.activeElement as HTMLInputElement).type || '')),
    destroy() {
      if (destroyed) return;
      destroyed = true;
      clearTimeout(debounce);
      renderSeq++;
      el._inputsDispose?.();
      if (typeof offModel === 'function') offModel();
      offEmoji();
      document.removeEventListener('pointerup', up, true);
      document.removeEventListener('pointercancel', up, true);
      el.remove();
    },
  };
}
