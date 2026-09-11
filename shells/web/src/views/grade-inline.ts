// SPDX-License-Identifier: MPL-2.0
/**
 * Inline still-image GRADE mode for the catalog details modal - the video
 * Grade tab's still sibling (views/video-edit-inline.ts), over a bitmap
 * instead of a paused frame. Same looks (the darkroom preset LUTs, or the
 * user's own .cube/.3dl), same engine ops (applyLutFrame + applyGrainVignette),
 * same GRAIN_SEED/GRAIN_REF_LONG_EDGE - so a still and a clip graded with the
 * same sliders read identically. Refined edits (develop sliders, HSL, film
 * looks) belong to the Darkroom tool; this mode is the quick look-and-save.
 *
 * Apply ENQUEUES and LEAVES (the WP-F rule, plans/124): the mode exits
 * immediately, a background job renders the full-resolution pixels in row
 * bands (cancellable between bands, progress in the global toast - which now
 * rides above this very modal), and `deliver` receives the finished bytes to
 * sign + save. The preview canvas grades a downscaled copy live.
 */
import { applyGrainVignette, applyLutFrame, GRAIN_REF_LONG_EDGE, parseLutText, type GradeLut } from '@lolly/engine';
import { GRAIN_SEED, PRESET_LUT_BASE, PRESET_LUTS } from './video-edit-inline.ts';
import type { LutCredit } from '../lib/video-jobs.ts';
import { startJob } from '../lib/jobs.ts';
import { escapeHtml } from '../lib/html.ts';
import { t, tRaw } from '../i18n.ts';

/** Preview long-edge cap - the video mode's value, plenty for judging a look. */
const PREVIEW_MAX_EDGE = 960;
/** Rows per cancellable band of the full-resolution LUT pass. */
const BAND_ROWS = 512;

export interface GradeSettings {
  lutLabel: string;
  lutCredit?: LutCredit;
  /** All 0..1 except grainSize (1..4). */
  intensity: number;
  grain: number;
  grainSize: number;
  vignette: number;
}

export interface GradeInlineEnv {
  /** The details modal's `.cat-details-preview` - the mode overlays it. */
  stage: HTMLElement;
  /** Decodable source URL (prepCropSource's rasterSrc - treatments already baked). */
  rasterSrc: string;
  /** Display name, for the job title. */
  name: string;
  /** Export format choices as [value, label]; the first is preselected. */
  formats: [string, string][];
  log?: (level: 'warn' | 'error', msg: string, data?: Record<string, unknown>) => void;
  /** Sign + save the finished bytes (runs INSIDE the background job). */
  deliver: (blob: Blob, format: string, grade: GradeSettings) => Promise<void>;
  /** The mode ended (cancelled, or exited after enqueueing). Idempotent caller. */
  onDone: () => void;
}

export interface GradeInlineHandle { exit(): void }

export async function mountInlineGrade(env: GradeInlineEnv): Promise<GradeInlineHandle> {
  // Decode first: a source that won't load must fail the entry, not mount a dead mode.
  const img = new Image();
  img.decoding = 'async';
  img.src = env.rasterSrc;
  await img.decode();

  const ac = new AbortController();
  const { signal } = ac;
  let exited = false;
  let lut: GradeLut | null = null;
  let lutLabel = '';
  let lutCredit: LutCredit | undefined;
  let lutState: 'none' | 'loading' | 'ready' | 'error' = 'none';
  let previewBlocked = false;

  const sliderRow = (id: string, label: string, min: number, max: number, step: number, value: number, unit: string): string => `
    <label class="cat-vid-slider">
      <span class="cat-vid-slider-label">${escapeHtml(label)}</span>
      <input type="range" data-${escapeHtml(id)} min="${min}" max="${max}" step="${step}" value="${value}">
      <output data-out-${escapeHtml(id)}>${value}${escapeHtml(unit)}</output>
    </label>`;

  const work = document.createElement('div');
  work.className = 'cat-vid-work cat-grade-work';
  work.innerHTML = `
    <div class="cat-mode-bar">
      <div class="cat-dl-fmt cat-crop-fmt" role="radiogroup" aria-label="${escapeHtml(t('Format'))}">${env.formats.map(([v, l], i) =>
        `<label class="field-toggle"><input type="radio" class="field-radio" name="cat-grade-fmt" value="${escapeHtml(v)}"${i === 0 ? ' checked' : ''}> ${escapeHtml(l)}</label>`).join('')}</div>
      <span class="cat-mode-bar-actions">
        <button type="button" class="btn" data-cancel>${escapeHtml(t('Cancel'))}</button>
        <button type="button" class="btn modal-primary" data-apply>${escapeHtml(t('Save to catalog'))}</button>
      </span>
    </div>
    <div class="cat-vid-body">
      <div class="cat-vid-viewport" data-viewport>
        <canvas class="cat-grade-canvas" data-canvas></canvas>
      </div>
      <div class="cat-vid-panel">
        <label class="cat-vid-field">
          <span class="cat-vid-slider-label">${escapeHtml(t('Look'))}</span>
          <select data-look>
            <option value="">${escapeHtml(t('None (adjustments only)'))}</option>
            ${PRESET_LUTS.map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(t(p.label))}</option>`).join('')}
          </select>
        </label>
        <label class="cat-vid-field">
          <span class="cat-vid-slider-label">${escapeHtml(t('Your LUT'))}</span>
          <input type="file" data-lutfile accept=".cube,.3dl">
        </label>
        ${sliderRow('intensity', t('Intensity'), 0, 100, 1, 100, '%')}
        ${sliderRow('grain', t('Grain'), 0, 100, 1, 0, '%')}
        ${sliderRow('grainsize', t('Grain size'), 1, 4, 0.1, 1.6, '')}
        ${sliderRow('vignette', t('Vignette'), 0, 100, 1, 0, '%')}
      </div>
      <p class="cat-vid-error" data-error hidden></p>
    </div>`;
  env.stage.appendChild(work);

  const q = <T extends HTMLElement>(sel: string): T => work.querySelector<T>(sel)!;
  const canvas = q<HTMLCanvasElement>('[data-canvas]');
  const applyBtn = q<HTMLButtonElement>('[data-apply]');
  const lookSel = q<HTMLSelectElement>('[data-look]');
  const lutFileEl = q<HTMLInputElement>('[data-lutfile]');
  const errEl = q<HTMLElement>('[data-error]');

  const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));
  const num = (id: string): number => parseFloat(q<HTMLInputElement>(`[data-${id}]`).value) || 0;
  const fmt = (): string => work.querySelector<HTMLInputElement>('input[name="cat-grade-fmt"]:checked')?.value ?? env.formats[0]![0];

  const showError = (msg: string): void => { errEl.textContent = msg; errEl.hidden = false; };
  const clearError = (): void => { errEl.hidden = true; errEl.textContent = ''; };

  const settings = (): GradeSettings => ({
    lutLabel,
    lutCredit,
    intensity: clamp(num('intensity') / 100, 0, 1),
    grain: clamp(num('grain') / 100, 0, 1),
    grainSize: clamp(num('grainsize'), 1, 4),
    vignette: clamp(num('vignette') / 100, 0, 1),
  });

  // A grade with no ready look and no grain/vignette would re-save the image to
  // say nothing; a look mid-load or failed must not apply as silence either -
  // the video mode's neutralGrade/lookUnusable rule.
  const syncButtons = (): void => {
    const neutral = lutState !== 'ready' && num('grain') === 0 && num('vignette') === 0;
    applyBtn.disabled = neutral || lutState === 'loading' || lutState === 'error';
  };

  // ── Live preview - the engine's own ops on a downscaled copy ───────────────
  let paintQueued = 0;
  const paint = (): void => {
    if (exited || previewBlocked) return;
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const scale = Math.min(1, PREVIEW_MAX_EDGE / Math.max(iw, ih));
    const w = Math.max(1, Math.round(iw * scale));
    const h = Math.max(1, Math.round(ih * scale));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    const g = settings();
    try {
      ctx.drawImage(img, 0, 0, w, h);
      const frame = ctx.getImageData(0, 0, w, h);
      if (lut && g.intensity > 0) applyLutFrame(frame.data, lut, g.intensity);
      // GRAIN_REF_LONG_EDGE keeps the preview honest about grain: the cell size is
      // a fraction of the PICTURE, so this downscaled paint and the full render
      // draw the same lattice (the video mode's rule).
      if (g.grain > 0 || g.vignette > 0) {
        applyGrainVignette(frame.data, w, h, { grain: g.grain, grainSize: g.grainSize, vignette: g.vignette, seed: GRAIN_SEED }, 0, GRAIN_REF_LONG_EDGE);
      }
      ctx.putImageData(frame, 0, 0);
    } catch (e) {
      // A cross-origin source taints the canvas: no preview AND no render (the
      // render reads the same pixels here, unlike video's off-thread job).
      previewBlocked = true;
      applyBtn.disabled = true;
      env.log?.('warn', 'Grade preview unavailable', { error: String(e) });
      showError(t('This image cannot be read for grading in this browser.'));
    }
  };
  const schedulePaint = (): void => {
    if (paintQueued) return;
    paintQueued = requestAnimationFrame(() => { paintQueued = 0; paint(); });
  };

  // ── Look selection (the video mode's pattern) ──────────────────────────────
  const adoptLut = (text: string, label: string, name?: string, credit?: LutCredit): void => {
    try {
      lut = parseLutText(text, name);
      lutLabel = label;
      lutCredit = credit;
      lutState = 'ready';
      clearError();
    } catch {
      lut = null;
      lutLabel = '';
      lutCredit = undefined;
      lutState = 'error';
      showError(t("Couldn't read that file."));
    }
    syncButtons();
    schedulePaint();
  };

  lookSel.addEventListener('change', () => {
    const id = lookSel.value;
    lutFileEl.value = '';
    if (!id) {
      lut = null; lutLabel = ''; lutCredit = undefined; lutState = 'none';
      clearError(); syncButtons(); schedulePaint();
      return;
    }
    const preset = PRESET_LUTS.find(p => p.id === id);
    if (!preset) return;   // the select's own whitelist; never fetch an unknown id
    lutState = 'loading';
    syncButtons();
    void fetch(`${PRESET_LUT_BASE}${preset.id}.cube`, { signal })
      .then(res => (res.ok ? res.text() : Promise.reject(new Error(String(res.status)))))
      .then(text => { if (!exited && lookSel.value === preset.id) adoptLut(text, t(preset.label), `${preset.id}.cube`, preset.credit); })
      .catch((e) => {
        if (exited || (e as Error)?.name === 'AbortError') return;
        lut = null; lutCredit = undefined; lutState = 'error';
        showError(t("Couldn't load that look."));
        syncButtons();
      });
  }, { signal });

  lutFileEl.addEventListener('change', () => {
    const file = lutFileEl.files?.[0];
    if (!file) return;
    lookSel.value = '';
    lutState = 'loading';
    syncButtons();
    const reader = new FileReader();
    reader.onload = () => { if (!exited) adoptLut(String(reader.result ?? ''), file.name, file.name); };
    reader.onerror = () => {
      if (exited) return;
      lutState = 'error';
      showError(t("Couldn't read that file."));
      syncButtons();
    };
    reader.readAsText(file);
  }, { signal });

  for (const id of ['intensity', 'grain', 'grainsize', 'vignette']) {
    q<HTMLInputElement>(`[data-${id}]`).addEventListener('input', () => {
      const unit = id === 'grainsize' ? '' : '%';
      q<HTMLElement>(`[data-out-${id}]`).textContent = `${num(id)}${unit}`;
      syncButtons();
      schedulePaint();
    }, { signal });
  }

  const exit = (): void => {
    if (exited) return;
    exited = true;
    ac.abort();
    if (paintQueued) cancelAnimationFrame(paintQueued);
    work.remove();
    env.onDone();
  };

  q<HTMLButtonElement>('[data-cancel]').addEventListener('click', exit, { signal });

  // ── Apply: enqueue the full-resolution render as a background job, and leave ─
  q<HTMLButtonElement>('[data-apply]').addEventListener('click', () => {
    if (applyBtn.disabled) return;
    const g = settings();
    const format = fmt();
    const mime = format === 'jpg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
    exit();

    const job = startJob({
      // No model runs - a pixel loop must never hold the heavy inference slot.
      heavy: false,
      title: tRaw('Grading {name}', { name: env.name }),
      cancel: () => { /* cooperative - the band loop polls job.cancelled */ },
    });
    void (async () => {
      try {
        await job.started;
        if (job.cancelled) return;
        const w = img.naturalWidth, h = img.naturalHeight;
        const full = document.createElement('canvas');
        full.width = w; full.height = h;
        const ctx = full.getContext('2d', { willReadFrequently: true });
        if (!ctx) throw new Error('no 2d context');
        ctx.drawImage(img, 0, 0);
        const frame = ctx.getImageData(0, 0, w, h);
        if (lut && g.intensity > 0) {
          // Row bands: applyLutFrame is per-pixel, so a subarray of whole rows is
          // a valid frame slice - this is what makes a 50-megapixel grade yield
          // between bands (progress ticks, cancel lands) instead of freezing the tab.
          for (let y0 = 0; y0 < h; y0 += BAND_ROWS) {
            if (job.cancelled) return;
            const y1 = Math.min(h, y0 + BAND_ROWS);
            applyLutFrame(frame.data.subarray(y0 * w * 4, y1 * w * 4), lut, g.intensity);
            job.progress(y1, h);
            await new Promise(r => setTimeout(r, 0));
          }
        }
        if (job.cancelled) return;
        // Vignette needs whole-frame geometry, so it runs in one (fast) pass.
        if (g.grain > 0 || g.vignette > 0) {
          applyGrainVignette(frame.data, w, h, { grain: g.grain, grainSize: g.grainSize, vignette: g.vignette, seed: GRAIN_SEED }, 0, GRAIN_REF_LONG_EDGE);
        }
        ctx.putImageData(frame, 0, 0);
        const blob = await new Promise<Blob | null>(resolve => { full.toBlob(resolve, mime, mime === 'image/png' ? undefined : 0.92); });
        if (!blob) throw new Error('encode failed');
        if (job.cancelled) return;
        await env.deliver(blob, format, g);
        job.finish();
      } catch (err) {
        env.log?.('error', 'Grade render failed', { error: String(err) });
        job.fail(err);
      }
    })();
  }, { signal });

  syncButtons();
  schedulePaint();
  return { exit };
}
