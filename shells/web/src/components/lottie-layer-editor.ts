// SPDX-License-Identifier: MPL-2.0
/** Nested source layers inside the existing Sequence transport. */
import { t } from '../i18n.ts';
import { lottieLayerFrame, lottieLayers, lottieRootFrame, lottieTracks, type LottieEdit, type LottieLayerView } from '../../../../engine/src/lottie-edit.ts';
import type { LottieAnimation } from '../../../../engine/src/lottie-model.ts';
import { animationButton, animationField, animationNumber, mountLottieTrackEditor, type LottieTrackEditorHandle } from './lottie-track-editor.ts';

export interface LottieLayerEditorOptions {
  frame(): number;
  seek(rootFrame: number): void;
  edit(edit: LottieEdit): void;
  reset(): void;
  close(): void;
}
export interface LottieLayerEditorHandle {
  update(animation: LottieAnimation, hasEdits: boolean): void;
  tick(): void;
  destroy(): void;
}
export function mountLottieLayerEditor(root: HTMLElement, options: LottieLayerEditorOptions): LottieLayerEditorHandle {
  let source: LottieAnimation, selected = '', selectedTrack = '', editor: LottieTrackEditorHandle | null = null, destroyed = false;
  let typed: HTMLInputElement | null = null, waiting: { animation: LottieAnimation; hasEdits: boolean } | null = null;
  // An edit made from these fields supersedes a redraw that was waiting on them: that
  // redraw predates it, and the host sends a newer one once the edit is written.
  const opts: LottieLayerEditorOptions = { ...options, edit(change) { waiting = null; options.edit(change); } };
  const header = document.createElement('div'); header.className = 'tl-animation-header';
  const scope = document.createElement('span'); scope.textContent = t('Internal edits affect this clip only. The original stays unchanged.');
  const reset = animationButton(t('Reset internal edits'), opts.reset), close = animationButton(t('Close'), opts.close);
  header.append(scope, reset, close);
  const body = document.createElement('div'); body.className = 'tl-animation-body';
  const layers = document.createElement('div'); layers.className = 'tl-animation-layers';
  layers.setAttribute('role', 'group'); layers.setAttribute('aria-label', t('Animation layers'));
  const details = document.createElement('div'); details.className = 'tl-animation-details';
  body.append(layers, details); root.replaceChildren(header, body);
  function renderLayer(view: LottieLayerView): void {
    let previousSelection = editor?.selection();
    editor?.destroy(); editor = null; details.replaceChildren();
    const target = { asset: view.asset, index: view.index }, layer = view.layer;
    const name = document.createElement('input'); name.type = 'text'; name.className = 'field-input'; name.value = String(layer.nm ?? ''); name.maxLength = 200;
    name.addEventListener('change', () => opts.edit({ target, kind: 'layer', patch: { nm: name.value } }));
    const visible = document.createElement('input'); visible.type = 'checkbox'; visible.className = 'field-check'; visible.checked = !layer.hd;
    visible.addEventListener('change', () => opts.edit({ target, kind: 'layer', patch: { hd: !visible.checked } }));
    const meta = document.createElement('div'); meta.className = 'tl-animation-meta';
    meta.append(animationField(t('Layer name'), name), animationField(t('Visible'), visible));
    for (const [field, label] of [['ip', t('In frame')], ['op', t('Out frame')]] as const) {
      meta.append(animationField(label, animationNumber(Number(layer[field] ?? source[field]), value => opts.edit({ target, kind: 'layer', patch: { [field]: value } }))));
    }
    details.append(meta);
    if (view.asset || layer.parent !== undefined || layer.ty === 3) {
      const note = document.createElement('p'); note.className = 'tl-animation-note';
      note.textContent = view.asset ? t('Nested composition edits affect every use of that composition within this clip.') : t('Reference layer transforms remain active when the layer is hidden.');
      details.append(note);
    }
    const tracks = lottieTracks(layer), trackSelect = document.createElement('select'); trackSelect.className = 'field-select';
    for (const track of tracks) { const option = document.createElement('option'); option.value = track.id; option.textContent = t(track.name); trackSelect.append(option); }
    if (!tracks.length) return;
    if (!tracks.some(track => track.id === selectedTrack)) selectedTrack = tracks[0]!.id;
    trackSelect.value = selectedTrack;
    details.append(animationField(t('Property'), trackSelect));
    const host = document.createElement('div'); host.className = 'tl-animation-property'; details.append(host);
    function showTrack(): void {
      editor?.destroy(); host.replaceChildren(); selectedTrack = trackSelect.value;
      const track = tracks.find(track => track.id === selectedTrack)!;
      editor = mountLottieTrackEditor(host, {
        target, track, selection: previousSelection, frame: () => lottieLayerFrame(source, view.ancestors, opts.frame()), edit: opts.edit,
        seek(frame) { const rootFrame = lottieRootFrame(source, view.ancestors, frame); if (rootFrame !== null) opts.seek(rootFrame); },
      });
      if (lottieRootFrame(source, view.ancestors, 0) === null) {
        const note = document.createElement('p'); note.className = 'tl-animation-note';
        note.textContent = t('This composition uses time remapping. Keys use source frames; scrub the timeline to preview them.'); host.append(note);
      }
    }
    trackSelect.addEventListener('change', () => { previousSelection = undefined; showTrack(); }); showTrack();
  }
  function render(): void {
    const views = lottieLayers(source); layers.replaceChildren();
    if (!views.some(view => view.key === selected)) selected = views[0]?.key ?? '';
    for (const view of views) {
      const button = animationButton(view.name, () => { if (selected !== view.key) { editor?.destroy(); editor = null; } selected = view.key; render(); });
      button.className = 'tl-animation-layer'; button.style.paddingInlineStart = `${8 + view.depth * 14}px`;
      button.setAttribute('aria-pressed', view.key === selected ? 'true' : 'false'); button.dataset.layer = view.key;
      if (view.layer.hd) button.classList.add('is-hidden'); layers.append(button);
    }
    const view = views.find(view => view.key === selected);
    if (view) renderLayer(view);
    else { editor?.destroy(); editor = null; details.textContent = t('This animation has no layers.'); }
  }
  // A redraw replaces every field. One that has been typed into and not yet committed
  // keeps the person's text and focus: the redraw waits for that field's change (its
  // commit) or for focus to leave it, then runs with the newest animation.
  const typing = (): boolean => !!typed && typed.isConnected && typed === document.activeElement;
  function show(animation: LottieAnimation, hasEdits: boolean): void {
    const active = document.activeElement as HTMLElement | null;
    const label = active && details.contains(active) ? active.getAttribute('aria-label') : null;
    const layer = active && layers.contains(active) ? active.dataset.layer : undefined;
    source = animation; reset.disabled = !hasEdits; render();
    // The redraw removed the focused control, so focus moves to its replacement.
    const next = label ? [...details.querySelectorAll<HTMLElement>('[aria-label]')].find(el => el.getAttribute('aria-label') === label)
      : layer !== undefined ? [...layers.querySelectorAll<HTMLElement>('[data-layer]')].find(el => el.dataset.layer === layer) : undefined;
    next?.focus({ preventScroll: true });
  }
  function release(): void {
    if (destroyed || !waiting || typing()) return;
    const { animation, hasEdits } = waiting; waiting = null; show(animation, hasEdits);
  }
  root.addEventListener('input', event => {
    const target = event.target as HTMLInputElement;
    if (target.tagName === 'INPUT' && target.type !== 'checkbox' && target.type !== 'color') typed = target;
  });
  // After the field's own change handler has queued its edit, and after focus has moved.
  root.addEventListener('change', () => { typed = null; setTimeout(release, 0); });
  root.addEventListener('focusout', () => { setTimeout(release, 0); });
  return {
    update(animation, hasEdits) {
      waiting = { animation, hasEdits };
      release();
    },
    tick() { editor?.tick(); },
    destroy() { destroyed = true; waiting = null; editor?.destroy(); root.replaceChildren(); },
  };
}
