// SPDX-License-Identifier: MPL-2.0
/**
 * catalog: the details sheet for one brand swatch.
 *
 * A swatch opens the way every other asset does: the same modal, the colour as
 * the preview, prev/next paging, and the inspector dock with its folding
 * section cards. The sections are the Colour Lab's (#/lab) report cut down to
 * one colour you did not choose to edit: the values linked to the token (its
 * CMYK build, spot ink and authored faces), every notation with a copy button,
 * the chart that plots it, its tones, and its readability.
 *
 * The colour is the token as AUTHORED (`token.css`) whenever it carries one,
 * not the sRGB hex the palette paints with, so a Display-P3 brand colour is
 * described and painted as itself. Every paint sets the hex first and the
 * authored value second, so a display that cannot reach it falls back.
 *
 * Every function takes the shared `cat: CatCtx` first (see context.ts).
 */
import {
  apcaVerdict, contrastRatio, describeColor, formatOklch, oklchToHex, rampOklab, wcagLevel,
  APCA_SRGB_ONLY,
} from '@lolly/engine';
import type { GamutName, SlicePlane } from '@lolly/engine';
import { t, tRaw } from '../../i18n.ts';
import { escape as escapeText } from '../../utils.ts';
import { announce } from '../../a11y.ts';
import { mountModal } from '../../components/modal.ts';
import { mountAssetInspectorDock } from '../../components/asset-inspector-dock.ts';
import { copyText } from '../../lib/copy-text.ts';
import { icon } from '../../lib/icons.ts';
import { segHtml } from '../../lib/seg.ts';
import { playSfx } from '../../lib/sfx.ts';
import { replaceRouteUrl } from '../../lib/url-state.ts';
import { appPathname } from '../../lib/any-site.ts';
import { cmykText, paletteInDisplayOrder, swatchFacts, swatchFill as fill } from '../../lib/swatches.ts';
import type { SwatchFacts } from '../../lib/swatches.ts';
import { GAMUT_BLURB, GAMUT_TITLE, PLANE_TITLE, PLANE_WHY } from '../../lib/colour-words.ts';
import { swatchInk } from '../../brand-vars.ts';
import { CHEVRON_LEFT, CHEVRON_RIGHT, DOWNLOAD_ICON, SHARE_ICON, STAR_ICON } from './shared.ts';
import { bindOp, type CatCtx } from './context.ts';
import '../../lib/oklch-slice.css';
import './swatch-details.css';

type Limit = Exclude<GamutName, 'none'>;

const PLANES: SlicePlane[] = ['lc', 'ch', 'lh'];
/** Short enough for three buttons in a narrow sidebar; the caption under the
 *  chart gives the plane its full name. */
const PLANE_SHORT: Record<SlicePlane, string> = { lc: 'L × C', ch: 'C × H', lh: 'L × H' };
const LIMITS: Limit[] = ['srgb', 'p3', 'rec2020'];
const TONE_STEPS = 9;

/** The chart's plane and gamut, kept while the view is mounted so paging from
 *  one swatch to the next compares them on the same chart. Rec.2020 by default,
 *  the Colour Lab's default. */
const chart: { plane: SlicePlane; limit: Limit } = { plane: 'lc', limit: 'rec2020' };


const copyButton = (value: string, label = value): string =>
  `<button type="button" class="cat-swatch-copy" data-swatch-copy="${escapeText(value)}"
    aria-label="${escapeText(tRaw('Copy {v}', { v: label }))}" data-tip="${escapeText(t('Copy'))}">${icon('clipboard', { size: 15 })}</button>`;

const row = (label: string, value: string, copy?: string): string =>
  `<div><dt>${escapeText(label)}</dt><dd><span class="cat-swatch-val">${value}</span>${copy ? copyButton(copy) : ''}</dd></div>`;

// ── Sections ──────────────────────────────────────────────────────────────────

/** The faces a brand authored, labelled by target. Ink faces are percentages. */
function faceRows(faces: Record<string, string | number[]> | undefined): string {
  if (!faces) return '';
  return Object.entries(faces).map(([target, value]) => {
    const text = Array.isArray(value) ? `cmyk(${value.map(n => `${Math.round(n)}%`).join(' ')})` : value;
    const intent = target.startsWith('icc:') ? target.split(':')[2] : '';
    const label = target.startsWith('icc:')
      ? tRaw('Press profile ({intent})', { intent: intent || t('default') })
      : target === 'srgb' ? 'sRGB' : target === 'display-p3' ? 'Display-P3' : target === 'rec2020' ? 'Rec.2020' : target;
    return row(tRaw('Authored for {target}', { target: label }), `<code>${escapeText(text)}</code>`, text);
  }).join('');
}

/** CMYK build, spot ink and finish, authored faces, and the token itself. */
export function linkedHtml(f: SwatchFacts): string {
  const { entry } = f;
  const rows: string[] = [];
  if (Array.isArray(entry.cmyk)) {
    rows.push(row(t('CMYK'), `<code>${escapeText(cmykText(entry.cmyk))}</code>`, entry.cmyk.join(', ')));
  } else if (f.desc) {
    rows.push(row(t('CMYK'), `<span class="cat-swatch-muted">${escapeText(t('Not set. CMYK PDF exports use the generic RGB to CMYK conversion.'))}</span>`));
  }
  if (entry.spot) {
    const book = entry.spot.book ? ` <span class="cat-swatch-muted">${escapeText(entry.spot.book)}</span>` : '';
    rows.push(row(entry.spot.finish ? t('Finish') : t('Spot ink'), `${escapeText(entry.spot.name)}${book}`, entry.spot.name));
    if (entry.spot.finish) rows.push(row(t('Applied as'), escapeText(String(entry.spot.finish))));
  }
  rows.push(faceRows(entry.token?.faces));
  if (f.desc && !f.desc.inSrgb) rows.push(row(t('sRGB fallback'), `<code>${escapeText(f.hex)}</code>`, f.hex));
  const token = entry.token;
  if (token) {
    rows.push(row(t('Design token'), `<code>${escapeText(token.ref)}</code>`, token.ref));
    if (f.subject !== f.lead) rows.push(row(t('Authored as'), `<code>${escapeText(f.subject)}</code>`, f.subject));
    if (token.description && token.description !== entry.label) rows.push(row(t('Description'), escapeText(token.description)));
  }
  const body = rows.filter(Boolean).join('');
  return body
    ? `<dl class="cat-details-meta cat-swatch-meta">${body}</dl>`
    : `<p class="cat-swatch-muted">${escapeText(t('No print values or token are linked to this colour.'))}</p>`;
}

/** Hex first, since it is what most fields take, then the Lab's spaces. */
export function notationsHtml(f: SwatchFacts): string {
  if (!f.desc) return `<p class="cat-swatch-muted">${escapeText(t('Transparent has no colour to write down.'))}</p>`;
  const rows = [{ space: 'hex', css: f.desc.srgbHex.toUpperCase(), exact: f.desc.inSrgb }, ...f.desc.notations];
  const clamped = t('This space cannot hold the colour - CSS would clamp these numbers.');
  return `<ul class="cat-swatch-notations">${rows.map(n => `
    <li class="cat-swatch-notation${n.exact ? '' : ' is-inexact'}">
      <span class="cat-swatch-space">${escapeText(n.space)}${n.exact ? '' : ` <span class="cat-swatch-clamped" tabindex="0" data-tip="${escapeText(clamped)}">${escapeText(t('clamped'))}</span>`}</span>
      <code>${escapeText(n.css)}</code>
      ${copyButton(n.css)}
    </li>`).join('')}</ul>`;
}

/** The plane's full name, then what it is for. */
const planeCaption = (): string =>
  `<strong>${escapeText(t(PLANE_TITLE[chart.plane]))}</strong> ${escapeText(t(PLANE_WHY[chart.plane]))}`;

/** The chart controls, an empty mount the chart is painted into on open, and the
 *  verdict it illustrates. */
export function plotHtml(f: SwatchFacts): string {
  if (!f.desc) return `<p class="cat-swatch-muted">${escapeText(t('Transparent has no position in colour space.'))}</p>`;
  const { desc } = f;
  // A colour on the sRGB edge can measure a hair past its own ceiling. The verdict
  // says sRGB, so the headroom must not contradict it: inside sRGB it is never negative.
  const over = desc.headroom < 0 && !desc.inSrgb;
  const headroom = over ? desc.headroom : Math.max(0, desc.headroom);
  const ceilings = LIMITS.map(g => {
    const reached = desc.oklch.c <= desc.ceiling[g] + 1e-6;
    return `<li class="${reached ? '' : 'is-past'}"><span>${escapeText(GAMUT_TITLE[g])}</span><code>${desc.ceiling[g].toFixed(3)}</code></li>`;
  }).join('');
  return `
    ${segHtml('swatch-plane', PLANES.map(p => ({ id: p, label: PLANE_SHORT[p] })), chart.plane, t('Chart plane'), { attr: 'data-swatch-plane', extraClass: 'cat-swatch-seg' })}
    ${segHtml('swatch-limit', LIMITS.map(g => ({ id: g, label: GAMUT_TITLE[g] })), chart.limit, t('See it against'), { attr: 'data-swatch-limit', extraClass: 'cat-swatch-seg' })}
    <div class="cat-swatch-chart" data-swatch-chart></div>
    <p class="cat-swatch-why" data-swatch-why>${planeCaption()}</p>
    <dl class="cat-details-meta cat-swatch-meta">
      ${row(t('Displayable in'), `<strong>${escapeText(t(GAMUT_TITLE[desc.gamut]))}</strong> <span class="cat-swatch-muted">${escapeText(t(GAMUT_BLURB[desc.gamut]))}</span>`)}
      ${row(t('Chroma headroom'), `<code>${over ? '' : '+'}${headroom.toFixed(3)}</code> <span class="cat-swatch-muted">${escapeText(over
        ? tRaw('past the sRGB ceiling of {max} at this lightness and hue', { max: desc.ceiling.srgb.toFixed(3) })
        : t('of chroma still available within sRGB at this lightness and hue'))}</span>`)}
    </dl>
    <p class="cat-swatch-sub">${escapeText(t('Chroma ceiling here'))}</p>
    <ul class="cat-swatch-ceilings">${ceilings}</ul>`;
}

/** A perceptually even ramp through the colour's own hue, pale to dark, the same
 *  derivation the Colour Lab and the palette card use. Each step copies. */
export function tonesHtml(f: SwatchFacts): string {
  if (!f.desc) return `<p class="cat-swatch-muted">${escapeText(t('Transparent has no tones.'))}</p>`;
  const o = f.desc.oklch;
  const tones = rampOklab(
    [oklchToHex({ l: 0.97, c: o.c * 0.22, h: o.h }), f.desc.srgbHex, oklchToHex({ l: 0.13, c: o.c * 0.5, h: o.h })],
    TONE_STEPS, { correctLightness: true },
  );
  return `<p class="cat-swatch-sub">${escapeText(t('Click a step to copy its hex.'))}</p>
    <div class="cat-swatch-tones">${tones.map(hex => {
      const value = hex.toUpperCase();
      const desc = describeColor(hex);
      const label = desc ? formatOklch(desc.oklch) : value;
      return `<button type="button" class="cat-swatch-tone" data-swatch-copy="${escapeText(value)}"
        style="background:${escapeText(hex)};color:${escapeText(swatchInk(hex) ?? '#000')}"
        aria-label="${escapeText(tRaw('Copy {v}', { v: value }))}" title="${escapeText(`${value} · ${label}`)}"><span>${escapeText(value.slice(1))}</span></button>`;
    }).join('')}</div>`;
}

/** White and black text on the colour: APCA first, WCAG second, as in the Lab. */
export function readabilityHtml(f: SwatchFacts): string {
  if (!f.desc) return `<p class="cat-swatch-muted">${escapeText(t('Transparent takes the colour of whatever is behind the swatch.'))}</p>`;
  const bg = f.desc.srgbHex;
  const card = (label: string, text: string): string => {
    const apca = apcaVerdict(text, bg);
    const ratio = contrastRatio(text, bg);
    const level = wcagLevel(ratio);
    return `<div class="cat-swatch-read">
      <div class="cat-swatch-read-sample" style="${fill(f)};color:${text}" aria-hidden="true">Aa</div>
      <div class="cat-swatch-read-text">
        <span class="cat-swatch-read-label">${escapeText(label)}</span>
        <span><strong>${apca ? `Lc ${Math.round(apca.abs)}` : '-'}</strong> ${apca ? escapeText(t(apca.label)) : ''}</span>
        <span class="cat-swatch-muted">WCAG ${Number.isFinite(ratio) ? ratio.toFixed(2) : '-'}:1 · ${escapeText(level === 'fail' ? t('below AA') : level)}</span>
      </div>
    </div>`;
  };
  return `<div class="cat-swatch-reads">${card(t('White text'), '#ffffff')}${card(t('Black text'), '#000000')}</div>
    ${f.desc.inSrgb ? '' : `<p class="cat-swatch-sub">${escapeText(t(APCA_SRGB_ONLY))}</p>`}`;
}

const section = (id: string, label: string, body: string, open = false): string =>
  `<details data-inspector-id="swatch-${id}"${open ? ' open' : ''}><summary>${escapeText(label)}</summary>${body}</details>`;

/** The modal's markup: the colour as the preview, the sections in the body. */
export function sheetHtml(cat: CatCtx, f: SwatchFacts, nav: { prev: boolean; next: boolean }): string {
  const { entry, desc } = f;
  const ink = desc ? swatchInk(desc.srgbHex) ?? '#000' : 'currentColor';
  const fav = cat.favSet.has(cat.filters.swatchFavKey(entry.label));
  const flag = entry.spot ? 'SPOT' : Array.isArray(entry.cmyk) ? 'CMYK' : '';
  const lab = desc ? `#/lab?c=${encodeURIComponent(f.subject)}` : '';
  return `
    <button type="button" class="cat-details-close" data-act="close" aria-label="${escapeText(t('Close'))}">×</button>
    <div class="cat-details-preview cat-swatch-preview">
      ${nav.prev ? `<button type="button" class="cat-details-nav cat-details-prev" data-swatch-nav="prev" aria-label="${escapeText(t('Previous swatch'))}">${CHEVRON_LEFT}</button>` : ''}
      ${nav.next ? `<button type="button" class="cat-details-nav cat-details-next" data-swatch-nav="next" aria-label="${escapeText(t('Next swatch'))}">${CHEVRON_RIGHT}</button>` : ''}
      <div class="cat-swatch-stage${desc ? '' : ' is-transparent'}" style="${fill(f)};color:${escapeText(ink)}">
        <div class="cat-swatch-stage-text">
          ${flag ? `<span class="plat-chip-flag is-static">${flag}</span>` : ''}
          <span class="cat-swatch-stage-name">${escapeText(entry.label)}</span>
          <code class="cat-swatch-stage-value">${escapeText(f.lead)}</code>
          ${desc ? `<code class="cat-swatch-stage-alt">${escapeText(formatOklch(desc.oklch))}</code>` : ''}
        </div>
      </div>
    </div>
    <div class="cat-details-body">
      <h2 class="cat-details-name">${escapeText(entry.label)}</h2>
      <div class="cat-details-actions">
        <button type="button" class="btn btn--primary" data-inspector-primary data-swatch-copy="${escapeText(f.lead)}">${icon('clipboard', { size: 16 })}<span>${escapeText(tRaw('Copy {v}', { v: f.lead }))}</span></button>
        <button type="button" class="btn" data-inspector-primary data-act="download" aria-haspopup="menu">${DOWNLOAD_ICON}<span>${escapeText(t('Download as…'))}</span></button>
        <button type="button" class="btn" data-inspector-primary data-act="share">${SHARE_ICON}<span>${escapeText(t('Copy link'))}</span></button>
        ${lab ? `<a class="btn" data-inspector-primary href="${escapeText(lab)}">${icon('flask', { size: 16 })}<span>${escapeText(t('Open in Colour Lab'))}</span></a>` : ''}
        <div class="cat-act-row">
          <button type="button" class="btn cat-act-fav${fav ? ' is-fav' : ''}" data-act="fav" data-sfx="twinkle" aria-pressed="${fav}">${STAR_ICON}<span>${escapeText(fav ? t('Favourited') : t('Favourite'))}</span></button>
        </div>
      </div>
      ${section('linked', t('Linked values'), linkedHtml(f), true)}
      ${section('notations', t('Every notation'), notationsHtml(f), true)}
      ${section('plot', t('Plotted on a colour space'), plotHtml(f), true)}
      ${section('tones', t('Tones'), tonesHtml(f))}
      ${section('readability', t('Readability'), readabilityHtml(f))}
    </div>`;
}

// ── The chart ─────────────────────────────────────────────────────────────────

/** Draw the chart for the current plane and gamut. The chart module is loaded on
 *  first use, so the Assets view does not carry its code until a swatch is opened. */
async function paintChart(dlg: HTMLElement, f: SwatchFacts): Promise<void> {
  const mount = dlg.querySelector<HTMLElement>('[data-swatch-chart]');
  if (!mount || !f.desc || !mount.closest('details')?.open) return;
  const slice = await import('../../lib/oklch-slice.ts');
  if (!mount.isConnected) return;
  const state = { plane: chart.plane, fixed: slice.sliceFixedOf(chart.plane, f.desc.oklch), limit: chart.limit };
  const key = `${state.plane}|${state.limit}|${state.fixed}`;
  if (mount.dataset.drawn !== key) {
    mount.innerHTML = slice.renderSliceChart(state, [{ idx: 0, hex: f.desc.srgbHex, label: f.entry.label, oklch: f.desc.oklch }]);
    mount.dataset.drawn = key;
  }
  slice.paintSliceChart(mount, state, { quality: 'full' });
}

// ── Opening ───────────────────────────────────────────────────────────────────

/** The address bar carries the open swatch, the way it carries an open asset. */
export function syncSwatchUrl(cat: CatCtx, label: string | null): void {
  if (cat.preview) return;
  const [path = '', query = ''] = location.hash.split('?');
  if (path !== '#/a' && path !== '#/assets') return;
  const params = new URLSearchParams(query);
  params.delete('asset');
  if (label) params.set('swatch', label); else params.delete('swatch');
  const q = params.toString();
  replaceRouteUrl(`${location.pathname}${path}${q ? `?${q}` : ''}`);
}

export const swatchLink = (_cat: CatCtx, label: string): string =>
  `${location.origin}${appPathname()}#/a?swatch=${encodeURIComponent(label)}`;

/** Open the swatch whose label is `label`; false when this palette has none. */
export function openSwatchByLabel(cat: CatCtx, label: string): boolean {
  const index = paletteInDisplayOrder(cat.palette).findIndex(c => c.label === label);
  if (index < 0) return false;
  openSwatch(cat, index);
  return true;
}

async function copyFrom(el: HTMLElement, value: string): Promise<void> {
  if (await copyText(value)) {
    el.classList.add('is-copied');
    setTimeout(() => el.classList.remove('is-copied'), 900);
    announce(tRaw('Copied {v}', { v: value }));
  } else {
    announce(t('Copy failed'), { assertive: true });
  }
}

export function openSwatch(cat: CatCtx, index: number): void {
  const list = paletteInDisplayOrder(cat.palette);
  const entry = list[index];
  if (!entry) return;
  const f = swatchFacts(entry);
  const wasOpen = !!cat.detailsDialog;
  cat.detailsOpening = true;
  try { cat.sections.closeDetails(); } finally { cat.detailsOpening = false; }
  const nav = { prev: index > 0, next: index < list.length - 1 };
  let disposeDock: (() => void) | undefined;
  let resize: ResizeObserver | null = null;
  const modal = mountModal(sheetHtml(cat, f, nav), {
    className: 'cat-details cat-swatch-details',
    backStack: !cat.preview,
    ariaLabel: entry.label,
    initialFocus: (el) => el.querySelector<HTMLElement>('.cat-details-close'),
    // Escape closes an open format menu first, then the sheet.
    onEscape: () => { if (cat.actionsPopover?.isOpen()) cat.actionsPopover.close(true); else modal.close(); },
    onClose: () => {
      cat.actionsPopover?.close();
      disposeDock?.();
      resize?.disconnect();
      if (!cat.detailsOpening) syncSwatchUrl(cat, null);
      cat.detailsDialog = null;
      cat.detailsModal = null;
    },
  });
  const dlg = modal.el;
  disposeDock = mountAssetInspectorDock(dlg);
  cat.detailsDialog = dlg;
  cat.detailsModal = modal;
  syncSwatchUrl(cat, entry.label);
  if (!wasOpen) playSfx('whisper');

  const page = (step: -1 | 1): void => { if (list[index + step]) openSwatch(cat, index + step); };
  const plot = dlg.querySelector<HTMLDetailsElement>('[data-inspector-id="swatch-plot"]');
  const repaint = (): void => { void paintChart(dlg, f); };
  plot?.addEventListener('toggle', repaint);
  if (typeof ResizeObserver !== 'undefined') {
    let frame = 0;
    resize = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(repaint);
    });
    const mount = dlg.querySelector('[data-swatch-chart]');
    if (mount) resize.observe(mount);
  }
  requestAnimationFrame(repaint);

  dlg.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-act="close"]')) { modal.close(); return; }
    const copy = target.closest<HTMLElement>('[data-swatch-copy]');
    if (copy?.dataset.swatchCopy) { void copyFrom(copy, copy.dataset.swatchCopy); return; }
    const nav = target.closest<HTMLElement>('[data-swatch-nav]');
    if (nav) { page(nav.dataset.swatchNav === 'prev' ? -1 : 1); return; }
    const plane = target.closest<HTMLElement>('[data-swatch-plane]');
    const limit = target.closest<HTMLElement>('[data-swatch-limit]');
    if (plane || limit) {
      if (plane) chart.plane = plane.dataset.swatchPlane as SlicePlane;
      if (limit) chart.limit = limit.dataset.swatchLimit as Limit;
      const group = (plane ?? limit)!.parentElement;
      for (const b of group?.querySelectorAll<HTMLElement>('button') ?? []) b.setAttribute('aria-pressed', String(b === (plane ?? limit)));
      const why = dlg.querySelector('[data-swatch-why]');
      if (why) {
        const name = document.createElement('strong');
        name.textContent = t(PLANE_TITLE[chart.plane]);
        why.replaceChildren(name, ` ${t(PLANE_WHY[chart.plane])}`);
      }
      repaint();
      return;
    }
    const act = target.closest<HTMLElement>('[data-act]')?.dataset.act;
    if (act === 'share') {
      const btn = target.closest<HTMLElement>('[data-act]')!;
      void copyFrom(btn, swatchLink(cat, entry.label));
    } else if (act === 'download') {
      cat.swatchSet.openDownloadMenu([entry], target.closest<HTMLElement>('[data-act]'));
    } else if (act === 'fav') {
      void cat.userAssets.toggleFavourite(cat.filters.swatchFavKey(entry.label)).then(() => {
        const on = cat.favSet.has(cat.filters.swatchFavKey(entry.label));
        for (const b of dlg.querySelectorAll<HTMLElement>('.cat-act-fav')) {
          b.classList.toggle('is-fav', on);
          b.setAttribute('aria-pressed', String(on));
          const label = b.querySelector('span');
          if (label) label.textContent = on ? t('Favourited') : t('Favourite');
        }
      });
    }
  });
  // A single-finger horizontal swipe on the colour pages too, as it does on an
  // asset's preview. Passive, so a vertical scroll is never held up.
  const stage = dlg.querySelector<HTMLElement>('.cat-swatch-preview');
  let sx = 0, sy = 0, armed = false;
  stage?.addEventListener('touchstart', (e) => {
    const p = e.touches[0];
    armed = e.touches.length === 1 && !!p && !(e.target as HTMLElement).closest('button');
    if (p) { sx = p.clientX; sy = p.clientY; }
  }, { passive: true });
  stage?.addEventListener('touchend', (e) => {
    const p = e.changedTouches[0];
    if (!armed || !p) return;
    armed = false;
    const dx = p.clientX - sx, dy = p.clientY - sy;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    page(dx < 0 ? 1 : -1);
  }, { passive: true });
  // Left and right page through the palette, like the on-screen buttons.
  dlg.addEventListener('keydown', (e) => {
    if ((e.target as HTMLElement).closest('input, textarea, select, [contenteditable], [role="group"]')) return;
    if (e.key === 'ArrowLeft' && nav.prev) { e.preventDefault(); page(-1); }
    else if (e.key === 'ArrowRight' && nav.next) { e.preventDefault(); page(1); }
  });
}

export function swatchDetailsOps(cat: CatCtx) {
  return {
    openSwatch: bindOp(cat, openSwatch),
    openSwatchByLabel: bindOp(cat, openSwatchByLabel),
    syncSwatchUrl: bindOp(cat, syncSwatchUrl),
    swatchLink: bindOp(cat, swatchLink),
  };
}
