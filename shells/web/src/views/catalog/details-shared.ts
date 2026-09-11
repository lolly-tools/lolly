// SPDX-License-Identifier: MPL-2.0
/**
 * Module-level declarations of details.ts that its feature modules use: the types,
 * constants and pure helpers that used to sit above openDetails(). Moved here verbatim so
 * no feature module has to import the orchestrator file. The catalog's details sheet for one asset (a second-level split of views/catalog/details.ts).
 */
import { escape as escapeText } from '../../utils.ts';
import type { VizHandle } from '../../lib/butterchurn-viz.ts';
import { t } from '../../i18n.ts';
import { assetBaseId } from '../../lib/asset-favourites.ts';
import { audioThumbPlaceholder, audioThumbSvg } from '../../lib/audio-thumb.ts';
import { memoPeaks } from '../../lib/audio-peaks.ts';
import { createVizCycle } from '../../lib/viz-cycle.ts';
import { isVizCover, resolveAudioLook, saveAudioCover, vizPresetOf } from '../../lib/audio-covers.ts';
import type { AudioCover } from '../../lib/audio-covers.ts';
import type { AssetRef } from '@lolly-tools/core/host-v1';
import type { CatCtx } from './context.ts';

/**
 * The audio surface's escalation ladder: bars analyser → visualiser → immersive, with
 * "use as cover" as the commit at any rung.
 *
 * Deliberately NOT a swatch picker. The thing a user wants to say is "keep what I am
 * looking at", so the chooser IS the viewer - you audition the track, flip through
 * looks while it plays, and pin the one you like. That also means there is nothing
 * extra to learn: it is the Neurospicy player's interaction, in the place where you
 * are already listening to the file.
 *
 * MilkDrop needs its audio INJECTED (per-frame time-domain windows), so the wave
 * payload is decoded once, lazily, only when someone actually opens the visualiser - 
 * a details modal is a deliberate act, unlike a grid of tiles.
 */
/**
 * The audio stage: an ANALYSER, or a live MilkDrop visualiser. Tap the picture to
 * swap between them - the Neurospicy player's interaction, in the place you are
 * already listening.
 *
 * The drawn waveform shapes are deliberately NOT offered here. They are the GRID's
 * job - the free, always-available default every tile falls back to - and carrying
 * them into this surface as extra rungs bought nothing but bugs: two rendering paths
 * sharing one box, one live and one static, each with its own sizing and teardown.
 * One live surface, one still one, and nothing in between.
 *
 * "Use as cover" SNAPSHOTS THE CURRENT FRAME. Not a re-render, not a deterministic
 * bake from the preset id - the pixels on screen at the moment of the click. That is
 * what the user is looking at and pointing at, and any re-render is a different frame
 * of a feedback simulation, i.e. a different picture. The preset and colour ride along
 * so the cover can still be re-made later, but the image is what was seen.
 */
export function wireAudioViz(cat: CatCtx, dlg: HTMLElement, ref: AssetRef, meterHandle: import('../../lib/audio-meter.ts').MeterHandle | null): void {
  const stage = dlg.querySelector<HTMLElement>('[data-audio-stage]');
  const toggle = dlg.querySelector<HTMLButtonElement>('[data-viz-toggle]');
  const vizEl = dlg.querySelector<HTMLElement>('[data-audio-viz]');
  const bar = dlg.querySelector<HTMLElement>('[data-audio-vizbar]');
  const nameEl = dlg.querySelector<HTMLElement>('[data-viz-name]');
  if (!stage || !toggle || !vizEl || !bar) return;

  let presets: Array<{ id: string; label: string; luma?: number }> = [];
  let at = 0;
  let open = false;
  // The full handle, not just `destroy`: applyPreset needs setPreset/setRawPreset and
  // the live palette to wrap an artist preset with.
  let handle: VizHandle | null = null;
  let canvas: HTMLCanvasElement | null = null;
  // Which brand colour the visualiser is wearing. Shuffled independently of the preset,
  // so form and colour are two dials rather than one.
  let colourAt = cat.coverMap.get(assetBaseId(ref.id))?.colour ?? 0;

  /** The colour the visualiser is currently "about" - the 🎨 dial's value. */
  const heroNow = (): string | null =>
    cat.coverPool.length ? cat.coverPool[colourAt % cat.coverPool.length]! : null;

  const label = (): void => {
    if (!nameEl) return;
    nameEl.textContent = presets.length ? `${presets[at]!.label}  ·  ${at + 1}/${presets.length}` : '';
  };

  /** Mount (or re-mount) the live visualiser on the current preset + colour. */
  /**
   * Put `id` on `h`: our own presets by id, artist presets by fetching the JSON and
   * wrapping it with the brand blend. Mirrors the dock host's applyStockPreset - same
   * fallback, so a clone without the staged pack still shows a working visualiser
   * rather than a black square.
   */
  const applyPreset = async (h: NonNullable<typeof handle>, id: string): Promise<void> => {
    if (!id.startsWith('stock:')) { h.setPreset(id); return; }
    const { loadStockPreset } = await import('../../lib/viz-stock.ts');
    const { vizPresetById } = await import('../../lib/viz-presets.ts');
    const preset = await loadStockPreset(id.slice(6), h.palette(), 'strong');
    // The modal can have been closed or the preset stepped past during that fetch.
    if (handle !== h) return;
    if (!preset) { h.setPreset(vizPresetById(null).id); return; }
    h.setRawPreset(id, preset);
  };

  const mountLive = async (): Promise<void> => {
    if (!presets.length) return;
    handle?.destroy(); handle = null;
    canvas = document.createElement('canvas');
    canvas.className = 'cat-viz-canvas';
    vizEl.replaceChildren(canvas);
    // Device pixels: butterchurn renders to exactly the size it is told, so a mismatch
    // between the buffer and the element puts the picture in a corner.
    const box = vizEl.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(box.width * dpr));
    canvas.height = Math.max(1, Math.round(box.height * dpr));
    const [{ mountViz }, { buildVizPalette }] = await Promise.all([
      import('../../lib/butterchurn-viz.ts'),
      import('../../lib/viz-palette.ts'),
    ]);
    // The SAME AnalyserNode the meter owns - an <audio> element can only ever produce
    // one MediaElementSource and can never lose it, so a second would throw and leave
    // the preview silent.
    //
    // But the meter only BUILDS its analyser on first play, so flipping to the
    // visualiser before pressing play left `analyser` null, and mountViz refuses that
    // (`!analyser && !inject`) - it returned null and the canvas was replaced by a
    // glyph. Hence the fallback: with no live signal, inject SILENCE so the preset
    // still mounts and draws its idle field. A visualiser that shows nothing until you
    // happen to press play looks broken; one that is calm until the music starts does
    // not.
    const live = meterHandle?.analyser() ?? null;
    const silence = new Uint8Array(1024).fill(128);   // 128 = zero amplitude
    // Pass the chosen colour as an EXPLICIT hero hint rather than shuffling it to the
    // front of the values. Without a hint, buildVizPalette re-derives a hero from the
    // swatches - and that is the documented navy-field trap: SUSE's pine sits a
    // thousandth under the chroma gate that keeps greys out, so it is dismissed and the
    // most-chromatic swatch (waterhole blue) wins, rendering the whole field navy. The
    // hint IS what the 🎨 dial means: "make it about this colour".
    handle = await mountViz(canvas, undefined, presets[at]!.id, undefined, buildVizPalette(cat.coverPool, heroNow()), {
      audio: live ? { analyser: live } : { frame: () => ({ wave: silence, seed: 0 }) },
      // preserveDrawingBuffer, so "use as cover" can read the frame that is on screen.
      // Without it toBlob returns an empty buffer.
      capture: true,
    });
    if (!handle) { vizEl.innerHTML = audioThumbPlaceholder({}); label(); return; }
    // An ARTIST preset is not in our registry, so it cannot be mounted by id: mountViz
    // resolves through vizPresetById, which falls back to VIZ_PRESETS[0] for anything it
    // does not recognise. That fallback is silent and it is total - every one of the 435
    // artist presets rendered as the same brand-native preset, the label happily naming
    // a different one each time. It reads exactly like "the shuffle does nothing and it
    // is always the same dim picture", with no error to follow. Artist presets have to
    // be FETCHED and handed over as objects, the way the dock does it.
    await applyPreset(handle, presets[at]!.id);
    label();
  };

  const show = async (on: boolean): Promise<void> => {
    // Load BEFORE painting anything. Painting first is what broke the toggle: with no
    // presets yet, the label/mount path dereferenced an empty list and threw, so the
    // click handler died and the surface never flipped.
    if (on && !presets.length) await loadPresets();
    if (on && !presets.length) {
      // Say so. Returning quietly here is exactly what made the toggle, the shuffle,
      // the palette and "use as cover" all appear broken at once - one silent gate,
      // four dead controls, no way to tell which.
      const note = dlg.querySelector<HTMLElement>('.cat-audio-note');
      if (note) {
        note.textContent = t('The visualiser needs WebGL2, which this browser isn’t providing.');
        note.hidden = false;
      }
      return;
    }

    open = on;
    vizEl.hidden = !on;
    bar.hidden = !on;
    toggle.setAttribute('aria-pressed', String(on));
    toggle.textContent = on ? t('Analyser') : t('Visualiser');
    const meter = meterElOf(cat, dlg);
    if (meter) meter.hidden = on;
    if (!on) { cycle.stop(); handle?.destroy(); handle = null; return; }
    pickOpening();
    // Start the track. The flip is a user gesture, so autoplay policy allows it, and
    // it is also what builds the meter's analyser - which the visualiser then shares.
    const audioEl = audioElOf(cat, dlg);
    if (audioEl?.paused) {
      try {
        await audioEl.play();
        // The analyser is created inside the meter's own 'play' handler, so yield once
        // and let it land before mounting; otherwise we mount against silence and stay
        // there until the next re-mount.
        await new Promise(r => setTimeout(r, 60));
      } catch { /* blocked or unplayable - mount against silence below */ }
    }
    await mountLive();
    cycle.start();
  };

  /** The presets on offer: ours first (brand-native, eval-free), then every artist
   *  preset VERIFIED to render - the 31 measured black or blown-out are excluded, since
   *  one of those as cover art reads as a broken app. */
  const loadPresets = async (): Promise<void> => {
    const { canBakeViz } = await import('../../lib/audio-cover-viz.ts');
    if (!canBakeViz()) return;
    const [{ VIZ_PRESETS }, { stockPresetIndex }] = await Promise.all([
      import('../../lib/viz-presets.ts'),
      import('../../lib/viz-stock.ts'),
    ]);
    // Lead with a preset that READS on a card. The GPU audit measured our own set's
    // mean luminance - bloom 56, aurora 49, vortex 34, kaleido 11, pulse 9 - so opening
    // on `pulse` (the declaration order) hands someone a near-black picture and looks
    // broken. The audiogram's default was moved for the same reason.
    const OPENERS = ['bloom', 'aurora', 'vortex', 'solar'];
    // Our own presets are all comfortably readable (the GPU audit put the dimmest,
    // `pulse`, at 9 - but it is excluded from OPENERS for exactly that reason), so they
    // carry no luma and count as openable.
    const own = VIZ_PRESETS.map(d => ({ id: d.id, label: d.name, luma: undefined as number | undefined }));
    own.sort((a, b) => {
      const ia = OPENERS.indexOf(a.id), ib = OPENERS.indexOf(b.id);
      return (ia < 0 ? OPENERS.length : ia) - (ib < 0 ? OPENERS.length : ib);
    });
    presets = own;
    const stock = (await stockPresetIndex().catch(() => []))
      .filter(p => p.ok !== false)
      .sort((a, b) => (a.tier ?? 9) - (b.tier ?? 9));
    for (const p of stock) {
      // Don't repeat the author when the converted NAME already carries it - a handful
      // of preset filenames have no " - " separator, so the whole string stayed in
      // `name` and appending the author again gave "X Trail_of_darkness · X".
      const dupe = p.author && p.name.toLowerCase().startsWith(p.author.toLowerCase());
      presets.push({
        id: `stock:${p.id}`,
        label: p.author && !dupe ? `${p.name} · ${p.author}` : p.name,
        luma: p.luma,
      });
    }
    // (The opening preset is chosen per FLIP, in pickOpening - not here. Choosing it at
    // load time meant only the first flip was ever random, because the list is loaded
    // once and every later flip reused wherever `at` had been left.)
  };

  /**
   * Where a flip-in arrives: RANDOM every time, so the range actually gets seen. With 435
   * presets, opening on the same one is the difference between a pack and a picture.
   *
   * But random over ALL of them is not the same as a good first impression. A fifth of
   * the presets measure under READABLE_LUMA - sparse wireframes on black, which are
   * fine once chosen and read as "it didn't start" when handed to you unasked. So the
   * OPENING draw is restricted to the ones that read, while ‹ › and the dice still
   * traverse everything: this weights the default, it does not hide anything.
   *
   * A saved cover wins over both, because that is a deliberate choice, not a default - 
   * including a dim one, which someone is perfectly entitled to have picked.
   */
  const READABLE_LUMA = 25;
  const pickOpening = (): void => {
    if (!presets.length) return;
    const saved = vizPresetOf(cat.coverMap.get(assetBaseId(ref.id)));
    if (saved) {
      const i = presets.findIndex(p => p.id === saved || p.id === `stock:${saved}`);
      if (i >= 0) { at = i; return; }
    }
    // Unmeasured counts as readable - absence of a measurement is not evidence of a
    // dark preset, and an index staged before luma existed must not empty this pool.
    const bright: number[] = [];
    for (let i = 0; i < presets.length; i++) {
      const l = presets[i]!.luma;
      if (l === undefined || l >= READABLE_LUMA) bright.push(i);
    }
    const pool = bright.length ? bright : presets.map((_, i) => i);
    at = pool[Math.floor(Math.random() * pool.length)]!;
  };

  const step = (delta: number): void => {
    if (!presets.length) return;
    at = (at + delta + presets.length) % presets.length;
    cycle.kick();
    void mountLive();
  };

  const cycle = createVizCycle({
    // Only while the visualiser is on screen and the track is playing: a paused preview
    // is a still field, so rotating it just churns the GPU.
    shouldRun: () => open && !audioElOf(cat, dlg)?.paused,
    onTick: () => step(1),
  });
  cat.vizCycleStop = () => cycle.stop();

  const flip = (): void => { void show(!open); };
  toggle.addEventListener('click', flip);
  meterElOf(cat, dlg)?.addEventListener('click', flip);
  meterElOf(cat, dlg)?.addEventListener('keydown', (e) => {
    const k = (e as KeyboardEvent).key;
    if (k === 'Enter' || k === ' ') { e.preventDefault(); flip(); }
  });
  vizEl.addEventListener('click', flip);

  dlg.querySelector('[data-viz-prev]')?.addEventListener('click', (e) => { e.stopPropagation(); step(-1); });
  dlg.querySelector('[data-viz-next]')?.addEventListener('click', (e) => { e.stopPropagation(); step(1); });
  dlg.querySelector('[data-viz-shuffle]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    // Random, not next: with hundreds of presets, stepping is a poor way to discover.
    if (presets.length > 1) { let n = at; while (n === at) n = Math.floor(Math.random() * presets.length); at = n; }
    cycle.kick();
    void mountLive();
  });
  dlg.querySelector('[data-viz-colour-shuffle]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    // Colour is its OWN dial: shuffling it keeps the preset you are enjoying and only
    // re-skins it, which is the whole reason the two are separate controls.
    if (cat.coverPool.length > 1) colourAt = (colourAt + 1) % cat.coverPool.length;
    void mountLive();
  });

  dlg.querySelector('[data-viz-cover]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    void snapCover();
  });

  /**
   * Freeze the frame currently on screen and keep it as this asset's cover.
   *
   * Reads the LIVE canvas rather than re-rendering: MilkDrop is a feedback simulation,
   * so a re-render is a different frame - the user pointed at THIS picture, and any
   * other one would be a substitution they did not ask for.
   */
  const snapCover = async (): Promise<void> => {
    if (!canvas || !presets.length) return;
    const blob = await new Promise<Blob | null>(res => canvas!.toBlob(res, 'image/webp', 0.92));
    if (!blob) return;
    // The BARE id, with no `stock:` prefix - the one canonical form. The stored cover
    // has always been bare (vizPresetOf strips it), and the grid looks its bake up with
    // that same bare id, so keying the bake by the prefixed id wrote a record nothing
    // ever read: every artist cover baked correctly and then showed as an empty tile.
    const preset = presets[at]!.id.replace(/^stock:/, '');
    const base = assetBaseId(ref.id);
    const { bakeKey, brandKeyFor, putBake, dropBakes } = await import('../../lib/audio-cover-bake.ts');
    // Clear any earlier frame, then record the RECIPE, and only then write the pixels.
    // Order matters: setAudioCover clears bakes for a non-viz cover, so writing the
    // image before it would delete the frame just captured.
    await dropBakes(base).catch(() => {});
    await setAudioCover(cat, ref.id, { shape: `viz:${preset}`, colour: colourAt });
    await putBake(bakeKey(base, preset, brandKeyFor(cat.coverPool)), blob).catch(() => {});
    if (nameEl) nameEl.dataset.pinned = 'true';
    // Reflect it on the tile behind the modal straight away.
    if (cat.mounted) cat.sections.mountAudioThumbGrid();
  };

  // Escape steps DOWN one rung rather than closing everything: immersive → inline →
  // (the modal's own handler) closed.
  const onEsc = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape') return;
    if (stage.classList.contains('is-immersive')) {
      e.stopPropagation(); e.preventDefault();
      stage.classList.remove('is-immersive');
      void mountLive();
    } else if (open) {
      e.stopPropagation(); e.preventDefault();
      void show(false);
    }
  };
  dlg.addEventListener('keydown', onEsc, true);

  dlg.querySelector('[data-viz-immerse]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    stage.classList.toggle('is-immersive');
    // Re-mount at the new size: the buffer dimensions are fixed at mount, so a resized
    // surface keeps rendering at the old resolution in a corner otherwise.
    void mountLive();
  });

  // The GL context must not outlive the modal - contexts are the scarce resource here.
  cat.vizTeardown = () => {
    dlg.removeEventListener('keydown', onEsc, true);
    cycle.stop();
    handle?.destroy(); handle = null;
  };
}
/**
 * An audio asset's card art - its cover if it has one, else the generated waveform.
 * Used by the GRID tiles and the favourites strip, which still want a still image;
 * the details view has its own live surface and does not use this.
 *
 * Synchronous, so it draws from peaks already in memory and falls back to the honest
 * glyph. It never starts a decode: the strip can hold every favourite at once.
 */
export function audioCardArt(cat: CatCtx, ref: AssetRef): string {
  const look = resolveAudioLook(ref.id, cat.coverPool, cat.coverMap);
  const peaks = memoPeaks(ref.id);
  const svg = peaks
    ? audioThumbSvg(peaks, { shape: look.shape, label: String(ref.meta?.name ?? ref.id) })
    : audioThumbPlaceholder({});
  return look.ink ? `<span class="cat-strip-art" style="color:${escapeText(look.ink.hex)}">${svg}</span>` : svg;
}
export function audioElOf(_cat: CatCtx, dlg: HTMLElement): HTMLAudioElement | null {
  return dlg.querySelector<HTMLAudioElement>('[data-audio-preview]');
}
export function meterElOf(_cat: CatCtx, dlg: HTMLElement): HTMLCanvasElement | null {
  return dlg.querySelector<HTMLCanvasElement>('[data-audio-meter]');
}
/** Pin (or clear) an asset's cover, then reflect it everywhere it shows. */
export async function setAudioCover(cat: CatCtx, id: string, cover: AudioCover | null): Promise<void> {
  const { host } = cat;
  const base = assetBaseId(id);
  if (cover) cat.coverMap.set(base, cover); else cat.coverMap.delete(base);
  if (cat.profile) await saveAudioCover(host, cat.profile, id, cover);
  // Drop stale pixels ONLY when they can no longer be right: the cover was cleared, or
  // it is no longer a MilkDrop one. It must NOT drop for a viz cover - snapCover writes
  // the bake around this call, and dropping here deleted the frame the user had just
  // chosen, which is why "use as cover" appeared to do nothing.
  if (!cover || !isVizCover(cover)) {
    const { dropBakes } = await import('../../lib/audio-cover-bake.ts');
    await dropBakes(base).catch(() => {});
  }
  // Re-mount the grid's waveform upgrader so the new look ends up on the tile
  // immediately. It destroys and rebuilds, which is what a changed cover needs, and
  // is cheap: peaks are already cached, so nothing re-decodes.
  if (cat.mounted) cat.sections.mountAudioThumbGrid();
}
