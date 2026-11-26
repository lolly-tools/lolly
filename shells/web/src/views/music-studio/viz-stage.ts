// SPDX-License-Identifier: MPL-2.0
/**
 * The music generator's visualiser (#/music): the band above the timeline that shows the
 * sound as it plays, and the bigger show it opens into.
 *
 * THE BAND. A spectrum analyser by default, its bars in the colour of the section the
 * playhead is in, as the timeline colours its sections. The band takes no room until a
 * tune has played (the page's `has-audio`), then stays while the tune plays or is paused
 * part way. Its settings offer the analyser, a waveform, MilkDrop and off.
 *
 * THE SHOW. Expand grows the band in the page; Full screen gives it the whole screen (the
 * Fullscreen API, or a layer over the page where a browser cannot fullscreen an element,
 * as on an iPhone). Both open on MilkDrop, the Neurospicy player's visualiser
 * (lib/neurospicy-dock-host.ts createPageViz: the same presets, artist pack, brand
 * colours and preset cycle, reacting to this page's audio), unless the person prefers
 * reduced motion, when they open on the analyser and MilkDrop waits to be picked. Their
 * settings hold the preset, a preset shuffle and how often the preset changes by
 * itself. In full screen the controls hide until a tap, a move or a key; Escape leaves
 * full screen and shrinks an expanded band (through the page's own Escape, which leaves
 * the visualiser's settings to close themselves first).
 *
 * MilkDrop (WebGL, butterchurn) loads only when it is first shown. The band and the show
 * each remember their mode on this device.
 */
import { t, tRaw } from '../../i18n.ts';
import { escape as escapeHtml } from '../../utils.ts';
import { icon, type IconName } from '../../lib/icons.ts';
import { iconNode } from '../../lib/icon-node.ts';
import { segHtml } from '../../lib/seg.ts';
import { mountBodyPopover, type BodyPopoverHandle } from '../../components/body-popover.ts';
import { prefersReducedMotion } from '../../lib/a11y-prefs.ts';
import { shuffleIconSvg } from '../../lib/genre-icons.ts';
import type { PageViz } from '../../lib/neurospicy-dock-host.ts';

export type VizMode = 'bars' | 'scope' | 'milkdrop' | 'off';
/** The band's modes, then the show's: the show has no "off", as leaving it is the way out. */
const BAND_MODES: readonly VizMode[] = ['bars', 'scope', 'milkdrop', 'off'];
const SHOW_MODES: readonly VizMode[] = ['bars', 'scope', 'milkdrop'];
const BAND_KEY = 'lolly:musicViz';
const SHOW_KEY = 'lolly:musicVizShow';
/** How long the full-screen controls stay after a tap, a move or a key. */
const PEEK_MS = 2600;

const modeLabel = (m: VizMode): string => ({ bars: t('Analyser'), scope: t('Waveform'), milkdrop: t('MilkDrop'), off: t('Off') })[m];

/** A stored mode, or `fallback` when none (or one this list does not hold) is stored. */
export function storedMode(raw: string | null, modes: readonly VizMode[], fallback: VizMode): VizMode {
  return modes.find(m => m === raw) ?? fallback;
}

const read = (key: string): string | null => { try { return localStorage.getItem(key); } catch { return null; } };
const keep = (key: string, value: string): void => { try { localStorage.setItem(key, value); } catch { /* private mode */ } };

const button = (attr: string, name: IconName, label: string): string =>
  `<button type="button" class="btn btn--ghost btn--sm ms-icon" ${attr} aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">${icon(name, { size: 18 })}</button>`;

/** The band: its two canvases (the analyser's 2D, MilkDrop's WebGL) and its floating controls. */
export function vizStageHtml(): string {
  return `
    <div class="ms-stage" data-viz-stage>
      <canvas class="ms-viz" data-viz aria-hidden="true"></canvas>
      <canvas class="ms-viz" data-viz-rich aria-hidden="true" hidden></canvas>
      <div class="ms-viz-bar surface surface--floating" role="toolbar" aria-label="${escapeHtml(t('Visualiser'))}" data-viz-bar>
        ${button('data-viz-menu aria-haspopup="dialog" aria-expanded="false"', 'sliders', t('Visualiser settings'))}
        ${button('data-viz-expand aria-pressed="false"', 'expand', t('Expand the visualiser'))}
        ${button('data-viz-full', 'fullscreen', t('Full screen'))}
      </div>
    </div>`;
}

export interface VizStageDeps {
  page: HTMLElement;
  /** The shell's bridge, for MilkDrop's brand colours and artist presets. */
  host: unknown;
  /** The analyser the page's audio passes through; null until the first play. */
  analyser(): AnalyserNode | null;
  /** Whether a tune is sounding now. */
  playing(): boolean;
  /** The analyser's colour now: the colour of the section the playhead is in. */
  ink(): string;
  say(text: string): void;
}

export interface VizStage {
  /** Draw the analyser or waveform for this moment; the page calls this as the playhead moves. */
  frame(): void;
  /** The page's audio graph exists now, so MilkDrop can react to the tune. */
  audioReady(): void;
  /** Whether the settings are open, so the page leaves their Escape to them. */
  menuOpen(): boolean;
  /** Escape, when the page has nothing else open: leaves full screen or shrinks an expanded
   *  band. False when it did neither, so the page goes on. */
  escape(): boolean;
  destroy(): void;
}

type Size = 'band' | 'expanded' | 'full';

export function wireVizStage(d: VizStageDeps): VizStage {
  const stage = d.page.querySelector<HTMLElement>('[data-viz-stage]');
  const flat = stage?.querySelector<HTMLCanvasElement>('[data-viz]');
  const richCanvas = stage?.querySelector<HTMLCanvasElement>('[data-viz-rich]');
  const menuBtn = stage?.querySelector<HTMLButtonElement>('[data-viz-menu]');
  const expandBtn = stage?.querySelector<HTMLButtonElement>('[data-viz-expand]');
  const fullBtn = stage?.querySelector<HTMLButtonElement>('[data-viz-full]');
  if (!stage || !flat || !richCanvas || !menuBtn || !expandBtn || !fullBtn) throw new Error('music generator: the visualiser is missing');

  let band = storedMode(read(BAND_KEY), BAND_MODES, 'bars');
  let show = storedMode(read(SHOW_KEY), SHOW_MODES, prefersReducedMotion() ? 'bars' : 'milkdrop');
  let size: Size = 'band';
  /** Where full screen goes back to. */
  let before: Size = 'band';
  /** Full screen drawn as a layer over the page, where the browser cannot fullscreen the band. */
  let layered = false;
  let destroyed = false;
  let viz: PageViz | null = null;
  let loading: Promise<PageViz | null> | null = null;
  let peekTimer: ReturnType<typeof setTimeout> | undefined;
  const mode = (): VizMode => (size === 'band' ? band : show);

  /** MilkDrop, loaded the first time it shows. */
  const loadViz = (): Promise<PageViz | null> => {
    loading ??= import('../../lib/neurospicy-dock-host.ts')
      .then(m => { viz = m.createPageViz(d.host as Parameters<typeof m.createPageViz>[0], d.analyser); return viz; })
      .catch(() => { d.say(t('MilkDrop could not start in this browser.')); return null; });
    return loading;
  };
  async function syncRich(): Promise<void> {
    const want = mode() === 'milkdrop';
    richCanvas!.hidden = !want;
    if (!want) { viz?.unmount(); return; }
    const v = await loadViz();
    if (!v || destroyed || mode() !== 'milkdrop') return;
    await v.mount(richCanvas!);
  }

  const bins = new Uint8Array(1024);
  function frame(): void {
    const m = mode();
    const show2d = m === 'bars' || m === 'scope';
    flat!.hidden = !show2d;
    if (!show2d) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = flat!.clientWidth || 600, h = flat!.clientHeight || 100;
    if (flat!.width !== Math.round(w * dpr)) flat!.width = Math.round(w * dpr);
    if (flat!.height !== Math.round(h * dpr)) flat!.height = Math.round(h * dpr);
    const cx = flat!.getContext('2d');
    if (!cx) return;
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx.clearRect(0, 0, w, h);
    const analyser = d.analyser();
    if (!analyser || !d.playing()) return;
    cx.fillStyle = d.ink();
    cx.strokeStyle = cx.fillStyle;
    if (m === 'bars') {
      analyser.getByteFrequencyData(bins);
      const count = 64;
      for (let i = 0; i < count; i++) {
        // Bins spread on a log scale, so the bass is not one bar at the edge.
        const from = Math.floor(2 ** ((i / count) * Math.log2(bins.length / 2)));
        const v = (bins[Math.min(bins.length - 1, from)] ?? 0) / 255;
        const bw = w / count;
        cx.globalAlpha = 0.45 + v * 0.55;
        cx.fillRect(i * bw + 1, h - v * h, bw - 2, v * h);
      }
      cx.globalAlpha = 1;
    } else {
      analyser.getByteTimeDomainData(bins);
      cx.lineWidth = 2;
      cx.beginPath();
      for (let i = 0; i < bins.length; i++) {
        const x = (i / (bins.length - 1)) * w, y = ((bins[i] ?? 128) / 255) * h;
        if (i) cx.lineTo(x, y); else cx.moveTo(x, y);
      }
      cx.stroke();
    }
  }

  const setButton = (btn: HTMLButtonElement, name: IconName, label: string): void => {
    const glyph = iconNode(name);
    if (glyph) { glyph.setAttribute('width', '18'); glyph.setAttribute('height', '18'); btn.replaceChildren(glyph); }
    btn.setAttribute('aria-label', label);
    btn.title = label;
  };
  function paint(): void {
    d.page.classList.toggle('viz-off', size === 'band' && band === 'off');
    stage!.classList.toggle('is-expanded', size === 'expanded');
    stage!.classList.toggle('is-full', size === 'full');
    stage!.classList.toggle('is-layered', layered);
    expandBtn!.hidden = size === 'full';
    expandBtn!.setAttribute('aria-pressed', String(size === 'expanded'));
    setButton(expandBtn!, size === 'expanded' ? 'collapse' : 'expand', size === 'expanded' ? t('Shrink the visualiser') : t('Expand the visualiser'));
    setButton(fullBtn!, size === 'full' ? 'fullscreenExit' : 'fullscreen', size === 'full' ? t('Leave full screen') : t('Full screen'));
    frame();
    void syncRich();
  }
  function setSize(next: Size): void {
    if (next === size) return;
    menuBody.close(); menuStage.close();
    size = next;
    paint();
    if (next === 'full') peek();
    else { clearTimeout(peekTimer); stage!.classList.remove('show-bar'); }
  }

  // ── full screen ─────────────────────────────────────────────────────────────
  function enterFull(): void {
    before = size;
    if (document.fullscreenEnabled && typeof stage!.requestFullscreen === 'function') {
      stage!.requestFullscreen().catch(() => { layered = true; setSize('full'); });
    } else { layered = true; setSize('full'); }
  }
  function leaveFull(): void {
    if (document.fullscreenElement === stage) { void document.exitFullscreen(); return; }
    layered = false;
    setSize(before === 'full' ? 'band' : before);
  }
  const onFullscreen = (): void => {
    if (document.fullscreenElement === stage) setSize('full');
    else if (size === 'full' && !layered) setSize(before === 'full' ? 'band' : before);
  };
  /** Show the full-screen controls for a moment. */
  function peek(): void {
    stage!.classList.add('show-bar');
    clearTimeout(peekTimer);
    peekTimer = setTimeout(() => stage!.classList.remove('show-bar'), PEEK_MS);
  }
  const onPeek = (): void => { if (size === 'full') peek(); };
  document.addEventListener('fullscreenchange', onFullscreen);
  stage.addEventListener('pointerdown', onPeek);
  stage.addEventListener('pointermove', onPeek);
  stage.addEventListener('keydown', onPeek);

  expandBtn.addEventListener('click', () => setSize(size === 'expanded' ? 'band' : 'expanded'));
  fullBtn.addEventListener('click', () => { if (size === 'full') leaveFull(); else enterFull(); });

  // ── settings ───────────────────────────────────────────────────────────────
  /** The mode switch, and for MilkDrop its preset, a shuffle and how often the preset changes. */
  const renderMenu = (el: HTMLDivElement): HTMLElement | null => {
    const modes = (size === 'band' ? BAND_MODES : SHOW_MODES).map(id => ({ id, label: modeLabel(id) }));
    el.innerHTML = `
      <div class="ms-viz-menu">
        <span class="ms-opt-label" id="ms-viz-mode-label">${escapeHtml(size === 'band' ? t('Visualiser') : t('Visualiser in the show'))}</span>
        ${segHtml('ms-viz-mode', modes, mode(), t('Visualiser'), { attr: 'data-viz-pick', labelledBy: 'ms-viz-mode-label' })}
        <div class="ms-viz-milk" data-viz-milk${mode() === 'milkdrop' ? '' : ' hidden'}>
          <label class="ms-opt-label" for="ms-viz-preset">${escapeHtml(t('Preset'))}</label>
          <div class="ms-viz-preset-row">
            <select class="field-select field-select--sm" id="ms-viz-preset" data-viz-preset><option>${escapeHtml(t('Loading…'))}</option></select>
            <button type="button" class="btn btn--ghost btn--sm ms-icon" data-viz-shuffle aria-label="${escapeHtml(t('Shuffle the preset'))}" title="${escapeHtml(t('Shuffle the preset'))}">${shuffleIconSvg(18)}</button>
          </div>
          <label class="ms-opt-label" for="ms-viz-cycle">${escapeHtml(t('Change the preset by itself'))}</label>
          <select class="field-select field-select--sm" id="ms-viz-cycle" data-viz-cycle></select>
        </div>
      </div>`;
    void fillMilk(el);
    return el.querySelector<HTMLElement>('[data-viz-pick][aria-pressed="true"]');
  };
  /** MilkDrop's presets, grouped as the Neurospicy player groups them, and the cycle choices. */
  async function fillMilk(el: HTMLElement): Promise<void> {
    if (mode() !== 'milkdrop') return;
    const v = await loadViz();
    const presetSel = el.querySelector<HTMLSelectElement>('[data-viz-preset]');
    const cycleSel = el.querySelector<HTMLSelectElement>('[data-viz-cycle]');
    if (!v || !presetSel || !cycleSel) return;
    const presets = await v.presets();
    const groups = new Map<string, typeof presets>();
    for (const p of presets) groups.set(p.group ?? '', [...(groups.get(p.group ?? '') ?? []), p]);
    presetSel.replaceChildren(...[...groups].map(([group, list]) => {
      const set = document.createElement('optgroup');
      set.label = group || t('Presets');
      set.append(...list.map(p => new Option(p.name, p.id)));
      return set;
    }));
    presetSel.value = v.currentPreset();
    const cycles = await v.transitions();
    cycleSel.replaceChildren(...cycles.map(c => new Option(c.id === '0' ? t('Never') : tRaw('Every {n} seconds', { n: c.id }), c.id)));
    cycleSel.value = v.currentTransition();
  }
  const onMenu = (e: Event): void => {
    const target = e.target instanceof Element ? e.target : null;
    const pick = target?.closest<HTMLElement>('[data-viz-pick]');
    const box = target?.closest<HTMLElement>('.ms-viz-menu');
    if (!box) return;
    if (pick && e.type === 'click') {
      const next = (size === 'band' ? BAND_MODES : SHOW_MODES).find(m => m === pick.dataset.vizPick);
      if (!next) return;
      if (size === 'band') { band = next; keep(BAND_KEY, next); } else { show = next; keep(SHOW_KEY, next); }
      for (const b of box.querySelectorAll<HTMLElement>('[data-viz-pick]')) b.setAttribute('aria-pressed', String(b === pick));
      const milk = box.querySelector<HTMLElement>('[data-viz-milk]');
      if (milk) milk.hidden = next !== 'milkdrop';
      paint();
      void fillMilk(box);
      return;
    }
    if (target?.closest('[data-viz-shuffle]') && e.type === 'click' && viz) {
      const sel = box.querySelector<HTMLSelectElement>('[data-viz-preset]');
      const others = [...(sel?.options ?? [])].map(o => o.value).filter(id => id && id !== viz?.currentPreset());
      const next = others[Math.floor(Math.random() * others.length)];
      if (next) { viz.selectPreset(next); if (sel) sel.value = next; }
      return;
    }
    if (e.type === 'change' && target instanceof HTMLSelectElement && viz) {
      if (target.matches('[data-viz-preset]')) viz.selectPreset(target.value);
      if (target.matches('[data-viz-cycle]')) viz.selectTransition(target.value);
    }
  };
  const menuOpts = (container?: HTMLElement) => ({
    className: 'surface surface--floating ms-viz-pop', role: 'dialog', ariaLabel: t('Visualiser settings'),
    ...(container ? { container } : {}),
  });
  // In full screen only the band is drawn, so its settings open inside the band.
  const menuBody: BodyPopoverHandle = mountBodyPopover(menuBtn, renderMenu, menuOpts());
  const menuStage: BodyPopoverHandle = mountBodyPopover(menuBtn, renderMenu, menuOpts(stage));
  menuBtn.addEventListener('click', () => {
    const menu = size === 'full' ? menuStage : menuBody;
    if (menu.isOpen()) menu.close(true); else menu.open();
  });
  document.addEventListener('click', onMenu);
  document.addEventListener('change', onMenu);

  const resized = new ResizeObserver(() => { viz?.resize(); frame(); });
  resized.observe(stage);
  paint();

  return {
    frame,
    audioReady: () => { void syncRich(); },
    menuOpen: () => menuBody.isOpen() || menuStage.isOpen(),
    escape: () => {
      if (size === 'full') { leaveFull(); return true; }
      if (size === 'expanded') { setSize('band'); return true; }
      return false;
    },
    destroy: () => {
      destroyed = true;
      clearTimeout(peekTimer);
      menuBody.close(); menuStage.close();
      resized.disconnect();
      document.removeEventListener('fullscreenchange', onFullscreen);
      document.removeEventListener('click', onMenu);
      document.removeEventListener('change', onMenu);
      viz?.destroy();
    },
  };
}
