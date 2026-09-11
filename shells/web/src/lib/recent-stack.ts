// SPDX-License-Identifier: MPL-2.0
/**
 * Recent-creations card STACK - an interactive deck of session preview thumbnails.
 *
 * The cards are the SAME rendered previews the Projects / gallery tiles already cache
 * (host.state.list().thumb), so nothing re-renders. The front card sits proud with the
 * next few peeking behind it like a hand of cards; the user reorders the stack by:
 *   • dragging / swiping the front card (fling past a threshold → next comes up),
 *   • a horizontal trackpad swipe (wheel deltaX) - vertical scroll still scrolls the page,
 *   • the ‹ / › buttons, or ← / → keys.
 * A clean tap on the front card opens that session. Everything transitions smoothly.
 */
import './recent-stack.css';
import { escapeHtml } from './html.ts';
import { prefersReducedMotion } from './a11y-prefs.ts';

export interface StackItem { thumb: string; label: string; href: string }
export interface StackHandle { destroy(): void }

/** Build the interactive stack inside `root`. Returns a handle to tear it down. */
export function createRecentStack(root: HTMLElement, items: StackItem[]): StackHandle {
  const N = items.length;
  const VISIBLE = 3;                 // how many cards peek behind the front one
  // Read once per stack: the deck's motion decisions are made as it is built, and a
  // toggle mid-session lands on the next mount (the dashboard rebuilds it on entry).
  const reduce = prefersReducedMotion();

  root.classList.add('dash-stack');
  root.setAttribute('tabindex', '0');
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', 'Recent creations - swipe to browse');
  root.innerHTML = `
    <div class="dash-stack-deck" data-deck>
      ${items.map((it) => `
        ${/* nosemgrep: lolly-href-escape-is-not-scheme-validation - callers build this as `#/tool/<id>…` (views/dashboard.ts), so the fixed `#/` prefix makes a scheme impossible */ ''}
        <a class="dash-stack-card" href="${escapeHtml(it.href)}" aria-label="${escapeHtml(it.label)}">
          <span class="dash-stack-imgwrap"><img class="dash-stack-img" src="${escapeHtml(it.thumb)}" alt="" draggable="false" loading="lazy" decoding="async"></span>
          <span class="dash-stack-cap">${escapeHtml(it.label)}</span>
        </a>`).join('')}
    </div>
    <div class="dash-stack-ui">
      <button type="button" class="dash-stack-nav" data-prev aria-label="Previous">‹</button>
      <span class="dash-stack-count" data-count aria-live="polite"></span>
      <button type="button" class="dash-stack-nav" data-next aria-label="Next">›</button>
    </div>
    ${/* nosemgrep: lolly-href-escape-is-not-scheme-validation - same `#/tool/<id>…` construction as the deck cards above */ ''}
    <a class="dash-stack-open" data-open href="${escapeHtml(items[0]!.href)}">Open<span class="dash-stack-open-label" data-open-label>${escapeHtml(items[0]!.label)}</span></a>`;

  const deck = root.querySelector<HTMLElement>('[data-deck]')!;
  const cards = Array.from(root.querySelectorAll<HTMLElement>('.dash-stack-card'));
  const countEl = root.querySelector<HTMLElement>('[data-count]')!;
  const openEl = root.querySelector<HTMLAnchorElement>('[data-open]')!;
  const openLabelEl = root.querySelector<HTMLElement>('[data-open-label]')!;

  let top = 0;
  const rel = (i: number): number => ((i - top) % N + N) % N;

  function layout(dragDx = 0, dragging = false): void {
    for (let i = 0; i < N; i++) {
      const card = cards[i]!;
      const r = rel(i);
      const depth = Math.min(r, VISIBLE);
      const ty = depth * 13;
      const sc = Math.max(0.78, 1 - depth * 0.055);
      let rot = r === 0 ? 0 : (r % 2 ? 1 : -1) * Math.min(depth, 3) * 1.4;
      let tx = 0;
      const hidden = r > VISIBLE;
      if (r === 0 && dragging) {
        tx = dragDx;
        rot = dragDx / 18;
        card.style.transition = 'none';
      } else {
        card.style.transition = '';
      }
      card.style.transform = `translate(-50%, -50%) translate(${tx}px, ${ty}px) scale(${sc}) rotate(${rot}deg)`;
      card.style.opacity = hidden ? '0' : r === VISIBLE ? '0.4' : '1';
      card.style.zIndex = String(N - r);
      card.style.pointerEvents = r === 0 ? 'auto' : 'none';
      card.setAttribute('aria-hidden', r === 0 ? 'false' : 'true');
      card.tabIndex = r === 0 ? 0 : -1;
    }
    countEl.textContent = `${top + 1} / ${N}`;
    const front = items[top]!;
    openEl.href = front.href;
    openLabelEl.textContent = front.label;
  }

  function advance(dir: number): void { top = ((top + dir) % N + N) % N; layout(); }

  // Fling the front card off in the swipe direction, then bring the next one up. The
  // flung card lands at the back of the deck (hidden) while off-screen, so the reset is
  // invisible - a clean "next card, please".
  let flinging = false;
  function fling(dir: number): void {
    if (flinging || reduce) { advance(1); return; }
    flinging = true;
    const front = cards[top]!;
    front.style.transition = 'transform .34s ease, opacity .34s ease';
    front.style.transform = `translate(-50%, -50%) translate(${dir * (root.offsetWidth || 400)}px, -18px) rotate(${dir * 16}deg)`;
    front.style.opacity = '0';
    window.setTimeout(() => {
      front.style.transition = 'none';       // snap to its new (deep, hidden) slot invisibly
      advance(1);
      requestAnimationFrame(() => { front.style.transition = ''; flinging = false; });
    }, 340);
  }

  // ── Pointer drag / swipe on the front card ──
  let dragging = false, startX = 0, dx = 0, moved = false, pid = -1;
  const onDown = (e: PointerEvent): void => {
    if (flinging || (e.pointerType === 'mouse' && e.button !== 0)) return;
    dragging = true; startX = e.clientX; dx = 0; moved = false; pid = e.pointerId;
    try { deck.setPointerCapture(pid); } catch { /* fine */ }
  };
  const onMove = (e: PointerEvent): void => {
    if (!dragging) return;
    dx = e.clientX - startX;
    if (Math.abs(dx) > 4) moved = true;
    layout(dx, true);
  };
  const onUp = (): void => {
    if (!dragging) return;
    dragging = false;
    try { deck.releasePointerCapture(pid); } catch { /* fine */ }
    if (Math.abs(dx) > 64) fling(dx > 0 ? 1 : -1);
    else layout(0, false);
    dx = 0;
  };
  deck.addEventListener('pointerdown', onDown);
  deck.addEventListener('pointermove', onMove);
  deck.addEventListener('pointerup', onUp);
  deck.addEventListener('pointercancel', onUp);
  // A drag must not also trigger the anchor's navigation.
  deck.addEventListener('click', (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
  deck.addEventListener('dragstart', (e) => e.preventDefault());

  // ── Horizontal wheel (trackpad swipe) cycles; vertical scroll left to the page ──
  let wheelAcc = 0;
  const onWheel = (e: WheelEvent): void => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;   // vertical → page scroll
    e.preventDefault();
    wheelAcc += e.deltaX;
    if (Math.abs(wheelAcc) > 42) { advance(wheelAcc > 0 ? 1 : -1); wheelAcc = 0; }
  };
  root.addEventListener('wheel', onWheel, { passive: false });

  // ── Buttons + keys ──
  const prevBtn = root.querySelector<HTMLButtonElement>('[data-prev]')!;
  const nextBtn = root.querySelector<HTMLButtonElement>('[data-next]')!;
  prevBtn.addEventListener('click', () => advance(-1));
  nextBtn.addEventListener('click', () => advance(1));
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { advance(-1); e.preventDefault(); }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { advance(1); e.preventDefault(); }
  };
  root.addEventListener('keydown', onKey);

  layout();

  return {
    destroy() {
      root.removeEventListener('wheel', onWheel);
      root.removeEventListener('keydown', onKey);
    },
  };
}
