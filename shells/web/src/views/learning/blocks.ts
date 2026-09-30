// SPDX-License-Identifier: MPL-2.0
import { updateRouteParams } from '../../lib/url-state.ts';
import type { LearningCtx } from './context.ts';

export function syncBlockSelection(ctx: LearningCtx): void {
  const lesson = ctx.module.lessons.find((l) => l.id === ctx.selected);
  const ids = new Set(lesson?.blocks.map((b) => b.id));
  for (const id of ctx.selectedBlocks) if (!ids.has(id)) ctx.selectedBlocks.delete(id);
  for (const card of ctx.root.querySelectorAll<HTMLElement>('[data-block]')) {
    const selected = ctx.selectedBlocks.has(card.dataset.block!);
    card.dataset.selected = String(selected);
    card.querySelector('[data-block-surface]')?.setAttribute('aria-pressed', String(selected));
    const check = card.querySelector<HTMLInputElement>('[data-block-select]');
    if (check) check.checked = selected;
  }
  const toolbar = ctx.root.querySelector<HTMLElement>('[data-block-selection]');
  if (toolbar) toolbar.hidden = !ctx.selectedBlocks.size;
  const count = ctx.root.querySelector('[data-block-selection-count]');
  if (count) count.textContent = `${ctx.selectedBlocks.size} selected`;
  if (ctx.root.isConnected) updateRouteParams({ _blocks: [...ctx.selectedBlocks].join(',') || null });
}

/** Dragging only starts on the grip or header. Editable content keeps native selection. */
export function mountBlockInteraction(ctx: LearningCtx): () => void {
  const root = ctx.root;
  let drag:
    | {
        ids: string[];
        lessonId: string;
        handle: HTMLElement;
        remaining: HTMLElement[];
        index: number;
        pointerId?: number;
        startX: number;
        startY: number;
        x: number;
        y: number;
        active: boolean;
      }
    | undefined;
  let tick = 0;
  let destination: string | undefined;
  let anchor: string | undefined;
  let hold: ReturnType<typeof setTimeout> | undefined;
  let suppressClick = false;
  let waiting: { event: PointerEvent; surface: HTMLElement } | undefined;
  const marker = document.createElement('div');
  marker.className = 'learning-drop-marker';
  marker.setAttribute('aria-hidden', 'true');
  const announce = (message: string) => {
    const status = root.querySelector('[data-block-status]');
    if (status) status.textContent = message;
  };
  const cards = () => [...root.querySelectorAll<HTMLElement>('[data-block]')];
  const select = (id: string, extend = false) => {
    if (!extend) ctx.selectedBlocks.clear();
    ctx.selectedBlocks.add(id);
    syncBlockSelection(ctx);
  };
  const clear = () => {
    clearTimeout(hold);
    waiting = undefined;
    destination = undefined;
    for (const row of root.querySelectorAll<HTMLElement>('[data-content-drop]'))
      delete row.dataset.contentDrop;
    cancelAnimationFrame(tick);
    marker.remove();
    for (const card of cards()) delete card.dataset.dragging;
    if (drag) {
      drag.handle.setAttribute('aria-pressed', 'false');
      if (drag.pointerId !== undefined && drag.handle.hasPointerCapture(drag.pointerId))
        drag.handle.releasePointerCapture(drag.pointerId);
    }
    drag = undefined;
  };
  const showPosition = () => {
    if (!drag) return;
    const list = root.querySelector('.learning-content-list')!.getBoundingClientRect();
    const before = drag.remaining[drag.index]?.getBoundingClientRect();
    const last = drag.remaining.at(-1)?.getBoundingClientRect();
    marker.style.left = `${list.left}px`;
    marker.style.width = `${list.width}px`;
    marker.style.top = `${before ? before.top - 7 : last ? last.bottom + 7 : list.top}px`;
    if (!marker.isConnected) document.body.append(marker);
  };
  const positionAtPointer = () => {
    if (!drag) return;
    const row = document
      .elementFromPoint(drag.x, drag.y)
      ?.closest<HTMLElement>('[data-lesson-row]');
    destination = row?.dataset.lessonRow !== ctx.selected ? row?.dataset.lessonRow : undefined;
    for (const item of root.querySelectorAll<HTMLElement>('[data-content-drop]'))
      delete item.dataset.contentDrop;
    if (destination && row) {
      row.dataset.contentDrop = 'true';
      marker.remove();
      return;
    }
    const at = drag.remaining.findIndex((card) => {
      const box = card.getBoundingClientRect();
      return drag!.y < box.top + box.height / 2;
    });
    drag.index = at < 0 ? drag.remaining.length : at;
    showPosition();
  };
  const scrollFrame = () => {
    if (!drag?.active || drag.pointerId === undefined) return;
    let scroller: HTMLElement | null = drag.handle.parentElement;
    while (
      scroller &&
      !(
        scroller.scrollHeight > scroller.clientHeight &&
        /auto|scroll/.test(getComputedStyle(scroller).overflowY)
      )
    )
      scroller = scroller.parentElement;
    const box = scroller?.getBoundingClientRect();
    const top = Math.max(120, box?.top || 0);
    const bottom = Math.min(innerHeight, box?.bottom || innerHeight);
    const speed =
      drag.y < top + 64
        ? -Math.min(18, (top + 64 - drag.y) / 4)
        : drag.y > bottom - 64
          ? Math.min(18, (drag.y - bottom + 64) / 4)
          : 0;
    if (speed) {
      if (scroller) scroller.scrollTop += speed;
      else window.scrollBy(0, speed);
      positionAtPointer();
    }
    tick = requestAnimationFrame(scrollFrame);
  };
  const begin = (handle: HTMLElement, event?: PointerEvent) => {
    const id = handle.closest<HTMLElement>('[data-block]')!.dataset.block!;
    if (!ctx.selectedBlocks.has(id)) select(id);
    const all = cards();
    const remaining = all.filter((c) => !ctx.selectedBlocks.has(c.dataset.block!));
    drag = {
      ids: all.filter((c) => ctx.selectedBlocks.has(c.dataset.block!)).map((c) => c.dataset.block!),
      lessonId: ctx.selected,
      handle,
      remaining,
      index: all
        .slice(
          0,
          all.findIndex((c) => c.dataset.block === id)
        )
        .filter((c) => !ctx.selectedBlocks.has(c.dataset.block!)).length,
      pointerId: event?.pointerId,
      startX: event?.clientX || 0,
      startY: event?.clientY || 0,
      x: event?.clientX || 0,
      y: event?.clientY || 0,
      active: !event,
    };
    if (event) handle.setPointerCapture(event.pointerId);
    else activate();
  };
  const activate = () => {
    if (!drag) return;
    drag.active = true;
    drag.handle.setAttribute('aria-pressed', 'true');
    for (const card of cards())
      if (drag.ids.includes(card.dataset.block!)) card.dataset.dragging = 'true';
    announce(
      `Moving ${drag.ids.length} ${drag.ids.length === 1 ? 'block' : 'blocks'}. Choose a position; Escape cancels.`
    );
    showPosition();
    tick = requestAnimationFrame(scrollFrame);
  };
  const drop = async () => {
    if (!drag) return;
    const { ids, remaining, index, lessonId, active } = drag;
    const beforeId = remaining[index]?.dataset.block;
    const toLesson = destination;
    if (active && drag.pointerId !== undefined) suppressClick = true;
    clear();
    if (!active) return;
    await ctx.flushTyping();
    if (ctx.disposed || ctx.busy || ctx.selected !== lessonId) return;
    if (toLesson) {
      ctx.edit.moveBlocks(toLesson);
      return;
    }
    const lesson = ctx.module.lessons.find((l) => l.id === lessonId)!;
    const moving = lesson.blocks.filter((b) => ids.includes(b.id));
    const rest = lesson.blocks.filter((b) => !ids.includes(b.id));
    const at = beforeId ? rest.findIndex((b) => b.id === beforeId) : rest.length;
    if (at < 0) return;
    const next = [...rest.slice(0, at), ...moving, ...rest.slice(at)];
    if (next.some((b, i) => b !== lesson.blocks[i])) {
      lesson.blocks = next;
      ctx.edit.change();
    }
    ctx.ui.render(`[data-block="${CSS.escape(ids[0]!)}"] [data-block-drag]`);
    announce(
      `${moving.length === 1 ? 'Block' : `${moving.length} blocks`} moved to position ${at + 1} of ${next.length}.`
    );
  };
  const onPointerDown = (event: PointerEvent) => {
    if (ctx.busy || event.button !== 0 || !event.isPrimary) return;
    const target = event.target as Element;
    const handle = target.closest<HTMLElement>('[data-block-drag]');
    const surface = target.closest<HTMLElement>('[data-block-surface]');
    suppressClick = false;
    if (handle) {
      event.preventDefault();
      clear();
      handle.focus({ preventScroll: true });
      begin(handle, event);
    } else if (surface && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
      clear();
      waiting = { event, surface };
      hold = setTimeout(() => {
        if (!waiting) return;
        begin(
          surface.closest('[data-block]')!.querySelector<HTMLElement>('[data-block-drag]')!,
          event
        );
        waiting = undefined;
        activate();
      }, 350);
    }
  };
  const onPointerMove = (event: PointerEvent) => {
    if (
      waiting &&
      Math.hypot(event.clientX - waiting.event.clientX, event.clientY - waiting.event.clientY) >= 6
    ) {
      const pending = waiting;
      clearTimeout(hold);
      waiting = undefined;
      if (event.pointerType === 'mouse') {
        begin(
          pending.surface.closest('[data-block]')!.querySelector<HTMLElement>('[data-block-drag]')!,
          pending.event
        );
        activate();
      }
    }
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag.x = event.clientX;
    drag.y = event.clientY;
    if (!drag.active && Math.hypot(drag.x - drag.startX, drag.y - drag.startY) < 6) return;
    event.preventDefault();
    if (!drag.active) activate();
    positionAtPointer();
  };
  const onPointerUp = (event: PointerEvent) => {
    clearTimeout(hold);
    waiting = undefined;
    if (drag?.pointerId === event.pointerId) void drop().catch((e) => ctx.ui.status(String(e)));
  };
  const onTouchMove = (event: TouchEvent) => {
    // A completed hold owns the gesture; an ordinary swipe still scrolls.
    if (drag?.active && drag.pointerId !== undefined && event.cancelable) event.preventDefault();
  };
  const cancel = () => {
    clearTimeout(hold);
    waiting = undefined;
    if (drag) {
      clear();
      announce('Move cancelled. Content order is unchanged.');
    }
  };
  const selectSurface = (surface: HTMLElement, extend: boolean, range: boolean) => {
    const id = surface.closest<HTMLElement>('[data-block]')!.dataset.block!;
    const all = cards().map((c) => c.dataset.block!);
    if (range && anchor && all.includes(anchor)) {
      const bounds = [all.indexOf(anchor), all.indexOf(id)].sort((a, b) => a - b);
      if (!extend) ctx.selectedBlocks.clear();
      for (const key of all.slice(bounds[0], bounds[1]! + 1)) ctx.selectedBlocks.add(key);
    } else {
      if (!extend) ctx.selectedBlocks.clear();
      if (extend && ctx.selectedBlocks.has(id)) ctx.selectedBlocks.delete(id);
      else ctx.selectedBlocks.add(id);
      anchor = id;
    }
    syncBlockSelection(ctx);
  };
  const onClick = (event: MouseEvent) => {
    if (suppressClick) {
      suppressClick = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const surface = (event.target as Element).closest<HTMLElement>('[data-block-surface]');
    if (surface && !ctx.busy)
      selectSurface(surface, event.metaKey || event.ctrlKey, event.shiftKey);
  };
  const onKey = (event: KeyboardEvent) => {
    const surface = (event.target as Element).closest<HTMLElement>('[data-block-surface]');
    if (surface && !ctx.busy && [' ', 'Enter'].includes(event.key)) {
      event.preventDefault();
      selectSurface(surface, event.metaKey || event.ctrlKey, event.shiftKey);
      return;
    }
    const handle = (event.target as Element).closest<HTMLElement>('[data-block-drag]');
    if (event.key === 'Escape' && drag) {
      event.preventDefault();
      event.stopPropagation();
      cancel();
      return;
    }
    if (!handle || ctx.busy) return;
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      if (drag) void drop().catch((e) => ctx.ui.status(String(e)));
      else begin(handle);
    } else if (drag && ['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      drag.index =
        event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? drag.remaining.length
            : Math.max(
                0,
                Math.min(drag.remaining.length, drag.index + (event.key === 'ArrowUp' ? -1 : 1))
              );
      drag.remaining[Math.min(drag.index, drag.remaining.length - 1)]?.scrollIntoView({
        block: 'nearest',
      });
      showPosition();
      announce(`Position ${drag.index + 1}. Space or Enter places the selection; Escape cancels.`);
    }
  };
  const onSelect = (event: Event) => {
    if (ctx.busy || drag) return;
    const target = event.target as HTMLElement;
    const card = target.closest<HTMLElement>('[data-block]');
    if (!card) return;
    const id = card.dataset.block!;
    if (target instanceof HTMLInputElement && target.matches('[data-block-select]')) {
      if (event.type !== 'change') return;
      if (target.checked) ctx.selectedBlocks.add(id);
      else ctx.selectedBlocks.delete(id);
      syncBlockSelection(ctx);
    }
  };
  root.addEventListener('click', onClick, true);
  root.addEventListener('pointerdown', onPointerDown);
  root.addEventListener('pointermove', onPointerMove);
  root.addEventListener('pointerup', onPointerUp);
  root.addEventListener('touchmove', onTouchMove, { passive: false });
  root.addEventListener('pointercancel', cancel);
  root.addEventListener('lostpointercapture', cancel);
  root.addEventListener('keydown', onKey);
  root.addEventListener('change', onSelect);
  return () => {
    clear();
    root.removeEventListener('click', onClick, true);
    root.removeEventListener('pointerdown', onPointerDown);
    root.removeEventListener('pointermove', onPointerMove);
    root.removeEventListener('pointerup', onPointerUp);
    root.removeEventListener('touchmove', onTouchMove);
    root.removeEventListener('pointercancel', cancel);
    root.removeEventListener('lostpointercapture', cancel);
    root.removeEventListener('keydown', onKey);
    root.removeEventListener('change', onSelect);
  };
}
