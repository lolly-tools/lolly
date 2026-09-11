// SPDX-License-Identifier: MPL-2.0
import { artwork, markers } from './artwork';
import { layout, tourView } from './geography';
import { clamp, num, type State, updateTimes } from './model';
import { createGlobe } from './webgl';
export function mount(root: HTMLElement, state: State) {
  (root as any).__timezone?.dispose();
  const abort = new AbortController(),
    signal = abort.signal,
    art = root.querySelector('.tz-art') as HTMLElement,
    canvas = root.querySelector('canvas')!,
    overlay = root.querySelector('.tz-pins') as SVGElement,
    status = root.querySelector('.tz-status')!;
  let disposed = false,
    globe: ReturnType<typeof createGlobe> | undefined,
    raf = 0,
    saveTimer = 0,
    drag: any = null,
    manual = false,
    lastFrame = -1,
    clock = 0,
    playing = false;
  const reduced =
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    document.documentElement.dataset.a11yMotion === 'reduce';
  const wantsMotion = state.inputs.motion !== 'still';
  playing = wantsMotion && !reduced;
  // The shell's export panel owns the containing artboard, including physical
  // units. Read its CSS size, so no duplicated tool size inputs can disagree.
  function readSize() {
    if (root.clientWidth > 0 && root.clientHeight > 0) {
      state.width = root.clientWidth;
      state.height = root.clientHeight;
    }
  }
  readSize();
  let l = layout(state);
  function placeSurfaces() {
    for (const el of [canvas, overlay])
      Object.assign(el.style, {
        left: `${(l.map.x / l.w) * 100}%`,
        top: `${(l.map.y / l.h) * 100}%`,
        width: `${(l.map.w / l.w) * 100}%`,
        height: `${(l.map.h / l.h) * 100}%`,
      });
    overlay.setAttribute('viewBox', `0 0 ${l.map.w} ${l.map.h}`);
    overlay.setAttribute('font-family', state.palette.body);
    const surface = root.querySelector('.tz-interaction') as HTMLElement;
    Object.assign(surface.style, {
      left: `${(l.map.x / l.w) * 100}%`,
      top: `${(l.map.y / l.h) * 100}%`,
      width: `${(l.map.w / l.w) * 100}%`,
      height: `${(l.map.h / l.h) * 100}%`,
    });
  }
  placeSurfaces();
  const setStatus = (value: string) => {
    status.textContent = value;
  };
  if (state.inputs.renderer === 'webgl') {
    try {
      globe = createGlobe(canvas, state);
      canvas.dataset.backend = 'webgl2';
      canvas.hidden = false;
      setStatus('Drag to rotate · Shift to roll · Scroll to zoom');
    } catch (e) {
      canvas.hidden = true;
      overlay.innerHTML = '';
      root.dataset.backend = 'vector-fallback';
      setStatus('WebGL unavailable · vector atlas active');
      console.warn('[timezone] Using vector fallback', e);
    }
  } else {
    canvas.hidden = true;
    setStatus('Drag to rotate · Shift to roll · Scroll to zoom');
  }
  const frameCanvas = canvas as HTMLCanvasElement & {
    __lollyFrameRender?: (t: number) => void;
    __lollyFrameDriven?: boolean;
  };
  function draw(t: number, exportFrame = false) {
    if (disposed) return;
    const pose = tourView(state, t);
    const view = manual ? state.view : pose.view;
    if (globe) {
      globe.render(view, pose.unfold);
      art.innerHTML = artwork(state, pose.active, false);
      overlay.innerHTML = markers(state, globe.project, pose.active);
    } else {
      const base = state.view;
      state.view = view;
      art.innerHTML = artwork(state, pose.active);
      state.view = base;
    }
    root.dataset.frame = String(t);
    if (exportFrame) root.dataset.exportFrame = 'true';
  }
  function persist() {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      if (disposed || !root.isConnected) return;
      const control = document.querySelector(
        '#tool-inputs [data-input-id="view"]'
      ) as HTMLInputElement | null;
      if (control) {
        const value = state.view.map((v, i) => v.toFixed(i === 3 ? 3 : 2)).join(',');
        // Write the actual editable field. Setting a Jelly host's value rebuilds
        // its shadow input, losing the shell's listener before we can notify it.
        const inner = control.shadowRoot?.querySelector(
          'input,textarea'
        ) as HTMLInputElement | null;
        const field = inner || control;
        field.value = value;
        field.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      }
    }, 180);
  }
  function renderView() {
    manual = true;
    playing = false;
    draw(clock);
    updatePlay();
  }
  function updatePlay() {
    const b = root.querySelector<HTMLButtonElement>('[data-action="play"]');
    if (b) {
      b.disabled = !wantsMotion;
      b.textContent = playing
        ? 'Pause animation'
        : wantsMotion
          ? 'Play animation'
          : 'Select an animation';
      b.setAttribute('aria-pressed', String(playing));
    }
  }
  const surface = root.querySelector('.tz-interaction') as HTMLElement;
  surface.addEventListener(
    'pointerdown',
    (e) => {
      if (e.button !== 0) return;
      drag = { x: e.clientX, y: e.clientY, v: [...state.view], moved: false, roll: e.shiftKey };
      surface.setPointerCapture(e.pointerId);
    },
    { signal }
  );
  surface.addEventListener(
    'pointermove',
    (e) => {
      if (!drag) return;
      const b = surface.getBoundingClientRect(),
        dx = (e.clientX - drag.x) / b.width,
        dy = (e.clientY - drag.y) / b.height;
      if (Math.abs(dx) + Math.abs(dy) > 0.003) drag.moved = true;
      state.view = drag.roll
        ? [drag.v[0], drag.v[1], drag.v[2] + dx * 180, drag.v[3]]
        : [drag.v[0] - dx * 240, clamp(drag.v[1] + dy * 180, -89, 89), drag.v[2], drag.v[3]];
      renderView();
    },
    { signal }
  );
  const end = (e: PointerEvent) => {
    if (!drag) return;
    const moved = drag.moved;
    drag = null;
    if (surface.hasPointerCapture(e.pointerId)) surface.releasePointerCapture(e.pointerId);
    if (moved) persist();
  };
  surface.addEventListener('pointerup', end, { signal });
  surface.addEventListener('pointercancel', end, { signal });
  surface.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      state.view[3] = clamp(state.view[3] * Math.exp(-e.deltaY * 0.001), 0.4, 4);
      renderView();
      persist();
    },
    { signal, passive: false }
  );
  surface.addEventListener(
    'keydown',
    (e) => {
      const v = state.view;
      if (e.key === 'ArrowLeft') v[0] -= 5;
      else if (e.key === 'ArrowRight') v[0] += 5;
      else if (e.key === 'ArrowUp') v[1] = clamp(v[1] + 5, -89, 89);
      else if (e.key === 'ArrowDown') v[1] = clamp(v[1] - 5, -89, 89);
      else if (e.key === '+' || e.key === '=') v[3] = clamp(v[3] * 1.1, 0.4, 4);
      else if (e.key === '-') v[3] = clamp(v[3] / 1.1, 0.4, 4);
      else if (e.key === 'Home') state.view = [15, 22, 0, 1];
      else return;
      e.preventDefault();
      renderView();
      persist();
    },
    { signal }
  );
  root.addEventListener(
    'click',
    (e) => {
      const target = e.target as Element,
        action = target.closest('[data-action]')?.getAttribute('data-action');
      if (action === 'play') {
        playing = !playing;
        manual = false;
        updatePlay();
        draw(clock);
      } else if (action === 'reset') {
        state.view = [15, 22, 0, 1];
        renderView();
        persist();
      } else if (action === 'zoom-in' || action === 'zoom-out') {
        state.view[3] = clamp(state.view[3] * (action === 'zoom-in' ? 1.2 : 1 / 1.2), 0.4, 4);
        renderView();
        persist();
      }
      const index = target.closest('[data-place-index]')?.getAttribute('data-place-index');
      if (index != null) {
        const p = state.places[+index];
        if (p && !p.error && p.longitude !== null && p.latitude !== null) {
          state.view = [p.longitude, p.latitude, state.view[2], state.view[3]];
          renderView();
          persist();
        }
      }
    },
    { signal }
  );
  let lastNow = state.instant?.slice(0, 16) || '';
  const tick = (ms: number) => {
    if (disposed) return;
    if (!root.isConnected) {
      dispose();
      return;
    }
    const dt = lastFrame < 0 ? 0 : Math.min(100, ms - lastFrame);
    lastFrame = ms;
    if (!frameCanvas.__lollyFrameDriven) {
      const now = new Date();
      if (state.inputs.timeMode === 'now' && now.toISOString().slice(0, 16) !== lastNow) {
        lastNow = now.toISOString().slice(0, 16);
        if (!state.error) updateTimes(state, now);
        draw(clock);
      }
      if (playing && !document.hidden) {
        clock = (clock + dt / (num(state.inputs.duration, 12) * 1000)) % 1;
        draw(clock);
      }
    }
    raf = requestAnimationFrame(tick);
  };
  function dispose() {
    if (disposed) return;
    disposed = true;
    abort.abort();
    cancelAnimationFrame(raf);
    clearTimeout(saveTimer);
    resizeObserver.disconnect();
    delete frameCanvas.__lollyFrameRender;
    globe?.dispose();
  }
  // Hooks produce the first SVG before any GPU dependency arrives. Readiness waits for fonts too.
  frameCanvas.__lollyFrameRender = (t: number) => {
    manual = false;
    draw(t, true);
  };
  (root as any).__timezone = {
    draw: (t: number) => frameCanvas.__lollyFrameRender!(t),
    dispose,
    state,
    resize,
  };
  function resize() {
    if (disposed) return;
    const oldW = state.width,
      oldH = state.height;
    readSize();
    if (oldW === state.width && oldH === state.height) return;
    l = layout(state);
    placeSurfaces();
    if (globe) {
      globe.dispose();
      globe = undefined;
      try {
        globe = createGlobe(canvas, state);
      } catch {
        canvas.hidden = true;
        overlay.innerHTML = '';
      }
    }
    draw(clock);
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(root);
  draw(0);
  updatePlay();
  raf = requestAnimationFrame(tick);
  const ready = () => {
    if (!disposed && root.isConnected) {
      root.dataset.ready = 'true';
      document.dispatchEvent(new CustomEvent('tool:ready'));
    }
  };
  Promise.all([
    document.fonts.load(`500 20px ${state.palette.body}`),
    document.fonts.load(`500 40px ${state.palette.display}`),
  ])
    .catch(() => {})
    .then(() => {
      draw(clock);
      ready();
    });
  if (state.error || state.places.some((p) => p.error))
    setStatus([state.error, ...state.places.map((p) => p.error)].filter(Boolean).join(' · '));
  return dispose;
}
