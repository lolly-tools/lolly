// SPDX-License-Identifier: MPL-2.0
import { resolveDesignPages } from '../../../../engine/src/design-hierarchy.ts';
import type { Runtime } from '../../../../engine/src/runtime.ts';
import type { DesignPagePort, ModelPort, SelectionPort } from './design-ports.ts';
import type { StageNav } from './tool-stage-nav.ts';

interface PageCanvas {
  design: { model: Pick<ModelPort, 'getBoxes' | 'commit'>; selection: SelectionPort };
  pageChanged(): void;
  duplicatePage(id: string): Promise<string | undefined>;
  removePage(id: string): void;
}

/** Each viewer keeps their own page, selection and viewport. */
export function createDesignPagePort(runtime: Runtime, options: {
  canEdit(): boolean;
  stage(): Pick<StageNav, 'viewState' | 'applyView' | 'fit'> | null;
  flush(): void;
  onError(error: unknown): void;
}) {
  let pageSource: unknown, pages = resolveDesignPages(), active = '';
  let canvas: PageCanvas | undefined, disposed = false, switchSequence = 0;
  let selectionSequence = 0, offSelection = () => {};
  const listeners = new Set<() => void>();
  const views = new Map<string, { selection: string[]; viewport?: ReturnType<StageNav['viewState']> }>();
  function getPages() {
    const source = runtime.getModel().find(item => item.id === 'pages')?.value;
    if (source !== pageSource) {
      pageSource = source; pages = resolveDesignPages(Array.isArray(source) ? source : []);
      const ids = new Set(pages.map(page => page.id));
      for (const id of views.keys()) if (!ids.has(id)) views.delete(id);
    }
    return pages;
  }
  function current(): string {
    const all = getPages();
    return all.some(page => page.id === active) ? active : all[0]!.id;
  }
  function notify(): void { for (const listener of listeners) listener(); }
  async function switchPage(id: string): Promise<void> {
    if (disposed || !canvas || !getPages().some(page => page.id === id)) return;
    const before = active || current();
    if (id === before && runtime.getViewState?.()?.pageId === id) return;
    if (getPages().some(page => page.id === before)) views.set(before, { selection: canvas.design.selection.get(), viewport: options.stage()?.viewState() });
    const sequence = ++switchSequence;
    canvas.pageChanged(); active = id; notify();
    const selectionAtStart = selectionSequence, viewportAtStart = options.stage()?.viewState();
    await runtime.setViewState?.({ pageId: id });
    if (disposed || sequence !== switchSequence) return;
    options.flush();
    const saved = views.get(id);
    if (selectionSequence === selectionAtStart) canvas.design.selection.set(saved?.selection ?? []);
    const viewportNow = options.stage()?.viewState();
    if (viewportNow?.scale === viewportAtStart?.scale && viewportNow?.x === viewportAtStart?.x && viewportNow?.y === viewportAtStart?.y) {
      if (saved?.viewport) options.stage()?.applyView(saved.viewport);
      else options.stage()?.fit();
    }
    notify();
  }
  const port: DesignPagePort = {
    get: getPages, active: current,
    setActive: id => { void switchPage(id).catch(options.onError); },
    getBoxes: () => canvas?.design.model.getBoxes() ?? [],
    commit(nextPages, boxes, label) { if (options.canEdit()) canvas?.design.model.commit(boxes, { pages: nextPages }, label); },
    duplicate(id) { if (options.canEdit()) void canvas?.duplicatePage(id).then(next => { if (next) port.setActive(next); }).catch(options.onError); },
    remove(id) { if (options.canEdit()) canvas?.removePage(id); },
    onChange(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    canEdit: options.canEdit,
  };
  const off = runtime.subscribe(() => {
    if (disposed) return;
    const fallback = current();
    if (active && fallback !== active) void switchPage(fallback).catch(options.onError);
    notify();
  });
  return {
    port,
    bind(value: PageCanvas): void {
      canvas = value;
      offSelection(); offSelection = value.design.selection.onChange(() => { selectionSequence++; });
      const previous = runtime.getViewState?.()?.pageId;
      if (typeof previous === 'string' && getPages().some(page => page.id === previous)) active = previous;
      else active = current();
      if (runtime.getViewState?.()?.pageId !== active) void runtime.setViewState?.({ pageId: active }).catch(options.onError);
    },
    destroy(): void { disposed = true; switchSequence++; off(); offSelection(); listeners.clear(); views.clear(); },
  };
}
