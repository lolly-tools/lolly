// SPDX-License-Identifier: MPL-2.0
// Unit tests for the audio-dock shell: capability gating, collapse, transport
// delegation, the host change-subscription, and the viz static fallback. A mock
// DockHost stands in for the real players — the shell touches no audio itself.
//
// Run: node --test packages/audio-dock/test/dock.test.ts
//
// jsdom with a real origin + pretendToBeVisual (so requestAnimationFrame exists,
// like the web-shell tests). jsdom has no canvas 2d context and no matchMedia, so
// the viz loop stands down to the static ground — which is exactly one of the
// cases under test. Assertions stay on the controller API + emitted structure /
// gating attributes, never on computed CSS (jsdom does not lay out).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createAudioDock, DOCK_CSS } from '../src/index.ts';
import type { DockHost, DockNowPlaying, DockSource } from '../src/index.ts';

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'https://lolly.tools/',
  pretendToBeVisual: true,
});
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;

// A configurable mock host. `emit()` fires the change-subscription; `state` is
// mutable so a test can prove the shell re-reads on emit.
interface MockHost extends DockHost {
  emit(): void;
  state: {
    playing: boolean;
    now: DockNowPlaying;
    follow: boolean;
    speed: number;
    currentId: string;
    levels: Record<string, number>;
  };
}

function makeHost(over: Partial<DockHost> = {}, vizSupported = false): MockHost {
  const listeners = new Set<() => void>();
  const state = {
    playing: false,
    now: { title: 'Getting started', subtitle: 'AI narration', kind: 'narration' } as DockNowPlaying,
    follow: true,
    speed: 1.25,
    currentId: '',
    levels: {} as Record<string, number>,
  };
  const base: DockHost = {
    isPlaying: () => state.playing,
    togglePlay: () => { state.playing = !state.playing; },
    onChange: (l) => { listeners.add(l); return () => listeners.delete(l); },
    nowPlaying: () => state.now,
    narration: {
      getFollow: () => state.follow,
      setFollow: (v) => { state.follow = v; },
      getSpeed: () => state.speed,
      setSpeed: (r) => { state.speed = r; },
      speeds: () => [0.5, 0.75, 1, 1.25, 1.5, 2],
      caption: () => 'The current narrated line.',
      disclosure: () => 'AI narration. The page text is the original.',
    },
    sources: {
      list: (): DockSource[] => [
        { id: 'a', title: 'Groove Salad', kind: 'music', group: 'Catalog', mood: 'ambient' },
        { id: 'b', title: 'Focus Beat', kind: 'music', group: 'Catalog' },
        { id: 'r1', title: 'Drone Zone', kind: 'radio', group: 'Internet Radio' },
      ],
      select: (id) => { state.currentId = id; },
      currentId: () => state.currentId,
    },
    atmosphere: {
      layers: () => [
        { id: 'rain', label: 'Rain', group: 'Outside' },
        { id: 'white', label: 'White noise', group: 'Noise' },
      ],
      groups: () => ['Outside', 'Places', 'Noise'],
      getLevel: (id) => state.levels[id] ?? 0,
      setLevel: (id, v) => { state.levels[id] = v; },
    },
    viz: {
      supported: () => vizSupported,
      getAnalyser: () => null,
    },
  };
  const host = { ...base, ...over } as MockHost;
  host.state = state;
  host.emit = () => { for (const l of listeners) l(); };
  return host;
}

test('DOCK_CSS is a scoped, non-empty stylesheet string', () => {
  assert.equal(typeof DOCK_CSS, 'string');
  assert.ok(DOCK_CSS.includes('.audio-dock'));
  assert.ok(DOCK_CSS.includes('--dock-accent'));   // the host-overridable theme token
});

test('narration-only host renders narration, and NO music/atmosphere sections gate on', () => {
  // A host with ONLY a narration adapter and only the narration capability.
  const host = makeHost({ sources: undefined, atmosphere: undefined, viz: undefined });
  const dock = createAudioDock({ host, capabilities: { narration: true } });
  const root = dock.el;

  assert.ok(root.hasAttribute('data-cap-narration'), 'narration capability gate on');
  assert.ok(!root.hasAttribute('data-cap-music'), 'music gate off');
  assert.ok(!root.hasAttribute('data-cap-atmosphere'), 'atmosphere gate off');
  assert.ok(!root.hasAttribute('data-cap-viz'), 'viz gate off');

  // Narration content is actually built: the speed control + the disclosure line.
  const speed = root.querySelector<HTMLSelectElement>('[data-speed]')!;
  assert.equal(speed.options.length, 6);
  assert.equal(root.querySelector('[data-disclosure]')!.textContent,
    'AI narration. The page text is the original.');
  // The music picker never built (no adapter): no source rows.
  assert.equal(root.querySelectorAll('.audio-dock-src').length, 0);
  dock.destroy();
});

test('music-capable host renders the picker, with the radio group when radio is on', () => {
  const host = makeHost();
  const dock = createAudioDock({ host, capabilities: { music: true, radio: true } });
  const root = dock.el;

  assert.ok(root.hasAttribute('data-cap-music'));
  assert.ok(root.hasAttribute('data-cap-radio'));
  // All three sources (2 music + 1 radio) render, grouped.
  const rows = root.querySelectorAll('.audio-dock-src');
  assert.equal(rows.length, 3);
  const groups = [...root.querySelectorAll('.audio-dock-group')].map((g) => g.textContent);
  assert.ok(groups.includes('Catalog'));
  assert.ok(groups.includes('Internet Radio'));

  // Selecting a row delegates to the host and marks the row current.
  root.querySelector<HTMLButtonElement>('[data-src-id="b"]')!.click();
  assert.equal(host.state.currentId, 'b');
  assert.equal(root.querySelector('[data-src-id="b"]')!.getAttribute('aria-current'), 'true');
  dock.destroy();
});

test('radio group is suppressed when only the music capability is on', () => {
  const host = makeHost();
  const dock = createAudioDock({ host, capabilities: { music: true } });   // no radio
  const groups = [...dock.el.querySelectorAll('.audio-dock-group')].map((g) => g.textContent);
  assert.ok(groups.includes('Catalog'));
  assert.ok(!groups.includes('Internet Radio'), 'radio group gated off');
  assert.equal(dock.el.querySelectorAll('.audio-dock-src').length, 2);
  dock.destroy();
});

test('setCollapse(mini) sets the mini axis and keeps a mini play control', () => {
  const host = makeHost();
  const dock = createAudioDock({ host, capabilities: { narration: true, music: true } });
  assert.equal(dock.getCollapse(), 'full');
  assert.equal(dock.el.getAttribute('data-collapse'), 'full');

  dock.setCollapse('mini');
  assert.equal(dock.getCollapse(), 'mini');
  assert.equal(dock.el.getAttribute('data-collapse'), 'mini');
  // The mini play button exists (the body is hidden by CSS, not asserted here).
  assert.ok(dock.el.querySelector('[data-play-mini]'));
  dock.destroy();
});

test('viz off / unsupported falls back to the static ground (canvas gated)', () => {
  // No viz capability at all → no gate, static ground.
  const bare = createAudioDock({ host: makeHost(), capabilities: {} });
  assert.ok(!bare.el.hasAttribute('data-cap-viz'));
  assert.equal(bare.el.getAttribute('data-viz'), 'static');
  bare.destroy();

  // viz capability ON but the host reports no WebGL2 → still static.
  const unsup = createAudioDock({ host: makeHost({}, false), capabilities: { viz: true } });
  assert.ok(unsup.el.hasAttribute('data-cap-viz'), 'capability declared');
  assert.equal(unsup.el.getAttribute('data-viz'), 'static', 'but the backdrop stays static');
  unsup.destroy();
});

test('transport delegates to the host and repaints from the change-subscription', () => {
  const host = makeHost();
  const dock = createAudioDock({ host, capabilities: { narration: true } });
  const play = dock.el.querySelector<HTMLButtonElement>('[data-play]')!;

  assert.equal(play.getAttribute('aria-label'), 'Play');
  play.click();
  assert.equal(host.state.playing, true, 'togglePlay delegated');
  assert.equal(play.getAttribute('aria-label'), 'Pause', 'repainted after the click');

  // An EXTERNAL state change (the host, not a dock click) reaches the UI via emit.
  host.state.now = { title: 'URL mode', subtitle: 'AI narration' };
  host.emit();
  assert.equal(dock.el.querySelector('[data-title]')!.textContent, 'URL mode');
  dock.destroy();
});

test('follow-along + speed delegate to the narration adapter', () => {
  const host = makeHost();
  const dock = createAudioDock({ host, capabilities: { narration: true } });
  const follow = dock.el.querySelector<HTMLButtonElement>('[data-follow]')!;
  assert.equal(follow.getAttribute('aria-pressed'), 'true');
  follow.click();
  assert.equal(host.state.follow, false);
  assert.equal(follow.getAttribute('aria-pressed'), 'false');

  const speed = dock.el.querySelector<HTMLSelectElement>('[data-speed]')!;
  speed.value = '2';
  speed.dispatchEvent(new dom.window.Event('change'));
  assert.equal(host.state.speed, 2);
  dock.destroy();
});

test('atmosphere mixer renders rows and drives setLevel', () => {
  const host = makeHost();
  const dock = createAudioDock({ host, capabilities: { atmosphere: true } });
  dock.toggleSection('atmosphere', true);
  const rain = dock.el.querySelector<HTMLInputElement>('[data-atmo-range="rain"]')!;
  assert.ok(rain, 'a row per layer');
  rain.value = '0.4';
  rain.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  assert.equal(host.state.levels.rain, 0.4);
  assert.ok(rain.closest('[data-atmo-row]')!.classList.contains('is-on'));
  dock.destroy();
});

test('setCapabilities re-gates live, and toggleSection opens/closes a panel', () => {
  const host = makeHost();
  const dock = createAudioDock({ host, capabilities: { narration: true } });
  assert.ok(!dock.el.hasAttribute('data-cap-music'));

  dock.setCapabilities({ narration: true, music: true, radio: true });
  assert.ok(dock.el.hasAttribute('data-cap-music'));
  assert.equal(dock.el.querySelectorAll('.audio-dock-src').length, 3);

  const sec = dock.el.querySelector('[data-section="atmosphere"]')!;
  dock.toggleSection('atmosphere', true);
  assert.equal(sec.getAttribute('data-open'), 'true');
  dock.toggleSection('atmosphere');   // toggle → closed
  assert.equal(sec.getAttribute('data-open'), 'false');
  dock.destroy();
});

test('repeat toggle renders for a music host and flips the mode', () => {
  let repeat = true;
  const host = makeHost({ repeat: { get: () => repeat, set: (v) => { repeat = v; } } });
  const dock = createAudioDock({ host, capabilities: { music: true } });
  const btn = dock.el.querySelector<HTMLButtonElement>('[data-repeat]')!;
  assert.ok(btn, 'repeat button exists');
  assert.equal(btn.hidden, false, 'shown for a music host that offers repeat');
  assert.equal(btn.getAttribute('aria-pressed'), 'true');
  btn.click();
  assert.equal(repeat, false, 'delegated to host.repeat.set');
  assert.equal(btn.getAttribute('aria-pressed'), 'false', 'repainted');
  dock.destroy();
});

test('repeat toggle is hidden for a host that does not offer it', () => {
  const dock = createAudioDock({ host: makeHost(), capabilities: { music: true } });
  assert.equal(dock.el.querySelector<HTMLButtonElement>('[data-repeat]')!.hidden, true);
  dock.destroy();
});

test('volume sliders render and drive set (live) + commit (release)', () => {
  const seen = { music: 0, effects: 0, committed: -1 };
  const host = makeHost({
    volumes: [
      { id: 'music', label: 'Music', get: () => seen.music, set: (v) => { seen.music = v; } },
      { id: 'effects', label: 'Effects', get: () => seen.effects, set: (v) => { seen.effects = v; }, commit: (v) => { seen.committed = v; } },
    ],
  });
  const dock = createAudioDock({ host, capabilities: { music: true } });
  const music = dock.el.querySelector<HTMLInputElement>('[data-vol-id="music"]')!;
  const effects = dock.el.querySelector<HTMLInputElement>('[data-vol-id="effects"]')!;
  assert.ok(music && effects, 'a slider per volume');
  music.value = '0.3';
  music.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  assert.equal(seen.music, 0.3, 'input delegates to set');
  effects.value = '0.8';
  effects.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  assert.equal(seen.committed, 0.8, 'change delegates to commit');
  dock.destroy();
});

test('searchable picker filters rows and hides empty groups', () => {
  const host = makeHost();
  host.sources!.searchable = true;
  const dock = createAudioDock({ host, capabilities: { music: true, radio: true } });
  const search = dock.el.querySelector<HTMLInputElement>('[data-src-search]')!;
  assert.equal(search.hidden, false, 'search box shown when searchable');
  search.value = 'drone';
  search.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  const visible = [...dock.el.querySelectorAll<HTMLElement>('li[data-group]')].filter((li) => !li.hidden);
  assert.equal(visible.length, 1, 'only the matching row remains');
  assert.equal(visible[0]!.querySelector('[data-src-id]')!.getAttribute('data-src-id'), 'r1');
  const catHead = dock.el.querySelector<HTMLElement>('li[data-group-head="Catalog"]')!;
  assert.equal(catHead.hidden, true, 'a group with no visible rows is hidden');
  dock.destroy();
});

test('search box is absent when the host is not searchable', () => {
  const dock = createAudioDock({ host: makeHost(), capabilities: { music: true } });
  assert.equal(dock.el.querySelector<HTMLInputElement>('[data-src-search]')!.hidden, true);
  dock.destroy();
});

test('attribution renders a provider credit with a link', () => {
  const host = makeHost();
  host.sources!.attribution = () => ({ text: 'Internet radio via', href: 'https://somafm.com', linkText: 'SomaFM' });
  const dock = createAudioDock({ host, capabilities: { music: true, radio: true } });
  const attr = dock.el.querySelector<HTMLElement>('[data-src-attr]')!;
  assert.equal(attr.hidden, false);
  const a = attr.querySelector<HTMLAnchorElement>('a')!;
  assert.equal(a.getAttribute('href'), 'https://somafm.com');
  assert.equal(a.textContent, 'SomaFM');
  dock.destroy();
});

test('onClose renders a close button and delegates', () => {
  let closed = false;
  const host = makeHost();
  const dock = createAudioDock({ host, capabilities: { music: true }, onClose: () => { closed = true; } });
  const btn = dock.el.querySelector<HTMLButtonElement>('[data-close-btn]')!;
  assert.equal(btn.hidden, false, 'close button shown when onClose given');
  btn.click();
  assert.equal(closed, true);
  // A host without onClose has no close button.
  const bare = createAudioDock({ host: makeHost(), capabilities: { music: true } });
  assert.equal(bare.el.querySelector<HTMLButtonElement>('[data-close-btn]')!.hidden, true);
  bare.destroy();
  dock.destroy();
});

test('the expand ↗ shows when the visualiser is supported, and NOT in mini', () => {
  // A mount-only viz (host-rendered): hasVizCap + supported ⇒ the fullscreen affordance.
  const host = makeHost({ viz: { supported: () => true, mount: () => {}, unmount: () => {} } }, true);
  const dock = createAudioDock({ host, capabilities: { music: true, viz: true } });
  const btn = dock.el.querySelector<HTMLButtonElement>('[data-viz-expand]')!;
  assert.equal(btn.hidden, false, 'expand shown in full when viz supported');
  dock.setCollapse('mini');
  assert.equal(btn.hidden, true, 'mini is the ONLY state without the expand affordance');
  dock.setCollapse('full');
  assert.equal(btn.hidden, false, 'and it comes back on the way up');
  dock.destroy();
});

test('expand with no Fullscreen API falls back to the expanded window', () => {
  // jsdom has no requestFullscreen, so the shell's fallback lands directly in expanded.
  const host = makeHost({ viz: { supported: () => true, mount: () => {}, unmount: () => {} } }, true);
  const dock = createAudioDock({ host, capabilities: { music: true, viz: true }, mount: document.body });
  dock.el.querySelector<HTMLButtonElement>('[data-viz-expand]')!.click();
  assert.equal(dock.getCollapse(), 'expanded', 'expand → expanded when there is no Fullscreen API');
  assert.equal(dock.el.getAttribute('data-collapse'), 'expanded');
  dock.destroy();
});

test('exiting fullscreen lands in the expanded (draggable + resizable) state', () => {
  let fsEl: Element | null = null;
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => fsEl });
  const host = makeHost({ viz: { supported: () => true, mount: () => {}, unmount: () => {} } }, true);
  const dock = createAudioDock({ host, capabilities: { music: true, viz: true }, mount: document.body });
  const root = dock.el;
  // Stub the Fullscreen API: entering stamps fullscreenElement + fires the event.
  (root as unknown as { requestFullscreen: () => Promise<void> }).requestFullscreen = () => {
    fsEl = root;
    document.dispatchEvent(new dom.window.Event('fullscreenchange'));
    return Promise.resolve();
  };
  root.querySelector<HTMLButtonElement>('[data-viz-expand]')!.click();
  assert.ok(root.hasAttribute('data-fullscreen'), 'entered fullscreen');
  // The browser's own exit clears fullscreenElement and fires the event.
  fsEl = null;
  document.dispatchEvent(new dom.window.Event('fullscreenchange'));
  assert.ok(!root.hasAttribute('data-fullscreen'), 'left fullscreen');
  assert.equal(dock.getCollapse(), 'expanded', 'and lands in the expanded window, not compact');
  dock.destroy();
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: null });
});

test('dragging the header moves the dock and persists the position', () => {
  const saved: Record<string, number> = {};
  const placement = {
    get: () => (Object.keys(saved).length ? saved : null),
    set: (p: Record<string, number>) => Object.assign(saved, p),
  };
  const dock = createAudioDock({ host: makeHost(), capabilities: { music: true }, mount: document.body, placement });
  const head = dock.el.querySelector<HTMLElement>('[data-drag-head]')!;
  const P = (type: string, x: number, y: number): void =>
    { head.dispatchEvent(new dom.window.MouseEvent(type, { clientX: x, clientY: y, bubbles: true })); };
  P('pointerdown', 100, 100);
  P('pointermove', 100, 100);   // under the threshold — not yet a drag
  P('pointermove', 160, 140);   // now it moves
  P('pointerup', 160, 140);
  assert.equal(typeof saved.x, 'number', 'x persisted');
  assert.equal(typeof saved.y, 'number', 'y persisted');
  assert.ok(dock.el.style.left !== '', 'switched to left/top positioning');
  dock.destroy();
});

test('the expanded window resizes from the SE grip and persists the expanded size', () => {
  const saved: Record<string, number> = {};
  const placement = {
    get: () => (Object.keys(saved).length ? saved : null),
    set: (p: Record<string, number>) => Object.assign(saved, p),
  };
  const dock = createAudioDock({ host: makeHost(), capabilities: { music: true }, mount: document.body, placement });
  dock.setCollapse('expanded');
  const grip = dock.el.querySelector<HTMLElement>('[data-rz="se"]')!;
  const P = (type: string, x: number, y: number): void =>
    { grip.dispatchEvent(new dom.window.MouseEvent(type, { clientX: x, clientY: y, bubbles: true })); };
  P('pointerdown', 0, 0);
  P('pointermove', 120, 90);
  P('pointerup', 120, 90);
  assert.equal(typeof saved.ew, 'number', 'expanded width persisted');
  assert.equal(typeof saved.eh, 'number', 'expanded height persisted');
  assert.ok(dock.el.style.width !== '', 'the window took an explicit size');
  dock.destroy();
});

test('the FULL window is resizable too (per-state size), and mini is not', () => {
  const saved: Record<string, number> = {};
  const placement = {
    get: () => (Object.keys(saved).length ? saved : null),
    set: (p: Record<string, number>) => Object.assign(saved, p),
  };
  const dock = createAudioDock({ host: makeHost(), capabilities: { music: true }, mount: document.body, placement });
  assert.equal(dock.getCollapse(), 'full');
  assert.ok(dock.el.hasAttribute('data-resizable'), 'full is resizable');
  // Resize from the west EDGE handle — moves the left edge / anchor.
  const w = dock.el.querySelector<HTMLElement>('[data-rz="w"]')!;
  const P = (type: string, x: number, y: number): void =>
    { w.dispatchEvent(new dom.window.MouseEvent(type, { clientX: x, clientY: y, bubbles: true })); };
  P('pointerdown', 100, 100);
  P('pointermove', 40, 100);
  P('pointerup', 40, 100);
  assert.equal(typeof saved.fw, 'number', 'FULL width persisted (fw, not ew)');
  assert.equal(typeof saved.fh, 'number', 'FULL height persisted');
  assert.equal(saved.ew, undefined, 'the expanded size is untouched by a full-state resize');
  // Mini has no resize affordance.
  dock.setCollapse('mini');
  assert.ok(!dock.el.hasAttribute('data-resizable'), 'mini is fixed-size');
  dock.destroy();
});

test('in fullscreen the ↗ becomes an exit control and leaves fullscreen', () => {
  let fsEl: Element | null = null;
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => fsEl });
  const host = makeHost({ viz: { supported: () => true, mount: () => {}, unmount: () => {} } }, true);
  const dock = createAudioDock({ host, capabilities: { music: true, viz: true }, mount: document.body });
  const root = dock.el;
  (root as unknown as { requestFullscreen: () => Promise<void> }).requestFullscreen = () => {
    fsEl = root;
    document.dispatchEvent(new dom.window.Event('fullscreenchange'));
    return Promise.resolve();
  };
  const btn = root.querySelector<HTMLButtonElement>('[data-viz-expand]')!;
  btn.click();   // enter fullscreen
  assert.ok(root.hasAttribute('data-fullscreen'), 'entered fullscreen');
  assert.equal(btn.getAttribute('aria-label'), 'Exit fullscreen', 'the ↗ is now an exit control');
  // jsdom has no document.exitFullscreen → the fallback removes the state + lands expanded.
  btn.click();
  assert.ok(!root.hasAttribute('data-fullscreen'), 'left fullscreen from the button');
  assert.equal(dock.getCollapse(), 'expanded');
  dock.destroy();
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: null });
});

test('the viz stays the ambient backdrop (no inline reparent) and right-click opens its menu', () => {
  const richViz = {
    supported: () => true, getAnalyser: () => null, enabled: () => true, setEnabled: () => {},
    mount: () => {}, unmount: () => {}, resize: () => {},
    presets: () => [{ id: 'a', name: 'Aurora' }], currentPreset: () => 'a', selectPreset: () => {},
    themes: () => [{ id: 't1', name: 'Jungle' }], currentTheme: () => 't1', selectTheme: () => {},
  };
  const host = makeHost({ viz: richViz }, true);
  const dock = createAudioDock({ host, capabilities: { music: true, viz: true }, mount: document.body });
  const root = dock.el;
  const canvas = root.querySelector<HTMLCanvasElement>('[data-viz-canvas]')!;
  const menu = root.querySelector<HTMLElement>('[data-vizmenu]')!;
  assert.equal(canvas.parentElement, root, 'the canvas is the backdrop, a direct child of the dock (never reparented)');
  assert.ok(root.hasAttribute('data-cap-vizmenu'), 'the right-click menu is available for a rich viz');
  assert.equal(menu.hidden, true, 'menu closed by default');
  // Right-click a passive surface → open the settings menu.
  root.querySelector<HTMLElement>('[data-drag-head]')!.dispatchEvent(
    new dom.window.MouseEvent('contextmenu', { clientX: 20, clientY: 20, bubbles: true }));
  assert.equal(menu.hidden, false, 'right-click opened the viz settings menu');
  dock.destroy();
});

test('the visualiser settings menu carries on/off + theme + presets and delegates', async () => {
  let enabled = true;
  let picked = '';
  let theme = 't1';
  const richViz = {
    supported: () => true,
    getAnalyser: () => null,
    enabled: () => enabled,
    setEnabled: (on: boolean) => { enabled = on; },
    mount: () => {},
    unmount: () => {},
    presets: () => [{ id: 'a', name: 'Aurora' }, { id: 'b', name: 'Nova', group: 'Geiss' }],
    currentPreset: () => 'a',
    selectPreset: (id: string) => { picked = id; },
    themes: () => [{ id: 't1', name: 'Jungle' }, { id: 't2', name: 'Persimmon' }],
    currentTheme: () => theme,
    selectTheme: (id: string) => { theme = id; },
  };
  const host = makeHost({ viz: richViz }, true);
  const dock = createAudioDock({ host, capabilities: { music: true, viz: true }, mount: document.body });
  const root = dock.el;
  // rebuildVisualiser awaits the (here-sync) presets/themes; let the microtasks flush.
  await new Promise((r) => setTimeout(r, 0));
  const menu = root.querySelector<HTMLElement>('[data-vizmenu]')!;

  const themePills = [...menu.querySelectorAll<HTMLElement>('[data-viz-theme]')].map((b) => b.textContent);
  assert.deepEqual(themePills, ['Jungle', 'Persimmon'], 'theme pills built (in the menu)');
  const presetRows = [...menu.querySelectorAll<HTMLElement>('[data-viz-preset]')].map((b) => b.dataset.vizPreset);
  assert.deepEqual(presetRows, ['a', 'b'], 'preset rows built (in the menu)');

  menu.querySelector<HTMLButtonElement>('[data-viz-preset="b"]')!.click();
  assert.equal(picked, 'b', 'preset selection delegates');

  const toggle = menu.querySelector<HTMLButtonElement>('[data-viz-toggle]')!;
  assert.equal(toggle.hidden, false);
  toggle.click();
  assert.equal(enabled, false, 'viz on/off delegated to setEnabled');
  dock.destroy();
});

test('narrationBlock renders a SECOND coexisting player above the music player', () => {
  let voicePlaying = false;
  let follow = true;
  let speed = 1.25;
  const narrationBlock = {
    isPlaying: () => voicePlaying,
    togglePlay: () => { voicePlaying = !voicePlaying; },
    currentTime: () => 3,
    duration: () => 60,
    seekable: () => true,
    seek: () => {},
    nowPlaying: () => ({ title: 'Getting started', subtitle: 'AI narration', kind: 'narration' } as DockNowPlaying),
    onChange: () => () => {},
    narration: {
      getFollow: () => follow, setFollow: (v: boolean) => { follow = v; },
      getSpeed: () => speed, setSpeed: (r: number) => { speed = r; },
      speeds: () => [0.75, 1, 1.25, 1.5],
      caption: () => 'The current narrated line.',
      disclosure: () => 'AI narration. The page text is the original.',
    },
  };
  // Music base + a coexisting narration block.
  const host = makeHost({ narrationBlock });
  const dock = createAudioDock({ host, capabilities: { music: true } });
  const root = dock.el;
  const block = root.querySelector<HTMLElement>('[data-narrblock]')!;
  assert.equal(block.hidden, false, 'the narration block is shown');
  assert.equal(root.querySelector('[data-narr-title]')!.textContent, 'Getting started');
  assert.equal(root.querySelector<HTMLSelectElement>('[data-narr-speed]')!.options.length, 4, 'narration speeds built');
  // Its play is INDEPENDENT of the music transport.
  root.querySelector<HTMLButtonElement>('[data-narr-play]')!.click();
  assert.equal(voicePlaying, true, 'narration play delegates to narrationBlock (not the music host)');
  assert.equal(host.state.playing, false, 'the music transport is untouched — they coexist');
  // Its follow-along delegates to the block's own narration adapter.
  root.querySelector<HTMLButtonElement>('[data-narr-follow]')!.click();
  assert.equal(follow, false);
  // The music player is still present below.
  assert.equal(root.querySelector<HTMLElement>('[data-musicblock]')!.hidden, false, 'music block coexists');
  dock.destroy();
});

test('a narration-block-only dock hides the music block', () => {
  const narrationBlock = {
    isPlaying: () => false,
    togglePlay: () => {},
    nowPlaying: () => ({ title: 'Page voice', kind: 'narration' } as DockNowPlaying),
    onChange: () => () => {},
    narration: {
      getFollow: () => true, setFollow: () => {}, getSpeed: () => 1, setSpeed: () => {},
      speeds: () => [1, 1.5], caption: () => '', disclosure: () => '',
    },
  };
  const host = makeHost({ narrationBlock });
  const dock = createAudioDock({ host, capabilities: {} });   // no music caps
  const root = dock.el;
  assert.equal(root.querySelector<HTMLElement>('[data-narrblock]')!.hidden, false, 'narration block shown');
  assert.equal(root.querySelector<HTMLElement>('[data-musicblock]')!.hidden, true, 'music block hidden when there is no music');
  dock.destroy();
});

test('atmosphere rows render the host-supplied per-layer icon', () => {
  const host = makeHost({
    atmosphere: {
      layers: () => [{ id: 'rain', label: 'Rain', group: 'Outside', icon: '<svg data-glyph></svg>' }],
      groups: () => ['Outside'],
      getLevel: () => 0,
      setLevel: () => {},
    },
  });
  const dock = createAudioDock({ host, capabilities: { atmosphere: true } });
  dock.toggleSection('atmosphere', true);
  const row = dock.el.querySelector<HTMLElement>('[data-atmo-row="rain"]')!;
  assert.ok(row.querySelector('.audio-dock-atmo-icon svg'), 'the layer icon renders beside the slider');
  dock.destroy();
});

test('onCollapse fires on change and collapseSizes controls the step-down', () => {
  const sizes: string[] = [];
  const host = makeHost();
  const dock = createAudioDock({
    host, capabilities: { music: true },
    onCollapse: (s) => sizes.push(s),
    collapseSizes: ['full', 'mini'],   // binary: skip compact
  });
  // Step down via the collapse button: full → mini (compact skipped).
  dock.el.querySelector<HTMLButtonElement>('[data-collapse-btn]')!.click();
  assert.equal(dock.getCollapse(), 'mini');
  assert.deepEqual(sizes, ['mini']);
  // Re-expand via the mini play-face expander.
  dock.el.querySelector<HTMLButtonElement>('[data-mini-expand]')!.click();
  assert.equal(dock.getCollapse(), 'full');
  assert.deepEqual(sizes, ['mini', 'full']);
  dock.destroy();
});

test('destroy() unmounts and unsubscribes', () => {
  const host = makeHost();
  const mount = document.createElement('div');
  document.body.appendChild(mount);
  const dock = createAudioDock({ host, capabilities: { narration: true }, mount });
  assert.ok(dock.el.isConnected, 'mounted into the given element');

  dock.destroy();
  assert.ok(!dock.el.isConnected, 'removed on destroy');
  // A post-destroy emit must not throw and must not repaint.
  host.state.now = { title: 'gone' };
  host.emit();
  assert.notEqual(dock.el.querySelector('[data-title]')?.textContent, 'gone');
});
